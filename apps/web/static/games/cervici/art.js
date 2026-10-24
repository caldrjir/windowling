'use strict';
// ── ČERVÍCI · kresba ────────────────────────────────────────────────────────
// Sprity kreslené do canvasu: červ (tělo z článků, velké oči, čelenka týmu, zbraň v ruce), hrob,
// stromy a kameny na ostrově, střely a ikony zbraní. Sdílí je hra i obrázek na úvodní stránce.
const CvArt = (() => {
  const TAU = Math.PI * 2;
  const bez = (a, b, c, d, s) => { const u = 1 - s; return u * u * u * a + 3 * u * u * s * b + 3 * u * s * s * c + s * s * s * d; };

  // Červ v místních souřadnicích: (0, 0) jsou nohy, kouká doprava (zrcadlí se přes face).
  // o: { col, face, t, walk, aim (°), look (°), weapon, hurt, blink }
  function worm(ctx, o) {
    const t = o.t || 0, walk = o.walk || 0, face = o.face || 1;
    const wig = walk ? Math.sin(walk) * 1.6 : 0, bob = walk ? Math.abs(Math.cos(walk)) * -0.8 : Math.sin(t * 2.2) * 0.45;
    ctx.save(); ctx.scale(face, 1);
    // tělo: Bézierova křivka od ocasu k hlavě, články jako kolečka
    const P = [[-11 + wig, -2.3], [-2, -1.4 + wig * 0.25], [5.5, -5.5], [2.6, -15.5 + bob]];
    const pts = [];
    for (let i = 0; i <= 18; i++) { const s = i / 18; pts.push([bez(P[0][0], P[1][0], P[2][0], P[3][0], s), bez(P[0][1], P[1][1], P[2][1], P[3][1], s), 2.1 + 2.7 * Math.pow(s, 0.8)]); }
    const hx = P[3][0], hy = P[3][1] - 1.6;
    const skin = o.hurt ? '#ffffff' : '#ff9cc3', dark = '#5e1834', lite = '#ffd3e4';
    ctx.fillStyle = dark;
    for (const [x, y, r] of pts) { ctx.beginPath(); ctx.arc(x, y, r + 1.15, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(hx, hy, 5.3 + 1.15, 0, TAU); ctx.fill();
    ctx.fillStyle = skin;
    for (const [x, y, r] of pts) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(hx, hy, 5.3, 0, TAU); ctx.fill();
    // stín na spodku a lesk nahoře
    ctx.fillStyle = 'rgba(160,40,90,.35)';
    for (let i = 0; i < pts.length; i += 2) { const [x, y, r] = pts[i]; ctx.beginPath(); ctx.arc(x + r * 0.25, y + r * 0.35, r * 0.62, 0, TAU); ctx.fill(); }
    ctx.fillStyle = lite;
    for (let i = 4; i < pts.length; i += 3) { const [x, y, r] = pts[i]; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.3, r * 0.32, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(hx - 2, hy - 1.5, 1.6, 1.1, -0.5, 0, TAU); ctx.fill();
    // kroužky článků přes tělo
    ctx.strokeStyle = 'rgba(110,25,60,.4)'; ctx.lineWidth = 0.7;
    for (let i = 3; i < 15; i += 3) {
      const [x, y, r] = pts[i], [x2, y2] = pts[i + 1], tx = x2 - x, ty = y2 - y, n = Math.hypot(tx, ty) || 1;
      ctx.beginPath(); ctx.moveTo(x - ty / n * r * 0.9, y + tx / n * r * 0.9); ctx.lineTo(x + ty / n * r * 0.9, y - tx / n * r * 0.9); ctx.stroke();
    }
    // čelenka týmu s cípy vlajícími dozadu
    if (o.col) {
      ctx.strokeStyle = o.col; ctx.lineWidth = 2.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx - 5.1, hy + 0.6); ctx.quadraticCurveTo(hx, hy - 1.2, hx + 5.1, hy - 0.2); ctx.stroke();
      const fl = Math.sin(t * 9) * 1.2;
      ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.moveTo(hx - 5, hy + 0.5); ctx.quadraticCurveTo(hx - 8, hy - 1 + fl, hx - 10.5, hy + 0.5 - fl); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - 5, hy + 0.8); ctx.quadraticCurveTo(hx - 7.5, hy + 2.5 - fl, hx - 9.5, hy + 3.5 + fl); ctx.stroke();
      ctx.lineCap = 'butt';
    }
    // velké oči nad hlavou
    const la = (o.look || 0) * Math.PI / 180, blink = o.blink || (t % 3.7 < 0.12);
    for (const [ex, ey] of [[hx - 0.6, hy - 4.3], [hx + 3.4, hy - 4]]) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = dark; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.ellipse(ex, ey, 2.45, 3.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
      if (blink) { ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(ex, ey, 2.45, 3.2, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ex - 2.2, ey + 0.3); ctx.lineTo(ex + 2.2, ey + 0.3); ctx.stroke(); continue; }
      ctx.fillStyle = '#0d0f1e'; ctx.beginPath(); ctx.arc(ex + Math.cos(la) * 1.05, ey - Math.sin(la) * 1.5 + 0.3, 1.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + Math.cos(la) * 1.05 - 0.4, ey - Math.sin(la) * 1.5 - 0.2, 0.4, 0, TAU); ctx.fill();
    }
    // pusa
    ctx.strokeStyle = dark; ctx.lineWidth = 0.9;
    ctx.beginPath(); if (o.hurt) ctx.arc(hx + 3.2, hy + 2.6, 1.2, 0, TAU); else ctx.arc(hx + 2.8, hy + 1.4, 1.6, 0.3, 2.2); ctx.stroke();
    // zbraň
    if (o.weapon) { ctx.save(); ctx.translate(4.5, -8.5); ctx.rotate(-(o.aim || 0) * Math.PI / 180); held(ctx, o.weapon, t); ctx.restore(); }
    ctx.restore();
  }

  function held(ctx, id, t) {
    ctx.lineWidth = 0.9; ctx.strokeStyle = '#1b2014';
    if (id === 'bazooka') {
      const g = ctx.createLinearGradient(0, -3, 0, 3); g.addColorStop(0, '#9aae6a'); g.addColorStop(0.5, '#6d8043'); g.addColorStop(1, '#3e4a26');
      ctx.fillStyle = '#3e4a26'; ctx.fillRect(0, 2, 2.6, 4);
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-8, -2.7, 20, 5.4, 1.2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2e3820'; ctx.fillRect(-4.5, -2.7, 1.6, 5.4); ctx.fillRect(6, -2.7, 1.6, 5.4);
      ctx.fillStyle = '#272c22'; ctx.beginPath(); ctx.roundRect(11.5, -3.4, 3.2, 6.8, 1); ctx.fill();
      ctx.fillStyle = '#ffe066'; ctx.fillRect(2, -4.6, 2.4, 2);
    } else if (id === 'grenade') {
      ctx.fillStyle = '#4f7f3a'; ctx.beginPath(); ctx.arc(7, 0, 3.4, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#b8bccc'; ctx.fillRect(5.8, -5.3, 2.4, 2.2); ctx.strokeStyle = '#b8bccc'; ctx.beginPath(); ctx.arc(9.5, -4.6, 1.4, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(6, -1.2, 1.1, 0, TAU); ctx.fill();
    } else if (id === 'shotgun') {
      ctx.fillStyle = '#8a5530'; ctx.beginPath(); ctx.moveTo(-8, -1); ctx.lineTo(1, -2); ctx.lineTo(1, 2); ctx.lineTo(-8, 3.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2d3140'; ctx.fillRect(0, -2.2, 17, 2.4); ctx.fillRect(0, 0.4, 14, 1.8);
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(4, 0.2, 5, 2.4);
    } else if (id === 'dynamite') {
      stick(ctx, 7, 0, t);
    } else if (id === 'air') {
      ctx.fillStyle = '#3a4250'; ctx.beginPath(); ctx.roundRect(3, -4, 6, 8, 1.2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7cf09a'; ctx.fillRect(4.2, -2.8, 3.6, 2.4);
      ctx.strokeStyle = '#3a4250'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(10, -10); ctx.stroke();
      ctx.fillStyle = Math.sin(t * 10) > 0 ? '#ff5a5a' : '#802a2a'; ctx.beginPath(); ctx.arc(10, -10, 1.1, 0, TAU); ctx.fill();
    }
  }
  // dynamit: červená tyčka s doutnákem
  function stick(ctx, x, y, t) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#d23434'; ctx.strokeStyle = '#5a1010'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.roundRect(-3.2, -6, 6.4, 12, 1.4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f4e3c0'; ctx.fillRect(-3.2, -1.2, 6.4, 2.4);
    ctx.strokeStyle = '#6a5a40'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(2.5, -8.5, 1.5, -10.5); ctx.stroke();
    const f = 1.4 + Math.abs(Math.sin(t * 23)) * 1.6;
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(1.5, -10.8, f, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(1.5, -10.8, f * 0.45, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function grenade(ctx, x, y, t, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.fillStyle = '#4f7f3a'; ctx.strokeStyle = '#1b2a12'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 4.8, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,40,10,.6)'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.moveTo(0, -4.6); ctx.lineTo(0, 4.6); ctx.stroke();
    ctx.fillStyle = '#b8bccc'; ctx.fillRect(-1.6, -7.2, 3.2, 2.6);
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(-1.6, -1.8, 1.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function rocket(ctx, x, y, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#5a6a3a'; ctx.beginPath(); ctx.moveTo(-8, -4.2); ctx.lineTo(-4, -1.6); ctx.lineTo(-4, 1.6); ctx.lineTo(-8, 4.2); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(0, -2.4, 0, 2.4); g.addColorStop(0, '#e8ecf6'); g.addColorStop(1, '#8a90a8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-7, -2.4, 12, 4.8, 1); ctx.fill();
    ctx.fillStyle = '#e8344a'; ctx.beginPath(); ctx.moveTo(5, -2.4); ctx.quadraticCurveTo(10, 0, 5, 2.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,${150 + Math.random() * 90},50,.95)`; ctx.beginPath(); ctx.moveTo(-7, -2); ctx.lineTo(-12 - Math.random() * 6, 0); ctx.lineTo(-7, 2); ctx.fill();
    ctx.restore();
  }
  function grave(ctx, col) {
    ctx.fillStyle = '#4a7a34'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 2.4, 0, 0, TAU); ctx.fill();
    const g = ctx.createLinearGradient(-7, 0, 7, 0); g.addColorStop(0, '#d4d8e6'); g.addColorStop(1, '#868ca4');
    ctx.fillStyle = g; ctx.strokeStyle = '#2a2f45'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-7, -13); ctx.arc(0, -13, 7, Math.PI, 0); ctx.lineTo(7, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a4058'; ctx.fillRect(-1.1, -17, 2.2, 10); ctx.fillRect(-4, -14.5, 8, 2.2);
    if (col) { ctx.fillStyle = col; ctx.fillRect(-7, -5, 14, 2.4); }
  }

  // ── Ozdoby ostrova (stojí na povrchu, x/y je pata) ──
  function deco(ctx, kind, x, y, s, r) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineJoin = 'round';
    if (kind === 'palm') {
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      const lean = (r() - 0.5) * 18;
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(lean * 0.2, -22, lean, -44); ctx.stroke();
      ctx.strokeStyle = '#4a321c'; ctx.lineWidth = 1;
      for (let k = 0.15; k < 1; k += 0.13) { const px = lean * k * k, py = -44 * k; ctx.beginPath(); ctx.moveTo(px - 2, py); ctx.lineTo(px + 2, py - 1.5); ctx.stroke(); }
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.55 + (r() - 0.5) * 0.2, L = 20 + r() * 6;
        const ex = lean + Math.cos(a) * L, ey = -44 + Math.sin(a) * L * 0.55 + 10;
        ctx.fillStyle = i % 2 ? '#3fae4a' : '#2f8a3c';
        ctx.beginPath(); ctx.moveTo(lean, -44); ctx.quadraticCurveTo(lean + Math.cos(a) * L * 0.6, -44 + Math.sin(a) * L * 0.6 - 4, ex, ey);
        ctx.quadraticCurveTo(lean + Math.cos(a) * L * 0.5, -44 + Math.sin(a) * L * 0.5 + 2, lean, -42); ctx.fill();
      }
      ctx.fillStyle = '#7a4a22'; for (const dx of [-2, 2, 0]) { ctx.beginPath(); ctx.arc(lean + dx, -42 + (dx ? 0 : 2.5), 2.2, 0, TAU); ctx.fill(); }
    } else if (kind === 'pine') {
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(-2, -10, 4, 12);
      for (let i = 0; i < 4; i++) {
        const w = 15 - i * 3, yy = -6 - i * 9;
        ctx.fillStyle = i % 2 ? '#2f7a42' : '#276a38';
        ctx.beginPath(); ctx.moveTo(-w, yy); ctx.lineTo(0, yy - 15); ctx.lineTo(w, yy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(160,255,170,.18)'; ctx.beginPath(); ctx.moveTo(-w * 0.2, yy - 3); ctx.lineTo(0, yy - 15); ctx.lineTo(-w * 0.7, yy - 1); ctx.closePath(); ctx.fill();
      }
    } else if (kind === 'oak') {
      ctx.fillStyle = '#5e3e22'; ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(-2, -18); ctx.lineTo(2, -18); ctx.lineTo(3.5, 2); ctx.fill();
      for (const [dx, dy, rr, c] of [[-9, -24, 9, '#3f9a48'], [8, -25, 9, '#3f9a48'], [0, -32, 11, '#4bb052'], [-4, -22, 8, '#378a40'], [5, -21, 8, '#378a40']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(dx, dy, rr, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(220,255,200,.25)'; ctx.beginPath(); ctx.arc(-3, -36, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e04848'; for (const [ax, ay] of [[-6, -28], [6, -30], [2, -22]]) { ctx.beginPath(); ctx.arc(ax, ay, 1.6, 0, TAU); ctx.fill(); }
    } else if (kind === 'dead') {
      ctx.strokeStyle = '#2a2236'; ctx.lineCap = 'round';
      const br = (bx, by, a, L, wdt) => { if (L < 4) return; const ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L; ctx.lineWidth = wdt; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke(); br(ex, ey, a - 0.5 - r() * 0.3, L * 0.68, wdt * 0.65); br(ex, ey, a + 0.45 + r() * 0.3, L * 0.62, wdt * 0.65); };
      br(0, 2, -Math.PI / 2 + (r() - 0.5) * 0.3, 20, 4.5);
    } else if (kind === 'lamp') {
      const g = ctx.createRadialGradient(0, -30, 0, 0, -30, 22); g.addColorStop(0, 'rgba(255,220,140,.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -30, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a1c2a'; ctx.fillRect(-1.3, -28, 2.6, 30); ctx.fillRect(-4, 0, 8, 2);
      ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.roundRect(-3.5, -36, 7, 8, 1.5); ctx.fill();
      ctx.fillStyle = '#1a1c2a'; ctx.beginPath(); ctx.moveTo(-5, -36); ctx.lineTo(0, -40); ctx.lineTo(5, -36); ctx.fill();
    } else if (kind === 'pumpkin') {
      ctx.fillStyle = '#e8781e'; for (const dx of [-3.5, 3.5, 0]) { ctx.beginPath(); ctx.ellipse(dx, -5, 4.5, 5, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(-3.5, -7); ctx.lineTo(-1.5, -5); ctx.lineTo(-4, -5); ctx.fill(); ctx.beginPath(); ctx.moveTo(3.5, -7); ctx.lineTo(1.5, -5); ctx.lineTo(4, -5); ctx.fill();
      ctx.fillRect(-3, -3, 6, 1.4);
      ctx.fillStyle = '#3a6a2a'; ctx.fillRect(-0.8, -12, 1.6, 3);
    } else if (kind === 'bush') {
      for (const [dx, dy, rr, c] of [[-6, -4, 6, '#2f8a3c'], [6, -4, 6, '#2f8a3c'], [0, -7, 7.5, '#3fae4a']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(dx, dy, rr, 0, TAU); ctx.fill(); }
      ctx.fillStyle = r() < 0.5 ? '#ff6fb5' : '#ffe066'; for (const [ax, ay] of [[-5, -7], [3, -10], [7, -5]]) { ctx.beginPath(); ctx.arc(ax, ay, 1.3, 0, TAU); ctx.fill(); }
    } else if (kind === 'rock') {
      ctx.fillStyle = '#7d8296'; ctx.strokeStyle = '#3e4256'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-9, 2); ctx.lineTo(-7, -6); ctx.lineTo(-1, -10); ctx.lineTo(6, -7); ctx.lineTo(9, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a6abbe'; ctx.beginPath(); ctx.moveTo(-7, -6); ctx.lineTo(-1, -10); ctx.lineTo(1, -4); ctx.lineTo(-4, -2); ctx.closePath(); ctx.fill();
    } else if (kind === 'flower') {
      ctx.strokeStyle = '#3a8a3a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(2, -4, 0, -9); ctx.stroke();
      ctx.fillStyle = ['#ff6fb5', '#ffe066', '#ffffff', '#8ab4ff'][Math.floor(r() * 4)];
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 2.2, -9 + Math.sin(a) * 2.2, 1.7, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(0, -9, 1.3, 0, TAU); ctx.fill();
    } else if (kind === 'mushroom') {
      ctx.fillStyle = '#f2e6d0'; ctx.fillRect(-1.6, -6, 3.2, 7);
      ctx.fillStyle = '#e03a3a'; ctx.beginPath(); ctx.arc(0, -6, 5.5, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; for (const [ax, ay] of [[-2.6, -8], [1.8, -9.2], [3.2, -7]]) { ctx.beginPath(); ctx.arc(ax, ay, 0.9, 0, TAU); ctx.fill(); }
    } else if (kind === 'sign') {
      ctx.fillStyle = '#7a5530'; ctx.fillRect(-1.3, -18, 2.6, 20);
      ctx.fillStyle = '#b07a44'; ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(8, -20); ctx.lineTo(12, -16); ctx.lineTo(8, -12); ctx.lineTo(-10, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#5a3a1a'; ctx.beginPath(); ctx.moveTo(-7, -16); ctx.lineTo(6, -16); ctx.stroke();
    }
    ctx.restore();
  }

  // ikony zbraní na tlačítka (SVG)
  const ICON = {
    bazooka: '<svg viewBox="0 0 24 24"><rect x="2" y="9" width="17" height="6" rx="1.5" fill="#7d9050"/><rect x="18" y="8" width="4" height="8" rx="1" fill="#3a4426"/><rect x="6" y="9" width="2" height="6" fill="#3a4426"/><rect x="9" y="15" width="3" height="4" fill="#3a4426"/></svg>',
    grenade: '<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="7" fill="#5b8f40"/><rect x="10" y="4" width="4" height="4" fill="#b8bccc"/><circle cx="17" cy="5" r="2.2" fill="none" stroke="#b8bccc" stroke-width="1.4"/><path d="M5 14h14M12 7v14" stroke="#2c4a1c" stroke-width="1.2"/></svg>',
    shotgun: '<svg viewBox="0 0 24 24"><path d="M1 13l8-2v5l-8 2z" fill="#9a6034"/><rect x="8" y="10" width="15" height="2.6" fill="#3a3f52"/><rect x="8" y="13" width="12" height="2" fill="#3a3f52"/></svg>',
    dynamite: '<svg viewBox="0 0 24 24"><rect x="8" y="7" width="8" height="15" rx="2" fill="#d63a3a"/><rect x="8" y="13" width="8" height="3" fill="#f4e3c0"/><path d="M12 7q3-3 2-5" stroke="#8a7a5a" stroke-width="1.4" fill="none"/><circle cx="14" cy="2.5" r="2" fill="#ffd34d"/></svg>',
    air: '<svg viewBox="0 0 24 24"><path d="M2 11h14l5-4h2l-2 6H2z" fill="#9aa4c0"/><path d="M8 11l3-6h3l-1 6z" fill="#6a7494"/><path d="M8 13l3 5h3l-1-5z" fill="#6a7494"/><circle cx="7" cy="21" r="1.5" fill="#ff5a5a"/><circle cx="12" cy="21" r="1.5" fill="#ff5a5a"/></svg>',
  };

  return { worm, grave, deco, grenade, rocket, stick, ICON };
})();
