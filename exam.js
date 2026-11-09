// Questions of the entrance test and of the рубежи. They are taken from the lessons themselves — lines
// heard and a question about them, a reply to choose or to put together, a message to write, a phrase
// to say from memory — so they hold no Kazakh of their own, and everything in them has passed the
// checks of the lessons. No DOM here: tools/validate.mjs tests this module in Node.
import { TOPICS, PHRASES, CHECKPOINTS } from './content.js?v=d41a81f';
import { normType } from './typing.js?v=d41a81f';

const PLAYABLE = TOPICS.filter((t) => !t.soon);
const TOPIC_AT = new Map(PLAYABLE.map((t, i) => [t.id, i]));
const isTurn = (s) => !!(s.check || s.pick || s.build || s.say || s.own || s.choose || s.pair || s.type);
const isFn = (x) => typeof x === 'function';

// The block of КАЗТЕСТ each kind of question trains. A heard question that is read as text (no Kazakh
// voice in this browser) counts as reading: app.js decides that while asking.
export const BLOCK = { listen: 'listen', ask: 'read', pick: 'read', build: 'read', write: 'write', say: 'speak' };
const ORDER = ['listen', 'ask', 'pick', 'build', 'write', 'say'];

// A рубеж is taken at 70% and more: 7 of 10, 9 of 12. need() — how many right answers that is.
export const need = (n) => Math.ceil((n * 7) / 10);
export const passes = (ok, n) => n > 0 && ok * 10 >= n * 7;
// The entrance test asks up to 4 questions about a stretch of topics — one of them a phrase to put
// together, or to write where the stretch has none — and goes on to the next stretch after 3 right ones:
// guessing among three options passes a stretch about once in 27 tries, not once in four. Three right
// or two wrong decide it early; the fourth question comes only when the first three disagree.
export const PLACE_ASK = 4;
export const PLACE_PASS = 3;

// The checkpoints with what they cover: topics — the topics since the one before it in the circle
// (the ones it opens the way after), circle — all topics of its level, which a final asks about.
export const CHECKS = (() => {
  let from = 0;
  return CHECKPOINTS.map((cp) => {
    const end = PLAYABLE.findIndex((t) => t.id === cp.after);
    const level = end >= 0 ? PLAYABLE[end].level : '';
    while (from < end && PLAYABLE[from].level !== level) from++;
    const topics = end >= 0 ? PLAYABLE.slice(from, end + 1).map((t) => t.id) : [];
    from = end + 1;
    return { ...cp, final: !!cp.final, level, topics, circle: PLAYABLE.filter((t) => t.level === level).map((t) => t.id) };
  });
})();

// Places the app fills in for everyone, chosen or not (varsOf in app.js). Any other one stands for an
// answer the learner may never have given, and leaves the question out.
const SAFE_VARS = new Set(['name', 'city', 'cityAbl', 'cityAblSyl', 'cityFrom', 'cityLoc', 'cityLocSyl', 'cityIn', 'jobKk', 'jobSyl', 'jobRu', 'hobbyKk', 'hobbyRu']);
const safeText = (x) => x == null || x === false || (!isFn(x) && [...String(x).matchAll(/\{(\w+)\}/g)].every((m) => SAFE_VARS.has(m[1])));

function safeStep(s) {
  const why = s.why && typeof s.why === 'object' ? Object.values(s.why) : [s.why];
  const texts = [s.check, s.ru, s.say, s.type, s.text, s.order, ...why, ...(s.build || []), ...(s.extra || []), ...(s.alt || []),
    ...(s.opts || []).flatMap((o) => [o.t, o.why]), ...(s.pick || []).flatMap((o) => [o.kk, o.ru, o.why])];
  return texts.every(safeText);
}

// A wrong option that is wrong only by the story of its lesson — «you have greeted already», «you came
// to the doctor because you feel bad», «agree» — may well be right on its own: a choice with one is
// left out of the tests, where only the line before it is seen. The words below catch most of them;
// the content marks the rest by hand (story: true — «the scarf is a present for mum»).
const BY_STORY = /(уже|только что|ты же|вы же|согласи|соглаша|пришёл \(пришла\)|ты пришёл|собираешься|планируешь|зов[её]т|приглаша|советует|просит|хотел\(а\))/i;

function kindOf(c, s, ctx) {
  // A choice with two right replies («Иә…» and «Жоқ…» about oneself) asks nothing to check.
  const opts = s.pick || s.opts;
  if (s.story) return null;
  if (opts && opts.filter((o) => o.ok).length !== 1) return null;
  if (opts && opts.some((o) => !o.ok && BY_STORY.test(String(o.why)))) return null;
  if (s.check) return s.kk ? 'ask' : ctx.length ? 'listen' : null;
  if (s.pick) return ctx.length ? 'pick' : null;
  if (s.build) return 'build';
  if (s.type) return 'write';
  // «Скажи голосом» says a reply from memory; the syllables of «Произношение» are read, not recalled.
  if (s.say && c.kind === 'speak') return 'say';
  return null;
}

const words = (x) => normType(String(x)).split(' ').filter(Boolean);
const saidIn = (p, line) => {
  const want = words(p);
  let j = 0;
  for (const w of words(line)) if (w === want[j]) j++;
  return want.length > 0 && j === want.length;
};

// The phrase of the course a question asks about: a mistake brings it back to the memory.
function phraseOf(t, c, kind, s, ctx) {
  if (kind === 'write' && s.ph && PHRASES[s.ph]) return s.ph;
  const answer = kind === 'listen' ? ctx.map((x) => x.npc).join(' ')
    : kind === 'pick' ? (s.pick.find((o) => o.ok) || {}).kk
      : kind === 'ask' ? (s.opts.find((o) => o.ok) || {}).t
        : kind === 'build' ? s.text : kind === 'write' ? s.type : s.say;
  if (!answer) return null;
  const own = [...new Set([...(c.teaches || []), ...t.convs.flatMap((x) => x.teaches || [])])].filter((id) => PHRASES[id]);
  const same = own.find((id) => normType(PHRASES[id].kk) === normType(answer));
  if (same) return same;
  // The longest phrase said in the answer: «Қалың қалай?» in «Сәлем, балам! Қалың қалай?».
  const inside = own.filter((id) => saidIn(PHRASES[id].kk, answer)).sort((a, b) => words(PHRASES[b].kk).length - words(PHRASES[a].kk).length);
  return inside[0] || null;
}

// The questions of a topic. ctx — the lines of the other people right before a question, which it is
// about. A question is left out when a line before it depends on the learner's own earlier answers,
// or is a fast line to ask about again («переспроси»). A reply to choose or a question about what was
// heard is left out after Bota's tip too: in the lesson its answer leans on that tip. A phrase to put
// together, write or say keeps its place after a tip — its meaning is the task — but it answers a line
// of the other person: one the learner starts after his own reply and Bota's tip («Спроси, можно ли
// примерить») would stand in the chat of a test with nobody asking. «Как спросить…?» asks itself.
const LEANS = new Set(['listen', 'ask', 'pick']);
function itemsOf(t) {
  const out = [];
  t.convs.forEach((c) => {
    let ctx = [];
    let tip = false;
    c.steps.forEach((s, i) => {
      if (!isTurn(s)) {
        if (s.npc !== undefined) ctx.push(s);
        if (s.tip !== undefined) tip = true;
        return;
      }
      const kind = kindOf(c, s, ctx);
      const lines = ctx.every((x) => safeText(x.npc) && safeText(x.ru) && !x.fast && !x.slow);
      if (kind && lines && (ctx.length || kind === 'ask') && !(tip && LEANS.has(kind)) && safeStep(s)) {
        out.push({ id: `${c.id}.${i}`, topic: t.id, who: t.who, lesson: c.id, kind, ctx: kind === 'ask' ? [] : ctx, step: s, ph: phraseOf(t, c, kind, s, ctx) });
      }
      ctx = [];
      tip = false;
    });
  });
  return out;
}

export const POOLS = new Map(PLAYABLE.map((t) => [t.id, itemsOf(t)]));

// n questions of the kinds given (ask and pick share one quota) from the topics given, spread over the
// topics: each next one goes to a topic with the fewest so far. rnd — like Math.random, so that a check
// can repeat a draw.
function draw(topics, kinds, n, taken, per, rnd) {
  const got = [];
  for (let k = 0; k < n; k++) {
    const left = (id) => POOLS.get(id).filter((x) => kinds.includes(x.kind) && !taken.has(x.id));
    const open = topics.filter((id) => POOLS.has(id) && left(id).length);
    if (!open.length) break;
    const least = Math.min(...open.map((id) => per.get(id) || 0));
    const fewest = open.filter((id) => (per.get(id) || 0) === least);
    const topic = fewest[Math.floor(rnd() * fewest.length)];
    const pool = left(topic);
    const it = pool[Math.floor(rnd() * pool.length)];
    taken.add(it.id);
    per.set(topic, least + 1);
    got.push(it);
  }
  return got;
}

// The people come one after another, in the order of the course; each asks first what was heard.
const sorted = (list) => list.sort((a, b) => TOPIC_AT.get(a.topic) - TOPIC_AT.get(b.topic) || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

// A рубеж: 10 questions about its topics. A final: 12 about the whole circle — half of each kind about
// its own last topics, half about the earlier ones.
const QUOTA = {
  check: [[['listen'], 3], [['pick', 'ask'], 3], [['build'], 1], [['write'], 2], [['say'], 1]],
  final: [[['listen'], 3], [['pick', 'ask'], 3], [['build'], 2], [['write'], 2], [['say'], 2]],
};
export const SIZE = { check: 10, final: 12 };

export function checkItems(cp, rnd = Math.random) {
  const taken = new Set();
  const per = new Map();
  const earlier = cp.circle.filter((id) => !cp.topics.includes(id));
  const out = [];
  QUOTA[cp.final ? 'final' : 'check'].forEach(([kinds, n]) => {
    if (!cp.final || !earlier.length) {
      out.push(...draw(cp.topics, kinds, n, taken, per, rnd));
      return;
    }
    const mine = draw(cp.topics, kinds, Math.ceil(n / 2), taken, per, rnd);
    const before = draw(earlier, kinds, n - mine.length, taken, per, rnd);
    out.push(...mine, ...before, ...draw(cp.circle, kinds, n - mine.length - before.length, taken, per, rnd));
  });
  return sorted(out);
}

// The entrance test asks about a stretch of topics (the topics of one рубеж), each question from another
// topic while there are topics left: one heard (read, where there is no voice), a reply and a phrase to
// put together come first, in the order of the course; one more reply follows, asked only when the
// first three disagree.
export function placeItems(seg, rnd = Math.random) {
  const cp = CHECKS[seg];
  if (!cp) return [];
  const taken = new Set();
  const per = new Map();
  const build = draw(cp.topics, ['build'], 1, taken, per, rnd);
  const made = build.length ? build : draw(cp.topics, ['write'], 1, taken, per, rnd);
  const first = sorted([...draw(cp.topics, ['listen'], 1, taken, per, rnd), ...draw(cp.topics, ['pick', 'ask'], 1, taken, per, rnd), ...made]);
  const out = [...first, ...draw(cp.topics, ['pick', 'ask'], PLACE_ASK - first.length, taken, per, rnd)];
  if (out.length < PLACE_ASK) out.push(...draw(cp.topics, ['pick', 'ask', 'listen', 'build', 'write'], PLACE_ASK - out.length, taken, per, rnd));
  return out.map((x) => ({ ...x, seg }));
}
