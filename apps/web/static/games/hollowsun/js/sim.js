'use strict';
// Echoes of the Hollow Sun – P0: simulace boje. Pevný tick 30 Hz, seedované RNG, vstup jako příkazy (D21).
// Žádná závislost na vykreslování: renderer čte stav a události, test ji pouští v Node.
(function (root) {
  const HS = root.HS;
  const TICK = 1 / 30;
  const ARENA = 18; // poloměr arény (m)
  const PLAYER_R = 0.5, PLAYER_SPEED = 5.2, PICK_R = 1.3;
  const DODGE = { dist: 5.5, time: 0.3, iframes: 0.25, cd: 0.9 };
  const WINDUP = 0.4; // zásah přichází po 40 % času akce (Casting Lifecycle v Bible)
  const ER = { en_thrall: 0.45, en_brute: 0.95, en_wisp: 0.35, bo_kiln: 1.6 };

  function rng(seed) {
    let h = 1779033703 ^ String(seed).length;
    for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const len = (x, z) => Math.hypot(x, z);
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
  const PILLARS = [[-7, -6, 1.1], [7, -6, 1.1], [-7, 6, 1.1], [7, 6, 1.1], [0, -11, 1.4], [0, 11, 1.4]];

  /* ---------- výbava a loot (P1) ---------- */
  // Sloty výbavy podle Bible (G.SLOTS); prsten má dva sloty. Inventář má pevnou kapacitu.
  const EQ_SLOTS = ['main', 'off', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring1', 'ring2', 'relic'];
  const INV_MAX = 40;
  const baseOf = (it) => HS.get(it.base);
  const equipped = (s) => EQ_SLOTS.map((k) => s.gear.eq[k]).filter(Boolean);
  function defaultGear(L) { return { eq: { main: HS.starterGear(L)[0] }, inv: [] }; }
  // staty postavy a tabulky zásahů skillů z aktuální výbavy; poměr HP zůstává
  function refreshChar(s, heal) {
    const items = equipped(s); const al = s.char.alloc;
    const ch = HS.calcChar(s.L, items, al); s.ch = ch;
    s.chBulwark = HS.calcChar(s.L, items, al, { armorInc: 0.2 }); // Ashen Bulwark: +20 % Armor
    s.chBrand = HS.calcChar(s.L, items, al, { fireInc: 0.1 }); // Brand: cíl dostává +10 % increased Fire damage
    s.hitCache = {};
    for (const id in s.skills) {
      const slot = s.skills[id]; slot.sl = HS.F.maxSkillLevel(s.L, slot.sk.req); slot.on = slot.sk.req <= s.L; slot.hit = {};
      for (const e of HS.D.enemies) slot.hit[e.id] = HS.computeHit(slot.sk, slot.sl, ch, HS.refEnemy(s.L, e.id));
    }
    const p = s.player; if (p) { const k = heal ? 1 : p.hpMax ? p.hp / p.hpMax : 1; p.hpMax = ch.S.hp; p.hp = Math.max(1, Math.round(ch.S.hp * k)); p.resMax = ch.S.res; }
  }
  // zásah skillu proti konkrétnímu nepříteli (jeho level; cejch Brand přidá +10 % increased Fire)
  function hitFor(s, slot, e) {
    const br = e.brand > 0; const am = e.armorMul || 1; const key = slot.sk.id + '|' + e.type + '|' + e.L + (br ? '|b' : '') + (am !== 1 ? '|a' + am : '');
    if (s.hitCache[key]) return s.hitCache[key];
    const en = HS.refEnemy(e.L, e.type); if (am !== 1) en.armor = Math.round(en.armor * am); // F3 Kiln Wardena: −30 % armor
    return (s.hitCache[key] = HS.computeHit(slot.sk, slot.sl, br ? s.chBrand : s.ch, en));
  }

  /* ---------- postup postavy (P1): XP, levely, body atributů ---------- */
  const ATTRS = ['str', 'dex', 'int', 'wil', 'vit'];
  const sumAlloc = (al) => ATTRS.reduce((t, k) => t + (al[k] || 0), 0);
  function newChar(level) { const L = level || 1; return { level: L, xp: 0, alloc: level ? HS.alloc(L) : {}, points: 0 }; }
  // uložená postava: level v mezích, alokace jen z volných bodů (3 za level), zbytek jako nerozdělené body
  function sanitizeChar(c) {
    if (!c || typeof c !== 'object') return newChar();
    const L = Math.max(1, Math.min(HS.B.levelCap, Math.floor(Number(c.level) || 1))); const total = (L - 1) * HS.B.freeAttrPerLevel; const al = {}; let used = 0;
    for (const k of ATTRS) { const v = Math.max(0, Math.floor(Number((c.alloc || {})[k]) || 0)); const take = Math.min(v, total - used); if (take > 0) { al[k] = take; used += take; } }
    return { level: L, xp: Math.max(0, Math.min(HS.F.xpToNext(L) - 1, Math.floor(Number(c.xp) || 0))), alloc: al, points: total - used };
  }
  // úroveň nepřátel v aréně prototypu (Bible ji pro arénu neurčuje): level hráče − 1 + každá druhá vlna, strop konce Act I
  const ACT1_MAX = Math.max(...HS.D.areas.map((a) => a.lv[1]));
  const KB_LV = HS.D.bosses.bo_kiln.lv; // Kiln Warden: level 12
  function monsterLevel(s) { if (s.mode === 'boss') return KB_LV; return s.mode === 'arena' ? Math.max(1, Math.min(ACT1_MAX, s.L - 1 + Math.floor((s.wave - 1) / 2))) : s.L; }
  function gainXp(s, e, mul) {
    if (!s.progress) return;
    grantXp(s, Math.max(1, Math.round(HS.F.monsterXp(e.L, mul || e.def.xpMul) * HS.F.xpPenalty(s.L, e.L))), e);
  }
  function grantXp(s, xp, e) {
    if (!s.progress) return;
    const c = s.char; c.xp += xp; s.events.push({ t: 'xp', xp, x: e.x, z: e.z });
    let up = false;
    while (c.level < HS.B.levelCap && c.xp >= HS.F.xpToNext(c.level)) { c.xp -= HS.F.xpToNext(c.level); c.level++; c.points += HS.B.freeAttrPerLevel; up = true; s.events.push({ t: 'levelup', level: c.level }); }
    if (up) { s.L = c.level; refreshChar(s, true); for (const id in s.skills) if (s.skills[id].sk.req === s.L) s.events.push({ t: 'unlock', skill: id }); }
  }
  // požadavky na nasazení: level tieru, atributy báze, třída (G.BASES.cls)
  function canEquip(s, it) {
    const b = baseOf(it); if (!b) return 'base';
    if (b.cls && !b.cls.includes(HS.D.cls.id)) return 'class';
    if (HS.B.tierReqLevel[it.tier || 0] > s.L) return 'level';
    for (const k in b.req || {}) if ((s.ch.A[k] || 0) < b.req[k]) return k;
    return null;
  }
  function slotFor(s, it) {
    const b = baseOf(it); if (b.slot !== 'ring') return b.slot;
    return !s.gear.eq.ring1 ? 'ring1' : !s.gear.eq.ring2 ? 'ring2' : 'ring1';
  }
  // příkazy inventáře: { equip: index } | { unequip: slot } | { discard: index }; platí okamžitě (i v pauze)
  function invCommand(s, cmd) {
    const g = s.gear; const ev = (t, o) => { s.events.push(Object.assign({ t }, o)); return false; };
    if (cmd.equip != null) {
      const it = g.inv[cmd.equip]; if (!it) return false;
      const why = canEquip(s, it); if (why) return ev('cantequip', { why, item: it });
      const slot = slotFor(s, it); const b = baseOf(it); const back = [];
      if (slot === 'off' && g.eq.main && baseOf(g.eq.main).hand === '2h') return ev('cantequip', { why: 'twohand', item: it });
      if (g.eq[slot]) back.push(g.eq[slot]);
      if (slot === 'main' && b.hand === '2h' && g.eq.off) back.push(g.eq.off);
      if (g.inv.length - 1 + back.length > INV_MAX) return ev('invfull');
      g.inv.splice(cmd.equip, 1); g.eq[slot] = it; if (slot === 'main' && b.hand === '2h') delete g.eq.off;
      g.inv.push(...back); refreshChar(s); s.events.push({ t: 'equip', slot, item: it }); return true;
    }
    if (cmd.unequip) {
      const it = g.eq[cmd.unequip]; if (!it || cmd.unequip === 'main') return false; // bez zbraně by Ash Knight nemohl útočit
      if (g.inv.length >= INV_MAX) return ev('invfull');
      delete g.eq[cmd.unequip]; g.inv.push(it); refreshChar(s); s.events.push({ t: 'unequip', slot: cmd.unequip }); return true;
    }
    if (cmd.discard != null) { const it = g.inv.splice(cmd.discard, 1)[0]; if (it) s.events.push({ t: 'discard', item: it }); return !!it; }
    // body atributů: { alloc: 'str' } jeden bod; { autoAlloc: true } zbytek jako referenční postava Bible (2/3 primární, zbytek VIT)
    if (cmd.alloc && ATTRS.includes(cmd.alloc)) { const c = s.char; if (c.points <= 0) return false; c.alloc[cmd.alloc] = (c.alloc[cmd.alloc] || 0) + 1; c.points--; refreshChar(s); s.events.push({ t: 'alloc', attr: cmd.alloc }); return true; }
    if (cmd.autoAlloc) { const c = s.char; if (c.points <= 0) return false; const pr = HS.D.cls.primary; const a = Math.round((c.points * 2) / 3); c.alloc[pr] = (c.alloc[pr] || 0) + a; c.alloc.vit = (c.alloc.vit || 0) + c.points - a; c.points = 0; refreshChar(s); s.events.push({ t: 'alloc', attr: 'auto' }); return true; }
    return false;
  }
  // drop z nepřítele: šance podle typu (BAL.dropChance), rarita G.rollRarity, pity pro unikát (lootSim v Bible),
  // předmět G.genItem s item levelem = level monstra a smart lootem pro třídu. Vlastní RNG na každý drop.
  function rollDrop(s, e) {
    if (!s.loot) return;
    const r = HS.rng(s.seed + '#loot#' + s.lootN++); const type = e.def.lt === 'lt_elite' ? 'elite' : e.def.lt === 'lt_rare' ? 'rare' : 'normal';
    if (r() >= HS.B.dropChance[type]) return;
    let rar = HS.rollRarity(r, 0, type); s.sinceU++;
    if (rar !== 'unique' && s.sinceU >= HS.B.pityUnique && rar === 'rare') rar = 'unique';
    if (rar === 'unique') s.sinceU = 0;
    const item = HS.genItem(r, e.L, HS.D.cls.id, rar);
    const d = { id: s.nextId++, x: e.x, z: e.z, item }; s.drops.push(d);
    s.events.push({ t: 'drop', id: d.id, x: d.x, z: d.z, rar: item.rar });
  }
  // uložená výbava: jen známé báze a sloty, nejvýš INV_MAX předmětů; bez zbraně výchozí palcát
  function sanitizeGear(g, L) {
    const ok = (it) => it && typeof it === 'object' && HS.get(it.base) && (!it.unique || HS.get(it.unique)) && (it.affixes || []).every((a) => HS.get(a[0]));
    const out = { eq: {}, inv: [] }; if (!g || typeof g !== 'object') return defaultGear(L);
    for (const k of EQ_SLOTS) if (g.eq && ok(g.eq[k])) out.eq[k] = JSON.parse(JSON.stringify(g.eq[k]));
    for (const it of (Array.isArray(g.inv) ? g.inv : []).slice(0, INV_MAX)) if (ok(it)) out.inv.push(JSON.parse(JSON.stringify(it)));
    if (!out.eq.main) out.eq.main = HS.starterGear(L)[0];
    return out;
  }
  // save hollowsun.save.v1: verze 1 (P0) → 2 (P1: výbava, inventář, pity čítač unikátů) → 3 (P1: postava, XP, atributy).
  // Kdo hrál P0/P1, měl postavu napevno na levelu 8: dostane ji (referenční alokace), aby mu výbava zůstala použitelná.
  function migrateSave(save) {
    const s = Object.assign({}, save); const v = Number(s.v) || 1;
    if (v < 2) { s.gear = null; s.sinceU = 0; }
    if (v < 3) s.char = s.gear || Number(s.bestWave) > 0 ? newChar(HS.D.level) : null;
    s.v = 3; return s;
  }
  function pickUp(s, d) {
    if (s.gear.inv.length >= INV_MAX) { s.events.push({ t: 'invfull' }); return false; }
    s.drops = s.drops.filter((x) => x !== d); s.gear.inv.push(d.item); s.events.push({ t: 'pickup', id: d.id, item: d.item }); return true;
  }

  function create(opts) {
    opts = opts || {};
    // arena: postava ze save (opts.char) a postup; benchmark a test vstupu: pevný level (P0 = 8), referenční alokace
    const fixed = opts.level || ((opts.mode || 'arena') === 'bench' ? HS.D.level : 0);
    const char = fixed ? newChar(fixed) : sanitizeChar(opts.char);
    const L = char.level;
    const skills = {};
    for (const sk of HS.D.skills) skills[sk.id] = { sk, sl: HS.F.maxSkillLevel(L, sk.req), on: sk.req <= L, cd: 0, hit: {} };
    const gear = sanitizeGear(opts.gear, L);
    const s = {
      L, char, progress: !fixed, ch: null, skills, gear, seed: String(opts.seed || 'hollow-p0'), rnd: rng(opts.seed || 'hollow-p0'), t: 0, tick: 0, mode: opts.mode || 'arena', wave: 0, kills: 0, over: false, nextId: 1,
      loot: opts.loot != null ? !!opts.loot : ['arena', 'boss'].includes(opts.mode || 'arena'), lootN: 0, sinceU: opts.sinceU || 0, drops: [],
      player: null, enemies: [], pillars: PILLARS, events: [], stats: { hits: 0, crits: 0, dmg: 0, taken: 0, dodged: 0, casts: {}, items: 0 },
    };
    refreshChar(s);
    const S = s.ch.S;
    s.player = { x: 0, z: 0, face: 0, hp: S.hp, hpMax: S.hp, res: 30, resMax: S.res, act: null, dodge: null, dodgeCd: 0, stun: 0, moveTo: null, pick: null, barrier: 0, bulwark: 0, invuln: !!opts.invuln, dmgTaken: 0 };
    if (s.mode === 'bench') spawnBench(s, opts.benchCount || 50);
    else if (s.mode === 'boss') { s.arenaR = BOSS.R; s.pillars = [BOSS.anvil, ...BOSS.kilns.map(([x, z]) => [x, z, BOSS.kilnR])]; s.bossKills = opts.bossKills || 0; s.player.x = 0; s.player.z = 9; spawnBoss(s); }
    else nextWave(s);
    return s;
  }
  function spawn(s, id, x, z) {
    const def = HS.D.enemies.find((e) => e.id === id); const L = monsterLevel(s); const en = HS.refEnemy(L, id);
    const e = { id: s.nextId++, type: id, def, L, x, z, face: 0, brand: 0, weak: 0, hp: en.hp, hpMax: en.hp, armor: en.armor, eva: en.eva, res: en.res, r: ER[id], speed: def.ms, atk: null, cds: HS.D.attacks[id].map(() => 0.5 + s.rnd()), stun: 0, burn: [], flash: 0, dead: false, push: [0, 0] };
    s.enemies.push(e); return e;
  }
  function ring(s, n, r0) { const out = []; const off = s.rnd() * Math.PI * 2; for (let i = 0; i < n; i++) { const a = off + (i / n) * Math.PI * 2 + (s.rnd() - 0.5) * 0.3; const r = r0 - s.rnd() * 2; out.push([Math.cos(a) * r, Math.sin(a) * r]); } return out; }
  function nextWave(s) {
    s.wave++; const brute = HS.D.enemies.find((e) => e.id === 'en_brute'); const nT = 5 + 3 * s.wave, nB = monsterLevel(s) >= brute.lv[0] ? Math.floor(s.wave / 2) : 0; // brute až od svého levelu (Bible: 5–12)
    ring(s, nT, ARENA - 1).forEach(([x, z]) => spawn(s, 'en_thrall', x, z));
    ring(s, nB, ARENA - 2).forEach(([x, z]) => spawn(s, 'en_brute', x, z));
    s.events.push({ t: 'wave', wave: s.wave, n: nT + nB });
  }
  function spawnBench(s, n) {
    const nB = Math.round(n / 5);
    ring(s, n - nB, ARENA - 1).forEach(([x, z]) => spawn(s, 'en_thrall', x, z));
    ring(s, nB, ARENA - 3).forEach(([x, z]) => spawn(s, 'en_brute', x, z));
    s.events.push({ t: 'wave', wave: 0, n });
  }


  /* ---------- boss: The Kiln Warden (P1, data z Bible: fáze, schopnosti, mechaniky, enrage, loot) ---------- */
  // Geometrie útoků je převedená z popisu v Bible („kruh 3 m před ním“, „kužel 60° × 10 m, 2 s“…). Tam, kde
  // Bible číslo neuvádí, je hodnota prototypu označená v komentáři.
  const KB = HS.D.bosses.bo_kiln;
  const BOSS = {
    R: 15, // „Kruhová kovárna Ø 30 m“
    anvil: [0, 0, 1.4], // centrální kovadlina (krytí): blokuje kužely a projektily
    kilns: [90, 210, 330].map((deg) => { const a = (deg * Math.PI) / 180; return [Math.cos(a) * 13.6, Math.sin(a) * 13.6]; }), // 3 pece na obvodu
    kilnR: 1.1, quenchR: 2.4, quenchT: 1.5, // „interakce 1,5 s“
    groundMin: 8, groundRate: 1 / 20, // „−2 m/20 s“ (průměr) → poloměr −1 m za 20 s, min Ø 16 m
    groundBurn: 0.25, // prototyp: doutnající zem pálí 0,25× damage bosse za sekundu
    safeR: 2.6, // prototyp: poloměr bezpečného kruhu (pára) u Quench Slam
    speed: 2.6, r: 1.6, // prototyp: rychlost a poloměr bosse
    xpMul: 10, // prototyp: XP za zabití jako 10 běžných nepřátel jeho levelu (Bible XP bosse neuvádí); 1. zabití + XP questu q1_04
  };
  const ABIL = Object.fromEntries(KB.abil.map((a) => [a.n, a]));
  const abilOn = (b, n) => ABIL[n] && ABIL[n].ph.includes(b.phase);
  // úsečka zdroj → hráč protíná kovadlinu? (krytí)
  function behindAnvil(sx, sz, px, pz) {
    const [ax, az, ar] = BOSS.anvil; const dx = px - sx, dz = pz - sz; const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((ax - sx) * dx + (az - sz) * dz) / l2)); return len(sx + dx * t - ax, sz + dz * t - az) < ar;
  }
  const inCone = (sx, sz, face, w, R, px, pz) => len(px - sx, pz - sz) <= R + PLAYER_R && angDiff(Math.atan2(pz - sz, px - sx), face) <= ((w / 2) * Math.PI) / 180;
  function bossHurt(s, e, mul, stun) { const b = s.boss; hurtPlayer(s, e, { mul: mul * (b.enrage ? 1.5 : 1), stun }); }
  function spawnBoss(s) {
    const e = spawn(s, 'bo_kiln', 0, -7); e.r = BOSS.r; e.heavy = true; e.speed = BOSS.speed; e.face = Math.PI / 2;
    s.boss = { id: e.id, phase: 1, t: 0, invuln: 0, enrage: false, ground: BOSS.R, cds: Object.fromEntries(KB.abil.map((a) => [a.n, 2 + s.rnd() * 2])), act: null, breath: null, kilns: BOSS.kilns.map(([x, z]) => ({ x, z, face: Math.atan2(-z, -x), alive: true, q: 0 })), stoke: 0 };
    s.events.push({ t: 'boss', id: e.id, n: KB.n });
  }
  function bossAct(s, e, n) {
    const p = s.player; const a = ABIL[n]; const b = s.boss; const act = { n, t: 0, tele: a.tele };
    if (n === 'Hammerfall') { act.x = e.x + Math.cos(e.face) * 2; act.z = e.z + Math.sin(e.face) * 2; act.r = 3; s.events.push({ t: 'tele', id: e.id, shape: 'circle', x: act.x, z: act.z, face: 0, r: 3, w: 360, dur: a.tele }); }
    else if (n === 'Bellows Breath') { act.face = e.face; s.events.push({ t: 'tele', id: e.id, shape: 'cone', x: e.x, z: e.z, face: e.face, r: 10, w: 60, dur: a.tele }); }
    else if (n === 'Anvil Toss') { act.x = p.x; act.z = p.z; act.r = 4; s.events.push({ t: 'tele', id: e.id, shape: 'circle', x: p.x, z: p.z, face: 0, r: 4, w: 360, dur: a.tele }); }
    else if (n === 'Stoke the Kilns') { for (const k of b.kilns) if (k.alive) s.events.push({ t: 'tele', id: e.id, shape: 'cone', x: k.x, z: k.z, face: k.face, r: 12, w: 90, dur: a.tele }); }
    else if (n === 'Quench Slam') {
      // 3 bezpečné kruhy (pára) uvnitř zmenšené arény; seedované
      act.safe = []; for (let i = 0; i < 3; i++) { const ang = s.rnd() * Math.PI * 2, rr = 2 + s.rnd() * Math.max(1, b.ground - 4); act.safe.push([Math.cos(ang) * rr, Math.sin(ang) * rr]); }
      s.events.push({ t: 'qslam', id: e.id, r: b.ground, safe: act.safe, sr: BOSS.safeR, dur: a.tele });
    } else if (n === 'Molten Spawn') s.events.push({ t: 'tele', id: e.id, shape: 'circle', x: e.x, z: e.z, face: 0, r: 2, w: 360, dur: a.tele });
    b.act = act; e.atk = { def: { tele: a.tele }, t: 0, boss: true }; // e.atk drží telegraphy v rendereru
    b.cds[n] = a.cd; s.events.push({ t: 'bossact', n });
  }
  function bossResolve(s, e, act) {
    const p = s.player; const a = ABIL[act.n]; const b = s.boss;
    if (act.n === 'Hammerfall' || act.n === 'Anvil Toss') { if (len(p.x - act.x, p.z - act.z) <= act.r + PLAYER_R) bossHurt(s, e, a.dmg, act.n === 'Hammerfall' ? 0.3 : 0); s.events.push({ t: 'slam', x: act.x, z: act.z, r: act.r, hits: 0 }); s.events.push({ t: 'shake', amp: 0.4 }); }
    else if (act.n === 'Bellows Breath') { b.breath = { t: 0, face: act.face, tick: 0 }; s.events.push({ t: 'breath', x: e.x, z: e.z, face: act.face, r: 10, w: 60, dur: 2 }); }
    else if (act.n === 'Stoke the Kilns') { for (const k of b.kilns) { if (!k.alive) continue; s.events.push({ t: 'kilnfire', x: k.x, z: k.z, face: k.face, r: 12, w: 90 }); if (inCone(k.x, k.z, k.face, 90, 12, p.x, p.z) && !behindAnvil(k.x, k.z, p.x, p.z)) bossHurt(s, e, a.dmg); } }
    else if (act.n === 'Quench Slam') { const safe = act.safe.some(([x, z]) => len(p.x - x, p.z - z) <= BOSS.safeR); s.events.push({ t: 'quench', safe }); s.events.push({ t: 'shake', amp: 0.6 }); if (!safe) bossHurt(s, e, a.dmg); }
    else if (act.n === 'Molten Spawn') { for (let i = 0; i < 4; i++) { const ang = (i / 4) * Math.PI * 2 + s.rnd(); const w = spawn(s, 'en_wisp', e.x + Math.cos(ang) * 2.5, e.z + Math.sin(ang) * 2.5); w.L = e.L; w.noLoot = true; } }
  }
  function updateBoss(s) {
    const b = s.boss; if (!b) return; const e = s.enemies.find((x) => x.id === b.id); if (!e || e.dead) return;
    const dt = TICK; const p = s.player; b.t += dt;
    if (!b.enrage && b.t >= 240) { b.enrage = true; s.events.push({ t: 'enrage' }); } // „Po 240 s: všechny pece permanentně aktivní, +50 % damage“
    // přechody fází podle HP (Bible: 100–60 / 60–25 / 25–0)
    const hpPct = (e.hp / e.hpMax) * 100;
    if (b.phase === 1 && hpPct <= KB.phases[1].hp[0]) { b.phase = 2; b.invuln = 3; b.act = null; e.atk = null; s.events.push({ t: 'phase', phase: 2 }); } // „3 s nezranitelný, výkřik, pece vzplanou“
    else if (b.phase === 2 && hpPct <= KB.phases[2].hp[0]) { b.phase = 3; e.armorMul = 0.7; e.speed = BOSS.speed * 1.25; s.events.push({ t: 'phase', phase: 3 }); } // „−30 % armor, +25 % speed“
    // doutnající zem ve F2 zmenšuje arénu; mimo ni hoří
    if (b.phase >= 2) b.ground = Math.max(BOSS.groundMin, b.ground - BOSS.groundRate * dt);
    if (len(p.x, p.z) > b.ground && p.hp > 0) { b.burnAcc = (b.burnAcc || 0) + dt; if (b.burnAcc >= 1) { b.burnAcc -= 1; bossHurt(s, e, BOSS.groundBurn); } } else b.burnAcc = 0;
    // pece: hráč u živé pece bez akce 1,5 s → uhasí ji (jen jednou; ve F2+ kdy hoří)
    for (const k of b.kilns) {
      if (!k.alive || b.phase < 2 || b.enrage) { k.q = 0; continue; }
      if (len(p.x - k.x, p.z - k.z) <= BOSS.quenchR && !p.act && !p.dodge) { k.q += dt; if (k.q >= BOSS.quenchT) { k.alive = false; s.events.push({ t: 'quenched', x: k.x, z: k.z }); } } else k.q = 0;
    }
    // enrage: pece chrlí trvale (zásah každou sekundu)
    if (b.enrage) { b.stoke += dt; if (b.stoke >= 1) { b.stoke -= 1; for (const k of b.kilns) { s.events.push({ t: 'kilnfire', x: k.x, z: k.z, face: k.face, r: 12, w: 90 }); if (inCone(k.x, k.z, k.face, 90, 12, p.x, p.z) && !behindAnvil(k.x, k.z, p.x, p.z)) bossHurt(s, e, ABIL['Stoke the Kilns'].dmg); } } }
    // Bellows Breath: kužel 2 s, zásah každých 0,5 s
    if (b.breath) { b.breath.t += dt; b.breath.tick += dt; if (b.breath.tick >= 0.5) { b.breath.tick -= 0.5; if (inCone(e.x, e.z, b.breath.face, 60, 10, p.x, p.z) && !behindAnvil(e.x, e.z, p.x, p.z)) bossHurt(s, e, ABIL['Bellows Breath'].dmg); } if (b.breath.t >= 2) b.breath = null; }
    for (const n in b.cds) b.cds[n] = Math.max(0, b.cds[n] - dt);
    if (b.invuln > 0) { b.invuln -= dt; return; }
    if (b.act) { b.act.t += dt; if (e.atk) e.atk.t = b.act.t; if (b.act.t >= b.act.tele) { const act = b.act; b.act = null; e.atk = null; bossResolve(s, e, act); e.recover = 0.5; } return; }
    if (e.recover > 0) { e.recover -= dt; return; }
    if (s.over || b.breath) return;
    const d = len(p.x - e.x, p.z - e.z); e.face = Math.atan2(p.z - e.z, p.x - e.x);
    // priorita: naučné mechaniky → dálkové útoky → úder zblízka
    const order = ['Quench Slam', 'Stoke the Kilns', 'Molten Spawn', 'Anvil Toss', 'Bellows Breath', 'Hammerfall'];
    for (const n of order) {
      if (!abilOn(b, n) || b.cds[n] > 0) continue;
      if (n === 'Hammerfall' && d > 4.5) continue; if (n === 'Bellows Breath' && d > 9) continue; if (n === 'Stoke the Kilns' && !b.kilns.some((k) => k.alive)) continue;
      bossAct(s, e, n); return;
    }
    if (d > e.r + PLAYER_R + 1.2) move(s, e, ((p.x - e.x) / d) * e.speed * dt, ((p.z - e.z) / d) * e.speed * dt, e.r);
  }
  // loot bosse (lt_bo_kiln): 3 Magic + 2 Rare garantované; unikát z poolu bosse 25 %, při prvním zabití 100 %
  function bossLoot(s, e) {
    const r = HS.rng(s.seed + '#boss#' + s.bossKills); const out = [];
    for (const rar of ['magic', 'magic', 'magic', 'rare', 'rare']) out.push(HS.genItem(r, e.L, HS.D.cls.id, rar));
    if (s.bossKills === 0 || r() < 0.25) { const u = HS.get(r.pick(KB.uniques)); if (u) out.push({ base: u.base, tier: Math.max(u.tier, HS.F.itemTierFor(e.L)), unique: u.id, affixes: [], rar: 'unique', q: Math.round(r() * 100) / 100 }); }
    out.forEach((item, i) => { const ang = (i / out.length) * Math.PI * 2; const d = { id: s.nextId++, x: e.x + Math.cos(ang) * 2.2, z: e.z + Math.sin(ang) * 2.2, item }; s.drops.push(d); s.events.push({ t: 'drop', id: d.id, x: d.x, z: d.z, rar: item.rar }); });
  }

  /* hráč zasáhne nepřítele: hod na zásah a crit, poškození z computeHit (bez očekávaného critu) */
  function strike(s, e, slot, mult) {
    if (s.boss && e.id === s.boss.id && s.boss.invuln > 0) { s.events.push({ t: 'immune', x: e.x, z: e.z }); return false; }
    const h = hitFor(s, slot, e); const sk = slot.sk;
    if (s.rnd() > h.hitChance) { s.events.push({ t: 'miss', x: e.x, z: e.z }); return false; }
    const crit = s.rnd() < h.critChance; const S = s.ch.S;
    let dmg = (h.perHit / h.eCrit) * (crit ? S.critMult : 1) * (mult || 1) * (0.9 + s.rnd() * 0.2);
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg; e.flash = 0.1; s.stats.hits++; s.stats.dmg += dmg; if (crit) s.stats.crits++;
    // Searing Slam proti cíli s cejchem Brand: Burn trvá 6 s (ix v Bible), tempo hoření stejné
    if (sk.dot) e.burn.push({ left: sk.id === 'ak_slam' && e.brand > 0 ? 6 : sk.dot.dur, dps: (h.dot / h.hitChance) / sk.dot.dur });
    const kb = sk.id === 'ak_slam' ? 1.4 : sk.id === 'ak_charge' ? 2 : 0.6; const d = len(e.x - s.player.x, e.z - s.player.z) || 1;
    if (e.type !== 'en_brute' && !e.heavy) { e.push[0] += ((e.x - s.player.x) / d) * kb; e.push[1] += ((e.z - s.player.z) / d) * kb; }
    s.events.push({ t: 'hit', id: e.id, x: e.x, z: e.z, dmg, crit, skill: sk.id, type: sk.conv ? 'fire' : 'phys', brand: e.brand > 0 });
    if (e.hp <= 0) kill(s, e);
    return true;
  }
  function kill(s, e) {
    if (e.dead) return; e.dead = true; s.kills++; s.events.push({ t: 'death', id: e.id, x: e.x, z: e.z, type: e.type });
    if (s.boss && e.id === s.boss.id) { bossLoot(s, e); gainXp(s, e, BOSS.xpMul); if (s.bossKills === 0 && HS.D.bossQuest) grantXp(s, HS.D.bossQuest.xp, e); s.bossKills++; s.won = true; s.boss.act = null; s.events.push({ t: 'victory', time: s.boss.t, phase: s.boss.phase }); for (const w of s.enemies) if (!w.dead && w.type === 'en_wisp') { w.dead = true; } return; }
    if (!e.noLoot) rollDrop(s, e); gainXp(s, e);
  }

  function startSkill(s, id, aim) {
    const p = s.player; const slot = s.skills[id]; if (!slot || p.act || p.dodge || p.stun > 0) return false;
    if (!slot.on) { s.events.push({ t: 'locked', skill: id, req: slot.sk.req }); return false; }
    const h = slot.hit.en_thrall; if (slot.cd > 0) return false; if (h.cost > 0 && p.res < h.cost) { s.events.push({ t: 'nores', skill: id }); return false; }
    if (aim) p.face = Math.atan2(aim[1] - p.z, aim[0] - p.x);
    p.res = Math.min(p.resMax, p.res - Math.max(0, h.cost));
    slot.cd = h.cd || 0;
    const act = { id, slot, t: 0, dur: h.actTime, fired: false, aim: aim ? aim.slice() : [p.x + Math.cos(p.face), p.z + Math.sin(p.face)] };
    if (id === 'ak_charge') { const dx = act.aim[0] - p.x, dz = act.aim[1] - p.z; const d = Math.min(slot.sk.r, len(dx, dz)); act.from = [p.x, p.z]; act.to = [p.x + Math.cos(p.face) * d, p.z + Math.sin(p.face) * d]; act.hitIds = new Set(); act.stunned = false; }
    p.act = act; p.moveTo = null; s.stats.casts[id] = (s.stats.casts[id] || 0) + 1;
    s.events.push({ t: 'cast', skill: id, x: p.x, z: p.z, face: p.face, dur: h.actTime });
    return true;
  }
  function fire(s, act) {
    const p = s.player; const sk = act.slot.sk; let hits = 0;
    if (sk.id === 'ak_cleave') {
      const half = (150 / 2) * (Math.PI / 180);
      for (const e of s.enemies) { if (e.dead) continue; const dx = e.x - p.x, dz = e.z - p.z; if (len(dx, dz) - e.r > sk.r) continue; if (angDiff(Math.atan2(dz, dx), p.face) > half) continue; if (strike(s, e, act.slot)) hits++; }
      if (hits) p.res = Math.min(p.resMax, p.res + 8 + Math.min(8, 2 * (hits - 1)));
      s.events.push({ t: 'swing', x: p.x, z: p.z, face: p.face, r: sk.r, w: 150, hits });
      if (hits) s.events.push({ t: 'hitstop', ms: 45 + Math.min(4, hits) * 8 });
    } else if (sk.id === 'ak_slam') {
      const dx = act.aim[0] - p.x, dz = act.aim[1] - p.z; const d = Math.min(sk.r, len(dx, dz)); const cx = p.x + Math.cos(p.face) * d, cz = p.z + Math.sin(p.face) * d; const R = 3.5;
      for (const e of s.enemies) { if (e.dead) continue; if (len(e.x - cx, e.z - cz) - e.r > R) continue; if (strike(s, e, act.slot)) hits++; }
      s.events.push({ t: 'slam', x: cx, z: cz, r: R, hits }); s.events.push({ t: 'hitstop', ms: hits ? 90 : 40 }); s.events.push({ t: 'shake', amp: 0.35 });
    } else if (sk.id === 'ak_brand') {
      // Brand Strike: jeden cíl před postavou (nejbližší v oblouku 90°), +6 Cinders, cejch na 4 s (+10 % Fire damage)
      let best = null, bd = 1e9;
      for (const e of s.enemies) { if (e.dead) continue; const dx = e.x - p.x, dz = e.z - p.z; const d = len(dx, dz) - e.r; if (d > sk.r || angDiff(Math.atan2(dz, dx), p.face) > Math.PI / 4) continue; if (d < bd) { bd = d; best = e; } }
      if (best && strike(s, best, act.slot)) { hits = 1; if (!best.dead) best.brand = sk.du; p.res = Math.min(p.resMax, p.res - act.slot.hit.en_thrall.cost); s.events.push({ t: 'brand', id: best.id, x: best.x, z: best.z }); s.events.push({ t: 'hitstop', ms: 55 }); }
      s.events.push({ t: 'swing', x: p.x, z: p.z, face: p.face, r: sk.r, w: 70, hits });
    } else if (sk.id === 'ak_bulwark') {
      // Ashen Bulwark: štít (15 % + 1 % × sl) Max HP a +20 % Armor na 6 s
      p.barrier = HS.bulwarkBarrier(s.ch, act.slot.sl); p.bulwark = sk.du; s.events.push({ t: 'bulwark', x: p.x, z: p.z, barrier: Math.round(p.barrier) });
    } else if (sk.id === 'ak_warcry') {
      // Cry of the Pyre: kruh 7 m – přitáhne nepřátele, −15 % jejich poškození na 6 s, taunt 4 s; +40 Cinders
      const R = 7; p.res = Math.min(p.resMax, p.res - act.slot.hit.en_thrall.cost);
      for (const e of s.enemies) { if (e.dead) continue; const dx = p.x - e.x, dz = p.z - e.z; const d = len(dx, dz); if (d - e.r > R) continue; hits++; e.weak = sk.du; e.taunt = 4; if (!e.heavy) e.recover = 0; if (d > 1.6 && e.type !== 'en_brute' && !e.heavy) { e.push[0] += (dx / d) * Math.min(3, d - 1.2); e.push[1] += (dz / d) * Math.min(3, d - 1.2); } }
      s.events.push({ t: 'warcry', x: p.x, z: p.z, r: R, hits }); s.events.push({ t: 'shake', amp: 0.2 });
    }
    return hits;
  }

  function updatePlayer(s, inp) {
    const p = s.player; const dt = TICK;
    for (const id in s.skills) s.skills[id].cd = Math.max(0, s.skills[id].cd - dt);
    p.dodgeCd = Math.max(0, p.dodgeCd - dt); p.stun = Math.max(0, p.stun - dt);
    if (p.bulwark > 0) { p.bulwark -= dt; if (p.bulwark <= 0) { p.bulwark = 0; p.barrier = 0; } }
    p.hp = Math.min(p.hpMax, p.hp + s.ch.S.hpRegen * dt);
    if (p.hp <= 0) return;
    // sebrání předmětu: cíl se zadá příkazem a zvedne se, jakmile je hráč blízko (i během úderu)
    if (inp.pickup != null) { const d = s.drops.find((x) => x.id === inp.pickup); if (d) { p.pick = d.id; p.moveTo = [d.x, d.z]; } }
    if (p.pick != null) {
      const d = s.drops.find((x) => x.id === p.pick);
      if (!d) p.pick = null; else if (len(d.x - p.x, d.z - p.z) <= PICK_R) { p.pick = null; p.moveTo = null; pickUp(s, d); s.stats.items++; }
    }
    if (inp.dodge && !p.dodge && p.dodgeCd <= 0 && p.stun <= 0) {
      let dx = inp.move ? inp.move[0] : Math.cos(p.face), dz = inp.move ? inp.move[1] : Math.sin(p.face); if (!dx && !dz) { dx = Math.cos(p.face); dz = Math.sin(p.face); }
      const d = len(dx, dz) || 1; p.dodge = { t: 0, dx: dx / d, dz: dz / d }; p.dodgeCd = DODGE.cd; p.act = null; p.moveTo = null; s.events.push({ t: 'dodge', x: p.x, z: p.z });
    }
    if (p.dodge) { p.dodge.t += dt; const v = DODGE.dist / DODGE.time; move(s, p, p.dodge.dx * v * dt, p.dodge.dz * v * dt, PLAYER_R); if (p.dodge.t >= DODGE.time) p.dodge = null; return; }
    if (p.stun > 0) return;
    if (!p.act) {
      if (inp.cast) startSkill(s, inp.cast, inp.aim);
      else if (inp.hold && inp.aim) startSkill(s, 'ak_cleave', inp.aim);
    }
    if (p.act) {
      const a = p.act; a.t += dt;
      if (a.id === 'ak_charge') {
        const k = Math.min(1, a.t / a.dur); const nx = a.from[0] + (a.to[0] - a.from[0]) * k, nz = a.from[1] + (a.to[1] - a.from[1]) * k; move(s, p, nx - p.x, nz - p.z, PLAYER_R);
        for (const e of s.enemies) { if (e.dead || a.hitIds.has(e.id)) continue; if (len(e.x - p.x, e.z - p.z) - e.r > 0.75 + PLAYER_R) continue; a.hitIds.add(e.id); if (strike(s, e, a.slot) && !a.stunned && e.type !== 'en_brute' && !e.heavy) { e.stun = 0.6; e.atk = null; a.stunned = true; } }
        if (k >= 1) { if (a.hitIds.size) { a.slot.cd = Math.max(0, a.slot.cd - 0.5 * a.hitIds.size); s.events.push({ t: 'hitstop', ms: 60 }); } p.act = null; }
        return;
      }
      if (!a.fired && a.t >= a.dur * WINDUP) { a.fired = true; fire(s, a); }
      if (a.t >= a.dur) p.act = null;
      return;
    }
    let mx = 0, mz = 0;
    if (inp.move && (inp.move[0] || inp.move[1])) { mx = inp.move[0]; mz = inp.move[1]; p.moveTo = null; p.pick = null; }
    else if (inp.moveTo) { p.moveTo = inp.moveTo.slice(); p.pick = null; }
    if (!mx && !mz && p.moveTo) { const dx = p.moveTo[0] - p.x, dz = p.moveTo[1] - p.z; const d = len(dx, dz); if (d < 0.15) p.moveTo = null; else { mx = dx / d; mz = dz / d; } }
    const d = len(mx, mz);
    if (d > 0) { mx /= d; mz /= d; const v = PLAYER_SPEED * s.ch.S.ms; move(s, p, mx * v * dt, mz * v * dt, PLAYER_R); if (!inp.aim) p.face = Math.atan2(mz, mx); }
    if (inp.aim) p.face = Math.atan2(inp.aim[1] - p.z, inp.aim[0] - p.x);
  }
  function move(s, o, dx, dz, r) {
    o.x += dx; o.z += dz;
    for (const [px, pz, pr] of s.pillars) { const ddx = o.x - px, ddz = o.z - pz; const d = len(ddx, ddz); const min = pr + r; if (d < min && d > 1e-6) { o.x = px + (ddx / d) * min; o.z = pz + (ddz / d) * min; } }
    const R = s.arenaR || ARENA; const d = len(o.x, o.z); if (d > R - r) { o.x *= (R - r) / d; o.z *= (R - r) / d; }
  }
  function inShape(s, e, atk, tx, tz) {
    const p = s.player; const a = atk.def;
    if (a.shape === 'circle') return len(p.x - tx, p.z - tz) <= a.range + PLAYER_R;
    const dx = p.x - e.x, dz = p.z - e.z; if (len(dx, dz) > a.range + PLAYER_R) return false;
    return angDiff(Math.atan2(dz, dx), atk.face) <= ((a.w / 2) * Math.PI) / 180 + 0.15;
  }
  function hurtPlayer(s, e, a) {
    const p = s.player; const L = e.L; const S = (p.bulwark > 0 ? s.chBulwark : s.ch).S;
    if (p.dodge && p.dodge.t <= DODGE.iframes) { s.stats.dodged++; s.events.push({ t: 'dodged', x: p.x, z: p.z }); return; }
    // armor a evasion proti levelu útočníka (F.armorDR, F.evadeChance v Bible)
    if (s.rnd() < HS.F.evadeChance(S.eva, L)) { s.events.push({ t: 'evade', x: p.x, z: p.z }); return; }
    const raw = HS.F.enemyDmg(L, e.def.dmgMul * a.mul) * (0.9 + s.rnd() * 0.2) * (e.weak > 0 ? 0.85 : 1);
    let dmg = Math.max(1, Math.round(raw * (1 - HS.F.armorDR(S.armor, L))));
    if (p.barrier > 0) { const ab = Math.min(p.barrier, dmg); p.barrier -= ab; dmg -= ab; s.events.push({ t: 'absorb', amt: Math.round(ab), x: p.x, z: p.z }); if (!dmg) return; }
    s.stats.taken += dmg; if (!p.invuln) p.hp -= dmg;
    if (a.stun) { p.stun = Math.max(p.stun, a.stun); p.act = null; }
    s.events.push({ t: 'hurt', dmg, x: p.x, z: p.z, by: e.type }); s.events.push({ t: 'shake', amp: a.mul >= 1.5 ? 0.3 : 0.15 });
    if (p.hp <= 0 && !p.invuln) { p.hp = 0; s.over = true; s.events.push({ t: 'over', wave: s.wave, kills: s.kills }); }
  }
  function updateEnemies(s) {
    const dt = TICK; const p = s.player; const alive = s.enemies.filter((e) => !e.dead);
    for (const e of alive) {
      if (s.boss && e.id === s.boss.id) { e.flash = Math.max(0, e.flash - dt); if (e.brand > 0) e.brand -= dt; if (e.weak > 0) e.weak -= dt; continue; }
      e.flash = Math.max(0, e.flash - dt); if (e.brand > 0) e.brand -= dt; if (e.weak > 0) e.weak -= dt; if (e.taunt > 0) e.taunt -= dt;
      if (e.burn.length) { let bd = 0; for (const b of e.burn) { const t = Math.min(dt, b.left); bd += b.dps * t; b.left -= dt; } e.burn = e.burn.filter((b) => b.left > 0); e.burnAcc = (e.burnAcc || 0) + bd; if (e.burnAcc >= 1) { const d = Math.floor(e.burnAcc); e.burnAcc -= d; e.hp -= d; s.stats.dmg += d; if (s.tick % 10 === 0) s.events.push({ t: 'burn', id: e.id, x: e.x, z: e.z, dmg: d }); if (e.hp <= 0) { kill(s, e); continue; } } }
      // odstrčení se tlumí
      if (e.push[0] || e.push[1]) { move(s, e, e.push[0] * dt * 6, e.push[1] * dt * 6, e.r); e.push[0] *= 0.7; e.push[1] *= 0.7; if (Math.abs(e.push[0]) + Math.abs(e.push[1]) < 0.01) e.push = [0, 0]; }
      e.cds = e.cds.map((c) => Math.max(0, c - dt));
      if (e.stun > 0) { e.stun -= dt; continue; }
      const dx = p.x - e.x, dz = p.z - e.z; const d = len(dx, dz);
      if (e.atk) {
        e.atk.t += dt;
        if (e.atk.t >= e.atk.def.tele) { if (p.hp > 0 && inShape(s, e, e.atk, e.atk.tx, e.atk.tz)) hurtPlayer(s, e, e.atk.def); e.cds[e.atk.i] = e.atk.def.cd; const sui = e.atk.def.suicide; e.atk = null; e.recover = 0.35; if (sui) { e.noLoot = true; s.events.push({ t: 'slam', x: e.x, z: e.z, r: 2.5, hits: 0 }); kill(s, e); } }
        continue;
      }
      if (e.recover > 0) { e.recover -= dt; continue; }
      if (s.over) continue;
      e.face = Math.atan2(dz, dx);
      const atks = HS.D.attacks[e.type];
      let chosen = -1; for (let i = atks.length - 1; i >= 0; i--) { if (e.cds[i] > 0) continue; const reach = atks[i].shape === 'circle' ? atks[i].range * 0.8 : atks[i].range + PLAYER_R * 0.5; if (d - e.r <= reach) { chosen = i; break; } }
      if (chosen >= 0) { const a = atks[chosen]; e.atk = { i: chosen, def: a, t: 0, face: e.face, tx: a.shape === 'circle' ? e.x : p.x, tz: a.shape === 'circle' ? e.z : p.z }; s.events.push({ t: 'tele', id: e.id, shape: a.shape, x: e.x, z: e.z, face: e.face, r: a.range, w: a.w || 360, dur: a.tele }); continue; }
      if (d > e.r + PLAYER_R + 0.2) move(s, e, (dx / d) * e.speed * dt, (dz / d) * e.speed * dt, e.r);
    }
    // oddělení nepřátel (měkké kolize)
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j]; const dx = b.x - a.x, dz = b.z - a.z; const d = len(dx, dz); const min = a.r + b.r; if (d >= min || d < 1e-6) continue;
      const k = ((min - d) / d) * 0.5; const wa = b.r / (a.r + b.r), wb = a.r / (a.r + b.r); a.x -= dx * k * wa; a.z -= dz * k * wa; b.x += dx * k * wb; b.z += dz * k * wb;
    }
    for (const e of alive) { const dx = e.x - p.x, dz = e.z - p.z; const d = len(dx, dz); const min = e.r + PLAYER_R; if (d < min && d > 1e-6) { e.x = p.x + (dx / d) * min; e.z = p.z + (dz / d) * min; } }
  }
  function step(s, inp) {
    s.events.length = 0; if (s.over) return s;
    s.tick++; s.t += TICK;
    updatePlayer(s, inp || {});
    updateEnemies(s);
    if (s.mode === 'boss') updateBoss(s);
    if (s.enemies.length > 300) s.enemies = s.enemies.filter((e) => !e.dead);
    if (s.mode === 'arena' && !s.over && s.enemies.every((e) => e.dead)) { s.enemies = []; nextWave(s); }
    if (s.drops.length > 60) s.drops.splice(0, s.drops.length - 60);
    if (s.mode === 'bench' && s.enemies.every((e) => e.dead)) { s.enemies = []; spawnBench(s, 50); }
    return s;
  }
  // jednoduchý autopilot pro benchmark a testy: drží se u středu, seká nejbližšího a občas použije Slam a Charge
  function autopilot(s) {
    const p = s.player; let best = null, bd = 1e9;
    for (const e of s.enemies) { if (e.dead) continue; const d = len(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; best = e; } }
    if (!best) return {};
    const aim = [best.x, best.z]; const inp = { aim };
    const tele = s.enemies.some((e) => e.atk && e.atk.def.mul >= 1.2 && e.atk.t > e.atk.def.tele - 0.35 && len(e.x - p.x, e.z - p.z) < 4);
    if (tele && p.dodgeCd <= 0) { inp.dodge = true; inp.move = [p.x - best.x || 1, p.z - best.z]; return inp; }
    const ready = (id) => s.skills[id].on && s.skills[id].cd <= 0;
    if (bd > 3 && ready('ak_charge') && p.res >= 20) inp.cast = 'ak_charge';
    else if (p.res >= 40 && ready('ak_slam') && bd < 3.5) inp.cast = 'ak_slam';
    else if (bd <= s.skills.ak_cleave.sk.r + best.r) inp.hold = true;
    else inp.move = [best.x - p.x, best.z - p.z];
    return inp;
  }
  root.HSim = { TICK, ARENA, PLAYER_R, DODGE, EQ_SLOTS, INV_MAX, ATTRS, create, step, autopilot, rng, invCommand, canEquip, slotFor, equipped, defaultGear, sanitizeGear, sanitizeChar, newChar, migrateSave, monsterLevel };
})(typeof window !== 'undefined' ? window : globalThis);
