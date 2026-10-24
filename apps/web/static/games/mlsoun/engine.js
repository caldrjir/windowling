'use strict';
// MLSOUN – bludiště a pohyb (sdílí je hra i testy v Node).
// Bludiště 19×21 dlaždic: chodby na lichých souřadnicích, levá polovina vzniká jako náhodný strom
// (DFS) a zrcadlí se doprava. Uprostřed je domeček přízraků obehnaný chodbou, slepé uličky se
// propojí (žádná nekončí), pár zdí navíc zmizí pro smyčky a řada 9 má tunel na obě strany.
// Dlaždice: 0 chodba, 1 zeď, 2 domeček, 3 dvířka domečku.
const MlsounEngine = (() => {
  const W = 19, H = 21, MID = 9;
  const HOUSE = { x0: 6, x1: 12, y0: 8, y1: 12 }; // obvodová zeď domečku
  const DOOR = { x: 9, y: 8 };
  const TUNNEL_Y = 9;
  const START = { x: 9, y: 15 };
  const GHOST_OUT = { x: 9, y: 7 }; // nad dvířky
  const GHOST_HOME = [{ x: 9, y: 7 }, { x: 9, y: 10 }, { x: 8, y: 10 }, { x: 10, y: 10 }];
  const POWER = [[1, 3], [17, 3], [1, 17], [17, 17]];
  const DIRS = { u: [0, -1], l: [-1, 0], d: [0, 1], r: [1, 0] };
  const ORDER = ['u', 'l', 'd', 'r']; // pořadí při shodě (jako v arkádě)
  const OPP = { u: 'd', d: 'u', l: 'r', r: 'l' };

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const inBlock = (x, y) => x >= HOUSE.x0 - 1 && x <= HOUSE.x1 + 1 && y >= HOUSE.y0 - 1 && y <= HOUSE.y1 + 1;

  function generate(seed, opts = {}) {
    const r = rng(seed);
    const g = [...Array(H)].map(() => new Array(W).fill(1));
    const set = (x, y, v) => { g[y][x] = v; g[y][W - 1 - x] = v; };
    // uzly levé poloviny (včetně prostředního sloupce); blok domečku je mimo strom
    const nodes = [];
    for (let y = 1; y < H; y += 2) for (let x = 1; x <= MID; x += 2) nodes.push([x, y]);
    const key = (x, y) => y * W + x;
    const seen = new Set();
    const start = nodes[Math.floor(r() * nodes.length)];
    const stack = [start]; seen.add(key(...start)); set(...start, 0);
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const next = ORDER.map(d => DIRS[d]).map(([dx, dy]) => [x + dx * 2, y + dy * 2, x + dx, y + dy])
        .filter(([nx, ny]) => nx >= 1 && nx <= MID && ny >= 1 && ny < H - 1 && !seen.has(key(nx, ny)));
      if (!next.length) { stack.pop(); continue; }
      const [nx, ny, wx, wy] = next[Math.floor(r() * next.length)];
      seen.add(key(nx, ny)); set(wx, wy, 0); set(nx, ny, 0); stack.push([nx, ny]);
    }
    // chodba kolem domečku a domeček sám
    for (let y = HOUSE.y0 - 1; y <= HOUSE.y1 + 1; y++) for (let x = HOUSE.x0 - 1; x <= HOUSE.x1 + 1; x++) {
      const ring = x === HOUSE.x0 - 1 || x === HOUSE.x1 + 1 || y === HOUSE.y0 - 1 || y === HOUSE.y1 + 1;
      const wall = x === HOUSE.x0 || x === HOUSE.x1 || y === HOUSE.y0 || y === HOUSE.y1;
      g[y][x] = ring ? 0 : wall ? 1 : 2;
    }
    g[DOOR.y][DOOR.x] = 3;
    // slepé uličky propojit (zrcadlově), pak pár smyček navíc
    const open = (x, y) => x >= 0 && x < W && y >= 0 && y < H && g[y][x] === 0;
    const exits = (x, y) => ORDER.filter(d => { const [dx, dy] = DIRS[d]; return open(x + dx, y + dy); }).length;
    // zeď mezi dvěma uzly, kterou jde otevřít (ne okraj, ne blok domečku)
    const walls = (x, y) => ORDER.map(d => DIRS[d]).map(([dx, dy]) => [x + dx, y + dy, x + dx * 2, y + dy * 2])
      .filter(([wx, wy, nx, ny]) => nx >= 1 && nx < W - 1 && ny >= 1 && ny < H - 1 && g[wy][wx] === 1 && g[ny][nx] === 0 && !inBlock(wx, wy));
    for (const [x, y] of nodes) {
      if (inBlock(x, y) || g[y][x] !== 0 || exits(x, y) > 1) continue;
      const opts2 = walls(x, y);
      if (!opts2.length) continue;
      // přednost má propojení se sousední slepou uličkou
      const best = opts2.filter(([, , nx, ny]) => exits(nx, ny) <= 1);
      const pick = (best.length ? best : opts2)[Math.floor(r() * (best.length ? best : opts2).length)];
      set(pick[0], pick[1], 0);
    }
    const loops = opts.loops ?? 0.1;
    for (const [x, y] of nodes) {
      if (inBlock(x, y)) continue;
      for (const [wx, wy] of walls(x, y)) if (r() < loops) set(wx, wy, 0);
    }
    // tunel
    g[TUNNEL_Y][0] = 0; g[TUNNEL_Y][W - 1] = 0; g[TUNNEL_Y][1] = 0; g[TUNNEL_Y][W - 2] = 0;
    // tečky: všude v chodbách kromě tunelu, startu a chodby nad dvířky
    const dots = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 0) dots[y * W + x] = 1;
    for (const x of [0, 1, W - 2, W - 1]) dots[TUNNEL_Y * W + x] = 0;
    dots[START.y * W + START.x] = 0; dots[GHOST_OUT.y * W + GHOST_OUT.x] = 0;
    for (const [x, y] of POWER) if (dots[y * W + x]) dots[y * W + x] = 2;
    return { W, H, g, dots };
  }

  const wrapX = x => ((x % W) + W) % W;
  const passable = (m, x, y) => y >= 0 && y < H && m.g[y][wrapX(x)] === 0;
  const canGo = (m, x, y, d) => passable(m, x + DIRS[d][0], y + DIRS[d][1]);

  // Posun o `dist` dlaždic; na středu dlaždice se volá `turn(e)` (vrátí směr nebo null).
  function advance(m, e, dist, turn) {
    let d = dist, guard = 0;
    while (d > 1e-9 && guard++ < 50) {
      const cx = Math.round(e.x), cy = Math.round(e.y);
      const centered = Math.abs(e.x - cx) + Math.abs(e.y - cy) < 1e-6;
      if (centered) {
        e.x = cx; e.y = cy;
        const nd = turn(e);
        if (!nd || !canGo(m, wrapX(cx), cy, nd)) { e.moving = false; if (nd) e.dir = nd; return; }
        e.dir = nd;
      }
      e.moving = true;
      const [dx, dy] = DIRS[e.dir];
      const p = dx ? e.x : e.y, s = dx || dy;
      const target = centered ? p + s : s > 0 ? Math.floor(p + 1e-9) + 1 : Math.ceil(p - 1e-9) - 1;
      const step = Math.min(d, Math.abs(target - p));
      e.x += dx * step; e.y += dy * step; d -= step;
      if (e.x <= -0.5) e.x += W; else if (e.x > W - 0.5) e.x -= W;
    }
  }

  // Volba směru přízraku: ne zpět, nejblíž k cíli (nebo náhodně, když je vyděšený).
  function ghostDir(m, e, target, rand) {
    const x = wrapX(Math.round(e.x)), y = Math.round(e.y);
    let opts = ORDER.filter(d => d !== OPP[e.dir] && canGo(m, x, y, d));
    if (!opts.length) opts = ORDER.filter(d => canGo(m, x, y, d));
    if (!opts.length) return null;
    if (rand) return opts[Math.floor(rand() * opts.length)];
    let best = opts[0], bd = Infinity;
    for (const d of opts) { const nx = x + DIRS[d][0], ny = y + DIRS[d][1], dd = (nx - target.x) ** 2 + (ny - target.y) ** 2; if (dd < bd) { bd = dd; best = d; } }
    return best;
  }

  // Dosažitelné chodby z bodu (BFS, s tunelem)
  function reachable(m, sx, sy) {
    const seen = new Uint8Array(W * H), q = [[sx, sy]]; seen[sy * W + sx] = 1;
    for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; for (const d of ORDER) { const nx = wrapX(x + DIRS[d][0]), ny = y + DIRS[d][1]; if (passable(m, nx, ny) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; q.push([nx, ny]); } } }
    return seen;
  }

  return { W, H, MID, HOUSE, DOOR, TUNNEL_Y, START, GHOST_OUT, GHOST_HOME, POWER, DIRS, ORDER, OPP, rng, generate, advance, ghostDir, canGo, passable, reachable, wrapX };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MlsounEngine;
