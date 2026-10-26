'use strict';
// ── PTAČÍ POMSTA · kresba ───────────────────────────────────────────────────
// Kreslený styl: syté barvy, tmavý obrys, měkké stínování. Vše v pixelech plátna (1 m = PPM).
const PtArt = (() => {
  const TAU = Math.PI * 2, OL = '#1c1410';
  const shade = (g, x0, y0, x1, y1, a, b) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  const radial = (g, x, y, r, a, b) => { const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.15); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  const blob = (g, fill, path, lw = 2) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = OL; g.stroke(); };
  const rngOf = s => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

  // ── Krajina ── obloha, slunce, mraky, kopce, stromy, tráva a hlína (uloženo do plátna)
  function land(VW, VH, GY, theme = 0) {
    const c = document.createElement('canvas'); c.width = VW; c.height = VH; const g = c.getContext('2d'), r = rngOf(7 + theme * 13);
    const T = [['#7cc8f4', '#d6f0ff', '#8fd14f', '#5aa83a'], ['#f8a76a', '#ffe0b0', '#9cc84a', '#6a9a34'], ['#9ad0ec', '#eaf8ff', '#a8d8a0', '#6aa86a']][theme % 3];
    g.fillStyle = shade(g, 0, 0, 0, GY, T[0], T[1]); g.fillRect(0, 0, VW, VH);
    // slunce
    const sx = VW * 0.78, sy = VH * 0.16; g.fillStyle = 'rgba(255,248,200,.35)'; g.beginPath(); g.arc(sx, sy, 60, 0, TAU); g.fill();
    g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(sx, sy, 34, 0, TAU); g.fill();
    // mraky
    for (let i = 0; i < 6; i++) {
      const x = r() * VW, y = 30 + r() * GY * 0.35, s = 0.6 + r() * 0.8;
      g.fillStyle = 'rgba(255,255,255,.85)';
      for (const [dx, dy, rr] of [[0, 0, 26], [26, 6, 20], [-26, 8, 18], [12, -12, 20], [44, 12, 14]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, rr * s, 0, TAU); g.fill(); }
    }
    // vzdálené kopce
    const hills = (base, amp, col, seed) => { const rr = rngOf(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, VH); for (let x = 0; x <= VW; x += 12) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.006 + rr() * 0.4 + seed)) - amp * 0.3 * Math.sin(x * 0.017 + seed)); g.lineTo(VW, VH); g.fill(); };
    hills(GY - 40, 90, 'rgba(120,180,120,.55)', 3); hills(GY - 10, 60, T[3], 5);
    // stromy na kopcích
    for (let i = 0; i < 14; i++) {
      const x = r() * VW, y = GY - 18 - r() * 30, s = 0.6 + r() * 0.6;
      g.fillStyle = '#5a3a20'; g.fillRect(x - 2 * s, y, 4 * s, 16 * s);
      g.fillStyle = r() < 0.5 ? '#3f8a2e' : '#4e9c34'; g.beginPath(); g.arc(x, y - 4 * s, 13 * s, 0, TAU); g.arc(x - 9 * s, y + 3 * s, 9 * s, 0, TAU); g.arc(x + 9 * s, y + 3 * s, 9 * s, 0, TAU); g.fill();
    }
    // země: tráva a hlína s kamínky
    g.fillStyle = shade(g, 0, GY, 0, VH, '#8a5a32', '#5a3a1e'); g.fillRect(0, GY, VW, VH - GY);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${40 + r() * 40},${24 + r() * 20},12,.5)`; g.beginPath(); g.ellipse(r() * VW, GY + 12 + r() * (VH - GY), 3 + r() * 6, 2 + r() * 3, 0, 0, TAU); g.fill(); }
    g.fillStyle = shade(g, 0, GY - 6, 0, GY + 12, T[2], '#4a8a2a'); g.fillRect(0, GY - 4, VW, 14);
    g.fillStyle = T[2]; for (let x = 0; x < VW; x += 5) { g.beginPath(); g.moveTo(x, GY - 2); g.lineTo(x + 2.5, GY - 8 - r() * 5); g.lineTo(x + 5, GY - 2); g.fill(); }
    g.strokeStyle = 'rgba(30,60,20,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, GY + 10); g.lineTo(VW, GY + 10); g.stroke();
    return c;
  }

  // ── Prak ── zadní část (za ptákem) a přední část (před ptákem)
  function slingBack(g, x, y, s) {
    g.save(); g.translate(x, y); g.lineCap = 'round';
    const wood = shade(g, -10 * s, 0, 10 * s, 0, '#8a5228', '#5a3218');
    // zadní rameno
    g.strokeStyle = OL; g.lineWidth = 11 * s; g.beginPath(); g.moveTo(2 * s, 30 * s); g.lineTo(12 * s, -18 * s); g.stroke();
    g.strokeStyle = wood; g.lineWidth = 8 * s; g.stroke();
    g.restore();
  }
  function slingFront(g, x, y, s, gy) {
    g.save(); g.translate(x, y); g.lineCap = 'round';
    const wood = shade(g, -10 * s, 0, 10 * s, 0, '#a8642e', '#6a3a1a');
    // kmen a přední rameno
    g.strokeStyle = OL; g.lineWidth = 15 * s; g.beginPath(); g.moveTo(0, gy - y); g.lineTo(0, 30 * s); g.stroke();
    g.strokeStyle = wood; g.lineWidth = 12 * s; g.stroke();
    g.strokeStyle = OL; g.lineWidth = 12 * s; g.beginPath(); g.moveTo(-1 * s, 32 * s); g.lineTo(-12 * s, -16 * s); g.stroke();
    g.strokeStyle = wood; g.lineWidth = 9 * s; g.stroke();
    // omotávka
    g.strokeStyle = '#3a2210'; g.lineWidth = 2 * s; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-6 * s, 30 * s + i * 4 * s); g.lineTo(6 * s, 27 * s + i * 4 * s); g.stroke(); }
    g.restore();
  }
  // gumy: od ramen ke kapse (bx, by)
  function band(g, x0, y0, bx, by, s) {
    g.lineCap = 'round'; g.strokeStyle = '#3a1e10'; g.lineWidth = 6 * s; g.beginPath(); g.moveTo(x0, y0); g.lineTo(bx, by); g.stroke();
    g.strokeStyle = '#5a2e18'; g.lineWidth = 3.5 * s; g.stroke();
  }
  function pouch(g, bx, by, s, ang) {
    g.save(); g.translate(bx, by); g.rotate(ang); blob(g, '#4a2a14', () => { g.roundRect(-6 * s, -10 * s, 12 * s, 20 * s, 4 * s); }, 1.5); g.restore();
  }

  // ── Ptáci ── r v pixelech, a = natočení, t čas (mrkání), mood: 0 klid, 1 let, 2 náraz
  const BIRD_COL = { red: ['#ff5a4a', '#c8181e'], yellow: ['#ffe45a', '#e8a810'], blue: ['#8ad4ff', '#2a7ad8'], black: ['#5a5a6a', '#16161e'] };
  function bird(g, kind, x, y, r, a = 0, t = 0, mood = 0) {
    g.save(); g.translate(x, y); g.rotate(a); g.lineJoin = 'round';
    const [c1, c2] = BIRD_COL[kind];
    // ocas
    g.fillStyle = OL; for (const [dx, dy, l] of [[-0.9, -0.15, 0.55], [-0.95, 0.1, 0.5], [-0.85, 0.3, 0.42]]) { g.save(); g.translate(dx * r, dy * r); g.rotate(-0.3 + dy); g.fillRect(-l * r, -0.09 * r, l * r, 0.18 * r); g.restore(); }
    if (kind === 'yellow') blob(g, radial(g, 0, 0, r, c1, c2), () => { g.moveTo(r * 1.15, r * 0.15); g.quadraticCurveTo(r * 0.2, -r * 1.5, -r * 0.95, -r * 0.55); g.quadraticCurveTo(-r * 1.15, r * 0.6, -r * 0.6, r * 0.85); g.quadraticCurveTo(r * 0.4, r * 1.05, r * 1.15, r * 0.15); }, 2);
    else blob(g, radial(g, 0, 0, r, c1, c2), () => g.arc(0, 0, r, 0, TAU), 2);
    // bříško
    g.fillStyle = kind === 'black' ? 'rgba(255,255,255,.12)' : 'rgba(255,240,220,.75)'; g.beginPath(); g.ellipse(r * 0.15, r * 0.5, r * 0.6, r * 0.38, 0, 0, TAU); g.fill();
    // chocholka / zápalná šňůra
    if (kind === 'black') { g.strokeStyle = '#c8a050'; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(0, -r); g.quadraticCurveTo(r * 0.2, -r * 1.4, r * 0.05, -r * 1.55); g.stroke(); g.fillStyle = Math.sin(t * 30) > 0 ? '#ffe45a' : '#ff8a2a'; g.beginPath(); g.arc(r * 0.05, -r * 1.6, r * 0.14, 0, TAU); g.fill(); }
    else { g.fillStyle = c2; g.strokeStyle = OL; g.lineWidth = 1.5; for (const [dx, h] of [[-0.15, 0.55], [0.12, 0.45]]) { g.beginPath(); g.ellipse(dx * r, -r * (0.95 + h / 2), r * 0.12, r * h / 2, dx, 0, TAU); g.fill(); g.stroke(); } }
    // oči a obočí
    const blink = (Math.floor(t * 0.7) % 5 === 0 && (t * 0.7) % 1 < 0.12) || mood === 2;
    for (const ex of [0.18, 0.52]) {
      if (blink) { g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.moveTo((ex - 0.14) * r, -0.12 * r); g.lineTo((ex + 0.14) * r, -0.12 * r); g.stroke(); continue; }
      g.fillStyle = '#fff'; g.strokeStyle = OL; g.lineWidth = 1.2; g.beginPath(); g.ellipse(ex * r, -0.12 * r, 0.17 * r, 0.2 * r, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = OL; g.beginPath(); g.arc((ex + 0.05) * r, -0.1 * r, 0.075 * r, 0, TAU); g.fill();
    }
    g.fillStyle = OL; g.beginPath(); g.moveTo(-0.02 * r, -0.42 * r); g.lineTo(0.72 * r, -0.28 * r); g.lineTo(0.7 * r, -0.4 * r); g.lineTo(0.02 * r, -0.56 * r); g.fill();
    // zobák
    blob(g, shade(g, 0, -r * 0.1, 0, r * 0.4, '#ffc23a', '#e87a10'), () => { g.moveTo(0.42 * r, 0.02 * r); g.lineTo(1.02 * r, 0.16 * r); g.lineTo(0.44 * r, 0.36 * r); g.closePath(); }, 1.5);
    g.strokeStyle = OL; g.lineWidth = 1; g.beginPath(); g.moveTo(0.46 * r, 0.18 * r); g.lineTo(0.95 * r, 0.17 * r); g.stroke();
    g.restore();
  }

  // ── Prasata ── zelená koule s rypákem, uši, modřiny podle zranění, helma u velkého
  function pig(g, x, y, r, a, hpFrac, helmet, t, blink) {
    g.save(); g.translate(x, y); g.rotate(a); g.lineJoin = 'round';
    for (const s of [-1, 1]) blob(g, '#6cbf2e', () => g.ellipse(s * r * 0.62, -r * 0.82, r * 0.2, r * 0.16, s * 0.6, 0, TAU), 1.5);
    blob(g, radial(g, 0, 0, r, '#b4ec6a', '#4e9a1e'), () => g.arc(0, 0, r, 0, TAU), 2);
    if (hpFrac < 0.6) { g.fillStyle = 'rgba(70,90,30,.45)'; g.beginPath(); g.ellipse(-r * 0.45, r * 0.25, r * 0.22, r * 0.16, 0.4, 0, TAU); g.fill(); g.beginPath(); g.ellipse(r * 0.5, -r * 0.35, r * 0.15, r * 0.12, 0, 0, TAU); g.fill(); }
    // oči
    const shut = blink || (t % 4) < 0.12;
    for (const s of [-1, 1]) {
      const ex = s * r * 0.36, ey = -r * 0.2;
      if (shut) { g.strokeStyle = OL; g.lineWidth = 1.6; g.beginPath(); g.moveTo(ex - r * 0.14, ey); g.lineTo(ex + r * 0.14, ey); g.stroke(); continue; }
      g.fillStyle = '#fff'; g.strokeStyle = OL; g.lineWidth = 1.2; g.beginPath(); g.arc(ex, ey, r * 0.17, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = OL; g.beginPath(); g.arc(ex + s * r * 0.03, ey + r * 0.02, r * 0.07, 0, TAU); g.fill();
    }
    // rypák
    blob(g, radial(g, 0, r * 0.18, r * 0.32, '#c8f58a', '#6cbf2e'), () => g.ellipse(0, r * 0.2, r * 0.32, r * 0.24, 0, 0, TAU), 1.5);
    g.fillStyle = '#2a5a10'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.12, r * 0.2, r * 0.06, r * 0.1, 0, 0, TAU); g.fill(); }
    // pusa
    g.strokeStyle = OL; g.lineWidth = 1.4; g.beginPath(); g.arc(0, r * 0.45, r * 0.16, 0.2, Math.PI - 0.2); g.stroke();
    if (helmet) {
      blob(g, shade(g, 0, -r * 1.1, 0, -r * 0.2, '#e0e4ea', '#7a8290'), () => { g.arc(0, -r * 0.25, r * 0.98, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); }, 1.8);
      g.fillStyle = '#5a6270'; g.fillRect(-r * 0.98, -r * 0.34, r * 1.96, r * 0.14);
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-r * 0.35, -r * 0.82, r * 0.25, r * 0.08, -0.3, 0, TAU); g.fill();
    }
    g.restore();
  }

  // ── Bloky ── w, h v pixelech; dmg 0–1 přidá praskliny
  const crackCache = {};
  function block(g, x, y, w, h, a, mat, dmg, seed = 1) {
    g.save(); g.translate(x, y); g.rotate(a); g.lineJoin = 'round';
    const hw = w / 2, hh = h / 2;
    if (mat === 'wood') {
      blob(g, shade(g, 0, -hh, 0, hh, '#e8a65a', '#b0682a'), () => g.rect(-hw, -hh, w, h), 1.8);
      g.strokeStyle = 'rgba(110,56,20,.55)'; g.lineWidth = 1;
      const along = w >= h, n = Math.max(2, Math.round((along ? h : w) / 6));
      for (let i = 1; i < n; i++) { g.beginPath(); if (along) { const yy = -hh + i * h / n; g.moveTo(-hw + 3, yy); g.bezierCurveTo(-hw / 3, yy + 1.5, hw / 3, yy - 1.5, hw - 3, yy); } else { const xx = -hw + i * w / n; g.moveTo(xx, -hh + 3); g.bezierCurveTo(xx + 1.5, -hh / 3, xx - 1.5, hh / 3, xx, hh - 3); } g.stroke(); }
      g.fillStyle = 'rgba(110,56,20,.6)'; g.beginPath(); g.ellipse(along ? hw * 0.4 : 0, along ? 0 : hh * 0.4, 2.2, 1.4, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,230,180,.35)'; g.fillRect(-hw + 1, -hh + 1, w - 2, Math.min(3, h * 0.2));
    } else if (mat === 'glass') {
      g.fillStyle = 'rgba(170,225,255,.55)'; g.fillRect(-hw, -hh, w, h);
      g.strokeStyle = '#2a6a98'; g.lineWidth = 1.8; g.strokeRect(-hw, -hh, w, h);
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-hw + 3, hh - 4); g.lineTo(-hw + Math.min(w, h) * 0.6, -hh + 3); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(-hw + 7, hh - 3); g.lineTo(-hw + Math.min(w, h) * 0.6 + 5, -hh + 4); g.stroke();
    } else if (mat === 'stone') {
      blob(g, shade(g, 0, -hh, 0, hh, '#c8ccd4', '#7a808c'), () => g.roundRect(-hw, -hh, w, h, Math.min(3, w * 0.1)), 1.8);
      const r = rngOf(seed * 31 + 3);
      g.fillStyle = 'rgba(70,74,84,.35)'; for (let i = 0; i < Math.max(2, w * h / 120); i++) { g.beginPath(); g.ellipse((r() - 0.5) * (w - 6), (r() - 0.5) * (h - 6), 1.5 + r() * 2.5, 1 + r() * 2, 0, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-hw + 2, -hh + 2, w - 4, Math.min(3, h * 0.2));
    } else {
      // skála
      blob(g, shade(g, 0, -hh, 0, hh, '#9a8a78', '#5a4a3c'), () => { g.moveTo(-hw, hh); g.lineTo(-hw + 4, -hh + 6); g.quadraticCurveTo(0, -hh - 3, hw - 4, -hh + 5); g.lineTo(hw, hh); g.closePath(); }, 2);
      g.fillStyle = '#6aaa3a'; g.beginPath(); g.moveTo(-hw + 3, -hh + 7); g.quadraticCurveTo(0, -hh - 5, hw - 3, -hh + 6); g.quadraticCurveTo(0, -hh + 3, -hw + 3, -hh + 7); g.fill();
      const r = rngOf(seed * 17 + 5); g.strokeStyle = 'rgba(40,30,20,.4)'; g.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) { const sx = (r() - 0.5) * w * 0.7, sy = (r() - 0.2) * h * 0.6; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 6 + r() * 8, sy + 4 + r() * 6); g.stroke(); }
    }
    if (dmg > 0.25 && mat !== 'rock') {
      // praskliny: čím víc poškození, tím víc čar
      const r = rngOf(seed * 7 + 11), n = Math.ceil(dmg * 4);
      g.strokeStyle = mat === 'glass' ? 'rgba(255,255,255,.95)' : 'rgba(30,20,10,.75)'; g.lineWidth = mat === 'glass' ? 1.2 : 1.4;
      for (let i = 0; i < n; i++) { let cx = (r() - 0.5) * w * 0.8, cy = (r() - 0.5) * h * 0.8; g.beginPath(); g.moveTo(cx, cy); for (let k = 0; k < 3; k++) { cx += (r() - 0.5) * Math.min(w, 18); cy += (r() - 0.5) * Math.min(h, 18); g.lineTo(Math.max(-hw, Math.min(hw, cx)), Math.max(-hh, Math.min(hh, cy))); } g.stroke(); }
    }
    g.restore();
  }

  // úlomky po rozbití bloku
  const DEBRIS = { wood: ['#e8a65a', '#b0682a', '#8a4a1a'], glass: ['rgba(200,240,255,.9)', 'rgba(140,210,255,.8)', '#ffffff'], stone: ['#c8ccd4', '#8a909c', '#6a707c'] };
  function debrisColor(mat, i) { const a = DEBRIS[mat] || DEBRIS.stone; return a[i % a.length]; }
  function shard(g, p) {
    g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = Math.min(1, p.life * 2);
    g.fillStyle = p.c; g.strokeStyle = p.mat === 'glass' ? 'rgba(40,110,160,.8)' : OL; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-p.s, -p.s * 0.4); g.lineTo(p.s * 0.8, -p.s * 0.6); g.lineTo(p.s * 0.5, p.s * 0.6); g.lineTo(-p.s * 0.7, p.s * 0.3); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  function feather(g, p) {
    g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = Math.min(1, p.life);
    g.fillStyle = p.c; g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.35, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-p.s, 0); g.lineTo(p.s, 0); g.stroke();
    g.restore();
  }
  function puff(g, p) {
    const k = 1 - p.life / p.max;
    g.globalAlpha = Math.max(0, 1 - k) * 0.9; g.fillStyle = p.c || '#f4f4f0';
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + p.seed, d = p.r * (0.4 + k * 0.9); g.beginPath(); g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, p.r * (0.45 + k * 0.4), 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  }
  function boom(g, p) {
    const k = 1 - p.life / p.max;
    g.globalAlpha = Math.max(0, 1 - k);
    g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(p.x, p.y, p.r * (0.4 + k), 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,140,40,.8)'; g.beginPath(); for (let i = 0; i <= 16; i++) { const a = i / 16 * TAU, rr = p.r * (0.6 + k * 1.1) * (i % 2 ? 0.7 : 1.15); g.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); } g.fill();
    g.globalAlpha = 1;
  }

  // ── Obrázek úvodní karty / obálky ──
  function scene(g, w, h, t) {
    const GY = h * 0.8, s = h / 360;
    g.drawImage(land(Math.round(w), Math.round(h), Math.round(GY), 0), 0, 0, w, h);
    const S = 30 * s;
    // stavba vpravo
    block(g, w * 0.7, GY - 0.55 * S, 0.22 * S, 1.1 * S, 0, 'wood', 0, 1); block(g, w * 0.7 + 1.3 * S, GY - 0.55 * S, 0.22 * S, 1.1 * S, 0, 'wood', 0, 2);
    block(g, w * 0.7 + 0.65 * S, GY - 1.21 * S, 1.8 * S, 0.22 * S, 0, 'stone', 0, 3);
    block(g, w * 0.7 + 0.2 * S, GY - 1.77 * S, 0.22 * S, 0.9 * S, 0, 'glass', 0.5, 4); block(g, w * 0.7 + 1.1 * S, GY - 1.77 * S, 0.22 * S, 0.9 * S, 0, 'glass', 0, 5);
    block(g, w * 0.7 + 0.65 * S, GY - 2.33 * S, 1.4 * S, 0.22 * S, 0, 'wood', 0, 6);
    pig(g, w * 0.7 + 0.65 * S, GY - 0.42 * S, 0.42 * S, 0, 1, false, t, false);
    pig(g, w * 0.7 + 0.65 * S, GY - 2.94 * S, 0.5 * S, 0, 1, true, t + 2, false);
    // prak a letící pták
    const sx = w * 0.16, sy = GY - 2.35 * S;
    slingBack(g, sx, sy, s * 1.2);
    const fl = (t % 2.2) / 2.2, bx = sx + fl * (w * 0.5), by = sy - Math.sin(fl * Math.PI) * h * 0.35;
    for (let i = 1; i < 8; i++) { const q = fl - i * 0.035; if (q < 0) break; g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(sx + q * w * 0.5, sy - Math.sin(q * Math.PI) * h * 0.35, 2.5 * s, 0, TAU); g.fill(); }
    bird(g, 'red', bx, by, 0.4 * S, fl * 2, t, 1);
    slingFront(g, sx, sy, s * 1.2, GY);
    bird(g, 'yellow', sx - 1.2 * S, GY - 0.32 * S, 0.32 * S, 0, t + 1); bird(g, 'blue', sx - 2 * S, GY - 0.24 * S, 0.24 * S, 0, t + 2);
  }

  return { land, slingBack, slingFront, band, pouch, bird, pig, block, shard, feather, puff, boom, scene, debrisColor, BIRD_COL, OL };
})();
