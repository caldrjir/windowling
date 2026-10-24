'use strict';
// RYBKY – pravidla a řešitel (sdílí je hra i generátor úrovní v Node).
// Úroveň: řádky znaků. '#' skála, '.' voda, '1' malá rybka (2×1), '2' velká rybka (3×2),
// 'a'–'n' lehké předměty, 'A'–'N' ocelové (těžké). Otvor v okrajové skále je východ.
// Pravidla:
//  - rybky plavou do čtyř směrů a gravitace na ně nepůsobí; mimo plán mohou jen otvorem
//  - rybka tlačí předměty (i několik naráz, i nahoru); malá nepohne ocelí, předměty neprojdou skálou ani rybkou
//  - předměty bez podpory padají; když padající předmět dopadne na rybku, rybka zahyne
//  - ocel položená na malé rybce ji zabije (velká unese cokoli)
//  - vyhráno, když obě rybky uplavou ven
const RybkyEngine = (() => {
  const DIRS = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] };

  function parse(rows) {
    const H = rows.length, W = rows[0].length, wall = new Uint8Array(W * H);
    const objs = new Map(), fishCells = [[], []];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = rows[y][x], i = y * W + x;
      if (ch === '#') wall[i] = 1;
      else if (ch === '1' || ch === '2') fishCells[+ch - 1].push([x, y]);
      else if (/[a-zA-Z]/.test(ch)) { if (!objs.has(ch)) objs.set(ch, []); objs.get(ch).push([x, y]); }
    }
    const shape = cells => { const x0 = Math.min(...cells.map(c => c[0])), y0 = Math.min(...cells.map(c => c[1])); return { x: x0, y: y0, cells: cells.map(([x, y]) => [x - x0, y - y0]) }; };
    const objects = [...objs.entries()].sort().map(([ch, cells]) => ({ ch, heavy: ch === ch.toUpperCase(), ...shape(cells) }));
    const fish = fishCells.map((cells, k) => ({ k, ...shape(cells) }));
    const L = { W, H, wall, objects: objects.map(o => ({ ch: o.ch, heavy: o.heavy, cells: o.cells })), fish: fish.map(f => ({ cells: f.cells })) };
    // stav: [fx0, fy0, fx1, fy1, ox0, oy0, ...]; rybka venku má x = -99
    const st = []; fish.forEach(f => st.push(f.x, f.y)); objects.forEach(o => st.push(o.x, o.y));
    L.start = st;
    return L;
  }
  const OUT = -99;
  const isOut = (s, f) => s[f * 2] === OUT;

  // obsazenost: 0 voda, 1 skála, 2+k rybka k, 10+j předmět j; mimo plán: -1
  function occupancy(L, s) {
    const { W, H } = L, occ = new Int16Array(W * H);
    for (let i = 0; i < W * H; i++) occ[i] = L.wall[i];
    L.fish.forEach((f, k) => { if (isOut(s, k)) return; for (const [cx, cy] of f.cells) { const x = s[k * 2] + cx, y = s[k * 2 + 1] + cy; if (x >= 0 && y >= 0 && x < W && y < H) occ[y * W + x] = 2 + k; } });
    L.objects.forEach((o, j) => { const ox = s[4 + j * 2], oy = s[5 + j * 2]; for (const [cx, cy] of o.cells) occ[(oy + cy) * W + ox + cx] = 10 + j; });
    return occ;
  }
  const inside = (L, x, y) => x >= 0 && y >= 0 && x < L.W && y < L.H;

  // tah rybky f směrem d: { s, pushed, dead } nebo null (nejde)
  function move(L, s, f, d) {
    if (isOut(s, f)) return null;
    const [dx, dy] = DIRS[d], occ = occupancy(L, s), fish = L.fish[f], fx = s[f * 2], fy = s[f * 2 + 1];
    const pushed = new Set(), queue = [];
    for (const [cx, cy] of fish.cells) queue.push([fx + cx + dx, fy + cy + dy, true]);
    while (queue.length) {
      const [x, y, byFish] = queue.pop();
      if (!inside(L, x, y)) { if (byFish) continue; return null; } // předmět ven nesmí, rybka otvorem ano
      const v = occ[y * L.W + x];
      if (v === 0 || v === 2 + f) continue;
      if (v === 1 || (v >= 2 && v < 10)) return null; // skála nebo druhá rybka
      const j = v - 10;
      if (pushed.has(j)) continue;
      if (L.objects[j].heavy && f === 0) return null; // malá nepohne ocelí
      pushed.add(j);
      const ox = s[4 + j * 2], oy = s[5 + j * 2];
      for (const [cx, cy] of L.objects[j].cells) queue.push([ox + cx + dx, oy + cy + dy, false]);
    }
    const n = s.slice();
    // plave-li rybka dolů, předměty na jejích zádech jedou s ní (nepadají na ni)
    if (d === 'd') {
      const top = new Set(fish.cells.map(([cx, cy]) => (fy + cy - 1) * L.W + fx + cx));
      L.objects.forEach((o, j) => {
        if (pushed.has(j)) return;
        const ox = s[4 + j * 2], oy = s[5 + j * 2];
        if (!o.cells.some(([cx, cy]) => top.has((oy + cy) * L.W + ox + cx))) return;
        const free = o.cells.every(([cx, cy]) => { const x = ox + cx, y = oy + cy + 1, v = occ[y * L.W + x]; return v === 0 || v === 2 + f || v === 10 + j; });
        if (free) pushed.add(j);
      });
    }
    n[f * 2] += dx; n[f * 2 + 1] += dy;
    for (const j of pushed) { n[4 + j * 2] += dx; n[5 + j * 2] += dy; }
    // rybka celá mimo plán uplavala
    if (fish.cells.every(([cx, cy]) => !inside(L, n[f * 2] + cx, n[f * 2 + 1] + cy))) { n[f * 2] = OUT; n[f * 2 + 1] = OUT; }
    const dead = settle(L, n);
    return { s: n, pushed: pushed.size, dead };
  }

  // gravitace; vrací index zahynulé rybky nebo -1
  function settle(L, s) {
    const fell = new Set();
    for (let guard = 0; guard < 200; guard++) {
      const occ = occupancy(L, s), sup = new Uint8Array(L.objects.length);
      let changed = true;
      // podepřené předměty: leží na skále, rybce, dně nebo jiném podepřeném předmětu
      while (changed) {
        changed = false;
        L.objects.forEach((o, j) => {
          if (sup[j]) return;
          const ox = s[4 + j * 2], oy = s[5 + j * 2];
          for (const [cx, cy] of o.cells) {
            const x = ox + cx, y = oy + cy + 1;
            if (y >= L.H) { sup[j] = 1; break; }
            const v = occ[y * L.W + x];
            if (v === 1 || (v >= 2 && v < 10) || (v >= 10 && v !== 10 + j && sup[v - 10])) { sup[j] = 1; break; }
          }
          if (sup[j]) changed = true;
        });
      }
      let any = false;
      L.objects.forEach((o, j) => { if (!sup[j]) { s[5 + j * 2]++; fell.add(j); any = true; } });
      if (!any) break;
    }
    const occ = occupancy(L, s);
    for (let j = 0; j < L.objects.length; j++) {
      const o = L.objects[j], ox = s[4 + j * 2], oy = s[5 + j * 2];
      for (const [cx, cy] of o.cells) {
        const y = oy + cy + 1; if (y >= L.H) continue;
        const v = occ[y * L.W + ox + cx];
        if (v >= 2 && v < 10) {
          const k = v - 2;
          if (fell.has(j)) return k; // dopad na rybku
          if (o.heavy && k === 0) return 0; // ocel na malé rybce
        }
      }
    }
    return -1;
  }
  const won = s => s[0] === OUT && s[2] === OUT;

  // BFS přes stavy; tahy jako "1r", "2u"…; vrací nejkratší řešení nebo null
  function solve(L, s0, cap = 200000) {
    const key = s => s.join(',');
    const seen = new Map([[key(s0), null]]), q = [s0];
    for (let h = 0; h < q.length; h++) {
      const s = q[h];
      for (let f = 0; f < 2; f++) for (const d of 'rldu') {
        const r = move(L, s, f, d);
        if (!r || r.dead >= 0) continue;
        const k = key(r.s);
        if (seen.has(k)) continue;
        seen.set(k, [key(s), `${f + 1}${d}`]);
        if (won(r.s)) { const path = []; for (let c = k; seen.get(c); c = seen.get(c)[0]) path.unshift(seen.get(c)[1]); return { path, states: seen.size }; }
        if (seen.size > cap) return null;
        q.push(r.s);
      }
    }
    return null;
  }
  return { parse, move, settle, won, solve, occupancy, OUT, DIRS };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = RybkyEngine;
