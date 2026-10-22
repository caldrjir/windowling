'use strict';
// ── Ikony (SVG, viewBox 24×24, tah currentColor) ────────────────────────────
const ICONS = {
  pulse: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  orbit: '<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3.5"/><path d="M19 5l2-2M5 19l-2 2"/>',
  arc: '<path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5z"/>',
  seeker: '<path d="M4.5 19.5l4-4"/><path d="M13 3c4 .5 7.5 4 8 8l-7.5 7.5-8-8z"/><circle cx="14.5" cy="9.5" r="1.6"/>',
  nova: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10" stroke-dasharray="2 2.5"/>',
  lance: '<path d="M3 21L19 5"/><path d="M14 3h7v7"/><path d="M6 13l5 5"/>',
  mines: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M5.3 18.7l2.8-2.8M15.9 8.1l2.8-2.8"/>',
  aura: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>',
  might: '<path d="M12 2.5l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.6l-6.2 3.6 1.6-6.9-5.3-4.7 7-.7z"/>',
  haste: '<circle cx="12" cy="13" r="8"/><path d="M12 8.5V13l3 2M9 2.5h6"/>',
  area: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><circle cx="12" cy="12" r="3"/>',
  speed: '<path d="M4 6l6 6-6 6M12 6l6 6-6 6"/>',
  armor: '<path d="M12 2.5l8 3v6c0 5-3.5 8.8-8 10.5-4.5-1.7-8-5.5-8-10.5v-6z"/>',
  magnet: '<path d="M6 3v8a6 6 0 0012 0V3h-4v8a2 2 0 01-4 0V3z"/><path d="M6 7h4M14 7h4"/>',
  duration: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  regen: '<path d="M12 20.5s-8.5-4.8-8.5-11a4.6 4.6 0 018.5-2.4 4.6 4.6 0 018.5 2.4c0 6.2-8.5 11-8.5 11z"/><path d="M12 9v6M9 12h6"/>',
  luck: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r=".8"/><circle cx="15" cy="15" r=".8"/><circle cx="15" cy="9" r=".8"/><circle cx="9" cy="15" r=".8"/><circle cx="12" cy="12" r=".8"/>',
  amount: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5a1.5 1.5 0 00-1.5-1.5H5A1.5 1.5 0 003.5 5v9A1.5 1.5 0 005 15.5h3.5"/>',
  growth: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  greed: '<path d="M6.5 3.5h11l4 5.5-10 11.5L1.5 9z"/><path d="M1.5 9h20M9 3.5L12 9l3-5.5M12 9v11"/>',
  revival: '<path d="M3.5 12a8.5 8.5 0 102.8-6.3L3.5 8.5"/><path d="M3.5 3.5v5h5"/><path d="M12 8v4l2.5 2.5"/>',
  reroll: '<path d="M4 4v5.5h5.5M20 20v-5.5h-5.5"/><path d="M5.3 15A7.8 7.8 0 0019 16.8M18.7 9A7.8 7.8 0 005 7.2"/>',
  skip: '<path d="M5 5l8 7-8 7z"/><path d="M17 5v14"/>',
  dash: '<path d="M13 4.5l7 7.5-7 7.5"/><path d="M3 8h8M1.5 12h11M3 16h8"/>',
  crit: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/>',
  vitality: '<path d="M12 20.5s-8.5-4.8-8.5-11a4.6 4.6 0 018.5-2.4 4.6 4.6 0 018.5 2.4c0 6.2-8.5 11-8.5 11z"/>',
  heal: '<path d="M12 20.5s-8.5-4.8-8.5-11a4.6 4.6 0 018.5-2.4 4.6 4.6 0 018.5 2.4c0 6.2-8.5 11-8.5 11z"/><path d="M12 9v6M9 12h6"/>',
  shard: '<path d="M12 2l6 7-6 13L6 9z"/><path d="M6 9h12"/>',
  skull: '<path d="M12 2.5c-5 0-8.5 3.5-8.5 8 0 3 1.5 5 3.5 6v3.5h10V16.5c2-1 3.5-3 3.5-6 0-4.5-3.5-8-8.5-8z"/><circle cx="8.8" cy="11" r="1.8"/><circle cx="15.2" cy="11" r="1.8"/><path d="M10 20v-2M14 20v-2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  trophy: '<path d="M7 3.5h10v5a5 5 0 01-10 0z"/><path d="M7 5H3.5v1.5A3.5 3.5 0 007 10M17 5h3.5v1.5A3.5 3.5 0 0117 10M12 13.5V17M8 21h8M9.5 17h5v4h-5z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 018 0v3.5"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  star: '<path d="M12 2.5l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.6l-6.2 3.6 1.6-6.9-5.3-4.7 7-.7z"/>',
  play: '<path d="M7 4.5l13 7.5-13 7.5z"/>',
  forge: '<path d="M3 20.5h18M6 20.5v-4h12v4M8 16.5c0-3 1.5-4.5 4-4.5s4 1.5 4 4.5"/><path d="M14.5 3.5l6 6-3 3-6-6z"/><path d="M11.5 9.5l-5 5"/>',
  book: '<path d="M4 4.5A2 2 0 016 2.5h14v16H6a2 2 0 00-2 2z"/><path d="M4 20.5a2 2 0 002 2h14v-4M8 7h8M8 11h6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 1.5v3M12 19.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M1.5 12h3M19.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
  home: '<path d="M3 11l9-7.5 9 7.5"/><path d="M5.5 9v11.5h13V9"/><path d="M10 20.5v-6h4v6"/>',
  rocket: '<path d="M12 2.5c3.5 2.5 5 6 5 10l-2.5 3.5h-5L7 12.5c0-4 1.5-7.5 5-10z"/><circle cx="12" cy="9.5" r="1.8"/><path d="M9.5 16l-3 5.5 3.5-2M14.5 16l3 5.5-3.5-2"/>',
  chest: '<rect x="3" y="9" width="18" height="11" rx="1.5"/><path d="M3 9l2-5h14l2 5M10.5 12.5h3v3h-3z"/>',
  bomb: '<circle cx="11" cy="14" r="7"/><path d="M15.5 8.5l2-2M17 4l1.5 1.5M20 3.5l-1 1M19.5 7H21"/>',
  boss: '<path d="M3 7l4 4 5-7 5 7 4-4-2 12H5z"/><path d="M5 19h14"/>',
  wave: '<path d="M2 12c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-3 5-2"/><path d="M2 17c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-3 5-2" opacity=".5"/>',
};
function icon(id, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[id] || ICONS.star}</svg>`;
}

// ── Zbraně ──────────────────────────────────────────────────────────────────
// up[i] = [změny statistik, popis] pro úroveň i+2
const WEAPONS = {
  pulse: {
    name: 'Pulzní kanón', color: '#55f6ff', icon: 'pulse',
    desc: 'Pálí energetické pulzy na nejbližší cíl.',
    base: { dmg: 11, cd: 0.62, amount: 1, speed: 640, pierce: 0, area: 1, dur: 1 },
    up: [
      [{ amount: 1 }, '+1 projektil'], [{ dmg: 5 }, '+5 poškození'], [{ cd: -0.1 }, 'Rychlejší palba'],
      [{ amount: 1 }, '+1 projektil'], [{ pierce: 1 }, 'Průraz +1'], [{ dmg: 8 }, '+8 poškození'],
      [{ amount: 1, pierce: 1 }, '+1 projektil, průraz +1'],
    ],
    evo: 'hyperpulse', evoWith: 'haste',
  },
  orbit: {
    name: 'Orbitální čepele', color: '#ff5fd7', icon: 'orbit',
    desc: 'Čepele kroužící kolem lodi trhají vše, čeho se dotknou.',
    base: { dmg: 13, cd: 2.4, amount: 2, speed: 3.3, area: 1, dur: 3.5 },
    up: [
      [{ amount: 1 }, '+1 čepel'], [{ dmg: 6 }, '+6 poškození'], [{ area: 0.2, speed: 0.6 }, 'Větší okruh, rychlejší rotace'],
      [{ amount: 1 }, '+1 čepel'], [{ dur: 1.5 }, '+1,5 s trvání'], [{ dmg: 9 }, '+9 poškození'],
      [{ amount: 1, area: 0.15 }, '+1 čepel, větší okruh'],
    ],
    evo: 'halo', evoWith: 'area',
  },
  arc: {
    name: 'Obloukový výboj', color: '#8cc8ff', icon: 'arc',
    desc: 'Blesk zasáhne cíl a přeskočí na další nepřátele.',
    base: { dmg: 17, cd: 1.35, amount: 1, chain: 2, range: 170, area: 1 },
    up: [
      [{ chain: 1 }, '+1 přeskok'], [{ dmg: 8 }, '+8 poškození'], [{ amount: 1 }, '+1 výboj'],
      [{ cd: -0.2 }, 'Rychlejší nabíjení'], [{ chain: 2 }, '+2 přeskoky'], [{ dmg: 12 }, '+12 poškození'],
      [{ amount: 1, chain: 1 }, '+1 výboj, +1 přeskok'],
    ],
    evo: 'tesla', evoWith: 'duration',
  },
  seeker: {
    name: 'Naváděné střely', color: '#ffa23d', icon: 'seeker',
    desc: 'Rakety si samy najdou cíl a explodují.',
    base: { dmg: 20, cd: 1.7, amount: 1, speed: 360, area: 1 },
    up: [
      [{ amount: 1 }, '+1 raketa'], [{ dmg: 10 }, '+10 poškození'], [{ area: 0.25 }, 'Větší exploze'],
      [{ amount: 1 }, '+1 raketa'], [{ cd: -0.25 }, 'Rychlejší nabíjení'], [{ dmg: 14 }, '+14 poškození'],
      [{ amount: 2 }, '+2 rakety'],
    ],
    evo: 'swarm', evoWith: 'might',
  },
  nova: {
    name: 'Rázová vlna', color: '#ffe066', icon: 'nova',
    desc: 'Periodicky uvolní prstenec energie, který odhazuje nepřátele.',
    base: { dmg: 16, cd: 2.9, amount: 1, area: 1, knock: 320 },
    up: [
      [{ dmg: 10 }, '+10 poškození'], [{ area: 0.2 }, 'Větší dosah'], [{ cd: -0.4 }, 'Rychlejší nabíjení'],
      [{ dmg: 14 }, '+14 poškození'], [{ area: 0.2 }, 'Větší dosah'], [{ amount: 1 }, 'Dvojitá vlna'],
      [{ dmg: 20, knock: 120 }, '+20 poškození, silnější odraz'],
    ],
    evo: 'supernova', evoWith: 'armor',
  },
  lance: {
    name: 'Paprskové kopí', color: '#b6ff5c', icon: 'lance',
    desc: 'Průrazný laserový paprsek přes celou obrazovku.',
    base: { dmg: 32, cd: 2.0, amount: 1, width: 12, len: 760, area: 1 },
    up: [
      [{ dmg: 14 }, '+14 poškození'], [{ amount: 1 }, '+1 paprsek'], [{ cd: -0.3 }, 'Rychlejší nabíjení'],
      [{ width: 6 }, 'Širší paprsek'], [{ amount: 1 }, '+1 paprsek'], [{ dmg: 24 }, '+24 poškození'],
      [{ cd: -0.3, amount: 1 }, '+1 paprsek, rychlejší nabíjení'],
    ],
    evo: 'prism', evoWith: 'amount',
  },
  mines: {
    name: 'Prázdnotové miny', color: '#c47bff', icon: 'mines',
    desc: 'Rozmisťuje miny, které vybuchnou při kontaktu s nepřítelem.',
    base: { dmg: 42, cd: 1.5, amount: 1, area: 1, dur: 9 },
    up: [
      [{ amount: 1 }, '+1 mina'], [{ dmg: 20 }, '+20 poškození'], [{ area: 0.25 }, 'Větší exploze'],
      [{ cd: -0.4 }, 'Rychlejší pokládání'], [{ amount: 1 }, '+1 mina'], [{ dmg: 30 }, '+30 poškození'],
      [{ amount: 2 }, '+2 miny'],
    ],
    evo: 'singularity', evoWith: 'magnet',
  },
  aura: {
    name: 'Mrazivé pole', color: '#9ffcff', icon: 'aura',
    desc: 'Ledová aura zraňuje a zpomaluje nepřátele v okolí.',
    base: { dmg: 6, cd: 0.42, area: 1, slow: 0.25, amount: 1 },
    up: [
      [{ area: 0.2 }, 'Větší pole'], [{ dmg: 3 }, '+3 poškození'], [{ slow: 0.1 }, 'Silnější zpomalení'],
      [{ area: 0.2 }, 'Větší pole'], [{ dmg: 4 }, '+4 poškození'], [{ cd: -0.08 }, 'Častější zásahy'],
      [{ area: 0.25, dmg: 3 }, 'Větší a silnější pole'],
    ],
    evo: 'entropy', evoWith: 'regen',
  },
  // ── Evoluce ──
  hyperpulse: {
    name: 'Hyperpulz', color: '#fff27a', icon: 'pulse', evolved: true, from: 'pulse',
    desc: 'Nepřetržitá smršť pulzů, které při zásahu explodují.',
    base: { dmg: 24, cd: 0.16, amount: 3, speed: 900, pierce: 2, area: 1, dur: 1, boom: 1 },
  },
  halo: {
    name: 'Svatozář', color: '#ff9cf0', icon: 'orbit', evolved: true, from: 'orbit',
    desc: 'Věčný prstenec čepelí, který nikdy neustane.',
    base: { dmg: 30, cd: 0, amount: 7, speed: 4.2, area: 1.55, dur: 0, eternal: 1 },
  },
  tesla: {
    name: 'Teslova bouře', color: '#d8f0ff', icon: 'arc', evolved: true, from: 'arc',
    desc: 'Řetězové blesky přeskakující napříč celou hordou.',
    base: { dmg: 40, cd: 0.75, amount: 4, chain: 9, range: 230, area: 1 },
  },
  swarm: {
    name: 'Roj', color: '#ffcf6b', icon: 'seeker', evolved: true, from: 'seeker',
    desc: 'Mračno mikroraket, které zaplaví bojiště.',
    base: { dmg: 36, cd: 1.1, amount: 9, speed: 460, area: 1.35 },
  },
  supernova: {
    name: 'Supernova', color: '#fff6c0', icon: 'nova', evolved: true, from: 'nova',
    desc: 'Trojitá hvězdná exploze, která drtí vše kolem.',
    base: { dmg: 80, cd: 2.1, amount: 3, area: 1.9, knock: 520 },
  },
  prism: {
    name: 'Hranolový paprsek', color: '#e3ff9e', icon: 'lance', evolved: true, from: 'lance',
    desc: 'Rotující paprsky ve všech směrech.',
    base: { dmg: 22, cd: 0.22, amount: 4, width: 16, len: 820, area: 1, spin: 0.9 },
  },
  singularity: {
    name: 'Singularita', color: '#e2b4ff', icon: 'mines', evolved: true, from: 'mines',
    desc: 'Vytváří černé díry, které pohlcují nepřátele.',
    base: { dmg: 26, cd: 3.4, amount: 2, area: 1, dur: 3.8 },
  },
  entropy: {
    name: 'Entropické pole', color: '#d6ffff', icon: 'aura', evolved: true, from: 'aura',
    desc: 'Pole absolutní nuly. Zabití uvnitř tě léčí.',
    base: { dmg: 16, cd: 0.32, area: 1.75, slow: 0.55, amount: 1, leech: 0.4 },
  },
};
const BASE_WEAPONS = ['pulse', 'orbit', 'arc', 'seeker', 'nova', 'lance', 'mines', 'aura'];
const EVOLUTIONS = BASE_WEAPONS.map(id => WEAPONS[id].evo);

// ── Doplňky (pasivní) ───────────────────────────────────────────────────────
const PASSIVES = {
  might: { name: 'Jádro síly', icon: 'might', color: '#ff6b6b', desc: '+10 % poškození', max: 5, mod: { might: 0.10 } },
  haste: { name: 'Přetaktování', icon: 'haste', color: '#ffd166', desc: '−7 % doba nabíjení', max: 5, mod: { cdMul: -0.07 } },
  area: { name: 'Gyroskop', icon: 'area', color: '#06d6a0', desc: '+10 % oblast účinku', max: 5, mod: { area: 0.10 } },
  speed: { name: 'Trysky', icon: 'speed', color: '#4cc9f0', desc: '+8 % rychlost pohybu', max: 5, mod: { speed: 0.08 } },
  armor: { name: 'Pancéřování', icon: 'armor', color: '#a0a6ff', desc: '+1 pancíř, +12 max. zdraví', max: 5, mod: { armor: 1, maxHp: 12 } },
  magnet: { name: 'Gravitační cívka', icon: 'magnet', color: '#f72585', desc: '+30 % dosah sběru', max: 5, mod: { magnet: 0.30 } },
  duration: { name: 'Fokusační čočka', icon: 'duration', color: '#b8f2e6', desc: '+10 % trvání a rychlost střel', max: 5, mod: { dur: 0.10, projSpd: 0.10 } },
  regen: { name: 'Nanoboti', icon: 'regen', color: '#80ffdb', desc: '+0,3 regenerace zdraví/s', max: 5, mod: { regen: 0.3 } },
  luck: { name: 'Kvantová kostka', icon: 'luck', color: '#cdb4db', desc: '+10 % štěstí, +4 % kritický zásah', max: 5, mod: { luck: 0.10, crit: 0.04 } },
  amount: { name: 'Duplikátor', icon: 'amount', color: '#ffbe0b', desc: '+1 projektil všech zbraní', max: 2, mod: { amount: 1 }, rare: true },
};

// ── Nepřátelé ───────────────────────────────────────────────────────────────
const ENEMIES = {
  drone: { shape: 'tri', color: '#ff4fd8', r: 13, hp: 11, speed: 92, dmg: 8, xp: 1 },
  swarmer: { shape: 'dart', color: '#ff9a3c', r: 9, hp: 6, speed: 148, dmg: 5, xp: 1, mass: 0.5 },
  brute: { shape: 'square', color: '#9b6bff', r: 21, hp: 58, speed: 62, dmg: 15, xp: 4, mass: 3 },
  shooter: { shape: 'diamond', color: '#ffe14d', r: 14, hp: 22, speed: 82, dmg: 8, xp: 2, ranged: { cd: 2.6, range: 400, spd: 230, dmg: 10 } },
  splitter: { shape: 'hex', color: '#4dff9a', r: 18, hp: 34, speed: 74, dmg: 10, xp: 2, split: 'mini' },
  mini: { shape: 'hex', color: '#4dff9a', r: 10, hp: 9, speed: 124, dmg: 6, xp: 1, mass: 0.6 },
  dasher: { shape: 'arrow', color: '#ff4d5e', r: 14, hp: 26, speed: 70, dmg: 14, xp: 2, dash: { cd: 3.2, spd: 540, dur: 0.45 } },
  exploder: { shape: 'star', color: '#fff3e0', r: 15, hp: 20, speed: 112, dmg: 22, xp: 2, explode: 85 },
  tank: { shape: 'oct', color: '#4dc3ff', r: 30, hp: 230, speed: 44, dmg: 22, xp: 10, mass: 8 },
  wisp: { shape: 'circle', color: '#b0fff6', r: 8, hp: 5, speed: 205, dmg: 4, xp: 1, mass: 0.3 },
};

// Skladba vln: [od minuty, váhy typů]
const WAVES = [
  [0, { drone: 10 }],
  [1, { drone: 8, swarmer: 4 }],
  [2, { drone: 6, swarmer: 5, splitter: 2 }],
  [3, { drone: 5, swarmer: 4, brute: 2, shooter: 2 }],
  [4.5, { swarmer: 6, brute: 2, shooter: 3, dasher: 2, drone: 3 }],
  [6, { drone: 4, splitter: 4, dasher: 3, exploder: 2, brute: 2 }],
  [8, { swarmer: 6, shooter: 3, exploder: 3, tank: 1, wisp: 4 }],
  [10, { wisp: 6, brute: 3, dasher: 4, splitter: 3, tank: 1 }],
  [12, { exploder: 4, shooter: 4, tank: 2, wisp: 6, dasher: 3, brute: 2 }],
  [13.5, { drone: 3, swarmer: 4, brute: 3, shooter: 4, splitter: 3, dasher: 4, exploder: 4, tank: 2, wisp: 5 }],
];

const BOSSES = {
  warden: { name: 'STRÁŽCE', shape: 'oct', color: '#ff4fd8', r: 56, hp: 2600, speed: 72, dmg: 25, patterns: ['ring', 'aimed', 'ring', 'summon'] },
  hive: { name: 'ÚL', shape: 'hex', color: '#ffb13c', r: 60, hp: 3400, speed: 58, dmg: 25, patterns: ['spiral', 'summon', 'aimed', 'spiral'] },
  colossus: { name: 'KOLOS', shape: 'square', color: '#4dc3ff', r: 66, hp: 4400, speed: 62, dmg: 30, patterns: ['charge', 'ring', 'charge', 'aimed'] },
  reaper: { name: 'ŽNEC', shape: 'arrow', color: '#ff4d5e', r: 58, hp: 4000, speed: 80, dmg: 30, patterns: ['charge', 'flower', 'aimed', 'summon'] },
  monarch: { name: 'MONARCHA PRÁZDNOTY', shape: 'star', color: '#c58bff', r: 82, hp: 7000, speed: 60, dmg: 35, patterns: ['spiral', 'ring', 'charge', 'summon', 'flower', 'aimed'] },
};

// ── Sektory ─────────────────────────────────────────────────────────────────
const SECTORS = [
  { id: 's1', name: 'Neonová mlhovina', roman: 'I', bg: ['#0d0526', '#05010f'], neb: ['#7a2cff', '#ff2fb4', '#2a6bff'], grid: '#8b5cff', accent: '#ff4fd8',
    hp: 1, dmg: 1, spawn: 1, shards: 1, bosses: ['warden', 'hive', 'monarch'], favor: {}, desc: 'Kde to všechno začalo. Prázdnota tu teprve otevírá oči.' },
  { id: 's2', name: 'Rudý pás', roman: 'II', bg: ['#200608', '#080102'], neb: ['#ff2a3a', '#ff7a1a', '#7a0b2c'], grid: '#ff4d4d', accent: '#ff9a3c',
    hp: 1.7, dmg: 1.25, spawn: 1.12, shards: 1.6, bosses: ['reaper', 'colossus', 'monarch'], favor: { dasher: 3, exploder: 2 }, desc: 'Roztavené trosky starých flotil. Nepřátelé útočí bez varování.' },
  { id: 's3', name: 'Smaragdová prázdnota', roman: 'III', bg: ['#03160f', '#010604'], neb: ['#00e38c', '#00b3ff', '#0b5c3c'], grid: '#2bffa8', accent: '#4dff9a',
    hp: 2.6, dmg: 1.5, spawn: 1.22, shards: 2.4, bosses: ['hive', 'warden', 'monarch'], favor: { splitter: 4, wisp: 3 }, desc: 'Živá hmota, která se dělí a množí. Rychlost je vším.' },
  { id: 's4', name: 'Zlatý horizont', roman: 'IV', bg: ['#1c1203', '#070401'], neb: ['#ffb300', '#ff6a00', '#5c3b00'], grid: '#ffc94d', accent: '#ffe14d',
    hp: 3.8, dmg: 1.8, spawn: 1.32, shards: 3.4, bosses: ['colossus', 'reaper', 'monarch'], favor: { shooter: 4, tank: 2 }, desc: 'Okraj horizontu událostí. Střely létají ze všech stran.' },
  { id: 's5', name: 'Srdce prázdnoty', roman: 'V', bg: ['#0a0a14', '#000000'], neb: ['#ffffff', '#9d7bff', '#2e1a66'], grid: '#d4c4ff', accent: '#ffffff',
    hp: 5.4, dmg: 2.2, spawn: 1.45, shards: 4.8, bosses: ['reaper', 'colossus', 'monarch'], favor: { exploder: 3, tank: 3, wisp: 4 }, desc: 'Konec všeho. Nikdo se odsud nevrátil.' },
];
const MAX_OD = 10;
const BOSS_TIMES = [300, 600, 900];
const RUN_LENGTH = 900;

// ── Piloti ──────────────────────────────────────────────────────────────────
const PILOTS = [
  { id: 'vex', name: 'VEX', role: 'Průzkumnice', color: '#55f6ff', weapon: 'pulse', desc: 'Vyvážená pilotka pro každou situaci.', perk: '+10 % zkušenosti', mods: { growth: 0.10 }, unlock: null },
  { id: 'kira', name: 'KIRA', role: 'Duelistka', color: '#ff5fd7', weapon: 'orbit', desc: 'Tančí uprostřed hordy a čepele dělají zbytek.', perk: '+15 % rychlost pohybu', mods: { speed: 0.15 }, unlock: null },
  { id: 'orion', name: 'ORION', role: 'Technik', color: '#8cc8ff', weapon: 'arc', desc: 'Inženýr, který z každého obvodu vyždímá maximum.', perk: '+10 % oblast, −5 % nabíjení', mods: { area: 0.10, cdMul: -0.05 }, unlock: 't5' },
  { id: 'nyx', name: 'NYX', role: 'Lovkyně', color: '#c58bff', weapon: 'seeker', desc: 'Útočí první. Na obranu nemá čas.', perk: '+20 % poškození, −20 zdraví', mods: { might: 0.20, maxHp: -20 }, unlock: 'k1000' },
  { id: 'titan', name: 'TITAN', role: 'Strážce', color: '#ffb13c', weapon: 'nova', desc: 'Pomalý, ale prakticky nezničitelný.', perk: '+50 zdraví, +2 pancíř, −10 % rychlost', mods: { maxHp: 50, armor: 2, speed: -0.10 }, unlock: 'boss1' },
  { id: 'echo', name: 'ECHO', role: 'Sabotérka', color: '#4dff9a', weapon: 'mines', desc: 'Hraje s pravděpodobností a vždy vyhraje.', perk: '+25 % štěstí, +2 přehození', mods: { luck: 0.25, rerolls: 2 }, unlock: 'evo1' },
  { id: 'lumen', name: 'LUMEN', role: 'Odstřelovač', color: '#b6ff5c', weapon: 'lance', desc: 'Jeden výstřel, jedna řada mrtvol.', perk: '+15 % trvání a rychlost střel, +5 % krit.', mods: { dur: 0.15, projSpd: 0.15, crit: 0.05 }, unlock: 'clear1' },
  { id: 'zero', name: 'ZERO', role: 'Kryomant', color: '#9ffcff', weapon: 'aura', desc: 'Kolem něj se zastaví i čas.', perk: '+0,5 regenerace, +20 % magnet', mods: { regen: 0.5, magnet: 0.20 }, unlock: 'clear3' },
  { id: 'omega', name: 'OMEGA', role: 'Anomálie', color: '#ffffff', weapon: 'random', desc: 'Nikdo neví, odkud přišla. Ani ona sama.', perk: 'Náhodná zbraň, +1 projektil, +1 oživení', mods: { amount: 1, revives: 1 }, unlock: 'clear5' },
];

// ── Kovárna (trvalá vylepšení) ──────────────────────────────────────────────
const FORGE = [
  { id: 'might', name: 'Síla', icon: 'might', desc: '+5 % poškození', max: 5, cost: 60, mod: ['might', 0.05] },
  { id: 'vitality', name: 'Vitalita', icon: 'vitality', desc: '+10 max. zdraví', max: 5, cost: 45, mod: ['maxHp', 10] },
  { id: 'armor', name: 'Pancíř', icon: 'armor', desc: '+1 pancíř', max: 3, cost: 120, mod: ['armor', 1] },
  { id: 'recovery', name: 'Regenerace', icon: 'regen', desc: '+0,1 zdraví/s', max: 5, cost: 70, mod: ['regen', 0.1] },
  { id: 'haste', name: 'Přetaktování', icon: 'haste', desc: '−3 % nabíjení', max: 4, cost: 110, mod: ['cdMul', -0.03] },
  { id: 'area', name: 'Dosah', icon: 'area', desc: '+5 % oblast účinku', max: 4, cost: 90, mod: ['area', 0.05] },
  { id: 'speed', name: 'Trysky', icon: 'speed', desc: '+5 % rychlost', max: 4, cost: 55, mod: ['speed', 0.05] },
  { id: 'duration', name: 'Stabilizace', icon: 'duration', desc: '+5 % trvání a rychlost střel', max: 4, cost: 80, mod: ['dur', 0.05] },
  { id: 'magnet', name: 'Magnet', icon: 'magnet', desc: '+15 % dosah sběru', max: 4, cost: 45, mod: ['magnet', 0.15] },
  { id: 'growth', name: 'Růst', icon: 'growth', desc: '+4 % zkušenosti', max: 5, cost: 90, mod: ['growth', 0.04] },
  { id: 'greed', name: 'Chamtivost', icon: 'greed', desc: '+10 % střepů', max: 5, cost: 100, mod: ['greed', 0.10] },
  { id: 'luck', name: 'Štěstí', icon: 'luck', desc: '+6 % štěstí', max: 5, cost: 80, mod: ['luck', 0.06] },
  { id: 'crit', name: 'Precizita', icon: 'crit', desc: '+2 % kritický zásah', max: 5, cost: 90, mod: ['crit', 0.02] },
  { id: 'reroll', name: 'Přehození', icon: 'reroll', desc: '+1 přehození za běh', max: 5, cost: 70, mod: ['rerolls', 1] },
  { id: 'skip', name: 'Přeskočení', icon: 'skip', desc: '+1 přeskočení za běh', max: 3, cost: 60, mod: ['skips', 1] },
  { id: 'dash', name: 'Impuls', icon: 'dash', desc: '+1 náboj úskoku', max: 2, cost: 380, mod: ['dashMax', 1] },
  { id: 'revival', name: 'Fénix', icon: 'revival', desc: '+1 oživení za běh', max: 2, cost: 750, mod: ['revives', 1] },
  { id: 'amount', name: 'Duplikátor', icon: 'amount', desc: '+1 projektil všech zbraní', max: 1, cost: 2400, mod: ['amount', 1] },
];
const forgeCost = (f, lvl) => Math.round(f.cost * Math.pow(lvl + 1, 1.6) / 5) * 5;

// ── Úspěchy ─────────────────────────────────────────────────────────────────
// check(S, R): S = uložená data, R = aktuální běh (nebo null)
const ACHIEVEMENTS = [
  { id: 'k100', name: 'První krev', desc: 'Znič 100 nepřátel.', reward: 20, icon: 'skull', prog: S => [S.stats.kills, 100] },
  { id: 'k1000', name: 'Čistička', desc: 'Znič 1 000 nepřátel.', reward: 50, icon: 'skull', prog: S => [S.stats.kills, 1000], pilot: 'nyx' },
  { id: 'k10000', name: 'Vyhlazovatel', desc: 'Znič 10 000 nepřátel.', reward: 150, icon: 'skull', prog: S => [S.stats.kills, 10000] },
  { id: 'k50000', name: 'Pohroma', desc: 'Znič 50 000 nepřátel.', reward: 400, icon: 'skull', prog: S => [S.stats.kills, 50000] },
  { id: 'k250000', name: 'Konec civilizací', desc: 'Znič 250 000 nepřátel.', reward: 1200, icon: 'skull', prog: S => [S.stats.kills, 250000] },
  { id: 't5', name: 'Přeživší', desc: 'Přežij 5 minut v jednom běhu.', reward: 30, icon: 'clock', prog: S => [S.stats.bestTime, 300], pilot: 'orion' },
  { id: 't10', name: 'Houževnatý', desc: 'Přežij 10 minut v jednom běhu.', reward: 60, icon: 'clock', prog: S => [S.stats.bestTime, 600] },
  { id: 't25', name: 'Věčný', desc: 'Přežij 25 minut v jednom běhu (nekonečný režim).', reward: 600, icon: 'clock', prog: S => [S.stats.bestTime, 1500] },
  { id: 'boss1', name: 'Zabiják titánů', desc: 'Poraz bosse.', reward: 50, icon: 'boss', prog: S => [S.stats.bossKills, 1], pilot: 'titan' },
  { id: 'boss25', name: 'Lovec monarchů', desc: 'Poraz 25 bossů.', reward: 400, icon: 'boss', prog: S => [S.stats.bossKills, 25] },
  { id: 'clear1', name: 'Mlhovina vyčištěna', desc: 'Dokonči Sektor I.', reward: 100, icon: 'trophy', prog: S => [+!!(S.sectors.s1 && S.sectors.s1.cleared), 1], pilot: 'lumen' },
  { id: 'clear2', name: 'Pás prolomen', desc: 'Dokonči Sektor II.', reward: 200, icon: 'trophy', prog: S => [+!!(S.sectors.s2 && S.sectors.s2.cleared), 1] },
  { id: 'clear3', name: 'Smaragdový lovec', desc: 'Dokonči Sektor III.', reward: 350, icon: 'trophy', prog: S => [+!!(S.sectors.s3 && S.sectors.s3.cleared), 1], pilot: 'zero' },
  { id: 'clear4', name: 'Za horizontem', desc: 'Dokonči Sektor IV.', reward: 500, icon: 'trophy', prog: S => [+!!(S.sectors.s4 && S.sectors.s4.cleared), 1] },
  { id: 'clear5', name: 'Srdce zastaveno', desc: 'Dokonči Sektor V.', reward: 900, icon: 'trophy', prog: S => [+!!(S.sectors.s5 && S.sectors.s5.cleared), 1], pilot: 'omega' },
  { id: 'evo1', name: 'Metamorfóza', desc: 'Vyvij jakoukoli zbraň.', reward: 80, icon: 'star', prog: S => [Object.keys(S.evolutions).length, 1], pilot: 'echo' },
  { id: 'evo4', name: 'Alchymista', desc: 'Objev 4 různé evoluce.', reward: 220, icon: 'star', prog: S => [Object.keys(S.evolutions).length, 4] },
  { id: 'evo8', name: 'Architekt zkázy', desc: 'Objev všech 8 evolucí.', reward: 700, icon: 'star', prog: S => [Object.keys(S.evolutions).length, 8] },
  { id: 'lvl30', name: 'Nabitý', desc: 'Dosáhni úrovně 30 v jednom běhu.', reward: 60, icon: 'growth', prog: S => [S.stats.maxLevel, 30] },
  { id: 'lvl60', name: 'Přetížený', desc: 'Dosáhni úrovně 60 v jednom běhu.', reward: 250, icon: 'growth', prog: S => [S.stats.maxLevel, 60] },
  { id: 'od1', name: 'Overdrive', desc: 'Dokonči libovolný sektor na Overdrive 1.', reward: 120, icon: 'haste', prog: S => [S.stats.maxOdClear, 1] },
  { id: 'od5', name: 'Rudá zóna', desc: 'Dokonči libovolný sektor na Overdrive 5.', reward: 450, icon: 'haste', prog: S => [S.stats.maxOdClear, 5] },
  { id: 'od10', name: 'Za hranicí', desc: 'Dokonči libovolný sektor na Overdrive 10.', reward: 1500, icon: 'haste', prog: S => [S.stats.maxOdClear, 10] },
  { id: 'rich', name: 'Sběratel', desc: 'Nasbírej celkem 5 000 střepů.', reward: 250, icon: 'shard', prog: S => [S.stats.shardsTotal, 5000] },
  { id: 'forge1', name: 'Kovář', desc: 'Kup první vylepšení v Kovárně.', reward: 25, icon: 'forge', prog: S => [Object.values(S.forge).reduce((a, b) => a + b, 0), 1] },
  { id: 'forgeAll', name: 'Mistr kovář', desc: 'Kup 50 úrovní vylepšení v Kovárně.', reward: 600, icon: 'forge', prog: S => [Object.values(S.forge).reduce((a, b) => a + b, 0), 50] },
  { id: 'arsenal', name: 'Arzenál', desc: 'Měj v jednom běhu 6 zbraní najednou.', reward: 100, icon: 'pulse', prog: (S, R) => [R ? Math.max(S.stats.maxWeapons, R.weapons.length) : S.stats.maxWeapons, 6] },
  { id: 'untouch', name: 'Nedotknutelný', desc: 'Vydrž 3 minuty v kuse bez zásahu.', reward: 150, icon: 'armor', prog: S => [S.stats.bestNoHit, 180] },
  { id: 'massacre', name: 'Masakr', desc: 'Znič 250 nepřátel během 10 sekund.', reward: 200, icon: 'bomb', prog: S => [S.stats.bestBurst, 250] },
  { id: 'clean', name: 'Bez škrábnutí', desc: 'Poraz bosse, aniž by tě během souboje zasáhl.', reward: 250, icon: 'boss', prog: S => [S.stats.cleanBoss, 1] },
  { id: 'runs10', name: 'Veterán', desc: 'Odehraj 10 běhů.', reward: 50, icon: 'rocket', prog: S => [S.stats.runs, 10] },
  { id: 'runs50', name: 'Legenda', desc: 'Odehraj 50 běhů.', reward: 300, icon: 'rocket', prog: S => [S.stats.runs, 50] },
  { id: 'dash500', name: 'Akrobat', desc: 'Použij úskok 500krát.', reward: 60, icon: 'dash', prog: S => [S.stats.dashes, 500] },
  { id: 'pilots', name: 'Celá letka', desc: 'Odemkni všechny piloty.', reward: 500, icon: 'rocket', prog: S => [PILOTS.filter(p => !p.unlock || S.achievements[p.unlock]).length, PILOTS.length] },
];
