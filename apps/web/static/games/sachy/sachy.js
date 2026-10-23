'use strict';
// ── ŠACHY · Windowling Hlavolamy ────────────────────────────────────────────
// Partie proti počítači v několika silách, generované úlohy „mat v 1/2“ (denní úloha
// je stejná pro všechny), hra dvou hráčů na jednom zařízení. Engine v engine.js,
// výpočet tahu ve Web Workeru (ai-worker.js), když to prohlížeč umí.
const Sachy = (() => {
  const L = Kit.L, C = Chess;
  const DIFFS = [
    { id: 'ai1', name: L('Nováček', 'Novice'), note: L('soupeř se učí', 'a learning opponent'), par: 20 * 60 },
    { id: 'ai3', name: L('Hráč', 'Player'), note: L('solidní soupeř', 'a solid opponent'), par: 30 * 60 },
    { id: 'ai5', name: L('Mistr', 'Master'), note: L('přemýšlí 1,5 s', 'thinks 1.5 s'), par: 40 * 60 },
    { id: 'puzzle', name: L('Úlohy', 'Puzzles'), note: L('mat v 1–2', 'mate in 1–2'), par: 90 },
    { id: 'duo', name: L('Dva hráči', 'Two players'), note: L('na jednom zařízení', 'on one device'), par: 30 * 60 },
  ];
  const AI = { 1: { depth: 1, rand: 0.3 }, 2: { depth: 2, rand: 0.15 }, 3: { depth: 3, time: 400, rand: 0.05 }, 4: { time: 800 }, 5: { time: 1500 }, 6: { time: 2500 } };

  // ── Úlohy: náhodná „živá“ partie, dokud nevznikne pozice s matem v N ──
  function puzzle(seed, n) {
    const r = Kit.rng(seed);
    for (let attempt = 0; attempt < 400; attempt++) {
      const pos = new C.Pos(), plies = 18 + Math.floor(r() * 40);
      let ok = true;
      for (let k = 0; k < plies; k++) {
        const ms = pos.legal(); if (!ms.length) { ok = false; break; }
        // preferuj braní a šachy, ať pozice ožije
        const w = ms.map(m => 1 + (m.c ? 3 + C.VAL[Math.abs(m.c)] / 200 : 0) + (Math.abs(m.p) === C.P ? 0.5 : 0));
        let x = r() * w.reduce((a, b) => a + b, 0), pick = ms[0];
        for (let i = 0; i < ms.length; i++) { x -= w[i]; if (x <= 0) { pick = ms[i]; break; } }
        pos.make(pick);
        if (k >= 14 && k % 2 === 1 && pos.status() === null) {
          if (C.mateIn(pos, 1)) { if (n === 1) return pack(pos, 1); else break; }
          if (n === 2 && k >= 20) { const m = C.mateIn(pos, 2, true); if (m && !m.pr) return pack(pos, 2); }
        }
      }
      void ok;
    }
    return pack(new C.Pos('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'), 1);
  }
  const pack = (pos, n) => ({ fen: pos.fen(), mate: n });

  function levelSpec(k) {
    const ch = Math.floor((k - 1) / 20);
    if (k % 2) return { type: 'puzzle', mate: ch < 3 ? 1 : 2 };
    return { type: 'ai', level: Math.min(6, 1 + ch + (k % 20 > 10 ? 1 : 0)) };
  }
  function generate(seed, diffId, ctx = {}) {
    const r = Kit.rng(seed);
    if (ctx.kind === 'online') return { type: 'online' };
    if (ctx.kind === 'daily') { const wd = (new Date(`${ctx.key}T12:00:00`).getDay() + 6) % 7; return Object.assign({ type: 'puzzle' }, puzzle(seed, wd < 3 ? 1 : 2)); }
    if (ctx.kind === 'level') { const s = levelSpec(ctx.key); return s.type === 'puzzle' ? Object.assign({ type: 'puzzle' }, puzzle(seed, s.mate)) : { type: 'ai', level: s.level, color: r() < 0.5 ? 1 : -1 }; }
    if (diffId === 'puzzle') return Object.assign({ type: 'puzzle' }, puzzle(seed, r() < 0.6 ? 1 : 2));
    if (diffId === 'duo') return { type: 'duo' };
    return { type: 'ai', level: { ai1: 1, ai3: 3, ai5: 5 }[diffId] || 1, color: r() < 0.5 ? 1 : -1 };
  }

  // ── Figurky (SVG 45×45) ──
  const SHAPE = {
    1: '<path d="M22.5 9a4.5 4.5 0 0 0-3.6 7.2A6 6 0 0 0 16.5 21a6 6 0 0 0 2.3 4.7C15 27.5 12.5 31 12.5 36h20c0-5-2.5-8.5-6.3-10.3a6 6 0 0 0 2.3-4.7 6 6 0 0 0-2.4-4.8A4.5 4.5 0 0 0 22.5 9z"/>',
    2: '<path d="M14 36h19v-3c0-8-3-14-9-17l-1-4-2 3c-4 1-8 5-9 9l2 3 3-2 2 1c-3 3-5 6-5 10z"/><circle cx="17" cy="19" r="1.4" class="eye"/>',
    3: '<path d="M12 36h21v-3H12zM15.5 33c-1-6 1-11 7-17 6 6 8 11 7 17z"/><circle cx="22.5" cy="11.5" r="2.5"/><path d="M25 19l-4 5" class="cut"/>',
    4: '<path d="M11 36h23v-3H11zM14 33l1.5-3h14l1.5 3zM15.5 30V18h14v12zM13 18l2.5-2.5h14L32 18zM13 15.5V9h4v2.5h4V9h3v2.5h4V9h4v6.5z"/>',
    5: '<path d="M11 36h23v-3H11zM12 33l2-13 5 7 3.5-11 3.5 11 5-7 2 13z"/><circle cx="14" cy="18" r="2"/><circle cx="19" cy="15" r="2"/><circle cx="22.5" cy="13" r="2"/><circle cx="26" cy="15" r="2"/><circle cx="31" cy="18" r="2"/>',
    6: '<path d="M11 36h23v-3H11zM13 33c-2-7 3-11 9.5-11S34 26 32 33z"/><path d="M22.5 22v-9M19 16h7" class="cross"/>',
  };
  const piece = p => `<svg viewBox="0 0 45 45" class="pc ${p > 0 ? 'w' : 'b'}">${SHAPE[Math.abs(p)]}</svg>`;

  // Online tah: "z-kam-proměna" v číslech polí enginu.
  const enc = m => `${m.f}-${m.t}-${m.pr || 0}`;
  const dec = s => { const [f, t, pr] = s.split('-').map(Number); return { f, t, pr }; };
  function create(el, P, saved, api, opts = {}) {
    const net = P.type === 'online' ? opts.net : null, online = !!net;
    const isPuzzle = P.type === 'puzzle', duo = P.type === 'duo';
    let pos = new C.Pos(isPuzzle ? P.fen : undefined);
    const human = online ? net.side : isPuzzle ? pos.side : duo ? 0 : P.color;
    const flip = online ? net.side < 0 : isPuzzle ? pos.side < 0 : !duo && P.color < 0;
    let sel = 0, lastMove = null, done = false, thinking = false, moves = [], mistakes = 0;
    if (online) saved = { moves: net.moves.map(dec) };
    if (saved && saved.moves) { for (const u of saved.moves) { const m = pos.legal().find(x => x.f === u.f && x.t === u.t && (x.pr || 0) === (u.pr || 0)); if (m) { moves.push({ ...u, san: pos.san(m) }); pos.make(m); lastMove = m; } } }
    el.innerHTML = `<div class="ch-wrap"><div class="ch-side"><div class="ch-status"></div><div class="ch-moves"></div></div>
      <div class="ch-board"></div>
      <div class="k-tools">${online ? '' : `<button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button><button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button>`}${isPuzzle ? '' : `<button class="k-tool" data-t="resign">${api.icon('x')}<span>${L('Vzdát', 'Resign')}</span></button>`}</div></div>`;
    const boardEl = el.querySelector('.ch-board'), statusEl = el.querySelector('.ch-status'), movesEl = el.querySelector('.ch-moves');
    const squares = [];
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const f = flip ? 7 - col : col, rk = flip ? row : 7 - row, s = C.sq(f, rk);
      const d = document.createElement('button'); d.className = 'ch-sq ' + ((f + rk) % 2 ? 'l' : 'd'); d.dataset.s = s;
      if (col === 0) d.dataset.rank = rk + 1; if (row === 7) d.dataset.file = 'abcdefgh'[f];
      boardEl.appendChild(d); squares[s] = d;
    }
    function render() {
      const legal = sel ? pos.legal().filter(m => m.f === sel) : [];
      const chk = pos.inCheck() ? pos.kings[pos.side > 0 ? 0 : 1] : 0;
      for (let s = 21; s < 99; s++) {
        const d = squares[s]; if (!d) continue;
        const p = pos.b[s];
        d.innerHTML = p ? piece(p) : '';
        d.classList.toggle('sel', s === sel);
        d.classList.toggle('last', !!lastMove && (s === lastMove.f || s === lastMove.t));
        d.classList.toggle('dot', legal.some(m => m.t === s && !pos.b[s]));
        d.classList.toggle('cap', legal.some(m => m.t === s && pos.b[s]));
        d.classList.toggle('chk', s === chk);
      }
      const turn = pos.side > 0 ? L('Bílý', 'White') : L('Černý', 'Black');
      statusEl.innerHTML = isPuzzle ? `<b>${L(`Mat ${P.mate === 1 ? 'jedním tahem' : 've 2 tazích'}`, `Mate in ${P.mate}`)}</b><span>${L(`Táhne ${turn.toLowerCase()}`, `${turn} to move`)}</span>`
        : `<b>${duo ? L(`Na tahu: ${turn}`, `${turn} to move`) : pos.side === human ? L('Jsi na tahu', 'Your move') : online ? L('Táhne soupeř', 'Opponent to move') : L('Soupeř přemýšlí…', 'Opponent is thinking…')}</b><span>${duo ? L('Dva hráči', 'Two players') : online ? `${human > 0 ? L('Hraješ bílými', 'You play white') : L('Hraješ černými', 'You play black')}` : `${L('Soupeř', 'Opponent')}: ${L('úroveň', 'level')} ${P.level}`}${pos.inCheck() ? ` · ${L('ŠACH', 'CHECK')}` : ''}</span>`;
      movesEl.innerHTML = moves.reduce((h, m, i) => h + (i % 2 ? '' : `<i>${Math.floor(i / 2) + 1}.</i>`) + `<span>${m.san}</span>`, '');
      movesEl.scrollTop = movesEl.scrollHeight;
    }
    function play(m, byHuman) {
      const san = pos.san(m); pos.make(m); lastMove = m; sel = 0;
      moves.push({ f: m.f, t: m.t, pr: m.pr || 0, san });
      if (online && byHuman) net.send(enc(m));
      api.sound(m.c ? 'place' : 'tap'); if (pos.inCheck()) api.sound('line');
      render(); api.changed();
      if (end()) return;
      if (isPuzzle && byHuman) puzzleReply();
      else if (!duo && !isPuzzle && !online && pos.side !== human) aiMove();
    }
    if (online) net.onMove = s => { if (done) return; const u = dec(s), m = pos.legal().find(x => x.f === u.f && x.t === u.t && (x.pr || 0) === u.pr); if (m) play(m, false); };
    function end() {
      const st = pos.status(); if (!st) return false;
      done = true; render();
      const plies = moves.length, mated = st === 'mate', winnerSide = -pos.side;
      if (online) { net.end(mated ? winnerSide : 0, st); return true; }
      setTimeout(() => {
        if (isPuzzle) { if (mated) api.solved({ title: L('Mat!', 'Checkmate!') }); return; }
        if (duo) { api.solved({ title: mated ? (winnerSide > 0 ? L('Vyhrál bílý', 'White wins') : L('Vyhrál černý', 'Black wins')) : L('Remíza', 'Draw'), html: `<p class="k-muted">${L(`Tahy: ${Math.ceil(plies / 2)}`, `Moves: ${Math.ceil(plies / 2)}`)}</p>` }); return; }
        if (mated && winnerSide === human) { const mv = Math.ceil(plies / 2); api.solved({ title: L('Mat! Vyhrál(a) jsi', 'Checkmate! You win'), stars: api.kind === 'level' ? (mv <= 35 && !mistakes ? 3 : mv <= 55 ? 2 : 1) : undefined, html: `<p class="k-muted">${L(`Tahy: ${mv} · úroveň soupeře ${P.level}`, `Moves: ${mv} · opponent level ${P.level}`)}</p>` }); }
        else api.failed({ title: mated ? L('Prohra', 'You lost') : L('Remíza', 'Draw'), html: `<p class="k-muted">${{ stalemate: L('Pat', 'Stalemate'), draw50: L('Pravidlo 50 tahů', '50-move rule'), rep: L('Trojí opakování', 'Threefold repetition'), material: L('Nedostatek materiálu', 'Insufficient material'), mate: L('Mat', 'Checkmate') }[st]}</p>` });
      }, 700);
      return true;
    }
    // ── soupeř ──
    let worker = null, reqId = 0;
    if (!online) try { worker = new Worker('ai-worker.js'); worker.onerror = () => { worker = null; }; } catch (e) { worker = null; }
    function aiMove() {
      if (done) return; thinking = true; render();
      const cfg = AI[P.level] || AI[1], id = ++reqId;
      const finish = mv => {
        if (id !== reqId || done) return; thinking = false;
        let m = mv && pos.legal().find(x => x.f === mv.f && x.t === mv.t && (x.pr || 0) === (mv.pr || 0));
        if (cfg.rand && Math.random() < cfg.rand) { const l = pos.legal(); m = l[Math.floor(Math.random() * l.length)]; }
        if (!m) m = pos.legal()[0];
        if (m) setTimeout(() => play(m, false), 250);
      };
      const opt = { depth: cfg.depth, time: cfg.time || 2000 };
      if (worker) { worker.onmessage = e => finish(e.data.move); worker.postMessage({ id, fen: pos.fen(), keys: pos.keys, opt }); }
      else setTimeout(() => { const res = C.search(pos, opt); finish(res && res.move); }, 30);
    }
    function puzzleReply() {
      // první tah hráče musí zachovat vynucený mat; obránce hraje nejlepší obranu
      if (pos.status()) return;
      const left = P.mate - Math.ceil(moves.length / 2);
      if (left <= 0) return wrong();
      const replies = pos.legal();
      let best = null;
      for (const r of replies) { pos.make(r); const m1 = C.mateIn(pos, left); pos.unmake(); if (!m1) return wrong(); best = best || r; }
      setTimeout(() => play(best || replies[0], false), 450);
    }
    function wrong() {
      // vrať tah hráče zpět
      mistakes++; api.mistake(); api.toast(L('To nevede k matu. Zkus jiný tah.', 'That does not lead to mate. Try another move.'));
      setTimeout(() => { pos.unmake(); moves.pop(); lastMove = null; done = false; render(); api.changed(); }, 500);
    }
    function tap(s) {
      if (done || thinking) return;
      if (!duo && pos.side !== human) return;
      const p = pos.b[s];
      if (sel) {
        const m = pos.legal().filter(x => x.f === sel && x.t === s);
        if (m.length) { play(m.find(x => !x.pr || Math.abs(x.pr) === C.Q) || m[0], true); return; }
      }
      if (p && Math.sign(p) === pos.side) { sel = s === sel ? 0 : s; api.sound('soft'); } else sel = 0;
      render();
    }
    // klepnutí i tah myší/prstem
    let dragFrom = 0;
    boardEl.addEventListener('pointerdown', e => { const d = e.target.closest('.ch-sq'); if (!d) return; const s = +d.dataset.s; dragFrom = pos.b[s] && Math.sign(pos.b[s]) === pos.side ? s : 0; tap(s); });
    boardEl.addEventListener('pointerup', e => {
      if (!dragFrom) return; const el2 = document.elementFromPoint(e.clientX, e.clientY), d = el2 && el2.closest && el2.closest('.ch-sq');
      if (d && +d.dataset.s !== dragFrom && sel === dragFrom) tap(+d.dataset.s); dragFrom = 0;
    });
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t || done) return;
      if (t.dataset.t === 'undo') {
        if (thinking) return;
        const back = duo || isPuzzle ? 1 : 2;
        for (let i = 0; i < back && moves.length; i++) { pos.unmake(); moves.pop(); }
        lastMove = null; sel = 0; api.hint(); api.sound('erase'); render(); api.changed();
      }
      if (t.dataset.t === 'hint') {
        if (thinking) return;
        let m = null;
        if (isPuzzle) m = C.mateIn(pos, P.mate - Math.floor(moves.length / 2), true) || C.mateIn(pos, P.mate - Math.floor(moves.length / 2));
        if (!m || m === true) { const res = C.search(pos, { time: 500 }); m = res && res.move; }
        if (m) { api.hint(); squares[m.f].classList.add('hint'); squares[m.t].classList.add('hint'); setTimeout(() => { squares[m.f].classList.remove('hint'); squares[m.t].classList.remove('hint'); }, 1600); }
      }
      if (t.dataset.t === 'resign') { done = true; if (online) net.resign(); else api.failed({ title: L('Vzdáno', 'Resigned') }); }
    });
    function fit() { const vw = (document.getElementById('kView') || el).clientWidth - 28, wide = innerWidth > 860, s = Math.max(260, Math.min(wide ? vw - 300 : vw, innerHeight - (wide ? 130 : 300), 640)); boardEl.style.width = boardEl.style.height = s + 'px'; }
    fit(); addEventListener('resize', fit); render();
    if (!isPuzzle && !duo && !online && pos.side !== human && !done) setTimeout(aiMove, 400);
    return {
      getState: () => (done ? null : { moves: moves.map(m => ({ f: m.f, t: m.t, pr: m.pr })) }),
      destroy() { removeEventListener('resize', fit); if (worker) worker.terminate(); reqId++; },
      onKey(e) { if (e.key === 'h' || e.key === 'H') el.querySelector('[data-t="hint"]').click(); },
      _solve() { done = true; api.solved({ title: L('Mat!', 'Checkmate!') }); },
    };
  }

  function art(el) {
    const pos = new C.Pos('r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1');
    let h = '<div class="ch-art">';
    for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) { const p = pos.b[C.sq(f, r)]; h += `<div class="ch-sq ${(f + r) % 2 ? 'l' : 'd'}">${p ? piece(p) : ''}</div>`; }
    el.innerHTML = h + '</div>';
  }
  return { DIFFS, generate, create, art, puzzle, levelSpec };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'sachy', title: 'ŠACHY',
  tagline: Kit.L('Šachy proti počítači v šesti silách, denní úloha mat v 1–2 tazích a partie ve dvou na jednom zařízení.', 'Chess against the computer at six strengths, a daily mate-in-1–2 puzzle and two-player games on one device.'),
  diffs: Sachy.DIFFS, generate: Sachy.generate, create: Sachy.create, art: Sachy.art,
  online: { kind: 'turn' },
  dailyDiff: () => 'puzzle', levelDiff: n => (Sachy.levelSpec(n).type === 'puzzle' ? 'puzzle' : ['ai1', 'ai1', 'ai3', 'ai3', 'ai5', 'ai5'][Math.floor((n - 1) / 20)]),
  rules: Kit.L(`<p>Klasické šachy se všemi pravidly: rošáda, braní mimochodem, proměna pěšce (automaticky na dámu), pat, trojí opakování a pravidlo 50 tahů.</p>
    <ul><li>Klepni na figurku a pak na cílové pole, nebo figurku přetáhni. Tečky ukazují možné tahy.</li>
    <li><b>Úlohy:</b> najdi mat v 1 nebo 2 tazích. Špatný tah se vrátí a počítá se jako chyba.</li>
    <li><b>Denní úloha</b> je pro všechny stejná: v pondělí až středu mat jedním tahem, od čtvrtka ve dvou.</li>
    <li>Na <b>Cestě</b> se střídají úlohy a partie proti stále silnějšímu soupeři. Tři hvězdy za výhru do 35 tahů bez vracení.</li>
    <li><b>Online:</b> založ hru a pošli kód nebo odkaz kamarádovi, nebo se přidej k otevřené hře. Barvy se po každé partii střídají, remízu lze nabídnout.</li></ul>`,
    `<p>Classic chess with every rule: castling, en passant, promotion (automatically to a queen), stalemate, threefold repetition and the 50-move rule.</p>
    <ul><li>Tap a piece and then a square, or drag the piece. Dots show the legal moves.</li>
    <li><b>Puzzles:</b> find mate in 1 or 2. A wrong move is taken back and counts as a mistake.</li>
    <li>The <b>daily puzzle</b> is the same for everyone: mate in one Monday to Wednesday, in two from Thursday.</li>
    <li>The <b>Path</b> alternates puzzles and games against an ever stronger opponent. Three stars for a win within 35 moves without undo.</li>
    <li><b>Online:</b> create a game and send the code or link to a friend, or join an open game. Colours swap after every game and a draw can be offered.</li></ul>`),
  achievements: [],
});
