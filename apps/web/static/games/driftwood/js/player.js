'use strict';
// ── Inventář ────────────────────────────────────────────────────────────────
const INV_SIZE = 24, HOTBAR = 6;
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
      inWater: false, swim: false, sel: 0, swing: 0, cd: 0, dead: false, spawn: null, torch: false, bob: 0, hurtT: 0, moving: false };
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
    const sprint = k.has('ShiftLeft') && P.stamina > 1 && ml > 0 && !P.swim;
    let speed = P.swim ? 3 : P.inWater ? 3.6 : sprint ? 8.6 : 5.2;
    if (P.armor) speed *= 0.95;
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
    if (sprint) P.stamina = Math.max(0, P.stamina - 20 * dt);
    else if (P.swim && ml) P.stamina = Math.max(0, P.stamina - 5 * dt);
    else P.stamina = Math.min(100, P.stamina + 16 * dt);
    if (P.swim && P.stamina <= 0) env.hurt(4 * dt, null, true);
    // kroky
    if (ml && P.onGround) { const pb = P.bob; P.bob += dt * (sprint ? 11 : 8); if (Math.floor(pb / Math.PI) !== Math.floor(P.bob / Math.PI)) env.sound(P.inWater ? 'splash' : 'step'); }
    else if (ml && P.swim) { const pb = P.bob; P.bob += dt * 4; if (Math.floor(pb / Math.PI) !== Math.floor(P.bob / Math.PI)) env.sound('swim'); }
    // kamera
    P.vx = vx; P.vz = vz; P.sprint = sprint;
    this.camExtra = CameraRig.place(cam, P, Game.third, dt, ml && P.onGround ? Math.abs(Math.sin(P.bob)) * 0.06 : 0);
    // potřeby
    const M = MODES[env.mode];
    P.hunger = Math.max(0, P.hunger - dt * 0.2 * M.drain * (sprint ? 1.6 : 1));
    P.thirst = Math.max(0, P.thirst - dt * 0.27 * M.drain * (sprint ? 1.6 : 1));
    let warmTarget = 85 - env.night * (P.armor ? 35 : 62);
    if (P.inWater) warmTarget -= 25;
    for (const s of World.structures) { const w = STRUCTURES[s.type].warmth; if (w && Math.hypot(s.x - P.x, s.z - P.z) < w) warmTarget = Math.max(warmTarget, s.type === 'shelter' ? 70 : 100); }
    if (P.torch) warmTarget += 12;
    warmTarget = clamp(warmTarget, 0, 100);
    P.warmth += (warmTarget - P.warmth) * Math.min(1, dt * 0.12);
    let dhp = 0;
    if (P.hunger <= 0) dhp -= 0.9; if (P.thirst <= 0) dhp -= 1.1; if (P.warmth < 15) dhp -= 0.6;
    if (P.hunger > 45 && P.thirst > 45 && P.warmth > 35) dhp += 0.3;
    if (dhp < 0) env.hurt(-dhp * dt, null, true); else P.hp = Math.min(100, P.hp + dhp * dt);
    // pochodeň v ruce
    const it = this.sel();
    P.torch = !!(it && it.id === 'torch');
    if (P.torch) { it.dur -= dt; if (it.dur <= 0) { Inv.slots[P.sel] = null; env.msg(L('Pochodeň dohořela', 'Your torch burned out')); } }
    // akce
    P.cd -= dt; P.swing = Math.max(0, P.swing - dt * 3.2);
    this.look(cam);
    this.updateGhost(cam, env);
    if (this.mouse.l && P.cd <= 0 && this.locked) this.primary(env);
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
      while (o && !o.userData.animal && !o.userData.structure && !o.userData.drop) o = o.parent;
      if (!o) continue;
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
      n.hp -= power;
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
        this.giveDrops(def.drops, env, right && tool.power >= 4 ? 1 : 0);
        if (isWood) SAVE.stats.trees++; else SAVE.stats.rocks++;
      }
    } else if (t.kind === 'animal') {
      const dmg = tool ? tool.dmg : 4;
      const killed = Animals.hurt(t.a, dmg * rand(0.9, 1.15));
      this.wear(slot, env);
      Particles.burst(t.point.x, t.point.y, t.point.z, '#b0303a', 9, 2.5, 2.5);
      env.sound('hit');
      env.shake(0.2);
      if (killed) {
        env.sound('kill');
        this.giveDrops(t.a.d.drops, env, 0);
        if (t.a.type === 'wolf') SAVE.stats.wolves++;
        if (t.a.type === 'deer') SAVE.stats.deer++;
      }
    } else if (t.kind === 'structure') {
      env.msg(L('Stiskni E pro použití', 'Press E to use'));
    }
  },
  wear(slot, env) {
    if (!slot || slot.dur === undefined || slot.id === 'torch') return;
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
    this.giveDrops(def.drops, env, 0);
  },

  interact(env) {
    const P = this.P, t = this.target;
    if (!t) return;
    if (t.kind === 'drop') { Drops.take(t.d); return; }
    if (t.kind === 'node' && NODES[t.node.type].gather) { this.gather(t.node, env); return; }
    if (t.kind === 'structure') {
      const s = t.s;
      if (s.type === 'shelter') { env.sleep(s); return; }
      if (s.type === 'raft') { env.escape(s); return; }
      env.openCraft(s.type);
      return;
    }
    if (t.kind === 'water') {
      const ws = Inv.slots.find(x => x && x.id === 'waterskin' && x.ch < ITEMS.waterskin.charges);
      if (t.fresh) {
        if (ws && P.thirst > 85) { ws.ch = ITEMS.waterskin.charges; env.msg(L('Měch naplněn', 'Waterskin filled')); env.sound('drink'); env.invChanged(); return; }
        P.thirst = Math.min(100, P.thirst + 25); env.sound('drink'); env.msg(L('Čerstvá voda', 'Fresh water')); G.flags.fresh = true;
        if (ws) { ws.ch = ITEMS.waterskin.charges; env.invChanged(); }
      } else { P.thirst = Math.max(0, P.thirst - 4); P.hp -= 2; env.sound('drink'); env.msg(L('Slaná voda! Hledej sladkou.', 'Salt water! Find fresh water.')); }
    }
  },
  use(env) {
    const P = this.P, s = this.sel();
    if (!s) return;
    const it = ITEMS[s.id];
    if (it.food) {
      const f = it.food;
      if (f.hunger) P.hunger = Math.min(100, P.hunger + f.hunger);
      if (f.thirst) P.thirst = Math.min(100, P.thirst + f.thirst);
      if (f.health) { if (f.health > 0) P.hp = Math.min(100, P.hp + f.health); else env.hurt(-f.health, null, true); }
      s.n--; if (!s.n) Inv.slots[P.sel] = null;
      env.sound(s.id === 'bandage' ? 'pick' : 'eat');
      SAVE.stats.eaten++;
      if (s.id === 'rawMeat') env.msg(L('Syrové maso ti nedělá dobře…', 'Raw meat makes you feel sick…'));
      env.invChanged();
    } else if (s.id === 'waterskin') {
      if (s.ch > 0) { s.ch--; P.thirst = Math.min(100, P.thirst + 30); env.sound('drink'); env.invChanged(); }
      else env.msg(L('Měch je prázdný. Naplň ho u jezírka.', 'The waterskin is empty. Fill it at a pond.'));
    } else if (s.id === 'hideArmor') {
      if (P.armor) { env.msg(L('Už máš zbroj na sobě', 'You are already wearing armor')); return; }
      P.armor = true; Inv.slots[P.sel] = null; env.sound('pick'); env.msg(L('Kožená zbroj: −35 % poškození, víc tepla', 'Hide armor: −35% damage, more warmth')); env.invChanged();
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
    this.ghost.rotation.y = P.yaw;
    this.ghostOk = ok; this.ghostPos = { x, z };
    this.ghost.traverse(m => { if (m.isMesh) m.material.color.set(ok ? 0x7cf0b6 : 0xff5a6e); });
  },
  place(env) {
    if (!this.ghostOk) { env.sound('error'); env.msg(this.ghostType === 'raft' ? L('Vor musíš spustit na moře u břehu', 'Launch the raft in the sea near the shore') : L('Sem to postavit nejde', "You can't build here")); return; }
    const type = this.ghostType, s = this.sel();
    s.n--; if (!s.n) Inv.slots[this.P.sel] = null;
    const st = World.addStructure(type, this.ghostPos.x, this.ghostPos.z, this.P.yaw);
    env.sound('build');
    Particles.burst(st.x, st.y + 0.3, st.z, '#c9a77a', 18, 3, 3);
    if (type === 'campfire') SAVE.stats.fires++;
    if (type === 'shelter') { SAVE.stats.shelters++; this.P.spawn = { x: st.x, z: st.z }; env.msg(L('Přístřešek je nyní tvým místem oživení', 'Your shelter is now your respawn point')); }
    env.invChanged();
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
      g.add(new THREE.Mesh(tg, mat));
    }
    if (type === 'axe' || type === 'pick') g.rotation.set(-0.12, 0.55, 0.08);
    else if (type === 'weapon') g.rotation.set(0, 0.06, 0);
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
    } else {
      const sw = Math.sin(P.swing * Math.PI) * (P.swing > 0 ? 1 : 0);
      py -= sw * 0.04; pz += sw * 0.08; rx = -sw * 1.1; ry = sw * 0.3; rz = sw * 0.4;
    }
    this.holder.position.set(px, py, pz);
    this.holder.rotation.set(rx, ry, rz);
    if (this.flame) this.flame.scale.set(1 + Math.sin(t * 20) * 0.1, 1 + Math.sin(t * 13) * 0.2, 1);
  },
};
