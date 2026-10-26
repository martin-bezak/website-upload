/* Martin Bezak — small enhancements for the professional pages.
   Without JavaScript everything is visible, every link works and the
   40h → 5h bar shows its final state. Timings come from DESIGN.md › Motion. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  // 1. Nav bar: scrolls away with the hero (so it never covers the portrait),
  //    then pins to the top once the hero is completely out of view
  var bar = document.getElementById('masthead');
  var hero = document.getElementById('top');
  if (bar && hero && hasIO) {
    new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-fixed', !entries[0].isIntersecting);
    }).observe(hero);
  }

  // 2. Phone menu
  var menuBtn = document.querySelector('.menu-btn');
  var links = document.getElementById('nav-links');
  if (menuBtn && links) {
    function setMenu(open) {
      links.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    }
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
    });
  }

  // 3. Signature: the 40-hour bar empties down to 5 hours, once, when it scrolls into view
  var ratio = document.querySelector('.ratio');
  if (ratio && hasIO && !reduce) {
    ratio.classList.add('is-pre');
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      setTimeout(function () { ratio.classList.remove('is-pre'); }, 250);
      io.disconnect();
    }, { threshold: 0.6 });
    io.observe(ratio);
  }
})();
