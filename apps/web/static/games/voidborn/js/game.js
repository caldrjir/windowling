'use strict';
// ── Stav běhu a herní logika ────────────────────────────────────────────────
const G = {
  state: 'menu', // menu | play | levelup | chest | paused | dying | victory | over
  time: 0, enemies: [], bullets: [], ebullets: [], pickups: [], effects: [], particles: [], texts: [],
  weapons: [], passives: {}, cam: { x: 0, y: 0 }, viewR: 900, viewW: 1600, viewH: 900,
  grid: new SpatialGrid(72), maxR: 30, shake: 0, flash: 0, hurtFlash: 0, timeScale: 1,
};
const _q = [], _q2 = [];
const MAX_PARTICLES = 1400;

const xpNeed = l => Math.floor(5 + (l - 1) * 6 + Math.pow(l - 1, 1.55));
const minutes = () => G.time / 60;
const hpMul = () => { const m = minutes(); return (1 + m * 0.3 + m * m * 0.014) * G.sector.hp * (1 + G.od * 0.25); };
const dmgMul = () => (1 + minutes() * 0.045) * G.sector.dmg * (1 + G.od * 0.1);
const spdMul = () => (1 + Math.min(minutes(), 20) * 0.012) * (1 + G.od * 0.03);
const shardMul = () => G.sector.shards * (1 + G.od * 0.2) * G.st.greed;

// ── Statistiky hráče ────────────────────────────────────────────────────────
function computeStats() {
  const b = { maxHp: 0, regen: 0, armor: 0, speed: 0, might: 0, area: 0, cdMul: 0, dur: 0, projSpd: 0, amount: 0, magnet: 0, luck: 0, growth: 0, greed: 0, crit: 0, revives: 0, rerolls: 0, skips: 0, dashMax: 0 };
  const add = (m, mult = 1) => { for (const k in m) b[k] += m[k] * mult; };
  add(G.pilot.mods);
  for (const f of FORGE) { const l = SAVE.forge[f.id] || 0; if (l) b[f.mod[0]] += f.mod[1] * l; }
  for (const id in G.passives) add(PASSIVES[id].mod, G.passives[id]);
  const prevMax = G.st ? G.st.maxHp : null;
  G.st = {
    maxHp: Math.max(20, 100 + b.maxHp), regen: b.regen, armor: b.armor, speed: 205 * (1 + b.speed), might: 1 + b.might,
    area: 1 + b.area, cdMul: Math.max(0.35, 1 + b.cdMul), dur: 1 + b.dur, projSpd: 1 + b.projSpd, amount: b.amount,
    magnet: 90 * (1 + b.magnet), luck: 1 + b.luck, growth: 1 + b.growth, greed: 1 + b.greed, crit: 0.05 + b.crit,
    revives: b.revives, rerolls: b.rerolls, skips: b.skips, dashMax: 1 + b.dashMax,
  };
  if (prevMax !== null && G.p && G.st.maxHp > prevMax) G.p.hp += G.st.maxHp - prevMax;
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
  if (s.cd) s.cd *= P.cdMul;
  s.area = (s.area || 1) * P.area;
  if (s.dur) s.dur *= P.dur;
  if (s.speed && w.id !== 'orbit' && w.id !== 'halo') s.speed *= P.projSpd;
  s.amount = (s.amount || 1) + P.amount;
  w.s = s;
}

const ownsFamily = id => G.weapons.some(w => w.id === id || WEAPONS[w.id].from === id);
const getWeapon = id => G.weapons.find(w => w.id === id);

function addWeapon(id) {
  const w = { id, level: 1, t: 0.4, s: null };
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
    weapons: [], passives: {}, st: null, boss: null, bossIdx: 0, warned: -1, nextBossT: BOSS_TIMES[0],
    nextElite: 75, nextEvent: 50, spawnAcc: 0, uid: 0, dmgBy: {}, pendingLevels: 0, timeScale: 1,
    shake: 0, flash: 0, hurtFlash: 0, killTimes: [], noHit: 0, bossClean: true, newAch: [], endless: false,
    victory: false, gemCount: 0, gemCombo: 0, lastGemT: -9, dyingT: 0, hitsTaken: 0, evolvedRun: [],
    clearBonus: 0, choices: null, statTick: 0, ended: false, victoryT: 0, firstClear: false,
  });
  G.p = { x: 0, y: 0, vx: 0, vy: 0, r: 12, face: -Math.PI / 2, hp: 100, inv: 2, dashT: 0, dvx: 0, dvy: 0, dashCharges: 1, dashRe: 0, tilt: 0 };
  computeStats();
  G.p.hp = G.st.maxHp;
  G.p.dashCharges = G.st.dashMax;
  G.revives = G.st.revives;
  G.rerolls = 1 + G.st.rerolls;
  G.skips = 1 + G.st.skips;
  addWeapon(pilot.weapon === 'random' ? pick(BASE_WEAPONS) : pilot.weapon);
  G.cam.x = 0; G.cam.y = 0;
  G.state = 'play';
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
  for (let i = 0; i < n && G.particles.length < MAX_PARTICLES; i++) {
    const a = Math.random() * TAU, s = spd * (0.25 + Math.random() * 0.75);
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.5), max: life, size: size * (0.6 + Math.random() * 0.8), color, drag: 3 });
  }
}
function addText(x, y, txt, color, size = 14, life = 0.7) {
  if (G.texts.length > 90) return;
  G.texts.push({ x: x + rand(-6, 6), y, txt, color, size, life, max: life, vy: -55 });
}
function addShake(v) { if (SAVE.settings.shake) G.shake = Math.min(24, G.shake + v); }

// ── Poškození nepřátel ──────────────────────────────────────────────────────
function hurtEnemy(e, dmg, src, kx = 0, ky = 0, quiet = false) {
  if (e.dead) return;
  const crit = Math.random() < G.st.crit;
  if (crit) dmg *= 2;
  e.hp -= dmg;
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
    for (let i = 0; i < 6; i++) dropPickup('shard', e.x, e.y, 2 * shardMul());
  } else {
    const r = Math.random();
    if (r < 0.011 * L) dropPickup('shard', e.x, e.y, shardMul());
    else if (r < 0.011 * L + 0.0035) dropPickup('heart', e.x, e.y);
    else if (r < 0.011 * L + 0.0035 + 0.0012 * L) dropPickup('magnet', e.x, e.y);
    else if (r < 0.011 * L + 0.0035 + 0.0012 * L + 0.0009 * L) dropPickup('bomb', e.x, e.y);
  }
}

function explode(x, y, r, dmg, src, color, quiet = false) {
  G.grid.query(x, y, r + G.maxR, _q2);
  for (const e of _q2) {
    if (e.dead) continue;
    const dd = d2(x, y, e.x, e.y);
    if (dd < (r + e.r) * (r + e.r)) {
      const d = Math.sqrt(dd) || 1;
      hurtEnemy(e, dmg, src, (e.x - x) / d * 260, (e.y - y) / d * 260, true);
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
  return { kind, x, y, val, vx: Math.cos(a) * s, vy: Math.sin(a) * s, mag: false, sp: 0, t: Math.random() * 3, dead: false };
}
function dropPickup(kind, x, y, val = 0) { G.pickups.push(mkPickup(kind, x, y, val)); }
function dropGem(x, y, val) {
  if (G.gemCount > 320) {
    for (let tries = 0; tries < 6; tries++) {
      const g = G.pickups[(Math.random() * G.pickups.length) | 0];
      if (g && g.kind === 'gem' && !g.mag) { g.val += val; return; }
    }
  }
  const g = mkPickup('gem', x, y, val); g.vx *= 0.4; g.vy *= 0.4;
  G.pickups.push(g);
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
      addText(p.x, p.y - 24, '+' + Math.max(1, Math.round(pk.val)) + ' ◆', '#e08bff', 14);
      break;
    }
    case 'heart': {
      const h = Math.min(G.st.maxHp - p.hp, 30);
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
  const d = Math.max(1, dmg - G.st.armor);
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
    p.hp = G.st.maxHp * 0.6; p.inv = 3;
    Sound.play.revive(); G.flash = 1; addShake(20);
    for (const e of G.enemies) if (!e.dead && d2(e.x, e.y, p.x, p.y) < 420 * 420) {
      if (e.boss) { const a = Math.atan2(e.y - p.y, e.x - p.x); e.x += Math.cos(a) * 200; e.y += Math.sin(a) * 200; }
      else killEnemy(e);
    }
    G.ebullets.length = 0;
    G.effects.push({ k: 'ring', x: p.x, y: p.y, r: 10, maxR: 520, spd: 1400, dmg: 0, knock: 0, life: 1, color: '#ffd166', visual: true, delay: 0 });
    UI.banner(L('OŽIVENÍ', 'REVIVED'), L('Fénix tě vrátil do boje', 'The Phoenix brought you back'), 'gold');
    return;
  }
  p.hp = 0;
  G.state = 'dying'; G.dyingT = 2.2;
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
    SAVE.stats.dashes++;
    Sound.play.dash();
  }
  if (p.dashCharges < G.st.dashMax) {
    p.dashRe += dt;
    if (p.dashRe >= 2.6) { p.dashRe = 0; p.dashCharges++; }
  } else p.dashRe = 0;

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += p.dvx * dt; p.y += p.dvy * dt;
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
  if (t >= G.nextBossT) {
    spawnBoss(bossKeyFor(G.bossIdx), G.bossIdx);
    G.bossIdx++;
    G.nextBossT = G.bossIdx < BOSS_TIMES.length ? BOSS_TIMES[G.bossIdx] : (G.endless ? G.nextBossT + 300 : Infinity);
  }
  if (G.state !== 'play') return;
  // běžný přísun
  const rate = (1.1 + t / 60 * 0.95) * S.spawn * (1 + G.od * 0.08) * (G.boss ? 0.4 : 1) * (G.endless ? 1 + (t - RUN_LENGTH) / 300 : 1);
  const cap = Math.min(G.endless ? 460 : 400, 110 + t * 0.4);
  G.spawnAcc += rate * dt;
  const pool = currentPool();
  while (G.spawnAcc >= 1) {
    G.spawnAcc--;
    if (G.enemies.length < cap) { const sp = spawnPos(); spawnEnemyAt(pickType(pool), sp.x, sp.y); }
  }
  if (t >= G.nextElite) {
    G.nextElite += rand(60, 85);
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
  if (kind === 'ring') {
    const n = Math.floor(22 + m * 3), R = G.viewR * 0.62;
    const type = m < 4 ? 'swarmer' : pick(['swarmer', 'drone', 'wisp', 'mini']);
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
      const e = spawnEnemyAt('wisp', p.x - Math.cos(a) * back - Math.sin(a) * off, p.y - Math.sin(a) * back + Math.cos(a) * off);
      e.stream = a;
    }
    UI.banner(L('PROUD', 'STREAM'), L('Roj přilétá z jedné strany', 'A swarm incoming from one side'), 'warn');
  }
}

// ── Bossové ─────────────────────────────────────────────────────────────────
function bossKeyFor(i) {
  if (i < BOSS_TIMES.length) return G.sector.bosses[i];
  return pick(Object.keys(BOSSES));
}
function spawnBoss(key, idx) {
  const d = BOSSES[key];
  const a = Math.random() * TAU, p = G.p;
  const final = idx === BOSS_TIMES.length - 1;
  const mult = idx >= BOSS_TIMES.length ? 1 + (idx - BOSS_TIMES.length + 1) * 0.6 : 1;
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
  for (let i = 0; i < n; i++) dropPickup('shard', e.x, e.y, 3 * shardMul());
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
  const rewards = [];
  const evos = upgradePool().filter(c => c.kind === 'evo');
  if (evos.length) { applyChoice(evos[0]); rewards.push(evos[0]); }
  const L = G.st.luck;
  let count = big ? 3 : (Math.random() < 0.06 * L ? 5 : Math.random() < 0.25 * L ? 3 : 1);
  if (evos.length) count = Math.max(0, count - 1);
  for (let i = 0; i < count; i++) {
    const pool = upgradePool().filter(c => c.kind !== 'evo');
    if (!pool.length) break;
    const c = weighted(pool, c => c.isNew ? c.w * 0.5 : c.w);
    applyChoice(c); rewards.push(c);
  }
  const sh = Math.round(randi(8, 18) * shardMul() * (big ? 3 : 1));
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
    if (!d.evolved && w.level >= 8 && G.passives[d.evoWith]) pool.push({ kind: 'evo', id: d.evo, from: w.id, w: 100 });
  }
  for (const w of G.weapons) {
    const d = WEAPONS[w.id];
    if (!d.evolved && w.level < 8) pool.push({ kind: 'weapon', id: w.id, lvl: w.level + 1, w: 1.25 });
  }
  if (G.weapons.length < 6) for (const id of BASE_WEAPONS) if (!ownsFamily(id)) pool.push({ kind: 'weapon', id, lvl: 1, isNew: true, w: 0.85 });
  const owned = Object.keys(G.passives);
  for (const id of owned) if (G.passives[id] < PASSIVES[id].max) pool.push({ kind: 'passive', id, lvl: G.passives[id] + 1, w: 1 });
  if (owned.length < 6) for (const id in PASSIVES) if (!G.passives[id]) pool.push({ kind: 'passive', id, lvl: 1, isNew: true, w: PASSIVES[id].rare ? 0.3 : 0.75 });
  // nápověda k evoluci
  for (const c of pool) if (c.kind === 'passive') {
    const w = G.weapons.find(w => !WEAPONS[w.id].evolved && WEAPONS[w.id].evoWith === c.id);
    if (w) c.evoHint = w.id;
  }
  return pool;
}

function genChoices() {
  const n = Math.random() < 0.06 + (G.st.luck - 1) * 0.5 ? 4 : 3;
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
  if (!out.length) out.push({ kind: 'heal' }, { kind: 'gold' });
  return out;
}

function applyChoice(c) {
  if (c.kind === 'weapon') {
    if (c.isNew) addWeapon(c.id);
    else { const w = getWeapon(c.id); w.level++; computeWeapon(w); }
  } else if (c.kind === 'passive') {
    G.passives[c.id] = (G.passives[c.id] || 0) + 1;
    SAVE.seen[c.id] = true;
    computeStats();
  } else if (c.kind === 'evo') {
    const i = G.weapons.findIndex(w => w.id === c.from);
    if (i < 0) return;
    const w = { id: c.id, level: 1, t: 0.3, s: null };
    computeWeapon(w);
    G.weapons[i] = w;
    const isNewEvo = !SAVE.evolutions[c.id];
    SAVE.evolutions[c.id] = true; SAVE.seen[c.id] = true;
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

function openLevelUp() {
  G.state = 'levelup';
  G.choices = genChoices();
  Sound.play.levelup();
  Sound.muffle(true);
  UI.showLevelUp(G.choices);
}
function pickChoice(i) {
  if (G.state !== 'levelup' || !G.choices || !G.choices[i]) return;
  applyChoice(G.choices[i]);
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
  G.p.inv = Math.max(G.p.inv, 0.6);
  Sound.muffle(false);
  UI.hideOverlay();
  // rázová vlna úrovně
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
  updatePlayer(dt);
  director(dt);
  stepWorld(dt, false);
  if (G.victoryT > 0) {
    G.victoryT -= rawDt;
    if (G.victoryT <= 0 && G.state === 'play') { G.state = 'victory'; Sound.muffle(true); UI.showVictory(); }
  }
  G.statTick += rawDt;
  if (G.statTick >= 1) {
    G.statTick = 0;
    trackStats();
    checkAchievements(true);
    Sound.setLevel(G.time > 600 ? 2 : G.time > 180 ? 1 : 0);
  }
  if (G.pendingLevels > 0 && G.state === 'play') openLevelUp();
}

function stepWorld(dt, frozen) {
  const p = G.p;
  // mřížka
  G.grid.clear();
  let maxR = 10;
  for (const e of G.enemies) { G.grid.insert(e); if (e.r > maxR) maxR = e.r; }
  G.maxR = maxR;

  if (!frozen) for (const w of G.weapons) { const b = WB[w.id]; if (b) b.update(w, dt); }

  updateEnemies(dt, frozen);
  updateBullets(dt);
  updateEBullets(dt, frozen);
  updateEffects(dt);
  if (!frozen) updatePickups(dt);
  updateParticles(dt);

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
      default: f.life -= dt;
    }
  }
}

function updatePickups(dt) {
  const p = G.p, mr = G.st.magnet;
  let gems = 0;
  for (const pk of G.pickups) {
    if (pk.dead) continue;
    pk.t += dt;
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
