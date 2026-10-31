'use strict';
// ── Inventář ────────────────────────────────────────────────────────────────
const INV_SIZE = 32, HOTBAR = 8;
const Inv = {
  slots: new Array(INV_SIZE).fill(null),
  reset() { this.slots = new Array(INV_SIZE).fill(null); },
  count(id) { return this.slots.reduce((s, x) => s + (x && x.id === id ? x.n : 0), 0); },
  add(id, n = 1, extra) {
    const it = ITEMS[id];
    if (it.stack > 1) for (const s of this.slots) { if (n <= 0) break; if (s && s.id === id && s.n < it.stack) { const k = Math.min(n, it.stack - s.n); s.n += k; n -= k; } }
    for (let i = 0; i < INV_SIZE && n > 0; i++) {
      if (this.slots[i]) continue;
      const k = Math.min(n, it.stack);
      this.slots[i] = Object.assign({ id, n: k }, it.tool ? { dur: it.tool.dur } : {}, it.charges ? { ch: it.charges } : {}, extra || {});
      n -= k;
    }
    return n;
  },
  remove(id, n) {
    for (let i = INV_SIZE - 1; i >= 0 && n > 0; i--) { const s = this.slots[i]; if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) this.slots[i] = null; } }
  },
  canCraft(r) { return Object.entries(r.cost).every(([id, n]) => this.count(id) >= n); },
  swap(a, b) { [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]]; },
};

// ── Hráč ────────────────────────────────────────────────────────────────────
const EYE = 1.65;
const Player = {
  P: null, keys: new Set(), mouse: { l: false, r: false }, locked: false,
  target: null, ray: new THREE.Raycaster(), ghost: null, ghostOk: false, ghostType: null,
  init() {
    this.P = { x: 0, y: 0, z: 0, vy: 0, yaw: 0, pitch: 0, onGround: true, hp: 100, hunger: 100, thirst: 100, warmth: 90, stamina: 100, armor: false,
      inWater: false, swim: false, sel: 0, swing: 0, cd: 0, dead: false, spawn: null, torch: false, bob: 0, hurtT: 0, moving: false,
      skills: { gather: { l: 1, x: 0 }, hunt: { l: 1, x: 0 }, survive: { l: 1, x: 0 } }, buffs: {}, wet: 0, draw: 0, rainT: 0 };
    this.reel(false);
    this.ghostRot = 0;
  },
  sel() { return Inv.slots[this.P.sel]; },
  selItem() { const s = this.sel(); return s ? ITEMS[s.id] : null; },

  spawnOnBeach(rnd) {
    for (let t = 0; t < 2000; t++) {
      const a = rnd() * Math.PI * 2, d = ISLAND_R * (0.6 + rnd() * 0.4);
      const x = Math.cos(a) * d, z = Math.sin(a) * d, h = World.height(x, z);
      if (h > 0.8 && h < 2.2) { this.P.x = x; this.P.z = z; this.P.y = h; this.P.yaw = Math.atan2(-x, -z) + Math.PI; this.P.spawn = { x, z }; return; }
    }
    this.P.x = 0; this.P.z = 0; this.P.y = World.height(0, 0);
  },

  update(dt, cam, env) {
    const P = this.P;
    if (P.dead) return;
    const k = this.keys;
    // pohyb
    let mx = 0, mz = 0;
    if (k.has('KeyW')) mz -= 1; if (k.has('KeyS')) mz += 1; if (k.has('KeyA')) mx -= 1; if (k.has('KeyD')) mx += 1;
    const ml = Math.hypot(mx, mz); if (ml) { mx /= ml; mz /= ml; }
    const ground = World.height(P.x, P.z);
    const wl = World.waterLevelAt(P.x, P.z);
    P.inWater = ground < wl - 0.4;
    P.swim = ground < wl - 1.35;
    if (!ml) this.sprintOn = false;
    const sprint = (SAVE.settings.toggleSprint ? this.sprintOn : k.has('ShiftLeft')) && P.stamina > 1 && ml > 0 && !P.swim;
    let speed = P.swim ? 3 : P.inWater ? 3.6 : sprint ? 8.6 : 5.2;
    const arm = armorOf(P);
    if (arm) speed *= arm.speed;
    if (P.draw > 0) speed *= 0.55;
    const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
    const vx = (mx * cos + mz * sin) * speed, vz = (-mx * sin + mz * cos) * speed;
    let nx = P.x + vx * dt, nz = P.z + vz * dt;
    // kolize se stromy, skalami a stavbami
    for (const o of World.solidsNear(nx, nz)) {
      const r = NODES[o.type].r * o.s + 0.35, dx = nx - o.x, dz = nz - o.z, d = Math.hypot(dx, dz);
      if (d < r && d > 0.0001) { nx = o.x + dx / d * r; nz = o.z + dz / d * r; }
    }
    for (const s of World.structures) {
      if (!STRUCTURES[s.type].solid) continue;
      const r = STRUCTURES[s.type].r + 0.35, dx = nx - s.x, dz = nz - s.z, d = Math.hypot(dx, dz);
      if (d < r && d > 0.0001) { nx = s.x + dx / d * r; nz = s.z + dz / d * r; }
    }
    // příliš strmý svah
    const nh = World.height(nx, nz);
    if (nh - ground > 0.9 * Math.max(dt * 10, 0.1) && P.onGround) { nx = P.x; nz = P.z; }
    // hranice světa
    const rr = Math.hypot(nx, nz); if (rr > HALF - 20) { nx *= (HALF - 20) / rr; nz *= (HALF - 20) / rr; }
    if (ml) runBump('dist', Math.hypot(nx - P.x, nz - P.z));
    P.x = nx; P.z = nz;
    P.moving = ml > 0;
    // vertikála
    const g = World.height(P.x, P.z);
    if (P.swim) {
      const target = wl - 1.25;
      P.y += (target - P.y) * Math.min(1, dt * 4); P.vy = 0; P.onGround = false;
      if (k.has('Space')) P.y += dt * 2;
    } else {
      P.vy -= 22 * dt;
      P.y += P.vy * dt;
      if (P.y <= g) { if (P.vy < -14) env.hurt((-P.vy - 14) * 4, null); P.y = g; P.vy = 0; P.onGround = true; } else P.onGround = P.y - g < 0.05;
      if (k.has('Space') && P.onGround && P.stamina > 8) { P.vy = 7.6; P.onGround = false; P.stamina -= 8; env.sound('jump'); }
    }
    // výdrž
    const B = P.buffs || (P.buffs = {});
    for (const k in B) { B[k] -= dt; if (B[k] <= 0) delete B[k]; }
    if (sprint) P.stamina = Math.max(0, P.stamina - 20 * dt);
    else if (P.swim && ml) P.stamina = Math.max(0, P.stamina - 5 * dt);
    else P.stamina = Math.min(100, P.stamina + 16 * dt * (B.fed ? 1.35 : 1) * (P.warmth < 30 ? 0.6 : 1));
    if (P.swim && P.stamina <= 0) env.hurt(4 * dt, null, true);
    // kroky
    if (ml && P.onGround) {
      const pb = P.bob; P.bob += dt * (sprint ? 11 : 8);
      if (Math.floor(pb / Math.PI) !== Math.floor(P.bob / Math.PI)) {
        const surf = this.surface();
        if (P.inWater) env.sound('splash'); else Sound.play.step(surf);
        if (surf === 'sand' && (sprint || Math.random() < 0.4)) FX.puff(P.x, P.y, P.z, '#e2d09c', sprint ? 4 : 2);
        else if (P.inWater) FX.puff(P.x, World.waterLevelAt(P.x, P.z), P.z, '#e8f4f8', 3, 0.3);
      }
    }
    else if (ml && P.swim) { const pb = P.bob; P.bob += dt * 4; if (Math.floor(pb / Math.PI) !== Math.floor(P.bob / Math.PI)) env.sound('swim'); }
    // kamera
    P.vx = vx; P.vz = vz; P.sprint = sprint;
    this.camExtra = CameraRig.place(cam, P, Game.third, dt, ml && P.onGround && SAVE.settings.bob !== false ? Math.abs(Math.sin(P.bob)) * 0.06 : 0);
    // potřeby
    const M = MODES[env.mode], drain = M.drain * (sprint ? 1.6 : 1) * Skills.drainMul();
    P.hunger = Math.max(0, P.hunger - dt * 0.2 * drain * (B.fed ? 0.5 : 1));
    P.thirst = Math.max(0, P.thirst - dt * 0.27 * drain);
    // mokro: plavání a déšť pod širým nebem; u ohně a v přístřešku rychle schne
    let nearFire = false;
    for (const s of World.structures) { const w = STRUCTURES[s.type].warmth; if (w && s.type !== 'shelter' && Math.hypot(s.x - P.x, s.z - P.z) < w) nearFire = true; }
    const exposed = Weather.exposed(P);
    if (P.inWater) P.wet = 1;
    else if (exposed) P.wet = Math.min(1, P.wet + dt * 0.06 * Weather.cur.rain);
    else P.wet = Math.max(0, P.wet - dt * (nearFire ? 0.12 : 0.012));
    // déšť pomalu plní měchy
    if (exposed) { P.rainT += dt * Weather.cur.rain; if (P.rainT > 20) { P.rainT = 0; let f = false; for (const x of Inv.slots) if (x && x.id === 'waterskin' && x.ch < ITEMS.waterskin.charges) { x.ch++; f = true; } if (f) { env.invChanged(); UI.notify(`${icon('water')} ${L('Déšť doplnil měch', 'The rain refilled your waterskin')}`); } } }
    let warmTarget = 85 - env.night * (arm ? arm.cold : 62) - P.wet * 22;
    if (P.inWater) warmTarget -= 25;
    for (const s of World.structures) { const w = STRUCTURES[s.type].warmth; if (w && Math.hypot(s.x - P.x, s.z - P.z) < w) warmTarget = Math.max(warmTarget, s.type === 'shelter' ? 70 : 100); }
    if (P.torch) warmTarget += 12;
    warmTarget = clamp(warmTarget, 0, 100);
    P.warmth += (warmTarget - P.warmth) * Math.min(1, dt * 0.12);
    let dhp = 0;
    if (P.hunger <= 0) dhp -= 0.9; if (P.thirst <= 0) dhp -= 1.1; if (P.warmth < 15) dhp -= 0.6;
    if (B.sick) dhp -= 0.18;
    if (P.hunger > 45 && P.thirst > 45 && P.warmth > 35 && !B.sick) dhp += 0.3 + (B.fed ? 0.3 : 0);
    if (dhp < 0) env.hurt(-dhp * dt, null, true); else P.hp = Math.min(100, P.hp + dhp * dt);
    // pochodeň v ruce
    const it = this.sel();
    P.torch = !!(it && it.id === 'torch');
    if (P.torch) { it.dur -= dt; if (it.dur <= 0) { Inv.slots[P.sel] = null; env.msg(L('Pochodeň dohořela', 'Your torch burned out')); } }
    // akce
    P.cd -= dt; P.swing = Math.max(0, P.swing - dt * 3.2);
    this.look(cam);
    this.updateGhost(cam, env);
    this.updateBow(dt, cam, env);
    this.updateFish(dt, cam, env);
    if (this.mouse.l && P.cd <= 0 && this.locked && !(it && it.id === 'bow')) this.primary(env);
  },
  // povrch pod nohama (zvuk kroků, prach)
  surface() {
    const P = this.P;
    if (P.inWater) return 'water';
    const h = World.height(P.x, P.z);
    if (h < 1.6) return 'sand';
    const sl = Math.abs(World.height(P.x + 1, P.z) - World.height(P.x - 1, P.z)) + Math.abs(World.height(P.x, P.z + 1) - World.height(P.x, P.z - 1));
    return h > 24 || sl > 1.3 ? 'stone' : 'grass';
  },

  // ── Luk: drž levé tlačítko pro natažení, pusť pro výstřel ──
  updateBow(dt, cam, env) {
    const P = this.P, it = this.sel();
    if (!it || it.id !== 'bow') { P.draw = 0; return; }
    if (this.mouse.l && this.locked) {
      if (!Inv.count('arrow')) { if (P.cd <= 0) { env.msg(L('Nemáš šípy. Vyrob je (Tab).', 'No arrows. Craft some (Tab).')); env.sound('error'); P.cd = 1.2; } return; }
      if (P.draw === 0) Sound.play.bowDraw();
      P.draw = Math.min(1, P.draw + dt / (0.85 * Skills.quick()));
    } else if (P.draw > 0) {
      if (P.draw > 0.15 && Inv.count('arrow')) {
        const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
        const o = Game.third ? new THREE.Vector3(P.x, P.y + EYE, P.z).addScaledVector(dir, 0.6) : cam.position.clone().addScaledVector(dir, 0.5);
        Projectiles.fire(o, dir, 16 + 36 * P.draw, (8 + 30 * P.draw) * Skills.huntMul());
        Inv.remove('arrow', 1);
        this.wear(it, env);
        Sound.play.bowShot();
        P.swing = 0.35;
        env.invChanged();
      }
      P.draw = 0;
    }
  },

  // ── Rybaření: nahodit, počkat na záběr, seknout ──
  castPoint(cam) {
    const P = this.P, dir = new THREE.Vector3(), org = cam.position;
    cam.getWorldDirection(dir);
    if (dir.y > -0.02) return null;
    for (const lvl of [0, ...World.ponds.map(p => p.level)]) {
      const t = (lvl - org.y) / dir.y;
      if (t < 2 || t > 16 + (this.camExtra || 0)) continue;
      const x = org.x + dir.x * t, z = org.z + dir.z * t, fresh = World.isFreshWater(x, z);
      if (World.height(x, z) < lvl - 0.4 && (lvl === 0 ? !fresh : !!fresh) && Math.hypot(x - P.x, z - P.z) < 15) return { x, y: lvl, z, fresh: !!fresh };
    }
    return null;
  },
  reel(clean = true) {
    const F = this.fish;
    if (F && Game.scene) { Game.scene.remove(F.mesh); Game.scene.remove(F.line); }
    this.fish = null;
    if (clean) Sound.play.reel();
  },
  cast(cam, env) {
    const c = this.castPoint(cam);
    if (!c) { env.msg(L('Nahoď do vody – do moře nebo do jezírka.', 'Cast into water – the sea or a pond.')); env.sound('error'); return; }
    const bob = new THREE.Mesh(mergeParts([[T(new THREE.IcosahedronGeometry(0.07, 0), 0, 0.04, 0), '#e04040'], [T(new THREE.IcosahedronGeometry(0.06, 0), 0, -0.02, 0), '#f4f0e8']]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, flatShading: true }));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xf0f0e0, transparent: true, opacity: 0.7 }));
    line.frustumCulled = false;
    Game.scene.add(bob, line);
    // za soumraku a za úsvitu berou ryby rychleji
    const dusk = (G.hour > 17.5 && G.hour < 20.5) || (G.hour > 5 && G.hour < 7.5) ? 0.65 : 1;
    this.fish = { x: c.x, y: c.y, z: c.z, fresh: c.fresh, state: 'wait', t: rand(3.5, 9) * Skills.quick() * dusk, mesh: bob, line, ph: Math.random() * 6 };
    Sound.play.cast();
    setTimeout(() => { if (this.fish && this.fish.mesh === bob) { Sound.play.plop(); FX.puff(c.x, c.y, c.z, '#e8f4f8', 6, 0.2); } }, 350);
  },
  strike(env) {
    const F = this.fish, P = this.P;
    if (!F) return;
    if (F.state !== 'bite') { env.msg(L('Moc brzy! Počkej, až se splávek potopí.', 'Too soon! Wait for the float to dip.')); this.reel(); return; }
    const r = Math.random();
    const catchId = F.fresh ? (r < 0.92 ? 'rawFish' : 'fiber') : (r < 0.84 ? 'rawFish' : r < 0.9 ? 'rope' : r < 0.95 ? 'wood' : 'iron');
    const n = catchId === 'rawFish' && Math.random() < 0.15 + Skills.lvl('hunt') * 0.02 ? 2 : 1;
    const left = Inv.add(catchId, n);
    if (left < n) env.gain(catchId, n - left);
    if (left > 0) Drops.put({ id: catchId, n: left }, P.x, P.z);
    if (catchId === 'rawFish') { SAVE.stats.fish = (SAVE.stats.fish || 0) + 1; runBump('fish'); Skills.add('hunt', 8); }
    Sound.play.catchFish();
    FX.puff(F.x, F.y, F.z, '#e8f4f8', 10, 0.3);
    this.wear(this.sel(), env);
    this.reel(false);
    env.invChanged();
    Game.checkAch();
    Story.update();
  },
  updateFish(dt, cam, env) {
    const F = this.fish, P = this.P;
    if (!F) return;
    const s = this.sel();
    if (!s || s.id !== 'fishingRod' || P.dead || P.swim || Math.hypot(F.x - P.x, F.z - P.z) > 18) { this.reel(false); return; }
    F.t -= dt; F.ph += dt;
    if (F.state === 'wait' && F.t <= 0) { F.state = 'bite'; F.t = 1.0; Sound.play.bite(); FX.puff(F.x, F.y, F.z, '#e8f4f8', 5, 0.15); env.msg(L('Záběr! Sekni (levé tlačítko)!', 'A bite! Strike (left button)!')); }
    else if (F.state === 'bite' && F.t <= 0) { F.state = 'wait'; F.t = rand(3, 8) * Skills.quick(); env.msg(L('Ryba utekla…', 'The fish got away…')); }
    const dip = F.state === 'bite' ? -0.1 + Math.sin(F.ph * 28) * 0.05 : Math.sin(F.ph * 2.6) * 0.03;
    F.mesh.position.set(F.x, F.y + 0.05 + dip, F.z);
    // vlasec od špičky prutu ke splávku
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const right = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const tip = Game.third ? new THREE.Vector3(P.x, P.y + 2.3, P.z).addScaledVector(dir, 1.1) : cam.position.clone().addScaledVector(dir, 1.3).addScaledVector(right, 0.35).add(new THREE.Vector3(0, 0.45, 0));
    const a = F.line.geometry.attributes.position;
    a.setXYZ(0, tip.x, tip.y, tip.z); a.setXYZ(1, F.mesh.position.x, F.mesh.position.y + 0.08, F.mesh.position.z); a.needsUpdate = true;
  },

  // na co hráč kouká
  look(cam) {
    const ray = this.ray, P = this.P;
    ray.setFromCamera({ x: 0, y: 0 }, cam);
    const it = this.selItem();
    const reach = it && it.tool ? it.tool.reach : 2.8;
    // ve 3. osobě je kamera za hráčem – dosah se měří od hráče
    const extra = this.camExtra || 0;
    ray.far = reach + 0.4 + extra;
    const objs = [];
    for (const k in World.meshes) objs.push(World.meshes[k]);
    for (const a of Animals.list) if (!a.dead && Math.hypot(a.x - P.x, a.z - P.z) < 8) objs.push(a.mesh);
    for (const s of World.structures) if (Math.hypot(s.x - P.x, s.z - P.z) < 8) objs.push(s.mesh);
    for (const d of Drops.list) if (Math.hypot(d.x - P.x, d.z - P.z) < 8) objs.push(d.mesh);
    for (const st of Sites.near(P)) objs.push(st.mesh);
    objs.push(World.terrain);
    const hits = ray.intersectObjects(objs, true);
    this.target = null;
    const eye = new THREE.Vector3(P.x, P.y + EYE, P.z);
    for (const h of hits) {
      let o = h.object;
      if (extra && (h.distance < extra * 0.8 || h.point.distanceTo(eye) > reach + 0.6)) { if (o === World.terrain) break; continue; }
      if (o === World.terrain) break;
      if (o.isInstancedMesh && o.userData.kind) {
        const node = World.nodes[o.userData.kind][h.instanceId];
        if (node && node.alive) { this.target = { kind: 'node', node, point: h.point, dist: h.distance }; break; }
        continue;
      }
      while (o && !o.userData.animal && !o.userData.structure && !o.userData.drop && !o.userData.site) o = o.parent;
      if (!o) continue;
      if (o.userData.site) { this.target = { kind: 'site', site: o.userData.site, point: h.point, dist: h.distance }; break; }
      if (o.userData.drop) { this.target = { kind: 'drop', d: o.userData.drop, point: h.point, dist: h.distance }; break; }
      if (o.userData.animal) { this.target = { kind: 'animal', a: o.userData.animal, point: h.point, dist: h.distance }; break; }
      if (o.userData.structure) { this.target = { kind: 'structure', s: o.userData.structure, point: h.point, dist: h.distance }; break; }
    }
    if (!this.target) {
      // voda pod pohledem
      const dir = ray.ray.direction, org = ray.ray.origin;
      if (dir.y < -0.05) {
        for (const lvl of [World.waterLevelAt(P.x, P.z), 0, ...World.ponds.map(p => p.level)]) {
          const t = (lvl - org.y) / dir.y;
          if (t > extra && t < 3.6 + extra) {
            const x = org.x + dir.x * t, z = org.z + dir.z * t;
            const fresh = World.isFreshWater(x, z);
            if (World.height(x, z) < lvl - 0.05 && (lvl === 0 ? !fresh : fresh)) { this.target = { kind: 'water', fresh: !!fresh, point: new THREE.Vector3(x, lvl, z) }; break; }
          }
        }
      }
    }
    // předmět u nohou se dá sebrat, i když se na něj hráč přímo nedívá
    if (!this.target || this.target.kind === 'water') { const d = Drops.near(P); if (d) this.target = { kind: 'drop', d, point: d.mesh.position, dist: 1 }; }
  },

  primary(env) {
    if (this.target && this.target.kind === 'drop' && !(this.selItem() && this.selItem().place)) { env.msg(L('Stiskni E pro sebrání', 'Press E to pick up')); return; }
    const P = this.P, it = this.selItem(), slot = this.sel();
    if (it && it.place) { this.place(env); P.cd = 0.4; return; }
    if (slot && slot.id === 'fishingRod') { P.cd = 0.5; P.swing = 0.6; if (this.fish) this.strike(env); else this.cast(Game.cam, env); return; }
    const tool = it && it.tool;
    P.cd = tool ? (tool.type === 'weapon' ? 0.55 : 0.5) : 0.45;
    P.swing = 1;
    env.sound('swing');
    const t = this.target;
    if (!t) return;
    if (t.kind === 'node') {
      const n = t.node, def = NODES[n.type];
      if (def.gather) { this.gather(n, env); return; }
      if (def.needs && (!tool || tool.type !== def.needs)) { env.msg(L('Potřebuješ krumpáč', 'You need a pickaxe')); env.sound('thud'); return; }
      const right = tool && tool.type === def.tool;
      const power = right ? tool.power : def.handOk || !tool ? 1 : 1;
      if (!right && !tool && def.tool === 'axe' && Math.random() < 0.3) { env.hurt(1, null, true); env.msg(L('Au! Holýma rukama to bolí.', 'Ouch! Bare hands hurt.')); }
      n.hp -= power * (right ? Skills.gatherMul() : 1);
      Skills.add('gather', 1);
      this.wear(slot, env);
      const isWood = def.tool === 'axe';
      Particles.burst(t.point.x, t.point.y, t.point.z, isWood ? '#a87a48' : n.type === 'ironRock' ? '#c4683e' : '#9aa0a6', 7, 2.5, 3);
      env.sound(isWood ? (tool && right ? 'chop' : 'knock') : n.type === 'ironRock' ? 'mineOre' : tool && right ? 'mine' : 'knockStone');
      env.shake(0.15);
      if (n.hp <= 0) {
        n.alive = false; n.respawn = def.respawn;
        World.refreshNode(n);
        Particles.burst(n.x, n.y + 1.5, n.z, isWood ? '#4f8f3a' : '#8f949a', 22, 4, 5);
        env.sound(isWood ? 'fall' : 'crumble');
        this.giveDrops(def.drops, env, (right && tool.power >= 4 ? 1 : 0) + (Math.random() < Skills.extraChance() ? 1 : 0));
        if (isWood) { SAVE.stats.trees++; runBump('trees'); } else { SAVE.stats.rocks++; runBump('rocks'); }
        Skills.add('gather', n.type === 'ironRock' ? 8 : 4);
        Story.update();
      }
    } else if (t.kind === 'animal') {
      const dmg = (tool ? tool.dmg : 4) * rand(0.9, 1.15) * (tool && tool.type === 'weapon' ? Skills.huntMul() : 1);
      const killed = Animals.hurt(t.a, dmg);
      this.wear(slot, env);
      Particles.burst(t.point.x, t.point.y, t.point.z, '#b0303a', 9, 2.5, 2.5);
      UI.floatText(t.point, `−${Math.round(dmg)}`, killed ? 'kill' : '');
      env.sound('hit');
      env.shake(0.2);
      if (killed) Game.killed(t.a, 'melee');
    } else if (t.kind === 'structure') {
      env.msg(L('Stiskni E pro použití', 'Press E to use'));
    }
  },
  wear(slot, env) {
    if (!slot || slot.dur === undefined || slot.id === 'torch') return;
    if (Math.random() < Skills.keepChance()) return;
    slot.dur--;
    if (slot.dur <= 0) { Inv.slots[this.P.sel] = null; env.sound('break'); env.msg(L(`${ITEMS[slot.id].name} se rozbil(a)!`, `${ITEMS[slot.id].name} broke!`)); }
  },
  giveDrops(drops, env, bonus) {
    for (const [id, a, b] of drops) {
      const n = randi(a, b) + (bonus && (id === 'wood' || id === 'stone' || id === 'ironOre') ? bonus : 0);
      if (n <= 0) continue;
      const left = Inv.add(id, n);
      if (left < n) env.gain(id, n - left);
      if (left > 0) env.msg(L('Inventář je plný', 'Inventory is full'));
    }
    env.invChanged();
  },
  gather(n, env) {
    const def = NODES[n.type];
    n.alive = false; n.respawn = def.respawn;
    World.refreshNode(n);
    Particles.burst(n.x, n.y + 0.4, n.z, n.type === 'bush' ? '#e0284f' : n.type === 'pebble' ? '#9aa0a6' : '#a6cf5a', 8, 1.5, 2.5);
    env.sound('pick');
    const before = Inv.count('berries');
    this.giveDrops(def.drops, env, 0);
    runBump('berries', Math.max(0, Inv.count('berries') - before));
    Skills.add('survive', 1);
    Story.update();
  },

  interact(env) {
    const P = this.P, t = this.target;
    if (!t) return;
    if (t.kind === 'drop') { Drops.take(t.d); return; }
    if (t.kind === 'site') { Sites.interact(t.site); return; }
    if (t.kind === 'node' && NODES[t.node.type].gather) { this.gather(t.node, env); return; }
    if (t.kind === 'structure') {
      const s = t.s;
      if (s.type === 'shelter') { env.sleep(s); return; }
      if (s.type === 'raft') { env.escape(s); return; }
      if (s.type === 'chest') { UI.openChest(s); return; }
      if (s.type === 'garden') { this.tend(s, env); return; }
      env.openCraft(s.type);
      return;
    }
    if (t.kind === 'water') {
      const ws = Inv.slots.find(x => x && x.id === 'waterskin' && x.ch < ITEMS.waterskin.charges);
      if (t.fresh) {
        if (ws && P.thirst > 85) { ws.ch = ITEMS.waterskin.charges; G.flags.skin = true; env.msg(L('Měch naplněn', 'Waterskin filled')); env.sound('drink'); env.invChanged(); Story.update(); return; }
        P.thirst = Math.min(100, P.thirst + 25); env.sound('drink'); env.msg(L('Čerstvá voda', 'Fresh water')); G.flags.fresh = true;
        if (ws) { ws.ch = ITEMS.waterskin.charges; G.flags.skin = true; env.invChanged(); }
        Story.update();
      } else { P.thirst = Math.max(0, P.thirst - 4); P.hp -= 2; env.sound('drink'); env.msg(L('Slaná voda! Hledej sladkou.', 'Salt water! Find fresh water.')); }
    }
  },
  use(env, i = this.P.sel) {
    const P = this.P, s = Inv.slots[i];
    if (!s) return;
    const it = ITEMS[s.id];
    if (it.food) {
      const f = it.food;
      if (f.hunger) P.hunger = Math.min(100, P.hunger + f.hunger);
      if (f.thirst) P.thirst = Math.min(100, P.thirst + f.thirst);
      if (f.health) { if (f.health > 0) P.hp = Math.min(100, P.hp + f.health); else env.hurt(-f.health, null, true); }
      if (f.fed) { P.buffs.fed = Math.max(P.buffs.fed || 0, f.fed); env.msg(L('Jsi sytý: pomalejší hlad, rychlejší dech', 'Well fed: slower hunger, faster stamina')); }
      if (f.sick && Math.random() < 0.6) { P.buffs.sick = Math.max(P.buffs.sick || 0, f.sick); env.msg(L('Syrové jídlo ti nedělá dobře…', 'Raw food makes you feel sick…')); }
      s.n--; if (!s.n) Inv.slots[i] = null;
      env.sound(s.id === 'bandage' ? 'pick' : 'eat');
      SAVE.stats.eaten++;
      env.invChanged();
    } else if (s.id === 'waterskin') {
      if (s.ch > 0) { s.ch--; P.thirst = Math.min(100, P.thirst + 30); env.sound('drink'); env.invChanged(); }
      else env.msg(L('Měch je prázdný. Naplň ho u jezírka nebo v dešti.', 'The waterskin is empty. Fill it at a pond or in the rain.'));
    } else if (ARMORS[s.id]) {
      // obléct; dosavadní zbroj se vrátí do batohu
      const old = P.armor === true ? 'hideArmor' : P.armor;
      if (old === s.id) { env.msg(L('Už to máš na sobě', 'You are already wearing it')); return; }
      Inv.slots[i] = old ? { id: old, n: 1 } : null;
      P.armor = s.id;
      env.sound('pick');
      env.msg(s.id === 'furCoat' ? L('Kožich: −50 % poškození, teplo i v noci', 'Fur coat: −50% damage, warm even at night') : L('Kožená zbroj: −35 % poškození, víc tepla', 'Hide armor: −35% damage, more warmth'));
      env.invChanged();
    }
  },
  // F: sníst nejvhodnější jídlo nebo se napít
  quickEat(env) {
    const P = this.P;
    const thirsty = P.thirst < P.hunger;
    const skin = Inv.slots.findIndex(x => x && x.id === 'waterskin' && x.ch > 0);
    if (thirsty && skin >= 0 && P.thirst < 90) { this.use(env, skin); return; }
    const order = ['stew', 'cookedMeat', 'cookedFish', 'coconut', 'berries'];
    if (P.hp < 50) order.unshift('bandage');
    for (const id of order) { const i = Inv.slots.findIndex(x => x && x.id === id); if (i >= 0 && (P.hunger < 92 || id === 'bandage')) { this.use(env, i); return; } }
    if (skin >= 0 && P.thirst < 95) { this.use(env, skin); return; }
    env.msg(L('Nemáš nic k jídlu ani pití', 'You have nothing to eat or drink'));
  },
  // záhon: zasadit bobule, počkat, sklidit
  tend(s, env) {
    const gr = World.cropGrowth(s);
    if (gr < 0) {
      if (Inv.count('berries') < 2) { env.msg(L('Na zasazení potřebuješ 2 bobule', 'You need 2 berries to plant')); env.sound('error'); return; }
      Inv.remove('berries', 2);
      s.crop = { at: G.day * 24 + G.hour };
      G.flags.planted = true;
      Sound.play.plant();
      Particles.burst(s.x, s.y + 0.3, s.z, '#6a4a2a', 10, 1.2, 1.5);
      env.msg(L('Zasazeno. Úroda dozraje asi za den.', 'Planted. The crop ripens in about a day.'));
      Skills.add('survive', 4);
      env.invChanged(); Story.update(); Game.save();
    } else if (gr < 1) env.msg(L(`Úroda roste… ${Math.round(gr * 100)} %`, `The crop is growing… ${Math.round(gr * 100)}%`));
    else {
      s.crop = null;
      this.giveDrops([['berries', 5, 8], ['fiber', 1, 2]], env, 0);
      SAVE.stats.harvests = (SAVE.stats.harvests || 0) + 1; runBump('harvests');
      Skills.add('survive', 10);
      env.sound('pick');
      Particles.burst(s.x, s.y + 0.5, s.z, '#e0284f', 14, 1.5, 2.5);
      Game.checkAch(); Game.save();
    }
  },

  // ── Stavění ──
  updateGhost(cam, env) {
    const it = this.selItem();
    const type = it && it.place;
    if (type !== this.ghostType) {
      if (this.ghost) env.scene.remove(this.ghost);
      this.ghost = null; this.ghostType = type;
      if (type) {
        this.ghost = buildStructure(type);
        this.ghost.traverse(m => { if (m.isMesh) { m.material = new THREE.MeshBasicMaterial({ color: 0x7cf0b6, transparent: true, opacity: 0.45, depthWrite: false }); m.castShadow = false; } if (m.isLight) m.visible = false; });
        env.scene.add(this.ghost);
      }
    }
    if (!this.ghost) return;
    const P = this.P;
    const d = type === 'raft' ? 5 : type === 'shelter' ? 4 : 3;
    const x = P.x + Math.sin(P.yaw) * -d, z = P.z + Math.cos(P.yaw) * -d;
    const h = World.height(x, z);
    let ok;
    if (type === 'raft') ok = h < -0.3 && h > -4 && !World.isFreshWater(x, z);
    else {
      const sl = Math.abs(World.height(x + 1, z) - World.height(x - 1, z)) + Math.abs(World.height(x, z + 1) - World.height(x, z - 1));
      ok = h > 0.3 && sl < 1.6 && !World.isFreshWater(x, z)
        && !World.solidsNear(x, z).some(o => Math.hypot(o.x - x, o.z - z) < NODES[o.type].r * o.s + STRUCTURES[type].r)
        && !World.structures.some(s => Math.hypot(s.x - x, s.z - z) < STRUCTURES[s.type].r + STRUCTURES[type].r);
    }
    this.ghost.position.set(x, type === 'raft' ? 0.05 : h, z);
    this.ghost.rotation.y = P.yaw + this.ghostRot;
    this.ghostOk = ok; this.ghostPos = { x, z };
    this.ghost.traverse(m => { if (m.isMesh) m.material.color.set(ok ? 0x7cf0b6 : 0xff5a6e); });
  },
  place(env) {
    if (!this.ghostOk) { env.sound('error'); env.msg(this.ghostType === 'raft' ? L('Vor musíš spustit na moře u břehu', 'Launch the raft in the sea near the shore') : L('Sem to postavit nejde', "You can't build here")); return; }
    const type = this.ghostType, s = this.sel();
    s.n--; if (!s.n) Inv.slots[this.P.sel] = null;
    const st = World.addStructure(type, this.ghostPos.x, this.ghostPos.z, this.P.yaw + this.ghostRot);
    env.sound('build');
    Particles.burst(st.x, st.y + 0.3, st.z, '#c9a77a', 18, 3, 3);
    runBump('built'); Skills.add('survive', 6);
    if (type === 'raft') G.flags.raft = true;
    if (type === 'campfire') SAVE.stats.fires++;
    if (type === 'shelter') { SAVE.stats.shelters++; this.P.spawn = { x: st.x, z: st.z }; env.msg(L('Přístřešek je nyní tvým místem oživení', 'Your shelter is now your respawn point')); }
    env.invChanged();
    Story.update();
    if (type === 'raft') env.escape(st);
  },
};

// ── Model v ruce ────────────────────────────────────────────────────────────
const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const ViewModel = {
  scene: new THREE.Scene(), cam: null, holder: new THREE.Group(), cur: null, light: null,
  init() {
    this.cam = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.scene.add(this.holder);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 0.9); this.scene.add(this.hemi);
    this.dl = new THREE.DirectionalLight(0xffffff, 0.8); this.dl.position.set(1, 2, 1); this.scene.add(this.dl);
    this.holder.position.set(0.42, -0.42, -0.75);
    this.holder.scale.setScalar(0.7);
  },
  build(id) {
    if (this.cur === id) return;
    this.cur = id;
    while (this.holder.children.length) this.holder.remove(this.holder.children[0]);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true });
    const skin = '#e0b48c';
    const hand = [[T(new THREE.BoxGeometry(0.16, 0.16, 0.5), 0.05, -0.05, 0.22), skin], [T(new THREE.BoxGeometry(0.17, 0.14, 0.16), 0.02, 0.02, -0.02), skin]];
    const tool = buildToolGeo(id);
    const type = tool ? tool.type : null;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(mergeParts(hand), mat));
    if (tool) {
      const tg = tool.geo.clone();
      // hlavice nástrojů míří dopředu (ve směru úderu), oštěp leží vodorovně
      if (type === 'axe' || type === 'pick') tg.rotateY(-Math.PI / 2);
      if (type === 'weapon') { tg.rotateX(-1.42); tg.translate(-0.02, 0.02, -0.05); }
      if (type === 'rod') { tg.rotateX(-0.75); }
      g.add(new THREE.Mesh(tg, mat));
    }
    if (type === 'bow') {
      // šíp patří k držáku (míří stále dopředu), luk je natočený bokem, aby byl vidět jeho ohyb
      const ar = new THREE.Mesh(mergeParts([[T(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 4), 0, 0, -0.2, Math.PI / 2), '#c9a77a'], [T(new THREE.ConeGeometry(0.02, 0.07, 4), 0, 0, -0.58, -Math.PI / 2), '#9aa0a6'], [T(new THREE.BoxGeometry(0.002, 0.04, 0.08), 0, 0, 0.12), '#e8e2d4']]), mat);
      ar.position.set(-0.06, 0.04, 0); this.holder.add(ar); this.arrow = ar;
    } else this.arrow = null;
    if (type === 'axe' || type === 'pick') g.rotation.set(-0.12, 0.55, 0.08);
    else if (type === 'weapon') g.rotation.set(0, 0.06, 0);
    else if (type === 'bow') { g.rotation.set(0, -1.25, 0.18); g.position.set(-0.04, 0.05, 0); }
    else if (type === 'rod') g.rotation.set(0, 0.2, 0.05);
    else g.rotation.set(-0.3, 0.2, 0.15);
    const m = g;
    this.holder.add(m);
    this.mesh = m;
    if (id === 'torch') {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), new THREE.MeshBasicMaterial({ color: 0xffb040 }));
      f.position.set(0, 0.72, 0); m.add(f); this.flame = f;
    } else this.flame = null;
  },
  update(dt, P, aspect, t) {
    this.cam.aspect = aspect; this.cam.updateProjectionMatrix();
    const s = Inv.slots[P.sel];
    this.build(s ? s.id : null);
    const bob = P.moving && P.onGround ? Math.sin(P.bob) : 0;
    // fáze úderu u: 0 → 1 (nápřah, rychlý úder, návrat)
    const u = P.swing > 0 ? 1 - P.swing : 1;
    const strike = u < 0.2 ? -0.35 * (u / 0.2) : u < 0.42 ? -0.35 + 1.35 * ((u - 0.2) / 0.22) : 1 - ease((u - 0.42) / 0.58);
    const type = s && ITEMS[s.id].tool ? ITEMS[s.id].tool.type : null;
    let px = 0.36 + bob * 0.012, py = -0.36 + Math.abs(bob) * 0.016, pz = -0.62, rx = 0, ry = 0, rz = 0;
    if (type === 'axe' || type === 'pick') {
      // úder shora: nápřah dozadu, pak hrot / ostří dolů ke středu obrazovky
      rx = strike < 0 ? -strike * 1.4 : -strike * 0.95; rz = strike * 0.12;
      px -= Math.max(0, strike) * 0.17; py -= Math.max(0, strike) * 0.05; pz -= Math.max(0, strike) * 0.08;
    } else if (type === 'weapon') {
      // bodnutí dopředu
      pz -= strike * 0.45; px -= strike * 0.06; py += strike * 0.02;
    } else if (type === 'bow') {
      // luk před sebou, při natahování ke středu a šíp dozadu
      const d = P.draw || 0;
      px = lerp(0.3, 0.06, d) + bob * 0.01; py = lerp(-0.4, -0.3, d); pz = -0.66; rz = lerp(0, -0.12, d);
      if (this.arrow) { this.arrow.visible = d > 0 && Inv.count('arrow') > 0; this.arrow.position.z = 0.05 + d * 0.22; }
    } else if (type === 'rod') {
      const F = Player.fish;
      rx = F ? (F.state === 'bite' ? -0.25 + Math.sin(t * 30) * 0.06 : -0.1) : 0;
      rx -= Math.sin(P.swing * Math.PI) * 0.6;
    } else {
      const sw = Math.sin(P.swing * Math.PI) * (P.swing > 0 ? 1 : 0);
      py -= sw * 0.04; pz += sw * 0.08; rx = -sw * 1.1; ry = sw * 0.3; rz = sw * 0.4;
    }
    this.holder.position.set(px, py, pz);
    this.holder.rotation.set(rx, ry, rz);
    if (this.flame) this.flame.scale.set(1 + Math.sin(t * 20) * 0.1, 1 + Math.sin(t * 13) * 0.2, 1);
  },
};
