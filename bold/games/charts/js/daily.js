/* The daily set: 5 charts, the same for everyone on the same calendar day, in every language.
   The date string seeds a small PRNG (FNV-1a hash -> mulberry32). It first shuffles the list of
   patterns and takes five, so each day has five different patterns ("balanced"), then picks one
   chart of each with the same generator. Charts are sorted by id first, so the order of index.json
   doesn't matter. */

export const DAILY_COUNT = 5;
const EPOCH = Date.UTC(2026, 9, 21);   // Chart Game #1 = 21 October 2026

export function todayKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function dailyNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000) + 1;
}

export function dailyIds(charts, key) {
  const rand = mulberry32(hashString('charts:' + key));
  const byPattern = {};
  for (const c of [...charts].sort((a, b) => (a.id < b.id ? -1 : 1))) (byPattern[c.p] = byPattern[c.p] || []).push(c.id);
  const patterns = shuffle(Object.keys(byPattern).sort(), rand).slice(0, DAILY_COUNT);
  return patterns.map(p => byPattern[p][Math.floor(rand() * byPattern[p].length)]);
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
