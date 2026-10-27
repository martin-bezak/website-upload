/* Chart rendering and touch/mouse drawing on a <canvas>.

   Units: prices are the exported, normalised values (breakout close = 100), so "% from the breakout"
   is simply price - 100. The y-axis is labelled in those percentages.

   Fairness: before the reveal the vertical scale is symmetric around the breakout close, so the empty
   space above and below the line can't hint at the answer. On the reveal it widens to fit everything.

   Drawing: the future zone has HORIZON columns. A stroke writes a value into every column it passes,
   interpolating between pointer events, so fast strokes leave no holes and the result is always one
   y per column (the line can only move forward in time). Strokes can go back over earlier columns,
   which simply overwrites them. */

export const HORIZON = 30;

export function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export class ChartView {
  constructor(canvas, chart, { maxHistory = 160 } = {}) {
    this.cv = canvas;
    this.c = chart;
    this.b = chart.b;
    this.offset = Math.max(0, chart.b + 1 - maxHistory);   // trim old history on narrow screens
    this.hist = chart.candles.slice(this.offset, chart.b + 1);
    this.future = chart.candles.slice(chart.b + 1, chart.b + 1 + HORIZON);
    this.cols = this.hist.length + HORIZON;
    this.revealed = false;
    this.layout();
  }

  // ---------------------------------------------------------------- geometry
  layout() {
    const box = this.cv.parentElement.getBoundingClientRect();
    const w = Math.max(280, Math.floor(box.width));
    const h = Math.round(Math.min(560, Math.max(300, w * (w < 600 ? 0.95 : 0.58))));
    const dpr = window.devicePixelRatio || 1;
    this.cv.width = w * dpr; this.cv.height = h * dpr;
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.W = w; this.H = h; this.dpr = dpr;
    this.pad = { l: 4, r: w < 600 ? 44 : 56, t: 14, b: 8 };
    this.volH = Math.round(h * 0.13);
    this.plotH = h - this.pad.t - this.pad.b - this.volH - 8;
    this.colW = (w - this.pad.l - this.pad.r) / this.cols;
    this.zoneX0 = this.pad.l + this.hist.length * this.colW;   // left edge of the future zone
    this.scale(false);
  }

  /** Vertical range. Before the reveal: symmetric around 100. After: also fits the real future,
      the target, the invalidation level and every drawn line. */
  scale(includeFuture, extra = []) {
    let lo = Infinity, hi = -Infinity;
    for (const k of this.hist) { lo = Math.min(lo, k[2]); hi = Math.max(hi, k[1]); }
    const ext = Math.max(hi - 100, 100 - lo, 4 * this.c.atr) * 1.15;
    lo = Math.min(lo, 100 - ext); hi = Math.max(hi, 100 + ext);
    if (includeFuture) {
      for (const k of this.future) { lo = Math.min(lo, k[2]); hi = Math.max(hi, k[1]); }
      for (const p of [this.c.target, this.c.invalid, ...extra]) if (Number.isFinite(p)) { lo = Math.min(lo, p); hi = Math.max(hi, p); }
      const m = (hi - lo) * 0.04; lo -= m; hi += m;
    }
    this.lo = lo; this.hi = hi;
  }

  X(col) { return this.pad.l + (col + 0.5) * this.colW; }
  Y(p) { return this.pad.t + (this.hi - p) / (this.hi - this.lo) * this.plotH; }
  P(y) { return this.hi - (y - this.pad.t) / this.plotH * (this.hi - this.lo); }   // y pixel -> price
  /** Future column (0..HORIZON-1) under an x pixel, or -1 if left of the zone. */
  col(x) {
    if (x < this.zoneX0 - this.colW) return -1;
    return Math.max(0, Math.min(HORIZON - 1, Math.floor((x - this.zoneX0) / this.colW)));
  }

  // ---------------------------------------------------------------- drawing
  draw(o = {}) {
    const g = this.cv.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const { W, H, pad } = this;
    const col = {
      bg: css('--est-bg'), text: css('--est-text'), muted: css('--est-muted'), line: css('--est-line'),
      hot: css('--est-hot'), up: css('--cg-up'), down: css('--cg-down'), ann: css('--cg-ann')
    };
    g.fillStyle = col.bg; g.fillRect(0, 0, W, H);

    // grid in % from the breakout close
    g.font = '11px "JetBrains Mono", ui-monospace, monospace';
    g.textBaseline = 'middle';
    const step = niceStep((this.hi - this.lo) / 6);
    for (let p = Math.ceil((this.lo - 100) / step) * step; p <= this.hi - 100; p += step) {
      const y = this.Y(100 + p);
      g.strokeStyle = col.line; g.lineWidth = 1; g.globalAlpha = Math.abs(p) < 1e-9 ? 1 : 0.6;
      g.beginPath(); g.moveTo(pad.l, y); g.lineTo(W - pad.r, y); g.stroke();
      g.globalAlpha = 1; g.fillStyle = Math.abs(p) < 1e-9 ? col.text : col.muted;
      g.fillText(o.fmt ? o.fmt(p) : p.toFixed(0) + '%', W - pad.r + 6, y);
    }

    // the future zone
    g.fillStyle = col.line; g.globalAlpha = 0.35;
    g.fillRect(this.zoneX0, pad.t, W - pad.r - this.zoneX0, this.plotH);
    g.globalAlpha = 1;

    // volume (history; future only when revealed)
    const vols = this.hist.concat(o.reveal ? this.future : []).map(k => k[4]);
    const vmax = Math.max(1e-9, ...vols);
    const vy = H - pad.b;
    this.hist.forEach((k, i) => this.volBar(g, i, k, vmax, vy, col, 0.5));
    if (o.reveal) this.future.forEach((k, j) => this.volBar(g, this.hist.length + j, k, vmax, vy, col, 0.5 * o.reveal));

    // candles
    this.hist.forEach((k, i) => this.candle(g, i, k, col, 1));
    if (o.reveal) this.future.forEach((k, j) => this.candle(g, this.hist.length + j, k, col, o.reveal));

    // pattern annotation (Learn mode before the reveal, everyone after)
    if (o.annotation) this.annotate(g, col, o.annotation);

    // textbook hint (faint) / textbook projection + invalidation (reveal)
    if (o.hint) this.textbook(g, col, 0.35, false);
    if (o.reveal) {
      g.globalAlpha = o.reveal;
      this.hline(g, this.c.invalid, col.down, [4, 4]);
      this.textbook(g, col, 1, true);
      g.globalAlpha = 1;
    }

    // the player's line
    if (o.guess) this.path(g, o.guess, col.hot, 3);

    // before the first stroke: outline the zone, put a dot on the last close and write where to draw
    if (o.prompt) {
      const x0 = this.zoneX0, x1 = W - pad.r, y = this.Y(100);
      g.strokeStyle = col.hot; g.lineWidth = 1.5; g.setLineDash([6, 5]);
      g.strokeRect(x0 + 0.75, pad.t + 0.75, x1 - x0 - 1.5, this.plotH - 1.5);
      g.setLineDash([]);
      g.fillStyle = col.hot;
      g.beginPath(); g.arc(this.X(this.hist.length - 1), y, 5, 0, Math.PI * 2); g.fill();
      g.font = '600 13px "JetBrains Mono", ui-monospace, monospace';
      g.textAlign = 'center';
      const lines = o.prompt.split('\n'), mid = (x0 + x1) / 2, top = pad.t + 22;
      lines.forEach((ln, i) => g.fillText(ln, mid, top + i * 18));
      g.textAlign = 'left';
    }

    // labels on the right end of each line after the reveal
    if (o.reveal && o.labels) {
      g.globalAlpha = o.reveal;
      const end = this.X(this.cols - 1);
      for (const [p, text, c] of o.labels) { g.fillStyle = c === 'hot' ? col.hot : c === 'text' ? col.text : col.muted; g.fillText(text, Math.max(pad.l, end - g.measureText(text).width - 4), this.Y(p) - 9); }
      g.globalAlpha = 1;
    }
  }

  volBar(g, i, k, vmax, vy, col, alpha) {
    const hgt = Math.max(1, k[4] / vmax * this.volH);
    g.globalAlpha = alpha; g.fillStyle = k[3] >= k[0] ? col.up : col.down;
    g.fillRect(this.X(i) - this.colW * 0.35, vy - hgt, Math.max(1, this.colW * 0.7), hgt);
    g.globalAlpha = 1;
  }

  candle(g, i, k, col, alpha) {
    const [o, h, l, c] = k, x = this.X(i), w = Math.max(1, this.colW * 0.7);
    g.globalAlpha = alpha;
    g.strokeStyle = g.fillStyle = c >= o ? col.up : col.down;
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, this.Y(h)); g.lineTo(x, this.Y(l)); g.stroke();
    const y1 = this.Y(Math.max(o, c)), y2 = this.Y(Math.min(o, c));
    g.fillRect(x - w / 2, y1, w, Math.max(1, y2 - y1));
    g.globalAlpha = 1;
  }

  annotate(g, col, alpha) {
    g.globalAlpha = alpha;
    g.strokeStyle = g.fillStyle = col.ann; g.lineWidth = 1.5;
    for (const [, i1, p1, i2, p2] of this.c.lines) {
      g.beginPath(); g.moveTo(this.X(i1 - this.offset), this.Y(p1)); g.lineTo(this.X(i2 - this.offset), this.Y(p2)); g.stroke();
    }
    for (const [i, p] of this.c.pivots) {
      if (i < this.offset) continue;
      g.beginPath(); g.arc(this.X(i - this.offset), this.Y(p), 3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }

  hline(g, p, color, dash) {
    g.strokeStyle = color; g.lineWidth = 1.5; g.setLineDash(dash);
    g.beginPath(); g.moveTo(this.zoneX0, this.Y(p)); g.lineTo(this.X(this.cols - 1), this.Y(p)); g.stroke();
    g.setLineDash([]);
  }

  textbook(g, col, alpha, solid) {
    const a0 = g.globalAlpha;
    g.globalAlpha = a0 * alpha;
    g.strokeStyle = col.text; g.lineWidth = 2; g.setLineDash(solid ? [] : [6, 5]);
    g.beginPath(); g.moveTo(this.X(this.hist.length - 1), this.Y(100)); g.lineTo(this.X(this.cols - 1), this.Y(this.c.target)); g.stroke();
    g.setLineDash([]);
    g.globalAlpha = a0;
  }

  /** A line through the future columns, starting at the breakout close. `values` may contain
      nulls (not drawn yet); the first drawn point connects back to the breakout, later gaps stay open. */
  path(g, values, color, width) {
    g.strokeStyle = color; g.lineWidth = width; g.lineJoin = g.lineCap = 'round';
    g.beginPath();
    g.moveTo(this.X(this.hist.length - 1), this.Y(100));
    let connected = true;
    values.forEach((v, j) => {
      if (v == null) { connected = false; return; }
      const x = this.X(this.hist.length + j), y = this.Y(v);
      if (connected) g.lineTo(x, y); else g.moveTo(x, y);
      connected = true;
    });
    g.stroke();
  }
}

/** A round step for the y-axis grid: 1, 2, 2.5 or 5 × 10^n. */
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * p) return m * p;
  return 10 * p;
}

// ---------------------------------------------------------------- drawing input
/** Writes a stroke into `values` (length HORIZON, nulls where nothing is drawn).
    Between two pointer samples every column in between gets a linearly interpolated value. */
export function strokeTo(values, fromCol, fromP, toCol, toP) {
  if (fromCol == null || fromCol < 0) { values[toCol] = toP; return; }
  const n = Math.abs(toCol - fromCol);
  if (n === 0) { values[toCol] = toP; return; }
  const dir = Math.sign(toCol - fromCol);
  for (let k = 0; k <= n; k++) values[fromCol + dir * k] = fromP + (toP - fromP) * k / n;
}

/** Share of the zone that has been drawn (0..1). */
export function coverage(values) {
  return values.filter(v => v != null).length / values.length;
}

/** The complete 30-value line used for scoring:
    columns before the first drawn point ramp from the breakout close (100), gaps are bridged
    linearly, and missing points at the end repeat the last drawn value. */
export function completeLine(values) {
  const out = values.slice();
  const first = out.findIndex(v => v != null);
  if (first < 0) return out.map(() => 100);
  for (let j = 0; j < first; j++) out[j] = 100 + (out[first] - 100) * (j + 1) / (first + 1);
  let last = first;
  for (let j = first + 1; j < out.length; j++) {
    if (out[j] == null) continue;
    for (let k = last + 1; k < j; k++) out[k] = out[last] + (out[j] - out[last]) * (k - last) / (j - last);
    last = j;
  }
  for (let j = last + 1; j < out.length; j++) out[j] = out[last];
  return out;
}
