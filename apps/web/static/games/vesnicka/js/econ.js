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
      upg: {}, legends: 0, gen: 1, taps: 0, caught: {}, buffs: [], ach: {},
      daily: null, nextCreature: 25,
      stats: { playTime: 0, bought: 0, upgrades: 0, milestones: 0, seasons: {}, night: 0, awayMax: 0, dailyAll: 0, bestRate: 0, started: now(), genStart: now(), missed: 0 },
      settings: { sound: true, sci: false },
      seen: {},
      t: now(),
    };
  }

  // ── Součty ──
  const total = S => BUILDINGS.reduce((a, b) => a + (S.owned[b.id] || 0), 0);
  const caughtAll = S => CREATURES.reduce((a, c) => a + (S.caught[c.id] || 0), 0);
  const upgSum = (S, kind) => { let v = 0; for (const id in S.upg) { const u = U_INDEX[id]; if (u && u.kind === kind) v += u.v; } return v; };
  const perks = S => PERKS.filter(p => S.legends >= p.n);
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
    let x = r() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return CREATURES[i].id; }
    return 'bludicka';
  }
  /** Klepnutí na bytost: vrací, co přinesla. */
  function catchCreature(S, id, season = seasonAt(now())) {
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
  const pending = S => Math.max(0, legendsFor(S.earnedAll) - S.legends);
  /** Kolik je potřeba vydělat celkem pro další pověst. */
  const nextLegendAt = S => LEGEND_BASE * Math.pow(Math.max(legendsFor(S.earnedAll), S.legends) + 1, 3);
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
    for (const k of ['coins', 'earnedGen', 'earnedAll', 'legends', 'gen', 'taps', 'nextCreature', 't']) S[k] = Math.max(0, num(o[k], S[k]));
    S.gen = Math.max(1, Math.floor(S.gen));
    S.legends = Math.floor(S.legends);
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
  function serialize(S) {
    const o = Object.assign({}, S, { t: now() });
    if (S.legends > 0) o.lb = { 'best:score': S.legends };
    return JSON.stringify(o);
  }
  function hubStats(S) {
    return {
      playTime: Math.round(S.stats.playTime), lastPlayed: now(), progress: Math.min(1, achCount(S) / ACHIEVEMENTS.length),
      stats: { legends: S.legends, generation: S.gen, buildings: total(S), earned: fmt(S.earnedAll), creatures: caughtAll(S), achievements: `${achCount(S)} / ${ACHIEVEMENTS.length}` },
    };
  }

  return {
    fresh, total, caughtAll, upgSum, perks, perkSum, perkMax, milestonesOf, nextMilestone, milestoneBase, seasonMul, buff, upgCount, bMul, gMul, bRate, rate, tapValue, achCount,
    discount, costOf, maxAfford, buy, reqMet, upgCost, upgAvailable, buyUpg, addBuff, freqMul, nextGap, pickCreature, catchCreature, durMul,
    earn, offlineCap, advance, tick, tap, legendsFor, pending, nextLegendAt, prestige, checkAch, daily, dailyProgress, dailyReward, claimDaily, load, serialize, hubStats,
  };
})();
