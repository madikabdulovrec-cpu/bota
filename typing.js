// Checking a typed Kazakh message: which answers count as the same and what hint to give.
// No dependencies, so tools/validate.mjs tests it in Node.

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
