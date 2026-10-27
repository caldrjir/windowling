'use strict';
// ── DÁMA · pravidla a počítačový soupeř (sdílí je hra i testy v Node) ───────
// Česká dáma: deska 8×8, hraje se na tmavých polích, každý má 12 kamenů ve třech řadách.
// Kámen táhne i skáče jen šikmo dopředu, dáma (po dojetí na poslední řadu) létá po úhlopříčce
// o libovolný počet polí a skáče i na dálku. Skákání je povinné a pokračuje, dokud to jde;
// může-li skákat dáma, musí skákat ona. Přeskočené kameny se berou až po dokončení tahu.
// Kdo nemůže táhnout (nemá kameny nebo je zablokovaný), prohrál. Remíza: 30 tahů jen dámami
// bez braní, nebo trojí opakování pozice.
// Pole 0–63 (řádek * 8 + sloupec), bílý (1) dole táhne nahoru, černý (-1) nahoře. Kámen ±1, dáma ±2.
const DamaCore = (() => {
  const DIAG = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const inB = (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8;
  function start() {
    const b = new Int8Array(64);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 1) { if (y < 3) b[y * 8 + x] = -1; if (y > 4) b[y * 8 + x] = 1; }
    return { b, turn: 1, quiet: 0, hist: [] };
  }
  const own = (v, p) => v * p > 0;
  // skoky jedné figury (DFS, braní až na konci tahu)
  function jumps(b, from, p) {
    const v = b[from], king = Math.abs(v) === 2, out = [];
    const dfs = (at, path, caps, acc) => {
      const x = at % 8, y = at >> 3;
      let more = false;
      for (const [dx, dy] of DIAG) {
        if (!king && dy !== -p) continue; // kámen skáče jen dopředu
        let k = 1, cx = x + dx, cy = y + dy;
        if (king) while (inB(cx, cy) && (b[cy * 8 + cx] === 0 || cy * 8 + cx === from)) { cx += dx; cy += dy; k++; }
        if (!inB(cx, cy)) continue;
        const ci = cy * 8 + cx;
        if (!(b[ci] * p < 0) || caps.includes(ci)) continue;
        // dopadová pole za přeskočeným kamenem; dáma musí dopadnout tam, odkud může skákat dál
        let lx = cx + dx, ly = cy + dy;
        const lands = [];
        while (inB(lx, ly) && (b[ly * 8 + lx] === 0 || ly * 8 + lx === from)) {
          const li = ly * 8 + lx, sub = [];
          const promoted = !king && (ly === (p > 0 ? 0 : 7));
          if (promoted) sub.push({ path: [...path, li], caps: [...caps, ci] });
          else dfs(li, [...path, li], [...caps, ci], sub);
          lands.push(sub);
          if (!king) break;
          lx += dx; ly += dy;
        }
        if (lands.length) more = true;
        const deep = lands.filter(l => l.some(m => m.caps.length > caps.length + 1));
        for (const l of deep.length ? deep : lands) for (const m of l) acc.push(m);
        void k;
      }
      if (!more && caps.length) acc.push({ path, caps });
    };
    dfs(from, [from], [], out);
    return out;
  }
  function moves(s) {
    const { b, turn: p } = s;
    let caps = [], kingCaps = [];
    for (let i = 0; i < 64; i++) if (own(b[i], p)) {
      const j = jumps(b, i, p);
      if (j.length) { caps = caps.concat(j); if (Math.abs(b[i]) === 2) kingCaps = kingCaps.concat(j); }
    }
    if (kingCaps.length) return kingCaps;
    if (caps.length) return caps;
    const out = [];
    for (let i = 0; i < 64; i++) if (own(b[i], p)) {
      const x = i % 8, y = i >> 3, king = Math.abs(b[i]) === 2;
      for (const [dx, dy] of DIAG) {
        if (!king && dy !== -p) continue;
        let cx = x + dx, cy = y + dy;
        while (inB(cx, cy) && b[cy * 8 + cx] === 0) { out.push({ path: [i, cy * 8 + cx], caps: [] }); if (!king) break; cx += dx; cy += dy; }
      }
    }
    return out;
  }
  function apply(s, m) {
    const b = s.b, from = m.path[0], to = m.path[m.path.length - 1], v = b[from];
    const key = Array.from(b).join('') + s.turn;
    b[from] = 0;
    for (const c of m.caps) b[c] = 0;
    const y = to >> 3;
    b[to] = Math.abs(v) === 1 && y === (v > 0 ? 0 : 7) ? v * 2 : v;
    s.quiet = m.caps.length || Math.abs(v) === 1 ? 0 : s.quiet + 1;
    s.hist.push(key);
    s.turn = -s.turn;
    return s;
  }
  const clone = s => ({ b: Int8Array.from(s.b), turn: s.turn, quiet: s.quiet, hist: s.hist.slice() });
  // výsledek: 1 / -1 vítěz, 0 remíza, null hraje se dál
  function result(s) {
    if (!moves(s).length) return -s.turn;
    if (s.quiet >= 60) return 0;
    const key = Array.from(s.b).join('') + s.turn;
    if (s.hist.filter(k => k === key).length >= 2) return 0;
    return null;
  }
  const encode = m => m.path.join('-');
  function decode(s, str) {
    const path = str.split('-').map(Number);
    return moves(s).find(m => m.path.length === path.length && m.path.every((v, i) => v === path[i])) || null;
  }

  // ── Počítačový soupeř: alfa-beta s pokračováním braní ──
  const PST = new Int8Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) PST[y * 8 + x] = (x > 1 && x < 6 ? 3 : 0) + (y > 1 && y < 6 ? 2 : 0);
  function evaluate(b, p) {
    let v = 0;
    for (let i = 0; i < 64; i++) {
      const c = b[i]; if (!c) continue;
      const y = i >> 3, sgn = c > 0 ? 1 : -1;
      if (Math.abs(c) === 1) v += sgn * (100 + (c > 0 ? 7 - y : y) * 4 + PST[i] + ((c > 0 ? y === 7 : y === 0) ? 6 : 0));
      else v += sgn * (310 + PST[i]);
    }
    return v * p;
  }
  function search(s, depth, alpha, beta, stats) {
    const ms = moves(s);
    if (!ms.length) return -100000 + (20 - depth);
    if (depth <= 0 && !ms[0].caps.length) return evaluate(s.b, s.turn);
    if (++stats.n > stats.max) return evaluate(s.b, s.turn);
    ms.sort((a, c) => c.caps.length - a.caps.length);
    let best = -Infinity;
    for (const m of ms) {
      const t = clone(s); apply(t, m);
      const v = -search(t, depth - 1, -beta, -alpha, stats);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
  // level 1: hloubka 1 a občas náhoda, 2: hloubka 3, 3: hloubka 5, 4: hloubka 7
  function ai(s, level, r) {
    const ms = moves(s);
    if (ms.length === 1) return ms[0];
    if (level === 1 && r() < 0.35) return ms[Math.floor(r() * ms.length)];
    const depth = [0, 1, 3, 5, 7][level] || 3, stats = { n: 0, max: [0, 2e3, 2e4, 1e5, 1.6e5][level] || 2e4 };
    let best = ms[0], bv = -Infinity;
    for (const m of ms) {
      const t = clone(s); apply(t, m);
      const v = -search(t, depth - 1, -Infinity, -bv, stats) + r() * (level === 1 ? 30 : 4);
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  }
  return { start, moves, apply, clone, result, encode, decode, ai, evaluate };
})();
if (typeof module !== 'undefined') module.exports = DamaCore;
