'use strict';
// Echoes of the Hollow Sun – P0 prototyp: vykreslení (PlayCanvas), vstup, HUD, menu a benchmark.
// Simulaci (sim.js) jen čte a posílá jí příkazy; šedý box bez finálních assetů.
(function () {
  const HS = window.HS, SIM = window.HSim;
  const LANG = (() => { try { return localStorage.getItem('gamecenter.lang') === 'en' ? 'en' : 'cs'; } catch (e) { return 'cs'; } })();
  const T = {
    cs: {
      sub: 'Prototyp P0 · šedý box', pitch: 'Ash Knight proti hordám popela. Ověřujeme, jestli je souboj cítit a jestli prohlížeč utáhne 50 nepřátel v 60 FPS.',
      arena: 'Aréna (vlny)', bench: 'Benchmark: 50 nepřátel', assets: 'Test assetů', assetsTitle: 'Test asset pipeline', assetsHint: 'Kolečko mění vzdálenost kamery a tím LOD postavy (0–18 m LOD0, 18–35 m LOD1, dál LOD2). L přepíná automatický LOD, 1–4 animace. Esc zpět.', clip: 'Animace', crowd: '50 animovaných postav', crowdRun: 'Měřím 5 s…', crowdRes: 'Dav 50 postav (LOD1, skin + animace)', idle: 'Stání', run: 'Běh', attack: 'Útok (root motion)', death: 'Smrt', loading: 'Načítám…', loaded: 'načteno', lodAuto: 'automaticky', file: 'Soubor', tris: 'Trojúhelníky', mats: 'Materiály', sockets: 'Sockety', loadMs: 'Načtení', lod: 'LOD postavy', dist: 'Vzdálenost kamery', back: 'Zpět do centra', resume: 'Pokračovat', restart: 'Znovu', menu: 'Hlavní menu',
      wave: 'Vlna', kills: 'Zabití', paused: 'Pauza', over: 'Ozvěna se rozpadla', best: 'Nejlepší vlna', clickMove: 'Pohyb kliknutím (jinak WASD)',
      cleave: 'Cleave', slam: 'Searing Slam', charge: 'Ember Charge', dodge: 'Úhyb', nores: 'Málo Cinders', miss: 'Vedle', evade: 'Úhyb!', dodged: 'Vyhnuto',
      keysMove: 'Pohyb', keysMoveClick: 'levé tlačítko na zem (nebo WASD)', keysMoveWasd: 'WASD', keysCleave: 'levé tlačítko (držet) – generuje Cinders', keysSlam: 'pravé tlačítko – AoE, oheň, stojí Cinders', keysCharge: 'Q – výpad, omráčí', keysDodge: 'mezerník – úhyb s nezranitelností', keysMisc: 'Esc pauza · F počítadlo FPS · kolečko zoom',
      benchRun: 'Benchmark běží… autopilot bojuje s 50 nepřáteli', benchDone: 'Výsledek benchmarku', avg: 'Průměr FPS', low: '1 % nejhorších snímků', p95: '95. percentil snímku', simMs: 'Simulace na krok', entities: 'Nepřátel ve scéně', target: 'Cíl P0: 60 FPS s 50 nepřáteli', pass: 'splněno', fail: 'nesplněno', note: 'Měřeno v tomto prohlížeči a na tomto počítači.',
      hint: 'Telegraph = rudý tvar na zemi. Uhni mezerníkem, než se naplní.',
      brand: 'Brand Strike', bulwark: 'Ashen Bulwark', warcry: 'Cry of the Pyre', keysSkills: 'E Brand Strike · R Ashen Bulwark · T Cry of the Pyre (odemykají se s úrovní)', lvlUp: 'Úroveň', xpShort: 'XP', locked: 'Odemkne se na úrovni', unlocked: 'Nový skill', attrs: 'Atributy', points: 'Volné body', autoAlloc: 'Rozdělit automaticky', brandTxt: 'Cejch', absorbTxt: 'Štít', attrN: { str: 'Síla (STR)', dex: 'Obratnost (DEX)', int: 'Intelekt (INT)', wil: 'Vůle (WIL)', vit: 'Vitalita (VIT)' },
      boss: 'Boss: Kiln Warden', bossRec: 'doporučeno L12', bossHint: 'Uhni telegraphům. Před kužely se schovej za kovadlinu. Při Quench Slam najdi páru (zelené kruhy). U hořící pece stůj 1,5 s a uhasíš ji.', phaseN: ['', 'Fáze 1 — Kovář', 'Fáze 2 — Pec', 'Fáze 3 — Roztavený'], enrageT: 'Enrage', enraged: 'Kiln Warden zuří: pece hoří trvale, +50 % damage', immune: 'Nezranitelný', quenchedT: 'Pec uhašena', safeT: 'V páře', victory: 'Kiln Warden poražen', victoryT: 'Čas', lootHint: 'Sesbírej loot a vrať se do menu.', collect: 'Sbírat loot', bossKills: 'Bossové',
      forgeT: 'Kovárna · Kovářka Brannoc', forgeHint: 'Vyber předmět (nasazený nebo z batohu) a operaci. Ceny a pravidla podle Bible (G.CRAFT).', ember: 'Ember Shard', dust: 'Hollow Dust', sunmote: 'Sunmote', forgeSel: 'Vyber předmět vlevo.', forgeDone: 'Hotovo', forgeFail: { cost: 'Nemáš na to.', rar: 'Na tenhle předmět nejde.', town: 'Jen v Cinderholdu.', equipped: 'Nasazený předmět nejde rozebrat.', item: 'Vyber předmět.', quest: 'Questový předmět.', op: '—' }, salvaged: 'Rozebráno', goldN: 'zlato', goldHave: 'máš', passivesT: 'Pasivní dovednosti', passPts: 'body', respecT: 'Respec pasiv', respecFree: 'zdarma do L12', sellHint: 'V Cinderholdu: Shift + klik = prodat obchodníkovi.', sold: 'Prodáno', paid: 'Zaplaceno', reqL: 'od L', interruptT: 'Přerušeno!', wardT: 'Štít', dlgHint: 'klikni nebo mezerník', talkTo: 'Promluv s', gateOpen: 'Brána na severu vede dál.', gateLocked: 'Brána je zavřená. Nejdřív promluv s', floor: 'patro', whisperT: 'Šepot', questDone: 'Quest dokončen', gallowsKey: 'Rusty Gallows Key – na kopci za Charcoal Woods se něco otevřelo', sideLocked: 'Zamčeno. Klíč nosí někdo z Smoldering Brutů.', sideEnter: 'Vstoupit', sideStay: 'Zůstat', sideQ: 'Tajná oblast', back: 'Návrat', campaign: 'Kampaň: Act I', campNew: 'začít v Ashfields', campCont: 'pokračovat', zoneDone: 'Oblast dokončena', nextZone: 'Další oblast', continue: 'Pokračovat', lanternLit: 'Lantern zapálena – checkpoint', keyFound: 'Klíč nalezen – zamčené dveře se otevřou', respawned: 'Ozvěna se probouzí u Lantern', act1Done: 'Act I dokončen', gateHint: 'Projdi oblast až k bráně na jejím konci.', zoneLv: 'úroveň',
      inv: 'Inventář', invBtn: 'I · Inventář', invHint: 'Klik na předmět v batohu = nasadit · klik na nasazený = sundat · Shift + klik = zahodit · I / Esc zavře.', invStats: 'Postava', invEmpty: 'prázdné', cmp: 'Proti nasazenému', reqs: 'Požadavky', lvl: 'Úroveň', picked: 'Sebráno', invFull: 'Batoh je plný', why: { class: 'Ash Knight tuhle zbraň nepoužívá', level: 'Vyšší úroveň postavy', twohand: 'Obouruční zbraň zabírá i druhou ruku', base: 'Neznámý předmět' }, whyAttr: 'Chybí', stHp: 'Zdraví', stArmor: 'Armor (redukce)', stEva: 'Šance uhnout', stFire: 'Odolnost ohni', stDps: 'Cleave DPS (thrall)', stAs: 'Útoky za sekundu', stMs: 'Rychlost pohybu', keysInv: 'I – inventář, klik na předmět na zemi = sebrat', rar: { common: 'Common', magic: 'Magic', rare: 'Rare', unique: 'Unique' },
      latency: 'Test vstupu', latHint: 'Test vstupu: klikej na různá místa na zemi (20×). Měří se čas od kliknutí po snímek, kde se rytíř pohne.', latDone: 'Výsledek testu vstupu', latRender: 'Vstup → vykreslený snímek', latPresent: 'Vstup → další snímek (≈ zobrazení)', latMax: 'Nejhorší vzorek', latN: 'Vzorků', latTarget: 'Cíl P0: input latency < 50 ms (p95, vstup → zobrazení)', latNote: 'Měří prohlížeč od události vstupu; myš a monitor přidávají vlastní latenci. Simulace běží po 33 ms (30 Hz), čekání na další krok je součástí výsledku.', latShort: 'vstup',
      feel: 'Ohodnotit boj', feelTitle: 'Jak se boj hraje?', feelQ: ['Celkový pocit z boje', 'Odezva ovládání', 'Čitelnost telegraphů', 'Pocit zásahu (hit-stop, zvuk, čísla)'], feelNote: 'Poznámka (nepovinné)', feelSave: 'Uložit hodnocení', feelSaved: 'Hodnocení na tomto počítači', feelAvg: 'Průměr', feelCopy: 'Kopírovat výsledky', feelCopied: 'Zkopírováno do schránky', feelTarget: 'Cíl P0: průměr celkového pocitu ≥ 4/5 od 5 hráčů', feelPick: 'Vyber hodnocení u všech otázek.', gpuMs: 'GPU na snímek', cpuMs: 'CPU na snímek (update + render)', gpuName: 'Grafika', noTimer: 'neměřitelné v tomto prohlížeči', dmgDealt: 'Poškození', hits: 'Zásahy', dodges: 'Úspěšné úhyby', taken: 'Přijaté poškození',
    },
    en: {
      sub: 'Prototype P0 · grey box', pitch: 'An Ash Knight against hordes of ash. We are testing whether combat feels right and whether the browser holds 60 FPS with 50 enemies.',
      arena: 'Arena (waves)', bench: 'Benchmark: 50 enemies', assets: 'Asset test', assetsTitle: 'Asset pipeline test', assetsHint: 'The wheel changes the camera distance and with it the character LOD (0–18 m LOD0, 18–35 m LOD1, beyond LOD2). L toggles automatic LOD, 1–4 play the clips. Esc goes back.', clip: 'Clip', crowd: '50 animated characters', crowdRun: 'Measuring for 5 s…', crowdRes: 'Crowd of 50 (LOD1, skin + animation)', idle: 'Idle', run: 'Run', attack: 'Attack (root motion)', death: 'Death', loading: 'Loading…', loaded: 'loaded', lodAuto: 'automatic', file: 'File', tris: 'Triangles', mats: 'Materials', sockets: 'Sockets', loadMs: 'Load', lod: 'Character LOD', dist: 'Camera distance', back: 'Back to the center', resume: 'Resume', restart: 'Restart', menu: 'Main menu',
      wave: 'Wave', kills: 'Kills', paused: 'Paused', over: 'Your echo has shattered', best: 'Best wave', clickMove: 'Click to move (otherwise WASD)',
      cleave: 'Cleave', slam: 'Searing Slam', charge: 'Ember Charge', dodge: 'Dodge', nores: 'Not enough Cinders', miss: 'Miss', evade: 'Evade!', dodged: 'Dodged',
      keysMove: 'Move', keysMoveClick: 'left click on the ground (or WASD)', keysMoveWasd: 'WASD', keysCleave: 'left button (hold) – builds Cinders', keysSlam: 'right button – AoE fire, costs Cinders', keysCharge: 'Q – dash, stuns', keysDodge: 'space – dodge with i-frames', keysMisc: 'Esc pause · F FPS counter · wheel zoom',
      benchRun: 'Benchmark running… the autopilot fights 50 enemies', benchDone: 'Benchmark result', avg: 'Average FPS', low: '1 % low', p95: '95th percentile frame', simMs: 'Simulation per step', entities: 'Enemies in the scene', target: 'P0 target: 60 FPS with 50 enemies', pass: 'met', fail: 'not met', note: 'Measured in this browser on this computer.',
      hint: 'Telegraph = red shape on the ground. Dodge with space before it fills.',
      brand: 'Brand Strike', bulwark: 'Ashen Bulwark', warcry: 'Cry of the Pyre', keysSkills: 'E Brand Strike · R Ashen Bulwark · T Cry of the Pyre (unlock with level)', lvlUp: 'Level', xpShort: 'XP', locked: 'Unlocks at level', unlocked: 'New skill', attrs: 'Attributes', points: 'Unspent points', autoAlloc: 'Distribute automatically', brandTxt: 'Brand', absorbTxt: 'Shield', attrN: { str: 'Strength (STR)', dex: 'Dexterity (DEX)', int: 'Intelligence (INT)', wil: 'Willpower (WIL)', vit: 'Vitality (VIT)' },
      boss: 'Boss: Kiln Warden', bossRec: 'level 12 recommended', bossHint: 'Dodge the telegraphs. Hide behind the anvil from cones. On Quench Slam find the steam (green circles). Stand by a burning kiln for 1.5 s to quench it.', phaseN: ['', 'Phase 1 — The Smith', 'Phase 2 — The Kiln', 'Phase 3 — Molten'], enrageT: 'Enrage', enraged: 'The Kiln Warden rages: kilns burn for good, +50 % damage', immune: 'Immune', quenchedT: 'Kiln quenched', safeT: 'In the steam', victory: 'Kiln Warden defeated', victoryT: 'Time', lootHint: 'Collect the loot and return to the menu.', collect: 'Collect loot', bossKills: 'Bosses',
      forgeT: 'Forge · Smith Brannoc', forgeHint: 'Pick an item (equipped or in the bag) and an operation. Costs and rules from the Bible (G.CRAFT).', ember: 'Ember Shard', dust: 'Hollow Dust', sunmote: 'Sunmote', forgeSel: 'Pick an item on the left.', forgeDone: 'Done', forgeFail: { cost: 'You cannot afford it.', rar: 'Not on this item.', town: 'Only in Cinderhold.', equipped: 'An equipped item cannot be salvaged.', item: 'Pick an item.', quest: 'Quest item.', op: '—' }, salvaged: 'Salvaged', goldN: 'gold', goldHave: 'you have', passivesT: 'Passive skills', passPts: 'points', respecT: 'Respec passives', respecFree: 'free up to L12', sellHint: 'In Cinderhold: Shift + click = sell to the merchant.', sold: 'Sold', paid: 'Paid', reqL: 'from L', interruptT: 'Interrupted!', wardT: 'Ward', dlgHint: 'click or space', talkTo: 'Talk to', gateOpen: 'The north gate leads on.', gateLocked: 'The gate is shut. First talk to', floor: 'floor', whisperT: 'Whisper', questDone: 'Quest complete', gallowsKey: 'Rusty Gallows Key – something opened on the hill beyond the Charcoal Woods', sideLocked: 'Locked. One of the Smoldering Brutes carries the key.', sideEnter: 'Enter', sideStay: 'Stay', sideQ: 'Secret area', back: 'Return', campaign: 'Campaign: Act I', campNew: 'start in the Ashfields', campCont: 'continue', zoneDone: 'Area cleared', nextZone: 'Next area', continue: 'Continue', lanternLit: 'Lantern lit – checkpoint', keyFound: 'Key found – the locked doors will open', respawned: 'Your echo wakes at the Lantern', act1Done: 'Act I complete', gateHint: 'Cross the area to the gate at its end.', zoneLv: 'level',
      inv: 'Inventory', invBtn: 'I · Inventory', invHint: 'Click an item in the bag = equip · click an equipped one = take off · Shift + click = discard · I / Esc closes.', invStats: 'Character', invEmpty: 'empty', cmp: 'Against equipped', reqs: 'Requirements', lvl: 'Level', picked: 'Picked up', invFull: 'The bag is full', why: { class: 'The Ash Knight does not use this weapon', level: 'Higher character level needed', twohand: 'A two-handed weapon takes the off hand too', base: 'Unknown item' }, whyAttr: 'Missing', stHp: 'Health', stArmor: 'Armor (reduction)', stEva: 'Evade chance', stFire: 'Fire resistance', stDps: 'Cleave DPS (thrall)', stAs: 'Attacks per second', stMs: 'Movement speed', keysInv: 'I – inventory, click an item on the ground = pick up', rar: { common: 'Common', magic: 'Magic', rare: 'Rare', unique: 'Unique' },
      latency: 'Input test', latHint: 'Input test: click different spots on the ground (20×). It measures the time from the click to the frame in which the knight moves.', latDone: 'Input test result', latRender: 'Input → rendered frame', latPresent: 'Input → next frame (≈ on screen)', latMax: 'Worst sample', latN: 'Samples', latTarget: 'P0 target: input latency < 50 ms (p95, input → on screen)', latNote: 'Measured by the browser from the input event; the mouse and the monitor add their own latency. The simulation steps every 33 ms (30 Hz); waiting for the next step is part of the result.', latShort: 'input',
      feel: 'Rate the combat', feelTitle: 'How does the combat feel?', feelQ: ['Overall combat feel', 'Control responsiveness', 'Readability of telegraphs', 'Impact (hit-stop, sound, numbers)'], feelNote: 'Note (optional)', feelSave: 'Save rating', feelSaved: 'Ratings on this computer', feelAvg: 'Average', feelCopy: 'Copy results', feelCopied: 'Copied to the clipboard', feelTarget: 'P0 target: overall feel averages ≥ 4/5 from 5 players', feelPick: 'Pick a rating for every question.', gpuMs: 'GPU per frame', cpuMs: 'CPU per frame (update + render)', gpuName: 'Graphics', noTimer: 'not measurable in this browser', dmgDealt: 'Damage', hits: 'Hits', dodges: 'Successful dodges', taken: 'Damage taken',
    },
  };
  const t = (k) => (T[LANG][k] != null ? T[LANG][k] : T.cs[k]);
  document.documentElement.lang = LANG;

  /* ---------- uložení a statistiky pro centrum ---------- */
  const SAVE_KEY = 'hollowsun.save.v1', STATS_KEY = 'gamecenter.stats.hollowsun';
  const DEF = { v: 4, act1: null, story: null, gold: 0, cur: null, whispers: [], gallowsKey: false, gallowsDone: false, clickMove: true, bestWave: 0, kills: 0, playTime: 0, bench: null, latency: null, feel: [], gear: null, sinceU: 0, items: 0, char: null, bossKills: 0, bossBest: 0 };
  // načtení s migrací (HSim.migrateSave: v1 z P0 → v2 s výbavou)
  let SAVE = (() => { try { const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return Object.assign({}, DEF, raw ? window.HSim.migrateSave(raw) : {}); } catch (e) { return Object.assign({}, DEF); } })();
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE));
      localStorage.setItem(STATS_KEY, JSON.stringify({ playTime: Math.round(SAVE.playTime), lastPlayed: Date.now(), progress: SAVE.act1 && SAVE.act1.done ? 1 : Math.min(1, (window.HSWorld && SAVE.act1 ? window.HSWorld.ACT1.indexOf(SAVE.act1.zone) : 0) / (window.HSWorld ? window.HSWorld.ACT1.length : 8) + ((SAVE.char && SAVE.char.level) || 1) / 120), stats: { level: (SAVE.char && SAVE.char.level) || 1, bestWave: SAVE.bestWave, kills: SAVE.kills, items: SAVE.items || 0, benchFps: SAVE.bench ? SAVE.bench.avg : 0 } }));
    } catch (e) { /* bez úložiště */ }
  }

  /* ---------- PlayCanvas ---------- */
  const canvas = document.getElementById('gl');
  const app = new pc.Application(canvas, { mouse: new pc.Mouse(canvas), keyboard: new pc.Keyboard(window), graphicsDeviceOptions: { antialias: true, powerPreference: 'high-performance' } });
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  window.addEventListener('resize', () => app.resizeCanvas());
  app.scene.ambientLight = new pc.Color(0.32, 0.3, 0.33);
  try { app.scene.fog.type = pc.FOG_LINEAR; app.scene.fog.color = new pc.Color(0.04, 0.045, 0.06); app.scene.fog.start = 32; app.scene.fog.end = 70; } catch (e) { /* bez mlhy */ }

  const col = (h) => { const n = parseInt(h.slice(1), 16); return new pc.Color(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
  function mat(hex, o) {
    o = o || {}; const m = new pc.StandardMaterial();
    m.diffuse = col(hex); m.gloss = o.gloss != null ? o.gloss : 0.25;
    if (o.emissive) m.emissive = col(o.emissive);
    if (o.unlit) { m.useLighting = false; m.diffuse = new pc.Color(0, 0, 0); m.emissive = col(hex); }
    if (o.opacity != null) { m.blendType = o.add ? pc.BLEND_ADDITIVE : pc.BLEND_NORMAL; m.opacity = o.opacity; m.depthWrite = false; }
    if (o.twoSided) m.cull = pc.CULLFACE_NONE;
    m.update(); return m;
  }
  const M = {
    ground: null, rim: mat('#3a2f2a'), pillar: mat('#4a4440'), steel: mat('#3a3f4a', { gloss: 0.55 }), trim: mat('#ec7a3a', { emissive: '#7a2e0c' }), blade: mat('#c9c6bd', { gloss: 0.8, emissive: '#3a1a08' }),
    thrall: mat('#6b625a'), brute: mat('#4a3a33'), eyes: mat('#ff8a3a', { unlit: true }), furnace: mat('#ff6a1a', { unlit: true }), flash: mat('#ffd2a6', { unlit: true }), stun: mat('#9fd0ff', { unlit: true }),
    teleLine: mat('#ff3a3a', { unlit: true, opacity: 0.85, twoSided: true }), teleFill: mat('#c21a1a', { unlit: true, opacity: 0.35, twoSided: true }),
    swing: mat('#ffb15c', { unlit: true, opacity: 0.55, add: true, twoSided: true }), slam: mat('#ff7a2a', { unlit: true, opacity: 0.7, add: true, twoSided: true }), ghost: mat('#ec7a3a', { unlit: true, opacity: 0.35, add: true }), marker: mat('#e3b964', { unlit: true, opacity: 0.6, twoSided: true }),
  };
  // podlaha: procedurální textura mřížky 2 m (šedý box)
  (function () {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#26262b'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#34343b'; g.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
    const tex = new pc.Texture(app.graphicsDevice, { width: 256, height: 256, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT, mipmaps: true });
    tex.setSource(c);
    const m = new pc.StandardMaterial(); m.diffuseMap = tex; m.diffuseMapTiling = new pc.Vec2(SIM.ARENA / 2, SIM.ARENA / 2); m.gloss = 0.1; m.update(); M.ground = m;
  })();

  function ent(type, m, pos, scale, parent, shadows) {
    const e = new pc.Entity(); e.addComponent('render', { type, material: m, castShadows: shadows !== false, receiveShadows: true });
    if (pos) e.setLocalPosition(pos[0], pos[1], pos[2]); if (scale) e.setLocalScale(scale[0], scale[1], scale[2]);
    (parent || app.root).addChild(e); return e;
  }
  function sectorMesh(r0, r1, deg, seg) {
    const pos = [], nor = [], idx = []; const half = ((deg / 2) * Math.PI) / 180;
    for (let i = 0; i <= seg; i++) { const a = -half + (2 * half * i) / seg; const c = Math.cos(a), s = Math.sin(a); pos.push(c * r0, 0, s * r0, c * r1, 0, s * r1); nor.push(0, 1, 0, 0, 1, 0); }
    for (let i = 0; i < seg; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const mesh = new pc.Mesh(app.graphicsDevice); mesh.setPositions(pos); mesh.setNormals(nor); mesh.setIndices(idx); mesh.update(pc.PRIMITIVE_TRIANGLES); return mesh;
  }
  const MESH = {};
  // sdílené meshe drží jednu referenci navíc, aby je zničení efektu neuvolnilo (PlayCanvas počítá reference)
  const meshFor = (key, r0, r1, deg) => { if (!MESH[key]) { MESH[key] = sectorMesh(r0, r1, deg, Math.max(8, Math.round(deg / 6))); MESH[key].incRefCount(); } return MESH[key]; };
  function flat(mesh, m, x, z, face, scale, y) {
    const e = new pc.Entity(); e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, m)], castShadows: false, receiveShadows: false });
    e.setLocalPosition(x, y || 0.03, z); e.setLocalEulerAngles(0, (-face * 180) / Math.PI, 0); if (scale) e.setLocalScale(scale, 1, scale); app.root.addChild(e); return e;
  }

  // scéna
  const GROUND = ent('plane', M.ground, [0, 0, 0], [SIM.ARENA * 2.4, 1, SIM.ARENA * 2.4], null, false);
  const ARENA_G = new pc.Entity(); app.root.addChild(ARENA_G); // aréna vln; boss má vlastní kovárnu (BOSS_G)
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; const r = SIM.ARENA + 0.6; const b = ent('box', M.rim, [Math.cos(a) * r, 0.5 + (i % 3) * 0.25, Math.sin(a) * r], [1.6, 1 + (i % 3) * 0.5, 0.8], ARENA_G); b.setLocalEulerAngles(0, (-a * 180) / Math.PI + 90, 0); }
  for (const [x, z, r] of SIM.create({ mode: 'bench', benchCount: 0 }).pillars) ent('cylinder', M.pillar, [x, 1.25, z], [r * 2, 2.5, r * 2], ARENA_G);
  const sun = new pc.Entity(); sun.addComponent('light', { type: 'directional', color: new pc.Color(1, 0.82, 0.62), intensity: 1.4, castShadows: true, shadowDistance: 45, shadowResolution: 2048, shadowBias: 0.3, normalOffsetBias: 0.05 });
  sun.setLocalEulerAngles(68, 35, 0); app.root.addChild(sun);
  const glow = new pc.Entity(); glow.addComponent('light', { type: 'omni', color: new pc.Color(1, 0.45, 0.15), intensity: 1.2, range: 9, castShadows: false }); app.root.addChild(glow);

  // kamera: izometrická, pitch 50°, yaw 45°, zoom 14–22 m (D11)
  const cam = new pc.Entity(); cam.addComponent('camera', { clearColor: new pc.Color(0.04, 0.045, 0.06), fov: 46, nearClip: 0.5, farClip: 140 }); app.root.addChild(cam);
  const YAW = (45 * Math.PI) / 180, PITCH = (50 * Math.PI) / 180; let zoom = 18; const camT = new pc.Vec3(); let shake = 0;
  function placeCamera(dt) {
    const p = S ? S.player : { x: 0, z: 0 }; camT.lerp(camT, new pc.Vec3(p.x, 0, p.z), Math.min(1, dt * 8));
    const off = new pc.Vec3(Math.sin(YAW) * Math.cos(PITCH) * zoom, Math.sin(PITCH) * zoom, Math.cos(YAW) * Math.cos(PITCH) * zoom);
    shake = Math.max(0, shake - dt * 1.6); const sx = (Math.random() - 0.5) * shake, sz = (Math.random() - 0.5) * shake;
    cam.setPosition(camT.x + off.x + sx, off.y, camT.z + off.z + sz); cam.lookAt(camT.x + sx, 0, camT.z + sz);
  }
  // pohyb WASD vůči kameře
  const FWD = [-Math.sin(YAW), -Math.cos(YAW)], RIGHT = [Math.cos(YAW), -Math.sin(YAW)];

  /* ---------- hráč ---------- */
  const P = new pc.Entity(); app.root.addChild(P);
  const PG = new pc.Entity(); P.addChild(PG); // šedý box hráče (záloha, než se načte rytíř, a ?gray)
  ent('capsule', M.steel, [0, 0.9, 0], [0.9, 0.9, 0.9], PG);
  ent('cylinder', M.trim, [0, 1.25, 0], [0.95, 0.12, 0.95], PG);
  ent('box', M.trim, [0.38, 1.45, 0], [0.22, 0.12, 0.5], PG, false); // „zorník“ ukazuje směr
  const pivot = new pc.Entity(); pivot.setLocalPosition(0, 1.1, 0); PG.addChild(pivot);
  ent('box', M.blade, [0.9, 0, 0], [1.3, 0.12, 0.18], pivot); ent('box', M.steel, [0.25, 0, 0], [0.3, 0.2, 0.2], pivot);
  const ring = flat(meshFor('ring', 0.62, 0.72, 360), M.marker, 0, 0, 0, 1, 0.02); ring.reparent(P);

  /* ---------- stav a vstup ---------- */
  let S = null, mode = 'menu', acc = 0, hitstop = 0, renderT = 0, lastEvents = [];
  const keys = {}; let mouse = [innerWidth / 2, innerHeight / 2], lmb = false, aimPt = [0, 0];
  const pend = { cast: null, dodge: false, moveTo: null, click: false, pickup: null }; // click: krátké kliknutí (stisk i puštění mezi dvěma kroky) se neztratí
  function groundAt(mx, my) {
    const c = cam.camera; const a = c.screenToWorld(mx, my, c.nearClip), b = c.screenToWorld(mx, my, c.farClip);
    const k = a.y / (a.y - b.y || 1e-6); return [a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k];
  }
  function enemyNear(pt, rad) { let best = null, bd = rad; for (const e of S.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - pt[0], e.z - pt[1]) - e.r; if (d < bd) { bd = d; best = e; } } return best; }
  function readInput() {
    const inp = { aim: aimPt.slice() };
    let mx = 0, mz = 0; if (keys.w) { mx += FWD[0]; mz += FWD[1]; } if (keys.s) { mx -= FWD[0]; mz -= FWD[1]; } if (keys.d) { mx += RIGHT[0]; mz += RIGHT[1]; } if (keys.a) { mx -= RIGHT[0]; mz -= RIGHT[1]; }
    if (mx || mz) inp.move = [mx, mz];
    if (lmb || pend.click) {
      pend.click = false;
      if (SAVE.clickMove) {
        const e = enemyNear(aimPt, 1.2);
        if (e) { const d = Math.hypot(e.x - S.player.x, e.z - S.player.z); if (d <= S.skills.ak_cleave.sk.r + e.r) { inp.hold = true; inp.aim = [e.x, e.z]; } else inp.moveTo = [e.x, e.z]; }
        else if (!inp.move) inp.moveTo = aimPt.slice();
      } else inp.hold = true;
    }
    if (pend.cast) { inp.cast = pend.cast; pend.cast = null; }
    if (pend.pickup != null) { inp.pickup = pend.pickup; pend.pickup = null; }
    if (pend.dodge) { inp.dodge = true; pend.dodge = false; if (!inp.move) inp.move = [aimPt[0] - S.player.x, aimPt[1] - S.player.z]; }
    return inp;
  }
  app.mouse.disableContextMenu();
  app.mouse.on(pc.EVENT_MOUSEMOVE, (e) => { mouse = [e.x, e.y]; });
  app.mouse.on(pc.EVENT_MOUSEDOWN, (e) => { if (mode !== 'play') return; audioInit(); fresh = true; latInput(e.event ? e.event.timeStamp : performance.now()); mouse = [e.x, e.y]; aimPt = groundAt(e.x, e.y); if (e.button === pc.MOUSEBUTTON_LEFT) { lmb = true; pend.click = true; } if (e.button === pc.MOUSEBUTTON_RIGHT) pend.cast = 'ak_slam'; });
  app.mouse.on(pc.EVENT_MOUSEUP, (e) => { if (e.button === pc.MOUSEBUTTON_LEFT) lmb = false; });
  app.mouse.on(pc.EVENT_MOUSEWHEEL, (e) => { const lo = mode === 'assets' ? 6 : 14, hi = mode === 'assets' ? 45 : 22; zoom = Math.max(lo, Math.min(hi, zoom + (e.wheelDelta > 0 ? 1 : -1) * (mode === 'assets' ? 2 : 1))); });
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase(); keys[k] = true;
    if (k === 'escape') { if (mode === 'forge') closeForge(); else if (mode === 'inv') closeInv(); else if (mode === 'play') pause(); else if (mode === 'paused') resume(); else if (mode === 'assets') leaveAssets(); return; }
    if (k === 'i') { if (mode === 'inv') closeInv(); else if (mode === 'play') openInv(); return; }
    if (k === 'l' && mode === 'assets') { AS.lodAuto = !AS.lodAuto; if (!AS.lodAuto) AS.lod = (AS.lod + 1) % 3; }
    if (mode === 'assets' && AS.char && '1234'.includes(k)) { AS.char.enabled = true; playClip(AS.char, CLIPS[Number(k) - 1]); }
    if (k === 'f') { fpsOn = !fpsOn; document.getElementById('fps').hidden = !fpsOn; }
    if (mode === 'dialog') { if (k === ' ' || k === 'enter' || k === 'e') { e.preventDefault(); dlgNext(); } return; }
    if (mode !== 'play') return; audioInit();
    if (!e.repeat && ' qe12345rtwasd'.includes(k) && k.length === 1) { fresh = true; latInput(e.timeStamp); }
    if (k === ' ') { pend.dodge = true; e.preventDefault(); }
    if (k === 'q' || k === '3') pend.cast = 'ak_charge';
    if (k === '2') pend.cast = 'ak_slam';
    if (k === 'e' || k === '1') pend.cast = 'ak_brand';
    if (k === 'r' || k === '4') pend.cast = 'ak_bulwark';
    if (k === 't' || k === '5') pend.cast = 'ak_warcry';
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; lmb = false; if (mode === 'play') pause(); });

  /* ---------- zvuk: krátké procedurální efekty (Web Audio) ---------- */
  let AC = null, master = null;
  function audioInit() { if (AC) return; try { AC = new AudioContext(); master = AC.createGain(); master.gain.value = 0.35; master.connect(AC.destination); } catch (e) { AC = null; } if (AC && window.HSMusic) { HSMusic.init(AC); HSMusic.state(mode === 'menu' ? 'menu' : musicFor()); } }
  // hudba podle obrazovky: menu, aréna (explore/combat), boss; benchmark, test vstupu a test assetů bez hudby
  const musicFor = () => (mode === 'assets' ? 'none' : !S ? 'menu' : S.mode === 'boss' ? 'boss' : S.mode === 'bench' || LAT.on || !S.progress ? 'none' : 'arena'); // aréna i zóny Act I: vrstvy Emberfall Marches
  const music = (name) => { if (window.HSMusic) HSMusic.state(name || musicFor()); };
  const sting = (id) => !!(window.HSMusic && HSMusic.sting(id));
  let lastFight = -99;
  addEventListener('pointerdown', audioInit, { once: true }); addEventListener('keydown', audioInit, { once: true });
  function noise(dur, f0, f1, vol, type) {
    if (!AC) return; const n = AC.createBufferSource(); const len = Math.floor(AC.sampleRate * dur); const buf = AC.createBuffer(1, len, AC.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    n.buffer = buf; const f = AC.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(f0, AC.currentTime); f.frequency.exponentialRampToValueAtTime(f1, AC.currentTime + dur); const g = AC.createGain(); g.gain.value = vol; n.connect(f).connect(g).connect(master); n.start();
  }
  function tone(f0, f1, dur, vol, type) { if (!AC) return; const o = AC.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, AC.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), AC.currentTime + dur); const g = AC.createGain(); g.gain.setValueAtTime(vol, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur); o.connect(g).connect(master); o.start(); o.stop(AC.currentTime + dur); }
  const SFX = { swing: () => noise(0.14, 2400, 600, 0.5), hit: (c) => { tone(c ? 180 : 120, 50, 0.12, 0.6, 'triangle'); noise(0.05, 3000, 1500, 0.4); }, slam: () => { tone(90, 30, 0.45, 0.9); noise(0.35, 900, 120, 0.6, 'lowpass'); }, hurt: () => tone(320, 140, 0.18, 0.35, 'sawtooth'), dodge: () => noise(0.18, 600, 2400, 0.25), tele: () => tone(520, 480, 0.08, 0.08, 'square'), death: () => noise(0.25, 700, 150, 0.3, 'lowpass') };

  /* ---------- postavy z asset pipeline: rytíř se skinem a animacemi (CH_ak_body) ---------- */
  // Simulace určuje pozici i načasování; animace se jí přizpůsobí (root motion útoku se vynuluje).
  const CH = { res: null, gray: /[?&]gray\b/.test(location.search) };
  const M_BOSS = mat('#2a1d18', { gloss: 0.5, emissive: '#3a1206' });
  const M_BONE = mat('#b9ad98', { gloss: 0.2 }), M_HOUND = mat('#2b2420', { gloss: 0.3 }), M_BOW = mat('#5a3a22');
  const M_ROBE = mat('#4a3426', { gloss: 0.15 }), M_ORB = mat('#ff8a3a', { unlit: true }), M_WARD = mat('#ffcf7a', { unlit: true, opacity: 0.2 }); // normální blend: aditivní ignoruje opacity
  const CH_SETS = { en_acolyte: { M_ak_steel: M_ROBE, M_ak_ember: M.furnace }, en_bowman: { M_ak_steel: M_BONE, M_ak_ember: M.eyes }, en_thrall: { M_ak_steel: M.thrall, M_ak_ember: M.eyes }, en_brute: { M_ak_steel: M.brute, M_ak_ember: M.furnace }, bo_kiln: { M_ak_steel: M_BOSS, M_ak_ember: M.furnace } };
  const CH_SCALE = { en_thrall: 1, en_brute: 1.45, bo_kiln: 2.3, en_bowman: 0.95, en_acolyte: 0.95 };
  const SWING = 0.47; // s: švih v klipu AN_hero_attack (snímek 14 z 27)
  // Acolyte drží v pravé ruce žhavou kouli (Kiln Acolyte: mnich v kožené zástěře s kovářskými kleštěmi)
  function orbFor(c) { const sock = c.e.findByName('socket_hand_R'); if (sock) ent('sphere', M_ORB, [0, -0.25, 0], [0.22, 0.22, 0.22], sock, false); }
  function bowFor(c) { const sock = c.e.findByName('socket_hand_R'); if (sock) ent('box', M_BOW, [0, -0.1, 0], [0.06, 1.3, 0.06], sock, false); }
  function charVisual(parent, set, scale) {
    const holder = new pc.Entity(); holder.setLocalEulerAngles(0, 90, 0); if (scale) holder.setLocalScale(scale, scale, scale); parent.addChild(holder); // model hledí na +Z, simulace na +X
    const e = CH.res.instantiateRenderEntity(); holder.addChild(e);
    const lods = [0, 1, 2].map((l) => e.findByName('CH_ak_body_LOD' + l));
    const mis = []; lods.forEach((n) => { for (const r of n.findComponents('render')) for (const mi of r.meshInstances) mis.push({ mi, base: (set && set[mi.material.name]) || mi.material }); });
    for (const m of mis) m.mi.material = m.base;
    e.addComponent('anim', { activate: true });
    for (const a of CH.res.animations) { const tr = a.resource; const name = tr.name.replace(/^AN_hero_/, ''); e.anim.assignAnimation(name, tr, undefined, 1, name === 'idle' || name === 'run'); }
    const c = { e, holder, lods, mis, bone: e.findByName('root'), clip: null, key: null, lod: -1, mat: null };
    charClip(c, 'idle', 1, 0); return c;
  }
  // klip podle stavu; key odliší dva útoky po sobě (nový útok začne od začátku)
  function charClip(c, name, speed, blend, key) {
    const L = c.e.anim.baseLayer; if (!L) return;
    if (c.clip !== name) L.transition(name, blend === undefined ? 0.12 : blend); else if (key !== undefined && key !== c.key) L.activeStateCurrentTime = 0;
    c.clip = name; c.key = key; c.e.anim.speed = speed;
  }
  function charLod(c, x, z) {
    const cp = cam.getPosition(); const d = Math.hypot(cp.x - x, cp.y - 1, cp.z - z); const l = d < 18 ? 0 : d < 35 ? 1 : 2;
    if (l !== c.lod) { c.lods.forEach((n, i) => { n.enabled = i === l; }); c.lod = l; }
  }
  function charMat(c, m) { if (c.mat === m) return; c.mat = m; for (const x of c.mis) x.mi.material = m || x.base; }
  // po vyhodnocení animace: kořenová kost zůstane na místě (pozici drží simulace)
  function charPin(c) { if (c.bone) c.bone.setLocalPosition(0, 0, 0); }
  let PC = null, lastP = null; // rytíř hráče
  function charsReady() {
    if (CH.gray || !CH.res) return;
    PC = charVisual(P, null, 1); PG.enabled = false;
    // čepel v socketu pravé ruky: zbraň sleduje animaci
    const sock = PC.e.findByName('socket_hand_R'); if (sock) { ent('box', M.blade, [0, -0.55, 0], [0.07, 1.0, 0.16], sock); ent('box', M.steel, [0, -0.02, 0], [0.26, 0.06, 0.08], sock); }
    for (const v of EV.values()) if (v.dying >= 0) v.stale = true; // šedé nepřátele vymění syncWorld
  }

  /* ---------- vizuály nepřátel, telegraphy, efekty ---------- */
  const EV = new Map(); // id → vizuál nepřítele
  function enemyVisual(e) {
    if (e.type === 'en_hound') {
      const root = new pc.Entity(); app.root.addChild(root); root.setLocalPosition(e.x, 0, e.z); const body = new pc.Entity(); root.addChild(body);
      ent('box', M_HOUND, [0, 0.55, 0], [1.05, 0.38, 0.42], body); ent('box', M_HOUND, [0.62, 0.72, 0], [0.42, 0.3, 0.32], body); ent('box', M.eyes, [0.84, 0.76, 0], [0.06, 0.07, 0.24], body, false); ent('box', M.furnace, [0, 0.58, 0], [0.5, 0.2, 0.44], body, false);
      for (const [x, zz] of [[0.36, 0.14], [0.36, -0.14], [-0.36, 0.14], [-0.36, -0.14]]) ent('box', M_HOUND, [x, 0.22, zz], [0.11, 0.44, 0.11], body);
      const v = { root, body, base: null, hound: true, dying: 0, x: e.x, z: e.z }; EV.set(e.id, v); return v;
    }
    if (e.type === 'en_wisp') { const root = new pc.Entity(); app.root.addChild(root); root.setLocalPosition(e.x, 0, e.z); const body = ent('sphere', M.furnace, [0, 1.1, 0], [0.55, 0.55, 0.55], root, false); ent('sphere', M.ghost, [0, 1.1, 0], [1.1, 1.1, 1.1], root, false); const v = { root, body, base: M.furnace, wisp: true, dying: 0, x: e.x, z: e.z }; EV.set(e.id, v); return v; }
    if (CH.res && !CH.gray) {
      const root = new pc.Entity(); app.root.addChild(root); root.setLocalPosition(e.x, 0, e.z);
      const v = { root, c: charVisual(root, CH_SETS[e.type] || CH_SETS.en_thrall, CH_SCALE[e.type] || 1), dying: 0, x: e.x, z: e.z }; if (e.type === 'en_bowman') bowFor(v.c); if (e.type === 'en_acolyte') orbFor(v.c); EV.set(e.id, v); return v;
    }
    const root = new pc.Entity(); app.root.addChild(root); const big = e.type === 'en_brute';
    const body = ent('capsule', big ? M.brute : M.thrall, [0, big ? 1.25 : 0.85, 0], big ? [1.9, 1.25, 1.9] : [0.9, 0.85, 0.9], root);
    ent('box', big ? M.furnace : M.eyes, big ? [0.75, 1.5, 0] : [0.38, 1.35, 0], big ? [0.35, 0.6, 0.9] : [0.12, 0.08, 0.4], root, false);
    const v = { root, body, base: big ? M.brute : M.thrall, dying: 0, x: e.x, z: e.z }; EV.set(e.id, v); root.setLocalPosition(e.x, 0, e.z); return v;
  }
  const TELES = []; const FXS = [];
  function teleVisual(ev) {
    const isC = ev.shape === 'circle'; const key = isC ? 'c' : 'cone' + ev.w;
    const line = flat(isC ? meshFor('ringT', 0.93, 1, 360) : meshFor(key + 'L', 0.93, 1, ev.w), M.teleLine, ev.x, ev.z, ev.face, ev.r);
    const fill = flat(isC ? meshFor('disc', 0, 1, 360) : meshFor(key, 0, 1, ev.w), M.teleFill, ev.x, ev.z, ev.face, 0.01, 0.025);
    TELES.push({ id: ev.id, line, fill, r: ev.r, dur: ev.dur, t: 0 });
  }
  function fx(entity, life, upd) { FXS.push({ e: entity, life, t: 0, upd }); }
  // Quench Slam: celá zmenšená aréna rudě, 3 bezpečné kruhy (pára) zeleně
  const M_SAFE = mat('#6fd18a', { unlit: true, opacity: 0.55, twoSided: true });
  function qslamVisual(ev) {
    teleVisual({ id: ev.id, shape: 'circle', x: 0, z: 0, face: 0, r: ev.r, w: 360, dur: ev.dur });
    for (const [x, z] of ev.safe) { const e = flat(meshFor('disc', 0, 1, 360), M_SAFE, x, z, 0, ev.sr, 0.04); fx(e, ev.dur + 0.2, () => {}); }
  }
  // kovárna Kiln Wardena: zeď Ø 30 m, kovadlina uprostřed, 3 pece; doutnající zem jako prstenec
  let BOSS_G = null, smold = null, smoldKey = '';
  const M_KILN = mat('#ff6a1a', { unlit: true }), M_KILN_OFF = mat('#3a3330');
  const M_SMOLD = mat('#ff4a10', { unlit: true, opacity: 0.35, add: true, twoSided: true });
  function bossScene(on) {
    ARENA_G.enabled = !on; if (BOSS_G) { BOSS_G.destroy(); BOSS_G = null; smold = null; smoldKey = ''; } if (!on) return;
    BOSS_G = new pc.Entity(); app.root.addChild(BOSS_G); const R = S.arenaR;
    for (let i = 0; i < 34; i++) { const a = (i / 34) * Math.PI * 2; const b = ent('box', M.rim, [Math.cos(a) * (R + 0.6), 1, Math.sin(a) * (R + 0.6)], [2.9, 2 + (i % 2) * 0.6, 0.9], BOSS_G); b.setLocalEulerAngles(0, (-a * 180) / Math.PI + 90, 0); }
    const [ax, az, ar] = S.pillars[0]; ent('box', M.steel, [ax, 0.6, az], [ar * 1.9, 1.2, ar * 1.2], BOSS_G); ent('box', M.steel, [ax, 1.35, az], [ar * 2.2, 0.35, ar * 0.9], BOSS_G);
    S.kilnE = S.boss.kilns.map((k) => { const g = new pc.Entity(); g.setLocalPosition(k.x, 0, k.z); BOSS_G.addChild(g); ent('cylinder', M.pillar, [0, 1.2, 0], [2.2, 2.4, 2.2], g); const mouth = ent('box', M_KILN, [0, 0.9, 0], [1.0, 0.8, 1.0], g, false); return { k, mouth, on: true }; });
  }
  function syncBoss() {
    const b = S.boss; if (!b || !BOSS_G) return; const e = S.enemies.find((x) => x.id === b.id);
    if (e) { document.getElementById('boss-fill').style.width = Math.max(0, (e.hp / e.hpMax) * 100).toFixed(1) + '%'; }
    document.getElementById('bossbar').classList.toggle('immune', b.invuln > 0);
    document.getElementById('boss-ph').textContent = `${t('phaseN')[b.phase]} · ${Math.floor(b.t)} s${b.enrage ? ' · ' + t('enrageT') : ' / 240 s'}`;
    for (const k of S.kilnE || []) { const lit = k.k.alive && (b.phase >= 2 || b.enrage); if (lit !== k.on) { k.mouth.render.material = lit ? M_KILN : M_KILN_OFF; k.on = lit; } }
    const key = b.ground.toFixed(1); if (key !== smoldKey && b.ground < S.arenaR - 0.05) { if (smold) smold.destroy(); smold = flat(meshFor('smold' + key, b.ground / S.arenaR, 1, 360), M_SMOLD, 0, 0, 0, S.arenaR, 0.03); smold.reparent(BOSS_G); smoldKey = key; }
  }
  let slowmo = 0;
  /* ---------- kampaň Act I: scéna zóny, objekty, minimapa (P1) ---------- */
  // barvy podlahy podle oblasti (šedý box): pole popelavá, Tollgate kamenná, Woods uhelná, Kiln rozžhavená
  const ZONE_LOOK = { a1_ashfields: ['#2f2b28', '#4a4440'], a1_burnt_orchard: ['#2c2620', '#4d3b2c'], a1_tollgate: ['#2a2b2e', '#4f5259'], a1_charcoal_woods: ['#1f1d1c', '#3a3330'], a1_kiln: ['#33211a', '#5a2c18'], a1_chapel_crypt: ['#25242a', '#45434f'], a1_cinderhold: ['#2e2924', '#5b4a3a'], a1_gallows: ['#28261f', '#4a4536'] };
  let ZONE_G = null; const ZOBJ = new Map(); const ZDOOR = []; const ZVISIT = new Set();
  const M_WHISPER = mat('#b9c8ff', { unlit: true, opacity: 0.55 }), M_SIDE = mat('#9a7cff', { unlit: true }), M_UNIQUE = mat('#ec7a3a', { emissive: '#5a2410' });
  const M_GOLD = mat('#e3b964', { emissive: '#5a3f12' }), M_GOLD_OFF = mat('#4a4033'), M_LANTERN = mat('#ffcf7a', { unlit: true }), M_GATE = mat('#e05a2a', { unlit: true }), M_DOOR = mat('#5a3a22');
  const ACT1 = window.HSWorld ? window.HSWorld.ACT1 : [];
  const zoneName = (id) => { const W = window.HSWorld; const a = W && W.area(id); if (!a) return id; return W.floorsOf(a.id) > 1 ? `${a.n} · ${t('floor')} ${W.floorOf(id)}` : a.n; };
  function zoneScene(on) {
    if (ZONE_G) { ZONE_G.destroy(); ZONE_G = null; } ZOBJ.clear(); ZDOOR.length = 0; ZVISIT.clear(); for (const nm of ZNAMES) nm.el.remove(); ZNAMES.length = 0;
    GROUND.enabled = !on; if (on) ARENA_G.enabled = false;
    document.getElementById('minimap').hidden = !on; if (!on) return;
    const z = S.zone; const W = window.HSWorld; const look = ZONE_LOOK[z.area] || ZONE_LOOK.a1_ashfields;
    const mFloor = mat(look[0], { gloss: 0.1 }), mWall = mat(look[1], { gloss: 0.15 });
    ZONE_G = new pc.Entity(); app.root.addChild(ZONE_G);
    const all = new Set(z.keys.map((k) => k[0]));
    const rects = [...z.rooms, ...z.corridors.flatMap((c) => c.segs)];
    for (const r of rects) ent('box', mFloor, [(r.x0 + r.x1) / 2, -0.05, (r.z0 + r.z1) / 2], [r.x1 - r.x0, 0.1, r.z1 - r.z0], ZONE_G, false);
    // zdi: tam, kde těsně za hranou obdélníku už není průchozí plocha (vzorkování po 0,5 m)
    const H = 1.6, T = 0.6, STEP = 0.5;
    for (const r of rects) {
      for (const [ax, az, bx, bz, nx, nz] of [[r.x0, r.z0, r.x1, r.z0, 0, -1], [r.x0, r.z1, r.x1, r.z1, 0, 1], [r.x0, r.z0, r.x0, r.z1, -1, 0], [r.x1, r.z0, r.x1, r.z1, 1, 0]]) {
        const L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.round(L / STEP)); let run = -1;
        const flush = (i) => { if (run < 0) return; const t0 = run / n, t1 = i / n; const sl = L * (t1 - t0) + T; const cx = ax + (bx - ax) * ((t0 + t1) / 2) + nx * (T / 2), cz = az + (bz - az) * ((t0 + t1) / 2) + nz * (T / 2); ent('box', mWall, [cx, H / 2, cz], nx ? [T, H, sl] : [sl, H, T], ZONE_G); run = -1; };
        for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const px = ax + (bx - ax) * t + nx * 0.3, pz = az + (bz - az) * t + nz * 0.3; const solid = !W.walkable(z, px, pz, 0, all); if (solid && run < 0) run = i; if (!solid) flush(i); }
        flush(n);
      }
    }
    // zamčené chodby: dveře v polovině první části chodby, zmizí po nalezení klíče
    for (const c of z.corridors) if (c.lock) { const sgm = c.segs[0]; const horiz = sgm.x1 - sgm.x0 > sgm.z1 - sgm.z0; const e = ent('box', M_DOOR, [(sgm.x0 + sgm.x1) / 2, 1.1, (sgm.z0 + sgm.z1) / 2], horiz ? [0.5, 2.2, sgm.z1 - sgm.z0] : [sgm.x1 - sgm.x0, 2.2, 0.5], ZONE_G); ZDOOR.push({ lock: c.lock, e }); }
    for (const o of S.objs) {
      const g = new pc.Entity(); g.setLocalPosition(o.x, 0, o.z); ZONE_G.addChild(g); const parts = {};
      if (o.kind === 'lantern') { ent('cylinder', M.steel, [0, 1, 0], [0.2, 2, 0.2], g); parts.glow = ent('sphere', M_LANTERN, [0, 2.1, 0], [0.45, 0.45, 0.45], g, false); }
      else if (o.kind === 'chest') { parts.box = ent('box', o.unique ? M_UNIQUE : M_GOLD, [0, 0.35, 0], [1.1, 0.7, 0.7], g); }
      else if (o.kind === 'whisper') { parts.orb = ent('sphere', M_WHISPER, [0, 1.3, 0], [0.5, 0.5, 0.5], g, false); }
      else if (o.kind === 'deco') { ent('cylinder', mWall, [0, 1.6, 0], [2.4, 3.2, 2.4], g); ent('cylinder', M_DOOR, [0, 3.4, 0], [1.2, 0.6, 1.2], g); }
      else if (o.kind === 'npc') npcVisual(o, g, parts);
      else if (o.kind === 'side') { ent('box', mWall, [-1.1, 1.3, 0], [0.5, 2.6, 0.5], g); ent('box', mWall, [1.1, 1.3, 0], [0.5, 2.6, 0.5], g); ent('box', mWall, [0, 2.7, 0], [2.7, 0.4, 0.5], g); parts.glow = ent('box', S[o.need] ? M_SIDE : M_DOOR, [0, 1.2, 0], [1.7, 2.4, 0.08], g, false); }
      else if (o.kind === 'key') { parts.key = ent('box', M_GOLD, [0, 1, 0], [0.18, 0.5, 0.08], g, false); }
      else if (o.kind === 'gate') { ent('box', mWall, [-1.6, 1.6, 0], [0.6, 3.2, 0.6], g); ent('box', mWall, [1.6, 1.6, 0], [0.6, 3.2, 0.6], g); ent('box', mWall, [0, 3.3, 0], [3.8, 0.5, 0.6], g); parts.glow = ent('box', M_GATE, [0, 1.5, 0], [2.6, 3, 0.1], g, false); }
      ZOBJ.set(o.id, { o, g, parts });
    }
  }
  // NPC Cinderholdu: rytíř z asset pipeline v barvách postavy (bez modelu kapsle), jmenovka nad hlavou, hledí na náměstí
  const NPC_SETS = { np_teodor: mat('#2b3550', { gloss: 0.2 }), np_oduin: mat('#6b6f78', { gloss: 0.5 }), np_brannoc: mat('#5a3a22', { gloss: 0.2 }) };
  const ZNAMES = [];
  // jmenovky po umístění kamery v každém snímku (i během dialogu, kdy simulace stojí)
  function placeNames() { for (const nm of ZNAMES) { cam.camera.worldToScreen(new pc.Vec3(nm.x, 2.4, nm.z), tmpV); nm.el.style.transform = `translate(${tmpV.x.toFixed(0)}px, ${tmpV.y.toFixed(0)}px) translate(-50%, -100%)`; } }
  function npcVisual(o, g, parts) {
    g.setLocalEulerAngles(0, (-Math.atan2(-o.z, -o.x) * 180) / Math.PI, 0);
    const m = NPC_SETS[o.npc] || M.steel;
    if (CH.res && !CH.gray) parts.c = charVisual(g, { M_ak_steel: m, M_ak_ember: M.furnace }, 1); else ent('capsule', m, [0, 0.9, 0], [0.9, 0.9, 0.9], g);
    const n = HS.D.npcs.find((x) => x.id === o.npc); const el = document.createElement('div'); el.className = 'drop npcname'; el.textContent = n ? n.n : o.npc; dropsLayer.appendChild(el); ZNAMES.push({ el, x: o.x, z: o.z });
  }
  function syncZone() {
    if (!ZONE_G || !S.zone) return;
    for (const { o, g, parts } of ZOBJ.values()) {
      if (o.kind === 'key') { if (o.done) g.enabled = false; else parts.key.setLocalEulerAngles(0, renderT * 90, 0); }
      if (o.kind === 'whisper') { if (o.done) g.enabled = false; else parts.orb.setLocalPosition(0, 1.3 + Math.sin(renderT * 2) * 0.15, 0); }
      if (o.kind === 'side' && S[o.need] && parts.glow.render.material !== M_SIDE) parts.glow.render.material = M_SIDE;
      if (o.kind === 'chest' && o.done && parts.box.render.material !== M_GOLD_OFF) parts.box.render.material = M_GOLD_OFF;
    }
    for (const d of ZDOOR) if (d.e.enabled && S.zoneKeys.has(d.lock)) d.e.enabled = false;
    const p = S.player; for (const r of S.zone.rooms) if (p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1) ZVISIT.add(r.id);
    for (const { o, parts } of ZOBJ.values()) if (o.kind === 'npc' && parts.c) { charPin(parts.c); charLod(parts.c, o.x, o.z); }
    if (Math.floor(renderT * 10) % 3 === 0) drawMinimap();
  }
  // minimapa: navštívené místnosti světle, ostatní tmavě; Lantern zeleně, brána rudě, truhly a klíče zlatě
  function drawMinimap() {
    const cv = document.getElementById('minimap'); const g = cv.getContext('2d'); const z = S.zone; const W = cv.width, Hh = cv.height;
    const xs = z.rooms.flatMap((r) => [r.x0, r.x1]), zs = z.rooms.flatMap((r) => [r.z0, r.z1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), minz = Math.min(...zs), maxz = Math.max(...zs);
    const k = Math.min((W - 12) / (maxx - minx), (Hh - 12) / (maxz - minz)); const X = (x) => 6 + (x - minx) * k, Z = (v) => 6 + (v - minz) * k;
    g.clearRect(0, 0, W, Hh); g.fillStyle = '#07080ccc'; g.fillRect(0, 0, W, Hh);
    for (const c of z.corridors) for (const s of c.segs) { g.fillStyle = c.lock && !S.zoneKeys.has(c.lock) ? '#5a3a22' : '#2a3142'; g.fillRect(X(s.x0), Z(s.z0), (s.x1 - s.x0) * k, (s.z1 - s.z0) * k); }
    for (const r of z.rooms) { g.fillStyle = ZVISIT.has(r.id) ? '#5a5f6e' : '#1d222e'; g.fillRect(X(r.x0), Z(r.z0), r.w * k, r.h * k); }
    for (const o of S.objs) { if (o.done && (o.kind === 'key' || o.kind === 'chest' || o.kind === 'whisper')) continue; g.fillStyle = { lantern: '#6fd18a', gate: '#ff5a2a', chest: o.unique ? '#ec7a3a' : '#e3b964', key: '#ffe7a6', whisper: '#b9c8ff', side: S[o.need] ? '#9a7cff' : '#5a3a22', npc: '#e3b964', deco: '#3a3330' }[o.kind]; g.beginPath(); g.arc(X(o.x), Z(o.z), o.kind === 'gate' ? 4 : 2.5, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(X(S.player.x), Z(S.player.z), 3, 0, Math.PI * 2); g.fill();
  }
  function zoneObjective(id) { const a = window.HSWorld.area(id); const q = HS.D.quests.find((x) => x.area === (a ? a.id : id)); return q ? `${q.n}: ${q.steps.join(' · ')}` : a && a.d ? a.d : t('gateHint'); }
  // šepot: karta s textem a mluvčím (G.WHISPERS), sbírá se do save
  let whisperT = 0;
  function showWhisper(id) {
    const w = HS.D.whispers.find((x) => x.id === id); if (!w) return;
    if (!SAVE.whispers.includes(id)) { SAVE.whispers.push(id); persist(); }
    const el = document.getElementById('whisper'); el.querySelector('.wn').textContent = `${t('whisperT')} ${SAVE.whispers.length}/${HS.D.whispers.length} · ${w.n}`; el.querySelector('.wt').textContent = `„${w.txt}“`; el.querySelector('.ww').textContent = '— ' + w.who; el.hidden = false;
    clearTimeout(whisperT); whisperT = setTimeout(() => { el.hidden = true; }, 9000); tone(330, 495, 1.2, 0.12, 'sine');
  }
  /* ---------- dialogy questů (G.DIALOGS): scény podle HSWorld.STORY, volby a flagy do save ---------- */
  // Hráč nemluví; Ysolde (hlas v hlavě) kurzívou. Rozhovor zastaví hru, barky běží jako titulky bez pauzy
  // (délka repliky jako u VO: slova / 2,5 + 0,5 s). Viděné scény se nepřehrávají znovu.
  const story = () => { if (!SAVE.story || typeof SAVE.story !== 'object') SAVE.story = {}; const st = SAVE.story; st.seen = Array.isArray(st.seen) ? st.seen : []; st.flags = st.flags && typeof st.flags === 'object' ? st.flags : {}; st.choices = st.choices && typeof st.choices === 'object' ? st.choices : {}; return st; };
  const sceneKey = (sc) => sc.q + '/' + sc.at;
  const speaker = (id) => { const n = HS.D.npcs.find((x) => x.id === id); return n ? n.n : id; };
  function scenesFor(on, o) { o = o || {}; const step = S && S.zone ? S.zone.id : null; return window.HSWorld.STORY.filter((sc) => sc.on === on && (!sc.step || sc.step === step) && (!sc.npc || sc.npc === o.npc) && !story().seen.includes(sceneKey(sc))); }
  function playScenes(list, done) { const sc = list.shift(); if (!sc) { if (done) done(); return; } playScene(sc, () => playScenes(list, done)); }
  function playScene(sc, done) {
    const d = (HS.D.dialogs[sc.q] || []).find((x) => x.at === sc.at); if (!d) { done(); return; }
    story().seen.push(sceneKey(sc)); persist();
    if (d.choice) choose(sc, d, done); else if (sc.bark) { bark(d.lines.slice()); done(); } else talk(d.lines.slice(), done);
  }
  let DLG = null, CHAMP = null;
  function talk(lines, done) {
    if (!S || (mode !== 'play' && mode !== 'dialog')) { if (done) done(); return; }
    mode = 'dialog'; lmb = false; for (const k in keys) keys[k] = false; DLG = { lines, done }; dlgShow();
  }
  function dlgShow() {
    const el = document.getElementById('dialog'); let ln = DLG.lines[0];
    while (ln && !Array.isArray(ln)) { if (ln.whisper) showWhisper(ln.whisper); DLG.lines.shift(); ln = DLG.lines[0]; }
    if (!ln) { dlgEnd(); return; }
    el.hidden = false; el.classList.toggle('ysolde', ln[0] === 'np_ysolde'); el.querySelector('.who').textContent = speaker(ln[0]); el.querySelector('.txt').textContent = ln[1]; el.querySelector('.choices').innerHTML = ''; el.querySelector('.hint').textContent = t('dlgHint');
    tone(ln[0] === 'np_ysolde' ? 440 : 220, ln[0] === 'np_ysolde' ? 520 : 240, 0.12, 0.05, 'sine');
  }
  function dlgNext() { if (!DLG || DLG.choice) return; DLG.lines.shift(); dlgShow(); }
  function dlgEnd() { document.getElementById('dialog').hidden = true; const done = DLG && DLG.done; DLG = null; if (mode === 'dialog') { mode = 'play'; acc = 0; } if (done) done(); }
  document.getElementById('dialog').addEventListener('mousedown', (e) => { e.stopPropagation(); if (e.target.closest('.btn')) return; dlgNext(); });
  // volba: tlačítka v dialogu; flag a index volby do save. Souboj se šampionem (q1_03) přeruší repliky volby
  function choose(sc, d, done) {
    if (!S || (mode !== 'play' && mode !== 'dialog')) { done(); return; }
    mode = 'dialog'; DLG = { lines: [], done: null, choice: true };
    const el = document.getElementById('dialog'); el.hidden = false; el.classList.remove('ysolde'); el.querySelector('.who').textContent = sc.at; el.querySelector('.txt').textContent = ''; el.querySelector('.hint').textContent = '';
    const box = el.querySelector('.choices'); box.innerHTML = '';
    d.choice.forEach((ch, i) => { const b = document.createElement('button'); b.className = 'btn'; const toll = sc.q === 'q1_03' && i === 0; b.textContent = ch.c + (toll ? ` (${t('goldHave')} ${S.gold})` : ''); if (toll && S.gold < 500) b.disabled = true; b.id = 'dlg-c' + i; b.onclick = () => pick(i); box.appendChild(b); });
    function pick(i) {
      if (sc.q === 'q1_03' && i === 0) { S.events.length = 0; if (!SIM.invCommand(S, { pay: 500 })) return; handle(S.events.slice()); S.events.length = 0; } // Bible: clo 500 zlatých
      const ch = d.choice[i]; const st = story(); st.choices[sc.q] = i; if (ch.flag) st.flags[ch.flag] = true; persist();
      DLG = null; const lines = ch.lines.slice();
      if (sc.fight === i) { talk(lines.slice(0, 1), () => { CHAMP = lines.slice(1); SIM.champion(S); handle(S.events.slice()); S.events.length = 0; done(); }); return; }
      talk(lines, done);
    }
  }
  // bark: titulky bez pauzy, jedna replika za druhou
  let BARK = [], barkT = 0;
  function bark(lines) { BARK.push(...lines); if (!barkT) barkStep(); }
  function barkStep() {
    const el = document.getElementById('bark'); const ln = BARK.shift(); barkT = 0;
    if (!ln) { el.hidden = true; return; }
    if (!Array.isArray(ln)) { if (ln.whisper) showWhisper(ln.whisper); barkStep(); return; }
    el.innerHTML = ''; const b = document.createElement('b'); b.textContent = speaker(ln[0]) + ': '; el.appendChild(b); el.appendChild(document.createTextNode(ln[1])); el.hidden = false;
    barkT = setTimeout(barkStep, (ln[1].split(/\s+/).length / 2.5 + 0.5) * 1000);
  }
  function clearStory() { BARK = []; clearTimeout(barkT); barkT = 0; document.getElementById('bark').hidden = true; document.getElementById('dialog').hidden = true; DLG = null; CHAMP = null; }
  // v Cinderholdu: koho je třeba navštívit (cíl v HUD)
  function townHint() { const need = S && S.needTalk ? [...S.needTalk] : []; return need.length ? `${t('talkTo')}: ${need.map(speaker).join(', ')}` : t('gateOpen'); }
  // vchod do tajné oblasti: hra se zastaví a nabídne vstup (Gallows Hill z Charcoal Woods)
  function sidePrompt(ev) {
    if (mode !== 'play') return; mode = 'over'; const a = window.HSWorld.area(ev.to);
    screen.innerHTML = `<div class="panel"><h2>${t('sideQ')}: ${a.n}</h2><p>${a.d || ''}</p><div class="row"><button class="btn" id="b-side">${t('sideEnter')}</button><button class="btn dim" id="b-stay">${t('sideStay')}</button></div></div>`;
    document.getElementById('b-side').onclick = () => { saveChar(); saveGear(); start('act1', { zone: ev.to, side: true }); };
    document.getElementById('b-stay').onclick = () => { screen.innerHTML = ''; mode = 'play'; acc = 0; };
  }
  function startCampaign() { const z = (SAVE.act1 && SAVE.act1.zone) || ACT1[0]; if (z === 'a1_kiln_heart') start('boss', { campaign: true }); else start('act1', { zone: z }); }
  function zoneDone(ev) {
    if (S.zone.side) SAVE.gallowsDone = true; // tajná oblast: kampaň zůstává v oblasti, odkud se vešlo
    else SAVE.act1 = { zone: ev.next || ACT1[ACT1.length - 1], done: false, deaths: ((SAVE.act1 && SAVE.act1.deaths) || 0) + ev.deaths };
    saveChar(); saveGear(); persist();
    if (S.zone.town) { setTimeout(() => { if (S && mode === 'play') startCampaign(); }, 400); return; } // z města rovnou dál
    tone(330, 660, 0.6, 0.25, 'triangle');
    setTimeout(() => { if (!S || mode !== 'play') return; mode = 'over'; screen.innerHTML = `<div class="panel"><h2>${t('zoneDone')}: ${zoneName(ev.id)}</h2><table class="res"><tr><td>${t('victoryT')}</td><td class="n">${Math.round(ev.time / 60)} min</td></tr><tr><td>${t('kills')}</td><td class="n">${ev.kills}</td></tr><tr><td>${t('lvl')}</td><td class="n">${S.L}</td></tr></table><p>${S.zone.side ? t('back') : t('nextZone')}: <b>${zoneName(ev.next)}</b></p><div class="row"><button class="btn" id="b-next">${t('continue')}</button><button class="btn dim" id="b-menu">${t('menu')}</button></div></div>`; document.getElementById('b-next').onclick = startCampaign; document.getElementById('b-menu').onclick = menu; }, 900);
  }
  function victory(ev) {
    if (S.campaign) SAVE.act1 = { zone: 'a1_kiln_heart', done: true, deaths: (SAVE.act1 && SAVE.act1.deaths) || 0 };
    slowmo = 4; SAVE.bossKills = (SAVE.bossKills || 0) + 1; SAVE.bossBest = SAVE.bossBest ? Math.min(SAVE.bossBest, Math.round(ev.time)) : Math.round(ev.time); saveChar(); persist();
    document.getElementById('bossbar').hidden = true; tone(196, 392, 1.2, 0.3, 'triangle'); tone(294, 587, 1.4, 0.2, 'sine');
    setTimeout(() => { if (!S || !S.won || mode !== 'play') return; mode = 'over'; screen.innerHTML = `<div class="panel"><h2>${S.campaign ? t('act1Done') : t('victory')}</h2><table class="res"><tr><td>${t('victoryT')}</td><td class="n">${Math.round(ev.time)} s</td></tr><tr><td>${t('kills')}</td><td class="n">${S.kills}</td></tr><tr><td>${t('bossKills')}</td><td class="n">${SAVE.bossKills}</td></tr></table><p class="muted">${t('lootHint')}</p><div class="row"><button class="btn" id="b-collect">${t('collect')}</button><button class="btn dim" id="b-feel">${t('feel')}</button><button class="btn dim" id="b-menu">${t('menu')}</button></div></div>`; document.getElementById('b-collect').onclick = () => { screen.innerHTML = ''; mode = 'play'; acc = 0; }; document.getElementById('b-feel').onclick = feelForm; document.getElementById('b-menu').onclick = menu; }, 4200);
  }
  const fxLayer = document.getElementById('fx'); const NUMS = [];
  function num(x, z, text, cls, h) {
    const d = document.createElement('div'); d.className = 'dmg ' + (cls || ''); d.textContent = text; fxLayer.appendChild(d);
    NUMS.push({ d, x: x + (Math.random() - 0.5) * 0.6, z, y: h || 2, t: 0 });
  }
  function handle(evs) {
    for (const ev of evs) {
      switch (ev.t) {
        case 'hit': lastFight = renderT; num(ev.x, ev.z, ev.dmg, (ev.crit ? 'crit ' : '') + (ev.type === 'fire' ? 'fire' : '')); SFX.hit(ev.crit); break;
        case 'burn': num(ev.x, ev.z, ev.dmg, 'fire', 1.6); break;
        case 'miss': num(ev.x, ev.z, t('miss'), 'info'); break;
        case 'swing': { const e = flat(meshFor('swing', 0.6, ev.r, ev.w), M.swing, ev.x, ev.z, ev.face, 1, 0.6); fx(e, 0.14, (f, k) => f.e.setLocalScale(0.85 + k * 0.2, 1, 0.85 + k * 0.2)); SFX.swing(); break; }
        case 'slam': { const e = flat(meshFor('ringS', 0.75, 1, 360), M.slam, ev.x, ev.z, 0, 0.5, 0.05); fx(e, 0.35, (f, k) => f.e.setLocalScale(ev.r * (0.3 + k), 1, ev.r * (0.3 + k))); SFX.slam(); break; }
        case 'cast': if (ev.skill === 'ak_charge') { const g = ent('capsule', M.ghost, [ev.x, 0.9, ev.z], [0.9, 0.9, 0.9], null, false); fx(g, 0.35, () => {}); } break;
        case 'dodge': { const g = ent('capsule', M.ghost, [ev.x, 0.9, ev.z], [0.9, 0.9, 0.9], null, false); fx(g, 0.25, () => {}); SFX.dodge(); break; }
        case 'tele': teleVisual(ev); SFX.tele(); break;
        case 'hitstop': hitstop = Math.min(120, Math.max(hitstop, ev.ms)); break;
        case 'shake': shake = Math.max(shake, ev.amp); break;
        case 'hurt': lastFight = renderT; num(ev.x, ev.z, '-' + ev.dmg, ev.type === 'fire' ? 'hurt fire' : 'hurt', 2.4); SFX.hurt(); break;
        case 'evade': num(ev.x, ev.z, t('evade'), 'info', 2.4); break;
        case 'dodged': num(ev.x, ev.z, t('dodged'), 'info', 2.4); break;
        case 'nores': flashSkill(ev.skill); break;
        case 'death': if (S.zone && S.kills >= 5) { const sc = scenesFor('kills'); if (sc.length) playScenes(sc); }
        { const v = EV.get(ev.id); if (v) { v.dying = 0.001; if (v.c) { charMat(v.c, null); charClip(v.c, 'death', 1, 0.08); } } SFX.death(); break; }
        case 'over': music('none'); sting('AU_mus_sting_2'); gameOver(); break;
        case 'boss': document.getElementById('bossbar').hidden = false; document.getElementById('boss-n').textContent = ev.n; break;
        case 'phase': if (window.HSMusic) HSMusic.phase(ev.phase); num(S.player.x, S.player.z, t('phaseN')[ev.phase], 'lvl', 3); toast(t('phaseN')[ev.phase]); shake = Math.max(shake, 0.5); tone(110, 55, 0.9, 0.6, 'sawtooth'); break;
        case 'enrage': toast(t('enraged')); tone(90, 60, 1.2, 0.6, 'sawtooth'); break;
        case 'immune': num(ev.x, ev.z, t('immune'), 'info', 3.4); break;
        case 'quenched': toast(t('quenchedT')); noise(0.8, 2000, 200, 0.4, 'highpass'); break;
        case 'quench': if (ev.safe) num(S.player.x, S.player.z, t('safeT'), 'info', 2.6); break;
        case 'qslam': qslamVisual(ev); break;
        case 'breath': case 'kilnfire': { const e = flat(meshFor('cone' + ev.w, 0, 1, ev.w), M.swing, ev.x, ev.z, ev.face, ev.r, 0.05); fx(e, ev.dur || 0.5, (f, k) => f.e.setLocalScale(ev.r * (0.3 + 0.7 * Math.min(1, k * 3)), 1, ev.r * (0.3 + 0.7 * Math.min(1, k * 3)))); noise(ev.dur || 0.5, 600, 200, 0.3, 'lowpass'); break; }
        case 'zone': toast(`${zoneName(ev.id)} · ${t('zoneLv')} ${S.zone.lv[0]}–${S.zone.lv[1]}`); break;
        case 'whisper': showWhisper(ev.wh); break;
        case 'side': sidePrompt(ev); break;
        case 'sidelocked': toast(t('sideLocked')); break;
        case 'gallowskey': SAVE.gallowsKey = true; persist(); toast(t('gallowsKey')); if (!sting('AU_mus_sting_3')) tone(392, 588, 0.8, 0.2, 'triangle'); break;
        case 'quest': SAVE.gold = S.gold; toast(`${t('questDone')}: ${ev.n} · +${ev.xp} XP${ev.gold ? ' · +' + ev.gold + ' ' + t('goldN') : ''}${ev.item ? ' · ' + HS.describe(ev.item).name : ''}`); saveChar(); saveGear(); break;
        case 'lantern': toast(t('lanternLit')); tone(523, 784, 0.5, 0.2, 'sine'); break;
        case 'key': toast(t('keyFound')); tone(880, 1320, 0.25, 0.15, 'triangle'); break;
        case 'chest': noise(0.3, 1200, 400, 0.3); break;
        case 'respawn': toast(t('respawned')); break;
        case 'zonedone': zoneDone(ev); break;
        case 'victory': music('none'); sting('AU_mus_sting_8'); if (S.campaign) { SAVE.act1 = { zone: 'a1_kiln_heart', done: true, deaths: (SAVE.act1 && SAVE.act1.deaths) || 0 }; persist(); setTimeout(() => playScenes(scenesFor('victory'), () => victory(ev)), 1500); } else victory(ev); break;
        case 'npc': { const sc = scenesFor('npc', { npc: ev.npc }); const forge = ev.npc === 'np_brannoc' && S.progress; if (sc.length) playScenes(sc, () => { document.getElementById('hint').textContent = townHint(); if (forge) setTimeout(openForge, 200); }); else if (forge) setTimeout(openForge, 100); else toast(speaker(ev.npc) + ' · ' + ((HS.D.npcs.find((x) => x.id === ev.npc) || {}).role || '')); document.getElementById('hint').textContent = townHint(); break; }
        case 'coins': break;
        case 'currency': num(ev.x, ev.z, '+' + ev.n + ' ' + t(ev.cur), 'lvl', 1.6); tone(660, 990, 0.1, 0.06, 'triangle'); SAVE.cur = Object.assign({}, S.cur); break;
        case 'craft': SAVE.gold = S.gold; SAVE.cur = Object.assign({}, S.cur); saveGear(); tone(ev.op === 'cr_salvage' ? 220 : 330, ev.op === 'cr_salvage' ? 110 : 660, 0.35, 0.2, 'square'); noise(0.25, 1800, 600, 0.25, 'bandpass'); break;
        case 'craftfail': toast(t('forgeFail')[ev.why] || ev.why); break;
        case 'gold': num(ev.x, ev.z, '+' + ev.n + ' ' + t('goldN'), 'lvl', 1.6); tone(988, 1318, 0.08, 0.06, 'square'); SAVE.gold = S.gold; break;
        case 'sell': toast(`${t('sold')}: ${HS.describe(ev.item).name} · +${ev.gold} ${t('goldN')}`); SAVE.gold = S.gold; saveGear(); break;
        case 'pay': toast(`${t('paid')}: ${ev.gold} ${t('goldN')}`); SAVE.gold = S.gold; persist(); break;
        case 'passive': case 'respec': SAVE.gold = S.gold; saveChar(); break;
        case 'gatelocked': toast(`${t('gateLocked')}: ${ev.need.map(speaker).join(', ')}`); break;
        case 'champion': if (CHAMP && CHAMP.length) { const l = CHAMP; CHAMP = null; setTimeout(() => talk(l, null), 900); } break;
        case 'leap': noise(0.18, 300, 900, 0.25); break;
        case 'ecast': { const e = flat(meshFor('ringS', 0.75, 1, 360), ev.kind === 'ward' ? M_WARD : M.slam, ev.x, ev.z, 0, 1.4, 0.05); fx(e, ev.dur, (f, k) => f.e.setLocalScale(1.4 - k * 0.6, 1, 1.4 - k * 0.6)); tone(ev.kind === 'ward' ? 440 : 196, ev.kind === 'ward' ? 660 : 98, ev.dur, 0.12, 'sine'); break; }
        case 'interrupt': num(ev.x, ev.z, t('interruptT'), 'info', 2.6); tone(700, 300, 0.15, 0.2, 'square'); break;
        case 'summon': { const e = flat(meshFor('ringS', 0.75, 1, 360), M.slam, ev.x, ev.z, 0, 0.5, 0.05); fx(e, 0.5, (f, k) => f.e.setLocalScale(1 + k * 2.5, 1, 1 + k * 2.5)); noise(0.5, 300, 80, 0.3, 'lowpass'); break; }
        case 'ward': num(ev.x, ev.z, t('wardT'), 'info', 2.4); break;
        case 'wardbreak': noise(0.2, 2400, 800, 0.2, 'highpass'); break;
        case 'shoot': noise(0.12, ev.fire ? 900 : 2600, ev.fire ? 300 : 1200, 0.18, 'bandpass'); break;
        case 'drop': if (ev.rar === 'unique' && sting('AU_mus_sting_3')) break; tone(ev.rar === 'unique' ? 660 : ev.rar === 'rare' ? 520 : 380, 760, 0.18, ev.rar === 'common' ? 0.05 : 0.12, 'triangle'); break;
        case 'pickup': { const d = HS.describe(ev.item); num(S.player.x, S.player.z, t('picked') + ': ' + d.name, 'info r-' + d.rar, 2.6); SAVE.items = (SAVE.items || 0) + 1; saveGear(); break; }
        case 'equip': case 'unequip': case 'discard': saveGear(); break;
        case 'cantequip': toast(ev.why in T[LANG].why ? t('why')[ev.why] : `${t('whyAttr')} ${String(ev.why).toUpperCase()}`); break;
        case 'invfull': toast(t('invFull')); break;
        case 'levelup': num(S.player.x, S.player.z, t('lvlUp') + ' ' + ev.level, 'lvl', 3); if (!sting('AU_mus_sting_1')) { tone(392, 784, 0.5, 0.25, 'triangle'); tone(523, 1046, 0.6, 0.18, 'sine'); } saveChar(); break;
        case 'unlock': toast(t('unlocked') + ': ' + t({ ak_brand: 'brand', ak_charge: 'charge', ak_slam: 'slam', ak_bulwark: 'bulwark', ak_warcry: 'warcry' }[ev.skill] || 'cleave')); break;
        case 'locked': flashSkill(ev.skill, t('locked') + ' ' + ev.req); break;
        case 'alloc': saveChar(); break;
        case 'wave': saveChar(); break;
        case 'brand': num(ev.x, ev.z, t('brandTxt'), 'fire', 2.2); break;
        case 'absorb': num(ev.x, ev.z, t('absorbTxt') + ' −' + ev.amt, 'info', 2.2); break;
        case 'bulwark': { const g = ent('sphere', M.ghost, [ev.x, 1, ev.z], [2.2, 2.4, 2.2], null, false); fx(g, 0.45, (f, k) => f.e.setLocalScale(2.2 + k * 0.6, 2.4 + k * 0.6, 2.2 + k * 0.6)); tone(220, 140, 0.4, 0.3, 'sine'); break; }
        case 'warcry': { const e = flat(meshFor('ringS', 0.75, 1, 360), M.slam, ev.x, ev.z, 0, 0.5, 0.06); fx(e, 0.45, (f, k) => f.e.setLocalScale(ev.r * (0.2 + k), 1, ev.r * (0.2 + k))); tone(140, 90, 0.5, 0.6, 'sawtooth'); noise(0.4, 400, 120, 0.4, 'lowpass'); break; }
        default: break;
      }
    }
  }

  /* ---------- loot na zemi, inventář a tooltip (P1) ---------- */
  const RCOL = { common: '#c9c2b2', magic: '#6f9ff0', rare: '#ecc65a', unique: '#ec7a3a' };
  const RMAT = {}; for (const r in RCOL) RMAT[r] = mat(RCOL[r], { unlit: true });
  const BEAM = {}; for (const r in RCOL) BEAM[r] = mat(RCOL[r], { unlit: true, opacity: 0.35, add: true });
  const dropsLayer = document.getElementById('drops'); const DV = new Map();
  function saveGear() { if (!S) return; SAVE.gear = JSON.parse(JSON.stringify(S.gear)); SAVE.sinceU = S.sinceU; persist(); }
  function saveChar() { if (!S || !S.progress) return; SAVE.char = JSON.parse(JSON.stringify(S.char)); persist(); }
  let toastT = 0; function toast(msg) { const el = document.getElementById('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 1800); }
  function syncDrops() {
    const live = new Set();
    for (const d of S.drops) {
      live.add(d.id); let v = DV.get(d.id);
      if (!v) {
        const r = d.item.rar; const root = new pc.Entity(); root.setLocalPosition(d.x, 0, d.z); app.root.addChild(root);
        const box = ent('box', RMAT[r], [0, 0.12, 0], [0.42, 0.14, 0.24], root, false); box.setLocalEulerAngles(0, (d.id * 47) % 180, 0);
        if (r !== 'common') ent('cylinder', BEAM[r], [0, 1.4, 0], [0.07, 2.8, 0.07], root, false);
        const el = document.createElement('div'); const ds = HS.describe(d.item); el.className = 'drop r-' + r; el.textContent = ds.name;
        el.addEventListener('mousedown', (e) => { e.stopPropagation(); if (mode !== 'play') return; pend.pickup = d.id; fresh = true; });
        dropsLayer.appendChild(el); v = { root, el, x: d.x, z: d.z }; DV.set(d.id, v);
      }
      cam.camera.worldToScreen(new pc.Vec3(v.x, 0.55, v.z), tmpV); v.el.style.transform = `translate(${tmpV.x.toFixed(0)}px, ${tmpV.y.toFixed(0)}px) translate(-50%, -100%)`;
    }
    for (const [id, v] of DV) if (!live.has(id)) { v.root.destroy(); v.el.remove(); DV.delete(id); }
  }
  // šípy (P1: Charred Bowman): tenké hranoly ve směru letu, ohnivý šíp žhne
  const PV = new Map();
  function syncProj() {
    const live = new Set();
    for (const pr of S.proj || []) {
      live.add(pr.id); let e = PV.get(pr.id);
      if (!e) { e = pr.orb ? ent('sphere', M_ORB, [pr.x, 1.2, pr.z], [0.42, 0.42, 0.42], null, false) : ent('box', pr.fire ? M.furnace : M.blade, [pr.x, 1.2, pr.z], [0.75, 0.06, 0.06], null, false); e.setLocalEulerAngles(0, (-Math.atan2(pr.dz, pr.dx) * 180) / Math.PI, 0); PV.set(pr.id, e); }
      e.setLocalPosition(pr.x, 1.2, pr.z);
    }
    for (const [id, e] of PV) if (!live.has(id)) { e.destroy(); PV.delete(id); }
  }
  // gold na zemi: zlatá mince, sebere se průchodem
  const CV = new Map();
  function syncCoins() {
    const live = new Set();
    for (const c of S.coins || []) { live.add(c.id); if (!CV.has(c.id)) { const e = ent(c.cur ? 'box' : 'cylinder', c.cur === 'ember' ? M_EMBER : c.cur ? M_DUST : M_COIN, [c.x, 0.12, c.z], c.cur ? [0.22, 0.22, 0.22] : [0.36, 0.06, 0.36], null, false); CV.set(c.id, e); } CV.get(c.id).setLocalEulerAngles(0, renderT * 120, 0); }
    for (const [id, e] of CV) if (!live.has(id)) { e.destroy(); CV.delete(id); }
  }
  const M_COIN = mat('#f2c14e', { unlit: true }), M_EMBER = mat('#ff8a3a', { unlit: true }), M_DUST = mat('#cfd6e6', { unlit: true });
  function clearDrops() { for (const e of CV.values()) e.destroy(); CV.clear(); for (const e of PV.values()) e.destroy(); PV.clear(); for (const v of DV.values()) { v.root.destroy(); v.el.remove(); } DV.clear(); }

  // statistiky postavy pro panel a porovnání: HP, armor (redukce), evade, Cleave DPS proti thrallovi, APS, pohyb
  function charSummary(ch) {
    const sk = HS.skill('ak_cleave'); const h = HS.computeHit(sk, HS.F.maxSkillLevel(S.L, sk.req), ch, HS.refEnemy(S.L, 'en_thrall'));
    return { hp: ch.S.hp, armor: ch.S.armor, dr: ch.S.dr, evade: ch.S.evade, fireRes: ch.S.resist.fire.eff, dps: h.dps, aps: ch.weapon.aps * (1 + ch.S.asInc), ms: ch.S.ms };
  }
  function hypothetical(item) {
    const eq = Object.assign({}, S.gear.eq); const slot = SIM.slotFor(S, item); const b = HS.get(item.base);
    eq[slot] = item; if (slot === 'main' && b.hand === '2h') delete eq.off;
    return HS.calcChar(S.L, SIM.EQ_SLOTS.map((k) => eq[k]).filter(Boolean));
  }
  const pctS = (v) => (v * 100).toFixed(1).replace('.', ',') + ' %';
  const STAT_ROWS = [['stHp', 'hp', (v) => Math.round(v)], ['stArmor', 'dr', pctS], ['stEva', 'evade', pctS], ['stFire', 'fireRes', (v) => v + ' %'], ['stDps', 'dps', (v) => v.toFixed(1).replace('.', ',')], ['stAs', 'aps', (v) => v.toFixed(2).replace('.', ',')], ['stMs', 'ms', (v) => Math.round(v * 100) + ' %']];
  function tipHtml(item, equippedSlot) {
    const d = HS.describe(item); const why = equippedSlot ? null : SIM.canEquip(S, item);
    const slotN = (HS.D.loot.slots.find((x) => x.id === d.slot) || {}).n || d.slot;
    let h = `<h3 class="r-${d.rar}">${d.name}</h3><span class="base">${t('rar')[d.rar] || d.rar} · ${d.base} · ${slotN}${d.hand ? ' · ' + d.hand.toUpperCase() : ''} · T${d.tier + 1}</span>`;
    for (const l of d.lines) h += `<span class="${l[0]}">${l[1]}</span>`;
    const req = Object.entries(d.req).map(([k, v]) => { const have = k === 'level' ? S.L : S.ch.A[k] || 0; return `<span class="${have < v ? 'bad' : ''}">${k === 'level' ? t('lvl') : k.toUpperCase()} ${v}</span>`; }).join(' · ');
    h += `<span class="req">${t('reqs')}: ${req}</span>`;
    if (why) h += `<span class="bad">${why in T[LANG].why ? t('why')[why] : t('whyAttr') + ' ' + why.toUpperCase()}</span>`;
    if (!equippedSlot && !why) {
      const a = charSummary(S.ch), b = charSummary(hypothetical(item));
      h += `<div class="cmp"><span class="muted">${t('cmp')}</span><span></span>` + STAT_ROWS.map(([k, f, fm]) => { const dlt = b[f] - a[f]; const cls = Math.abs(dlt) < 1e-6 ? '' : dlt > 0 ? 'up' : 'down'; return `<span>${t(k)}</span><b class="${cls}">${fm(b[f])}${cls ? (dlt > 0 ? ' ▲' : ' ▼') : ''}</b>`; }).join('') + '</div>';
    }
    return h;
  }
  function showTip(e, html) { const tip = document.getElementById('tip'); tip.innerHTML = html; tip.hidden = false; const w = 300; const x = Math.min(innerWidth - w - 12, e.clientX + 16); const y = Math.min(innerHeight - tip.offsetHeight - 12, e.clientY + 12); tip.style.left = x + 'px'; tip.style.top = Math.max(8, y) + 'px'; }
  function hideTip() { document.getElementById('tip').hidden = true; }
  function cellHtml(item, kind, key, slotLabel) {
    if (!item) return `<div class="cell" data-k="${kind}" data-i="${key}">${slotLabel ? `<span class="sl">${slotLabel}</span>` : ''}<span class="muted">${slotLabel ? '' : ''}</span></div>`;
    const d = HS.describe(item); const no = kind === 'inv' && SIM.canEquip(S, item) ? ' no' : '';
    return `<div class="cell has r-${d.rar}${no}" data-k="${kind}" data-i="${key}">${slotLabel ? `<span class="sl">${slotLabel}</span>` : ''}<span>${(d.cat || d.base).slice(0, 7)}<br>T${d.tier + 1}</span></div>`;
  }
  function renderInv() {
    const el = document.getElementById('inv'); const g = S.gear; const sm = charSummary(S.ch);
    const slotN = (k) => { const id = k.replace(/[12]$/, ''); return ((HS.D.loot.slots.find((x) => x.id === id) || {}).n || id).replace(' ×2', '') + (k.endsWith('2') ? ' 2' : k.endsWith('1') ? ' 1' : ''); };
    el.innerHTML = `<div class="box"><div class="head"><h2>${t('inv')}</h2><button class="btn dim" id="b-inv-close" aria-label="✕">✕</button></div><span class="muted">${t('invHint')}${S.zone && S.zone.town ? ' ' + t('sellHint') : ''}</span> <b class="gold" style="color:var(--gold)">${S.gold} ${t('goldN')}</b>
      <div class="cols"><div><div class="eq">${SIM.EQ_SLOTS.map((k) => cellHtml(g.eq[k], 'eq', k, slotN(k))).join('')}</div>
      <div class="stats"><span class="muted">${t('invStats')} · L${S.L}</span><span></span>${STAT_ROWS.map(([k, f, fm]) => `<span>${t(k)}</span><b>${fm(sm[f])}</b>`).join('')}</div>
      <div class="attrs"><span class="muted">${t('attrs')} · ${t('points')}: <b>${S.char.points}</b></span><span></span><span></span>${SIM.ATTRS.map((k) => `<span>${t('attrN')[k]}</span><b>${S.ch.A[k]}</b><button data-attr="${k}" ${S.char.points && S.progress ? '' : 'disabled'} aria-label="+1 ${k}">+</button>`).join('')}</div>
      ${S.char.points && S.progress ? `<button class="btn dim" id="b-auto" style="margin-top:8px;font-size:13px;padding:6px 10px">${t('autoAlloc')}</button>` : ''}</div>
      <div><div class="grid">${Array.from({ length: SIM.INV_MAX }, (_, i) => cellHtml(g.inv[i], 'inv', i)).join('')}</div><p class="muted">${g.inv.length} / ${SIM.INV_MAX}</p>${S.progress ? passivesHtml() : ''}</div></div></div>`;
    document.getElementById('b-inv-close').onclick = closeInv;
    const cmd = (c) => { S.events.length = 0; SIM.invCommand(S, c); handle(S.events.slice()); S.events.length = 0; renderInv(); };
    for (const b of el.querySelectorAll('[data-attr]')) b.onclick = () => cmd({ alloc: b.dataset.attr });
    const ba = document.getElementById('b-auto'); if (ba) ba.onclick = () => cmd({ autoAlloc: true });
    for (const b of el.querySelectorAll('[data-passive]')) b.onclick = () => cmd({ passive: b.dataset.passive });
    const br = document.getElementById('b-respec'); if (br) br.onclick = () => cmd({ respecPassives: true });
    for (const c of el.querySelectorAll('.cell.has')) {
      const kind = c.dataset.k, key = c.dataset.i; const item = kind === 'inv' ? g.inv[+key] : g.eq[key];
      c.onmouseenter = (e) => showTip(e, tipHtml(item, kind === 'eq' ? key : null)); c.onmousemove = (e) => showTip(e, tipHtml(item, kind === 'eq' ? key : null)); c.onmouseleave = hideTip;
      c.onclick = (e) => { hideTip(); S.events.length = 0; if (kind === 'inv') SIM.invCommand(S, e.shiftKey ? (S.zone && S.zone.town ? { sell: +key } : { discard: +key }) : { equip: +key }); else SIM.invCommand(S, { unequip: key }); handle(S.events.slice()); S.events.length = 0; renderInv(); };
    }
  }
  // pasivní dovednosti Ash Knighta (Bible): rank / max, od levelu, popis; body D04, respec D13
  function passivesHtml() {
    const c = S.char; const spent = SIM.passiveSpent(c); const left = HS.F.passivePoints(S.L) - spent; const cost = HS.F.respecPoint(S.L) * spent;
    return `<div class="passives"><span class="muted">${t('passivesT')} · ${t('passPts')}: <b>${left}</b></span><span></span><span></span>${HS.D.passives.map((p) => { const r = c.passives[p.id] || 0; const ok = left > 0 && r < p.mx && p.req <= S.L; return `<span class="${p.req > S.L ? 'locked' : ''}">${p.n}${p.req > S.L ? ` (${t('reqL')} ${p.req})` : ''}</span><b>${r}/${p.mx}</b><button data-passive="${p.id}" ${ok ? '' : 'disabled'} aria-label="+1 ${p.n}">+</button><span class="pd">${p.d}</span>`; }).join('')}</div>${spent ? `<button class="btn dim" id="b-respec" style="margin-top:6px;font-size:13px;padding:6px 10px" ${S.gold < cost ? 'disabled' : ''}>${t('respecT')} · ${cost ? cost + ' ' + t('goldN') : t('respecFree')}</button>` : ''}`;
  }
  /* ---------- kovárna Brannoc: G.CRAFT (Salvage, Reforge, Imbue, Temper, Unravel) ---------- */
  let FORGE = null; // vybraný předmět { kind: 'eq' | 'inv', key }
  const slotLabel = (k) => { const id = k.replace(/[12]$/, ''); return ((HS.D.loot.slots.find((x) => x.id === id) || {}).n || id).replace(' ×2', '') + (k.endsWith('2') ? ' 2' : k.endsWith('1') ? ' 1' : ''); };
  const fmtCost = (c) => Object.entries(c || {}).filter(([, v]) => v).map(([k, v]) => `${v} ${k === 'gold' ? t('goldN') : t(k)}`).join(' + ') || '—';
  function openForge() { if (mode !== 'play' || !S || !S.zone || !S.zone.town) return; mode = 'forge'; lmb = false; FORGE = null; document.getElementById('inv').hidden = false; renderForge(); }
  function closeForge() { if (mode !== 'forge') return; hideTip(); document.getElementById('inv').hidden = true; mode = 'play'; acc = 0; FORGE = null; }
  function renderForge(result) {
    const el = document.getElementById('inv'); const g = S.gear; const cur = S.cur;
    const item = FORGE ? (FORGE.kind === 'eq' ? g.eq[FORGE.key] : g.inv[FORGE.key]) : null;
    const sel = (kind, key) => (FORGE && FORGE.kind === kind && String(FORGE.key) === String(key) ? ' sel' : '');
    const cells = (kind, keys, get, lab) => keys.map((k) => { const h = cellHtml(get(k), kind, k, lab ? lab(k) : undefined); return sel(kind, k) ? h.replace('class="cell', 'class="cell sel') : h; }).join('');
    const ops = HS.D.craft.map((op) => {
      const bad = item ? SIM.craftCheck(S, op.id, item) || (op.id === 'cr_salvage' && FORGE.kind === 'eq' ? 'equipped' : null) : 'item'; const cost = item && !bad ? SIM.craftCost(S, op.id, item) : null;
      const afford = cost && Object.entries(cost).every(([k, v]) => (k === 'gold' ? S.gold : cur[k] || 0) >= v);
      return `<div class="op"><b>${op.n}</b><button class="btn dim" data-op="${op.id}" ${!bad && afford ? '' : 'disabled'}>${cost && Object.keys(cost).length ? fmtCost(cost) : op.cost}</button><span class="why">${op.cond} → ${op.res}${op.risk ? ' · ' + op.risk : ''}${bad && item && bad !== 'item' ? ' · <b>' + (t('forgeFail')[bad] || bad) + '</b>' : ''}</span></div>`;
    }).join('');
    el.innerHTML = `<div class="box"><div class="head"><h2>${t('forgeT')}</h2><button class="btn dim" id="b-forge-close" aria-label="✕">✕</button></div><span class="muted">${t('forgeHint')}</span>
      <div class="cur"><span style="color:var(--gold)">${S.gold} ${t('goldN')}</span><span class="em">${cur.ember || 0} ${t('ember')}</span><span class="du">${cur.dust || 0} ${t('dust')}</span><span class="su">${cur.sunmote || 0} ${t('sunmote')}</span></div>
      <div class="cols"><div><div class="eq">${cells('eq', SIM.EQ_SLOTS, (k) => g.eq[k], slotLabel)}</div><div class="grid" style="grid-template-columns:repeat(5,1fr);margin-top:10px">${cells('inv', Array.from({ length: Math.max(10, g.inv.length) }, (_, i) => i), (i) => g.inv[i])}</div></div>
      <div style="display:grid;gap:12px"><div class="forge-tip">${item ? tipHtml(item) : `<span class="muted">${t('forgeSel')}</span>`}</div>${result ? `<div class="muted">${result}</div>` : ''}<div class="forge-ops">${ops}</div></div></div></div>`;
    document.getElementById('b-forge-close').onclick = closeForge;
    for (const c of el.querySelectorAll('.cell.has')) c.onclick = () => { FORGE = { kind: c.dataset.k, key: c.dataset.k === 'inv' ? +c.dataset.i : c.dataset.i }; renderForge(); };
    for (const b of el.querySelectorAll('[data-op]')) b.onclick = () => {
      const op = b.dataset.op; S.events.length = 0; const ok = SIM.invCommand(S, Object.assign({ craft: op }, FORGE.kind === 'eq' ? { eq: FORGE.key } : { inv: FORGE.key })); const ev = S.events.find((x) => x.t === 'craft'); handle(S.events.slice()); S.events.length = 0;
      let msg = '';
      if (ok && ev && op === 'cr_salvage') { msg = `${t('salvaged')}: ${HS.describe(ev.before).name} → ${fmtCost(ev.gain)}`; FORGE = null; } else if (ok && ev) msg = `${t('forgeDone')}: ${HS.D.craft.find((x) => x.id === op).n} · ${fmtCost(ev.cost)}`;
      renderForge(msg);
    };
  }
  function openInv() { if (mode !== 'play' || !S) return; mode = 'inv'; lmb = false; document.getElementById('inv').hidden = false; renderInv(); }
  function closeInv() { if (mode !== 'inv') return; hideTip(); document.getElementById('inv').hidden = true; mode = 'play'; acc = 0; }
  document.getElementById('b-inv').textContent = t('invBtn'); document.getElementById('b-inv').onclick = () => (mode === 'inv' ? closeInv() : openInv());

  /* ---------- HUD ---------- */
  const SK = [['ak_cleave', 'LMB', 'cleave'], ['ak_slam', 'RMB', 'slam'], ['ak_charge', 'Q', 'charge'], ['ak_brand', 'E', 'brand'], ['ak_bulwark', 'R', 'bulwark'], ['ak_warcry', 'T', 'warcry'], ['dodge', '␣', 'dodge']];
  const skillsEl = document.getElementById('skills');
  skillsEl.innerHTML = SK.map(([id, key, nm]) => `<div class="sk" id="sk-${id}"><span class="key">${key}</span><b>${t(nm)}</b><span class="cost"></span><div class="cd"></div></div>`).join('');
  function flashSkill(id, txt) { const el = document.getElementById('sk-' + id); if (!el) return; el.classList.add('no'); setTimeout(() => el.classList.remove('no'), 250); num(S.player.x, S.player.z, txt || t('nores'), 'info', 2.6); }
  let fpsOn = false;
  function hud() {
    const p = S.player;
    document.getElementById('b-hp').style.width = ((p.hp / p.hpMax) * 100).toFixed(1) + '%'; document.getElementById('t-hp').textContent = Math.ceil(p.hp) + ' / ' + p.hpMax;
    document.getElementById('b-res').style.width = ((p.res / p.resMax) * 100).toFixed(1) + '%'; document.getElementById('t-res').textContent = Math.floor(p.res) + ' Cinders';
    document.getElementById('wave').textContent = mode === 'bench' || S.mode === 'bench' ? 'Benchmark' : S.mode === 'boss' ? 'Heart of the Kiln' : S.zone ? `${zoneName(S.zone.id)} · ${t('zoneLv')} ${S.zone.lv[0]}–${S.zone.lv[1]}` : t('wave') + ' ' + S.wave;
    document.getElementById('kills').textContent = t('kills') + ' ' + S.kills;
    document.getElementById('gold').textContent = S.loot ? `${S.gold} ${t('goldN')}` : '';
    const need = HS.F.xpToNext(S.L); const xpOn = S.progress; document.getElementById('xpbar').hidden = !xpOn;
    if (xpOn) { document.getElementById('b-xp').style.width = ((S.char.xp / need) * 100).toFixed(1) + '%'; document.getElementById('t-xp').textContent = `L${S.L} · ${S.char.xp} / ${need} ${t('xpShort')}${S.char.points ? ' · +' + S.char.points : ''}`; }
    for (const [id] of SK) {
      const el = document.getElementById('sk-' + id); if (!el) continue;
      if (id === 'dodge') { el.querySelector('.cd').style.height = ((p.dodgeCd / SIM.DODGE.cd) * 100).toFixed(0) + '%'; continue; }
      const sl = S.skills[id]; const h = sl.hit.en_thrall; const cdMax = h.cd || 0;
      el.classList.toggle('locked', !sl.on); el.dataset.req = 'L' + sl.sk.req; el.title = sl.on ? '' : t('locked') + ' ' + sl.sk.req;
      el.classList.toggle('on', id === 'ak_bulwark' && p.bulwark > 0);
      el.querySelector('.cd').style.height = cdMax ? ((sl.cd / cdMax) * 100).toFixed(0) + '%' : '0%';
      el.querySelector('.cost').textContent = h.cost > 0 ? h.cost : '+' + -h.cost;
      el.style.opacity = !sl.on ? '' : h.cost > 0 && p.res < h.cost ? 0.55 : 1;
    }
  }

  /* ---------- čas GPU a CPU na snímek (benchmark) a údaje o hardwaru pro testery ---------- */
  // GPU: časovač WebGL2 (EXT_disjoint_timer_query_webgl2) kolem vykreslení snímku; výsledek je k dispozici
  // o pár snímků později. CPU: update + render podle statistik PlayCanvas. Měří se jen během benchmarku.
  const GT = (() => { const gl = app.graphicsDevice.gl; const ext = gl && gl.getExtension && gl.getExtension('EXT_disjoint_timer_query_webgl2'); return { gl, ext, q: [], cur: null, on: false, ms: [] }; })();
  app.on('prerender', () => { if (!GT.on || !GT.ext || GT.cur) return; GT.cur = GT.gl.createQuery(); GT.gl.beginQuery(GT.ext.TIME_ELAPSED_EXT, GT.cur); });
  app.on('postrender', () => {
    const { gl, ext } = GT; if (!ext) return;
    if (GT.cur) { gl.endQuery(ext.TIME_ELAPSED_EXT); GT.q.push(GT.cur); GT.cur = null; }
    while (GT.q.length && gl.getQueryParameter(GT.q[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = GT.q.shift(); const ns = gl.getQueryParameter(q, gl.QUERY_RESULT); gl.deleteQuery(q);
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT) && GT.on) GT.ms.push(ns / 1e6);
    }
  });
  const HW = (() => { let gpu = '?'; try { const gl = app.graphicsDevice.gl; const d = gl.getExtension('WEBGL_debug_renderer_info'); gpu = String(gl.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : gl.RENDERER)); } catch (e) { /* bez údaje */ } return { gpu, threads: navigator.hardwareConcurrency || 0 }; })();

  /* ---------- input latency: vstup → snímek s reakcí (P0: < 50 ms) ---------- */
  // Událost vstupu má časovou značku (stejný základ jako performance.now). Reakce = první krok simulace,
  // po kterém se hráč změní (nová akce, úhyb, cíl pohybu, posun); měří se konec vykreslení toho snímku
  // (frameend) a začátek dalšího snímku (≈ chvíle, kdy je předchozí na obrazovce).
  const LAT = { on: false, need: 20, pend: null, samples: [] };
  // čerstvý vstup spustí krok simulace hned v nejbližším snímku (krok si „půjčí“ čas a další počká,
  // takže tempo zůstává 30 kroků/s a simulace je dál deterministická podle příkazů)
  let fresh = false, steps = 0;
  function latInput(ts) {
    if (!S || mode !== 'play' || LAT.pend) return; const p = S.player;
    // jen vstupy, na které může rytíř hned reagovat (ne během úderu, úhybu, omráčení nebo hit-stopu: ty se záměrně řadí za akci)
    if (p.act || p.dodge || p.stun > 0 || hitstop > 0) return;
    LAT.pend = { t: ts, hit: false, step0: steps, snap: { act: p.act, dodge: p.dodge, moveTo: p.moveTo, x: p.x, z: p.z } };
  }
  function latCheck() {
    const L = LAT.pend; if (!L || L.hit) return; const p = S.player, s0 = L.snap;
    if (p.act !== s0.act || (p.dodge && p.dodge !== s0.dodge) || (p.moveTo && p.moveTo !== s0.moveTo) || Math.hypot(p.x - s0.x, p.z - s0.z) > 0.005) L.hit = true;
    else if (steps - L.step0 >= 2) LAT.pend = null; // dva kroky bez viditelné reakce (např. cooldown): vzorek se nepočítá
  }
  app.on('frameend', () => {
    const L = LAT.pend; if (!L || !L.hit) return; LAT.pend = null; const t1 = performance.now();
    requestAnimationFrame(() => latPush(t1 - L.t, performance.now() - L.t));
  });
  const pct = (a, q) => { const f = a.slice().sort((x, y) => x - y); return f[Math.min(f.length - 1, Math.floor(f.length * q))]; };
  const avgOf = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  function latStats(sm) { const r = sm.map((x) => x[0]), q = sm.map((x) => x[1]); const f = (v) => +v.toFixed(1); return { n: sm.length, renderAvg: f(avgOf(r)), renderP95: f(pct(r, 0.95)), presentAvg: f(avgOf(q)), presentP95: f(pct(q, 0.95)), max: f(Math.max(...q)), at: Date.now() }; }
  function latPush(r, q) {
    LAT.samples.push([r, q]); if (LAT.samples.length > 200) LAT.samples.shift();
    if (!LAT.on) return;
    document.getElementById('hint').textContent = `${t('latHint')} ${LAT.samples.length}/${LAT.need}`;
    if (LAT.samples.length >= LAT.need && mode === 'play') latDone();
  }
  function latDone() {
    const res = latStats(LAT.samples); LAT.on = false; SAVE.latency = res; persist(); window.HSGame.lastLatency = res; mode = 'over';
    const ok = res.presentP95 < 50;
    screen.innerHTML = `<div class="panel"><h2>${t('latDone')}</h2><table class="res"><tr><td></td><td class="n">Ø</td><td class="n">p95</td></tr><tr><td>${t('latRender')}</td><td class="n">${res.renderAvg} ms</td><td class="n">${res.renderP95} ms</td></tr><tr><td>${t('latPresent')}</td><td class="n">${res.presentAvg} ms</td><td class="n">${res.presentP95} ms</td></tr><tr><td>${t('latMax')}</td><td class="n" colspan="2">${res.max} ms</td></tr><tr><td>${t('latN')}</td><td class="n" colspan="2">${res.n}</td></tr></table><p>${t('latTarget')}: <b class="${ok ? 'ok' : 'bad'}">${ok ? t('pass') : t('fail')}</b></p><span class="muted">${t('latNote')}</span><div class="row"><button class="btn" id="b-again">${t('latency')}</button><button class="btn dim" id="b-menu">${t('menu')}</button></div></div>`;
    document.getElementById('b-again').onclick = () => start('latency'); document.getElementById('b-menu').onclick = menu;
  }

  /* ---------- feel test: hodnocení boje 1–5 (P0: průměr ≥ 4 od 5 hráčů) ---------- */
  function feelForm() {
    mode = 'over'; document.getElementById('hud').hidden = true; const pick = [0, 0, 0, 0];
    const list = () => { const F = SAVE.feel; if (!F.length) return ''; const m = (i) => avgOf(F.map((x) => x.a[i])).toFixed(1); return `<p class="muted">${t('feelSaved')}: ${F.length} · ${t('feelAvg')}: ${t('feelQ').map((q, i) => `${q} <b>${m(i)}</b>`).join(' · ')}</p><p class="muted">${t('feelTarget')}</p>`; };
    screen.innerHTML = `<div class="panel feel"><h2>${t('feelTitle')}</h2>${t('feelQ').map((q, i) => `<div class="fq"><span>${q}</span><div class="scale">${[1, 2, 3, 4, 5].map((v) => `<button class="btn dim" data-q="${i}" data-v="${v}">${v}</button>`).join('')}</div></div>`).join('')}<label class="muted" for="f-note">${t('feelNote')}</label><textarea id="f-note" rows="2" maxlength="400"></textarea><p id="f-msg" class="bad" hidden>${t('feelPick')}</p><div id="f-list">${list()}</div><div class="row"><button class="btn" id="b-fsave">${t('feelSave')}</button><button class="btn dim" id="b-fcopy" ${SAVE.feel.length || SAVE.bench || SAVE.latency ? '' : 'disabled'}>${t('feelCopy')}</button><button class="btn dim" id="b-menu">${t('menu')}</button></div></div>`;
    for (const b of screen.querySelectorAll('[data-q]')) b.onclick = () => { const q = +b.dataset.q; pick[q] = +b.dataset.v; for (const o of screen.querySelectorAll(`[data-q="${q}"]`)) o.classList.toggle('on', o === b); };
    document.getElementById('b-fsave').onclick = () => {
      if (pick.some((v) => !v)) { document.getElementById('f-msg').hidden = false; return; }
      SAVE.feel.push({ at: Date.now(), a: pick.slice(), note: document.getElementById('f-note').value.trim().slice(0, 400), wave: SAVE.bestWave }); if (SAVE.feel.length > 50) SAVE.feel.shift(); persist();
      menu();
    };
    document.getElementById('b-fcopy').onclick = () => {
      const B = SAVE.bench, Lt = SAVE.latency;
      const txt = [`HOLLOW SUN P0 · ${HW.gpu} · ${HW.threads} vláken · ${window.screen.width}×${window.screen.height}@${devicePixelRatio}`,
        B ? `benchmark · ${B.avg} FPS · p95 ${B.p95} ms · GPU ${B.gpuMs ? B.gpuMs.avg + ' ms' : '?'} · CPU ${B.cpuMs ? B.cpuMs.avg + ' ms' : '?'} · ${B.res ? B.res.join('×') : ''}` : 'benchmark · nespuštěn',
        Lt ? `vstup · Ø ${Lt.presentAvg} ms · p95 ${Lt.presentP95} ms` : 'vstup · nespuštěn',
        ...SAVE.feel.map((x) => `feel · ${new Date(x.at).toISOString().slice(0, 10)} · ${x.a.join('/')}${x.note ? ' · ' + x.note : ''}`)].join('\n');
      const done = () => { const el = document.getElementById('b-fcopy'); if (el) el.textContent = t('feelCopied'); };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, () => {}); 
    };
    document.getElementById('b-menu').onclick = menu;
  }

  /* ---------- obrazovky ---------- */
  const screen = document.getElementById('screen');
  const keysHtml = () => `<div class="keys"><kbd>${t('keysMove')}</kbd><span>${SAVE.clickMove ? t('keysMoveClick') : t('keysMoveWasd')}</span><kbd>Cleave</kbd><span>${t('keysCleave')}</span><kbd>Slam</kbd><span>${t('keysSlam')}</span><kbd>Charge</kbd><span>${t('keysCharge')}</span><kbd>${t('dodge')}</kbd><span>${t('keysDodge')}</span><kbd>E R T</kbd><span>${t('keysSkills')}</span><kbd>I</kbd><span>${t('keysInv')}</span><kbd>…</kbd><span>${t('keysMisc')}</span></div>`;
  const opt = () => `<label class="opt" for="o-click"><input type="checkbox" id="o-click" ${SAVE.clickMove ? 'checked' : ''}> ${t('clickMove')}</label>`;
  function bindOpt() { const c = document.getElementById('o-click'); if (c) c.addEventListener('change', () => { SAVE.clickMove = c.checked; persist(); }); }
  function menu() {
    if (typeof bossScene === 'function' && BOSS_G) bossScene(false); if (ZONE_G) zoneScene(false); clearStory(); document.getElementById('bossbar').hidden = true;
    mode = 'menu'; document.getElementById('hud').hidden = true; music('menu');
    screen.innerHTML = `<div class="panel"><span class="muted">ECHOES OF THE HOLLOW SUN · ${t('sub')}</span><h1>Hollow Sun</h1><p>${t('pitch')}</p>${keysHtml()}${opt()}
      <div class="row"><button class="btn camp" id="b-camp">${t('campaign')} · ${SAVE.act1 && SAVE.act1.done ? t('act1Done') : SAVE.act1 ? t('campCont') + ': ' + zoneName(SAVE.act1.zone) : t('campNew')}</button><button class="btn" id="b-arena">${t('arena')}</button><button class="btn" id="b-boss" title="${t('bossRec')}">${t('boss')}</button><button class="btn" id="b-bench">${t('bench')}</button><button class="btn dim" id="b-lat">${t('latency')}</button><button class="btn dim" id="b-feel">${t('feel')}</button><button class="btn dim" id="b-assets">${t('assets')}</button><a class="btn dim" href="../../index.html">${t('back')}</a></div>
      <span class="muted">${t('best')}: ${SAVE.bestWave} · ${t('kills')}: ${SAVE.kills}${SAVE.bossKills ? ' · ' + t('bossKills') + ': ' + SAVE.bossKills + ' (' + SAVE.bossBest + ' s)' : ''}${SAVE.bench ? ' · Benchmark: ' + SAVE.bench.avg + ' FPS' : ''}${SAVE.latency ? ' · ' + t('latency') + ': p95 ' + SAVE.latency.presentP95 + ' ms' : ''}</span></div>`;
    document.getElementById('b-camp').onclick = startCampaign; document.getElementById('b-arena').onclick = () => start('arena'); document.getElementById('b-boss').onclick = () => start('boss'); document.getElementById('b-bench').onclick = () => start('bench'); document.getElementById('b-assets').onclick = assetsMode; document.getElementById('b-lat').onclick = () => start('latency'); document.getElementById('b-feel').onclick = feelForm; bindOpt();
  }
  function clearWorld() { clearDrops(); for (const v of EV.values()) v.root.destroy(); EV.clear(); for (const te of TELES) { te.line.destroy(); te.fill.destroy(); } TELES.length = 0; for (const f of FXS) f.e.destroy(); FXS.length = 0; for (const n of NUMS) n.d.remove(); NUMS.length = 0; }
  let bench = null;
  function start(m, o) {
    o = o || {};
    leaveAssets(true); audioInit(); clearWorld(); screen.innerHTML = ''; document.getElementById('hud').hidden = false; acc = 0; hitstop = 0; lmb = false;
    clearStory();
    S = SIM.create({ cur: SAVE.cur || {}, gold: SAVE.gold || 0, zone: o.zone, needTalk: m === 'act1' && window.HSWorld ? window.HSWorld.needTalk(o.zone, story().seen) : [], gallowsKey: !!SAVE.gallowsKey, mode: m === 'bench' ? 'bench' : m === 'boss' ? 'boss' : m === 'act1' ? 'act1' : 'arena', bossKills: SAVE.bossKills || 0, seed: m + '-' + Date.now(), invuln: m === 'bench' || m === 'latency', gear: SAVE.gear || undefined, sinceU: SAVE.sinceU || 0, loot: m === 'arena' || m === 'boss' || m === 'act1', char: m === 'arena' || m === 'boss' || m === 'act1' ? SAVE.char || undefined : undefined, level: m === 'latency' ? HS.D.level : undefined });
    S.campaign = !!o.campaign;
    if (S.progress) saveChar();
    music();
    document.getElementById('bossbar').hidden = !S.boss; bossScene(!!S.boss); zoneScene(!!S.zone); document.getElementById('whisper').hidden = true; slowmo = 0;
    LAT.on = m === 'latency'; LAT.pend = null; if (LAT.on) LAT.samples = [];
    camT.set(S.player.x, 0, S.player.z); mode = m === 'bench' ? 'bench' : 'play';
    document.getElementById('hint').textContent = m === 'bench' ? t('benchRun') : m === 'latency' ? `${t('latHint')} 0/${LAT.need}` : m === 'boss' ? t('bossHint') : m === 'act1' ? (S.zone.town ? townHint() : zoneObjective(S.zone.id)) : t('hint');
    if (m === 'act1' || (m === 'boss' && S.campaign)) { const sc = scenesFor(m === 'boss' ? 'boss' : 'start'); if (sc.length) setTimeout(() => playScenes(sc), 350); }
    bench = m === 'bench' ? { t0: performance.now(), frames: [], cpu: [], simMs: 0, steps: 0, last: performance.now() } : null;
    GT.on = m === 'bench'; GT.ms = [];
  }
  /* ---------- test asset pipeline: GLB z manifestu, LOD podle vzdálenosti, sockety ---------- */
  const AS = { root: null, items: [], lod: 0, lodAuto: true, loaded: 0, error: null, char: null, res: null, clip: null, crowd: [], measure: null, crowdRes: null };
  const CLIPS = ['idle', 'run', 'attack', 'death'];
  // animace z GLB (AN_hero_<akce>) do anim komponenty; útok a smrt se neopakují, po útoku zpět do stání
  function setupAnim(e, res, first, speed) {
    e.addComponent('anim', { activate: true, speed: speed || 1 });
    for (const a of res.animations) { const tr = a.resource; const name = tr.name.replace(/^AN_hero_/, ''); e.anim.assignAnimation(name, tr, undefined, 1, name === 'idle' || name === 'run'); }
    playClip(e, first, 0);
  }
  function playClip(e, name, blend) {
    if (!e.anim || !e.anim.baseLayer) return;
    e.anim.baseLayer.transition(name, blend === undefined ? 0.15 : blend);
    if (e !== AS.char) return;
    AS.clip = name; panel();
  }
  // zátěžový test: 50 postav se skinem a animací (LOD1) v místnosti, 5 s měření snímků
  function crowd() {
    if (!AS.res || AS.measure) return;
    for (const c of AS.crowd) c.destroy(); AS.crowd = [];
    for (let i = 0; i < 50; i++) {
      const e = AS.res.instantiateRenderEntity(); AS.root.addChild(e);
      e.setLocalPosition(-4.05 + (i % 10) * 0.9, 0, -3.6 + Math.floor(i / 10) * 1.5);
      for (let l = 0; l < 3; l++) { const n = e.findByName('CH_ak_body_LOD' + l); if (n) n.enabled = l === 1; }
      setupAnim(e, AS.res, i % 7 === 0 ? 'attack' : 'run', 0.85 + (i % 5) * 0.07); AS.crowd.push(e);
    }
    if (AS.char) AS.char.enabled = false;
    AS.measure = { t0: performance.now(), last: performance.now(), frames: [] }; AS.crowdRes = null; zoom = 20; panel();
  }
  const sockMat = mat('#4fb3b0', { unlit: true });
  // GLB z pipeline jsou komprimované (EXT_meshopt_compression); PlayCanvas je sám nerozbalí,
  // proto buffer view dekóduje meshoptimizer (vendor/meshopt_decoder.js) přes hook parseru.
  const GLB_OPTS = {
    bufferView: {
      processAsync(view, buffers, cb) {
        const m = view.extensions && view.extensions.EXT_meshopt_compression;
        if (!m) { cb(null, null); return; }
        Promise.all([buffers[m.buffer], MeshoptDecoder.ready]).then(([buf]) => {
          const src = new Uint8Array(buf.buffer, buf.byteOffset + (m.byteOffset || 0), m.byteLength);
          return MeshoptDecoder.decodeGltfBufferAsync(m.count, m.byteStride, src, m.mode, m.filter);
        }).then((data) => cb(null, data), (err) => cb(err));
      },
    },
  };
  function loadGlb(file, cb) {
    const asset = new pc.Asset(file, 'container', { url: 'assets/' + file }, null, GLB_OPTS);
    asset.once('load', (a) => cb(null, a)); asset.once('error', (err) => cb(err));
    app.assets.add(asset); app.assets.load(asset);
  }
  function assetsMode() {
    audioInit(); clearWorld(); S = null; mode = 'assets'; music('none'); screen.innerHTML = ''; document.getElementById('hud').hidden = true; P.enabled = false; zoom = 14; camT.set(0, 0, 0);
    AS.root = new pc.Entity(); app.root.addChild(AS.root); AS.items = []; AS.loaded = 0; AS.error = null; AS.char = null; AS.res = null; AS.clip = null; AS.crowd = []; AS.measure = null; AS.crowdRes = null;
    panel();
    fetch('assets/manifest.json').then((r) => r.json()).then((man) => {
      AS.manifest = man;
      for (const a of man.assets) {
        const t0 = performance.now(); const item = { a, ms: 0, ok: false }; AS.items.push(item);
        loadGlb(a.file, (err, asset) => {
          if (err || !asset) { AS.error = String(err); panel(); return; }
          item.ms = Math.round(performance.now() - t0); item.ok = true; AS.loaded++;
          const e = asset.resource.instantiateRenderEntity(); AS.root.addChild(e); item.e = e;
          if (a.id.startsWith('CH_')) { e.setLocalPosition(0, 0, 0); e.setLocalScale(1.6, 1.6, 1.6); AS.char = e; AS.res = asset.resource; if (asset.resource.animations.length) setupAnim(e, asset.resource, 'idle'); }
          // sockety jako malé koule (kontrola, že jsou na hranách modulu a ve středu dveří)
          for (const name of a.sockets) { const n = e.findByName(name); if (n) ent('sphere', sockMat, [0, 0.15, 0], [0.3, 0.3, 0.3], n, false); }
          panel();
        });
      }
    }).catch((err) => { AS.error = String(err); panel(); });
  }
  function leaveAssets(silent) {
    if (AS.root) { AS.root.destroy(); AS.root = null; } AS.char = null; AS.crowd = []; AS.measure = null;
    P.enabled = true; document.getElementById('assetPanel').hidden = true; zoom = 18;
    if (!silent && mode === 'assets') menu();
  }
  function updateAssets() {
    if (AS.measure) {
      const now = performance.now(); AS.measure.frames.push(now - AS.measure.last); AS.measure.last = now;
      if (now - AS.measure.t0 > 5000) {
        // první snímky (rozjezd) se zahazují, jen když jich je dost; pomalé vykreslování jich za 5 s dá málo
        const all = AS.measure.frames; const f = (all.length > 30 ? all.slice(15) : all.slice()).sort((a, b) => a - b); const n = f.length || 1;
        AS.crowdRes = { count: AS.crowd.length, avg: Math.round((1000 * n) / f.reduce((a, b) => a + b, 0)), p95: +(f[Math.min(f.length - 1, Math.floor(n * 0.95))] || 0).toFixed(1) };
        AS.measure = null; panel();
      }
    }
    if (!AS.char || !AS.char.enabled) return;
    // po útoku zpět do stání podle průběhu klipu (ne podle hodin: pomalé snímky animaci zpomalí)
    const L = AS.char.anim && AS.char.anim.baseLayer;
    if (AS.clip === 'attack' && L && L.activeState === 'attack' && L.activeStateProgress >= 1) playClip(AS.char, 'idle');
    const dist = cam.getPosition().distance(new pc.Vec3(0, 1, 0));
    if (AS.lodAuto) AS.lod = dist < 18 ? 0 : dist < 35 ? 1 : 2;
    for (let l = 0; l < 3; l++) { const n = AS.char.findByName('CH_ak_body_LOD' + l); if (n) n.enabled = l === AS.lod; }
    const el = document.getElementById('as-lod'); if (el) el.textContent = `LOD${AS.lod} (${AS.lodAuto ? t('lodAuto') : 'L'}) · ${t('dist')} ${dist.toFixed(1)} m`;
  }
  function panel() {
    const el = document.getElementById('assetPanel'); el.hidden = false;
    el.innerHTML = `<h2>${t('assetsTitle')}</h2><span class="muted">${t('assetsHint')}</span>` + (AS.error ? `<p class="bad">${AS.error}</p>` : '') +
      (AS.items.length ? `<table class="res">${AS.items.map((it) => `<tr><td><b>${it.a.id}</b><br><span class="muted">${it.a.parts.map((p) => p.name.replace(it.a.id + '_', '') + ' ' + p.tris).join(' · ')} ${t('tris')}</span></td><td class="n">${it.ok ? it.ms + ' ms<br>' + Math.round(it.a.bytes / 1024) + ' kB' : t('loading')}</td></tr><tr><td colspan="2" class="muted">${t('mats')}: ${it.a.materials.join(', ')} · ${t('sockets')}: ${it.a.sockets.length}</td></tr>`).join('')}</table>` : `<p>${t('loading')}</p>`) +
      (AS.res && AS.res.animations.length ? `<p class="muted">${t('clip')}:</p><div class="row clips">${CLIPS.map((c, i) => `<button class="btn dim${AS.clip === c ? ' on' : ''}" data-clip="${c}">${i + 1} · ${t(c)}</button>`).join('')}</div>` +
        `<div class="row"><button class="btn dim" id="b-as-crowd" ${AS.measure ? 'disabled' : ''}>${AS.measure ? t('crowdRun') : t('crowd')}</button></div>` +
        (AS.crowdRes ? `<p class="muted">${t('crowdRes')}: <b>${AS.crowdRes.avg} FPS</b> · p95 ${AS.crowdRes.p95} ms</p>` : '') : '') +
      `<p id="as-lod" class="muted"></p><div class="row"><button class="btn dim" id="b-as-back">${t('menu')}</button></div>`;
    document.getElementById('b-as-back').onclick = () => leaveAssets();
    for (const b of el.querySelectorAll('[data-clip]')) b.onclick = () => { if (AS.char) { AS.char.enabled = true; playClip(AS.char, b.dataset.clip); } };
    const bc = document.getElementById('b-as-crowd'); if (bc) bc.onclick = crowd;
    window.HSGame.assets = { loaded: AS.loaded, total: AS.items.length, error: AS.error, items: AS.items.map((it) => ({ id: it.a.id, ok: it.ok, ms: it.ms })), clips: AS.res ? AS.res.animations.map((a) => a.resource.name) : [], clip: AS.clip, crowd: AS.crowdRes, measuring: !!AS.measure };
  }

  function pause() { mode = 'paused'; screen.innerHTML = `<div class="panel"><h2>${t('paused')}</h2>${keysHtml()}${opt()}<div class="row"><button class="btn" id="b-res">${t('resume')}</button><button class="btn dim" id="b-rst">${t('restart')}</button><button class="btn dim" id="b-menu">${t('menu')}</button></div></div>`; document.getElementById('b-res').onclick = resume; document.getElementById('b-rst').onclick = () => start('arena'); document.getElementById('b-menu').onclick = menu; bindOpt(); }
  function resume() { screen.innerHTML = ''; mode = 'play'; acc = 0; }
  function gameOver() {
    mode = 'over'; SAVE.bestWave = Math.max(SAVE.bestWave, S.wave); SAVE.kills += S.kills; saveChar(); persist();
    const st = S.stats;
    screen.innerHTML = `<div class="panel"><h2>${t('over')}</h2><table class="res"><tr><td>${t('wave')}</td><td class="n">${S.wave}</td></tr><tr><td>${t('kills')}</td><td class="n">${S.kills}</td></tr><tr><td>${t('dmgDealt')}</td><td class="n">${st.dmg}</td></tr><tr><td>${t('hits')}</td><td class="n">${st.hits}</td></tr><tr><td>${t('dodges')}</td><td class="n">${st.dodged}</td></tr><tr><td>${t('taken')}</td><td class="n">${st.taken}</td></tr></table><div class="row"><button class="btn" id="b-again">${t('restart')}</button><button class="btn dim" id="b-feel">${t('feel')}</button><button class="btn dim" id="b-menu">${t('menu')}</button></div></div>`;
    document.getElementById('b-again').onclick = () => (S.campaign ? startCampaign() : start(S.mode === 'boss' ? 'boss' : 'arena')); document.getElementById('b-feel').onclick = feelForm; document.getElementById('b-menu').onclick = menu;
  }
  function benchDone() {
    const f = bench.frames.slice(30).sort((a, b) => a - b); const n = f.length || 1; const sum = f.reduce((a, b) => a + b, 0);
    const res = { avg: Math.round((1000 * n) / sum), low1: Math.round(1000 / f[Math.floor(n * 0.99)]), p95: +f[Math.floor(n * 0.95)].toFixed(1), simMs: +(bench.simMs / Math.max(1, bench.steps)).toFixed(3), enemies: S.enemies.filter((e) => !e.dead).length, at: Date.now() };
    const ms2 = (a) => (a.length ? { avg: +avgOf(a).toFixed(2), p95: +pct(a, 0.95).toFixed(2) } : null);
    res.gpuMs = ms2(GT.ms.slice(30)); res.cpuMs = ms2(bench.cpu.slice(30)); res.gpu = HW.gpu; res.threads = HW.threads; res.res = [app.graphicsDevice.width, app.graphicsDevice.height]; res.knights = !!PC; GT.on = false;
    SAVE.bench = res; persist(); window.HSGame.lastBench = res; mode = 'over';
    const ok = res.avg >= 58 && res.p95 <= 20;
    screen.innerHTML = `<div class="panel"><h2>${t('benchDone')}</h2><table class="res"><tr><td>${t('avg')}</td><td class="n">${res.avg}</td></tr><tr><td>${t('low')}</td><td class="n">${res.low1} FPS</td></tr><tr><td>${t('p95')}</td><td class="n">${res.p95} ms</td></tr><tr><td>${t('simMs')}</td><td class="n">${res.simMs} ms</td></tr><tr><td>${t('entities')}</td><td class="n">${res.enemies}</td></tr><tr><td>${t('gpuMs')}</td><td class="n">${res.gpuMs ? res.gpuMs.avg + ' ms (p95 ' + res.gpuMs.p95 + ')' : t('noTimer')}</td></tr><tr><td>${t('cpuMs')}</td><td class="n">${res.cpuMs ? res.cpuMs.avg + ' ms (p95 ' + res.cpuMs.p95 + ')' : '—'}</td></tr><tr><td>${t('gpuName')}</td><td class="n" style="font-size:11px">${String(res.gpu).replace(/[<>&"]/g, '')} · ${res.res[0]}×${res.res[1]}</td></tr></table><p>${t('target')}: <b class="${ok ? 'ok' : 'bad'}">${ok ? t('pass') : t('fail')}</b></p><span class="muted">${t('note')}</span><div class="row"><button class="btn" id="b-again">${t('bench')}</button><button class="btn dim" id="b-menu">${t('menu')}</button></div></div>`;
    document.getElementById('b-again').onclick = () => start('bench'); document.getElementById('b-menu').onclick = menu;
  }

  /* ---------- smyčka ---------- */
  let playAcc = 0;
  app.on('update', (dtRaw) => {
    let dt = Math.min(dtRaw, 0.1); if (slowmo > 0) { slowmo -= dtRaw; dt *= 0.3; } // zpomalení po pádu bosse (Bible: 4 s slow-mo)
    if (bench && mode === 'bench') { const now = performance.now(); bench.frames.push(now - bench.last); bench.last = now; const fs = app.stats.frame; bench.cpu.push(fs.updateTime + fs.renderTime); if (now - bench.t0 > 20000) benchDone(); }
    if (S && (mode === 'play' || mode === 'bench')) {
      aimPt = groundAt(mouse[0], mouse[1]);
      playAcc += dt; if (playAcc >= 5 && mode === 'play') { SAVE.playTime += playAcc; playAcc = 0; persist(); }
      if (hitstop > 0) hitstop -= dt * 1000;
      else {
        acc += dt;
        while (acc >= SIM.TICK || (fresh && mode === 'play' && acc >= 0)) {
          fresh = false; steps++;
          const t0 = performance.now(); const inp = mode === 'bench' ? SIM.autopilot(S) : readInput(); SIM.step(S, inp);
          if (bench) { bench.simMs += performance.now() - t0; bench.steps++; }
          lastEvents = S.events.slice(); handle(lastEvents); acc -= SIM.TICK; if (mode !== 'play' && mode !== 'bench') break;
        }
        renderT += dt;
      }
      latCheck();
      if ((S.mode === 'arena' || S.mode === 'act1') && window.HSMusic) { const p = S.player; const near = S.enemies.some((e) => !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 11); HSMusic.combat(near || renderT - lastFight < 4); }
      syncWorld(hitstop > 0 ? 0 : dt);
      hud();
    }
    if (mode === 'assets') updateAssets();
    placeCamera(dt); updateNums(dt); placeNames();
    if (fpsOn) { const L = LAT.samples.slice(-20); document.getElementById('fps').textContent = Math.round(1 / Math.max(1e-3, dtRaw)) + ' FPS' + (L.length ? ` · ${t('latShort')} ${latStats(L).presentAvg} ms` : ''); }
  });
  function syncWorld(dt) {
    const p = S.player;
    P.setLocalPosition(p.x, 0, p.z); P.setLocalEulerAngles(0, (-p.face * 180) / Math.PI, 0); glow.setLocalPosition(p.x, 2.2, p.z);
    // švih zbraně podle rozpracované akce
    if (p.act && p.act.id !== 'ak_charge') { const k = Math.min(1, p.act.t / p.act.dur); const sw = p.act.id === 'ak_slam' ? -100 + 190 * Math.min(1, k / 0.4) : -75 + 150 * Math.min(1, k / 0.45); pivot.setLocalEulerAngles(p.act.id === 'ak_slam' ? 0 : 0, sw, p.act.id === 'ak_slam' ? Math.max(-80, sw * 0.6) : 0); }
    else pivot.setLocalEulerAngles(0, -35, 0);
    if (PC) {
      // hráč: útok zpomalený/zrychlený tak, aby švih padl do okna zásahu akce (~45 % trvání)
      const moved = lastP ? Math.hypot(p.x - lastP[0], p.z - lastP[1]) : 0; lastP = [p.x, p.z];
      if (p.dodge) charClip(PC, 'run', 2.2);
      else if (p.act && p.act.id === 'ak_charge') charClip(PC, 'run', 2, 0.08, p.act);
      else if (p.act) charClip(PC, 'attack', Math.min(3, SWING / (0.45 * p.act.dur)), 0.06, p.act);
      else if (p.stun > 0) charClip(PC, 'idle', 0.5);
      else if (dt > 0 && moved / dt > 0.5) charClip(PC, 'run', 1.25);
      else charClip(PC, 'idle', 1);
      charPin(PC); charLod(PC, p.x, p.z); P.setLocalScale(1, 1, 1);
    } else P.setLocalScale(1, p.dodge ? 0.75 : 1, 1);
    for (const [id, v] of EV) { // umírající: dohrají smrt i poté, co je simulace zahodí
      if (v.dying <= 0) continue; v.dying += dt;
      if (v.c) { charPin(v.c); if (v.dying >= 1.8) { v.root.destroy(); EV.delete(id); } continue; }
      const k = Math.min(1, v.dying / 0.4); v.root.setLocalScale(1 - k * 0.7, 1 - k, 1 - k * 0.7); if (k >= 1) { v.root.destroy(); EV.delete(id); }
    }
    for (const e of S.enemies) {
      let v = EV.get(e.id);
      if (v && v.stale && !v.dying) { v.root.destroy(); EV.delete(e.id); v = null; }
      if (S.zone) { const dd = Math.hypot(e.x - S.player.x, e.z - S.player.z); if (!v && dd > 38) continue; if (v && !v.dying && dd > 48) { v.root.destroy(); EV.delete(e.id); continue; } }
      if (!v) { if (e.dead) continue; v = enemyVisual(e); }
      if (v.dying) continue;
      const px = v.x, pz = v.z;
      v.x += (e.x - v.x) * Math.min(1, dt * 18); v.z += (e.z - v.z) * Math.min(1, dt * 18);
      v.root.setLocalPosition(v.x, 0, v.z); v.root.setLocalEulerAngles(0, (-e.face * 180) / Math.PI, 0);
      if (v.c) {
        // útok: švih na konci telegraphu; omráčení stojí; jinak běh/stání podle pohybu
        if (e.atk) charClip(v.c, 'attack', Math.max(0.3, Math.min(2.5, SWING / e.atk.def.tele)), 0.08, e.atk);
        else if (e.stun > 0) charClip(v.c, 'idle', 0.4);
        else if (v.c.clip === 'attack' && v.c.e.anim.baseLayer.activeStateProgress < 1) { /* dohraje švih */ }
        else if (dt > 0 && Math.hypot(v.x - px, v.z - pz) / dt > 0.4) charClip(v.c, 'run', Math.max(0.6, e.speed / 4.5));
        else charClip(v.c, 'idle', 1);
        charMat(v.c, e.flash > 0 ? M.flash : e.stun > 0 ? M.stun : null); charPin(v.c); charLod(v.c, v.x, v.z);
        if (e.ward > 0 && !v.wardE) { const k = CH_SCALE[e.type] || 1; v.wardE = ent('sphere', M_WARD, [0, 1 * k, 0], [1.3 * k, 2.1 * k, 1.3 * k], v.root, false); } else if (!(e.ward > 0) && v.wardE) { v.wardE.destroy(); v.wardE = null; }
        continue;
      }
      if (v.hound) { const mv = Math.hypot(v.x - px, v.z - pz) / Math.max(dt, 1e-3); v.body.setLocalPosition(0, mv > 0.5 ? Math.abs(Math.sin(renderT * 14 + e.id)) * 0.12 : 0, 0); v.body.setLocalEulerAngles(0, 0, e.atk && e.atk.def.shape === 'leap' ? -12 * Math.min(1, e.atk.t / e.atk.def.tele) : 0); for (const r of v.body.findComponents('render')) { const want = e.flash > 0 ? M.flash : e.stun > 0 ? M.stun : null; if (want && r.material !== want) { r._m = r._m || r.material; r.material = want; } else if (!want && r._m) { r.material = r._m; r._m = null; } } continue; }
      const m = e.flash > 0 ? M.flash : e.stun > 0 ? M.stun : v.base; if (v.body.render.material !== m) v.body.render.material = m;
      if (v.wisp) { v.body.setLocalPosition(0, 1.1 + Math.sin(renderT * 6 + e.id) * 0.15, 0); const k = e.atk ? 1 + Math.min(1, e.atk.t / e.atk.def.tele) * 0.6 : 1; v.body.setLocalScale(0.55 * k, 0.55 * k, 0.55 * k); continue; }
      const wind = e.atk ? Math.min(1, e.atk.t / e.atk.def.tele) : 0; v.body.setLocalScale(...(e.type === 'en_brute' ? [1.9 + wind * 0.25, 1.25 - wind * 0.08, 1.9 + wind * 0.25] : [0.9 + wind * 0.12, 0.85 - wind * 0.05, 0.9 + wind * 0.12]));
    }
    syncDrops(); syncBoss(); syncProj(); syncZone(); syncCoins();
    for (let i = TELES.length - 1; i >= 0; i--) {
      const te = TELES[i]; te.t += dt; const owner = S.enemies.find((e) => e.id === te.id); const k = Math.min(1, te.t / te.dur);
      te.fill.setLocalScale(te.r * k, 1, te.r * k);
      if (k >= 1 || !owner || owner.dead || !owner.atk) { te.line.destroy(); te.fill.destroy(); TELES.splice(i, 1); }
    }
    for (let i = FXS.length - 1; i >= 0; i--) { const f = FXS[i]; f.t += dt; const k = Math.min(1, f.t / f.life); f.upd(f, k); if (k >= 1) { f.e.destroy(); FXS.splice(i, 1); } }
  }
  const tmpV = new pc.Vec3();
  function updateNums(dt) {
    for (let i = NUMS.length - 1; i >= 0; i--) {
      const n = NUMS[i]; n.t += dt; if (n.t > 0.8) { n.d.remove(); NUMS.splice(i, 1); continue; }
      cam.camera.worldToScreen(new pc.Vec3(n.x, n.y + n.t * 1.2, n.z), tmpV);
      n.d.style.transform = `translate(${tmpV.x.toFixed(0)}px, ${tmpV.y.toFixed(0)}px) translate(-50%, -50%) scale(${n.t < 0.08 ? 1.3 : 1})`; n.d.style.opacity = n.t > 0.5 ? (1 - (n.t - 0.5) / 0.3).toFixed(2) : '1';
    }
  }

  window.HSGame = { app, get state() { return S; }, get mode() { return mode; }, start, menu, lastBench: SAVE.bench, assetRootZ: () => { const r = AS.char && AS.char.findByName('root'); return r ? r.getPosition().z : 0; }, latency: () => ({ on: LAT.on, n: LAT.samples.length, last: SAVE.latency }), hw: HW, get feel() { return SAVE.feel; }, openInv, closeInv, inv: (c) => { const ok = SIM.invCommand(S, c); handle(S.events.slice()); S.events.length = 0; if (mode === 'inv') renderInv(); return ok; }, get gear() { return S && S.gear; }, get char() { return S && S.char; }, get music() { return window.HSMusic ? HSMusic.status : null; }, get boss() { return S && S.boss; }, get zone() { return S && S.zone ? { id: S.zone.id, done: S.zoneDone, keys: [...S.zoneKeys], deaths: S.deaths, objs: S.objs.map((o) => ({ kind: o.kind, done: o.done })) } : null; }, startCampaign, get save() { return SAVE; }, openForge, closeForge, get forge() { return mode === 'forge'; }, get dialog() { return DLG ? { choice: !!DLG.choice, lines: DLG.lines.length } : null; }, dlgNext, get chars() { return { ready: !!PC, gray: CH.gray, enemies: [...EV.values()].filter((v) => v.c).length, clip: PC && PC.clip }; }, step: (n, auto, inp) => { for (let i = 0; i < (n || 1); i++) { SIM.step(S, auto ? SIM.autopilot(S) : inp || {}); handle(S.events.slice()); } return S; } };
  // rytíř pro arénu a benchmark (asset pipeline); do načtení zůstává šedý box
  if (!CH.gray) loadGlb('CH_ak_body.glb', (err, asset) => { if (err || !asset) { console.warn('CH_ak_body', err); return; } CH.res = asset.resource; charsReady(); });
  app.start(); menu(); persist();
})();
