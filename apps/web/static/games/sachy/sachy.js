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
    // pěšec
    1: '<path class="bd" d="M22.5 7.5a4.6 4.6 0 0 0-3 8.1c-2 1.1-3.3 3-3.3 5 0 1.5.7 2.9 1.8 3.8-3.4 1.6-6.2 5-6.6 10.6h22.2c-.4-5.6-3.2-9-6.6-10.6 1.1-.9 1.8-2.3 1.8-3.8 0-2-1.3-3.9-3.3-5a4.6 4.6 0 0 0-3-8.1z"/><path class="bd" d="M10.5 35h24v4h-24z"/><path class="hl" d="M20 10.5a2.6 2.6 0 0 1 2.5-1.2M15.6 31c.6-2.6 2-4.4 3.8-5.4"/>',
    // věž
    4: '<path class="bd" d="M9.5 39h26v-3.5h-26zM12 35.5l1.5-3.5h18l1.5 3.5zM14.5 32l1-14h14l1 14zM12.5 18l2-3h16l2 3zM12.5 15V8.5h4.2v2.8h3.5V8.5h4.6v2.8h3.5V8.5h4.2V15z"/><path class="hl" d="M15 18h15M14.5 32h16M17 21l-.5 9"/>',
    // jezdec
    2: '<path class="bd" d="M13 39h21.5c.3-8.3-1-14.6-4-19.4-1.3-2.1-2-3.9-2.3-5.9l1.2-4.4-3.6 2-1.3-3.8-2.1 3.7C16.6 12.4 13.2 15 11 19c-1.6 2.9-2.4 5.4-1.5 7 .9 1.4 2.8 1.3 4.6.2 1.6-1 3.4-1.8 5.4-1.6-.6 2.8-2.5 5-4.3 7.2-1.6 1.9-2.4 4.2-2.2 7.2z"/><circle class="e" cx="17.3" cy="16.6" r="1.4"/><path class="hl" d="M24.5 12.5c3 2.6 5 7 6 12.5M11.6 24.6l1.3-.6"/>',
    // střelec
    3: '<path class="bd" d="M10.5 39h24v-3.5h-24zM13.5 35.5c1.3-1.4 2.2-2.6 2.4-4.4h13.2c.2 1.8 1.1 3 2.4 4.4zM15.8 31.1c-3.2-3.9-3.2-10 6.7-17.4 9.9 7.4 9.9 13.5 6.7 17.4z"/><circle class="bd" cx="22.5" cy="10.5" r="2.6"/><path class="cut" d="M25.6 17.6l-4.6 5.6M17.5 28h10"/>',
    // dáma
    5: '<path class="bd" d="M10.5 39h24v-3.5h-24zM12.5 35.5l2-4h16l2 4zM14.5 31.5c.1-4.6-2.4-10.6-5-16.2l6.6 6.4 2.4-10 4 9.6 4-9.6 2.4 10 6.6-6.4c-2.6 5.6-5.1 11.6-5 16.2z"/><circle class="bd" cx="9.2" cy="14" r="2.3"/><circle class="bd" cx="15.9" cy="10.4" r="2.3"/><circle class="bd" cx="22.5" cy="9" r="2.3"/><circle class="bd" cx="29.1" cy="10.4" r="2.3"/><circle class="bd" cx="35.8" cy="14" r="2.3"/><path class="hl" d="M15 31.5h15M15.5 27c4.6-1.4 9.4-1.4 14 0"/>',
    // král
    6: '<path class="bd" d="M10.5 39h24v-3.5h-24zM12.5 35.5l2-4h16l2 4zM14.5 31.5c-1.4-3.6-4.6-6.4-4.6-10.6 0-3.6 3-5.8 6.4-5.8 2.6 0 4.6 1.4 6.2 3.6 1.6-2.2 3.6-3.6 6.2-3.6 3.4 0 6.4 2.2 6.4 5.8 0 4.2-3.2 7-4.6 10.6z"/><path class="cross" d="M22.5 18.5V7M18.5 10.5h8"/><path class="hl" d="M15 31.5h15M15.5 27c4.6-1.4 9.4-1.4 14 0M22.5 18.5v7"/>',
  };
  const piece = p => `<svg viewBox="0 0 45 45" class="pc ${p > 0 ? 'w' : 'bk'}">${SHAPE[Math.abs(p)]}</svg>`;

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
    el.innerHTML = `<div class="ch-wrap"><div class="ch-side"><div class="ch-status"></div><div class="ch-cap"><div data-c="1"></div><div data-c="-1"></div></div><div class="ch-moves"></div></div>
      <div class="ch-frame"><div class="ch-board"></div><div class="ch-promo" hidden></div></div>
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
      // sebrané figurky a materiální převaha
      const INIT = [0, 8, 2, 2, 2, 1, 1], VALUE = [0, 1, 3, 3, 5, 9, 0], have = { 1: [0, 0, 0, 0, 0, 0, 0], '-1': [0, 0, 0, 0, 0, 0, 0] };
      for (let s2 = 21; s2 < 99; s2++) { const q = pos.b[s2]; if (q && q !== C.OFF && Math.abs(q) <= 6) have[Math.sign(q)][Math.abs(q)]++; }
      let mat = 0; for (let k = 1; k <= 5; k++) mat += (have[1][k] - have[-1][k]) * VALUE[k];
      for (const side of [1, -1]) {
        let h = ''; for (const k of [5, 4, 3, 2, 1]) for (let i = 0; i < Math.max(0, INIT[k] - have[-side][k]); i++) h += piece(-side * k);
        const adv = side * mat > 0 ? `<b>+${side * mat}</b>` : '';
        el.querySelector(`.ch-cap [data-c="${side}"]`).innerHTML = `<span class="who ${side > 0 ? 'w' : 'bk'}"></span>${h}${adv}`;
      }
      movesEl.innerHTML = moves.reduce((h, m, i) => h + (i % 2 ? '' : `<i>${Math.floor(i / 2) + 1}.</i>`) + `<span>${m.san}</span>`, '');
      movesEl.scrollTop = movesEl.scrollHeight;
    }
    // plynulý posun figurky z výchozího pole na cílové
    function slide(f, t) {
      const a = squares[f] && squares[f].getBoundingClientRect(), pc = squares[t] && squares[t].querySelector('.pc');
      if (!a || !pc) return;
      const b = squares[t].getBoundingClientRect();
      pc.style.transition = 'none'; pc.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px)`; pc.style.zIndex = 5;
      void pc.getBoundingClientRect();
      pc.style.transition = 'transform .2s cubic-bezier(.3,.7,.4,1)'; pc.style.transform = '';
      setTimeout(() => { pc.style.zIndex = ''; }, 220);
    }
    function play(m, byHuman, noSlide) {
      const san = pos.san(m); pos.make(m); lastMove = m; sel = 0;
      moves.push({ f: m.f, t: m.t, pr: m.pr || 0, san });
      if (online && byHuman) net.send(enc(m));
      api.sound(m.c ? 'place' : 'tap'); if (pos.inCheck()) api.sound('line');
      render(); if (!noSlide) slide(m.f, m.t); api.changed();
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
        if (m.length > 1) { promo(m); return; }
        if (m.length) { play(m[0], true, dragged); return; }
      }
      if (p && Math.sign(p) === pos.side) { sel = s === sel ? 0 : s; api.sound('soft'); } else sel = 0;
      render();
    }
    // proměna pěšce: výběr figury
    const promoEl = el.querySelector('.ch-promo');
    function promo(list) {
      promoEl.innerHTML = `<div>${[C.Q, C.R, C.B, C.N].map(k => `<button data-k="${k}">${piece(pos.side * k)}</button>`).join('')}</div>`;
      promoEl.hidden = false;
      promoEl.onclick = e => { const b = e.target.closest('[data-k]'); promoEl.hidden = true; if (!b) { sel = 0; render(); return; } const m = list.find(x => Math.abs(x.pr) === +b.dataset.k) || list[0]; play(m, true); };
    }
    // klepnutí i tah myší/prstem (figurka jede za prstem)
    let dragFrom = 0, dragged = false, drag = null;
    boardEl.addEventListener('pointerdown', e => {
      const d = e.target.closest('.ch-sq'); if (!d) return; const s = +d.dataset.s;
      dragFrom = pos.b[s] && Math.sign(pos.b[s]) === pos.side ? s : 0; dragged = false; tap(s);
      const pc = dragFrom && sel === dragFrom ? squares[s].querySelector('.pc') : null;
      drag = pc ? { pc, x: e.clientX, y: e.clientY } : null;
    });
    const onMove = e => {
      if (!drag || !dragFrom) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!dragged && Math.hypot(dx, dy) < 6) return;
      dragged = true; drag.pc.style.transition = 'none'; drag.pc.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`; drag.pc.style.zIndex = 10; drag.pc.style.pointerEvents = 'none';
    };
    const onUp = e => {
      if (drag) { drag.pc.style.transform = ''; drag.pc.style.zIndex = ''; drag.pc.style.pointerEvents = ''; }
      drag = null;
      if (!dragFrom) return; const el2 = document.elementFromPoint(e.clientX, e.clientY), d = el2 && el2.closest && el2.closest('.ch-sq');
      if (d && +d.dataset.s !== dragFrom && sel === dragFrom) tap(+d.dataset.s); dragFrom = 0; dragged = false;
    };
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);
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
    function fit() { const vw = (document.getElementById('kView') || el).clientWidth - 28, wide = innerWidth > 860, s = Math.max(240, Math.min(wide ? vw - 300 : vw, innerHeight - (wide ? 130 : 300), 640) - (wide ? 20 : 12)); boardEl.style.width = boardEl.style.height = s + 'px'; boardEl.style.setProperty('--sq', s / 8 + 'px'); }
    fit(); addEventListener('resize', fit); render();
    if (!isPuzzle && !duo && !online && pos.side !== human && !done) setTimeout(aiMove, 400);
    return {
      getState: () => (done ? null : { moves: moves.map(m => ({ f: m.f, t: m.t, pr: m.pr })) }),
      destroy() { removeEventListener('resize', fit); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); if (worker) worker.terminate(); reqId++; },
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
  rules: Kit.L(`<p>Klasické šachy se všemi pravidly: rošáda, braní mimochodem, proměna pěšce (vybereš si figuru), pat, trojí opakování a pravidlo 50 tahů.</p>
    <ul><li>Klepni na figurku a pak na cílové pole, nebo figurku přetáhni. Tečky ukazují možné tahy. Vedle desky vidíš sebrané figurky a materiální převahu.</li>
    <li><b>Úlohy:</b> najdi mat v 1 nebo 2 tazích. Špatný tah se vrátí a počítá se jako chyba.</li>
    <li><b>Denní úloha</b> je pro všechny stejná: v pondělí až středu mat jedním tahem, od čtvrtka ve dvou.</li>
    <li>Na <b>Cestě</b> se střídají úlohy a partie proti stále silnějšímu soupeři. Tři hvězdy za výhru do 35 tahů bez vracení.</li>
    <li><b>Online:</b> založ hru a pošli kód nebo odkaz kamarádovi, nebo se přidej k otevřené hře. Barvy se po každé partii střídají, remízu lze nabídnout.</li></ul>`,
    `<p>Classic chess with every rule: castling, en passant, promotion (you pick the piece), stalemate, threefold repetition and the 50-move rule.</p>
    <ul><li>Tap a piece and then a square, or drag the piece. Dots show the legal moves. Captured pieces and the material lead are shown beside the board.</li>
    <li><b>Puzzles:</b> find mate in 1 or 2. A wrong move is taken back and counts as a mistake.</li>
    <li>The <b>daily puzzle</b> is the same for everyone: mate in one Monday to Wednesday, in two from Thursday.</li>
    <li>The <b>Path</b> alternates puzzles and games against an ever stronger opponent. Three stars for a win within 35 moves without undo.</li>
    <li><b>Online:</b> create a game and send the code or link to a friend, or join an open game. Colours swap after every game and a draw can be offered.</li></ul>`),
  achievements: [],
});
