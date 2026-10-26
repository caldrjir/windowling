'use strict';
// ── PÍRKO · kresba ──────────────────────────────────────────────────────────
// Kreslený styl s tmavým obrysem: kulatý ptáček, zelené roury s leskem, město, mraky a keře
// v několika vrstvách (paralaxa), denní a noční nebe. Vše v herních pixelech (360 × 640).
const PkArt = (() => {
  const TAU = Math.PI * 2, OL = '#2a1e14';
  const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  const rngOf = s => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  // barevná témata: den, západ, noc
  const THEMES = [
    { sky: [['0', '#5ec4f0'], ['1', '#c8f0ff']], far: '#a8dcc8', city: '#8ccab8', win: 'rgba(255,255,255,.55)', bush: '#5cbf4a', bush2: '#7ad85a', cloud: '#ffffff', stars: 0 },
    { sky: [['0', '#ff9a6a'], ['0.6', '#ffd29a'], ['1', '#fff0c0']], far: '#e8a888', city: '#c88a7a', win: 'rgba(255,240,200,.8)', bush: '#6aa84a', bush2: '#8ac85a', cloud: '#fff2e0', stars: 0 },
    { sky: [['0', '#141c4a'], ['1', '#3a4a8a']], far: '#2a3a6a', city: '#1e2a52', win: 'rgba(255,230,140,.9)', bush: '#2a6a3a', bush2: '#3a8a4a', cloud: 'rgba(200,210,255,.35)', stars: 1 },
  ];
  // vrstvy pozadí jako dlouhé dlaždice, které se posouvají různou rychlostí
  function layers(theme, W, H, GY) {
    const T = THEMES[theme], r = rngOf(11 + theme * 7), mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const sky = mk(W, H), s = sky.getContext('2d');
    s.fillStyle = lin(s, 0, 0, 0, GY, T.sky.map(([o, c]) => [+o, c])); s.fillRect(0, 0, W, H);
    if (T.stars) for (let i = 0; i < 70; i++) { s.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; s.beginPath(); s.arc(r() * W, r() * GY * 0.7, 0.5 + r() * 1.2, 0, TAU); s.fill(); }
    if (T.stars) { s.fillStyle = '#fff6d0'; s.beginPath(); s.arc(W * 0.75, H * 0.14, 22, 0, TAU); s.fill(); s.fillStyle = THEMES[2].sky[0][1]; s.beginPath(); s.arc(W * 0.75 + 9, H * 0.14 - 6, 19, 0, TAU); s.fill(); }
    else { s.fillStyle = 'rgba(255,255,220,.4)'; s.beginPath(); s.arc(W * 0.78, H * 0.13, 38, 0, TAU); s.fill(); s.fillStyle = '#fff8d0'; s.beginPath(); s.arc(W * 0.78, H * 0.13, 22, 0, TAU); s.fill(); }
    // mraky (dlaždice 2×W)
    const clouds = mk(W * 2, H), c = clouds.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = r() * W * 2, y = 40 + r() * GY * 0.45, k = 0.6 + r() * 0.9; c.fillStyle = T.cloud;
      for (const [dx, dy, rr] of [[0, 0, 22], [22, 4, 17], [-22, 6, 15], [10, -10, 17], [36, 10, 11]]) for (const xx of [x, x - W * 2]) { c.beginPath(); c.arc(xx + dx * k, y + dy * k, rr * k, 0, TAU); c.fill(); }
    }
    // město (dlaždice W)
    const city = mk(W, H), m = city.getContext('2d');
    m.fillStyle = T.far; m.beginPath(); m.moveTo(0, GY); for (let x = 0; x <= W; x += 6) m.lineTo(x, GY - 120 - Math.sin(x / W * TAU * 2) * 18 - Math.sin(x / W * TAU * 5) * 8); m.lineTo(W, GY); m.fill();
    let x = 0; while (x < W) {
      const bw = 22 + Math.floor(r() * 26), bh = 50 + Math.floor(r() * 80), w = Math.min(bw, W - x);
      m.fillStyle = T.city; m.fillRect(x, GY - bh, w, bh);
      m.fillStyle = T.win; for (let yy = GY - bh + 8; yy < GY - 12; yy += 12) for (let xx = x + 5; xx < x + w - 6; xx += 9) if (r() < 0.55) m.fillRect(xx, yy, 4, 6);
      x += bw + 2;
    }
    // keře (dlaždice W)
    const bush = mk(W, H), b = bush.getContext('2d');
    for (const [col, base, amp] of [[T.bush, GY - 22, 18], [T.bush2, GY - 8, 14]]) {
      b.fillStyle = col; b.beginPath(); b.moveTo(0, GY);
      for (let i = 0; i <= 12; i++) { const bx = i * W / 12, br = amp + (i % 3) * 6; b.arc(bx, base, br, Math.PI, 0); }
      b.lineTo(W, GY); b.fill();
    }
    return { sky, clouds, city, bush, T };
  }
  // země: pruhovaný okraj trávy a hlína, posouvá se s rourami
  function ground(g, W, H, GY, off) {
    g.fillStyle = '#ded28a'; g.fillRect(0, GY, W, H - GY);
    g.fillStyle = lin(g, 0, GY, 0, GY + 18, [[0, '#9ae05a'], [1, '#5aa83a']]); g.fillRect(0, GY, W, 16);
    g.fillStyle = 'rgba(255,255,255,.25)'; for (let x = -(off % 24); x < W; x += 24) { g.beginPath(); g.moveTo(x, GY + 16); g.lineTo(x + 12, GY + 16); g.lineTo(x + 6, GY); g.lineTo(x - 6, GY); g.fill(); }
    g.fillStyle = OL; g.fillRect(0, GY, W, 2.5); g.fillRect(0, GY + 16, W, 2);
    g.fillStyle = 'rgba(150,120,60,.35)'; for (let x = -(off % 40); x < W; x += 40) { g.beginPath(); g.ellipse(x + 10, GY + 34, 6, 2.5, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(x + 30, GY + 52, 4, 2, 0, 0, TAU); g.fill(); }
  }
  // roura: x levý okraj, šířka w; ústí na y (top = horní roura končí na y)
  function pipe(g, x, w, y, top, H, GY, gold) {
    const body = gold ? [[0, '#c89a2a'], [0.3, '#ffe27a'], [0.55, '#f0c040'], [1, '#a8781a']] : [[0, '#4a9a2a'], [0.3, '#a8ec6a'], [0.55, '#7ccd3c'], [1, '#3e8a22']];
    const y0 = top ? -4 : y, y1 = top ? y : GY + 2, lipH = 24, lipX = x - 4, lipW = w + 8;
    g.fillStyle = lin(g, x, 0, x + w, 0, body); g.fillRect(x, y0, w, y1 - y0);
    g.strokeStyle = OL; g.lineWidth = 2.5; g.strokeRect(x, y0, w, y1 - y0);
    const ly = top ? y - lipH : y;
    g.fillStyle = lin(g, lipX, 0, lipX + lipW, 0, body); g.fillRect(lipX, ly, lipW, lipH); g.strokeRect(lipX, ly, lipW, lipH);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + w * 0.18, y0 + 2, 4, y1 - y0 - 4); g.fillRect(lipX + lipW * 0.16, ly + 3, 5, lipH - 6);
  }
  // ptáček: r poloměr, a natočení, wing fáze křídla (0–1), skin = barvy
  const SKINS = { zluty: ['#ffe14a', '#f0a81a', '#fff6c0'], cerveny: ['#ff6a5a', '#c8281e', '#ffd8c8'], modry: ['#6ad0ff', '#1e7ad8', '#d8f4ff'] };
  function bird(g, x, y, r, a, wing, skin = 'zluty', dead = false) {
    const [c1, c2, belly] = SKINS[skin] || SKINS.zluty;
    g.save(); g.translate(x, y); g.rotate(a); g.lineJoin = 'round';
    // ocas
    g.fillStyle = c2; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.moveTo(-r * 0.8, -r * 0.15); g.lineTo(-r * 1.45, -r * 0.5); g.lineTo(-r * 1.35, r * 0.05); g.lineTo(-r * 1.5, r * 0.4); g.lineTo(-r * 0.8, r * 0.3); g.closePath(); g.fill(); g.stroke();
    // tělo
    const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.15); gr.addColorStop(0, belly); gr.addColorStop(0.35, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r * 1.08, r, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = belly; g.beginPath(); g.ellipse(r * 0.05, r * 0.45, r * 0.62, r * 0.38, 0, 0, TAU); g.fill();
    // oko
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(r * 0.48, -r * 0.3, r * 0.36, r * 0.4, 0, 0, TAU); g.fill(); g.stroke();
    if (dead) { g.strokeStyle = OL; g.lineWidth = 2.2; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(r * 0.36, -r * 0.3 + s * r * 0.14); g.lineTo(r * 0.64, -r * 0.3 - s * r * 0.14); g.stroke(); } }
    else { g.fillStyle = OL; g.beginPath(); g.arc(r * 0.6, -r * 0.27, r * 0.15, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(r * 0.65, -r * 0.33, r * 0.05, 0, TAU); g.fill(); }
    // zobák
    g.fillStyle = lin(g, 0, -r * 0.1, 0, r * 0.4, [[0, '#ff9a3a'], [1, '#e8581a']]); g.strokeStyle = OL; g.lineWidth = 2;
    g.beginPath(); g.moveTo(r * 0.7, -r * 0.02); g.quadraticCurveTo(r * 1.5, r * 0.02, r * 1.42, r * 0.22); g.lineTo(r * 0.72, r * 0.3); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(r * 0.75, r * 0.16); g.lineTo(r * 1.38, r * 0.16); g.stroke();
    // křídlo: mává nahoru a dolů
    const wy = Math.sin(wing * TAU) * r * 0.42;
    g.fillStyle = belly; g.strokeStyle = OL; g.beginPath(); g.ellipse(-r * 0.25, r * 0.05 + wy * 0.3, r * 0.52, r * 0.3 + Math.abs(wy) * 0.25, -0.25 - wy / r * 0.6, 0, TAU); g.fill(); g.stroke();
    g.restore();
  }
  function feather(g, p) {
    g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
    g.fillStyle = p.c; g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.38, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-p.s, 0); g.lineTo(p.s, 0); g.stroke();
    g.restore();
  }
  // medaile na konci hry
  function medal(g, x, y, r, kind) {
    const C = { bronz: ['#f0b070', '#a8602a'], stribro: ['#f4f6fa', '#9aa2b0'], zlato: ['#fff0a0', '#d8a020'], platina: ['#e8fbff', '#6ad0e8'] }[kind];
    g.fillStyle = '#d83a3a'; g.beginPath(); g.moveTo(x - r * 0.6, y - r * 2.2); g.lineTo(x - r * 0.1, y - r * 0.6); g.lineTo(x + r * 0.1, y - r * 0.6); g.lineTo(x + r * 0.6, y - r * 2.2); g.fill();
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, C[0]); gr.addColorStop(1, C[1]);
    g.fillStyle = gr; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(x, y, r * 0.7, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.22 : r * 0.5; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill();
  }
  return { THEMES, SKINS, layers, ground, pipe, bird, feather, medal, OL };
})();
