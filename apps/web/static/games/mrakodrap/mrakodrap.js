'use strict';
// ── MRAKODRAP · Windowling Hlavolamy ────────────────────────────────────────
// Na motivy Tower Bloxx: jeřáb houpe patrem, ťuknutím ho pustíš a stavíš věž. Patro musí
// dopadnout na to předchozí; přesné položení (PERFEKTNÍ) dává víc obyvatel a zklidní houpání
// věže, nepřesné ji rozkývá víc. Tři patra smíš upustit. Houpání jeřábu i vítr se berou ze
// semínka, takže denní stavba je pro všechny stejná.
const Mrakodrap = (() => {
  const L = Kit.L, W = 360, H = 640, GY = 560, FH = 48, PX = W / 2, PY = 96;
  const DIFFS = [
    { id: 'lehka', name: L('Lehká', 'Easy'), note: L('široká patra, klidný jeřáb', 'wide floors, calm crane'), metric: 'score', bw: 124, tol: 7, swing: 1.8, wind: 0 },
    { id: 'klasik', name: L('Klasika', 'Classic'), note: L('jako originál', 'like the original'), metric: 'score', bw: 108, tol: 5, swing: 2.2, wind: 0 },
    { id: 'tezka', name: L('Těžká', 'Hard'), note: L('užší patra a vítr', 'narrower floors and wind'), metric: 'score', bw: 96, tol: 4, swing: 2.6, wind: 70 },
  ];
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const targetOf = n => Math.min(80, 6 + n + Math.floor(n / 3));
  const levelMode = n => (n <= 30 ? 'lehka' : n <= 80 ? 'klasik' : 'tezka');
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') { const n = ctx.key; return { seed, mode: levelMode(n), level: n, target: targetOf(n), text: L(`Úroveň ${n}`, `Level ${n}`) }; }
    if (ctx.kind === 'daily') return { seed, mode: 'klasik', text: L('Denní stavba', 'Daily build') };
    return { seed, mode: DIFFS.some(d => d.id === diffId) ? diffId : 'klasik' };
  }

  function create(el, P, saved, api) {
    const D = DIFFS.find(d => d.id === P.mode) || DIFFS[1];
    el.innerHTML = `<div class="md-wrap"><canvas class="md-cv"></canvas><p class="md-keys">${L('Ťukni, klikni nebo mezerník: pustit patro. P pauza', 'Tap, click or Space to drop the floor. P pauses')}</p></div>`;
    const cv = el.querySelector('.md-cv'), ctx = cv.getContext('2d', { alpha: false });
    let cssW = 360, cssH = 640, dpr = 1;
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      cssH = Math.max(380, Math.min(innerHeight - (innerWidth < 760 ? 120 : 160), 820));
      cssW = Math.min(box - 2, cssH * W / H); cssH = cssW * H / W;
      dpr = Math.min(1.5, devicePixelRatio || 1);
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    }

    // ── Stav ──
    const r = rngOf(P.seed), fr = rngOf(P.seed ^ 0x51);
    const floors = [{ off: 0 }];   // přízemí stojí od začátku
    let cum = 0, swayA = 0, swayPh = 0, cam = 0, camX = 0, pivotX = PX, clock = 0, score = 0, perfects = 0, combo = 0, best = 0, lives = 3;
    let phase = 'ready', over = false, paused = false, speed = 1, acc = 0, auto = false, wait = 0, endT = 0, shake = 0;
    let hook = null, fall = null;
    const debris = [], pops = [], dust = [];
    let wind = 0;
    function newHook() {
      const n = floors.length;
      if (D.wind && n % 8 === 1) wind = (r() * 2 - 1) * D.wind;
      hook = { th: 0, max: 0.42 + r() * 0.3, w: D.swing * (1 + Math.min(0.55, n * 0.011)) * (0.9 + r() * 0.2), len: 140 + r() * 46, t: r() * 6.28 };
    }
    newHook();
    const towerTop = () => GY - floors.length * FH;               // spodní hrana dalšího patra (svět)
    const swayAt = (i, ph = swayPh) => (floors.length > 1 ? swayA * Math.sin(ph) * Math.pow(i / (floors.length - 1), 1.4) : 0);
    function floorX(i, ph) { let x = PX; for (let k = 1; k <= i; k++) x += floors[k].off; return x + swayAt(i, ph); }
    const topX = ph => PX + cum + swayAt(floors.length - 1, ph);
    // hák a visící patro (souřadnice světa)
    function hookPos(h = hook) {
      const th = h.max * Math.sin(h.t), py = PY - cam;
      return { x: pivotX + h.len * Math.sin(th), y: py + h.len * Math.cos(th), vx: h.len * Math.cos(th) * h.max * Math.cos(h.t) * h.w, vy: -h.len * Math.sin(th) * h.max * Math.cos(h.t) * h.w };
    }

    // ── Hraní ──
    function drop() {
      if (over || paused || fall || !hook || wait > 0 || phase === 'end') return;
      if (phase === 'ready') { phase = 'play'; api.setTimer(true); }
      const p = hookPos();
      fall = { x: p.x, y: p.y + 6 + FH, vx: p.vx * 0.85, vy: Math.max(0, p.vy * 0.5), ang: 0, va: 0, i: floors.length };
      hook = null;
      api.sound('soft');
    }
    // jeden krok pádu; vrací 'land' | 'miss' | null (pro automat se počítá i nanečisto)
    function fallStep(f, dt, ph) {
      f.vy += 1500 * dt; f.vx += wind * dt; f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.y >= towerTop() && f.y - f.vy * dt < towerTop() + 1) {
        const dx = f.x - topX(ph), bw = D.bw;
        if (Math.abs(dx) <= bw * 0.58) return 'land';
        if (Math.abs(dx) <= bw * 1.05) return 'edge';
      }
      if (f.y + cam > H + 120) return 'gone';
      return null;
    }
    function land(dx) {
      const perfect = Math.abs(dx) <= D.tol;
      floors.push({ off: perfect ? 0 : dx });
      cum += perfect ? 0 : dx;
      const n = floors.length - 1;
      let gain = 10;
      if (perfect) {
        combo++; perfects++; best = Math.max(best, combo);
        gain = 20 + 10 * Math.min(combo, 5);
        swayA *= 0.55;
        for (let i = pops.length - 1; i >= 0; i--) if (pops[i].big) pops.splice(i, 1);
        pops.push({ t: combo > 1 ? `${L('PERFEKTNÍ', 'PERFECT')} ×${combo}` : L('PERFEKTNÍ!', 'PERFECT!'), x: W / 2, y: 0, life: 1.2, big: true });
        api.sound(combo >= 3 ? 'line' : 'star');
      } else {
        combo = 0;
        swayA = Math.min(46, swayA + Math.abs(dx) * 0.12 + 0.8);
        api.sound('place');
      }
      score += gain;
      pops.push({ t: '+' + gain, x: topX() + 40 - camX, y: towerTop() + FH * 0.5 + cam, life: 0.9 });
      for (let k = 0; k < 8; k++) dust.push({ x: topX() + (fr() - 0.5) * D.bw, y: towerTop() + FH, vx: (fr() - 0.5) * 120, vy: -fr() * 60, life: 0.5 + fr() * 0.3 });
      shake = perfect ? 0.08 : 0.15;
      api.changed && api.changed();
      if (P.level && n >= P.target) { phase = 'end'; endT = 0; api.sound('win'); return; }
      wait = 0.35;
    }
    function lose(f, edge) {
      lives--; combo = 0; shake = 0.3;
      debris.push({ x: f.x, y: f.y, vx: f.vx + (edge ? Math.sign(f.x - topX()) * 90 : 0), vy: f.vy * 0.4, ang: 0, va: edge ? Math.sign(f.x - topX()) * 4 : (fr() - 0.5) * 2, i: f.i, life: 2.2 });
      api.sound('error');
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].big) pops.splice(i, 1);
      pops.push({ t: L('Spadlo!', 'Dropped!'), x: W / 2, y: 0, life: 1, big: true, bad: true });
      if (lives <= 0) { phase = 'end'; endT = 0; return; }
      wait = 0.6;
    }
    function step(dt) {
      clock += dt;
      swayPh += dt * (1.3 + Math.min(1, floors.length * 0.012));
      if (hook) hook.t += dt * hook.w;
      if (fall) {
        const res = fallStep(fall, dt);
        if (res === 'land') { const dx = fall.x - topX(); fall = null; land(dx); }
        else if (res === 'edge') { const f = fall; fall = null; lose(f, true); }
        else if (res === 'gone') { const f = fall; fall = null; lose(f, false); }
      }
      if (wait > 0) { wait -= dt; if (wait <= 0 && phase !== 'end') newHook(); }
      // kamera drží vršek věže zhruba v polovině
      const want = Math.max(0, (floors.length - 1) * FH - 112);
      cam += (want - cam) * Math.min(1, dt * 2.5);
      // jeřáb jezdí nad vrškem věže, kamera ho napůl sleduje i do stran
      if (!fall) pivotX += (PX + cum - pivotX) * Math.min(1, dt * 2);
      camX += (cum * 0.7 - camX) * Math.min(1, dt * 2);
      for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.vy += 1500 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.ang += d.va * dt; d.life -= dt; if (d.life <= 0) debris.splice(i, 1); }
      for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i]; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; if (d.life <= 0) dust.splice(i, 1); }
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; if (pops[i].life <= 0) pops.splice(i, 1); }
      shake = Math.max(0, shake - dt);
      if (phase === 'end') { endT += dt; if (endT > 1.3) finish(); }
    }
    function finish() {
      if (over) return; over = true; api.setTimer(false);
      const n = floors.length - 1;
      if (P.level) {
        if (n < P.target) { api.failed({ score, html: `<p class="k-muted">${L(`Postaveno ${n} z ${P.target} pater`, `Built ${n} of ${P.target} floors`)}</p>` }); return; }
        api.solved({ title: `${n} ${L('pater', 'floors')}`, stars: lives >= 3 ? 3 : lives === 2 ? 2 : 1, score }); return;
      }
      api.data.best = Math.max(api.data.best || 0, score);
      api.data['best_' + P.mode] = Math.max(api.data['best_' + P.mode] || 0, score);
      api.data.floors = Math.max(api.data.floors || 0, n);
      api.data.combo = Math.max(api.data.combo || 0, best);
      api.solved({ title: `${score} ${L('obyvatel', 'residents')}`, stars: n >= 40 ? 3 : n >= 20 ? 2 : 1, score, html: `<p class="k-muted">${L(`${n} pater · ${perfects}× perfektně`, `${n} floors · ${perfects} perfect`)}</p>` });
    }

    // ── Kresba ──
    function draw() {
      const g = ctx, k = cssW / W, n = floors.length - 1, h = n / 22, sh = shake > 0 ? Math.sin(clock * 90) * 5 * shake : 0;
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      MdArt.sky(g, W, H, h);
      MdArt.stars(g, W, H, Math.max(0, Math.min(1, h - 1.6)), cam);
      if (h < 1.8) { const a = 0.85 * (1 - Math.max(0, h - 1)); for (let i = 0; i < 5; i++) MdArt.cloud(g, ((i * 130 + clock * (8 + i * 3)) % (W + 160)) - 100, ((i * 170 + cam * 0.35) % (H + 120)) - 60, 0.8 + (i % 3) * 0.25, a); }
      g.save(); g.translate(sh - camX, cam);
      MdArt.city(g, W, GY, h > 1.5);
      MdArt.ground(g, W, GY, H);
      // věž: kreslí se jen viditelná patra
      for (let i = 0; i <= n; i++) {
        const y = GY - i * FH;
        if (y + cam < -FH || y - FH + cam > H + FH) continue;
        MdArt.floor(g, floorX(i), y, D.bw, FH, i, h > 1.4);
      }
      if (n > 0) MdArt.roof(g, floorX(n), GY - (n + 1) * FH, D.bw, n);
      for (const d of dust) { g.fillStyle = `rgba(230,220,200,${d.life * 1.4})`; g.beginPath(); g.arc(d.x, d.y, 4, 0, 7); g.fill(); }
      if (fall) MdArt.floor(g, fall.x, fall.y, D.bw, FH, fall.i, h > 1.4, fall.ang);
      for (const d of debris) { g.globalAlpha = Math.min(1, d.life); MdArt.floor(g, d.x, d.y, D.bw, FH, d.i, false, d.ang); g.globalAlpha = 1; }
      g.restore();
      // jeřáb s visícím patrem
      if (hook) {
        const p = hookPos();
        MdArt.crane(g, W, pivotX - camX, PY, p.x - camX, p.y + cam);
        g.save(); g.translate(p.x - camX, p.y + cam); g.rotate(-hook.max * Math.sin(hook.t) * 0.12);
        MdArt.floor(g, 0, 6 + FH, D.bw, FH, floors.length, h > 1.4);
        g.strokeStyle = '#2e2f35'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(-D.bw / 2 + 8, 6); g.moveTo(0, 0); g.lineTo(D.bw / 2 - 8, 6); g.stroke();
        g.restore();
      } else MdArt.crane(g, W, pivotX - camX, PY, pivotX - camX, PY + 40);
      // nápisy
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      const txt = (s, x, y, size, col = '#fff', lw = 6) => { g.font = `900 ${size}px Unbounded, sans-serif`; g.lineWidth = lw; g.strokeStyle = MdArt.OL; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };
      txt(String(score), W / 2, 30, 30);
      g.font = '700 13px "Space Grotesk", sans-serif'; g.fillStyle = '#fff'; g.lineWidth = 4; g.strokeStyle = MdArt.OL;
      const info = `${n} ${L('pater', 'floors')}${P.level ? ` / ${P.target}` : ''}`;
      g.strokeText(info, W / 2, 58); g.fillText(info, W / 2, 58);
      for (let i = 0; i < 3; i++) { g.globalAlpha = i < lives ? 1 : 0.25; heart(g, W - 22 - i * 22, 30); }
      g.globalAlpha = 1;
      if (D.wind && wind) {
        const s = Math.sign(wind), len = 10 + Math.abs(wind) / D.wind * 18;
        g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); const ax = 40 - s * len / 2; g.moveTo(ax, 30); g.lineTo(ax + s * len, 30); g.lineTo(ax + s * (len - 6), 24); g.moveTo(ax + s * len, 30); g.lineTo(ax + s * (len - 6), 36); g.stroke();
      }
      for (const p of pops) {
        g.globalAlpha = Math.min(1, p.life * 2);
        if (p.big) txt(p.t, W / 2, H * 0.36 - (1.2 - p.life) * 30, 22, p.bad ? '#ff6b6b' : '#ffe14a', 6);
        else txt(p.t, p.x, p.y - (0.9 - p.life) * 40, 16, '#fff', 5);
      }
      g.globalAlpha = 1;
      if (phase === 'ready') {
        txt('MRAKODRAP', W / 2, H * 0.5, 30, '#ffe14a', 8);
        txt(P.text || D.name, W / 2, H * 0.56, 15, '#fff', 5);
        if (P.level) txt(`${L('Postav', 'Build')} ${P.target} ${L('pater', 'floors')}`, W / 2, H * 0.62, 16, '#fff3c0', 5);
        else if (api.data['best_' + P.mode]) txt(`${L('rekord', 'best')} ${api.data['best_' + P.mode]}`, W / 2, H * 0.62, 15, '#fff3c0', 5);
        txt(L('ŤUKNI A PUSŤ PATRO', 'TAP TO DROP A FLOOR'), W / 2, H * 0.7, 14, '#fff', 5);
      }
      if (paused) { g.fillStyle = 'rgba(10,8,20,.5)'; g.fillRect(0, 0, W, H); txt(L('PAUZA', 'PAUSED'), W / 2, H * 0.45, 30); txt(L('ťukni nebo P', 'tap or press P'), W / 2, H * 0.52, 14, '#fff3c0', 5); }
    }
    function heart(g, x, y) {
      g.fillStyle = '#ff4d6d'; g.strokeStyle = MdArt.OL; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y + 7); g.bezierCurveTo(x - 12, y - 1, x - 7, y - 10, x, y - 4); g.bezierCurveTo(x + 7, y - 10, x + 12, y - 1, x, y + 7); g.fill(); g.stroke();
    }

    // ── Smyčka a ovládání ──
    let last = performance.now(), raf = 0;
    const DT = 1 / 120;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (api.paused && api.paused() && !paused && !over && phase === 'play') setPause(true);
      if (!paused && !over) { acc += dt * speed; while (acc >= DT) { acc -= DT; if (auto) autopilot(); step(DT); } }
      draw();
    }
    function setPause(on) { if (over || phase !== 'play') return; paused = on; api.setTimer(!on); }
    cv.addEventListener('pointerdown', e => { e.preventDefault(); if (paused) { setPause(false); return; } drop(); });
    // automat pro testy: nanečisto spustí pád a pustí patro, když by dopadlo skoro přesně
    function autopilot() {
      if (!hook || fall || wait > 0) return;
      const p = hookPos(), f = { x: p.x, y: p.y + 6 + FH, vx: p.vx * 0.85, vy: Math.max(0, p.vy * 0.5) };
      let ph = swayPh;
      for (let i = 0; i < 400; i++) {
        ph += DT * (1.3 + Math.min(1, floors.length * 0.012));
        const res = fallStep(f, DT, ph);
        if (res) { if (res === 'land' && Math.abs(f.x - topX(ph)) <= D.tol * 0.8) drop(); return; }
      }
    }

    fit(); addEventListener('resize', fit);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => null,
      progress: () => (P.level ? Math.min(1, (floors.length - 1) / P.target) : 0),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); },
      pause() { setPause(true); },
      onKey(e) {
        if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); if (paused) setPause(false); else drop(); }
        else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); setPause(!paused); }
      },
      _state: () => ({ phase, score, floors: floors.length - 1, lives, perfects, over }),
      _drop() { drop(); },
      _auto(on) { auto = on !== false; },
      _speed(n) { speed = Math.max(1, n | 0); },
      _solve() { while (floors.length - 1 < (P.level ? P.target : 40)) floors.push({ off: 0 }); score = Math.max(score, 400); phase = 'end'; finish(); },
    };
  }

  // úvodní obrázek: věž pod jeřábem v denním nebi
  function art(el) {
    el.innerHTML = '<canvas width="360" height="360" style="object-fit:contain"></canvas>';
    const g = el.querySelector('canvas').getContext('2d');
    g.beginPath(); g.roundRect(0, 0, 360, 360, 24); g.clip();
    MdArt.sky(g, 360, 360, 0.6); MdArt.cloud(g, 40, 90, 1, 0.85); MdArt.cloud(g, 250, 60, 0.8, 0.85);
    MdArt.city(g, 360, 330, false); MdArt.ground(g, 360, 330, 360);
    const offs = [0, 4, -6, 3, 8, -2];
    let x = 180;
    offs.forEach((o, i) => { x += o; MdArt.floor(g, x, 330 - i * 40, 92, 40, i, false); });
    MdArt.roof(g, x, 330 - 6 * 40, 92, 5);
    MdArt.crane(g, 360, 180, 40, 200, 90);
    MdArt.floor(g, 200, 136, 92, 40, 6, false, -0.08);
  }
  return { DIFFS, generate, create, art, targetOf };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'mrakodrap', title: 'MRAKODRAP',
  tagline: Kit.L('Na motivy Tower Bloxx: jeřáb houpe patrem, ťukni ve správnou chvíli a postav co nejvyšší věž. Přesná patra přivedou víc obyvatel.', 'In the spirit of Tower Bloxx: the crane swings a floor, tap at the right moment and build the tallest tower you can. Precise floors bring more residents.'),
  diffs: Mrakodrap.DIFFS, generate: Mrakodrap.generate, create: Mrakodrap.create, art: Mrakodrap.art,
  dailyDiff: () => 'klasik',
  levelDiff: n => (n <= 30 ? 'lehka' : n <= 80 ? 'klasik' : 'tezka'),
  rules: Kit.L(`<p>Jeřáb houpe patrem. Ťukni na plátno, klikni nebo stiskni mezerník a patro spadne na věž.</p>
    <ul><li>Patro musí dopadnout na to předchozí. Když mine, spadne a ztratíš jeden ze tří životů.</li>
    <li><b>Perfektní</b> položení (skoro přesně nad středem) dává víc obyvatel, řadu bonusů a zklidní houpání věže. Nepřesná patra ji rozkývají.</li>
    <li>Čím výš, tím rychleji jeřáb houpe. Nebe se mění ze dne v západ, noc a vesmír. V <b>Těžké</b> fouká vítr (šipka vlevo nahoře).</li>
    <li>Na <b>Cestě</b> postav zadaný počet pater, hvězdy jsou za zachované životy. P pozastaví hru.</li></ul>`,
    `<p>The crane swings a floor. Tap the canvas, click or press Space and the floor drops onto the tower.</p>
    <ul><li>The floor must land on the one below. If it misses, it falls and you lose one of three lives.</li>
    <li>A <b>perfect</b> drop (almost exactly over the centre) brings more residents, builds a bonus streak and calms the tower's sway. Sloppy floors make it sway more.</li>
    <li>The higher you build, the faster the crane swings. The sky turns from day to sunset, night and space. In <b>Hard</b> the wind blows (the arrow top left).</li>
    <li>On the <b>Path</b>, build the given number of floors; stars are for lives kept. P pauses the game.</li></ul>`),
  achievements: [
    { id: 'm20', name: Kit.L('Panelák', 'Block of flats'), desc: Kit.L('Postav 20 pater', 'Build 20 floors'), prog: s => [Math.min(20, (s.data && s.data.floors) || 0), 20] },
    { id: 'm50', name: Kit.L('Nad mraky', 'Above the clouds'), desc: Kit.L('Postav 50 pater', 'Build 50 floors'), prog: s => [Math.min(50, (s.data && s.data.floors) || 0), 50] },
    { id: 'm5', name: Kit.L('Stavbyvedoucí', 'Site foreman'), desc: Kit.L('5 perfektních pater za sebou', '5 perfect floors in a row'), prog: s => [Math.min(5, (s.data && s.data.combo) || 0), 5] },
  ],
});
