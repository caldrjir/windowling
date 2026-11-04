'use strict';
// Echoes of the Hollow Sun – P0: jádro výpočtů. Přímý port vzorců z Game Design Bible (core.js:
// F.*, calcChar, weaponOf, skillBase, computeHit) pro postavu bez talentů a vybavení s affixy.
// Parita s Bible je hlídaná unit testem (src/lib/games/hollowsun.test.ts) proti exportované tabulce.
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
  };

  // referenční alokace: 2/3 volných bodů do primárního atributu, zbytek VIT (G.refChar v Bible)
  function alloc(L) {
    const free = (L - 1) * B.freeAttrPerLevel; const a = {};
    a[D.cls.primary] = Math.round((free * 2) / 3); a.vit = free - a[D.cls.primary];
    return a;
  }
  function weaponOf(L) {
    const w = D.weapon; const tm = B.tierMult[F.itemTierFor(L)];
    const min = w.dmg[0] * tm, max = w.dmg[1] * tm; // weaponDmgMult = 1, bez affixů
    return { avg: (min + max) / 2, min, max, aps: w.aps, n: w.n };
  }
  function calcChar(L) {
    const c = D.cls; const al = alloc(L); const A = {};
    for (const k of ['str', 'dex', 'int', 'wil', 'vit']) A[k] = Math.round(c.base[k] + c.grow[k] * (L - 1) + (al[k] || 0));
    const S = {};
    S.hp = Math.floor(B.hpBase + B.hpPerLevel * (L - 1) + B.hpPerVit * A.vit + B.hpPerStr * A.str);
    S.res = 100; S.resRegen = 0; S.cinderOnHit = 1; // Cinders (Ash Knight)
    S.hpRegen = S.hp * (B.hpRegenBase + 0.0002 * A.vit);
    S.armor = Math.round(c.armor0 + 3 * L + A.str);
    S.eva = Math.round(c.eva0 + 3 * L + 2 * A.dex);
    S.acc = Math.round(10 + 6 * L + 2 * A.dex);
    S.critInc = A.dex * B.critIncPerDex; S.critFlat = 0;
    S.critMult = B.critMultBase + A.dex * B.critMultPerDex;
    S.asInc = A.dex * B.asPerDex;
    S.cdr = Math.min(B.cdrCap, A.wil * B.cdrPerWil);
    S.dr = F.armorDR(S.armor, L); S.evade = F.evadeChance(S.eva, L);
    return { L, A, S, weapon: weaponOf(L) };
  }
  function refEnemy(L, id) {
    const e = D.enemies.find((x) => x.id === id);
    return { id, n: e.n, level: L, hp: F.enemyHp(L, e.hpMul), armor: F.enemyArmor(L, e.armorMul), eva: e.eva ? Math.round(e.eva * (1 + L * 0.05)) : Math.round(10 + 3 * L), res: Object.assign({ fire: 0, cold: 0, light: 0, nec: 0, rad: 0 }, e.res), def: e };
  }
  function skillBase(sk, sl, weapon) {
    if (sk.we != null) { const eff = sk.we + (sk.wg ?? 4) * (sl - 1); return { avg: (weapon.avg * eff) / 100, eff }; }
    return { avg: 0, eff: null };
  }
  /* Zásah skillu: base → konverze → increased (atribut) → crit → mitigace → šance zásahu → DoT → čas, cena, DPS */
  function computeHit(sk, sl, ch, en) {
    const S = ch.S, A = ch.A; const weapon = ch.weapon;
    const base = skillBase(sk, sl, weapon);
    const types = {}; types[sk.dt || 'phys'] = 1;
    if (sk.conv) { const p = sk.conv.pct / 100; types[sk.dt || 'phys'] = 1 - p; types[sk.conv.to] = (types[sk.conv.to] || 0) + p; }
    for (const t in types) if (types[t] < 1e-6) delete types[t];
    const isAtk = sk.k === 'attack' || sk.we != null;
    const inc = A[D.cls.primary] * B.attrDmgPerPoint; // bez talentů a affixů: primární atribut…
    const imp = D.weapon.imp || {}; // …a implicitní vlastnost zbraně (Flanged Mace: +5 % physical)
    const typeInc = (t) => (imp[t + 'Inc'] || 0) + (['fire', 'cold', 'light'].includes(t) ? imp.eleInc || 0 : 0);
    const baseCrit = (sk.cr ?? 5) / 100;
    const critChance = Math.min(B.critCap, baseCrit * (1 + S.critInc) + S.critFlat / 100);
    const eCrit = 1 + critChance * (S.critMult - 1);
    const perType = {}; let total = 0;
    for (const t in types) {
      const raw = base.avg * types[t] * (1 + inc + typeInc(t)) * eCrit;
      let mit = 0;
      if (en) {
        if (t === 'phys') mit = F.armorDR(en.armor, ch.L);
        else { const r = (en.res && en.res[t]) || 0; mit = Math.max(B.enemyResMin, Math.min(B.resCap, r)) / 100; }
      }
      perType[t] = raw * (1 - mit); total += perType[t];
    }
    const hitChance = isAtk && en ? F.hitChance(S.acc, en.eva || 0) : 1;
    const dot = sk.dot ? (sk.dot.type ? perType[sk.dot.type] || 0 : total) * (sk.dot.pct / 100) * (sk.dot.chance ?? 1) : 0;
    const perHit = total; const perUse = perHit * hitChance; const final = Math.round(perUse);
    let actTime = isAtk ? (1 / (weapon.aps * (1 + S.asInc))) * (sk.an || 1) : 0;
    if (sk.fixedTime) actTime = sk.fixedTime;
    actTime = Math.max(B.minActionTime, actTime);
    const cd = sk.cd ? sk.cd / (1 + S.cdr) : 0;
    const cost = sk.rc == null ? 0 : sk.rc < 0 ? sk.rc : Math.round(sk.rc * F.costMult(sl));
    const dps = (perUse + (dot / Math.max(1, (sk.dot && sk.dot.dur) || 4)) * Math.min(actTime, 4)) / Math.max(actTime, cd || 0);
    return { perHit, final, dot, critChance, eCrit, hitChance, actTime, cd, cost, dps, types: perType };
  }
  root.HS = { D, B, F, alloc, calcChar, weaponOf, refEnemy, skillBase, computeHit, skill: (id) => D.skills.find((s) => s.id === id) };
})(typeof window !== 'undefined' ? window : globalThis);
