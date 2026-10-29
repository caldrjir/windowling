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
    // svět (pozadí): na Cestě se mění po deseti úrovních, jinak podle semínka
    if (ctx.kind === 'level') { const n = ctx.key; return { seed, mode: levelMode(n), level: n, target: targetOf(n), world: Math.floor((n - 1) / 10), text: L(`Úroveň ${n}`, `Level ${n}`) }; }
    if (ctx.kind === 'daily') return { seed, mode: 'klasik', world: seed % 97, text: L('Denní stavba', 'Daily build') };
    return { seed, mode: DIFFS.some(d => d.id === diffId) ? diffId : 'klasik', world: seed % 97 };
  }

  function create(el, P, saved, api) {
    const D = DIFFS.find(d => d.id === P.mode) || DIFFS[1];
    el.innerHTML = `<div class="md-wrap"><canvas class="md-cv"></canvas><p class="md-keys">${L('Ťukni, klikni nebo mezerník: pustit patro. P pauza', 'Tap, click or Space to drop the floor. P pauses')}</p></div>`;
    const cv = el.querySelector('.md-cv'), ctx = cv.getContext('2d', { alpha: false });
    const world = P.world != null ? P.world : P.seed;
    MdArt.setWorld(world, 'bg/');
    let cssW = 360, cssH = 640, dpr = 1;
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      cssH = Math.max(380, Math.min(innerHeight - (innerWidth < 760 ? 120 : 160), 820));
      cssW = Math.min(box - 2, cssH * W / H); cssH = cssW * H / W;
      dpr = Math.min(1.5, devicePixelRatio || 1);
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
      MdArt.setScale(dpr * cssW / W);
    }

    // ── Stav ──
    const r = rngOf(P.seed), fr = rngOf(P.seed ^ 0x51);
    const floors = [{ off: 0 }];   // přízemí stojí od začátku
    let cum = 0, swayA = 0, swayPh = 0, cam = 0, camX = 0, pivotX = PX, clock = 0, score = 0, perfects = 0, combo = 0, best = 0, lives = 3;
    let lean = 0, collapsed = false, phase = 'ready', over = false, paused = false, speed = 1, acc = 0, auto = false, wait = 0, endT = 0, shake = 0;
    let hook = null, fall = null;
    const debris = [], pops = [], dust = [], rings = [], sparks = [];
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
        rings.push({ x: topX(), y: towerTop() + FH * 0.5, t: 0 });
        for (let k = 0; k < 14; k++) { const a = fr() * 6.28, v = 80 + fr() * 140; sparks.push({ x: topX() + (fr() - 0.5) * D.bw, y: towerTop() + FH * 0.6, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.6 + fr() * 0.4 }); }
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
      // statika: těžiště pater nad každým podlažím musí ležet nad tím podlažím
      const st = stability();
      lean = st.worst;
      if (st.worst > 1) { collapse(st.at, st.dir); return; }
      if (st.worst > 0.72 && !perfect) {
        for (let i = pops.length - 1; i >= 0; i--) if (pops[i].big) pops.splice(i, 1);
        pops.push({ t: L('Věž se naklání!', 'The tower leans!'), x: W / 2, y: 0, life: 1.2, big: true, bad: true });
        swayA = Math.min(46, swayA + 6);
      }
      if (P.level && n >= P.target) { phase = 'end'; endT = 0; api.sound('win'); return; }
      wait = 0.35;
    }
    function stability() {
      const xs = []; let x = PX;
      for (let i = 0; i < floors.length; i++) { x += i ? floors[i].off : 0; xs.push(x); }
      let sum = 0, worst = 0, at = -1, dir = 1;
      for (let k = xs.length - 1; k >= 1; k--) {
        sum += xs[k];
        const com = sum / (xs.length - k), r = Math.abs(com - xs[k - 1]) / (D.bw / 2);
        if (r > worst) { worst = r; at = k; dir = Math.sign(com - xs[k - 1]) || 1; }
      }
      return { worst, at, dir };
    }
    // zřícení: patra od podlaží `at` výš se překlopí a spadnou, hra končí
    function collapse(at, dir) {
      const n = floors.length - 1;
      for (let i = n; i >= at; i--) {
        const k = i - at;
        debris.push({ x: floorX(i), y: GY - i * FH, vx: dir * (50 + k * 22), vy: -30 - k * 6, ang: 0, va: dir * (0.7 + k * 0.12), i, life: 3.2 });
      }
      floors.length = at;
      cum = floors.reduce((a, f, i) => a + (i ? f.off : 0), 0);
      collapsed = true; lean = 0; shake = 0.7; combo = 0;
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].big) pops.splice(i, 1);
      pops.push({ t: L('Věž se zřítila!', 'The tower fell!'), x: W / 2, y: 0, life: 2, big: true, bad: true });
      api.sound('error');
      phase = 'end'; endT = -1;
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
      for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > 0.6) rings.splice(i, 1); }
      for (let i = sparks.length - 1; i >= 0; i--) { const d = sparks[i]; d.vy += 400 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; if (d.life <= 0) sparks.splice(i, 1); }
      for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i]; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; if (d.life <= 0) dust.splice(i, 1); }
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; if (pops[i].life <= 0) pops.splice(i, 1); }
      shake = Math.max(0, shake - dt);
      if (phase === 'end') { endT += dt; if (endT > 1.3) finish(); }
    }
    function finish() {
      if (over) return; over = true; api.setTimer(false);
      const n = floors.length - 1, fell = collapsed ? ` · ${L('věž se zřítila', 'the tower fell')}` : '';
      if (P.level) {
        if (n < P.target) { api.failed({ score, html: `<p class="k-muted">${L(`Postaveno ${n} z ${P.target} pater`, `Built ${n} of ${P.target} floors`)}${fell}</p>` }); return; }
        api.solved({ title: `${n} ${L('pater', 'floors')}`, stars: lives >= 3 ? 3 : lives === 2 ? 2 : 1, score }); return;
      }
      api.data.best = Math.max(api.data.best || 0, score);
      api.data['best_' + P.mode] = Math.max(api.data['best_' + P.mode] || 0, score);
      api.data.floors = Math.max(api.data.floors || 0, n);
      api.data.combo = Math.max(api.data.combo || 0, best);
      api.solved({ title: `${score} ${L('obyvatel', 'residents')}`, stars: n >= 40 ? 3 : n >= 20 ? 2 : 1, score, html: `<p class="k-muted">${L(`${n} pater · ${perfects}× perfektně`, `${n} floors · ${perfects} perfect`)}${fell}</p>` });
    }

    // ── Kresba ──
    function draw() {
      const g = ctx, k = cssW / W, n = floors.length - 1, h = Math.min(4.2, n / 18), sh = shake > 0 ? Math.sin(clock * 90) * 4 * shake : 0;
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      const bd = MdArt.backdrop(g, W, H, n, cam, camX, clock, GY), night = bd.night;
      g.save(); g.translate(sh - camX, cam);
      if (!bd.images) MdArt.ground(g, W, GY, H, bd.T, camX);
      // měkký stín věže na zemi
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(floorX(0), GY + 3, D.bw * 0.7, 5, 0, 0, 7); g.fill();
      // věž: kreslí se jen viditelná patra
      for (let i = 0; i <= n; i++) {
        const y = GY - i * FH;
        if (y + cam < -FH || y - FH + cam > H + FH) continue;
        MdArt.floor(g, floorX(i), y, D.bw, FH, i, night);
      }
      if (n > 0) MdArt.roof(g, floorX(n), GY - (n + 1) * FH, D.bw, night, clock);
      for (const d of dust) { g.fillStyle = `rgba(235,230,220,${Math.min(0.6, d.life)})`; g.beginPath(); g.arc(d.x, d.y, 3 + (0.8 - d.life) * 8, 0, 7); g.fill(); }
      for (const r of rings) { const a = 1 - r.t / 0.6; g.strokeStyle = `rgba(255,214,90,${a})`; g.lineWidth = 3 * a + 1; g.beginPath(); g.ellipse(r.x, r.y, D.bw * 0.5 + r.t * 140, 14 + r.t * 40, 0, 0, 7); g.stroke(); }
      for (const d of sparks) { g.fillStyle = `rgba(255,236,150,${Math.min(1, d.life * 2)})`; g.fillRect(d.x - 1.5, d.y - 1.5, 3, 3); }
      if (fall) MdArt.floor(g, fall.x, fall.y, D.bw, FH, fall.i, night, fall.ang);
      for (const d of debris) { g.globalAlpha = Math.min(1, d.life); MdArt.floor(g, d.x, d.y, D.bw, FH, d.i, night, d.ang); g.globalAlpha = 1; }
      g.restore();
      // jeřáb s visícím patrem
      if (hook) {
        const p = hookPos(), hx = p.x - camX + sh, hy = p.y + cam;
        MdArt.crane(g, W, pivotX - camX + sh, PY, hx, hy, night);
        g.save(); g.translate(hx, hy); g.rotate(-hook.max * Math.sin(hook.t) * 0.12);
        MdArt.slings(g, 0, 0, D.bw, night);
        MdArt.floor(g, 0, 6 + FH, D.bw, FH, floors.length, night);
        g.restore();
      } else MdArt.crane(g, W, pivotX - camX + sh, PY, pivotX - camX + sh, PY + 30, night);
      hud(g, n);
    }
    // ── Rozhraní: skleněné štítky nahoře, nápisy ──
    function pill(g, x, y, w, h) { g.fillStyle = 'rgba(12,16,34,.42)'; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.stroke(); }
    function label(g, s, x, y, size, col = '#fff', wgt = 800, font = 'Unbounded') {
      g.font = `${wgt} ${size}px ${font}, sans-serif`;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText(s, x, y + Math.max(1.5, size * 0.06));
      g.fillStyle = col; g.fillText(s, x, y);
    }
    function hud(g, n) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      // obyvatelé (skóre)
      pill(g, W / 2 - 74, 8, 148, 38);
      person(g, W / 2 - 52, 27);
      g.textAlign = 'left'; label(g, score.toLocaleString(Kit.LANG === 'en' ? 'en-US' : 'cs-CZ'), W / 2 - 38, 28, 19, '#fff', 900);
      g.textAlign = 'center';
      // patra a série
      const info = `${n}${P.level ? ' / ' + P.target : ''} ${L('pater', 'floors')}${combo > 1 ? `  ·  ×${combo}` : ''}`;
      label(g, info, W / 2, 58, 12, combo > 1 ? '#ffd65a' : '#fff', 700, '"Space Grotesk"');
      // náklon věže: ukazatel se plní k hraně, kdy se věž zřítí
      if (lean > 0.35 && phase === 'play') {
        const a = Math.min(1, lean), pulse = lean > 0.72 ? 0.6 + 0.4 * Math.sin(clock * 10) : 1;
        g.fillStyle = 'rgba(12,16,34,.42)'; g.beginPath(); g.roundRect(10, 47, 58, 6, 3); g.fill();
        g.fillStyle = lean > 0.72 ? `rgba(255,77,109,${pulse})` : '#ffd65a'; g.beginPath(); g.roundRect(10, 47, 58 * a, 6, 3); g.fill();
        if (D.wind) label(g, L('náklon', 'lean'), 39, 62, 9, lean > 0.72 ? '#ff8da1' : '#fff', 700, '"Space Grotesk"');
      }
      // životy
      pill(g, W - 84, 12, 74, 30);
      for (let i = 0; i < 3; i++) heart(g, W - 66 + i * 21, 27, i < lives);
      // vítr
      pill(g, 10, 12, 58, 30);
      if (D.wind && wind) {
        const sgn = Math.sign(wind), len = 8 + Math.abs(wind) / D.wind * 14, ax = 39 - sgn * len / 2;
        g.strokeStyle = '#bfe6ff'; g.lineWidth = 2.5; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(ax, 27); g.lineTo(ax + sgn * len, 27); g.moveTo(ax + sgn * (len - 5), 22); g.lineTo(ax + sgn * len, 27); g.lineTo(ax + sgn * (len - 5), 32); g.stroke();
        g.beginPath(); g.moveTo(ax - sgn * 2, 21); g.lineTo(ax + sgn * (len * 0.5), 21); g.stroke();
      } else { g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '700 10px "Space Grotesk", sans-serif'; g.fillText(D.wind ? L('bezvětří', 'calm') : `${L('náklon', 'lean')} ${Math.round(Math.min(1, lean) * 100)}%`, 39, 27); }
      for (const p of pops) {
        g.globalAlpha = Math.min(1, p.life * 2.5);
        if (p.big) {
          const y = H * 0.34 - (1.2 - p.life) * 26, sc = 1 + Math.max(0, p.life - 1) * 1.5;
          g.save(); g.translate(W / 2, y); g.scale(sc, sc);
          g.font = '900 24px Unbounded, sans-serif';
          const gr = g.createLinearGradient(0, -14, 0, 14);
          if (p.bad) { gr.addColorStop(0, '#ff9a9a'); gr.addColorStop(1, '#ff3b5c'); } else { gr.addColorStop(0, '#fff6c2'); gr.addColorStop(1, '#ffb21e'); }
          g.lineWidth = 6; g.lineJoin = 'round'; g.strokeStyle = 'rgba(40,20,10,.55)'; g.strokeText(p.t, 0, 0);
          g.fillStyle = gr; g.fillText(p.t, 0, 0);
          g.restore();
        } else label(g, p.t, p.x, p.y - (0.9 - p.life) * 40, 15, '#fff', 800);
      }
      g.globalAlpha = 1;
      if (phase === 'ready') {
        const t = clock;
        g.fillStyle = 'rgba(8,12,30,.35)'; g.beginPath(); g.roundRect(30, H * 0.44, W - 60, 150, 22); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.stroke();
        g.font = '900 30px Unbounded, sans-serif';
        const gr = g.createLinearGradient(0, H * 0.48 - 16, 0, H * 0.48 + 16); gr.addColorStop(0, '#fff6c2'); gr.addColorStop(1, '#ffb21e');
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillText('MRAKODRAP', W / 2, H * 0.48 + 2); g.fillStyle = gr; g.fillText('MRAKODRAP', W / 2, H * 0.48);
        label(g, `${P.text || D.name} · ${(Kit.LANG === 'en' ? MdArt.worldName(world)[1] : MdArt.worldName(world)[0])}`, W / 2, H * 0.535, 13, '#fff', 700, '"Space Grotesk"');
        const sub = P.level ? `${L('Postav', 'Build')} ${P.target} ${L('pater', 'floors')}` : api.data['best_' + P.mode] ? `${L('rekord', 'best')} ${api.data['best_' + P.mode].toLocaleString(Kit.LANG === 'en' ? 'en-US' : 'cs-CZ')}` : L('postav co nejvyšší věž', 'build the tallest tower');
        label(g, sub, W / 2, H * 0.575, 12, '#ffe7a8', 700, '"Space Grotesk"');
        const pw = 190, py = H * 0.62, pulse = 1 + Math.sin(t * 4) * 0.03;
        g.save(); g.translate(W / 2, py + 14); g.scale(pulse, pulse);
        const bg = g.createLinearGradient(0, -16, 0, 16); bg.addColorStop(0, '#ffcf4a'); bg.addColorStop(1, '#f59e0b');
        g.fillStyle = bg; g.beginPath(); g.roundRect(-pw / 2, -16, pw, 32, 16); g.fill();
        g.fillStyle = '#3a2408'; g.font = '800 12px Unbounded, sans-serif'; g.fillText(L('ŤUKNI A PUSŤ PATRO', 'TAP TO DROP'), 0, 1);
        g.restore();
      }
      if (paused) { g.fillStyle = 'rgba(8,10,24,.55)'; g.fillRect(0, 0, W, H); label(g, L('PAUZA', 'PAUSED'), W / 2, H * 0.45, 28, '#fff', 900); label(g, L('ťukni nebo P', 'tap or press P'), W / 2, H * 0.51, 13, '#ffe7a8', 700, '"Space Grotesk"'); }
    }
    function heart(g, x, y, on) {
      g.fillStyle = on ? '#ff4d6d' : 'rgba(255,255,255,.22)';
      g.beginPath(); g.moveTo(x, y + 7); g.bezierCurveTo(x - 11, y - 1, x - 6, y - 9, x, y - 4); g.bezierCurveTo(x + 6, y - 9, x + 11, y - 1, x, y + 7); g.fill();
      if (on) { g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.arc(x - 4, y - 3, 1.8, 0, 7); g.fill(); }
    }
    function person(g, x, y) {
      g.fillStyle = '#ffd65a'; g.beginPath(); g.arc(x, y - 6, 4.5, 0, 7); g.fill();
      g.beginPath(); g.roundRect(x - 7, y, 14, 9, [7, 7, 2, 2]); g.fill();
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
    let aimDx = 0, aimOnce = false;
    function autopilot() {
      if (!hook || fall || wait > 0) return;
      const p = hookPos(), f = { x: p.x, y: p.y + 6 + FH, vx: p.vx * 0.85, vy: Math.max(0, p.vy * 0.5) };
      let ph = swayPh;
      for (let i = 0; i < 400; i++) {
        ph += DT * (1.3 + Math.min(1, floors.length * 0.012));
        const res = fallStep(f, DT, ph);
        if (res) { if (res === 'land' && Math.abs(f.x - topX(ph) - aimDx) <= D.tol * 0.8) { drop(); if (aimOnce) { auto = false; aimOnce = false; aimDx = 0; } } return; }
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
      _aim(dx) { aimDx = dx; aimOnce = true; auto = true; },
      _auto(on) { auto = on !== false; },
      _speed(n) { speed = Math.max(1, n | 0); },
      _solve() { while (floors.length - 1 < (P.level ? P.target : 40)) floors.push({ off: 0 }); score = Math.max(score, 400); phase = 'end'; finish(); },
    };
  }

  // úvodní obrázek: stejná scéna jako ve hře (zlatá hodinka, skleněná věž, jeřáb)
  function art(el) {
    el.innerHTML = '<canvas width="720" height="720"></canvas>';
    const g = el.querySelector('canvas').getContext('2d');
    g.scale(2, 2); MdArt.setScale(2);
    g.beginPath(); g.roundRect(0, 0, 360, 360, 24); g.clip();
    const paint = () => { MdArt.setScale(2); MdArt.poster(g, 360, 360, { h: 1.0, n: 4, bw: 104, fh: 34, th: 0.5, world: 0, scene: 2 }); };
    MdArt.setWorld(0, 'bg/'); paint(); MdArt.whenBg(0, 2, paint);
  }
  return { DIFFS, generate, create, art, targetOf };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'mrakodrap', title: 'MRAKODRAP', wording: 'play',
  tagline: Kit.L('Na motivy Tower Bloxx: jeřáb houpe patrem, ťukni ve správnou chvíli a postav co nejvyšší věž. Přesná patra přivedou víc obyvatel.', 'In the spirit of Tower Bloxx: the crane swings a floor, tap at the right moment and build the tallest tower you can. Precise floors bring more residents.'),
  diffs: Mrakodrap.DIFFS, generate: Mrakodrap.generate, create: Mrakodrap.create, art: Mrakodrap.art,
  dailyDiff: () => 'klasik',
  levelDiff: n => (n <= 30 ? 'lehka' : n <= 80 ? 'klasik' : 'tezka'),
  rules: Kit.L(`<p>Jeřáb houpe patrem. Ťukni na plátno, klikni nebo stiskni mezerník a patro spadne na věž.</p>
    <ul><li>Patro musí dopadnout na to předchozí. Když mine, spadne a ztratíš jeden ze tří životů.</li>
    <li><b>Perfektní</b> položení (skoro přesně nad středem) dává víc obyvatel, řadu bonusů a zklidní houpání věže. Nepřesná patra ji rozkývají.</li>
    <li>Hlídej <b>náklon</b>: když těžiště pater nad některým podlažím přeleze jeho hranu, věž se od toho místa zřítí a hra končí.</li>
    <li>Čím výš, tím rychleji jeřáb houpe. Nebe se mění ze dne v západ, noc a vesmír. V <b>Těžké</b> fouká vítr (šipka vlevo nahoře).</li>
    <li>Na <b>Cestě</b> postav zadaný počet pater, hvězdy jsou za zachované životy. P pozastaví hru.</li></ul>`,
    `<p>The crane swings a floor. Tap the canvas, click or press Space and the floor drops onto the tower.</p>
    <ul><li>The floor must land on the one below. If it misses, it falls and you lose one of three lives.</li>
    <li>A <b>perfect</b> drop (almost exactly over the centre) brings more residents, builds a bonus streak and calms the tower's sway. Sloppy floors make it sway more.</li>
    <li>Watch the <b>lean</b>: if the centre of mass of the floors above any floor moves past its edge, the tower falls from there and the game ends.</li>
    <li>The higher you build, the faster the crane swings. The sky turns from day to sunset, night and space. In <b>Hard</b> the wind blows (the arrow top left).</li>
    <li>On the <b>Path</b>, build the given number of floors; stars are for lives kept. P pauses the game.</li></ul>`),
  achievements: [
    { id: 'm20', name: Kit.L('Panelák', 'Block of flats'), desc: Kit.L('Postav 20 pater', 'Build 20 floors'), prog: s => [Math.min(20, (s.data && s.data.floors) || 0), 20] },
    { id: 'm50', name: Kit.L('Nad mraky', 'Above the clouds'), desc: Kit.L('Postav 50 pater', 'Build 50 floors'), prog: s => [Math.min(50, (s.data && s.data.floors) || 0), 50] },
    { id: 'm5', name: Kit.L('Stavbyvedoucí', 'Site foreman'), desc: Kit.L('5 perfektních pater za sebou', '5 perfect floors in a row'), prog: s => [Math.min(5, (s.data && s.data.combo) || 0), 5] },
  ],
});
