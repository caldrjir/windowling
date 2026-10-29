'use strict';
// ── SKOKAN · Windowling Hlavolamy ───────────────────────────────────────────
// Na motivy Doodle Jumpu: panáček sám skáče po plošinkách a ty ho jen posíláš doleva a doprava
// (obrazovka se na okrajích propojuje). Výš jsou pohyblivé, lámavé a mizející plošinky, pružiny,
// vrtulka a raketový batoh, příšery, které se dají zastřelit nebo na ně skočit, a černé díry.
// Plošinky se generují ze semínka, takže denní skok je pro všechny stejný.
const Skokan = (() => {
  const L = Kit.L;
  const VW = 360, VH = 600, START = 560, MAXV = 330;
  const PHYS = { klasik: { g: 1500, jump: 720 }, vesmir: { g: 1150, jump: 640 } };
  const DIFFS = [
    { id: 'klasik', name: L('Sešit', 'Notebook'), note: L('klasický skok do výšky', 'the classic climb'), metric: 'score' },
    { id: 'vesmir', name: L('Vesmír', 'Space'), note: L('nižší gravitace, UFO a černé díry', 'low gravity, UFOs and black holes'), metric: 'score' },
  ];
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  function levelSpec(n) { return { target: Math.min(30000, 2500 + (n - 1) * 260), theme: Math.floor((n - 1) / 10) % 2 ? 'vesmir' : 'klasik', text: L(`Skok ${n}`, `Jump ${n}`) }; }
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') { const s = levelSpec(ctx.key); return { seed, mode: 'level', theme: s.theme, target: s.target, text: s.text }; }
    if (ctx.kind === 'daily') return { seed, mode: 'daily', theme: 'klasik', text: L('Denní skok', 'Daily jump') };
    return { seed, mode: 'free', theme: diffId === 'vesmir' ? 'vesmir' : 'klasik' };
  }

  function create(el, P, saved, api) {
    const theme = P.theme, PH = PHYS[theme], SPRING = PH.jump * 1.6, MAXGAP = PH.jump * PH.jump / (2 * PH.g) - 22;
    el.innerHTML = `<div class="sk-wrap">
      <div class="sk-stage"><canvas class="sk-cv"></canvas><div class="sk-msg" hidden></div></div>
      <div class="sk-pad">
        <button class="sk-btn" data-b="l" aria-label="${L('Doleva', 'Left')}">◀</button>
        <button class="sk-btn shoot" data-b="s" aria-label="${L('Střelba', 'Shoot')}">▲<small>${L('střel', 'shoot')}</small></button>
        <button class="sk-btn" data-b="r" aria-label="${L('Doprava', 'Right')}">▶</button>
      </div>
      <p class="sk-keys">${L('Klávesy: ← → pohyb, mezerník nebo ↑ střelba, P pauza', 'Keys: ← → move, Space or ↑ shoot, P pauses')}</p>
      <button class="sk-tilt" hidden>📱 ${L('Ovládat nakláněním', 'Tilt to steer')}</button></div>`;
    const cv = el.querySelector('.sk-cv'), ctx = cv.getContext('2d'), msgEl = el.querySelector('.sk-msg');
    let cssW = 360, cssH = 600, dpr = 1;
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      cssH = Math.max(320, Math.min(860, innerHeight - (innerWidth < 760 ? 210 : 190)));
      cssW = Math.round(cssH * VW / VH);
      if (cssW > box - 2) { cssW = Math.floor(box - 2); cssH = Math.round(cssW * VH / VW); }
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = cssW * dpr; cv.height = cssH * dpr; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    }

    // ── Svět ──
    const r = rngOf(P.seed), plats = [], mons = [], holes = [], stars = [], bullets = [], fx = [];
    let nextY = START + 14, camY = 0, maxH = 0, over = false, paused = false, clock = 0, speed = 1, done = false, got = 0, starIdx = 0;
    const me = { x: VW / 2, y: START, vx: 0, vy: -PH.jump, face: 1, sq: 0, power: null, dead: false, sucked: 0, shootT: 0 };
    const wrapDx = dx => (dx > VW / 2 ? dx - VW : dx < -VW / 2 ? dx + VW : dx);
    // startovní podlaha a pak řádky plošinek
    for (let x = 30; x < VW; x += 75) plats.push({ x, y: START + 14, w: 58, kind: 'green' });
    function addRow() {
      const h = START - nextY, d = Math.min(1, h / 20000);
      const gap = Math.min(MAXGAP, 30 + r() * (36 + d * 70) + d * 50);
      nextY -= gap;
      const ny = nextY, nh = START - ny;
      if (P.mode === 'level' && nh >= P.target) { nextY = -Infinity; plats.push({ x: VW / 2, y: START - P.target, w: 130, kind: 'finish' }); return; }
      const x = 34 + r() * (VW - 68), roll = r();
      let kind = 'green';
      if (nh > 900 && roll < 0.06 + d * 0.36) kind = 'move';
      else if (nh > 2600 && roll > 0.9 - d * 0.25) kind = 'vanish';
      const p = { x, y: ny, w: 58, kind, vx: kind === 'move' ? (r() < 0.5 ? -1 : 1) * (40 + r() * 60 + d * 70) : 0 };
      const er = r();
      if (kind === 'green' && er < 0.07) p.spring = { off: (r() - 0.5) * 30, c: 0 };
      else if (kind !== 'vanish' && nh > 700 && er > 0.986) p.item = 'prop';
      else if (kind !== 'vanish' && nh > 2400 && er > 0.976 && er <= 0.986) p.item = 'jet';
      plats.push(p);
      if (r() < 0.1 + d * 0.22) plats.push({ x: 34 + r() * (VW - 68), y: ny + gap * 0.5, w: 58, kind: 'break' });
      // příšera nebo černá díra vždy stranou od plošinky, aby šla obejít
      const mr = r(), mx = ((x + VW / 2 + (r() - 0.5) * 90) % VW + VW) % VW;
      if (nh > 1600 && mr < 0.02 + d * 0.045) mons.push({ x: Math.max(30, Math.min(VW - 30, mx)), y: ny - gap * 0.5 - 6, kind: theme === 'vesmir' ? (r() < 0.6 ? 'ufo' : 'bat') : ['blob', 'red', 'bat'][Math.floor(r() * 3)], ph: r() * 6, vx: r() < 0.35 ? 50 : 0, alive: true });
      else if (nh > 4200 && mr > 0.988 - d * 0.01) holes.push({ x: Math.max(40, Math.min(VW - 40, mx)), y: ny - gap * 0.5 });
      // zlaté hvězdy na Cestě ve 30, 60 a 90 % výšky
      if (P.mode === 'level' && starIdx < 3 && nh >= P.target * (0.3 + starIdx * 0.3)) { stars.push({ x, y: ny - 36, got: false }); starIdx++; }
    }
    function fill() { while (nextY > camY - 260) addRow(); }

    // ── Vstupy ──
    const held = { l: 0, r: 0 };
    let tiltOn = false, tilt = 0;
    function shoot() {
      if (over || paused || me.dead || me.power) return;
      bullets.push({ x: me.x, y: me.y - 52 }); me.shootT = 0.28; api.sound('soft');
    }
    function say(t, d = 1.6) { msgEl.textContent = t; msgEl.hidden = false; msgEl.dataset.t = d; }

    // ── Simulace ──
    function tick(dt) {
      clock += dt;
      if (+msgEl.dataset.t > 0) { msgEl.dataset.t = +msgEl.dataset.t - dt; if (+msgEl.dataset.t <= 0) msgEl.hidden = true; }
      const want = tiltOn ? Math.max(-1, Math.min(1, tilt / 22)) * MAXV : (held.r - held.l) * MAXV;
      if (!me.dead) { me.vx += (want - me.vx) * Math.min(1, dt * 10); me.x += me.vx * dt; if (me.x < 0) me.x += VW; if (me.x > VW) me.x -= VW; if (Math.abs(me.vx) > 30) me.face = Math.sign(me.vx); }
      me.sq = Math.max(0, me.sq - dt * 5); me.shootT = Math.max(0, me.shootT - dt);
      const py = me.y;
      if (me.sucked) { me.sucked += dt; me.y += (me.hy - me.y) * dt * 5; me.x += (me.hx - me.x) * dt * 5; if (me.sucked > 1.2) finish(); return; }
      if (me.power) {
        me.power.t -= dt; me.vy = me.power.k === 'jet' ? -1000 : -560;
        if (me.power.t <= 0) { me.power = null; me.vy = -PH.jump * 0.6; }
      } else me.vy += PH.g * dt;
      me.y += me.vy * dt;
      // přistání na plošince
      if (me.vy > 0 && !me.dead) for (const p of plats) {
        if (p.gone || p.broken || py > p.y || me.y < p.y || Math.abs(wrapDx(me.x - p.x)) > p.w / 2 + 10) continue;
        if (p.kind === 'break') { p.broken = true; p.bt = 0; api.sound('erase'); continue; }
        me.y = p.y; me.sq = 1;
        if (p.spring && Math.abs(wrapDx(me.x - p.x - p.spring.off)) < 16) { me.vy = -SPRING; p.spring.c = 0.4; api.sound('line'); }
        else { me.vy = -PH.jump; api.sound('tap'); }
        if (p.kind === 'vanish') { p.gone = true; puff(p.x, p.y); }
        if (p.kind === 'finish') { done = true; api.sound('win'); say(L('Cíl! 🏁', 'Finish! 🏁'), 2); finish(); return; }
        break;
      }
      // předměty na plošinkách
      for (const p of plats) if (p.item && !me.power && !me.dead && Math.abs(wrapDx(me.x - p.x)) < 22 && Math.abs(me.y - 10 - (p.y - 12)) < 30) { me.power = { k: p.item, t: p.item === 'jet' ? 3.2 : 2.6 }; p.item = null; api.sound('star'); }
      for (const s of stars) if (!s.got && Math.abs(wrapDx(me.x - s.x)) < 24 && Math.abs(me.y - 22 - s.y) < 30) { s.got = true; got++; api.sound('star'); say(`★ ${got}/3`, 1); }
      // příšery, černé díry, výstřely
      for (const m of mons) {
        if (!m.alive) continue;
        if (m.vx) { m.x += m.vx * dt; if (m.x < 30 || m.x > VW - 30) m.vx *= -1; }
        if (me.dead || Math.abs(wrapDx(me.x - m.x)) > 26 || Math.abs(me.y - 22 - m.y) > 28) continue;
        if (me.power) continue;
        if (me.vy > 0 && me.y < m.y + 2) { m.alive = false; me.vy = -PH.jump; puff(m.x, m.y); api.sound('line'); }
        else { me.dead = true; me.vy = Math.max(0, me.vy); api.sound('error'); say(L('Au!', 'Ouch!'), 1.2); }
      }
      for (const h of holes) if (!me.dead && !me.power && Math.hypot(wrapDx(me.x - h.x), me.y - 22 - h.y) < 26) { me.dead = true; me.sucked = 0.01; me.hx = h.x; me.hy = h.y + 22; api.sound('error'); }
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]; b.y -= 900 * dt;
        const hit = mons.find(m => m.alive && Math.abs(wrapDx(b.x - m.x)) < 24 && Math.abs(b.y - m.y) < 22);
        if (hit) { hit.alive = false; puff(hit.x, hit.y); api.sound('line'); bullets.splice(i, 1); }
        else if (b.y < camY - 20) bullets.splice(i, 1);
      }
      for (const p of plats) {
        if (p.kind === 'move' && !p.gone) { p.x += p.vx * dt; if (p.x < 30 || p.x > VW - 30) { p.vx *= -1; p.x = Math.max(30, Math.min(VW - 30, p.x)); } }
        if (p.broken) p.bt += dt;
        if (p.spring && p.spring.c > 0) p.spring.c -= dt;
      }
      for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.life <= 0) fx.splice(i, 1); }
      // kamera jede jen nahoru
      if (!me.dead && me.y - VH * 0.42 < camY) camY = me.y - VH * 0.42;
      maxH = Math.max(maxH, START - me.y);
      fill();
      const cut = camY + VH + 120;
      for (const arr of [plats, mons, holes, stars]) for (let i = arr.length - 1; i >= 0; i--) if (arr[i].y > cut) arr.splice(i, 1);
      if (me.y > camY + VH + 60) finish();
    }
    function puff(x, y) { for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2; fx.push({ x, y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, life: 0.5 }); } }
    const score = () => Math.round(maxH);
    function finish() {
      if (over) return;
      over = true; api.setTimer(false);
      const sc = score();
      if (P.mode === 'level') {
        if (!done) { api.failed({ score: sc, html: `<p class="k-muted">${L(`Výška ${sc} z ${P.target}`, `Height ${sc} of ${P.target}`)}</p>` }); return; }
        api.solved({ title: L('Cíl!', 'Finish!'), stars: Math.max(1, got), score: P.target, html: `<p class="k-muted">★ ${got}/3</p>` }); return;
      }
      api.data.best = Math.max(api.data.best || 0, sc);
      api.solved({ title: `${Kit.fmtNum(sc)} ${L('bodů', 'pts')}`, stars: sc >= 25000 ? 3 : sc >= 10000 ? 2 : 1, score: sc });
    }

    // ── Kresba ──
    function draw() {
      const g = ctx, k = cssW / VW;
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      SkArt.paper(g, VW, VH, camY, theme, clock);
      g.save(); g.translate(0, -camY);
      for (const h of holes) SkArt.hole(g, h.x, h.y, clock);
      for (const p of plats) {
        SkArt.platform(g, p, clock, theme);
        if (p.spring && !p.gone) SkArt.spring(g, p.x + p.spring.off, p.y, p.spring.c);
        if (p.item === 'prop') SkArt.propeller(g, p.x, p.y - 4, clock, false);
        if (p.item === 'jet') SkArt.jetpack(g, p.x, p.y - 14, clock, false);
      }
      for (const s of stars) if (!s.got) SkArt.star(g, s.x, s.y + Math.sin(clock * 3) * 3, 13);
      for (const m of mons) if (m.alive) SkArt.monster(g, m, clock);
      for (const b of bullets) SkArt.bullet(g, b.x, b.y);
      g.fillStyle = theme === 'vesmir' ? 'rgba(200,210,255,.7)' : 'rgba(43,43,58,.45)';
      for (const f of fx) { g.beginPath(); g.arc(f.x, f.y, 3 * f.life * 2, 0, 7); g.fill(); }
      // skokan (u okraje i jeho kopie na druhé straně)
      const drawMe = x => {
        if (me.power && me.power.k === 'jet') SkArt.jetpack(g, x - me.face * 14, me.y - 22, clock, true);
        g.save(); if (me.sucked) { g.translate(x, me.y); g.rotate(me.sucked * 12); g.scale(Math.max(0.05, 1 - me.sucked), Math.max(0.05, 1 - me.sucked)); g.translate(-x, -me.y); }
        SkArt.doodler(g, x, me.y, { face: me.face, sq: me.sq, shoot: me.shootT > 0, dead: me.dead && !me.sucked, t: clock, color: theme === 'vesmir' ? '#9be05a' : undefined });
        g.restore();
        if (me.power && me.power.k === 'prop') SkArt.propeller(g, x, me.y - 46, clock, true);
      };
      drawMe(me.x); if (me.x < 30) drawMe(me.x + VW); if (me.x > VW - 30) drawMe(me.x - VW);
      g.restore();
      // skóre a cíl
      const ink = theme === 'vesmir' ? '#eef2ff' : '#2b2b3a';
      g.fillStyle = theme === 'vesmir' ? 'rgba(20,26,58,.7)' : 'rgba(248,243,227,.85)'; g.fillRect(0, 0, VW, 38);
      g.strokeStyle = theme === 'vesmir' ? 'rgba(140,170,255,.35)' : 'rgba(43,43,58,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 38); g.lineTo(VW, 38); g.stroke();
      g.fillStyle = ink; g.font = '30px "Patrick Hand", "Comic Sans MS", cursive'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(Kit.fmtNum(score()), 12, 20);
      g.textAlign = 'right'; g.font = '20px "Patrick Hand", "Comic Sans MS", cursive';
      if (P.mode === 'level') { g.fillText(`${L('cíl', 'goal')} ${Kit.fmtNum(P.target)} · ★ ${got}/3`, VW - 12, 20); }
      else if (api.data.best) g.fillText(`${L('rekord', 'best')} ${Kit.fmtNum(api.data.best)}`, VW - 12, 20);
      if (me.power) { g.fillStyle = ink; g.globalAlpha = 0.7; g.fillRect(12, 42, 80 * (me.power.t / (me.power.k === 'jet' ? 3.2 : 2.6)), 4); g.globalAlpha = 1; }
    }

    // ── Smyčka a ovládání ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      if (api.paused && api.paused() && !paused && !over) setPause(true);
      if (!paused && !over) for (let s = 0; s < speed; s++) { if (auto) autoplay(); if (!over) tick(dt); }
      draw();
    }
    function setPause(on) { if (over) return; paused = on; api.setTimer(!on); if (on) say(L('Pauza · stiskni P', 'Paused · press P'), 9999); else msgEl.hidden = true; }
    // dotyk na plátně: levá a pravá polovina drží směr, klepnutí do horní třetiny střílí
    const touches = new Map();
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); const b = cv.getBoundingClientRect(), fx0 = (e.clientX - b.left) / b.width, fy0 = (e.clientY - b.top) / b.height;
      if (fy0 < 0.33) { shoot(); return; }
      const side = fx0 < 0.5 ? 'l' : 'r'; touches.set(e.pointerId, side); held[side]++;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ukazatel už neplatí */ }
    });
    const lift = e => { const s = touches.get(e.pointerId); if (s) { held[s] = Math.max(0, held[s] - 1); touches.delete(e.pointerId); } };
    cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
    const pad = el.querySelector('.sk-pad');
    pad.addEventListener('pointerdown', e => { const b = e.target.closest('[data-b]'); if (!b) return; e.preventDefault(); b.classList.add('on'); if (b.dataset.b === 's') { shoot(); return; } held[b.dataset.b]++; try { b.setPointerCapture(e.pointerId); } catch (err) { /* ukazatel už neplatí */ } });
    const padUp = e => { const b = e.target.closest('[data-b]'); if (!b) return; b.classList.remove('on'); if (b.dataset.b !== 's') held[b.dataset.b] = Math.max(0, held[b.dataset.b] - 1); };
    pad.addEventListener('pointerup', padUp); pad.addEventListener('pointercancel', padUp);
    const keys = new Set();
    const onKeyUp = e => { const d = e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' ? 'l' : e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' ? 'r' : null; if (d && keys.has(d)) { keys.delete(d); held[d] = Math.max(0, held[d] - 1); } };
    addEventListener('keyup', onKeyUp);
    // náklon telefonu (na iOS je potřeba povolení po klepnutí)
    const tiltBtn = el.querySelector('.sk-tilt');
    const onTilt = e => { if (e.gamma != null) tilt = e.gamma; };
    if (typeof DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches) tiltBtn.hidden = false;
    tiltBtn.addEventListener('click', async () => {
      if (!tiltOn) {
        try { if (typeof DeviceOrientationEvent.requestPermission === 'function' && (await DeviceOrientationEvent.requestPermission()) !== 'granted') return; } catch (err) { return; }
        addEventListener('deviceorientation', onTilt); tiltOn = true;
      } else { removeEventListener('deviceorientation', onTilt); tiltOn = false; }
      tiltBtn.classList.toggle('on', tiltOn);
    });
    // automat pro testy: míří na nejvyšší dosažitelnou plošinku a střílí příšery nad sebou
    let auto = false;
    function autoplay() {
      if (me.dead) return;
      const apex = me.vy < 0 ? me.y - me.vy * me.vy / (2 * PH.g) : me.y;
      let best = null;
      for (const p of plats) { if (p.kind === 'break' || p.gone || p.broken || p.y < apex + 6 || p.y > me.y + 300) continue; if (!best || p.y < best.y) best = p; }
      held.l = held.r = 0;
      if (best) { const dx = wrapDx(best.x - me.x); if (dx > 8) held.r = 1; else if (dx < -8) held.l = 1; }
      if (mons.some(m => m.alive && m.y < me.y - 30 && m.y > me.y - 260 && Math.abs(wrapDx(m.x - me.x)) < 26) && !bullets.length) shoot();
    }

    fit(); addEventListener('resize', fit);
    try { document.fonts.load('30px "Patrick Hand"'); } catch (err) { /* písmo není nutné */ }
    fill(); api.setTimer(true);
    if (P.mode === 'level') say(`${L('Doskoč do výšky', 'Reach the height')} ${Kit.fmtNum(P.target)}`, 2);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => null,
      progress: () => (P.mode === 'level' ? Math.min(1, maxH / P.target) : 0),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('keyup', onKeyUp); removeEventListener('deviceorientation', onTilt); },
      pause() { setPause(true); },
      onKey(e) {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); setPause(!paused); return; }
        const d = e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' ? 'l' : e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' ? 'r' : null;
        if (d) { e.preventDefault(); if (!keys.has(d)) { keys.add(d); held[d]++; } return; }
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); if (!e.repeat) shoot(); }
      },
      _state: () => ({ x: +me.x.toFixed(1), y: +me.y.toFixed(1), vy: +me.vy.toFixed(1), score: score(), dead: me.dead, over, plats: plats.length, got }),
      _auto(on) { auto = on !== false; },
      _speed(n) { speed = Math.max(1, n | 0); },
      _solve() { maxH = Math.max(maxH, P.mode === 'level' ? P.target : 12000); done = true; got = 3; finish(); },
    };
  }

  // úvodní obrázek: skokan ve výskoku nad plošinkami, pružina, příšera a vrtulka na papíře
  function art(el) {
    el.innerHTML = '<canvas width="520" height="360" style="object-fit:contain"></canvas>';
    const g = el.querySelector('canvas').getContext('2d');
    g.beginPath(); g.roundRect(0, 0, 520, 360, 28); g.clip();
    SkArt.paper(g, 520, 360, 0, 'klasik', 0);
    const pl = (x, y, kind) => SkArt.platform(g, { x, y, w: 64, kind }, 0, 'klasik');
    pl(110, 250, 'green'); pl(270, 214, 'move'); pl(420, 254, 'green'); pl(390, 140, 'green'); pl(140, 150, 'break'); pl(250, 66, 'vanish');
    SkArt.spring(g, 420, 254, 0);
    SkArt.monster(g, { x: 455, y: 62, kind: 'blob', ph: 0 }, 0.4);
    SkArt.propeller(g, 390, 136, 0, false);
    g.strokeStyle = 'rgba(43,43,58,.3)'; g.lineWidth = 2; g.setLineDash([5, 6]); g.beginPath(); g.moveTo(110, 246); g.quadraticCurveTo(160, 90, 228, 158); g.stroke(); g.setLineDash([]);
    g.save(); g.translate(250, 170); g.scale(1.6, 1.6); SkArt.doodler(g, 0, 0, { face: 1, sq: 0, t: 0 }); g.restore();
    SkArt.bullet(g, 452, 104); SkArt.bullet(g, 455, 132);
    SkArt.star(g, 70, 56, 16); SkArt.star(g, 486, 190, 11);
  }
  return { DIFFS, generate, create, art, levelSpec };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'skokan', title: 'SKOKAN', wording: 'play',
  tagline: Kit.L('Na motivy Doodle Jumpu: panáček z čtverečkovaného sešitu skáče po plošinkách pořád výš. Pružiny, vrtulka, raketový batoh, příšery a černé díry. Jak vysoko doskočíš?', 'In the spirit of Doodle Jump: a doodle from a squared notebook bounces up the platforms higher and higher. Springs, a propeller, a jetpack, monsters and black holes. How high can you go?'),
  diffs: Skokan.DIFFS, generate: Skokan.generate, create: Skokan.create, art: Skokan.art,
  dailyDiff: () => 'klasik',
  levelDiff: () => 'klasik',
  rules: Kit.L(`<p>Skokan skáče sám. Ty ho posíláš doleva a doprava: šipkami, tlačítky ◀ ▶, podržením levé nebo pravé poloviny obrazovky, nebo nakláněním telefonu. Kdo vyběhne z okraje, objeví se na druhé straně.</p>
    <ul><li><b>Zelené</b> plošinky stojí, <b>modré</b> jezdí, <b>bílé</b> po odrazu zmizí a <b>hnědé</b> se pod tebou zlomí.</li>
    <li><b>Pružina</b> vystřelí vysoko, <b>vrtulka</b> a <b>raketový batoh</b> chvíli nesou nahoru.</li>
    <li><b>Příšery</b> zastřelíš (mezerník, ↑, tlačítko ▲ nebo klepnutí do horní části) nebo na ně skoč shora. Zespodu tě shodí. <b>Černá díra</b> tě vcucne.</li>
    <li>Body jsou nejvyšší dosažená výška. Na <b>Cestě</b> doskoč do cíle a cestou seber tři zlaté hvězdy.</li>
    <li>P pozastaví hru.</li></ul>`,
    `<p>The jumper bounces by itself. You steer it left and right: arrows, the ◀ ▶ buttons, holding the left or right half of the screen, or tilting your phone. Run off one edge and you come back on the other.</p>
    <ul><li><b>Green</b> platforms stay, <b>blue</b> ones move, <b>white</b> ones vanish after a bounce and <b>brown</b> ones break under you.</li>
    <li>A <b>spring</b> launches you high, the <b>propeller</b> and the <b>jetpack</b> carry you up for a while.</li>
    <li>Shoot <b>monsters</b> (Space, ↑, the ▲ button or a tap in the top part) or jump on them from above. From below they knock you down. A <b>black hole</b> sucks you in.</li>
    <li>Your score is the highest point reached. On the <b>Path</b> reach the finish and grab three gold stars on the way.</li>
    <li>P pauses the game.</li></ul>`),
  achievements: [
    { id: 'h10k', name: Kit.L('Nad mraky', 'Above the clouds'), desc: Kit.L('10 000 bodů v jednom skoku', '10,000 points in one run'), prog: s => [Math.min(10000, (s.data && s.data.best) || 0), 10000] },
    { id: 'h30k', name: Kit.L('Na Měsíc', 'To the Moon'), desc: Kit.L('30 000 bodů v jednom skoku', '30,000 points in one run'), prog: s => [Math.min(30000, (s.data && s.data.best) || 0), 30000] },
  ],
});
