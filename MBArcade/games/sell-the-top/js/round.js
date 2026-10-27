/* The maths of one round, kept apart from the screen so it can be tested.

   A chart is { lead, p }: p[0..lead-1] is the lead-in shown before the start, p[lead] = 100 is day one
   and the round plays p[lead .. end]. The player starts invested. trades is the list of day indices
   (0 = first played day) where the position flipped: the 1st trade sells, the 2nd buys, and so on.
   Every trade fills at that day's close. */

export const DURATION = 20000;   // one year in 20 seconds, whatever the number of bars

export function days(chart) { return chart.p.length - chart.lead; }
export function price(chart, day) { return chart.p[chart.lead + day]; }

/** Wealth (starting at 1) after `day`, given the trades made up to then. */
export function wealth(chart, trades, day) {
  let w = 1, entry = price(chart, 0), invested = true;
  for (const t of trades) {
    if (t > day) break;
    if (invested) w *= price(chart, t) / entry;
    else entry = price(chart, t);
    invested = !invested;
  }
  if (invested) w *= price(chart, day) / entry;
  return w;
}

export function holdWealth(chart, day) { return price(chart, day) / price(chart, 0); }
export function isInvested(trades) { return trades.length % 2 === 0; }

/** Final result: your wealth, buy-and-hold's, and the edge (how much more money you ended with, relative). */
export function result(chart, trades) {
  const last = days(chart) - 1;
  const you = wealth(chart, trades, last), hold = holdWealth(chart, last);
  const edge = you / hold - 1;
  return { you, hold, edge, trades: trades.length, beat: edge > 0.0005, tie: Math.abs(edge) <= 0.0005 };
}

/** Index (in played days) and value of the top of the played year. */
export function top(chart) {
  let best = 0;
  for (let d = 1; d < days(chart); d++) if (price(chart, d) > price(chart, best)) best = d;
  return best;
}
