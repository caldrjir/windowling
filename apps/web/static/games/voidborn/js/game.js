'use strict';
// ── Stav běhu a herní logika ────────────────────────────────────────────────
const G = {
  state: 'menu', // menu | play | levelup | chest | paused | dying | victory | over
  time: 0, enemies: [], bullets: [], ebullets: [], pickups: [], effects: [], particles: [], texts: [],
  weapons: [], passives: {}, cam: { x: 0, y: 0 }, viewR: 900, viewW: 1600, viewH: 900,
  grid: new SpatialGrid(72), maxR: 30, shake: 0, flash: 0, hurtFlash: 0, timeScale: 1,
};
const _q = [], _q2 = [];
const MAX_PARTICLES = 1000;
// Srdce, magnety a bomby na mapě nezůstávají navždy a nehromadí se: v pozdní hře zaplnily celou mapu.
const PICKUP_LIFE = 75, PICKUP_CAP = { heart: 12, magnet: 6, bomb: 6 };

const xpNeed = l => Math.floor(5 + (l - 1) * 6 + Math.pow(l - 1, 1.55));
const minutes = () => G.time / 60;
const hpMul = () => { const m = minutes(); return (1 + m * 0.3 + m * m * 0.014) * G.sector.hp * (1 + G.od * 0.25); };
// Za hranicí 15 minut (nekonečno) sílí i zásahy nepřátel, ať běh jednou skončí.
const endlessMin = () => Math.max(0, G.time - RUN_LENGTH) / 60;
const dmgMul = () => (1 + minutes() * 0.045) * G.sector.dmg * (1 + G.od * 0.1) * (1 + endlessMin() * 0.1 * (1 - G.st.voidWill));
const spdMul = () => (1 + Math.min(minutes(), 20) * 0.012) * (1 + G.od * 0.03);
// V nekonečnu střepů postupně ubývá (po 30 minutách navíc už jen čtvrtina): jinak šlo za jeden
// dlouhý běh vyfarmit víc, než stojí celá Kovárna.
const shardMul = () => G.sector.shards * (1 + G.od * 0.2) * G.st.greed * Math.max(0.25, 1 - endlessMin() / 40);

// ── Statistiky hráče ────────────────────────────────────────────────────────
// Zisky (poškození, oblast, magnet, rychlost, štěstí…) se sčítají a násobí základ: „+10 %“ je vždy
// 10 % základu, je to čitelné a nic se nerozjede. Zkrácení nabíjení se naopak násobí z aktuální
// hodnoty (−8 % z toho, co zbývá): sčítané slevy by se zrychlovaly a narazily na dno. Pancíř je
// také procento z aktuálního zranění (armorFactor), takže drží hodnotu proti sílícím nepřátelům.
function calcStats(pilot, forge, passives, mut) {
  const b = {
    maxHp: 0, regen: 0, armor: 0, speed: 0, might: 0, area: 0, dur: 0, projSpd: 0, amount: 0, magnet: 0, luck: 0, growth: 0,
    greed: 0, crit: 0, critDmg: 0, revives: 0, rerolls: 0, skips: 0, dashMax: 0, shield: 0, startLvl: 0, cards: 0, wSlots: 0,
    pSlots: 0, chestItems: 0, reviveFull: 0, evoLvl: 0, dashDmg: 0,
    dashCd: 0, heartHeal: 0, bounty: 0, kit: 0, bossDmg: 0, execute: 0, ocStart: 0, mutMax: 0, gravWave: 0, voidWill: 0,
    ocMax: 0, echo: 0, startEvo: 0,
  };
  let cd = 1;
  const add = (m, mult = 1) => {
    for (const k in m) {
      if (k === 'cdMul') cd *= Math.pow(1 + m[k], mult);
      else b[k] += m[k] * mult;
    }
  };
  add(pilot.mods);
  for (const f of FORGE) { const l = forge[f.id] || 0; if (l) add(f.mod, l); }
  for (const id in passives) add(PASSIVES[id].mod, passives[id]);
  for (const id in mut) add(MUTATIONS[id].mod, mut[id]);
  return {
    maxHp: Math.max(20, 100 + b.maxHp), regen: b.regen, armor: b.armor, speed: 205 * (1 + b.speed), might: 1 + b.might,
    area: 1 + b.area, cdMul: Math.max(0.2, cd), dur: 1 + b.dur, projSpd: 1 + b.projSpd, amount: b.amount,
    magnet: 90 * (1 + b.magnet), luck: 1 + b.luck, growth: 1 + b.growth, greed: 1 + b.greed, crit: Math.min(1, 0.05 + b.crit),
    critMul: 2 + b.critDmg, revives: b.revives, rerolls: b.rerolls, skips: b.skips, dashMax: 1 + b.dashMax,
    shieldCd: shieldCd(b.shield), startLvl: b.startLvl, cards: b.cards, wSlots: BASE_SLOTS + b.wSlots, pSlots: BASE_SLOTS + b.pSlots,
    chestItems: b.chestItems, reviveFull: b.reviveFull > 0, evoLvl: 8 - Math.min(1, b.evoLvl), dashDmg: b.dashDmg,
    dashCd: 2.6 * Math.max(0.4, 1 - b.dashCd), heartHeal: 30 + b.heartHeal, bounty: 1 + b.bounty, kit: b.kit, bossDmg: 1 + b.bossDmg,
    execute: Math.min(0.3, b.execute), ocStart: Math.min(OC_MAX + b.ocMax, b.ocStart), mutMax: MUT_MAX + b.mutMax, gravWave: b.gravWave > 0, voidWill: Math.min(0.75, b.voidWill),
    ocMax: OC_MAX + b.ocMax, echo: Math.min(0.5, b.echo), startEvo: b.startEvo > 0,
  };
}

function computeStats() {
  const prevMax = G.st ? G.st.maxHp : null, hadShield = G.st ? G.st.shieldCd : 0;
  G.st = calcStats(G.pilot, SAVE.forge, G.passives, G.mut || {});
  if (prevMax !== null && G.p && G.st.maxHp > prevMax) G.p.hp += G.st.maxHp - prevMax;
  // nový štít je hned nabitý
  if (G.p && G.st.shieldCd && !hadShield) { G.p.shieldOn = true; G.p.shieldT = 0; }
  for (const w of G.weapons) computeWeapon(w);
}

function computeWeapon(w) {
  const def = WEAPONS[w.id];
  const s = Object.assign({}, def.base);
  if (def.up) for (let i = 0; i < w.level - 1 && i < def.up.length; i++) {
    const up = def.up[i][0];
    for (const k in up) s[k] = (s[k] || 0) + up[k];
  }
  const P = G.st;
  s.dmg *= P.might;
  // přetížení evoluce: +25 % poškození a −5 % nabíjení za každou ★
  if (def.evolved && w.oc) { s.dmg *= 1 + OC_DMG * w.oc; if (s.cd) s.cd *= Math.pow(1 - OC_CD, w.oc); }
  if (s.cd) s.cd *= P.cdMul;
  s.area = (s.area || 1) * P.area;
  if (s.dur) s.dur *= P.dur;
  if (s.speed && w.id !== 'orbit' && w.id !== 'halo') s.speed *= P.projSpd;
  s.amount = (s.amount || 1) + P.amount;
  w.s = s;
}

const ownsFamily = id => G.weapons.some(w => w.id === id || WEAPONS[w.id].from === id);
const getWeapon = id => G.weapons.find(w => w.id === id);

function addWeapon(id, level = 1) {
  const w = { id, level: Math.min(8, level), t: 0.4, s: null, oc: 0 };
  computeWeapon(w);
  G.weapons.push(w);
  SAVE.seen[id] = true;
  if (G.weapons.length > SAVE.stats.maxWeapons) SAVE.stats.maxWeapons = G.weapons.length;
  return w;
}

// ── Nový běh ────────────────────────────────────────────────────────────────
function newRun(pilotId, si, od) {
  const pilot = PILOTS.find(p => p.id === pilotId) || PILOTS[0];
  Object.assign(G, {
    pilot, si, od, sector: SECTORS[si], time: 0, kills: 0, level: 1, xp: 0, xpNext: xpNeed(1), shards: 0,
    enemies: [], bullets: [], ebullets: [], pickups: [], effects: [], particles: [], texts: [],
    weapons: [], passives: {}, mut: {}, st: null, boss: null, bossIdx: 0, warned: -1, nextBossT: (SECTORS[si].bossTimes || BOSS_TIMES)[0],
    nextElite: 75, nextEvent: 50, spawnAcc: 0, uid: 0, dmgBy: {}, pendingLevels: 0, timeScale: 1,
    shake: 0, flash: 0, hurtFlash: 0, killTimes: [], noHit: 0, bossClean: true, newAch: [], endless: false,
    victory: false, gemCount: 0, gemCombo: 0, lastGemT: -9, dyingT: 0, hitsTaken: 0, evolvedRun: [],
    clearBonus: 0, choices: null, statTick: 0, ended: false, victoryT: 0, firstClear: false,
    startWeapon: null, mergeT: 0, gravT: 40, nextMeteor: 7, monoType: null, nextMono: MONO_PERIOD, well: null, wellHurt: 0,
  });
  G.p = { x: 0, y: 0, vx: 0, vy: 0, r: 12, face: -Math.PI / 2, hp: 100, inv: 2, dashT: 0, dvx: 0, dvy: 0, dashCharges: 1, dashRe: 0, tilt: 0, shieldOn: false, shieldT: 0, dashHit: null };
  computeStats();
  G.p.hp = G.st.maxHp;
  G.p.dashCharges = G.st.dashMax;
  G.revives = G.st.revives;
  G.rerolls = 1 + G.st.rerolls;
  G.skips = 1 + G.st.skips;
  // Startovní zbraň pilota se vyvine vždy, i bez doplňku-katalyzátoru (upgradePool).
  G.startWeapon = pilot.weapon === 'random' ? pick(BASE_WEAPONS.filter(id => unlocked(WEAPONS[id]))) : pilot.weapon;
  // Mistrovské dílo „Zrozen z prázdnoty“: startovní zbraň začíná rovnou vyvinutá.
  const evoId = WEAPONS[G.startWeapon].evo;
  if (G.st.startEvo && evoId) {
    addWeapon(evoId, 1);
    const w = getWeapon(evoId); w.oc = G.st.ocStart; computeWeapon(w);
  } else addWeapon(G.startWeapon, 1 + G.st.startLvl);
  // Výbava z Kovárny: náhodný doplněk na první úrovni.
  if (G.st.kit) {
    const ids = Object.keys(PASSIVES).filter(id => unlocked(PASSIVES[id]) && !PASSIVES[id].rare);
    if (ids.length) applyChoice({ kind: 'passive', id: pick(ids), lvl: 1, isNew: true });
  }
  sectorStart();
  G.cam.x = 0; G.cam.y = 0;
  G.state = 'play';
  PerfLog.begin();
  G.perfLogged = PerfLog.on;
  SAVE.lastPilot = pilot.id; SAVE.lastSector = si; SAVE.lastOd = od;
}

// ── Pomocné dotazy ──────────────────────────────────────────────────────────
function nearestEnemy(x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = d2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function enemiesNear(x, y, r) {
  const out = [];
  G.grid.query(x, y, r + G.maxR, _q2);
  for (const e of _q2) if (!e.dead && d2(x, y, e.x, e.y) < (r + e.r) * (r + e.r)) out.push(e);
  return out;
}

// ── Efekty a částice ────────────────────────────────────────────────────────
function burst(x, y, color, n, spd = 220, size = 3, life = 0.6) {
  // v plné hordě méně jisker na výbuch, ať vykreslování stíhá
  const np = G.particles.length;
  if (np > 300) n = Math.ceil(n * (np > 800 ? 0.12 : np > 550 ? 0.3 : 0.6));
  for (let i = 0; i < n && G.particles.length < MAX_PARTICLES; i++) {
    const a = Math.random() * TAU, s = spd * (0.25 + Math.random() * 0.75);
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.5), max: life, size: size * (0.6 + Math.random() * 0.8), color, drag: 3 });
  }
}
function addText(x, y, txt, color, size = 14, life = 0.7) {
  if (G.texts.length > 60) return;
  G.texts.push({ x: x + rand(-6, 6), y, txt, color, size, life, max: life, vy: -55 });
}
// Otřesy o stupeň slabší než dřív: menší strop a vykreslení s menší amplitudou (render.js).
function addShake(v) { if (SAVE.settings.shake) G.shake = Math.min(18, G.shake + v * 0.8); }

// ── Poškození nepřátel ──────────────────────────────────────────────────────
function hurtEnemy(e, dmg, src, kx = 0, ky = 0, quiet = false, forceCrit = false) {
  if (e.dead) return;
  const crit = forceCrit || Math.random() < G.st.crit;
  if (crit) dmg *= G.st.critMul;
  if (e.boss || e.elite) dmg *= G.st.bossDmg;
  e.hp -= dmg;
  // Popravčí: běžný nepřítel pod prahem zdraví rovnou padne.
  if (G.st.execute && !e.boss && !e.elite && e.hp > 0 && e.hp < e.maxHp * G.st.execute) e.hp = 0;
  e.flash = 0.09;
  G.dmgBy[src] = (G.dmgBy[src] || 0) + dmg;
  if (!e.boss) {
    const kb = e.elite ? 0.15 : 1 / (e.d.mass || 1);
    e.kx += kx * kb; e.ky += ky * kb;
  }
  if (SAVE.settings.dmgNums && (!quiet || crit)) addText(e.x, e.y - e.r, Math.round(dmg), crit ? '#ffe14d' : '#ffffff', crit ? 19 : 13);
  if (!quiet) Sound.play.hit();
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  G.kills++;
  SAVE.stats.kills++;
  G.killTimes.push(G.time);
  burst(e.x, e.y, e.color, Math.min(26, 6 + e.r * 0.6), 160 + e.r * 6, 3 + e.r * 0.08);
  if (e.leech > G.time) G.p.hp = Math.min(G.st.maxHp, G.p.hp + e.leechAmt);
  if (e.boss) { bossKilled(e); return; }
  Sound.play.kill();
  if (e.d.split && G.enemies.length < 480) {
    for (let i = 0; i < 3; i++) {
      const m = spawnEnemyAt(e.d.split, e.x + rand(-12, 12), e.y + rand(-12, 12));
      const a = Math.random() * TAU; m.kx = Math.cos(a) * 240; m.ky = Math.sin(a) * 240;
    }
  }
  const xpScale = 1 + minutes() * 0.06;
  dropGem(e.x, e.y, e.xp * xpScale);
  const L = G.st.luck;
  if (e.elite) {
    G.pickups.push(mkPickup('chest', e.x, e.y));
    for (let i = 0; i < 6; i++) dropPickup('shard', e.x, e.y, 2 * shardMul() * G.st.bounty);
  } else {
    const r = Math.random();
    if (r < 0.011 * L) dropPickup('shard', e.x, e.y, shardMul());
    else if (r < 0.011 * L + 0.0035) dropPickup('heart', e.x, e.y);
    else if (r < 0.011 * L + 0.0035 + 0.0012 * L) dropPickup('magnet', e.x, e.y);
    else if (r < 0.011 * L + 0.0035 + 0.0012 * L + 0.0009 * L) dropPickup('bomb', e.x, e.y);
  }
}

function explode(x, y, r, dmg, src, color, quiet = false, forceCrit = false) {
  G.grid.query(x, y, r + G.maxR, _q2);
  for (const e of _q2) {
    if (e.dead) continue;
    const dd = d2(x, y, e.x, e.y);
    if (dd < (r + e.r) * (r + e.r)) {
      const d = Math.sqrt(dd) || 1;
      hurtEnemy(e, dmg, src, (e.x - x) / d * 260, (e.y - y) / d * 260, true, forceCrit);
    }
  }
  G.effects.push({ k: 'boom', x, y, r, life: 0.35, max: 0.35, color });
  burst(x, y, color, quiet ? 6 : 14, r * 3, 3, 0.5);
  if (!quiet) { Sound.play.explode(); addShake(2.5); }
}

// Paprsek: zraní všechny nepřátele v pásu
function beam(x, y, a, len, width, dmg, src) {
  const cx = Math.cos(a), cy = Math.sin(a);
  for (const e of G.enemies) {
    if (e.dead) continue;
    const rx = e.x - x, ry = e.y - y;
    const t = rx * cx + ry * cy;
    if (t < -e.r || t > len + e.r) continue;
    const perp = Math.abs(rx * cy - ry * cx);
    if (perp < width / 2 + e.r) hurtEnemy(e, dmg, src, cx * 90, cy * 90, true);
  }
}

function shoot(o) {
  G.bullets.push({
    kind: o.kind || 'bolt', x: o.x, y: o.y, vx: Math.cos(o.a) * o.spd, vy: Math.sin(o.a) * o.spd, spd: o.spd,
    r: o.r, dmg: o.dmg, pierce: o.pierce || 0, life: o.life, src: o.src, color: o.color, boom: o.boom || 0,
    homing: !!o.homing, turn: o.turn || 0, blast: o.blast || 0, hits: null, tgt: null, dead: false,
  });
}

// ── Sběratelné předměty ─────────────────────────────────────────────────────
function mkPickup(kind, x, y, val = 0) {
  const a = Math.random() * TAU, s = rand(40, 130);
  return { kind, x, y, val, n: 1, age: 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s, mag: false, sp: 0, t: Math.random() * 3, dead: false };
}
// Krystaly a střepy, které leží blízko sebe, se potichu slijí do jednoho s jejich součtem
// (a jiným tvarem a barvou podle velikosti). Méně předmětů na mapě = méně kreslení, stejná hodnota.
// Čím víc jich leží, tím větší okruh slévání; mimo obrazovku se slévají v ještě větším okruhu
// a nově padlý krystal rovnou přibude k tomu, který už leží poblíž (nevznikne nový).
const MERGE_OFF = 420, _gridOn = new Map(), _gridOff = new Map();
let _rOn = 56;
const mergeRadius = n => 56 + Math.min(144, Math.max(0, n - 20) * 1.2);
const _ck = (cx, cy, k) => ((cx * 92837111) ^ (cy * 689287499)) * 4 + k;
const _pkKey = pk => (pk.kind === 'shard' ? 1 : 0) + (pk.mag ? 2 : 0);
const _onScreen = (x, y) => Math.abs(x - G.cam.x) < G.viewW / 2 + 60 && Math.abs(y - G.cam.y) < G.viewH / 2 + 60;
function _findNear(grid, R, x, y, k) {
  const cx = Math.floor(x / R), cy = Math.floor(y / R), R2 = R * R;
  for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iy = cy - 1; iy <= cy + 1; iy++) {
    const list = grid.get(_ck(ix, iy, k));
    if (list) for (const o of list) if (!o.dead && _pkKey(o) === k && d2(o.x, o.y, x, y) < R2) return o;
  }
  return null;
}
function _insert(grid, R, pk, k) {
  const key = _ck(Math.floor(pk.x / R), Math.floor(pk.y / R), k), list = grid.get(key);
  if (list) list.push(pk); else grid.set(key, [pk]);
}
function mergePickups() {
  _gridOn.clear(); _gridOff.clear();
  let n = 0;
  for (const pk of G.pickups) if (!pk.dead && (pk.kind === 'gem' || pk.kind === 'shard')) n++;
  _rOn = mergeRadius(n);
  for (const pk of G.pickups) {
    if (pk.dead || (pk.kind !== 'gem' && pk.kind !== 'shard')) continue;
    const on = _onScreen(pk.x, pk.y), k = _pkKey(pk);
    // letící k hráči se slévají jen mezi sebou a v malém okruhu; čerstvě padlé se nejdřív rozletí
    const R = pk.mag ? 26 : on ? _rOn : MERGE_OFF, grid = on ? _gridOn : _gridOff;
    if (on && !pk.mag && pk.age < 0.15) continue;
    const into = _findNear(grid, R, pk.x, pk.y, k);
    if (into) { into.val += pk.val; into.n += pk.n; pk.dead = true; continue; }
    _insert(grid, R, pk, k);
  }
}
/** Krystal nebo střep, který právě padl: přibude k ležícímu poblíž, jinak vznikne nový. */
function dropMerged(kind, x, y, val) {
  const k = kind === 'shard' ? 1 : 0, on = _onScreen(x, y), R = on ? _rOn : MERGE_OFF, grid = on ? _gridOn : _gridOff;
  const into = _findNear(grid, R, x, y, k);
  if (into) { into.val += val; into.n++; return null; }
  const pk = mkPickup(kind, x, y, val);
  if (kind === 'gem') { pk.vx *= 0.4; pk.vy *= 0.4; }
  G.pickups.push(pk);
  _insert(grid, R, pk, k);
  return pk;
}
function dropPickup(kind, x, y, val = 0) {
  if (kind === 'shard') { dropMerged(kind, x, y, val); return; }
  const cap = PICKUP_CAP[kind];
  if (cap && G.pickups.reduce((n, p) => n + (p.kind === kind && !p.dead ? 1 : 0), 0) >= cap) return;
  G.pickups.push(mkPickup(kind, x, y, val));
}
function dropGem(x, y, val) {
  if (G.gemCount > 320) {
    for (let tries = 0; tries < 6; tries++) {
      const g = G.pickups[(Math.random() * G.pickups.length) | 0];
      if (g && g.kind === 'gem' && !g.mag) { g.val += val; return; }
    }
  }
  dropMerged('gem', x, y, val);
}

function collect(pk) {
  pk.dead = true;
  const p = G.p;
  switch (pk.kind) {
    case 'gem': {
      G.xp += pk.val * G.st.growth;
      G.gemCombo = G.time - G.lastGemT < 0.45 ? G.gemCombo + 1 : 0;
      G.lastGemT = G.time;
      Sound.play.gem(G.gemCombo);
      while (G.xp >= G.xpNext) { G.xp -= G.xpNext; G.level++; G.xpNext = xpNeed(G.level); G.pendingLevels++; }
      break;
    }
    case 'shard': {
      G.shards += pk.val;
      Sound.play.shard();
      // střepy sebrané těsně po sobě (magnet) se sečtou do jednoho čísla
      G.shardAcc = (G.shardAcc || 0) + pk.val;
      if (G.time - (G.shardTextT || -9) > 0.3) shardText();
      break;
    }
    case 'heart': {
      const h = Math.min(G.st.maxHp - p.hp, G.st.heartHeal);
      p.hp += h; Sound.play.heal();
      addText(p.x, p.y - 24, '+' + Math.round(h), '#5dffa8', 18);
      burst(p.x, p.y, '#5dffa8', 14, 180);
      break;
    }
    case 'magnet': {
      for (const g of G.pickups) if (g.kind === 'gem' || g.kind === 'shard') g.mag = true;
      Sound.play.select(); G.flash = 0.25;
      break;
    }
    case 'bomb': {
      Sound.play.bomb(); G.flash = 0.9; addShake(18);
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (Math.abs(e.x - p.x) < G.viewW / 2 + 40 && Math.abs(e.y - p.y) < G.viewH / 2 + 40) {
          if (e.boss) hurtEnemy(e, e.maxHp * 0.04, 'bomb', 0, 0, true); else killEnemy(e);
        }
      }
      G.effects.push({ k: 'ring', x: p.x, y: p.y, r: 10, maxR: G.viewR, spd: 2200, dmg: 0, knock: 0, life: 1, color: '#ffffff', visual: true, delay: 0 });
      break;
    }
    case 'chest': openChest(pk.val === 1); break;
  }
}

// ── Hráč ────────────────────────────────────────────────────────────────────
function hurtPlayer(dmg, srcX, srcY) {
  const p = G.p;
  if (p.inv > 0 || G.state !== 'play') return;
  // Energetický štít pohltí celý zásah a začne se dobíjet.
  if (p.shieldOn) {
    p.shieldOn = false; p.shieldT = G.st.shieldCd; p.inv = 0.5;
    Sound.play.select(); addShake(3);
    addText(p.x, p.y - 24, L('BLOK', 'BLOCK'), '#7df9ff', 17);
    G.effects.push({ k: 'ring', x: p.x, y: p.y, r: 14, maxR: 70, spd: 320, dmg: 0, knock: 0, life: 1, color: '#7df9ff', visual: true, delay: 0 });
    if (srcX !== undefined) { const a = Math.atan2(p.y - srcY, p.x - srcX); p.vx += Math.cos(a) * 200; p.vy += Math.sin(a) * 200; }
    return;
  }
  const d = Math.max(1, dmg * armorFactor(G.st.armor));
  p.hp -= d; p.inv = 0.5;
  G.hurtFlash = 1; G.noHit = 0; G.hitsTaken++;
  if (G.boss) G.bossClean = false;
  addShake(9);
  Sound.play.hurt();
  addText(p.x, p.y - 22, '-' + Math.round(d), '#ff4d5e', 18);
  burst(p.x, p.y, '#ff4d5e', 12, 240);
  if (srcX !== undefined) { const a = Math.atan2(p.y - srcY, p.x - srcX); p.vx += Math.cos(a) * 260; p.vy += Math.sin(a) * 260; }
  if (p.hp <= 0) playerDown();
}

function playerDown() {
  const p = G.p;
  if (G.revives > 0) {
    G.revives--;
    p.hp = G.st.maxHp * (G.st.reviveFull ? 1 : 0.6); p.inv = G.st.reviveFull ? 5 : 3;
    Sound.play.revive(); G.flash = 1; addShake(20);
    for (const e of G.enemies) if (!e.dead && d2(e.x, e.y, p.x, p.y) < 420 * 420) {
      if (e.boss) { const a = Math.atan2(e.y - p.y, e.x - p.x); e.x += Math.cos(a) * 200; e.y += Math.sin(a) * 200; }
      else killEnemy(e);
    }
    G.ebullets.length = 0;
    PerfLog.ev('revive');
    G.effects.push({ k: 'ring', x: p.x, y: p.y, r: 10, maxR: 520, spd: 1400, dmg: 0, knock: 0, life: 1, color: '#ffd166', visual: true, delay: 0 });
    UI.banner(L('OŽIVENÍ', 'REVIVED'), L('Fénix tě vrátil do boje', 'The Phoenix brought you back'), 'gold');
    return;
  }
  p.hp = 0;
  G.state = 'dying'; G.dyingT = 2.2;
  PerfLog.ev('death');
  Sound.play.die();
  Sound.music('menu');
  addShake(24);
  burst(p.x, p.y, G.pilot.color, 70, 500, 4, 1.4);
  burst(p.x, p.y, '#ffffff', 30, 300, 3, 1);
}

function updatePlayer(dt) {
  const p = G.p, inp = Input.move();
  if (Input.consume('dash') && p.dashCharges > 0 && p.dashT <= 0) {
    let dx = inp.x, dy = inp.y;
    if (Math.abs(dx) + Math.abs(dy) < 0.1) { dx = Math.cos(p.face); dy = Math.sin(p.face); }
    const l = Math.hypot(dx, dy) || 1;
    p.dvx = dx / l * 1150; p.dvy = dy / l * 1150; p.dashT = 0.16;
    p.inv = Math.max(p.inv, 0.3);
    p.dashCharges--;
    p.dashHit = G.st.dashDmg ? new Set() : null;
    SAVE.stats.dashes++;
    Sound.play.dash();
  }
  if (p.dashCharges < G.st.dashMax) {
    p.dashRe += dt;
    if (p.dashRe >= G.st.dashCd) { p.dashRe = 0; p.dashCharges++; }
  } else p.dashRe = 0;

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += p.dvx * dt; p.y += p.dvy * dt;
    // Rázový úskok: každý nepřítel v cestě dostane jednou ránu podle svého maximálního zdraví.
    if (p.dashHit) {
      G.grid.query(p.x, p.y, 34 + G.maxR, _q);
      for (const e of _q) {
        if (e.dead || p.dashHit.has(e.id) || d2(p.x, p.y, e.x, e.y) > (34 + e.r) * (34 + e.r)) continue;
        p.dashHit.add(e.id);
        const l = Math.hypot(p.dvx, p.dvy) || 1;
        hurtEnemy(e, e.maxHp * (e.boss ? 0.015 : 0.15) * G.st.dashDmg, 'dash', p.dvx / l * 300, p.dvy / l * 300);
        burst(e.x, e.y, '#55f6ff', 6, 220, 2.5, 0.35);
      }
    }
    p.vx = p.dvx * 0.25; p.vy = p.dvy * 0.25;
    if (G.particles.length < MAX_PARTICLES) G.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 0, color: G.pilot.color, drag: 0, ghost: p.face });
  } else {
    const sp = G.st.speed, k = 1 - Math.exp(-dt * 12);
    p.vx += (inp.x * sp - p.vx) * k; p.vy += (inp.y * sp - p.vy) * k;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  if (Math.abs(inp.x) + Math.abs(inp.y) > 0.1) {
    const target = Math.atan2(inp.y, inp.x);
    const diff = angDiff(p.face, target);
    p.face += diff * Math.min(1, dt * 14);
    p.tilt = lerp(p.tilt, clamp(diff * 2, -1, 1), dt * 8);
  } else p.tilt = lerp(p.tilt, 0, dt * 6);
  if (p.inv > 0) p.inv -= dt;
  if (G.st.regen > 0) p.hp = Math.min(G.st.maxHp, p.hp + G.st.regen * dt);
  if (G.st.shieldCd && !p.shieldOn) {
    p.shieldT -= dt;
    if (p.shieldT <= 0) { p.shieldOn = true; p.shieldT = 0; addText(p.x, p.y - 26, L('ŠTÍT', 'SHIELD'), '#7df9ff', 13); }
  }
  // plamen motoru
  const spd = Math.hypot(p.vx, p.vy);
  if (spd > 30 && G.particles.length < MAX_PARTICLES && Math.random() < 0.9) {
    const a = p.face + Math.PI + rand(-0.3, 0.3);
    G.particles.push({ x: p.x - Math.cos(p.face) * 12, y: p.y - Math.sin(p.face) * 12, vx: Math.cos(a) * rand(60, 160), vy: Math.sin(a) * rand(60, 160), life: 0.3, max: 0.3, size: rand(2, 4), color: G.pilot.color, drag: 4 });
  }
  G.noHit += dt;
}

// ── Režisér vln ─────────────────────────────────────────────────────────────
function currentPool() {
  if (G.sector.mono && G.monoType) return { [G.monoType]: 1 };
  const m = minutes();
  let base = WAVES[0][1];
  for (const w of WAVES) if (m >= w[0]) base = w[1];
  const pool = Object.assign({}, base);
  if (m >= 2) for (const k in G.sector.favor) pool[k] = (pool[k] || 0) + G.sector.favor[k];
  return pool;
}
function pickType(pool) {
  const keys = Object.keys(pool);
  return weighted(keys, k => pool[k]);
}

function spawnEnemyAt(type, x, y, opt) {
  const d = ENEMIES[type];
  const e = {
    id: ++G.uid, type, d, x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: d.r, color: d.color,
    hp: d.hp * hpMul(), speed: d.speed * spdMul() * rand(0.9, 1.1), dmg: d.dmg * dmgMul(), xp: d.xp,
    flash: 0, slowT: 0, slow: 0, rot: Math.random() * TAU, t: Math.random() * 5, dead: false, elite: false, boss: null,
    st: 0, stT: rand(0.5, 2), ang: 0, leech: 0, leechAmt: 0, orbT: 0, ringId: 0,
  };
  if (opt && opt.elite) { e.elite = true; e.r *= 1.75; e.hp *= 22; e.dmg *= 1.5; e.speed *= 0.85; e.xp *= 12; }
  e.maxHp = e.hp;
  G.enemies.push(e);
  return e;
}

function spawnPos(margin = 60) {
  const p = G.p;
  let a = Math.random() * TAU;
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 60 && Math.random() < 0.55) a = Math.atan2(p.vy, p.vx) + rand(-0.9, 0.9);
  const hw = G.viewW / 2 + margin, hh = G.viewH / 2 + margin;
  const cx = Math.cos(a), cy = Math.sin(a);
  const t = Math.min(hw / Math.abs(cx || 1e-6), hh / Math.abs(cy || 1e-6));
  return { x: p.x + cx * t, y: p.y + cy * t };
}

function director(dt) {
  const t = G.time, S = G.sector;
  // bossové
  if (t >= G.nextBossT - 4 && G.warned < G.bossIdx) {
    G.warned = G.bossIdx;
    const key = bossKeyFor(G.bossIdx);
    UI.banner(L('⚠ VAROVÁNÍ', '⚠ WARNING'), BOSSES[key].name + L(' se blíží', ' is approaching'), 'boss');
    Sound.play.warning();
  }
  // v Aréně titánů počká další boss, dokud předchozí žije (jinak by se přetahovali o ukazatel zdraví)
  if (t >= G.nextBossT && !(S.rush && G.boss)) {
    spawnBoss(bossKeyFor(G.bossIdx), G.bossIdx);
    G.bossIdx++;
    const bt = bossTimes();
    G.nextBossT = G.bossIdx < bt.length ? bt[G.bossIdx] : (G.endless ? G.nextBossT + 300 : Infinity);
  }
  if (G.state !== 'play') return;
  sectorTick(dt);
  // běžný přísun
  const rate = (1.1 + t / 60 * 0.95) * S.spawn * (1 + G.od * 0.08) * (G.boss ? 0.4 : 1) * (G.endless ? 1 + (t - RUN_LENGTH) / 300 * (1 - G.st.voidWill) : 1)
    * (S.mono && G.monoType ? MONO_TYPES[G.monoType] : 1);
  const cap = Math.min(G.endless ? 460 : 400, 110 + t * 0.4);
  G.spawnAcc += rate * dt;
  const pool = currentPool();
  while (G.spawnAcc >= 1) {
    G.spawnAcc--;
    if (G.enemies.length < cap) { const sp = spawnPos(); spawnEnemyAt(pickType(pool), sp.x, sp.y); }
  }
  if (t >= G.nextElite) {
    G.nextElite += rand(60, 85) * (S.rush ? 0.5 : 1);
    const sp = spawnPos(); spawnEnemyAt(pickType(pool), sp.x, sp.y, { elite: true });
  }
  if (t >= G.nextEvent && !G.boss && G.enemies.length < 330) {
    G.nextEvent += rand(38, 55);
    spawnEvent(pool);
  }
}

function spawnEvent(pool) {
  const p = G.p, m = minutes();
  const kind = pick(m < 3 ? ['ring', 'horde'] : ['ring', 'horde', 'stream']);
  PerfLog.ev('wave', kind);
  if (kind === 'ring') {
    const n = Math.floor(22 + m * 3), R = G.viewR * 0.62;
    const type = G.sector.mono && G.monoType ? G.monoType : m < 4 ? 'swarmer' : pick(['swarmer', 'drone', 'wisp', 'mini']);
    for (let i = 0; i < n; i++) { const a = i / n * TAU; spawnEnemyAt(type, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
    UI.banner(L('OBKLÍČENÍ', 'SURROUNDED'), L('Prorazte kruh!', 'Break the circle!'), 'warn');
  } else if (kind === 'horde') {
    const sp = spawnPos(120), n = Math.floor(18 + m * 3), type = pickType(pool);
    for (let i = 0; i < n; i++) spawnEnemyAt(type, sp.x + rand(-90, 90), sp.y + rand(-90, 90));
    UI.banner(L('HORDA', 'HORDE'), L('Velká skupina na radaru', 'Large group on radar'), 'warn');
  } else {
    const a = Math.random() * TAU, n = Math.floor(30 + m * 3);
    for (let i = 0; i < n; i++) {
      const off = rand(-G.viewR, G.viewR), back = G.viewR * 0.9 + rand(0, 300);
      const e = spawnEnemyAt(G.sector.mono && G.monoType ? G.monoType : 'wisp', p.x - Math.cos(a) * back - Math.sin(a) * off, p.y - Math.sin(a) * back + Math.cos(a) * off);
      e.stream = a;
    }
    UI.banner(L('PROUD', 'STREAM'), L('Roj přilétá z jedné strany', 'A swarm incoming from one side'), 'warn');
  }
}

// ── Anomálie sektorů (VI–IX) ────────────────────────────────────────────────
function sectorStart() {
  const S = G.sector;
  G.meteors = []; G.monoShown = false;
  _gridOn.clear(); _gridOff.clear(); // mřížka slévání nesmí držet předměty z minulého běhu
  if (S.mono) G.monoType = pick(Object.keys(MONO_TYPES));
  if (S.well) { const a = Math.random() * TAU; G.well = { x: Math.cos(a) * 760, y: Math.sin(a) * 760, r: 74, R: 1500, t: 0, hurt: 0 }; }
  G.zone = S.zone ? { x: 0, y: 0, r: ZONE.big, fx: 0, fy: 0, fr: ZONE.big, tx: 0, ty: 0, tr: ZONE.big, phase: 'calm', t: ZONE.calm, out: 0 } : null;
}
function monoBanner() { UI.banner(L('MONOKULTURA', 'MONOCULTURE'), L('Teď jen: ', 'Now only: ') + ENEMY_NAMES[G.monoType][0], 'warn'); }
function sectorTick(dt) {
  const S = G.sector;
  if (S.mono) {
    if (!G.monoShown && G.time > 1.2) { G.monoShown = true; monoBanner(); }
    if (G.time >= G.nextMono) {
      G.nextMono += MONO_PERIOD;
      G.monoType = pick(Object.keys(MONO_TYPES).filter(k => k !== G.monoType));
      monoBanner();
    }
  }
  if (S.meteors) {
    G.nextMeteor -= dt;
    if (G.nextMeteor <= 0) {
      const m = minutes();
      G.nextMeteor = Math.max(1.4, 5.2 - m * 0.22) * rand(0.75, 1.25);
      const volley = m > 6 && Math.random() < 0.3 ? 3 : m > 3 && Math.random() < 0.3 ? 2 : 1;
      const a = Math.random() * TAU, off = rand(-170, 170);
      for (let i = 0; i < volley; i++) launchMeteor(a, off + (i - (volley - 1) / 2) * 200);
    }
    updateMeteors(dt);
  }
  if (S.well && G.well) updateWell(dt);
  if (G.zone) updateZone(dt);
}
// Kolaps: zóna se po klidu smrští kolem nového středu (hráč musí za ní), chvíli drží a zase se rozšíří.
// Mimo zónu ubírá prázdnota každou sekundu část zdraví (pancíř ani štít nepomůžou).
function updateZone(dt) {
  const z = G.zone, p = G.p, m = minutes();
  z.t -= dt;
  if (z.t <= 0) {
    z.fx = z.x; z.fy = z.y; z.fr = z.r;
    if (z.phase === 'calm') {
      const a = Math.random() * TAU, d = rand(450, 850);
      z.tx = p.x + Math.cos(a) * d; z.ty = p.y + Math.sin(a) * d; z.tr = Math.max(300, 460 - m * 8);
      z.phase = 'shrink'; z.t = ZONE.shrink;
      UI.banner(L('KOLAPS', 'COLLAPSE'), L('Zóna se smršťuje: drž se uvnitř!', 'The zone is shrinking: stay inside!'), 'warn');
      Sound.play.warning();
    } else if (z.phase === 'shrink') { z.phase = 'hold'; z.t = ZONE.hold; }
    else if (z.phase === 'hold') { z.tx = z.x; z.ty = z.y; z.tr = ZONE.big; z.phase = 'grow'; z.t = ZONE.grow; }
    else { z.phase = 'calm'; z.t = ZONE.calm; }
  }
  if (z.phase === 'shrink' || z.phase === 'grow') {
    const len = z.phase === 'shrink' ? ZONE.shrink : ZONE.grow, q = 1 - z.t / len, e = q * q * (3 - 2 * q);
    z.x = lerp(z.fx, z.tx, e); z.y = lerp(z.fy, z.ty, e); z.r = lerp(z.fr, z.tr, e);
  }
  const out = Math.hypot(p.x - z.x, p.y - z.y) > z.r;
  z.out = out ? z.out + dt : 0;
  if (out && G.state === 'play') {
    p.hp -= G.st.maxHp * (0.07 + m * 0.004) * dt;
    G.hurtFlash = Math.max(G.hurtFlash, 0.35); G.noHit = 0;
    if (p.hp <= 0) playerDown();
  }
}
// Meteorit: nejdřív varovná čára přes obrazovku (kolem hráče), pak kámen proletí. Hráče zraní,
// běžné nepřátele v cestě rozdrtí (elity a bossy jen zraní).
function launchMeteor(a, off) {
  const p = G.p, cx = Math.cos(a), cy = Math.sin(a), len = G.viewR + 280;
  const mx = p.x - cy * off, my = p.y + cx * off;
  G.meteors.push({ sx: mx - cx * len, sy: my - cy * len, x: mx - cx * len, y: my - cy * len, a, len: len * 2, warn: 1.3, d: 0, spd: 1350, r: rand(22, 32), dmg: 30 * dmgMul(), hit: false, boss: false, rot: Math.random() * TAU, done: false });
}
function hazardKill(e, kx, ky) {
  if (e.boss) return;
  if (e.elite) { hurtEnemy(e, e.maxHp * 0.25, 'hazard', kx, ky, true); return; }
  SAVE.stats.hazardKills = (SAVE.stats.hazardKills || 0) + 1;
  killEnemy(e);
}
function updateMeteors(dt) {
  const p = G.p;
  for (const m of G.meteors) {
    if (m.warn > 0) { m.warn -= dt; if (m.warn <= 0) Sound.play.missile(); continue; }
    m.d += m.spd * dt; m.rot += dt * 5;
    m.x = m.sx + Math.cos(m.a) * m.d; m.y = m.sy + Math.sin(m.a) * m.d;
    if (!m.hit && d2(m.x, m.y, p.x, p.y) < (m.r + p.r) * (m.r + p.r)) { m.hit = true; hurtPlayer(m.dmg, m.x, m.y); }
    G.grid.query(m.x, m.y, m.r + G.maxR, _q);
    for (const e of _q) {
      if (e.dead || d2(m.x, m.y, e.x, e.y) > (m.r + e.r) * (m.r + e.r)) continue;
      if (e.boss) { if (!m.boss) { m.boss = true; hurtEnemy(e, e.maxHp * 0.04, 'hazard', 0, 0, true); } }
      else if (!e.mHit || e.mHit !== m) { e.mHit = m; hazardKill(e, Math.cos(m.a) * 500, Math.sin(m.a) * 500); }
    }
    if (G.particles.length < MAX_PARTICLES) for (let i = 0; i < 2; i++) {
      const b = m.a + Math.PI + rand(-0.35, 0.35);
      G.particles.push({ x: m.x, y: m.y, vx: Math.cos(b) * rand(80, 260), vy: Math.sin(b) * rand(80, 260), life: 0.5, max: 0.5, size: rand(3, 6), color: i ? '#ffcf6b' : '#ff7a1a', drag: 2 });
    }
    if (m.d >= m.len) m.done = true;
  }
  if (G.meteors.some(m => m.done)) G.meteors = G.meteors.filter(m => !m.done);
}
// Bloudící černá díra: táhne hráče i nepřátele, plíží se za hráčem; jádro pálí hráče a drtí nepřátele.
function updateWell(dt) {
  const w = G.well, p = G.p;
  w.t += dt;
  const dx = p.x - w.x, dy = p.y - w.y, d = Math.hypot(dx, dy) || 1;
  const crawl = 32 + minutes() * 2.2;
  w.x += dx / d * crawl * dt; w.y += dy / d * crawl * dt;
  if (d < w.R && p.dashT <= 0) {
    const f = 150 * Math.pow(1 - d / w.R, 1.5) + (d < 380 ? 45 : 0);
    p.x -= dx / d * f * dt; p.y -= dy / d * f * dt;
  }
  w.hurt -= dt;
  if (d < w.r + p.r && w.hurt <= 0) { w.hurt = 0.5; hurtPlayer(22 * dmgMul(), w.x, w.y); }
  for (const e of G.enemies) {
    if (e.dead) continue;
    const ex = w.x - e.x, ey = w.y - e.y, ed = Math.hypot(ex, ey) || 1;
    if (ed > w.R) continue;
    const pull = (e.boss ? 0.25 : 1) * (200 * Math.pow(1 - ed / w.R, 1.3) + 25);
    e.x += ex / ed * Math.min(pull * dt, ed); e.y += ey / ed * Math.min(pull * dt, ed);
    if (!e.boss && ed < w.r + e.r * 0.4) hazardKill(e, 0, 0);
  }
  if (G.particles.length < MAX_PARTICLES && Math.random() < 0.8) {
    const a = Math.random() * TAU, rr = w.r * rand(1.6, 3.2);
    G.particles.push({ x: w.x + Math.cos(a) * rr, y: w.y + Math.sin(a) * rr, vx: -Math.cos(a - 0.9) * rr * 1.4, vy: -Math.sin(a - 0.9) * rr * 1.4, life: 0.6, max: 0.6, size: rand(2, 4), color: pick(['#c58bff', '#ff4fd8', '#7b3cff']), drag: 1.5 });
  }
}

// ── Bossové ─────────────────────────────────────────────────────────────────
// Časy bossů: Aréna titánů má vlastní, hustší přehlídku.
const bossTimes = () => G.sector.bossTimes || BOSS_TIMES;
function bossKeyFor(i) {
  if (i < bossTimes().length) return G.sector.bosses[i];
  return pick(Object.keys(BOSSES));
}
function spawnBoss(key, idx) {
  const d = BOSSES[key];
  const a = Math.random() * TAU, p = G.p;
  const bt = bossTimes(), final = idx === bt.length - 1;
  const mult = idx >= bt.length ? 1 + (idx - bt.length + 1) * 0.6 : 1;
  const e = {
    id: ++G.uid, type: 'boss', d: { shape: d.shape, mass: 1000 }, x: p.x + Math.cos(a) * G.viewR * 0.75, y: p.y + Math.sin(a) * G.viewR * 0.75,
    vx: 0, vy: 0, kx: 0, ky: 0, r: d.r, color: d.color, hp: d.hp * (1 + minutes() * 0.36) * G.sector.hp * (1 + G.od * 0.25) * mult, speed: d.speed * (1 + G.od * 0.03), dmg: d.dmg * dmgMul(), xp: 0,
    flash: 0, slowT: 0, slow: 0, rot: 0, t: 0, dead: false, elite: false, st: 0, stT: 0, orbT: 0, ringId: 0, leech: 0,
    boss: { key, final, name: d.name, patterns: d.patterns, pi: 0, pt: 0, c: 0, acc: 0, ang: 0, sub: 0, idle: 1.5, phase: 1, dashA: 0 },
  };
  e.maxHp = e.hp;
  G.enemies.push(e);
  G.boss = e;
  G.bossClean = true;
  PerfLog.ev('boss', key);
  UI.bossBar(d.name, 1);
  Sound.music('boss');
  addShake(10);
}

function fireE(x, y, a, spd, dmg, color, r = 7) {
  G.ebullets.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r, dmg, life: 7, color, dead: false });
}

const PATTERNS = {
  ring(e, B, dt) {
    const n = 3 + B.phase - 1;
    B.pt += dt;
    if (B.c < n && B.pt >= B.c * 0.55) {
      const cnt = 18 + B.phase * 6;
      for (let i = 0; i < cnt; i++) fireE(e.x, e.y, i / cnt * TAU + B.c * 0.13, 180 + B.phase * 20, e.dmg * 0.7, e.color);
      B.c++; Sound.play.eshoot();
    }
    return B.pt > n * 0.55 + 0.5;
  },
  spiral(e, B, dt) {
    B.pt += dt; B.acc += dt;
    const iv = B.phase > 1 ? 0.07 : 0.1, arms = B.phase > 1 ? 4 : 3;
    while (B.acc >= iv) {
      B.acc -= iv; B.ang += 0.27;
      for (let k = 0; k < arms; k++) fireE(e.x, e.y, B.ang + k * TAU / arms, 170, e.dmg * 0.6, e.color, 6);
      Sound.play.eshoot();
    }
    return B.pt > 3.4;
  },
  aimed(e, B, dt) {
    B.pt += dt;
    const shots = 4 + B.phase;
    if (B.c < shots && B.pt >= B.c * 0.42) {
      const a = Math.atan2(G.p.y - e.y, G.p.x - e.x), n = B.phase > 1 ? 7 : 5;
      for (let i = 0; i < n; i++) fireE(e.x, e.y, a + (i - (n - 1) / 2) * 0.16, 250, e.dmg * 0.7, '#ffffff', 6);
      B.c++; Sound.play.eshoot();
    }
    return B.pt > shots * 0.42 + 0.4;
  },
  charge(e, B, dt) {
    B.pt += dt;
    const reps = B.phase > 1 ? 3 : 2;
    if (B.sub === 0) {
      if (!B.tele) { B.tele = true; B.dashA = Math.atan2(G.p.y - e.y, G.p.x - e.x); G.effects.push({ k: 'tele', x: e.x, y: e.y, a: B.dashA, len: 900, w: e.r * 2, life: 0.8, max: 0.8, color: e.color, follow: e }); }
      B.dashA += angDiff(B.dashA, Math.atan2(G.p.y - e.y, G.p.x - e.x)) * dt * 1.5;
      if (B.pt > 0.8) { B.sub = 1; B.pt = 0; B.tele = false; addShake(6); Sound.play.dash(); }
    } else if (B.sub === 1) {
      const sp = 820;
      e.x += Math.cos(B.dashA) * sp * dt; e.y += Math.sin(B.dashA) * sp * dt;
      if (G.particles.length < MAX_PARTICLES) burst(e.x, e.y, e.color, 2, 100, 4, 0.5);
      if (B.pt > 0.6) {
        B.sub = 2; B.pt = 0;
        for (let i = 0; i < 14; i++) fireE(e.x, e.y, i / 14 * TAU, 200, e.dmg * 0.6, e.color);
        addShake(8);
      }
    } else if (B.pt > 0.35) {
      B.c++; B.sub = 0; B.pt = 0;
      if (B.c >= reps) return true;
    }
    return false;
  },
  summon(e, B, dt) {
    B.pt += dt;
    if (B.c === 0) {
      const n = B.phase > 1 ? 16 : 11;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU;
        const m = spawnEnemyAt(pick(['swarmer', 'drone', 'wisp']), e.x + Math.cos(a) * (e.r + 30), e.y + Math.sin(a) * (e.r + 30));
        m.kx = Math.cos(a) * 300; m.ky = Math.sin(a) * 300;
      }
      B.c = 1;
      burst(e.x, e.y, e.color, 30, 300);
    }
    return B.pt > 1.4;
  },
  flower(e, B, dt) {
    B.pt += dt; B.acc += dt;
    while (B.acc >= 0.16) {
      B.acc -= 0.16;
      const arms = B.phase > 1 ? 8 : 6, off = Math.sin(B.pt * 1.8) * 1.2;
      for (let k = 0; k < arms; k++) fireE(e.x, e.y, off + k * TAU / arms, 160, e.dmg * 0.6, e.color, 6);
      Sound.play.eshoot();
    }
    return B.pt > 4;
  },
};

function updateBoss(e, dt) {
  const B = e.boss, p = G.p;
  if (B.phase === 1 && e.hp < e.maxHp * 0.5) {
    B.phase = 2; addShake(14); G.flash = 0.4;
    UI.banner(L('FÁZE 2', 'PHASE 2'), B.name + L(' zuří', ' is enraged'), 'boss');
    burst(e.x, e.y, e.color, 50, 400, 4, 1);
  }
  const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1;
  const pat = B.patterns[B.pi % B.patterns.length];
  const charging = pat === 'charge' && B.idle <= 0 && B.sub === 1;
  if (!charging) {
    const want = dist > 200 ? 1 : dist < 120 ? -0.6 : 0;
    const sp = e.speed * (B.phase > 1 ? 1.25 : 1) * (e.slowT > 0 ? 1 - e.slow * 0.5 : 1);
    e.x += dx / dist * sp * want * dt; e.y += dy / dist * sp * want * dt;
    // příliš daleko → dorovnat
    if (dist > G.viewR * 1.1) { e.x += dx / dist * 400 * dt; e.y += dy / dist * 400 * dt; }
  }
  if (e.slowT > 0) e.slowT -= dt;
  if (B.idle > 0) { B.idle -= dt; return; }
  if (PATTERNS[pat](e, B, dt)) {
    B.pi++; B.pt = 0; B.c = 0; B.acc = 0; B.sub = 0;
    B.idle = B.phase > 1 ? 0.6 : 1.0;
  }
}

function bossKilled(e) {
  PerfLog.ev('bossKilled', e.boss.key);
  const B = e.boss;
  G.boss = null;
  UI.bossBar(null);
  SAVE.stats.bossKills++;
  if (G.bossClean) SAVE.stats.cleanBoss = 1;
  Sound.play.bossdie();
  G.timeScale = 0.15; G.flash = 1; addShake(26);
  burst(e.x, e.y, e.color, 120, 700, 5, 1.6);
  burst(e.x, e.y, '#ffffff', 60, 400, 3, 1.2);
  G.effects.push({ k: 'ring', x: e.x, y: e.y, r: 10, maxR: 700, spd: 1600, dmg: 0, knock: 0, life: 1, color: e.color, visual: true, delay: 0 });
  G.ebullets.length = 0;
  const ck = mkPickup('chest', e.x, e.y, 1); ck.val = 1; G.pickups.push(ck);
  const n = 14 + G.bossIdx * 4;
  for (let i = 0; i < n; i++) dropPickup('shard', e.x, e.y, 3 * shardMul() * G.st.bounty);
  dropGem(e.x, e.y, 60 * (1 + minutes() * 0.1));
  if (B.final && !G.victory) {
    G.victory = true;
    G.victoryT = 2.4;
    markVictory();
  } else Sound.music('game');
}

function markVictory() {
  const sid = G.sector.id;
  const rec = SAVE.sectors[sid] || (SAVE.sectors[sid] = { cleared: false, odUnlocked: 0, best: 0 });
  const firstClear = !rec.cleared;
  rec.cleared = true;
  rec.odUnlocked = Math.max(rec.odUnlocked || 0, Math.min(MAX_OD, G.od + 1));
  SAVE.stats.maxOdClear = Math.max(SAVE.stats.maxOdClear, G.od);
  SAVE.stats.victories++;
  G.clearBonus = Math.round(120 * (G.si + 1) * (1 + G.od * 0.3) * (firstClear ? 2 : 1));
  G.firstClear = firstClear;
}

// ── Truhly ──────────────────────────────────────────────────────────────────
function openChest(big) {
  PerfLog.ev('chest', big ? 'big' : 'small');
  const rewards = [];
  const evos = upgradePool().filter(c => c.kind === 'evo');
  if (evos.length) { applyChoice(evos[0]); rewards.push(evos[0]); }
  const L = G.st.luck;
  let count = (big ? 3 : (Math.random() < 0.06 * L ? 5 : Math.random() < 0.25 * L ? 3 : 1)) + G.st.chestItems;
  if (evos.length) count = Math.max(0, count - 1);
  for (let i = 0; i < count; i++) {
    const pool = upgradePool().filter(c => c.kind !== 'evo');
    // když už není co vylepšit, truhla dá mutaci; s automatickým výběrem vybere podle priorit
    // z nabídky tří karet (jako při postupu)
    const offer = [];
    let rest = pool;
    while (offer.length < (SAVE.settings.autoPick ? 3 : 1) && rest.length) {
      const o = weighted(rest, c => c.isNew ? c.w * 0.5 : c.w);
      offer.push(o); rest = rest.filter(x => x !== o);
    }
    if (!pool.length) for (let k = 0; k < (SAVE.settings.autoPick ? 3 : 1); k++) {
      const m = mutationChoice(offer.map(o => o.id));
      if (m.kind === 'gold' && offer.length) break;
      offer.push(m);
    }
    const c = SAVE.settings.autoPick ? autoPickBest(offer) : offer[0];
    applyChoice(c); rewards.push(c);
  }
  const sh = Math.round(randi(8, 18) * shardMul() * (big ? 3 : 1) * G.st.bounty);
  G.shards += sh;
  G.state = 'chest';
  Sound.play.chest();
  Sound.muffle(true);
  UI.showChest(rewards, sh);
}
function continueEndless() {
  G.endless = true;
  G.nextBossT = G.time + 240;
  G.state = 'play';
  Sound.muffle(false);
  Sound.music('game');
  UI.hideOverlay();
  UI.banner(L('NEKONEČNO', 'ENDLESS'), L('Prázdnota sílí každou minutou', 'The void grows stronger every minute'), 'boss');
}
function closeChest() {
  G.state = 'play';
  Sound.muffle(false);
  UI.hideOverlay();
  UI.refreshLoadout();
}

// ── Výběr vylepšení ─────────────────────────────────────────────────────────
function upgradePool() {
  const pool = [];
  for (const w of G.weapons) {
    const d = WEAPONS[w.id];
    if (!d.evolved && w.level >= G.st.evoLvl && (G.passives[d.evoWith] || w.id === G.startWeapon)) pool.push({ kind: 'evo', id: d.evo, from: w.id, w: 100 });
  }
  for (const w of G.weapons) {
    const d = WEAPONS[w.id];
    if (!d.evolved && w.level < 8) pool.push({ kind: 'weapon', id: w.id, lvl: w.level + 1, w: 1.25 });
    // evoluční zbraň se dál přetěžuje (★1–★4)
    if (d.evolved && (w.oc || 0) < G.st.ocMax) pool.push({ kind: 'oc', id: w.id, lvl: (w.oc || 0) + 1, w: 1.15 });
  }
  if (G.weapons.length < G.st.wSlots) for (const id of BASE_WEAPONS) if (!ownsFamily(id) && unlocked(WEAPONS[id])) pool.push({ kind: 'weapon', id, lvl: 1, isNew: true, w: 0.85 });
  const owned = Object.keys(G.passives);
  for (const id of owned) if (G.passives[id] < PASSIVES[id].max) pool.push({ kind: 'passive', id, lvl: G.passives[id] + 1, w: 1 });
  if (owned.length < G.st.pSlots) for (const id in PASSIVES) if (!G.passives[id] && unlocked(PASSIVES[id])) pool.push({ kind: 'passive', id, lvl: 1, isNew: true, w: PASSIVES[id].rare ? 0.3 : 0.75 });
  // nápověda k evoluci
  for (const c of pool) if (c.kind === 'passive') {
    const w = G.weapons.find(w => !WEAPONS[w.id].evolved && WEAPONS[w.id].evoWith === c.id && w.id !== G.startWeapon);
    if (w) c.evoHint = w.id;
  }
  return pool;
}

// Mutace, která ještě nedosáhla stropu; když jsou všechny na stropu, hrst střepů.
function mutationChoice(skip = []) {
  const open = Object.keys(MUTATIONS).filter(id => (G.mut[id] || 0) < G.st.mutMax);
  const ids = open.filter(id => !skip.includes(id));
  if (!ids.length) return { kind: 'gold' };
  const id = pick(ids);
  return { kind: 'mut', id, lvl: (G.mut[id] || 0) + 1 };
}

function genChoices() {
  const n = (Math.random() < 0.06 + (G.st.luck - 1) * 0.5 ? 4 : 3) + G.st.cards;
  const pool = upgradePool();
  const out = [];
  const evo = pool.find(c => c.kind === 'evo');
  if (evo) out.push(evo);
  let rest = pool.filter(c => c.kind !== 'evo');
  while (out.length < n && rest.length) {
    const c = weighted(rest, c => c.w);
    out.push(c);
    rest = rest.filter(x => x !== c);
  }
  // Když dojdou vylepšení, zbytek karet doplní mutace (nekonečné drobné posílení) a při nízkém zdraví oprava.
  if (out.length < n && G.p.hp < G.st.maxHp * 0.5) out.push({ kind: 'heal' });
  while (out.length < n) {
    const c = mutationChoice(out.filter(c => c.kind === 'mut').map(c => c.id));
    if (c.kind === 'gold' && out.some(o => o.kind === 'gold')) break;
    out.push(c);
  }
  if (out.length < 2 && !out.some(c => c.kind === 'heal')) out.push({ kind: 'heal' });
  return out;
}

function applyChoice(c) {
  if (c.kind === 'weapon') {
    if (c.isNew) addWeapon(c.id);
    else { const w = getWeapon(c.id); w.level++; computeWeapon(w); }
  } else if (c.kind === 'oc') {
    const w = getWeapon(c.id);
    if (!w) return;
    w.oc = (w.oc || 0) + 1; computeWeapon(w);
    SAVE.stats.maxOc = Math.max(SAVE.stats.maxOc || 0, w.oc);
    burst(G.p.x, G.p.y, WEAPONS[w.id].color, 30, 380, 3, 0.9);
  } else if (c.kind === 'mut') {
    G.mut[c.id] = (G.mut[c.id] || 0) + 1;
    computeStats();
  } else if (c.kind === 'passive') {
    G.passives[c.id] = (G.passives[c.id] || 0) + 1;
    SAVE.seen[c.id] = true;
    computeStats();
  } else if (c.kind === 'evo') {
    const i = G.weapons.findIndex(w => w.id === c.from);
    if (i < 0) return;
    const w = { id: c.id, level: 1, t: 0.3, s: null, oc: G.st.ocStart };
    computeWeapon(w);
    if (w.oc) SAVE.stats.maxOc = Math.max(SAVE.stats.maxOc || 0, w.oc);
    G.weapons[i] = w;
    const isNewEvo = !SAVE.evolutions[c.id];
    SAVE.evolutions[c.id] = true; SAVE.seen[c.id] = true;
    PerfLog.ev('evo', c.id);
    G.evolvedRun.push(c.id);
    G.flash = 1; addShake(12);
    Sound.play.evolve();
    burst(G.p.x, G.p.y, WEAPONS[c.id].color, 60, 500, 4, 1.2);
    UI.banner(L('EVOLUCE', 'EVOLUTION'), WEAPONS[c.id].name + (isNewEvo ? L(' · nově objeveno!', ' · newly discovered!') : ''), 'gold');
  } else if (c.kind === 'heal') {
    G.p.hp = Math.min(G.st.maxHp, G.p.hp + 40); Sound.play.heal();
  } else if (c.kind === 'gold') {
    G.shards += Math.round(10 * shardMul()); Sound.play.shard();
  }
}

/** Pod které položky pořadí karta patří (startovní zbraň je i svou zbraní, katalyzátor i svým doplňkem). */
function prioKeys(c) {
  const start = id => (id === G.startWeapon ? ['start'] : []);
  if (c.kind === 'weapon') return [...start(c.id), 'w:' + c.id];
  if (c.kind === 'passive') return [...(c.evoHint ? ['catalyst'] : []), 'p:' + c.id];
  if (c.kind === 'evo') return [...start(c.from), 'evo'];
  if (c.kind === 'oc') return [...start(WEAPONS[c.id].from), 'oc'];
  if (c.kind === 'mut') return ['m:' + c.id];
  return [c.kind];
}
/** Kde je karta v pořadí priorit (menší = dřív); platí její nejvyšší položka. Evoluce a přetížení
 *  rozhoduje mezi sebou pořadí zbraní, ze kterých vznikly. */
function prioIndex(c, order) {
  let best = Infinity;
  for (const k of prioKeys(c)) { const i = order.indexOf(k); if (i >= 0 && i < best) best = i; }
  const fam = c.kind === 'evo' ? c.from : c.kind === 'oc' ? WEAPONS[c.id].from : null;
  const sub = fam ? order.indexOf('w:' + fam) : -1;
  return best * 1000 + (sub >= 0 ? sub : 999);
}
function autoPickBest(choices) {
  const order = prioList(SAVE.settings.prio);
  return choices.reduce((b, c) => (prioIndex(c, order) < prioIndex(b, order) ? c : b));
}
// Mistrovské dílo Ozvěna: s šancí G.st.echo dá postup navíc i nejlepší ze zbylých karet nabídky
// (podle pořadí priorit). Karta musí po první volbě pořád platit (místo, úroveň, zbraň).
function stillValid(c) {
  if (c.kind === 'heal' || c.kind === 'gold') return true;
  if (c.kind === 'mut') return (G.mut[c.id] || 0) < G.st.mutMax;
  return upgradePool().some(o => o.kind === c.kind && o.id === c.id && o.lvl === c.lvl);
}
function echoPick(offer, first) {
  if (!G.st.echo || Math.random() >= G.st.echo) return null;
  const rest = offer.filter(c => c !== first && stillValid(c));
  if (!rest.length) return null;
  const c = autoPickBest(rest);
  applyChoice(c);
  return Object.assign({}, c, { echo: true });
}
// Automatický výběr: hra se nezastaví, vybere kartu nejvýš v pořadí priorit a jen ji krátce ukáže.
function autoLevelUp() {
  const picked = [];
  while (G.pendingLevels > 0 && picked.length < 60) {
    const offer = genChoices(), c = autoPickBest(offer);
    applyChoice(c); picked.push(c);
    const e = echoPick(offer, c);
    if (e) picked.push(e);
    G.pendingLevels--;
  }
  PerfLog.ev('levelup', { n: picked.length, lvl: G.level });
  Sound.play.levelup();
  UI.refreshLoadout();
  UI.autoPicked(picked);
  levelRing();
}
function openLevelUp() {
  if (SAVE.settings.autoPick) { autoLevelUp(); return; }
  G.state = 'levelup';
  PerfLog.ev('levelup', { n: G.pendingLevels, lvl: G.level, manual: true });
  G.choices = genChoices();
  Sound.play.levelup();
  Sound.muffle(true);
  UI.showLevelUp(G.choices);
}
function pickChoice(i) {
  if (G.state !== 'levelup' || !G.choices || !G.choices[i]) return;
  applyChoice(G.choices[i]);
  const e = echoPick(G.choices, G.choices[i]);
  if (e) UI.autoPicked([e]);
  Sound.play.select();
  afterLevelPick();
}
function rerollChoices() {
  if (G.state !== 'levelup' || G.rerolls <= 0) { Sound.play.error(); return; }
  G.rerolls--;
  G.choices = genChoices();
  Sound.play.click();
  UI.showLevelUp(G.choices, true);
}
function skipChoice() {
  if (G.state !== 'levelup' || G.skips <= 0) { Sound.play.error(); return; }
  G.skips--;
  G.shards += Math.round(3 * shardMul());
  Sound.play.back();
  afterLevelPick();
}
function afterLevelPick() {
  G.pendingLevels--;
  UI.refreshLoadout();
  if (G.pendingLevels > 0) { G.choices = genChoices(); UI.showLevelUp(G.choices, true); return; }
  G.state = 'play';
  Sound.muffle(false);
  UI.hideOverlay();
  levelRing();
}
// rázová vlna úrovně: odhodí blízké nepřátele
function levelRing() {
  G.p.inv = Math.max(G.p.inv, 0.6);
  for (const e of G.enemies) if (!e.dead && !e.boss) {
    const dd = d2(e.x, e.y, G.p.x, G.p.y);
    if (dd < 180 * 180) { const d = Math.sqrt(dd) || 1; e.kx += (e.x - G.p.x) / d * 500; e.ky += (e.y - G.p.y) / d * 500; }
  }
  G.effects.push({ k: 'ring', x: G.p.x, y: G.p.y, r: 10, maxR: 200, spd: 900, dmg: 0, knock: 0, life: 1, color: '#55f6ff', visual: true, delay: 0 });
}

// ── Úspěchy ─────────────────────────────────────────────────────────────────
function checkAchievements(inRun) {
  for (const a of ACHIEVEMENTS) {
    if (SAVE.achievements[a.id]) continue;
    const [v, m] = a.prog(SAVE, inRun ? G : null);
    if (v >= m) {
      SAVE.achievements[a.id] = Date.now();
      SAVE.shards += a.reward;
      if (inRun) G.newAch.push(a);
      Sound.play.achieve();
      UI.toast(a.name, `${a.desc} · +${a.reward} ◆`, a.icon);
      if (a.pilot) { const pl = PILOTS.find(p => p.id === a.pilot); setTimeout(() => UI.toast(L('Nový pilot: ', 'New pilot: ') + pl.name, pl.role + L(' je připraven(a) k letu', ' is ready to fly'), 'rocket', pl.color), 900); }
      // zbraně a doplňky pro pokročilé, které tento úspěch odemyká
      const opened = [...BASE_WEAPONS.map(id => WEAPONS[id]), ...Object.values(PASSIVES)].filter(o => o.unlock === a.id);
      opened.forEach((o, i) => setTimeout(() => UI.toast((o.base ? L('Nová zbraň: ', 'New weapon: ') : L('Nový doplněk: ', 'New passive: ')) + o.name, o.desc, o.icon, o.color), 1800 + i * 900));
    }
  }
}

function trackStats() {
  const S = SAVE.stats;
  if (G.time > S.bestTime) S.bestTime = G.time;
  if (G.level > S.maxLevel) S.maxLevel = G.level;
  if (G.noHit > S.bestNoHit) S.bestNoHit = G.noHit;
  while (G.killTimes.length && G.killTimes[0] < G.time - 10) G.killTimes.shift();
  if (G.killTimes.length > S.bestBurst) S.bestBurst = G.killTimes.length;
}

// ── Konec běhu ──────────────────────────────────────────────────────────────
function endRun(reason) {
  if (G.ended) return;
  G.ended = true;
  trackStats();
  const earned = Math.round(G.shards + G.clearBonus);
  SAVE.shards += earned;
  SAVE.stats.shardsTotal += earned;
  SAVE.stats.runs++;
  SAVE.stats.time += G.time;
  const rec = SAVE.sectors[G.sector.id] || (SAVE.sectors[G.sector.id] = { cleared: false, odUnlocked: 0, best: 0 });
  rec.best = Math.max(rec.best || 0, G.time);
  checkAchievements(true);
  persist();
  G.state = 'over';
  PerfLog.end(reason);
  Sound.muffle(false);
  Sound.music('menu');
  UI.showGameOver({ reason, earned, victory: G.victory });
}

// ── Hlavní aktualizace ──────────────────────────────────────────────────────
function updateGame(rawDt) {
  if (G.state === 'dying') {
    G.dyingT -= rawDt;
    stepWorld(rawDt * 0.25, true);
    if (G.dyingT <= 0) endRun('death');
    return;
  }
  if (G.state !== 'play') return;
  G.timeScale = Math.min(1, G.timeScale + rawDt * 0.9);
  const dt = rawDt * G.timeScale;
  G.time += dt;
  let pt = PerfLog.t();
  updatePlayer(dt); pt = PerfLog.lap('u.player', pt);
  director(dt); PerfLog.lap('u.director', pt);
  stepWorld(dt, false);
  if (G.victoryT > 0) {
    G.victoryT -= rawDt;
    if (G.victoryT <= 0 && G.state === 'play') { G.state = 'victory'; Sound.muffle(true); UI.showVictory(); }
  }
  G.statTick += rawDt;
  if (G.statTick >= 1) {
    const st = PerfLog.t();
    G.statTick = 0;
    trackStats();
    checkAchievements(true);
    Sound.setLevel(G.time > 600 ? 2 : G.time > 180 ? 1 : 0);
    PerfLog.lap('u.stats', st);
  }
  if (G.pendingLevels > 0 && G.state === 'play') openLevelUp();
}

function stepWorld(dt, frozen) {
  const p = G.p;
  let pt = PerfLog.t();
  // mřížka
  G.grid.clear();
  let maxR = 10;
  for (const e of G.enemies) { G.grid.insert(e); if (e.r > maxR) maxR = e.r; }
  G.maxR = maxR;
  pt = PerfLog.lap('u.grid', pt);

  if (!frozen) for (const w of G.weapons) { const b = WB[w.id]; if (b) { const wt = PerfLog.t(); b.update(w, dt); PerfLog.lapW(w.id, 0, wt); } }
  pt = PerfLog.lap('u.weapons', pt);

  updateEnemies(dt, frozen); pt = PerfLog.lap('u.enemies', pt);
  updateBullets(dt); pt = PerfLog.lap('u.bullets', pt);
  updateEBullets(dt, frozen); pt = PerfLog.lap('u.ebullets', pt);
  updateEffects(dt); pt = PerfLog.lap('u.effects', pt);
  if (!frozen) updatePickups(dt);
  pt = PerfLog.lap('u.pickups', pt);
  updateParticles(dt); pt = PerfLog.lap('u.particles', pt);

  // úklid
  G.enemies = G.enemies.filter(e => !e.dead);
  if (G.bullets.some(b => b.dead)) G.bullets = G.bullets.filter(b => !b.dead);
  if (G.ebullets.some(b => b.dead)) G.ebullets = G.ebullets.filter(b => !b.dead);
  if (G.pickups.some(b => b.dead)) G.pickups = G.pickups.filter(b => !b.dead);
  G.effects = G.effects.filter(f => f.life > 0);

  // kamera
  const k = 1 - Math.exp(-dt * 8);
  G.cam.x += (p.x + p.vx * 0.12 - G.cam.x) * k;
  G.cam.y += (p.y + p.vy * 0.12 - G.cam.y) * k;
  G.shake = Math.max(0, G.shake - dt * 40);
  G.flash = Math.max(0, G.flash - dt * 2.2);
  G.hurtFlash = Math.max(0, G.hurtFlash - dt * 2.5);
  PerfLog.lap('u.cleanup', pt);
}

function updateEnemies(dt, frozen) {
  const p = G.p;
  const farR = G.viewR * 1.6;
  for (let i = 0; i < G.enemies.length; i++) {
    const e = G.enemies[i];
    if (e.dead) continue;
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.boss) {
      if (!frozen) updateBoss(e, dt);
      e.rot += dt * 0.5;
      if (!frozen && d2(e.x, e.y, p.x, p.y) < (e.r + p.r) * (e.r + p.r)) hurtPlayer(e.dmg, e.x, e.y);
      continue;
    }
    const dx = p.x - e.x, dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    let mx = dx / dist, my = dy / dist;
    let sp = e.speed;
    if (e.slowT > 0) { e.slowT -= dt; sp *= 1 - e.slow; }
    const d = e.d;
    if (e.stream !== undefined) {
      mx = Math.cos(e.stream); my = Math.sin(e.stream);
      if (e.t > 9) e.stream = undefined;
    } else if (d.ranged) {
      if (dist < d.ranged.range * 0.7) { const s = (e.id & 1) ? 1 : -1; mx = -dy / dist * s * 0.7 - dx / dist * 0.3; my = dx / dist * s * 0.7 - dy / dist * 0.3; }
      e.stT -= dt;
      if (e.stT <= 0 && dist < d.ranged.range && !frozen) {
        e.stT = d.ranged.cd * rand(0.8, 1.2);
        fireE(e.x, e.y, Math.atan2(dy, dx), d.ranged.spd, d.ranged.dmg * dmgMul(), e.color, 6);
        Sound.play.eshoot();
      }
    } else if (d.dash) {
      if (e.st === 0) {
        e.stT -= dt;
        if (e.stT <= 0 && dist < 380) { e.st = 1; e.stT = 0.55; e.ang = Math.atan2(dy, dx); }
      } else if (e.st === 1) {
        sp = 0; e.stT -= dt;
        e.ang += angDiff(e.ang, Math.atan2(dy, dx)) * dt * 3;
        if (e.stT <= 0) { e.st = 2; e.stT = d.dash.dur; }
      } else {
        mx = Math.cos(e.ang); my = Math.sin(e.ang); sp = d.dash.spd * (e.slowT > 0 ? 1 - e.slow : 1);
        e.stT -= dt;
        if (G.particles.length < MAX_PARTICLES && Math.random() < 0.5) G.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: 5, color: e.color, drag: 0 });
        if (e.stT <= 0) { e.st = 0; e.stT = d.dash.cd * rand(0.8, 1.2); }
      }
    } else if (d.explode) {
      if (e.st === 0 && dist < 75) { e.st = 1; e.stT = 0.7; }
      if (e.st === 1) {
        sp *= 0.25; e.stT -= dt; e.flash = (e.stT * 10 % 1) < 0.5 ? 0.05 : 0;
        if (e.stT <= 0 && !frozen) {
          e.dead = true;
          G.effects.push({ k: 'boom', x: e.x, y: e.y, r: d.explode, life: 0.4, max: 0.4, color: '#ff8a3d' });
          burst(e.x, e.y, '#ff8a3d', 24, 400, 4, 0.6);
          Sound.play.explode(); addShake(5);
          if (dist < d.explode + p.r) hurtPlayer(e.dmg, e.x, e.y);
          dropGem(e.x, e.y, e.xp);
          continue;
        }
      }
    }
    // separace
    let sx = 0, sy = 0;
    if ((e.id + G.uid) % 2 === 0 || G.enemies.length < 200) {
      G.grid.query(e.x, e.y, e.r * 2, _q);
      for (let j = 0; j < _q.length; j++) {
        const o = _q[j];
        if (o === e || o.dead) continue;
        const ox = e.x - o.x, oy = e.y - o.y, rr = e.r + o.r;
        const dd = ox * ox + oy * oy;
        if (dd < rr * rr && dd > 0.01) { const dl = Math.sqrt(dd); const f = (rr - dl) / rr; sx += ox / dl * f; sy += oy / dl * f; }
      }
    }
    e.vx = mx * sp + sx * 90; e.vy = my * sp + sy * 90;
    e.x += (e.vx + e.kx) * dt; e.y += (e.vy + e.ky) * dt;
    const kd = Math.exp(-dt * 7); e.kx *= kd; e.ky *= kd;
    if (d.shape === 'tri' || d.shape === 'dart' || d.shape === 'arrow') e.rot = Math.atan2(e.vy, e.vx);
    else e.rot += dt * (d.shape === 'star' ? 3 : 0.8);
    // kontakt s hráčem
    if (!frozen && dist < e.r + p.r) hurtPlayer(e.dmg, e.x, e.y);
    // recyklace vzdálených nepřátel
    if (dist > farR) {
      const sp2 = spawnPos(40); e.x = sp2.x; e.y = sp2.y; e.stream = undefined;
    }
  }
}

function updateBullets(dt) {
  for (const b of G.bullets) {
    if (b.dead) continue;
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; if (b.kind === 'missile') explode(b.x, b.y, b.blast, b.dmg * 0.6, b.src, b.color, true); continue; }
    if (b.homing) {
      if (!b.tgt || b.tgt.dead) b.tgt = nearestEnemy(b.x, b.y, 600);
      if (b.tgt) {
        const want = Math.atan2(b.tgt.y - b.y, b.tgt.x - b.x), cur = Math.atan2(b.vy, b.vx);
        const na = cur + clamp(angDiff(cur, want), -b.turn * dt, b.turn * dt);
        b.vx = Math.cos(na) * b.spd; b.vy = Math.sin(na) * b.spd;
      }
      b.turn += dt * 3;
      if (G.particles.length < MAX_PARTICLES && Math.random() < 0.7) G.particles.push({ x: b.x, y: b.y, vx: -b.vx * 0.1 + rand(-20, 20), vy: -b.vy * 0.1 + rand(-20, 20), life: 0.35, max: 0.35, size: 3, color: b.color, drag: 2 });
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    G.grid.query(b.x, b.y, b.r + G.maxR, _q);
    for (let i = 0; i < _q.length; i++) {
      const e = _q[i];
      if (e.dead) continue;
      if (b.hits && b.hits.includes(e.id)) continue;
      const rr = b.r + e.r;
      if (d2(b.x, b.y, e.x, e.y) < rr * rr) {
        if (b.kind === 'missile') { explode(b.x, b.y, b.blast, b.dmg, b.src, b.color); b.dead = true; break; }
        const vl = b.spd || 1;
        hurtEnemy(e, b.dmg, b.src, b.vx / vl * 120, b.vy / vl * 120);
        burst(b.x, b.y, b.color, 3, 150, 2, 0.25);
        if (b.boom) explode(b.x, b.y, b.boom, b.dmg * 0.45, b.src, b.color, true);
        if (b.pierce > 0) { b.pierce--; (b.hits || (b.hits = [])).push(e.id); }
        else { b.dead = true; break; }
      }
    }
  }
}

function updateEBullets(dt, frozen) {
  const p = G.p;
  for (const b of G.ebullets) {
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (!frozen) {
      const rr = b.r * 0.8 + p.r * 0.7;
      if (d2(b.x, b.y, p.x, p.y) < rr * rr) {
        if (p.inv <= 0) { b.dead = true; hurtPlayer(b.dmg, b.x, b.y); }
      }
    }
  }
}

function updateEffects(dt) {
  const p = G.p;
  for (const f of G.effects) {
    switch (f.k) {
      case 'ring': {
        if (f.delay > 0) { f.delay -= dt; f.x = p.x; f.y = p.y; break; }
        f.r += f.spd * dt;
        if (!f.visual) {
          G.grid.query(f.x, f.y, f.r + G.maxR, _q);
          for (const e of _q) {
            if (e.dead || e.ringId === f.id) continue;
            const dd = Math.sqrt(d2(f.x, f.y, e.x, e.y));
            if (dd < f.r + e.r && dd > f.r - 40 - e.r) {
              e.ringId = f.id;
              const dl = dd || 1;
              hurtEnemy(e, f.dmg, f.src, (e.x - f.x) / dl * f.knock, (e.y - f.y) / dl * f.knock);
            }
          }
        }
        if (f.r >= f.maxR) f.life = 0;
        break;
      }
      case 'mine': {
        f.t = (f.t || 0) + dt;
        f.arm -= dt; f.life -= dt;
        let go = f.life <= 0;
        if (f.arm <= 0 && !go) {
          G.grid.query(f.x, f.y, 26 + G.maxR, _q);
          for (const e of _q) if (!e.dead && d2(f.x, f.y, e.x, e.y) < (24 + e.r) * (24 + e.r)) { go = true; break; }
        }
        if (go) { f.life = 0; explode(f.x, f.y, f.blast, f.dmg, f.src, f.color); }
        break;
      }
      case 'hole': {
        f.life -= dt; f.tick -= dt; f.t = (f.t || 0) + dt;
        G.grid.query(f.x, f.y, f.r + G.maxR, _q);
        const doTick = f.tick <= 0;
        if (doTick) f.tick = 0.3;
        for (const e of _q) {
          if (e.dead) continue;
          const dx = f.x - e.x, dy = f.y - e.y, dd = Math.hypot(dx, dy) || 1;
          if (dd > f.r) continue;
          if (!e.boss) { const pull = (180 * (1 - dd / f.r) + 50) * dt; e.x += dx / dd * Math.min(pull, dd); e.y += dy / dd * Math.min(pull, dd); }
          if (doTick) hurtEnemy(e, f.dmg, f.src, 0, 0, true);
        }
        if (G.particles.length < MAX_PARTICLES) {
          const a = Math.random() * TAU, rr = f.r * rand(0.6, 1);
          G.particles.push({ x: f.x + Math.cos(a) * rr, y: f.y + Math.sin(a) * rr, vx: -Math.cos(a - 0.6) * rr * 1.6, vy: -Math.sin(a - 0.6) * rr * 1.6, life: 0.5, max: 0.5, size: 3, color: f.color, drag: 1 });
        }
        if (f.life <= 0) explode(f.x, f.y, f.r * 0.7, f.dmg * 5, f.src, f.color);
        break;
      }
      case 'tele': if (f.follow) { f.x = f.follow.x; f.y = f.follow.y; f.a = f.follow.boss ? f.follow.boss.dashA : f.a; } f.life -= dt; break;
      case 'strike': {
        // orbitální úder: zaměřovací kruh, po zpoždění dopad
        f.t += dt;
        if (f.t >= f.delay) {
          f.life = 0;
          explode(f.x, f.y, f.r, f.dmg, f.src, f.color, true, f.crit);
          burst(f.x, f.y, '#ffffff', 10, f.r * 4, 3, 0.5);
          if (G.time - (G.boomSnd || 0) > 0.1) { G.boomSnd = G.time; Sound.play.explode(); addShake(1.5); }
        }
        break;
      }
      case 'flame': {
        // ohnivá stopa Komety: pálí, co do ní vstoupí
        f.life -= dt; f.tick -= dt;
        if (f.tick <= 0) {
          f.tick = 0.3;
          G.grid.query(f.x, f.y, f.r + G.maxR, _q);
          for (const e of _q) if (!e.dead && d2(f.x, f.y, e.x, e.y) < (f.r + e.r) * (f.r + e.r)) hurtEnemy(e, f.dmg, f.src, 0, 0, true);
        }
        break;
      }
      default: f.life -= dt;
    }
  }
}

function shardText() {
  if (!G.shardAcc) return;
  addText(G.p.x, G.p.y - 24, '+' + Math.max(1, Math.round(G.shardAcc)) + ' ◆', '#e08bff', 14);
  G.shardAcc = 0; G.shardTextT = G.time;
}

function updatePickups(dt) {
  const p = G.p, mr = G.st.magnet;
  let gems = 0;
  if (G.shardAcc && G.time - (G.shardTextT || -9) > 0.3) shardText();
  G.mergeT -= dt;
  if (G.mergeT <= 0) { G.mergeT = 0.15; const mt = PerfLog.t(); mergePickups(); PerfLog.lap('u.merge', mt); }
  if (G.st.gravWave) {
    G.gravT -= dt;
    if (G.gravT <= 0) {
      G.gravT = 40;
      for (const g of G.pickups) if (g.kind === 'gem' || g.kind === 'shard') g.mag = true;
      G.effects.push({ k: 'ring', x: p.x, y: p.y, r: 10, maxR: G.viewR, spd: 1800, dmg: 0, knock: 0, life: 1, color: '#f72585', visual: true, delay: 0 });
      Sound.play.select();
    }
  }
  for (const pk of G.pickups) {
    if (pk.dead) continue;
    pk.t += dt; pk.age += dt;
    if (PICKUP_CAP[pk.kind] && pk.t > PICKUP_LIFE) { pk.dead = true; continue; }
    if (pk.kind === 'gem') gems++;
    const dx = p.x - pk.x, dy = p.y - pk.y, dd = dx * dx + dy * dy;
    if (pk.kind === 'chest') {
      if (dd < 34 * 34) collect(pk);
      else if (dd < 90 * 90) { const d = Math.sqrt(dd); pk.x += dx / d * 120 * dt; pk.y += dy / d * 120 * dt; }
      continue;
    }
    if (!pk.mag) {
      pk.x += pk.vx * dt; pk.y += pk.vy * dt;
      const k = Math.exp(-dt * 4); pk.vx *= k; pk.vy *= k;
      const range = pk.kind === 'gem' || pk.kind === 'shard' ? mr : 40;
      if (dd < range * range) { pk.mag = true; pk.sp = -120; }
    } else {
      pk.sp += 1500 * dt;
      const d = Math.sqrt(dd) || 1, s = Math.max(pk.sp, 0) + 60;
      if (pk.sp < 0) { pk.x -= dx / d * -pk.sp * dt; pk.y -= dy / d * -pk.sp * dt; }
      else { pk.x += dx / d * Math.min(s * dt, d); pk.y += dy / d * Math.min(s * dt, d); }
    }
    if (dd < (p.r + 12) * (p.r + 12)) collect(pk);
  }
  G.gemCount = gems;
}

function updateParticles(dt) {
  const ps = G.particles;
  let w = 0;
  for (let i = 0; i < ps.length; i++) {
    const q = ps[i];
    q.life -= dt;
    if (q.life <= 0) continue;
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.drag) { const k = Math.exp(-dt * q.drag); q.vx *= k; q.vy *= k; }
    ps[w++] = q;
  }
  ps.length = w;
  const ts = G.texts;
  w = 0;
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    t.life -= dt;
    if (t.life <= 0) continue;
    t.y += t.vy * dt; t.vy *= Math.exp(-dt * 3);
    ts[w++] = t;
  }
  ts.length = w;
}
