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

// Starts at once, so call it from the tap itself. onStart() comes when the microphone is really on
// (the first time, after the browser has asked); onLevel(0..1) about 20 times a second. The
// recording stops by itself quietMs after the speech ends (long enough for a learner reading by
// syllables), after waitMs without speech, or at maxMs. Returns { stop, cancel, done }; done
// resolves { blob, url, ms, voicedMs, heard, levels } — or { cancelled: true } after cancel() — and
// rejects with code denied (not allowed), nomic (no microphone), busy (taken by another app),
// unsupported or failed.
export function record({ onLevel = () => {}, onStart = () => {}, maxMs = 10000, quietMs = 2200, waitMs = 6000 } = {}) {
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
  let cancelled = false;
  const stop = () => {
    stopped = true;
    if (stopNow) stopNow();
  };
  // Stop and throw the recording away: the learner pressed something else meanwhile.
  const cancel = () => {
    cancelled = true;
    stop();
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
    // After the permission dialog the context may still be asleep (Safari): wake it, or the meter reads zeros.
    if (ctx && ctx.state !== 'running') {
      try { await ctx.resume(); } catch (e) { /* the meter may stay silent; see peak below */ }
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
    let peak = 0;
    let voicedMs = 0;
    let lastVoice = t0;
    let heard = false;
    let prev = t0;
    if (!stopped) onStart();
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
          peak = Math.max(peak, rms);
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
        // A meter that reads pure zeros is broken (old WebKit), not a silent room: then only the
        // learner's «Готово» or maxMs ends the recording.
        const metered = !!analyser && peak > 0;
        if (t >= maxMs || (metered && heard && now - lastVoice >= quietMs) || (metered && !heard && t >= waitMs)) finish();
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
    if (cancelled) return { cancelled: true };
    const blob = chunks.length ? new Blob(chunks, { type: (rec && rec.mimeType) || chunks[0].type || 'audio/webm' }) : null;
    return {
      blob,
      url: blob ? URL.createObjectURL(blob) : null,
      ms,
      voicedMs,
      // Without a working meter a recording stopped by hand after a moment counts as said.
      heard: analyser && peak > 0 ? heard : ms > 600,
      levels: squeeze(levels, 24),
    };
  })();
  return { stop, cancel, done };
}

// One recording plays at a time, and it stops a sample line that sounds (voice.js) and is stopped by one.
let player = null;
const SOUND = 'bota-sound';
if (typeof window !== 'undefined') window.addEventListener(SOUND, (e) => { if (e.detail !== 'mic') stopPlaying(); });

export function play(url) {
  try {
    if (player) player.pause();
    try { window.dispatchEvent(new CustomEvent(SOUND, { detail: 'mic' })); } catch (e) { /* old browser */ }
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
