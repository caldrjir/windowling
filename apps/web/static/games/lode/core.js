'use strict';
// ── LODĚ · flotila, střelba a počítačový admirál (sdílí je hra i testy v Node) ──
// Moře 10×10 (pole 0–99, řádek * 10 + sloupec). Flotila: 5, 4, 3, 3, 2; lodě se nesmí dotýkat
// ani rohem. Hráči se střídají po jedné ráně. Výsledek rány: voda, zásah, potopená loď.
// Online se rozmístění lodí nikam neposílá: tah nese výsledek soupeřovy poslední rány
// (spočítaný u sebe) a vlastní novou ránu, např. „h;s45“ (zásah, střílím na 45) nebo
// „k12.13.14;s7“ (potopena loď na polích 12–14, střílím na 7); „w12.22“ = potopena poslední loď.
const LodeCore = (() => {
  const N = 10, FLEET = [5, 4, 3, 3, 2];
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const cellsOf = sh => Array.from({ length: sh.len }, (_, k) => (sh.y + (sh.v ? k : 0)) * N + sh.x + (sh.v ? 0 : k));
  // dá se loď položit? (v moři, nedotýká se ostatních ani rohem)
  function fits(ships, sh, skip) {
    if (sh.x < 0 || sh.y < 0 || (sh.v ? sh.y + sh.len : sh.x + sh.len) > N || (sh.v ? sh.x : sh.y) >= N) return false;
    const mine = cellsOf(sh);
    for (let k = 0; k < ships.length; k++) {
      if (k === skip) continue;
      for (const c of cellsOf(ships[k])) for (const m of mine) if (Math.abs((c % N) - (m % N)) <= 1 && Math.abs(Math.floor(c / N) - Math.floor(m / N)) <= 1) return false;
    }
    return true;
  }
  function randomFleet(r) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const ships = [];
      let ok = true;
      for (const len of FLEET) {
        let placed = false;
        for (let t = 0; t < 300 && !placed; t++) {
          const v = r() < 0.5, sh = { len, v, x: Math.floor(r() * (v ? N : N - len + 1)), y: Math.floor(r() * (v ? N - len + 1 : N)) };
          if (fits(ships, sh, -1)) { ships.push(sh); placed = true; }
        }
        if (!placed) { ok = false; break; }
      }
      if (ok) return ships;
    }
    return null;
  }
  // rána na vlastní flotilu: { res: 'm' | 'h' | 'k' | 'w', cells? (potopená loď) }
  function receive(ships, hits, cell) {
    hits.add(cell);
    const sh = ships.find(s => cellsOf(s).includes(cell));
    if (!sh) return { res: 'm' };
    const cs = cellsOf(sh);
    if (!cs.every(c => hits.has(c))) return { res: 'h' };
    const all = ships.every(s => cellsOf(s).every(c => hits.has(c)));
    return { res: all ? 'w' : 'k', cells: cs };
  }
  const encRes = r => (r.res === 'k' || r.res === 'w' ? r.res + r.cells.join('.') : r.res);
  function encode(result, shot) { return [result ? encRes(result) : '', shot != null ? 's' + shot : ''].filter(Boolean).join(';'); }
  function decode(str) {
    const out = { result: null, shot: null };
    for (const part of String(str).split(';')) {
      if (/^s\d{1,2}$/.test(part)) out.shot = +part.slice(1);
      else if (part === 'm' || part === 'h') out.result = { res: part };
      else if (/^[kw][\d.]+$/.test(part)) out.result = { res: part[0], cells: part.slice(1).split('.').map(Number) };
    }
    return out;
  }

  // ── Počítačový admirál ──
  // view: Int8Array(100) z pohledu střelce: 0 neznámé, 1 voda, 2 zásah, 3 potopená loď; left: délky nepotopených lodí
  // level 1: náhodně, dobíjí zasaženou loď; 2: lov po šachovnici + dobíjení; 3: mapa pravděpodobnosti
  function aim(view, left, level, r) {
    const free = []; for (let i = 0; i < N * N; i++) if (!view[i]) free.push(i);
    const hits = []; for (let i = 0; i < N * N; i++) if (view[i] === 2) hits.push(i);
    const nb = i => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [(i % N) + dx, Math.floor(i / N) + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < N && y < N).map(([x, y]) => y * N + x);
    // pole sousedící s potopenými loděmi jsou jistá voda
    const sunkAdj = new Set();
    for (let i = 0; i < N * N; i++) if (view[i] === 3) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = (i % N) + dx, y = Math.floor(i / N) + dy; if (x >= 0 && y >= 0 && x < N && y < N) sunkAdj.add(y * N + x); }
    const ok = i => !view[i] && !sunkAdj.has(i);
    if (hits.length) {
      // dobíjení: zásahy v řadě → pokračuj v ose, jinak kolem
      let cand = [];
      if (hits.length >= 2 && level >= 2) {
        const sameRow = hits.every(h => Math.floor(h / N) === Math.floor(hits[0] / N));
        const ends = hits.slice().sort((a, b) => a - b), a = ends[0], b = ends[ends.length - 1];
        cand = (sameRow ? [a - 1, b + 1].filter(c => Math.floor(c / N) === Math.floor(a / N)) : [a - N, b + N]).filter(c => c >= 0 && c < N * N && ok(c));
      }
      if (!cand.length) for (const h of hits) for (const c of nb(h)) if (ok(c) && !cand.includes(c)) cand.push(c);
      // zásah a sousední pole šikmo nemohou být jiná loď → vynech rohy
      if (cand.length) return cand[Math.floor(r() * cand.length)];
    }
    const pool = free.filter(ok);
    if (!pool.length) return free[0];
    if (level === 1) return pool[Math.floor(r() * pool.length)];
    if (level === 2) { const par = pool.filter(i => ((i % N) + Math.floor(i / N)) % 2 === 0); const p = par.length ? par : pool; return p[Math.floor(r() * p.length)]; }
    // level 3: kolik zbylých lodí se do pole vejde (hustota)
    const dens = new Float32Array(N * N);
    for (const len of left) for (const v of [false, true]) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (v ? y + len > N : x + len > N) continue;
      let fit = true;
      for (let k = 0; k < len && fit; k++) { const c = (y + (v ? k : 0)) * N + x + (v ? 0 : k); if (!ok(c)) fit = false; }
      if (fit) for (let k = 0; k < len; k++) dens[(y + (v ? k : 0)) * N + x + (v ? 0 : k)]++;
    }
    let best = pool[0], bv = -1;
    for (const i of pool) { const v = dens[i] + r() * 0.5; if (v > bv) { bv = v; best = i; } }
    return best;
  }
  // zápis výsledku do pohledu střelce
  function mark(view, cell, result) {
    if (result.res === 'm') view[cell] = 1;
    else if (result.res === 'h') view[cell] = 2;
    else for (const c of result.cells) view[c] = 3;
  }
  return { N, FLEET, rngOf, cellsOf, fits, randomFleet, receive, encode, decode, aim, mark };
})();
if (typeof module !== 'undefined') module.exports = LodeCore;
