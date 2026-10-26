/* Number parsing and formatting, per language.
 *
 * parseNumber() turns what a player types into a number. It accepts:
 *   - shorthand suffixes: k / tis.  m / mil.  bn / mld.  t / bil.  (see SUFFIXES)
 *   - spaces (normal, no-break, narrow) and apostrophes as thousands separators
 *   - both decimal styles, decided like this:
 *       both "," and "." present  -> the one that comes last is the decimal mark ("1,234.5" / "1.234,5")
 *       one separator, used twice or more -> thousands ("1,234,567" / "1.234.567")
 *       a single separator: it is the decimal mark, EXCEPT when it looks exactly like a thousands
 *       group in the player's language: "1,500" is 1500 in en, "1.500" is 1500 in cs/sk.
 *       So in cs/sk "1,5" is 1.5, and in en "1,5k" is 1.5k (a comma before 1-2 digits can't be grouping).
 * The live preview under each input shows the result, so any surprise is visible before submitting.
 */

export const LOCALES = { en: 'en-US', cs: 'cs-CZ', sk: 'sk-SK' };

// Lower-case suffix (trailing dot removed) -> multiplier. Shared by all languages.
// "bil." follows Czech/Slovak usage (bilion = 10^12), not the English "billion".
const SUFFIXES = {
  '': 1,
  k: 1e3, tis: 1e3, thousand: 1e3, tisíc: 1e3, tisic: 1e3,
  m: 1e6, mil: 1e6, mio: 1e6, mn: 1e6, million: 1e6, milion: 1e6, milión: 1e6, miliónov: 1e6, milionů: 1e6,
  bn: 1e9, b: 1e9, mld: 1e9, billion: 1e9, miliarda: 1e9, miliardy: 1e9, miliard: 1e9, miliárd: 1e9,
  t: 1e12, tn: 1e12, trn: 1e12, bil: 1e12, trillion: 1e12, bilion: 1e12, bilión: 1e12
};

/** @returns {{status:'empty'} | {status:'invalid'} | {status:'ok', value:number}} */
export function parseNumber(raw, lang = 'en') {
  let s = String(raw ?? '').trim().toLowerCase();
  if (!s) return { status: 'empty' };
  s = s.replace(/[\s  ']/g, '');

  // sign, number part (digits + separators), optional exponent, optional suffix letters
  const m = s.match(/^([+-]?)([\d.,]*\d[\d.,]*)(?:e([+-]?\d+))?([\p{L}.]*)$/u);
  if (!m) return { status: 'invalid' };
  const [, sign, numPart, exp, suffixRaw] = m;

  const suffix = suffixRaw.replace(/\.$/, '');
  if (!(suffix in SUFFIXES)) return { status: 'invalid' };

  const plain = normalizeSeparators(numPart, lang);
  if (plain === null) return { status: 'invalid' };

  const value = Number(sign + plain) * Math.pow(10, Number(exp || 0)) * SUFFIXES[suffix];
  if (!Number.isFinite(value)) return { status: 'invalid' };
  // Round off float noise such as 2.3 * 1e6 = 2299999.9999999995
  return { status: 'ok', value: Number(value.toPrecision(12)) };
}

// Returns a string with "." as decimal mark and no grouping, or null if the separators make no sense.
function normalizeSeparators(str, lang) {
  const dots = (str.match(/\./g) || []).length;
  const commas = (str.match(/,/g) || []).length;

  if (dots && commas) {
    const dec = str.lastIndexOf('.') > str.lastIndexOf(',') ? '.' : ',';
    const grp = dec === '.' ? ',' : '.';
    const [intPart, frac, extra] = str.split(dec);
    if (extra !== undefined || frac.includes(grp)) return null;
    if (!isGrouped(intPart, grp)) return null;
    return intPart.split(grp).join('') + '.' + frac;
  }

  const sep = dots ? '.' : commas ? ',' : null;
  if (!sep) return str;
  const count = dots || commas;

  if (count > 1) return isGrouped(str, sep) ? str.split(sep).join('') : null;

  // A single separator: thousands only if it is this language's habit and looks like "1,500" / "1.500"
  const localGroup = lang === 'en' ? ',' : '.';
  if (sep === localGroup && /^\d{1,3}[.,]\d{3}$/.test(str)) return str.replace(sep, '');
  return str.replace(sep, '.');
}

// "1,234,567" -> true, "12,34" -> false
function isGrouped(str, sep) {
  if (!str.includes(sep)) return /^\d*$/.test(str);
  const esc = sep === '.' ? '\\.' : ',';
  return new RegExp('^\\d{1,3}(' + esc + '\\d{3})+$').test(str);
}

/** Full number in the player's language: 1,234,567.8 (en) or 1 234 567,8 (cs, sk). Years never get grouping. */
export function formatNumber(value, lang = 'en', { year = false } = {}) {
  const abs = Math.abs(value);
  const maxFrac = year ? 0 : abs >= 1000 ? 2 : abs >= 10 ? 3 : abs >= 1 ? 4 : 6;
  return new Intl.NumberFormat(LOCALES[lang] || LOCALES.en, {
    maximumFractionDigits: maxFrac,
    useGrouping: !year
  }).format(value);
}

/** Short form for labels: 2.3M / 2,3 mil. Falls back to the full number below 10,000 and for years. */
export function formatCompact(value, lang = 'en', { year = false } = {}) {
  if (year || Math.abs(value) < 10000) return formatNumber(value, lang, { year });
  // Beyond trillions short words run out ("100,000,000T"), so switch to 1E20 style
  if (Math.abs(value) >= 1e15) {
    return new Intl.NumberFormat(LOCALES[lang] || LOCALES.en, { notation: 'scientific', maximumSignificantDigits: 3 }).format(value);
  }
  return new Intl.NumberFormat(LOCALES[lang] || LOCALES.en, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumSignificantDigits: 3
  }).format(value);
}
