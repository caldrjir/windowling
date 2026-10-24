'use strict';
// ── CLICKOMANIA · Windowling Hlavolamy ──────────────────────────────────────
// Klepni na skupinu aspoň dvou stejných sousedních krystalů: zmizí, zbytek spadne dolů
// a prázdné sloupce se přisunou doleva. Cíl: vyčistit celou plochu. Každá deska je
// ověřená řešitelem (paprskové hledání) a nese své řešení pro nápovědu.
const Clickomania = (() => {
  const L = Kit.L, E = ClickEngine;
  const DIFFS = [
    { id: 'easy', name: L('Lehké', 'Easy'), note: L('8×8 · 3 barvy', '8×8 · 3 colours'), w: 8, h: 8, k: 3, clump: 0.1, beam: 40, par: 2 * 60 },
    { id: 'medium', name: L('Střední', 'Medium'), note: L('10×10 · 4 barvy', '10×10 · 4 colours'), w: 10, h: 10, k: 4, clump: 0.15, beam: 60, par: 4 * 60 },
    { id: 'hard', name: L('Těžké', 'Hard'), note: L('14×10 · 5 barev', '14×10 · 5 colours'), w: 14, h: 10, k: 5, clump: 0.34, beam: 45, par: 6 * 60 },
    { id: 'expert', name: L('Expert', 'Expert'), note: L('16×10 · 5 barev', '16×10 · 5 colours'), w: 16, h: 10, k: 5, clump: 0.34, beam: 45, par: 9 * 60 },
  ];

  function board(D, r) {
    const { w: W, h: H, k: K } = D, g = new Int8Array(W * H);
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
      const i = x * H + y;
      g[i] = r() < D.clump && (x || y) ? (y && (!x || r() < 0.5) ? g[i - 1] : g[i - H]) : 1 + Math.floor(r() * K);
    }
    return g;
  }
  function generate(seed, diffId) {
    const D = DIFFS.find(d => d.id === diffId) || DIFFS[0], r = Kit.rng(seed);
    // deterministicky: zkoušej desky, dokud řešitel nenajde úplné vyčištění
    for (let attempt = 0; attempt < 40; attempt++) {
      const g = board(D, r), sol = E.solve(g, D.w, D.h, D.k, D.beam, r, 120000);
      if (sol) return { w: D.w, h: D.h, k: D.k, g: Array.from(g), sol };
    }
    // nouzově o barvu méně (prakticky se nestane)
    for (;;) { const D2 = { ...D, k: D.k - 1 }, g = board(D2, r), sol = E.solve(g, D.w, D.h, D2.k, D.beam, r, 120000); if (sol) return { w: D.w, h: D.h, k: D2.k, g: Array.from(g), sol }; }
  }

  // tvary krystalů (barvy jdou rozlišit i tvarem)
  const SHAPES = [
    '',
    '<circle cx="12" cy="12" r="6.5"/>',
    '<path d="M12 4.5l7.5 7.5-7.5 7.5-7.5-7.5z"/>',
    '<path d="M12 5l7.5 13h-15z"/>',
    '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
    '<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7z"/>',
  ];
  const points = n => (n - 2) * (n - 2);

  function create(el, P, saved, api) {
    const W = P.w, H = P.h, N = W * H;
    let g, ids, path, score, done = false, undos = (saved && saved.u) || 0, hintsUsed = (saved && saved.h) || 0, hist = [];
    function reset() { g = Int8Array.from(P.g); ids = new Int32Array(N); for (let i = 0; i < N; i++) ids[i] = g[i] ? i + 1 : 0; path = []; score = 0; hist = []; }
    // odebrání: stejné přeskládání pro barvy i identity kostek
    function apply(cell) {
      const cells = E.groupAt(g, W, H, cell);
      if (cells.length < 2) return null;
      hist.push({ g, ids, score });
      const lab = new Int32Array(N).fill(-1); cells.forEach(i => { lab[i] = 0; });
      const ng = new Int8Array(N), ni = new Int32Array(N); let ox = 0;
      for (let x = 0; x < W; x++) {
        let oy = 0;
        for (let y = 0; y < H; y++) { const i = x * H + y; if (g[i] && lab[i] !== 0) { ng[ox * H + oy] = g[i]; ni[ox * H + oy] = ids[i]; oy++; } }
        if (oy) ox++;
      }
      const gone = cells.map(i => ids[i]);
      g = ng; ids = ni; score += points(cells.length); path.push(cell);
      if (!E.blocks(g)) score += 1000;
      return gone;
    }
    reset();
    if (saved && Array.isArray(saved.p)) for (const c of saved.p) apply(c);

    el.innerHTML = `<div class="cm-wrap">
      <div class="cm-head"><div><small>${L('BODY', 'SCORE')}</small><b id="cmScore">0</b></div><div><small>${L('ZBÝVÁ', 'LEFT')}</small><b id="cmLeft">0</b></div><div class="cm-sel"><small>${L('SKUPINA', 'GROUP')}</small><b id="cmSel">–</b></div></div>
      <div class="cm-board" style="--w:${W};--h:${H}"><div class="cm-stuck" hidden><b>${L('Žádné další tahy', 'No more moves')}</b><span>${L('Vrať pár tahů, nebo začni znovu.', 'Undo a few moves or start over.')}</span></div></div>
      <div class="k-tools">
        <button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button>
        <button class="k-tool" data-t="restart">${api.icon('erase')}<span>${L('Znovu', 'Restart')}</span></button>
        <button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button></div></div>`;
    const bd = el.querySelector('.cm-board'), stuck = el.querySelector('.cm-stuck'), els = new Map();
    const make = (id, c) => { const b = document.createElement('div'); b.className = `cm-b c${c}`; b.innerHTML = `<svg viewBox="0 0 24 24">${SHAPES[c]}</svg>`; b.dataset.id = id; bd.appendChild(b); els.set(id, b); return b; };
    const pos = i => { const x = (i / H) | 0, y = i - x * H; return `translate(calc(${x} * var(--c)), calc(${H - 1 - y} * var(--c)))`; };
    function render(animate = true) {
      const live = new Set();
      for (let i = 0; i < N; i++) {
        if (!ids[i]) continue;
        live.add(ids[i]);
        let b = els.get(ids[i]);
        if (!b) { b = make(ids[i], g[i]); b.style.transition = 'none'; b.style.transform = pos(i); b.offsetWidth; b.style.transition = ''; }
        else { if (!animate) b.style.transition = 'none'; b.style.transform = pos(i); if (!animate) { b.offsetWidth; b.style.transition = ''; } }
        b.dataset.i = i;
      }
      for (const [id, b] of els) if (!live.has(id)) { b.remove(); els.delete(id); }
      el.querySelector('#cmScore').textContent = score.toLocaleString(api.lang === 'en' ? 'en-US' : 'cs-CZ');
      el.querySelector('#cmLeft').textContent = E.blocks(g);
      stuck.hidden = done || !E.blocks(g) || E.hasMove(g, W, H);
    }
    let hl = [];
    function highlight(cell) {
      hl.forEach(b => b.classList.remove('hl')); hl = [];
      const sel = el.querySelector('#cmSel');
      if (cell < 0 || done) { sel.textContent = '–'; return; }
      const cells = E.groupAt(g, W, H, cell);
      if (cells.length < 2) { sel.textContent = '–'; return; }
      hl = cells.map(i => els.get(ids[i])).filter(Boolean); hl.forEach(b => b.classList.add('hl'));
      sel.textContent = `${cells.length} · +${points(cells.length)}`;
    }
    function click(cell) {
      if (done) return;
      const before = new Map(); for (let i = 0; i < N; i++) if (ids[i]) before.set(ids[i], i);
      const gone = apply(cell);
      if (!gone) { api.sound('error'); return; }
      api.sound(gone.length >= 8 ? 'line' : 'place');
      // krystaly praskají, ostatní padají
      const rect = bd.getBoundingClientRect(); let cx = 0, cy = 0;
      gone.forEach(id => { const b = els.get(id); if (!b) return; const r = b.getBoundingClientRect(); cx += r.left + r.width / 2; cy += r.top + r.height / 2; b.classList.add('pop'); els.delete(id); setTimeout(() => b.remove(), 260); });
      if (gone.length >= 5 && rect.width) api.burst(cx / gone.length, cy / gone.length, Math.min(40, gone.length * 3));
      highlight(-1); render(); api.changed(); check();
    }
    function check() {
      if (E.blocks(g)) return;
      done = true; bd.classList.add('won');
      const help = undos + hintsUsed, stars = help === 0 ? 3 : help <= 3 ? 2 : 1;
      setTimeout(() => api.solved({ title: L('Plocha vyčištěna', 'Board cleared'), stars, html: `<p class="k-muted">${L(`${score.toLocaleString('cs-CZ')} bodů`, `${score.toLocaleString('en-US')} points`)}${undos ? ` · ${L(`vráceno tahů: ${undos}`, `moves undone: ${undos}`)}` : ''}</p>` }), 900);
    }
    function undo() {
      if (done || !hist.length) return;
      const h = hist.pop(); g = h.g; ids = h.ids; score = h.score; path.pop(); undos++;
      api.sound('erase'); highlight(-1); render(); api.changed();
    }
    function restart() { if (done) return; if (path.length) undos++; reset(); api.sound('erase'); highlight(-1); render(false); api.changed(); }
    function nextMove() {
      const prefix = path.every((c, i) => P.sol[i] === c);
      if (prefix && path.length < P.sol.length) return P.sol[path.length];
      const sol = E.solve(g, W, H, P.k, 40, Kit.rng(path.length + 7), 20000);
      return sol ? sol[0] : -1;
    }
    function hint() {
      if (done) return;
      const c = nextMove();
      if (c < 0) { api.toast(L('Odsud plochu vyčistit nejde. Vrať pár tahů.', "The board can't be cleared from here. Undo a few moves.")); return; }
      api.hint(); hintsUsed++; api.sound('star'); highlight(c);
      const lit = hl.slice(); lit.forEach(b => b.classList.add('hint'));
      setTimeout(() => lit.forEach(b => b.classList.remove('hint')), 1600);
    }

    const cellOf = e => { const b = e.target.closest && e.target.closest('.cm-b'); return b && !b.classList.contains('pop') ? +b.dataset.i : -1; };
    bd.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') highlight(cellOf(e)); });
    bd.addEventListener('pointerleave', () => highlight(-1));
    bd.addEventListener('click', e => { const c = cellOf(e); if (c >= 0) click(c); });
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t) return;
      if (t.dataset.t === 'undo') undo(); if (t.dataset.t === 'restart') restart(); if (t.dataset.t === 'hint') hint();
    });
    function fit() {
      const vw = (document.getElementById('kView') || el).clientWidth - 28, hh = innerHeight - 250;
      const c = Math.max(18, Math.min(Math.floor(vw / W), Math.floor(hh / H), 58));
      bd.style.setProperty('--c', c + 'px');
    }
    fit(); addEventListener('resize', fit);
    render(false);
    return {
      getState: () => ({ p: path, u: undos, h: hintsUsed }),
      progress: () => 1 - E.blocks(g) / P.g.filter(Boolean).length,
      destroy() { removeEventListener('resize', fit); },
      onKey(e) {
        if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') undo();
        if (e.key === 'r' || e.key === 'R') restart();
        if (e.key === 'h' || e.key === 'H') hint();
      },
      _solve() { reset(); for (const c of P.sol) apply(c); render(false); check(); },
      _hint: hint,
    };
  }

  function art(el) {
    const p = generate(Kit.hash('clickomania-art'), 'easy'), S = 30;
    const COL = ['', '#ff5f7e', '#ffc04d', '#3ddc97', '#5d9bff', '#c06bff'];
    let s = `<svg viewBox="0 0 ${p.w * S} ${p.h * S}">`;
    for (let x = 0; x < p.w; x++) for (let y = 0; y < p.h; y++) {
      const c = p.g[x * p.h + y]; if (!c) continue;
      s += `<rect x="${x * S + 2}" y="${(p.h - 1 - y) * S + 2}" width="${S - 4}" height="${S - 4}" rx="7" fill="${COL[c]}" opacity=".92"/><rect x="${x * S + 6}" y="${(p.h - 1 - y) * S + 5}" width="${S - 14}" height="5" rx="2.5" fill="#fff" opacity=".35"/>`;
    }
    el.innerHTML = s + '</svg>';
  }

  return { DIFFS, generate, create, art };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'clickomania', title: 'CLICKOMANIA',
  tagline: Kit.L('Klepni na skupinu stejných krystalů a nech je prasknout. Vyčisti celou plochu, každá deska to dovolí.', 'Tap a group of matching crystals and let them burst. Clear the whole board; every board can be cleared.'),
  diffs: Clickomania.DIFFS, generate: Clickomania.generate, create: Clickomania.create, art: Clickomania.art,
  online: { kind: 'race' },
  rules: Kit.L(`<p>Vyčisti celou plochu:</p>
    <ul><li>Klepni na skupinu <b>aspoň dvou</b> stejných krystalů, které spolu sousedí stranou. Skupina zmizí.</li>
    <li>Krystaly nad ní spadnou dolů a prázdné sloupce se přisunou doleva.</li>
    <li>Osamělý krystal sám zmizet nemůže, takže plánuj, aby se k němu dostaly stejné barvy.</li>
    <li>Body: skupina n krystalů dá (n − 2)², vyčištění celé plochy +1000.</li>
    <li>Každá deska jde vyčistit. Tři hvězdy za vyčištění bez vracení tahů a nápovědy. Z vrátí tah, R začne znovu, H poradí.</li></ul>`,
    `<p>Clear the whole board:</p>
    <ul><li>Tap a group of <b>two or more</b> matching crystals touching by their sides. The group disappears.</li>
    <li>Crystals above fall down and empty columns slide to the left.</li>
    <li>A lone crystal can't disappear on its own, so plan how to bring matching colours to it.</li>
    <li>Score: a group of n crystals gives (n − 2)², clearing the board +1000.</li>
    <li>Every board can be cleared. Three stars for a clear without undo or hints. Z undoes, R restarts, H gives a hint.</li></ul>`),
});
