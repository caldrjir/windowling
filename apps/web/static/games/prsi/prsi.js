'use strict';
// ── PRŠÍ · Windowling Hlavolamy ─────────────────────────────────────────────
// Česká karetní klasika s mariášovými kartami: proti 1–3 počítačovým hráčům, denní rozdání
// stejné pro všechny, Cesta se sílícími soupeři a online partie ve dvou (balíček se míchá ze
// společného semínka, posílají se jen tahy). Pravidla a počítačoví hráči jsou v core.js.
const Prsi = (() => {
  const L = Kit.L, C = PrsiCore, K = PrsiCards;
  const SUITS = [L('srdce', 'hearts'), L('listy', 'leaves'), L('žaludy', 'acorns'), L('kule', 'bells')];
  const BOTS = [L('Pepa', 'Joe'), L('Máňa', 'Mary'), L('Jarda', 'Jack')];
  const DIFFS = [
    { id: 'jeden', name: L('Jeden soupeř', 'One opponent'), note: L('hra ve dvou proti počítači', 'a two-player game against the computer'), par: 180 },
    { id: 'dva', name: L('Dva soupeři', 'Two opponents'), note: L('tři hráči u stolu', 'three at the table'), par: 240 },
    { id: 'tri', name: L('Tři soupeři', 'Three opponents'), note: L('plný stůl', 'a full table'), par: 300 },
  ];
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'online') return { seed, opp: 1, level: 3, online: true };
    if (ctx.kind === 'daily') return { seed, opp: 1, level: 3 };
    if (ctx.kind === 'level') { const n = ctx.key; return { seed, opp: n <= 40 ? 1 : n <= 80 ? 2 : 3, level: n <= 15 ? 1 : n <= 50 ? 2 : 3 }; }
    return { seed, opp: { jeden: 1, dva: 2, tri: 3 }[diffId] || 1, level: 3 };
  }

  function create(el, P, saved, api, opts = {}) {
    const net = P.online ? opts.net : null, online = !!net;
    const n = P.opp + 1, me = online ? (net.side === 1 ? 0 : 1) : 0;
    const en = Kit.lang === 'en';
    const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    const names = (online ? (me === 0 ? [net.me, net.opp] : [net.opp, net.me]) : [L('Ty', 'You'), ...BOTS.slice(0, P.opp)]).map(esc);
    let s = saved && saved.s ? saved.s : C.deal(P.seed, n);
    let myMoves = saved && saved.myMoves || 0, done = false, picking = null, busy = false, flash = null, lastBy = -1;
    const r = C.rngOf((P.seed ^ 0xa11ce) >>> 0);
    if (online) for (const m of net.moves) { const a = C.decode(m); if (a && C.valid(s, a)) C.apply(s, a); }

    el.innerHTML = `<div class="pr-wrap">
      <div class="pr-opps"></div>
      <div class="pr-table"><button class="pr-deck" aria-label="${L('Líznout', 'Draw')}"><img alt=""><b></b></button><div class="pr-discard"></div><div class="pr-info"></div></div>
      <div class="pr-status"></div>
      <div class="pr-hand"></div>
      <div class="pr-acts"><button class="k-btn primary pr-stand" hidden>${L('Stojím', 'Skip my turn')}</button><button class="k-tool pr-resign">${api.icon('x')}<span>${L('Vzdát', 'Resign')}</span></button></div>
      <div class="pr-pick" hidden><div><b>${L('Svršek: vyber barvu', 'Ober: pick a suit')}</b><div class="pr-suits">${[0, 1, 2, 3].map(su => `<button data-su="${su}">${K.suitSvg(su, 44)}<span>${SUITS[su]}</span></button>`).join('')}</div></div></div></div>`;
    const $ = q => el.querySelector(q);
    const oppsEl = $('.pr-opps'), handEl = $('.pr-hand'), discEl = $('.pr-discard'), infoEl = $('.pr-info'), statusEl = $('.pr-status'), deckEl = $('.pr-deck'), standEl = $('.pr-stand'), pickEl = $('.pr-pick');
    deckEl.querySelector('img').src = K.backSrc();
    const rankName = rk => (en ? K.RANKS_EN : K.RANKS_CS)[rk];
    const cardName = c => `${rankName(C.rankOf(c))} ${K.suitSvg(C.suitOf(c), 16)}`;

    function sortHand(h) { return h.slice().sort((a, b) => C.suitOf(a) - C.suitOf(b) || C.rankOf(a) - C.rankOf(b)); }
    function render() {
      // soupeři v pořadí, jak jdou po mně
      let oh = '';
      for (let k = 1; k < n; k++) {
        const p = (me + k) % n, cnt = s.hands[p].length, fan = Math.min(cnt, 8);
        oh += `<div class="pr-opp${s.turn === p && s.winner < 0 ? ' turn' : ''}"><div class="pr-fan" style="--n:${fan}">${Array.from({ length: fan }, (_, i) => `<img src="${K.backSrc()}" style="--i:${i}" alt="">`).join('')}</div><b>${names[p]}</b><small>${cnt === 1 ? L('poslední karta!', 'last card!') : L(`${cnt} karet`, `${cnt} cards`)}</small></div>`;
      }
      oppsEl.innerHTML = oh;
      // odhazovací balíček: poslední tři karty mírně natočené
      const d = s.discard.slice(-3);
      discEl.innerHTML = d.map((c, i) => `<img src="${K.src(c, en)}" class="${i === d.length - 1 && flash === 'play' ? 'pr-new' : ''}" style="--r:${(((c * 37) % 13) - 6) * (i === d.length - 1 ? 0.6 : 1.3)}deg" alt="">`).join('');
      deckEl.querySelector('b').textContent = s.deck.length;
      const myTurn = s.turn === me && s.winner < 0 && !done;
      deckEl.classList.toggle('go', myTurn && !s.skip && !busy);
      // stav stolu: změněná barva, sedmy, eso
      let info = '';
      if (C.rankOf(C.top(s)) === C.SVRSEK) info += `<span class="pr-chip">${L('barva', 'suit')} ${K.suitSvg(s.suit, 20)}</span>`;
      if (s.draw) info += `<span class="pr-chip hot">+${s.draw}</span>`;
      if (s.skip) info += `<span class="pr-chip hot">${L('stojí se', 'skip')}</span>`;
      infoEl.innerHTML = info;
      // ruka
      const hand = sortHand(s.hands[me]);
      handEl.style.setProperty('--n', hand.length);
      handEl.innerHTML = hand.map(c => `<button class="pr-card${myTurn && !busy && C.canPlay(s, c) ? ' ok' : ''}${flash === 'draw' && s.hands[me].indexOf(c) >= s.hands[me].length - 2 ? ' pr-new' : ''}" data-c="${c}"><img src="${K.src(c, en)}" alt=""></button>`).join('');
      standEl.hidden = !(myTurn && s.skip);
      // stav hry slovy
      let st;
      if (s.winner >= 0) st = s.winner === me ? L('Vyhrál jsi!', 'You won!') : L(`Vyhrává ${names[s.winner]}`, `${names[s.winner]} wins`);
      else if (myTurn) {
        if (s.draw) st = L(`Přebij sedmou, nebo si lízni ${s.draw}`, `Play a seven or draw ${s.draw}`);
        else if (s.skip) st = L('Přebij esem, nebo stojíš', 'Play an ace or skip your turn');
        else st = C.legal(s).some(a => a.t === 'p') ? L('Jsi na tahu: zahraj kartu, nebo si lízni', 'Your turn: play a card or draw') : L('Nemáš co hrát: lízni si z balíčku', 'Nothing to play: draw a card');
      } else st = online ? L(`Táhne ${names[s.turn]}…`, `${names[s.turn]} to move…`) : L(`${names[s.turn]} přemýšlí…`, `${names[s.turn]} is thinking…`);
      statusEl.innerHTML = `<b>${st}</b>${lastBy >= 0 && lastBy !== me && s.winner < 0 ? `<span>${lastAct}</span>` : ''}`;
      flash = null;
    }
    let lastAct = '';
    function describe(p, a) {
      const who = names[p];
      if (a.t === 'p') return C.rankOf(a.c) === C.SVRSEK && a.suit != null ? L(`${who}: ${cardName(a.c)} → ${SUITS[a.suit]}`, `${who}: ${cardName(a.c)} → ${SUITS[a.suit]}`) : `${who}: ${cardName(a.c)}`;
      if (a.t === 'd') return L(`${who} si líznul`, `${who} drew`);
      return L(`${who} stojí`, `${who} skips`);
    }

    function act(a, byMe) {
      if (done || !C.valid(s, a)) return false;
      const p = s.turn;
      if (byMe) myMoves++;
      lastBy = p; lastAct = describe(p, a);
      C.apply(s, a);
      flash = a.t === 'p' ? 'play' : p === me ? 'draw' : null;
      api.sound(a.t === 'p' ? (C.rankOf(a.c) === C.SEDMA || C.rankOf(a.c) === C.ESO ? 'line' : 'place') : 'soft');
      if (online && byMe) net.send(C.encode(a));
      render(); api.changed();
      if (s.winner >= 0) { finish(); return true; }
      schedule();
      return true;
    }
    function schedule() {
      if (done || s.winner >= 0) return;
      if (s.turn === me) {
        // přebít nemám čím: sedmy se líznou a eso se odstojí samo
        if ((s.draw || s.skip) && !C.legal(s).some(a => a.t === 'p')) { busy = true; render(); setTimeout(() => { busy = false; act(s.skip ? { t: 's' } : { t: 'd' }, true); }, 1100); }
        return;
      }
      if (online) return;
      busy = true;
      setTimeout(() => { busy = false; if (!done) act(C.ai(s, P.level, r), false); }, 850 + r() * 400);
    }
    function finish() {
      done = true; api.setTimer(false);
      if (online) { setTimeout(() => net.end(s.winner === 0 ? 1 : -1, 'cards'), 600); return; }
      const left = s.hands.reduce((x, h, i) => (i === me ? x : x + h.length), 0);
      setTimeout(() => {
        if (s.winner === me) api.solved({ title: L('Vyhrál jsi!', 'You won!'), stars: myMoves <= 6 ? 3 : myMoves <= 10 ? 2 : 1, html: `<p class="k-muted">${L(`Tahy: ${myMoves} · soupeřům zbylo ${left} karet`, `Moves: ${myMoves} · opponents left with ${left} cards`)}</p>` });
        else api.failed({ title: L(`Vyhrál ${names[s.winner]}`, `${names[s.winner]} won`), html: `<p class="k-muted">${L(`V ruce ti zbylo ${s.hands[me].length} karet`, `You were left with ${s.hands[me].length} cards`)}</p>` });
      }, 900);
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
      if (b && picking != null) act({ t: 'p', c: picking, suit: +b.dataset.su }, true);
      if (b || e.target === pickEl) { picking = null; pickEl.hidden = true; }
    });
    deckEl.addEventListener('click', () => { if (!done && !busy && s.turn === me && !s.skip) act({ t: 'd' }, true); });
    standEl.addEventListener('click', () => { if (!done && !busy && s.turn === me && s.skip) act({ t: 's' }, true); });
    $('.pr-resign').addEventListener('click', () => { if (done) return; done = true; if (online) net.resign(); else api.failed({ title: L('Vzdáno', 'Resigned') }); });
    if (online) net.onMove = m => { const a = C.decode(m); if (a && s.turn !== me) act(a, false); };

    render(); api.setTimer(true);
    if (s.winner >= 0) finish(); else schedule();
    return {
      getState: () => (done || online ? null : { s, myMoves }),
      destroy() { done = true; },
      onKey(e) {
        if (e.key === ' ' || e.key === 'd' || e.key === 'D') { e.preventDefault(); deckEl.click(); }
      },
      _state: () => ({ turn: s.turn, me, hand: s.hands[me].slice(), top: C.top(s), suit: s.suit, draw: s.draw, skip: s.skip, winner: s.winner, counts: s.hands.map(h => h.length) }),
      // autopilot pro testy: za hráče hraje počítač
      _autoplay() { const go = () => { if (done || s.winner >= 0) return; if (s.turn === me && !busy) act(C.ai(s, 3, r), true); setTimeout(go, 120); }; go(); },
      _solve() { s.winner = me; finish(); },
    };
  }

  function art(el) {
    const cards = [[5, -14, -60, -10], [15, -4, -20, 0], [24, 6, 20, 6], [7, 16, 60, 14]];
    el.innerHTML = `<div class="pr-art">${cards.map(([c, r, x, y]) => `<img src="${PrsiCards.src(c, Kit.lang === 'en')}" style="transform:translate(${x}px,${y}px) rotate(${r}deg)" alt="">`).join('')}</div>`;
  }
  return { DIFFS, generate, create, art };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'prsi', title: 'PRŠÍ', wording: 'win',
  tagline: Kit.L('Česká karetní klasika s mariášovými kartami: zbav se všech karet dřív než soupeři. Sedma bere dvě, eso stojí a svršek mění barvu.', 'The Czech card classic with German-suited cards: get rid of all your cards before the others. A seven makes the next player draw two, an ace skips and an Ober changes the suit.'),
  diffs: Prsi.DIFFS, generate: Prsi.generate, create: Prsi.create, art: Prsi.art,
  online: { kind: 'turn' },
  dailyDiff: () => 'jeden', levelDiff: n => (n <= 40 ? 'jeden' : n <= 80 ? 'dva' : 'tri'),
  rules: Kit.L(`<p>Každý dostane čtyři karty, jedna se otočí. Hráči se střídají a přikládají kartu <b>stejné barvy nebo hodnoty</b>. Kdo nemůže nebo nechce, lízne si z balíčku. Vyhrává, kdo se první zbaví všech karet.</p>
    <ul><li><b>Sedma:</b> další hráč si lízne dvě karty, nebo přebije sedmou a líže se čtyři, šest, osm…</li>
    <li><b>Eso:</b> další hráč stojí, nebo přebije esem.</li>
    <li><b>Svršek</b> jde zahrát na cokoli (kromě sedmy a esa, které se přebíjejí) a hráč jím zvolí novou barvu.</li>
    <li>Když dojde balíček, zamíchá se odhazovací (kromě vrchní karty).</li>
    <li><b>Online</b> se hraje ve dvou, balíček je u obou stejný.</li>
    <li>Tři hvězdy za výhru do šesti tahů.</li></ul>`,
    `<p>Everyone gets four cards and one is turned up. Players take turns adding a card of the <b>same suit or rank</b>. If you cannot or do not want to play, draw from the deck. The first to get rid of all cards wins.</p>
    <ul><li><b>Seven:</b> the next player draws two cards, or plays another seven and the draw grows to four, six, eight…</li>
    <li><b>Ace:</b> the next player skips a turn, or plays an ace too.</li>
    <li>An <b>Ober</b> can be played on anything (except a pending seven or ace) and its player picks a new suit.</li>
    <li>When the deck runs out, the discard pile (except its top card) is shuffled back.</li>
    <li><b>Online</b> is a two-player game with the same deck for both.</li>
    <li>Three stars for a win within six moves.</li></ul>`),
  achievements: [],
});
