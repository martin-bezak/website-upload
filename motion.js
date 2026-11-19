/* Martin Bezak — scroll motion for the home page (homepage-v3 mock).
   The head script only adds .motion when IntersectionObserver exists and the visitor
   has not asked for reduced motion; without it (or without this file) nothing is hidden.
   Only opacity, transform and clip-path animate. Each element animates once. */
(function () {
  var d = document.documentElement;
  if (!d.classList.contains('motion')) return;

  // Which elements get which effect (first match wins). Nothing tagged may sit inside a
  // "wipe": a clipped parent hides its children from the observer.
  var EFFECTS = [
    ['rise', [
      '.hero-name span, .about .statement span, .h2, .stat .fig, .page-title',            // personal site
      '.games .mega, .fb-band .mega',                                                       // MB Arcade (its hero has its own entrance)
      '.founder-h, .doc-grid .h3'                                                           // Bitcoin Lab
    ].join(', ')],
    ['fade', [
      '.hero-tagline, .hero-foot .buttons, .sec-label, .work-head .text-link, .about .prose, .work-arcade, .numbers .h3, .stat .desc, .group > .h3, .row, .skill-group, .beyond-item, .beyond-line, .contact-list li',
      '.project-head .work-meta, .project-head .arcade-lockup, .project-head .lead, .project-head .buttons, .project-note, .game',
      '.games-head, .fb-band p, .fb-band .btn, .founder-inner > *',
      '.r-sec .r-num, .r-intro, .pcard, .founder-in > img, .founder-p, .founder-in .buttons, .ledger, .steps, .arc-item'
    ].join(', ')],
    ['wipe', '.work-btc, .beyond-photo']
  ];
  var pending = new Set();
  EFFECTS.forEach(function (e) {
    document.querySelectorAll(e[1]).forEach(function (el) {
      if (el.dataset.r || el.closest('.rv')) return;   // .rv: MB Arcade's own reveal (game cards)
      el.dataset.r = e[0];
      pending.add(el);
    });
  });
  var counters = Array.prototype.slice.call(document.querySelectorAll('.stat .fig, .figure .num'));
  counters.forEach(function (el) { pending.add(el); });

  // Figures that count up from zero. The final text stays in the page for screen readers;
  // only an aria-hidden copy counts.
  function countUp(el) {
    var m = el.textContent.match(/^(\D*)(\d+)([+%]?)$/);   // a number with at most + or % (not "40h → 5h" or "15 years": a word unit would read "1 years")
    if (!m) return;
    var end = +m[2], start = null;
    var shown = document.createElement('span');
    shown.setAttribute('aria-hidden', 'true');
    var real = document.createElement('span');
    real.className = 'vh';
    real.textContent = el.textContent;
    el.textContent = '';
    el.append(shown, real);
    function step(t) {
      if (start === null) start = t;
      var p = Math.min((t - start) / 900, 1);
      shown.textContent = m[1] + Math.round(end * (1 - Math.pow(1 - p, 3))) + m[3];   // ease out
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = real.textContent;
    }
    requestAnimationFrame(step);
  }

  // Drop the motion attributes: the element is in its normal, unclipped state
  function settle(el) {
    el.removeAttribute('data-r');
    el.classList.remove('is-in');
    el.style.removeProperty('--d');
  }

  // Reveal a batch in page order, 90ms apart (at most 6 steps), so what enters together
  // plays top to bottom and a lone element never waits.
  function reveal(list) {
    list = list.filter(function (el) { return pending.delete(el); });
    list.sort(function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; });
    list.forEach(function (el, i) {
      io.unobserve(el);
      if (counters.indexOf(el) > -1) countUp(el);
      if (!el.dataset.r) return;
      el.style.setProperty('--d', Math.min(i, 6));
      el.classList.add('is-in');
      // Clean up when the longest property ends, or after 2s if no transition runs at all
      // (reduced motion switched on mid-visit, a cancelled transition).
      var last = el.dataset.r === 'wipe' ? 'clip-path' : 'transform';
      var timer = setTimeout(done, 2000);
      function done(ev) {
        if (ev && (ev.target !== el || (ev.type === 'transitionend' && ev.propertyName !== last))) return;
        clearTimeout(timer);
        el.removeEventListener('transitionend', done);
        el.removeEventListener('transitioncancel', done);
        settle(el);
      }
      el.addEventListener('transitionend', done);
      el.addEventListener('transitioncancel', done);
    });
    if (!pending.size) stop();
  }

  var io = new IntersectionObserver(function (entries) {
    // In view, or already scrolled past (reload mid-page, #link jump)
    reveal(entries.filter(function (en) { return en.isIntersecting || en.boundingClientRect.top < 0; })
                  .map(function (en) { return en.target; }));
  });

  // The observer alone is not enough: a "rise" element is clipped to nothing until it animates,
  // which the observer can read as off screen, and a very fast scroll can carry an element past
  // the screen between two checks. So on every scroll or resize frame, show anything whose top
  // is on screen or above it. All positions are read first, then the batch is revealed.
  var queued = false;
  function sweep() {
    queued = false;
    var line = window.innerHeight, hit = [];
    pending.forEach(function (el) { if (el.getBoundingClientRect().top < line) hit.push(el); });
    reveal(hit);
  }
  function onScroll() { if (!queued) { queued = true; requestAnimationFrame(sweep); } }
  function stop() {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    io.disconnect();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', sweep);

  // Keyboard focus never lands on something hidden: finish it at once
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest && e.target.closest('[data-r]');
    if (!el) return;
    if (pending.has(el)) reveal([el]);
    settle(el);
  });

  pending.forEach(function (el) { io.observe(el); });
  window.mbMotion = true;
})();
