'use strict';
// ── OMALOVÁNKY · Windowling Hlavolamy ───────────────────────────────────────
// Malování podle čísel: generované pixelové obrazy (kytice, kočky, rybky, domky, houby, motýli,
// balóny, plachetnice, rakety, planety, krajiny, mlhoviny, lodě). Vyber barvu, maluj tahem, přibližuj kolečkem nebo dvěma prsty.
// Hotové obrazy se ukládají do galerie (stačí semínko, obraz se umí znovu vytvořit).
const Omalovanky = (() => {
  const L = Kit.L;
  const DIFFS = [
    { id: 'small', name: L('Malý', 'Small'), note: '24×24', n: 24, par: 4 * 60 },
    { id: 'medium', name: L('Střední', 'Medium'), note: '32×32', n: 32, par: 8 * 60 },
    { id: 'large', name: L('Velký', 'Large'), note: '40×40', n: 40, par: 13 * 60 },
    { id: 'huge', name: L('Obří', 'Huge'), note: '48×48', n: 48, par: 20 * 60 },
  ];
  // obrazy k vybarvení (bytost zůstává jen kvůli starším obrazům v galerii)
  const KINDS = ['flowers', 'cat', 'fish', 'house', 'mushroom', 'butterfly', 'balloon', 'boat', 'rocket', 'planet', 'land', 'nebula', 'ship'];
  const KIND_NAME = { planet: L('Planeta', 'Planet'), land: L('Krajina', 'Landscape'), creature: L('Bytost', 'Creature'), ship: L('Loď', 'Ship'), nebula: L('Mlhovina', 'Nebula'), flowers: L('Kytice', 'Bouquet'), cat: L('Kočka', 'Cat'), fish: L('Rybka', 'Fish'), house: L('Domek', 'Cottage'), mushroom: L('Houby', 'Mushrooms'), butterfly: L('Motýl', 'Butterfly'), balloon: L('Balón', 'Balloon'), boat: L('Plachetnice', 'Sailboat'), rocket: L('Raketa', 'Rocket') };

  // ── šum ──
  function noise2(r) {
    const G = 16, v = [...Array(G * G)].map(() => r());
    const at = (x, y) => v[((y % G + G) % G) * G + ((x % G + G) % G)];
    const sm = t => t * t * (3 - 2 * t);
    const n = (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0); return at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy; };
    return (x, y) => n(x, y) * 0.6 + n(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + n(x * 4.3 + 11, y * 4.3 + 5) * 0.1;
  }
  const hsl = (h, s, l) => `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s)}% ${Math.round(l)}%)`;

  // Každý generátor vrací { pal: [barvy], map: Uint8Array(n*n) indexů do palety }
  const GEN = {
    planet(n, r) {
      const h = r() * 360, pal = [hsl(250 + r() * 30, 50, 8), hsl(0, 0, 92), hsl(h, 70, 62), hsl(h + 20, 65, 48), hsl(h - 25, 60, 36), hsl(h + 10, 55, 24), hsl(h + 180, 70, 70), hsl(h + 160, 40, 50)];
      const map = new Uint8Array(n * n), cx = n * (0.42 + r() * 0.16), cy = n * (0.45 + r() * 0.1), R = n * (0.28 + r() * 0.06), tilt = (r() - 0.5) * 0.6;
      const nz = noise2(r), ring = r() < 0.7, moon = [n * (0.12 + r() * 0.2), n * (0.12 + r() * 0.2), n * 0.07];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x; map[i] = r() < 0.025 ? 1 : 0;
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        if (Math.hypot(x + 0.5 - moon[0], y + 0.5 - moon[1]) < moon[2]) map[i] = x + 0.5 - moon[0] > moon[2] * 0.3 ? 7 : 6;
        const ry = (dy - dx * tilt), rx = dx;
        const ringD = Math.hypot(rx / 1.9, ry / 0.42);
        const behind = ry < 0;
        if (ring && ringD > R * 1.08 && ringD < R * 1.32 && (behind ? d > R : true)) map[i] = 6;
        if (d < R && !(ring && !behind && ringD > R * 1.08 && ringD < R * 1.32)) {
          const band = Math.floor((dy / R + 1) * 3 + nz(x / 6, y / 3) * 2.2) % 3;
          const shade = (dx + dy * 0.4) / R;
          map[i] = shade > 0.45 ? 5 : [2, 3, 4][band];
          if (shade < -0.55 && band !== 2) map[i] = 2;
        }
      }
      return { pal, map };
    },
    land(n, r) {
      const h = r() * 360, pal = [hsl(h, 60, 18), hsl(h + 20, 65, 34), hsl(h + 40, 70, 55), hsl(h + 180, 90, 75), hsl(h + 200, 45, 30), hsl(h + 220, 45, 20), hsl(h + 240, 40, 12), hsl(h + 170, 60, 45), hsl(0, 0, 95)];
      const map = new Uint8Array(n * n), nz = noise2(r), sun = [n * (0.2 + r() * 0.6), n * (0.18 + r() * 0.15), n * (0.09 + r() * 0.05)], water = n * (0.72 + r() * 0.1);
      const ridge = k => x => n * (0.38 + k * 0.12) - nz(x / (8 - k * 2) + k * 10, k * 5) * n * (0.28 - k * 0.05);
      const ridges = [ridge(0), ridge(1), ridge(2)];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x;
        let c = y < n * 0.22 ? 0 : y < n * 0.42 ? 1 : 2;
        if (y < n * 0.3 && r() < 0.03) c = 8;
        if (Math.hypot(x + 0.5 - sun[0], y + 0.5 - sun[1]) < sun[2]) c = 3;
        ridges.forEach((f, k) => { if (y >= f(x)) c = 4 + k; });
        if (y >= water) { const ry = 2 * water - y - 1; c = ry > 0 && Math.abs(x + 0.5 - sun[0]) < sun[2] * (0.7 - (y - water) / n) ? 3 : nz(x / 5, y * 1.7) > 0.62 ? 8 : 7; }
        map[i] = c;
      }
      return { pal, map };
    },
    creature(n, r) {
      const h = r() * 360, pal = [hsl(250, 40, 10), hsl(h, 75, 58), hsl(h + 15, 70, 42), hsl(h - 10, 80, 72), hsl(0, 0, 97), hsl(260, 60, 14), hsl(h + 160, 85, 60), hsl(0, 0, 80)];
      const map = new Uint8Array(n * n), half = Math.ceil(n / 2), body = new Uint8Array(n * n), nz = noise2(r);
      for (let y = 0; y < n; y++) for (let x = 0; x < half; x++) {
        const cx = Math.abs(x + 0.5 - n / 2) / (n / 2), cy = (y + 0.5) / n;
        const v = nz(x / 4, y / 4) + (1 - cx) * 0.55 - Math.abs(cy - 0.52) * 1.1 > 0.62 ? 1 : 0;
        body[y * n + x] = v; body[y * n + n - 1 - x] = v;
      }
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x;
        if (!body[i]) { map[i] = (r() < 0.02 ? 7 : 0); continue; }
        const edge = [i - 1, i + 1, i - n, i + n].some(j => j < 0 || j >= n * n || !body[j]);
        map[i] = edge ? 2 : y > n * 0.6 && Math.abs(x + 0.5 - n / 2) < n * 0.15 ? 3 : 1;
        if (!edge && (x + y * 3) % 7 === 0 && y < n * 0.55) map[i] = 6;
      }
      const ey = Math.floor(n * (0.36 + r() * 0.08)), ex = Math.floor(n * (0.32 + r() * 0.08)), er = Math.max(1, Math.round(n * 0.05));
      for (const sx of [ex, n - 1 - ex]) for (let y = -er; y <= er; y++) for (let x = -er; x <= er; x++) if (x * x + y * y <= er * er) { const i = (ey + y) * n + sx + x; if (i >= 0 && i < n * n) map[i] = x * x + y * y <= (er * 0.45) ** 2 ? 5 : 4; }
      return { pal, map };
    },
    ship(n, r) {
      const h = r() * 360, pal = [hsl(240, 45, 9), hsl(0, 0, 95), hsl(h, 20, 78), hsl(h, 25, 55), hsl(h, 30, 35), hsl(h + 180, 90, 62), hsl(30, 100, 60), hsl(50, 100, 70), hsl(h + 30, 80, 55)];
      const map = new Uint8Array(n * n);
      for (let i = 0; i < n * n; i++) map[i] = r() < 0.025 ? 1 : 0;
      const top = Math.floor(n * 0.08), bot = Math.floor(n * 0.72), half = n / 2;
      let wmax = n * (0.13 + r() * 0.06);
      const widths = [];
      for (let y = top; y <= bot; y++) { const t = (y - top) / (bot - top); widths.push(Math.max(1, wmax * Math.min(1, Math.sin(Math.min(1, t * 1.6) * Math.PI / 2) + 0.1))); }
      const wingY = top + Math.floor((bot - top) * (0.55 + r() * 0.15)), wingW = n * (0.18 + r() * 0.1), wingH = Math.floor(n * (0.16 + r() * 0.08));
      for (let y = top; y <= bot; y++) {
        const w = widths[y - top];
        for (let x = 0; x < n; x++) {
          const dx = Math.abs(x + 0.5 - half), i = y * n + x;
          if (dx < w) map[i] = dx > w - 1.2 ? 4 : dx < w * 0.35 ? 2 : 3;
          const wy = y - wingY;
          if (wy >= 0 && wy < wingH && dx >= w - 0.5 && dx < w + wingW * (1 - wy / wingH * 0.4) && dx > w * 0.8 + wy * 0.6) map[i] = wy === wingH - 1 || dx > w + wingW * (1 - wy / wingH * 0.4) - 1.2 ? 8 : 4;
        }
      }
      const wy = top + Math.floor((bot - top) * 0.3), wr = Math.max(1.2, n * 0.055);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (Math.hypot(x + 0.5 - half, y + 0.5 - wy) < wr) map[y * n + x] = Math.hypot(x + 0.5 - half + wr * 0.3, y + 0.5 - wy + wr * 0.3) < wr * 0.4 ? 1 : 5;
      for (let y = bot + 1; y < Math.min(n, bot + n * 0.2); y++) { const t = (y - bot) / (n * 0.2), w = wmax * 0.7 * (1 - t); for (let x = 0; x < n; x++) { const dx = Math.abs(x + 0.5 - half); if (dx < w) map[y * n + x] = dx < w * 0.45 ? 7 : 6; } }
      return { pal, map };
    },
    nebula(n, r) {
      const h = r() * 360, pal = [hsl(250, 50, 7), hsl(h, 60, 22), hsl(h + 25, 70, 38), hsl(h + 50, 80, 55), hsl(h + 75, 90, 72), hsl(h + 100, 95, 86), hsl(0, 0, 98), hsl(h + 200, 80, 60)];
      const map = new Uint8Array(n * n), nz = noise2(r), nz2 = noise2(r);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const v = nz(x / (n / 5), y / (n / 5)), w = nz2(x / (n / 3) + 3, y / (n / 3));
        let c = v < 0.38 ? 0 : v < 0.46 ? 1 : v < 0.54 ? 2 : v < 0.62 ? 3 : v < 0.7 ? 4 : 5;
        if (c <= 1 && w > 0.62) c = 7;
        if (r() < 0.02 && c < 3) c = 6;
        map[y * n + x] = c;
      }
      return { pal, map };
    },
  };
  // ── Vektorové scény: tvary v jednotkových souřadnicích (0–1), rastrované čistou matematikou
  // (3×3 vzorky na políčko, většinou hlasů), takže obraz je ve všech prohlížečích stejný ──
  const S = {
    C: (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r,
    E: (cx, cy, rx, ry, a = 0) => { const c = Math.cos(a), s = Math.sin(a); return (x, y) => { const dx = x - cx, dy = y - cy, u = dx * c + dy * s, v = -dx * s + dy * c; return (u / rx) ** 2 + (v / ry) ** 2 <= 1; }; },
    R: (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1,
    RR: (x0, y0, x1, y1, r) => (x, y) => { if (x < x0 || x > x1 || y < y0 || y > y1) return false; const qx = Math.max(x0 + r - x, 0, x - (x1 - r)), qy = Math.max(y0 + r - y, 0, y - (y1 - r)); return qx * qx + qy * qy <= r * r; },
    P: pts => (x, y) => { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; },
    L: (x0, y0, x1, y1, w) => (x, y) => { const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1))), px = x0 + dx * t - x, py = y0 + dy * t - y; return px * px + py * py <= (w / 2) ** 2; },
    below: f => (x, y) => y >= f(x),
    and: (a, b) => (x, y) => a(x, y) && b(x, y),
    not: (a, b) => (x, y) => a(x, y) && !b(x, y),
    any: (...fs) => (x, y) => fs.some(f => f(x, y)),
  };
  function raster(n, layers, dots) {
    const map = new Uint8Array(n * n), votes = new Map();
    for (let cy = 0; cy < n; cy++) for (let cx = 0; cx < n; cx++) {
      votes.clear(); let best = 0, bestN = -1;
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
        const x = (cx + (sx + 0.5) / 3) / n, y = (cy + (sy + 0.5) / 3) / n;
        let c = 0; for (let k = layers.length - 1; k >= 0; k--) if (layers[k][1](x, y)) { c = layers[k][0]; break; }
        const v = (votes.get(c) || 0) + 1 + (sx === 1 && sy === 1 ? 0.5 : 0); votes.set(c, v);
        if (v > bestN) { bestN = v; best = c; }
      }
      map[cy * n + cx] = best;
    }
    if (dots) for (const [x, y, c] of dots) { const i = Math.min(n - 1, Math.floor(y * n)) * n + Math.min(n - 1, Math.floor(x * n)); if (map[i] === 0) map[i] = c; }
    return map;
  }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const stars = (r, k, c, y1 = 1) => [...Array(k)].map(() => [r(), r() * y1, c]);
  const clouds = (r, cnt, y0, y1) => [...Array(cnt)].map(() => { const x = 0.1 + r() * 0.8, y = y0 + r() * (y1 - y0), s = 0.05 + r() * 0.03; return S.any(S.C(x, y, s), S.C(x + s * 1.1, y + s * 0.2, s * 0.8), S.C(x - s * 1.1, y + s * 0.25, s * 0.75), S.E(x, y + s * 0.5, s * 2, s * 0.5)); });
  Object.assign(GEN, {
    flowers(n, r) {
      const wall = r() * 360, a = r() * 360, b = a + 60 + r() * 120;
      const pal = [hsl(wall, 45, 86), hsl(wall, 35, 74), hsl(25, 45, 42), hsl(25, 50, 30), hsl(a, 75, 62), hsl(b, 70, 58), hsl(48, 95, 60), hsl(120, 45, 42), hsl(130, 50, 28), hsl(200 + r() * 100, 55, 52), hsl(0, 0, 97)];
      const L = [[1, S.and(S.R(0, 0, 1, 1), (x, y) => (Math.floor(x * 8) + Math.floor(y * 8)) % 2 === 0 && y < 0.72)], [2, S.R(0, 0.78, 1, 1)], [3, S.R(0, 0.78, 1, 0.81)]];
      const vx = 0.5 + (r() - 0.5) * 0.1, vy = 0.78;
      const heads = [[vx - 0.2, 0.3 + r() * 0.08], [vx + 0.02, 0.17 + r() * 0.06], [vx + 0.22, 0.32 + r() * 0.08]];
      for (const [hx, hy] of heads) L.push([7, S.L(vx + (hx - vx) * 0.15, 0.6, hx, hy, 0.022)]);
      L.push([8, S.E(vx - 0.1, 0.5, 0.07, 0.03, -0.6)], [8, S.E(vx + 0.12, 0.47, 0.07, 0.03, 0.6)]);
      heads.forEach(([hx, hy], k) => {
        const pr = 0.055 + r() * 0.015, np = 5 + Math.floor(r() * 3), col = k === 1 ? 5 : 4, rot = r() * 6;
        for (let i = 0; i < np; i++) { const t = rot + (i / np) * Math.PI * 2; L.push([col, S.C(hx + Math.cos(t) * pr * 1.1, hy + Math.sin(t) * pr * 1.1, pr * 0.85)]); }
        L.push([6, S.C(hx, hy, pr * 0.65)]);
      });
      L.push([9, S.P([[vx - 0.1, 0.56], [vx + 0.1, 0.56], [vx + 0.14, 0.66], [vx + 0.1, 0.78], [vx - 0.1, 0.78], [vx - 0.14, 0.66]])], [10, S.R(vx - 0.075, 0.6, vx - 0.05, 0.74)]);
      return { pal, map: raster(n, L) };
    },
    cat(n, r) {
      const kind = pick(r, [[28, 75, 55], [0, 0, 55], [30, 20, 25], [35, 40, 78]]), bg = r() * 360;
      const pal = [hsl(bg, 50, 82), hsl(bg, 40, 66), hsl(kind[0], kind[1], kind[2]), hsl(kind[0], kind[1], Math.max(12, kind[2] - 20)), hsl(0, 0, 96), hsl(345, 70, 72), hsl(pick(r, [95, 50, 190]), 70, 50), hsl(0, 0, 8), hsl(kind[0], kind[1], Math.min(92, kind[2] + 18))];
      const L = [[1, S.below(x => 0.8 + Math.sin(x * 9) * 0.01)]];
      L.push([2, S.L(0.68, 0.8, 0.85, 0.55, 0.06)], [2, S.L(0.85, 0.55, 0.8, 0.4, 0.06)]);
      L.push([2, S.E(0.52, 0.66, 0.22, 0.18)], [8, S.E(0.5, 0.7, 0.1, 0.1)]);
      L.push([2, S.E(0.44, 0.8, 0.07, 0.035)], [2, S.E(0.62, 0.8, 0.07, 0.035)]);
      L.push([2, S.P([[0.28, 0.36], [0.31, 0.12], [0.43, 0.27]])], [2, S.P([[0.72, 0.36], [0.69, 0.12], [0.57, 0.27]])]);
      L.push([5, S.P([[0.31, 0.31], [0.32, 0.18], [0.39, 0.27]])], [5, S.P([[0.69, 0.31], [0.68, 0.18], [0.61, 0.27]])]);
      L.push([2, S.E(0.5, 0.38, 0.22, 0.18)]);
      if (r() < 0.6) for (const dx of [-0.08, 0, 0.08]) L.push([3, S.L(0.5 + dx, 0.21, 0.5 + dx * 1.2, 0.27, 0.025)]);
      L.push([8, S.E(0.5, 0.47, 0.11, 0.07)]);
      for (const ex of [0.41, 0.59]) L.push([4, S.E(ex, 0.36, 0.055, 0.05)], [6, S.E(ex, 0.36, 0.045, 0.045)], [7, S.E(ex, 0.36, 0.014, 0.04)]);
      L.push([5, S.P([[0.47, 0.44], [0.53, 0.44], [0.5, 0.48]])]);
      L.push([3, S.L(0.5, 0.48, 0.47, 0.51, 0.015)], [3, S.L(0.5, 0.48, 0.53, 0.51, 0.015)]);
      return { pal, map: raster(n, L) };
    },
    fish(n, r) {
      const f = r() * 360;
      const pal = [hsl(200, 70, 42), hsl(205, 70, 32), hsl(195, 65, 55), hsl(f, 85, 58), hsl(f + 30, 85, 48), hsl(0, 0, 97), hsl(0, 0, 8), hsl(45, 60, 70), hsl(130, 50, 38), hsl(190, 80, 82)];
      const L = [[1, S.below(x => 0.55 + Math.sin(x * 6) * 0.03)], [2, (x, y) => y < 0.22 + Math.sin(x * 14) * 0.015]];
      L.push([7, S.below(x => 0.86 + Math.sin(x * 11) * 0.02)]);
      for (const sx of [0.1, 0.18, 0.86]) { const top = 0.5 + r() * 0.1; L.push([8, (x, y) => Math.abs(x - (sx + Math.sin(y * 18) * 0.02)) < 0.022 && y > top]); }
      const fx = 0.48, fy = 0.48 + (r() - 0.5) * 0.08, dir = r() < 0.5 ? 1 : -1;
      L.push([4, S.P([[fx - dir * 0.18, fy], [fx - dir * 0.34, fy - 0.12], [fx - dir * 0.34, fy + 0.12]])]);
      L.push([4, S.P([[fx - 0.06, fy - 0.12], [fx + dir * 0.08, fy - 0.22], [fx + dir * 0.1, fy - 0.1]])]);
      L.push([3, S.E(fx, fy, 0.22, 0.13)]);
      for (const k of [-0.07, 0.02]) L.push([4, S.and(S.E(fx, fy, 0.22, 0.13), S.R(fx + dir * k - 0.025, 0, fx + dir * k + 0.025, 1))]);
      L.push([5, S.C(fx + dir * 0.12, fy - 0.03, 0.04)], [6, S.C(fx + dir * 0.13, fy - 0.03, 0.02)]);
      for (let i = 0; i < 4; i++) { const bx = fx + dir * (0.26 + i * 0.03), by = fy - 0.1 - i * 0.1; L.push([9, S.C(bx, by, 0.018 + i * 0.006)]); }
      return { pal, map: raster(n, L, stars(r, Math.round(n / 4), 9, 0.4)) };
    },
    house(n, r) {
      const wall = r() * 360, roof = pick(r, [5, 15, 210, 140]);
      const pal = [hsl(205, 70, 70), hsl(0, 0, 97), hsl(48, 95, 60), hsl(110, 45, 50), hsl(115, 45, 36), hsl(wall, 45, 78), hsl(roof, 60, 42), hsl(25, 45, 32), hsl(200, 60, 85), hsl(35, 30, 60), hsl(120, 40, 26)];
      const L = clouds(r, 2, 0.08, 0.2).map(c => [1, c]);
      L.push([2, S.C(0.15 + r() * 0.1, 0.13, 0.07)]);
      L.push([3, S.below(x => 0.62 - Math.sin(x * 3 + 1) * 0.04)], [4, S.below(x => 0.8 + Math.sin(x * 5) * 0.02)]);
      const hx = 0.32 + r() * 0.12;
      L.push([7, S.R(hx + 0.2, 0.22, hx + 0.25, 0.36)]);
      L.push([5, S.R(hx, 0.42, hx + 0.36, 0.74)], [6, S.P([[hx - 0.05, 0.43], [hx + 0.18, 0.24], [hx + 0.41, 0.43]])]);
      L.push([7, S.RR(hx + 0.14, 0.56, hx + 0.22, 0.74, 0.03)], [2, S.C(hx + 0.205, 0.65, 0.008)]);
      for (const wx of [hx + 0.03, hx + 0.26]) L.push([8, S.R(wx, 0.5, wx + 0.07, 0.58)], [7, S.any(S.R(wx + 0.032, 0.5, wx + 0.038, 0.58), S.R(wx, 0.537, wx + 0.07, 0.543))]);
      L.push([9, S.P([[hx + 0.15, 0.74], [hx + 0.21, 0.74], [hx + 0.3, 1], [hx + 0.06, 1]])]);
      const tx = hx > 0.4 ? 0.14 : 0.86;
      L.push([7, S.R(tx - 0.02, 0.5, tx + 0.02, 0.78)], [10, S.any(S.C(tx, 0.42, 0.09), S.C(tx - 0.06, 0.5, 0.06), S.C(tx + 0.06, 0.5, 0.06))]);
      return { pal, map: raster(n, L) };
    },
    mushroom(n, r) {
      const cap = pick(r, [2, 15, 30]);
      const pal = [hsl(150, 35, 22), hsl(140, 35, 30), hsl(105, 50, 45), hsl(95, 55, 34), hsl(cap, 80, 50), hsl(0, 0, 97), hsl(40, 45, 86), hsl(40, 30, 70), hsl(pick(r, [280, 320, 50]), 70, 70), hsl(150, 30, 14)];
      const L = [[1, S.below(x => 0.35 + Math.sin(x * 7 + r() * 3) * 0.05)], [9, S.below(x => 0.55 + Math.sin(x * 5) * 0.03)], [2, S.below(x => 0.76 + Math.sin(x * 9) * 0.02)]];
      for (let i = 0; i < 9; i++) { const gx = r(); L.push([3, S.P([[gx - 0.02, 0.8], [gx + (r() - 0.5) * 0.04, 0.68 + r() * 0.06], [gx + 0.02, 0.8]])]); }
      const big = [0.42 + (r() - 0.5) * 0.08, 0.26], small = [big[0] + 0.28, 0.16];
      for (const [mx, s] of [big, small]) {
        const top = 0.82 - s * 2.2;
        L.push([6, S.RR(mx - s * 0.32, top + s * 0.5, mx + s * 0.32, 0.82, s * 0.15)], [7, S.R(mx + s * 0.12, top + s * 0.55, mx + s * 0.32, 0.82)]);
        L.push([4, S.and(S.E(mx, top + s * 0.55, s, s * 0.75), (x, y) => y <= top + s * 0.55)]);
        for (const [dx, dy, rr] of [[-0.45, 0.3, 0.14], [0.1, 0.12, 0.16], [0.5, 0.35, 0.12], [-0.1, 0.42, 0.1]]) L.push([5, S.C(mx + dx * s, top + dy * s, rr * s)]);
      }
      for (let i = 0; i < 3; i++) { const fx = 0.08 + r() * 0.2; L.push([3, S.L(fx, 0.82, fx, 0.74, 0.015)], [8, S.C(fx, 0.73, 0.022)]); }
      return { pal, map: raster(n, L) };
    },
    butterfly(n, r) {
      const a = r() * 360, b = a + 140 + r() * 60;
      const pal = [hsl(a + 200, 50, 85), hsl(a, 80, 58), hsl(a + 20, 80, 40), hsl(b, 80, 62), hsl(0, 0, 10), hsl(0, 0, 97), hsl(110, 45, 46), hsl(pick(r, [330, 50, 280]), 75, 68), hsl(48, 95, 60)];
      const cx = 0.5, cy = 0.44, L = [];
      L.push([6, S.below(x => 0.86 + Math.sin(x * 8) * 0.02)]);
      for (const fx of [0.15, 0.82]) L.push([6, S.L(fx, 1, fx, 0.8, 0.02)], [7, S.C(fx, 0.79, 0.04)], [8, S.C(fx, 0.79, 0.015)]);
      for (const s of [-1, 1]) {
        L.push([2, S.E(cx + s * 0.19, cy - 0.1, 0.19, 0.15, s * -0.5)], [1, S.E(cx + s * 0.19, cy - 0.1, 0.15, 0.11, s * -0.5)]);
        L.push([2, S.E(cx + s * 0.14, cy + 0.15, 0.12, 0.1, s * 0.6)], [3, S.E(cx + s * 0.14, cy + 0.15, 0.08, 0.065, s * 0.6)]);
        L.push([3, S.C(cx + s * 0.22, cy - 0.13, 0.045)], [5, S.C(cx + s * 0.3, cy - 0.17, 0.02)], [5, S.C(cx + s * 0.13, cy - 0.04, 0.018)]);
        L.push([4, S.L(cx + s * 0.01, cy - 0.17, cx + s * 0.08, cy - 0.3, 0.012)], [4, S.C(cx + s * 0.08, cy - 0.3, 0.018)]);
      }
      L.push([4, S.E(cx, cy, 0.03, 0.17)]);
      return { pal, map: raster(n, L) };
    },
    balloon(n, r) {
      const a = r() * 360, b = a + 90 + r() * 120;
      const pal = [hsl(200, 70, 72), hsl(205, 65, 82), hsl(0, 0, 97), hsl(a, 80, 58), hsl(b, 80, 55), hsl(48, 95, 62), hsl(30, 50, 40), hsl(25, 35, 25), hsl(120, 40, 45), hsl(125, 40, 34)];
      const L = [[1, S.below(x => 0.5)], ...clouds(r, 3, 0.1, 0.7).map(c => [2, c])];
      L.push([8, S.below(x => 0.86 + Math.sin(x * 6) * 0.03)], [9, S.below(x => 0.93 + Math.sin(x * 9 + 1) * 0.015)]);
      const bx = 0.5 + (r() - 0.5) * 0.12, by = 0.36, R = 0.24, shape = S.any(S.C(bx, by, R), S.P([[bx - R * 0.86, by + R * 0.5], [bx + R * 0.86, by + R * 0.5], [bx + R * 0.25, by + R * 1.35], [bx - R * 0.25, by + R * 1.35]]));
      const k = 3 + Math.floor(r() * 2);
      L.push([3, shape]);
      L.push([4, S.and(shape, (x, y) => { const w = Math.max(0.01, R * (y < by ? Math.sqrt(Math.max(0, 1 - ((y - by) / R) ** 2)) : 1 - (y - by) / (R * 1.6))); const u = (x - bx) / w; return Math.floor((u + 1) * k) % 2 === 1; })]);
      L.push([5, S.and(shape, S.R(0, by + R * 0.85, 1, by + R * 1.05))]);
      L.push([6, S.L(bx - R * 0.25, by + R * 1.35, bx - R * 0.2, by + R * 1.7, 0.01)], [6, S.L(bx + R * 0.25, by + R * 1.35, bx + R * 0.2, by + R * 1.7, 0.01)]);
      L.push([7, S.RR(bx - R * 0.26, by + R * 1.68, bx + R * 0.26, by + R * 1.98, 0.015)], [6, S.R(bx - R * 0.26, by + R * 1.68, bx + R * 0.26, by + R * 1.74)]);
      return { pal, map: raster(n, L) };
    },
    boat(n, r) {
      const hull = pick(r, [5, 210, 30, 140]), sail = r() * 360;
      const pal = [hsl(30, 85, 78), hsl(15, 80, 68), hsl(48, 100, 64), hsl(205, 65, 45), hsl(210, 65, 33), hsl(200, 70, 72), hsl(hull, 60, 42), hsl(0, 0, 97), hsl(sail, 75, 58), hsl(25, 40, 30)];
      const L = [[1, S.below(x => 0.36)], [2, S.C(0.5 + (r() - 0.5) * 0.4, 0.55, 0.14)]];
      L.push([3, S.below(x => 0.58)], [4, S.below(x => 0.8)]);
      for (let i = 0; i < 6; i++) { const wx = r(), wy = 0.62 + r() * 0.3; L.push([5, S.L(wx - 0.06, wy, wx + 0.06, wy, 0.014)]); }
      const bx = 0.5 + (r() - 0.5) * 0.2;
      L.push([9, S.L(bx, 0.62, bx, 0.12, 0.02)]);
      L.push([7, S.P([[bx + 0.02, 0.15], [bx + 0.02, 0.56], [bx + 0.28, 0.56]])], [8, S.P([[bx - 0.02, 0.2], [bx - 0.02, 0.56], [bx - 0.22, 0.56]])]);
      L.push([8, S.and(S.P([[bx + 0.02, 0.15], [bx + 0.02, 0.56], [bx + 0.28, 0.56]]), S.R(0, 0.36, 1, 0.42))]);
      L.push([8, S.P([[bx, 0.1], [bx + 0.09, 0.13], [bx, 0.16]])]);
      L.push([6, S.P([[bx - 0.28, 0.58], [bx + 0.32, 0.58], [bx + 0.22, 0.7], [bx - 0.2, 0.7]])], [7, S.R(bx - 0.25, 0.6, bx + 0.29, 0.62)]);
      return { pal, map: raster(n, L, [[0.15, 0.2, 9], [0.2, 0.17, 9], [0.8, 0.12, 9]]) };
    },
    rocket(n, r) {
      const body = r() * 360, planet = r() * 360;
      const pal = [hsl(250, 50, 10), hsl(0, 0, 96), hsl(body, 75, 55), hsl(body, 70, 38), hsl(195, 80, 70), hsl(200, 30, 35), hsl(45, 100, 60), hsl(20, 100, 55), hsl(planet, 55, 58), hsl(planet + 30, 50, 40), hsl(0, 0, 75)];
      const L = [[8, S.C(0.82, 0.8, 0.2)], [9, S.and(S.C(0.82, 0.8, 0.2), (x, y) => Math.sin((y - x * 0.3) * 40) > 0.4)]];
      const rx = 0.42 + (r() - 0.5) * 0.08;
      L.push([7, S.P([[rx - 0.06, 0.74], [rx + 0.06, 0.74], [rx, 0.96]])], [6, S.P([[rx - 0.035, 0.74], [rx + 0.035, 0.74], [rx, 0.88]])]);
      L.push([3, S.P([[rx - 0.08, 0.5], [rx - 0.2, 0.74], [rx - 0.08, 0.7]])], [3, S.P([[rx + 0.08, 0.5], [rx + 0.2, 0.74], [rx + 0.08, 0.7]])]);
      L.push([10, S.any(S.E(rx, 0.45, 0.1, 0.32), S.R(rx - 0.1, 0.45, rx + 0.1, 0.74))]);
      L.push([2, S.and(S.any(S.E(rx, 0.45, 0.1, 0.32), S.R(rx - 0.1, 0.45, rx + 0.1, 0.74)), (x, y) => y < 0.26)]);
      L.push([2, S.R(rx - 0.1, 0.62, rx + 0.1, 0.66)], [3, S.R(rx - 0.03, 0.5, rx + 0.03, 0.74)]);
      L.push([5, S.C(rx, 0.38, 0.06)], [4, S.C(rx, 0.38, 0.042)], [1, S.C(rx - 0.015, 0.365, 0.012)]);
      return { pal, map: raster(n, L, stars(r, Math.round(n / 2.5), 1)) };
    },
  });
  // vyhoď nepoužité barvy, seřaď od nejčastější
  function compact(img) {
    const cnt = new Map(); img.map.forEach(c => cnt.set(c, (cnt.get(c) || 0) + 1));
    const order = [...cnt.keys()].sort((a, b) => cnt.get(b) - cnt.get(a)), re = new Map(order.map((c, k) => [c, k]));
    return { pal: order.map(c => img.pal[c]), map: img.map.map(c => re.get(c)) };
  }
  function image(seed, n, kind) { const r = Kit.rng(seed); kind = kind || KINDS[Math.floor(r() * KINDS.length)]; return Object.assign(compact(GEN[kind](n, r)), { kind }); }

  function generate(seed, diffId, ctx = {}) {
    let n = (DIFFS.find(d => d.id === diffId) || DIFFS[0]).n, kind = null;
    if (ctx.kind === 'level') { const ch = Math.floor((ctx.key - 1) / 20); n = [20, 24, 28, 32, 40, 48][ch]; kind = KINDS[(ctx.key - 1) % KINDS.length]; }
    const img = image(seed, n, kind);
    return { seed, n, kind: img.kind, pal: img.pal, map: Array.from(img.map).join(','), name: `${KIND_NAME[img.kind]} #${(seed % 9000) + 1000}` };
  }

  const BRUSH = '<svg class="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-8 8-6-6z"/><path d="M6 12c-2 1-3 3-3 6 3 0 5-1 6-3"/></svg>';
  const BUCKET = '<svg class="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10l7-7 7 7-7 7z"/><path d="M5 10h14"/><path d="M20 14c0 2 1 3 1 4a1.5 1.5 0 0 1-3 0c0-1 1-2 2-4z"/></svg>';
  function create(el, P, saved, api) {
    const n = P.n, map = P.map.split(',').map(Number), pal = P.pal;
    // starší uložené hry patří ke starým obrazům: začni znovu
    if (saved && saved.v !== 2) saved = null;
    let paint = saved && saved.paint ? saved.paint.slice() : new Array(n * n).fill(-1); // -1 nic
    let col = saved && saved.col != null ? saved.col : 0, done = false;
    el.innerHTML = `<div class="om-wrap"><div class="om-stage"><canvas class="om-cv"></canvas></div>
      <div class="om-pal">${pal.map((c, k) => `<button class="om-sw" data-c="${k}" style="--c:${c}"><b>${k + 1}</b><i></i></button>`).join('')}</div>
      <div class="k-tools"><button class="k-tool" data-t="brush">${BRUSH}<span>${L('Štětec', 'Brush')}</span></button><button class="k-tool" data-t="bucket">${BUCKET}<span>${L('Kyblík', 'Bucket')}</span></button><button class="k-tool" data-t="find">${api.icon('bulb')}<span>${L('Najít', 'Find')}</span></button><button class="k-tool" data-t="fit">${api.icon('plus')}<span>${L('Celý obraz', 'Fit')}</span></button></div></div>`;
    const stage = el.querySelector('.om-stage'), cv = el.querySelector('.om-cv'), ctx = cv.getContext('2d'), palEl = el.querySelector('.om-pal');
    let scale = 10, ox = 0, oy = 0, vw = 300, vh = 300; const dpr = Math.min(2, devicePixelRatio || 1);
    const lum = c => { const m = /hsl\((\d+) (\d+)% (\d+)%\)/.exec(c); return m ? +m[3] : 50; };
    // nevybarvený papír má jemný odstín podle cílové barvy, takže obraz prosvítá
    const paper = pal.map(c => { const g = Math.round(247 - (100 - lum(c)) * 0.16); return `rgb(${g},${g - 2},${g + 5})`; });
    let tool = saved && saved.tool === 'bucket' ? 'bucket' : 'brush', shine = 0;
    function fitView() {
      const w = (document.getElementById('kView') || el).clientWidth - 28, h = innerHeight - (innerWidth < 760 ? 300 : 240);
      vw = Math.max(240, Math.min(w, 760)); vh = Math.max(240, Math.min(h, 760)); const s = Math.min(vw, vh);
      vw = vh = s; cv.width = vw * dpr; cv.height = vh * dpr; cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
      scale = s / n; ox = 0; oy = 0; draw();
    }
    function clampView() { const minS = Math.min(vw, vh) / n; scale = Math.max(minS, Math.min(scale, 60)); ox = Math.min(0, Math.max(vw - n * scale, ox)); oy = Math.min(0, Math.max(vh - n * scale, oy)); }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, vw, vh);
      ctx.fillStyle = '#0c0a1e'; ctx.fillRect(0, 0, vw, vh);
      const x0 = Math.max(0, Math.floor(-ox / scale)), y0 = Math.max(0, Math.floor(-oy / scale)), x1 = Math.min(n, Math.ceil((vw - ox) / scale)), y1 = Math.min(n, Math.ceil((vh - oy) / scale));
      const showNum = scale >= 13, fs = scale * 0.5;
      ctx.font = `600 ${fs}px "Space Grotesk", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = y * n + x, px = ox + x * scale, py = oy + y * scale, p = paint[i];
        if (p === map[i]) { ctx.fillStyle = pal[p]; ctx.fillRect(px, py, scale + 0.6, scale + 0.6); continue; }
        ctx.fillStyle = paper[map[i]]; ctx.fillRect(px, py, scale + 0.6, scale + 0.6);
        if (map[i] === col) { ctx.fillStyle = 'rgba(124,100,255,.26)'; ctx.fillRect(px, py, scale + 0.6, scale + 0.6); }
        if (p >= 0) { ctx.fillStyle = pal[p]; ctx.fillRect(px + scale * 0.16, py + scale * 0.16, scale * 0.68, scale * 0.68); ctx.strokeStyle = '#ff3a5a'; ctx.lineWidth = Math.max(1, scale * 0.08); ctx.strokeRect(px + scale * 0.16, py + scale * 0.16, scale * 0.68, scale * 0.68); }
        if (showNum) { ctx.fillStyle = map[i] === col ? '#120a30' : 'rgba(60,56,90,.6)'; ctx.font = `${map[i] === col ? 800 : 600} ${fs}px "Space Grotesk", sans-serif`; ctx.fillText(String(map[i] + 1), px + scale / 2, py + scale / 2 + 0.5); }
      }
      if (shine > 0) { const k = 1 - shine, gx = -vw * 0.4 + k * vw * 1.8, g = ctx.createLinearGradient(gx - 80, 0, gx + 80, vh); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh); return; }
      if (scale >= 8) { ctx.strokeStyle = 'rgba(40,30,80,.1)'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = x0; x <= x1; x++) { ctx.moveTo(ox + x * scale + 0.5, oy + y0 * scale); ctx.lineTo(ox + x * scale + 0.5, oy + y1 * scale); } for (let y = y0; y <= y1; y++) { ctx.moveTo(ox + x0 * scale, oy + y * scale + 0.5); ctx.lineTo(ox + x1 * scale, oy + y * scale + 0.5); } ctx.stroke(); }
    }
    function renderPal() {
      const left = pal.map(() => 0); map.forEach((c, i) => { if (paint[i] !== c) left[c]++; });
      el.querySelector('[data-t="brush"]').classList.toggle('on', tool === 'brush'); el.querySelector('[data-t="bucket"]').classList.toggle('on', tool === 'bucket');
      [...palEl.children].forEach((b, k) => { b.classList.toggle('on', k === col); b.classList.toggle('done', !left[k]); b.querySelector('i').style.setProperty('--p', `${100 - Math.round(left[k] / map.filter(c => c === k).length * 100)}%`); });
    }
    function paintAt(i) {
      if (done || i < 0 || paint[i] === map[i]) return false;
      if (paint[i] === col) return false;
      // kyblík vybarví celou souvislou plochu stejného čísla (jen správnou barvou)
      if (tool === 'bucket' && col === map[i]) {
        const st = [i], seen = new Set([i]);
        while (st.length) { const j = st.pop(); paint[j] = col; const x = j % n; for (const k of [x > 0 ? j - 1 : -1, x < n - 1 ? j + 1 : -1, j - n, j + n]) if (k >= 0 && k < n * n && !seen.has(k) && map[k] === col && paint[k] !== col) { seen.add(k); st.push(k); } }
        api.sound('place'); return true;
      }
      paint[i] = col;
      if (col !== map[i]) api.mistake(); else api.sound('soft');
      return true;
    }
    // hotová barva: přejdi na další nedokončenou
    function advance() {
      const left = k => map.some((c, i) => c === k && paint[i] !== c);
      if (left(col)) return;
      for (let d = 1; d < pal.length; d++) { const k = (col + d) % pal.length; if (left(k)) { col = k; api.sound('star'); return; } }
    }
    function cellAt(e) { const r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left - ox) / scale), y = Math.floor((e.clientY - r.top - oy) / scale); return x >= 0 && y >= 0 && x < n && y < n ? y * n + x : -1; }
    // Ovládání: 1 prst/myš maluje (jen pokud je obraz dost velký), 2 prsty posun + zoom, kolečko zoom, pravé tlačítko posun.
    const pts = new Map(); let mode = null, last = null, pinch = null, changed = false;
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { mode = 'pinch'; const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: scale, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, ox, oy }; return; }
      if (e.button === 2 || e.button === 1 || scale < 9) { mode = 'pan'; last = { x: e.clientX, y: e.clientY, moved: 0 }; return; }
      mode = 'paint'; changed = paintAt(cellAt(e)) || changed; draw();
    });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === 'pinch' && pts.size >= 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = cv.getBoundingClientRect();
        const ns = Math.max(Math.min(vw, vh) / n, Math.min(60, pinch.s * d / pinch.d)), cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
        ox = cx - (pinch.cx - r.left - pinch.ox) * ns / pinch.s; oy = cy - (pinch.cy - r.top - pinch.oy) * ns / pinch.s; scale = ns; clampView(); draw();
      } else if (mode === 'pan' && last) { ox += e.clientX - last.x; oy += e.clientY - last.y; last.moved += Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y); last.x = e.clientX; last.y = e.clientY; clampView(); draw(); }
      else if (mode === 'paint') { changed = paintAt(cellAt(e)) || changed; draw(); }
    });
    const up = e => {
      pts.delete(e.pointerId);
      if (mode === 'pan' && last && last.moved < 6 && scale < 9) { // klepnutí při malém zvětšení: přibliž sem
        const r = cv.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top, ns = 22; ox = cx - (cx - ox) * ns / scale; oy = cy - (cy - oy) * ns / scale; scale = ns; clampView(); draw();
      }
      if (!pts.size) { mode = null; last = null; if (changed) { changed = false; advance(); renderPal(); draw(); api.changed(); check(); } }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top, ns = Math.max(Math.min(vw, vh) / n, Math.min(60, scale * (e.deltaY < 0 ? 1.18 : 1 / 1.18))); ox = cx - (cx - ox) * ns / scale; oy = cy - (cy - oy) * ns / scale; scale = ns; clampView(); draw(); }, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    palEl.addEventListener('click', e => { const b = e.target.closest('.om-sw'); if (!b) return; col = +b.dataset.c; api.sound('tap'); renderPal(); draw(); });
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t) return;
      if (t.dataset.t === 'fit') fitView();
      if (t.dataset.t === 'brush' || t.dataset.t === 'bucket') { tool = t.dataset.t; api.sound('tap'); renderPal(); api.changed(); }
      if (t.dataset.t === 'find') {
        let i = map.findIndex((c, k) => c === col && paint[k] !== c); if (i < 0) i = map.findIndex((c, k) => paint[k] !== c);
        if (i < 0) return; if (map[i] !== col) { col = map[i]; renderPal(); }
        const ns = Math.max(scale, 24), x = i % n, y = Math.floor(i / n); scale = ns; ox = vw / 2 - (x + 0.5) * ns; oy = vh / 2 - (y + 0.5) * ns; clampView(); draw(); api.sound('ui');
      }
    });
    function check() {
      if (!map.every((c, i) => paint[i] === c)) return;
      done = true; fitView();
      const t0 = performance.now(), sweep = now => { shine = Math.max(0, 1 - (now - t0) / 900); draw(); if (shine > 0) requestAnimationFrame(sweep); };
      requestAnimationFrame(sweep);
      const g = api.data.gallery = api.data.gallery || []; if (!g.some(x => x.seed === P.seed && x.n === n)) { g.push({ seed: P.seed, n, kind: P.kind, name: P.name, at: Date.now() }); if (g.length > 300) g.shift(); }
      const t = document.createElement('canvas'); t.width = t.height = n; const tc = t.getContext('2d'); map.forEach((c, i) => { tc.fillStyle = pal[c]; tc.fillRect(i % n, Math.floor(i / n), 1, 1); });
      setTimeout(() => api.solved({ title: P.name, html: `<img class="om-res" src="${t.toDataURL()}" alt=""><p class="k-muted">${L('Obraz visí ve tvé galerii', 'The picture now hangs in your gallery')}</p>` }), 700);
    }
    fitView(); renderPal(); addEventListener('resize', fitView);
    return {
      getState: () => (done ? null : { v: 2, paint, col, tool }),
      progress: () => paint.reduce((a, p, i) => a + (p === map[i] ? 1 : 0), 0) / (n * n),
      destroy() { removeEventListener('resize', fitView); },
      onKey(e) { if (e.key === 'b' || e.key === 'B') { tool = tool === 'bucket' ? 'brush' : 'bucket'; renderPal(); return; } const d = parseInt(e.key, 10); if (d >= 1 && d <= pal.length) { col = d - 1; renderPal(); draw(); } if (e.key === '0' && pal.length >= 10) { col = 9; renderPal(); draw(); } },
      _solve() { paint = map.slice(); renderPal(); draw(); check(); },
      _tap(i, c, t) { if (c != null) col = c; if (t) tool = t; if (paintAt(i)) { advance(); renderPal(); draw(); api.changed(); check(); } },
      _info: () => ({ col, tool, map: map.slice(), painted: paint.filter((p, i) => p === map[i]).length }),
    };
  }

  const gallery = { icon: 'brush', name: L('Galerie', 'Gallery'), badge: s => ((s.data && s.data.gallery) || []).length,
    render(el, save) {
      const g = (save.data.gallery || []).slice().reverse();
      el.innerHTML = `<h2>${L('Galerie', 'Gallery')}</h2><p class="k-muted">${L(`Vymalované obrazy: ${g.length}.`, `Pictures painted: ${g.length}.`)}</p><div class="om-gal">${g.map((x, k) => `<figure><canvas data-g="${k}" width="${x.n}" height="${x.n}"></canvas><figcaption>${Kit.esc(x.name)}</figcaption></figure>`).join('') || `<p class="k-muted">${L('Zatím prázdná.', 'Empty so far.')}</p>`}</div>`;
      el.querySelectorAll('canvas[data-g]').forEach(cv => { const x = g[+cv.dataset.g], img = image(x.seed, x.n, x.kind), c = cv.getContext('2d'); img.map.forEach((k, i) => { c.fillStyle = img.pal[k]; c.fillRect(i % x.n, Math.floor(i / x.n), 1, 1); }); });
    } };
  // obrázek na úvodní stránce: dnešní obraz napůl vybarvený, zbytek s čísly
  function art(el) {
    const n = 24, z = 20, img = image(Kit.hash('oart' + Kit.dayKey()), n), cv = document.createElement('canvas'); cv.width = cv.height = n * z;
    const c = cv.getContext('2d'), lum = col => { const m = /hsl\((\d+) (\d+)% (\d+)%\)/.exec(col); return m ? +m[3] : 50; };
    c.font = '600 10px "Space Grotesk", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    img.map.forEach((k, i) => {
      const x = i % n, y = Math.floor(i / n);
      if (x + y * 0.7 < n * 0.95) { c.fillStyle = img.pal[k]; c.fillRect(x * z, y * z, z, z); return; }
      const g = Math.round(247 - (100 - lum(img.pal[k])) * 0.16); c.fillStyle = `rgb(${g},${g - 2},${g + 5})`; c.fillRect(x * z, y * z, z, z);
      c.strokeStyle = 'rgba(40,30,80,.12)'; c.strokeRect(x * z + 0.5, y * z + 0.5, z - 1, z - 1);
      c.fillStyle = 'rgba(60,56,90,.7)'; c.fillText(String(k + 1), x * z + z / 2, y * z + z / 2 + 0.5);
    });
    cv.className = 'om-art'; el.innerHTML = ''; el.appendChild(cv);
  }
  return { DIFFS, generate, create, art, gallery, image, KINDS };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'omalovanky', title: 'OMALOVÁNKY', wording: 'play',
  tagline: Kit.L('Malování podle čísel pro chvíle klidu. Kytice, kočky, rybky, domky, balóny, plachetnice i planety, každý obraz nový a tvůj.', 'Colour by number for quiet moments. Bouquets, cats, fish, cottages, balloons, sailboats and planets, every picture new and yours.'),
  diffs: Omalovanky.DIFFS, generate: Omalovanky.generate, create: Omalovanky.create, art: Omalovanky.art, views: [Omalovanky.gallery],
  online: { kind: 'race' },
  dailyDiff: () => 'medium',
  rules: Kit.L(`<p>Každé políčko má číslo barvy. Vyber barvu dole a vybarvi všechna políčka s jejím číslem. Políčka vybrané barvy jsou zvýrazněná.</p>
    <ul><li>Maluj klepnutím nebo tahem. <b>Přibližuj</b> kolečkem myši nebo dvěma prsty, posouvej pravým tlačítkem nebo dvěma prsty.</li>
    <li>Když je obraz malý, klepnutí ho přiblíží na místo, kam jsi klepl(a).</li>
    <li><b>Kyblík</b> vybarví jedním klepnutím celou souvislou plochu s tím číslem (klávesa B přepíná štětec a kyblík).</li>
    <li>Když dobarvíš barvu, přepne se sama na další.</li>
    <li><b>Najít</b> ukáže nejbližší nevybarvené políčko vybrané barvy.</li>
    <li>Špatná barva se počítá jako chyba, jde ale přemalovat.</li>
    <li>Hotové obrazy najdeš v <b>Galerii</b>.</li></ul>`,
    `<p>Every cell has a colour number. Pick a colour below and paint every cell with its number. Cells of the selected colour are highlighted.</p>
    <ul><li>Paint by tapping or dragging. <b>Zoom</b> with the mouse wheel or two fingers, pan with the right button or two fingers.</li>
    <li>When the picture is small, a tap zooms in where you tapped.</li>
    <li>The <b>bucket</b> fills a whole connected area of that number in one tap (B switches brush and bucket).</li>
    <li>When a colour is finished, the next one is selected for you.</li>
    <li><b>Find</b> shows the next unpainted cell of the selected colour.</li>
    <li>A wrong colour counts as a mistake but can be painted over.</li>
    <li>Finished pictures hang in your <b>Gallery</b>.</li></ul>`),
  achievements: [
    { id: 'gal10', name: Kit.L('Malíř', 'Painter'), desc: Kit.L('10 obrazů v galerii', '10 pictures in the gallery'), prog: s => [((s.data && s.data.gallery) || []).length, 10] },
    { id: 'gal50', name: Kit.L('Výstava', 'Exhibition'), desc: Kit.L('50 obrazů v galerii', '50 pictures in the gallery'), prog: s => [((s.data && s.data.gallery) || []).length, 50] },
  ],
});
