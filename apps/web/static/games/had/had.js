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
    let over = false, paused = false, dead = 0, acc = 0, lastTail = null, clock = 0, pops = [], gulps = [];
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
        eaten++; grow += 1; gulps.push(0); const pts = 10 + Math.floor(speed()); score += pts;
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
    // ── Kresba: noční zahrada, kamenné zdi s mechem, ovoce a had s pruhy, jazykem a polknutými plody ──
    const deco = (() => { const r = E.rng(P.seed ^ 0x6a7d), out = []; for (let i = 0; i < 70; i++) out.push([r() * W, r() * H, r()]); return out; })();
    let bgCv = null, bgKey = '';
    function background() {
      const k = `${cs}x${dpr}`; if (bgCv && bgKey === k) return bgCv;
      bgKey = k; bgCv = document.createElement('canvas'); bgCv.width = W * cs * dpr; bgCv.height = H * cs * dpr;
      const g = bgCv.getContext('2d'); g.scale(dpr, dpr);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { g.fillStyle = (x + y) % 2 ? '#13301f' : '#16372a'; g.fillRect(x * cs, y * cs, cs, cs); }
      for (const [x, y, v] of deco) {
        if (walls[key(Math.floor(x), Math.floor(y))]) continue;
        const px = x * cs, py = y * cs;
        if (v < 0.6) { g.strokeStyle = 'rgba(120,220,140,.22)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px, py); g.lineTo(px - 2, py - cs * 0.22); g.moveTo(px + 2, py); g.lineTo(px + 3, py - cs * 0.2); g.stroke(); }
        else { g.fillStyle = v < 0.8 ? 'rgba(255,240,150,.35)' : 'rgba(255,150,210,.35)'; g.beginPath(); g.arc(px, py, cs * 0.06, 0, 7); g.fill(); }
      }
      // zdi: kameny s mechem, hrany jen tam, kde sousedí s trávou
      const isW = (x, y) => x < 0 || y < 0 || x >= W || y >= H || walls[key(x, y)];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!walls[key(x, y)]) continue;
        const X = x * cs, Y = y * cs, n = (x * 7 + y * 13) % 5;
        g.fillStyle = ['#59607e', '#535a78', '#5d6584', '#4f5673', '#585f7d'][n]; g.fillRect(X, Y, cs, cs);
        g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.roundRect(X + cs * 0.1, Y + cs * 0.1, cs * 0.5, cs * 0.35, cs * 0.12); g.fill();
        g.strokeStyle = 'rgba(20,20,40,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X, Y + cs * 0.55); g.lineTo(X + cs * 0.6, Y + cs * 0.55); g.lineTo(X + cs * 0.6, Y + cs); g.stroke();
        if (!isW(x, y - 1)) { g.fillStyle = '#3f9a4a'; g.beginPath(); g.moveTo(X, Y); for (let i = 0; i <= 4; i++) g.lineTo(X + (i / 4) * cs, Y + cs * (i % 2 ? 0.22 : 0.12)); g.lineTo(X + cs, Y); g.closePath(); g.fill(); }
        g.lineWidth = Math.max(1.5, cs * 0.06); g.strokeStyle = 'rgba(10,14,30,.6)';
        g.beginPath();
        if (!isW(x, y + 1)) { g.moveTo(X, Y + cs); g.lineTo(X + cs, Y + cs); }
        if (!isW(x - 1, y)) { g.moveTo(X, Y); g.lineTo(X, Y + cs); }
        if (!isW(x + 1, y)) { g.moveTo(X + cs, Y); g.lineTo(X + cs, Y + cs); }
        g.stroke();
        if (!isW(x, y + 1)) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X, Y + cs, cs, cs * 0.18); }
      }
      return bgCv;
    }
    const FRUIT = ['apple', 'cherry', 'orange', 'grapes', 'pear'];
    function fruit(kind, cx, cy, r) {
      ctx.save(); ctx.translate(cx, cy);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, r * 0.95, r * 0.8, r * 0.25, 0, 0, 7); ctx.fill();
      const shine = (x, y, s) => { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.7, -0.6, 0, 7); ctx.fill(); };
      const leaf = (x, y, a) => { ctx.fillStyle = '#4fc85a'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.38, r * 0.17, a, 0, 7); ctx.fill(); };
      const stem = (x0, y0, x1, y1) => { ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + r * 0.2, (y0 + y1) / 2, x1, y1); ctx.stroke(); };
      if (kind === 'apple') { ctx.fillStyle = '#ff4a5a'; ctx.beginPath(); ctx.arc(-r * 0.32, 0, r * 0.68, 0, 7); ctx.arc(r * 0.32, 0, r * 0.68, 0, 7); ctx.fill(); stem(0, -r * 0.5, r * 0.1, -r * 1.05); leaf(r * 0.38, -r * 0.85, -0.5); shine(-r * 0.4, -r * 0.25, r * 0.2); }
      else if (kind === 'cherry') { stem(-r * 0.4, 0, r * 0.15, -r * 1.05); stem(r * 0.45, r * 0.1, r * 0.15, -r * 1.05); leaf(r * 0.45, -r * 0.95, -0.3); ctx.fillStyle = '#e8203a'; for (const [x, y] of [[-r * 0.42, r * 0.15], [r * 0.45, r * 0.25]]) { ctx.beginPath(); ctx.arc(x, y, r * 0.48, 0, 7); ctx.fill(); shine(x - r * 0.15, y - r * 0.15, r * 0.12); } }
      else if (kind === 'orange') { ctx.fillStyle = '#ff9a2a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(200,100,0,.35)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(Math.cos(i) * r * 0.45, Math.sin(i * 2) * r * 0.4, r * 0.06, 0, 7); ctx.fill(); } leaf(r * 0.3, -r * 0.85, -0.4); shine(-r * 0.35, -r * 0.3, r * 0.2); }
      else if (kind === 'grapes') { ctx.fillStyle = '#9a4cff'; for (const [x, y] of [[-0.35, -0.35], [0.35, -0.35], [0, -0.35], [-0.18, 0.05], [0.18, 0.05], [0, 0.45]]) { ctx.beginPath(); ctx.arc(x * r * 1.2, y * r * 1.2, r * 0.32, 0, 7); ctx.fill(); } ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(-r * 0.5, -r * 0.5, r * 0.1, 0, 7); ctx.fill(); stem(0, -r * 0.7, r * 0.1, -r * 1.05); leaf(r * 0.4, -r * 0.9, -0.4); }
      else { ctx.fillStyle = '#c8e04a'; ctx.beginPath(); ctx.arc(0, r * 0.25, r * 0.7, 0, 7); ctx.arc(0, -r * 0.3, r * 0.45, 0, 7); ctx.fill(); stem(0, -r * 0.7, r * 0.15, -r * 1.05); leaf(r * 0.4, -r * 0.9, -0.5); shine(-r * 0.3, r * 0.05, r * 0.18); }
      ctx.restore();
    }
    function draw() {
      const w = W * cs, h = H * cs;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(background(), 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // plod a bonus
      if (food) fruit(FRUIT[eaten % FRUIT.length], (food.x + 0.5) * cs, (food.y + 0.5) * cs + Math.sin(clock * 4) * cs * 0.04, cs * 0.42);
      if (bonus) {
        const cx = (bonus.x + 0.5) * cs, cy = (bonus.y + 0.5) * cs, R = cs * 0.42, blink = bonus.t < 2 && Math.floor(clock * 8) % 2;
        ctx.strokeStyle = 'rgba(255,224,102,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, cs * 0.5, -Math.PI / 2, -Math.PI / 2 + (bonus.t / 6) * Math.PI * 2); ctx.stroke();
        if (!blink) {
          ctx.fillStyle = '#ffe066'; ctx.shadowColor = '#ffe066'; ctx.shadowBlur = cs * 0.8; ctx.beginPath();
          for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; ctx.lineTo(cx + Math.cos(a + clock) * rr, cy + Math.sin(a + clock) * rr); }
          ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
        }
      }
      // had: hlava a ocas se plynule posouvají mezi poli; tělo z kroužků s pruhy, ubývá k ocasu
      const t = started && !dead && !paused && !over ? Math.min(1, acc * speed()) : 1;
      const pts = body.map(p => [p[0], p[1]]);
      if (pts.length > 1) pts[0] = seg(body[1], body[0], t);
      if (lastTail && pts.length) pts.push(seg(body[body.length - 1], lastTail, 1 - t));
      const samples = []; let dist = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[i + 1];
        if (!b || Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) > 1.01) { samples.push([a[0], a[1], dist]); continue; }
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / 0.18));
        for (let j = 0; j < k; j++) samples.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k, dist + L * j / k]);
        dist += L;
      }
      const total = Math.max(1, dist), hue = dead ? 0 : 110, sat = dead ? 10 : 70;
      const rad = d => { let r = cs * (0.4 - 0.2 * Math.pow(d / total, 1.4)); for (const g of gulps) { const q = Math.abs(d - g); if (q < 0.7) r += cs * 0.12 * (1 - q / 0.7); } return r; };
      for (let pass = 0; pass < 3; pass++) for (let i = samples.length - 1; i >= 0; i--) {
        const [x, y, d] = samples[i], r = rad(d), px = (x + 0.5) * cs, py = (y + 0.5) * cs;
        if (pass === 0) { ctx.fillStyle = dead ? '#3a2a30' : '#14401f'; ctx.beginPath(); ctx.arc(px, py, r + Math.max(1.2, cs * 0.05), 0, 7); ctx.fill(); }
        else if (pass === 1) { const band = (d % 1) < 0.5; ctx.fillStyle = `hsl(${hue + (band ? 0 : 25)} ${sat}% ${band ? 40 : 60}%)`; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); }
        else if (i % 3 === 0) { ctx.fillStyle = 'rgba(255,255,220,.22)'; ctx.beginPath(); ctx.arc(px - r * 0.25, py - r * 0.3, r * 0.35, 0, 7); ctx.fill(); }
      }
      // hlava
      const [dx, dy] = DIRS[dir], hx = (pts[0][0] + 0.5) * cs, hy = (pts[0][1] + 0.5) * cs, ang = Math.atan2(dy, dx);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
      if (!dead && (clock % 1.8) < 0.35) { ctx.strokeStyle = '#ff3a5a'; ctx.lineWidth = Math.max(1.5, cs * 0.06); ctx.lineCap = 'round'; const L = cs * (0.45 + 0.15 * Math.sin(clock * 40)); ctx.beginPath(); ctx.moveTo(cs * 0.4, 0); ctx.lineTo(cs * 0.4 + L, 0); ctx.moveTo(cs * 0.4 + L, 0); ctx.lineTo(cs * 0.4 + L + cs * 0.12, -cs * 0.09); ctx.moveTo(cs * 0.4 + L, 0); ctx.lineTo(cs * 0.4 + L + cs * 0.12, cs * 0.09); ctx.stroke(); }
      ctx.fillStyle = dead ? '#3a2a30' : '#14401f'; ctx.beginPath(); ctx.ellipse(cs * 0.05, 0, cs * 0.5, cs * 0.42, 0, 0, 7); ctx.fill();
      ctx.fillStyle = `hsl(${hue + 10} ${sat}% 56%)`; ctx.beginPath(); ctx.ellipse(cs * 0.05, 0, cs * 0.45, cs * 0.37, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,220,.25)'; ctx.beginPath(); ctx.ellipse(-cs * 0.02, -cs * 0.12, cs * 0.22, cs * 0.1, 0, 0, 7); ctx.fill();
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cs * 0.12, s * cs * 0.19, cs * 0.13, 0, 7); ctx.fill();
        if (dead) { ctx.strokeStyle = '#10102e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cs * 0.06, s * cs * 0.19 - 3); ctx.lineTo(cs * 0.18, s * cs * 0.19 + 3); ctx.moveTo(cs * 0.18, s * cs * 0.19 - 3); ctx.lineTo(cs * 0.06, s * cs * 0.19 + 3); ctx.stroke(); }
        else { ctx.fillStyle = '#10102e'; ctx.beginPath(); ctx.arc(cs * 0.17, s * cs * 0.19, cs * 0.065, 0, 7); ctx.fill(); }
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(cs * 0.44, s * cs * 0.07, cs * 0.03, 0, 7); ctx.fill();
      }
      ctx.restore();
      ctx.font = `700 ${Math.max(10, cs * 0.5)}px Unbounded, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of pops) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(p.text, (p.x + 0.5) * cs, (p.y + 0.5) * cs - (1 - p.t) * cs); ctx.fillStyle = '#ffe066'; ctx.fillText(p.text, (p.x + 0.5) * cs, (p.y + 0.5) * cs - (1 - p.t) * cs); }
      ctx.globalAlpha = 1;
      void w; void h;
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
        if (started) gulps = gulps.map(g => g + dt * speed() * 1.4).filter(g => g < body.length + 1);
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

  // úvodní obrázek: had s pruhy na zahradě, před ním jablko
  function art(el) {
    el.innerHTML = '<canvas width="520" height="360" style="object-fit:contain"></canvas>';
    const g = el.querySelector('canvas').getContext('2d'), c = 40;
    g.beginPath(); g.roundRect(0, 0, 520, 360, 28); g.clip();
    for (let y = 0; y < 9; y++) for (let x = 0; x < 13; x++) { g.fillStyle = (x + y) % 2 ? '#13301f' : '#16372a'; g.fillRect(x * c, y * c, c, c); }
    const cells = [[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [5, 5], [5, 4], [5, 3], [6, 3], [7, 3], [8, 3], [8, 4], [8, 5], [9, 5]];
    const pts = []; for (let i = 0; i < cells.length - 1; i++) for (let k = 0; k < 6; k++) pts.push([cells[i][0] + (cells[i + 1][0] - cells[i][0]) * k / 6, cells[i][1] + (cells[i + 1][1] - cells[i][1]) * k / 6]);
    pts.push(cells[cells.length - 1]);
    for (let pass = 0; pass < 2; pass++) pts.forEach(([x, y], i) => { const k = 1 - i / pts.length, r = c * (0.4 - 0.2 * k ** 1.4), band = Math.floor(i / 3) % 2 === 0; g.fillStyle = pass ? `hsl(${band ? 110 : 135} 70% ${band ? 40 : 60}%)` : '#14401f'; g.beginPath(); g.arc((x + 0.5) * c, (y + 0.5) * c, r + (pass ? 0 : 1.5), 0, 7); g.fill(); });
    const hx = 9.5 * c + 4, hy = 5.5 * c;
    g.strokeStyle = '#ff3a5a'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx + 16, hy); g.lineTo(hx + 34, hy); g.lineTo(hx + 39, hy - 4); g.moveTo(hx + 34, hy); g.lineTo(hx + 39, hy + 4); g.stroke();
    g.fillStyle = '#14401f'; g.beginPath(); g.ellipse(hx, hy, 21, 17, 0, 0, 7); g.fill(); g.fillStyle = 'hsl(120 70% 56%)'; g.beginPath(); g.ellipse(hx, hy, 19, 15, 0, 0, 7); g.fill();
    for (const s of [-1, 1]) { g.fillStyle = '#fff'; g.beginPath(); g.arc(hx + 3, hy + s * 8, 5.5, 0, 7); g.fill(); g.fillStyle = '#10102e'; g.beginPath(); g.arc(hx + 5, hy + s * 8, 2.8, 0, 7); g.fill(); }
    const ax = 11.5 * c, ay = 5.5 * c, r = 17;
    g.fillStyle = '#ff4a5a'; g.beginPath(); g.arc(ax - r * 0.32, ay, r * 0.68, 0, 7); g.arc(ax + r * 0.32, ay, r * 0.68, 0, 7); g.fill();
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ax, ay - r * 0.5); g.lineTo(ax + 2, ay - r * 1.05); g.stroke();
    g.fillStyle = '#4fc85a'; g.beginPath(); g.ellipse(ax + r * 0.38, ay - r * 0.85, r * 0.38, r * 0.17, -0.5, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(ax - r * 0.4, ay - r * 0.25, r * 0.2, r * 0.14, -0.6, 0, 7); g.fill();
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
