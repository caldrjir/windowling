'use strict';
// ── VĚKY VÁLEK · kresba ─────────────────────────────────────────────────────
// Kreslené postavy s obrysem a stínováním pro pět věků (pravěk, středověk, renesance, moderní
// doba, budoucnost), po třech druzích: pěšák, střelec a těžká jednotka (tyranosaurus s jezdcem,
// rytíř na koni v čabraku, bronzový kanón, tank, bojový robot). Postava má kolena, lokty, ruce,
// obličej a kostým svého věku. K tomu mohutné základny, věže, střely, zvláštní útoky a krajina
// každého věku s kulisami. Hráč má modrou barvu, soupeř červenou; soupeř se kreslí zrcadlově.
const VkArt = (() => {
  const TAU = Math.PI * 2, OL = '#1a1210';
  const TEAM = ['#3d7bff', '#e8383a'], TEAM_D = ['#1e4aa8', '#9a1e20'], TEAM_L = ['#8ab8ff', '#ff8a8a'];
  const UNIT_SCALE = 1, BASE_SCALE = 1.35;
  // výška postav kvůli ukazatelům zdraví: pěšák a střelec, těžké jednotky podle věku
  const TOP = [64, 64, [96, 98, 70, 60, 104]];

  // ── Dodané obrázky ── assets/manifest.json je seznam souborů, které existují (bez přípony = .png).
  // Co v něm je, se načte a nahradí kresbu; co chybí, kreslí se jako dosud. Bez 404 v konzoli.
  const IMG = {};
  let manifest = null;
  try {
    fetch('assets/manifest.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : [])).then(list => {
      manifest = Array.isArray(list) ? list : [];
      for (const f of manifest) { const n = f.replace(/\.(png|webp|jpg)$/, ''), im = new Image(); im.onload = () => { IMG[n] = im; }; im.src = `assets/${/\.(png|webp|jpg)$/.test(f) ? f : f + '.png'}`; }
    }).catch(() => { manifest = []; });
  } catch (e) { manifest = []; }
  const img = n => IMG[n] || null;
  // obrázek s kotvou: ax, ay jsou poměry (0–1) bodu, který leží na (x, y); h = výška v herních px
  function sprite(g, im, x, y, h, ax = 0.5, ay = 1, flip = false) {
    const w = im.width * h / im.height;
    g.save(); g.translate(x, y); if (flip) g.scale(-1, 1); g.drawImage(im, -w * ax, -h * ay, w, h); g.restore();
  }

  const shade = (g, x0, y0, x1, y1, c1, c2) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, c1); gr.addColorStop(1, c2); return gr; };
  const mix = (c, to, k) => { const h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const a = h(c), b = h(to); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`; };
  const line = (g, w, c, ...p) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); };
  const limb = (g, w, c, ...p) => { line(g, w + 2.6, OL, ...p); line(g, w, c, ...p); };
  const fillOut = (g, fill, path, lw = 1.8) => { path(); g.fillStyle = fill; g.fill(); g.strokeStyle = OL; g.lineWidth = lw; g.stroke(); };

  // ── Postava ── (0, 0) = chodidla, směr doprava, výška ~62 px
  // o: walk, atk, skin, pants, boots, shirt (barva trupu), torso(g) detaily trupu, sleeve, head(g, hx, hy),
  //    beard(g, hx, hy), back(g) za tělem, weapon(g, a) v ruce, aim (úhel paže), shield(g) před tělem, legsBare
  function person(g, o) {
    const w = o.walk || 0, a = o.atk || 0;
    const legPts = p => { const a1 = Math.sin(p) * 0.55, k = Math.max(0, Math.cos(p)) * 0.8; const hip = [0, -24], kn = [hip[0] + Math.sin(a1) * 12, hip[1] + Math.cos(a1) * 12]; return [hip, kn, [kn[0] + Math.sin(a1 - k) * 12, kn[1] + Math.cos(a1 - k) * 12], a1 - k]; };
    const drawLeg = (p, back) => {
      const [hip, kn, ft] = legPts(p), col = back ? mix(o.pants, '#000000', 0.25) : o.pants;
      limb(g, 7, col, hip[0], hip[1], kn[0], kn[1]); limb(g, 6, o.legsBare ? (back ? mix(o.skin, '#000000', 0.2) : o.skin) : col, kn[0], kn[1], ft[0], ft[1]);
      fillOut(g, back ? mix(o.boots, '#000000', 0.25) : o.boots, () => { g.beginPath(); g.moveTo(ft[0] - 4, ft[1] - 4); g.quadraticCurveTo(ft[0] - 5, ft[1] + 1, ft[0] - 3, ft[1] + 1); g.lineTo(ft[0] + 7, ft[1] + 1); g.quadraticCurveTo(ft[0] + 8, ft[1] - 3, ft[0] + 3, ft[1] - 4); g.closePath(); }, 1.5);
    };
    const shoulderF = [6, -41], shoulderB = [-4, -41];
    // záda (plášť, toulec, batoh), zadní ruka a noha
    if (o.back) o.back(g);
    const bang = 1.6 - Math.sin(w) * 0.5;
    const be = [shoulderB[0] + Math.cos(bang) * 10, shoulderB[1] + Math.sin(bang) * 10], bh = [be[0] + Math.cos(bang - 0.4) * 9, be[1] + Math.sin(bang - 0.4) * 9];
    limb(g, 5.5, mix(o.sleeve || o.shirt, '#000000', 0.25), shoulderB[0], shoulderB[1], be[0], be[1], bh[0], bh[1]);
    fillOut(g, mix(o.skin, '#000000', 0.2), () => { g.beginPath(); g.arc(bh[0], bh[1], 3, 0, TAU); }, 1.2);
    if (o.sit) {
      // jezdec sedí: stehno vodorovně dopředu, bérec svisle dolů podél boku zvířete
      const seat = (back) => { const col = back ? mix(o.pants, '#000000', 0.25) : o.pants, dx = back ? -3 : 0; limb(g, 7, col, dx, -24, dx + 11, -23); limb(g, 6, o.legsBare ? (back ? mix(o.skin, '#000000', 0.2) : o.skin) : col, dx + 11, -23, dx + 9, -10); fillOut(g, back ? mix(o.boots, '#000000', 0.25) : o.boots, () => { g.beginPath(); g.moveTo(dx + 5, -12); g.lineTo(dx + 15, -11); g.quadraticCurveTo(dx + 16, -7, dx + 13, -7); g.lineTo(dx + 5, -8); g.closePath(); }, 1.5); };
      seat(true); seat(false);
    } else {
      drawLeg(w + Math.PI, true);
      drawLeg(w, false);
    }
    // trup: ramena širší než pas, světlo zleva shora
    const torso = () => { g.beginPath(); g.moveTo(-7, -23); g.lineTo(7, -23); g.quadraticCurveTo(11, -34, 10, -44); g.quadraticCurveTo(1, -47, -9, -44); g.quadraticCurveTo(-10, -34, -7, -23); g.closePath(); };
    torso(); g.fillStyle = shade(g, -10, -46, 10, -22, mix(o.shirt, '#ffffff', 0.18), mix(o.shirt, '#000000', 0.18)); g.fill();
    if (o.torso) { g.save(); torso(); g.clip(); o.torso(g); g.restore(); }
    torso(); g.strokeStyle = OL; g.lineWidth = 1.8; g.stroke();
    // hlava
    const hx = 2, hy = -53;
    fillOut(g, o.skin, () => { g.beginPath(); g.rect(-1, -48, 5, 4); }, 1);
    fillOut(g, shade(g, hx - 8, hy - 8, hx + 8, hy + 8, mix(o.skin, '#ffffff', 0.15), mix(o.skin, '#000000', 0.12)), () => { g.beginPath(); g.ellipse(hx, hy, 8, 8.8, 0, 0, TAU); }, 1.8);
    fillOut(g, mix(o.skin, '#000000', 0.15), () => { g.beginPath(); g.ellipse(hx - 3, hy + 0.5, 2, 2.6, 0, 0, TAU); }, 1.1);
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(hx + 4, hy - 1.5, 2.2, 2.6, 0, 0, TAU); g.fill();
    g.fillStyle = OL; g.beginPath(); g.arc(hx + 4.8, hy - 1.3, 1.3, 0, TAU); g.fill();
    line(g, 1.4, OL, hx + 2, hy - 5, hx + 6.5, hy - 4.6);
    fillOut(g, mix(o.skin, '#000000', 0.06), () => { g.beginPath(); g.moveTo(hx + 7, hy - 1); g.quadraticCurveTo(hx + 11, hy + 2, hx + 7.5, hy + 3); }, 1.2);
    line(g, 1.2, OL, hx + 3, hy + 5, hx + 6, hy + 4.6);
    if (o.beard) o.beard(g, hx, hy);
    if (o.head) o.head(g, hx, hy);
    // přední ruka se zbraní; útok švihne paží
    const ang = o.aim != null ? o.aim - Math.sin(a * Math.PI) * 0.15 : 0.7 - Math.sin(a * Math.PI) * 2.1;
    const fe = [shoulderF[0] + Math.cos(ang) * 10, shoulderF[1] + Math.sin(ang) * 10], fa = ang - (o.aim != null ? 0.05 : 0.35), fh = [fe[0] + Math.cos(fa) * 9, fe[1] + Math.sin(fa) * 9];
    if (o.weaponBack) { g.save(); g.translate(fh[0], fh[1]); g.rotate(fa); o.weaponBack(g, a); g.restore(); }
    limb(g, 5.5, o.sleeve || o.shirt, shoulderF[0], shoulderF[1], fe[0], fe[1], fh[0], fh[1]);
    if (o.weapon) { g.save(); g.translate(fh[0], fh[1]); g.rotate(fa); o.weapon(g, a); g.restore(); }
    fillOut(g, o.skin, () => { g.beginPath(); g.arc(fh[0], fh[1], 3.2, 0, TAU); }, 1.2);
    if (o.shield) o.shield(g);
  }

  // ── Jednotky ── u: { age, kind (0 pěšák, 1 střelec, 2 těžká), side, walk, atk (0–1), hit, dead }
  function unit(g, u, t) {
    const tc = TEAM[u.side], td = TEAM_D[u.side], tl = TEAM_L[u.side], a = u.atk || 0, walk = u.walk || 0;
    g.save(); g.translate(u.x, u.y);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, 1, u.kind === 2 ? 34 : 14, 3.5, 0, 0, TAU); g.fill();
    g.scale(u.side ? -UNIT_SCALE : UNIT_SCALE, UNIT_SCALE); g.lineCap = 'round'; g.lineJoin = 'round';
    if (u.dead) { g.globalAlpha = Math.max(0, 1 - u.dead * 1.3); g.rotate(-Math.min(1.4, u.dead * 3)); }
    if (u.hit > 0) g.filter = 'brightness(1.9)';
    const K = u.age * 3 + u.kind;
    const pic = (u.side && img(`unit-${u.age}-${u.kind}-red`)) || img(`unit-${u.age}-${u.kind}`);
    if (pic) {
      // dodaný obrázek: houpání při chůzi a výpad při útoku; soupeři bez vlastní verze dostanou červený praporek
      const h = u.kind === 2 ? TOP[2][u.age] : TOP[u.kind], bob = Math.abs(Math.sin(walk)) * 2, lunge = Math.sin(a * Math.PI) * 6;
      g.save(); g.translate(lunge, -bob); g.rotate(Math.sin(walk) * 0.03); sprite(g, pic, 0, 0, h); g.restore();
      if (u.side && !img(`unit-${u.age}-${u.kind}-red`)) { g.fillStyle = tc; g.strokeStyle = OL; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-6, -h - 4); g.lineTo(-6, -h - 18); g.lineTo(6, -h - 14); g.lineTo(-6, -h - 10); g.stroke(); g.fill(); }
      g.filter = 'none'; g.restore(); return;
    }
    const skin = u.age === 4 ? '#e8c8a8' : u.age === 0 ? '#d89a68' : '#f0c49a';
    switch (K) {
      case 0: person(g, { walk, atk: a, skin, pants: skin, legsBare: true, boots: '#6a4428', shirt: '#9a6a3a',
        torso: q => { q.fillStyle = 'rgba(60,30,10,.45)'; for (const [x, y] of [[-5, -38], [3, -33], [-2, -28], [5, -42]]) { q.beginPath(); q.ellipse(x, y, 2.4, 1.6, 0.4, 0, TAU); q.fill(); } q.fillStyle = tc; q.fillRect(-9, -27, 20, 3.5); q.fillStyle = '#9a6a3a'; q.beginPath(); for (let i = 0; i < 6; i++) q.lineTo(-8 + i * 3.4, -23 + (i % 2) * 4); q.lineTo(10, -23); q.fill(); },
        head: (q, x, y) => { q.fillStyle = '#3a2410'; q.beginPath(); for (let i = 0; i <= 8; i++) { const an = Math.PI * (1.05 + i / 8 * 0.95), r = 9.5 + (i % 2) * 2.2; q.lineTo(x + Math.cos(an) * r - 1, y + Math.sin(an) * r - 1); } q.lineTo(x - 7, y + 4); q.closePath(); q.fill(); },
        beard: (q, x, y) => { q.fillStyle = '#3a2410'; q.beginPath(); q.moveTo(x - 2, y + 2); q.quadraticCurveTo(x + 2, y + 13, x + 8, y + 4); q.lineTo(x + 6, y + 3); q.quadraticCurveTo(x + 2, y + 6, x - 1, y + 1); q.fill(); },
        weapon: q => { fillOut(q, shade(q, 0, -4, 0, 4, '#a8743a', '#5a3a1a'), () => { q.beginPath(); q.moveTo(-2, -2.5); q.lineTo(14, -4.5); q.quadraticCurveTo(24, -8, 25, 0); q.quadraticCurveTo(24, 8, 14, 4.5); q.lineTo(-2, 2.5); q.closePath(); }, 1.6); q.fillStyle = 'rgba(60,30,10,.5)'; q.beginPath(); q.arc(18, -2, 1.6, 0, TAU); q.arc(21, 3, 1.3, 0, TAU); q.fill(); } }); break;
      case 1: person(g, { walk, atk: a, skin, pants: skin, legsBare: true, boots: '#6a4428', shirt: '#b8844a', aim: -1.0,
        torso: q => { q.strokeStyle = 'rgba(60,30,10,.5)'; q.lineWidth = 1; for (let i = -6; i < 8; i += 3) { q.beginPath(); q.moveTo(i, -44); q.lineTo(i + 1, -24); q.stroke(); } q.fillStyle = tc; q.fillRect(-9, -27, 20, 3); },
        head: (q, x, y) => { q.fillStyle = '#2a1a0a'; q.beginPath(); q.arc(x - 1, y - 2, 9, Math.PI * 1.02, Math.PI * 1.95); q.lineTo(x - 7, y + 3); q.fill(); q.fillStyle = tc; q.fillRect(x - 9, y - 5, 17, 3); q.fillStyle = '#fff'; q.beginPath(); q.moveTo(x - 8, y - 5); q.quadraticCurveTo(x - 14, y - 16, x - 9, y - 18); q.quadraticCurveTo(x - 9, y - 10, x - 6, y - 5); q.fill(); },
        weapon: q => { const s = t * 14; q.strokeStyle = '#8a6a4a'; q.lineWidth = 1.4; q.beginPath(); q.moveTo(0, 0); q.lineTo(Math.cos(s) * 13, Math.sin(s) * 13); q.stroke(); fillOut(q, '#9a9a9a', () => { q.beginPath(); q.arc(Math.cos(s) * 13, Math.sin(s) * 13, 3, 0, TAU); }, 1.2); } }); break;
      case 2: dino(g, walk, a, t, tc, () => person(g, { sit: true, walk: 0, atk: a, skin, pants: skin, legsBare: true, boots: '#6a4428', shirt: '#9a6a3a', aim: -0.25 + a * 0.4,
        torso: q => { q.fillStyle = tc; q.fillRect(-9, -27, 20, 3.5); }, head: (q, x, y) => { q.fillStyle = '#3a2410'; q.beginPath(); q.arc(x - 1, y - 2, 9.5, Math.PI, TAU); q.lineTo(x - 8, y + 3); q.fill(); },
        weapon: q => { limb(q, 2.4, '#6a4220', -10, 0, 30, 0); fillOut(q, '#a8a49a', () => { q.beginPath(); q.moveTo(30, -4); q.lineTo(39, 0); q.lineTo(30, 4); q.closePath(); }, 1.2); } })); break;
      case 3: person(g, { walk, atk: a, skin, pants: '#5a4a3a', boots: '#3a2a1a', shirt: '#9aa0aa', sleeve: '#8a909a',
        torso: q => { q.fillStyle = 'rgba(40,44,52,.35)'; for (let y = -45; y < -22; y += 3) for (let x = -10; x < 11; x += 3) { q.beginPath(); q.arc(x + (y % 2 ? 1.5 : 0), y, 0.9, 0, TAU); q.fill(); } q.fillStyle = tc; q.beginPath(); q.moveTo(-6, -43); q.lineTo(7, -43); q.lineTo(6, -22); q.lineTo(-5, -22); q.closePath(); q.fill(); q.fillStyle = '#fff'; q.fillRect(-0.5, -40, 2.4, 13); q.fillRect(-4, -36, 9, 2.4); q.fillStyle = '#5a3a1a'; q.fillRect(-9, -26, 20, 3); },
        head: (q, x, y) => { fillOut(q, shade(q, x - 9, y - 12, x + 9, y, '#d8dce4', '#7a7e88'), () => { q.beginPath(); q.moveTo(x - 9, y + 1); q.quadraticCurveTo(x - 10, y - 13, x, y - 13); q.quadraticCurveTo(x + 10, y - 13, x + 9, y - 1); q.lineTo(x + 9, y - 3); q.lineTo(x - 9, y - 3); q.closePath(); }, 1.6); fillOut(q, '#a8acb4', () => { q.beginPath(); q.rect(x + 3, y - 4, 2.2, 8); }, 1); },
        weapon: q => { fillOut(q, shade(q, 0, -2, 0, 2, '#f4f6fa', '#a8acb8'), () => { q.beginPath(); q.moveTo(3, -2); q.lineTo(26, -1.5); q.lineTo(29, 0); q.lineTo(26, 1.5); q.lineTo(3, 2); q.closePath(); }, 1.3); fillOut(q, '#c99a3a', () => { q.beginPath(); q.rect(1, -6, 3, 12); }, 1.2); fillOut(q, '#6a4220', () => { q.beginPath(); q.rect(-5, -1.5, 6, 3); }, 1); },
        shield: q => { fillOut(q, shade(q, 6, -44, 18, -20, tl, td), () => { q.beginPath(); q.moveTo(7, -44); q.lineTo(19, -44); q.quadraticCurveTo(20, -28, 13, -20); q.quadraticCurveTo(6, -28, 7, -44); q.closePath(); }, 1.8); q.fillStyle = '#ffe066'; q.beginPath(); q.moveTo(13, -40); q.lineTo(15, -34); q.lineTo(13, -27); q.lineTo(11, -34); q.closePath(); q.fill(); } }); break;
      case 4: person(g, { walk, atk: a, skin, pants: '#6a5a3a', boots: '#4a3220', shirt: '#4a7a3a', sleeve: '#3e6a32', aim: -0.08,
        back: q => { fillOut(q, '#6a4422', () => { q.beginPath(); q.save(); q.translate(-8, -40); q.rotate(-0.4); q.rect(-3, -6, 6, 20); q.restore(); }, 1.4); for (let i = 0; i < 3; i++) line(q, 1.2, '#fff', -10 + i * 2, -48 - i, -9 + i * 2, -43); },
        torso: q => { q.fillStyle = '#6a4a2a'; q.fillRect(-9, -27, 20, 3); q.strokeStyle = '#6a4422'; q.lineWidth = 2; q.beginPath(); q.moveTo(-8, -44); q.lineTo(8, -25); q.stroke(); q.fillStyle = tc; q.fillRect(-9, -45, 20, 3); },
        head: (q, x, y) => { fillOut(q, shade(q, x - 10, y - 12, x + 6, y + 6, '#5a8a4a', '#2e5a26'), () => { q.beginPath(); q.moveTo(x - 9, y + 6); q.quadraticCurveTo(x - 12, y - 10, x + 1, y - 15); q.quadraticCurveTo(x + 9, y - 10, x + 9, y - 4); q.quadraticCurveTo(x + 2, y - 8, x - 3, y + 2); q.lineTo(x - 5, y + 8); q.closePath(); }, 1.6); },
        weapon: q => { q.strokeStyle = '#6a4220'; q.lineWidth = 2.6; q.beginPath(); q.arc(-1, 0, 15, -1.25, 1.25); q.stroke(); q.strokeStyle = '#3a2410'; q.lineWidth = 1; q.beginPath(); q.arc(-1, 0, 15, -1.25, 1.25); q.stroke(); const d = 4 + a * 8; q.strokeStyle = '#eee'; q.lineWidth = 0.8; q.beginPath(); q.moveTo(-1 + Math.cos(-1.25) * 15, Math.sin(-1.25) * 15); q.lineTo(-d, 0); q.lineTo(-1 + Math.cos(1.25) * 15, Math.sin(1.25) * 15); q.stroke(); if (a < 0.5) { line(q, 1.4, '#6a4220', -d, 0, 18, 0); q.fillStyle = '#c8ccd4'; q.beginPath(); q.moveTo(18, -2.5); q.lineTo(23, 0); q.lineTo(18, 2.5); q.fill(); } } }); break;
      case 5: horse(g, walk, a, t, tc, td, () => person(g, { sit: true, walk: 0, atk: a, skin, pants: '#8a909a', boots: '#5a5e66', shirt: '#a8acb4', sleeve: '#9aa0aa', aim: 0.02 + a * 0.15,
        torso: q => { q.fillStyle = tc; q.beginPath(); q.moveTo(-6, -43); q.lineTo(7, -43); q.lineTo(6, -22); q.lineTo(-5, -22); q.closePath(); q.fill(); q.fillStyle = '#ffe066'; q.beginPath(); q.arc(0.5, -33, 3, 0, TAU); q.fill(); },
        head: (q, x, y) => { fillOut(q, shade(q, x - 9, y - 12, x + 9, y + 8, '#e4e8ee', '#7a7e88'), () => { q.beginPath(); q.roundRect(x - 9, y - 12, 18, 21, 5); }, 1.6); q.fillStyle = OL; q.fillRect(x + 1, y - 3, 8, 2); q.fillRect(x + 1, y + 1, 7, 1.2); fillOut(q, tc, () => { q.beginPath(); q.moveTo(x - 2, y - 12); q.quadraticCurveTo(x - 12, y - 26 + Math.sin(t * 8), x - 20, y - 16); q.quadraticCurveTo(x - 10, y - 16, x - 2, y - 10); q.closePath(); }, 1.2); },
        weapon: q => { limb(q, 3, '#d8c8a0', -14, 0, 44, 0); fillOut(q, '#c8ccd4', () => { q.beginPath(); q.moveTo(44, -3.5); q.lineTo(54, 0); q.lineTo(44, 3.5); q.closePath(); }, 1.2); q.fillStyle = tc; q.beginPath(); q.moveTo(30, 0); q.lineTo(38, -6 + Math.sin(t * 9) * 1.5); q.lineTo(30, -5); q.fill(); } })); break;
      case 6: person(g, { walk, atk: a, skin, pants: '#3a2a4a', boots: '#2a1a14', shirt: tc, sleeve: td, aim: 0.15 + Math.sin(a * Math.PI) * -0.7,
        back: q => { fillOut(q, td, () => { q.beginPath(); q.moveTo(-8, -44); q.quadraticCurveTo(-18 - Math.sin(t * 4) * 2, -30, -14, -16); q.lineTo(-6, -22); q.closePath(); }, 1.4); },
        torso: q => { q.fillStyle = '#fff'; q.beginPath(); q.moveTo(-6, -45); q.lineTo(9, -45); q.lineTo(5, -40); q.lineTo(-3, -40); q.closePath(); q.fill(); q.fillStyle = '#ffe066'; for (let y = -38; y < -24; y += 4) { q.beginPath(); q.arc(2, y, 1, 0, TAU); q.fill(); } q.strokeStyle = '#ffe066'; q.lineWidth = 2.2; q.beginPath(); q.moveTo(-8, -44); q.lineTo(9, -25); q.stroke(); },
        head: (q, x, y) => { q.fillStyle = '#4a2a14'; q.beginPath(); q.arc(x - 2, y, 8.5, Math.PI * 0.6, Math.PI * 1.4); q.fill(); fillOut(q, '#2a2a3a', () => { q.beginPath(); q.ellipse(x, y - 7, 15, 3.6, -0.1, 0, TAU); }, 1.4); fillOut(q, '#2a2a3a', () => { q.beginPath(); q.ellipse(x, y - 10, 8, 5, 0, Math.PI, TAU); }, 1.4); q.strokeStyle = '#fff'; q.lineWidth = 3; q.beginPath(); q.moveTo(x - 4, y - 12); q.quadraticCurveTo(x - 14, y - 22, x - 20, y - 12); q.stroke(); q.strokeStyle = tl; q.lineWidth = 1.4; q.stroke(); },
        weapon: q => { line(q, 1.4, '#f4f6fa', 2, 0, 34, 0); fillOut(q, '#c99a3a', () => { q.beginPath(); q.arc(2, 0, 4, -1.6, 1.6); q.closePath(); }, 1.2); } }); break;
      case 7: person(g, { walk, atk: a, skin, pants: '#e8e4da', boots: '#1a1210', shirt: tc, sleeve: td, aim: -0.05,
        torso: q => { q.fillStyle = mix(tc, '#ffffff', 0.5); q.beginPath(); q.moveTo(-1, -45); q.lineTo(6, -45); q.lineTo(3, -24); q.lineTo(0, -24); q.closePath(); q.fill(); q.fillStyle = '#ffe066'; for (let y = -40; y < -24; y += 4) { q.beginPath(); q.arc(4.5, y, 1, 0, TAU); q.fill(); } q.strokeStyle = '#fff'; q.lineWidth = 2.2; q.beginPath(); q.moveTo(-8, -44); q.lineTo(9, -25); q.moveTo(9, -44); q.lineTo(-8, -25); q.stroke(); },
        head: (q, x, y) => { q.fillStyle = '#f4f4f0'; q.beginPath(); q.arc(x - 3, y + 1, 7.5, Math.PI * 0.55, Math.PI * 1.45); q.fill(); fillOut(q, '#1a1a24', () => { q.beginPath(); q.moveTo(x - 12, y - 6); q.lineTo(x, y - 17); q.lineTo(x + 11, y - 6); q.quadraticCurveTo(x, y - 9, x - 12, y - 6); q.closePath(); }, 1.4); q.strokeStyle = '#ffe066'; q.lineWidth = 1; q.beginPath(); q.moveTo(x - 11, y - 6.5); q.quadraticCurveTo(x, y - 9.5, x + 10, y - 6.5); q.stroke(); },
        weapon: q => { fillOut(q, '#7a4a24', () => { q.beginPath(); q.moveTo(-8, -1); q.lineTo(14, -2); q.lineTo(14, 2); q.lineTo(-6, 4); q.closePath(); }, 1.2); fillOut(q, '#3a3a44', () => { q.beginPath(); q.rect(12, -2, 22, 3); }, 1.1); line(q, 1, '#c8ccd4', 34, -0.5, 42, -0.5); if (a > 0.6) { q.fillStyle = 'rgba(255,220,120,.95)'; q.beginPath(); q.arc(37, -0.5, 4.5, 0, TAU); q.fill(); q.fillStyle = 'rgba(230,230,230,.75)'; for (let i = 0; i < 3; i++) { q.beginPath(); q.arc(42 + i * 5, -3 - i * 2, 4 + i, 0, TAU); q.fill(); } } } }); break;
      case 8: cannon(g, walk, a, t, tc, td, skin); break;
      case 9: person(g, { walk, atk: a, skin, pants: '#5a6a3a', boots: '#2a2a20', shirt: '#6a7a44', sleeve: '#5a6a3a',
        torso: q => { q.fillStyle = 'rgba(40,50,24,.55)'; for (const [x, y, r] of [[-5, -40, 3], [4, -33, 3.5], [-3, -28, 2.5], [6, -42, 2]]) { q.beginPath(); q.ellipse(x, y, r, r * 0.7, 0.5, 0, TAU); q.fill(); } q.fillStyle = '#4a4a32'; q.fillRect(-9, -40, 20, 12); q.fillStyle = tc; q.fillRect(-9, -44, 20, 2.5); q.fillStyle = '#3a3a24'; q.fillRect(-9, -27, 20, 3); },
        head: (q, x, y) => { fillOut(q, shade(q, x - 10, y - 12, x + 10, y, '#7a8a4a', '#3e4a24'), () => { q.beginPath(); q.moveTo(x - 10, y - 2); q.quadraticCurveTo(x - 10, y - 14, x, y - 14); q.quadraticCurveTo(x + 10, y - 14, x + 10, y - 2); q.closePath(); }, 1.6); q.strokeStyle = 'rgba(30,36,16,.6)'; q.lineWidth = 0.8; for (let i = -8; i < 10; i += 3) { q.beginPath(); q.moveTo(x + i, y - 13); q.lineTo(x + i + 3, y - 3); q.stroke(); } },
        weapon: q => { fillOut(q, shade(q, 0, -2, 0, 2, '#f4f6fa', '#9aa0aa'), () => { q.beginPath(); q.moveTo(4, -2); q.lineTo(16, -1); q.lineTo(19, 0.5); q.lineTo(4, 2); q.closePath(); }, 1.2); fillOut(q, '#2a2a24', () => { q.beginPath(); q.rect(-3, -2, 7, 4); }, 1); } }); break;
      case 10: person(g, { walk, atk: a, skin, pants: '#5a6a3a', boots: '#2a2a20', shirt: '#6a7a44', sleeve: '#5a6a3a', aim: -0.03,
        back: q => { fillOut(q, '#4a5a32', () => { q.beginPath(); q.roundRect(-16, -44, 9, 18, 3); }, 1.4); },
        torso: q => { q.fillStyle = 'rgba(40,50,24,.55)'; for (const [x, y, r] of [[-5, -40, 3], [4, -33, 3.5], [-3, -28, 2.5]]) { q.beginPath(); q.ellipse(x, y, r, r * 0.7, 0.5, 0, TAU); q.fill(); } q.fillStyle = tc; q.fillRect(-9, -44, 20, 2.5); q.fillStyle = '#3a3a24'; q.fillRect(-9, -27, 20, 3); },
        head: (q, x, y) => { fillOut(q, shade(q, x - 10, y - 12, x + 10, y, '#7a8a4a', '#3e4a24'), () => { q.beginPath(); q.moveTo(x - 10, y - 2); q.quadraticCurveTo(x - 10, y - 14, x, y - 14); q.quadraticCurveTo(x + 10, y - 14, x + 10, y - 2); q.closePath(); }, 1.6); },
        weapon: q => { fillOut(q, '#2a2a2a', () => { q.beginPath(); q.moveTo(-8, -2); q.lineTo(30, -2); q.lineTo(30, 1); q.lineTo(8, 1.5); q.lineTo(8, 6); q.lineTo(4, 6); q.lineTo(3, 2); q.lineTo(-8, 3); q.closePath(); }, 1.2); fillOut(q, '#3a3a3a', () => { q.beginPath(); q.rect(8, -6, 9, 3); }, 1); if (a > 0.5 && Math.sin(t * 60) > 0) { q.fillStyle = '#ffe066'; q.beginPath(); q.moveTo(30, -4); q.lineTo(40, 0); q.lineTo(30, 3); q.closePath(); q.fill(); } } }); break;
      case 11: tank(g, walk, a, t, tc); break;
      case 12: person(g, { walk, atk: a, skin, pants: '#4a4a6a', boots: '#2a2a3a', shirt: '#8a92b0', sleeve: '#6a7090',
        torso: q => { q.fillStyle = 'rgba(255,255,255,.2)'; q.fillRect(-9, -44, 4, 20); q.strokeStyle = tc; q.lineWidth = 1.6; q.shadowColor = tc; q.shadowBlur = 6; q.beginPath(); q.moveTo(-8, -38); q.lineTo(10, -38); q.moveTo(1, -38); q.lineTo(1, -24); q.stroke(); q.shadowBlur = 0; },
        head: (q, x, y) => { fillOut(q, shade(q, x - 9, y - 11, x + 9, y + 9, '#c8d0e8', '#5a6288'), () => { q.beginPath(); q.ellipse(x, y - 1, 9.5, 10.5, 0, 0, TAU); }, 1.6); q.fillStyle = '#5ad8ff'; q.shadowColor = '#5ad8ff'; q.shadowBlur = 8; q.beginPath(); q.roundRect(x - 1, y - 4, 10, 4, 2); q.fill(); q.shadowBlur = 0; },
        weapon: q => { q.shadowColor = '#5affe8'; q.shadowBlur = 10; q.fillStyle = `rgba(150,255,240,${0.75 + 0.25 * Math.sin(t * 20)})`; q.beginPath(); q.roundRect(4, -2, 30, 4, 2); q.fill(); q.shadowBlur = 0; q.fillStyle = '#fff'; q.fillRect(5, -0.6, 28, 1.2); fillOut(q, '#4a4a6a', () => { q.beginPath(); q.rect(-2, -3, 7, 6); }, 1); } }); break;
      case 13: person(g, { walk, atk: a, skin, pants: '#2a3a6a', boots: '#1a1a2a', shirt: '#3a4a8a', sleeve: '#2a3a6a', aim: -0.03,
        torso: q => { q.fillStyle = 'rgba(255,255,255,.18)'; q.fillRect(-9, -44, 5, 20); q.strokeStyle = tc; q.lineWidth = 1.6; q.shadowColor = tc; q.shadowBlur = 6; q.beginPath(); q.moveTo(-8, -40); q.lineTo(10, -30); q.stroke(); q.shadowBlur = 0; },
        head: (q, x, y) => { fillOut(q, shade(q, x - 9, y - 11, x + 9, y + 9, '#6a7ab8', '#2a3460'), () => { q.beginPath(); q.ellipse(x, y - 1, 9.5, 10.5, 0, 0, TAU); }, 1.6); q.fillStyle = '#ffd23f'; q.shadowColor = '#ffd23f'; q.shadowBlur = 8; q.beginPath(); q.roundRect(x - 2, y - 4, 11, 4, 2); q.fill(); q.shadowBlur = 0; },
        weapon: q => { fillOut(q, shade(q, 0, -4, 0, 5, '#e4e8f4', '#8a92b0'), () => { q.beginPath(); q.moveTo(-6, -3); q.lineTo(26, -3); q.lineTo(28, 0); q.lineTo(26, 3); q.lineTo(6, 3); q.lineTo(4, 7); q.lineTo(0, 7); q.lineTo(-6, 3); q.closePath(); }, 1.2); q.fillStyle = '#5ad8ff'; q.fillRect(6, -1.5, 14, 3); if (a > 0.5) { q.fillStyle = 'rgba(90,216,255,.9)'; q.shadowColor = '#5ad8ff'; q.shadowBlur = 12; q.beginPath(); q.arc(30, 0, 5, 0, TAU); q.fill(); q.shadowBlur = 0; } } }); break;
      default: mech(g, walk, a, t, tc);
    }
    g.filter = 'none';
    g.restore();
  }

  function dino(g, walk, a, t, tc, rider) {
    const st = Math.sin(walk) * 6, bob = Math.abs(Math.sin(walk)) * 1.5;
    const leg = (x, d, back) => { const c = back ? '#2e6a28' : '#3e8a36'; limb(g, 9, c, x, -34, x + d * 0.6, -18); limb(g, 7, c, x + d * 0.6, -18, x + d, 0); fillOut(g, c, () => { g.beginPath(); g.ellipse(x + d + 4, -1, 7, 3, 0, 0, TAU); }, 1.4); };
    leg(-6, -st, true);
    g.save(); g.translate(0, -bob);
    // tělo, ocas a krk tyranosaura
    fillOut(g, shade(g, -40, -70, 40, -20, '#7ac85a', '#2e7a2a'), () => { g.beginPath(); g.moveTo(-58, -48 + Math.sin(t * 3) * 3); g.quadraticCurveTo(-30, -62, 0, -60); g.quadraticCurveTo(18, -64, 26, -74); g.quadraticCurveTo(32, -86, 50, -84); g.quadraticCurveTo(62, -82, 62, -72); g.lineTo(58, -66); g.lineTo(46, -66); g.quadraticCurveTo(38, -62, 30, -50); g.quadraticCurveTo(20, -30, -4, -30); g.quadraticCurveTo(-30, -32, -58, -48 + Math.sin(t * 3) * 3); g.closePath(); }, 2.2);
    g.fillStyle = 'rgba(30,80,20,.45)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(-36 + i * 10, -54 + Math.abs(i - 3), 3, 6, 0.3, 0, TAU); g.fill(); }
    g.fillStyle = '#c8e8a0'; g.beginPath(); g.ellipse(4, -36, 18, 5, -0.15, 0, TAU); g.fill();
    // čelist s zuby
    const jaw = a > 0.2 ? a * 6 : 0;
    fillOut(g, '#5aaa48', () => { g.beginPath(); g.moveTo(44, -66); g.lineTo(62, -66 + jaw * 0.3); g.quadraticCurveTo(60, -58 + jaw, 46, -58 + jaw * 0.5); g.closePath(); }, 1.6);
    g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(47 + i * 4, -66); g.lineTo(48.5 + i * 4, -62); g.lineTo(50 + i * 4, -66); g.fill(); }
    g.fillStyle = '#ffe066'; g.beginPath(); g.ellipse(50, -77, 3, 2.6, 0, 0, TAU); g.fill(); g.fillStyle = OL; g.beginPath(); g.ellipse(51, -77, 1.2, 2, 0, 0, TAU); g.fill();
    line(g, 2, OL, 46, -81, 54, -80);
    limb(g, 3.5, '#3e8a36', 30, -54, 36, -46, 40, -48);
    // sedlo v barvě týmu
    fillOut(g, tc, () => { g.beginPath(); g.roundRect(-16, -66, 24, 8, 3); }, 1.4);
    g.save(); g.translate(-6, -64 + 24 * 0.85); g.scale(0.85, 0.85); rider(); g.restore();
    g.restore();
    leg(8, st, false);
  }
  function horse(g, walk, a, t, tc, td, rider) {
    const st = Math.sin(walk) * 7;
    const leg = (x, d, back) => { const c = back ? '#5a3a1e' : '#7a4e2a'; limb(g, 5, c, x, -30, x + d * 0.5, -15); limb(g, 4, c, x + d * 0.5, -15, x + d, -2); fillOut(g, '#2a1a10', () => { g.beginPath(); g.rect(x + d - 3, -3, 6, 3.5); }, 1); };
    leg(-22, -st, true); leg(16, st, true);
    fillOut(g, shade(g, -30, -50, 30, -24, '#a8703e', '#6a4422'), () => { g.beginPath(); g.ellipse(-2, -38, 30, 12, 0, 0, TAU); }, 2);
    fillOut(g, shade(g, 20, -70, 40, -30, '#a8703e', '#6a4422'), () => { g.beginPath(); g.moveTo(18, -46); g.lineTo(30, -66); g.quadraticCurveTo(42, -74, 48, -62); g.lineTo(46, -56); g.lineTo(36, -54); g.lineTo(30, -36); g.closePath(); }, 2);
    g.fillStyle = '#3a2410'; g.beginPath(); g.moveTo(30, -66); g.quadraticCurveTo(22, -60, 20, -46); g.lineTo(24, -48); g.quadraticCurveTo(26, -60, 33, -64); g.fill();
    g.fillStyle = OL; g.beginPath(); g.arc(40, -64, 1.6, 0, TAU); g.fill();
    line(g, 3, '#3a2410', -32, -40, -42, -26 + Math.sin(t * 5) * 3);
    // čabraka v barvě týmu s okrajem
    fillOut(g, shade(g, -28, -50, 20, -20, tc, td), () => { g.beginPath(); g.moveTo(-28, -46); g.lineTo(16, -46); g.lineTo(18, -24); for (let i = 0; i <= 6; i++) g.lineTo(18 - i * 7.6, -24 + (i % 2) * 4); g.closePath(); }, 1.6);
    g.fillStyle = '#ffe066'; g.fillRect(-28, -46, 44, 2.5); g.beginPath(); g.arc(-6, -36, 4, 0, TAU); g.fill();
    leg(-18, st, false); leg(20, -st, false);
    g.save(); g.translate(-8, -46 + 24 * 0.82); g.scale(0.82, 0.82); rider(); g.restore();
  }
  function cannon(g, walk, a, t, tc, td, skin) {
    // dělostřelec vzadu s nabijákem
    g.save(); g.translate(-30, 0); person(g, { walk: walk * 0.5, atk: 0, skin, pants: '#e8e4da', boots: '#1a1210', shirt: tc, sleeve: td, aim: -0.6,
      head: (q, x, y) => { fillOut(q, '#1a1a24', () => { q.beginPath(); q.moveTo(x - 12, y - 6); q.lineTo(x, y - 17); q.lineTo(x + 11, y - 6); q.closePath(); }, 1.4); },
      weapon: q => { limb(q, 2, '#8a5a2a', -6, 0, 26, 0); fillOut(q, '#5a3a1a', () => { q.beginPath(); q.rect(24, -3, 6, 6); }, 1); } }); g.restore();
    // lafeta a bronzová hlaveň
    fillOut(g, shade(g, -12, -24, 30, -6, '#9a6a3a', '#5a3a1a'), () => { g.beginPath(); g.moveTo(-14, -6); g.lineTo(24, -20); g.lineTo(28, -14); g.lineTo(-10, 0); g.closePath(); }, 1.8);
    g.save(); g.translate(8, -22); g.rotate(-0.16 - a * 0.1);
    fillOut(g, shade(g, 0, -9, 0, 9, '#f2c86a', '#8a5a1a'), () => { g.beginPath(); g.moveTo(-14, -8); g.quadraticCurveTo(-20, 0, -14, 8); g.lineTo(34 - a * 5, 5); g.lineTo(34 - a * 5, -5); g.closePath(); }, 2);
    for (const x of [-4, 14, 28]) fillOut(g, '#c8963a', () => { g.beginPath(); g.rect(x - a * 5 * (x > 20), -7, 3, 14); }, 1);
    g.fillStyle = OL; g.beginPath(); g.ellipse(35 - a * 5, 0, 1.6, 4, 0, 0, TAU); g.fill();
    g.restore();
    const wheel = x => { fillOut(g, '#7a5432', () => { g.beginPath(); g.arc(x, -11, 11, 0, TAU); }, 2); g.strokeStyle = '#4a3220'; g.lineWidth = 2; for (let k = 0; k < 6; k++) { const an = walk * 0.6 + k * Math.PI / 6; g.beginPath(); g.moveTo(x - Math.cos(an) * 9, -11 - Math.sin(an) * 9); g.lineTo(x + Math.cos(an) * 9, -11 + Math.sin(an) * 9); g.stroke(); } fillOut(g, '#3a3a44', () => { g.beginPath(); g.arc(x, -11, 3, 0, TAU); }, 1); };
    wheel(6);
    if (a > 0.7) { g.fillStyle = 'rgba(255,200,100,.95)'; g.beginPath(); g.arc(46, -34, 8, 0, TAU); g.fill(); g.fillStyle = 'rgba(220,220,220,.7)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(54 + i * 7, -38 - i * 4, 7 + i * 2, 0, TAU); g.fill(); } }
  }
  function tank(g, walk, a, t, tc) {
    fillOut(g, shade(g, 0, -20, 0, 0, '#5a5a48', '#2a2a22'), () => { g.beginPath(); g.roundRect(-40, -18, 80, 18, 9); }, 2.2);
    for (let i = 0; i < 7; i++) fillOut(g, '#4a4a3a', () => { g.beginPath(); g.arc(-31 + i * 10.3, -9, 5.5, 0, TAU); }, 1.2);
    g.strokeStyle = '#7a7a6a'; g.lineWidth = 1.4; for (let i = 0; i < 16; i++) { const px = -40 + ((i * 5 + walk * 6) % 80); g.beginPath(); g.moveTo(px, -18); g.lineTo(px, -15.5); g.moveTo(px, -2.5); g.lineTo(px, 0); g.stroke(); }
    fillOut(g, shade(g, 0, -34, 0, -16, '#7a8a54', '#4a5a32'), () => { g.beginPath(); g.moveTo(-36, -18); g.lineTo(-28, -32); g.lineTo(30, -32); g.lineTo(38, -18); g.closePath(); }, 2);
    g.fillStyle = 'rgba(40,50,24,.5)'; for (const [x, y, r] of [[-18, -25, 5], [6, -27, 4], [20, -23, 4]]) { g.beginPath(); g.ellipse(x, y, r, r * 0.6, 0.3, 0, TAU); g.fill(); }
    g.save(); g.translate(14, -42); g.rotate(-0.04); fillOut(g, '#5a6a3a', () => { g.beginPath(); g.rect(0, -3, 42 - a * 6, 6); }, 1.6); fillOut(g, '#4a5a32', () => { g.beginPath(); g.rect(40 - a * 6, -4, 6, 8); }, 1.2); g.restore();
    fillOut(g, shade(g, 0, -50, 0, -32, '#8a9a5a', '#4a5a32'), () => { g.beginPath(); g.moveTo(-18, -32); g.lineTo(-14, -48); g.lineTo(14, -50); g.lineTo(22, -40); g.lineTo(20, -32); g.closePath(); }, 2);
    fillOut(g, '#4a5a32', () => { g.beginPath(); g.ellipse(-2, -51, 7, 3, 0, 0, TAU); }, 1.4);
    g.fillStyle = tc; g.fillRect(-12, -42, 14, 6); g.fillStyle = '#fff'; g.font = '700 6px Space Grotesk, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('07', -5, -38.8);
    limb(g, 1, '#3a3a2a', -10, -50, -14, -66);
    if (a > 0.75) { g.fillStyle = 'rgba(255,210,110,.95)'; g.beginPath(); g.arc(62, -42, 8, 0, TAU); g.fill(); g.fillStyle = 'rgba(200,200,200,.6)'; g.beginPath(); g.arc(70, -46, 9, 0, TAU); g.fill(); }
  }
  function mech(g, walk, a, t, tc) {
    const st = Math.sin(walk) * 7;
    const leg = (x, d, back) => { const c = back ? '#4a4a6a' : '#6a6a90'; limb(g, 9, c, x, -46, x + d * 0.4 + 4, -24); limb(g, 7, c, x + d * 0.4 + 4, -24, x + d, -4); fillOut(g, '#3a3a5a', () => { g.beginPath(); g.roundRect(x + d - 8, -6, 18, 6, 2); }, 1.4); };
    leg(-8, -st, true);
    fillOut(g, shade(g, -24, -96, 24, -44, '#b8c0e0', '#4a5078'), () => { g.beginPath(); g.moveTo(-22, -46); g.lineTo(-26, -82); g.lineTo(-14, -96); g.lineTo(18, -96); g.lineTo(28, -82); g.lineTo(22, -46); g.closePath(); }, 2.4);
    g.strokeStyle = tc; g.lineWidth = 2.2; g.shadowColor = tc; g.shadowBlur = 8; g.beginPath(); g.moveTo(-20, -60); g.lineTo(22, -60); g.stroke(); g.shadowBlur = 0;
    g.fillStyle = `rgba(90,216,255,${0.6 + 0.4 * Math.sin(t * 6)})`; g.shadowColor = '#5ad8ff'; g.shadowBlur = 12; g.beginPath(); g.arc(0, -76, 7, 0, TAU); g.fill(); g.shadowBlur = 0;
    fillOut(g, '#5a5a8a', () => { g.beginPath(); g.roundRect(-8, -108, 24, 14, 5); }, 1.8); g.fillStyle = '#ff5a5a'; g.shadowColor = '#ff5a5a'; g.shadowBlur = 8; g.fillRect(4, -104, 10, 4); g.shadowBlur = 0;
    g.save(); g.translate(22, -78); g.rotate(-0.04); fillOut(g, shade(g, 0, -8, 0, 8, '#8a92b0', '#3a3a5a'), () => { g.beginPath(); g.roundRect(0, -7, 40 - a * 5, 14, 4); }, 1.8); g.fillStyle = '#5ad8ff'; g.shadowColor = '#5ad8ff'; g.shadowBlur = 10; g.fillRect(34 - a * 5, -3, 8, 6); g.shadowBlur = 0; g.restore();
    leg(10, st, false);
  }

  // ── Krajina ── vykreslí se jednou na celou šířku bojiště
  const SKY = [['#ff8a4a', '#ffd9a0'], ['#4a98f0', '#cfe9ff'], ['#e8a24a', '#fff0c8'], ['#6a7484', '#c8ccd4'], ['#1a0e4a', '#8a4ac8']];
  function land(W, H, age, gy) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const bg = img(`bg-${age}`);
    if (bg) { g.drawImage(bg, 0, 0, W, H); return c; }
    let s = 7 + age * 13; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.fillStyle = shade(g, 0, 0, 0, gy, SKY[age][0], SKY[age][1]); g.fillRect(0, 0, W, gy);
    // nebeská tělesa a mraky
    if (age === 4) { for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; g.beginPath(); g.arc(r() * W, r() * gy * 0.7, r() * 1.4 + 0.3, 0, TAU); g.fill(); } for (const [x, y, rr, col] of [[W * 0.2, 70, 34, '#ffb0e8'], [W * 0.72, 50, 18, '#9ae8ff']]) { const pg = g.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 2, x, y, rr); pg.addColorStop(0, '#fff'); pg.addColorStop(1, col); g.fillStyle = pg; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); } g.strokeStyle = 'rgba(255,200,255,.4)'; g.lineWidth = 3; g.beginPath(); g.ellipse(W * 0.2, 70, 56, 10, -0.3, 0, TAU); g.stroke(); }
    else { const sx = W * (age === 0 ? 0.55 : age === 3 ? 0.3 : 0.75), sy = age === 0 ? 90 : 70, sun = g.createRadialGradient(sx, sy, 4, sx, sy, 120); sun.addColorStop(0, age === 3 ? 'rgba(255,255,240,.55)' : 'rgba(255,250,220,1)'); sun.addColorStop(0.2, age === 3 ? 'rgba(255,255,240,.25)' : 'rgba(255,240,180,.75)'); sun.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = sun; g.fillRect(sx - 120, sy - 120, 240, 240); }
    for (let i = 0; i < 12; i++) { const cx = r() * W, cy = 24 + r() * 90, k = 0.7 + r() * 0.9; g.fillStyle = age === 3 ? 'rgba(90,94,104,.55)' : age === 4 ? 'rgba(200,140,255,.12)' : age === 0 ? 'rgba(255,230,200,.7)' : 'rgba(255,255,255,.85)'; g.beginPath(); for (const [dx, dy, rr] of [[0, 0, 24], [26, -9, 20], [50, 2, 18], [-24, 5, 16], [72, 6, 13]]) { g.moveTo(cx + dx * k + rr * k, cy + dy * k); g.arc(cx + dx * k, cy + dy * k, rr * k, 0, TAU); } g.fill(); }
    // vzdálená vrstva
    const far = (col, base, amp, step, seed) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, gy); for (let x = 0; x <= W; x += step) g.lineTo(x, gy - base - Math.sin(x * 0.005 + seed) * amp - Math.sin(x * 0.017 + seed * 2) * amp * 0.4); g.lineTo(W, gy); g.fill(); };
    if (age === 0) {
      far('#c8785a', 110, 40, 30, 1);
      // sopka s kouřem a lávou
      const vx = W * 0.45; g.fillStyle = '#7a4a3a'; g.beginPath(); g.moveTo(vx - 240, gy); g.lineTo(vx - 50, gy - 200); g.lineTo(vx + 50, gy - 200); g.lineTo(vx + 240, gy); g.fill();
      g.fillStyle = '#ff6a2a'; g.beginPath(); g.moveTo(vx - 46, gy - 198); g.quadraticCurveTo(vx - 20, gy - 150, vx - 40, gy - 90); g.lineTo(vx - 30, gy - 90); g.quadraticCurveTo(vx - 8, gy - 150, vx - 30, gy - 198); g.fill();
      for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(80,70,70,${0.5 - i * 0.06})`; g.beginPath(); g.arc(vx + i * 14, gy - 220 - i * 26, 26 + i * 6, 0, TAU); g.fill(); }
      far('#a8603e', 60, 22, 24, 3);
      for (let i = 0; i < 18; i++) { const x = r() * W, sc = 0.8 + r() * 0.9; g.strokeStyle = '#4a3218'; g.lineWidth = 4 * sc; g.beginPath(); g.moveTo(x, gy - 10); g.quadraticCurveTo(x + 6, gy - 50 * sc, x + 2, gy - 80 * sc); g.stroke(); g.fillStyle = '#4a8a2a'; for (let k = 0; k < 6; k++) { g.save(); g.translate(x + 2, gy - 80 * sc); g.rotate(-2.4 + k * 0.6); g.beginPath(); g.ellipse(20 * sc, 0, 22 * sc, 5 * sc, 0, 0, TAU); g.fill(); g.restore(); } }
      for (let i = 0; i < 3; i++) { const x = 300 + i * 520 + r() * 100; g.strokeStyle = '#e8dcc8'; g.lineWidth = 4; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + k * 12, gy - 4, 16 - k, Math.PI, TAU); g.stroke(); } g.fillStyle = '#e8dcc8'; g.beginPath(); g.ellipse(x - 12, gy - 10, 12, 8, 0, 0, TAU); g.fill(); }
    } else if (age === 1) {
      far('#7a9ac0', 120, 50, 40, 2);
      for (let i = 0; i < 3; i++) { const x = 200 + i * 640 + r() * 160, y = gy - 140 - r() * 30; g.fillStyle = '#8aa0b8'; g.fillRect(x, y, 70, 60); for (let k = 0; k < 5; k++) g.fillRect(x + k * 15, y - 8, 9, 8); g.fillRect(x + 50, y - 40, 24, 40); for (let k = 0; k < 2; k++) g.fillRect(x + 50 + k * 14, y - 48, 9, 8); g.fillStyle = TEAM[i % 2]; g.fillRect(x + 62, y - 70, 14, 9); }
      far('#5a8a4a', 60, 26, 26, 4);
      for (let i = 0; i < 2; i++) { const x = 500 + i * 820, y = gy - 70; g.fillStyle = '#e8dcc8'; g.beginPath(); g.moveTo(x - 14, y + 50); g.lineTo(x - 8, y); g.lineTo(x + 8, y); g.lineTo(x + 14, y + 50); g.fill(); g.fillStyle = '#8a4a2a'; g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x, y - 14); g.lineTo(x + 12, y); g.fill(); g.strokeStyle = '#6a4a2a'; g.lineWidth = 4; for (let k = 0; k < 4; k++) { const an = 0.4 + k * Math.PI / 2; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x + Math.cos(an) * 40, y + 4 + Math.sin(an) * 40); g.stroke(); } }
      for (let i = 0; i < 14; i++) { const x = r() * W, sc = 0.7 + r() * 0.7; g.fillStyle = '#3e6a2a'; g.beginPath(); g.moveTo(x, gy - 12 - 60 * sc); g.lineTo(x + 18 * sc, gy - 12); g.lineTo(x - 18 * sc, gy - 12); g.fill(); g.fillStyle = '#4a3220'; g.fillRect(x - 2, gy - 14, 4, 6); }
    } else if (age === 2) {
      far('#c8a070', 100, 36, 34, 5);
      for (let i = 0; i < 9; i++) { const x = 60 + i * 200 + r() * 60, hh = 40 + r() * 30, y = gy - 30 - hh; g.fillStyle = ['#e8d0a8', '#d8b890', '#f0e0c0'][i % 3]; g.fillRect(x, y, 50, hh + 30); g.fillStyle = ['#b04a3a', '#9a3a2a', '#c85a3a'][i % 3]; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 25, y - 26); g.lineTo(x + 56, y); g.fill(); g.fillStyle = '#5a4a6a'; for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) g.fillRect(x + 8 + k * 22, y + 10 + j * 22, 10, 12); if (i === 4) { g.fillStyle = '#f0e0c0'; g.fillRect(x + 14, y - 80, 22, 80); g.fillStyle = '#5a7aa0'; g.beginPath(); g.moveTo(x + 10, y - 80); g.lineTo(x + 25, y - 120); g.lineTo(x + 40, y - 80); g.fill(); g.fillStyle = '#ffd23f'; g.fillRect(x + 24, y - 132, 2, 12); g.fillRect(x + 20, y - 128, 10, 2); } }
      far('#7aa04a', 30, 14, 26, 6);
    } else if (age === 3) {
      far('#8a8e98', 90, 30, 40, 7);
      for (let i = 0; i < 22; i++) { const x = i * 84 + r() * 40, hh = 60 + r() * 120, ww = 40 + r() * 30; g.fillStyle = `rgb(${70 + r() * 20},${74 + r() * 20},${84 + r() * 20})`; g.beginPath(); g.moveTo(x, gy - 20); g.lineTo(x, gy - 20 - hh); for (let k = 0; k <= 4; k++) g.lineTo(x + k * ww / 4, gy - 20 - hh + (r() < 0.4 ? r() * 24 : 0)); g.lineTo(x + ww, gy - 20); g.fill(); g.fillStyle = 'rgba(255,220,140,.45)'; for (let k = 0; k < hh / 16; k++) if (r() < 0.4) g.fillRect(x + 6 + (k % 3) * 11, gy - 30 - k * 14, 5, 6); }
      for (let i = 0; i < 6; i++) { const x = r() * W; g.fillStyle = 'rgba(60,60,64,.5)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + k * 8, gy - 200 - k * 22, 18 + k * 5, 0, TAU); g.fill(); } }
      far('#6a7050', 26, 10, 24, 8);
      for (let x = 0; x < W; x += 60) { g.strokeStyle = '#4a3a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, gy - 2); g.lineTo(x, gy - 20); g.stroke(); g.strokeStyle = 'rgba(60,60,60,.7)'; g.lineWidth = 1; g.beginPath(); for (let k = 0; k < 12; k++) g.lineTo(x + k * 5, gy - 16 + (k % 2) * 4); g.stroke(); }
    } else {
      far('#2a1a5a', 100, 30, 40, 9);
      for (let i = 0; i < 26; i++) { const x = i * 72 + r() * 30, hh = 80 + r() * 160, ww = 26 + r() * 30; g.fillStyle = '#1e1640'; g.beginPath(); g.moveTo(x, gy - 20); g.lineTo(x + ww * 0.15, gy - 20 - hh); g.lineTo(x + ww * 0.85, gy - 20 - hh); g.lineTo(x + ww, gy - 20); g.fill(); g.fillStyle = r() < 0.5 ? 'rgba(90,216,255,.7)' : 'rgba(255,90,220,.6)'; g.fillRect(x + ww * 0.15, gy - 20 - hh, ww * 0.7, 2); for (let k = 0; k < hh / 18; k++) if (r() < 0.5) g.fillRect(x + 6, gy - 30 - k * 16, ww - 12, 2); }
      g.strokeStyle = 'rgba(90,216,255,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, gy - 180); g.bezierCurveTo(W * 0.3, gy - 220, W * 0.6, gy - 140, W, gy - 190); g.stroke();
      far('#2a2a5a', 26, 8, 30, 10);
    }
    // zem s cestou, kamínky a trávou
    g.fillStyle = shade(g, 0, gy, 0, H, ['#8a6a3a', '#7a6a4a', '#8a7a5a', '#5a5248', '#2e2a4a'][age], '#1e1810'); g.fillRect(0, gy, W, H - gy);
    g.fillStyle = ['#a8844a', '#9a8a6a', '#a8987a', '#6a6258', '#3e3a64'][age]; g.beginPath(); g.moveTo(0, gy + 8); for (let x = 0; x <= W; x += 40) g.lineTo(x, gy + 6 + Math.sin(x * 0.02) * 2); g.lineTo(W, gy + 26); for (let x = W; x >= 0; x -= 40) g.lineTo(x, gy + 28 + Math.sin(x * 0.03) * 3); g.closePath(); g.fill();
    for (let i = 0; i < 320; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.1)'; g.beginPath(); g.ellipse(r() * W, gy + 4 + r() * (H - gy - 4), 1 + r() * 3, 0.8 + r() * 1.4, 0, 0, TAU); g.fill(); }
    for (let i = 0; i < 40; i++) { const x = r() * W, y = gy + 34 + r() * (H - gy - 40), rr = 2 + r() * 5; g.fillStyle = age === 4 ? '#4a4a7a' : '#8a8478'; g.strokeStyle = 'rgba(20,14,8,.6)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, rr * 1.3, rr, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(x - rr * 0.4, y - rr * 0.3, rr * 0.4, 0, TAU); g.fill(); }
    g.fillStyle = age === 4 ? '#5ad8ff' : age === 3 ? '#6a6a52' : age === 2 ? '#7aa04a' : '#5a9a3a'; g.fillRect(0, gy - 3, W, 5);
    if (age < 3) { g.fillStyle = age === 0 ? '#4a8a2a' : '#4a8a32'; for (let x = 0; x < W; x += 4) { if (r() < 0.35) continue; const hh = 4 + r() * 8; g.beginPath(); g.moveTo(x, gy + 1); g.lineTo(x + 1.5 + r() * 2, gy - hh); g.lineTo(x + 3.5, gy + 1); g.fill(); } }
    if (age === 4) { g.strokeStyle = 'rgba(90,216,255,.3)'; g.lineWidth = 1; for (let x = 0; x < W; x += 50) { g.beginPath(); g.moveTo(x, gy); g.lineTo(x - 40, H); g.stroke(); } g.beginPath(); g.moveTo(0, gy + 30); g.lineTo(W, gy + 30); g.stroke(); }
    return c;
  }

  // ── Základny ── (x, y) je střed paty, side 0 = hráč (vlevo), 1 = soupeř
  function base(g, x, y, age, side, t) {
    const pic = (side && img(`base-${age}-red`)) || img(`base-${age}`);
    if (pic) { sprite(g, pic, x, y, 190 * (age === 4 ? 1.25 : age === 2 ? 1.2 : 1), 0.5, 1, !!side); return; }
    g.save(); g.translate(x, y); g.scale(side ? -BASE_SCALE : BASE_SCALE, BASE_SCALE); g.lineJoin = 'round'; g.lineCap = 'round';
    const tc = TEAM[side], td = TEAM_D[side];
    const flag = (fx, fy, h) => { limb(g, 2, '#5a4a3a', fx, fy, fx, fy - h); fillOut(g, shade(g, fx, fy - h, fx + 26, fy - h + 14, tc, td), () => { g.beginPath(); g.moveTo(fx, fy - h); g.quadraticCurveTo(fx + 13, fy - h - 4 + Math.sin(t * 4) * 3, fx + 26, fy - h + 1); g.lineTo(fx + 26, fy - h + 15); g.quadraticCurveTo(fx + 13, fy - h + 11 + Math.sin(t * 4 + 1) * 3, fx, fy - h + 14); g.closePath(); }, 1.4); };
    if (age === 0) {
      fillOut(g, shade(g, -60, -90, 60, 0, '#a8988a', '#5a4e44'), () => { g.beginPath(); g.moveTo(-62, 0); g.quadraticCurveTo(-68, -60, -30, -84); g.quadraticCurveTo(10, -98, 44, -66); g.quadraticCurveTo(62, -40, 60, 0); g.closePath(); }, 2.4);
      g.fillStyle = 'rgba(60,50,40,.35)'; for (const [bx, by, br] of [[-34, -50, 15], [6, -66, 13], [30, -32, 11], [-12, -24, 9]]) { g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(-24, -70, 18, 7, -0.4, 0, TAU); g.fill();
      g.fillStyle = '#1a1008'; g.beginPath(); g.moveTo(10, 0); g.quadraticCurveTo(12, -44, 32, -46); g.quadraticCurveTo(52, -44, 52, 0); g.closePath(); g.fill();
      for (let i = 0; i < 7; i++) { const px = -60 + i * 9; limb(g, 4, '#8a5a2a', px, 0, px, -28 - (i % 2) * 8); g.fillStyle = '#8a5a2a'; g.beginPath(); g.moveTo(px - 2, -28 - (i % 2) * 8); g.lineTo(px, -34 - (i % 2) * 8); g.lineTo(px + 2, -28 - (i % 2) * 8); g.fill(); }
      line(g, 3, '#6a4220', -64, -14, 0, -14);
      const fl = Math.sin(t * 12) * 3; g.fillStyle = '#5a3a1a'; g.fillRect(52, -4, 16, 4); g.fillStyle = '#ff8a3d'; g.beginPath(); g.moveTo(54, -3); g.quadraticCurveTo(60, -22 - fl, 66, -3); g.fill(); g.fillStyle = '#ffe066'; g.beginPath(); g.moveTo(57, -3); g.quadraticCurveTo(60, -12 - fl, 63, -3); g.fill();
      for (const sx of [-40, 30]) { g.fillStyle = '#e8dcc8'; g.beginPath(); g.ellipse(sx, -60 + (sx > 0 ? 18 : 0), 6, 5, 0, 0, TAU); g.fill(); g.fillStyle = OL; g.beginPath(); g.arc(sx - 2, -60 + (sx > 0 ? 18 : 0), 1.2, 0, TAU); g.arc(sx + 2, -60 + (sx > 0 ? 18 : 0), 1.2, 0, TAU); g.fill(); }
      flag(-14, -86, 34);
    } else if (age === 1) {
      fillOut(g, shade(g, -56, -110, 56, 0, '#b8b2a6', '#6a665c'), () => { g.beginPath(); g.rect(-56, -100, 112, 100); }, 2.4);
      g.strokeStyle = 'rgba(40,36,30,.35)'; g.lineWidth = 1.2; for (let yy = -94; yy < 0; yy += 12) for (let xx = -56 + ((yy / 12) % 2 ? 0 : 10); xx < 56; xx += 20) g.strokeRect(xx, yy, 20, 12);
      for (let i = 0; i < 6; i++) fillOut(g, '#a8a296', () => { g.beginPath(); g.rect(-56 + i * 20, -114, 13, 14); }, 1.6);
      fillOut(g, shade(g, -30, -150, 0, -100, '#c8c2b6', '#7a766c'), () => { g.beginPath(); g.rect(-34, -150, 36, 50); }, 2);
      for (let i = 0; i < 3; i++) fillOut(g, '#a8a296', () => { g.beginPath(); g.rect(-34 + i * 13, -160, 9, 10); }, 1.4);
      g.fillStyle = '#3a2416'; g.beginPath(); g.moveTo(18, 0); g.lineTo(18, -38); g.arc(33, -38, 15, Math.PI, 0); g.lineTo(48, 0); g.fill(); g.strokeStyle = '#1a1008'; g.lineWidth = 1.2; for (let k = 20; k < 48; k += 5) { g.beginPath(); g.moveTo(k, -44); g.lineTo(k, 0); g.stroke(); } line(g, 2, '#6a6a6a', 18, -20, 48, -20);
      g.fillStyle = '#1a1a24'; for (const [wx, wy] of [[-40, -70], [-12, -70], [-22, -134]]) { g.beginPath(); g.roundRect(wx, wy, 8, 16, 4); g.fill(); g.fillStyle = 'rgba(255,200,100,.5)'; g.fillRect(wx + 2, wy + 6, 4, 8); g.fillStyle = '#1a1a24'; }
      fillOut(g, shade(g, -30, -80, -10, -40, tc, td), () => { g.beginPath(); g.moveTo(-34, -96); g.lineTo(-14, -96); g.lineTo(-14, -58); g.lineTo(-24, -50); g.lineTo(-34, -58); g.closePath(); }, 1.6);
      g.fillStyle = '#ffe066'; g.fillRect(-25, -90, 2.6, 28); g.fillRect(-31, -80, 14, 2.6);
      flag(-16, -160, 40);
    } else if (age === 2) {
      fillOut(g, shade(g, -60, -96, 60, 0, '#c8865a', '#7a4a2a'), () => { g.beginPath(); g.moveTo(-62, 0); g.lineTo(-52, -96); g.lineTo(52, -96); g.lineTo(62, 0); g.closePath(); }, 2.4);
      g.strokeStyle = 'rgba(80,40,20,.35)'; g.lineWidth = 1; for (let yy = -88; yy < 0; yy += 8) { g.beginPath(); g.moveTo(-60, yy); g.lineTo(60, yy); g.stroke(); }
      fillOut(g, '#e8dcc8', () => { g.beginPath(); g.rect(-56, -102, 112, 8); }, 1.6);
      fillOut(g, shade(g, -30, -150, 30, -100, '#f0e4cc', '#a8987a'), () => { g.beginPath(); g.rect(-30, -146, 60, 46); }, 2);
      fillOut(g, shade(g, -36, -180, 36, -146, '#6a8ab0', '#2a4a6a'), () => { g.beginPath(); g.moveTo(-38, -146); g.lineTo(0, -178); g.lineTo(38, -146); g.closePath(); }, 2);
      fillOut(g, '#fff', () => { g.beginPath(); g.arc(0, -124, 12, 0, TAU); }, 1.8); line(g, 1.8, OL, 0, -124, 0, -132); line(g, 1.8, OL, 0, -124, 6, -124);
      g.fillStyle = '#1a1a24'; for (const yy of [-72, -40]) for (const xx of [-36, 28]) { g.beginPath(); g.arc(xx + 4, yy, 5.5, 0, TAU); g.fill(); }
      g.fillStyle = '#3a2416'; g.beginPath(); g.moveTo(-11, 0); g.lineTo(-11, -28); g.arc(0, -28, 11, Math.PI, 0); g.lineTo(11, 0); g.fill();
      flag(0, -178, 36);
    } else if (age === 3) {
      g.fillStyle = '#9a9a7a'; for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) fillOut(g, shade(g, 0, -16 - j * 10, 0, -4 - j * 10, '#b8b494', '#7a785e'), () => { g.beginPath(); g.ellipse(-64 + i * 14 + j * 7, -6 - j * 10, 8.5, 6, 0, 0, TAU); }, 1.2);
      fillOut(g, shade(g, -48, -100, 52, -20, '#9aa0a6', '#5a6066'), () => { g.beginPath(); g.moveTo(-46, -20); g.lineTo(-42, -100); g.lineTo(46, -100); g.lineTo(54, -20); g.closePath(); }, 2.4);
      g.strokeStyle = 'rgba(40,44,48,.35)'; g.lineWidth = 1; for (let yy = -90; yy < -20; yy += 14) { g.beginPath(); g.moveTo(-46, yy); g.lineTo(52, yy); g.stroke(); }
      g.fillStyle = '#1a1a24'; g.fillRect(-30, -86, 64, 10); g.fillStyle = 'rgba(255,220,120,.6)'; g.fillRect(-24, -84, 8, 6); g.fillRect(14, -84, 8, 6);
      fillOut(g, '#6a7050', () => { g.beginPath(); g.rect(-20, -60, 40, 6); }, 1.4);
      limb(g, 3, '#5a6066', 24, -100, 24, -132); g.save(); g.translate(24, -136); g.rotate(Math.sin(t) * 0.6); fillOut(g, '#d8dce4', () => { g.beginPath(); g.ellipse(0, 0, 18, 7, 0, Math.PI, TAU); g.closePath(); }, 1.6); g.restore();
      flag(-34, -100, 40);
    } else {
      const glow = 0.5 + 0.5 * Math.sin(t * 3);
      const sh = g.createRadialGradient(0, -90, 30, 0, -90, 120); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.85, `rgba(90,216,255,${0.1 + glow * 0.08})`); sh.addColorStop(1, 'rgba(90,216,255,0)');
      g.fillStyle = sh; g.beginPath(); g.arc(0, -90, 120, Math.PI, TAU); g.fill();
      fillOut(g, shade(g, -50, -180, 50, 0, '#5a5a8a', '#22223a'), () => { g.beginPath(); g.moveTo(-54, 0); g.lineTo(-32, -150); g.lineTo(-12, -176); g.lineTo(12, -176); g.lineTo(32, -150); g.lineTo(54, 0); g.closePath(); }, 2.4);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(-38, 0); g.lineTo(-22, -146); g.lineTo(-10, -146); g.lineTo(-18, 0); g.fill();
      g.fillStyle = `rgba(90,216,255,${0.6 + glow * 0.4})`; g.shadowColor = '#5ad8ff'; g.shadowBlur = 14; g.beginPath(); g.arc(0, -118, 11, 0, TAU); g.fill(); g.fillRect(-2, -106, 4, 106); g.shadowBlur = 0;
      g.strokeStyle = tc; g.lineWidth = 3; g.shadowColor = tc; g.shadowBlur = 8; g.beginPath(); g.moveTo(-44, -40); g.lineTo(44, -40); g.moveTo(-36, -100); g.lineTo(36, -100); g.stroke(); g.shadowBlur = 0;
    }
    g.restore();
  }
  // místa pro věže (už v měřítku základny, vůči patě, pro hráče)
  const SLOTS = [[[-30, -86], [12, -94], [40, -66]], [[-40, -114], [10, -114], [40, -114]], [[-44, -102], [44, -102], [0, -178]], [[-30, -100], [30, -100], [0, -60]], [[-26, -150], [26, -150], [0, -176]]].map(a => a.map(([sx, sy]) => [sx * BASE_SCALE, sy * BASE_SCALE]));

  // věž; ang = úhel hlavně k cíli
  function turret(g, x, y, age, kind, ang, side, t) {
    const foot = img(`turret-${age}-${kind}-base`), gun = img(`turret-${age}-${kind}`);
    if (gun) { if (foot) sprite(g, foot, x, y + 8, 18); g.save(); g.translate(x, y); g.rotate(ang); sprite(g, gun, 0, 0, 22, 0.25, 0.5); g.restore(); return; }
    g.save(); g.translate(x, y); g.scale(1.25, 1.25); g.lineJoin = 'round';
    fillOut(g, shade(g, 0, -6, 0, 8, ['#a8784a', '#a8a296', '#8a6a4a', '#6a7058', '#4a4a7a'][age], ['#5a3a1a', '#6a665c', '#4a3a2a', '#3a4030', '#22223a'][age]), () => { g.beginPath(); g.roundRect(-11, -5, 22, 12, 3); }, 1.8);
    g.save(); g.rotate(ang);
    const big = kind === 1;
    if (age === 0) { limb(g, 3.4, '#8a5a2a', 0, 0, big ? 24 : 18, 0); limb(g, 3, '#8a5a2a', big ? 24 : 18, -7, big ? 24 : 18, 7); if (big) fillOut(g, '#9a9488', () => { g.beginPath(); g.arc(8, -6, 5, 0, TAU); }, 1.2); }
    else if (age === 1) { fillOut(g, '#8a5a2a', () => { g.beginPath(); g.rect(-4, -3, big ? 30 : 24, 6); }); g.strokeStyle = '#5a3a1a'; g.lineWidth = 2.4; g.beginPath(); g.arc(big ? 18 : 14, 0, 11, -1.3, 1.3); g.stroke(); line(g, 0.8, '#eee', big ? 18 + Math.cos(-1.3) * 11 : 14 + Math.cos(-1.3) * 11, Math.sin(-1.3) * 11, 2, 0, big ? 18 + Math.cos(1.3) * 11 : 14 + Math.cos(1.3) * 11, Math.sin(1.3) * 11); }
    else if (age === 2) { fillOut(g, shade(g, 0, -6, 0, 6, '#f2c86a', '#8a5a1a'), () => { g.beginPath(); g.moveTo(-6, -6); g.lineTo(big ? 32 : 24, -4.5); g.lineTo(big ? 32 : 24, 4.5); g.lineTo(-6, 6); g.closePath(); }); }
    else if (age === 3) { if (big) { fillOut(g, '#5a6a3a', () => { g.beginPath(); g.rect(-6, -8, 26, 16); }); g.fillStyle = '#ff5a3a'; for (const yy of [-5, 1]) for (const xx of [20, 20]) g.fillRect(xx, yy, 5, 4); } else { fillOut(g, '#3a3a3a', () => { g.beginPath(); g.rect(-4, -2.5, 30, 4); }); fillOut(g, '#4a5a32', () => { g.beginPath(); g.rect(-7, -6, 12, 12); }); } }
    else { fillOut(g, shade(g, 0, -6, 0, 6, '#a8b0d8', '#4a4a7a'), () => { g.beginPath(); g.roundRect(-6, -6, big ? 34 : 26, 12, 5); }); g.fillStyle = `rgba(90,216,255,${0.6 + 0.4 * Math.sin(t * 8)})`; g.shadowColor = '#5ad8ff'; g.shadowBlur = 10; g.beginPath(); g.arc(big ? 30 : 22, 0, 4, 0, TAU); g.fill(); g.shadowBlur = 0; }
    g.restore();
    g.fillStyle = TEAM[side]; g.fillRect(-9, 3, 18, 3);
    g.restore();
  }

  // střely: kind 'stone' | 'arrow' | 'ball' | 'bullet' | 'shell' | 'laser'
  function shot(g, p) {
    const pic = img(`shot-${p.kind}`);
    if (pic) { g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.vy, p.vx)); sprite(g, pic, 0, 0, p.kind === 'arrow' || p.kind === 'laser' ? 8 : 10, 0.5, 0.5); g.restore(); return; }
    g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.vy, p.vx));
    if (p.kind === 'arrow') { line(g, 1.8, '#6a4220', -12, 0, 7, 0); g.fillStyle = '#c8ccd4'; g.beginPath(); g.moveTo(7, -3); g.lineTo(13, 0); g.lineTo(7, 3); g.fill(); g.fillStyle = '#fff'; g.fillRect(-13, -2.5, 5, 5); }
    else if (p.kind === 'bullet') { g.fillStyle = 'rgba(255,224,102,.4)'; g.fillRect(-16, -1.5, 16, 3); g.fillStyle = '#ffe066'; g.fillRect(-4, -1.2, 8, 2.4); }
    else if (p.kind === 'laser') { g.shadowColor = '#5ad8ff'; g.shadowBlur = 10; g.fillStyle = 'rgba(90,216,255,.5)'; g.fillRect(-18, -3.5, 30, 7); g.fillStyle = '#e8ffff'; g.fillRect(-18, -1.2, 30, 2.4); g.shadowBlur = 0; }
    else { const r = p.kind === 'shell' || p.kind === 'ball' ? 5 : 4; if (p.kind === 'shell') { g.fillStyle = 'rgba(200,200,200,.4)'; g.beginPath(); g.arc(-8, 0, 4, 0, TAU); g.fill(); } fillOut(g, shade(g, -r, -r, r, r, p.kind === 'stone' ? '#b8b4ac' : '#5a5a6a', p.kind === 'stone' ? '#6a6660' : '#1a1a24'), () => { g.beginPath(); g.arc(0, 0, r, 0, TAU); }, 1.2); }
    g.restore();
  }

  // zvláštní útoky: padající předměty podle věku
  function special(g, s, t) {
    const pic = img(`special-${s.age}`);
    if (pic) { sprite(g, pic, s.x, s.y, s.age === 4 ? 420 : 40, 0.5, s.age === 4 ? 1 : 0.5); return; }
    g.save(); g.translate(s.x, s.y);
    if (s.age === 0) { const tr = g.createLinearGradient(-40, -48, 0, 0); tr.addColorStop(0, 'rgba(255,140,40,0)'); tr.addColorStop(1, 'rgba(255,200,80,.95)'); g.strokeStyle = tr; g.lineWidth = 12; g.beginPath(); g.moveTo(-44, -52); g.lineTo(0, 0); g.stroke(); fillOut(g, shade(g, -10, -10, 10, 10, '#8a6a5a', '#3a2a20'), () => { g.beginPath(); g.arc(0, 0, 11, 0, TAU); }, 1.8); g.fillStyle = '#ff8a3d'; g.beginPath(); g.arc(-3, -3, 5, 0, TAU); g.fill(); }
    else if (s.age === 1) { g.rotate(Math.PI / 2 - 0.15); line(g, 2, '#6a4220', -14, 0, 9, 0); g.fillStyle = '#c8ccd4'; g.beginPath(); g.moveTo(9, -3.5); g.lineTo(16, 0); g.lineTo(9, 3.5); g.fill(); g.fillStyle = '#fff'; g.fillRect(-15, -3, 5, 6); }
    else if (s.age === 2) { fillOut(g, shade(g, -8, -8, 8, 8, '#5a5a6a', '#1a1a24'), () => { g.beginPath(); g.arc(0, 0, 8, 0, TAU); }, 1.6); g.strokeStyle = 'rgba(255,200,120,.9)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-3, -9); g.lineTo(-6, -18); g.stroke(); }
    else if (s.age === 3) { fillOut(g, shade(g, -6, 0, 6, 0, '#6a7058', '#3a4030'), () => { g.beginPath(); g.ellipse(0, 0, 6, 12, 0, 0, TAU); }, 1.6); fillOut(g, '#3a3a2a', () => { g.beginPath(); g.moveTo(-7, -14); g.lineTo(7, -14); g.lineTo(4, -8); g.lineTo(-4, -8); g.closePath(); }, 1.2); }
    else { g.shadowColor = '#5ad8ff'; g.shadowBlur = 20; g.fillStyle = 'rgba(90,216,255,.35)'; g.fillRect(-10, -420, 20, 420); g.fillStyle = '#e0ffff'; g.fillRect(-3, -420, 6, 420); g.fillStyle = 'rgba(200,255,255,.85)'; g.beginPath(); g.arc(0, 0, 14 + Math.sin(t * 30) * 3, 0, TAU); g.fill(); g.shadowBlur = 0; }
    g.restore();
  }
  // bombardér pro nálet moderní doby
  function plane(g, x, y, dir = 1) {
    const pic = img('plane');
    if (pic) { sprite(g, pic, x, y, 40, 0.5, 0.5, dir < 0); return; }
    g.save(); g.translate(x, y); g.scale(-1.3, 1.3);
    fillOut(g, shade(g, 0, -8, 0, 8, '#8a9a6a', '#4a5a3a'), () => { g.beginPath(); g.ellipse(0, 0, 42, 8, 0, 0, TAU); }, 2);
    fillOut(g, '#5a6a4a', () => { g.beginPath(); g.moveTo(-8, 0); g.lineTo(10, -32); g.lineTo(20, -32); g.lineTo(14, 0); g.closePath(); }, 1.6);
    fillOut(g, '#5a6a4a', () => { g.beginPath(); g.moveTo(30, -2); g.lineTo(42, -18); g.lineTo(47, -18); g.lineTo(43, 0); g.closePath(); }, 1.4);
    g.fillStyle = '#9ad8ff'; g.beginPath(); g.ellipse(-30, -3, 7, 4, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(4, 0, 4, 0, TAU); g.fill(); g.fillStyle = '#e8383a'; g.beginPath(); g.arc(4, 0, 2, 0, TAU); g.fill();
    g.restore();
  }

  return { TEAM, UNIT_SCALE, BASE_SCALE, TOP, img, get ready() { return manifest !== null; }, get loaded() { return Object.keys(IMG).length; }, land, base, SLOTS, turret, unit, shot, special, plane };
})();
