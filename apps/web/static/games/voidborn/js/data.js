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
  disc: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v3M20.5 12h-3M12 20.5v-3M3.5 12h3"/>',
  flame: '<path d="M12 21.5c-4 0-7-2.8-7-6.6 0-3.6 2.7-5.6 4-8.9 1.6 1.5 2.3 3 2.5 4.5 1.3-1.3 2-3.2 2-5.5 3.3 2.3 5.5 6 5.5 9.9 0 3.8-3 6.6-7 6.6z"/><path d="M12 21.5c-1.7 0-3-1.2-3-2.9 0-1.9 1.6-2.8 3-4.6 1.4 1.8 3 2.7 3 4.6 0 1.7-1.3 2.9-3 2.9z"/>',
  meteor: '<circle cx="8.5" cy="15.5" r="5"/><path d="M12 12l8.5-8.5M14.5 15l6-6M9 9.5l6-6"/>',
  shield: '<path d="M12 2.5l8 3v6c0 5-3.5 8.8-8 10.5-4.5-1.7-8-5.5-8-10.5v-6z"/><path d="M8 12l3 3 5-6"/>',
  critamp: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M7.5 12h9"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
  overcharge: '<path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5z"/><path d="M19.5 2.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z"/>',
  mutation: '<path d="M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/><path d="M8.5 6.5h7M8.5 17.5h7M10 12h4"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  hardpoint: '<path d="M3 5h18"/><path d="M8 5v4M16 5v4"/><rect x="6" y="9" width="12" height="5" rx="2.5"/><path d="M18 11.5h3M9 14l-1 5M15 14l1 5"/>',
  calib: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><path d="M9.5 12l1.8 1.8L15 10"/>',
  slots: '<rect x="2.5" y="7" width="7.5" height="10" rx="1.5"/><rect x="14" y="7" width="7.5" height="10" rx="1.5"/><path d="M17.75 10v4M15.75 12h4"/>',
  cards: '<rect x="2.5" y="5.5" width="7.5" height="12.5" rx="1.5"/><rect x="8.25" y="3.5" width="7.5" height="12.5" rx="1.5"/><rect x="14" y="6" width="7.5" height="12.5" rx="1.5"/>',
  headstart: '<path d="M4.5 21V3.5M4.5 4h11l-2.2 3.5 2.2 3.5h-11"/><path d="M15.5 21l4-4-4-4"/>',
  wind: '<path d="M3 8.5h11a3 3 0 10-3-3M3 12.5h15a3 3 0 11-3 3M3 16.5h7"/>',
  dashblast: '<path d="M12 4.5l7 7.5-7 7.5"/><path d="M2.5 8h7M1.5 12h9M2.5 16h7"/><path d="M21 7.5v9" stroke-dasharray="2 2"/>',
  dashcd: '<path d="M13 4.5l7 7.5-7 7.5"/><path d="M3 8h6M2 12h8M3 16h6"/><circle cx="6" cy="20" r="2.2"/><path d="M6 18.9V20l.8.6"/>',
  execute: '<path d="M4 20L15 9"/><path d="M13.5 3.5l7 7-3 3-7-7z"/><path d="M3 15l6 6"/>',
  bossbane: '<path d="M3 7l4 4 5-7 5 7 4-4-2 12H5z"/><path d="M12 10v5M9.5 12.5h5"/>',
  vortex: '<path d="M12 12m-1.5 0a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0"/><path d="M12 6.5a5.5 5.5 0 015.5 5.5M17.5 12a5.5 5.5 0 01-5.5 5.5M12 17.5A5.5 5.5 0 016.5 12M6.5 12A5.5 5.5 0 0112 6.5"/><path d="M12 2.5a9.5 9.5 0 019.5 9.5M2.5 12A9.5 9.5 0 0112 2.5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><path d="M4 20L20 4"/>',
  auto: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M8.5 10.5l2.5 2.5 4.5-5"/>',
  sentry: '<path d="M12 3l4 5-4 3-4-3z"/><path d="M5.5 13.5l3 3-3 3-3-3zM18.5 13.5l3 3-3 3-3-3z"/><path d="M12 11v4M8.5 16.5h7"/>',
  voidray: '<circle cx="4.5" cy="12" r="2.5"/><circle cx="19.5" cy="12" r="2.5"/><path d="M7 12h10M7.5 9.5l9.5 1M7.5 14.5l9.5-1"/>',
  cluster: '<circle cx="9.5" cy="13" r="5.5"/><path d="M13.5 9l2.5-2.5M16 4.5l1.5 1.5"/><circle cx="19" cy="13" r="1.6"/><circle cx="16.5" cy="19.5" r="1.6"/><circle cx="21" cy="18" r="1.1"/>',
  infinity: '<path d="M7 8.5c-2 0-3.5 1.6-3.5 3.5S5 15.5 7 15.5c3.5 0 6.5-7 10-7 2 0 3.5 1.6 3.5 3.5s-1.5 3.5-3.5 3.5c-3.5 0-6.5-7-10-7z"/>',
  crown: '<path d="M3 8.5l4.5 4L12 5.5l4.5 7 4.5-4-1.8 10H4.8z"/><circle cx="12" cy="14.5" r="1.6"/><path d="M5 21h14"/>',
  echo: '<path d="M4 13a8 8 0 0116 0"/><path d="M7 13a5 5 0 0110 0"/><circle cx="12" cy="13" r="1.8"/><path d="M12 15v6"/>',
  zone: '<circle cx="12" cy="12" r="9.5" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
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
  // Zbraně pro pokročilé: odemknou se úspěchem (unlock).
  disc: {
    name: 'Odrazový disk', color: '#7cffcb', icon: 'disc', unlock: 'clear1',
    desc: 'Zářivý disk se odráží od nepřítele k nepříteli.',
    base: { dmg: 16, cd: 1.5, amount: 1, speed: 560, bounce: 3, area: 1 },
    up: [
      [{ bounce: 1 }, '+1 odraz'], [{ dmg: 7 }, '+7 poškození'], [{ amount: 1 }, '+1 disk'],
      [{ cd: -0.3 }, 'Rychlejší hod'], [{ bounce: 2 }, '+2 odrazy'], [{ dmg: 12 }, '+12 poškození'],
      [{ amount: 1, bounce: 1 }, '+1 disk, +1 odraz'],
    ],
    evo: 'quantum', evoWith: 'luck',
  },
  plasma: {
    name: 'Plazmový hořák', color: '#ff8a3d', icon: 'flame', unlock: 'clear2',
    desc: 'Kužel plazmy spaluje vše před lodí. Krátký dosah, obrovské poškození.',
    base: { dmg: 3, cd: 0.15, amount: 1, range: 150, arc: 0.9, area: 1 },
    up: [
      [{ dmg: 2 }, '+2 poškození'], [{ arc: 0.25 }, 'Širší kužel'], [{ range: 35 }, 'Delší plamen'],
      [{ dmg: 3 }, '+3 poškození'], [{ cd: -0.03 }, 'Rychlejší hoření'], [{ dmg: 3, range: 20 }, '+3 poškození, delší plamen'],
      [{ amount: 1 }, 'Druhý plamen'],
    ],
    evo: 'comet', evoWith: 'speed',
  },
  meteor: {
    name: 'Orbitální úder', color: '#ff5d73', icon: 'meteor', unlock: 'evo4',
    desc: 'Z oběžné dráhy dopadají střely do největších shluků nepřátel.',
    base: { dmg: 55, cd: 2.6, amount: 1, area: 1, delay: 0.7 },
    up: [
      [{ amount: 1 }, '+1 úder'], [{ dmg: 25 }, '+25 poškození'], [{ area: 0.25 }, 'Větší dopad'],
      [{ amount: 1 }, '+1 úder'], [{ cd: -0.5 }, 'Rychlejší nabíjení'], [{ dmg: 40 }, '+40 poškození'],
      [{ amount: 2 }, '+2 údery'],
    ],
    evo: 'starfall', evoWith: 'critamp',
  },
  // Zbraně pro konec hry: odemkne je plán z Mistrovských děl v Kovárně (forge = id položky).
  sentry: {
    name: 'Strážní drony', color: '#7df9ff', icon: 'sentry', forge: 'bp_sentry',
    desc: 'Drony kroužící kolem lodi samy střílí po nejbližších nepřátelích.',
    base: { dmg: 10, cd: 0.85, amount: 2, speed: 720, range: 380, pierce: 0, area: 1 },
    up: [
      [{ amount: 1 }, '+1 dron'], [{ dmg: 5 }, '+5 poškození'], [{ cd: -0.15 }, 'Rychlejší palba'],
      [{ range: 80, pierce: 1 }, 'Delší dosah, průraz +1'], [{ amount: 1 }, '+1 dron'], [{ dmg: 8 }, '+8 poškození'],
      [{ amount: 1, cd: -0.1 }, '+1 dron, rychlejší palba'],
    ],
    evo: 'armada', evoWith: 'shield',
  },
  voidray: {
    name: 'Paprsek prázdnoty', color: '#c77dff', icon: 'voidray', forge: 'bp_voidray',
    desc: 'Paprsek se přisaje k nepříteli a pálí tím víc, čím déle ho drží.',
    base: { dmg: 2.5, cd: 0.1, amount: 1, range: 320, ramp: 0.1, rampMax: 4, area: 1 },
    up: [
      [{ dmg: 1.5 }, '+1,5 poškození'], [{ range: 70 }, 'Delší dosah'], [{ amount: 1 }, '+1 paprsek'],
      [{ ramp: 0.06 }, 'Rychlejší rozžhavení'], [{ dmg: 2 }, '+2 poškození'], [{ amount: 1 }, '+1 paprsek'],
      [{ rampMax: 2, dmg: 1.5 }, 'Vyšší strop žáru, +1,5 poškození'],
    ],
    evo: 'devourer', evoWith: 'critamp',
  },
  cluster: {
    name: 'Kaskáda', color: '#ffb347', icon: 'cluster', forge: 'bp_cluster',
    desc: 'Bomba dopadne do hloučku nepřátel a rozprskne se na menší nálože.',
    base: { dmg: 34, cd: 2.3, amount: 1, area: 1, frag: 4 },
    up: [
      [{ frag: 2 }, '+2 nálože'], [{ dmg: 16 }, '+16 poškození'], [{ amount: 1 }, '+1 bomba'],
      [{ area: 0.2 }, 'Větší výbuchy'], [{ cd: -0.4 }, 'Rychlejší nabíjení'], [{ dmg: 24 }, '+24 poškození'],
      [{ amount: 1, frag: 2 }, '+1 bomba, +2 nálože'],
    ],
    evo: 'chainreact', evoWith: 'area',
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
  quantum: {
    name: 'Kvantový disk', color: '#c6fff0', icon: 'disc', evolved: true, from: 'disc',
    desc: 'Disky se odrážejí skoro bez konce a s každým odrazem sílí.',
    base: { dmg: 28, cd: 0.9, amount: 3, speed: 720, bounce: 9, area: 1.25, grow: 0.06 },
  },
  comet: {
    name: 'Kometa', color: '#ffd27a', icon: 'flame', evolved: true, from: 'plasma',
    desc: 'Široký plamen a ohnivá stopa za lodí. Čím rychleji letíš, tím víc pálí.',
    base: { dmg: 16, cd: 0.1, amount: 2, range: 225, arc: 1.5, area: 1, trail: 1 },
  },
  starfall: {
    name: 'Hvězdný pád', color: '#ffe3ea', icon: 'meteor', evolved: true, from: 'meteor',
    desc: 'Déšť hvězd, které vždy zasáhnou kriticky.',
    base: { dmg: 70, cd: 1.15, amount: 5, area: 1.35, delay: 0.45, crit: 1 },
  },
  armada: {
    name: 'Armáda', color: '#d4fdff', icon: 'sentry', evolved: true, from: 'sentry',
    desc: 'Celá letka dronů pálí dvojité průrazné střely ze všech stran.',
    base: { dmg: 22, cd: 0.32, amount: 6, speed: 980, range: 520, pierce: 2, area: 1, twin: 1 },
  },
  devourer: {
    name: 'Pohlcovač', color: '#f0c8ff', icon: 'voidray', evolved: true, from: 'voidray',
    desc: 'Paprsky přeskakují na další nepřátele a rozžhaví se až na desetinásobek.',
    base: { dmg: 7, cd: 0.1, amount: 4, range: 430, ramp: 0.3, rampMax: 10, area: 1, chain: 2 },
  },
  chainreact: {
    name: 'Řetězová reakce', color: '#ffe0a0', icon: 'cluster', evolved: true, from: 'cluster',
    desc: 'Každá nálož se rozprskne znovu. Celé bojiště v plamenech.',
    base: { dmg: 60, cd: 1.3, amount: 3, area: 1.2, frag: 6, gen: 2 },
  },
};
const BASE_WEAPONS = ['pulse', 'orbit', 'arc', 'seeker', 'nova', 'lance', 'mines', 'aura', 'disc', 'plasma', 'meteor', 'sentry', 'voidray', 'cluster'];
const EVOLUTIONS = BASE_WEAPONS.map(id => WEAPONS[id].evo);
// Zbraně a doplňky pro pokročilé se odemykají úspěchem (unlock); seznam úspěchů ukazuje, co odemyká.
// Zbraně pro konec hry odemyká plán koupený v Kovárně (forge).
const unlocked = o => (o.forge ? (SAVE.forge[o.forge] || 0) > 0 : !o.unlock || !!SAVE.achievements[o.unlock]);
// Přetížení evolučních zbraní: úrovně ★1–★4 za level-upy po evoluci.
const OC_MAX = 4, OC_DMG = 0.25, OC_CD = 0.05;
// Pancíř: každý bod sníží zbylé zranění o 7 % (z aktuální hodnoty, takže nikdy nedosáhne 100 %).
const ARMOR_STEP = 0.07;
const armorFactor = a => Math.pow(1 - ARMOR_STEP, Math.max(0, a));
const BASE_SLOTS = 6;

// ── Doplňky (pasivní) ───────────────────────────────────────────────────────
const PASSIVES = {
  might: { name: 'Jádro síly', icon: 'might', color: '#ff6b6b', desc: '+10 % poškození', max: 5, mod: { might: 0.10 } },
  haste: { name: 'Přetaktování', icon: 'haste', color: '#ffd166', desc: '−8 % doba nabíjení', max: 5, mod: { cdMul: -0.08 } },
  area: { name: 'Gyroskop', icon: 'area', color: '#06d6a0', desc: '+10 % oblast účinku', max: 5, mod: { area: 0.10 } },
  speed: { name: 'Trysky', icon: 'speed', color: '#4cc9f0', desc: '+8 % rychlost pohybu', max: 5, mod: { speed: 0.08 } },
  armor: { name: 'Pancéřování', icon: 'armor', color: '#a0a6ff', desc: '+1 pancíř (−7 % zranění), +12 max. zdraví', max: 5, mod: { armor: 1, maxHp: 12 } },
  magnet: { name: 'Gravitační cívka', icon: 'magnet', color: '#f72585', desc: '+30 % dosah sběru', max: 5, mod: { magnet: 0.30 } },
  duration: { name: 'Fokusační čočka', icon: 'duration', color: '#b8f2e6', desc: '+10 % trvání a rychlost střel', max: 5, mod: { dur: 0.10, projSpd: 0.10 } },
  regen: { name: 'Nanoboti', icon: 'regen', color: '#80ffdb', desc: '+0,3 regenerace zdraví/s', max: 5, mod: { regen: 0.3 } },
  luck: { name: 'Kvantová kostka', icon: 'luck', color: '#cdb4db', desc: '+10 % štěstí, +4 % kritický zásah', max: 5, mod: { luck: 0.10, crit: 0.04 } },
  amount: { name: 'Duplikátor', icon: 'amount', color: '#ffbe0b', desc: '+1 projektil všech zbraní', max: 2, mod: { amount: 1 }, rare: true },
  critamp: { name: 'Kritický zesilovač', icon: 'critamp', color: '#ff9e3d', desc: '+25 % kritické poškození, +3 % kritický zásah', max: 5, mod: { critDmg: 0.25, crit: 0.03 }, unlock: 'evo1' },
  shield: { name: 'Energetický štít', icon: 'shield', color: '#7df9ff', desc: 'Pohltí jeden celý zásah. Dobití 30 s, každá další úroveň o 4 s rychleji.', max: 5, mod: { shield: 1 }, unlock: 'boss1', noPer: true },
};
const shieldCd = lvl => (lvl > 0 ? 34 - 4 * lvl : 0);

// Mutace: drobná posílení, když už není co vylepšovat (pozdní hra a nekonečný režim). Každá nejvýš
// MUT_MAX krát: bez stropu hráč v nekonečnu přerostl prázdnotu a mutace chamtivosti sypala statisíce střepů.
const MUT_MAX = 10;
const MUTATIONS = {
  might: { name: 'Mutace síly', icon: 'might', color: '#ff6b6b', desc: '+4 % poškození', mod: { might: 0.04 } },
  vigor: { name: 'Mutace odolnosti', icon: 'vitality', color: '#5dffa8', desc: '+10 max. zdraví (a hned je doplní)', mod: { maxHp: 10 } },
  haste: { name: 'Mutace rychlosti', icon: 'haste', color: '#ffd166', desc: '−3 % doba nabíjení', mod: { cdMul: -0.03 } },
  area: { name: 'Mutace dosahu', icon: 'area', color: '#06d6a0', desc: '+4 % oblast účinku', mod: { area: 0.04 } },
  crit: { name: 'Mutace přesnosti', icon: 'crit', color: '#ff9e3d', desc: '+2 % kritický zásah, +10 % kritické poškození', mod: { crit: 0.02, critDmg: 0.10 } },
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
  // ── Druhy z verze 1.4 (chování v foes.js) ──
  // pohyb
  orbiter: { shape: 'ring', color: '#7cf3ff', r: 13, hp: 16, speed: 122, dmg: 8, xp: 2, ai: 'orbit' },
  weaver: { shape: 'chevron', color: '#ffb3f0', r: 12, hp: 13, speed: 116, dmg: 8, xp: 1, ai: 'weave', face: 1 },
  blinker: { shape: 'bolt', color: '#c58bff', r: 14, hp: 22, speed: 64, dmg: 12, xp: 3, ai: 'blink' },
  ram: { shape: 'kite', color: '#ff7a45', r: 20, hp: 74, speed: 48, top: 270, dmg: 19, xp: 5, mass: 4, ai: 'ram', faceA: 1 },
  scorcher: { shape: 'drop', color: '#ff5a1f', r: 13, hp: 24, speed: 150, dmg: 9, xp: 2, ai: 'trail', face: 1, fire: 7 },
  shade: { shape: 'crescent', color: '#9aa3ff', r: 14, hp: 20, speed: 108, dmg: 12, xp: 2, cloak: 1, spin: 0.4 },
  berserker: { shape: 'star6', color: '#ff3b6b', r: 16, hp: 48, speed: 78, dmg: 13, xp: 3, ai: 'rage', spin: 1.6 },
  // střelci
  marksman: { shape: 'lens', color: '#ff2a6d', r: 14, hp: 18, speed: 70, dmg: 8, xp: 3, ai: 'snipe', faceP: 1, shot: 17, noHorde: 1 },
  scatter: { shape: 'trefoil', color: '#ffb347', r: 15, hp: 26, speed: 76, dmg: 8, xp: 2, ranged: { cd: 3.1, range: 310, spd: 250, dmg: 7, n: 5, spread: 0.24 } },
  pulsar: { shape: 'gear', color: '#ffe66d', r: 17, hp: 40, speed: 46, dmg: 10, xp: 4, ai: 'pulse', spin: 0.6, burst: 10, bulletDmg: 8, noHorde: 1 },
  mortar: { shape: 'hourglass', color: '#ff9f1c', r: 16, hp: 34, speed: 55, dmg: 10, xp: 4, ai: 'mortar', spin: 0.5, shell: 20, noHorde: 1 },
  rocketeer: { shape: 'pent', color: '#b8f2e6', r: 16, hp: 30, speed: 66, dmg: 10, xp: 4, ai: 'launch', spin: 0.7, noHorde: 1 },
  rocket: { shape: 'kite', color: '#ff5d5d', r: 7, hp: 4, speed: 175, dmg: 15, xp: 0, ai: 'homing', faceA: 1, sub: 1, parent: 'rocketeer', noDrop: 1, mass: 0.4 },
  // podpora
  medic: { shape: 'cross', color: '#7dff7a', r: 15, hp: 30, speed: 76, dmg: 8, xp: 4, ai: 'medic', spin: 0.5, noHorde: 1 },
  aegis: { shape: 'hept', color: '#5ad1ff', r: 17, hp: 38, speed: 68, dmg: 10, xp: 4, ai: 'aegis', spin: 0.5, aura: 170, noHorde: 1 },
  commander: { shape: 'star5', color: '#ffd23f', r: 17, hp: 44, speed: 70, dmg: 11, xp: 5, ai: 'command', spin: 0.6, aura: 210, noHorde: 1 },
  // odolní
  plated: { shape: 'squircle', color: '#c0c6d8', r: 18, hp: 56, speed: 58, dmg: 14, xp: 4, mass: 2.5, plate: 3 },
  phaser: { shape: 'blob', color: '#d6a2e8', r: 14, hp: 24, speed: 96, dmg: 11, xp: 3, ai: 'phase', spin: 1 },
  bulwark: { shape: 'shield', color: '#8ecae6', r: 18, hp: 50, speed: 62, dmg: 14, xp: 4, mass: 3, ai: 'bulwark', faceA: 1 },
  // rozpad a potomci
  carrier: { shape: 'saucer', color: '#e07a5f', r: 24, hp: 92, speed: 40, dmg: 14, xp: 6, mass: 5, ai: 'carrier', spin: 0.35, noHorde: 1 },
  larva: { shape: 'dart', color: '#f2cc8f', r: 6, hp: 4, speed: 168, dmg: 4, xp: 0.4, mass: 0.3, sub: 1, parent: 'carrier' },
  shrapnel: { shape: 'spikeball', color: '#f4a261', r: 15, hp: 28, speed: 84, dmg: 10, xp: 3, spin: 1.4, burstN: 8 },
  hydra: { shape: 'clover', color: '#2ec4b6', r: 19, hp: 44, speed: 70, dmg: 11, xp: 2, split: 'hydra2', splitN: 2, spin: 0.7 },
  hydra2: { shape: 'clover', color: '#2ec4b6', r: 14, hp: 20, speed: 92, dmg: 8, xp: 1.5, split: 'hydra3', splitN: 2, spin: 1, sub: 1, parent: 'hydra' },
  hydra3: { shape: 'clover', color: '#2ec4b6', r: 9, hp: 9, speed: 118, dmg: 6, xp: 1, mass: 0.6, spin: 1.4, sub: 1, parent: 'hydra' },
  minelayer: { shape: 'spike4', color: '#ffb703', r: 15, hp: 34, speed: 88, dmg: 10, xp: 4, ai: 'layer', spin: 1.2, mineDmg: 18, noHorde: 1 },
  emine: { shape: 'star', color: '#ff006e', r: 8, hp: 3, speed: 0, dmg: 0, xp: 0, ai: 'mine', spin: 2, sub: 1, parent: 'minelayer', noDrop: 1, mass: 99 },
  // ovládání
  frost: { shape: 'snow', color: '#a9def9', r: 15, hp: 30, speed: 84, dmg: 8, xp: 3, ai: 'frost', spin: 0.8, aura: 160 },
  gravitar: { shape: 'pinwheel', color: '#9b5de5', r: 18, hp: 64, speed: 44, dmg: 12, xp: 5, mass: 6, ai: 'grav', spin: 2.2, aura: 330, noHorde: 1 },
  leech: { shape: 'capsule', color: '#80ed99', r: 11, hp: 18, speed: 150, dmg: 4, xp: 2, mass: 0.5, ai: 'leech', face: 1 },
  scavenger: { shape: 'maw', color: '#d4a373', r: 15, hp: 40, speed: 100, dmg: 9, xp: 2, ai: 'scav', faceA: 1 },
  twin: { shape: 'trap', color: '#f15bb5', r: 14, hp: 30, speed: 92, dmg: 10, xp: 3, ai: 'twin', faceA: 1, tether: 12, noHorde: 1 },
};
// Potomci a projektily (rakety, miny, larvy, hydry) se do bestiáře počítají rodiči.
const ENEMY_KINDS = Object.keys(ENEMIES).filter(k => !ENEMIES[k].sub && k !== 'mini');
const enemyKind = k => (k === 'mini' ? 'splitter' : ENEMIES[k].parent || k);

// Skladba vln: [od minuty, váhy typů]
const WAVES = [
  [0, { drone: 10 }],
  [1, { drone: 8, swarmer: 4 }],
  [2, { drone: 6, swarmer: 5, splitter: 2, weaver: 1 }],
  [3, { drone: 5, swarmer: 4, brute: 2, shooter: 2, weaver: 2 }],
  [4.5, { swarmer: 6, brute: 2, shooter: 3, dasher: 2, drone: 3, weaver: 1 }],
  [6, { drone: 4, splitter: 4, dasher: 3, exploder: 2, brute: 2, weaver: 2 }],
  [8, { swarmer: 6, shooter: 3, exploder: 3, tank: 1, wisp: 4, orbiter: 1, hydra: 1 }],
  [10, { wisp: 6, brute: 3, dasher: 4, splitter: 3, tank: 1, hydra: 2, orbiter: 2 }],
  [12, { exploder: 4, shooter: 4, tank: 2, wisp: 6, dasher: 3, brute: 2, hydra: 2, weaver: 2 }],
  [13.5, { drone: 3, swarmer: 4, brute: 3, shooter: 4, splitter: 3, dasher: 4, exploder: 4, tank: 2, wisp: 5, hydra: 2, orbiter: 2 }],
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
    hp: 1, dmg: 1, spawn: 1, shards: 1, bosses: ['warden', 'hive', 'monarch'], roster: {}, favor: {}, desc: 'Kde to všechno začalo. Prázdnota tu teprve otevírá oči.' },
  { id: 's2', name: 'Rudý pás', roman: 'II', bg: ['#200608', '#080102'], neb: ['#ff2a3a', '#ff7a1a', '#7a0b2c'], grid: '#ff4d4d', accent: '#ff9a3c',
    hp: 1.7, dmg: 1.25, spawn: 1.12, shards: 1.6, bosses: ['reaper', 'colossus', 'monarch'], roster: { berserker: [2, 2], ram: [3, 2], scatter: [4, 2], scorcher: [5, 2], shrapnel: [6, 2], blinker: [7, 2] }, favor: { dasher: 3, exploder: 2 }, desc: 'Roztavené trosky starých flotil. Nepřátelé útočí bez varování.' },
  { id: 's3', name: 'Smaragdová prázdnota', roman: 'III', bg: ['#03160f', '#010604'], neb: ['#00e38c', '#00b3ff', '#0b5c3c'], grid: '#2bffa8', accent: '#4dff9a',
    hp: 2.6, dmg: 1.5, spawn: 1.22, shards: 2.4, bosses: ['hive', 'warden', 'monarch'], roster: { hydra: [2, 3], scavenger: [3, 2], leech: [4, 2], carrier: [5, 2], medic: [7, 1] }, favor: { splitter: 4, wisp: 3 }, desc: 'Živá hmota, která se dělí a množí. Rychlost je vším.' },
  { id: 's4', name: 'Zlatý horizont', roman: 'IV', bg: ['#1c1203', '#070401'], neb: ['#ffb300', '#ff6a00', '#5c3b00'], grid: '#ffc94d', accent: '#ffe14d',
    hp: 3.8, dmg: 1.8, spawn: 1.32, shards: 3.4, bosses: ['colossus', 'reaper', 'monarch'], roster: { scatter: [2, 3], marksman: [3, 2], bulwark: [4, 2], pulsar: [5, 2], mortar: [6, 2], rocketeer: [8, 1] }, favor: { shooter: 4, tank: 2 }, desc: 'Okraj horizontu událostí. Střely létají ze všech stran.' },
  { id: 's5', name: 'Srdce prázdnoty', roman: 'V', bg: ['#0a0a14', '#000000'], neb: ['#ffffff', '#9d7bff', '#2e1a66'], grid: '#d4c4ff', accent: '#ffffff',
    hp: 5.4, dmg: 2.2, spawn: 1.45, shards: 4.8, bosses: ['reaper', 'colossus', 'monarch'], roster: { shade: [2, 2], phaser: [3, 2], frost: [4, 2], gravitar: [5, 1], twin: [6, 1], commander: [7, 1], aegis: [8, 1] }, favor: { exploder: 3, tank: 3, wisp: 4 }, desc: 'Konec všeho. Nikdo se odsud nevrátil.' },
  // Anomálie: sektory s vlastním pravidlem, odemknou se dobytím sektoru req.
  { id: 's6', name: 'Meteorický roj', roman: 'VI', req: 's2', meteors: true, bg: ['#160c05', '#050201'], neb: ['#ff7a1a', '#ffcf6b', '#6b3a1a'], grid: '#ffb36b', accent: '#ffb36b',
    hp: 2.2, dmg: 1.35, spawn: 1.1, shards: 2.6, bosses: ['colossus', 'reaper', 'monarch'], roster: { plated: [2, 2], ram: [3, 2], bulwark: [4, 2], minelayer: [5, 2], mortar: [6, 1] }, favor: { brute: 2, tank: 1 }, desc: 'Pásem trosek prolétají meteority. Varovná čára ukáže, kudy poletí: uhni, nebo jím rozdrť hordu.' },
  { id: 's7', name: 'Monokultura', roman: 'VII', req: 's3', mono: true, bg: ['#04161a', '#010506'], neb: ['#00ffd5', '#7cffcb', '#0b4c5c'], grid: '#4dffe1', accent: '#7cffcb',
    hp: 3.0, dmg: 1.55, spawn: 1.25, shards: 3.2, bosses: ['hive', 'warden', 'monarch'], roster: {}, favor: {}, desc: 'Jediný druh nepřítele, zato v obrovském počtu. Každé dvě a půl minuty se prázdnota přepne na jiný.' },
  { id: 's8', name: 'Horizont událostí', roman: 'VIII', req: 's4', well: true, bg: ['#0c0618', '#000000'], neb: ['#7b3cff', '#ff4fd8', '#1a0b3c'], grid: '#a07bff', accent: '#c58bff',
    hp: 4.4, dmg: 1.9, spawn: 1.3, shards: 4.2, bosses: ['reaper', 'colossus', 'monarch'], roster: { orbiter: [2, 3], gravitar: [3, 2], blinker: [4, 2], frost: [5, 2], phaser: [6, 2] }, favor: { wisp: 3, swarmer: 2 }, desc: 'Bloudící černá díra tě táhne k sobě a plíží se za tebou. Nepřátele, které pohltí, rozdrtí.' },
  { id: 's9', name: 'Temnota', roman: 'IX', req: 's5', dark: true, bg: ['#050508', '#000000'], neb: ['#3a3a6c', '#6c3a6c', '#1a1a2e'], grid: '#6b6b9b', accent: '#b0b8ff',
    hp: 6.2, dmg: 2.4, spawn: 1.45, shards: 6, bosses: ['warden', 'colossus', 'monarch'], roster: { shade: [2, 3], leech: [3, 2], marksman: [4, 2], shrapnel: [4, 2], blinker: [5, 2] }, favor: { wisp: 4, dasher: 2, exploder: 2 }, desc: 'Světlo sahá jen kousek kolem lodi. Co je za ním, poznáš až po zásahu.' },
  // Hlubiny: sektory pro konec hry, otevírají se jeden po druhém od Sektoru IX.
  { id: 's10', name: 'Aréna titánů', roman: 'X', req: 's9', deep: true, rush: true, bossTimes: [150, 300, 450, 600, 750, 900], bg: ['#1a0610', '#060103'], neb: ['#ff2f6d', '#ffb13c', '#5c0b2c'], grid: '#ff6b9b', accent: '#ff6b9b',
    hp: 7.2, dmg: 2.7, spawn: 1.35, shards: 8, bosses: ['warden', 'hive', 'colossus', 'reaper', 'colossus', 'monarch'], roster: { plated: [2, 2], commander: [3, 2], aegis: [3, 2], medic: [4, 2], berserker: [4, 2], bulwark: [5, 2] }, favor: { brute: 2, tank: 2 }, desc: 'Bossové přilétají každé dvě a půl minuty a elity chodí dvakrát častěji. Přežij celou přehlídku.' },
  { id: 's11', name: 'Kolaps', roman: 'XI', req: 's10', deep: true, zone: true, bg: ['#120318', '#040006'], neb: ['#b14dff', '#ff4fd8', '#2a0b4c'], grid: '#d27bff', accent: '#e08bff',
    hp: 8.6, dmg: 3.0, spawn: 1.5, shards: 10, bosses: ['reaper', 'warden', 'monarch'], roster: { scorcher: [2, 2], weaver: [2, 2], frost: [3, 2], minelayer: [3, 2], gravitar: [4, 2], mortar: [6, 1] }, favor: { swarmer: 3, wisp: 3, dasher: 2 }, desc: 'Bezpečná zóna se pravidelně smršťuje a stěhuje jinam. Mimo ni tě prázdnota rozkládá.' },
  { id: 's12', name: 'Konec všeho', roman: 'XII', req: 's11', deep: true, meteors: true, well: true, dark: true, bg: ['#0a0a0a', '#000000'], neb: ['#ff4d5e', '#7b3cff', '#1a0b1a'], grid: '#ff7a8a', accent: '#ff4d5e',
    hp: 10.5, dmg: 3.4, spawn: 1.6, shards: 13, bosses: ['colossus', 'reaper', 'monarch'], roster: { twin: [3, 2], phaser: [3, 2], scavenger: [3, 2], hydra: [3, 2], pulsar: [4, 2], shrapnel: [4, 2], rocketeer: [5, 2], marksman: [5, 1] }, favor: { exploder: 3, tank: 3, wisp: 3 }, desc: 'Meteority, černá díra i tma najednou. Dál už žádná cesta nevede.' },
];
const BASE_SECTORS = 5;
// Monokultura: druhy, které se střídají, a jak hustě chodí (velcí méně, drobní víc).
const MONO_TYPES = { swarmer: 2.2, drone: 1.6, wisp: 2.4, dasher: 1.0, splitter: 0.9, exploder: 1.1, brute: 0.6, shooter: 0.9,
  weaver: 1.6, orbiter: 1.2, scorcher: 0.9, leech: 1.3, hydra: 0.7, berserker: 0.8, shade: 1.2, blinker: 0.8, phaser: 1.0, ram: 0.5 };
const MONO_PERIOD = 150;
const MAX_OD = 10;
const BOSS_TIMES = [300, 600, 900];
// Kolaps: bezpečná zóna (klid, smršťování, držení, rozšíření; délky v sekundách).
const ZONE = { big: 1250, calm: 35, shrink: 12, hold: 22, grow: 6 };
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
// Kovárna je 3D model lodi (forge3d.js): každé vylepšení patří jedné části lodi (part).
// view = [otočení, náklon] kamery, ze kterého je část nejlépe vidět (otočení −π/2 = zepředu, 0 = zleva, π/2 = zezadu).
const PARTS = [
  { id: 'guns', name: 'Děla', icon: 'might', color: '#ff6b6b', view: [-1.1, 0.25], desc: 'Hlavně na přídi: poškození, kritické zásahy a lov elit.' },
  { id: 'cockpit', name: 'Kokpit', icon: 'cards', color: '#d4a8ff', view: [-0.85, 0.72], desc: 'Navigační počítač: štěstí, přehození, víc karet a mutace.' },
  { id: 'reactor', name: 'Reaktor', icon: 'haste', color: '#ffd166', view: [0.6, 0.9], desc: 'Srdce lodi: nabíjení, dosah, trvání a evoluce zbraní.' },
  { id: 'hull', name: 'Trup', icon: 'armor', color: '#a0a6ff', view: [-0.15, 0.2], desc: 'Pancéřování a podpora života: zdraví, pancíř, regenerace, oživení.' },
  { id: 'wings', name: 'Sběrná křídla', icon: 'magnet', color: '#06d6a0', view: [-0.6, 1.1], desc: 'Magnetické plachty: dosah sběru, zkušenosti, střepy a kořist.' },
  { id: 'engines', name: 'Motory', icon: 'speed', color: '#4cc9f0', view: [1.0, 0.25], desc: 'Trysky na zádi: rychlost a úskoky.' },
  { id: 'bay', name: 'Zbrojnice', icon: 'slots', color: '#ffbe0b', view: [-0.8, -0.55], desc: 'Závěsníky a sklad: místa pro zbraně, výzbroj do běhu a plány nových zbraní.' },
];
const P_INDEX = Object.fromEntries(PARTS.map(p => [p.id, p]));
// tier: 0 = základ, 2 = Mistrovská (otevře dobytí Sektoru II), 3 = Prázdnotová, 4 = Věčná (bez stropu,
// každá úroveň o grow× dražší), 5 = Mistrovské dílo (3–5 otevře dobytí Sektoru V).
// tiers / costs: vylepšení, jehož úrovně patří do různých dílen (každá úroveň má svou dílnu a cenu).
const FORGE = [
  // Děla
  { id: 'might', part: 'guns', name: 'Síla', icon: 'might', desc: '+5 % poškození', max: 5, cost: 60, mod: { might: 0.05 } },
  { id: 'crit', part: 'guns', name: 'Precizita', icon: 'crit', desc: '+2 % kritický zásah', max: 5, cost: 90, mod: { crit: 0.02 } },
  { id: 'amount', part: 'guns', name: 'Duplikátor', icon: 'amount', desc: '+1 projektil všech zbraní', max: 1, cost: 2400, mod: { amount: 1 } },
  { id: 'critamp', part: 'guns', tier: 2, name: 'Kritický zesilovač', icon: 'critamp', desc: '+15 % kritické poškození', max: 5, cost: 400, mod: { critDmg: 0.15 } },
  { id: 'bossbane', part: 'guns', tier: 2, name: 'Lovec obrů', icon: 'bossbane', desc: '+10 % poškození bossům a elitám', max: 5, cost: 450, mod: { bossDmg: 0.10 } },
  { id: 'execute', part: 'guns', tier: 2, name: 'Popravčí', icon: 'execute', desc: 'Běžní nepřátelé pod 5 % zdraví (za úroveň) rovnou zemřou', max: 3, cost: 900, mod: { execute: 0.05 } },
  { id: 'e_might', part: 'guns', tier: 4, name: 'Věčná síla', icon: 'might', desc: '+5 % poškození', max: Infinity, cost: 6000, grow: 1.25, mod: { might: 0.05 } },
  { id: 'e_crit', part: 'guns', tier: 4, name: 'Věčná přesnost', icon: 'crit', desc: '+1 % kritický zásah, +6 % kritické poškození', max: Infinity, cost: 7000, grow: 1.25, mod: { crit: 0.01, critDmg: 0.06 } },
  // Kokpit
  { id: 'luck', part: 'cockpit', name: 'Štěstí', icon: 'luck', desc: '+6 % štěstí', max: 5, cost: 80, mod: { luck: 0.06 } },
  { id: 'reroll', part: 'cockpit', name: 'Přehození', icon: 'reroll', desc: '+1 přehození za běh', max: 5, cost: 70, mod: { rerolls: 1 } },
  { id: 'skip', part: 'cockpit', name: 'Přeskočení', icon: 'skip', desc: '+1 přeskočení za běh', max: 3, cost: 60, mod: { skips: 1 } },
  { id: 'cards', part: 'cockpit', tiers: [2, 3], costs: [4500, 9000], name: 'Široký výběr', icon: 'cards', desc: 'Při postupu vždy o kartu víc', max: 2, mod: { cards: 1 } },
  { id: 'deepmut', part: 'cockpit', tier: 3, name: 'Hluboká mutace', icon: 'mutation', desc: 'Strop každé mutace +5', max: 2, cost: 4000, mod: { mutMax: 5 } },
  { id: 'voidwill', part: 'cockpit', tier: 3, name: 'Vůle prázdnoty', icon: 'clock', desc: 'V nekonečnu sílí nepřátelé o 25 % pomaleji', max: 2, cost: 5000, mod: { voidWill: 0.25 } },
  { id: 'echo', part: 'cockpit', tier: 5, name: 'Ozvěna', icon: 'echo', desc: '25 % šance, že postup dá navíc i druhou nejlepší kartu', max: 2, cost: 30000, mod: { echo: 0.25 } },
  // Reaktor
  { id: 'haste', part: 'reactor', name: 'Přetaktování', icon: 'haste', desc: '−3 % nabíjení', max: 4, cost: 110, mod: { cdMul: -0.03 } },
  { id: 'area', part: 'reactor', name: 'Dosah', icon: 'area', desc: '+5 % oblast účinku', max: 4, cost: 90, mod: { area: 0.05 } },
  { id: 'duration', part: 'reactor', name: 'Stabilizace', icon: 'duration', desc: '+5 % trvání a rychlost střel', max: 4, cost: 80, mod: { dur: 0.05, projSpd: 0.05 } },
  { id: 'evomaster', part: 'reactor', tier: 2, name: 'Mistr evoluce', icon: 'star', desc: 'Zbraně se vyvinou už na úrovni 7', max: 1, cost: 3500, mod: { evoLvl: 1 } },
  { id: 'ocstart', part: 'reactor', tier: 2, name: 'Rozjetá evoluce', icon: 'overcharge', desc: 'Vyvinutá zbraň začíná o ★ výš', max: 2, cost: 2200, mod: { ocStart: 1 } },
  { id: 'ocmax', part: 'reactor', tier: 5, name: 'Překročení meze', icon: 'overcharge', desc: 'Evoluce se dají přetížit o ★ výš (★5 a ★6)', max: 2, cost: 25000, mod: { ocMax: 1 } },
  { id: 'e_haste', part: 'reactor', tier: 4, name: 'Věčný takt', icon: 'haste', desc: '−2 % nabíjení', max: Infinity, cost: 8000, grow: 1.28, mod: { cdMul: -0.02 } },
  { id: 'e_area', part: 'reactor', tier: 4, name: 'Věčný dosah', icon: 'area', desc: '+4 % oblast účinku a trvání', max: Infinity, cost: 6000, grow: 1.25, mod: { area: 0.04, dur: 0.04 } },
  // Trup
  { id: 'vitality', part: 'hull', name: 'Vitalita', icon: 'vitality', desc: '+10 max. zdraví', max: 5, cost: 45, mod: { maxHp: 10 } },
  { id: 'armor', part: 'hull', name: 'Pancíř', icon: 'armor', desc: '+1 pancíř (−7 % zranění)', max: 3, cost: 120, mod: { armor: 1 } },
  { id: 'recovery', part: 'hull', name: 'Regenerace', icon: 'regen', desc: '+0,1 zdraví/s', max: 5, cost: 70, mod: { regen: 0.1 } },
  { id: 'medkit', part: 'hull', name: 'Lékárnička', icon: 'heal', desc: 'Srdce léčí o 10 víc', max: 3, cost: 50, mod: { heartHeal: 10 } },
  // Fénix: dvě úrovně v základu, další dvě (dřív Věčný fénix) jsou Mistrovská díla.
  { id: 'revival', part: 'hull', tiers: [0, 0, 5, 5], costs: [750, 2275, 18000, 54575], name: 'Fénix', icon: 'revival', desc: '+1 oživení za běh', max: 4, mod: { revives: 1 } },
  { id: 'secondwind', part: 'hull', tier: 2, name: 'Druhý dech', icon: 'wind', desc: 'Oživení obnoví celé zdraví a dá 5 s nezranitelnosti', max: 1, cost: 2500, mod: { reviveFull: 1 } },
  { id: 'e_vigor', part: 'hull', tier: 4, name: 'Věčná odolnost', icon: 'vitality', desc: '+20 max. zdraví, +0,15 zdraví/s', max: Infinity, cost: 5000, grow: 1.25, mod: { maxHp: 20, regen: 0.15 } },
  // Sběrná křídla
  { id: 'magnet', part: 'wings', name: 'Magnet', icon: 'magnet', desc: '+15 % dosah sběru', max: 4, cost: 45, mod: { magnet: 0.15 } },
  { id: 'growth', part: 'wings', name: 'Růst', icon: 'growth', desc: '+4 % zkušenosti', max: 5, cost: 90, mod: { growth: 0.04 } },
  { id: 'greed', part: 'wings', name: 'Chamtivost', icon: 'greed', desc: '+10 % střepů', max: 5, cost: 100, mod: { greed: 0.10 } },
  { id: 'bounty', part: 'wings', name: 'Lovec elit', icon: 'chest', desc: '+25 % střepů z elit, bossů a truhel', max: 4, cost: 65, mod: { bounty: 0.25 } },
  { id: 'loot', part: 'wings', tier: 2, name: 'Bohatá kořist', icon: 'chest', desc: '+1 předmět v každé truhle', max: 2, cost: 1500, mod: { chestItems: 1 } },
  { id: 'gravwave', part: 'wings', tier: 3, name: 'Gravitační vlna', icon: 'magnet', desc: 'Každých 40 s přitáhne všechny krystaly a střepy na mapě', max: 1, cost: 3000, mod: { gravWave: 1 } },
  { id: 'e_growth', part: 'wings', tier: 4, name: 'Věčné poznání', icon: 'growth', desc: '+5 % zkušeností, +3 % štěstí', max: Infinity, cost: 5000, grow: 1.25, mod: { growth: 0.05, luck: 0.03 } },
  { id: 'e_greed', part: 'wings', tier: 4, name: 'Věčná žeň', icon: 'greed', desc: '+6 % střepů', max: Infinity, cost: 10000, grow: 1.32, mod: { greed: 0.06 } },
  // Motory
  { id: 'speed', part: 'engines', name: 'Trysky', icon: 'speed', desc: '+5 % rychlost', max: 4, cost: 55, mod: { speed: 0.05 } },
  { id: 'dashcd', part: 'engines', name: 'Rychlé dobíjení', icon: 'dashcd', desc: '−12 % doba dobití úskoku', max: 3, cost: 70, mod: { dashCd: 0.12 } },
  { id: 'dash', part: 'engines', name: 'Impuls', icon: 'dash', desc: '+1 náboj úskoku', max: 2, cost: 380, mod: { dashMax: 1 } },
  { id: 'dashblast', part: 'engines', tier: 2, name: 'Rázový úskok', icon: 'dashblast', desc: 'Úskok zraní nepřátele v cestě za 15 % jejich zdraví (bossy za 1,5 %)', max: 3, cost: 700, mod: { dashDmg: 1 } },
  { id: 'e_thrust', part: 'engines', tier: 4, name: 'Věčný tah', icon: 'speed', desc: '+3 % rychlost, −3 % doba dobití úskoku', max: Infinity, cost: 4000, grow: 1.25, mod: { speed: 0.03, dashCd: 0.03 } },
  // Zbrojnice
  { id: 'kit', part: 'bay', name: 'Výbava', icon: 'cards', desc: 'Každý běh začíná s náhodným doplňkem', max: 1, cost: 450, mod: { kit: 1 } },
  { id: 'headstart', part: 'bay', tier: 2, name: 'Náskok', icon: 'headstart', desc: 'Startovní zbraň začíná o úroveň výš', max: 3, cost: 900, mod: { startLvl: 1 } },
  // Výzbroj: kterými zbraněmi běh začne a které se v něm vůbec neobjeví (nastavuje se v Hangáru).
  { id: 'bans', part: 'bay', tier: 2, costs: [800, 1600, 3000, 5000, 8000, 12000], name: 'Zbrojní plán', icon: 'ban', desc: 'Vyřaď 1 zbraň (za úroveň): v běhu se vůbec neobjeví a ostatní přijdou častěji', max: 6, mod: { bans: 1 } },
  { id: 'hard', part: 'bay', tiers: [2, 3], costs: [5000, 25000], name: 'Závěsník', icon: 'hardpoint', desc: 'Běh začne s jednou zbraní navíc podle tvé volby (za úroveň)', max: 2, mod: { hard: 1 } },
  { id: 'prelvl', part: 'bay', tier: 3, costs: [8000, 20000], name: 'Kalibrace', icon: 'calib', desc: 'Zbraně ze závěsníků začínají o úroveň výš', max: 2, mod: { preLvl: 1 } },
  { id: 'wslot', part: 'bay', tier: 2, name: 'Arzenál', icon: 'slots', desc: '+1 místo pro zbraň (7 místo 6)', max: 1, cost: 6000, mod: { wSlots: 1 } },
  { id: 'pslot', part: 'bay', tier: 2, name: 'Doplňkový slot', icon: 'slots', desc: '+1 místo pro doplněk (7 místo 6)', max: 1, cost: 5000, mod: { pSlots: 1 } },
  { id: 'bigslots', part: 'bay', tier: 5, name: 'Velký arzenál', icon: 'slots', desc: '+1 místo pro zbraň a +1 místo pro doplněk', max: 1, cost: 60000, mod: { wSlots: 1, pSlots: 1 } },
  { id: 'bp_sentry', part: 'bay', tier: 5, name: 'Plán: Strážní drony', icon: 'sentry', desc: 'Odemkne novou zbraň Strážní drony (vyvine se s Energetickým štítem)', max: 1, cost: 12000, mod: {} },
  { id: 'bp_voidray', part: 'bay', tier: 5, name: 'Plán: Paprsek prázdnoty', icon: 'voidray', desc: 'Odemkne novou zbraň Paprsek prázdnoty (vyvine se s Kritickým zesilovačem)', max: 1, cost: 20000, mod: {} },
  { id: 'bp_cluster', part: 'bay', tier: 5, name: 'Plán: Kaskáda', icon: 'cluster', desc: 'Odemkne novou zbraň Kaskáda (vyvine se s Gyroskopem)', max: 1, cost: 30000, mod: {} },
  { id: 'voidborn', part: 'bay', tier: 5, name: 'Zrozen z prázdnoty', icon: 'crown', desc: 'Startovní zbraň začíná rovnou vyvinutá', max: 1, cost: 100000, mod: { startEvo: 1 } },
];
const F_INDEX = Object.fromEntries(FORGE.map(f => [f.id, f]));
// ── Automatický výběr karet ─────────────────────────────────────────────────
// Při zapnutém automatickém výběru vyhraje karta, která je v pořadí nejvýš. Karta může patřit pod víc
// položek (startovní zbraň je i svou zbraní, katalyzátor evoluce i svým doplňkem): platí ta vyšší.
const PRIO_DEFAULT = ['evo', 'start', 'catalyst', 'oc', ...BASE_WEAPONS.map(id => 'w:' + id),
  ...['might', 'haste', 'amount', 'area', 'critamp', 'luck', 'armor', 'regen', 'shield', 'duration', 'speed', 'magnet'].map(id => 'p:' + id),
  ...['might', 'haste', 'crit', 'area', 'vigor'].map(id => 'm:' + id), 'heal', 'gold'];
/** Uložené pořadí doplněné o položky, které v něm chybí (nové zbraně a doplňky jdou na své výchozí místo). */
function prioList(saved) {
  // starší uložení měla jedinou položku pro všechny mutace: rozbalí se na jednotlivé mutace
  const src = (Array.isArray(saved) ? saved : []).flatMap(k => (k === 'mut' ? PRIO_DEFAULT.filter(x => x.startsWith('m:')) : [k]));
  const out = src.filter((k, i) => PRIO_DEFAULT.includes(k) && src.indexOf(k) === i);
  PRIO_DEFAULT.forEach((k, i) => { if (!out.includes(k)) out.splice(Math.min(out.length, i), 0, k); });
  return out;
}
const forgeCost = (f, lvl) => (f.costs ? f.costs[Math.min(lvl, f.costs.length - 1)] : f.grow ? Math.round(f.cost * Math.pow(f.grow, lvl) / 50) * 50 : Math.round(f.cost * Math.pow(lvl + 1, 1.6) / 5) * 5);
const masterOpen = () => !!(SAVE.sectors.s2 && SAVE.sectors.s2.cleared);
const voidOpen = () => !!(SAVE.sectors.s5 && SAVE.sectors.s5.cleared);
/** Do které dílny patří úroveň lvl (počítáno od 0) vylepšení f. */
const lvlTier = (f, lvl) => (f.tiers ? f.tiers[Math.min(lvl, f.tiers.length - 1)] : f.tier || 0);
const tierOpen = t => (t === 2 ? masterOpen() : t >= 3 ? voidOpen() : true);
/** Dá se koupit další úroveň (její dílna je otevřená)? */
const forgeOpen = (f, lvl = SAVE.forge[f.id] || 0) => tierOpen(lvlTier(f, lvl));
const forgeLvl = (S, f) => Math.min(f.max, S.forge[f.id] || 0);
/** Kolik koupených úrovní patří do dílny tier (a kolik jich tam celkem je; Věčná dílna nemá strop). */
const forgeLevels = (S, tier) => FORGE.reduce((a, f) => { let n = 0; for (let l = 0; l < forgeLvl(S, f); l++) if (lvlTier(f, l) === tier) n++; return a + n; }, 0);
const forgeMaxLevels = tier => FORGE.filter(f => f.max !== Infinity).reduce((a, f) => { let n = 0; for (let l = 0; l < f.max; l++) if (lvlTier(f, l) === tier) n++; return a + n; }, 0);
const forgeSum = S => FORGE.reduce((a, f) => a + forgeLvl(S, f), 0);
/** Úrovně koupené v části lodi a kolik jich má (bez Věčné dílny) – z toho svítí část na modelu. */
function partProgress(S, part) {
  let n = 0, m = 0;
  for (const f of FORGE) if (f.part === part && f.max !== Infinity) { n += forgeLvl(S, f); m += f.max; }
  return m ? n / m : 0;
}
/** Úrovně z Věčné dílny v části lodi (motor jen přidává, nemá strop). */
const partEternal = (S, part) => FORGE.filter(f => f.part === part && f.max === Infinity).reduce((a, f) => a + (S.forge[f.id] || 0), 0);
/** Dá se v části lodi teď něco koupit? */
const partCanBuy = (S, part) => FORGE.some(f => f.part === part && (S.forge[f.id] || 0) < f.max && forgeOpen(f) && S.shards >= forgeCost(f, S.forge[f.id] || 0));
const canBuyAny = S => FORGE.some(f => (S.forge[f.id] || 0) < f.max && forgeOpen(f) && S.shards >= forgeCost(f, S.forge[f.id] || 0));
/** Starší uložení: sloučená vylepšení (Vějíř karet → Široký výběr, Věčný fénix → Fénix) a odstraněná. */
function migrateForge(S) {
  const F = S.forge || (S.forge = {});
  if (F.fan) { F.cards = Math.min(2, (F.cards || 0) + F.fan); delete F.fan; }
  if (F.phoenix) { F.revival = Math.min(4, (F.revival || 0) + F.phoenix); delete F.phoenix; }
  for (const id of Object.keys(F)) if (!F_INDEX[id] || !(F[id] > 0)) delete F[id];
}

// ── Úspěchy ─────────────────────────────────────────────────────────────────
// Odměna = střepy podle toho, jak těžký cíl je (a kolik se v té fázi hry vydělá za běh), plus trvalý
// bonus (perk) do všech běhů: zabíjení → poškození, sektory → střepy, evoluce → zkušenosti, čas → zdraví…
// Bonusy se sčítají v calcStats. Splněné úspěchy z doby před 1.4 dostaly jednorázově doplatek (ACH_OLD).
// check(S, R): S = uložená data, R = aktuální běh (nebo null)
const ACH_OLD = { k100: 20, k1000: 50, k10000: 150, k50000: 400, k250000: 1200, t5: 30, t10: 60, t25: 600, t30: 1000, boss1: 50, boss25: 400, clean: 250, clear1: 100, clear2: 200, clear3: 350, clear4: 500, clear5: 900, clear6: 400, clear7: 600, clear8: 800, clear9: 1200, clear10: 2000, clear11: 3000, clear12: 5000, sectorsAll: 2500, evo1: 80, evo4: 220, evo8: 700, evoAll: 1200, evo14: 3000, oc4: 300, oc6: 2500, lvl30: 60, lvl60: 250, lvl100: 600, od1: 120, od5: 450, od10: 1500, forge1: 25, master: 150, forgeAll: 600, masterAll: 2500, voidAll: 4000, piece1: 1000, piecesAll: 20000, eternal10: 2000, eternal50: 10000, rich: 250, arsenal: 100, untouch: 150, massacre: 200, runs10: 50, runs50: 300, dash500: 60, meteorKills: 250, pilots: 500 };
const ACHIEVEMENTS = [
  { id: 'k100', name: 'První krev', desc: 'Znič 100 nepřátel.', reward: 200, perk: { might: 0.01 }, icon: 'skull', prog: S => [S.stats.kills, 100] },
  { id: 'k1000', name: 'Čistička', desc: 'Znič 1 000 nepřátel.', reward: 500, perk: { might: 0.02 }, icon: 'skull', prog: S => [S.stats.kills, 1000], pilot: 'nyx' },
  { id: 'k10000', name: 'Vyhlazovatel', desc: 'Znič 10 000 nepřátel.', reward: 1500, perk: { might: 0.03 }, icon: 'skull', prog: S => [S.stats.kills, 10000] },
  { id: 'k50000', name: 'Pohroma', desc: 'Znič 50 000 nepřátel.', reward: 8000, perk: { might: 0.04 }, icon: 'skull', prog: S => [S.stats.kills, 50000] },
  { id: 'k250000', name: 'Konec civilizací', desc: 'Znič 250 000 nepřátel.', reward: 60000, perk: { might: 0.05 }, icon: 'skull', prog: S => [S.stats.kills, 250000] },
  { id: 't5', name: 'Přeživší', desc: 'Přežij 5 minut v jednom běhu.', reward: 300, perk: { maxHp: 5 }, icon: 'clock', prog: S => [S.stats.bestTime, 300], pilot: 'orion' },
  { id: 't10', name: 'Houževnatý', desc: 'Přežij 10 minut v jednom běhu.', reward: 1000, perk: { maxHp: 10 }, icon: 'clock', prog: S => [S.stats.bestTime, 600] },
  { id: 't25', name: 'Věčný', desc: 'Přežij 25 minut v jednom běhu (nekonečný režim).', reward: 30000, perk: { maxHp: 15 }, icon: 'clock', prog: S => [S.stats.bestTime, 1500] },
  { id: 'boss1', name: 'Zabiják titánů', desc: 'Poraz bosse.', reward: 600, perk: { bossDmg: 0.05 }, icon: 'boss', prog: S => [S.stats.bossKills, 1], pilot: 'titan' },
  { id: 'boss25', name: 'Lovec monarchů', desc: 'Poraz 25 bossů.', reward: 12000, perk: { bossDmg: 0.10 }, icon: 'boss', prog: S => [S.stats.bossKills, 25] },
  { id: 'clear1', name: 'Mlhovina vyčištěna', desc: 'Dokonči Sektor I.', reward: 1500, perk: { greed: 0.03 }, icon: 'trophy', prog: S => [+!!(S.sectors.s1 && S.sectors.s1.cleared), 1], pilot: 'lumen' },
  { id: 'clear2', name: 'Pás prolomen', desc: 'Dokonči Sektor II.', reward: 4000, perk: { greed: 0.03 }, icon: 'trophy', prog: S => [+!!(S.sectors.s2 && S.sectors.s2.cleared), 1] },
  { id: 'clear3', name: 'Smaragdový lovec', desc: 'Dokonči Sektor III.', reward: 8000, perk: { greed: 0.03 }, icon: 'trophy', prog: S => [+!!(S.sectors.s3 && S.sectors.s3.cleared), 1], pilot: 'zero' },
  { id: 'clear4', name: 'Za horizontem', desc: 'Dokonči Sektor IV.', reward: 14000, perk: { greed: 0.03 }, icon: 'trophy', prog: S => [+!!(S.sectors.s4 && S.sectors.s4.cleared), 1] },
  { id: 'clear5', name: 'Srdce zastaveno', desc: 'Dokonči Sektor V.', reward: 25000, perk: { greed: 0.05 }, icon: 'trophy', prog: S => [+!!(S.sectors.s5 && S.sectors.s5.cleared), 1], pilot: 'omega' },
  { id: 'evo1', name: 'Metamorfóza', desc: 'Vyvij jakoukoli zbraň.', reward: 1000, perk: { growth: 0.03 }, icon: 'star', prog: S => [Object.keys(S.evolutions).length, 1], pilot: 'echo' },
  { id: 'evo4', name: 'Alchymista', desc: 'Objev 4 různé evoluce.', reward: 5000, perk: { growth: 0.04 }, icon: 'star', prog: S => [Object.keys(S.evolutions).length, 4] },
  { id: 'evo8', name: 'Architekt zkázy', desc: 'Objev 8 různých evolucí.', reward: 15000, perk: { growth: 0.05 }, icon: 'star', prog: S => [Object.keys(S.evolutions).length, 8] },
  { id: 'evoAll', name: 'Pán prázdnoty', desc: 'Objev 11 různých evolucí.', reward: 35000, perk: { growth: 0.06 }, icon: 'star', prog: S => [Object.keys(S.evolutions).length, 11] },
  { id: 'oc4', name: 'Přetížení', desc: 'Přetiž evoluční zbraň na ★4.', reward: 12000, perk: { cdMul: -0.03 }, icon: 'overcharge', prog: S => [S.stats.maxOc || 0, OC_MAX] },
  { id: 't30', name: 'Nesmrtelný', desc: 'Přežij 30 minut v jednom běhu (nekonečný režim).', reward: 60000, perk: { maxHp: 20, regen: 0.2 }, icon: 'clock', prog: S => [S.stats.bestTime, 1800] },
  { id: 'lvl100', name: 'Mutant', desc: 'Dosáhni úrovně 100 v jednom běhu.', reward: 25000, perk: { luck: 0.07 }, icon: 'mutation', prog: S => [S.stats.maxLevel, 100] },
  { id: 'masterAll', name: 'Velmistr', desc: 'Kup celou Mistrovskou dílnu.', reward: 25000, perk: { rerolls: 1 }, icon: 'forge', prog: S => [forgeLevels(S, 2), forgeMaxLevels(2)] },
  { id: 'master', name: 'Mistrovská dílna', desc: 'Kup první vylepšení v Mistrovské dílně.', reward: 2000, icon: 'forge', prog: S => [forgeLevels(S, 2), 1] },
  { id: 'lvl30', name: 'Nabitý', desc: 'Dosáhni úrovně 30 v jednom běhu.', reward: 800, perk: { luck: 0.03 }, icon: 'growth', prog: S => [S.stats.maxLevel, 30] },
  { id: 'lvl60', name: 'Přetížený', desc: 'Dosáhni úrovně 60 v jednom běhu.', reward: 6000, perk: { luck: 0.05 }, icon: 'growth', prog: S => [S.stats.maxLevel, 60] },
  { id: 'od1', name: 'Overdrive', desc: 'Dokonči libovolný sektor na Overdrive 1.', reward: 5000, perk: { regen: 0.2 }, icon: 'haste', prog: S => [S.stats.maxOdClear, 1] },
  { id: 'od5', name: 'Rudá zóna', desc: 'Dokonči libovolný sektor na Overdrive 5.', reward: 30000, perk: { armor: 1 }, icon: 'haste', prog: S => [S.stats.maxOdClear, 5] },
  { id: 'od10', name: 'Za hranicí', desc: 'Dokonči libovolný sektor na Overdrive 10.', reward: 120000, perk: { revives: 1 }, icon: 'haste', prog: S => [S.stats.maxOdClear, 10] },
  { id: 'rich', name: 'Sběratel', desc: 'Nasbírej celkem 5 000 střepů.', reward: 500, perk: { magnet: 0.05 }, icon: 'shard', prog: S => [S.stats.shardsTotal, 5000] },
  { id: 'forge1', name: 'Kovář', desc: 'Kup první vylepšení v Kovárně.', reward: 100, icon: 'forge', prog: S => [forgeSum(S), 1] },
  { id: 'forgeAll', name: 'Mistr kovář', desc: 'Kup 50 úrovní vylepšení v Kovárně.', reward: 6000, icon: 'forge', prog: S => [forgeSum(S), 50] },
  { id: 'arsenal', name: 'Arzenál', desc: 'Měj v jednom běhu 6 zbraní najednou.', reward: 2000, perk: { rerolls: 1 }, icon: 'pulse', prog: (S, R) => [R ? Math.max(S.stats.maxWeapons, R.weapons.length) : S.stats.maxWeapons, 6] },
  { id: 'untouch', name: 'Nedotknutelný', desc: 'Vydrž 3 minuty v kuse bez zásahu.', reward: 8000, perk: { speed: 0.03 }, icon: 'armor', prog: S => [S.stats.bestNoHit, 180] },
  { id: 'massacre', name: 'Masakr', desc: 'Znič 250 nepřátel během 10 sekund.', reward: 6000, perk: { area: 0.05 }, icon: 'bomb', prog: S => [S.stats.bestBurst, 250] },
  { id: 'clean', name: 'Bez škrábnutí', desc: 'Poraz bosse, aniž by tě během souboje zasáhl.', reward: 10000, perk: { bossDmg: 0.10 }, icon: 'boss', prog: S => [S.stats.cleanBoss, 1] },
  { id: 'runs10', name: 'Veterán', desc: 'Odehraj 10 běhů.', reward: 1000, perk: { skips: 1 }, icon: 'rocket', prog: S => [S.stats.runs, 10] },
  { id: 'runs50', name: 'Legenda', desc: 'Odehraj 50 běhů.', reward: 10000, perk: { rerolls: 1 }, icon: 'rocket', prog: S => [S.stats.runs, 50] },
  { id: 'dash500', name: 'Akrobat', desc: 'Použij úskok 500krát.', reward: 2000, perk: { dashCd: 0.05 }, icon: 'dash', prog: S => [S.stats.dashes, 500] },
  { id: 'clear6', name: 'Skrz kamennou bouři', desc: 'Dokonči Sektor VI.', reward: 18000, perk: { greed: 0.03 }, icon: 'meteor', prog: S => [+!!(S.sectors.s6 && S.sectors.s6.cleared), 1] },
  { id: 'clear7', name: 'Jeden druh nestačí', desc: 'Dokonči Sektor VII.', reward: 24000, perk: { greed: 0.03 }, icon: 'trophy', prog: S => [+!!(S.sectors.s7 && S.sectors.s7.cleared), 1] },
  { id: 'clear8', name: 'Únik z horizontu', desc: 'Dokonči Sektor VIII.', reward: 32000, perk: { greed: 0.04 }, icon: 'vortex', prog: S => [+!!(S.sectors.s8 && S.sectors.s8.cleared), 1] },
  { id: 'clear9', name: 'Světlo v temnotě', desc: 'Dokonči Sektor IX.', reward: 45000, perk: { greed: 0.04 }, icon: 'eye', prog: S => [+!!(S.sectors.s9 && S.sectors.s9.cleared), 1] },
  { id: 'sectorsAll', name: 'Pán všech sektorů', desc: 'Dokonči všech 12 sektorů.', reward: 250000, perk: { greed: 0.10 }, icon: 'trophy', prog: S => [SECTORS.filter(s => S.sectors[s.id] && S.sectors[s.id].cleared).length, SECTORS.length] },
  { id: 'meteorKills', name: 'Kamenná lavina', desc: 'Nech meteority a černou díru zničit 300 nepřátel.', reward: 8000, perk: { magnet: 0.10 }, icon: 'meteor', prog: S => [S.stats.hazardKills || 0, 300] },
  { id: 'voidAll', name: 'Kovář prázdnoty', desc: 'Kup celou Prázdnotovou dílnu.', reward: 60000, perk: { skips: 1 }, icon: 'forge', prog: S => [forgeLevels(S, 3), forgeMaxLevels(3)] },
  { id: 'pilots', name: 'Celá letka', desc: 'Odemkni všechny piloty.', reward: 25000, perk: { growth: 0.05 }, icon: 'rocket', prog: S => [PILOTS.filter(p => !p.unlock || S.achievements[p.unlock]).length, PILOTS.length] },
  { id: 'clear10', name: 'Přehlídka skončila', desc: 'Dokonči Sektor X.', reward: 70000, perk: { greed: 0.05 }, icon: 'boss', prog: S => [+!!(S.sectors.s10 && S.sectors.s10.cleared), 1] },
  { id: 'clear11', name: 'Uprostřed kolapsu', desc: 'Dokonči Sektor XI.', reward: 100000, perk: { greed: 0.05 }, icon: 'zone', prog: S => [+!!(S.sectors.s11 && S.sectors.s11.cleared), 1] },
  { id: 'clear12', name: 'Po konci všeho', desc: 'Dokonči Sektor XII.', reward: 150000, perk: { greed: 0.06 }, icon: 'skull', prog: S => [+!!(S.sectors.s12 && S.sectors.s12.cleared), 1] },
  { id: 'evo14', name: 'Úplná metamorfóza', desc: 'Objev všech 14 evolucí.', reward: 70000, perk: { growth: 0.07 }, icon: 'star', prog: S => [EVOLUTIONS.filter(id => S.evolutions[id]).length, EVOLUTIONS.length] },
  { id: 'oc6', name: 'Za hranicí přetížení', desc: 'Přetiž evoluční zbraň na ★6.', reward: 60000, perk: { cdMul: -0.04 }, icon: 'overcharge', prog: S => [S.stats.maxOc || 0, OC_MAX + 2] },
  { id: 'piece1', name: 'Mistrovské dílo', desc: 'Kup první Mistrovské dílo v Kovárně.', reward: 20000, icon: 'crown', prog: S => [forgeLevels(S, 5), 1] },
  { id: 'piecesAll', name: 'Galerie mistrů', desc: 'Kup všechna Mistrovská díla.', reward: 200000, perk: { might: 0.05 }, icon: 'crown', prog: S => [forgeLevels(S, 5), forgeMaxLevels(5)] },
  { id: 'eternal10', name: 'Věčný kovář', desc: 'Kup 10 úrovní ve Věčné dílně.', reward: 25000, icon: 'infinity', prog: S => [forgeLevels(S, 4), 10] },
  { id: 'eternal50', name: 'Nekonečno', desc: 'Kup 50 úrovní ve Věčné dílně.', reward: 120000, perk: { greed: 0.05 }, icon: 'infinity', prog: S => [forgeLevels(S, 4), 50] },
  { id: 'beast18', name: 'Lovec druhů', desc: 'Znič 18 různých druhů nepřátel.', reward: 6000, perk: { might: 0.03 }, icon: 'skull', prog: S => [ENEMY_KINDS.filter(k => S.bestiary[k]).length, 18] },
  { id: 'bestiary', name: 'Bestiář', desc: 'Znič aspoň jednoho nepřítele od každého druhu.', reward: 40000, perk: { might: 0.05 }, icon: 'book', prog: S => [ENEMY_KINDS.filter(k => S.bestiary[k]).length, ENEMY_KINDS.length] },
];
// Trvalé bonusy úspěchů: popis („+3 % poškození“) a součet všech splněných (Síň slávy).
const PERK_LABEL = {
  might: [L('poškození', 'damage'), 1], greed: [L('střepů', 'shards'), 1], growth: [L('zkušeností', 'experience'), 1],
  bossDmg: [L('poškození bossům a elitám', 'damage to bosses and elites'), 1], luck: [L('štěstí', 'luck'), 1],
  area: [L('oblasti', 'area'), 1], magnet: [L('dosahu sběru', 'pickup range'), 1], speed: [L('rychlosti', 'speed'), 1],
  cdMul: [L('nabíjení', 'cooldown'), 1], dashCd: [L('rychlejší dobití úskoku', 'faster dash recharge'), 1],
  maxHp: [L('zdraví', 'health'), 0], regen: [L('regenerace /s', 'regeneration /s'), 0], armor: [L('pancíř', 'armor'), 0],
  revives: [L('oživení', 'revive'), 0], rerolls: [L('přehození', 'reroll'), 0], skips: [L('přeskočení', 'skip'), 0],
};
const perkDec = v => (LANG === 'cs' ? String(v).replace('.', ',') : String(v));
function perkText(perk) {
  return Object.entries(perk).map(([k, v]) => {
    const [name, pct] = PERK_LABEL[k];
    const n = pct ? `${v > 0 ? '+' : '−'}${perkDec(Math.round(Math.abs(v) * 1000) / 10)}${L(' %', '%')}` : `+${perkDec(v)}`;
    return `${n} ${name}`;
  }).join(', ');
}
function achPerks(ach) {
  const sum = {};
  for (const a of ACHIEVEMENTS) if (ach[a.id] && a.perk) for (const k in a.perk) sum[k] = Math.round(((sum[k] || 0) + a.perk[k]) * 1000) / 1000;
  return sum;
}

