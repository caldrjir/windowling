'use strict';
// ── SKOKAN · kresba ─────────────────────────────────────────────────────────
// Ručně kreslený styl na čtverečkovaném papíře: každý obrys se táhne dvakrát s malým posunem
// jako tužkou. Skokan (zelený panáček s chobotem a pruhovanými kalhotami), plošinky, pružina,
// vrtulka, raketový batoh, příšery, UFO, černá díra, zlatá hvězda a cílová vlajka. Sdílí je hra
// i obrázek na úvodní stránce.
const SkArt = (() => {
  const TAU = Math.PI * 2, INK = '#2b2b3a';
  const THEMES = {
    klasik: { paper: '#f8f3e3', grid: 'rgba(120,160,210,.35)', margin: 'rgba(230,90,90,.35)', ink: INK },
    vesmir: { paper: '#141a3a', grid: 'rgba(140,170,255,.16)', margin: 'rgba(255,120,200,.25)', ink: '#0a0c1e' },
  };
  // tužkový obrys: hlavní tah a slabší posunutý
  function pencil(g, path, w = 2.2, col = INK) {
    g.lineWidth = w; g.strokeStyle = col; path(); g.stroke();
    g.save(); g.globalAlpha *= 0.35; g.translate(0.8, 0.6); g.lineWidth = w * 0.7; path(); g.stroke(); g.restore();
  }

  // papír: čtverečky posunuté s kamerou, okraj sešitu, ve vesmíru hvězdy
  function paper(g, W, H, camY, theme, t) {
    const T = THEMES[theme] || THEMES.klasik;
    g.fillStyle = T.paper; g.fillRect(0, 0, W, H);
    if (theme === 'vesmir') {
      for (let i = 0; i < 70; i++) {
        const sx = (i * 97.3) % W, sy = (((i * 61.7 - camY * 0.3) % H) + H) % H, tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
        g.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.5})`; g.beginPath(); g.arc(sx, sy, i % 7 ? 1 : 1.8, 0, TAU); g.fill();
      }
      const ng = g.createRadialGradient(W * 0.7, H * 0.3, 10, W * 0.7, H * 0.3, W * 0.8); ng.addColorStop(0, 'rgba(160,80,255,.18)'); ng.addColorStop(1, 'rgba(160,80,255,0)');
      g.fillStyle = ng; g.fillRect(0, 0, W, H);
    }
    g.strokeStyle = T.grid; g.lineWidth = 1;
    const s = 18, off = ((-camY % s) + s) % s;
    g.beginPath();
    for (let x = 0; x <= W; x += s) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
    for (let y = off - s; y <= H; y += s) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
    g.stroke();
    g.strokeStyle = T.margin; g.lineWidth = 2; g.beginPath(); g.moveTo(26, 0); g.lineTo(26, H); g.stroke();
  }

  // ── Plošinky ── p: { x (střed), y (horní hrana), w, kind, broken, bt, gone }
  const PCOL = { green: ['#7fd34a', '#4e9a2a'], move: ['#5ab8ff', '#2a74c8'], vanish: ['#ffffff', '#b8b8c8'], break: ['#c9945a', '#8a5a2e'], finish: ['#ffd23f', '#d89a14'] };
  function platform(g, p, t, theme) {
    if (p.gone) return;
    const [c1, c2] = PCOL[p.kind] || PCOL.green, w = p.w, h = 13, x = p.x - w / 2;
    g.save();
    if (p.kind === 'break' && p.broken) {
      // zlomená plošinka padá ve dvou kusech
      const a = Math.min(1.2, p.bt * 3);
      for (const s of [-1, 1]) {
        g.save(); g.translate(p.x + s * w * 0.25 + s * p.bt * 30, p.y + p.bt * p.bt * 300); g.rotate(s * a);
        g.fillStyle = c1; g.beginPath(); g.roundRect(-w / 4, 0, w / 2, h, 4); g.fill();
        pencil(g, () => { g.beginPath(); g.roundRect(-w / 4, 0, w / 2, h, 4); });
        g.restore();
      }
      g.restore(); return;
    }
    if (theme === 'vesmir') { g.shadowColor = c1; g.shadowBlur = 10; }
    g.fillStyle = c1; g.beginPath(); g.roundRect(x, p.y, w, h, 6); g.fill(); g.shadowBlur = 0;
    g.fillStyle = c2; g.beginPath(); g.roundRect(x + 2, p.y + h * 0.55, w - 4, h * 0.38, 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.roundRect(x + 5, p.y + 2.5, w * 0.45, 2.5, 2); g.fill();
    if (p.kind === 'break') { g.strokeStyle = 'rgba(60,30,10,.8)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(p.x - 2, p.y + 1); g.lineTo(p.x + 3, p.y + 6); g.lineTo(p.x - 1, p.y + h - 1); g.stroke(); }
    if (p.kind === 'vanish') { g.setLineDash([4, 3]); }
    pencil(g, () => { g.beginPath(); g.roundRect(x, p.y, w, h, 6); }, 2, theme === 'vesmir' ? '#0a0c1e' : INK);
    g.setLineDash([]);
    if (p.kind === 'finish') {
      // cílová vlajka
      g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.moveTo(p.x + w / 2 - 10, p.y); g.lineTo(p.x + w / 2 - 10, p.y - 46); g.stroke();
      const wv = Math.sin(t * 6) * 3;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : INK; g.beginPath(); const fx = p.x + w / 2 - 10 - (i + 1) * 7, fy = p.y - 46 + j * 6 + (i + 1) * wv * 0.25; g.rect(fx, fy, 7, 6); g.fill(); }
      g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(p.x + w / 2 - 38, p.y - 46 + wv, 28, 18);
    }
    g.restore();
  }

  // pružina na plošince; c = stlačení 0–1 (po odrazu vystřelí)
  function spring(g, x, y, c) {
    const hgt = c > 0 ? 22 : 11;
    g.save(); g.lineCap = 'round';
    g.fillStyle = '#c9ced8'; g.beginPath(); g.roundRect(x - 9, y - 3, 18, 4, 2); g.fill();
    g.strokeStyle = '#6a7080'; g.lineWidth = 2.6; g.beginPath();
    for (let i = 0; i <= 6; i++) { const yy = y - 3 - (i / 6) * hgt, xx = x + (i % 2 ? 7 : -7); if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy); }
    g.stroke();
    g.fillStyle = '#e8ecf4'; g.beginPath(); g.roundRect(x - 10, y - 6 - hgt, 20, 5, 2); g.fill();
    pencil(g, () => { g.beginPath(); g.roundRect(x - 10, y - 6 - hgt, 20, 5, 2); }, 1.6);
    g.restore();
  }
  // vrtulková čepice
  function propeller(g, x, y, t, worn) {
    g.save(); g.translate(x, y);
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, 0, 10, Math.PI, TAU); g.fill();
    g.fillStyle = '#ff5a5a'; g.beginPath(); g.arc(0, 0, 10, Math.PI * 1.35, Math.PI * 1.65); g.lineTo(0, 0); g.fill();
    pencil(g, () => { g.beginPath(); g.arc(0, 0, 10, Math.PI, TAU); g.closePath(); }, 1.8);
    g.fillStyle = INK; g.fillRect(-1, -14, 2, 5);
    const sp = worn ? t * 30 : t * 4, bl = 13 * Math.abs(Math.cos(sp));
    g.fillStyle = '#5ab8ff'; g.beginPath(); g.ellipse(-bl / 2 - 1, -15, bl / 2 + 1, 2.5, 0, 0, TAU); g.ellipse(bl / 2 + 1, -15, bl / 2 + 1, 2.5, 0, 0, TAU); g.fill();
    pencil(g, () => { g.beginPath(); g.ellipse(-bl / 2 - 1, -15, bl / 2 + 1, 2.5, 0, 0, TAU); g.moveTo(bl + 2, -15); g.ellipse(bl / 2 + 1, -15, bl / 2 + 1, 2.5, 0, 0, TAU); }, 1.2);
    g.restore();
  }
  // raketový batoh se dvěma tryskami
  function jetpack(g, x, y, t, flame) {
    g.save(); g.translate(x, y);
    for (const s of [-1, 1]) {
      g.fillStyle = '#d8dde8'; g.beginPath(); g.roundRect(s * 6 - 5, -14, 10, 24, 5); g.fill();
      g.fillStyle = '#ff5a5a'; g.beginPath(); g.moveTo(s * 6 - 5, -6); g.lineTo(s * 6 + 5, -6); g.lineTo(s * 6 + 5, -2); g.lineTo(s * 6 - 5, -2); g.fill();
      pencil(g, () => { g.beginPath(); g.roundRect(s * 6 - 5, -14, 10, 24, 5); }, 1.6);
      if (flame) {
        const f = 14 + Math.sin(t * 40 + s) * 5;
        g.fillStyle = '#ff9a3d'; g.beginPath(); g.moveTo(s * 6 - 5, 10); g.quadraticCurveTo(s * 6, 10 + f * 1.6, s * 6 + 5, 10); g.fill();
        g.fillStyle = '#ffe066'; g.beginPath(); g.moveTo(s * 6 - 3, 10); g.quadraticCurveTo(s * 6, 10 + f, s * 6 + 3, 10); g.fill();
      }
    }
    g.restore();
  }

  // ── Skokan ── (x, y) jsou chodidla; face = ±1, sq = zmáčknutí, shoot = chobot nahoru
  function doodler(g, x, y, o) {
    const face = o.face || 1, sq = o.sq || 0, t = o.t || 0;
    g.save(); g.translate(x, y); g.lineCap = 'round'; g.lineJoin = 'round';
    if (o.dead) g.rotate(Math.sin(t * 12) * 0.3 + Math.PI);
    g.scale(1 + sq * 0.12, 1 - sq * 0.18);
    // nožičky
    g.strokeStyle = INK; g.lineWidth = 3;
    for (const lx of [-12, -4, 4, 12]) { g.beginPath(); g.moveTo(lx, -10); g.lineTo(lx + face * 1.5, -1); g.lineTo(lx + face * 5, -1); g.stroke(); }
    g.scale(face, 1);
    // tělo: fazole, nahoře zelená, dole pruhované kalhoty
    const body = () => { g.beginPath(); g.moveTo(-16, -10); g.bezierCurveTo(-19, -26, -16, -44, 0, -45); g.bezierCurveTo(14, -45, 18, -32, 17, -20); g.lineTo(17, -10); g.closePath(); };
    body(); g.fillStyle = o.color || '#a8d84a'; g.fill();
    g.save(); body(); g.clip();
    g.fillStyle = '#6f9e2c'; g.fillRect(-20, -19, 40, 10);
    g.fillStyle = '#4a7a1a'; for (let i = 0; i < 3; i++) g.fillRect(-20, -18 + i * 3.4, 40, 1.6);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-7, -36, 5, 3, -0.5, 0, TAU); g.fill();
    g.restore();
    pencil(g, body, 2.4);
    // chobot (při střelbě míří nahoru)
    g.save(); if (o.shoot) { g.translate(1, -42); g.rotate(-Math.PI / 2); } else g.translate(10, -32);
    const snout = () => { g.beginPath(); g.moveTo(0, -5); g.lineTo(14, -4); g.lineTo(14, 4); g.lineTo(0, 5); };
    g.fillStyle = o.color || '#a8d84a'; snout(); g.fill(); pencil(g, snout, 2.2);
    g.fillStyle = '#d9f09a'; g.beginPath(); g.ellipse(15, 0, 3, 5.5, 0, 0, TAU); g.fill(); pencil(g, () => { g.beginPath(); g.ellipse(15, 0, 3, 5.5, 0, 0, TAU); }, 1.8);
    g.restore();
    // oči
    if (o.dead) { g.strokeStyle = INK; g.lineWidth = 2; for (const ex of [2, 8]) { g.beginPath(); g.moveTo(ex - 2, -38); g.lineTo(ex + 2, -34); g.moveTo(ex + 2, -38); g.lineTo(ex - 2, -34); g.stroke(); } }
    else { g.fillStyle = INK; for (const ex of [3, 9]) { g.beginPath(); g.ellipse(ex, -36, 1.8, 2.6, 0, 0, TAU); g.fill(); } }
    g.restore();
    if (o.dead) for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; star(g, x + Math.cos(a) * 18, y + 12 + Math.sin(a) * 5, 4, '#ffd23f'); }
  }

  function star(g, x, y, r, col = '#ffd23f') {
    g.save(); g.translate(x, y); g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = col; g.fill(); pencil(g, () => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }, Math.max(1, r * 0.12));
    g.restore();
  }

  // ── Příšery ── m: { x, y (střed), kind, ph }
  function monster(g, m, t) {
    g.save(); g.translate(m.x, m.y + Math.sin(t * 3 + m.ph) * 3); g.lineCap = 'round'; g.lineJoin = 'round';
    if (m.kind === 'ufo') {
      const beam = g.createLinearGradient(0, 4, 0, 60); beam.addColorStop(0, 'rgba(140,255,170,.45)'); beam.addColorStop(1, 'rgba(140,255,170,0)');
      g.fillStyle = beam; g.beginPath(); g.moveTo(-10, 4); g.lineTo(10, 4); g.lineTo(22, 60); g.lineTo(-22, 60); g.fill();
      g.fillStyle = '#9ef0ff'; g.beginPath(); g.ellipse(0, -8, 11, 10, 0, Math.PI, TAU); g.fill(); pencil(g, () => { g.beginPath(); g.ellipse(0, -8, 11, 10, 0, Math.PI, TAU); }, 1.6, '#0a0c1e');
      g.fillStyle = '#7ad04a'; g.beginPath(); g.arc(0, -10, 5, 0, TAU); g.fill(); g.fillStyle = INK; g.beginPath(); g.arc(1.5, -11, 1.4, 0, TAU); g.fill();
      g.fillStyle = '#b8c0d8'; g.beginPath(); g.ellipse(0, 0, 26, 8, 0, 0, TAU); g.fill(); pencil(g, () => { g.beginPath(); g.ellipse(0, 0, 26, 8, 0, 0, TAU); }, 2, '#0a0c1e');
      for (let i = 0; i < 5; i++) { g.fillStyle = Math.sin(t * 8 + i) > 0 ? '#ffe066' : '#ff5a7a'; g.beginPath(); g.arc(-18 + i * 9, 1, 2, 0, TAU); g.fill(); }
    } else if (m.kind === 'bat') {
      const fl = Math.sin(t * 14 + m.ph) * 8;
      g.fillStyle = '#8a5ad8';
      for (const s of [-1, 1]) { const wing = () => { g.beginPath(); g.moveTo(s * 8, -2); g.quadraticCurveTo(s * 22, -14 - fl, s * 30, -4 - fl * 0.5); g.quadraticCurveTo(s * 24, 0, s * 20, 4); g.quadraticCurveTo(s * 14, 2, s * 8, 6); g.closePath(); }; wing(); g.fill(); pencil(g, wing, 1.8); }
      const bd = () => { g.beginPath(); g.ellipse(0, 0, 12, 13, 0, 0, TAU); }; g.fillStyle = '#b07aff'; bd(); g.fill(); pencil(g, bd, 2.2);
      g.fillStyle = '#fff'; for (const ex of [-4.5, 4.5]) { g.beginPath(); g.arc(ex, -3, 3.6, 0, TAU); g.fill(); } g.fillStyle = INK; for (const ex of [-4, 5]) { g.beginPath(); g.arc(ex, -2.5, 1.6, 0, TAU); g.fill(); }
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-5, 5); g.lineTo(-3, 9); g.lineTo(-1, 5); g.moveTo(1, 5); g.lineTo(3, 9); g.lineTo(5, 5); g.fill();
    } else {
      // tlustá chlupatá příšera s rohy a mnoha zuby
      const bd = () => { g.beginPath(); for (let i = 0; i <= 18; i++) { const a = i / 18 * TAU, rr = 20 + (i % 2 ? 2.5 : -1); g.lineTo(Math.cos(a) * rr * 1.15, Math.sin(a) * rr * 0.85); } g.closePath(); };
      for (const s of [-1, 1]) { g.fillStyle = '#ffe9b8'; const horn = () => { g.beginPath(); g.moveTo(s * 10, -14); g.quadraticCurveTo(s * 18, -26, s * 12, -32); g.quadraticCurveTo(s * 12, -22, s * 4, -16); g.closePath(); }; horn(); g.fill(); pencil(g, horn, 1.6); }
      g.fillStyle = m.kind === 'red' ? '#ff6a5a' : '#3ec7a8'; bd(); g.fill(); pencil(g, bd, 2.4);
      g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(0, 8, 18, 7, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff'; for (const [ex, ey, er] of [[-8, -5, 5], [7, -6, 6], [0, -12, 3.5]]) { g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke(); }
      g.fillStyle = INK; for (const [ex, ey] of [[-7, -4], [8, -5], [0.5, -11.5]]) { g.beginPath(); g.arc(ex, ey, 1.8, 0, TAU); g.fill(); }
      g.fillStyle = INK; g.beginPath(); g.ellipse(0, 6, 11, 5, 0, 0, Math.PI); g.fill();
      g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-10 + i * 4.4, 6); g.lineTo(-8 + i * 4.4, 9.5); g.lineTo(-6 + i * 4.4, 6); g.fill(); }
    }
    g.restore();
  }
  // černá díra: vírová spirála
  function hole(g, x, y, t) {
    g.save(); g.translate(x, y);
    const rg = g.createRadialGradient(0, 0, 2, 0, 0, 30); rg.addColorStop(0, '#000'); rg.addColorStop(0.6, 'rgba(30,10,60,.9)'); rg.addColorStop(1, 'rgba(60,20,120,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
    g.rotate(t * 3); g.strokeStyle = 'rgba(190,140,255,.75)'; g.lineWidth = 1.8;
    for (let k = 0; k < 3; k++) { g.beginPath(); for (let a = 0; a < 9; a += 0.25) { const rr = 26 - a * 2.6; g.lineTo(Math.cos(a + k * 2.1) * rr, Math.sin(a + k * 2.1) * rr); } g.stroke(); }
    g.restore();
  }
  // výstřel: kulička
  function bullet(g, x, y) { g.fillStyle = INK; g.beginPath(); g.arc(x, y, 3.5, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(x - 1, y - 1, 1.2, 0, TAU); g.fill(); }

  return { THEMES, paper, platform, spring, propeller, jetpack, doodler, star, monster, hole, bullet, pencil };
})();
