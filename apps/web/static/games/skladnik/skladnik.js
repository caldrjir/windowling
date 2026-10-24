'use strict';
// ── SKLADNÍK · Windowling Hlavolamy ─────────────────────────────────────────
// Skladník na motivy Stack Attack: jeřáby shazují bedny, skladník je tlačí (jen jednu, na které nic
// neleží), skáče po nich a skládá plné řady, které zmizí. Bedna na hlavu = ztracený život.
// Speciální bedny: bomba (za 3 s vybuchne a rozmetá okolí), srdce (život), pírko (vyšší skok).
// Pořadí beden i jeřábů je ze semínka, takže denní směna je pro všechny stejná.
// Logika je po polích (okamžité tahy), plynulost dělají jen animační posuny.
const Skladnik = (() => {
  const L = Kit.L;
  const W = 12, H = 11;
  const DIFFS = [
    { id: 'shift', name: L('Směna', 'Shift'), note: L('slož 8 plných řad', 'clear 8 full rows'), par: 150 },
    { id: 'endless', name: L('Nekonečno', 'Endless'), note: L('dokud tě sklad nezasype', 'until the warehouse buries you'), metric: 'score' },
    { id: 'calm', name: L('Klidná směna', 'Calm shift'), note: L('pomalé jeřáby, 5 řad', 'slow cranes, 5 rows'), par: 140 },
  ];
  const COLORS = ['#ffa94d', '#c77dff', '#55f6ff', '#6dff9e', '#ff9de6', '#ffe066'];
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  function levelSpec(n) {
    const ch = Math.floor((n - 1) / 20), k = (n - 1) % 20;
    const goal = 3 + ch + Math.floor(k / 5), rate = Math.max(1.1, 3 - ch * 0.3 - k * 0.02);
    return { goal, rate, bombs: Math.min(0.1, 0.02 + ch * 0.015), par: goal * 22, text: L(`Slož ${goal} řad`, `Clear ${goal} rows`) };
  }
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') return Object.assign({ seed, mode: 'level', n: ctx.key, type: 'goal' }, levelSpec(ctx.key));
    if (ctx.kind === 'daily') return { seed, mode: 'daily', type: 'goal', goal: 8, rate: 2.2, bombs: 0.06, par: 150, text: L('Denní směna: 8 řad', 'Daily shift: 8 rows') };
    if (diffId === 'endless') return { seed, mode: 'free', type: 'endless', rate: 2.6, bombs: 0.06 };
    if (diffId === 'calm') return { seed, mode: 'free', type: 'goal', goal: 5, rate: 3.4, bombs: 0.03, par: 140 };
    return { seed, mode: 'free', type: 'goal', goal: 8, rate: 2.2, bombs: 0.06, par: 150 };
  }

  function create(el, P, saved, api) {
    const rnd = rngOf(P.seed);
    let grid = [...Array(H)].map(() => new Array(W).fill(null));
    let falling = [], cranes = [], parts = [], flashes = [], pops = [];
    let worker, lives = 3, livesLost = 0, rows = 0, score = 0, elapsed = 0, craneT = 1.2, over = false, paused = false, feather = 0, calm = false, clock = 0, msg = null;
    let held = 0, stepReq = 0, jumpReq = false; // stepReq: krátký stisk se neztratí, i když klávesa pustí dřív než smyčka
    const level = () => 1 + Math.floor(rows / 3);
    const rate = () => (P.type === 'endless' ? Math.max(0.9, P.rate - (level() - 1) * 0.18) : P.rate);
    const makeCrate = () => {
      const r = rnd(), k = r < P.bombs ? 'bomb' : r < P.bombs + 0.03 ? 'heart' : r < P.bombs + 0.06 ? 'feather' : 'box';
      return { k, col: COLORS[Math.floor(rnd() * COLORS.length)], ox: 0, oy: 0, t: 3 };
    };
    const solid = (x, y) => x < 0 || x >= W || y >= H || (y >= 0 && grid[y][x] !== null);
    const collectible = c => c && (c.k === 'heart' || c.k === 'feather');

    function reset() {
      // pár beden na podlaze na začátek
      for (let x = 0; x < W; x++) if (x !== 5 && x !== 6 && rnd() < 0.35) grid[H - 1][x] = { k: 'box', col: COLORS[Math.floor(rnd() * COLORS.length)], ox: 0, oy: 0, t: 3 };
      spawnWorker();
    }
    function spawnWorker() {
      // nejnižší sloupec blízko středu
      let best = 5, bestTop = -1;
      for (const x of [5, 6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11]) { let top = H; while (top > 0 && grid[top - 1][x]) top--; if (top > bestTop + 1 || bestTop < 0) { if (top > bestTop) { best = x; bestTop = top; } } }
      worker = { c: best, r: bestTop - 1, ox: 0, oy: 0, busy: 0, air: 0, dead: 0, inv: 2, face: 1, step: 0 };
      if (worker.r < 1) { end(false); }
    }

    // ── Bedny ──
    function settle() {
      for (let y = H - 2; y >= 0; y--) for (let x = 0; x < W; x++) {
        const c = grid[y][x];
        if (c && !grid[y + 1][x]) { grid[y][x] = null; falling.push({ ...c, x, y, oy: 0 }); }
      }
    }
    function land(f, row) {
      if (row < 0) { end(false); return; } // sklad přetekl
      const c = { k: f.k, col: f.col, ox: 0, oy: 0, t: 3 };
      grid[row][f.x] = c; c.oy = -0.15;
      api.sound('soft');
      checkRows();
    }
    function checkRows() {
      let cleared = 0;
      for (let y = H - 1; y >= 0; y--) {
        if (grid[y].every(Boolean)) {
          for (let x = 0; x < W; x++) { boom(x + 0.5, y + 0.5, grid[y][x].col, 4); grid[y][x] = null; }
          flashes.push({ y, t: 0.35 });
          cleared++;
        }
      }
      if (!cleared) return;
      rows += cleared; const pts = 100 * cleared * cleared * level(); score += pts;
      pops.push({ x: W / 2, y: H - 2, t: 1.2, text: `+${pts}` });
      msg = cleared > 1 ? { t: 1.2, text: L(`${cleared} ŘADY!`, `${cleared} ROWS!`) } : null;
      api.sound(cleared > 1 ? 'win' : 'line'); api.changed();
      settle();
      if (P.type === 'goal' && rows >= P.goal) setTimeout(() => end(true), 500);
    }
    function explode(bx, by) {
      api.sound('error');
      for (let y = by - 1; y <= by + 1; y++) for (let x = bx - 1; x <= bx + 1; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        if (grid[y][x]) { boom(x + 0.5, y + 0.5, '#ff5a7a', 6); grid[y][x] = null; }
      }
      boom(bx + 0.5, by + 0.5, '#ffe066', 20);
      if (!worker.dead && worker.inv <= 0 && Math.abs(worker.c - bx) <= 1 && (Math.abs(worker.r - by) <= 1 || Math.abs(worker.r - 1 - by) <= 1)) die();
      settle();
    }
    function boom(x, y, col, n) { for (let i = 0; i < n; i++) { const a = rnd() * 6.28, v = 1 + rnd() * 4; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, t: 0.5 + rnd() * 0.4, col }); } }

    // ── Jeřáby ──
    function spawnCrane() {
      const busy = new Set(cranes.map(c => c.target));
      const free = []; for (let x = 0; x < W; x++) if (!grid[0][x] && !busy.has(x)) free.push(x);
      if (!free.length) { if (!falling.length && [...Array(W).keys()].every(x => grid[0][x])) end(false); return; }
      const target = free[Math.floor(rnd() * free.length)], dir = rnd() < 0.5 ? 1 : -1;
      cranes.push({ x: dir > 0 ? -1.5 : W + 0.5, dir, target, crate: makeCrate() });
    }

    // ── Skladník ──
    function die() {
      if (worker.dead) return;
      worker.dead = 1.3; lives--; livesLost++; boom(worker.c + 0.5, worker.r, '#ffe066', 18); api.sound('error'); api.changed();
      falling = falling.filter(f => f.x !== worker.c);
    }
    function collect(c) {
      if (c.k === 'heart') { lives = Math.min(5, lives + 1); msg = { t: 1.2, text: L('ŽIVOT NAVÍC', 'EXTRA LIFE') }; }
      else { feather = 15; msg = { t: 1.2, text: L('PÍRKO: VYŠŠÍ SKOK', 'FEATHER: HIGH JUMP') }; }
      score += 50; api.sound('star');
    }
    function tryMove(dir) {
      const w = worker, c2 = w.c + dir; w.face = dir;
      if (c2 < 0 || c2 >= W) return false;
      const feet = grid[w.r][c2], head = w.r - 1 >= 0 ? grid[w.r - 1][c2] : null;
      if (head) { if (collectible(head)) { collect(head); grid[w.r - 1][c2] = null; settle(); } else return false; }
      if (feet && collectible(feet)) { collect(feet); grid[w.r][c2] = null; settle(); }
      else if (feet) {
        const c3 = c2 + dir;
        if (c3 < 0 || c3 >= W || grid[w.r][c3] || falling.some(f => f.x === c3 && f.y + 1 > w.r && f.y < w.r + 1)) return false;
        grid[w.r][c3] = feet; grid[w.r][c2] = null; feet.ox = -dir; api.sound('place');
        settle();
      }
      if (falling.some(f => f.x === c2 && f.y + 1 > w.r - 1 && f.y < w.r + 1)) { w.c = c2; w.ox = -dir; die(); return true; }
      w.c = c2; w.ox = -dir; w.busy = 0.13; w.step++;
      return true;
    }
    function tryJump() {
      const w = worker, h = feather > 0 ? 2 : 1;
      if (!solid(w.c, w.r + 1) && w.air <= 0) return; // ve vzduchu se neskáče
      let up = 0;
      while (up < h && w.r - 2 - up >= 0 && !grid[w.r - 2 - up][w.c]) up++;
      if (!up) return;
      w.r -= up; w.oy = up; w.busy = 0.1 + 0.05 * up; w.air = 0.32; api.sound('tap');
    }
    function updateWorker(dt) {
      const w = worker;
      w.ox *= Math.pow(0.0005, dt); w.oy *= Math.pow(0.0005, dt);
      if (Math.abs(w.ox) < 0.01) w.ox = 0; if (Math.abs(w.oy) < 0.01) w.oy = 0;
      if (w.dead) { w.dead -= dt; if (w.dead <= 0) { if (lives <= 0) { end(false); return; } spawnWorker(); } return; }
      w.inv = Math.max(0, w.inv - dt);
      if (w.busy > 0) { w.busy -= dt; return; }
      const supported = solid(w.c, w.r + 1);
      if (jumpReq) { jumpReq = false; if (supported) { tryJump(); return; } }
      const step = stepReq || held; stepReq = 0;
      if (step && tryMove(step)) return;
      if (w.air > 0) { w.air -= dt; return; }
      if (!supported) { w.r++; w.oy = -1; w.busy = 0.06; }
    }

    function end(won) {
      if (over) return; over = true; api.setTimer(false);
      const info = `<p class="k-muted">${L(`Řady ${rows} · skóre ${Kit.fmtNum(score)} · ztracené životy ${livesLost}`, `Rows ${rows} · score ${Kit.fmtNum(score)} · lives lost ${livesLost}`)}${P.text ? ` · ${P.text}` : ''}</p>`;
      if (!won) { api.failed({ score, html: info }); return; }
      const stars = livesLost === 0 && elapsed <= (P.par || 150) ? 3 : livesLost <= 1 ? 2 : 1;
      api.solved({ title: P.type === 'endless' ? Kit.fmtNum(score) : Kit.fmtTime(elapsed), stars, score: P.type === 'endless' ? score : undefined, html: info });
    }

    function tick(dt) {
      clock += dt; elapsed += dt; feather = Math.max(0, feather - dt);
      if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
      parts = parts.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 9 * dt; return (p.t -= dt) > 0; });
      flashes = flashes.filter(f => (f.t -= dt) > 0);
      pops = pops.filter(p => (p.t -= dt) > 0);
      // jeřáby
      if (!calm) { craneT -= dt; if (craneT <= 0) { craneT = rate() * (0.75 + rnd() * 0.5); spawnCrane(); } }
      for (const cr of cranes) {
        cr.x += cr.dir * 5 * dt;
        if (!cr.dropped && (cr.dir > 0 ? cr.x >= cr.target : cr.x <= cr.target)) { cr.dropped = true; falling.push({ ...cr.crate, x: cr.target, y: -1 }); }
      }
      cranes = cranes.filter(cr => cr.x > -3 && cr.x < W + 2);
      // padající bedny
      for (const f of falling.slice()) {
        f.y += 9 * dt;
        const w = worker;
        if (!w.dead && f.x === w.c && f.y + 1 > w.r - 1 + 0.15 && f.y < w.r + 1) {
          falling.splice(falling.indexOf(f), 1);
          if (collectible(f)) collect(f);
          else if (w.inv > 0) boom(f.x + 0.5, f.y + 0.5, f.col, 8);
          else die();
          continue;
        }
        const below = Math.floor(f.y) + 1;
        if (below >= H || (below >= 0 && grid[below][f.x])) {
          if (f.y >= below - 1) { falling.splice(falling.indexOf(f), 1); land(f, below - 1); if (over) return; }
        }
      }
      // bomby
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = grid[y][x]; if (c && c.k === 'bomb') { c.t -= dt; if (c.t <= 0) explode(x, y); } }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = grid[y][x]; if (c) { c.ox *= Math.pow(0.0005, dt); c.oy *= Math.pow(0.001, dt); } }
      updateWorker(dt);
    }

    // ── Vykreslení ──
    el.innerHTML = `<div class="sk-wrap">
      <div class="sk-hud"><div><small>${L('SKÓRE', 'SCORE')}</small><b class="sk-score">0</b></div><div class="sk-lives"></div><div><small>${L('ŘADY', 'ROWS')}</small><b class="sk-rows">0</b></div></div>
      <div class="sk-stage"><canvas class="sk-board"></canvas><div class="sk-over" hidden></div></div>
      <div class="sk-pad"><button data-m="-1" aria-label="${L('Doleva', 'Left')}">◀</button><button data-j aria-label="${L('Skok', 'Jump')}">▲</button><button data-m="1" aria-label="${L('Doprava', 'Right')}">▶</button></div>
      <button class="sk-pause k-tool" data-b="pause">${api.icon('pause')}<span>${L('Pauza', 'Pause')}</span></button></div>`;
    const cv = el.querySelector('.sk-board'), ctx = cv.getContext('2d'), ov = el.querySelector('.sk-over'), wrapEl = el.querySelector('.sk-wrap');
    const scoreEl = el.querySelector('.sk-score'), livesEl = el.querySelector('.sk-lives'), rowsEl = el.querySelector('.sk-rows');
    let cs = 32, dpr = 1;
    const TOP = 1.4; // místo pro jeřáby nad skladem
    function fit() {
      const phone = innerWidth < 760, vw = (document.getElementById('kView') || el).clientWidth - (phone ? 16 : 8);
      const hAvail = innerHeight - (phone ? 320 : 190);
      cs = Math.max(14, Math.floor(Math.min(vw / W, hAvail / (H + TOP), 44)));
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = W * cs * dpr; cv.height = (H + TOP) * cs * dpr; cv.style.width = W * cs + 'px'; cv.style.height = (H + TOP) * cs + 'px';
      wrapEl.classList.toggle('phone', phone);
    }
    function crate(c, x, y) {
      const X = x * cs, Y = (y + TOP) * cs, s = cs, p = s * 0.08;
      if (c.k === 'bomb') {
        ctx.fillStyle = '#2a1830'; ctx.beginPath(); ctx.arc(X + s / 2, Y + s * 0.56, s * 0.38, 0, 7); ctx.fill();
        ctx.strokeStyle = '#ff5a7a'; ctx.lineWidth = p; ctx.shadowColor = '#ff5a7a'; ctx.shadowBlur = c.t < 1 && Math.floor(clock * 10) % 2 ? s * 0.8 : s * 0.3; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffe066'; ctx.beginPath(); ctx.moveTo(X + s * 0.6, Y + s * 0.22); ctx.quadraticCurveTo(X + s * 0.75, Y + s * 0.05, X + s * 0.85, Y + s * 0.12); ctx.stroke();
        if (c.t < 3) { ctx.fillStyle = '#fff'; ctx.font = `700 ${s * 0.36}px Unbounded, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(Math.ceil(c.t), X + s / 2, Y + s * 0.58); }
        return;
      }
      const col = c.k === 'heart' ? '#ff5a7a' : c.k === 'feather' ? '#55f6ff' : c.col;
      ctx.fillStyle = '#1a1336'; ctx.fillRect(X + p, Y + p, s - 2 * p, s - 2 * p);
      ctx.strokeStyle = col; ctx.lineWidth = p; ctx.shadowColor = col; ctx.shadowBlur = s * 0.25;
      ctx.strokeRect(X + p * 1.5, Y + p * 1.5, s - 3 * p, s - 3 * p); ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.55; ctx.lineWidth = p * 0.7;
      if (c.k === 'box') { ctx.beginPath(); ctx.moveTo(X + p * 2, Y + p * 2); ctx.lineTo(X + s - p * 2, Y + s - p * 2); ctx.moveTo(X + s - p * 2, Y + p * 2); ctx.lineTo(X + p * 2, Y + s - p * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (c.k === 'heart') { ctx.fillStyle = col; ctx.font = `${s * 0.55}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♥', X + s / 2, Y + s * 0.55); }
      if (c.k === 'feather') { ctx.fillStyle = col; ctx.font = `700 ${s * 0.5}px Unbounded, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('↑', X + s / 2, Y + s * 0.55); }
    }
    function drawWorker() {
      const w = worker;
      if (w.dead && Math.floor(clock * 10) % 2) return;
      if (w.inv > 0 && !w.dead && Math.floor(clock * 12) % 2) return;
      const x = (w.c + w.ox) * cs, y = (w.r - 1 + w.oy + TOP) * cs, s = cs;
      const walk = w.busy > 0 && w.ox ? Math.sin(clock * 30) : 0;
      // nohy
      ctx.fillStyle = '#3a4bff';
      ctx.fillRect(x + s * 0.28, y + s * 1.55 - Math.max(0, walk) * s * 0.1, s * 0.16, s * 0.42);
      ctx.fillRect(x + s * 0.56, y + s * 1.55 + Math.min(0, walk) * s * 0.1, s * 0.16, s * 0.42);
      // tělo (montérky)
      ctx.fillStyle = '#5d7bff'; ctx.beginPath(); ctx.roundRect(x + s * 0.2, y + s * 0.95, s * 0.6, s * 0.66, s * 0.12); ctx.fill();
      ctx.fillStyle = '#ffa94d'; ctx.fillRect(x + s * 0.2, y + s * 1.12, s * 0.6, s * 0.08);
      // hlava a helma
      ctx.fillStyle = '#ffd9a8'; ctx.beginPath(); ctx.arc(x + s / 2, y + s * 0.66, s * 0.27, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe066'; ctx.shadowColor = '#ffe066'; ctx.shadowBlur = s * 0.3;
      ctx.beginPath(); ctx.arc(x + s / 2, y + s * 0.56, s * 0.3, Math.PI, 0); ctx.fill(); ctx.fillRect(x + s * 0.14, y + s * 0.53, s * 0.72, s * 0.08); ctx.shadowBlur = 0;
      ctx.fillStyle = '#10102e'; ctx.beginPath(); ctx.arc(x + s / 2 + w.face * s * 0.1, y + s * 0.7, s * 0.045, 0, 7); ctx.arc(x + s / 2 + w.face * s * 0.22, y + s * 0.7, s * 0.045, 0, 7); ctx.fill();
      if (feather > 0) { ctx.fillStyle = '#55f6ff'; ctx.fillRect(x + s * 0.72, y + s * 0.25, s * 0.06, s * 0.3); }
    }
    function draw() {
      const w = W * cs, h = (H + TOP) * cs;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0a0720'; ctx.fillRect(0, 0, w, h);
      // cihlová zeď skladu
      ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 1) { const off = y % 2 ? cs / 2 : 0; ctx.strokeRect(x * cs + off, (y + TOP) * cs, cs, cs / 2); ctx.strokeRect(x * cs, (y + TOP + 0.5) * cs, cs, cs / 2); }
      // kolejnice jeřábů
      ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(0, cs * 0.25, w, cs * 0.1);
      for (const cr of cranes) {
        const X = (cr.x + 0.5) * cs;
        ctx.fillStyle = '#ffa94d'; ctx.fillRect(X - cs * 0.35, cs * 0.12, cs * 0.7, cs * 0.3);
        if (!cr.dropped) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X, cs * 0.42); ctx.lineTo(X, cs * 0.75); ctx.stroke(); crate(cr.crate, cr.x, 0.4 - TOP + 0.35); }
        // značka cíle
        ctx.fillStyle = 'rgba(255,169,77,.35)'; ctx.fillRect(cr.target * cs + cs * 0.3, (TOP - 0.12) * cs, cs * 0.4, cs * 0.08);
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = grid[y][x]; if (c) crate(c, x + c.ox, y + c.oy); }
      for (const f of falling) crate(f, f.x, f.y);
      for (const f of flashes) { ctx.fillStyle = `rgba(255,255,255,${f.t * 2})`; ctx.fillRect(0, (f.y + TOP) * cs, w, cs); }
      if (worker) drawWorker();
      for (const p of parts) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = p.col; ctx.fillRect(p.x * cs - 2, (p.y + TOP) * cs - 2, 4, 4); }
      ctx.globalAlpha = 1;
      ctx.font = `700 ${Math.max(11, cs * 0.45)}px Unbounded, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of pops) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = '#ffe066'; ctx.fillText(p.text, p.x * cs, (p.y + TOP - (1.2 - p.t)) * cs); }
      ctx.globalAlpha = 1;
      if (msg) { ctx.fillStyle = '#ffe066'; ctx.shadowColor = '#ffa94d'; ctx.shadowBlur = 12; ctx.fillText(msg.text, w / 2, (TOP + 2.5) * cs); ctx.shadowBlur = 0; }
      scoreEl.textContent = Kit.fmtNum(score);
      rowsEl.textContent = P.type === 'goal' ? `${rows} / ${P.goal}` : rows;
      const lh = '<i></i>'.repeat(Math.max(0, lives));
      if (livesEl.innerHTML !== lh) livesEl.innerHTML = lh;
    }

    // ── Smyčka ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (api.paused() && !paused) setPause(true);
      if (!paused && !over) tick(dt);
      draw();
    }
    function setPause(on) {
      if (over) return; paused = on; api.setTimer(!on); ov.hidden = !on; held = 0; stepReq = 0;
      if (on) ov.innerHTML = `<div><b>${L('Pauza', 'Paused')}</b><button class="k-btn primary" data-b="resume">${L('Pokračovat', 'Resume')}</button></div>`;
      else last = performance.now();
    }

    // ── Ovládání: ← → chůze a tlačení, ↑ / mezerník skok ──
    const keys = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 };
    const onKeyUp = e => { if (keys[e.key] && held === keys[e.key]) held = 0; };
    addEventListener('keyup', onKeyUp);
    el.querySelectorAll('[data-m]').forEach(b => {
      const d = +b.dataset.m;
      b.addEventListener('pointerdown', e => { e.preventDefault(); if (!paused) { held = d; stepReq = d; } });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { if (held === d) held = 0; });
    });
    el.querySelector('[data-j]').addEventListener('pointerdown', e => { e.preventDefault(); if (!paused) jumpReq = true; });
    el.querySelector('[data-b="pause"]').addEventListener('click', () => setPause(!paused));
    ov.addEventListener('click', e => { if (e.target.closest('[data-b="resume"]')) setPause(false); });
    // tah po skladu: do strany jde, nahoru skočí
    let sw = null;
    const stage = el.querySelector('.sk-stage');
    stage.addEventListener('pointerdown', e => { sw = { x: e.clientX, y: e.clientY }; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', e => {
      if (!sw || paused) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
      if (dy < -24 && Math.abs(dy) > Math.abs(dx)) { jumpReq = true; sw = { x: e.clientX, y: e.clientY }; return; }
      if (Math.abs(dx) > cs * 0.8) { stepReq = Math.sign(dx); sw = { x: e.clientX, y: e.clientY }; }
    });
    stage.addEventListener('pointerup', () => (sw = null));

    // obnovení: sklad se uloží celý, rozpracované bedny ve vzduchu dopadnou rovnou
    if (saved && saved.grid) {
      grid = saved.grid.map(row => row.map(c => (c ? { ...c, ox: 0, oy: 0, t: c.t ?? 3 } : null)));
      score = saved.score; lives = saved.lives; livesLost = saved.livesLost; rows = saved.rows; elapsed = saved.elapsed;
      for (let i = 0; i < (saved.draws || 0); i++) rnd();
      spawnWorker(); paused = true; setTimeout(() => setPause(true), 0);
    } else reset();
    fit(); addEventListener('resize', fit);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => (over ? null : { grid: grid.map(row => row.map(c => (c ? { k: c.k, col: c.col, t: c.t } : null))), score, lives: Math.max(1, lives), livesLost, rows, elapsed }),
      progress: () => (P.type === 'goal' ? Math.min(1, rows / P.goal) : 0),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('keyup', onKeyUp); },
      pause() { setPause(true); },
      onKey(e) {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); setPause(!paused); return; }
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') { e.preventDefault(); if (!e.repeat) jumpReq = true; return; }
        const d = keys[e.key]; if (!d) return; e.preventDefault(); held = d; if (!e.repeat) stepReq = d;
      },
      _solve() { rows = P.goal || 10; score = Math.max(score, 1000); elapsed = Math.max(elapsed, 1); end(true); },
      _state: () => ({ worker: { c: worker.c, r: worker.r, dead: worker.dead }, rows, score, lives, falling: falling.length, cranes: cranes.length, row: r => grid[r].map(c => (c ? c.k : '.')).join('') }),
      _calm() { calm = true; cranes = []; falling = []; },
      _clear(c = 5, r = H - 1) { grid = [...Array(H)].map(() => new Array(W).fill(null)); worker.c = c; worker.r = r; worker.ox = worker.oy = 0; worker.busy = 0; },
      _place(x, y, k = 'box') { grid[y][x] = { k, col: COLORS[0], ox: 0, oy: 0, t: 3 }; },
      _row(y) { return grid[y].map(c => (c ? c.k[0] : '.')).join(''); },
      _check() { checkRows(); },
    };
  }

  function art(el) {
    const box = (x, y, col) => `<rect x="${x + 3}" y="${y + 3}" width="34" height="34" rx="3" fill="#1a1336" stroke="${col}" stroke-width="3"/><path d="M${x + 7} ${y + 7}L${x + 33} ${y + 33}M${x + 33} ${y + 7}L${x + 7} ${y + 33}" stroke="${col}" stroke-width="2" opacity=".5"/>`;
    el.innerHTML = `<svg viewBox="0 0 260 260"><defs><filter id="skGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <rect x="10" y="30" width="240" height="6" fill="#ffffff" opacity=".15"/><rect x="150" y="24" width="30" height="12" fill="#ffa94d"/><line x1="165" y1="36" x2="165" y2="60" stroke="#fff" opacity=".5"/>
      <g filter="url(#skGlow)">${box(145, 60, '#c77dff')}${box(30, 200, '#ffa94d')}${box(70, 200, '#55f6ff')}${box(150, 200, '#6dff9e')}${box(190, 200, '#ff9de6')}${box(190, 160, '#ffe066')}</g>
      <g transform="translate(108 160)"><rect x="9" y="58" width="6" height="17" fill="#3a4bff"/><rect x="21" y="58" width="6" height="17" fill="#3a4bff"/><rect x="6" y="36" width="24" height="26" rx="5" fill="#5d7bff"/><circle cx="18" cy="26" r="11" fill="#ffd9a8"/><path d="M6 23 A12 12 0 0 1 30 23 Z" fill="#ffe066"/><rect x="4" y="21" width="28" height="4" fill="#ffe066"/><circle cx="22" cy="28" r="2" fill="#10102e"/><circle cx="27" cy="28" r="2" fill="#10102e"/></g></svg>`;
  }
  return { DIFFS, generate, create, art, levelSpec };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'skladnik', title: 'SKLADNÍK',
  tagline: Kit.L('Jeřáby shazují bedny, ty je tlačíš a skládáš do plných řad. Hlavně ať ti žádná nespadne na hlavu.', 'Cranes drop crates, you push them into full rows. Just don\'t let one land on your head.'),
  diffs: Skladnik.DIFFS, generate: Skladnik.generate, create: Skladnik.create, art: Skladnik.art,
  online: { kind: 'race', diffs: ['shift', 'calm'] },
  dailyDiff: () => 'shift',
  levelDiff: () => 'shift',
  rules: Kit.L(`<p>Skládej bedny do plných řad: celá zaplněná řada zmizí a bedny nad ní spadnou níž.</p>
    <ul><li><b>Ovládání:</b> ← → chůze a tlačení, ↑ nebo mezerník skok, P pauza. Na telefonu tlačítka, nebo tah po skladu do strany (krok) a nahoru (skok).</li>
    <li>Bednu můžeš <b>tlačit</b>, jen když za ní je volno a nic na ní neleží. Po bednách se dá vyskočit o jedno patro.</li>
    <li>Jeřáby nahoře ukazují, kam bednu pustí. Když ti padající bedna dopadne na hlavu, přijdeš o život.</li>
    <li><b>Bomba</b> po dopadu za 3 sekundy vybuchne a rozmetá bedny kolem sebe; nestůj u ní. <b>♥</b> přidá život, <b>↑</b> pírko dá na chvíli vyšší skok (seber je chůzí).</li>
    <li>Když se sklad zaplní až ke stropu, směna končí.</li></ul>`,
    `<p>Stack crates into full rows: a completely filled row disappears and the crates above drop down.</p>
    <ul><li><b>Controls:</b> ← → walk and push, ↑ or Space jump, P pause. On a phone use the buttons, or drag on the warehouse sideways (step) or up (jump).</li>
    <li>You can <b>push</b> a crate only if the space behind it is free and nothing lies on it. You can jump one level up onto crates.</li>
    <li>The cranes at the top show where they will drop. A falling crate on your head costs a life.</li>
    <li>A <b>bomb</b> explodes 3 seconds after landing and blasts the crates around it; stay away. <b>♥</b> gives a life, <b>↑</b> the feather gives a higher jump for a while (walk into them).</li>
    <li>When the warehouse fills up to the ceiling, the shift is over.</li></ul>`),
  achievements: [],
});
