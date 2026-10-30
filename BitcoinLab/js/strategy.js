// Bitcoin Lab · Strategy page: today's action for the chosen profile, the three profiles, and the mock portfolio.
import { $, $$, load, usd, pc, when, liveWidget, chrome, el, svg, linear, log, ticks, logTicks, path, yGrid, xLabels, yearTicks, responsive } from './lab.js?v=5';

const KEYS = ['growth', 'balanced', 'defensive'];
const NAMES = { growth: 'Growth', balanced: 'Balanced', defensive: 'Defensive' };
const BENCH = [
  ['btc', 'Bitcoin, buy and hold'], ['sp500', 'S&P 500'], ['bonds', 'US 10-year bonds'], ['cash', 'Cash (T-bills)'],
];
let P, sel = 'balanced', show = { btc: true, sp500: true, bonds: true, cash: true, others: false };
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
let v0 = 0, v1 = 0;                  // first and last day shown (indices into the daily series)
let geo = null, navGeo = null;       // last drawn chart geometry, for the pointer handlers
const iso = i => new Date((P.t0 + i * DAY) * 1000).toISOString().slice(0, 10);
const idxOf = d => Math.round((Date.parse(d + 'T00:00:00Z') / 1000 - P.t0) / DAY);

function setView(a, b) {
  let span = Math.max(MIN_SPAN, Math.round(b - a));
  span = Math.min(span, P.n - 1);
  a = Math.round(a);
  a = Math.max(0, Math.min(P.n - 1 - span, a));
  v0 = a; v1 = a + span;
  $('#from').value = iso(v0); $('#to').value = iso(v1);
  scheduleMock();
}
let raf = 0;
function scheduleMock() { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderMock); }

function seriesWin(arr) { const base = arr[v0]; return arr.slice(v0, v1 + 1).map(v => 100000 * v / base); }
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
function lines() {
  const L = [{ key: sel, label: NAMES[sel] + ' strategy', vals: seriesWin(P.profiles[sel].eq), cls: 'acc', main: true }];
  if (show.others) for (const k of KEYS) if (k !== sel) L.push({ key: k, label: NAMES[k] + ' strategy', vals: seriesWin(P.profiles[k].eq), cls: 'other' });
  for (const [k, label] of BENCH) if (show[k] && P.series[k]) L.push({ key: k, label, vals: seriesWin(P.series[k]), cls: k });
  return L;
}
function renderKey() {
  const toggles = [...BENCH.filter(([k]) => P.series[k]), ['others', 'Other two strategies']];
  $('#mock-key').innerHTML = `<span><i class="k-acc"></i> ${NAMES[sel]} strategy</span>` + toggles.map(([k, label]) =>
    `<label class="key-toggle"><input type="checkbox" data-show="${k}" ${show[k] ? 'checked' : ''}> <i class="k-${k}"></i> ${label}</label>`).join('');
  $$('[data-show]').forEach(c => c.addEventListener('change', () => { show[c.dataset.show] = c.checked; scheduleMock(); }));
}
function renderMock() {
  if (!P) return;
  const days = v1 - v0;
  $('#mock-range').innerHTML = `<b>${when(P.t0 + v0 * DAY)}</b> to <b>${when(P.t0 + v1 * DAY)}</b> · ${days >= 730 ? (days / 365.25).toFixed(1) + ' years' : days + ' days'}`;
  const rows = [...KEYS.map(k => ({ label: NAMES[k] + ' strategy', vals: seriesWin(P.profiles[k].eq), cur: k === sel })),
                ...BENCH.filter(([k]) => P.series[k]).map(([k, label]) => ({ label, vals: seriesWin(P.series[k]) }))];
  $('#mock-table').innerHTML = rows.map(r => {
    const m = metrics(r.vals, v0);
    return `<tr class="${r.cur ? 'is-cur' : ''}"><td data-l="Portfolio"><b>${r.label}</b></td><td class="n" data-l="Worth at the end"><span class="big">${fmtUsd(m.end)}</span></td>
      <td class="n" data-l="Return">${pct0(m.ret)}</td><td class="n" data-l="Per year">${m.cagr == null ? '–' : pct1(m.cagr)}</td>
      <td class="n" data-l="Worst drop">${pct0(m.mdd)}</td><td class="n" data-l="Worst calendar year">${pct0(m.worst)}</td></tr>`;
  }).join('');
  drawMock(); drawNav();
}
let drawMock = () => {}, drawNav = () => {};
const short = v => v === 0 ? '$0' : v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M' : '$' + Math.round(v / 1000) + 'k';

function mockChart(w) {
  if (!P) return;
  const L = lines(), box = $('#mock-chart');
  const H = Math.round(Math.max(300, Math.min(520, w * (w < 600 ? 0.9 : 0.5))));
  const g = svg(box, w, H);
  g.setAttribute('aria-label', `Value of $100,000 from ${when(P.t0 + v0 * DAY)} to ${when(P.t0 + v1 * DAY)} in each portfolio`);
  const m = { l: w < 600 ? 52 : 64, r: 12, t: 16, b: 30 };
  const n = v1 - v0 + 1;
  const sx = linear([v0, v1], [m.l, w - m.r]);
  let lo = Infinity, hi = -Infinity;
  for (const l of L) for (const v of l.vals) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const useLog = $('#logscale').checked;
  const sy = useLog ? log([lo * 0.97, hi * 1.03], [H - m.b, m.t]) : linear([Math.min(0, lo), hi * 1.05], [H - m.b, m.t]);
  let tk = useLog ? logTicks(lo * 0.97, hi * 1.03) : ticks(Math.min(0, lo), hi, 5);
  if (useLog && tk.length < 3) tk = ticks(lo, hi, 4).filter(v => v > 0);
  yGrid(g, sy, tk, m.l, w - m.r, short, { zero: 100000 });
  // x labels: years for long windows, months for short ones
  const t0d = P.t0 / DAY;
  let xt;
  if (n > 730) xt = yearTicks(t0d + v0, t0d + v1, w < 600 ? 4 : 8).map(([k, y]) => [k - t0d, String(y)]);
  else {
    const parts = w < 600 ? 3 : 5;
    const fmt = n <= 150 ? s => when(s).replace(/ \d{4}$/, '') : s => when(s).replace(/^\d+ /, '');
    xt = Array.from({ length: parts + 1 }, (_, i) => { const k = v0 + i * (n - 1) / parts; return [k, fmt(P.t0 + Math.round(k) * DAY)]; })
      .filter(([, label], i, a) => i === 0 || label !== a[i - 1][1]);
  }
  const clip = 'mc' + Math.random().toString(36).slice(2);
  el('rect', { x: m.l, y: 0, width: w - m.l - m.r, height: H }, el('clipPath', { id: clip }, el('defs', {}, g)));
  for (const [k, label] of xt) {
    const t = el('text', { x: Math.max(m.l + 14, Math.min(w - m.r - 14, sx(k))), y: H - 8, 'text-anchor': 'middle' }, g);
    t.textContent = label;
  }
  const xs = Array.from({ length: n }, (_, i) => sx(v0 + i));
  const plot = el('g', { 'clip-path': `url(#${clip})` }, g);
  for (const l of [...L].reverse()) el('path', { d: path(xs, l.vals.map(sy)), fill: 'none', class: 'ml ml-' + l.cls, 'stroke-width': l.main ? 3.5 : 2 }, plot);
  // end values for the strategy and Bitcoin, pushed apart when they would overlap
  const ends = L.filter(x => x.main || x.cls === 'btc').map(l => ({ v: l.vals[n - 1], y: sy(l.vals[n - 1]) - 8 })).sort((a, b) => a.y - b.y)
    .filter((e, i, a) => i === 0 || short(e.v) !== short(a[i - 1].v));
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;
  for (const e of ends) {
    const t = el('text', { x: w - m.r, y: Math.max(m.t + 4, e.y), 'text-anchor': 'end', class: 't-strong' }, g);
    t.textContent = short(e.v);
  }
  const cross = el('line', { y1: m.t, y2: H - m.b, stroke: 'var(--c-main)', 'stroke-width': 1, opacity: 0, class: 'cross' }, g);
  geo = { w, H, m, n, xs, L, cross, sx };
}

function showReadout(clientX) {
  if (!geo) return;
  const box = $('#mock-chart'), r = box.getBoundingClientRect(), { w, m, n, xs, L, cross } = geo;
  const x = (clientX - r.left) * (w / r.width);
  const ro = $('#mock-readout');
  if (x < m.l || x > w - m.r) { ro.hidden = true; cross.setAttribute('opacity', 0); return; }
  const i = Math.max(0, Math.min(n - 1, Math.round((x - m.l) / (w - m.l - m.r) * (n - 1))));
  cross.setAttribute('x1', xs[i]); cross.setAttribute('x2', xs[i]); cross.setAttribute('opacity', 0.6);
  ro.hidden = false;
  ro.style.left = Math.max(110, Math.min(r.width - 110, xs[i] * r.width / w)) + 'px';
  ro.innerHTML = `${when(P.t0 + (v0 + i) * DAY)}<br>` + L.map(l => `${l.label}: <b>${fmtUsd(l.vals[i])}</b>`).join('<br>');
}

function zoomAround(factor, frac = 0.5) {
  const span = v1 - v0, ns = Math.max(MIN_SPAN, Math.min(P.n - 1, span * factor));
  const center = v0 + span * frac;
  setView(center - ns * frac, center - ns * frac + ns);
}

function bindChart() {
  const box = $('#mock-chart');
  let drag = null;
  box.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey) || !geo) return;           // plain scrolling keeps scrolling the page
    e.preventDefault();
    const r = box.getBoundingClientRect(), { w, m } = geo;
    const frac = Math.max(0, Math.min(1, ((e.clientX - r.left) * (w / r.width) - m.l) / (w - m.l - m.r)));
    zoomAround(Math.exp(e.deltaY * 0.01), frac);
  }, { passive: false });
  // two fingers on a phone: pinch to zoom around the point between them
  const touches = new Map();
  let pinch = null;
  box.addEventListener('pointerdown', e => {
    if (!geo || e.button > 0) return;
    if (e.pointerType === 'touch') touches.set(e.pointerId, e.clientX);
    if (touches.size === 2) {
      const [x1, x2] = [...touches.values()], r = box.getBoundingClientRect(), { w, m } = geo;
      const mid = ((x1 + x2) / 2 - r.left) * (w / r.width);
      pinch = { d: Math.abs(x2 - x1) || 1, a: v0, b: v1, frac: Math.max(0, Math.min(1, (mid - m.l) / (w - m.l - m.r))) };
      drag = null;
      return;
    }
    drag = { x: e.clientX, a: v0, b: v1, moved: false };
    try { box.setPointerCapture(e.pointerId); } catch (err) {}
  });
  box.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, e.clientX);
    if (pinch && touches.size === 2) {
      const [x1, x2] = [...touches.values()];
      const span = (pinch.b - pinch.a) * pinch.d / (Math.abs(x2 - x1) || 1);
      const center = pinch.a + (pinch.b - pinch.a) * pinch.frac;
      setView(center - span * pinch.frac, center - span * pinch.frac + span);
      return;
    }
    if (drag) {
      const r = box.getBoundingClientRect(), { w, m } = geo;
      const dx = (e.clientX - drag.x) * (w / r.width);
      if (Math.abs(dx) > 3) drag.moved = true;
      const shift = -dx / (w - m.l - m.r) * (drag.b - drag.a);
      if (drag.moved) { setView(drag.a + shift, drag.b + shift); box.classList.add('is-dragging'); }
    }
    showReadout(e.clientX);
  });
  const end = e => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; drag = null; box.classList.remove('is-dragging'); };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  box.addEventListener('pointerleave', () => { $('#mock-readout').hidden = true; if (geo) geo.cross.setAttribute('opacity', 0); });
  box.addEventListener('dblclick', () => setView(0, P.n - 1));
  box.addEventListener('keydown', e => {
    const span = v1 - v0, step = Math.max(1, Math.round(span * 0.1));
    if (e.key === 'ArrowLeft') { e.preventDefault(); setView(v0 - step, v1 - step); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setView(v0 + step, v1 + step); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAround(0.7); }
    else if (e.key === '-') { e.preventDefault(); zoomAround(1 / 0.7); }
    else if (e.key === '0' || e.key === 'Home') { e.preventDefault(); setView(0, P.n - 1); }
  });
  $('#z-in').addEventListener('click', () => zoomAround(0.6));
  $('#z-out').addEventListener('click', () => zoomAround(1 / 0.6));
  $('#z-reset').addEventListener('click', () => setView(0, P.n - 1));
}

/* overview strip: the whole history, with the shown period as a draggable window */
function navChart(w) {
  if (!P) return;
  const box = $('#mock-nav');
  const H = 64, m = { l: 0, r: 0, t: 6, b: 6 };
  const g = svg(box, w, H);
  g.setAttribute('aria-hidden', 'true');
  const sx = linear([0, P.n - 1], [m.l, w - m.r]);
  const xs = Array.from({ length: P.n }, (_, i) => sx(i));
  const draw = (arr, cls) => {
    let lo = Infinity, hi = -Infinity;
    for (const v of arr) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const sy = log([lo, hi], [H - m.b, m.t]);
    el('path', { d: path(xs, arr.map(sy)), fill: 'none', class: cls }, g);
  };
  draw(P.series.btc, 'nav-btc');
  draw(P.profiles[sel].eq, 'nav-acc');
  const x0 = sx(v0), x1 = sx(v1);
  el('rect', { x: 0, y: 0, width: x0, height: H, class: 'nav-shade' }, g);
  el('rect', { x: x1, y: 0, width: w - x1, height: H, class: 'nav-shade' }, g);
  el('rect', { x: x0, y: 1, width: Math.max(2, x1 - x0), height: H - 2, class: 'nav-win' }, g);
  for (const x of [x0, x1]) el('rect', { x: x - 4, y: H / 2 - 14, width: 8, height: 28, class: 'nav-handle' }, g);
  navGeo = { w, sx };
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
  fr.addEventListener('change', () => fr.value && setView(idxOf(fr.value), Math.max(v1, idxOf(fr.value) + MIN_SPAN)));
  to.addEventListener('change', () => to.value && setView(Math.min(v0, idxOf(to.value) - MIN_SPAN), idxOf(to.value)));
  $$('#quick button').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.ago ? P.n - 1 - +b.dataset.ago : b.dataset.from === 'start' ? 0 : idxOf(b.dataset.from);
    const z = b.dataset.to === 'end' ? P.n - 1 : idxOf(b.dataset.to);
    setView(a, z);
  }));
  $('#logscale').addEventListener('change', () => drawMock());
  bindChart(); bindNav();
  renderCards();
  drawMock = responsive($('#mock-chart'), mockChart);
  drawLive = responsive($('#live-chart'), liveChart);
  drawNav = responsive($('#mock-nav'), navChart);
  v0 = 0; v1 = P.n - 1; $('#from').value = iso(v0); $('#to').value = iso(v1);
  setProfile(sel, false);
}

init().catch(e => { console.error(e); $('#act').textContent = '–'; $('#act-sub').textContent = 'The data could not be loaded. ' + e.message; });
