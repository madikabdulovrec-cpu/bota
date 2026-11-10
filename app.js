// Бота — MVP: conversational Kazakh for Russian speakers.
import { html, render, useState, useEffect, useLayoutEffect, useRef, useMemo, useErrorBoundary } from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js';
import { KINDS, CITIES, JOBS, HOBBIES, CHOICES, PEOPLE, PHRASES, TOPICS, LEVELS, RULES, RESCUE, PHRASEBOOK, BABY, BABY_GROUPS, BABY_AGES, BABY_GOAL, BABY_NOW, ENDEARMENTS, FACTS, HISTORY, RACE_APART } from './content.js?v=36a499f';
import * as fsrs from './fsrs.js?v=36a499f';
import * as voice from './voice.js?v=36a499f';
import * as mic from './mic.js?v=36a499f';
import * as stats from './stats.js?v=36a499f';
import { KZ_LETTERS, checkTyped, normType, plain, syllables, fillSlot } from './typing.js?v=36a499f';
import { CHECKS, BLOCK, SIZE, PLACE_ASK, PLACE_PASS, checkItems, placeItems, need, passes } from './exam.js?v=36a499f';
import { Icon, PlayGlyph, SpeakerGlyph, Sun, Logo, Bota, Avatar, Yurt, Photo, Shanyrak, Wave } from './art.js?v=36a499f';

// The version of the app: tools/site.mjs gives every module address ?v=<commit>.
const VERSION = new URL(import.meta.url).searchParams.get('v') || 'dev';

// Errors of the app go to the statistics (where they are on): the message and the place, nothing
// else; the same message at most three times a visit.
const errorsSeen = new Map();
function trackError(m, f, l) {
  const key = `${m}|${f}`;
  const n = errorsSeen.get(key) || 0;
  if (n >= 3) return;
  errorsSeen.set(key, n + 1);
  stats.track('error', { m: String(m || '').slice(0, 160), f: String(f || '').split('/').pop().split('?')[0].slice(0, 40), l: l || 0 });
}
window.addEventListener('error', (e) => trackError(e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', (e) => trackError((e.reason && e.reason.message) || e.reason, 'promise'));

/* ---------- storage: progress lives in this browser only ---------- */

const KEY = 'bota-mvp-v1';
let storageOk = true;
// The record this tab last read or wrote: a different one in storage was saved by another tab.
let lastSaved = null;

function fresh() {
  return {
    v: 1,
    profile: { name: '', mode: 'talk', minutes: 10, onboarded: false },
    done: {}, days: {}, mem: {}, rules: {}, vars: {},
    // How many memory reviews were finished on a day: each one counts as a lesson of the daily goal.
    reviews: {},
    // «Малыш»: said — phrases the parent marked as said to the baby, by day («bath.0»); prep — rituals
    // prepared in a minute, by day.
    baby: { name: '', age: '', said: {}, prep: {} },
    // «Бәйге»: the best time of every race (a topic id, or mix), how often each word was mixed up,
    // and the name of the last rival in a duel on this phone.
    race: { best: {}, miss: {}, runs: 0, rival: '' },
    // Рубежи by id (mvp/exam.js): day — first finished, pass — first passed (by: 'test' — passed by
    // the entrance test, not by an attempt), ok and of — the last attempt, best — its best share,
    // n — attempts, blocks — the last attempt by the blocks of КАЗТЕСТ ({ listen: [ok, of], … }).
    checks: {},
    // The entrance test: day — when, at — the stretch of topics (the рубеж) it started the learner at;
    // fed — how many phrases of the topics it found known went into memory on a day ({ day, n }).
    place: { day: '', at: 0, fed: { day: '', n: 0 } },
    // trAuto: translations under every line from the start; otherwise a tap on a line shows its own.
    // mic: «Скажи вслух» records the phrase with the microphone where the browser allows it.
    // stats: the learner agreed to the anonymous statistics of the pilot (stats.js).
    // typing: replies of «Ответь», phrases to put together and answers of the memory are typed, not chosen.
    settings: { voice: true, trAuto: false, mic: true, stats: false, typing: false },
    // fact: the key of the last fact of the day shown (its date this year); install: 'never' once the
    // learner turned down «Поставь Боту на экран»; persist: what the browser said to keeping storage;
    // remind: the time of the daily reminder the learner put into the phone's calendar; stats: 'asked'
    // once the learner answered about the statistics; survey3, survey14: 'done' or 'skip' for the
    // short questions of the pilot.
    // drag: the learner has moved a word of «Собери фразу» with the finger (the hint about it is gone).
    // hist: how many facts of the history of Kazakhstan were shown (the next one is HISTORY[hist]);
    // histDay: the day a start fact was last shown — one a day, from the day after getting acquainted.
    seen: { fact: '', noVoice: false, trTap: false, drag: false, hist: 0, histDay: '', install: '', persist: '', remind: '', stats: '', survey3: '', survey14: '' },
  };
}

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

// Old or damaged progress must not break the app: every field is checked, and a record that
// cannot be read is kept under another key rather than overwritten.
// The largest copy stays under KEY-broken: a fresh start after a crash, broken again, must not
// replace real progress; a smaller copy goes to KEY-broken-last.
function keepCopy(raw) {
  try {
    const old = localStorage.getItem(`${KEY}-broken`);
    localStorage.setItem(!old || raw.length >= old.length ? `${KEY}-broken` : `${KEY}-broken-last`, raw);
  } catch (e) { /* the copy is a courtesy */ }
}

function load() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    storageOk = false;
    return fresh();
  }
  lastSaved = raw;
  if (!raw) return fresh();
  let d = null;
  try { d = JSON.parse(raw); } catch (e) { /* kept below */ }
  if (!isObj(d)) {
    keepCopy(raw);
    return fresh();
  }
  return normalize(d);
}

// Every field of a record — from this browser, an older version or a file from another device —
// is checked and filled in.
function normalize(d) {
  const base = fresh();
  const obj = (x) => (isObj(x) ? x : {});
  const counts = (x) => Object.fromEntries(Object.entries(obj(x)).filter(([, n]) => Number.isFinite(n) && n > 0));
  const race = obj(d.race);
  return {
    ...base,
    profile: { ...base.profile, ...obj(d.profile) },
    done: obj(d.done), days: obj(d.days), rules: obj(d.rules), vars: obj(d.vars), reviews: counts(d.reviews),
    // A card sent further than the two months of fsrs.js (before it had that limit) comes back by then.
    mem: Object.fromEntries(Object.entries(obj(d.mem)).filter(([, c]) => isObj(c) && Number.isFinite(c.due)).map(([id, c]) => [id,
      Number.isFinite(c.last) && c.due > c.last + fsrs.MAX_DAYS * fsrs.DAY ? { ...c, due: c.last + fsrs.MAX_DAYS * fsrs.DAY } : c])),
    baby: { ...base.baby, ...obj(d.baby), said: obj(obj(d.baby).said), prep: obj(obj(d.baby).prep) },
    race: {
      best: counts(race.best), miss: counts(race.miss), runs: Number.isFinite(race.runs) ? race.runs : 0,
      rival: typeof race.rival === 'string' ? race.rival.slice(0, 24) : '',
    },
    checks: Object.fromEntries(Object.entries(obj(d.checks)).filter(([, c]) => isObj(c))),
    place: { ...base.place, ...obj(d.place) },
    settings: { ...base.settings, ...obj(d.settings) },
    seen: { ...base.seen, ...obj(d.seen) },
  };
}

function save(st) {
  try {
    const raw = JSON.stringify(st);
    localStorage.setItem(KEY, raw);
    lastSaved = raw;
    storageOk = true;
  } catch (e) {
    storageOk = false;
  }
}

// What another tab saved since this one last read or wrote, or prev when nothing changed.
function latest(prev) {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && raw !== lastSaved) return load();
  } catch (e) { /* keep this tab's state */ }
  return prev;
}

// Progress brought from a file joins the progress here and loses nothing on either side: lessons,
// days and rules add up (the earlier date stays), a memory card keeps its latest review, a race its
// best time. Name, settings and what was seen stay as they are on this device.
function mergeProgress(here, there) {
  const out = JSON.parse(JSON.stringify(here));
  const earlier = (a, b) => (!a ? b : !b || a <= b ? a : b);
  Object.entries(there.done).forEach(([id, day]) => { out.done[id] = earlier(out.done[id], day); });
  Object.entries(there.rules).forEach(([id, day]) => { out.rules[id] = earlier(out.rules[id], day); });
  Object.entries(there.days).forEach(([day, on]) => { if (on) out.days[day] = true; });
  Object.entries(there.reviews).forEach(([day, n]) => { out.reviews[day] = Math.max(out.reviews[day] || 0, n); });
  const reviewed = (c) => (Number.isFinite(c.last) ? c.last : 0);
  Object.entries(there.mem).forEach(([id, card]) => { if (!out.mem[id] || reviewed(card) > reviewed(out.mem[id])) out.mem[id] = card; });
  out.vars = { ...there.vars, ...out.vars };
  if (!out.profile.onboarded && there.profile.onboarded) out.profile = { ...there.profile };
  if (!out.baby.name && there.baby.name) Object.assign(out.baby, { name: there.baby.name, age: there.baby.age });
  Object.entries(there.baby.said).forEach(([day, said]) => { out.baby.said[day] = { ...(isObj(said) ? said : {}), ...(out.baby.said[day] || {}) }; });
  Object.entries(there.baby.prep).forEach(([day, prep]) => { out.baby.prep[day] = { ...(isObj(prep) ? prep : {}), ...(out.baby.prep[day] || {}) }; });
  Object.entries(there.race.best).forEach(([k, ms]) => { if (!out.race.best[k] || ms < out.race.best[k]) out.race.best[k] = ms; });
  Object.entries(there.race.miss).forEach(([k, n]) => { out.race.miss[k] = Math.max(out.race.miss[k] || 0, n); });
  out.race.runs = Math.max(out.race.runs, there.race.runs);
  out.race.rival = out.race.rival || there.race.rival;
  // A рубеж keeps the earlier dates, the best result and the later attempt of the two.
  Object.entries(there.checks).forEach(([id, c]) => {
    const h = out.checks[id] || {};
    const later = (h.n || 0) >= (c.n || 0) ? h : c;
    const day = earlier(h.day, c.day) || '';
    const pass = earlier(h.pass, c.pass) || '';
    out.checks[id] = { day, pass, best: Math.max(h.best || 0, c.best || 0), n: Math.max(h.n || 0, c.n || 0),
      ok: later.ok, of: later.of, blocks: later.blocks, by: pass && !day ? 'test' : '' };
  });
  if (!out.place.day || (there.place.day && there.place.day > out.place.day)) out.place = { ...there.place };
  return out;
}

// The progress in a file of «Перенести прогресс», checked, or null when it is not such a file.
async function progressFromFile(file) {
  let data = null;
  try { data = JSON.parse(await file.text()); } catch (e) { /* not JSON */ }
  return isObj(data) && data.app === 'bota' && isObj(data.progress) ? normalize(data.progress) : null;
}

// A file for the learner: in the claude.ai artifact through its downloads capability (its frame may
// not download by itself; the viewer confirms the save), elsewhere as an ordinary download.
async function saveFile(filename, text) {
  const host = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads').catch(() => null) : null;
  if (host) {
    try {
      await host.save({ filename, data: text });
      return 'saved';
    } catch (e) {
      return e && e.code === 'declined' ? 'declined' : 'failed';
    }
  }
  if (window.self !== window.top) return 'failed';
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'saved';
}

/* ---------- the site as an app on the phone ---------- */

// Only the site build carries a manifest (tools/site.mjs): there the app can be put on the home
// screen and works offline. The claude.ai artifact and the local preview have none.
const SITE_BUILD = !!document.querySelector('link[rel="manifest"]');
// The same app at its own address, where the microphone and the recorded voice work.
const SITE = 'https://madikabdulovrec-cpu.github.io/bota/';
const standalone = () => (!!window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
// Chrome on Android offers its own install dialog; it is kept for the moment the learner asks.
let installPrompt = null;
const installListeners = new Set();
const installChanged = () => installListeners.forEach((fn) => fn());
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; installChanged(); });
window.addEventListener('appinstalled', () => { installPrompt = null; installChanged(); stats.track('install'); });

function registerWorker() {
  if (!SITE_BUILD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => { /* the app works without it, just not offline */ });
}

// The steps differ: Safari on iPhone, a messenger's own browser (its storage lives apart and may be
// lost), everything else.
function installHow() {
  const ua = navigator.userAgent || '';
  if (/Telegram|Instagram|FBAN|FBAV|FB_IAB|Line\/|WhatsApp|VKClient|OKApp/i.test(ua)) return 'inapp';
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return 'other';
}
const INSTALL_STEPS = {
  inapp: {
    title: 'Открой Боту в браузере',
    steps: ['Нажми меню ⋯ в углу экрана.', 'Выбери «Открыть в браузере» — Safari или Chrome.', 'Там поставь Боту на экран «Домой».'],
    note: 'Во встроенном браузере мессенджера прогресс хранится отдельно и может пропасть.',
  },
  ios: {
    title: 'Поставь Боту на экран «Домой»',
    steps: ['Нажми «Поделиться» — квадрат со стрелкой внизу экрана.', 'Выбери «На экран „Домой“».', 'Открывай Боту с иконки, как обычное приложение.'],
    note: 'С иконки Safari не сотрёт прогресс, даже если неделю не заниматься, а уроки откроются и без интернета. Если в приложении с иконки прогресса не окажется, перенеси его файлом: «Профиль» → «Перенести прогресс».',
  },
  other: {
    title: 'Поставь Боту на экран телефона',
    steps: ['Открой меню браузера ⋮.', 'Выбери «Установить приложение» или «Добавить на главный экран».', 'Открывай Боту с иконки, как обычное приложение.'],
    note: 'Так прогресс хранится надёжнее, а уроки открываются и без интернета.',
  },
};

// Offered on the site, outside the installed app, once the learner has done something worth keeping.
const installDue = (st) => SITE_BUILD && !standalone() && st.seen.install !== 'never'
  && (Object.keys(st.done).length > 0 || Object.keys(st.baby.said || {}).length > 0 || Object.keys(st.baby.prep || {}).length > 0);

function InstallRow({ st, onOpen }) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const fn = () => redraw((n) => n + 1);
    installListeners.add(fn);
    return () => installListeners.delete(fn);
  }, []);
  if (!installDue(st)) return null;
  return html`<button type="button" class="mem-row" onClick=${onOpen}>
    <span class="mem-ic race-ic"><${Icon} name="phone" size=${22} /></span>
    <span class="grow">Поставь Боту на экран телефона — прогресс не потеряется</span>
    <${Icon} name="next" size=${18} stroke=${2.4} />
  </button>`;
}

// Chrome's own dialog when there is one; otherwise the steps for this browser.
function useInstall(update) {
  const [sheet, setSheet] = useState(false);
  const open = () => {
    if (!installPrompt) { setSheet(true); return; }
    const prompt = installPrompt;
    installPrompt = null;
    prompt.prompt();
    prompt.userChoice.then(installChanged, installChanged);
  };
  const view = sheet ? html`<${InstallSheet} onClose=${() => setSheet(false)}
    onNever=${() => { update((d) => { d.seen.install = 'never'; }); setSheet(false); }} />` : null;
  return [open, view];
}

function InstallSheet({ onClose, onNever }) {
  const how = INSTALL_STEPS[installHow()];
  const box = useRef(null);
  useSheet(box, onClose);
  return html`<div class="sheet-back" onClick=${onClose}>
    <div class="sheet pad" ref=${box} role="dialog" aria-modal="true" aria-label=${how.title} onClick=${(e) => e.stopPropagation()}>
      <span class="sheet-grip" aria-hidden="true"></span>
      <h2 class="h2" tabindex="-1">${how.title}</h2>
      <ol class="install-steps">${how.steps.map((step) => html`<li>${step}</li>`)}</ol>
      <p class="muted sm">${how.note}</p>
      <button type="button" class="btn btn-primary btn-block" onClick=${onClose}>Понятно</button>
      <span class="done-links"><button type="button" class="link-btn" onClick=${onNever}>Не напоминать</button></span>
    </div>
  </div>`;
}

/* ---------- the phone's «Назад» and the sheets ---------- */

// The page keeps one entry of the browser's history ahead of the one it was opened on: «Назад»
// returns to that entry, and the app catches it and goes one screen up (App). Not inside the
// claude.ai frame, whose history belongs to the page around it.
const OWN_HISTORY = window.self === window.top && !!window.history && typeof history.pushState === 'function';
function armBack() {
  if (!OWN_HISTORY || (history.state && history.state.bota)) return;
  try { history.pushState({ bota: 1 }, ''); } catch (e) { /* «Назад» then leaves the page, as before */ }
}

// An open sheet closes on «Назад» before any screen changes; the last one opened goes first.
const closers = [];

// A sheet is modal: it takes the focus to its title, keeps Tab inside, closes on Escape and on
// «Назад», and gives the focus back.
function useSheet(box, onClose) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const back = document.activeElement;
    const title = box.current && box.current.querySelector('h2');
    if (title) title.focus();
    const shut = () => close.current();
    const onKey = (e) => {
      if (e.key === 'Escape') shut();
      if (e.key !== 'Tab' || !box.current) return;
      const items = [...box.current.querySelectorAll('button:not([disabled]), a[href]')];
      if (!items.length) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === items[0] || active === title || !box.current.contains(active))) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && (active === items[items.length - 1] || !box.current.contains(active))) {
        e.preventDefault();
        items[0].focus();
      }
    };
    window.addEventListener('keydown', onKey);
    closers.push(shut);
    return () => {
      window.removeEventListener('keydown', onKey);
      const i = closers.indexOf(shut);
      if (i >= 0) closers.splice(i, 1);
      if (back && back.focus && document.contains(back)) back.focus();
    };
  }, []);
}

/* ---------- a daily reminder through the phone's calendar ---------- */

// No server is needed: the learner adds a daily event to the phone's calendar, and the calendar
// reminds. iPhone opens a calendar file (.ics) at once; elsewhere Google Calendar opens with the event
// filled in, and the file stays one tap away. tools/site.mjs writes a file for each of these times.
const REMIND_TIMES = ['08:00', '13:00', '19:00', '21:00'];
const REMIND_TITLE = 'Бота · казахский на каждый день';
const REMIND_TEXT = `Пара минут: разговор, повторение или фразы для малыша. Открыть Боту: ${SITE}`;
const remindFile = (time) => `./remind-${time.replace(':', '')}.ics`;
function remindGoogle(time) {
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const at = (min) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m + min);
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
  };
  const q = new URLSearchParams({ action: 'TEMPLATE', text: REMIND_TITLE, details: REMIND_TEXT, dates: `${at(0)}/${at(10)}`, recur: 'RRULE:FREQ=DAILY' });
  return `https://calendar.google.com/calendar/render?${q}`;
}

function RemindSheet({ was, onClose, onSet }) {
  const [time, setTime] = useState(was || '19:00');
  const box = useRef(null);
  useSheet(box, onClose);
  const ios = installHow() === 'ios';
  // The link must still be on the page when the browser follows it: the sheet closes a moment later.
  const chosen = (via) => {
    stats.track('remind', { time, via });
    setTimeout(() => onSet(time), 300);
  };
  const file = { href: remindFile(time), download: ios ? null : `bota-${time.replace(':', '')}.ics`, onClick: () => chosen('ics') };
  const google = { href: remindGoogle(time), target: '_blank', rel: 'noopener', onClick: () => chosen('google') };
  const [main, other] = ios ? [file, google] : [google, file];
  return html`<div class="sheet-back" onClick=${onClose}>
    <div class="sheet pad" ref=${box} role="dialog" aria-modal="true" aria-label="Напоминать каждый день" onClick=${(e) => e.stopPropagation()}>
      <span class="sheet-grip" aria-hidden="true"></span>
      <h2 class="h2" tabindex="-1">Напоминать каждый день</h2>
      <p class="muted sm">В календарь телефона добавится событие на каждый день — календарь и напомнит.${was ? ' Прежнее напоминание останется: его можно удалить в календаре.' : ''}</p>
      <div class="age-chips" role="group" aria-label="Время напоминания">${REMIND_TIMES.map((t) => html`
        <button type="button" class=${'chip-btn' + (time === t ? ' sel' : '')} aria-pressed=${time === t} onClick=${() => setTime(t)}>${t}</button>`)}</div>
      <a class="btn btn-primary btn-block" ...${main}><${Icon} name="calendar" size=${20} /> Добавить в календарь</a>
      <span class="done-links"><a class="link-btn" ...${other}>${ios ? 'Google Календарь' : 'Файл для календаря'}</a>
        <span aria-hidden="true">·</span><button type="button" class="link-btn" onClick=${onClose}>Не сейчас</button></span>
    </div>
  </div>`;
}

// Offered when the day's goal is reached, until a reminder is set; «Профиль» always has it.
function RemindRow({ st, update }) {
  const [open, setOpen] = useState(false);
  if (!SITE_BUILD || st.seen.remind) return null;
  return html`<button type="button" class="m-rule race-open" onClick=${() => setOpen(true)}>
      <${Icon} name="calendar" size=${18} /> Напоминать каждый день</button>
    ${open ? html`<${RemindSheet} onClose=${() => setOpen(false)} onSet=${(time) => { update((d) => { d.seen.remind = time; }); setOpen(false); }} />` : null}`;
}

/* ---------- the pilot: anonymous statistics, messages to the team, two short questions ---------- */

// All of it appears only where the page names an address for the statistics (stats.ready()): in the
// app by link once the pilot's server runs; never in the claude.ai artifact.
const STATS_SENT = [
  'какие уроки начаты, пройдены или брошены — и на каком шаге',
  'сколько было повторений, заездов бәйге и фраз «Малышу»',
  'получилась ли запись голоса — без самой записи',
  'ошибки приложения',
  'случайный номер установки, вид телефона и версия приложения',
];

// What the statistics send and what not; with ask — to agree or refuse.
function StatsSheet({ ask, onAnswer, onClose }) {
  const box = useRef(null);
  useSheet(box, onClose);
  return html`<div class="sheet-back" onClick=${onClose}>
    <div class="sheet pad" ref=${box} role="dialog" aria-modal="true" aria-label="Анонимная статистика" onClick=${(e) => e.stopPropagation()}>
      <span class="sheet-grip" aria-hidden="true"></span>
      <h2 class="h2" tabindex="-1">Анонимная статистика</h2>
      <p class="sm">Она показывает команде Боты, где ученикам трудно и что помогает. Отправляется:</p>
      <ul class="install-steps sm-steps">${STATS_SENT.map((x) => html`<li>${x}</li>`)}</ul>
      <p class="muted sm">Не отправляются имя, имя малыша, записи голоса и ваши ответы. Выключить можно в «Профиле».${stats.number()
        ? ` Номер этой установки — ${stats.number()}: по нему можно попросить удалить ваши данные через «Написать нам».` : ''}</p>
      ${ask ? html`<button type="button" class="btn btn-primary btn-block" onClick=${() => onAnswer(true)}>Помогать</button>
        <span class="done-links"><button type="button" class="link-btn" onClick=${() => onAnswer(false)}>Не отправлять</button></span>`
        : html`<button type="button" class="btn btn-primary btn-block" onClick=${onClose}>Понятно</button>`}
    </div>
  </div>`;
}

// Learners who met Bota before the statistics are asked once, in a row on the main screen.
function StatsRow({ st, update }) {
  const [open, setOpen] = useState(false);
  if (!stats.ready() || !st.profile.onboarded || st.seen.stats === 'asked') return null;
  const answer = (on) => {
    update((d) => { d.settings.stats = on; d.seen.stats = 'asked'; });
    setOpen(false);
  };
  return html`<button type="button" class="mem-row" onClick=${() => setOpen(true)}>
      <span class="mem-ic race-ic"><${Icon} name="chat" size=${22} /></span>
      <span class="grow">${st.profile.mode === 'baby' ? 'Помогите' : 'Помоги'} сделать Боту лучше: анонимная статистика пилота</span>
      <${Icon} name="next" size=${18} stroke=${2.4} /></button>
    ${open ? html`<${StatsSheet} ask onAnswer=${answer} onClose=${() => setOpen(false)} />` : null}`;
}

// A message to the team: an inaccurate phrase, picked from those of the lesson or the ritual, or a
// free message. It leaves only on «Отправить», without the name.
function FeedbackSheet({ phrases, where, hide, onClose }) {
  const [pick, setPick] = useState(phrases && phrases.length === 1 ? 0 : -1);
  const [text, setText] = useState('');
  const [state, setState] = useState('');
  const box = useRef(null);
  useSheet(box, onClose);
  const title = phrases ? 'Неточность во фразе' : 'Написать нам';
  const can = (phrases ? pick >= 0 : !!text.trim()) && state !== 'sending';
  const send = async () => {
    if (!can) return;
    setState('sending');
    // The learner's name in a line of the course leaves as {name}: a whole word only.
    const esc = hide ? hide.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    const name = hide ? new RegExp(`(^|[^\\p{L}])${esc}(?![\\p{L}])`, 'gu') : null;
    const phrase = phrases && pick >= 0 ? (name ? phrases[pick].replace(name, '$1{name}') : phrases[pick]) : '';
    setState(await stats.message('feedback', { where, phrase, text: text.trim().slice(0, 1000) }));
  };
  const done = state === 'sent' || state === 'queued';
  return html`<div class="sheet-back" onClick=${onClose}>
    <div class="sheet pad" ref=${box} role="dialog" aria-modal="true" aria-label=${title} onClick=${(e) => e.stopPropagation()}>
      <span class="sheet-grip" aria-hidden="true"></span>
      ${done ? html`<h2 class="h2" tabindex="-1">Спасибо!</h2>
        <p class="sm" role="status">${state === 'sent' ? 'Получили — посмотрим и поправим.' : 'Отправим, как только появится интернет.'}</p>
        <button type="button" class="btn btn-primary btn-block" onClick=${onClose}>Закрыть</button>`
      : html`<h2 class="h2" tabindex="-1">${title}</h2>
        ${phrases ? html`<span class="eyebrow">В КАКОЙ ФРАЗЕ?</span>
          <div class="opts">${phrases.map((kk, i) => html`<button type="button" class=${'opt kk' + (pick === i ? ' sel' : '')} aria-pressed=${pick === i}
            onClick=${() => setPick(i)}><span lang="kk">${kk}</span></button>`)}</div>` : null}
        <label class="sr" for="fb-text">${phrases ? 'Что не так' : 'Сообщение'}</label>
        <textarea id="fb-text" class="field area" rows="3" maxlength="1000" value=${text} onInput=${(e) => setText(e.target.value)}
          placeholder=${phrases ? 'Как правильно или что не так — по желанию' : 'Что понравилось, что мешает, чего не хватает'}></textarea>
        <span class="muted sm">Сообщение уходит без имени. Не пишите телефон и другие личные данные.</span>
        <button type="button" class="btn btn-primary btn-block" disabled=${!can} onClick=${send}>${state === 'sending' ? 'Отправляю…' : 'Отправить'}</button>
        ${state === 'failed' ? html`<span class="say-status" role="status">Не получилось отправить — проверьте интернет и попробуйте ещё раз.</span>` : null}`}
    </div>
  </div>`;
}

// «Нашли неточность во фразе?» under a lesson or a ritual: one line, the sheet on a tap.
function ReportLink({ phrases, where, hide }) {
  const [open, setOpen] = useState(false);
  if (!stats.ready() || !phrases.length) return null;
  return html`<button type="button" class="link-btn sm report-link" onClick=${() => setOpen(true)}>Нашли неточность во фразе?</button>
    ${open ? html`<${FeedbackSheet} phrases=${phrases} where=${where} hide=${hide} onClose=${() => setOpen(false)} />` : null}`;
}

// Two short questions: on the third day after the first lesson and on the fourteenth.
const SURVEY_3 = ['Нравится, буду заниматься', 'Нравится, но не хватает времени', 'Сложно', 'Не то, что мне нужно'];
function surveyDue(st) {
  if (!stats.ready() || !st.profile.onboarded) return 0;
  const first = Object.keys(st.days).sort()[0];
  if (!first) return 0;
  const [y, m, d] = first.split('-').map(Number);
  const now = new Date();
  const n = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(y, m - 1, d)) / fsrs.DAY) + 1;
  if (n >= 14) return st.seen.survey14 ? 0 : 14;
  if (n >= 3) return st.seen.survey3 ? 0 : 3;
  return 0;
}

function SurveySheet({ n, onDone, onClose }) {
  const [a, setA] = useState(-1);
  const [text, setText] = useState('');
  const [state, setState] = useState('');
  const box = useRef(null);
  useSheet(box, onClose);
  const send = async () => {
    if (a < 0 || state === 'sending') return;
    setState('sending');
    const res = await stats.message('survey', { n, a, text: text.trim().slice(0, 1000) });
    if (res === 'failed') setState('failed'); else onDone('done');
  };
  const title = n === 3 ? 'Как вам Бота?' : 'Две недели с Ботой';
  return html`<div class="sheet-back" onClick=${onClose}>
    <div class="sheet pad" ref=${box} role="dialog" aria-modal="true" aria-label=${title} onClick=${(e) => e.stopPropagation()}>
      <span class="sheet-grip" aria-hidden="true"></span>
      <h2 class="h2" tabindex="-1">${title}</h2>
      ${n === 3
        ? html`<span class="sm">Три дня позади. Как вам занятия?</span>
          <div class="opts">${SURVEY_3.map((label, i) => html`<button type="button" class=${'opt' + (a === i ? ' sel' : '')} aria-pressed=${a === i} onClick=${() => setA(i)}><span>${label}</span></button>`)}</div>`
        : html`<span class="sm">Насколько вероятно, что вы посоветуете Боту знакомым? 0 — точно нет, 10 — точно да.</span>
          <div class="scale" role="group" aria-label="Оценка от 0 до 10">${Array.from({ length: 11 }, (_, i) => html`
            <button type="button" class=${'chip-btn' + (a === i ? ' sel' : '')} aria-pressed=${a === i} onClick=${() => setA(i)}>${i}</button>`)}</div>`}
      <label class="sr" for="sv-text">Комментарий</label>
      <textarea id="sv-text" class="field area" rows="2" maxlength="1000" value=${text} onInput=${(e) => setText(e.target.value)}
        placeholder=${n === 3 ? 'Что мешает или чего не хватает — по желанию' : 'Что вы теперь можете сказать по-казахски без подсказки?'}></textarea>
      <button type="button" class="btn btn-primary btn-block" disabled=${a < 0 || state === 'sending'} onClick=${send}>Отправить</button>
      ${state === 'failed' ? html`<span class="say-status" role="status">Не получилось отправить — проверьте интернет и попробуйте ещё раз.</span>` : null}
      <span class="done-links"><button type="button" class="link-btn" onClick=${() => onDone('skip')}>Пропустить</button></span>
    </div>
  </div>`;
}

function SurveyRow({ st, update }) {
  const [open, setOpen] = useState(false);
  const n = surveyDue(st);
  if (!n) return null;
  const done = (res) => {
    update((d) => { d.seen[`survey${n}`] = res; });
    setOpen(false);
  };
  return html`<button type="button" class="mem-row" onClick=${() => setOpen(true)}>
      <span class="mem-ic race-ic"><${Icon} name="chat" size=${22} /></span>
      <span class="grow">${n === 3 ? 'Вопрос на 10 секунд: как вам Бота?' : 'Две недели с Ботой: пара вопросов'}</span>
      <${Icon} name="next" size=${18} stroke=${2.4} /></button>
    ${open ? html`<${SurveySheet} n=${n} onDone=${done} onClose=${() => setOpen(false)} />` : null}`;
}

/* ---------- dates and words ---------- */

const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const MONTHS_IN = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_UP = ['ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ', 'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'];
const DAY_W = ['день', 'дня', 'дней'];
const PHR_W = ['фраза', 'фразы', 'фраз'];
const TIME_W = ['раз', 'раза', 'раз'];
const LESSON_W = ['урок', 'урока', 'уроков'];

function plural(n, forms) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

function streakOf(days, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days[dayKey(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function weekKeys(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const out = [];
  for (let i = 0; i < 7; i++) {
    out.push(dayKey(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function whenText(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / fsrs.DAY);
  if (diff <= 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === 2) return 'послезавтра';
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const lc = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
// A title inside a sentence: «Новая тема: как пройти», but an acronym keeps its capitals («ЦОН и документы»).
const lower = (s) => (s && !/^[А-ЯЁӘҒҚҢӨҰҮҺІA-Z]{2}/.test(s) ? lc(s) : s);

/* ---------- course state ---------- */

function varsOf(st) {
  const c = CITIES.find((x) => x.id === st.vars.city) || CITIES[0];
  const j = JOBS.find((x) => x.id === st.vars.job) || JOBS[0];
  const h = HOBBIES.find((x) => x.id === st.vars.hobby) || HOBBIES[0];
  return {
    ...st.vars, city: c.id, name: st.profile.name || 'Дос',
    cityAbl: c.abl, cityAblSyl: c.ablSyl, cityFrom: c.from, cityLoc: c.loc, cityLocSyl: c.locSyl, cityIn: c.in,
    jobKk: j.kk, jobSyl: j.syl, jobRu: j.ru, hobbyKk: h.kk, hobbyRu: h.ru,
  };
}

const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));
const val = (x, v) => (typeof x === 'function' ? x(v) : x == null ? '' : fill(x, v));

// Words of «Бәйге» mixed up in a race join the memory too, as cards «w:<word>».
const WORDS = new Map(TOPICS.flatMap((t) => (t.words || []).map(([kk, ru]) => [kk, { kk, ru }])));
const wordId = (kk) => `w:${kk}`;
const isWord = (id) => id.startsWith('w:');
// Phrases of «Малыш» join the memory after a minute of preparation, as cards «b:<ritual>.<index>».
const babyId = (rid, i) => `b:${rid}.${i}`;
const isBaby = (id) => id.startsWith('b:');

function phrase(id) {
  if (isWord(id)) return WORDS.get(id.slice(2)) || null;
  if (isBaby(id)) {
    const [rid, i] = id.slice(2).split('.');
    const r = BABY.find((x) => x.id === rid);
    const it = r && r.items[Number(i)];
    return it ? { kk: it[0], ru: it[1] } : null;
  }
  if (PHRASES[id]) return PHRASES[id];
  const rescue = RESCUE.find((x) => x.id === id);
  if (rescue) return rescue;
  const m = /^pb\.([a-z])(\d)$/.exec(id);
  if (m) {
    const cat = PHRASEBOOK.find((c) => c.id === m[1]);
    const it = cat && cat.items && cat.items[Number(m[2])];
    if (it) return { kk: it[0], ru: it[1] };
  }
  return null;
}

const PLAYABLE = TOPICS.filter((t) => !t.soon);
const ALL_CONVS = PLAYABLE.flatMap((t, ti) => t.convs.map((c, ci) => ({ t, ti, c, ci })));
const levelOf = (id) => LEVELS.find((l) => l.id === id) || LEVELS[0];
const OPEN_LEVELS = LEVELS.filter((l) => !l.soon);
// B1 and B2 are the topics of these levels, not the levels yet: a lesson there asks about as much as one
// of A1 (four turns, a reply of four or five words). Their circles say «темы уровня B1» and never claim
// the level passed.
const topicsOnly = (lv) => lv.id === 'B1' || lv.id === 'B2';

// Рубежи (mvp/exam.js) stand on the way after every 3–4 topics. A рубеж passed — by an attempt or
// by the entrance test — makes its topics known: their lessons open, done or not. One taken (finished
// once, passed or not) opens the topics after it.
const TOPIC_BY_ID = new Map(PLAYABLE.map((t) => [t.id, t]));
const CP_AFTER = new Map(CHECKS.map((cp) => [cp.topics[cp.topics.length - 1], cp]));
const cpById = (id) => CHECKS.find((cp) => cp.id === id) || null;
const cpState = (st, cp) => st.checks[cp.id] || {};
const cpTaken = (st, cp) => !!(cpState(st, cp).day || cpState(st, cp).pass);
const topicKnown = (st, t) => CHECKS.some((cp) => cp.topics.includes(t.id) && cpState(st, cp).pass);
const lessonKnown = (st, x) => !!st.done[x.c.id] || topicKnown(st, x.t);
const topicDone = (st, t) => t.convs.filter((c) => st.done[c.id]).length;
// A topic behind: every lesson done, or known.
const topicFull = (st, t) => topicKnown(st, t) || topicDone(st, t) === t.convs.length;

// The phrases of the topics the entrance test found known join the memory five a day, in the order of
// the course, from the day after the test: the test asked a few questions of each stretch, the memory
// asks every phrase. Only lessons not done — a lesson done put its phrases there itself.
const FEED_N = 5;
function knownToFeed(st) {
  const out = [];
  PLAYABLE.filter((t) => topicKnown(st, t)).forEach((t) => t.convs.filter((c) => !st.done[c.id])
    .forEach((c) => (c.teaches || []).forEach((id) => { if (!st.mem[id] && phrase(id) && !out.includes(id)) out.push(id); })));
  return out;
}
const fedToday = (st) => (isObj(st.place.fed) && st.place.fed.day === dayKey() && Number.isFinite(st.place.fed.n) ? st.place.fed.n : 0);
const feedDue = (st) => !!st.place.day && st.place.day < dayKey() && fedToday(st) < FEED_N && knownToFeed(st).length > 0;
// A рубеж can be taken once every topic before it is behind.
const cpOpen = (st, cp) => cp.topics.every((id) => topicFull(st, TOPIC_BY_ID.get(id)));

// A topic the way of the course has reached: the first of its level, a known one, or one whose
// previous topic is behind (and the рубеж after it taken). Topics are reached one after another.
function reached(st, ti) {
  const idx = ALL_CONVS.findIndex((x) => x.ti === ti && x.ci === 0);
  const cur = ALL_CONVS[idx];
  if (idx <= 0 || topicKnown(st, cur.t)) return true;
  const prev = ALL_CONVS[idx - 1];
  if (prev.t.level !== cur.t.level) return true;
  if (!lessonKnown(st, prev)) return false;
  const cp = CP_AFTER.get(prev.t.id);
  return !cp || cpTaken(st, cp);
}

// Lessons of a topic open one after another. The first two lessons of every topic are open at any
// time (flexible entry: the doctor tomorrow, the bank today), «Скажи голосом» after them; the rest
// of a topic — «без подсказок», pronunciation, writing — waits until the way of the course reaches
// the topic: they ask for words of the topics before it. Lessons already done stay open.
function convOpen(st, ti, ci) {
  const idx = ALL_CONVS.findIndex((x) => x.ti === ti && x.ci === ci);
  const cur = ALL_CONVS[idx];
  if (idx <= 0 || st.done[cur.c.id] || topicKnown(st, cur.t) || ci < 2) return true;
  // Every lesson before it in the topic is behind: «Скажи голосом» comes after «Послушай» and «Ответь».
  if (!ALL_CONVS.slice(idx - ci, idx).every((x) => lessonKnown(st, x))) return false;
  return ci === 2 || reached(st, ti);
}

const isSkill = (c) => c.kind === 'pron' || c.kind === 'write';

// The way through the course: the lessons, and a рубеж after the last lesson of its last topic
// ({ cp, t } — t is that topic, for its level).
const PATH = ALL_CONVS.flatMap((x) => (x.ci === x.t.convs.length - 1 && CP_AFTER.has(x.t.id) ? [x, { cp: CP_AFTER.get(x.t.id), t: x.t }] : [x]));
const stepBehind = (st, x) => (x.cp ? cpTaken(st, x.cp) : lessonKnown(st, x));
// On the way: a lesson done somewhere ahead, by the flexible entry, does not move the way on.
const onWay = (st, x) => (x.cp ? cpTaken(st, x.cp) : lessonKnown(st, x) && reached(st, x.ti));

// The circle the learner goes through now: the first one whose итог круга is not taken yet. The first
// topic of every circle is open (the phrasebook leads to «Работа» of B1): a lesson there does not move
// the learner into that circle.
const FINALS = CHECKS.filter((cp) => cp.final);
const curLevel = (st) => (FINALS.find((cp) => !cpTaken(st, cp)) || {}).level || '';

// The step after the furthest one on the way — a lesson or a рубеж, in one level, or else in the
// circle the learner goes through now (the whole course once every итог is taken); lessons done ahead
// are passed over, steps left behind come after the end.
function nextUp(st, level) {
  const lv = level || curLevel(st);
  const list = lv ? PATH.filter((x) => x.t.level === lv) : PATH;
  let last = -1;
  list.forEach((x, i) => { if (onWay(st, x)) last = i; });
  return list.slice(last + 1).find((x) => !stepBehind(st, x)) || list.find((x) => !stepBehind(st, x)) || null;
}

// Where a step leads: a lesson or a рубеж.
const goStep = (go, nx) => (nx.cp ? go('test', { id: nx.cp.id }) : go('conv', { ti: nx.ti, ci: nx.ci }));
// «Дальше: …» after a lesson or a test, from the topic ti.
function stepLabel(nx, ti) {
  if (!nx) return 'Вернуться в «Мой круг»';
  if (nx.cp) return nx.cp.final ? 'Дальше: итог круга' : 'Дальше: рубеж';
  return nx.ti === ti ? `Дальше: ${KINDS[nx.c.kind].label.toLowerCase()}` : `Новая тема: ${lower(nx.t.title)}`;
}
const TOPIC_W = ['тема', 'темы', 'тем'];
const Q_W = ['вопрос', 'вопроса', 'вопросов'];
const cpSize = (cp) => SIZE[cp.final ? 'final' : 'check'];
const listNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}` : names[0] || '');
const cpPeople = (cp) => listNames(cp.topics.map((id) => PEOPLE[TOPIC_BY_ID.get(id).who].name));
// «Рубеж после четырёх тем», «Итог круга «Близкие»».
const cpTitle = (cp) => (cp.final ? `Итог круга «${levelOf(cp.level).title}»` : `Рубеж после ${cp.topics.length === 3 ? 'трёх' : 'четырёх'} тем`);

// A card is due on its calendar day: «повторим завтра» means any time tomorrow, not the same hour.
const dueByDay = (card, now) => !!card && dayKey(new Date(card.due)) <= dayKey(new Date(now));

function dueList(st, now = Date.now()) {
  return Object.keys(st.mem)
    .filter((id) => phrase(id) && dueByDay(st.mem[id], now))
    .sort((a, b) => st.mem[a].due - st.mem[b].due);
}

function nextDue(st) {
  const all = Object.values(st.mem).map((c) => c.due);
  return all.length ? Math.min(...all) : null;
}

const WORD_W = ['слово', 'слова', 'слов'];
// «5 фраз», «3 фразы и 2 слова»: what a list of memory cards holds; acc — after «освежили».
function cardsText(ids, acc) {
  const words = ids.filter(isWord).length;
  const phrases = ids.length - words;
  const phr = acc ? ['фразу', 'фразы', 'фраз'] : PHR_W;
  return [phrases ? `${phrases} ${plural(phrases, phr)}` : '', words ? `${words} ${plural(words, WORD_W)}` : ''].filter(Boolean).join(' и ');
}
// The verb after cardsText(): «1 фраза ждёт», «21 фраза ждёт», «3 фразы и 2 слова ждут».
function agree(ids, one, many) {
  const words = ids.filter(isWord).length;
  if (words && words < ids.length) return many;
  return plural(ids.length, [one, many, many]);
}

// The fact of today or of the past week; key tells one showing of it from another.
function factFor(now = new Date()) {
  for (let back = 0; back < 7; back++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const f = FACTS[`${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`];
    if (f) return { ...f, key: dayKey(d), today: back === 0 };
  }
  return null;
}

// What the first start of a day opens with: a fact of this date or week (once), or else the next fact
// of the history of Kazakhstan — in order, from the Saka on, one a day, and round again after the last.
function startFact(st, now = new Date()) {
  const dated = factFor(now);
  if (dated && st.seen.fact !== dated.key) return dated;
  if (!HISTORY.length || st.seen.histDay === dayKey(now)) return null;
  const i = Math.max(0, Math.floor(Number(st.seen.hist) || 0)) % HISTORY.length;
  return { ...HISTORY[i], hist: i };
}

/* ---------- small shared pieces ---------- */

function SpeakBtn({ text, small, label = 'Прослушать' }) {
  if (!voice.canSay(text)) return null;
  return html`<button type="button" class=${small ? 'say-btn sm' : 'say-btn'} aria-label=${label}
    onClick=${(e) => { e.stopPropagation(); voice.speak(text); }}><${SpeakerGlyph} size=${small ? 14 : 16} /></button>`;
}

// «Малыш» is a tab for parents; for everyone else it is a row in the phrasebook.
function TabBar({ tab, go, st }) {
  const baby = st.profile.mode === 'baby' ? [['baby', 'Малыш', 'heart']] : [];
  const items = [['home', 'Мой круг', 'circle'], ['phrasebook', 'Разговорник', 'chat'], ...baby, ['profile', 'Профиль', 'user']];
  return html`<nav class="tabbar pad" aria-label="Разделы">
    ${items.map(([id, label, icon]) => html`
      <button type="button" class=${'tab' + (tab === id ? ' on' : '')} aria-current=${tab === id ? 'page' : null} onClick=${() => go(id)}>
        <${Icon} name=${icon} size=${22} stroke=${tab === id ? 2.3 : 2} /><span>${label}</span>
      </button>`)}
  </nav>`;
}

function TopBar({ title, sub, subLang, onBack, backLabel, right }) {
  return html`<header class="topbar pad">
    ${onBack ? html`<button type="button" class="icon-btn" aria-label=${backLabel || 'Назад'} onClick=${onBack}><${Icon} name="back" size=${24} stroke=${2.2} /></button>` : null}
    <span class="topbar-title"><b>${title}</b>${sub ? html`<span class="muted sm" lang=${subLang || null}>${sub}</span>` : null}</span>
    ${right || null}
  </header>`;
}

// The streak on the main screen: the month's шаңырақ in small — a уық for every day of practice — and
// the days in a row. A tap opens it large in «Профиль».
function ShanyrakChip({ st, go }) {
  const n = streakOf(st.days);
  const now = new Date();
  return html`<button type="button" class="streak" aria-label=${`${n > 0 ? `Серия: ${n} ${plural(n, DAY_W)} подряд. ` : ''}Шаңырақ месяца — в профиле`} onClick=${() => go('profile')}>
    <${Shanyrak} year=${now.getFullYear()} month=${now.getMonth()} days=${st.days} today=${now.getDate()} size=${26} mini />
    ${n > 0 ? `${n} ${plural(n, DAY_W)}` : 'начни серию'}</button>`;
}

/* ---------- 00 · fact of the day ---------- */

// The sources of a history fact on the card: the first two by name, without links (all of them, with
// links, are in content.js and docs/history-facts.md).
function shortSources(src) {
  const all = String(src).split(';').map((s) => s.replace(/\s*\(https?:[^)]*\)/g, '').trim()).filter(Boolean);
  return all.slice(0, 2).join('; ') + (all.length > 2 ? ` и ещё ${all.length - 2}` : '');
}

// A fact of a date («В этот день в истории») or of the history of Kazakhstan, one a day in order: its
// time and title, a few lines, a Kazakh word from it, the sources; the next one is promised for tomorrow.
function Splash({ fact, onNext }) {
  if (!fact) return null;
  const hist = fact.hist !== undefined;
  const next = hist ? HISTORY[(fact.hist + 1) % HISTORY.length] : null;
  return html`<main class="screen splash">
    <div class="scroll pad splash-in">
      <div class="brand"><${Logo} size=${28} /><span>Бота</span></div>
      <article class="fact-card">
        <span class="eyebrow">${hist ? `ИСТОРИЯ КАЗАХСТАНА · ${fact.hist + 1} ИЗ ${HISTORY.length}` : fact.today ? 'В ЭТОТ ДЕНЬ В ИСТОРИИ' : 'НА ЭТОЙ НЕДЕЛЕ В ИСТОРИИ'}</span>
        <span class="eyebrow-kk" lang="kk">${hist ? 'Қазақстан тарихы' : fact.today ? 'бұл күні тарихта' : 'осы аптада тарихта'}</span>
        ${hist ? html`<div class="fact-date hist"><span class="d">${fact.title}</span><span class="y">${fact.era}</span></div>`
          : html`<div class="fact-date"><span class="d">${fact.date}</span><span class="y">${fact.year}</span></div>`}
        ${fact.kk ? html`<p class="fact-kk" lang="kk">${fact.kk} <${SpeakBtn} text=${fact.kk} small /></p>` : null}
        <p class="fact-ru">${fact.ru}</p>
        ${fact.place ? html`<div class="fact-meta"><span class="chip">Где: ${fact.place}</span></div>` : null}
        <div class="fact-word"><span class="muted sm">слово из факта</span>
          <span><b lang="kk">${fact.word}</b> — ${fact.wordRu} <${SpeakBtn} text=${fact.word} small /></span></div>
        <span class="fact-src">${hist ? `Источники: ${shortSources(fact.source)}` : `Источник: ${fact.source}`}</span>
      </article>
      ${next && next !== HISTORY[0] ? html`<span class="fact-next">Завтра: ${next.title}</span>` : null}
    </div>
    <div class="bottom pad on-night"><button type="button" class="btn btn-light btn-block" onClick=${onNext}>Продолжить</button></div>
  </main>`;
}

/* ---------- 00 · welcome: the very first start ---------- */

// Bota meets a newcomer the way Kazakhs meet a guest — «Қош келдіңіз!» — and leads on to getting
// acquainted. Someone who practised elsewhere brings the progress from a file: an app put on the home
// screen of an iPhone starts with storage of its own, empty.
function Welcome({ st, update, onNext, onLoaded }) {
  const fileInput = useRef(null);
  const [note, setNote] = useState('');
  const hello = PHRASES.qosh;
  const load = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const there = await progressFromFile(file);
    if (!there) {
      setNote('Это не файл прогресса Боты. Его сохраняют в «Профиле» → «Перенести прогресс».');
      return;
    }
    const merged = mergeProgress(latest(st), there);
    update((d) => {
      const next = mergeProgress(d, there);
      Object.keys(d).forEach((k) => delete d[k]);
      Object.assign(d, next);
    });
    onLoaded(merged);
  };
  return html`<main class="screen splash welcome">
    <div class="scroll pad welcome-in">
      <div class="brand"><${Logo} size=${28} /><span>Бота</span></div>
      <div class="welcome-main">
        <div class="welcome-hero" aria-hidden="true">
          <svg class="welcome-yurt" viewBox="0 0 80 52"><${Yurt} /></svg>
          <${Bota} size=${84} />
        </div>
        <div class="welcome-hello">
          <span class="hello" lang="kk">${hello.kk} <${SpeakBtn} text=${hello.kk} small /></span>
          <span class="welcome-tr">${hello.ru}</span>
        </div>
        <p class="welcome-text">Так казахи встречают гостя — и сразу зовут на <b lang="kk">төр</b>, почётное место в юрте. Здесь тебя ждёт твой круг: семья, соседи, коллеги. С каждым ты заговоришь по-казахски — по 1–2 минуты в день.</p>
      </div>
    </div>
    <div class="bottom pad on-night welcome-bottom">
      <button type="button" class="btn btn-light btn-block" onClick=${onNext}>Познакомиться с Ботой</button>
      <button type="button" class="link-btn on-night" onClick=${() => fileInput.current && fileInput.current.click()}>Уже занимались? Загрузить прогресс из файла</button>
      <input type="file" accept="application/json,.json" hidden ref=${fileInput} onChange=${load} />
      ${note ? html`<span class="welcome-note" role="status">${note}</span>` : null}
    </div>
  </main>`;
}

/* ---------- 01–02 · onboarding as a chat with Bota ---------- */

function BotaSays({ children }) {
  return html`<div class="m-row left"><${Bota} size=${32} /><div class="b b-bota">${children}</div></div>`;
}

function Onboard({ st, update, done }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(st.profile.name || '');
  const [mode, setMode] = useState(st.profile.mode || 'talk');
  // Someone who knows some Kazakh already takes the entrance test instead of the first conversation.
  const [start, setStart] = useState('zero');
  const [minutes, setMinutes] = useState(st.profile.minutes || 10);
  // The pilot's anonymous statistics: asked on the first step, so that the rest of the way is seen too.
  const [share, setShare] = useState(true);
  const [statsInfo, setStatsInfo] = useState(false);
  const scroller = useRef(null);
  const lastTap = useRef(0);
  const clean = cap(name.trim().replace(/\s+/g, ' ').slice(0, 24));

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [step]);

  // A double tap on «Дальше» must not also press the button that takes its place.
  const settled = () => {
    if (Date.now() - lastTap.current < 350) return false;
    lastTap.current = Date.now();
    return true;
  };
  const toStep = (n) => { if (settled()) setStep(n); };

  const test = mode === 'talk' && start === 'some';
  const finish = () => {
    if (!settled()) return;
    // The history of Kazakhstan on the start screen begins the next day: today belongs to getting acquainted.
    update((d) => { d.profile = { ...d.profile, name: clean, mode, minutes, onboarded: true }; d.seen.histDay = dayKey(); });
    stats.track('onboard', { mode, minutes, start: mode === 'talk' ? start : '' });
    done(mode, test);
  };
  const nameDone = () => {
    if (!clean) return;
    if (stats.ready()) {
      update((d) => { d.settings.stats = share; d.seen.stats = 'asked'; });
      stats.setConsent(share);
      stats.track('onboard_name');
    }
    toStep(1);
  };

  const modes = [
    ['talk', 'Говорить по-казахски', 'с соседями, на работе, в городе'],
    ['baby', 'Говорить с малышом', 'фразы на каждый день для родителей'],
  ];
  const starts = [
    ['zero', 'Начинаю с нуля', 'начнём с приветствий'],
    ['some', 'Немного знаю', 'проверим уровень, до 7 минут'],
  ];

  // Russian is the only language of explanations so far: there is nothing to choose yet, and Bota
  // just says it. English and Chinese will bring the choice back as the first step.
  let panel;
  if (step === 0) {
    panel = html`<form class="panel-in" onSubmit=${(e) => { e.preventDefault(); nameDone(); }}>
      <label class="field-label" for="ob-name">Твоё имя</label>
      <input id="ob-name" class="field" type="text" autocomplete="given-name" maxlength="24" placeholder="Например, Мадияр"
        value=${name} onInput=${(e) => setName(e.target.value)} />
      ${stats.ready() ? html`<div class="consent">
        <label><input type="checkbox" checked=${share} onChange=${(e) => setShare(e.target.checked)} /> Анонимная статистика — без имени и голоса</label>
        <button type="button" class="link-btn sm" onClick=${() => setStatsInfo(true)}>Что это?</button></div>` : null}
      <button type="submit" class="btn btn-primary btn-block" disabled=${!clean}>Дальше</button>
    </form>`;
  } else if (step === 1) {
    panel = html`<div class="panel-in">
      <div class="opts">${modes.map(([id, title, sub]) => html`
        <button type="button" class=${'opt mode' + (mode === id ? ' sel' : '')} aria-pressed=${mode === id} onClick=${() => setMode(id)}>
          <span>${title}</span><small>${sub}</small></button>`)}</div>
      <button type="button" class="btn btn-primary btn-block" onClick=${() => { stats.track('onboard_mode', { mode }); if (mode === 'talk') toStep(2); else finish(); }}>Дальше</button>
    </div>`;
  } else if (step === 2) {
    panel = html`<div class="panel-in">
      <div class="opts">${starts.map(([id, title, sub]) => html`
        <button type="button" class=${'opt mode' + (start === id ? ' sel' : '')} aria-pressed=${start === id} onClick=${() => setStart(id)}>
          <span>${title}</span><small>${sub}</small></button>`)}</div>
      <button type="button" class="btn btn-primary btn-block" onClick=${() => toStep(3)}>Дальше</button>
    </div>`;
  } else {
    panel = html`<div class="panel-in">
      <div class="minutes">${[5, 10, 15].map((m) => html`
        <button type="button" class=${'min' + (minutes === m ? ' sel' : '')} aria-pressed=${minutes === m} onClick=${() => setMinutes(m)}>
          <b>${m}</b><span>минут</span></button>`)}</div>
      <span class="muted sm center">Это примерно ${minutes === 5 ? 'три урока' : minutes === 10 ? 'шесть уроков' : 'девять уроков'} в день</span>
      <button type="button" class="btn btn-primary btn-block" onClick=${finish}>${test ? 'Проверить уровень' : 'Начать'}</button>
    </div>`;
  }

  return html`<main class="screen">
    <header class="topbar pad"><span class="brand dark"><${Logo} size=${26} /><span>Бота</span></span></header>
    <div class="scroll chat pad" ref=${scroller}>
      <div class="msgs">
        <div class="ob-hello"><span class="hello" lang="kk">Сәлем!</span><span class="muted">Привет · Hello · 你好</span></div>
        <${BotaSays}><span class="kk" lang="kk">Мен Ботамын.</span><span class="b-tr">Я — Бота. Помогу заговорить по-казахски: через разговоры с людьми, без зубрёжки правил.</span><//>
        <${BotaSays}>Объясняю по-русски, а говорить будем по-казахски. Как тебя зовут?<//>
        ${step > 0 ? html`
          <div class="b b-me">${clean}</div>
          <${BotaSays}><span class="kk" lang="kk">Танысқаныма қуаныштымын, ${clean}!</span><span class="b-tr">Это «рад знакомству». Что хочешь уметь?</span><//>` : null}
        ${step > 1 ? html`<div class="b b-me">${modes.find((m) => m[0] === mode)[1]}</div>` : null}
        ${step > 1 && mode === 'talk' ? html`<${BotaSays}>Ты уже знаешь казахский?<//>` : null}
        ${step > 2 && mode === 'talk' ? html`<div class="b b-me">${starts.find((m) => m[0] === start)[1]}</div>` : null}
        ${step > 2 ? html`<${BotaSays}>${test ? 'Тогда после знакомства — короткий тест, чтобы начать с подходящей темы. ' : ''}Сколько минут в день будем заниматься?<//>` : null}
      </div>
    </div>
    <div class="composer pad">${panel}</div>
    ${statsInfo ? html`<${StatsSheet} onClose=${() => setStatsInfo(false)} />` : null}
  </main>`;
}

/* ---------- 03 · «Мой круг» ---------- */

// Twelve people of level A1 sit around the yurt like hours on a clock, the first one at the top.
const RING_R = 118;
const slotXY = (i, n) => {
  const a = ((-90 + (i * 360) / n) * Math.PI) / 180;
  return [171 + RING_R * Math.cos(a), 171 + RING_R * Math.sin(a)];
};

function AvatarRing({ who, size, status, frac }) {
  const half = size / 2;
  const r = half - 2;
  const c = 2 * Math.PI * r;
  const badge = {
    done: html`<span class="av-badge done"><${Icon} name="check" size=${11} stroke=${4} /></span>`,
    cur: html`<span class="av-badge cur"><${PlayGlyph} size=${10} /></span>`,
  }[status];
  return html`<span class=${'av av-' + status} style=${`width:${size}px;height:${size}px`}>
    <svg class="av-ring" width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx=${half} cy=${half} r=${r} class="track"></circle>
      ${status === 'cur' ? html`<circle cx=${half} cy=${half} r=${r} class="arc"
        stroke-dasharray=${`${(c * Math.max(frac, 0.05)).toFixed(1)} ${c.toFixed(1)}`} transform=${`rotate(-90 ${half} ${half})`}></circle>` : null}
    </svg>
    <span class="av-face"><${Avatar} who=${who} size=${size - 10} /></span>
    ${badge || null}
  </span>`;
}

const levelFrac = (st, level) => {
  const list = ALL_CONVS.filter((x) => x.t.level === level);
  return list.filter((x) => lessonKnown(st, x)).length / list.length;
};

// A рубеж on the map: a small gold rhombus just outside the ring, between the people it comes
// between (the итог — between the last person and the first). Grey until it can be taken, gold
// once it can, dashed once taken but not passed, filled once passed.
const CP_R = 144;
const cpXY = (i, n, r = CP_R) => {
  const a = ((-90 + (i * 360) / n) * Math.PI) / 180;
  return [171 + r * Math.cos(a), 171 + r * Math.sin(a)];
};
function cpStatus(st, cp, nx) {
  const c = cpState(st, cp);
  if (c.pass) return 'pass';
  if (nx && nx.cp === cp) return 'cur';
  if (c.day) return 'taken';
  return cpOpen(st, cp) ? 'open' : 'locked';
}
// How a рубеж stands, in a few words: for the map and the topic screen.
function cpNote(st, cp, status) {
  const c = cpState(st, cp);
  const last = TOPIC_BY_ID.get(cp.topics[cp.topics.length - 1]);
  // A рубеж taken stays taken: its best attempt, not a weaker try after it; one taken by the entrance
  // test and never passed by an attempt says so.
  if (status === 'pass') {
    const best = c.of ? Math.round(Math.max(c.best || 0, c.ok / c.of) * c.of) : 0;
    return c.of && passes(best, c.of) ? `взят: ${best} из ${c.of}` : 'взят по входному тесту';
  }
  if (status === 'taken') return `${c.ok} из ${c.of} — возьмёшь от ${need(c.of)}, можно ещё раз`;
  if (status === 'locked') return `после темы «${last.title}»: ${cpSize(cp)} ${plural(cpSize(cp), Q_W)} без перевода`;
  return `${cpSize(cp)} ${plural(cpSize(cp), Q_W)} без перевода${cp.final ? ' по всем темам круга' : ''}`;
}

// One circle at a time: the people of the chosen level around the yurt. Earlier levels fold
// into thin gold rings right around the yurt, the next level waits on the outer dashed ring: its
// name runs along that ring, so that it does not read as the name of the person at the top.
function CircleMap({ st, go, level, onList }) {
  const lv = levelOf(level);
  const items = PLAYABLE.map((t, ti) => ({ t, ti })).filter((x) => x.t.level === level);
  const nx = nextUp(st, level);
  const doneTopics = items.filter(({ t }) => topicFull(st, t)).length;
  const circ = 2 * Math.PI * RING_R;
  const frac = levelFrac(st, level);
  const after = LEVELS[LEVELS.indexOf(lv) + 1];
  const before = LEVELS.slice(0, LEVELS.indexOf(lv));
  const gates = CHECKS.filter((cp) => cp.level === level).map((cp) => {
    const at = items.findIndex(({ t }) => t.id === cp.topics[cp.topics.length - 1]) + 0.5;
    return { cp, at, status: cpStatus(st, cp, nx) };
  });
  return html`<div class="map">
    <svg class="map-svg" viewBox="0 0 342 342" aria-hidden="true">
      <circle cx="171" cy="171" r="160" class="ring2"></circle>
      <circle cx="171" cy="171" r=${RING_R} class="ring1"></circle>
      ${frac > 0 ? html`<circle cx="171" cy="171" r=${RING_R} class="ring1-done"
        stroke-dasharray=${`${(circ * frac).toFixed(1)} ${circ.toFixed(1)}`} transform="rotate(-90 171 171)"></circle>` : null}
      ${gates.map(({ at, status }) => {
        const [x1, y1] = cpXY(at, items.length, RING_R + 3);
        const [x2, y2] = cpXY(at, items.length, CP_R - 11);
        return html`<line x1=${x1.toFixed(1)} y1=${y1.toFixed(1)} x2=${x2.toFixed(1)} y2=${y2.toFixed(1)} class=${'cp-tick' + (status === 'locked' ? '' : ' on')}></line>`;
      })}
      ${before.map((l, i) => {
        const r = 72 + i * 7;
        const len = 2 * Math.PI * r;
        const f = levelFrac(st, l.id);
        return html`<circle cx="171" cy="171" r=${r} class="ring0"></circle>
          ${f > 0 ? html`<circle cx="171" cy="171" r=${r} class="ring0-done"
            stroke-dasharray=${`${(len * f).toFixed(1)} ${len.toFixed(1)}`} transform="rotate(-90 171 171)"></circle>` : null}`;
      })}
      <g transform="translate(119 112) scale(1.3)"><${Yurt} /></g>
      ${after ? html`<path id="ring2-top" d="M 9.5 171 A 161.5 161.5 0 0 1 332.5 171" fill="none"></path>
        <text class="ring-name" text-anchor="middle"><textPath href="#ring2-top" startOffset="50%">${`${after.title} · ${after.id}${after.soon ? ' · скоро' : ''}`.toUpperCase()}</textPath></text>` : null}
    </svg>
    <button type="button" class="map-center" aria-label=${`Все темы круга «${lv.title}» списком: пройдено ${doneTopics} из ${items.length}`} onClick=${onList}>
      <b>${lv.title.toLowerCase()}${topicsOnly(lv) ? null : html`<i class="lv-tag">${` · ${lv.id}`}</i>`}</b>
      <span>${doneTopics} из ${items.length} тем${topicsOnly(lv) ? html`<i class="lv-tag">${` уровня ${lv.id}`}</i>` : null} <${Icon} name="next" size=${11} stroke=${3} /></span></button>
    ${items.map(({ t, ti }, i) => {
      const n = topicDone(st, t);
      const isCur = !!nx && nx.ti === ti;
      const known = topicKnown(st, t) && n < t.convs.length;
      // A topic the way has not reached is drawn lighter, with a dashed ring: its first two lessons are
      // open already (flexible entry), the rest when the way comes there.
      const status = n === t.convs.length || (known && !isCur) ? 'done' : isCur ? 'cur' : reached(st, ti) ? 'open' : 'locked';
      const [x, y] = slotXY(i, items.length);
      const size = isCur ? 56 : 40;
      // The current person's name is on the card below the map, so the map carries no labels.
      return html`<button type="button" class=${'av-btn' + (isCur ? ' cur' : '')}
        style=${`left:${((x / 342) * 100).toFixed(2)}%;top:${((y / 342) * 100).toFixed(2)}%;--half:${size / 2}px`}
        aria-label=${`${PEOPLE[t.who].name}: ${t.title}, ${status === 'locked' ? (n ? `впереди, ${n} из ${t.convs.length}` : 'впереди, первые уроки открыты') : known ? 'знакомая тема' : `${n} из ${t.convs.length}`}`} onClick=${() => go('topic', { ti })}>
        <${AvatarRing} who=${t.who} size=${size} status=${status} frac=${n / t.convs.length} />
      </button>`;
    })}
    ${gates.map(({ cp, at, status }) => {
      const [x, y] = cpXY(at, items.length);
      return html`<button type="button" class=${`cp-btn ${status}${cp.final ? ' final' : ''}`} disabled=${status === 'locked'}
        style=${`left:${((x / 342) * 100).toFixed(2)}%;top:${((y / 342) * 100).toFixed(2)}%`}
        aria-label=${`${cp.final ? 'Итог круга' : 'Рубеж'}: ${cpNote(st, cp, status)}`} onClick=${() => go('test', { id: cp.id })}>
        <span class="cp-mark">${status === 'pass' ? html`<${Icon} name="check" size=${10} stroke=${4} />` : null}</span>
      </button>`;
    })}
  </div>`;
}

function NextCard({ st, go, level, setLevel }) {
  const nx = nextUp(st, level);
  if (!nx) {
    const lv = levelOf(level);
    const after = LEVELS[LEVELS.indexOf(lv) + 1];
    const count = PLAYABLE.filter((t) => t.level === level).length;
    const open = after && !after.soon;
    // Every step is behind, but the итог круга is not passed yet: the circle closes with it.
    const fin = CHECKS.find((cp) => cp.level === level && cp.final);
    const fs = fin ? cpState(st, fin) : {};
    if (fin && !fs.pass) {
      return html`<section class="card next">
        <span class="muted sm">${lv.id} · итог круга: ${fs.ok} из ${fs.of}</span>
        <b class="h3">Круг закроется от ${need(fs.of)} из ${fs.of}. Освежи фразы — и попробуй ещё раз</b>
        <button type="button" class="btn btn-primary btn-block" onClick=${() => go('test', { id: fin.id })}><${Icon} name="gate" size=${20} /> Пройти итог ещё раз</button>
        <${LinkRow} items=${[dueList(st).length && ['Освежить память', () => go('review')], open && [`Круг «${after.title}»`, () => setLevel(after.id)]]} />
      </section>`;
    }
    return html`<section class="card next">
      <span class="muted sm">${topicsOnly(lv) ? `темы уровня ${lv.id} · итог круга взят` : `${lv.id} · все ${count} тем пройдены`}</span>
      <b class="h3">${topicsOnly(lv) ? `Все ${count} тем круга «${lv.title}» пройдены!` : `Круг ${lv.of} пройден!`}${after ? ` Следующий круг — ${after.title.toLowerCase()}, ${topicsOnly(after) ? `темы ${after.id}` : after.id}${open ? '' : ' — готовится'}` : ''}</b>
      ${open ? html`<button type="button" class="btn btn-primary btn-block" onClick=${() => setLevel(after.id)}>Перейти в круг «${after.title}»</button>`
        : html`<button type="button" class="btn btn-primary btn-block" onClick=${() => go('review')}>Освежить память</button>`}
    </section>`;
  }
  const first = Object.keys(st.done).length === 0;
  const step = () => goStep(go, nx);
  const cp = nx.cp;
  if (memLeads(st)) {
    const due = dueList(st);
    // Not the first review today: more waits than one review takes.
    const more = !!st.reviews[dayKey()];
    return html`<section class="card next">
      <span class="muted sm">сначала — память, потом ${cp ? (cp.final ? 'итог круга' : 'рубеж') : isSkill(nx.c) ? 'урок' : 'разговор'}</span>
      <b class="h3">${more ? 'Ещё ' : ''}${cardsText(due)} ${agree(due, 'ждёт', 'ждут')} повторения</b>
      <button type="button" class="btn btn-primary btn-block" onClick=${() => go('review')}><${Icon} name="ornament" size=${20} /> ${more ? `Освежить ещё ${REVIEW_N}` : 'Освежить память'}</button>
      <${LinkRow} items=${[[skipLabel(nx), step]]} />
    </section>`;
  }
  if (cp) {
    return html`<section class="card next">
      <span class="muted sm">${cp.final ? `итог круга · ${cpSize(cp)} ${plural(cpSize(cp), Q_W)} по всем темам` : `рубеж · ${cp.topics.length} ${plural(cp.topics.length, TOPIC_W)} позади`}</span>
      <b class="h3">${cp.final ? 'Слушать, читать, писать и говорить — как в блоках КАЗТЕСТ' : `${cpPeople(cp)} спросят, что запомнилось`}</b>
      <button type="button" class="btn btn-primary btn-block" onClick=${step}><${Icon} name="gate" size=${20} /> ${cp.final ? 'Начать итог круга' : 'Начать рубеж'}</button>
    </section>`;
  }
  const kind = nx.c.kind;
  // A newcomer who knows some Kazakh already can start further on.
  const placeLink = first && !st.place.day ? [['Уже знаю основы — проверить уровень', () => go('test', { id: 'place' })]] : [];
  return html`<section class="card next">
    <span class="muted sm">${lower(nx.t.title)} · урок ${nx.ci + 1} из ${nx.t.convs.length}</span>
    <b class="h3">${nextTitle(nx)}</b>
    <button type="button" class="btn btn-primary btn-block" onClick=${step}>
      <${Icon} name=${isSkill(nx.c) ? KINDS[kind].icon : 'chat'} size=${20} /> ${first ? 'Начать первый разговор' : isSkill(nx.c) ? 'Начать урок' : 'Продолжить разговор'}
    </button>
    <${LinkRow} items=${placeLink} />
  </section>`;
}

// What the next step is, said as an invitation of its person (a рубеж — by its name).
function nextTitle(nx) {
  if (nx.cp) return cpTitle(nx.cp);
  const p = PEOPLE[nx.t.who];
  const kind = nx.c.kind;
  return kind === 'pron' ? `Урок произношения: ${lc(nx.c.title)}`
    : kind === 'write' ? `${p.name} ждёт твоего сообщения`
    : kind === 'listen' ? `${p.name} хочет с тобой поговорить` : `${p.name} ждёт твоего ответа`;
}

// From the second day the day begins with memory: what fades comes before the next lesson. After the
// first review of the day the memory leads again while more than one review's worth waits — new lessons
// would only add to it; every review counts as a lesson of the day's goal. The lesson stays one tap away.
const REVIEW_N = 10;
const memLeads = (st) => {
  const n = dueList(st).length;
  return n > 0 && (!st.reviews[dayKey()] || n > REVIEW_N);
};
// The link past the memory to the next step.
const skipLabel = (nx) => (nx.cp ? (nx.cp.final ? 'Сразу к итогу круга' : 'Сразу к рубежу') : isSkill(nx.c) ? 'Сразу к уроку' : 'Сразу к разговору');

function MemRow({ st, go }) {
  const all = Object.keys(st.mem).filter((id) => phrase(id));
  if (!all.length) return null;
  const due = dueList(st);
  // The ornament (қошқар мүйіз) fades with the share of phrases waiting to be refreshed.
  const fade = Math.min(1, due.length / all.length);
  return html`<button type="button" class="mem-row" onClick=${() => go('review')}>
    <span class="mem-ic" style=${`opacity:${(1 - 0.6 * fade).toFixed(2)}`}><${Icon} name="ornament" size=${22} /></span>
    <span class="grow">${due.length ? `Память: ${cardsText(due)} ${agree(due, 'тускнеет', 'тускнеют')}` : `Память: ${cardsText(all)}, всё свежее`}</span>
    ${due.length ? html`<span class="link">Освежить</span>` : null}
    <${Icon} name="next" size=${18} stroke=${2.4} />
  </button>`;
}

// The circle the learner looked at last stays chosen while the page is open.
let homeLevel = null;

// The minutes chosen at the start make the daily goal: a lesson takes 1–2 minutes.
const GOAL_LESSONS = { 5: 3, 10: 6, 15: 9 };
const goalOf = (st) => GOAL_LESSONS[st.profile.minutes] || 6;
// Lessons and рубежи done for the first time today, and memory reviews finished today: a review is a
// lesson too.
const doneToday = (st) => Object.values(st.done).filter((d) => d === dayKey()).length + (st.reviews[dayKey()] || 0)
  + Object.values(st.checks).filter((c) => c.day === dayKey()).length;

function Home({ st, go, update }) {
  const v = varsOf(st);
  const [level, setLevelState] = useState(() => homeLevel || (nextUp(st) || { t: LEVELS[0] }).t.level || LEVELS[0].id);
  const setLevel = (id) => { homeLevel = id; setLevelState(id); };
  const today = doneToday(st);
  const goal = goalOf(st);
  const [install, installSheet] = useInstall(update);
  const [list, setList] = useState(false);
  return html`<main class="screen">
    <div class="scroll pad home">
      <header class="home-head"><span class="grow"><h1 class="h1">Привет, ${v.name}!</h1>
        <span class="muted sm">${today >= goal ? `Цель дня выполнена: ${today} ${plural(today, LESSON_W)}` : `Сегодня ${today} из ${goal} ${plural(goal, LESSON_W)}`}</span></span>
        <${ShanyrakChip} st=${st} go=${go} /></header>
      <div class="levels" role="tablist" aria-label="Круги общения">${OPEN_LEVELS.map((l) => html`
        <button type="button" role="tab" aria-selected=${level === l.id} class=${'level' + (level === l.id ? ' on' : '')} onClick=${() => setLevel(l.id)}>
          ${l.tab || l.title} <span>${l.id}</span></button>`)}</div>
      <${CircleMap} st=${st} go=${go} level=${level} onList=${() => setList(true)} />
      <${NextCard} st=${st} go=${go} level=${level} setLevel=${setLevel} />
      ${memLeads(st) && nextUp(st, level) ? null : html`<${MemRow} st=${st} go=${go} />`}
      <${RaceRow} st=${st} go=${go} />
      <${SurveyRow} st=${st} update=${update} />
      <${StatsRow} st=${st} update=${update} />
      <${InstallRow} st=${st} onOpen=${install} />
    </div>
    <${TabBar} tab="home" go=${go} st=${st} />
    ${installSheet}
    ${list ? html`<${TopicsSheet} st=${st} go=${go} level=${level} onClose=${() => setList(false)} />` : null}
  </main>`;
}

// All topics of a circle as a list: the map carries no labels, here every person has a name, a topic
// and where it stands. Topics ahead say that their first lessons are open.
function TopicsSheet({ st, go, level, onClose }) {
  const box = useRef(null);
  useSheet(box, onClose);
  const lv = levelOf(level);
  const nx = nextUp(st, level);
  const items = PLAYABLE.map((t, ti) => ({ t, ti })).filter((x) => x.t.level === level);
  const noteOf = (t, ti) => {
    const n = topicDone(st, t);
    if (n === t.convs.length) return 'пройдена';
    if (topicKnown(st, t)) return 'знакомая тема';
    if (nx && nx.ti === ti) return n ? `сейчас · ${n} из ${t.convs.length}` : 'сейчас';
    if (reached(st, ti)) return `${n} из ${t.convs.length}`;
    return n ? `впереди · ${n} из ${t.convs.length}` : 'впереди';
  };
  return html`<div class="sheet-back" onClick=${onClose}>
    <div class="sheet pad" ref=${box} role="dialog" aria-modal="true" aria-label=${`Круг «${lv.title}»`} onClick=${(e) => e.stopPropagation()}>
      <span class="sheet-grip" aria-hidden="true"></span>
      <h2 class="h2" tabindex="-1">Круг «${lv.title}» · ${topicsOnly(lv) ? `темы уровня ${lv.id}` : lv.id}</h2>
      <span class="muted sm">Первые уроки любой темы открыты сразу.</span>
      <div class="topic-list">${items.map(({ t, ti }) => html`
        <button type="button" class="topic-item" onClick=${() => { onClose(); go('topic', { ti }); }}>
          <${Avatar} who=${t.who} size=${36} />
          <span class="grow"><b>${t.title}</b><span class="muted sm">${PEOPLE[t.who].name} · ${noteOf(t, ti)}</span></span>
          <${Icon} name="next" size=${18} stroke=${2.4} /></button>`)}</div>
    </div>
  </div>`;
}

/* ---------- topic: one person, four conversations ---------- */

// back: the screen the topic was opened from (the phrasebook), else «Мой круг».
function TopicScreen({ st, ti, go, back }) {
  const t = PLAYABLE[ti];
  if (!t) return null;
  const p = PEOPLE[t.who];
  const v = varsOf(st);
  const rows = t.convs.map((c, ci) => ({ c, ci, done: !!st.done[c.id], open: convOpen(st, ti, ci) }));
  const target = rows.find((r) => r.open && !r.done);
  const learn = [...new Set(t.convs.flatMap((c) => c.teaches || []))].map((id) => phrase(id)).filter(Boolean).slice(0, 6);
  // A topic that is not open yet sends the learner to the step that opens it, not into a locked one.
  const before = !target && !rows.every((r) => r.done) ? nextUp(st, t.level) : null;
  const race = raceOpen(st, t);
  // A topic passed in full offers its рубеж when that comes next, otherwise its race; its lessons
  // stay in the list to go through again.
  const passed = !target && !before;
  const cp = CP_AFTER.get(t.id);
  const cps = cp ? cpStatus(st, cp, nextUp(st, t.level)) : '';
  const gate = passed && (cps === 'cur' || cps === 'open') ? cp : null;
  // Known by the entrance test: every lesson open, none done yet.
  const known = topicKnown(st, t) && rows.some((r) => !r.done);
  // Ahead of the way: the first lessons are open already, the rest when the way comes here.
  const ahead = !reached(st, ti) && rows.some((r) => !r.done);
  const cta = target ? `Начать: ${KINDS[target.c.kind].label.toLowerCase()}`
    : before ? `Сначала: ${before.cp ? (before.cp.final ? 'итог круга' : 'рубеж') : lower(before.t.title)}`
      : gate ? (gate.final ? 'Начать итог круга' : 'Начать рубеж') : race ? 'Бәйге — скачки по теме' : 'Пройти тему ещё раз';
  const onCta = () => (target ? go('conv', { ti, ci: target.ci, back }) : before ? goStep(go, before)
    : gate ? go('test', { id: gate.id }) : race ? go('race', { ti, back }) : go('conv', { ti, ci: 0, back }));
  return html`<main class="screen">
    <${TopBar} title=${t.title} sub=${t.kk} subLang="kk" onBack=${() => go(back || 'home')} backLabel=${back === 'phrasebook' ? 'Вернуться в разговорник' : 'Вернуться в «Мой круг»'} />
    <div class="scroll pad topic">
      <div class="person"><${Avatar} who=${t.who} size=${64} />
        <span><b class="h3">${p.name}</b><span class="muted sm">${p.ru} · ${t.convs.length} ${plural(t.convs.length, LESSON_W)} по 1–2 минуты</span></span></div>
      ${known ? html`<span class="mem-note"><${Icon} name="gate" size=${18} />Знакомая тема по входному тесту: уроки открыты, можно пройти любой.</span>`
        : ahead ? html`<span class="mem-note"><${Icon} name="next" size=${18} />Тема впереди: первые уроки открыты уже сейчас, остальные — когда дойдёшь до неё по кругу.</span>` : null}
      <ol class="conv-list">${rows.map((r) => html`<li>
        <button type="button" class=${'conv-row ' + (r.done ? 'done' : r === target ? 'open' : r.open ? '' : 'locked')} disabled=${!r.open} onClick=${() => go('conv', { ti, ci: r.ci, back })}>
          <span class="conv-ic"><${Icon} name=${KINDS[r.c.kind].icon} size=${20} /></span>
          <span class="grow"><b>${KINDS[r.c.kind].label}</b><span class="muted sm">${r.c.title}</span></span>
          ${r.done ? html`<span class="state ok" aria-label="пройден"><${Icon} name="check" size=${16} stroke=${3} /></span>`
            : r === target ? html`<span class="state now">сейчас</span>`
            : r.open ? html`<span class="state"><${Icon} name="next" size=${18} stroke=${2.4} /></span>`
            : html`<span class="state" aria-label="закрыт"><${Icon} name="lock" size=${16} /></span>`}
        </button></li>`)}</ol>
      ${cp ? html`<button type="button" class=${'conv-row cp-row' + (cps === 'locked' ? ' locked' : '')} disabled=${cps === 'locked'} onClick=${() => go('test', { id: cp.id })}>
        <span class="conv-ic"><${Icon} name="gate" size=${20} /></span>
        <span class="grow"><b>${cp.final ? 'Итог круга' : 'Рубеж'}</b><span class="muted sm">${cpNote(st, cp, cps)}</span></span>
        ${cps === 'pass' ? html`<span class="state gold" aria-label="взят"><${Icon} name="check" size=${16} stroke=${3} /></span>`
          : cps === 'locked' ? html`<span class="state" aria-label="закрыт"><${Icon} name="lock" size=${16} /></span>`
          : html`<span class="state"><${Icon} name="next" size=${18} stroke=${2.4} /></span>`}
      </button>` : null}
      ${race && (!passed || gate) ? html`<button type="button" class="conv-row race-row" onClick=${() => go('race', { ti, back })}>
        <span class="conv-ic"><${Icon} name="flag" size=${20} /></span>
        <span class="grow"><b><span lang="kk">Бәйге</span> по теме</b><span class="muted sm">${st.race.best[t.id]
          ? `${t.words.length} пар на время · рекорд ${raceTime(st.race.best[t.id])}` : `скачки: ${t.words.length} пар слов на время`}</span></span>
        <${Icon} name="next" size=${18} stroke=${2.4} />
      </button>` : null}
      <section class="learn">
        <span class="eyebrow">ФРАЗЫ ЭТОЙ ТЕМЫ</span>
        ${learn.map((ph) => html`<div class="learn-row">
          <span class="grow"><b class="kk" lang="kk">${fill(ph.kk, v)}</b><span class="muted sm">${fill(ph.ru, v)}</span></span>
          <${SpeakBtn} text=${fill(ph.kk, v)} /></div>`)}
      </section>
    </div>
    <div class="bottom pad"><button type="button" class="btn btn-primary btn-block" onClick=${onCta}>${cta}</button></div>
  </main>`;
}

/* ---------- conversation player ---------- */

const isTurn = (s) => !!(s.check || s.pick || s.build || s.say || s.own || s.choose || s.pair || s.type);

function autoMsg(step, v, topic) {
  if (step.note) return { k: 'note', text: val(step.note, v) };
  if (step.sound) return { k: 'sound', sound: step.sound, how: step.how, words: step.words };
  if (step.tip) return { k: 'tip', text: val(step.tip, v) };
  if (step.img) return { k: 'img', art: step.img, me: !!step.me };
  return { k: 'npc', who: step.who || topic.who, kk: val(step.npc, v), ru: val(step.ru, v) };
}

// The drawn shape of a heard line: the same text, the same shape; a longer line, more bars.
function waveOf(text) {
  const s = String(text);
  const vowels = (s.match(/[аәеёиіоөуұүыэюя]/gi) || []).length;
  const n = Math.max(8, Math.min(22, Math.round(vowels * 1.4)));
  let h = 0x811c9dc5;
  return Array.from({ length: n }, (_, i) => {
    h ^= s.charCodeAt(i % s.length) + i;
    h = Math.imul(h, 0x01000193) >>> 0;
    return 0.2 + (h % 997) / 1250;
  });
}

// A line of the other person shows its translation when tr is on; a tap on the line toggles it.
// The learner's own line always shows it: the answer is given by then.
// A heard line (m.hidden: «Послушай», or a fast line to ask about) is a voice message until its text
// opens: on «текст» (onShow), with «Ру» (all), or by itself once the question about it is answered.
function Msg({ m, tr, all, hint, topic, onRule, onTr, onShow }) {
  if (m.k === 'note') return html`<div class="m-note">${m.text}</div>`;
  if (m.k === 'tip') return html`<div class="m-tip"><${Bota} size=${28} /><span><b>Бота:</b> ${m.text}</span></div>`;
  if (m.k === 'img') return html`<div class=${'m-img ' + (m.me ? 'me' : 'them')}><${Photo} kind=${m.art} /></div>`;
  if (m.k === 'sound') {
    return html`<div class="m-sound">
      <span class=${'snd-big kk' + (m.sound.length > 3 ? ' long' : '')} lang="kk">${m.sound}</span>
      <p class="snd-how">${m.how}</p>
      <div class="snd-words">${m.words.map(([kk, ru]) => html`<span class="snd-word">
        <span class="grow"><b class="kk" lang="kk">${kk}</b><span class="muted sm">${ru}</span></span><${SpeakBtn} text=${kk} small /></span>`)}</div>
    </div>`;
  }
  if (m.k === 'rule') {
    return html`<button type="button" class="m-rule" onClick=${() => onRule(m.rule)}>
      <${Icon} name="book" size=${18} /> ${m.ask || `Почему «${m.word}»?`} Правило за 30 секунд</button>`;
  }
  if (m.k === 'me') {
    return html`<div class="b b-me"><span class="b-kk" lang="kk">${m.kk}</span>${m.ru ? html`<span class="b-tr">${m.ru}</span>` : null}</div>`;
  }
  // After an answer in one's own words Bota shows one way to say it, to compare with one's own.
  if (m.k === 'model') {
    return html`<div class="m-tip"><${Bota} size=${28} /><span class="m-tip-text"><b>Бота:</b> можно сказать и так — <b class="kk" lang="kk">${m.kk}</b>${all && m.ru
      ? html` <span class="m-tip-ru">«${m.ru}»</span>` : null}</span><${SpeakBtn} text=${m.kk} small label="Послушать пример" /></div>`;
  }
  // The learner's voice message: ▶ plays the recording (and calls off one under way). Said without a
  // microphone, the line is the phrase marked «сказал(а) вслух» — no drawn recording that never was.
  // An answer in one's own words (m.own) shows no text: nobody knows what was said.
  if (m.k === 'voice') {
    if (!m.url && m.own) {
      return html`<div class="b b-me b-said"><span class="b-said-row"><${Icon} name="mic" size=${13} stroke=${2.4} /> ответил(а) вслух</span></div>`;
    }
    if (!m.url) {
      return html`<div class="b b-me b-said"><span class="b-kk" lang="kk">${m.kk}</span>
        <span class="b-said-row"><${Icon} name="mic" size=${13} stroke=${2.4} /> сказал(а) вслух${voice.canSay(m.kk)
          ? html`<span aria-hidden="true"> · </span><button type="button" class="b-sample" onClick=${() => voice.speak(m.kk)}>образец</button>` : null}</span></div>`;
    }
    const play = () => {
      if (liveRecording) liveRecording.cancel();
      voice.stop();
      mic.play(m.url);
    };
    // The sample right under the learner's own recording: listen to both and compare.
    const sample = () => {
      if (liveRecording) liveRecording.cancel();
      mic.stopPlaying();
      voice.speak(m.kk);
    };
    return html`<div class="b b-me b-voice"><span class="b-voice-row">
      <button type="button" class="vplay" aria-label="Послушать свою запись" onClick=${play}><${PlayGlyph} size=${12} /></button><${Wave} levels=${m.levels} />
      ${m.ms ? html`<span class="b-dur">0:${pad2(Math.max(1, Math.round(m.ms / 1000)))}</span>` : null}</span>
      ${m.own ? null : html`<span class="b-kk sm" lang="kk">${m.kk}</span>`}
      ${!m.own && voice.canSay(m.kk) ? html`<span class="b-said-row"><button type="button" class="b-sample" onClick=${sample}>сравни с образцом</button></span>` : null}</div>`;
  }
  const other = m.who !== topic.who;
  if (m.hidden && !all) {
    const name = PEOPLE[m.who].name;
    const play = () => {
      if (liveRecording) liveRecording.cancel();
      mic.stopPlaying();
      voice.speak(m.kk);
    };
    return html`<div class="m-row left">
      ${other ? html`<${Avatar} who=${m.who} size=${30} label=${name} />` : null}
      <div class="b b-npc b-heard">
        ${other ? html`<span class="b-who">${name}</span>` : null}
        <span class="b-voice-row">
          <button type="button" class="vplay" aria-label=${`Послушать: ${name}`} onClick=${play}><${PlayGlyph} size=${12} /></button><${Wave} levels=${waveOf(m.kk)} />
          <button type="button" class="b-show" aria-label="Показать текст реплики" onClick=${onShow}>текст</button>
        </span>
      </div>
    </div>`;
  }
  return html`<div class="m-row left">
    ${other ? html`<${Avatar} who=${m.who} size=${30} label=${PEOPLE[m.who].name} />` : null}
    <div class="b b-npc">
      ${other ? html`<span class="b-who">${PEOPLE[m.who].name}</span>` : null}
      <span class="b-line">${m.ru
        ? html`<button type="button" class="b-kk b-tap" lang="kk" aria-expanded=${!!tr} onClick=${onTr}>${m.kk}</button>`
        : html`<span class="b-kk" lang="kk">${m.kk}</span>`}<${SpeakBtn} text=${m.kk} small /></span>
      ${tr && m.ru ? html`<span class="b-tr">${m.ru}</span>` : hint && m.ru ? html`<span class="b-tr b-hint">Нажми на фразу — появится перевод</span>` : null}
    </div>
  </div>`;
}

// Answers are judged the chat way: a wrong option gets a dashed frame and Bota explains it in the
// chat (onHint), the right one goes on with the conversation. No green or red plates.

// A row of quiet links under a panel: [label, onClick] pairs; empty ones are left out.
function LinkRow({ items }) {
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return html`<span class="done-links">${list.map(([label, on], i) => html`${i ? html`<span aria-hidden="true">·</span>` : null}<button type="button" class="link-btn" onClick=${on}>${label}</button>`)}</span>`;
}

// In a test (a рубеж, the entrance test) every question has one answer. A wrong one is explained by
// Bota, the right option is framed and «Дальше» goes on; «Не знаю» shows the right one at once.
// onDone(true) — right, onDone(false) — not.

// listen: a question about what was heard; with a Kazakh voice a wrong answer suggests listening again.
// slowly: plays the lines of the question once more, slowly; onDeaf: «Сейчас не могу слушать» — the
// rest of the lesson in text.
function CheckPanel({ step, listen, auto, slowly, onDeaf, onDone, onHint, test }) {
  // Syllables of a word keep their order; other answers are shuffled.
  const order = useMemo(() => (step.keep ? step.opts.map((_, i) => i) : shuffle(step.opts.map((_, i) => i))), []);
  const [tried, setTried] = useState([]);
  const [right, setRight] = useState(-1);
  const [missed, setMissed] = useState(false);
  const okAt = step.opts.findIndex((o) => o.ok);
  const choose = (i) => {
    if (right >= 0) return;
    const x = step.opts[i];
    if (x.ok) {
      setRight(i);
      if (auto && (step.speak || step.kk)) voice.speak(step.speak || x.t);
      setTimeout(() => onDone(true), 650);
      return;
    }
    if (!tried.includes(i)) setTried([...tried, i]);
    if (test) {
      setRight(okAt);
      setMissed(true);
      onHint(x.why);
      return;
    }
    onHint(`${x.why}${listen && !step.kk && voice.available() ? ' Послушай ещё раз.' : ''}`);
  };
  const dunno = () => {
    if (right >= 0) return;
    setRight(okAt);
    setMissed(true);
  };
  return html`<div class="panel-in">
    <div class="say-head"><span class="eyebrow">ВОПРОС</span>
      ${slowly ? html`<button type="button" class="btn-chip ico" onClick=${slowly}><${SpeakerGlyph} size=${14} /> Медленно</button>` : null}</div>
    <p class="q">${step.check}</p>
    <div class=${'opts' + (step.keep ? ' row' : '')}>${order.map((i) => {
      const x = step.opts[i];
      const state = right === i ? ' good' : tried.includes(i) ? ' bad' : '';
      return html`<button type="button" class=${'opt' + (step.kk ? ' kk' : '') + state} lang=${step.kk ? 'kk' : null} onClick=${() => choose(i)}><span>${x.t}</span></button>`;
    })}</div>
    ${missed ? html`<button type="button" class="btn btn-primary btn-block" onClick=${() => onDone(false)}>Дальше</button>` : null}
    <${LinkRow} items=${[test && !missed && right < 0 && ['Не знаю', dunno], onDeaf && !missed && ['Сейчас не могу слушать', onDeaf]]} />
  </div>`;
}

// more — links of the lesson under the options («Напечатать ответ»).
function PickPanel({ step, v, tr, onDone, onHint, test, more }) {
  const order = useMemo(() => shuffle(step.pick.map((_, i) => i)), []);
  const [sel, setSel] = useState(-1);
  const [tried, setTried] = useState([]);
  const [missed, setMissed] = useState(false);
  const right = step.pick.find((o) => o.ok);
  const send = () => {
    if (sel < 0 || missed) return;
    const o = step.pick[sel];
    if (o.ok) {
      onDone(o, true);
      return;
    }
    if (!tried.includes(sel)) setTried([...tried, sel]);
    setSel(-1);
    if (test) setMissed(true);
    onHint(val(o.why, v));
  };
  const dunno = () => {
    setSel(-1);
    setMissed(true);
  };
  return html`<div class="panel-in">
    <span class="eyebrow">ВЫБЕРИ ОТВЕТ</span>
    <div class="opts">${order.map((i) => {
      const x = step.pick[i];
      const state = missed && x.ok ? ' good' : sel === i ? ' sel' : tried.includes(i) ? ' bad' : '';
      return html`<button type="button" class=${'opt kk' + state} aria-pressed=${sel === i} onClick=${() => { if (!missed) setSel(i); }}>
        <span lang="kk">${val(x.kk, v)}</span>${tr ? html`<small>${val(x.ru, v)}</small>` : null}</button>`;
    })}</div>
    ${missed
      ? html`<button type="button" class="btn btn-primary btn-block" onClick=${() => onDone(right, false)}>Дальше</button>`
      : html`<button type="button" class="btn btn-primary btn-block" disabled=${sel < 0} onClick=${send}>
        <${Icon} name="send" size=${20} stroke=${2.4} /> Отправить</button>`}
    <${LinkRow} items=${[test && !missed && ['Не знаю', dunno], ...(!missed && more ? more : [])]} />
  </div>`;
}

function ChoosePanel({ step, v, tr, onDone }) {
  const opts = CHOICES[step.choose] || step.opts;
  const [sel, setSel] = useState(-1);
  return html`<div class="panel-in">
    <span class="eyebrow">${(step.prompt || 'Ответь про себя').toUpperCase()}</span>
    <div class=${'opts' + (opts.length > 4 ? ' grid2' : '')}>${opts.map((x, i) => html`
      <button type="button" class=${'opt kk' + (sel === i ? ' sel' : '')} aria-pressed=${sel === i} onClick=${() => setSel(i)}>
        <span lang="kk">${val(x.kk, v)}</span>${tr ? html`<small>${val(x.ru, v)}</small>` : null}</button>`)}</div>
    <button type="button" class="btn btn-primary btn-block" disabled=${sel < 0} onClick=${() => onDone(opts[sel])}>
      <${Icon} name="send" size=${20} stroke=${2.4} /> Отправить</button>
  </div>`;
}

// «Собери фразу»: a tap on a word below puts it at the end of the answer, a tap on a word of the answer
// takes it back. A word of the answer dragged with the finger goes to another place, the words around it
// make room as it moves; the arrow keys do the same for a word in focus. The drag listens on the window:
// the word keeps following the finger while the words around it move in the page.
// dragHint: the line «Порядок слов можно менять пальцем» until the learner first moves a word so;
// onDragged: that first time.
// more — links of the lesson under the words («Напечатать»).
function BuildPanel({ step, v, tr, onDone, onHint, test, dragHint, onDragged, more }) {
  const answer = step.build.map((w) => fill(w, v));
  const bank = useMemo(() => shuffle([...answer, ...step.extra].map((w, id) => ({ w, id }))), []);
  const [draft, setDraft] = useState([]);
  const [wrong, setWrong] = useState(false);
  const [missed, setMissed] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const missedRef = useRef(missed);
  missedRef.current = missed;
  const onDraggedRef = useRef(onDragged);
  onDraggedRef.current = onDragged;
  const field = useRef(null);
  // The word being dragged: its id and element, where the finger and the word started, how far the
  // finger went; on — far enough to drag, not to tap.
  const drag = useRef(null);
  const [dragId, setDragId] = useState(null);
  // A drag ends with a click on the word: that click must not take the word back.
  const dragged = useRef(false);
  const dnd = useMemo(() => {
    // The dragged word stands where the finger is, wherever the words around it have put it now.
    const place = () => {
      const d = drag.current;
      if (d && d.on) d.el.style.transform = `translate(${d.l + d.dx - d.el.offsetLeft}px, ${d.t + d.dy - d.el.offsetTop}px)`;
    };
    const move = (e) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pid) return;
      d.dx = e.clientX - d.x;
      d.dy = e.clientY - d.y;
      if (!d.on) {
        if (Math.hypot(d.dx, d.dy) < 8) return;
        d.on = true;
        dragged.current = true;
        setDragId(d.id);
      }
      if (e.cancelable) e.preventDefault();
      // Its new place: before the first other word that its middle comes before, in reading order.
      const cx = d.l + d.dx + d.el.offsetWidth / 2;
      const cy = d.t + d.dy + d.el.offsetHeight / 2;
      const others = field.current ? [...field.current.querySelectorAll('.wchip.in')].filter((c) => c !== d.el) : [];
      let at = others.findIndex((c) => cy < c.offsetTop || (cy < c.offsetTop + c.offsetHeight && cx < c.offsetLeft + c.offsetWidth / 2));
      if (at < 0) at = others.length;
      const rest = draftRef.current.filter((x) => x !== d.id);
      const next = [...rest.slice(0, at), d.id, ...rest.slice(at)];
      if (next.join() !== draftRef.current.join()) {
        setDraft(next);
        setWrong(false);
      }
      place();
    };
    const off = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    const end = (e) => {
      const d = drag.current;
      if (!d || (e && e.pointerId !== d.pid)) return;
      drag.current = null;
      off();
      if (!d.on) return;
      d.el.style.transform = '';
      setDragId(null);
      if (onDraggedRef.current) onDraggedRef.current();
    };
    const start = (e, id) => {
      dragged.current = false;
      if (missedRef.current || drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const el = e.currentTarget;
      drag.current = { id, el, pid: e.pointerId, x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop, dx: 0, dy: 0, on: false };
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    };
    return { place, start, off };
  }, []);
  // A word moved with the arrow keys keeps the focus: moving it in the page takes the focus away.
  const refocus = useRef(null);
  useLayoutEffect(() => {
    dnd.place();
    const el = refocus.current != null && field.current && field.current.querySelector(`[data-id="${refocus.current}"]`);
    refocus.current = null;
    if (el) el.focus();
  }, [draft]);
  useEffect(() => dnd.off, []);
  const words = draft.map((id) => bank.find((b) => b.id === id).w);
  const extra = words.find((w) => step.why && step.why[w]);
  const short = !extra && words.length < answer.length;
  const why = extra ? step.why[extra] : short ? 'Не хватает слов — добавь ещё.' : val(step.order, v);
  const send = () => {
    if (!draft.length || missed) return;
    if (words.join(' ') === answer.join(' ')) {
      onDone(true);
      return;
    }
    setWrong(true);
    // In a test a phrase cut short is not an answer yet: it can still be finished.
    if (test && !short) setMissed(true);
    onHint(why);
  };
  const edit = (next) => { if (!missed) { setDraft(next); setWrong(false); } };
  // The arrow keys move the word in focus one place to the left or to the right.
  const nudge = (e, id) => {
    const k = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    const i = draft.indexOf(id);
    if (!k || missed || i + k < 0 || i + k >= draft.length) return;
    e.preventDefault();
    const next = [...draft];
    [next[i], next[i + k]] = [next[i + k], next[i]];
    refocus.current = id;
    edit(next);
  };
  const text = val(step.text, v);
  return html`<div class="panel-in">
    <span class="eyebrow">СОБЕРИ ОТВЕТ${tr ? html`<span class="eyebrow-ru"> · «${val(step.ru, v)}»</span>` : null}</span>
    <div class="build-row">
      <div class=${'build-field' + (wrong ? ' bad' : '')} ref=${field} aria-label="Твой ответ" lang="kk">
        ${words.length ? draft.map((id, i) => html`<button type="button" key=${id} data-id=${id} class=${'wchip in' + (dragId === id ? ' drag' : '')}
          aria-label=${`Убрать «${words[i]}» (стрелки — переставить)`}
          onPointerDown=${(e) => dnd.start(e, id)} onKeyDown=${(e) => nudge(e, id)}
          onClick=${() => { if (dragged.current) { dragged.current = false; return; } edit(draft.filter((x) => x !== id)); }}>${words[i]}</button>`)
          : html`<span class="muted sm placeholder">Нажимай на слова ниже…</span>`}
      </div>
      ${missed ? null : html`<button type="button" class="send-round" aria-label="Отправить ответ" disabled=${!draft.length} onClick=${send}>
        <${Icon} name="send" size=${22} stroke=${2.4} /></button>`}
    </div>
    ${dragHint && !missed && draft.length > 1 ? html`<span class="muted sm drag-hint">Порядок слов можно менять пальцем</span>` : null}
    ${missed
      ? html`<div class="type-model"><span class="grow"><b class="kk" lang="kk">${text}</b></span><${SpeakBtn} text=${text} small /></div>
        <button type="button" class="btn btn-primary btn-block" onClick=${() => onDone(false)}>Дальше</button>`
      : html`<div class="bank" lang="kk">${bank.filter((b) => !draft.includes(b.id)).map((b) => html`
        <button type="button" class="wchip" onClick=${() => edit([...draft, b.id])}>${b.w}</button>`)}</div>`}
    <${LinkRow} items=${[test && !missed && ['Не знаю', () => setMissed(true)], ...(!missed && more ? more : [])]} />
  </div>`;
}

// In a stress pattern the stressed syllable is written in capitals; it is shown in bold instead.
function Syllables({ text }) {
  return text.split(/([\s\-·]+)/).map((part) => (part && part === part.toUpperCase() && part !== part.toLowerCase()
    ? html`<b class="stress">${part.toLowerCase()}</b>` : part));
}

// Why «Скажи вслух» cannot record now, or '' when it can: the setting is off, the page may not use
// the microphone (the claude.ai artifact frame), the browser cannot record, or it was refused.
let micTrouble = '';
// A note about the microphone is shown once a visit, not under every phrase.
const micNoted = new Set();
// The recording under way: ▶ on an older voice message calls it off before playing.
let liveRecording = null;
function micState(st) {
  if (!st.settings.mic) return 'off';
  if (!mic.supported()) return 'unsupported';
  if (!mic.allowed()) return 'blocked';
  return micTrouble;
}
const MIC_NOTE = {
  paused: 'Запись выключена до конца урока.',
  blocked: 'Здесь микрофон недоступен — запись работает в Боте по ссылке.',
  unsupported: 'Этот браузер не умеет записывать голос.',
  denied: 'Доступ к микрофону не разрешён — его можно включить в настройках браузера.',
  nomic: 'Микрофон не найден.',
};

// Say a phrase aloud. With a microphone the phrase is recorded and goes to the chat as a voice
// message: the app hears whether the whole phrase was said, not how it sounded — that needs
// speech recognition on a server. Without one, the learner says it and taps the button.
// recall («Скажи голосом»): the phrase is said from memory, not read. The learner reads it and
// listens, and as the recording starts the text hides behind its meaning; the voice message in the
// chat then shows the phrase, with the sample next to the learner's own recording.
// own (step.own, «Поговори без подсказок»): an answer in one's own words. No phrase to read: the
// example (step.own) opens only on a tap, and after the answer Bota shows it in the chat.
// blind (a test): from the meaning alone — the phrase stays hidden; onGiveUp — «Не знаю».
function SayPanel({ step, v, tr, st, recall, own, blind, paused, onPause, onResume, onDone, onHint, onGiveUp }) {
  const kk = val(own ? step.own : step.say, v);
  const syl = own ? '' : val(step.syl, v);
  const [example, setExample] = useState(false);
  // idle → opening (the browser turns the microphone on) → rec → idle
  const [stage, setStage] = useState('idle');
  const [hidden, setHidden] = useState(!!blind);
  const [meter, setMeter] = useState([]);
  // What went wrong with the last try; stays in the panel, where the learner looks.
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const [, redraw] = useState(0);
  const live = useRef(null);
  const alive = useRef(true);
  const asked = useRef(false);
  const trouble = paused ? 'paused' : micState(st);
  // Noted at once, while drawing: a quick tap may close the panel before any effect of it runs.
  const [noteDue] = useState(() => {
    const due = !micNoted.has(trouble);
    if (trouble) micNoted.add(trouble);
    return due;
  });
  const syllables = (kk.toLowerCase().match(/[аәеёиіоөуұүыэюя]/g) || []).length;
  useEffect(() => () => {
    alive.current = false;
    if (live.current) live.current.cancel();
    voice.hold(false);
  }, []);

  const start = () => {
    if (live.current) return;
    // Nothing sounds while the microphone listens: a sample would be recorded as the learner's voice.
    voice.hold(true);
    mic.stopPlaying();
    setStatus('');
    if (recall) setHidden(true);
    const r = mic.record({
      // One's own answer may well be longer than the example.
      maxMs: own ? Math.min(20000, 6000 + syllables * 500) : Math.min(15000, 3000 + syllables * 450),
      onStart: () => { if (alive.current) setStage('rec'); },
      onLevel: (l) => { if (alive.current) setMeter((m) => [...m.slice(-23), l]); },
    });
    live.current = r;
    liveRecording = r;
    setMeter([]);
    setStage('opening');
    const settle = () => {
      live.current = null;
      if (liveRecording === r) liveRecording = null;
      voice.hold(false);
      if (alive.current) setStage('idle');
    };
    // A try that did not work shows the phrase again, to read it once more — not in a test.
    const reveal = () => { if (alive.current && !blind) setHidden(false); };
    r.done.then((res) => {
      settle();
      const drop = () => { if (res.url) URL.revokeObjectURL(res.url); };
      if (res.cancelled) { reveal(); return; }
      // The lesson was left meanwhile: nobody will play this recording.
      if (!alive.current) { drop(); return; }
      if (!res.heard) {
        drop();
        reveal();
        stats.track('mic', { r: 'quiet', recall: !!recall, own: !!own });
        const again = own ? 'ответь ещё раз' : 'скажи фразу ещё раз';
        setStatus(`Не слышно. Поднеси телефон ближе и ${again}.`);
        onHint(`Тебя не слышно. Поднеси телефон ближе и ${again}.`);
        return;
      }
      // A syllable takes about a fifth of a second: far less sound than that is not the whole phrase.
      // One's own answer has no length to keep to.
      if (!own && !asked.current && syllables >= 6 && res.voicedMs < syllables * 55) {
        asked.current = true;
        drop();
        reveal();
        stats.track('mic', { r: 'short', recall: !!recall });
        setStatus('Похоже, это не вся фраза. Скажи её целиком.');
        onHint('Похоже, это не вся фраза. Скажи её целиком.');
        return;
      }
      stats.track('mic', { r: 'ok', recall: !!recall, own: !!own, ms: Math.round(res.ms || 0) });
      onDone(res);
    }, (e) => {
      settle();
      reveal();
      if (!alive.current) return;
      let code = e && e.code;
      // In a frame (the claude.ai artifact) Safari refuses at once: the frame, not the learner, says no.
      if (code === 'denied' && window.self !== window.top) code = 'blocked';
      stats.track('mic', { r: MIC_NOTE[code] ? code : 'error', recall: !!recall, own: !!own });
      if (MIC_NOTE[code]) {
        micTrouble = code;
        micNoted.add(code);
        setFailed(true);
        redraw((n) => n + 1);
      } else setStatus('Не получилось включить микрофон. Попробуй ещё раз.');
    });
  };

  const giveUp = blind && onGiveUp ? [['Не знаю', onGiveUp]] : [];
  const links = (items) => html`<${LinkRow} items=${[...items, ...giveUp]} />`;
  let action;
  if (trouble) {
    const note = MIC_NOTE[trouble] && (trouble === 'paused' || noteDue || failed) ? MIC_NOTE[trouble] : '';
    const again = trouble === 'paused' ? [['Включить запись', onResume]]
      : trouble === 'denied' || trouble === 'nomic' ? [['Попробовать снова', () => { micTrouble = ''; setFailed(false); redraw((n) => n + 1); }]] : [];
    // From memory without a recording: first the text hides, then the learner says it and taps.
    action = html`${recall && !hidden
      ? html`<button type="button" class="btn btn-primary btn-block" onClick=${() => setHidden(true)}><${Icon} name="mic" size=${20} /> Сказать по памяти</button>`
      : html`<button type="button" class="btn btn-primary btn-block" onClick=${() => onDone(null)}><${Icon} name="mic" size=${20} /> ${own ? 'Я ответил(а) вслух' : 'Я сказал(а) вслух'}</button>`}
      ${note ? html`<span class="muted sm center" role="status">${trouble === 'blocked'
        ? html`Здесь микрофон недоступен — <a href=${SITE} target="_blank" rel="noopener">открой Боту по ссылке</a>, там запись работает.` : note}</span>` : null}
      ${links(again)}`;
  } else if (stage !== 'idle') {
    action = html`<div class="rec-row" role="status"><span class="rec-dot" aria-hidden="true"></span><span class="sm">${stage === 'opening' ? 'Включаю микрофон…' : 'Слушаю…'}</span>
        <span class="rec-meter" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => html`<i style=${`height:${Math.round(4 + (meter[meter.length - 24 + i] || 0) * 22)}px`}></i>`)}</span></div>
      ${stage === 'opening'
        ? html`<button type="button" class="btn btn-ghost btn-block" onClick=${() => live.current && live.current.cancel()}>Отмена</button>`
        : html`<button type="button" class="btn btn-primary btn-block" onClick=${() => live.current && live.current.stop()}><span class="stop-glyph" aria-hidden="true"></span> Готово</button>`}`;
  } else {
    action = html`<button type="button" class="btn btn-primary btn-block" onClick=${start}><${Icon} name="mic" size=${20} /> ${own ? 'Ответить голосом' : recall ? 'Сказать по памяти' : 'Записать'}</button>
      ${status ? html`<span class="say-status" role="status">${status}</span>` : null}
      ${links([['Сейчас не могу говорить', onPause]])}`;
  }

  // While the microphone listens, the sample stays silent: it would be recorded as the learner's voice.
  const busy = stage !== 'idle';
  if (own) {
    // With «Ру» the meaning of the example is a hint of what to answer; the example itself opens on a tap.
    return html`<div class="panel-in">
      <div class="say-head"><span class="eyebrow">ОТВЕТЬ ГОЛОСОМ</span><span class="muted sm">своими словами</span></div>
      <div class="say-card">
        <span class="say-ask">Ответь по-казахски — так, как сказал(а) бы сам(а).</span>
        ${tr ? html`<span class="say-ru">Например, по смыслу: «${val(step.ru, v)}»</span>` : null}
        ${example
          ? html`<span class="say-kk own" lang="kk">${kk}</span>
            ${voice.canSay(kk) ? html`<div class="say-ctl"><button type="button" class="ctl" disabled=${busy} onClick=${() => voice.speak(kk)}><${SpeakerGlyph} size=${16} /> Послушать</button></div>` : null}`
          : html`<button type="button" class="link-btn peek" onClick=${() => setExample(true)}>Пример ответа</button>`}
      </div>
      ${action}
    </div>`;
  }
  const hint = recall ? (hidden ? '' : 'запомни — текст спрячется') : step.stress ? 'жирным — ударный слог' : 'можно по слогам';
  return html`<div class="panel-in">
    <div class="say-head"><span class="eyebrow">${recall ? 'СКАЖИ ПО ПАМЯТИ' : 'СКАЖИ ВСЛУХ'}</span>${hint ? html`<span class="muted sm">${hint}</span>` : null}</div>
    ${hidden ? html`<div class="say-card">
        <span class="say-mean">«${val(step.ru, v)}»</span>
        <span class="muted sm">${blind ? 'Скажи это по-казахски.' : 'Скажи это по-казахски, не глядя на текст.'}</span>
        ${blind ? null : html`<button type="button" class="link-btn peek" onClick=${() => setHidden(false)}>Подсмотреть</button>`}
      </div>`
      : html`<div class="say-card">
        <span class="say-kk" lang="kk">${kk}</span>
        <span class=${'say-syl' + (step.stress ? ' big' : '')}>${step.stress ? html`<${Syllables} text=${syl} />` : syl}</span>
        ${tr ? html`<span class="say-ru">«${val(step.ru, v)}»</span>` : null}
        ${voice.canSay(kk)
          ? html`<div class="say-ctl">
              <button type="button" class="ctl" disabled=${busy} onClick=${() => voice.speak(kk)}><${SpeakerGlyph} size=${16} /> Послушать</button>
              <button type="button" class="ctl" disabled=${busy} onClick=${() => voice.slow(kk)}>Медленно</button></div>`
          : html`<span class="muted sm">В этом браузере нет казахского голоса — прочитай по слогам.</span>`}
      </div>`}
    ${action}
  </div>`;
}

// Two words that differ in one sound. With a voice: which one sounded?
// Without one: which one has this meaning?
function PairPanel({ step, auto, onDone, onHint }) {
  const hasVoice = voice.canSay(step.pair[0][0]) && voice.canSay(step.pair[1][0]);
  const [target] = useState(() => Math.floor(Math.random() * step.pair.length));
  const order = useMemo(() => shuffle(step.pair.map((_, i) => i)), []);
  const [pick, setPick] = useState(-1);
  const solved = pick === target;
  const [kk, ru] = step.pair[target];
  useEffect(() => {
    if (!hasVoice || !auto) return undefined;
    const id = setTimeout(() => voice.speak(kk), 350);
    return () => clearTimeout(id);
  }, []);
  const choose = (i) => {
    if (hasVoice) voice.speak(step.pair[i][0]);
    if (solved) return;
    setPick(i);
    if (i !== target) onHint(`Это «${step.pair[i][0]}» — ${step.pair[i][1]}.${hasVoice ? ' Послушай ещё раз.' : ''}`);
  };
  return html`<div class="panel-in">
    <span class="eyebrow">${hasVoice ? 'ЧТО ПРОЗВУЧАЛО?' : 'ВОПРОС'}</span>
    ${hasVoice
      ? html`<div class="say-ctl">
          <button type="button" class="ctl" onClick=${() => voice.speak(kk)}><${SpeakerGlyph} size=${16} /> Послушать</button>
          <button type="button" class="ctl" onClick=${() => voice.slow(kk)}>Медленно</button></div>`
      : html`<p class="q">«${ru}» — это…</p>`}
    <div class="opts two">${order.map((i) => {
      const [w, m] = step.pair[i];
      const state = solved && i === target ? ' good' : !solved && pick === i ? ' bad' : '';
      return html`<button type="button" class=${'opt kk' + state} onClick=${() => choose(i)}><span lang="kk">${w}</span>${solved ? html`<small>${m}</small>` : null}</button>`;
    })}</div>
    ${solved && hasVoice ? html`<span class="muted sm center">Нажимай на слова, чтобы сравнить.</span>` : null}
    ${solved ? html`<button type="button" class="btn btn-primary btn-block" onClick=${() => onDone(step.pair[target])}>Дальше</button>` : null}
  </div>`;
}

// Typing a message in Kazakh letters. Reports a grade for the memory: 3 at first try,
// 2 after mistakes, 1 when the answer had to be shown, and the message as typed. Besides the
// answer it accepts step.alt and the forms typing.js allows. A dictation step (A2) plays the
// phrase instead of showing its meaning; without a Kazakh voice it falls back to the meaning.
// In a test one slip of Kazakh letters only («Асыгып» for «Асығып») gets a hint and a second try;
// any other mistake shows the answer. onDone(grade, message, right).
// The line of Kazakh letters and the message field with its send button; a letter goes in where the
// caret is, the first letter of a message in capitals. The form around it sends.
function TypeField({ text, setText, input, label = 'Сообщение по-казахски', placeholder = 'Сообщение…' }) {
  const insert = (ch) => {
    const el = input.current;
    const start = el && el.selectionStart != null ? el.selectionStart : text.length;
    const end = el && el.selectionEnd != null ? el.selectionEnd : text.length;
    setText(text.slice(0, start) + (start === 0 ? ch.toUpperCase() : ch) + text.slice(end));
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(start + 1, start + 1); } });
  };
  return html`<div class="kz-keys" role="group" aria-label="Казахские буквы">${KZ_LETTERS.map((ch) => html`
      <button type="button" class="kz-key" aria-label=${`Буква ${ch}`} onMouseDown=${(e) => e.preventDefault()} onClick=${() => insert(ch)}>${ch}</button>`)}</div>
    <div class="type-row">
      <label class="sr" for="type-in">${label}</label>
      <input id="type-in" ref=${input} class="type-input" type="text" lang="kk" autocomplete="off" autocorrect="off" autocapitalize="sentences"
        spellcheck=${false} enterkeyhint="send" placeholder=${placeholder} value=${text} onInput=${(e) => setText(e.target.value)} />
      <button type="submit" class="send-round" aria-label="Отправить" disabled=${!text.trim()}><${Icon} name="send" size=${22} stroke=${2.4} /></button>
    </div>`;
}

// Writing a message in Kazakh. The same panel takes a reply typed instead of chosen and a phrase typed
// instead of put together (ask — its heading then; others — the link back to choosing).
function TypePanel({ step, v, auto, onDone, onHint, test, ask, others }) {
  const answer = val(step.type, v);
  const answers = [answer, ...(step.alt || []).map((a) => val(a, v))];
  const dict = !!step.dict && voice.canSay(answer);
  const [text, setText] = useState('');
  const [hint, setHint] = useState(false);
  const [missed, setMissed] = useState(false);
  const input = useRef(null);
  // Refs, not state: a quick second Enter must see the attempt before it.
  const tries = useRef(0);
  const hinted = useRef(false);
  const sent = useRef(false);
  const letters = useRef(false);
  const miss = () => {
    sent.current = true;
    setMissed(true);
  };
  const showHint = () => { hinted.current = true; setHint(true); };
  useEffect(() => {
    try { input.current.focus({ preventScroll: true }); } catch (e) { /* focus is a convenience */ }
    if (!dict || !auto) return undefined;
    const id = setTimeout(() => voice.speak(answer), 400);
    return () => clearTimeout(id);
  }, []);
  const check = () => {
    const typed = (input.current ? input.current.value : text).replace(/\s+/g, ' ').trim();
    if (!normType(typed) || sent.current) return;
    if (/\d/.test(typed)) {
      onHint('Напиши числа словами, по-казахски.');
      return;
    }
    const res = checkTyped(typed, answers);
    if (res.ok) {
      sent.current = true;
      onDone(hinted.current ? 1 : tries.current ? 2 : 3, cap(typed), true);
      return;
    }
    tries.current += 1;
    if (test && (!res.need || letters.current)) {
      miss();
      onHint(`Не совсем. Правильно так: «${answer}».`);
      return;
    }
    if (res.need) {
      letters.current = true;
      const fix = [
        res.need.length ? `нужны казахские буквы: ${res.need.join(', ')}` : '',
        ...res.plainFor.map(([kz, ch]) => `«${ch}», а не «${kz}»`),
      ].filter(Boolean);
      onHint(`Почти! Здесь ${fix.join('; ')}.`);
    } else if (tries.current >= 2) {
      showHint();
      onHint('Не совсем. Посмотри на образец над клавиатурой и напиши так же.');
    } else {
      const w = answer.split(' ')[0].replace(/[^\p{L}]/gu, '');
      onHint(`Не совсем. Начинается так: «${w.slice(0, Math.min(3, Math.ceil(w.length / 2)))}…»`);
    }
  };
  const head = test
    ? (missed ? null : html`<button type="button" class="btn-chip" onClick=${miss}>Не знаю</button>`)
    : (hint ? null : html`<button type="button" class="btn-chip" onClick=${showHint}>Подсказка</button>`);
  return html`<form class="panel-in" onSubmit=${(e) => { e.preventDefault(); check(); }}>
    <div class="say-head"><span class="eyebrow">${dict ? 'ЗАПИШИ НА СЛУХ' : ask || 'НАПИШИ ПО-КАЗАХСКИ'}</span>${head}</div>
    ${dict
      ? html`<div class="say-ctl">
          <button type="button" class="ctl" onClick=${() => voice.speak(answer)}><${SpeakerGlyph} size=${16} /> Послушать</button>
          <button type="button" class="ctl" onClick=${() => voice.slow(answer)}>Медленно</button></div>`
      : html`<p class="type-ask">«${val(step.ru, v)}»</p>`}
    ${hint || missed ? html`<div class="type-model"><span class="grow"><b class="kk" lang="kk">${answer}</b></span><${SpeakBtn} text=${answer} small /></div>` : null}
    ${missed ? html`<button type="button" class="btn btn-primary btn-block" onClick=${() => onDone(1, '', false)}>Дальше</button>` : html`
    <${TypeField} text=${text} setText=${setText} input=${input} />
    <${LinkRow} items=${others || []} />`}
  </form>`;
}

// One main action — the next lesson; going home and repeating stay in one line of links.
// The lesson or review that reaches the day's goal closes the day: a new уық in the шаңырақ of the
// month and what waits tomorrow, then «Готово на сегодня».
function DayHead({ st }) {
  const now = new Date();
  const streak = streakOf(st.days);
  return html`<div class="done-head">
    <${Shanyrak} year=${now.getFullYear()} month=${now.getMonth()} days=${st.days} today=${now.getDate()} size=${52} fresh />
    <span class="grow"><b class="h3">Цель дня выполнена!</b><span class="gold-text sm">Серия ${streak} ${plural(streak, DAY_W)}: в шаңыраке новая жердь-уық</span></span>
  </div>`;
}

// Tomorrow: the next lesson, and the memory that fades by then.
function Tomorrow({ st }) {
  const nx = nextUp(st);
  const due = dueList(st, Date.now() + fsrs.DAY);
  const parts = [nx ? nextTitle(nx) : '', due.length ? `${cardsText(due)} освежить` : ''].filter(Boolean);
  if (!parts.length) return null;
  return html`<span class="mem-note"><${Icon} name="ornament" size=${20} />Завтра: ${parts.join(' · ')}</span>`;
}

function DonePanel({ st, update, conv, ti, ci, result, v, go, said, back }) {
  const streak = streakOf(st.days);
  // The third lesson of a topic, done for the first time, opens the race of its words.
  const topic = PLAYABLE[ti];
  const opened = result.first && ci === 2 && topic.words && topic.words.length;
  // Next: the next open lesson of this topic — a topic ahead of the way goes on within itself — or else
  // the next step of the way.
  const inTopic = topic.convs.findIndex((c, i) => i > ci && !st.done[c.id] && convOpen(st, ti, i));
  const nx = (inTopic > ci ? ALL_CONVS.find((x) => x.ti === ti && x.ci === inTopic) : null) || nextUp(st, PLAYABLE[ti].level) || nextUp(st);
  const nextText = nx ? stepLabel(nx, ti) : null;
  // The next lesson of the same topic keeps the way back (to the phrasebook).
  const toNext = () => (!nx ? go('home') : !nx.cp && nx.ti === ti ? go('conv', { ti, ci: nx.ci, back }) : goStep(go, nx));
  const note = result.added ? `${result.added} ${plural(result.added, PHR_W)} — в памяти, повторим завтра`
    : conv.kind === 'pron' ? 'Повторяй эти слова вслух — так звук закрепится'
    : conv.kind === 'write' ? `Без подсказки: ${result.clean} из ${result.typed}`
    : 'Фразы уже в памяти — повторим по графику';
  const cando = html`<div class="cando"><span class="eyebrow">ТЕПЕРЬ ТЫ УМЕЕШЬ</span>
    ${conv.can.map(([ru, kk]) => html`<span class="cando-row"><span class="tick"><${Icon} name="check" size=${12} stroke=${3.4} /></span>
      <span>${ru} — <b class="kk" lang="kk">${fill(kk, v)}</b></span></span>`)}</div>`;
  const race = opened ? html`<button type="button" class="m-rule race-open" onClick=${() => go('race', { ti, back })}>
    <${Icon} name="flag" size=${18} /><span>Открылась <span lang="kk">бәйге</span> — скачки на ${topic.words.length} словах темы</span></button>` : null;
  const again = html`<button type="button" class="link-btn" onClick=${() => go('conv', { ti, ci, k: Date.now(), back })}>Пройти ещё раз</button>`;
  if (result.closed) {
    return html`<div class="panel-in done">
      <${DayHead} st=${st} />
      ${cando}
      <${Tomorrow} st=${st} />
      ${race}
      <${RemindRow} st=${st} update=${update} />
      <button type="button" class="btn btn-primary btn-block" onClick=${() => go('home')}>Готово на сегодня</button>
      <span class="done-links">${nx ? html`<button type="button" class="link-btn" onClick=${toNext}>Ещё урок</button><span aria-hidden="true">·</span>` : null}${again}</span>
      <${ReportLink} phrases=${said || []} where=${`lesson:${conv.id}`} hide=${st.profile.name} />
    </div>`;
  }
  return html`<div class="panel-in done">
    <div class="done-head"><${Sun} size=${34} />
      <span class="grow"><b class="h3">${isSkill(conv) ? 'Урок окончен!' : 'Разговор окончен!'}</b><span class="gold-text sm">Сегодня ✓ · серия ${streak} ${plural(streak, DAY_W)}</span></span>
    </div>
    ${cando}
    <span class="mem-note"><${Icon} name=${conv.kind === 'pron' ? 'sound' : conv.kind === 'write' ? 'edit' : 'ornament'} size=${20} />${note}</span>
    ${race}
    <button type="button" class="btn btn-primary btn-block" onClick=${toNext}>${nx ? nextText : 'Вернуться в «Мой круг»'}</button>
    <span class="done-links">
      ${nx ? html`<button type="button" class="link-btn" onClick=${() => go('home')}>В «Мой круг»</button><span aria-hidden="true">·</span>` : null}
      ${again}
    </span>
    <${ReportLink} phrases=${said || []} where=${`lesson:${conv.id}`} hide=${st.profile.name} />
  </div>`;
}

function ConvScreen({ st, update, ti, ci, go, back }) {
  const t = PLAYABLE[ti];
  const conv = t.convs[ci];
  const person = PEOPLE[t.who];
  const v = varsOf(st);
  const steps = conv.steps;
  const [pos, setPos] = useState(0);
  // The very first lesson of a newcomer (none done, no entrance test) is not a guess by ear: its lines
  // come with their text and translation, and Bota says once what the buttons do. The first
  // «Послушай» by ear after it says how that works.
  const [guided] = useState(() => conv.kind === 'listen' && ti === 0 && !Object.keys(st.done).length && !st.place.day);
  const [log, setLog] = useState(() => {
    if (guided) return [{ k: 'tip', text: 'Первый разговор! Фразы звучат сами, а значок динамика повторит их. Перевод пока под каждой фразой, дальше — по нажатию на фразу или по кнопке «Ру» вверху.' }];
    const byEar = conv.kind === 'listen' && st.settings.voice && voice.available()
      && !ALL_CONVS.some((x) => x.c.kind === 'listen' && x.ti !== 0 && st.done[x.c.id]);
    return byEar ? [{ k: 'tip', text: 'Теперь — на слух: реплики приходят голосовыми, текст откроется после ответа. Не расслышал(а) — «Медленно», совсем никак — «текст» в сообщении.' }] : [];
  });
  const [typing, setTyping] = useState(false);
  // tr: every translation, answer options included (the «Ру» button). Without it a line shows
  // its translation after a tap, and options stay in Kazakh until the answer is given.
  const [tr, setTr] = useState(conv.kind !== 'free' && (st.settings.trAuto || guided));
  const [opened, setOpened] = useState({});
  const [sheet, setSheet] = useState(null);
  const [result, setResult] = useState(null);
  const [voiceChecked, setVoiceChecked] = useState(false);
  // «Сейчас не могу говорить» turns the microphone off until the end of the lesson.
  const [micPaused, setMicPaused] = useState(false);
  // «Послушай» is heard, not read: a line that can sound comes as a voice message (m.hidden), and its
  // text opens once the question about it is answered. A fast line (step.fast) — the one to ask about
  // with «Қайталаңызшы» — is heard first in any lesson and opens after the next reply. «Сейчас не
  // могу слушать» (deaf) brings the text back and stops the voice until the end of the lesson.
  const [deaf, setDeaf] = useState(false);
  const deafRef = useRef(false);
  // Where the lines since the learner's last turn begin in the log: what «Медленно» plays again.
  const segStart = useRef(0);
  const openAll = (l) => (l.some((m) => m.hidden) ? l.map((m) => (m.hidden ? { ...m, hidden: false } : m)) : l);
  // The learner's recordings live only while the lesson is open.
  const recordings = useRef([]);
  const scroller = useRef(null);
  const composer = useRef(null);
  const typed = useRef({ n: 0, clean: 0 });
  const stRef = useRef(st);
  stRef.current = st;
  // The step whose line is already in the chat (an open rule can interrupt its voice).
  const shownPos = useRef(-1);
  const lastTurn = useRef(0);

  const step = steps[pos];
  const turns = steps.filter(isTurn).length;
  const turnsDone = steps.slice(0, pos).filter(isTurn).length;

  // For the pilot's statistics: the lesson started, finished, or was left at its step (turnsDone);
  // a page hidden mid-lesson says where it stopped, in case it never comes back.
  const track = useRef({ step: 0, done: false, t0: Date.now() });
  track.current.step = turnsDone;
  useEffect(() => {
    stats.track('lesson', { id: conv.id, kind: conv.kind, again: !!stRef.current.done[conv.id] });
    const onHide = () => {
      if (document.visibilityState === 'hidden' && !track.current.done) stats.track('lesson_pause', { id: conv.id, kind: conv.kind, step: track.current.step, of: turns });
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (!track.current.done) stats.track('lesson_quit', { id: conv.id, kind: conv.kind, step: track.current.step, of: turns });
    };
  }, []);

  function finish() {
    // latest(): a phrase another tab put into memory meanwhile keeps its schedule.
    const cur = latest(stRef.current);
    const now = Date.now();
    const added = (conv.teaches || []).filter((id) => !cur.mem[id] && phrase(id));
    const first = !cur.done[conv.id];
    // A lesson done for the first time counts toward the day's goal; the one that reaches it closes the day.
    const before = doneToday(cur);
    const closed = first && before < goalOf(cur) && before + 1 >= goalOf(cur);
    update((d) => {
      if (!d.done[conv.id]) d.done[conv.id] = dayKey();
      d.days[dayKey()] = true;
      added.forEach((id) => { if (!d.mem[id]) d.mem[id] = fsrs.review(null, 2, now); });
    });
    track.current.done = true;
    stats.track('lesson_done', { id: conv.id, kind: conv.kind, first, closed, s: Math.round((now - track.current.t0) / 1000), typed: typed.current.n, clean: typed.current.clean, tp: stRef.current.settings.typing ? 1 : 0 });
    setLog(openAll);
    setResult({ added: added.length, typed: typed.current.n, clean: typed.current.clean, first, closed });
  }

  // Lines of the other person come one by one; while a rule is open the conversation waits.
  useEffect(() => {
    if (!step) {
      if (!result) finish();
      return undefined;
    }
    if (isTurn(step)) return undefined;
    if (sheet) {
      setTyping(false);
      return undefined;
    }
    let cancelled = false;
    const shown = shownPos.current === pos;
    const isNpc = step.npc !== undefined;
    if (isNpc && !shown) setTyping(true);
    const timer = setTimeout(async () => {
      if (!shown) {
        const cur = stRef.current;
        const msg = autoMsg(step, varsOf(cur), t);
        const heard = cur.settings.voice && !deafRef.current;
        if (isNpc && heard && ((conv.kind === 'listen' && !guided) || step.fast) && voice.canSay(msg.kk)) msg.hidden = true;
        shownPos.current = pos;
        setTyping(false);
        setLog((l) => [...l, msg]);
        // A fast line is said faster, its repeat (step.slow) slower.
        if (heard && isNpc) await voice.say(msg.kk, step.slow ? 0.6 : step.fast ? 1.25 : 0.92);
        if (cur.settings.voice && msg.k === 'sound') await voice.say(msg.words.map((w) => w[0]).join(', '));
      }
      if (!cancelled) setPos((p) => p + 1);
    }, shown ? 300 : isNpc ? (pos === 0 ? 450 : 850) : 380);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pos, sheet]);

  const toBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  useEffect(toBottom, [log.length, typing, pos, result, tr]);
  // The answer panel grows (the model answer, the meanings of a pair): keep the last line in view.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !composer.current) return undefined;
    const ro = new ResizeObserver(toBottom);
    ro.observe(composer.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setVoiceChecked(true), 1500);
    return () => {
      clearTimeout(id);
      voice.stop();
      mic.stopPlaying();
      recordings.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const advance = (msgs, opts = {}) => {
    // A second tap on the same spot must not answer the next step as well.
    if (Date.now() - lastTurn.current < 350) return;
    lastTurn.current = Date.now();
    const add = [...msgs];
    if (opts.rule && !stRef.current.rules[opts.rule]) add.push({ k: 'rule', rule: opts.rule, word: opts.word, ask: opts.ask });
    // Heard lines open after the question about them («Послушай»), elsewhere after the next reply.
    const open = conv.kind !== 'listen' || opts.checked;
    setLog((l) => {
      const next = [...(open ? openAll(l) : l), ...add];
      segStart.current = next.length;
      return next;
    });
    setPos((p) => p + 1);
  };

  const cantListen = () => {
    deafRef.current = true;
    setDeaf(true);
    voice.stop();
    setLog(openAll);
  };
  const showLine = (i) => setLog((l) => l.map((m, j) => (j === i && m.hidden ? { ...m, hidden: false } : m)));

  const openRule = (id) => {
    voice.stop();
    update((d) => { d.rules[id] = d.rules[id] || dayKey(); });
    setSheet(id);
  };

  // Bota explains a wrong answer in the chat; the same hint twice in a row is shown once.
  const hint = (text) => setLog((l) => (l.length && l[l.length - 1].k === 'tip' && l[l.length - 1].text === text ? l : [...l, { k: 'tip', text }]));

  const toggleLine = (i) => {
    setOpened((o) => ({ ...o, [i]: !o[i] }));
    if (!stRef.current.seen.trTap) update((d) => { d.seen.trTap = true; });
  };
  const firstLine = log.findIndex((m) => m.k === 'npc');
  // The meaning of a task (what to build, say or choose about yourself) is shown unless the lesson is «without hints».
  const task = tr || conv.kind !== 'free';
  // Typing replies and phrases instead of choosing them: one setting for the whole app («Профиль»).
  const typeMode = (on) => update((d) => { d.settings.typing = on; });

  let panel = null;
  if (result) {
    // The Kazakh lines of this lesson, for «Нашли неточность во фразе?»: lines of the course, not what
    // the learner typed.
    const said = [...new Set(log.filter((m) => m.kk && !m.typed).map((m) => m.kk))];
    panel = html`<${DonePanel} st=${st} update=${update} conv=${conv} ti=${ti} ci=${ci} result=${result} v=${v} go=${go} said=${said} back=${back} />`;
  } else if (step && isTurn(step) && !typing) {
    if (step.check) {
      // «Медленно» plays the lines of this question again; heard ones can be read instead for the rest.
      const listen = conv.kind === 'listen' && !deaf && voice.available();
      const lines = log.slice(segStart.current).filter((m) => m.k === 'npc' && voice.canSay(m.kk)).map((m) => m.kk);
      panel = html`<${CheckPanel} key=${pos} step=${step} listen=${conv.kind === 'listen'} auto=${st.settings.voice}
        slowly=${listen && lines.length ? () => { mic.stopPlaying(); voice.sayAll(lines, 0.6); } : null}
        onDeaf=${listen && st.settings.voice && !guided ? cantListen : null} onHint=${hint} onDone=${() => advance([], { checked: true })} />`;
    } else if (step.pick) {
      // In «Ответь» a reply can be typed instead of chosen: its meaning is the task (typeReply).
      const right = step.pick.find((o) => o.ok);
      const reply = (o) => advance([{ k: 'me', kk: val(o.kk, v), ru: val(o.ru, v) }], { rule: step.rule, word: step.word });
      const typeable = conv.kind === 'answer' && right && right.ru;
      panel = typeable && st.settings.typing
        ? html`<${TypePanel} key=${pos} step=${{ type: right.kk, ru: right.ru, alt: step.pick.filter((o) => o.ok && o !== right).map((o) => o.kk) }} v=${v} auto=${false}
            ask="ОТВЕТЬ ПО-КАЗАХСКИ" onHint=${hint} others=${[['Выбрать из вариантов', () => typeMode(false)]]} onDone=${() => reply(right)} />`
        : html`<${PickPanel} key=${pos} step=${step} v=${v} tr=${tr} onHint=${hint} onDone=${reply}
            more=${typeable ? [['Напечатать ответ', () => typeMode(true)]] : null} />`;
    } else if (step.choose) {
      panel = html`<${ChoosePanel} key=${pos} step=${step} v=${v} tr=${task}
        onDone=${(o) => {
          update((d) => { d.vars[step.choose] = o.val; });
          advance([{ k: 'me', kk: val(o.kk, v), ru: val(o.ru, v) }], { rule: step.rule, word: o.word || step.word, ask: step.ask });
        }} />`;
    } else if (step.build) {
      // A phrase can be typed instead of put together, wherever its meaning is shown (not «без подсказок»).
      const built = () => advance([{ k: 'me', kk: val(step.text, v), ru: val(step.ru, v) }], { rule: step.rule, word: step.word });
      const typeable = !!task;
      panel = typeable && st.settings.typing
        ? html`<${TypePanel} key=${pos} step=${{ type: step.text, ru: step.ru }} v=${v} auto=${false}
            ask="НАПИШИ ОТВЕТ" onHint=${hint} others=${[['Собрать из слов', () => typeMode(false)]]} onDone=${built} />`
        : html`<${BuildPanel} key=${pos} step=${step} v=${v} tr=${task} onHint=${hint}
            dragHint=${!st.seen.drag} onDragged=${() => { if (!stRef.current.seen.drag) update((d) => { d.seen.drag = true; }); }}
            more=${typeable ? [['Напечатать', () => typeMode(true)]] : null} onDone=${built} />`;
    } else if (step.say || step.own) {
      // An answer in one's own words goes to the chat as a voice message; Bota then shows the example.
      const own = !!step.own;
      panel = html`<${SayPanel} key=${pos} step=${step} v=${v} tr=${task} st=${st} recall=${conv.kind === 'speak'} own=${own} paused=${micPaused} onHint=${hint}
        onPause=${() => setMicPaused(true)} onResume=${() => setMicPaused(false)}
        onDone=${(res) => {
          if (res && res.url) recordings.current.push(res.url);
          const kk = val(own ? step.own : step.say, v);
          const said = { k: 'voice', own, kk, url: res && res.url, ms: res && res.ms, levels: res && res.levels };
          // The example may come with a rule chip, like the answer it was: «Почему «алдым»?».
          if (own) advance([said, { k: 'model', kk, ru: val(step.ru, v) }], { rule: step.rule, word: step.word });
          else advance([said]);
        }} />`;
    } else if (step.pair) {
      panel = html`<${PairPanel} key=${pos} step=${step} auto=${st.settings.voice} onHint=${hint} onDone=${(w) => advance([{ k: 'me', kk: w[0], ru: w[1] }])} />`;
    } else if (step.type) {
      panel = html`<${TypePanel} key=${pos} step=${step} v=${v} auto=${st.settings.voice} onHint=${hint}
        onDone=${(grade, message) => {
          typed.current.n += 1;
          if (grade === 3) typed.current.clean += 1;
          if (step.ph && stRef.current.mem[step.ph]) update((d) => { d.mem[step.ph] = fsrs.review(d.mem[step.ph], grade); });
          advance([{ k: 'me', kk: message, ru: val(step.ru, v), typed: true }]);
        }} />`;
    }
  }

  // «Послушай» with a reply of the learner's own («Қайталаңызшы!») counts steps, not questions.
  const turnWord = conv.kind === 'listen' ? (steps.some((s) => isTurn(s) && !s.check) ? 'шаг' : 'вопрос')
    : { pron: 'упражнение', write: 'сообщение' }[conv.kind] || 'твоя реплика';
  const label = result ? (isSkill(conv) ? 'урок окончен' : 'разговор окончен') : `${turnWord} ${Math.min(turnsDone + 1, turns)} из ${turns}`;
  const showNoVoice = voiceChecked && !voice.available() && !st.seen.noVoice;
  // Keyboard and screen reader users land on the new answer panel, not on the top of the page.
  const panelKey = result ? 'done' : panel ? pos : null;
  useEffect(() => {
    const box = composer.current;
    if (panelKey === null || !box || box.querySelector('input')) return;
    const first = box.querySelector('button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }, [panelKey]);

  return html`<main class="screen conv">
    <header class="conv-head pad">
      <button type="button" class="icon-btn" aria-label="Назад к теме" onClick=${() => go('topic', { ti, back })}><${Icon} name="back" size=${24} stroke=${2.2} /></button>
      <${Avatar} who=${t.who} size=${40} />
      <span class="conv-who"><b>${person.name}</b>
        <span class="conv-prog"><span class="dots" aria-hidden="true">${Array.from({ length: turns }, (_, i) => html`<i class=${i < turnsDone || result ? 'd' : i === turnsDone ? 'c' : ''}></i>`)}</span>${label}</span></span>
      <button type="button" class=${'tr-btn' + (tr ? ' on' : '')} aria-pressed=${tr} aria-label="Перевод на русский" onClick=${() => setTr(!tr)}>Ру</button>
    </header>
    <div class="scroll chat pad" ref=${scroller}>
      <div class="msgs" role="log" aria-live="polite">
        ${showNoVoice ? html`<div class="banner"><span>${SITE_BUILD && voice.waiting() ? 'Здесь фразы пока без звука: записи не загрузились. Проверь интернет — звук появится сам.'
          : html`Здесь фразы пока без звука: в этом браузере нет казахского голоса. Со звуком они работают <a href=${SITE} target="_blank" rel="noopener">в Боте по ссылке</a> и в Microsoft Edge.`}</span>
          <button type="button" class="btn-chip" onClick=${() => update((d) => { d.seen.noVoice = true; })}>Понятно</button></div>` : null}
        <span class="conv-kind">${KINDS[conv.kind].label} · ${conv.title}</span>
        ${log.map((m, i) => html`<${Msg} key=${i} m=${m} tr=${tr || !!opened[i]} all=${tr} hint=${i === firstLine && !tr && !st.seen.trTap}
          topic=${t} onRule=${openRule} onTr=${() => toggleLine(i)} onShow=${() => showLine(i)} />`)}
        ${typing ? html`<div class="m-row left"><div class="b b-npc typing" aria-label="печатает"><i></i><i></i><i></i></div></div>` : null}
      </div>
    </div>
    <div class=${'composer pad' + (result ? ' ended' : '')} ref=${composer} hidden=${!panel}>${panel}</div>
    ${sheet ? html`<${RuleSheet} id=${sheet} onClose=${() => setSheet(null)} />` : null}
  </main>`;
}

/* ---------- рубежи and the entrance test ---------- */

// The blocks of КАЗТЕСТ a result is told by (BLOCK in exam.js).
const BLOCKS = [['listen', 'Слушать'], ['read', 'Читать'], ['write', 'Писать'], ['speak', 'Говорить']];
// In a test every line shows its speaker: the people of several topics take part.
const NOBODY = { who: '' };

// The end of a test: how it went and the one next step. A рубеж not taken offers the memory first —
// what was not right is due there today — and another try; the way on is open either way.
function TestDone({ st, go, cp, res }) {
  const nx = nextUp(st);
  const toNext = () => (nx ? goStep(go, nx) : go('home'));
  const home = ['В «Мой круг»', () => go('home')];
  if (res.place) {
    const known = PLAYABLE.filter((t) => topicKnown(st, t)).length;
    const anew = !known && !Object.keys(st.done).length;
    const head = !nx ? 'Ты знаешь все темы курса!' : anew ? 'Начнём с самого начала'
      : nx.cp ? `Дальше — ${nx.cp.final ? 'итог круга' : 'рубеж'}` : `Твой старт — «${nx.t.title}»`;
    const sub = !nx ? `Открыты все ${PLAYABLE.length} ${plural(PLAYABLE.length, TOPIC_W)}` : anew ? 'Первая тема — «Приветствия», с Әже'
      : `${known ? `Знакомо ${known} ${plural(known, TOPIC_W)}` : 'Знакомых тем пока нет'} · круг «${levelOf(nx.t.level).title}»`;
    const label = !nx ? 'Вернуться в «Мой круг»' : anew ? 'Начать первый разговор'
      : nx.cp ? (nx.cp.final ? 'Начать итог круга' : 'Начать рубеж') : `Начать: ${nx.t.title}`;
    return html`<div class="panel-in done">
      <div class="done-head"><${Bota} size=${44} />
        <span class="grow"><b class="h3">${head}</b><span class="gold-text sm">${sub}</span></span></div>
      <span class="mem-note"><${Icon} name="gate" size=${20} />${known ? `Знакомые темы открыты вместе с бәйге, а их фразы будут приходить в память — по ${FEED_N} в день.`
        : 'Темы идут по порядку, а после каждых 3–4 — рубеж.'}</span>
      <button type="button" class="btn btn-primary btn-block" onClick=${toNext}>${label}</button>
      <${LinkRow} items=${[nx && home]} />
    </div>`;
  }
  const lv = levelOf(cp.level);
  const due = dueList(st).length;
  const streak = streakOf(st.days);
  const head = res.pass ? (cp.final ? (topicsOnly(lv) ? `Итог тем уровня ${lv.id} взят!` : `Круг «${lv.title}» пройден!`) : 'Рубеж взят!') : `Пока ${res.ok} из ${res.n}`;
  const sub = res.pass ? `${res.ok} из ${res.n} верно` : cp.final ? `Круг закроется от ${need(res.n)} из ${res.n}`
    : `Рубеж — от ${need(res.n)} из ${res.n}; темы дальше уже открыты`;
  const onward = !nx ? 'Вернуться в «Мой круг»' : nx.t.level !== cp.level ? `Новый круг: «${levelOf(nx.t.level).title}»` : stepLabel(nx, -1);
  const again = ['Пройти ещё раз', () => go('test', { id: cp.id, k: Date.now() })];
  const main = !res.pass && due ? ['Освежить память', () => go('review')] : [onward, toNext];
  const links = res.pass ? [nx && home] : [again, due ? (nx ? [onward, toNext] : home) : nx && home];
  return html`<div class="panel-in done">
    <div class="done-head"><span class=${'cp-big' + (res.pass ? ' pass' : '')}><${Icon} name=${res.pass ? 'check' : 'gate'} size=${22} stroke=${res.pass ? 3.4 : 2} /></span>
      <span class="grow"><b class="h3">${head}</b><span class="gold-text sm">${sub}</span>
        ${res.closed ? html`<span class="gold-text sm">Цель дня выполнена · серия ${streak} ${plural(streak, DAY_W)}</span>` : null}</span></div>
    ${cp.final ? html`<div class="blocks"><span class="eyebrow">ПО БЛОКАМ КАЗТЕСТ</span>
      ${BLOCKS.filter(([b]) => res.blocks[b]).map(([b, label]) => html`<span class="block-row"><span>${label}${b === 'speak'
        ? html`<span class="muted sm"> · по самооценке</span>` : null}</span><b>${res.blocks[b][0]} из ${res.blocks[b][1]}</b></span>`)}</div>` : null}
    ${res.missed ? html`<span class="mem-note"><${Icon} name="ornament" size=${20} />${res.missed} ${plural(res.missed, PHR_W)} — в памяти, освежим сегодня</span>`
      : res.ok === res.n ? html`<span class="mem-note"><${Icon} name="ornament" size=${20} />Ни одной ошибки!</span>` : null}
    <button type="button" class="btn btn-primary btn-block" onClick=${main[1]}>${main[0]}</button>
    <${LinkRow} items=${links} />
  </div>`;
}

// A рубеж, an итог круга or the entrance test (id 'place'): a chat with the people of the course,
// without translation. The questions are steps of the lessons (mvp/exam.js), one answer each. A рубеж
// counts the right answers, brings back to the memory what was not right and is taken at 70%. The
// entrance test asks up to three questions about one stretch of topics after another — two right go on,
// two wrong stop it — and the stretches before the one it stops at become known.
function TestScreen({ st, update, go, id, back }) {
  const place = id === 'place';
  const cp = place ? null : cpById(id);
  const lv = cp ? levelOf(cp.level) : null;
  // The entrance test starts at the first stretch not passed yet.
  const [first] = useState(() => Math.max(0, CHECKS.findIndex((x) => !cpState(st, x).pass)));
  const [items, setItems] = useState(() => (place ? placeItems(first) : checkItems(cp)));
  const [idx, setIdx] = useState(0);
  const [line, setLine] = useState(0);
  // lines → ask → (self: check a phrase said aloud against the sample) → the next question
  const [phase, setPhase] = useState('lines');
  const [log, setLog] = useState(() => {
    const n = items.length;
    const hello = place ? 'Проверим, что ты уже знаешь: вопросы будут всё сложнее. Не уверен(а) — нажми «Не знаю», так тест точнее.'
      : cp.final ? `Итог круга: ${n} ${plural(n, Q_W)} по всем его темам — слушать, читать, писать и говорить, как в блоках КАЗТЕСТ. Без перевода и подсказок.`
        : `Рубеж: ${n} ${plural(n, Q_W)} от тех, с кем ты уже говорил(а). Без перевода и подсказок — фразы, которые не вспомнятся, вернутся в память.`;
    return [{ k: 'tip', text: hello }, ...(items.length ? [{ k: 'note', text: TOPIC_BY_ID.get(items[0].topic).title }] : [])];
  });
  const [typing, setTyping] = useState(false);
  const [result, setResult] = useState(null);
  const [micPaused, setMicPaused] = useState(false);
  const [deaf, setDeaf] = useState(false);
  // The phrase said aloud, shown to check oneself against: { kk, gaveUp }.
  const [said, setSaid] = useState(null);
  const deafRef = useRef(false);
  // The lines of this question came as voice messages: a question about them is listening.
  const heard = useRef(false);
  const marks = useRef([]);
  const recordings = useRef([]);
  const scroller = useRef(null);
  const composer = useRef(null);
  const lastTurn = useRef(0);
  const t0 = useRef(Date.now());
  const over = useRef(false);
  const stRef = useRef(st);
  stRef.current = st;
  const it = items[idx];
  const v = varsOf(st);
  // The stretch of the entrance test asked now: the ones before it are passed.
  const segNow = useRef(first);
  if (place && it) segNow.current = it.seg;

  // The stretches before «at» are known: passed by the test (by: 'test' when never tried).
  const keepPlace = (at) => update((d) => {
    CHECKS.slice(0, at).forEach((x) => {
      const w = d.checks[x.id] || {};
      if (!w.pass) d.checks[x.id] = { ...w, pass: dayKey(), by: w.day ? '' : 'test' };
    });
    d.place = { ...d.place, day: dayKey(), at };
    d.days[dayKey()] = true;
  });

  useEffect(() => {
    stats.track('test', { id, kind: place ? 'place' : cp.final ? 'final' : 'check' });
    return () => {
      voice.stop();
      mic.stopPlaying();
      recordings.current.forEach((url) => URL.revokeObjectURL(url));
      if (!over.current) {
        stats.track('test_quit', { id, at: marks.current.length });
        // Left halfway, the entrance test keeps what it found so far.
        if (place && segNow.current > first) keepPlace(segNow.current);
      }
    };
  }, []);

  // The lines of a question come one by one; a heard question («Послушай») brings them as voice messages.
  useEffect(() => {
    if (result || phase !== 'lines' || !it) return undefined;
    if (line >= it.ctx.length) {
      setPhase('ask');
      return undefined;
    }
    let cancelled = false;
    setTyping(true);
    const timer = setTimeout(async () => {
      const cur = stRef.current;
      const s = it.ctx[line];
      const msg = { k: 'npc', who: s.who || it.who, kk: val(s.npc, varsOf(cur)) };
      // The entrance test voices only what is to be heard: the rest is read, so it stays short.
      const sound = cur.settings.voice && !deafRef.current && voice.canSay(msg.kk) && (!place || it.kind === 'listen');
      if (it.kind === 'listen' && sound) {
        msg.hidden = true;
        heard.current = true;
      }
      setTyping(false);
      setLog((l) => [...l, msg]);
      if (sound) await voice.say(msg.kk, 0.92);
      if (!cancelled) setLine((n) => n + 1);
    }, place ? 500 : line === 0 ? 700 : 900);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [idx, line, phase, result]);

  const toBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  useEffect(toBottom, [log.length, typing, phase, result]);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !composer.current) return undefined;
    const ro = new ResizeObserver(toBottom);
    ro.observe(composer.current);
    return () => ro.disconnect();
  }, []);
  const panelKey = result ? 'done' : phase === 'lines' ? null : `${idx}-${phase}`;
  useEffect(() => {
    const box = composer.current;
    if (panelKey === null || !box || box.querySelector('input')) return;
    const btn = box.querySelector('button:not([disabled])');
    if (btn) btn.focus({ preventScroll: true });
  }, [panelKey]);

  const openAll = (l) => (l.some((m) => m.hidden) ? l.map((m) => (m.hidden ? { ...m, hidden: false } : m)) : l);
  const hint = (text) => setLog((l) => (l.length && l[l.length - 1].k === 'tip' && l[l.length - 1].text === text ? l : [...l, { k: 'tip', text }]));
  const showLine = (i) => setLog((l) => l.map((m, j) => (j === i && m.hidden ? { ...m, hidden: false } : m)));
  const cantListen = () => {
    deafRef.current = true;
    heard.current = false;
    setDeaf(true);
    voice.stop();
    setLog(openAll);
  };

  function finishCheck() {
    const all = marks.current;
    const n = all.length;
    const ok = all.filter((m) => m.ok).length;
    const pass = passes(ok, n);
    const cur = latest(stRef.current);
    const was = cur.checks[cp.id] || {};
    const firstTime = !was.day;
    const before = doneToday(cur);
    const closed = firstTime && before < goalOf(cur) && before + 1 >= goalOf(cur);
    // What was not right comes back to the memory as a lapse, due at once: «Освежить память» right
    // after the рубеж asks it.
    const missed = [...new Set(all.filter((m) => !m.ok && m.ph).map((m) => m.ph))];
    const blocks = Object.fromEntries(BLOCKS.map(([b]) => [b, [all.filter((m) => m.block === b && m.ok).length, all.filter((m) => m.block === b).length]]).filter(([, [, of]]) => of));
    const now = Date.now();
    update((d) => {
      const w = d.checks[cp.id] || {};
      d.checks[cp.id] = { ...w, day: w.day || dayKey(), pass: w.pass || (pass ? dayKey() : ''), by: '', ok, of: n, best: Math.max(w.best || 0, ok / n), n: (w.n || 0) + 1, blocks };
      d.days[dayKey()] = true;
      missed.forEach((ph) => { d.mem[ph] = { ...fsrs.review(d.mem[ph] || null, 1, now), due: now }; });
    });
    over.current = true;
    stats.track('test_done', { id: cp.id, kind: cp.final ? 'final' : 'check', n, ok, pass, first: firstTime, closed, s: Math.round((now - t0.current) / 1000),
      ...Object.fromEntries(Object.entries(blocks).map(([b, [r, of]]) => [b, `${r}/${of}`])) });
    setLog(openAll);
    setResult({ ok, n, pass, closed, missed: missed.length, blocks });
  }

  function finishPlace(at) {
    const all = marks.current;
    keepPlace(at);
    over.current = true;
    // start — the first topic of the stretch the learner starts at (end — the whole course is known).
    stats.track('test_done', { id: 'place', kind: 'place', from: first, at, start: at < CHECKS.length ? CHECKS[at].topics[0] : 'end',
      n: all.length, ok: all.filter((m) => m.ok).length, s: Math.round((Date.now() - t0.current) / 1000) });
    setLog(openAll);
    setResult({ place: true, at });
  }

  // One answer per question; then the next question, the next stretch of the entrance test, or the end.
  const answered = (ok, add = []) => {
    if (Date.now() - lastTurn.current < 350) return;
    lastTurn.current = Date.now();
    const block = it.kind === 'listen' && !heard.current ? 'read' : BLOCK[it.kind];
    marks.current = [...marks.current, { ok, block, ph: it.ph, seg: it.seg }];
    setLog((l) => [...openAll(l), ...add]);
    setSaid(null);
    let list = items;
    if (place) {
      // A stretch is decided as soon as it can be: two right — on to the next one, two wrong — the end.
      // The third question comes only when the first two disagree.
      const mine = marks.current.filter((m) => m.seg === it.seg);
      const right = mine.filter((m) => m.ok).length;
      const passed = right >= PLACE_PASS;
      if (passed || mine.length - right > PLACE_ASK - PLACE_PASS || idx + 1 >= list.length) {
        if (!passed || it.seg + 1 >= CHECKS.length) {
          finishPlace(passed ? it.seg + 1 : it.seg);
          return;
        }
        list = [...list.slice(0, idx + 1), ...placeItems(it.seg + 1)];
        setItems(list);
      }
    } else if (idx + 1 >= list.length) {
      finishCheck();
      return;
    }
    const nextIt = list[idx + 1];
    if (nextIt.topic !== it.topic) setLog((l) => [...l, { k: 'note', text: TOPIC_BY_ID.get(nextIt.topic).title }]);
    heard.current = false;
    setIdx(idx + 1);
    setLine(0);
    setPhase('lines');
  };

  let panel = null;
  if (result) {
    panel = html`<${TestDone} st=${st} go=${go} cp=${cp} res=${result} />`;
  } else if (phase === 'self' && said) {
    panel = html`<div class="panel-in">
      <span class="eyebrow">${said.gaveUp ? 'ВОТ КАК ЭТО СКАЗАТЬ' : 'СВЕРЬ С ОБРАЗЦОМ'}</span>
      <div class="say-card"><span class="say-kk own" lang="kk">${said.kk}</span>
        ${voice.canSay(said.kk) ? html`<div class="say-ctl"><button type="button" class="ctl" onClick=${() => { mic.stopPlaying(); voice.speak(said.kk); }}>
          <${SpeakerGlyph} size=${16} /> Послушать</button></div>` : null}</div>
      ${said.gaveUp ? html`<button type="button" class="btn btn-primary btn-block" onClick=${() => answered(false)}>Дальше</button>`
        : html`<div class="grades" role="group" aria-label="Получилось ли сказать">
          <button type="button" class="grade" onClick=${() => answered(false)}><b>Не вспомнил(а)</b></button>
          <button type="button" class="grade" onClick=${() => answered(true)}><b>Сказал(а) так же</b></button></div>`}
    </div>`;
  } else if (phase === 'ask' && !typing && it) {
    const s = it.step;
    if (it.kind === 'listen' || it.kind === 'ask') {
      const lines = heard.current ? it.ctx.map((x) => val(x.npc, v)).filter((x) => voice.canSay(x)) : [];
      panel = html`<${CheckPanel} key=${idx} step=${s} test listen=${it.kind === 'listen'} auto=${st.settings.voice} onHint=${hint}
        slowly=${lines.length ? () => { mic.stopPlaying(); voice.sayAll(lines, 0.6); } : null}
        onDeaf=${heard.current && !deaf ? cantListen : null}
        onDone=${(ok) => answered(ok, ok && it.kind === 'ask' ? [{ k: 'me', kk: val((s.opts.find((o) => o.ok) || {}).t, v) }] : [])} />`;
    } else if (it.kind === 'pick') {
      panel = html`<${PickPanel} key=${idx} step=${s} v=${v} tr=${false} test onHint=${hint}
        onDone=${(o, ok) => answered(ok, ok ? [{ k: 'me', kk: val(o.kk, v) }] : [])} />`;
    } else if (it.kind === 'build') {
      panel = html`<${BuildPanel} key=${idx} step=${s} v=${v} tr test onHint=${hint}
        dragHint=${!st.seen.drag} onDragged=${() => { if (!stRef.current.seen.drag) update((d) => { d.seen.drag = true; }); }}
        onDone=${(ok) => answered(ok, ok ? [{ k: 'me', kk: val(s.text, v) }] : [])} />`;
    } else if (it.kind === 'write') {
      panel = html`<${TypePanel} key=${idx} step=${s} v=${v} auto=${st.settings.voice} test onHint=${hint}
        onDone=${(grade, message, ok) => answered(ok, ok ? [{ k: 'me', kk: message }] : [])} />`;
    } else {
      const kk = val(s.say, v);
      panel = html`<${SayPanel} key=${idx} step=${s} v=${v} tr st=${st} recall blind paused=${micPaused} onHint=${hint}
        onPause=${() => setMicPaused(true)} onResume=${() => setMicPaused(false)}
        onGiveUp=${() => { setSaid({ kk, gaveUp: true }); setPhase('self'); }}
        onDone=${(res) => {
          if (res && res.url) recordings.current.push(res.url);
          setLog((l) => [...l, { k: 'voice', kk, url: res && res.url, ms: res && res.ms, levels: res && res.levels }]);
          setSaid({ kk });
          setPhase('self');
        }} />`;
    }
  }

  const title = place ? 'Входной тест' : cp.final ? `Итог круга «${lv.title}»` : 'Рубеж';
  const at = it || items[items.length - 1];
  const label = result ? 'готово' : place ? `${at ? CHECKS[at.seg].level : ''} · вопрос ${idx + 1}` : `вопрос ${Math.min(idx + 1, items.length)} из ${items.length}`;
  const kind = place ? 'Входной тест · до 7 минут' : cp.final ? `Итог круга · ${topicsOnly(lv) ? `темы ${lv.id}` : lv.id}` : `Рубеж · ${lv.id} · ${cp.topics.length} ${plural(cp.topics.length, TOPIC_W)}`;
  return html`<main class="screen conv">
    <header class="conv-head pad">
      <button type="button" class="icon-btn" aria-label="Выйти" onClick=${() => go(back || 'home')}><${Icon} name="back" size=${24} stroke=${2.2} /></button>
      ${place ? html`<${Bota} size=${40} />` : html`<span class="test-ic"><${Icon} name="gate" size=${20} /></span>`}
      <span class="conv-who"><b>${title}</b><span class="conv-prog">${label}</span></span>
    </header>
    <div class="scroll chat pad" ref=${scroller}>
      <div class="msgs" role="log" aria-live="polite">
        <span class="conv-kind">${kind}</span>
        ${log.map((m, i) => html`<${Msg} key=${i} m=${m} tr=${false} all=${false} topic=${NOBODY} onShow=${() => showLine(i)} />`)}
        ${typing ? html`<div class="m-row left"><div class="b b-npc typing" aria-label="печатает"><i></i><i></i><i></i></div></div>` : null}
      </div>
    </div>
    <div class=${'composer pad' + (result ? ' ended' : '')} ref=${composer} hidden=${!panel}>${panel}</div>
  </main>`;
}

/* ---------- optional rules ---------- */

function SuffixGame() {
  const [p1, setP1] = useState(null);
  const [p2, setP2] = useState(null);
  const hard = { 'тар': true, 'ым': true };
  const ok1 = p1 === 'тар';
  const ok2 = p2 === 'ым';
  let line = 'дос — друг';
  let tone = 'plain';
  if (p1 && !ok1) { line = 'Почти. «-тер» — мягкое, а «о» в «дос» твёрдая.'; tone = 'bad'; }
  else if (ok1 && p2 && !ok2) { line = 'Почти. «-ім» — мягкое, а слово твёрдое.'; tone = 'bad'; }
  else if (ok1 && ok2) { line = 'Дұрыс! достарым — мои друзья'; tone = 'good'; }
  else if (ok1) line = 'достар — друзья';
  const slot = (x) => html`<span class=${'slot ' + (!x ? 'empty' : hard[x] ? 'hard' : 'soft')}>${x || '?'}</span>`;
  const opt = (x, sel, enabled, on) => html`<button type="button" class=${'sfx ' + (hard[x] ? 'hard' : 'soft') + (sel ? ' sel' : '')}
    disabled=${!enabled} aria-pressed=${sel} onClick=${on}>-${x}</button>`;
  return html`<div class="game">
    <div class="word" aria-live="polite"><span class="slot root">д<span class="vowel">о</span>с</span>${slot(p1)}${slot(p2)}</div>
    <span class=${'game-line ' + tone}>${line}</span>
    <div class="game-row"><span class="grow">Сделай «друзья»</span>
      ${opt('тар', p1 === 'тар', true, () => { setP1('тар'); setP2(null); })}${opt('тер', p1 === 'тер', true, () => { setP1('тер'); setP2(null); })}</div>
    <div class=${'game-row' + (ok1 ? '' : ' off')}><span class="grow">Теперь «мои друзья»</span>
      ${opt('ім', p2 === 'ім', ok1, () => setP2('ім'))}${opt('ым', p2 === 'ым', ok1, () => setP2('ым'))}</div>
    <div class="legend"><span><i class="lg hard"></i>твёрдые: а о ұ ы</span><span><i class="lg soft"></i>мягкие: ә ө ү і е</span></div>
  </div>`;
}

function RuleBody({ r }) {
  return html`<div class="rule-body">
    <p>${r.text}</p>
    <div class="rule-ex">${r.examples.map(([kk, ru]) => html`<div class="ex-row"><span class="grow"><b class="kk" lang="kk">${kk}</b><span class="muted sm">${ru}</span></span><${SpeakBtn} text=${kk} small /></div>`)}</div>
    ${r.game ? html`<${SuffixGame} />` : null}
  </div>`;
}

// Focus moves into the sheet, stays there while it is open and returns to the chip that opened it.
function RuleSheet({ id, onClose }) {
  const r = RULES.find((x) => x.id === id);
  const box = useRef(null);
  useSheet(box, onClose);
  if (!r) return null;
  return html`<div class="sheet-back" onClick=${onClose}>
    <div class="sheet pad" ref=${box} role="dialog" aria-modal="true" aria-label=${r.title} onClick=${(e) => e.stopPropagation()}>
      <span class="sheet-grip" aria-hidden="true"></span>
      <span class="eyebrow">ПРАВИЛО ЗА 30 СЕКУНД · ПО ЖЕЛАНИЮ</span>
      <h2 class="h2" tabindex="-1">${r.title}</h2>
      <${RuleBody} r=${r} />
      <button type="button" class="btn btn-primary btn-block" onClick=${onClose}>Вернуться к разговору</button>
    </div>
  </div>`;
}

function RulesScreen({ st, update, go, back }) {
  const [open, setOpen] = useState(null);
  const levels = ['A1', 'A2', 'B1', 'B2'];
  const toggle = (id) => {
    const next = open === id ? null : id;
    setOpen(next);
    if (next) update((d) => { d.rules[id] = d.rules[id] || dayKey(); });
  };
  return html`<main class="screen">
    <${TopBar} title="Как устроен казахский" sub="по желанию · каждое правило — 30 секунд" onBack=${() => go(back || 'phrasebook')} backLabel="Назад" />
    <div class="scroll pad rules">
      <p class="muted sm intro">Можно не читать: говорить ты научишься и в разговорах. Правила — для тех, кому интересно «почему».</p>
      ${levels.map((lv) => html`<section class="rules-group">
        <span class="eyebrow">${lv}</span>
        <div class="list">${RULES.filter((r) => r.level === lv).map((r) => html`<div class=${'rule-row' + (open === r.id ? ' open' : '')}>
          <button type="button" class="rule-head" aria-expanded=${open === r.id} onClick=${() => toggle(r.id)}>
            <span class="grow"><b>${r.title}</b><span class="muted sm kk" lang="kk">${r.ex}</span></span>
            ${st.rules[r.id] ? html`<span class="seen" aria-label="прочитано"><${Icon} name="check" size=${14} stroke=${3} /></span>` : null}
            <span class="chev"><${Icon} name="down" size=${20} stroke=${2.2} /></span>
          </button>
          ${open === r.id ? html`<${RuleBody} r=${r} />` : null}
        </div>`)}</div>
      </section>`)}
    </div>
  </main>`;
}

/* ---------- memory review (FSRS) ---------- */

// The level of a course phrase is the level of the first lesson that teaches it.
const PHRASE_LEVEL = {};
TOPICS.forEach((t) => (t.convs || []).forEach((c) => (c.teaches || []).forEach((id) => { PHRASE_LEVEL[id] = PHRASE_LEVEL[id] || t.level; })));

// How it went, in the four grades of FSRS; each button says when the card comes back. «Легко» comes
// from the second review of a phrase on: right after the lesson it is too early to tell.
const GRADES = [[1, 'Не вспомнил(а)'], [2, 'С трудом'], [3, 'Вспомнил(а)'], [4, 'Легко']];
// A phrase not recalled comes once more at the end of the same review: a few cards later it is
// recalled, not only read. That second time changes nothing in its schedule — it is due tomorrow
// anyway — so two answers are enough.
const AGAIN_GRADES = [[1, 'Не вспомнил(а)'], [3, 'Вспомнил(а)']];
const gradesFor = (card, again) => (again ? AGAIN_GRADES : card && card.reps >= 2 ? GRADES : GRADES.slice(0, 3));

// Recall, then check yourself: the meaning comes first, the learner says the phrase (aloud or to
// themselves), opens the answer and rates how it went. Picking one of three options would only
// test recognition, and a few lucky guesses sent a phrase away for months.
// only: 'baby' — the phrases of «Малыш» alone, from its screen; back: the screen to go back to.
function Review({ st, update, go, only, back }) {
  const [queue, setQueue] = useState(() => dueList(st).filter((id) => only !== 'baby' || isBaby(id)).slice(0, REVIEW_N));
  // The cards of this review; the ones after them in the queue come again (AGAIN_GRADES).
  const [size] = useState(queue.length);
  const home = back || 'home';
  const forBaby = home === 'baby';
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [okCount, setOkCount] = useState(0);
  // This review reached the day's goal.
  const [closed, setClosed] = useState(false);
  const lastTap = useRef(0);
  const bottom = useRef(null);
  // For the statistics: how many cards got each grade, how many were words of «Бәйге», and how many
  // of those that came again were recalled then.
  const grades = useRef([0, 0, 0, 0, 0, 0]);
  const id = queue[i];
  const again = i >= size;
  const v = varsOf(st);
  // Typing the answer (settings.typing): the field, what was typed and whether it was right.
  const typingOn = !!st.settings.typing;
  const typeMode = (on) => update((d) => { d.settings.typing = on; });
  const [typeText, setTypeText] = useState('');
  const [typedAns, setTypedAns] = useState(null);
  const typeInput = useRef(null);
  // Keyboard users stay on the buttons of the moment: «Показать ответ», then the grades. Not on the
  // first card, which the page has only just opened with. Typing, the field of each card takes the focus.
  useEffect(() => {
    if (typingOn && !open) {
      try { if (typeInput.current) typeInput.current.focus({ preventScroll: true }); } catch (e) { /* focus is a convenience */ }
      return;
    }
    if (i === 0 && !open) return;
    const first = bottom.current && bottom.current.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }, [i, open, typingOn]);
  const head = html`<${TopBar} title="Освежить память" sub=${queue.length && i < queue.length ? `${i + 1} из ${queue.length}` : 'орнамент памяти'}
    onBack=${() => go(home)} backLabel=${forBaby ? 'Назад к малышу' : 'Вернуться в «Мой круг»'} />`;

  if (!queue.length || i >= queue.length) {
    const nd = nextDue(st);
    const nx = nextUp(st);
    const toNext = () => goStep(go, nx);
    const links = (items) => html`<span class="done-links">${items.filter(Boolean).map(([label, on], k) => html`${k ? html`<span aria-hidden="true">·</span>` : null}<button type="button" class="link-btn" onClick=${on}>${label}</button>`)}</span>`;
    const lessonLabel = (x) => (x.cp ? (x.cp.final ? 'Начать итог круга' : 'Начать рубеж') : isSkill(x.c) ? 'Начать урок' : 'Продолжить разговор');
    if (closed) {
      const now = new Date();
      return html`<main class="screen">${head}
        <div class="scroll pad review-end">
          <${Shanyrak} year=${now.getFullYear()} month=${now.getMonth()} days=${st.days} today=${now.getDate()} size=${104} fresh />
          <b class="h2">Цель дня выполнена!</b>
          <span class="gold-text sm">Серия ${streakOf(st.days)} ${plural(streakOf(st.days), DAY_W)}: в шаңыраке новая жердь-уық</span>
          <span class="muted">Освежили ${cardsText(queue.slice(0, size), true)}: вспомнил(а) ${okCount} из ${size}</span>
          <${Tomorrow} st=${st} />
          <${RemindRow} st=${st} update=${update} />
        </div>
        <div class="bottom pad"><button type="button" class="btn btn-primary btn-block" onClick=${() => go(home)}>Готово на сегодня</button>
          ${nx && !forBaby ? links([['Ещё урок', toNext]]) : null}</div>
      </main>`;
    }
    // While more than a review's worth waits, the memory goes on before new lessons (memLeads).
    const waiting = !forBaby && size ? dueList(st) : [];
    const more = waiting.length > REVIEW_N;
    // After the memory, the next lesson: the day began with the review, the lesson goes on from it.
    const onward = !forBaby && size && nx;
    return html`<main class="screen">${head}
      <div class="scroll pad review-end">
        <span class="orn-big"><${Icon} name="ornament" size=${56} stroke=${1.6} /></span>
        <b class="h2">${size ? `Освежили ${cardsText(queue.slice(0, size), true)}` : 'Всё свежее'}</b>
        ${size ? html`<span class="muted">Вспомнил(а): ${okCount} из ${size}</span>` : null}
        ${more ? html`<span class="muted">Ещё ${cardsText(waiting)} ${agree(waiting, 'ждёт', 'ждут')} повторения — освежим их до новых фраз</span>`
          : nd ? html`<span class="muted">Следующее повторение — ${whenText(nd)}</span>`
          : html`<span class="muted">${forBaby ? 'Подготовьтесь к ритуалу — и его фразы попадут в память.' : 'Пройди разговор — и фразы попадут в память.'}</span>`}
        ${onward && !more ? html`<span class="muted sm">Дальше: ${nx.cp || nx.c.kind === 'pron' ? lc(nextTitle(nx)) : nextTitle(nx)}</span>` : null}
      </div>
      <div class="bottom pad">${more
        ? html`<button type="button" class="btn btn-primary btn-block" onClick=${() => go('review', { k: Date.now(), back })}>Освежить ещё ${REVIEW_N}</button>
          ${links([nx && [skipLabel(nx), toNext], ['В «Мой круг»', () => go('home')]])}`
        : onward
        ? html`<button type="button" class="btn btn-primary btn-block" onClick=${toNext}>${lessonLabel(nx)}</button>
          ${links([['В «Мой круг»', () => go('home')]])}`
        : html`<button type="button" class="btn btn-primary btn-block" onClick=${() => go(home)}>${forBaby ? 'Готово' : 'Вернуться в «Мой круг»'}</button>`}</div>
    </main>`;
  }

  const ph = phrase(id);
  const right = fill(ph.kk, v);
  const reveal = () => {
    setOpen(true);
    if (st.settings.voice) voice.speak(right);
  };
  // A typed answer opens the card too; the learner still rates how it went.
  const sendTyped = (e) => {
    e.preventDefault();
    const text = typeText.replace(/\s+/g, ' ').trim();
    if (!normType(text)) return;
    setTypedAns({ text: cap(text), ok: checkTyped(text, [right]).ok });
    reveal();
  };
  const rate = (g) => {
    // A second tap on the same spot must not rate the next card as well.
    if (Date.now() - lastTap.current < 350) return;
    lastTap.current = Date.now();
    // Not recalled the first time: once more at the end of this review.
    const next = !again && g === 1 ? [...queue, id] : queue;
    // The review counts toward the day's goal once its last card is rated.
    const last = i === next.length - 1;
    const cur = latest(st);
    const before = doneToday(cur);
    update((d) => {
      if (!again) d.mem[id] = fsrs.review(d.mem[id], g);
      d.days[dayKey()] = true;
      if (last) d.reviews[dayKey()] = (d.reviews[dayKey()] || 0) + 1;
    });
    // «С трудом» is remembered too: only «Не вспомнил(а)» is a lapse for FSRS.
    if (!again && g >= 2) setOkCount((n) => n + 1);
    const closes = last && before < goalOf(cur) && before + 1 >= goalOf(cur);
    if (closes) setClosed(true);
    if (!again) grades.current[g - 1] += 1;
    if (!again && isWord(id)) grades.current[4] += 1;
    if (again && g >= 2) grades.current[5] += 1;
    if (last) {
      const [g1, g2, g3, g4, words, later] = grades.current;
      stats.track('review_done', { n: size, words, g1, g2, g3, g4, again: next.length - size, later, closed: closes, tp: typingOn ? 1 : 0 });
    }
    if (next !== queue) setQueue(next);
    voice.stop();
    setOpen(false);
    setTypeText('');
    setTypedAns(null);
    setI(i + 1);
  };
  const card = st.mem[id];
  // The second time the phrase stays due tomorrow, whatever the answer.
  const when = (g) => whenText(again && card ? card.due : fsrs.review(card, g).due);
  const choices = gradesFor(card, again);
  const ask = isWord(id) ? 'КАК ЭТО ПО-КАЗАХСКИ?' : isBaby(id) ? 'КАК СКАЗАТЬ МАЛЫШУ?' : 'КАК СКАЗАТЬ ПО-КАЗАХСКИ?';
  return html`<main class="screen">${head}
    <div class="scroll pad review">
      <div class="rev-card">
        <span class="eyebrow">${again ? `ЕЩЁ РАЗ · ${ask}` : ask}</span>
        <b class="rev-ru">${fill(ph.ru, v)}</b>
        ${open ? html`<span class="rev-kk"><b lang="kk">${right}</b><${SpeakBtn} text=${right} /></span>` : null}
      </div>
      ${open && typedAns ? html`<span class=${'rev-typed' + (typedAns.ok ? ' ok' : '')} lang="kk">${typedAns.ok ? 'Верно: ' : 'Ты написал(а): '}${typedAns.text}</span>` : null}
      <p class="muted sm center" role="status">${open ? (typedAns && !typedAns.ok ? 'Сверь с ответом. Как вспомнилось?' : 'Как вспомнилось?')
        : typingOn ? (forBaby ? 'Напишите по-казахски — потом проверьте себя.' : 'Напиши по-казахски — потом проверь себя.')
        : forBaby ? 'Вспомните и скажите вслух — потом проверьте себя.' : 'Вспомни и скажи вслух — потом проверь себя.'}</p>
    </div>
    <div class="bottom pad" ref=${bottom}>${open
      ? html`<div class=${'grades' + (choices.length === 3 ? ' three' : '')} role="group" aria-label="Как вспомнилось">${choices.map(([g, label]) => html`
          <button type="button" class="grade" onClick=${() => rate(g)}><b>${label}</b><span class="muted sm">${when(g)}</span></button>`)}</div>`
      : typingOn
      ? html`<form class="panel-in" onSubmit=${sendTyped}>
          <${TypeField} text=${typeText} setText=${setTypeText} input=${typeInput} label="Ответ по-казахски" placeholder="По-казахски…" />
          <${LinkRow} items=${[['Показать ответ', reveal], ['Без печати', () => typeMode(false)]]} /></form>`
      : html`<button type="button" class="btn btn-primary btn-block" onClick=${reveal}>Показать ответ</button>
          <${LinkRow} items=${[['Напечатать ответ', () => typeMode(true)]]} />`}</div>
  </main>`;
}

/* ---------- «Бәйге»: a race of word pairs ---------- */

// The words of a topic open with its third lesson, when all of them have been met. A race is ten
// pairs on two boards of five; a wrong pair adds three seconds. The first race of a set is run
// against Bota at four seconds a pair, every later one against the learner's own record. Fine and
// pace are set so that tapping at random (about ten wrong pairs a race) loses to Bota.
const RACE_BOARD = 5;
const RACE_PAIRS = 10;
const RACE_FINE = 3000;
const BOTA_PACE = 4000;
const FINE_S = RACE_FINE / 1000;
const PAIR_W = ['пару', 'пары', 'пар'];
const MISS_W = ['ошибка', 'ошибки', 'ошибок'];
// Times are shown and compared in tenths of a second.
const tenths = (ms) => Math.round(ms / 100);

const raceOpen = (st, t) => !!(t.words && t.words.length && (st.done[t.convs[2].id] || topicKnown(st, t)));
const raceTopics = (st) => PLAYABLE.filter((t) => raceOpen(st, t));
// Words close in meaning or form, from different topics, never meet in one mixed race.
const APART = new Map(RACE_APART.flatMap((group, i) => group.map((kk) => [kk, i])));

// 28,4 с; from a minute on, 1:05,2.
function raceTime(ms) {
  const tenths = Math.max(0, Math.round(ms / 100));
  const m = Math.floor(tenths / 600);
  const s = (tenths % 600) / 10;
  const sec = s.toFixed(1).replace('.', ',');
  return m ? `${m}:${s < 10 ? '0' : ''}${sec}` : `${sec} с`;
}

// Words mixed up before come first, then a few of the newest open topic; no two pairs of one race
// mean the same, and words kept apart (RACE_APART) do not meet in a mixed race.
function raceSet(st, topic) {
  const topics = topic ? [topic] : raceTopics(st);
  const wordsOf = (t) => (t.words || []).map(([kk, ru]) => ({ kk, ru }));
  const lists = topics.map(wordsOf);
  const pool = lists.flat();
  const miss = st.race.miss;
  const again = shuffle(pool.filter((w) => miss[w.kk])).sort((a, b) => miss[b.kk] - miss[a.kk]).slice(0, 4);
  const newest = topic ? [] : shuffle(lists[lists.length - 1] || []).slice(0, 3);
  const out = [];
  const meanings = new Set();
  const groups = new Set();
  for (const w of [...again, ...newest, ...shuffle(pool)]) {
    const m = w.ru.toLowerCase();
    const group = topic ? undefined : APART.get(w.kk);
    if (out.includes(w) || meanings.has(m) || groups.has(group)) continue;
    meanings.add(m);
    if (group !== undefined) groups.add(group);
    out.push(w);
    if (out.length === RACE_PAIRS) break;
  }
  return shuffle(out);
}

// Each board shows its words and their meanings in two columns, each in its own order.
function raceBoards(n) {
  const out = [];
  for (let i = 0; i < n; i += RACE_BOARD) {
    const ids = Array.from({ length: Math.min(RACE_BOARD, n - i) }, (_, j) => i + j);
    const left = shuffle(ids);
    let right = shuffle(ids);
    while (ids.length > 1 && right.every((x, j) => x === left[j])) right = shuffle(ids);
    out.push({ left, right });
  }
  return out;
}

// The mixed race on the home screen appears with the second open topic: with one, it would repeat
// the race of that topic, which its own screen offers.
function RaceRow({ st, go }) {
  if (raceTopics(st).length < 2) return null;
  const best = st.race.best.mix;
  return html`<button type="button" class="mem-row" onClick=${() => go('race')}>
    <span class="mem-ic race-ic"><${Icon} name="flag" size=${22} /></span>
    <span class="grow"><span><span lang="kk">Бәйге</span> (скачки) — пары слов на время</span></span>
    ${best ? html`<span class="muted sm">рекорд ${raceTime(best)}</span>` : null}
    <${Icon} name="next" size=${18} stroke=${2.4} />
  </button>`;
}

// A race alone runs against the record or, the first time, against Bota. A duel is played in turns
// on one phone: both players get the same words in their own order, and the second one sees the
// first one's pace on the track. A duel changes no record; it counts as a day of practice.
function RaceScreen({ st, update, go, ti, quick, setup, duel: duelIn, back: from }) {
  const topic = ti != null ? PLAYABLE[ti] : null;
  const key = topic ? topic.id : 'mix';
  const me = st.profile.name || 'Ты';
  const [set] = useState(() => raceSet(st, topic));
  const [boards, setBoards] = useState(() => raceBoards(set.length));
  // names: the learner and the rival, each keeps a lane and a colour; first: who plays first;
  // runs: the time and fines of each player's turn.
  const [duel, setDuel] = useState(() => (duelIn ? { names: duelIn.names, first: duelIn.first || 0, turn: 0, runs: [] } : null));
  const playing = duel ? (duel.turn === 0 ? duel.first : 1 - duel.first) : 0;
  const [rival, setRival] = useState(st.race.rival || '');
  const [phase, setPhase] = useState(quick ? 'count' : setup ? 'setup' : 'ready');
  const [count, setCount] = useState(3);
  const [board, setBoard] = useState(0);
  const [selK, setSelK] = useState(-1);
  const [selR, setSelR] = useState(-1);
  const [done, setDone] = useState([]);
  const [flash, setFlash] = useState(-1);
  const [bad, setBad] = useState(null);
  const [fineMark, setFineMark] = useState(0);
  const [said, setSaid] = useState('');
  const [result, setResult] = useState(null);
  const [, setTick] = useState(0);
  // t0: the start; off: time the page was hidden; hid: since when it is hidden; end: the last pair.
  const clock = useRef({ t0: 0, off: 0, hid: 0, end: 0 });
  const fines = useRef(0);
  const missed = useRef(new Set());
  const boardBox = useRef(null);
  const main = useRef(null);
  const nameBox = useRef(null);
  // The record this race is run against; saving a new one must not change the rival on screen.
  const [record] = useState(() => st.race.best[key] || null);
  const total = set.length;
  const target = record || total * BOTA_PACE;
  const back = () => (topic ? go('topic', { ti, back: from }) : go('home'));
  const rivalName = cap(rival.trim().replace(/\s+/g, ' ').slice(0, 24));

  const elapsed = () => {
    const c = clock.current;
    return c.t0 ? (c.end || c.hid || Date.now()) - c.t0 - c.off : 0;
  };
  const shown = result ? result.ms : elapsed() + fines.current * RACE_FINE;

  // 3 · үш, 2 · екі, 1 · бір — then the board opens and the clock starts. A countdown left in a
  // hidden page waits and starts over from three when the page is back.
  const [wake, setWake] = useState(0);
  useEffect(() => {
    if (phase !== 'count') return undefined;
    const onVis = () => {
      if (document.hidden) return;
      setCount(3);
      setWake((w) => w + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    const id = setTimeout(() => {
      if (document.hidden) return;
      if (count > 1) { setCount(count - 1); return; }
      clock.current = { t0: Date.now(), off: 0, hid: 0, end: 0, paused: false };
      setPhase('run');
    }, 650);
    return () => { clearTimeout(id); document.removeEventListener('visibilitychange', onVis); };
  }, [phase, count, wake]);

  // The clock ticks while the race runs and stands while the page is hidden. A race that stood
  // still with the words on screen is marked: it sets no record.
  useEffect(() => {
    if (phase !== 'run') return undefined;
    const id = setInterval(() => setTick((x) => x + 1), 100);
    const onVis = () => {
      const c = clock.current;
      if (c.end) return;
      if (document.hidden) {
        if (!c.hid) c.hid = Date.now();
        c.paused = true;
      } else if (c.hid) {
        c.off += Date.now() - c.hid;
        c.hid = 0;
      }
    };
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [phase]);

  // Keyboard users land on the name field, on the board and on the main button between turns.
  useEffect(() => {
    if (phase === 'setup') {
      if (nameBox.current) nameBox.current.focus({ preventScroll: true });
      return;
    }
    const box = phase === 'run' ? boardBox.current : phase === 'end' || phase === 'handoff' ? main.current : null;
    const el = box && (box.matches('button') ? box : box.querySelector('button:not([disabled])'));
    if (el) el.focus({ preventScroll: true });
  }, [phase, board]);
  // A pair found disables its chips; keyboard focus goes on to the next free word, not to the page
  // top (Firefox drops it to the page) or onto a chip that is fading out (Chrome keeps it there).
  useEffect(() => {
    const box = boardBox.current;
    const active = document.activeElement;
    const lost = !active || active === document.body || (active.disabled && box && box.contains(active));
    if (phase !== 'run' || !box || !lost) return;
    const el = box.querySelector('button:not([disabled])');
    if (el) el.focus({ preventScroll: true });
  }, [done.length]);

  const startDuel = () => {
    if (!rivalName) return;
    update((d) => { d.race.rival = rivalName; });
    setDuel({ names: [me, rivalName], first: 0, turn: 0, runs: [] });
    setCount(3);
    setPhase('count');
  };

  // The second turn starts from a clean board: the same words in a new order.
  const nextTurn = () => {
    setBoards(raceBoards(total));
    setBoard(0);
    setSelK(-1);
    setSelR(-1);
    setDone([]);
    setFlash(-1);
    setBad(null);
    setFineMark(0);
    setSaid('');
    fines.current = 0;
    missed.current = new Set();
    clock.current = { t0: 0, off: 0, hid: 0, end: 0 };
    setCount(3);
    setPhase('count');
  };

  const finish = () => {
    // Shown and compared in tenths: 10,0 against 10,0 is a tie, whatever the milliseconds.
    const ms = tenths(elapsed()) * 100 + fines.current * RACE_FINE;
    const paused = !!clock.current.paused;
    if (duel) {
      const runs = [...duel.runs];
      runs[playing] = { ms, fines: fines.current, paused };
      if (duel.turn === 0) {
        setDuel({ ...duel, runs, turn: 1 });
        setSaid(`${duel.names[playing]}: ${raceTime(ms)}. Ход ${duel.names[1 - playing]}.`);
        setPhase('handoff');
        return;
      }
      const [a, b] = runs;
      setSaid(a.ms === b.ms ? 'Ничья.' : `${duel.names[a.ms < b.ms ? 0 : 1]} быстрее на ${raceTime(Math.abs(a.ms - b.ms))}.`);
      update((d) => { d.days[dayKey()] = true; });
      stats.track('duel_done', { set: topic ? 'topic' : 'mix' });
      setDuel({ ...duel, runs });
      setPhase('end');
      return;
    }
    const miss = missed.current;
    const now = Date.now();
    update((d) => {
      if (!paused && (!d.race.best[key] || ms < d.race.best[key])) d.race.best[key] = ms;
      d.race.runs = (d.race.runs || 0) + 1;
      // A word mixed up comes back in the next races until it is matched right away. It also joins
      // the memory as forgotten: the review asks it tomorrow, along with the phrases.
      set.forEach((w, i) => {
        if (miss.has(i)) {
          d.race.miss[w.kk] = (d.race.miss[w.kk] || 0) + 1;
          d.mem[wordId(w.kk)] = fsrs.review(d.mem[wordId(w.kk)], 1, now);
        } else if (d.race.miss[w.kk] > 1) d.race.miss[w.kk] -= 1;
        else delete d.race.miss[w.kk];
      });
      d.days[dayKey()] = true;
    });
    const won = !paused && tenths(ms) < tenths(record || total * BOTA_PACE);
    stats.track('race_done', { set: topic ? 'topic' : 'mix', ms, miss: miss.size, won, paused, first: !record });
    setResult({ ms, prev: record, fines: fines.current, missed: [...miss], paused });
    setPhase('end');
  };

  const judge = (k, r) => {
    setSelK(-1);
    setSelR(-1);
    if (k === r) {
      const next = [...done, k];
      setDone(next);
      setFlash(k);
      setSaid(`Верно: ${set[k].kk} — ${set[k].ru}`);
      setTimeout(() => setFlash((f) => (f === k ? -1 : f)), 320);
      if (boards[board].left.every((i) => next.includes(i))) {
        if (board + 1 < boards.length) setTimeout(() => setBoard((b) => b + 1), 320);
        else {
          // The clock stops at the last pair; the result opens once its frame has shown.
          clock.current.end = Date.now();
          setTimeout(finish, 380);
        }
      }
      return;
    }
    fines.current += 1;
    missed.current.add(k);
    missed.current.add(r);
    setBad({ k, r });
    setFineMark((n) => n + 1);
    setSaid(`Не пара: «${set[k].kk}» — это «${set[k].ru}». Плюс ${FINE_S} секунды.`);
    setTimeout(() => setBad((b) => (b && b.k === k && b.r === r ? null : b)), 450);
  };

  const tap = (side, i) => {
    if (phase !== 'run' || done.includes(i) || clock.current.end || clock.current.hid) return;
    if (side === 'k') {
      const k = selK === i ? -1 : i;
      if (k >= 0 && st.settings.voice) voice.speak(set[k].kk);
      if (k >= 0 && selR >= 0) judge(k, selR);
      else setSelK(k);
    } else {
      const r = selR === i ? -1 : i;
      if (r >= 0 && selK >= 0) judge(selK, r);
      else setSelR(r);
    }
  };

  const duo = !!duel || phase === 'setup';
  const sub = duo ? 'скачки вдвоём' : topic ? `скачки · «${topic.title}»` : 'скачки на словах';
  const backLabel = topic ? 'Назад к теме' : 'В «Мой круг»';
  const head = html`<${TopBar} title="Бәйге" sub=${sub} onBack=${back} backLabel=${topic ? 'Назад к теме' : 'Вернуться в «Мой круг»'}
    right=${phase === 'run' ? html`<span class="race-clock">${raceTime(shown)}${fineMark
      ? html`<span class="race-fine" key=${fineMark} aria-hidden="true">+${FINE_S} с</span>` : null}</span>` : null} />`;

  if (!total) {
    return html`<main class="screen">${head}
      <div class="scroll pad race-intro">
        <${Bota} size=${64} />
        <b class="h2">Слова ещё не открыты</b>
        <p class="muted">Слова темы приходят в бәйге после её третьего урока.</p>
      </div>
      <div class="bottom pad"><button type="button" class="btn btn-primary btn-block" onClick=${back}>${topic ? 'Назад к теме' : 'Вернуться в «Мой круг»'}</button></div>
    </main>`;
  }

  const live = done.length / total;
  const initial = (name) => (name || '?')[0].toUpperCase();
  const lane = (name, cls, at, inner) => html`<div class="lane"><span class="lane-name">${name}</span><span class="lane-line">
    <span class=${'runner ' + cls} style=${`--at:${at.toFixed(3)}`}>${inner}</span></span></div>`;
  let lanes;
  if (duo) {
    const names = duel ? duel.names : [me, rivalName || 'Соперник'];
    const first = duel ? duel.first : 0;
    // While the second player runs, the first one is a dashed shadow at the pace of the finished turn.
    const shadow = !!duel && duel.turn === 1 && (phase === 'count' || phase === 'run');
    const at = (i) => {
      if (!duel) return 0;
      if (phase === 'end') return 1;
      if (phase === 'handoff') return i === first ? 1 : 0;
      if (shadow && i === first) return phase === 'run' ? Math.min(1, shown / duel.runs[first].ms) : 0;
      return i === playing ? live : 0;
    };
    const idle = (i) => (!duel ? i === 1 : phase === 'end' ? false : phase === 'handoff' ? i !== first : !shadow && i !== playing);
    lanes = names.map((n, i) => lane(n, (i ? 'p2' : 'me') + (shadow && i === first ? ' ghostly' : idle(i) ? ' idle' : ''), at(i), initial(n)));
  } else {
    lanes = [lane('Ты', 'me', live, initial(me)),
      lane(record ? 'Рекорд' : 'Бота', record ? 'ghost' : 'bota', Math.min(1, shown / target), record ? null : html`<${Bota} size=${28} />`)];
  }
  const track = html`<div class="race-track" aria-hidden="true">${lanes}</div>`;

  // A long word gets a smaller size, so that it is not broken in the middle on a narrow phone.
  const sizeOf = (text) => {
    const longest = Math.max(...text.split(' ').map((w) => w.length));
    return longest >= 15 ? ' xlong' : longest >= 12 ? ' long' : '';
  };
  const chip = (side, i) => {
    const isK = side === 'k';
    const matched = done.includes(i);
    const state = matched ? (flash === i ? ' ok' : ' gone')
      : (isK ? selK : selR) === i ? ' sel'
      : bad && (isK ? bad.k : bad.r) === i ? ' bad' : '';
    return html`<button type="button" key=${`${side}${i}`} class=${'pair-chip' + (isK ? ' kk' : '') + sizeOf(isK ? set[i].kk : set[i].ru) + state} lang=${isK ? 'kk' : null}
      aria-pressed=${(isK ? selK : selR) === i} aria-hidden=${matched && flash !== i ? 'true' : null} disabled=${matched}
      onClick=${() => tap(side, i)}>${isK ? set[i].kk : set[i].ru}</button>`;
  };
  const finesOf = (n, paused) => [n ? `${n} ${plural(n, MISS_W)}, +${n * FINE_S} с` : 'без ошибок', paused ? 'с паузой' : ''].filter(Boolean).join(' · ');

  let body;
  if (phase === 'setup') {
    body = html`<form class="race-intro" id="duel-form" onSubmit=${(e) => { e.preventDefault(); startDuel(); }}>
      <b class="h2">Вдвоём на одном телефоне</b>
      <p class="muted">Играете по очереди на одних и тех же словах. Кто быстрее подберёт ${total} ${plural(total, PAIR_W)}, тот и победил.</p>
      <span class="duel-field"><label class="field-label" for="duel-name">С кем играешь?</label>
        <input id="duel-name" ref=${nameBox} class="field" type="text" maxlength="24" autocomplete="off" placeholder="Например, Айгерим"
          value=${rival} onInput=${(e) => setRival(e.target.value)} /></span>
    </form>`;
  } else if (phase === 'ready') {
    body = html`<div class="race-intro">
      ${record ? html`<span class="orn-big"><${Icon} name="flag" size=${48} stroke=${1.8} /></span>` : html`<${Bota} size=${64} />`}
      <b class="h2">${record ? `Побей рекорд — ${raceTime(record)}` : 'Обгони Боту'}</b>
      <p class="muted">Подбери ${total} ${plural(total, PAIR_W)}: казахское слово и его перевод. Ошибка — плюс ${FINE_S} секунды.</p>
    </div>`;
  } else if (phase === 'count') {
    body = html`<div class="race-count" role="status">${duel ? html`<span class="race-turn">Ход: ${duel.names[playing]}</span>` : null}
      <b key=${count}>${count}</b><span lang="kk">${['', 'бір', 'екі', 'үш'][count]}</span></div>`;
  } else if (phase === 'run') {
    const cur = boards[board];
    body = html`<div class="race-board" ref=${boardBox} role="group" aria-label="Пары: казахское слово и перевод">
      <div class="race-col">${cur.left.map((i) => chip('k', i))}</div>
      <div class="race-col">${cur.right.map((i) => chip('r', i))}</div>
    </div>`;
  } else if (phase === 'handoff') {
    const r = duel.runs[duel.first];
    body = html`<div class="race-intro">
      <span class="race-turn">${duel.names[duel.first]}</span>
      <b class="race-time">${raceTime(r.ms)}</b>
      <span class="sm">${finesOf(r.fines, r.paused)}</span>
      <p class="muted">Передай телефон: ход ${duel.names[playing]}. Слова те же, расклад другой.</p>
    </div>`;
  } else if (duel) {
    const [a, b] = duel.runs;
    const tie = a.ms === b.ms;
    const win = tie ? -1 : a.ms < b.ms ? 0 : 1;
    body = html`<div class="race-end">
      ${tie ? null : html`<span class="race-cheer"><b lang="kk">Жарайсың, ${duel.names[win]}!</b> — молодец!</span>`}
      <b class="h2">${tie ? `Ничья — ${raceTime(a.ms)}` : `${duel.names[win]} быстрее на ${raceTime(Math.abs(a.ms - b.ms))}`}</b>
      <div class="duel-rows">${(win === 1 ? [1, 0] : [0, 1]).map((i) => html`<div class=${'duel-row' + (i === win ? ' win' : '')}>
        <span class=${'runner ' + (i ? 'p2' : 'me')} aria-hidden="true">${initial(duel.names[i])}</span>
        <span class="grow"><b>${duel.names[i]}</b><span class="muted sm">${finesOf(duel.runs[i].fines, duel.runs[i].paused)}</span></span>
        <b class="duel-time">${raceTime(duel.runs[i].ms)}</b></div>`)}</div>
    </div>`;
  } else {
    const r = result;
    // Older records may hold milliseconds: both sides are compared in tenths.
    const gap = r.prev ? tenths(r.ms) - tenths(r.prev) : tenths(r.ms) - tenths(total * BOTA_PACE);
    const won = !r.paused && gap < 0;
    const status = r.paused ? 'Заезд прерывался — в рекорд не идёт'
      : r.prev ? (won ? 'Новый рекорд!' : gap === 0 ? 'Ровно как рекорд' : `До рекорда — ${raceTime(gap * 100)}`)
      : won ? 'Ты обогнал(а) Боту!' : 'Бота пока быстрее';
    body = html`<div class="race-end">
      <span class="race-cheer"><b lang="kk">${won ? 'Жарайсың!' : 'Тағы бір рет!'}</b> ${won ? '— молодец!' : '— ещё разок!'}</span>
      <b class="race-time">${raceTime(r.ms)}</b>
      <span class="sm">${status}${r.fines ? ` · ${finesOf(r.fines)}` : ''}</span>
      ${r.missed.length ? html`<section class="race-miss"><span class="eyebrow">ЭТИ СЛОВА — В ПАМЯТИ, ПОВТОРИМ ЗАВТРА</span>
        ${r.missed.slice(0, 6).map((i) => html`<div class="ex-row"><span class="grow"><b class="kk" lang="kk">${set[i].kk}</b><span class="muted sm">${set[i].ru}</span></span><${SpeakBtn} text=${set[i].kk} small /></div>`)}
      </section>` : null}
    </div>`;
  }

  // One main button; going elsewhere stays in one line of links under it.
  const links = (items) => html`<span class="done-links">${items.map(([label, on], i) => html`${i ? html`<span aria-hidden="true">·</span>` : null}<button type="button" class="link-btn" onClick=${on}>${label}</button>`)}</span>`;
  let bottom = null;
  if (phase === 'ready') {
    bottom = html`<div class="bottom pad race-bottom">
      <button type="button" class="btn btn-primary btn-block" onClick=${() => setPhase('count')}><${Icon} name="flag" size=${20} /> Старт</button>
      ${links([['Вдвоём на одном телефоне', () => setPhase('setup')]])}
    </div>`;
  } else if (phase === 'setup') {
    bottom = html`<div class="bottom pad race-bottom">
      <button type="submit" form="duel-form" class="btn btn-primary btn-block" disabled=${!rivalName}>Начать</button>
      ${links([['Играть одному', () => setPhase('ready')]])}
    </div>`;
  } else if (phase === 'handoff') {
    bottom = html`<div class="bottom pad"><button type="button" class="btn btn-primary btn-block" ref=${main} onClick=${nextTurn}>Ход ${duel.names[playing]}: старт</button></div>`;
  } else if (phase === 'end') {
    bottom = duel
      ? html`<div class="bottom pad race-bottom">
          <button type="button" class="btn btn-primary btn-block" ref=${main}
            onClick=${() => go('race', { ti, k: Date.now(), quick: true, duel: { names: duel.names, first: 1 - duel.first } })}>Реванш</button>
          ${links([['Играть одному', () => go('race', { ti, k: Date.now() })], [backLabel, back]])}
        </div>`
      : html`<div class="bottom pad race-bottom">
          <button type="button" class="btn btn-primary btn-block" ref=${main} onClick=${() => go('race', { ti, k: Date.now(), quick: true })}>Ещё заезд</button>
          ${links([['Вдвоём', () => go('race', { ti, k: Date.now(), setup: true })], [backLabel, back]])}
        </div>`;
  }

  return html`<main class="screen">${head}
    <div class="scroll pad race">${track}${body}<span class="sr" role="status">${said}</span></div>
    ${bottom}
  </main>`;
}

/* ---------- 08 · phrasebook ---------- */

// Search ignores case, punctuation and Kazakh letters typed as Russian ones: «салем» finds «Сәлем».
const loose = (s) => plain(normType(s));

// The phrases of a situation: its own (pb.<id><n>) or phrases of the course (ids of PHRASES).
const situationItems = (c, v) => (c.phrases
  ? c.phrases.filter((id) => PHRASES[id]).map((id) => ({ id, kk: fill(PHRASES[id].kk, v), ru: fill(PHRASES[id].ru, v) }))
  : c.items.map((it, i) => ({ id: `pb.${c.id}${i}`, kk: it[0], ru: it[1] })));

// The situation chosen last stays chosen while the page is open.
let phrasebookCat = 0;

function Phrasebook({ st, update, go }) {
  const [cat, setCatState] = useState(phrasebookCat);
  const setCat = (i) => { phrasebookCat = i; setCatState(i); };
  const [q, setQ] = useState('');
  const v = varsOf(st);
  const all = PHRASEBOOK.flatMap((c) => situationItems(c, v));
  const query = loose(q);
  const situation = PHRASEBOOK[cat] || PHRASEBOOK[0];
  let items = situationItems(situation, v);
  // A situation of the course leads to its topic: its first lessons are open at any time.
  const ti = situation.topic ? PLAYABLE.findIndex((t) => t.id === situation.topic) : -1;
  const topic = ti >= 0 ? PLAYABLE[ti] : null;
  if (query) {
    // Phrases of the lessons are found too, with their level; a phrase met twice is listed once.
    const course = Object.keys(PHRASES).filter((id) => PHRASE_LEVEL[id])
      .map((id) => ({ id, kk: fill(PHRASES[id].kk, v), ru: fill(PHRASES[id].ru, v), level: PHRASE_LEVEL[id] }));
    const listed = new Set();
    items = [...RESCUE, ...all, ...course].filter((x) => {
      const key = normType(x.kk);
      if (listed.has(key) || !(loose(x.kk).includes(query) || loose(x.ru).includes(query))) return false;
      listed.add(key);
      return true;
    }).slice(0, 40);
  }
  const toggle = (id) => update((d) => { if (d.mem[id]) delete d.mem[id]; else d.mem[id] = fsrs.review(null, 2); });
  return html`<main class="screen">
    <div class="scroll pad phrasebook">
      <header class="pb-head">
        <span><h1 class="h1">Разговорник</h1><span class="muted sm">фразы, которые нужны уже сегодня</span></span>
        <span class="mem-pill"><${Icon} name="ornament" size=${16} stroke=${2.2} /> в памяти ${Object.keys(st.mem).length}</span>
      </header>
      <div class="search"><label class="sr" for="pb-search">Поиск фразы</label><${Icon} name="search" size=${18} stroke=${2.2} />
        <input id="pb-search" type="search" placeholder="Найти фразу по-русски или по-казахски" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
      ${query ? null : html`<section class="rescue"><span class="eyebrow">ЕСЛИ РАСТЕРЯЛСЯ В РАЗГОВОРЕ</span>
        <div class="rescue-row">${RESCUE.map((x) => (voice.canSay(x.kk)
          ? html`<button type="button" class="rescue-chip" onClick=${() => voice.speak(x.kk)} aria-label=${`${x.kk} — ${x.ru}`}>
              <b class="kk" lang="kk">${x.kk}</b><span class="muted sm">${x.ru}</span></button>`
          : html`<span class="rescue-chip still"><b class="kk" lang="kk">${x.kk}</b><span class="muted sm">${x.ru}</span></span>`))}</div></section>`}
      ${query ? null : html`<div class="cats" role="tablist" aria-label="Ситуации">${PHRASEBOOK.map((c, i) => html`
        <button type="button" role="tab" aria-selected=${cat === i} class=${'cat' + (cat === i ? ' on' : '')} onClick=${() => setCat(i)}>
          <${Icon} name=${c.icon} size=${18} />${c.title}</button>`)}</div>`}
      <div class="ph-list">${items.length ? items.map((x) => html`<div class="ph-row" key=${x.id}>
        <${SpeakBtn} text=${x.kk} />
        <span class="grow"><b class="kk" lang="kk">${x.kk}</b><span class="muted sm">${x.ru}${x.level ? ` · ${x.level}` : ''}</span></span>
        <button type="button" class=${'mem-btn' + (st.mem[x.id] ? ' on' : '')} aria-pressed=${!!st.mem[x.id]}
          aria-label=${st.mem[x.id] ? 'Убрать из памяти' : 'Добавить в память'} onClick=${() => toggle(x.id)}><${Icon} name="ornament" size=${22} /></button>
      </div>`) : html`<span class="muted sm">Такой фразы пока нет.</span>`}</div>
      ${!query && topic ? html`<button type="button" class="rules-link pb-topic" onClick=${() => go('topic', { ti, back: 'phrasebook' })}>
        <${Avatar} who=${topic.who} size=${40} />
        <span class="grow"><b>Урок «${topic.title}»</b><span class="muted sm">${PEOPLE[topic.who].name} · ${topic.level} · первые уроки открыты сразу</span></span>
        <${Icon} name="next" size=${20} stroke=${2.2} />
      </button>` : null}
      <button type="button" class="rules-link" onClick=${() => go('rules', { back: 'phrasebook' })}>
        <span class="rl-ic"><${Icon} name="book" size=${20} /></span>
        <span class="grow"><b>Как устроен казахский</b><span class="muted sm">15 коротких правил · по желанию</span></span>
        <${Icon} name="next" size=${20} stroke=${2.2} />
      </button>
      ${st.profile.mode === 'baby' ? null : html`<button type="button" class="rules-link" onClick=${() => go('baby')}>
        <span class="rl-ic"><${Icon} name="heart" size=${20} /></span>
        <span class="grow"><b>Малыш</b><span class="muted sm">фразы для родителей: купание, еда, прогулка, сон</span></span>
        <${Icon} name="next" size=${20} stroke=${2.2} />
      </button>`}
    </div>
    <${TabBar} tab="phrasebook" go=${go} st=${st} />
  </main>`;
}

/* ---------- 07 · «Малыш» ---------- */

// The parent learns, the baby hears a living voice. The main screen offers one ritual for now and a
// minute to prepare for it: hear each phrase and say it after Bota, say it from memory, then put the
// phone away. What was said is marked in the evening, on one screen; prepared phrases join the memory.
const AGE_RANK = { '0-1': 0, '1-2': 1, '2-3': 2 };
const FROM_LABEL = { '1-2': 'с 1 года', '2-3': 'с 2 лет' };
const RITUAL_W = ['ритуал', 'ритуала', 'ритуалов'];
const SONG_W = ['песенка', 'песенки', 'песенок'];
const ageOk = (st, s) => AGE_RANK[s.from] <= (AGE_RANK[st.baby.age] ?? 1);
const isSong = (s) => s.group === 'songs';
const ritualOf = (id) => BABY.find((x) => x.id === id) || BABY[0];
const knownOf = (st, s) => s.items.filter((_, i) => st.mem[babyId(s.id, i)]).length;

// The day of «Малыш» ends at four in the morning: what was prepared in the evening is marked after
// midnight on the same day. The streak counts calendar days (st.days).
const babyDay = (d = new Date()) => dayKey(new Date(d.getTime() - 4 * 3600000));

// The part of the day that «Сейчас подходит» looks at.
function partOfDay(now = new Date()) {
  const h = now.getHours();
  return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'evening' : 'night';
}

// The ritual that fits the time of day and the baby's age and has been neither prepared nor said today.
function suggestRitual(st, now = new Date()) {
  const day = babyDay(now);
  const said = (st.baby.said || {})[day] || {};
  const prep = (st.baby.prep || {})[day] || {};
  const timed = BABY_NOW[partOfDay(now)].map((id) => BABY.find((s) => s.id === id)).filter(Boolean);
  const fits = timed.filter((s) => ageOk(st, s));
  const pool = fits.length ? fits : timed;
  return pool.find((s) => !prep[s.id] && !s.items.some((_, i) => said[`${s.id}.${i}`])) || pool[0];
}

// Marked in the evening: a phrase said to the baby today. A phrase not yet in the memory joins it.
function toggleSaid(update, pid) {
  const today = babyDay();
  update((d) => {
    d.baby.said = d.baby.said || {};
    const day = { ...(d.baby.said[today] || {}) };
    if (day[pid]) delete day[pid];
    else {
      day[pid] = true;
      if (!d.mem[`b:${pid}`]) d.mem[`b:${pid}`] = fsrs.review(null, 2);
    }
    d.baby.said[today] = day;
    if (Object.keys(day).length) d.days[dayKey()] = true;
  });
}

// «Замени слово»: a phrase of the ritual with a place for a word — «Міне, шұлығың!» — and the words
// that fit there.
// The literal sense of an endearment in a phrase or a word: «қозым — букв. «мой ягнёнок»» (ENDEARMENTS).
function literalOf(kk) {
  const w = normType(kk).split(' ').find((x) => ENDEARMENTS[x]);
  return w ? `${w} — букв. «${ENDEARMENTS[w]}»` : '';
}

const swapKk = (swap, w) => fillSlot(swap.kk, w[0]).join('');
const swapRu = (swap, w) => w[2] || fillSlot(swap.ru, w[1]).join('');

function SwapCard({ swap, sound }) {
  const [k, setK] = useState(0);
  const w = swap.words[k] || swap.words[0];
  const [a, mid, b] = fillSlot(swap.kk, w[0]);
  const pick = (i) => {
    setK(i);
    const text = swapKk(swap, swap.words[i]);
    if (sound && voice.canSay(text)) voice.speak(text);
  };
  return html`<section class="card swap">
    <span class="eyebrow">ЗАМЕНИ СЛОВО</span>
    <span class="swap-line"><b class="kk" lang="kk" aria-live="polite">${a}<span class="swap-slot">${mid}</span>${b}</b><${SpeakBtn} text=${a + mid + b} /></span>
    <span class="muted sm">${swapRu(swap, w)}${literalOf(w[0]) ? html`<span class="literal"> · ${literalOf(w[0])}</span>` : null}</span>
    <div class="age-chips" role="group" aria-label="Слова на замену">${swap.words.map((x, i) => html`
      <button type="button" class=${'chip-btn' + (i === k ? ' sel' : '')} aria-pressed=${i === k} lang="kk" onClick=${() => pick(i)}>${x[0]}</button>`)}</div>
  </section>`;
}

const prepLabel = (st, s) => (knownOf(st, s) === s.items.length ? 'Освежить за полминуты' : 'Подготовиться за минуту');

// «Сейчас подходит»: the ritual of this time of day — Bota says its first phrase — and one action,
// a minute of preparation.
function BabyNow({ st, go, s }) {
  const [kk, ru] = s.items[0];
  const n = s.items.length;
  return html`<section class="card baby-now">
    <span class="eyebrow">СЕЙЧАС ПОДХОДИТ</span>
    <span class="now-title"><b class="h3">${s.title}</b><span class="muted sm"><span lang="kk">${s.kk}</span> · ${n} ${plural(n, isSong(s) ? ['строчка', 'строчки', 'строчек'] : PHR_W)}</span></span>
    <div class="m-row left now-say"><${Bota} size=${56} /><div class="b b-bota"><b class="kk" lang="kk">${kk}</b><span class="muted sm">${ru}</span></div></div>
    <button type="button" class="btn btn-primary btn-block" onClick=${() => go('babyPrep', { id: s.id, back: 'baby' })}>
      <${Icon} name="ear" size=${20} /> ${prepLabel(st, s)}</button>
    <span class="done-links"><button type="button" class="link-btn" onClick=${() => go('babyScen', { id: s.id })}>${isSong(s) ? 'Все строчки' : 'Фразы и слова на замену'}</button></span>
  </section>`;
}

// What the baby heard this week; in the evening — today's marks, on one screen.
function BabyWeek({ st, go }) {
  const said = st.baby.said || {};
  const saidToday = Object.keys(said[babyDay()] || {}).length;
  const week = weekKeys().reduce((n, k) => n + Object.keys(said[k] || {}).length, 0);
  const started = week > 0 || Object.keys(st.baby.prep || {}).length > 0 || Object.keys(st.mem).some(isBaby);
  if (!started) return null;
  if (['evening', 'night'].includes(partOfDay()) && !saidToday) {
    return html`<button type="button" class="m-rule race-open" onClick=${() => go('babyDay')}>
      <${Icon} name="check" size=${18} stroke=${2.4} /> Вечер: отметьте, что прозвучало сегодня</button>`;
  }
  return html`<button type="button" class="mem-row" onClick=${() => go('babyDay')}>
    <span class="mem-ic"><${Sun} size=${20} /></span>
    <span class="grow">На этой неделе — ${week} из ${BABY_GOAL} фраз малышу</span>
    <span class="link">Отметить</span>
    <${Icon} name="next" size=${18} stroke=${2.4} />
  </button>`;
}

// Phrases of «Малыш» that fade: a review of them alone.
function BabyMem({ st, go }) {
  const due = dueList(st).filter(isBaby);
  if (!due.length) return null;
  return html`<button type="button" class="mem-row" onClick=${() => go('review', { only: 'baby', back: 'baby' })}>
    <span class="mem-ic"><${Icon} name="ornament" size=${22} /></span>
    <span class="grow">Память: ${cardsText(due)} малышу ${agree(due, 'тускнеет', 'тускнеют')}</span>
    <span class="link">Освежить</span>
    <${Icon} name="next" size=${18} stroke=${2.4} />
  </button>`;
}

function Baby({ st, update, go }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('1-2');
  const [install, installSheet] = useInstall(update);

  if (!st.baby.name) {
    const clean = cap(name.trim().replace(/\s+/g, ' ').slice(0, 24));
    return html`<main class="screen">
      <div class="scroll chat pad">
        <div class="msgs">
          <h1 class="h1 baby-title">Малыш</h1>
          <${BotaSays}>Этот раздел — для родителя. Малышу экран не нужен: ему нужна ваша живая речь.<//>
          <${BotaSays}>Перед купанием, едой, прогулкой или сном я за минуту подготовлю вас к нужным фразам. Как зовут малыша?<//>
        </div>
      </div>
      <form class="composer pad" onSubmit=${(e) => { e.preventDefault(); if (clean) update((d) => { d.baby.name = clean; d.baby.age = age; }); }}>
        <div class="panel-in">
          <label class="field-label" for="baby-name">Имя малыша</label>
          <input id="baby-name" class="field" type="text" maxlength="24" placeholder="Например, Айсулу" value=${name} onInput=${(e) => setName(e.target.value)} />
          <div class="age-chips" role="group" aria-label="Возраст">${BABY_AGES.map(([id, label]) => html`
            <button type="button" class=${'chip-btn' + (age === id ? ' sel' : '')} aria-pressed=${age === id} onClick=${() => setAge(id)}>${label}</button>`)}</div>
          <button type="submit" class="btn btn-primary btn-block" disabled=${!clean}>Готово</button>
        </div>
      </form>
      <${TabBar} tab=${st.profile.mode === 'baby' ? 'baby' : 'phrasebook'} go=${go} st=${st} />
    </main>`;
  }

  const ageLabel = (BABY_AGES.find((a) => a[0] === st.baby.age) || BABY_AGES[1])[1];
  const songs = BABY.filter(isSong).length;
  const rituals = BABY.length - songs;
  return html`<main class="screen">
    <div class="scroll pad baby">
      <header class="baby-head"><span><h1 class="h1">${st.baby.name}</h1><span class="muted sm">${ageLabel}</span></span></header>
      <${BabyNow} st=${st} go=${go} s=${suggestRitual(st)} />
      <${BabyWeek} st=${st} go=${go} />
      <${BabyMem} st=${st} go=${go} />
      <button type="button" class="rules-link" onClick=${() => go('babyAll')}>
        <span class="rl-ic"><${Icon} name="heart" size=${20} /></span>
        <span class="grow"><b>Все ритуалы и песенки</b><span class="muted sm">${rituals} ${plural(rituals, RITUAL_W)} на каждый день и ${songs} ${plural(songs, SONG_W)}</span></span>
        <${Icon} name="next" size=${20} stroke=${2.2} />
      </button>
      ${st.profile.mode === 'baby' ? html`<${SurveyRow} st=${st} update=${update} /><${StatsRow} st=${st} update=${update} />` : null}
      <${InstallRow} st=${st} onOpen=${install} />
      <p class="baby-tip"><${Bota} size=${26} /><span>Подготовьтесь за минуту и уберите телефон: малыш учится у живого голоса, а не у экрана.</span></p>
    </div>
    <${TabBar} tab=${st.profile.mode === 'baby' ? 'baby' : 'phrasebook'} go=${go} st=${st} />
    ${installSheet}
  </main>`;
}

// All rituals and songs, by the time of day and by theme.
function BabyAll({ st, go }) {
  const today = (st.baby.said || {})[babyDay()] || {};
  const songs = BABY.filter(isSong).length;
  const rituals = BABY.length - songs;
  return html`<main class="screen">
    <${TopBar} title="Ритуалы и песенки" sub=${`${rituals} ${plural(rituals, RITUAL_W)} и ${songs} ${plural(songs, SONG_W)}`} onBack=${() => go('baby')} backLabel="Назад к малышу" />
    <div class="scroll pad baby">
      ${BABY_GROUPS.map((g) => html`<section class="scen-group" key=${g.id}>
        <span class="eyebrow">${g.title.toUpperCase()} · <span lang="kk">${g.kk.toUpperCase()}</span></span>
        <div class="scen-grid">${BABY.filter((s) => s.group === g.id).map((s) => {
          const n = s.items.filter((_, i) => today[`${s.id}.${i}`]).length;
          return html`<button type="button" class="scen" key=${s.id} onClick=${() => go('babyScen', { id: s.id, back: 'babyAll' })}
            aria-label=${`${s.title}: сегодня ${n} из ${s.items.length}`}>
            <b>${s.title}</b><span class="muted sm" lang="kk">${s.kk}</span>
            <span class="scen-foot">${!ageOk(st, s) ? html`<span class="age">${FROM_LABEL[s.from]}</span>`
              : html`<span class="pips" aria-hidden="true">${s.items.map((_, i) => html`<i class=${today[`${s.id}.${i}`] ? 'on' : ''}></i>`)}</span>`}</span>
          </button>`;
        })}</div>
      </section>`)}
    </div>
  </main>`;
}

// A ritual: its phrases with the sound, words to put into one of them, and the minute of preparation.
function BabyScenario({ st, go, id, back }) {
  const s = ritualOf(id);
  const idx = BABY.indexOf(s);
  // The next ritual in the list that fits the baby's age.
  const next = [...BABY.slice(idx + 1), ...BABY.slice(0, idx)].find((x) => ageOk(st, x)) || BABY[(idx + 1) % BABY.length];
  const swaps = s.swap ? s.swap.words.map((w) => swapKk(s.swap, w)) : [];
  return html`<main class="screen">
    <${TopBar} title=${s.title} sub=${s.kk} subLang="kk" onBack=${() => go(back || 'baby')} backLabel=${back === 'babyAll' ? 'Ко всем ритуалам' : 'Назад к малышу'} />
    <div class="scroll pad baby">
      <div class="m-tip static"><${Bota} size=${28} /><span>${s.tip}</span></div>
      <div class="ph-list">${s.items.map(([kk, ru], i) => html`<div class="ph-row" key=${i}>
        <${SpeakBtn} text=${kk} />
        <span class="grow"><b class="kk" lang="kk">${kk}</b><span class="muted sm">${ru}</span>${literalOf(kk) ? html`<span class="literal sm">${literalOf(kk)}</span>` : null}</span>
        ${st.mem[babyId(s.id, i)] ? html`<span class="mem-mark" role="img" aria-label="В памяти" title="В памяти"><${Icon} name="ornament" size=${18} /></span>` : null}
      </div>`)}</div>
      ${s.swap ? html`<${SwapCard} key=${s.id} swap=${s.swap} sound=${st.settings.voice} />` : null}
      <${ReportLink} phrases=${[...s.items.map(([kk]) => kk), ...swaps.filter((x) => !s.items.some(([kk]) => kk === x))]} where=${`baby:${s.id}`} />
    </div>
    <div class="bottom pad">
      <button type="button" class="btn btn-primary btn-block" onClick=${() => go('babyPrep', { id: s.id, back: 'babyScen', from: back })}>
        <${Icon} name="ear" size=${20} /> ${prepLabel(st, s)}</button>
      <span class="done-links"><button type="button" class="link-btn" onClick=${() => go('babyScen', { id: next.id, back })}>Следующий: ${next.title.toLowerCase()}</button></span>
    </div>
  </main>`;
}

// «Подготовься за минуту»: before the bath or the walk the parent hears each new phrase of the ritual
// and says it after Bota, in syllables if need be; then says every phrase from memory and checks
// themself — and puts the phone away. Phrases the memory holds already are only recalled. A phrase
// not recalled comes once more at the end; its first try rates the card.
function BabyPrep({ st, update, go, id, back, from }) {
  const s = ritualOf(id);
  const [plan, setPlan] = useState(() => {
    const unknown = s.items.map((_, i) => i).filter((i) => !st.mem[babyId(s.id, i)]);
    return [...unknown.map((i) => ({ k: 'hear', i })), ...s.items.map((_, i) => ({ k: 'recall', i }))];
  });
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState(false);
  // How many phrases were new to the memory: they were heard first.
  const learned = useRef(plan.filter((p) => p.k === 'hear').length);
  const score = useRef({ ok: 0, miss: 0 });
  const ended = useRef(false);
  const lastTap = useRef(0);
  const bottom = useRef(null);
  const step = plan[at];
  const [kk, ru] = step ? s.items[step.i] : ['', ''];
  const sound = st.settings.voice && voice.canSay(kk);
  const leave = () => (back === 'babyScen' ? go('babyScen', { id: s.id, back: from }) : go('baby'));
  // A new phrase sounds as it comes up; keyboard users stay on the buttons of the moment.
  useEffect(() => {
    if (step && step.k === 'hear' && sound) voice.speak(kk);
    if (at === 0 && !open) return;
    const first = bottom.current && bottom.current.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }, [at, open]);
  // The end: the ritual is prepared today, and the day counts as a day of practice.
  useEffect(() => {
    if (step || ended.current) return;
    ended.current = true;
    const today = babyDay();
    update((d) => {
      d.baby.prep = d.baby.prep || {};
      d.baby.prep[today] = { ...(d.baby.prep[today] || {}), [s.id]: true };
      d.days[dayKey()] = true;
    });
    stats.track('baby_prep', { r: s.id, n: s.items.length, fresh: learned.current, ok: score.current.ok });
  }, [step]);
  // A second tap on the same spot must not answer the next step as well.
  const tapped = () => {
    if (Date.now() - lastTap.current < 350) return false;
    lastTap.current = Date.now();
    return true;
  };
  const next = () => {
    voice.stop();
    setOpen(false);
    setAt((n) => n + 1);
  };
  const reveal = () => {
    setOpen(true);
    if (sound) voice.speak(kk);
  };
  const rate = (good) => {
    if (!tapped()) return;
    if (!step.again) {
      const pid = babyId(s.id, step.i);
      update((d) => { d.mem[pid] = fsrs.review(d.mem[pid], good ? 3 : 1); });
      score.current[good ? 'ok' : 'miss'] += 1;
      if (!good) setPlan((p) => [...p, { k: 'recall', i: step.i, again: true }]);
    }
    next();
  };
  const head = html`<${TopBar} title="Подготовка" sub=${step ? `${s.title} · ${at + 1} из ${plan.length}` : s.title} onBack=${leave} backLabel="Выйти из подготовки" />`;

  if (!step) {
    const cards = s.items.map((_, i) => st.mem[babyId(s.id, i)]).filter(Boolean);
    const soon = cards.length ? Math.min(...cards.map((c) => c.due)) : null;
    const note = learned.current
      ? `${learned.current} ${plural(learned.current, PHR_W)} — в памяти${soon ? `, освежим ${whenText(soon)}` : ''}`
      : `Вспомнили ${score.current.ok} из ${s.items.length}${soon ? ` · освежим ${whenText(soon)}` : ''}`;
    return html`<main class="screen">${head}
      <div class="scroll pad review-end prep-end">
        <${Bota} size=${64} />
        <b class="h2">Готово! Теперь уберите телефон</b>
        <span class="muted">и скажите эти фразы малышу сами, своим голосом. Вечером отметьте, что прозвучало.</span>
        <div class="cloud">${s.items.map(([x], i) => html`<span class="kk" lang="kk" key=${i}>${x}</span>`)}</div>
        <span class="mem-note"><${Icon} name="ornament" size=${20} />${note}</span>
        <${RemindRow} st=${st} update=${update} />
      </div>
      <div class="bottom pad"><button type="button" class="btn btn-primary btn-block" onClick=${() => go('baby')}>Готово</button>
        <span class="done-links"><button type="button" class="link-btn" onClick=${() => go('babyPrep', { id: s.id, back, from, k: Date.now() })}>Ещё раз</button></span></div>
    </main>`;
  }

  if (step.k === 'hear') {
    return html`<main class="screen">${head}
      <div class="scroll pad prep">
        <div class="say-head"><span class="eyebrow">ПОСЛУШАЙТЕ И ПОВТОРИТЕ</span><span class="muted sm">${sound ? 'вслух, за Ботой' : 'вслух, по слогам'}</span></div>
        <div class="say-card">
          <span class="say-kk" lang="kk">${kk}</span>
          <span class="say-syl" lang="kk">${syllables(kk)}</span>
          <span class="say-ru">«${ru}»</span>
          ${literalOf(kk) ? html`<span class="literal sm">${literalOf(kk)}</span>` : null}
          ${voice.canSay(kk) ? html`<div class="say-ctl">
              <button type="button" class="ctl" onClick=${() => voice.speak(kk)}><${SpeakerGlyph} size=${16} /> Послушать</button>
              <button type="button" class="ctl" onClick=${() => voice.slow(kk)}>Медленно</button></div>`
            : html`<span class="muted sm">Здесь нет казахского голоса — прочитайте по слогам.</span>`}
        </div>
      </div>
      <div class="bottom pad" ref=${bottom}><button type="button" class="btn btn-primary btn-block" onClick=${() => { if (tapped()) next(); }}>Повторил(а) вслух</button></div>
    </main>`;
  }

  return html`<main class="screen">${head}
    <div class="scroll pad prep">
      <div class="say-head"><span class="eyebrow">ПО ПАМЯТИ</span><span class="muted sm">${step.again ? 'ещё раз' : 'не глядя на текст'}</span></div>
      <div class="rev-card">
        <b class="rev-ru">${ru}</b>
        ${open ? html`<span class="rev-kk"><b lang="kk">${kk}</b><${SpeakBtn} text=${kk} /></span>` : null}
      </div>
      <p class="muted sm center" role="status">${open ? 'Получилось вспомнить?' : 'Скажите это по-казахски вслух — потом проверьте себя.'}</p>
    </div>
    <div class="bottom pad" ref=${bottom}>${open
      ? html`<div class="grades" role="group" aria-label="Получилось ли вспомнить">
          <button type="button" class="grade" onClick=${() => rate(false)}><b>Не вспомнил(а)</b>${step.again ? null : html`<span class="muted sm">повторим в конце</span>`}</button>
          <button type="button" class="grade" onClick=${() => rate(true)}><b>Вспомнил(а)</b></button></div>`
      : html`<button type="button" class="btn btn-primary btn-block" onClick=${reveal}>Показать ответ</button>`}</div>
  </main>`;
}

// The evening: one screen to mark what was said to the baby today, one tap a phrase. Rituals prepared
// or marked today are open; others the memory holds stay folded until tapped.
function BabyDay({ st, update, go }) {
  const today = babyDay();
  const said = (st.baby.said || {})[today] || {};
  const prep = (st.baby.prep || {})[today] || {};
  const touched = (s) => prep[s.id] || s.items.some((_, i) => said[`${s.id}.${i}`]);
  // While phrases are marked the order stays as it was when the screen opened.
  const [first] = useState(() => BABY.filter(touched).map((s) => s.id));
  const [opened, setOpened] = useState({});
  const todays = BABY.filter((s) => first.includes(s.id));
  const others = BABY.filter((s) => !first.includes(s.id) && s.items.some((_, i) => st.mem[babyId(s.id, i)] || said[`${s.id}.${i}`]));
  const n = Object.keys(said).length;
  const week = weekKeys().reduce((m, k) => m + Object.keys((st.baby.said || {})[k] || {}).length, 0);
  const rows = (s) => html`<div class="ph-list">${s.items.map(([kk, ru], i) => {
    const pid = `${s.id}.${i}`;
    const on = !!said[pid];
    return html`<div class="ph-row" key=${pid}>
      <span class="grow"><b class="kk" lang="kk">${kk}</b><span class="muted sm">${ru}</span></span>
      <button type="button" class=${'said-btn' + (on ? ' on' : '')} aria-pressed=${on}
        onClick=${() => { toggleSaid(update, pid); if (!on) stats.track('baby_said', { r: s.id }); }}>${on ? 'Сказал(а) ✓' : 'Сказал(а)'}</button>
    </div>`;
  })}</div>`;
  const any = todays.length > 0 || others.length > 0;
  const sug = suggestRitual(st);
  return html`<main class="screen">
    <${TopBar} title="Итог дня" sub=${`сегодня ${n} ${plural(n, PHR_W)} · за неделю ${week} из ${BABY_GOAL}`} onBack=${() => go('baby')} backLabel="Назад к малышу" />
    <div class="scroll pad baby">
      <p class="sm">${any ? 'Отметьте, что прозвучало сегодня: одно касание — одна фраза.' : 'Сегодня вы ещё не готовились. Минута с Ботой — и вечером будет что отметить.'}</p>
      ${todays.map((s) => html`<section class="day-group" key=${s.id}><span class="eyebrow">${s.title.toUpperCase()}</span>${rows(s)}</section>`)}
      ${others.length ? html`<section class="day-group"><span class="eyebrow">${todays.length ? 'ЕЩЁ ИЗ ПАМЯТИ' : 'ИЗ ПАМЯТИ'}</span>
        ${others.map((s) => (opened[s.id]
          ? html`<div class="day-open" key=${s.id}><b class="sm">${s.title}</b>${rows(s)}</div>`
          : html`<button type="button" class="mem-row" key=${s.id} aria-expanded="false" onClick=${() => setOpened({ ...opened, [s.id]: true })}>
              <span class="grow">${s.title}</span><span class="muted sm">${s.items.filter((_, i) => said[`${s.id}.${i}`]).length} из ${s.items.length}</span>
              <${Icon} name="down" size=${18} stroke=${2.4} /></button>`))}
      </section>` : null}
    </div>
    <div class="bottom pad">${any
      ? html`<button type="button" class="btn btn-primary btn-block" onClick=${() => go('baby')}>Готово</button>`
      : html`<button type="button" class="btn btn-primary btn-block" onClick=${() => go('babyPrep', { id: sug.id, back: 'baby' })}><${Icon} name="ear" size=${20} /> Подготовиться: ${sug.title.toLowerCase()}</button>`}</div>
  </main>`;
}

/* ---------- 09 · profile ---------- */

function Toggle({ on, onChange, label, disabled }) {
  return html`<button type="button" role="switch" aria-checked=${on} aria-label=${label} disabled=${!!disabled} class=${'switch' + (on ? ' on' : '')} onClick=${() => onChange(!on)}><i></i></button>`;
}

function Profile({ st, update, go }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(st.profile.name);
  const [babyEdit, setBabyEdit] = useState(false);
  const [babyName, setBabyName] = useState(st.baby.name);
  const [babyAge, setBabyAge] = useState(st.baby.age || '1-2');
  const [confirmReset, setConfirmReset] = useState(false);
  const now = new Date();
  const streak = streakOf(st.days);
  const monthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-`;
  const monthDays = Object.keys(st.days).filter((k) => k.startsWith(monthPrefix)).length;
  const convDone = ALL_CONVS.filter((x) => st.done[x.c.id]).length;
  const rulesRead = Object.keys(st.rules).length;
  // Рубежи: how many are passed, and the last итог круга taken, by the blocks of КАЗТЕСТ.
  const cpPassed = CHECKS.filter((cp) => cpState(st, cp).pass).length;
  const lastFinal = [...CHECKS].reverse().find((cp) => cp.final && cpState(st, cp).blocks);
  const finalBlocks = lastFinal ? cpState(st, lastFinal).blocks : {};
  const clean = cap(name.trim().replace(/\s+/g, ' ').slice(0, 24));
  const babyClean = cap(babyName.trim().replace(/\s+/g, ' ').slice(0, 24));
  const babyAgeLabel = (BABY_AGES.find((a) => a[0] === st.baby.age) || BABY_AGES[1])[1];
  const memIds = Object.keys(st.mem).filter((id) => phrase(id));
  const memCount = memIds.length;
  const goal = goalOf(st);
  const hasVoice = voice.available();
  const micUsable = mic.supported() && mic.allowed();
  const [remind, setRemind] = useState(false);
  const [statsInfo, setStatsInfo] = useState(false);
  const [writing, setWriting] = useState(false);
  // Moving the progress: a file saved here opens on another phone or in another browser.
  const fileInput = useRef(null);
  const [transfer, setTransfer] = useState('');
  const exportProgress = async () => {
    const filename = `bota-progress-${dayKey()}.json`;
    const text = JSON.stringify({ app: 'bota', format: 1, saved: new Date().toISOString(), progress: latest(st) });
    const res = await saveFile(filename, text);
    setTransfer(res === 'saved' ? `Файл «${filename}» сохранён. На другом устройстве открой «Профиль» → «Загрузить из файла».`
      : res === 'declined' ? '' : 'Здесь не получилось сохранить файл — попробуй в Safari или Chrome.');
  };
  const importProgress = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const there = await progressFromFile(file);
    if (!there) {
      setTransfer('Это не файл прогресса Боты.');
      return;
    }
    const merged = mergeProgress(latest(st), there);
    update((d) => {
      const next = mergeProgress(d, there);
      Object.keys(d).forEach((k) => delete d[k]);
      Object.assign(d, next);
    });
    const lessons = ALL_CONVS.filter((x) => merged.done[x.c.id]).length;
    const cards = Object.keys(merged.mem).filter((id) => phrase(id));
    setTransfer(`Прогресс перенесён: ${lessons} ${plural(lessons, LESSON_W)}${cards.length ? `, ${cardsText(cards)} в памяти` : ''}.`);
  };
  return html`<main class="screen">
    <div class="scroll pad profile">
      <header class="prof-head">
        <span class="initial" aria-hidden="true">${(st.profile.name || '?')[0]}</span>
        <span class="grow"><h1 class="h2">${st.profile.name || 'Без имени'}</h1>
          <span class="muted sm">${st.profile.mode === 'baby' ? 'Говорю с малышом' : 'Говорю по-казахски'} · ${st.profile.minutes} мин в день</span></span>
      </header>
      <section class="card shan">
        <span class="eyebrow gold-text">${MONTHS_UP[now.getMonth()]} · ШАҢЫРАҚ МЕСЯЦА</span>
        <div class="shan-row"><${Shanyrak} year=${now.getFullYear()} month=${now.getMonth()} days=${st.days} today=${now.getDate()} />
          <span class="shan-text"><span class="big-n">${streak}</span><span class="gold-text"><b>${plural(streak, DAY_W)} подряд</b></span>
            <span class="sm">В ${MONTHS_IN[now.getMonth()]} — ${monthDays} ${plural(monthDays, DAY_W)} занятий</span>
            <span class="muted sm">Каждый день занятий — новая жердь-уық в шаңыраке, куполе юрты.</span></span></div>
      </section>
      <section class="stats">
        <div class="stat"><b>${convDone}<small> / ${ALL_CONVS.length}</small></b><span>уроков</span></div>
        <div class="stat"><b>${memCount}</b><span>${memIds.some(isWord) ? 'в памяти: фразы и слова' : plural(memCount, ['фраза в памяти', 'фразы в памяти', 'фраз в памяти'])}</span></div>
        <div class="stat"><b>${rulesRead}</b><span>${plural(rulesRead, ['правило прочитано', 'правила прочитано', 'правил прочитано'])}</span></div>
      </section>
      ${st.profile.mode === 'talk' || convDone ? html`<section class="card settings">
        <span class="eyebrow">ПРОВЕРКА УРОВНЯ</span>
        <div class="set-row">
          <span class="grow"><b>Рубежи</b><span class="muted sm">${cpPassed ? `взято ${cpPassed} из ${CHECKS.length}` : `${CHECKS.length} ${plural(CHECKS.length, ['рубеж', 'рубежа', 'рубежей'])}: после каждых 3–4 тем`}</span>
            ${lastFinal ? html`<span class="muted sm">Итог круга «${levelOf(lastFinal.level).title}»: ${BLOCKS.filter(([b]) => finalBlocks[b])
              .map(([b, label]) => `${label.toLowerCase()} ${finalBlocks[b][0]} из ${finalBlocks[b][1]}`).join(' · ')}</span>` : null}</span>
        </div>
        <div class="set-row">
          <span class="grow"><b>Входной тест</b><span class="muted sm">${st.place.day ? `пройден ${Number(st.place.day.slice(8))} ${MONTHS_GEN[Number(st.place.day.slice(5, 7)) - 1]}`
            : 'до 7 минут, чтобы начать с подходящей темы'}</span></span>
          <button type="button" class="btn-chip" onClick=${() => go('test', { id: 'place', back: 'profile' })}>${st.place.day ? 'Ещё раз' : 'Пройти'}</button>
        </div>
      </section>` : null}
      <section class="card settings">
        <span class="eyebrow">НАСТРОЙКИ</span>
        <div class="set-row">
          <span class="grow"><b>Имя</b>${editing ? null : html`<span class="muted sm">${st.profile.name}</span>`}</span>
          ${editing ? null : html`<button type="button" class="btn-chip" onClick=${() => { setName(st.profile.name); setEditing(true); }}>Изменить</button>`}
        </div>
        ${editing ? html`<form class="name-edit" onSubmit=${(e) => { e.preventDefault(); if (clean) { update((d) => { d.profile.name = clean; }); setEditing(false); } }}>
          <label class="sr" for="prof-name">Имя</label>
          <input id="prof-name" class="field" type="text" maxlength="24" value=${name} onInput=${(e) => setName(e.target.value)} />
          <button type="submit" class="btn-chip primary" disabled=${!clean}>Сохранить</button>
          <button type="button" class="btn-chip" onClick=${() => setEditing(false)}>Отмена</button></form>` : null}
        <div class="set-row">
          <span class="grow"><b>Минут в день</b><span class="muted sm">цель дня — ${goal} ${plural(goal, LESSON_W)}</span></span>
          <span class="min-chips" role="group" aria-label="Минут в день">${[5, 10, 15].map((m) => html`
            <button type="button" class=${'btn-chip' + (st.profile.minutes === m ? ' primary' : '')} aria-pressed=${st.profile.minutes === m}
              onClick=${() => update((d) => { d.profile.minutes = m; })}>${m}</button>`)}</span>
        </div>
        ${SITE_BUILD ? html`<div class="set-row">
          <span class="grow"><b>Напоминание</b><span class="muted sm">${st.seen.remind ? `каждый день в ${st.seen.remind}, в календаре телефона` : 'через календарь телефона'}</span></span>
          <button type="button" class="btn-chip" onClick=${() => setRemind(true)}>${st.seen.remind ? 'Изменить' : 'Настроить'}</button>
        </div>` : null}
        ${st.baby.name ? html`<div class="set-row">
          <span class="grow"><b>Малыш</b>${babyEdit ? null : html`<span class="muted sm">${st.baby.name} · ${babyAgeLabel}</span>`}</span>
          ${babyEdit ? null : html`<button type="button" class="btn-chip" onClick=${() => { setBabyName(st.baby.name); setBabyAge(st.baby.age || '1-2'); setBabyEdit(true); }}>Изменить</button>`}
        </div>` : null}
        ${st.baby.name && babyEdit ? html`<form class="name-edit baby-edit" onSubmit=${(e) => { e.preventDefault(); if (babyClean) { update((d) => { d.baby.name = babyClean; d.baby.age = babyAge; }); setBabyEdit(false); } }}>
          <label class="sr" for="prof-baby">Имя малыша</label>
          <input id="prof-baby" class="field" type="text" maxlength="24" value=${babyName} onInput=${(e) => setBabyName(e.target.value)} />
          <span class="age-chips" role="group" aria-label="Возраст">${BABY_AGES.map(([id, label]) => html`
            <button type="button" class=${'chip-btn' + (babyAge === id ? ' sel' : '')} aria-pressed=${babyAge === id} onClick=${() => setBabyAge(id)}>${label}</button>`)}</span>
          <button type="submit" class="btn-chip primary" disabled=${!babyClean}>Сохранить</button>
          <button type="button" class="btn-chip" onClick=${() => setBabyEdit(false)}>Отмена</button></form>` : null}
        <div class="set-row">
          <span class="grow"><b>Озвучка реплик</b><span class="muted sm">${!hasVoice ? html`здесь нет казахского голоса — он есть <a href=${SITE} target="_blank" rel="noopener">в Боте по ссылке</a> и в Microsoft Edge`
            : voice.recorded() ? 'записанные фразы' : `голос: ${voice.name()}`}</span></span>
          <${Toggle} on=${st.settings.voice && hasVoice} disabled=${!hasVoice} label="Озвучка реплик" onChange=${(on) => update((d) => { d.settings.voice = on; })} />
        </div>
        <div class="set-row">
          <span class="grow"><b>Запись голоса</b><span class="muted sm">${micUsable ? 'в заданиях «Скажи вслух»; запись остаётся на телефоне'
            : html`здесь микрофон недоступен — запись работает <a href=${SITE} target="_blank" rel="noopener">в Боте по ссылке</a>`}</span></span>
          <${Toggle} on=${st.settings.mic && micUsable} disabled=${!micUsable} label="Запись голоса"
            onChange=${(on) => { if (on) micTrouble = ''; update((d) => { d.settings.mic = on; }); }} />
        </div>
        <div class="set-row">
          <span class="grow"><b>Перевод сразу</b><span class="muted sm">иначе — по нажатию на фразу</span></span>
          <${Toggle} on=${st.settings.trAuto} label="Перевод сразу" onChange=${(on) => update((d) => { d.settings.trAuto = on; })} />
        </div>
        <div class="set-row">
          <span class="grow"><b>Печатать ответы</b><span class="muted sm">в «Ответь», «Собери фразу» и в повторении — клавиатурой, а не выбором</span></span>
          <${Toggle} on=${!!st.settings.typing} label="Печатать ответы" onChange=${(on) => update((d) => { d.settings.typing = on; })} />
        </div>
        <div class="set-row">
          <span class="grow"><b>Режим «Малыш»</b><span class="muted sm">${st.profile.mode === 'baby' ? 'своя вкладка, приложение открывается с неё' : 'фразы для родителей — в «Разговорнике»'}</span></span>
          <${Toggle} on=${st.profile.mode === 'baby'} label="Режим «Малыш»" onChange=${(on) => update((d) => { d.profile.mode = on ? 'baby' : 'talk'; })} />
        </div>
        ${stats.ready() ? html`<div class="set-row">
          <span class="grow"><b>Анонимная статистика</b><span class="muted sm">помогает улучшать Боту · <button type="button" class="inline-link" onClick=${() => setStatsInfo(true)}>что отправляется</button></span></span>
          <${Toggle} on=${st.settings.stats} label="Анонимная статистика" onChange=${(on) => update((d) => { d.settings.stats = on; d.seen.stats = 'asked'; })} />
        </div>
        <div class="set-row">
          <span class="grow"><b>Написать нам</b><span class="muted sm">что понравилось, что мешает</span></span>
          <button type="button" class="btn-chip" onClick=${() => setWriting(true)}>Написать</button>
        </div>` : null}
        <div class="set-row"><span class="grow"><b>Язык объяснений</b><span class="muted sm">Русский · English и 中文 — скоро</span></span></div>
      </section>
      <section class="card transfer">
        <span class="eyebrow">ПЕРЕНЕСТИ ПРОГРЕСС</span>
        <span class="sm">Прогресс хранится на этом устройстве. Сохрани его в файл и загрузи на новом телефоне или в другом браузере: уроки, память и серия сложатся.</span>
        <div class="row-btns">
          <button type="button" class="btn-chip" onClick=${exportProgress}><${Icon} name="file" size=${16} /> Сохранить в файл</button>
          <button type="button" class="btn-chip" onClick=${() => fileInput.current && fileInput.current.click()}>Загрузить из файла</button>
        </div>
        <input type="file" accept=".json,application/json" hidden ref=${fileInput} onChange=${importProgress} aria-label="Файл прогресса" />
        ${transfer ? html`<span class="muted sm" role="status">${transfer}</span>` : null}
      </section>
      <section class="card danger">
        ${confirmReset ? html`<span><b>Сбросить весь прогресс?</b><span class="muted sm">Разговоры, память и серия на этом устройстве удалятся.</span></span>
          <div class="row-btns"><button type="button" class="btn-chip danger-btn" onClick=${() => { update((d) => { const f = fresh(); Object.keys(d).forEach((k) => delete d[k]); Object.assign(d, f); }); homeLevel = null; go('welcome'); }}>Сбросить</button>
            <button type="button" class="btn-chip" onClick=${() => setConfirmReset(false)}>Отмена</button></div>`
          : html`<button type="button" class="btn-chip" onClick=${() => setConfirmReset(true)}>Сбросить прогресс</button>`}
      </section>
      <p class="muted sm foot">MVP 0.1 · фразы — черновик, их проверит носитель языка.${voice.recorded()
        ? ` Озвучка: ${voice.credit() || 'записанные фразы'}; ударение в записи может ошибаться.` : ''}</p>
    </div>
    <${TabBar} tab="profile" go=${go} st=${st} />
    ${remind ? html`<${RemindSheet} was=${st.seen.remind} onClose=${() => setRemind(false)}
      onSet=${(time) => { update((d) => { d.seen.remind = time; }); setRemind(false); }} />` : null}
    ${statsInfo ? html`<${StatsSheet} onClose=${() => setStatsInfo(false)} />` : null}
    ${writing ? html`<${FeedbackSheet} where="profile" onClose=${() => setWriting(false)} />` : null}
  </main>`;
}

/* ---------- app ---------- */

const INITIAL = load();

function routeAfterStart(st) {
  if (!st.profile.onboarded) return { name: 'welcome' };
  return { name: st.profile.mode === 'baby' ? 'baby' : 'home' };
}

// One screen up from each screen — where the arrow in its corner leads; null on the first screen.
// In the talk mode «Малыш» opens from the phrasebook.
function upRoute(route, st) {
  const start = st.profile.mode === 'baby' ? 'baby' : 'home';
  switch (route.name) {
    case 'topic': return { name: route.back || 'home' };
    case 'test': return { name: route.back || 'home' };
    case 'review': return { name: route.back || 'home' };
    case 'conv': return { name: 'topic', ti: route.ti, back: route.back };
    case 'race': return route.ti != null ? { name: 'topic', ti: route.ti, back: route.back } : { name: 'home' };
    case 'rules': return { name: route.back || 'phrasebook' };
    case 'babyScen': return { name: route.back || 'baby' };
    case 'babyAll': case 'babyDay': return { name: 'baby' };
    case 'babyPrep': return route.back === 'babyScen' ? { name: 'babyScen', id: route.id, back: route.from } : { name: 'baby' };
    case 'baby': return start === 'baby' ? null : { name: 'phrasebook' };
    case 'home': case 'phrasebook': case 'profile': return route.name === start ? null : { name: start };
    case 'onboard': return st.profile.onboarded ? null : { name: 'welcome' };
    default: return null;
  }
}

function App() {
  const [st, setSt] = useState(INITIAL);
  // A fact is shown once: the splash keeps the fact it opened with, even past midnight. A newcomer
  // meets Bota first; the fact waits for a later start.
  const [route, setRoute] = useState(() => {
    const fact = INITIAL.profile.onboarded ? startFact(INITIAL) : null;
    return fact ? { name: 'splash', fact } : routeAfterStart(INITIAL);
  });
  const shown = useRef({ route, st });
  shown.current = { route, st };
  // The phone's «Назад»: an open sheet closes; otherwise the app goes one screen up and keeps the
  // entry ahead for the next time; on the first screen the page is left as usual.
  useEffect(() => {
    if (!OWN_HISTORY) return undefined;
    armBack();
    const onPop = () => {
      const close = closers[closers.length - 1];
      if (close) { close(); armBack(); return; }
      const up = upRoute(shown.current.route, shown.current.st);
      if (!up) { history.back(); return; }
      voice.stop();
      setRoute(up);
      armBack();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [, setTick] = useState(0);
  const [storageNoted, setStorageNoted] = useState(false);
  useEffect(() => voice.init(() => setTick((x) => x + 1)), []);
  // The pilot's statistics: set up once and the start of this visit counted; consent follows the setting.
  useEffect(() => {
    stats.setup({ consent: INITIAL.settings.stats === true, version: VERSION, standalone: standalone() });
    stats.track('start', { screen: route.name, days: Object.keys(INITIAL.days).length, lessons: Object.keys(INITIAL.done).length });
  }, []);
  useEffect(() => { stats.setConsent(st.settings.stats === true); }, [st.settings.stats]);
  // On the site the browser is asked to keep the progress even when space runs short. It asks no
  // one: browsers grant it to an app put on the home screen, so each start asks again until then.
  useEffect(() => {
    if (!SITE_BUILD || !st.profile.onboarded || st.seen.persist === 'yes' || !navigator.storage || !navigator.storage.persist) return;
    navigator.storage.persist().then((kept) => { if (kept) update((d) => { d.seen.persist = 'yes'; }); }, () => {});
  }, [st.profile.onboarded]);
  // Phrases of the topics the entrance test found known: five a day (FEED_N), due at once.
  const today = dayKey();
  useEffect(() => {
    if (!feedDue(st)) return;
    update((d) => {
      if (!feedDue(d)) return;
      const n = fedToday(d);
      const ids = knownToFeed(d).slice(0, FEED_N - n);
      const now = Date.now();
      ids.forEach((id) => { d.mem[id] = fsrs.unrated(now); });
      d.place.fed = { day: dayKey(), n: n + ids.length };
    });
  }, [today, st.place.day]);
  // Progress saved in another tab replaces this tab's copy before it can be overwritten.
  useEffect(() => {
    const sync = () => setSt((prev) => latest(prev));
    const onStorage = (e) => { if (e.key === KEY) sync(); };
    const onShow = () => { if (document.visibilityState === 'visible') sync(); };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onShow);
    return () => { window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', onShow); };
  }, []);

  const update = (fn) => setSt((prev) => {
    const next = JSON.parse(JSON.stringify(latest(prev)));
    fn(next);
    save(next);
    return next;
  });
  const go = (name, params = {}) => {
    voice.stop();
    // Left on the first screen by «Назад» once, the page arms it again for the screens below.
    armBack();
    setRoute({ name, ...params });
  };

  let screen;
  switch (route.name) {
    case 'splash':
      screen = html`<${Splash} fact=${route.fact} onNext=${() => {
        const f = route.fact;
        // One fact a day: a fact of a date takes the place of that day's history.
        update((d) => {
          if (f.hist === undefined) d.seen.fact = f.key;
          else d.seen.hist = f.hist + 1;
          d.seen.histDay = dayKey();
        });
        setRoute(routeAfterStart(st));
      }} />`;
      break;
    case 'welcome':
      // A file of progress brought here may hold a whole course: then its screen opens at once.
      screen = html`<${Welcome} st=${st} update=${update} onNext=${() => go('onboard')} onLoaded=${(merged) => setRoute(routeAfterStart(merged))} />`;
      break;
    case 'onboard':
      // After meeting Bota the first conversation opens at once (with Әже), or the entrance test for
      // those who know some Kazakh already; parents go to «Малыш».
      screen = html`<${Onboard} st=${st} update=${update} done=${(mode, test) => {
        const nx = mode === 'baby' ? null : nextUp(st);
        if (test) go('test', { id: 'place' });
        else if (nx) goStep(go, nx);
        else go(mode === 'baby' ? 'baby' : 'home');
      }} />`;
      break;
    case 'test':
      screen = html`<${TestScreen} key=${`test-${route.id}-${route.k || 0}`} st=${st} update=${update} go=${go} id=${route.id} back=${route.back} />`;
      break;
    case 'topic':
      screen = html`<${TopicScreen} st=${st} ti=${route.ti} go=${go} back=${route.back} />`;
      break;
    case 'conv':
      screen = html`<${ConvScreen} key=${`${route.ti}-${route.ci}-${route.k || 0}`} st=${st} update=${update} ti=${route.ti} ci=${route.ci} go=${go} back=${route.back} />`;
      break;
    case 'review':
      screen = html`<${Review} key=${`review-${route.k || 0}`} st=${st} update=${update} go=${go} only=${route.only} back=${route.back} />`;
      break;
    case 'race':
      screen = html`<${RaceScreen} key=${`race-${route.ti ?? 'mix'}-${route.k || 0}`} st=${st} update=${update} go=${go} ti=${route.ti}
        quick=${!!route.quick} setup=${!!route.setup} duel=${route.duel} back=${route.back} />`;
      break;
    case 'phrasebook':
      screen = html`<${Phrasebook} st=${st} update=${update} go=${go} />`;
      break;
    case 'rules':
      screen = html`<${RulesScreen} st=${st} update=${update} go=${go} back=${route.back} />`;
      break;
    case 'baby':
      screen = html`<${Baby} st=${st} update=${update} go=${go} />`;
      break;
    case 'babyAll':
      screen = html`<${BabyAll} st=${st} go=${go} />`;
      break;
    case 'babyScen':
      screen = html`<${BabyScenario} key=${route.id} st=${st} go=${go} id=${route.id} back=${route.back} />`;
      break;
    case 'babyPrep':
      screen = html`<${BabyPrep} key=${`prep-${route.id}-${route.k || 0}`} st=${st} update=${update} go=${go} id=${route.id} back=${route.back} from=${route.from} />`;
      break;
    case 'babyDay':
      screen = html`<${BabyDay} st=${st} update=${update} go=${go} />`;
      break;
    case 'profile':
      screen = html`<${Profile} st=${st} update=${update} go=${go} />`;
      break;
    default:
      screen = html`<${Home} st=${st} go=${go} update=${update} />`;
  }
  // The notice lets taps through to the screen and can be closed.
  return html`${screen}${storageOk || storageNoted ? null : html`<div class="toast" role="status">
    <span>Браузер не даёт сохранить прогресс: после закрытия страницы он пропадёт.</span>
    <button type="button" class="toast-ok" onClick=${() => setStorageNoted(true)}>Понятно</button></div>`}`;
}

// A screen that fails to draw shows a way out instead of a blank page.
function Safe({ children }) {
  const [error] = useErrorBoundary();
  useEffect(() => { if (error) trackError(error.message || error, 'render'); }, [error]);
  if (!error) return children;
  const restart = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) keepCopy(raw);
      localStorage.removeItem(KEY);
    } catch (e) { /* nothing to keep */ }
    location.reload();
  };
  // The progress as the file of «Перенести прогресс»: it opens in «Профиль» → «Загрузить из файла».
  const saveCopy = async () => {
    let progress = null;
    try { progress = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* not readable */ }
    if (isObj(progress)) await saveFile(`bota-progress-${dayKey()}.json`, JSON.stringify({ app: 'bota', format: 1, saved: new Date().toISOString(), progress }));
  };
  return html`<main class="screen"><div class="scroll pad crash">
    <${Bota} size=${56} />
    <b class="h2">Что-то пошло не так</b>
    <span class="muted">Обновите страницу. Если не поможет — сохраните прогресс в файл и начните заново: файл потом загружается в «Профиле».</span>
    <button type="button" class="btn btn-primary btn-block" onClick=${() => location.reload()}>Обновить</button>
    <button type="button" class="btn btn-ghost btn-block" onClick=${saveCopy}>Сохранить прогресс в файл</button>
    <button type="button" class="btn btn-ghost btn-block" onClick=${restart}>Начать заново</button>
  </div></main>`;
}

clearTimeout(window.botaBoot);
document.documentElement.lang = 'ru';
const mount = document.getElementById('app');
mount.textContent = '';
render(html`<${Safe}><${App} /><//>`, mount);
if (document.readyState === 'complete') registerWorker();
else window.addEventListener('load', registerWorker);
