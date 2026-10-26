'use strict';
// ── PÍRKO · Windowling Hlavolamy ────────────────────────────────────────────
// Na motivy Flappy Bird: ťuknutím ptáček mávne křídly a vyletí nahoru, jinak padá. Proleť co
// nejvíc mezer mezi rourami. Rozložení rour se bere ze semínka, takže denní let je pro všechny
// stejný. Každých 25 bodů se den přehoupne do západu a do noci.
const Pirko = (() => {
  const L = Kit.L, W = 360, H = 640, GY = 560, BX = 104, BR = 15, HIT = 12, PW = 62;
  const DIFFS = [
    { id: 'lehka', name: L('Lehká', 'Easy'), note: L('široké mezery, pomalejší', 'wide gaps, slower'), metric: 'score', gap: 178, speed: 128, move: 0, skin: 'modry' },
    { id: 'klasik', name: L('Klasika', 'Classic'), note: L('jako originál', 'like the original'), metric: 'score', gap: 150, speed: 145, move: 0, skin: 'zluty' },
    { id: 'tezka', name: L('Těžká', 'Hard'), note: L('úzké a pohyblivé roury', 'narrow, moving pipes'), metric: 'score', gap: 138, speed: 160, move: 36, skin: 'cerveny' },
  ];
  const MEDALS = [[40, 'platina'], [30, 'zlato'], [20, 'stribro'], [10, 'bronz']];
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const targetOf = n => Math.min(80, 3 + n + Math.floor(n / 4));
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') { const n = ctx.key, d = n <= 30 ? 'lehka' : n <= 80 ? 'klasik' : 'tezka'; return { seed, mode: d, level: n, target: targetOf(n), text: L(`Úroveň ${n}`, `Level ${n}`) }; }
    if (ctx.kind === 'daily') return { seed, mode: 'klasik', text: L('Denní let', 'Daily flight') };
    return { seed, mode: DIFFS.some(d => d.id === diffId) ? diffId : 'klasik' };
  }

  function create(el, P, saved, api) {
    const D = DIFFS.find(d => d.id === P.mode) || DIFFS[1];
    el.innerHTML = `<div class="pk-wrap"><canvas class="pk-cv"></canvas><p class="pk-keys">${L('Ťukni, klikni nebo mezerník: mávnutí křídly. P pauza', 'Tap, click or Space to flap. P pauses')}</p></div>`;
    const cv = el.querySelector('.pk-cv'), ctx = cv.getContext('2d');
    let cssW = 360, cssH = 640, dpr = 1;
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      cssH = Math.max(380, Math.min(innerHeight - (innerWidth < 760 ? 120 : 160), 820));
      cssW = Math.min(box - 2, cssH * W / H); cssH = cssW * H / W;
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    }
    const LAYERS = [0, 1, 2].map(i => PkArt.layers(i, W, H, GY));

    // ── Stav ──
    const r = rngOf(P.seed), fr = rngOf(P.seed ^ 0x77);
    const bird = { y: H * 0.42, vy: 0, a: 0, wing: 0 };
    const pipes = [], fx = [], pops = [];
    let phase = 'ready', score = 0, scroll = 0, clock = 0, deadT = 0, flash = 0, shake = 0, over = false, paused = false, speed = 1, acc = 0, lastGap = H * 0.45, theme = 0, themeFade = 1, prevTheme = 0, n = 0;
    function addPipe(x) {
      const half = D.gap / 2, lo = half + 70, hi = GY - half - 50;
      let c = lo + r() * (hi - lo);
      c = Math.max(lastGap - 170, Math.min(lastGap + 170, c)); lastGap = c;
      n++;
      pipes.push({ x, c, gap: D.gap, passed: false, gold: n % 10 === 0, ph: r() * 6.28, move: D.move && n > 3 ? D.move * (0.6 + r() * 0.4) : 0 });
    }
    for (let i = 0; i < 4; i++) addPipe(W + 120 + i * 205);
    const gapY = p => p.c + (p.move ? Math.sin(clock * 1.6 + p.ph) * p.move : 0);
    function flap() {
      if (over || paused) return;
      if (phase === 'ready') { phase = 'play'; api.setTimer(true); }
      if (phase !== 'play') return;
      bird.vy = -440; bird.wing = 0;
      api.sound('soft');
      for (let i = 0; i < 2; i++) fx.push({ k: 'f', x: BX - 12, y: bird.y + 4, vx: -60 - fr() * 60, vy: 20 + fr() * 40, a: fr() * 6, va: (fr() - 0.5) * 6, s: 5, c: PkArt.SKINS[D.skin][0], life: 0.8 });
    }
    function die() {
      if (phase !== 'play') return;
      phase = 'dead'; flash = 0.35; shake = 0.35; api.sound('error');
      for (let i = 0; i < 10; i++) fx.push({ k: 'f', x: BX, y: bird.y, vx: (fr() - 0.5) * 260, vy: -fr() * 220, a: fr() * 6, va: (fr() - 0.5) * 10, s: 5 + fr() * 3, c: i % 2 ? PkArt.SKINS[D.skin][0] : PkArt.SKINS[D.skin][2], life: 1.4 });
      bird.vy = Math.min(bird.vy, -200);
    }
    // kruh ptáčka proti obdélníku
    const hitRect = (x0, y0, x1, y1) => { const cx = Math.max(x0, Math.min(x1, BX)), cy = Math.max(y0, Math.min(y1, bird.y)); return (cx - BX) ** 2 + (cy - bird.y) ** 2 < HIT * HIT; };
    function step(dt) {
      clock += dt;
      if (phase === 'ready') { bird.y = H * 0.42 + Math.sin(clock * 5) * 7; bird.wing += dt * 3; scroll += 60 * dt; return; }
      if (phase === 'play') {
        bird.vy = Math.min(620, bird.vy + 1600 * dt); bird.y += bird.vy * dt;
        bird.wing += dt * (bird.vy < 0 ? 9 : 3);
        scroll += D.speed * dt;
        for (const p of pipes) {
          p.x -= D.speed * dt;
          const gy = gapY(p);
          if (!p.passed && p.x + PW / 2 < BX) { p.passed = true; score++; api.sound(p.gold ? 'star' : 'tap'); api.changed && api.changed(); if (p.gold) pops.push({ x: BX, y: bird.y - 30, t: '★ ' + score, life: 1 }); if (score % 25 === 0) { prevTheme = theme; theme = (theme + 1) % 3; themeFade = 0; } const m = MEDALS.find(([s]) => s === score); if (m) pops.push({ x: W / 2, y: H * 0.3, t: L('Medaile!', 'Medal!'), life: 1.2 }); }
          if (hitRect(p.x - 4, -999, p.x + PW + 4, gy - p.gap / 2) || hitRect(p.x - 4, gy + p.gap / 2, p.x + PW + 4, GY)) die();
        }
        if (pipes.length && pipes[0].x < -PW - 10) { pipes.shift(); addPipe(pipes[pipes.length - 1].x + 205); }
        if (bird.y + HIT >= GY) { bird.y = GY - HIT; die(); }
        if (bird.y < -40) bird.y = -40;
      } else if (phase === 'dead') {
        bird.vy = Math.min(700, bird.vy + 1800 * dt); bird.y = Math.min(GY - BR, bird.y + bird.vy * dt);
        deadT += dt; if (deadT > 1.1) finish();
      }
      bird.a = phase === 'dead' ? Math.min(Math.PI / 2, bird.a + dt * 6) : Math.max(-0.45, Math.min(1.3, bird.vy / 520));
      for (let i = fx.length - 1; i >= 0; i--) { const p = fx[i]; p.vy += 300 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt; p.life -= dt; if (p.life <= 0) fx.splice(i, 1); }
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; pops[i].y -= 30 * dt; if (pops[i].life <= 0) pops.splice(i, 1); }
      flash = Math.max(0, flash - dt); shake = Math.max(0, shake - dt); themeFade = Math.min(1, themeFade + dt * 0.8); if (themeFade >= 1) prevTheme = theme;
    }
    const medalOf = s => (MEDALS.find(([m]) => s >= m) || [0, null])[1];
    function finish() {
      if (over) return; over = true; api.setTimer(false);
      if (P.level) {
        if (score < P.target) { api.failed({ score, html: `<p class="k-muted">${L(`Proletěno ${score} z ${P.target}`, `Passed ${score} of ${P.target}`)}</p>` }); return; }
        api.solved({ title: `${score} ${L('rour', 'pipes')}`, stars: score >= P.target * 2 ? 3 : score >= P.target * 1.5 ? 2 : 1, score }); return;
      }
      api.data.best = Math.max(api.data.best || 0, score);
      api.data['best_' + P.mode] = Math.max(api.data['best_' + P.mode] || 0, score);
      const md = medalOf(score), names = { bronz: L('bronzová', 'bronze'), stribro: L('stříbrná', 'silver'), zlato: L('zlatá', 'gold'), platina: L('platinová', 'platinum') };
      api.solved({ title: `${score} ${L('rour', 'pipes')}`, stars: score >= 40 ? 3 : score >= 20 ? 2 : 1, score, html: md ? `<p class="k-muted">${L('Medaile', 'Medal')}: ${names[md]}</p>` : '' });
    }

    // ── Kresba ──
    function drawLayers(Ly, alpha) {
      const g = ctx; g.globalAlpha = alpha;
      g.drawImage(Ly.sky, 0, 0);
      const tile = (img, f, w) => { const o = -((scroll * f) % w); g.drawImage(img, o, 0); g.drawImage(img, o + w, 0); };
      tile(Ly.clouds, 0.15, W * 2); tile(Ly.city, 0.3, W); tile(Ly.bush, 0.6, W);
      g.globalAlpha = 1;
    }
    function draw() {
      const g = ctx, k = cssW / W, sh = shake > 0 ? Math.sin(clock * 80) * 7 * shake : 0;
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      drawLayers(LAYERS[prevTheme], 1); if (themeFade < 1 || theme !== prevTheme) drawLayers(LAYERS[theme], themeFade);
      g.save(); g.translate(sh, 0);
      for (const p of pipes) { const gy = gapY(p); PkArt.pipe(g, p.x, PW, gy - p.gap / 2, true, H, GY, p.gold); PkArt.pipe(g, p.x, PW, gy + p.gap / 2, false, H, GY, p.gold); }
      PkArt.ground(g, W, H, GY, scroll);
      for (const p of fx) PkArt.feather(g, p);
      PkArt.bird(g, BX, bird.y, BR, bird.a, bird.wing, D.skin, phase === 'dead');
      g.restore();
      // skóre a nápisy
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      const txt = (s, x, y, size, col = '#fff', lw = 7) => { g.font = `900 ${size}px Unbounded, sans-serif`; g.lineWidth = lw; g.strokeStyle = PkArt.OL; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };
      if (phase !== 'ready') txt(String(score), W / 2, 70, 46);
      if (P.level && phase !== 'ready') txt(`${L('cíl', 'goal')} ${P.target}`, W / 2, 112, 14, '#fff3c0', 5);
      const md = medalOf(score); if (md && phase === 'play') PkArt.medal(g, W - 34, 48, 13, md);
      if (phase === 'ready') {
        txt('PÍRKO', W / 2, H * 0.2, 44, '#ffe14a', 9);
        txt(P.text || D.name, W / 2, H * 0.27, 16, '#fff', 6);
        const best = P.level ? null : api.data['best_' + P.mode];
        if (P.level) txt(`${L('Proleť', 'Pass')} ${P.target} ${L('rour', 'pipes')}`, W / 2, H * 0.58, 18, '#fff3c0', 6);
        else if (best) txt(`${L('rekord', 'best')} ${best}`, W / 2, H * 0.58, 16, '#fff3c0', 6);
        // ruka a ťuknutí
        const hy = H * 0.68 + Math.sin(clock * 6) * 5;
        g.fillStyle = 'rgba(255,255,255,.9)'; g.strokeStyle = PkArt.OL; g.lineWidth = 2.5;
        g.beginPath(); g.roundRect(W / 2 - 9, hy, 18, 34, 9); g.fill(); g.stroke();
        g.beginPath(); g.roundRect(W / 2 - 22, hy + 22, 44, 34, 12); g.fill(); g.stroke();
        for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(255,255,255,${0.9 - i * 0.25})`; g.lineWidth = 3; g.beginPath(); g.arc(W / 2, hy - 2, 14 + i * 9 + (clock * 20) % 9, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
        txt(L('ŤUKNI', 'TAP'), W / 2, H * 0.68 + 80, 20, '#fff', 6);
      }
      for (const p of pops) { g.globalAlpha = Math.min(1, p.life * 2); txt(p.t, p.x, p.y, 18, '#ffe14a', 5); }
      g.globalAlpha = 1;
      if (paused) { g.fillStyle = 'rgba(10,8,20,.45)'; g.fillRect(0, 0, W, H); txt(L('PAUZA', 'PAUSED'), W / 2, H * 0.45, 30); txt(L('stiskni P', 'press P'), W / 2, H * 0.52, 14, '#fff3c0', 5); }
      if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 2})`; g.fillRect(0, 0, W, H); }
    }

    // ── Smyčka a ovládání ──
    let last = performance.now(), raf = 0, auto = false;
    const DT = 1 / 120;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (api.paused && api.paused() && !paused && !over && phase === 'play') setPause(true);
      if (!paused && !over) { acc += dt * speed; while (acc >= DT) { acc -= DT; if (auto) autopilot(); step(DT); } }
      draw();
    }
    function setPause(on) { if (over || phase !== 'play') return; paused = on; api.setTimer(!on); }
    cv.addEventListener('pointerdown', e => { e.preventDefault(); if (paused) { setPause(false); return; } flap(); });
    // automat pro testy: mávne, když je ptáček pod středem příští mezery a padá
    function autopilot() {
      if (phase === 'ready') { flap(); return; }
      if (phase !== 'play') return;
      const p = pipes.find(q => q.x + PW + 6 > BX - HIT) || pipes[0], ty = gapY(p) + 16;
      if (bird.y > ty && bird.vy > -40) flap();
    }

    fit(); addEventListener('resize', fit);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => null,
      progress: () => (P.level ? Math.min(1, score / P.target) : 0),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); },
      pause() { setPause(true); },
      onKey(e) {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); if (paused) setPause(false); else flap(); }
        else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); setPause(!paused); }
      },
      _state: () => ({ phase, score, y: Math.round(bird.y), over }),
      _flap() { flap(); },
      _auto(on) { auto = on !== false; },
      _speed(n) { speed = Math.max(1, n | 0); },
      _solve() { score = Math.max(score, P.level ? P.target * 2 : 40); phase = 'dead'; finish(); },
    };
  }

  // úvodní obrázek: denní město, roury a ptáček v letu
  function art(el) {
    el.innerHTML = '<canvas width="360" height="360" style="object-fit:contain"></canvas>';
    const g = el.querySelector('canvas').getContext('2d'), Ly = PkArt.layers(0, 360, 640, 560);
    g.beginPath(); g.roundRect(0, 0, 360, 360, 24); g.clip();
    g.save(); g.translate(0, -280); g.drawImage(Ly.sky, 0, 0); g.drawImage(Ly.clouds, -100, 0); g.drawImage(Ly.city, 0, 0); g.drawImage(Ly.bush, 0, 0);
    PkArt.pipe(g, 200, 62, 380, true, 640, 560); PkArt.pipe(g, 200, 62, 530, false, 640, 560);
    PkArt.ground(g, 360, 640, 560, 0); g.restore();
    PkArt.bird(g, 120, 160, 30, -0.3, 0.2, 'zluty');
  }
  return { DIFFS, generate, create, art, targetOf };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'pirko', title: 'PÍRKO',
  tagline: Kit.L('Na motivy Flappy Bird: ťukni a ptáček mávne křídly. Proleť mezerami mezi rourami co nejdál, sbírej medaile a sleduj, jak se den mění v noc.', 'In the spirit of Flappy Bird: tap and the little bird flaps its wings. Fly through the gaps between the pipes as far as you can, earn medals and watch the day turn to night.'),
  diffs: Pirko.DIFFS, generate: Pirko.generate, create: Pirko.create, art: Pirko.art,
  dailyDiff: () => 'klasik',
  levelDiff: n => (n <= 30 ? 'lehka' : n <= 80 ? 'klasik' : 'tezka'),
  rules: Kit.L(`<p>Ťukni na plátno, klikni nebo stiskni mezerník: ptáček mávne křídly a vyletí nahoru. Jinak padá.</p>
    <ul><li>Každá proletěná mezera je bod. Náraz do roury nebo do země končí let.</li>
    <li>Medaile: <b>bronzová</b> za 10, <b>stříbrná</b> za 20, <b>zlatá</b> za 30 a <b>platinová</b> za 40 rour. Každá desátá roura je zlatá.</li>
    <li>Každých 25 bodů se změní denní doba. V <b>Těžké</b> se roury pohybují nahoru a dolů.</li>
    <li>Na <b>Cestě</b> proleť zadaný počet rour. P pozastaví hru.</li></ul>`,
    `<p>Tap the canvas, click or press Space: the bird flaps and rises. Otherwise it falls.</p>
    <ul><li>Every gap you pass is a point. Hitting a pipe or the ground ends the flight.</li>
    <li>Medals: <b>bronze</b> for 10, <b>silver</b> for 20, <b>gold</b> for 30 and <b>platinum</b> for 40 pipes. Every tenth pipe is golden.</li>
    <li>The time of day changes every 25 points. In <b>Hard</b> the pipes move up and down.</li>
    <li>On the <b>Path</b>, pass the given number of pipes. P pauses the game.</li></ul>`),
  achievements: [
    { id: 'p20', name: Kit.L('Stříbrné pírko', 'Silver feather'), desc: Kit.L('Proleť 20 rour', 'Pass 20 pipes'), prog: s => [Math.min(20, (s.data && s.data.best) || 0), 20] },
    { id: 'p50', name: Kit.L('Noční letec', 'Night flyer'), desc: Kit.L('Proleť 50 rour', 'Pass 50 pipes'), prog: s => [Math.min(50, (s.data && s.data.best) || 0), 50] },
    { id: 'p100', name: Kit.L('Nezastavitelný', 'Unstoppable'), desc: Kit.L('Proleť 100 rour', 'Pass 100 pipes'), prog: s => [Math.min(100, (s.data && s.data.best) || 0), 100] },
  ],
});
