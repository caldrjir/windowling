'use strict';
// ── ŠMIK! · Windowling Hlavolamy ────────────────────────────────────────────
// Na motivy Fruit Ninji: ovoce vylétá zespodu a ty ho krájíš tahem prstu nebo myši. Víc kusů
// jedním tahem je kombo. Bomby se nekrájí. Klasika má tři životy (propadlé ovoce stojí život,
// bomba končí hru), Arkáda minutu s banány se zvláštní mocí a Zen minutu a půl bez bomb.
// Pořadí vln se bere ze semínka, takže denní výzva je pro všechny stejná.
const Smik = (() => {
  const L = Kit.L, F = SmArt.F;
  const FRUITS = ['melon', 'orange', 'apple', 'lemon', 'kiwi', 'plum', 'pine', 'coco', 'straw'];
  const DIFFS = [
    { id: 'klasik', name: L('Klasika', 'Classic'), note: L('tři životy, bomba končí', 'three lives, a bomb ends it'), metric: 'score' },
    { id: 'arkada', name: L('Arkáda', 'Arcade'), note: L('minuta, banány se zvláštní mocí', 'one minute, power bananas'), metric: 'score' },
    { id: 'zen', name: L('Zen', 'Zen'), note: L('90 s bez bomb', '90 s, no bombs'), metric: 'score' },
  ];
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  function levelSpec(n) { return { target: Math.min(320, 40 + (n - 1) * 3), text: L(`Kolo ${n}`, `Round ${n}`) }; }
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') { const s = levelSpec(ctx.key); return { seed, mode: 'arkada', level: true, target: s.target, text: s.text }; }
    if (ctx.kind === 'daily') return { seed, mode: 'arkada', text: L('Denní krájení', 'Daily slicing') };
    return { seed, mode: DIFFS.some(d => d.id === diffId) ? diffId : 'klasik' };
  }

  function create(el, P, saved, api) {
    const mode = P.mode, classic = mode === 'klasik', TIME = mode === 'zen' ? 90 : 60;
    el.innerHTML = `<div class="sm-wrap"><div class="sm-stage"><canvas class="sm-cv"></canvas><div class="sm-msg" hidden></div></div>
      <p class="sm-keys">${L('Krájej tahem myši nebo prstu. Bomby nech být. P pauza', 'Slice by swiping with the mouse or a finger. Leave the bombs alone. P pauses')}</p></div>`;
    const cv = el.querySelector('.sm-cv'), ctx = cv.getContext('2d'), msgEl = el.querySelector('.sm-msg');
    let cssW = 640, cssH = 400, dpr = 1, VW = 640, VH = 400, G = 500, bg = null;
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      cssW = Math.floor(Math.min(box - 2, 980));
      cssH = Math.max(300, Math.min(innerHeight - (innerWidth < 760 ? 150 : 170), cssW * 1.7));
      VW = cssW < 600 ? 420 : 640; VH = Math.round(VW * cssH / cssW); G = VH * 1.25;
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = cssW * dpr; cv.height = cssH * dpr; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
      bg = SmArt.wood(VW, VH, 7);
    }

    // ── Stav ──
    const r = rngOf(P.seed), fxr = rngOf(P.seed ^ 0x5eed);
    const fruits = [], halves = [], drops = [], stains = [], pops = [], trail = [];
    let T = 0, clock = 0, score = 0, lives = 3, time = TIME, over = false, paused = false, ending = 0, nextWave = 1.2, speed = 1, flash = 0;
    const power = { freeze: 0, frenzy: 0, double: 0 };
    let frenzyT = 0;
    function launch(kind, x0, opts = {}) {
      const h = VH * (0.45 + 0.38 * r()), vy = -Math.sqrt(2 * G * h), tp = -vy / G;
      const vx = opts.vx != null ? opts.vx : (VW * 0.5 - x0) * (0.25 + 0.5 * r()) / tp;
      fruits.push({ kind, x: x0, y: opts.y != null ? opts.y : VH + 30, vx, vy: opts.vy != null ? opts.vy : vy, a: r() * 6, va: (r() - 0.5) * 6, alive: true, bomb: kind === 'bomb', power: opts.power, r: kind === 'bomb' ? 22 : F[kind].r * Math.max(F[kind].sx || 1, F[kind].sy || 1) });
    }
    function wave() {
      const lv = Math.min(1, T / 120), n = 1 + Math.floor(r() * (2 + lv * 4)), burst = r() < 0.3, bombP = mode === 'zen' ? 0 : classic ? 0.07 + 0.13 * lv : 0.12;
      let fruitsIn = 0;
      for (let i = 0; i < n; i++) {
        let kind = FRUITS[Math.floor(r() * FRUITS.length)];
        if (r() < bombP && (fruitsIn > 0 || i < n - 1)) kind = 'bomb'; else fruitsIn++;
        const x0 = VW * (0.12 + 0.76 * r());
        if (burst) launch(kind, x0); else setTimeout0(i * 0.22, () => launch(kind, x0));
      }
      if (!classic && mode !== 'zen' && r() < 0.09) { const pw = ['freeze', 'frenzy', 'double'][Math.floor(r() * 3)]; launch('banana', VW * (0.2 + 0.6 * r()), { power: pw }); }
      nextWave = classic ? 2.3 - 1.2 * lv + r() * 0.6 : mode === 'zen' ? 1.5 + r() * 0.4 : 1.25 + r() * 0.5;
    }
    // odložené vypuštění podle herního času (ne skutečného), aby šlo pozastavit
    const later = [];
    function setTimeout0(d, fn) { later.push({ t: T + d, fn }); }
    function say(t, d = 1.4) { msgEl.textContent = t; msgEl.hidden = false; msgEl.dataset.t = d; }
    function pop(x, y, text, col, size = 22) { pops.push({ x, y, text, col, size, life: 1 }); }

    // ── Krájení ──
    let stroke = { n: 0, last: 0, x: 0, y: 0 };
    function segHit(ax, ay, bx, by, f) {
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((f.x - ax) * dx + (f.y - ay) * dy) / l2));
      return Math.hypot(ax + dx * k - f.x, ay + dy * k - f.y) < f.r * 0.95;
    }
    function cut(ax, ay, bx, by) {
      if (over || paused || ending) return;
      const ang = Math.atan2(by - ay, bx - ax);
      for (const f of fruits) if (f.alive && segHit(ax, ay, bx, by, f)) slice(f, ang);
    }
    function slice(f, ang) {
      f.alive = false;
      if (f.bomb) {
        boom(f.x, f.y);
        if (classic) { ending = 1.4; api.sound('error'); say(L('BUM! Konec hry', 'BOOM! Game over'), 2); }
        else { score = Math.max(0, score - 10); pop(f.x, f.y - 30, '−10', '#ff5a5a', 26); api.sound('error'); }
        return;
      }
      const fd = F[f.kind], nx = -Math.sin(ang), ny = Math.cos(ang);
      for (const s of [-1, 1]) halves.push({ kind: f.kind, side: s, x: f.x + nx * s * 4, y: f.y + ny * s * 4, vx: f.vx * 0.6 + nx * s * 70, vy: Math.min(f.vy, 0) * 0.4 + ny * s * 70 - 60, a: ang - Math.PI / 2, va: s * 3, life: 2.5 });
      for (let i = 0; i < 14; i++) { const a = fxr() * Math.PI * 2, v = 60 + fxr() * 220; drops.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, c: fd.juice, life: 0.5 + fxr() * 0.4, s: 2 + fxr() * 3 }); }
      stains.push({ x: f.x, y: f.y, c: fd.juice, r: fd.r * (1.1 + fxr() * 0.5), life: 3, seed: fxr() * 100 });
      if (stains.length > 24) stains.shift();
      if (f.power) { power[f.power] = 5; api.sound('star'); say(f.power === 'freeze' ? L('❄ Zmrazení!', '❄ Freeze!') : f.power === 'frenzy' ? L('✦ Šílenství!', '✦ Frenzy!') : L('×2 Dvojnásobek!', '×2 Double!'), 1.4); }
      let pts = power.double > 0 ? 2 : 1;
      if (!classic && fxr() < 0.05) { pts += 10; pop(f.x, f.y - 34, L('KRITICKÝ! +10', 'CRITICAL! +10'), '#ff5a5a', 20); }
      score += pts;
      if (clock - stroke.last > 0.3) stroke.n = 0;
      stroke.n++; stroke.last = clock; stroke.x = f.x; stroke.y = f.y;
      api.sound(stroke.n > 1 ? 'place' : 'tap');
      api.changed && api.changed();
    }
    function closeCombo() {
      if (stroke.n >= 3) { const b = stroke.n * (power.double > 0 ? 2 : 1); score += b; pop(stroke.x, stroke.y - 40, `${L('Kombo', 'Combo')} ×${stroke.n}  +${b}`, '#ffe066', 24); api.sound('line'); }
      stroke.n = 0;
    }
    function boom(x, y) {
      flash = 0.5;
      for (let i = 0; i < 40; i++) { const a = fxr() * Math.PI * 2, v = 80 + fxr() * 400; drops.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: ['#fff3c0', '#ffd23f', '#ff8a3d', '#ffffff'][i % 4], life: 0.5 + fxr() * 0.5, s: 2 + fxr() * 4 }); }
    }

    // ── Simulace ──
    function tick(rdt) {
      clock += rdt;
      if (+msgEl.dataset.t > 0) { msgEl.dataset.t = +msgEl.dataset.t - rdt; if (+msgEl.dataset.t <= 0) msgEl.hidden = true; }
      if (ending) { ending -= rdt; flash = Math.max(0, flash - rdt); if (ending <= 0) finish(); return; }
      const dt = rdt * (power.freeze > 0 ? 0.4 : 1);
      for (const k in power) power[k] = Math.max(0, power[k] - rdt);
      T += dt;
      if (!classic) { time -= rdt; if (time <= 0) { time = 0; finish(); return; } }
      nextWave -= dt; if (nextWave <= 0) wave();
      for (let i = later.length - 1; i >= 0; i--) if (later[i].t <= T) { later[i].fn(); later.splice(i, 1); }
      if (power.frenzy > 0) { frenzyT -= dt; if (frenzyT <= 0) { frenzyT = 0.16; const s = fxr() < 0.5 ? -1 : 1; launch(FRUITS[Math.floor(fxr() * FRUITS.length)], s < 0 ? -20 : VW + 20, { y: VH * (0.5 + fxr() * 0.3), vx: -s * (VW * (0.5 + fxr() * 0.4)), vy: -VH * (0.9 + fxr() * 0.5) }); } }
      for (const f of fruits) { f.vy += G * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.va * dt; }
      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        if (!f.alive) { fruits.splice(i, 1); continue; }
        if (f.vy > 0 && f.y > VH + 50) {
          fruits.splice(i, 1);
          if (classic && !f.bomb) { lives--; pop(Math.max(30, Math.min(VW - 30, f.x)), VH - 40, '✕', '#ff4d4d', 34); api.sound('error'); if (lives <= 0) { ending = 1.2; say(L('Konec hry', 'Game over'), 2); } }
        }
      }
      for (let i = halves.length - 1; i >= 0; i--) { const h = halves[i]; h.vy += G * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.a += h.va * dt; h.life -= dt; if (h.life <= 0 || h.y > VH + 80) halves.splice(i, 1); }
      for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.vy += G * 0.6 * rdt; d.x += d.vx * rdt; d.y += d.vy * rdt; d.life -= rdt; if (d.life <= 0) drops.splice(i, 1); }
      for (let i = stains.length - 1; i >= 0; i--) { stains[i].life -= rdt; if (stains[i].life <= 0) stains.splice(i, 1); }
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= rdt; pops[i].y -= 30 * rdt; if (pops[i].life <= 0) pops.splice(i, 1); }
      if (stroke.n && clock - stroke.last > 0.3) closeCombo();
      flash = Math.max(0, flash - rdt);
    }
    function finish() {
      if (over) return;
      over = true; api.setTimer(false);
      if (P.level) {
        if (score < P.target) { api.failed({ score, html: `<p class="k-muted">${L(`Cíl ${P.target} bodů`, `Target ${P.target} points`)}</p>` }); return; }
        api.solved({ title: `${score} ${L('bodů', 'pts')}`, stars: score >= P.target * 1.6 ? 3 : score >= P.target * 1.3 ? 2 : 1, score }); return;
      }
      api.data['best_' + mode] = Math.max(api.data['best_' + mode] || 0, score);
      api.data.best = Math.max(api.data.best || 0, score);
      const th = classic ? [60, 150] : mode === 'zen' ? [100, 200] : [120, 250];
      api.solved({ title: `${score} ${L('bodů', 'pts')}`, stars: score >= th[1] ? 3 : score >= th[0] ? 2 : 1, score });
    }

    // ── Kresba ──
    function draw() {
      const g = ctx, k = cssW / VW;
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      g.drawImage(bg, 0, 0, VW, VH);
      // cákance šťávy na dřevě
      for (const s of stains) {
        g.globalAlpha = Math.min(0.55, s.life * 0.4); g.fillStyle = s.c; g.beginPath();
        for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2, rr = s.r * (0.7 + 0.35 * Math.abs(Math.sin(s.seed + i * 1.7))); g.lineTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr); }
        g.fill();
        for (let i = 0; i < 5; i++) { const a = s.seed + i * 1.3, rr = s.r * (1.3 + (i % 3) * 0.3); g.beginPath(); g.arc(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr, 2 + (i % 3) * 1.5, 0, 7); g.fill(); }
      }
      g.globalAlpha = 1;
      if (power.freeze > 0) { g.fillStyle = 'rgba(120,210,255,.18)'; g.fillRect(0, 0, VW, VH); }
      for (const h of halves) { g.save(); g.translate(h.x, h.y); g.rotate(h.a); g.globalAlpha = Math.min(1, h.life); SmArt.half(g, h.kind, h.side); g.restore(); }
      for (const f of fruits) { g.save(); g.translate(f.x, f.y); g.rotate(f.bomb ? f.a * 0.3 : f.a); if (f.bomb) SmArt.bomb(g, clock); else SmArt.whole(g, f.kind, clock, f.power); g.restore(); }
      for (const d of drops) { g.globalAlpha = Math.min(1, d.life * 2); g.fillStyle = d.c; g.beginPath(); g.arc(d.x, d.y, d.s, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      SmArt.blade(g, trail, clock);
      // body
      g.textBaseline = 'middle'; g.lineJoin = 'round';
      const txt = (s, x, y, size, col, align = 'left') => { g.font = `900 ${size}px Unbounded, sans-serif`; g.textAlign = align; g.lineWidth = 6; g.strokeStyle = 'rgba(30,12,4,.85)'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };
      g.save(); g.translate(30, 34); g.scale(0.75, 0.75); SmArt.half(g, 'orange', 1); g.restore();
      txt(String(score), 52, 34, 30, '#ffe066');
      const best = P.level ? null : api.data['best_' + mode];
      if (P.level) txt(`${L('cíl', 'goal')} ${P.target}`, 54, 66, 13, '#fff3d0');
      else if (best) txt(`${L('rekord', 'best')} ${best}`, 54, 66, 13, '#fff3d0');
      if (classic) for (let i = 0; i < 3; i++) { const lost = i >= lives; txt('✕', VW - 26 - (2 - i) * 34, 34, 26 + (lost ? 4 : 0), lost ? '#ff4d4d' : 'rgba(255,255,255,.35)', 'center'); }
      else { const tl = Math.ceil(time); txt(`${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`, VW - 20, 34, 26, tl <= 10 && Math.sin(clock * 10) > 0 ? '#ff5a5a' : '#ffffff', 'right'); }
      let py = 66; for (const k2 of ['freeze', 'frenzy', 'double']) if (power[k2] > 0) { g.fillStyle = SmArt.POWER[k2]; g.fillRect(VW - 20 - 80 * power[k2] / 5, py, 80 * power[k2] / 5, 5); py += 9; }
      for (const p of pops) { g.globalAlpha = Math.min(1, p.life * 2); txt(p.text, p.x, p.y, p.size, p.col, 'center'); }
      g.globalAlpha = 1;
      if (flash > 0) { g.fillStyle = `rgba(255,255,240,${flash * 1.6})`; g.fillRect(0, 0, VW, VH); }
    }

    // ── Smyčka a ovládání ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      if (api.paused && api.paused() && !paused && !over) setPause(true);
      if (!paused && !over) for (let s = 0; s < speed; s++) { if (auto) autoplay(dt); if (!over) tick(dt); }
      while (trail.length && clock - trail[0].t > 0.3) trail.shift();
      draw();
    }
    function setPause(on) { if (over) return; paused = on; api.setTimer(!on); if (on) say(L('Pauza · stiskni P', 'Paused · press P'), 9999); else msgEl.hidden = true; }
    let down = false, lx = 0, ly = 0;
    const pos = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * VW, (e.clientY - b.top) / b.height * VH]; };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); down = true; [lx, ly] = pos(e); trail.push({ x: lx, y: ly, t: clock }); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ukazatel už neplatí */ } });
    cv.addEventListener('pointermove', e => {
      if (!down && e.pointerType !== 'mouse') return;
      const [x, y] = pos(e);
      if (down || e.buttons) { if (Math.hypot(x - lx, y - ly) > 2) { cut(lx, ly, x, y); trail.push({ x, y, t: clock }); } }
      lx = x; ly = y;
    });
    const up = () => { down = false; if (stroke.n) closeCombo(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    // automat pro testy: rozsekne ovoce, které je u vrcholu a daleko od bomb
    let auto = false, autoT = 0;
    function autoplay(dt) {
      autoT -= dt; if (autoT > 0 || ending) return;
      const f = fruits.find(q => q.alive && !q.bomb && q.vy > -G * 0.25 && q.y < VH * 0.85 && q.y > 20 && !fruits.some(b => b.bomb && b.alive && Math.hypot(b.x - q.x, b.y - q.y) < 90));
      if (!f) return;
      autoT = 0.06;
      trail.push({ x: f.x - 36, y: f.y - 14, t: clock }, { x: f.x + 36, y: f.y + 14, t: clock });
      cut(f.x - 36, f.y - 14, f.x + 36, f.y + 14);
    }

    fit(); addEventListener('resize', fit);
    api.setTimer(true);
    say(P.level ? `${L('Cíl', 'Goal')} ${P.target} ${L('bodů', 'points')}` : classic ? L('Krájej! Bomby nech být', 'Slice! Leave the bombs') : mode === 'zen' ? L('Zen: 90 s bez bomb', 'Zen: 90 s, no bombs') : L('Arkáda: minuta krájení', 'Arcade: one minute of slicing'), 1.8);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => null,
      progress: () => (P.level ? Math.min(1, score / P.target) : 0),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); },
      pause() { setPause(true); },
      onKey(e) { if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); setPause(!paused); } },
      _state: () => ({ score, lives, time: +time.toFixed(1), fruits: fruits.length, over, T: +T.toFixed(1) }),
      _auto(on) { auto = on !== false; },
      _speed(n) { speed = Math.max(1, n | 0); },
      _cut(ax, ay, bx, by) { cut(ax, ay, bx, by); },
      _fruits: () => fruits.filter(f => f.alive).map(f => ({ kind: f.kind, x: f.x, y: f.y, bomb: f.bomb })),
      _solve() { score = Math.max(score, P.level ? P.target * 2 : 200); finish(); },
    };
  }

  // úvodní obrázek: dřevěné dojo, rozseknutý meloun, létající ovoce, bomba a stopa čepele
  function art(el) {
    el.innerHTML = '<canvas width="520" height="360" style="object-fit:contain"></canvas>';
    const g = el.querySelector('canvas').getContext('2d');
    g.beginPath(); g.roundRect(0, 0, 520, 360, 28); g.clip();
    g.drawImage(SmArt.wood(520, 360, 3), 0, 0);
    const splat = (x, y, rr, c) => { g.globalAlpha = 0.5; g.fillStyle = c; g.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2, q = rr * (0.7 + 0.35 * Math.abs(Math.sin(i * 1.7))); g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.fill(); g.globalAlpha = 1; };
    splat(250, 170, 60, '#ff3b4a'); splat(410, 250, 34, '#ff9a2a'); splat(110, 90, 30, '#a8e05a');
    const put = (fn, x, y, a, s = 1) => { g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s); fn(); g.restore(); };
    put(() => SmArt.half(g, 'melon', -1), 222, 160, -0.6, 1.9); put(() => SmArt.half(g, 'melon', 1), 284, 186, -0.6, 1.9);
    put(() => SmArt.whole(g, 'orange'), 420, 92, 0.3, 1.5); put(() => SmArt.whole(g, 'apple'), 96, 240, -0.2, 1.4);
    put(() => SmArt.half(g, 'kiwi', -1), 120, 92, 0.8, 1.4); put(() => SmArt.half(g, 'kiwi', 1), 140, 104, 0.8, 1.4);
    put(() => SmArt.whole(g, 'pine'), 440, 250, 0.2, 1.1); put(() => SmArt.bomb(g, 1), 330, 300, 0, 1.1);
    put(() => SmArt.whole(g, 'straw'), 60, 160, 0.3, 1.4); put(() => SmArt.whole(g, 'banana', 0, 'double'), 330, 70, -0.2, 1.1);
    const pts = []; for (let i = 0; i <= 16; i++) pts.push({ x: 120 + i * 22, y: 250 - i * 12 - Math.sin(i / 16 * Math.PI) * 40, t: 0.15 * i / 16 });
    SmArt.blade(g, pts, 0.15, 0.2);
  }
  return { DIFFS, generate, create, art, levelSpec };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'smik', title: 'ŠMIK!', wording: 'play',
  tagline: Kit.L('Na motivy Fruit Ninji: ovoce vylétá do vzduchu a ty ho krájíš tahem prstu nebo myši. Kombo za víc kusů najednou, šťáva po celém dojo, jen do bomb nesekej!', 'In the spirit of Fruit Ninja: fruit flies up and you slice it with a swipe of a finger or the mouse. Combos for several at once, juice all over the dojo, just never slice a bomb!'),
  diffs: Smik.DIFFS, generate: Smik.generate, create: Smik.create, art: Smik.art,
  dailyDiff: () => 'arkada',
  levelDiff: () => 'arkada',
  rules: Kit.L(`<p>Ovoce vylétá zespodu. Krájej ho tahem prstu nebo myši se stisknutým tlačítkem.</p>
    <ul><li>Každý kus je bod. Tři a víc jedním tahem je <b>kombo</b> s bonusem.</li>
    <li><b>Bomby</b> nesekej: v Klasice končí hru, v Arkádě stojí 10 bodů.</li>
    <li><b>Klasika:</b> tři životy, každé propadlé ovoce stojí jeden.</li>
    <li><b>Arkáda:</b> minuta, občas kritický zásah za 10 bodů a banány: ❄ zpomalí čas, ✦ spustí šílenství ovoce, ×2 zdvojí body.</li>
    <li><b>Zen:</b> 90 sekund bez bomb a bez životů.</li>
    <li>Na <b>Cestě</b> nasbírej v Arkádě cílový počet bodů. P pozastaví hru.</li></ul>`,
    `<p>Fruit flies up from below. Slice it with a swipe of a finger, or drag the mouse with the button held.</p>
    <ul><li>Each piece is a point. Three or more in one swipe is a <b>combo</b> with a bonus.</li>
    <li>Never slice <b>bombs</b>: in Classic they end the game, in Arcade they cost 10 points.</li>
    <li><b>Classic:</b> three lives, each dropped fruit costs one.</li>
    <li><b>Arcade:</b> one minute, the odd critical hit worth 10 and bananas: ❄ slows time, ✦ starts a fruit frenzy, ×2 doubles points.</li>
    <li><b>Zen:</b> 90 seconds, no bombs and no lives.</li>
    <li>On the <b>Path</b> reach the target score in Arcade. P pauses the game.</li></ul>`),
  achievements: [
    { id: 'c150', name: Kit.L('Mistr čepele', 'Blade master'), desc: Kit.L('150 bodů v jedné hře', '150 points in one game'), prog: s => [Math.min(150, (s.data && s.data.best) || 0), 150] },
    { id: 'c300', name: Kit.L('Ovocná smršť', 'Fruit storm'), desc: Kit.L('300 bodů v jedné hře', '300 points in one game'), prog: s => [Math.min(300, (s.data && s.data.best) || 0), 300] },
  ],
});
