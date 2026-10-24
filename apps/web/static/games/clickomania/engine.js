'use strict';
// CLICKOMANIA – pravidla, generátor a řešitel (sdílené hrou i testy v Node)
// Deska: W sloupců × H řad, pole po sloupcích (x * H + y, y = 0 je dole), 0 = prázdno.
const ClickEngine = (() => {
  const N4 = (H) => [H, -H, 1, -1];
  // Skupiny: label[i] = číslo skupiny, size[label]
  function label(g, W, H, lab, size, stack) {
    lab.fill(-1); let n = 0;
    for (let i = 0; i < W * H; i++) {
      if (!g[i] || lab[i] >= 0) continue;
      const c = g[i]; let t = 0, s = 0; stack[t++] = i; lab[i] = n;
      while (t) {
        const a = stack[--t]; s++;
        const x = (a / H) | 0, y = a - x * H;
        if (x + 1 < W && g[a + H] === c && lab[a + H] < 0) { lab[a + H] = n; stack[t++] = a + H; }
        if (x > 0 && g[a - H] === c && lab[a - H] < 0) { lab[a - H] = n; stack[t++] = a - H; }
        if (y + 1 < H && g[a + 1] === c && lab[a + 1] < 0) { lab[a + 1] = n; stack[t++] = a + 1; }
        if (y > 0 && g[a - 1] === c && lab[a - 1] < 0) { lab[a - 1] = n; stack[t++] = a - 1; }
      }
      size[n++] = s;
    }
    return n;
  }
  // odebere skupinu (buňky s lab === l), gravitace dolů, prázdné sloupce doleva
  function removeGroup(g, W, H, lab, l) {
    const out = new Int8Array(W * H); let ox = 0;
    for (let x = 0; x < W; x++) {
      let oy = 0;
      for (let y = 0; y < H; y++) { const i = x * H + y; if (g[i] && lab[i] !== l) out[ox * H + oy++] = g[i]; }
      if (oy) ox++;
    }
    return out;
  }
  // skupina obsahující buňku i (bez předpočítaných štítků) – pro hru
  function groupAt(g, W, H, i) {
    if (!g[i]) return [];
    const c = g[i], seen = new Uint8Array(W * H), st = [i], out = []; seen[i] = 1;
    while (st.length) { const a = st.pop(); out.push(a); const x = (a / H) | 0, y = a - x * H;
      for (const [b, ok] of [[a + H, x + 1 < W], [a - H, x > 0], [a + 1, y + 1 < H], [a - 1, y > 0]]) if (ok && !seen[b] && g[b] === c) { seen[b] = 1; st.push(b); } }
    return out;
  }
  function removeCells(g, W, H, cells) {
    const lab = new Int32Array(W * H).fill(-1); for (const i of cells) lab[i] = 0;
    return removeGroup(g, W, H, lab, 0);
  }
  const blocks = g => { let n = 0; for (let i = 0; i < g.length; i++) if (g[i]) n++; return n; };
  function hasMove(g, W, H) {
    for (let i = 0; i < W * H; i++) { if (!g[i]) continue; const x = (i / H) | 0, y = i - x * H; if ((x + 1 < W && g[i + H] === g[i]) || (y + 1 < H && g[i + 1] === g[i])) return true; }
    return false;
  }
  // Řešitel: paprskové hledání; hodnotí zbylé kostky, osamělé kostky a barvy s jedinou kostkou.
  function solve(g0, W, H, K, beam, r, budget = 1e9) {
    const N = W * H, lab = new Int32Array(N), size = new Int32Array(N), stack = new Int32Array(N), lab2 = new Int32Array(N), size2 = new Int32Array(N);
    const per = new Int32Array(K + 1);
    function evalBoard(g) {
      const n = label(g, W, H, lab2, size2, stack); let singles = 0, left = 0; per.fill(0);
      for (let k = 0; k < n; k++) if (size2[k] === 1) singles++;
      for (let i = 0; i < N; i++) if (g[i]) { left++; per[g[i]]++; }
      let lone = 0; for (let c = 1; c <= K; c++) if (per[c] === 1) lone++;
      return left + singles * 1.5 + lone * 12;
    }
    let layer = [{ g: g0, path: [] }], work = 0;
    while (layer.length) {
      const next = [], seen = new Set();
      for (const s of layer) {
        const n = label(s.g, W, H, lab, size, stack);
        const firstCell = new Int32Array(n).fill(-1);
        for (let i = 0; i < N; i++) if (s.g[i] && firstCell[lab[i]] < 0) firstCell[lab[i]] = i;
        for (let l = 0; l < n; l++) {
          if (size[l] < 2) continue;
          const ng = removeGroup(s.g, W, H, lab, l), path = s.path.concat(firstCell[l]);
          if (!ng[0]) return path;
          const key = String.fromCharCode.apply(null, ng);
          if (seen.has(key)) continue; seen.add(key);
          if (++work > budget) return null;
          next.push({ g: ng, path, sc: evalBoard(ng) + r() * 0.5 });
        }
      }
      next.sort((a, b) => a.sc - b.sc);
      layer = next.slice(0, beam);
    }
    return null;
  }
  return { label, removeGroup, groupAt, removeCells, blocks, hasMove, solve };
})();
if (typeof module !== 'undefined') module.exports = ClickEngine;
