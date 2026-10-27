'use strict';
// ── ČLOVĚČE, NEZLOB SE · pravidla a počítačoví hráči (sdílí je hra i testy v Node) ──
// Deska 11×11: okruh 40 polí, čtyři barvy po čtyřech figurkách, každá má svůj start (pole 0, 10,
// 20, 30), domeček (4 pole za koncem okruhu) a „ohrádku“. Figurka se nasazuje šestkou, po šestce
// se hází znovu, kdo nemá figurku na okruhu, má tři pokusy na šestku. Na vlastní figurku se
// vstoupit nedá, soupeřovu figurku vyhodí zpět do ohrádky. Do domečku se musí přesně.
// Vítězí, kdo má první všechny čtyři figurky v domečku.
// Kostka se počítá ze semínka partie a čísla kola, takže online (a v denní partii) padá všem
// stejně; tah online = jen volby figurek v jednom kole.
const ClCore = (() => {
  const TRACK = [[4, 10], [4, 9], [4, 8], [4, 7], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 5], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [5, 0], [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [10, 5], [10, 6], [9, 6], [8, 6], [7, 6], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10], [5, 10]];
  const HOME = [[[5, 9], [5, 8], [5, 7], [5, 6]], [[1, 5], [2, 5], [3, 5], [4, 5]], [[5, 1], [5, 2], [5, 3], [5, 4]], [[9, 5], [8, 5], [7, 5], [6, 5]]];
  const YARD = [[[0, 9], [1, 9], [0, 10], [1, 10]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[9, 0], [10, 0], [9, 1], [10, 1]], [[9, 9], [10, 9], [9, 10], [10, 10]]];
  const hash = (a, b, c) => { let h = (a ^ Math.imul(b + 1, 0x9e3779b1) ^ Math.imul(c + 7, 0x85ebca6b)) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b); return (h ^ (h >>> 16)) >>> 0; };
  const roll = (seed, t, k) => 1 + (hash(seed >>> 0, t, k) % 6);

  // seats: barvy ve hře (0 červená dole, 1 modrá vlevo, 2 zelená nahoře, 3 žlutá vpravo)
  function start(seed, seats) {
    return { seed, seats, pc: [0, 1, 2, 3].map(() => [-1, -1, -1, -1]), turnI: 0, t: 0, winner: -1 };
  }
  const color = s => s.seats[s.turnI];
  const abs = (p, rel) => (p * 10 + rel) % 40;
  // kdo stojí na poli okruhu (barva, figurka) nebo null
  function at(s, sq) {
    for (const p of s.seats) for (let k = 0; k < 4; k++) { const r = s.pc[p][k]; if (r >= 0 && r < 40 && abs(p, r) === sq) return [p, k]; }
    return null;
  }
  function target(s, p, k, d) {
    const r = s.pc[p][k];
    if (r === -1) return d === 6 ? 0 : null;
    const n = r + d;
    if (n > 43) return null;
    if (n >= 40) return s.pc[p].some((q, j) => j !== k && q === n) || s.pc[p].some((q, j) => j !== k && q > r && q < n && q >= 40) ? null : n; // v domečku se nepřeskakuje
    return n;
  }
  function movable(s, p, d) {
    const out = [];
    for (let k = 0; k < 4; k++) {
      const n = target(s, p, k, d); if (n == null) continue;
      if (n < 40) { const o = at(s, abs(p, n)); if (o && o[0] === p) continue; }
      out.push(k);
    }
    return out;
  }
  // provede tah; vrátí { k, from, to, capture: [barva, figurka] | null }
  function move(s, p, k, d) {
    const from = s.pc[p][k], to = target(s, p, k, d);
    let capture = null;
    if (to < 40) { const o = at(s, abs(p, to)); if (o && o[0] !== p) { s.pc[o[0]][o[1]] = -1; capture = o; } }
    s.pc[p][k] = to;
    if (s.pc[p].every(r => r >= 40)) s.winner = p;
    return { p, k, from, to, capture };
  }
  // figurky v domečku „zamčené“ (už nemohou dál) a nic na okruhu → tři pokusy na šestku
  function onlyYard(s, p) {
    const rs = s.pc[p];
    if (rs.some(r => r >= 0 && r < 40)) return false;
    return rs.filter(r => r >= 40).sort((x, y) => y - x).every((r, i) => r === 43 - i);
  }
  // Průběh kola jako generátor kroků: { roll } → { choose: [možnosti] } → { moved } …
  // choose(možnosti) vrací index figurky; celé kolo se dá přehrát ze seznamu voleb.
  function playTurn(s, choose, onStep) {
    const p = color(s), picks = [];
    let k = 0, tries = 0;
    for (let guard = 0; guard < 60 && s.winner < 0; guard++) {
      const d = roll(s.seed, s.t, k++), opts = movable(s, p, d);
      onStep && onStep({ type: 'roll', p, d, opts });
      if (opts.length) {
        const pick = choose(opts, d);
        const m = move(s, p, opts.includes(pick) ? pick : opts[0], d);
        picks.push(m.k);
        onStep && onStep({ type: 'move', d, ...m });
        if (s.winner >= 0) break;
        if (d === 6) continue;
        break;
      }
      if (d === 6) continue;
      if (onlyYard(s, p) && ++tries < 3) continue;
      break;
    }
    s.t++;
    if (s.winner < 0) s.turnI = (s.turnI + 1) % s.seats.length;
    return picks;
  }
  const encode = picks => (picks.length ? picks.join('') : 'x');
  const decode = str => (str === 'x' ? [] : String(str).split('').map(Number));
  // přehraj kolo ze zapsaných voleb
  function replayTurn(s, picks, onStep) { let i = 0; return playTurn(s, opts => picks[i++], onStep); }

  // ── Počítačový hráč ──
  function ai(s, p, opts, d, level, r) {
    if (level === 1 && r() < 0.5) return opts[Math.floor(r() * opts.length)];
    let best = opts[0], bv = -Infinity;
    const danger = sq => { // kolik soupeřových figurek stojí 1–6 polí za polem sq
      let n = 0;
      for (const q of s.seats) if (q !== p) for (const rr of s.pc[q]) if (rr >= 0 && rr < 40) { const back = (sq - abs(q, rr) + 40) % 40; if (back >= 1 && back <= 6) n++; }
      return n;
    };
    for (const k of opts) {
      const r0 = s.pc[p][k], to = target(s, p, k, d);
      let v = to / 10;
      if (r0 === -1) v += 30;
      if (to >= 40) v += 40;
      if (to < 40) { const o = at(s, abs(p, to)); if (o && o[0] !== p) v += 50 + s.pc[o[0]][o[1]] / 2; }
      if (level >= 2) {
        if (r0 >= 0 && r0 < 40) v += danger(abs(p, r0)) * 12;
        if (to < 40) v -= danger(abs(p, to)) * 14;
        if (to < 40 && to % 10 === 0 && to > 0) v -= 5; // cizí start je nebezpečný
      }
      v += r() * (level === 3 ? 0.5 : 3);
      if (v > bv) { bv = v; best = k; }
    }
    return best;
  }
  return { TRACK, HOME, YARD, roll, start, color, abs, at, movable, move, playTurn, replayTurn, encode, decode, ai, onlyYard };
})();
if (typeof module !== 'undefined') module.exports = ClCore;
