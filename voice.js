// Kazakh speech through the browser's own voices (Web Speech API).
// Edge ships online Kazakh voices (Aigul, Daulet); most other browsers have none,
// so every caller must work without sound.

let voice = null;
const listeners = new Set();

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const all = window.speechSynthesis.getVoices() || [];
  const kk = all.filter((v) => /^kk([-_]|$)/i.test(v.lang) || /kazakh|қазақ/i.test(v.name));
  kk.sort((a, b) => Number(/natural|online/i.test(b.name)) - Number(/natural|online/i.test(a.name)));
  const next = kk[0] || null;
  if (next !== voice) {
    voice = next;
    listeners.forEach((fn) => fn());
  }
}

export function init(onChange) {
  if (onChange) listeners.add(onChange);
  if (!('speechSynthesis' in window)) return () => listeners.delete(onChange);
  pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  // Some browsers fill the list late and never fire the event.
  setTimeout(pickVoice, 800);
  setTimeout(pickVoice, 2500);
  return () => listeners.delete(onChange);
}

export const available = () => !!voice;
export const name = () => (voice ? voice.name.replace(/^Microsoft\s+/i, '').replace(/\s*-\s*Kazakh.*$/i, '') : '');

export function speak(text, rate = 0.92) {
  if (!voice || !text) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[«»]/g, ''));
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = rate;
    synth.speak(u);
    return true;
  } catch (e) {
    return false;
  }
}

export const slow = (text) => speak(text, 0.6);

// Queued speech for lines that appear one after another; resolves when the line ends.
export function say(text, rate = 0.92) {
  return new Promise((resolve) => {
    if (!voice || !text) { resolve(); return; }
    let finished = false;
    const finish = () => { if (!finished) { finished = true; resolve(); } };
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/[«»]/g, ''));
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = rate;
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
      setTimeout(finish, 1500 + text.length * 110);
    } catch (e) {
      finish();
    }
  });
}

export function stop() {
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* no sound */ }
}
