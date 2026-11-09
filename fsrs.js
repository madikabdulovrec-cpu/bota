// FSRS-4.5 scheduler with default weights, reduced to what the MVP needs.
// Ratings: 1 — забыл, 2 — с трудом, 3 — вспомнил, 4 — легко.

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const RETENTION = 0.9;
export const DAY = 86400000;

const clampD = (d) => Math.min(10, Math.max(1, d));
const initialDifficulty = (g) => clampD(W[4] - (g - 3) * W[5]);

// No phrase waits longer than two months: four «Легко» in a row would send it away for years, and a
// phrase not heard for months fades even when it was easy.
export const MAX_DAYS = 60;

function intervalDays(s) {
  const days = (s / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1);
  return Math.min(MAX_DAYS, Math.max(1, Math.round(days)));
}

// Probability that the phrase is still remembered now (0…1).
export function retrievability(card, now = Date.now()) {
  if (!card || !card.s) return 0;
  const t = Math.max(0, (now - card.last) / DAY);
  return Math.pow(1 + (FACTOR * t) / card.s, DECAY);
}

// Returns a new card after a review with rating g. A missing card is a new one.
export function review(card, g, now = Date.now()) {
  if (!card || !card.reps) {
    const s = W[g - 1];
    return { s, d: initialDifficulty(g), reps: 1, lapses: g === 1 ? 1 : 0, last: now, due: now + intervalDays(s) * DAY };
  }
  const r = retrievability(card, now);
  const d = clampD(W[7] * initialDifficulty(3) + (1 - W[7]) * (card.d - W[6] * (g - 3)));
  let s;
  if (g === 1) {
    s = W[11] * Math.pow(d, -W[12]) * (Math.pow(card.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
    s = Math.min(s, card.s);
  } else {
    const hard = g === 2 ? W[15] : 1;
    const easy = g === 4 ? W[16] : 1;
    s = card.s * (Math.exp(W[8]) * (11 - d) * Math.pow(card.s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy + 1);
  }
  const due = g === 1 ? now + DAY : now + intervalDays(s) * DAY;
  return { s, d, reps: card.reps + 1, lapses: card.lapses + (g === 1 ? 1 : 0), last: now, due };
}

export const isDue = (card, now = Date.now()) => !!card && card.due <= now;

// A card due now that has never been rated: its first rating sets how well the phrase is known, as for
// a new card (review() treats reps 0 so). The phrases of topics the entrance test found known start so.
export const unrated = (now = Date.now()) => ({ s: 0, d: 0, reps: 0, lapses: 0, last: now, due: now });
