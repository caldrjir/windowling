'use strict';
// ── PRŠÍ · pravidla a počítačoví hráči (sdílí je hra i testy v Node) ─────────
// Mariášové karty: 4 barvy (srdce, listy, žaludy, kule) × 8 hodnot (7, 8, 9, 10, spodek, svršek,
// král, eso). Karta = barva * 8 + hodnota. Každý dostane 4 karty, jedna se otočí.
// Hraje se na barvu nebo hodnotu, svršek jde na cokoli a hráč jím změní barvu.
// Sedma: další bere 2 (nebo přebije sedmou a bere se 4, 6, 8). Eso: další stojí (nebo přebije esem).
// Otočená karta platí pro prvního hráče: sedma = bere 2, eso = stojí, svršek = jeho barva.
// Kdo nemůže nebo nechce hrát, lízne si kartu. Vyhrává, kdo se první zbaví všech karet; když ale
// dohraje sedmou, může ho další hráč přebitím sedmou vrátit do hry (pak bere i on).
// Balíček se míchá ze semínka, takže online oba hráči vidí stejnou hru jen z tahů.
const PrsiCore = (() => {
  const SEDMA = 0, SPODEK = 4, SVRSEK = 5, KRAL = 6, ESO = 7;
  const suitOf = c => c >> 3, rankOf = c => c & 7;
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function deal(seed, players, handSize = 4) {
    const r = rngOf(seed), deck = shuffle([...Array(32).keys()], r);
    const hands = Array.from({ length: players }, () => []);
    for (let k = 0; k < handSize; k++) for (const h of hands) h.push(deck.pop());
    // otočená karta platí pro prvního hráče
    const top = deck.pop();
    return { seed, n: players, deck, discard: [top], hands, turn: 0, suit: suitOf(top), draw: rankOf(top) === SEDMA ? 2 : 0, skip: rankOf(top) === ESO, winner: -1, pending: -1, shuffles: 0, moves: 0 };
  }
  const top = s => s.discard[s.discard.length - 1];
  function canPlay(s, c) {
    if (s.draw > 0) return rankOf(c) === SEDMA;
    if (s.skip) return rankOf(c) === ESO;
    return rankOf(c) === SVRSEK || suitOf(c) === s.suit || rankOf(c) === rankOf(top(s));
  }
  // možné tahy hráče na tahu: zahrát kartu (svršek se čtyřmi barvami), líznout nebo stát
  function legal(s) {
    const out = [];
    for (const c of s.hands[s.turn]) if (canPlay(s, c)) {
      if (rankOf(c) === SVRSEK && !s.draw && !s.skip) for (let su = 0; su < 4; su++) out.push({ t: 'p', c, suit: su });
      else out.push({ t: 'p', c });
    }
    out.push(s.skip ? { t: 's' } : { t: 'd' });
    return out;
  }
  function drawCards(s, who, n) {
    for (let k = 0; k < n; k++) {
      if (!s.deck.length) {
        if (s.discard.length <= 1) return;
        const t = s.discard.pop();
        s.deck = shuffle(s.discard, rngOf((s.seed ^ 0x51ed) + ++s.shuffles * 7919));
        s.discard = [t];
      }
      s.hands[who].push(s.deck.pop());
    }
  }
  function valid(s, a) {
    if (s.winner >= 0) return false;
    if (a.t === 'p') return s.hands[s.turn].includes(a.c) && canPlay(s, a.c) && (rankOf(a.c) !== SVRSEK || s.draw || s.skip || (a.suit >= 0 && a.suit < 4));
    if (a.t === 'd') return !s.skip;
    if (a.t === 's') return s.skip;
    return false;
  }
  function apply(s, a) {
    const me = s.turn, hand = s.hands[me];
    s.moves++;
    if (a.t === 'p') {
      hand.splice(hand.indexOf(a.c), 1);
      s.discard.push(a.c);
      const rk = rankOf(a.c);
      s.suit = rk === SVRSEK && a.suit != null ? a.suit : suitOf(a.c);
      if (rk === SEDMA) s.draw += 2;
      if (rk === ESO) s.skip = true;
      if (rk === SEDMA && s.pending >= 0) s.pending = -1;          // přebito sedmou: dohravší se vrací do hry
      if (!hand.length) {
        if (rk !== SEDMA) { s.winner = me; return s; }
        s.pending = me;                                           // dohrál sedmou: vyhrává, když ho další nepřebije
      }
    } else if (a.t === 'd') {
      drawCards(s, me, s.draw || 1); s.draw = 0;
      if (s.pending >= 0) { s.winner = s.pending; s.pending = -1; return s; }
    } else s.skip = false;
    s.turn = (me + 1) % s.n;
    return s;
  }
  const encode = a => (a.t === 'p' ? 'p' + a.c + (a.suit != null ? '.' + a.suit : '') : a.t);
  function decode(m) {
    if (m === 'd' || m === 's') return { t: m };
    const x = /^p(\d{1,2})(?:\.(\d))?$/.exec(m);
    return x ? { t: 'p', c: +x[1], suit: x[2] != null ? +x[2] : undefined } : null;
  }
  const clone = s => ({ pending: -1, ...s, deck: s.deck.slice(), discard: s.discard.slice(), hands: s.hands.map(h => h.slice()) });

  // ── Počítačový hráč ──
  // level 1: hraje skoro náhodně; 2: drží svršky na později, útočí sedmou na slabého soupeře;
  // 3: navíc hlídá, kolik karet má další hráč, a barvu volí podle svých karet.
  function ai(s, level, r) {
    const me = s.turn, hand = s.hands[me], nxt = s.hands[(me + 1) % s.n].length;
    const acts = legal(s), plays = acts.filter(a => a.t === 'p'), pass = acts.find(a => a.t !== 'p');
    if (!plays.length) return pass;
    if (s.draw > 0 || s.skip) return level === 1 && r() < 0.25 ? pass : plays[0];
    if (level === 1 && r() < 0.5) {
      const p = plays[Math.floor(r() * plays.length)];
      return rankOf(p.c) === SVRSEK ? { t: 'p', c: p.c, suit: bestSuit(hand, p.c) } : p;
    }
    let best = null, bestV = -Infinity;
    for (const a of plays) {
      if (rankOf(a.c) === SVRSEK && a.suit !== bestSuit(hand, a.c)) continue;
      const rk = rankOf(a.c), su = suitOf(a.c);
      let v = hand.filter(c => suitOf(c) === su && c !== a.c).length * 1.2 + (rk === KRAL || rk === SPODEK ? 0.2 : 0) + r() * 0.6;
      if (rk === SVRSEK) v -= hand.length > 2 ? 6 : 0;                         // svršek až nakonec
      if (rk === SEDMA) v += level >= 3 && nxt <= 2 ? 5 : 1;                   // sedma na soupeře, který končí
      if (rk === ESO) v += level >= 3 && nxt <= 2 ? 4 : 0.8;
      if (hand.length === 2 && level >= 2) {                                  // poslední karta musí jít zahrát
        const rest = hand.find(c => c !== a.c);
        if (rankOf(rest) === SVRSEK || suitOf(rest) === (rk === SVRSEK ? a.suit : su)) v += 3;
      }
      if (v > bestV) { bestV = v; best = a; }
    }
    return best || plays[0];
  }
  function bestSuit(hand, except) {
    const cnt = [0, 0, 0, 0];
    for (const c of hand) if (c !== except && rankOf(c) !== SVRSEK) cnt[suitOf(c)]++;
    return cnt.indexOf(Math.max(...cnt));
  }

  return { SEDMA, SPODEK, SVRSEK, KRAL, ESO, suitOf, rankOf, rngOf, deal, top, canPlay, legal, valid, apply, encode, decode, clone, ai, bestSuit };
})();
if (typeof module !== 'undefined') module.exports = PrsiCore;
