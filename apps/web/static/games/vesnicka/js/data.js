'use strict';
// ── VESNIČKA · data: řemesla, vylepšení, bytosti, úspěchy, kronika, čísla ──────────────
// Idle hra: vesnice vydělává groše i když hráč nehraje. Všechno, co se dá vyvažovat, je tady.

const LANG = (() => {
  try { const s = localStorage.getItem('gamecenter.lang'); if (s === 'cs' || s === 'en') return s; } catch (e) { /* bez úložiště */ }
  return /^(cs|sk)/i.test((typeof navigator !== 'undefined' && navigator.language) || '') ? 'cs' : 'en';
})();
const L = (cs, en) => (LANG === 'en' ? en : cs);
const LOCALE = LANG === 'en' ? 'en-US' : 'cs-CZ';

// ── Čísla ──
const UNITS = LANG === 'en'
  ? ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg']
  : ['', ' tis.', ' mil.', ' mld.', ' bil.', ' bld.', ' tril.', ' trld.', ' kvadril.', ' kvadrld.', ' kvintil.', ' kvintld.', ' sextil.', ' sextld.', ' septil.', ' septld.', ' oktil.', ' oktld.', ' nonil.', ' nonld.', ' decil.', ' decld.'];
const SEP = LANG === 'en' ? '.' : ',';
let SCI = false; // vědecký zápis (nastavení)
function trunc(v, d) { const p = Math.pow(10, d); return (Math.floor(v * p + 1e-9) / p).toFixed(d).replace('.', SEP); }
/** Groše: celá čísla do milionu, pak „1,23 mil.“ (3 platné číslice, nikdy nezaokrouhlí nahoru). */
function fmt(n, dec = 0) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '−' + fmt(-n, dec);
  if (n < 1e6) {
    if (dec && n < 100 && n % 1) return trunc(n, n < 10 ? 2 : 1).replace(new RegExp(`\\${SEP}?0+$`), '');
    return Math.floor(n + 1e-9).toLocaleString(LOCALE);
  }
  const e = Math.floor(Math.log10(n) / 3 + 1e-12);
  if (SCI || e >= UNITS.length) { const x = Math.floor(Math.log10(n)); return trunc(n / Math.pow(10, x), 2) + 'e' + x; }
  const v = n / Math.pow(1000, e);
  return trunc(v, v < 10 ? 2 : v < 100 ? 1 : 0) + UNITS[e];
}
function fmtDur(s) {
  s = Math.max(0, Math.floor(s));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return L(`${d} d ${h} h`, `${d}d ${h}h`);
  if (h) return L(`${h} h ${m} min`, `${h}h ${m}m`);
  if (m) return L(`${m} min ${s % 60} s`, `${m}m ${s % 60}s`);
  return L(`${s} s`, `${s}s`);
}
const fmtClock = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };


// ── Roční období: sdílený čas (stejné období pro všechny), 5 minut každé ──
const SEASON_LEN = 300;
const SEASONS = [
  { id: 'jaro', name: L('Jaro', 'Spring'), icon: '🌸' },
  { id: 'leto', name: L('Léto', 'Summer'), icon: '☀️' },
  { id: 'podzim', name: L('Podzim', 'Autumn'), icon: '🍂' },
  { id: 'zima', name: L('Zima', 'Winter'), icon: '❄️' },
];
const seasonAt = ms => Math.floor(ms / 1000 / SEASON_LEN) % 4;
const seasonLeft = ms => SEASON_LEN - ((ms / 1000) % SEASON_LEN);

// ── Řemesla (generátory). cost: první kus, prod: groše za sekundu za kus, season: kdy má sezónu ──
const COST_GROWTH = 1.15;
const BUILDINGS = [
  { id: 'pole', cost: 12, prod: 0.25, season: 0, name: L('Políčko', 'Field'), desc: L('Brambory, zelí a mák. Tady začíná každá vesnice.', 'Potatoes, cabbage and poppies. Every village starts here.') },
  { id: 'kurnik', cost: 130, prod: 1.6, season: 1, name: L('Kurník', 'Hen house'), desc: L('Slepice snášejí, kohout budí celou ves.', 'The hens lay, the rooster wakes the whole village.') },
  { id: 'vcelin', cost: 1400, prod: 9, season: 0, name: L('Včelín', 'Apiary'), desc: L('Lipový med, nejsladší v kraji.', 'Linden honey, the sweetest in the land.') },
  { id: 'pekarna', cost: 15500, prod: 52, season: 2, name: L('Pekárna', 'Bakery'), desc: L('Koláče s mákem, tvarohem a povidly.', 'Kolache with poppy seed, curd and plum jam.') },
  { id: 'kovarna', cost: 170000, prod: 300, season: 3, name: L('Kovárna', 'Smithy'), desc: L('Podkovy pro koně i pro štěstí.', 'Horseshoes for horses and for luck.') },
  { id: 'mlyn', cost: 1.9e6, prod: 1700, season: 2, name: L('Mlýn', 'Watermill'), desc: L('Klape na potůčku a mele bílou mouku.', 'Clatters on the brook, grinding white flour.') },
  { id: 'pivovar', cost: 2.5e7, prod: 10000, season: 1, name: L('Pivovar', 'Brewery'), desc: L('Ležák z vlastního chmele.', 'Lager from home-grown hops.') },
  { id: 'sklarna', cost: 3.4e8, prod: 60000, season: 3, name: L('Sklárna', 'Glassworks'), desc: L('Broušené sklo až do Benátek.', 'Cut glass sold as far as Venice.') },
  { id: 'jarmark', cost: 5e9, prod: 360000, season: 1, name: L('Jarmark', 'Fair'), desc: L('Kolotoč, perník a trhovci z celého kraje.', 'A carousel, gingerbread and traders from all around.') },
  { id: 'lazne', cost: 7.5e10, prod: 2.2e6, season: 0, name: L('Lázně', 'Spa'), desc: L('Léčivé prameny a kolonáda pro hrabata.', 'Healing springs and a colonnade for counts.') },
  { id: 'zamek', cost: 1.1e12, prod: 1.35e7, season: 2, name: L('Zámek', 'Castle'), desc: L('Panstvo, hony a plesy.', 'Nobility, hunts and balls.') },
  { id: 'alchymie', cost: 1.7e13, prod: 8.4e7, season: 3, name: L('Alchymistická dílna', 'Alchemist’s workshop'), desc: L('Hledají kámen mudrců. Zatím našli zlato.', 'They seek the philosopher’s stone. So far they found gold.') },
  { id: 'golem', cost: 2.6e14, prod: 5.3e8, season: 0, name: L('Golem', 'Golem'), desc: L('Hliněný pomocník se šémem pod jazykem.', 'A clay helper with a shem under his tongue.') },
  { id: 'orloj', cost: 4e15, prod: 3.4e9, season: 3, name: L('Orloj', 'Astronomical clock'), desc: L('Odbíjí hodiny i osudy celé vesnice.', 'It strikes the hours and the fate of the village.') },
];
const B_INDEX = Object.fromEntries(BUILDINGS.map((b, i) => [b.id, i]));

// Mistrovství: při tolika kusech jednoho řemesla se jeho výnos zdvojnásobí.
const MILESTONES = [25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000];

// ── Vylepšení ──
// Řemesla: každé má 8 stupňů (×2), dostupné od daného počtu kusů.
const TIER_REQ = [1, 10, 25, 50, 100, 150, 200, 300];
const TIER_NAMES = [
  L('Nové nářadí', 'New tools'), L('Pilní tovaryši', 'Diligent journeymen'), L('Mistr řemesla', 'Master craftsman'), L('Cechovní výsada', 'Guild privilege'),
  L('Královský patent', 'Royal charter'), L('Zlaté ručičky', 'Golden hands'), L('Pohádková moc', 'Fairy-tale power'), L('Věhlas po celém kraji', 'Famed across the land'),
];
const UPGRADES = [];
BUILDINGS.forEach((b, bi) => TIER_REQ.forEach((req, ti) => UPGRADES.push({
  id: `${b.id}${ti + 1}`, kind: 'b', b: bi, tier: ti, cost: b.cost * Math.pow(COST_GROWTH, req) * 6, req: { b: bi, n: req },
  name: TIER_NAMES[ti], sub: b.name, effect: L(`${b.name}: výnos ×2`, `${b.name}: output ×2`),
})));
// Ruce: klepání do vesnice.
const TAP_UPGRADES = [
  [60, 'x2', L('Pracovité ruce', 'Hard-working hands')],
  [700, 0.01, L('Ranní ptáče dál doskáče', 'The early bird')],
  [9000, 'x2', L('Mozolné dlaně', 'Calloused palms')],
  [1.5e5, 0.01, L('Bez práce nejsou koláče', 'No work, no kolache')],
  [3e7, 0.02, L('Kdo dřív přijde, ten dřív mele', 'First come, first ground')],
  [8e9, 0.02, L('Trpělivost růže přináší', 'Patience brings roses')],
  [2e12, 0.03, L('Dvakrát měř, jednou řež', 'Measure twice, cut once')],
  [6e14, 0.03, L('Kováři, drž se kovadliny', 'Smith, stick to your anvil')],
  [2e17, 0.04, L('Zlatý český ručičky', 'Golden Czech hands')],
];
TAP_UPGRADES.forEach(([cost, v, name], i) => UPGRADES.push({
  id: `ruka${i + 1}`, kind: 'tap', v, cost, req: { taps: i ? [0, 50, 150, 300, 600, 1000, 1500, 2000, 3000][i] : 0 }, name, sub: L('Ruce', 'Hands'),
  effect: v === 'x2' ? L('Klepnutí ×2', 'Taps ×2') : L(`Klepnutí +${Math.round(v * 100)} % výnosu za sekundu`, `Taps +${Math.round(v * 100)}% of income per second`),
}));
// Vesnice: celkové bonusy podle počtu budov (některé jsou vidět ve vesnici).
const VILLAGE_UPGRADES = [
  ['kaplicka', 25, 2500, 0.1, L('Kaplička', 'Chapel'), L('Zvonek svolává k práci.', 'A little bell calls to work.')],
  ['skola', 75, 6e5, 0.15, L('Škola', 'School'), L('Pan řídící učí počty.', 'The schoolmaster teaches sums.')],
  ['posta', 150, 1.5e9, 0.2, L('Pošta', 'Post office'), L('Psaníčka do celého světa.', 'Letters to the whole world.')],
  ['silnice', 300, 4e13, 0.25, L('Silnice do města', 'Road to town'), L('Kočáry jezdí každý den.', 'Coaches run every day.')],
  ['zeleznice', 500, 3e18, 0.3, L('Železnice', 'Railway'), L('Lokálka s malou mašinkou.', 'A branch line with a little engine.')],
  ['elektrina', 750, 8e23, 0.35, L('Elektřina', 'Electricity'), L('Žárovky místo loučí.', 'Light bulbs instead of torches.')],
  ['rozhlas', 1000, 5e29, 0.4, L('Obecní rozhlas', 'Village loudspeakers'), L('„Vážení spoluobčané…“', '“Dear fellow villagers…”')],
];
VILLAGE_UPGRADES.forEach(([id, n, cost, v, name, desc]) => UPGRADES.push({
  id, kind: 'g', v, cost, req: { total: n }, name, sub: L('Vesnice', 'Village'), desc, effect: L(`Všechny výnosy +${Math.round(v * 100)} %`, `All income +${Math.round(v * 100)}%`),
}));
// Bytosti a roční období.
const MAGIC_UPGRADES = [
  ['pohadky', 'freq', 0.2, 6e4, { caught: 3 }, L('Babiččiny pohádky', 'Grandma’s tales'), L('Bytosti chodí o 20 % častěji', 'Creatures come 20% more often')],
  ['bylinkarka', 'dur', 0.3, 8e7, { caught: 10 }, L('Bylinkářka', 'Herb woman'), L('Kouzla bytostí trvají o 30 % déle', 'Creature spells last 30% longer')],
  ['lucerna', 'wisp', 1, 6e10, { caught: 25 }, L('Lucerna', 'Lantern'), L('Bludička najde dvakrát větší poklad', 'Will-o’-wisps find twice the treasure')],
  ['pranostiky', 'season', 1, 2e9, { total: 120 }, L('Pranostiky', 'Weather lore'), L('Sezónní řemesla ×3 místo ×2', 'In-season trades ×3 instead of ×2')],
  ['fletna', 'freq', 0.2, 8e14, { caught: 60 }, L('Kouzelná píšťalka', 'Magic pipe'), L('Bytosti chodí o 20 % častěji', 'Creatures come 20% more often')],
  ['kalendar', 'season', 1, 9e19, { total: 400 }, L('Hospodářský kalendář', 'Farmer’s almanac'), L('Sezónní řemesla ×4 místo ×3', 'In-season trades ×4 instead of ×3')],
  ['ponocny', 'offline', 4, 3e6, { total: 50 }, L('Ponocný', 'Night watchman'), L('Vesnice vydělává bez tebe o 4 hodiny déle', 'The village earns 4 hours longer without you')],
  ['vecernice', 'dur', 0.3, 5e17, { caught: 120 }, L('Večernice', 'Evening star'), L('Kouzla bytostí trvají o 30 % déle', 'Creature spells last 30% longer')],
];
MAGIC_UPGRADES.forEach(([id, kind, v, cost, req, name, effect]) => UPGRADES.push({ id, kind, v, cost, req, name, sub: L('Kouzla', 'Magic'), effect }));
const U_INDEX = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

// ── Pohádkové bytosti (náhodné události) ──
// w: váha, life: kolik sekund čekají na klepnutí; dur: trvání kouzla v sekundách.
const CREATURES = [
  { id: 'bludicka', w: 44, life: 12, name: L('Bludička', 'Will-o’-wisp'), text: L('zavedla tě k zakopanému pokladu', 'led you to a buried treasure') },
  { id: 'vodnik', w: 24, life: 14, dur: 45, mul: 5, name: L('Vodník', 'Water goblin'), text: L('půjčil ti hrníček štěstí: výnos ×5', 'lent you his lucky pot: income ×5') },
  { id: 'cert', w: 15, life: 11, dur: 20, mul: 25, name: L('Čert', 'Devil'), text: L('dal ti čertovskou sílu: klepnutí ×25', 'gave you devilish strength: taps ×25') },
  { id: 'krakonos', w: 13, life: 14, dur: 30, name: L('Krakonoš', 'Krakonoš'), text: L('je štědrý: všechno o polovinu levnější', 'is generous: everything half price') },
  { id: 'hospodaricek', w: 4, life: 10, name: L('Hospodáříček', 'House sprite'), text: L('ti přes noc postavil budovy zdarma', 'built you free buildings overnight') },
];
const C_INDEX = Object.fromEntries(CREATURES.map(c => [c.id, c]));
const CREATURE_GAP = [70, 160]; // sekundy mezi bytostmi
// Vzácný host na návsi (ne bytost: nepočítá se do bytostí, má vlastní tajný úspěch).
const NESRO = {
  after: 15, chance: 0.025, life: 16, mul: 3, dur: 180, coins: 300,
  name: 'Nesro', text: L('se zastavil na kus řeči a přinesl koláče: výnos ×3 na 3 minuty a k tomu', 'stopped by for a chat and brought kolache: income ×3 for 3 minutes, plus'),
};

// ── Pověsti (prestiž) a Kronika (trvalé výhody podle počtu pověstí) ──
const LEGEND_BASE = 1e9; // pověsti celkem = ∛(vyděláno za všechna pokolení / LEGEND_BASE)
const LEGEND_BONUS = 0.05; // každá pověst +5 % výnosu
const PERKS = [
  { n: 1, id: 'offline', v: 4, name: L('Rodová pověst', 'Family legend'), desc: L('Vesnice vydělává bez tebe o 4 hodiny déle.', 'The village earns 4 hours longer without you.') },
  { n: 5, id: 'start', v: 1, name: L('Dědečkův pluh', 'Grandpa’s plough'), desc: L('Každé pokolení začíná s 10 políčky.', 'Every generation starts with 10 fields.') },
  { n: 15, id: 'hands', name: L('Babiččina truhla', 'Grandma’s chest'), desc: L('Vylepšení rukou zůstávají i dalším pokolením.', 'Hand upgrades stay for the next generations.') },
  { n: 40, id: 'freq', v: 0.25, name: L('Ranní rosa', 'Morning dew'), desc: L('Bytosti chodí o 25 % častěji.', 'Creatures come 25% more often.') },
  { n: 100, id: 'start', v: 2, name: L('Selská hlava', 'Farmer’s wit'), desc: L('Každé pokolení začíná s 10 kusy prvních čtyř řemesel.', 'Every generation starts with 10 of each of the first four trades.') },
  { n: 250, id: 'season', v: 1, name: L('Moudrost předků', 'Wisdom of the elders'), desc: L('Sezónní řemesla vydělávají o jeden násobek víc.', 'In-season trades earn one more multiple.') },
  { n: 600, id: 'offline', v: 12, name: L('Strážce vsi', 'Village guardian'), desc: L('Vesnice vydělává bez tebe o dalších 12 hodin déle.', 'The village earns another 12 hours longer without you.') },
  { n: 1500, id: 'cheap', v: 0.1, name: L('Krakonošův přítel', 'Friend of Krakonoš'), desc: L('Všechny budovy jsou o 10 % levnější.', 'All buildings are 10% cheaper.') },
  { n: 4000, id: 'auto', v: 3, name: L('Hospodáříček na stálo', 'A sprite for good'), desc: L('Hospodáříček za tebe klepe třikrát za sekundu.', 'The house sprite taps for you three times a second.') },
  { n: 10000, id: 'milestone', v: 3, name: L('Zlatý věk', 'Golden age'), desc: L('Každé mistrovství ztrojnásobí výnos místo zdvojnásobení.', 'Every mastery triples output instead of doubling it.') },
];
const OFFLINE_BASE = 8; // hodin
const STEWARD_COST = 3; // pověsti za šafáře

// ── Úkoly dne (3 denně, stejné pro všechny) ──
const DAILY = [
  { kind: 'buy', n: 30, text: n => L(`Postav ${n} budov`, `Build ${n} buildings`) },
  { kind: 'tap', n: 300, text: n => L(`Klepni ${n}× do vesnice`, `Tap the village ${n} times`) },
  { kind: 'catch', n: 3, text: n => L(`Chyť ${n} bytosti`, `Catch ${n} creatures`) },
  { kind: 'upg', n: 3, text: n => L(`Kup ${n} vylepšení`, `Buy ${n} upgrades`) },
  { kind: 'earn', n: 3600, text: n => L(`Vydělej ${n}`, `Earn ${n}`) },
  { kind: 'season', n: 2, text: n => L(`Hraj ve ${n} ročních obdobích`, `Play in ${n} seasons`) },
  { kind: 'milestone', n: 1, text: () => L('Získej mistrovství v řemesle', 'Reach a mastery in a trade') },
];
const DAILY_REWARD = 600; // sekund výnosu za úkol
const BLESSING = { mul: 2, dur: 900 }; // všechny tři úkoly: požehnání

// ── Úspěchy (každý +2 % výnosu) ──
const ACH_BONUS = 0.02;
const ACHIEVEMENTS = [];
const ach = (id, name, desc, test, hidden) => ACHIEVEMENTS.push({ id, name, desc, test, hidden: !!hidden });
[[1, L('První brázda', 'First furrow')], [50, L('Dvůr', 'Farmyard')], [150, L('Osada', 'Hamlet')], [400, L('Ves', 'Village')], [800, L('Městys', 'Market town')], [1500, L('Město', 'Town')], [3000, L('Královské město', 'Royal town')]]
  .forEach(([n, name]) => ach('total' + n, name, n === 1 ? L('Postav první budovu', 'Build your first building') : L(`Měj ${n} budov`, `Own ${n} buildings`), S => Econ.total(S) >= n));
[[1e3, L('Plný měšec', 'Full purse')], [1e6, L('Milionář', 'Millionaire')], [1e9, L('Boháč', 'Rich man')], [1e12, L('Pan statkář', 'Landowner')], [1e15, L('Kupec', 'Merchant prince')], [1e18, L('Bankéř', 'Banker')],
  [1e21, L('Hrabě', 'Count')], [1e24, L('Kníže', 'Prince')], [1e27, L('Král', 'King')], [1e30, L('Císař', 'Emperor')], [1e36, L('Pohádkové bohatství', 'Fairy-tale riches')], [1e45, L('Za devatero horami', 'Beyond nine mountains')]]
  .forEach(([n, name]) => ach('earn' + n.toExponential(0), name, L(`Vydělej celkem ${fmt(n)} grošů`, `Earn ${fmt(n)} groschen in total`), S => S.earnedAll >= n));
[[1, L('Kohoutí kokrhání', 'Cock-a-doodle')], [100, L('Ranní rozcvička', 'Morning exercise')], [1000, L('Pilná ručka', 'Busy hand')], [10000, L('Neúnavný', 'Tireless')], [50000, L('Klepací šampion', 'Tapping champion')]]
  .forEach(([n, name]) => ach('tap' + n, name, L(`Klepni ${n}× do vesnice`, `Tap the village ${n} times`), S => S.taps >= n));
CREATURES.forEach(c => ach('c_' + c.id, c.name, L(`Chyť: ${c.name}`, `Catch: ${c.name}`), S => (S.caught[c.id] || 0) > 0));
[[10, L('Pohádkář', 'Storyteller')], [50, L('Lovec bytostí', 'Creature hunter')], [200, L('Přítel pohádek', 'Friend of tales')], [500, L('Kouzelný dědeček', 'Wise old wizard')]]
  .forEach(([n, name]) => ach('caught' + n, name, L(`Chyť ${n} bytostí`, `Catch ${n} creatures`), S => Econ.caughtAll(S) >= n));
[[1, L('Nové pokolení', 'New generation')], [5, L('Rod', 'Lineage')], [15, L('Dynastie', 'Dynasty')], [40, L('Věčná ves', 'Eternal village')]]
  .forEach(([n, name]) => ach('gen' + n, name, L(`Předej vesnici ${n}× dalšímu pokolení`, `Pass the village on ${n} times`), S => S.gen - 1 >= n));
[[10, L('Vesnická pověst', 'Village legend')], [100, L('Kronikář', 'Chronicler')], [1000, L('Živá legenda', 'Living legend')], [10000, L('Mýtus', 'Myth')]]
  .forEach(([n, name]) => ach('leg' + n, name, L(`Získej ${n} pověstí`, `Gain ${n} legends`), S => Econ.legendsTotal(S) >= n));
ach('allb', L('Od pole po orloj', 'From field to clock'), L('Postav všech 14 řemesel', 'Build all 14 trades'), S => BUILDINGS.every(b => S.owned[b.id] > 0));
ach('each25', L('Všeuměl', 'Jack of all trades'), L('Měj od každého řemesla 25 kusů', 'Own 25 of every trade'), S => BUILDINGS.every(b => S.owned[b.id] >= 25));
ach('each100', L('Zlatá vesnice', 'Golden village'), L('Měj od každého řemesla 100 kusů', 'Own 100 of every trade'), S => BUILDINGS.every(b => S.owned[b.id] >= 100));
ach('upg25', L('Vynálezce', 'Inventor'), L('Kup 25 vylepšení', 'Buy 25 upgrades'), S => Object.keys(S.upg).length >= 25);
ach('upg75', L('Osvícenec', 'Enlightened'), L('Kup 75 vylepšení', 'Buy 75 upgrades'), S => Object.keys(S.upg).length >= 75);
ach('seasons', L('Rok na vsi', 'A year in the village'), L('Hraj ve všech čtyřech ročních obdobích', 'Play in all four seasons'), S => [0, 1, 2, 3].every(i => S.stats.seasons[i]));
ach('night', L('Noční sova', 'Night owl'), L('Hraj mezi půlnocí a čtvrtou ráno', 'Play between midnight and four in the morning'), S => S.stats.night > 0);
ach('away8', L('Vesnice nespí', 'The village never sleeps'), L('Vrať se po osmi hodinách', 'Come back after eight hours'), S => S.stats.awayMax >= 8 * 3600);
ach('daily', L('Den jako malovaný', 'A perfect day'), L('Splň všechny úkoly dne', 'Complete all daily tasks'), S => S.stats.dailyAll > 0);
ach('daily7', L('Týden na statku', 'A week on the farm'), L('Splň všechny úkoly dne sedmkrát', 'Complete all daily tasks seven times'), S => S.stats.dailyAll >= 7);
ach('steward', L('Pan správce', 'Lord of the manor'), L('Najmi šafáře', 'Hire a steward'), S => S.steward);
ach('nesro', L('Kamarád Nesro', 'Nesro’s friend'), L('Potkej na návsi Nesra', 'Meet Nesro on the village green'), S => S.stats.nesro > 0, true);

// ── Žebříčky: co se dá porovnávat s ostatními (log: velká čísla se posílají jako log10 × 1000) ──
const BOARDS = [
  { key: 'best:score', name: L('Pověsti', 'Legends'), icon: '📜', get: S => Econ.legendsTotal(S) },
  { key: 'free:jmeni:score', name: L('Jmění', 'Fortune'), icon: '💰', log: true, get: S => S.earnedAll },
  { key: 'free:vynos:score', name: L('Výnos', 'Income'), icon: '📈', log: true, get: S => S.stats.bestRate, unit: L(' za s', ' /s') },
  { key: 'free:budovy:score', name: L('Budovy', 'Buildings'), icon: '🏡', get: S => S.stats.maxBuildings },
  { key: 'free:bytosti:score', name: L('Bytosti', 'Creatures'), icon: '✨', get: S => Econ.caughtAll(S) },
  { key: 'free:klepnuti:score', name: L('Klepnutí', 'Taps'), icon: '👆', get: S => S.taps },
  { key: 'free:pokoleni:score', name: L('Pokolení', 'Generations'), icon: '👪', get: S => S.gen - 1 },
  { key: 'free:uspechy:score', name: L('Úspěchy', 'Achievements'), icon: '🏅', get: S => Econ.achCount(S) },
  { key: 'total:played', name: L('Čas ve hře', 'Time played'), icon: '⏱️', time: true, get: S => S.stats.playTime },
];
/** Hodnota z žebříčku zpět pro zobrazení. */
const boardValue = (d, v) => (d.log ? fmt(Math.pow(10, v / 1000)) + (d.unit || '') : d.time ? fmtDur(v) : fmt(v));

// ── Novinky (okénko vlevo nahoře; ukáže se samo, dokud hráč aktuální verzi neviděl) ──
const NEWS = [
  { v: 2, date: L('10. listopadu 2026', 'November 10, 2026'), items: [
    ['🤵', L('Šafář: najmeš ho v Kronice za 3 pověsti a nakupuje za tebe nejvýhodněji, i když nejsi u hry.', 'Steward: hire him in the Chronicle for 3 legends and he buys the best deals for you, even while you are away.')],
    ['⚡', L('Nejlepší koupě: tlačítko na návsi koupí jedním klepnutím to, co se nejrychleji zaplatí.', 'Best buy: one tap on the village button buys whatever pays for itself fastest.')],
    ['⭐', L('U řemesel tlačítko „do mistrovství“ koupí přesně tolik, kolik chybí do dalšího ×2, a vidíš, kolik si můžeš dovolit.', 'Trades: a “to mastery” button buys exactly what is missing to the next ×2, and you see how many you can afford.')],
    ['⏰', L('Úkoly dne ukazují, za jak dlouho přijdou nové.', 'Daily tasks show when the next ones arrive.')],
    ['🏡', L('Podrobnější „Vítej zpátky“ a rada, kdy se vrátit, aby vesnička nezahálela.', 'A more detailed welcome back and a hint on when to return so the village never idles.')],
    ['🏆', L('Žebříčky v devíti kategoriích a porovnání s ostatními hráči.', 'Leaderboards in nine categories and comparisons with other players.')],
  ] },
];
const NEWS_VERSION = NEWS[0].v;
const A_INDEX = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

// Deterministická náhoda (úkoly dne)
function hash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
