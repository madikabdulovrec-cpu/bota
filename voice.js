// Kazakh speech. First choice: recorded lines — audio files made in advance, which any phone can
// play (mvp/audio/, listed in audio-index.js, made by tools/audio.mjs with the voice named in
// mvp/audio/voice.json). Second: the browser's own Kazakh voice (Web Speech; Edge ships online
// voices Aigul and Daulet). A line with the learner's name has no file, and most browsers have no
// Kazakh voice, so every caller must work without sound.
// A namespace import: an older audio-index.js without AUDIO_CREDIT must not stop the app.
import * as INDEX from './audio-index.js?v=5d19dff';

const AUDIO = INDEX.AUDIO || new Set();

let voice = null;
const listeners = new Set();
const changed = () => listeners.forEach((fn) => fn());

/* ---------- recorded lines ---------- */

// The text a file is made from: quotes and runs of spaces do not change the sound.
export const audioKey = (text) => String(text).replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();

// FNV-1a over the text: the name of its file. tools/audio.mjs names the files the same way.
export function audioHash(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

// The files are used once one of them is seen to load: the claude.ai artifact carries none. Without
// network (an app started offline) the check fails: it runs again when the network comes back and
// when a line is asked to sound. A host that answers with something else has no files.
let filesOk = false;
let filesNo = false;
let probing = false;
function probe() {
  if (filesOk || filesNo || probing || !AUDIO.size || typeof fetch === 'undefined') return;
  probing = true;
  const first = AUDIO.values().next().value;
  // A host may answer any address with a page: only a real sound file counts.
  fetch(`audio/${first}.mp3`, { method: 'HEAD' })
    .then((r) => {
      if (r.ok && /audio|mpeg/i.test(r.headers.get('content-type') || '')) { filesOk = true; changed(); }
      else if (r.ok || r.status === 404) filesNo = true;
    })
    .catch(() => { /* no network: tried again later */ })
    .finally(() => { probing = false; });
}

const fileFor = (text) => {
  if (!filesOk || !text) return null;
  const h = audioHash(audioKey(text));
  return AUDIO.has(h) ? `audio/${h}.mp3` : null;
};

// One element plays every recorded line. iOS lets a sound start without a tap only on an element that
// once played within a tap, and the lines of a lesson start from timers: the first tap anywhere plays
// a moment of silence on it, and every line after that plays on this same element.
let el = null;
let unlocked = false;
// The number of the line on the element now: an event of a line that is over is not taken for it.
let cur = 0;
// Ends the say() of the line playing, when another sound or stop() cuts it short.
let cut = null;
let held = false;
// A run of lines (sayAll) goes on while this number stays its own: any other sound ends it.
let run = 0;

function element() {
  if (!el && typeof Audio !== 'undefined') el = new Audio();
  return el;
}

// A tenth of a second of silence, as a WAV file.
function silence() {
  const n = 800;
  const b = new Uint8Array(44 + n);
  const d = new DataView(b.buffer);
  const tag = (at, s) => [...s].forEach((c, i) => d.setUint8(at + i, c.charCodeAt(0)));
  tag(0, 'RIFF'); d.setUint32(4, 36 + n, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
  d.setUint32(24, 8000, true); d.setUint32(28, 8000, true); d.setUint16(32, 1, true); d.setUint16(34, 8, true);
  tag(36, 'data'); d.setUint32(40, n, true); b.fill(128, 44);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}

function unlock() {
  if (unlocked || !filesOk) return;
  const a = element();
  // A line is on the element already: the tap that started it opens the element too.
  if (!a || !a.paused) return;
  const me = ++cur;
  try {
    a.src = silence();
    const p = a.play();
    if (p && p.then) p.then(() => { unlocked = true; if (me === cur) a.pause(); }, () => { /* the next tap tries again */ });
  } catch (e) { /* no sound here */ }
}

// The speed of a file for a rate of the browser's voice: slow lines at 0.75, fast ones up to 1.3.
const fileRate = (rate) => (rate < 0.8 ? 0.75 : rate > 1.05 ? Math.min(1.3, rate) : 1);

// The learner's own recordings (mic.js) and these lines stop each other.
const SOUND = 'bota-sound';
const announce = () => { try { window.dispatchEvent(new CustomEvent(SOUND, { detail: 'voice' })); } catch (e) { /* old browser */ } };

function stopFile() {
  const done = cut;
  cut = null;
  cur++;
  if (el && !el.paused) { try { el.pause(); } catch (e) { /* gone */ } }
  if (done) done();
}

// Puts a recorded line on the element: its number, and whether an event belongs to it.
function startFile(src, rate) {
  halt();
  announce();
  const a = element();
  const me = ++cur;
  a.onended = null;
  a.onerror = null;
  a.onpause = null;
  a.src = src;
  // A new source resets the speed: it is set after it.
  a.defaultPlaybackRate = rate;
  a.playbackRate = rate;
  return { a, me, mine: () => me === cur && a.src.endsWith(src) };
}

function play(a, fallBack) {
  try {
    const p = a.play();
    if (p && p.then) p.then(() => { unlocked = true; }, (e) => { if (!e || e.name !== 'AbortError') fallBack(); });
  } catch (e) {
    fallBack();
  }
}

/* ---------- the browser's voice ---------- */

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const all = window.speechSynthesis.getVoices() || [];
  const kk = all.filter((v) => /^kk([-_]|$)/i.test(v.lang) || /kazakh|қазақ/i.test(v.name));
  kk.sort((a, b) => Number(/natural|online/i.test(b.name)) - Number(/natural|online/i.test(a.name)));
  const next = kk[0] || null;
  if (next !== voice) {
    voice = next;
    changed();
  }
}

function utterance(text, rate) {
  const u = new SpeechSynthesisUtterance(text.replace(/[«»]/g, ''));
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = rate;
  return u;
}

function speakWeb(text, rate) {
  if (!voice || !text) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    announce();
    synth.speak(utterance(text, rate));
    return true;
  } catch (e) {
    return false;
  }
}

function sayWeb(text, rate) {
  return new Promise((resolve) => {
    if (!voice || !text) { resolve(); return; }
    let finished = false;
    const finish = () => { if (!finished) { finished = true; resolve(); } };
    try {
      const u = utterance(text, rate);
      u.onend = finish;
      u.onerror = finish;
      announce();
      window.speechSynthesis.speak(u);
      setTimeout(finish, 1500 + text.length * 110);
    } catch (e) {
      finish();
    }
  });
}

/* ---------- what the app calls ---------- */

export function init(onChange) {
  if (onChange) listeners.add(onChange);
  probe();
  if (typeof window !== 'undefined') {
    window.addEventListener(SOUND, (e) => { if (e.detail !== 'voice') stop(); });
    window.addEventListener('online', probe);
    const tap = () => unlock();
    ['touchend', 'click', 'keydown'].forEach((t) => document.addEventListener(t, tap, { capture: true, passive: true }));
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return () => listeners.delete(onChange);
  pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  // Some browsers fill the list late and never fire the event.
  setTimeout(pickVoice, 800);
  setTimeout(pickVoice, 2500);
  return () => listeners.delete(onChange);
}

// Some Kazakh sound here at all: recorded lines or the browser's voice.
export const available = () => !!voice || filesOk;
// This very text can sound: it has a recording, or the browser has a Kazakh voice.
export const canSay = (text) => !!text && (!!voice || !!fileFor(text));
// Recorded lines are playing here, not only the browser's voice.
export const recorded = () => filesOk;
// The recorded lines are not here yet only because the network was off: they may come with it.
export const waiting = () => !filesOk && !filesNo && AUDIO.size > 0;
// Who made the recorded voice, for the profile: «синтез речи Microsoft Azure, голоса …».
export const credit = () => (filesOk ? INDEX.AUDIO_CREDIT || '' : '');
export const name = () => (voice ? voice.name.replace(/^Microsoft\s+/i, '').replace(/\s*-\s*Kazakh.*$/i, '') : '');

// While the microphone records, every sound waits: it would be recorded as the learner's voice.
export function hold(on) {
  held = !!on;
  if (held) stop();
}

export function speak(text, rate = 0.92) {
  if (held || !text) return false;
  probe();
  run++;
  const src = fileFor(text);
  if (!src) return speakWeb(text, rate);
  const { a, mine } = startFile(src, fileRate(rate));
  let fellBack = false;
  // A file that does not load gives way to the browser's voice.
  const fallBack = () => {
    if (fellBack || !mine()) return;
    fellBack = true;
    cur++;
    speakWeb(text, rate);
  };
  a.onerror = fallBack;
  play(a, fallBack);
  return true;
}

export const slow = (text) => speak(text, 0.6);

// Lines that appear one after another; resolves when the line has sounded.
export function say(text, rate = 0.92) {
  return new Promise((resolve) => {
    if (held || !text) { resolve(); return; }
    probe();
    let finished = false;
    const finish = () => { if (!finished) { finished = true; resolve(); } };
    const src = fileFor(text);
    if (!src) { sayWeb(text, rate).then(finish); return; }
    const { a, mine } = startFile(src, fileRate(rate));
    // Stopped by another sound or by stop(): the conversation goes on.
    cut = finish;
    let fellBack = false;
    const fallBack = () => {
      if (fellBack || finished || !mine()) return;
      fellBack = true;
      cut = null;
      cur++;
      sayWeb(text, rate).then(finish);
    };
    a.onended = () => { if (mine()) { cut = null; finish(); } };
    // Paused from outside (another app took the sound): the conversation goes on too. The pause of the
    // line before, which comes after this one has started, finds the element playing.
    a.onpause = () => { if (mine() && a.paused && !a.ended) { cut = null; finish(); } };
    a.onerror = fallBack;
    play(a, fallBack);
    setTimeout(finish, 3000 + text.length * 120);
  });
}

// Lines one after another: what was just said, once more («Медленно» in «Послушай»).
export async function sayAll(texts, rate = 0.92) {
  const mine = ++run;
  for (const text of texts) {
    if (mine !== run || held) return;
    await say(text, rate);
  }
}

function halt() {
  stopFile();
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* no sound */ }
}

export function stop() {
  run++;
  halt();
}
