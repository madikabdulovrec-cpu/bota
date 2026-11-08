// Anonymous statistics of the pilot: what learners do in the app, never who they are.
//
// Sent once the learner agreed (settings.stats): a random number of this installation, made here and
// tied to nothing; the app version; the kind of phone (iPhone, Android, other) and whether the app is
// on the home screen; events with their day — lessons started, finished or left at step N, reviews,
// races, «Малыш», whether a recording worked, the reminder, errors of the app.
// Never sent: the name, the baby's name, recordings, typed answers.
// A learner's own message («Неточность во фразе», «Написать нам», a survey) leaves when they press
// «Отправить»; with statistics off it goes without the installation number.
// Nothing is collected where the page names no address: the claude.ai artifact and the local preview
// have none (tools/site.mjs writes it into the page as <meta name="bota-stats">). Events wait in
// localStorage and go in batches as plain text, so the browser sends them without a check request;
// when the page is hidden they leave with sendBeacon.

const QUEUE_KEY = 'bota-stats-queue';
const ID_KEY = 'bota-stats-id';
const MAX_QUEUE = 500;
const BATCH = 100;

const tag = typeof document !== 'undefined' ? document.querySelector('meta[name="bota-stats"]') : null;
const endpoint = tag ? (tag.getAttribute('content') || '').trim() : '';
let on = false;
let info = { v: 'dev', p: 'other', sa: false };
let timer = 0;
let sending = false;

function rand(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}
const pad2 = (n) => String(n).padStart(2, '0');
const today = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function read() {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(q) ? q : [];
  } catch (e) {
    return [];
  }
}
function write(q) {
  try {
    if (q.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
    else localStorage.removeItem(QUEUE_KEY);
  } catch (e) { /* storage full or blocked: these events are lost, the app goes on */ }
}
function installId() {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id || !/^[a-z0-9]{16}$/.test(id)) {
      id = rand(16);
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch (e) {
    return '';
  }
}
const event = (t, d) => ({ u: rand(12), t, at: Date.now(), day: today(), d: d || {} });

// The kind of phone, no more: iPhone, Android or anything else.
export function platform() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return /Android/i.test(ua) ? 'android' : 'other';
}

// An address is set: the app may ask for consent and offer to write to the team.
export const ready = () => !!endpoint;

// The number of this installation, once statistics have been sent: by it a learner may ask the team
// to delete their data.
export function number() {
  try {
    return localStorage.getItem(ID_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function setup({ consent, version, standalone }) {
  info = { v: String(version || 'dev').slice(0, 40), p: platform(), sa: !!standalone };
  setConsent(consent);
}

// Turned off, statistics forget what was waiting to be sent.
export function setConsent(value) {
  on = !!value && !!endpoint;
  if (!on) {
    clearTimeout(timer);
    write([]);
  } else schedule(1500);
}

// An event: its type and a few plain values (numbers, yes or no, short words).
export function track(t, d) {
  if (!on) return;
  const q = read();
  q.push(event(t, d));
  write(q);
  // A hidden page may never come back: what it just did leaves at once.
  if (document.visibilityState === 'hidden') flush(true);
  else schedule(4000);
}

// The learner's own message. 'sent', 'queued' (it leaves with the statistics, also offline) or 'failed'.
export async function message(t, d) {
  if (!endpoint) return 'failed';
  const ev = event(t, d);
  if (on) {
    const q = read();
    q.push(ev);
    write(q);
    return (await flush()) ? 'sent' : 'queued';
  }
  return (await post({ app: 'bota', id: '', ...info, ev: [ev] })) ? 'sent' : 'failed';
}

function schedule(ms) {
  if (!endpoint) return;
  clearTimeout(timer);
  timer = setTimeout(() => { flush(); }, ms);
}

async function post(body) {
  try {
    const text = JSON.stringify(body);
    const res = await fetch(endpoint, {
      method: 'POST', body: text, mode: 'cors', credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, keepalive: text.length < 60000,
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

function remove(batch) {
  const sent = new Set(batch.map((e) => e.u));
  write(read().filter((e) => !sent.has(e.u)));
}

// Sends what waits; true when nothing is left. With beacon (the page is being hidden) the browser
// takes the batch and delivers it after the page is gone.
export async function flush(beacon) {
  if (!on || sending) return false;
  const q = read();
  if (!q.length) return true;
  const batch = q.slice(0, BATCH);
  const body = { app: 'bota', id: installId(), ...info, ev: batch };
  if (beacon && navigator.sendBeacon) {
    try {
      if (navigator.sendBeacon(endpoint, new Blob([JSON.stringify(body)], { type: 'text/plain;charset=UTF-8' }))) remove(batch);
    } catch (e) { /* tried again on the next start */ }
    return false;
  }
  sending = true;
  const ok = await post(body);
  sending = false;
  if (!ok) {
    schedule(60000);
    return false;
  }
  remove(batch);
  if (read().length) {
    schedule(500);
    return false;
  }
  return true;
}

if (endpoint && typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { flush(true); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
  window.addEventListener('online', () => { flush(); });
}
