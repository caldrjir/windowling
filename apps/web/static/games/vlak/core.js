'use strict';
// ── VLAK · scény ────────────────────────────────────────────────────────────
// Prvních 50 scén Cesty je originálních (scenes.js, převod fromScene). Další scény generuje
// generate() ve stejném duchu jako původní Vlak (1993): obdélníková plocha 18×10 obehnaná cihlovou zdí, uvnitř
// souměrné cihlové útvary a předměty seskupené do obrazců (řady, úhlopříčky, sloupce, shluky),
// brána je zasazená do obvodové zdi. Řešitelnost se zaručí konstrukcí: od brány se pozpátku
// vylosuje trasa, která sama sebe nikde nekříží a projede skoro celou volnou plochu
// (Warnsdorffovo pravidlo), a předměty se kladou jen na ni. Kdo jede po trase, nikdy nenarazí.
const VlCore = (() => {
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // vpravo, dolů, vlevo, nahoru
  // předměty v pořadí originálu (index = sloupec ve spritech); druh předmětu je jeho index
  const ITEMS = ['krystal', 'koruna', 'strom', 'jablko', 'krava', 'tresne', 'rybnik', 'zirafa', 'zmrzlina', 'dort', 'pocitac', 'auto', 'balon', 'budik', 'slon', 'vino', 'penize', 'letadlo'];
  const W = 20, H = 12;

  // o = { items (kolik předmětů), walls (kolik útvarů na polovinu), cover (jak velkou část volné plochy trasa projede) }
  // vzácně se scéna nepovede: zkusí se další semínko (pořád deterministicky)
  function generate(seed, o) {
    for (let k = 0; ; k++) { const L = attempt((seed + k * 7919) >>> 0, o); if (L || k > 50) return L; }
  }
  function attempt(seed, o) {
    const r = rngOf(seed), w = W, h = H, idx = (x, y) => y * w + x, mir = x => w - 1 - x;
    const pick = a => a[Math.floor(r() * a.length)];
    let best = null;
    for (let tryN = 0; tryN < 40 && !best; tryN++) {
      // 1) zdi: obvod + souměrné útvary (kreslí se v levé půlce a zrcadlí)
      const wall = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!x || !y || x === w - 1 || y === h - 1) wall[idx(x, y)] = 1;
      const put = (x, y) => { if (x >= 1 && x <= w / 2 - 1 && y >= 1 && y <= h - 2) { wall[idx(x, y)] = 1; wall[idx(mir(x), y)] = 1; } };
      for (let k = 0; k < o.walls; k++) {
        const t = r(), x = 2 + Math.floor(r() * (w / 2 - 3)), y = 2 + Math.floor(r() * (h - 4));
        if (t < 0.3) { const n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) put(x + i, y); }        // vodorovná zídka
        else if (t < 0.55) { const n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) put(x, y + i); } // svislá
        else if (t < 0.75) { put(x, y); put(x + 1, y); put(x, y + 1); put(x + 1, y + 1); }                     // blok 2×2
        else if (t < 0.9) { put(x, y); put(x + 1, y); put(x, y + 1); put(x, y + 2); }                          // roh
        else { for (let i = 0; i < 3; i++) put(x + i, y + i); }                                                // schody
      }
      // volná plocha musí být souvislá a bez slepých políček obklopených třemi zdmi
      const free = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (!wall[idx(x, y)]) free.push(idx(x, y));
      const seen = new Uint8Array(w * h), q = [free[0]]; seen[free[0]] = 1;
      for (let i = 0; i < q.length; i++) for (const [dx, dy] of DIRS) { const n = q[i] + dx + dy * w; if (!wall[n] && !seen[n]) { seen[n] = 1; q.push(n); } }
      if (q.length !== free.length) continue;
      // 2) brána v obvodové zdi (souměrně: dole, nahoře, nebo uprostřed boku)
      const mx = w / 2 - (r() < 0.5 ? 1 : 0), my = Math.floor(h / 2) - (r() < 0.5 ? 1 : 0);
      const gates = [[mx, h - 1, 0, -1], [mx, 0, 0, 1], [0, my, 1, 0], [w - 1, my, -1, 0]].filter(([gx, gy, dx, dy]) => !wall[idx(gx + dx, gy + dy)]);
      if (!gates.length) continue;
      const [gx, gy, gdx, gdy] = pick(gates), ex = gx + gdx, ey = gy + gdy;
      // 3) trasa od brány pozpátku: Warnsdorff (nejdřív tam, odkud vede nejméně cest), nejlepší z pokusů
      let path = null;
      for (let a = 0; a < 60; a++) {
        const vis = new Uint8Array(w * h), p = [[ex, ey]]; vis[idx(ex, ey)] = 1;
        let x = ex, y = ey, d = -1;
        for (;;) {
          const opts = [];
          for (let k = 0; k < 4; k++) {
            const nx = x + DIRS[k][0], ny = y + DIRS[k][1];
            if (wall[idx(nx, ny)] || vis[idx(nx, ny)]) continue;
            let ex2 = 0;
            for (const [ax, ay] of DIRS) if (!wall[idx(nx + ax, ny + ay)] && !vis[idx(nx + ax, ny + ay)]) ex2++;
            opts.push({ k, nx, ny, sc: ex2 + (k === d ? -0.4 : 0) + r() * 0.8 });
          }
          if (!opts.length) break;
          opts.sort((u, v) => u.sc - v.sc);
          ({ k: d, nx: x, ny: y } = opts[0]); vis[idx(x, y)] = 1; p.push([x, y]);
        }
        if (!path || p.length > path.length) path = p;
        if (path.length >= free.length * o.cover) break;
      }
      if (path.length < free.length * Math.min(o.cover, 0.8)) continue;
      path.reverse(); path.push([gx, gy]);
      // 4) předměty v obrazcích (v levé půlce se zrcadlem); platí jen páry, které obě leží na trase
      const onPath = new Map(path.slice(0, -1).map(([x, y], i) => [idx(x, y), i]));
      const items = new Map();
      const shapes = [
        (x, y) => [0, 1, 2, 3, 4].map(i => [x + i, y]),
        (x, y) => [0, 1, 2, 3].map(i => [x + i, y + i]),
        (x, y) => [0, 1, 2, 3].map(i => [x + i, y - i]),
        (x, y) => [0, 1, 2].map(i => [x, y + i]),
        (x, y) => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]],
        (x, y) => [[x, y], [x + 2, y], [x + 1, y + 1], [x, y + 2], [x + 2, y + 2]],
      ];
      for (let guard = 0; guard < 400 && items.size < o.items; guard++) {
        const kind = Math.floor(r() * ITEMS.length), cells = pick(shapes)(1 + Math.floor(r() * (w / 2 - 1)), 1 + Math.floor(r() * (h - 2)));
        for (const [x, y] of cells) {
          if (items.size >= o.items) break;
          if (x < 1 || x > w / 2 - 1 || y < 1 || y > h - 2) continue;
          const a = idx(x, y), b = idx(mir(x), y);
          if (!onPath.has(a) || !onPath.has(b) || items.has(a) || onPath.get(a) === 0 || onPath.get(b) === 0) continue;
          items.set(a, kind); items.set(b, kind);
        }
      }
      if (items.size < Math.min(o.items, 6)) continue;
      const [x0, y0] = path[0], [x1, y1] = path[1];
      const dir = DIRS.findIndex(([ax, ay]) => ax === x1 - x0 && ay === y1 - y0);
      best = { w, h, wall: Array.from(wall), start: { x: x0, y: y0, dir }, gate: { x: gx, y: gy }, items: [...items].map(([i, kind]) => ({ x: i % w, y: Math.floor(i / w), kind })), path, inner: free.length };
    }
    return best;
  }

  // původní scéna (z scenes.js) ve stejném tvaru, jaký vrací generate()
  function fromScene(sc) {
    const w = W, h = H, wall = new Array(w * h).fill(0), items = [];
    let start = null, gate = null, inner = 0;
    sc.grid.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '#' || c === '@') wall[y * w + x] = 1; else inner++;
      if (c === '@') gate = { x, y };
      if (c >= 'a' && c <= 'r') items.push({ x, y, kind: c.charCodeAt(0) - 97 });
      const sd = '>v<^'.indexOf(c);
      if (sd >= 0) start = { x, y, dir: sd };
    }));
    const step = { R: 0, D: 1, L: 2, U: 3 }, path = [[start.x, start.y]];
    for (const ch of sc.sol) { const [px, py] = path[path.length - 1], [dx, dy] = DIRS[step[ch]]; path.push([px + dx, py + dy]); }
    return { w, h, wall, start, gate, items, path, inner, name: sc.name };
  }

  // pomocník pro testy: projede trasu a ověří, že nikde nenarazí a sebere vše
  function check(L) {
    const body = [[L.start.x, L.start.y]], items = new Map(L.items.map(it => [it.x + ',' + it.y, it]));
    for (let i = 1; i < L.path.length; i++) {
      const [x, y] = L.path[i];
      const gate = x === L.gate.x && y === L.gate.y;
      if (gate) return items.size ? 'gate-closed' : 'ok';
      if (L.wall[y * L.w + x]) return 'wall';
      const grow = items.delete(x + ',' + y);
      if (!grow) body.pop();
      if (body.some(([bx, by]) => bx === x && by === y)) return 'body';
      body.unshift([x, y]);
    }
    return 'no-gate';
  }

  return { generate, fromScene, check, DIRS, ITEMS, rngOf, W, H };
})();
if (typeof module !== 'undefined') module.exports = VlCore;
