'use strict';
// ── VESNIČKA · scéna: vesnice na plátně ─────────────────────────────────────────
// Panorama 2200 × 500 jednotek, posouvá se tahem (hory a kopce v paralaxe). Roční období
// mění krajinu, den a noc jdou podle skutečných hodin hráče. Řemesla rostou s počtem kusů.
const Scene = (() => {
  const W = 2200, H = 500, TAU = Math.PI * 2, OL = '#3d2b22';
  let cv, ctx, dpr = 1, vw = 1, vh = 1, scale = 1, cam = 0, camV = 0, camGoal = null, t = 0;
  let S = null, season = 1, snow = false, light = { sun: 1, dusk: 0, h: 12 };
  const on = { tap: null, creature: null };
  const opts = { hour: null, season: null, clean: false }; // přepsání pro testy a obálku

  // ── Barvy ──
  const PAL = [
    { ground: '#97cd62', ground2: '#83ba52', hill: '#74ad4c', hill2: '#5f9842', forest: '#2f6b3a', leaf: ['#a5dc6e', '#86c95a', '#b6e47e'], road: '#dcc391', water: '#5aa9d6', snowLine: 196 },
    { ground: '#7fbb4b', ground2: '#6ea840', hill: '#5c9c3d', hill2: '#4b8934', forest: '#245a30', leaf: ['#4f9a3a', '#3f8a31', '#5aa844'], road: '#d8bb85', water: '#4a9fd0', snowLine: 168 },
    { ground: '#bba851', ground2: '#aa9442', hill: '#a98a40', hill2: '#927c3b', forest: '#3a5a33', leaf: ['#e48a2c', '#cc5428', '#ebbb3a', '#b8452a'], road: '#cba978', water: '#4f8fb8', snowLine: 186 },
    { ground: '#eef3f8', ground2: '#dfe8f1', hill: '#e5edf5', hill2: '#d0dce8', forest: '#3e5a55', leaf: null, road: '#cfd7e0', water: '#bfdcee', snowLine: 260 },
  ];
  const cache = new Map();
  function rgb(hex) {
    let v = cache.get(hex);
    if (!v) { const n = parseInt(hex.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; cache.set(hex, v); }
    return v;
  }
  const shadeCache = new Map();
  function shade(hex, f) {
    const key = hex + f;
    let v = shadeCache.get(key);
    if (!v) { const [r, g, b] = rgb(hex); const m = x => Math.max(0, Math.min(255, Math.round(f < 1 ? x * f : x + (255 - x) * (f - 1)))); v = `rgb(${m(r)},${m(g)},${m(b)})`; shadeCache.set(key, v); }
    return v;
  }
  function mix(a, b, f) { const A = rgb(a), B = rgb(b); return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * f)).join(',')})`; }
  const mixHex = (a, b, f) => { const A = rgb(a), B = rgb(b); return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * f).toString(16).padStart(2, '0')).join(''); };

  // ── Kreslicí pomůcky ──
  function poly(c, p, fill, stroke, lw) {
    c.beginPath(); c.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw || 1.4; c.strokeStyle = stroke; c.stroke(); }
  }
  function circ(c, x, y, r, fill, stroke) { c.beginPath(); c.arc(x, y, r, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.lineWidth = 1.4; c.strokeStyle = stroke; c.stroke(); } }
  function ell(c, x, y, rx, ry, fill, stroke) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.lineWidth = 1.4; c.strokeStyle = stroke; c.stroke(); } }
  function rect(c, x, y, w, h, fill, stroke) { c.fillStyle = fill; c.fillRect(x, y, w, h); if (stroke) { c.lineWidth = 1.4; c.strokeStyle = stroke; c.strokeRect(x, y, w, h); } }
  function line(c, x1, y1, x2, y2, col, lw) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = lw || 1.4; c.stroke(); }
  const rnd = seed => { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5 >>> 0) % 100000) / 100000; };

  // Okno: ve dne sklo, v noci svítí (k.light).
  function windowAt(c, k, x, y, w, h, o = {}) {
    rect(c, x - w / 2 - 1.5, y - h / 2 - 1.5, w + 3, h + 3, o.frame || '#fbf6ea', OL);
    const lit = k.night > 0.35 && !o.dark;
    rect(c, x - w / 2, y - h / 2, w, h, lit ? '#ffd56a' : (o.glass || '#5e7fa6'));
    if (lit) k.light(x, y, w * 2.2, o.glow || 'rgba(255,200,90,');
    line(c, x, y - h / 2, x, y + h / 2, o.frame || '#fbf6ea', 1.2);
    line(c, x - w / 2, y, x + w / 2, y, o.frame || '#fbf6ea', 1.2);
    if (o.shutters) { rect(c, x - w / 2 - 6, y - h / 2 - 1, 4.5, h + 2, o.shutters, OL); rect(c, x + w / 2 + 1.5, y - h / 2 - 1, 4.5, h + 2, o.shutters, OL); }
    if (o.box && k.season < 3) { rect(c, x - w / 2 - 2, y + h / 2 + 1.5, w + 4, 3.5, '#8a5a34'); for (let i = 0; i < 4; i++) circ(c, x - w / 2 + 1 + i * (w / 3), y + h / 2 + 0.5, 2.1, ['#e8455a', '#ffd34a', '#f08ad0', '#ff7a3a'][(i + k.season) % 4]); }
  }
  function door(c, x, y, w, h, col = '#7a4a2c', arch = true) {
    c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y - h + (arch ? w / 2 : 0));
    if (arch) c.arc(x, y - h + w / 2, w / 2, Math.PI, 0); else c.lineTo(x + w / 2, y - h);
    c.lineTo(x + w / 2, y); c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 1.4; c.strokeStyle = OL; c.stroke();
    circ(c, x + w * 0.28, y - h * 0.45, 1.1, '#e8c25a');
  }
  /**
   * Stavení štítem k cestě: (x, y) je střed spodní hrany průčelí. Vrací body střechy pro komín.
   * o: wall, roof, depth, rh (výška štítu), windows, door, timber, attic, chimney (u, v, h), shutters, box
   */
  function house(c, k, x, y, w, h, o = {}) {
    const wall = o.wall || '#f3e6cc', roof = o.roof || '#c4553e', rh = o.rh ?? w * 0.45, d = o.depth ?? w * 0.6, dx = d * 0.62, dy = -d * 0.4, ov = 4;
    const L = x - w / 2, R = x + w / 2, T = y - h, A = T - rh;
    c.lineJoin = 'round';
    poly(c, [R, y, R + dx, y + dy, R + dx, T + dy, R, T], shade(wall, 0.8), OL);
    if (o.sideWindow) windowAt(c, k, R + dx * 0.5, (y + T) / 2 + dy * 0.5, 7, 9, { frame: '#efe6d2', shutters: o.shutters });
    const rp = [x, A, R + ov, T + 3, R + ov + dx, T + 3 + dy, x + dx, A + dy];
    poly(c, rp, k.snow ? '#f6f9fc' : roof, OL);
    if (!k.snow) {
      for (let i = 1; i < 4; i++) {
        const f = i / 4, px = x + (R + ov - x) * f, py = A + (T + 3 - A) * f;
        line(c, px, py, px + dx, py + dy, shade(roof, 0.8), 1);
      }
    } else line(c, R + ov, T + 3, R + ov + dx, T + 3 + dy, '#c9d8e6', 2);
    const roofPt = (u, v) => [x + (R + ov - x) * u + dx * v, A + (T + 3 - A) * u + dy * v];
    let chimneyTop = null;
    if (o.chimney) {
      const [u, v, ch, cw] = o.chimney;
      const [px, py] = roofPt(u, v), w2 = cw || 7;
      rect(c, px - w2 / 2, py - ch, w2, ch + 2, o.chimneyCol || '#9a5a46', OL);
      rect(c, px - w2 / 2 - 1.5, py - ch - 2.5, w2 + 3, 3, k.snow ? '#ffffff' : '#6e3e30', OL);
      chimneyTop = [px, py - ch - 3];
    }
    poly(c, [L, y, R, y, R, T, x, A, L, T], wall, OL);
    if (o.timber) {
      c.strokeStyle = o.timber; c.lineWidth = 2;
      c.beginPath(); c.moveTo(L + 2, T); c.lineTo(R - 2, T); c.moveTo(x, A + 3); c.lineTo(x, T); c.moveTo(L + w * 0.18, T - rh * 0.2); c.lineTo(x, A + rh * 0.35); c.lineTo(R - w * 0.18, T - rh * 0.2); c.stroke();
    }
    if (o.boards) { c.strokeStyle = shade(wall, 0.82); c.lineWidth = 1; for (let i = 1; i < 6; i++) { const yy = y - (h * i) / 6; c.beginPath(); c.moveTo(L + 1, yy); c.lineTo(R - 1, yy); c.stroke(); } }
    c.lineWidth = 3.4; c.strokeStyle = k.snow ? '#ffffff' : shade(roof, 0.82);
    c.beginPath(); c.moveTo(L - ov, T + 3); c.lineTo(x, A - 1.5); c.lineTo(R + ov, T + 3); c.stroke();
    c.lineWidth = 1; c.strokeStyle = OL; c.beginPath(); c.moveTo(L - ov - 1, T + 4.5); c.lineTo(x, A - 3.5); c.lineTo(R + ov + 1, T + 4.5); c.stroke();
    if (o.attic) windowAt(c, k, x, T - rh * 0.38, 6, 7, { frame: '#efe6d2' });
    const nw = o.windows ?? 2, hasDoor = o.door !== false, ww = o.ww || Math.min(11, w * 0.17), wh = ww * 1.15;
    const wy = y - h * (hasDoor ? 0.58 : 0.5);
    if (nw === 1) windowAt(c, k, hasDoor ? x - w * 0.27 : x, wy, ww, wh, o);
    else if (nw === 2) { windowAt(c, k, x - w * 0.28, wy, ww, wh, o); windowAt(c, k, x + w * 0.28, wy, ww, wh, o); }
    else if (nw >= 3) for (let i = 0; i < nw; i++) windowAt(c, k, L + (w * (i + 0.5)) / nw, wy - (hasDoor ? h * 0.08 : 0), ww, wh, o);
    if (hasDoor) door(c, x + (o.doorX || 0), y, o.doorW || Math.min(14, w * 0.22), Math.min(h * 0.62, 24), o.doorCol);
    return { chimneyTop, roofPt, A, T, L, R, dx, dy };
  }
  function tree(c, k, x, y, s, kind = 'd', seed = 1) {
    const P = PAL[k.season], r = rnd(seed * 7919);
    if (kind === 'c') {
      rect(c, x - 2.5 * s, y - 8 * s, 5 * s, 8 * s, '#6b4a30');
      for (let i = 0; i < 3; i++) {
        const yy = y - 6 * s - i * 13 * s, ww = (20 - i * 5) * s;
        poly(c, [x - ww, yy, x + ww, yy, x, yy - 22 * s], i % 2 ? shade(P.forest, 1.12) : P.forest, OL, 1.1);
        if (k.snow) poly(c, [x - ww * 0.55, yy - 9 * s, x + ww * 0.55, yy - 9 * s, x, yy - 22 * s], '#f8fbff');
      }
      return;
    }
    const sway = Math.sin(t * 1.3 + seed) * 0.8 * s;
    rect(c, x - 3 * s, y - 24 * s, 6 * s, 24 * s, '#7a5236', OL);
    if (!P.leaf) {
      c.strokeStyle = '#6a4a32'; c.lineWidth = 2.2 * s; c.lineCap = 'round';
      c.beginPath();
      for (const [a, l] of [[-0.9, 22], [-0.3, 26], [0.4, 24], [1.0, 18]]) { c.moveTo(x, y - 22 * s); c.lineTo(x + Math.sin(a) * l * s, y - 22 * s - Math.cos(a) * l * s); }
      c.stroke(); c.lineCap = 'butt';
      for (const [a, l] of [[-0.3, 26], [0.4, 24]]) ell(c, x + Math.sin(a) * l * s, y - 22 * s - Math.cos(a) * l * s - 1, 5 * s, 2 * s, '#ffffff');
      return;
    }
    const blobs = [[0, -40, 17], [-12, -32, 13], [12, -31, 14], [-5, -52, 12], [7, -48, 12]];
    blobs.forEach(([bx, by, br], i) => circ(c, x + bx * s + sway * (i / 4), y + by * s, br * s, P.leaf[(i + seed) % P.leaf.length], i === 0 ? null : null));
    c.lineWidth = 1; c.strokeStyle = 'rgba(40,30,20,.35)';
    c.beginPath(); c.arc(x, y - 40 * s, 22 * s, Math.PI * 0.85, Math.PI * 2.15); c.stroke();
    if (k.season === 0) for (let i = 0; i < 9; i++) circ(c, x + (r() - 0.5) * 34 * s, y - (28 + r() * 30) * s, 1.7 * s, i % 3 ? '#ffd0e4' : '#ffffff');
    if (k.season === 1 && seed % 3 === 0) for (let i = 0; i < 6; i++) circ(c, x + (r() - 0.5) * 30 * s, y - (30 + r() * 26) * s, 1.8 * s, '#d6283a');
  }
  function fence(c, x1, x2, y, h = 10, col = '#a2754a') {
    line(c, x1, y - h * 0.65, x2, y - h * 0.65, col, 2); line(c, x1, y - h * 0.25, x2, y - h * 0.25, col, 2);
    for (let x = x1; x <= x2 + 0.1; x += 7) { rect(c, x - 1.2, y - h, 2.4, h, col); }
  }

  // ── Řemesla: kresba podle počtu kusů (lvl 1–5) ──
  const LV = n => (n >= 100 ? 5 : n >= 50 ? 4 : n >= 25 ? 3 : n >= 10 ? 2 : n >= 1 ? 1 : 0);
  const SLOT = {
    pole: [150, 334], kurnik: [330, 420], vcelin: [470, 332], pekarna: [615, 420], kovarna: [765, 336], mlyn: [898, 446], pivovar: [1070, 338],
    sklarna: [1215, 422], jarmark: [1370, 346], lazne: [1520, 424], zamek: [1670, 300], alchymie: [1820, 424], golem: [1965, 342], orloj: [2105, 426],
  };
  // Obrys pro ikonky (minX, minY, maxX, maxY) kolem SLOT.
  const BOX = {
    pole: [-112, -70, 112, 12], kurnik: [-70, -70, 70, 10], vcelin: [-70, -95, 70, 8], pekarna: [-50, -95, 72, 8], kovarna: [-55, -100, 75, 8], mlyn: [-50, -100, 75, 10],
    pivovar: [-70, -125, 90, 10], sklarna: [-60, -120, 75, 8], jarmark: [-90, -130, 90, 10], lazne: [-80, -105, 85, 10], zamek: [-90, -150, 100, 30], alchymie: [-40, -150, 50, 8],
    golem: [-60, -110, 70, 8], orloj: [-40, -190, 50, 8],
  };
  const DRAW = {
    pole(c, k, x, y, lv) {
      const P = PAL[k.season];
      const patches = [[-100, 2, 84, 26], [-6, 2, 84, 26], [-84, -28, 72, 20], [2, -28, 78, 20], [-60, -52, 70, 16]].slice(0, Math.max(1, Math.min(5, lv)));
      patches.forEach(([px, py, pw, ph], i) => {
        const sk = ph * 0.55, X = x + px, Y = y + py;
        poly(c, [X, Y, X + pw, Y, X + pw + sk, Y - ph, X + sk, Y - ph], k.snow ? '#e9eff6' : '#8d5d36', OL, 1.2);
        const crop = k.season === 0 ? '#7cc256' : k.season === 1 ? (i % 2 ? '#e8c94a' : '#6fb04a') : k.season === 2 ? (i % 2 ? '#d7b35a' : '#8d5d36') : null;
        const rows = Math.round(ph / 5);
        for (let r = 1; r < rows; r++) {
          const f = r / rows, yy = Y - ph * f, xx = X + sk * f;
          if (crop) { c.strokeStyle = crop; c.lineWidth = k.season === 1 ? 3.2 : 2.2; c.beginPath(); c.moveTo(xx + 2, yy); c.lineTo(xx + pw - 2, yy); c.stroke(); }
          else line(c, xx + 2, yy, xx + pw - 2, yy, '#cdd9e4', 1);
        }
        if (k.season === 1 && i % 2) for (let j = 0; j < 5; j++) circ(c, X + 8 + j * (pw / 5) + sk * 0.5, Y - ph * 0.5 + ((j * 7) % 5) - 2, 1.6, '#e0283a');
        if (k.season === 2 && !(i % 2)) for (let j = 0; j < 3; j++) circ(c, X + 14 + j * 24 + sk * 0.4, Y - ph * 0.45, 3.4, '#ef8a2a', OL);
      });
      if (lv >= 3) { // strašák
        const sx = x + 52, sy = y - 30;
        line(c, sx, sy, sx, sy - 34, '#6b4a30', 2.5); line(c, sx - 13, sy - 24, sx + 13, sy - 24, '#6b4a30', 2.5);
        poly(c, [sx - 9, sy - 26, sx + 9, sy - 26, sx + 7, sy - 10, sx - 7, sy - 10], '#3f6fae', OL);
        circ(c, sx, sy - 31, 5, '#f0d9a0', OL);
        poly(c, [sx - 9, sy - 34, sx + 9, sy - 34, sx + 4, sy - 41, sx - 4, sy - 41], '#8a6a2c', OL);
      }
      if (lv >= 4) { // stoh sena / kupka
        poly(c, [x + 92, y - 4, x + 116, y - 4, x + 104, y - 32], k.snow ? '#f2f6fb' : '#e2c25a', OL);
      }
      if (lv >= 5) { // trakař s dýněmi / sudy
        rect(c, x - 112, y - 18, 22, 10, '#9a6a3c', OL); circ(c, x - 101, y - 6, 5, '#6b4a30', OL);
        for (let j = 0; j < 3; j++) circ(c, x - 107 + j * 6, y - 20, 3.2, k.season === 2 ? '#ef8a2a' : '#7cc256', OL);
      }
    },
    kurnik(c, k, x, y, lv) {
      fence(c, x - 64, x + 64, y + 4, 11);
      house(c, k, x - 8, y - 6, 50, 26, { wall: '#b57d4b', roof: '#8a5a33', depth: 26, rh: 18, windows: 0, door: false, boards: true });
      circ(c, x - 8, y - 22, 4.5, '#3a2618', OL);
      poly(c, [x - 26, y - 6, x - 46, y + 4, x - 42, y + 6, x - 22, y - 4], '#c4935a', OL, 1);
      const n = [0, 2, 4, 6, 8, 10][lv], cols = ['#fbf8f0', '#c7834a', '#fbf8f0', '#3b3330', '#e8d3a8'];
      for (let i = 0; i < n; i++) hen(c, x - 52 + ((i * 37) % 104), y + 2 + ((i * 13) % 3) * 2, 0.9, cols[i % cols.length], i);
      if (lv >= 3) rooster(c, x - 8 + 12, y - 6 - 26 - 18 + 6);
    },
    vcelin(c, k, x, y, lv) {
      tree(c, k, x + 40, y - 6, 1.25, 'd', 3);
      rect(c, x - 62, y - 8, 98, 4, '#7a5236', OL);
      const n = Math.min(6, lv + 1), cols = ['#f2c14e', '#5d9bd5', '#7cc256', '#e8665a', '#b88ad8', '#f29a4e'];
      for (let i = 0; i < n; i++) {
        const hx = x - 54 + i * 16, hy = y - 8;
        rect(c, hx - 6, hy - 15, 12, 15, k.snow ? '#e9eef4' : cols[i], OL);
        poly(c, [hx - 8, hy - 15, hx + 8, hy - 15, hx, hy - 21], k.snow ? '#ffffff' : '#7a5236', OL, 1);
        rect(c, hx - 2.5, hy - 4, 5, 1.6, '#3a2618');
      }
      line(c, x - 58, y - 4, x - 58, y, '#7a5236', 2); line(c, x + 30, y - 4, x + 30, y, '#7a5236', 2);
      if ((k.season === 0 || k.season === 1) && k.night < 0.5) for (let i = 0; i < 4 + lv * 2; i++) {
        const a = t * (1.6 + (i % 3) * 0.4) + i * 1.7;
        circ(c, x - 30 + Math.cos(a) * (20 + (i % 4) * 6), y - 28 + Math.sin(a * 1.3) * 10, 1.4, '#2a2010');
        circ(c, x - 30 + Math.cos(a) * (20 + (i % 4) * 6), y - 28 + Math.sin(a * 1.3) * 10 - 0.6, 0.9, '#ffd43a');
      }
    },
    pekarna(c, k, x, y, lv) {
      if (lv >= 4) { // pec vedle
        c.beginPath(); c.arc(x - 46, y, 16, Math.PI, 0); c.fillStyle = k.snow ? '#eef3f8' : '#c99a72'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = OL; c.stroke();
        c.beginPath(); c.arc(x - 46, y, 6, Math.PI, 0); c.fillStyle = '#ff8a2a'; c.fill();
        k.light(x - 46, y - 3, 18, 'rgba(255,140,40,');
      }
      const hs = house(c, k, x, y, 70, 46, { wall: '#f6ead2', roof: '#c4553e', depth: 36, windows: 2, chimney: [0.35, 0.55, 22, 9], box: true, attic: lv >= 2, timber: lv >= 3 ? '#8a5a3c' : null, sideWindow: true });
      if (hs.chimneyTop) k.emit(hs.chimneyTop[0], hs.chimneyTop[1], 'smoke', 1.4);
      // preclík na rameni
      line(c, x + 36, y - 40, x + 52, y - 40, '#3a2618', 1.6);
      c.strokeStyle = lv >= 5 ? '#ffd23a' : '#c9862e'; c.lineWidth = 3;
      c.beginPath(); c.arc(x + 48, y - 31, 6, 0, TAU); c.moveTo(x + 43, y - 34); c.lineTo(x + 53, y - 27); c.moveTo(x + 53, y - 34); c.lineTo(x + 43, y - 27); c.stroke();
      if (lv >= 3) { rect(c, x + 40, y - 12, 26, 10, '#9a6a3c', OL); for (let i = 0; i < 4; i++) ell(c, x + 45 + i * 6, y - 14, 3.5, 2.3, '#e3a75a', OL); }
    },
    kovarna(c, k, x, y, lv) {
      const hs = house(c, k, x, y, 76, 44, { wall: '#aaa49b', roof: '#5a4b4e', depth: 36, windows: 0, door: false, chimney: [0.25, 0.6, 26, 11], chimneyCol: '#7d7670' });
      if (hs.chimneyTop) k.emit(hs.chimneyTop[0], hs.chimneyTop[1], 'dark', 1.6);
      for (let i = 0; i < 9; i++) { const sx = x - 36 + (i % 5) * 16 + (i > 4 ? 8 : 0), sy = y - 8 - (i > 4 ? 22 : 0); c.lineWidth = 1; c.strokeStyle = '#8a847c'; c.strokeRect(sx - 7, sy - 10, 15, 10); }
      // otevřená dílna s výhní
      rect(c, x - 20, y - 30, 40, 30, '#2a1d18', OL);
      const glow = 0.75 + 0.25 * Math.sin(t * 7) * Math.sin(t * 3.1);
      ell(c, x - 6, y - 7, 11, 5, `rgba(255,${120 + 60 * glow | 0},40,1)`);
      k.light(x - 6, y - 10, 30 + glow * 10, 'rgba(255,130,40,');
      if (Math.random() < 0.08 + lv * 0.02) k.emit(x - 6, y - 12, 'spark', 1);
      // kovadlina
      poly(c, [x + 24, y, x + 30, y - 7, x + 26, y - 9, x + 44, y - 9, x + 42, y - 13, x + 26, y - 13, x + 20, y - 9], '#3c3c44', OL, 1);
      // podkova
      c.strokeStyle = lv >= 5 ? '#ffd23a' : '#7a7a86'; c.lineWidth = 3; c.beginPath(); c.arc(x, y - 38, 5, Math.PI * 0.15, Math.PI * 0.85, true); c.stroke();
      if (lv >= 3) { circ(c, x - 34, y - 6, 8, null, '#6b4a30'); line(c, x - 42, y - 6, x - 26, y - 6, '#6b4a30', 1.4); line(c, x - 34, y - 14, x - 34, y + 2, '#6b4a30', 1.4); }
      if (lv >= 4) { rect(c, x + 50, y - 22, 24, 22, '#8a6a4c', OL); poly(c, [x + 47, y - 22, x + 77, y - 22, x + 72, y - 30, x + 52, y - 30], '#5a4b4e', OL); }
    },
    mlyn(c, k, x, y, lv) {
      const hs = house(c, k, x - 8, y, 62, 52, { wall: '#efe2c6', roof: '#9a5b34', depth: 34, windows: 2, timber: '#7a4a2c', attic: true, chimney: lv >= 3 ? [0.4, 0.4, 16, 7] : null, shutters: '#4f7a4a' });
      if (hs.chimneyTop) k.emit(hs.chimneyTop[0], hs.chimneyTop[1], 'smoke', 0.8);
      // mlýnské kolo na potoce
      const wx = x + 38, wy = y - 20, R = 22 + (lv >= 4 ? 4 : 0), a = k.season === 3 ? 0 : t * 0.9;
      circ(c, wx, wy, R, null, '#5a3a22'); c.lineWidth = 3; c.strokeStyle = '#7a5236'; c.beginPath(); c.arc(wx, wy, R, 0, TAU); c.stroke();
      c.lineWidth = 1.8;
      for (let i = 0; i < 8; i++) {
        const an = a + (i * TAU) / 8;
        line(c, wx, wy, wx + Math.cos(an) * R, wy + Math.sin(an) * R, '#7a5236', 1.8);
        rect(c, wx + Math.cos(an) * R - 3, wy + Math.sin(an) * R - 3, 6, 6, '#8a6040');
      }
      circ(c, wx, wy, 4, '#5a3a22', OL);
      if (k.season !== 3 && Math.random() < 0.3) k.emit(wx + R * 0.6, wy + R * 0.8, 'splash', 1);
      if (lv >= 2) for (let i = 0; i < Math.min(5, lv); i++) ell(c, x - 40 + i * 7, y - 4 - (i % 2) * 3, 4.5, 5, '#f4efe2', OL);
    },
    pivovar(c, k, x, y, lv) {
      // komín za budovou
      rect(c, x - 52, y - 118, 12, 80, '#a5553a', OL);
      rect(c, x - 54, y - 122, 16, 5, '#7a3b2e', OL);
      k.emit(x - 46, y - 124, 'smoke', 1.2);
      if (lv >= 3) { // varna s měděnou střechou
        rect(c, x + 26, y - 78, 28, 40, '#c97a4a', OL);
        c.beginPath(); c.arc(x + 40, y - 78, 14, Math.PI, 0); c.fillStyle = k.snow ? '#f2f6fa' : '#4f9a86'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = OL; c.stroke();
        line(c, x + 40, y - 92, x + 40, y - 100, OL, 1.4); circ(c, x + 40, y - 101, 2, '#e8c25a');
      }
      const hs = house(c, k, x, y, 96, 52, { wall: '#d0875a', roof: '#7a3b2e', depth: 40, windows: 3, doorW: 16, ww: 10 });
      // cihly
      c.strokeStyle = 'rgba(120,50,30,.35)'; c.lineWidth = 1;
      for (let r = 1; r < 6; r++) { c.beginPath(); c.moveTo(x - 48, y - r * 8.5); c.lineTo(x + 48, y - r * 8.5); c.stroke(); }
      rect(c, x - 16, y - 50, 32, 9, '#f3e6cc', OL);
      c.fillStyle = '#7a3b2e'; c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; c.fillText(LANG === 'en' ? 'BREWERY' : 'PIVOVAR', x, y - 43.5);
      if (lv >= 2) for (let i = 0; i < Math.min(6, lv + 1); i++) { const bx = x - 64 + (i % 3) * 11 + (i >= 3 ? 5.5 : 0), by = y - (i >= 3 ? 11 : 0); ell(c, bx, by - 5.5, 5.5, 6, '#9a6a3c', OL); line(c, bx - 5.5, by - 5.5, bx + 5.5, by - 5.5, '#4a3a30', 1.2); }
      if (lv >= 4) for (let i = 0; i < 3; i++) { const hx = x + 70 + i * 9; line(c, hx, y, hx, y - 40, '#6b4a30', 1.6); if (k.season === 1 || k.season === 0) for (let j = 0; j < 6; j++) circ(c, hx + (j % 2 ? 2 : -2), y - 8 - j * 5.5, 2.4, '#7cc256'); }
      void hs;
    },
    sklarna(c, k, x, y, lv) {
      // pec ve tvaru láhve
      const px = x - 36;
      poly(c, [px - 20, y, px + 20, y, px + 12, y - 54, px + 6, y - 92, px - 6, y - 92, px - 12, y - 54], '#b5694a', OL);
      rect(c, px - 7, y - 96, 14, 5, '#7a3b2e', OL);
      k.emit(px, y - 98, 'smoke', 1.3);
      c.beginPath(); c.arc(px, y, 9, Math.PI, 0); c.fillStyle = '#ffb03a'; c.fill();
      const g = 0.8 + 0.2 * Math.sin(t * 5);
      k.light(px, y - 5, 26 * g, 'rgba(255,150,40,');
      house(c, k, x + 22, y, 66, 40, { wall: '#ece2cc', roof: '#55606e', depth: 30, windows: 2, ww: 12, glass: '#7aa7c9' });
      if (lv >= 2) { // police se sklem
        rect(c, x + 58, y - 26, 26, 3, '#7a5236', OL);
        const cols = ['#3e8fd8', '#4fc28a', '#e8455a', '#f2c14e', '#a46ad8'];
        for (let i = 0; i < Math.min(5, lv + 1); i++) { const bx = x + 61 + i * 5, sh = Math.sin(t * 2 + i) > 0.9; poly(c, [bx - 2, y - 26, bx + 2, y - 26, bx + 2, y - 33, bx + 1, y - 37, bx - 1, y - 37, bx - 2, y - 33], cols[i], OL, 0.8); if (sh) circ(c, bx, y - 32, 1.5, '#ffffff'); }
      }
      if (lv >= 4 && Math.random() < 0.15) k.emit(x + 60 + Math.random() * 20, y - 40, 'glint', 1);
    },
    jarmark(c, k, x, y, lv) {
      ell(c, x, y - 4, 92, 14, k.snow ? '#e3eaf2' : shade(PAL[k.season].ground, 1.12));
      if (lv >= 4) { // ruské kolo
        const fx = x + 6, fy = y - 82, R = 44, a = t * 0.25;
        line(c, fx - 20, y - 10, fx, fy, '#6a6a7a', 2.4); line(c, fx + 20, y - 10, fx, fy, '#6a6a7a', 2.4);
        c.lineWidth = 1.6; c.strokeStyle = '#8a8a9a'; c.beginPath(); c.arc(fx, fy, R, 0, TAU); c.stroke();
        for (let i = 0; i < 8; i++) {
          const an = a + (i * TAU) / 8, gx = fx + Math.cos(an) * R, gy = fy + Math.sin(an) * R;
          line(c, fx, fy, gx, gy, '#9a9aaa', 1);
          rect(c, gx - 4, gy, 8, 6, ['#e8455a', '#3e8fd8', '#f2c14e', '#4fc28a'][i % 4], OL);
          if (k.night > 0.4) k.light(gx, gy + 2, 6, 'rgba(255,220,120,');
        }
        circ(c, fx, fy, 3, '#5a5a6a', OL);
      }
      const stall = (sx, a, b, goods) => {
        rect(c, sx - 20, y - 26, 3, 26, '#7a5236'); rect(c, sx + 17, y - 26, 3, 26, '#7a5236');
        rect(c, sx - 22, y - 12, 44, 12, '#a8784a', OL);
        for (let i = 0; i < 6; i++) poly(c, [sx - 24 + i * 8, y - 26, sx - 16 + i * 8, y - 26, sx - 16 + i * 8, y - 34, sx - 24 + i * 8, y - 34], k.snow ? '#ffffff' : i % 2 ? a : b, OL, 0.8);
        for (let i = 0; i < 5; i++) circ(c, sx - 16 + i * 8, y - 14.5, 2.8, goods[i % goods.length], OL);
      };
      stall(x - 62, '#e8455a', '#ffffff', ['#c9862e', '#e8455a', '#7cc256']);
      stall(x + 62, '#3e8fd8', '#ffffff', ['#f2c14e', '#a46ad8', '#ef8a2a']);
      if (lv >= 2) { // kolotoč
        const a = t * 1.4;
        line(c, x, y - 4, x, y - 44, '#d8c08a', 3);
        for (let i = 0; i < 6; i++) {
          const an = a + (i * TAU) / 6, sx = x + Math.cos(an) * 24, depth = Math.sin(an);
          if (depth < 0) continue;
          line(c, sx, y - 40, sx, y - 12 - depth * 3, '#e8d9a8', 1);
          ell(c, sx, y - 13 - depth * 3, 6, 3.5, ['#ffffff', '#f2c14e', '#e8455a'][i % 3], OL);
        }
        poly(c, [x - 30, y - 40, x + 30, y - 40, x, y - 58], k.snow ? '#ffffff' : '#e8455a', OL);
        for (let i = 0; i < 4; i++) poly(c, [x - 30 + i * 15, y - 40, x - 22.5 + i * 15, y - 40, x, y - 58], '#ffffff');
        poly(c, [x - 30, y - 40, x + 30, y - 40, x, y - 58], null, OL);
        circ(c, x, y - 59, 2.4, '#f2c14e', OL);
      }
      // praporky
      c.lineWidth = 1; c.strokeStyle = '#6b4a30';
      c.beginPath(); c.moveTo(x - 88, y - 36); c.quadraticCurveTo(x, y - 18 + (lv >= 2 ? -30 : 0), x + 88, y - 36); c.stroke();
      for (let i = 1; i < 14; i++) {
        const f = i / 14, px = (1 - f) * (1 - f) * (x - 88) + 2 * (1 - f) * f * x + f * f * (x + 88), py = (1 - f) * (1 - f) * (y - 36) + 2 * (1 - f) * f * (y - 18 + (lv >= 2 ? -30 : 0)) + f * f * (y - 36);
        poly(c, [px - 3, py, px + 3, py, px, py + 6 + Math.sin(t * 4 + i) * 0.8], ['#e8455a', '#f2c14e', '#3e8fd8', '#4fc28a'][i % 4]);
      }
      if (lv >= 5) for (let i = 0; i < 3; i++) { const bx = x - 40 + i * 30, by = y - 70 - Math.sin(t * 1.2 + i) * 4; line(c, bx, by + 8, bx + 2, y - 30, '#cccccc', 0.6); ell(c, bx, by, 5, 6.5, ['#e8455a', '#3e8fd8', '#f2c14e'][i], OL); }
    },
    lazne(c, k, x, y, lv) {
      if (lv >= 3) { // pavilon s kupolí
        rect(c, x - 14, y - 70, 52, 40, '#f4ecd8', OL);
        c.beginPath(); c.arc(x + 12, y - 70, 20, Math.PI, 0); c.fillStyle = k.snow ? '#f6f9fc' : '#5aa58a'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = OL; c.stroke();
        line(c, x + 12, y - 90, x + 12, y - 99, OL, 1.4); circ(c, x + 12, y - 100, 2.2, '#e8c25a');
        for (let i = 0; i < 3; i++) windowAt(c, k, x - 4 + i * 16, y - 52, 7, 10, { frame: '#f9f3e3' });
      }
      // kolonáda
      const n = 5 + Math.min(4, lv), cw = 13, x0 = x - (n * cw) / 2;
      rect(c, x0 - 6, y - 4, n * cw + 12, 4, '#d9d2c2', OL);
      for (let i = 0; i <= n; i++) { rect(c, x0 + i * cw - 2, y - 34, 4, 30, '#fbf8f0', OL); }
      rect(c, x0 - 6, y - 40, n * cw + 12, 7, '#f1ead8', OL);
      poly(c, [x0 - 8, y - 40, x0 + n * cw + 8, y - 40, x0 + n * cw - 2, y - 50, x0 + 2, y - 50], k.snow ? '#ffffff' : '#7c9aa8', OL);
      // pramen
      ell(c, x + n * cw * 0.5 + 18, y + 2, 14, 5, '#9fd0ee', OL);
      rect(c, x + n * cw * 0.5 + 16, y - 10, 4, 10, '#d9d2c2', OL);
      k.emit(x + n * cw * 0.5 + 18, y - 10, 'steam', 1.2);
      if (k.season < 3 && lv >= 2) for (let i = 0; i < 8; i++) circ(c, x0 + 4 + i * ((n * cw) / 8), y + 6, 2.4, ['#e8455a', '#f2c14e', '#a46ad8', '#ffffff'][i % 4]);
    },
    zamek(c, k, x, y, lv) {
      const P = PAL[k.season];
      ell(c, x, y + 26, 118, 40, P.hill, null);
      ell(c, x, y + 30, 100, 26, P.hill2, null);
      const wall = '#e7dfd0', roof = '#b84a36';
      const tower = (tx, ty, w, h, rh) => {
        rect(c, tx - w / 2, ty - h, w, h, wall, OL);
        poly(c, [tx - w / 2 - 3, ty - h, tx + w / 2 + 3, ty - h, tx, ty - h - rh], k.snow ? '#ffffff' : roof, OL);
        windowAt(c, k, tx, ty - h * 0.65, 5, 8, { frame: '#f6f1e6' });
        const fx = tx, fy = ty - h - rh;
        line(c, fx, fy, fx, fy - 12, OL, 1.2);
        const wv = Math.sin(t * 3 + tx) * 2;
        poly(c, [fx, fy - 12, fx + 11, fy - 10 + wv, fx, fy - 7], lv >= 5 ? '#f2c14e' : '#3e6fd8');
      };
      if (lv >= 4) { tower(x - 70, y - 4, 16, 50, 22); tower(x + 82, y - 6, 16, 46, 20); }
      if (lv >= 2) tower(x + 10, y - 40, 26, 54, 30); // věž za hradbou
      rect(c, x - 60, y - 44, 130, 44, wall, OL);
      for (let i = 0; i < 13; i++) rect(c, x - 60 + i * 10, y - 50, 6, 6, wall, OL);
      door(c, x + 5, y, 18, 26, '#5a3a22');
      for (let i = 0; i < 4; i++) windowAt(c, k, x - 46 + i * 34 + (i >= 2 ? 6 : 0), y - 26, 6, 9, { frame: '#f6f1e6' });
      tower(x - 66, y, 22, 64, 28);
      tower(x + 74, y, 22, 60, 26);
    },
    alchymie(c, k, x, y, lv) {
      c.save(); c.translate(x, y); c.transform(1, 0, -0.06, 1, 0, 0);
      rect(c, -17, -104, 34, 104, '#9a8f86', OL);
      for (let i = 0; i < 10; i++) { c.lineWidth = 1; c.strokeStyle = 'rgba(60,50,45,.35)'; c.beginPath(); c.moveTo(-17, -10 - i * 10); c.lineTo(17, -10 - i * 10); c.stroke(); }
      poly(c, [-22, -104, 22, -104, 2, -146], k.snow ? '#ffffff' : '#6a3d8a', OL);
      circ(c, 2, -148, 2.5, '#f2c14e');
      const glow = 0.6 + 0.4 * Math.sin(t * 2.3);
      circ(c, 0, -80, 7.5, '#fbf6ea', OL);
      circ(c, 0, -80, 5.5, k.night > 0.3 ? `rgba(120,255,170,${0.7 + glow * 0.3})` : '#5fd09a');
      door(c, 0, 0, 13, 22, '#4a2f5a');
      windowAt(c, k, 0, -44, 7, 10, { frame: '#efe6d2', glow: 'rgba(170,110,255,' });
      if (lv >= 3) { line(c, 14, -92, 40, -110, '#c9a84a', 4); circ(c, 41, -111, 3, '#7ab8e8', OL); }
      c.restore();
      k.light(x - 4, y - 80, 20 + glow * 8, 'rgba(120,255,170,');
      // komínek s barevným dýmem
      rect(c, x + 8, y - 126, 7, 16, '#7a6f66', OL);
      k.emit(x + 11.5, y - 128, Math.random() < 0.5 ? 'magic' : 'magic2', 1.3);
      // nápis s měsícem a hvězdou
      line(c, x + 15, y - 58, x + 30, y - 58, OL, 1.4);
      circ(c, x + 27, y - 50, 6, '#2f2350', OL); circ(c, x + 29, y - 51, 4.4, '#f2c14e'); circ(c, x + 30.5, y - 52, 3.6, '#2f2350');
      if (lv >= 2) { rect(c, x - 40, y - 10, 18, 10, '#7a5236', OL); for (let i = 0; i < 3; i++) { const fx = x - 37 + i * 6; circ(c, fx, y - 14, 2.8, ['#e8455a', '#4fc28a', '#7ab8e8'][i], OL); line(c, fx, y - 16, fx, y - 20, OL, 1); } }
      if (lv >= 4 && Math.random() < 0.2) k.emit(x + (Math.random() - 0.5) * 50, y - 30 - Math.random() * 80, 'glint', 1);
    },
    golem(c, k, x, y, lv) {
      house(c, k, x + 30, y, 52, 34, { wall: '#c7a27a', roof: '#6b4a30', depth: 28, windows: 1, chimney: [0.4, 0.5, 12, 6] });
      // golem
      const gx = x - 26, gy = y, sw = Math.sin(t * 0.9) * 0.25, clay = '#a66f45', dark = '#8a5836';
      rect(c, gx - 15, gy - 30, 11, 30, dark, OL); rect(c, gx + 4, gy - 30, 11, 30, dark, OL);
      poly(c, [gx - 22, gy - 30, gx + 22, gy - 30, gx + 25, gy - 74, gx - 25, gy - 74], clay, OL);
      c.save(); c.translate(gx - 26, gy - 70); c.rotate(sw); rect(c, -6, 0, 11, 38, clay, OL); c.restore();
      c.save(); c.translate(gx + 26, gy - 70); c.rotate(-sw * 0.6); rect(c, -5, 0, 11, 38, clay, OL);
      if (lv >= 3) { rect(c, -10, 34, 26, 7, '#7a5236', OL); }
      c.restore();
      rect(c, gx - 13, gy - 96, 26, 24, clay, OL);
      rect(c, gx - 6, gy - 93, 12, 6, lv >= 5 ? '#f2c14e' : '#f4efe2', OL);
      const eye = k.night > 0.3 ? '#ffd56a' : '#2a1d18';
      circ(c, gx - 5, gy - 82, 2.2, eye); circ(c, gx + 5, gy - 82, 2.2, eye);
      if (k.night > 0.3) { k.light(gx - 5, gy - 82, 8, 'rgba(255,200,90,'); k.light(gx + 5, gy - 82, 8, 'rgba(255,200,90,'); }
      line(c, gx - 6, gy - 76, gx + 6, gy - 76, '#5a3a22', 1.6);
      if (k.snow) { ell(c, gx, gy - 96, 14, 3, '#ffffff'); ell(c, gx, gy - 74, 24, 3, '#ffffff'); }
    },
    orloj(c, k, x, y, lv) {
      const wall = '#bdb3a4';
      rect(c, x - 24, y - 150, 48, 150, wall, OL);
      for (let i = 0; i < 14; i++) { c.lineWidth = 1; c.strokeStyle = 'rgba(70,60,50,.3)'; c.beginPath(); c.moveTo(x - 24, y - 10 - i * 10); c.lineTo(x + 24, y - 10 - i * 10); c.stroke(); }
      poly(c, [x - 28, y - 150, x + 28, y - 150, x, y - 186], k.snow ? '#ffffff' : '#3d4452', OL);
      for (const sx of [-24, 24]) poly(c, [x + sx - 4, y - 150, x + sx + 4, y - 150, x + sx, y - 168], k.snow ? '#ffffff' : '#3d4452', OL);
      if (lv >= 4) { circ(c, x, y - 190, 3, '#f2c14e', OL); }
      // ciferník: skutečný čas
      const cx = x, cy = y - 92, d = new Date(), hr = d.getHours() + d.getMinutes() / 60;
      circ(c, cx, cy, 22, '#2e5fa8', OL);
      circ(c, cx, cy, 16, '#6aa0d8');
      c.beginPath(); c.arc(cx, cy, 16, 0, Math.PI); c.fillStyle = '#c47a4a'; c.fill();
      c.beginPath(); c.arc(cx, cy, 16, Math.PI * 1.15, Math.PI * 1.85); c.fillStyle = '#5a9ad8'; c.fill();
      c.strokeStyle = '#f2c14e'; c.lineWidth = 1.2; c.beginPath(); c.arc(cx, cy, 20, 0, TAU); c.stroke();
      for (let i = 0; i < 24; i++) { const a = (i * TAU) / 24; line(c, cx + Math.cos(a) * 19, cy + Math.sin(a) * 19, cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, '#f2c14e', 1); }
      c.strokeStyle = '#f2c14e'; c.lineWidth = 1.4; c.beginPath(); c.arc(cx, cy - 5, 8, 0, TAU); c.stroke();
      const ha = (hr / 24) * TAU - Math.PI / 2;
      line(c, cx, cy, cx + Math.cos(ha) * 18, cy + Math.sin(ha) * 18, '#f2c14e', 2.2);
      circ(c, cx + Math.cos(ha) * 12, cy + Math.sin(ha) * 12, 3, '#ffe27a', OL);
      circ(c, cx, cy, 2, '#f2c14e');
      if (lv >= 3) { // kalendářní deska
        circ(c, cx, y - 40, 16, '#e8dcc0', OL);
        for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12 + t * 0.02; circ(c, cx + Math.cos(a) * 11, y - 40 + Math.sin(a) * 11, 2.2, ['#c47a4a', '#5a9ad8', '#4fc28a'][i % 3]); }
        circ(c, cx, y - 40, 4, '#f2c14e', OL);
      }
      // okénka apoštolů: otevřená v celou hodinu
      const open = d.getMinutes() < 1 || lv >= 5;
      for (const sx of [-9, 9]) {
        rect(c, x + sx - 5, y - 132, 10, 14, open ? '#2a1d18' : '#6b4a30', OL);
        if (open) { const p = (t * 0.6 + (sx > 0 ? 0.5 : 0)) % 1; circ(c, x + sx - 4 + p * 8, y - 125, 2.5, '#f0d9a0'); }
      }
      door(c, x, y, 14, 24, '#5a3a22');
    },
  };
  function hen(c, x, y, s, col, i) {
    const peck = Math.pow(Math.max(0, Math.sin(t * 2.1 + i * 1.7)), 8), dir = i % 2 ? 1 : -1;
    c.save(); c.translate(x, y); c.scale(dir * s, s);
    line(c, -1, 0, -1, -4, '#e0a03a', 1); line(c, 2, 0, 2, -4, '#e0a03a', 1);
    ell(c, 0, -7, 6.5, 4.6, col, OL);
    poly(c, [-6, -8, -10, -12, -8, -6], col, OL, 1);
    const hy = -11 + peck * 6;
    circ(c, 5, hy, 2.8, col, OL);
    poly(c, [7.5, hy - 0.5, 10, hy + 0.5, 7.5, hy + 1.2], '#f0a020');
    poly(c, [3.5, hy - 2.4, 5, hy - 4.8, 6.5, hy - 2.4], '#e0283a');
    c.restore();
  }
  function rooster(c, x, y) {
    c.save(); c.translate(x, y);
    line(c, 0, 0, 0, -4, '#e0a03a', 1.2);
    ell(c, 0, -8, 6, 5, '#b8452a', OL);
    poly(c, [-5, -9, -12, -18, -11, -8, -6, -6], '#2f6b3a', OL, 1);
    circ(c, 5, -14, 3, '#b8452a', OL); poly(c, [3, -17, 5, -21, 7, -17], '#e0283a');
    poly(c, [7.6, -14.5, 10.5, -13.5, 7.6, -12.6], '#f0a020');
    c.restore();
  }
  function cottage(c, k, x, y, seed) {
    const r = rnd(seed * 131 + 7);
    const walls = ['#f3e6cc', '#f0d9a8', '#e9e3d8', '#f5e1c8', '#e6d3b2', '#f2ead9'], roofs = ['#c4553e', '#a8432f', '#8b5a2b', '#6d6a7a', '#b8743a', '#9b4a3a'];
    const w = 34 + r() * 12, h = 22 + r() * 6;
    const hs = house(c, k, x, y, w, h, { wall: walls[seed % walls.length], roof: roofs[(seed * 3) % roofs.length], depth: 22 + r() * 8, windows: r() < 0.5 ? 1 : 2, ww: 7, doorW: 8, chimney: [0.3 + r() * 0.3, 0.5, 9, 5], timber: r() < 0.3 ? '#8a5a3c' : null, box: r() < 0.5, shutters: r() < 0.3 ? '#4f7a4a' : null });
    if (hs.chimneyTop && (k.season === 3 || k.night > 0.3 || seed % 3 === 0)) k.emit(hs.chimneyTop[0], hs.chimneyTop[1], 'smoke', 0.5);
  }
  // Vesnická vylepšení vidět ve vsi.
  const EXTRAS = {
    kaplicka(c, k) {
      const x = 590, y = 304;
      house(c, k, x, y, 30, 30, { wall: '#fbf8f0', roof: '#7a4a3a', depth: 22, windows: 0, doorW: 9 });
      rect(c, x - 6, y - 64, 12, 18, '#fbf8f0', OL);
      poly(c, [x - 8, y - 64, x + 8, y - 64, x, y - 80], k.snow ? '#ffffff' : '#3d4452', OL);
      line(c, x, y - 80, x, y - 88, OL, 1.4); line(c, x - 3, y - 85, x + 3, y - 85, OL, 1.4);
      const sw = Math.sin(t * 2) * 2;
      circ(c, x + sw * 0.3, y - 55, 3, '#e8c25a', OL);
      if (S && S.upg.rozhlas) { line(c, x + 26, y, x + 26, y - 44, '#6b4a30', 2); for (const s of [-1, 1]) poly(c, [x + 26, y - 42, x + 26 + s * 9, y - 46, x + 26 + s * 9, y - 36], '#8a8a96', OL, 1); }
    },
    skola(c, k) {
      const x = 1135, y = 302;
      house(c, k, x, y, 54, 30, { wall: '#f3d98a', roof: '#a8432f', depth: 30, windows: 3, ww: 7, doorW: 9 });
      rect(c, x - 4, y - 66, 8, 10, '#f3d98a', OL); poly(c, [x - 6, y - 66, x + 6, y - 66, x, y - 74], '#a8432f', OL);
      line(c, x + 32, y, x + 32, y - 46, '#6b4a30', 1.6);
      poly(c, [x + 32, y - 46, x + 46, y - 42 + Math.sin(t * 3) * 1.5, x + 32, y - 38], '#ffffff', OL, 0.8);
      poly(c, [x + 32, y - 42, x + 46, y - 42 + Math.sin(t * 3) * 1.5, x + 46, y - 38 + Math.sin(t * 3) * 1.5, x + 32, y - 38], '#d7141a');
      poly(c, [x + 32, y - 46, x + 38, y - 42, x + 32, y - 38], '#11457e');
    },
    posta(c, k) {
      const x = 1440, y = 303;
      house(c, k, x, y, 40, 28, { wall: '#f2c14e', roof: '#5a4b4e', depth: 24, windows: 2, ww: 7, doorW: 9 });
      c.strokeStyle = '#2a1d18'; c.lineWidth = 2; c.beginPath(); c.arc(x, y - 36, 4, 0, TAU); c.stroke();
      line(c, x + 4, y - 36, x + 10, y - 39, '#2a1d18', 2);
    },
  };

  // ── Krajina ──
  const MW = 1600, HW = 2200;
  const mountains = (() => { const p = []; for (let x = -20; x <= MW + 20; x += 24) { const h = 70 + 30 * Math.sin(x * 0.006) + 22 * Math.sin(x * 0.017 + 1) + 12 * Math.sin(x * 0.041 + 2) + (Math.abs(x - 520) < 160 ? (160 - Math.abs(x - 520)) * 0.55 : 0); p.push(x, 262 - h); } return p; })();
  const hills = (() => { const p = []; for (let x = -20; x <= HW + 20; x += 20) p.push(x, 268 - 18 * Math.sin(x * 0.005 + 0.6) - 9 * Math.sin(x * 0.013 + 2)); return p; })();
  const forest = (() => { const r = rnd(42), f = []; for (let x = 0; x < HW; x += 9 + r() * 10) { const i = Math.round((x + 20) / 20) * 2 + 1, top = hills[Math.min(hills.length - 1, i)]; if (r() < 0.75) f.push([x, top + 6 + r() * 16, 0.55 + r() * 0.35]); } return f; })();
  const tufts = (() => { const r = rnd(9), a = []; for (let i = 0; i < 160; i++) a.push([r() * W, 300 + r() * 200, 0.6 + r() * 0.8]); return a; })();
  const stars = (() => { const r = rnd(77), a = []; for (let i = 0; i < 90; i++) a.push([r(), r() * 0.55, r()]); return a; })();
  const clouds = (() => { const r = rnd(5), a = []; for (let i = 0; i < 7; i++) a.push([r() * 1800, 40 + r() * 110, 0.6 + r() * 0.8]); return a; })();
  const TREES = [[40, 336, 1.1, 'd'], [262, 312, 0.8, 'c'], [700, 312, 0.85, 'd'], [818, 306, 0.75, 'c'], [1003, 318, 0.9, 'd'], [1270, 312, 0.85, 'c'], [1590, 318, 0.95, 'd'], [1745, 330, 0.8, 'c'], [2040, 318, 1, 'd'],
    [2185, 340, 1.1, 'c'], [20, 470, 1.35, 'd'], [745, 486, 1.2, 'd'], [1095, 490, 1.25, 'c'], [1640, 492, 1.3, 'd'], [1955, 492, 1.15, 'c'], [2180, 488, 1.3, 'd'], [235, 488, 1.1, 'c']];
  const COTTAGES = [[300, 304], [345, 308], [655, 302], [845, 306], [1210, 304], [1270, 300], [1500, 306], [1560, 302], [1790, 300], [1860, 306], [2130, 302], [2190, 308], [395, 302], [960, 300]];
  const COTTAGE_AT = [5, 15, 30, 50, 80, 120, 170, 230, 300, 400, 520, 700, 900, 1200];
  const roadY = x => 376 + 7 * Math.sin(x / 170) + 3 * Math.sin(x / 61);
  // potok: kvadratická křivka od kopců dolů
  const BROOK = [1010, 286, 905, 380, 960, 504];
  const brookAt = f => [(1 - f) * (1 - f) * BROOK[0] + 2 * (1 - f) * f * BROOK[2] + f * f * BROOK[4], (1 - f) * (1 - f) * BROOK[1] + 2 * (1 - f) * f * BROOK[3] + f * f * BROOK[5]];
  const bridge = (() => { let best = [0, 0], d = 1e9; for (let f = 0; f <= 1; f += 0.005) { const [x, y] = brookAt(f), e = Math.abs(y - roadY(x)); if (e < d) { d = e; best = [x, y]; } } return best; })();
  const POND = [470, 474];

  // ── Částice ──
  const parts = [], fx = [], weather = [], floats = [];
  const PCOL = { smoke: ['rgba(235,235,240,', 0.55], dark: ['rgba(90,90,100,', 0.5], steam: ['rgba(255,255,255,', 0.5], magic: ['rgba(190,120,255,', 0.6], magic2: ['rgba(110,240,170,', 0.6] };
  function emit(x, y, kind, rate) {
    if (kind === 'spark') { parts.push({ x, y, vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 50, life: 0, max: 0.6, kind }); return; }
    if (kind === 'glint') { parts.push({ x, y, vx: 0, vy: -4, life: 0, max: 0.8, kind }); return; }
    if (kind === 'splash') { parts.push({ x, y, vx: (Math.random() - 0.3) * 30, vy: -20 - Math.random() * 20, life: 0, max: 0.5, kind }); return; }
    if (Math.random() > rate * 0.045 * (frameDt * 60)) return;
    parts.push({ x, y, vx: 6 + Math.random() * 6, vy: -14 - Math.random() * 8, life: 0, max: 3 + Math.random() * 1.5, r: 3, kind });
  }
  let frameDt = 1 / 60;
  function updParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'spark' || p.kind === 'splash') p.vy += 120 * dt;
      else if (p.r) { p.r += dt * 4; p.vx += dt * 2; }
    }
    if (parts.length > 400) parts.splice(0, parts.length - 400);
  }
  function drawParts(c) {
    for (const p of parts) {
      const f = p.life / p.max;
      if (p.kind === 'spark') { circ(c, p.x, p.y, 1.3, `rgba(255,${180 - f * 100 | 0},60,${1 - f})`); continue; }
      if (p.kind === 'glint') { const a = 1 - Math.abs(f * 2 - 1); c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x - 4, p.y); c.lineTo(p.x + 4, p.y); c.moveTo(p.x, p.y - 4); c.lineTo(p.x, p.y + 4); c.stroke(); continue; }
      if (p.kind === 'splash') { circ(c, p.x, p.y, 1.4, `rgba(220,240,255,${1 - f})`); continue; }
      const [col, a] = PCOL[p.kind] || PCOL.smoke;
      circ(c, p.x, p.y, p.r, col + (a * (1 - f) * Math.min(1, f * 6)).toFixed(3) + ')');
    }
  }

  // ── Bytost na scéně ──
  let creature = null;
  const CR_SIZE = 1.45; // bytosti jsou větší než vesničané, aby se na ně dalo trefit
  function spawnCreature(id, life) {
    const view = viewRange();
    let x, y, p = 1;
    if (id === 'vodnik') {
      // na kameni v rybníku nebo na břehu potoka: nejlépe tam, kde je to vidět
      const spots = [[POND[0] - 34, POND[1] - 2], [POND[0] + 30, POND[1] - 4], ...[0.55, 0.7, 0.86].map(f => { const [a, b] = brookAt(f); return [a + 22, b]; })];
      const inView = spots.filter(([a]) => a > view[0] + 40 && a < view[1] - 40), mid = (view[0] + view[1]) / 2;
      [x, y] = (inView.length ? inView : spots).reduce((a, b) => (Math.abs(b[0] - mid) < Math.abs(a[0] - mid) ? b : a));
    } else if (id === 'krakonos') {
      // na jedné straně obrazu (uprostřed nahoře je počítadlo grošů), za kopci
      p = 0.3; const vwW = vw / scale, side = Math.random() < 0.5 ? 0.12 + Math.random() * 0.16 : 0.72 + Math.random() * 0.16;
      x = view[0] * p + vwW * side;
      y = 246;
    } else {
      const pad = Math.min(90, (view[1] - view[0]) * 0.15);
      x = view[0] + pad + Math.random() * Math.max(10, view[1] - view[0] - pad * 2);
      y = id === 'bludicka' ? 300 + Math.random() * 120 : id === 'cert' ? roadY(x) + 30 + Math.random() * 40 : roadY(x) + 4 + Math.random() * 60;
    }
    creature = { id, x, y, p, t0: t, life, done: false, gone: 0 };
  }
  function drawCreature(c) {
    const cr = creature;
    if (!cr) return;
    const age = t - cr.t0, appear = Math.min(1, age * 2.5), fade = cr.done ? Math.max(0, 1 - cr.gone * 3) : Math.min(1, (cr.life - age) * 1.5);
    const a = Math.max(0, Math.min(appear, fade));
    if (a <= 0) { creature = null; return; }
    const sx = (cr.x - cam * cr.p) * scale, sy = cr.y * scale, s = scale * CR_SIZE * (cr.p < 1 ? 1.3 : 1);
    c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.translate(sx, sy); c.scale(s, s); c.globalAlpha = a;
    // svatozář, aby šla vidět
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    const g = c.createRadialGradient(0, -18, 2, 0, -18, 46);
    g.addColorStop(0, `rgba(255,250,200,${0.35 + pulse * 0.2})`); g.addColorStop(1, 'rgba(255,250,200,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, -18, 46, 0, TAU); c.fill();
    CREATURE_ART[cr.id](c, age);
    c.restore();
  }
  const CREATURE_ART = {
    bludicka(c, age) {
      const bob = Math.sin(age * 3) * 6, fl = Math.sin(age * 17) * 1.5;
      c.translate(Math.sin(age * 1.3) * 10, bob - 20);
      const g = c.createRadialGradient(0, 0, 1, 0, 0, 22);
      g.addColorStop(0, 'rgba(230,250,255,1)'); g.addColorStop(0.35, 'rgba(140,220,255,.85)'); g.addColorStop(1, 'rgba(80,160,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(0, -16 - fl); c.quadraticCurveTo(9, -2, 0, 7); c.quadraticCurveTo(-9, -2, 0, -16 - fl); c.fillStyle = '#eaffff'; c.fill();
      for (let i = 0; i < 4; i++) { const a2 = age * 2 + i * 1.6; circ(c, Math.cos(a2) * 15, Math.sin(a2 * 1.4) * 10 + 8, 1.5, 'rgba(200,240,255,.9)'); }
    },
    vodnik(c, age) {
      const bob = Math.sin(age * 2) * 1.5;
      ell(c, 0, -4, 18, 6, '#8a8a92', OL);
      c.translate(0, bob);
      poly(c, [-11, -6, 11, -6, 9, -30, -9, -30], '#2f6b4a', OL);
      poly(c, [-9, -30, 9, -30, 12, -14, 4, -8, -4, -8, -12, -14], '#3f8a5a', OL);
      for (let i = 0; i < 3; i++) { const d = ((age * 0.8 + i * 0.33) % 1); circ(c, -9 + i * 9, -6 + d * 10, 1.3, `rgba(120,200,255,${1 - d})`); }
      circ(c, 0, -38, 9, '#7cc28a', OL);
      circ(c, -3, -39, 1.6, '#1a2a1a'); circ(c, 3.5, -39, 1.6, '#1a2a1a');
      c.beginPath(); c.arc(0.5, -35, 3.5, 0.1, Math.PI - 0.1); c.strokeStyle = '#1a2a1a'; c.lineWidth = 1.2; c.stroke();
      rect(c, -10, -49, 20, 3, '#c43a3a', OL); rect(c, -6.5, -60, 13, 11, '#c43a3a', OL);
      line(c, 8, -30, 16, -38, '#6b4a30', 2); circ(c, 16, -40, 2.5, '#6b4a30');
      const sm = (age * 0.7) % 1; circ(c, 18 + sm * 4, -44 - sm * 10, 2 + sm * 3, `rgba(230,230,240,${0.6 * (1 - sm)})`);
      ell(c, 9, -8, 7, 3, '#8fd0ee', OL); // hrníček
    },
    cert(c, age) {
      const hop = Math.abs(Math.sin(age * 4)) * 8;
      c.translate(0, -hop);
      c.strokeStyle = '#2a1a14'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(10, -12); c.quadraticCurveTo(26, -10, 22, -28 + Math.sin(age * 6) * 3); c.stroke();
      poly(c, [20, -28, 26, -30, 23, -24], '#2a1a14');
      line(c, -5, 0, -5, -10, '#2a1a14', 4); line(c, 5, 0, 5, -10, '#2a1a14', 4);
      ell(c, -5, 1, 4, 2, '#4a3a30'); ell(c, 5, 1, 4, 2, '#4a3a30');
      ell(c, 0, -20, 12, 14, '#2a1a14', OL);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; line(c, Math.cos(a) * 11, -20 + Math.sin(a) * 13, Math.cos(a) * 15, -20 + Math.sin(a) * 17, '#2a1a14', 1.6); }
      circ(c, 0, -38, 9, '#3a2a20', OL);
      poly(c, [-7, -43, -11, -55, -3, -45], '#e8dcc0', OL, 1); poly(c, [7, -43, 11, -55, 3, -45], '#e8dcc0', OL, 1);
      circ(c, -3.5, -39, 2.2, '#ffe25a'); circ(c, 3.5, -39, 2.2, '#ffe25a'); circ(c, -3.5, -39, 0.9, '#1a1010'); circ(c, 3.5, -39, 0.9, '#1a1010');
      poly(c, [-2, -33, 2, -33, 1, -26 + Math.sin(age * 8), -1, -27], '#e0283a');
      line(c, -10, -24, -18, -30 + Math.sin(age * 5) * 4, '#2a1a14', 3);
    },
    krakonos(c, age) {
      c.globalAlpha *= 0.92;
      const sw = Math.sin(age * 1.2) * 2;
      poly(c, [-16, 0, 16, 0, 12, -50, -12, -50], '#5a6f8a', OL);
      poly(c, [-12, -50, 12, -50, 16, -20, 0, -10, -16, -20], '#6a7f9a');
      line(c, 20, 2, 18 + sw, -64, '#7a5a3c', 3);
      circ(c, 0, -60, 10, '#f0d9b8', OL);
      poly(c, [-10, -60, 10, -60, 6, -36, 0, -30, -6, -36], '#f4f4f4', OL, 1);
      circ(c, -3.5, -62, 1.3, '#2a2a2a'); circ(c, 3.5, -62, 1.3, '#2a2a2a');
      ell(c, 0, -69, 17, 4, '#4a5a3a', OL); poly(c, [-9, -69, 9, -69, 6, -82, -6, -82], '#4a5a3a', OL);
      poly(c, [6, -80, 12, -92, 8, -78], '#c43a3a');
    },
    hospodaricek(c, age) {
      const bob = Math.abs(Math.sin(age * 3)) * 3;
      c.translate(0, -bob);
      poly(c, [-7, 0, 7, 0, 6, -14, -6, -14], '#7a5a3c', OL);
      circ(c, 0, -19, 6, '#f0d9b8', OL);
      poly(c, [-6, -17, 6, -17, 4, -9, 0, -6, -4, -9], '#f4f4f4');
      poly(c, [-7, -22, 7, -22, 1, -38 + Math.sin(age * 4) * 2], '#d7141a', OL);
      circ(c, -2, -20, 1, '#2a2a2a'); circ(c, 2, -20, 1, '#2a2a2a');
      line(c, 7, -10, 13, -16, '#6b4a30', 1.4);
      const g = 0.7 + 0.3 * Math.sin(age * 9);
      circ(c, 13, -12, 4, `rgba(255,220,110,${g})`, OL);
    },
  };
  /** Kam na obrazovce klepnout na bytost (CSS px od levého horního rohu plátna). */
  function creatureScreen() {
    const cr = creature;
    if (!cr) return null;
    const k = scale * CR_SIZE * (cr.p < 1 ? 1.3 : 1);
    return { x: (cr.x - cam * cr.p) * scale, y: cr.y * scale - (cr.id === 'bludicka' ? 20 : cr.id === 'krakonos' ? 50 : 26) * k };
  }
  function hitCreature(sx, sy) {
    const cr = creature;
    if (!cr || cr.done) return false;
    const k = scale * CR_SIZE * (cr.p < 1 ? 1.3 : 1), c = creatureScreen();
    return Math.hypot(sx - c.x, sy - c.y) < Math.max(40, 40 * k);
  }

  // ── Kamera a vstup ──
  const viewW = () => vw / scale;
  const viewRange = () => [cam, cam + viewW()];
  const clampCam = x => Math.max(0, Math.min(W - viewW(), x));
  function focusCreature() { const cr = creature; if (!cr) return; camGoal = clampCam((cr.x - viewW() / 2) / cr.p); }
  function panTo(x, smooth = true) { const goal = clampCam(x - viewW() / 2); if (smooth) camGoal = goal; else { cam = goal; camGoal = null; } }
  const pointers = new Map();
  let drag = null;
  function bindInput() {
    cv.addEventListener('pointerdown', e => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: false });
      if (pointers.size === 1) drag = { x: e.clientX, cam, last: e.clientX, lt: performance.now(), v: 0, active: false };
      camGoal = null;
    });
    cv.addEventListener('pointermove', e => {
      const p = pointers.get(e.pointerId);
      if (!p || !drag) return;
      if (Math.abs(e.clientX - p.x) > 8) { p.moved = true; drag.active = true; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* */ } }
      if (drag.active && pointers.size === 1) {
        cam = clampCam(drag.cam - (e.clientX - drag.x) / scale);
        const nowT = performance.now(), dt = Math.max(1, nowT - drag.lt);
        drag.v = (-(e.clientX - drag.last) / scale / dt) * 1000; drag.last = e.clientX; drag.lt = nowT;
      }
    });
    const up = e => {
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (!p) return;
      const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      if (!p.moved) {
        if (hitCreature(sx, sy)) { const id = creature.id; creature.done = true; creature.gone = 0; burst(sx, sy, '#fff6c8', 26); if (on.creature) on.creature(id, sx, sy); }
        else if (minimapHit(sx, sy)) { /* klepnutí na mapku posune pohled */ }
        else if (on.tap) on.tap(sx, sy);
      } else if (drag && pointers.size === 0) camV = Math.max(-2500, Math.min(2500, drag.v || 0));
      if (pointers.size === 0) drag = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); if (!pointers.size) drag = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); camGoal = null; cam = clampCam(cam + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / scale); }, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }
  function minimapHit(sx, sy) {
    if (sy < vh - 18) return false;
    const m = 14, w = vw - m * 2;
    if (sx < m || sx > vw - m) return false;
    panTo(((sx - m) / w) * W);
    return true;
  }

  // ── Efekty v obrazovkových souřadnicích ──
  function burst(sx, sy, col, n = 12) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 140; fx.push({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0, max: 0.6 + Math.random() * 0.4, col }); } }
  function floatText(sx, sy, text, col = '#fff3b0', big = false) { floats.push({ x: sx, y: sy, text, col, life: 0, max: big ? 1.8 : 1.1, big }); if (floats.length > 40) floats.shift(); }
  function coin(sx, sy) { fx.push({ x: sx, y: sy, vx: (Math.random() - 0.5) * 120, vy: -120 - Math.random() * 80, life: 0, max: 0.8, coin: true }); }
  let weatherSeason = -1;
  function updWeather(dt) {
    if (weatherSeason !== season) { weatherSeason = season; weather.length = 0; }
    const want = season === 3 ? 70 : season === 2 ? 18 : season === 0 ? 16 : light.sun < 0.4 ? 22 : 8;
    while (weather.length < want) weather.push(newFlake(true));
    if (weather.length > want) weather.length = want;
    for (const f of weather) {
      f.life += dt;
      if (f.kind === 'fly') { f.x += Math.cos(f.life * f.sp + f.ph) * 22 * dt; f.y += Math.sin(f.life * f.sp * 1.3 + f.ph) * 14 * dt; if (f.life > f.max) Object.assign(f, newFlake(false)); continue; }
      f.x += (f.vx + Math.sin(f.life * 2 + f.ph) * f.sw) * dt; f.y += f.vy * dt;
      if (f.y > vh + 10 || f.x < -20 || f.x > vw + 20) Object.assign(f, newFlake(false));
    }
  }
  function newFlake(anywhere) {
    const y = anywhere ? Math.random() * vh : -10;
    if (season === 3) return { kind: 'snow', x: Math.random() * vw, y, vx: -6, vy: 22 + Math.random() * 26, sw: 10, ph: Math.random() * 6, r: 1 + Math.random() * 1.8, life: 0 };
    if (season === 2) return { kind: 'leaf', x: Math.random() * vw, y, vx: 14, vy: 22 + Math.random() * 18, sw: 26, ph: Math.random() * 6, col: ['#e48a2c', '#cc5428', '#ebbb3a'][Math.floor(Math.random() * 3)], life: 0 };
    if (season === 0) return { kind: 'petal', x: Math.random() * vw, y, vx: 10, vy: 14 + Math.random() * 12, sw: 20, ph: Math.random() * 6, life: 0 };
    return { kind: 'fly', x: Math.random() * vw, y: vh * (0.45 + Math.random() * 0.45), sp: 0.8 + Math.random(), ph: Math.random() * 6, life: 0, max: 6 + Math.random() * 6, col: ['#ffd84a', '#ffffff', '#f08ad0', '#7ab8e8'][Math.floor(Math.random() * 4)] };
  }
  function drawWeather(c) {
    for (const f of weather) {
      if (f.kind === 'snow') circ(c, f.x, f.y, f.r, 'rgba(255,255,255,.9)');
      else if (f.kind === 'leaf') { c.save(); c.translate(f.x, f.y); c.rotate(f.life * 3 + f.ph); ell(c, 0, 0, 4, 2, f.col); c.restore(); }
      else if (f.kind === 'petal') { c.save(); c.translate(f.x, f.y); c.rotate(f.life * 2 + f.ph); ell(c, 0, 0, 2.6, 1.6, '#ffd0e4'); c.restore(); }
      else if (light.sun < 0.4) { const a = 0.5 + 0.5 * Math.sin(f.life * 4 + f.ph); circ(c, f.x, f.y, 5, `rgba(200,255,120,${a * 0.18})`); circ(c, f.x, f.y, 1.6, `rgba(230,255,150,${a})`); }
      else { const w = Math.sin(f.life * 18) * 3; ell(c, f.x - 2, f.y, 2.6, 1.2 + Math.abs(w) * 0.5, f.col); ell(c, f.x + 2, f.y, 2.6, 1.2 + Math.abs(w) * 0.5, f.col); }
    }
  }
  function drawFx(c, dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i];
      p.life += dt; if (p.life >= p.max) { fx.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt;
      const a = 1 - p.life / p.max;
      if (p.coin) { c.globalAlpha = a; circ(c, p.x, p.y, 5, '#f2c14e', '#a8771e'); c.globalAlpha = 1; }
      else circ(c, p.x, p.y, 2.2, p.col);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life += dt; if (f.life >= f.max) { floats.splice(i, 1); continue; }
      const a = Math.min(1, (1 - f.life / f.max) * 2);
      c.globalAlpha = a; c.font = `${f.big ? 800 : 800} ${f.big ? 20 : 16}px Nunito, system-ui, sans-serif`; c.textAlign = 'center';
      c.lineWidth = 4; c.strokeStyle = 'rgba(40,25,10,.75)'; c.strokeText(f.text, f.x, f.y - f.life * 46);
      c.fillStyle = f.col; c.fillText(f.text, f.x, f.y - f.life * 46);
      c.globalAlpha = 1;
    }
  }

  // ── Denní světlo podle hodin hráče ──
  function daylight() {
    const d = new Date(), h = opts.hour != null ? opts.hour : d.getHours() + d.getMinutes() / 60;
    const sun = h < 5 ? 0 : h < 7 ? (h - 5) / 2 : h < 19 ? 1 : h < 21 ? 1 - (h - 19) / 2 : 0;
    const dusk = Math.min(1, Math.max(0, 1 - Math.abs(h - 19.6) / 1.4) + Math.max(0, 1 - Math.abs(h - 6.2) / 1.2));
    return { h, sun, dusk };
  }

  // ── Snímek ──
  let lights = [];
  function frame(dt, state) {
    S = state; frameDt = Math.min(0.05, dt); t += frameDt;
    season = opts.season != null ? opts.season : seasonAt(Date.now()); snow = season === 3; light = daylight();
    if (!drag || !drag.active) {
      if (camGoal != null) { cam += (camGoal - cam) * Math.min(1, dt * 4); if (Math.abs(camGoal - cam) < 0.5) { cam = camGoal; camGoal = null; } }
      else if (Math.abs(camV) > 5) { cam = clampCam(cam + camV * dt); camV *= Math.pow(0.04, dt); } else camV = 0;
    }
    cam = clampCam(cam);
    const c = ctx, P = PAL[season], night = 1 - light.sun;
    lights = [];
    const k = { t, season, snow, night, emit, light: (x, y, r, col) => lights.push([x, y, r, col]) };
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // obloha
    const top = mixHex(mixHex('#0b1533', '#69b3e6', light.sun), '#4a5aa8', light.dusk * 0.6), bot = mixHex(mixHex('#26365f', '#cfeeff', light.sun), '#ffae7a', light.dusk * 0.85);
    const g = c.createLinearGradient(0, 0, 0, vh * 0.62);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    c.fillStyle = g; c.fillRect(0, 0, vw, vh);
    if (night > 0.2) for (const [sx, sy, tw] of stars) circ(c, sx * vw, sy * vh, 1.1, `rgba(255,255,240,${(night - 0.2) * (0.5 + 0.5 * Math.sin(t * 2 + tw * 20))})`);
    // slunce a měsíc
    const sp = ((light.h - 6) / 13), mp = (((light.h + 12) % 24) - 6) / 13;
    if (sp > -0.1 && sp < 1.1) { const sx = vw * (0.1 + 0.8 * sp), sy = vh * (0.42 - Math.sin(Math.max(0, Math.min(1, sp)) * Math.PI) * 0.34); circ(c, sx, sy, 26 * Math.min(1.4, scale + 0.3), `rgba(255,240,180,${0.25 * light.sun})`); circ(c, sx, sy, 16 * Math.min(1.4, scale + 0.3), light.dusk > 0.3 ? '#ffc27a' : '#fff4c4'); }
    if (mp > -0.1 && mp < 1.1 && night > 0.3) { const mx = vw * (0.1 + 0.8 * mp), my = vh * (0.4 - Math.sin(Math.max(0, Math.min(1, mp)) * Math.PI) * 0.3), r = 12 * Math.min(1.4, scale + 0.3); circ(c, mx, my, r * 2, 'rgba(220,230,255,.12)'); circ(c, mx, my, r, '#f4f1dc'); circ(c, mx + r * 0.35, my - r * 0.2, r * 0.85, top); }
    // mraky
    for (const [cx0, cy, cs] of clouds) {
      const x = ((cx0 + t * 6 * cs - cam * 0.1) % (vw / scale + 400) + (vw / scale + 400)) % (vw / scale + 400) - 200;
      c.save(); c.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      const col = night > 0.6 ? 'rgba(120,130,170,.35)' : `rgba(255,255,255,${0.75 - night * 0.3})`;
      for (const [ox, oy, r] of [[0, 0, 18], [16, -6, 20], [34, 0, 16], [18, 6, 16]]) circ(c, x + ox * cs, cy + oy * cs, r * cs, col);
      c.restore();
    }
    // hory (paralaxa 0,3)
    c.setTransform(dpr * scale, 0, 0, dpr * scale, -cam * 0.3 * scale * dpr, 0);
    poly(c, [...mountains, MW + 20, 300, -20, 300], mixHex('#8ea5c6', '#3a4a6a', night * 0.7));
    c.save(); poly(c, [...mountains, MW + 20, 300, -20, 300], null); c.clip();
    const sl = P.snowLine;
    c.beginPath(); c.moveTo(-20, 0);
    for (let x = -20; x <= MW + 20; x += 20) c.lineTo(x, sl + Math.sin(x * 0.07) * 8 + Math.sin(x * 0.023) * 6);
    c.lineTo(MW + 20, 0); c.closePath(); c.fillStyle = mixHex('#f4f8ff', '#8090b0', night * 0.6); c.fill();
    c.restore();
    if (creature && creature.p < 1) drawCreature(c);
    c.setTransform(dpr * scale, 0, 0, dpr * scale, -cam * 0.3 * scale * dpr, 0);
    // kopce s lesem (paralaxa 0,6)
    c.setTransform(dpr * scale, 0, 0, dpr * scale, -cam * 0.6 * scale * dpr, 0);
    poly(c, [...hills, HW + 20, 320, -20, 320], P.hill2);
    for (const [x, y, s] of forest) { poly(c, [x - 7 * s, y, x + 7 * s, y, x, y - 22 * s], P.forest); if (snow) poly(c, [x - 3 * s, y - 12 * s, x + 3 * s, y - 12 * s, x, y - 22 * s], '#f4f8fc'); }
    // svět (paralaxa 1)
    c.setTransform(dpr * scale, 0, 0, dpr * scale, -cam * scale * dpr, 0);
    const gg = c.createLinearGradient(0, 284, 0, H);
    gg.addColorStop(0, P.ground2); gg.addColorStop(0.25, P.ground); gg.addColorStop(1, P.ground);
    c.fillStyle = gg; c.fillRect(-10, 284, W + 20, H);
    // dráha za vsí
    if (S && S.upg.zeleznice) drawRail(c, k);
    for (const [x, y, s] of tufts) { if (x < cam - 20 || x > cam + viewW() + 20) continue; c.strokeStyle = snow ? '#d6e0ea' : P.ground2; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 3 * s, y); c.lineTo(x - 4 * s, y - 5 * s); c.moveTo(x, y); c.lineTo(x, y - 6 * s); c.moveTo(x + 3 * s, y); c.lineTo(x + 4 * s, y - 5 * s); c.stroke(); }
    // potok
    c.lineCap = 'round';
    c.strokeStyle = shade(P.water, 0.8); c.lineWidth = 22; c.beginPath(); c.moveTo(BROOK[0], BROOK[1]); c.quadraticCurveTo(BROOK[2], BROOK[3], BROOK[4], BROOK[5]); c.stroke();
    c.strokeStyle = P.water; c.lineWidth = 16; c.stroke();
    if (!snow) { c.setLineDash([8, 22]); c.lineDashOffset = -t * 30; c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
    // cesta
    c.strokeStyle = shade(P.road, 0.85); c.lineWidth = 30; c.beginPath();
    for (let x = -20; x <= W + 20; x += 20) { if (x === -20) c.moveTo(x, roadY(x)); else c.lineTo(x, roadY(x)); }
    c.stroke(); c.strokeStyle = P.road; c.lineWidth = 25; c.stroke();
    c.lineCap = 'butt';
    // most
    { const [bx, by] = bridge; rect(c, bx - 26, by - 13, 52, 26, '#a98a6a', OL); for (let i = 0; i < 7; i++) line(c, bx - 26 + i * 8.6, by - 13, bx - 26 + i * 8.6, by + 13, '#8a6a4a', 1); line(c, bx - 26, by - 15, bx + 26, by - 15, '#6b4a30', 2.4); line(c, bx - 26, by + 15, bx + 26, by + 15, '#6b4a30', 2.4); }
    // rybník
    { const [px, py] = POND; ell(c, px, py, 78, 22, shade(P.water, 0.8)); ell(c, px, py - 1, 72, 19, P.water);
      if (!snow) { for (let i = 0; i < 3; i++) { const rr = ((t * 0.3 + i / 3) % 1); c.strokeStyle = `rgba(255,255,255,${0.4 * (1 - rr)})`; c.lineWidth = 1; c.beginPath(); c.ellipse(px - 20 + i * 18, py - 2, 4 + rr * 14, 1.5 + rr * 4, 0, 0, TAU); c.stroke(); } }
      if (season === 1) for (let i = 0; i < 4; i++) { ell(c, px - 40 + i * 24, py + 4 - (i % 2) * 6, 6, 2.6, '#4f9a3a'); if (i % 2) circ(c, px - 40 + i * 24, py + 2 - (i % 2) * 6, 1.8, '#ffb0d0'); }
      if (snow) for (let i = 0; i < 4; i++) line(c, px - 50 + i * 26, py - 6 + (i % 2) * 8, px - 36 + i * 26, py - 3 + (i % 2) * 8, 'rgba(255,255,255,.8)', 1.4);
      for (let i = 0; i < 7; i++) { const rx = px + 50 + i * 4, ry = py + 6 - (i % 3) * 3; line(c, rx, ry, rx + Math.sin(t + i) * 1.5, ry - 18, snow ? '#b8a07a' : '#5a8a3a', 1.6); if (i % 2) ell(c, rx, ry - 18, 1.6, 4, '#6b4a30'); }
    }
    // elektrické sloupy
    if (S && S.upg.elektrina) for (let x = 80; x < W; x += 190) { const y = roadY(x) - 17; line(c, x, y, x, y - 46, '#6b4a30', 2.4); line(c, x - 7, y - 42, x + 7, y - 42, '#6b4a30', 2); if (x + 190 < W) { c.strokeStyle = 'rgba(40,30,30,.6)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, y - 42); c.quadraticCurveTo(x + 95, y - 30, x + 190, roadY(x + 190) - 59); c.stroke(); } circ(c, x + 6, y - 38, 2.6, light.sun < 0.5 ? '#ffe9a0' : '#d8d8c8', OL); if (light.sun < 0.5) lights.push([x + 6, y - 36, 26, 'rgba(255,220,130,']); }
    // vše s hloubkou: seřadit podle y
    const items = [];
    TREES.forEach(([x, y, s, kd], i) => items.push([y, () => tree(c, k, x, y, s, kd, i + 1)]));
    const tot = S ? Econ.total(S) : 0;
    COTTAGES.forEach(([x, y], i) => { if (tot >= COTTAGE_AT[i]) items.push([y, () => cottage(c, k, x, y, i + 3)]); });
    if (S) for (const id of ['kaplicka', 'skola', 'posta']) if (S.upg[id]) items.push([300 + (id === 'skola' ? 1 : id === 'posta' ? 2 : 0), () => EXTRAS[id](c, k)]);
    let next = true;
    for (const b of BUILDINGS) {
      const n = S ? S.owned[b.id] : 0, [x, y] = SLOT[b.id];
      if (x + BOX[b.id][2] < cam - 40 || x + BOX[b.id][0] > cam + viewW() + 40) { if (!n) next = false; continue; }
      if (n) items.push([y, () => DRAW[b.id](c, k, x, y, LV(n))]);
      else if (next) { items.push([y, () => plot(c, k, x, y)]); next = false; }
    }
    for (const v of villagers) items.push([v.y, () => person(c, v)]);
    items.sort((a, b) => a[0] - b[0]);
    for (const [, f] of items) f();
    drawParts(c);
    updParts(frameDt);
    updVillagers(frameDt, tot);
    // noc a soumrak
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (night > 0.02) { c.fillStyle = `rgba(14,22,58,${night * 0.58})`; c.fillRect(0, 0, vw, vh); }
    if (light.dusk > 0.02) { c.fillStyle = `rgba(255,140,60,${light.dusk * 0.14})`; c.fillRect(0, 0, vw, vh); }
    if (night > 0.2 && lights.length) {
      c.setTransform(dpr * scale, 0, 0, dpr * scale, -cam * scale * dpr, 0);
      c.globalCompositeOperation = 'lighter';
      for (const [x, y, r, col] of lights) { const lg = c.createRadialGradient(x, y, 0, x, y, r); lg.addColorStop(0, col + (0.5 * night).toFixed(3) + ')'); lg.addColorStop(1, col + '0)'); c.fillStyle = lg; c.fillRect(x - r, y - r, r * 2, r * 2); }
      c.globalCompositeOperation = 'source-over';
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (creature && creature.p === 1) drawCreature(c);
    if (creature && creature.done) creature.gone += frameDt;
    updWeather(frameDt); drawWeather(c);
    drawFx(c, frameDt);
    drawMinimap(c);
  }
  function plot(c, k, x, y) {
    // staveniště dalšího řemesla
    for (const [ox, oy] of [[-24, 0], [24, 0], [-16, -12], [16, -12]]) rect(c, x + ox - 1.5, y + oy - 12, 3, 12, '#8a6a4a');
    c.strokeStyle = 'rgba(200,60,40,.8)'; c.lineWidth = 1; c.setLineDash([3, 2]);
    c.beginPath(); c.moveTo(x - 24, y - 10); c.lineTo(x - 16, y - 22); c.lineTo(x + 16, y - 22); c.lineTo(x + 24, y - 10); c.closePath(); c.stroke(); c.setLineDash([]);
    line(c, x + 32, y, x + 32, y - 30, '#6b4a30', 2.4);
    rect(c, x + 22, y - 44, 22, 16, '#e8d3a8', OL);
    c.fillStyle = '#6b4a30'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('?', x + 33, y - 32);
  }
  function drawRail(c, k) {
    const y = 290;
    line(c, 0, y, W, y, '#6b5a4a', 1.6); line(c, 0, y + 4, W, y + 4, '#6b5a4a', 1.6);
    for (let x = 0; x < W; x += 10) line(c, x, y - 1, x + 2, y + 5, '#8a6a4a', 1.4);
    const period = 70, ph = (t % period) / period, tx = -200 + ph * (W + 400);
    for (let i = 0; i < 4; i++) {
      const cx = tx - i * 40;
      if (i === 0) { rect(c, cx - 16, y - 20, 32, 18, '#2f3a4a', OL); rect(c, cx + 4, y - 30, 12, 12, '#2f3a4a', OL); rect(c, cx - 12, y - 28, 6, 8, '#3a3a3a', OL); circ(c, cx + 16, y - 10, 3, '#ffe9a0'); if (k.night > 0.3) lights.push([cx + 18, y - 10, 30, 'rgba(255,230,140,']); emit(cx - 9, y - 30, 'smoke', 3); }
      else { rect(c, cx - 16, y - 18, 32, 16, ['#b8452a', '#3e6f4a', '#b8452a'][i % 3], OL); for (let j = 0; j < 3; j++) windowAt(c, k, cx - 9 + j * 9, y - 11, 5, 5, { frame: '#e8dcc0' }); }
      circ(c, cx - 9, y, 3.2, '#2a2a2a'); circ(c, cx + 9, y, 3.2, '#2a2a2a');
    }
  }
  // Vesničané na cestě
  const villagers = [];
  function updVillagers(dt, tot) {
    const want = Math.min(26, (tot > 0 ? 1 : 0) + Math.floor(Math.sqrt(tot) * 0.9));
    const r = Math.random;
    while (villagers.length < want) { const x = 20 + r() * (W - 40); villagers.push({ x, dir: r() < 0.5 ? -1 : 1, v: 14 + r() * 12, off: (r() - 0.5) * 14, y: 0, ph: r() * 6, col: ['#c43a3a', '#3e6fd8', '#4f9a3a', '#e8a33a', '#8a4ab8', '#2a8a8a'][Math.floor(r() * 6)], skirt: r() < 0.5, hat: r() < 0.4, pause: 0 }); }
    if (villagers.length > want) villagers.length = want;
    for (const v of villagers) {
      if (v.pause > 0) v.pause -= dt; else { v.x += v.dir * v.v * dt; if (Math.random() < dt * 0.05) v.pause = 1 + Math.random() * 3; }
      if (v.x < 10) v.dir = 1; if (v.x > W - 10) v.dir = -1;
      if (Math.random() < dt * 0.02) v.dir *= -1;
      v.y = roadY(v.x) + v.off;
    }
  }
  function person(c, v) {
    const step = v.pause > 0 ? 0 : Math.sin(t * 9 + v.ph), x = v.x, y = v.y;
    line(c, x - 1.5, y - 7, x - 1.5 - step * 2, y, '#3a2a20', 1.8); line(c, x + 1.5, y - 7, x + 1.5 + step * 2, y, '#3a2a20', 1.8);
    if (v.skirt) poly(c, [x - 5, y - 4, x + 5, y - 4, x + 3, y - 15, x - 3, y - 15], v.col, OL, 1);
    else poly(c, [x - 3.5, y - 7, x + 3.5, y - 7, x + 3.5, y - 16, x - 3.5, y - 16], v.col, OL, 1);
    circ(c, x, y - 19, 3.4, '#f0d0a8', OL);
    if (v.hat) { ell(c, x, y - 21.5, 5.5, 1.4, '#3a2a20'); rect(c, x - 3, y - 25, 6, 3.5, '#3a2a20'); }
    else if (v.skirt) { c.beginPath(); c.arc(x, y - 20, 3.6, Math.PI, 0); c.fillStyle = ['#e8455a', '#f2c14e', '#ffffff'][Math.floor(v.ph) % 3]; c.fill(); }
    if (snow) ell(c, x, y - 1, 1, 0.5, '#fff');
  }
  function drawMinimap(c) {
    if (opts.clean) return;
    const m = 14, w = vw - m * 2, y = vh - 9;
    c.fillStyle = 'rgba(30,20,10,.28)'; roundRect(c, m, y - 2, w, 5, 2.5); c.fill();
    const a = cam / W, b = (cam + viewW()) / W;
    c.fillStyle = 'rgba(255,248,225,.85)'; roundRect(c, m + a * w, y - 2, Math.max(8, (b - a) * w), 5, 2.5); c.fill();
    if (creature && !creature.done) { const cx = creature.p < 1 ? cam + (creature.x - cam * creature.p) : creature.x; circ(c, m + (cx / W) * w, y + 0.5, 4 + Math.sin(t * 6), '#ffe25a', '#a8771e'); }
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // Kde je bytost mimo obraz: -1 vlevo, 1 vpravo, 0 vidět.
  function creatureSide() {
    if (!creature || creature.done) return 0;
    const sx = (creature.x - cam * creature.p) * scale;
    return sx < 0 ? -1 : sx > vw ? 1 : 0;
  }

  // ── Ikonka řemesla do seznamu (malé plátno) ──
  function icon(cvs, id, lvl, size) {
    const c = cvs.getContext('2d'), d = Math.min(2, window.devicePixelRatio || 1);
    cvs.width = size * d; cvs.height = size * d;
    const [x0, y0, x1, y1] = BOX[id], [sx, sy] = SLOT[id];
    const s = Math.min(size / (x1 - x0), size / (y1 - y0)) * 0.98;
    c.setTransform(d * s, 0, 0, d * s, d * (size / 2 - ((x0 + x1) / 2) * s), d * (size / 2 - ((y0 + y1) / 2) * s));
    const kk = { t: 0, season: 1, snow: false, night: 0, emit() {}, light() {} };
    const keep = t; t = 0;
    try { c.translate(-sx, -sy); DRAW[id](c, kk, sx, sy, Math.max(1, lvl)); } finally { t = keep; }
  }

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    bindInput(); resize();
  }
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = Math.max(1, r.width); vh = Math.max(1, r.height);
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    scale = vh / H;
    if (vw / scale > W) scale = vw / W;
    cam = clampCam(cam);
  }
  return {
    init, resize, frame, panTo, focusCreature, creatureScreen, spawnCreature, icon, floatText, burst, coin, creatureSide, opts, on, SLOT, BOX,
    get creature() { return creature; }, clearCreature() { creature = null; }, get cam() { return cam; }, get scale() { return scale; }, viewRange, LV,
  };
})();
