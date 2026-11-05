'use strict';
// Echoes of the Hollow Sun: jádro výpočtů. Port vzorců z Game Design Bible (core.js: F.*, G.rng,
// G.itemMods, G.weaponOf, G.calcChar, G.skillBase, G.computeHit; v-systems.js: G.rollRarity, G.genItem)
// pro postavu bez talentů, pasivů a Echoes. Parita s Bible je hlídaná unit testy
// (src/lib/games/hollowsun.test.ts a hollowsun-loot.test.ts) proti tabulkám exportovaným z Bible.
(function (root) {
  const D = root.HS_DATA;
  const B = D.BAL;
  const F = {
    enemyHp: (L, mul) => Math.round(B.enemyHp0 * (mul || 1) * Math.pow(B.enemyHpGrowth, L - 1)),
    enemyDmg: (L, mul) => Math.round(B.enemyDmg0 * (mul || 1) * Math.pow(B.enemyDmgGrowth, L - 1) * 10) / 10,
    enemyArmor: (L, mul) => Math.round((mul == null ? 1 : mul) * (20 + B.enemyArmorPerL * L)),
    armorDR: (armor, attackerLevel) => Math.min(B.armorCap, armor / (armor + B.armorK * attackerLevel + B.armorC)),
    evadeChance: (eva, attackerLevel) => Math.min(B.evaCap, eva / (eva + B.evaK * attackerLevel + B.evaC)),
    hitChance: (acc, eva) => Math.max(0.05, Math.min(1, (1.15 * acc) / (acc + Math.max(1, eva)))),
    skillMult: (sl) => Math.pow(B.skillGrowth, sl - 1),
    costMult: (sl) => Math.pow(B.costGrowth, sl - 1),
    maxSkillLevel: (charL, req) => Math.max(1, Math.min(B.skillMax, 1 + Math.floor((charL - req) / B.skillLevelEvery))),
    itemTierFor: (ilvl) => { let r = 0; B.tierReqLevel.forEach((t, i) => { if (ilvl >= t) r = i; }); return r; },
    monsterXp: (L, mul) => Math.max(1, Math.round(B.mxp0 * (mul || 1) * Math.pow(L + 4, B.mxpExp))),
    xpToNext: (L) => { let x = B.xpA * Math.pow(L, B.xpExp) + B.xpB * L; if (L >= B.xpEndFrom) x *= Math.pow(B.xpEndGrowth, L - B.xpEndFrom + 1); return Math.round(x / 10) * 10; },
    xpPenalty: (pL, mL) => { const safe = 3 + Math.floor(pL / 16); const d = Math.abs(pL - mL) - safe; return d <= 0 ? 1 : Math.max(0.1, 1 - 0.2 * d); },
  };

  /* ---------- deterministické RNG (G.seedHash + G.rng v Bible) ---------- */
  function seedHash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function rng(seed) {
    let a = seedHash(String(seed));
    const f = function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.wpick = (pairs) => { let tot = 0; for (const p of pairs) tot += p[1]; let x = f() * tot; for (const p of pairs) { x -= p[1]; if (x < 0) return p[0]; } return pairs[pairs.length - 1][0]; };
    return f;
  }

  /* ---------- registr dat lootu ---------- */
  const L0 = D.loot;
  const BY = {};
  for (const k of ['bases', 'affixes', 'uniques']) for (const o of L0[k]) BY[o.id] = o;
  const get = (id) => BY[id] || null;

  /* ---------- předměty (G.rollRarity, G.genItem, G.itemMods, G.weaponOf) ---------- */
  function rollRarity(r, mf, type) {
    const w = B.rarW; const m = 1 + mf / 100; const bonus = type === 'rare' ? 3 : type === 'elite' ? 1.5 : 1;
    return r.wpick([['common', w.common], ['magic', w.magic * m * bonus], ['rare', w.rare * m * bonus], ['unique', w.unique * m * bonus]]);
  }
  function genItem(r, ilvl, cls, forceRar, slot) {
    const tier = F.itemTierFor(ilvl);
    let pool = L0.bases.filter((b) => !slot || b.slot === slot);
    if (cls && r() < B.smartLoot) pool = pool.filter((b) => b.cls.includes(cls));
    const base = r.pick(pool);
    const rar = forceRar || rollRarity(r, 0, 'normal');
    if (rar === 'unique') { const us = L0.uniques.filter((u) => u.base === base.id && u.req <= ilvl + 3); if (us.length) { const u = r.pick(us); return { base: u.base, tier: Math.max(u.tier, tier), unique: u.id, affixes: [], rar: 'unique', q: r() }; } return genItem(r, ilvl, cls, 'rare', slot); }
    const n = rar === 'common' ? 0 : rar === 'magic' ? r.int(1, 2) : r.wpick([[3, 30], [4, 35], [5, 25], [6, 10]]);
    const affixes = []; const used = new Set(); let pre = 0, suf = 0;
    for (let i = 0; i < n; i++) {
      const cand = L0.affixes.filter((a) => a.slots.includes(base.slot) && !used.has(a.group) && a.tiers.some((t) => t[0] <= ilvl) && (a.kind === 'prefix' ? pre < (rar === 'magic' ? 1 : 3) : suf < (rar === 'magic' ? 1 : 3)));
      if (!cand.length) break; const af = r.wpick(cand.map((a) => [a, a.w])); used.add(af.group); if (af.kind === 'prefix') pre++; else suf++;
      const allowed = af.tiers.map((t, idx) => [idx, t]).filter(([, t]) => t[0] <= ilvl); const ti = r.wpick(allowed.map(([idx]) => [idx, idx + 1]));
      affixes.push([af.id, ti, Math.round(r() * 100) / 100]);
    }
    return { base: base.id, tier, affixes, rar };
  }
  function addMod(m, key, v) { m[key] = (m[key] || 0) + v; }
  function affixValue(a) { const af = get(a[0]); const t = af.tiers[Math.min(a[1] || 0, af.tiers.length - 1)]; return t[1] + (t[2] - t[1]) * (a[2] ?? 0.5); }
  function itemMods(inst) {
    const m = {}; if (!inst) return m;
    const base = get(inst.base); if (!base) return m;
    const tm = B.tierMult[inst.tier || 0];
    if (base.armor) addMod(m, 'armorFlat', Math.round(base.armor * tm));
    if (base.eva) addMod(m, 'evaFlat', Math.round(base.eva * tm));
    if (base.block) addMod(m, 'block', base.block / 100);
    if (base.imp) for (const k in base.imp) addMod(m, k, base.imp[k]);
    if (inst.unique) { const u = get(inst.unique); if (u) for (const l of u.lines) addMod(m, l[0], l[1] + ((l[2] ?? l[1]) - l[1]) * (inst.q ?? 0.5)); }
    for (const a of inst.affixes || []) { const af = get(a[0]); if (!af) continue; const v = affixValue(a); addMod(m, af.stat, af.pct ? v / 100 : v); }
    return m;
  }
  function weaponOf(items) {
    const mh = (items || []).find((i) => { const b = get(i.base); return b && b.slot === 'main'; });
    if (!mh) return { avg: 4, aps: 1.2, n: 'Neozbrojený', min: 2, max: 6 };
    const b = get(mh.base); const tm = B.tierMult[mh.tier || 0];
    let min = b.dmg[0] * tm * B.weaponDmgMult, max = b.dmg[1] * tm * B.weaponDmgMult;
    const m = itemMods(mh); const pinc = m.wPhysInc || 0;
    min = min * (1 + pinc) + (m.wFlat || 0) * 0.6; max = max * (1 + pinc) + (m.wFlat || 0) * 1.4;
    const aps = b.aps * (1 + (m.wAs || 0));
    return { avg: (min + max) / 2, min: Math.round(min), max: Math.round(max), aps: Math.round(aps * 100) / 100, n: mh.unique ? get(mh.unique).n : b.n };
  }
  // výchozí výbava prototypu: Flanged Mace tieru levelu (referenční postava Bible)
  const starterGear = (L) => [{ base: 'wb_mace', tier: F.itemTierFor(L), affixes: [], rar: 'common' }];

  /* ---------- postava (G.calcChar bez talentů, pasivů, originu a bariér) ---------- */
  // referenční alokace: 2/3 volných bodů do primárního atributu, zbytek VIT (G.refChar v Bible)
  function alloc(L) {
    const free = (L - 1) * B.freeAttrPerLevel; const a = {};
    a[D.cls.primary] = Math.round((free * 2) / 3); a.vit = free - a[D.cls.primary];
    return a;
  }
  // al: rozdělené body atributů (výchozí = referenční alokace Bible); extra: dočasné modifikátory (buffy, cfg.extra v Bible)
  function calcChar(L, items, al, extra) {
    items = items || starterGear(L);
    const c = D.cls; al = al || alloc(L); const m = {};
    for (const it of items) { const im = itemMods(it); for (const k in im) addMod(m, k, im[k]); }
    for (const k in extra || {}) addMod(m, k, extra[k]);
    const A = {};
    for (const k of ['str', 'dex', 'int', 'wil', 'vit']) A[k] = Math.round(c.base[k] + c.grow[k] * (L - 1) + (al[k] || 0) + (m[k] || 0) + (m.allAttr || 0));
    const S = {};
    S.hp = Math.floor((B.hpBase + B.hpPerLevel * (L - 1) + B.hpPerVit * A.vit + B.hpPerStr * A.str + (m.hpFlat || 0)) * (1 + (m.hpInc || 0)));
    S.res = 100 + (m.resFlat || 0); S.resRegen = 0; S.cinderOnHit = 1 + (m.cinderOnHit || 0); // Cinders (Ash Knight)
    S.hpRegen = S.hp * (B.hpRegenBase + 0.0002 * A.vit + (m.hpRegenPct || 0));
    S.armor = Math.round((c.armor0 + 3 * L + A.str + (m.armorFlat || 0)) * (1 + (m.armorInc || 0)));
    S.eva = Math.round((c.eva0 + 3 * L + 2 * A.dex + (m.evaFlat || 0)) * (1 + (m.evaInc || 0)));
    S.acc = Math.round((10 + 6 * L + 2 * A.dex + (m.accFlat || 0)) * (1 + (m.accInc || 0)));
    S.critInc = A.dex * B.critIncPerDex + (m.critInc || 0);
    S.critFlat = m.critFlat || 0;
    S.critMult = B.critMultBase + A.dex * B.critMultPerDex + (m.critMult || 0);
    S.asInc = A.dex * B.asPerDex + (m.as || 0);
    S.csInc = A.int * B.csPerInt + (m.cs || 0);
    S.cdr = Math.min(B.cdrCap, A.wil * B.cdrPerWil + (m.cdr || 0));
    S.block = Math.min(B.blockCap, m.block || 0);
    S.ms = Math.min(B.msCap, 1 + (m.ms || 0));
    S.inc = {
      all: m.dmgInc || 0, attack: m.attackInc || 0, spell: m.spellInc || 0, phys: m.physInc || 0, fire: m.fireInc || 0, cold: m.coldInc || 0, light: m.lightInc || 0,
      nec: m.necInc || 0, rad: m.radInc || 0, ele: m.eleInc || 0, dot: m.dotInc || 0, aoe: m.aoeInc || 0, proj: m.projInc || 0, melee: m.meleeInc || 0, minion: A.wil * 0.003 + (m.minionInc || 0), bleed: m.bleedInc || 0,
    };
    S.more = []; if (m.moreDmg) S.more.push(m.moreDmg);
    S.dr = F.armorDR(S.armor, L); S.evade = F.evadeChance(S.eva, L);
    return { L, A, S, m, items, al, weapon: weaponOf(items) };
  }
  function refEnemy(L, id) {
    const e = D.enemies.find((x) => x.id === id);
    return { id, n: e.n, level: L, hp: F.enemyHp(L, e.hpMul), armor: F.enemyArmor(L, e.armorMul), eva: e.eva ? Math.round(e.eva * (1 + L * 0.05)) : Math.round(10 + 3 * L), res: Object.assign({ fire: 0, cold: 0, light: 0, nec: 0, rad: 0 }, e.res), def: e };
  }
  function skillBase(sk, sl, weapon, addPhys) {
    if (sk.we != null) { const eff = sk.we + (sk.wg ?? 4) * (sl - 1); return { avg: ((weapon.avg + (addPhys || 0)) * eff) / 100, eff }; }
    if (sk.b) return { avg: ((sk.b[0] + sk.b[1]) / 2) * F.skillMult(sl), eff: null };
    return { avg: 0, eff: null };
  }
  /* Zásah skillu (G.computeHit bez Echoes): base → konverze → increased → more → crit → mitigace → šance zásahu → DoT → čas, cena, DPS */
  function computeHit(sk, sl, ch, en) {
    const S = ch.S, A = ch.A; const weapon = ch.weapon;
    const bonusSl = Math.round(ch.m.skillLvl || 0); if (bonusSl) sl = Math.min(B.skillMax + 5, sl + bonusSl);
    const base = skillBase(sk, sl, weapon, ch.m.addPhys || 0);
    const hitsPerUse = sk.hitsN || 1;
    const types = {}; types[sk.dt || 'phys'] = 1;
    if (sk.conv) { const p = sk.conv.pct / 100; types[sk.dt || 'phys'] = 1 - p; types[sk.conv.to] = (types[sk.conv.to] || 0) + p; }
    for (const t in types) if (types[t] < 1e-6) delete types[t];
    const isAtk = sk.k === 'attack' || sk.we != null; const tags = sk.t || [];
    const attrInc = A[sk.at || D.cls.primary] * B.attrDmgPerPoint;
    const incCommon = S.inc.all + (isAtk ? S.inc.attack : S.inc.spell) + attrInc + (tags.includes('aoe') ? S.inc.aoe : 0) + (tags.includes('projectile') ? S.inc.proj : 0) + (tags.includes('melee') ? S.inc.melee : 0) + (tags.includes('summon') ? S.inc.minion : 0) + (tags.includes('dot') ? S.inc.dot : 0);
    let more = 1; for (const v of S.more) more *= 1 + v;
    const baseCrit = (sk.cr ?? 5) / 100;
    const critChance = sk.alwaysCrit ? 1 : Math.min(B.critCap, baseCrit * (1 + S.critInc) + S.critFlat / 100);
    const eCrit = 1 + critChance * (S.critMult - 1);
    const perType = {}; let total = 0;
    for (const t in types) {
      let inc = incCommon + (S.inc[t] || 0); if (t !== 'phys' && S.inc.ele && ['fire', 'cold', 'light'].includes(t)) inc += S.inc.ele;
      const raw = base.avg * types[t] * (1 + inc) * more * eCrit;
      let mit = 0;
      if (en) {
        if (t === 'phys') mit = F.armorDR(en.armor, ch.L);
        else { const r = (en.res && en.res[t]) || 0; mit = Math.max(B.enemyResMin, Math.min(B.resCap, r)) / 100; }
      }
      perType[t] = raw * (1 - mit); total += perType[t];
    }
    const hitChance = isAtk && en ? F.hitChance(S.acc, en.eva || 0) : 1;
    const dot = sk.dot ? (sk.dot.type ? perType[sk.dot.type] || 0 : total) * (sk.dot.pct / 100) * (sk.dot.chance ?? 1) * (1 + S.inc.dot) : 0;
    const perHit = total; const perUse = perHit * hitsPerUse * hitChance; const final = Math.round(perUse);
    let actTime;
    if (sk.tick != null) actTime = sk.tick / (1 + (isAtk ? S.asInc : S.csInc));
    else if (isAtk) actTime = (1 / (weapon.aps * (1 + S.asInc))) * (sk.an || 1);
    else actTime = (sk.ct || 0) / (1 + S.csInc);
    if (sk.fixedTime) actTime = sk.fixedTime;
    actTime = Math.max(B.minActionTime, actTime);
    const cd = sk.cd ? sk.cd / (1 + S.cdr) : 0;
    const cost = sk.rc == null ? 0 : sk.rc < 0 ? sk.rc : Math.round(sk.rc * F.costMult(sl));
    const dps = (perUse + (dot / Math.max(1, (sk.dot && sk.dot.dur) || 4)) * Math.min(actTime, 4)) / Math.max(actTime, cd || 0);
    return { perHit, final, dot, critChance, eCrit, hitChance, actTime, cd, cost, dps, types: perType };
  }

  /* ---------- popis předmětu (tooltip) ---------- */
  const fmt = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1)).replace('.', ',');
  function describe(inst) {
    const base = get(inst.base); const u = inst.unique ? get(inst.unique) : null;
    const lines = [];
    if (base.slot === 'main') { const w = weaponOf([inst]); lines.push(['base', `Poškození ${w.min}–${w.max} · ${String(w.aps).replace('.', ',')} útoků/s`]); }
    const tm = B.tierMult[inst.tier || 0];
    if (base.armor) lines.push(['base', `Armor ${Math.round(base.armor * tm)}`]);
    if (base.eva) lines.push(['base', `Evasion ${Math.round(base.eva * tm)}`]);
    if (base.block) lines.push(['base', `Block ${base.block} %`]);
    if (base.impT && base.impT !== '—' && !lines.some((l) => l[1] === base.impT)) lines.push(['imp', base.impT]);
    if (u) for (const l of u.lines) { const v = l[1] + ((l[2] ?? l[1]) - l[1]) * (inst.q ?? 0.5); lines.push(['aff', `${l[0]} ${Math.abs(v) < 2 ? '+' + Math.round(v * 100) + ' %' : '+' + fmt(v)}`]); }
    for (const a of inst.affixes || []) { const af = get(a[0]); if (!af) continue; lines.push(['aff', af.txt.replace('{v}', fmt(affixValue(a))), af.kind, a[1]]); }
    if (u && u.spec) lines.push(['spec', u.spec]);
    return { name: u ? u.n : (inst.rar === 'magic' || inst.rar === 'rare') && inst.affixes && inst.affixes.length ? affixName(inst, base) : base.n, base: base.n, cat: base.cat, slot: base.slot, hand: base.hand, rar: inst.rar, tier: inst.tier || 0, req: Object.assign({ level: B.tierReqLevel[inst.tier || 0] }, base.req || {}), lines };
  }
  function affixName(inst, base) {
    const pre = (inst.affixes || []).map((a) => get(a[0])).find((af) => af && af.kind === 'prefix');
    const suf = (inst.affixes || []).map((a) => get(a[0])).find((af) => af && af.kind === 'suffix');
    if (inst.rar === 'magic') return [pre && pre.n, base.n, suf && (/^of /i.test(suf.n) ? suf.n : 'of ' + suf.n)].filter(Boolean).join(' ');
    return `${pre ? pre.n : base.cat} ${suf ? suf.n : base.cat}`.replace(/^(\S+) \1$/, '$1') + ' · ' + base.n;
  }

  // Ashen Bulwark: štít = (15 % + 1 % × úroveň skillu) Max HP (G.BARRIERS.ak_bulwark)
  const bulwarkBarrier = (ch, sl) => (0.15 + 0.01 * sl) * ch.S.hp;
  root.HS = { D, B, F, rng, bulwarkBarrier, seedHash, get, alloc, calcChar, weaponOf, itemMods, rollRarity, genItem, starterGear, describe, refEnemy, skillBase, computeHit, skill: (id) => D.skills.find((s) => s.id === id) };
})(typeof window !== 'undefined' ? window : globalThis);
