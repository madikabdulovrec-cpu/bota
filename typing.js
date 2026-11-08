// Kazakh text without dependencies, so tools/validate.mjs tests it in Node: checking a typed message
// (which answers count as the same and what hint to give), syllables, a phrase with a word put in.

export const KZ_LETTERS = ['ә', 'ғ', 'қ', 'ң', 'ө', 'ұ', 'ү', 'һ', 'і'];
const PLAIN = { 'ә': 'а', 'ғ': 'г', 'қ': 'к', 'ң': 'н', 'ө': 'о', 'ұ': 'у', 'ү': 'у', 'һ': 'х', 'і': 'и' };
// Latin letters that look like Kazakh Cyrillic ones, typed from another keyboard layout.
const LOOKALIKE = { a: 'а', c: 'с', e: 'е', h: 'һ', i: 'і', k: 'к', o: 'о', p: 'р', x: 'х', y: 'у', 'ə': 'ә', 'ɵ': 'ө' };
// Spellings of the same word that people use in messages.
const SPELLING = { 'рахмет': 'рақмет', 'ия': 'иә' };

const words = (s) => String(s).toLowerCase().replace(/[aceihkopxyəɵ]/g, (ch) => LOOKALIKE[ch])
  .replace(/[\p{P}\p{S}]/gu, ' ').split(/\s+/).filter(Boolean).map((w) => SPELLING[w] || w);
// Case, punctuation, look-alike letters and common spellings are not mistakes.
export const normType = (s) => words(s).join(' ');
export const plain = (s) => s.replace(/[әғқңөұүһі]/g, (ch) => PLAIN[ch]);

// A pronoun may be left out when the next word or the verb already says whose or who:
// «Менің анам» = «Анам», «Мен асығып тұрмын» = «Асығып тұрмын», but «Сен асығып тұрмын» stays wrong.
const CASE = '(?:ды|ді|ны|ні|ның|нің|а|е|на|не|да|де|нда|нде|дан|ден|нан|нен|мен|бен|пен|ға|ге|қа|ке|ша|ше)?';
const OWNER = {
  'менің': new RegExp(`(?:ым|ім|м)${CASE}$`),
  'сенің': new RegExp(`(?:ың|ің|ң)${CASE}$`),
  'сіздің': new RegExp(`(?:ыңыз|іңіз|ңыз|ңіз)${CASE}$`),
  'біздің': new RegExp(`(?:ымыз|іміз|мыз|міз)${CASE}$`),
  'сендердің': new RegExp(`(?:ың|ің|ң)${CASE}$`),
  'сіздердің': new RegExp(`(?:ыңыз|іңіз|ңыз|ңіз)${CASE}$`),
};
const SUBJECT = {
  'мен': /(?:мын|мін|бын|бін|пын|пін|дым|дім|тым|тім|йын|йін)$/,
  'сен': /(?:сың|сің|дың|дің|тың|тің)$/,
  'сіз': /(?:сыз|сіз|ңыз|ңіз)$/,
  'біз': /(?:мыз|міз|быз|біз|пыз|піз|дық|дік|тық|тік|йық|йік)$/,
  'сендер': /(?:сыңдар|сіңдер|ңдар|ңдер)$/,
  'сіздер': /(?:сыздар|сіздер|ңыздар|ңіздер)$/,
};
// In «үйренгім келеді» the person is in the word before «келеді».
const WISH = { 'мен': /(?:ғым|гім|қым|кім)$/, 'сен': /(?:ғың|гің|қың|кің)$/, 'сіз': /(?:ғыңыз|гіңіз|қыңыз|кіңіз)$/, 'біз': /(?:ғымыз|гіміз|қымыз|кіміз)$/ };
const PARTICLES = new Set(['ба', 'бе', 'ма', 'ме', 'па', 'пе', 'ше', 'ғой']);

function dropPronouns(ws) {
  let end = ws.length - 1;
  while (end > 0 && PARTICLES.has(ws[end])) end--;
  const pred = ws[end];
  const wish = pred === 'келеді' || pred === 'келмейді';
  return ws.filter((w, i) => {
    if (i >= end) return true;
    if (OWNER[w]) return !ws.slice(i + 1, i + 3).some((x) => OWNER[w].test(x));
    if (!SUBJECT[w]) return true;
    if (wish) return !(WISH[w] && end - 1 > i && WISH[w].test(ws[end - 1]));
    return !SUBJECT[w].test(pred);
  });
}

// Every normalized form of a message. A one-word address or reply may stand at either end
// of its sentence: «Сәлеметсіз бе, әже!» = «Әже, сәлеметсіз бе!», «Жақсы, рақмет!» = «Рақмет, жақсы!».
function forms(text) {
  let out = [''];
  for (const sentence of String(text).split(/[.!?…]+/)) {
    const parts = sentence.split(/[,;:—–]/).map((p) => dropPronouns(words(p))).filter((p) => p.length);
    if (!parts.length) continue;
    const orders = [parts.flat().join(' ')];
    if (parts.length === 2 && (parts[0].length === 1 || parts[1].length === 1)) orders.push([...parts[1], ...parts[0]].join(' '));
    out = out.flatMap((a) => orders.map((b) => (a ? `${a} ${b}` : b)));
  }
  return out.filter(Boolean);
}

// { ok: true } for an accepted message. Otherwise, when only Kazakh letters differ from an
// accepted form: need — letters to use, plainFor — Kazakh letters typed where a plain one belongs.
export function checkTyped(typed, answers) {
  const mine = forms(typed);
  const want = answers.flatMap(forms);
  if (mine.some((f) => want.includes(f))) return { ok: true };
  for (const w of want) {
    for (const g of mine) {
      if (g.length !== w.length || plain(g) !== plain(w)) continue;
      const need = new Set();
      const plainFor = new Map();
      [...w].forEach((ch, i) => {
        if (g[i] === ch) return;
        if (PLAIN[ch]) need.add(ch);
        else plainFor.set(g[i], ch);
      });
      return { ok: false, need: [...need], plainFor: [...plainFor] };
    }
  }
  return { ok: false };
}

// Syllables of a Kazakh phrase for reading aloud: «қа-йыр-лы таң · кү-нім». Each syllable has one
// vowel; of the consonants between two vowels the last one opens the next syllable. «у» after a
// vowel, or first in a word before a vowel, is the consonant [w]: «а-уыз», «тау», «уа-қыт».
// Punctuation becomes a pause «·». tools/validate.mjs compares it with the syllables of the lessons.
const VOWELS = 'аәеёиіоөұүыэюя';
const isVowel = (ch) => VOWELS.includes(ch);

function syllablesOfWord(w) {
  const ch = [...w];
  const nucleus = ch.map((c, i) => (c === 'у'
    ? !(i > 0 && isVowel(ch[i - 1])) && !(i === 0 && ch.length > 1 && isVowel(ch[1]))
    : isVowel(c)));
  const at = ch.map((_, i) => i).filter((i) => nucleus[i]);
  if (at.length < 2) return [w];
  const cuts = at.slice(1).map((b, k) => {
    const a = at[k];
    if (b === a + 1) return b;
    // ь and ъ stay with the consonant before them.
    let cut = b - 1;
    while (cut > a + 1 && /[ьъ]/.test(ch[cut])) cut--;
    return /[ьъ]/.test(ch[cut]) ? cut + 1 : cut;
  });
  const out = [];
  let from = 0;
  cuts.forEach((c) => { out.push(ch.slice(from, c).join('')); from = c; });
  out.push(ch.slice(from).join(''));
  return out;
}

export function syllables(text) {
  const parts = String(text).toLowerCase().split(/\s*[,.!?;:—–]+\s*|\s+/u);
  const pause = String(text).toLowerCase().match(/\s*[,.!?;:—–]+\s*|\s+/gu) || [];
  let out = '';
  parts.forEach((tok, i) => {
    const word = tok.replace(/[^а-яёәғқңөұүһі-]/g, '');
    if (word) out += word.split('-').filter(Boolean).map((p) => syllablesOfWord(p).join('-')).join('-');
    const gap = pause[i];
    if (gap && i < parts.length - 1 && parts.slice(i + 1).some((p) => p.replace(/[^а-яёәғқңөұүһі]/g, ''))) {
      out += /[,.!?;:—–]/.test(gap) ? ' · ' : ' ';
    }
  });
  return out.replace(/\s+·\s+·\s+/g, ' · ').trim();
}

// A phrase with a place for one word, «Міне, {w}!» + «шұлығың», in three parts: before, the word,
// after. A word that begins a sentence gets a capital letter. «Малыш» shows it; tools/audio.mjs voices it.
export function fillSlot(frame, word) {
  const [a, b = ''] = String(frame).split('{w}');
  const w = !a.trim() || /[.!?]\s*$/.test(a) ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  return [a, w, b];
}
