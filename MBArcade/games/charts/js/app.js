/* Chart it: draw where the price goes after a classic chart pattern, then compare with the textbook
   and with what really happened. State is saved to localStorage after every action (and after every
   stroke), so closing the tab mid-chart loses nothing. The storage helpers are shared with the
   Estimate game. */

import { STRINGS, LANGS, LANG_LABELS, PATTERNS, initialLang, fill, pct } from './i18n.js';
import { ChartView, HORIZON, strokeTo, coverage, completeLine } from './chart.js';
import { scoreLine, textbookLine, square, QUIZ_BONUS } from './scoring.js';
import { todayKey, dailyNumber, dailyIds, DAILY_COUNT } from './daily.js';
import { diagram } from './diagrams.js';
import { load, save } from '../../estimate/js/storage.js';

const STATE_KEY = 'charts.v1';
const LANG_KEY = 'charts.lang';
const THEME_KEY = 'theme';
const DATA = new URL('../data/', import.meta.url);
const SITE_PAGE = { en: '../../index.html', cs: '../../cs/index.html', sk: '../../sk/index.html' };
const GAMES_PAGE = { en: '../../index.html#games', cs: '../../cs/index.html#games', sk: '../../sk/index.html#games' };
const FEEDBACK_PAGE = { en: '../../feedback.html', cs: '../../cs/feedback.html', sk: '../../sk/feedback.html' };

const root = document.querySelector('[data-charts]');
let lang = 'en';
let index = null;                 // data/index.json
const files = new Map();          // id -> chart file (loaded lazily)
let state = load(STATE_KEY, null);
if (!state || state.v !== 1) state = freshState();
let els, view = null, lastKey = '', copyNote = '';
let drawing = null;               // the stroke in progress { col, p }

function freshState() {
  return { v: 1, view: 'home', mode: null, learn: null, blind: null, daily: null, seen: [], history: [], streak: 0, best: 0 };
}

const S = () => STRINGS[lang];
const t = (key, vars) => fill(S()[key], vars);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = sel => root.querySelector(sel);
const touchFirst = () => matchMedia('(hover: none)').matches;
const name = p => { const n = S().names[p]; return n.charAt(0).toUpperCase() + n.slice(1); };
const nameInline = p => (lang === 'en' ? S().names[p].toLowerCase() : S().names[p]);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function commit() { save(STATE_KEY, state); render(); }
function persist() { save(STATE_KEY, state); }

/* ---------------------------------------------------------------- start-up */
async function start() {
  lang = initialLang(load(LANG_KEY, null));
  save(LANG_KEY, lang);
  root.classList.add('est', 'est--page', 'cg');
  root.innerHTML = `
    <div class="est-bar" data-bar>
      <button type="button" class="est-home" data-action="back" data-home>
        <span class="est-logo" aria-hidden="true"><span class="est-logo-mb">MB</span><span class="est-logo-bar"></span></span>
        <span class="est-bar-title" data-title></span>
      </button>
      <span class="est-bar-space"></span>
      <div class="est-langs" data-langs role="group"></div>
    </div>
    <div class="est-shell"><div class="est-view" data-view></div><aside class="est-aside" data-aside></aside></div>`;
  els = { view: $('[data-view]'), bar: $('[data-bar]'), title: $('[data-title]'), langs: $('[data-langs]'), home: $('[data-home]'), aside: $('[data-aside]') };
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
  state.view = 'home';                         // every visit opens on the menu; games in progress continue from there
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

/* ---------------------------------------------------------------- modes and charts */
function ensureDaily() {
  const key = todayKey();
  if (!state.daily || state.daily.date !== key) {
    state.daily = { date: key, no: dailyNumber(key), ids: dailyIds(index.charts, key), idx: 0, done: false, results: [], cur: null };
  }
  return state.daily;
}

function slot(mode = state.mode) {
  return mode === 'daily' ? state.daily : state[mode] || (state[mode] = { cur: null });
}

function newCur(id, mode) {
  const c = { id, phase: mode === 'blind' ? 'quiz' : 'draw', values: Array(HORIZON).fill(null), undo: [], hint: false, quiz: null, result: null };
  if (mode === 'blind') c.quiz = { options: quizOptions(id), pick: null };
  return c;
}

/** The right pattern plus three others, in an order fixed by the chart id (stable across reloads). */
function quizOptions(id) {
  const right = index.charts.find(c => c.id === id).p;
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const others = PATTERNS.filter(p => p !== right).sort((a, b) => ((h ^ a.length * 7919) % 97) - ((h ^ b.length * 7919) % 97) || a.localeCompare(b));
  const pick3 = [others[h % others.length], others[(h + 3) % others.length], others[(h + 6) % others.length]].filter((p, i, a) => a.indexOf(p) === i);
  while (pick3.length < 3) pick3.push(others.find(p => !pick3.includes(p)));
  const opts = [right, ...pick3];
  return opts.map((p, i) => [p, (h >> i) % 11]).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(x => x[0]);
}

function pickRandom() {
  let pool = index.charts.filter(c => !state.seen.includes(c.id));
  if (!pool.length) { state.seen = []; pool = index.charts; }   // everything played: start over
  return pool[Math.floor(Math.random() * pool.length)].id;
}

async function startMode(mode) {
  state.mode = mode;
  if (mode === 'daily') {
    const d = ensureDaily();
    if (d.done) { state.view = 'results'; return commit(); }
    if (!d.cur || d.cur.id !== d.ids[d.idx]) d.cur = newCur(d.ids[d.idx], 'daily');
  } else {
    const sl = slot(mode);
    if (!sl.cur || sl.cur.phase === 'reveal') sl.cur = newCur(pickRandom(), mode);
  }
  state.view = 'play';
  await chartFile(slot().cur.id);
  commit();
  window.scrollTo(0, 0);
}

async function nextChart() {
  if (state.mode === 'daily') {
    const d = state.daily;
    d.idx++;
    if (d.idx >= d.ids.length) { d.done = true; d.idx = d.ids.length - 1; d.cur = null; state.view = 'results'; commit(); window.scrollTo(0, 0); return; }
    d.cur = newCur(d.ids[d.idx], 'daily');
  } else {
    slot().cur = newCur(pickRandom(), state.mode);
  }
  await chartFile(slot().cur.id);
  commit();
  window.scrollTo(0, 0);
}

/* ---------------------------------------------------------------- actions */
const actions = {
  learn() { startMode('learn'); },
  blind() { startMode('blind'); },
  daily() { startMode('daily'); },
  stats() { state.view = 'stats'; commit(); window.scrollTo(0, 0); },
  library() { state.view = 'library'; commit(); window.scrollTo(0, 0); },
  menu() { state.view = 'home'; commit(); window.scrollTo(0, 0); },
  back() { if (state.view === 'home') { location.href = SITE_PAGE[lang]; return; } actions.menu(); },
  theme() {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    render();
  },
  quiz(el) {
    const cur = slot().cur;
    if (!cur || cur.phase !== 'quiz') return;
    cur.quiz.pick = el.dataset.p;
    cur.phase = 'draw';
    commit();
    // the quiz buttons sit under the chart: bring the step heading and the chart back into view
    const step = $('.cg-step');
    if (step) window.scrollTo(0, Math.max(0, step.getBoundingClientRect().top + window.scrollY - 72));
  },
  undo() {
    const cur = slot().cur;
    if (!cur || !cur.undo.length) return;
    cur.values = cur.undo.pop();
    persist(); redraw(); controls();
  },
  clear() {
    const cur = slot().cur;
    if (!cur) return;
    cur.undo.push(cur.values.slice());
    cur.values = Array(HORIZON).fill(null);
    persist(); redraw(); controls();
  },
  hint() {
    const cur = slot().cur;
    cur.hint = !cur.hint;
    persist(); redraw(); controls();
  },
  submit() { reveal(); },
  next() { nextChart(); },
  copy() { copyShare(); }
};

function reveal() {
  const cur = slot().cur, chart = files.get(cur.id);
  if (!cur || cur.phase !== 'draw' || coverage(cur.values) < 0.5) return;
  const guess = completeLine(cur.values);
  const real = chart.candles.slice(chart.b + 1, chart.b + 1 + HORIZON).map(k => k[3]);
  const you = scoreLine(guess, real, chart.atr);
  const book = textbookLine(chart.target);
  const tb = scoreLine(book, real, chart.atr);
  const exp = scoreLine(guess, book, chart.atr);   // what the guess would score if the textbook had been right
  const bonus = cur.quiz && cur.quiz.pick === chart.pattern ? QUIZ_BONUS : 0;
  cur.values = guess;
  cur.result = { you, tb, exp, bonus };
  cur.phase = 'reveal';
  const dirOk = you.direction > 0;
  state.streak = dirOk ? state.streak + 1 : 0;
  state.best = Math.max(state.best, state.streak);
  state.seen.push(cur.id);
  state.history.push({ id: cur.id, p: chart.pattern, mode: state.mode, score: you.total, tb: tb.total, bonus, dir: dirOk, hit: chart.outcome.result === 'hit', ts: Date.now() });
  if (state.history.length > 3000) state.history.shift();
  if (state.mode === 'daily') state.daily.results[state.daily.idx] = { score: you.total, up: real[HORIZON - 1] >= 100, p: chart.pattern };
  persist();
  render();
  // bring the chart back into view (the Reveal button sits under it, often below the fold on phones)
  const box = $('.cg-chart');
  if (box) window.scrollTo(0, Math.max(0, box.getBoundingClientRect().top + window.scrollY - 72));
  animateReveal();
}

/* ---------------------------------------------------------------- language */
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
    <a class="est-btn est-btn--secondary" href="${GAMES_PAGE[lang]}">${esc(t('backToGames'))}</a>`;
}

function setLang(next) {
  if (next === lang || !LANGS.includes(next)) return;
  lang = next;
  save(LANG_KEY, lang);
  try { const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u); } catch (e) {}
  applyLang();
  lastKey = '';
  render();
}

/* ---------------------------------------------------------------- rendering */
function render() {
  if (!index) return;
  let html, key;
  const cur = state.view === 'play' ? slot().cur : null;
  if (cur && files.has(cur.id)) { html = renderPlay(cur); key = 'play:' + cur.id + ':' + cur.phase; }
  else if (state.view === 'results' && state.daily) { html = renderResults(); key = 'results'; }
  else if (state.view === 'stats') { html = renderStats(); key = 'stats'; }
  else if (state.view === 'library') { html = renderLibrary(); key = 'library'; }
  else { state.view = 'home'; html = renderHome(); key = 'home'; }
  els.view.innerHTML = html;
  els.home.setAttribute('aria-label', t(state.view === 'home' ? 'logoLabelSite' : 'logoLabel'));
  if (key !== lastKey) {
    els.view.classList.remove('est-fade'); void els.view.offsetWidth; els.view.classList.add('est-fade');
    lastKey = key; copyNote = '';
  }
  view = null;
  if (cur && files.has(cur.id)) mountChart(cur);
}

function renderHome() {
  const d = ensureDaily();
  const dTotal = d.results.reduce((s, r) => s + (r ? r.score : 0), 0);
  const M = S().modes;
  const going = m => { const sl = m === 'daily' ? d : state[m]; return sl && sl.cur && sl.cur.phase !== 'reveal' && (m !== 'daily' || !d.done); };
  const card = (m, title, desc, primary) => `
    <button type="button" class="${primary ? 'est-pick-daily' : 'est-pick-btn cg-mode'}" data-action="${m}">
      <span class="est-pick-name">${esc(title)}${primary ? ' <span aria-hidden="true">→</span>' : ''}</span>
      <span class="est-pick-sub">${esc(desc)}</span>
    </button>`;
  const isLight = document.documentElement.dataset.theme === 'light';
  return `
    <p class="est-label">${esc(t('chooseTitle'))}</p>
    ${card('daily', fill(M.daily[0], { n: d.no }), d.done ? t('dailyDone', { score: dTotal }) : (going('daily') ? t('continue') + ' ' : '') + M.daily[1], !d.done)}
    <div class="est-pick-grid cg-modes">
      ${card('learn', M.learn[0], (going('learn') ? t('continue') + ' · ' : '') + M.learn[1])}
      ${card('blind', M.blind[0], (going('blind') ? t('continue') + ' · ' : '') + M.blind[1])}
    </div>
    ${d.done ? `<div class="est-row">${btn('daily', t('dailyShow'))}</div>` : ''}
    <div class="est-row">${btn('stats', t('statsBtn'))}${btn('library', t('libraryBtn'))}</div>
    <footer class="est-foot">
      <div class="est-row">${btn('theme', isLight ? t('themeToDark') : t('themeToLight'))}
        <a class="est-link" href="${FEEDBACK_PAGE[lang]}">${esc(t('feedbackLink'))}</a></div>
    </footer>`;
}

function btn(action, label, kind = 'secondary', extra = '') {
  return `<button type="button" class="est-btn est-btn--${kind} ${extra}" data-action="${action}">${esc(label)}</button>`;
}

function renderPlay(cur) {
  const chart = files.get(cur.id);
  const mode = state.mode;
  const M = S().modes;
  const meta = mode === 'daily'
    ? `${fill(M.daily[0], { n: state.daily.no })} · ${t('progress', { i: state.daily.idx + 1, n: DAILY_COUNT })}`
    : M[mode][0];
  const learn = mode === 'learn';
  let top = '';
  if (learn) top = `<p class="est-label">${esc(name(chart.pattern))} ${chart.dir > 0 ? '↑' : '↓'}</p><p class="est-small est-muted cg-explain">${esc(S().explain[chart.pattern])}</p>`;
  // Blind mode runs in two steps; say which one we're on, above the chart, in big type
  if (mode === 'blind' && cur.phase !== 'reveal') {
    const quiz = cur.phase === 'quiz';
    top = `<div class="cg-step">
      <p class="est-label">${esc(t('step', { i: quiz ? 1 : 2, n: 2 }))}</p>
      ${quiz ? '' : quizLine(cur, chart)}
      <p class="est-q">${esc(quiz ? t('stepName') : t('stepDraw'))}</p>
      <p class="est-small est-muted">${esc(quiz ? t('stepNameSub') : (touchFirst() ? t('drawHintTouch') : t('drawHint')))}</p>
    </div>`;
  }
  let below = '';
  if (cur.phase === 'quiz') {
    below = `<div class="cg-quiz">${cur.quiz.options.map(p => `<button type="button" class="est-btn est-btn--secondary" data-action="quiz" data-p="${p}">${esc(name(p))}</button>`).join('')}</div>`;
  } else if (cur.phase === 'draw') {
    below = `
      ${mode === 'blind' ? '' : `<p class="est-small est-muted cg-hint-text">${esc(touchFirst() ? t('drawHintTouch') : t('drawHint'))}</p>`}
      <div class="cg-controls">
        ${btn('undo', t('undo'))}${btn('clear', t('clear'))}
        ${learn ? `<button type="button" class="est-btn est-btn--secondary cg-toggle" data-action="hint" aria-pressed="${!!cur.hint}">${esc(t('hintToggle'))}</button>` : ''}
      </div>
      <p class="est-small est-muted" data-cover></p>
      <button type="button" class="est-btn est-btn--primary est-wide" data-action="submit" data-submit>${esc(t('submit'))}</button>`;
  } else {
    below = renderReveal(cur, chart);
  }
  return `
    <div class="est-meta"><span>${esc(meta)}</span>${btn('menu', t('menu'), 'quiet')}</div>
    ${top}
    <div class="cg-chart"><canvas data-canvas aria-label="${esc(t('drawHint'))}"></canvas></div>
    ${below}`;
}

function quizLine(cur, chart) {
  const ok = cur.quiz.pick === chart.pattern;
  return `<p class="cg-quiz-result ${ok ? 'is-ok' : ''}">${esc(ok ? t('quizRight') : t('quizWrong', { name: nameInline(chart.pattern) }))}</p>`;
}

function decodeReveal(chart) {
  try {
    const bytes = Uint8Array.from(atob(chart.reveal), ch => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) { return null; }
}

function monthYear(iso) {
  const loc = { en: 'en-GB', cs: 'cs-CZ', sk: 'sk-SK' }[lang];
  return new Intl.DateTimeFormat(loc, { month: 'short', year: 'numeric' }).format(new Date(iso + 'T12:00:00'));
}

function renderReveal(cur, chart) {
  const { you, tb, exp, bonus } = cur.result;
  const who = decodeReveal(chart);
  const o = chart.outcome;
  const happened = fill(S().happened[o.result], { day: o.day, pct: pct(o.progress, lang, { digits: 0 }) });
  const last = state.mode === 'daily' && state.daily.idx >= DAILY_COUNT - 1;
  return `
    ${cur.quiz && cur.quiz.pick ? quizLine(cur, chart) : ''}
    <div class="cg-score">
      <p class="est-big">${you.total}<em>/100</em></p>
      <p class="cg-vs">${esc(t('vs', { you: you.total, tb: tb.total }))}${bonus ? ` · <span class="cg-bonus">${esc(t('bonus', { n: bonus }))}</span>` : ''}</p>
      <p class="est-small est-muted">${esc(t('parts', { d: you.direction, t: you.target, s: you.shape }))}</p>
      ${exp ? `<p class="est-small cg-expected">${esc(t('expected', { exp: exp.total }))}</p>` : ''}
    </div>
    <div class="cg-legend est-small">
      <span><i class="cg-key cg-key--you"></i>${esc(t('you'))}</span>
      <span><i class="cg-key cg-key--tb"></i>${esc(t('textbook'))}</span>
      <span><i class="cg-key cg-key--inv"></i>${esc(lang === 'en' ? 'Invalidation' : lang === 'cs' ? 'Neplatnost' : 'Neplatnosť')}</span>
    </div>
    <div class="cg-reveal">
      <p class="est-label">${esc(name(chart.pattern))} ${chart.dir > 0 ? '↑' : '↓'} · <span class="cg-badge cg-badge--${o.result}">${esc(S().outcome[o.result])}</span></p>
      ${who ? `<p class="cg-who">${esc(t('revealWho', { name: who.name, ticker: who.ticker, from: monthYear(who.from), to: monthYear(who.to) }))}</p>` : ''}
      <p>${esc(S().explain[chart.pattern])} ${esc(happened)}</p>
    </div>
    ${btn('next', last ? t('seeResults') : t('next'), 'primary', 'est-wide')}
    <p class="est-small est-muted cg-disclaimer">${esc(t('disclaimer'))}</p>`;
}

/* ---------------------------------------------------------------- the chart + drawing */
function mountChart(cur) {
  const cv = $('[data-canvas]');
  if (!cv) return;
  view = new ChartView(cv, files.get(cur.id), { maxHistory: window.innerWidth < 600 ? 100 : 160 });
  cv.style.touchAction = cur.phase === 'draw' ? 'none' : 'auto';   // no page scroll while drawing
  if (cur.phase === 'reveal') {
    view.scale(true, cur.values);
  }
  redraw(cur.phase === 'reveal' && !reduceMotion() ? 0 : 1);
  controls();
}

function drawOpts(alpha) {
  const cur = slot().cur, chart = files.get(cur.id);
  const o = { fmt: p => pct(p, lang, { signed: true, digits: Math.abs(view.hi - view.lo) < 12 ? 1 : 0 }), guess: cur.values };
  // nothing drawn yet: mark where to start and where to draw
  if (cur.phase === 'draw' && coverage(cur.values) === 0) o.prompt = t('drawHere');
  if (state.mode === 'learn') { o.annotation = 1; o.hint = cur.hint && cur.phase !== 'reveal'; }
  if (cur.phase === 'reveal') {
    o.reveal = alpha;
    o.annotation = alpha;
    o.labels = [[cur.values[HORIZON - 1], t('you'), 'hot'], [chart.target, t('textbook'), 'text']];
  }
  return o;
}

function redraw(alpha = 1) {
  if (view) view.draw(drawOpts(alpha));
}

/** The reveal: real candles, textbook line and annotation fade in over about a second. */
function animateReveal() {
  if (!view || reduceMotion()) return;
  const t0 = performance.now();
  const step = now => {
    const a = Math.min(1, (now - t0) / 1000);
    redraw(a);
    if (a < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function controls() {
  const cur = slot().cur;
  const sub = $('[data-submit]'), cover = $('[data-cover]');
  if (!cur || cur.phase !== 'draw' || !sub) return;
  const c = coverage(cur.values);
  sub.disabled = c < 0.5;
  cover.textContent = c < 0.5 ? `${t('covered', { pct: pct(c * 100, lang, { digits: 0 }) })} · ${t('needMore')}` : t('covered', { pct: pct(c * 100, lang, { digits: 0 }) });
  const undoBtn = $('[data-action="undo"]');
  if (undoBtn) undoBtn.disabled = !cur.undo.length;
  const hb = $('[data-action="hint"]');
  if (hb) hb.setAttribute('aria-pressed', String(!!cur.hint));
}

function pointer(e) {
  const r = view.cv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function onDown(e) {
  const cur = state.view === 'play' && slot().cur;
  if (!cur || cur.phase !== 'draw' || !view || e.target !== view.cv) return;
  const { x, y } = pointer(e);
  const col = view.col(x);
  if (col < 0) return;
  e.preventDefault();
  view.cv.setPointerCapture(e.pointerId);
  cur.undo.push(cur.values.slice());
  if (cur.undo.length > 30) cur.undo.shift();
  const p = view.P(y);
  strokeTo(cur.values, null, null, col, p);
  drawing = { col, p };
  redraw(); controls();
}

function onMove(e) {
  if (!drawing || !view) return;
  const cur = slot().cur;
  const { x, y } = pointer(e);
  const col = Math.max(0, view.col(x));
  const p = view.P(Math.max(view.pad.t, Math.min(view.pad.t + view.plotH, y)));
  strokeTo(cur.values, drawing.col, drawing.p, col, p);
  drawing = { col, p };
  redraw(); controls();
}

function onUp() {
  if (!drawing) return;
  drawing = null;
  persist();                        // auto-save after every stroke
}

/* ---------------------------------------------------------------- daily results, stats, library */
function shareText() {
  const d = state.daily;
  const total = d.results.reduce((s, r) => s + (r ? r.score : 0), 0);
  return t('shareLine', { n: d.no, score: total }) + '\n' + d.results.map(r => (r.up ? '📈' : '📉') + square(r.score)).join(' ');
}

async function copyShare() {
  const text = shareText();
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
    try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e2) { ok = false; }
  }
  copyNote = ok ? 'copied' : 'copyFailed';
  const note = $('#cg-copy-note');
  if (note) note.textContent = t(copyNote);
}

function renderResults() {
  const d = state.daily;
  const total = d.results.reduce((s, r) => s + (r ? r.score : 0), 0);
  return `
    <p class="est-label">${esc(t('resultsTitle', { n: d.no }))}</p>
    <p class="est-big est-total">${total}<em>/500</em></p>
    <ol class="est-results">${d.results.map(r => `
      <li><span class="est-sq ${r.score >= 70 ? 'good' : r.score > 0 ? 'ok' : 'miss'}" aria-hidden="true"></span>
        <span class="est-row-q">${esc(name(r.p))} <span class="est-small est-muted">${r.up ? '↑' : '↓'}</span></span>
        <span class="est-row-score">${r.score}</span></li>`).join('')}</ol>
    <pre class="est-share">${esc(shareText())}</pre>
    ${btn('copy', t('copy'), 'primary', 'est-wide')}
    <p class="est-small est-muted" id="cg-copy-note" aria-live="polite">${copyNote ? esc(t(copyNote)) : ''}</p>
    <div class="est-row">${btn('stats', t('statsBtn'))}${btn('menu', t('menu'))}</div>`;
}

function renderStats() {
  const H = state.history;
  if (!H.length) return `<p class="est-label">${esc(t('statsTitle'))}</p><p class="est-intro">${esc(t('noStats'))}</p><div class="est-row">${btn('menu', t('menu'))}</div>`;
  const avg = Math.round(H.reduce((s, h) => s + h.score, 0) / H.length);
  const beat = Math.round(100 * H.filter(h => h.score > h.tb).length / H.length);
  const rows = PATTERNS.map(p => {
    const hp = H.filter(h => h.p === p);
    if (!hp.length) return '';
    return `<tr><th scope="row">${esc(name(p))}</th><td>${hp.length}</td><td>${pct(100 * hp.filter(h => h.hit).length / hp.length, lang, { digits: 0 })}</td><td>${Math.round(hp.reduce((s, h) => s + h.score, 0) / hp.length)}</td></tr>`;
  }).join('');
  // one line about the whole dataset: the pattern you've played most (or head and shoulders)
  const counts = {}; H.forEach(h => { counts[h.p] = (counts[h.p] || 0) + 1; });
  const focus = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'head_shoulders';
  const ps = index.patterns[focus];
  return `
    <p class="est-label">${esc(t('statsTitle'))}</p>
    <dl class="est-stats">
      <div><dt>${esc(t('statPlayed'))}</dt><dd>${H.length}</dd></div>
      <div><dt>${esc(t('statAvg'))}</dt><dd>${avg}</dd></div>
      <div><dt>${esc(t('statBest'))}</dt><dd>${state.best}</dd></div>
      <div><dt>${esc(t('statBeat'))}</dt><dd>${beat}${lang === 'en' ? '' : '\u00a0'}<em>%</em></dd></div>
    </dl>
    <p class="est-small est-muted">${esc(t('streakNote'))}</p>
    <p class="est-label cg-gap">${esc(t('perPattern'))}</p>
    <table class="cg-table"><thead><tr><th></th><th>${esc(t('colSeen'))}</th><th>${esc(t('colTextbook'))}</th><th>${esc(t('colYou'))}</th></tr></thead><tbody>${rows}</tbody></table>
    ${ps ? `<p class="cg-dataline">${esc(t('dataLine', { n: ps.n, pattern: nameInline(focus), pct: pct(100 * ps.hit / ps.n, lang, { digits: 0 }) }))}</p>` : ''}
    <div class="est-row">${btn('library', t('libraryBtn'))}${btn('menu', t('menu'))}</div>`;
}

function renderLibrary() {
  const unlocked = new Set(state.history.map(h => h.p));
  const dirs = { head_shoulders: 'down', inverse_head_shoulders: 'up', double_top: 'down', double_bottom: 'up', bull_flag: 'up', bear_flag: 'down',
    ascending_triangle: 'up', descending_triangle: 'down', symmetrical_triangle: 'both', cup_handle: 'up' };
  return `
    <p class="est-label">${esc(t('libraryTitle'))}</p>
    <div class="cg-library">${PATTERNS.map(p => {
      const st = index.patterns[p];
      const on = unlocked.has(p);
      return `<section class="cg-lib ${on ? 'is-on' : 'is-locked'}">
        ${diagram(p)}
        <div>
          <h3 class="cg-lib-name">${esc(name(p))}</h3>
          <p class="est-small est-muted">${esc(S()[dirs[p]])}</p>
          <p class="est-small">${esc(S().explain[p])}</p>
          <p class="est-small"><span class="est-muted">${esc(t('targetRule'))}:</span> ${esc(S().rule[p])}</p>
          ${st ? `<p class="est-small est-muted">${esc(t('hitRate', { pct: pct(100 * st.hit / st.n, lang, { digits: 0 }), n: st.n }))}</p>` : ''}
          ${on ? '' : `<p class="est-small cg-locked-note">${esc(t('locked'))}</p>`}
        </div>
      </section>`;
    }).join('')}</div>
    <p class="est-small est-muted cg-disclaimer">${esc(t('disclaimer'))}</p>
    <div class="est-row">${btn('menu', t('menu'))}</div>`;
}

/* ---------------------------------------------------------------- events */
function bindEvents() {
  const hit = (e, sel) => { const el = e.target.closest(sel); return el && root.contains(el) ? el : null; };
  root.addEventListener('click', e => {
    const a = hit(e, '[data-action]');
    if (a && !a.disabled && actions[a.dataset.action]) { actions[a.dataset.action](a); return; }
    const l = hit(e, '.est-lang[data-lang]');
    if (l) setLang(l.dataset.lang);
  });
  root.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (view) { const cur = slot().cur; view.layout(); if (cur.phase === 'reveal') view.scale(true, cur.values); redraw(); } }, 150); });
  // keyboard on desktop: Z = undo, Enter = reveal, then Enter again = next chart
  document.addEventListener('keydown', e => {
    const inside = sel => e.target instanceof Element && e.target.closest(sel);
    if (state.view !== 'play' || inside('input, textarea')) return;
    const cur = slot().cur;
    if (!cur) return;
    if ((e.key === 'z' || e.key === 'Z') && cur.phase === 'draw') actions.undo();
    else if (e.key === 'Enter' && cur.phase === 'draw' && coverage(cur.values) >= 0.5) actions.submit();
    else if (e.key === 'Enter' && cur.phase === 'reveal' && !inside('button, a')) actions.next();
  });
}

if (root) start();
