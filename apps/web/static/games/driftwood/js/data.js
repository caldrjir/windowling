'use strict';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[(Math.random() * a.length) | 0];
const plural = (n, one, few, many) => n === 1 ? one : n >= 2 && n <= 4 ? few : many;

// ── Ikony (SVG 24×24) ───────────────────────────────────────────────────────
const ICONS = {
  wood: '<path d="M4 15l11-11 5 5-11 11z"/><path d="M15 4l5 5M7 12l5 5"/><circle cx="6.5" cy="17.5" r="2"/>',
  stone: '<path d="M4 16l3-8 7-3 6 5 1 7-6 3-8-1z"/><path d="M7 8l4 5 9-3M11 13l-1 7"/>',
  fiber: '<path d="M6 21c0-8 2-13 6-18M12 21c0-7 1-11 4-15M18 21c0-5-1-9-4-12M9 21c0-6-3-9-5-11"/>',
  berries: '<circle cx="8" cy="15" r="3.5"/><circle cx="15" cy="16" r="3.5"/><circle cx="12" cy="10" r="3.5"/><path d="M12 6.5V3l3-1"/>',
  coconut: '<circle cx="12" cy="13" r="8"/><circle cx="10" cy="10" r="1"/><circle cx="14" cy="10" r="1"/><circle cx="12" cy="13" r="1"/>',
  meat: '<path d="M15 4c4 0 6 3 5 7-1 5-6 9-11 9-3 0-5-2-5-5 0-6 6-11 11-11z"/><path d="M6 18l-3 3M9 14c2 0 3-1 4-3"/>',
  cooked: '<path d="M15 4c4 0 6 3 5 7-1 5-6 9-11 9-3 0-5-2-5-5 0-6 6-11 11-11z"/><path d="M6 18l-3 3M9 9l6 6M12 7l5 5"/>',
  hide: '<path d="M5 5c3 1 4-1 7-1s4 2 7 1c-1 3 1 5 0 8s-3 2-3 6c-3-1-5 1-8 0 0-4-2-3-3-6s1-5 0-8z"/>',
  ore: '<path d="M4 16l3-8 7-3 6 5 1 7-6 3-8-1z"/><circle cx="10" cy="11" r="1.6"/><circle cx="15" cy="14" r="1.6"/><circle cx="9" cy="16" r="1.2"/>',
  ingot: '<path d="M3 16l4-7h10l4 7z"/><path d="M7 9l2 7M17 9l-2 7"/>',
  rope: '<path d="M6 4c6 0 6 5 0 5s-6 5 0 5 6 5 0 5"/><path d="M12 4c6 0 6 5 0 5s-6 5 0 5 6 5 0 5"/>',
  axe: '<path d="M14 4l6 6-3 3-6-6z"/><path d="M12 9L4 20"/><path d="M14 4c-3 0-5 2-5 5"/>',
  pick: '<path d="M4 8c5-5 11-5 16 0"/><path d="M12 5v16"/>',
  spear: '<path d="M20 4l-4 1-1 4 4-1z"/><path d="M16 8L4 20"/>',
  sword: '<path d="M14.5 3.5H20.5V9.5L9 21l-6-6z"/><path d="M5 13l6 6M3 21l3-3"/>',
  torch: '<path d="M10 22l2-12 2 12z"/><path d="M12 10c-3-2-3-5 0-8 3 3 3 6 0 8z"/>',
  fire: '<path d="M12 21c4 0 6-2.5 6-5.5 0-3.5-3-5-3-9-2.5 1.5-3 4-3 5.5-1-1-1.5-2-1.5-3.5C8.5 10 6 12 6 15.5 6 18.5 8 21 12 21z"/><path d="M4 22h16"/>',
  bench: '<path d="M3 9h18v3H3zM5 12v8M19 12v8M5 16h14"/>',
  furnace: '<path d="M5 21V8l7-5 7 5v13z"/><path d="M9 21v-6h6v6"/><path d="M11 18c0-1 2-1 2-2"/>',
  tent: '<path d="M2 20L12 4l10 16z"/><path d="M12 4v16M9 20l3-6 3 6"/>',
  raft: '<path d="M2 17h20l-2 3H4z"/><path d="M12 17V3l7 10h-7"/>',
  bandage: '<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-30 12 12)"/><path d="M10 10l1 1M12 12l1 1M10 13l1 1"/>',
  bottle: '<path d="M10 2h4v4l2 3v11a2 2 0 01-2 2h-4a2 2 0 01-2-2V9l2-3z"/><path d="M8 13h8"/>',
  armor: '<path d="M7 3l5 2 5-2 4 4-3 3v11H6V10L3 7z"/>',
  hand: '<path d="M8 13V5a1.5 1.5 0 013 0v6M11 11V4a1.5 1.5 0 013 0v7M14 11V5.5a1.5 1.5 0 013 0V14c0 4-2.5 7-6 7-3 0-5-2-6.5-4.5L3 13.5a1.5 1.5 0 012.5-1.5L8 15"/>',
  heart: '<path d="M12 20.5s-8.5-4.8-8.5-11a4.6 4.6 0 018.5-2.4 4.6 4.6 0 018.5 2.4c0 6.2-8.5 11-8.5 11z"/>',
  food: '<path d="M7 3v8a3 3 0 003 3v7M10 3v6M4 3v6"/><path d="M17 3c-2 2-3 5-3 8h3v10"/>',
  water: '<path d="M12 2.5s7 7.5 7 12a7 7 0 01-14 0c0-4.5 7-12 7-12z"/>',
  temp: '<path d="M14 14.8V4a2 2 0 00-4 0v10.8a4 4 0 104 0z"/>',
  bolt: '<path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5z"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
  trophy: '<path d="M7 3.5h10v5a5 5 0 01-10 0z"/><path d="M7 5H3.5v1.5A3.5 3.5 0 007 10M17 5h3.5v1.5A3.5 3.5 0 0117 10M12 13.5V17M8 21h8"/>',
  skull: '<path d="M12 2.5c-5 0-8.5 3.5-8.5 8 0 3 1.5 5 3.5 6v3.5h10V16.5c2-1 3.5-3 3.5-6 0-4.5-3.5-8-8.5-8z"/><circle cx="8.8" cy="11" r="1.8"/><circle cx="15.2" cy="11" r="1.8"/>',
  play: '<path d="M7 4.5l13 7.5-13 7.5z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 1.5v3M12 19.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M1.5 12h3M19.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
  home: '<path d="M3 11l9-7.5 9 7.5"/><path d="M5.5 9v11.5h13V9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  wolf: '<path d="M4 4l4 5h8l4-5v9l-3 4-5 4-5-4-3-4z"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>',
  deer: '<path d="M8 2v4l-3 2M8 6l2 1M16 2v4l3 2M16 6l-2 1"/><path d="M9 8h6l1 6-4 6-4-6z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 018 0v3.5"/>',
  fish: '<path d="M3 12c3-5 9-6 14-2l4-3v10l-4-3c-5 4-11 3-14-2z"/><circle cx="8" cy="11" r="1"/>',
  fishc: '<path d="M3 12c3-5 9-6 14-2l4-3v10l-4-3c-5 4-11 3-14-2z"/><path d="M9 9l3 6M13 9l2 5"/>',
  bowl: '<path d="M3 11h18a9 9 0 01-18 0z"/><path d="M8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>',
  rod: '<path d="M4 20L18 4"/><path d="M18 4c2 4 2 9 0 13"/><circle cx="18" cy="18.5" r="1.5"/><path d="M6 17l2 2"/>',
  bow: '<path d="M7 3c7 2 11 8 11 18"/><path d="M7 3l11 18"/><path d="M4 15l9-5M13 10l-3 .2M13 10l-1.4 2.6"/>',
  arrow: '<path d="M4 20L18 6"/><path d="M18 6l-5 1M18 6l-1 5"/><path d="M4 20l1-4M4 20l4-1M6 18l1-3M6 18l3-1"/>',
  fur: '<path d="M5 5c3 1 4-1 7-1s4 2 7 1c-1 3 1 5 0 8s-3 2-3 6c-3-1-5 1-8 0 0-4-2-3-3-6s1-5 0-8z"/><path d="M9 9l1 2M13 8l1 2M11 13l1 2M15 12l1 2"/>',
  coat: '<path d="M8 3l4 3 4-3 4 4-2 3v11H6V10L4 7z"/><path d="M12 6v15M9 13h1M14 13h1"/>',
  chest: '<rect x="3" y="9" width="18" height="11" rx="1.5"/><path d="M3 9c0-3 2-5 4-5h10c2 0 4 2 4 5"/><path d="M11 12h2v3h-2z"/>',
  garden: '<path d="M3 15h18v5H3z"/><path d="M8 15c0-4 1-6 4-8 3 2 4 4 4 8"/><path d="M12 7v8"/>',
  scroll: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 9l3 2 2-3 3 4M8 15h8"/>',
  chart: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M7 12l3-2 3 3 4-4"/><circle cx="17" cy="9" r="1"/>',
  sail: '<path d="M6 3v18"/><path d="M6 4c7 3 11 8 12 15H6"/>',
  book: '<path d="M4 4h7a2 2 0 012 2v14a2 2 0 00-2-2H4z"/><path d="M20 4h-7a2 2 0 00-2 2v14a2 2 0 012-2h7z"/>',
  note: '<path d="M9 2h6v4l3 3v11a2 2 0 01-2 2H8a2 2 0 01-2-2V9l3-3z"/><path d="M9 12h6M9 15h6M9 18h4"/>',
  star: '<path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.3 9.2l6.1-.6z"/>',
  cloud: '<path d="M7 18h10a4 4 0 000-8 5.5 5.5 0 00-10.6-1.5A4.5 4.5 0 007 18z"/>',
  rain: '<path d="M7 14h10a4 4 0 000-8 5.5 5.5 0 00-10.6-1.5A4.5 4.5 0 007 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
  storm: '<path d="M7 14h10a4 4 0 000-8 5.5 5.5 0 00-10.6-1.5A4.5 4.5 0 007 14z"/><path d="M12 14l-2 4h3l-2 4"/>',
  bear: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M5 13a7 7 0 0114 0c0 4-3 7-7 7s-7-3-7-7z"/><circle cx="9.5" cy="12" r="1"/><circle cx="14.5" cy="12" r="1"/><path d="M11 16h2"/>',
  ruin: '<path d="M4 21V9h4v12M10 21V5h4v16M16 21v-9h4v9"/><path d="M2 21h20"/>',
  crate: '<rect x="4" y="6" width="16" height="13" rx="1"/><path d="M4 10h16M9 6v13M15 6v13"/>',
  pin: '<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/>',
  up: '<path d="M12 4l7 7h-4v8H9v-8H5z"/>',
  sick: '<circle cx="12" cy="12" r="8"/><path d="M9 10h.01M15 10h.01M8.5 15.5c2-1.5 5-1.5 7 0"/>',
  cold: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  bag: '<path d="M6 8h12l1 13H5z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (id, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[id] || ICONS.stone}</svg>`;

// ── Předměty ────────────────────────────────────────────────────────────────
// tool: { type: 'axe'|'pick'|'weapon', power, dmg, reach, dur }
const ITEMS = {
  wood: { name: L('Dřevo', 'Wood'), icon: 'wood', color: '#c08a52', stack: 50 },
  stone: { name: L('Kámen', 'Stone'), icon: 'stone', color: '#a8b0b8', stack: 50 },
  fiber: { name: L('Vlákno', 'Fiber'), icon: 'fiber', color: '#9bd36a', stack: 50 },
  berries: { name: L('Bobule', 'Berries'), icon: 'berries', color: '#e0466a', stack: 20, food: { hunger: 8, thirst: 3 } },
  coconut: { name: L('Kokos', 'Coconut'), icon: 'coconut', color: '#a77b4f', stack: 10, food: { hunger: 6, thirst: 25 } },
  rawMeat: { name: L('Syrové maso', 'Raw Meat'), icon: 'meat', color: '#e07a7a', stack: 10, food: { hunger: 10, health: -6 } },
  cookedMeat: { name: L('Pečené maso', 'Cooked Meat'), icon: 'cooked', color: '#c8763a', stack: 10, food: { hunger: 35, health: 6 } },
  hide: { name: L('Kůže', 'Hide'), icon: 'hide', color: '#b78a5e', stack: 20 },
  ironOre: { name: L('Železná ruda', 'Iron Ore'), icon: 'ore', color: '#c77a5a', stack: 30 },
  iron: { name: L('Železo', 'Iron Ingot'), icon: 'ingot', color: '#cfd6de', stack: 30 },
  rope: { name: L('Lano', 'Rope'), icon: 'rope', color: '#d8c08a', stack: 30 },
  bandage: { name: L('Obvaz', 'Bandage'), icon: 'bandage', color: '#f0e6d8', stack: 10, food: { health: 25 }, use: L('Obvázat', 'Apply') },
  waterskin: { name: L('Měch s vodou', 'Waterskin'), icon: 'bottle', color: '#6ac3ff', stack: 1, charges: 4, use: L('Napít se', 'Drink') },
  stoneAxe: { name: L('Kamenná sekera', 'Stone Axe'), icon: 'axe', color: '#a8b0b8', stack: 1, tool: { type: 'axe', power: 2, dmg: 9, reach: 3, dur: 80 } },
  stonePick: { name: L('Kamenný krumpáč', 'Stone Pickaxe'), icon: 'pick', color: '#a8b0b8', stack: 1, tool: { type: 'pick', power: 2, dmg: 7, reach: 3, dur: 80 } },
  spear: { name: L('Oštěp', 'Spear'), icon: 'spear', color: '#c9a77a', stack: 1, tool: { type: 'weapon', power: 0, dmg: 16, reach: 3.8, dur: 60 } },
  torch: { name: L('Pochodeň', 'Torch'), icon: 'torch', color: '#ffb347', stack: 5, tool: { type: 'torch', power: 0, dmg: 4, reach: 2.6, dur: 240, burn: true } },
  ironAxe: { name: L('Železná sekera', 'Iron Axe'), icon: 'axe', color: '#dfe6ee', stack: 1, tool: { type: 'axe', power: 4, dmg: 16, reach: 3, dur: 250 } },
  ironPick: { name: L('Železný krumpáč', 'Iron Pickaxe'), icon: 'pick', color: '#dfe6ee', stack: 1, tool: { type: 'pick', power: 4, dmg: 12, reach: 3, dur: 250 } },
  ironSpear: { name: L('Železné kopí', 'Iron Spear'), icon: 'sword', color: '#dfe6ee', stack: 1, tool: { type: 'weapon', power: 0, dmg: 30, reach: 4, dur: 200 } },
  hideArmor: { name: L('Kožená zbroj', 'Hide Armor'), icon: 'armor', color: '#b78a5e', stack: 1, armor: true, use: L('Obléct', 'Wear') },
  campfire: { name: L('Táborák', 'Campfire'), icon: 'fire', color: '#ff8a3d', stack: 5, place: 'campfire' },
  workbench: { name: L('Pracovní stůl', 'Workbench'), icon: 'bench', color: '#c08a52', stack: 1, place: 'workbench' },
  furnace: { name: L('Pec', 'Furnace'), icon: 'furnace', color: '#9a9aa2', stack: 1, place: 'furnace' },
  shelter: { name: L('Přístřešek', 'Shelter'), icon: 'tent', color: '#d8b07a', stack: 1, place: 'shelter' },
  raft: { name: L('Vor', 'Raft'), icon: 'raft', color: '#e0c38a', stack: 1, place: 'raft', desc: L('Spusť ho na moře u břehu a vypluj domů.', 'Launch it into the sea by the shore and sail home.') },
  // ── Velká aktualizace: rybaření, lov lukem, osada a cesta domů ──
  rawFish: { name: L('Syrová ryba', 'Raw Fish'), icon: 'fish', color: '#8fc0d0', stack: 10, food: { hunger: 8, health: -3, sick: 20 } },
  cookedFish: { name: L('Pečená ryba', 'Grilled Fish'), icon: 'fishc', color: '#e0a060', stack: 10, food: { hunger: 28, thirst: 4, health: 5 } },
  stew: { name: L('Dušené maso', 'Hearty Stew'), icon: 'bowl', color: '#d0703a', stack: 5, food: { hunger: 55, thirst: 18, health: 12, fed: 240 }, desc: L('Zasytí na dlouho: pomalejší hlad a rychlejší dech.', 'Keeps you full: slower hunger and faster stamina.') },
  fishingRod: { name: L('Rybářský prut', 'Fishing Rod'), icon: 'rod', color: '#c9a77a', stack: 1, tool: { type: 'rod', power: 0, dmg: 2, reach: 3, dur: 40 }, desc: L('Nahoď do moře nebo jezírka a sekni, až se splávek potopí.', 'Cast into the sea or a pond and strike when the float dips.') },
  bow: { name: L('Luk', 'Bow'), icon: 'bow', color: '#d8a868', stack: 1, tool: { type: 'bow', power: 0, dmg: 3, reach: 3, dur: 120 }, desc: L('Drž levé tlačítko pro natažení, pusť pro výstřel. Potřebuješ šípy.', 'Hold the left button to draw, release to shoot. Needs arrows.') },
  arrow: { name: L('Šíp', 'Arrow'), icon: 'arrow', color: '#e8d8b0', stack: 40, desc: L('Střelivo do luku. Netrefené šípy se často dají sebrat.', 'Ammunition for the bow. Missed arrows can often be picked up.') },
  fur: { name: L('Medvědí kožešina', 'Bear Fur'), icon: 'fur', color: '#8a6040', stack: 10 },
  furCoat: { name: L('Kožich', 'Fur Coat'), icon: 'coat', color: '#a87850', stack: 1, armor: true, use: L('Obléct', 'Wear'), desc: L('Nejteplejší oblečení na ostrově: −50 % poškození.', 'The warmest clothing on the island: −50% damage.') },
  chest: { name: L('Truhla', 'Chest'), icon: 'chest', color: '#b07a44', stack: 2, place: 'chest', desc: L('16 míst na zásoby. Otevřeš ji klávesou E.', '16 slots of storage. Open it with E.') },
  garden: { name: L('Záhon', 'Garden Bed'), icon: 'garden', color: '#8ac060', stack: 3, place: 'garden', desc: L('Zasaď do něj bobule (E) a za den sklidíš úrodu.', 'Plant berries in it (E) and harvest a crop a day later.') },
  sail: { name: L('Plachta', 'Sail'), icon: 'sail', color: '#efe6d2', stack: 1 },
  mapPiece: { name: L('Úlomek mapy', 'Map Fragment'), icon: 'scroll', color: '#e8c87a', stack: 3, desc: L('Kus staré námořní mapy z ruin. Tři úlomky dají celou mapu.', 'A piece of an old sea chart from the ruins. Three make the whole chart.') },
  seaChart: { name: L('Námořní mapa', 'Sea Chart'), icon: 'chart', color: '#ffd88a', stack: 1, desc: L('Ukazuje cestu přes útesy na volné moře. Bez ní vor neodpluje.', 'Shows the way past the reefs to the open sea. The raft cannot sail without it.') },
};
// popisy výchozích předmětů (tooltipy)
Object.assign(ITEMS.waterskin, { desc: L('4 doušky vody. Naplníš ho u jezírka nebo v dešti.', '4 sips of water. Refill it at a pond or in the rain.') });
Object.assign(ITEMS.bandage, { desc: L('Obváže rány: +25 zdraví.', 'Dresses wounds: +25 health.') });
Object.assign(ITEMS.hideArmor, { desc: L('Kožená zbroj: −35 % poškození a víc tepla v noci.', 'Hide armor: −35% damage and more warmth at night.') });
Object.assign(ITEMS.torch, { desc: L('Svítí, hřeje a drží vlky trochu dál.', 'Lights the way, warms you and keeps wolves a little further away.') });
Object.assign(ITEMS.campfire, { desc: L('Hřeje, plaší vlky a dá se u něj vařit.', 'Warms you, scares wolves away and lets you cook.') });
Object.assign(ITEMS.workbench, { desc: L('Odemkne pokročilou výrobu.', 'Unlocks advanced crafting.') });
Object.assign(ITEMS.furnace, { desc: L('Taví železnou rudu na ingoty.', 'Smelts iron ore into ingots.') });
Object.assign(ITEMS.shelter, { desc: L('Přespíš v něm noc (E) a stane se tvým domovem.', 'Sleep through the night in it (E); it becomes your home.') });
Object.assign(ITEMS.rawMeat, { food: { hunger: 10, health: -4, sick: 25 } });

// zbroj: kolik poškození projde, kolik nočního chladu ubere, rychlost
const ARMORS = {
  hideArmor: { dmg: 0.65, cold: 35, speed: 0.95 },
  furCoat: { dmg: 0.5, cold: 14, speed: 0.93 },
};
const armorOf = P => (P.armor === true ? ARMORS.hideArmor : ARMORS[P.armor] || null);

// ── Recepty ─────────────────────────────────────────────────────────────────
// at: potřebná stanice v dosahu (null = z ruky)
// cat: kategorie ve výrobě (tools, survival, food, build, mats)
const RECIPES = [
  { out: 'stoneAxe', n: 1, cost: { wood: 3, stone: 3, fiber: 2 }, at: null, cat: 'tools' },
  { out: 'stonePick', n: 1, cost: { wood: 3, stone: 4, fiber: 2 }, at: null, cat: 'tools' },
  { out: 'spear', n: 1, cost: { wood: 4, stone: 1, fiber: 2 }, at: null, cat: 'tools' },
  { out: 'torch', n: 1, cost: { wood: 2, fiber: 1 }, at: null, cat: 'tools' },
  { out: 'fishingRod', n: 1, cost: { wood: 3, fiber: 4 }, at: null, cat: 'tools' },
  { out: 'arrow', n: 4, cost: { wood: 2, stone: 1, fiber: 1 }, at: null, cat: 'tools' },
  { out: 'campfire', n: 1, cost: { wood: 6, stone: 4 }, at: null, cat: 'build' },
  { out: 'bandage', n: 1, cost: { fiber: 4 }, at: null, cat: 'survival' },
  { out: 'workbench', n: 1, cost: { wood: 14, stone: 6 }, at: null, cat: 'build' },
  { out: 'cookedMeat', n: 1, cost: { rawMeat: 1 }, at: 'campfire', cat: 'food' },
  { out: 'cookedFish', n: 1, cost: { rawFish: 1 }, at: 'campfire', cat: 'food' },
  { out: 'stew', n: 1, cost: { rawMeat: 1, berries: 3, coconut: 1 }, at: 'campfire', cat: 'food' },
  { out: 'rope', n: 1, cost: { fiber: 3 }, at: 'workbench', cat: 'mats' },
  { out: 'waterskin', n: 1, cost: { hide: 2, fiber: 2 }, at: 'workbench', cat: 'survival' },
  { out: 'hideArmor', n: 1, cost: { hide: 5, fiber: 4 }, at: 'workbench', cat: 'survival' },
  { out: 'chest', n: 1, cost: { wood: 16, fiber: 6 }, at: 'workbench', cat: 'build' },
  { out: 'garden', n: 1, cost: { wood: 8, fiber: 6, stone: 4 }, at: 'workbench', cat: 'build' },
  { out: 'bow', n: 1, cost: { wood: 5, rope: 2 }, at: 'workbench', cat: 'tools' },
  { out: 'shelter', n: 1, cost: { wood: 25, fiber: 10, hide: 2 }, at: 'workbench', cat: 'build' },
  { out: 'furnace', n: 1, cost: { stone: 20, wood: 4 }, at: 'workbench', cat: 'build' },
  { out: 'iron', n: 1, cost: { ironOre: 2, wood: 2 }, at: 'furnace', cat: 'mats' },
  { out: 'ironAxe', n: 1, cost: { wood: 2, iron: 3, rope: 1 }, at: 'workbench', cat: 'tools' },
  { out: 'ironPick', n: 1, cost: { wood: 2, iron: 3, rope: 1 }, at: 'workbench', cat: 'tools' },
  { out: 'ironSpear', n: 1, cost: { wood: 3, iron: 2, rope: 1 }, at: 'workbench', cat: 'tools' },
  { out: 'furCoat', n: 1, cost: { fur: 3, hide: 2, rope: 2 }, at: 'workbench', cat: 'survival' },
  { out: 'sail', n: 1, cost: { hide: 4, rope: 4, fiber: 6 }, at: 'workbench', cat: 'mats' },
  { out: 'seaChart', n: 1, cost: { mapPiece: 3 }, at: 'workbench', cat: 'mats' },
  { out: 'raft', n: 1, cost: { wood: 60, rope: 15, iron: 4, sail: 1, seaChart: 1 }, at: 'workbench', cat: 'build' },
];
const RECIPE_CATS = [
  ['all', L('Vše', 'All')], ['tools', L('Nástroje', 'Tools')], ['survival', L('Přežití', 'Survival')],
  ['food', L('Jídlo', 'Food')], ['build', L('Stavby', 'Building')], ['mats', L('Materiály', 'Materials')],
];

const STRUCTURES = {
  campfire: { r: 0.7, solid: false, light: true, warmth: 9 },
  workbench: { r: 0.9, solid: true },
  furnace: { r: 0.9, solid: true, light: true, warmth: 5 },
  shelter: { r: 1.6, solid: false, warmth: 5 },
  raft: { r: 2, solid: false },
  chest: { r: 0.6, solid: true },
  garden: { r: 0.95, solid: false },
};
const STATION_NAME = { campfire: L('u táboráku', 'at a campfire'), workbench: L('u pracovního stolu', 'at a workbench'), furnace: L('u pece', 'at a furnace') };

// ── Suroviny ve světě ───────────────────────────────────────────────────────
// hp v „úderech síly“; ruka má sílu 1
const NODES = {
  tree: { name: L('Strom', 'Tree'), hp: 8, tool: 'axe', drops: [['wood', 4, 6]], respawn: 420, r: 0.45, solid: true },
  pine: { name: L('Borovice', 'Pine'), hp: 8, tool: 'axe', drops: [['wood', 4, 6]], respawn: 420, r: 0.4, solid: true },
  palm: { name: L('Palma', 'Palm'), hp: 6, tool: 'axe', drops: [['wood', 3, 4], ['coconut', 1, 2]], respawn: 360, r: 0.35, solid: true },
  rock: { name: L('Skála', 'Rock'), hp: 10, tool: 'pick', drops: [['stone', 4, 6]], respawn: 480, r: 0.9, solid: true, handOk: true },
  ironRock: { name: L('Železná ruda', 'Iron Deposit'), hp: 14, tool: 'pick', drops: [['ironOre', 2, 3], ['stone', 1, 2]], respawn: 600, r: 0.9, solid: true, needs: 'pick' },
  bush: { name: L('Keř s bobulemi', 'Berry Bush'), hp: 0, drops: [['berries', 2, 4], ['fiber', 1, 1]], respawn: 300, r: 0.5, gather: true },
  plant: { name: L('Vláknitá rostlina', 'Fiber Plant'), hp: 0, drops: [['fiber', 2, 3]], respawn: 240, r: 0.3, gather: true },
  stick: { name: L('Větev', 'Branch'), hp: 0, drops: [['wood', 1, 2]], respawn: 300, r: 0.2, gather: true },
  pebble: { name: L('Kamínky', 'Pebbles'), hp: 0, drops: [['stone', 1, 2]], respawn: 300, r: 0.2, gather: true },
};

// ── Zvířata ─────────────────────────────────────────────────────────────────
const ANIMALS = {
  rabbit: { name: L('Zajíc', 'Rabbit'), hp: 12, speed: 6.5, flee: true, drops: [['rawMeat', 1, 1], ['hide', 0, 1]], color: '#c9b49a', size: 0.45 },
  deer: { name: L('Jelen', 'Deer'), hp: 40, speed: 7.5, flee: true, drops: [['rawMeat', 2, 3], ['hide', 2, 2]], color: '#a8743f', size: 1.2 },
  wolf: { name: L('Vlk', 'Wolf'), hp: 45, speed: 6.8, flee: false, dmg: 11, drops: [['rawMeat', 1, 2], ['hide', 1, 2]], color: '#4a4c55', size: 1 },
  bear: { name: L('Medvěd', 'Bear'), hp: 160, speed: 6.1, flee: false, dmg: 24, drops: [['rawMeat', 3, 4], ['fur', 2, 3], ['hide', 1, 2]], color: '#5c4030', size: 1.6 },
};

// ── Úspěchy ─────────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: 'tool', name: L('Doba kamenná', 'Stone Age'), desc: L('Vyrob první nástroj.', 'Craft your first tool.'), icon: 'axe', prog: S => [S.stats.tools, 1] },
  { id: 'fire', name: L('Prométheus', 'Prometheus'), desc: L('Postav táborák.', 'Build a campfire.'), icon: 'fire', prog: S => [S.stats.fires, 1] },
  { id: 'night1', name: L('První noc', 'First Night'), desc: L('Přežij první noc.', 'Survive your first night.'), icon: 'moon', prog: S => [S.stats.bestDays, 2] },
  { id: 'days5', name: L('Trosečník', 'Castaway'), desc: L('Přežij 5 dní.', 'Survive 5 days.'), icon: 'sun', prog: S => [S.stats.bestDays, 5] },
  { id: 'days15', name: L('Robinson', 'Robinson'), desc: L('Přežij 15 dní.', 'Survive 15 days.'), icon: 'sun', prog: S => [S.stats.bestDays, 15] },
  { id: 'days40', name: L('Pán ostrova', 'Lord of the Isle'), desc: L('Přežij 40 dní.', 'Survive 40 days.'), icon: 'trophy', prog: S => [S.stats.bestDays, 40] },
  { id: 'wolf', name: L('Lovec vlků', 'Wolf Slayer'), desc: L('Zabij vlka.', 'Kill a wolf.'), icon: 'wolf', prog: S => [S.stats.wolves, 1] },
  { id: 'wolf25', name: L('Alfa', 'Alpha'), desc: L('Zabij 25 vlků.', 'Kill 25 wolves.'), icon: 'wolf', prog: S => [S.stats.wolves, 25] },
  { id: 'deer', name: L('Lovec', 'Hunter'), desc: L('Ulov jelena.', 'Hunt a deer.'), icon: 'deer', prog: S => [S.stats.deer, 1] },
  { id: 'iron', name: L('Doba železná', 'Iron Age'), desc: L('Vytav železo.', 'Smelt iron.'), icon: 'ingot', prog: S => [S.stats.iron, 1] },
  { id: 'shelter', name: L('Střecha nad hlavou', 'A Roof Overhead'), desc: L('Postav přístřešek.', 'Build a shelter.'), icon: 'tent', prog: S => [S.stats.shelters, 1] },
  { id: 'trees100', name: L('Dřevorubec', 'Lumberjack'), desc: L('Pokácej 100 stromů.', 'Fell 100 trees.'), icon: 'wood', prog: S => [S.stats.trees, 100] },
  { id: 'rocks100', name: L('Horník', 'Miner'), desc: L('Vytěž 100 skal.', 'Mine 100 rocks.'), icon: 'pick', prog: S => [S.stats.rocks, 100] },
  { id: 'escape', name: L('Na volné moře', 'To the Open Sea'), desc: L('Unikni z ostrova na voru.', 'Escape the island on a raft.'), icon: 'raft', prog: S => [S.stats.escapes, 1] },
  { id: 'escapeHard', name: L('Nezlomný', 'Unbroken'), desc: L('Unikni v drsném režimu.', 'Escape in Harsh mode.'), icon: 'raft', prog: S => [S.stats.hardEscapes, 1] },
  { id: 'fast', name: L('Rychlý útěk', 'Swift Escape'), desc: L('Unikni do 8. dne.', 'Escape before day 8.'), icon: 'bolt', prog: S => [S.stats.fastEscape, 1] },
  { id: 'fish', name: L('Rybář', 'Angler'), desc: L('Chyť rybu.', 'Catch a fish.'), icon: 'fish', prog: S => [S.stats.fish, 1] },
  { id: 'fish25', name: L('Mořský vlk', 'Old Salt'), desc: L('Chyť 25 ryb.', 'Catch 25 fish.'), icon: 'fish', prog: S => [S.stats.fish, 25] },
  { id: 'archer', name: L('Lučištník', 'Archer'), desc: L('Skol 10 zvířat šípem.', 'Take down 10 animals with arrows.'), icon: 'bow', prog: S => [S.stats.bowKills, 10] },
  { id: 'bear', name: L('Starý Šedák', 'Old Grey'), desc: L('Poraz medvěda.', 'Defeat a bear.'), icon: 'bear', prog: S => [S.stats.bears, 1] },
  { id: 'garden', name: L('Zahradník', 'Gardener'), desc: L('Sklidíš 5 úrod.', 'Harvest 5 crops.'), icon: 'garden', prog: S => [S.stats.harvests, 5] },
  { id: 'notes', name: L('Archivář', 'Archivist'), desc: L('Najdi všech 8 vzkazů.', 'Find all 8 messages.'), icon: 'note', prog: S => [Object.keys(S.notes || {}).length, 8] },
  { id: 'chart', name: L('Kartograf', 'Cartographer'), desc: L('Slož námořní mapu.', 'Assemble the sea chart.'), icon: 'chart', prog: S => [S.stats.charts, 1] },
  { id: 'daily10', name: L('Pracant', 'Hard Worker'), desc: L('Splň 10 denních úkolů.', 'Complete 10 daily tasks.'), icon: 'star', prog: S => [S.stats.dailies, 10] },
  { id: 'master', name: L('Mistr ostrova', 'Island Master'), desc: L('Dosáhni 10. úrovně v dovednosti.', 'Reach level 10 in a skill.'), icon: 'up', prog: S => [S.stats.maxSkill, 10] },
];

// ── Dovednosti: zkušenosti za práci, úrovně 1–10 a jejich bonusy ────────────
const SKILL_MAX = 10;
const SKILLS = {
  gather: { name: L('Těžba', 'Gathering'), icon: 'axe', color: '#ffb347', perks: l => [L(`+${(l - 1) * 10} % síla úderu`, `+${(l - 1) * 10}% strike power`), L(`${(l - 1) * 4} % šance na surovinu navíc`, `${(l - 1) * 4}% chance of extra yield`)] },
  hunt: { name: L('Lov', 'Hunting'), icon: 'bow', color: '#ff7a6a', perks: l => [L(`+${(l - 1) * 7} % poškození zbraní`, `+${(l - 1) * 7}% weapon damage`), L(`o ${(l - 1) * 6} % rychlejší záběr a nátah`, `${(l - 1) * 6}% faster bites and draws`)] },
  survive: { name: L('Přežití', 'Survival'), icon: 'fire', color: '#7fe0d0', perks: l => [L(`o ${(l - 1) * 4} % pomalejší hlad a žízeň`, `${(l - 1) * 4}% slower hunger and thirst`), L(`${(l - 1) * 5} % šance, že se nástroj neopotřebí`, `${(l - 1) * 5}% chance tools don't wear`)] },
};
const xpNeed = l => Math.round(30 * Math.pow(l, 1.55));

const MODES = {
  calm: { name: L('Klidný', 'Calm'), desc: L('Pomalejší hlad a žízeň, méně vlků. Po smrti se probudíš u přístřešku.', 'Slower hunger and thirst, fewer wolves. Respawn at your shelter after death.'), drain: 0.6, wolves: 0.5, perma: false },
  normal: { name: L('Normální', 'Normal'), desc: L('Vyvážené přežití. Po smrti zůstane inventář ležet tam, kde jsi padl.', 'Balanced survival. On death your inventory stays where you fell.'), drain: 1, wolves: 1, perma: false, dropInv: true },
  harsh: { name: L('Drsný', 'Harsh'), desc: L('Rychlejší hlad, smečky vlků a jen jeden život.', 'Faster hunger, wolf packs, and only one life.'), drain: 1.35, wolves: 1.6, perma: true },
};
