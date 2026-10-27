'use strict';
// ── BOMBARĎÁK · grafika ─────────────────────────────────────────────────────
// Všechno statické (podlaha, sloupy, bedny, bomba, plameny, vylepšení, příšery) se kreslí jednou
// do skrytých pláten ve velikosti políčka; snímek pak jen skládá hotové obrázky (rychlé i na mobilu).
const BbArt = (() => {
  const TAU = Math.PI * 2;
  // šest světů, jeden na kapitolu Cesty
  const THEMES = [
    { id: 'louka', name: ['Louka', 'Meadow'], fa: '#5fae4a', fb: '#68b953', speck: ['#7fcf62', '#4f9a3d'], top: '#c3cbd8', side: '#7d8799', edge: '#5b6475', crate: 'wood', c: ['#c98a4b', '#9a6431', '#e2ad6e', '#6b4220'], frame: '#36424f', bg: '#2a3a2a' },
    { id: 'poust', name: ['Poušť', 'Desert'], fa: '#e4c27c', fb: '#dbb76d', speck: ['#f0d59b', '#c9a258'], top: '#e8b170', side: '#b77a3d', edge: '#8d5a2a', crate: 'wood', c: ['#a8643a', '#7c4524', '#c98455', '#4e2a14'], frame: '#7a4a22', bg: '#4a3420' },
    { id: 'snih', name: ['Sníh', 'Snow'], fa: '#e3edf7', fb: '#d7e5f2', speck: ['#ffffff', '#c3d6ea'], top: '#a9d3f5', side: '#5f9bd0', edge: '#3f76aa', crate: 'ice', c: ['#bfe6ff', '#7cb9e6', '#e8f7ff', '#4d88bd'], frame: '#35587d', bg: '#1f3550' },
    { id: 'dzungle', name: ['Džungle', 'Jungle'], fa: '#3f7d3a', fb: '#468741', speck: ['#5aa04f', '#2f6a2c'], top: '#8fa38a', side: '#55684f', edge: '#3d4d39', crate: 'bamboo', c: ['#c9b45a', '#97843a', '#e5d585', '#5d5020'], frame: '#2b3a26', bg: '#1b2a18' },
    { id: 'tovarna', name: ['Továrna', 'Factory'], fa: '#7c8590', fb: '#747d88', speck: ['#8d96a1', '#666e78'], top: '#c5ccd5', side: '#6c7682', edge: '#4c545e', crate: 'metal', c: ['#e08a2e', '#a85f17', '#f5b35f', '#5f340c'], frame: '#2f353d', bg: '#1d2127' },
    { id: 'sopka', name: ['Sopka', 'Volcano'], fa: '#3b3036', fb: '#43363c', speck: ['#ff6a2a', '#2a2226'], top: '#6c5d66', side: '#3a2f35', edge: '#241d21', crate: 'rock', c: ['#6e5a52', '#4a3a34', '#8d776d', '#ff7a2e'], frame: '#1a1316', bg: '#140d10' },
  ];
  const PLAYER = [
    { body: '#3d7bff', dark: '#2453c4', ball: '#ff4fa0' },
    { body: '#ff4d5e', dark: '#c42838', ball: '#ffd23f' },
    { body: '#2fc46b', dark: '#1d8a49', ball: '#59d7ff' },
    { body: '#ffb02e', dark: '#c47a10', ball: '#b06bff' },
  ];
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const hash = (x, y, k) => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // pevný blok (sloup, obvodová zeď): horní plocha, přední stěna, světlá hrana
  function block(g, x, y, T, th, frame) {
    const r = T * 0.12;
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.roundRect(x + T * 0.1, y + T * 0.16, T * 0.98, T * 0.96, r); g.fill();
    g.fillStyle = frame ? th.frame : th.edge; g.beginPath(); g.roundRect(x + 0.5, y + 0.5, T - 1, T - 1, r); g.fill();
    g.fillStyle = frame ? th.edge : th.side; g.beginPath(); g.roundRect(x + T * 0.04, y + T * 0.42, T * 0.92, T * 0.52, r); g.fill();
    const top = g.createLinearGradient(0, y, 0, y + T * 0.76);
    top.addColorStop(0, frame ? th.side : '#ffffff'); top.addColorStop(0.08, frame ? th.side : th.top); top.addColorStop(1, frame ? th.edge : th.side);
    g.fillStyle = top; g.beginPath(); g.roundRect(x + T * 0.04, y + T * 0.04, T * 0.92, T * 0.72, r); g.fill();
    if (!frame) {
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, T * 0.04);
      g.beginPath(); g.moveTo(x + T * 0.16, y + T * 0.12); g.lineTo(x + T * 0.84, y + T * 0.12); g.stroke();
      // drobná textura podle světa
      g.fillStyle = 'rgba(0,0,0,.1)';
      if (th.id === 'tovarna') for (const [a, b] of [[0.2, 0.25], [0.8, 0.25], [0.2, 0.62], [0.8, 0.62]]) { g.beginPath(); g.arc(x + T * a, y + T * b, T * 0.045, 0, TAU); g.fill(); }
      else if (th.id === 'snih') { g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(x + T * 0.5, y + T * 0.1, T * 0.42, T * 0.1, 0, 0, TAU); g.fill(); }
      else if (th.id === 'dzungle') { g.fillStyle = 'rgba(80,150,60,.55)'; g.beginPath(); g.ellipse(x + T * 0.3, y + T * 0.2, T * 0.22, T * 0.1, 0.3, 0, TAU); g.ellipse(x + T * 0.7, y + T * 0.66, T * 0.18, T * 0.08, -0.4, 0, TAU); g.fill(); }
      else if (th.id === 'sopka') { g.strokeStyle = 'rgba(255,110,40,.55)'; g.lineWidth = Math.max(1, T * 0.035); g.beginPath(); g.moveTo(x + T * 0.3, y + T * 0.2); g.lineTo(x + T * 0.42, y + T * 0.4); g.lineTo(x + T * 0.36, y + T * 0.6); g.stroke(); }
      else { g.fillRect(x + T * 0.18, y + T * 0.36, T * 0.64, Math.max(1, T * 0.03)); }
    }
  }

  // podlaha + sloupy + obvod (jednou na úroveň); `g` je mřížka hry
  function board(L, th, T, dpr) {
    const W = L.W, H = L.H, c = mk(W * T * dpr, H * T * dpr), g = c.getContext('2d');
    g.scale(dpr, dpr);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      g.fillStyle = (x + y) % 2 ? th.fa : th.fb; g.fillRect(x * T, y * T, T, T);
      for (let k = 0; k < 4; k++) {
        const r = hash(x, y, k);
        g.fillStyle = th.speck[k % 2]; g.globalAlpha = th.id === 'sopka' && k % 2 === 0 ? (r < 0.25 ? 0.7 : 0) : 0.55;
        const sx = x * T + hash(x, y, k + 9) * T, sy = y * T + hash(x, y, k + 17) * T;
        if (th.id === 'louka' || th.id === 'dzungle') { g.fillRect(sx, sy, Math.max(1, T * 0.04), T * 0.12); g.fillRect(sx + T * 0.05, sy + T * 0.03, Math.max(1, T * 0.04), T * 0.09); }
        else if (th.id === 'tovarna') { if (k === 0) { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x * T + 1, y * T + 1, T - 2, 1); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x * T + 1, y * T + T - 2, T - 2, 1); } }
        else { g.beginPath(); g.arc(sx, sy, T * (0.02 + r * 0.03), 0, TAU); g.fill(); }
      }
      g.globalAlpha = 1;
    }
    // stín obvodu dovnitř
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(T, T, (W - 2) * T, T * 0.18); g.fillRect(T, T, T * 0.14, (H - 2) * T);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (L.g[y * W + x] === 1) block(g, x * T, y * T, T, th, x === 0 || y === 0 || x === W - 1 || y === H - 1);
    return c;
  }

  // rozbitelná bedna (podle světa: dřevo, led, bambus, kov, kámen)
  function crate(th, T, dpr) {
    const c = mk(T * dpr, T * dpr), g = c.getContext('2d'); g.scale(dpr, dpr);
    const [base, dark, light, line] = th.c, r = T * 0.1, x = T * 0.07, y = T * 0.05, w = T * 0.86, h = T * 0.9;
    g.fillStyle = dark; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill();
    const top = g.createLinearGradient(0, y, 0, y + h * 0.78);
    top.addColorStop(0, light); top.addColorStop(1, base);
    g.fillStyle = top; g.beginPath(); g.roundRect(x, y, w, h * 0.78, r); g.fill();
    g.strokeStyle = line; g.lineWidth = Math.max(1, T * 0.045); g.lineCap = 'round';
    const ix = x + w * 0.14, iy = y + h * 0.12, iw = w * 0.72, ih = h * 0.56;
    if (th.crate === 'wood') {
      g.strokeRect(ix, iy, iw, ih);
      g.beginPath(); g.moveTo(ix, iy); g.lineTo(ix + iw, iy + ih); g.stroke();
      g.globalAlpha = 0.35; g.beginPath(); for (let k = 1; k < 3; k++) { g.moveTo(x + w * 0.05, y + h * 0.78 * k / 3); g.lineTo(x + w * 0.95, y + h * 0.78 * k / 3); } g.stroke(); g.globalAlpha = 1;
    } else if (th.crate === 'ice') {
      g.globalAlpha = 0.7; g.strokeStyle = '#ffffff';
      g.beginPath(); g.moveTo(ix, iy + ih * 0.2); g.lineTo(ix + iw * 0.35, iy); g.moveTo(ix + iw * 0.5, iy + ih); g.lineTo(ix + iw, iy + ih * 0.45); g.stroke();
      g.globalAlpha = 0.5; g.strokeStyle = line; g.beginPath(); g.moveTo(ix + iw * 0.2, iy + ih * 0.7); g.lineTo(ix + iw * 0.45, iy + ih * 0.4); g.lineTo(ix + iw * 0.7, iy + ih * 0.55); g.stroke(); g.globalAlpha = 1;
    } else if (th.crate === 'bamboo') {
      for (let k = 0; k < 4; k++) { const bx = x + w * (0.12 + k * 0.25); g.beginPath(); g.moveTo(bx, y + h * 0.06); g.lineTo(bx, y + h * 0.74); g.stroke(); g.beginPath(); g.moveTo(bx - w * 0.08, y + h * (0.3 + (k % 2) * 0.15)); g.lineTo(bx + w * 0.08, y + h * (0.3 + (k % 2) * 0.15)); g.stroke(); }
      g.strokeStyle = '#6b4a20'; g.lineWidth = Math.max(1.5, T * 0.07); g.beginPath(); g.moveTo(x, y + h * 0.4); g.lineTo(x + w, y + h * 0.4); g.stroke();
    } else if (th.crate === 'metal') {
      g.save(); g.beginPath(); g.roundRect(x, y, w, h * 0.78, r); g.clip();
      g.strokeStyle = '#2a2a2a'; g.lineWidth = T * 0.12; g.globalAlpha = 0.7;
      for (let k = -2; k < 4; k++) { g.beginPath(); g.moveTo(x + k * T * 0.3, y + h); g.lineTo(x + k * T * 0.3 + h, y - h * 0.1); g.stroke(); }
      g.restore(); g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,.6)'; for (const [a, b] of [[0.14, 0.12], [0.86, 0.12], [0.14, 0.68], [0.86, 0.68]]) { g.beginPath(); g.arc(x + w * a, y + h * b, T * 0.035, 0, TAU); g.fill(); }
    } else {
      // kámen s rozžhavenými prasklinami
      g.strokeStyle = line; g.lineWidth = Math.max(1.2, T * 0.05); g.shadowColor = line; g.shadowBlur = T * 0.2;
      g.beginPath(); g.moveTo(x + w * 0.2, y + h * 0.1); g.lineTo(x + w * 0.4, y + h * 0.35); g.lineTo(x + w * 0.3, y + h * 0.6); g.moveTo(x + w * 0.4, y + h * 0.35); g.lineTo(x + w * 0.75, y + h * 0.45); g.lineTo(x + w * 0.85, y + h * 0.7); g.stroke();
      g.shadowBlur = 0;
    }
    g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.roundRect(x + w * 0.08, y + h * 0.04, w * 0.84, h * 0.07, h * 0.03); g.fill();
    return c;
  }

  function bomb(T, dpr) {
    const c = mk(T * dpr, T * dpr), g = c.getContext('2d'); g.scale(dpr, dpr);
    const cx = T * 0.5, cy = T * 0.56, r = T * 0.34;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx + T * 0.04, T * 0.9, r * 0.9, r * 0.28, 0, 0, TAU); g.fill();
    const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    gr.addColorStop(0, '#5d6a8f'); gr.addColorStop(0.45, '#262c45'); gr.addColorStop(1, '#0c0e1a');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(cx - r * 0.38, cy - r * 0.42, r * 0.2, r * 0.13, -0.6, 0, TAU); g.fill();
    g.fillStyle = '#3a3f55'; g.beginPath(); g.roundRect(cx - r * 0.3, cy - r * 1.12, r * 0.6, r * 0.3, r * 0.08); g.fill();
    g.strokeStyle = '#c9a36a'; g.lineWidth = Math.max(1.2, T * 0.05); g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy - r * 1.1); g.quadraticCurveTo(cx + r * 0.2, cy - r * 1.6, cx + r * 0.62, cy - r * 1.45); g.stroke();
    return c;
  }
  const FUSE_TIP = [0.5 + 0.34 * 0.62, 0.56 - 0.34 * 1.45];

  // plamen: střed a vodorovný pruh (svislý = otočený)
  function flames(T, dpr) {
    const s = T * dpr;
    const center = mk(s, s), g = center.getContext('2d');
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.55);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, '#fff4a8'); gr.addColorStop(0.55, '#ffb22e'); gr.addColorStop(0.8, 'rgba(255,90,30,.85)'); gr.addColorStop(1, 'rgba(255,60,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    const strip = mk(4, s), h = strip.getContext('2d');
    const lg = h.createLinearGradient(0, 0, 0, s);
    lg.addColorStop(0, 'rgba(255,60,20,0)'); lg.addColorStop(0.16, 'rgba(255,90,30,.9)'); lg.addColorStop(0.32, '#ffb22e'); lg.addColorStop(0.44, '#fff4a8'); lg.addColorStop(0.5, '#ffffff');
    lg.addColorStop(0.56, '#fff4a8'); lg.addColorStop(0.68, '#ffb22e'); lg.addColorStop(0.84, 'rgba(255,90,30,.9)'); lg.addColorStop(1, 'rgba(255,60,20,0)');
    h.fillStyle = lg; h.fillRect(0, 0, 4, s);
    const vstrip = mk(s, 4), v = vstrip.getContext('2d');
    v.translate(s, 0); v.rotate(Math.PI / 2); v.drawImage(strip, 0, 0);
    return { center, strip, vstrip };
  }

  // vylepšení: lesklá dlaždice s ikonou
  const ITEM_COL = { 1: ['#4d7dff', '#2448b8'], 2: ['#ff8a2a', '#c4480f'], 3: ['#35cf73', '#178a43'], 9: ['#b06bff', '#6a2fc4'] };
  function items(T, dpr) {
    const out = {};
    for (const k of [1, 2, 3]) {
      const c = mk(T * dpr, T * dpr), g = c.getContext('2d'); g.scale(dpr, dpr);
      const [a, b] = ITEM_COL[k], x = T * 0.12, y = T * 0.1, w = T * 0.76, r = T * 0.16;
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.roundRect(x + T * 0.04, y + T * 0.08, w, w, r); g.fill();
      const gr = g.createLinearGradient(0, y, 0, y + w); gr.addColorStop(0, a); gr.addColorStop(1, b);
      g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, w, w, r); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = Math.max(1, T * 0.04); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.roundRect(x + w * 0.1, y + w * 0.06, w * 0.8, w * 0.3, r * 0.6); g.fill();
      const cx = T * 0.5, cy = T * 0.5;
      g.fillStyle = '#fff'; g.strokeStyle = '#fff';
      if (k === 1) {
        g.fillStyle = '#141826'; g.beginPath(); g.arc(cx, cy + T * 0.04, T * 0.17, 0, TAU); g.fill();
        g.strokeStyle = '#ffe9a8'; g.lineWidth = Math.max(1, T * 0.04); g.beginPath(); g.moveTo(cx + T * 0.08, cy - T * 0.1); g.quadraticCurveTo(cx + T * 0.14, cy - T * 0.2, cx + T * 0.2, cy - T * 0.18); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - T * 0.06, cy - T * 0.02, T * 0.04, 0, TAU); g.fill();
      } else if (k === 2) {
        g.fillStyle = '#fff3a0';
        g.beginPath(); g.moveTo(cx, cy - T * 0.24); g.bezierCurveTo(cx + T * 0.22, cy - T * 0.02, cx + T * 0.2, cy + T * 0.22, cx, cy + T * 0.22); g.bezierCurveTo(cx - T * 0.2, cy + T * 0.22, cx - T * 0.2, cy, cx - T * 0.06, cy - T * 0.1); g.bezierCurveTo(cx - T * 0.04, cy, cx + T * 0.02, cy - T * 0.06, cx, cy - T * 0.24); g.fill();
        g.fillStyle = '#ff5a1f'; g.beginPath(); g.ellipse(cx, cy + T * 0.1, T * 0.07, T * 0.1, 0, 0, TAU); g.fill();
      } else {
        g.beginPath(); g.moveTo(cx + T * 0.06, cy - T * 0.26); g.lineTo(cx - T * 0.14, cy + T * 0.04); g.lineTo(cx, cy + T * 0.04); g.lineTo(cx - T * 0.06, cy + T * 0.26); g.lineTo(cx + T * 0.15, cy - T * 0.06); g.lineTo(cx + T * 0.01, cy - T * 0.06); g.closePath(); g.fill();
      }
      out[k] = c;
    }
    return out;
  }

  // východ: poklop, po otevření vír
  function exitTile(g, x, y, T, open, t) {
    const cx = x + T / 2, cy = y + T / 2;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.roundRect(x + T * 0.08, y + T * 0.1, T * 0.84, T * 0.84, T * 0.18); g.fill();
    g.fillStyle = open ? '#2a1450' : '#4a4f63'; g.beginPath(); g.roundRect(x + T * 0.08, y + T * 0.06, T * 0.84, T * 0.84, T * 0.18); g.fill();
    if (!open) {
      g.strokeStyle = '#8b92a8'; g.lineWidth = Math.max(1, T * 0.05);
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + T * 0.14, y + T * 0.06 + T * 0.21 * k); g.lineTo(x + T * 0.86, y + T * 0.06 + T * 0.21 * k); g.stroke(); }
      g.fillStyle = '#c9a54a'; g.beginPath(); g.arc(cx, cy, T * 0.08, 0, TAU); g.fill();
      return;
    }
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = ['#d18bff', '#8f5bff', '#5fe3ff'][k]; g.lineWidth = Math.max(1.2, T * 0.06);
      g.beginPath(); g.arc(cx, cy, T * (0.32 - k * 0.09), t * (3 + k) + k, t * (3 + k) + k + 4.2); g.stroke();
    }
    g.fillStyle = '#fff'; g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6); g.beginPath(); g.arc(cx, cy, T * 0.06, 0, TAU); g.fill(); g.globalAlpha = 1;
  }

  // příšery: dva snímky (chůze), kreslí se do plátna velikosti políčka
  function enemySprites(T, dpr) {
    const out = {};
    const eyes = (g, cx, cy, s, angry) => {
      for (const k of [-1, 1]) {
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx + k * s * 0.32, cy, s * 0.2, s * 0.25, 0, 0, TAU); g.fill();
        g.fillStyle = '#1a1030'; g.beginPath(); g.arc(cx + k * s * 0.3 + s * 0.04, cy + s * 0.04, s * 0.1, 0, TAU); g.fill();
        if (angry) { g.strokeStyle = '#1a1030'; g.lineWidth = Math.max(1, s * 0.08); g.beginPath(); g.moveTo(cx + k * s * 0.55, cy - s * 0.32); g.lineTo(cx + k * s * 0.12, cy - s * 0.18); g.stroke(); }
      }
    };
    const draw = (type, f) => {
      const c = mk(T * dpr, T * dpr), g = c.getContext('2d'); g.scale(dpr, dpr);
      const cx = T / 2, s = T * 0.42, sq = f ? 1.06 : 0.96;
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(cx, T * 0.88, s * 0.7, s * 0.2, 0, 0, TAU); g.fill();
      if (type === 'balonek') {
        const cy = T * 0.44;
        const gr = g.createRadialGradient(cx - s * 0.3, cy - s * 0.35, s * 0.1, cx, cy, s);
        gr.addColorStop(0, '#ffd0a0'); gr.addColorStop(0.5, '#ff8a4c'); gr.addColorStop(1, '#e0452a');
        g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, s * sq, s / sq, 0, 0, TAU); g.fill();
        g.fillStyle = '#e0452a'; g.beginPath(); g.moveTo(cx - s * 0.12, cy + s / sq - 1); g.lineTo(cx + s * 0.12, cy + s / sq - 1); g.lineTo(cx, cy + s / sq + s * 0.18); g.fill();
        eyes(g, cx, cy - s * 0.1, s, false);
        g.strokeStyle = '#7a1e10'; g.lineWidth = Math.max(1, s * 0.08); g.beginPath(); g.arc(cx, cy + s * 0.2, s * 0.25, 0.3, Math.PI - 0.3); g.stroke();
      } else if (type === 'kapka') {
        const cy = T * 0.52;
        const gr = g.createLinearGradient(0, cy - s * 1.2, 0, cy + s);
        gr.addColorStop(0, '#9cf0ff'); gr.addColorStop(1, '#2f7dff');
        g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy - s * 1.1 * (f ? 0.95 : 1));
        g.bezierCurveTo(cx + s * 0.4, cy - s * 0.5, cx + s * sq, cy - s * 0.1, cx + s * sq * 0.9, cy + s * 0.35);
        g.arc(cx, cy + s * 0.35, s * sq * 0.9, 0, Math.PI); g.bezierCurveTo(cx - s * sq, cy - s * 0.1, cx - s * 0.4, cy - s * 0.5, cx, cy - s * 1.1 * (f ? 0.95 : 1)); g.fill();
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(cx - s * 0.4, cy - s * 0.2, s * 0.1, s * 0.22, 0.4, 0, TAU); g.fill();
        eyes(g, cx, cy + s * 0.2, s * 0.9, false);
      } else if (type === 'duch') {
        const cy = T * 0.44, b = cy + s * 0.75;
        g.fillStyle = 'rgba(190,140,255,.92)';
        g.beginPath(); g.arc(cx, cy, s * 0.85, Math.PI, 0); g.lineTo(cx + s * 0.85, b);
        for (let k = 0; k < 4; k++) { const x1 = cx + s * 0.85 - (k + 0.5) * s * 0.425, x2 = cx + s * 0.85 - (k + 1) * s * 0.425; g.quadraticCurveTo(x1, b + (k % 2 === (f ? 1 : 0) ? s * 0.25 : -s * 0.1), x2, b); }
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(cx - s * 0.35, cy - s * 0.4, s * 0.15, s * 0.25, 0.4, 0, TAU); g.fill();
        g.fillStyle = '#2a1050'; for (const k of [-1, 1]) { g.beginPath(); g.ellipse(cx + k * s * 0.3, cy, s * 0.13, s * 0.2, 0, 0, TAU); g.fill(); }
        g.beginPath(); g.ellipse(cx, cy + s * 0.35, s * 0.12, s * (f ? 0.12 : 0.08), 0, 0, TAU); g.fill();
      } else {
        const cy = T * 0.5, n = 10;
        g.fillStyle = '#8a0f22'; g.beginPath();
        for (let k = 0; k <= n * 2; k++) { const a = (k / (n * 2)) * TAU + (f ? 0.15 : 0), rr = k % 2 ? s * 0.74 : s * 1.02; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        g.fill();
        const gr = g.createRadialGradient(cx - s * 0.25, cy - s * 0.3, s * 0.1, cx, cy, s * 0.8);
        gr.addColorStop(0, '#ff8a8a'); gr.addColorStop(0.6, '#e5263f'); gr.addColorStop(1, '#a3132a');
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, s * 0.76, 0, TAU); g.fill();
        eyes(g, cx, cy - s * 0.08, s * 0.85, true);
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx - s * 0.3, cy + s * 0.3); for (let k = 0; k <= 4; k++) g.lineTo(cx - s * 0.3 + k * s * 0.15, cy + s * (k % 2 ? 0.45 : 0.3)); g.lineTo(cx + s * 0.3, cy + s * 0.3); g.fill();
      }
      return c;
    };
    for (const t of ['balonek', 'kapka', 'duch', 'lovec']) out[t] = [draw(t, 0), draw(t, 1)];
    return out;
  }

  // bombarďák: přilba s hledím, tělo v barvě hráče, anténa s kuličkou
  function bomber(g, x, y, T, col, dir, walk, t) {
    const c = PLAYER[col % PLAYER.length], s = T;
    const bob = walk ? Math.abs(Math.sin(t * 14)) * s * 0.04 : 0;
    const step = walk ? Math.sin(t * 14) : 0;
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, y + s * 0.4, s * 0.28, s * 0.09, 0, 0, TAU); g.fill();
    // nohy
    g.fillStyle = '#2a2f45';
    g.beginPath(); g.ellipse(x - s * 0.12, y + s * 0.34 - Math.max(0, step) * s * 0.06, s * 0.1, s * 0.07, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(x + s * 0.12, y + s * 0.34 - Math.max(0, -step) * s * 0.06, s * 0.1, s * 0.07, 0, 0, TAU); g.fill();
    const by = y + s * 0.14 - bob;
    // tělo
    g.fillStyle = c.dark; g.beginPath(); g.ellipse(x, by + s * 0.03, s * 0.22, s * 0.2, 0, 0, TAU); g.fill();
    g.fillStyle = c.body; g.beginPath(); g.ellipse(x, by, s * 0.21, s * 0.18, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffd34d'; g.fillRect(x - s * 0.2, by + s * 0.04, s * 0.4, s * 0.05);
    // ruce
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(x - s * 0.24, by + s * 0.02 + step * s * 0.03, s * 0.07, 0, TAU); g.arc(x + s * 0.24, by + s * 0.02 - step * s * 0.03, s * 0.07, 0, TAU); g.fill();
    // hlava
    const hy = by - s * 0.24;
    g.fillStyle = '#d9dde8'; g.beginPath(); g.arc(x, hy + s * 0.02, s * 0.25, 0, TAU); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, hy, s * 0.24, 0, TAU); g.fill();
    // anténa
    g.strokeStyle = '#2a2f45'; g.lineWidth = Math.max(1, s * 0.035); g.beginPath(); g.moveTo(x, hy - s * 0.22); g.lineTo(x, hy - s * 0.34); g.stroke();
    g.fillStyle = c.ball; g.beginPath(); g.arc(x, hy - s * 0.37, s * 0.07, 0, TAU); g.fill();
    if (dir !== 'u') {
      const ox = dir === 'l' ? -s * 0.07 : dir === 'r' ? s * 0.07 : 0, w = dir === 'd' ? s * 0.34 : s * 0.28;
      g.fillStyle = '#1d2240'; g.beginPath(); g.roundRect(x + ox - w / 2, hy - s * 0.08, w, s * 0.19, s * 0.09); g.fill();
      g.fillStyle = '#7ff3ff';
      const ex = dir === 'd' ? [-0.07, 0.07] : dir === 'l' ? [-0.1, 0.0] : [0.0, 0.1];
      for (const e of ex) { g.beginPath(); g.ellipse(x + ox + e * s, hy + s * 0.01, s * 0.03, s * 0.055, 0, 0, TAU); g.fill(); }
    } else {
      g.fillStyle = c.body; g.beginPath(); g.arc(x, hy + s * 0.02, s * 0.08, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(x - s * 0.1, hy - s * 0.12, s * 0.06, s * 0.035, -0.5, 0, TAU); g.fill();
  }

  return { THEMES, PLAYER, board, crate, bomb, FUSE_TIP, flames, items, exitTile, enemySprites, bomber, ITEM_COL };
})();
