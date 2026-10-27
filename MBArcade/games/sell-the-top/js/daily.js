/* The daily set: 3 charts, the same for everyone on the same calendar day, in every language.
   The date seeds a small PRNG (FNV-1a hash -> mulberry32): one stock, one crypto chart and one from
   commodities / indices / currencies, in a shuffled order. Charts are sorted by id first, so the
   order of index.json doesn't matter. */

export const DAILY_COUNT = 3;
const EPOCH = Date.UTC(2026, 9, 27);   // Sell the top #1 = 27 October 2026

export function todayKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function dailyNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000) + 1;
}

export function dailyIds(charts, key) {
  const rand = mulberry32(hashString('sell-the-top:' + key));
  const sorted = [...charts].sort((a, b) => (a.id < b.id ? -1 : 1));
  const groups = [
    sorted.filter(c => c.c === 'stock'),
    sorted.filter(c => c.c === 'crypto'),
    sorted.filter(c => c.c !== 'stock' && c.c !== 'crypto')
  ];
  const ids = groups.map(g => g[Math.floor(rand() * g.length)].id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
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
