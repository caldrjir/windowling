'use strict';
// ── Zvířata ─────────────────────────────────────────────────────────────────
function buildAnimal(type) {
  const g = new THREE.Group();
  const d = ANIMALS[type];
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const body = new THREE.Group(); g.add(body);
  const c = d.color, dark = type === 'wolf' ? '#33353c' : type === 'deer' ? '#7a5228' : type === 'bear' ? '#3e2a1e' : '#a8957c';
  let legH, legs = [];
  if (type === 'rabbit') {
    body.add(new THREE.Mesh(mergeParts([
      [T(new THREE.IcosahedronGeometry(0.22, 0), 0, 0.25, 0, 0, 0, 0, 1.4, 1, 1), c],
      [T(new THREE.IcosahedronGeometry(0.13, 0), 0.28, 0.38, 0), c],
      [T(new THREE.BoxGeometry(0.05, 0.22, 0.06), 0.27, 0.56, 0.05), c], [T(new THREE.BoxGeometry(0.05, 0.22, 0.06), 0.27, 0.56, -0.05), c],
      [T(new THREE.IcosahedronGeometry(0.07, 0), -0.32, 0.3, 0), '#f4efe8'],
    ]), mat));
    legH = 0.12;
    for (const [x, z] of [[0.15, 0.1], [0.15, -0.1], [-0.15, 0.12], [-0.15, -0.12]]) { const l = new THREE.Mesh(T(new THREE.BoxGeometry(0.07, legH, 0.07), 0, -legH / 2, 0), mat); l.position.set(x, legH + 0.06, z); legs.push(l); body.add(l); colorize(l, dark); }
  } else if (type === 'bear') {
    // mohutný medvěd: hrb za hlavou, krátké silné nohy
    legH = 0.55;
    body.add(new THREE.Mesh(mergeParts([
      [T(new THREE.BoxGeometry(1.5, 0.85, 0.85), 0, legH + 0.42, 0), c, 0.06],
      [T(new THREE.BoxGeometry(0.62, 0.38, 0.74), 0.35, legH + 0.86, 0), c, 0.06],
      [T(new THREE.BoxGeometry(0.5, 0.46, 0.5), 0.95, legH + 0.62, 0), c, 0.05],
      [T(new THREE.BoxGeometry(0.26, 0.2, 0.28), 1.25, legH + 0.53, 0), '#8a6a4a'],
      [T(new THREE.BoxGeometry(0.08, 0.08, 0.12), 1.39, legH + 0.58, 0), '#1a1410'],
      [T(new THREE.BoxGeometry(0.12, 0.14, 0.1), 0.88, legH + 0.92, 0.18), dark], [T(new THREE.BoxGeometry(0.12, 0.14, 0.1), 0.88, legH + 0.92, -0.18), dark],
      [T(new THREE.BoxGeometry(0.16, 0.14, 0.14), -0.8, legH + 0.62, 0), dark],
    ]), mat));
    for (const z of [0.13, -0.13]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0x120c08 })); e.position.set(1.2, legH + 0.72, z); body.add(e); }
    for (const [x, z] of [[0.48, 0.27], [0.48, -0.27], [-0.48, 0.27], [-0.48, -0.27]]) {
      const l = new THREE.Mesh(T(new THREE.BoxGeometry(0.24, legH, 0.24), 0, -legH / 2, 0), mat);
      l.position.set(x, legH, z); legs.push(l); body.add(l); colorize(l, dark);
    }
  } else {
    const s = type === 'deer' ? 1.2 : 1;
    legH = 0.55 * s;
    const parts = [
      [T(new THREE.BoxGeometry(1.0 * s, 0.42 * s, 0.38 * s), 0, legH + 0.2 * s, 0), c],
      [T(new THREE.BoxGeometry(0.34 * s, 0.32 * s, 0.3 * s), 0.6 * s, legH + 0.42 * s, 0, 0, 0, type === 'deer' ? 0.5 : 0.2), c],
      [T(new THREE.BoxGeometry(0.28 * s, 0.16 * s, 0.2 * s), 0.85 * s, legH + 0.36 * s, 0), type === 'wolf' ? '#2d2f35' : dark],
      [T(new THREE.BoxGeometry(0.45 * s, 0.08 * s, 0.08 * s), -0.68 * s, legH + 0.28 * s, 0, 0, 0, type === 'wolf' ? 0.5 : 1.2), dark],
    ];
    if (type === 'wolf') { parts.push([T(new THREE.ConeGeometry(0.06, 0.16, 4), 0.62, legH + 0.66, 0.09), dark], [T(new THREE.ConeGeometry(0.06, 0.16, 4), 0.62, legH + 0.66, -0.09), dark]); }
    if (type === 'deer') {
      for (const z of [0.1, -0.1]) {
        parts.push([T(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 4), 0.72, legH + 0.95, z, z * 3, 0, -0.2), '#d8c8a8']);
        parts.push([T(new THREE.CylinderGeometry(0.02, 0.025, 0.3, 4), 0.85, legH + 1.05, z * 1.6, z * 4, 0, -0.9), '#d8c8a8']);
      }
    }
    body.add(new THREE.Mesh(mergeParts(parts), mat));
    for (const [x, z] of [[0.38, 0.13], [0.38, -0.13], [-0.38, 0.13], [-0.38, -0.13]]) {
      const l = new THREE.Mesh(T(new THREE.BoxGeometry(0.1 * s, legH, 0.1 * s), 0, -legH / 2, 0), mat);
      l.position.set(x * s, legH, z * s); legs.push(l); body.add(l); colorize(l, dark);
    }
    if (type === 'wolf') {
      const eyeM = new THREE.MeshBasicMaterial({ color: 0xffd23a });
      for (const z of [0.07, -0.07]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), eyeM); e.position.set(0.79, legH + 0.48, z); body.add(e); }
    }
  }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; } });
  g.userData.legs = legs;
  g.userData.body = body;
  g.userData.mat = mat;
  return g;
}
function colorize(mesh, hex) {
  const g = mesh.geometry, n = g.attributes.position.count, c = col(hex), arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

const Animals = {
  list: [], scene: null,
  init(scene) { this.scene = scene; this.list = []; },
  spawn(type, x, z) {
    const y = World.height(x, z);
    const m = buildAnimal(type);
    m.position.set(x, y, z);
    const a = { type, d: ANIMALS[type], mesh: m, x, z, y, yaw: Math.random() * Math.PI * 2, hp: ANIMALS[type].hp, state: 'wander', tx: x, tz: z, t: 0, atkCd: 0, flash: 0, dead: false, dieT: 0, phase: Math.random() * 6, scared: 0 };
    m.userData.animal = a;
    this.scene.add(m);
    this.list.push(a);
    return a;
  },
  remove(a) { this.scene.remove(a.mesh); this.list = this.list.filter(x => x !== a); },
  clear() { for (const a of this.list) this.scene.remove(a.mesh); this.list = []; },
  count(type) { return this.list.filter(a => a.type === type && !a.dead).length; },

  // udržuje populaci kolem hráče
  populate(px, pz, night, dayN, mode) {
    const spawnAround = (type, minD, maxD) => {
      for (let t = 0; t < 12; t++) {
        const ang = Math.random() * Math.PI * 2, d = rand(minD, maxD);
        const x = px + Math.cos(ang) * d, z = pz + Math.sin(ang) * d, h = World.height(x, z);
        if (h < 1.2 || h > 26 || World.isFreshWater(x, z) || Math.hypot(x, z) > ISLAND_R) continue;
        return this.spawn(type, x, z);
      }
    };
    if (this.count('rabbit') < 9) spawnAround('rabbit', 30, 80);
    if (this.count('deer') < 4) spawnAround('deer', 40, 90);
    const W = MODES[mode].wolves;
    const want = night ? Math.min(10, Math.round((1.5 + dayN * 0.55) * W)) : (Math.random() < 0.002 * W ? 1 : 0);
    if (this.count('wolf') < want) { const a = spawnAround('wolf', 45, 70); if (a && night) a.state = 'hunt'; }
    // medvěd žije u svého doupěte v horách; po skolení se vrátí za dva dny
    const lair = World.lair, now = G.day * 24 + G.hour;
    if (lair && Math.hypot(px - lair.x, pz - lair.z) < 140 && this.count('bear') < (mode === 'harsh' ? 2 : 1) && !(G.flags.bearT > now)) {
      for (let t = 0; t < 10; t++) {
        const x = lair.x + rand(-10, 10), z = lair.z + rand(-10, 10);
        if (World.height(x, z) > 1.2 && !World.isFreshWater(x, z) && Math.hypot(x - px, z - pz) > 25) { this.spawn('bear', x, z); break; }
      }
    }
    for (const a of this.list) {
      const d = Math.hypot(a.x - px, a.z - pz);
      if (d > 150) this.remove(a);
      else if (!night && a.type === 'wolf' && a.state !== 'chase' && d > 60) this.remove(a);
    }
  },

  update(dt, P, night, onHurt) {
    for (const a of this.list) {
      const m = a.mesh;
      if (a.dead) {
        a.dieT += dt;
        m.rotation.z = Math.min(Math.PI / 2, a.dieT * 4);
        if (a.dieT > 6) a.remove = true;
        continue;
      }
      a.t += dt; a.atkCd -= dt; a.scared -= dt;
      const dx = P.x - a.x, dz = P.z - a.z, dist = Math.hypot(dx, dz);
      let speed = 0, tx = a.tx, tz = a.tz;
      // oheň plaší vlky
      const fire = World.structures.find(s => s.type === 'campfire' && Math.hypot(s.x - a.x, s.z - a.z) < 8);
      if (a.d.flee) {
        if (dist < (a.type === 'deer' ? 16 : 10) || a.scared > 0) { a.state = 'flee'; tx = a.x - dx; tz = a.z - dz; speed = a.d.speed; }
        else if (a.state === 'flee') a.state = 'wander';
      } else if (a.type === 'bear') {
        // medvěd: brání své území, oheň ho zahání, daleko od doupěte se vrací
        const home = World.lair || { x: a.x, z: a.z }, dHome = Math.hypot(a.x - home.x, a.z - home.z);
        const fire6 = World.structures.find(s => s.type === 'campfire' && Math.hypot(s.x - a.x, s.z - a.z) < 6);
        if (fire6) { a.state = 'flee'; tx = a.x + (a.x - fire6.x); tz = a.z + (a.z - fire6.z); speed = a.d.speed * 0.7; }
        else if ((dist < 15 || a.provoked) && dist < 42 && dHome < 95 && !P.dead && !P.swim) {
          if (a.state !== 'chase') Sound.play.roar();
          a.state = 'chase'; tx = P.x; tz = P.z; speed = a.d.speed;
          if (dist < 2.6 && a.atkCd <= 0 && Math.abs(P.y - a.y) < 2.5) { a.atkCd = 1.8; a.lunge = 0.35; onHurt(a.d.dmg, a); }
          if (dist < 1.9) speed = 0;
        } else if (dHome > 45) { a.state = 'home'; tx = home.x; tz = home.z; speed = a.d.speed * 0.5; a.provoked = false; }
        else if (a.state === 'chase' || a.state === 'home') { a.state = 'wander'; a.provoked = false; }
      } else {
        // vlk
        const aggro = night || a.state === 'chase' || a.provoked;
        if (fire && !P.inWater) { a.state = 'flee'; tx = a.x + (a.x - fire.x); tz = a.z + (a.z - fire.z); speed = a.d.speed * 0.8; }
        else if (aggro && dist < 45 && !P.dead) {
          a.state = 'chase'; tx = P.x; tz = P.z; speed = a.d.speed * (P.torch && dist < 6 && a.t % 3 < 1.2 ? 0.2 : 1);
          if (dist < 1.9 && a.atkCd <= 0 && Math.abs(P.y - a.y) < 2.5) { a.atkCd = 1.35; a.lunge = 0.3; onHurt(a.d.dmg, a); }
          if (dist < 1.4) speed = 0;
        } else if (a.state === 'chase') a.state = 'wander';
      }
      if (a.state === 'wander' || a.state === 'hunt') {
        if (Math.hypot(a.tx - a.x, a.tz - a.z) < 1 || a.t > 8) {
          a.t = 0;
          if (a.state === 'hunt') { a.tx = P.x + rand(-15, 15); a.tz = P.z + rand(-15, 15); }
          else { a.tx = a.x + rand(-18, 18); a.tz = a.z + rand(-18, 18); }
        }
        tx = a.tx; tz = a.tz;
        speed = a.state === 'hunt' ? a.d.speed * 0.6 : (a.t % 6 < 3.5 ? a.d.speed * 0.25 : 0);
      }
      if (speed > 0) {
        const want = Math.atan2(tz - a.z, tx - a.x);
        let diff = want - a.yaw; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
        a.yaw += diff * Math.min(1, dt * 6);
        const nx = a.x + Math.cos(a.yaw) * speed * dt, nz = a.z + Math.sin(a.yaw) * speed * dt;
        const nh = World.height(nx, nz);
        if (nh > 0.4 && !World.isFreshWater(nx, nz) && Math.hypot(nx, nz) < ISLAND_R + 8) { a.x = nx; a.z = nz; }
        else { a.tx = a.x - Math.cos(a.yaw) * 10; a.tz = a.z - Math.sin(a.yaw) * 10; a.t = 0; }
        // stromy
        for (const o of World.solidsNear(a.x, a.z)) { const ox = a.x - o.x, oz = a.z - o.z, od = Math.hypot(ox, oz), rr = NODES[o.type].r * o.s + 0.35; if (od < rr && od > 0.001) { a.x = o.x + ox / od * rr; a.z = o.z + oz / od * rr; } }
      }
      a.y = World.height(a.x, a.z);
      m.position.set(a.x, a.y, a.z);
      m.rotation.y = -a.yaw;
      // animace nohou
      a.phase += dt * speed * (a.type === 'rabbit' ? 4 : 2.2);
      const legs = m.userData.legs;
      for (let i = 0; i < legs.length; i++) legs[i].rotation.z = Math.sin(a.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * (speed > 0 ? 0.6 : 0);
      if (a.type === 'rabbit') m.userData.body.position.y = speed > 0 ? Math.abs(Math.sin(a.phase)) * 0.15 : 0;
      if (a.lunge > 0) { a.lunge -= dt; m.userData.body.position.x = Math.sin(a.lunge / 0.3 * Math.PI) * 0.4; } else m.userData.body.position.x = 0;
      if (a.flash > 0) { a.flash -= dt; m.scale.setScalar(1 + a.flash * 0.6); m.userData.mat.emissive.setRGB(Math.max(0, a.flash) * 4, 0, 0); }
      else if (m.scale.x !== 1) { m.scale.setScalar(1); m.userData.mat.emissive.setRGB(0, 0, 0); }
    }
    for (const a of this.list.filter(a => a.remove)) this.remove(a);
  },
  hurt(a, dmg) {
    if (a.dead) return false;
    a.hp -= dmg; a.flash = 0.15; a.scared = 6; a.provoked = true;
    if (!a.d.flee) a.state = 'chase';
    if (a.hp <= 0) { a.dead = true; a.dieT = 0; return true; }
    return false;
  },
};

// ── Šípy: let s gravitací, zásah zvířete, zabodnutí do země nebo stromu ─────
const Projectiles = {
  list: [], scene: null, geo: null, mat: null,
  init(scene) {
    this.scene = scene; this.list = [];
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true });
    this.geo = mergeParts([
      [T(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 4), 0, 0, 0, Math.PI / 2), '#c9a77a'],
      [T(new THREE.ConeGeometry(0.028, 0.09, 4), 0, 0, -0.44, -Math.PI / 2), '#9aa0a6'],
      [T(new THREE.BoxGeometry(0.002, 0.06, 0.12), 0, 0, 0.34), '#e8e2d4'], [T(new THREE.BoxGeometry(0.06, 0.002, 0.12), 0, 0, 0.34), '#e8e2d4'],
    ]);
  },
  fire(o, d, speed, dmg) {
    const m = new THREE.Mesh(this.geo, this.mat); m.castShadow = true;
    m.position.copy(o);
    this.scene.add(m);
    this.list.push({ m, x: o.x, y: o.y, z: o.z, vx: d.x * speed, vy: d.y * speed, vz: d.z * speed, dmg, t: 0, stuck: false });
  },
  clear() { for (const a of this.list) this.scene.remove(a.m); this.list = []; },
  // šíp, který minul, zůstane často ležet a dá se sebrat
  land(a, x, z) { if (Math.random() < 0.65) Drops.put({ id: 'arrow', n: 1 }, x, z); },
  update(dt) {
    for (const a of this.list) {
      a.t += dt;
      if (a.stuck) { if (a.t > 12) a.remove = true; continue; }
      a.vy -= 9.8 * dt;
      const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt, nz = a.z + a.vz * dt;
      let hit = null;
      for (const an of Animals.list) {
        if (an.dead) continue;
        const sz = an.d.size, cy = an.y + 0.45 * sz + 0.1;
        if (Math.hypot(nx - an.x, ny - cy, nz - an.z) < 0.45 * sz + 0.35) { hit = an; break; }
      }
      a.x = nx; a.y = ny; a.z = nz;
      a.m.position.set(nx, ny, nz);
      a.m.lookAt(nx - a.vx, ny - a.vy, nz - a.vz);
      if (hit) {
        const killed = Animals.hurt(hit, a.dmg);
        Particles.burst(nx, ny, nz, '#b0303a', 10, 2.5, 2.5);
        Sound.play.arrowHit();
        UI.floatText(new THREE.Vector3(nx, ny + 0.4, nz), `−${Math.round(a.dmg)}`, killed ? 'kill' : '');
        if (killed) Game.killed(hit, 'arrow');
        a.remove = true; continue;
      }
      const gh = World.height(nx, nz), wl = World.waterLevelAt(nx, nz);
      if (ny < wl && wl > gh) { FX.puff(nx, wl, nz, '#cfe8f0', 5, 0.15); a.remove = true; continue; }
      const tree = World.solidsNear(nx, nz).find(o => Math.hypot(o.x - nx, o.z - nz) < NODES[o.type].r * o.s + 0.05 && ny < o.y + 5);
      if (ny <= gh || tree) {
        a.stuck = true; a.t = 0;
        if (ny <= gh) { a.y = gh + 0.05; a.m.position.y = a.y; }
        Sound.play.thunk();
        Particles.burst(nx, a.y, nz, tree ? '#a87a48' : '#9a8a6a', 5, 1.5, 1.5);
        this.land(a, tree ? tree.x + (nx - tree.x) * 1.6 : nx, tree ? tree.z + (nz - tree.z) * 1.6 : nz);
      }
      if (a.t > 8) a.remove = true;
    }
    for (const a of this.list.filter(o => o.remove)) this.scene.remove(a.m);
    this.list = this.list.filter(o => !o.remove);
  },
};

// ── Částice (třísky, jiskry, krev) ──────────────────────────────────────────
const Particles = {
  mesh: null, items: [], max: 300,
  init(scene) {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), this.max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < this.max; i++) this.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
    scene.add(this.mesh);
    this.items = [];
    this.dummy = new THREE.Object3D();
  },
  burst(x, y, z, color, n = 10, spd = 3, up = 3) {
    const c = col(color);
    for (let i = 0; i < n; i++) {
      if (this.items.length >= this.max) this.items.shift();
      this.items.push({ x, y, z, vx: rand(-spd, spd), vy: rand(0.5, up), vz: rand(-spd, spd), life: rand(0.5, 1), c, s: rand(0.6, 1.4) });
    }
  },
  update(dt) {
    const d = this.dummy;
    this.items = this.items.filter(p => (p.life -= dt) > 0);
    let i = 0;
    for (const p of this.items) {
      p.vy -= 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const g = World.height(p.x, p.z); if (p.y < g + 0.04) { p.y = g + 0.04; p.vx *= 0.6; p.vz *= 0.6; p.vy = 0; }
      d.position.set(p.x, p.y, p.z); d.rotation.set(p.life * 5, p.life * 3, 0); d.scale.setScalar(p.s * Math.min(1, p.life * 3)); d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix); this.mesh.setColorAt(i, p.c); i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  },
};
