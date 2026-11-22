'use strict';
// ── VESNIČKA · ekonomika: stav, výnos, nákupy, čas bez hráče, pověsti, úspěchy, úkoly dne ──
// Žádné DOM: totéž běží v prohlížeči i v simulaci v Node (vyvažování).
const SAVE_KEY = 'vesnicka.save.v1', STATS_KEY = 'gamecenter.stats.vesnicka';

const Econ = (() => {
  const now = () => Date.now();
  // Pojistka proti NaN a nekonečnu: všechno, co se přičítá, je konečné kladné číslo nejvýš MAXV.
  const MAXV = 1e300;
  const fin = x => (x > 0 ? (x < MAXV ? x : MAXV) : 0);
  function fresh() {
    return {
      v: 2, coins: 0, earnedGen: 0, earnedAll: 0,
      owned: Object.fromEntries(BUILDINGS.map(b => [b.id, 0])),
      // buys: kolik nákupů řemesla proběhlo (podle toho cena; za mistrovstvím přinese nákup víc kusů)
      buys: Object.fromEntries(BUILDINGS.map(b => [b.id, 0])),
      upg: {}, legends: 0, spent: 0, steward: false, gen: 1, taps: 0, caught: {}, buffs: [], ach: {},
      elan: ELAN_MAX, tree: {},
      daily: null, nextCreature: 25,
      // won: kdy hráč vyhrál (0 = hraje se); paused: vybral si pauzu (hra stojí, jen k prohlížení)
      won: 0, paused: false,
      // Cech: a = kolik kusů každého stupně je (i vyučených, s desetinami), b = kolik se jich koupilo (podle toho cena a pečeti).
      cech: { a: CECH.map(() => 0), b: CECH.map(() => 0) },
      stats: { playTime: 0, bought: 0, upgrades: 0, milestones: 0, seasons: {}, night: 0, awayMax: 0, dailyAll: 0, bestRate: 0, started: now(), genStart: now(), missed: 0, maxBuildings: 0, stewardBuys: 0, nesro: 0, cechOpen: 0, ucniMax: 0, cechBought: 0, cechSeals: 0, buys: 0, warps: 0, rushes: 0, comboMax: 1, stars: 0, autoBuys: 0 },
      // ab: pomocníci z rodokmenu, které hráč vypnul (id řemesla → false)
      settings: { sound: true, sci: false, quick: true, auto: true, music: true, musicVol: 55, sfxVol: 100, mute: false, ab: {} },
      seen: {},
      t: now(),
    };
  }

  // ── Součty ──
  const total = S => BUILDINGS.reduce((a, b) => a + (S.owned[b.id] || 0), 0);
  const caughtAll = S => CREATURES.reduce((a, c) => a + (S.caught[c.id] || 0), 0);
  // Vylepšení podle druhu (sčítají se často, ať se neprochází všech ~170 pokaždé).
  const BY_KIND = {};
  for (const u of UPGRADES) (BY_KIND[u.kind] = BY_KIND[u.kind] || []).push(u);
  const upgSum = (S, kind) => { let v = 0; for (const u of BY_KIND[kind] || []) if (S.upg[u.id]) v += u.v; return v; };
  const TIER_IDS = BUILDINGS.map(b => TIER_REQ.map((_, t) => b.id + (t + 1)));
  const CTIER_IDS = CECH.map(t => CECH_TIER_REQ.map((_, k) => 'c' + t.id + (k + 1)));
  /** Pověsti získané celkem (i utracené za šafáře): podle nich se odemyká kronika. */
  const legendsTotal = S => S.legends + (S.spent || 0);
  const perks = S => PERKS.filter(p => legendsTotal(S) >= p.n);
  const perkSum = (S, id) => perks(S).filter(p => p.id === id).reduce((a, p) => a + (p.v || 1), 0);
  const perkMax = (S, id) => perks(S).filter(p => p.id === id).reduce((a, p) => Math.max(a, p.v || 1), 0);
  const milestonesOf = n => msOf(n);
  const nextMilestone = n => MILESTONES[msOf(n)] || null;
  /** Kolik kusů přinese jeden nákup řemesla (dvojčata: 2^mistrovství). */
  const perBuy = (S, i) => Math.pow(2, msOf(S.owned[BUILDINGS[i].id]));
  // Rodokmen
  const treeSum = (S, kind) => { let v = 0; for (const t of TREE) if (t.kind === kind && S.tree[t.id]) v += t.v; return v; };
  const treeProd = (S, kind) => { let v = 1; for (const t of TREE) if (t.kind === kind && S.tree[t.id]) v *= t.v; return v; };
  const milestoneBase = S => perkMax(S, 'milestone') || 2;
  const seasonMul = S => 2 + upgSum(S, 'season') + perkSum(S, 'season');
  const buff = (S, kind) => S.buffs.filter(b => b.kind === kind).reduce((a, b) => a * b.mul, 1);
  const upgCount = (S, i) => { let k = 0; for (const id of TIER_IDS[i]) if (S.upg[id]) k++; return k; };

  /** Násobek jednoho řemesla bez sousedské výpomoci (mistrovství, vylepšení, sezóna). */
  function bMul0(S, i, season) {
    const b = BUILDINGS[i];
    return Math.pow(milestoneBase(S), msOf(S.owned[b.id])) * Math.pow(2, upgCount(S, i)) * (b.season === season ? seasonMul(S) : 1);
  }
  /** Jak moc řemeslo i pomáhá všem řemeslům pod sebou (×1,25 s prvním kusem, +0,1 za mistrovství). */
  const help = (S, i) => { const n = S.owned[BUILDINGS[i].id]; return n > 0 ? 1 + SYN_FIRST + SYN_MS * msOf(n) : 1; };
  /** Sousedská výpomoc pro řemeslo i: součin pomoci všech vyšších řemesel. */
  function syn(S, i) { let v = 1; for (let j = i + 1; j < BUILDINGS.length; j++) v *= help(S, j); return v; }
  const bMul = (S, i, season) => bMul0(S, i, season) * syn(S, i);
  const achCount = S => Object.keys(S.ach).length;

  // ── Cech ──
  const NC = CECH.length;
  const cechOpen = S => !!S.stats.cechOpen;
  const sealsOf = n => { let k = 0; while (k < CECH_SEALS.length && n >= CECH_SEALS[k]) k++; return k; };
  const nextSeal = n => CECH_SEALS.find(m => m > n) || null;
  const cUpg = (S, i) => { let k = 0; for (const id of CTIER_IDS[i]) if (S.upg[id]) k++; return k; };
  /** Stupeň je k mání: dost pověstí a od nižšího stupně aspoň jeden kus. */
  const cechTierOpen = (S, i) => cechOpen(S) && legendsTotal(S) >= CECH[i].leg && (i === 0 || S.cech.a[i - 1] >= 1 || S.cech.b[i] > 0);
  /** Násobek vyučování stupně i >= 1 (pečeti, vylepšení, kronika). */
  const cTierMul = (S, i) => Math.pow(2, sealsOf(S.cech.b[i]) + cUpg(S, i)) * (perkMax(S, 'cech') || 1);
  /** Jak dobře učni pracují (pečeti a vylepšení učňů). */
  const cU = S => Math.pow(CECH_SEAL_U, sealsOf(S.cech.b[0])) * Math.pow(CECH_UPG_U, cUpg(S, 0));
  const cSeason = (S, season) => (season === 3 ? CECH_WINTER + perkSum(S, 'cwinter') : 1);
  /** Kolik kusů nižšího stupně vyučí jeden kus stupně i za sekundu (i >= 1). */
  const cRate = (S, i, season = seasonAt(now()), buffs = true) => CECH_RATE * cTierMul(S, i) * cSeason(S, season) * (buffs ? buff(S, 'cech') : 1);
  /** Kolik přidá každý desetinásobek učňů (0,08 = +8 %). */
  const cechPct = S => CECH_PCT + upgSum(S, 'cb') + perkSum(S, 'cbase');
  const cechAl = S => Math.log10(1 + cechPct(S));
  // (1 + pct) ^ log10(1 + učni) = (1 + učni) ^ log10(1 + pct)
  const mOf = (ucni, al) => Math.pow(1 + ucni, al);
  /** Násobek výnosu od učňů: každý desetinásobek učňů ho zvedne o cechPct. */
  const cMulOf = (S, ucni, al = cechAl(S)) => mOf(ucni, al) * cU(S);
  const cMul = S => (cechOpen(S) ? cMulOf(S, S.cech.a[0]) : 1);
  /**
   * Přesný vývoj cechu za čas tau se stálými rychlostmi p (p[i]: kolik kusů stupně i-1 vyučí kus stupně i za s):
   * a_j(tau) = součet přes m >= j: a_m · p_{j+1}·…·p_m · tau^(m-j) / (m-j)!  (mnohočlen v čase, jako v pohádce o kaši).
   */
  function cechEvolve(a, p, tau) {
    const out = a.slice();
    for (let j = 0; j < NC; j++) {
      let v = a[j], f = 1;
      for (let m = j + 1; m < NC; m++) { f *= (p[m] * tau) / (m - j); if (!a[m]) continue; v += a[m] * f; }
      out[j] = Math.min(1e300, v);
    }
    return out;
  }
  /** Učni za tau sekund (koeficienty mnohočlenu a0(tau) = c0 + c1 tau + c2 tau² + …). */
  function ucniPoly(a, p) {
    const c = [a[0]];
    let f = 1;
    for (let m = 1; m < NC; m++) { f *= p[m] / m; c.push(a[m] * f); }
    return c;
  }
  const polyAt = (c, x) => { let v = 0; for (let k = c.length - 1; k >= 0; k--) v = v * x + c[k]; return v; };
  /** Integrál násobku učňů přes [0, tau] (Simpsonovo pravidlo; n sudé). */
  function cMulIntegral(S, c, tau, n = 8, U = cU(S), al = cechAl(S)) {
    const h = tau / n;
    let sum = 0;
    for (let k = 0; k <= n; k++) sum += (k === 0 || k === n ? 1 : k % 2 ? 4 : 2) * mOf(Math.max(0, polyAt(c, k * h)), al);
    return (U * sum * h) / 3;
  }
  const cRates = (S, season, buffs = true) => CECH.map((_, i) => (i ? cRate(S, i, season, buffs) : 0));

  /** Násobek celé vesnice: úspěchy, pověsti, vesnická vylepšení, cech, kouzla bytostí. */
  function gMul(S, buffs = true, chain = true) {
    return (1 + ACH_BONUS * achCount(S)) * (1 + LEGEND_BONUS * S.legends) * (1 + upgSum(S, 'g')) * (perkMax(S, 'golden') || 1) * treeProd(S, 'mul') * (chain ? cMul(S) : 1) * (buffs ? buff(S, 'rate') : 1);
  }
  const bRate = (S, i, season = seasonAt(now()), buffs = true) => fin(BUILDINGS[i].prod * S.owned[BUILDINGS[i].id] * bMul(S, i, season) * gMul(S, buffs));
  function rate(S, season = seasonAt(now()), buffs = true, chain = true) {
    let r = 0, acc = 1;
    // shora dolů: acc = pomoc všech vyšších řemesel
    for (let i = BUILDINGS.length - 1; i >= 0; i--) {
      const b = BUILDINGS[i], n = S.owned[b.id];
      if (n > 0) { r += b.prod * n * bMul0(S, i, season) * acc; acc *= help(S, i); }
    }
    return fin(r * gMul(S, buffs, chain));
  }
  /** Kolik vydělá jedno klepnutí do vesnice. */
  function tapValue(S, season) {
    let mul = 1, pct = 0;
    for (const id in S.upg) { const u = U_INDEX[id]; if (u && u.kind === 'tap') { if (u.v === 'x2') mul *= 2; else pct += u.v; } }
    return fin((mul + pct * rate(S, season)) * treeProd(S, 'tap') * buff(S, 'tap'));
  }

  // ── Nákupy ──
  const discount = S => buff(S, 'cost') * (1 - perkSum(S, 'cheap'));
  /** Cena q nákupů řemesla (každý další ×1,15; počítají se nákupy, ne kusy). */
  function costOf(S, i, q = 1) {
    const b = BUILDINGS[i], k = S.buys[b.id];
    const c = b.cost * Math.pow(COST_GROWTH, k) * (Math.pow(COST_GROWTH, q) - 1) / (COST_GROWTH - 1) * discount(S);
    return c === c ? c : Infinity;
  }
  /** Kolik nákupů řemesla se vejde do měšce. */
  function maxAfford(S, i) {
    const b = BUILDINGS[i], first = b.cost * Math.pow(COST_GROWTH, S.buys[b.id]) * discount(S);
    if (!(S.coins >= first)) return 0;
    let n = Math.floor(Math.log(1 + (S.coins * (COST_GROWTH - 1)) / first) / Math.log(COST_GROWTH));
    if (!(n >= 1)) n = 1;
    n = Math.min(n, 1e4);
    while (n > 1 && costOf(S, i, n) > S.coins) n--; // zaokrouhlení
    return n;
  }
  /** Koupí q nákupů řemesla (q = 'max': kolik se vejde); vrací události (kusy, mistrovství, první stavba). */
  function buy(S, i, q) {
    if (q === 'max') q = maxAfford(S, i);
    q = Math.floor(q);
    if (!(q >= 1)) return null;
    const cost = costOf(S, i, q);
    if (!(cost <= S.coins * (1 + 1e-9))) return null;
    const b = BUILDINGS[i], before = S.owned[b.id], units = unitsFor(before, q);
    S.coins = Math.max(0, S.coins - cost);
    S.owned[b.id] = Math.min(MAXV, before + units);
    S.buys[b.id] += q;
    S.stats.bought += units;
    S.stats.buys += q;
    const ev = { n: units, q, first: before === 0, milestones: [] };
    for (let k = msOf(before), k1 = msOf(S.owned[b.id]); k < k1; k++) ev.milestones.push(MILESTONES[k]);
    S.stats.milestones += ev.milestones.length;
    return ev;
  }
  // ── Nákupy do cechu ──
  function cechCost(S, i, n = 1) {
    const t = CECH[i], k = S.cech.b[i];
    return t.cost * Math.pow(t.grow, k) * (Math.pow(t.grow, n) - 1) / (t.grow - 1) * discount(S);
  }
  function cechMax(S, i) {
    const t = CECH[i], first = t.cost * Math.pow(t.grow, S.cech.b[i]) * discount(S);
    if (S.coins < first || !cechTierOpen(S, i)) return 0;
    let n = Math.floor(Math.log(1 + (S.coins * (t.grow - 1)) / first) / Math.log(t.grow));
    while (n > 1 && cechCost(S, i, n) > S.coins) n--;
    return Math.max(1, n);
  }
  /** Koupí n kusů stupně cechu (n = 'max'); vrací události (nové pečeti, první kus). */
  function cechBuy(S, i, n) {
    if (!cechTierOpen(S, i)) return null;
    if (n === 'max') n = cechMax(S, i);
    if (!(n >= 1)) return null;
    const cost = cechCost(S, i, n);
    if (cost > S.coins * (1 + 1e-9)) return null;
    const before = S.cech.b[i], first = S.cech.a[i] < 1;
    S.coins = Math.max(0, S.coins - cost);
    S.cech.b[i] = before + n;
    S.cech.a[i] += n;
    S.stats.cechBought += n;
    const ev = { n, first, seals: [] };
    for (const m of CECH_SEALS) if (before < m && before + n >= m) ev.seals.push(m);
    S.stats.cechSeals += ev.seals.length;
    return ev;
  }
  /** Cech se otevře s první kovárnou (a zůstane otevřený i dalším pokolením). */
  function cechCheck(S) {
    if (S.stats.cechOpen || !(S.owned[CECH_OPEN] > 0)) return false;
    S.stats.cechOpen = now();
    CECH_GIFT.forEach((n, i) => { S.cech.a[i] += n; });
    return true;
  }
  /** Vyhlídka za tau sekund: kolik bude učňů a jaký násobek (pro rozhraní a šafáře). */
  function cechAhead(S, tau, season = seasonAt(now())) {
    const a = cechEvolve(S.cech.a, cRates(S, season), tau);
    return { ucni: a[0], mul: cMulOf(S, a[0]) };
  }

  function reqMet(S, u) {
    const r = u.req || {};
    if (r.cb != null && S.cech.b[r.cb] < r.n) return false;
    if (r.ucni != null && S.cech.a[0] < r.ucni) return false;
    if (r.b != null && S.owned[BUILDINGS[r.b].id] < r.n) return false;
    if (r.taps != null && S.taps < r.taps) return false;
    if (r.total != null && total(S) < r.total) return false;
    if (r.caught != null && caughtAll(S) < r.caught) return false;
    return true;
  }
  const upgCost = (S, u) => u.cost * buff(S, 'cost');
  /** Vylepšení, která se dají koupit (podmínka splněna), od nejlevnějšího. */
  const upgAvailable = S => UPGRADES.filter(u => !S.upg[u.id] && reqMet(S, u)).sort((a, b) => a.cost - b.cost);
  function buyUpg(S, id) {
    const u = U_INDEX[id];
    if (!u || S.upg[id] || !reqMet(S, u)) return false;
    const c = upgCost(S, u);
    if (c > S.coins * (1 + 1e-9)) return false;
    S.coins = Math.max(0, S.coins - c);
    S.upg[id] = 1;
    S.stats.upgrades++;
    return true;
  }

  // ── Nejlepší koupě (rychlý nákup a šafář) ──
  // Průměrný výnos přes čtyři roční období v uzavřeném tvaru: každé řemeslo má sezónu jedno
  // období ze čtyř, takže jeho průměrný násobek je (3 + sezónní násobek) / 4.
  function evalCtx(S) {
    const mb = milestoneBase(S), sm = seasonMul(S), g = gMul(S, false), N = BUILDINGS.length, part = new Array(N), sy = new Array(N);
    let acc = 1;
    for (let i = N - 1; i >= 0; i--) { sy[i] = acc; acc *= help(S, i); }
    let B = 0;
    const pre = []; // pre[i]: výnos všech řemesel pod i (těm pomáhá)
    for (let i = 0; i < N; i++) {
      const b = BUILDINGS[i], n = S.owned[b.id], u = Math.pow(2, upgCount(S, i));
      const one = b.prod * u, c = one * n * Math.pow(mb, msOf(n)) * sy[i];
      pre.push(B);
      part[i] = { one, c, n, syn: sy[i], h: help(S, i) }; B += c;
    }
    return { mb, sm, g, part, pre, B, avg: g * B * (3 + sm) / 4, k: g * (3 + sm) / 4 };
  }
  /** O kolik (bez celkového násobku) zvedne výnos jeden nákup řemesla i: jeho kusy, mistrovství a pomoc řemeslům pod ním. */
  function buyGain(E, i) {
    const p = E.part[i], n2 = p.n + Math.pow(2, msOf(p.n)), k2 = msOf(n2);
    const c2 = p.one * n2 * Math.pow(E.mb, k2) * p.syn, h2 = 1 + SYN_FIRST + SYN_MS * k2;
    return (c2 - p.c) + E.pre[i] * (h2 / p.h - 1);
  }
  /**
   * To, co se vyplatí koupit nejdřív: nejkratší čas, než se nákup zaplatí, včetně čekání na groše.
   * tapsPerSec: jak rychle hráč klepe (vylepšení rukou se jinak nepočítají).
   */
  function bestBuy(S, tapsPerSec = 0) {
    const E = evalCtx(S), live = Math.max(1e-9, rate(S) + tapsPerSec * tapValue(S));
    const last = BUILDINGS.reduce((a, b, i) => (S.owned[b.id] ? i : a), -1);
    let best = null;
    // Kolik sekund návratnosti smí mít nákup za cost, aby ještě porazil nejlepší dosavadní.
    const limitFor = cost => (best ? best.score - Math.max(0, (cost - S.coins) / live) : Infinity);
    const consider = (o, cost, gain) => {
      if (!(gain > 0) || !isFinite(cost)) return;
      const wait = Math.max(0, (cost - S.coins) / live), score = wait + cost / gain;
      if (!best || score < best.score) best = Object.assign(o, { cost, gain, score, wait });
    };
    for (let i = 0; i <= Math.min(BUILDINGS.length - 1, last + 1); i++) consider({ kind: 'b', i, name: BUILDINGS[i].name }, costOf(S, i, 1), E.k * buyGain(E, i));
    for (const u of upgAvailable(S)) {
      let gain = 0;
      if (u.kind === 'b') gain = E.k * E.part[u.b].c;
      else if (u.kind === 'g') gain = E.avg * u.v / (1 + upgSum(S, 'g'));
      else if (u.kind === 'season') gain = E.g * E.B * u.v / 4;
      else if (u.kind === 'tap') { if (tapsPerSec > 0) { S.upg[u.id] = 1; const a = tapValue(S); delete S.upg[u.id]; gain = (a - tapValue(S)) * tapsPerSec; } }
      else if (u.kind === 'c' || u.kind === 'cb') { const c = upgCost(S, u), tau = cechPayback(S, E, () => { S.upg[u.id] = 1; }, () => { delete S.upg[u.id]; }, c, limitFor(c)); gain = tau ? c / tau : 0; }
      else gain = E.avg * 0.04; // bytosti, kouzla, delší výdělek bez hráče
      consider({ kind: 'u', id: u.id, name: u.name, sub: u.sub }, upgCost(S, u), gain);
    }
    if (cechOpen(S)) for (let i = 0; i < NC; i++) {
      if (!cechTierOpen(S, i)) continue;
      const c = cechCost(S, i, 1), tau = cechPayback(S, E, () => { S.cech.b[i]++; S.cech.a[i]++; }, () => { S.cech.b[i]--; S.cech.a[i]--; }, c, limitFor(c));
      if (tau) consider({ kind: 'c', i, name: CECH[i].name, sub: L('Cech', 'Guild') }, c, c / tau);
    }
    return best;
  }
  /**
   * Za kolik sekund se změna cechu (nákup kusu nebo vylepšení) zaplatí: hledá tau, kdy přírůstek
   * výnosu za [0, tau] dosáhne ceny. Cech roste jako mnohočlen, takže vyšší stupně se zaplatí až časem.
   */
  function cechPayback(S, E, apply, revert, cost, limit = Infinity) {
    if (!(limit > 0)) return null;
    const g = cMul(S), base = g > 0 ? E.avg / g : 0;
    if (!(base > 0)) return null;
    const avgS = (3 + cSeason(S, 3)) / 4; // průměr přes roční období (zima je sezóna cechu)
    const state = () => ({ c: ucniPoly(S.cech.a, CECH.map((_, k) => (k ? CECH_RATE * cTierMul(S, k) * avgS : 0))), U: cU(S), pw: cechAl(S) });
    const A = state();
    apply(); const B = state(); revert();
    const gain = (tau, n = 6) => base * (cMulIntegral(S, B.c, tau, n, B.U, B.pw) - cMulIntegral(S, A.c, tau, n, A.U, A.pw));
    let hi = 4;
    while (gain(hi, 4) < cost) { hi *= 4; if (hi > 6e7 || hi / 4 > limit) return null; }
    let lo = hi / 4;
    for (let k = 0; k < 7; k++) { const mid = (lo + hi) / 2; if (gain(mid) >= cost) hi = mid; else lo = mid; }
    return hi;
  }
  /** Koupí jednu věc z bestBuy; vrací ji (s událostí stavby) nebo null. */
  function buyThing(S, b) {
    if (!b || b.cost > S.coins * (1 + 1e-9)) return null;
    if (b.kind === 'b') { const ev = buy(S, b.i, 1); return ev ? Object.assign({}, b, { ev }) : null; }
    if (b.kind === 'c') { const ev = cechBuy(S, b.i, 1); return ev ? Object.assign({}, b, { ev }) : null; }
    return buyUpg(S, b.id) ? b : null;
  }
  /** Šafář nakoupí, co se vyplatí, dokud na to jsou groše (nejvýš max věcí). */
  function stewardBuy(S, tapsPerSec = 0, max = 40) {
    const out = { n: 0, buildings: 0, upgrades: 0, cech: 0, milestones: [], firsts: [], seals: [], cfirsts: [] };
    for (let k = 0; k < max; k++) {
      const got = buyThing(S, bestBuy(S, tapsPerSec));
      if (!got) break;
      out.n++;
      if (got.kind === 'b') { out.buildings++; for (const m of got.ev.milestones) out.milestones.push([got.i, m]); if (got.ev.first) out.firsts.push(got.i); }
      else if (got.kind === 'c') { out.cech++; for (const m of got.ev.seals) out.seals.push([got.i, m]); if (got.ev.first) out.cfirsts.push(got.i); }
      else out.upgrades++;
    }
    S.stats.stewardBuys += out.n;
    return out;
  }

  // ── Rodokmen (za pověsti) a pomocníci, kteří sami kupují ──
  const treeOpen = (S, t) => t.req.every(r => S.tree[r]);
  function treeBuy(S, id) {
    const t = T_INDEX[id];
    if (!t || S.tree[id] || !treeOpen(S, t) || !(S.legends >= t.cost)) return false;
    S.legends -= t.cost;
    S.spent = (S.spent || 0) + t.cost;
    S.tree[id] = 1;
    return true;
  }
  /** Řemesla, která kupují pomocníci (i když je hráč vypnul: to řeší autoOn). */
  function autoList(S) { const out = []; for (const t of TREE) if (t.kind === 'auto' && S.tree[t.id]) out.push(...t.b); return out; }
  const autoOn = (S, i) => !(S.settings.ab && S.settings.ab[BUILDINGS[i].id] === false);
  /**
   * Pomocníci nakoupí svá řemesla, dokud další nákup stojí nejvýš AUTO_SHARE měšce
   * (na dražší věci se tak dál šetří). Vrací přehled a události (první kus, mistrovství).
   */
  function autoBuy(S, max = 60) {
    const out = { n: 0, units: 0, events: [] };
    for (const i of autoList(S)) {
      if (!autoOn(S, i)) continue;
      for (let k = 0; k < max; k++) {
        if (!(costOf(S, i, 1) <= S.coins * AUTO_SHARE)) break;
        const ev = buy(S, i, 1);
        if (!ev) break;
        out.n++; out.units += ev.n;
        if (ev.first || ev.milestones.length) out.events.push([i, ev]);
      }
    }
    S.stats.autoBuys += out.n;
    return out;
  }

  // ── Elán a jeho kouzla ──
  const elanOpen = S => !!S.seen.elan || S.earnedAll >= ELAN_OPEN || legendsTotal(S) > 0;
  const elanRegen = S => ELAN_REGEN * (1 + treeSum(S, 'elan'));
  const addElan = (S, x) => { S.elan = Math.max(0, Math.min(ELAN_MAX, (S.elan || 0) + (x > 0 ? x : 0))); };
  const powerCost = (S, id) => (id === 'warp' ? Math.max(10, POWERS.warp.cost - treeSum(S, 'warp')) : POWERS[id] ? POWERS[id].cost : Infinity);
  const rushDur = S => POWERS.rush.dur + treeSum(S, 'rush');
  /** Seslat kouzlo za elán: warp = hned 15 minut výnosu, rush = žně (výnos i klepnutí ×5). */
  function power(S, id, season = seasonAt(now())) {
    const c = powerCost(S, id);
    if (!elanOpen(S) || !(S.elan >= c - 1e-9)) return null;
    if (id === 'warp') {
      const got = fin(rate(S, season) * POWERS.warp.sec);
      S.elan -= c; earn(S, got); S.stats.warps++;
      return { id, got };
    }
    if (id === 'rush') {
      if (S.buffs.some(b => b.id === 'zne')) return null; // žně už běží
      const d = rushDur(S);
      S.elan -= c;
      addBuff(S, 'zne', 'rate', POWERS.rush.mul, d);
      addBuff(S, 'zne_tap', 'tap', POWERS.rush.mul, d);
      S.stats.rushes++;
      noteCombo(S);
      return { id, dur: d };
    }
    return null;
  }
  /** Nejvyšší kombo kouzel (součin násobků výnosu) do statistik. */
  function noteCombo(S) { const m = buff(S, 'rate'); if (m > S.stats.comboMax) S.stats.comboMax = m; return m; }

  // ── Kouzla (dočasné násobky) ──
  const durMul = S => 1 + upgSum(S, 'dur');
  function addBuff(S, id, kind, mul, dur) {
    const old = S.buffs.find(b => b.id === id);
    if (old) { old.t = Math.max(old.t, dur); old.max = Math.max(old.max, dur); old.mul = mul; return old; }
    const b = { id, kind, mul, t: dur, max: dur };
    S.buffs.push(b);
    return b;
  }

  // ── Bytosti ──
  const freqMul = S => 1 + upgSum(S, 'freq') + perkSum(S, 'freq') + treeSum(S, 'freq');
  function nextGap(S, r = Math.random) { return (CREATURE_GAP[0] + r() * (CREATURE_GAP[1] - CREATURE_GAP[0])) / freqMul(S); }
  function pickCreature(S, season, r = Math.random) {
    const w = CREATURES.map(c => {
      if (c.id === 'vodnik' && season === 3) return 0; // v zimě spí pod ledem
      if (c.id === 'hospodaricek' && total(S) < 10) return 0;
      if (c.id === 'cert' && S.taps < 20) return 0; // čert až když hráč umí klepat
      if (c.id === 'vseved' && !(S.cech.a[1] >= 1)) return 0; // Vševěd až když má cech koho učit
      if (c.id === 'hvezda' && S.taps < 5) return 0; // první je bludička
      return c.w * (c.id === 'krakonos' && season === 3 ? 2 : 1);
    });
    // Vzácný host: kamarád ze vsi, který se občas zastaví (až po prvních bytostech).
    if (caughtAll(S) >= NESRO.after && r() < NESRO.chance) return 'nesro';
    let x = r() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return CREATURES[i].id; }
    return 'bludicka';
  }
  /** Klepnutí na bytost: vrací, co přinesla. */
  function catchCreature(S, id, season = seasonAt(now())) {
    if (id === 'nesro') {
      S.stats.nesro++;
      const coins = Math.max(500, rate(S, season) * NESRO.coins);
      earn(S, coins);
      addBuff(S, 'nesro', 'rate', NESRO.mul, NESRO.dur * durMul(S));
      noteCombo(S);
      return { id, name: NESRO.name, text: NESRO.text, coins };
    }
    const c = C_INDEX[id];
    if (!c) return null;
    S.caught[id] = (S.caught[id] || 0) + 1;
    const out = { id, name: c.name, text: c.text };
    if (id === 'bludicka') {
      out.coins = Math.max(25, rate(S, season) * 150) * (S.upg.lucerna ? 2 : 1);
      earn(S, out.coins);
    } else if (id === 'vodnik') { addBuff(S, id, 'rate', c.mul, c.dur * durMul(S)); noteCombo(S); }
    else if (id === 'cert') addBuff(S, id, 'tap', c.mul, c.dur * durMul(S));
    else if (id === 'krakonos') addBuff(S, id, 'cost', 0.5, c.dur * durMul(S));
    else if (id === 'vseved') addBuff(S, id, 'cech', c.mul, c.dur * durMul(S));
    else if (id === 'hvezda') {
      // Přání: náhodné kouzlo; kouzla stejného druhu se násobí (kombo).
      const pool = WISHES.filter(w => !w.elan || elanOpen(S));
      let x = Math.random() * pool.reduce((a, w) => a + w.w, 0), w = pool[0];
      for (const it of pool) { x -= it.w; if (x < 0) { w = it; break; } }
      if (w.kind) addBuff(S, 'hvezda_' + w.id, w.kind, w.mul, w.dur * durMul(S));
      else if (w.sec) { out.coins = Math.max(50, rate(S, season) * w.sec); earn(S, out.coins); }
      else if (w.elan) addElan(S, w.elan);
      out.wish = w.id; out.text = `${c.text}: ${w.text}`;
      S.stats.stars++;
      noteCombo(S);
    }
    else if (id === 'hospodaricek') {
      let n = 0;
      for (const b of BUILDINGS) if (S.owned[b.id]) { const k = Math.max(1, Math.floor(S.owned[b.id] * 0.05)); S.owned[b.id] += k; n += k; }
      S.stats.bought += n;
      out.buildings = n;
    }
    return out;
  }

  // ── Čas ──
  function earn(S, x) {
    x = fin(x);
    S.coins = Math.min(MAXV, S.coins + x); S.earnedGen = Math.min(MAXV, S.earnedGen + x); S.earnedAll = Math.min(MAXV, S.earnedAll + x);
  }
  const offlineCap = S => (OFFLINE_BASE + upgSum(S, 'offline') + perkSum(S, 'offline')) * 3600;
  /** Výnos za uplynulý čas: po úsecích mezi změnami období a koncem kouzel. */
  function advance(S, fromMs, toMs, cap = Infinity) {
    let t = fromMs / 1000;
    const end = Math.min(toMs / 1000, t + cap);
    let got = 0;
    const chain = cechOpen(S) && S.cech.a.some(x => x > 0);
    while (t < end - 1e-6) {
      let next = Math.min(end, (Math.floor(t / SEASON_LEN + 1e-9) + 1) * SEASON_LEN);
      for (const b of S.buffs) next = Math.min(next, t + b.t);
      const dt = Math.max(0, next - t), season = seasonAt(t * 1000 + 1);
      if (chain && dt > 0) {
        // Cech roste během úseku přesně (mnohočlen), výnos se sečte přes rostoucí násobek učňů.
        const p = cRates(S, season), c = ucniPoly(S.cech.a, p);
        got += rate(S, season, true, false) * cMulIntegral(S, c, dt, dt > 2 ? 16 : 2);
        S.cech.a = cechEvolve(S.cech.a, p, dt);
        if (S.cech.a[0] > S.stats.ucniMax) S.stats.ucniMax = S.cech.a[0];
      } else got += rate(S, season) * dt;
      for (const b of S.buffs) b.t -= dt;
      S.buffs = S.buffs.filter(b => b.t > 1e-6);
      t = next + (dt === 0 ? 1e-3 : 0);
    }
    // Kouzla dobíhají i za limitem.
    const rest = toMs / 1000 - end;
    if (rest > 0) { for (const b of S.buffs) b.t -= rest; S.buffs = S.buffs.filter(b => b.t > 1e-6); }
    earn(S, got);
    return got;
  }
  /**
   * Čas bez hráče: vesnice vydělává nejvýš offlineCap sekund, šafář mezitím průběžně nakupuje.
   * Vrací přehled pro uvítání: jak dlouho byl hráč pryč, kolik z toho vesnice vydělávala a co koupil šafář.
   */
  function offline(S, fromMs, toMs) {
    const away = Math.max(0, (toMs - fromMs) / 1000), cap = offlineCap(S), earnSec = Math.min(away, cap);
    const before = S.earnedAll, ucni0 = S.cech.a[0], wasOpen = cechOpen(S), elan0 = S.elan;
    const out = { away, cap, earnSec, capped: away > cap, buys: 0, buildings: 0, upgrades: 0, cech: 0, auto: 0, autoUnits: 0 };
    const stew = S.steward && S.settings.auto, helpers = autoList(S).some(i => autoOn(S, i));
    if ((stew || helpers) && earnSec > 120) {
      const n = Math.min(240, Math.ceil(earnSec / 60)), step = (earnSec * 1000) / n;
      let t = fromMs;
      for (let k = 0; k < n; k++) {
        advance(S, t, t + step);
        t += step;
        if (stew) { const b = stewardBuy(S, 0, 60); out.buys += b.n; out.buildings += b.buildings; out.upgrades += b.upgrades; out.cech += b.cech; }
        if (helpers) { const a = autoBuy(S); out.auto += a.n; out.autoUnits += a.units; }
        cechCheck(S);
      }
      advance(S, t, toMs, 0); // kouzla dobíhají i za limitem
    } else advance(S, fromMs, toMs, cap);
    addElan(S, away * elanRegen(S)); // elán se doplňuje celou dobu (bez limitu výdělku)
    out.elan = S.elan - elan0;
    out.got = S.earnedAll - before;
    out.ucni = Math.max(0, S.cech.a[0] - ucni0);
    out.cechOpened = !wasOpen && cechOpen(S);
    if (away > S.stats.awayMax) S.stats.awayMax = away;
    return out;
  }
  /** Za kolik sekund přijdou nové úkoly dne (o půlnoci místního času). */
  function dailyLeft(ms = now()) { const d = new Date(ms), m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); return (m.getTime() - ms) / 1000; }

  /** Hraní: dt sekund s hráčem u hry. Vrací události (bytost se objevila). */
  function tick(S, dt, ms = now()) {
    if (!(dt > 0) || over(S)) return null;
    const season = seasonAt(ms);
    addElan(S, dt * elanRegen(S));
    advance(S, ms - dt * 1000, ms);
    S.stats.playTime += dt;
    S.stats.seasons[season] = 1;
    if (S.daily) S.daily.seasons[season] = 1;
    const auto = perkMax(S, 'auto');
    if (auto) earn(S, tapValue(S, season) * auto * dt);
    const r = rate(S, season, false);
    if (r > S.stats.bestRate) S.stats.bestRate = r;
    noteCombo(S);
    const tot = total(S);
    if (tot > S.stats.maxBuildings) S.stats.maxBuildings = tot;
    const h = new Date(ms).getHours();
    if (h < 4) S.stats.night = 1;
    const opened = cechCheck(S);
    S.nextCreature -= dt;
    if (S.nextCreature <= 0) { S.nextCreature = nextGap(S); return { creature: pickCreature(S, season), cechOpened: opened }; }
    return opened ? { cechOpened: true } : null;
  }
  function tap(S, season) {
    const v = tapValue(S, season);
    earn(S, v);
    S.taps++;
    return v;
  }

  // ── Pověsti ──
  const legendsFor = E => Math.floor(Math.cbrt(E / LEGEND_BASE) + 1e-9);
  const pending = S => Math.max(0, legendsFor(S.earnedAll) - legendsTotal(S));
  /** Kolik je potřeba vydělat celkem pro další pověst. */
  const nextLegendAt = S => LEGEND_BASE * Math.pow(Math.max(legendsFor(S.earnedAll), legendsTotal(S)) + 1, 3);
  /** Šafář: najme se jednou provždy za pověsti (ty se utratí, výhody kroniky zůstávají). */
  function hireSteward(S) {
    if (S.steward || S.legends < STEWARD_COST) return false;
    S.legends -= STEWARD_COST;
    S.spent = (S.spent || 0) + STEWARD_COST;
    S.steward = true;
    S.settings.auto = true;
    return true;
  }
  function prestige(S) {
    const p = pending(S);
    if (p < 1 || over(S)) return 0;
    S.legends += p;
    S.gen++;
    S.coins = 0;
    S.earnedGen = 0;
    for (const b of BUILDINGS) { S.owned[b.id] = 0; S.buys[b.id] = 0; }
    const keepHands = perkMax(S, 'hands');
    for (const id of Object.keys(S.upg)) if (!(keepHands && U_INDEX[id] && U_INDEX[id].kind === 'tap')) delete S.upg[id];
    S.buffs = [];
    const start = perkMax(S, 'start');
    if (start >= 1) S.owned.pole = 10;
    if (start >= 2) for (const b of BUILDINGS.slice(0, 4)) S.owned[b.id] = Math.max(S.owned[b.id], 10);
    // Cech začíná znovu; kronika přidá kusy zdarma (koupené počty zůstanou nulové, cenu nezvednou).
    S.cech = { a: CECH.map(() => 0), b: CECH.map(() => 0) };
    const cs = perkMax(S, 'cstart');
    if (cs >= 1) { S.cech.a[0] = 10; S.cech.a[1] = 3; }
    if (cs >= 2) for (let i = 0; i < 4; i++) S.cech.a[i] = Math.max(S.cech.a[i], 10);
    S.stats.genStart = now();
    S.nextCreature = Math.min(S.nextCreature, 30);
    return p;
  }

  // ── Konec hry ──
  /** Vyhráno: hra stojí (rozhodnutí čeká, nebo pauza), nic nevydělává ani se nekupuje. */
  const over = S => S.won > 0;
  /** Další předání vesnice bude poslední: od WIN_GEN. pokolení se vyhrává. */
  const finale = S => !over(S) && S.gen >= WIN_GEN && pending(S) >= 1;
  /** Poslední předání: pověsti se připíšou, vesnice ale zůstane celá (k prohlížení). */
  function win(S) {
    if (!finale(S)) return 0;
    const p = pending(S);
    S.legends += p;
    S.won = now();
    S.buffs = [];
    return p;
  }
  /** Pauza po výhře: všechno splněné a postavené, i to, co hráč neměl. Hra se dál nehraje. */
  function rest(S) {
    if (!over(S)) return false;
    S.paused = true;
    S.buffs = [];
    for (const a of ACHIEVEMENTS) if (!S.ach[a.id]) S.ach[a.id] = now();
    for (const t of TREE) S.tree[t.id] = 1;
    for (const u of UPGRADES) S.upg[u.id] = 1;
    for (const b of BUILDINGS) if (!(S.owned[b.id] >= 100)) S.owned[b.id] = 100; // každé stavení v nejvyšší podobě
    return true;
  }

  // ── Úspěchy ──
  function checkAch(S) {
    const got = [];
    for (const a of ACHIEVEMENTS) if (!S.ach[a.id] && a.test(S)) { S.ach[a.id] = now(); got.push(a); }
    return got;
  }

  // ── Úkoly dne ──
  function counters(S) { return { bought: S.stats.bought, buys: S.stats.buys, taps: S.taps, caught: caughtAll(S), upg: S.stats.upgrades, earned: S.earnedAll, milestones: S.stats.milestones }; }
  function nice(x) { const p = Math.pow(10, Math.floor(Math.log10(x)) - 1); return Math.ceil(x / p) * p; }
  function daily(S) {
    const day = dayKey();
    if (S.daily && S.daily.day === day) return S.daily;
    const r = rng(hash('vesnicka:' + day));
    const pool = DAILY.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const tasks = pool.slice(0, 3).map(q => ({ kind: q.kind, n: q.kind === 'earn' ? nice(Math.max(1000, rate(S) * q.n)) : q.n, claimed: false }));
    S.daily = { day, tasks, start: counters(S), seasons: {}, bonus: false };
    return S.daily;
  }
  function dailyProgress(S, task) {
    const d = S.daily, c = counters(S), s = d.start;
    const p = task.kind === 'buy' ? c.buys - (s.buys == null ? c.buys : s.buys) : task.kind === 'tap' ? c.taps - s.taps : task.kind === 'catch' ? c.caught - s.caught
      : task.kind === 'upg' ? c.upg - s.upg : task.kind === 'earn' ? c.earned - s.earned : task.kind === 'milestone' ? c.milestones - s.milestones
        : task.kind === 'season' ? Object.keys(d.seasons).length : 0;
    return Math.max(0, Math.min(task.n, p));
  }
  const dailyReward = S => Math.max(150, rate(S, seasonAt(now()), false) * DAILY_REWARD);
  /** Vyzvedne odměnu za splněný úkol; po třech úkolech přijde požehnání. */
  function claimDaily(S, i) {
    const d = daily(S), task = d.tasks[i];
    if (!task || task.claimed || dailyProgress(S, task) < task.n) return null;
    task.claimed = true;
    const coins = dailyReward(S);
    earn(S, coins);
    const out = { coins };
    if (!d.bonus && d.tasks.every(t => t.claimed)) {
      d.bonus = true;
      S.stats.dailyAll++;
      addBuff(S, 'blessing', 'rate', BLESSING.mul, BLESSING.dur);
      out.blessing = true;
    }
    return out;
  }

  // ── Uložení ──
  const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
  function load(raw) {
    const S = fresh();
    let o = null;
    try { o = JSON.parse(raw); } catch (e) { o = null; }
    if (!o || typeof o !== 'object') return S;
    for (const k of ['coins', 'earnedGen', 'earnedAll', 'legends', 'spent', 'gen', 'taps', 'nextCreature', 't']) S[k] = Math.max(0, num(o[k], S[k]));
    S.gen = Math.max(1, Math.floor(S.gen));
    S.legends = Math.floor(S.legends);
    S.spent = Math.floor(S.spent);
    S.steward = o.steward === true;
    if (o.owned) for (const b of BUILDINGS) S.owned[b.id] = Math.min(MAXV, Math.max(0, Math.floor(num(o.owned[b.id]))));
    // Starší uložení nemá nákupy: počítají se tak, kolik by jich teď stálo dostat se na stejný počet kusů.
    for (const b of BUILDINGS) S.buys[b.id] = o.buys && typeof o.buys === 'object' && o.buys[b.id] != null ? Math.max(0, Math.floor(num(o.buys[b.id]))) : buysFor(0, S.owned[b.id]);
    S.elan = Math.max(0, Math.min(ELAN_MAX, num(o.elan, ELAN_MAX)));
    if (o.tree && typeof o.tree === 'object') for (const id in o.tree) if (T_INDEX[id] && o.tree[id]) S.tree[id] = 1;
    if (o.upg) for (const id in o.upg) if (U_INDEX[id]) S.upg[id] = 1;
    if (o.caught) for (const c of CREATURES) if (o.caught[c.id]) S.caught[c.id] = Math.floor(num(o.caught[c.id]));
    if (o.cech && Array.isArray(o.cech.a) && Array.isArray(o.cech.b)) for (let i = 0; i < NC; i++) { S.cech.a[i] = Math.min(1e300, Math.max(0, num(o.cech.a[i]))); S.cech.b[i] = Math.max(0, Math.floor(num(o.cech.b[i]))); }
    if (o.ach) for (const id in o.ach) if (A_INDEX[id]) S.ach[id] = num(o.ach[id], 1);
    if (Array.isArray(o.buffs)) S.buffs = o.buffs.filter(b => b && typeof b.id === 'string' && num(b.t) > 0 && num(b.mul) > 0).map(b => ({ id: b.id, kind: b.kind, mul: b.mul, t: b.t, max: num(b.max, b.t) }));
    if (o.stats) for (const k in S.stats) { if (k === 'seasons') Object.assign(S.stats.seasons, o.stats.seasons || {}); else S.stats[k] = num(o.stats[k], S.stats[k]); }
    if (o.stats && o.stats.buys == null) S.stats.buys = BUILDINGS.reduce((a, b) => a + S.buys[b.id], 0);
    if (o.daily && typeof o.daily.day === 'string' && Array.isArray(o.daily.tasks)) {
      S.daily = Object.assign({ seasons: {}, bonus: false }, o.daily);
      S.daily.start = Object.assign({}, S.daily.start || {});
      if (S.daily.start.buys == null) S.daily.start.buys = S.stats.buys; // úkol „nakup“ počítá nákupy od teď
    }
    if (o.settings && typeof o.settings === 'object') {
      const ab = Object.assign({}, S.settings.ab, o.settings.ab && typeof o.settings.ab === 'object' ? o.settings.ab : {});
      S.settings = Object.assign(S.settings, o.settings, { ab });
    }
    if (o.seen) S.seen = Object.assign({}, o.seen);
    S.won = Math.max(0, num(o.won));
    S.paused = S.won > 0 && o.paused === true;
    return S;
  }
  /** Výsledky do žebříčků (sync.js je posílá na /api/scores): celá čísla, velká čísla jako log10 × 1000. */
  function boards(S) {
    // Server bere hodnoty do 10^10; nad tím zůstane hráč na stropu (pověsti po týdnech hraní s cechem).
    const lb = {}, put = (b, v) => { v = Math.floor(v); if (v > 0 && isFinite(v)) lb[b] = Math.min(v, 9999999999); };
    put('best:score', legendsTotal(S));
    // čas ve hře posílá sync.js za každou hru sám (total:played)
    for (const d of BOARDS) if (d.key !== 'best:score' && d.key !== 'total:played') put(d.key, d.log ? (d.get(S) > 1 ? Math.log10(d.get(S)) * 1000 : 0) : d.get(S));
    return lb;
  }
  function serialize(S) {
    const o = Object.assign({}, S, { t: now() });
    const lb = boards(S);
    if (Object.keys(lb).length) o.lb = lb;
    return JSON.stringify(o);
  }
  function hubStats(S) {
    return {
      playTime: Math.round(S.stats.playTime), lastPlayed: now(), progress: Math.min(1, achCount(S) / ACHIEVEMENTS.length),
      stats: { legends: legendsTotal(S), generation: S.gen, buildings: fmtN(total(S)), earned: fmt(S.earnedAll), creatures: caughtAll(S), achievements: `${achCount(S)} / ${ACHIEVEMENTS.length}`, ...(cechOpen(S) ? { apprentices: fmt(S.cech.a[0]) } : {}) },
    };
  }

  return {
    fresh, total, caughtAll, upgSum, legendsTotal, hireSteward, bestBuy, buyThing, stewardBuy, offline, dailyLeft, boards, perks, perkSum, perkMax, milestonesOf, nextMilestone, milestoneBase, seasonMul, buff, upgCount, bMul, gMul, bRate, rate, tapValue, achCount,
    discount, costOf, maxAfford, buy, reqMet, upgCost, upgAvailable, buyUpg, addBuff, freqMul, nextGap, pickCreature, catchCreature, durMul,
    earn, offlineCap, advance, tick, tap, legendsFor, pending, nextLegendAt, prestige, over, finale, win, rest, checkAch, daily, dailyProgress, dailyReward, claimDaily, load, serialize, hubStats,
    cechOpen, cechTierOpen, cechCost, cechMax, cechBuy, cechCheck, cechAhead, cechEvolve, cMul, cMulOf, cRate, cTierMul, cU, cechPct, cSeason, cUpg, sealsOf, nextSeal,
    perBuy, help, syn, bMul0, treeOpen, treeBuy, treeSum, treeProd, autoList, autoOn, autoBuy, elanOpen, elanRegen, addElan, powerCost, rushDur, power, noteCombo, fin,
    cechInfo: S => (cechOpen(S) ? `cech ×${fmt(cMul(S), 1)} učni ${fmt(S.cech.a[0])} b[${S.cech.b.join(',')}]` : 'cech –'),
  };
})();
