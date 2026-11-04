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
      hint: 'Telegraph = rudý tvar na zemi. Uhni mezerníkem, než se naplní.', dmgDealt: 'Poškození', hits: 'Zásahy', dodges: 'Úspěšné úhyby', taken: 'Přijaté poškození',
    },
    en: {
      sub: 'Prototype P0 · grey box', pitch: 'An Ash Knight against hordes of ash. We are testing whether combat feels right and whether the browser holds 60 FPS with 50 enemies.',
      arena: 'Arena (waves)', bench: 'Benchmark: 50 enemies', assets: 'Asset test', assetsTitle: 'Asset pipeline test', assetsHint: 'The wheel changes the camera distance and with it the character LOD (0–18 m LOD0, 18–35 m LOD1, beyond LOD2). L toggles automatic LOD, 1–4 play the clips. Esc goes back.', clip: 'Clip', crowd: '50 animated characters', crowdRun: 'Measuring for 5 s…', crowdRes: 'Crowd of 50 (LOD1, skin + animation)', idle: 'Idle', run: 'Run', attack: 'Attack (root motion)', death: 'Death', loading: 'Loading…', loaded: 'loaded', lodAuto: 'automatic', file: 'File', tris: 'Triangles', mats: 'Materials', sockets: 'Sockets', loadMs: 'Load', lod: 'Character LOD', dist: 'Camera distance', back: 'Back to the center', resume: 'Resume', restart: 'Restart', menu: 'Main menu',
      wave: 'Wave', kills: 'Kills', paused: 'Paused', over: 'Your echo has shattered', best: 'Best wave', clickMove: 'Click to move (otherwise WASD)',
      cleave: 'Cleave', slam: 'Searing Slam', charge: 'Ember Charge', dodge: 'Dodge', nores: 'Not enough Cinders', miss: 'Miss', evade: 'Evade!', dodged: 'Dodged',
      keysMove: 'Move', keysMoveClick: 'left click on the ground (or WASD)', keysMoveWasd: 'WASD', keysCleave: 'left button (hold) – builds Cinders', keysSlam: 'right button – AoE fire, costs Cinders', keysCharge: 'Q – dash, stuns', keysDodge: 'space – dodge with i-frames', keysMisc: 'Esc pause · F FPS counter · wheel zoom',
      benchRun: 'Benchmark running… the autopilot fights 50 enemies', benchDone: 'Benchmark result', avg: 'Average FPS', low: '1 % low', p95: '95th percentile frame', simMs: 'Simulation per step', entities: 'Enemies in the scene', target: 'P0 target: 60 FPS with 50 enemies', pass: 'met', fail: 'not met', note: 'Measured in this browser on this computer.',
      hint: 'Telegraph = red shape on the ground. Dodge with space before it fills.', dmgDealt: 'Damage', hits: 'Hits', dodges: 'Successful dodges', taken: 'Damage taken',
    },
  };
  const t = (k) => (T[LANG][k] != null ? T[LANG][k] : T.cs[k]);
  document.documentElement.lang = LANG;

  /* ---------- uložení a statistiky pro centrum ---------- */
  const SAVE_KEY = 'hollowsun.save.v1', STATS_KEY = 'gamecenter.stats.hollowsun';
  const DEF = { v: 1, clickMove: true, bestWave: 0, kills: 0, playTime: 0, bench: null };
  let SAVE = (() => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { return Object.assign({}, DEF); } })();
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE));
      localStorage.setItem(STATS_KEY, JSON.stringify({ playTime: Math.round(SAVE.playTime), lastPlayed: Date.now(), progress: Math.min(1, SAVE.bestWave / 10), stats: { bestWave: SAVE.bestWave, kills: SAVE.kills, benchFps: SAVE.bench ? SAVE.bench.avg : 0 } }));
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
  ent('plane', M.ground, [0, 0, 0], [SIM.ARENA * 2.4, 1, SIM.ARENA * 2.4], null, false);
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; const r = SIM.ARENA + 0.6; const b = ent('box', M.rim, [Math.cos(a) * r, 0.5 + (i % 3) * 0.25, Math.sin(a) * r], [1.6, 1 + (i % 3) * 0.5, 0.8]); b.setLocalEulerAngles(0, (-a * 180) / Math.PI + 90, 0); }
  for (const [x, z, r] of SIM.create({ mode: 'bench', benchCount: 0 }).pillars) ent('cylinder', M.pillar, [x, 1.25, z], [r * 2, 2.5, r * 2]);
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
  const pend = { cast: null, dodge: false, moveTo: null };
  function groundAt(mx, my) {
    const c = cam.camera; const a = c.screenToWorld(mx, my, c.nearClip), b = c.screenToWorld(mx, my, c.farClip);
    const k = a.y / (a.y - b.y || 1e-6); return [a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k];
  }
  function enemyNear(pt, rad) { let best = null, bd = rad; for (const e of S.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - pt[0], e.z - pt[1]) - e.r; if (d < bd) { bd = d; best = e; } } return best; }
  function readInput() {
    const inp = { aim: aimPt.slice() };
    let mx = 0, mz = 0; if (keys.w) { mx += FWD[0]; mz += FWD[1]; } if (keys.s) { mx -= FWD[0]; mz -= FWD[1]; } if (keys.d) { mx += RIGHT[0]; mz += RIGHT[1]; } if (keys.a) { mx -= RIGHT[0]; mz -= RIGHT[1]; }
    if (mx || mz) inp.move = [mx, mz];
    if (lmb) {
      if (SAVE.clickMove) {
        const e = enemyNear(aimPt, 1.2);
        if (e) { const d = Math.hypot(e.x - S.player.x, e.z - S.player.z); if (d <= S.skills.ak_cleave.sk.r + e.r) { inp.hold = true; inp.aim = [e.x, e.z]; } else inp.moveTo = [e.x, e.z]; }
        else if (!inp.move) inp.moveTo = aimPt.slice();
      } else inp.hold = true;
    }
    if (pend.cast) { inp.cast = pend.cast; pend.cast = null; }
    if (pend.dodge) { inp.dodge = true; pend.dodge = false; if (!inp.move) inp.move = [aimPt[0] - S.player.x, aimPt[1] - S.player.z]; }
    return inp;
  }
  app.mouse.disableContextMenu();
  app.mouse.on(pc.EVENT_MOUSEMOVE, (e) => { mouse = [e.x, e.y]; });
  app.mouse.on(pc.EVENT_MOUSEDOWN, (e) => { if (mode !== 'play') return; audioInit(); mouse = [e.x, e.y]; aimPt = groundAt(e.x, e.y); if (e.button === pc.MOUSEBUTTON_LEFT) lmb = true; if (e.button === pc.MOUSEBUTTON_RIGHT) pend.cast = 'ak_slam'; });
  app.mouse.on(pc.EVENT_MOUSEUP, (e) => { if (e.button === pc.MOUSEBUTTON_LEFT) lmb = false; });
  app.mouse.on(pc.EVENT_MOUSEWHEEL, (e) => { const lo = mode === 'assets' ? 6 : 14, hi = mode === 'assets' ? 45 : 22; zoom = Math.max(lo, Math.min(hi, zoom + (e.wheelDelta > 0 ? 1 : -1) * (mode === 'assets' ? 2 : 1))); });
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase(); keys[k] = true;
    if (k === 'escape') { if (mode === 'play') pause(); else if (mode === 'paused') resume(); else if (mode === 'assets') leaveAssets(); return; }
    if (k === 'l' && mode === 'assets') { AS.lodAuto = !AS.lodAuto; if (!AS.lodAuto) AS.lod = (AS.lod + 1) % 3; }
    if (mode === 'assets' && AS.char && '1234'.includes(k)) { AS.char.enabled = true; playClip(AS.char, CLIPS[Number(k) - 1]); }
    if (k === 'f') { fpsOn = !fpsOn; document.getElementById('fps').hidden = !fpsOn; }
    if (mode !== 'play') return; audioInit();
    if (k === ' ') { pend.dodge = true; e.preventDefault(); }
    if (k === 'q' || k === '3') pend.cast = 'ak_charge';
    if (k === '2' || k === 'e') pend.cast = 'ak_slam';
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; lmb = false; if (mode === 'play') pause(); });

  /* ---------- zvuk: krátké procedurální efekty (Web Audio) ---------- */
  let AC = null, master = null;
  function audioInit() { if (AC) return; try { AC = new AudioContext(); master = AC.createGain(); master.gain.value = 0.35; master.connect(AC.destination); } catch (e) { AC = null; } }
  function noise(dur, f0, f1, vol, type) {
    if (!AC) return; const n = AC.createBufferSource(); const len = Math.floor(AC.sampleRate * dur); const buf = AC.createBuffer(1, len, AC.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    n.buffer = buf; const f = AC.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(f0, AC.currentTime); f.frequency.exponentialRampToValueAtTime(f1, AC.currentTime + dur); const g = AC.createGain(); g.gain.value = vol; n.connect(f).connect(g).connect(master); n.start();
  }
  function tone(f0, f1, dur, vol, type) { if (!AC) return; const o = AC.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, AC.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), AC.currentTime + dur); const g = AC.createGain(); g.gain.setValueAtTime(vol, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur); o.connect(g).connect(master); o.start(); o.stop(AC.currentTime + dur); }
  const SFX = { swing: () => noise(0.14, 2400, 600, 0.5), hit: (c) => { tone(c ? 180 : 120, 50, 0.12, 0.6, 'triangle'); noise(0.05, 3000, 1500, 0.4); }, slam: () => { tone(90, 30, 0.45, 0.9); noise(0.35, 900, 120, 0.6, 'lowpass'); }, hurt: () => tone(320, 140, 0.18, 0.35, 'sawtooth'), dodge: () => noise(0.18, 600, 2400, 0.25), tele: () => tone(520, 480, 0.08, 0.08, 'square'), death: () => noise(0.25, 700, 150, 0.3, 'lowpass') };

  /* ---------- postavy z asset pipeline: rytíř se skinem a animacemi (CH_ak_body) ---------- */
  // Simulace určuje pozici i načasování; animace se jí přizpůsobí (root motion útoku se vynuluje).
  const CH = { res: null, gray: /[?&]gray\b/.test(location.search) };
  const CH_SETS = { en_thrall: { M_ak_steel: M.thrall, M_ak_ember: M.eyes }, en_brute: { M_ak_steel: M.brute, M_ak_ember: M.furnace } };
  const CH_SCALE = { en_thrall: 1, en_brute: 1.45 };
  const SWING = 0.47; // s: švih v klipu AN_hero_attack (snímek 14 z 27)
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
    if (CH.res && !CH.gray) {
      const root = new pc.Entity(); app.root.addChild(root); root.setLocalPosition(e.x, 0, e.z);
      const v = { root, c: charVisual(root, CH_SETS[e.type] || CH_SETS.en_thrall, CH_SCALE[e.type] || 1), dying: 0, x: e.x, z: e.z }; EV.set(e.id, v); return v;
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
  const fxLayer = document.getElementById('fx'); const NUMS = [];
  function num(x, z, text, cls, h) {
    const d = document.createElement('div'); d.className = 'dmg ' + (cls || ''); d.textContent = text; fxLayer.appendChild(d);
    NUMS.push({ d, x: x + (Math.random() - 0.5) * 0.6, z, y: h || 2, t: 0 });
  }
  function handle(evs) {
    for (const ev of evs) {
      switch (ev.t) {
        case 'hit': num(ev.x, ev.z, ev.dmg, (ev.crit ? 'crit ' : '') + (ev.type === 'fire' ? 'fire' : '')); SFX.hit(ev.crit); break;
        case 'burn': num(ev.x, ev.z, ev.dmg, 'fire', 1.6); break;
        case 'miss': num(ev.x, ev.z, t('miss'), 'info'); break;
        case 'swing': { const e = flat(meshFor('swing', 0.6, ev.r, ev.w), M.swing, ev.x, ev.z, ev.face, 1, 0.6); fx(e, 0.14, (f, k) => f.e.setLocalScale(0.85 + k * 0.2, 1, 0.85 + k * 0.2)); SFX.swing(); break; }
        case 'slam': { const e = flat(meshFor('ringS', 0.75, 1, 360), M.slam, ev.x, ev.z, 0, 0.5, 0.05); fx(e, 0.35, (f, k) => f.e.setLocalScale(ev.r * (0.3 + k), 1, ev.r * (0.3 + k))); SFX.slam(); break; }
        case 'cast': if (ev.skill === 'ak_charge') { const g = ent('capsule', M.ghost, [ev.x, 0.9, ev.z], [0.9, 0.9, 0.9], null, false); fx(g, 0.35, () => {}); } break;
        case 'dodge': { const g = ent('capsule', M.ghost, [ev.x, 0.9, ev.z], [0.9, 0.9, 0.9], null, false); fx(g, 0.25, () => {}); SFX.dodge(); break; }
        case 'tele': teleVisual(ev); SFX.tele(); break;
        case 'hitstop': hitstop = Math.min(120, Math.max(hitstop, ev.ms)); break;
        case 'shake': shake = Math.max(shake, ev.amp); break;
        case 'hurt': num(ev.x, ev.z, '-' + ev.dmg, 'hurt', 2.4); SFX.hurt(); break;
        case 'evade': num(ev.x, ev.z, t('evade'), 'info', 2.4); break;
        case 'dodged': num(ev.x, ev.z, t('dodged'), 'info', 2.4); break;
        case 'nores': flashSkill(ev.skill); break;
        case 'death': { const v = EV.get(ev.id); if (v) { v.dying = 0.001; if (v.c) { charMat(v.c, null); charClip(v.c, 'death', 1, 0.08); } } SFX.death(); break; }
        case 'over': gameOver(); break;
        default: break;
      }
    }
  }

  /* ---------- HUD ---------- */
  const SK = [['ak_cleave', 'LMB', 'cleave'], ['ak_slam', 'RMB', 'slam'], ['ak_charge', 'Q', 'charge'], ['dodge', '␣', 'dodge']];
  const skillsEl = document.getElementById('skills');
  skillsEl.innerHTML = SK.map(([id, key, nm]) => `<div class="sk" id="sk-${id}"><span class="key">${key}</span><b>${t(nm)}</b><span class="cost"></span><div class="cd"></div></div>`).join('');
  function flashSkill(id) { const el = document.getElementById('sk-' + id); if (!el) return; el.classList.add('no'); setTimeout(() => el.classList.remove('no'), 250); num(S.player.x, S.player.z, t('nores'), 'info', 2.6); }
  let fpsOn = false;
  function hud() {
    const p = S.player;
    document.getElementById('b-hp').style.width = ((p.hp / p.hpMax) * 100).toFixed(1) + '%'; document.getElementById('t-hp').textContent = Math.ceil(p.hp) + ' / ' + p.hpMax;
    document.getElementById('b-res').style.width = ((p.res / p.resMax) * 100).toFixed(1) + '%'; document.getElementById('t-res').textContent = Math.floor(p.res) + ' Cinders';
    document.getElementById('wave').textContent = mode === 'bench' || S.mode === 'bench' ? 'Benchmark' : t('wave') + ' ' + S.wave;
    document.getElementById('kills').textContent = t('kills') + ' ' + S.kills;
    for (const [id] of SK) {
      const el = document.getElementById('sk-' + id); if (!el) continue;
      if (id === 'dodge') { el.querySelector('.cd').style.height = ((p.dodgeCd / SIM.DODGE.cd) * 100).toFixed(0) + '%'; continue; }
      const sl = S.skills[id]; const h = sl.hit.en_thrall; const cdMax = h.cd || 0;
      el.querySelector('.cd').style.height = cdMax ? ((sl.cd / cdMax) * 100).toFixed(0) + '%' : '0%';
      el.querySelector('.cost').textContent = h.cost > 0 ? h.cost : '+' + -h.cost;
      el.style.opacity = h.cost > 0 && p.res < h.cost ? 0.55 : 1;
    }
  }

  /* ---------- obrazovky ---------- */
  const screen = document.getElementById('screen');
  const keysHtml = () => `<div class="keys"><kbd>${t('keysMove')}</kbd><span>${SAVE.clickMove ? t('keysMoveClick') : t('keysMoveWasd')}</span><kbd>Cleave</kbd><span>${t('keysCleave')}</span><kbd>Slam</kbd><span>${t('keysSlam')}</span><kbd>Charge</kbd><span>${t('keysCharge')}</span><kbd>${t('dodge')}</kbd><span>${t('keysDodge')}</span><kbd>…</kbd><span>${t('keysMisc')}</span></div>`;
  const opt = () => `<label class="opt" for="o-click"><input type="checkbox" id="o-click" ${SAVE.clickMove ? 'checked' : ''}> ${t('clickMove')}</label>`;
  function bindOpt() { const c = document.getElementById('o-click'); if (c) c.addEventListener('change', () => { SAVE.clickMove = c.checked; persist(); }); }
  function menu() {
    mode = 'menu'; document.getElementById('hud').hidden = true;
    screen.innerHTML = `<div class="panel"><span class="muted">ECHOES OF THE HOLLOW SUN · ${t('sub')}</span><h1>Hollow Sun</h1><p>${t('pitch')}</p>${keysHtml()}${opt()}
      <div class="row"><button class="btn" id="b-arena">${t('arena')}</button><button class="btn" id="b-bench">${t('bench')}</button><button class="btn dim" id="b-assets">${t('assets')}</button><a class="btn dim" href="../../index.html">${t('back')}</a></div>
      <span class="muted">${t('best')}: ${SAVE.bestWave} · ${t('kills')}: ${SAVE.kills}${SAVE.bench ? ' · Benchmark: ' + SAVE.bench.avg + ' FPS' : ''}</span></div>`;
    document.getElementById('b-arena').onclick = () => start('arena'); document.getElementById('b-bench').onclick = () => start('bench'); document.getElementById('b-assets').onclick = assetsMode; bindOpt();
  }
  function clearWorld() { for (const v of EV.values()) v.root.destroy(); EV.clear(); for (const te of TELES) { te.line.destroy(); te.fill.destroy(); } TELES.length = 0; for (const f of FXS) f.e.destroy(); FXS.length = 0; for (const n of NUMS) n.d.remove(); NUMS.length = 0; }
  let bench = null;
  function start(m) {
    leaveAssets(true); audioInit(); clearWorld(); screen.innerHTML = ''; document.getElementById('hud').hidden = false; acc = 0; hitstop = 0; lmb = false;
    S = SIM.create({ mode: m === 'bench' ? 'bench' : 'arena', seed: m + '-' + Date.now(), invuln: m === 'bench' });
    camT.set(S.player.x, 0, S.player.z); mode = m === 'bench' ? 'bench' : 'play';
    document.getElementById('hint').textContent = m === 'bench' ? t('benchRun') : t('hint');
    bench = m === 'bench' ? { t0: performance.now(), frames: [], simMs: 0, steps: 0, last: performance.now() } : null;
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
    audioInit(); clearWorld(); S = null; mode = 'assets'; screen.innerHTML = ''; document.getElementById('hud').hidden = true; P.enabled = false; zoom = 14; camT.set(0, 0, 0);
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
        const f = AS.measure.frames.slice(15).sort((a, b) => a - b); const n = f.length || 1;
        AS.crowdRes = { count: AS.crowd.length, avg: Math.round((1000 * n) / f.reduce((a, b) => a + b, 0)), p95: +f[Math.floor(n * 0.95)].toFixed(1) };
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
    mode = 'over'; SAVE.bestWave = Math.max(SAVE.bestWave, S.wave); SAVE.kills += S.kills; persist();
    const st = S.stats;
    screen.innerHTML = `<div class="panel"><h2>${t('over')}</h2><table class="res"><tr><td>${t('wave')}</td><td class="n">${S.wave}</td></tr><tr><td>${t('kills')}</td><td class="n">${S.kills}</td></tr><tr><td>${t('dmgDealt')}</td><td class="n">${st.dmg}</td></tr><tr><td>${t('hits')}</td><td class="n">${st.hits}</td></tr><tr><td>${t('dodges')}</td><td class="n">${st.dodged}</td></tr><tr><td>${t('taken')}</td><td class="n">${st.taken}</td></tr></table><div class="row"><button class="btn" id="b-again">${t('restart')}</button><button class="btn dim" id="b-menu">${t('menu')}</button></div></div>`;
    document.getElementById('b-again').onclick = () => start('arena'); document.getElementById('b-menu').onclick = menu;
  }
  function benchDone() {
    const f = bench.frames.slice(30).sort((a, b) => a - b); const n = f.length || 1; const sum = f.reduce((a, b) => a + b, 0);
    const res = { avg: Math.round((1000 * n) / sum), low1: Math.round(1000 / f[Math.floor(n * 0.99)]), p95: +f[Math.floor(n * 0.95)].toFixed(1), simMs: +(bench.simMs / Math.max(1, bench.steps)).toFixed(3), enemies: S.enemies.filter((e) => !e.dead).length, at: Date.now() };
    SAVE.bench = res; persist(); window.HSGame.lastBench = res; mode = 'over';
    const ok = res.avg >= 58 && res.p95 <= 20;
    screen.innerHTML = `<div class="panel"><h2>${t('benchDone')}</h2><table class="res"><tr><td>${t('avg')}</td><td class="n">${res.avg}</td></tr><tr><td>${t('low')}</td><td class="n">${res.low1} FPS</td></tr><tr><td>${t('p95')}</td><td class="n">${res.p95} ms</td></tr><tr><td>${t('simMs')}</td><td class="n">${res.simMs} ms</td></tr><tr><td>${t('entities')}</td><td class="n">${res.enemies}</td></tr></table><p>${t('target')}: <b class="${ok ? 'ok' : 'bad'}">${ok ? t('pass') : t('fail')}</b></p><span class="muted">${t('note')}</span><div class="row"><button class="btn" id="b-again">${t('bench')}</button><button class="btn dim" id="b-menu">${t('menu')}</button></div></div>`;
    document.getElementById('b-again').onclick = () => start('bench'); document.getElementById('b-menu').onclick = menu;
  }

  /* ---------- smyčka ---------- */
  let playAcc = 0;
  app.on('update', (dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    if (bench && mode === 'bench') { const now = performance.now(); bench.frames.push(now - bench.last); bench.last = now; if (now - bench.t0 > 20000) benchDone(); }
    if (S && (mode === 'play' || mode === 'bench')) {
      aimPt = groundAt(mouse[0], mouse[1]);
      playAcc += dt; if (playAcc >= 5 && mode === 'play') { SAVE.playTime += playAcc; playAcc = 0; persist(); }
      if (hitstop > 0) hitstop -= dt * 1000;
      else {
        acc += dt;
        while (acc >= SIM.TICK) {
          const t0 = performance.now(); const inp = mode === 'bench' ? SIM.autopilot(S) : readInput(); SIM.step(S, inp);
          if (bench) { bench.simMs += performance.now() - t0; bench.steps++; }
          lastEvents = S.events.slice(); handle(lastEvents); acc -= SIM.TICK; if (mode !== 'play' && mode !== 'bench') break;
        }
        renderT += dt;
      }
      syncWorld(hitstop > 0 ? 0 : dt);
      hud();
    }
    if (mode === 'assets') updateAssets();
    placeCamera(dt); updateNums(dt);
    if (fpsOn) document.getElementById('fps').textContent = Math.round(1 / Math.max(1e-3, dtRaw)) + ' FPS';
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
        continue;
      }
      const m = e.flash > 0 ? M.flash : e.stun > 0 ? M.stun : v.base; if (v.body.render.material !== m) v.body.render.material = m;
      const wind = e.atk ? Math.min(1, e.atk.t / e.atk.def.tele) : 0; v.body.setLocalScale(...(e.type === 'en_brute' ? [1.9 + wind * 0.25, 1.25 - wind * 0.08, 1.9 + wind * 0.25] : [0.9 + wind * 0.12, 0.85 - wind * 0.05, 0.9 + wind * 0.12]));
    }
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

  window.HSGame = { app, get state() { return S; }, get mode() { return mode; }, start, menu, lastBench: SAVE.bench, assetRootZ: () => { const r = AS.char && AS.char.findByName('root'); return r ? r.getPosition().z : 0; }, get chars() { return { ready: !!PC, gray: CH.gray, enemies: [...EV.values()].filter((v) => v.c).length, clip: PC && PC.clip }; }, step: (n, auto) => { for (let i = 0; i < (n || 1); i++) { SIM.step(S, auto ? SIM.autopilot(S) : {}); handle(S.events.slice()); } return S; } };
  // rytíř pro arénu a benchmark (asset pipeline); do načtení zůstává šedý box
  if (!CH.gray) loadGlb('CH_ak_body.glb', (err, asset) => { if (err || !asset) { console.warn('CH_ak_body', err); return; } CH.res = asset.resource; charsReady(); });
  app.start(); menu(); persist();
})();
