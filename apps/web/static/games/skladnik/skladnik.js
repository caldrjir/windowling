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
    const rnd = rngOf(P.seed), fx = Math.random; // rnd: bedny a jeřáby (stejné pro všechny), fx: jen efekty
    let grid = [...Array(H)].map(() => new Array(W).fill(null));
    let falling = [], cranes = [], parts = [], flashes = [], pops = [];
    let worker, lives = 3, livesLost = 0, rows = 0, score = 0, elapsed = 0, craneT = 1.2, over = false, paused = false, feather = 0, calm = false, clock = 0, msg = null;
    let held = 0, stepReq = 0, jumpReq = false, jumpBuf = 0, shake = 0; // stepReq/jumpBuf: krátký stisk se neztratí
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
      worker = { c: best, r: bestTop - 1, vx: best, vy: bestTop - 1, spx: 8, spy: 8, busy: 0, air: 0, airSteps: 0, fallN: 0, dead: 0, inv: 2, face: 1, push: 0, land: 0, walk: 0 };
      if (worker.r < 1) { end(false); }
    }

    // ── Bedny ──
    function settle() {
      for (let y = H - 2; y >= 0; y--) for (let x = 0; x < W; x++) {
        const c = grid[y][x];
        if (c && !grid[y + 1][x]) { grid[y][x] = null; falling.push({ ...c, x, y, oy: 0, vy: 2 }); }
      }
    }
    function land(f, row) {
      if (row < 0) { end(false); return; } // sklad přetekl
      const c = { k: f.k, col: f.col, ox: 0, oy: 0, t: 3 };
      grid[row][f.x] = c; c.oy = -0.12;
      for (let i = 0; i < 5; i++) parts.push({ x: f.x + 0.2 + fx() * 0.6, y: row + 1, vx: (fx() - 0.5) * 3, vy: -fx() * 1.5, t: 0.35 + fx() * 0.2, col: 'rgba(200,190,230,.6)', dust: true });
      if ((f.vy || 0) > 11) shake = Math.max(shake, 0.06);
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
      boom(bx + 0.5, by + 0.5, '#ffe066', 20); shake = 0.35;
      if (!worker.dead && worker.inv <= 0 && Math.abs(worker.c - bx) <= 1 && (Math.abs(worker.r - by) <= 1 || Math.abs(worker.r - 1 - by) <= 1)) die();
      settle();
    }
    function boom(x, y, col, n) { for (let i = 0; i < n; i++) { const a = fx() * 6.28, v = 1 + fx() * 4; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, t: 0.5 + fx() * 0.4, col }); } }

    // ── Jeřáby ──
    function spawnCrane() {
      const busy = new Set(cranes.map(c => c.target));
      const free = []; for (let x = 0; x < W; x++) if (!grid[0][x] && !busy.has(x)) free.push(x);
      if (!free.length) { if (!falling.length && [...Array(W).keys()].every(x => grid[0][x])) end(false); return; }
      const target = free[Math.floor(rnd() * free.length)], dir = rnd() < 0.5 ? 1 : -1;
      cranes.push({ x: dir > 0 ? -1.5 : W + 0.5, dir, target, crate: makeCrate() });
    }

    // ── Skladník ──
    // Logika je po polích; vx/vy je vykreslená poloha, která se k poli posouvá stálou rychlostí.
    const toward = (v, t, d) => (Math.abs(t - v) <= d ? t : v + Math.sign(t - v) * d);
    const WALK = 0.14, PUSH = 0.2, RISE = 0.11, HANG = 0.2;
    function die() {
      if (worker.dead) return;
      worker.dead = 1.4; lives--; livesLost++; boom(worker.c + 0.5, worker.r, '#ffe066', 18); api.sound('error'); api.changed(); shake = 0.25;
      falling = falling.filter(f => f.x !== worker.c);
    }
    function collect(c) {
      if (c.k === 'heart') { lives = Math.min(5, lives + 1); msg = { t: 1.2, text: L('ŽIVOT NAVÍC', 'EXTRA LIFE') }; }
      else { feather = 15; msg = { t: 1.2, text: L('PÍRKO: VYŠŠÍ SKOK', 'FEATHER: HIGH JUMP') }; }
      score += 50; api.sound('star');
    }
    // krok do strany; ve vzduchu se netlačí
    function tryMove(dir, inAir) {
      const w = worker, c2 = w.c + dir; w.face = dir;
      if (c2 < 0 || c2 >= W) return false;
      const feet = grid[w.r][c2], head = w.r - 1 >= 0 ? grid[w.r - 1][c2] : null;
      if (head) { if (collectible(head)) { collect(head); grid[w.r - 1][c2] = null; settle(); } else return false; }
      let dur = WALK;
      if (feet && collectible(feet)) { collect(feet); grid[w.r][c2] = null; settle(); }
      else if (feet) {
        const c3 = c2 + dir;
        if (inAir || c3 < 0 || c3 >= W || grid[w.r][c3] || falling.some(f => f.x === c3 && f.y + 1 > w.r && f.y < w.r + 1)) return false;
        grid[w.r][c3] = feet; grid[w.r][c2] = null; feet.ox = -dir; api.sound('place');
        dur = PUSH; w.push = 0.3;
        settle();
      }
      w.c = c2; w.spx = 1 / dur; w.busy = dur;
      if (falling.some(f => f.x === c2 && f.y + 1 > w.r - 1 && f.y < w.r + 1)) { die(); return true; }
      return true;
    }
    // skok o patro (s pírkem o dvě); ve vzduchu jde udělat jeden krok do strany
    function tryJump() {
      const w = worker, h = feather > 0 ? 2 : 1;
      let up = 0;
      while (up < h && w.r - 2 - up >= 0 && !grid[w.r - 2 - up][w.c]) up++;
      if (!up) return false;
      w.r -= up; w.busy = RISE * up; w.spy = 1 / RISE; w.air = w.busy + HANG; w.airSteps = 1; api.sound('tap');
      return true;
    }
    function updateWorker(dt) {
      const w = worker;
      w.vx = toward(w.vx, w.c, w.spx * dt); w.vy = toward(w.vy, w.r, w.spy * dt);
      w.push = Math.max(0, w.push - dt); w.land = Math.max(0, w.land - dt);
      if (w.vx !== w.c) w.walk += dt * 14;
      if (w.dead) { w.dead -= dt; if (w.dead <= 0) { if (lives <= 0) { end(false); return; } spawnWorker(); } return; }
      w.inv = Math.max(0, w.inv - dt);
      if (jumpReq) { jumpReq = false; jumpBuf = 0.18; }
      w.air = Math.max(0, w.air - dt); // čas ve vzduchu běží vždycky
      if (w.busy > 0) { w.busy -= dt; return; }
      jumpBuf = Math.max(0, jumpBuf - dt); // skok stisknutý během kroku počká, až krok doběhne
      const supported = solid(w.c, w.r + 1);
      if (supported) { if (w.fallN > 1) w.land = 0.12; w.fallN = 0; w.airSteps = 0; w.air = 0; }
      if (jumpBuf > 0 && supported) { jumpBuf = 0; if (tryJump()) return; }
      const step = stepReq || held; stepReq = 0;
      if (step) {
        if (supported) { if (tryMove(step, false)) return; }
        else if (w.air > 0 && w.airSteps > 0 && tryMove(step, true)) { w.airSteps--; return; }
      }
      if (!supported && w.air <= 0) {
        // pád zrychluje
        w.fallN++; const d = Math.max(0.045, 0.1 - w.fallN * 0.015);
        w.r++; w.busy = d; w.spy = 1 / d;
      }
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
        if (!cr.dropped && (cr.dir > 0 ? cr.x >= cr.target : cr.x <= cr.target)) { cr.dropped = true; falling.push({ ...cr.crate, x: cr.target, y: -0.6, vy: 3 }); }
      }
      cranes = cranes.filter(cr => cr.x > -3 && cr.x < W + 2);
      // padající bedny
      for (const f of falling.slice()) {
        f.vy = Math.min(15, (f.vy || 3) + 30 * dt); f.y += f.vy * dt;
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
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = grid[y][x]; if (c) { c.ox = toward(c.ox, 0, dt / 0.2); c.oy = toward(c.oy, 0, dt * 1.2); } }
      shake = Math.max(0, shake - dt);
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
    const TOP = 1.4, FLOOR = 0.35; // místo pro jeřáby nad skladem a podlaha pod ním
    const sprites = new Map(); let bgCv = null;
    function fit() {
      const phone = innerWidth < 760, vw = (document.getElementById('kView') || el).clientWidth - (phone ? 16 : 8);
      const hAvail = innerHeight - (phone ? 320 : 190);
      cs = Math.max(14, Math.floor(Math.min(vw / W, hAvail / (H + TOP + FLOOR), 44)));
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(W * cs * dpr); cv.height = Math.round((H + TOP + FLOOR) * cs * dpr); cv.style.width = W * cs + 'px'; cv.style.height = Math.round((H + TOP + FLOOR) * cs) + 'px';
      wrapEl.classList.toggle('phone', phone);
      sprites.clear(); bgCv = null;
    }
    // ── Sprity: bedny se kreslí jednou do malých plátének ──
    function sprite(key, paint) {
      if (sprites.has(key)) return sprites.get(key);
      const c = document.createElement('canvas'), n = Math.ceil(cs * dpr);
      c.width = c.height = n; const g = c.getContext('2d'); g.scale(dpr, dpr); paint(g, cs);
      sprites.set(key, c); return c;
    }
    function woodBox(g, s, col) {
      const p = s * 0.06;
      const wood = g.createLinearGradient(0, 0, 0, s); wood.addColorStop(0, '#c48a4e'); wood.addColorStop(1, '#8a5a30');
      g.fillStyle = wood; g.beginPath(); g.roundRect(p * 0.5, p * 0.5, s - p, s - p, p * 1.2); g.fill();
      // prkna
      g.strokeStyle = 'rgba(60,32,12,.45)'; g.lineWidth = Math.max(1, s * 0.025);
      for (const k of [0.36, 0.64]) { g.beginPath(); g.moveTo(p * 2.2, s * k); g.lineTo(s - p * 2.2, s * k); g.stroke(); }
      // rám a vzpěra
      g.strokeStyle = '#5e3a1a'; g.lineWidth = s * 0.09; g.strokeRect(s * 0.1, s * 0.1, s * 0.8, s * 0.8);
      g.lineWidth = s * 0.07; g.beginPath(); g.moveTo(s * 0.16, s * 0.84); g.lineTo(s * 0.84, s * 0.16); g.stroke();
      g.strokeStyle = 'rgba(255,220,170,.35)'; g.lineWidth = Math.max(1, s * 0.025); g.beginPath(); g.moveTo(s * 0.12, s * 0.08); g.lineTo(s * 0.88, s * 0.08); g.stroke();
      // kovové rohy
      g.fillStyle = '#9aa0b8';
      for (const [x, y] of [[0.05, 0.05], [0.83, 0.05], [0.05, 0.83], [0.83, 0.83]]) { g.fillRect(s * x, s * y, s * 0.12, s * 0.12); }
      g.fillStyle = '#5a5f78'; for (const [x, y] of [[0.1, 0.1], [0.88, 0.1], [0.1, 0.88], [0.88, 0.88]]) { g.beginPath(); g.arc(s * x, s * y, s * 0.02, 0, 7); g.fill(); }
      // barevný štítek
      if (col) { g.fillStyle = col; g.shadowColor = col; g.shadowBlur = s * 0.2; g.beginPath(); g.roundRect(s * 0.6, s * 0.2, s * 0.22, s * 0.16, s * 0.03); g.fill(); g.shadowBlur = 0; }
    }
    function crateSprite(c) {
      if (c.k === 'heart') return sprite('heart', (g, s) => {
        woodBox(g, s, null);
        g.fillStyle = 'rgba(20,10,30,.55)'; g.beginPath(); g.arc(s / 2, s / 2, s * 0.28, 0, 7); g.fill();
        g.fillStyle = '#ff5a7a'; g.shadowColor = '#ff5a7a'; g.shadowBlur = s * 0.4;
        g.beginPath(); g.moveTo(s / 2, s * 0.7); g.bezierCurveTo(s * 0.2, s * 0.5, s * 0.3, s * 0.28, s / 2, s * 0.4); g.bezierCurveTo(s * 0.7, s * 0.28, s * 0.8, s * 0.5, s / 2, s * 0.7); g.fill();
      });
      if (c.k === 'feather') return sprite('feather', (g, s) => {
        woodBox(g, s, null);
        g.fillStyle = 'rgba(20,10,30,.55)'; g.beginPath(); g.arc(s / 2, s / 2, s * 0.28, 0, 7); g.fill();
        g.save(); g.translate(s / 2, s / 2); g.rotate(-0.6);
        g.fillStyle = '#55f6ff'; g.shadowColor = '#55f6ff'; g.shadowBlur = s * 0.4;
        g.beginPath(); g.ellipse(0, -s * 0.03, s * 0.09, s * 0.22, 0, 0, 7); g.fill();
        g.strokeStyle = '#e8fdff'; g.lineWidth = Math.max(1, s * 0.025); g.beginPath(); g.moveTo(0, s * 0.26); g.lineTo(0, -s * 0.22); g.stroke(); g.restore();
      });
      return sprite('box' + c.col, (g, s) => woodBox(g, s, c.col));
    }
    function drawBomb(c, X, Y) {
      const s = cs, cx = X + s / 2, cy = Y + s * 0.58, r = s * 0.36, hot = c.t < 1;
      const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
      g.addColorStop(0, '#5b5470'); g.addColorStop(1, '#16121f');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a3448'; ctx.fillRect(cx - s * 0.1, cy - r - s * 0.08, s * 0.2, s * 0.1);
      ctx.strokeStyle = '#c9a36a'; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.beginPath(); ctx.moveTo(cx, cy - r - s * 0.06); ctx.quadraticCurveTo(cx + s * 0.18, cy - r - s * 0.25, cx + s * 0.3, cy - r - s * 0.16); ctx.stroke();
      // jiskra na doutnáku
      const sp = 0.5 + 0.5 * Math.sin(clock * 30);
      ctx.fillStyle = '#ffe066'; ctx.shadowColor = '#ffa94d'; ctx.shadowBlur = s * 0.5;
      ctx.beginPath(); ctx.arc(cx + s * 0.3, cy - r - s * 0.16, s * (0.05 + 0.04 * sp), 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      if (hot && Math.floor(clock * 10) % 2) { ctx.fillStyle = 'rgba(255,90,122,.45)'; ctx.beginPath(); ctx.arc(cx, cy, r * 1.15, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.font = `800 ${s * 0.32}px Unbounded, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(Math.max(1, Math.ceil(c.t)), cx, cy + s * 0.02);
    }
    function crate(c, x, y) {
      const X = x * cs, Y = (y + TOP) * cs;
      if (c.k === 'bomb') { drawBomb(c, X, Y); return; }
      ctx.drawImage(crateSprite(c), X, Y, cs, cs);
    }
    // ── Pozadí: zeď skladu, regály, okna, trámy, kolejnice a podlaha (jednou do vrstvy) ──
    function background() {
      if (bgCv) return bgCv;
      const w = W * cs, h = (H + TOP + FLOOR) * cs;
      bgCv = document.createElement('canvas'); bgCv.width = Math.round(w * dpr); bgCv.height = Math.round(h * dpr);
      const g = bgCv.getContext('2d'); g.scale(dpr, dpr);
      const wall = g.createLinearGradient(0, 0, 0, h); wall.addColorStop(0, '#120c2e'); wall.addColorStop(1, '#1d1440');
      g.fillStyle = wall; g.fillRect(0, 0, w, h);
      // okna se světlem
      for (const wx of [2.2, 8.2]) {
        const X = wx * cs, Y = (TOP + 0.6) * cs, ww = cs * 1.6, wh = cs * 1.2;
        const glow = g.createRadialGradient(X + ww / 2, Y + wh / 2, 0, X + ww / 2, Y + wh / 2, cs * 3.5);
        glow.addColorStop(0, 'rgba(120,150,255,.18)'); glow.addColorStop(1, 'rgba(120,150,255,0)');
        g.fillStyle = glow; g.fillRect(X - cs * 3, Y - cs * 3, ww + cs * 6, wh + cs * 6);
        g.fillStyle = '#2b3a7a'; g.fillRect(X, Y, ww, wh);
        g.strokeStyle = '#0c0820'; g.lineWidth = cs * 0.08; g.strokeRect(X, Y, ww, wh);
        g.beginPath(); g.moveTo(X + ww / 2, Y); g.lineTo(X + ww / 2, Y + wh); g.moveTo(X, Y + wh / 2); g.lineTo(X + ww, Y + wh / 2); g.stroke();
      }
      // regály v pozadí
      g.globalAlpha = 0.5;
      for (let i = 0; i < 3; i++) {
        const Y = (TOP + 3.6 + i * 2.4) * cs;
        g.fillStyle = '#2a2056'; g.fillRect(0, Y, w, cs * 0.12);
        for (let x = 0.2; x < W; x += 0.9 + ((x * 7.3) % 0.6)) { const bh = cs * (0.4 + ((x * 3.1) % 0.5)); g.fillStyle = (x * 10) % 3 < 1 ? '#3a2c6c' : '#30245c'; g.fillRect(x * cs, Y - bh, cs * 0.7, bh); }
      }
      g.globalAlpha = 1;
      // ocelové sloupy
      for (const px of [0, 4, 8, 12]) { g.fillStyle = 'rgba(80,70,140,.35)'; g.fillRect(px * cs - cs * 0.08, TOP * cs, cs * 0.16, H * cs); }
      // střešní příhradový nosník
      g.strokeStyle = 'rgba(160,150,220,.25)'; g.lineWidth = Math.max(1, cs * 0.05);
      g.beginPath(); for (let x = 0; x <= W; x += 0.5) { g.moveTo(x * cs, cs * 0.05); g.lineTo((x + 0.25) * cs, cs * 0.22); g.lineTo((x + 0.5) * cs, cs * 0.05); } g.stroke();
      // kolejnice jeřábů (I-profil s nýty)
      g.fillStyle = '#4a4470'; g.fillRect(0, cs * 0.22, w, cs * 0.14);
      g.fillStyle = '#6c6698'; g.fillRect(0, cs * 0.22, w, cs * 0.04);
      g.fillStyle = '#2a2448'; for (let x = 0.25; x < W; x += 0.5) { g.beginPath(); g.arc(x * cs, cs * 0.3, cs * 0.025, 0, 7); g.fill(); }
      // podlaha s výstražným pruhem
      const fy = (H + TOP) * cs;
      g.fillStyle = '#2a2244'; g.fillRect(0, fy, w, FLOOR * cs);
      g.save(); g.beginPath(); g.rect(0, fy, w, cs * 0.14); g.clip();
      for (let x = -1; x < W * 2 + 2; x++) { g.fillStyle = x % 2 ? '#ffd23f' : '#16122a'; g.beginPath(); g.moveTo(x * cs * 0.5, fy); g.lineTo((x + 1) * cs * 0.5, fy); g.lineTo((x + 0.7) * cs * 0.5, fy + cs * 0.14); g.lineTo((x - 0.3) * cs * 0.5, fy + cs * 0.14); g.fill(); }
      g.restore();
      return bgCv;
    }
    // kam dopadne bedna ve sloupci (horní volné pole)
    function landRow(x, fromY) { let y = Math.max(0, Math.floor(fromY) + 1); while (y < H && !grid[y][x]) y++; return y - 1; }
    function drawCrane(cr) {
      const s = cs, X = (cr.x + 0.5) * s, ry = s * 0.22;
      // vozík
      ctx.fillStyle = '#1b1636'; ctx.beginPath(); ctx.arc(X - s * 0.22, ry, s * 0.07, 0, 7); ctx.arc(X + s * 0.22, ry, s * 0.07, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.roundRect(X - s * 0.38, ry + s * 0.06, s * 0.76, s * 0.3, s * 0.06); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.roundRect(X - s * 0.38, ry + s * 0.06, s * 0.76, s * 0.3, s * 0.06); ctx.clip();
      ctx.fillStyle = '#16122a'; for (let k = -3; k < 4; k++) { ctx.beginPath(); ctx.moveTo(X + k * s * 0.18, ry + s * 0.36); ctx.lineTo(X + k * s * 0.18 + s * 0.09, ry + s * 0.36); ctx.lineTo(X + k * s * 0.18 + s * 0.2, ry + s * 0.06); ctx.lineTo(X + k * s * 0.18 + s * 0.11, ry + s * 0.06); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = Math.floor(clock * 4) % 2 ? '#ff5a7a' : '#7a2a3a'; ctx.beginPath(); ctx.arc(X, ry + s * 0.02, s * 0.05, 0, 7); ctx.fill();
      // lano a hák
      const hookY = cr.dropped ? ry + s * 0.5 : ry + s * 0.62;
      ctx.strokeStyle = '#9aa0b8'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.beginPath(); ctx.moveTo(X, ry + s * 0.36); ctx.lineTo(X, hookY); ctx.stroke();
      ctx.strokeStyle = '#c8cde0'; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.beginPath(); ctx.moveTo(X - s * 0.2, hookY + s * 0.08); ctx.lineTo(X - s * 0.2, hookY); ctx.lineTo(X + s * 0.2, hookY); ctx.lineTo(X + s * 0.2, hookY + s * 0.08); ctx.stroke();
      if (!cr.dropped) crate(cr.crate, cr.x, hookY / s + 0.06 - TOP);
    }
    function warn(x, row, k) {
      // stín bedny na místě dopadu (sílí, jak se blíží)
      if (row < 0) return;
      const X = (x + 0.5) * cs, Y = (row + 1 + TOP) * cs;
      ctx.fillStyle = `rgba(255,90,122,${0.12 + 0.35 * k})`;
      ctx.beginPath(); ctx.ellipse(X, Y - cs * 0.04, cs * (0.25 + 0.2 * k), cs * 0.08, 0, 0, 7); ctx.fill();
    }
    function drawWorker() {
      const w = worker, s = cs;
      if (w.inv > 0 && !w.dead && Math.floor(clock * 12) % 2) return;
      const feetX = (w.vx + 0.5) * s, feetY = (w.vy + 1 + TOP) * s;
      const moving = w.vx !== w.c, airborne = w.vy !== w.r || w.air > 0 || !solid(w.c, w.r + 1);
      const ph = Math.sin(w.walk), sq = w.land > 0 ? 0.9 : 1;
      // stín na podlaze/bedně pod ním
      const below = landRow(Math.round(w.vx), w.vy) + 1;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(feetX, (below + TOP) * s - s * 0.03, s * 0.28, s * 0.06, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(feetX, feetY);
      if (w.dead) { ctx.rotate(Math.min(1.4, (1.4 - w.dead) * 3) * -w.face); ctx.globalAlpha = Math.min(1, w.dead * 2); }
      ctx.scale(w.face, sq);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const O = '#120c26', lw = Math.max(1.5, s * 0.05);
      // nohy
      const legA = airborne ? 0.5 : moving ? ph * 0.5 : 0, legB = airborne ? -0.3 : moving ? -ph * 0.5 : 0;
      for (const [a, col] of [[legB, '#2b3a8f'], [legA, '#3a4fc4']]) {
        ctx.save(); ctx.translate(0, -s * 0.62); ctx.rotate(a);
        ctx.fillStyle = col; ctx.strokeStyle = O; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.roundRect(-s * 0.09, 0, s * 0.18, s * 0.5, s * 0.06); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3b2a1e'; ctx.beginPath(); ctx.roundRect(-s * 0.1, s * 0.46, s * 0.27, s * 0.13, s * 0.05); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      // zadní ruka
      const pushing = w.push > 0, armBack = pushing ? -1.45 : airborne ? -2.4 : moving ? -ph * 0.6 : 0.1;
      const arm = (a, col, px) => { ctx.save(); ctx.translate(px, -s * 1.22); ctx.rotate(a); ctx.fillStyle = col; ctx.strokeStyle = O; ctx.lineWidth = lw; ctx.beginPath(); ctx.roundRect(-s * 0.07, 0, s * 0.14, s * 0.46, s * 0.06); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#f2c79a'; ctx.beginPath(); ctx.arc(0, s * 0.48, s * 0.075, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); };
      arm(armBack, '#c66a1c', -s * 0.12);
      // trup: modré tričko a reflexní vesta
      ctx.fillStyle = '#3a4fc4'; ctx.strokeStyle = O; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.roundRect(-s * 0.22, -s * 1.3, s * 0.44, s * 0.72, s * 0.12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.roundRect(-s * 0.22, -s * 1.27, s * 0.44, s * 0.6, s * 0.1); ctx.fill();
      ctx.fillStyle = '#e8f0ff'; ctx.fillRect(-s * 0.22, -s * 0.98, s * 0.44, s * 0.06); ctx.fillRect(-s * 0.22, -s * 0.84, s * 0.44, s * 0.06);
      // přední ruka
      const armFront = pushing ? -1.5 : airborne ? -2.7 : moving ? ph * 0.6 : -0.1;
      arm(armFront, '#ff8a1f', s * 0.14);
      // hlava
      ctx.fillStyle = '#f2c79a'; ctx.strokeStyle = O; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(s * 0.02, -s * 1.53, s * 0.22, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = O; ctx.beginPath(); ctx.arc(s * 0.1, -s * 1.55, s * 0.035, 0, 7); ctx.fill();
      if (w.dead) { ctx.strokeStyle = O; ctx.beginPath(); ctx.moveTo(s * 0.06, -s * 1.59); ctx.lineTo(s * 0.14, -s * 1.51); ctx.moveTo(s * 0.14, -s * 1.59); ctx.lineTo(s * 0.06, -s * 1.51); ctx.stroke(); }
      ctx.strokeStyle = O; ctx.lineWidth = Math.max(1, s * 0.03); ctx.beginPath(); ctx.arc(s * 0.1, -s * 1.47, s * 0.06, 0.2, pushing ? 1.2 : 2.6); ctx.stroke();
      // helma
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = O; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(s * 0.01, -s * 1.6, s * 0.24, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(-s * 0.26, -s * 1.63, s * 0.58, s * 0.07, s * 0.03); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-s * 0.06, -s * 1.74, s * 0.08, s * 0.035, -0.4, 0, 7); ctx.fill();
      if (feather > 0) { ctx.fillStyle = '#55f6ff'; ctx.shadowColor = '#55f6ff'; ctx.shadowBlur = s * 0.4; ctx.beginPath(); ctx.ellipse(-s * 0.2, -s * 1.86, s * 0.05, s * 0.14, -0.6, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
      ctx.restore();
      if (w.dead) {
        // hvězdičky kolem hlavy
        for (let i = 0; i < 3; i++) { const a = clock * 5 + i * 2.1; ctx.fillStyle = '#ffe066'; ctx.font = `${s * 0.3}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('★', feetX + Math.cos(a) * s * 0.35, feetY - s * 1.6 + Math.sin(a) * s * 0.12); }
      }
    }
    function draw() {
      const w = W * cs, h = (H + TOP + FLOOR) * cs;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (shake > 0) { const m = shake * cs * 0.5; ctx.translate((fx() - 0.5) * m, (fx() - 0.5) * m); }
      ctx.drawImage(background(), 0, 0, w, h);
      // varování: kam dopadnou bedny
      for (const cr of cranes) if (!cr.dropped) warn(cr.target, landRow(cr.target, -1), 0.15);
      for (const f of falling) { const lr = landRow(f.x, f.y); warn(f.x, lr, Math.min(1, Math.max(0, 1 - (lr - f.y) / 8))); }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = grid[y][x]; if (c) crate(c, x + c.ox, y + c.oy); }
      for (const f of falling) crate(f, f.x, f.y);
      for (const f of flashes) {
        ctx.fillStyle = `rgba(255,240,200,${f.t * 2.2})`; ctx.fillRect(0, (f.y + TOP) * cs, w, cs);
        for (let i = 0; i < 6; i++) { ctx.fillStyle = '#fff'; const x = ((i * 2.3 + clock * 7) % W) * cs; ctx.fillRect(x, (f.y + TOP + 0.5) * cs - 1, cs * 0.5 * f.t * 3, 2); }
      }
      if (worker) drawWorker();
      for (const cr of cranes) drawCrane(cr);
      for (const p of parts) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = p.col; const z = p.dust ? cs * 0.12 * (1.4 - p.t) : 4; ctx.fillRect(p.x * cs - z / 2, (p.y + TOP) * cs - z / 2, z, z); }
      ctx.globalAlpha = 1;
      ctx.font = `800 ${Math.max(11, cs * 0.45)}px Unbounded, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of pops) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = '#ffe066'; ctx.strokeStyle = '#120c26'; ctx.lineWidth = 4; ctx.strokeText(p.text, p.x * cs, (p.y + TOP - (1.2 - p.t)) * cs); ctx.fillText(p.text, p.x * cs, (p.y + TOP - (1.2 - p.t)) * cs); }
      ctx.globalAlpha = 1;
      if (msg) { ctx.fillStyle = '#ffe066'; ctx.strokeStyle = '#120c26'; ctx.lineWidth = 5; ctx.strokeText(msg.text, w / 2, (TOP + 2.5) * cs); ctx.fillText(msg.text, w / 2, (TOP + 2.5) * cs); }
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
      _clear(c = 5, r = H - 1) { grid = [...Array(H)].map(() => new Array(W).fill(null)); Object.assign(worker, { c, r, vx: c, vy: r, busy: 0, air: 0, airSteps: 0 }); },
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
