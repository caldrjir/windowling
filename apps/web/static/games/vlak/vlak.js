'use strict';
// ── VLAK · Windowling Hlavolamy ─────────────────────────────────────────────
// Na motivy české klasiky Vlak (Miroslav Němeček, 1993): mašinka jezdí po louce, posbírá všechny
// předměty (každý přidá vagón), pak se otevře brána a vlak jí musí projet. Náraz do zdi, do
// zavřené brány nebo do vlastních vagonů úroveň vrátí na začátek. Úrovně se generují ze
// semínka a vždy jdou projet (viz core.js).
const Vlak = (() => {
  const L = Kit.L;
  const DIFFS = [
    { id: 'lehka', name: L('Lehká', 'Easy'), note: L('malá louka, 6 předmětů', 'small meadow, 6 items'), w: 11, h: 13, items: 6, walls: 0.35, minLen: 40, maxLen: 70, tick: 0.24, par: 90 },
    { id: 'stredni', name: L('Střední', 'Medium'), note: L('10 předmětů', '10 items'), w: 13, h: 16, items: 10, walls: 0.4, minLen: 70, maxLen: 120, tick: 0.2, par: 180 },
    { id: 'tezka', name: L('Těžká', 'Hard'), note: L('14 předmětů, rychleji', '14 items, faster'), w: 15, h: 19, items: 14, walls: 0.45, minLen: 110, maxLen: 180, tick: 0.16, par: 300 },
    { id: 'expert', name: L('Expert', 'Expert'), note: L('20 předmětů, dlouhý vlak', '20 items, a long train'), w: 17, h: 21, items: 20, walls: 0.45, minLen: 150, maxLen: 240, tick: 0.14, par: 420 },
  ];
  const levelDiff = n => (n <= 25 ? 'lehka' : n <= 60 ? 'stredni' : n <= 95 ? 'tezka' : 'expert');
  function generate(seed, diffId, ctx = {}) {
    const d = DIFFS.find(x => x.id === diffId) || DIFFS[1];
    const o = Object.assign({}, d);
    if (ctx.kind === 'level') { // na Cestě přibývají předměty postupně
      const n = ctx.key, base = { lehka: 0, stredni: 25, tezka: 60, expert: 95 }[d.id] || 0;
      o.items = Math.max(3, Math.min(d.items, 3 + Math.floor((n - base) / 3)));
    }
    const lv = VlCore.generate(seed, o);
    return Object.assign(lv, { seed, diff: d.id, tick: d.tick, par: d.par });
  }

  function create(el, P, saved, api) {
    const coarse = matchMedia('(pointer: coarse)').matches;
    el.innerHTML = `<div class="vl-wrap"><canvas class="vl-cv"></canvas>
      <div class="vl-pad" ${coarse ? '' : 'hidden'}><button data-d="3" aria-label="↑">▲</button><button data-d="2" aria-label="←">◀</button><button data-d="1" aria-label="↓">▼</button><button data-d="0" aria-label="→">▶</button></div>
      <p class="vl-keys">${L('Šipky nebo WASD, přejetí prstem či ťuknutí ukazuje směr. P pauza', 'Arrows or WASD; swipe or tap to steer. P pauses')}</p></div>`;
    const cv = el.querySelector('.vl-cv'), ctx = cv.getContext('2d');
    let T = 24, dpr = 1, boardImg = null;
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      const maxH = Math.max(320, innerHeight - (coarse ? 260 : 190));
      T = Math.max(14, Math.floor(Math.min((box - 4) / P.w, maxH / P.h)));
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(P.w * T * dpr); cv.height = Math.round(P.h * T * dpr);
      cv.style.width = P.w * T + 'px'; cv.style.height = P.h * T + 'px';
      boardImg = VlArt.board(P, T, dpr);
    }

    // ── Stav ──
    const DIRS = VlCore.DIRS;
    let body, prev, dir, queue, items, phase, crashes = 0, acc = 0, frac = 0, clock = 0, crashT = 0, winT = 0, over = false, paused = false, speed = 1, auto = false, autoI = 0;
    const smoke = [], sparks = [];
    function reset() {
      body = [{ x: P.start.x, y: P.start.y, kind: null }];
      prev = body.map(b => ({ x: b.x, y: b.y }));
      dir = P.start.dir; queue = [];
      items = P.items.map(it => Object.assign({ got: false }, it));
      phase = 'ready'; acc = 0; frac = 1; autoI = 0;
    }
    reset();
    const left = () => items.filter(i => !i.got).length;
    const gateOpen = () => left() === 0;
    const wallAt = (x, y) => x < 0 || y < 0 || x >= P.w || y >= P.h || P.wall[y * P.w + x] === 1;

    function steer(d) {
      if (over || paused || phase === 'crash' || phase === 'win') return;
      const last = queue.length ? queue[queue.length - 1] : dir;
      if (phase !== 'ready' && (d + 2) % 4 === last) return; // otočit na místě nejde
      if (d === last && phase !== 'ready') return;
      if (queue.length < 2) queue.push(d);
      if (phase === 'ready') { phase = 'play'; api.setTimer(true); acc = P.tick; }
    }
    // posun vlaku: každý článek na místo předchozího, mašinka na (nx, ny); grow = nový vagón na konec
    function advance(nx, ny, kind) {
      prev = body.map(b => ({ x: b.x, y: b.y }));
      const tail = body[body.length - 1], tx = tail.x, ty = tail.y;
      for (let k = body.length - 1; k > 0; k--) { body[k].x = body[k - 1].x; body[k].y = body[k - 1].y; }
      body[0].x = nx; body[0].y = ny;
      if (kind) { body.push({ x: tx, y: ty, kind }); prev.push({ x: tx, y: ty }); }
    }
    function tick() {
      if (queue.length) dir = queue.shift();
      const head = body[0], nx = head.x + DIRS[dir][0], ny = head.y + DIRS[dir][1];
      const atGate = nx === P.gate.x && ny === P.gate.y;
      if (atGate && gateOpen()) { advance(nx, ny, null); phase = 'win'; winT = 0; api.sound('win'); return; }
      if (wallAt(nx, ny) || atGate) return crash();
      const it = items.find(i => !i.got && i.x === nx && i.y === ny);
      // ocas se posune (pokud vlak neroste), takže na jeho políčko se smí
      for (let k = 0; k < body.length - (it ? 0 : 1); k++) if (body[k].x === nx && body[k].y === ny) return crash();
      advance(nx, ny, it ? it.kind : null);
      if (it) {
        it.got = true;
        api.sound(gateOpen() ? 'line' : 'place');
        for (let k = 0; k < 10; k++) sparks.push({ x: (nx + 0.5) * T, y: (ny + 0.5) * T, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.5 });
        api.changed && api.changed();
      } else api.sound('soft');
    }
    function crash() {
      phase = 'crash'; crashT = 0; crashes++;
      api.mistake();
      for (let k = 0; k < 18; k++) smoke.push({ x: (body[0].x + 0.5) * T, y: (body[0].y + 0.5) * T, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 40, r: T * (0.15 + Math.random() * 0.2), life: 1.2 });
    }
    function step(dt) {
      clock += dt;
      for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * T * 0.3; p.life -= dt; if (p.life <= 0) smoke.splice(i, 1); }
      for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) sparks.splice(i, 1); }
      if (phase === 'crash') { crashT += dt; if (crashT > 1.1) reset(); return; }
      if (phase === 'win') {
        // vlak zajíždí do brány článek po článku; článek v bráně zmizí
        winT += dt; frac = Math.min(1, frac + dt / P.tick);
        if (frac >= 1) {
          if (body.length && body[0].x === P.gate.x && body[0].y === P.gate.y) { body.shift(); prev.shift(); }
          if (!body.length) { finish(); return; }
          advance(P.gate.x, P.gate.y, null); frac = 0;
        }
        return;
      }
      if (phase !== 'play') return;
      acc += dt;
      if (auto) autopilot();
      while (acc >= P.tick && phase === 'play') { acc -= P.tick; tick(); frac = 0; }
      frac = phase === 'play' ? Math.min(1, acc / P.tick) : frac;
      // kouř z komína
      if (Math.random() < dt * 12 && body.length) { const h = pos(0); smoke.push({ x: h.x + Math.cos(h.a) * T * 0.15, y: h.y + Math.sin(h.a) * T * 0.15, vx: (Math.random() - 0.5) * 12, vy: -18, r: T * 0.08, life: 0.9 }); }
    }
    function finish() {
      if (over) return; over = true; api.setTimer(false);
      const stars = crashes === 0 ? 3 : crashes === 1 ? 2 : 1;
      api.solved({ title: L('Vlak dojel!', 'The train made it!'), stars, html: `<p class="k-muted">${L(`${P.items.length} vagónů · ${crashes}× náraz`, `${P.items.length} wagons · ${crashes} crash${crashes === 1 ? '' : 'es'}`)}</p>` });
    }

    // ── Kresba ──
    // poloha článku k s plynulým posunem mezi políčky a úhel podle směru jízdy
    function pos(k) {
      const a = prev[k] || body[k], b = body[k], f = phase === 'crash' ? 1 : frac;
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
      const open = gateOpen();
      VlArt.gate(g, P.gate.x * T, P.gate.y * T, T, open, clock);
      for (const it of items) if (!it.got) VlArt.item(g, it.kind, (it.x + 0.5) * T, (it.y + 0.5) * T + Math.sin(clock * 3 + it.x) * T * 0.04, T * 0.68);
      // spřáhla, vagóny od konce, mašinka nahoře
      const shake = phase === 'crash' && crashT < 0.4 ? Math.sin(clock * 80) * 2 : 0;
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
      if (phase === 'crash') { g.fillStyle = `rgba(255,60,60,${Math.max(0, 0.35 - crashT * 0.3)})`; g.fillRect(0, 0, P.w * T, P.h * T); }
      // nápisy
      const W = P.w * T, H = P.h * T;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const label = (s, y, size, col = '#fff') => { g.font = `800 ${size}px Unbounded, sans-serif`; g.lineWidth = 5; g.lineJoin = 'round'; g.strokeStyle = 'rgba(20,30,20,.75)'; g.strokeText(s, W / 2, y); g.fillStyle = col; g.fillText(s, W / 2, y); };
      if (phase === 'ready') {
        g.fillStyle = 'rgba(10,20,10,.35)'; g.beginPath(); g.roundRect(W * 0.1, H * 0.4, W * 0.8, Math.max(64, T * 3), 14); g.fill();
        label(L('ZVOL SMĚR', 'PICK A DIRECTION'), H * 0.4 + Math.max(64, T * 3) * 0.36, Math.max(13, Math.min(20, T * 0.7)));
        label(L(`seber ${items.length} předmětů a vjeď do brány`, `collect ${items.length} items, then enter the gate`), H * 0.4 + Math.max(64, T * 3) * 0.7, Math.max(9, Math.min(13, T * 0.45)), '#fff3c0');
      } else if (phase === 'crash') label(L('BUM!', 'CRASH!'), H * 0.45, Math.max(18, T), '#ffd0c8');
      if (paused) { g.fillStyle = 'rgba(10,8,20,.5)'; g.fillRect(0, 0, W, H); label(L('PAUZA', 'PAUSED'), H * 0.48, 24); }
    }

    // ── Smyčka a ovládání ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (api.paused && api.paused() && !paused && !over && phase === 'play') setPause(true);
      if (!paused && !over) for (let i = 0; i < speed; i++) step(dt);
      draw();
    }
    function setPause(on) { if (over || phase !== 'play') return; paused = on; api.setTimer(!on); }
    // ťuknutí: směr od mašinky k prstu; přejetí: směr tahu
    let sx = 0, sy = 0, st = 0;
    cv.addEventListener('pointerdown', e => { e.preventDefault(); if (paused) { setPause(false); return; } sx = e.clientX; sy = e.clientY; st = performance.now(); });
    cv.addEventListener('pointerup', e => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.hypot(dx, dy) > 18) { steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3); return; }
      const r = cv.getBoundingClientRect(), h = body[0], hx = (h.x + 0.5) * T, hy = (h.y + 0.5) * T, px = e.clientX - r.left - hx, py = e.clientY - r.top - hy;
      if (Math.hypot(px, py) < T * 0.4) return;
      steer(Math.abs(px) > Math.abs(py) ? (px > 0 ? 0 : 2) : py > 0 ? 1 : 3);
      void st;
    });
    el.querySelector('.vl-pad').addEventListener('pointerdown', e => { const b = e.target.closest('[data-d]'); if (!b) return; e.preventDefault(); steer(+b.dataset.d); });
    // automat pro testy: jede po vygenerované trase
    function autopilot() {
      if (queue.length) return;
      const h = body[0], i = P.path.findIndex(([x, y]) => x === h.x && y === h.y);
      const nxt = P.path[i + 1]; if (!nxt) return;
      const d = DIRS.findIndex(([ax, ay]) => ax === nxt[0] - h.x && ay === nxt[1] - h.y);
      if (d >= 0 && d !== dir) queue.push(d);
    }

    fit(); addEventListener('resize', fit);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => null,
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); },
      pause() { setPause(true); },
      onKey(e) {
        const k = { ArrowRight: 0, d: 0, D: 0, ArrowDown: 1, s: 1, S: 1, ArrowLeft: 2, a: 2, A: 2, ArrowUp: 3, w: 3, W: 3 }[e.key];
        if (k != null) { e.preventDefault(); if (paused) setPause(false); else steer(k); }
        else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); setPause(!paused); }
      },
      _state: () => ({ phase, len: body.length, left: left(), crashes, over, head: [body[0].x, body[0].y] }),
      _auto(on) { auto = on !== false; if (auto && phase === 'ready') { const n = P.path[1]; steer(DIRS.findIndex(([ax, ay]) => ax === n[0] - P.start.x && ay === n[1] - P.start.y)); } },
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
  tagline: Kit.L('Na motivy české klasiky Vlak (1993): proveď mašinku loukou, posbírej všechny předměty a vjeď bránou ven. Každý předmět přidá vagón, tak pozor, ať do nich nenarazíš.', 'In the spirit of the Czech classic Vlak (1993): steer the engine across the meadow, collect every item and leave through the gate. Each item adds a wagon, so mind you do not crash into them.'),
  diffs: Vlak.DIFFS, generate: Vlak.generate, create: Vlak.create, art: Vlak.art,
  dailyDiff: () => 'stredni',
  levelDiff: n => (n <= 25 ? 'lehka' : n <= 60 ? 'stredni' : n <= 95 ? 'tezka' : 'expert'),
  rules: Kit.L(`<p>Mašinka jede pořád dopředu. Šipkami, WASD, přejetím prstu nebo ťuknutím vedle mašinky jí určíš, kam zatočí.</p>
    <ul><li>Posbírej všechny předměty. Každý se naloží na nový vagón a vlak se prodlouží.</li>
    <li>Když je vše posbíráno, brána se otevře. Vjeď do ní a úroveň je hotová.</li>
    <li>Náraz do zdi, do zavřené brány nebo do vlastních vagonů vrátí úroveň na začátek (počítá se jako chyba).</li>
    <li>Plánuj trasu dopředu: dlouhý vlak se snadno zamotá. Každá úroveň jde projet.</li>
    <li>Hvězdy: bez nárazu 3, s jedním 2. P pozastaví hru.</li></ul>`,
    `<p>The engine keeps moving forward. Use the arrows, WASD, a swipe or a tap beside the engine to turn it.</p>
    <ul><li>Collect every item. Each one is loaded onto a new wagon and the train grows longer.</li>
    <li>Once everything is collected, the gate opens. Drive into it to finish the level.</li>
    <li>Hitting a wall, the closed gate or your own wagons restarts the level (counts as a mistake).</li>
    <li>Plan ahead: a long train easily ties itself in knots. Every level can be solved.</li>
    <li>Stars: 3 without a crash, 2 with one. P pauses the game.</li></ul>`),
  achievements: [
    { id: 'v10', name: Kit.L('Strojvůdce', 'Engine driver'), desc: Kit.L('Projeď 10 úrovní', 'Finish 10 levels'), prog: s => [Math.min(10, (s.stats && s.stats.solved) || 0), 10] },
  ],
});
