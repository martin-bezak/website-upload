/* Scoring: everything that decides points lives in this file. Tweak freely. */

/** How strict the scoring is. Lower the "zero" points to make it harder, raise them to make it easier. */
export const ZERO_AT_FACTOR = 10;   // a guess 10× too high or too low scores 0
export const ZERO_AT_YEARS = 50;    // year questions: 50 years off scores 0
export const CURVE = 2;             // >1 drops fast near the answer: being roughly right isn't enough
export const CLOSE_SCORE = 50;      // 50+ counts as a close guess (streaks, the close-guess rate)

/**
 * Points for one guess: 100 for the exact answer, falling to 0 at ZERO_AT_FACTOR × off.
 * The distance is a ratio (twice too high is as bad as half too low), so it works the same for
 * 3.5 % and for 391 billion:
 *     10 % off -> 92,  25 % off -> 82,  1.5× -> 68,  2× -> 49,  3× -> 27,  5× -> 9,  10× -> 0.
 * Year questions are measured in years, because 1900 vs 1950 is a big miss although the ratio is tiny:
 *     1 year off -> 96,  5 -> 81,  10 -> 64,  20 -> 36,  50+ -> 0.
 */
export function scoreGuess(guess, answer, opts = {}) {
  if (!(guess > 0) || !(answer > 0)) return 0;
  const off = opts.year
    ? Math.abs(guess - answer) / ZERO_AT_YEARS
    : Math.abs(Math.log10(guess / answer)) / Math.log10(ZERO_AT_FACTOR);
  return Math.round(100 * Math.pow(Math.max(0, 1 - off), CURVE));
}

/** Square for the share text. */
export function shareSquare(score) {
  if (score >= 70) return '🟩';
  if (score >= 1) return '🟨';
  return '⬛';
}
