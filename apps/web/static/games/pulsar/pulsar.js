'use strict';
// ── PULSAR · Windowling Hlavolamy ───────────────────────────────────────────
// Padající bloky: 10×20, rotace SRS s odrazy, 7-bag z náhodného semínka (denní sprint je
// pro všechny stejný), odložení, náhled 5 dílků, stín, T-spin, kombo, back-to-back.
// Režimy: Maraton, Sprint 40, Ultra 2:00, Kopání. Cesta: 120 úkolů.
const Pulsar = (() => {
  const L = Kit.L;
  const W = 10, H = 22, VIS = 20;
  const DIFFS = [
    { id: 'marathon', name: L('Maraton', 'Marathon'), note: L('150 řad, rychlost roste', '150 lines, speeding up'), metric: 'score' },
    { id: 'sprint', name: L('Sprint 40', 'Sprint 40'), note: L('40 řad na čas', '40 lines against the clock'), par: 120 },
    { id: 'ultra', name: L('Ultra 2:00', 'Ultra 2:00'), note: L('nejvíc bodů za 2 minuty', 'most points in 2 minutes'), metric: 'score' },
    { id: 'dig', name: L('Kopání', 'Dig'), note: L('prokopej 10 řad odpadu', 'dig out 10 garbage rows'), par: 150 },
  ];
  // Dílky (SRS) a barvy
  const SHAPES = {
    I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
    S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  };
  const COLORS = { I: '#55f6ff', O: '#ffe066', T: '#c77dff', S: '#6dff9e', Z: '#ff5a7a', J: '#5a8cff', L: '#ffa94d', G: '#5d5878' };
  const KINDS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  function cells(k, rot) {
    const size = k === 'I' ? 4 : k === 'O' ? 4 : 3;
    return SHAPES[k].map(([x, y]) => { let a = x, b = y; for (let r = 0; r < rot; r++) { const t = a; a = size - 1 - b; b = t; } return [a, b]; });
  }
  // Odrazy (SRS): [z rotace][směr] → posuny
  const KICK = [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]];
  const kicksJLSTZ = (from, to) => {
    const t = { '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
      '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]] };
    return t[`${from}>${to}`] || KICK;
  };
  const kicksI = (from, to) => {
    const t = { '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]], '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]], '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]], '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
      '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]], '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]], '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]], '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]] };
    return t[`${from}>${to}`] || KICK;
  };
  // Rychlost pádu (sekundy na řadu) podle úrovně
  const gravity = lv => Math.pow(0.8 - (Math.min(lv, 20) - 1) * 0.007, Math.min(lv, 20) - 1);

  // ── Úkoly Cesty ──
  function levelSpec(n) {
    const ch = Math.floor((n - 1) / 20), k = (n - 1) % 20, type = ['marathon', 'dig', 'ultra', 'sprint'][n % 4];
    if (type === 'marathon') { const lines = 10 + ch * 5 + (k % 5) * 2; return { type, lines, start: 1 + ch * 2 + Math.floor(k / 6), par: lines * 3.2, text: L(`Smaž ${lines} řad od rychlosti ${1 + ch * 2 + Math.floor(k / 6)}`, `Clear ${lines} lines from speed ${1 + ch * 2 + Math.floor(k / 6)}`) }; }
    if (type === 'dig') { const rows = 4 + ch * 2 + Math.floor(k / 7); return { type, garbage: rows, start: 1 + ch, parPieces: rows * 3 + 6, text: L(`Prokopej ${rows} řad odpadu`, `Dig out ${rows} garbage rows`) }; }
    if (type === 'ultra') { const secs = 60 + ch * 10, target = 1500 + ch * 2200 + k * 220; return { type, secs, target, start: 1 + ch, text: L(`${target.toLocaleString('cs-CZ')} bodů za ${secs} s`, `${target.toLocaleString('en-US')} points in ${secs} s`) }; }
    const lines = 20 + ch * 4; return { type: 'sprint', lines, start: 1 + Math.floor(ch / 2), par: lines * 2.6, text: L(`Sprint: ${lines} řad co nejrychleji`, `Sprint: ${lines} lines as fast as you can`) };
  }

  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') return Object.assign({ seed, mode: 'level', n: ctx.key }, levelSpec(ctx.key));
    if (ctx.kind === 'daily') return { seed, mode: 'daily', type: 'sprint', lines: 40, start: 1, par: 120, text: L('Denní sprint: 40 řad', 'Daily sprint: 40 lines') };
    const t = diffId;
    if (t === 'marathon') return { seed, mode: 'free', type: 'marathon', lines: 150, start: 1, endless: true };
    if (t === 'sprint') return { seed, mode: 'free', type: 'sprint', lines: 40, start: 1 };
    if (t === 'ultra') return { seed, mode: 'free', type: 'ultra', secs: 120, start: 1 };
    return { seed, mode: 'free', type: 'dig', garbage: 10, start: 1 };
  }

  function create(el, P, saved, api) {
    const r = Kit.rng(P.seed), rg = Kit.rng(P.seed ^ 0xabcdef);
    // stav
    let board, queue = [], bagCount = 0, piece = null, hold = null, canHold = true, lines = 0, score = 0, level = P.start || 1, pieces = 0;
    let combo = -1, b2b = false, lastRot = false, over = false, paused = false, elapsed = 0, garbageLeft = 0, lockT = 0, lockMoves = 0, fallT = 0, flash = [], msg = null;
    function nextBag() { const b = Kit.shuffle(KINDS.slice(), r); bagCount++; queue.push(...b); }
    function garbageRow(hole) { const row = new Array(W).fill('G'); row[hole] = null; return row; }
    function reset() {
      board = [...Array(H)].map(() => new Array(W).fill(null));
      if (P.type === 'dig') { let hole = Math.floor(rg() * W); for (let i = 0; i < P.garbage; i++) { if (rg() < 0.7) hole = Math.floor(rg() * W); board[H - 1 - i] = garbageRow(hole); } garbageLeft = P.garbage; }
      nextBag(); nextBag(); spawn();
    }
    function spawn() {
      while (queue.length < 7) nextBag();
      const k = queue.shift(); piece = { k, rot: 0, x: k === 'O' ? 3 : 3, y: k === 'I' ? 0 : 0 };
      lockT = 0; lockMoves = 0; lastRot = false; canHold = canHold || false;
      if (collide(piece)) { piece.y = -1; if (collide(piece)) end(false); }
    }
    const collide = (p, dx = 0, dy = 0, rot = p.rot) => cells(p.k, rot).some(([cx, cy]) => { const x = p.x + cx + dx, y = p.y + cy + dy; return x < 0 || x >= W || y >= H || (y >= 0 && board[y][x]); });
    function move(dx) { if (!piece || over || paused) return false; if (collide(piece, dx, 0)) return false; piece.x += dx; lastRot = false; touchLock(); api.sound('soft'); return true; }
    function rotate(dir) {
      if (!piece || over || paused || piece.k === 'O') return;
      const to = (piece.rot + dir + 4) % 4, kicks = (piece.k === 'I' ? kicksI : kicksJLSTZ)(piece.rot, to);
      for (const [kx, ky] of kicks) if (!collide(piece, kx, -ky, to)) { piece.x += kx; piece.y -= ky; piece.rot = to; lastRot = true; touchLock(); api.sound('tap'); return; }
    }
    function touchLock() { if (collide(piece, 0, 1) && lockMoves < 15) { lockT = 0; lockMoves++; } }
    function softDrop() { if (!piece || over || paused) return; if (!collide(piece, 0, 1)) { piece.y++; score += 1; fallT = 0; lastRot = false; } }
    function hardDrop() { if (!piece || over || paused) return; let d = 0; while (!collide(piece, 0, 1)) { piece.y++; d++; } score += d * 2; if (d) lastRot = false; lock(); api.sound('place'); }
    function doHold() {
      if (!piece || over || paused || !canHold) return;
      const k = piece.k; if (hold) { queue.unshift(hold); } hold = k; canHold = false; spawn(); canHold = false; api.sound('soft');
    }
    function tSpin() {
      if (piece.k !== 'T' || !lastRot) return 0;
      const cx = piece.x + 1, cy = piece.y + 1, filled = (x, y) => x < 0 || x >= W || y >= H || (y >= 0 && board[y][x]);
      const corners = [[cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1], [cx + 1, cy + 1]].map(([x, y]) => filled(x, y));
      if (corners.filter(Boolean).length < 3) return 0;
      const front = [[0, 1], [1, 3], [2, 3], [0, 2]][piece.rot]; // čelní rohy podle natočení
      return corners[front[0]] && corners[front[1]] ? 2 : 1; // 2 = plný, 1 = mini
    }
    function lock() {
      const ts = tSpin();
      for (const [cx, cy] of cells(piece.k, piece.rot)) { const y = piece.y + cy; if (y >= 0) board[y][piece.x + cx] = piece.k; }
      if (cells(piece.k, piece.rot).every(([, cy]) => piece.y + cy < H - VIS)) { end(false); return; }
      pieces++;
      const full = []; for (let y = 0; y < H; y++) if (board[y].every(Boolean)) full.push(y);
      const n = full.length;
      if (n) {
        const garb = full.filter(y => board[y].includes('G')).length;
        flash = full.map(y => ({ y, t: 0.18 }));
        for (const y of full) { board.splice(y, 1); board.unshift(new Array(W).fill(null)); }
        lines += n; garbageLeft -= garb; combo++;
        const base = ts === 2 ? [400, 800, 1200, 1600][n] : ts === 1 ? [100, 200, 400][n] || 400 : [0, 100, 300, 500, 800][n];
        const hard = n === 4 || ts > 0;
        let pts = base * level; if (hard && b2b) pts = Math.round(pts * 1.5);
        pts += combo > 0 ? 50 * combo * level : 0;
        const pc = board.every(row => row.every(c => !c)); if (pc) pts += 2000 * level;
        score += pts; b2b = hard;
        const name = ts === 2 ? `T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][n]}` : ts === 1 ? 'T-SPIN MINI' : n === 4 ? 'PULSAR!' : null;
        msg = { t: 1.4, text: [name, combo > 0 ? `${combo} COMBO` : null, pc ? L('ČISTÝ STŮL', 'PERFECT CLEAR') : null, b2b && hard && name ? 'B2B' : null].filter(Boolean).join(' · ') };
        api.sound(n >= 4 || ts ? 'win' : 'line');
        if (P.type === 'marathon' || P.endless) { const nl = Math.floor(lines / 10) + (P.start || 1); if (nl > level) { level = nl; msg = { t: 1.6, text: L(`RYCHLOST ${level}`, `SPEED ${level}`) }; } }
      } else { combo = -1; if (ts) { score += (ts === 2 ? 400 : 100) * level; msg = { t: 1, text: ts === 2 ? 'T-SPIN' : 'T-SPIN MINI' }; } }
      canHold = true;
      api.changed();
      if (goalReached()) { end(true); return; }
      spawn();
    }
    function goalReached() {
      if (P.type === 'dig') return garbageLeft <= 0;
      if (P.type === 'sprint' || P.type === 'marathon') return lines >= P.lines;
      return false;
    }
    function end(won) {
      if (over) return; over = true; api.setTimer(false);
      if (P.type === 'ultra') won = P.target ? score >= P.target : true;
      const t = elapsed;
      if (!won) { api.failed({ score, html: `<p class="k-muted">${L(`Řady: ${lines}`, `Lines: ${lines}`)}${P.text ? ` · ${P.text}` : ''}</p>` }); return; }
      let stars;
      if (P.mode === 'level') {
        if (P.type === 'ultra') stars = score >= P.target * 1.5 ? 3 : score >= P.target * 1.2 ? 2 : 1;
        else if (P.type === 'dig') stars = pieces <= P.parPieces ? 3 : pieces <= P.parPieces * 1.4 ? 2 : 1;
        else stars = t <= P.par ? 3 : t <= P.par * 1.5 ? 2 : 1;
      }
      const sprint = P.type === 'sprint' || P.type === 'dig';
      api.solved({ title: P.type === 'sprint' ? Kit.fmtTime(t) : L('Hotovo!', 'Done!'), stars, score: sprint ? undefined : score, html: `<p class="k-muted">${L(`Řady ${lines} · dílky ${pieces}`, `Lines ${lines} · pieces ${pieces}`)}${P.text ? ` · ${P.text}` : ''}</p>` });
    }

    // ── Vykreslení ──
    el.innerHTML = `<div class="pl-wrap"><div class="pl-side pl-left"><div class="pl-box"><small>${L('ODLOŽENO', 'HOLD')}</small><canvas class="pl-hold" width="120" height="80"></canvas></div>
      <div class="pl-stats"></div></div>
      <canvas class="pl-board"></canvas>
      <div class="pl-side pl-right"><div class="pl-box"><small>${L('DALŠÍ', 'NEXT')}</small><canvas class="pl-next" width="120" height="330"></canvas></div><div class="pl-goal">${P.text || ''}</div></div>
      <div class="pl-touch">
        <button data-b="hold">${L('Odložit', 'Hold')}</button><button data-b="left">◀</button><button data-b="ccw">⟲</button><button data-b="cw">⟳</button><button data-b="right">▶</button><button data-b="soft">▼</button><button data-b="hard">⤓</button>
      </div>
      <button class="pl-pause k-tool" data-b="pause">${api.icon('pause')}<span>${L('Pauza', 'Pause')}</span></button>
      <div class="pl-over" hidden></div></div>`;
    const cv = el.querySelector('.pl-board'), ctx = cv.getContext('2d'), hcv = el.querySelector('.pl-hold'), ncv = el.querySelector('.pl-next'), statsEl = el.querySelector('.pl-stats'), ov = el.querySelector('.pl-over');
    let cs = 28;
    function fit() {
      const phone = innerWidth < 760, vw = (document.getElementById('kView') || el).clientWidth - 28;
      const hAvail = innerHeight - (phone ? 250 : 120), wAvail = phone ? vw - 96 : Math.min(vw - 300, 520);
      cs = Math.max(14, Math.floor(Math.min(hAvail / VIS, wAvail / W)));
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = W * cs * dpr; cv.height = VIS * cs * dpr; cv.style.width = W * cs + 'px'; cv.style.height = VIS * cs + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      el.querySelector('.pl-wrap').classList.toggle('phone', phone);
    }
    function block(c, x, y, s, col, alpha = 1) {
      c.globalAlpha = alpha; c.fillStyle = col; c.fillRect(x + 1, y + 1, s - 2, s - 2);
      c.globalAlpha = alpha * 0.35; c.fillStyle = '#fff'; c.fillRect(x + 1, y + 1, s - 2, Math.max(2, s * 0.18));
      c.globalAlpha = 1;
    }
    function mini(c, k, w, h, oy = 0) { if (!k) return; const s = Math.min(22, w / 5), sh = cells(k, 0), xs = sh.map(p => p[0]), ys = sh.map(p => p[1]); const ox = (w - (Math.max(...xs) - Math.min(...xs) + 1) * s) / 2 - Math.min(...xs) * s, oyy = oy + (h - (Math.max(...ys) - Math.min(...ys) + 1) * s) / 2 - Math.min(...ys) * s; for (const [x, y] of sh) block(c, ox + x * s, oyy + y * s, s, COLORS[k], canHold || c !== hctx ? 1 : 0.35); }
    const hctx = hcv.getContext('2d'), nctx = ncv.getContext('2d');
    function draw() {
      const w = W * cs, h = VIS * cs;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(8,6,24,.85)'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
      for (let x = 1; x < W; x++) { ctx.beginPath(); ctx.moveTo(x * cs + 0.5, 0); ctx.lineTo(x * cs + 0.5, h); ctx.stroke(); }
      for (let y = 1; y < VIS; y++) { ctx.beginPath(); ctx.moveTo(0, y * cs + 0.5); ctx.lineTo(w, y * cs + 0.5); ctx.stroke(); }
      for (let y = H - VIS; y < H; y++) for (let x = 0; x < W; x++) if (board[y][x]) block(ctx, x * cs, (y - (H - VIS)) * cs, cs, COLORS[board[y][x]]);
      if (piece && !over) {
        let gy = 0; while (!collide(piece, 0, gy + 1)) gy++;
        for (const [cx, cy] of cells(piece.k, piece.rot)) { const y = piece.y + cy + gy - (H - VIS); if (y >= 0) { ctx.strokeStyle = COLORS[piece.k]; ctx.globalAlpha = 0.45; ctx.strokeRect((piece.x + cx) * cs + 2.5, y * cs + 2.5, cs - 5, cs - 5); ctx.globalAlpha = 1; } }
        for (const [cx, cy] of cells(piece.k, piece.rot)) { const y = piece.y + cy - (H - VIS); if (y >= 0) block(ctx, (piece.x + cx) * cs, y * cs, cs, COLORS[piece.k]); }
      }
      for (const f of flash) { ctx.fillStyle = `rgba(255,255,255,${f.t * 4})`; ctx.fillRect(0, (f.y - (H - VIS)) * cs, w, cs); }
      if (msg) { ctx.globalAlpha = Math.min(1, msg.t); ctx.font = `700 ${Math.max(12, cs * 0.6)}px Unbounded, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = getComputedStyle(document.documentElement).getPropertyValue('--a'); ctx.shadowBlur = 16; ctx.fillText(msg.text, w / 2, h * 0.32); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
      hctx.clearRect(0, 0, 120, 80); mini(hctx, hold, 120, 80);
      nctx.clearRect(0, 0, 120, 330); queue.slice(0, 5).forEach((k, i) => mini(nctx, k, 120, 64, i * 64 + 4));
      const goal = P.type === 'dig' ? `${Math.max(0, garbageLeft)} ${L('zbývá', 'left')}` : P.type === 'ultra' ? `${Math.max(0, Math.ceil((P.secs || 120) - elapsed))} s` : P.lines && !P.endless ? `${lines} / ${P.lines}` : lines;
      statsEl.innerHTML = `<div><small>${L('SKÓRE', 'SCORE')}</small><b>${Kit.fmtNum(score)}</b></div><div><small>${L('ŘADY', 'LINES')}</small><b>${goal}</b></div><div><small>${L('RYCHLOST', 'SPEED')}</small><b>${level}</b></div>${P.target ? `<div><small>${L('CÍL', 'TARGET')}</small><b>${Kit.fmtNum(P.target)}</b></div>` : ''}`;
    }

    // ── Smyčka ──
    let last = performance.now(), raf = 0;
    const held = { left: 0, right: 0, soft: 0 }; let das = 0, arr = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (api.paused() && !paused) setPause(true);
      if (paused || over) { draw(); return; }
      elapsed += dt;
      if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
      flash = flash.filter(f => (f.t -= dt) > 0);
      // DAS / ARR
      const dir = held.right && (!held.left || held.right > held.left) ? 1 : held.left ? -1 : 0;
      if (dir) { das += dt; if (das > 0.14) { arr += dt; while (arr > 0.033) { arr -= 0.033; move(dir); } } } else { das = 0; arr = 0; }
      if (held.soft) { fallT += dt * 20; }
      const g = gravity(level);
      fallT += dt;
      while (fallT >= g && piece) { fallT -= g; if (!collide(piece, 0, 1)) { piece.y++; lastRot = false; if (held.soft) score += 1; } else break; }
      if (piece && collide(piece, 0, 1)) { lockT += dt; if (lockT > 0.5) { lock(); } } else lockT = 0;
      if (P.type === 'ultra' && elapsed >= (P.secs || 120)) end(true);
      draw();
    }
    function setPause(on) {
      if (over) return; paused = on; api.setTimer(!on); held.left = held.right = held.soft = 0;
      ov.hidden = !on;
      if (on) { ov.innerHTML = `<div><b>${L('Pauza', 'Paused')}</b><button class="k-btn primary" data-b="resume">${L('Pokračovat', 'Resume')}</button></div>`; }
    }

    // ── Ovládání ──
    const keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'soft', ArrowUp: 'cw', x: 'cw', X: 'cw', z: 'ccw', Z: 'ccw', Control: 'ccw', ' ': 'hard', c: 'hold', C: 'hold', Shift: 'hold', p: 'pause', P: 'pause' };
    function act(b, down = true) {
      if (b === 'pause') { if (down) setPause(!paused); return; }
      if (b === 'resume') { setPause(false); return; }
      if (paused) return;
      if (b === 'left' || b === 'right') { if (down) { held[b] = performance.now(); das = 0; move(b === 'left' ? -1 : 1); } else held[b] = 0; return; }
      if (b === 'soft') { held.soft = down ? 1 : 0; if (down) softDrop(); return; }
      if (!down) return;
      if (b === 'cw') rotate(1); if (b === 'ccw') rotate(-1); if (b === 'hard') hardDrop(); if (b === 'hold') doHold();
    }
    function onKeyUp(e) { const b = keys[e.key]; if (b) act(b, false); }
    addEventListener('keyup', onKeyUp);
    el.querySelectorAll('[data-b]').forEach(btn => {
      btn.addEventListener('pointerdown', e => { e.preventDefault(); act(btn.dataset.b, true); });
      btn.addEventListener('pointerup', () => act(btn.dataset.b, false)); btn.addEventListener('pointerleave', () => act(btn.dataset.b, false));
    });
    ov.addEventListener('click', e => { if (e.target.closest('[data-b="resume"]')) setPause(false); });
    // Gesta na desce: tah do stran posouvá, klepnutí otáčí, rychlý švih dolů shodí.
    let g0 = null;
    cv.addEventListener('pointerdown', e => { g0 = { x: e.clientX, y: e.clientY, t: performance.now(), mx: 0, my: 0 }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (!g0) return;
      const dx = e.clientX - g0.x - g0.mx * cs, dy = e.clientY - g0.y - g0.my * cs;
      if (Math.abs(dx) >= cs * 0.9) { const s = Math.sign(dx); move(s); g0.mx += s; g0.moved = true; }
      if (dy >= cs * 0.9) { softDrop(); g0.my++; g0.moved = true; }
    });
    cv.addEventListener('pointerup', e => {
      if (!g0) return;
      const dt = performance.now() - g0.t, dy = e.clientY - g0.y, dx = e.clientX - g0.x;
      if (dy > cs * 2 && dy / dt > 0.9 && Math.abs(dx) < dy) hardDrop();
      else if (!g0.moved && dt < 300 && Math.hypot(dx, dy) < 12) { const r = cv.getBoundingClientRect(); rotate(e.clientX < r.left + r.width / 2 ? -1 : 1); }
      g0 = null;
    });

    // obnovení rozehrané hry
    if (saved && saved.board) {
      board = saved.board; hold = saved.hold; lines = saved.lines; score = saved.score; level = saved.level; pieces = saved.pieces; garbageLeft = saved.garbageLeft || 0; elapsed = saved.elapsed || 0; b2b = saved.b2b; combo = saved.combo;
      for (let i = 0; i < saved.bagCount; i++) nextBag(); queue = saved.queue; bagCount = saved.bagCount; spawn();
      paused = true; setTimeout(() => setPause(true), 0);
    } else reset();
    fit(); addEventListener('resize', fit);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => (over ? null : { board, hold, lines, score, level, pieces, garbageLeft, elapsed, b2b, combo, queue: [piece && piece.k, ...queue].filter(Boolean), bagCount }),
      progress: () => (P.type === 'dig' ? 1 - Math.max(0, garbageLeft) / (P.garbage || 1) : P.lines ? lines / P.lines : 0),
      destroy() { cancelAnimationFrame(raf); removeEventListener('keyup', onKeyUp); removeEventListener('resize', fit); },
      pause() { setPause(true); },
      onKey(e) { const b = keys[e.key]; if (!b) return; e.preventDefault(); if (e.repeat && (b === 'left' || b === 'right' || b === 'soft')) return; act(b, true); },
      _solve() { lines = P.lines || 999; garbageLeft = 0; elapsed = Math.max(elapsed, 1); if (P.type === 'ultra') { score = (P.target || 1000) * 2; elapsed = P.secs || 120; } end(true); },
    };
  }

  function art(el) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 260; el.innerHTML = ''; el.appendChild(cv);
    const c = cv.getContext('2d'), s = 26, rows = ['....IIII..', '.T........', 'TTT.....OO', 'ZZ.LJJJ.OO', '.ZZLLLJSS.', 'IIIIGGGG.S'];
    rows.forEach((row, y) => [...row].forEach((k, x) => { if (k !== '.') { c.fillStyle = COLORS[k]; c.shadowColor = COLORS[k]; c.shadowBlur = 10; c.fillRect(x * s + 1, (y + 4) * s + 1, s - 2, s - 2); } }));
  }
  return { DIFFS, generate, create, art, levelSpec, cells, gravity };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'pulsar', title: 'PULSAR',
  tagline: Kit.L('Padající bloky v rytmu pulsaru. Maraton, Sprint, Ultra, Kopání a denní sprint, ve kterém závodíš se všemi.', 'Falling blocks to the beat of a pulsar. Marathon, Sprint, Ultra, Dig and a daily sprint where you race everyone.'),
  diffs: Pulsar.DIFFS, generate: Pulsar.generate, create: Pulsar.create, art: Pulsar.art,
  online: { kind: 'race', diffs: ['sprint', 'dig'] },
  dailyDiff: () => 'sprint',
  levelDiff: n => Pulsar.levelSpec(n).type,
  rules: Kit.L(`<p>Skládej padající dílky tak, aby vytvořily plnou řadu. Plná řada zmizí. Hra končí, když dílky dosáhnou stropu.</p>
    <ul><li><b>Klávesnice:</b> ← → posun, ↓ zrychlit, mezerník shodit, ↑ nebo X otočit doprava, Z otočit doleva, C nebo Shift odložit dílek, P pauza.</li>
    <li><b>Dotyk:</b> táhni po desce do stran, klepni pro otočení (levá polovina doleva, pravá doprava), švihni dolů pro shození. Nebo použij tlačítka.</li>
    <li>Čtyři řady najednou (PULSAR!), T-spiny a série po sobě (kombo) dávají nejvíc bodů.</li>
    <li><b>Denní sprint</b>: stejné pořadí dílků pro všechny, smaž 40 řad co nejrychleji.</li></ul>`,
    `<p>Stack falling pieces to complete rows; full rows vanish. The game ends when the stack reaches the top.</p>
    <ul><li><b>Keyboard:</b> ← → move, ↓ soft drop, Space hard drop, ↑ or X rotate right, Z rotate left, C or Shift hold, P pause.</li>
    <li><b>Touch:</b> drag on the board to move, tap to rotate (left half left, right half right), flick down to drop. Or use the buttons.</li>
    <li>Four lines at once (PULSAR!), T-spins and combos score the most.</li>
    <li><b>Daily sprint</b>: the same piece order for everyone, clear 40 lines as fast as you can.</li></ul>`),
  achievements: [],
});
