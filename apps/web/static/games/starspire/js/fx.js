'use strict';
// ── Šablony souhvězdí: body [x, y, velikost] a hrany [i, j] v jednotkovém prostoru ──
const ART = (() => {
  const mirror = (pts, edges, list) => list; // pomocník pro čitelnost
  function humanoid(o = {}) {
    const p = [[0, -0.85, 1.6], [0, -0.6, 1], [-0.35, -0.52, 1.2], [0.35, -0.52, 1.2], [-0.55, -0.12, 1], [0.55, -0.12, 1], [-0.62, 0.22, 1.1], [0.62, 0.22, 1.1],
      [0, 0.12, 1.3], [-0.2, 0.2, 1], [0.2, 0.2, 1], [-0.26, 0.56, 1], [0.26, 0.56, 1], [-0.3, 0.95, 1.2], [0.3, 0.95, 1.2]];
    const e = [[0, 1], [1, 2], [1, 3], [2, 4], [4, 6], [3, 5], [5, 7], [1, 8], [8, 9], [8, 10], [9, 11], [11, 13], [10, 12], [12, 14], [2, 9], [3, 10]];
    const add = (x, y, s, link) => { p.push([x, y, s]); if (link !== undefined) e.push([link, p.length - 1]); return p.length - 1; };
    if (o.staff) { const a = add(0.7, -1.05, 2.2, 7); add(0.75, 0.95, 0.8, 7); e.push([a, 5]); }
    if (o.crown) { const a = add(-0.18, -1.12, 1.1, 0), b = add(0, -1.22, 1.4, 0), c = add(0.18, -1.12, 1.1, 0); e.push([a, b], [b, c]); }
    if (o.hood) { const a = add(-0.22, -0.95, 0.9, 1), b = add(0, -1.15, 1, a), c = add(0.22, -0.95, 0.9, b); e.push([c, 1]); }
    if (o.bow) { const a = add(-0.85, -0.6, 1, 6), b = add(-0.95, 0.2, 1, a), c = add(-0.8, 0.95, 1, b); e.push([c, 6]); }
    if (o.wings) { for (const s of [-1, 1]) { const a = add(1.15 * s, -0.75, 1.5, s < 0 ? 2 : 3), b = add(1.3 * s, -0.1, 1, a); add(0.95 * s, 0.35, 1, b); } }
    if (o.shield) { const c = add(-0.8, 0.0, 0.8); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(-0.8 + Math.cos(a) * 0.3, Math.sin(a) * 0.36, 0.9, i === 0 ? undefined : p.length - 1); } e.push([p.length - 1, c + 1], [c, 6]); }
    if (o.sword) { const a = add(0.72, -0.4, 0.9, 7), b = add(0.82, -1.15, 1.8, a); add(0.55, -0.3, 0.7, a); add(0.92, -0.48, 0.7, a); }
    if (o.hat) { const a = add(-0.4, -0.9, 0.9, 0), b = add(0.05, -1.4, 1.6, a); add(0.35, -0.9, 0.9, b); }
    if (o.daggers) { add(-0.95, -0.15, 1.3, 6); add(0.95, -0.15, 1.3, 7); }
    if (o.twin) { add(0, -1.1, 2); }
    return { p, e };
  }
  function orb(o = {}) {
    const p = [[0, 0, 2.2]], e = [];
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 - Math.PI / 2; p.push([Math.cos(a) * 0.62, Math.sin(a) * 0.62, 1]); e.push([i + 1, (i + 1) % 7 + 1]); if (i % 2 === 0) e.push([0, i + 1]); }
    if (o.spikes) for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 - Math.PI / 2; p.push([Math.cos(a) * 1.05, Math.sin(a) * 1.05, 1.1]); e.push([i + 1, p.length - 1]); }
    return { p, e };
  }
  function crab() {
    const p = [], e = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; p.push([Math.cos(a) * 0.48, 0.1 + Math.sin(a) * 0.32, 1.1]); e.push([i, (i + 1) % 6]); }
    for (const s of [-1, 1]) {
      const b = p.length;
      p.push([0.75 * s, -0.25, 1], [0.95 * s, -0.65, 1.5], [0.6 * s, -0.75, 1.2]);
      e.push([s < 0 ? 3 : 0, b], [b, b + 1], [b + 1, b + 2], [b + 2, b]);
      for (let k = 0; k < 3; k++) { p.push([(0.75 + k * 0.08) * s, 0.35 + k * 0.2, 0.8]); e.push([s < 0 ? 2 + (k > 1 ? 2 : 0) : 1 - (k > 1 ? 0 : 0), p.length - 1]); }
    }
    return { p, e };
  }
  function bug() {
    const p = [[0.75, -0.05, 1.5]], e = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; p.push([Math.cos(a) * 0.55, Math.sin(a) * 0.35, 1]); e.push([i + 1, (i + 1) % 6 + 1]); }
    e.push([0, 1]);
    for (const [i, x] of [[2, 0.3], [3, -0.3], [5, -0.3], [6, 0.3]]) { p.push([x, Math.sign(p[i][2] ? p[i][1] : 1) * 0.75, 0.7]); e.push([i, p.length - 1]); }
    return { p, e };
  }
  function blob() {
    const p = [], e = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const r = 0.62 + (i % 2 ? 0.08 : 0); p.push([Math.cos(a) * r, Math.min(0.5, Math.sin(a) * r * 0.85), 1]); e.push([i, (i + 1) % 9]); }
    p.push([-0.2, -0.1, 1.6], [0.2, -0.1, 1.6]);
    return { p, e };
  }
  function quad(o = {}) {
    const p = [[0.85, -0.45, 1.5], [0.5, -0.2, 1], [0, -0.28, 1], [-0.6, -0.22, 1.1], [-0.95, -0.55, 0.9], [0.45, 0.15, 1], [-0.45, 0.15, 1], [0.5, 0.75, 1], [0.28, 0.78, 0.9], [-0.42, 0.75, 1], [-0.62, 0.78, 0.9]];
    const e = [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 3], [5, 7], [5, 8], [6, 9], [6, 10]];
    if (o.horns) { p.push([1.05, -0.95, 1.3], [0.62, -0.92, 1.3]); e.push([0, 11], [0, 12]); }
    return { p, e };
  }
  function bird() {
    const p = [[0, 0.05, 1.3], [0.35, -0.42, 1.4], [0.65, -0.38, 0.8], [-0.35, -0.45, 1], [-1.05, -0.85, 1.3], [-0.85, -0.1, 0.9], [0.45, -0.1, 1], [1.05, -0.7, 1.1], [-0.1, 0.65, 1], [0.2, 0.72, 0.9]];
    const e = [[0, 1], [1, 2], [0, 3], [3, 4], [4, 5], [5, 0], [0, 6], [6, 7], [7, 1], [0, 8], [0, 9]];
    return { p, e };
  }
  function serpent() {
    const p = [], e = [];
    for (let i = 0; i < 10; i++) { const t = i / 9; p.push([-0.95 + t * 1.75, Math.sin(t * Math.PI * 2.2) * 0.38 + 0.15, i === 9 ? 1.6 : 1 - t * 0.2 + 0.2]); if (i) e.push([i - 1, i]); }
    p.push([1.0, -0.15, 0.8], [1.05, 0.3, 0.8]); e.push([9, 10], [9, 11]);
    return { p, e };
  }
  function scorpion() {
    const p = [[-0.4, 0.3, 1], [-0.1, 0.32, 1.2], [0.2, 0.3, 1], [0.5, 0.25, 1], [0.8, 0.05, 1.3], [0.95, -0.2, 1], [0.75, -0.3, 1], [-0.65, 0.15, 1], [-0.8, -0.2, 1], [-0.75, -0.55, 1], [-0.45, -0.8, 1.2], [-0.1, -0.75, 1.8]];
    const e = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 4], [0, 7], [7, 8], [8, 9], [9, 10], [10, 11]];
    for (const [i, x] of [[1, -0.25], [2, 0.15], [3, 0.4]]) { p.push([x, 0.75, 0.7]); e.push([i, p.length - 1]); }
    return { p, e };
  }
  function golem() {
    const p = [[-0.2, -0.95, 1], [0.2, -0.95, 1], [0.2, -0.65, 1], [-0.2, -0.65, 1], [-0.55, -0.55, 1.3], [0.55, -0.55, 1.3], [0.45, 0.15, 1], [-0.45, 0.15, 1], [-0.85, -0.3, 1], [-0.9, 0.35, 1.4], [0.85, -0.3, 1], [0.9, 0.35, 1.4], [-0.35, 0.95, 1.2], [0.35, 0.95, 1.2], [0, -0.2, 2]];
    const e = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [2, 5], [4, 5], [5, 6], [6, 7], [7, 4], [4, 8], [8, 9], [5, 10], [10, 11], [7, 12], [6, 13], [4, 14], [5, 14], [6, 14], [7, 14]];
    return { p, e };
  }
  function diamond() {
    const p = [[0, -0.9, 1.4], [0.6, 0, 1], [0, 0.9, 1.4], [-0.6, 0, 1], [0, 0, 2]];
    return { p, e: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [2, 4], [3, 4]] };
  }
  function wraith() {
    const p = [[0, -0.9, 1.5], [-0.3, -0.65, 1], [0.3, -0.65, 1], [-0.85, -0.2, 1.2], [0.85, -0.2, 1.2], [-1.05, 0.25, 0.9], [1.05, 0.25, 0.9], [-0.35, 0.2, 1], [0.35, 0.2, 1], [-0.2, 0.6, 1], [0.25, 0.75, 1], [-0.05, 1.0, 0.8]];
    const e = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [1, 7], [2, 8], [7, 9], [8, 10], [9, 11], [10, 11], [7, 8]];
    return { p, e };
  }
  function dragon() {
    const s = serpent();
    const p = s.p.map(([x, y, w]) => [x * 0.9, y * 0.8 + 0.25, w]), e = s.e.slice();
    const add = (x, y, w, l) => { p.push([x, y, w]); e.push([l, p.length - 1]); return p.length - 1; };
    const a = add(-0.3, -0.75, 1.4, 4), b = add(-0.85, -0.95, 1.2, a); add(-0.7, -0.35, 1, b);
    const c = add(0.25, -0.85, 1.4, 5), d = add(0.75, -1.05, 1.2, c); add(0.6, -0.45, 1, d);
    add(1.05, -0.35, 1.2, 9); add(0.85, -0.55, 1, 9);
    return { p, e };
  }
  const T = { humanoid, orb, crab, bug, blob, quad, bird, serpent, scorpion, golem, diamond, wraith, dragon };
  const cache = {};
  return (tpl, opts) => { const k = tpl + JSON.stringify(opts || {}); return cache[k] || (cache[k] = T[tpl](opts)); };
})();
const HERO_ART = { knight: ['humanoid', { shield: 1, sword: 1, crown: 0 }], mage: ['humanoid', { staff: 1, hat: 1 }], rogue: ['humanoid', { daggers: 1, hood: 1 }] };

// ── Vykreslování: pozadí, souhvězdí, částice, šipka cílení ──────────────────
const FX = (() => {
  let cv, ctx, W = 1, H = 1, dpr = 1, t = 0;
  let stars = [], bgCols = ['#1a1030', '#07040f'], accent = '#ffb547';
  const actors = new Map();
  const parts = [];
  const glowCache = {};
  let arrow = null, shoot = null;

  function glow(col) {
    if (glowCache[col]) return glowCache[col];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, col); g.addColorStop(0.4, hexA(col, 0.25)); g.addColorStop(1, hexA(col, 0));
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return (glowCache[col] = c);
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(loop);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    stars = [];
    const n = Math.floor(W * H / 2600);
    for (let i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() ** 3 * 2 + 0.3, p: Math.random() * 6, sp: rand(0.5, 2), z: Math.random() });
  }
  function setTheme(cols, acc) { bgCols = cols; accent = acc; }

  function drawBg() {
    const g = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.7);
    g.addColorStop(0, bgCols[0]); g.addColorStop(1, bgCols[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // mlhovina
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const x = W * (0.5 + 0.35 * Math.sin(t * 0.03 + i * 2.1)), y = H * (0.45 + 0.3 * Math.cos(t * 0.025 + i * 1.3)), r = Math.max(W, H) * 0.45;
      const ng = ctx.createRadialGradient(x, y, 0, x, y, r);
      ng.addColorStop(0, hexA(i === 1 ? '#6b4bff' : accent, 0.06)); ng.addColorStop(1, hexA(accent, 0));
      ctx.fillStyle = ng; ctx.fillRect(0, 0, W, H);
    }
    for (const s of stars) {
      const a = 0.25 + 0.75 * Math.abs(Math.sin(t * s.sp * 0.6 + s.p));
      const y = (s.y + t * s.z * 3) % H;
      ctx.fillStyle = `rgba(230,225,255,${a * (0.3 + s.z * 0.6)})`;
      ctx.fillRect(s.x, y, s.s, s.s);
    }
    // padající hvězda
    if (!shoot && Math.random() < 0.004) shoot = { x: rand(0, W), y: rand(0, H * 0.4), vx: rand(500, 900) * (Math.random() < 0.5 ? -1 : 1), vy: rand(150, 300), life: 0.9 };
    if (shoot) {
      shoot.life -= 1 / 60; shoot.x += shoot.vx / 60; shoot.y += shoot.vy / 60;
      const lg = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 0.15, shoot.y - shoot.vy * 0.15);
      lg.addColorStop(0, `rgba(255,255,255,${shoot.life})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = lg; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 0.15, shoot.y - shoot.vy * 0.15); ctx.stroke();
      if (shoot.life <= 0) shoot = null;
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // herec = souhvězdí navázané na DOM prvek
  function setActor(key, o) { actors.set(key, Object.assign(actors.get(key) || { flash: 0, shake: 0, lunge: 0, alpha: 0, dead: false, dir: 1 }, o)); }
  function removeActor(key) { actors.delete(key); }
  function clearActors() { actors.clear(); }
  function pos(key) {
    const a = actors.get(key);
    if (!a || !a.el) return null;
    const r = a.el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, a };
  }

  function drawActor(a) {
    const r = a.el.getBoundingClientRect();
    if (!r.width) return;
    const art = ART(a.tpl, a.opts);
    const size = Math.min(r.width, r.height) * 0.46;
    let cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (a.shake > 0) { cx += rand(-1, 1) * a.shake * 10; a.shake = Math.max(0, a.shake - 0.06); }
    if (a.lunge > 0) { cx += Math.sin(a.lunge * Math.PI) * 40 * a.dir; a.lunge = Math.max(0, a.lunge - 0.05); }
    a.alpha = Math.min(a.max || 1, a.alpha + 0.03);
    if (a.dead) { a.alpha = Math.max(0, a.alpha - 0.08); if (a.alpha <= 0) return; }
    const breathe = 1 + Math.sin(t * 1.4 + (a.seed || 0)) * 0.018;
    const col = a.flash > 0 ? '#ffffff' : a.color;
    a.flash = Math.max(0, a.flash - 0.05);
    const P = art.p.map(([x, y, w], i) => [cx + (x * a.dir + Math.sin(t * 1.3 + i * 1.7) * 0.018) * size * breathe, cy + (y + Math.cos(t * 1.1 + i) * 0.018) * size * breathe, w]);
    // aura
    ctx.globalCompositeOperation = 'lighter';
    const ag = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.4);
    ag.addColorStop(0, hexA(a.color, 0.14 * a.alpha)); ag.addColorStop(1, hexA(a.color, 0));
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cx, cy, size * 1.4, 0, Math.PI * 2); ctx.fill();
    // čáry
    ctx.lineCap = 'round';
    for (const [lw, al] of [[6, 0.1], [1.4, 0.65]]) {
      ctx.strokeStyle = hexA(col, al * a.alpha); ctx.lineWidth = lw;
      ctx.beginPath();
      for (const [i, j] of art.e) { ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); }
      ctx.stroke();
    }
    // hvězdy
    const gs = glow(col);
    ctx.globalAlpha = a.alpha;
    P.forEach(([x, y, w], i) => {
      const tw = 0.8 + 0.25 * Math.sin(t * 3 + i * 2.3);
      const s = (7 + w * 7) * tw * (size / 70);
      ctx.drawImage(gs, x - s, y - s, s * 2, s * 2);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    a.pts = P;
  }

  function burst(x, y, col, n = 20, spd = 260, size = 3, life = 0.8) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, s = spd * (0.2 + Math.random() * 0.8);
      parts.push({ x, y, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, life: life * rand(0.5, 1), max: life, size: size * rand(0.6, 1.4), col, g: 0 });
    }
  }
  function dissolve(key) {
    const a = actors.get(key);
    if (!a || !a.pts) return;
    for (const [x, y] of a.pts) burst(x, y, a.color, 6, 180, 3, 1.2);
    a.dead = true;
  }
  function slash(x, y, col) {
    for (let i = 0; i < 14; i++) { const k = i / 13 - 0.5; parts.push({ x: x + k * 120, y: y - k * 90, vx: 30, vy: -20, life: 0.25, max: 0.25, size: 5 - Math.abs(k) * 5, col: '#ffffff', g: 0 }); }
    burst(x, y, col, 16, 300, 3, 0.5);
  }
  function rise(x, y, col, n = 10) {
    for (let i = 0; i < n; i++) parts.push({ x: x + rand(-30, 30), y: y + rand(-10, 30), vx: rand(-15, 15), vy: rand(-90, -40), life: rand(0.6, 1.1), max: 1.1, size: rand(2, 4), col, g: 0 });
  }

  function setArrow(a) { arrow = a; }

  let last = 0;
  function loop(ms) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ms - last) / 1000 || 0.016); last = ms; t += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBg();
    for (const a of actors.values()) if (a.el && a.el.isConnected) drawActor(a);
    // částice
    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96;
      const al = q.life / q.max;
      const s = q.size * (0.5 + al);
      ctx.drawImage(glow(q.col), q.x - s * 2, q.y - s * 2, s * 4, s * 4);
    }
    // šipka cílení
    if (arrow) {
      const { x1, y1, x2, y2, ok } = arrow;
      const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 120;
      const col = ok ? '#ffe08a' : '#cfc8ff';
      ctx.strokeStyle = hexA(col, 0.9); ctx.lineWidth = 4; ctx.setLineDash([2, 12]); ctx.lineDashOffset = -t * 60;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
      ctx.setLineDash([]);
      const ang = Math.atan2(y2 - my, x2 - mx);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x2 + Math.cos(ang) * 10, y2 + Math.sin(ang) * 10); ctx.lineTo(x2 + Math.cos(ang + 2.5) * 18, y2 + Math.sin(ang + 2.5) * 18); ctx.lineTo(x2 + Math.cos(ang - 2.5) * 18, y2 + Math.sin(ang - 2.5) * 18); ctx.fill();
      ctx.drawImage(glow(col), x2 - 24, y2 - 24, 48, 48);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // malý náhled souhvězdí (karta hrdiny, kodex)
  function miniArt(canvas, tpl, opts, color) {
    const x = canvas.getContext('2d'), w = canvas.width, h = canvas.height, s = Math.min(w, h) * 0.4;
    const art = ART(tpl, opts);
    x.clearRect(0, 0, w, h);
    x.globalCompositeOperation = 'lighter';
    const P = art.p.map(([px, py, pw]) => [w / 2 + px * s, h / 2 + py * s, pw]);
    x.strokeStyle = hexA(color, 0.6); x.lineWidth = Math.max(1, s / 60);
    x.beginPath(); for (const [i, j] of art.e) { x.moveTo(P[i][0], P[i][1]); x.lineTo(P[j][0], P[j][1]); } x.stroke();
    const g = glow(color);
    for (const [px, py, pw] of P) { const r = (5 + pw * 5) * s / 70; x.drawImage(g, px - r, py - r, r * 2, r * 2); }
  }

  return { init, setTheme, setActor, removeActor, clearActors, pos, burst, dissolve, slash, rise, setArrow, miniArt, get t() { return t; } };
})();
