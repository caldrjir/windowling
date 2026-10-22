'use strict';
// ── Ukládání ────────────────────────────────────────────────────────────────
const SAVE_KEY = 'driftwood.save.v1';
const HUB_KEY = 'gamecenter.stats.driftwood';
function loadSave() {
  const d = {
    v: 1, achievements: {}, world: null,
    stats: { tools: 0, fires: 0, bestDays: 0, wolves: 0, deer: 0, iron: 0, shelters: 0, trees: 0, rocks: 0, escapes: 0, hardEscapes: 0, fastEscape: 0, eaten: 0, worlds: 0, deaths: 0, time: 0 },
    settings: { sfx: 0.7, music: 0.5, sens: 1, fov: 75, shadows: true, view: 1, look: null },
  };
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) for (const k in s) d[k] = d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && s[k] ? Object.assign(d[k], s[k]) : s[k]; } catch (e) { /* poškozený save */ }
  return d;
}
let SAVE = loadSave();
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE));
    localStorage.setItem(HUB_KEY, JSON.stringify({
      playTime: SAVE.stats.time, lastPlayed: Date.now(), progress: Object.keys(SAVE.achievements).length / ACHIEVEMENTS.length,
      stats: { best: SAVE.stats.bestDays, escapes: SAVE.stats.escapes, wolves: SAVE.stats.wolves, achievements: `${Object.keys(SAVE.achievements).length} / ${ACHIEVEMENTS.length}` },
    }));
  } catch (e) { /* bez úložiště */ }
}

// ── Stav hry ────────────────────────────────────────────────────────────────
const G = { mode: 'normal', seed: 1, hour: 8, day: 1, flags: {}, playing: false, menuT: 0, shake: 0, sleepT: 0, won: false };

const Game = {
  renderer: null, scene: null, cam: null, torchLight: null, playing: false, locked: false, last: 0, saveT: 0, char: null,
  get third() { return SAVE.settings.view === 3; },
  init() {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = SAVE.settings.shadows; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.cam = new THREE.PerspectiveCamera(SAVE.settings.fov, 1, 0.08, 2600);
    this.torchLight = new THREE.PointLight(0xffa850, 0, 18, 2);
    ViewModel.init();
    Player.init();
    UI.init();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    Sound.setVolume('sfx', SAVE.settings.sfx); Sound.setVolume('music', SAVE.settings.music);
    // menu: pozadí z uloženého nebo náhodného ostrova
    this.buildWorld(SAVE.world ? SAVE.world.seed : (Math.random() * 1e9) | 0);
    UI.menu();
    persist();
    requestAnimationFrame(t => this.loop(t));
  },
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
  },
  applySettings() {
    this.cam.fov = SAVE.settings.fov; this.cam.updateProjectionMatrix();
    if (this.renderer.shadowMap.enabled !== SAVE.settings.shadows) {
      this.renderer.shadowMap.enabled = SAVE.settings.shadows;
      this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    }
  },
  buildWorld(seed) {
    if (this.scene && G.seed === seed && this.built) return;
    this.scene = new THREE.Scene();
    World.structures = []; World.clouds = [];
    World.generate(seed, this.scene);
    Animals.init(this.scene);
    Particles.init(this.scene);
    this.scene.add(this.cam);
    this.cam.add(this.torchLight);
    this.char = new Character(SAVE.settings.look || defaultLook());
    this.char.root.visible = false;
    this.scene.add(this.char.root);
    G.seed = seed;
    this.built = true;
  },

  // ── Ovládání ──
  bindInput() {
    const cv = $('#gl');
    cv.addEventListener('click', () => { if (this.playing && !UI.invOpen && !Player.P.dead && $('#overlay').hidden) this.lock(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === cv;
      Player.locked = this.locked;
      if (!this.locked && this.playing && !UI.invOpen && !Player.P.dead && $('#overlay').hidden && !this._quiet) UI.pause();
      if (this.locked) UI.hud();
      this._quiet = false;
    });
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      const s = 0.0022 * SAVE.settings.sens, P = Player.P;
      P.yaw -= e.movementX * s; P.pitch = clamp(P.pitch - e.movementY * s, -1.5, 1.5);
    });
    document.addEventListener('mousedown', e => {
      if (!this.locked) return;
      if (e.button === 0) Player.mouse.l = true;
      if (e.button === 2) Player.use(this.env);
    });
    document.addEventListener('mouseup', e => { if (e.button === 0) Player.mouse.l = false; });
    document.addEventListener('wheel', e => { if (!this.locked) return; const P = Player.P; P.sel = (P.sel + (e.deltaY > 0 ? 1 : -1) + HOTBAR) % HOTBAR; UI.renderHotbar(); });
    window.addEventListener('keydown', e => {
      if (!this.playing) return;
      if (e.code === 'Tab') { e.preventDefault(); if (!Player.P.dead) UI.toggleInv(); return; }
      if (e.code === 'Escape' && UI.invOpen) { UI.toggleInv(false, null, false); return; }
      // Esc mimo zamčenou myš (po zavření inventáře) otevře menu
      if (e.code === 'Escape' && !this.locked && !Player.P.dead && $('#screen').hidden && $('#overlay').hidden) { UI.pause(); return; }
      if (!this.locked) return;
      Player.keys.add(e.code);
      if (e.code === 'KeyE') Player.interact(this.env);
      if (e.code === 'KeyV') this.toggleView();
      const n = '123456'.indexOf(e.key);
      if (n >= 0) { Player.P.sel = n; UI.renderHotbar(); }
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', e => Player.keys.delete(e.code));
    window.addEventListener('blur', () => { Player.keys.clear(); Player.mouse.l = false; });
    window.addEventListener('beforeunload', () => this.save());
  },
  toggleView() {
    SAVE.settings.view = this.third ? 1 : 3;
    persist();
    UI.msg(this.third ? L('Pohled z třetí osoby', 'Third-person view') : L('Pohled z první osoby', 'First-person view'));
  },
  setLook(look) { SAVE.settings.look = look; persist(); if (this.char) this.char.setLook(look); },
  lock() { UI.hideScreen(); UI.hideOverlay(); Sound.init(); const cv = $('#gl'); if (cv.requestPointerLock) cv.requestPointerLock(); UI.hud(); },
  unlock(quiet) { this._quiet = !!quiet; Player.keys.clear(); Player.mouse.l = false; if (document.exitPointerLock) document.exitPointerLock(); },

  // prostředí pro hráče
  env: {
    get mode() { return G.mode; }, get night() { return Game.nightF || 0; }, get scene() { return Game.scene; },
    hurt: (d, src, silent) => Game.hurt(d, src, silent),
    sound: n => Sound.play[n](), msg: t => UI.msg(t), gain: (id, n) => { UI.gain(id, n); if (id === 'hide') G.flags.hide = true; if (id === 'ironOre') G.flags.ore = true; Game.checkAch(); },
    invChanged: () => UI.renderHotbar(), openCraft: t => UI.toggleInv(true, t), sleep: s => Game.sleep(s), escape: s => Game.askEscape(s), shake: v => { G.shake = Math.max(G.shake, v); },
  },

  // ── Nová hra / pokračování ──
  startNew(mode, seedTxt) {
    Sound.init();
    let seed = parseInt(seedTxt, 10);
    if (!seedTxt || isNaN(seed)) seed = seedTxt ? [...seedTxt].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) : (Math.random() * 1e9) | 0;
    this.built = false;
    this.buildWorld(seed);
    Object.assign(G, { mode, hour: 8, day: 1, flags: {}, won: false });
    Player.init();
    Inv.reset();
    Player.spawnOnBeach(mulberry32(seed + 3));
    SAVE.stats.worlds++;
    this.playing = true; this.playStart();
    this.save();
    UI.msg(L('Probudil ses na pláži. Musíš přežít.', 'You wake up on a beach. You must survive.'));
  },
  continueGame() {
    const W = SAVE.world;
    if (!W) return;
    Sound.init();
    this.built = G.seed === W.seed && this.built;
    this.buildWorld(W.seed);
    Object.assign(G, { mode: W.mode, hour: W.hour, day: W.day, flags: W.flags || {}, won: false });
    Player.init();
    Object.assign(Player.P, W.P);
    Inv.slots = W.inv.concat(new Array(INV_SIZE).fill(null)).slice(0, INV_SIZE);
    for (const s of W.structures) World.addStructure(s.type, s.x, s.z, s.rot);
    for (const [k, list] of Object.entries(W.dead || {})) for (const [i, left] of list) { const o = World.nodes[k][i]; if (o) { o.alive = false; o.respawn = left; World.refreshNode(o); } }
    this.playing = true; this.playStart();
  },
  playStart() {
    UI.hideScreen(); UI.hud();
    Animals.clear();
    this.lock();
  },
  save() {
    if (!this.playing || G.won || (Player.P.dead && MODES[G.mode].perma)) { persist(); return; }
    const dead = {};
    for (const k in World.nodes) { const l = World.nodes[k].filter(o => !o.alive).map(o => [o.i, Math.round(o.respawn)]); if (l.length) dead[k] = l; }
    const P = Player.P;
    SAVE.world = {
      seed: G.seed, mode: G.mode, hour: G.hour, day: G.day, flags: G.flags,
      P: { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: P.pitch, hp: Math.max(1, P.hp), hunger: P.hunger, thirst: P.thirst, warmth: P.warmth, stamina: P.stamina, armor: P.armor, spawn: P.spawn, sel: P.sel },
      inv: Inv.slots, structures: World.structures.filter(s => s.type !== 'raft').map(s => ({ type: s.type, x: s.x, z: s.z, rot: s.rot })), dead,
    };
    persist();
  },
  toMenu() {
    this.playing = false;
    if (this.char) this.char.root.visible = false;
    UI.hideOverlay(); if (UI.invOpen) { UI.invOpen = false; $('#inv').hidden = true; }
    this.unlock(true);
    // vyčistit stavby (menu ukazuje čistý ostrov)
    for (const s of World.structures.slice()) World.removeStructure(s);
    Animals.clear();
    if (Player.ghost) { this.scene.remove(Player.ghost); Player.ghost = null; Player.ghostType = null; }
    UI.menu();
  },

  // ── Zranění a smrt ──
  hurt(d, src, silent) {
    const P = Player.P;
    if (P.dead || G.won) return;
    if (P.armor && src) d *= 0.65;
    P.hp -= d;
    if (!silent || d > 3) { UI.hurt(Math.min(0.8, 0.25 + d / 25)); Sound.play.hurt(); G.shake = Math.max(G.shake, 0.35); }
    if (src && src.mesh) Sound.play.growl();
    if (P.hp <= 0) this.die();
  },
  die() {
    const P = Player.P;
    P.hp = 0; P.dead = true;
    SAVE.stats.deaths++;
    Sound.play.death();
    this.unlock(true);
    const M = MODES[G.mode];
    if (M.perma) {
      const days = G.day;
      SAVE.world = null; persist();
      UI.overlay(`<div class="end lose"><h1>${L('Ostrov tě pohltil', 'The Island Claimed You')}</h1><p>${L(`Přežil jsi ${days} ${plural(days, 'den', 'dny', 'dní')}.`, `You survived ${days} day${days > 1 ? 's' : ''}.`)}</p><div class="row"><button class="btn primary" data-act="toMenu">${L('Do menu', 'Main menu')}</button></div></div>`);
    } else {
      UI.overlay(`<div class="end lose"><h1>${L('Upadl jsi do bezvědomí', 'You Passed Out')}</h1><p>${M.dropInv ? L('Tvůj inventář je pryč. Probudíš se u přístřešku nebo na pláži.', 'Your inventory is lost. You will wake at your shelter or on the beach.') : L('Probudíš se u přístřešku nebo na pláži.', 'You will wake at your shelter or on the beach.')}</p><div class="row"><button class="btn primary" data-act="respawn">${L('Probudit se', 'Wake up')}</button></div></div>`);
    }
  },
  respawn() {
    const P = Player.P, sp = P.spawn || { x: 0, z: 0 };
    if (MODES[G.mode].dropInv) Inv.reset();
    Object.assign(P, { x: sp.x + 1.5, z: sp.z + 1.5, hp: 60, hunger: Math.max(P.hunger, 50), thirst: Math.max(P.thirst, 50), warmth: 70, stamina: 100, dead: false, vy: 0 });
    P.y = World.height(P.x, P.z);
    for (const a of Animals.list.filter(a => a.type === 'wolf')) Animals.remove(a);
    if (G.hour >= 20 || G.hour < 5.5) { G.hour = 6; G.day++; }
    UI.hideOverlay(); UI.renderHotbar();
    this.save();
    this.lock();
  },

  // ── Spánek a útěk ──
  sleep(s) {
    if (!(G.hour >= 19.5 || G.hour < 5)) { UI.msg(L('Ještě není čas spát. Přespat lze jen v noci.', "It's not time to sleep yet. You can only sleep at night.")); return; }
    if (Animals.list.some(a => a.type === 'wolf' && a.state === 'chase' && !a.dead)) { UI.msg(L('Nemůžeš spát, když tě loví vlci!', "You can't sleep while wolves hunt you!")); return; }
    const P = Player.P;
    this.unlock(true);
    $('#fade').classList.add('on');
    Sound.play.sleep();
    setTimeout(() => {
      if (G.hour >= 19.5) G.day++;
      G.hour = 6.2;
      P.hunger = Math.max(5, P.hunger - 22); P.thirst = Math.max(5, P.thirst - 25); P.hp = Math.min(100, P.hp + 35); P.warmth = 70;
      P.spawn = { x: s.x, z: s.z };
      G.flags.slept = true;
      for (const a of Animals.list.filter(a => a.type === 'wolf')) Animals.remove(a);
      this.newDay();
      this.save();
      $('#fade').classList.remove('on');
      UI.msg(L(`Den ${G.day}. Vyspal ses do růžova.`, `Day ${G.day}. You wake up refreshed.`));
      this.lock();
    }, 2200);
  },
  askEscape(s) {
    this.raft = s;
    this.unlock(true);
    UI.overlay(`<div class="end"><h1>${L('Vyplout na moře?', 'Set Sail?')}</h1><p>${L('Vor je připravený. Až vyplouváš, není cesty zpět.', 'The raft is ready. Once you sail, there is no way back.')}</p><div class="row"><button class="btn" data-act="escapeNo">${L('Ještě ne', 'Not yet')}</button><button class="btn primary" data-act="escapeYes">${icon('raft')} ${L('Vyplout', 'Set sail')}</button></div></div>`);
  },
  victory() {
    G.won = true;
    UI.hideOverlay();
    SAVE.stats.escapes++;
    if (G.mode === 'harsh') SAVE.stats.hardEscapes++;
    if (G.day <= 5) SAVE.stats.fastEscape = 1;
    SAVE.world = null;
    this.checkAch();
    persist();
    Sound.play.victory();
    this.cine = { t: 0, s: this.raft };
    $('#hud').hidden = true;
    setTimeout(() => UI.overlay(`<div class="end win"><h1>${L('Unikl jsi z ostrova', 'You Escaped the Island')}</h1><p>${L(`Po ${G.day} ${plural(G.day, 'dni', 'dnech', 'dnech')} na ostrově tě vlny nesou k obzoru.`, `After ${G.day} day${G.day > 1 ? 's' : ''} on the island, the waves carry you to the horizon.`)}</p><p class="muted">${MODES[G.mode].name}</p><div class="row"><button class="btn primary" data-act="toMenu">${L('Do menu', 'Main menu')}</button></div></div>`), 5500);
  },

  newDay() {
    if (G.day > SAVE.stats.bestDays) SAVE.stats.bestDays = G.day;
    this.checkAch();
  },
  checkAch() {
    for (const a of ACHIEVEMENTS) {
      if (SAVE.achievements[a.id]) continue;
      const [v, m] = a.prog(SAVE);
      if (v >= m) { SAVE.achievements[a.id] = Date.now(); UI.toast(a); Sound.play.achieve(); }
    }
  },

  // postava hráče (viditelná ve 3. osobě; stejná třída poslouží spoluhráčům)
  updateChar(dt) {
    const P = Player.P, c = this.char;
    c.root.visible = this.third && !P.dead;
    if (!c.root.visible) return;
    const sp = Math.hypot(P.vx || 0, P.vz || 0);
    // ve 3. osobě se postava natáčí do směru chůze, při práci k cíli
    const want = P.swing > 0 || Player.ghost || sp < 0.5 ? P.yaw : Math.atan2(-P.vx, -P.vz);
    let d = want - c.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    c.yaw += d * Math.min(1, dt * 10);
    c.root.position.set(P.x, P.y, P.z);
    const s = Player.sel();
    c.setState({ moving: sp > 0.5, sprint: P.sprint, onGround: P.onGround, swim: P.swim, swing: P.swing, item: s ? s.id : null });
    c.update(dt);
  },

  // ── Smyčka ──
  loop(ms) {
    requestAnimationFrame(t => this.loop(t));
    const dt = Math.min(0.05, (ms - this.last) / 1000 || 0.016); this.last = ms;
    const t = ms / 1000;
    const P = Player.P;
    let cx, cz;
    if (this.cine) {
      // únikový záběr: vor odplouvá, kamera se zvedá
      const c = this.cine; c.t += dt;
      const s = c.s;
      const dir = Math.atan2(s.z, s.x);
      s.x += Math.cos(dir) * dt * 3; s.z += Math.sin(dir) * dt * 3;
      s.mesh.position.set(s.x, 0.1 + Math.sin(t * 1.5) * 0.15, s.z);
      s.mesh.rotation.z = Math.sin(t * 1.1) * 0.05;
      this.char.root.visible = true;
      this.char.root.position.set(s.x, s.mesh.position.y + 0.42, s.z);
      this.char.yaw = -dir - Math.PI / 2;
      this.char.setState({ moving: false, swim: false, onGround: true, swing: 0, item: null });
      this.char.update(dt);
      const back = 12 + c.t * 4;
      this.cam.position.set(s.x - Math.cos(dir) * back, 4 + c.t * 2.5, s.z - Math.sin(dir) * back);
      this.cam.lookAt(s.x, 1, s.z);
      cx = s.x; cz = s.z;
      G.hour = Math.min(G.hour + dt * 0.3, 19.2);
    } else if (this.playing && !P.dead && !G.won) {
      const running = this.locked && $('#fade').className !== 'on';
      if (running) {
        G.hour += dt * 24 / 600;
        if (G.hour >= 24) { G.hour -= 24; G.day++; this.newDay(); UI.msg(L(`Den ${G.day}`, `Day ${G.day}`)); }
        if (G.hour > 20 && G.hour - dt * 24 / 600 <= 20) { Sound.play.howl(); UI.msg(L('Padá noc. Vlci vycházejí na lov…', 'Night falls. The wolves come out to hunt…')); }
        Player.update(dt, this.cam, this.env);
        Animals.populate(P.x, P.z, this.nightF > 0.5, G.day, G.mode);
        Animals.update(dt, P, this.nightF > 0.5, (d, a) => this.hurt(d, a));
        World.updateNodes(dt);
        SAVE.stats.time += dt;
        this.saveT += dt;
        if (this.saveT > 30) { this.saveT = 0; this.save(); }
        if (Math.random() < dt) this.checkAch();
      }
      // otřes kamery
      if (G.shake > 0) { this.cam.rotation.x += rand(-1, 1) * G.shake * 0.02; this.cam.rotation.y += rand(-1, 1) * G.shake * 0.02; G.shake = Math.max(0, G.shake - dt * 2.5); }
      cx = P.x; cz = P.z;
      this.updateChar(dt);
      UI.updateHud(P);
      const h = $('#hurt'); h.style.opacity = Math.max(0, parseFloat(h.style.opacity || 0) - dt * 1.2) + (P.hp < 25 ? 0.25 + Math.sin(t * 5) * 0.1 : 0);
    } else {
      // menu: kamera krouží kolem ostrova
      G.menuT += dt * 0.03;
      const a = G.menuT;
      this.cam.position.set(Math.cos(a) * 175, 42 + Math.sin(a * 2) * 6, Math.sin(a) * 175);
      this.cam.lookAt(0, 8, 0);
      if (!this.playing) G.hour = 16.6 + Math.sin(G.menuT * 0.5) * 1.6;
      cx = this.cam.position.x * 0.5; cz = this.cam.position.z * 0.5;
    }
    const L0 = World.setTime(G.hour, cx, cz);
    this.nightF = L0.night;
    World.updateWater(t, this.playing ? cx : 0, this.playing ? cz : 0);
    World.updateStructures(t);
    for (const c of World.clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 400) c.position.x = -400; }
    Particles.update(dt);
    // pochodeň
    this.torchLight.intensity = P.torch && this.playing ? 1.8 + Math.sin(t * 17) * 0.2 + Math.sin(t * 7) * 0.15 : 0;
    // zvuková kulisa
    if (Sound.ready) {
      const shore = this.playing ? clamp(1 - Math.abs(World.height(cx, cz)) / 6, 0, 1) : 0.6;
      const fire = this.playing ? World.structures.filter(s => s.type === 'campfire').reduce((m, s) => Math.max(m, clamp(1 - Math.hypot(s.x - cx, s.z - cz) / 14, 0, 1)), 0) : 0;
      Sound.ambience({ wind: clamp((P.y || 0) / 30, 0, 1) + 0.2, ocean: shore, fire, birds: this.playing ? L0.day : 0.5, crickets: L0.night, night: L0.night, under: this.cam.position.y < World.waterLevelAt(this.cam.position.x, this.cam.position.z) ? 1 : 0 });
    }
    // render
    const r = this.renderer;
    r.autoClear = true;
    r.render(this.scene, this.cam);
    if (this.playing && !P.dead && !this.cine && !this.third) {
      ViewModel.update(dt, P, this.cam.aspect, t);
      ViewModel.hemi.intensity = 0.2 + 0.7 * L0.day + (P.torch ? 0.6 : 0); ViewModel.dl.intensity = 0.1 + 0.7 * L0.day;
      r.autoClear = false; r.clearDepth();
      r.render(ViewModel.scene, ViewModel.cam);
    }
  },
};

window.addEventListener('DOMContentLoaded', () => Game.init());
