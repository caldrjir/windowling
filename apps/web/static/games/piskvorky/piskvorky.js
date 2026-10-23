'use strict';
// ── PIŠKVORKY · Windowling Hlavolamy ────────────────────────────────────────
// Pět v řadě na desce 15×15 proti počítači (hodnocení vzorů + alfa-beta na
// nejlepších kandidátech) nebo ve dvou na jednom zařízení. Denní partie začíná
// ze stejného zahájení pro všechny.
const Piskvorky = (() => {
  const L = Kit.L;
  const N = 15, DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const DIFFS = [
    { id: 'ai1', name: L('Lehký', 'Easy'), note: L('soupeř se učí', 'a learning opponent'), par: 6 * 60 },
    { id: 'ai2', name: L('Střední', 'Medium'), note: L('hlídá trojky', 'watches threes'), par: 8 * 60 },
    { id: 'ai3', name: L('Těžký', 'Hard'), note: L('počítá dopředu', 'thinks ahead'), par: 10 * 60 },
    { id: 'duo', name: L('Dva hráči', 'Two players'), note: L('na jednom zařízení', 'on one device'), par: 10 * 60 },
  ];
  // ── Hodnocení ──
  // Pro pole a hráče spočti vzory ve 4 směrech (délka řady + otevřené konce).
  function lineInfo(g, x, y, dx, dy, p) {
    let cnt = 1, open = 0;
    for (const s of [1, -1]) {
      let k = 1, xx = x + dx * s, yy = y + dy * s;
      while (xx >= 0 && yy >= 0 && xx < N && yy < N && g[yy * N + xx] === p) { cnt++; k++; xx += dx * s; yy += dy * s; }
      if (xx >= 0 && yy >= 0 && xx < N && yy < N && g[yy * N + xx] === 0) open++;
    }
    return [cnt, open];
  }
  const SCORE = (c, o) => (c >= 5 ? 1e7 : c === 4 ? (o === 2 ? 1e6 : o === 1 ? 6e4 : 0) : c === 3 ? (o === 2 ? 3e4 : o === 1 ? 1500 : 0) : c === 2 ? (o === 2 ? 600 : o === 1 ? 80 : 0) : o ? 10 : 0);
  function cellScore(g, i, p) {
    const x = i % N, y = Math.floor(i / N); let s = 0, fours = 0, threes = 0;
    g[i] = p;
    for (const [dx, dy] of DIRS) { const [c, o] = lineInfo(g, x, y, dx, dy, p); const v = SCORE(c, o); s += v; if (c === 4 && o >= 1) fours++; if (c === 3 && o === 2) threes++; }
    g[i] = 0;
    if (fours >= 2 || (fours && threes)) s += 5e5; // dvojitá hrozba
    if (threes >= 2) s += 2e5;
    return s;
  }
  function candidates(g) {
    const out = [];
    for (let i = 0; i < N * N; i++) {
      if (g[i]) continue;
      const x = i % N, y = Math.floor(i / N); let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < N && yy < N && g[yy * N + xx]) { near = true; break; } }
      if (near) out.push(i);
    }
    return out.length ? out : [Math.floor(N * N / 2)];
  }
  function ranked(g, p, k) { return candidates(g).map(i => ({ i, s: cellScore(g, i, p) * 1.1 + cellScore(g, i, -p) })).sort((a, b) => b.s - a.s).slice(0, k); }
  function winner(g, i) { const p = g[i], x = i % N, y = Math.floor(i / N); for (const [dx, dy] of DIRS) { const [c] = lineInfo(g, x, y, dx, dy, p); if (c >= 5) return true; } return false; }
  // pole, kam když p položí, vznikne pět
  function fives(g, p) { const out = []; for (const i of candidates(g)) { g[i] = p; if (winner(g, i)) out.push(i); g[i] = 0; } return out; }
  // VCF: výhra nepřetržitými čtyřkami (soupeř musí pokaždé blokovat jediné pole)
  function vcf(g, p, depth) {
    if (depth <= 0) return -1;
    const fv = fives(g, p); if (fv.length) return fv[0];
    for (const i of candidates(g)) {
      g[i] = p;
      const x = i % N, y = Math.floor(i / N); let four = false;
      for (const [dx, dy] of DIRS) { const [c, o] = lineInfo(g, x, y, dx, dy, p); if (c === 4 && o >= 1) four = true; }
      if (!four) { g[i] = 0; continue; }
      const threats = fives(g, p);
      if (threats.length >= 2) { g[i] = 0; return i; }
      if (threats.length === 1) {
        const b = threats[0]; g[b] = -p;
        const lost = winner(g, b), ok = !lost && vcf(g, p, depth - 1) >= 0;
        g[b] = 0; if (ok) { g[i] = 0; return i; }
      }
      g[i] = 0;
    }
    return -1;
  }
  const oppMax = (g, p) => ranked(g, -p, 10).reduce((m, c) => Math.max(m, cellScore(g, c.i, -p)), 0);
  function aiMove(g, p, level, r) {
    const list = ranked(g, p, 12);
    // 1) výhra, 2) zablokuj pětku
    for (const { i } of list) { g[i] = p; const w = winner(g, i); g[i] = 0; if (w) return i; }
    for (const { i } of list) { g[i] = -p; const w = winner(g, i); g[i] = 0; if (w) return i; }
    const careless = level === 1 && r() < 0.45;
    // 3) vlastní otevřená čtyřka / dvojitá hrozba
    if (!careless) { const att = list.find(c => cellScore(g, c.i, p) >= 5e5); if (att) return att.i; }
    // 4) soupeř hrozí otevřenou čtyřkou nebo dvojitou hrozbou: braň tak, aby mu zbylo co nejméně
    if (!careless && oppMax(g, p) >= 5e5) {
      let best = list[0].i, bv = Infinity;
      for (const { i } of list) { g[i] = p; const v = oppMax(g, p) - cellScore(g, i, p) * 0.01; g[i] = 0; if (v < bv) { bv = v; best = i; } }
      return best;
    }
    if (level === 1) { const k = Math.min(list.length, 5); return r() < 0.35 ? list[Math.floor(r() * k)].i : list[0].i; }
    if (level === 2) return r() < 0.12 && list.length > 1 ? list[1].i : list[0].i;
    // 3+) vynucená výhra čtyřkami
    const win = vcf(g, p, level >= 4 ? 10 : 6); if (win >= 0) return win;
    if (level >= 4) { // nepouštěj soupeře k jeho vynucené výhře
      for (const { i } of list.slice(0, 6)) { g[i] = p; const danger = vcf(g, -p, 6) >= 0; g[i] = 0; if (!danger) return i; }
    }
    return list[0].i;
  }

  function generate(seed, diffId, ctx = {}) {
    const r = Kit.rng(seed);
    if (ctx.kind === 'online') return { level: 0, you: 1, opening: [], online: true };
    let level = { ai1: 1, ai2: 2, ai3: 3 }[diffId] || 0, you = r() < 0.5 ? 1 : -1, opening = [];
    if (ctx.kind === 'daily') { level = 2 + (r() < 0.4 ? 1 : 0); you = 1; const c = 7; const sx = Math.floor(r() * 3) - 1, sy = Math.floor(r() * 3) - 1, flip = r() < 0.5 ? 1 : -1; opening = [[0, 0, 1], [1, -1, -1], [1, 1, 1], [2, 0, -1]].map(([dx, dy, p]) => [(c + sy + dy * flip) * N + c + sx + dx, p]); }
    if (ctx.kind === 'level') { const n = ctx.key, ch = Math.floor((n - 1) / 20); level = [1, 1, 2, 2, 3, 4][ch] + (n % 20 > 14 && ch < 5 ? 1 : 0); you = n % 3 === 0 ? -1 : 1; }
    if (diffId === 'duo' && ctx.kind !== 'daily' && ctx.kind !== 'level') level = 0;
    return { level, you, opening };
  }

  function create(el, P, saved, api, opts = {}) {
    const net = P.online ? opts.net : null, online = !!net;
    if (online) P = Object.assign({}, P, { you: net.side });
    const duo = !P.level && !online, r = Kit.rng(Math.floor(Math.random() * 1e9));
    let g = new Array(N * N).fill(0), turn = 1, last = -1, done = false, hist = [], winLine = [];
    for (const [i, p] of P.opening || []) g[i] = p;
    if (saved && saved.g) { g = saved.g.slice(); turn = saved.turn; last = saved.last; hist = saved.hist || []; }
    else if ((P.opening || []).length) turn = P.opening.length % 2 ? -1 : 1;
    el.innerHTML = `<div class="gm-wrap"><div class="gm-status"></div><div class="gm-board" style="--n:${N}"></div>
      <div class="k-tools">${online ? '' : `<button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button><button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button>`}${duo ? '' : `<button class="k-tool" data-t="resign">${api.icon('x')}<span>${L('Vzdát', 'Resign')}</span></button>`}</div></div>`;
    const board = el.querySelector('.gm-board'), status = el.querySelector('.gm-status');
    board.innerHTML = g.map((_, i) => `<button class="gm-c" data-i="${i}"></button>`).join('');
    const cells = [...board.children];
    const sym = p => (p > 0 ? '<i class="gm-x"></i>' : '<i class="gm-o"></i>');
    function render() {
      cells.forEach((c, i) => { c.innerHTML = g[i] ? sym(g[i]) : ''; c.classList.toggle('last', i === last); c.classList.toggle('win', winLine.includes(i)); });
      const who = turn > 0 ? L('Hvězda', 'Star') : L('Planeta', 'Planet');
      status.innerHTML = duo ? `<b>${L('Na tahu', 'To move')}: ${sym(turn)} ${who}</b>` : `<b>${turn === P.you ? L('Jsi na tahu', 'Your move') : online ? L('Táhne soupeř', 'Opponent to move') : L('Soupeř přemýšlí…', 'Opponent is thinking…')}</b><span>${L('Hraješ za', 'You play')} ${sym(P.you)}${online ? '' : ` · ${L('úroveň soupeře', 'opponent level')} ${P.level}`}</span>`;
    }
    function lineOf(i) { const p = g[i], x = i % N, y = Math.floor(i / N); for (const [dx, dy] of DIRS) { const out = [i]; for (const s of [1, -1]) { let xx = x + dx * s, yy = y + dy * s; while (xx >= 0 && yy >= 0 && xx < N && yy < N && g[yy * N + xx] === p) { out.push(yy * N + xx); xx += dx * s; yy += dy * s; } } if (out.length >= 5) return out; } return []; }
    function place(i, byHuman) {
      g[i] = turn; last = i; hist.push(i); api.sound(turn > 0 ? 'place' : 'tap');
      if (online && byHuman) net.send(String(i));
      if (winner(g, i)) { winLine = lineOf(i); done = true; render(); finish(turn); return; }
      if (g.every(Boolean)) { done = true; render(); finish(0); return; }
      turn = -turn; render(); api.changed();
      if (!duo && !online && turn !== P.you) setTimeout(ai, 350);
    }
    if (online) net.onMove = s => { const i = +s; if (!done && i >= 0 && i < N * N && !g[i]) place(i, false); };
    function ai() { if (done) return; const i = aiMove(g, turn, P.level, r); place(i); }
    function finish(w) {
      const mv = Math.ceil(hist.length / 2);
      if (online) { net.end(w, w ? 'five' : 'full'); return; }
      setTimeout(() => {
        if (duo) { api.solved({ title: w ? (w > 0 ? L('Vyhrála hvězda', 'Star wins') : L('Vyhrála planeta', 'Planet wins')) : L('Remíza', 'Draw'), html: `<p class="k-muted">${L(`Tahy: ${mv}`, `Moves: ${mv}`)}</p>` }); return; }
        if (w === P.you) api.solved({ title: L('Pět v řadě!', 'Five in a row!'), stars: api.kind === 'level' ? (mv <= 15 ? 3 : mv <= 25 ? 2 : 1) : undefined, html: `<p class="k-muted">${L(`Tahy: ${mv} · úroveň ${P.level}`, `Moves: ${mv} · level ${P.level}`)}</p>` });
        else api.failed({ title: w ? L('Soupeř má pět', 'The opponent made five') : L('Remíza', 'Draw') });
      }, 900);
    }
    board.addEventListener('click', e => {
      const c = e.target.closest('.gm-c'); if (!c || done) return;
      const i = +c.dataset.i; if (g[i]) return;
      if (!duo && turn !== P.you) return;
      place(i, true);
    });
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t || done) return;
      if (t.dataset.t === 'undo') { const back = duo ? 1 : 2; for (let k = 0; k < back && hist.length; k++) { g[hist.pop()] = 0; turn = -turn; } last = hist[hist.length - 1] ?? -1; api.hint(); api.sound('erase'); render(); api.changed(); }
      if (t.dataset.t === 'hint') { const i = aiMove(g.slice(), turn, 3, r); api.hint(); cells[i].classList.add('hint'); setTimeout(() => cells[i].classList.remove('hint'), 1600); }
      if (t.dataset.t === 'resign') { done = true; if (online) net.resign(); else api.failed({ title: L('Vzdáno', 'Resigned') }); }
    });
    function fit() { const vw = (document.getElementById('kView') || el).clientWidth - 28, s = Math.max(270, Math.min(vw, innerHeight - 230, 640)); board.style.width = board.style.height = s + 'px'; }
    fit(); addEventListener('resize', fit); render();
    if (online) for (const s of net.moves) { const i = +s; if (g[i]) continue; g[i] = turn; last = i; hist.push(i); if (winner(g, i)) { winLine = lineOf(i); done = true; } turn = -turn; }
    if (online) render();
    if (!duo && !online && turn !== P.you && !done) setTimeout(ai, 500);
    return {
      getState: () => (done ? null : { g, turn, last, hist }),
      destroy() { removeEventListener('resize', fit); done = true; },
      onKey(e) { if (e.key === 'h' || e.key === 'H') el.querySelector('[data-t="hint"]').click(); },
      _solve() { done = true; api.solved({ title: L('Pět v řadě!', 'Five in a row!') }); },
    };
  }
  function art(el) {
    const pts = [[3, 3, 1], [4, 4, 1], [5, 5, 1], [6, 6, 1], [4, 3, -1], [5, 4, -1], [3, 5, -1], [6, 4, -1], [2, 2, 1]];
    let h = '<div class="gm-art">'; for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const p = pts.find(q => q[0] === x && q[1] === y); h += `<span>${p ? (p[2] > 0 ? '<i class="gm-x"></i>' : '<i class="gm-o"></i>') : ''}</span>`; }
    el.innerHTML = h + '</div>';
  }
  return { DIFFS, generate, create, art, aiMove, winner };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'piskvorky', title: 'PIŠKVORKY',
  tagline: Kit.L('Pět v řadě: hvězdy proti planetám. Soupeř ve čtyřech silách, denní partie a hra ve dvou.', 'Five in a row: stars against planets. An opponent at four strengths, a daily game and two-player mode.'),
  diffs: Piskvorky.DIFFS, generate: Piskvorky.generate, create: Piskvorky.create, art: Piskvorky.art,
  online: { kind: 'turn' },
  dailyDiff: () => 'ai2', levelDiff: n => ['ai1', 'ai1', 'ai2', 'ai2', 'ai3', 'ai3'][Math.floor((n - 1) / 20)],
  rules: Kit.L(`<p>Hráči se střídají v pokládání svých symbolů na desku 15×15. Vyhrává, kdo jako první vytvoří <b>nepřerušenou řadu pěti</b> (nebo víc) vodorovně, svisle nebo šikmo.</p>
    <ul><li>Hlídej soupeřovy <b>otevřené trojky</b> a <b>čtyřky</b>. Čtyřka s volnými konci už se ubránit nedá.</li>
    <li>Nejsilnější tah vytvoří dvě hrozby najednou.</li>
    <li><b>Denní partie</b> začíná ze stejného zahájení pro všechny.</li>
    <li>Na <b>Cestě</b> roste síla soupeře; občas začíná on. Tři hvězdy za výhru do 15 tahů.</li>
    <li><b>Online:</b> partie s živým soupeřem přes kód nebo odkaz. Kdo začíná, se po každé partii střídá.</li></ul>`,
    `<p>Players take turns placing their symbol on a 15×15 board. The first to make an <b>unbroken line of five</b> (or more) horizontally, vertically or diagonally wins.</p>
    <ul><li>Watch the opponent's <b>open threes</b> and <b>fours</b>. An open four cannot be stopped.</li>
    <li>The strongest move makes two threats at once.</li>
    <li>The <b>daily game</b> starts from the same opening for everyone.</li>
    <li>On the <b>Path</b> the opponent grows stronger and sometimes moves first. Three stars for a win within 15 moves.</li>
    <li><b>Online:</b> play a live opponent via a code or link. Who starts alternates after every game.</li></ul>`),
  achievements: [],
});
