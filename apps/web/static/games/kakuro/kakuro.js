'use strict';
// ── KAKURO · Windowling Hlavolamy ───────────────────────────────────────────
// Číselná křížovka: každý úsek bílých políček má součet; číslice 1–9 se v úseku
// neopakují. Generátor: souměrný tvar → náhodné vyplnění → kontrola jediného řešení
// (kde řešení není jediné, odkryje rozhodující číslici předem).
const Kakuro = (() => {
  const L = Kit.L;
  const DIFFS = [
    { id: 'easy', name: L('Lehké', 'Easy'), note: '6×6', n: 6, black: 0.2, run: 4, par: 4 * 60 },
    { id: 'medium', name: L('Střední', 'Medium'), note: '8×8', n: 8, black: 0.24, run: 5, par: 9 * 60 },
    { id: 'hard', name: L('Těžké', 'Hard'), note: '10×10', n: 10, black: 0.26, run: 6, par: 16 * 60 },
    { id: 'expert', name: L('Expert', 'Expert'), note: '11×11', n: 11, black: 0.28, run: 6, par: 24 * 60 },
  ];
  const bit = d => 1 << d; // číslice 1–9 → bity 1–9
  const pop = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  // Všechny kombinace: [součet][délka] → masky
  const COMBOS = [...Array(46)].map(() => [...Array(10)].map(() => []));
  for (let m = 2; m < 1024; m += 2) { let s = 0, l = 0; for (let d = 1; d <= 9; d++) if (m & bit(d)) { s += d; l++; } COMBOS[s][l].push(m); }
  const digitsOf = m => { const a = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) a.push(d); return a; };

  // ── Tvar: černá políčka jen tam, kde nevznikne úsek délky 1; dlouhé úseky se dělí ──
  function shape(n, black, r, maxRun) {
    const g = new Array(n * n).fill(1);
    for (let i = 0; i < n; i++) { g[i] = 0; g[i * n] = 0; }
    const inner = [];
    for (let y = 1; y < n; y++) for (let x = 1; x < n; x++) inner.push(y * n + x);
    const sym = i => { const y = Math.floor(i / n), x = i % n; return (n - y) * n + (n - x); };
    const len = (i, dx, dy) => { const y = Math.floor(i / n), x = i % n; let a = 0, b = 0; while (g[(y - dy * (a + 1)) * n + x - dx * (a + 1)]) a++; while (y + dy * (b + 1) < n && x + dx * (b + 1) < n && g[(y + dy * (b + 1)) * n + x + dx * (b + 1)]) b++; return a + b + 1; };
    const valid = cells => { for (const c of cells) { const y = Math.floor(c / n), x = c % n; for (const j of [c - 1, c + 1, c - n, c + n]) { if (j < 0 || j >= n * n || !g[j] || Math.abs((j % n) - x) > 1) continue; if (len(j, 1, 0) < 2 || len(j, 0, 1) < 2) return false; } if (Math.floor(c / n) !== y) return false; } return true; };
    const tryBlack = i => { const j = sym(i), cells = i === j ? [i] : [i, j]; if (cells.some(c => !g[c])) return false; cells.forEach(c => { g[c] = 0; }); if (valid(cells)) return true; cells.forEach(c => { g[c] = 1; }); return false; };
    const target = Math.round(inner.length * black);
    let blacks = 0;
    for (const i of Kit.shuffle(inner.slice(), r)) { if (blacks >= target) break; if (tryBlack(i)) blacks += i === sym(i) ? 1 : 2; }
    // dlouhé úseky rozděl
    for (let pass = 0; pass < 4; pass++) for (const i of inner) {
      if (!g[i]) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) if (len(i, dx, dy) > maxRun) tryBlack(i);
    }
    for (const i of inner) if (g[i] && (len(i, 1, 0) < 2 || len(i, 0, 1) < 2 || len(i, 1, 0) > 9 || len(i, 0, 1) > 9)) return null;
    const whites = inner.filter(i => g[i]);
    if (whites.length < inner.length * 0.5) return null;
    const seen = new Set([whites[0]]), q = [whites[0]];
    while (q.length) { const i = q.pop(); for (const j of [i - 1, i + 1, i - n, i + n]) if (j >= 0 && j < n * n && g[j] && !seen.has(j) && Math.abs((j % n) - (i % n)) <= 1) { seen.add(j); q.push(j); } }
    return seen.size === whites.length ? g : null;
  }
  // Úseky: across a down
  function runsOf(g, n) {
    const runs = [], cellRuns = {};
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x; if (g[i]) continue;
      for (const [dx, dy, dir] of [[1, 0, 'a'], [0, 1, 'd']]) {
        const cells = []; let xx = x + dx, yy = y + dy;
        while (xx < n && yy < n && g[yy * n + xx]) { cells.push(yy * n + xx); xx += dx; yy += dy; }
        if (cells.length >= 2) { const k = runs.length; runs.push({ clue: i, dir, cells }); for (const c of cells) (cellRuns[c] = cellRuns[c] || []).push(k); }
      }
    }
    return { runs, cellRuns };
  }
  function fillDigits(g, n, R, r) {
    const cells = g.map((v, i) => (v ? i : -1)).filter(i => i >= 0 && i % n && i >= n);
    const val = {};
    const used = k => R.runs[k].cells.reduce((m, c) => m | (val[c] ? bit(val[c]) : 0), 0);
    let steps = 0;
    const rec = idx => {
      if (++steps > 20000) return false;
      if (idx === cells.length) return true;
      const c = cells[idx]; let mask = 0;
      for (const k of R.cellRuns[c]) mask |= used(k);
      for (const d of Kit.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], r)) { if (mask & bit(d)) continue; val[c] = d; if (rec(idx + 1)) return true; }
      delete val[c]; return false;
    };
    return rec(0) ? val : null;
  }
  // Počet řešení (do limitu); vrací i dvě různá řešení pro odkrytí rozdílu.
  const UNION = new Map();
  function avail(sum, len, used) {
    const key = (sum * 10 + len) * 1024 + used;
    let u = UNION.get(key);
    if (u === undefined) { u = 0; for (const cm of COMBOS[sum][len] || []) if ((cm & used) === used) u |= cm & ~used; UNION.set(key, u); }
    return u;
  }
  function solve(cells, R, sums, fixed, limit = 2) {
    const val = Object.assign({}, fixed), sols = [];
    const runMask = k => { let m = 0; for (const c of R.runs[k].cells) if (val[c]) m |= bit(val[c]); return m; };
    const cand = c => { let m = 0x3fe; for (const k of R.cellRuns[c]) m &= avail(sums[k], R.runs[k].cells.length, runMask(k)); return m; };
    let nodes = 0;
    (function rec() {
      if (sols.length >= limit || ++nodes > 60000) return;
      const forced = [];
      let best = -1, bm = 0, bc = 99, dead = false;
      // propagace: jednoznačná políčka doplň hned
      for (let again = true; again && !dead;) {
        again = false; best = -1; bc = 99;
        for (const c of cells) {
          if (val[c]) continue;
          const m = cand(c), k = pop(m);
          if (!k) { dead = true; break; }
          if (k === 1) { let d = 1; while (!(m & bit(d))) d++; val[c] = d; forced.push(c); again = true; continue; }
          if (k < bc) { bc = k; best = c; bm = m; }
        }
      }
      if (!dead) {
        if (best < 0) {
          // vše doplněno: zkontroluj součty a opakování
          let ok = true;
          for (let k = 0; k < R.runs.length && ok; k++) { let s = 0, m = 0; for (const c of R.runs[k].cells) { s += val[c]; if (m & bit(val[c])) ok = false; m |= bit(val[c]); } if (s !== sums[k]) ok = false; }
          if (ok) sols.push(Object.assign({}, val));
        } else {
          for (const d of digitsOf(bm)) { val[best] = d; rec(); if (sols.length >= limit) break; }
          delete val[best];
        }
      }
      for (const c of forced) delete val[c];
    })();
    return { n: sols.length, sols, timeout: nodes > 60000 };
  }

  function generate(seed, diffId) {
    const D = DIFFS.find(d => d.id === diffId) || DIFFS[0], n = D.n, r = Kit.rng(seed);
    let fallback = null; const stat = generate.stat = { shape: 0, fill: 0, timeout: 0, multi: 0 };
    for (let attempt = 0; attempt < 30; attempt++) {
      const g = shape(n, D.black, r, D.run); if (!g) { stat.shape++; continue; }
      const R = runsOf(g, n);
      const val = fillDigits(g, n, R, r); if (!val) { stat.fill++; continue; }
      const cells = Object.keys(val).map(Number);
      const sumsOf = () => R.runs.map(run => run.cells.reduce((s, c) => s + val[c], 0));
      let sums = sumsOf();
      const fixed = {};
      let res = solve(cells, R, sums, fixed);
      // Oprava: kde se řešení liší, zkus jinou číslici a přepočítej součty.
      for (let it = 0; it < 80 && res.n > 1 && !res.timeout; it++) {
        const diff = cells.filter(c => res.sols[0][c] !== res.sols[1][c]);
        const c = diff[Math.floor(r() * diff.length)];
        let used = 0; for (const k of R.cellRuns[c]) for (const o of R.runs[k].cells) if (o !== c) used |= bit(val[o]);
        const opts = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => !(used & bit(d)) && d !== val[c]);
        if (!opts.length) continue;
        val[c] = opts[Math.floor(r() * opts.length)];
        sums = sumsOf(); res = solve(cells, R, sums, fixed);
      }
      if (res.timeout) { stat.timeout++; continue; }
      let reveals = 0;
      while (res.n > 1 && reveals < 12) { // odkryj číslici, ve které se řešení liší
        const diff = cells.filter(c => res.sols[0][c] !== res.sols[1][c]);
        const c = diff[Math.floor(r() * diff.length)]; fixed[c] = val[c]; reveals++;
        res = solve(cells, R, sums, fixed);
      }
      if (res.n !== 1 || res.timeout) { stat.multi++; continue; }
      const p = { n, g: g.join(''), sol: g.map((v, i) => (v && val[i]) || 0).join(''), runs: R.runs.map((run, k) => ({ clue: run.clue, dir: run.dir, cells: run.cells, sum: sums[k] })), given: Object.keys(fixed).map(Number) };
      if (!reveals) return p;
      if (!fallback || reveals < fallback.given.length) fallback = p;
      if (attempt > 8 && fallback) return fallback;
    }
    return fallback;
  }

  // ── Hrací plocha ──
  function create(el, P, saved, api) {
    const n = P.n, sol = [...P.sol].map(Number), white = [...P.g].map(Number);
    const isCell = i => white[i] && sol[i];
    const given = new Set(P.given);
    const cellRuns = {}; P.runs.forEach((run, k) => run.cells.forEach(c => (cellRuns[c] = cellRuns[c] || []).push(k)));
    let val = saved && saved.val ? saved.val.slice() : sol.map((v, i) => (given.has(i) ? v : 0));
    let notes = saved && saved.notes ? saved.notes.slice() : new Array(n * n).fill(0);
    let sel = saved && saved.sel != null ? saved.sel : sol.findIndex((v, i) => isCell(i) && !given.has(i));
    let noteMode = false, undo = [], done = false;
    el.innerHTML = `<div class="kk-wrap"><div class="kk-grid"></div><div class="kk-side"><div class="kk-combo"></div><div class="sd-pad kk-pad"></div><div class="k-tools">
        <button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button>
        <button class="k-tool" data-t="erase">${api.icon('erase')}<span>${L('Smazat', 'Erase')}</span></button>
        <button class="k-tool" data-t="notes">${api.icon('pencil')}<span>${L('Poznámky', 'Notes')}</span></button>
        <button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button></div></div></div>`;
    const grid = el.querySelector('.kk-grid'), pad = el.querySelector('.kk-pad'), combo = el.querySelector('.kk-combo');
    grid.style.setProperty('--n', n);
    const clueOf = {}; P.runs.forEach(run => { (clueOf[run.clue] = clueOf[run.clue] || {})[run.dir] = run.sum; });
    grid.innerHTML = sol.map((_, i) => isCell(i) ? `<button class="kk-c" data-i="${i}"></button>` : `<div class="kk-b">${clueOf[i] ? `${clueOf[i].d ? `<em class="dn">${clueOf[i].d}</em>` : ''}${clueOf[i].a ? `<em class="ac">${clueOf[i].a}</em>` : ''}<i></i>` : ''}</div>`).join('');
    pad.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button class="sd-n" data-d="${d}"><b>${d}</b></button>`).join('');
    const el_ = [...grid.children];

    function runOk(k) { return P.runs[k].cells.every(c => val[c] === sol[c]); }
    function render() {
      const selRuns = sel >= 0 ? cellRuns[sel] || [] : [];
      el_.forEach((c, i) => {
        if (!isCell(i)) { const runs = P.runs.map((r, k) => (r.clue === i ? k : -1)).filter(k => k >= 0); c.classList.toggle('ok', runs.length > 0 && runs.every(runOk)); c.classList.toggle('hl', runs.some(k => selRuns.includes(k))); return; }
        const v = val[i];
        c.className = 'kk-c' + (given.has(i) ? ' given' : v ? ' user' : '') + (v && v !== sol[i] ? ' wrong' : '') + (i === sel ? ' sel' : '') + ((cellRuns[i] || []).some(k => selRuns.includes(k)) && i !== sel ? ' peer' : '');
        c.innerHTML = v ? `<b>${v}</b>` : notes[i] ? `<span class="sd-notes">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<i>${notes[i] & bit(d) ? d : ''}</i>`).join('')}</span>` : '';
      });
      // Kombinace pro vybrané úseky
      combo.innerHTML = selRuns.map(k => {
        const run = P.runs[k], used = run.cells.reduce((m, c) => m | (val[c] && val[c] === sol[c] ? bit(val[c]) : 0), 0);
        const list = (COMBOS[run.sum][run.cells.length] || []).filter(m => (m & used) === used);
        return `<div><b>${run.sum}</b><small>${run.dir === 'a' ? '→' : '↓'} ${run.cells.length} ${L('políčka', 'cells')}</small><span>${list.slice(0, 6).map(m => digitsOf(m).join('+')).join(' · ')}${list.length > 6 ? ' …' : ''}</span></div>`;
      }).join('');
      el.querySelector('[data-t="notes"]').classList.toggle('on', noteMode);
    }
    const snap = () => { undo.push({ val: val.slice(), notes: notes.slice() }); if (undo.length > 200) undo.shift(); };
    function input(d) {
      if (done || sel < 0 || given.has(sel)) return;
      if (noteMode) { if (val[sel]) return; snap(); notes[sel] ^= bit(d); api.sound('soft'); }
      else {
        if (val[sel] === d) return;
        snap(); val[sel] = d; notes[sel] = 0;
        if (d !== sol[sel]) api.mistake();
        else { api.sound('place'); for (const k of cellRuns[sel]) { for (const c of P.runs[k].cells) notes[c] &= ~bit(d); if (runOk(k)) { api.sound('line'); P.runs[k].cells.forEach((c, t) => setTimeout(() => { el_[c].classList.add('flash'); setTimeout(() => el_[c].classList.remove('flash'), 500); }, t * 40)); } } }
      }
      render(); api.changed(); check();
    }
    function erase() { if (done || sel < 0 || given.has(sel)) return; snap(); val[sel] = 0; notes[sel] = 0; api.sound('erase'); render(); api.changed(); }
    function hint() {
      if (done) return;
      let i = sel >= 0 && val[sel] !== sol[sel] && !given.has(sel) ? sel : -1;
      if (i < 0) { const open = sol.map((v, k) => (isCell(k) && val[k] !== v ? k : -1)).filter(k => k >= 0); i = open[Math.floor(Math.random() * open.length)]; }
      if (i == null || i < 0) return;
      snap(); sel = i; val[i] = sol[i]; notes[i] = 0; api.hint(); api.sound('star'); render(); api.changed(); check();
    }
    function check() {
      if (sol.every((v, i) => !isCell(i) || val[i] === v)) { done = true; el_.forEach((c, i) => setTimeout(() => c.classList.add('win'), ((i % n) + Math.floor(i / n)) * 30)); setTimeout(() => api.solved(), 1000); }
    }
    grid.addEventListener('click', e => { const c = e.target.closest('.kk-c'); if (!c) return; sel = +c.dataset.i; api.sound('tap'); render(); });
    pad.addEventListener('click', e => { const b = e.target.closest('.sd-n'); if (b) input(+b.dataset.d); });
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t) return; const k = t.dataset.t;
      if (k === 'undo' && undo.length) { const u = undo.pop(); val = u.val; notes = u.notes; api.sound('erase'); render(); api.changed(); }
      if (k === 'erase') erase(); if (k === 'hint') hint(); if (k === 'notes') { noteMode = !noteMode; render(); }
    });
    function fit() { const vw = (document.getElementById('kView') || el).clientWidth - 28, w = Math.min(innerWidth < 860 ? vw : vw - 260, 620), h = innerHeight - (innerWidth < 860 ? 330 : 140); grid.style.setProperty('--s', Math.max(220, Math.min(w, h)) + 'px'); }
    fit(); addEventListener('resize', fit);
    render();
    return {
      getState: () => ({ val, notes, sel }),
      progress: () => { let k = 0, m = 0; for (let i = 0; i < n * n; i++) if (isCell(i) && !given.has(i)) { m++; if (val[i] === sol[i]) k++; } return m ? k / m : 1; }, destroy() { removeEventListener('resize', fit); },
      onKey(e) {
        const k = e.key;
        if (/^[1-9]$/.test(k)) { input(+k); e.preventDefault(); }
        else if (k === 'Backspace' || k === 'Delete' || k === '0') erase();
        else if (k.startsWith('Arrow') && sel >= 0) {
          const d = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 }[k];
          let j = sel;
          do { j += d; if ((d === 1 || d === -1) && Math.floor(j / n) !== Math.floor(sel / n)) { j = -1; break; } if (j < 0 || j >= n * n) { j = -1; break; } } while (!isCell(j));
          if (j >= 0) { sel = j; render(); } e.preventDefault();
        } else if (k === 'n' || k === 'N') { noteMode = !noteMode; render(); }
        else if (k === 'h' || k === 'H') hint();
      },
      _solve() { for (let i = 0; i < n * n; i++) if (isCell(i) && val[i] !== sol[i]) { sel = i; input(sol[i]); } },
    };
  }

  function art(el) {
    const p = generate(Kit.hash('kart'), 'easy'), n = p.n, s = 260 / n;
    let h = `<svg viewBox="0 0 260 260">`;
    const clue = {}; p.runs.forEach(r => { (clue[r.clue] = clue[r.clue] || {})[r.dir] = r.sum; });
    for (let i = 0; i < n * n; i++) {
      const x = (i % n) * s, y = Math.floor(i / n) * s, w = p.g[i] === '1';
      h += `<rect x="${x + 1}" y="${y + 1}" width="${s - 2}" height="${s - 2}" rx="5" fill="${w ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.4)'}" stroke="var(--a)" stroke-opacity="${w ? 0.35 : 0.15}"/>`;
      if (w && (i * 7) % 3) h += `<text x="${x + s / 2}" y="${y + s * 0.66}" text-anchor="middle" font-family="Unbounded, sans-serif" font-size="${s * 0.45}" fill="var(--a)">${p.sol[i]}</text>`;
      if (clue[i]) { h += `<line x1="${x + 3}" y1="${y + 3}" x2="${x + s - 3}" y2="${y + s - 3}" stroke="var(--b)" stroke-opacity=".5"/>`; if (clue[i].a) h += `<text x="${x + s * 0.72}" y="${y + s * 0.4}" text-anchor="middle" font-size="${s * 0.26}" fill="var(--text)" font-family="Space Grotesk, sans-serif">${clue[i].a}</text>`; if (clue[i].d) h += `<text x="${x + s * 0.3}" y="${y + s * 0.85}" text-anchor="middle" font-size="${s * 0.26}" fill="var(--text)" font-family="Space Grotesk, sans-serif">${clue[i].d}</text>`; }
    }
    el.innerHTML = h + '</svg>';
  }

  return { DIFFS, generate, create, art, solve, runsOf, COMBOS };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'kakuro', title: 'KAKURO',
  tagline: Kit.L('Číselná křížovka pro ty, kdo rádi počítají. Součty, kombinace a jediné správné řešení.', 'The number crossword for people who love sums. Totals, combinations and one true solution.'),
  diffs: Kakuro.DIFFS, generate: Kakuro.generate, create: Kakuro.create, art: Kakuro.art,
  online: { kind: 'race' },
  rules: Kit.L(`<p>Doplň do bílých políček číslice 1–9. Číslo v tmavém políčku udává součet úseku <b>vpravo</b> (horní číslo) nebo <b>dole</b> (spodní číslo).</p>
    <ul><li>V jednom úseku se žádná číslice nesmí opakovat.</li>
    <li>Pod mřížkou vidíš <b>kombinace</b> číslic, které dávají součet vybraného úseku. Například 3 ve dvou políčkách je vždy 1+2.</li>
    <li>Poznámky (N), nápověda (H), šipky a číslice fungují stejně jako v Sudoku.</li>
    <li>Každé kakuro má jediné řešení. Kde by bez toho nebylo, je jedna číslice doplněná předem.</li></ul>`,
    `<p>Fill the white cells with digits 1–9. A number in a dark cell is the sum of the run to its <b>right</b> (top number) or <b>below</b> (bottom number).</p>
    <ul><li>No digit may repeat within a run.</li>
    <li>Below the grid you see the <b>combinations</b> that make the selected run's sum. For example 3 in two cells is always 1+2.</li>
    <li>Notes (N), hints (H), arrows and digits work like in Sudoku.</li>
    <li>Every kakuro has exactly one solution; where it would not, one digit is given up front.</li></ul>`),
  achievements: [],
});
