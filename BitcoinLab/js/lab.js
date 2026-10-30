// Bitcoin Lab: shared helpers for the Today and Backtest pages.
export { el, svg, linear, log, ticks, logTicks, path, area, yGrid, xLabels, yearTicks, responsive, pct, pctPlain } from './chart.js?v=4';

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];

export const HORIZONS = ['1h', '4h', '1d', '7d', '30d', '90d', '1y'];
export const H_LONG = { '1h': '1 hour', '4h': '4 hours', '1d': '1 day', '7d': '7 days', '30d': '30 days', '90d': '90 days', '1y': '1 year' };
export const H_SECONDS = { '1h': 3600, '4h': 14400, '1d': 86400, '7d': 7 * 86400, '30d': 30 * 86400, '90d': 90 * 86400, '1y': 365 * 86400 };
export const MODEL_ORDER = ['ensemble', 'climatology', 'momentum', 'price', 'full', 'volatility'];

export async function load(name) {
  const r = await fetch(new URL(`../data/${name}.json`, import.meta.url), { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Could not load ${name} (${r.status})`);
  return r.json();
}

export const usd = v => v == null ? '–' : '$' + Math.round(v).toLocaleString('en-US');
export const pc = (v, d = 0) => v == null ? '–' : (v * 100).toFixed(d) + '%';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function when(ts, withTime = false) {
  const d = new Date(ts * 1000);
  const s = `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return withTime ? `${s}, ${String(d.getUTCHours()).padStart(2, '0')}:00 UTC` : s;
}
export const monthYear = ts => { const d = new Date(ts * 1000); return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

// The horizon switcher: buttons with data-h, state kept in ?h= so every view has its own link
export function horizonSwitch(onChange, fallback = '30d') {
  const fromUrl = new URLSearchParams(location.search).get('h');
  let h = HORIZONS.includes(fromUrl) ? fromUrl : fallback;
  const btns = $$('[data-h]');
  const set = (v, push) => {
    h = v;
    btns.forEach(b => b.setAttribute('aria-pressed', b.dataset.h === h));
    if (push) {
      const u = new URL(location.href);
      u.searchParams.set('h', h);
      history.replaceState(null, '', u);
      $$('a[data-keep-h]').forEach(a => { const x = new URL(a.href); x.searchParams.set('h', h); a.href = x; });
    }
    onChange(h);
  };
  btns.forEach(b => b.addEventListener('click', () => set(b.dataset.h, true)));
  // arrow keys move along the switcher
  btns.forEach((b, i) => b.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) { e.preventDefault(); const n = btns[(i + d + btns.length) % btns.length]; n.focus(); set(n.dataset.h, true); }
  }));
  set(h, true);
  return () => h;
}

export function isDark() {
  const t = document.documentElement.getAttribute('data-theme');
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}
export function onTheme(fn) {
  new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fn);
}

// Live price: TradingView's compact single-quote widget (their real-time data and attribution, in their iframe).
// The page head is dark in both themes, so the widget is always dark.
// If it can't load, show the last close from our own data instead of an empty box.
export function liveWidget(box, lastPrice, lastTime) {
  box.innerHTML = `<div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div>
    <div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/symbols/BTCUSDT/?exchange=BINANCE" rel="noopener nofollow" target="_blank">BTCUSDT quote by TradingView</a></div></div>`;
  const s = document.createElement('script');
  s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js';
  s.async = true;
  s.textContent = JSON.stringify({ symbol: 'BINANCE:BTCUSDT', width: '100%', isTransparent: true, colorTheme: 'dark', locale: 'en' });
  s.onerror = () => { box.innerHTML = `<div class="live-fallback"><b>${usd(lastPrice)}</b><span>Live price unavailable. Last close, ${when(lastTime)}.</span></div>`; };
  box.querySelector('.tradingview-widget-container').appendChild(s);
}

// Bitcoin Lab's own top bar: phone menu and the light/dark switch (same saved setting as the main site)
export function chrome() {
  const btn = document.querySelector('.lab-menu'), links = document.getElementById('lab-links');
  if (btn && links) {
    const set = open => { links.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    links.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && links.classList.contains('is-open')) { set(false); btn.focus(); } });
  }
  const tb = document.getElementById('theme-btn');
  if (tb) {
    const label = () => { const light = document.documentElement.getAttribute('data-theme') === 'light'; tb.textContent = light ? 'Dark' : 'Light'; tb.setAttribute('aria-label', light ? 'Switch to dark' : 'Switch to light'); };
    tb.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      label();
    });
    label();
  }
}
