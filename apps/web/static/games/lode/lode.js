'use strict';
// ── LODĚ · Windowling Hlavolamy ─────────────────────────────────────────────
// Námořní bitva na moři 10×10: rozmísti flotilu, střídejte se v ranách, kdo dřív potopí všechny
// soupeřovy lodě, vyhrává. Proti počítačovému admirálovi ve třech silách nebo online s kamarádem.
// Online zůstává rozmístění skryté: každý tah nese výsledek soupeřovy rány a novou ránu (core.js).
const Lode = (() => {
  const L = Kit.L, C = LodeCore, N = C.N;
  const DIFFS = [
    { id: 'ai1', name: L('Kadet', 'Cadet'), note: L('střílí spíš naslepo', 'mostly shoots blind'), par: 600 },
    { id: 'ai2', name: L('Kapitán', 'Captain'), note: L('loví systematicky', 'hunts systematically'), par: 600 },
    { id: 'ai3', name: L('Admirál', 'Admiral'), note: L('počítá pravděpodobnost', 'plays the odds'), par: 600 },
  ];
  const SHIP = { 5: L('letadlová loď', 'carrier'), 4: L('bitevní loď', 'battleship'), 3: L('křižník', 'cruiser'), 2: L('torpédoborec', 'destroyer') };
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'online') return { seed, online: true };
    if (ctx.kind === 'daily') return { seed, level: 3 };
    if (ctx.kind === 'level') { const n = ctx.key; return { seed, level: n <= 30 ? 1 : n <= 70 ? 2 : 3 }; }
    return { seed, level: { ai1: 1, ai2: 2, ai3: 3 }[diffId] || 2 };
  }

  function create(el, P, saved, api, opts = {}) {
    const net = P.online ? opts.net : null, online = !!net;
    const r = C.rngOf((P.seed ^ 0x10de) >>> 0), rr = C.rngOf(Math.floor(Math.random() * 1e9));
    const store = online ? `lode.online.${opts.key || 'x'}` : null;
    let fleet = C.randomFleet(rr), phase = 'place', sel = -1, done = false;
    const myHits = new Set(), myView = new Int8Array(N * N); // rány na mě; moje rány na soupeře
    let enemyLeft = C.FLEET.slice(), myShots = 0, myHitsCount = 0, turnMine = true, lastShot = -1, pendingAnswer = null, lastIn = -1, lastOut = -1;
    // počítač: vlastní flotila ze semínka (denní a úrovně stejné pro všechny), pohled na moje moře
    const ai = online ? null : { fleet: C.randomFleet(r), hits: new Set(), view: new Int8Array(N * N), left: C.FLEET.slice() };
    const queue = [];
    if (online) {
      turnMine = net.side === 1;
      try { const st = JSON.parse(localStorage.getItem(store) || 'null'); if (st && st.fleet) { fleet = st.fleet; if (net.moves.length || st.ready) phase = 'play'; } } catch (e) { /* bez uložení */ }
    }

    el.innerHTML = `<div class="ld-wrap">
      <div class="ld-status"></div>
      <div class="ld-seas">
        <section class="ld-sea ld-enemy"><h3>${online ? L('Moře soupeře', 'Opponent\'s sea') : L('Moře admirála', 'The admiral\'s sea')}</h3><div class="ld-grid" data-g="e"></div><div class="ld-fleet" data-f="e"></div></section>
        <section class="ld-sea ld-mine"><h3>${L('Tvoje flotila', 'Your fleet')}</h3><div class="ld-grid" data-g="m"></div><div class="ld-fleet" data-f="m"></div>
          <div class="ld-place"><button class="k-btn" data-b="shuffle">${L('Zamíchat', 'Shuffle')}</button><button class="k-btn" data-b="rotate">${L('Otočit', 'Rotate')}</button><button class="k-btn primary" data-b="ready">${L('Hotovo, do boje!', 'Ready, to battle!')}</button></div></section>
      </div>
      <div class="k-tools"><button class="k-tool" data-t="resign">${api.icon('x')}<span>${L('Vzdát', 'Resign')}</span></button></div></div>`;
    const $ = q => el.querySelector(q);
    const gridE = $('[data-g="e"]'), gridM = $('[data-g="m"]'), statusEl = $('.ld-status');
    const mkGrid = g => { let h = '<i></i>'; for (let x = 0; x < N; x++) h += `<i>${'ABCDEFGHIJ'[x]}</i>`; for (let y = 0; y < N; y++) { h += `<i>${y + 1}</i>`; for (let x = 0; x < N; x++) h += `<button class="ld-c" data-c="${y * N + x}"></button>`; } g.innerHTML = h; return [...g.querySelectorAll('.ld-c')]; };
    const cellsE = mkGrid(gridE), cellsM = mkGrid(gridM);
    const coord = c => 'ABCDEFGHIJ'[c % N] + (Math.floor(c / N) + 1);

    function shipClass(sh, c) {
      const cs = C.cellsOf(sh), k = cs.indexOf(c);
      return `sh ${sh.v ? 'v' : 'h'} ${k === 0 ? 'st' : k === cs.length - 1 ? 'en' : 'md'}`;
    }
    function render() {
      // moje moře
      const shipAt = new Map(); fleet.forEach((sh, i) => C.cellsOf(sh).forEach(c => shipAt.set(c, i)));
      cellsM.forEach((d, c) => {
        const i = shipAt.has(c) ? shipAt.get(c) : -1, sh = i >= 0 ? fleet[i] : null, sunk = sh && C.cellsOf(sh).every(x => myHits.has(x));
        d.className = 'ld-c' + (sh ? ' ' + shipClass(sh, c) : '') + (i === sel && phase === 'place' ? ' sel' : '') + (myHits.has(c) ? (sh ? (sunk ? ' sunk' : ' hit') : ' miss') : '') + (c === lastIn ? ' last' : '');
      });
      // soupeřovo moře (co víme)
      cellsE.forEach((d, c) => {
        const v = myView[c];
        // potopená loď: tvar podle sousedních potopených polí
        let sk = '';
        if (v === 3) {
          const x = c % N, l = x > 0 && myView[c - 1] === 3, rt = x < N - 1 && myView[c + 1] === 3, up = c >= N && myView[c - N] === 3, dn = c < N * (N - 1) && myView[c + N] === 3;
          sk = l || rt ? ` sh h ${!l ? 'st' : !rt ? 'en' : 'md'}` : up || dn ? ` sh v ${!up ? 'st' : !dn ? 'en' : 'md'}` : ' sh h st en';
        }
        d.className = 'ld-c' + (v === 1 ? ' miss' : v === 2 ? ' hit' : v === 3 ? ' sunk' + sk : '') + (c === lastOut ? ' last' : '') + (phase === 'play' && turnMine && !done && !v ? ' aim' : '');
      });
      // zbývající lodě
      const fleetHtml = list => C.FLEET.map((len, k) => `<span class="${list[k] ? '' : 'gone'}" title="${SHIP[len]}">${'<b></b>'.repeat(len)}</span>`).join('');
      const sortedMine = fleet.map(sh => !C.cellsOf(sh).every(c => myHits.has(c))); // flotila je seřazená jako C.FLEET
      const leftCopy = enemyLeft.slice(), sortedEnemy = C.FLEET.map(len => { const k = leftCopy.indexOf(len); if (k >= 0) { leftCopy.splice(k, 1); return true; } return false; });
      $('[data-f="e"]').innerHTML = fleetHtml(sortedEnemy);
      $('[data-f="m"]').innerHTML = fleetHtml(sortedMine);
      $('.ld-place').hidden = phase !== 'place';
      el.querySelector('.ld-wrap').classList.toggle('placing', phase === 'place');
      let st;
      if (done) st = '';
      else if (phase === 'place') st = L('Rozmísti lodě: ťukni na loď a pak na místo, kam ji přesunout. Lodě se nesmí dotýkat.', 'Place your fleet: tap a ship, then where to move it. Ships may not touch.');
      else if (phase === 'wait') st = L('Čekám, až soupeř rozmístí lodě…', 'Waiting for the opponent to place the fleet…');
      else st = turnMine ? L('Pal! Vyber pole v soupeřově moři.', 'Fire! Pick a square in the opponent\'s sea.') : online ? L('Soupeř míří…', 'The opponent is aiming…') : L('Admirál míří…', 'The admiral is aiming…');
      statusEl.innerHTML = `<b>${st}</b><span>${L(`Rány ${myShots} · zásahy ${myHitsCount}`, `Shots ${myShots} · hits ${myHitsCount}`)}</span>`;
    }
    function save() { if (store) try { localStorage.setItem(store, JSON.stringify({ fleet, ready: phase !== 'place' })); } catch (e) { /* nic */ } }

    // ── Střelba ──
    function fire(c) {
      if (done || phase !== 'play' || !turnMine || myView[c]) return;
      myShots++; lastOut = c; turnMine = false;
      if (online) {
        net.send(C.encode(pendingAnswer, c)); pendingAnswer = null; lastShot = c; api.sound('tap'); render(); return;
      }
      const res = C.receive(ai.fleet, ai.hits, c);
      afterMyResult(c, res);
      if (!done) setTimeout(aiShoot, 750);
    }
    function afterMyResult(c, res) {
      C.mark(myView, c, res);
      if (res.res !== 'm') myHitsCount++;
      if (res.res === 'k' || res.res === 'w') { enemyLeft.splice(enemyLeft.indexOf(res.cells.length), 1); api.toast(L(`Potopil jsi ${SHIP[res.cells.length]}!`, `You sank a ${SHIP[res.cells.length]}!`)); }
      api.sound(res.res === 'm' ? 'soft' : res.res === 'h' ? 'place' : 'line');
      render(); api.changed();
      if (res.res === 'w') finish(true);
    }
    function incoming(c) {
      const res = C.receive(fleet, myHits, c); lastIn = c;
      api.sound(res.res === 'm' ? 'erase' : 'error');
      return res;
    }
    function aiShoot() {
      if (done) return;
      const c = C.aim(ai.view, ai.left, P.level, rr), res = incoming(c);
      C.mark(ai.view, c, res);
      if (res.res === 'k' || res.res === 'w') ai.left.splice(ai.left.indexOf(res.cells.length), 1);
      turnMine = true; render();
      if (res.res === 'w') finish(false);
    }
    // online: soupeřův tah = výsledek mé rány + jeho rána
    function onMove(str, live) {
      const m = C.decode(str);
      if (m.result && lastShot >= 0) { afterMyResultSilent(lastShot, m.result, live); lastShot = -1; if (done) return; }
      if (m.shot != null) {
        const res = incoming(m.shot);
        if (res.res === 'w') { if (live) { net.send(C.encode(res, null)); } finish(false); return; }
        pendingAnswer = res; turnMine = true;
      }
      render();
    }
    function afterMyResultSilent(c, res, live) { if (live) afterMyResult(c, res); else { C.mark(myView, c, res); if (res.res !== 'm') myHitsCount++; if (res.res === 'k' || res.res === 'w') enemyLeft.splice(enemyLeft.indexOf(res.cells.length), 1); if (res.res === 'w') finish(true); } }
    function finish(won) {
      if (done) return; done = true; api.setTimer(false); render();
      if (store) try { localStorage.removeItem(store); } catch (e) { /* nic */ }
      // na konci se odkryjí zbylé soupeřovy lodě
      if (ai && !won) for (const sh of ai.fleet) for (const c of C.cellsOf(sh)) if (!myView[c]) { myView[c] = 3; cellsE[c].classList.add('reveal'); }
      if (online) { setTimeout(() => net.end(won ? net.side : -net.side, 'fleet'), 400); return; }
      const acc = myShots ? Math.round((myHitsCount / myShots) * 100) : 0;
      setTimeout(() => {
        if (won) api.solved({ title: L('Flotila potopena!', 'Fleet sunk!'), stars: myShots <= 45 ? 3 : myShots <= 60 ? 2 : 1, html: `<p class="k-muted">${L(`Rány ${myShots} · přesnost ${acc} %`, `Shots ${myShots} · accuracy ${acc}%`)}</p>` });
        else api.failed({ title: L('Admirál vyhrál', 'The admiral won'), html: `<p class="k-muted">${L(`Potopil jsi ${C.FLEET.length - enemyLeft.length} z 5 lodí`, `You sank ${C.FLEET.length - enemyLeft.length} of 5 ships`)}</p>` });
      }, 1200);
    }

    // ── Rozmisťování ──
    gridM.addEventListener('click', e => {
      const d = e.target.closest('.ld-c'); if (!d || phase !== 'place') return;
      const c = +d.dataset.c, i = fleet.findIndex(sh => C.cellsOf(sh).includes(c));
      if (i >= 0) { sel = sel === i ? -1 : i; api.sound('tap'); render(); return; }
      if (sel < 0) return;
      const sh = Object.assign({}, fleet[sel], { x: c % N, y: Math.floor(c / N) });
      if (C.fits(fleet, sh, sel)) { fleet[sel] = sh; api.sound('place'); } else api.sound('erase');
      render();
    });
    $('[data-b="shuffle"]').addEventListener('click', () => { fleet = C.randomFleet(rr); sel = -1; api.sound('tap'); render(); });
    $('[data-b="rotate"]').addEventListener('click', () => {
      if (sel < 0) { api.toast(L('Nejdřív ťukni na loď', 'Tap a ship first')); return; }
      const sh = Object.assign({}, fleet[sel], { v: !fleet[sel].v });
      if (C.fits(fleet, sh, sel)) { fleet[sel] = sh; api.sound('place'); } else api.sound('erase');
      render();
    });
    $('[data-b="ready"]').addEventListener('click', () => {
      if (phase !== 'place') return;
      sel = -1; phase = 'play'; api.setTimer(true); api.sound('star'); save();
      while (queue.length) onMove(queue.shift(), true);
      render();
    });
    gridE.addEventListener('click', e => { const d = e.target.closest('.ld-c'); if (d) fire(+d.dataset.c); });
    $('[data-t="resign"]').addEventListener('click', () => { if (done) return; done = true; if (online) net.resign(); else api.failed({ title: L('Vzdáno', 'Resigned') }); });

    if (online) {
      // obnova po načtení: tahy se přehrají (moje flotila je uložená v prohlížeči)
      const first = net.side === 1;
      net.moves.forEach((m, k) => {
        const mine = (k % 2 === 0) === first;
        if (mine) { const d = C.decode(m); if (d.shot != null) { lastShot = d.shot; myShots++; lastOut = d.shot; } pendingAnswer = null; turnMine = false; }
        else if (phase === 'play') onMove(m, false); else queue.push(m);
      });
      net.onMove = m => { if (phase === 'place') queue.push(m); else onMove(m, true); };
    }
    render();
    return {
      getState: () => null,
      destroy() { done = true; },
      _state: () => ({ phase, turnMine, myShots, enemyLeft: enemyLeft.slice(), done, myView: Array.from(myView) }),
      _ready() { $('[data-b="ready"]').click(); },
      _fireBest() { if (phase === 'play' && turnMine && !done) fire(C.aim(myView, enemyLeft, 3, rr)); },
      _solve() { done = true; api.solved({ title: L('Flotila potopena!', 'Fleet sunk!') }); },
    };
  }
  function art(el) {
    let h = '<div class="ld-art">';
    const ship = { 12: 'h st', 13: 'h md', 14: 'h en', 31: 'v st', 41: 'v md', 51: 'v en', 46: 'h st', 47: 'h md', 48: 'h md', 49: 'h en' }, miss = [3, 25, 34, 63, 72, 57], hit = [13, 47];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 10; x++) { const c = y * 10 + x; h += `<span class="ld-c${ship[c] ? ' sh ' + ship[c] : ''}${miss.includes(c) ? ' miss' : ''}${hit.includes(c) ? ' hit' : ''}"></span>`; }
    el.innerHTML = h + '</div>';
  }
  return { DIFFS, generate, create, art };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'lode', title: 'LODĚ',
  tagline: Kit.L('Námořní bitva: rozmísti flotilu a potop všechny soupeřovy lodě dřív než on tvoje. Proti admirálovi nebo online.', 'Naval battle: place your fleet and sink all the opponent\'s ships before they sink yours. Against the admiral or online.'),
  diffs: Lode.DIFFS, generate: Lode.generate, create: Lode.create, art: Lode.art,
  online: { kind: 'turn' },
  dailyDiff: () => 'ai3', levelDiff: n => (n <= 30 ? 'ai1' : n <= 70 ? 'ai2' : 'ai3'),
  rules: Kit.L(`<p>Každý má moře 10×10 a flotilu: letadlovou loď (5), bitevní loď (4), dva křižníky (3) a torpédoborec (2). Lodě leží rovně a nesmí se dotýkat ani rohem.</p>
    <ul><li>Nejdřív lodě rozmísti: ťukni na loď a pak na pole, kam ji přesunout; tlačítko Otočit ji obrátí, Zamíchat rozmístí vše náhodně.</li>
    <li>Pak se střídáte po jedné ráně. Hra ohlásí vodu, zásah nebo potopenou loď.</li>
    <li>Kolem potopené lodě je jistě voda, toho využij.</li>
    <li>Vyhrává, kdo první potopí celou soupeřovu flotilu. Tři hvězdy za vítězství do 45 ran.</li>
    <li><b>Online:</b> tvoje rozmístění se nikam neposílá, soupeř se dozví jen výsledky svých ran.</li></ul>`,
    `<p>Each player has a 10×10 sea and a fleet: a carrier (5), a battleship (4), two cruisers (3) and a destroyer (2). Ships lie straight and may not touch, not even at a corner.</p>
    <ul><li>First place your ships: tap a ship and then the square to move it to; Rotate turns it, Shuffle places everything at random.</li>
    <li>Then you take turns firing one shot each. The game reports a miss, a hit or a sunk ship.</li>
    <li>The squares around a sunk ship are surely water; use that.</li>
    <li>The first to sink the whole enemy fleet wins. Three stars for a win within 45 shots.</li>
    <li><b>Online:</b> your layout is never sent anywhere; the opponent only learns the results of their shots.</li></ul>`),
  achievements: [],
});
