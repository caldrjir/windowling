'use strict';
// HAD – mapy s překážkami (sdílí je hra i testy v Node).
// Deska 20×20 s okrajovou zdí. Překážky jsou krátké zdi (2–5 polí) rozmístěné středově souměrně
// ze semínka. Každá přidaná zeď musí nechat volná pole propojená a žádné pole se nesmí stát
// slepou kapsou (aspoň dva volní sousedé), takže se had nikdy nezasekne jen kvůli mapě.
// Start hada (řada 10 vlevo) a jeho okolí zůstává volné.
const HadEngine = (() => {
  const W = 20, H = 20;
  const START = { x: 5, y: 10, len: 4, dir: 'r' };
  const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  const OPP = { u: 'd', d: 'u', l: 'r', r: 'l' };

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // pole, kde překážka být nesmí: start hada a prostor před ním
  const reserved = (x, y) => (y === START.y && x >= 1 && x <= 15) || (y >= START.y - 1 && y <= START.y + 1 && x >= 1 && x <= 8);

  function check(walls, wrap) {
    const free = i => !walls[i];
    const nb = (x, y) => {
      const out = [];
      for (const [dx, dy] of Object.values(DIRS)) {
        let nx = x + dx, ny = y + dy;
        if (wrap) { nx = (nx + W) % W; ny = (ny + H) % H; } else if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        out.push(ny * W + nx);
      }
      return out;
    };
    let first = -1, total = 0;
    for (let i = 0; i < W * H; i++) if (free(i)) { total++; if (first < 0) first = i; }
    const seen = new Uint8Array(W * H), q = [first]; seen[first] = 1;
    for (let k = 0; k < q.length; k++) {
      const i = q[k], x = i % W, y = (i - x) / W, n = nb(x, y).filter(free);
      if (n.length < 2) return false;
      for (const j of n) if (!seen[j]) { seen[j] = 1; q.push(j); }
    }
    return q.length === total;
  }

  // walls: 1 = zeď. `count` = počet párů překážek, `border` = okrajová zeď (jinak průchozí okraje).
  function generate(seed, count, border = true) {
    const r = rng(seed), walls = new Uint8Array(W * H);
    if (border) for (let i = 0; i < W; i++) { walls[i] = walls[(H - 1) * W + i] = 1; walls[i * W] = walls[i * W + W - 1] = 1; }
    let placed = 0;
    for (let attempt = 0; attempt < 600 && placed < count; attempt++) {
      const len = 2 + Math.floor(r() * 4), horiz = r() < 0.5;
      const x0 = 2 + Math.floor(r() * (W - 4 - (horiz ? len : 0))), y0 = 2 + Math.floor(r() * (H - 4 - (horiz ? 0 : len)));
      const cells = [];
      for (let k = 0; k < len; k++) { const x = horiz ? x0 + k : x0, y = horiz ? y0 : y0 + k; cells.push([x, y], [W - 1 - x, H - 1 - y]); }
      if (cells.some(([x, y]) => reserved(x, y) || walls[y * W + x])) continue;
      for (const [x, y] of cells) walls[y * W + x] = 1;
      if (check(walls, !border)) placed++;
      else for (const [x, y] of cells) walls[y * W + x] = 0;
    }
    return walls;
  }

  return { W, H, START, DIRS, OPP, rng, generate, check, reserved };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = HadEngine;
