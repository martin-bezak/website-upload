// Small SVG chart helpers shared by the Research pages. No library: scales, ticks, paths, axes.
const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

export function svg(box, w, h) {
  box.querySelectorAll('svg, .r-loading').forEach(s => s.remove());
  const s = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: 'img' });
  box.prepend(s);
  return s;
}

export function linear([d0, d1], [r0, r1]) {
  const f = v => r0 + (v - d0) / (d1 - d0 || 1) * (r1 - r0);
  f.inv = p => d0 + (p - r0) / (r1 - r0 || 1) * (d1 - d0);
  f.domain = [d0, d1];
  return f;
}

export function log([d0, d1], [r0, r1]) {
  const l0 = Math.log(d0), l1 = Math.log(d1);
  const f = v => r0 + (Math.log(v) - l0) / (l1 - l0 || 1) * (r1 - r0);
  f.domain = [d0, d1];
  return f;
}

export function ticks(lo, hi, n = 5) {
  const span = hi - lo || 1;
  const raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= n + 1) || mag * 10;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

export function logTicks(lo, hi) {
  const out = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
    for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= lo && v <= hi) out.push(v); }
  return out.length > 7 ? out.filter(v => String(v)[0] === '1') : out;
}

// Week keys are days since 1970-01-01
export const day = k => new Date(k * 864e5);
export const yearOf = k => day(k).getUTCFullYear();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtMonth = k => { const d = day(k); return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const fmtDay = k => { const d = day(k); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const keyOf = date => Math.round(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 864e5);

export function yearTicks(k0, k1, maxN) {
  const y0 = yearOf(k0), y1 = yearOf(k1);
  const step = [1, 2, 5, 10, 20].find(s => (y1 - y0) / s <= maxN) || 25;
  const out = [];
  for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
    const k = Date.UTC(y, 0, 1) / 864e5;
    if (k >= k0 && k <= k1) out.push([k, y]);
  }
  return out;
}

export function path(xs, ys) {
  let d = '', pen = false;
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i];
    if (y == null || !isFinite(y)) { pen = false; continue; }
    d += (pen ? 'L' : 'M') + xs[i].toFixed(1) + ',' + y.toFixed(1);
    pen = true;
  }
  return d;
}

export function area(xs, ys, base) {
  if (!xs.length) return '';
  let d = `M${xs[0].toFixed(1)},${base}`;
  for (let i = 0; i < xs.length; i++) d += `L${xs[i].toFixed(1)},${ys[i].toFixed(1)}`;
  return d + `L${xs[xs.length - 1].toFixed(1)},${base}Z`;
}

// Horizontal grid lines with labels on the left
export function yGrid(g, sy, values, x0, x1, fmt, { zero } = {}) {
  const grid = el('g', { class: 'grid' }, g);
  for (const v of values) {
    const y = sy(v);
    el('line', { x1: x0, x2: x1, y1: y, y2: y, class: v === zero ? 'zero' : null }, grid);
    const t = el('text', { x: x0 - 8, y: y + 4, 'text-anchor': 'end' }, g);
    t.textContent = fmt(v);
  }
}

export function xLabels(g, sx, items, y) {
  for (const [v, label] of items) {
    const t = el('text', { x: sx(v), y, 'text-anchor': 'middle' }, g);
    t.textContent = label;
  }
}

// Redraw on resize (width only), debounced to the next frame
export function responsive(box, draw) {
  let w = 0, raf = 0;
  const ro = new ResizeObserver(([e]) => {
    const nw = Math.round(e.contentRect.width);
    if (!nw || nw === w) return;
    w = nw;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => draw(w));
  });
  ro.observe(box);
  // First draw measures directly, so it doesn't wait for a resize callback (those pause in hidden tabs)
  return () => { w = w || Math.round(box.clientWidth); if (w) draw(w); };
}

// Signs only when the rounded number isn't zero (no "−0.0%")
const r0 = (v, d) => +(v * 100).toFixed(d) === 0;
export const pct = (v, d = 0) => (r0(v, d) ? '' : v > 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d) + '%';
export const pctPlain = (v, d = 0) => (v < 0 && !r0(v, d) ? '−' : '') + Math.abs(v * 100).toFixed(d) + '%';

export async function load(name) {
  const r = await fetch(new URL(`../data/${name}.json`, import.meta.url));
  if (!r.ok) throw new Error(`Could not load ${name}`);
  return r.json();
}

// Read a CSS custom property from an element (for colours used in JS-drawn cells)
export const cssVar = (node, name) => getComputedStyle(node).getPropertyValue(name).trim();
