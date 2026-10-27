/* Estimate: the game itself. It mounts into any element with [data-estimate]:
     - on the Games page (MBArcade/index.html, cs/, sk/) it is embedded: language and theme follow the page;
     - on games/estimate/index.html it runs full screen ([data-standalone]) with its own language and theme switch.
   State lives in one object that is saved to localStorage after every action (and on every keystroke),
   so closing the tab never loses anything. Both versions share the same saved game. */

import { STRINGS, LANGS, LANG_LABELS, initialLang, fill } from './i18n.js';
import { parseNumber, formatNumber, formatCompact } from './numbers.js';
import { scoreGuess, shareSquare, CLOSE_SCORE } from './scoring.js';
import { todayKey, dailyNumber, dailyIds, DAILY_COUNT } from './daily.js';
import { load, save } from './storage.js';

const STATE_KEY = 'estimate.v1';
const LANG_KEY = 'estimate.lang';
const THEME_KEY = 'theme';            // shared with the rest of the site; raw 'dark' | 'light'
const HISTORY_LIMIT = 2000;
const QUESTIONS_URL = new URL('../questions.json', import.meta.url);
const GAMES_PAGE = { en: '../../index.html#games', cs: '../../cs/index.html#games', sk: '../../sk/index.html#games' };
const FEEDBACK_PAGE = { en: '../../feedback.html', cs: '../../cs/feedback.html', sk: '../../sk/feedback.html' };
const SITE_PAGE = { en: '../../index.html', cs: '../../cs/index.html', sk: '../../sk/index.html' };   // the main Games page

const root = document.querySelector('[data-estimate]');
const standalone = !!root && root.hasAttribute('data-standalone');

let lang = 'en';
let bank = [];
const byId = new Map();
let state = load(STATE_KEY, null);
if (!state || (state.v !== 1 && state.v !== 2)) state = freshState();
if (state.v === 1) migrateV1();
let lastViewKey = '';      // to fade only when the screen really changes
let copyNote = '';
let els;

function freshState() {
  return {
    v: 2,
    view: 'home',          // home | play | results | bankDone
    mode: null,            // daily | endless
    daily: null,
    // count/sum/streak/best/answers describe the current endless game; seen/skipped/level last across games
    endless: { seen: [], skipped: [], level: 'all', currentId: null, phase: 'ask', draft: { value: '' }, last: null,
               count: 0, sum: 0, streak: 0, best: 0, answers: [], lastGame: null },
    history: []            // every answered question, for the record on the menu
  };
}

const t = (key, vars) => fill(STRINGS[lang][key], vars);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isYear = q => q.format === 'year';
const touchFirst = () => matchMedia('(hover: none)').matches;
const $ = sel => root.querySelector(sel);

// v1 asked for a low-high range. Keep the record and the scores, drop the half-typed ranges.
// Old results keep their low/high and are shown as a range (see guessText).
function migrateV1() {
  state.v = 2;
  if (state.endless) state.endless.draft = { value: '' };
  if (state.daily) state.daily.draft = { value: '' };
  state.history.forEach(h => { h.hit = h.score >= CLOSE_SCORE; });
  save(STATE_KEY, state);
}

function commit() { save(STATE_KEY, state); render(); }

/* ---------------- start-up ---------------- */

async function start() {
  // Embedded: the page decides the language. Full screen: saved choice, ?lang=, browser.
  const pageLang = document.documentElement.dataset.lang;
  lang = !standalone && LANGS.includes(pageLang) ? pageLang : initialLang(load(LANG_KEY, null));
  if (standalone) save(LANG_KEY, lang);   // keep this language until the player switches

  root.classList.add('est', standalone ? 'est--page' : 'est--embed');
  root.innerHTML = `
    <div class="est-bar" data-bar>
      <button type="button" class="est-home" data-action="back" data-home>
        <span class="est-logo" aria-hidden="true"><span class="est-logo-mb">MB</span><span class="est-logo-bar"></span></span>
        <span class="est-bar-title" data-title></span>
      </button>
      <span class="est-bar-space"></span>
      ${standalone ? '<div class="est-langs" data-langs role="group"></div>' : ''}
    </div>
    ${standalone
      ? '<div class="est-shell"><div class="est-view" data-view></div><aside class="est-aside" data-aside></aside></div>'
      : '<div class="est-view" data-view></div>'}`;
  els = { view: $('[data-view]'), bar: $('[data-bar]'), title: $('[data-title]'), home: $('[data-home]'), langs: $('[data-langs]'), aside: $('[data-aside]') };

  bindEvents();
  applyLang();
  if (!standalone) calmPageWhileVisible();

  els.view.innerHTML = `<p class="est-muted">${esc(t('loading'))}</p>`;
  try {
    const res = await fetch(QUESTIONS_URL);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    bank = data.questions;
    bank.forEach(q => byId.set(q.id, q));
  } catch (e) {
    els.view.innerHTML = `<p class="est-error">${esc(t('loadError'))}</p>`;
    return;
  }
  repairState();
  state.view = 'home';   // every visit opens on the menu; games in progress continue from there
  save(STATE_KEY, state);
  render();
}

// If the game is ever embedded in a page with moving parts, calm them while the game is on screen (keeps the game screen still)
function calmPageWhileVisible() {
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(([entry]) => {
    document.documentElement.classList.toggle('est-calm', entry.isIntersecting);
  }).observe(root);
}

function isOnScreen(el) {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < innerHeight;
}

// After questions are added or removed, saved ids may point nowhere
function repairState() {
  const e = state.endless;
  e.seen = e.seen.filter(id => byId.has(id));
  if (e.currentId && !byId.has(e.currentId)) { e.currentId = null; e.phase = 'ask'; }
  // A saved "showing the answer" screen without a saved result: show the question again instead
  if (e.phase === 'reveal' && !e.last) e.phase = 'ask';
  const d = state.daily;
  if (d && d.phase === 'reveal' && !d.results[d.idx]) d.phase = 'ask';
  // A daily nobody has answered yet is rebuilt, so it always matches today's pick for everyone
  if (state.daily && !state.daily.results.some(Boolean)) state.daily.ids = dailyIds(bank, state.daily.date);
  if (state.daily && state.daily.ids.some(id => !byId.has(id))) {
    // The bank changed under a saved daily: rebuild today's daily from the new questions
    if (state.mode === 'daily') state.view = 'home';
    state.daily = null;
  }
  // Older saves don't have these fields yet
  e.skipped = e.skipped || []; e.level = e.level || 'all'; e.answers = e.answers || []; e.best = e.best || 0;
  // After a refresh, an endless question you hadn't started typing is swapped for a new random one
  if (e.currentId && e.phase === 'ask' && !(e.draft && e.draft.value)) pickEndless(e.currentId);
  if (state.view === 'play' && !currentQuestion()) state.view = 'home';
}

/* ---------------- modes ---------------- */

function ensureDaily() {
  const today = todayKey();
  if (!state.daily || state.daily.date !== today) {
    state.daily = {
      date: today, no: dailyNumber(today), ids: dailyIds(bank, today),
      idx: 0, phase: 'ask', draft: { value: '' }, results: [], done: false
    };
  }
  return state.daily;
}

function inLevel(q) { const l = state.endless.level || 'all'; return l === 'all' || q.difficulty === l; }

// Picks a random unseen question at the chosen difficulty. `avoid` (the question just shown) is only
// picked again if nothing else is left. Returns false when this difficulty has nothing left.
function pickEndless(avoid) {
  const e = state.endless;
  e.skipped = (e.skipped || []).filter(id => byId.has(id) && !e.seen.includes(id));
  let fresh = bank.filter(q => inLevel(q) && !e.seen.includes(q.id) && !e.skipped.includes(q.id));
  if (fresh.length > 1) fresh = fresh.filter(q => q.id !== avoid);
  // Skipped questions come back only when everything else has been seen, oldest skip first
  const skippedHere = e.skipped.filter(id => inLevel(byId.get(id)));
  if (!fresh.length && !skippedHere.length) { e.currentId = null; return false; }
  e.currentId = fresh.length ? fresh[Math.floor(Math.random() * fresh.length)].id : skippedHere[0];
  e.phase = 'ask';
  e.draft = { value: '' };
  e.last = null;
  return true;
}

function currentQuestion() {
  if (state.mode === 'daily' && state.daily) return byId.get(state.daily.ids[state.daily.idx]);
  if (state.mode === 'endless') return byId.get(state.endless.currentId);
  return null;
}
function currentSlot() { return state.mode === 'daily' ? state.daily : state.endless; }
function currentResult() {
  return state.mode === 'daily' ? state.daily.results[state.daily.idx] : state.endless.last;
}

/* ---------------- actions ---------------- */

const actions = {
  daily() {
    const d = ensureDaily();
    state.mode = 'daily';
    state.view = d.done ? 'results' : 'play';
    commit();
    keepInView();
  },
  endless() {
    state.mode = 'endless';
    if (!state.endless.currentId && !pickEndless()) state.view = 'bankDone';
    else state.view = 'play';
    commit();
    keepInView();
  },
  menu() { state.view = 'home'; commit(); keepInView(); },
  // MB logo: one step back. In a game -> the game's menu; on the menu -> the main Games page
  back() {
    if (state.view === 'home' && standalone) { location.href = SITE_PAGE[lang]; return; }
    actions.menu();
  },
  submit() {
    const q = currentQuestion();
    const slot = currentSlot();
    const guess = parseNumber(slot.draft.value, lang);
    const err = guessError(guess);
    if (err) { showError(err); return; }

    const score = scoreGuess(guess.value, q.answer, { year: isYear(q) });
    const result = { id: q.id, guess: guess.value, score, hit: score >= CLOSE_SCORE };
    state.history.push({ id: q.id, hit: result.hit, score, mode: state.mode, ts: Date.now() });
    if (state.history.length > HISTORY_LIMIT) state.history.shift();

    if (state.mode === 'daily') {
      state.daily.results[state.daily.idx] = result;
    } else {
      const e = state.endless;
      e.last = result;
      e.seen.push(q.id);
      e.count++; e.sum += score;
      e.streak = result.hit ? e.streak + 1 : 0;
      e.best = Math.max(e.best || 0, e.streak);
      (e.answers = e.answers || []).push(result);
    }
    slot.phase = 'reveal';
    commit();
    const next = $('[data-action="next"]');
    if (next) next.focus({ preventScroll: true });
  },
  next() {
    if (state.mode === 'daily') {
      const d = state.daily;
      d.idx++;
      d.phase = 'ask';
      d.draft = { value: '' };
      if (d.idx >= d.ids.length) { d.done = true; d.idx = d.ids.length - 1; state.view = 'results'; }
    } else if (!pickEndless()) {
      state.view = 'bankDone';
    }
    commit();
    keepInView();
    if (!touchFirst()) { const f = $('#est-guess'); if (f) f.focus({ preventScroll: true }); }
  },
  skip() {
    const e = state.endless;
    if (state.mode !== 'endless' || e.phase !== 'ask' || !e.currentId) return;
    e.skipped = (e.skipped || []).filter(id => id !== e.currentId);
    e.skipped.push(e.currentId);
    if (!pickEndless()) state.view = 'bankDone';
    commit();
    keepInView();
    if (!touchFirst()) { const f = $('#est-guess'); if (f) f.focus({ preventScroll: true }); }
  },
  restart() {
    const level = state.endless.level;
    state.endless = freshState().endless;
    state.endless.level = level;
    actions.endless();
  },
  // Endless: keep this game's result to show, and start the next game from zero
  endGame() {
    const e = state.endless;
    e.lastGame = { answers: e.answers || [], count: e.count, sum: e.sum, best: e.best || 0 };
    e.count = 0; e.sum = 0; e.streak = 0; e.best = 0; e.answers = [];
    if (e.phase === 'reveal') pickEndless();
    state.view = 'endlessDone';
    commit();
    keepInView();
  },
  newGame() { actions.endless(); },
  // Menu buttons: Easy / Medium / Hard / Mix start (or continue) endless at that level
  start(el) {
    const e = state.endless;
    const next = el && el.dataset.level;
    if (!['all', 'easy', 'medium', 'hard'].includes(next)) return;
    e.level = next;
    // A question from another level is put back (not counted as seen) and a fitting one is picked
    const q = byId.get(e.currentId);
    if (q && !inLevel(q)) e.currentId = null;
    actions.endless();
  },
  copyEndless() { copyShare(endlessShareText()); },
  theme() {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    syncThemeColor();
    render();
  },
  copy() { copyShare(shareText()); }
};

// After a screen change, bring the top of the game back into view (full screen: top of the page)
function keepInView() {
  if (standalone) { window.scrollTo(0, 0); return; }
  const top = root.getBoundingClientRect().top;
  if (top < 0 || top > innerHeight * 0.5) window.scrollTo(0, top + scrollY - 80);
}

function guessError(g) {
  if (g.status === 'empty') return 'errEmpty';
  if (g.status === 'invalid') return 'errInvalid';
  if (g.value <= 0) return 'errPositive';
  return null;
}

// "391B" for a guess; results saved before the switch to one number were ranges
function guessText(r, year) {
  return r.guess != null ? formatCompact(r.guess, lang, { year })
    : `${formatCompact(r.low, lang, { year })} – ${formatCompact(r.high, lang, { year })}`;
}

function showError(key) {
  const box = $('#est-error');
  if (box) box.textContent = key ? t(key) : '';
}

async function copyShare(text) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
    // Older browsers / blocked clipboard: fall back to a hidden textarea
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch (e2) { ok = false; }
  }
  copyNote = ok ? 'copied' : 'copyFailed';
  const note = $('#est-copy-note');
  if (note) note.textContent = t(copyNote);
}

function endlessShareText() {
  const g = state.endless.lastGame;
  const avg = g && g.count ? Math.round(g.sum / g.count) : 0;
  return t('shareEndless', { n: g ? g.count : 0, avg }) + '\n' + (g ? g.answers.map(r => shareSquare(r.score)).join('') : '');
}

function shareText() {
  const d = state.daily;
  const total = d.results.reduce((s, r) => s + (r ? r.score : 0), 0);
  return t('shareLine', { n: d.no, score: total }) + '\n' + d.results.map(r => shareSquare(r ? r.score : 0)).join('');
}

/* ---------------- language & theme ---------------- */

function applyLang() {
  if (standalone) {
    document.documentElement.lang = lang;
    document.title = t('docTitle');
    els.langs.setAttribute('aria-label', t('langLabel'));
    els.langs.innerHTML = LANGS.map(l =>
      `<button type="button" class="est-lang${l === lang ? ' is-on' : ''}" data-lang="${l}" lang="${l}" aria-pressed="${l === lang}">${LANG_LABELS[l]}</button>`
    ).join('');
    renderAside();
  }
  const name = STRINGS[lang].pageTitle;
  els.title.innerHTML = standalone ? `${esc(name[0])} <em>${esc(name[1])}</em>` : esc(t('appTitle'));
}

// The game page's intro: title, lede, rules and the way back to the Games page
function renderAside() {
  const S = STRINGS[lang];
  els.aside.innerHTML = `
    <p class="est-label">${esc(S.pageEyebrow)}</p>
    <h1 class="est-title">${esc(S.pageTitle[0])} <em>${esc(S.pageTitle[1])}</em></h1>
    <p class="est-lede">${esc(S.pageLede)}</p>
    <ol class="est-rules">${S.pageRules.map(r => `<li>${esc(r)}</li>`).join('')}</ol>
    <a class="est-btn est-btn--secondary" href="${GAMES_PAGE[lang]}">${esc(t('backToGames'))}</a>`;
}

function setLang(next) {
  if (next === lang || !LANGS.includes(next)) return;
  lang = next;
  save(LANG_KEY, lang);
  try {
    const url = new URL(location.href);
    url.searchParams.set('lang', lang);
    history.replaceState(null, '', url);
  } catch (e) {}
  applyLang();
  render();
}

function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && standalone) meta.setAttribute('content', getComputedStyle(document.body).backgroundColor);
}

/* ---------------- rendering ---------------- */

function render() {
  if (!bank.length) return;
  let html, key;
  if (state.view === 'play' && currentQuestion()) {
    const q = currentQuestion();
    html = renderPlay(q);
    key = 'play:' + q.id;
  } else if (state.view === 'results' && state.daily) {
    html = renderResults(); key = 'results';
  } else if (state.view === 'bankDone') {
    html = renderBankDone(); key = 'bankDone';
  } else if (state.view === 'endlessDone') {
    html = renderEndlessDone(); key = 'endlessDone';
  } else {
    state.view = 'home';
    html = renderHome(); key = 'home';
  }
  els.view.innerHTML = html;
  els.home.setAttribute('aria-label', t(state.view === 'home' && standalone ? 'logoLabelSite' : 'logoLabel'));
  if (key !== lastViewKey) {
    // Restart the 150ms fade only when the screen actually changes
    els.view.classList.remove('est-fade');
    void els.view.offsetWidth;
    els.view.classList.add('est-fade');
    lastViewKey = key;
    copyNote = '';
  }
  if (state.view === 'play') updatePreviews();
}

function btn(action, label, kind = 'secondary', extra = '') {
  return `<button type="button" class="est-btn est-btn--${kind} ${extra}" data-action="${action}">${esc(label)}</button>`;
}

// Your record over every answer so far: the average score and how often you were close
function calibrationHtml() {
  const n = state.history.length;
  const head = `<p class="est-label">${esc(t('calibTitle'))}</p>`;
  if (!n) return head + `<p>${esc(t('calibNone'))}</p>`;
  const avg = Math.round(state.history.reduce((s, h) => s + h.score, 0) / n);
  const close = state.history.filter(h => h.score >= CLOSE_SCORE).length;
  return `${head}
    <p class="est-big">${avg}<em>/100</em></p>
    <p>${esc(t('calib', { n, close, min: CLOSE_SCORE }))}</p>`;
}

function renderHome() {
  const d = ensureDaily();
  const e = state.endless;
  const dailyTotal = d.results.reduce((s, r) => s + (r ? r.score : 0), 0);
  const dailyInProgress = !d.done && (d.idx > 0 || d.phase === 'reveal' || !!(d.draft && d.draft.value));
  const dailyAction = d.done ? t('dailyShow') : dailyInProgress ? t('dailyContinue', { i: d.idx + 1 }) : t('dailyStart');
  const avg = e.count ? Math.round(e.sum / e.count) : '–';
  const isLight = document.documentElement.dataset.theme === 'light';

  return `
    <p class="est-label">${esc(t('chooseTitle'))}</p>

    <button type="button" class="est-pick-daily${d.done ? ' is-done' : ''}" data-action="daily">
      <span class="est-pick-top"><span>${esc(t('dailyTitle', { n: d.no }))}</span><span>${esc(t('dailyMixTag'))}</span></span>
      <span class="est-pick-name">${esc(dailyAction)} <span aria-hidden="true">→</span></span>
      <span class="est-pick-sub">${esc(d.done ? t('dailyDone', { score: dailyTotal }) : t('dailyMixDesc'))}</span>
    </button>

    <div class="est-pick-head">
      <p class="est-label">${esc(t('endlessPick'))}</p>
      ${e.count ? `<p class="est-small est-muted">${esc(t('endlessStats', { n: e.count, avg, streak: e.streak }))}</p>` : ''}
    </div>
    ${levelButtons()}

    <section class="est-calib">${calibrationHtml()}</section>

    <footer class="est-foot">
      ${standalone ? `<div class="est-row">${btn('theme', isLight ? t('themeToDark') : t('themeToLight'))}
        <a class="est-link" href="${FEEDBACK_PAGE[lang]}">${esc(t('feedbackLink'))}</a></div>` : ''}
    </footer>`;
}

function renderPlay(q) {
  const slot = currentSlot();
  const meta = state.mode === 'daily'
    ? `${esc(t('modeDaily', { n: state.daily.no }))} · ${esc(t('progress', { i: state.daily.idx + 1, n: state.daily.ids.length || DAILY_COUNT }))}`
    : `${esc(t('modeEndless'))} · ${esc(STRINGS[lang].levels[state.endless.level || 'all'])} · ${esc(t('endlessMeta', { avg: state.endless.count ? Math.round(state.endless.sum / state.endless.count) : '–', streak: state.endless.streak }))}`;
  const unit = isYear(q) ? t('unitYear') : q.unit[lang] ? t('unit', { unit: q.unit[lang] }) : '';

  return `
    <div class="est-meta">
      <span>${meta}</span>
      ${btn('menu', t('menu'), 'quiet')}
    </div>
    ${state.mode === 'daily' ? progressSteps() : ''}
    <p class="est-label">${esc(STRINGS[lang].categories[q.category] || q.category)}${q.difficulty ? ` · ${esc(STRINGS[lang].diff[q.difficulty])}` : ''}</p>
    <h2 class="est-q">${esc(q.question[lang])}</h2>
    ${unit ? `<p class="est-muted est-unit">${esc(unit)}</p>` : '<div class="est-unit"></div>'}
    ${slot.phase === 'reveal' ? renderReveal(q, currentResult()) : renderForm(slot)}
    ${state.mode === 'daily' ? `<div class="est-switch">
      ${btn('endless', t('switchEndless'), 'quiet')}
      <p class="est-small est-muted">${esc(t('switchNote'))}</p>
    </div>` : ''}
    ${state.mode === 'endless' ? `<div class="est-switch">
      ${slot.phase === 'ask' ? `${btn('skip', t('skip'), 'quiet')}
      <p class="est-small est-muted">${esc(t('skipNote'))}</p>` : ''}
      ${btn('endGame', t('endGame'), 'secondary', 'est-endgame')}
    </div>` : ''}`;
}

// Five small bars for the daily: filled by result, outlined = still to come
function progressSteps() {
  const d = state.daily;
  return `<div class="est-steps" aria-hidden="true">${d.ids.map((id, i) => {
    const r = d.results[i];
    const cls = r ? (r.score >= 70 ? 'good' : r.score > 0 ? 'ok' : 'miss') : i === d.idx ? 'now' : '';
    return `<span class="est-step ${cls}"></span>`;
  }).join('')}</div>`;
}

function renderForm(slot) {
  const chips = STRINGS[lang].suffixes.map(([label, text]) =>
    `<button type="button" class="est-chip" data-suffix="${esc(text)}">${esc(label)}</button>`).join('');
  return `
    <form class="est-form" id="est-form" novalidate>
      ${field('guess', t('guessLabel'), slot.draft.value || '')}
      <div class="est-chips" role="group" aria-label="${esc(t('suffixHint'))}">${chips}</div>
      <p class="est-error" id="est-error" role="alert"></p>
      <button type="submit" class="est-btn est-btn--primary est-wide">${esc(t('submit'))}</button>
    </form>`;
}

function field(name, label, value) {
  return `
    <div class="est-field">
      <label for="est-${name}" class="est-label">${esc(label)}</label>
      <input id="est-${name}" name="${name}" type="text" inputmode="decimal" autocomplete="off" autocorrect="off"
             spellcheck="false" enterkeyhint="done"
             placeholder="${esc(t('placeholder'))}" value="${esc(value)}" aria-describedby="est-p-${name}">
      <p class="est-parsed" id="est-p-${name}"></p>
    </div>`;
}

function updatePreviews() {
  const q = currentQuestion();
  const input = $('#est-guess'), out = $('#est-p-guess');
  if (!input || !out) return;
  const r = parseNumber(input.value, lang);
  out.textContent = r.status === 'ok' ? '= ' + formatNumber(r.value, lang, { year: isYear(q) })
    : r.status === 'invalid' ? t('parsedInvalid') : '';
  out.classList.toggle('bad', r.status === 'invalid');
}

function renderReveal(q, r) {
  const year = isYear(q);
  const full = formatNumber(q.answer, lang, { year });
  // Big numbers are shown short in the headline ("391B") and in full underneath
  const big = !year && q.answer >= 1e6 ? formatCompact(q.answer, lang) : full;
  const unit = year ? '' : esc(q.unit[lang]);
  const last = state.mode === 'daily' && state.daily.idx >= state.daily.ids.length - 1;
  return `
    <div class="est-reveal">
      <div class="est-answer-row">
        <div>
          <p class="est-label">${esc(t('answer'))}</p>
          <p class="est-answer">${esc(big)}${unit ? ` <span class="est-answer-unit">${unit}</span>` : ''}</p>
          ${big !== full ? `<p class="est-small est-muted">${esc(full)} ${unit}</p>` : ''}
        </div>
        <div class="est-score ${r.hit ? 'is-hit' : 'is-miss'}">
          <span class="est-score-n">${r.score}</span>
          <span class="est-small">${esc(offText(r, q))}</span>
        </div>
      </div>
      ${r.guess != null ? barHtml(r.guess, q.answer, year, r.hit) : ''}
      <p class="est-small">${esc(t('yourGuess', { guess: guessText(r, year) }))}</p>
      <p class="est-small est-source">
        <a class="est-link" href="${esc(q.source.url)}" target="_blank" rel="noopener">${esc(t('source', { name: q.source.name }))}</a>
        ${q.year ? `<br><span class="est-muted">${esc(t('asOf', { year: q.year }))}</span>` : ''}
      </p>
      ${btn('next', last ? t('seeResults') : t('next'), 'primary', 'est-wide')}
    </div>`;
}

// "2.3× too high", "15 % too low", "4 years too early", "exact"
function offText(r, q) {
  if (r.guess == null) return '';
  const a = q.answer, g = r.guess;
  if (isYear(q)) {
    const d = Math.round(g - a);
    const n = Math.abs(d), w = STRINGS[lang].yearWords;
    // 1 year / 2-4 years / 5+ years (Czech and Slovak have three forms)
    const years = n === 1 ? w[0] : n >= 2 && n <= 4 ? w[1] : w[2];
    return d === 0 ? t('offExact') : t(d > 0 ? 'offLate' : 'offEarly', { n, years });
  }
  const ratio = g / a;
  if (Math.abs(ratio - 1) < 0.005) return t('offExact');
  const high = ratio > 1, k = high ? ratio : 1 / ratio;
  // under 2× off, say it in % of the answer; beyond that, as a multiple
  if (k >= 2) return t(high ? 'offHighX' : 'offLowX', { amount: (k >= 1000 ? formatCompact(k, lang) : formatNumber(Math.round(k * (k < 10 ? 10 : 1)) / (k < 10 ? 10 : 1), lang)) + '×' });
  const p = formatNumber(Math.round(Math.abs(ratio - 1) * 100), lang) + (lang === 'en' ? '%' : ' %');
  return t(high ? 'offHigh' : 'offLow', { amount: p });
}

/* Your guess and the answer on one track, log scale (linear for years). Positions are percentages. */
function barHtml(guess, answer, year, hit) {
  const lo = Math.min(guess, answer), hi = Math.max(guess, answer);
  let f, min, max;
  if (year) {
    const pad = Math.max(hi - lo, 10) * 0.25;
    f = x => x; min = lo - pad; max = hi + pad;
  } else {
    const span = Math.log10(hi / lo);
    const pad = Math.max(span * 0.25, 0.15);
    f = Math.log10; min = Math.log10(lo) - pad; max = Math.log10(hi) + pad;
  }
  const pos = x => ((f(x) - min) / (max - min)) * 100;
  const g = pos(guess), a = pos(answer);
  const left = Math.min(g, a), width = Math.max(Math.abs(a - g), 0.8);   // the gap between them
  const labelPos = Math.min(Math.max(a, 12), 88); // keep the label inside the track on narrow screens
  return `
    <div class="est-rbar ${hit ? '' : 'is-miss'}" aria-hidden="true">
      <span class="est-rbar-label" style="left:${labelPos}%">${esc(formatCompact(answer, lang, { year }))}</span>
      <div class="est-rbar-track">
        <span class="est-rbar-range" style="left:${left}%;width:${width}%"></span>
        <span class="est-rbar-guess" style="left:${g}%"></span>
        <span class="est-rbar-mark" style="left:${a}%"></span>
      </div>
      <span class="est-rbar-scale">${esc(year ? t('linearScale') : t('logScale'))}</span>
    </div>`;
}

function renderResults() {
  const d = state.daily;
  const total = d.results.reduce((s, r) => s + (r ? r.score : 0), 0);
  const rows = d.ids.map((id, i) => {
    const q = byId.get(id), r = d.results[i];
    if (!q || !r) return '';
    const year = isYear(q);
    return `
      <li>
        <span class="est-sq ${r.score >= 70 ? 'good' : r.score > 0 ? 'ok' : 'miss'}" aria-hidden="true"></span>
        <span class="est-row-q">${esc(q.question[lang])}
          <span class="est-small est-muted">${esc(guessText(r, year))} → ${esc(formatCompact(q.answer, lang, { year }))}</span>
        </span>
        <span class="est-row-score">${r.score}</span>
      </li>`;
  }).join('');
  return `
    <p class="est-label">${esc(t('resultsTitle', { n: d.no }))}</p>
    <p class="est-big est-total">${total}<em>/500</em></p>
    <ol class="est-results">${rows}</ol>
    <pre class="est-share">${esc(shareText())}</pre>
    ${btn('copy', t('copy'), 'primary', 'est-wide')}
    <p class="est-small est-muted" id="est-copy-note" aria-live="polite">${copyNote ? esc(t(copyNote)) : ''}</p>
    <section class="est-calib">${calibrationHtml()}</section>
    <div class="est-row">${btn('endless', t('playEndless'))}${btn('menu', t('menu'))}</div>`;
}

// Endless levels as big buttons: Easy / Medium / Hard / Mix, with how many unseen questions are left
function levelButtons() {
  const S = STRINGS[lang], e = state.endless;
  const current = byId.get(e.currentId);
  return `<div class="est-pick-grid">${['easy', 'medium', 'hard', 'all'].map(l => {
    const left = bank.filter(q => (l === 'all' || q.difficulty === l) && !e.seen.includes(q.id)).length;
    const going = state.mode === 'endless' && current && e.level === l;
    return `<button type="button" class="est-pick-btn${going ? ' is-going' : ''}" data-action="start" data-level="${l}">
      <span class="est-pick-name">${esc(S.levels[l])}</span>
      <span class="est-pick-sub">${esc(going ? t('inProgress') : t('left', { n: left }))}</span>
    </button>`;
  }).join('')}</div>`;
}

function renderEndlessDone() {
  const g = state.endless.lastGame || { answers: [], count: 0, sum: 0, best: 0 };
  const avg = g.count ? Math.round(g.sum / g.count) : 0;
  const hits = g.answers.filter(r => r.hit).length;
  const pct = g.count ? Math.round((hits / g.count) * 100) : 0;
  const rows = g.answers.map(r => {
    const q = byId.get(r.id);
    if (!q) return '';
    const year = isYear(q);
    return `
      <li>
        <span class="est-sq ${r.score >= 70 ? 'good' : r.score > 0 ? 'ok' : 'miss'}" aria-hidden="true"></span>
        <span class="est-row-q">${esc(q.question[lang])}
          <span class="est-small est-muted">${esc(guessText(r, year))} → ${esc(formatCompact(q.answer, lang, { year }))}</span>
        </span>
        <span class="est-row-score">${r.score}</span>
      </li>`;
  }).join('');
  return `
    <p class="est-label">${esc(t('endTitle'))}</p>
    ${g.count ? `
      <p class="est-big est-total">${avg}<em>/100</em></p>
      <p class="est-muted">${esc(t('endAvg'))}</p>
      <dl class="est-stats">
        <div><dt>${esc(t('statAnswered'))}</dt><dd>${g.count}</dd></div>
        <div><dt>${esc(t('statTotal'))}</dt><dd>${g.sum}</dd></div>
        <div><dt>${esc(t('statHits'))}</dt><dd>${pct}<em>%</em></dd></div>
        <div><dt>${esc(t('statBest'))}</dt><dd>${g.best}</dd></div>
      </dl>
      <ol class="est-results">${rows}</ol>
      <pre class="est-share">${esc(endlessShareText())}</pre>
      ${btn('copyEndless', t('copy'), 'secondary', 'est-wide')}
      <p class="est-small est-muted" id="est-copy-note" aria-live="polite">${copyNote ? esc(t(copyNote)) : ''}</p>`
    : `<p class="est-intro">${esc(t('endNone'))}</p>`}
    <div class="est-row">${btn('newGame', t('newGame'), 'primary')}${btn('menu', t('menu'))}</div>`;
}

function renderBankDone() {
  return `
    <p class="est-intro">${esc(t('bankDone', { n: bank.filter(inLevel).length }))}</p>
    ${levelButtons()}
    <div class="est-row">${btn('restart', t('restart'), 'primary')}${btn('menu', t('menu'))}</div>
    <section class="est-calib">${calibrationHtml()}</section>`;
}

/* ---------------- events (delegated to the game root, so the rest of the page is untouched) ---------------- */

function bindEvents() {
  // Only look at elements inside the game: on the Games page <html> itself carries data-lang,
  // which used to swallow every click (including the suffix chips)
  const hit = (e, sel) => { const el = e.target.closest(sel); return el && root.contains(el) ? el : null; };

  root.addEventListener('click', e => {
    const s = hit(e, '[data-suffix]');
    if (s) { applySuffix(s.dataset.suffix); return; }
    const a = hit(e, '[data-action]');
    if (a && actions[a.dataset.action]) { actions[a.dataset.action](a); return; }
    const l = hit(e, '.est-lang[data-lang]');
    if (l) setLang(l.dataset.lang);
  });

  // Keep the keyboard open: tapping a chip must not steal focus from the input
  root.addEventListener('pointerdown', e => { if (hit(e, '[data-suffix]')) e.preventDefault(); });

  root.addEventListener('submit', e => {
    if (e.target.id !== 'est-form') return;
    e.preventDefault();
    actions.submit();
  });

  root.addEventListener('input', e => {
    if (!e.target.matches('#est-guess')) return;
    currentSlot().draft = { value: e.target.value };
    save(STATE_KEY, state);
    showError(null);
    updatePreviews();
  });
}

// Swap the suffix at the end of the input: "5" -> "5k", "5k" -> "5m", "5k" + k -> "5"
function applySuffix(suffix) {
  const input = $('#est-guess');
  if (!input) return;
  const m = input.value.trim().match(/^(.*?)\s*(\p{L}[\p{L}.]*)?$/u);
  const base = m[1], current = m[2] || '';
  const same = current.replace(/\.$/, '').toLowerCase() === suffix.replace(/\.$/, '').toLowerCase();
  const sep = lang === 'en' ? '' : ' ';
  input.value = same || !base ? base : base + sep + suffix;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// Start last, so every helper above is defined first
if (root) start();
