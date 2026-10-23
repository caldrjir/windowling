'use strict';
// ── SUDOKU · Windowling Hlavolamy ───────────────────────────────────────────
// Generátor: náhodná plná mřížka → odebírání čísel se zachováním jediného řešení.
// Obtížnost podle technik, které logický řešitel potřebuje (jen samotáři / páry
// a ukazující dvojice / X-wing a trojice / nad rámec).
const Sudoku = (() => {
  const L = Kit.L;
  const ALL = 0x1ff;
  const bit = d => 1 << (d - 1);
  const pop = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const low = m => { let d = 1; while (!(m & 1)) { m >>= 1; d++; } return d; };
  const ROW = i => (i / 9) | 0, COL = i => i % 9, BOX = i => ((ROW(i) / 3) | 0) * 3 + ((COL(i) / 3) | 0);
  // Jednotky: 9 řádků, 9 sloupců, 9 čtverců.
  const UNITS = [];
  for (let r = 0; r < 9; r++) UNITS.push([...Array(9)].map((_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) UNITS.push([...Array(9)].map((_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) { const u = []; for (let k = 0; k < 9; k++) u.push((((b / 3) | 0) * 3 + ((k / 3) | 0)) * 9 + (b % 3) * 3 + (k % 3)); UNITS.push(u); }
  const PEERS = [...Array(81)].map((_, i) => { const s = new Set(); for (const u of UNITS) if (u.includes(i)) for (const j of u) if (j !== i) s.add(j); return [...s]; });

  // ── Řešitel: počet řešení (do limitu) ──
  function count(g, limit = 2) {
    const a = g.slice(), R = new Int32Array(9), C = new Int32Array(9), B = new Int32Array(9);
    for (let i = 0; i < 81; i++) if (a[i]) { const m = bit(a[i]); if ((R[ROW(i)] | C[COL(i)] | B[BOX(i)]) & m) return 0; R[ROW(i)] |= m; C[COL(i)] |= m; B[BOX(i)] |= m; }
    let n = 0;
    (function rec() {
      let best = -1, bm = 0, bc = 10;
      for (let i = 0; i < 81; i++) {
        if (a[i]) continue;
        const m = ~(R[ROW(i)] | C[COL(i)] | B[BOX(i)]) & ALL, c = pop(m);
        if (c < bc) { bc = c; best = i; bm = m; if (c <= 1) break; }
      }
      if (best < 0) { n++; return; }
      if (!bc) return;
      const r = ROW(best), c = COL(best), b = BOX(best);
      for (let m = bm; m && n < limit; m &= m - 1) {
        const v = m & -m; a[best] = low(v); R[r] |= v; C[c] |= v; B[b] |= v;
        rec();
        R[r] &= ~v; C[c] &= ~v; B[b] &= ~v; a[best] = 0;
      }
    })();
    return n;
  }
  function fill(r) {
    const a = new Array(81).fill(0);
    (function rec(i) {
      if (i === 81) return true;
      const used = new Set(PEERS[i].map(j => a[j]));
      for (const d of Kit.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], r)) {
        if (used.has(d)) continue;
        a[i] = d; if (rec(i + 1)) return true;
      }
      a[i] = 0; return false;
    })(0);
    return a;
  }

  // ── Logický řešitel: vrátí nejtěžší potřebnou techniku (1–3), nebo 4 když nestačí ──
  function grade(g) {
    const a = g.slice(), cand = new Int32Array(81);
    for (let i = 0; i < 81; i++) if (!a[i]) { let m = ALL; for (const j of PEERS[i]) if (a[j]) m &= ~bit(a[j]); cand[i] = m; }
    const place = (i, d) => { a[i] = d; cand[i] = 0; for (const j of PEERS[i]) cand[j] &= ~bit(d); };
    let level = 1;
    for (let guard = 0; guard < 500; guard++) {
      if (a.every(v => v)) return level;
      let did = false;
      // 1: samotáři (nahý a skrytý)
      for (let i = 0; i < 81; i++) if (!a[i] && pop(cand[i]) === 1) { place(i, low(cand[i])); did = true; }
      if (did) continue;
      for (const u of UNITS) for (let d = 1; d <= 9; d++) {
        const where = u.filter(i => !a[i] && cand[i] & bit(d));
        if (where.length === 1) { place(where[0], d); did = true; }
      }
      if (did) continue;
      if (a.some((v, i) => !v && !cand[i])) return 4;
      // 2: ukazující dvojice / zámky, nahé a skryté páry
      if (level < 2) level = 2;
      for (let b = 18; b < 27 && !did; b++) for (let d = 1; d <= 9 && !did; d++) {
        const w = UNITS[b].filter(i => !a[i] && cand[i] & bit(d));
        if (w.length < 2 || w.length > 3) continue;
        for (const key of [ROW, COL]) {
          if (w.every(i => key(i) === key(w[0]))) {
            const line = UNITS[key === ROW ? key(w[0]) : 9 + key(w[0])];
            for (const j of line) if (!w.includes(j) && !a[j] && cand[j] & bit(d)) { cand[j] &= ~bit(d); did = true; }
          }
        }
      }
      if (did) continue;
      for (let u = 0; u < 18 && !did; u++) for (let d = 1; d <= 9 && !did; d++) {
        const w = UNITS[u].filter(i => !a[i] && cand[i] & bit(d));
        if (w.length < 2 || w.length > 3 || !w.every(i => BOX(i) === BOX(w[0]))) continue;
        for (const j of UNITS[18 + BOX(w[0])]) if (!w.includes(j) && !a[j] && cand[j] & bit(d)) { cand[j] &= ~bit(d); did = true; }
      }
      if (did) continue;
      for (const u of UNITS) {
        const e = u.filter(i => !a[i]);
        for (let x = 0; x < e.length; x++) for (let y = x + 1; y < e.length; y++) {
          const m = cand[e[x]];
          if (pop(m) === 2 && cand[e[y]] === m) for (const j of e) if (j !== e[x] && j !== e[y] && cand[j] & m) { cand[j] &= ~m; did = true; }
        }
        for (let d1 = 1; d1 <= 9; d1++) for (let d2 = d1 + 1; d2 <= 9; d2++) {
          const w1 = e.filter(i => cand[i] & bit(d1)), w2 = e.filter(i => cand[i] & bit(d2));
          if (w1.length === 2 && w2.length === 2 && w1[0] === w2[0] && w1[1] === w2[1]) {
            const m = bit(d1) | bit(d2);
            for (const i of w1) if (cand[i] & ~m) { cand[i] &= m; did = true; }
          }
        }
      }
      if (did) continue;
      // 3: X-wing a nahé trojice
      if (level < 3) level = 3;
      for (let d = 1; d <= 9 && !did; d++) for (const [base, other] of [[0, 9], [9, 0]]) {
        const rows = [];
        for (let k = 0; k < 9; k++) { const w = UNITS[base + k].filter(i => !a[i] && cand[i] & bit(d)); if (w.length === 2) rows.push([k, w.map(i => (base === 0 ? COL(i) : ROW(i)))]); }
        for (let x = 0; x < rows.length; x++) for (let y = x + 1; y < rows.length; y++) {
          const [k1, p1] = rows[x], [k2, p2] = rows[y];
          if (p1[0] !== p2[0] || p1[1] !== p2[1]) continue;
          for (const p of p1) for (const j of UNITS[other + p]) {
            const kk = base === 0 ? ROW(j) : COL(j);
            if (kk !== k1 && kk !== k2 && !a[j] && cand[j] & bit(d)) { cand[j] &= ~bit(d); did = true; }
          }
        }
      }
      if (did) continue;
      for (const u of UNITS) {
        const e = u.filter(i => !a[i] && pop(cand[i]) <= 3);
        for (let x = 0; x < e.length; x++) for (let y = x + 1; y < e.length; y++) for (let z = y + 1; z < e.length; z++) {
          const m = cand[e[x]] | cand[e[y]] | cand[e[z]];
          if (pop(m) !== 3) continue;
          for (const j of u) if (j !== e[x] && j !== e[y] && j !== e[z] && !a[j] && cand[j] & m) { cand[j] &= ~m; did = true; }
        }
      }
      if (!did) return 4;
    }
    return 4;
  }

  const DIFFS = [
    { id: 'easy', name: L('Lehké', 'Easy'), par: 6 * 60, min: 36, max: 1, need: 1 },
    { id: 'medium', name: L('Střední', 'Medium'), par: 10 * 60, min: 29, max: 1, need: 1 },
    { id: 'hard', name: L('Těžké', 'Hard'), par: 16 * 60, min: 25, max: 3, need: 2 },
    { id: 'expert', name: L('Expert', 'Expert'), par: 25 * 60, min: 22, max: 4, need: 3 },
  ];

  function generate(seed, diffId) {
    const D = DIFFS.find(d => d.id === diffId) || DIFFS[0];
    const r = Kit.rng(seed);
    let bestP = null, bestScore = -1;
    for (let attempt = 0; attempt < 14; attempt++) {
      const sol = fill(r), g = sol.slice();
      // Středově souměrné odebírání (hezčí rozložení).
      const order = Kit.shuffle([...Array(41)].map((_, i) => i), r);
      let clues = 81;
      for (const i of order) {
        if (clues <= D.min) break;
        const j = 80 - i, pair = i === j ? [i] : [i, j];
        const keep = pair.map(k => g[k]);
        for (const k of pair) g[k] = 0;
        let ok = count(g, 2) === 1;
        if (ok && D.max < 4 && grade(g) > D.max) ok = false;
        if (ok) clues -= pair.length; else pair.forEach((k, n) => { g[k] = keep[n]; });
      }
      const gr = grade(g);
      const score = (gr >= D.need ? 100 : gr * 10) - Math.abs(clues - D.min);
      if (score > bestScore) { bestScore = score; bestP = { givens: g.join(''), solution: sol.join(''), grade: gr, clues }; }
      if (gr >= D.need && clues <= D.min + 3) break;
    }
    return bestP;
  }

  // ── Hrací plocha ──
  function create(el, P, saved, api) {
    const giv = [...P.givens].map(Number), sol = [...P.solution].map(Number);
    let val = saved && saved.val ? saved.val.slice() : giv.slice();
    let notes = saved && saved.notes ? saved.notes.slice() : new Array(81).fill(0);
    let sel = saved && saved.sel != null ? saved.sel : giv.findIndex(v => !v);
    let noteMode = false, undo = [], done = false;
    el.innerHTML = `<div class="sd-wrap"><div class="sd-grid" role="grid" aria-label="Sudoku"></div>
      <div class="sd-side"><div class="sd-pad"></div><div class="k-tools">
        <button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button>
        <button class="k-tool" data-t="erase">${api.icon('erase')}<span>${L('Smazat', 'Erase')}</span></button>
        <button class="k-tool" data-t="notes">${api.icon('pencil')}<span>${L('Poznámky', 'Notes')}</span></button>
        <button class="k-tool" data-t="auto">${api.icon('plus')}<span>${L('Kandidáti', 'Fill notes')}</span></button>
        <button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button>
      </div></div></div>`;
    const grid = el.querySelector('.sd-grid'), pad = el.querySelector('.sd-pad');
    grid.innerHTML = [...Array(81)].map((_, i) => `<button class="sd-c" data-i="${i}" role="gridcell"></button>`).join('');
    pad.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button class="sd-n" data-d="${d}"><b>${d}</b><small></small></button>`).join('');
    const cells = [...grid.children];

    function render() {
      const sv = sel >= 0 ? val[sel] : 0;
      const counts = new Array(10).fill(0);
      for (let i = 0; i < 81; i++) if (val[i] && val[i] === sol[i]) counts[val[i]]++;
      cells.forEach((c, i) => {
        const v = val[i], wrong = v && v !== sol[i];
        c.className = 'sd-c' + (giv[i] ? ' given' : v ? ' user' : '') + (wrong ? ' wrong' : '') + (i === sel ? ' sel' : '')
          + (sel >= 0 && i !== sel && (ROW(i) === ROW(sel) || COL(i) === COL(sel) || BOX(i) === BOX(sel)) ? ' peer' : '')
          + (sv && v === sv && i !== sel ? ' same' : '') + (COL(i) % 3 === 2 && COL(i) < 8 ? ' br' : '') + (ROW(i) % 3 === 2 && ROW(i) < 8 ? ' bb' : '');
        c.innerHTML = v ? `<b>${v}</b>` : notes[i] ? `<span class="sd-notes">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<i class="${notes[i] & bit(d) ? 'on' : ''} ${sv === d ? 'hl' : ''}">${notes[i] & bit(d) ? d : ''}</i>`).join('')}</span>` : '';
      });
      [...pad.children].forEach((b, k) => { const d = k + 1, left = 9 - counts[d]; b.classList.toggle('gone', left <= 0); b.querySelector('small').textContent = left > 0 ? left : ''; b.classList.toggle('hl', sv === d); });
      el.querySelector('[data-t="notes"]').classList.toggle('on', noteMode);
    }
    const snap = () => { undo.push({ val: val.slice(), notes: notes.slice() }); if (undo.length > 200) undo.shift(); };
    function flashUnits(i) {
      for (const u of UNITS) if (u.includes(i) && u.every(j => val[j] === sol[j])) {
        api.sound('line');
        u.forEach((j, k) => setTimeout(() => { cells[j].classList.add('flash'); setTimeout(() => cells[j].classList.remove('flash'), 500); }, k * 25));
      }
    }
    function input(d) {
      if (done || sel < 0 || giv[sel]) return;
      if (noteMode) { if (val[sel]) return; snap(); notes[sel] ^= bit(d); api.sound('soft'); }
      else {
        if (val[sel] === d) return;
        snap(); val[sel] = d; notes[sel] = 0;
        if (d !== sol[sel]) api.mistake();
        else { api.sound('place'); for (const j of PEERS[sel]) notes[j] &= ~bit(d); flashUnits(sel); }
      }
      render(); api.changed(); check();
    }
    function erase() { if (done || sel < 0 || giv[sel]) return; if (!val[sel] && !notes[sel]) return; snap(); val[sel] = 0; notes[sel] = 0; api.sound('erase'); render(); api.changed(); }
    function hint() {
      if (done) return;
      let i = sel >= 0 && !giv[sel] && val[sel] !== sol[sel] ? sel : -1;
      if (i < 0) { // nejsnazší políčko: nejméně možností
        let bc = 10;
        for (let k = 0; k < 81; k++) if (val[k] !== sol[k]) { let m = ALL; for (const j of PEERS[k]) if (val[j] && val[j] === sol[j]) m &= ~bit(val[j]); const c = pop(m); if (c < bc) { bc = c; i = k; } }
      }
      if (i < 0) return;
      snap(); sel = i; val[i] = sol[i]; notes[i] = 0; for (const j of PEERS[i]) notes[j] &= ~bit(sol[i]);
      api.hint(); api.sound('star'); cells[i].classList.add('flash'); render(); api.changed(); flashUnits(i); check();
    }
    function autoNotes() {
      if (done) return; snap();
      for (let i = 0; i < 81; i++) if (!val[i]) { let m = ALL; for (const j of PEERS[i]) if (val[j]) m &= ~bit(val[j]); notes[i] = m; }
      api.sound('soft'); render(); api.changed();
    }
    function check() {
      if (val.every((v, i) => v === sol[i])) {
        done = true;
        cells.forEach((c, i) => setTimeout(() => c.classList.add('win'), (ROW(i) + COL(i)) * 30));
        setTimeout(() => api.solved(), 900);
      }
    }
    grid.addEventListener('click', e => { const c = e.target.closest('.sd-c'); if (!c) return; sel = +c.dataset.i; api.sound('tap'); render(); });
    pad.addEventListener('click', e => { const b = e.target.closest('.sd-n'); if (b) input(+b.dataset.d); });
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t) return;
      const k = t.dataset.t;
      if (k === 'undo' && undo.length) { const u = undo.pop(); val = u.val; notes = u.notes; api.sound('erase'); render(); api.changed(); }
      if (k === 'erase') erase();
      if (k === 'notes') { noteMode = !noteMode; api.sound('ui'); render(); }
      if (k === 'hint') hint();
      if (k === 'auto') autoNotes();
    });
    render();
    return {
      getState: () => ({ val, notes, sel }),
      progress: () => { let k = 0, n = 0; for (let i = 0; i < 81; i++) if (!giv[i]) { n++; if (val[i] === sol[i]) k++; } return n ? k / n : 1; },
      onKey(e) {
        const k = e.key;
        if (/^[1-9]$/.test(k)) { input(+k); e.preventDefault(); }
        else if (k === 'Backspace' || k === 'Delete' || k === '0') { erase(); e.preventDefault(); }
        else if (k.startsWith('Arrow')) {
          if (sel < 0) sel = 0;
          const r = ROW(sel), c = COL(sel);
          sel = k === 'ArrowUp' ? ((r + 8) % 9) * 9 + c : k === 'ArrowDown' ? ((r + 1) % 9) * 9 + c : k === 'ArrowLeft' ? r * 9 + (c + 8) % 9 : r * 9 + (c + 1) % 9;
          render(); e.preventDefault();
        } else if (k === 'n' || k === 'N') { noteMode = !noteMode; render(); }
        else if ((k === 'z' || k === 'Z') && undo.length) { const u = undo.pop(); val = u.val; notes = u.notes; render(); api.changed(); }
        else if (k === 'h' || k === 'H') hint();
      },
      _solve() { for (let i = 0; i < 81; i++) { sel = i; if (val[i] !== sol[i]) input(sol[i]); } },
    };
  }

  function art(el) {
    const g = [5, 3, 0, 0, 7, 0, 0, 0, 0, 6, 0, 0, 1, 9, 5, 0, 0, 0, 0, 9, 8, 0, 0, 0, 0, 6, 0];
    let s = '<svg viewBox="0 0 270 270"><defs><filter id="gl"><feGaussianBlur stdDeviation="3"/></filter></defs>';
    for (let i = 0; i <= 9; i++) { const w = i % 3 === 0 ? 2.4 : 0.8, o = i % 3 === 0 ? 0.7 : 0.25, p = 10 + i * 27.8; s += `<line x1="10" y1="${p}" x2="260" y2="${p}" stroke="var(--a)" stroke-width="${w}" opacity="${o}"/><line x1="${p}" y1="10" x2="${p}" y2="260" stroke="var(--a)" stroke-width="${w}" opacity="${o}"/>`; }
    const sol = '534678912672195348198342567'.split('').map(Number);
    for (let i = 0; i < 27; i++) { const x = 23.9 + (i % 9) * 27.8, y = 33 + ((i / 9) | 0) * 27.8; s += `<text x="${x}" y="${y}" text-anchor="middle" font-family="Unbounded, Segoe UI, sans-serif" font-size="15" fill="${g[i] ? 'var(--text)' : 'var(--b)'}" opacity="${g[i] ? 1 : 0.85}">${sol[i]}</text>`; }
    for (let k = 0; k < 14; k++) { const x = 20 + ((k * 73) % 230), y = 120 + ((k * 41) % 130); s += `<circle cx="${x}" cy="${y}" r="${1 + (k % 3)}" fill="var(--a)" opacity=".7" filter="url(#gl)"/>`; }
    el.innerHTML = s + '</svg>';
  }

  return { DIFFS, generate, create, art, count, grade };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'sudoku', title: 'SUDOKU',
  tagline: Kit.L('Devět čísel, devět souhvězdí. Klasické sudoku s denní výzvou, 120 úrovněmi Cesty hvězd a nekonečnem nových mřížek.', 'Nine numbers, nine constellations. Classic sudoku with a daily puzzle, 120 Star Path levels and endless new grids.'),
  diffs: Sudoku.DIFFS, generate: Sudoku.generate, create: Sudoku.create, art: Sudoku.art,
  online: { kind: 'race' },
  rules: Kit.L(`<p>Doplň čísla 1–9 tak, aby se v každém <b>řádku</b>, <b>sloupci</b> a <b>čtverci 3×3</b> objevilo každé číslo právě jednou.</p>
    <ul><li>Klepni na políčko a pak na číslo. Na počítači stačí psát číslice a pohybovat se šipkami.</li>
    <li><b>Poznámky</b> (klávesa N) zapisují malá čísla – možné kandidáty. <b>Kandidáti</b> je doplní za tebe.</li>
    <li>Špatné číslo se zčervená a počítá se jako chyba. <b>Nápověda</b> (H) doplní nejsnazší políčko.</li>
    <li>Každý hlavolam má právě jedno řešení. Lehké až Těžké se dají vyřešit čistou logikou.</li></ul>`,
    `<p>Fill in 1–9 so that every <b>row</b>, <b>column</b> and <b>3×3 box</b> contains each digit exactly once.</p>
    <ul><li>Tap a cell, then a number. On a computer just type digits and move with the arrow keys.</li>
    <li><b>Notes</b> (N key) pencil in candidates. <b>Fill notes</b> does it for you.</li>
    <li>A wrong digit turns red and counts as a mistake. <b>Hint</b> (H) fills the easiest cell.</li>
    <li>Every puzzle has exactly one solution. Easy to Hard can be solved by pure logic.</li></ul>`),
  achievements: [],
});
