'use strict';
// ── SKLÁDAČKA · malované obrazy ─────────────────────────────────────────────
// Každé semínko dá jeden obraz: motiv (maják, horské jezero, balóny, korálový útes, hrad,
// japonská zahrada, polární záře, noční město, tropický ostrov, poušť, vesmír) a denní dobu.
// Scéna se kreslí ve vrstvách se vzdušnou perspektivou, odrazy na vodě a nakonec přes ni
// přejedou tahy štětce, zrno plátna a vinětace, aby vypadala jako malba.
const JgArt = (() => {
  const TAU = Math.PI * 2, IW = 960, IH = 640;
  const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
  const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  // hladký šum 1D (pro hřebeny hor, duny, vlny)
  function noise(r) { const t = [...Array(512)].map(() => r()); return x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return t[i & 511] * (1 - u) + t[(i + 1) & 511] * u; }; }
  const fbm = (n, x, o = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * n(x * f); a *= 0.5; f *= 2.1; } return s; };

  // ── Denní doby ── obloha (shora dolů), slunce/měsíc, opar (vzdušná perspektiva), světlo
  const TIMES = {
    den: { sky: ['#3d8ee8', '#8cc8f8', '#d8f0ff'], sun: '#fff8dc', glow: '#ffffff', haze: '#cfe6f8', light: '#fff4d8', water: '#3a8ac8', night: false, name: ['za slunného dne', 'on a sunny day'] },
    rano: { sky: ['#5a7ac8', '#f0a8b8', '#ffe0c0'], sun: '#fff0d0', glow: '#ffd0b0', haze: '#f4d0d0', light: '#ffe0c8', water: '#7a8ac8', night: false, name: ['za úsvitu', 'at dawn'] },
    zapad: { sky: ['#2a2a6a', '#c8506a', '#ff9a4a', '#ffd88a'], sun: '#fff0b0', glow: '#ffb050', haze: '#e88a7a', light: '#ffc080', water: '#8a4a6a', night: false, name: ['při západu slunce', 'at sunset'] },
    soumrak: { sky: ['#141a48', '#4a3a8a', '#c86a8a', '#f8b088'], sun: '#ffe8c0', glow: '#ff9a8a', haze: '#7a5a9a', light: '#ffb8a0', water: '#4a3a7a', night: false, name: ['za soumraku', 'at dusk'] },
    noc: { sky: ['#040820', '#0c1a4a', '#1e3470'], sun: '#f4f6ff', glow: '#a8c0ff', haze: '#1e2c5a', light: '#c8d8ff', water: '#0e1c44', night: true, name: ['v noci', 'at night'] },
  };

  function sky(g, T, r, horizon) {
    const st = T.sky.map((c, i) => [i / (T.sky.length - 1) * (horizon / IH), c]); st.push([1, T.sky[T.sky.length - 1]]);
    g.fillStyle = lin(g, 0, 0, 0, IH, st); g.fillRect(0, 0, IW, IH);
    if (T.night) for (let i = 0; i < 380; i++) { const x = r() * IW, y = r() * horizon * 0.95, s = r() < 0.92 ? 0.4 + r() * 1 : 1.2 + r() * 1.4; g.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.65})`; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); if (s > 1.9) { g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.moveTo(x, y - 6); g.lineTo(x, y + 6); g.stroke(); } }
  }
  function sunMoon(g, T, x, y, R) {
    const gl = g.createRadialGradient(x, y, R * 0.5, x, y, R * 5); gl.addColorStop(0, rgba(T.glow, 0.55)); gl.addColorStop(1, rgba(T.glow, 0)); g.fillStyle = gl; g.fillRect(0, 0, IW, IH);
    g.fillStyle = T.sun; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
    if (T.night) { g.fillStyle = 'rgba(160,170,200,.35)'; for (const [dx, dy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [0.05, 0.4, 0.12]]) { g.beginPath(); g.arc(x + dx * R, y + dy * R, rr * R, 0, TAU); g.fill(); } }
  }
  function clouds(g, T, r, n, y0, y1, scale = 1) {
    for (let i = 0; i < n; i++) {
      const x = r() * IW, y = y0 + r() * (y1 - y0), w = (90 + r() * 160) * scale, h = w * 0.32;
      const top = T.night ? 'rgba(120,140,200,.25)' : rgba(mix(T.light, '#ffffff', 0.5), 0.9), bot = T.night ? 'rgba(40,50,90,.25)' : rgba(mix(T.haze, T.sky[1], 0.4), 0.75);
      for (let k = 0; k < 9; k++) { const cx = x + (r() - 0.5) * w, cy = y + (r() - 0.5) * h * 0.5, rr = h * (0.45 + r() * 0.5); g.fillStyle = lin(g, 0, cy - rr, 0, cy + rr, [[0, top], [1, bot]]); g.beginPath(); g.ellipse(cx, cy, rr * 1.3, rr, 0, 0, TAU); g.fill(); }
    }
  }
  // hřeben hor: vrací pole výšek; vyplní s vertikálním gradientem a sněhem
  function ridge(g, r, base, amp, col, opts = {}) {
    const n = noise(r), f = opts.freq || 0.004, ys = [];
    for (let x = 0; x <= IW + 8; x += 4) { const v = opts.sharp ? 1 - Math.abs(fbm(n, x * f, 5) * 2 - 1) : fbm(n, x * f, 5); ys.push(base - v * amp); }
    const path = () => { g.beginPath(); g.moveTo(0, IH); ys.forEach((y, i) => g.lineTo(i * 4, y)); g.lineTo(IW, IH); g.closePath(); };
    const top = Math.min(...ys);
    path(); g.fillStyle = lin(g, 0, top, 0, base + 40, [[0, opts.top || col], [1, col]]); g.fill();
    if (opts.snow) {
      g.save(); path(); g.clip();
      const sl = top + amp * opts.snow;
      g.fillStyle = opts.snowCol || '#f4f8ff'; g.beginPath(); g.moveTo(0, -10);
      for (let x = 0; x <= IW; x += 6) g.lineTo(x, sl + (n(x * 0.05) - 0.5) * 40 + Math.sin(x * 0.11) * 8);
      g.lineTo(IW, -10); g.closePath(); g.fill();
      // stinné svahy: kde hřeben klesá doprava, ztmavit
      // stinné svahy (hřeben klesá doprava): ztmavení od hřebene dolů, plynule mizí; po pixelech, ať nevznikají pruhy
      const len = Math.round(amp * 0.75), sh = document.createElement('canvas'); sh.width = IW; sh.height = IH;
      const sx = sh.getContext('2d'), im = sx.createImageData(IW, IH), px = im.data;
      for (let x = 0; x < IW; x++) {
        const i = Math.min(ys.length - 4, Math.max(3, Math.round(x / 4))), d = (ys[i + 3] - ys[i - 3]) / 6, k = d > 0 ? Math.min(1, d / 4) * 70 : 0;
        if (!k) continue;
        const y0 = Math.max(0, Math.floor(ys[i])); for (let y = y0; y < Math.min(IH, y0 + len); y++) { const o = (y * IW + x) * 4; px[o] = 20; px[o + 1] = 24; px[o + 2] = 60; px[o + 3] = k * (1 - (y - y0) / len); }
      }
      sx.putImageData(im, 0, 0); g.filter = 'blur(2px)'; g.drawImage(sh, 0, 0); g.filter = 'none';
      g.restore();
    }
    return ys;
  }
  // jehličnany a listnáče
  function pine(g, x, y, h, col, lightCol) {
    const w = h * 0.36;
    g.fillStyle = mix(col, '#000000', 0.3); g.fillRect(x - h * 0.03, y - h * 0.15, h * 0.06, h * 0.15);
    for (let k = 0; k < 4; k++) { const ty = y - h * (0.12 + k * 0.22), tw = w * (1 - k * 0.2); g.fillStyle = col; g.beginPath(); g.moveTo(x - tw, ty); g.lineTo(x, ty - h * 0.36); g.lineTo(x + tw, ty); g.closePath(); g.fill(); if (lightCol) { g.fillStyle = lightCol; g.beginPath(); g.moveTo(x - tw * 0.9, ty); g.lineTo(x, ty - h * 0.34); g.lineTo(x - tw * 0.1, ty); g.closePath(); g.fill(); } }
  }
  function tree(g, r, x, y, h, cols) {
    g.strokeStyle = '#4a3020'; g.lineWidth = h * 0.07; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h * 0.45); g.stroke();
    for (let k = 0; k < 9; k++) { const a = r() * TAU, d = r() * h * 0.28, cx = x + Math.cos(a) * d, cy = y - h * 0.62 + Math.sin(a) * d * 0.7, rr = h * (0.16 + r() * 0.14); g.fillStyle = cols[k % cols.length]; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.fill(); }
  }
  // odraz horní části obrazu pod hladinou s vlnkami a barvou vody
  function reflect(g, c, wy, T, r, strength = 0.55) {
    const h = IH - wy, src = document.createElement('canvas'); src.width = IW; src.height = h;
    const s = src.getContext('2d'); s.translate(0, h); s.scale(1, -1); s.drawImage(c, 0, wy - h, IW, h, 0, 0, IW, h);
    g.save(); g.globalAlpha = strength;
    for (let y = 0; y < h; y += 2) { const off = Math.sin(y * 0.35 + r() * 0.5) * (1 + y * 0.03); g.drawImage(src, 0, y, IW, 2, off, wy + y, IW, 2); }
    g.restore();
    g.fillStyle = lin(g, 0, wy, 0, IH, [[0, rgba(T.water, 0.25)], [1, rgba(T.water, 0.7)]]); g.fillRect(0, wy, IW, h);
    // odlesky
    g.strokeStyle = rgba(T.light, 0.35); g.lineWidth = 1.2;
    for (let i = 0; i < 70; i++) { const y = wy + 4 + Math.pow(r(), 1.5) * h, x = r() * IW, l = 8 + (y - wy) * 0.25 * r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); }
  }
  function sunPath(g, T, x, wy) {
    g.fillStyle = rgba(T.glow, 0.45);
    for (let y = wy + 2; y < IH; y += 5) { const w = 10 + (y - wy) * 0.35 + Math.sin(y) * 6; g.fillRect(x - w / 2 + Math.sin(y * 0.7) * 8, y, w, 2); }
  }
  function window_(g, x, y, w, h, lit) { g.fillStyle = lit ? '#ffd870' : '#3a4050'; g.fillRect(x, y, w, h); if (lit) { g.fillStyle = 'rgba(255,220,120,.25)'; g.beginPath(); g.arc(x + w / 2, y + h / 2, w * 2.4, 0, TAU); g.fill(); } }

  // ── Motivy ── každý vrací [cs, en] název
  const SCENES = [
    // 1. maják na útesu nad mořem
    { times: ['den', 'zapad', 'soumrak', 'noc'], name: ['Maják', 'The lighthouse'], draw(g, c, r, T) {
      const wy = IH * 0.62; sky(g, T, r, wy); sunMoon(g, T, IW * (0.2 + r() * 0.25), wy - 90 - r() * 100, T.night ? 32 : 40); clouds(g, T, r, 6, 50, wy * 0.55);
      ridge(g, r, wy, 40, mix(T.haze, '#4a6a8a', 0.5), { freq: 0.006 });
      g.fillStyle = mix(T.water, T.sky[T.sky.length - 1], 0.25); g.fillRect(0, wy, IW, IH - wy);
      reflect(g, c, wy, T, r, 0.35); sunPath(g, T, IW * 0.3, wy);
      // útes vpravo
      const cx = IW * 0.66; g.fillStyle = lin(g, cx, wy - 120, cx + 200, IH, [[0, mix('#8a7a66', T.haze, 0.2)], [0.5, mix('#5a4a3a', T.haze, 0.15)], [1, '#2a2018']]);
      g.beginPath(); g.moveTo(cx - 40, IH); g.lineTo(cx - 10, wy + 10); g.lineTo(cx + 12, wy - 60); g.lineTo(cx + 30, wy - 92); g.lineTo(cx + 90, wy - 112); g.lineTo(IW, wy - 128); g.lineTo(IW, IH); g.fill();
      g.strokeStyle = 'rgba(30,20,10,.35)'; g.lineWidth = 2; for (let k = 0; k < 9; k++) { const x0 = cx + 10 + r() * 200, y0 = wy - 80 + r() * 160; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 10 + r() * 20, y0 + 20 + r() * 40); g.stroke(); }
      g.fillStyle = mix('#5a8a3a', T.haze, 0.25); g.beginPath(); g.moveTo(cx + 26, wy - 90); g.quadraticCurveTo(cx + 60, wy - 118, cx + 90, wy - 114); g.lineTo(IW, wy - 130); g.lineTo(IW, wy - 110); g.lineTo(cx + 34, wy - 76); g.fill();
      // maják
      const lx = cx + 150, ly = wy - 120, lh = 150;
      g.fillStyle = '#f4f0e8'; g.beginPath(); g.moveTo(lx - 22, ly); g.lineTo(lx - 14, ly - lh); g.lineTo(lx + 14, ly - lh); g.lineTo(lx + 22, ly); g.fill();
      g.fillStyle = '#c83a3a'; for (let k = 0; k < 3; k++) { const y0 = ly - lh * (0.15 + k * 0.3), y1 = y0 - lh * 0.13; g.beginPath(); g.moveTo(lx - 22 + (ly - y0) / lh * 8, y0); g.lineTo(lx - 22 + (ly - y1) / lh * 8, y1); g.lineTo(lx + 22 - (ly - y1) / lh * 8, y1); g.lineTo(lx + 22 - (ly - y0) / lh * 8, y0); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(lx + 4, ly); g.lineTo(lx + 3, ly - lh); g.lineTo(lx + 14, ly - lh); g.lineTo(lx + 22, ly); g.fill();
      g.fillStyle = '#2a2a3a'; g.fillRect(lx - 18, ly - lh - 4, 36, 6); g.fillStyle = '#ffe9a0'; g.fillRect(lx - 11, ly - lh - 30, 22, 26); g.fillStyle = '#c83a3a'; g.beginPath(); g.moveTo(lx - 16, ly - lh - 30); g.lineTo(lx, ly - lh - 50); g.lineTo(lx + 16, ly - lh - 30); g.fill();
      if (T.night || T.sky[0] === '#141a48') { g.save(); g.globalCompositeOperation = 'lighter'; const bm = g.createLinearGradient(lx, 0, lx - 520, 0); bm.addColorStop(0, 'rgba(255,240,180,.55)'); bm.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = bm; g.beginPath(); g.moveTo(lx, ly - lh - 17); g.lineTo(lx - 520, ly - lh - 90); g.lineTo(lx - 520, ly - lh + 40); g.fill(); g.restore(); }
      // domek strážce
      g.fillStyle = '#e8e0d0'; g.fillRect(lx - 70, ly - 34, 46, 34); g.fillStyle = '#7a3a2a'; g.beginPath(); g.moveTo(lx - 76, ly - 34); g.lineTo(lx - 47, ly - 54); g.lineTo(lx - 18, ly - 34); g.fill(); window_(g, lx - 56, ly - 26, 10, 10, T.night || r() < 0.4);
      // plachetnice a racci
      const bx = IW * (0.25 + r() * 0.2), by = wy + 30;
      g.fillStyle = '#5a3a2a'; g.beginPath(); g.moveTo(bx - 34, by); g.lineTo(bx + 34, by); g.lineTo(bx + 24, by + 12); g.lineTo(bx - 26, by + 12); g.fill();
      g.fillStyle = '#f8f4ea'; g.beginPath(); g.moveTo(bx, by - 2); g.lineTo(bx, by - 70); g.lineTo(bx + 32, by - 4); g.fill(); g.fillStyle = '#e8e0d4'; g.beginPath(); g.moveTo(bx - 3, by - 6); g.lineTo(bx - 3, by - 56); g.lineTo(bx - 28, by - 6); g.fill();
      g.strokeStyle = T.night ? 'rgba(220,230,255,.6)' : '#2a2a3a'; g.lineWidth = 2; for (let i = 0; i < 5; i++) { const x = IW * 0.1 + r() * IW * 0.5, y = 80 + r() * 160, s = 6 + r() * 6; g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x - s / 2, y - s * 0.6, x, y); g.quadraticCurveTo(x + s / 2, y - s * 0.6, x + s, y); g.stroke(); }
      // vlny u útesu
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; for (let i = 0; i < 18; i++) { const x = cx - 40 + r() * 80, y = wy + 10 + r() * 80; g.beginPath(); g.arc(x, y, 8 + r() * 10, Math.PI * 1.1, Math.PI * 1.8); g.stroke(); }
    } },
    // 2. horské jezero s chatou
    { times: ['den', 'rano', 'zapad', 'noc'], name: ['Horské jezero', 'The mountain lake'], draw(g, c, r, T) {
      const wy = IH * 0.6; sky(g, T, r, wy); sunMoon(g, T, IW * (0.3 + r() * 0.4), wy - 180 - r() * 60, 34); clouds(g, T, r, 5, 40, 200);
      ridge(g, r, wy - 70, 230, mix('#5a6a9a', T.haze, 0.55), { sharp: true, freq: 0.0035, snow: 0.35, top: mix('#8a9ac8', T.haze, 0.5), snowCol: mix('#ffffff', T.light, 0.4) });
      ridge(g, r, wy - 10, 150, mix('#3a5a6a', T.haze, 0.35), { sharp: true, freq: 0.005, snow: 0.22, snowCol: mix('#f0f4ff', T.light, 0.3) });
      // les na břehu
      const fc = mix('#1e4a2a', T.haze, T.night ? 0.5 : 0.2), fl = mix('#3a7a3a', T.light, 0.15);
      for (let i = 0; i < 70; i++) { const x = r() * IW, h = 40 + r() * 50; pine(g, x, wy + 2, h, fc, T.night ? null : rgba(fl, 0.6)); }
      reflect(g, c, wy, T, r, 0.6);
      // chata s molem
      const hx = IW * (0.15 + r() * 0.15), hy = wy - 4;
      g.fillStyle = '#6a4228'; g.fillRect(hx, hy - 50, 80, 50); g.fillStyle = '#3a2418'; for (let k = 0; k < 6; k++) g.fillRect(hx, hy - 50 + k * 8.5, 80, 1.5);
      g.fillStyle = '#4a2a1e'; g.beginPath(); g.moveTo(hx - 10, hy - 48); g.lineTo(hx + 40, hy - 84); g.lineTo(hx + 90, hy - 48); g.fill();
      window_(g, hx + 14, hy - 38, 14, 14, true); window_(g, hx + 52, hy - 38, 14, 14, T.night || r() < 0.5);
      g.fillStyle = '#e8e0d0'; g.fillRect(hx + 60, hy - 96, 8, 20); if (!T.night) { g.fillStyle = 'rgba(230,230,240,.5)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(hx + 66 + k * 6, hy - 104 - k * 12, 6 + k * 2, 0, TAU); g.fill(); } }
      g.fillStyle = '#5a3a24'; g.fillRect(hx + 80, hy + 2, 90, 6); for (let k = 0; k < 4; k++) g.fillRect(hx + 90 + k * 24, hy + 2, 4, 22);
      // loďka
      const bx = IW * (0.55 + r() * 0.25), by = wy + 60; g.fillStyle = '#8a3a2a'; g.beginPath(); g.moveTo(bx - 30, by); g.quadraticCurveTo(bx, by + 16, bx + 30, by); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(bx, by + 6, 30 + k * 16, 4 + k * 2, 0, 0, TAU); g.stroke(); }
      // tráva v popředí
      g.fillStyle = mix('#2a5a2a', T.haze, T.night ? 0.5 : 0.1); for (let i = 0; i < 160; i++) { const x = r() * IW, h = 10 + r() * 30; g.beginPath(); g.moveTo(x, IH); g.quadraticCurveTo(x + (r() - 0.5) * 10, IH - h * 0.6, x + (r() - 0.5) * 16, IH - h); g.lineTo(x + 3, IH); g.fill(); }
    } },
    // 3. horkovzdušné balóny nad údolím
    { times: ['den', 'rano', 'zapad'], name: ['Balóny nad údolím', 'Balloons over the valley'], draw(g, c, r, T) {
      const hy = IH * 0.58; sky(g, T, r, hy); sunMoon(g, T, IW * (0.7 + r() * 0.2), 120, 38); clouds(g, T, r, 8, 30, 260, 1.2);
      ridge(g, r, hy, 80, mix('#6a8ab8', T.haze, 0.6), { freq: 0.004 });
      ridge(g, r, hy + 60, 70, mix('#5a9a4a', T.haze, 0.35), { freq: 0.003, top: mix('#8aca5a', T.light, 0.2) });
      // pole – patchwork
      const fields = ['#8aca4a', '#c8d85a', '#e8c86a', '#6aaa3a', '#a8c84a', '#d8a85a'];
      for (let row = 0; row < 5; row++) { const y0 = hy + 70 + row * 30 + row * row * 8, y1 = y0 + 30 + row * 14; let x = -r() * 80; while (x < IW) { const w = 90 + r() * 140 + row * 40; g.fillStyle = mix(fields[Math.floor(r() * fields.length)], T.haze, 0.25 - row * 0.05); g.beginPath(); g.moveTo(x, y0); g.lineTo(x + w, y0 + (r() - 0.5) * 8); g.lineTo(x + w + row * 12, y1); g.lineTo(x - row * 12, y1); g.fill(); g.strokeStyle = 'rgba(60,90,30,.35)'; g.lineWidth = 1; for (let k = 0; k < 4 + row; k++) { const yy = y0 + (k + 1) * (y1 - y0) / (5 + row); g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); } x += w; } }
      for (let i = 0; i < 26; i++) tree(g, r, r() * IW, hy + 80 + r() * 200, 20 + r() * 30, ['#3a7a2a', '#4a8a32', '#2e6a24']);
      // vesnička s kostelem
      const vx = IW * (0.3 + r() * 0.4), vy = hy + 90;
      for (let k = 0; k < 7; k++) { const x = vx + (k - 3) * 26 + r() * 10, w = 20; g.fillStyle = '#f0e8d8'; g.fillRect(x, vy - 16, w, 16); g.fillStyle = '#c8502a'; g.beginPath(); g.moveTo(x - 3, vy - 16); g.lineTo(x + w / 2, vy - 28); g.lineTo(x + w + 3, vy - 16); g.fill(); }
      g.fillStyle = '#f4ece0'; g.fillRect(vx - 6, vy - 56, 14, 40); g.fillStyle = '#4a6a8a'; g.beginPath(); g.moveTo(vx - 9, vy - 56); g.lineTo(vx + 1, vy - 82); g.lineTo(vx + 11, vy - 56); g.fill();
      // balóny
      const P = [['#e83a3a', '#ffd23a'], ['#3a7ae8', '#ffffff'], ['#3ac87a', '#ffe14a'], ['#a84ae8', '#ff8ac8'], ['#ff8a2a', '#3a4ae8'], ['#e8e83a', '#e83a8a']];
      const nb = 5 + Math.floor(r() * 3), list = [];
      for (let i = 0; i < nb; i++) list.push({ x: 80 + r() * (IW - 160), y: 90 + r() * (hy - 80), s: 0.35 + r() * 0.75, p: P[Math.floor(r() * P.length)] });
      list.sort((a, b) => a.s - b.s);
      for (const b of list) {
        const R = 58 * b.s, x = b.x, y = b.y, fog = 0.5 - b.s * 0.45;
        g.save(); g.beginPath(); g.moveTo(x, y + R * 1.25); g.bezierCurveTo(x - R * 1.35, y + R * 0.4, x - R * 1.2, y - R * 1.1, x, y - R * 1.05); g.bezierCurveTo(x + R * 1.2, y - R * 1.1, x + R * 1.35, y + R * 0.4, x, y + R * 1.25); g.clip();
        for (let k = -4; k <= 4; k++) { g.fillStyle = mix(k % 2 ? b.p[0] : b.p[1], T.haze, Math.max(0, fog)); g.beginPath(); g.ellipse(x + k * R * 0.28, y, R * 0.16, R * 1.4, 0, 0, TAU); g.fill(); }
        g.fillStyle = lin(g, x - R, 0, x + R, 0, [[0, 'rgba(255,255,255,.35)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,.35)']]); g.fillRect(x - R * 1.5, y - R * 1.2, R * 3, R * 2.6);
        g.restore();
        g.strokeStyle = '#4a3a2a'; g.lineWidth = Math.max(1, b.s); g.beginPath(); g.moveTo(x - R * 0.3, y + R * 1.18); g.lineTo(x - R * 0.18, y + R * 1.55); g.moveTo(x + R * 0.3, y + R * 1.18); g.lineTo(x + R * 0.18, y + R * 1.55); g.stroke();
        g.fillStyle = mix('#8a5a2a', T.haze, Math.max(0, fog)); g.fillRect(x - R * 0.2, y + R * 1.55, R * 0.4, R * 0.28);
      }
    } },
    // 4. korálový útes pod hladinou
    { times: ['den'], name: ['Korálový útes', 'The coral reef'], draw(g, c, r, T) {
      g.fillStyle = lin(g, 0, 0, 0, IH, [[0, '#5ad0e8'], [0.4, '#1a8ac0'], [1, '#0a3a6a']]); g.fillRect(0, 0, IW, IH);
      g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++) { const x = r() * IW, w = 30 + r() * 60; g.fillStyle = lin(g, 0, 0, 0, IH, [[0, 'rgba(255,255,220,.22)'], [1, 'rgba(255,255,220,0)']]); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 3 - 200, IH); g.lineTo(x - 200, IH); g.fill(); } g.restore();
      // písek a skály
      ridge(g, r, IH * 0.88, 60, '#d8c088', { freq: 0.004, top: '#f0dca8' });
      for (let i = 0; i < 7; i++) { const x = r() * IW, y = IH * 0.8 + r() * 60, w = 60 + r() * 120; g.fillStyle = lin(g, 0, y - w * 0.4, 0, y + 20, [[0, '#7a6a8a'], [1, '#3a2a4a']]); g.beginPath(); g.ellipse(x, y, w, w * 0.45, 0, Math.PI, 0); g.fill(); }
      // korály
      const CC = ['#ff6a8a', '#ff9a4a', '#ffd04a', '#c86aff', '#ff4a6a', '#4ae8c8', '#ffb8d8'];
      for (let i = 0; i < 26; i++) {
        const x = r() * IW, y = IH * 0.78 + r() * IH * 0.2, col = CC[Math.floor(r() * CC.length)], kind = Math.floor(r() * 3), s = 0.6 + r() * 0.9;
        g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round';
        if (kind === 0) { const br = (bx, by, a, l, w, d) => { const ex = bx + Math.cos(a) * l, ey = by + Math.sin(a) * l; g.lineWidth = w; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke(); if (d < 4) { br(ex, ey, a - 0.45 - r() * 0.2, l * 0.75, w * 0.75, d + 1); br(ex, ey, a + 0.45 + r() * 0.2, l * 0.75, w * 0.75, d + 1); } }; br(x, y, -Math.PI / 2, 34 * s, 9 * s, 0); }
        else if (kind === 1) { for (let k = 0; k < 7; k++) { g.beginPath(); g.ellipse(x + (k - 3) * 9 * s, y - 20 * s - Math.abs(k - 3) * -4 * s, 6 * s, 22 * s, (k - 3) * 0.15, 0, TAU); g.fill(); } }
        else { g.beginPath(); g.arc(x, y - 18 * s, 26 * s, Math.PI, 0); g.fill(); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1.5; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x, y - 18 * s, 26 * s - k * 5 * s, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); } }
      }
      // mořské řasy
      for (let i = 0; i < 18; i++) { const x = r() * IW, h = 80 + r() * 180; g.strokeStyle = r() < 0.5 ? '#2a9a5a' : '#4ab86a'; g.lineWidth = 5 + r() * 4; g.beginPath(); g.moveTo(x, IH); for (let k = 1; k <= 8; k++) g.lineTo(x + Math.sin(k * 0.9 + i) * 12, IH - h * k / 8); g.stroke(); }
      // ryby a želva
      const FC = [['#ff8a2a', '#ffffff'], ['#ffe14a', '#2a6ae8'], ['#4ab8ff', '#ffe14a'], ['#ff4a8a', '#ffd0e0'], ['#8aff6a', '#2a8a4a']];
      const school = (x0, y0, n, s, p, dir) => { for (let k = 0; k < n; k++) { const x = x0 + (r() - 0.5) * 160, y = y0 + (r() - 0.5) * 90; g.save(); g.translate(x, y); g.scale(dir * s, s); g.fillStyle = p[0]; g.beginPath(); g.ellipse(0, 0, 16, 9, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-12, 0); g.lineTo(-24, -9); g.lineTo(-24, 9); g.fill(); g.fillStyle = p[1]; g.fillRect(-2, -8, 4, 16); g.fillStyle = '#1a1a2a'; g.beginPath(); g.arc(8, -2, 2, 0, TAU); g.fill(); g.restore(); } };
      for (let i = 0; i < 4; i++) school(r() * IW, 120 + r() * 300, 3 + Math.floor(r() * 6), 0.7 + r() * 0.8, FC[Math.floor(r() * FC.length)], r() < 0.5 ? 1 : -1);
      const tx = IW * (0.2 + r() * 0.6), ty = 160 + r() * 120; g.save(); g.translate(tx, ty); g.rotate(-0.2);
      g.fillStyle = '#8aa85a'; for (const [dx, dy, a] of [[-38, -22, -0.8], [-34, 26, 0.9], [36, -26, -0.4], [34, 28, 0.5]]) { g.beginPath(); g.ellipse(dx, dy, 26, 9, a, 0, TAU); g.fill(); }
      g.beginPath(); g.ellipse(58, 0, 16, 12, 0, 0, TAU); g.fill(); g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(64, -3, 2.5, 0, TAU); g.fill();
      g.fillStyle = lin(g, 0, -34, 0, 34, [[0, '#a87a3a'], [1, '#5a3a1a']]); g.beginPath(); g.ellipse(0, 0, 50, 34, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,24,10,.6)'; g.lineWidth = 2; for (const [x, y] of [[0, 0], [-24, -12], [24, -12], [-24, 14], [24, 14]]) { g.beginPath(); for (let k = 0; k <= 6; k++) { const a = k / 6 * TAU; g.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 10); } g.stroke(); }
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; for (let i = 0; i < 40; i++) { const x = r() * IW, y = r() * IH * 0.8, s = 2 + r() * 6; g.beginPath(); g.arc(x, y, s, 0, TAU); g.stroke(); }
    } },
    // 5. pohádkový hrad na kopci
    { times: ['den', 'zapad', 'soumrak', 'noc'], name: ['Hrad na kopci', 'The castle on the hill'], draw(g, c, r, T) {
      const hy = IH * 0.66; sky(g, T, r, hy); sunMoon(g, T, IW * (0.15 + r() * 0.2), 120 + r() * 60, 36); clouds(g, T, r, 6, 40, 220);
      ridge(g, r, hy - 40, 120, mix('#6a7ab8', T.haze, 0.6), { freq: 0.004 });
      // kopec s hradem
      const kx = IW * (0.45 + r() * 0.15), top = hy - 120;
      g.fillStyle = lin(g, 0, top, 0, IH, [[0, mix('#6aaa3a', T.haze, T.night ? 0.6 : 0.2)], [1, mix('#2a5a1e', T.haze, T.night ? 0.5 : 0.1)]]);
      g.beginPath(); g.moveTo(0, IH); g.lineTo(0, hy + 40); g.quadraticCurveTo(kx - 240, hy - 40, kx - 120, top + 10); g.quadraticCurveTo(kx, top - 14, kx + 140, top + 10); g.quadraticCurveTo(kx + 300, hy, IW, hy + 20); g.lineTo(IW, IH); g.fill();
      const stone = mix('#d8d0c0', T.haze, T.night ? 0.55 : 0.1), shadowS = mix('#9a9080', T.haze, T.night ? 0.55 : 0.1), roof = mix(['#3a5ac8', '#c83a3a', '#5a3a9a'][Math.floor(r() * 3)], T.haze, T.night ? 0.4 : 0);
      const tower = (x, w, h, base) => {
        g.fillStyle = stone; g.fillRect(x - w / 2, base - h, w, h); g.fillStyle = shadowS; g.fillRect(x + w * 0.15, base - h, w * 0.35, h);
        g.fillStyle = roof; g.beginPath(); g.moveTo(x - w / 2 - 6, base - h); g.lineTo(x, base - h - w * 1.6); g.lineTo(x + w / 2 + 6, base - h); g.fill();
        g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.moveTo(x, base - h - w * 1.6); g.lineTo(x + w / 2 + 6, base - h); g.lineTo(x + w * 0.1, base - h); g.fill();
        g.strokeStyle = '#5a4a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, base - h - w * 1.6); g.lineTo(x, base - h - w * 1.6 - 22); g.stroke();
        g.fillStyle = mix('#ffd23a', T.haze, 0.1); g.beginPath(); g.moveTo(x, base - h - w * 1.6 - 22); g.lineTo(x + 16, base - h - w * 1.6 - 17); g.lineTo(x, base - h - w * 1.6 - 12); g.fill();
        for (let k = 0; k < Math.floor(h / 34); k++) window_(g, x - 4, base - h + 16 + k * 30, 8, 13, T.night || T.sky[0] === '#141a48' ? r() < 0.8 : false);
      };
      const base = top + 12;
      g.fillStyle = stone; g.fillRect(kx - 130, base - 70, 260, 70); g.fillStyle = shadowS; g.fillRect(kx + 40, base - 70, 90, 70);
      for (let x = kx - 130; x < kx + 130; x += 18) { g.fillStyle = stone; g.fillRect(x, base - 82, 11, 12); }
      g.fillStyle = '#4a3020'; g.beginPath(); g.moveTo(kx - 18, base); g.lineTo(kx - 18, base - 34); g.arc(kx, base - 34, 18, Math.PI, 0); g.lineTo(kx + 18, base); g.fill();
      tower(kx - 130, 44, 150, base); tower(kx + 130, 44, 130, base); tower(kx - 40, 56, 210, base - 60); tower(kx + 52, 40, 170, base - 60);
      // cesta a vesnice
      g.strokeStyle = mix('#d8c088', T.haze, T.night ? 0.5 : 0.1); g.lineWidth = 18; g.lineCap = 'round'; g.beginPath(); g.moveTo(kx, base + 4); g.bezierCurveTo(kx + 160, hy - 10, kx - 220, hy + 80, kx - 60, IH + 20); g.stroke();
      for (let i = 0; i < 9; i++) { const x = r() * IW, y = hy + 60 + r() * 140, s = 0.8 + r() * 0.6; g.fillStyle = mix('#f0e4cc', T.haze, T.night ? 0.55 : 0.1); g.fillRect(x, y - 22 * s, 30 * s, 22 * s); g.fillStyle = mix('#a84a2a', T.haze, T.night ? 0.45 : 0.05); g.beginPath(); g.moveTo(x - 4 * s, y - 22 * s); g.lineTo(x + 15 * s, y - 38 * s); g.lineTo(x + 34 * s, y - 22 * s); g.fill(); window_(g, x + 10 * s, y - 15 * s, 8 * s, 8 * s, T.night || r() < 0.3); }
      for (let i = 0; i < 30; i++) tree(g, r, r() * IW, hy + 40 + r() * 200, 26 + r() * 30, T.night ? ['#1e3a2a', '#2a4a32'] : ['#3a7a2a', '#4e9a34', '#2e6a24']);
    } },
    // 6. japonská zahrada se sakurou
    { times: ['den', 'rano', 'zapad'], name: ['Sakurová zahrada', 'The cherry blossom garden'], draw(g, c, r, T) {
      const wy = IH * 0.64; sky(g, T, r, wy); sunMoon(g, T, IW * (0.65 + r() * 0.2), 150, 44);
      // hora Fudži
      const fx = IW * (0.35 + r() * 0.2); g.fillStyle = lin(g, 0, 150, 0, wy, [[0, mix('#6a7ac8', T.haze, 0.5)], [1, mix('#9aa8d8', T.haze, 0.6)]]); g.beginPath(); g.moveTo(fx - 420, wy); g.quadraticCurveTo(fx - 120, 230, fx - 40, 168); g.lineTo(fx + 40, 168); g.quadraticCurveTo(fx + 120, 230, fx + 420, wy); g.fill();
      g.fillStyle = '#f8fbff'; g.beginPath(); g.moveTo(fx - 40, 168); g.lineTo(fx + 40, 168); g.lineTo(fx + 80, 214); for (let k = 0; k <= 8; k++) g.lineTo(fx + 80 - k * 20, 214 + (k % 2 ? 22 : 4)); g.lineTo(fx - 80, 214); g.fill();
      clouds(g, T, r, 4, 220, 300, 1.4);
      // jezírko s odrazem
      g.fillStyle = mix('#5a8a4a', T.haze, 0.2); g.fillRect(0, wy - 20, IW, 30);
      // pagoda
      const px = IW * (0.72 + r() * 0.12), pb = wy - 10;
      for (let k = 0; k < 4; k++) { const w = 110 - k * 20, y = pb - k * 52; g.fillStyle = '#c8342a'; g.fillRect(px - w / 2 + 10, y - 40, w - 20, 40); g.fillStyle = '#2a2a3a'; g.beginPath(); g.moveTo(px - w / 2 - 22, y - 34); g.quadraticCurveTo(px - w / 2, y - 44, px - w / 2 + 10, y - 52); g.lineTo(px + w / 2 - 10, y - 52); g.quadraticCurveTo(px + w / 2, y - 44, px + w / 2 + 22, y - 34); g.lineTo(px + w / 2 - 6, y - 40); g.lineTo(px - w / 2 + 6, y - 40); g.fill(); window_(g, px - 7, y - 32, 14, 18, r() < 0.5); }
      g.strokeStyle = '#2a2a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(px, pb - 4 * 52 - 4); g.lineTo(px, pb - 4 * 52 - 40); g.stroke();
      reflect(g, c, wy, T, r, 0.55);
      // červený most
      const bx = IW * 0.42; g.strokeStyle = '#d8382a'; g.lineWidth = 12; g.beginPath(); g.moveTo(bx - 170, wy + 40); g.quadraticCurveTo(bx, wy - 50, bx + 170, wy + 40); g.stroke();
      g.lineWidth = 4; g.beginPath(); g.moveTo(bx - 170, wy + 14); g.quadraticCurveTo(bx, wy - 76, bx + 170, wy + 14); g.stroke();
      for (let k = -6; k <= 6; k++) { const t = (k + 6) / 12, x = bx - 170 + t * 340, y0 = wy + 40 - Math.sin(t * Math.PI) * 45 * 2 * 0.5 * 1.0 - 4, y1 = y0 - 26; g.beginPath(); g.moveTo(x, y0 - (Math.sin(t * Math.PI) * 0)); g.lineTo(x, y1); g.stroke(); }
      // sakury
      const sak = (x, y, s) => {
        g.strokeStyle = '#4a2a2a'; g.lineCap = 'round';
        const br = (bx2, by2, a, l, w, d) => { const ex = bx2 + Math.cos(a) * l, ey = by2 + Math.sin(a) * l; g.lineWidth = w; g.beginPath(); g.moveTo(bx2, by2); g.lineTo(ex, ey); g.stroke(); if (d < 5) { br(ex, ey, a - 0.4 - r() * 0.3, l * 0.72, w * 0.68, d + 1); br(ex, ey, a + 0.3 + r() * 0.3, l * 0.72, w * 0.68, d + 1); } else for (let k = 0; k < 6; k++) { g.fillStyle = ['#ffc8dc', '#ffb0cc', '#ffe0ec', '#ff98b8'][Math.floor(r() * 4)]; g.beginPath(); g.arc(ex + (r() - 0.5) * 30 * s, ey + (r() - 0.5) * 24 * s, (5 + r() * 8) * s, 0, TAU); g.fill(); } };
        br(x, y, -Math.PI / 2 - 0.15, 90 * s, 18 * s, 0);
      };
      sak(IW * 0.1, IH + 10, 1.4); sak(IW * 0.95, IH + 20, 1.1);
      g.fillStyle = 'rgba(255,190,210,.85)'; for (let i = 0; i < 90; i++) { const x = r() * IW, y = r() * IH; g.save(); g.translate(x, y); g.rotate(r() * 6); g.beginPath(); g.ellipse(0, 0, 4, 2.4, 0, 0, TAU); g.fill(); g.restore(); }
    } },
    // 7. polární záře nad zasněženou krajinou
    { times: ['noc'], name: ['Polární záře', 'The northern lights'], draw(g, c, r, T) {
      const hy = IH * 0.66; sky(g, T, r, hy);
      g.save(); g.globalCompositeOperation = 'lighter';
      const bands = 2 + Math.floor(r() * 2);
      for (let b = 0; b < bands; b++) { const y0 = 90 + r() * 150, ph = r() * 6, amp = 40 + r() * 60, col = r() < 0.6 ? [80, 255, 160] : [180, 120, 255];
        for (let x = 0; x < IW; x += 3) { const y = y0 + Math.sin(x * 0.006 + ph) * amp + Math.sin(x * 0.019 + ph * 2) * 20, h = 90 + Math.sin(x * 0.013 + ph) * 50; const gr = g.createLinearGradient(0, y - h, 0, y + 30); gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0)`); gr.addColorStop(0.75, `rgba(${col[0]},${col[1]},${col[2]},.22)`); gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`); g.fillStyle = gr; g.fillRect(x, y - h, 3, h + 30); } }
      g.restore();
      sunMoon(g, T, IW * (0.75 + r() * 0.15), 90, 22);
      ridge(g, r, hy - 20, 160, '#2a3a6a', { sharp: true, freq: 0.004, snow: 0.3, snowCol: '#c8d8ff', top: '#4a5a8a' });
      ridge(g, r, hy + 50, 60, '#d8e4ff', { freq: 0.003, top: '#f4f8ff' });
      for (let i = 0; i < 60; i++) { const x = r() * IW, h = 40 + r() * 90; pine(g, x, hy + 60 + r() * 140, h, '#0e1a30', 'rgba(220,235,255,.55)'); }
      // chata se světlem
      const hx = IW * (0.2 + r() * 0.5), hb = hy + 150; g.fillStyle = '#3a2418'; g.fillRect(hx, hb - 46, 74, 46); g.fillStyle = '#f4f8ff'; g.beginPath(); g.moveTo(hx - 12, hb - 44); g.lineTo(hx + 37, hb - 80); g.lineTo(hx + 86, hb - 44); g.fill();
      window_(g, hx + 12, hb - 34, 14, 14, true); window_(g, hx + 48, hb - 34, 14, 14, true);
      g.fillStyle = 'rgba(255,210,120,.18)'; g.beginPath(); g.ellipse(hx + 37, hb + 10, 90, 22, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; for (let i = 0; i < 120; i++) { g.globalAlpha = 0.4 + r() * 0.6; g.beginPath(); g.arc(r() * IW, r() * IH, 0.8 + r() * 1.8, 0, TAU); g.fill(); } g.globalAlpha = 1;
    } },
    // 8. noční město u řeky
    { times: ['soumrak', 'noc'], name: ['Město nad řekou', 'The city by the river'], draw(g, c, r, T) {
      const wy = IH * 0.66; sky(g, T, r, wy); sunMoon(g, T, IW * (0.8 + r() * 0.1), 100, 26); clouds(g, T, r, 4, 60, 200);
      const layer = (n, hMin, hMax, col, lit, base) => { let x = -20; while (x < IW) { const w = 30 + r() * 60, h = hMin + r() * (hMax - hMin); g.fillStyle = col; g.fillRect(x, base - h, w, h); if (r() < 0.25) { g.fillRect(x + w * 0.4, base - h - 30, 4, 30); } if (r() < 0.2) { g.beginPath(); g.moveTo(x, base - h); g.lineTo(x + w / 2, base - h - 26); g.lineTo(x + w, base - h); g.fill(); } for (let yy = base - h + 8; yy < base - 8; yy += 11) for (let xx = x + 5; xx < x + w - 6; xx += 9) if (r() < lit) { g.fillStyle = ['#ffd870', '#fff0b0', '#8ad8ff', '#ffb070'][Math.floor(r() * 4)]; g.fillRect(xx, yy, 4, 6); g.fillStyle = col; } x += w + 2; } };
      layer(0, 80, 200, mix('#2a3460', T.haze, 0.3), 0.25, wy - 4);
      layer(0, 60, 260, '#141a34', 0.4, wy);
      // věž s anténou
      const tx = IW * (0.3 + r() * 0.4); g.fillStyle = '#10142a'; g.beginPath(); g.moveTo(tx - 30, wy); g.lineTo(tx - 10, wy - 330); g.lineTo(tx + 10, wy - 330); g.lineTo(tx + 30, wy); g.fill(); g.fillStyle = '#ff4a4a'; g.beginPath(); g.arc(tx, wy - 350, 4, 0, TAU); g.fill(); g.fillStyle = '#10142a'; g.fillRect(tx - 1.5, wy - 350, 3, 22);
      reflect(g, c, wy, T, r, 0.7);
      // most se světly
      g.strokeStyle = '#0a0e20'; g.lineWidth = 10; g.beginPath(); g.moveTo(0, wy + 46); g.lineTo(IW, wy + 46); g.stroke();
      for (let k = 0; k < 5; k++) { const x = k * IW / 4; g.fillStyle = '#0a0e20'; g.fillRect(x - 8, wy + 46, 16, IH); g.lineWidth = 3; g.beginPath(); g.moveTo(x - IW / 8, wy + 46); g.quadraticCurveTo(x, wy - 20, x + IW / 8, wy + 46); g.stroke(); }
      for (let x = 10; x < IW; x += 32) { g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(x, wy + 38, 3, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,220,120,.18)'; g.beginPath(); g.arc(x, wy + 38, 14, 0, TAU); g.fill(); }
      // lodička se světýlky
      const bx = IW * (0.2 + r() * 0.6), by = wy + 110; g.fillStyle = '#1a1e34'; g.beginPath(); g.moveTo(bx - 60, by); g.lineTo(bx + 60, by); g.lineTo(bx + 46, by + 16); g.lineTo(bx - 50, by + 16); g.fill(); for (let k = 0; k < 7; k++) { g.fillStyle = ['#ff6a6a', '#ffe06a', '#6ad8ff'][k % 3]; g.beginPath(); g.arc(bx - 48 + k * 16, by - 8 - Math.sin(k / 6 * Math.PI) * 10, 2.5, 0, TAU); g.fill(); }
    } },
    // 9. tropický ostrov
    { times: ['den', 'zapad'], name: ['Tropický ostrov', 'The tropical island'], draw(g, c, r, T) {
      const wy = IH * 0.58; sky(g, T, r, wy); sunMoon(g, T, IW * (0.5 + r() * 0.3), wy - 60 - r() * 80, 42); clouds(g, T, r, 6, 40, 220);
      g.fillStyle = lin(g, 0, wy, 0, IH, [[0, mix('#2ab8d8', T.haze, T.sky[0] === '#2a2a6a' ? 0.5 : 0.1)], [0.5, mix('#3ae0d0', T.haze, 0.2)], [1, '#a8f0e0']]); g.fillRect(0, wy, IW, IH - wy);
      reflect(g, c, wy, T, r, 0.3); sunPath(g, T, IW * 0.6, wy);
      // vzdálený ostrov
      g.fillStyle = mix('#3a7a4a', T.haze, 0.5); g.beginPath(); g.ellipse(IW * 0.2, wy, 140, 40, 0, Math.PI, 0); g.fill();
      // pláž a palmy
      g.fillStyle = lin(g, 0, IH * 0.75, 0, IH, [[0, mix('#f8e4b0', T.light, 0.2)], [1, '#e0c080']]); g.beginPath(); g.moveTo(0, IH); g.lineTo(0, IH * 0.78); g.quadraticCurveTo(IW * 0.4, IH * 0.7, IW * 0.75, IH * 0.86); g.quadraticCurveTo(IW * 0.9, IH * 0.94, IW, IH * 0.93); g.lineTo(IW, IH); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, IH * 0.775); g.quadraticCurveTo(IW * 0.4, IH * 0.695, IW * 0.75, IH * 0.855); g.stroke();
      const palm = (x, y, h, lean) => {
        g.strokeStyle = '#7a5230'; g.lineWidth = 14; g.lineCap = 'round'; const tx = x + lean, ty = y - h;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.2, y - h * 0.6, tx, ty); g.stroke();
        g.strokeStyle = 'rgba(60,30,10,.4)'; g.lineWidth = 2; for (let k = 1; k < 12; k++) { const t = k / 12, px = x + (tx - x) * t + lean * 0.2 * Math.sin(t * Math.PI), py = y - h * t; g.beginPath(); g.moveTo(px - 7, py); g.lineTo(px + 7, py - 3); g.stroke(); }
        for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + (k - 3.5) * 0.42, l = 110 + r() * 40; g.strokeStyle = k % 2 ? '#2a8a3a' : '#3aa84a'; g.lineWidth = 4; g.beginPath(); g.moveTo(tx, ty); const ex = tx + Math.cos(a) * l, ey = ty + Math.sin(a) * l * 0.6 + l * 0.35; g.quadraticCurveTo(tx + Math.cos(a) * l * 0.5, ty - 30, ex, ey); g.stroke(); g.fillStyle = g.strokeStyle; for (let q = 1; q < 9; q++) { const t = q / 9, qx = tx + (ex - tx) * t, qy = ty + (ey - ty) * t - Math.sin(t * Math.PI) * 26; g.save(); g.translate(qx, qy); g.rotate(a + Math.PI / 2); g.beginPath(); g.ellipse(0, 10, 3, 14, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(0, -10, 3, 14, 0, 0, TAU); g.fill(); g.restore(); } }
        g.fillStyle = '#6a4a2a'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(tx - 8 + k * 8, ty + 8, 7, 0, TAU); g.fill(); }
      };
      palm(IW * 0.12, IH * 0.82, 330, 60); palm(IW * 0.3, IH * 0.78, 240, -40); palm(IW * 0.9, IH * 0.95, 280, -70);
      // hamaka / lodička
      const bx = IW * 0.62, by = wy + 70; g.fillStyle = '#f4f0e0'; g.beginPath(); g.moveTo(bx, by - 4); g.lineTo(bx, by - 60); g.lineTo(bx + 30, by - 6); g.fill(); g.fillStyle = '#c8502a'; g.beginPath(); g.moveTo(bx - 30, by); g.lineTo(bx + 34, by); g.lineTo(bx + 26, by + 9); g.lineTo(bx - 24, by + 9); g.fill();
      for (let i = 0; i < 8; i++) { g.fillStyle = ['#ff8aa8', '#ffd04a', '#f8f0e0'][i % 3]; g.beginPath(); g.arc(IW * 0.4 + r() * IW * 0.5, IH * 0.85 + r() * IH * 0.12, 3 + r() * 3, 0, TAU); g.fill(); }
    } },
    // 10. poušť s pyramidami
    { times: ['zapad', 'noc', 'den'], name: ['Pyramidy v poušti', 'Pyramids in the desert'], draw(g, c, r, T) {
      const hy = IH * 0.62; sky(g, T, r, hy); sunMoon(g, T, IW * (0.2 + r() * 0.6), hy - 120 - r() * 60, T.night ? 30 : 50);
      const sand = T.night ? '#3a3a6a' : mix('#e8a85a', T.haze, 0.25), sandD = T.night ? '#20204a' : mix('#a8683a', T.haze, 0.2);
      ridge(g, r, hy + 10, 30, mix(sand, T.haze, 0.4), { freq: 0.003 });
      const pyr = (x, s) => { const h = 220 * s, w = 210 * s, b = hy + 14; g.fillStyle = mix(T.night ? '#6a6a9a' : '#f0c07a', T.haze, 0.35 - s * 0.2); g.beginPath(); g.moveTo(x - w, b); g.lineTo(x, b - h); g.lineTo(x + w * 0.35, b); g.fill(); g.fillStyle = mix(T.night ? '#3a3a6a' : '#b07040', T.haze, 0.35 - s * 0.2); g.beginPath(); g.moveTo(x + w * 0.35, b); g.lineTo(x, b - h); g.lineTo(x + w, b); g.fill(); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; for (let k = 1; k < 14; k++) { const yy = b - h * k / 14; g.beginPath(); g.moveTo(x - w * (1 - k / 14), yy); g.lineTo(x + w * (1 - k / 14), yy); g.stroke(); } };
      pyr(IW * 0.62, 0.55); pyr(IW * 0.42, 1); pyr(IW * 0.8, 0.7);
      for (let k = 0; k < 3; k++) { const base = hy + 70 + k * 90, n = noise(r), col = mix(sand, sandD, k * 0.2); g.fillStyle = lin(g, 0, base - 60, 0, IH, [[0, mix(col, T.light, 0.25)], [1, col]]); g.beginPath(); g.moveTo(0, IH); for (let x = 0; x <= IW; x += 6) g.lineTo(x, base - fbm(n, x * 0.004) * 90); g.lineTo(IW, IH); g.fill(); }
      // karavana
      const cy = hy + 140; for (let k = 0; k < 5; k++) { const x = IW * 0.1 + k * 56, y = cy + k * 4; g.fillStyle = T.night ? '#0a0a20' : '#3a2418'; g.beginPath(); g.ellipse(x, y - 30, 22, 11, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(x - 4, y - 42, 9, 0, TAU); g.fill(); g.fillRect(x - 18, y - 24, 4, 24); g.fillRect(x + 12, y - 24, 4, 24); g.fillRect(x + 18, y - 44, 5, 18); g.beginPath(); g.ellipse(x + 26, y - 46, 9, 5, 0.3, 0, TAU); g.fill(); }
      if (!T.night) { g.fillStyle = 'rgba(255,240,200,.15)'; for (let i = 0; i < 6; i++) g.fillRect(0, hy + i * 22, IW, 2); }
    } },
    // 11. vesmír: planeta s prstenci a mlhovinou
    { times: ['noc'], name: ['Planeta s prstenci', 'The ringed planet'], draw(g, c, r, T) {
      const h = [180, 210, 240, 270, 300, 330][Math.floor(r() * 6)];
      g.fillStyle = lin(g, 0, 0, IW * 0.3, IH, [[0, `hsl(${h + 230} 60% 8%)`], [1, `hsl(${h + 260} 55% 3%)`]]); g.fillRect(0, 0, IW, IH);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) { const x = r() * IW, y = r() * IH, rad = 120 + r() * 300, hh = h + (r() - 0.5) * 140; const rg = g.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, `hsla(${hh} 85% 55% / ${0.14 + r() * 0.18})`); rg.addColorStop(1, `hsla(${hh} 85% 40% / 0)`); g.fillStyle = rg; g.fillRect(0, 0, IW, IH); }
      for (let i = 0; i < 700; i++) { const x = r() * IW, y = r() * IH, s = r() < 0.94 ? r() * 1.3 + 0.3 : r() * 2.4 + 1.2; g.fillStyle = `hsla(${h + r() * 60} 60% ${80 + r() * 20}% / ${0.4 + r() * 0.6})`; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      const px = IW * (0.4 + r() * 0.2), py = IH * (0.45 + r() * 0.1), R = 150 + r() * 40, ph = h + 120 + r() * 80, tilt = (r() - 0.5) * 0.6;
      const ring = front => { g.save(); g.translate(px, py); g.rotate(tilt); g.scale(1, 0.26); for (let k = 0; k < 6; k++) { g.lineWidth = 16 - k; g.strokeStyle = `hsla(${ph + k * 12} 60% ${58 + k * 5}% / ${0.65 - k * 0.06})`; g.beginPath(); g.arc(0, 0, R * (1.4 + k * 0.1), front ? 0 : Math.PI, front ? Math.PI : TAU); g.stroke(); } g.restore(); };
      ring(false);
      const pg = g.createRadialGradient(px - R * 0.4, py - R * 0.45, R * 0.1, px, py, R); pg.addColorStop(0, `hsl(${ph} 70% 75%)`); pg.addColorStop(0.55, `hsl(${ph + 20} 60% 45%)`); pg.addColorStop(1, `hsl(${ph + 40} 55% 12%)`);
      g.fillStyle = pg; g.beginPath(); g.arc(px, py, R, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(px, py, R, 0, TAU); g.clip(); for (let k = 0; k < 12; k++) { g.fillStyle = `hsla(${ph + k * 7} 55% ${35 + (k % 3) * 12}% / .3)`; const yy = py - R + k * R * 0.18; g.beginPath(); g.ellipse(px, yy, R * 1.2, R * 0.05 + r() * 6, tilt * 0.4, 0, TAU); g.fill(); } g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(px + R * 0.45, py + R * 0.35, R * 1.05, 0, TAU); g.fill(); g.restore();
      ring(true);
      for (let k = 0; k < 2; k++) { const mx = IW * (0.1 + r() * 0.8), my = IH * (0.1 + r() * 0.8), mr = 16 + r() * 26; if (Math.hypot(mx - px, my - py) < R * 1.8) continue; const mg = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 2, mx, my, mr); mg.addColorStop(0, '#f4f0ff'); mg.addColorStop(1, `hsl(${h + 200} 20% 25%)`); g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill(); }
    } },
  ];

  // malířská úprava: tahy štětce podle barvy pod nimi, zrno plátna, vinětace
  function painterly(g, r) {
    const d = g.getImageData(0, 0, IW, IH).data, n = noise(r);
    for (let i = 0; i < 7000; i++) {
      const x = Math.floor(r() * IW), y = Math.floor(r() * IH), k = (y * IW + x) * 4;
      const a = 0.5 + (n(x * 0.004 + y * 0.003) - 0.5) * 1.6, l = 2 + r() * 3.5;
      g.strokeStyle = `rgba(${d[k]},${d[k + 1]},${d[k + 2]},.42)`; g.lineWidth = 2 + r() * 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    const grain = g.createImageData(IW, IH), gd = grain.data;
    for (let i = 0; i < gd.length; i += 4) { const v = r() * 255; gd[i] = gd[i + 1] = gd[i + 2] = v; gd[i + 3] = 10; }
    const gc = document.createElement('canvas'); gc.width = IW; gc.height = IH; gc.getContext('2d').putImageData(grain, 0, 0);
    g.globalCompositeOperation = 'overlay'; g.drawImage(gc, 0, 0); g.globalCompositeOperation = 'source-over';
    const vg = g.createRadialGradient(IW / 2, IH / 2, IH * 0.45, IW / 2, IH / 2, IH * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = vg; g.fillRect(0, 0, IW, IH);
  }

  const cache = new Map();
  // obraz pro semínko: plátno 960×640 s vlastností jgTitle = [cs, en]
  function paint(seed) {
    if (cache.has(seed)) return cache.get(seed);
    const r = Kit.rng(seed), c = document.createElement('canvas'); c.width = IW; c.height = IH;
    const g = c.getContext('2d'), sc = SCENES[Math.floor(r() * SCENES.length)], tk = sc.times[Math.floor(r() * sc.times.length)], T = TIMES[tk];
    sc.draw(g, c, r, T);
    painterly(g, r);
    c.jgTitle = sc.times.length > 1 ? [`${sc.name[0]} ${T.name[0]}`, `${sc.name[1]} ${T.name[1]}`] : sc.name;
    if (cache.size > 40) cache.delete(cache.keys().next().value);
    cache.set(seed, c);
    return c;
  }
  return { paint, IW, IH, SCENES, TIMES };
})();
