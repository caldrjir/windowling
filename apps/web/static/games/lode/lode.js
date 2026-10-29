'use strict';
// ── LODĚ · Windowling ───────────────────────────────────────────────────────
// Námořní bitva na moři 10×10: rozmísti flotilu (přetažením z přístavu, nebo náhodně), střídejte
// se v ranách, kdo dřív potopí všechny soupeřovy lodě, vyhrává. Proti počítačovému admirálovi ve
// třech silách nebo online s kamarádem; skóre ukazuje, kdo koho porazil (kit: versus). Online
// zůstává rozmístění skryté: každý tah nese výsledek soupeřovy rány a novou ránu (core.js).
const Lode = (() => {
  const L = Kit.L, C = LodeCore, N = C.N;
  const DIFFS = [
    { id: 'ai1', name: L('Kadet', 'Cadet'), note: L('střílí spíš naslepo', 'mostly shoots blind'), par: 600 },
    { id: 'ai2', name: L('Kapitán', 'Captain'), note: L('loví systematicky', 'hunts systematically'), par: 600 },
    { id: 'ai3', name: L('Admirál', 'Admiral'), note: L('počítá pravděpodobnost', 'plays the odds'), par: 600 },
  ];
  // jména lodí flotily (v pořadí C.FLEET) a podle délky pro hlášení
  const NAMES = [L('Letadlová loď', 'Carrier'), L('Bitevní loď', 'Battleship'), L('Křižník', 'Cruiser'), L('Křižník', 'Cruiser'), L('Torpédoborec', 'Destroyer')];
  const SHIP = { 5: L('letadlovou loď', 'carrier'), 4: L('bitevní loď', 'battleship'), 3: L('křižník', 'cruiser'), 2: L('torpédoborec', 'destroyer') };
  const MINE = { 5: L('tvou letadlovou loď', 'your carrier'), 4: L('tvou bitevní loď', 'your battleship'), 3: L('tvůj křižník', 'your cruiser'), 2: L('tvůj torpédoborec', 'your destroyer') };
  const COLS = 'ABCDEFGHIJ';
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'online') return { seed, online: true };
    return { seed, level: { ai1: 1, ai2: 2, ai3: 3 }[diffId] || 2 };
  }

  // ── Lodě kreslené shora (SVG) ──
  // Kresba vodorovná, příď vpravo, jedno pole = 100 jednotek; svislá loď je táž kresba otočená.
  // Přechody jsou jednou v dokumentu (ne v každé lodi), aby fungovaly i ve skrytých prvcích.
  function ensureDefs() {
    if (document.getElementById('ldDefs')) return;
    const d = document.createElement('div');
    d.innerHTML = `<svg id="ldDefs" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"><defs>
      <linearGradient id="ldHull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa7b6"/><stop offset=".5" stop-color="#6c7a8b"/><stop offset="1" stop-color="#3c4756"/></linearGradient>
      <linearGradient id="ldDeck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c4d0"/><stop offset="1" stop-color="#8794a4"/></linearGradient>
      <linearGradient id="ldFlight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#55606d"/><stop offset="1" stop-color="#3a434e"/></linearGradient>
      <linearGradient id="ldSuper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2e8ee"/><stop offset="1" stop-color="#a6b1bd"/></linearGradient>
      <radialGradient id="ldTurret" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#8d9aab"/><stop offset="1" stop-color="#4b5767"/></radialGradient>
    </defs></svg>`;
    document.body.appendChild(d.firstChild);
  }
  const HW = { 5: 38, 4: 31, 3: 27, 2: 22 };
  const turret = (cx, r, dir, n = 2) => {
    let s = '';
    for (let b = 0; b < n; b++) { const y = 50 + (b - (n - 1) / 2) * r * 0.55; s += `<rect x="${dir > 0 ? cx : cx - r * 2.1}" y="${y - 2.2}" width="${r * 2.1}" height="4.4" rx="2" fill="#2b3440"/>`; }
    return s + `<circle cx="${cx}" cy="50" r="${r}" fill="url(#ldTurret)" stroke="#1f2833" stroke-width="2.5"/><circle cx="${cx - r * 0.25 * dir}" cy="50" r="${r * 0.32}" fill="#3c4756"/>`;
  };
  const block = (x0, x1, h, extra = '') => `<rect x="${x0}" y="${50 - h}" width="${x1 - x0}" height="${h * 2}" rx="5" fill="url(#ldSuper)" stroke="#2a3340" stroke-width="2.5"/><rect x="${x0 + 6}" y="${50 - h + 5}" width="${x1 - x0 - 12}" height="${h * 2 - 10}" rx="3" fill="#c3ccd6"/>${extra}`;
  const funnel = (cx, r) => `<ellipse cx="${cx}" cy="50" rx="${r * 1.25}" ry="${r}" fill="#2a323d" stroke="#151b22" stroke-width="2"/><ellipse cx="${cx}" cy="50" rx="${r * 0.7}" ry="${r * 0.5}" fill="#0b0f14"/>`;
  const boats = (x, hw) => `<rect x="${x}" y="${50 - hw + 4}" width="22" height="7" rx="3.5" fill="#e2762e" stroke="#7a3a12" stroke-width="1.5"/><rect x="${x}" y="${50 + hw - 11}" width="22" height="7" rx="3.5" fill="#e2762e" stroke="#7a3a12" stroke-width="1.5"/>`;
  function hullPath(len, hw) {
    const W = len * 100, t = 50 - hw, b = 50 + hw;
    return `M10 ${t + 9}Q10 ${t} 24 ${t}L${W - 120} ${t}C${W - 55} ${t} ${W - 22} ${50 - hw * 0.45} ${W - 6} 50C${W - 22} ${50 + hw * 0.45} ${W - 55} ${b} ${W - 120} ${b}L24 ${b}Q10 ${b} 10 ${b - 9}Z`;
  }
  function shipBody(len) {
    const hw = HW[len], W = len * 100;
    if (len === 5) {
      // letadlová loď: šikmá přistávací paluba, ostrov na pravoboku, letadla na palubě
      const jet = (x, y) => `<path d="M${x} ${y}l26 0l-10-4l-4-12l-5 0l2 12l-9 0l-3-5l-4 0l2 9l-2 9l4 0l3-5l9 0l-2 12l5 0l4-12l10-4z" transform="translate(0 0)" fill="#a8b3bf" stroke="#2a323d" stroke-width="1.2"/>`;
      return `<path d="M12 22Q12 13 22 13L380 13L462 22L494 50L462 78L380 87L170 87L130 93L28 93Q12 93 12 82Z" fill="url(#ldHull)" stroke="#1d2631" stroke-width="3"/>
        <path d="M22 20L378 20L452 28L480 50L452 72L378 80L22 80Z" fill="url(#ldFlight)"/>
        <path d="M40 50L470 50" stroke="#e9eef3" stroke-width="2.5" stroke-dasharray="16 12"/>
        <path d="M60 76L420 28" stroke="#e8c04a" stroke-width="2.5"/><path d="M30 24L30 76" stroke="#e8c04a" stroke-width="3"/>
        <rect x="250" y="56" width="26" height="20" fill="#4a5461" stroke="#2a323d" stroke-width="1.5"/>
        ${jet(70, 34)}${jet(130, 34)}${jet(190, 34)}${jet(110, 64)}
        <rect x="300" y="72" width="70" height="22" rx="4" fill="url(#ldSuper)" stroke="#2a3340" stroke-width="2.5"/><rect x="312" y="76" width="24" height="12" fill="#2a323d"/><circle cx="352" cy="82" r="6" fill="#3c4756" stroke="#1d2631" stroke-width="1.5"/>`;
    }
    const deck = `<path d="${hullPath(len, hw)}" fill="url(#ldHull)" stroke="#1d2631" stroke-width="3"/><path d="${hullPath(len, hw - 6).replace(/^M10/, 'M16')}" fill="url(#ldDeck)" transform="translate(4 0)"/><path d="M30 50L${W - 30} 50" stroke="#7d8a9a" stroke-width="1.5"/>`;
    if (len === 4) return deck + turret(70, 15, -1, 3) + block(105, 190, 17, funnel(160, 9) + `<rect x="115" y="44" width="22" height="12" rx="2" fill="#2a323d"/>`) + boats(112, hw) + turret(232, 15, 1, 3) + turret(288, 15, 1, 3);
    if (len === 3) return deck + turret(58, 12, -1) + block(92, 158, 14, funnel(136, 8) + `<rect x="99" y="45" width="18" height="10" rx="2" fill="#2a323d"/>`) + boats(98, hw) + turret(205, 12, 1);
    return deck + `<rect x="30" y="42" width="22" height="16" rx="3" fill="#4b5767" stroke="#1f2833" stroke-width="2"/>` + block(70, 118, 12, funnel(104, 6) + `<rect x="75" y="46" width="14" height="8" rx="2" fill="#2a323d"/>`) + turret(150, 10, 1, 1);
  }
  function shipSvg(len, v) {
    const W = len * 100, body = shipBody(len);
    return v
      ? `<svg viewBox="0 0 100 ${W}" preserveAspectRatio="none" aria-hidden="true"><g transform="rotate(90 50 50)">${body}</g></svg>`
      : `<svg viewBox="0 0 ${W} 100" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
  }
  const shipEl = (sh, cls = '') => `<div class="ld-ship${cls}" style="left:${sh.x * 10}%;top:${sh.y * 10}%;width:${(sh.v ? 1 : sh.len) * 10}%;height:${(sh.v ? sh.len : 1) * 10}%">${shipSvg(sh.len, sh.v)}</div>`;
  // potopená loď na soupeřově moři: tvar z polí, která hlášení vrátilo
  const shipOf = cells => { const s = cells.slice().sort((a, b) => a - b); return { len: s.length, v: s.length > 1 && s[1] - s[0] === N, x: s[0] % N, y: Math.floor(s[0] / N) }; };
  function board(kind) {
    let cells = '';
    for (let c = 0; c < N * N; c++) cells += kind === 'e' ? `<button class="ld-c" data-c="${c}" aria-label="${COLS[c % N]}${Math.floor(c / N) + 1}"></button>` : `<i class="ld-c" data-c="${c}"></i>`;
    return `<div class="ld-board" data-g="${kind}"><div class="ld-cols">${[...COLS].map(a => `<span>${a}</span>`).join('')}</div><div class="ld-rows">${Array.from({ length: N }, (_, k) => `<span>${k + 1}</span>`).join('')}</div>
      <div class="ld-water"><div class="ld-ships"></div><div class="ld-cells">${cells}</div></div></div>`;
  }
  // krátký efekt v poli: výbuch při zásahu, vodní tříšť při ráně do vody
  function fx(cell, kind) {
    const s = document.createElement('span'); s.className = 'ld-' + kind; cell.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }

  function create(el, P, saved, api, opts = {}) {
    ensureDefs();
    const net = P.online ? opts.net : null, online = !!net;
    const r = C.rngOf((P.seed ^ 0x10de) >>> 0), rr = C.rngOf(Math.floor(Math.random() * 1e9));
    const store = online ? `lode.online.${opts.key || 'x'}` : null;
    const foe = online ? null : DIFFS[(P.level || 2) - 1];
    // flotila v pořadí C.FLEET; null = loď ještě kotví v přístavu
    let fleet = C.FLEET.map(() => null), phase = 'place', done = false, dockSel = -1, drag = null;
    const myHits = new Set(), myView = new Int8Array(N * N); // rány na mě; moje rány na soupeře
    let enemyLeft = C.FLEET.slice(), enemySunk = [], myShots = 0, myHitsCount = 0, turnMine = true, lastShot = -1, pendingAnswer = null, lastIn = -1, lastOut = -1;
    // počítač: vlastní flotila ze semínka, pohled na moje moře
    const ai = online ? null : { fleet: C.randomFleet(r), hits: new Set(), view: new Int8Array(N * N), left: C.FLEET.slice() };
    const queue = [];
    if (online) {
      turnMine = net.side === 1;
      try { const st = JSON.parse(localStorage.getItem(store) || 'null'); if (st && st.fleet && st.fleet.every(Boolean)) { fleet = st.fleet; if (net.moves.length || st.ready) phase = 'play'; } } catch (e) { /* bez uložení */ }
    }
    const lastFleet = () => { const f = api.data && api.data.lastFleet; return Array.isArray(f) && f.length === C.FLEET.length && f.every((s, i) => s && s.len === C.FLEET[i]) ? f : null; };

    el.innerHTML = `<div class="ld-wrap">
      <div class="ld-hud"><b class="ld-turn"></b><span class="ld-stats"></span></div>
      <div class="ld-seas">
        <section class="ld-sea ld-enemy"><header><h3>${online ? L('Moře soupeře', 'Opponent\'s sea') : `${L('Moře', 'Sea')}: ${foe.name}`}</h3><div class="ld-roster" data-f="e"></div></header>${board('e')}</section>
        <section class="ld-sea ld-mine"><header><h3>${L('Tvoje flotila', 'Your fleet')}</h3><div class="ld-roster" data-f="m"></div></header>${board('m')}</section>
        <section class="ld-port">
          <h3>${L('Přístav', 'Harbour')}</h3>
          <p>${L('Přetáhni lodě na moře. Ťuknutím na loď na moři ji otočíš.', 'Drag the ships onto the sea. Tap a ship on the sea to turn it.')}<span class="ld-kbd"> ${L('Při tažení loď otočí klávesa R.', 'While dragging, R turns it.')}</span> ${L('Lodě se nesmí dotýkat ani rohem.', 'Ships may not touch, not even at a corner.')}</p>
          <div class="ld-dock"></div>
          <div class="ld-place"><button class="k-btn" data-b="shuffle">${L('Rozmístit náhodně', 'Place at random')}</button><button class="k-btn" data-b="last">${L('Jako minule', 'Like last time')}</button><button class="k-btn ghost" data-b="clear">${L('Vše do přístavu', 'All to harbour')}</button></div>
          <button class="k-btn primary ld-go" data-b="ready">${L('Vyplout do boje!', 'Set sail for battle!')}</button>
        </section>
      </div>
      <div class="k-tools"><button class="k-tool" data-t="resign">${api.icon('x')}<span>${L('Vzdát', 'Resign')}</span></button></div></div>`;
    const $ = q => el.querySelector(q);
    const wrap = $('.ld-wrap'), boardE = $('[data-g="e"]'), boardM = $('[data-g="m"]'), dockEl = $('.ld-dock');
    const waterM = boardM.querySelector('.ld-water');
    const cellsE = [...boardE.querySelectorAll('.ld-c')], cellsM = [...boardM.querySelectorAll('.ld-c')];
    const shipsE = boardE.querySelector('.ld-ships'), shipsM = boardM.querySelector('.ld-ships');

    // ── Vykreslení ──
    function render() {
      wrap.classList.toggle('placing', phase === 'place');
      wrap.classList.toggle('mine-turn', phase === 'play' && turnMine && !done);
      wrap.classList.toggle('foe-turn', phase === 'play' && !turnMine && !done);
      // moje moře: lodě, zásahy, náhled při tažení
      const placed = fleet.map((sh, i) => (sh ? i : -1)).filter(i => i >= 0);
      shipsM.innerHTML = placed.map(i => shipEl(fleet[i], (C.cellsOf(fleet[i]).every(c => myHits.has(c)) ? ' sunk' : '') + (drag && drag.moved && drag.i === i ? ' lifted' : ''))).join('');
      const shipAt = new Map(); placed.forEach(i => C.cellsOf(fleet[i]).forEach(c => shipAt.set(c, i)));
      const pv = drag && drag.target ? new Set(C.cellsOf(drag.target)) : null, halo = new Set();
      if (drag && drag.moved) for (const i of placed) if (i !== drag.i) for (const c of C.cellsOf(fleet[i])) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = (c % N) + dx, y = Math.floor(c / N) + dy; if (x >= 0 && y >= 0 && x < N && y < N && !shipAt.has(y * N + x)) halo.add(y * N + x); }
      cellsM.forEach((d, c) => {
        const own = shipAt.has(c);
        d.className = 'ld-c' + (myHits.has(c) ? (own ? ' hit' : ' miss') : '') + (c === lastIn ? ' last' : '') + (pv && pv.has(c) ? (drag.ok ? ' pv' : ' pv bad') : '') + (halo.has(c) ? ' halo' : '');
      });
      // soupeřovo moře: co víme
      shipsE.innerHTML = enemySunk.map(sh => shipEl(sh, ' sunk')).join('') + (done && ai ? ai.fleet.filter(sh => !C.cellsOf(sh).every(c => myView[c] === 3)).map(sh => shipEl(sh, ' reveal')).join('') : '');
      cellsE.forEach((d, c) => {
        const v = myView[c];
        d.className = 'ld-c' + (v === 1 ? ' miss' : v === 2 ? ' hit' : v === 3 ? ' sunk' : '') + (c === lastOut ? ' last' : '') + (phase === 'play' && turnMine && !done && !v ? ' aim' : '');
        d.disabled = !(phase === 'play' && turnMine && !done && !v);
      });
      // přehled flotil: siluety lodí, potopené přeškrtnuté
      const roster = alive => C.FLEET.map((len, k) => `<span class="${alive[k] ? '' : 'gone'}" title="${NAMES[k]}" style="width:${len * 13}px">${shipSvg(len, false)}</span>`).join('');
      const leftCopy = enemyLeft.slice(), aliveE = C.FLEET.map(len => { const k = leftCopy.indexOf(len); if (k >= 0) { leftCopy.splice(k, 1); return true; } return false; });
      $('[data-f="e"]').innerHTML = roster(aliveE);
      $('[data-f="m"]').innerHTML = roster(fleet.map(sh => !sh || !C.cellsOf(sh).every(c => myHits.has(c))));
      // přístav: lodě, které ještě nejsou na moři
      if (phase === 'place') {
        dockEl.innerHTML = fleet.map((sh, i) => (sh || (drag && drag.moved && drag.i === i) ? '' : `<div class="ld-dship${dockSel === i ? ' sel' : ''}" data-i="${i}"><div class="ld-dhull" style="width:calc(var(--cell) * ${C.FLEET[i]})">${shipSvg(C.FLEET[i], false)}</div><small>${NAMES[i]} · ${C.FLEET[i]}</small></div>`)).join('') || `<p class="ld-docked">${L('Celá flotila je na moři.', 'The whole fleet is at sea.')}</p>`;
        $('[data-b="ready"]').disabled = fleet.some(s => !s);
        $('[data-b="last"]').hidden = !lastFleet();
      }
      // stav hry
      let st;
      if (done) st = '';
      else if (phase === 'place') st = online ? L('Rozmísti flotilu, soupeř ji neuvidí', 'Place your fleet, the opponent will not see it') : L('Rozmísti flotilu', 'Place your fleet');
      else if (phase === 'wait') st = L('Čekám, až soupeř rozmístí lodě…', 'Waiting for the opponent to place the fleet…');
      else st = turnMine ? L('Tvůj tah · pal!', 'Your turn · fire!') : online ? L('Soupeř míří…', 'The opponent is aiming…') : L(`${foe.name} míří…`, `The ${foe.name.toLowerCase()} is aiming…`);
      $('.ld-turn').textContent = st;
      const acc = myShots ? Math.round((myHitsCount / myShots) * 100) : 0;
      $('.ld-stats').textContent = phase === 'place' ? L(`Na moři ${fleet.filter(Boolean).length} z ${C.FLEET.length} lodí`, `${fleet.filter(Boolean).length} of ${C.FLEET.length} ships at sea`) : L(`Rány ${myShots} · zásahy ${myHitsCount} · přesnost ${acc} %`, `Shots ${myShots} · hits ${myHitsCount} · accuracy ${acc}%`);
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
      if (!done) setTimeout(aiShoot, 850);
    }
    function sinkEnemy(res) { enemyLeft.splice(enemyLeft.indexOf(res.cells.length), 1); enemySunk.push(shipOf(res.cells)); }
    function afterMyResult(c, res) {
      C.mark(myView, c, res);
      if (res.res !== 'm') myHitsCount++;
      if (res.res === 'k' || res.res === 'w') { sinkEnemy(res); api.toast(L(`Potopil jsi ${SHIP[res.cells.length]}!`, `You sank a ${SHIP[res.cells.length]}!`)); }
      api.sound(res.res === 'm' ? 'soft' : res.res === 'h' ? 'place' : 'line');
      render(); api.changed();
      fx(cellsE[c], res.res === 'm' ? 'splash' : 'boom');
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
      if (res.res === 'k' || res.res === 'w') { ai.left.splice(ai.left.indexOf(res.cells.length), 1); api.toast(L(`${foe.name} potopil ${MINE[res.cells.length]}`, `The ${foe.name.toLowerCase()} sank ${MINE[res.cells.length]}`)); }
      turnMine = true; render();
      fx(cellsM[c], res.res === 'm' ? 'splash' : 'boom');
      if (res.res === 'w') finish(false);
    }
    // online: soupeřův tah = výsledek mé rány + jeho rána
    function onMove(str, live) {
      const m = C.decode(str);
      if (m.result && lastShot >= 0) { afterMyResultSilent(lastShot, m.result, live); lastShot = -1; if (done) return; }
      if (m.shot != null) {
        const res = incoming(m.shot);
        if (live) { render(); fx(cellsM[m.shot], res.res === 'm' ? 'splash' : 'boom'); }
        if (res.res === 'w') { if (live) { net.send(C.encode(res, null)); } finish(false); return; }
        pendingAnswer = res; turnMine = true;
      }
      render();
    }
    function afterMyResultSilent(c, res, live) { if (live) afterMyResult(c, res); else { C.mark(myView, c, res); if (res.res !== 'm') myHitsCount++; if (res.res === 'k' || res.res === 'w') sinkEnemy(res); if (res.res === 'w') finish(true); } }
    function finish(won) {
      if (done) return; done = true; api.setTimer(false); render();
      if (store) try { localStorage.removeItem(store); } catch (e) { /* nic */ }
      if (online) { setTimeout(() => net.end(won ? net.side : -net.side, 'fleet'), 400); return; }
      api.versus(foe.id, foe.name, won ? 'w' : 'l');
      const acc = myShots ? Math.round((myHitsCount / myShots) * 100) : 0;
      setTimeout(() => {
        if (won) api.solved({ title: L('Flotila potopena!', 'Fleet sunk!'), stars: myShots <= 45 ? 3 : myShots <= 60 ? 2 : 1, html: `<p class="k-muted">${L(`Rány ${myShots} · přesnost ${acc} %`, `Shots ${myShots} · accuracy ${acc}%`)}</p>` });
        else api.failed({ title: L(`${foe.name} vyhrál`, `The ${foe.name.toLowerCase()} won`), html: `<p class="k-muted">${L(`Potopil jsi ${C.FLEET.length - enemyLeft.length} z 5 lodí`, `You sank ${C.FLEET.length - enemyLeft.length} of 5 ships`)}</p>` });
      }, 1300);
    }

    // ── Rozmisťování: přetažení z přístavu i po moři, ťuknutí otočí, klávesa R otočí při tažení ──
    const others = i => fleet.filter((s, k) => s && k !== i);
    const fitsAt = (i, sh) => C.fits(others(i), sh, -1);
    const cellPx = () => waterM.getBoundingClientRect().width / N;
    function pointCell(e) {
      const b = waterM.getBoundingClientRect(), fx_ = (e.clientX - b.left) / b.width * N, fy_ = (e.clientY - b.top) / b.height * N;
      return { x: Math.floor(fx_), y: Math.floor(fy_), inside: fx_ >= -0.4 && fy_ >= -0.4 && fx_ < N + 0.4 && fy_ < N + 0.4 };
    }
    // loď délky len s k-tým polem na (x, y)
    const anchored = (len, v, k, x, y) => ({ len, v, x: v ? x : x - k, y: v ? y - k : y });
    function ghostPos(e) {
      if (!drag.ghost) return;
      const cp = cellPx(), len = C.FLEET[drag.i];
      drag.ghost.style.width = `${(drag.v ? 1 : len) * cp}px`; drag.ghost.style.height = `${(drag.v ? len : 1) * cp}px`;
      const gx = (drag.v ? 0.5 : drag.k + 0.5) * cp, gy = (drag.v ? drag.k + 0.5 : 0.5) * cp;
      drag.ghost.style.transform = `translate(${e.clientX - gx}px, ${e.clientY - gy}px)`;
      if (drag.ghost.dataset.v !== String(drag.v)) { drag.ghost.innerHTML = shipSvg(len, drag.v); drag.ghost.dataset.v = String(drag.v); }
    }
    function dragTo(e) {
      const p = pointCell(e), len = C.FLEET[drag.i];
      drag.last = e;
      if (p.inside) { const sh = anchored(len, drag.v, drag.k, Math.min(N - 1, Math.max(0, p.x)), Math.min(N - 1, Math.max(0, p.y))); drag.target = sh; drag.ok = fitsAt(drag.i, sh); }
      else { drag.target = null; drag.ok = false; }
      ghostPos(e); render();
    }
    function startDrag(e, i, k, v, from) {
      drag = { i, k, v, from, origin: fleet[i], sx: e.clientX, sy: e.clientY, moved: false, pid: e.pointerId, target: null, ok: false };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* nic */ }
    }
    function moveDrag(e) {
      if (!drag || e.pointerId !== drag.pid) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
        drag.moved = true; dockSel = -1; fleet[drag.i] = null;
        drag.ghost = document.createElement('div'); drag.ghost.className = 'ld-ghost'; document.body.appendChild(drag.ghost);
        api.sound('tap');
      }
      e.preventDefault(); dragTo(e);
    }
    function endDrag(e, cancel) {
      if (!drag || e.pointerId !== drag.pid) return;
      const d = drag; drag = null;
      if (d.ghost) d.ghost.remove();
      if (!d.moved) {
        if (d.from === 'grid') rotateAt(d.i, d.k); else { dockSel = dockSel === d.i ? -1 : d.i; api.sound('tap'); render(); }
        return;
      }
      if (!cancel && d.target && d.ok) { fleet[d.i] = d.target; api.sound('place'); } else { fleet[d.i] = d.origin; if (d.target) api.sound('erase'); }
      render();
    }
    // otočení lodi na moři kolem ťuknutého pole (když se nevejde, zkusí ji posunout podél nové osy)
    function rotateAt(i, k) {
      const sh = fleet[i], c = C.cellsOf(sh)[k], len = sh.len;
      for (const kk of [k, ...Array.from({ length: len }, (_, j) => j).filter(j => j !== k)]) {
        const n = anchored(len, !sh.v, kk, c % N, Math.floor(c / N));
        if (fitsAt(i, n)) { fleet[i] = n; api.sound('place'); render(); return; }
      }
      api.sound('erase');
      const s = shipsM.children[fleet.slice(0, i).filter(Boolean).length];
      if (s) { s.classList.remove('no'); void s.offsetWidth; s.classList.add('no'); }
    }
    // ťuknutí na volné pole s vybranou lodí z přístavu: položí ji sem (vodorovně, jinak svisle)
    function dropSelected(x, y) {
      const i = dockSel, len = C.FLEET[i];
      for (const v of [false, true]) for (let k = 0; k < len; k++) { const n = anchored(len, v, k, x, y); if (fitsAt(i, n)) { fleet[i] = n; dockSel = -1; api.sound('place'); render(); return; } }
      api.sound('erase');
    }
    boardM.addEventListener('pointerdown', e => {
      if (phase !== 'place' || done || (e.button && e.button !== 0)) return;
      const p = pointCell(e); if (p.x < 0 || p.y < 0 || p.x >= N || p.y >= N) return;
      const c = p.y * N + p.x, i = fleet.findIndex(sh => sh && C.cellsOf(sh).includes(c));
      if (i >= 0) { e.preventDefault(); startDrag(e, i, C.cellsOf(fleet[i]).indexOf(c), fleet[i].v, 'grid'); }
      else if (dockSel >= 0) dropSelected(p.x, p.y);
    });
    dockEl.addEventListener('pointerdown', e => {
      const d = e.target.closest('.ld-dship'); if (!d || phase !== 'place' || (e.button && e.button !== 0)) return;
      const i = +d.dataset.i, hull = d.querySelector('.ld-dhull').getBoundingClientRect(), len = C.FLEET[i];
      e.preventDefault();
      startDrag(e, i, Math.max(0, Math.min(len - 1, Math.floor((e.clientX - hull.left) / (hull.width / len)))), false, 'dock');
    });
    for (const t of [boardM, dockEl]) {
      t.addEventListener('pointermove', moveDrag);
      t.addEventListener('pointerup', e => endDrag(e, false));
      t.addEventListener('pointercancel', e => endDrag(e, true));
    }
    $('[data-b="shuffle"]').addEventListener('click', () => { fleet = C.randomFleet(rr); dockSel = -1; api.sound('tap'); render(); });
    $('[data-b="clear"]').addEventListener('click', () => { fleet = C.FLEET.map(() => null); dockSel = -1; api.sound('tap'); render(); });
    $('[data-b="last"]').addEventListener('click', () => { const f = lastFleet(); if (f) { fleet = f.map(s => Object.assign({}, s)); dockSel = -1; api.sound('tap'); render(); } });
    $('[data-b="ready"]').addEventListener('click', () => {
      if (phase !== 'place' || fleet.some(s => !s)) return;
      dockSel = -1; phase = 'play'; api.setTimer(true); api.sound('star'); save();
      if (api.data) { api.data.lastFleet = fleet.map(s => Object.assign({}, s)); api.persist(); }
      while (queue.length) onMove(queue.shift(), true);
      render();
    });
    boardE.addEventListener('click', e => { const d = e.target.closest('.ld-c'); if (d) fire(+d.dataset.c); });
    $('[data-t="resign"]').addEventListener('click', () => {
      if (done) return; done = true;
      if (online) net.resign(); else { api.versus(foe.id, foe.name, 'l'); api.failed({ title: L('Vzdáno', 'Resigned') }); }
    });

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
      destroy() { done = true; if (drag && drag.ghost) drag.ghost.remove(); },
      onKey(e) {
        if ((e.key === 'r' || e.key === 'R') && drag && drag.moved) { drag.v = !drag.v; if (drag.last) dragTo(drag.last); }
      },
      _state: () => ({ phase, turnMine, myShots, enemyLeft: enemyLeft.slice(), done, myView: Array.from(myView), fleet: fleet.map(s => s && Object.assign({}, s)) }),
      _ready() { if (fleet.some(s => !s)) fleet = C.randomFleet(rr); $('[data-b="ready"]').disabled = false; $('[data-b="ready"]').click(); },
      _fireBest() { if (phase === 'play' && turnMine && !done) fire(C.aim(myView, enemyLeft, 3, rr)); },
      _solve() { done = true; api.solved({ title: L('Flotila potopena!', 'Fleet sunk!') }); },
    };
  }

  // obrázek na úvodní stránce: výřez moře se skutečnými loděmi a ranami ze hry
  function art(el) {
    ensureDefs();
    const ships = [{ len: 5, v: false, x: 1, y: 1 }, { len: 3, v: true, x: 8, y: 0 }, { len: 4, v: false, x: 3, y: 4 }, { len: 2, v: true, x: 0, y: 4 }];
    const hit = [4 * 10 + 5, 4 * 10 + 6, 1 * 10 + 3], miss = [3 * 10 + 1, 6 * 10 + 8, 2 * 10 + 6, 0 * 10 + 4, 5 * 10 + 2];
    let cells = '';
    for (let c = 0; c < 70; c++) cells += `<i class="ld-c${hit.includes(c) ? ' hit' : miss.includes(c) ? ' miss' : ''}"></i>`;
    el.innerHTML = `<div class="ld-art"><div class="ld-water"><div class="ld-ships">${ships.map(sh => `<div class="ld-ship" style="left:${sh.x * 10}%;top:${sh.y * (100 / 7)}%;width:${(sh.v ? 1 : sh.len) * 10}%;height:${(sh.v ? sh.len : 1) * (100 / 7)}%">${shipSvg(sh.len, sh.v)}</div>`).join('')}</div><div class="ld-cells">${cells}</div></div></div>`;
  }
  return { DIFFS, generate, create, art, shipSvg };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'lode', title: 'LODĚ', wording: 'win',
  daily: false, path: false, quests: false, perfect: false, versus: true,
  // moře v noci: ocelová modř, mosaz a signální červená
  palette: { a: '#e9b44c', b: '#e4572e', c: '#1f8a9e', bg: '#03101c' },
  freeTitle: Kit.L('Proti počítači', 'Against the computer'), freeNote: Kit.L('Vyber, kdo velí nepřátelské flotile:', 'Pick who commands the enemy fleet:'),
  tagline: Kit.L('Námořní bitva: rozmísti flotilu a potop všechny soupeřovy lodě dřív než on tvoje. Proti admirálovi nebo online.', 'Naval battle: place your fleet and sink all the opponent\'s ships before they sink yours. Against the admiral or online.'),
  diffs: Lode.DIFFS, generate: Lode.generate, create: Lode.create, art: Lode.art,
  online: { kind: 'turn' },
  rules: Kit.L(`<p>Každý má moře 10×10 a flotilu: letadlovou loď (5), bitevní loď (4), dva křižníky (3) a torpédoborec (2). Lodě leží rovně a nesmí se dotýkat ani rohem.</p>
    <ul><li>Nejdřív rozmísti flotilu: přetáhni lodě z přístavu na moře a po moři, ťuknutím na loď ji otočíš (při tažení otáčí klávesa R). Můžeš je rozmístit i náhodně, nebo jako minule.</li>
    <li>Pak se střídáte po jedné ráně. Hra ohlásí vodu, zásah nebo potopenou loď.</li>
    <li>Kolem potopené lodě je jistě voda, toho využij.</li>
    <li>Vyhrává, kdo první potopí celou soupeřovu flotilu. Tři hvězdy za vítězství do 45 ran.</li>
    <li><b>Online:</b> tvoje rozmístění se nikam neposílá, soupeř se dozví jen výsledky svých ran.</li>
    <li><b>Skóre</b> počítá, nad kým jsi vyhrál a kdo nad tebou: proti počítači i online.</li></ul>`,
    `<p>Each player has a 10×10 sea and a fleet: a carrier (5), a battleship (4), two cruisers (3) and a destroyer (2). Ships lie straight and may not touch, not even at a corner.</p>
    <ul><li>First place your fleet: drag the ships from the harbour onto the sea and around it, tap a ship to turn it (R turns it while dragging). You can also place them at random or like last time.</li>
    <li>Then you take turns firing one shot each. The game reports a miss, a hit or a sunk ship.</li>
    <li>The squares around a sunk ship are surely water; use that.</li>
    <li>The first to sink the whole enemy fleet wins. Three stars for a win within 45 shots.</li>
    <li><b>Online:</b> your layout is never sent anywhere; the opponent only learns the results of their shots.</li>
    <li>The <b>score</b> counts whom you beat and who beat you, against the computer and online.</li></ul>`),
  achievements: [],
});
