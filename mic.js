// Recording the learner's voice with the phone's microphone, in any modern browser: getUserMedia
// and MediaRecorder (Safari on iPhone from iOS 14.3, Chrome and others on Android), with a level
// meter from Web Audio to tell speech from silence. Nothing leaves the device: a recording lives
// in memory as an object URL until the lesson is closed.
// Where the microphone is out of reach (a page in a frame without allow="microphone", like the
// claude.ai artifact, a browser without it, a refusal) callers fall back to «Я сказал(а) вслух».

// Opus in WebM for Chrome and Firefox, AAC in MP4 for Safari.
const TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];

export const supported = () => typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  && typeof window !== 'undefined' && window.isSecureContext !== false;

// false when the page may not use the microphone at all: a frame without allow="microphone".
// Browsers that cannot tell (Safari) answer true, and the first recording finds out.
export function allowed() {
  try {
    const policy = document.permissionsPolicy || document.featurePolicy;
    if (policy && typeof policy.allowsFeature === 'function') return policy.allowsFeature('microphone');
  } catch (e) { /* unknown: try */ }
  return true;
}

function failure(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

const closeCtx = (ctx) => { try { if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {}); } catch (e) { /* closed */ } };

// The loudest moment of each of n parts: the shape of the recording for a voice bubble.
function squeeze(levels, n) {
  if (!levels.length) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const from = Math.floor((i * levels.length) / n);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / n));
    out.push(Math.max(...levels.slice(from, to)));
  }
  return out;
}

// Starts at once, so call it from the tap itself. onLevel(0..1) comes about 20 times a second.
// The recording stops by itself quietMs after the speech ends, after waitMs without speech, or
// at maxMs. Returns { stop, done }; done resolves { blob, url, ms, voicedMs, heard, levels } or
// rejects with code denied (not allowed), nomic (no microphone), busy (taken by another app),
// unsupported or failed.
export function record({ onLevel = () => {}, maxMs = 10000, quietMs = 1300, waitMs = 6000 } = {}) {
  // iOS lets audio start only within the tap: the context is made before anything is awaited.
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  let ctx = null;
  try {
    ctx = AC ? new AC() : null;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch (e) {
    ctx = null;
  }
  let stopNow = null;
  let stopped = false;
  const stop = () => {
    stopped = true;
    if (stopNow) stopNow();
  };

  const done = (async () => {
    if (!supported()) {
      closeCtx(ctx);
      throw failure('unsupported');
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      closeCtx(ctx);
      const n = e && e.name;
      throw failure(n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError' ? 'denied'
        : n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError' ? 'nomic'
        : n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError' ? 'busy' : 'failed');
    }

    const chunks = [];
    let rec = null;
    try {
      if (typeof MediaRecorder !== 'undefined') {
        const type = TYPES.find((t) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t));
        rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.start(250);
      }
    } catch (e) {
      rec = null;
    }
    let analyser = null;
    let buf = null;
    try {
      if (ctx) {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        buf = new Float32Array(analyser.fftSize);
      }
    } catch (e) {
      analyser = null;
    }

    const t0 = Date.now();
    const levels = [];
    let floor = 1;
    let voicedMs = 0;
    let lastVoice = t0;
    let heard = false;
    let prev = t0;
    const ms = await new Promise((resolve) => {
      let id = null;
      const finish = () => {
        if (id === null) return;
        clearInterval(id);
        id = null;
        resolve(Date.now() - t0);
      };
      id = setInterval(() => {
        const now = Date.now();
        const dt = now - prev;
        prev = now;
        let level = 0;
        if (analyser) {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          // The quietest moment is the room; speech stands well above it, whatever the phone.
          floor = Math.min(floor, Math.max(rms, 0.002));
          if (rms > Math.min(0.06, Math.max(0.015, floor * 3))) {
            voicedMs += dt;
            lastVoice = now;
            if (voicedMs >= 150) heard = true;
          }
          level = Math.min(1, Math.sqrt(rms / 0.3));
        }
        levels.push(level);
        onLevel(level);
        const t = now - t0;
        if (t >= maxMs || (heard && now - lastVoice >= quietMs) || (analyser && !heard && t >= waitMs)) finish();
      }, 50);
      stopNow = finish;
      if (stopped) finish();
    });

    // The recorder hands over its last piece on stop; then the microphone is let go.
    if (rec && rec.state !== 'inactive') {
      await new Promise((resolve) => {
        rec.onstop = resolve;
        setTimeout(resolve, 1500);
        try { rec.stop(); } catch (e) { resolve(); }
      });
    }
    stream.getTracks().forEach((t) => t.stop());
    closeCtx(ctx);
    const blob = chunks.length ? new Blob(chunks, { type: (rec && rec.mimeType) || chunks[0].type || 'audio/webm' }) : null;
    return {
      blob,
      url: blob ? URL.createObjectURL(blob) : null,
      ms,
      voicedMs,
      // Without Web Audio there is no meter: a recording stopped by hand after a moment counts as said.
      heard: analyser ? heard : ms > 600,
      levels: squeeze(levels, 24),
    };
  })();
  return { stop, done };
}

// One recording plays at a time.
let player = null;
export function play(url) {
  try {
    if (player) player.pause();
    player = new Audio(url);
    const p = player.play();
    if (p && p.catch) p.catch(() => {});
    return true;
  } catch (e) {
    return false;
  }
}

export function stopPlaying() {
  try { if (player) player.pause(); } catch (e) { /* nothing plays */ }
}
