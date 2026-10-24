'use strict';
// ── BUBLINY · Windowling Hlavolamy ──────────────────────────────────────────
// Klasický Bubble Shooter: dole kanón, nahoře plástev barevných bublin. Vystřelená bublina se
// odráží od stěn a přilepí se; skupina aspoň tří stejných praskne a co zůstane viset bez spojení
// se stropem, spadne. Když se nedaří, strop klesá (nebo přibývají řady) a bubliny nesmí dojít dolů.
// Plocha i pořadí bublin jsou ze semínka (denní plocha je pro všechny stejná).
const Bubliny = (() => {
  const L = Kit.L;
  const COLS = 11, R = 20, D = R * 2, ROWH = Math.round(R * 1.732), W = COLS * D, H = 640, CANNON_Y = H - 46, LOSE_Y = CANNON_Y - 52;
  const PALETTE = ['#ff5a7a', '#ffc04d', '#3ddc97', '#5d9bff', '#c06bff', '#55f6ff'];
  const DIFFS = [
    { id: 'clear', name: L('Vyčisti plochu', 'Clear the board'), note: L('5 barev, strop klesá', '5 colours, the ceiling drops'), par: 150 },
    { id: 'easy', name: L('Pohodová', 'Relaxed'), note: L('4 barvy, víc trpělivosti', '4 colours, more patience'), par: 120 },
    { id: 'endless', name: L('Nekonečno', 'Endless'), note: L('řady přibývají, hraj na skóre', 'rows keep coming, play for score'), metric: 'score' },
  ];
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  function levelSpec(n) {
    const ch = Math.floor((n - 1) / 20), k = (n - 1) % 20;
    return { colors: Math.min(6, 3 + Math.floor((n + 4) / 18)), rows: Math.min(10, 4 + ch + Math.floor(k / 7)), misses: Math.max(4, 8 - ch), text: L(`Plocha ${n}`, `Board ${n}`) };
  }
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') return Object.assign({ seed, mode: 'level', type: 'clear' }, levelSpec(ctx.key));
    if (ctx.kind === 'daily') return { seed, mode: 'daily', type: 'clear', colors: 5, rows: 8, misses: 6, text: L('Denní plocha', 'Daily board') };
    if (diffId === 'easy') return { seed, mode: 'free', type: 'clear', colors: 4, rows: 6, misses: 8 };
    if (diffId === 'endless') return { seed, mode: 'free', type: 'endless', colors: 5, rows: 6, misses: 5 };
    return { seed, mode: 'free', type: 'clear', colors: 5, rows: 8, misses: 6 };
  }
  // Plástev: shluky stejných barev (jako v originále), ne čistý šum
  function board(seed, rows, colors) {
    const r = rngOf(seed), g = [];
    for (let y = 0; y < rows; y++) {
      const row = [], n = y % 2 ? COLS - 1 : COLS;
      for (let x = 0; x < n; x++) {
        const up = y ? g[y - 1][Math.min(x, g[y - 1].length - 1)] : null, left = x ? row[x - 1] : null;
        const roll = r();
        row.push(roll < 0.32 && left != null ? left : roll < 0.55 && up != null ? up : Math.floor(r() * colors));
      }
      g.push(row);
    }
    return g;
  }

  function create(el, P, saved, api) {
    const rnd = rngOf(P.seed ^ 0xb0b);
    // mřížka: grid[r][c] = barva nebo null; shift = parita řad (při posunu dolů se mění)
    let grid = board(P.seed, P.rows, P.colors), shift = 0, top = 0, shots = 0, misses = 0, score = 0, popped = 0, combo = 0;
    const total0 = grid.flat().length;
    let ammo = [pickColor(), pickColor()], flying = null, falling = [], parts = [], pops = [], over = false, paused = false, aim = 90, clock = 0, dropFlash = 0;
    const cols = r => ((r + shift) % 2 ? COLS - 1 : COLS);
    const cx = (r, c) => R + c * D + ((r + shift) % 2 ? R : 0);
    const cy = r => top + R + r * ROWH;
    const get = (r, c) => (grid[r] && c >= 0 && c < cols(r) ? grid[r][c] : null);
    function ensureRow(r) { while (grid.length <= r) grid.push(new Array(cols(grid.length)).fill(null)); }
    function neighbors(r, c) {
      const odd = (r + shift) % 2;
      const n = [[r, c - 1], [r, c + 1]];
      for (const dr of [-1, 1]) { if (odd) n.push([r + dr, c], [r + dr, c + 1]); else n.push([r + dr, c - 1], [r + dr, c]); }
      return n.filter(([y, x]) => y >= 0 && x >= 0 && x < cols(y));
    }
    function present() { const s = new Set(); for (const row of grid) for (const v of row) if (v != null) s.add(v); return [...s]; }
    function pickColor() {
      // jen barvy, které jsou ještě na ploše (na začátku libovolná z palety hry)
      const have = grid ? present() : [];
      const pool = have.length ? have : [...Array(P.colors).keys()];
      return pool[Math.floor(rnd() * pool.length)];
    }

    // ── Výstřel a přichycení ──
    function shoot() {
      if (flying || over || paused) return;
      const a = aim * Math.PI / 180, sp = 900;
      flying = { x: W / 2, y: CANNON_Y, vx: Math.cos(a) * sp, vy: -Math.sin(a) * sp, c: ammo[0] };
      ammo = [ammo[1], pickColor()]; shots++; api.sound('tap');
    }
    function swap() { if (flying || over) return; ammo = [ammo[1], ammo[0]]; api.sound('soft'); }
    function stepFlying(dt) {
      const f = flying, steps = 6;
      for (let i = 0; i < steps; i++) {
        f.x += f.vx * dt / steps; f.y += f.vy * dt / steps;
        if (f.x < R) { f.x = R; f.vx = -f.vx; api.sound('soft'); }
        if (f.x > W - R) { f.x = W - R; f.vx = -f.vx; api.sound('soft'); }
        if (f.y <= top + R) { attach(f); return; }
        for (let r = 0; r < grid.length; r++) for (let c = 0; c < cols(r); c++) {
          if (get(r, c) == null) continue;
          const dx = cx(r, c) - f.x, dy = cy(r) - f.y;
          if (dx * dx + dy * dy < (D * 0.86) ** 2) { attach(f); return; }
        }
      }
    }
    function attach(f) {
      // nejbližší volné místo, které drží na stropě nebo na sousedovi
      const rr = Math.max(0, Math.round((f.y - top - R) / ROWH));
      let best = null;
      for (let r = Math.max(0, rr - 1); r <= rr + 1; r++) {
        ensureRow(r);
        for (let c = 0; c < cols(r); c++) {
          if (get(r, c) != null) continue;
          const held = r === 0 || neighbors(r, c).some(([y, x]) => get(y, x) != null);
          if (!held) continue;
          const d = (cx(r, c) - f.x) ** 2 + (cy(r) - f.y) ** 2;
          if (!best || d < best.d) best = { r, c, d };
        }
      }
      flying = null;
      if (!best) return;
      grid[best.r][best.c] = f.c; api.sound('place');
      resolve(best.r, best.c);
    }
    function resolve(r, c) {
      const color = grid[r][c], group = [[r, c]], seen = new Set([`${r},${c}`]);
      for (let i = 0; i < group.length; i++) for (const [y, x] of neighbors(...group[i])) { const k = `${y},${x}`; if (!seen.has(k) && get(y, x) === color) { seen.add(k); group.push([y, x]); } }
      if (group.length >= 3) {
        for (const [y, x] of group) { burst(cx(y, x), cy(y), PALETTE[grid[y][x]]); grid[y][x] = null; }
        // co nevisí na stropě, spadne
        const hold = new Set(), q = [];
        for (let x = 0; x < cols(0); x++) if (get(0, x) != null) { hold.add(`0,${x}`); q.push([0, x]); }
        for (let i = 0; i < q.length; i++) for (const [y, x] of neighbors(...q[i])) { const k = `${y},${x}`; if (!hold.has(k) && get(y, x) != null) { hold.add(k); q.push([y, x]); } }
        let dropped = 0;
        for (let y = 0; y < grid.length; y++) for (let x = 0; x < cols(y); x++) if (grid[y][x] != null && !hold.has(`${y},${x}`)) { falling.push({ x: cx(y, x), y: cy(y), vx: (Math.random() - 0.5) * 80, vy: -60 - Math.random() * 60, c: grid[y][x] }); grid[y][x] = null; dropped++; }
        combo++;
        const pts = group.length * 10 + dropped * 20 * Math.max(1, dropped >> 1);
        score += pts * Math.min(4, combo); popped += group.length + dropped;
        pops.push({ x: cx(r, c), y: cy(r), t: 1, text: `+${pts * Math.min(4, combo)}` });
        api.sound(dropped ? 'line' : 'soft'); api.changed();
        misses = Math.max(0, misses - 1);
      } else { combo = 0; misses++; }
      trim();
      if (!present().length) { score += 1000; end(true); return; }
      if (misses >= P.misses) { misses = 0; descend(); }
      if (lowest() > LOSE_Y) end(false);
      // nabité barvy, které už na ploše nejsou, se vymění
      const have = present(); ammo = ammo.map(a => (have.includes(a) ? a : pickColor()));
    }
    function trim() { while (grid.length && grid[grid.length - 1].every(v => v == null)) grid.pop(); }
    function lowest() { let m = 0; grid.forEach((row, r) => { if (row.some(v => v != null)) m = Math.max(m, cy(r) + R); }); return m; }
    // strop klesne o řadu (Nekonečno: nahoře přibude nová řada)
    function descend() {
      dropFlash = 0.5; api.sound('error');
      if (P.type === 'endless') {
        shift = (shift + 1) % 2;
        const row = []; for (let x = 0; x < cols(0); x++) row.push(Math.floor(rnd() * P.colors));
        grid.unshift(row);
        // přepočet: nová první řada má jinou paritu, zbytek drží svoje pozice
      } else top += ROWH;
    }
    function burst(x, y, col) { for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28, v = 60 + Math.random() * 160; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.5, col }); } }
    function end(won) {
      if (over) return; over = true; api.setTimer(false);
      const info = `<p class="k-muted">${L(`Výstřely ${shots} · skóre ${Kit.fmtNum(score)}`, `Shots ${shots} · score ${Kit.fmtNum(score)}`)}${P.text ? ` · ${P.text}` : ''}</p>`;
      setTimeout(() => {
        if (!won) { api.failed({ score, html: info }); return; }
        const par = Math.ceil(total0 / 2.4);
        api.solved({ title: P.type === 'endless' ? Kit.fmtNum(score) : L('Vyčištěno!', 'Cleared!'), stars: shots <= par ? 3 : shots <= par * 1.4 ? 2 : 1, score: P.type === 'endless' ? score : undefined, html: info });
      }, 600);
    }

    // ── Vykreslení ──
    el.innerHTML = `<div class="bb-wrap"><div class="bb-hud"><div><small>${L('SKÓRE', 'SCORE')}</small><b class="bb-score">0</b></div><div><small>${L('ZBÝVÁ', 'LEFT')}</small><b class="bb-left">0</b></div><div class="bb-press"><small>${L('STROP', 'CEILING')}</small><i></i></div></div>
      <div class="bb-stage"><canvas class="bb-board"></canvas><div class="bb-over" hidden></div></div>
      <div class="k-tools"><button class="k-tool" data-b="swap">${api.icon('undo')}<span>${L('Prohodit', 'Swap')}</span></button><button class="k-tool" data-b="pause">${api.icon('pause')}<span>${L('Pauza', 'Pause')}</span></button></div></div>`;
    const cv = el.querySelector('.bb-board'), ctx = cv.getContext('2d'), ov = el.querySelector('.bb-over');
    let sc = 1, dpr = 1;
    const sprites = new Map();
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      sc = Math.max(0.5, Math.min((box - 2) / W, (innerHeight - (box < 740 ? 230 : 190)) / H, 1.4));
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(W * sc * dpr); cv.height = Math.round(H * sc * dpr); cv.style.width = Math.round(W * sc) + 'px'; cv.style.height = Math.round(H * sc) + 'px';
      sprites.clear();
    }
    // lesklá bublina předkreslená do malé vrstvy
    function bubble(c) {
      if (sprites.has(c)) return sprites.get(c);
      const s = Math.ceil(D * sc * dpr) + 2, k = document.createElement('canvas'); k.width = k.height = s;
      const g = k.getContext('2d'), r = s / 2 - 1, col = PALETTE[c];
      const grad = g.createRadialGradient(s * 0.38, s * 0.34, r * 0.1, s / 2, s / 2, r);
      const dark = '#' + [1, 3, 5].map(i => Math.round(parseInt(col.slice(i, i + 2), 16) * 0.55).toString(16).padStart(2, '0')).join('');
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.18, col); grad.addColorStop(1, dark);
      g.fillStyle = grad; g.beginPath(); g.arc(s / 2, s / 2, r, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = Math.max(1, r * 0.06); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(s * 0.38, s * 0.3, r * 0.32, r * 0.18, -0.5, 0, 7); g.fill();
      sprites.set(c, k); return k;
    }
    const put = (c, x, y, k = 1) => { const b = bubble(c), z = D * k; ctx.drawImage(b, x - z / 2, y - z / 2, z, z); };
    function draw() {
      ctx.setTransform(sc * dpr, 0, 0, sc * dpr, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#120c36'); bg.addColorStop(1, '#06041a');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // strop (klesá)
      if (top > 0) { ctx.fillStyle = dropFlash > 0 ? '#5a3a8a' : '#2a1d5a'; ctx.fillRect(0, 0, W, top); ctx.fillStyle = '#7a5ac8'; ctx.fillRect(0, top - 4, W, 4); }
      // hranice prohry
      ctx.strokeStyle = 'rgba(255,90,122,.35)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, LOSE_Y); ctx.lineTo(W, LOSE_Y); ctx.stroke(); ctx.setLineDash([]);
      for (let r = 0; r < grid.length; r++) for (let c = 0; c < cols(r); c++) { const v = get(r, c); if (v != null) put(v, cx(r, c), cy(r)); }
      // míření: tečkovaná dráha s odrazem
      if (!over && !flying) {
        let x = W / 2, y = CANNON_Y, a = aim * Math.PI / 180, vx = Math.cos(a), vy = -Math.sin(a);
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        for (let i = 0; i < 46; i++) {
          x += vx * 12; y += vy * 12;
          if (x < R) { x = 2 * R - x; vx = -vx; } if (x > W - R) { x = 2 * (W - R) - x; vx = -vx; }
          if (y < top + R) break;
          let hit = false;
          for (let r = 0; r < grid.length && !hit; r++) for (let c = 0; c < cols(r); c++) if (get(r, c) != null && (cx(r, c) - x) ** 2 + (cy(r) - y) ** 2 < D * D * 0.74) { hit = true; break; }
          if (hit) break;
          ctx.globalAlpha = 1 - i / 50; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // kanón
      ctx.save(); ctx.translate(W / 2, CANNON_Y); ctx.rotate(-aim * Math.PI / 180 + Math.PI / 2);
      ctx.fillStyle = '#3a3070'; ctx.strokeStyle = '#8a7ae0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-9, -46, 18, 40, 6); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#241c50'; ctx.beginPath(); ctx.arc(W / 2, CANNON_Y, 28, 0, 7); ctx.fill(); ctx.strokeStyle = '#8a7ae0'; ctx.stroke();
      if (!flying) put(ammo[0], W / 2, CANNON_Y);
      put(ammo[1], W / 2 + 74, CANNON_Y + 10, 0.75);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '600 11px Space Grotesk, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(L('další', 'next'), W / 2 + 74, CANNON_Y + 38);
      if (flying) put(flying.c, flying.x, flying.y);
      for (const f of falling) put(f.c, f.x, f.y);
      for (const p of parts) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.font = '800 18px Unbounded, sans-serif';
      for (const p of pops) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = '#ffe066'; ctx.fillText(p.text, p.x, p.y - (1 - p.t) * 30); }
      ctx.globalAlpha = 1;
      el.querySelector('.bb-score').textContent = Kit.fmtNum(score);
      el.querySelector('.bb-left').textContent = grid.flat().filter(v => v != null).length;
      el.querySelector('.bb-press i').innerHTML = Array.from({ length: P.misses }, (_, i) => `<u class="${i < misses ? 'on' : ''}"></u>`).join('');
    }

    // ── Smyčka ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.04, (now - last) / 1000); last = now; clock += dt;
      if (api.paused() && !paused) setPause(true);
      if (!paused) {
        if (flying) stepFlying(dt);
        falling = falling.filter(f => { f.vy += 900 * dt; f.x += f.vx * dt; f.y += f.vy * dt; return f.y < H + 40; });
        parts = parts.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; return (p.t -= dt) > 0; });
        pops = pops.filter(p => (p.t -= dt) > 0);
        dropFlash = Math.max(0, dropFlash - dt);
      }
      draw();
    }
    function setPause(on) {
      if (over) return; paused = on; api.setTimer(!on); ov.hidden = !on;
      if (on) ov.innerHTML = `<div><b>${L('Pauza', 'Paused')}</b><button class="k-btn primary" data-b="resume">${L('Pokračovat', 'Resume')}</button></div>`;
      else last = performance.now();
    }

    // ── Ovládání: míř myší nebo prstem (puštění vystřelí), šipky + mezerník, X prohodí ──
    const aimAt = e => {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / sc, y = (e.clientY - r.top) / sc;
      const a = Math.atan2(CANNON_Y - y, x - W / 2) * 180 / Math.PI;
      aim = Math.max(8, Math.min(172, a < -90 ? 172 : a < 0 ? 8 : a));
    };
    let down = false;
    cv.addEventListener('pointerdown', e => { if (paused) return; down = true; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ukazatel už neplatí */ } aimAt(e); });
    cv.addEventListener('pointermove', e => { if (down || e.pointerType === 'mouse') aimAt(e); });
    cv.addEventListener('pointerup', e => {
      if (!down) return; down = false;
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / sc, y = (e.clientY - r.top) / sc;
      if (Math.hypot(x - (W / 2 + 74), y - (CANNON_Y + 10)) < 26) { swap(); return; }
      aimAt(e); shoot();
    });
    el.querySelector('[data-b="swap"]').addEventListener('click', swap);
    el.querySelector('[data-b="pause"]').addEventListener('click', () => setPause(!paused));
    ov.addEventListener('click', e => { if (e.target.closest('[data-b="resume"]')) setPause(false); });

    if (saved && saved.grid) {
      grid = saved.grid; shift = saved.shift || 0; top = saved.top || 0; shots = saved.shots; score = saved.score; popped = saved.popped || 0; misses = saved.misses || 0; ammo = saved.ammo;
      for (let i = 0; i < (saved.draws || 0); i++) rnd();
    }
    fit(); addEventListener('resize', fit);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => (over ? null : { grid, shift, top, shots, score, popped, misses, ammo }),
      progress: () => Math.min(1, popped / total0),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); },
      pause() { setPause(true); },
      onKey(e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); aim = Math.min(172, aim + (e.shiftKey ? 6 : 2)); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); aim = Math.max(8, aim - (e.shiftKey ? 6 : 2)); }
        else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) shoot(); }
        else if (e.key === 'x' || e.key === 'X' || e.key === 'c' || e.key === 'C') swap();
        else if (e.key === 'p' || e.key === 'P') setPause(!paused);
      },
      _solve() { grid = []; score += 1000; end(true); },
      _state: () => ({ shots, score, left: grid.flat().filter(v => v != null).length, flying: !!flying, ammo: ammo.slice(), top, rows: grid.length, aim }),
      _aim(a) { aim = a; },
      _shoot() { shoot(); },
      // test: aim straight at a cell
      _cell(r, c) { return [cx(r, c), cy(r), get(r, c)]; },
      _setAmmo(c) { ammo[0] = c; },
    };
  }

  function art(el) {
    const s = 22, cols = ['#ff5a7a', '#ffc04d', '#3ddc97', '#5d9bff', '#c06bff'];
    let h = '<svg viewBox="0 0 260 260"><defs>';
    cols.forEach((c, i) => (h += `<radialGradient id="bbG${i}" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".2" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".75"/></radialGradient>`));
    h += '</defs>';
    const pat = ['01122334', '1122334', '00113322', '4411002'];
    pat.forEach((row, r) => [...row].forEach((ch, c) => (h += `<circle cx="${42 + c * s * 2 + (r % 2 ? s : 0)}" cy="${40 + r * 38}" r="${s - 1}" fill="url(#bbG${ch})"/>`)));
    h += `<path d="M130 228 L156 160" stroke="#fff" stroke-width="3" stroke-dasharray="4 6" opacity=".6"/><circle cx="130" cy="228" r="${s}" fill="url(#bbG2)"/></svg>`;
    el.innerHTML = h;
  }
  return { DIFFS, generate, create, art, board, levelSpec, W, H };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'bubliny', title: 'BUBLINY',
  tagline: Kit.L('Klasický Bubble Shooter: střílej bubliny, spoj tři stejné a nech prasknout celé shluky. Co nevisí, spadne.', 'The classic Bubble Shooter: shoot bubbles, match three and pop whole clusters. Whatever hangs free falls down.'),
  diffs: Bubliny.DIFFS, generate: Bubliny.generate, create: Bubliny.create, art: Bubliny.art,
  online: { kind: 'race', diffs: ['clear', 'easy'] },
  dailyDiff: () => 'clear',
  levelDiff: () => 'clear',
  rules: Kit.L(`<p>Vystřel bublinu do plástve nahoře. Když se dotknou aspoň tři stejné barvy, prasknou; bubliny, které pak nevisí na stropě, spadnou (za ně je víc bodů).</p>
    <ul><li><b>Míření:</b> myší nebo prstem (puštění vystřelí), nebo šipky a mezerník. Bublina se odráží od stěn, tečky ukazují dráhu.</li>
    <li><b>Prohodit</b> (X nebo klepnutí na další bublinu) vymění bublinu v kanónu za další v pořadí.</li>
    <li>Když se nic nepovede několikrát za sebou (ukazatel Strop), strop klesne o řadu. V Nekonečnu místo toho přibude řada nahoře.</li>
    <li>Prohraješ, když bubliny dojdou až k přerušované čáře. Tři hvězdy za vyčištění plochy s málo výstřely.</li></ul>`,
    `<p>Shoot a bubble into the cluster at the top. When three or more of one colour touch, they pop; bubbles left hanging free fall down (worth more points).</p>
    <ul><li><b>Aiming:</b> with the mouse or a finger (releasing fires), or the arrows and Space. Bubbles bounce off the walls; dots show the path.</li>
    <li><b>Swap</b> (X or tap the next bubble) exchanges the bubble in the cannon with the next one.</li>
    <li>After several shots in a row that pop nothing (the Ceiling meter), the ceiling drops a row. In Endless a new row appears at the top instead.</li>
    <li>You lose when bubbles reach the dashed line. Three stars for clearing the board with few shots.</li></ul>`),
  achievements: [],
});
