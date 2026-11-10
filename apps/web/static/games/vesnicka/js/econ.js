'use strict';
// ── VESNIČKA · ekonomika: stav, výnos, nákupy, čas bez hráče, pověsti, úspěchy, úkoly dne ──
// Žádné DOM: totéž běží v prohlížeči i v simulaci v Node (vyvažování).
const SAVE_KEY = 'vesnicka.save.v1', STATS_KEY = 'gamecenter.stats.vesnicka';

const Econ = (() => {
  const now = () => Date.now();
  function fresh() {
    return {
      v: 1, coins: 0, earnedGen: 0, earnedAll: 0,
      owned: Object.fromEntries(BUILDINGS.map(b => [b.id, 0])),
      upg: {}, legends: 0, spent: 0, steward: false, gen: 1, taps: 0, caught: {}, buffs: [], ach: {},
      daily: null, nextCreature: 25,
      stats: { playTime: 0, bought: 0, upgrades: 0, milestones: 0, seasons: {}, night: 0, awayMax: 0, dailyAll: 0, bestRate: 0, started: now(), genStart: now(), missed: 0, maxBuildings: 0, stewardBuys: 0, nesro: 0 },
      settings: { sound: true, sci: false, quick: true, auto: true },
      seen: {},
      t: now(),
    };
  }

  // ── Součty ──
  const total = S => BUILDINGS.reduce((a, b) => a + (S.owned[b.id] || 0), 0);
  const caughtAll = S => CREATURES.reduce((a, c) => a + (S.caught[c.id] || 0), 0);
  const upgSum = (S, kind) => { let v = 0; for (const id in S.upg) { const u = U_INDEX[id]; if (u && u.kind === kind) v += u.v; } return v; };
  /** Pověsti získané celkem (i utracené za šafáře): podle nich se odemyká kronika. */
  const legendsTotal = S => S.legends + (S.spent || 0);
  const perks = S => PERKS.filter(p => legendsTotal(S) >= p.n);
  const perkSum = (S, id) => perks(S).filter(p => p.id === id).reduce((a, p) => a + (p.v || 1), 0);
  const perkMax = (S, id) => perks(S).filter(p => p.id === id).reduce((a, p) => Math.max(a, p.v || 1), 0);
  const milestonesOf = n => { let k = 0; while (k < MILESTONES.length && n >= MILESTONES[k]) k++; return k; };
  const nextMilestone = n => MILESTONES.find(m => m > n) || null;
  const milestoneBase = S => perkMax(S, 'milestone') || 2;
  const seasonMul = S => 2 + upgSum(S, 'season') + perkSum(S, 'season');
  const buff = (S, kind) => S.buffs.filter(b => b.kind === kind).reduce((a, b) => a * b.mul, 1);
  const upgCount = (S, i) => { let k = 0; for (let t = 1; t <= TIER_REQ.length; t++) if (S.upg[BUILDINGS[i].id + t]) k++; return k; };

  /** Násobek jednoho řemesla (mistrovství, vylepšení, sezóna). */
  function bMul(S, i, season) {
    const b = BUILDINGS[i];
    return Math.pow(milestoneBase(S), milestonesOf(S.owned[b.id])) * Math.pow(2, upgCount(S, i)) * (b.season === season ? seasonMul(S) : 1);
  }
  const achCount = S => Object.keys(S.ach).length;
  /** Násobek celé vesnice: úspěchy, pověsti, vesnická vylepšení, kouzla bytostí. */
  function gMul(S, buffs = true) {
    return (1 + ACH_BONUS * achCount(S)) * (1 + LEGEND_BONUS * S.legends) * (1 + upgSum(S, 'g')) * (buffs ? buff(S, 'rate') : 1);
  }
  const bRate = (S, i, season = seasonAt(now()), buffs = true) => BUILDINGS[i].prod * S.owned[BUILDINGS[i].id] * bMul(S, i, season) * gMul(S, buffs);
  function rate(S, season = seasonAt(now()), buffs = true) {
    let r = 0;
    for (let i = 0; i < BUILDINGS.length; i++) if (S.owned[BUILDINGS[i].id]) r += BUILDINGS[i].prod * S.owned[BUILDINGS[i].id] * bMul(S, i, season);
    return r * gMul(S, buffs);
  }
  /** Kolik vydělá jedno klepnutí do vesnice. */
  function tapValue(S, season) {
    let mul = 1, pct = 0;
    for (const id in S.upg) { const u = U_INDEX[id]; if (u && u.kind === 'tap') { if (u.v === 'x2') mul *= 2; else pct += u.v; } }
    return (mul + pct * rate(S, season)) * buff(S, 'tap');
  }

  // ── Nákupy ──
  const discount = S => buff(S, 'cost') * (1 - perkSum(S, 'cheap'));
  function costOf(S, i, n = 1) {
    const b = BUILDINGS[i], k = S.owned[b.id];
    return b.cost * Math.pow(COST_GROWTH, k) * (Math.pow(COST_GROWTH, n) - 1) / (COST_GROWTH - 1) * discount(S);
  }
  function maxAfford(S, i) {
    const b = BUILDINGS[i], first = b.cost * Math.pow(COST_GROWTH, S.owned[b.id]) * discount(S);
    if (S.coins < first) return 0;
    let n = Math.floor(Math.log(1 + (S.coins * (COST_GROWTH - 1)) / first) / Math.log(COST_GROWTH));
    while (n > 1 && costOf(S, i, n) > S.coins) n--; // zaokrouhlení
    return Math.max(1, n);
  }
  /** Koupí n kusů řemesla (n = 'max': kolik se vejde); vrací události (mistrovství, první stavba). */
  function buy(S, i, n) {
    if (n === 'max') n = maxAfford(S, i);
    if (!(n >= 1)) return null;
    const cost = costOf(S, i, n);
    if (cost > S.coins * (1 + 1e-9)) return null;
    const b = BUILDINGS[i], before = S.owned[b.id];
    S.coins = Math.max(0, S.coins - cost);
    S.owned[b.id] = before + n;
    S.stats.bought += n;
    const ev = { n, first: before === 0, milestones: [] };
    for (const m of MILESTONES) if (before < m && before + n >= m) ev.milestones.push(m);
    S.stats.milestones += ev.milestones.length;
    return ev;
  }
  function reqMet(S, u) {
    const r = u.req || {};
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
    const mb = milestoneBase(S), sm = seasonMul(S), g = gMul(S, false), part = [];
    let B = 0;
    for (let i = 0; i < BUILDINGS.length; i++) {
      const b = BUILDINGS[i], n = S.owned[b.id], u = Math.pow(2, upgCount(S, i));
      const one = b.prod * u, c = one * n * Math.pow(mb, milestonesOf(n));
      part.push({ one, c }); B += c;
    }
    return { mb, sm, g, part, B, avg: g * B * (3 + sm) / 4, k: g * (3 + sm) / 4 };
  }
  /**
   * To, co se vyplatí koupit nejdřív: nejkratší čas, než se nákup zaplatí, včetně čekání na groše.
   * tapsPerSec: jak rychle hráč klepe (vylepšení rukou se jinak nepočítají).
   */
  function bestBuy(S, tapsPerSec = 0) {
    const E = evalCtx(S), live = Math.max(1e-9, rate(S) + tapsPerSec * tapValue(S));
    const last = BUILDINGS.reduce((a, b, i) => (S.owned[b.id] ? i : a), -1);
    let best = null;
    const consider = (o, cost, gain) => {
      if (!(gain > 0) || !isFinite(cost)) return;
      const wait = Math.max(0, (cost - S.coins) / live), score = wait + cost / gain;
      if (!best || score < best.score) best = Object.assign(o, { cost, gain, score, wait });
    };
    for (let i = 0; i <= Math.min(BUILDINGS.length - 1, last + 1); i++) {
      const b = BUILDINGS[i], n = S.owned[b.id], p = E.part[i];
      const after = p.one * (n + 1) * Math.pow(E.mb, milestonesOf(n + 1));
      consider({ kind: 'b', i, name: b.name }, costOf(S, i, 1), E.k * (after - p.c));
    }
    for (const u of upgAvailable(S)) {
      let gain = 0;
      if (u.kind === 'b') gain = E.k * E.part[u.b].c;
      else if (u.kind === 'g') gain = E.avg * u.v / (1 + upgSum(S, 'g'));
      else if (u.kind === 'season') gain = E.g * E.B * u.v / 4;
      else if (u.kind === 'tap') { if (tapsPerSec > 0) { S.upg[u.id] = 1; const a = tapValue(S); delete S.upg[u.id]; gain = (a - tapValue(S)) * tapsPerSec; } }
      else gain = E.avg * 0.04; // bytosti, kouzla, delší výdělek bez hráče
      consider({ kind: 'u', id: u.id, name: u.name, sub: u.sub }, upgCost(S, u), gain);
    }
    return best;
  }
  /** Koupí jednu věc z bestBuy; vrací ji (s událostí stavby) nebo null. */
  function buyThing(S, b) {
    if (!b || b.cost > S.coins * (1 + 1e-9)) return null;
    if (b.kind === 'b') { const ev = buy(S, b.i, 1); return ev ? Object.assign({}, b, { ev }) : null; }
    return buyUpg(S, b.id) ? b : null;
  }
  /** Šafář nakoupí, co se vyplatí, dokud na to jsou groše (nejvýš max věcí). */
  function stewardBuy(S, tapsPerSec = 0, max = 40) {
    const out = { n: 0, buildings: 0, upgrades: 0, milestones: [], firsts: [] };
    for (let k = 0; k < max; k++) {
      const got = buyThing(S, bestBuy(S, tapsPerSec));
      if (!got) break;
      out.n++;
      if (got.kind === 'b') { out.buildings++; for (const m of got.ev.milestones) out.milestones.push([got.i, m]); if (got.ev.first) out.firsts.push(got.i); }
      else out.upgrades++;
    }
    S.stats.stewardBuys += out.n;
    return out;
  }

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
  const freqMul = S => 1 + upgSum(S, 'freq') + perkSum(S, 'freq');
  function nextGap(S, r = Math.random) { return (CREATURE_GAP[0] + r() * (CREATURE_GAP[1] - CREATURE_GAP[0])) / freqMul(S); }
  function pickCreature(S, season, r = Math.random) {
    const w = CREATURES.map(c => {
      if (c.id === 'vodnik' && season === 3) return 0; // v zimě spí pod ledem
      if (c.id === 'hospodaricek' && total(S) < 10) return 0;
      if (c.id === 'cert' && S.taps < 20) return 0; // čert až když hráč umí klepat
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
      return { id, name: NESRO.name, text: NESRO.text, coins };
    }
    const c = C_INDEX[id];
    if (!c) return null;
    S.caught[id] = (S.caught[id] || 0) + 1;
    const out = { id, name: c.name, text: c.text };
    if (id === 'bludicka') {
      out.coins = Math.max(25, rate(S, season) * 150) * (S.upg.lucerna ? 2 : 1);
      earn(S, out.coins);
    } else if (id === 'vodnik') addBuff(S, id, 'rate', c.mul, c.dur * durMul(S));
    else if (id === 'cert') addBuff(S, id, 'tap', c.mul, c.dur * durMul(S));
    else if (id === 'krakonos') addBuff(S, id, 'cost', 0.5, c.dur * durMul(S));
    else if (id === 'hospodaricek') {
      let n = 0;
      for (const b of BUILDINGS) if (S.owned[b.id]) { const k = Math.max(1, Math.floor(S.owned[b.id] * 0.05)); S.owned[b.id] += k; n += k; }
      S.stats.bought += n;
      out.buildings = n;
    }
    return out;
  }

  // ── Čas ──
  function earn(S, x) { S.coins += x; S.earnedGen += x; S.earnedAll += x; }
  const offlineCap = S => (OFFLINE_BASE + upgSum(S, 'offline') + perkSum(S, 'offline')) * 3600;
  /** Výnos za uplynulý čas: po úsecích mezi změnami období a koncem kouzel. */
  function advance(S, fromMs, toMs, cap = Infinity) {
    let t = fromMs / 1000;
    const end = Math.min(toMs / 1000, t + cap);
    let got = 0;
    while (t < end - 1e-6) {
      let next = Math.min(end, (Math.floor(t / SEASON_LEN + 1e-9) + 1) * SEASON_LEN);
      for (const b of S.buffs) next = Math.min(next, t + b.t);
      const dt = Math.max(0, next - t);
      got += rate(S, seasonAt(t * 1000 + 1)) * dt;
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
    const before = S.earnedAll, out = { away, cap, earnSec, capped: away > cap, buys: 0, buildings: 0, upgrades: 0 };
    if (S.steward && S.settings.auto && earnSec > 120) {
      const n = Math.min(240, Math.ceil(earnSec / 60)), step = (earnSec * 1000) / n;
      let t = fromMs;
      for (let k = 0; k < n; k++) {
        advance(S, t, t + step);
        t += step;
        const b = stewardBuy(S, 0, 60);
        out.buys += b.n; out.buildings += b.buildings; out.upgrades += b.upgrades;
      }
      advance(S, t, toMs, 0); // kouzla dobíhají i za limitem
    } else advance(S, fromMs, toMs, cap);
    out.got = S.earnedAll - before;
    if (away > S.stats.awayMax) S.stats.awayMax = away;
    return out;
  }
  /** Za kolik sekund přijdou nové úkoly dne (o půlnoci místního času). */
  function dailyLeft(ms = now()) { const d = new Date(ms), m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); return (m.getTime() - ms) / 1000; }

  /** Hraní: dt sekund s hráčem u hry. Vrací události (bytost se objevila). */
  function tick(S, dt, ms = now()) {
    const season = seasonAt(ms);
    advance(S, ms - dt * 1000, ms);
    S.stats.playTime += dt;
    S.stats.seasons[season] = 1;
    if (S.daily) S.daily.seasons[season] = 1;
    const auto = perkMax(S, 'auto');
    if (auto) earn(S, tapValue(S, season) * auto * dt);
    const r = rate(S, season, false);
    if (r > S.stats.bestRate) S.stats.bestRate = r;
    const tot = total(S);
    if (tot > S.stats.maxBuildings) S.stats.maxBuildings = tot;
    const h = new Date(ms).getHours();
    if (h < 4) S.stats.night = 1;
    S.nextCreature -= dt;
    if (S.nextCreature <= 0) { S.nextCreature = nextGap(S); return { creature: pickCreature(S, season) }; }
    return null;
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
    if (p < 1) return 0;
    S.legends += p;
    S.gen++;
    S.coins = 0;
    S.earnedGen = 0;
    for (const b of BUILDINGS) S.owned[b.id] = 0;
    const keepHands = perkMax(S, 'hands');
    for (const id of Object.keys(S.upg)) if (!(keepHands && U_INDEX[id] && U_INDEX[id].kind === 'tap')) delete S.upg[id];
    S.buffs = [];
    const start = perkMax(S, 'start');
    if (start >= 1) S.owned.pole = 10;
    if (start >= 2) for (const b of BUILDINGS.slice(0, 4)) S.owned[b.id] = Math.max(S.owned[b.id], 10);
    S.stats.genStart = now();
    S.nextCreature = Math.min(S.nextCreature, 30);
    return p;
  }

  // ── Úspěchy ──
  function checkAch(S) {
    const got = [];
    for (const a of ACHIEVEMENTS) if (!S.ach[a.id] && a.test(S)) { S.ach[a.id] = now(); got.push(a); }
    return got;
  }

  // ── Úkoly dne ──
  function counters(S) { return { bought: S.stats.bought, taps: S.taps, caught: caughtAll(S), upg: S.stats.upgrades, earned: S.earnedAll, milestones: S.stats.milestones }; }
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
    const p = task.kind === 'buy' ? c.bought - s.bought : task.kind === 'tap' ? c.taps - s.taps : task.kind === 'catch' ? c.caught - s.caught
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
    if (o.owned) for (const b of BUILDINGS) S.owned[b.id] = Math.max(0, Math.floor(num(o.owned[b.id])));
    if (o.upg) for (const id in o.upg) if (U_INDEX[id]) S.upg[id] = 1;
    if (o.caught) for (const c of CREATURES) if (o.caught[c.id]) S.caught[c.id] = Math.floor(num(o.caught[c.id]));
    if (o.ach) for (const id in o.ach) if (A_INDEX[id]) S.ach[id] = num(o.ach[id], 1);
    if (Array.isArray(o.buffs)) S.buffs = o.buffs.filter(b => b && typeof b.id === 'string' && num(b.t) > 0 && num(b.mul) > 0).map(b => ({ id: b.id, kind: b.kind, mul: b.mul, t: b.t, max: num(b.max, b.t) }));
    if (o.daily && typeof o.daily.day === 'string' && Array.isArray(o.daily.tasks)) S.daily = Object.assign({ seasons: {}, bonus: false }, o.daily);
    if (o.stats) for (const k in S.stats) { if (k === 'seasons') Object.assign(S.stats.seasons, o.stats.seasons || {}); else S.stats[k] = num(o.stats[k], S.stats[k]); }
    if (o.settings) S.settings = Object.assign(S.settings, o.settings);
    if (o.seen) S.seen = Object.assign({}, o.seen);
    return S;
  }
  /** Výsledky do žebříčků (sync.js je posílá na /api/scores): celá čísla, velká čísla jako log10 × 1000. */
  function boards(S) {
    const lb = {}, put = (b, v) => { v = Math.floor(v); if (v > 0 && v < 1e10) lb[b] = v; };
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
      stats: { legends: legendsTotal(S), generation: S.gen, buildings: total(S), earned: fmt(S.earnedAll), creatures: caughtAll(S), achievements: `${achCount(S)} / ${ACHIEVEMENTS.length}` },
    };
  }

  return {
    fresh, total, caughtAll, upgSum, legendsTotal, hireSteward, bestBuy, buyThing, stewardBuy, offline, dailyLeft, boards, perks, perkSum, perkMax, milestonesOf, nextMilestone, milestoneBase, seasonMul, buff, upgCount, bMul, gMul, bRate, rate, tapValue, achCount,
    discount, costOf, maxAfford, buy, reqMet, upgCost, upgAvailable, buyUpg, addBuff, freqMul, nextGap, pickCreature, catchCreature, durMul,
    earn, offlineCap, advance, tick, tap, legendsFor, pending, nextLegendAt, prestige, checkAch, daily, dailyProgress, dailyReward, claimDaily, load, serialize, hubStats,
  };
})();
