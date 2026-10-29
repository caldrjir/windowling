'use strict';
// ── PRŠÍ · Windowling ───────────────────────────────────────────────────────
// Česká karetní klasika s mariášovými kartami: proti 1–3 počítačovým hráčům nebo online ve dvou
// (balíček se míchá ze společného semínka, posílají se jen tahy). Žádná denní výzva ani Cesta:
// jen hra a skóre, kdo koho porazil (kit: versus). Pravidla a počítačoví hráči jsou v core.js.
const Prsi = (() => {
  const L = Kit.L, C = PrsiCore, K = PrsiCards;
  const SUITS = [L('srdce', 'hearts'), L('listy', 'leaves'), L('žaludy', 'acorns'), L('kule', 'bells')];
  const BOTS = [{ id: 'pepa', name: L('Pepa', 'Joe') }, { id: 'mana', name: L('Máňa', 'Mary') }, { id: 'jarda', name: L('Jarda', 'Jack') }];
  const SEAT = ['#e0453a', '#2f6fe0', '#f08a24', '#9b59d0'];
  const DIFFS = [
    { id: 'jeden', name: L('Jeden soupeř', 'One opponent'), note: L('ty a Pepa', 'you and Joe') },
    { id: 'dva', name: L('Dva soupeři', 'Two opponents'), note: L('tři u stolu', 'three at the table') },
    { id: 'tri', name: L('Tři soupeři', 'Three opponents'), note: L('plný stůl', 'a full table') },
  ];
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'online') return { seed, opp: 1, level: 3, online: true };
    return { seed, opp: { jeden: 1, dva: 2, tri: 3 }[diffId] || 1, level: 3 };
  }

  function create(el, P, saved, api, opts = {}) {
    const net = P.online ? opts.net : null, online = !!net;
    const n = P.opp + 1, me = online ? (net.side === 1 ? 0 : 1) : 0;
    const en = Kit.lang === 'en';
    const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    const rawNames = online ? (me === 0 ? [net.me, net.opp] : [net.opp, net.me]) : [L('Ty', 'You'), ...BOTS.slice(0, P.opp).map(b => b.name)];
    const names = rawNames.map(esc);
    const initial = p => esc(String(rawNames[p] || '?').trim().charAt(0).toUpperCase() || '?');
    let s = saved && saved.s ? saved.s : C.deal(P.seed, n);
    let done = false, picking = null, busy = false, lastAct = '', speed = 1;
    const r = C.rngOf((P.seed ^ 0xa11ce) >>> 0);
    if (online) for (const m of net.moves) { const a = C.decode(m); if (a && C.valid(s, a)) C.apply(s, a); }

    el.innerHTML = `<div class="pr-wrap">
      <div class="pr-opps"></div>
      <div class="pr-table">
        <button class="pr-deck" aria-label="${L('Líznout', 'Draw')}"><span class="pr-stack"><img alt=""><img alt=""><img alt=""></span><b></b></button>
        <div class="pr-discard"></div>
        <div class="pr-info"></div>
      </div>
      <div class="pr-status"></div>
      <div class="pr-hand"></div>
      <div class="pr-acts"><button class="k-btn pr-draw">${L('Líznout', 'Draw')}</button><button class="k-btn primary pr-stand" hidden>${L('Stojím', 'Skip my turn')}</button><button class="k-tool pr-resign">${api.icon('x')}<span>${L('Vzdát', 'Resign')}</span></button></div>
      <div class="pr-pick" hidden><div><b>${L('Svršek: vyber barvu', 'Ober: pick a suit')}</b><div class="pr-suits">${[0, 1, 2, 3].map(su => `<button data-su="${su}">${K.suitSvg(su, 46)}<span>${SUITS[su]}</span></button>`).join('')}</div></div></div>
      <div class="pr-fly"></div></div>`;
    const $ = q => el.querySelector(q);
    const wrap = $('.pr-wrap'), oppsEl = $('.pr-opps'), handEl = $('.pr-hand'), discEl = $('.pr-discard'), infoEl = $('.pr-info'), statusEl = $('.pr-status');
    const deckEl = $('.pr-deck'), drawEl = $('.pr-draw'), standEl = $('.pr-stand'), pickEl = $('.pr-pick'), flyEl = $('.pr-fly');
    for (const img of deckEl.querySelectorAll('img')) img.src = K.backSrc();
    const rankName = rk => (en ? K.RANKS_EN : K.RANKS_CS)[rk];
    const cardName = c => `<span class="pr-mini">${rankName(C.rankOf(c))}${K.suitSvg(C.suitOf(c), 14)}</span>`;
    const sortHand = h => h.slice().sort((a, b) => C.suitOf(a) - C.suitOf(b) || C.rankOf(a) - C.rankOf(b));
    const tilt = c => (((c * 37) % 13) - 6) * 1.4;

    function render() {
      // soupeři v pořadí, jak jdou po mně
      let oh = '';
      for (let k = 1; k < n; k++) {
        const p = (me + k) % n, cnt = s.hands[p].length, fan = Math.min(cnt, 9);
        oh += `<div class="pr-opp${s.turn === p && s.winner < 0 ? ' turn' : ''}${cnt === 1 ? ' last' : ''}" data-p="${p}">
          <div class="pr-fan" style="--n:${fan}">${Array.from({ length: fan }, (_, i) => `<img src="${K.backSrc()}" style="--i:${i}" alt="">`).join('')}</div>
          <div class="pr-who"><i style="--c:${SEAT[p]}">${initial(p)}</i><b>${names[p]}</b><small>${cnt === 1 ? L('poslední karta!', 'last card!') : cnt ? L(`${cnt} ${cnt < 5 ? 'karty' : 'karet'}`, `${cnt} cards`) : L('bez karet', 'no cards')}</small></div></div>`;
      }
      oppsEl.innerHTML = oh;
      // odhazovací balíček: poslední čtyři karty, každá trochu jinak natočená
      const d = s.discard.slice(-4);
      discEl.innerHTML = d.map((c, i) => `<img src="${K.src(c, en)}" style="--r:${tilt(c) * (i === d.length - 1 ? 0.5 : 1.2)}deg;--x:${i === d.length - 1 ? 0 : (((c * 13) % 9) - 4)}px" alt="">`).join('');
      deckEl.querySelector('b').textContent = s.deck.length;
      deckEl.querySelector('.pr-stack').style.setProperty('--h', Math.min(3, Math.ceil(s.deck.length / 8)));
      const myTurn = s.turn === me && s.winner < 0 && !done;
      const canDraw = myTurn && !s.skip && !busy;
      deckEl.classList.toggle('go', canDraw);
      drawEl.hidden = !canDraw; drawEl.textContent = s.draw ? L(`Líznout ${s.draw}`, `Draw ${s.draw}`) : L('Líznout', 'Draw');
      standEl.hidden = !(myTurn && s.skip && !busy);
      // stav stolu: barva po svrškovi, sedmy, eso
      let info = '';
      if (C.rankOf(C.top(s)) === C.SVRSEK) info += `<span class="pr-chip suit">${K.suitSvg(s.suit, 26)}<em>${SUITS[s.suit]}</em></span>`;
      if (s.draw) info += `<span class="pr-chip hot">+${s.draw}</span>`;
      if (s.skip) info += `<span class="pr-chip hot">${L('stojí se', 'skip')}</span>`;
      infoEl.innerHTML = info;
      // ruka do vějíře
      const hand = sortHand(s.hands[me]), hn = hand.length, spread = Math.min(7, 44 / Math.max(1, hn));
      handEl.style.setProperty('--n', hn);
      handEl.innerHTML = hand.map((c, i) => { const o = i - (hn - 1) / 2; return `<button class="pr-card${myTurn && !busy && C.canPlay(s, c) ? ' ok' : ''}" data-c="${c}" style="--rot:${(o * spread).toFixed(1)}deg;--lift:${(Math.abs(o) * Math.abs(o) * 0.9).toFixed(1)}px"><img src="${K.src(c, en)}" alt=""></button>`; }).join('');
      handEl.classList.toggle('mine', myTurn);
      // stav hry slovy
      let st, sub = lastAct;
      if (s.winner >= 0) st = s.winner === me ? L('Vyhráváš!', 'You won!') : L(`Vyhrává ${names[s.winner]}`, `${names[s.winner]} wins`);
      else if (myTurn) {
        if (s.pending >= 0) st = L(`${names[s.pending]} končí sedmou: přebij ji sedmou a hra pokračuje, nebo si lízni ${s.draw}`, `${names[s.pending]} went out on a seven: play a seven to bring them back, or draw ${s.draw}`);
        else if (s.draw) st = L(`Přebij sedmou, nebo si lízni ${s.draw}`, `Play a seven or draw ${s.draw}`);
        else if (s.skip) st = L('Přebij esem, nebo stojíš', 'Play an ace or skip your turn');
        else st = C.legal(s).some(a => a.t === 'p') ? L('Jsi na tahu: zahraj kartu, nebo si lízni', 'Your turn: play a card or draw') : L('Nemáš co hrát: lízni si z balíčku', 'Nothing to play: draw a card');
      } else st = online ? L(`Táhne ${names[s.turn]}…`, `${names[s.turn]} to move…`) : L(`${names[s.turn]} přemýšlí…`, `${names[s.turn]} is thinking…`);
      statusEl.innerHTML = `<b>${st}</b>${sub && s.winner < 0 ? `<span>${sub}</span>` : ''}`;
    }
    function describe(p, a) {
      const who = p === me ? L('Ty', 'You') : names[p];
      if (a.t === 'p') return C.rankOf(a.c) === C.SVRSEK && a.suit != null ? `${who}: ${cardName(a.c)} → ${K.suitSvg(a.suit, 14)} ${SUITS[a.suit]}` : `${who}: ${cardName(a.c)}`;
      if (a.t === 'd') { const k = s.draw || 1; return p === me ? L(`Bereš si ${k}`, `You drew ${k}`) : L(`${who} si bere ${k}`, `${who} drew ${k}`); }
      return p === me ? L('Stojíš', 'You skip') : L(`${who} stojí`, `${who} skips`);
    }

    // ── Animace: karta letí z ruky nebo od soupeře na stůl, z balíčku do ruky ──
    const rel = node => { const a = node.getBoundingClientRect(), b = wrap.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; };
    function fly(srcUrl, from, to, delay = 0, rot = 0) {
      if (!from || !to || document.hidden) return Promise.resolve();
      const img = document.createElement('img'); img.src = srcUrl; img.alt = '';
      img.style.cssText = `left:${from.x}px;top:${from.y}px;width:${from.w}px;transform:translate(0,0) rotate(0deg) scale(1);transition-delay:${delay}ms`;
      flyEl.appendChild(img);
      return new Promise(res => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          img.style.transform = `translate(${to.x - from.x}px,${to.y - from.y}px) rotate(${rot}deg) scale(${to.w / from.w})`;
        }));
        setTimeout(() => { img.remove(); res(); }, 360 + delay);
      });
    }
    function seatEl(p) { return p === me ? handEl : oppsEl.querySelector(`.pr-opp[data-p="${p}"] .pr-fan`) || oppsEl.querySelector(`.pr-opp[data-p="${p}"]`); }

    function act(a, byMe) {
      if (done || !C.valid(s, a)) return false;
      const p = s.turn, drawn = a.t === 'd' ? (s.draw || 1) : 0, before = s.hands[p].slice();
      // odkud karta poletí: z mé ruky (konkrétní karta), nebo od soupeřova místa
      let from = null;
      if (a.t === 'p') { const node = p === me ? handEl.querySelector(`.pr-card[data-c="${a.c}"]`) : seatEl(p); if (node) from = rel(node); }
      const deckFrom = rel(deckEl);
      lastAct = describe(p, a);
      C.apply(s, a);
      api.sound(a.t === 'p' ? (C.rankOf(a.c) === C.SEDMA || C.rankOf(a.c) === C.ESO ? 'line' : 'place') : 'soft');
      if (online && byMe) net.send(C.encode(a));
      render(); api.changed();
      if (a.t === 'p') {
        const top = discEl.lastElementChild;
        if (top && from) {
          const cw = top.getBoundingClientRect().width;
          if (p !== me) from = { x: from.x + from.w / 2 - cw * 0.3, y: from.y, w: cw * 0.6, h: cw * 0.9 };
          top.style.visibility = 'hidden';
          fly(K.src(a.c, en), from, rel(top), 0, tilt(a.c) * 0.5).then(() => { top.style.visibility = ''; });
        }
      } else if (a.t === 'd') {
        const got = s.hands[p].filter(c => !before.includes(c));
        if (p === me) got.forEach((c, i) => { const node = handEl.querySelector(`.pr-card[data-c="${c}"]`); if (node) { node.style.visibility = 'hidden'; fly(K.src(c, en), deckFrom, rel(node), i * 90).then(() => { node.style.visibility = ''; }); } });
        else { const seat = seatEl(p); if (seat) { const to = rel(seat); for (let i = 0; i < Math.min(drawn, 6); i++) fly(K.backSrc(), deckFrom, { x: to.x + to.w / 2 - deckFrom.w * 0.3, y: to.y, w: deckFrom.w * 0.6, h: 0 }, i * 90); } }
      }
      if (s.winner >= 0) { finish(); return true; }
      schedule();
      return true;
    }
    function schedule() {
      if (done || s.winner >= 0) return;
      if (s.turn === me) {
        // přebít nemám čím: sedmy se líznou a eso se odstojí samo
        if ((s.draw || s.skip) && !C.legal(s).some(a => a.t === 'p')) { busy = true; render(); setTimeout(() => { busy = false; act(s.skip ? { t: 's' } : { t: 'd' }, true); }, 1100 / speed); }
        return;
      }
      if (online) return;
      busy = true; render();
      setTimeout(() => { busy = false; if (!done) act(C.ai(s, P.level, r), false); }, (800 + r() * 450) / speed);
    }
    function finish() {
      done = true; api.setTimer(false); render();
      if (online) { setTimeout(() => net.end(s.winner === 0 ? 1 : -1, 'cards'), 700); return; }
      // skóre: výhra nad všemi u stolu, nebo prohra s tím, kdo vyhrál
      if (s.winner === me) for (let k = 1; k < n; k++) api.versus(BOTS[k - 1].id, BOTS[k - 1].name, 'w');
      else api.versus(BOTS[s.winner - 1].id, BOTS[s.winner - 1].name, 'l');
      const left = s.hands.reduce((x, h, i) => (i === me ? x : x + h.length), 0);
      setTimeout(() => {
        if (s.winner === me) api.solved({ title: L('Vyhráváš!', 'You won!'), html: `<p class="k-muted">${L(`Soupeřům zbylo ${left} karet`, `Your opponents were left with ${left} cards`)}</p>` });
        else api.failed({ title: L(`Vyhrává ${names[s.winner]}`, `${names[s.winner]} won`), html: `<p class="k-muted">${L(`V ruce ti zbylo ${s.hands[me].length} karet`, `You were left with ${s.hands[me].length} cards`)}</p>` });
      }, 1000);
    }

    handEl.addEventListener('click', e => {
      const b = e.target.closest('.pr-card'); if (!b || done || busy || s.turn !== me) return;
      const c = +b.dataset.c;
      if (!C.canPlay(s, c)) { b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); api.sound('erase'); return; }
      if (C.rankOf(c) === C.SVRSEK && !s.draw && !s.skip) { picking = c; pickEl.hidden = false; return; }
      act({ t: 'p', c }, true);
    });
    pickEl.addEventListener('click', e => {
      const b = e.target.closest('[data-su]');
      if (b && picking != null) { pickEl.hidden = true; act({ t: 'p', c: picking, suit: +b.dataset.su }, true); }
      if (b || e.target === pickEl) { picking = null; pickEl.hidden = true; }
    });
    const draw = () => { if (!done && !busy && s.turn === me && !s.skip) act({ t: 'd' }, true); };
    deckEl.addEventListener('click', draw); drawEl.addEventListener('click', draw);
    standEl.addEventListener('click', () => { if (!done && !busy && s.turn === me && s.skip) act({ t: 's' }, true); });
    $('.pr-resign').addEventListener('click', () => {
      if (done) return; done = true;
      if (online) net.resign();
      else { for (let k = 1; k < n; k++) api.versus(BOTS[k - 1].id, BOTS[k - 1].name, 'l'); api.failed({ title: L('Vzdáno', 'Resigned') }); }
    });
    if (online) net.onMove = m => { const a = C.decode(m); if (a && s.turn !== me) act(a, false); };

    render(); api.setTimer(true);
    if (s.winner >= 0) finish(); else schedule();
    return {
      getState: () => (done || online ? null : { s }),
      destroy() { done = true; },
      onKey(e) {
        if (e.key === ' ' || e.key === 'd' || e.key === 'D') { e.preventDefault(); if (s.skip) standEl.click(); else draw(); }
      },
      _state: () => ({ turn: s.turn, me, hand: s.hands[me].slice(), top: C.top(s), suit: s.suit, draw: s.draw, skip: s.skip, winner: s.winner, pending: s.pending, counts: s.hands.map(h => h.length) }),
      // autopilot pro testy: za hráče hraje počítač
      _speed(n) { speed = Math.max(1, n); },
      _autoplay() { const go = () => { if (done || s.winner >= 0) return; if (s.turn === me && !busy) act(C.ai(s, 3, r), true); setTimeout(go, 120); }; go(); },
      _solve() { s.winner = me; finish(); },
    };
  }

  // obrázek na úvodní stránce: vějíř skutečných karet ze hry
  function art(el) {
    const en = Kit.lang === 'en', cards = [[K.backSrc(), -32], [PrsiCards.src(7, en), -16], [PrsiCards.src(13, en), 0], [PrsiCards.src(22, en), 16], [PrsiCards.src(24, en), 32]];
    el.innerHTML = `<div class="pr-art">${cards.map(([src, r]) => `<img src="${src}" style="--r:${r}deg" alt="">`).join('')}</div>`;
  }
  return { DIFFS, generate, create, art };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'prsi', title: 'PRŠÍ', wording: 'win',
  daily: false, path: false, quests: false, perfect: false, versus: true,
  freeTitle: Kit.L('Proti počítači', 'Against the computer'), freeNote: Kit.L('Vyber, kolik soupeřů sedne ke stolu:', 'Pick how many opponents sit at the table:'),
  tagline: Kit.L('Česká karetní klasika s mariášovými kartami: zbav se všech karet dřív než soupeři. Sedma bere dvě, eso stojí a svršek mění barvu.', 'The Czech card classic with German-suited cards: get rid of all your cards before the others. A seven makes the next player draw two, an ace skips and an Ober changes the suit.'),
  diffs: Prsi.DIFFS, generate: Prsi.generate, create: Prsi.create, art: Prsi.art,
  online: { kind: 'turn' },
  rules: Kit.L(`<p>Každý dostane čtyři karty, jedna se otočí. Hráči se střídají a přikládají kartu <b>stejné barvy nebo hodnoty</b>. Kdo nemůže nebo nechce, lízne si z balíčku. Vyhrává, kdo se první zbaví všech karet.</p>
    <ul><li><b>Sedma:</b> další hráč si lízne dvě karty, nebo přebije sedmou a líže se čtyři, šest, osm…</li>
    <li><b>Eso:</b> další hráč stojí, nebo přebije esem.</li>
    <li><b>Svršek</b> jde zahrát na cokoli (kromě sedmy a esa, které se přebíjejí) a hráč jím zvolí novou barvu.</li>
    <li>Otočená karta platí pro prvního hráče: na sedmu bere dvě, na eso stojí, u svrška platí jeho barva.</li>
    <li>Kdo dohraje <b>sedmou</b>, ještě nevyhrál: další hráč ho může přebitím sedmou vrátit do hry.</li>
    <li>Když dojde balíček, zamíchá se odhazovací (kromě vrchní karty).</li>
    <li><b>Online</b> se hraje ve dvou, balíček je u obou stejný.</li>
    <li><b>Skóre</b> počítá, nad kým jsi vyhrál a kdo nad tebou: proti počítači i online.</li></ul>`,
    `<p>Everyone gets four cards and one is turned up. Players take turns adding a card of the <b>same suit or rank</b>. If you cannot or do not want to play, draw from the deck. The first to get rid of all cards wins.</p>
    <ul><li><b>Seven:</b> the next player draws two cards, or plays another seven and the draw grows to four, six, eight…</li>
    <li><b>Ace:</b> the next player skips a turn, or plays an ace too.</li>
    <li>An <b>Ober</b> can be played on anything (except a pending seven or ace) and its player picks a new suit.</li>
    <li>The turned-up card counts for the first player: a seven means draw two, an ace means skip, an Ober keeps its suit.</li>
    <li>Going out on a <b>seven</b> is not a win yet: the next player can bring you back by playing a seven.</li>
    <li>When the deck runs out, the discard pile (except its top card) is shuffled back.</li>
    <li><b>Online</b> is a two-player game with the same deck for both.</li>
    <li>The <b>score</b> counts whom you beat and who beat you, against the computer and online.</li></ul>`),
  achievements: [],
});
