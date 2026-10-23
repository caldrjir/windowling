'use strict';
// ── Pomocné funkce ──────────────────────────────────────────────────────────
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (a, n) => shuffle(a.slice()).slice(0, n);
const fmtNum = n => Math.floor(n).toLocaleString(L('cs-CZ', 'en-US'));
const fmtTime = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${m} min` : `${m} min`; };
// české skloňování: plural(n, 'karta', 'karty', 'karet')
const plural = (n, one, few, many) => n === 1 ? one : n >= 2 && n <= 4 ? few : many;

// ── Ikony (SVG 24×24) ───────────────────────────────────────────────────────
const ICONS = {
  sword: '<path d="M14.5 3.5H20.5V9.5L9 21l-6-6z"/><path d="M5 13l6 6M3 21l3-3"/>',
  swords: '<path d="M4 4l9 9M20 4l-9 9M7 17l-3 3M17 17l3 3M4 4h4M4 4v4M20 4h-4M20 4v4"/>',
  shield: '<path d="M12 2.5l8 3v6c0 5-3.5 8.8-8 10.5-4.5-1.7-8-5.5-8-10.5v-6z"/>',
  bolt: '<path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5z"/>',
  flame: '<path d="M12 22c4.4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 2.6 7 7 7z"/>',
  drop: '<path d="M12 2.5s7 7.5 7 12a7 7 0 01-14 0c0-4.5 7-12 7-12z"/><path d="M9 15a3 3 0 003 3"/>',
  star: '<path d="M12 2.5l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.6l-6.2 3.6 1.6-6.9-5.3-4.7 7-.7z"/>',
  sparkle: '<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3.5 3.5M15.5 15.5L19 19M5 19l3.5-3.5M15.5 8.5L19 5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  dagger: '<path d="M18 3l3 3-11 11-3-3z"/><path d="M5 16l3 3M3 21l3-3"/>',
  fist: '<path d="M7 11V6a2 2 0 014 0v5M11 10V5a2 2 0 014 0v6M15 10V7a2 2 0 014 0v6c0 5-3 8-7 8s-7-3-7-7v-3a2 2 0 014 0"/>',
  heart: '<path d="M12 20.5s-8.5-4.8-8.5-11a4.6 4.6 0 018.5-2.4 4.6 4.6 0 018.5 2.4c0 6.2-8.5 11-8.5 11z"/>',
  card: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  cards: '<rect x="8" y="5" width="12" height="16" rx="2"/><path d="M16 5V4a1 1 0 00-1-1H5a1 1 0 00-1 1v14a1 1 0 001 1h3"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>',
  skull: '<path d="M12 2.5c-5 0-8.5 3.5-8.5 8 0 3 1.5 5 3.5 6v3.5h10V16.5c2-1 3.5-3 3.5-6 0-4.5-3.5-8-8.5-8z"/><circle cx="8.8" cy="11" r="1.8"/><circle cx="15.2" cy="11" r="1.8"/>',
  hourglass: '<path d="M6 2.5h12M6 21.5h12M7 2.5c0 5 5 6 5 9.5S7 16.5 7 21.5M17 2.5c0 5-5 6-5 9.5s5 4.5 5 9.5"/>',
  comet: '<circle cx="16" cy="8" r="4"/><path d="M13 11L3 21M11 8L4 15M16 13l-7 7"/>',
  wave: '<path d="M2 12c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-3 5-2"/><path d="M2 17c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-3 5-2" opacity=".5"/>',
  crown: '<path d="M3 7l4 4 5-7 5 7 4-4-2 12H5z"/><path d="M5 19h14"/>',
  gem: '<path d="M6.5 3.5h11l4 5.5-10 11.5L1.5 9z"/><path d="M1.5 9h20"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1.2 1.3-2 3-2s3 .8 3 2-1.3 2-3 2.5-3 1.3-3 2.5 1.3 2 3 2 3-.8 3-2"/>',
  potion: '<path d="M9 2.5h6M10 2.5v6L5 18a2.5 2.5 0 002.2 3.5h9.6A2.5 2.5 0 0019 18l-5-9.5v-6"/><path d="M7 15h10"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  fire: '<path d="M12 22c4.4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 2.6 7 7 7z"/>',
  anvil: '<path d="M3 8h13a5 5 0 01-5 5H9v3h3v4H5v-4h3v-3H6a3 3 0 01-3-3z"/><path d="M16 8h5"/>',
  bag: '<path d="M6 8h12l1.5 13h-15z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  question: '<circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.5a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4M12 17v.5"/>',
  chest: '<rect x="3" y="9" width="18" height="11" rx="1.5"/><path d="M3 9l2-5h14l2 5M10.5 12.5h3v3h-3z"/>',
  boss: '<path d="M3 7l4 4 5-7 5 7 4-4-2 12H5z"/>',
  elite: '<path d="M12 2l3 6 6 .5-4.5 4.5L18 20l-6-3.5L6 20l1.5-7L3 8.5 9 8z"/><circle cx="12" cy="11.5" r="2"/>',
  battle: '<path d="M4 4l9 9M20 4l-9 9M7 17l-3 3M17 17l3 3"/>',
  rest: '<path d="M12 21c3.9 0 6-2.5 6-5.5 0-3.5-3-5-3-9-2.5 1.5-3 4-3 5.5-1-1-1.5-2-1.5-3.5C8.5 10 6 12 6 15.5 6 18.5 8.1 21 12 21z"/><path d="M4 22h16"/>',
  shop: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 018 0v3.5"/>',
  trophy: '<path d="M7 3.5h10v5a5 5 0 01-10 0z"/><path d="M7 5H3.5v1.5A3.5 3.5 0 007 10M17 5h3.5v1.5A3.5 3.5 0 0117 10M12 13.5V17M8 21h8"/>',
  home: '<path d="M3 11l9-7.5 9 7.5"/><path d="M5.5 9v11.5h13V9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 1.5v3M12 19.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M1.5 12h3M19.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
  book: '<path d="M4 4.5A2 2 0 016 2.5h14v16H6a2 2 0 00-2 2z"/><path d="M4 20.5a2 2 0 002 2h14v-4"/>',
  play: '<path d="M7 4.5l13 7.5-13 7.5z"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  spiral: '<path d="M12 12a2 2 0 012-2 4 4 0 014 4 6 6 0 01-6 6 8 8 0 01-8-8 10 10 0 0110-10"/>',
  thorn: '<path d="M12 2v20M5 7l7 3 7-3M5 17l7-3 7 3"/>',
  anchor: '<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V21M5 13a7 7 0 0014 0M8 11h8"/>',
  feather: '<path d="M20 4C10 4 5 10 5 19M20 4c0 8-5 12-12 12M5 19l-2 2"/>',
  clover: '<circle cx="9" cy="9" r="3.5"/><circle cx="15" cy="9" r="3.5"/><circle cx="12" cy="14" r="3.5"/><path d="M12 17v5"/>',
  hand: '<path d="M8 13V5a1.5 1.5 0 013 0v6M11 11V4a1.5 1.5 0 013 0v7M14 11V5.5a1.5 1.5 0 013 0V14c0 4-2.5 7-6 7-3 0-5-2-6.5-4.5L3 13.5a1.5 1.5 0 012.5-1.5L8 15"/>',
  zz: '<path d="M4 6h6l-6 7h6M13 10h7l-7 9h7"/>',
};
const icon = (id, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[id] || ICONS.star}</svg>`;

// ── Stavy (buffy a debuffy) ─────────────────────────────────────────────────
// turn: 'decay' = ubývá na konci kola nositele
const STATUS = {
  str: { name: L('Síla', 'Strength'), icon: 'fist', color: '#ff8a5c', desc: v => L(`Útoky způsobují o ${v} více poškození.`, `Attacks deal ${v} more damage.`) },
  dex: { name: L('Obratnost', 'Dexterity'), icon: 'feather', color: '#7cf0b6', desc: v => L(`Karty dávají o ${v} více bloku.`, `Cards grant ${v} more Block.`) },
  vuln: { name: L('Zranitelnost', 'Vulnerable'), icon: 'eye', color: '#ff5fa2', debuff: true, decay: true, desc: v => L(`Útoky proti tobě způsobují o 50 % více. ${v} ${plural(v, 'kolo', 'kola', 'kol')}.`, `Takes 50% more attack damage. ${v} turn(s).`) },
  weak: { name: L('Slabost', 'Weak'), icon: 'down', color: '#9aa4ff', debuff: true, decay: true, desc: v => L(`Útoky způsobují o 25 % méně. ${v} ${plural(v, 'kolo', 'kola', 'kol')}.`, `Deals 25% less attack damage. ${v} turn(s).`) },
  poison: { name: L('Jed', 'Poison'), icon: 'drop', color: '#8dff5a', debuff: true, desc: v => L(`Na začátku kola ztratí ${v} životů, pak jed klesne o 1.`, `Loses ${v} HP at the start of its turn, then Poison drops by 1.`) },
  burn: { name: L('Hoření', 'Burn'), icon: 'flame', color: '#ffb03b', debuff: true, desc: v => L(`Na konci tvého kola ztratí ${v} životů, pak se hoření zpolovičí.`, `Loses ${v} HP at the end of your turn, then Burn halves.`) },
  thorns: { name: L('Trny', 'Thorns'), icon: 'thorn', color: '#d0a0ff', desc: v => L(`Útočník utrží ${v} poškození.`, `Attackers take ${v} damage.`) },
  fthorns: { name: L('Plamenná bariéra', 'Flame Barrier'), icon: 'flame', color: '#ff7a3d', desc: v => L(`Do tvého dalšího kola útočníci utrží ${v} poškození.`, `Until your next turn, attackers take ${v} damage.`) },
  ritual: { name: L('Rituál', 'Ritual'), icon: 'moon', color: '#ff6b6b', desc: v => L(`Na začátku kola získá ${v} síly.`, `Gains ${v} Strength at the start of its turn.`) },
  metal: { name: L('Pancéřování', 'Metallicize'), icon: 'shield', color: '#b9c6ff', desc: v => L(`Na konci kola získá ${v} bloku.`, `Gains ${v} Block at the end of its turn.`) },
  barricade: { name: L('Hradba', 'Barricade'), icon: 'shield', color: '#ffd166', desc: () => L('Blok na začátku kola nezmizí.', 'Block is not removed at the start of your turn.') },
  flex: { name: L('Napětí', 'Flex'), icon: 'fist', color: '#ff9c7a', debuff: true, desc: v => L(`Na konci kola ztratíš ${v} síly.`, `Lose ${v} Strength at the end of your turn.`) },
  focus: { name: L('Ohnisko', 'Focus'), icon: 'sun', color: '#ffd166', desc: v => L(`Uvalené hoření je o ${v} silnější.`, `Burn you apply is increased by ${v}.`) },
  inferno: { name: L('Peklo', 'Inferno'), icon: 'fire', color: '#ff7a3d', desc: v => L(`Na konci kola uvalí ${v} hoření na všechny nepřátele.`, `At the end of your turn, apply ${v} Burn to ALL enemies.`) },
  nextEnergy: { name: L('Příliv', 'Surge'), icon: 'bolt', color: '#7fd8ff', desc: v => L(`Příští kolo získáš ${v} energie navíc.`, `Gain ${v} extra Energy next turn.`) },
  astral: { name: L('Astrální forma', 'Astral Form'), icon: 'star', color: '#b99bff', desc: v => L(`Na začátku kola líznutí +${v} a energie +${v}.`, `At the start of your turn, draw ${v} more and gain ${v} Energy.`) },
  echo: { name: L('Ozvěna', 'Echo'), icon: 'spiral', color: '#c0a8ff', desc: v => L(`Příští ${v} ${plural(v, 'karta se zahraje', 'karty se zahrají', 'karet se zahraje')} dvakrát.`, `Your next ${v} card(s) are played twice.`) },
  fumes: { name: L('Jedovaté výpary', 'Noxious Fumes'), icon: 'drop', color: '#8dff5a', desc: v => L(`Na začátku kola uvalí ${v} jedu na všechny nepřátele.`, `At the start of your turn, apply ${v} Poison to ALL enemies.`) },
  blades: { name: L('Nekonečné čepele', 'Infinite Blades'), icon: 'dagger', color: '#9fffd4', desc: v => L(`Na začátku kola přidá ${v} ${plural(v, 'Dýku', 'Dýky', 'Dýk')} do ruky.`, `At the start of your turn, add ${v} Shiv(s) to your hand.`) },
  accuracy: { name: L('Přesnost', 'Accuracy'), icon: 'eye', color: '#9fffd4', desc: v => L(`Dýky způsobují o ${v} více poškození.`, `Shivs deal ${v} more damage.`) },
  envenom: { name: L('Otrávené ostří', 'Envenom'), icon: 'drop', color: '#8dff5a', desc: v => L(`Neblokované útočné poškození uvalí ${v} jedu.`, `Unblocked attack damage applies ${v} Poison.`) },
  regen: { name: L('Regenerace', 'Regen'), icon: 'heart', color: '#7cf0b6', desc: v => L(`Na konci kola vyléčí ${v} životů, pak klesne o 1.`, `Heals ${v} HP at the end of the turn, then drops by 1.`) },
  enrage: { name: L('Zuřivost', 'Enrage'), icon: 'fist', color: '#ff6b6b', desc: v => L(`Když zahraješ dovednost, získá ${v} síly.`, `Whenever you play a Skill, gains ${v} Strength.`) },
  curl: { name: L('Schoulení', 'Curl Up'), icon: 'shield', color: '#b9c6ff', desc: v => L(`Při prvním zásahu získá ${v} bloku.`, `Gains ${v} Block the first time it takes damage.`) },
  sleep: { name: L('Spánek', 'Asleep'), icon: 'zz', color: '#8fa0c8', desc: () => L('Spí. Probudí se po zásahu nebo za pár kol.', 'Asleep. Wakes when damaged or after a few turns.') },
  artifact: { name: L('Artefakt', 'Artifact'), icon: 'gem', color: '#ffe08a', desc: v => L(`Zablokuje příští ${v} ${plural(v, 'debuff', 'debuffy', 'debuffů')}.`, `Negates the next ${v} debuff(s).`) },
  demon: { name: L('Hvězdná zuřivost', 'Star Fury'), icon: 'sun', color: '#ff8a5c', desc: v => L(`Na začátku kola získáš ${v} síly.`, `Gain ${v} Strength at the start of your turn.`) },
};
const DEBUFFS = Object.keys(STATUS).filter(k => STATUS[k].debuff);

// ── Hrdinové ────────────────────────────────────────────────────────────────
const HEROES = {
  knight: {
    name: L('Strážce', 'Warden'), title: L('Rytíř Lva', 'Knight of the Lion'), color: '#ffb547', hp: 80, gold: 99,
    desc: L('Neprostupná obrana, drtivá síla. Blok a síla jsou jeho řečí.', 'Impenetrable defense, crushing strength. Block and Strength are his language.'),
    deck: ['strike_k', 'strike_k', 'strike_k', 'strike_k', 'strike_k', 'defend_k', 'defend_k', 'defend_k', 'defend_k', 'bash'], relic: 'lionheart', unlock: null,
  },
  mage: {
    name: L('Astromantka', 'Astromancer'), title: L('Dcera Komety', 'Daughter of the Comet'), color: '#7fb4ff', hp: 75, gold: 99,
    desc: L('Spaluje nepřátele hvězdným ohněm a ohýbá samotný čas.', 'Burns her foes with starfire and bends time itself.'),
    deck: ['strike_m', 'strike_m', 'strike_m', 'strike_m', 'defend_m', 'defend_m', 'defend_m', 'defend_m', 'spark', 'spark'], relic: 'emberCore', unlock: 'act1',
  },
  rogue: {
    name: L('Stín', 'Shade'), title: L('Vrah ze Štíra', 'Assassin of the Scorpion'), color: '#6fffb0', hp: 70, gold: 99,
    desc: L('Jed, čepele a rychlost. Tisíc malých ran.', 'Poison, blades and speed. Death by a thousand cuts.'),
    deck: ['strike_r', 'strike_r', 'strike_r', 'strike_r', 'strike_r', 'defend_r', 'defend_r', 'defend_r', 'defend_r', 'defend_r', 'neutralize', 'survivor'], relic: 'serpentRing', unlock: 'act2',
  },
};

// ── Karty ───────────────────────────────────────────────────────────────────
// fx: dmg (n = počet zásahů), block, draw, energy, apply {s, v, to}, heal, loseHp, add {card, v, to}, sp = speciální
// up: přepsání polí po vylepšení
const C = (id, cls, type, rarity, cost, target, name, iconId, fx, up, extra = {}) => ({ id, cls, type, rarity, cost, target, name, icon: iconId, fx, up, ...extra });
const CARD_LIST = [
  // ── Strážce ──
  C('strike_k', 'knight', 'attack', 'starter', 1, 'enemy', L('Úder', 'Strike'), 'sword', [{ dmg: 6 }], { fx: [{ dmg: 9 }] }),
  C('defend_k', 'knight', 'skill', 'starter', 1, 'self', L('Obrana', 'Defend'), 'shield', [{ block: 5 }], { fx: [{ block: 8 }] }),
  C('bash', 'knight', 'attack', 'starter', 2, 'enemy', L('Drtivý úder', 'Bash'), 'fist', [{ dmg: 8 }, { apply: 'vuln', v: 2 }], { fx: [{ dmg: 10 }, { apply: 'vuln', v: 3 }] }),
  C('cleave', 'knight', 'attack', 'common', 1, 'all', L('Rozsek', 'Cleave'), 'swords', [{ dmg: 8 }], { fx: [{ dmg: 11 }] }),
  C('ironWave', 'knight', 'attack', 'common', 1, 'enemy', L('Železná vlna', 'Iron Wave'), 'wave', [{ block: 5 }, { dmg: 5 }], { fx: [{ block: 7 }, { dmg: 7 }] }),
  C('pommel', 'knight', 'attack', 'common', 1, 'enemy', L('Hlavicí meče', 'Pommel Strike'), 'sword', [{ dmg: 9 }, { draw: 1 }], { fx: [{ dmg: 10 }, { draw: 2 }] }),
  C('shrug', 'knight', 'skill', 'common', 1, 'self', L('Setřást', 'Shrug It Off'), 'shield', [{ block: 8 }, { draw: 1 }], { fx: [{ block: 11 }, { draw: 1 }] }),
  C('twinStrike', 'knight', 'attack', 'common', 1, 'enemy', L('Dvojitý úder', 'Twin Strike'), 'swords', [{ dmg: 5, n: 2 }], { fx: [{ dmg: 7, n: 2 }] }),
  C('heavyBlade', 'knight', 'attack', 'common', 2, 'enemy', L('Těžká čepel', 'Heavy Blade'), 'sword', [{ dmg: 14, strMult: 3 }], { fx: [{ dmg: 14, strMult: 5 }] }),
  C('flex', 'knight', 'skill', 'common', 0, 'self', L('Napnout svaly', 'Flex'), 'fist', [{ apply: 'str', v: 2, to: 'self' }, { apply: 'flex', v: 2, to: 'self' }], { fx: [{ apply: 'str', v: 4, to: 'self' }, { apply: 'flex', v: 4, to: 'self' }] }),
  C('bodySlam', 'knight', 'attack', 'common', 1, 'enemy', L('Náraz tělem', 'Body Slam'), 'shield', [{ sp: 'bodySlam' }], { cost: 0 }),
  C('uppercut', 'knight', 'attack', 'uncommon', 2, 'enemy', L('Zvedák', 'Uppercut'), 'fist', [{ dmg: 13 }, { apply: 'weak', v: 1 }, { apply: 'vuln', v: 1 }], { fx: [{ dmg: 13 }, { apply: 'weak', v: 2 }, { apply: 'vuln', v: 2 }] }),
  C('shockwave', 'knight', 'skill', 'uncommon', 2, 'all', L('Rázová vlna', 'Shockwave'), 'wave', [{ apply: 'weak', v: 3, to: 'all' }, { apply: 'vuln', v: 3, to: 'all' }], { fx: [{ apply: 'weak', v: 5, to: 'all' }, { apply: 'vuln', v: 5, to: 'all' }] }, { exhaust: true }),
  C('inflame', 'knight', 'power', 'uncommon', 1, 'self', L('Vznícení', 'Inflame'), 'flame', [{ apply: 'str', v: 2, to: 'self' }], { fx: [{ apply: 'str', v: 3, to: 'self' }] }),
  C('metallicize', 'knight', 'power', 'uncommon', 1, 'self', L('Pancéřování', 'Metallicize'), 'shield', [{ apply: 'metal', v: 3, to: 'self' }], { fx: [{ apply: 'metal', v: 4, to: 'self' }] }),
  C('flameBarrier', 'knight', 'skill', 'uncommon', 2, 'self', L('Plamenná bariéra', 'Flame Barrier'), 'flame', [{ block: 12 }, { apply: 'fthorns', v: 4, to: 'self' }], { fx: [{ block: 16 }, { apply: 'fthorns', v: 6, to: 'self' }] }),
  C('entrench', 'knight', 'skill', 'uncommon', 2, 'self', L('Zakopat se', 'Entrench'), 'anchor', [{ sp: 'entrench' }], { cost: 1 }),
  C('rally', 'knight', 'skill', 'uncommon', 1, 'self', L('Válečný pokřik', 'Battle Cry'), 'sun', [{ draw: 2 }, { apply: 'str', v: 1, to: 'self' }], { fx: [{ draw: 3 }, { apply: 'str', v: 1, to: 'self' }] }, { exhaust: true }),
  C('bludgeon', 'knight', 'attack', 'rare', 3, 'enemy', L('Palcát', 'Bludgeon'), 'fist', [{ dmg: 32 }], { fx: [{ dmg: 42 }] }),
  C('barricade', 'knight', 'power', 'rare', 3, 'self', L('Hradba', 'Barricade'), 'shield', [{ apply: 'barricade', v: 1, to: 'self' }], { cost: 2 }),
  C('lionForm', 'knight', 'power', 'rare', 3, 'self', L('Lví podoba', 'Lion Form'), 'sun', [{ apply: 'demon', v: 2, to: 'self' }], { fx: [{ apply: 'demon', v: 3, to: 'self' }] }),
  C('impervious', 'knight', 'skill', 'rare', 2, 'self', L('Neprůstřelný', 'Impervious'), 'shield', [{ block: 30 }], { fx: [{ block: 40 }] }, { exhaust: true }),
  C('feed', 'knight', 'attack', 'rare', 1, 'enemy', L('Hostina', 'Feed'), 'heart', [{ dmg: 10 }, { sp: 'feed', v: 3 }], { fx: [{ dmg: 12 }, { sp: 'feed', v: 4 }] }, { exhaust: true }),
  C('offering', 'knight', 'skill', 'rare', 0, 'self', L('Oběť', 'Offering'), 'heart', [{ loseHp: 6 }, { energy: 2 }, { draw: 3 }], { fx: [{ loseHp: 6 }, { energy: 2 }, { draw: 5 }] }, { exhaust: true }),
  // ── Astromantka ──
  C('strike_m', 'mage', 'attack', 'starter', 1, 'enemy', L('Úder', 'Strike'), 'sword', [{ dmg: 6 }], { fx: [{ dmg: 9 }] }),
  C('defend_m', 'mage', 'skill', 'starter', 1, 'self', L('Obrana', 'Defend'), 'shield', [{ block: 5 }], { fx: [{ block: 8 }] }),
  C('spark', 'mage', 'attack', 'starter', 1, 'enemy', L('Jiskra', 'Spark'), 'sparkle', [{ dmg: 5 }, { apply: 'burn', v: 3 }], { fx: [{ dmg: 7 }, { apply: 'burn', v: 4 }] }),
  C('fireball', 'mage', 'attack', 'common', 2, 'enemy', L('Ohnivá koule', 'Fireball'), 'flame', [{ dmg: 12 }, { apply: 'burn', v: 4 }], { fx: [{ dmg: 16 }, { apply: 'burn', v: 5 }] }),
  C('emberRain', 'mage', 'skill', 'common', 1, 'all', L('Déšť jisker', 'Ember Rain'), 'flame', [{ apply: 'burn', v: 4, to: 'all' }], { fx: [{ apply: 'burn', v: 6, to: 'all' }] }),
  C('frostShield', 'mage', 'skill', 'common', 1, 'enemy', L('Mrazivý štít', 'Frost Shield'), 'snow', [{ block: 7 }, { apply: 'weak', v: 1 }], { fx: [{ block: 10 }, { apply: 'weak', v: 2 }] }),
  C('arcaneMissile', 'mage', 'attack', 'common', 1, 'random', L('Arkánové střely', 'Arcane Missiles'), 'comet', [{ dmg: 3, n: 3 }], { fx: [{ dmg: 3, n: 4 }] }),
  C('insight', 'mage', 'skill', 'common', 0, 'self', L('Vhled', 'Insight'), 'eye', [{ draw: 2 }], { fx: [{ draw: 3 }] }, { exhaust: true }),
  C('ignite', 'mage', 'skill', 'common', 1, 'enemy', L('Zažehnout', 'Ignite'), 'fire', [{ sp: 'ignite' }], { cost: 0 }),
  C('iceLance', 'mage', 'attack', 'common', 1, 'enemy', L('Ledové kopí', 'Ice Lance'), 'snow', [{ dmg: 8 }, { apply: 'weak', v: 1 }], { fx: [{ dmg: 11 }, { apply: 'weak', v: 2 }] }),
  C('starfall', 'mage', 'attack', 'uncommon', 2, 'all', L('Pád hvězd', 'Starfall'), 'star', [{ dmg: 6, n: 2 }], { fx: [{ dmg: 8, n: 2 }] }),
  C('kindle', 'mage', 'power', 'uncommon', 1, 'self', L('Rozdmýchat', 'Kindle'), 'sun', [{ apply: 'focus', v: 1, to: 'self' }], { fx: [{ apply: 'focus', v: 2, to: 'self' }] }),
  C('manaSurge', 'mage', 'skill', 'uncommon', 1, 'self', L('Příliv many', 'Mana Surge'), 'bolt', [{ apply: 'nextEnergy', v: 2, to: 'self' }, { draw: 1 }], { fx: [{ apply: 'nextEnergy', v: 3, to: 'self' }, { draw: 1 }] }),
  C('blizzard', 'mage', 'skill', 'uncommon', 2, 'all', L('Vánice', 'Blizzard'), 'snow', [{ block: 10 }, { apply: 'weak', v: 2, to: 'all' }], { fx: [{ block: 14 }, { apply: 'weak', v: 3, to: 'all' }] }),
  C('comet', 'mage', 'attack', 'uncommon', 3, 'enemy', L('Kometa', 'Comet'), 'comet', [{ dmg: 24 }, { apply: 'burn', v: 6 }], { fx: [{ dmg: 30 }, { apply: 'burn', v: 8 }] }),
  C('timeSlip', 'mage', 'skill', 'uncommon', 1, 'self', L('Časový skluz', 'Time Slip'), 'hourglass', [{ block: 6 }, { draw: 2 }], { fx: [{ block: 9 }, { draw: 2 }] }),
  C('inferno', 'mage', 'power', 'rare', 2, 'self', L('Peklo', 'Inferno'), 'fire', [{ apply: 'inferno', v: 2, to: 'self' }], { fx: [{ apply: 'inferno', v: 3, to: 'self' }] }),
  C('detonate', 'mage', 'attack', 'rare', 1, 'enemy', L('Detonace', 'Detonate'), 'sparkle', [{ sp: 'detonate', v: 3 }], { fx: [{ sp: 'detonate', v: 4 }] }, { exhaust: true }),
  C('astralForm', 'mage', 'power', 'rare', 3, 'self', L('Astrální forma', 'Astral Form'), 'star', [{ apply: 'astral', v: 1, to: 'self' }], { cost: 2 }),
  C('timeWarp', 'mage', 'skill', 'rare', 1, 'self', L('Ohyb času', 'Time Warp'), 'hourglass', [{ energy: 2 }, { draw: 3 }], { fx: [{ energy: 3 }, { draw: 3 }] }, { exhaust: true }),
  C('prism', 'mage', 'skill', 'rare', 1, 'self', L('Hranol', 'Prism'), 'spiral', [{ apply: 'echo', v: 1, to: 'self' }], { fx: [{ apply: 'echo', v: 2, to: 'self' }] }),
  C('supernova', 'mage', 'attack', 'rare', 3, 'all', L('Supernova', 'Supernova'), 'sun', [{ dmg: 18 }, { apply: 'burn', v: 5, to: 'all' }], { fx: [{ dmg: 24 }, { apply: 'burn', v: 7, to: 'all' }] }, { exhaust: true }),
  // ── Stín ──
  C('strike_r', 'rogue', 'attack', 'starter', 1, 'enemy', L('Úder', 'Strike'), 'sword', [{ dmg: 6 }], { fx: [{ dmg: 9 }] }),
  C('defend_r', 'rogue', 'skill', 'starter', 1, 'self', L('Obrana', 'Defend'), 'shield', [{ block: 5 }], { fx: [{ block: 8 }] }),
  C('neutralize', 'rogue', 'attack', 'starter', 0, 'enemy', L('Zneškodnit', 'Neutralize'), 'dagger', [{ dmg: 3 }, { apply: 'weak', v: 1 }], { fx: [{ dmg: 4 }, { apply: 'weak', v: 2 }] }),
  C('survivor', 'rogue', 'skill', 'starter', 1, 'self', L('Přeživší', 'Survivor'), 'feather', [{ block: 8 }], { fx: [{ block: 11 }] }),
  C('deadlyPoison', 'rogue', 'skill', 'common', 1, 'enemy', L('Smrtící jed', 'Deadly Poison'), 'drop', [{ apply: 'poison', v: 5 }], { fx: [{ apply: 'poison', v: 7 }] }),
  C('bladeDance', 'rogue', 'skill', 'common', 1, 'self', L('Tanec čepelí', 'Blade Dance'), 'dagger', [{ add: 'shiv', v: 3 }], { fx: [{ add: 'shiv', v: 4 }] }),
  C('quickSlash', 'rogue', 'attack', 'common', 1, 'enemy', L('Rychlý sek', 'Quick Slash'), 'dagger', [{ dmg: 8 }, { draw: 1 }], { fx: [{ dmg: 12 }, { draw: 1 }] }),
  C('backflip', 'rogue', 'skill', 'common', 1, 'self', L('Přemet', 'Backflip'), 'feather', [{ block: 5 }, { draw: 2 }], { fx: [{ block: 8 }, { draw: 2 }] }),
  C('poisonedStab', 'rogue', 'attack', 'common', 1, 'enemy', L('Otrávené bodnutí', 'Poisoned Stab'), 'dagger', [{ dmg: 6 }, { apply: 'poison', v: 3 }], { fx: [{ dmg: 8 }, { apply: 'poison', v: 4 }] }),
  C('daggerSpray', 'rogue', 'attack', 'common', 1, 'all', L('Sprška dýk', 'Dagger Spray'), 'swords', [{ dmg: 4, n: 2 }], { fx: [{ dmg: 6, n: 2 }] }),
  C('cloak', 'rogue', 'skill', 'common', 1, 'self', L('Plášť a dýka', 'Cloak and Dagger'), 'dagger', [{ block: 6 }, { add: 'shiv', v: 1 }], { fx: [{ block: 6 }, { add: 'shiv', v: 2 }] }),
  C('bouncingFlask', 'rogue', 'skill', 'uncommon', 2, 'random', L('Odrazová lahvička', 'Bouncing Flask'), 'potion', [{ apply: 'poison', v: 3, n: 3 }], { fx: [{ apply: 'poison', v: 3, n: 4 }] }),
  C('footwork', 'rogue', 'power', 'uncommon', 1, 'self', L('Práce nohou', 'Footwork'), 'feather', [{ apply: 'dex', v: 2, to: 'self' }], { fx: [{ apply: 'dex', v: 3, to: 'self' }] }),
  C('fumes', 'rogue', 'power', 'uncommon', 1, 'self', L('Jedovaté výpary', 'Noxious Fumes'), 'drop', [{ apply: 'fumes', v: 2, to: 'self' }], { fx: [{ apply: 'fumes', v: 3, to: 'self' }] }),
  C('catalyst', 'rogue', 'skill', 'uncommon', 1, 'enemy', L('Katalyzátor', 'Catalyst'), 'drop', [{ sp: 'catalyst', v: 2 }], { fx: [{ sp: 'catalyst', v: 3 }] }, { exhaust: true }),
  C('legSweep', 'rogue', 'skill', 'uncommon', 2, 'enemy', L('Podražení', 'Leg Sweep'), 'feather', [{ apply: 'weak', v: 2 }, { block: 11 }], { fx: [{ apply: 'weak', v: 3 }, { block: 14 }] }),
  C('accuracy', 'rogue', 'power', 'uncommon', 1, 'self', L('Přesnost', 'Accuracy'), 'eye', [{ apply: 'accuracy', v: 4, to: 'self' }], { fx: [{ apply: 'accuracy', v: 6, to: 'self' }] }),
  C('infiniteBlades', 'rogue', 'power', 'uncommon', 1, 'self', L('Nekonečné čepele', 'Infinite Blades'), 'dagger', [{ apply: 'blades', v: 1, to: 'self' }], { cost: 0 }),
  C('adrenaline', 'rogue', 'skill', 'rare', 0, 'self', L('Adrenalin', 'Adrenaline'), 'bolt', [{ energy: 1 }, { draw: 2 }], { fx: [{ energy: 2 }, { draw: 2 }] }, { exhaust: true }),
  C('envenom', 'rogue', 'power', 'rare', 2, 'self', L('Otrávené ostří', 'Envenom'), 'drop', [{ apply: 'envenom', v: 1, to: 'self' }], { cost: 1 }),
  C('dieDieDie', 'rogue', 'attack', 'rare', 1, 'all', L('Zemři, zemři', 'Die Die Die'), 'skull', [{ dmg: 13 }], { fx: [{ dmg: 17 }] }, { exhaust: true }),
  C('stormOfSteel', 'rogue', 'skill', 'rare', 1, 'self', L('Ocelová bouře', 'Storm of Steel'), 'swords', [{ sp: 'storm' }], { fx: [{ sp: 'storm', v: 1 }] }),
  C('corrosion', 'rogue', 'skill', 'rare', 2, 'all', L('Rozklad', 'Corrosive Cloud'), 'drop', [{ apply: 'poison', v: 6, to: 'all' }, { apply: 'weak', v: 1, to: 'all' }], { fx: [{ apply: 'poison', v: 8, to: 'all' }, { apply: 'weak', v: 2, to: 'all' }] }, { exhaust: true }),
  // ── Bezbarvé ──
  C('swiftStrike', 'neutral', 'attack', 'uncommon', 0, 'enemy', L('Bleskový úder', 'Swift Strike'), 'bolt', [{ dmg: 7 }], { fx: [{ dmg: 10 }] }),
  C('flashSteel', 'neutral', 'attack', 'uncommon', 0, 'enemy', L('Záblesk oceli', 'Flash of Steel'), 'sword', [{ dmg: 3 }, { draw: 1 }], { fx: [{ dmg: 6 }, { draw: 1 }] }),
  C('bandage', 'neutral', 'skill', 'uncommon', 0, 'self', L('Obvaz', 'Bandage Up'), 'heart', [{ heal: 4 }], { fx: [{ heal: 6 }] }, { exhaust: true }),
  C('goodInstincts', 'neutral', 'skill', 'uncommon', 0, 'self', L('Instinkt', 'Good Instincts'), 'shield', [{ block: 6 }], { fx: [{ block: 9 }] }),
  C('masterStrategy', 'neutral', 'skill', 'rare', 0, 'self', L('Mistrovská strategie', 'Master of Strategy'), 'eye', [{ draw: 3 }], { fx: [{ draw: 4 }] }, { exhaust: true }),
  C('apotheosis', 'neutral', 'skill', 'rare', 2, 'self', L('Apoteóza', 'Apotheosis'), 'crown', [{ sp: 'apotheosis' }], { cost: 1 }, { exhaust: true }),
  C('handOfGreed', 'neutral', 'attack', 'rare', 2, 'enemy', L('Ruka chamtivosti', 'Hand of Greed'), 'coin', [{ dmg: 20 }, { sp: 'greed', v: 20 }], { fx: [{ dmg: 25 }, { sp: 'greed', v: 25 }] }),
  // ── Žetony a stavy ──
  C('shiv', 'token', 'attack', 'special', 0, 'enemy', L('Dýka', 'Shiv'), 'dagger', [{ dmg: 4, shiv: true }], { fx: [{ dmg: 6, shiv: true }] }, { exhaust: true }),
  C('dazed', 'status', 'status', 'special', -1, 'none', L('Omámení', 'Dazed'), 'spiral', [], null, { ethereal: true, text: () => L('Nelze zahrát. Pomíjivá.', 'Unplayable. Ethereal.') }),
  C('wound', 'status', 'status', 'special', -1, 'none', L('Rána', 'Wound'), 'drop', [], null, { text: () => L('Nelze zahrát.', 'Unplayable.') }),
  C('slimed', 'status', 'status', 'special', 1, 'self', L('Sliz', 'Slimed'), 'drop', [], null, { exhaust: true, text: () => L('Spálí se.', 'Exhaust.') }),
  C('scorch', 'status', 'status', 'special', -1, 'none', L('Popálenina', 'Scorch'), 'flame', [], null, { text: () => L('Nelze zahrát. Na konci kola v ruce: ztrať 2 životy.', 'Unplayable. At the end of your turn, if in hand, lose 2 HP.') }),
];
const CARDS = Object.fromEntries(CARD_LIST.map(c => [c.id, c]));
// speciální popisy
const SP_TEXT = {
  bodySlam: () => L('Způsob poškození rovné tvému bloku.', 'Deal damage equal to your Block.'),
  entrench: () => L('Zdvojnásob svůj blok.', 'Double your Block.'),
  feed: v => L(`Pokud zabije, trvale získej ${v} max. životů.`, `If this kills, raise your Max HP by ${v}.`),
  ignite: () => L('Zdvojnásob hoření cíle.', "Double the target's Burn."),
  detonate: v => L(`Způsob poškození rovné ${v}× hoření cíle. Odstraň jeho hoření.`, `Deal damage equal to ${v}× the target's Burn. Remove its Burn.`),
  catalyst: v => L(`${v === 3 ? 'Ztrojnásob' : 'Zdvojnásob'} jed cíle.`, `${v === 3 ? 'Triple' : 'Double'} the target's Poison.`),
  storm: v => L(`Odhoď ruku. Za každou kartu přidej ${v ? 'vylepšenou ' : ''}Dýku.`, `Discard your hand. Add ${v ? 'an upgraded ' : 'a '}Shiv for each card discarded.`),
  apotheosis: () => L('Vylepši všechny karty v tomto boji.', 'Upgrade ALL your cards for the rest of combat.'),
  greed: v => L(`Pokud zabije, získej ${v} zlata.`, `If this kills, gain ${v} Gold.`),
};

// ── Relikvie ────────────────────────────────────────────────────────────────
const RL = (id, rarity, iconId, color, name, desc, extra = {}) => ({ id, rarity, icon: iconId, color, name, desc, ...extra });
const RELIC_LIST = [
  RL('lionheart', 'starter', 'heart', '#ff7a5c', L('Lví srdce', 'Lionheart'), L('Po boji vyléčí 6 životů.', 'Heal 6 HP at the end of combat.')),
  RL('emberCore', 'starter', 'flame', '#ffb03b', L('Žhavé jádro', 'Ember Core'), L('Na začátku boje uvalí 3 hoření na všechny nepřátele.', 'At the start of combat, apply 3 Burn to ALL enemies.')),
  RL('serpentRing', 'starter', 'spiral', '#6fffb0', L('Hadí prsten', 'Serpent Ring'), L('V prvním kole lízneš 2 karty navíc.', 'Draw 2 extra cards on your first turn.')),
  RL('anchor', 'common', 'anchor', '#9fb4ff', L('Kotva', 'Anchor'), L('Začni každý boj s 10 bloku.', 'Start each combat with 10 Block.')),
  RL('marbles', 'common', 'eye', '#ff5fa2', L('Pytlík kuliček', 'Bag of Marbles'), L('Na začátku boje uvalí 1 zranitelnost na všechny.', 'At the start of combat, apply 1 Vulnerable to ALL enemies.')),
  RL('vajra', 'common', 'fist', '#ff8a5c', L('Vadžra', 'Vajra'), L('Začni každý boj s 1 sílou.', 'Start each combat with 1 Strength.')),
  RL('smoothStone', 'common', 'feather', '#7cf0b6', L('Hladký kámen', 'Smooth Stone'), L('Začni každý boj s 1 obratností.', 'Start each combat with 1 Dexterity.')),
  RL('bloodVial', 'common', 'drop', '#ff4d6d', L('Lahvička krve', 'Blood Vial'), L('Na začátku boje vyléčí 2 životy.', 'Heal 2 HP at the start of combat.')),
  RL('lantern', 'common', 'sun', '#ffd166', L('Lucerna', 'Lantern'), L('V prvním kole získáš 1 energii navíc.', 'Gain 1 extra Energy on your first turn.')),
  RL('penNib', 'common', 'feather', '#c0a8ff', L('Brk', 'Pen Nib'), L('Každý 10. útok způsobí dvojnásobné poškození.', 'Every 10th Attack deals double damage.'), { counter: 10 }),
  RL('orichalcum', 'common', 'shield', '#ffe08a', L('Orichalk', 'Orichalcum'), L('Když skončíš kolo bez bloku, získáš 6 bloku.', 'If you end your turn without Block, gain 6 Block.')),
  RL('strawberry', 'common', 'heart', '#ff6b8a', L('Jahoda', 'Strawberry'), L('Získáš 7 max. životů.', 'Raise your Max HP by 7.'), { onPickup: 'maxHp7' }),
  RL('mealTicket', 'common', 'coin', '#ffd166', L('Stravenka', 'Meal Ticket'), L('Při vstupu do obchodu vyléčí 15 životů.', 'Heal 15 HP whenever you enter a shop.')),
  RL('happyFlower', 'common', 'clover', '#8dff5a', L('Šťastná květina', 'Happy Flower'), L('Každé 3. kolo získáš 1 energii.', 'Every 3 turns, gain 1 Energy.')),
  RL('shuriken', 'uncommon', 'star', '#ff8a5c', L('Šuriken', 'Shuriken'), L('Za každé 3 útoky v kole získáš 1 sílu.', 'Every 3 Attacks in a turn, gain 1 Strength.')),
  RL('kunai', 'uncommon', 'dagger', '#7cf0b6', L('Kunaj', 'Kunai'), L('Za každé 3 útoky v kole získáš 1 obratnost.', 'Every 3 Attacks in a turn, gain 1 Dexterity.')),
  RL('fan', 'uncommon', 'wave', '#9fb4ff', L('Ozdobný vějíř', 'Ornamental Fan'), L('Za každé 3 útoky v kole získáš 4 bloku.', 'Every 3 Attacks in a turn, gain 4 Block.')),
  RL('letterOpener', 'uncommon', 'sword', '#c0a8ff', L('Nůž na dopisy', 'Letter Opener'), L('Za každé 3 dovednosti v kole způsobíš 5 poškození všem.', 'Every 3 Skills in a turn, deal 5 damage to ALL enemies.')),
  RL('hourglass', 'uncommon', 'hourglass', '#ffd166', L('Rtuťové přesýpací hodiny', 'Mercury Hourglass'), L('Na začátku kola způsobí 3 poškození všem nepřátelům.', 'At the start of your turn, deal 3 damage to ALL enemies.')),
  RL('hornCleat', 'uncommon', 'anchor', '#b9c6ff', L('Lodní kolík', 'Horn Cleat'), L('Na začátku 2. kola získáš 14 bloku.', 'At the start of your 2nd turn, gain 14 Block.')),
  RL('urn', 'uncommon', 'feather', '#b99bff', L('Ptačí urna', 'Bird-Faced Urn'), L('Když zahraješ sílu, vyléčíš 2 životy.', 'Whenever you play a Power, heal 2 HP.')),
  RL('questionCard', 'uncommon', 'question', '#7fd8ff', L('Karta otazníku', 'Question Card'), L('V odměnách si vybíráš ze 4 karet.', 'Card rewards offer 4 choices.')),
  RL('goldenIdol', 'uncommon', 'crown', '#ffd166', L('Zlatá modla', 'Golden Idol'), L('Získáváš o 25 % více zlata.', 'Gain 25% more Gold.')),
  RL('torii', 'rare', 'shield', '#ff6b6b', L('Torii', 'Torii'), L('Neblokované útoky za 5 a méně ti způsobí jen 1.', 'Unblocked attack damage of 5 or less is reduced to 1.')),
  RL('tungsten', 'rare', 'anchor', '#9fb4ff', L('Wolframová tyč', 'Tungsten Rod'), L('Každou ztrátu životů sníží o 1.', 'Whenever you would lose HP, lose 1 less.')),
  RL('iceCream', 'rare', 'snow', '#7fd8ff', L('Zmrzlina', 'Ice Cream'), L('Nevyužitá energie se přenáší do dalšího kola.', 'Unspent Energy is conserved between turns.')),
  RL('deadStar', 'rare', 'star', '#ffe08a', L('Mrtvá hvězda', 'Dead Star'), L('Když zabiješ nepřítele, získáš 1 energii a lízneš 1 kartu.', 'Whenever you kill an enemy, gain 1 Energy and draw 1 card.')),
  RL('mango', 'rare', 'heart', '#ffb547', L('Mango', 'Mango'), L('Získáš 14 max. životů.', 'Raise your Max HP by 14.'), { onPickup: 'maxHp14' }),
  // bossové
  RL('coffee', 'boss', 'bolt', '#c08a5c', L('Kávovar', 'Coffee Dripper'), L('+1 energie každé kolo. Na odpočívadle už nelze odpočívat.', '+1 Energy each turn. You can no longer rest at campfires.'), { energy: 1 }),
  RL('sozu', 'boss', 'drop', '#7fd8ff', L('Sozu', 'Sozu'), L('+1 energie každé kolo. Už nezískáváš lektvary.', '+1 Energy each turn. You can no longer obtain potions.'), { energy: 1 }),
  RL('ecto', 'boss', 'spiral', '#8dff5a', L('Ektoplazma', 'Ectoplasm'), L('+1 energie každé kolo. Už nezískáváš zlato.', '+1 Energy each turn. You can no longer gain Gold.'), { energy: 1 }),
  RL('philStone', 'boss', 'gem', '#ff4d6d', L('Kámen mudrců', "Philosopher's Stone"), L('+1 energie každé kolo. Nepřátelé začínají s 1 sílou.', '+1 Energy each turn. Enemies start with 1 Strength.'), { energy: 1 }),
  RL('snakeSkull', 'boss', 'skull', '#6fffb0', L('Hadí lebka', 'Snake Skull'), L('Kdykoli uvalíš jed, je o 1 silnější. Na začátku boje lízneš 1 kartu navíc.', 'Poison you apply is 1 stronger. Draw 1 extra card at the start of combat.')),
  RL('starChart', 'boss', 'map', '#b99bff', L('Hvězdná mapa', 'Star Chart'), L('Lízneš o 1 kartu víc každé kolo.', 'Draw 1 additional card each turn.')),
];
const RELICS = Object.fromEntries(RELIC_LIST.map(r => [r.id, r]));

// ── Lektvary ────────────────────────────────────────────────────────────────
const POTIONS = {
  fire: { name: L('Ohnivý lektvar', 'Fire Potion'), color: '#ff7a3d', target: 'enemy', desc: L('Způsob 20 poškození.', 'Deal 20 damage.') },
  block: { name: L('Lektvar bloku', 'Block Potion'), color: '#9fb4ff', target: 'self', desc: L('Získej 12 bloku.', 'Gain 12 Block.') },
  strength: { name: L('Lektvar síly', 'Strength Potion'), color: '#ff8a5c', target: 'self', desc: L('Získej 2 síly.', 'Gain 2 Strength.') },
  energy: { name: L('Lektvar energie', 'Energy Potion'), color: '#ffd166', target: 'self', desc: L('Získej 2 energie.', 'Gain 2 Energy.') },
  swift: { name: L('Lektvar rychlosti', 'Swift Potion'), color: '#7fd8ff', target: 'self', desc: L('Lízni 3 karty.', 'Draw 3 cards.') },
  fear: { name: L('Lektvar strachu', 'Fear Potion'), color: '#ff5fa2', target: 'enemy', desc: L('Uval 3 zranitelnosti.', 'Apply 3 Vulnerable.') },
  weak: { name: L('Lektvar slabosti', 'Weak Potion'), color: '#9aa4ff', target: 'enemy', desc: L('Uval 3 slabosti.', 'Apply 3 Weak.') },
  poison: { name: L('Jedový lektvar', 'Poison Potion'), color: '#8dff5a', target: 'enemy', desc: L('Uval 7 jedu.', 'Apply 7 Poison.') },
  heal: { name: L('Lektvar léčení', 'Healing Potion'), color: '#7cf0b6', target: 'self', desc: L('Vyléč 20 % max. životů.', 'Heal 20% of your Max HP.') },
  dex: { name: L('Lektvar obratnosti', 'Dexterity Potion'), color: '#7cf0b6', target: 'self', desc: L('Získej 2 obratnosti.', 'Gain 2 Dexterity.') },
};

// ── Nepřátelé ───────────────────────────────────────────────────────────────
// ai(e, B) vrací tah: { k: typ záměru, dmg, n, block, self: [[s,v]], debuff: [[s,v]], cards: [id, počet], heal, allBlock, allStr }
const mv = o => o;
const cycle = (e, list) => list[e.turn % list.length];
const ENEMIES = {
  // ── Akt I ──
  wisp: { name: L('Bludička', 'Wisp'), hp: [13, 17], art: ['orb', '#9fe8ff', 0.7], ai: e => (e.turn > 0 && e.last !== 'buff' && Math.random() < 0.3) ? mv({ k: 'buff', self: [['str', 2]], id: 'buff' }) : mv({ k: 'atk', dmg: 6, id: 'atk' }) },
  crab: { name: L('Rak', 'Cancer'), hp: [40, 44], art: ['crab', '#ff9a6b', 1], ai: e => cycle(e, [mv({ k: 'atk', dmg: 11 }), mv({ k: 'atkDef', dmg: 7, block: 6 }), mv({ k: 'buff', self: [['str', 3]] })]) },
  cultist: { name: L('Kultista', 'Cultist'), hp: [48, 54], art: ['humanoid', '#ff6b8a', 1, { hood: 1 }], ai: e => e.turn === 0 ? mv({ k: 'buff', self: [['ritual', 3]] }) : mv({ k: 'atk', dmg: 6 }) },
  louse: { name: L('Veš', 'Louse'), hp: [10, 15], art: ['bug', '#ff7ab8', 0.65], init: e => { e.s.curl = randi(3, 7); e.bite = randi(5, 7); }, ai: e => Math.random() < 0.25 && e.last !== 'debuff' ? mv({ k: 'debuff', debuff: [['weak', 2]], id: 'debuff' }) : mv({ k: 'atk', dmg: e.bite }) },
  slime: { name: L('Sliz', 'Slime'), hp: [28, 32], art: ['blob', '#8dff5a', 0.9], ai: e => e.last !== 'lick' && Math.random() < 0.3 ? mv({ k: 'debuff', debuff: [['weak', 1]], id: 'lick' }) : mv({ k: 'atkDebuff', dmg: 10, cards: ['slimed', 1] }) },
  jackal: { name: L('Šakal', 'Jackal'), hp: [22, 26], art: ['quad', '#ffcf7a', 0.8], ai: e => e.turn % 2 === 0 ? mv({ k: 'atk', dmg: 3, n: 2 }) : mv({ k: 'atkDebuff', dmg: 6, debuff: [['vuln', 1]] }) },
  taurus: { name: L('Býk', 'Taurus'), hp: [82, 86], elite: true, art: ['quad', '#ff6b4a', 1.4, { horns: 1 }], ai: e => e.turn === 0 ? mv({ k: 'buff', self: [['enrage', 2]] }) : (e.turn % 3 === 2 ? mv({ k: 'atkDebuff', dmg: 6, n: 2, debuff: [['vuln', 2]] }) : mv({ k: 'atk', dmg: 14 })) },
  colossus: { name: L('Spící kolos', 'Sleeping Colossus'), hp: [108, 112], elite: true, art: ['golem', '#b9c6ff', 1.45], init: e => { e.s.sleep = 1; e.s.metal = 8; e.sleepT = 3; }, ai: e => e.s.sleep ? mv({ k: 'sleep' }) : cycle(e, [mv({ k: 'atk', dmg: 18 }), mv({ k: 'atk', dmg: 18 }), mv({ k: 'debuff', debuff: [['str', -1], ['dex', -1]] })]) },
  sentry: { name: L('Strážní hvězda', 'Sentinel'), hp: [38, 42], elite: true, art: ['diamond', '#ffe08a', 0.8], ai: e => (e.turn + e.idx) % 2 === 0 ? mv({ k: 'debuff', cards: ['dazed', 2] }) : mv({ k: 'atk', dmg: 9 }) },
  orion: { name: L('Orion, Lovec', 'Orion the Hunter'), hp: [200, 200], boss: true, art: ['humanoid', '#7fd8ff', 1.9, { bow: 1, crown: 1 }], ai: e => {
    const c = e.turn % 4;
    if (c === 0) return mv({ k: 'atk', dmg: 5, n: 3 });
    if (c === 1) return mv({ k: 'def', block: 14, self: e.turn >= 4 ? [['str', 2]] : [] });
    if (c === 2) return mv({ k: 'atk', dmg: 22 });
    return mv({ k: 'debuff', debuff: [['weak', 2], ['vuln', 1]] });
  } },
  // ── Akt II ──
  harpy: { name: L('Harpyje', 'Harpy'), hp: [38, 44], art: ['bird', '#ff9ae0', 1], ai: e => cycle(e, [mv({ k: 'atk', dmg: 5, n: 3 }), mv({ k: 'atkDebuff', dmg: 9, debuff: [['weak', 2]] }), mv({ k: 'buff', self: [['str', 2]], block: 8, kk: 1 })]) },
  shellback: { name: L('Krunýřník', 'Shellback'), hp: [56, 60], art: ['crab', '#9fb4ff', 1.25], init: e => { e.s.metal = 3; }, ai: e => cycle(e, [mv({ k: 'atkDef', dmg: 8, block: 10 }), mv({ k: 'atk', dmg: 13 }), mv({ k: 'buff', self: [['str', 2]] })]) },
  serpent: { name: L('Had', 'Serpens'), hp: [50, 54], art: ['serpent', '#6fffb0', 1.2], ai: e => e.turn % 3 === 2 ? mv({ k: 'atk', dmg: 14 }) : mv({ k: 'atkDebuff', dmg: 6, debuff: [['poison', 3]] }) },
  mystic: { name: L('Mystik', 'Mystic'), hp: [48, 56], art: ['humanoid', '#c0a8ff', 0.95, { staff: 1 }], ai: (e, B) => {
    const hurt = B.enemies.some(o => !o.dead && o.hp < o.maxHp - 14);
    if (hurt && e.last !== 'heal') return mv({ k: 'buff', heal: 16, id: 'heal' });
    return e.turn % 2 ? mv({ k: 'buff', allStr: 2, id: 'str' }) : mv({ k: 'atkDebuff', dmg: 8, debuff: [['weak', 1]] });
  } },
  chosen: { name: L('Vyvolený', 'The Chosen'), hp: [80, 84], art: ['humanoid', '#ff6b6b', 1.15, { crown: 1 }], ai: e => e.turn === 0 ? mv({ k: 'debuff', debuff: [['weak', 2]], self: [['str', 2]] }) : cycle(e, [mv({ k: 'atk', dmg: 4, n: 2 }), mv({ k: 'atk', dmg: 14 }), mv({ k: 'atkDebuff', dmg: 8, debuff: [['vuln', 1]] })]) },
  byrd: { name: L('Pták', 'Byrd'), hp: [22, 27], art: ['bird', '#ffe08a', 0.7], ai: e => cycle(e, [mv({ k: 'atk', dmg: 1, n: 4 }), mv({ k: 'buff', self: [['str', 1]] }), mv({ k: 'atk', dmg: 12 })]) },
  scorpio: { name: L('Štír', 'Scorpio'), hp: [140, 146], elite: true, art: ['scorpion', '#ff4d6d', 1.5], ai: e => cycle(e, [mv({ k: 'atkDebuff', dmg: 7, debuff: [['poison', 4]] }), mv({ k: 'atk', dmg: 22 }), mv({ k: 'def', block: 15, self: [['str', 3]] })]) },
  gemini: { name: L('Blíženec', 'Gemini'), hp: [78, 84], elite: true, art: ['humanoid', '#7fd8ff', 1.1, { twin: 1 }], ai: e => (e.turn + e.idx) % 2 === 0 ? mv({ k: 'atk', dmg: 13 }) : mv({ k: 'def', allBlock: 10, self: [['str', 1]] }) },
  draco: { name: L('Draco, Strážce severu', 'Draco, Warden of the North'), hp: [270, 270], boss: true, art: ['dragon', '#ff7a3d', 2], ai: e => cycle(e, [
    mv({ k: 'atkDebuff', dmg: 3, n: 5, cards: ['scorch', 1] }),
    mv({ k: 'def', block: 22, self: [['str', 3]] }),
    mv({ k: 'atkDebuff', dmg: 21, debuff: [['vuln', 1]] }),
    mv({ k: 'debuff', debuff: [['weak', 2]], cards: ['scorch', 2] }),
  ]) },
  // ── Akt III ──
  wraith: { name: L('Přízrak', 'Wraith'), hp: [62, 68], art: ['wraith', '#c0a8ff', 1.2], ai: e => cycle(e, [mv({ k: 'atk', dmg: 8, n: 2 }), mv({ k: 'debuff', debuff: [['vuln', 1], ['weak', 2]] }), mv({ k: 'atk', dmg: 18 })]) },
  obelisk: { name: L('Obelisk', 'Obelisk'), hp: [95, 102], art: ['golem', '#ffe08a', 1.35], init: e => { e.s.metal = 4; }, ai: e => cycle(e, [mv({ k: 'def', block: 16 }), mv({ k: 'atk', dmg: 20 }), mv({ k: 'buff', allStr: 2 })]) },
  spiker: { name: L('Ježatec', 'Spiker'), hp: [48, 54], art: ['orb', '#ff9ae0', 1.1, { spikes: 1 }], init: e => { e.s.thorns = 3; }, ai: e => e.turn % 2 ? mv({ k: 'buff', self: [['thorns', 1]] }) : mv({ k: 'atk', dmg: 8 }) },
  lich: { name: L('Lich', 'Lich'), hp: [76, 82], art: ['humanoid', '#8dff5a', 1.2, { staff: 1, hood: 1 }], ai: e => cycle(e, [mv({ k: 'atk', dmg: 8, n: 2 }), mv({ k: 'debuff', cards: ['wound', 2], debuff: [['weak', 1]] }), mv({ k: 'buff', heal: 14, self: [['str', 1]] })]) },
  hydra: { name: L('Hlava hydry', 'Hydra Head'), hp: [40, 45], art: ['serpent', '#7cf0b6', 1], ai: e => cycle(e, [mv({ k: 'atk', dmg: 8 }), mv({ k: 'atk', dmg: 3, n: 3 }), mv({ k: 'buff', self: [['str', 1]] })]) },
  nemesis: { name: L('Nemesis', 'Nemesis'), hp: [190, 196], elite: true, art: ['wraith', '#ff4d6d', 1.6], ai: e => cycle(e, [mv({ k: 'atk', dmg: 6, n: 3 }), mv({ k: 'debuff', cards: ['scorch', 3] }), mv({ k: 'atk', dmg: 30 })]) },
  titan: { name: L('Titán', 'Titan'), hp: [250, 260], elite: true, art: ['golem', '#ffb547', 1.7], init: e => { e.s.artifact = 2; }, ai: e => e.turn === 0 ? mv({ k: 'buff', self: [['str', 5]] }) : cycle(e, [mv({ k: 'atk', dmg: 22 }), mv({ k: 'atk', dmg: 9, n: 2 }), mv({ k: 'def', block: 25 })]) },
  king: { name: L('Král souhvězdí', 'King of Constellations'), hp: [330, 330], boss: true, art: ['humanoid', '#ffe08a', 2.1, { crown: 1, staff: 1, wings: 1 }], phase2: e => { Battle.addStatus(e, 'artifact', 2); Battle.addStatus(e, 'ritual', 2); }, ai: e => {
    if (e.phase === 2) return cycle(e, [mv({ k: 'atk', dmg: 7, n: 4 }), mv({ k: 'atkDebuff', dmg: 16, debuff: [['vuln', 1]] }), mv({ k: 'def', block: 25, self: [['str', 2]] }), mv({ k: 'atk', dmg: 38 })]);
    return cycle(e, [mv({ k: 'debuff', debuff: [['weak', 2], ['vuln', 2]], cards: ['dazed', 3] }), mv({ k: 'atk', dmg: 6, n: 4 }), mv({ k: 'def', block: 30, self: [['str', 3]] }), mv({ k: 'atk', dmg: 34 })]);
  } },
  // ── Akt IV ──
  voidling: { name: L('Prázdnotník', 'Voidling'), hp: [34, 38], art: ['orb', '#b14cff', 0.85], ai: e => e.turn % 2 ? mv({ k: 'atkDebuff', dmg: 8, debuff: [['vuln', 1]] }) : mv({ k: 'atk', dmg: 12 }) },
  eater: { name: L('Požírač hvězd', 'Star Eater'), hp: [84, 90], art: ['blob', '#7a5cff', 1.3], ai: e => cycle(e, [mv({ k: 'atk', dmg: 17 }), mv({ k: 'buff', self: [['str', 3]], block: 12 }), mv({ k: 'atkDebuff', dmg: 11, cards: ['wound', 1] })]) },
  mirror: { name: L('Zrcadlo nebe', 'Sky Mirror'), hp: [62, 68], art: ['diamond', '#e0e8ff', 1.05], init: e => { e.s.thorns = 4; }, ai: e => cycle(e, [mv({ k: 'def', block: 16 }), mv({ k: 'atk', dmg: 7, n: 2 }), mv({ k: 'debuff', debuff: [['weak', 2]], cards: ['dazed', 2] })]) },
  pulsar: { name: L('Pulsar', 'Pulsar'), hp: [52, 56], art: ['orb', '#7fd8ff', 1.1, { spikes: 1 }], ai: e => cycle(e, [mv({ k: 'buff', self: [['str', 2]], block: 6 }), mv({ k: 'buff', self: [['str', 2]], block: 6 }), mv({ k: 'atk', dmg: 8, n: 3 })]) },
  umbra: { name: L('Stín hvězdy', 'Umbra'), hp: [66, 72], art: ['wraith', '#6a4cff', 1.15], ai: e => cycle(e, [mv({ k: 'atk', dmg: 14 }), mv({ k: 'atkDebuff', dmg: 7, debuff: [['poison', 4]] }), mv({ k: 'atk', dmg: 4, n: 4 })]) },
  devourer: { name: L('Hltač světel', 'Light Devourer'), hp: [290, 300], elite: true, art: ['dragon', '#b14cff', 1.6], init: e => { e.s.artifact = 1; }, ai: e => cycle(e, [mv({ k: 'atk', dmg: 27 }), mv({ k: 'atkDebuff', dmg: 8, n: 2, debuff: [['vuln', 2]] }), mv({ k: 'def', block: 22, self: [['str', 4]] })]) },
  binary: { name: L('Dvojhvězda', 'Binary Star'), hp: [128, 134], elite: true, art: ['humanoid', '#ffb547', 1.15, { twin: 1, crown: 1 }], ai: e => (e.turn + e.idx) % 2 === 0 ? mv({ k: 'atk', dmg: 16 }) : mv({ k: 'def', allBlock: 12, allStr: 1 }) },
  herald: { name: L('Hlasatel konce', 'Herald of the End'), hp: [310, 320], elite: true, art: ['golem', '#ff4dd2', 1.65], ai: e => e.turn === 0 ? mv({ k: 'buff', self: [['ritual', 2]], block: 20 }) : cycle(e, [mv({ k: 'atk', dmg: 19 }), mv({ k: 'def', block: 20 }), mv({ k: 'atk', dmg: 7, n: 3 })]) },
  void: { name: L('Prázdnota, Matka temnoty', 'The Void, Mother of Darkness'), hp: [470, 470], boss: true, art: ['wraith', '#b14cff', 2.3], phase2: e => { Battle.addStatus(e, 'artifact', 3); Battle.addStatus(e, 'ritual', 3); e.block += 40; }, ai: e => {
    if (e.phase === 2) return cycle(e, [mv({ k: 'atk', dmg: 8, n: 5 }), mv({ k: 'atkDebuff', dmg: 20, cards: ['wound', 2] }), mv({ k: 'def', block: 30, self: [['str', 2]] }), mv({ k: 'atk', dmg: 44 })]);
    return cycle(e, [mv({ k: 'debuff', debuff: [['weak', 2], ['vuln', 2]], cards: ['dazed', 3] }), mv({ k: 'atk', dmg: 7, n: 5 }), mv({ k: 'def', block: 35, self: [['str', 3]] }), mv({ k: 'atk', dmg: 40 })]);
  } },
};

const ACTS = [
  { name: L('Mlhovina Lva', 'Nebula of the Lion'), color: '#ffb547', bg: ['#1a1030', '#07040f'],
    easy: [['cultist'], ['crab'], ['louse', 'louse'], ['slime'], ['wisp', 'wisp']],
    hard: [['wisp', 'wisp', 'wisp'], ['jackal', 'jackal'], ['slime', 'louse'], ['crab', 'wisp'], ['cultist', 'louse'], ['jackal', 'wisp']],
    elites: [['taurus'], ['colossus'], ['sentry', 'sentry', 'sentry']], boss: ['orion'] },
  { name: L('Řeka Eridanus', 'River Eridanus'), color: '#7fb4ff', bg: ['#08182e', '#02060f'],
    easy: [['harpy'], ['serpent'], ['byrd', 'byrd', 'byrd'], ['shellback']],
    hard: [['mystic', 'mystic'], ['chosen'], ['serpent', 'byrd'], ['shellback', 'byrd'], ['chosen', 'byrd'], ['harpy', 'mystic']],
    elites: [['scorpio'], ['gemini', 'gemini']], boss: ['draco'] },
  { name: L('Koruna nebes', 'Crown of the Heavens'), color: '#ffe08a', bg: ['#1c1508', '#060402'],
    easy: [['wraith'], ['obelisk'], ['hydra', 'hydra'], ['spiker', 'spiker']],
    hard: [['hydra', 'hydra', 'hydra'], ['spiker', 'hydra'], ['wraith', 'hydra'], ['obelisk', 'wraith'], ['lich', 'obelisk']],
    elites: [['nemesis'], ['titan']], boss: ['king'] },
  { name: L('Srdce prázdnoty', 'Heart of the Void'), color: '#c77dff', bg: ['#12061f', '#030106'],
    easy: [['eater'], ['umbra'], ['voidling', 'voidling'], ['mirror', 'voidling']],
    hard: [['pulsar', 'pulsar'], ['eater', 'voidling'], ['mirror', 'umbra'], ['pulsar', 'voidling', 'voidling'], ['umbra', 'pulsar'], ['mirror', 'mirror']],
    elites: [['devourer'], ['binary', 'binary'], ['herald']], boss: ['void'] },
];
// Nekonečná věž: za vrcholem se akty opakují, silnější s každým okruhem
// (dřívější akty se dotáhnou na sílu posledního).
const LOOP_TIER = { hp: [2.4, 1.8, 1.35, 1.1], dmg: [1.9, 1.5, 1.2, 1.08] };

// ── Hvězdná znamení (Nekonečná věž: požehnání i kletba) ─────────────────────
const OMENS = [
  { id: 'fire', icon: 'flame', color: '#ffb03b', name: L('Žhnoucí nebe', 'Burning Sky'), good: L('Na začátku boje uvalí 5 hoření na všechny nepřátele.', 'At the start of combat, apply 5 Burn to ALL enemies.'), bad: L('Nepřátelé mají o 10 % více životů.', 'Enemies have 10% more HP.') },
  { id: 'might', icon: 'fist', color: '#ff8a5c', name: L('Válečná hvězda', 'War Star'), good: L('Začni každý boj s 2 síly.', 'Start each combat with 2 Strength.'), bad: L('Nepřátelé začínají boj s 2 síly.', 'Enemies start combat with 2 Strength.') },
  { id: 'gold', icon: 'coin', color: '#ffd166', name: L('Zlatý déšť', 'Golden Rain'), good: L('Získáváš o 50 % více zlata.', 'Gain 50% more Gold.'), bad: L('Obchody jsou o 25 % dražší.', 'Shops cost 25% more.') },
  { id: 'aegis', icon: 'shield', color: '#9fb4ff', name: L('Hvězdný štít', 'Star Aegis'), good: L('Začni každý boj s 12 bloku.', 'Start each combat with 12 Block.'), bad: L('Odpočinek léčí o 10 % méně.', 'Resting heals 10% less.') },
  { id: 'tide', icon: 'wave', color: '#7fd8ff', name: L('Příliv', 'High Tide'), good: L('Každé kolo lízneš o 1 kartu víc.', 'Draw 1 extra card each turn.'), bad: L('Nepřátelé způsobují o 10 % více poškození.', 'Enemies deal 10% more damage.') },
  { id: 'comet', icon: 'comet', color: '#c0a8ff', name: L('Kometa', 'Comet'), good: L('V prvním kole získáš 1 energii navíc.', 'Gain 1 extra Energy on your first turn.'), bad: L('Elitní nepřátelé jsou častější.', 'Elites appear more often.') },
  { id: 'bounty', icon: 'cards', color: '#7cf0b6', name: L('Hojnost', 'Bounty'), good: L('Karty v odměnách jsou vylepšené.', 'Card rewards are upgraded.'), bad: L('Ihned ztratíš 8 max. životů.', 'Lose 8 Max HP now.') },
  { id: 'phoenix', icon: 'sun', color: '#ff7a3d', name: L('Fénix', 'Phoenix'), good: L('Ihned se plně vyléčíš.', 'Heal to full now.'), bad: L('Bossové mají o 15 % více životů.', 'Bosses have 15% more HP.') },
  { id: 'thorns', icon: 'thorn', color: '#d0a0ff', name: L('Trnová koruna', 'Crown of Thorns'), good: L('Začni každý boj se 3 trny.', 'Start each combat with 3 Thorns.'), bad: L('Na začátku boje dostaneš do balíčku Omámení.', 'At the start of combat, shuffle a Dazed into your deck.') },
  { id: 'hoard', icon: 'gem', color: '#ff5fa2', name: L('Dračí poklad', "Dragon's Hoard"), good: L('Ihned získáš náhodnou relikvii.', 'Gain a random relic now.'), bad: L('Přijdeš o všechno zlato.', 'Lose all your Gold.') },
];

// ── Hvězdný atlas (trvalá vylepšení za hvězdný prach) ───────────────────────
const ATLAS = [
  { id: 'vit', icon: 'heart', color: '#ff7a5c', name: L('Hvězdné srdce', 'Star Heart'), desc: v => L(`Začínáš s +${v * 5} max. životy.`, `Start with +${v * 5} Max HP.`), cost: [40, 80, 130, 190, 260] },
  { id: 'gold', icon: 'coin', color: '#ffd166', name: L('Zlatý prach', 'Gold Dust'), desc: v => L(`Začínáš s +${v * 20} zlata.`, `Start with +${v * 20} Gold.`), cost: [30, 60, 100] },
  { id: 'potion', icon: 'potion', color: '#7fd8ff', name: L('Lektvarník', 'Apothecary'), desc: v => L(`Začínáš s ${v} ${plural(v, 'náhodným lektvarem', 'náhodnými lektvary', 'náhodnými lektvary')}.`, `Start with ${v} random potion${v > 1 ? 's' : ''}.`), cost: [50, 120] },
  { id: 'belt', icon: 'bag', color: '#9fb4ff', name: L('Brašna', 'Satchel'), desc: () => L('Máš o 1 místo na lektvar víc.', 'Gain 1 extra potion slot.'), cost: [150] },
  { id: 'rest', icon: 'rest', color: '#ffb547', name: L('Klidný spánek', 'Deep Sleep'), desc: v => L(`Odpočinek léčí o ${v * 5} % více.`, `Resting heals ${v * 5}% more.`), cost: [60, 110, 170] },
  { id: 'forge', icon: 'anvil', color: '#ffe08a', name: L('Kovárna hvězd', 'Star Forge'), desc: v => L(`Začínáš s ${v} ${plural(v, 'vylepšenou kartou', 'vylepšenými kartami', 'vylepšenými kartami')}.`, `Start with ${v} upgraded card${v > 1 ? 's' : ''}.`), cost: [70, 150] },
  { id: 'rare', icon: 'star', color: '#ffd166', name: L('Šťastná hvězda', 'Lucky Star'), desc: v => L(`Vzácné karty padají o ${v * 2} % častěji.`, `Rare cards are ${v * 2}% more common.`), cost: [90, 180] },
  { id: 'vision', icon: 'eye', color: '#c0a8ff', name: L('Vize', 'Vision'), desc: () => L('Odměny nabízejí o 1 kartu víc.', 'Card rewards offer 1 more card.'), cost: [250] },
  { id: 'purge', icon: 'x', color: '#ff5fa2', name: L('Očista', 'Purge'), desc: () => L('Odstranění karty v obchodě je o 25 zlata levnější.', 'Removing a card in shops costs 25 less Gold.'), cost: [120] },
  { id: 'relic', icon: 'gem', color: '#7cf0b6', name: L('Dar souhvězdí', 'Gift of the Stars'), desc: () => L('Začínáš s náhodnou běžnou relikvií.', 'Start with a random common relic.'), cost: [300] },
  { id: 'dust', icon: 'sparkle', color: '#b99bff', name: L('Sběratel prachu', 'Dust Collector'), desc: v => L(`Získáváš o ${v * 10} % více hvězdného prachu.`, `Gain ${v * 10}% more Stardust.`), cost: [100, 200, 300] },
];
const ATLAS_MAX = ATLAS.reduce((a, p) => a + p.cost.length, 0);


// ── Události ────────────────────────────────────────────────────────────────
// opt: { t: text, ok: (run) => bool, do: (run, ui) => výsledný text }
const EVENTS = [
  { id: 'well', title: L('Hvězdná studna', 'The Star Well'), icon: 'drop', text: L('Ve tmě se třpytí studna plná tekutého světla. Šeptá tvé jméno.', 'In the darkness glimmers a well of liquid light. It whispers your name.'),
    opts: [
      { t: L('Napít se (vyléčíš 33 % max. životů)', 'Drink (heal 33% of Max HP)'), do: R => { Run.heal(Math.round(R.maxHp * 0.33)); return L('Světlo tě prostoupí. Rány se zacelí.', 'Light flows through you. Your wounds close.'); } },
      { t: L('Hodit minci (získáš 1 náhodnou relikvii, ztratíš 25 zlata)', 'Toss a coin (gain a random relic, lose 25 Gold)'), ok: R => R.gold >= 25, do: R => { R.gold -= 25; const r = Run.giveRandomRelic(); return L(`Ze dna vyplavalo: ${RELICS[r].name}.`, `Something surfaced: ${RELICS[r].name}.`); } },
      { t: L('Odejít', 'Leave'), do: () => L('Odcházíš. Šepot utichá.', 'You walk away. The whispers fade.') },
    ] },
  { id: 'altar', title: L('Zlomený oltář', 'The Broken Altar'), icon: 'star', text: L('Starý oltář požaduje oběť. Na jeho vrcholu leží zářící artefakt.', 'An ancient altar demands a sacrifice. A glowing artifact rests on top.'),
    opts: [
      { t: L('Obětovat krev (ztratíš 8 životů, získáš relikvii)', 'Offer blood (lose 8 HP, gain a relic)'), ok: R => R.hp > 8, do: R => { R.hp -= 8; const r = Run.giveRandomRelic(); return L(`Oltář přijal oběť. Získal jsi ${RELICS[r].name}.`, `The altar accepts. You gain ${RELICS[r].name}.`); } },
      { t: L('Odejít', 'Leave'), do: () => L('Necháváš oltář jeho osudu.', 'You leave the altar to its fate.') },
    ] },
  { id: 'merchant', title: L('Toulavý kartograf', 'The Wandering Cartographer'), icon: 'map', text: L('Kartograf nabízí, že ti z mapy osudu vymaže jednu kartu. Zadarmo.', 'A cartographer offers to erase one card from your map of fate. Free of charge.'),
    opts: [
      { t: L('Odstranit kartu z balíčku', 'Remove a card from your deck'), do: (R, U) => { U.pickCard(R.deck, L('Odstranit kartu', 'Remove a card'), i => Run.removeCard(i)); return L('Kartograf škrtá pečlivě a bez emocí.', 'The cartographer erases it carefully, without emotion.'); } },
      { t: L('Odejít', 'Leave'), do: () => L('Kartograf pokrčí rameny a zmizí.', 'The cartographer shrugs and vanishes.') },
    ] },
  { id: 'forge', title: L('Hvězdná výheň', 'The Star Forge'), icon: 'anvil', text: L('Opuštěná výheň stále žhne. Můžeš do ní vložit své karty — nebo svou ruku.', 'An abandoned forge still burns. You can place your cards in it — or your hand.'),
    opts: [
      { t: L('Vylepšit 2 náhodné karty (ztratíš 5 životů)', 'Upgrade 2 random cards (lose 5 HP)'), ok: R => R.hp > 5, do: R => { R.hp -= 5; const n = Run.upgradeRandom(2); return L(`Vylepšeno karet: ${n}.`, `Cards upgraded: ${n}.`); } },
      { t: L('Vylepšit 1 kartu podle výběru', 'Upgrade a card of your choice'), do: (R, U) => { U.pickCard(R.deck.filter(c => !c.up && CARDS[c.id].up), L('Vylepšit kartu', 'Upgrade a card'), (i, list) => Run.upgradeCard(list[i])); return L('Kov zazvoní. Karta září.', 'The metal rings. The card shines.'); } },
    ] },
  { id: 'void', title: L('Šepot prázdnoty', 'Whispers of the Void'), icon: 'moon', text: L('Hlas z prázdnoty nabízí zakázané vědění. Cena je tvá vitalita.', 'A voice from the void offers forbidden knowledge. The price is your vitality.'),
    opts: [
      { t: L('Přijmout (vzácná karta, −6 max. životů)', 'Accept (rare card, −6 Max HP)'), do: R => { R.maxHp -= 6; R.hp = Math.min(R.hp, R.maxHp); const c = Run.randomCard('rare'); Run.addCard(c); return L(`Do balíčku přibyla: ${CARDS[c].name}.`, `Added to your deck: ${CARDS[c].name}.`); } },
      { t: L('Odmítnout', 'Refuse'), do: () => L('Prázdnota se směje. Ale nechá tě jít.', 'The void laughs. But it lets you go.') },
    ] },
  { id: 'mirror', title: L('Zrcadlo osudu', 'Mirror of Fate'), icon: 'eye', text: L('V zrcadle vidíš svůj balíček. Jedna z karet se v něm zdvojuje.', 'In the mirror you see your deck. One of the cards is doubled.'),
    opts: [
      { t: L('Zdvojit kartu', 'Duplicate a card'), do: (R, U) => { U.pickCard(R.deck, L('Zdvojit kartu', 'Duplicate a card'), i => Run.addCard(R.deck[i].id, R.deck[i].up)); return L('Odraz se stal skutečností.', 'The reflection became real.'); } },
      { t: L('Rozbít zrcadlo (získáš 50 zlata)', 'Shatter the mirror (gain 50 Gold)'), do: R => { Run.gainGold(50); return L('Střepy jsou překvapivě cenné.', 'The shards are surprisingly valuable.'); } },
    ] },
  { id: 'gamble', title: L('Hráč v kostky', 'The Dice Player'), icon: 'clover', text: L('Tajemná postava hází kostkami ze slonoviny. „Vsadíš si?“', 'A mysterious figure rolls ivory dice. "Care for a bet?"'),
    opts: [
      { t: L('Vsadit 40 zlata (50 %: získáš 100)', 'Bet 40 Gold (50%: win 100)'), ok: R => R.gold >= 40, do: R => { R.gold -= 40; if (Math.random() < 0.5) { Run.gainGold(100); return L('Šestka! Vyhrál jsi.', 'A six! You win.'); } return L('Jednička. Postava se usměje.', 'A one. The figure smiles.'); } },
      { t: L('Vsadit životy (ztratíš 10, 50 %: vzácná relikvie)', 'Bet your life (lose 10 HP, 50%: rare relic)'), ok: R => R.hp > 10, do: R => { R.hp -= 10; if (Math.random() < 0.5) { const r = Run.giveRandomRelic('rare'); return L(`Vyhrál jsi: ${RELICS[r].name}.`, `You won: ${RELICS[r].name}.`); } return L('Prohrál jsi. Bolest je skutečná.', 'You lost. The pain is real.'); } },
      { t: L('Odejít', 'Leave'), do: () => L('„Příště,“ zašeptá postava.', '"Next time," the figure whispers.') },
    ] },
  { id: 'library', title: L('Hvězdná knihovna', 'The Star Library'), icon: 'book', text: L('Nekonečné regály plné svitků. Jeden z nich si můžeš vzít.', 'Endless shelves full of scrolls. You may take one.'),
    opts: [
      { t: L('Vybrat si kartu (ze 4 náhodných)', 'Choose a card (from 4 random)'), do: (R, U) => { U.cardReward(Run.rollCards(4), L('Vyber svitek', 'Choose a scroll')); return L('Svitek se ti rozplyne v rukou a stane se kartou.', 'The scroll dissolves in your hands and becomes a card.'); } },
      { t: L('Spát mezi regály (vyléčíš 50 %)', 'Sleep among the shelves (heal 50%)'), do: R => { Run.heal(Math.round(R.maxHp * 0.5)); return L('Spíš beze snů.', 'You sleep without dreams.'); } },
    ] },
];

// ── Zatmění (obtížnost) ─────────────────────────────────────────────────────
const ECLIPSE = [
  L('Elitní nepřátelé jsou častější.', 'Elites appear more often.'),
  L('Běžní nepřátelé způsobují více poškození.', 'Normal enemies deal more damage.'),
  L('Elitní nepřátelé mají více životů.', 'Elites have more HP.'),
  L('Bossové způsobují více poškození.', 'Bosses deal more damage.'),
  L('Odpočinek léčí jen 25 %.', 'Resting heals only 25%.'),
  L('Začínáš s 90 % životů.', 'Start with 90% HP.'),
  L('Všichni nepřátelé mají více životů.', 'All enemies have more HP.'),
  L('Bossové mají více životů.', 'Bosses have more HP.'),
  L('Získáváš méně zlata.', 'You gain less Gold.'),
  L('Začínáš s Ránou v balíčku.', 'Start with a Wound in your deck.'),
];
const MAX_ECLIPSE = ECLIPSE.length;

// ── Úspěchy ─────────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: 'first', name: L('První krok', 'First Step'), desc: L('Vyhraj první boj.', 'Win your first combat.'), icon: 'sword', prog: S => [S.stats.wins, 1] },
  { id: 'act1', name: L('Lev padl', 'The Lion Falls'), desc: L('Poraz Oriona (odemyká Astromantku).', 'Defeat Orion (unlocks the Astromancer).'), icon: 'crown', prog: S => [S.stats.act1, 1] },
  { id: 'act2', name: L('Proti proudu', 'Against the Current'), desc: L('Poraz Draca (odemyká Stína).', 'Defeat Draco (unlocks the Shade).'), icon: 'crown', prog: S => [S.stats.act2, 1] },
  { id: 'act3', name: L('Koruna padla', 'The Crown Falls'), desc: L('Poraz Krále souhvězdí.', 'Defeat the King of Constellations.'), icon: 'crown', prog: S => [S.stats.act3, 1] },
  { id: 'win', name: L('Vládce nebes', 'Ruler of the Heavens'), desc: L('Poraz Prázdnotu na vrcholu věže.', 'Defeat the Void at the top of the spire.'), icon: 'trophy', prog: S => [S.stats.victories, 1] },
  { id: 'loop2', name: L('Za hranou nebe', 'Beyond the Sky'), desc: L('Dokonči okruh Nekonečné věže.', 'Complete a loop of the Endless Spire.'), icon: 'spiral', prog: S => [S.stats.bestLoop, 2] },
  { id: 'loop4', name: L('Nekonečno', 'Infinity'), desc: L('Dokonči tři okruhy Nekonečné věže v jednom výstupu.', 'Complete three loops of the Endless Spire in one climb.'), icon: 'spiral', prog: S => [S.stats.bestLoop, 4] },
  { id: 'floor100', name: L('Sté patro', 'Floor 100'), desc: L('Dosáhni 100. patra.', 'Reach floor 100.'), icon: 'up', prog: S => [S.stats.bestFloor, 100] },
  { id: 'atlas10', name: L('Kartograf nebes', 'Sky Cartographer'), desc: L('Kup 10 vylepšení Hvězdného atlasu.', 'Buy 10 Star Atlas upgrades.'), icon: 'map', prog: S => [atlasCount(S), 10] },
  { id: 'atlasAll', name: L('Celé nebe', 'The Whole Sky'), desc: L('Dokonči Hvězdný atlas.', 'Complete the Star Atlas.'), icon: 'sparkle', prog: S => [atlasCount(S), ATLAS_MAX] },
  { id: 'winAll', name: L('Tři hvězdy', 'Three Stars'), desc: L('Vyhraj se všemi třemi hrdiny.', 'Win with all three heroes.'), icon: 'star', prog: S => [Object.keys(S.heroWins).length, 3] },
  { id: 'ecl5', name: L('Polostín', 'Penumbra'), desc: L('Vyhraj na Zatmění 5.', 'Win on Eclipse 5.'), icon: 'moon', prog: S => [S.stats.maxEclipseWin, 5] },
  { id: 'ecl10', name: L('Úplné zatmění', 'Total Eclipse'), desc: L('Vyhraj na Zatmění 10.', 'Win on Eclipse 10.'), icon: 'moon', prog: S => [S.stats.maxEclipseWin, 10] },
  { id: 'elite10', name: L('Lovec elit', 'Elite Hunter'), desc: L('Poraz 10 elitních nepřátel.', 'Defeat 10 elites.'), icon: 'elite', prog: S => [S.stats.elites, 10] },
  { id: 'kills200', name: L('Zhasínač hvězd', 'Star Snuffer'), desc: L('Poraz 200 nepřátel.', 'Defeat 200 enemies.'), icon: 'skull', prog: S => [S.stats.kills, 200] },
  { id: 'dmg50', name: L('Kometa', 'Comet Strike'), desc: L('Způsob 50 poškození jedním úderem.', 'Deal 50 damage in a single hit.'), icon: 'comet', prog: S => [S.stats.maxHit, 50] },
  { id: 'dmg150', name: L('Supernova', 'Supernova'), desc: L('Způsob 150 poškození jedním úderem.', 'Deal 150 damage in a single hit.'), icon: 'sun', prog: S => [S.stats.maxHit, 150] },
  { id: 'combo', name: L('Řetězová reakce', 'Chain Reaction'), desc: L('Zahraj 12 karet v jednom kole.', 'Play 12 cards in a single turn.'), icon: 'cards', prog: S => [S.stats.maxCardsTurn, 12] },
  { id: 'poison', name: L('Mistr jedů', 'Master of Poison'), desc: L('Měj na nepříteli 50 jedu.', 'Have 50 Poison on an enemy.'), icon: 'drop', prog: S => [S.stats.maxPoison, 50] },
  { id: 'burn', name: L('Žhář', 'Arsonist'), desc: L('Měj na nepříteli 40 hoření.', 'Have 40 Burn on an enemy.'), icon: 'flame', prog: S => [S.stats.maxBurn, 40] },
  { id: 'block', name: L('Pevnost', 'Fortress'), desc: L('Měj 99 bloku najednou.', 'Have 99 Block at once.'), icon: 'shield', prog: S => [S.stats.maxBlock, 99] },
  { id: 'str', name: L('Titánova síla', "Titan's Might"), desc: L('Měj 20 síly v jednom boji.', 'Have 20 Strength in one combat.'), icon: 'fist', prog: S => [S.stats.maxStr, 20] },
  { id: 'rich', name: L('Hvězdný boháč', 'Star Baron'), desc: L('Měj 500 zlata najednou.', 'Hold 500 Gold at once.'), icon: 'coin', prog: S => [S.stats.maxGold, 500] },
  { id: 'relics', name: L('Sběratel', 'Collector'), desc: L('Měj v jednom běhu 15 relikvií.', 'Hold 15 relics in one run.'), icon: 'gem', prog: S => [S.stats.maxRelics, 15] },
  { id: 'thin', name: L('Minimalista', 'Minimalist'), desc: L('Poraz bosse s balíčkem do 10 karet.', 'Defeat a boss with 10 or fewer cards.'), icon: 'card', prog: S => [S.stats.thinBoss, 1] },
  { id: 'fat', name: L('Knihovník', 'Librarian'), desc: L('Měj v balíčku 40 karet.', 'Have 40 cards in your deck.'), icon: 'book', prog: S => [S.stats.maxDeck, 40] },
  { id: 'perfect', name: L('Bez škrábnutí', 'Flawless'), desc: L('Poraz bosse, aniž bys ztratil životy.', 'Defeat a boss without losing HP.'), icon: 'heart', prog: S => [S.stats.flawlessBoss, 1] },
  { id: 'cards', name: L('Kartograf hvězd', 'Star Cartographer'), desc: L('Objev 60 různých karet.', 'Discover 60 different cards.'), icon: 'map', prog: S => [Object.keys(S.seen).length, 60] },
  { id: 'runs10', name: L('Poutník', 'Pilgrim'), desc: L('Odehraj 10 výstupů.', 'Complete 10 climbs.'), icon: 'rocket', prog: S => [S.stats.runs, 10] },
  { id: 'runs50', name: L('Věčný poutník', 'Eternal Pilgrim'), desc: L('Odehraj 50 výstupů.', 'Complete 50 climbs.'), icon: 'rocket', prog: S => [S.stats.runs, 50] },
];
ICONS.rocket = ICONS.comet;
const atlasCount = S => Object.values(S.atlas || {}).reduce((a, v) => a + v, 0);
