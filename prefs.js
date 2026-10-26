/* Martin Bezak — one settings menu for every page: Style, Language, Theme.
   Each page describes itself on <html>:
     data-style="classic" | "bold"
     data-lang="en" | "sk" | "cs"
     data-root="" | "../" | "../../"   (path from this page back to the site root)
   The menu is built into <div data-prefs></div> in the nav. Without JavaScript the footer
   still links to the other languages and the other style. */
(function () {
  var html = document.documentElement;
  var slot = document.querySelector('[data-prefs]');
  if (!slot) return;

  var style = html.getAttribute('data-style') || 'classic';
  var lang = html.getAttribute('data-lang') || 'en';
  var root = html.getAttribute('data-root') || '';
  var page = html.getAttribute('data-page') || 'index.html';   // e.g. feedback.html on the Games side

  var T = {
    en: { open: 'Display settings', style: 'Page', classic: 'Professional', bold: 'Games', language: 'Language', theme: 'Theme', light: 'Light', dark: 'Dark', close: 'Close' },
    sk: { open: 'Nastavenie zobrazenia', style: 'Stránka', classic: 'Profesionálny', bold: 'Hry', language: 'Jazyk', theme: 'Režim', light: 'Svetlý', dark: 'Tmavý', close: 'Zavrieť' },
    cs: { open: 'Nastavení zobrazení', style: 'Stránka', classic: 'Profesionální', bold: 'Hry', language: 'Jazyk', theme: 'Režim', light: 'Světlý', dark: 'Tmavý', close: 'Zavřít' }
  };
  var LANGS = [['en', 'English'], ['sk', 'Slovenčina'], ['cs', 'Čeština']];
  var t = T[lang] || T.en;

  // Section ids that differ between the two styles
  var HASH = { classic: { think: 'lenses' }, bold: { lenses: 'think' } };

  function url(toStyle, toLang) {
    var path = root + (toStyle === 'bold' ? 'bold/' : '') + (toLang === 'en' ? '' : toLang + '/') + (toStyle === style ? page : 'index.html');
    var hash = location.hash.slice(1);
    if (hash) path += '#' + ((HASH[toStyle] || {})[hash] || hash);
    return path;
  }

  // Theme: a saved choice wins; otherwise Classic follows the system and Bold is dark
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  function theme() {
    var saved = html.getAttribute('data-theme');
    if (saved) return saved;
    return style === 'bold' ? 'dark' : (systemDark.matches ? 'dark' : 'light');
  }
  function setTheme(next) {
    html.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncThemeColor();
    render();
  }
  function syncThemeColor() {
    if (style === 'classic') return;   // the professional pages keep their claret theme-color (it matches the nav bar)
    var bg = getComputedStyle(document.body).backgroundColor;
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', bg); m.removeAttribute('media'); });
  }

  // ---- build ----
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'prefs-btn';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'prefs-panel');
  btn.setAttribute('aria-label', t.open);
  slot.appendChild(btn);

  var panel = document.createElement('div');
  panel.className = 'prefs-panel';
  panel.id = 'prefs-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', t.open);
  panel.hidden = true;
  document.body.appendChild(panel);   // outside the nav, so the Bold nav's blend mode doesn't affect it

  function group(label, items) {
    return '<div class="prefs-group"><p class="prefs-label">' + label + '</p><div class="prefs-seg">' + items.join('') + '</div></div>';
  }
  function link(href, text, active, attrs) {
    return active
      ? '<span class="prefs-opt is-active" aria-current="true">' + text + '</span>'
      : '<a class="prefs-opt" href="' + href + '"' + (attrs || '') + '>' + text + '</a>';
  }

  function render() {
    var th = theme();
    btn.innerHTML = '<span class="prefs-code">' + lang.toUpperCase() + '</span><span class="prefs-dot" aria-hidden="true"></span><span class="prefs-aa">Aa</span>';
    panel.innerHTML =
      // MB Arcade is reached from the Projects page now, so the menu no longer switches between pages
      group(t.language, LANGS.map(function (l) {
        return link(url(style, l[0]), l[1], lang === l[0], ' hreflang="' + l[0] + '" lang="' + l[0] + '"');
      })) +
      group(t.theme, [
        '<button type="button" class="prefs-opt' + (th === 'light' ? ' is-active' : '') + '" data-theme-set="light" aria-pressed="' + (th === 'light') + '">' + t.light + '</button>',
        '<button type="button" class="prefs-opt' + (th === 'dark' ? ' is-active' : '') + '" data-theme-set="dark" aria-pressed="' + (th === 'dark') + '">' + t.dark + '</button>'
      ]) +
      '<button type="button" class="prefs-close">' + t.close + ' ×</button>';
  }

  function open() {
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    var first = panel.querySelector('a, button');
    if (first) first.focus();
  }
  function close(returnFocus) {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (returnFocus) btn.focus();
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    panel.hidden ? open() : close(false);
  });
  panel.addEventListener('click', function (e) {
    e.stopPropagation();   // clicks inside the panel never count as "outside"
    var set = e.target.closest('[data-theme-set]');
    if (set) { setTheme(set.getAttribute('data-theme-set')); var again = panel.querySelector('[data-theme-set="' + set.getAttribute('data-theme-set') + '"]'); if (again) again.focus(); return; }
    if (e.target.closest('.prefs-close')) close(true);
    e.stopPropagation();
  });
  document.addEventListener('click', function () { if (!panel.hidden) close(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(true); });
  if (systemDark.addEventListener) systemDark.addEventListener('change', function () { syncThemeColor(); render(); });

  render();
  syncThemeColor();
})();
