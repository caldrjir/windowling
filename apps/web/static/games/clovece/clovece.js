'use strict';
// ── ČLOVĚČE, NEZLOB SE · Windowling Hlavolamy ───────────────────────────────
// Klasická desková hra proti 1 nebo 3 počítačovým hráčům, denní partie se stejnými hody pro
// všechny, Cesta a online ve dvou. Pravidla v core.js; kolo hráče se tady odehrává krok za
// krokem s animací (hod, výběr figurky, posun), ale stejně jako ClCore.playTurn, takže se dá
// online přehrát ze seznamu voleb.
const Clovece = (() => {
  const L = Kit.L, C = ClCore;
  const COLORS = ['#e23b3b', '#2f6fe0', '#2fa84f', '#f2c230'], DARK = ['#9a1d1d', '#1d4596', '#1c6b31', '#a07a10'];
  const CNAME = [L('červený', 'red'), L('modrý', 'blue'), L('zelený', 'green'), L('žlutý', 'yellow')];
  const BOTS = [L('Pepa', 'Joe'), L('Máňa', 'Mary'), L('Jarda', 'Jack')];
  const DIFFS = [
    { id: 'dva', name: L('Dva hráči', 'Two players'), note: L('ty proti počítači', 'you against the computer'), par: 600 },
    { id: 'ctyri', name: L('Čtyři hráči', 'Four players'), note: L('plná deska', 'a full board'), par: 900 },
  ];
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'online') return { seed, seats: [0, 2], online: true };
    if (ctx.kind === 'daily') return { seed, seats: [0, 1, 2, 3], level: 2 };
    if (ctx.kind === 'level') { const n = ctx.key; return { seed, seats: n <= 40 ? [0, 2] : [0, 1, 2, 3], level: n <= 20 || (n > 40 && n <= 70) ? 1 : n <= 40 || n <= 100 ? 2 : 3 }; }
    return { seed, seats: diffId === 'ctyri' ? [0, 1, 2, 3] : [0, 2], level: 2 };
  }
  const pawn = p => `<svg viewBox="0 0 40 52"><ellipse cx="20" cy="47" rx="15" ry="4.5" fill="rgba(0,0,0,.3)"/><path d="M8 46 C8 38 13 34 15 26 L25 26 C27 34 32 38 32 46 Z" fill="${COLORS[p]}" stroke="${DARK[p]}" stroke-width="2"/><circle cx="20" cy="17" r="10" fill="${COLORS[p]}" stroke="${DARK[p]}" stroke-width="2"/><circle cx="16.5" cy="13.5" r="3.2" fill="#fff" opacity=".55"/><rect x="12" y="25" width="16" height="4" rx="2" fill="${DARK[p]}"/></svg>`;
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const dieFace = d => `<span class="cl-face">${[...Array(9)].map((_, i) => `<i class="${PIPS[d].includes(i) ? 'on' : ''}"></i>`).join('')}</span>`;

  function create(el, P, saved, api, opts = {}) {
    const net = P.online ? opts.net : null, online = !!net;
    const me = online ? (net.side === 1 ? 0 : 2) : 0;
    const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    const names = {};
    P.seats.forEach((p, i) => { names[p] = p === me ? L('Ty', 'You') : online ? esc(net.opp) : BOTS[(i - 1 + 3) % 3]; });
    let s = C.start(P.seed, P.seats);
    if (saved && saved.pc) { s.pc = saved.pc; s.t = saved.t; s.turnI = saved.turnI; }
    if (online) for (const m of net.moves) C.replayTurn(s, C.decode(m));
    const r = Kit.rng((P.seed ^ 0xc1) >>> 0);
    let done = false, myTurns = 0, speed = 1, auto = false, waitRoll = null, waitPick = null;
    const incoming = [];

    el.innerHTML = `<div class="cl-wrap"><div class="cl-status"></div><div class="cl-board"><div class="cl-cells"></div><div class="cl-pieces"></div></div>
      <div class="cl-bar"><button class="cl-die" aria-label="${L('Hodit kostkou', 'Roll the die')}">${dieFace(6)}</button><div class="cl-players"></div></div><div class="k-tools"><button class="k-tool" data-t="resign">${api.icon('x')}<span>${L('Vzdát', 'Resign')}</span></button></div></div>`;
    const $ = q => el.querySelector(q);
    const board = $('.cl-board'), dieEl = $('.cl-die'), statusEl = $('.cl-status'), piecesEl = $('.cl-pieces');
    // políčka desky
    let cells = '';
    const cell = (x, y, cls, style = '') => `<span class="cl-cell ${cls}" style="left:${x * 9.0909}%;top:${y * 9.0909}%;${style}"></span>`;
    C.TRACK.forEach(([x, y], i) => { const st = i % 10 === 0 ? i / 10 : -1; cells += cell(x, y, st >= 0 ? 'start' : 'track', st >= 0 ? `--c:${COLORS[st]}` : ''); });
    [0, 1, 2, 3].forEach(p => { C.HOME[p].forEach(([x, y]) => (cells += cell(x, y, 'home', `--c:${COLORS[p]}`))); C.YARD[p].forEach(([x, y]) => (cells += cell(x, y, 'yard', `--c:${COLORS[p]}`))); });
    $('.cl-cells').innerHTML = cells;
    // figurky
    const pieceEls = {};
    for (const p of P.seats) for (let k = 0; k < 4; k++) {
      const d = document.createElement('button'); d.className = 'cl-pc'; d.dataset.p = p; d.dataset.k = k; d.innerHTML = pawn(p);
      piecesEl.appendChild(d); pieceEls[p + ':' + k] = d;
    }
    const posOf = (p, k) => { const r0 = s.pc[p][k]; if (r0 === -1) return C.YARD[p][k]; if (r0 >= 40) return C.HOME[p][r0 - 40]; return C.TRACK[C.abs(p, r0)]; };
    function place(p, k, xy) { const [x, y] = xy || posOf(p, k), d = pieceEls[p + ':' + k]; d.style.left = x * 9.0909 + '%'; d.style.top = y * 9.0909 + '%'; d.style.zIndex = 10 + y; }
    function placeAll() { for (const p of P.seats) for (let k = 0; k < 4; k++) place(p, k); }
    function players() {
      $('.cl-players').innerHTML = P.seats.map(p => { const home = s.pc[p].filter(x => x >= 40).length; return `<span class="${C.color(s) === p && !done ? 'turn' : ''}" style="--c:${COLORS[p]}"><i></i>${names[p]}<small>${home}/4 ${L('doma', 'home')}</small></span>`; }).join('');
    }
    const setStatus = t => { statusEl.innerHTML = t; };
    const wait = ms => new Promise(res => setTimeout(res, ms / speed));

    // ── Kolo: stejný průběh jako ClCore.playTurn ──
    async function runTurn(kind, picksIn) {
      const p = C.color(s), picks = []; let k = 0, tries = 0, pi = 0;
      players();
      for (let guard = 0; guard < 60 && s.winner < 0 && !done; guard++) {
        const d = C.roll(s.seed, s.t, k++), opts = C.movable(s, p, d);
        if (kind === 'me' && !auto) {
          setStatus(`<b>${L('Hoď kostkou', 'Roll the die')}</b><span>${tries ? L(`pokus ${tries + 1} ze 3`, `try ${tries + 1} of 3`) : L('ťukni na kostku nebo stiskni mezerník', 'tap the die or press space')}</span>`);
          dieEl.classList.add('go'); await new Promise(res => (waitRoll = res)); dieEl.classList.remove('go'); waitRoll = null;
        }
        await spin(d);
        if (opts.length) {
          let pick;
          if (kind === 'me' && !auto && opts.length > 1) {
            setStatus(`<b>${L(`Padla ${d}: vyber figurku`, `You rolled ${d}: pick a piece`)}</b>`);
            opts.forEach(o => pieceEls[p + ':' + o].classList.add('can'));
            pick = await new Promise(res => (waitPick = res)); waitPick = null;
            opts.forEach(o => pieceEls[p + ':' + o].classList.remove('can'));
          } else if (kind === 'me') { pick = auto ? C.ai(s, p, opts, d, 3, r) : opts[0]; await wait(250); }
          else if (kind === 'ai') pick = C.ai(s, p, opts, d, P.level || 2, r);
          else pick = picksIn[pi++];
          const m = C.move(s, p, opts.includes(pick) ? pick : opts[0], d);
          picks.push(m.k);
          await animate(m, d);
          if (s.winner >= 0) break;
          if (d === 6) continue;
          break;
        }
        if (kind === 'me' && !auto) { setStatus(`<b>${L(`Padla ${d}: nemáš tah`, `You rolled ${d}: no move`)}</b>`); await wait(700); }
        if (d === 6) continue;
        if (C.onlyYard(s, p) && ++tries < 3) continue;
        break;
      }
      s.t++;
      if (s.winner < 0) s.turnI = (s.turnI + 1) % s.seats.length;
      return picks;
    }
    async function spin(d) {
      dieEl.classList.add('roll'); api.sound('tap');
      for (let i = 0; i < 5; i++) { dieEl.innerHTML = dieFace(1 + Math.floor(Math.random() * 6)); await wait(60); }
      dieEl.classList.remove('roll'); dieEl.innerHTML = dieFace(d); dieEl.style.setProperty('--c', COLORS[C.color(s)]);
      await wait(320);
    }
    async function animate(m, d) {
      const { p, k, from, to } = m, path = [];
      if (from === -1) path.push(C.TRACK[C.abs(p, 0)]);
      else for (let i = from + 1; i <= to; i++) path.push(i >= 40 ? C.HOME[p][i - 40] : C.TRACK[C.abs(p, i)]);
      for (const xy of path) { place(p, k, xy); api.sound('soft'); await wait(110); }
      if (m.capture) {
        const [q, j] = m.capture; api.sound('error');
        pieceEls[q + ':' + j].classList.add('hit'); await wait(250); pieceEls[q + ':' + j].classList.remove('hit'); place(q, j);
        setStatus(`<b>${L(`${names[p]} vyhodil figurku (${CNAME[q]})!`, `${names[p]} knocked out a ${CNAME[q]} piece!`)}</b>`);
      }
      if (to >= 40) api.sound('line');
      players(); void d;
    }

    async function loop() {
      while (!done && s.winner < 0) {
        const p = C.color(s);
        if (p === me) {
          myTurns++;
          const picks = await runTurn('me');
          if (online) net.send(C.encode(picks));
          api.changed();
        } else if (online) {
          setStatus(`<b>${L('Hraje soupeř…', 'The opponent is playing…')}</b>`);
          const m = incoming.length ? incoming.shift() : await new Promise(res => (gotMove = res));
          gotMove = null;
          await runTurn('net', C.decode(m));
        } else {
          setStatus(`<b>${L(`Hraje ${names[p]} (${CNAME[p]})…`, `${names[p]} (${CNAME[p]}) is playing…`)}</b>`);
          await wait(250);
          await runTurn('ai');
          await wait(200);
        }
      }
      if (s.winner >= 0) finish();
    }
    let gotMove = null;
    function finish() {
      if (done) return; done = true; api.setTimer(false); players();
      const won = s.winner === me;
      setStatus(`<b>${won ? L('Vyhrál jsi!', 'You won!') : L(`Vyhrává ${names[s.winner]}`, `${names[s.winner]} wins`)}</b>`);
      if (online) { setTimeout(() => net.end(won ? net.side : -net.side, 'home'), 500); return; }
      setTimeout(() => {
        if (won) api.solved({ title: L('Všichni doma!', 'All home!'), stars: myTurns <= 45 ? 3 : myTurns <= 60 ? 2 : 1, html: `<p class="k-muted">${L(`Kola: ${myTurns}`, `Turns: ${myTurns}`)}</p>` });
        else api.failed({ title: L(`Vyhrál ${names[s.winner]}`, `${names[s.winner]} won`), html: `<p class="k-muted">${L(`Doma jsi měl ${s.pc[me].filter(x => x >= 40).length} ze 4 figurek`, `You had ${s.pc[me].filter(x => x >= 40).length} of 4 pieces home`)}</p>` });
      }, 900);
    }

    dieEl.addEventListener('click', () => { if (waitRoll) waitRoll(); });
    piecesEl.addEventListener('click', e => { const b = e.target.closest('.cl-pc.can'); if (b && waitPick) waitPick(+b.dataset.k); });
    $('[data-t="resign"]').addEventListener('click', () => { if (done) return; done = true; if (online) net.resign(); else api.failed({ title: L('Vzdáno', 'Resigned') }); });
    if (online) net.onMove = m => { if (gotMove) gotMove(m); else incoming.push(m); };
    function fit() { const vw = (document.getElementById('kView') || el).clientWidth - 24, w = Math.max(280, Math.min(vw, innerHeight - 300, 620)); board.style.width = board.style.height = w + 'px'; }
    fit(); addEventListener('resize', fit); placeAll(); players(); api.setTimer(true);
    if (s.winner >= 0) finish(); else loop();
    return {
      getState: () => (done || online ? null : { pc: s.pc, t: s.t, turnI: s.turnI }),
      destroy() { done = true; removeEventListener('resize', fit); if (waitRoll) waitRoll(); },
      onKey(e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (waitRoll) waitRoll(); } else if (/^[1-4]$/.test(e.key) && waitPick) { const b = el.querySelectorAll(`.cl-pc.can`)[+e.key - 1]; if (b) waitPick(+b.dataset.k); } },
      _state: () => ({ turn: C.color(s), me, t: s.t, pc: s.pc.map(x => x.slice()), winner: s.winner, done }),
      _auto(on) { auto = on !== false; if (waitRoll) waitRoll(); if (waitPick) { const b = el.querySelector('.cl-pc.can'); if (b) waitPick(+b.dataset.k); } },
      _speed(n) { speed = Math.max(1, n); },
      _solve() { done = true; api.solved({ title: L('Všichni doma!', 'All home!') }); },
    };
  }
  function art(el) {
    el.innerHTML = `<div class="cl-art">${[0, 1, 2, 3].map((p, i) => `<span style="left:${[18, 58, 38, 78][i]}%;top:${[52, 40, 20, 62][i]}%">${pawn(p)}</span>`).join('')}<b>${dieFace(6)}</b></div>`;
  }
  return { DIFFS, generate, create, art, pawn, dieFace, COLORS };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'clovece', title: 'ČLOVĚČE, NEZLOB SE',
  tagline: Kit.L('Klasická desková hra: dostaň všechny čtyři figurky do domečku dřív než ostatní. Šestka nasazuje, soupeře se vyhazuje.', 'The classic board game: get all four pieces home before the others. A six brings a piece out and opponents get knocked back.'),
  diffs: Clovece.DIFFS, generate: Clovece.generate, create: Clovece.create, art: Clovece.art,
  online: { kind: 'turn' },
  dailyDiff: () => 'ctyri', levelDiff: n => (n <= 40 ? 'dva' : 'ctyri'),
  rules: Kit.L(`<p>Každý má čtyři figurky v ohrádce. Hráči se střídají v házení kostkou a posouvají figurky po okruhu ve směru jízdy až do svého domečku.</p>
    <ul><li><b>Šestka</b> nasadí figurku na start a hází se znovu. Kdo nemá na desce žádnou figurku, má tři pokusy na šestku.</li>
    <li>Na vlastní figurku vstoupit nejde. Doskočíš-li na soupeře, vyhodíš ho zpět do ohrádky.</li>
    <li>Do domečku se musí přesně, v domečku se nepřeskakuje.</li>
    <li>Vyhrává, kdo má první všechny čtyři figurky doma.</li>
    <li>V denní partii a online padá na kostce všem stejně (hody se počítají ze semínka partie).</li></ul>`,
    `<p>Everyone has four pieces in their yard. Players take turns rolling the die and move pieces around the track to their own home.</p>
    <ul><li>A <b>six</b> brings a piece onto the start and grants another roll. With no piece on the board you get three tries for a six.</li>
    <li>You cannot land on your own piece. Landing on an opponent knocks it back to its yard.</li>
    <li>Pieces must enter home with an exact roll and cannot jump over each other there.</li>
    <li>The first to get all four pieces home wins.</li>
    <li>In the daily game and online, everyone gets the same rolls (they come from the game's seed).</li></ul>`),
  achievements: [],
});
