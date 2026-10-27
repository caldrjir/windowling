'use strict';
// ── VLAK · Windowling Hlavolamy ─────────────────────────────────────────────
// Logický hlavolam na motivy české klasiky Vlak (Miroslav Němeček, 1993): mašinka posbírá všechny
// předměty (každý přidá vagón), pak se otevře brána a vlak jí musí projet. Vlak se posouvá po
// krocích, žádný spěch: jde o pořadí, protože rostoucí vlak si snadno sám zatarasí cestu.
// Úrovně se generují ze semínka a vždy jdou projet (viz core.js), Zpět a Znovu jsou zdarma.
const Vlak = (() => {
  const L = Kit.L;
  const DIFFS = [
    { id: 'lehka', name: L('Lehká', 'Easy'), note: L('malá louka, 8 předmětů', 'small meadow, 8 items'), w: 9, h: 9, items: 8, cover: 0.7, decoy: 0.3, par: 120 },
    { id: 'stredni', name: L('Střední', 'Medium'), note: L('14 předmětů', '14 items'), w: 11, h: 11, items: 14, cover: 0.72, decoy: 0.3, par: 300 },
    { id: 'tezka', name: L('Těžká', 'Hard'), note: L('22 předmětů', '22 items'), w: 13, h: 13, items: 22, cover: 0.75, decoy: 0.3, par: 540 },
    { id: 'expert', name: L('Expert', 'Expert'), note: L('32 předmětů, dlouhý vlak', '32 items, a long train'), w: 15, h: 15, items: 32, cover: 0.78, decoy: 0.28, par: 900 },
  ];
  const STEP = 0.11; // délka animace jednoho kroku
  function generate(seed, diffId, ctx = {}) {
    const d = DIFFS.find(x => x.id === diffId) || DIFFS[1];
    const o = Object.assign({}, d);
    if (ctx.kind === 'level') { // na Cestě přibývají předměty postupně, první úrovně jsou menší
      const n = ctx.key, base = { lehka: 0, stredni: 25, tezka: 60, expert: 95 }[d.id] || 0;
      if (n <= 10) { o.w = 7; o.h = 7 + (n > 5 ? 1 : 0); o.items = 3 + Math.floor(n / 3); }
      else o.items = Math.max(4, Math.min(d.items, Math.round(d.items * 0.6 + (n - base) * 0.35)));
    }
    const lv = VlCore.generate(seed, o);
    return Object.assign(lv, { seed, diff: d.id, par: d.par });
  }

  function create(el, P, saved, api) {
    const coarse = matchMedia('(pointer: coarse)').matches;
    el.innerHTML = `<div class="vl-wrap"><canvas class="vl-cv"></canvas>
      <div class="vl-bar"><button class="k-btn ghost vl-undo" data-b="undo">↶ ${L('Zpět', 'Undo')}</button><span class="vl-info"></span><button class="k-btn ghost" data-b="restart">⟳ ${L('Znovu', 'Restart')}</button></div>
      <div class="vl-pad" ${coarse ? '' : 'hidden'}><button data-d="3" aria-label="↑">▲</button><button data-d="2" aria-label="←">◀</button><button data-d="1" aria-label="↓">▼</button><button data-d="0" aria-label="→">▶</button></div>
      <p class="vl-keys">${L('Šipky nebo WASD posunou vlak o políčko, Z zpět, R znovu. Ťuknutí vedle mašinky ukazuje směr.', 'Arrows or WASD move the train one tile, Z undoes, R restarts. Tap beside the engine to steer.')}</p></div>`;
    const cv = el.querySelector('.vl-cv'), ctx = cv.getContext('2d'), info = el.querySelector('.vl-info');
    let T = 24, dpr = 1, boardImg = null;
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      const maxH = Math.max(300, innerHeight - (coarse ? 330 : 240));
      T = Math.max(16, Math.min(56, Math.floor(Math.min((box - 4) / P.w, maxH / P.h))));
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(P.w * T * dpr); cv.height = Math.round(P.h * T * dpr);
      cv.style.width = P.w * T + 'px'; cv.style.height = P.h * T + 'px';
      boardImg = VlArt.board(P, T, dpr);
    }

    // ── Stav ──
    const DIRS = VlCore.DIRS;
    let body, prev, dir, items, phase, frac = 1, clock = 0, bumpT = 0, over = false, auto = false, speed = 1, pending = null;
    let history = [], undos = 0, restarts = 0, moves = 0, stuck = false;
    const smoke = [], sparks = [];
    function reset() {
      body = [{ x: P.start.x, y: P.start.y, kind: null }];
      prev = body.map(b => ({ x: b.x, y: b.y }));
      dir = P.start.dir; items = P.items.map(it => Object.assign({ got: false }, it));
      phase = 'ready'; frac = 1; history = []; stuck = false; pending = null;
    }
    reset();
    const left = () => items.filter(i => !i.got).length;
    const gateOpen = () => left() === 0;
    const wallAt = (x, y) => x < 0 || y < 0 || x >= P.w || y >= P.h || P.wall[y * P.w + x] === 1;
    // je tah možný? (zeď, zavřená brána, vlastní vagóny; ocas se posune, pokud vlak neroste)
    function blocked(d) {
      const h = body[0], nx = h.x + DIRS[d][0], ny = h.y + DIRS[d][1];
      if (nx === P.gate.x && ny === P.gate.y) return !gateOpen();
      if (wallAt(nx, ny)) return true;
      const grow = items.some(i => !i.got && i.x === nx && i.y === ny);
      for (let k = 0; k < body.length - (grow ? 0 : 1); k++) if (body[k].x === nx && body[k].y === ny) return true;
      return false;
    }
    function advance(nx, ny, kind) {
      prev = body.map(b => ({ x: b.x, y: b.y }));
      const tail = body[body.length - 1], tx = tail.x, ty = tail.y;
      for (let k = body.length - 1; k > 0; k--) { body[k].x = body[k - 1].x; body[k].y = body[k - 1].y; }
      body[0].x = nx; body[0].y = ny;
      if (kind) { body.push({ x: tx, y: ty, kind }); prev.push({ x: tx, y: ty }); }
    }
    function steer(d) {
      if (over || phase === 'win') return;
      if (frac < 1) { pending = d; return; }
      move(d);
    }
    function move(d) {
      if (blocked(d)) { bumpT = 0.25; api.sound('erase'); return; }
      const h = body[0], nx = h.x + DIRS[d][0], ny = h.y + DIRS[d][1];
      if (phase === 'ready') { phase = 'play'; api.setTimer(true); }
      history.push({ body: body.map(b => ({ ...b })), dir, got: items.map(i => i.got) });
      dir = d; moves++; frac = 0;
      if (nx === P.gate.x && ny === P.gate.y) { advance(nx, ny, null); phase = 'win'; api.sound('win'); return; }
      const it = items.find(i => !i.got && i.x === nx && i.y === ny);
      advance(nx, ny, it ? it.kind : null);
      if (it) {
        it.got = true;
        api.sound(gateOpen() ? 'line' : 'place');
        for (let k = 0; k < 10; k++) sparks.push({ x: (nx + 0.5) * T, y: (ny + 0.5) * T, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.5 });
      } else api.sound('soft');
      smoke.push({ x: (nx + 0.5) * T, y: (ny + 0.3) * T, vx: (Math.random() - 0.5) * 12, vy: -18, r: T * 0.08, life: 0.9 });
      stuck = [0, 1, 2, 3].every(blocked);
      if (stuck) api.sound('error');
      api.changed && api.changed();
    }
    function undo() {
      if (over || phase === 'win' || !history.length) return;
      const s = history.pop();
      body = s.body; prev = body.map(b => ({ x: b.x, y: b.y })); dir = s.dir; s.got.forEach((g, i) => (items[i].got = g));
      frac = 1; stuck = false; pending = null; undos++; api.sound('tap');
    }
    function restart() {
      if (over || phase === 'win' || phase === 'ready') return;
      reset(); restarts++; api.sound('tap');
    }
    function step(dt) {
      clock += dt; bumpT = Math.max(0, bumpT - dt);
      for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * T * 0.3; p.life -= dt; if (p.life <= 0) smoke.splice(i, 1); }
      for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) sparks.splice(i, 1); }
      if (phase === 'win') {
        // vlak zajíždí do brány článek po článku; článek v bráně zmizí
        frac = Math.min(1, frac + dt / STEP);
        if (frac >= 1) {
          if (body.length && body[0].x === P.gate.x && body[0].y === P.gate.y) { body.shift(); prev.shift(); }
          if (!body.length) { finish(); return; }
          advance(P.gate.x, P.gate.y, null); frac = 0;
        }
        return;
      }
      if (frac < 1) { frac = Math.min(1, frac + dt / STEP); if (frac >= 1 && pending != null) { const d = pending; pending = null; move(d); } }
      if (auto && frac >= 1) autopilot();
    }
    function finish() {
      if (over) return; over = true; api.setTimer(false);
      const back = undos + restarts * 3, stars = back === 0 ? 3 : back <= 6 ? 2 : 1;
      api.solved({ title: L('Vlak dojel!', 'The train made it!'), stars, html: `<p class="k-muted">${L(`${P.items.length} vagónů · ${moves} kroků · zpět ${undos}× · znovu ${restarts}×`, `${P.items.length} wagons · ${moves} moves · ${undos} undos · ${restarts} restarts`)}</p>` });
    }

    // ── Kresba ──
    function pos(k) {
      const a = prev[k] || body[k], b = body[k], f = frac;
      const x = (a.x + (b.x - a.x) * f + 0.5) * T, y = (a.y + (b.y - a.y) * f + 0.5) * T;
      let dx = b.x - a.x, dy = b.y - a.y;
      if (!dx && !dy) { const c = k ? body[k - 1] : null; if (c) { dx = c.x - b.x; dy = c.y - b.y; } else { dx = DIRS[dir][0]; dy = DIRS[dir][1]; } }
      return { x, y, a: Math.atan2(dy, dx) };
    }
    function draw() {
      const g = ctx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (boardImg) g.drawImage(boardImg, 0, 0);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      VlArt.gate(g, P.gate.x * T, P.gate.y * T, T, gateOpen(), clock);
      for (const it of items) if (!it.got) VlArt.item(g, it.kind, (it.x + 0.5) * T, (it.y + 0.5) * T + Math.sin(clock * 3 + it.x) * T * 0.04, T * 0.68);
      const shake = bumpT > 0 ? Math.sin(clock * 80) * 2 : 0;
      g.save(); g.translate(shake, 0);
      const ps = body.map((_, k) => pos(k));
      g.strokeStyle = '#3a2a1c'; g.lineWidth = Math.max(2, T * 0.08);
      for (let k = 1; k < ps.length; k++) { g.beginPath(); g.moveTo(ps[k - 1].x, ps[k - 1].y); g.lineTo(ps[k].x, ps[k].y); g.stroke(); }
      for (let k = ps.length - 1; k >= 0; k--) {
        const b = body[k], inGate = phase === 'win' && b.x === P.gate.x && b.y === P.gate.y;
        g.globalAlpha = inGate ? Math.max(0, 1 - frac) : 1;
        if (b.kind) VlArt.wagon(g, ps[k].x, ps[k].y, ps[k].a, T, b.kind); else VlArt.loco(g, ps[k].x, ps[k].y, ps[k].a, T, clock);
        g.globalAlpha = 1;
      }
      g.restore();
      for (const p of smoke) VlArt.smoke(g, p);
      for (const p of sparks) { g.fillStyle = `rgba(255,230,120,${p.life * 2})`; g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
      const W = P.w * T, H = P.h * T;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const label = (s, y, size, col = '#fff') => { g.font = `800 ${size}px Unbounded, sans-serif`; g.lineWidth = 5; g.lineJoin = 'round'; g.strokeStyle = 'rgba(20,30,20,.75)'; g.strokeText(s, W / 2, y); g.fillStyle = col; g.fillText(s, W / 2, y); };
      const box = (y, h) => { g.fillStyle = 'rgba(10,20,10,.45)'; g.beginPath(); g.roundRect(W * 0.06, y, W * 0.88, h, 14); g.fill(); };
      const bh = Math.max(64, T * 2.6), big = Math.max(13, Math.min(20, T * 0.62)), small = Math.max(9, Math.min(13, T * 0.4));
      if (stuck) {
        const y = H - bh - T * 0.3;
        box(y, bh);
        label(L('VLAK UVÍZL', 'THE TRAIN IS STUCK'), y + bh * 0.36, big, '#ffd0c8');
        label(L('vrať se tlačítkem Zpět (Z)', 'step back with Undo (Z)'), y + bh * 0.7, small, '#fff3c0');
      }
      const txt = phase === 'ready' ? L(`Naplánuj trasu: seber ${items.length} předmětů a vjeď do brány`, `Plan your route: collect ${items.length} items, then enter the gate`) : L(`předměty ${items.length - left()}/${items.length} · kroky ${moves}`, `items ${items.length - left()}/${items.length} · moves ${moves}`);
      if (info.textContent !== txt) info.textContent = txt;
      el.querySelector('.vl-undo').disabled = !history.length || phase === 'win';
    }

    // ── Smyčka a ovládání ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      if (!over) for (let i = 0; i < speed; i++) step(dt);
      draw();
    }
    // ťuknutí: směr od mašinky k prstu; přejetí: směr tahu
    let sx = 0, sy = 0;
    cv.addEventListener('pointerdown', e => { e.preventDefault(); sx = e.clientX; sy = e.clientY; });
    cv.addEventListener('pointerup', e => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.hypot(dx, dy) > 18) { steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3); return; }
      const r = cv.getBoundingClientRect(), h = body[0], hx = (h.x + 0.5) * T, hy = (h.y + 0.5) * T, px = e.clientX - r.left - hx, py = e.clientY - r.top - hy;
      if (Math.hypot(px, py) < T * 0.4) return;
      steer(Math.abs(px) > Math.abs(py) ? (px > 0 ? 0 : 2) : py > 0 ? 1 : 3);
    });
    el.querySelector('.vl-pad').addEventListener('pointerdown', e => { const b = e.target.closest('[data-d]'); if (!b) return; e.preventDefault(); steer(+b.dataset.d); });
    el.querySelector('[data-b="undo"]').addEventListener('click', undo);
    el.querySelector('[data-b="restart"]').addEventListener('click', restart);
    // automat pro testy: jede po vygenerované trase
    function autopilot() {
      const h = body[0], i = P.path.findIndex(([x, y]) => x === h.x && y === h.y);
      const nxt = P.path[i + 1]; if (!nxt) return;
      const d = DIRS.findIndex(([ax, ay]) => ax === nxt[0] - h.x && ay === nxt[1] - h.y);
      if (d >= 0) move(d);
    }

    fit(); addEventListener('resize', fit);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => null,
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); },
      pause() {},
      onKey(e) {
        const k = { ArrowRight: 0, d: 0, D: 0, ArrowDown: 1, s: 1, S: 1, ArrowLeft: 2, a: 2, A: 2, ArrowUp: 3, w: 3, W: 3 }[e.key];
        if (k != null) { e.preventDefault(); steer(k); }
        else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') { e.preventDefault(); undo(); }
        else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); }
      },
      _state: () => ({ phase, len: body.length, left: left(), undos, restarts, moves, stuck, over, head: [body[0].x, body[0].y] }),
      _auto(on) { auto = on !== false; },
      _speed(n) { speed = Math.max(1, n | 0); },
      _steer(d) { steer(d); },
      _solve() { phase = 'win'; finish(); },
    };
  }

  // úvodní obrázek: mašinka se dvěma vagóny na louce u brány
  function art(el) {
    el.innerHTML = '<canvas width="720" height="720"></canvas>';
    const g = el.querySelector('canvas').getContext('2d');
    g.scale(2, 2);
    g.beginPath(); g.roundRect(0, 0, 360, 360, 24); g.clip();
    const t = 45, Lv = { w: 8, h: 8, wall: [] };
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) Lv.wall.push(x === 0 || y === 0 || x === 7 || y === 7 || (x === 5 && y === 2) || (x === 2 && y === 5) ? 1 : 0);
    g.drawImage(VlArt.board(Lv, t, 2), 0, 0, 360, 360);
    VlArt.gate(g, 5 * t, 5 * t, t, true, 0.5);
    VlArt.item(g, 'jablko', 5.5 * t, 1.5 * t, t * 0.68); VlArt.item(g, 'diamant', 1.5 * t, 4.5 * t, t * 0.68);
    VlArt.wagon(g, 1.5 * t, 2.5 * t, -Math.PI / 2, t, 'koruna');
    VlArt.wagon(g, 2.5 * t, 1.5 * t, 0, t, 'hvezda');
    g.strokeStyle = '#3a2a1c'; g.lineWidth = 4; g.beginPath(); g.moveTo(1.5 * t, 2.5 * t); g.lineTo(1.5 * t, 1.5 * t); g.lineTo(2.5 * t, 1.5 * t); g.lineTo(3.5 * t, 1.5 * t); g.stroke();
    VlArt.wagon(g, 2.5 * t, 1.5 * t, 0, t, 'hvezda');
    VlArt.loco(g, 3.5 * t, 1.5 * t, 0, t, 0);
    g.fillStyle = 'rgba(240,240,245,.6)'; g.beginPath(); g.arc(3.8 * t, 1.15 * t, 7, 0, 7); g.arc(4.1 * t, 0.9 * t, 10, 0, 7); g.fill();
  }
  return { DIFFS, generate, create, art };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'vlak', title: 'VLAK',
  tagline: Kit.L('Logický hlavolam na motivy české klasiky Vlak (1993): posbírej všechny předměty a vjeď do brány. Každý předmět přidá vagón, tak naplánuj pořadí, ať se dlouhý vlak nezamotá.', 'A logic puzzle in the spirit of the Czech classic Vlak (1993): collect every item and enter the gate. Each item adds a wagon, so plan the order before the long train ties itself in knots.'),
  diffs: Vlak.DIFFS, generate: Vlak.generate, create: Vlak.create, art: Vlak.art,
  dailyDiff: () => 'stredni',
  levelDiff: n => (n <= 25 ? 'lehka' : n <= 60 ? 'stredni' : n <= 95 ? 'tezka' : 'expert'),
  rules: Kit.L(`<p>Každý stisk šipky (WASD, přejetí prstem nebo ťuknutí vedle mašinky) posune vlak o jedno políčko. Nikam se nespěchá, jde o plánování.</p>
    <ul><li>Posbírej všechny předměty. Každý se naloží na nový vagón a vlak se prodlouží.</li>
    <li>Když je vše posbíráno, brána se otevře. Vjeď do ní a úroveň je hotová.</li>
    <li>Do zdi, zavřené brány ani do vlastních vagonů vlak nevjede. Když už nemá kam, uvízl: vrať se o krok (Zpět, Z) nebo začni znovu (R).</li>
    <li>Pořadí je všechno: dlouhý vlak zabere skoro celou louku, takže si cestu rozmysli dopředu. Každá úroveň jde projet.</li>
    <li>Hvězdy: bez vracení 3, s pár kroky zpět 2.</li></ul>`,
    `<p>Each arrow press (WASD, a swipe or a tap beside the engine) moves the train one tile. There is no rush; it is all about planning.</p>
    <ul><li>Collect every item. Each one is loaded onto a new wagon and the train grows longer.</li>
    <li>Once everything is collected, the gate opens. Drive into it to finish the level.</li>
    <li>The train cannot enter walls, the closed gate or its own wagons. When it has nowhere to go it is stuck: step back (Undo, Z) or restart (R).</li>
    <li>Order is everything: the long train fills most of the meadow, so think your route through. Every level can be solved.</li>
    <li>Stars: 3 without stepping back, 2 with a few undos.</li></ul>`),
  achievements: [
    { id: 'v10', name: Kit.L('Strojvůdce', 'Engine driver'), desc: Kit.L('Projeď 10 úrovní', 'Finish 10 levels'), prog: s => [Math.min(10, (s.stats && s.stats.solved) || 0), 10] },
  ],
});
