// Бота — MVP: conversational Kazakh for Russian speakers.
import { html, render, useState, useEffect, useRef, useMemo, useErrorBoundary } from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js';
import { KINDS, CITIES, JOBS, HOBBIES, CHOICES, PEOPLE, PHRASES, TOPICS, LEVELS, RULES, RESCUE, PHRASEBOOK, BABY, BABY_GROUPS, BABY_AGES, BABY_GOAL, FACTS, RACE_APART } from './content.js?v=e1f9ffb';
import * as fsrs from './fsrs.js?v=e1f9ffb';
import * as voice from './voice.js?v=e1f9ffb';
import * as mic from './mic.js?v=e1f9ffb';
import { KZ_LETTERS, checkTyped, normType, plain } from './typing.js?v=e1f9ffb';
import { Icon, PlayGlyph, SpeakerGlyph, Sun, Logo, Bota, Avatar, Yurt, Photo, Shanyrak, Wave } from './art.js?v=e1f9ffb';

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
    baby: { name: '', age: '', said: {} },
    // «Бәйге»: the best time of every race (a topic id, or mix), how often each word was mixed up,
    // and the name of the last rival in a duel on this phone.
    race: { best: {}, miss: {}, runs: 0, rival: '' },
    // trAuto: translations under every line from the start; otherwise a tap on a line shows its own.
    // mic: «Скажи вслух» records the phrase with the microphone where the browser allows it.
    settings: { voice: true, trAuto: false, mic: true },
    // fact: the key of the last fact of the day shown (its date this year); install: 'never' once the
    // learner turned down «Поставь Боту на экран»; persist: what the browser said to keeping storage;
    // remind: the time of the daily reminder the learner put into the phone's calendar.
    seen: { fact: '', noVoice: false, trTap: false, install: '', persist: '', remind: '' },
  };
}

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

// Old or damaged progress must not break the app: every field is checked, and a record that
// cannot be read is kept under another key rather than overwritten.
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
    try { localStorage.setItem(`${KEY}-broken`, raw); } catch (e) { /* the copy is a courtesy */ }
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
    mem: Object.fromEntries(Object.entries(obj(d.mem)).filter(([, c]) => isObj(c) && Number.isFinite(c.due))),
    baby: { ...base.baby, ...obj(d.baby), said: obj(obj(d.baby).said) },
    race: {
      best: counts(race.best), miss: counts(race.miss), runs: Number.isFinite(race.runs) ? race.runs : 0,
      rival: typeof race.rival === 'string' ? race.rival.slice(0, 24) : '',
    },
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
  Object.entries(there.race.best).forEach(([k, ms]) => { if (!out.race.best[k] || ms < out.race.best[k]) out.race.best[k] = ms; });
  Object.entries(there.race.miss).forEach(([k, n]) => { out.race.miss[k] = Math.max(out.race.miss[k] || 0, n); });
  out.race.runs = Math.max(out.race.runs, there.race.runs);
  out.race.rival = out.race.rival || there.race.rival;
  return out;
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
window.addEventListener('appinstalled', () => { installPrompt = null; installChanged(); });

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
    note: 'С иконки Safari не сотрёт прогресс, даже если неделю не заниматься, а уроки откроются и без интернета.',
  },
  other: {
    title: 'Поставь Боту на экран телефона',
    steps: ['Открой меню браузера ⋮.', 'Выбери «Установить приложение» или «Добавить на главный экран».', 'Открывай Боту с иконки, как обычное приложение.'],
    note: 'Так прогресс хранится надёжнее, а уроки открываются и без интернета.',
  },
};

// Offered on the site, outside the installed app, once the learner has done something worth keeping.
const installDue = (st) => SITE_BUILD && !standalone() && st.seen.install !== 'never'
  && (Object.keys(st.done).length > 0 || Object.keys(st.baby.said || {}).length > 0);

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
  const chosen = () => setTimeout(() => onSet(time), 300);
  const file = { href: remindFile(time), download: ios ? null : `bota-${time.replace(':', '')}.ics` };
  const google = { href: remindGoogle(time), target: '_blank', rel: 'noopener' };
  const [main, other] = ios ? [file, google] : [google, file];
  return html`<div class="sheet-back" onClick=${onClose}>
    <div class="sheet pad" ref=${box} role="dialog" aria-modal="true" aria-label="Напоминать каждый день" onClick=${(e) => e.stopPropagation()}>
      <span class="sheet-grip" aria-hidden="true"></span>
      <h2 class="h2" tabindex="-1">Напоминать каждый день</h2>
      <p class="muted sm">В календарь телефона добавится событие на каждый день — календарь и напомнит.${was ? ' Прежнее напоминание останется: его можно удалить в календаре.' : ''}</p>
      <div class="age-chips" role="group" aria-label="Время напоминания">${REMIND_TIMES.map((t) => html`
        <button type="button" class=${'chip-btn' + (time === t ? ' sel' : '')} aria-pressed=${time === t} onClick=${() => setTime(t)}>${t}</button>`)}</div>
      <a class="btn btn-primary btn-block" ...${main} onClick=${chosen}><${Icon} name="calendar" size=${20} /> Добавить в календарь</a>
      <span class="done-links"><a class="link-btn" ...${other} onClick=${chosen}>${ios ? 'Google Календарь' : 'Файл для календаря'}</a>
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

function phrase(id) {
  if (isWord(id)) return WORDS.get(id.slice(2)) || null;
  if (PHRASES[id]) return PHRASES[id];
  const rescue = RESCUE.find((x) => x.id === id);
  if (rescue) return rescue;
  const m = /^pb\.([a-z])(\d)$/.exec(id);
  if (m) {
    const cat = PHRASEBOOK.find((c) => c.id === m[1]);
    const it = cat && cat.items[Number(m[2])];
    if (it) return { kk: it[0], ru: it[1] };
  }
  return null;
}

const PLAYABLE = TOPICS.filter((t) => !t.soon);
const ALL_CONVS = PLAYABLE.flatMap((t, ti) => t.convs.map((c, ci) => ({ t, ti, c, ci })));
const levelOf = (id) => LEVELS.find((l) => l.id === id) || LEVELS[0];
const OPEN_LEVELS = LEVELS.filter((l) => !l.soon);

// Lessons open one after another; the first lesson of every level is open from the start,
// so a learner who knows the basics can begin with the city.
function convOpen(st, ti, ci) {
  const idx = ALL_CONVS.findIndex((x) => x.ti === ti && x.ci === ci);
  if (idx <= 0) return true;
  const prev = ALL_CONVS[idx - 1];
  if (prev.t.level !== ALL_CONVS[idx].t.level) return true;
  return !!st.done[ALL_CONVS[idx].c.id] || !!st.done[prev.c.id];
}

const isSkill = (c) => c.kind === 'pron' || c.kind === 'write';

// The lesson after the furthest one done (in one level, or in the whole course);
// lessons left behind come after the end.
function nextUp(st, level) {
  const list = level ? ALL_CONVS.filter((x) => x.t.level === level) : ALL_CONVS;
  let last = -1;
  list.forEach((x, i) => { if (st.done[x.c.id]) last = i; });
  return list[last + 1] || list.find((x) => !st.done[x.c.id]) || null;
}

const topicDone = (st, t) => t.convs.filter((c) => st.done[c.id]).length;

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

function StreakPill({ n }) {
  return html`<span class="streak"><${Sun} size=${18} />${n > 0 ? `${n} ${plural(n, DAY_W)}` : 'начни серию'}</span>`;
}

/* ---------- 00 · fact of the day ---------- */

function Splash({ fact, onNext }) {
  if (!fact) return null;
  return html`<main class="screen splash">
    <div class="scroll pad splash-in">
      <div class="brand"><${Logo} size=${28} /><span>Бота</span></div>
      <article class="fact-card">
        <span class="eyebrow">${fact.today ? 'В ЭТОТ ДЕНЬ В ИСТОРИИ' : 'НА ЭТОЙ НЕДЕЛЕ В ИСТОРИИ'}</span>
        <span class="eyebrow-kk" lang="kk">${fact.today ? 'бұл күні тарихта' : 'осы аптада тарихта'}</span>
        <div class="fact-date"><span class="d">${fact.date}</span><span class="y">${fact.year}</span></div>
        <p class="fact-kk" lang="kk">${fact.kk} <${SpeakBtn} text=${fact.kk} small /></p>
        <p class="fact-ru">${fact.ru}</p>
        <div class="fact-meta"><span class="chip">Где: ${fact.place}</span></div>
        <div class="fact-word"><span class="muted sm">слово из факта</span>
          <span><b>${fact.word}</b> — ${fact.wordRu} <${SpeakBtn} text=${fact.word} small /></span></div>
        <span class="fact-src">Источник: ${fact.source}</span>
      </article>
    </div>
    <div class="bottom pad on-night"><button type="button" class="btn btn-light btn-block" onClick=${onNext}>Продолжить</button></div>
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
  const [minutes, setMinutes] = useState(st.profile.minutes || 10);
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

  const finish = () => {
    if (!settled()) return;
    update((d) => { d.profile = { ...d.profile, name: clean, mode, minutes, onboarded: true }; });
    done(mode);
  };

  const modes = [
    ['talk', 'Говорить по-казахски', 'с соседями, на работе, в городе'],
    ['baby', 'Говорить с малышом', 'фразы на каждый день для родителей'],
  ];

  // Russian is the only language of explanations so far: there is nothing to choose yet, and Bota
  // just says it. English and Chinese will bring the choice back as the first step.
  let panel;
  if (step === 0) {
    panel = html`<form class="panel-in" onSubmit=${(e) => { e.preventDefault(); if (clean) toStep(1); }}>
      <label class="field-label" for="ob-name">Твоё имя</label>
      <input id="ob-name" class="field" type="text" autocomplete="given-name" maxlength="24" placeholder="Например, Мадияр"
        value=${name} onInput=${(e) => setName(e.target.value)} />
      <button type="submit" class="btn btn-primary btn-block" disabled=${!clean}>Дальше</button>
    </form>`;
  } else if (step === 1) {
    panel = html`<div class="panel-in">
      <div class="opts">${modes.map(([id, title, sub]) => html`
        <button type="button" class=${'opt mode' + (mode === id ? ' sel' : '')} aria-pressed=${mode === id} onClick=${() => setMode(id)}>
          <span>${title}</span><small>${sub}</small></button>`)}</div>
      <button type="button" class="btn btn-primary btn-block" onClick=${() => toStep(2)}>Дальше</button>
    </div>`;
  } else {
    panel = html`<div class="panel-in">
      <div class="minutes">${[5, 10, 15].map((m) => html`
        <button type="button" class=${'min' + (minutes === m ? ' sel' : '')} aria-pressed=${minutes === m} onClick=${() => setMinutes(m)}>
          <b>${m}</b><span>минут</span></button>`)}</div>
      <span class="muted sm center">Это примерно ${minutes === 5 ? 'три урока' : minutes === 10 ? 'шесть уроков' : 'девять уроков'} в день</span>
      <button type="button" class="btn btn-primary btn-block" onClick=${finish}>Начать</button>
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
        ${step > 1 ? html`
          <div class="b b-me">${modes.find((m) => m[0] === mode)[1]}</div>
          <${BotaSays}>Сколько минут в день будем заниматься?<//>` : null}
      </div>
    </div>
    <div class="composer pad">${panel}</div>
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
  return list.filter((x) => st.done[x.c.id]).length / list.length;
};

// One circle at a time: the people of the chosen level around the yurt. Earlier levels fold
// into thin gold rings right around the yurt, the next level waits on the outer dashed ring: its
// name runs along that ring, so that it does not read as the name of the person at the top.
function CircleMap({ st, go, level }) {
  const lv = levelOf(level);
  const items = PLAYABLE.map((t, ti) => ({ t, ti })).filter((x) => x.t.level === level);
  const nx = nextUp(st, level);
  const doneTopics = items.filter(({ t }) => topicDone(st, t) === t.convs.length).length;
  const circ = 2 * Math.PI * RING_R;
  const frac = levelFrac(st, level);
  const after = LEVELS[LEVELS.indexOf(lv) + 1];
  const before = LEVELS.slice(0, LEVELS.indexOf(lv));
  return html`<div class="map">
    <svg class="map-svg" viewBox="0 0 342 342" aria-hidden="true">
      <circle cx="171" cy="171" r="160" class="ring2"></circle>
      <circle cx="171" cy="171" r=${RING_R} class="ring1"></circle>
      ${frac > 0 ? html`<circle cx="171" cy="171" r=${RING_R} class="ring1-done"
        stroke-dasharray=${`${(circ * frac).toFixed(1)} ${circ.toFixed(1)}`} transform="rotate(-90 171 171)"></circle>` : null}
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
    <span class="map-center"><b>${lv.title.toLowerCase()} · ${lv.id}</b><span>${doneTopics} из ${items.length} тем</span></span>
    ${items.map(({ t, ti }, i) => {
      const n = topicDone(st, t);
      const isCur = !!nx && nx.ti === ti;
      const status = n === t.convs.length ? 'done' : isCur ? 'cur' : convOpen(st, ti, 0) ? 'open' : 'locked';
      const [x, y] = slotXY(i, items.length);
      const size = isCur ? 56 : 40;
      // The current person's name is on the card below the map, so the map carries no labels.
      return html`<button type="button" class=${'av-btn' + (isCur ? ' cur' : '')}
        style=${`left:${((x / 342) * 100).toFixed(2)}%;top:${((y / 342) * 100).toFixed(2)}%;--half:${size / 2}px`}
        aria-label=${`${PEOPLE[t.who].name}: ${t.title}, ${status === 'locked' ? 'откроется позже' : `${n} из ${t.convs.length}`}`} onClick=${() => go('topic', { ti })}>
        <${AvatarRing} who=${t.who} size=${size} status=${status} frac=${n / t.convs.length} />
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
    return html`<section class="card next">
      <span class="muted sm">${lv.id} · все ${count} тем пройдены</span>
      <b class="h3">Круг ${lv.of} пройден!${after ? ` Следующий круг — ${after.title.toLowerCase()}, ${after.id}${open ? '' : ' — готовится'}` : ''}</b>
      ${open ? html`<button type="button" class="btn btn-primary btn-block" onClick=${() => setLevel(after.id)}>Перейти в круг «${after.title}»</button>`
        : html`<button type="button" class="btn btn-primary btn-block" onClick=${() => go('review')}>Освежить память</button>`}
    </section>`;
  }
  const first = Object.keys(st.done).length === 0;
  const kind = nx.c.kind;
  const lesson = () => go('conv', { ti: nx.ti, ci: nx.ci });
  if (reviewFirst(st)) {
    const due = dueList(st);
    return html`<section class="card next">
      <span class="muted sm">сначала — память, потом ${isSkill(nx.c) ? 'урок' : 'разговор'}</span>
      <b class="h3">${cardsText(due)} ${agree(due, 'ждёт', 'ждут')} повторения</b>
      <button type="button" class="btn btn-primary btn-block" onClick=${() => go('review')}><${Icon} name="ornament" size=${20} /> Освежить память</button>
      <span class="done-links"><button type="button" class="link-btn" onClick=${lesson}>${isSkill(nx.c) ? 'Сразу к уроку' : 'Сразу к разговору'}</button></span>
    </section>`;
  }
  return html`<section class="card next">
    <span class="muted sm">${nx.t.title.toLowerCase()} · урок ${nx.ci + 1} из ${nx.t.convs.length}</span>
    <b class="h3">${nextTitle(nx)}</b>
    <button type="button" class="btn btn-primary btn-block" onClick=${lesson}>
      <${Icon} name=${isSkill(nx.c) ? KINDS[kind].icon : 'chat'} size=${20} /> ${first ? 'Начать первый разговор' : isSkill(nx.c) ? 'Начать урок' : 'Продолжить разговор'}
    </button>
  </section>`;
}

// What the next lesson is, said as an invitation of its person.
function nextTitle(nx) {
  const p = PEOPLE[nx.t.who];
  const kind = nx.c.kind;
  return kind === 'pron' ? `Урок произношения: ${lc(nx.c.title)}`
    : kind === 'write' ? `${p.name} ждёт твоего сообщения`
    : kind === 'listen' ? `${p.name} хочет с тобой поговорить` : `${p.name} ждёт твоего ответа`;
}

// From the second day the day begins with memory: what fades comes before the next lesson, once a
// day; the lesson stays one tap away.
const reviewFirst = (st) => !st.reviews[dayKey()] && dueList(st).length > 0;

function MemRow({ st, go }) {
  const all = Object.keys(st.mem).filter((id) => phrase(id));
  if (!all.length) return null;
  const due = dueList(st);
  return html`<button type="button" class="mem-row" onClick=${() => go('review')}>
    <span class="mem-ic"><${Icon} name="ornament" size=${22} /></span>
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
// Lessons done for the first time today, and memory reviews finished today: a review is a lesson too.
const doneToday = (st) => Object.values(st.done).filter((d) => d === dayKey()).length + (st.reviews[dayKey()] || 0);

function Home({ st, go, update }) {
  const v = varsOf(st);
  const [level, setLevelState] = useState(() => homeLevel || (nextUp(st) || { t: LEVELS[0] }).t.level || LEVELS[0].id);
  const setLevel = (id) => { homeLevel = id; setLevelState(id); };
  const today = doneToday(st);
  const goal = goalOf(st);
  const [install, installSheet] = useInstall(update);
  return html`<main class="screen">
    <div class="scroll pad home">
      <header class="home-head"><span class="grow"><h1 class="h1">Привет, ${v.name}!</h1>
        <span class="muted sm">${today >= goal ? `Цель дня выполнена: ${today} ${plural(today, LESSON_W)}` : `Сегодня ${today} из ${goal} ${plural(goal, LESSON_W)}`}</span></span>
        <${StreakPill} n=${streakOf(st.days)} /></header>
      <div class="levels" role="tablist" aria-label="Круги общения">${OPEN_LEVELS.map((l) => html`
        <button type="button" role="tab" aria-selected=${level === l.id} class=${'level' + (level === l.id ? ' on' : '')} onClick=${() => setLevel(l.id)}>
          ${l.tab || l.title} <span>${l.id}</span></button>`)}</div>
      <${CircleMap} st=${st} go=${go} level=${level} />
      <${NextCard} st=${st} go=${go} level=${level} setLevel=${setLevel} />
      ${reviewFirst(st) && nextUp(st, level) ? null : html`<${MemRow} st=${st} go=${go} />`}
      <${RaceRow} st=${st} go=${go} />
      <${InstallRow} st=${st} onOpen=${install} />
    </div>
    <${TabBar} tab="home" go=${go} st=${st} />
    ${installSheet}
  </main>`;
}

/* ---------- topic: one person, four conversations ---------- */

function TopicScreen({ st, ti, go }) {
  const t = PLAYABLE[ti];
  if (!t) return null;
  const p = PEOPLE[t.who];
  const v = varsOf(st);
  const rows = t.convs.map((c, ci) => ({ c, ci, done: !!st.done[c.id], open: convOpen(st, ti, ci) }));
  const target = rows.find((r) => r.open && !r.done);
  const learn = [...new Set(t.convs.flatMap((c) => c.teaches || []))].map((id) => phrase(id)).filter(Boolean).slice(0, 6);
  // A topic that is not open yet sends the learner to the lesson that opens it, not into a locked one.
  const before = !target && !rows.every((r) => r.done) ? nextUp(st, t.level) : null;
  const race = raceOpen(st, t);
  // A topic passed in full offers its race; its lessons stay in the list to go through again.
  const passed = !target && !before;
  const cta = target ? `Начать: ${KINDS[target.c.kind].label.toLowerCase()}`
    : before ? `Сначала: ${before.t.title.toLowerCase()}` : race ? 'Бәйге — скачки по теме' : 'Пройти тему ещё раз';
  const start = target || before || { ti, ci: 0 };
  const onCta = () => (passed && race ? go('race', { ti }) : go('conv', { ti: start.ti ?? ti, ci: start.ci }));
  return html`<main class="screen">
    <${TopBar} title=${t.title} sub=${t.kk} subLang="kk" onBack=${() => go('home')} backLabel="Вернуться в «Мой круг»" />
    <div class="scroll pad topic">
      <div class="person"><${Avatar} who=${t.who} size=${64} />
        <span><b class="h3">${p.name}</b><span class="muted sm">${p.ru} · ${t.convs.length} ${plural(t.convs.length, LESSON_W)} по 1–2 минуты</span></span></div>
      <ol class="conv-list">${rows.map((r) => html`<li>
        <button type="button" class=${'conv-row ' + (r.done ? 'done' : r.open ? 'open' : 'locked')} disabled=${!r.open} onClick=${() => go('conv', { ti, ci: r.ci })}>
          <span class="conv-ic"><${Icon} name=${KINDS[r.c.kind].icon} size=${20} /></span>
          <span class="grow"><b>${KINDS[r.c.kind].label}</b><span class="muted sm">${r.c.title}</span></span>
          ${r.done ? html`<span class="state ok" aria-label="пройден"><${Icon} name="check" size=${16} stroke=${3} /></span>`
            : r.open ? html`<span class="state now">сейчас</span>`
            : html`<span class="state" aria-label="закрыт"><${Icon} name="lock" size=${16} /></span>`}
        </button></li>`)}</ol>
      ${race && !passed ? html`<button type="button" class="conv-row race-row" onClick=${() => go('race', { ti })}>
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

const isTurn = (s) => !!(s.check || s.pick || s.build || s.say || s.choose || s.pair || s.type);

function autoMsg(step, v, topic) {
  if (step.note) return { k: 'note', text: val(step.note, v) };
  if (step.sound) return { k: 'sound', sound: step.sound, how: step.how, words: step.words };
  if (step.tip) return { k: 'tip', text: val(step.tip, v) };
  if (step.img) return { k: 'img', art: step.img, me: !!step.me };
  return { k: 'npc', who: step.who || topic.who, kk: val(step.npc, v), ru: val(step.ru, v) };
}

// A line of the other person shows its translation when tr is on; a tap on the line toggles it.
// The learner's own line always shows it: the answer is given by then.
function Msg({ m, tr, hint, topic, onRule, onTr }) {
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
  // The learner's voice message: ▶ plays the recording (and calls off one under way). Said without a
  // microphone, the line is the phrase marked «сказал(а) вслух» — no drawn recording that never was.
  if (m.k === 'voice') {
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
      <span class="b-kk sm" lang="kk">${m.kk}</span>
      ${voice.canSay(m.kk) ? html`<span class="b-said-row"><button type="button" class="b-sample" onClick=${sample}>сравни с образцом</button></span>` : null}</div>`;
  }
  const other = m.who !== topic.who;
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

// listen: a question about what was heard; with a Kazakh voice a wrong answer suggests listening again.
function CheckPanel({ step, listen, auto, onDone, onHint }) {
  // Syllables of a word keep their order; other answers are shuffled.
  const order = useMemo(() => (step.keep ? step.opts.map((_, i) => i) : shuffle(step.opts.map((_, i) => i))), []);
  const [tried, setTried] = useState([]);
  const [right, setRight] = useState(-1);
  const choose = (i) => {
    if (right >= 0) return;
    const x = step.opts[i];
    if (x.ok) {
      setRight(i);
      if (auto && (step.speak || step.kk)) voice.speak(step.speak || x.t);
      setTimeout(onDone, 650);
      return;
    }
    if (!tried.includes(i)) setTried([...tried, i]);
    onHint(`${x.why}${listen && !step.kk && voice.available() ? ' Послушай ещё раз.' : ''}`);
  };
  return html`<div class="panel-in">
    <span class="eyebrow">ВОПРОС</span>
    <p class="q">${step.check}</p>
    <div class=${'opts' + (step.keep ? ' row' : '')}>${order.map((i) => {
      const x = step.opts[i];
      const state = right === i ? ' good' : tried.includes(i) ? ' bad' : '';
      return html`<button type="button" class=${'opt' + (step.kk ? ' kk' : '') + state} lang=${step.kk ? 'kk' : null} onClick=${() => choose(i)}><span>${x.t}</span></button>`;
    })}</div>
  </div>`;
}

function PickPanel({ step, v, tr, onDone, onHint }) {
  const order = useMemo(() => shuffle(step.pick.map((_, i) => i)), []);
  const [sel, setSel] = useState(-1);
  const [tried, setTried] = useState([]);
  const send = () => {
    if (sel < 0) return;
    const o = step.pick[sel];
    if (o.ok) {
      onDone(o);
      return;
    }
    if (!tried.includes(sel)) setTried([...tried, sel]);
    setSel(-1);
    onHint(val(o.why, v));
  };
  return html`<div class="panel-in">
    <span class="eyebrow">ВЫБЕРИ ОТВЕТ</span>
    <div class="opts">${order.map((i) => {
      const x = step.pick[i];
      const state = sel === i ? ' sel' : tried.includes(i) ? ' bad' : '';
      return html`<button type="button" class=${'opt kk' + state} aria-pressed=${sel === i} onClick=${() => setSel(i)}>
        <span lang="kk">${val(x.kk, v)}</span>${tr ? html`<small>${val(x.ru, v)}</small>` : null}</button>`;
    })}</div>
    <button type="button" class="btn btn-primary btn-block" disabled=${sel < 0} onClick=${send}>
      <${Icon} name="send" size=${20} stroke=${2.4} /> Отправить</button>
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

function BuildPanel({ step, v, tr, onDone, onHint }) {
  const answer = step.build.map((w) => fill(w, v));
  const bank = useMemo(() => shuffle([...answer, ...step.extra].map((w, id) => ({ w, id }))), []);
  const [draft, setDraft] = useState([]);
  const [wrong, setWrong] = useState(false);
  const words = draft.map((id) => bank.find((b) => b.id === id).w);
  const extra = words.find((w) => step.why && step.why[w]);
  const why = extra ? step.why[extra] : words.length < answer.length ? 'Не хватает слов — добавь ещё.' : val(step.order, v);
  const send = () => {
    if (!draft.length) return;
    if (words.join(' ') === answer.join(' ')) {
      onDone();
      return;
    }
    setWrong(true);
    onHint(why);
  };
  return html`<div class="panel-in">
    <span class="eyebrow">СОБЕРИ ОТВЕТ${tr ? html`<span class="eyebrow-ru"> · «${val(step.ru, v)}»</span>` : null}</span>
    <div class="build-row">
      <div class=${'build-field' + (wrong ? ' bad' : '')} aria-label="Твой ответ" lang="kk">
        ${words.length ? draft.map((id, i) => html`<button type="button" class="wchip in" aria-label=${`Убрать «${words[i]}»`}
          onClick=${() => { setDraft(draft.filter((x) => x !== id)); setWrong(false); }}>${words[i]}</button>`)
          : html`<span class="muted sm placeholder">Нажимай на слова ниже…</span>`}
      </div>
      <button type="button" class="send-round" aria-label="Отправить ответ" disabled=${!draft.length} onClick=${send}>
        <${Icon} name="send" size=${22} stroke=${2.4} /></button>
    </div>
    <div class="bank" lang="kk">${bank.filter((b) => !draft.includes(b.id)).map((b) => html`
      <button type="button" class="wchip" onClick=${() => { setDraft([...draft, b.id]); setWrong(false); }}>${b.w}</button>`)}</div>
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
function SayPanel({ step, v, tr, st, recall, paused, onPause, onResume, onDone, onHint }) {
  const kk = val(step.say, v);
  const syl = val(step.syl, v);
  // idle → opening (the browser turns the microphone on) → rec → idle
  const [stage, setStage] = useState('idle');
  const [hidden, setHidden] = useState(false);
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
      maxMs: Math.min(15000, 3000 + syllables * 450),
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
    // A try that did not work shows the phrase again, to read it once more.
    const reveal = () => { if (alive.current) setHidden(false); };
    r.done.then((res) => {
      settle();
      const drop = () => { if (res.url) URL.revokeObjectURL(res.url); };
      if (res.cancelled) { reveal(); return; }
      // The lesson was left meanwhile: nobody will play this recording.
      if (!alive.current) { drop(); return; }
      if (!res.heard) {
        drop();
        reveal();
        setStatus('Не слышно. Поднеси телефон ближе и скажи фразу ещё раз.');
        onHint('Тебя не слышно. Поднеси телефон ближе и скажи фразу ещё раз.');
        return;
      }
      // A syllable takes about a fifth of a second: far less sound than that is not the whole phrase.
      if (!asked.current && syllables >= 6 && res.voicedMs < syllables * 55) {
        asked.current = true;
        drop();
        reveal();
        setStatus('Похоже, это не вся фраза. Скажи её целиком.');
        onHint('Похоже, это не вся фраза. Скажи её целиком.');
        return;
      }
      onDone(res);
    }, (e) => {
      settle();
      reveal();
      if (!alive.current) return;
      let code = e && e.code;
      // In a frame (the claude.ai artifact) Safari refuses at once: the frame, not the learner, says no.
      if (code === 'denied' && window.self !== window.top) code = 'blocked';
      if (MIC_NOTE[code]) {
        micTrouble = code;
        micNoted.add(code);
        setFailed(true);
        redraw((n) => n + 1);
      } else setStatus('Не получилось включить микрофон. Попробуй ещё раз.');
    });
  };

  const links = (items) => html`<span class="done-links">${items.map(([label, on], i) => html`${i ? html`<span aria-hidden="true">·</span>` : null}<button type="button" class="link-btn" onClick=${on}>${label}</button>`)}</span>`;
  let action;
  if (trouble) {
    const note = MIC_NOTE[trouble] && (trouble === 'paused' || noteDue || failed) ? MIC_NOTE[trouble] : '';
    const again = trouble === 'paused' ? [['Включить запись', onResume]]
      : trouble === 'denied' || trouble === 'nomic' ? [['Попробовать снова', () => { micTrouble = ''; setFailed(false); redraw((n) => n + 1); }]] : [];
    // From memory without a recording: first the text hides, then the learner says it and taps.
    action = html`${recall && !hidden
      ? html`<button type="button" class="btn btn-primary btn-block" onClick=${() => setHidden(true)}><${Icon} name="mic" size=${20} /> Сказать по памяти</button>`
      : html`<button type="button" class="btn btn-primary btn-block" onClick=${() => onDone(null)}><${Icon} name="mic" size=${20} /> Я сказал(а) вслух</button>`}
      ${note ? html`<span class="muted sm center" role="status">${trouble === 'blocked'
        ? html`Здесь микрофон недоступен — <a href=${SITE} target="_blank" rel="noopener">открой Боту по ссылке</a>, там запись работает.` : note}</span>` : null}
      ${again.length ? links(again) : null}`;
  } else if (stage !== 'idle') {
    action = html`<div class="rec-row" role="status"><span class="rec-dot" aria-hidden="true"></span><span class="sm">${stage === 'opening' ? 'Включаю микрофон…' : 'Слушаю…'}</span>
        <span class="rec-meter" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => html`<i style=${`height:${Math.round(4 + (meter[meter.length - 24 + i] || 0) * 22)}px`}></i>`)}</span></div>
      ${stage === 'opening'
        ? html`<button type="button" class="btn btn-ghost btn-block" onClick=${() => live.current && live.current.cancel()}>Отмена</button>`
        : html`<button type="button" class="btn btn-primary btn-block" onClick=${() => live.current && live.current.stop()}><span class="stop-glyph" aria-hidden="true"></span> Готово</button>`}`;
  } else {
    action = html`<button type="button" class="btn btn-primary btn-block" onClick=${start}><${Icon} name="mic" size=${20} /> ${recall ? 'Сказать по памяти' : 'Записать'}</button>
      ${status ? html`<span class="say-status" role="status">${status}</span>` : null}
      ${links([['Сейчас не могу говорить', onPause]])}`;
  }

  // While the microphone listens, the sample stays silent: it would be recorded as the learner's voice.
  const busy = stage !== 'idle';
  const hint = recall ? (hidden ? '' : 'запомни — текст спрячется') : step.stress ? 'жирным — ударный слог' : 'можно по слогам';
  return html`<div class="panel-in">
    <div class="say-head"><span class="eyebrow">${recall ? 'СКАЖИ ПО ПАМЯТИ' : 'СКАЖИ ВСЛУХ'}</span>${hint ? html`<span class="muted sm">${hint}</span>` : null}</div>
    ${hidden ? html`<div class="say-card">
        <span class="say-mean">«${val(step.ru, v)}»</span>
        <span class="muted sm">Скажи это по-казахски, не глядя на текст.</span>
        <button type="button" class="link-btn peek" onClick=${() => setHidden(false)}>Подсмотреть</button>
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
function TypePanel({ step, v, auto, onDone, onHint }) {
  const answer = val(step.type, v);
  const answers = [answer, ...(step.alt || []).map((a) => val(a, v))];
  const dict = !!step.dict && voice.canSay(answer);
  const [text, setText] = useState('');
  const [hint, setHint] = useState(false);
  const input = useRef(null);
  // Refs, not state: a quick second Enter must see the attempt before it.
  const tries = useRef(0);
  const hinted = useRef(false);
  const sent = useRef(false);
  const showHint = () => { hinted.current = true; setHint(true); };
  useEffect(() => {
    try { input.current.focus({ preventScroll: true }); } catch (e) { /* focus is a convenience */ }
    if (!dict || !auto) return undefined;
    const id = setTimeout(() => voice.speak(answer), 400);
    return () => clearTimeout(id);
  }, []);
  const edit = (next) => setText(next);
  const insert = (ch) => {
    const el = input.current;
    const start = el && el.selectionStart != null ? el.selectionStart : text.length;
    const end = el && el.selectionEnd != null ? el.selectionEnd : text.length;
    edit(text.slice(0, start) + (start === 0 ? ch.toUpperCase() : ch) + text.slice(end));
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(start + 1, start + 1); } });
  };
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
      onDone(hinted.current ? 1 : tries.current ? 2 : 3, cap(typed));
      return;
    }
    tries.current += 1;
    if (res.need) {
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
  return html`<form class="panel-in" onSubmit=${(e) => { e.preventDefault(); check(); }}>
    <div class="say-head"><span class="eyebrow">${dict ? 'ЗАПИШИ НА СЛУХ' : 'НАПИШИ ПО-КАЗАХСКИ'}</span>
      ${hint ? null : html`<button type="button" class="btn-chip" onClick=${showHint}>Подсказка</button>`}</div>
    ${dict
      ? html`<div class="say-ctl">
          <button type="button" class="ctl" onClick=${() => voice.speak(answer)}><${SpeakerGlyph} size=${16} /> Послушать</button>
          <button type="button" class="ctl" onClick=${() => voice.slow(answer)}>Медленно</button></div>`
      : html`<p class="type-ask">«${val(step.ru, v)}»</p>`}
    ${hint ? html`<div class="type-model"><span class="grow"><b class="kk" lang="kk">${answer}</b></span><${SpeakBtn} text=${answer} small /></div>` : null}
    <div class="kz-keys" role="group" aria-label="Казахские буквы">${KZ_LETTERS.map((ch) => html`
      <button type="button" class="kz-key" aria-label=${`Буква ${ch}`} onMouseDown=${(e) => e.preventDefault()} onClick=${() => insert(ch)}>${ch}</button>`)}</div>
    <div class="type-row">
      <label class="sr" for="type-in">Сообщение по-казахски</label>
      <input id="type-in" ref=${input} class="type-input" type="text" lang="kk" autocomplete="off" autocorrect="off" autocapitalize="sentences"
        spellcheck=${false} enterkeyhint="send" placeholder="Сообщение…" value=${text} onInput=${(e) => edit(e.target.value)} />
      <button type="submit" class="send-round" aria-label="Отправить" disabled=${!text.trim()}><${Icon} name="send" size=${22} stroke=${2.4} /></button>
    </div>
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

function DonePanel({ st, update, conv, ti, ci, result, v, go }) {
  const streak = streakOf(st.days);
  // The third lesson of a topic, done for the first time, opens the race of its words.
  const topic = PLAYABLE[ti];
  const opened = result.first && ci === 2 && topic.words && topic.words.length;
  const nx = nextUp(st, PLAYABLE[ti].level) || nextUp(st);
  const nextText = nx ? (nx.ti === ti ? `Дальше: ${KINDS[nx.c.kind].label.toLowerCase()}` : `Новая тема: ${nx.t.title.toLowerCase()}`) : null;
  const toNext = () => (nx ? go('conv', { ti: nx.ti, ci: nx.ci }) : go('home'));
  const note = result.added ? `${result.added} ${plural(result.added, PHR_W)} — в памяти, повторим завтра`
    : conv.kind === 'pron' ? 'Повторяй эти слова вслух — так звук закрепится'
    : conv.kind === 'write' ? `Без подсказки: ${result.clean} из ${result.typed}`
    : 'Фразы уже в памяти — повторим по графику';
  const cando = html`<div class="cando"><span class="eyebrow">ТЕПЕРЬ ТЫ УМЕЕШЬ</span>
    ${conv.can.map(([ru, kk]) => html`<span class="cando-row"><span class="tick"><${Icon} name="check" size=${12} stroke=${3.4} /></span>
      <span>${ru} — <b class="kk" lang="kk">${fill(kk, v)}</b></span></span>`)}</div>`;
  const race = opened ? html`<button type="button" class="m-rule race-open" onClick=${() => go('race', { ti })}>
    <${Icon} name="flag" size=${18} /><span>Открылась <span lang="kk">бәйге</span> — скачки на ${topic.words.length} словах темы</span></button>` : null;
  const again = html`<button type="button" class="link-btn" onClick=${() => go('conv', { ti, ci, k: Date.now() })}>Пройти ещё раз</button>`;
  if (result.closed) {
    return html`<div class="panel-in done">
      <${DayHead} st=${st} />
      ${cando}
      <${Tomorrow} st=${st} />
      ${race}
      <${RemindRow} st=${st} update=${update} />
      <button type="button" class="btn btn-primary btn-block" onClick=${() => go('home')}>Готово на сегодня</button>
      <span class="done-links">${nx ? html`<button type="button" class="link-btn" onClick=${toNext}>Ещё урок</button><span aria-hidden="true">·</span>` : null}${again}</span>
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
  </div>`;
}

function ConvScreen({ st, update, ti, ci, go }) {
  const t = PLAYABLE[ti];
  const conv = t.convs[ci];
  const person = PEOPLE[t.who];
  const v = varsOf(st);
  const steps = conv.steps;
  const [pos, setPos] = useState(0);
  const [log, setLog] = useState([]);
  const [typing, setTyping] = useState(false);
  // tr: every translation, answer options included (the «Ру» button). Without it a line shows
  // its translation after a tap, and options stay in Kazakh until the answer is given.
  const [tr, setTr] = useState(conv.kind !== 'free' && st.settings.trAuto);
  const [opened, setOpened] = useState({});
  const [sheet, setSheet] = useState(null);
  const [result, setResult] = useState(null);
  const [voiceChecked, setVoiceChecked] = useState(false);
  // «Сейчас не могу говорить» turns the microphone off until the end of the lesson.
  const [micPaused, setMicPaused] = useState(false);
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
        shownPos.current = pos;
        setTyping(false);
        setLog((l) => [...l, msg]);
        if (cur.settings.voice && isNpc) await voice.say(msg.kk);
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
    setLog((l) => [...l, ...add]);
    setPos((p) => p + 1);
  };

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

  let panel = null;
  if (result) {
    panel = html`<${DonePanel} st=${st} update=${update} conv=${conv} ti=${ti} ci=${ci} result=${result} v=${v} go=${go} />`;
  } else if (step && isTurn(step) && !typing) {
    if (step.check) panel = html`<${CheckPanel} key=${pos} step=${step} listen=${conv.kind === 'listen'} auto=${st.settings.voice} onHint=${hint} onDone=${() => advance([])} />`;
    else if (step.pick) {
      panel = html`<${PickPanel} key=${pos} step=${step} v=${v} tr=${tr} onHint=${hint}
        onDone=${(o) => advance([{ k: 'me', kk: val(o.kk, v), ru: val(o.ru, v) }], { rule: step.rule, word: step.word })} />`;
    } else if (step.choose) {
      panel = html`<${ChoosePanel} key=${pos} step=${step} v=${v} tr=${task}
        onDone=${(o) => {
          update((d) => { d.vars[step.choose] = o.val; });
          advance([{ k: 'me', kk: val(o.kk, v), ru: val(o.ru, v) }], { rule: step.rule, word: o.word || step.word, ask: step.ask });
        }} />`;
    } else if (step.build) {
      panel = html`<${BuildPanel} key=${pos} step=${step} v=${v} tr=${task} onHint=${hint}
        onDone=${() => advance([{ k: 'me', kk: val(step.text, v), ru: val(step.ru, v) }], { rule: step.rule, word: step.word })} />`;
    } else if (step.say) {
      panel = html`<${SayPanel} key=${pos} step=${step} v=${v} tr=${task} st=${st} recall=${conv.kind === 'speak'} paused=${micPaused} onHint=${hint}
        onPause=${() => setMicPaused(true)} onResume=${() => setMicPaused(false)}
        onDone=${(res) => {
          if (res && res.url) recordings.current.push(res.url);
          advance([{ k: 'voice', kk: val(step.say, v), url: res && res.url, ms: res && res.ms, levels: res && res.levels }]);
        }} />`;
    } else if (step.pair) {
      panel = html`<${PairPanel} key=${pos} step=${step} auto=${st.settings.voice} onHint=${hint} onDone=${(w) => advance([{ k: 'me', kk: w[0], ru: w[1] }])} />`;
    } else if (step.type) {
      panel = html`<${TypePanel} key=${pos} step=${step} v=${v} auto=${st.settings.voice} onHint=${hint}
        onDone=${(grade, message) => {
          typed.current.n += 1;
          if (grade === 3) typed.current.clean += 1;
          if (step.ph && stRef.current.mem[step.ph]) update((d) => { d.mem[step.ph] = fsrs.review(d.mem[step.ph], grade); });
          advance([{ k: 'me', kk: message, ru: val(step.ru, v) }]);
        }} />`;
    }
  }

  const turnWord = { listen: 'вопрос', pron: 'упражнение', write: 'сообщение' }[conv.kind] || 'твоя реплика';
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
      <button type="button" class="icon-btn" aria-label="Назад к теме" onClick=${() => go('topic', { ti })}><${Icon} name="back" size=${24} stroke=${2.2} /></button>
      <${Avatar} who=${t.who} size=${40} />
      <span class="conv-who"><b>${person.name}</b>
        <span class="conv-prog"><span class="dots" aria-hidden="true">${Array.from({ length: turns }, (_, i) => html`<i class=${i < turnsDone || result ? 'd' : i === turnsDone ? 'c' : ''}></i>`)}</span>${label}</span></span>
      <button type="button" class=${'tr-btn' + (tr ? ' on' : '')} aria-pressed=${tr} aria-label="Перевод на русский" onClick=${() => setTr(!tr)}>Ру</button>
    </header>
    <div class="scroll chat pad" ref=${scroller}>
      <div class="msgs" role="log" aria-live="polite">
        ${showNoVoice ? html`<div class="banner"><span>Здесь фразы пока без звука: в этом браузере нет казахского голоса. Со звуком они работают <a href=${SITE} target="_blank" rel="noopener">в Боте по ссылке</a> и в Microsoft Edge.</span>
          <button type="button" class="btn-chip" onClick=${() => update((d) => { d.seen.noVoice = true; })}>Понятно</button></div>` : null}
        <span class="conv-kind">${KINDS[conv.kind].label} · ${conv.title}</span>
        ${log.map((m, i) => html`<${Msg} key=${i} m=${m} tr=${tr || !!opened[i]} hint=${i === firstLine && !tr && !st.seen.trTap}
          topic=${t} onRule=${openRule} onTr=${() => toggleLine(i)} />`)}
        ${typing ? html`<div class="m-row left"><div class="b b-npc typing" aria-label="печатает"><i></i><i></i><i></i></div></div>` : null}
      </div>
    </div>
    <div class="composer pad" ref=${composer} hidden=${!panel}>${panel}</div>
    ${sheet ? html`<${RuleSheet} id=${sheet} onClose=${() => setSheet(null)} />` : null}
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

// How it went, in the four grades of FSRS; each button says when the card comes back.
const GRADES = [[1, 'Не вспомнил(а)'], [2, 'С трудом'], [3, 'Вспомнил(а)'], [4, 'Легко']];

// Recall, then check yourself: the meaning comes first, the learner says the phrase (aloud or to
// themselves), opens the answer and rates how it went. Picking one of three options would only
// test recognition, and a few lucky guesses sent a phrase away for months.
function Review({ st, update, go }) {
  const [queue] = useState(() => dueList(st).slice(0, 10));
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [okCount, setOkCount] = useState(0);
  // This review reached the day's goal.
  const [closed, setClosed] = useState(false);
  const lastTap = useRef(0);
  const bottom = useRef(null);
  const id = queue[i];
  const v = varsOf(st);
  // Keyboard users stay on the buttons of the moment: «Показать ответ», then the grades. Not on the
  // first card, which the page has only just opened with.
  useEffect(() => {
    if (i === 0 && !open) return;
    const first = bottom.current && bottom.current.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }, [i, open]);
  const head = html`<${TopBar} title="Освежить память" sub=${queue.length && i < queue.length ? `${i + 1} из ${queue.length}` : 'орнамент памяти'} onBack=${() => go('home')} backLabel="Вернуться в «Мой круг»" />`;

  if (!queue.length || i >= queue.length) {
    const nd = nextDue(st);
    const nx = nextUp(st);
    const toNext = () => go('conv', { ti: nx.ti, ci: nx.ci });
    const links = (items) => html`<span class="done-links">${items.map(([label, on], k) => html`${k ? html`<span aria-hidden="true">·</span>` : null}<button type="button" class="link-btn" onClick=${on}>${label}</button>`)}</span>`;
    if (closed) {
      const now = new Date();
      return html`<main class="screen">${head}
        <div class="scroll pad review-end">
          <${Shanyrak} year=${now.getFullYear()} month=${now.getMonth()} days=${st.days} today=${now.getDate()} size=${104} fresh />
          <b class="h2">Цель дня выполнена!</b>
          <span class="gold-text sm">Серия ${streakOf(st.days)} ${plural(streakOf(st.days), DAY_W)}: в шаңыраке новая жердь-уық</span>
          <span class="muted">Освежили ${cardsText(queue, true)}: вспомнил(а) ${okCount} из ${queue.length}</span>
          <${Tomorrow} st=${st} />
          <${RemindRow} st=${st} update=${update} />
        </div>
        <div class="bottom pad"><button type="button" class="btn btn-primary btn-block" onClick=${() => go('home')}>Готово на сегодня</button>
          ${nx ? links([['Ещё урок', toNext]]) : null}</div>
      </main>`;
    }
    // After the memory, the next lesson: the day began with the review, the lesson goes on from it.
    const onward = queue.length && nx;
    return html`<main class="screen">${head}
      <div class="scroll pad review-end">
        <span class="orn-big"><${Icon} name="ornament" size=${56} stroke=${1.6} /></span>
        <b class="h2">${queue.length ? `Освежили ${cardsText(queue, true)}` : 'Всё свежее'}</b>
        ${queue.length ? html`<span class="muted">Вспомнил(а): ${okCount} из ${queue.length}</span>` : null}
        ${nd ? html`<span class="muted">Следующее повторение — ${whenText(nd)}</span>` : html`<span class="muted">Пройди разговор — и фразы попадут в память.</span>`}
        ${onward ? html`<span class="muted sm">Дальше: ${lc(nextTitle(nx))}</span>` : null}
      </div>
      <div class="bottom pad">${onward
        ? html`<button type="button" class="btn btn-primary btn-block" onClick=${toNext}>${isSkill(nx.c) ? 'Начать урок' : 'Продолжить разговор'}</button>
          ${links([['В «Мой круг»', () => go('home')]])}`
        : html`<button type="button" class="btn btn-primary btn-block" onClick=${() => go('home')}>Вернуться в «Мой круг»</button>`}</div>
    </main>`;
  }

  const ph = phrase(id);
  const right = fill(ph.kk, v);
  const reveal = () => {
    setOpen(true);
    if (st.settings.voice) voice.speak(right);
  };
  const rate = (g) => {
    // A second tap on the same spot must not rate the next card as well.
    if (Date.now() - lastTap.current < 350) return;
    lastTap.current = Date.now();
    // The review counts toward the day's goal once its last card is rated.
    const last = i === queue.length - 1;
    const cur = latest(st);
    const before = doneToday(cur);
    update((d) => {
      d.mem[id] = fsrs.review(d.mem[id], g);
      d.days[dayKey()] = true;
      if (last) d.reviews[dayKey()] = (d.reviews[dayKey()] || 0) + 1;
    });
    // «С трудом» is remembered too: only «Не вспомнил(а)» is a lapse for FSRS.
    if (g >= 2) setOkCount((n) => n + 1);
    if (last && before < goalOf(cur) && before + 1 >= goalOf(cur)) setClosed(true);
    voice.stop();
    setOpen(false);
    setI(i + 1);
  };
  const when = (g) => whenText(fsrs.review(st.mem[id], g).due);
  return html`<main class="screen">${head}
    <div class="scroll pad review">
      <div class="rev-card">
        <span class="eyebrow">${isWord(id) ? 'КАК ЭТО ПО-КАЗАХСКИ?' : 'КАК СКАЗАТЬ ПО-КАЗАХСКИ?'}</span>
        <b class="rev-ru">${fill(ph.ru, v)}</b>
        ${open ? html`<span class="rev-kk"><b lang="kk">${right}</b><${SpeakBtn} text=${right} /></span>` : null}
      </div>
      <p class="muted sm center" role="status">${open ? 'Как вспомнилось?' : 'Вспомни и скажи вслух — потом проверь себя.'}</p>
    </div>
    <div class="bottom pad" ref=${bottom}>${open
      ? html`<div class="grades" role="group" aria-label="Как вспомнилось">${GRADES.map(([g, label]) => html`
          <button type="button" class="grade" onClick=${() => rate(g)}><b>${label}</b><span class="muted sm">${when(g)}</span></button>`)}</div>`
      : html`<button type="button" class="btn btn-primary btn-block" onClick=${reveal}>Показать ответ</button>`}</div>
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

const raceOpen = (st, t) => !!(t.words && t.words.length && st.done[t.convs[2].id]);
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
function RaceScreen({ st, update, go, ti, quick, setup, duel: duelIn }) {
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
  const back = () => (topic ? go('topic', { ti }) : go('home'));
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

function Phrasebook({ st, update, go }) {
  const [cat, setCat] = useState(0);
  const [q, setQ] = useState('');
  const v = varsOf(st);
  const all = PHRASEBOOK.flatMap((c) => c.items.map((it, i) => ({ id: `pb.${c.id}${i}`, kk: it[0], ru: it[1] })));
  const query = loose(q);
  let items = all.filter((x) => x.id.startsWith(`pb.${PHRASEBOOK[cat].id}`));
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

const AGE_RANK = { '0-1': 0, '1-2': 1, '2-3': 2 };
const FROM_LABEL = { '1-2': 'с 1 года', '2-3': 'с 2 лет' };

// The ritual that fits the time of day and the baby's age and has not been said yet today.
function suggestRitual(said, age, now = new Date()) {
  const h = now.getHours();
  const today = said[dayKey(now)] || {};
  const timed = h >= 5 && h < 11 ? BABY.filter((s) => s.group === 'morning')
    : h >= 11 && h < 17 ? BABY.filter((s) => s.group === 'day')
    : h >= 17 && h < 21 ? BABY.filter((s) => s.group === 'evening' && s.id !== 'night')
    : BABY.filter((s) => s.id === 'sleep' || s.id === 'night');
  const rank = AGE_RANK[age] ?? 1;
  const fits = timed.filter((s) => AGE_RANK[s.from] <= rank);
  const pool = fits.length ? fits : timed;
  return pool.find((s) => !s.items.some((_, i) => today[`${s.id}.${i}`])) || pool[0];
}

function toggleSaid(update, pid) {
  const today = dayKey();
  update((d) => {
    d.baby.said = d.baby.said || {};
    const day = { ...(d.baby.said[today] || {}) };
    if (day[pid]) delete day[pid]; else day[pid] = true;
    d.baby.said[today] = day;
    if (Object.keys(day).length) d.days[today] = true;
  });
}

function Baby({ st, update, go }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('1-2');
  const [install, installSheet] = useInstall(update);
  const today = dayKey();
  const week = weekKeys();
  const said = st.baby.said || {};
  const weekCount = week.reduce((n, k) => n + Object.keys(said[k] || {}).length, 0);

  if (!st.baby.name) {
    const clean = cap(name.trim().replace(/\s+/g, ' ').slice(0, 24));
    return html`<main class="screen">
      <div class="scroll chat pad">
        <div class="msgs">
          <h1 class="h1 baby-title">Малыш</h1>
          <${BotaSays}>Этот раздел — для родителя. Малышу экран не нужен: ему нужна ваша живая речь.<//>
          <${BotaSays}>Я подскажу фразы для купания, еды, прогулки и сна. Как зовут малыша?<//>
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
  const ageRank = AGE_RANK[st.baby.age] ?? 1;
  const todaySaid = said[today] || {};
  const sug = suggestRitual(said, st.baby.age);
  const words = week.flatMap((k) => Object.keys(said[k] || {}))
    .map((pid) => { const [sid, idx] = pid.split('.'); const sc = BABY.find((x) => x.id === sid); return sc && sc.items[Number(idx)] ? sc.items[Number(idx)][0] : null; })
    .filter(Boolean);
  const cloud = [...new Set(words)].slice(-8);
  const pct = Math.min(100, Math.round((weekCount / BABY_GOAL) * 100));
  return html`<main class="screen">
    <div class="scroll pad baby">
      <header class="baby-head"><span><h1 class="h1">${st.baby.name}</h1><span class="muted sm">${ageLabel} · ${BABY.length} ритуалов на каждый день</span></span></header>
      <section class="card baby-hero">
        <span class="eyebrow">НА ЭТОЙ НЕДЕЛЕ</span>
        <div class="big"><b>${weekCount}</b><span>${plural(weekCount, TIME_W)} вы сказали малышу фразу по-казахски</span></div>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax=${BABY_GOAL} aria-valuenow=${weekCount}><span style=${`width:${pct}%`}></span></div>
        <span class="muted sm">цель недели — ${BABY_GOAL}</span>
        ${cloud.length ? html`<div class="cloud">${cloud.map((w) => html`<span class="kk" lang="kk">${w}</span>`)}</div>` : null}
      </section>
      <button type="button" class="card suggest" onClick=${() => go('babyScen', { id: sug.id })}>
        <span class="eyebrow">СЕЙЧАС ПОДХОДИТ</span>
        <span class="suggest-row"><span class="grow"><b class="h3">${sug.title}</b><span class="muted sm"><span lang="kk">«${sug.items[0][0]}»</span> — ${lc(sug.items[0][1])}</span></span>
          <${Icon} name="next" size=${22} stroke=${2.4} /></span>
      </button>
      ${BABY_GROUPS.map((g) => html`<section class="scen-group" key=${g.id}>
        <span class="eyebrow">${g.title.toUpperCase()} · ${g.kk.toUpperCase()}</span>
        <div class="scen-grid">${BABY.filter((s) => s.group === g.id).map((s) => {
          const early = AGE_RANK[s.from] > ageRank;
          const n = s.items.filter((_, i) => todaySaid[`${s.id}.${i}`]).length;
          return html`<button type="button" class="scen" key=${s.id} onClick=${() => go('babyScen', { id: s.id })}
            aria-label=${`${s.title}: сегодня ${n} из ${s.items.length}`}>
            <b>${s.title}</b><span class="muted sm" lang="kk">${s.kk}</span>
            <span class="scen-foot">${early ? html`<span class="age">${FROM_LABEL[s.from]}</span>`
              : html`<span class="pips" aria-hidden="true">${s.items.map((_, i) => html`<i class=${todaySaid[`${s.id}.${i}`] ? 'on' : ''}></i>`)}</span>`}</span>
          </button>`;
        })}</div>
      </section>`)}
      <${InstallRow} st=${st} onOpen=${install} />
      <p class="baby-tip"><${Bota} size=${26} /><span>Говорите сами, своим голосом: малыш учится у живого человека, а не у экрана.</span></p>
    </div>
    <${TabBar} tab=${st.profile.mode === 'baby' ? 'baby' : 'phrasebook'} go=${go} st=${st} />
    ${installSheet}
  </main>`;
}

function BabyScenario({ st, update, go, id }) {
  const s = BABY.find((x) => x.id === id) || BABY[0];
  // The next ritual in the list that fits the baby's age.
  const idx = BABY.indexOf(s);
  const rank = AGE_RANK[st.baby.age] ?? 1;
  const next = [...BABY.slice(idx + 1), ...BABY.slice(0, idx)].find((x) => AGE_RANK[x.from] <= rank) || BABY[(idx + 1) % BABY.length];
  const todaySaid = (st.baby.said || {})[dayKey()] || {};
  const n = s.items.filter((_, i) => todaySaid[`${s.id}.${i}`]).length;
  return html`<main class="screen">
    <${TopBar} title=${s.title} sub=${`${s.kk} · сегодня ${n} из ${s.items.length}`} onBack=${() => go('baby')} backLabel="Назад к ритуалам" />
    <div class="scroll pad baby">
      <div class="m-tip static"><${Bota} size=${28} /><span>${s.tip}</span></div>
      <div class="ph-list">${s.items.map(([kk, ru], i) => {
        const pid = `${s.id}.${i}`;
        const on = !!todaySaid[pid];
        return html`<div class="ph-row" key=${pid}>
          <${SpeakBtn} text=${kk} />
          <span class="grow"><b class="kk" lang="kk">${kk}</b><span class="muted sm">${ru}</span></span>
          <button type="button" class=${'said-btn' + (on ? ' on' : '')} aria-pressed=${on} onClick=${() => toggleSaid(update, pid)}>${on ? 'Сказал(а) ✓' : 'Сказал(а)'}</button>
        </div>`;
      })}</div>
      <p class="muted sm">Отмечайте фразу, когда сказали её малышу: так видно, сколько казахского он слышит за неделю.</p>
    </div>
    <div class="bottom pad"><button type="button" class="btn btn-primary btn-block" onClick=${() => go('babyScen', { id: next.id })}>Следующий ритуал: ${next.title.toLowerCase()}</button></div>
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
  const clean = cap(name.trim().replace(/\s+/g, ' ').slice(0, 24));
  const babyClean = cap(babyName.trim().replace(/\s+/g, ' ').slice(0, 24));
  const babyAgeLabel = (BABY_AGES.find((a) => a[0] === st.baby.age) || BABY_AGES[1])[1];
  const memIds = Object.keys(st.mem).filter((id) => phrase(id));
  const memCount = memIds.length;
  const goal = goalOf(st);
  const hasVoice = voice.available();
  const micUsable = mic.supported() && mic.allowed();
  const [remind, setRemind] = useState(false);
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
    let data = null;
    try { data = JSON.parse(await file.text()); } catch (err) { /* not JSON: answered below */ }
    if (!isObj(data) || data.app !== 'bota' || !isObj(data.progress)) {
      setTransfer('Это не файл прогресса Боты.');
      return;
    }
    const there = normalize(data.progress);
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
          <span class="grow"><b>Режим «Малыш»</b><span class="muted sm">${st.profile.mode === 'baby' ? 'своя вкладка, приложение открывается с неё' : 'фразы для родителей — в «Разговорнике»'}</span></span>
          <${Toggle} on=${st.profile.mode === 'baby'} label="Режим «Малыш»" onChange=${(on) => update((d) => { d.profile.mode = on ? 'baby' : 'talk'; })} />
        </div>
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
          <div class="row-btns"><button type="button" class="btn-chip danger-btn" onClick=${() => { update((d) => { const f = fresh(); Object.keys(d).forEach((k) => delete d[k]); Object.assign(d, f); }); homeLevel = null; go('onboard'); }}>Сбросить</button>
            <button type="button" class="btn-chip" onClick=${() => setConfirmReset(false)}>Отмена</button></div>`
          : html`<button type="button" class="btn-chip" onClick=${() => setConfirmReset(true)}>Сбросить прогресс</button>`}
      </section>
      <p class="muted sm foot">MVP 0.1 · фразы — черновик, их проверит носитель языка.${voice.recorded()
        ? ' Озвучка: голос ISSAI KazakhTTS2 (CC BY 4.0), синтез Piper; ударение в записи может ошибаться.' : ''}</p>
    </div>
    <${TabBar} tab="profile" go=${go} st=${st} />
    ${remind ? html`<${RemindSheet} was=${st.seen.remind} onClose=${() => setRemind(false)}
      onSet=${(time) => { update((d) => { d.seen.remind = time; }); setRemind(false); }} />` : null}
  </main>`;
}

/* ---------- app ---------- */

const INITIAL = load();

function routeAfterStart(st) {
  if (!st.profile.onboarded) return { name: 'onboard' };
  return { name: st.profile.mode === 'baby' ? 'baby' : 'home' };
}

// One screen up from each screen — where the arrow in its corner leads; null on the first screen.
// In the talk mode «Малыш» opens from the phrasebook.
function upRoute(route, st) {
  const start = st.profile.mode === 'baby' ? 'baby' : 'home';
  switch (route.name) {
    case 'topic': case 'review': return { name: 'home' };
    case 'conv': return { name: 'topic', ti: route.ti };
    case 'race': return route.ti != null ? { name: 'topic', ti: route.ti } : { name: 'home' };
    case 'rules': return { name: route.back || 'phrasebook' };
    case 'babyScen': return { name: 'baby' };
    case 'baby': return start === 'baby' ? null : { name: 'phrasebook' };
    case 'home': case 'phrasebook': case 'profile': return route.name === start ? null : { name: start };
    default: return null;
  }
}

function App() {
  const [st, setSt] = useState(INITIAL);
  // A fact is shown once: the splash keeps the fact it opened with, even past midnight. A newcomer
  // meets Bota first; the fact waits for a later start.
  const [route, setRoute] = useState(() => {
    const fact = factFor();
    return fact && INITIAL.profile.onboarded && INITIAL.seen.fact !== fact.key ? { name: 'splash', fact } : routeAfterStart(INITIAL);
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
  // On the site the browser is asked to keep the progress even when space runs short. It asks no
  // one: browsers grant it to an app put on the home screen, so each start asks again until then.
  useEffect(() => {
    if (!SITE_BUILD || !st.profile.onboarded || st.seen.persist === 'yes' || !navigator.storage || !navigator.storage.persist) return;
    navigator.storage.persist().then((kept) => { if (kept) update((d) => { d.seen.persist = 'yes'; }); }, () => {});
  }, [st.profile.onboarded]);
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
      screen = html`<${Splash} fact=${route.fact} onNext=${() => { update((d) => { d.seen.fact = route.fact.key; }); setRoute(routeAfterStart(st)); }} />`;
      break;
    case 'onboard':
      // After meeting Bota the first conversation opens at once (with Әже); parents go to «Малыш».
      screen = html`<${Onboard} st=${st} update=${update} done=${(mode) => {
        const nx = mode === 'baby' ? null : nextUp(st);
        if (nx) go('conv', { ti: nx.ti, ci: nx.ci }); else go(mode === 'baby' ? 'baby' : 'home');
      }} />`;
      break;
    case 'topic':
      screen = html`<${TopicScreen} st=${st} ti=${route.ti} go=${go} />`;
      break;
    case 'conv':
      screen = html`<${ConvScreen} key=${`${route.ti}-${route.ci}-${route.k || 0}`} st=${st} update=${update} ti=${route.ti} ci=${route.ci} go=${go} />`;
      break;
    case 'review':
      screen = html`<${Review} st=${st} update=${update} go=${go} />`;
      break;
    case 'race':
      screen = html`<${RaceScreen} key=${`race-${route.ti ?? 'mix'}-${route.k || 0}`} st=${st} update=${update} go=${go} ti=${route.ti}
        quick=${!!route.quick} setup=${!!route.setup} duel=${route.duel} />`;
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
    case 'babyScen':
      screen = html`<${BabyScenario} st=${st} update=${update} go=${go} id=${route.id} />`;
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
  if (!error) return children;
  const restart = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(`${KEY}-broken`, raw);
      localStorage.removeItem(KEY);
    } catch (e) { /* nothing to keep */ }
    location.reload();
  };
  return html`<main class="screen"><div class="scroll pad crash">
    <${Bota} size=${56} />
    <b class="h2">Что-то пошло не так</b>
    <span class="muted">Обновите страницу. Если не поможет — начните заново: старый прогресс останется копией в этом браузере.</span>
    <button type="button" class="btn btn-primary btn-block" onClick=${() => location.reload()}>Обновить</button>
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
