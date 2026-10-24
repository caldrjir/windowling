'use strict';
// ── MLSOUN · Windowling Hlavolamy ───────────────────────────────────────────
// Vlastní verze klasické honičky v bludišti (na motivy Pac-Mana): Mlsoun spořádá všechny tečky,
// čtyři přízraky ho honí (každý jinak), velká tečka je na chvíli vyleká a dají se sníst.
// Bludiště se generují ze semínka (engine.js), takže denní bludiště je pro všechny stejné.
// Režimy: Klidný, Bludiště, Arkáda (bludiště za bludištěm na skóre). Cesta: 120 bludišť.
const Mlsoun = (() => {
  const L = Kit.L, E = MlsounEngine, { W, H, DIRS, OPP } = E;
  const DIFFS = [
    { id: 'maze', name: L('Bludiště', 'Maze'), note: L('sněz všechny tečky, 3 životy', 'eat every dot, 3 lives'), par: 75 },
    { id: 'calm', name: L('Klidný', 'Calm'), note: L('pomalejší přízraci, 5 životů', 'slower ghosts, 5 lives'), par: 90 },
    { id: 'arcade', name: L('Arkáda', 'Arcade'), note: L('10 bludišť, rychlost roste', '10 mazes, speeding up'), metric: 'score' },
  ];
  const GHOSTS = [
    { id: 'blesk', color: '#ff5a7a', corner: { x: W - 2, y: -2 } },
    { id: 'rumenka', color: '#ff9de6', corner: { x: 1, y: -2 } },
    { id: 'mrazik', color: '#55f6ff', corner: { x: W - 1, y: H + 1 } },
    { id: 'jantar', color: '#ffa94d', corner: { x: 0, y: H + 1 } },
  ];
  const PHASES = [7, 20, 7, 20, 5, 20, 5, Infinity]; // rozptýlení / honička
  const BONUS = [100, 300, 500, 700, 1000, 2000, 3000, 5000];
  const ARCADE_MAZES = 10;

  // Nastavení podle úrovně (rychlosti v dlaždicích za sekundu)
  function tuning(lv, calm) {
    const k = Math.min(lv, 16) - 1;
    return {
      pac: 7.4 + Math.min(k, 8) * 0.12,
      ghost: (calm ? 5.4 : 6.6) + k * (calm ? 0.06 : 0.12),
      fright: Math.max(calm ? 4 : 1.5, (calm ? 9 : 7) - k * 0.4),
      release: [0, 1.5, 5, 9].map(t => t * Math.max(0.35, 1 - k * 0.05)),
    };
  }
  function levelSpec(n) {
    const ghosts = n < 6 ? 2 : n < 16 ? 3 : 4;
    const lv = 1 + Math.floor((n - 1) / 8);
    return { ghosts, lv, lives: 3, text: L(`Bludiště ${n} · přízraků ${ghosts} · rychlost ${lv}`, `Maze ${n} · ${ghosts} ghosts · speed ${lv}`) };
  }

  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') return Object.assign({ seed, mode: 'level', n: ctx.key, type: 'maze' }, levelSpec(ctx.key));
    if (ctx.kind === 'daily') return { seed, mode: 'daily', type: 'maze', ghosts: 4, lv: 2, lives: 3, text: L('Denní bludiště', 'Daily maze') };
    if (diffId === 'calm') return { seed, mode: 'free', type: 'maze', ghosts: 4, lv: 1, lives: 5, calm: true };
    if (diffId === 'arcade') return { seed, mode: 'free', type: 'arcade', ghosts: 4, lv: 1, lives: 3 };
    return { seed, mode: 'free', type: 'maze', ghosts: 4, lv: 1, lives: 3 };
  }

  function create(el, P, saved, api) {
    let mazeNo = 0, maze, dots, total = 0, eaten = 0;
    let score = 0, lives = P.lives, lv = P.lv || 1, livesLost = 0, elapsed = 0, extra = false;
    let pac, ghosts = [], phase = 0, phaseT = 0, fright = 0, chain = 0, bonus = null, bonusDone = 0;
    let state = 'ready', stateT = 1.6, over = false, paused = false, want = null, msg = null, pops = [], clock = 0;
    const rnd = Kit.rng(P.seed ^ 0x5eed);
    let T = tuning(lv, P.calm);

    function loadMaze(i, savedDots) {
      mazeNo = i;
      maze = E.generate(i === 0 ? P.seed : (P.seed + i * 7919) >>> 0);
      dots = savedDots && savedDots.length === maze.dots.length ? Uint8Array.from(savedDots, ch => +ch) : maze.dots.slice();
      total = 0; eaten = 0;
      for (let k = 0; k < dots.length; k++) { if (maze.dots[k]) total++; if (maze.dots[k] && !dots[k]) eaten++; }
      bonusDone = 0; bonus = null; drawWalls();
    }
    function resetActors() {
      pac = { x: E.START.x, y: E.START.y, dir: 'l', moving: false };
      want = null;
      ghosts = GHOSTS.slice(0, P.ghosts).map((d, i) => ({ ...d, i, x: E.GHOST_HOME[i].x, y: E.GHOST_HOME[i].y, dir: 'l', st: i === 0 ? 'out' : 'house', t: 0 }));
      phase = 0; phaseT = 0; fright = 0; chain = 0;
      T = tuning(lv, P.calm);
      state = 'ready'; stateT = 1.6;
    }

    // ── Logika ──
    const at = e => ({ x: E.wrapX(Math.round(e.x)), y: Math.round(e.y) });
    function pacTurn(e) {
      const { x, y } = at(e);
      if (want && E.canGo(maze, x, y, want)) return want;
      if (E.canGo(maze, x, y, e.dir)) return e.dir;
      return null;
    }
    function ghostTarget(g) {
      if (phase % 2 === 0) return g.corner;
      const p = at(pac), [dx, dy] = DIRS[pac.dir];
      if (g.i === 0) return p;
      if (g.i === 1) return { x: p.x + dx * 4, y: p.y + dy * 4 };
      if (g.i === 2) { const b = ghosts[0], ax = p.x + dx * 2, ay = p.y + dy * 2; return { x: ax * 2 - Math.round(b.x), y: ay * 2 - Math.round(b.y) }; }
      return (p.x - g.x) ** 2 + (p.y - g.y) ** 2 > 64 ? p : g.corner;
    }
    function moveGhost(g, dt) {
      if (g.st === 'house') {
        g.t += dt; g.y = 10 + Math.sin(g.t * 6 + g.i) * 0.25;
        if (elapsed - g.born >= T.release[g.i]) g.st = 'leave';
        return;
      }
      if (g.st === 'leave' || g.st === 'enter') {
        // přímá cesta dvířky: do středu domečku, nahoru ven (nebo dolů dovnitř)
        const sp = (g.st === 'enter' ? 10 : 3.5) * dt;
        const tx = E.DOOR.x, ty = g.st === 'leave' ? E.GHOST_OUT.y : 10;
        if (Math.abs(g.x - tx) > 0.01) g.x += Math.sign(tx - g.x) * Math.min(sp, Math.abs(tx - g.x));
        else { g.x = tx; g.y += Math.sign(ty - g.y) * Math.min(sp, Math.abs(ty - g.y)); }
        if (Math.abs(g.x - tx) < 0.01 && Math.abs(g.y - ty) < 0.01) {
          g.x = tx; g.y = ty;
          if (g.st === 'leave') { g.st = 'out'; g.dir = 'l'; g.scared = fright > 0 && !g.ate; } else { g.st = 'leave'; g.ate = true; }
        }
        return;
      }
      let speed = T.ghost;
      if (g.st === 'eyes') speed = 14;
      else if (g.scared) speed = 4.2;
      const y = Math.round(g.y);
      if (y === E.TUNNEL_Y && (g.x < 2.5 || g.x > W - 3.5) && g.st !== 'eyes') speed *= 0.55;
      E.advance(maze, g, speed * dt, e => {
        if (g.st === 'eyes' && Math.round(e.x) === E.GHOST_OUT.x && Math.round(e.y) === E.GHOST_OUT.y) { g.st = 'enter'; return null; }
        const target = g.st === 'eyes' ? E.GHOST_OUT : ghostTarget(g);
        return E.ghostDir(maze, e, target, g.scared ? rnd : null);
      });
    }
    function eat() {
      const { x, y } = at(pac), k = y * W + x;
      if (dots[k]) {
        const power = dots[k] === 2; dots[k] = 0; eaten++;
        addScore(power ? 50 : 10);
        if (power) { fright = T.fright; chain = 0; for (const g of ghosts) { if (g.st === 'eyes' || g.st === 'enter') continue; g.ate = false; if (g.st === 'out') { g.scared = true; g.dir = OPP[g.dir]; } } api.sound('star'); }
        else if (eaten % 2) api.sound('soft');
        if ((eaten === 50 || eaten === 120) && bonusDone < 2) { bonusDone++; bonus = { t: 9, pts: BONUS[Math.min(lv, BONUS.length) - 1] }; }
        api.changed();
        if (eaten >= total) clearMaze();
      }
      if (bonus && Math.abs(pac.x - E.START.x) < 0.5 && Math.abs(pac.y - E.START.y) < 0.5) { addScore(bonus.pts); pops.push({ x: E.START.x, y: E.START.y, t: 1.2, text: bonus.pts }); bonus = null; api.sound('line'); }
    }
    function addScore(n) {
      const before = score; score += n;
      if (!extra && before < 10000 && score >= 10000) { extra = true; lives++; msg = { t: 1.6, text: L('ŽIVOT NAVÍC', 'EXTRA LIFE') }; api.sound('win'); }
    }
    function collide() {
      for (const g of ghosts) {
        if (g.st !== 'out') continue;
        if (Math.abs(g.x - pac.x) + Math.abs(g.y - pac.y) > 0.75 && !(Math.abs(Math.abs(g.x - pac.x) - W) < 0.75 && Math.abs(g.y - pac.y) < 0.5)) continue;
        if (g.scared) {
          chain++; const pts = 200 * 2 ** (chain - 1); addScore(pts);
          pops.push({ x: g.x, y: g.y, t: 1.1, text: pts }); g.st = 'eyes'; g.scared = false; api.sound('line');
        } else { die(); return; }
      }
    }
    function die() {
      state = 'dying'; stateT = 1.4; livesLost++; lives--; api.sound('error'); api.changed();
    }
    function clearMaze() {
      state = 'clear'; stateT = 1.8; api.sound('win');
    }
    function afterState() {
      if (state === 'dying') {
        if (lives <= 0) { end(false); return; }
        resetActors(); return;
      }
      if (state === 'clear') {
        if (P.type === 'arcade' && mazeNo + 1 < ARCADE_MAZES) {
          lv++; loadMaze(mazeNo + 1); resetActors(); for (const g of ghosts) g.born = elapsed;
          msg = { t: 1.6, text: L(`BLUDIŠTĚ ${mazeNo + 1}`, `MAZE ${mazeNo + 1}`) }; api.changed(); return;
        }
        end(true); return;
      }
      if (state === 'ready') { state = 'play'; for (const g of ghosts) g.born = elapsed; }
    }
    function end(won) {
      if (over) return; over = true; api.setTimer(false);
      const info = `<p class="k-muted">${L(`Skóre ${Kit.fmtNum(score)} · ztracené životy ${livesLost}`, `Score ${Kit.fmtNum(score)} · lives lost ${livesLost}`)}${P.text ? ` · ${P.text}` : ''}</p>`;
      if (!won) { api.failed({ score, html: info }); return; }
      const par = Math.round(total / T.pac * 1.7);
      const stars = livesLost === 0 && elapsed <= par ? 3 : livesLost <= 1 ? 2 : 1;
      api.solved({ title: P.type === 'arcade' ? Kit.fmtNum(score) : Kit.fmtTime(elapsed), stars, score: P.type === 'arcade' ? score : undefined, html: info });
    }

    function tick(dt) {
      clock += dt;
      if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
      pops = pops.filter(p => (p.t -= dt) > 0);
      if (state !== 'play') { stateT -= dt; if (stateT <= 0) afterState(); return; }
      elapsed += dt;
      if (fright > 0) { fright -= dt; if (fright <= 0) { fright = 0; for (const g of ghosts) g.scared = false; } }
      else { phaseT += dt; if (phaseT >= PHASES[phase]) { phaseT = 0; phase++; for (const g of ghosts) if (g.st === 'out') g.dir = OPP[g.dir]; } }
      if (bonus) { bonus.t -= dt; if (bonus.t <= 0) bonus = null; }
      // malé kroky, aby se nikdo neprotáhl skrz
      const n = Math.ceil(dt / 0.02);
      for (let i = 0; i < n && state === 'play'; i++) {
        const h = dt / n;
        if (want && want === OPP[pac.dir]) { pac.dir = want; }
        E.advance(maze, pac, T.pac * h, pacTurn);
        eat(); if (state !== 'play') break;
        collide(); if (state !== 'play') break;
        for (const g of ghosts) moveGhost(g, h);
        collide();
      }
    }

    // ── Vykreslení ──
    el.innerHTML = `<div class="ml-wrap">
      <div class="ml-hud"><div><small>${L('SKÓRE', 'SCORE')}</small><b class="ml-score">0</b></div><div class="ml-lives"></div><div><small class="ml-goal-l">${L('TEČKY', 'DOTS')}</small><b class="ml-goal">0</b></div></div>
      <div class="ml-stage"><canvas class="ml-board"></canvas><div class="ml-over" hidden></div></div>
      <div class="ml-pad"><button data-d="u" aria-label="${L('Nahoru', 'Up')}">▲</button><button data-d="l" aria-label="${L('Doleva', 'Left')}">◀</button><button data-d="d" aria-label="${L('Dolů', 'Down')}">▼</button><button data-d="r" aria-label="${L('Doprava', 'Right')}">▶</button></div>
      <button class="ml-pause k-tool" data-b="pause">${api.icon('pause')}<span>${L('Pauza', 'Pause')}</span></button></div>`;
    const cv = el.querySelector('.ml-board'), ctx = cv.getContext('2d'), ov = el.querySelector('.ml-over');
    const scoreEl = el.querySelector('.ml-score'), livesEl = el.querySelector('.ml-lives'), goalEl = el.querySelector('.ml-goal');
    const wallCv = document.createElement('canvas');
    let cs = 24, dpr = 1;
    function fit() {
      const phone = innerWidth < 760, vw = (document.getElementById('kView') || el).clientWidth - (phone ? 24 : 8);
      const hAvail = innerHeight - (phone ? 330 : 190);
      cs = Math.max(12, Math.floor(Math.min(vw / W, hAvail / H, 34)));
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = W * cs * dpr; cv.height = H * cs * dpr; cv.style.width = W * cs + 'px'; cv.style.height = H * cs + 'px';
      el.querySelector('.ml-wrap').classList.toggle('phone', phone);
      drawWalls();
    }
    // zdi se kreslí jednou do skryté vrstvy: neonový obrys podél chodeb
    function drawWalls() {
      if (!maze) return;
      wallCv.width = cv.width; wallCv.height = cv.height;
      const c = wallCv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--a').trim() || '#5d7bff';
      const wall = (x, y) => x < 0 || x >= W || y < 0 || y >= H ? true : maze.g[y][x] === 1;
      c.fillStyle = 'rgba(30,24,80,.55)';
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (maze.g[y][x] === 1) c.fillRect(x * cs, y * cs, cs, cs);
      c.strokeStyle = accent; c.lineWidth = Math.max(1.5, cs * 0.12); c.lineCap = 'round'; c.shadowColor = accent; c.shadowBlur = cs * 0.5;
      c.beginPath();
      const ins = cs * 0.18;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (maze.g[y][x] !== 1) continue;
        const X = x * cs, Y = y * cs;
        if (!wall(x, y - 1)) { c.moveTo(X + (wall(x - 1, y) && !wall(x - 1, y - 1) ? 0 : ins), Y + ins); c.lineTo(X + cs - (wall(x + 1, y) && !wall(x + 1, y - 1) ? 0 : ins), Y + ins); }
        if (!wall(x, y + 1)) { c.moveTo(X + (wall(x - 1, y) && !wall(x - 1, y + 1) ? 0 : ins), Y + cs - ins); c.lineTo(X + cs - (wall(x + 1, y) && !wall(x + 1, y + 1) ? 0 : ins), Y + cs - ins); }
        if (!wall(x - 1, y)) { c.moveTo(X + ins, Y + (wall(x, y - 1) && !wall(x - 1, y - 1) ? 0 : ins)); c.lineTo(X + ins, Y + cs - (wall(x, y + 1) && !wall(x - 1, y + 1) ? 0 : ins)); }
        if (!wall(x + 1, y)) { c.moveTo(X + cs - ins, Y + (wall(x, y - 1) && !wall(x + 1, y - 1) ? 0 : ins)); c.lineTo(X + cs - ins, Y + cs - (wall(x, y + 1) && !wall(x + 1, y + 1) ? 0 : ins)); }
      }
      c.stroke();
      c.shadowBlur = 0; c.strokeStyle = '#ff9de6'; c.lineWidth = Math.max(2, cs * 0.14);
      c.beginPath(); c.moveTo(E.DOOR.x * cs + 2, E.DOOR.y * cs + cs / 2); c.lineTo(E.DOOR.x * cs + cs - 2, E.DOOR.y * cs + cs / 2); c.stroke();
    }
    function drawPac(x, y, r, open, angle) {
      ctx.fillStyle = '#ffe066'; ctx.shadowColor = '#ffe066'; ctx.shadowBlur = cs * 0.6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, angle + open, angle + Math.PI * 2 - open); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
    }
    function drawGhost(g) {
      const x = g.x * cs + cs / 2, y = g.y * cs + cs / 2, r = cs * 0.46;
      if (g.st !== 'eyes') {
        const blink = g.scared && fright < 2 && Math.floor(clock * 6) % 2;
        const col = g.scared ? (blink ? '#f2f1ff' : '#3a4bff') : g.color;
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = cs * 0.5;
        ctx.beginPath(); ctx.arc(x, y - r * 0.1, r, Math.PI, 0);
        const base = y + r * 0.85, wave = Math.sin(clock * 12 + g.i) * r * 0.12;
        ctx.lineTo(x + r, base);
        for (let k = 0; k < 3; k++) { const x1 = x + r - (k + 0.5) * (2 * r / 3), x2 = x + r - (k + 1) * (2 * r / 3); ctx.quadraticCurveTo(x1, base - r * 0.3 + wave, x2, base); }
        ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
        if (g.scared) {
          ctx.fillStyle = blink ? '#ff5a7a' : '#ffe0f0';
          ctx.fillRect(x - r * 0.4, y - r * 0.3, r * 0.22, r * 0.22); ctx.fillRect(x + r * 0.18, y - r * 0.3, r * 0.22, r * 0.22);
          ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, cs * 0.06); ctx.beginPath();
          for (let k = 0; k <= 4; k++) ctx.lineTo(x - r * 0.5 + k * r * 0.25, y + r * 0.3 + (k % 2 ? -1 : 1) * r * 0.1);
          ctx.stroke(); return;
        }
      }
      const [dx, dy] = DIRS[g.dir] || [0, 0];
      for (const s of [-1, 1]) {
        const ex = x + s * r * 0.36, ey = y - r * 0.2;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.26, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1b1a52'; ctx.beginPath(); ctx.arc(ex + dx * r * 0.12, ey + dy * r * 0.14, r * 0.14, 0, Math.PI * 2); ctx.fill();
      }
    }
    function draw() {
      const w = W * cs, h = H * cs;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(6,4,20,.88)'; ctx.fillRect(0, 0, w, h);
      if (state === 'clear' && Math.floor(stateT * 5) % 2) ctx.globalAlpha = 0.35;
      ctx.drawImage(wallCv, 0, 0, w, h); ctx.globalAlpha = 1;
      // tečky
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = dots[y * W + x]; if (!v) continue;
        const cx = x * cs + cs / 2, cy = y * cs + cs / 2;
        if (v === 2) { const r = cs * (0.26 + 0.06 * Math.sin(clock * 6)); ctx.fillStyle = '#ffd9a8'; ctx.shadowColor = '#ffb86b'; ctx.shadowBlur = cs * 0.6; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
        else { ctx.fillStyle = '#ffd9a8'; ctx.fillRect(cx - cs * 0.07, cy - cs * 0.07, cs * 0.14, cs * 0.14); }
      }
      if (bonus) {
        // bonus: kometa s ohonem
        const cx = E.START.x * cs + cs / 2, cy = E.START.y * cs + cs / 2, r = cs * 0.3;
        const gr = ctx.createLinearGradient(cx - cs, cy - cs * 0.6, cx, cy); gr.addColorStop(0, 'rgba(85,246,255,0)'); gr.addColorStop(1, 'rgba(85,246,255,.8)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(cx - cs * 1.1, cy - cs * 0.7); ctx.lineTo(cx + r * 0.3, cy - r); ctx.lineTo(cx - r * 0.3, cy + r); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8fdff'; ctx.shadowColor = '#55f6ff'; ctx.shadowBlur = cs * 0.8; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
      if (state !== 'dying' || stateT > 1.25) for (const g of ghosts) drawGhost(g);
      const px = pac.x * cs + cs / 2, py = pac.y * cs + cs / 2, angle = { r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2 }[pac.dir];
      if (state === 'dying') { const k = Math.min(1, (1.4 - stateT) / 1.1); if (k < 1) drawPac(px, py, cs * 0.46, 0.2 + k * (Math.PI - 0.2), -Math.PI / 2); }
      else drawPac(px, py, cs * 0.46, pac.moving ? 0.08 + 0.55 * Math.abs(Math.sin(clock * 14)) : 0.4, angle);
      ctx.font = `700 ${Math.max(10, cs * 0.5)}px Unbounded, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of pops) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = '#55f6ff'; ctx.fillText(p.text, p.x * cs + cs / 2, p.y * cs + cs / 2 - (1.2 - p.t) * cs * 0.6); }
      ctx.globalAlpha = 1;
      const banner = state === 'ready' ? L('PŘIPRAV SE!', 'READY!') : msg ? msg.text : null;
      if (banner) { ctx.fillStyle = '#ffe066'; ctx.shadowColor = '#ffb86b'; ctx.shadowBlur = 12; ctx.fillText(banner, w / 2, (E.HOUSE.y1 + 2) * cs + cs / 2); ctx.shadowBlur = 0; }
      scoreEl.textContent = Kit.fmtNum(score);
      goalEl.textContent = P.type === 'arcade' ? `${mazeNo + 1} / ${ARCADE_MAZES}` : `${eaten} / ${total}`;
      const lifeHtml = `<i></i>`.repeat(Math.max(0, lives - (state === 'play' || state === 'ready' ? 1 : 0)));
      if (livesEl.innerHTML !== lifeHtml) livesEl.innerHTML = lifeHtml;
    }
    el.querySelector('.ml-goal-l').textContent = P.type === 'arcade' ? L('BLUDIŠTĚ', 'MAZE') : L('TEČKY', 'DOTS');

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
      if (over) return; paused = on; api.setTimer(!on); ov.hidden = !on;
      if (on) ov.innerHTML = `<div><b>${L('Pauza', 'Paused')}</b><button class="k-btn primary" data-b="resume">${L('Pokračovat', 'Resume')}</button></div>`;
      else last = performance.now();
    }

    // ── Ovládání: šipky / WASD, tah po desce, tlačítka ──
    const keys = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', W: 'u', s: 'd', S: 'd', a: 'l', A: 'l', d: 'r', D: 'r' };
    function steer(d) { if (paused || over) return; want = d; }
    el.querySelectorAll('[data-d]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); steer(b.dataset.d); }));
    el.querySelector('[data-b="pause"]').addEventListener('click', () => setPause(!paused));
    ov.addEventListener('click', e => { if (e.target.closest('[data-b="resume"]')) setPause(false); });
    let sw = null;
    const stage = el.querySelector('.ml-stage');
    stage.addEventListener('pointerdown', e => { sw = { x: e.clientX, y: e.clientY }; });
    stage.addEventListener('pointermove', e => {
      if (!sw) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u'));
      sw = { x: e.clientX, y: e.clientY };
    });
    const swipeEnd = () => (sw = null);
    addEventListener('pointerup', swipeEnd);

    // obnovení rozehrané hry
    if (saved && saved.dots) {
      score = saved.score; lives = saved.lives; lv = saved.lv; livesLost = saved.livesLost; elapsed = saved.elapsed; extra = !!saved.extra;
      loadMaze(saved.mazeNo || 0, saved.dots);
      resetActors(); paused = true; setTimeout(() => setPause(true), 0);
    } else { loadMaze(0); resetActors(); }
    fit(); addEventListener('resize', fit);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => (over ? null : { mazeNo, dots: Array.from(dots).join(''), score, lives, lv, livesLost, elapsed, extra }),
      progress: () => (P.type === 'arcade' ? (mazeNo + eaten / Math.max(1, total)) / ARCADE_MAZES : eaten / Math.max(1, total)),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('pointerup', swipeEnd); },
      pause() { setPause(true); },
      onKey(e) {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); setPause(!paused); return; }
        const d = keys[e.key]; if (!d) return; e.preventDefault(); steer(d);
      },
      _solve() { for (let k = 0; k < dots.length; k++) if (dots[k]) { dots[k] = 0; eaten++; } elapsed = Math.max(elapsed, 1); score = Math.max(score, total * 10); mazeNo = P.type === 'arcade' ? ARCADE_MAZES - 1 : mazeNo; end(true); },
      _state: () => ({ state, pac: { ...pac }, score, eaten, total, lives, ghosts: ghosts.map(g => ({ st: g.st, x: g.x, y: g.y, scared: !!g.scared })) }),
    };
  }

  function art(el) {
    const dots = [0, 1, 2, 3].map(i => `<rect x="${118 + i * 24}" y="127" width="7" height="7" rx="1.5" fill="#ffd9a8"/>`).join('');
    el.innerHTML = `<svg viewBox="0 0 260 260"><defs><filter id="mlGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      ${dots}<path d="M70 131 L104.5 109.3 A41 41 0 1 0 104.5 152.7 Z" fill="#ffe066" filter="url(#mlGlow)"/>
      <path d="M186 158 V120 A26 26 0 0 1 238 120 V158 Q233 148 229 158 Q220 148 212 158 Q203 148 195 158 Q190 148 186 158 Z" fill="#ff5a7a" filter="url(#mlGlow)"/>
      <ellipse cx="203" cy="120" rx="7" ry="9" fill="#fff"/><ellipse cx="223" cy="120" rx="7" ry="9" fill="#fff"/>
      <circle cx="200" cy="122" r="3.6" fill="#1b1a52"/><circle cx="220" cy="122" r="3.6" fill="#1b1a52"/></svg>`;
  }
  return { DIFFS, generate, create, art, levelSpec, tuning };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'mlsoun', title: 'MLSOUN',
  tagline: Kit.L('Spořádej všechny tečky v bludišti a nenech se chytit přízraky. Velká tečka je vyleká a pak je můžeš sníst.', 'Eat every dot in the maze and don\'t get caught by the ghosts. A big dot scares them and then you can eat them.'),
  diffs: Mlsoun.DIFFS, generate: Mlsoun.generate, create: Mlsoun.create, art: Mlsoun.art,
  online: { kind: 'race', diffs: ['maze', 'calm'] },
  dailyDiff: () => 'maze',
  levelDiff: () => 'maze',
  rules: Kit.L(`<p>Sněz všechny tečky v bludišti a vyhni se přízrakům.</p>
    <ul><li><b>Ovládání:</b> šipky nebo WASD, na telefonu táhni prstem po bludišti nebo použij tlačítka. Směr si hra pamatuje a zatočí v nejbližší odbočce. P pauza.</li>
    <li><b>Velká tečka</b> přízraky na pár sekund vyleká: zmodrají a můžeš je sníst (200, 400, 800, 1600 bodů). Když začnou blikat, za chvíli se vzpamatují.</li>
    <li>Každý přízrak honí jinak: červený jde přímo po tobě, růžový ti nadbíhá, modrý číhá z druhé strany a oranžový se zblízka lekne a uteče do rohu.</li>
    <li>Tunelem po stranách projdeš na druhou stranu bludiště, přízraky v něm zpomalí.</li>
    <li>Dvakrát za bludiště se uprostřed objeví kometa za bonusové body. Za 10 000 bodů dostaneš život navíc.</li>
    <li>Tři hvězdy za bludiště bez ztráty života v limitu.</li></ul>`,
    `<p>Eat every dot in the maze and avoid the ghosts.</p>
    <ul><li><b>Controls:</b> arrows or WASD; on a phone swipe on the maze or use the buttons. The game remembers your direction and turns at the next opening. P pauses.</li>
    <li>A <b>big dot</b> scares the ghosts for a few seconds: they turn blue and you can eat them (200, 400, 800, 1600 points). When they blink, they are about to recover.</li>
    <li>Each ghost hunts differently: red chases you directly, pink cuts you off, cyan ambushes from the other side and orange gets scared up close and runs to its corner.</li>
    <li>The tunnels on the sides take you across the maze; ghosts slow down inside.</li>
    <li>Twice per maze a comet appears in the middle for bonus points. 10,000 points give an extra life.</li>
    <li>Three stars for a maze without losing a life within the limit.</li></ul>`),
  achievements: [],
});
