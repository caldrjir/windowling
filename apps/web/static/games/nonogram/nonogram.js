'use strict';
// ── NONOGRAMY · Windowling Hlavolamy ────────────────────────────────────────
// Malované křížovky: čísla u řádků a sloupců říkají, jak dlouhé úseky jsou vybarvené.
// Obrázky jsou generované „hvězdné bytosti“ (souměrné jako vesmírné sprity). Řešitel po
// řádcích ověří, že jdou vyřešit logikou; kde by bylo nutné hádat, odkryje políčko předem.
const Nonogram = (() => {
  const L = Kit.L;
  const DIFFS = [
    { id: 'small', name: L('Lehké', 'Easy'), note: '8×8', n: 8, par: 3 * 60 },
    { id: 'medium', name: L('Střední', 'Medium'), note: '10×10', n: 10, par: 6 * 60 },
    { id: 'large', name: L('Těžké', 'Hard'), note: '15×15', n: 15, par: 14 * 60 },
    { id: 'huge', name: L('Expert', 'Expert'), note: '20×20', n: 20, par: 26 * 60 },
  ];

  // ── Řešení jednoho řádku: co musí být plné / prázdné (0 = ?, 1 = plné, 2 = prázdné) ──
  function solveLine(line, clues) {
    const n = line.length, k = clues.length, memo = new Map();
    const fits = (i, j) => { const len = clues[j]; if (i + len > n) return false; for (let t = i; t < i + len; t++) if (line[t] === 2) return false; return i + len === n || line[i + len] !== 1; };
    function ok(i, j) {
      const key = i * 64 + j; if (memo.has(key)) return memo.get(key);
      let r = false;
      if (j === k) { r = true; for (let t = i; t < n; t++) if (line[t] === 1) { r = false; break; } }
      else if (i < n) {
        if (line[i] !== 1 && ok(i + 1, j)) r = true;
        if (!r && fits(i, j) && ok(Math.min(n, i + clues[j] + 1), j + 1)) r = true;
      }
      memo.set(key, r); return r;
    }
    if (!ok(0, 0)) return null;
    const canF = new Uint8Array(n), canE = new Uint8Array(n), seen = new Set();
    (function mark(i, j) {
      const key = i * 64 + j; if (seen.has(key)) return; seen.add(key);
      if (j === k) { for (let t = i; t < n; t++) canE[t] = 1; return; }
      if (i >= n) return;
      if (line[i] !== 1 && ok(i + 1, j)) { canE[i] = 1; mark(i + 1, j); }
      if (fits(i, j) && ok(Math.min(n, i + clues[j] + 1), j + 1)) {
        for (let t = i; t < i + clues[j]; t++) canF[t] = 1;
        if (i + clues[j] < n) canE[i + clues[j]] = 1;
        mark(Math.min(n, i + clues[j] + 1), j + 1);
      }
    })(0, 0);
    return line.map((v, t) => (v ? v : canF[t] && !canE[t] ? 1 : canE[t] && !canF[t] ? 2 : 0));
  }
  const cluesOf = arr => { const c = []; let run = 0; for (const v of arr) { if (v) run++; else if (run) { c.push(run); run = 0; } } if (run) c.push(run); return c.length ? c : [0]; };
  const row = (g, n, r) => g.slice(r * n, r * n + n);
  const col = (g, n, c) => { const a = []; for (let r = 0; r < n; r++) a.push(g[r * n + c]); return a; };
  // Řeší po řádcích; vrací stav (0/1/2) – kde zůstane 0, logika nestačí.
  function solve(rows, cols, n, start) {
    const g = start ? start.slice() : new Array(n * n).fill(0);
    for (let changed = true; changed;) {
      changed = false;
      for (let r = 0; r < n; r++) { const s = solveLine(row(g, n, r), rows[r]); if (!s) return null; for (let c = 0; c < n; c++) if (g[r * n + c] !== s[c]) { g[r * n + c] = s[c]; changed = true; } }
      for (let c = 0; c < n; c++) { const s = solveLine(col(g, n, c), cols[c]); if (!s) return null; for (let r = 0; r < n; r++) if (g[r * n + c] !== s[r]) { g[r * n + c] = s[r]; changed = true; } }
    }
    return g;
  }

  // ── Obrázek: souměrná bytost ──
  function picture(n, r) {
    const half = Math.ceil(n / 2);
    let g = new Array(n * n).fill(0);
    const dens = 0.34 + r() * 0.14;
    for (let y = 0; y < n; y++) for (let x = 0; x < half; x++) {
      // víc hmoty uprostřed, méně na okrajích
      const cx = 1 - Math.abs((x + 0.5) / half - 1) * 0.35, cy = 1 - Math.abs((y + 0.5) / n - 0.5) * 0.9;
      const v = r() < dens * (0.55 + cx * 0.6) * (0.6 + cy * 0.6) ? 1 : 0;
      g[y * n + x] = v; g[y * n + (n - 1 - x)] = v;
    }
    for (let it = 0; it < (n >= 15 ? 1 : 2); it++) {
      const h = g.slice();
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < n && xx >= 0 && xx < n) s += g[yy * n + xx]; }
        h[y * n + x] = s >= 6 ? 1 : s <= 3 ? 0 : g[y * n + x];
      }
      g = h;
    }
    // oči / okénka pro charakter
    if (n >= 10 && r() < 0.8) { const ey = Math.floor(n * (0.3 + r() * 0.2)), ex = Math.floor(half * (0.45 + r() * 0.35)); for (const x of [ex, n - 1 - ex]) { g[ey * n + x] = 0; } }
    if (g.every(v => !v)) g[Math.floor(n * n / 2)] = 1;
    return g;
  }

  const NAMES = {
    cs: { a: ['Medúza', 'Kometa', 'Sonda', 'Hvězdoplavec', 'Krab', 'Chobotnice', 'Rejnok', 'Robot', 'Mušle', 'Strážce', 'Poutník', 'Světluška', 'Můra', 'Duch', 'Koráb', 'Lucerna', 'Sova', 'Drak', 'Brouk', 'Vážka'],
      b: ['z Orionu', 'z Andromedy', 'z Kasiopeji', 'z Lyry', 'z Pegasu', 'ze Souhvězdí Draka', 'z Labutě', 'z Velkého vozu', 'z Plejád', 'z Mlhoviny Kočičí oko', 'ze Siria', 'z Vegy', 'z Prstenců', 'z Mléčné dráhy', 'z Horizontu', 'z Polárky'] },
    en: { a: ['Jellyfish', 'Comet', 'Probe', 'Starfarer', 'Crab', 'Octopus', 'Manta', 'Robot', 'Shell', 'Warden', 'Wanderer', 'Firefly', 'Moth', 'Ghost', 'Galleon', 'Lantern', 'Owl', 'Dragon', 'Beetle', 'Dragonfly'],
      b: ['of Orion', 'of Andromeda', 'of Cassiopeia', 'of Lyra', 'of Pegasus', 'of Draco', 'of Cygnus', 'of the Great Bear', 'of the Pleiades', "of the Cat's Eye", 'of Sirius', 'of Vega', 'of the Rings', 'of the Milky Way', 'of the Horizon', 'of Polaris'] },
  };
  function nameOf(seed) { const r = Kit.rng(seed ^ 0x9e3779b9), N = NAMES[Kit.LANG] || NAMES.cs; return `${N.a[Math.floor(r() * N.a.length)]} ${N.b[Math.floor(r() * N.b.length)]}`; }
  function hues(seed) { const r = Kit.rng(seed ^ 0x51ed27); const h = Math.floor(r() * 360); return [h, (h + 40 + Math.floor(r() * 120)) % 360]; }

  function generate(seed, diffId) {
    const D = DIFFS.find(d => d.id === diffId) || DIFFS[0], n = D.n, r = Kit.rng(seed);
    let best = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const sol = picture(n, r);
      // obrázek má vyplnit plochu – žádné prázdné okraje
      let y0 = n, y1 = -1, x0 = n, x1 = -1;
      sol.forEach((v, i) => { if (v) { const y = Math.floor(i / n), x = i % n; y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); } });
      if (attempt < 10 && (y1 - y0 + 1 < n - 1 || x1 - x0 + 1 < n - 1)) continue;
      const rows = [...Array(n)].map((_, i) => cluesOf(row(sol, n, i))), cols = [...Array(n)].map((_, i) => cluesOf(col(sol, n, i)));
      // Kde logika nestačí, odkryj políčko předem.
      const givens = new Array(n * n).fill(0);
      let st = solve(rows, cols, n), extra = 0;
      while (st && st.includes(0)) {
        const unk = st.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
        const i = unk[Math.floor(r() * unk.length)];
        givens[i] = sol[i] ? 1 : 2; st[i] = givens[i]; extra++;
        st = solve(rows, cols, n, st);
      }
      const fill = sol.reduce((a, b) => a + b, 0) / (n * n);
      const score = extra * 10 + Math.abs(fill - 0.5) * 30;
      if (!best || score < best.score || !best.p) best = { score, p: { n, sol: sol.join(''), rows, cols, givens: givens.join(''), name: nameOf(seed), hue: hues(seed), seed } };
      if (extra === 0 && fill > 0.38 && fill < 0.62) break;
    }
    return best.p;
  }

  // ── Hrací plocha ──
  function create(el, P, saved, api) {
    const n = P.n, sol = [...P.sol].map(Number), giv = [...P.givens].map(Number);
    let st = saved && saved.st ? saved.st.slice() : giv.slice(); // 0 nic, 1 plné, 2 křížek
    let mode = 1, undo = [], done = false;
    const depthR = Math.max(...P.rows.map(c => c.length)), depthC = Math.max(...P.cols.map(c => c.length));
    el.innerHTML = `<div class="ng-wrap"><div class="ng-board"></div>
      <div class="k-tools">
        <button class="k-tool on" data-t="fill">${'<span class="ng-sw f"></span>'}<span>${L('Vybarvit', 'Fill')}</span></button>
        <button class="k-tool" data-t="cross">${api.icon('x')}<span>${L('Křížek', 'Cross')}</span></button>
        <button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button>
        <button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button>
      </div></div>`;
    const board = el.querySelector('.ng-board');
    board.style.setProperty('--n', n); board.style.setProperty('--dr', depthR); board.style.setProperty('--dc', depthC);
    let html = `<div class="ng-corner"></div><div class="ng-cols">${P.cols.map((c, i) => `<div class="ng-cl ${i % 5 === 4 && i < n - 1 ? 'b5' : ''}" data-c="${i}">${c.map(v => `<i>${v}</i>`).join('')}</div>`).join('')}</div>`;
    html += `<div class="ng-rows">${P.rows.map((c, i) => `<div class="ng-rl ${i % 5 === 4 && i < n - 1 ? 'b5' : ''}" data-r="${i}">${c.map(v => `<i>${v}</i>`).join('')}</div>`).join('')}</div>`;
    html += `<div class="ng-grid">${sol.map((_, i) => `<div class="ng-c ${(i % n) % 5 === 4 && i % n < n - 1 ? 'br5' : ''} ${Math.floor(i / n) % 5 === 4 && Math.floor(i / n) < n - 1 ? 'bb5' : ''}" data-i="${i}"></div>`).join('')}</div>`;
    board.innerHTML = html;
    const cells = [...board.querySelectorAll('.ng-c')], rl = [...board.querySelectorAll('.ng-rl')], cl = [...board.querySelectorAll('.ng-cl')];

    function lineDone(idx) { return idx.every(i => (sol[i] === 1) === (st[i] === 1)); }
    function render() {
      cells.forEach((c, i) => { c.className = c.className.replace(/ (f|x|bad|giv)\b/g, ''); if (st[i] === 1) c.classList.add('f'); if (st[i] === 2) c.classList.add('x'); if (st[i] === 2 && sol[i] === 1) c.classList.add('bad'); if (giv[i]) c.classList.add('giv'); });
      for (let r = 0; r < n; r++) rl[r].classList.toggle('ok', lineDone([...Array(n)].map((_, c) => r * n + c)));
      for (let c = 0; c < n; c++) cl[c].classList.toggle('ok', lineDone([...Array(n)].map((_, r) => r * n + c)));
      el.querySelector('[data-t="fill"]').classList.toggle('on', mode === 1);
      el.querySelector('[data-t="cross"]').classList.toggle('on', mode === 2);
    }
    function autoCross(i) {
      const r = Math.floor(i / n), c = i % n;
      for (const idx of [[...Array(n)].map((_, k) => r * n + k), [...Array(n)].map((_, k) => k * n + c)]) {
        if (lineDone(idx)) { let any = false; for (const j of idx) if (!st[j]) { st[j] = 2; any = true; } if (any) api.sound('line'); }
      }
    }
    // Tah: první políčko určí akci (vybarvit / smazat), zbytek tahu ji opakuje v jedné linii.
    let drag = null;
    function apply(i) {
      if (done || giv[i] || !drag) return;
      const want = drag.act;
      if (st[i] === want || (want === 0 && !st[i])) return;
      if (want !== 0 && st[i] !== 0 && st[i] !== want) return; // nepřepisuj opačnou značku
      if (want === 1 && sol[i] !== 1) { st[i] = 2; api.mistake(); cells[i].classList.add('shake'); setTimeout(() => cells[i].classList.remove('shake'), 400); render(); api.changed(); return; }
      if (want === 2 && sol[i] === 1) { st[i] = 1; api.mistake(); render(); api.changed(); check(); return; }
      st[i] = want;
      if (want === 1) { api.sound('place'); autoCross(i); } else api.sound('soft');
      render(); api.changed(); check();
    }
    const cellAt = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.classList && e.classList.contains('ng-c') ? +e.dataset.i : -1; };
    board.addEventListener('pointerdown', e => {
      const c = e.target.closest('.ng-c'); if (!c || done) return;
      e.preventDefault();
      const i = +c.dataset.i, m = e.button === 2 ? 2 : mode;
      undo.push(st.slice()); if (undo.length > 200) undo.shift();
      drag = { start: i, axis: null, act: st[i] === m ? 0 : m };
      if (drag.act === 0 && !giv[i]) { st[i] = 0; api.sound('erase'); render(); api.changed(); } else apply(i);
    });
    addEventListener('pointermove', onMove);
    function onMove(e) {
      if (!drag) return;
      let i = cellAt(e.clientX, e.clientY); if (i < 0) return;
      const r0 = Math.floor(drag.start / n), c0 = drag.start % n, r = Math.floor(i / n), c = i % n;
      if (!drag.axis && i !== drag.start) drag.axis = r === r0 ? 'r' : c === c0 ? 'c' : Math.abs(r - r0) < Math.abs(c - c0) ? 'r' : 'c';
      if (drag.axis === 'r') i = r0 * n + c; else if (drag.axis === 'c') i = r * n + c0;
      // vyplň i přeskočená políčka
      const a = drag.axis === 'r' ? c0 : r0, b = drag.axis === 'r' ? c : r;
      for (let k = Math.min(a, b); k <= Math.max(a, b); k++) {
        const j = drag.axis === 'r' ? r0 * n + k : k * n + c0;
        if (drag.act === 0) { if (st[j] && !giv[j]) { st[j] = 0; } } else apply(j);
      }
      if (drag.act === 0) { render(); api.changed(); }
    }
    const end = () => { drag = null; };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    function hint() {
      if (done) return;
      const s = solve(P.rows, P.cols, n, st.map((v, i) => (v === 1 && sol[i] ? 1 : v === 2 && !sol[i] ? 2 : 0)));
      // nejdřív políčko, které z čísel jde odvodit
      let cand = s ? s.map((v, i) => (v === 1 && st[i] !== 1 ? i : -1)).filter(i => i >= 0) : [];
      if (!cand.length) cand = sol.map((v, i) => (v && st[i] !== 1 ? i : -1)).filter(i => i >= 0);
      if (!cand.length) return;
      const i = cand[Math.floor(Math.random() * cand.length)];
      undo.push(st.slice()); st[i] = 1; api.hint(); api.sound('star'); cells[i].classList.add('pulse'); autoCross(i); render(); api.changed(); check();
    }
    function check() {
      if (!sol.every((v, i) => (v === 1) === (st[i] === 1))) return;
      done = true;
      const [h1, h2] = P.hue;
      cells.forEach((c, i) => {
        const y = Math.floor(i / n), x = i % n;
        if (sol[i]) { c.style.setProperty('--fc', `hsl(${h1 + (h2 - h1) * (y / n)}, 90%, ${58 + 10 * Math.sin(x * 0.7)}%)`); setTimeout(() => c.classList.add('win'), (x + y) * 18); }
        else setTimeout(() => c.classList.add('void'), (x + y) * 18);
      });
      board.classList.add('done');
      const gal = api.data.gallery = api.data.gallery || [];
      if (!gal.some(g => g.seed === P.seed)) { gal.push({ seed: P.seed, n, sol: toHex(sol), name: P.name, hue: P.hue, at: Date.now() }); if (gal.length > 400) gal.shift(); }
      const cv = document.createElement('canvas'); cv.width = cv.height = 240; drawCreature(cv, n, sol, P.hue);
      setTimeout(() => api.solved({ title: P.name, html: `<img class="ng-res" src="${cv.toDataURL()}" alt=""><p class="k-muted">${L('Nová bytost ve tvé sbírce', 'A new creature for your collection')}</p>` }), (n * 2) * 18 + 800);
    }
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t) return;
      const k = t.dataset.t;
      if (k === 'fill') mode = 1; if (k === 'cross') mode = 2;
      if (k === 'undo' && undo.length) { st = undo.pop(); api.sound('erase'); api.changed(); }
      if (k === 'hint') hint();
      api.sound('ui'); render();
    });
    // Velikost: vejdi se na obrazovku.
    function fit() {
      const wAvail = Math.min((document.getElementById('kView') || el).clientWidth - 28, 900) - 24, hAvail = innerHeight - 230;
      const cs = Math.max(12, Math.floor(Math.min(wAvail / (n + depthR * 0.62), hAvail / (n + depthC * 0.66))));
      board.style.setProperty('--cs', Math.min(46, cs) + 'px');
    }
    fit(); addEventListener('resize', fit);
    render();
    return {
      getState: () => ({ st }),
      progress: () => { let k = 0, n = 0; for (let i = 0; i < sol.length; i++) if (sol[i]) { n++; if (st[i] === 1) k++; } else if (st[i] === 1) k--; return n ? Math.max(0, k) / n : 1; },
      destroy() { removeEventListener('pointermove', onMove); removeEventListener('pointerup', end); removeEventListener('pointercancel', end); removeEventListener('resize', fit); },
      onKey(e) { if (e.key === 'x' || e.key === 'X') { mode = mode === 1 ? 2 : 1; render(); } if ((e.key === 'z' || e.key === 'Z') && undo.length) { st = undo.pop(); render(); api.changed(); } if (e.key === 'h' || e.key === 'H') hint(); },
      _solve() { st = sol.map(v => (v ? 1 : 2)); render(); check(); },
    };
  }
  const toHex = bits => { let s = ''; for (let i = 0; i < bits.length; i += 4) s += ((bits[i] << 3) | ((bits[i + 1] || 0) << 2) | ((bits[i + 2] || 0) << 1) | (bits[i + 3] || 0)).toString(16); return s; };
  const fromHex = (h, len) => { const a = []; for (const ch of h) { const v = parseInt(ch, 16); a.push(v >> 3 & 1, v >> 2 & 1, v >> 1 & 1, v & 1); } return a.slice(0, len); };

  function drawCreature(cv, n, bits, hue) {
    const s = cv.width, c = cv.getContext('2d'), k = s / (n + 2);
    c.clearRect(0, 0, s, s);
    for (let i = 0; i < n * n; i++) if (bits[i]) { const y = Math.floor(i / n), x = i % n; c.fillStyle = `hsl(${hue[0] + (hue[1] - hue[0]) * (y / n)}, 90%, ${58 + 10 * Math.sin(x * 0.7)}%)`; c.fillRect((x + 1) * k, (y + 1) * k, k + 0.5, k + 0.5); }
  }
  const gallery = {
    icon: 'star', name: L('Sbírka bytostí', 'Creature collection'), badge: s => ((s.data && s.data.gallery) || []).length,
    render(el, save) {
      const g = (save.data.gallery || []).slice().reverse();
      el.innerHTML = `<h2>${L('Sbírka bytostí', 'Creature collection')}</h2><p class="k-muted">${L(`Každý vyřešený nonogram přidá do sbírky jednu hvězdnou bytost. Máš jich ${g.length}.`, `Every solved nonogram adds a star creature. You have ${g.length}.`)}</p>
        <div class="ng-gal">${g.map((x, i) => `<figure><canvas width="120" height="120" data-g="${i}"></canvas><figcaption>${Kit.esc(x.name)}<small>${x.n}×${x.n}</small></figcaption></figure>`).join('') || `<p class="k-muted">${L('Zatím prázdná. Vyřeš první obrázek.', 'Empty so far. Solve your first picture.')}</p>`}</div>`;
      el.querySelectorAll('canvas[data-g]').forEach(cv => { const x = g[+cv.dataset.g]; drawCreature(cv, x.n, fromHex(x.sol, x.n * x.n), x.hue); });
    },
  };
  function art(el) {
    const p = generate(Kit.hash('art:' + Kit.dayKey()), 'medium');
    el.innerHTML = '<canvas width="260" height="260"></canvas>';
    drawCreature(el.querySelector('canvas'), p.n, [...p.sol].map(Number), p.hue);
  }

  return { DIFFS, generate, create, art, gallery, solve, solveLine, cluesOf };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'nonogram', title: 'NONOGRAMY',
  tagline: Kit.L('Malované křížovky, ze kterých se líhnou hvězdné bytosti. Každý obrázek je nový a skončí ve tvé sbírce.', 'Picture logic puzzles that hatch star creatures. Every picture is new and joins your collection.'),
  diffs: Nonogram.DIFFS, generate: Nonogram.generate, create: Nonogram.create, art: Nonogram.art, views: [Nonogram.gallery],
  online: { kind: 'race' },
  rules: Kit.L(`<p>Čísla u řádku (a sloupce) udávají délky souvislých úseků vybarvených políček v tom pořadí, v jakém jdou za sebou. Mezi úseky je vždy aspoň jedno prázdné políčko.</p>
    <ul><li>Klepni nebo táhni pro vybarvení. Režim <b>Křížek</b> (klávesa X, na počítači pravé tlačítko) označí políčko, které zůstane prázdné.</li>
    <li>Splněný řádek se ztlumí a zbytek se sám zakřížkuje.</li>
    <li>Vybarvit políčko, které má být prázdné, je chyba. Hra tě opraví.</li>
    <li>Každý obrázek jde vyřešit logikou. Kde by bylo potřeba hádat, je políčko odkryté předem.</li></ul>`,
    `<p>The numbers next to a row (and above a column) are the lengths of runs of filled cells, in order. Runs are separated by at least one empty cell.</p>
    <ul><li>Tap or drag to fill. <b>Cross</b> mode (X key, right mouse button) marks cells that stay empty.</li>
    <li>A finished line dims and the rest is crossed automatically.</li>
    <li>Filling a cell that should be empty is a mistake; the game corrects it.</li>
    <li>Every picture can be solved by logic. Where guessing would be needed, a cell is revealed up front.</li></ul>`),
  achievements: [
    { id: 'gal25', name: Kit.L('Zvěřinec', 'Menagerie'), desc: Kit.L('Sbírka 25 bytostí', 'Collect 25 creatures'), prog: s => [((s.data && s.data.gallery) || []).length, 25] },
    { id: 'gal100', name: Kit.L('Hvězdná zoo', 'Star Zoo'), desc: Kit.L('Sbírka 100 bytostí', 'Collect 100 creatures'), prog: s => [((s.data && s.data.gallery) || []).length, 100] },
  ],
});
