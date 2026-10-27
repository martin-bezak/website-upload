/* Canvas drawing of a Sell the top chart. Log price scale (so a coin that goes 10× stays readable),
   % change from day one on the right axis. The line is orange while you are invested and cream while
   you sit in cash, so the chart itself shows your decisions. The y range follows the visible prices
   smoothly (no jumps when a new high appears). */

import { days, price } from './round.js';

const AXIS = 52;          // px for the % labels on the right
const PAD_T = 20, PAD_B = 20;
const LEAD_SHARE = 0.16;   // part of the width for the grey lead-in
const LEVELS = [-95, -90, -80, -70, -60, -50, -40, -30, -20, -10, 0, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 1000, 2000, 5000, 10000];

export class ChartView {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.lo = null; this.hi = null;
    this.layout();
  }

  layout() {
    const dpr = window.devicePixelRatio || 1;
    this.w = this.cv.clientWidth; this.h = this.cv.clientHeight;
    this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  colors() {
    const css = getComputedStyle(this.cv);
    const v = n => css.getPropertyValue(n).trim();
    return { text: v('--est-text'), hot: v('--est-hot'), muted: v('--est-muted'), line: v('--est-line'), bg: v('--est-bg') };
  }

  /** Target y range (log) for everything visible up to played day `upto`. */
  target(chart, upto) {
    let lo = Infinity, hi = -Infinity;
    const end = chart.lead + Math.max(0, Math.floor(upto));
    for (let i = 0; i <= end; i++) { lo = Math.min(lo, chart.p[i]); hi = Math.max(hi, chart.p[i]); }
    const span = Math.max(Math.log(hi / lo), 0.12);
    const mid = (Math.log(hi) + Math.log(lo)) / 2;
    return [mid - span * 0.62, mid + span * 0.62];
  }

  /**
   * opts: { chart, f (played days, fractional; -1 = not started), trades, reveal (bool), snap (bool), labels }
   */
  draw({ chart, f, trades, reveal = false, snap = false, labels }) {
    const { ctx, w, h } = this;
    const col = this.colors();
    const N = chart.p.length, n = days(chart);
    const upto = reveal ? n - 1 : Math.max(0, f);
    const [tlo, thi] = this.target(chart, upto);
    if (this.lo === null || snap) { this.lo = tlo; this.hi = thi; }
    else {
      this.lo += (tlo - this.lo) * 0.15; this.hi += (thi - this.hi) * 0.15;
      // a new high or low is always on screen at once; only shrinking the range is smooth
      const pad = (thi - tlo) * 0.06;
      this.hi = Math.max(this.hi, thi - pad); this.lo = Math.min(this.lo, tlo + pad);
    }
    const plotW = w - AXIS;
    const leadW = plotW * LEAD_SHARE;            // the lead-in gets a fixed share, whatever the number of bars
    const X = i => (i <= chart.lead ? (i / chart.lead) * leadW : leadW + ((i - chart.lead) / (N - 1 - chart.lead)) * (plotW - leadW));
    const Y = v => PAD_T + (this.hi - Math.log(v)) / (this.hi - this.lo) * (h - PAD_T - PAD_B);

    ctx.clearRect(0, 0, w, h);

    // % grid on the right
    ctx.font = '12px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    let lastY = -Infinity;
    for (const L of LEVELS) {
      const y = Y(100 + L);
      if (y < PAD_T - 4 || y > h - PAD_B + 4 || Math.abs(y - lastY) < 30) continue;
      lastY = y;
      ctx.strokeStyle = col.line; ctx.lineWidth = 1;
      ctx.setLineDash(L === 0 ? [4, 4] : []);
      ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(plotW, Math.round(y) + 0.5); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col.muted;
      ctx.fillText((L > 0 ? '+' : L < 0 ? '−' : '') + Math.abs(L) + '%', plotW + 8, y);
    }

    // start line
    const xs = X(chart.lead);
    ctx.strokeStyle = col.muted; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(xs) + 0.5, PAD_T - 12); ctx.lineTo(Math.round(xs) + 0.5, h); ctx.stroke();
    ctx.fillStyle = col.muted; ctx.textBaseline = 'top';
    ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText(labels.start.toUpperCase(), xs + 6, 2);

    // lead-in
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = col.muted; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= chart.lead; i++) i ? ctx.lineTo(X(i), Y(chart.p[i])) : ctx.moveTo(X(i), Y(chart.p[i]));
    ctx.stroke();
    if (f < 0 && !reveal) return;

    // played part, coloured by position
    const last = Math.floor(upto), frac = upto - last;
    const pointAt = d => {
      if (d <= last) return [X(chart.lead + d), Y(price(chart, d))];
      return null;
    };
    let invested = true, k = 0;
    ctx.lineWidth = 2.25;
    ctx.beginPath(); ctx.strokeStyle = col.hot;
    ctx.moveTo(...pointAt(0));
    for (let d = 1; d <= last; d++) {
      ctx.lineTo(...pointAt(d));
      while (k < trades.length && trades[k] === d) {
        ctx.stroke(); invested = !invested; k++;
        ctx.beginPath(); ctx.strokeStyle = invested ? col.hot : col.text; ctx.moveTo(...pointAt(d));
      }
    }
    let hx = X(chart.lead + last), hy = Y(price(chart, last));
    if (last < n - 1 && frac > 0) {          // smooth head between two days
      const v = price(chart, last) * Math.pow(price(chart, last + 1) / price(chart, last), frac);
      hx = X(chart.lead + last + frac); hy = Y(v);
      ctx.lineTo(hx, hy);
    }
    ctx.stroke();

    // trade markers
    trades.forEach((d, i) => {
      if (d > last) return;
      const x = X(chart.lead + d), y = Y(price(chart, d));
      const sell = i % 2 === 0;
      ctx.fillStyle = sell ? col.text : col.hot;
      ctx.beginPath();
      if (sell) { ctx.moveTo(x, y - 7); ctx.lineTo(x - 6, y - 17); ctx.lineTo(x + 6, y - 17); }
      else { ctx.moveTo(x, y + 7); ctx.lineTo(x - 6, y + 17); ctx.lineTo(x + 6, y + 17); }
      ctx.fill();
    });

    if (reveal) {                              // the top of the year
      let td = 0;
      for (let d = 1; d < n; d++) if (price(chart, d) > price(chart, td)) td = d;
      const x = X(chart.lead + td), y = Y(price(chart, td));
      ctx.strokeStyle = col.text; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = col.text; ctx.textBaseline = 'bottom';
      ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
      const label = labels.top.toUpperCase();
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, Math.min(Math.max(x - tw / 2, 0), plotW - tw), Math.max(y - 12, 12));
    } else {                                   // live head
      ctx.fillStyle = col.hot;
      ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill();
    }
  }
}
