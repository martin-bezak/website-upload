// Bitcoin Lab · Strategy page: today's action for the chosen profile, the three profiles, and the mock portfolio.
import { $, $$, load, usd, pc, when, liveWidget, chrome, el, svg, linear, log, ticks, logTicks, path, yGrid, xLabels, yearTicks, responsive } from './lab.js?v=6';

const KEYS = ['growth', 'balanced', 'defensive'];
const NAMES = { growth: 'Growth', balanced: 'Balanced', defensive: 'Defensive' };
const BENCH = [
  ['btc', 'Bitcoin, buy and hold'], ['sp500', 'S&P 500'],
];
let P, sel = 'balanced', show = { btc: true, sp500: true, others: false };
const DAY = 86400;

// Bitcoin trades all day, but the rules read daily closes: the signal is from 00:00 UTC, the page updates after it
const WHEN = 'The signal is from the daily close at 00:00 UTC; this page updates around 03:30 UTC, so trade when you see it.';
const fmtUsd = v => '$' + Math.round(v).toLocaleString('en-US');
// signed percentages; a value that rounds to zero shows as 0%, never −0%
const sgn = (v, d) => { const t = Math.abs(v * 100).toFixed(d); return (+t === 0 ? '' : v > 0 ? '+' : '−') + t + '%'; };
const pct1 = v => sgn(v, 1);
const pct0 = v => sgn(v, 0);

/* Switching strategy re-renders sections of different heights above the reader. Keep whatever is
   just under the sticky bars at the same spot on screen (Safari has no built-in scroll anchoring). */
function keepPlace(fn) {
  // the first landmark (heading, chart, row, card, block with an id) that starts below the sticky bars
  const bar = $('.h-bar').getBoundingClientRect().bottom;
  let anchor = null, best = Infinity;
  for (const c of $$('main [id], main h2, main h3, main h4, main tr, main .pcard, main p')) {
    const r = c.getBoundingClientRect();
    if (r.height && r.top >= bar && r.top < best) { best = r.top; anchor = c; }
  }
  const before = anchor ? anchor.getBoundingClientRect().top : 0;
  fn();
  if (anchor && anchor.isConnected) window.scrollBy({ top: anchor.getBoundingClientRect().top - before, behavior: 'instant' });
}

/* ---------- profile choice: ?s= in the URL, remembered on this device ---------- */
function setProfile(k, push = true) {
  sel = k;
  $$('[data-p]').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === k));
  $$('[data-card]').forEach(c => c.classList.toggle('is-sel', c.dataset.card === k));
  $$('.pc-pick').forEach(b => (b.textContent = b.dataset.p === k ? 'Selected' : 'Use ' + NAMES[b.dataset.p]));
  if (push) {
    const u = new URL(location.href); u.searchParams.set('s', k); history.replaceState(null, '', u);
    try { localStorage.setItem('btclab-profile', k); } catch (e) {}
  }
  renderToday(); renderExplain(); renderLive(); renderKey(); renderMock();
}

/* ---------- today ---------- */
function renderToday() {
  const pr = P.profiles[sel], st = pr.state, L = P.levels;
  const inBtc = st.target;
  const word = st.action === 'HOLD' ? (inBtc > 0.99 ? 'Hold BTC' : inBtc < 0.01 ? 'Hold cash' : `Hold ${Math.round(inBtc * 100)}% BTC`) : st.action === 'BUY' ? 'Buy' : 'Sell';
  $('#act').textContent = word;
  $('#act').className = 'act-' + st.action.toLowerCase();
  $('#act-kicker').textContent = `${pr.name} · after the close on ${when(P.last)}`;
  // a squeeze signal can fire while the strategy already holds what it asks for: no trade, but say why
  const signal = st.action === 'HOLD' && st.why ? ` Today’s ${st.why} keeps it ${st.why.endsWith('breakdown') ? 'out' : 'in'} until that trade’s stop, target or 20 days.` : '';
  const sub = {
    HOLD: (inBtc > 0.99 ? 'No change. Stay fully in Bitcoin.' : inBtc < 0.01 ? 'No change. Stay out of Bitcoin and keep the cash earning interest.' : `No change. Keep about ${Math.round(inBtc * 100)}% in Bitcoin.`) + signal,
    BUY: `Move to ${Math.round(st.target * 100)}% Bitcoin (${st.why}). ${WHEN}`,
    SELL: `Move to ${Math.round(st.target * 100)}% Bitcoin (${st.why}). ${WHEN}`,
  }[st.action];
  $('#act-sub').textContent = sub;
  $('#pos-btc').style.width = (inBtc * 100) + '%';
  $('#pos-btc-p').textContent = Math.round(inBtc * 100) + '%';
  $('#pos-cash-p').textContent = Math.round((1 - inBtc) * 100) + '%';
  $('#rf').textContent = (P.rf_now * 100).toFixed(1) + '%';
  renderAmount();

  // active trade
  const a = st.active, box = $('#active');
  if (a) {
    box.hidden = false;
    box.innerHTML = a.dir < 0
      ? `<b>Open sell signal</b> since ${when(a.since)}, sold at ${fmtUsd(a.entry)}. Buys back if a day’s price reaches <b>${fmtUsd(a.stop)}</b> (stop) or <b>${fmtUsd(a.target)}</b> (target), or on ${when(a.until)} at the latest.`
      : `<b>Open buy signal</b> since ${when(a.since)}, bought at ${fmtUsd(a.entry)}. Stop <b>${fmtUsd(a.stop)}</b>, target <b>${fmtUsd(a.target)}</b>, ends ${when(a.until)} at the latest.`;
  } else box.hidden = true;

  // what would change it
  const w = [], sq = L.squeeze, maxMa = Math.max(L.ma50, L.ma100, L.ma200), minMa = Math.min(L.ma50, L.ma100, L.ma200);
  // a squeeze signal that fired at this close: its trade starts now, so the usual triggers are on hold
  const fired = st.pending && st.why ? (st.why.endsWith('breakdown') ? -1 : 1) : 0;
  if (fired) {
    w.push(`The <b>${st.why}</b> fired at this close: ${fmtUsd(L.close)} is ${fired < 0 ? 'below' : 'above'} the 20-day range. The trade starts now and ends at its stop, about <b>${fmtUsd(fired < 0 ? sq.hi : sq.lo)}</b>, at a target twice as far the other way, or after 20 days. ${sel === 'growth' ? 'Then it buys back.' : 'Then the averages decide again.'}`);
  } else if (sel === 'growth') {
    if (a && a.dir < 0) w.push(`It buys back at the stop or target above, or after 20 days.`);
    else if (sq.armed) w.push(`<b>Sell</b> if a daily close is below <b>${fmtUsd(sq.lo)}</b>. Bitcoin has been unusually calm, so a break down is the signal this strategy waits for (watch until ${when(sq.until)}).`);
    else w.push(`Nothing is armed. It sells only after a calm stretch (volatility in the lowest 20% of the past year) ends with a break down.`);
  } else {
    const inNow = st.w_now > 0.01;
    if (a) w.push(`The averages decide again when the open ${a.dir < 0 ? 'sell' : 'buy'} signal above ends.`);
    else if (inNow) w.push(`<b>Sell</b> if a daily close falls below any of the 50-, 100- and 200-day averages; the highest is now ${fmtUsd(maxMa)}.`);
    else w.push(`<b>Buy</b> when a daily close is above all three averages: 50-day ${fmtUsd(L.ma50)}, 100-day ${fmtUsd(L.ma100)}, 200-day ${fmtUsd(L.ma200)}.`);
    if (sq.armed && !a) {
      w.push(`Calm market, signal armed until ${when(sq.until)}: a daily close above <b>${fmtUsd(sq.hi)}</b> buys early; below <b>${fmtUsd(sq.lo)}</b> sells.`);
    }
    if (sel === 'defensive') w.push(`Position size when in: ${Math.round(L.size * 100)}% (Bitcoin’s volatility is ${Math.round(L.vol * 100)}% a year; the target is 50%).`);
  }
  w.push(`Close on ${when(P.last)}: ${fmtUsd(L.close)}.`);
  $('#watch').innerHTML = w.map(x => `<li>${x}</li>`).join('');

  // record
  const rec = pr.record, ci = c => c[0] == null ? '' : ` (likely range ${Math.round(c[0] * 100)}–${Math.round(c[1] * 100)}%)`;
  const line = (r, label, rightIs) => r.n ? `<div class="rec-line"><b>${Math.round(r.right / r.n * 100)}%</b><span>${label}: ${r.right} of ${r.n} ${rightIs}${ci(r.ci)}. Median move of Bitcoin over these periods: ${pct1(r.median_btc)}.</span></div>` : '';
  $('#record').innerHTML = line(rec.in, 'Holding Bitcoin', 'times Bitcoin rose while held') +
    line(rec.cash, 'Sitting in cash', 'times Bitcoin fell while out') +
    `<p class="small rec-why">A low hit rate is normal here: the strategy loses small and often, and wins big and rarely. What matters is the result below, not how often it is right.</p>`;
  $('#today').removeAttribute('aria-busy');
}

function amountValue() {
  const v = parseFloat($('#amount').value.replace(/[^0-9.]/g, ''));
  return isFinite(v) && v > 0 ? v : 0;
}
function renderAmount() {
  const v = amountValue(), w = P.profiles[sel].state.target;
  $('#amount-out').innerHTML = v ? `Bitcoin: <b>${fmtUsd(v * w)}</b> (${(v * w / P.price).toFixed(4)} BTC at ${fmtUsd(P.price)}) · Cash: <b>${fmtUsd(v * (1 - w))}</b>` : 'Type an amount to see the split.';
}

/* ---------- the three cards ---------- */
function expectations(k) {
  const pr = P.profiles[k], w = pr.w, n = w.length, yrs = (n - 1) / 365.25;
  let changes = 0, spells = [], run = 0;
  for (let i = 1; i < n; i++) if (Math.abs(w[i] - w[i - 1]) > 0.05) changes++;
  for (let i = 0; i < n; i++) { if (w[i] > 0.01) run++; else if (run) { spells.push(run); run = 0; } }
  if (run) spells.push(run);
  spells.sort((a, b) => a - b);
  const med = spells.length ? spells[Math.floor(spells.length / 2)] : 0;
  const ys = Object.values(pr.years);
  return {
    inBtc: w.filter(x => x > 0.01).length / n, trades: changes / yrs, hold: med,
    mult: 1 + pr.stats.total, mdd: pr.stats.mdd, worst: Math.min(...ys), cagr: pr.stats.cagr,
  };
}
function renderCards() {
  for (const k of KEYS) {
    const e = expectations(k);
    $(`[data-expect="${k}"]`).innerHTML = `
      <div><dt>Time in Bitcoin</dt><dd>${Math.round(e.inBtc * 100)}% of days</dd></div>
      <div><dt>Trades</dt><dd>about ${e.trades.toFixed(0)} a year</dd></div>
      <div><dt>Typical stay in Bitcoin</dt><dd>${e.hold >= 60 ? Math.round(e.hold / 30) + ' months' : e.hold + ' days'}</dd></div>
      <div><dt>$1 since Sep 2018</dt><dd>${e.mult.toFixed(0)}× (${Math.round(e.cagr * 100)}% a year)</dd></div>
      <div><dt>Worst drop</dt><dd>${Math.round(e.mdd * 100)}%</dd></div>
      <div><dt>Worst calendar year</dt><dd>${Math.round(e.worst * 100)}%</dd></div>`;
  }
  const b = P.series.btc;
  $('#three').insertAdjacentHTML('afterend', `<p class="chart-cap">For comparison, Bitcoin itself: ${(b[b.length - 1] / b[0]).toFixed(0)}× since Sep 2018, 100% of days in Bitcoin, worst drop −77%, worst year −64%. Simulated with fees; trades are counted as any change of position.</p>`);
  $$('[data-card]').forEach(c => c.addEventListener('click', e => { if (!e.target.closest('a, button')) keepPlace(() => setProfile(c.dataset.card)); }));
}

/* ---------- the chosen strategy, in detail ---------- */
const DETAIL = {
  growth: {
    buys: 'It is in Bitcoin by default. After a sell signal it buys back when that trade ends: the price returns to the top of the 20-day range (the stop), falls twice as far as that distance (the target), or 20 days pass.',
    sells: 'Only after a calm stretch (20-day volatility in the lowest 20% of the past year) followed by a daily close below the range of the last 20 days. It then sells everything right after that close.',
    between: 'Fully in Bitcoin. While in cash after a sell, the money earns the T-bill rate.',
  },
  balanced: {
    buys: 'When a daily close is above all three averages (50, 100 and 200 days), or early, when a calm stretch ends with a close above the 20-day range. It buys 100% right after that close.',
    sells: 'When a daily close falls below any of the three averages, or early, when a calm stretch ends with a close below the 20-day range.',
    between: 'Either all in Bitcoin or all in cash earning the T-bill rate. An early (squeeze) move lasts until its stop, target or 20 days; then the averages decide again.',
  },
  defensive: {
    buys: 'At the same moments as Balanced, but buys only 50% ÷ Bitcoin’s yearly volatility of the portfolio, at most 100%. In calm markets that is the full amount; in wild ones much less.',
    sells: 'At the same moments as Balanced, to 100% cash.',
    between: 'While in Bitcoin it trims or adds as volatility changes, but only when the gap is more than 10 points. The cash part earns the T-bill rate.',
  },
};
function renderExplain() {
  const d = DETAIL[sel], y = P.profiles[sel].years, b = btcYears();
  const f = v => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v * 100)) + '%';
  const year = k => `${k}: <b>${f(y[k])}</b> vs Bitcoin ${f(b[k])}`;
  $('#explain').innerHTML = `
    <h3 class="h3">How ${NAMES[sel]} works, in detail</h3>
    <div class="ex-grid">
      <div><h4 class="pc-h">When it buys</h4><p>${d.buys}</p></div>
      <div><h4 class="pc-h">When it sells</h4><p>${d.sells}</p></div>
      <div><h4 class="pc-h">In between</h4><p>${d.between}</p></div>
    </div>
    <div class="ex-years">
      <p><span class="ex-tag">In a crash</span> ${year('2022')}</p>
      <p><span class="ex-tag">In a boom</span> ${year('2020')}</p>
      <p><span class="ex-tag">Sideways</span> ${year('2025')}</p>
    </div>
    <p class="small"><a href="method.html#${sel}" class="text-link">Exact rules, risks and tests for ${NAMES[sel]}</a></p>`;
}
let _by = null;
function btcYears() {
  if (_by) return _by;
  const b = P.series.btc, out = {};
  let y0 = null, start = b[0];
  for (let i = 0; i < P.n; i++) {
    const y = new Date((P.t0 + i * DAY) * 1000).getUTCFullYear();
    if (y0 !== null && y !== y0) { out[y0] = b[i - 1] / start - 1; start = b[i - 1]; }
    y0 = y;
  }
  out[y0] = b[P.n - 1] / start - 1;
  return (_by = out);
}

/* ---------- live record ---------- */
function renderLive() {
  const days = Object.entries(P.live?.days || {}).map(([t, v]) => [+t, v]).sort((a, b) => b[0] - a[0]);
  if (!days.length) return;
  const first = days[days.length - 1][0], i0 = Math.round((first - P.t0) / DAY);
  const chg = arr => arr[P.n - 1] / arr[i0] - 1;
  const f = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%';
  $('#live-sum').innerHTML = days.length < 2
    ? `<p>The live record started after the close on <b>${when(first)}</b>. The first result appears after the next night’s update.</p>`
    : `<p>Since the live record started (${when(first)}, ${days.length} nights): <b>${NAMES[sel]} ${f(chg(P.profiles[sel].eq))}</b> · Bitcoin ${f(chg(P.series.btc))}` +
      KEYS.filter(k => k !== sel).map(k => ` · ${NAMES[k]} ${f(chg(P.profiles[k].eq))}`).join('') + '</p>';
  const cell = a => `${a.action === 'HOLD' ? (a.target > 0.99 ? 'Hold BTC' : a.target < 0.01 ? 'Hold cash' : 'Hold ' + Math.round(a.target * 100) + '%') : (a.action === 'BUY' ? 'Buy' : 'Sell') + ' → ' + Math.round(a.target * 100) + '%'}`;
  $('#live-rows').innerHTML = days.slice(0, 30).map(([t, v]) =>
    `<tr><td data-l="After the close on"><b>${when(t)}</b></td><td class="n" data-l="BTC price">${fmtUsd(v.price)}</td>` +
    KEYS.map(k => `<td class="n ${k === sel ? 'is-cur' : ''}" data-l="${NAMES[k]}">${cell(v[k])}</td>`).join('') + '</tr>').join('');
  liveI0 = i0;
  renderLate(i0, f);
  $('#live-key').innerHTML = `<span><i class="k-live"></i> ${NAMES[sel]}</span><span><i class="k-late"></i> ${NAMES[sel]}, traded ${P.late?.hours ?? 4} hours late</span><span><i class="k-lbtc"></i> Bitcoin</span>`;
  drawLive();
}

/* the small score: the same rules with every trade some hours after the close (about when this page updates) */
function renderLate(i0, f) {
  const L = P.late, box = $('#late-score');
  if (!L) { box.hidden = true; return; }
  const live = L.live[sel], nowAt = P.profiles[sel].eq[P.n - 1] / P.profiles[sel].eq[i0] - 1;
  const lateAt = live[live.length - 1] - 1;
  box.innerHTML = `<b>Traded ${L.hours} hours late</b>, about when this page updates: ${NAMES[sel]} ${f(lateAt)} since the live record started (at the close: ${f(nowAt)}). ` +
    `Over the whole backtest: ${KEYS.map(k => `${NAMES[k]} ${L.mult[k].toFixed(1)}× instead of ${(1 + P.profiles[k].stats.total).toFixed(1)}×`).join(', ')}. <a href="method.html#delay" class="text-link">Why</a>`;
}

/* chart of the live record only: $100,000 on the first live night, nothing from the backtest before it */
let liveI0 = 0, drawLive = () => {};
function liveChart(w) {
  if (!P) return;
  const box = $('#live-chart'), i0 = liveI0, n = P.n - i0;
  const val = arr => arr.slice(i0).map(v => 100000 * v / arr[i0]);
  const L = [
    { vals: val(P.series.btc), cls: 'lv-btc', label: 'Bitcoin' },
    ...(P.late ? [{ vals: P.late.live[sel].map(v => 100000 * v), cls: 'lv-late', label: `${NAMES[sel]}, ${P.late.hours} h late` }] : []),
    { vals: val(P.profiles[sel].eq), cls: 'lv-acc', label: NAMES[sel], main: true },
  ];
  const H = w < 600 ? 220 : 280, m = { l: w < 600 ? 60 : 72, r: 16, t: 16, b: 30 };
  const g = svg(box, w, H);
  g.setAttribute('aria-label', `Value of $100,000 in ${NAMES[sel]} and in Bitcoin since the live record started on ${when(P.t0 + i0 * DAY)}`);
  let lo = Infinity, hi = -Infinity;
  for (const l of L) for (const v of l.vals) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const pad = Math.max(500, (hi - lo) * 0.15);
  const sy = linear([lo - pad, hi + pad], [H - m.b, m.t]);
  const sx = linear([0, Math.max(1, n - 1)], [m.l, w - m.r]);
  yGrid(g, sy, ticks(lo - pad, hi + pad, 4), m.l, w - m.r, v => '$' + Math.round(v).toLocaleString('en-US'), { zero: 100000 });
  const xs = Array.from({ length: n }, (_, i) => sx(i));
  const lab = n <= 8 ? xs.map((_, i) => i) : [0, Math.round((n - 1) / 2), n - 1];
  for (const i of lab) {
    const t = el('text', { x: xs[i], y: H - 8, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }, g);
    t.textContent = when(P.t0 + (i0 + i) * DAY).replace(/ \d{4}$/, '');
  }
  for (const l of L) {
    el('path', { d: path(xs, l.vals.map(sy)), fill: 'none', class: 'lv ' + l.cls, 'stroke-width': l.main ? 3.5 : 2 }, g);
    if (n <= 60) for (let i = 0; i < n; i++) el('circle', { cx: xs[i], cy: sy(l.vals[i]), r: l.main ? 4 : 3, class: 'lv-dot ' + l.cls }, g);
  }
  const end = el('text', { x: w - m.r, y: sy(L[L.length - 1].vals[n - 1]) - 10, 'text-anchor': 'end', class: 't-strong' }, g);
  end.textContent = fmtUsd(L[L.length - 1].vals[n - 1]);
}

/* ---------- mock portfolio: a zoomable window over the whole history ---------- */
const MIN_SPAN = 30;                 // days
let v0 = 0, v1 = 0;                  // first and last day shown; fractional, so zooming and panning glide instead of stepping
let geo = null, navGeo = null;       // last drawn chart geometry, for the pointer handlers
const iso = i => new Date((P.t0 + i * DAY) * 1000).toISOString().slice(0, 10);
const idxOf = d => Math.round((Date.parse(d + 'T00:00:00Z') / 1000 - P.t0) / DAY);
// the whole days the numbers are about (r0..r1) and the days drawn, one either side so lines run off the edges (i0..i1)
const win = () => ({ r0: Math.round(v0), r1: Math.round(v1), i0: Math.floor(v0), i1: Math.min(P.n - 1, Math.ceil(v1)) });

/* The start date is the day the $100,000 goes in. Moving and zooming only change which part of the story you see
   (never before the start); the lines are re-based only when a new start date is chosen. */
let base = 0;
function setView(a, b) {
  const max = P.n - 1;
  const span = Math.min(max - base, Math.max(MIN_SPAN, b - a));
  a = Math.max(base, Math.min(max - span, a));
  if (a === v0 && a + span === v1) return;
  v0 = a; v1 = a + span;
  scheduleMock();
}
function setStart(i, end = P.n - 1) {
  base = Math.max(0, Math.min(P.n - 1 - MIN_SPAN, Math.round(i)));
  v0 = Math.max(v0, base);
  setView(base, Math.max(end, base + MIN_SPAN));
  rangeText = ''; valuesSig = '';
  scheduleMock();
}
let raf = 0, tableTimer = 0;
function scheduleMock() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderMock(); }); }

// $100,000 on day `base`, followed from day a to day b
function seriesWin(arr, a, b, base) { const k = 100000 / arr[base]; return arr.slice(a, b + 1).map(v => v * k); }
function metrics(vals, i0) {
  const end = vals[vals.length - 1];
  const yrs = (vals.length - 1) / 365.25;
  let peak = vals[0], mdd = 0;
  for (const v of vals) { if (v > peak) peak = v; mdd = Math.min(mdd, v / peak - 1); }
  let worst = Infinity, yStart = vals[0], curY = new Date((P.t0 + i0 * DAY) * 1000).getUTCFullYear();
  for (let k = 1; k < vals.length; k++) {
    const y = new Date((P.t0 + (i0 + k) * DAY) * 1000).getUTCFullYear();
    if (y !== curY) { worst = Math.min(worst, vals[k - 1] / yStart - 1); yStart = vals[k - 1]; curY = y; }
  }
  worst = Math.min(worst, end / yStart - 1);
  return { end, ret: end / 100000 - 1, cagr: yrs > 0.5 ? (end / 100000) ** (1 / yrs) - 1 : null, mdd, worst };
}
// the lines on the chart, as raw series (scaled to $100,000 when drawn)
function lines() {
  const L = [{ key: sel, label: NAMES[sel] + ' strategy', arr: P.profiles[sel].eq, cls: 'acc', main: true }];
  if (show.others) for (const k of KEYS) if (k !== sel) L.push({ key: k, label: NAMES[k] + ' strategy', arr: P.profiles[k].eq, cls: 'other' });
  for (const [k, label] of BENCH) if (show[k] && P.series[k]) L.push({ key: k, label, arr: P.series[k], cls: k });
  return L;
}
function renderKey() {
  const toggles = [...BENCH.filter(([k]) => P.series[k]), ['others', 'Other two strategies']];
  $('#mock-key').innerHTML = `<span><i class="k-acc"></i> ${NAMES[sel]} strategy</span>` + toggles.map(([k, label]) =>
    `<label class="key-toggle"><input type="checkbox" data-show="${k}" ${show[k] ? 'checked' : ''}> <i class="k-${k}"></i> ${label}</label>`).join('');
  $$('[data-show]').forEach(c => c.addEventListener('change', () => { show[c.dataset.show] = c.checked; scheduleMock(); }));
}
let rangeText = '';
function renderMock() {
  if (!P) return;
  const { r0, r1 } = win(), days = r1 - base;
  const txt = `$100,000 on <b>${when(P.t0 + base * DAY)}</b>, followed to <b>${when(P.t0 + r1 * DAY)}</b> · ${days >= 730 ? (days / 365.25).toFixed(1) + ' years' : days + ' days'}`
    + (r0 > base ? `<br><span class="mock-showing">Showing ${when(P.t0 + r0 * DAY)} to ${when(P.t0 + r1 * DAY)}</span>` : '');
  if (txt !== rangeText) {
    rangeText = txt;
    $('#mock-range').innerHTML = txt;
    const fr = $('#from'), to = $('#to');
    if (document.activeElement !== fr) fr.value = iso(base);
    if (document.activeElement !== to) to.value = iso(r1);
    // the table is the slow part: while a gesture is running, catch up once it pauses
    clearTimeout(tableTimer); tableTimer = setTimeout(renderTable, 120);
  }
  drawMock(); drawNav();
}
function renderTable() {
  const { r1 } = win(), s = arr => seriesWin(arr, base, r1, base);
  const rows = [...KEYS.map(k => ({ label: NAMES[k] + ' strategy', vals: s(P.profiles[k].eq), cur: k === sel })),
                ...BENCH.filter(([k]) => P.series[k]).map(([k, label]) => ({ label, vals: s(P.series[k]) }))];
  $('#mock-table').innerHTML = rows.map(r => {
    const m = metrics(r.vals, base);
    return `<tr class="${r.cur ? 'is-cur' : ''}"><td data-l="Portfolio"><b>${r.label}</b></td><td class="n" data-l="Worth at the end"><span class="big">${fmtUsd(m.end)}</span></td>
      <td class="n" data-l="Return">${pct0(m.ret)}</td><td class="n" data-l="Per year">${m.cagr == null ? '–' : pct1(m.cagr)}</td>
      <td class="n" data-l="Worst drop">${pct0(m.mdd)}</td><td class="n" data-l="Worst calendar year">${pct0(m.worst)}</td></tr>`;
  }).join('');
}
let drawMock = () => {}, drawNav = () => {};
const short = v => v === 0 ? '$0' : v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M' : '$' + Math.round(v / 1000) + 'k';

// x labels pinned to the calendar (1st of a month, or every few days), so they slide with the lines instead of changing text
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function calTicks(k0, k1, maxN) {
  const span = k1 - k0, out = [];
  if (span > 730) return yearTicks(k0, k1, maxN).map(([k, y]) => [k, String(y)]);
  const dd = k => new Date(k * 864e5);
  if (span < 75) {
    const step = [1, 2, 7, 14].find(s => span / s <= maxN) || 14;
    // weekly steps land on Mondays (day 4 of the epoch was a Monday)
    for (let k = Math.ceil((k0 - 4) / step) * step + 4; k <= k1; k += step) { const d = dd(k); out.push([k, `${d.getUTCDate()} ${MON3[d.getUTCMonth()]}`]); }
    return out;
  }
  const step = [1, 2, 3, 6].find(s => span / 30.4 / s <= maxN) || 12;
  const a = dd(k0);
  for (let y = a.getUTCFullYear(), mo = a.getUTCMonth(); ; mo++) {
    if (mo > 11) { mo = 0; y++; }
    const k = Date.UTC(y, mo, 1) / 864e5;
    if (k > k1) break;
    if (k >= k0 && mo % step === 0) out.push([k, mo === 0 ? String(y) : MON3[mo] + (step === 1 && span > 150 ? '' : ' ' + String(y).slice(2))]);
  }
  return out;
}

// A line through at most two points per pixel column (the lowest and highest), so a long history draws as fast as a short one
function thinPath(sx, sy, arr, k, i0, i1) {
  let d = '', col = null, lo = 0, hi = 0, loI = 0, hiI = 0;
  const flush = () => {
    if (col == null) return;
    const [a, b] = loI <= hiI ? [loI, hiI] : [hiI, loI];
    d += (d ? 'L' : 'M') + sx(a).toFixed(1) + ',' + sy(arr[a] * k).toFixed(1);
    if (b !== a) d += 'L' + sx(b).toFixed(1) + ',' + sy(arr[b] * k).toFixed(1);
  };
  for (let i = i0; i <= i1; i++) {
    const c = Math.floor(sx(i)), v = arr[i];
    if (c !== col) { flush(); col = c; lo = hi = v; loI = hiI = i; }
    else { if (v < lo) { lo = v; loI = i; } if (v > hi) { hi = v; hiI = i; } }
  }
  flush();
  return d;
}

/* What is on screen eases toward where it should be. While you move, every line keeps its scale, so nothing
   jumps; when you stop, the lines re-base to $100,000 on the new first day and the y axis settles, in about a quarter second. */
const ease = { k: {}, lo: 0, hi: 0, t: 0, sig: '' };
function mockChart(w) {
  if (!P) return;
  const box = $('#mock-chart'), L = lines(), useLog = $('#logscale').checked;
  const { r0, r1, i0, i1 } = win();
  const H = Math.round(Math.max(300, Math.min(520, w * (w < 600 ? 0.9 : 0.5))));
  const m = { l: w < 600 ? 52 : 64, r: 12, t: 16, b: 30 };

  // build the frame once; afterwards only the paths, labels and axis are updated
  const sig = [w, useLog, sel, ...L.map(l => l.key)].join('|');
  const fresh = !geo || geo.sig !== sig;
  if (fresh) {
    const g = svg(box, w, H);
    const clip = 'mc' + Math.random().toString(36).slice(2);
    el('rect', { x: m.l, y: 0, width: w - m.l - m.r, height: H }, el('clipPath', { id: clip }, el('defs', {}, g)));
    const axis = el('g', {}, g);
    const plot = el('g', { 'clip-path': `url(#${clip})` }, g);
    const paths = {};
    for (const l of [...L].reverse()) paths[l.key] = el('path', { fill: 'none', class: 'ml ml-' + l.cls, 'stroke-width': l.main ? 3.5 : 2 }, plot);
    const labels = el('g', {}, g);
    const cross = el('line', { y1: m.t, y2: H - m.b, stroke: 'var(--c-main)', 'stroke-width': 1, opacity: 0, class: 'cross' }, g);
    geo = { sig, w, H, m, g, axis, paths, labels, cross };
  }
  const { g, axis, paths, labels } = geo;
  g.setAttribute('aria-label', `Value of $100,000 put in on ${when(P.t0 + base * DAY)}, shown from ${when(P.t0 + r0 * DAY)} to ${when(P.t0 + r1 * DAY)}, in each portfolio`);

  // scale of each line: $100,000 on the start date; when the start changes, the lines glide to their new scale
  const now = performance.now(), dt = Math.min(64, now - (ease.t || now)); ease.t = now;
  const a = fresh || ease.sig !== sig ? 1 : 1 - Math.pow(0.72, dt / 16);    // share of the remaining distance covered this frame
  let busy = false;
  for (const l of L) {
    const target = 100000 / l.arr[base], cur = ease.k[l.key];
    if (cur == null || a === 1) ease.k[l.key] = target;
    else {
      const next = cur * Math.pow(target / cur, a);
      ease.k[l.key] = Math.abs(next / target - 1) < 1e-4 ? target : next;
    }
    if (ease.k[l.key] !== target) busy = true;
  }
  // y range: what is on screen right now, eased (in log terms, so up and down feel the same)
  let lo = Infinity, hi = -Infinity;
  for (const l of L) { const k = ease.k[l.key]; for (let i = r0; i <= r1; i++) { const v = l.arr[i] * k; if (v < lo) lo = v; if (v > hi) hi = v; } }
  if (a === 1 || !ease.lo) { ease.lo = lo; ease.hi = hi; }
  else {
    ease.lo *= Math.pow(lo / ease.lo, a); ease.hi *= Math.pow(hi / ease.hi, a);
    if (Math.abs(ease.lo / lo - 1) < 1e-3 && Math.abs(ease.hi / hi - 1) < 1e-3) { ease.lo = lo; ease.hi = hi; } else busy = true;
  }
  ease.sig = sig;
  lo = ease.lo; hi = ease.hi;

  const sx = linear([v0, v1], [m.l, w - m.r]);
  const sy = useLog ? log([lo * 0.97, hi * 1.03], [H - m.b, m.t]) : linear([Math.min(0, lo), hi * 1.05], [H - m.b, m.t]);
  geo.sx = sx;
  axis.replaceChildren(); labels.replaceChildren();
  let tk = useLog ? logTicks(lo * 0.97, hi * 1.03) : ticks(Math.min(0, lo), hi, 5);
  if (useLog && tk.length < 3) tk = ticks(lo, hi, 4).filter(v => v > 0);
  yGrid(axis, sy, tk, m.l, w - m.r, short, { zero: 100000 });
  const t0d = P.t0 / DAY;
  for (const [k, label] of calTicks(t0d + v0, t0d + v1, w < 600 ? 4 : 8)) {
    const x = sx(k - t0d);
    if (x < m.l + 14 || x > w - m.r - 14) continue;
    el('text', { x, y: geo.H - 8, 'text-anchor': 'middle' }, axis).textContent = label;
  }
  for (const l of L) paths[l.key].setAttribute('d', thinPath(sx, sy, l.arr, ease.k[l.key], i0, i1));
  // end values for the strategy and Bitcoin, pushed apart when they would overlap
  const ends = L.filter(x => x.main || x.cls === 'btc').map(l => { const v = l.arr[r1] * ease.k[l.key]; return { v, y: sy(v) - 8 }; })
    .sort((p, q) => p.y - q.y).filter((e, i, arr) => i === 0 || short(e.v) !== short(arr[i - 1].v));
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;
  for (const e of ends) el('text', { x: w - m.r, y: Math.max(m.t + 4, e.y), 'text-anchor': 'end', class: 't-strong' }, labels).textContent = short(e.v);
  geo.L = L;
  if (readoutX != null) showReadout(readoutX); else hideReadout();
  if (busy) scheduleMock(); else ease.t = 0;
}

let readoutX = null;                 // where the reader is pointing (client x), kept through redraws
// The values sit in a strip above the chart, never on top of the lines: the day under the pointer,
// or the last day shown when nothing is pointed at.
const KEY_CLS = { other: 'others' };
const SHORT = { btc: 'Bitcoin', sp500: 'S&P 500' };
let valuesSig = '';
function fillValues(k, pointed) {
  const L = geo.L;
  const sig = [k, base, pointed, ...L.map(l => l.key)].join('|');
  if (sig === valuesSig) return;
  valuesSig = sig;
  $('#mock-readout').innerHTML = `<span class="mv-date">${when(P.t0 + k * DAY)}${pointed ? '' : '<small>end of period</small>'}</span>` +
    L.map(l => `<span><i class="k-${KEY_CLS[l.cls] || l.cls}"></i>${SHORT[l.cls] || l.label}<b>${fmtUsd(100000 * l.arr[k] / l.arr[base])}</b></span>`).join('');
}
function hideReadout() {
  readoutX = null;
  if (!geo || !geo.L) return;
  geo.cross.setAttribute('opacity', 0);
  fillValues(win().r1, false);
}
function showReadout(clientX) {
  if (!geo || !geo.sx) return;
  const box = $('#mock-chart'), r = box.getBoundingClientRect(), { w, m, cross, sx } = geo;
  const x = (clientX - r.left) * (w / r.width);
  if (x < m.l || x > w - m.r) { hideReadout(); return; }
  readoutX = clientX;
  const { r0, r1 } = win();
  const k = Math.max(r0, Math.min(r1, Math.round(sx.inv(x))));
  cross.setAttribute('x1', sx(k)); cross.setAttribute('x2', sx(k)); cross.setAttribute('opacity', 0.6);
  fillValues(k, true);
}

function zoomAround(factor, frac = 0.5) {
  const span = v1 - v0, ns = Math.max(MIN_SPAN, Math.min(P.n - 1, span * factor));
  const center = v0 + span * frac;
  setView(center - ns * frac, center - ns * frac + ns);
}

/* Gestures. Phone: drag sideways to move in time (with a flick it keeps gliding), pinch to zoom,
   hold a finger still to read values; up-and-down drags still scroll the page.
   Computer: drag, or swipe sideways with two fingers on a trackpad; pinch the trackpad or Ctrl/⌘ + scroll to zoom. */
function bindChart() {
  const box = $('#mock-chart');
  const plotW = () => { const r = box.getBoundingClientRect(), { w, m } = geo; return (w - m.l - m.r) * r.width / w; };   // in CSS px
  const fracAt = clientX => { const r = box.getBoundingClientRect(), { w, m } = geo; return ((clientX - r.left) * (w / r.width) - m.l) / (w - m.l - m.r); };
  const daysPerPx = () => (v1 - v0) / plotW();
  const panBy = px => setView(v0 - px * daysPerPx(), v1 - px * daysPerPx());

  // glide after a flick: velocity in CSS px per ms, slowing down every frame
  let glideRaf = 0;
  const stopGlide = () => { cancelAnimationFrame(glideRaf); glideRaf = 0; };
  function glide(vel) {
    stopGlide();
    if (Math.abs(vel) < 0.15 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let t = performance.now();
    const step = now => {
      const dt = Math.min(32, now - t); t = now;
      const before = v0;
      panBy(vel * dt);
      vel *= Math.pow(0.994, dt);
      if (Math.abs(vel) > 0.02 && v0 !== before) glideRaf = requestAnimationFrame(step); else glideRaf = 0;
    };
    glideRaf = requestAnimationFrame(step);
  }
  // recent positions, to measure how fast the finger or mouse was moving when it let go
  let trail = [];
  const track = x => { const now = performance.now(); trail.push([now, x]); while (trail.length > 2 && now - trail[0][0] > 100) trail.shift(); };
  const releaseSpeed = () => {
    if (trail.length < 2) return 0;
    const [ta, xa] = trail[0], [tb, xb] = trail[trail.length - 1];
    return performance.now() - tb > 60 || tb === ta ? 0 : (xb - xa) / (tb - ta);
  };

  /* ---- touch: Touch Events, so one-finger vertical drags can be handed back to the page ---- */
  let t = null;        // { mode: 'wait' | 'pan' | 'inspect' | 'scroll' | 'pinch', ... }
  let holdTimer = 0;
  const pt = (list, id) => [...list].find(x => x.identifier === id);
  function startOne(touch) {
    t = { mode: 'wait', id: touch.identifier, x: touch.clientX, y: touch.clientY, lastX: touch.clientX };
    trail = []; track(touch.clientX);
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { if (t && t.mode === 'wait') { t.mode = 'inspect'; showReadout(t.lastX); } }, 280);
  }
  function startPinch(a, b) {
    clearTimeout(holdTimer);
    hideReadout();
    const mid = (a.clientX + b.clientX) / 2;
    t = { mode: 'pinch', ids: [a.identifier, b.identifier], d: Math.max(20, Math.abs(a.clientX - b.clientX)),
          span: v1 - v0, at: v0 + (v1 - v0) * fracAt(mid) };      // the day under the fingers stays under the fingers
  }
  box.addEventListener('touchstart', e => {
    if (!geo) return;
    stopGlide();
    if (e.touches.length >= 2) { e.preventDefault(); startPinch(e.touches[0], e.touches[1]); return; }
    if (readoutX != null) hideReadout();
    startOne(e.touches[0]);
  }, { passive: false });
  box.addEventListener('touchmove', e => {
    if (!t || !geo) return;
    if (t.mode === 'pinch') {
      const a = pt(e.touches, t.ids[0]), b = pt(e.touches, t.ids[1]);
      if (!a || !b) return;
      e.preventDefault();
      const span = t.span * t.d / Math.max(20, Math.abs(a.clientX - b.clientX));
      const s = Math.max(MIN_SPAN, Math.min(P.n - 1, span));
      const f = fracAt((a.clientX + b.clientX) / 2);
      setView(t.at - f * s, t.at - f * s + s);
      return;
    }
    const p = pt(e.touches, t.id);
    if (!p || t.mode === 'scroll') return;
    const dx = p.clientX - t.x, dy = p.clientY - t.y;
    if (t.mode === 'wait') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      clearTimeout(holdTimer);
      t.mode = Math.abs(dx) > Math.abs(dy) ? 'pan' : 'scroll';
      if (t.mode === 'scroll') return;          // the page scrolls as usual
      t.lastX = t.x;                            // the day you touched stays under your finger
    }
    e.preventDefault();
    if (t.mode === 'inspect') { t.lastX = p.clientX; showReadout(p.clientX); return; }
    panBy(p.clientX - t.lastX); t.lastX = p.clientX; track(p.clientX);
  }, { passive: false });
  const touchEnd = e => {
    if (!t) return;
    clearTimeout(holdTimer);
    if (t.mode === 'pinch') {
      // one finger lifted: carry on panning with the other one
      if (e.touches.length === 1) { startOne(e.touches[0]); t.mode = 'pan'; } else t = null;
      return;
    }
    if (pt(e.touches, t.id)) return;            // a different finger lifted
    if (t.mode === 'pan' && e.type === 'touchend') glide(releaseSpeed());
    else if (t.mode === 'wait' && e.type === 'touchend') showReadout(t.x);   // a tap shows the values there
    t = null;
  };
  box.addEventListener('touchend', touchEnd);
  box.addEventListener('touchcancel', touchEnd);
  // tapping anywhere else puts the readout away
  document.addEventListener('touchstart', e => { if (readoutX != null && !box.contains(e.target)) hideReadout(); }, { passive: true });

  /* ---- mouse and pen ---- */
  let drag = null;
  box.addEventListener('pointerdown', e => {
    if (!geo || e.pointerType === 'touch' || e.button > 0) return;
    stopGlide();
    drag = { lastX: e.clientX, moved: false };
    trail = []; track(e.clientX);
    try { box.setPointerCapture(e.pointerId); } catch (err) {}
  });
  box.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || !geo) return;
    if (drag) {
      if (!drag.moved && Math.abs(e.clientX - drag.lastX) > 3) { drag.moved = true; box.classList.add('is-dragging'); }
      if (drag.moved) { panBy(e.clientX - drag.lastX); drag.lastX = e.clientX; track(e.clientX); }
    }
    showReadout(e.clientX);
  });
  const end = e => {
    if (!drag) return;
    if (drag.moved && e.type === 'pointerup') glide(releaseSpeed());
    drag = null; box.classList.remove('is-dragging');
  };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  box.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') hideReadout(); });
  box.addEventListener('dblclick', () => { stopGlide(); setView(base, P.n - 1); });

  /* ---- trackpad and mouse wheel ---- */
  // A trackpad pinch arrives as a wheel event with ctrlKey set (Chrome, Firefox, Edge); Safari sends gesture events instead.
  // Each scroll gesture keeps the direction it started with, so scrolling the page past the chart never nudges it sideways.
  let axis = null, axisTimer = 0;
  box.addEventListener('wheel', e => {
    if (!geo) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dx = e.deltaX * unit, dy = e.deltaY * unit;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault(); stopGlide();
      zoomAround(Math.exp(Math.max(-50, Math.min(50, dy)) * 0.012), Math.max(0, Math.min(1, fracAt(e.clientX))));
      return;
    }
    if (!axis) axis = e.shiftKey || Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    clearTimeout(axisTimer); axisTimer = setTimeout(() => (axis = null), 160);
    if (axis === 'y') return;                   // up and down scrolls the page
    e.preventDefault(); stopGlide();
    panBy(-(dx || dy));
  }, { passive: false });
  let gs = null;
  box.addEventListener('gesturestart', e => {
    e.preventDefault();                         // also stops Safari zooming the whole page
    if (t || !geo) return;                      // on a phone the touch handlers already do the pinch
    gs = { span: v1 - v0, frac: Math.max(0, Math.min(1, fracAt(e.clientX))) };
    gs.at = v0 + gs.span * gs.frac;
  });
  box.addEventListener('gesturechange', e => {
    e.preventDefault();
    if (!gs) return;
    const s = Math.max(MIN_SPAN, Math.min(P.n - 1, gs.span / e.scale));
    setView(gs.at - gs.frac * s, gs.at - gs.frac * s + s);
  });
  box.addEventListener('gestureend', e => { e.preventDefault(); gs = null; });

  box.addEventListener('keydown', e => {
    const span = v1 - v0, step = Math.max(1, span * 0.1);
    if (e.key === 'ArrowLeft') { e.preventDefault(); setView(v0 - step, v1 - step); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setView(v0 + step, v1 + step); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAround(0.7); }
    else if (e.key === '-') { e.preventDefault(); zoomAround(1 / 0.7); }
    else if (e.key === '0' || e.key === 'Home') { e.preventDefault(); setView(base, P.n - 1); }
  });
  // buttons zoom smoothly instead of jumping
  const animateTo = (a, b) => {
    stopGlide();
    const fa = v0, fb = v1, t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
    const step = now => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - (1 - k) ** 3;
      setView(fa + (a - fa) * e, fb + (b - fb) * e);
      if (k < 1) glideRaf = requestAnimationFrame(step);
    };
    glideRaf = requestAnimationFrame(step);
  };
  const zoomTo = f => {
    const span = v1 - v0, ns = Math.max(MIN_SPAN, Math.min(P.n - 1, span * f)), c = v0 + span / 2;
    animateTo(c - ns / 2, c + ns / 2);
  };
  $('#z-in').addEventListener('click', () => zoomTo(0.6));
  $('#z-out').addEventListener('click', () => zoomTo(1 / 0.6));
  $('#z-reset').addEventListener('click', () => animateTo(base, P.n - 1));
}

/* overview strip: the whole history, with the shown period as a draggable window */
function navChart(w) {
  if (!P) return;
  const box = $('#mock-nav');
  const H = 64, m = { l: 0, r: 0, t: 6, b: 6 };
  // the two lines are drawn once; moving the window only moves the shading and the frame
  if (!navGeo || navGeo.w !== w || navGeo.sel !== sel) {
    const g = svg(box, w, H);
    g.setAttribute('aria-hidden', 'true');
    const sx = linear([0, P.n - 1], [m.l, w - m.r]);
    const draw = (arr, cls) => {
      let lo = Infinity, hi = -Infinity;
      for (const v of arr) { if (v < lo) lo = v; if (v > hi) hi = v; }
      const sy = log([lo, hi], [H - m.b, m.t]);
      el('path', { d: thinPath(sx, sy, arr, 1, 0, P.n - 1), fill: 'none', class: cls }, g);
    };
    draw(P.series.btc, 'nav-btc');
    draw(P.profiles[sel].eq, 'nav-acc');
    navGeo = { w, sel, sx,
      left: el('rect', { x: 0, y: 0, height: H, class: 'nav-shade' }, g),
      right: el('rect', { y: 0, height: H, class: 'nav-shade' }, g),
      win: el('rect', { y: 1, height: H - 2, class: 'nav-win' }, g),
      h0: el('rect', { y: H / 2 - 14, width: 8, height: 28, class: 'nav-handle' }, g),
      h1: el('rect', { y: H / 2 - 14, width: 8, height: 28, class: 'nav-handle' }, g),
      start: el('rect', { y: 0, width: 2, height: H, class: 'nav-start' }, g) };
  }
  const { sx } = navGeo, x0 = sx(v0), x1 = sx(v1);
  navGeo.left.setAttribute('width', x0);
  navGeo.right.setAttribute('x', x1); navGeo.right.setAttribute('width', Math.max(0, w - x1));
  navGeo.win.setAttribute('x', x0); navGeo.win.setAttribute('width', Math.max(2, x1 - x0));
  navGeo.h0.setAttribute('x', x0 - 4); navGeo.h1.setAttribute('x', x1 - 4);
  navGeo.start.setAttribute('x', sx(base) - 1);
}
function bindNav() {
  const box = $('#mock-nav');
  let drag = null;
  const toIdx = clientX => { const r = box.getBoundingClientRect(); return (clientX - r.left) / r.width * (P.n - 1); };
  box.addEventListener('pointerdown', e => {
    const r = box.getBoundingClientRect(), x = (e.clientX - r.left) * (navGeo.w / r.width);
    const x0 = navGeo.sx(v0), x1 = navGeo.sx(v1), i = toIdx(e.clientX);
    const mode = Math.abs(x - x0) < 12 ? 'left' : Math.abs(x - x1) < 12 ? 'right' : (x > x0 && x < x1) ? 'move' : 'jump';
    if (mode === 'jump') { const span = v1 - v0; setView(i - span / 2, i + span / 2); }
    drag = { mode: mode === 'jump' ? 'move' : mode, i, a: mode === 'jump' ? Math.round(i - (v1 - v0) / 2) : v0, b: mode === 'jump' ? Math.round(i + (v1 - v0) / 2) : v1 };
    try { box.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  box.addEventListener('pointermove', e => {
    if (!drag) return;
    const d = toIdx(e.clientX) - drag.i;
    if (drag.mode === 'move') setView(drag.a + d, drag.b + d);
    else if (drag.mode === 'left') setView(Math.min(drag.a + d, drag.b - MIN_SPAN), drag.b);
    else setView(drag.a, Math.max(drag.b + d, drag.a + MIN_SPAN));
  });
  const end = () => (drag = null);
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
}

async function init() {
  chrome();
  P = await load('profiles');
  $('#asof').textContent = when(P.last);
  $('#asof-price').textContent = fmtUsd(P.price);
  liveWidget($('#live-widget'), P.price, P.last);
  const from = new URLSearchParams(location.search).get('s');
  let saved = null; try { saved = localStorage.getItem('btclab-profile'); } catch (e) {}
  sel = KEYS.includes(from) ? from : KEYS.includes(saved) ? saved : 'balanced';
  $$('[data-p]').forEach(b => b.addEventListener('click', () => keepPlace(() => setProfile(b.dataset.p))));
  $('#amount').addEventListener('input', renderAmount);
  $('#amount').addEventListener('blur', () => { const v = amountValue(); if (v) $('#amount').value = Math.round(v).toLocaleString('en-US'); });
  const fr = $('#from'), to = $('#to');
  for (const x of [fr, to]) { x.min = iso(0); x.max = iso(P.n - 1); }
  fr.addEventListener('change', () => fr.value && setStart(idxOf(fr.value), Math.max(v1, idxOf(fr.value) + MIN_SPAN)));
  to.addEventListener('change', () => to.value && setView(Math.min(v0, idxOf(to.value) - MIN_SPAN), idxOf(to.value)));
  $$('#quick button').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.ago ? P.n - 1 - +b.dataset.ago : b.dataset.from === 'start' ? 0 : idxOf(b.dataset.from);
    const z = b.dataset.to === 'end' ? P.n - 1 : idxOf(b.dataset.to);
    setStart(a, z);
  }));
  $('#logscale').addEventListener('change', () => drawMock());
  bindChart(); bindNav();
  renderCards();
  drawMock = responsive($('#mock-chart'), mockChart);
  drawLive = responsive($('#live-chart'), liveChart);
  drawNav = responsive($('#mock-nav'), navChart);
  base = 0; v0 = 0; v1 = P.n - 1; $('#from').value = iso(v0); $('#to').value = iso(v1);
  setProfile(sel, false);
}

init().catch(e => { console.error(e); $('#act').textContent = '–'; $('#act-sub').textContent = 'The data could not be loaded. ' + e.message; });
