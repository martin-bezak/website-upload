/* Sell the top: a real price chart plays one year in 20 seconds and you choose when to be in or out.
   State is saved to localStorage after every trade, so a reload can't be used to replay a daily chart
   with hindsight: a round that was running when the page closed ends right there, with the trades
   made so far (the position you were in is kept to the end of the year). */

import { STRINGS, LANGS, LANG_LABELS, FILTERS, initialLang, fill, pct, num } from './i18n.js';
import { DURATION, days, price, wealth, holdWealth, isInvested, result, top } from './round.js';
import { ChartView } from './chart.js';
import { todayKey, dailyNumber, dailyIds, DAILY_COUNT } from './daily.js';
import { load, save } from '../../estimate/js/storage.js';

const STATE_KEY = 'stt.v1';
const LANG_KEY = 'stt.lang';
const THEME_KEY = 'theme';
const DATA = new URL('../data/', import.meta.url);
const GAMES_PAGE = { en: '../../index.html#games', cs: '../../cs/index.html#games', sk: '../../sk/index.html#games' };
const FEEDBACK_PAGE = { en: '../../feedback.html', cs: '../../cs/feedback.html', sk: '../../sk/feedback.html' };
const LOCALE = { en: 'en-GB', cs: 'cs-CZ', sk: 'sk-SK' };

const root = document.querySelector('[data-stt]');
let lang = 'en';
let index = null;
const files = new Map();
let state = load(STATE_KEY, null);
if (!state || state.v !== 1) state = freshState();
let els, view = null, copyNote = '';
let run = null;   // { t0, before, raf, paused } while a round is playing

function freshState() {
  return { v: 1, view: 'home', mode: null, filter: 'all', daily: null, endless: { cur: null }, seen: [], history: [], streak: 0, best: 0 };
}

const S = () => STRINGS[lang];
const t = (key, vars) => fill(S()[key], vars);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = sel => root.querySelector(sel);
const touchFirst = () => matchMedia('(hover: none)').matches;

function commit() { save(STATE_KEY, state); render(); }
function persist() { save(STATE_KEY, state); }

/* ---------------------------------------------------------------- start-up */
async function start() {
  lang = initialLang(load(LANG_KEY, null));
  save(LANG_KEY, lang);
  root.classList.add('est', 'est--page', 'stt');
  root.innerHTML = `
    <div class="est-bar" data-bar>
      <button type="button" class="est-home" data-action="menu">
        <span class="est-logo" aria-hidden="true"><span class="est-logo-mb">MB</span><span class="est-logo-bar"></span></span>
        <span class="est-bar-title" data-title></span>
      </button>
      <span class="est-bar-space"></span>
      <div class="est-langs" data-langs role="group"></div>
    </div>
    <div class="est-shell"><div class="est-view" data-view></div><aside class="est-aside" data-aside></aside></div>`;
  els = { view: $('[data-view]'), title: $('[data-title]'), langs: $('[data-langs]'), aside: $('[data-aside]') };
  bindEvents();
  applyLang();
  els.view.innerHTML = `<p class="est-muted">${esc(t('loading'))}</p>`;
  try {
    const res = await fetch(new URL('index.json', DATA));
    if (!res.ok) throw new Error(res.status);
    index = await res.json();
  } catch (e) {
    els.view.innerHTML = `<p class="est-error">${esc(t('loadError'))}</p>`;
    return;
  }
  // A round left running (tab closed, reload) ends where it was
  for (const sl of [state.daily, state.endless]) {
    if (sl && sl.cur && sl.cur.phase === 'run') { try { finish(sl.cur, await chartFile(sl.cur.id), sl === state.daily ? 'daily' : 'endless'); } catch (e) { sl.cur = null; } }
  }
  state.view = 'home';
  persist();
  render();
}

async function chartFile(id) {
  if (!files.has(id)) {
    const res = await fetch(new URL('c/' + id + '.json', DATA));
    if (!res.ok) throw new Error('chart ' + id);
    files.set(id, await res.json());
  }
  return files.get(id);
}

/* ---------------------------------------------------------------- modes */
function ensureDaily() {
  const key = todayKey();
  if (!state.daily || state.daily.date !== key) {
    state.daily = { date: key, no: dailyNumber(key), ids: dailyIds(index.charts, key), idx: 0, done: false, results: [], cur: null };
  }
  return state.daily;
}
const slot = () => (state.mode === 'daily' ? state.daily : state.endless);
const newCur = id => ({ id, phase: 'ready', trades: [], res: null });

function pickRandom() {
  const f = state.filter;
  const inFilter = c => f === 'all' || c.c === f || (f === 'index' && c.c === 'fx');
  let pool = index.charts.filter(c => inFilter(c) && !state.seen.includes(c.id));
  if (!pool.length) {                         // everything in this market played: start over
    const ids = new Set(index.charts.filter(inFilter).map(c => c.id));
    state.seen = state.seen.filter(id => !ids.has(id));
    pool = index.charts.filter(inFilter);
  }
  return pool[Math.floor(Math.random() * pool.length)].id;
}

async function startMode(mode, filter) {
  stopRun();
  state.mode = mode;
  if (mode === 'daily') {
    const d = ensureDaily();
    if (d.done) { state.view = 'results'; return commit(); }
    if (!d.cur || d.cur.id !== d.ids[d.idx]) d.cur = newCur(d.ids[d.idx]);
  } else {
    if (filter && filter !== state.filter) { state.filter = filter; state.endless.cur = null; }
    const sl = state.endless;
    if (!sl.cur || sl.cur.phase === 'reveal') sl.cur = newCur(pickRandom());
  }
  state.view = 'play';
  try { await chartFile(slot().cur.id); } catch (e) { els.view.innerHTML = `<p class="est-error">${esc(t('loadError'))}</p>`; return; }
  commit();
  window.scrollTo(0, 0);
}

async function nextChart() {
  stopRun();
  if (state.mode === 'daily') {
    const d = state.daily;
    if (d.idx >= DAILY_COUNT - 1) { d.done = true; state.view = 'results'; return commit(); }
    d.idx++;
    d.cur = newCur(d.ids[d.idx]);
  } else {
    state.endless.cur = newCur(pickRandom());
  }
  await chartFile(slot().cur.id);
  commit();
  window.scrollTo(0, 0);
}

/* ---------------------------------------------------------------- the round */
function begin() {
  const cur = slot().cur;
  if (!cur || cur.phase !== 'ready') return;
  cur.phase = 'run';
  persist();
  run = { t0: performance.now(), before: 0, raf: 0, paused: false };
  renderPlayState();
  run.raf = requestAnimationFrame(tick);
}

function elapsed() { return run.paused ? run.before : run.before + performance.now() - run.t0; }

function tick() {
  const cur = slot().cur, chart = files.get(cur.id);
  const n = days(chart);
  const f = Math.min(n - 1, elapsed() / DURATION * (n - 1));
  view.draw({ chart, f, trades: cur.trades, labels: chartLabels() });
  updateLive(chart, cur, Math.floor(f));
  if (f >= n - 1) { finish(cur, chart, state.mode); stopRun(); commit(); return; }
  run.raf = requestAnimationFrame(tick);
}

function stopRun() { if (run) cancelAnimationFrame(run.raf); run = null; }

function pause() {
  if (!run || run.paused) return;
  run.before = elapsed(); run.paused = true;
  cancelAnimationFrame(run.raf);
  renderPlayState();
}
function resume() {
  if (!run || !run.paused) return;
  run.paused = false; run.t0 = performance.now();
  renderPlayState();
  run.raf = requestAnimationFrame(tick);
}

function trade() {
  const cur = slot().cur;
  if (!run || run.paused || cur.phase !== 'run') return;
  const chart = files.get(cur.id);
  const day = Math.min(days(chart) - 1, Math.floor(elapsed() / DURATION * (days(chart) - 1)));
  if (day === 0 && !cur.trades.length) return;                 // nothing to sell on the first tick
  if (cur.trades.length && cur.trades[cur.trades.length - 1] >= day) return;   // one flip per day
  cur.trades.push(day);
  persist();
  renderPlayState();
}

function finish(cur, chart, mode) {
  cur.phase = 'reveal';
  cur.res = result(chart, cur.trades);
  const r = cur.res;
  state.history.push({ id: cur.id, c: chart.c, edge: r.edge, beat: r.beat });
  state.seen.push(cur.id);
  state.streak = r.beat ? state.streak + 1 : 0;
  state.best = Math.max(state.best, state.streak);
  if (mode === 'daily') state.daily.results[state.daily.idx] = { edge: r.edge, beat: r.beat, tie: r.tie };
}

/* ---------------------------------------------------------------- language and theme */
function applyLang() {
  document.documentElement.lang = lang;
  document.title = t('docTitle');
  els.title.innerHTML = `${esc(S().title[0])} <em>${esc(S().title[1])}</em>`;
  els.langs.setAttribute('aria-label', t('langLabel'));
  els.langs.innerHTML = LANGS.map(l => `<button type="button" class="est-lang${l === lang ? ' is-on' : ''}" data-lang="${l}" lang="${l}" aria-pressed="${l === lang}">${LANG_LABELS[l]}</button>`).join('');
  els.aside.innerHTML = `
    <p class="est-label">${esc(t('pageEyebrow'))}</p>
    <h1 class="est-title">${esc(S().title[0])} <em>${esc(S().title[1])}</em></h1>
    <p class="est-lede">${esc(t('pageLede'))}</p>
    <ol class="est-rules">${S().pageRules.map(r => `<li>${esc(r)}</li>`).join('')}</ol>
    <a class="est-btn est-btn--secondary" href="${GAMES_PAGE[lang]}">${esc(t('backToGames'))}</a>
    <p class="est-small est-muted stt-disclaimer">${esc(t('disclaimer'))}</p>`;
}

function setLang(next) {
  if (next === lang) return;
  lang = next; save(LANG_KEY, lang);
  try { const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u); } catch (e) {}
  applyLang();
  if (run) renderPlayState(); else render();
}

function toggleTheme() {
  const light = document.documentElement.dataset.theme === 'light';
  if (light) document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', 'light');
  try { localStorage.setItem(THEME_KEY, light ? 'dark' : 'light'); } catch (e) {}
  render();
}

/* ---------------------------------------------------------------- rendering */
function render() {
  if (!index) return;
  const v = state.view;
  view = null;
  let html;
  if (v === 'play' && slot() && slot().cur && files.has(slot().cur.id)) html = renderPlay();
  else if (v === 'results' && state.daily) html = renderResults();
  else if (v === 'stats') html = renderStats();
  else { state.view = 'home'; html = renderHome(); }
  els.view.innerHTML = `<div class="est-fade">${html}</div>`;
  if (state.view === 'play') mountChart();
}

function btn(action, label, kind = 'secondary', extra = '') {
  return `<button type="button" class="est-btn est-btn--${kind} ${extra}" data-action="${action}">${esc(label)}</button>`;
}

function renderHome() {
  const d = ensureDaily();
  const beat = d.results.filter(r => r && r.beat).length;
  const going = d.cur && d.cur.phase !== 'reveal' && d.idx > 0;
  const isLight = document.documentElement.dataset.theme === 'light';
  const chips = FILTERS.map(f => `<button type="button" class="est-chip stt-chip${state.filter === f ? ' is-on' : ''}" data-action="endless" data-f="${f}">${esc(S().filters[f])}</button>`).join('');
  return `
    <p class="est-label">${esc(t('chooseTitle'))}</p>
    <button type="button" class="est-pick-daily${d.done ? ' is-done' : ''}" data-action="daily">
      <span class="est-pick-name">${esc(t('dailyName', { n: d.no }))} <span aria-hidden="true">→</span></span>
      <span class="est-pick-sub">${esc(d.done ? t('dailyDone', { beat }) : (going ? t('continue') + ' ' : '') + t('dailyDesc'))}</span>
    </button>
    <div class="stt-endless">
      <p class="stt-endless-name">${esc(t('endlessName'))}</p>
      <p class="stt-endless-sub">${esc(t('endlessDesc'))}</p>
      <div class="stt-chips">${chips}</div>
    </div>
    <div class="est-row">${btn('stats', t('statsBtn'))}</div>
    <footer class="est-foot">
      <div class="est-row">${btn('theme', isLight ? t('themeToDark') : t('themeToLight'))}
        <a class="est-link" href="${FEEDBACK_PAGE[lang]}">${esc(t('feedbackLink'))}</a></div>
    </footer>`;
}

function chartLabels() { return { start: t('start'), top: t('top') }; }

function renderPlay() {
  const cur = slot().cur, chart = files.get(cur.id);
  const label = state.mode === 'daily'
    ? `${t('dailyName', { n: state.daily.no })} · ${t('roundOf', { i: state.daily.idx + 1, n: DAILY_COUNT })}`
    : t('endlessLabel', { f: S().filters[state.filter] });
  return `
    <div class="est-meta"><span>${esc(label)}</span>${btn('menu', t('menu'), 'quiet')}</div>
    <p class="stt-meta"><span>${esc(t('mystery', { cat: S().cats[chart.c] }))}</span> <span data-day></span></p>
    <dl class="stt-stats">
      <div class="stt-you"><dt>${esc(t('you'))}</dt><dd data-you>+0%</dd></div>
      <div><dt>${esc(t('hold'))}</dt><dd data-hold>+0%</dd></div>
      <div><dt>${esc(t('trades'))}</dt><dd data-trades>0</dd></div>
    </dl>
    <div class="stt-stage">
      <span class="stt-pos" data-pos></span>
      <canvas class="stt-canvas" data-canvas role="img" aria-label="${esc(t('mystery', { cat: S().cats[chart.c] }))}"></canvas>
    </div>
    <div data-below></div>`;
}

function mountChart() {
  const cur = slot().cur, chart = files.get(cur.id);
  view = new ChartView($('[data-canvas]'));
  if (cur.phase === 'reveal') view.draw({ chart, f: days(chart) - 1, trades: cur.trades, reveal: true, snap: true, labels: chartLabels() });
  else view.draw({ chart, f: -1, trades: [], snap: true, labels: chartLabels() });
  updateLive(chart, cur, cur.phase === 'reveal' ? days(chart) - 1 : 0);
  renderPlayState();
}

/** Numbers above the chart, updated every frame without re-rendering the page. */
function updateLive(chart, cur, day) {
  const you = wealth(chart, cur.trades, day) - 1, hold = holdWealth(chart, day) - 1;
  const set = (sel, txt) => { const el = $(sel); if (el && el.textContent !== txt) el.textContent = txt; };
  set('[data-you]', pct(you * 100, lang, { signed: true }));
  set('[data-hold]', pct(hold * 100, lang, { signed: true }));
  set('[data-trades]', String(cur.trades.length));
  set('[data-day]', '· ' + t('day', { d: day + 1, n: days(chart) }));
}

/** Overlay, position tag and the area under the chart for the current phase. */
function renderPlayState() {
  if (state.view !== 'play') return;
  const cur = slot().cur, chart = files.get(cur.id);
  const below = $('[data-below]'), pos = $('[data-pos]');
  if (!below) return;
  const invested = isInvested(cur.trades);
  pos.textContent = invested ? t('holding') : t('cash');
  pos.className = 'stt-pos ' + (invested ? 'is-in' : 'is-out');
  pos.hidden = cur.phase === 'reveal';
  const prompt = (text, action, label) => `<div class="stt-prompt"><p>${esc(text)}</p>${btn(action, label, 'primary', 'stt-go')}</div>`;

  if (cur.phase === 'ready') {
    below.innerHTML = prompt(t('ready'), 'go', t('go'));
  } else if (cur.phase === 'run' && run && run.paused) {
    below.innerHTML = prompt(t('paused'), 'resume', t('resume'));
  } else if (cur.phase === 'run') {
    const label = invested ? t('sell') : t('buy');
    const existing = $('[data-trade]');
    if (existing) {
      existing.textContent = label;
      existing.classList.toggle('is-buy', !invested);
    } else {
      below.innerHTML = `
        <div class="stt-controls">
          <button type="button" class="stt-trade${invested ? '' : ' is-buy'}" data-trade>${esc(label)}</button>
          ${touchFirst() ? '' : `<p class="stt-hint">${esc(t('keyHint'))}</p>`}
        </div>`;
    }
  } else {
    below.innerHTML = renderReveal(cur, chart);
  }
}

function decodeReveal(chart) {
  const bin = atob(chart.r);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
}
const fmtDate = (iso, opts) => new Intl.DateTimeFormat(LOCALE[lang], { ...opts, timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));

function renderReveal(cur, chart) {
  const r = cur.res, info = decodeReveal(chart);
  const x = pct(Math.abs(r.edge) * 100, lang);
  const verdict = r.tie ? t('tie') : r.beat ? t('beat', { x }) : t('lost', { x });
  const td = top(chart), endFromTop = price(chart, days(chart) - 1) / price(chart, td) - 1;
  const story = td > 0 ? t('story', {
    date: fmtDate(info.hi, { day: 'numeric', month: 'long', year: 'numeric' }),
    up: pct((price(chart, td) / 100 - 1) * 100, lang, { signed: true }),
    fall: endFromTop < -0.05 ? t('storyFell', { x: pct(-endFromTop * 100, lang) }) : t('storyRose')
  }) : '';
  const ev = (info.ev || []).map(k => S().events[k]).filter(Boolean);
  const last = state.mode === 'daily' && state.daily.idx >= DAILY_COUNT - 1;
  return `
    <section class="stt-reveal" aria-live="polite">
      <p class="stt-verdict${r.beat ? ' is-win' : ''}">${esc(verdict)}</p>
      <p class="stt-money">${esc(t('yourMoney', { you: num(r.you * 100, lang), hold: num(r.hold * 100, lang) }))}</p>
      <p class="est-label stt-gap">${esc(t('itWas'))}</p>
      <h2 class="stt-who">${esc(t('revealWho', { name: info.n, ticker: info.t }))}</h2>
      <p class="stt-span">${esc(t('span', { from: fmtDate(info.from, { month: 'short', year: 'numeric' }), to: fmtDate(info.to, { month: 'short', year: 'numeric' }) }))}</p>
      ${story ? `<p class="stt-story">${esc(story)}</p>` : ''}
      ${ev.length ? `<p class="stt-story">${esc(t('included', { list: ev.join(', ') }))}</p>` : ''}
      <div class="est-row">${btn('next', last ? t('seeResults') : t('next'), 'primary')}${btn('menu', t('menu'))}</div>
    </section>`;
}

function shareText() {
  const d = state.daily;
  const beat = d.results.filter(r => r && r.beat).length;
  const line = d.results.map(r => (r.beat ? '▲ ' : r.tie ? '= ' : '▼ ') + pct(r.edge * 100, lang, { signed: true, digits: 0 })).join('  ');
  return `${t('shareHead', { n: d.no })}\n${line}\n${t('shareBeat', { b: beat })}\nmartinbezak.com/MBArcade/`;
}

async function copyShare() {
  try { await navigator.clipboard.writeText(shareText()); copyNote = 'copied'; }
  catch (e) { copyNote = 'copyFailed'; }
  const el = $('#stt-copy-note'); if (el) el.textContent = t(copyNote);
}

function renderResults() {
  const d = state.daily;
  const beat = d.results.filter(r => r && r.beat).length;
  return `
    <p class="est-label">${esc(t('resultsTitle', { n: d.no }))}</p>
    <p class="est-big est-total">${beat}<em>/3</em></p>
    <p class="stt-money">${esc(t('beatOf'))}</p>
    <ol class="est-results">${d.results.map((r, i) => `
      <li><span class="est-sq ${r.beat ? 'good' : r.tie ? 'ok' : 'miss'}" aria-hidden="true"></span>
        <span class="est-row-q">${esc(t('roundOf', { i: i + 1, n: DAILY_COUNT }))}</span>
        <span class="est-row-score">${pct(r.edge * 100, lang, { signed: true })}</span></li>`).join('')}</ol>
    <pre class="est-share">${esc(shareText())}</pre>
    ${btn('copy', t('copy'), 'primary', 'est-wide')}
    <p class="est-small est-muted" id="stt-copy-note" aria-live="polite">${copyNote ? esc(t(copyNote)) : ''}</p>
    <div class="est-row">${btn('stats', t('statsBtn'))}${btn('menu', t('menu'))}</div>`;
}

function renderStats() {
  const H = state.history;
  if (!H.length) return `<p class="est-label">${esc(t('statsTitle'))}</p><p class="est-intro">${esc(t('noStats'))}</p><div class="est-row">${btn('menu', t('menu'))}</div>`;
  const beatPct = Math.round(100 * H.filter(h => h.beat).length / H.length);
  const best = Math.max(...H.map(h => h.edge));
  const groups = [['stock'], ['crypto'], ['commodity'], ['index', 'fx']];
  const rows = groups.map(g => {
    const hs = H.filter(h => g.includes(h.c));
    if (!hs.length) return '';
    const avg = hs.reduce((s, h) => s + h.edge, 0) / hs.length;
    return `<tr><th scope="row">${esc(S().filters[g[0]])}</th><td>${hs.length}</td><td>${hs.filter(h => h.beat).length}</td><td>${pct(avg * 100, lang, { signed: true })}</td></tr>`;
  }).join('');
  return `
    <p class="est-label">${esc(t('statsTitle'))}</p>
    <dl class="est-stats">
      <div><dt>${esc(t('statPlayed'))}</dt><dd>${H.length}</dd></div>
      <div><dt>${esc(t('statBeat'))}</dt><dd>${beatPct}${lang === 'en' ? '' : ' '}<em>%</em></dd></div>
      <div><dt>${esc(t('statBest'))}</dt><dd>${best > 0 ? esc(pct(best * 100, lang, { signed: true, digits: 0 })) : '–'}</dd></div>
      <div><dt>${esc(t('statStreak'))}</dt><dd>${state.best}</dd></div>
    </dl>
    <p class="est-small est-muted">${esc(t('streakNote'))}</p>
    <p class="est-label stt-gap">${esc(t('byMarket'))}</p>
    <table class="stt-table"><thead><tr><th></th><th>${esc(t('colPlayed'))}</th><th>${esc(t('colBeat'))}</th><th>${esc(t('colAvg'))}</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="est-row">${btn('menu', t('menu'))}</div>`;
}

/* ---------------------------------------------------------------- events */
const actions = {
  daily: () => startMode('daily'),
  endless: el => startMode('endless', el.dataset.f),
  menu: () => { stopRunIfIdle(); state.view = 'home'; commit(); window.scrollTo(0, 0); },
  stats: () => { state.view = 'stats'; commit(); },
  theme: toggleTheme,
  go: begin,
  resume,
  next: nextChart,
  copy: copyShare
};

/** Leaving to the menu mid-round ends the round (as if the page had closed). */
function stopRunIfIdle() {
  if (!run) return;
  const cur = slot().cur;
  stopRun();
  if (cur && cur.phase === 'run') finish(cur, files.get(cur.id), state.mode);
}

function bindEvents() {
  const hit = (e, sel) => { const el = e.target.closest(sel); return el && root.contains(el) ? el : null; };
  root.addEventListener('click', e => {
    const a = hit(e, '[data-action]');
    if (a && !a.disabled && actions[a.dataset.action]) { actions[a.dataset.action](a); return; }
    const l = hit(e, '.est-lang[data-lang]');
    if (l) { setLang(l.dataset.lang); return; }
    if (hit(e, '[data-trade]') && e.detail === 0) trade();          // keyboard activation of the button
  });
  // the trade button reacts on press, not on release: every millisecond counts
  root.addEventListener('pointerdown', e => {
    if (hit(e, '[data-trade]')) { e.preventDefault(); trade(); }
  });
  document.addEventListener('keydown', e => {
    if (state.view !== 'play' || e.target.closest?.('input, textarea')) return;
    const cur = slot() && slot().cur;
    if (!cur) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      if (cur.phase === 'ready') begin();
      else if (cur.phase === 'run') { if (run && run.paused) resume(); else trade(); }
    } else if (e.key === 'Enter' && cur.phase === 'reveal' && !e.target.closest?.('button, a')) {
      nextChart();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (!view) return;
      view.layout();
      const cur = slot().cur, chart = files.get(cur.id);
      if (cur.phase === 'reveal') view.draw({ chart, f: days(chart) - 1, trades: cur.trades, reveal: true, snap: true, labels: chartLabels() });
      else if (!run) view.draw({ chart, f: -1, trades: [], snap: true, labels: chartLabels() });
    }, 150);
  });
}

start();
