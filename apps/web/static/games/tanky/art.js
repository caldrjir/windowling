'use strict';
// ── TANKY · kresba ──────────────────────────────────────────────────────────
// Sprity do canvasu: tank (pásy s koly, korba v barvě hráče, věž s poklopem, hlaveň s úsťovou
// brzdou, anténa s praporkem ve větru), střely, ozdoby bojiště a ikony zbraní. Sdílí je hra
// i obrázek na úvodní stránce.
const TkArt = (() => {
  const TAU = Math.PI * 2;
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const mix = (c, to, k) => { const a = hex(c), b = hex(to); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`; };

  // Tank v místních souřadnicích: (0, 0) je střed pásů na zemi, čep hlavně je v (0, -15).
  // o: { col, ang (° 0–180, 90 = svisle), t, wheel, recoil (0–1), flash (0–1), dead, wind }
  function tank(ctx, o) {
    const face = o.ang <= 90 ? 1 : -1, la = face > 0 ? o.ang : 180 - o.ang, t = o.t || 0;
    const col = o.dead ? '#3c3c46' : o.col, dark = o.dead ? '#24242c' : mix(o.col, '#0a0c1a', 0.55), lite = o.dead ? '#55555f' : mix(o.col, '#ffffff', 0.35);
    ctx.save(); ctx.scale(face, 1);
    ctx.lineJoin = 'round'; ctx.lineWidth = 1.1; ctx.strokeStyle = '#0c0f1e';
    // anténa s praporkem (vlaje podle větru)
    const wv = Math.max(-1, Math.min(1, (o.wind || 0) / 8)) * face, ax = -8, ay = -20;
    ctx.strokeStyle = '#1a1e2c'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(ax - 1, ay - 8, ax - 2 - wv * 2, ay - 16); ctx.stroke();
    if (!o.dead) {
      const fx = ax - 2 - wv * 2, fy = ay - 16, len = 6 + Math.abs(wv) * 3, dir = wv === 0 ? -1 : Math.sign(wv), wob = Math.sin(t * 8) * 1.2;
      ctx.fillStyle = o.col; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx + dir * len * 0.5, fy + 1 + wob, fx + dir * len, fy + 2.2); ctx.lineTo(fx, fy + 4.4); ctx.closePath(); ctx.fill();
    }
    ctx.lineWidth = 1.1; ctx.strokeStyle = '#0c0f1e';
    // hlaveň (pod věží), zpětný ráz
    ctx.save(); ctx.translate(1, -15); ctx.rotate(-la * Math.PI / 180); ctx.translate(-(o.recoil || 0) * 4, 0);
    const bg = ctx.createLinearGradient(0, -2, 0, 2); bg.addColorStop(0, '#6a7088'); bg.addColorStop(1, '#2a2f42');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.rect(3, -1.8, 17, 3.6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a2f42'; ctx.beginPath(); ctx.rect(19, -2.7, 4, 5.4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.fillRect(10, -1.8, 2, 3.6);
    if (o.flash > 0) {
      ctx.globalAlpha = Math.min(1, o.flash * 1.5);
      const g = ctx.createRadialGradient(27, 0, 0, 27, 0, 9 + o.flash * 6); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.4, '#ffd34d'); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(23, -3); ctx.lineTo(38, -5); ctx.lineTo(34, 0); ctx.lineTo(38, 5); ctx.lineTo(23, 3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(27, 0, 7, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.restore();
    // věž
    const tg = ctx.createLinearGradient(0, -22, 0, -13); tg.addColorStop(0, lite); tg.addColorStop(1, col);
    ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(-10, -13); ctx.lineTo(-9, -19); ctx.quadraticCurveTo(-7, -22.5, -1, -22.5); ctx.lineTo(4, -22.5); ctx.quadraticCurveTo(9, -22, 10, -16); ctx.lineTo(9, -13); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-3, -22.6, 3.4, 1.3, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-6, -21, 8, 1.2);
    ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(1, -15, 2.6, 0, TAU); ctx.fill();
    // korba
    const hg = ctx.createLinearGradient(0, -14, 0, -7); hg.addColorStop(0, lite); hg.addColorStop(0.45, col); hg.addColorStop(1, dark);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(-18, -7.5); ctx.lineTo(19, -7.5); ctx.lineTo(22, -10.5); ctx.lineTo(16, -14); ctx.lineTo(-15, -14); ctx.lineTo(-19, -11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(10,12,30,.45)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-12, -14); ctx.lineTo(-12, -8); ctx.moveTo(11, -14); ctx.lineTo(11, -8); ctx.stroke();
    ctx.fillStyle = 'rgba(10,12,30,.55)'; for (const x of [-16, -8, 0, 8, 15]) { ctx.beginPath(); ctx.arc(x, -9.2, 0.6, 0, TAU); ctx.fill(); }
    ctx.fillStyle = o.dead ? '#444' : '#ffe9a0'; ctx.beginPath(); ctx.ellipse(20, -10.8, 1.1, 1.6, 0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = dark; ctx.fillRect(-17, -16, 6, 2.2); // bedna na nářadí
    // pásy a kola
    ctx.strokeStyle = '#0c0f1e'; ctx.lineWidth = 1.1;
    ctx.fillStyle = '#20253a'; ctx.beginPath(); ctx.roundRect(-20, -8, 40, 8, 4); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3a4058'; ctx.lineWidth = 1;
    const off = ((o.wheel || 0) * 1.2) % 3;
    for (let x = -18 + off; x < 18; x += 3) { ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x, -7); ctx.moveTo(x, -0.9); ctx.lineTo(x, 0); ctx.stroke(); }
    for (const x of [-14.5, -7.2, 0, 7.2, 14.5]) {
      ctx.fillStyle = '#6a7090'; ctx.beginPath(); ctx.arc(x, -4, 2.9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a2f42'; ctx.beginPath(); ctx.arc(x, -4, 1.2, 0, TAU); ctx.fill();
      const a = (o.wheel || 0) * 0.8; ctx.strokeStyle = '#2a2f42'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 2.6, -4 + Math.sin(a) * 2.6); ctx.lineTo(x - Math.cos(a) * 2.6, -4 - Math.sin(a) * 2.6); ctx.stroke();
    }
    ctx.restore();
  }

  // střely: x/y je střed, a je úhel letu
  function shell(ctx, kind, x, y, a, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.lineWidth = 0.8; ctx.strokeStyle = '#1a1a24';
    if (kind === 'dirt') {
      ctx.rotate(t * 6); ctx.fillStyle = '#8a6a44'; ctx.beginPath();
      for (let i = 0; i < 9; i++) { const r = 4.5 + (i % 3) * 0.9, q = i / 9 * TAU; ctx.lineTo(Math.cos(q) * r, Math.sin(q) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#5a4028'; ctx.beginPath(); ctx.arc(1, 1, 1.6, 0, TAU); ctx.fill();
    } else if (kind === 'dig') {
      ctx.fillStyle = '#9aa0b8'; ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(2, -3); ctx.lineTo(8, 0); ctx.lineTo(2, 3); ctx.lineTo(-6, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#4a5068'; for (let i = -4; i < 4; i += 2.5) { ctx.beginPath(); ctx.moveTo(i + Math.sin(t * 30) , -3); ctx.lineTo(i + 2, 3); ctx.stroke(); }
      ctx.fillStyle = '#ffd34d'; ctx.fillRect(-7, -1.5, 1.5, 3);
    } else {
      const big = kind === 'big', s = big ? 1.45 : kind === 'tri' ? 0.85 : 1;
      ctx.scale(s, s);
      const g = ctx.createLinearGradient(0, -2.4, 0, 2.4); g.addColorStop(0, big ? '#6a6e80' : '#e8d08a'); g.addColorStop(1, big ? '#2a2c38' : '#a07a3a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-5, -2.4); ctx.lineTo(2, -2.4); ctx.quadraticCurveTo(7, -2, 8, 0); ctx.quadraticCurveTo(7, 2, 2, 2.4); ctx.lineTo(-5, 2.4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = big ? '#e8344a' : '#8a6a3a'; ctx.fillRect(-1, -2.4, 1.6, 4.8);
      ctx.fillStyle = `rgba(255,${170 + Math.random() * 70},60,.9)`; ctx.beginPath(); ctx.moveTo(-5, -1.6); ctx.lineTo(-9 - Math.random() * 4, 0); ctx.lineTo(-5, 1.6); ctx.fill();
    }
    ctx.restore();
  }

  // ozdoby bojiště (x/y je pata, r náhoda)
  function deco(ctx, kind, x, y, s, r) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round';
    if (kind === 'pine') {
      ctx.fillStyle = '#4a3020'; ctx.fillRect(-1.6, -8, 3.2, 10);
      for (let i = 0; i < 4; i++) { const w = 11 - i * 2.4, yy = -5 - i * 7; ctx.fillStyle = i % 2 ? '#2f6a40' : '#275a36'; ctx.beginPath(); ctx.moveTo(-w, yy); ctx.lineTo(0, yy - 12); ctx.lineTo(w, yy); ctx.closePath(); ctx.fill(); }
    } else if (kind === 'oak') {
      ctx.fillStyle = '#4e3420'; ctx.beginPath(); ctx.moveTo(-2.5, 2); ctx.lineTo(-1.6, -14); ctx.lineTo(1.6, -14); ctx.lineTo(2.8, 2); ctx.fill();
      for (const [dx, dy, rr, c] of [[-7, -19, 7, '#3a8a44'], [7, -20, 7, '#3a8a44'], [0, -26, 9, '#46a050'], [-3, -17, 6, '#327a3c'], [4, -16, 6, '#327a3c']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(dx, dy, rr, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(230,255,200,.22)'; ctx.beginPath(); ctx.arc(-2, -29, 4, 0, TAU); ctx.fill();
    } else if (kind === 'dead') {
      ctx.strokeStyle = '#2a2232'; ctx.lineCap = 'round';
      const br = (bx, by, a, L, w) => { if (L < 3) return; const ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke(); br(ex, ey, a - 0.5 - r() * 0.3, L * 0.66, w * 0.65); br(ex, ey, a + 0.45 + r() * 0.3, L * 0.6, w * 0.65); };
      br(0, 2, -Math.PI / 2 + (r() - 0.5) * 0.3, 15, 3.6);
    } else if (kind === 'rock') {
      ctx.fillStyle = '#767b90'; ctx.strokeStyle = '#3a3e52'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(-6, -5); ctx.lineTo(-1, -8); ctx.lineTo(5, -6); ctx.lineTo(8, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a2a7bc'; ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(-1, -8); ctx.lineTo(1, -3); ctx.lineTo(-3, -1); ctx.closePath(); ctx.fill();
    } else if (kind === 'bush') {
      for (const [dx, dy, rr, c] of [[-5, -3, 5, '#2f7a3c'], [5, -3, 5, '#2f7a3c'], [0, -6, 6.5, '#3c9a48']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(dx, dy, rr, 0, TAU); ctx.fill(); }
    } else if (kind === 'ruin') {
      ctx.fillStyle = '#8a7e78'; ctx.strokeStyle = '#3a3230'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(-12, 2); ctx.lineTo(-12, -20); ctx.lineTo(-7, -22); ctx.lineTo(-4, -15); ctx.lineTo(0, -17); ctx.lineTo(3, -9); ctx.lineTo(10, -8); ctx.lineTo(10, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a2230'; ctx.fillRect(-8, -14, 4, 5); ctx.fillRect(2, -5, 4, 4);
      ctx.strokeStyle = 'rgba(40,30,30,.45)'; ctx.beginPath(); for (let yy = -18; yy < 0; yy += 4) { ctx.moveTo(-12, yy); ctx.lineTo(yy < -9 ? -4 : 10, yy); } ctx.stroke();
    } else if (kind === 'sandbags') {
      ctx.strokeStyle = '#5a4a2a'; ctx.lineWidth = 0.8;
      for (const [dx, dy] of [[-8, -2.5], [0, -2.5], [8, -2.5], [-4, -7.5], [4, -7.5], [0, -12.5]]) { ctx.fillStyle = '#c4a870'; ctx.beginPath(); ctx.ellipse(dx, dy, 4.6, 2.8, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    } else if (kind === 'barrel') {
      for (const dx of [-4, 4]) {
        ctx.fillStyle = dx < 0 ? '#c84a2a' : '#3a6a9a'; ctx.strokeStyle = '#1a1a24'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.roundRect(dx - 3.5, -11, 7, 12, 1.4); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.moveTo(dx - 3.5, -7); ctx.lineTo(dx + 3.5, -7); ctx.moveTo(dx - 3.5, -3); ctx.lineTo(dx + 3.5, -3); ctx.stroke();
      }
    } else if (kind === 'flower') {
      ctx.strokeStyle = '#3a8a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -6); ctx.stroke();
      ctx.fillStyle = ['#ff6fb5', '#ffe066', '#ffffff'][Math.floor(r() * 3)]; ctx.beginPath(); ctx.arc(0, -7, 1.8, 0, TAU); ctx.fill();
    } else if (kind === 'cactus') {
      ctx.fillStyle = '#3f8a4a'; ctx.strokeStyle = '#1f4a2a'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.roundRect(-2.5, -20, 5, 22, 2.5); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(-8, -14, 4, 8, 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.roundRect(4, -17, 4, 7, 2); ctx.fill(); ctx.stroke();
      ctx.fillRect(-5, -8, 3, 2.5); ctx.fillRect(2, -11, 3, 2.5);
    }
    ctx.restore();
  }

  const ICON = {
    shell: '<svg viewBox="0 0 24 24"><path d="M4 9h10q6 0 8 3q-2 3-8 3H4z" fill="#d8bc72"/><rect x="8" y="9" width="2" height="6" fill="#8a6a3a"/></svg>',
    big: '<svg viewBox="0 0 24 24"><path d="M2 7h12q8 0 9 5q-1 5-9 5H2z" fill="#4a4e60"/><rect x="7" y="7" width="3" height="10" fill="#e8344a"/></svg>',
    tri: '<svg viewBox="0 0 24 24"><g fill="#d8bc72"><path d="M3 4h8q4 0 5 2q-1 2-5 2H3z"/><path d="M6 10h8q4 0 5 2q-1 2-5 2H6z"/><path d="M3 16h8q4 0 5 2q-1 2-5 2H3z"/></g></svg>',
    dig: '<svg viewBox="0 0 24 24"><path d="M3 8h11l8 4-8 4H3z" fill="#9aa0b8"/><path d="M6 8l3 8M10 8l3 8" stroke="#4a5068" stroke-width="1.4"/></svg>',
    dirt: '<svg viewBox="0 0 24 24"><path d="M5 15l2-6 5-3 5 2 3 5-2 5-6 2-5-2z" fill="#8a6a44"/><circle cx="11" cy="13" r="2" fill="#5a4028"/><circle cx="15" cy="10" r="1.2" fill="#5a4028"/></svg>',
  };

  return { tank, shell, deco, mix, ICON };
})();
