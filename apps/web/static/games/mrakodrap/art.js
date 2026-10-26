'use strict';
// ── MRAKODRAP · kresba ──────────────────────────────────────────────────────
// Moderní město: nebe podle denní doby (den, zlatá hodinka, soumrak, noc, vesmír) se sluncem,
// měsícem a planetou, tři vrstvy panoramatu v oparu, náměstí se stromy a lampami. Patra jsou
// skleněné i cihlové fasády po sekcích; každé patro se předkreslí jednou (dle výšky a noci) a ve
// hře se jen kopíruje.
const MdArt = (() => {
  let SC = 2;
  const cache = new Map();
  function setScale(s) { if (Math.abs(s - SC) > 0.01) { SC = s; cache.clear(); } }
  function sprite(key, w, h, paint) {
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * SC)); c.height = Math.max(1, Math.ceil(h * SC));
    const g = c.getContext('2d'); g.scale(SC, SC); paint(g);
    if (cache.size > 120) cache.clear();
    cache.set(key, c);
    return c;
  }
  const hash = n => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
  const rgb = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };

  // ── Denní doba ── h: 0 den, 1 zlatá hodinka, 2 soumrak, 3 noc, 4 vesmír
  const TIMES = [
    { top: '#2f86e0', mid: '#79bdf2', low: '#cdeeff', far: '#a8cde6', mid2: '#86b2d4', near: '#6b93ba', cloud: '#ffffff', shade: '#d6e6f5' },
    { top: '#3d6fcf', mid: '#f0a87a', low: '#ffe0a8', far: '#e2b2a2', mid2: '#c38d8a', near: '#946c7f', cloud: '#fff1df', shade: '#f2b9a0' },
    { top: '#231f5c', mid: '#8a4a8e', low: '#ff8f6e', far: '#8a5a86', mid2: '#634273', near: '#43305d', cloud: '#f7b7b0', shade: '#a2608e' },
    { top: '#050820', mid: '#121845', low: '#2a2b66', far: '#1d2253', mid2: '#151a42', near: '#0e1231', cloud: '#2c3264', shade: '#1b2049' },
    { top: '#000000', mid: '#04041a', low: '#0d0b2a', far: '#0d0b2a', mid2: '#0a0922', near: '#07061a', cloud: '#1a1940', shade: '#100f30' },
  ];
  function time(h) {
    const k = Math.max(0, Math.min(TIMES.length - 1.0001, h)), i = Math.floor(k), t = k - i, A = TIMES[i], B = TIMES[i + 1], o = {};
    for (const key in A) o[key] = mix(A[key], B[key], t);
    o.night = Math.max(0, Math.min(1, (h - 2.2) / 0.8));
    return o;
  }

  // ── Panorama: tři vrstvy domů (vygenerované jednou) ──
  const LAYERS = [0, 1, 2].map(l => {
    const out = []; let x = -360;
    for (let i = 0; x < 720; i++) {
      const s = hash(l * 1000 + i), w = 18 + s * (l === 2 ? 46 : 34), h = (l === 0 ? 120 : l === 1 ? 90 : 60) * (0.45 + hash(l * 777 + i * 3) * 0.9);
      out.push({ x, w, h, top: hash(i * 13 + l) > 0.72 ? 1 : hash(i * 17 + l) > 0.8 ? 2 : 0, lights: Array.from({ length: Math.floor(w * h / 260) }, (_, k) => [hash(i * 91 + k * 7 + l), hash(i * 53 + k * 11 + l)]) });
      x += w + (l === 2 ? 2 : 4 + hash(i + l * 50) * 10);
    }
    return out;
  });
  function skyline(g, W, gy, cam, camX, T, clock) {
    const f = [0.22, 0.42, 0.68], cols = [T.far, T.mid2, T.near];
    for (let l = 0; l < 3; l++) {
      const base = gy + cam * f[l], ox = -camX * f[l];
      if (base - 140 > 700) continue;
      g.fillStyle = cols[l];
      for (const b of LAYERS[l]) {
        const x = b.x + ox; if (x > W + 4 || x + b.w < -4) continue;
        g.fillRect(x, base - b.h, b.w, b.h + 400);
        if (b.top === 1) { g.fillRect(x + b.w / 2 - 1, base - b.h - 14, 2, 14); }
        else if (b.top === 2) { g.beginPath(); g.moveTo(x, base - b.h); g.lineTo(x + b.w / 2, base - b.h - 10); g.lineTo(x + b.w, base - b.h); g.fill(); }
      }
      if (T.night > 0.05) {
        g.fillStyle = `rgba(255,214,140,${0.75 * T.night * (0.5 + l * 0.25)})`;
        for (const b of LAYERS[l]) { const x = b.x + ox; if (x > W || x + b.w < 0) continue; for (const [u, v] of b.lights) g.fillRect(x + 3 + u * (b.w - 6), base - b.h + 6 + v * (b.h - 8), l === 2 ? 2 : 1.5, l === 2 ? 2.5 : 2); }
        if (l === 0) { const blink = (Math.sin(clock * 3) + 1) / 2; g.fillStyle = `rgba(255,70,70,${0.4 + blink * 0.6})`; for (const b of LAYERS[0]) if (b.top === 1) { const x = b.x + ox + b.w / 2 - 1.5; if (x > -4 && x < W + 4) g.fillRect(x, base - b.h - 16, 3, 3); } }
      }
      // opar mezi vrstvami
      const hz = g.createLinearGradient(0, base - 70, 0, base); hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, T.low.replace('rgb', 'rgba').replace(')', ',0.35)'));
      g.fillStyle = hz; g.fillRect(0, base - 70, W, 70);
    }
  }

  // ── Nebe se sluncem, měsícem, hvězdami, mraky a planetou ──
  function scene(g, W, H, h, cam, camX, clock, gy) {
    const T = time(h);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, T.top); gr.addColorStop(0.55, T.mid); gr.addColorStop(1, T.low);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // hvězdy
    const sa = Math.max(0, Math.min(1, (h - 2.4) / 0.8));
    if (sa > 0) {
      for (let i = 0; i < 90; i++) {
        const x = (hash(i * 3) * W * 1.4 - camX * 0.05 + W) % W, y = ((hash(i * 7) * H * 1.6 + cam * 0.04) % (H * 1.1)) - 20, tw = 0.55 + 0.45 * Math.sin(clock * (1 + hash(i) * 3) + i);
        g.fillStyle = `rgba(255,255,255,${sa * tw * (i % 7 ? 0.7 : 1)})`; const s = i % 9 ? 1.4 : 2.4; g.fillRect(x, y, s, s);
      }
    }
    // slunce / měsíc
    const sunT = Math.min(1, h / 2.2), sx = W * (0.78 - sunT * 0.12), sy = H * (0.16 + sunT * 0.5);
    if (h < 2.6) {
      const a = 1 - Math.max(0, (h - 2) / 0.6), glow = g.createRadialGradient(sx, sy, 6, sx, sy, 120);
      glow.addColorStop(0, `rgba(255,244,214,${0.9 * a})`); glow.addColorStop(0.25, `rgba(255,214,150,${0.35 * a})`); glow.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = glow; g.fillRect(sx - 120, sy - 120, 240, 240);
      g.fillStyle = `rgba(255,250,235,${a})`; g.beginPath(); g.arc(sx, sy, 17, 0, 7); g.fill();
    }
    if (h > 2.5 && h < 3.9) {
      const a = Math.min(1, (h - 2.5) / 0.4) * Math.min(1, (3.9 - h) / 0.3), mx = W * 0.22, my = H * 0.2;
      const glow = g.createRadialGradient(mx, my, 8, mx, my, 70); glow.addColorStop(0, `rgba(210,225,255,${0.35 * a})`); glow.addColorStop(1, 'rgba(210,225,255,0)');
      g.fillStyle = glow; g.fillRect(mx - 70, my - 70, 140, 140);
      g.fillStyle = `rgba(240,244,255,${a})`; g.beginPath(); g.arc(mx, my, 14, 0, 7); g.fill();
      g.fillStyle = `rgba(200,210,235,${a})`; g.beginPath(); g.arc(mx - 4, my - 3, 3, 0, 7); g.arc(mx + 5, my + 4, 2.2, 0, 7); g.fill();
    }
    // planeta s prstencem ve vesmíru
    if (h > 3.4) {
      const a = Math.min(1, (h - 3.4) / 0.5), px = W * 0.75, py = H * 0.3;
      g.globalAlpha = a;
      const pg = g.createRadialGradient(px - 14, py - 14, 4, px, py, 46); pg.addColorStop(0, '#ffcf8a'); pg.addColorStop(0.6, '#d9785a'); pg.addColorStop(1, '#5a2a4a');
      g.strokeStyle = 'rgba(255,220,180,.55)'; g.lineWidth = 4; g.beginPath(); g.ellipse(px, py, 74, 16, -0.35, Math.PI, Math.PI * 2); g.stroke();
      g.fillStyle = pg; g.beginPath(); g.arc(px, py, 40, 0, 7); g.fill();
      g.beginPath(); g.ellipse(px, py, 74, 16, -0.35, 0, Math.PI); g.stroke();
      g.globalAlpha = 1;
    }
    // mraky
    const ca = 1 - Math.max(0, Math.min(1, (h - 2.4) / 1));
    if (ca > 0) for (let i = 0; i < 6; i++) {
      const s = 0.7 + hash(i * 5) * 0.8, x = ((hash(i * 11) * (W + 220) + clock * (6 + i * 2) - camX * 0.1) % (W + 220)) - 110, y = ((hash(i * 19) * H * 0.75 + cam * 0.25) % (H * 1.3)) - 60;
      cloud(g, x, y, s, T, ca * (0.75 + hash(i) * 0.25));
    }
    skyline(g, W, gy, cam, camX, T, clock);
    return T;
  }
  function cloud(g, x, y, s, T, a) {
    g.globalAlpha = a;
    const gr = g.createLinearGradient(0, y - 26 * s, 0, y + 14 * s); gr.addColorStop(0, T.cloud); gr.addColorStop(1, T.shade);
    g.fillStyle = gr; g.beginPath();
    g.arc(x, y, 15 * s, 0, 7); g.arc(x + 18 * s, y - 10 * s, 19 * s, 0, 7); g.arc(x + 40 * s, y - 4 * s, 15 * s, 0, 7); g.arc(x + 56 * s, y + 2 * s, 11 * s, 0, 7);
    g.rect(x, y, 56 * s, 12 * s); g.fill();
    g.globalAlpha = 1;
  }

  // ── Náměstí: chodník, silnice, stromy, lampy ──
  function ground(g, W, gy, H, T, camX) {
    const x0 = camX - W, x1 = camX + 2 * W;
    const pl = g.createLinearGradient(0, gy, 0, gy + 22); pl.addColorStop(0, mix('#cfd6de', '#2b3150', T.night)); pl.addColorStop(1, mix('#aeb7c2', '#22283f', T.night));
    g.fillStyle = pl; g.fillRect(x0, gy, x1 - x0, 22);
    g.fillStyle = mix('#4a5160', '#151a2c', T.night); g.fillRect(x0, gy + 22, x1 - x0, H);
    g.fillStyle = mix('#f2f2f2', '#6a6f86', T.night);
    for (let x = Math.floor(x0 / 40) * 40; x < x1; x += 40) g.fillRect(x, gy + 44, 20, 3);
    for (let k = -6; k <= 12; k++) {
      const x = k * 64 + 20; if (x < x0 || x > x1 || Math.abs(x - W / 2) < 80) continue;
      if (k % 2) { // strom
        g.fillStyle = mix('#6b4a32', '#2a2030', T.night); g.fillRect(x - 2, gy - 16, 4, 16);
        g.fillStyle = mix('#3f9e5a', '#1c3b3a', T.night); g.beginPath(); g.arc(x, gy - 24, 13, 0, 7); g.fill();
        g.fillStyle = mix('#5cc275', '#24504a', T.night); g.beginPath(); g.arc(x - 4, gy - 28, 7, 0, 7); g.fill();
      } else { // lampa
        g.fillStyle = mix('#3a4150', '#0e1222', T.night); g.fillRect(x - 1.5, gy - 34, 3, 34); g.fillRect(x - 1.5, gy - 34, 9, 3);
        if (T.night > 0.05) { const lg = g.createRadialGradient(x + 7, gy - 30, 1, x + 7, gy - 30, 30); lg.addColorStop(0, `rgba(255,214,140,${0.8 * T.night})`); lg.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = lg; g.fillRect(x - 25, gy - 60, 64, 64); }
      }
    }
  }

  // ── Patra ──
  // styly fasád po osmi patrech; přízemí je prosklená vstupní hala
  const STYLES = ['sklo', 'terakota', 'bila', 'tyrkys', 'cihla', 'zlato'];
  const styleOf = i => (i === 0 ? 'hala' : STYLES[Math.floor((i - 1) / 8) % STYLES.length]);
  const GLASS = { sklo: ['#8fd8ff', '#3b86d6', '#1f2d3f'], tyrkys: ['#8ff3df', '#21a39b', '#173a3f'], zlato: ['#ffe2a1', '#c8913a', '#3a2c1a'] };
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function paintFloor(g, w, fh, i, night) {
    const st = styleOf(i), seed = i * 31;
    const lit = k => night && hash(seed + k * 7) > 0.35;
    const warm = k => (hash(seed + k * 13) > 0.25 ? ['#ffe3a3', '#f2a64b'] : ['#d8ecff', '#7fb2e6']);
    const glassPanel = (x, y, pw, ph, c1, c2, k) => {
      const gg = g.createLinearGradient(0, y, 0, y + ph);
      if (night) { const [a, b] = lit(k) ? warm(k) : ['#1b2b4a', '#0c1426']; gg.addColorStop(0, a); gg.addColorStop(1, b); }
      else { gg.addColorStop(0, c1); gg.addColorStop(1, c2); }
      g.fillStyle = gg; g.fillRect(x, y, pw, ph);
      if (!night || !lit(k)) { g.fillStyle = `rgba(255,255,255,${night ? 0.06 : 0.28})`; g.beginPath(); g.moveTo(x + pw * 0.15, y + ph); g.lineTo(x + pw * 0.55, y); g.lineTo(x + pw * 0.8, y); g.lineTo(x + pw * 0.4, y + ph); g.fill(); }
    };
    if (st === 'hala') {
      g.fillStyle = night ? '#1a2234' : '#2a3446'; g.fillRect(0, 0, w, fh);
      const n = Math.max(3, Math.round(w / 26)), pw = (w - 8) / n;
      for (let k = 0; k < n; k++) glassPanel(4 + k * pw + 1, 12, pw - 2, fh - 14, '#b9e6ff', '#5aa2d8', k + 99);
      // dveře a stříška
      const dw = 22; g.fillStyle = night ? '#ffd58a' : '#d9f1ff'; g.fillRect(w / 2 - dw / 2, 16, dw, fh - 16);
      g.fillStyle = '#2a3446'; g.fillRect(w / 2 - 1, 16, 2, fh - 16);
      g.fillStyle = '#f2b632'; g.fillRect(-4, 6, w + 8, 6); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-4, 12, w + 8, 2);
      g.fillStyle = '#fff'; g.font = '800 5px "Space Grotesk", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('WINDOWLING', w / 2, 9);
    } else if (GLASS[st]) {
      const [c1, c2, fr] = GLASS[st];
      g.fillStyle = fr; g.fillRect(0, 0, w, fh);
      const n = Math.max(3, Math.round(w / 22)), pw = (w - 6) / n;
      for (let k = 0; k < n; k++) glassPanel(3 + k * pw + 1, 6, pw - 2, fh - 9, c1, c2, k);
    } else if (st === 'terakota' || st === 'cihla') {
      const wall = st === 'terakota' ? '#d9744f' : '#b8523b';
      g.fillStyle = night ? mix(wall, '#1a1530', 0.55) : wall; g.fillRect(0, 0, w, fh);
      if (st === 'cihla') { g.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 4; y < fh; y += 5) g.fillRect(0, y, w, 1); }
      else { g.fillStyle = 'rgba(255,255,255,.08)'; for (let x = 3; x < w; x += 6) g.fillRect(x, 0, 2, fh); }
      const n = Math.max(2, Math.round(w / 32)), pw = (w - 10) / n;
      for (let k = 0; k < n; k++) {
        const x = 5 + k * pw + 4, ww = pw - 8;
        g.fillStyle = st === 'cihla' ? '#f1ece4' : 'rgba(0,0,0,.25)'; g.fillRect(x - 2, 9, ww + 4, fh - 15);
        glassPanel(x, 11, ww, fh - 19, '#a6d4f2', '#4a7fb0', k);
        if (st === 'terakota') { // balkon se skleněným zábradlím a kytkou
          g.fillStyle = 'rgba(220,240,255,.35)'; g.fillRect(x - 3, fh - 16, ww + 6, 10);
          g.fillStyle = '#eef3f7'; g.fillRect(x - 3, fh - 17, ww + 6, 2);
          if (hash(seed + k) > 0.5) { g.fillStyle = night ? '#25463d' : '#3fa35d'; g.beginPath(); g.arc(x + ww - 4, fh - 19, 4, 0, 7); g.arc(x + ww - 9, fh - 18, 3, 0, 7); g.fill(); }
        }
      }
    } else { // bílá s pásovými okny a dřevěnými lamelami
      g.fillStyle = night ? '#4a5168' : '#eef1f4'; g.fillRect(0, 0, w, fh);
      glassPanel(4, 12, w - 8, fh - 22, '#9fc9e8', '#3f6f99', 1);
      g.fillStyle = night ? '#3c4258' : '#d5dbe2'; for (let x = 4 + 14; x < w - 4; x += 14) g.fillRect(x, 12, 2, fh - 22);
      g.fillStyle = night ? '#6d5137' : '#b5814f'; const lx = w * 0.62; for (let x = lx; x < w - 6; x += 4) g.fillRect(x, 12, 2, fh - 22);
    }
    // deska mezi patry, světlo zleva, stín od patra nad
    g.fillStyle = night ? '#2a3049' : '#e9edf2'; g.fillRect(-2, 0, w + 4, 4);
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, 4, w, 2);
    const lg = g.createLinearGradient(0, 0, w, 0); lg.addColorStop(0, 'rgba(255,255,255,.14)'); lg.addColorStop(0.35, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,.22)');
    g.fillStyle = lg; g.fillRect(0, 0, w, fh);
  }
  // patro: x střed, y spodní hrana
  function floor(g, x, y, w, fh, i, night, ang = 0) {
    const s = sprite(`f|${i % 48}|${i === 0 ? 0 : 1}|${w}|${night ? 1 : 0}`, w + 8, fh + 2, c => { c.translate(4, 0); paintFloor(c, w, fh, i === 0 ? 0 : ((i - 1) % 48) + 1, night); });
    if (ang) { g.save(); g.translate(x, y - fh / 2); g.rotate(ang); g.drawImage(s, -w / 2 - 4, -fh / 2, w + 8, fh + 2); g.restore(); }
    else g.drawImage(s, x - w / 2 - 4, y - fh, w + 8, fh + 2);
  }
  // střecha nad nejvyšším patrem (atika, technika, anténa s blikajícím světlem)
  function roof(g, x, y, w, night, clock) {
    g.fillStyle = night ? '#2a3049' : '#dfe4ea'; g.fillRect(x - w / 2 - 2, y - 6, w + 4, 6);
    g.fillStyle = night ? '#363d58' : '#b9c2cc'; g.fillRect(x - w / 2 + 10, y - 16, 24, 10); g.fillRect(x + w / 2 - 30, y - 13, 16, 7);
    g.fillStyle = night ? '#4a5270' : '#8d98a6'; g.fillRect(x + 6, y - 34, 2, 28);
    const b = (Math.sin(clock * 4) + 1) / 2;
    g.fillStyle = `rgba(255,60,60,${0.5 + b * 0.5})`; g.beginPath(); g.arc(x + 7, y - 35, 2.5, 0, 7); g.fill();
    if (night) { const lg = g.createRadialGradient(x + 7, y - 35, 1, x + 7, y - 35, 14); lg.addColorStop(0, `rgba(255,60,60,${0.5 * b})`); lg.addColorStop(1, 'rgba(255,60,60,0)'); g.fillStyle = lg; g.fillRect(x - 7, y - 49, 28, 28); }
  }

  // ── Jeřáb: příhradové rameno přes celou šířku, kočka, lana, kladnice ──
  function crane(g, W, px, py, hx, hy, night) {
    const y0 = py - 22, y1 = py - 8, c = night ? '#c9920a' : '#f6b80b', d = night ? '#7a5a08' : '#c48a00';
    g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, y0); g.lineTo(W + 10, y0); g.moveTo(-10, y1); g.lineTo(W + 10, y1); g.stroke();
    g.strokeStyle = d; g.lineWidth = 1.6; g.beginPath();
    for (let x = -14; x < W + 14; x += 14) { g.moveTo(x, y1); g.lineTo(x + 7, y0); g.lineTo(x + 14, y1); }
    g.stroke();
    // kočka
    g.fillStyle = night ? '#2a2f3d' : '#38404f'; rr(g, px - 13, y1 - 1, 26, 9, 3); g.fill();
    g.fillStyle = '#1b1f28'; g.beginPath(); g.arc(px - 7, y1 - 1, 2.4, 0, 7); g.arc(px + 7, y1 - 1, 2.4, 0, 7); g.fill();
    // lana
    g.strokeStyle = night ? '#9aa3b5' : '#3a404c'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px - 4, y1 + 8); g.lineTo(hx - 3, hy - 9); g.moveTo(px + 4, y1 + 8); g.lineTo(hx + 3, hy - 9); g.stroke();
    // kladnice (žlutočerná)
    g.save(); g.translate(hx, hy - 9);
    rr(g, -8, -6, 16, 10, 2); g.fillStyle = '#f6b80b'; g.fill();
    g.save(); g.clip(); g.fillStyle = '#1b1f28'; for (let x = -14; x < 14; x += 6) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 3, 4); g.lineTo(x + 9, -6); g.lineTo(x + 6, -6); g.fill(); } g.restore();
    g.fillStyle = '#38404f'; g.fillRect(-1.5, 4, 3, 5);
    g.restore();
  }
  // lana od háku k rohům visícího patra
  function slings(g, hx, hy, w, night) {
    g.strokeStyle = night ? '#aab3c4' : '#4a5160'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - w / 2 + 6, hy + 10); g.moveTo(hx, hy); g.lineTo(hx + w / 2 - 6, hy + 10); g.stroke();
  }

  return { setScale, time, scene, ground, floor, roof, crane, slings, mix, styleOf };
})();
