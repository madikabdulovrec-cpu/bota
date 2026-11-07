// Kazakh speech. First choice: recorded lines — audio files made in advance with Piper and the
// ISSAI KazakhTTS2 voice (CC BY 4.0), which any phone can play (mvp/audio/, listed in
// audio-index.js, made by tools/audio.mjs and tools/audio_synth.py). Second: the browser's own
// Kazakh voice (Web Speech; Edge ships online voices Aigul and Daulet). A line with the learner's
// name has no file, and most browsers have no Kazakh voice, so every caller must work without sound.
import { AUDIO } from './audio-index.js?v=ce769eb';

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

// The files are used once one of them is seen to load: the claude.ai artifact carries none.
let filesOk = false;
let probed = false;
function probe() {
  if (probed || !AUDIO.size || typeof fetch === 'undefined') return;
  probed = true;
  const first = AUDIO.values().next().value;
  // A host may answer any address with a page: only a real sound file counts.
  fetch(`audio/${first}.mp3`, { method: 'HEAD' })
    .then((r) => { if (r.ok && /audio|mpeg/i.test(r.headers.get('content-type') || '')) { filesOk = true; changed(); } })
    .catch(() => { /* no files here: the browser's voice, if any */ });
}

const fileFor = (text) => {
  if (!filesOk || !text) return null;
  const h = audioHash(audioKey(text));
  return AUDIO.has(h) ? `audio/${h}.mp3` : null;
};

// One sound at a time, and none while the microphone records the learner.
let player = null;
let held = false;

// The learner's own recordings (mic.js) and these lines stop each other.
const SOUND = 'bota-sound';
const announce = () => { try { window.dispatchEvent(new CustomEvent(SOUND, { detail: 'voice' })); } catch (e) { /* old browser */ } };

function stopFile() {
  if (!player) return;
  const p = player;
  player = null;
  try { p.pause(); } catch (e) { /* gone */ }
}

function startFile(src, rate) {
  stop();
  announce();
  const a = new Audio(src);
  a.playbackRate = rate;
  player = a;
  return a;
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
// Recorded lines are playing here (the voice of ISSAI KazakhTTS2), not only the browser's voice.
export const recorded = () => filesOk;
export const name = () => (voice ? voice.name.replace(/^Microsoft\s+/i, '').replace(/\s*-\s*Kazakh.*$/i, '') : '');

// While the microphone records, every sound waits: it would be recorded as the learner's voice.
export function hold(on) {
  held = !!on;
  if (held) stop();
}

export function speak(text, rate = 0.92) {
  if (held || !text) return false;
  const src = fileFor(text);
  if (!src) return speakWeb(text, rate);
  const a = startFile(src, rate < 0.8 ? 0.75 : 1);
  let fellBack = false;
  // A file that does not load gives way to the browser's voice.
  const fallBack = () => {
    if (fellBack || player !== a) return;
    fellBack = true;
    player = null;
    speakWeb(text, rate);
  };
  a.onerror = fallBack;
  const p = a.play();
  if (p && p.catch) p.catch((e) => { if (!e || e.name !== 'AbortError') fallBack(); });
  return true;
}

export const slow = (text) => speak(text, 0.6);

// Lines that appear one after another; resolves when the line has sounded.
export function say(text, rate = 0.92) {
  return new Promise((resolve) => {
    if (held || !text) { resolve(); return; }
    let finished = false;
    const finish = () => { if (!finished) { finished = true; resolve(); } };
    const src = fileFor(text);
    if (!src) { sayWeb(text, rate).then(finish); return; }
    const a = startFile(src, 1);
    let fellBack = false;
    const fallBack = () => {
      if (fellBack || finished) return;
      fellBack = true;
      if (player === a) player = null;
      sayWeb(text, rate).then(finish);
    };
    a.onended = finish;
    // Stopped by another sound or by stop(): the conversation goes on.
    a.onpause = () => { if (!a.ended && !fellBack) finish(); };
    a.onerror = fallBack;
    const p = a.play();
    if (p && p.catch) p.catch((e) => { if (!e || e.name !== 'AbortError') fallBack(); });
    setTimeout(finish, 3000 + text.length * 120);
  });
}

export function stop() {
  stopFile();
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* no sound */ }
}
