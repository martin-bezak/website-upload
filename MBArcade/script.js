/* MB Arcade: motion and small interactions for the home and feedback pages.
   Without JavaScript every element is visible and every link works. */
(function () {
  var html = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Entrance: split PRESS / START into letters that slam in one by one (CSS does the motion)
  var n = 0;
  document.querySelectorAll('[data-split]').forEach(function (el) {
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = el.textContent.split('').map(function (ch) {
      return '<span class="ch" style="--i:' + (n++) + '">' + ch + '</span>';
    }).join('');
  });
  // drop the intro class once it has played, so theme switches etc. never replay it
  setTimeout(function () { html.classList.remove('intro'); }, 2200);

  // 2. Reveal on scroll
  var revealables = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.15 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('in'); });
  }

  // 3. Nav: solid once you scroll, hides while scrolling down, comes back when scrolling up
  var nav = document.querySelector('.nav'), lastY = window.scrollY, ticking = false;
  function onScroll() {
    var y = window.scrollY;
    if (nav) {
      nav.classList.toggle('solid', y > 24);
      nav.classList.toggle('hide', y > lastY && y > 400 && !document.querySelector('.prefs-btn[aria-expanded="true"]'));
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  // 4. Marquee speeds up while the pointer is on it
  var mq = document.querySelector('.marquee .track');
  if (mq && mq.getAnimations && !reduce) {
    var setRate = function (r) { mq.getAnimations().forEach(function (a) { a.playbackRate = r; }); };
    mq.parentNode.addEventListener('mouseenter', function () { setRate(2.5); });
    mq.parentNode.addEventListener('mouseleave', function () { setRate(1); });
  }

  // 5. Game cards: "attract mode" on hover or focus (the score counts up; the chart line draws in CSS)
  document.querySelectorAll('.game-card').forEach(function (card) {
    var num = card.querySelector('[data-count]');
    if (!num || reduce) return;
    var end = +num.getAttribute('data-count'), raf = null;
    function run() {
      cancelAnimationFrame(raf);
      var start = null;
      (function frame(t) {
        if (!start) start = t;
        var p = Math.min((t - start) / 900, 1);
        num.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(frame);
      })(performance.now());
    }
    card.addEventListener('mouseenter', run);
    card.addEventListener('focus', run);
  });

  // 6. The cabinet: Pong that plays itself (computer vs computer, with a real score),
  //    and turns into a game against the computer when you insert a coin. First to 3 wins.
  var coinBtn = document.querySelector('.insert-coin');
  var screen = document.querySelector('.screen');
  if (!coinBtn || !screen) return;

  var help = document.querySelector('.coin-help');
  var label = coinBtn.querySelector('.label');
  var idleText = label.textContent;
  var txt = function (k) { return coinBtn.getAttribute('data-' + k) || ''; };
  var WIN = 3, DEMO_WIN = 5;
  var C = { bg: '#16181D', fg: '#F6F1E8', hot: '#FF5A1F', dim: 'rgba(246,241,232,.28)' };
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  var W, H, dpr, raf = null, last = 0, visible = true;
  var g;                 // game state
  var keys = { up: false, down: false };
  screen.appendChild(canvas);

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = screen.clientWidth; H = screen.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (g) { g.ph = H * 0.22; g.pw = Math.max(6, W * 0.026); g.bs = Math.max(8, W * 0.036); }
  }

  function fresh(demo) {
    return { demo: demo, ph: H * 0.22, pw: Math.max(6, W * 0.026), bs: Math.max(8, W * 0.036),
             ly: H * 0.39, ry: H * 0.39, target: null, errL: 0, errR: 0, s1: 0, s2: 0,
             over: false, msg: demo ? '' : txt('ready'), flash: 0, pop1: 0, pop2: 0, pause: 0 };
  }

  function serve(dir) {
    g.bx = W / 2 - g.bs / 2; g.by = H / 2 - g.bs / 2;
    var speed = W * (g.demo ? 0.55 : 0.48);
    var angle = (Math.random() * 0.8 - 0.4);
    g.vx = Math.cos(angle) * speed * dir; g.vy = Math.sin(angle) * speed;
    g.errL = aimError(); g.errR = aimError();
    g.pause = g.demo ? 0.5 : 0.7;
  }
  // how far off the computer aims: usually close, sometimes far enough to miss (so the demo scores)
  function aimError() { return (Math.random() * 2 - 1) * g.ph * (Math.random() < 0.3 ? 1.4 : 0.5); }

  function startDemo() {
    size();
    g = fresh(true);
    serve(Math.random() < 0.5 ? -1 : 1);
    g.pause = 1.4;   // wait for the screen to power on
    if (reduce) { g.bx = W * 0.6; g.by = H * 0.42; draw(); return; }   // a still frame
    go();
  }

  function startGame() {
    size();
    g = fresh(false);
    serve(Math.random() < 0.5 ? -1 : 1);
    g.pause = 1.1;
    screen.classList.add('playing');
    screen.removeAttribute('aria-hidden');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', txt('game'));
    coinBtn.classList.add('is-playing');
    label.textContent = txt('stop');
    if (help) help.hidden = false;
    go();
  }

  function stopGame() {
    keys.up = keys.down = false;
    screen.classList.remove('playing');
    screen.setAttribute('aria-hidden', 'true');
    canvas.removeAttribute('role'); canvas.removeAttribute('aria-label');
    coinBtn.classList.remove('is-playing');
    label.textContent = idleText;
    if (help) help.hidden = true;
    startDemo();
  }

  function finish(playerWon) {
    g.over = true;
    g.msg = playerWon ? txt('win') : txt('lose');
    screen.classList.remove('playing');   // game over: touches scroll the page again
    coinBtn.classList.remove('is-playing');
    label.textContent = txt('again');
  }

  function go() { last = 0; if (!raf) raf = requestAnimationFrame(loop); }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function computer(y, err, side, speedK, dt) {
    var cSpeed = H * speedK, aim;
    var coming = side < 0 ? (g.vx < 0 && g.bx < W * 0.5) : (g.vx > 0 && g.bx > W * 0.5);
    if (coming) aim = g.by + g.bs / 2 - g.ph / 2 + err;
    else { aim = (H - g.ph) / 2; cSpeed *= 0.5; }
    return clamp(y + clamp(aim - y, -cSpeed * dt, cSpeed * dt), 0, H - g.ph);
  }

  function update(dt) {
    g.flash = Math.max(0, g.flash - dt); g.pop1 = Math.max(0, g.pop1 - dt); g.pop2 = Math.max(0, g.pop2 - dt);
    var maxY = H - g.ph;
    if (g.demo) {
      g.ly = computer(g.ly, g.errL, -1, 0.7, dt);
    } else {
      var pSpeed = H * 1.6;
      if (keys.up) { g.ly -= pSpeed * dt; g.target = null; }
      if (keys.down) { g.ly += pSpeed * dt; g.target = null; }
      if (g.target !== null) g.ly += (g.target - g.ly) * Math.min(1, dt * 18);
      g.ly = clamp(g.ly, 0, maxY);
    }
    // right side: beatable on purpose. Slow, only reacts once the ball is in its half, aims a little off.
    g.ry = computer(g.ry, g.errR, 1, g.demo ? 0.7 : Math.min(0.42 + 0.03 * (g.s1 + g.s2), 0.6), dt);

    if (g.over) return;
    if (g.pause > 0) { g.pause -= dt; if (g.pause <= 0) g.msg = ''; return; }

    g.bx += g.vx * dt; g.by += g.vy * dt;
    if (g.by < 0) { g.by = 0; g.vy = Math.abs(g.vy); }
    if (g.by > H - g.bs) { g.by = H - g.bs; g.vy = -Math.abs(g.vy); }

    var lx = W * 0.06, rx = W - W * 0.06 - g.pw;
    if (g.vx < 0 && g.bx <= lx + g.pw && g.bx + g.bs >= lx && g.by + g.bs >= g.ly && g.by <= g.ly + g.ph) {
      bounce(g.ly, 1); g.bx = lx + g.pw;
    }
    if (g.vx > 0 && g.bx + g.bs >= rx && g.bx <= rx + g.pw && g.by + g.bs >= g.ry && g.by <= g.ry + g.ph) {
      bounce(g.ry, -1); g.bx = rx - g.bs;
    }
    if (g.bx + g.bs < 0) { g.s2++; g.pop2 = 0.4; point(-1, g.s2); }
    if (g.bx > W) { g.s1++; g.pop1 = 0.4; point(1, g.s1); }
  }

  function point(dir, score) {
    if (g.demo) {
      if (score >= DEMO_WIN) { g.s1 = 0; g.s2 = 0; }
      serve(dir);
      return;
    }
    if (score >= WIN) finish(dir === 1); else serve(dir);
  }

  function bounce(py, dir) {
    var hit = ((g.by + g.bs / 2) - (py + g.ph / 2)) / (g.ph / 2);   // -1 .. 1
    var speed = Math.min(Math.hypot(g.vx, g.vy) * 1.05, W * 1.15);
    var angle = hit * 0.9;
    g.vx = Math.cos(angle) * speed * dir; g.vy = Math.sin(angle) * speed;
    g.flash = 0.12;
    if (dir === 1) g.errR = aimError(); else g.errL = aimError();
  }

  function draw() {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (g.flash > 0) { ctx.fillStyle = 'rgba(255,90,31,' + (g.flash * 0.45).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = C.dim;
    for (var y = H * 0.06; y < H * 0.94; y += 16) ctx.fillRect(W / 2 - 1.5, y, 3, 8);
    // score: scales up for a moment when it changes
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var base = H * 0.17;
    ctx.font = '900 ' + Math.round(base * (1 + g.pop1)) + 'px "Big Shoulders Display", sans-serif';
    ctx.fillStyle = C.fg; ctx.fillText(g.s1, W * 0.38, H * 0.06);
    ctx.font = '900 ' + Math.round(base * (1 + g.pop2)) + 'px "Big Shoulders Display", sans-serif';
    ctx.fillStyle = C.hot; ctx.fillText(g.s2, W * 0.62, H * 0.06);
    if (!g.demo) {
      ctx.font = Math.round(H * 0.035) + 'px "JetBrains Mono", monospace';
      ctx.fillStyle = C.dim;
      ctx.fillText(txt('you').toUpperCase(), W * 0.38, H * 0.22);
      ctx.fillText(txt('cpu').toUpperCase(), W * 0.62, H * 0.22);
    }
    ctx.fillStyle = g.flash > 0 && g.vx > 0 ? C.hot : C.fg; ctx.fillRect(W * 0.06, g.ly, g.pw, g.ph);
    ctx.fillStyle = C.hot; ctx.fillRect(W - W * 0.06 - g.pw, g.ry, g.pw, g.ph);
    if (!g.over) { ctx.fillStyle = C.fg; ctx.fillRect(g.bx, g.by, g.bs, g.bs); }
    if (g.msg) {
      ctx.font = '900 ' + Math.round(H * 0.16) + 'px "Big Shoulders Display", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = g.over && g.s1 >= WIN ? C.hot : C.fg;
      ctx.fillText(g.msg.toUpperCase(), W / 2, H * 0.6);
    }
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    var dt = last ? Math.min((t - last) / 1000, 0.033) : 0;
    last = t;
    if (document.hidden || !g) return;
    if (g.demo && !visible) return;   // nobody is watching: save the battery
    update(dt); draw();
  }

  // mouse and touch move the left paddle while playing
  function follow(clientY) {
    var r = screen.getBoundingClientRect();
    g.target = (clientY - r.top) / r.height * H - g.ph / 2;
  }
  canvas.addEventListener('mousemove', function (e) { if (g && !g.demo && !g.over) follow(e.clientY); });
  canvas.addEventListener('touchstart', function (e) { if (g && !g.demo && !g.over) { follow(e.touches[0].clientY); e.preventDefault(); } }, { passive: false });
  canvas.addEventListener('touchmove', function (e) { if (g && !g.demo && !g.over) { follow(e.touches[0].clientY); e.preventDefault(); } }, { passive: false });
  window.addEventListener('resize', function () { size(); if (reduce && g && g.demo) draw(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(screen);
  }

  coinBtn.addEventListener('click', function () {
    if (g && !g.demo && !g.over) stopGame();   // Stop game: back to the demo
    else startGame();                          // Insert coin / Play again
  });
  window.addEventListener('keydown', function (e) {
    if (!g || g.demo || g.over) return;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { keys.up = true; e.preventDefault(); }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { keys.down = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = false;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = false;
  });

  // fonts first, so the score and messages draw in the right faces
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(startDemo);
})();
