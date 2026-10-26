/* The daily puzzle: the same 5 questions for everyone on the same calendar day, in every language.
 *
 * How: the date string (e.g. "2026-10-21") is hashed into a 32-bit seed, the seed drives a small
 * deterministic random generator (mulberry32), and that generator shuffles the question ids
 * (Fisher–Yates). The first 5 ids are today's puzzle, whatever their difficulty. Ids are sorted first, so the order of the
 * questions in questions.json doesn't matter. Adding or removing questions changes future picks,
 * but a player's started daily keeps its saved ids.
 */

export const DAILY_COUNT = 5;
const EPOCH = Date.UTC(2026, 9, 21); // Daily #1 = 21 October 2026

/** Local calendar date as "YYYY-MM-DD". */
export function todayKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** Puzzle number shown in the share text ("Estimation #42"). */
export function dailyNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000) + 1;
}

export function dailyIds(bank, key) {
  const ids = bank.map(q => q.id).sort();
  const rand = mulberry32(hashString('estimate:' + key));
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  // Any difficulty: a day can be all easy, all hard or anything in between
  return ids.slice(0, DAILY_COUNT);
}

// FNV-1a: a string -> 32-bit unsigned integer
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: tiny seeded PRNG, returns floats in [0, 1)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
