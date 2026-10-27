'use strict';
// ── DÁMA · Windowling Hlavolamy ─────────────────────────────────────────────
// Česká dáma proti počítači ve třech silách, ve dvou na jednom zařízení a online.
// Denní partie i úrovně Cesty mají stejného soupeře pro všechny. Pravidla a soupeř v core.js;
// online se posílá dráha tahu (pole oddělená pomlčkou), soupeř si tah ověří u sebe.
const Dama = (() => {
  const L = Kit.L, C = DamaCore;
  const DIFFS = [
    { id: 'ai1', name: L('Lehký', 'Easy'), note: L('soupeř se učí', 'a learning opponent'), par: 10 * 60 },
    { id: 'ai2', name: L('Střední', 'Medium'), note: L('počítá pár tahů', 'looks a few moves ahead'), par: 15 * 60 },
    { id: 'ai3', name: L('Těžký', 'Hard'), note: L('počítá dopředu', 'thinks ahead'), par: 20 * 60 },
    { id: 'duo', name: L('Dva hráči', 'Two players'), note: L('na jednom zařízení', 'on one device'), par: 20 * 60 },
  ];
  function generate(seed, diffId, ctx = {}) {
    const r = Kit.rng(seed);
    if (ctx.kind === 'online') return { type: 'online' };
    if (ctx.kind === 'daily') return { type: 'ai', level: 3, color: 1 };
    if (ctx.kind === 'level') { const n = ctx.key; return { type: 'ai', level: n <= 30 ? 1 : n <= 75 ? 2 : 3, color: n % 2 ? 1 : -1 }; }
    if (diffId === 'duo') return { type: 'duo' };
    return { type: 'ai', level: { ai1: 1, ai2: 2, ai3: 3 }[diffId] || 2, color: r() < 0.5 ? 1 : -1 };
  }
  const name = i => 'abcdefgh'[i % 8] + (8 - (i >> 3));
  const note = m => m.path.map(name).join(m.caps.length ? ':' : '-');
  const piece = v => `<svg class="dm-pc ${v > 0 ? 'w' : 'b'}" viewBox="0 0 40 40"><ellipse cx="20" cy="23" rx="16" ry="13" class="sd"/><ellipse cx="20" cy="19" rx="16" ry="13" class="tp"/><ellipse cx="20" cy="19" rx="10.5" ry="8.5" class="rg"/>${Math.abs(v) === 2 ? '<path d="M12 22 L12 14 L16 18 L20 11 L24 18 L28 14 L28 22 Z" class="cr"/>' : ''}</svg>`;

  function create(el, P, saved, api, opts = {}) {
    const net = P.type === 'online' ? opts.net : null, online = !!net, duo = P.type === 'duo';
    const human = online ? net.side : duo ? 0 : P.color, flip = online ? net.side < 0 : !duo && P.color < 0;
    const r = Kit.rng(Math.floor(Math.random() * 1e9));
    let s = C.start(), hist = [], log = [], enc = [], sel = -1, last = null, done = false, thinking = false;
    const replay = list => { for (const str of list) { const m = C.decode(s, str); if (!m) break; hist.push(C.clone(s)); C.apply(s, m); log.push(note(m)); enc.push(str); last = m; } };
    if (online) replay(net.moves); else if (saved && saved.moves) replay(saved.moves);
    el.innerHTML = `<div class="dm-wrap"><div class="dm-side"><div class="dm-status"></div><div class="dm-count"></div><div class="dm-moves"></div></div>
      <div class="dm-frame"><div class="dm-board"></div></div>
      <div class="k-tools">${online ? '' : `<button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button><button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button>`}${duo ? '' : `<button class="k-tool" data-t="resign">${api.icon('x')}<span>${L('Vzdát', 'Resign')}</span></button>`}</div></div>`;
    const boardEl = el.querySelector('.dm-board'), statusEl = el.querySelector('.dm-status'), movesEl = el.querySelector('.dm-moves'), countEl = el.querySelector('.dm-count');
    const sq = [];
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const x = flip ? 7 - col : col, y = flip ? 7 - row : row, i = y * 8 + x;
      const d = document.createElement('button'); d.className = 'dm-sq ' + ((x + y) % 2 ? 'd' : 'l'); d.dataset.s = i;
      if (col === 0) d.dataset.rank = 8 - y; if (row === 7) d.dataset.file = 'abcdefgh'[x];
      boardEl.appendChild(d); sq[i] = d;
    }
    const myTurn = () => !done && !thinking && (duo || s.turn === human);
    function render() {
      const ms = C.moves(s), from = new Set(ms.map(m => m.path[0])), mine = sel >= 0 ? ms.filter(m => m.path[0] === sel) : [];
      for (let i = 0; i < 64; i++) {
        const d = sq[i]; if (!d) continue;
        d.innerHTML = s.b[i] ? piece(s.b[i]) : '';
        d.classList.toggle('sel', i === sel);
        d.classList.toggle('last', !!last && (last.path.includes(i)));
        d.classList.toggle('can', myTurn() && sel < 0 && from.has(i));
        d.classList.toggle('dot', mine.some(m => m.path[m.path.length - 1] === i));
        d.classList.toggle('jump', mine.some(m => m.caps.includes(i)));
      }
      const who = s.turn > 0 ? L('Bílý', 'White') : L('Černý', 'Black');
      const forced = ms.length && ms[0].caps.length && myTurn() ? `<span class="dm-must">${L('Musíš skákat!', 'You must capture!')}</span>` : '';
      statusEl.innerHTML = `<b>${duo ? L(`Na tahu: ${who}`, `${who} to move`) : s.turn === human ? L('Jsi na tahu', 'Your move') : online ? L('Táhne soupeř', 'Opponent to move') : L('Soupeř přemýšlí…', 'Opponent is thinking…')}</b><span>${duo ? L('Dva hráči', 'Two players') : `${L('Hraješ za', 'You play')} ${human > 0 ? L('bílé', 'white') : L('černé', 'black')}${online ? '' : ` · ${L('soupeř', 'opponent')} ${P.level}/3`}`}</span>${forced}`;
      const cnt = side => { let men = 0, kings = 0; for (const v of s.b) { if (v === side) men++; if (v === side * 2) kings++; } return `<span><i class="dm-dot ${side > 0 ? 'w' : 'b'}"></i>${men}${kings ? ` + ${kings}♛` : ''}</span>`; };
      countEl.innerHTML = cnt(1) + cnt(-1);
      movesEl.innerHTML = log.reduce((h, m, i) => h + (i % 2 ? '' : `<i>${Math.floor(i / 2) + 1}.</i>`) + `<span>${m}</span>`, '');
      movesEl.scrollTop = movesEl.scrollHeight;
    }
    function slide(m) {
      const f = m.path[0], t = m.path[m.path.length - 1], a = sq[f].getBoundingClientRect(), pc = sq[t].querySelector('.dm-pc');
      if (!pc) return;
      const b = sq[t].getBoundingClientRect();
      pc.style.transition = 'none'; pc.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px)`; pc.style.zIndex = 5;
      void pc.getBoundingClientRect();
      pc.style.transition = `transform ${0.16 + m.path.length * 0.06}s cubic-bezier(.3,.7,.4,1)`; pc.style.transform = '';
    }
    function play(m, byHuman) {
      hist.push(C.clone(s)); C.apply(s, m); log.push(note(m)); enc.push(C.encode(m)); last = m; sel = -1;
      api.sound(m.caps.length ? 'line' : 'place');
      if (online && byHuman) net.send(C.encode(m));
      render(); slide(m); api.changed();
      const res = C.result(s);
      if (res !== null) { finish(res); return; }
      if (!duo && !online && s.turn !== human) { thinking = true; render(); setTimeout(aiMove, 450); }
    }
    function aiMove() { if (done) return; const m = C.ai(s, P.level, r); thinking = false; play(m, false); }
    function finish(res) {
      done = true; render();
      const mv = Math.ceil(log.length / 2);
      if (online) { net.end(res, res ? 'board' : 'draw'); return; }
      setTimeout(() => {
        if (duo) { api.solved({ title: res > 0 ? L('Vyhrál bílý', 'White wins') : res < 0 ? L('Vyhrál černý', 'Black wins') : L('Remíza', 'Draw'), html: `<p class="k-muted">${L(`Tahy: ${mv}`, `Moves: ${mv}`)}</p>` }); return; }
        let left = 0; for (const v of s.b) if (v * human > 0) left++;
        if (res === human) api.solved({ title: L('Vyhráno!', 'You won!'), stars: left >= 8 ? 3 : left >= 4 ? 2 : 1, html: `<p class="k-muted">${L(`Tahy: ${mv} · zbylo ti ${left} kamenů`, `Moves: ${mv} · ${left} pieces left`)}</p>` });
        else api.failed({ title: res ? L('Soupeř vyhrál', 'The opponent won') : L('Remíza', 'Draw') });
      }, 700);
    }
    boardEl.addEventListener('pointerdown', e => {
      const d = e.target.closest('.dm-sq'); if (!d || !myTurn()) return;
      e.preventDefault();
      const i = +d.dataset.s, ms = C.moves(s);
      if (sel >= 0) {
        const opt = ms.filter(m => m.path[0] === sel && m.path[m.path.length - 1] === i).sort((a, b) => b.caps.length - a.caps.length);
        if (opt.length) { play(opt[0], true); return; }
      }
      if (ms.some(m => m.path[0] === i)) { sel = sel === i ? -1 : i; api.sound('tap'); }
      else { sel = -1; if (s.b[i] * s.turn > 0) api.sound('erase'); }
      render();
    });
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t || done) return;
      if (t.dataset.t === 'undo' && !thinking) {
        const back = duo ? 1 : 2;
        for (let k = 0; k < back && hist.length; k++) { s = hist.pop(); log.pop(); enc.pop(); }
        if (!duo && s.turn !== human && hist.length) { s = hist.pop(); log.pop(); enc.pop(); }
        last = null; sel = -1; api.hint(); api.sound('erase'); render(); api.changed();
        if (!duo && s.turn !== human) { thinking = true; setTimeout(aiMove, 450); }
      }
      if (t.dataset.t === 'hint' && myTurn()) {
        const m = C.ai(s, 3, r); api.hint(); sel = m.path[0]; render();
        const d = sq[m.path[m.path.length - 1]]; d.classList.add('hint'); setTimeout(() => d.classList.remove('hint'), 1600);
      }
      if (t.dataset.t === 'resign') { done = true; if (online) net.resign(); else api.failed({ title: L('Vzdáno', 'Resigned') }); }
    });
    if (online) net.onMove = str => { if (done || s.turn === human) return; const m = C.decode(s, str); if (m) play(m, false); };
    function fit() { const vw = (document.getElementById('kView') || el).clientWidth - 52, w = Math.max(260, Math.min(vw, innerHeight - 230, 600)); boardEl.style.width = boardEl.style.height = w + 'px'; boardEl.style.setProperty('--sq', w / 8 + 'px'); }
    fit(); addEventListener('resize', fit); render();
    const res0 = C.result(s);
    if (res0 !== null && !online) finish(res0);
    else if (!duo && !online && s.turn !== human) { thinking = true; render(); setTimeout(aiMove, 600); }
    return {
      getState: () => (done || online ? null : { moves: enc.slice() }),
      destroy() { removeEventListener('resize', fit); done = true; },
      onKey(e) { if (e.key === 'h' || e.key === 'H') { const b = el.querySelector('[data-t="hint"]'); if (b) b.click(); } },
      _state: () => ({ turn: s.turn, me: human, b: Array.from(s.b), moves: log.slice(), done }),
      _move(str) { const m = C.decode(s, str); if (m && myTurn()) play(m, true); return !!m; },
      _best() { return C.encode(C.ai(s, 2, r)); },
      _solve() { done = true; api.solved({ title: L('Vyhráno!', 'You won!') }); },
    };
  }
  function art(el) {
    const pos = { 10: -1, 12: -1, 17: -2, 26: -1, 35: 1, 37: 1, 44: 1, 49: 2, 53: 1 };
    let h = '<div class="dm-art">';
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { const i = (y + 1) * 8 + x + 1, dark = (x + y) % 2; h += `<span class="${dark ? 'd' : 'l'}">${pos[i] ? piece(pos[i]) : ''}</span>`; }
    el.innerHTML = h + '</div>';
  }
  return { DIFFS, generate, create, art, piece };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'dama', title: 'DÁMA',
  tagline: Kit.L('Česká dáma: skákání je povinné a dáma létá přes celou úhlopříčku. Proti počítači, ve dvou nebo online.', 'Czech draughts: capturing is compulsory and a king flies across the whole diagonal. Against the computer, two players or online.'),
  diffs: Dama.DIFFS, generate: Dama.generate, create: Dama.create, art: Dama.art,
  online: { kind: 'turn' },
  dailyDiff: () => 'ai3', levelDiff: n => (n <= 30 ? 'ai1' : n <= 75 ? 'ai2' : 'ai3'),
  rules: Kit.L(`<p>Hraje se na tmavých polích. Každý má 12 kamenů, bílý začíná. Kámen táhne šikmo dopředu o jedno pole.</p>
    <ul><li><b>Skákání:</b> soupeřův kámen přeskočíš, když je za ním volné pole. Skákat se <b>musí</b> a pokračuje se, dokud to jde. Kámen skáče jen dopředu.</li>
    <li><b>Dáma:</b> kámen, který dojede na poslední řadu, se promění v dámu. Dáma létá po úhlopříčce o libovolný počet polí a skáče i na dálku. Může-li skákat dáma, musí skákat ona.</li>
    <li>Přeskočené kameny zmizí až po dokončení tahu a nedají se přeskočit dvakrát.</li>
    <li>Prohrává, kdo nemůže táhnout. Remíza: 30 tahů jen dámami bez braní nebo trojí opakování pozice.</li>
    <li><b>Online:</b> partie s kamarádem přes kód nebo odkaz, barvy se po každé partii střídají.</li></ul>`,
    `<p>Play on the dark squares. Each side has 12 men and white moves first. A man moves one square diagonally forward.</p>
    <ul><li><b>Capturing:</b> jump over an opponent's piece onto the empty square behind it. Capturing is <b>compulsory</b> and continues while possible. Men capture forward only.</li>
    <li><b>King:</b> a man reaching the far row becomes a king. A king flies any distance along a diagonal and captures from afar. If a king can capture, it must be the one to capture.</li>
    <li>Captured pieces are removed after the move is complete and cannot be jumped twice.</li>
    <li>A player who cannot move loses. Draw: 30 king-only moves without a capture, or a threefold repetition.</li>
    <li><b>Online:</b> play a friend via a code or link; colours alternate every game.</li></ul>`),
  achievements: [],
});
