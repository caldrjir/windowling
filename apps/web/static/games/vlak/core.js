'use strict';
// ── VLAK · generátor úrovní ─────────────────────────────────────────────────
// Úroveň: mřížka w×h se zdí po obvodu, start mašinky, předměty a brána. Řešitelnost se zaručí
// konstrukcí: nejdřív se vylosuje dlouhá trasa, která sama sebe nikde nekříží, předměty leží na
// ní a brána na jejím konci; zdi se stavějí jen mimo trasu. Kdo jede po trase, nikdy nenarazí
// (ani do vlastních vagonů, protože trasa žádné políčko nenavštíví dvakrát).
const VlCore = (() => {
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // vpravo, dolů, vlevo, nahoru
  const ITEMS = ['jablko', 'diamant', 'koruna', 'strom', 'dort', 'darek', 'hvezda', 'houba'];

  // o = { w, h, items, walls (podíl zdí mimo trasu), minLen }
  function generate(seed, o) {
    const r = rngOf(seed), { w, h } = o, inner = (w - 2) * (h - 2);
    const idx = (x, y) => y * w + x, inside = (x, y) => x > 0 && y > 0 && x < w - 1 && y < h - 1;
    let best = null;
    for (let attempt = 0; attempt < 80; attempt++) {
      const sx = 1 + Math.floor(r() * (w - 2)), sy = 1 + Math.floor(r() * (h - 2));
      const seen = new Uint8Array(w * h), path = [[sx, sy]];
      seen[idx(sx, sy)] = 1;
      let d = Math.floor(r() * 4), x = sx, y = sy;
      const straight = 0.45 + r() * 0.3;
      for (;;) {
        const opts = [];
        for (let k = 0; k < 4; k++) {
          const nx = x + DIRS[k][0], ny = y + DIRS[k][1];
          if (!inside(nx, ny) || seen[idx(nx, ny)]) continue;
          let exits = 0;
          for (const [ax, ay] of DIRS) if (inside(nx + ax, ny + ay) && !seen[idx(nx + ax, ny + ay)]) exits++;
          opts.push({ k, nx, ny, exits });
        }
        if (!opts.length) break;
        // rovně s danou pravděpodobností, jinak spíš do užších míst (trasa tak vyplní plochu)
        let pick = opts.find(q => q.k === d && r() < straight);
        if (!pick) { opts.sort((a, b) => a.exits - b.exits + (r() - 0.5) * 1.5); pick = opts[0]; }
        d = pick.k; x = pick.nx; y = pick.ny; seen[idx(x, y)] = 1; path.push([x, y]);
        if (path.length >= o.maxLen) break;
      }
      if (!best || path.length > best.length) best = path;
      if (best.length >= o.minLen) break;
    }
    const path = best, n = path.length;
    // předměty rozprostřené po trase (ne na prvních dvou políčkách a ne na bráně)
    const k = Math.max(1, Math.min(o.items, n - 4)), items = [];
    const kinds = [ITEMS[Math.floor(r() * ITEMS.length)]];
    if (o.items > 8) { let b; do b = ITEMS[Math.floor(r() * ITEMS.length)]; while (b === kinds[0]); kinds.push(b); }
    const used = new Set();
    for (let j = 0; j < k; j++) {
      let i = 2 + Math.floor(((n - 4) * (j + 0.2 + r() * 0.6)) / k);
      while (used.has(i)) i++;
      used.add(i);
      items.push({ x: path[i][0], y: path[i][1], kind: kinds[j % kinds.length] });
    }
    // zdi mimo trasu: shluky kolem náhodných jader
    const wall = new Uint8Array(w * h), onPath = new Uint8Array(w * h);
    for (const [px, py] of path) onPath[idx(px, py)] = 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!inside(x, y)) wall[idx(x, y)] = 1;
    const free = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (!onPath[idx(x, y)]) free.push([x, y]);
    for (const [fx, fy] of free) {
      let near = 0;
      for (const [ax, ay] of DIRS) if (wall[idx(fx + ax, fy + ay)]) near++;
      if (r() < o.walls + near * 0.08) wall[idx(fx, fy)] = 1;
    }
    const [gx, gy] = path[n - 1], [x0, y0] = path[0], [x1, y1] = path[1];
    const dir = DIRS.findIndex(([ax, ay]) => ax === x1 - x0 && ay === y1 - y0);
    return { w, h, wall: Array.from(wall), start: { x: x0, y: y0, dir }, gate: { x: gx, y: gy }, items, path, inner };
  }

  // pomocník pro testy: projede trasu a ověří, že nikde nenarazí a sebere vše
  function check(L) {
    const body = [[L.start.x, L.start.y]], items = new Map(L.items.map(it => [it.x + ',' + it.y, it]));
    for (let i = 1; i < L.path.length; i++) {
      const [x, y] = L.path[i];
      if (L.wall[y * L.w + x]) return 'wall';
      const gate = x === L.gate.x && y === L.gate.y;
      if (gate) return items.size ? 'gate-closed' : 'ok';
      const grow = items.delete(x + ',' + y);
      if (!grow) body.pop();
      if (body.some(([bx, by]) => bx === x && by === y)) return 'body';
      body.unshift([x, y]);
    }
    return 'no-gate';
  }

  return { generate, check, DIRS, ITEMS, rngOf };
})();
if (typeof module !== 'undefined') module.exports = VlCore;
