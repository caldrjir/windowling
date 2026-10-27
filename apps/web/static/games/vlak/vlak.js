'use strict';
// ── VLAK · Windowling Hlavolamy ─────────────────────────────────────────────
// Česká klasika Vlak (Miroslav Němeček, 1993) s původními 50 scénami a původní grafikou (autor je
// dovoluje volně použít, viz scenes.js a art.js). Mašinka jezdí sama po políčkách, hráč jen
// zatáčí; každý sebraný předmět přidá vagón, po sebrání všech se otevře brána a vlak jí musí
// projet. Náraz do zdi, zavřené brány nebo vlastních vagonů scénu vrátí na začátek.
// Cesta: scény 1–50 originálu, pak generované scény ve stejném duchu (core.js).
const Vlak = (() => {
  const L = Kit.L, C = VlCore, A = VlArt;
  const TICK = 0.165; // původní interval pohybu (165 ms)
  const DIFFS = [
    { id: 'puvodni', name: L('Původní scény', 'Original scenes'), note: L('náhodná z 50 scén originálu', 'a random one of the 50 original scenes') },
    { id: 'lehka', name: L('Lehká', 'Easy'), note: L('nová scéna, 14 předmětů', 'a new scene, 14 items'), items: 14, walls: 2, tick: 0.2, par: 120 },
    { id: 'stredni', name: L('Střední', 'Medium'), note: L('24 předmětů', '24 items'), items: 24, walls: 4, tick: 0.18, par: 180 },
    { id: 'tezka', name: L('Těžká', 'Hard'), note: L('34 předmětů', '34 items'), items: 34, walls: 5, tick: TICK, par: 240 },
    { id: 'expert', name: L('Expert', 'Expert'), note: L('46 předmětů, rychle', '46 items, fast'), items: 46, walls: 6, tick: 0.15, par: 300 },
  ];
  const levelDiff = n => (n <= 50 ? 'puvodni' : n <= 75 ? 'stredni' : n <= 100 ? 'tezka' : 'expert');
  function scene(no, seed) {
    const sc = VlScenes[no - 1], lv = C.fromScene(sc);
    return Object.assign(lv, { seed, diff: 'puvodni', tick: TICK, par: Math.round(sc.sol.length * TICK * 1.6 + 15), sceneNo: no, next: VlScenes[no] ? VlScenes[no].name : null });
  }
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level' && ctx.key <= 50) return scene(ctx.key, seed);
    if (diffId === 'puvodni' && ctx.kind !== 'level') return scene(1 + (seed % 50), seed);
    const d = DIFFS.find(x => x.id === diffId && x.items) || DIFFS[2];
    const o = { items: d.items, walls: d.walls, cover: 0.92 };
    if (ctx.kind === 'level') { // po 50 původních scénách rostou generované scény postupně
      o.items = Math.min(d.items, 18 + Math.round((ctx.key - 50) * 0.45));
      o.walls = Math.min(d.walls, 2 + Math.floor((ctx.key - 50) / 15));
    }
    return Object.assign(C.generate(seed, o), { seed, diff: d.id, tick: d.tick, par: d.par });
  }

  function create(el, P, saved, api) {
    const coarse = matchMedia('(pointer: coarse)').matches;
    el.innerHTML = `<div class="vl-wrap"><canvas class="vl-cv"></canvas>
      <div class="vl-bar"><span class="vl-scene"></span><span class="vl-left"></span></div>
      <div class="vl-pad" ${coarse ? '' : 'hidden'}><button data-d="3" aria-label="↑">▲</button><button data-d="2" aria-label="←">◀</button><button data-d="1" aria-label="↓">▼</button><button data-d="0" aria-label="→">▶</button></div>
      <p class="vl-keys">${L('Šipky nebo WASD, přejetí prstem či ťuknutí ukazuje směr. P pauza', 'Arrows or WASD; swipe or tap to steer. P pauses')}</p></div>`;
    const cv = el.querySelector('.vl-cv'), ctx = cv.getContext('2d'), sceneEl = el.querySelector('.vl-scene'), leftEl = el.querySelector('.vl-left');
    let T = 32, dpr = 1, rot = false, boardImg = null;
    // telefon na výšku: široká scéna se otočí o 90° (políčka jsou pak skoro o polovinu větší);
    // sprity se nekreslí otočené, jen se pro každý směr vybere ten správný
    const cell = (x, y) => (rot ? [P.h - 1 - y, x] : [x, y]);
    const sdir = d => ((rot ? (d + 1) % 4 : d) + 2) % 4; // směr ve scéně → sprite (vlevo, nahoru, vpravo, dolů)
    const scr = d => (rot ? (d + 3) % 4 : d); // směr na obrazovce → směr ve scéně
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      const maxH = Math.max(300, innerHeight - (coarse ? 330 : 210));
      rot = coarse && innerHeight > innerWidth && (box - 4) / P.w < 26;
      const cols = rot ? P.h : P.w, rows = rot ? P.w : P.h;
      T = Math.max(12, Math.floor(Math.min((box - 4) / cols, maxH / rows)));
      if (T >= 32) T = Math.floor(T / 16) * 16; else if (T >= 24) T = Math.floor(T / 8) * 8; // ostré pixely
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(cols * T * dpr); cv.height = Math.round(rows * T * dpr);
      cv.style.width = cols * T + 'px'; cv.style.height = rows * T + 'px';
      boardImg = A.board(P, T, dpr, cell, cols, rows);
    }
    A.ready.then(() => fit());

    // ── Stav ──
    const DIRS = C.DIRS;
    let body, dir, queue, items, phase, pi = 0, crashes = 0, acc = 0, clock = 0, crashT = 0, gateT = 0, over = false, paused = false, speed = 1, auto = false;
    function reset() {
      body = [{ x: P.start.x, y: P.start.y, kind: null, d: P.start.dir }];
      dir = P.start.dir; queue = [];
      items = P.items.map(it => Object.assign({ got: false }, it));
      phase = 'ready'; acc = 0; gateT = 0; pi = 0;
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
    // posun vlaku: každý článek na místo předchozího (i se směrem), mašinka na (nx, ny)
    function advance(nx, ny, kind) {
      const tail = body[body.length - 1], tx = tail.x, ty = tail.y, td = tail.d;
      for (let k = body.length - 1; k > 0; k--) { body[k].x = body[k - 1].x; body[k].y = body[k - 1].y; body[k].d = body[k - 1].d; }
      body[0].x = nx; body[0].y = ny; body[0].d = dir;
      if (kind != null) body.push({ x: tx, y: ty, kind, d: td });
    }
    function tick() {
      if (queue.length) dir = queue.shift();
      const head = body[0], nx = head.x + DIRS[dir][0], ny = head.y + DIRS[dir][1];
      const atGate = nx === P.gate.x && ny === P.gate.y;
      if (atGate && gateOpen()) { advance(nx, ny, null); phase = 'win'; api.sound('win'); return; }
      if (wallAt(nx, ny) || atGate) return crash();
      const it = items.find(i => !i.got && i.x === nx && i.y === ny);
      // ocas se posune (pokud vlak neroste), takže na jeho políčko se smí
      for (let k = 0; k < body.length - (it ? 0 : 1); k++) if (body[k].x === nx && body[k].y === ny) return crash();
      advance(nx, ny, it ? it.kind : null); pi++;
      if (it) { it.got = true; api.sound(gateOpen() ? 'line' : 'place'); }
    }
    // vítězství: vlak zajíždí do brány, článek na bráně zmizí a další se posune
    function winTick() {
      if (body.length && body[0].x === P.gate.x && body[0].y === P.gate.y) body.shift();
      if (!body.length) { finish(); return; }
      const d = DIRS.findIndex(([ax, ay]) => ax === P.gate.x - body[0].x && ay === P.gate.y - body[0].y);
      if (d >= 0) dir = d;
      advance(P.gate.x, P.gate.y, null);
    }
    function crash() { phase = 'crash'; crashT = 0; crashes++; api.mistake(); }
    function step(dt) {
      clock += dt;
      if (gateOpen()) gateT = Math.min(1, gateT + dt * 2.5);
      if (phase === 'crash') { crashT += dt; if (crashT > 1.3) reset(); return; }
      if (phase === 'win') { acc += dt; while (acc >= P.tick && !over) { acc -= P.tick; winTick(); } return; }
      if (phase !== 'play') return;
      acc += dt;
      if (auto) autopilot();
      while (acc >= P.tick && phase === 'play') { acc -= P.tick; tick(); if (auto) autopilot(); }
    }
    function finish() {
      if (over) return; over = true; api.setTimer(false);
      const stars = crashes === 0 ? 3 : crashes <= 2 ? 2 : 1;
      const pass = P.sceneNo && P.next ? `<p>${L('Heslo další scény', 'Password for the next scene')}: <b>${P.next}</b></p>` : '';
      api.solved({ title: L('Vlak dojel!', 'The train made it!'), stars, html: `<p class="k-muted">${P.sceneNo ? L(`Scéna ${P.sceneNo} · ${P.name}`, `Scene ${P.sceneNo} · ${P.name}`) + ' · ' : ''}${L(`${P.items.length} vagónů · ${crashes}× náraz`, `${P.items.length} wagons · ${crashes} crash${crashes === 1 ? '' : 'es'}`)}</p>${pass}` });
    }

    // ── Kresba ──
    function draw() {
      const g = ctx;
      g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
      if (boardImg) g.drawImage(boardImg, 0, 0); else { g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
      const at = (x, y) => { const [sx, sy] = cell(x, y); return [sx * T, sy * T]; };
      A.gate(g, Math.round(gateT * 5), ...at(P.gate.x, P.gate.y), T);
      for (const it of items) if (!it.got) A.item(g, it.kind, Math.floor(clock * 5 + it.x * 0.7 + it.y) % 3, ...at(it.x, it.y), T);
      for (let k = body.length - 1; k >= 1; k--) { const b = body[k]; A.wagon(g, b.kind, sdir(b.d), ...at(b.x, b.y), T); }
      if (body.length) {
        const h = body[0], [hx, hy] = at(h.x, h.y);
        if (phase === 'crash') A.crash(g, Math.floor(crashT / 0.09), hx, hy, T);
        else A.loco(g, sdir(body[0].d), phase === 'play' || phase === 'win' ? Math.floor(clock * 9) % 3 : 0, hx, hy, T);
      }
      const W = (rot ? P.h : P.w) * T, H = (rot ? P.w : P.h) * T;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const label = (s, y, size, col = '#ffff55') => { g.font = `800 ${size}px Unbounded, sans-serif`; g.lineWidth = 5; g.lineJoin = 'round'; g.strokeStyle = '#000'; g.strokeText(s, W / 2, y); g.fillStyle = col; g.fillText(s, W / 2, y); };
      const big = Math.max(13, Math.min(22, T * 0.6));
      if (phase === 'ready') {
        label(P.sceneNo ? L(`SCÉNA ${P.sceneNo}`, `SCENE ${P.sceneNo}`) : L('VLAK', 'VLAK'), H * 0.42, big);
        label(L('šipkou se vyjede', 'press an arrow to start'), H * 0.42 + big * 1.3, Math.max(10, big * 0.6), '#55ffff');
      }
      if (paused) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, W, H); label(L('PAUZA', 'PAUSED'), H * 0.48, big); }
      const sTxt = P.sceneNo ? L(`SCÉNA ${P.sceneNo} · HESLO ${P.name}`, `SCENE ${P.sceneNo} · PASSWORD ${P.name}`) : L('NOVÁ SCÉNA', 'NEW SCENE');
      if (sceneEl.textContent !== sTxt) sceneEl.textContent = sTxt;
      const lTxt = L(`ZBÝVÁ ${left()}`, `LEFT ${left()}`);
      if (leftEl.textContent !== lTxt) leftEl.textContent = lTxt;
    }

    // ── Smyčka a ovládání ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      if (api.paused && api.paused() && !paused && !over && phase === 'play') setPause(true);
      if (!paused && !over) for (let i = 0; i < speed; i++) step(dt);
      draw();
    }
    function setPause(on) { if (over || phase !== 'play') return; paused = on; api.setTimer(!on); }
    // ťuknutí: směr od mašinky k prstu; přejetí: směr tahu
    let sx = 0, sy = 0;
    cv.addEventListener('pointerdown', e => { e.preventDefault(); if (paused) { setPause(false); return; } sx = e.clientX; sy = e.clientY; });
    cv.addEventListener('pointerup', e => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.hypot(dx, dy) > 18) { steer(scr(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3)); return; }
      const r = cv.getBoundingClientRect(), [cx, cy] = cell(body[0].x, body[0].y), px = e.clientX - r.left - (cx + 0.5) * T, py = e.clientY - r.top - (cy + 0.5) * T;
      if (Math.hypot(px, py) < T * 0.4) return;
      steer(scr(Math.abs(px) > Math.abs(py) ? (px > 0 ? 0 : 2) : py > 0 ? 1 : 3));
    });
    el.querySelector('.vl-pad').addEventListener('pointerdown', e => { const b = e.target.closest('[data-d]'); if (!b) return; e.preventDefault(); steer(scr(+b.dataset.d)); });
    // automat pro testy: jede po známé trase (u původních scén autorovo řešení)
    function autopilot() {
      if (queue.length) return;
      // trasa smí vést stejným políčkem víckrát, proto se počítá krok (pi), ne poloha
      const h = body[0], nxt = P.path[pi + 1]; if (!nxt) return;
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
        if (k != null) { e.preventDefault(); if (paused) setPause(false); else steer(scr(k)); }
        else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); setPause(!paused); }
      },
      _state: () => ({ phase, len: body.length, left: left(), crashes, over, head: body.length ? [body[0].x, body[0].y] : null, scene: P.sceneNo || 0 }),
      _auto(on) {
        auto = on !== false;
        if (auto && phase === 'ready') { const n = P.path[1]; const d = DIRS.findIndex(([ax, ay]) => ax === n[0] - P.start.x && ay === n[1] - P.start.y); phase = 'play'; api.setTimer(true); acc = P.tick; if (d !== dir) queue.push(d); }
      },
      _speed(n) { speed = Math.max(1, n | 0); },
      _steer(d) { steer(d); },
      _solve() { phase = 'win'; finish(); },
    };
  }

  // úvodní obrázek: kousek první scény v původní grafice
  function art(el) {
    el.innerHTML = '<canvas width="640" height="640"></canvas>';
    const g = el.querySelector('canvas').getContext('2d');
    g.imageSmoothingEnabled = false;
    A.ready.then(() => {
      const t = 64;
      g.fillStyle = '#000'; g.fillRect(0, 0, 640, 640);
      for (let i = 0; i < 10; i++) { A.wall(g, i * t, 0, t); A.wall(g, i * t, 9 * t, t); A.wall(g, 0, i * t, t); A.wall(g, 9 * t, i * t, t); }
      A.gate(g, 0, 9 * t, 6 * t, t);
      for (let i = 0; i < 4; i++) A.item(g, 0, i % 3, (2 + i) * t, 2 * t, t);
      for (let i = 0; i < 3; i++) A.item(g, 3, i % 3, (5 + i) * t, 5 * t, t);
      A.item(g, 2, 0, 2 * t, 7 * t, t); A.item(g, 2, 1, 3 * t, 7 * t, t);
      A.wagon(g, 0, 1, 1 * t, 6 * t, t); A.wagon(g, 0, 2, 1 * t, 4 * t, t); A.wagon(g, 0, 1, 1 * t, 5 * t, t);
      A.wagon(g, 3, 2, 2 * t, 4 * t, t);
      A.loco(g, 2, 0, 3 * t, 4 * t, t);
    });
  }
  return { DIFFS, generate, create, art, levelDiff };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'vlak', title: 'VLAK',
  tagline: Kit.L('Česká klasika Vlak (Miroslav Němeček, 1993) s původními 50 scénami a původní grafikou: proveď mašinku scénou, posbírej všechny předměty a vjeď do brány. Každý předmět přidá vagón, tak pozor, ať do nich nenarazíš.', 'The Czech classic Vlak (Miroslav Němeček, 1993) with its original 50 scenes and graphics: steer the engine through the scene, collect every item and enter the gate. Each item adds a wagon, so mind you do not crash into them.'),
  diffs: Vlak.DIFFS, generate: Vlak.generate, create: Vlak.create, art: Vlak.art,
  dailyDiff: () => 'stredni',
  levelDiff: Vlak.levelDiff,
  rules: Kit.L(`<p>Mašinka jede pořád dopředu. Šipkami, WASD, přejetím prstu nebo ťuknutím vedle mašinky jí určíš, kam zatočí. Vyjede po prvním stisku šipky.</p>
    <ul><li>Posbírej všechny předměty. Každý se naloží na nový vagón a vlak se prodlouží.</li>
    <li>Když je vše posbíráno, brána se otevře. Vjeď do ní a scéna je hotová.</li>
    <li>Náraz do zdi, do zavřené brány nebo do vlastních vagonů vrátí scénu na začátek (počítá se jako chyba).</li>
    <li>Cesta vede všemi 50 scénami originálu (po každé uvidíš heslo další scény jako kdysi), pak pokračují nové scény ve stejném duchu.</li>
    <li>Hvězdy: bez nárazu 3, s jedním nebo dvěma 2. P pozastaví hru.</li></ul>
    <p class="k-muted">Původní hra, scény a grafika: Miroslav Němeček, 1993 (freeware, autor dovoluje volné použití).</p>`,
    `<p>The engine keeps moving forward. Use the arrows, WASD, a swipe or a tap beside the engine to turn it. It sets off with the first arrow press.</p>
    <ul><li>Collect every item. Each one is loaded onto a new wagon and the train grows longer.</li>
    <li>Once everything is collected, the gate opens. Drive into it to finish the scene.</li>
    <li>Hitting a wall, the closed gate or your own wagons restarts the scene (counts as a mistake).</li>
    <li>The Path goes through all 50 original scenes (each shows the next scene's password, as it used to), then continues with new scenes in the same spirit.</li>
    <li>Stars: 3 without a crash, 2 with one or two. P pauses the game.</li></ul>
    <p class="k-muted">Original game, scenes and graphics: Miroslav Němeček, 1993 (freeware, free to reuse by the author's permission).</p>`),
  achievements: [
    { id: 'v10', name: Kit.L('Strojvůdce', 'Engine driver'), desc: Kit.L('Projeď 10 úrovní', 'Finish 10 levels'), prog: s => [Math.min(10, (s.stats && s.stats.solved) || 0), 10] },
  ],
});
