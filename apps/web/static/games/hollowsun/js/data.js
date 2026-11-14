'use strict';
// GENEROVÁNO z Game Design Bible (needitovat ručně) – data pro prototyp P0.
// Zdroj: Echoes of the Hollow Sun – Game Design Bible v25 (https://claude.ai/artifact/2AEuTsGxsBrYAzdqQX7R2c)
window.HS_DATA = {
 "source": "Echoes of the Hollow Sun – Game Design Bible v25 (https://claude.ai/artifact/2AEuTsGxsBrYAzdqQX7R2c)",
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
  "mxpExp": 1.55,
  "rarW": {
   "common": 780,
   "magic": 180,
   "rare": 36,
   "unique": 4
  },
  "dropChance": {
   "normal": 0.1,
   "elite": 0.35,
   "rare": 0.9
  },
  "smartLoot": 0.6,
  "pityUnique": 600,
  "weaponDmgMult": 1,
  "msCap": 1.6,
  "blockCap": 0.6,
  "tenCap": 0.5,
  "tenPerWil": 0.0015,
  "resHardCap": 90,
  "actResPenalty": [
   0,
   0,
   -10,
   -20,
   -30,
   -40
  ],
  "blockMitigation": 0.7,
  "xpA": 160,
  "xpExp": 1.85,
  "xpB": 40,
  "xpEndFrom": 50,
  "xpEndGrowth": 1.12,
  "levelCap": 70
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
   "sfx": "Těžký švih + kovový dopad, praskání uhlíků",
   "ct": null,
   "du": null,
   "aoe": "2,8 m, oblouk 150°"
  },
  {
   "id": "ak_brand",
   "n": "Brand Strike",
   "k": "attack",
   "t": [
    "melee",
    "generator",
    "physical",
    "fire"
   ],
   "dt": "phys",
   "conv": {
    "to": "fire",
    "pct": 50
   },
   "rc": -6,
   "an": 1,
   "we": 252,
   "wg": 4,
   "r": 2.5,
   "cr": 7,
   "cd": 0,
   "req": 2,
   "d": "Úder, který vypálí cejch. 50 % Physical se konvertuje na Fire.",
   "st": "Brand: cíl má +10 % zvýšené Fire poškození 4 s",
   "vfx": "Žhnoucí runa na cíli",
   "sfx": "Syčení rozžhaveného kovu",
   "ct": null,
   "du": 4,
   "aoe": null
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
   "sfx": "Dupot + výbuch žhavého prachu",
   "ct": null,
   "du": null,
   "aoe": "dráha šířky 1,5 m"
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
   "sfx": "Hluboký dopad, basový rumble",
   "ct": null,
   "du": null,
   "aoe": "kruh 3,5 m"
  },
  {
   "id": "ak_bulwark",
   "n": "Ashen Bulwark",
   "k": "buff",
   "t": [
    "buff",
    "defense",
    "duration"
   ],
   "dt": null,
   "rc": 30,
   "an": null,
   "r": null,
   "cr": null,
   "cd": 14,
   "req": 8,
   "d": "Popelavý štít obalí postavu.",
   "st": "Štít = 15 % Max HP + 1 % za úroveň skillu; +20 % Armor",
   "vfx": "Šedý popelavý plášť",
   "sfx": "Šumění popela",
   "ct": 0,
   "du": 6,
   "aoe": null
  },
  {
   "id": "ak_warcry",
   "n": "Cry of the Pyre",
   "k": "buff",
   "t": [
    "warcry",
    "aoe",
    "duration"
   ],
   "dt": null,
   "rc": -40,
   "an": null,
   "r": null,
   "cr": null,
   "cd": 18,
   "req": 10,
   "d": "Válečný pokřik, který přitáhne nepřátele a naplní Cinders.",
   "st": "Taunt 4 s; nepřátelé −15 % damage 6 s",
   "vfx": "Kruh jisker",
   "sfx": "Řev + echo",
   "ct": 0.4,
   "du": 6,
   "aoe": "kruh 7 m"
  }
 ],
 "areas": [
  {
   "id": "a1_cinderhold",
   "n": "Cinderhold",
   "lv": [
    1,
    1
   ],
   "enemies": [],
   "type": "town",
   "links": [
    "a1_ashfields"
   ],
   "inst": "fixed",
   "d": "Opevněné hornické město kolem vyhaslých pecí. Hub Act I."
  },
  {
   "id": "a1_ashfields",
   "n": "Ashfields",
   "lv": [
    1,
    3
   ],
   "enemies": [
    "en_thrall",
    "en_hound"
   ],
   "type": "field",
   "links": [
    "a1_cinderhold",
    "a1_burnt_orchard",
    "a1_chapel_crypt"
   ],
   "inst": "hybrid",
   "d": "Spálená pole s hromadnými hroby. Tutoriál pohybu a boje."
  },
  {
   "id": "a1_burnt_orchard",
   "n": "Burnt Orchard",
   "lv": [
    3,
    5
   ],
   "enemies": [
    "en_thrall",
    "en_wisp",
    "en_bowman"
   ],
   "type": "field",
   "links": [
    "a1_ashfields",
    "a1_tollgate"
   ],
   "inst": "hybrid"
  },
  {
   "id": "a1_chapel_crypt",
   "n": "Chapel of Embers – Crypt",
   "lv": [
    4,
    6
   ],
   "enemies": [
    "en_bowman",
    "en_acolyte"
   ],
   "type": "dungeon",
   "links": [
    "a1_ashfields"
   ],
   "inst": "proc",
   "d": "Procedurální krypta (archetyp Crypt, 2 patra)."
  },
  {
   "id": "a1_tollgate",
   "n": "Ironbound Tollgate",
   "lv": [
    5,
    7
   ],
   "enemies": [
    "en_brute",
    "en_hound"
   ],
   "type": "field",
   "links": [
    "a1_burnt_orchard",
    "a1_charcoal_woods"
   ],
   "inst": "hybrid"
  },
  {
   "id": "a1_charcoal_woods",
   "n": "Charcoal Woods",
   "lv": [
    6,
    9
   ],
   "enemies": [
    "en_hound",
    "en_wisp",
    "en_brute"
   ],
   "type": "field",
   "links": [
    "a1_tollgate",
    "a1_kiln",
    "a1_gallows"
   ],
   "inst": "hybrid"
  },
  {
   "id": "a1_gallows",
   "n": "Gallows Hill",
   "lv": [
    8,
    8
   ],
   "enemies": [
    "en_bowman"
   ],
   "type": "secret",
   "links": [
    "a1_charcoal_woods"
   ],
   "inst": "hybrid",
   "d": "Tajná oblast: lore scéna + unikátní truhla."
  },
  {
   "id": "a1_kiln",
   "n": "The Great Kiln",
   "lv": [
    9,
    11
   ],
   "enemies": [
    "en_acolyte",
    "en_brute",
    "en_wisp"
   ],
   "type": "dungeon",
   "links": [
    "a1_charcoal_woods",
    "a1_kiln_heart"
   ],
   "inst": "fixed"
  },
  {
   "id": "a1_kiln_heart",
   "n": "Heart of the Kiln",
   "lv": [
    12,
    12
   ],
   "enemies": [],
   "type": "boss",
   "links": [
    "a1_kiln",
    "a2_saltlantern"
   ],
   "inst": "fixed"
  }
 ],
 "quests": [
  {
   "id": "q1_01",
   "n": "Ashes Remember",
   "area": "a1_ashfields",
   "steps": [
    "Probuď se (cinematic)",
    "Zabij 5 Ashen Thrallů (tutoriál útoku)",
    "Pojmi první ozvěnu (tutoriál Echo)",
    "Dojdi k bráně Cinderholdu"
   ]
  },
  {
   "id": "q1_02",
   "n": "Chapel of Embers",
   "area": "a1_chapel_crypt",
   "steps": [
    "Promluv s Teodorem",
    "Projdi Burnt Orchard",
    "Vyčisti kryptu (procedurální, 2 patra)",
    "Získej Archivní deník"
   ]
  },
  {
   "id": "q1_03",
   "n": "The Toll of Iron",
   "area": "a1_tollgate",
   "steps": [
    "Promluv s maršálem Oduinem",
    "VOLBA: zaplať clo 500 zlata / poraž strážného šampiona",
    "Projdi Charcoal Woods"
   ]
  },
  {
   "id": "q1_04",
   "n": "The Kiln Warden",
   "area": "a1_kiln_heart",
   "steps": [
    "Projdi Great Kiln (fixní dungeon, 3 sekce)",
    "Uhas 3 pece (mechanika)",
    "Poraž Kiln Wardena",
    "VOLBA: Kiln Shard"
   ]
  }
 ],
 "bosses": {
  "bo_kiln": {
   "id": "bo_kiln",
   "n": "The Kiln Warden (Brother Aldric)",
   "lv": 12,
   "hpMul": 60,
   "dmgMul": 2.2,
   "armorMul": 1.2,
   "res": {
    "fire": 60,
    "cold": -20,
    "light": 0,
    "nec": 0,
    "rad": 20
   },
   "ttk": 150,
   "arena": "Kruhová kovárna Ø 30 m; 3 pece na obvodu; centrální kovadlina (krytí).",
   "phases": [
    {
     "n": "Fáze 1 — Kovář",
     "hp": [
      100,
      60
     ],
     "d": "Melee kombinace s kladivem, telegraphy 0,8–1,0 s."
    },
    {
     "n": "Fáze 2 — Pec",
     "hp": [
      60,
      25
     ],
     "d": "Rozpálí pece; aréna se zmenšuje doutnající zemí (−2 m/20 s).",
     "trans": "Při 60 %: 3 s nezranitelný, výkřik, pece vzplanou."
    },
    {
     "n": "Fáze 3 — Roztavený",
     "hp": [
      25,
      0
     ],
     "d": "Rychlejší (+25 % speed), přivolává Ember Wispy.",
     "trans": "Při 25 %: zbroj odpadne, −30 % armor, +25 % speed."
    }
   ],
   "abil": [
    {
     "n": "Hammerfall",
     "ph": [
      1,
      2,
      3
     ],
     "cd": 6,
     "tele": 0.9,
     "dmg": 1.4,
     "shape": "kruh 3 m před ním",
     "d": "Úder kladivem do země."
    },
    {
     "n": "Bellows Breath",
     "ph": [
      1,
      2,
      3
     ],
     "cd": 12,
     "tele": 1.2,
     "dmg": 0.5,
     "shape": "kužel 60° × 10 m, 2 s",
     "d": "Fire DoT kužel; uhnout do strany."
    },
    {
     "n": "Anvil Toss",
     "ph": [
      1,
      3
     ],
     "cd": 15,
     "tele": 1.5,
     "dmg": 2.2,
     "shape": "kruh 4 m kdekoli",
     "d": "Hodí kovadlinu na pozici hráče."
    },
    {
     "n": "Stoke the Kilns",
     "ph": [
      2
     ],
     "cd": 20,
     "tele": 2,
     "dmg": 0.8,
     "shape": "3 pece: kužely 90° × 12 m",
     "d": "Pece chrlí oheň; schovat se za kovadlinu."
    },
    {
     "n": "Molten Spawn",
     "ph": [
      3
     ],
     "cd": 18,
     "tele": 1,
     "dmg": 0,
     "shape": "4 Ember Wispy",
     "d": "Přivolání wispů (summon phase)."
    },
    {
     "n": "Quench Slam",
     "ph": [
      3
     ],
     "cd": 24,
     "tele": 1.6,
     "dmg": 3,
     "shape": "celá aréna mimo 3 bezpečné kruhy",
     "d": "Hlavní „naučná“ mechanika: najít bezpečné kruhy (páru)."
    }
   ],
   "mech": [
    "Pece (3): v F2 aktivní, hráč je může 1× uhasit (interakce 1,5 s) → −1 kužel.",
    "Kovadlina: blokuje projektily a kužely.",
    "Doutnající zem zmenšuje arénu v F2 (min Ø 16 m)."
   ],
   "enrage": "Po 240 s: všechny pece permanentně aktivní, +50 % damage.",
   "death": "Padne na kolena, kladivo se roztaví; ozvěna Aldrika promluví (volba q1_04). 4 s slow-mo.",
   "lt": "lt_bo_kiln",
   "uniques": [
    "un_ashfather",
    "un_kilnbrand",
    "un_kindling_belt"
   ],
   "echo": "ec_kiln"
  }
 },
 "bossLoot": {
  "id": "lt_bo_kiln",
  "items": "3 Magic + 2 Rare garantované; unikát 25 % (1. zabití 100 %)"
 },
 "bossQuest": {
  "id": "q1_04",
  "n": "The Kiln Warden",
  "xp": 6500
 },
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
   "xpMul": 0.9,
   "lt": "lt_normal"
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
   "xpMul": 2.4,
   "lt": "lt_normal"
  },
  {
   "id": "en_wisp",
   "n": "Ember Wisp",
   "arche": "Suicide swarm",
   "lv": [
    2,
    12
   ],
   "hpMul": 0.35,
   "dmgMul": 2,
   "aps": 0,
   "ms": 5,
   "armorMul": 0,
   "res": {
    "fire": 75,
    "cold": -30
   },
   "abil": [
    "Exploze 2,5 m (2,0×, telegraph 0,8 s)"
   ],
   "pattern": "Přiletí a vybuchne; lze zabít ranou.",
   "eva": 0,
   "xpMul": 0.5,
   "lt": "lt_normal"
  },
  {
   "id": "en_hound",
   "n": "Cinder Hound",
   "arche": "Fast melee",
   "lv": [
    1,
    12
   ],
   "hpMul": 0.7,
   "dmgMul": 0.9,
   "aps": 1.4,
   "ms": 6,
   "armorMul": 0.4,
   "res": {
    "fire": 40
   },
   "abil": [
    "Kousnutí (0,9×)",
    "Skok 6 m (1,4×, telegraph 0,5 s)"
   ],
   "pattern": "Smečky 3–5, obíhají a skáčou zboku.",
   "eva": 40,
   "xpMul": 1,
   "lt": "lt_normal"
  },
  {
   "id": "en_bowman",
   "n": "Charred Bowman",
   "arche": "Ranged",
   "lv": [
    3,
    12
   ],
   "hpMul": 0.8,
   "dmgMul": 1.1,
   "aps": 0.7,
   "ms": 3,
   "armorMul": 0.5,
   "res": {
    "fire": 20
   },
   "abil": [
    "Šíp (1,1×, 20 m)",
    "Ohnivý šíp (1,6×, cd 6 s)"
   ],
   "pattern": "Udržuje 12–16 m, ustupuje při přiblížení.",
   "eva": 0,
   "xpMul": 1,
   "lt": "lt_normal"
  },
  {
   "id": "en_acolyte",
   "n": "Kiln Acolyte",
   "arche": "Caster",
   "lv": [
    4,
    12
   ],
   "hpMul": 0.9,
   "dmgMul": 1.3,
   "aps": 0.5,
   "ms": 2.8,
   "armorMul": 0.4,
   "res": {
    "fire": 50,
    "cold": -20
   },
   "abil": [
    "Ohnivá koule (1,3×)",
    "Zvednutí Thrallů (2 ks, cd 12 s)",
    "Štít spojenci (cd 10 s)"
   ],
   "pattern": "Zůstává za frontou; priority target.",
   "eva": 0,
   "xpMul": 1.3,
   "lt": "lt_caster"
  },
  {
   "id": "bo_kiln",
   "n": "The Kiln Warden (Brother Aldric)",
   "lv": 12,
   "hpMul": 60,
   "dmgMul": 2.2,
   "armorMul": 1.2,
   "res": {
    "fire": 60,
    "cold": -20,
    "light": 0,
    "nec": 0,
    "rad": 20
   },
   "abil": [
    {
     "n": "Hammerfall",
     "ph": [
      1,
      2,
      3
     ],
     "cd": 6,
     "tele": 0.9,
     "dmg": 1.4,
     "shape": "kruh 3 m před ním",
     "d": "Úder kladivem do země."
    },
    {
     "n": "Bellows Breath",
     "ph": [
      1,
      2,
      3
     ],
     "cd": 12,
     "tele": 1.2,
     "dmg": 0.5,
     "shape": "kužel 60° × 10 m, 2 s",
     "d": "Fire DoT kužel; uhnout do strany."
    },
    {
     "n": "Anvil Toss",
     "ph": [
      1,
      3
     ],
     "cd": 15,
     "tele": 1.5,
     "dmg": 2.2,
     "shape": "kruh 4 m kdekoli",
     "d": "Hodí kovadlinu na pozici hráče."
    },
    {
     "n": "Stoke the Kilns",
     "ph": [
      2
     ],
     "cd": 20,
     "tele": 2,
     "dmg": 0.8,
     "shape": "3 pece: kužely 90° × 12 m",
     "d": "Pece chrlí oheň; schovat se za kovadlinu."
    },
    {
     "n": "Molten Spawn",
     "ph": [
      3
     ],
     "cd": 18,
     "tele": 1,
     "dmg": 0,
     "shape": "4 Ember Wispy",
     "d": "Přivolání wispů (summon phase)."
    },
    {
     "n": "Quench Slam",
     "ph": [
      3
     ],
     "cd": 24,
     "tele": 1.6,
     "dmg": 3,
     "shape": "celá aréna mimo 3 bezpečné kruhy",
     "d": "Hlavní „naučná“ mechanika: najít bezpečné kruhy (páru)."
    }
   ],
   "eva": 0,
   "lt": "lt_bo_kiln"
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
  ],
  "en_wisp": [
   {
    "n": "Exploze",
    "mul": 2,
    "tele": 0.8,
    "range": 2.5,
    "shape": "circle",
    "cd": 99,
    "suicide": true
   }
  ],
  "en_hound": [
   {
    "n": "Kousnutí",
    "mul": 0.9,
    "tele": 0.4,
    "range": 1.4,
    "shape": "cone",
    "w": 80,
    "cd": 1.1
   },
   {
    "n": "Skok",
    "mul": 1.4,
    "tele": 0.5,
    "range": 6,
    "shape": "leap",
    "w": 1.2,
    "cd": 5,
    "min": 2.5
   }
  ],
  "en_bowman": [
   {
    "n": "Šíp",
    "mul": 1.1,
    "tele": 0.6,
    "range": 20,
    "shape": "arrow",
    "speed": 18,
    "cd": 1.6
   },
   {
    "n": "Ohnivý šíp",
    "mul": 1.6,
    "tele": 0.9,
    "range": 20,
    "shape": "arrow",
    "speed": 15,
    "cd": 6,
    "fire": true
   }
  ],
  "en_acolyte": [
   {
    "n": "Ohnivá koule",
    "mul": 1.3,
    "tele": 0.8,
    "range": 18,
    "shape": "arrow",
    "speed": 10,
    "cd": 2.4,
    "fire": true,
    "orb": true
   },
   {
    "n": "Zvednutí Thrallů",
    "mul": 0,
    "tele": 1.2,
    "range": 16,
    "shape": "summon",
    "cd": 12,
    "count": 2,
    "spawn": "en_thrall",
    "max": 4
   },
   {
    "n": "Štít spojenci",
    "mul": 0,
    "tele": 0.7,
    "range": 10,
    "shape": "ward",
    "cd": 10,
    "amt": 0.3,
    "dur": 6
   }
  ],
  "bo_kiln": []
 },
 "loot": {
  "slots": [
   {
    "id": "main",
    "n": "Main Hand",
    "d": "Zbraň (1H nebo 2H). 2H blokuje Off Hand."
   },
   {
    "id": "off",
    "n": "Off Hand",
    "d": "Štít, grimoár, toulec nebo druhá 1H zbraň (dual wield jen Nightstalker, D17)."
   },
   {
    "id": "helm",
    "n": "Helmet",
    "d": "Obrana + 1 affix navíc pro resistance."
   },
   {
    "id": "chest",
    "n": "Chest",
    "d": "Největší obrana; 2 sockety max."
   },
   {
    "id": "gloves",
    "n": "Gloves",
    "d": "Útočné affixy (attack/cast speed)."
   },
   {
    "id": "boots",
    "n": "Boots",
    "d": "Movement speed implicit."
   },
   {
    "id": "belt",
    "n": "Belt",
    "d": "Lektvary a HP."
   },
   {
    "id": "amulet",
    "n": "Amulet",
    "d": "Univerzální affixy, +skill level."
   },
   {
    "id": "ring",
    "n": "Ring ×2",
    "d": "Dva sloty, resistance a damage."
   },
   {
    "id": "relic",
    "n": "Relic",
    "d": "Vlastní slot Echo Bearerů: modifikuje skilly a Echo sloty. Žádná obrana."
   }
  ],
  "rarities": [
   {
    "id": "common",
    "n": "Common",
    "aff": "0",
    "d": "Jen base staty a implicit. Suroviny (salvage → Ember Shards)."
   },
   {
    "id": "magic",
    "n": "Magic",
    "aff": "1–2 (max 1 prefix + 1 suffix)",
    "d": "Jednoduché rozhodnutí; v kampani časté upgrady."
   },
   {
    "id": "rare",
    "n": "Rare",
    "aff": "3–6 (max 3+3)",
    "d": "Hlavní zdroj síly; crafting cíl."
   },
   {
    "id": "unique",
    "n": "Unique",
    "aff": "pevné linie s rozsahy",
    "d": "Ručně navržené; mění build. Každý má zdroj a roli."
   },
   {
    "id": "sun",
    "n": "Sunforged",
    "aff": "Rare + 1 Sun affix",
    "d": "Endgame crafting (Sunmote). Ne drop – vždy výsledek rozhodnutí."
   }
  ],
  "bases": [
   {
    "id": "wb_sword",
    "n": "Arming Sword",
    "slot": "main",
    "hand": "1h",
    "cat": "Sword",
    "dmg": [
     5,
     10
    ],
    "aps": 1.35,
    "imp": {
     "accInc": 0.05
    },
    "impT": "+5 % accuracy",
    "req": {
     "str": 12,
     "dex": 12
    },
    "cls": [
     "ak",
     "ns"
    ],
    "size": [
     1,
     3
    ],
    "look": "Rovná čepel, kožená rukojeť s mosazí"
   },
   {
    "id": "wb_axe",
    "n": "Bearded Axe",
    "slot": "main",
    "hand": "1h",
    "cat": "Axe",
    "dmg": [
     6,
     12
    ],
    "aps": 1.25,
    "imp": {
     "bleedInc": 0.08
    },
    "impT": "+8 % bleed damage",
    "req": {
     "str": 16
    },
    "cls": [
     "ak"
    ],
    "size": [
     2,
     3
    ],
    "look": "Vousatá sekera, zubaté ostří"
   },
   {
    "id": "wb_mace",
    "n": "Flanged Mace",
    "slot": "main",
    "hand": "1h",
    "cat": "Mace",
    "dmg": [
     7,
     11
    ],
    "aps": 1.2,
    "imp": {
     "physInc": 0.05
    },
    "impT": "+5 % physical damage, +10 % stun",
    "req": {
     "str": 18
    },
    "cls": [
     "ak",
     "gc"
    ],
    "size": [
     2,
     3
    ],
    "look": "Žebrovaný palcát z černé oceli"
   },
   {
    "id": "wb_dagger",
    "n": "Rondel Dagger",
    "slot": "main",
    "hand": "1h",
    "cat": "Dagger",
    "dmg": [
     4,
     9
    ],
    "aps": 1.5,
    "imp": {
     "critFlat": 3
    },
    "impT": "+3 % base crit",
    "req": {
     "dex": 16
    },
    "cls": [
     "ns",
     "rb",
     "gc"
    ],
    "size": [
     1,
     2
    ],
    "look": "Kruhová záštita, úzký hrot"
   },
   {
    "id": "wb_wand",
    "n": "Ash Wand",
    "slot": "main",
    "hand": "1h",
    "cat": "Wand",
    "dmg": [
     3,
     7
    ],
    "aps": 1.4,
    "imp": {
     "spellInc": 0.1
    },
    "impT": "+10 % spell damage",
    "req": {
     "int": 16
    },
    "cls": [
     "rb",
     "gc"
    ],
    "size": [
     1,
     2
    ],
    "look": "Ohořelá hůlka s uhlíkem"
   },
   {
    "id": "wb_scepter",
    "n": "Lantern Scepter",
    "slot": "main",
    "hand": "1h",
    "cat": "Scepter",
    "dmg": [
     5,
     9
    ],
    "aps": 1.25,
    "imp": {
     "eleInc": 0.08
    },
    "impT": "+8 % elemental damage",
    "req": {
     "str": 10,
     "int": 12
    },
    "cls": [
     "ak",
     "rb"
    ],
    "size": [
     1,
     3
    ],
    "look": "Žezlo s miniaturní lucernou"
   },
   {
    "id": "wb_greatsword",
    "n": "Zweihänder",
    "slot": "main",
    "hand": "2h",
    "cat": "Greatsword",
    "dmg": [
     9,
     16
    ],
    "aps": 1.15,
    "imp": {
     "accInc": 0.1
    },
    "impT": "+10 % accuracy",
    "req": {
     "str": 22,
     "dex": 12
    },
    "cls": [
     "ak"
    ],
    "size": [
     2,
     4
    ],
    "look": "Plamenná čepel, parírovací háky"
   },
   {
    "id": "wb_greataxe",
    "n": "Executioner Axe",
    "slot": "main",
    "hand": "2h",
    "cat": "Greataxe",
    "dmg": [
     10,
     19
    ],
    "aps": 1.05,
    "imp": {
     "bleedInc": 0.15
    },
    "impT": "+15 % bleed damage",
    "req": {
     "str": 26
    },
    "cls": [
     "ak"
    ],
    "size": [
     2,
     4
    ],
    "look": "Široké půlměsíčné ostří"
   },
   {
    "id": "wb_maul",
    "n": "Pyre Maul",
    "slot": "main",
    "hand": "2h",
    "cat": "Maul",
    "dmg": [
     11,
     21
    ],
    "aps": 0.95,
    "imp": {
     "physInc": 0.1
    },
    "impT": "+10 % physical, +15 % stun",
    "req": {
     "str": 30
    },
    "cls": [
     "ak"
    ],
    "size": [
     2,
     4
    ],
    "look": "Kovadlina na tyči"
   },
   {
    "id": "wb_staff",
    "n": "Runic Staff",
    "slot": "main",
    "hand": "2h",
    "cat": "Staff",
    "dmg": [
     9,
     15
    ],
    "aps": 1.15,
    "imp": {
     "spellInc": 0.18
    },
    "impT": "+18 % spell damage",
    "req": {
     "int": 24
    },
    "cls": [
     "rb",
     "gc"
    ],
    "size": [
     1,
     4
    ],
    "look": "Hůl s plovoucími runami"
   },
   {
    "id": "wb_bow",
    "n": "Yew Longbow",
    "slot": "main",
    "hand": "2h",
    "cat": "Bow",
    "dmg": [
     7,
     16
    ],
    "aps": 1.2,
    "imp": {
     "projInc": 0.1
    },
    "impT": "+10 % projectile damage",
    "req": {
     "dex": 24
    },
    "cls": [
     "ns"
    ],
    "size": [
     2,
     4
    ],
    "look": "Tisový luk, tětiva ze šlach"
   },
   {
    "id": "wb_scythe",
    "n": "Grave Scythe",
    "slot": "main",
    "hand": "2h",
    "cat": "Scythe",
    "dmg": [
     11,
     20
    ],
    "aps": 1.1,
    "imp": {
     "minionInc": 0.15
    },
    "impT": "+15 % minion damage",
    "req": {
     "str": 10,
     "wil": 20
    },
    "cls": [
     "gc"
    ],
    "size": [
     2,
     4
    ],
    "look": "Kosa s kostěnou násadou"
   },
   {
    "id": "wb_buckler",
    "n": "Iron Buckler",
    "slot": "off",
    "cat": "Shield",
    "imp": {},
    "impT": "Block 18 %",
    "armor": 15,
    "eva": 15,
    "block": 18,
    "req": {
     "dex": 12
    },
    "cls": [
     "ak",
     "ns"
    ],
    "size": [
     2,
     2
    ],
    "look": "Malý kulatý štít"
   },
   {
    "id": "wb_kite",
    "n": "Kite Shield",
    "slot": "off",
    "cat": "Shield",
    "imp": {},
    "impT": "Block 24 %",
    "armor": 30,
    "eva": 0,
    "block": 24,
    "req": {
     "str": 18
    },
    "cls": [
     "ak",
     "gc"
    ],
    "size": [
     2,
     3
    ],
    "look": "Erb lucerny na štítu"
   },
   {
    "id": "wb_tower",
    "n": "Tower Shield",
    "slot": "off",
    "cat": "Shield",
    "imp": {
     "ms": -0.05
    },
    "impT": "Block 30 %, −5 % movement",
    "armor": 45,
    "eva": 0,
    "block": 30,
    "req": {
     "str": 28
    },
    "cls": [
     "ak"
    ],
    "size": [
     2,
     4
    ],
    "look": "Pavéza s průzorem"
   },
   {
    "id": "wb_grimoire",
    "n": "Ashen Grimoire",
    "slot": "off",
    "cat": "Focus",
    "imp": {
     "resFlat": 15,
     "cs": 0.05
    },
    "impT": "+15 resource, +5 % cast speed",
    "armor": 0,
    "eva": 0,
    "req": {
     "int": 18
    },
    "cls": [
     "rb",
     "gc"
    ],
    "size": [
     2,
     2
    ],
    "look": "Kniha se spálenými okraji"
   },
   {
    "id": "wb_quiver",
    "n": "Barbed Quiver",
    "slot": "off",
    "cat": "Quiver",
    "imp": {
     "projInc": 0.06
    },
    "impT": "+6 % projectile damage",
    "armor": 0,
    "eva": 0,
    "req": {
     "dex": 14
    },
    "cls": [
     "ns"
    ],
    "size": [
     2,
     3
    ],
    "look": "Toulec s ostnatými šípy"
   },
   {
    "id": "wb_helm_str",
    "n": "Great Helm",
    "slot": "helm",
    "cat": "Helmet (STR)",
    "imp": {},
    "impT": "—",
    "armor": 22,
    "eva": 0,
    "req": {
     "str": 14
    },
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     2
    ],
    "look": "Uzavřená přilba s průzorem"
   },
   {
    "id": "wb_helm_dex",
    "n": "Leather Hood",
    "slot": "helm",
    "cat": "Helmet (DEX)",
    "imp": {},
    "impT": "—",
    "armor": 0,
    "eva": 22,
    "req": {
     "dex": 14
    },
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     2
    ],
    "look": "Kápě s maskou"
   },
   {
    "id": "wb_helm_int",
    "n": "Votive Circlet",
    "slot": "helm",
    "cat": "Helmet (INT)",
    "imp": {
     "resAll": 0.04,
     "hpInc": 0.06
    },
    "impT": "+4 % všech res, +6 % Max HP (D14)",
    "armor": 8,
    "eva": 0,
    "req": {
     "int": 14
    },
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     2
    ],
    "look": "Tenký kroužek se svíčkou"
   },
   {
    "id": "wb_chest_str",
    "n": "Plate Hauberk",
    "slot": "chest",
    "cat": "Chest (STR)",
    "imp": {},
    "impT": "—",
    "armor": 60,
    "eva": 0,
    "req": {
     "str": 24
    },
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     3
    ],
    "look": "Plát přes kroužkovou košili"
   },
   {
    "id": "wb_chest_dex",
    "n": "Brigandine Jerkin",
    "slot": "chest",
    "cat": "Chest (DEX)",
    "imp": {},
    "impT": "—",
    "armor": 0,
    "eva": 60,
    "req": {
     "dex": 24
    },
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     3
    ],
    "look": "Nýtovaná kazajka"
   },
   {
    "id": "wb_chest_int",
    "n": "Votive Robes",
    "slot": "chest",
    "cat": "Chest (INT)",
    "imp": {
     "resAll": 0.06,
     "hpInc": 0.1
    },
    "impT": "+6 % všech res, +10 % Max HP (D14)",
    "armor": 20,
    "eva": 0,
    "req": {
     "int": 24
    },
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     3
    ],
    "look": "Roucho s modlitebními pásky"
   },
   {
    "id": "wb_gloves_str",
    "n": "Gauntlets",
    "slot": "gloves",
    "cat": "Gloves (STR)",
    "imp": {},
    "impT": "—",
    "armor": 14,
    "eva": 0,
    "req": {
     "str": 12
    },
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     2
    ],
    "look": "Plátové rukavice"
   },
   {
    "id": "wb_gloves_dex",
    "n": "Bracers",
    "slot": "gloves",
    "cat": "Gloves (DEX)",
    "imp": {},
    "impT": "—",
    "armor": 0,
    "eva": 14,
    "req": {
     "dex": 12
    },
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     2
    ],
    "look": "Kožené chrániče"
   },
   {
    "id": "wb_gloves_int",
    "n": "Silk Wraps",
    "slot": "gloves",
    "cat": "Gloves (INT)",
    "imp": {
     "cs": 0.04
    },
    "impT": "+4 % cast speed",
    "armor": 5,
    "eva": 0,
    "req": {
     "int": 12
    },
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     2
    ],
    "look": "Hedvábné obvazy s inkoustem"
   },
   {
    "id": "wb_boots_str",
    "n": "Sabatons",
    "slot": "boots",
    "cat": "Boots (STR)",
    "imp": {
     "ms": 0.1
    },
    "impT": "+10 % movement",
    "armor": 16,
    "eva": 0,
    "req": {
     "str": 12
    },
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     2
    ],
    "look": "Plátové boty"
   },
   {
    "id": "wb_boots_dex",
    "n": "Treads",
    "slot": "boots",
    "cat": "Boots (DEX)",
    "imp": {
     "ms": 0.12
    },
    "impT": "+12 % movement",
    "armor": 0,
    "eva": 16,
    "req": {
     "dex": 12
    },
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     2
    ],
    "look": "Měkké boty"
   },
   {
    "id": "wb_boots_int",
    "n": "Pilgrim's Sandals",
    "slot": "boots",
    "cat": "Boots (INT)",
    "imp": {
     "ms": 0.1,
     "resFlat": 5
    },
    "impT": "+10 % movement, +5 resource",
    "armor": 6,
    "eva": 0,
    "req": {
     "int": 12
    },
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     2
    ],
    "look": "Sandály s popelem"
   },
   {
    "id": "wb_belt_heavy",
    "n": "Heavy Belt",
    "slot": "belt",
    "cat": "Belt",
    "imp": {
     "hpFlat": 20
    },
    "impT": "+20 HP",
    "armor": 0,
    "eva": 0,
    "req": {
     "str": 10
    },
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     1
    ],
    "look": "Široký pás s přezkou"
   },
   {
    "id": "wb_belt_sash",
    "n": "Ritual Sash",
    "slot": "belt",
    "cat": "Belt",
    "imp": {
     "regenInc": 0.06
    },
    "impT": "+6 % resource regen",
    "armor": 0,
    "eva": 0,
    "req": {},
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     2,
     1
    ],
    "look": "Šerpa s amulety"
   },
   {
    "id": "wb_amulet",
    "n": "Sun Pendant",
    "slot": "amulet",
    "cat": "Amulet",
    "imp": {
     "allAttr": 4
    },
    "impT": "+4 ke všem atributům",
    "armor": 0,
    "eva": 0,
    "req": {},
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     1,
     1
    ],
    "look": "Přívěsek s uhasínajícím sluncem"
   },
   {
    "id": "wb_ring",
    "n": "Iron Band",
    "slot": "ring",
    "cat": "Ring",
    "imp": {
     "resFlat": 8
    },
    "impT": "+8 max resource",
    "armor": 0,
    "eva": 0,
    "req": {},
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     1,
     1
    ],
    "look": "Prostý železný kroužek"
   },
   {
    "id": "wb_relic_sun",
    "n": "Sunshard Relic",
    "slot": "relic",
    "cat": "Relic",
    "imp": {
     "radInc": 0.08
    },
    "impT": "+8 % radiant damage",
    "armor": 0,
    "eva": 0,
    "req": {},
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     1,
     2
    ],
    "look": "Střep v mosazné kleci"
   },
   {
    "id": "wb_relic_bone",
    "n": "Bone Reliquary",
    "slot": "relic",
    "cat": "Relic",
    "imp": {
     "minionHp": 0.08
    },
    "impT": "+8 % minion HP",
    "armor": 0,
    "eva": 0,
    "req": {},
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     1,
     2
    ],
    "look": "Kostěná schránka"
   },
   {
    "id": "wb_relic_moth",
    "n": "Moth-Glass Relic",
    "slot": "relic",
    "cat": "Relic",
    "imp": {
     "critInc": 0.08
    },
    "impT": "+8 % crit chance",
    "armor": 0,
    "eva": 0,
    "req": {},
    "cls": [
     "ak",
     "rb",
     "gc",
     "ns"
    ],
    "size": [
     1,
     2
    ],
    "look": "Sklo s uvězněnou můrou"
   }
  ],
  "affixes": [
   {
    "id": "af_life",
    "kind": "prefix",
    "n": "Hale",
    "stat": "hpFlat",
    "txt": "+{v} Maximum Health",
    "tiers": [
     [
      60,
      90,
      110
     ],
     [
      44,
      65,
      89
     ],
     [
      30,
      45,
      64
     ],
     [
      16,
      28,
      44
     ],
     [
      1,
      12,
      27
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "gloves",
     "boots",
     "off",
     "belt",
     "amulet",
     "ring"
    ],
    "group": "life",
    "w": 1000,
    "pct": false
   },
   {
    "id": "af_armor_inc",
    "kind": "prefix",
    "n": "Fortified",
    "stat": "armorInc",
    "txt": "+{v} % increased Armor",
    "tiers": [
     [
      60,
      40,
      55
     ],
     [
      44,
      30,
      39
     ],
     [
      30,
      22,
      29
     ],
     [
      16,
      14,
      21
     ],
     [
      1,
      8,
      13
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "gloves",
     "boots",
     "off"
    ],
    "group": "def",
    "w": 800,
    "pct": true
   },
   {
    "id": "af_eva_inc",
    "kind": "prefix",
    "n": "Shadowed",
    "stat": "evaInc",
    "txt": "+{v} % increased Evasion",
    "tiers": [
     [
      60,
      40,
      55
     ],
     [
      44,
      30,
      39
     ],
     [
      30,
      22,
      29
     ],
     [
      16,
      14,
      21
     ],
     [
      1,
      8,
      13
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "gloves",
     "boots",
     "off"
    ],
    "group": "def",
    "w": 800,
    "pct": true
   },
   {
    "id": "af_phys_inc",
    "kind": "prefix",
    "n": "Cruel",
    "stat": "wPhysInc",
    "txt": "+{v} % increased Physical Damage (lokální)",
    "tiers": [
     [
      60,
      90,
      119
     ],
     [
      44,
      65,
      89
     ],
     [
      30,
      45,
      64
     ],
     [
      16,
      28,
      44
     ],
     [
      1,
      15,
      27
     ]
    ],
    "slots": [
     "main"
    ],
    "group": "wphys",
    "w": 600,
    "pct": true
   },
   {
    "id": "af_phys_flat",
    "kind": "prefix",
    "n": "Jagged",
    "stat": "wFlat",
    "txt": "Přidá průměrně {v} Physical Damage (lokální)",
    "tiers": [
     [
      60,
      30,
      38
     ],
     [
      44,
      20,
      29
     ],
     [
      30,
      13,
      19
     ],
     [
      16,
      7,
      12
     ],
     [
      1,
      3,
      6
     ]
    ],
    "slots": [
     "main"
    ],
    "group": "wflat",
    "w": 800,
    "pct": false
   },
   {
    "id": "af_added_phys",
    "kind": "prefix",
    "n": "Barbed",
    "stat": "addPhys",
    "txt": "Přidá průměrně {v} Physical Damage k útokům",
    "tiers": [
     [
      60,
      10,
      14
     ],
     [
      44,
      7,
      9
     ],
     [
      30,
      5,
      6
     ],
     [
      16,
      3,
      4
     ],
     [
      1,
      1,
      2
     ]
    ],
    "slots": [
     "gloves",
     "ring"
    ],
    "group": "addphys",
    "w": 500,
    "pct": false
   },
   {
    "id": "af_spell_flat",
    "kind": "prefix",
    "n": "Inscribed",
    "stat": "addSpell",
    "txt": "Přidá průměrně {v} poškození ke kouzlům (× efektivita kouzla, D28)",
    "tiers": [
     [
      60,
      24,
      32
     ],
     [
      44,
      14,
      20
     ],
     [
      30,
      7,
      10
     ],
     [
      16,
      4,
      6
     ],
     [
      1,
      1,
      3
     ]
    ],
    "slots": [
     "main",
     "off",
     "amulet"
    ],
    "group": "addspell",
    "w": 600,
    "pct": false
   },
   {
    "id": "af_fire_inc",
    "kind": "prefix",
    "n": "Smoldering",
    "stat": "fireInc",
    "txt": "+{v} % increased Fire Damage",
    "tiers": [
     [
      60,
      30,
      40
     ],
     [
      44,
      22,
      29
     ],
     [
      30,
      16,
      21
     ],
     [
      16,
      10,
      15
     ],
     [
      1,
      5,
      9
     ]
    ],
    "slots": [
     "main",
     "amulet",
     "ring"
    ],
    "group": "ele",
    "w": 600,
    "pct": true
   },
   {
    "id": "af_cold_inc",
    "kind": "prefix",
    "n": "Rimed",
    "stat": "coldInc",
    "txt": "+{v} % increased Cold Damage",
    "tiers": [
     [
      60,
      30,
      40
     ],
     [
      44,
      22,
      29
     ],
     [
      30,
      16,
      21
     ],
     [
      16,
      10,
      15
     ],
     [
      1,
      5,
      9
     ]
    ],
    "slots": [
     "main",
     "amulet",
     "ring"
    ],
    "group": "ele",
    "w": 600,
    "pct": true
   },
   {
    "id": "af_light_inc",
    "kind": "prefix",
    "n": "Charged",
    "stat": "lightInc",
    "txt": "+{v} % increased Lightning Damage",
    "tiers": [
     [
      60,
      30,
      40
     ],
     [
      44,
      22,
      29
     ],
     [
      30,
      16,
      21
     ],
     [
      16,
      10,
      15
     ],
     [
      1,
      5,
      9
     ]
    ],
    "slots": [
     "main",
     "amulet",
     "ring"
    ],
    "group": "ele",
    "w": 600,
    "pct": true
   },
   {
    "id": "af_nec_inc",
    "kind": "prefix",
    "n": "Rotting",
    "stat": "necInc",
    "txt": "+{v} % increased Necrotic Damage",
    "tiers": [
     [
      60,
      30,
      40
     ],
     [
      44,
      22,
      29
     ],
     [
      30,
      16,
      21
     ],
     [
      16,
      10,
      15
     ],
     [
      1,
      5,
      9
     ]
    ],
    "slots": [
     "main",
     "amulet",
     "ring"
    ],
    "group": "ele",
    "w": 500,
    "pct": true
   },
   {
    "id": "af_rad_inc",
    "kind": "prefix",
    "n": "Dawnlit",
    "stat": "radInc",
    "txt": "+{v} % increased Radiant Damage",
    "tiers": [
     [
      60,
      30,
      40
     ],
     [
      44,
      22,
      29
     ],
     [
      30,
      16,
      21
     ],
     [
      16,
      10,
      15
     ],
     [
      1,
      5,
      9
     ]
    ],
    "slots": [
     "main",
     "amulet",
     "relic"
    ],
    "group": "ele",
    "w": 200,
    "pct": true
   },
   {
    "id": "af_spell_inc",
    "kind": "prefix",
    "n": "Runic",
    "stat": "spellInc",
    "txt": "+{v} % increased Spell Damage",
    "tiers": [
     [
      60,
      45,
      60
     ],
     [
      44,
      33,
      44
     ],
     [
      30,
      24,
      32
     ],
     [
      16,
      15,
      23
     ],
     [
      1,
      8,
      14
     ]
    ],
    "slots": [
     "main",
     "amulet",
     "off"
    ],
    "group": "spell",
    "w": 600,
    "pct": true
   },
   {
    "id": "af_minion",
    "kind": "prefix",
    "n": "Commanding",
    "stat": "minionInc",
    "txt": "+{v} % increased Minion Damage",
    "tiers": [
     [
      60,
      45,
      60
     ],
     [
      44,
      33,
      44
     ],
     [
      30,
      24,
      32
     ],
     [
      16,
      15,
      23
     ],
     [
      1,
      8,
      14
     ]
    ],
    "slots": [
     "main",
     "amulet",
     "relic",
     "helm"
    ],
    "group": "minion",
    "w": 500,
    "pct": true
   },
   {
    "id": "af_dot",
    "kind": "prefix",
    "n": "Festering",
    "stat": "dotInc",
    "txt": "+{v} % increased Damage over Time",
    "tiers": [
     [
      60,
      30,
      40
     ],
     [
      44,
      22,
      29
     ],
     [
      30,
      16,
      21
     ],
     [
      16,
      10,
      15
     ],
     [
      1,
      5,
      9
     ]
    ],
    "slots": [
     "main",
     "amulet",
     "ring"
    ],
    "group": "dot",
    "w": 500,
    "pct": true
   },
   {
    "id": "af_proj",
    "kind": "prefix",
    "n": "Fletched",
    "stat": "projInc",
    "txt": "+{v} % increased Projectile Damage",
    "tiers": [
     [
      60,
      30,
      40
     ],
     [
      44,
      22,
      29
     ],
     [
      30,
      16,
      21
     ],
     [
      16,
      10,
      15
     ],
     [
      1,
      5,
      9
     ]
    ],
    "slots": [
     "main",
     "off",
     "gloves"
    ],
    "group": "proj",
    "w": 500,
    "pct": true
   },
   {
    "id": "af_res_mana",
    "kind": "prefix",
    "n": "Deep",
    "stat": "resFlat",
    "txt": "+{v} Maximum Resource",
    "tiers": [
     [
      60,
      50,
      65
     ],
     [
      44,
      38,
      49
     ],
     [
      30,
      28,
      37
     ],
     [
      16,
      18,
      27
     ],
     [
      1,
      8,
      17
     ]
    ],
    "slots": [
     "helm",
     "amulet",
     "ring",
     "off"
    ],
    "group": "res",
    "w": 700,
    "pct": false
   },
   {
    "id": "af_ms",
    "kind": "prefix",
    "n": "Swift",
    "stat": "ms",
    "txt": "+{v} % Movement Speed",
    "tiers": [
     [
      44,
      25,
      30
     ],
     [
      30,
      20,
      24
     ],
     [
      16,
      15,
      19
     ],
     [
      1,
      10,
      14
     ]
    ],
    "slots": [
     "boots"
    ],
    "group": "ms",
    "w": 600,
    "pct": true
   },
   {
    "id": "af_block",
    "kind": "prefix",
    "n": "Bulwark",
    "stat": "block",
    "txt": "+{v} % Block Chance",
    "tiers": [
     [
      44,
      5,
      6
     ],
     [
      16,
      3,
      4
     ],
     [
      1,
      1,
      2
     ]
    ],
    "slots": [
     "off"
    ],
    "group": "block",
    "w": 400,
    "pct": true
   },
   {
    "id": "af_res_fire",
    "kind": "suffix",
    "n": "of Embers",
    "stat": "res_fire",
    "txt": "+{v} % Fire Resistance",
    "tiers": [
     [
      60,
      40,
      46
     ],
     [
      44,
      34,
      39
     ],
     [
      30,
      27,
      33
     ],
     [
      16,
      18,
      26
     ],
     [
      1,
      8,
      17
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "gloves",
     "boots",
     "off",
     "belt",
     "amulet",
     "ring"
    ],
    "group": "r_fire",
    "w": 900,
    "pct": true
   },
   {
    "id": "af_res_cold",
    "kind": "suffix",
    "n": "of the Hearth",
    "stat": "res_cold",
    "txt": "+{v} % Cold Resistance",
    "tiers": [
     [
      60,
      40,
      46
     ],
     [
      44,
      34,
      39
     ],
     [
      30,
      27,
      33
     ],
     [
      16,
      18,
      26
     ],
     [
      1,
      8,
      17
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "gloves",
     "boots",
     "off",
     "belt",
     "amulet",
     "ring"
    ],
    "group": "r_cold",
    "w": 900,
    "pct": true
   },
   {
    "id": "af_res_light",
    "kind": "suffix",
    "n": "of Grounding",
    "stat": "res_light",
    "txt": "+{v} % Lightning Resistance",
    "tiers": [
     [
      60,
      40,
      46
     ],
     [
      44,
      34,
      39
     ],
     [
      30,
      27,
      33
     ],
     [
      16,
      18,
      26
     ],
     [
      1,
      8,
      17
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "gloves",
     "boots",
     "off",
     "belt",
     "amulet",
     "ring"
    ],
    "group": "r_light",
    "w": 900,
    "pct": true
   },
   {
    "id": "af_res_nec",
    "kind": "suffix",
    "n": "of the Living",
    "stat": "res_nec",
    "txt": "+{v} % Necrotic Resistance",
    "tiers": [
     [
      60,
      40,
      46
     ],
     [
      44,
      34,
      39
     ],
     [
      30,
      27,
      33
     ],
     [
      16,
      18,
      26
     ],
     [
      1,
      8,
      17
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "gloves",
     "boots",
     "off",
     "belt",
     "amulet",
     "ring"
    ],
    "group": "r_nec",
    "w": 700,
    "pct": true
   },
   {
    "id": "af_res_rad",
    "kind": "suffix",
    "n": "of Shade",
    "stat": "res_rad",
    "txt": "+{v} % Radiant Resistance",
    "tiers": [
     [
      60,
      40,
      46
     ],
     [
      44,
      34,
      39
     ],
     [
      30,
      27,
      33
     ],
     [
      16,
      18,
      26
     ],
     [
      1,
      8,
      17
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "gloves",
     "boots",
     "off",
     "belt",
     "amulet",
     "ring"
    ],
    "group": "r_rad",
    "w": 400,
    "pct": true
   },
   {
    "id": "af_res_all",
    "kind": "suffix",
    "n": "of the Lantern",
    "stat": "resAll",
    "txt": "+{v} % ke všem elementálním rezistencím",
    "tiers": [
     [
      60,
      15,
      18
     ],
     [
      44,
      12,
      14
     ],
     [
      30,
      9,
      11
     ],
     [
      16,
      6,
      8
     ],
     [
      1,
      3,
      5
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "amulet",
     "ring",
     "off"
    ],
    "group": "r_all",
    "w": 300,
    "pct": true
   },
   {
    "id": "af_atkspd",
    "kind": "suffix",
    "n": "of Haste",
    "stat": "as",
    "txt": "+{v} % increased Attack Speed",
    "tiers": [
     [
      60,
      14,
      16
     ],
     [
      44,
      11,
      13
     ],
     [
      30,
      8,
      10
     ],
     [
      16,
      5,
      7
     ],
     [
      1,
      3,
      4
     ]
    ],
    "slots": [
     "main",
     "gloves",
     "off",
     "ring"
    ],
    "group": "speed",
    "w": 600,
    "pct": true
   },
   {
    "id": "af_cast",
    "kind": "suffix",
    "n": "of Fluency",
    "stat": "cs",
    "txt": "+{v} % increased Cast Speed",
    "tiers": [
     [
      60,
      14,
      16
     ],
     [
      44,
      11,
      13
     ],
     [
      30,
      8,
      10
     ],
     [
      16,
      5,
      7
     ],
     [
      1,
      3,
      4
     ]
    ],
    "slots": [
     "main",
     "gloves",
     "amulet",
     "off"
    ],
    "group": "speed",
    "w": 600,
    "pct": true
   },
   {
    "id": "af_crit",
    "kind": "suffix",
    "n": "of Precision",
    "stat": "critInc",
    "txt": "+{v} % increased Critical Chance",
    "tiers": [
     [
      60,
      30,
      38
     ],
     [
      44,
      23,
      29
     ],
     [
      30,
      17,
      22
     ],
     [
      16,
      11,
      16
     ],
     [
      1,
      6,
      10
     ]
    ],
    "slots": [
     "main",
     "amulet",
     "ring",
     "off",
     "helm"
    ],
    "group": "crit",
    "w": 600,
    "pct": true
   },
   {
    "id": "af_crit_mult",
    "kind": "suffix",
    "n": "of Ruin",
    "stat": "critMult",
    "txt": "+{v} % Critical Multiplier",
    "tiers": [
     [
      60,
      25,
      30
     ],
     [
      44,
      19,
      24
     ],
     [
      30,
      14,
      18
     ],
     [
      16,
      9,
      13
     ],
     [
      1,
      5,
      8
     ]
    ],
    "slots": [
     "main",
     "amulet",
     "off",
     "gloves"
    ],
    "group": "critm",
    "w": 500,
    "pct": true
   },
   {
    "id": "af_str",
    "kind": "suffix",
    "n": "of the Ox",
    "stat": "str",
    "txt": "+{v} Strength",
    "tiers": [
     [
      60,
      28,
      33
     ],
     [
      44,
      21,
      27
     ],
     [
      30,
      15,
      20
     ],
     [
      16,
      9,
      14
     ],
     [
      1,
      4,
      8
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "gloves",
     "boots",
     "off",
     "belt",
     "amulet",
     "ring"
    ],
    "group": "a_str",
    "w": 700,
    "pct": false
   },
   {
    "id": "af_dex",
    "kind": "suffix",
    "n": "of the Fox",
    "stat": "dex",
    "txt": "+{v} Dexterity",
    "tiers": [
     [
      60,
      28,
      33
     ],
     [
      44,
      21,
      27
     ],
     [
      30,
      15,
      20
     ],
     [
      16,
      9,
      14
     ],
     [
      1,
      4,
      8
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "gloves",
     "boots",
     "off",
     "belt",
     "amulet",
     "ring"
    ],
    "group": "a_dex",
    "w": 700,
    "pct": false
   },
   {
    "id": "af_int",
    "kind": "suffix",
    "n": "of the Owl",
    "stat": "int",
    "txt": "+{v} Intelligence",
    "tiers": [
     [
      60,
      28,
      33
     ],
     [
      44,
      21,
      27
     ],
     [
      30,
      15,
      20
     ],
     [
      16,
      9,
      14
     ],
     [
      1,
      4,
      8
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "gloves",
     "boots",
     "off",
     "belt",
     "amulet",
     "ring"
    ],
    "group": "a_int",
    "w": 700,
    "pct": false
   },
   {
    "id": "af_wil",
    "kind": "suffix",
    "n": "of the Monk",
    "stat": "wil",
    "txt": "+{v} Willpower",
    "tiers": [
     [
      60,
      28,
      33
     ],
     [
      44,
      21,
      27
     ],
     [
      30,
      15,
      20
     ],
     [
      16,
      9,
      14
     ],
     [
      1,
      4,
      8
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "gloves",
     "boots",
     "off",
     "belt",
     "amulet",
     "ring"
    ],
    "group": "a_wil",
    "w": 700,
    "pct": false
   },
   {
    "id": "af_vit",
    "kind": "suffix",
    "n": "of the Bear",
    "stat": "vit",
    "txt": "+{v} Vitality",
    "tiers": [
     [
      60,
      28,
      33
     ],
     [
      44,
      21,
      27
     ],
     [
      30,
      15,
      20
     ],
     [
      16,
      9,
      14
     ],
     [
      1,
      4,
      8
     ]
    ],
    "slots": [
     "helm",
     "chest",
     "gloves",
     "boots",
     "off",
     "belt",
     "amulet",
     "ring"
    ],
    "group": "a_vit",
    "w": 800,
    "pct": false
   },
   {
    "id": "af_regen",
    "kind": "suffix",
    "n": "of Recovery",
    "stat": "hpRegenPct",
    "txt": "+{v} % Max HP regenerace/s",
    "tiers": [
     [
      44,
      0.8,
      1
     ],
     [
      16,
      0.5,
      0.7
     ],
     [
      1,
      0.2,
      0.4
     ]
    ],
    "slots": [
     "chest",
     "belt",
     "helm",
     "amulet"
    ],
    "group": "regen",
    "w": 400,
    "pct": true
   },
   {
    "id": "af_cdr",
    "kind": "suffix",
    "n": "of Patience",
    "stat": "cdr",
    "txt": "+{v} % Cooldown Recovery",
    "tiers": [
     [
      44,
      8,
      10
     ],
     [
      16,
      5,
      7
     ],
     [
      1,
      3,
      4
     ]
    ],
    "slots": [
     "amulet",
     "relic",
     "helm"
    ],
    "group": "cdr",
    "w": 300,
    "pct": true
   },
   {
    "id": "af_skill",
    "kind": "suffix",
    "n": "of the Echo",
    "stat": "skillLvl",
    "txt": "+{v} k úrovni všech skillů",
    "tiers": [
     [
      50,
      2,
      2
     ],
     [
      1,
      1,
      1
     ]
    ],
    "slots": [
     "amulet",
     "relic"
    ],
    "group": "skill",
    "w": 100,
    "pct": false
   }
  ],
  "uniques": [
   {
    "id": "un_ashfather",
    "n": "Ashfather's Maul",
    "base": "wb_maul",
    "tier": 1,
    "req": 12,
    "lines": [
     [
      "wPhysInc",
      1.2,
      1.5
     ],
     [
      "fireInc",
      0.3,
      0.4
     ],
     [
      "str",
      20,
      30
     ]
    ],
    "spec": "Searing Slam zanechá hořící zem 3 s (30 % zásahu/s).",
    "lore": "Aldric si do něj zakoval vlastní stín."
   },
   {
    "id": "un_kilnbrand",
    "n": "Kilnbrand",
    "base": "wb_sword",
    "tier": 1,
    "req": 10,
    "lines": [
     [
      "wFlat",
      8,
      12
     ],
     [
      "fireInc",
      0.25,
      0.35
     ],
     [
      "as",
      0.08,
      0.1
     ]
    ],
    "spec": "Brand Strike nestackuje, ale Brand se šíří na 2 blízké cíle.",
    "lore": "Žár z pece, který nikdy nevyhasl."
   },
   {
    "id": "un_lanternheart",
    "n": "Lantern of the First Vigil",
    "base": "wb_kite",
    "tier": 1,
    "req": 14,
    "lines": [
     [
      "block",
      0.06,
      0.08
     ],
     [
      "hpFlat",
      40,
      60
     ],
     [
      "resAll",
      0.1,
      0.12
     ]
    ],
    "spec": "Blokovaný zásah přidá 5 Cinders (cd 0,5 s).",
    "lore": "Lucerna, kterou nesla první hlídka po Sunderingu."
   },
   {
    "id": "un_oathkeeper",
    "n": "Oathkeeper's Torc",
    "base": "wb_amulet",
    "tier": 2,
    "req": 40,
    "lines": [
     [
      "str",
      25,
      35
     ],
     [
      "critMult",
      0.2,
      0.3
     ],
     [
      "hpInc",
      -0.1,
      -0.1
     ]
    ],
    "spec": "Blood Oath stojí 5 % HP místo 8 % a dává 2 Ruin stacky.",
    "lore": "Přísaha, kterou nikdo nedodržel."
   },
   {
    "id": "un_rootcrown",
    "n": "Crown of the Rootmother",
    "base": "wb_helm_int",
    "tier": 1,
    "req": 20,
    "lines": [
     [
      "minionHp",
      0.25,
      0.35
     ],
     [
      "necInc",
      0.15,
      0.2
     ],
     [
      "res_nec",
      0.2,
      0.25
     ]
    ],
    "spec": "Minioni při smrti zanechají kořen, který na 1 s zastaví nepřátele.",
    "lore": "Kořeny stále hledají srdce."
   },
   {
    "id": "un_ghuljaw",
    "n": "Ghulmaw's Jaw",
    "base": "wb_gloves_str",
    "tier": 1,
    "req": 18,
    "lines": [
     [
      "addPhys",
      6,
      9
     ],
     [
      "as",
      0.08,
      0.12
     ],
     [
      "hpRegenPct",
      0.004,
      0.006
     ]
    ],
    "spec": "2 % fyzického poškození zásahů je leech jako HP.",
    "lore": "Čelist stále cvaká, když je hlad."
   },
   {
    "id": "un_skyfall_codex",
    "n": "Skyfall Codex",
    "base": "wb_relic_sun",
    "tier": 2,
    "req": 45,
    "lines": [
     [
      "lightInc",
      0.25,
      0.35
     ],
     [
      "skillLvl",
      1,
      1
     ],
     [
      "cs",
      0.06,
      0.08
     ]
    ],
    "spec": "Skyfall Sigil má o 30 % kratší cooldown; každý glyf ve 7 m zvýší jeho damage o 10 % more.",
    "lore": "Stránky, které píší blesky."
   },
   {
    "id": "un_prism",
    "n": "Prism of Sarkhan",
    "base": "wb_relic_moth",
    "tier": 1,
    "req": 32,
    "lines": [
     [
      "eleInc",
      0.2,
      0.3
     ],
     [
      "resAll",
      0.05,
      0.08
     ]
    ],
    "spec": "Echoes kategorie Element lze kombinovat (ignoruje exkluzivní skupinu „conv“, max 2).",
    "lore": "Sarkhanova hlava viděla svět rozložený na barvy."
   },
   {
    "id": "un_sphinx_sand",
    "n": "Sands of the Sphinx",
    "base": "wb_belt_sash",
    "tier": 1,
    "req": 28,
    "lines": [
     [
      "cdr",
      0.08,
      0.12
     ],
     [
      "hpFlat",
      30,
      50
     ],
     [
      "regenInc",
      0.1,
      0.15
     ]
    ],
    "spec": "Při použití skillu s CD ≥ 10 s se ostatní CD posunou o 1 s.",
    "lore": "Písek teče nahoru."
   },
   {
    "id": "un_vigil_tongue",
    "n": "Tongue of St. Vigil",
    "base": "wb_scepter",
    "tier": 2,
    "req": 36,
    "lines": [
     [
      "eleInc",
      0.3,
      0.4
     ],
     [
      "cs",
      0.08,
      0.1
     ],
     [
      "res_light",
      0.15,
      0.2
     ]
    ],
    "spec": "Každý 5. seslaný spell zazvoní: 1 s stun v 4 m.",
    "lore": "Zvon mlčí, jazyk ne."
   },
   {
    "id": "un_last_waltz",
    "n": "Morwen's Last Waltz",
    "base": "wb_ring",
    "tier": 2,
    "req": 42,
    "lines": [
     [
      "dmgInc",
      0.12,
      0.16
     ],
     [
      "res_cold",
      0.2,
      0.25
     ],
     [
      "ms",
      0.04,
      0.06
     ]
    ],
    "spec": "4 % damage jako leech; přeléčení se mění na bariéru (max 15 % HP).",
    "lore": "Tančila, dokud čas nestál."
   },
   {
    "id": "un_veilwalker",
    "n": "Veilwalker Jerkin",
    "base": "wb_chest_dex",
    "tier": 3,
    "req": 55,
    "lines": [
     [
      "evaInc",
      0.6,
      0.8
     ],
     [
      "dex",
      25,
      35
     ],
     [
      "critInc",
      0.2,
      0.3
     ]
    ],
    "spec": "Po vyhnutí se útoku (evasion) je další zásah jistý crit (cd 2 s).",
    "lore": "Šitá ze stínu, který si nikdo nenárokoval."
   },
   {
    "id": "un_pale_signet",
    "n": "Pale Signet",
    "base": "wb_ring",
    "tier": 3,
    "req": 50,
    "lines": [
     [
      "necInc",
      0.2,
      0.28
     ],
     [
      "dotInc",
      0.15,
      0.22
     ],
     [
      "res_nec",
      0.15,
      0.2
     ]
    ],
    "spec": "Pale Rot má max 7 stacků místo 5.",
    "lore": "Pečeť, kterou chór pečetil mrtvé."
   },
   {
    "id": "un_noon_halo",
    "n": "Halo of the Unending Noon",
    "base": "wb_helm_str",
    "tier": 3,
    "req": 50,
    "lines": [
     [
      "radInc",
      0.3,
      0.4
     ],
     [
      "hpInc",
      0.08,
      0.12
     ],
     [
      "res_rad",
      0.25,
      0.3
     ]
    ],
    "spec": "30 % všech zásahů se konvertuje na Radiant; Sear na nepřátelích ti léčí 1 % HP/s.",
    "lore": "Svatozář, která pálí nositele."
   },
   {
    "id": "un_noonsplitter",
    "n": "Noonsplitter",
    "base": "wb_greatsword",
    "tier": 3,
    "req": 50,
    "lines": [
     [
      "wPhysInc",
      1.5,
      1.8
     ],
     [
      "radInc",
      0.3,
      0.4
     ],
     [
      "critFlat",
      2,
      3
     ]
    ],
    "spec": "Pillar of the Last Dawn a Severing Arc jsou 100 % Radiant.",
    "lore": "Rozpůlila poledne."
   },
   {
    "id": "un_eclipse_pact",
    "n": "Eclipse Pact",
    "base": "wb_amulet",
    "tier": 3,
    "req": 60,
    "lines": [
     [
      "dmgInc",
      0.2,
      0.25
     ],
     [
      "allAttr",
      10,
      15
     ],
     [
      "resAll",
      0.1,
      0.12
     ]
    ],
    "spec": "Střídavě 10 s Sol (+25 % fire/rad more) a 10 s Umbra (+25 % cold/nec more).",
    "lore": "Dva hlasy, jedna smlouva."
   },
   {
    "id": "un_first_echo",
    "n": "Echo of the First",
    "base": "wb_relic_moth",
    "tier": 3,
    "req": 68,
    "lines": [
     [
      "skillLvl",
      2,
      2
     ],
     [
      "dmgInc",
      0.15,
      0.2
     ]
    ],
    "spec": "Všechny skilly mají +1 Echo slot (max 4). Memory Echoes −20 % účinku.",
    "lore": "Ysolde to slyšela jako první."
   },
   {
    "id": "un_rimeweave",
    "n": "Rimeweave Wraps",
    "base": "wb_gloves_int",
    "tier": 2,
    "req": 34,
    "lines": [
     [
      "coldInc",
      0.25,
      0.3
     ],
     [
      "cs",
      0.06,
      0.08
     ],
     [
      "res_cold",
      0.15,
      0.2
     ]
    ],
    "spec": "Chill na cíli = +30 % šance na freeze od Rime Prison i na bossy (0,8 → 1,2 s).",
    "lore": "Mráz má paměť."
   },
   {
    "id": "un_gravesong",
    "n": "Gravesong Scythe",
    "base": "wb_scythe",
    "tier": 2,
    "req": 30,
    "lines": [
     [
      "minionInc",
      0.4,
      0.5
     ],
     [
      "minionHp",
      0.2,
      0.25
     ],
     [
      "wil",
      15,
      25
     ]
    ],
    "spec": "+1 max husk, +1 max archer.",
    "lore": "Zpívá, když žne."
   },
   {
    "id": "un_hexstring",
    "n": "Hexstring",
    "base": "wb_bow",
    "tier": 2,
    "req": 30,
    "lines": [
     [
      "wPhysInc",
      0.8,
      1
     ],
     [
      "necInc",
      0.2,
      0.3
     ],
     [
      "critInc",
      0.15,
      0.2
     ]
    ],
    "spec": "Hex Arrow aplikuje Hex na všechny proražené cíle.",
    "lore": "Tětiva z vlasů čarodějnice."
   },
   {
    "id": "un_marrow_cath",
    "n": "Marrow Cathedral",
    "base": "wb_chest_int",
    "tier": 2,
    "req": 36,
    "lines": [
     [
      "armorInc",
      0.4,
      0.5
     ],
     [
      "minionHp",
      0.3,
      0.4
     ],
     [
      "hpFlat",
      50,
      70
     ]
    ],
    "spec": "Bone Colossus sdílí 20 % poškození, které dostáváš.",
    "lore": "Katedrála, kterou nosíš."
   },
   {
    "id": "un_ash_treads",
    "n": "Ashwalker Treads",
    "base": "wb_boots_dex",
    "tier": 1,
    "req": 24,
    "lines": [
     [
      "ms",
      0.18,
      0.22
     ],
     [
      "res_fire",
      0.15,
      0.2
     ],
     [
      "evaInc",
      0.2,
      0.3
     ]
    ],
    "spec": "Imunita na doutnající zem a písečné bouře (environment).",
    "lore": "Nikdy nespálily nohu."
   },
   {
    "id": "un_choir_mask",
    "n": "Faceless Choir Mask",
    "base": "wb_helm_dex",
    "tier": 2,
    "req": 44,
    "lines": [
     [
      "critMult",
      0.2,
      0.25
     ],
     [
      "res_rad",
      0.2,
      0.25
     ],
     [
      "dex",
      15,
      20
     ]
    ],
    "spec": "Stealth trvá o 1 s déle; první zásah ze stealthu aplikuje Sear.",
    "lore": "Za maskou nic nezbylo."
   },
   {
    "id": "un_kindling_belt",
    "n": "Belt of Kindling",
    "base": "wb_belt_heavy",
    "tier": 1,
    "req": 16,
    "lines": [
     [
      "hpFlat",
      30,
      45
     ],
     [
      "cinderOnHit",
      1,
      1
     ],
     [
      "res_fire",
      0.15,
      0.2
     ]
    ],
    "spec": "Cinders neklesají mimo boj.",
    "lore": "Pás, který hřeje."
   }
  ],
  "tables": [
   {
    "id": "lt_normal",
    "n": "Normal enemy",
    "cur": [
     [
      "cu_gold",
      0.06
     ],
     [
      "cu_ember",
      0.02
     ],
     [
      "cu_residue",
      0.05
     ]
    ],
    "d": "Základní tabulka; item level = level monstra."
   },
   {
    "id": "lt_caster",
    "n": "Caster enemy",
    "cur": [
     [
      "cu_gold",
      0.06
     ],
     [
      "cu_ember",
      0.03
     ],
     [
      "cu_residue",
      0.06
     ]
    ],
    "d": "Mírně vyšší šance na runy (+1 %)."
   },
   {
    "id": "lt_elite",
    "n": "Elite pack member",
    "cur": [
     [
      "cu_gold",
      0.2
     ],
     [
      "cu_ember",
      0.1
     ],
     [
      "cu_residue",
      0.5
     ]
    ],
    "d": "Garantovaný Magic+ z balíku (pack bonus)."
   },
   {
    "id": "lt_rare",
    "n": "Rare enemy",
    "cur": [
     [
      "cu_gold",
      0.5
     ],
     [
      "cu_dust",
      0.3
     ],
     [
      "cu_residue",
      1
     ]
    ],
    "d": "2 pokusy, smart loot 60 %."
   }
  ]
 },
 "level": 8,
 "dungeon": {
  "sizes": {
   "S": [
    5,
    7
   ],
   "M": [
    7,
    10
   ],
   "L": [
    10,
    14
   ]
  },
  "themes": {
   "crypt": [
    "Krypta (Act I)",
    "#b98a4e"
   ],
   "abbey": [
    "Utopené opatství (Act II)",
    "#4fb3b0"
   ],
   "glass": [
    "Skleněný kráter (Act III)",
    "#e8d266"
   ],
   "gloam": [
    "Krypty Vigilu (Act IV)",
    "#a07ee0"
   ],
   "sundial": [
    "Sluneční hodiny (Act V)",
    "#ffe7a6"
   ]
  }
 }
};
