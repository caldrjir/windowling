'use strict';
// GENEROVÁNO z Game Design Bible (needitovat ručně) – data pro prototyp P0.
// Zdroj: Echoes of the Hollow Sun – Game Design Bible v16 (https://claude.ai/artifact/2AEuTsGxsBrYAzdqQX7R2c)
window.HS_DATA = {
 "source": "Echoes of the Hollow Sun – Game Design Bible v16 (https://claude.ai/artifact/2AEuTsGxsBrYAzdqQX7R2c)",
 "generated": "2026-11-04",
 "BAL": {
  "hpBase": 60,
  "hpPerLevel": 14,
  "hpPerVit": 5,
  "hpPerStr": 1,
  "hpRegenBase": 0.003,
  "armorK": 45,
  "armorC": 250,
  "armorCap": 0.75,
  "evaK": 40,
  "evaC": 200,
  "evaCap": 0.6,
  "resCap": 75,
  "enemyResMin": -100,
  "critMultBase": 1.5,
  "critMultPerDex": 0.0005,
  "critIncPerDex": 0.002,
  "critCap": 0.95,
  "attrDmgPerPoint": 0.0025,
  "asPerDex": 0.0005,
  "csPerInt": 0.001,
  "cdrPerWil": 0.0015,
  "cdrCap": 0.4,
  "minActionTime": 0.25,
  "skillGrowth": 1.1,
  "costGrowth": 1.04,
  "skillMax": 20,
  "skillLevelEvery": 3,
  "enemyHp0": 40,
  "enemyHpGrowth": 1.085,
  "enemyDmg0": 10,
  "enemyDmgGrowth": 1.055,
  "enemyArmorPerL": 9,
  "eliteHp": 2.5,
  "eliteDmg": 1.4,
  "tierMult": [
   1,
   2.1,
   3.6,
   5.2
  ],
  "tierReqLevel": [
   1,
   18,
   36,
   54
  ],
  "freeAttrPerLevel": 3,
  "mxp0": 1.6,
  "mxpExp": 1.55
 },
 "cls": {
  "id": "ak",
  "n": "Ash Knight",
  "primary": "str",
  "res": "cinders",
  "resN": "Cinders",
  "base": {
   "str": 22,
   "dex": 10,
   "int": 8,
   "wil": 12,
   "vit": 20
  },
  "grow": {
   "str": 2,
   "dex": 0.5,
   "int": 0.25,
   "wil": 0.75,
   "vit": 1.5
  },
  "armor0": 40,
  "eva0": 10
 },
 "weapon": {
  "id": "wb_mace",
  "n": "Flanged Mace",
  "dmg": [
   7,
   11
  ],
  "aps": 1.2,
  "imp": {
   "physInc": 0.05
  }
 },
 "skills": [
  {
   "id": "ak_cleave",
   "n": "Cleave",
   "k": "attack",
   "t": [
    "melee",
    "aoe",
    "generator",
    "physical"
   ],
   "dt": "phys",
   "rc": -8,
   "an": 1,
   "we": 207,
   "wg": 3,
   "r": 2.8,
   "cr": 5,
   "cd": 0,
   "req": 1,
   "d": "Široký sek před postavou zasáhne všechny nepřátele v oblouku.",
   "st": "—",
   "vfx": "Žhnoucí stopa čepele, jiskry na zásahu",
   "sfx": "Těžký švih + kovový dopad, praskání uhlíků"
  },
  {
   "id": "ak_charge",
   "n": "Ember Charge",
   "k": "attack",
   "t": [
    "melee",
    "movement",
    "physical"
   ],
   "dt": "phys",
   "rc": 20,
   "an": null,
   "we": 162,
   "wg": 2,
   "r": 8,
   "cr": 5,
   "cd": 6,
   "fixedTime": 0.45,
   "req": 4,
   "d": "Výpad vpřed, který srazí vše na dráze a omráčí první cíl.",
   "st": "Stun 0,6 s (ne bossové)",
   "vfx": "Ohnivá stopa za postavou",
   "sfx": "Dupot + výbuch žhavého prachu"
  },
  {
   "id": "ak_slam",
   "n": "Searing Slam",
   "k": "attack",
   "t": [
    "melee",
    "aoe",
    "fire",
    "spender",
    "dot"
   ],
   "dt": "phys",
   "conv": {
    "to": "fire",
    "pct": 100
   },
   "rc": 35,
   "an": 1.3,
   "we": 378,
   "wg": 5,
   "r": 3,
   "cr": 6,
   "cd": 0,
   "dot": {
    "pct": 40,
    "dur": 4,
    "chance": 1,
    "type": "fire"
   },
   "req": 6,
   "d": "Úder do země, který rozžhaví půdu.",
   "st": "Burn: 40 % zásahu jako Fire DoT během 4 s",
   "vfx": "Kruhová tlaková vlna, praskliny s lávou",
   "sfx": "Hluboký dopad, basový rumble"
  }
 ],
 "enemies": [
  {
   "id": "en_thrall",
   "n": "Ashen Thrall",
   "arche": "Melee swarmer",
   "lv": [
    1,
    12
   ],
   "hpMul": 1,
   "dmgMul": 1,
   "aps": 0.8,
   "ms": 2.6,
   "armorMul": 0.6,
   "res": {
    "fire": 20,
    "cold": -10
   },
   "abil": [
    "Úder pěstí (1,0×)",
    "Uchopení: slow 20 % 1 s"
   ],
   "pattern": "Pomalé vlny; obklíčí hráče. Telegraph 0,6 s.",
   "eva": 0,
   "xpMul": 0.9
  },
  {
   "id": "en_brute",
   "n": "Smoldering Brute",
   "arche": "Tank",
   "lv": [
    5,
    12
   ],
   "hpMul": 2.6,
   "dmgMul": 1.6,
   "aps": 0.6,
   "ms": 2.4,
   "armorMul": 1.6,
   "res": {
    "fire": 30
   },
   "abil": [
    "Drtivý úder (1,6×, telegraph 0,9 s)",
    "Dupnutí AoE 3 m (1,2×, stun 0,5 s)"
   ],
   "pattern": "Pomalý, velké telegraphy; trestá stání na místě.",
   "eva": 0,
   "xpMul": 2.4
  }
 ],
 "attacks": {
  "en_thrall": [
   {
    "n": "Úder pěstí",
    "mul": 1,
    "tele": 0.6,
    "range": 1.6,
    "shape": "cone",
    "w": 90,
    "cd": 1.25
   }
  ],
  "en_brute": [
   {
    "n": "Drtivý úder",
    "mul": 1.6,
    "tele": 0.9,
    "range": 2.6,
    "shape": "cone",
    "w": 70,
    "cd": 2.2
   },
   {
    "n": "Dupnutí",
    "mul": 1.2,
    "tele": 0.9,
    "range": 3,
    "shape": "circle",
    "cd": 7,
    "stun": 0.5
   }
  ]
 },
 "level": 8
};
