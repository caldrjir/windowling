'use strict';
// ── VĚKY VÁLEK · kresba ─────────────────────────────────────────────────────
// Kreslené postavičky s obrysem pro pět věků (pravěk, středověk, renesance, moderní doba,
// budoucnost), po třech druzích: pěšák, střelec a těžká jednotka (dinosaurus, rytíř na koni,
// kanón, tank, bojový robot). K tomu základny, věže, střely, zvláštní útoky a krajina každého
// věku. Hráč má modrou barvu, soupeř červenou; jednotky soupeře se kreslí zrcadlově.
const VkArt = (() => {
  const TAU = Math.PI * 2, OL = '#1a1210';
  const TEAM = ['#3d8bff', '#ff4d4d'], UNIT_SCALE = 1.35;
  const SKY = [
    ['#ff9a5a', '#ffd9a0', '#a8643a', '#7a8a3a', '#8a6a3a'],
    ['#5aa8ff', '#cfe9ff', '#6a8aa8', '#5a9a3a', '#7a6a4a'],
    ['#f2b25a', '#fff0c8', '#a88a5a', '#7aa04a', '#8a7a5a'],
    ['#7a8494', '#d0d4dc', '#5a6270', '#6a7a4a', '#5a5248'],
    ['#2a1a5a', '#a05ac8', '#3a2a6a', '#2a3a5a', '#3a3450'],
  ];
  const line = (g, w, c, ...p) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); };
  const limb = (g, w, c, ...p) => { line(g, w + 2.4, OL, ...p); line(g, w, c, ...p); };
  const blob = (g, fill, path, lw = 1.8) => { path(); g.fillStyle = fill; g.fill(); g.strokeStyle = OL; g.lineWidth = lw; g.stroke(); };

  // ── Krajina ── vykreslí se jednou na celou šířku bojiště
  function land(W, H, age, groundY) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), P = SKY[age];
    const sky = g.createLinearGradient(0, 0, 0, groundY); sky.addColorStop(0, P[0]); sky.addColorStop(1, P[1]);
    g.fillStyle = sky; g.fillRect(0, 0, W, groundY);
    let s = 7 + age * 13; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    if (age === 4) { for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; g.beginPath(); g.arc(r() * W, r() * groundY * 0.7, r() * 1.5 + 0.3, 0, TAU); g.fill(); } g.fillStyle = '#ffd0ff'; g.beginPath(); g.arc(W * 0.7, 60, 30, 0, TAU); g.fill(); g.fillStyle = 'rgba(42,26,90,.6)'; g.beginPath(); g.arc(W * 0.7 + 10, 54, 26, 0, TAU); g.fill(); }
    else { const sx = W * (age === 3 ? 0.3 : 0.62), sun = g.createRadialGradient(sx, 70, 4, sx, 70, 80); sun.addColorStop(0, age === 3 ? 'rgba(255,255,240,.6)' : 'rgba(255,250,220,1)'); sun.addColorStop(0.25, age === 3 ? 'rgba(255,255,240,.25)' : 'rgba(255,240,180,.8)'); sun.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = sun; g.fillRect(sx - 80, -10, 160, 160); }
    // mraky / kouř
    for (let i = 0; i < 9; i++) { const cx = r() * W, cy = 30 + r() * 80, k = 0.6 + r() * 0.8; g.fillStyle = age === 3 ? 'rgba(120,124,134,.5)' : age === 4 ? 'rgba(200,140,255,.15)' : 'rgba(255,255,255,.75)'; g.beginPath(); for (const [dx, dy, rr] of [[0, 0, 22], [24, -8, 18], [46, 2, 16], [-22, 4, 15]]) { g.moveTo(cx + dx * k + rr * k, cy + dy * k); g.arc(cx + dx * k, cy + dy * k, rr * k, 0, TAU); } g.fill(); }
    // vzdálené hory a kopce
    g.fillStyle = P[2]; g.beginPath(); g.moveTo(0, groundY); for (let x = 0; x <= W; x += 40) g.lineTo(x, groundY - 90 - Math.sin(x * 0.006 + age) * 40 - r() * 20); g.lineTo(W, groundY); g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, groundY - 70, W, 70);
    g.fillStyle = P[3]; g.beginPath(); g.moveTo(0, groundY); for (let x = 0; x <= W; x += 30) g.lineTo(x, groundY - 34 - Math.sin(x * 0.011 + age * 2) * 16); g.lineTo(W, groundY); g.fill();
    // stromy podle věku
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = groundY - 18 - r() * 10, s2 = 0.6 + r() * 0.6;
      if (age === 0) { g.fillStyle = '#5a3a1a'; g.fillRect(x - 2, y - 30 * s2, 4, 30 * s2); g.fillStyle = '#4a8a2a'; for (let k = 0; k < 5; k++) { g.save(); g.translate(x, y - 30 * s2); g.rotate(-1.2 + k * 0.6); g.beginPath(); g.ellipse(10 * s2, 0, 12 * s2, 3.5 * s2, 0, 0, TAU); g.fill(); g.restore(); } }
      else if (age === 4) { g.fillStyle = 'rgba(120,255,240,.5)'; g.fillRect(x - 1, y - 40 * s2, 2, 40 * s2); g.fillStyle = 'rgba(160,255,250,.8)'; g.beginPath(); g.arc(x, y - 40 * s2, 3, 0, TAU); g.fill(); }
      else if (age === 3) { g.fillStyle = 'rgba(70,74,84,.7)'; g.fillRect(x - 10 * s2, y - 40 * s2, 20 * s2, 40 * s2); g.fillStyle = 'rgba(255,230,150,.5)'; for (let k = 0; k < 3; k++) g.fillRect(x - 6 * s2, y - 34 * s2 + k * 10 * s2, 4, 4); }
      else { g.fillStyle = '#4a3220'; g.fillRect(x - 2, y - 14 * s2, 4, 14 * s2); g.fillStyle = age === 2 ? '#6a9a3a' : '#3e7a2e'; g.beginPath(); g.arc(x, y - 22 * s2, 12 * s2, 0, TAU); g.fill(); g.beginPath(); g.arc(x - 7 * s2, y - 16 * s2, 9 * s2, 0, TAU); g.arc(x + 7 * s2, y - 16 * s2, 9 * s2, 0, TAU); g.fill(); }
    }
    // zem
    const gg = g.createLinearGradient(0, groundY, 0, H); gg.addColorStop(0, P[4]); gg.addColorStop(1, '#2a2018');
    g.fillStyle = gg; g.fillRect(0, groundY, W, H - groundY);
    g.fillStyle = age === 4 ? '#5ad8ff' : age === 3 ? '#6a6a5a' : '#5a9a3a'; g.fillRect(0, groundY - 3, W, 5);
    if (age < 3) { g.fillStyle = '#4a8a2a'; for (let x = 0; x < W; x += 5) { if (r() < 0.4) continue; g.beginPath(); g.moveTo(x, groundY); g.lineTo(x + 2, groundY - 4 - r() * 4); g.lineTo(x + 4, groundY); g.fill(); } }
    for (let i = 0; i < 200; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.08)'; g.fillRect(r() * W, groundY + 6 + r() * (H - groundY - 6), 2 + r() * 4, 1.5); }
    if (age === 4) { g.strokeStyle = 'rgba(90,216,255,.25)'; g.lineWidth = 1; for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, groundY); g.lineTo(x - 30, H); g.stroke(); } }
    return c;
  }

  // ── Základny ── (x, y) je střed paty, side 0 = hráč (vlevo), 1 = soupeř
  function base(g, x, y, age, side, t) {
    g.save(); g.translate(x, y); if (side) g.scale(-1, 1); g.lineJoin = 'round';
    const tc = TEAM[side];
    if (age === 0) {
      blob(g, '#8a7a6a', () => { g.beginPath(); g.moveTo(-60, 0); g.quadraticCurveTo(-64, -70, -10, -86); g.quadraticCurveTo(40, -90, 56, -40); g.lineTo(60, 0); g.closePath(); }, 2.4);
      g.fillStyle = '#6a5a4a'; for (const [bx, by, br] of [[-30, -50, 14], [10, -64, 12], [30, -30, 10]]) { g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); }
      g.fillStyle = '#1a1008'; g.beginPath(); g.moveTo(12, 0); g.quadraticCurveTo(14, -40, 34, -40); g.quadraticCurveTo(52, -40, 52, 0); g.closePath(); g.fill();
      for (let i = 0; i < 6; i++) { const px = -56 + i * 9; limb(g, 4, '#8a5a2a', px, 0, px, -26 - (i % 2) * 6); }
      const fl = Math.sin(t * 12) * 3; g.fillStyle = '#ff8a3d'; g.beginPath(); g.moveTo(56, 0); g.quadraticCurveTo(62, -16 - fl, 66, 0); g.fill(); g.fillStyle = '#ffe066'; g.beginPath(); g.moveTo(59, 0); g.quadraticCurveTo(62, -9 - fl, 64, 0); g.fill();
      limb(g, 2, '#6a4a2a', -10, -86, -10, -112); g.fillStyle = tc; g.beginPath(); g.moveTo(-10, -112); g.lineTo(10, -106 + Math.sin(t * 4) * 2); g.lineTo(-10, -100); g.fill();
    } else if (age === 1) {
      blob(g, '#9a9488', () => { g.beginPath(); g.rect(-56, -100, 112, 100); }, 2.4);
      g.strokeStyle = 'rgba(40,36,30,.35)'; g.lineWidth = 1.2; for (let yy = -90; yy < 0; yy += 12) for (let xx = -56 + ((yy / 12) % 2 ? 0 : 10); xx < 56; xx += 20) g.strokeRect(xx, yy, 20, 12);
      g.fillStyle = '#9a9488'; for (let i = 0; i < 6; i++) { g.fillRect(-56 + i * 20, -112, 12, 14); g.strokeStyle = OL; g.lineWidth = 1.6; g.strokeRect(-56 + i * 20, -112, 12, 14); }
      g.fillStyle = '#3a2416'; g.beginPath(); g.moveTo(20, 0); g.lineTo(20, -36); g.arc(34, -36, 14, Math.PI, 0); g.lineTo(48, 0); g.fill(); g.strokeStyle = '#1a1008'; g.lineWidth = 1; for (let k = 22; k < 48; k += 5) { g.beginPath(); g.moveTo(k, -40); g.lineTo(k, 0); g.stroke(); }
      g.fillStyle = '#1a1a24'; for (const [wx, wy] of [[-36, -70], [-6, -70]]) { g.beginPath(); g.roundRect(wx, wy, 8, 16, 4); g.fill(); }
      limb(g, 2, '#5a4a3a', 0, -112, 0, -150); g.fillStyle = tc; g.beginPath(); g.moveTo(0, -150); g.quadraticCurveTo(14, -146 + Math.sin(t * 4) * 3, 28, -146); g.lineTo(28, -132); g.quadraticCurveTo(14, -132 + Math.sin(t * 4 + 1) * 3, 0, -134); g.fill(); g.lineWidth = 1.4; g.stroke();
    } else if (age === 2) {
      blob(g, '#b07a5a', () => { g.beginPath(); g.moveTo(-60, 0); g.lineTo(-50, -96); g.lineTo(50, -96); g.lineTo(60, 0); g.closePath(); }, 2.4);
      g.strokeStyle = 'rgba(80,40,20,.35)'; g.lineWidth = 1; for (let yy = -88; yy < 0; yy += 8) { g.beginPath(); g.moveTo(-58, yy); g.lineTo(58, yy); g.stroke(); }
      blob(g, '#c8b49a', () => { g.beginPath(); g.rect(-30, -140, 60, 44); }, 2);
      blob(g, '#4a6a8a', () => { g.beginPath(); g.moveTo(-36, -140); g.lineTo(0, -168); g.lineTo(36, -140); g.closePath(); }, 2);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -120, 10, 0, TAU); g.fill(); g.strokeStyle = OL; g.stroke(); line(g, 1.6, OL, 0, -120, 0, -127); line(g, 1.6, OL, 0, -120, 5, -120);
      g.fillStyle = '#1a1a24'; for (const yy of [-70, -40]) for (const xx of [-34, 26]) { g.beginPath(); g.arc(xx + 4, yy, 5, 0, TAU); g.fill(); }
      g.fillStyle = '#3a2416'; g.beginPath(); g.moveTo(-10, 0); g.lineTo(-10, -26); g.arc(0, -26, 10, Math.PI, 0); g.lineTo(10, 0); g.fill();
      limb(g, 2, '#5a4a3a', 0, -168, 0, -196); g.fillStyle = tc; g.fillRect(0, -196, 24, 14); g.strokeStyle = OL; g.lineWidth = 1.2; g.strokeRect(0, -196, 24, 14);
    } else if (age === 3) {
      g.fillStyle = '#8a8a6a'; for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) { g.beginPath(); g.ellipse(-60 + i * 14 + j * 7, -6 - j * 10, 8, 6, 0, 0, TAU); g.fill(); g.strokeStyle = OL; g.lineWidth = 1.2; g.stroke(); }
      blob(g, '#8a9094', () => { g.beginPath(); g.moveTo(-44, -20); g.lineTo(-40, -96); g.lineTo(44, -96); g.lineTo(52, -20); g.closePath(); }, 2.4);
      g.fillStyle = '#5a6066'; g.fillRect(-40, -60, 84, 6);
      g.fillStyle = '#1a1a24'; g.fillRect(-26, -84, 60, 8); g.fillStyle = 'rgba(255,220,120,.6)'; g.fillRect(-20, -82, 6, 4);
      limb(g, 3, '#5a6066', 20, -96, 20, -124); g.save(); g.translate(20, -128); g.rotate(Math.sin(t) * 0.6); blob(g, '#c8ccd4', () => { g.beginPath(); g.ellipse(0, 0, 16, 6, 0, Math.PI, TAU); g.closePath(); }, 1.6); g.restore();
      limb(g, 2, '#5a6066', -30, -96, -30, -130); g.fillStyle = tc; g.fillRect(-30, -130, 22, 13);
    } else {
      const glow = 0.5 + 0.5 * Math.sin(t * 3);
      const sh = g.createRadialGradient(0, -80, 20, 0, -80, 110); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.85, `rgba(90,216,255,${0.08 + glow * 0.08})`); sh.addColorStop(1, 'rgba(90,216,255,0)');
      g.fillStyle = sh; g.beginPath(); g.arc(0, -80, 110, Math.PI, TAU); g.fill();
      blob(g, '#3a3a5a', () => { g.beginPath(); g.moveTo(-50, 0); g.lineTo(-30, -150); g.lineTo(-10, -170); g.lineTo(10, -170); g.lineTo(30, -150); g.lineTo(50, 0); g.closePath(); }, 2.4);
      g.fillStyle = '#5a5a8a'; g.beginPath(); g.moveTo(-34, 0); g.lineTo(-20, -140); g.lineTo(-6, -140); g.lineTo(-14, 0); g.fill();
      g.fillStyle = `rgba(90,216,255,${0.6 + glow * 0.4})`; g.beginPath(); g.arc(0, -110, 10, 0, TAU); g.fill(); g.fillRect(-2, -100, 4, 100);
      g.fillStyle = tc; g.fillRect(-30, -40, 60, 5);
    }
    g.restore();
  }
  // místa pro věže na základně (vůči patě, pro hráče; soupeř zrcadlově)
  const SLOTS = [[[-30, -92], [10, -96], [36, -70]], [[-40, -116], [0, -116], [40, -116]], [[-44, -100], [44, -100], [0, -172]], [[-34, -100], [24, -100], [0, -24]], [[-24, -154], [24, -154], [0, -176]]];

  // věž; ang = úhel hlavně k cíli (v souřadnicích světa)
  function turret(g, x, y, age, kind, ang, side, t) {
    g.save(); g.translate(x, y); g.lineJoin = 'round';
    blob(g, ['#7a5a3a', '#7a7468', '#6a5a4a', '#4a5048', '#3a3a5a'][age], () => { g.beginPath(); g.roundRect(-10, -4, 20, 10, 3); }, 1.6);
    g.save(); g.rotate(ang);
    const big = kind === 1, c = ['#a8703a', '#8a8a96', '#3a3a44', '#4a5a3a', '#6a6aa8'][age];
    if (age === 0) { limb(g, 3, '#8a5a2a', 0, 0, big ? 22 : 16, 0); limb(g, 3, '#8a5a2a', big ? 22 : 16, -6, big ? 22 : 16, 6); }
    else if (age === 1) { blob(g, c, () => { g.beginPath(); g.rect(-4, -3, big ? 28 : 22, 6); }); limb(g, 2, '#5a3a1a', big ? 18 : 14, -9, big ? 18 : 14, 9); }
    else if (age === 2) { blob(g, c, () => { g.beginPath(); g.moveTo(-4, -5); g.lineTo(big ? 30 : 22, -4); g.lineTo(big ? 30 : 22, 4); g.lineTo(-4, 5); g.closePath(); }); }
    else if (age === 3) { if (big) { blob(g, c, () => { g.beginPath(); g.rect(-6, -7, 24, 14); }); g.fillStyle = '#ff5a3a'; for (const yy of [-4, 1]) g.fillRect(18, yy, 4, 3); } else { blob(g, c, () => { g.beginPath(); g.rect(-4, -3, 26, 4); }); blob(g, c, () => { g.beginPath(); g.rect(-6, -5, 10, 10); }); } }
    else { blob(g, c, () => { g.beginPath(); g.roundRect(-6, -5, big ? 30 : 24, 10, 4); }); g.fillStyle = `rgba(90,216,255,${0.6 + 0.4 * Math.sin(t * 8)})`; g.beginPath(); g.arc(big ? 26 : 20, 0, 3.5, 0, TAU); g.fill(); }
    g.restore();
    g.fillStyle = TEAM[side]; g.fillRect(-8, 2, 16, 3);
    g.restore();
  }

  // ── Jednotky ── u: { age, kind (0 pěšák, 1 střelec, 2 těžká), side, walk, atk (0–1), hit, dead }
  function man(g, o) {
    // panáček na místě (0, 0) = chodidla, směr doprava
    const w = o.walk || 0, a = o.atk || 0, l1 = Math.sin(w) * 6, l2 = -l1;
    limb(g, 3.6, o.leg, -2, -14, -2 + l1, 0); limb(g, 3.6, o.leg, 2, -14, 2 + l2, 0);
    g.fillStyle = OL; g.fillRect(-4 + l1, -1, 6, 2.4); g.fillRect(l2, -1, 6, 2.4);
    blob(g, o.body, () => { g.beginPath(); g.roundRect(-6, -27, 12, 15, 4); });
    if (o.belt) { g.fillStyle = o.belt; g.fillRect(-6, -16, 12, 3); }
    blob(g, o.skin, () => { g.beginPath(); g.arc(1, -33, 6, 0, TAU); });
    g.fillStyle = OL; g.beginPath(); g.arc(3.5, -34, 1.1, 0, TAU); g.fill();
    if (o.head) o.head(g);
    // ruka se zbraní: úhel podle útoku
    const ang = o.aim != null ? o.aim : -0.3 + Math.sin(a * Math.PI) * -1.6;
    g.save(); g.translate(2, -24); g.rotate(ang); limb(g, 3.2, o.arm || o.body, 0, 0, 9, 0); if (o.weapon) o.weapon(g, a); g.restore();
    if (o.front) o.front(g);
  }
  function unit(g, u, t) {
    const tc = TEAM[u.side], a = u.atk || 0, walk = u.walk || 0;
    g.save(); g.translate(u.x, u.y); g.scale(u.side ? -UNIT_SCALE : UNIT_SCALE, UNIT_SCALE); g.lineCap = 'round'; g.lineJoin = 'round';
    if (u.dead) { g.globalAlpha = Math.max(0, 1 - u.dead); g.rotate(-Math.min(1.4, u.dead * 3)); }
    if (u.hit > 0) g.filter = 'brightness(1.8)';
    const skin = ['#e0a878', '#f2c8a0', '#f2c8a0', '#d8a878', '#c8d0dc'][u.age];
    const K = u.age * 3 + u.kind;
    switch (K) {
      case 0: man(g, { walk, atk: a, skin, body: '#8a5a2a', leg: skin, belt: tc, head: q => { q.fillStyle = '#3a2410'; q.beginPath(); q.arc(0, -36, 6.5, Math.PI, TAU); q.fill(); }, weapon: q => { limb(q, 3, '#6a4220', 8, 0, 20, 0); q.fillStyle = '#6a4220'; q.beginPath(); q.arc(21, 0, 4.5, 0, TAU); q.fill(); q.strokeStyle = OL; q.lineWidth = 1.4; q.stroke(); } }); break;
      case 1: man(g, { walk, atk: a, skin, body: '#a8743a', leg: skin, head: q => { q.fillStyle = tc; q.fillRect(-5, -38, 12, 3); }, aim: -1.2, weapon: q => { const s = t * 14; q.strokeStyle = '#8a6a4a'; q.lineWidth = 1.2; q.beginPath(); q.moveTo(9, 0); q.lineTo(9 + Math.cos(s) * 10, Math.sin(s) * 10); q.stroke(); q.fillStyle = '#8a8a8a'; q.beginPath(); q.arc(9 + Math.cos(s) * 10, Math.sin(s) * 10, 2.5, 0, TAU); q.fill(); } }); break;
      case 2: { // dinosaurus s jezdcem
        const st = Math.sin(walk) * 4;
        limb(g, 5, '#3e8a3a', -8, -16, -10 + st, 0); limb(g, 5, '#3e8a3a', 10, -16, 12 - st, 0);
        blob(g, '#5aaa4a', () => { g.beginPath(); g.moveTo(-36, -24); g.quadraticCurveTo(-20, -40, 10, -34); g.quadraticCurveTo(24, -50, 32, -54); g.quadraticCurveTo(44, -56, 44, -48); g.quadraticCurveTo(38, -42, 28, -40); g.quadraticCurveTo(22, -18, 4, -14); g.quadraticCurveTo(-20, -12, -36, -24); g.closePath(); }, 2.2);
        g.fillStyle = '#3e8a3a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-14 + i * 8, -36); g.lineTo(-10 + i * 8, -42); g.lineTo(-6 + i * 8, -36); g.fill(); }
        g.fillStyle = OL; g.beginPath(); g.arc(37, -50, 1.6, 0, TAU); g.fill();
        if (a > 0.3) { g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(34 + i * 3, -44); g.lineTo(35.5 + i * 3, -41); g.lineTo(37 + i * 3, -44); g.fill(); } }
        g.save(); g.translate(-2, -32); man(g, { walk: 0, atk: a, skin, body: '#8a5a2a', leg: skin, belt: tc, aim: -0.4 + a * 0.6, weapon: q => { limb(q, 2, '#6a4220', 0, 0, 26, 0); q.fillStyle = '#9a9488'; q.beginPath(); q.moveTo(26, -3); q.lineTo(32, 0); q.lineTo(26, 3); q.fill(); } }); g.restore();
        break;
      }
      case 3: man(g, { walk, atk: a, skin, body: '#9a9ea8', leg: '#6a5a4a', belt: '#5a3a1a', head: q => { blob(q, '#b8bcc4', () => { q.beginPath(); q.arc(1, -35, 6.6, Math.PI, TAU); q.closePath(); }, 1.2); q.fillStyle = '#7a7e88'; q.fillRect(4, -36, 1.6, 7); }, weapon: q => { q.fillStyle = '#d8dce4'; q.fillRect(9, -1.5, 16, 3); q.fillStyle = '#8a6a2a'; q.fillRect(7, -4, 3, 8); }, front: q => { blob(q, tc, () => { q.beginPath(); q.roundRect(4, -28, 8, 14, 3); }, 1.4); q.fillStyle = '#ffe066'; q.fillRect(7, -23, 2, 4); } }); break;
      case 4: man(g, { walk, atk: a, skin, body: '#3e7a3a', leg: '#5a4a3a', belt: tc, head: q => { blob(q, '#3e7a3a', () => { q.beginPath(); q.moveTo(-6, -32); q.quadraticCurveTo(0, -46, 7, -33); q.closePath(); }, 1.2); }, aim: -0.15, weapon: q => { q.strokeStyle = '#6a4220'; q.lineWidth = 2; q.beginPath(); q.arc(9, 0, 10, -1.3, 1.3); q.stroke(); q.strokeStyle = '#ddd'; q.lineWidth = 0.8; q.beginPath(); q.moveTo(9 + Math.cos(-1.3) * 10 - a * 4, Math.sin(-1.3) * 10); q.lineTo(9 - a * 6, 0); q.lineTo(9 + Math.cos(1.3) * 10 - a * 4, Math.sin(1.3) * 10); q.stroke(); } }); break;
      case 5: { // rytíř na koni
        const st = Math.sin(walk) * 5;
        for (const [lx, d] of [[-14, st], [-8, -st], [12, -st], [18, st]]) limb(g, 3.6, '#6a4422', lx, -18, lx + d, 0);
        blob(g, '#8a5a32', () => { g.beginPath(); g.ellipse(2, -24, 22, 9, 0, 0, TAU); }, 2);
        blob(g, '#8a5a32', () => { g.beginPath(); g.moveTo(16, -28); g.lineTo(26, -46); g.quadraticCurveTo(34, -48, 36, -40); g.lineTo(26, -26); g.closePath(); }, 2);
        g.fillStyle = '#3a2410'; g.fillRect(17, -44, 8, 3);
        g.fillStyle = tc; g.beginPath(); g.roundRect(-14, -30, 26, 10, 3); g.fill();
        line(g, 3, '#3a2410', -20, -26, -28, -16 + st * 0.5);
        g.save(); g.translate(-2, -26); man(g, { walk: 0, skin, body: '#9a9ea8', leg: '#7a7e88', head: q => { blob(q, '#b8bcc4', () => { q.beginPath(); q.roundRect(-5, -41, 12, 12, 3); }, 1.2); q.fillStyle = OL; q.fillRect(1, -36, 6, 1.5); q.fillStyle = tc; q.beginPath(); q.moveTo(1, -41); q.quadraticCurveTo(-6, -50, -12, -44); q.quadraticCurveTo(-4, -44, 1, -41); q.fill(); }, aim: -0.12 + a * 0.15, weapon: q => { limb(q, 2.4, '#d8c8a0', -8, 0, 40 + a * 8, 0); q.fillStyle = '#c8ccd4'; q.beginPath(); q.moveTo(40 + a * 8, -3); q.lineTo(48 + a * 8, 0); q.lineTo(40 + a * 8, 3); q.fill(); } }); g.restore();
        break;
      }
      case 6: man(g, { walk, atk: a, skin, body: tc, leg: '#3a2a4a', belt: '#ffe066', head: q => { blob(q, '#2a2a3a', () => { q.beginPath(); q.ellipse(1, -38, 10, 3, -0.1, 0, TAU); }, 1.2); q.fillStyle = '#2a2a3a'; q.beginPath(); q.arc(1, -39, 5, Math.PI, TAU); q.fill(); q.strokeStyle = '#fff'; q.lineWidth = 2; q.beginPath(); q.moveTo(-3, -42); q.quadraticCurveTo(-10, -50, -14, -44); q.stroke(); }, aim: -0.1 + Math.sin(a * Math.PI) * 0.4, weapon: q => { q.strokeStyle = '#e8ecf4'; q.lineWidth = 1.4; q.beginPath(); q.moveTo(9, 0); q.lineTo(30 + a * 6, 0); q.stroke(); q.fillStyle = '#c99a3a'; q.beginPath(); q.arc(9, 0, 3, 0, TAU); q.fill(); } }); break;
      case 7: man(g, { walk, atk: a, skin, body: tc, leg: '#3a2a2a', belt: '#fff', head: q => { blob(q, '#2a2a3a', () => { q.beginPath(); q.moveTo(-7, -36); q.lineTo(1, -46); q.lineTo(9, -36); q.closePath(); }, 1.2); }, aim: -0.05, weapon: q => { q.fillStyle = '#5a3a1a'; q.fillRect(4, -2, 12, 4); q.fillStyle = '#3a3a44'; q.fillRect(14, -1.5, 18, 2.6); if (a > 0.6) { q.fillStyle = 'rgba(255,220,120,.9)'; q.beginPath(); q.arc(34, 0, 4, 0, TAU); q.fill(); q.fillStyle = 'rgba(220,220,220,.7)'; q.beginPath(); q.arc(40, -3, 5, 0, TAU); q.fill(); } } }); break;
      case 8: { // kanón s dělostřelcem
        g.save(); g.translate(10, -10); g.rotate(-0.12 - a * 0.08); blob(g, '#2a2a34', () => { g.beginPath(); g.moveTo(-18, -6); g.lineTo(26, -4); g.lineTo(26, 4); g.lineTo(-18, 6); g.closePath(); }, 2); g.fillStyle = '#4a4a5a'; g.fillRect(22, -5, 5, 10); g.restore();
        blob(g, '#6a4422', () => { g.beginPath(); g.rect(-8, -12, 20, 8); }, 1.6);
        for (const wx of [-2, 12]) { blob(g, '#7a5432', () => { g.beginPath(); g.arc(wx, -8, 8, 0, TAU); }, 1.8); g.strokeStyle = OL; g.lineWidth = 1; for (let k = 0; k < 4; k++) { const an = walk + k * Math.PI / 4; g.beginPath(); g.moveTo(wx - Math.cos(an) * 7, -8 - Math.sin(an) * 7); g.lineTo(wx + Math.cos(an) * 7, -8 + Math.sin(an) * 7); g.stroke(); } }
        g.save(); g.translate(-22, 0); man(g, { walk, skin, body: tc, leg: '#3a2a2a', aim: 0.4, head: q => { blob(q, '#2a2a3a', () => { q.beginPath(); q.moveTo(-7, -36); q.lineTo(1, -46); q.lineTo(9, -36); q.closePath(); }, 1.2); } }); g.restore();
        if (a > 0.7) { g.fillStyle = 'rgba(255,200,100,.9)'; g.beginPath(); g.arc(40, -16, 7, 0, TAU); g.fill(); g.fillStyle = 'rgba(200,200,200,.6)'; g.beginPath(); g.arc(48, -22, 9, 0, TAU); g.fill(); }
        break;
      }
      case 9: man(g, { walk, atk: a, skin, body: '#5a6a3a', leg: '#4a5a32', belt: tc, head: q => { blob(q, '#4a5a32', () => { q.beginPath(); q.arc(1, -35, 7, Math.PI, TAU); q.closePath(); }, 1.2); }, weapon: q => { q.fillStyle = '#c8ccd4'; q.beginPath(); q.moveTo(9, -1.5); q.lineTo(19, 0); q.lineTo(9, 1.5); q.fill(); } }); break;
      case 10: man(g, { walk, atk: a, skin, body: '#5a6a3a', leg: '#4a5a32', belt: tc, head: q => { blob(q, '#4a5a32', () => { q.beginPath(); q.arc(1, -35, 7, Math.PI, TAU); q.closePath(); }, 1.2); }, aim: -0.05, weapon: q => { q.fillStyle = '#2a2a2a'; q.fillRect(2, -2, 24, 3.5); q.fillRect(8, 1, 3, 5); if (a > 0.5 && Math.sin(t * 60) > 0) { q.fillStyle = '#ffe066'; q.beginPath(); q.moveTo(26, -4); q.lineTo(34, 0); q.lineTo(26, 4); q.fill(); } } }); break;
      case 11: { // tank
        blob(g, '#4a4a3a', () => { g.beginPath(); g.roundRect(-30, -14, 60, 14, 7); }, 2);
        g.fillStyle = '#2a2a24'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-24 + i * 9.6, -7, 4, 0, TAU); g.fill(); }
        g.strokeStyle = '#6a6a5a'; g.lineWidth = 1; for (let i = 0; i < 12; i++) { const px = -30 + ((i * 5 + walk * 4) % 60); g.beginPath(); g.moveTo(px, -14); g.lineTo(px, -12); g.stroke(); }
        blob(g, '#5a6a3a', () => { g.beginPath(); g.moveTo(-26, -14); g.lineTo(-20, -24); g.lineTo(24, -24); g.lineTo(28, -14); g.closePath(); }, 2);
        blob(g, '#6a7a4a', () => { g.beginPath(); g.roundRect(-12, -34, 24, 11, 5); }, 1.8);
        g.save(); g.translate(10, -29); g.rotate(-0.05); blob(g, '#4a5a32', () => { g.beginPath(); g.rect(0, -2.5, 30 - a * 4, 5); }, 1.6); g.restore();
        g.fillStyle = tc; g.fillRect(-18, -22, 16, 4);
        if (a > 0.75) { g.fillStyle = 'rgba(255,210,110,.95)'; g.beginPath(); g.arc(44, -29, 6, 0, TAU); g.fill(); }
        break;
      }
      case 12: man(g, { walk, atk: a, skin, body: '#8a92a8', leg: '#6a7088', belt: tc, arm: '#8a92a8', head: q => { blob(q, '#a8b0c8', () => { q.beginPath(); q.roundRect(-5, -40, 12, 12, 3); }, 1.2); q.fillStyle = '#ff4d4d'; q.fillRect(2, -36, 5, 2); }, weapon: q => { q.fillStyle = `rgba(90,255,240,${0.7 + 0.3 * Math.sin(t * 20)})`; q.fillRect(9, -1.5, 20, 3); q.fillStyle = 'rgba(90,255,240,.3)'; q.fillRect(9, -3.5, 20, 7); } }); break;
      case 13: man(g, { walk, atk: a, skin, body: '#2a3a6a', leg: '#1a2a4a', belt: tc, head: q => { blob(q, '#3a4a8a', () => { q.beginPath(); q.arc(1, -34, 7, 0, TAU); }, 1.2); q.fillStyle = '#5ad8ff'; q.fillRect(1, -37, 7, 3); }, aim: -0.05, weapon: q => { q.fillStyle = '#c8ccd4'; q.beginPath(); q.roundRect(2, -3, 20, 6, 2); q.fill(); q.fillStyle = '#5ad8ff'; q.fillRect(18, -1.5, 6, 3); if (a > 0.5) { q.fillStyle = 'rgba(90,216,255,.9)'; q.beginPath(); q.arc(26, 0, 4, 0, TAU); q.fill(); } } }); break;
      default: { // bojový robot
        const st = Math.sin(walk) * 6;
        limb(g, 6, '#5a5a7a', -8, -26, -12 + st, -10, -10 + st, 0); limb(g, 6, '#5a5a7a', 8, -26, 12 - st, -10, 10 - st, 0);
        blob(g, '#7a7aa8', () => { g.beginPath(); g.roundRect(-18, -54, 36, 28, 8); }, 2.2);
        g.fillStyle = `rgba(90,216,255,${0.6 + 0.4 * Math.sin(t * 6)})`; g.beginPath(); g.arc(0, -40, 5, 0, TAU); g.fill();
        blob(g, '#5a5a8a', () => { g.beginPath(); g.roundRect(-8, -64, 20, 10, 4); }, 1.6); g.fillStyle = '#ff4d4d'; g.fillRect(4, -61, 7, 3);
        g.save(); g.translate(16, -44); g.rotate(-0.05); blob(g, '#4a4a6a', () => { g.beginPath(); g.roundRect(0, -5, 30 - a * 4, 10, 3); }, 1.6); g.fillStyle = '#5ad8ff'; g.fillRect(24 - a * 4, -2, 6, 4); g.restore();
        g.fillStyle = tc; g.fillRect(-18, -30, 36, 4);
      }
    }
    g.filter = 'none';
    g.restore();
  }

  // střely: kind 'stone' | 'arrow' | 'ball' | 'bullet' | 'shell' | 'laser'
  function shot(g, p) {
    g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.vy, p.vx));
    if (p.kind === 'arrow') { line(g, 1.6, '#6a4220', -10, 0, 6, 0); g.fillStyle = '#c8ccd4'; g.beginPath(); g.moveTo(6, -2.5); g.lineTo(11, 0); g.lineTo(6, 2.5); g.fill(); g.fillStyle = '#fff'; g.fillRect(-11, -2, 4, 4); }
    else if (p.kind === 'bullet') { g.fillStyle = '#ffe066'; g.fillRect(-6, -1, 10, 2); }
    else if (p.kind === 'laser') { g.fillStyle = 'rgba(90,216,255,.4)'; g.fillRect(-14, -3, 24, 6); g.fillStyle = '#e0ffff'; g.fillRect(-14, -1, 24, 2); }
    else { g.fillStyle = p.kind === 'stone' ? '#8a8a8a' : '#2a2a34'; g.beginPath(); g.arc(0, 0, p.kind === 'shell' || p.kind === 'ball' ? 4.5 : 3.5, 0, TAU); g.fill(); g.strokeStyle = OL; g.lineWidth = 1; g.stroke(); }
    g.restore();
  }

  // zvláštní útoky: padající předměty podle věku
  function special(g, s, t) {
    g.save(); g.translate(s.x, s.y);
    if (s.age === 0) { const tr = g.createLinearGradient(-30, -30, 0, 0); tr.addColorStop(0, 'rgba(255,140,40,0)'); tr.addColorStop(1, 'rgba(255,180,60,.9)'); g.strokeStyle = tr; g.lineWidth = 8; g.beginPath(); g.moveTo(-34, -40); g.lineTo(0, 0); g.stroke(); blob(g, '#6a4a3a', () => { g.beginPath(); g.arc(0, 0, 9, 0, TAU); }); g.fillStyle = '#ff8a3d'; g.beginPath(); g.arc(-2, -2, 4, 0, TAU); g.fill(); }
    else if (s.age === 1) { g.rotate(Math.PI / 2 - 0.15); line(g, 1.8, '#6a4220', -12, 0, 8, 0); g.fillStyle = '#c8ccd4'; g.beginPath(); g.moveTo(8, -3); g.lineTo(14, 0); g.lineTo(8, 3); g.fill(); }
    else if (s.age === 2) { g.fillStyle = '#2a2a34'; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,200,120,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-3, -8); g.lineTo(-6, -16); g.stroke(); }
    else if (s.age === 3) { blob(g, '#4a5040', () => { g.beginPath(); g.ellipse(0, 0, 5, 10, 0, 0, TAU); }); g.fillStyle = '#3a3a2a'; g.fillRect(-6, -12, 12, 3); }
    else { g.fillStyle = 'rgba(90,216,255,.35)'; g.fillRect(-8, -400, 16, 400); g.fillStyle = '#e0ffff'; g.fillRect(-2.5, -400, 5, 400); g.fillStyle = 'rgba(200,255,255,.8)'; g.beginPath(); g.arc(0, 0, 10 + Math.sin(t * 30) * 2, 0, TAU); g.fill(); }
    g.restore();
  }
  // letadlo pro nálet moderní doby
  function plane(g, x, y) {
    g.save(); g.translate(x, y); g.scale(-1, 1);
    blob(g, '#6a7a5a', () => { g.beginPath(); g.ellipse(0, 0, 40, 8, 0, 0, TAU); }, 2);
    blob(g, '#5a6a4a', () => { g.beginPath(); g.moveTo(-6, 0); g.lineTo(10, -30); g.lineTo(18, -30); g.lineTo(12, 0); g.closePath(); }, 1.6);
    blob(g, '#5a6a4a', () => { g.beginPath(); g.moveTo(30, -2); g.lineTo(42, -16); g.lineTo(46, -16); g.lineTo(42, 0); g.closePath(); }, 1.4);
    g.fillStyle = '#9ad8ff'; g.beginPath(); g.ellipse(-28, -3, 7, 4, 0, 0, TAU); g.fill();
    g.restore();
  }

  return { TEAM, UNIT_SCALE, land, base, SLOTS, turret, unit, shot, special, plane };
})();
