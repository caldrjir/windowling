'use strict';
// ── HAD · Windowling Hlavolamy ──────────────────────────────────────────────
// Klasický had: sbírej plody, roste a zrychluje, nesmí narazit do zdi ani do sebe.
// Režimy: Sprint 25 (mapa s překážkami ze semínka, na čas), Klasika a Bez stěn (nekonečně na skóre).
// Denní sprint má pro všechny stejnou mapu i pořadí plodů. Cesta: 120 map.
const Had = (() => {
  const L = Kit.L, E = HadEngine, { W, H, DIRS, OPP } = E;
  const DIFFS = [
    { id: 'sprint', name: L('Sprint 25', 'Sprint 25'), note: L('25 plodů na mapě s překážkami', '25 fruits on a map with obstacles'), par: 70 },
    { id: 'classic', name: L('Klasika', 'Classic'), note: L('nekonečně, zdi kolem dokola', 'endless, walls all around'), metric: 'score' },
    { id: 'wrap', name: L('Bez stěn', 'No walls'), note: L('okraji projdeš na druhou stranu', 'go through the edges'), metric: 'score' },
  ];
  function levelSpec(n) {
    const ch = Math.floor((n - 1) / 20), k = (n - 1) % 20;
    const goal = 10 + ch * 3 + Math.floor(k / 4), obstacles = Math.min(10, 1 + ch + Math.floor(k / 7));
    const speed = 6 + ch * 0.8 + k * 0.05;
    return { goal, obstacles, speed, par: Math.round(goal * 2.6 + 6), text: L(`Sněz ${goal} plodů`, `Eat ${goal} fruits`) };
  }
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') return Object.assign({ seed, mode: 'level', n: ctx.key, type: 'goal', border: true }, levelSpec(ctx.key));
    if (ctx.kind === 'daily') return { seed, mode: 'daily', type: 'goal', border: true, goal: 25, obstacles: 6, speed: 7, par: 70, text: L('Denní sprint: 25 plodů', 'Daily sprint: 25 fruits') };
    if (diffId === 'classic') return { seed, mode: 'free', type: 'endless', border: true, obstacles: 0, speed: 6 };
    if (diffId === 'wrap') return { seed, mode: 'free', type: 'endless', border: false, obstacles: 0, speed: 6 };
    return { seed, mode: 'free', type: 'goal', border: true, goal: 25, obstacles: 6, speed: 7, par: 70 };
  }

  function create(el, P, saved, api) {
    const walls = P.obstacles || P.border ? E.generate(P.seed, P.obstacles || 0, P.border) : new Uint8Array(W * H);
    const fr = E.rng(P.seed ^ 0xf00d);
    let draws = 0;
    const roll = () => { draws++; return fr(); };
    let body, dir, queue = [], grow = 0, food = null, bonus = null, eaten = 0, score = 0, elapsed = 0, started = false;
    let over = false, paused = false, dead = 0, acc = 0, lastTail = null, clock = 0, pops = [];
    const speed = () => Math.min(16, P.speed + eaten * 0.2);
    const key = (x, y) => y * W + x;
    const wrap = (x, y) => [(x + W) % W, (y + H) % H];

    function reset() {
      const s = E.START;
      body = []; for (let i = 0; i < s.len; i++) body.push([s.x - i, s.y]);
      dir = s.dir; placeFood();
    }
    function occupied(x, y) { return walls[key(x, y)] || body.some(([bx, by]) => bx === x && by === y); }
    // plody padají ze semínka: pořadí kandidátů je pro všechny stejné
    function placeFood() {
      for (let t = 0; t < 400; t++) { const x = Math.floor(roll() * W), y = Math.floor(roll() * H); if (!occupied(x, y) && !(bonus && bonus.x === x && bonus.y === y)) { food = { x, y }; return; } }
      for (let i = 0; i < W * H; i++) { const x = i % W, y = (i - x) / W; if (!occupied(x, y)) { food = { x, y }; return; } }
      food = null;
    }
    function maybeBonus() {
      if (bonus || eaten % 5 !== 0) return;
      for (let t = 0; t < 200; t++) { const x = Math.floor(roll() * W), y = Math.floor(roll() * H); if (!occupied(x, y) && !(food && food.x === x && food.y === y)) { bonus = { x, y, t: 6 }; return; } }
    }

    function step() {
      if (queue.length) { const d = queue.shift(); if (d !== OPP[dir]) dir = d; }
      const [dx, dy] = DIRS[dir];
      let [x, y] = [body[0][0] + dx, body[0][1] + dy];
      if (!P.border) [x, y] = wrap(x, y);
      // ocas se v tomto kroku uvolní (pokud had neroste), takže do něj smí
      const tailFree = grow === 0;
      const hitSelf = body.some(([bx, by], i) => bx === x && by === y && !(tailFree && i === body.length - 1));
      if (x < 0 || y < 0 || x >= W || y >= H || walls[key(x, y)] || hitSelf) { crash(); return; }
      body.unshift([x, y]);
      if (grow > 0) { grow--; lastTail = null; } else lastTail = body.pop();
      if (food && food.x === x && food.y === y) {
        eaten++; grow += 1; const pts = 10 + Math.floor(speed()); score += pts;
        pops.push({ x, y, t: 0.9, text: `+${pts}` }); api.sound('place'); api.burst && burstAt(x, y);
        placeFood(); maybeBonus(); api.changed();
        if (P.type === 'goal' && eaten >= P.goal) { end(true); return; }
      }
      if (bonus && bonus.x === x && bonus.y === y) { const pts = 50 + eaten * 2; score += pts; grow += 2; pops.push({ x, y, t: 1.1, text: `+${pts}` }); bonus = null; api.sound('star'); }
    }
    function burstAt(x, y) { const r = cv.getBoundingClientRect(); api.burst(r.left + (x + 0.5) * cs, r.top + (y + 0.5) * cs, 8); }
    function crash() { dead = 1; api.sound('error'); setTimeout(() => end(false), 650); }
    function end(won) {
      if (over) return; over = true; api.setTimer(false);
      const info = `<p class="k-muted">${L(`Plody ${eaten} · délka ${body.length} · skóre ${Kit.fmtNum(score)}`, `Fruits ${eaten} · length ${body.length} · score ${Kit.fmtNum(score)}`)}${P.text ? ` · ${P.text}` : ''}</p>`;
      if (!won) { api.failed({ score, html: info }); return; }
      const par = P.par || 70;
      const stars = elapsed <= par ? 3 : elapsed <= par * 1.4 ? 2 : 1;
      api.solved({ title: P.type === 'endless' ? Kit.fmtNum(score) : Kit.fmtTime(elapsed), stars, score: P.type === 'endless' ? score : undefined, html: info });
    }

    // ── Vykreslení ──
    el.innerHTML = `<div class="hd-wrap">
      <div class="hd-hud"><div><small>${L('SKÓRE', 'SCORE')}</small><b class="hd-score">0</b></div><div><small>${P.type === 'goal' ? L('PLODY', 'FRUITS') : L('DÉLKA', 'LENGTH')}</small><b class="hd-goal">0</b></div><div><small>${L('RYCHLOST', 'SPEED')}</small><b class="hd-speed">0</b></div></div>
      <div class="hd-stage"><canvas class="hd-board"></canvas><div class="hd-hint"></div><div class="hd-over" hidden></div></div>
      <div class="hd-pad"><button data-d="u" aria-label="${L('Nahoru', 'Up')}">▲</button><button data-d="l" aria-label="${L('Doleva', 'Left')}">◀</button><button data-d="d" aria-label="${L('Dolů', 'Down')}">▼</button><button data-d="r" aria-label="${L('Doprava', 'Right')}">▶</button></div>
      <button class="hd-pause k-tool" data-b="pause">${api.icon('pause')}<span>${L('Pauza', 'Pause')}</span></button></div>`;
    const cv = el.querySelector('.hd-board'), ctx = cv.getContext('2d'), ov = el.querySelector('.hd-over'), hint = el.querySelector('.hd-hint');
    const scoreEl = el.querySelector('.hd-score'), goalEl = el.querySelector('.hd-goal'), speedEl = el.querySelector('.hd-speed');
    let cs = 24, dpr = 1;
    function fit() {
      const phone = innerWidth < 760, vw = (document.getElementById('kView') || el).clientWidth - (phone ? 24 : 8);
      const hAvail = innerHeight - (phone ? 330 : 190);
      cs = Math.max(12, Math.floor(Math.min(vw / W, hAvail / H, 34)));
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = W * cs * dpr; cv.height = H * cs * dpr; cv.style.width = W * cs + 'px'; cv.style.height = H * cs + 'px';
      el.querySelector('.hd-wrap').classList.toggle('phone', phone);
    }
    hint.textContent = innerWidth < 760 ? L('Přejeď prstem nebo klepni na šipku', 'Swipe or tap an arrow') : L('Stiskni šipku a jeď', 'Press an arrow to start');
    const lerp = (a, b, t) => a + (b - a) * t;
    function seg(p, q, t) { return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) > 1 ? q : [lerp(p[0], q[0], t), lerp(p[1], q[1], t)]; }
    function draw() {
      const w = W * cs, h = H * cs, accent = getComputedStyle(document.documentElement).getPropertyValue('--a').trim() || '#6dff9e';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(6,4,20,.88)'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.035)';
      for (let y = 0; y < H; y++) for (let x = (y % 2); x < W; x += 2) ctx.fillRect(x * cs, y * cs, cs, cs);
      // zdi
      ctx.fillStyle = 'rgba(40,32,100,.9)'; ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1, cs * 0.08); ctx.shadowColor = accent; ctx.shadowBlur = cs * 0.4;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (walls[key(x, y)]) { ctx.beginPath(); ctx.roundRect(x * cs + 1.5, y * cs + 1.5, cs - 3, cs - 3, cs * 0.2); ctx.fill(); ctx.stroke(); }
      ctx.shadowBlur = 0;
      // plod a bonus
      if (food) {
        const cx = (food.x + 0.5) * cs, cy = (food.y + 0.5) * cs, r = cs * (0.32 + 0.03 * Math.sin(clock * 5));
        ctx.fillStyle = '#ff5a7a'; ctx.shadowColor = '#ff5a7a'; ctx.shadowBlur = cs * 0.7;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.28, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#6dff9e'; ctx.lineWidth = Math.max(1.5, cs * 0.08); ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.quadraticCurveTo(cx + r * 0.4, cy - r * 1.5, cx + r * 0.8, cy - r * 1.3); ctx.stroke();
      }
      if (bonus) {
        const cx = (bonus.x + 0.5) * cs, cy = (bonus.y + 0.5) * cs, R = cs * 0.42, blink = bonus.t < 2 && Math.floor(clock * 8) % 2;
        if (!blink) {
          ctx.fillStyle = '#ffe066'; ctx.shadowColor = '#ffe066'; ctx.shadowBlur = cs * 0.8; ctx.beginPath();
          for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; ctx.lineTo(cx + Math.cos(a + clock) * rr, cy + Math.sin(a + clock) * rr); }
          ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
        }
      }
      // had: hlava a ocas se plynule posouvají mezi poli
      const t = started && !dead && !paused && !over ? Math.min(1, acc * speed()) : 1;
      const pts = body.map(p => [p[0], p[1]]);
      if (pts.length > 1) pts[0] = seg(body[1], body[0], t);
      if (lastTail && pts.length) pts.push(seg(body[body.length - 1], lastTail, 1 - t));
      const n = pts.length;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = n - 1; i > 0; i--) {
        const a = pts[i], b = pts[i - 1];
        if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) > 1.01) continue;
        const k = i / Math.max(1, n - 1);
        ctx.strokeStyle = dead ? '#ff5a7a' : `hsl(${150 - k * 40}, 100%, ${68 - k * 18}%)`;
        ctx.lineWidth = cs * (0.74 - k * 0.22);
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = i < 3 ? cs * 0.6 : 0;
        ctx.beginPath(); ctx.moveTo((a[0] + 0.5) * cs, (a[1] + 0.5) * cs); ctx.lineTo((b[0] + 0.5) * cs, (b[1] + 0.5) * cs); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      const hx = (pts[0][0] + 0.5) * cs, hy = (pts[0][1] + 0.5) * cs, [dx, dy] = DIRS[dir];
      ctx.fillStyle = dead ? '#ff5a7a' : '#a8ffd0'; ctx.beginPath(); ctx.arc(hx, hy, cs * 0.42, 0, Math.PI * 2); ctx.fill();
      for (const s of [-1, 1]) {
        const ex = hx + dx * cs * 0.12 + -dy * s * cs * 0.2, ey = hy + dy * cs * 0.12 + dx * s * cs * 0.2;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, cs * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#10102e'; ctx.beginPath(); ctx.arc(ex + dx * cs * 0.04, ey + dy * cs * 0.04, cs * 0.06, 0, Math.PI * 2); ctx.fill();
      }
      ctx.font = `700 ${Math.max(10, cs * 0.5)}px Unbounded, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of pops) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = '#ffe066'; ctx.fillText(p.text, (p.x + 0.5) * cs, (p.y + 0.5) * cs - (1 - p.t) * cs); }
      ctx.globalAlpha = 1;
      scoreEl.textContent = Kit.fmtNum(score);
      goalEl.textContent = P.type === 'goal' ? `${eaten} / ${P.goal}` : body.length;
      speedEl.textContent = speed().toFixed(1);
      hint.hidden = started || over;
    }

    // ── Smyčka ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      clock += dt;
      if (api.paused() && !paused && started) setPause(true);
      if (!paused && !over && !dead) {
        pops = pops.filter(p => (p.t -= dt) > 0);
        if (bonus) { bonus.t -= dt; if (bonus.t <= 0) bonus = null; }
        if (started) {
          elapsed += dt; acc += dt;
          const per = 1 / speed();
          while (acc >= per && !dead && !over) { acc -= per; step(); }
        }
      }
      draw();
    }
    function setPause(on) {
      if (over || dead) return; paused = on; api.setTimer(!on && started); ov.hidden = !on;
      if (on) ov.innerHTML = `<div><b>${L('Pauza', 'Paused')}</b><button class="k-btn primary" data-b="resume">${L('Pokračovat', 'Resume')}</button></div>`;
      else last = performance.now();
    }

    // ── Ovládání ──
    const keys = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', W: 'u', s: 'd', S: 'd', a: 'l', A: 'l', d: 'r', D: 'r' };
    function steer(d) {
      if (paused || over || dead) return;
      if (!started) { if (d === OPP[dir]) return; started = true; api.setTimer(true); last = performance.now(); acc = 0; }
      const prev = queue.length ? queue[queue.length - 1] : dir;
      if (d === prev || d === OPP[prev] || queue.length >= 2) return;
      queue.push(d);
    }
    el.querySelectorAll('[data-d]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); steer(b.dataset.d); }));
    el.querySelector('[data-b="pause"]').addEventListener('click', () => { if (started) setPause(!paused); });
    ov.addEventListener('click', e => { if (e.target.closest('[data-b="resume"]')) setPause(false); });
    let sw = null;
    const stage = el.querySelector('.hd-stage');
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

    // obnovení rozehrané hry: had stojí, dokud hráč nezatočí
    if (saved && saved.body) {
      body = saved.body; dir = saved.dir; eaten = saved.eaten; score = saved.score; elapsed = saved.elapsed; grow = saved.grow || 0;
      for (let i = 0; i < saved.draws; i++) roll();
      food = saved.food; bonus = null;
    } else reset();
    api.setTimer(false);
    fit(); addEventListener('resize', fit);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => (over || dead ? null : { body, dir, eaten, score, elapsed, grow, food, draws }),
      progress: () => (P.type === 'goal' ? eaten / P.goal : 0),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('pointerup', swipeEnd); },
      pause() { if (started) setPause(true); },
      onKey(e) {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); if (started) setPause(!paused); return; }
        const d = keys[e.key]; if (!d) return; e.preventDefault(); steer(d);
      },
      _solve() { eaten = P.goal || 25; score = Math.max(score, eaten * 15); elapsed = Math.max(elapsed, 1); end(true); },
      _state: () => ({ started, dead, over, eaten, score, len: body.length, head: body[0], dir, food }),
      _food(x, y) { food = { x, y }; },
    };
  }

  function art(el) {
    const cells = [[3, 7], [4, 7], [5, 7], [6, 7], [6, 6], [6, 5], [7, 5], [8, 5], [9, 5], [9, 6]];
    const S = 24;
    const path = cells.map(([x, y], i) => `${i ? 'L' : 'M'}${x * S + 12} ${y * S + 12}`).join(' ');
    el.innerHTML = `<svg viewBox="40 60 240 180"><defs><linearGradient id="hdG" x1="0" x2="1"><stop offset="0" stop-color="#2fbf8a"/><stop offset="1" stop-color="#a8ffd0"/></linearGradient>
      <filter id="hdGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <path d="${path}" fill="none" stroke="url(#hdG)" stroke-width="17" stroke-linecap="round" stroke-linejoin="round" filter="url(#hdGlow)"/>
      <circle cx="${9 * S + 12}" cy="${6 * S + 14}" r="10" fill="#a8ffd0"/><circle cx="${9 * S + 7}" cy="${6 * S + 17}" r="3" fill="#10102e"/><circle cx="${9 * S + 17}" cy="${6 * S + 17}" r="3" fill="#10102e"/>
      <circle cx="${9 * S + 12}" cy="${9 * S + 6}" r="9" fill="#ff5a7a" filter="url(#hdGlow)"/></svg>`;
  }
  return { DIFFS, generate, create, art, levelSpec };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'had', title: 'HAD',
  tagline: Kit.L('Klasický had: sbírej plody, roste a zrychluje. Nenaraz do zdi ani sám do sebe.', 'The classic snake: eat the fruit, grow and speed up. Don\'t hit a wall or yourself.'),
  diffs: Had.DIFFS, generate: Had.generate, create: Had.create, art: Had.art,
  online: { kind: 'race', diffs: ['sprint'] },
  dailyDiff: () => 'sprint',
  levelDiff: () => 'sprint',
  rules: Kit.L(`<p>Veď hada pro plody. Každý plod ho prodlouží a trochu zrychlí.</p>
    <ul><li><b>Ovládání:</b> šipky nebo WASD, na telefonu přejeď prstem po desce nebo použij tlačítka. Had se rozjede po prvním směru. P pauza.</li>
    <li>Hra končí nárazem do zdi, překážky nebo do vlastního těla. Do místa, odkud právě uhýbá ocas, vjet smíš.</li>
    <li>Každý pátý plod se na pár sekund objeví <b>zlatá hvězda</b> za bonusové body.</li>
    <li><b>Sprint 25:</b> sněz 25 plodů na mapě s překážkami co nejrychleji. Denní sprint má pro všechny stejnou mapu i pořadí plodů.</li>
    <li><b>Klasika</b> a <b>Bez stěn</b> jsou nekonečné hry na skóre; bez stěn projdeš okrajem na druhou stranu.</li></ul>`,
    `<p>Guide the snake to the fruit. Every fruit makes it longer and a little faster.</p>
    <ul><li><b>Controls:</b> arrows or WASD; on a phone swipe on the board or use the buttons. The snake starts moving with your first direction. P pauses.</li>
    <li>The game ends when you hit a wall, an obstacle or your own body. Moving into the cell your tail is just leaving is fine.</li>
    <li>Every fifth fruit, a <b>golden star</b> appears for a few seconds for bonus points.</li>
    <li><b>Sprint 25:</b> eat 25 fruits on a map with obstacles as fast as you can. The daily sprint has the same map and fruit order for everyone.</li>
    <li><b>Classic</b> and <b>No walls</b> are endless games for score; with no walls you pass through the edges.</li></ul>`),
  achievements: [],
});
