/* Scoring: 0-100 per chart, each part in its own function so it is easy to tweak.
   All lines are arrays of 30 prices (one per future candle) in the chart's normalised units
   (breakout close = 100), and `atr` is the chart's ATR at the breakout in the same units. */

export const POINTS = { direction: 30, target: 35, shape: 35 };
export const FULL_WITHIN_ATR = 0.5;      // full points only within half an ATR …
export const ZERO_AT_ATR = 3;            // … falling to 0 at 3 ATR (a typical 30-day move is ~2.7 ATR, so a flat line earns little)
export const WRONG_DIRECTION_FACTOR = 0.25; // a wrong direction keeps only a quarter of the end-point and shape points
export const QUIZ_BONUS = 10;       // Blind mode: naming the pattern right

/** Linear falloff: full points up to FULL_WITHIN_ATR, nothing from ZERO_AT_ATR. */
function falloff(distanceAtr, max) {
  if (distanceAtr <= FULL_WITHIN_ATR) return max;
  if (distanceAtr >= ZERO_AT_ATR) return 0;
  return max * (ZERO_AT_ATR - distanceAtr) / (ZERO_AT_ATR - FULL_WITHIN_ATR);
}

/** 30 points if the guess ends on the same side of the breakout close as reality did at candle 30.
    If reality barely moved (under a quarter ATR), any guess ending within 1 ATR of flat counts. */
export function directionScore(guess, real, atr) {
  const g = guess[guess.length - 1] - 100, r = real[real.length - 1] - 100;
  if (Math.abs(r) < 0.25 * atr) return Math.abs(g) <= atr ? POINTS.direction : 0;
  return Math.sign(g) === Math.sign(r) ? POINTS.direction : 0;
}

/** Up to 35 points for how close the guess ends to the real close at candle 30. */
export function targetScore(guess, real, atr) {
  return falloff(Math.abs(guess[guess.length - 1] - real[real.length - 1]) / atr, POINTS.target);
}

/** Up to 35 points for the shape: mean absolute distance over all 30 candles. */
export function shapeScore(guess, real, atr) {
  const mean = guess.reduce((s, g, k) => s + Math.abs(g - real[k]), 0) / guess.length;
  return falloff(mean / atr, POINTS.shape);
}

/** Total score. A wrong direction keeps only WRONG_DIRECTION_FACTOR of the end-point and shape points:
    being close to the price while betting the wrong way shouldn't earn much. */
export function scoreLine(guess, real, atr) {
  const d = directionScore(guess, real, atr);
  const k = d > 0 ? 1 : WRONG_DIRECTION_FACTOR;
  const t = k * targetScore(guess, real, atr), s = k * shapeScore(guess, real, atr);
  return { direction: Math.round(d), target: Math.round(t), shape: Math.round(s), total: Math.round(d + t + s) };
}

/** The textbook projection: a straight line from the breakout close (100) to the target at candle 30. */
export function textbookLine(target, n = 30) {
  return Array.from({ length: n }, (_, k) => 100 + (target - 100) * (k + 1) / n);
}

/** Share-text square: 🟩 70+, 🟨 1-69, ⬛ 0. */
export function square(score) {
  return score >= 70 ? '🟩' : score >= 1 ? '🟨' : '⬛';
}
