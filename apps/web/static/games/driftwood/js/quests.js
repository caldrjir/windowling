'use strict';
// ── Příběh, úkoly, denní úkoly, dovednosti a místa na ostrově (velká aktualizace) ──
// Hlavní linka má 4 kapitoly; splněný úkol zůstává splněný (G.flags.qd). Denní úkoly se
// losují ze semínka a dne, takže v multiplayeru má každý den stejné úkoly. Vzkazy v lahvích,
// ruiny s úlomky mapy a vraky s bednami jsou pro každého hráče vlastní (G.flags.sites).

// běžné počítadlo hry (pro úkoly, denní úkoly a statistiky po smrti / útěku)
const RUN_KEYS = ['trees', 'rocks', 'fish', 'kills', 'wolves', 'bowKills', 'bears', 'cooked', 'crafted', 'built', 'berries', 'harvests', 'dist'];
const newRun = () => Object.fromEntries(RUN_KEYS.map(k => [k, 0]));
const runStats = () => G.run || (G.run = newRun());
const runBump = (k, n = 1) => { const r = runStats(); r[k] = (r[k] || 0) + n; };
const invHas = id => Inv.count(id) > 0;
const hasBuilt = t => World.structures.some(s => s.type === t);
const piecesFound = () => Object.keys((G.flags && G.flags.pieces) || {}).length;
const cookedFood = () => Inv.count('cookedMeat') + Inv.count('cookedFish') + Inv.count('stew');
const skinFull = () => Inv.slots.some(x => x && x.id === 'waterskin' && x.ch > 0);

// ── Vzkazy (příběh trosečníka Tomáše) ──
const NOTES = [
  L('Den 3. Albatros se roztříštil o útes na severu. Jsem jediný, kdo doplaval na břeh. Moře je slané – sladká voda je jen v jezírkách ve vnitrozemí. — T. V.', 'Day 3. The Albatross shattered on the northern reef. I am the only one who swam ashore. The sea is salt – fresh water lies only in the inland ponds. — T. V.'),
  L('Den 9. V noci chodí vlci. Bojí se ohně – táborák u přístřešku mi zachránil život víc než jednou.', 'Day 9. Wolves come at night. They fear fire – a campfire by my shelter has saved my life more than once.'),
  L('Den 14. Ryby berou nejlíp za soumraku. Prut z větve a vláken stačí. Hlad už nemám, jen stesk.', 'Day 14. Fish bite best at dusk. A rod of branch and fiber is enough. I am no longer hungry, only homesick.'),
  L('Den 21. Ve skalách jsem našel kruh starých kamenů se znaky. Pod oltářem ležel kus mapy vyrytý do kůže. Kdo tu žil před námi?', 'Day 21. Among the rocks I found a ring of old stones carved with signs. Under the altar lay a piece of a map scratched into leather. Who lived here before us?'),
  L('Den 30. Na hoře žije medvěd. Říkám mu Starý Šedák. Jeho kožešina by mě v bouřích zahřála, ale zatím nemám odvahu.', 'Day 30. A bear lives on the mountain. I call him Old Grey. His fur would keep me warm in the storms, but I lack the courage yet.'),
  L('Kameny mluví: „Tři kusy cesty, tři strážci. Kdo je spojí, uvidí průliv v útesech.“ Úlomek ukazuje bezpečnou cestu přes útesy.', 'The stones speak: "Three pieces of the way, three guardians. Whoever joins them shall see the passage through the reefs." The fragment shows a safe way past the reefs.'),
  L('Den 41. Mám dva úlomky. Třetí je prý u moře, kde se rodí slunce. Postavil jsem vor, ale bez mapy jsem se vrátil – útesy mě málem roztrhaly.', 'Day 41. I have two fragments. The third lies by the sea where the sun is born, they say. I built a raft, but without the chart I turned back – the reefs nearly tore me apart.'),
  L('Jestli tohle čteš, dokonči, co jsem nestihl. Slož mapu, ušij plachtu, vezmi si jídlo a vodu a pluj za úsvitu na východ. — Tomáš Vrba, kartograf lodi Albatros', 'If you are reading this, finish what I could not. Join the chart, sew a sail, take food and water and sail east at dawn. — Thomas Vrba, cartographer of the Albatross'),
];

// ── Hlavní úkoly ──
const CHAPTERS = [
  { name: L('Trosečník', 'Castaway'), reward: [['bandage', 2], ['torch', 2]] },
  { name: L('Osadník', 'Settler'), reward: [['cookedFish', 3], ['rope', 4]] },
  { name: L('Průzkumník', 'Explorer'), reward: [['iron', 2], ['bandage', 3], ['arrow', 10]] },
  { name: L('Cesta domů', 'The Way Home'), reward: [] },
];
const nearestOf = (list, P) => { let best = null, bd = 1e9; for (const o of list) { const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < bd) { bd = d; best = o; } } return best; };
const QUESTS = [
  { id: 'gather', ch: 0, t: L('Seber větve a kamínky ze země (E)', 'Pick up branches and pebbles (E)'), done: () => (Inv.count('wood') >= 3 && Inv.count('stone') >= 3) || runStats().crafted > 0 },
  { id: 'fiber', ch: 0, t: L('Natrhej vlákna z rostlin (E)', 'Gather fiber from plants (E)'), done: () => Inv.count('fiber') >= 2 || runStats().crafted > 0 },
  { id: 'axe', ch: 0, t: L('Vyrob kamennou sekeru (Tab)', 'Craft a stone axe (Tab)'), done: () => invHas('stoneAxe') || invHas('ironAxe') || G.flags.axe },
  { id: 'fire', ch: 0, t: L('Postav táborák před setměním', 'Build a campfire before nightfall'), done: () => hasBuilt('campfire') },
  { id: 'fresh', ch: 0, t: L('Najdi jezírko se sladkou vodou a napij se', 'Find a freshwater pond and drink'), done: () => G.flags.fresh, target: P => nearestOf(World.ponds, P) },
  { id: 'bench', ch: 0, t: L('Postav pracovní stůl', 'Build a workbench'), done: () => hasBuilt('workbench') },
  { id: 'hunt', ch: 0, t: L('Ulov zvíře kvůli kůži a masu', 'Hunt an animal for hide and meat'), done: () => invHas('hide') || G.flags.hide },
  { id: 'sleep', ch: 0, t: L('Postav přístřešek a přespi noc', 'Build a shelter and sleep through a night'), done: () => G.flags.slept },
  { id: 'chest', ch: 1, t: L('Postav truhlu na zásoby', 'Build a chest for your supplies'), done: () => hasBuilt('chest') },
  { id: 'rod', ch: 1, t: L('Vyrob rybářský prut', 'Craft a fishing rod'), done: () => invHas('fishingRod') || G.flags.rod },
  { id: 'fish', ch: 1, t: L('Chyť rybu v moři nebo v jezírku', 'Catch a fish in the sea or a pond'), done: () => runStats().fish > 0 },
  { id: 'cook', ch: 1, t: L('Uvař jídlo u táboráku', 'Cook a meal at a campfire'), done: () => runStats().cooked > 0 },
  { id: 'plant', ch: 1, t: L('Postav záhon a zasaď bobule', 'Build a garden bed and plant berries'), done: () => G.flags.planted },
  { id: 'skin', ch: 1, t: L('Vyrob měch na vodu a naplň ho', 'Craft a waterskin and fill it'), done: () => skinFull() || G.flags.skin },
  { id: 'bow', ch: 2, t: L('Vyrob luk a šípy', 'Craft a bow and arrows'), done: () => (invHas('bow') && invHas('arrow')) || G.flags.bow },
  { id: 'shoot', ch: 2, t: L('Skol zvíře šípem', 'Take down an animal with an arrow'), done: () => runStats().bowKills > 0 },
  { id: 'ore', ch: 2, t: L('Najdi železnou rudu v horách', 'Find iron ore in the mountains'), done: () => invHas('ironOre') || invHas('iron') || G.flags.ore, target: P => nearestOf(World.nodes.ironRock.filter(o => o.alive), P) },
  { id: 'iron', ch: 2, t: L('Postav pec a vytav železo', 'Build a furnace and smelt iron'), done: () => G.flags.iron },
  { id: 'ironTool', ch: 2, t: L('Vykovej železný nástroj', 'Forge an iron tool'), done: () => invHas('ironAxe') || invHas('ironPick') || invHas('ironSpear') || G.flags.ironTool },
  { id: 'ruin', ch: 2, t: L('Prozkoumej prastaré ruiny', 'Explore the ancient ruins'), done: () => piecesFound() > 0, target: P => nearestOf(Sites.list.filter(s => s.kind === 'ruin' && !Sites.used(s)), P) },
  { id: 'bear', ch: 2, t: L('Poraz Starého Šedáka, medvěda z hor', 'Defeat Old Grey, the mountain bear'), done: () => runStats().bears > 0 || G.flags.bear, target: () => World.lair },
  { id: 'pieces', ch: 2, t: L('Najdi všechny tři úlomky mapy', 'Find all three map fragments'), prog: () => [piecesFound(), 3], done: () => piecesFound() >= 3, target: P => nearestOf(Sites.list.filter(s => s.kind === 'ruin' && !Sites.used(s)), P) },
  { id: 'chart', ch: 3, t: L('Slož námořní mapu u pracovního stolu', 'Assemble the sea chart at a workbench'), done: () => invHas('seaChart') || G.flags.chart },
  { id: 'sail', ch: 3, t: L('Ušij plachtu', 'Sew a sail'), done: () => invHas('sail') || G.flags.raft },
  { id: 'raft', ch: 3, t: L('Postav vor', 'Build the raft'), done: () => invHas('raft') || G.flags.raft },
  { id: 'supplies', ch: 3, t: L('Připrav zásoby: 3 vařená jídla a plný měch', 'Pack supplies: 3 cooked meals and a full waterskin'), prog: () => [Math.min(3, cookedFood()) + (skinFull() ? 1 : 0), 4], done: () => cookedFood() >= 3 && skinFull() },
  { id: 'escape', ch: 3, t: L('Spusť vor na moře a vypluj domů', 'Launch the raft and sail home'), done: () => false },
];

const Story = {
  qdone(q) { return !!(G.flags.qd && G.flags.qd[q.id]); },
  current() { return QUESTS.find(q => !this.qdone(q)) || null; },
  chapterOf(q) { return q ? q.ch : CHAPTERS.length - 1; },
  // splněné úkoly se zapíšou (i ty, které hráč splnil mimo pořadí)
  update() {
    if (!G.flags.qd) G.flags.qd = {};
    let changed = false;
    for (const q of QUESTS) {
      if (G.flags.qd[q.id] || !q.done()) continue;
      const cur = this.current();
      G.flags.qd[q.id] = true; changed = true;
      if (cur === q && !this._silent) {
        Skills.add('survive', 15);
        Sound.play.quest();
        // celá kapitola hotová?
        if (QUESTS.filter(o => o.ch === q.ch).every(o => G.flags.qd[o.id])) {
          const C = CHAPTERS[q.ch];
          for (const [id, n] of C.reward) { const left = Inv.add(id, n); if (left < n) UI.gain(id, n - left); }
          UI.chapter(q.ch);
          UI.renderHotbar();
        }
      }
    }
    // první kapitola je návod: kdo už je dál (třeba ve starší uložené hře), má splněné i předchozí kroky
    const tut = QUESTS.filter(q => q.ch === 0), last = tut.map(q => !!G.flags.qd[q.id]).lastIndexOf(true);
    for (let i = 0; i < last; i++) if (!G.flags.qd[tut[i].id]) { G.flags.qd[tut[i].id] = true; changed = true; }
    if (changed) UI._obj = null;
    this.daily();
  },
  // při načtení starší hry se úkoly zapíšou potichu
  sync() { this._silent = true; this.update(); this._silent = false; },

  // ── Denní úkoly ──
  POOL: [
    { k: 'trees', t: n => L(`Pokácej ${n} ${plural(n, 'strom', 'stromy', 'stromů')}`, `Fell ${n} tree${n > 1 ? 's' : ''}`), n: d => Math.min(14, 4 + Math.floor(d / 2)), skill: 'gather' },
    { k: 'rocks', t: n => L(`Vytěž ${n} ${plural(n, 'skálu', 'skály', 'skal')}`, `Mine ${n} rock${n > 1 ? 's' : ''}`), n: d => Math.min(12, 3 + Math.floor(d / 2)), skill: 'gather' },
    { k: 'fish', t: n => L(`Chyť ${n} ${plural(n, 'rybu', 'ryby', 'ryb')}`, `Catch ${n} fish`), n: d => Math.min(6, 2 + Math.floor(d / 4)), skill: 'hunt', need: () => invHas('fishingRod') || G.flags.rod },
    { k: 'kills', t: n => L(`Ulov ${n} ${plural(n, 'zvíře', 'zvířata', 'zvířat')}`, `Hunt ${n} animal${n > 1 ? 's' : ''}`), n: d => Math.min(6, 2 + Math.floor(d / 4)), skill: 'hunt', need: d => d >= 2 },
    { k: 'wolves', t: n => L(`Zabij ${n} ${plural(n, 'vlka', 'vlky', 'vlků')}`, `Slay ${n} wolf${n > 1 ? 'ves' : ''}`), n: d => Math.min(4, 1 + Math.floor(d / 5)), skill: 'hunt', need: d => d >= 3 },
    { k: 'cooked', t: n => L(`Uvař ${n} ${plural(n, 'jídlo', 'jídla', 'jídel')}`, `Cook ${n} meal${n > 1 ? 's' : ''}`), n: d => Math.min(6, 2 + Math.floor(d / 4)), skill: 'survive', need: d => d >= 2 },
    { k: 'berries', t: n => L(`Natrhej ${n} bobulí`, `Pick ${n} berries`), n: d => Math.min(24, 8 + d), skill: 'survive' },
    { k: 'crafted', t: n => L(`Vyrob ${n} ${plural(n, 'předmět', 'předměty', 'předmětů')}`, `Craft ${n} item${n > 1 ? 's' : ''}`), n: d => Math.min(10, 3 + Math.floor(d / 3)), skill: 'survive' },
  ],
  REWARDS: [['bandage', 2], ['arrow', 8], ['cookedMeat', 2], ['rope', 3], ['torch', 2], ['cookedFish', 2], ['iron', 1]],
  daily() {
    const day = G.day, D = G.flags.daily;
    if (!D || D.day !== day) {
      const rnd = mulberry32((G.seed * 31 + day * 977) >>> 0);
      const pool = this.POOL.filter(p => !p.need || p.need(day));
      const tasks = [];
      while (tasks.length < 3 && pool.length) {
        const p = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
        const rw = this.REWARDS[Math.floor(rnd() * (day >= 6 ? this.REWARDS.length : this.REWARDS.length - 1))];
        tasks.push({ k: p.k, n: p.n(day), done: false, rw });
      }
      G.flags.daily = { day, tasks, base: Object.assign({}, runStats()) };
      UI._obj = null;
      return;
    }
    for (const t of D.tasks) {
      if (t.done || this.dprog(t) < t.n) continue;
      t.done = true;
      const p = this.POOL.find(o => o.k === t.k);
      Skills.add(p ? p.skill : 'survive', 25 + day * 2);
      const left = Inv.add(t.rw[0], t.rw[1]);
      if (left < t.rw[1]) UI.gain(t.rw[0], t.rw[1] - left);
      SAVE.stats.dailies = (SAVE.stats.dailies || 0) + 1;
      Sound.play.quest();
      UI.notify(`${icon('star')} ${L('Denní úkol splněn', 'Daily task done')}`, 'gain');
      UI.renderHotbar();
      UI._obj = null;
      Game.checkAch();
    }
  },
  dprog(t) { const D = G.flags.daily; return Math.max(0, (runStats()[t.k] || 0) - ((D && D.base[t.k]) || 0)); },
  dtext(t) { const p = this.POOL.find(o => o.k === t.k); return p ? p.t(t.n) : t.k; },
};

// ── Dovednosti ──
const Skills = {
  all() { const P = Player.P; if (!P.skills) P.skills = { gather: { l: 1, x: 0 }, hunt: { l: 1, x: 0 }, survive: { l: 1, x: 0 } }; return P.skills; },
  lvl(k) { const s = this.all()[k]; return s ? s.l : 1; },
  add(k, n) {
    const s = this.all()[k];
    if (!s || s.l >= SKILL_MAX || !n) return;
    s.x += n;
    while (s.l < SKILL_MAX && s.x >= xpNeed(s.l)) {
      s.x -= xpNeed(s.l); s.l++;
      UI.levelUp(k, s.l);
      Sound.play.levelUp();
      if (s.l > (SAVE.stats.maxSkill || 0)) SAVE.stats.maxSkill = s.l;
      Game.checkAch();
    }
    if (s.l >= SKILL_MAX) s.x = 0;
    UI.xpGain(k, n);
  },
  gatherMul() { return 1 + (this.lvl('gather') - 1) * 0.1; },
  extraChance() { return (this.lvl('gather') - 1) * 0.04; },
  huntMul() { return 1 + (this.lvl('hunt') - 1) * 0.07; },
  quick() { return 1 - (this.lvl('hunt') - 1) * 0.06; },
  drainMul() { return 1 - (this.lvl('survive') - 1) * 0.04; },
  keepChance() { return (this.lvl('survive') - 1) * 0.05; },
};

// ── Místa: ruiny, vraky, lahve se vzkazy, doupě medvěda ──
const Sites = {
  list: [],
  used(s) { return !!(G.flags && G.flags.sites && G.flags.sites[s.id]); },
  // rozmístí místa (před stromy, aby na nich nerostly); rnd ze semínka ostrova
  generate(scene, rnd) {
    this.list = [];
    const W = World, ok = (x, z, minH, maxH, slope) => {
      const h = W.height(x, z);
      if (h < minH || h > maxH || W.isFreshWater(x, z)) return false;
      const sl = Math.abs(W.height(x + 2, z) - W.height(x - 2, z)) + Math.abs(W.height(x, z + 2) - W.height(x, z - 2));
      return sl < slope;
    };
    const far = (x, z, d) => this.list.every(s => Math.hypot(s.x - x, s.z - z) > d);
    const find = (test, tries = 3000) => {
      for (let t = 0; t < tries; t++) {
        const x = (rnd() * 2 - 1) * ISLAND_R, z = (rnd() * 2 - 1) * ISLAND_R;
        if (test(x, z)) return { x, z };
      }
      return null;
    };
    // pobřeží je úzký pruh: hledá se paprskem od moře ke středu ostrova
    const coast = (test, tries = 400) => {
      for (let t = 0; t < tries; t++) {
        const a = rnd() * Math.PI * 2;
        for (let d = ISLAND_R * 1.2; d > ISLAND_R * 0.25; d -= 1.5) {
          const x = Math.cos(a) * d, z = Math.sin(a) * d;
          if (test(x, z)) return { x, z };
          if (W.height(x, z) > 6) break;
        }
      }
      return null;
    };
    // tři ruiny: v lese, v horách a na východním pobřeží („kde se rodí slunce“)
    const ruins = [
      find((x, z) => ok(x, z, 4, 14, 2.4) && far(x, z, 70)) || find((x, z) => ok(x, z, 2.5, 20, 3.5) && far(x, z, 40)),
      find((x, z) => ok(x, z, 20, 38, 3.2) && far(x, z, 70)) || find((x, z) => ok(x, z, 10, 45, 4.5) && far(x, z, 40)),
      coast((x, z) => x > ISLAND_R * 0.3 && ok(x, z, 1.6, 5, 2.4) && far(x, z, 70)) || coast((x, z) => ok(x, z, 1.6, 6, 3) && far(x, z, 50)),
    ];
    ruins.forEach((p, i) => { if (p) this.add('ruin', `r${i}`, p.x, p.z, { note: 5 + i }); });
    // vraky s bednami a lahve se vzkazy na plážích
    for (let i = 0; i < 5; i++) { const p = coast((x, z) => ok(x, z, 0.5, 2.2, 1.6) && far(x, z, 30)) || coast((x, z) => ok(x, z, 0.4, 3, 2.4) && far(x, z, 12)); if (p) this.add('crate', `c${i}`, p.x, p.z, {}); }
    for (let i = 0; i < 5; i++) { const p = coast((x, z) => ok(x, z, 0.25, 1.4, 1.6) && far(x, z, 25)) || coast((x, z) => ok(x, z, 0.2, 2.5, 2.4) && far(x, z, 10)); if (p) this.add('bottle', `b${i}`, p.x, p.z, { note: i }); }
    // doupě medvěda: nejvyšší rozumně schůdné místo
    let best = null;
    for (let t = 0; t < 2500; t++) {
      const x = (rnd() * 2 - 1) * ISLAND_R * 0.8, z = (rnd() * 2 - 1) * ISLAND_R * 0.8;
      if (!ok(x, z, 14, 36, 3.5)) continue;
      const h = W.height(x, z);
      if (!best || h > best.h) best = { x, z, h };
    }
    W.lair = best ? { x: best.x, z: best.z } : { x: 0, z: 0 };
    if (best) this.add('lair', 'lair', best.x, best.z, {});
    for (const s of this.list) scene.add(s.mesh);
  },
  add(kind, id, x, z, extra) {
    const y = World.height(x, z), rot = (x * 13.7 + z * 7.1) % (Math.PI * 2);
    const s = Object.assign({ kind, id, x, y, z, rot }, extra);
    s.mesh = this.model(kind, s);
    s.mesh.position.set(x, y, z); s.mesh.rotation.y = rot;
    s.mesh.userData.site = s;
    this.list.push(s);
  },
  model(kind, s) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    const r = mulberry32(Math.round(s.x * 100 + s.z));
    const mesh = parts => { const m = new THREE.Mesh(mergeParts(parts), mat); m.castShadow = true; m.receiveShadow = true; return m; };
    if (kind === 'ruin') {
      const parts = [];
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2, h = 2 + r() * 1.2, broken = i === 2 || i === 5;
        parts.push([T(deform(new THREE.BoxGeometry(0.8, broken ? h * 0.45 : h, 0.55), 0.12, r), Math.cos(a) * 3.4, (broken ? h * 0.45 : h) / 2 - 0.15, Math.sin(a) * 3.4, (r() - 0.5) * 0.12, -a, (r() - 0.5) * 0.12), i % 2 ? '#8d918a' : '#7f857c', 0.12, r]);
        parts.push([T(new THREE.BoxGeometry(0.84, 0.18, 0.6), Math.cos(a) * 3.4, (broken ? h * 0.45 : h) * 0.35, Math.sin(a) * 3.4, 0, -a, 0), '#5e8a46', 0.15, r]);
      }
      parts.push([T(deform(new THREE.BoxGeometry(1.6, 0.7, 1.1), 0.08, r), 0, 0.3, 0), '#8a8e86', 0.1, r]);
      parts.push([T(new THREE.BoxGeometry(2.4, 0.12, 0.5), 3.3, 0.06, 1.2, 0, 0.7, 0.05), '#7a7f78', 0.1, r]);
      g.add(mesh(parts));
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.6), new THREE.MeshBasicMaterial({ color: 0x7fe0d0 }));
      rune.position.y = 0.68; g.add(rune); g.userData.rune = rune;
      g.userData.glow = FX.glowSprite(0x7fe0d0, 3.2); g.userData.glow.position.y = 1.1; g.add(g.userData.glow);
    } else if (kind === 'crate') {
      g.add(mesh([
        [T(new THREE.BoxGeometry(0.95, 0.7, 0.75), 0, 0.33, 0, 0, 0, 0.06), '#9a6b3e', 0.08, r],
        [T(new THREE.BoxGeometry(1.0, 0.08, 0.8), 0, 0.12, 0, 0, 0, 0.06), '#6a4428'], [T(new THREE.BoxGeometry(1.0, 0.08, 0.8), 0, 0.55, 0, 0, 0, 0.06), '#6a4428'],
        [T(new THREE.BoxGeometry(2.4, 0.12, 0.28), 1.3, 0.06, 0.9, 0, 0.5, 0), '#8a5c34', 0.1, r],
        [T(new THREE.BoxGeometry(1.6, 0.1, 0.22), -1.2, 0.05, -0.7, 0, -0.9, 0), '#9a6b3e', 0.1, r],
        [T(new THREE.CylinderGeometry(0.12, 0.14, 3.2, 6), -0.4, 0.12, 1.6, Math.PI / 2, 0, 1.2), '#6a4428'],
      ]));
      const lid = mesh([[T(new THREE.BoxGeometry(0.98, 0.08, 0.78), 0, 0, 0), '#8a5c34', 0.08, r]]);
      lid.position.set(0, 0.72, 0); g.add(lid); g.userData.lid = lid;
      g.userData.glow = FX.glowSprite(0xffd88a, 1.4); g.userData.glow.position.y = 1.2; g.add(g.userData.glow);
    } else if (kind === 'bottle') {
      const glass = new THREE.MeshStandardMaterial({ color: 0x6abf8a, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.75 });
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.34, 8), glass); b.rotation.z = Math.PI / 2 - 0.3; b.position.y = 0.08;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.14, 8), glass); neck.position.set(0.22, 0.14, 0); neck.rotation.z = Math.PI / 2 - 0.3;
      const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.24, 6), new THREE.MeshStandardMaterial({ color: 0xf0e2c0 })); paper.rotation.z = Math.PI / 2 - 0.3; paper.position.y = 0.08;
      g.add(b, neck, paper);
      g.userData.glow = FX.glowSprite(0xfff0c0, 1.1); g.userData.glow.position.y = 0.5; g.add(g.userData.glow);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
    } else if (kind === 'lair') {
      const parts = [];
      for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = 1 + r() * 2.5; parts.push([T(new THREE.CylinderGeometry(0.05, 0.06, 0.5 + r() * 0.4, 5), Math.cos(a) * d, 0.05, Math.sin(a) * d, Math.PI / 2, r() * 3, 0), '#e8e0cc']); }
      parts.push([T(deform(new THREE.IcosahedronGeometry(1.6, 0), 0.35, r), -2.6, 0.6, 1.4, 0, 0, 0, 1.4, 1, 1.1), '#6f6c66', 0.12, r]);
      parts.push([T(deform(new THREE.IcosahedronGeometry(1.3, 0), 0.35, r), 2.4, 0.5, -1.6, 0, 0, 0, 1.2, 1.1, 1), '#77746d', 0.12, r]);
      g.add(mesh(parts));
    }
    return g;
  },
  refresh() {
    for (const s of this.list) {
      const used = this.used(s), U = s.mesh.userData;
      if (s.kind === 'bottle') s.mesh.visible = !used;
      if (s.kind === 'crate' && U.lid) { U.lid.position.set(used ? 0.55 : 0, used ? 0.45 : 0.72, 0); U.lid.rotation.z = used ? -1.1 : 0; }
      if (U.glow) U.glow.visible = !used;
      if (U.rune) U.rune.material.color.set(used ? 0x4a504a : 0x7fe0d0);
    }
  },
  near(P, r = 8) { return this.list.filter(s => s.kind !== 'lair' && s.mesh.visible && Math.hypot(s.x - P.x, s.z - P.z) < r); },
  label(s) {
    if (s.kind === 'ruin') return this.used(s) ? L('Prastaré ruiny (prozkoumáno)', 'Ancient ruins (explored)') : L('[E] Prozkoumat prastaré ruiny', '[E] Explore the ancient ruins');
    if (s.kind === 'crate') return this.used(s) ? L('Prázdná bedna z vraku', 'Empty shipwreck crate') : L('[E] Otevřít bednu z vraku', '[E] Open the shipwreck crate');
    if (s.kind === 'bottle') return L('[E] Sebrat láhev se vzkazem', '[E] Pick up the message in a bottle');
    return '';
  },
  interact(s) {
    if (this.used(s)) { UI.msg(s.kind === 'ruin' ? L('Ruiny už jsi prozkoumal.', 'You have already explored these ruins.') : L('Bedna je prázdná.', 'The crate is empty.')); return; }
    if (!G.flags.sites) G.flags.sites = {};
    G.flags.sites[s.id] = true;
    if (s.kind === 'bottle' || s.kind === 'ruin') { SAVE.notes[s.note] = Date.now(); }
    if (s.kind === 'bottle') {
      Sound.play.page(); Skills.add('survive', 10);
      UI.note(s.note);
    } else if (s.kind === 'crate') {
      Sound.play.chest(); Skills.add('survive', 8);
      const r = mulberry32((G.seed + s.id.charCodeAt(1) * 7919) >>> 0);
      const loot = [['rope', 2, 4], ['bandage', 1, 2], ['arrow', 4, 8], ['cookedFish', 1, 3], ['torch', 1, 2], ['iron', 1, 2], ['hide', 1, 3]];
      const n = 2 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) { const [id, a, b] = loot[Math.floor(r() * loot.length)]; const k = a + Math.floor(r() * (b - a + 1)); const left = Inv.add(id, k); if (left < k) UI.gain(id, k - left); }
      UI.renderHotbar();
    } else if (s.kind === 'ruin') {
      if (!G.flags.pieces) G.flags.pieces = {};
      G.flags.pieces[s.id] = true;
      const left = Inv.add('mapPiece', 1);
      if (left) Drops.put({ id: 'mapPiece', n: 1 }, Player.P.x, Player.P.z); else UI.gain('mapPiece', 1);
      Sound.play.ruin(); Skills.add('survive', 30);
      Particles.burst(s.x, s.y + 1, s.z, '#7fe0d0', 30, 3, 5);
      UI.renderHotbar();
      UI.note(s.note, L(`Úlomek mapy ${piecesFound()}/3`, `Map fragment ${piecesFound()}/3`));
    }
    this.refresh();
    Story.update();
    Game.checkAch();
  },
};

// ── Prozkoumaná mapa: mřížka 64×64 (každá buňka ~7 m), uložená jako hex řetězec ──
const MAPN = 64;
const Explore = {
  bits: null,
  load(hex) {
    this.bits = new Uint8Array(MAPN * MAPN / 8);
    if (typeof hex === 'string') for (let i = 0; i < this.bits.length && i * 2 + 1 < hex.length; i++) this.bits[i] = parseInt(hex.substr(i * 2, 2), 16) || 0;
  },
  hex() { return Array.from(this.bits, b => b.toString(16).padStart(2, '0')).join(''); },
  cell(x, z) { return [Math.floor((x + HALF) / SIZE * MAPN), Math.floor((z + HALF) / SIZE * MAPN)]; },
  seen(cx, cz) { if (cx < 0 || cz < 0 || cx >= MAPN || cz >= MAPN) return false; const i = cz * MAPN + cx; return !!(this.bits[i >> 3] & (1 << (i & 7))); },
  mark(x, z, r = 2) {
    if (!this.bits) this.load(G.flags.ex);
    const [cx, cz] = this.cell(x, z);
    let changed = false;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (i * i + j * j > r * r + 1) continue;
      const a = cx + i, b = cz + j;
      if (a < 0 || b < 0 || a >= MAPN || b >= MAPN) continue;
      const k = b * MAPN + a;
      if (!(this.bits[k >> 3] & (1 << (k & 7)))) { this.bits[k >> 3] |= 1 << (k & 7); changed = true; }
    }
    if (changed) G.flags.ex = this.hex();
  },
};
