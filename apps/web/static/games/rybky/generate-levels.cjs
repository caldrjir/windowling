'use strict';
// RYBKY – generátor jeskyní (Node, mimo prohlížeč). Vytvoří levels.js:
//   node generate-levels.cjs <počet na proces> <proces> ...   (např. 4 procesy po 100, pak --build)
//   node generate-levels.cjs --build pool0.json pool1.json …
// Každá jeskyně je ověřená řešitelem z engine.js; drží se jen ty, kde předměty opravdu
// překážejí (řešení je delší než v prázdné jeskyni a potřebuje posuny). Obtížnost
// d = navíc tahů + 2 × posuny + délka / 4; levels.js je seřazený od nejlehčí.
const fs = require('fs'), vm = require('vm');
const path = require('path');
const c = {}; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8') + ';this.E = RybkyEngine;', c); const E = c.E;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const SHAPES = [[[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]]];
function makeLevel(r, W, H, nObj, heavyP) {
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  // cave: random walk with 3x2 brush
  let x = 1 + Math.floor(r() * (W - 4)), y = 1 + Math.floor(r() * (H - 3)), carved = 0, target = Math.floor((W - 2) * (H - 2) * (0.55 + r() * 0.2));
  for (let guard = 0; guard < 2000 && carved < target; guard++) {
    for (let yy = y; yy < y + 2; yy++) for (let xx = x; xx < x + 3; xx++) if (xx > 0 && yy > 0 && xx < W - 1 && yy < H - 1 && g[yy][xx] === '#') { g[yy][xx] = '.'; carved++; }
    const d = Math.floor(r() * 4); x = Math.max(1, Math.min(W - 4, x + [1, -1, 0, 0][d])); y = Math.max(1, Math.min(H - 3, y + [0, 0, 1, -1][d]));
  }
  // exit: right or top border, opening of 2 (or 3 wide on top)
  const side = r() < 0.6 ? 'right' : 'top';
  if (side === 'right') {
    const ys = []; for (let yy = 1; yy < H - 2; yy++) if (g[yy][W - 2] === '.' && g[yy + 1][W - 2] === '.') ys.push(yy);
    if (!ys.length) return null; const ey = ys[Math.floor(r() * ys.length)]; g[ey][W - 1] = '.'; g[ey + 1][W - 1] = '.';
  } else {
    const xs = []; for (let xx = 1; xx < W - 3; xx++) if (g[1][xx] === '.' && g[1][xx + 1] === '.' && g[1][xx + 2] === '.') xs.push(xx);
    if (!xs.length) return null; const ex = xs[Math.floor(r() * xs.length)]; for (let k = 0; k < 3; k++) g[0][ex + k] = '.';
  }
  const fits = (cells, x0, y0) => cells.every(([cx, cy]) => g[y0 + cy] && g[y0 + cy][x0 + cx] === '.' && x0 + cx > 0 && x0 + cx < W - 1 && y0 + cy > 0 && y0 + cy < H - 1);
  const put = (cells, ch) => { for (let t = 0; t < 200; t++) { const x0 = 1 + Math.floor(r() * (W - 2)), y0 = 1 + Math.floor(r() * (H - 2)); if (fits(cells, x0, y0)) { cells.forEach(([cx, cy]) => { g[y0 + cy][x0 + cx] = ch; }); return true; } } return false; };
  if (!put([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], '2')) return null;
  if (!put([[0, 0], [1, 0]], '1')) return null;
  for (let k = 0; k < nObj; k++) { const sh = SHAPES[Math.floor(r() * SHAPES.length)], heavy = r() < heavyP; put(sh, String.fromCharCode((heavy ? 65 : 97) + k)); }
  return g.map(row => row.join(''));
}
function settleRows(rows) { const L = E.parse(rows), s = L.start.slice(); const dead = E.settle(L, s); return dead >= 0 ? null : { L, s }; }
function render(L, s) { const out = []; const occ = E.occupancy(L, s); for (let y = 0; y < L.H; y++) { let row = ''; for (let x = 0; x < L.W; x++) { const v = occ[y * L.W + x]; row += v === 1 ? '#' : v === 0 ? '.' : v < 10 ? String(v - 1) : L.objects[v - 10].ch; } out.push(row); } return out; }

function pool(count, worker) {
const r = rng(0xf15f + worker * 7919);
const out = []; let tries = 0;
while (out.length < count && tries < 200000) {
  tries++;
  const big = r() < 0.45, W = big ? 14 : 12, H = big ? 10 : 9;
  const rows = makeLevel(r, W, H, 3 + Math.floor(r() * (big ? 6 : 4)), 0.25 + r() * 0.2); if (!rows) continue;
  const st = settleRows(rows); if (!st) continue;
  const res = E.solve(st.L, st.s, 120000); if (!res) continue;
  const bare = render(st.L, st.s).map(row => row.replace(/[a-zA-Z]/g, '.'));
  const bl = E.parse(bare), bres = E.solve(bl, bl.start, 120000); if (!bres) continue;
  let pushes = 0; { let s = st.s; for (const m of res.path) { const rr = E.move(st.L, s, +m[0] - 1, m[1]); if (rr.pushed) pushes++; s = rr.s; } }
  const extra = res.path.length - bres.path.length;
  if (extra < 4 || pushes < 2) continue;
  out.push({ r: render(st.L, st.s), s: res.path.join(''), d: extra + 2 * pushes + Math.round(res.path.length / 4), n: res.path.length });
  process.stderr.write(`w${worker} ${out.length}/${count} (tries ${tries})\n`);
}
return out;
}

function build(files) {
let all = []; for (const f of files) all = all.concat(JSON.parse(fs.readFileSync(f, 'utf8')));
const seen = new Set(); all = all.filter(l => { const k = l.r.join('/'); if (seen.has(k)) return false; seen.add(k); return true; });
let bad = 0;
for (const l of all) {
  const L = E.parse(l.r); let s = L.start.slice(); if (E.settle(L, s) >= 0) { bad++; continue; }
  for (const m of l.s.match(/../g)) { const r = E.move(L, s, +m[0] - 1, m[1]); if (!r || r.dead >= 0) { bad++; s = null; break; } s = r.s; }
  if (s && !E.won(s)) bad++;
}
all.sort((a, b) => a.d - b.d || a.n - b.n);
const ds = all.map(l => l.d);
console.log('levels', all.length, 'invalid', bad, 'd range', ds[0], ds[Math.floor(ds.length / 4)], ds[Math.floor(ds.length / 2)], ds[Math.floor(ds.length * 3 / 4)], ds[ds.length - 1], 'moves', Math.min(...all.map(l => l.n)), '-', Math.max(...all.map(l => l.n)));
const body = all.map(l => `  { r: ${JSON.stringify(l.r)}, s: '${l.s}', n: ${l.n} },`).join('\n');
fs.writeFileSync(path.join(__dirname, 'levels.js'), `'use strict';\n// RYBKY – jeskyně vygenerované předem a ověřené řešitelem (engine.js), seřazené od nejlehčí.\n// r: řádky plánu, s: nejkratší řešení (dvojice "rybka směr"), n: počet tahů řešení.\nconst RYBKY_LEVELS = [\n${body}\n];\n`);
console.log('bytes', fs.statSync(path.join(__dirname, 'levels.js')).size);
}

const args = process.argv.slice(2);
if (args[0] === '--build') build(args.slice(1));
else process.stdout.write(JSON.stringify(pool(+args[0] || 100, +args[1] || 0)));
