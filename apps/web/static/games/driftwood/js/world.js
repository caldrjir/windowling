'use strict';
// ── Svět: terén, voda, obloha, suroviny, stavby ─────────────────────────────
const SIZE = 460, SEG = 230, HALF = SIZE / 2, CELL = SIZE / SEG, ISLAND_R = 190;
const col = (hex) => new THREE.Color(hex).convertSRGBToLinear();

// Spojí geometrie do jedné ne-indexované s barvami po plochách
function mergeParts(parts) {
  let total = 0;
  const geos = parts.map(([g, color, jitter = 0.06, rnd = Math.random]) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.computeVertexNormals();
    total += ng.attributes.position.count;
    return [ng, color, jitter, rnd];
  });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), cols = new Float32Array(total * 3);
  let o = 0;
  for (const [g, color, jitter, rnd] of geos) {
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    pos.set(p, o * 3); nor.set(n, o * 3);
    const c = col(color), cnt = g.attributes.position.count;
    for (let f = 0; f < cnt; f += 3) {
      const k = 1 + (rnd() - 0.5) * 2 * jitter;
      for (let v = 0; v < 3; v++) { const i = (o + f + v) * 3; cols[i] = c.r * k; cols[i + 1] = c.g * k; cols[i + 2] = c.b * k; }
    }
    o += cnt;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return out;
}
const T = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sy = s, sz = s) => {
  g.scale(s, sy, sz); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g;
};
function deform(g, amt, rnd) {
  const p = g.attributes.position, m = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!m.has(k)) m.set(k, 1 + (rnd() - 0.5) * amt);
    const s = m.get(k); p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s);
  }
  return g;
}

// ── Modely ──────────────────────────────────────────────────────────────────
const MODELS = {
  tree: r => mergeParts([
    [T(new THREE.CylinderGeometry(0.22, 0.34, 2.6, 6), 0, 1.3), '#7a5232'],
    [T(deform(new THREE.IcosahedronGeometry(1.5, 0), 0.25, r), 0, 3.4), '#4f8f3a', 0.12, r],
    [T(deform(new THREE.IcosahedronGeometry(1.1, 0), 0.25, r), 0.8, 2.9, 0.3), '#5ea043', 0.12, r],
    [T(deform(new THREE.IcosahedronGeometry(1.0, 0), 0.25, r), -0.7, 3.0, -0.4), '#477f33', 0.12, r],
  ]),
  pine: r => mergeParts([
    [T(new THREE.CylinderGeometry(0.18, 0.28, 1.6, 5), 0, 0.8), '#6a4428'],
    [T(new THREE.ConeGeometry(1.7, 2.4, 7), 0, 2.4), '#2f6b3f', 0.1, r],
    [T(new THREE.ConeGeometry(1.35, 2.1, 7), 0, 3.6), '#347445', 0.1, r],
    [T(new THREE.ConeGeometry(0.95, 1.8, 7), 0, 4.7), '#3a7d4b', 0.1, r],
  ]),
  palm: r => {
    const parts = [];
    let x = 0, y = 0;
    for (let i = 0; i < 6; i++) { parts.push([T(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 5), x, y + 0.45, 0, 0, 0, -0.08 * i), '#9a7b52']); x += 0.07 * i; y += 0.85; }
    // listy: zploštělé kužele položené do stran a mírně svěšené
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + r() * 0.3;
      const leaf = new THREE.ConeGeometry(0.4, 2.8, 4);
      leaf.scale(1, 1, 0.25); leaf.rotateZ(-Math.PI / 2 - 0.35); leaf.translate(1.3, -0.35, 0); leaf.rotateY(a); leaf.translate(x, y, 0);
      parts.push([leaf, i % 2 ? '#4f9a3a' : '#5aa844', 0.1, r]);
    }
    for (let i = 0; i < 2; i++) parts.push([T(new THREE.IcosahedronGeometry(0.2, 0), x + 0.2 * (i ? 1 : -1), y - 0.35, 0.15), '#6b4a2a']);
    return mergeParts(parts);
  },
  rock: r => mergeParts([[T(deform(new THREE.IcosahedronGeometry(1, 0), 0.45, r), 0, 0.35, 0, 0, 0, 0, 1.3, 0.85, 1.1), '#8f949a', 0.14, r]]),
  ironRock: r => mergeParts([
    [T(deform(new THREE.IcosahedronGeometry(1, 0), 0.45, r), 0, 0.35, 0, 0, 0, 0, 1.25, 0.9, 1.1), '#7d7672', 0.12, r],
    [T(new THREE.OctahedronGeometry(0.28, 0), 0.6, 0.7, 0.3), '#c4683e'],
    [T(new THREE.OctahedronGeometry(0.22, 0), -0.5, 0.8, -0.2), '#d4784a'],
    [T(new THREE.OctahedronGeometry(0.2, 0), 0.1, 1.0, -0.5), '#c4683e'],
  ]),
  bush: r => {
    const parts = [[T(deform(new THREE.IcosahedronGeometry(0.75, 0), 0.3, r), 0, 0.55), '#3f7d34', 0.12, r]];
    for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2, e = r() * 0.8; parts.push([T(new THREE.IcosahedronGeometry(0.09, 0), Math.cos(a) * 0.7 * Math.cos(e), 0.55 + Math.sin(e) * 0.6, Math.sin(a) * 0.7 * Math.cos(e)), '#e0284f']); }
    return mergeParts(parts);
  },
  plant: r => {
    const parts = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; parts.push([T(new THREE.ConeGeometry(0.06, 1.1, 3), Math.cos(a) * 0.12, 0.5, Math.sin(a) * 0.12, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3), '#a6cf5a', 0.1, r]); }
    return mergeParts(parts);
  },
  stick: r => mergeParts([
    [T(new THREE.CylinderGeometry(0.05, 0.06, 1.3, 4), 0, 0.06, 0, 0, 0, Math.PI / 2), '#7a5232'],
    [T(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 4), 0.25, 0.08, 0.15, 0, 0.7, Math.PI / 2), '#7a5232'],
  ]),
  pebble: r => mergeParts([
    [T(new THREE.DodecahedronGeometry(0.16, 0), 0, 0.08, 0), '#9aa0a6', 0.1, r],
    [T(new THREE.DodecahedronGeometry(0.12, 0), 0.25, 0.06, 0.1), '#8a9096', 0.1, r],
    [T(new THREE.DodecahedronGeometry(0.1, 0), -0.1, 0.05, 0.25), '#a7adb3', 0.1, r],
  ]),
  grass: r => {
    const parts = [];
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + r(); parts.push([T(new THREE.ConeGeometry(0.035, 0.42, 3), Math.cos(a) * 0.08, 0.27, Math.sin(a) * 0.08, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25), '#7fb24f', 0.15, r]); }
    return mergeParts(parts);
  },
};

// stavby jako skupiny
function buildStructure(type) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const add = (geo, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; };
  const r = Math.random;
  if (type === 'campfire') {
    const parts = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; parts.push([T(deform(new THREE.DodecahedronGeometry(0.17, 0), 0.3, r), Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55), '#8f949a', 0.1]); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; parts.push([T(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 5), Math.cos(a) * 0.15, 0.22, Math.sin(a) * 0.15, 0, a, 0.9), '#6a4428']); }
    add(mergeParts(parts));
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 }));
    flame.position.y = 0.55; g.add(flame); g.userData.flame = flame;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xfff0a0 }));
    inner.position.y = 0.45; g.add(inner); g.userData.inner = inner;
  } else if (type === 'workbench') {
    add(mergeParts([
      [T(new THREE.BoxGeometry(1.8, 0.12, 0.9), 0, 0.9), '#a2703f'],
      [T(new THREE.BoxGeometry(0.12, 0.9, 0.12), -0.8, 0.45, -0.35), '#7a5232'], [T(new THREE.BoxGeometry(0.12, 0.9, 0.12), 0.8, 0.45, -0.35), '#7a5232'],
      [T(new THREE.BoxGeometry(0.12, 0.9, 0.12), -0.8, 0.45, 0.35), '#7a5232'], [T(new THREE.BoxGeometry(0.12, 0.9, 0.12), 0.8, 0.45, 0.35), '#7a5232'],
      [T(new THREE.BoxGeometry(1.6, 0.06, 0.7), 0, 0.3), '#8a5c34'],
      [T(new THREE.BoxGeometry(0.5, 0.08, 0.15), 0.3, 1.0, 0.1, 0, 0.4), '#9aa0a6'],
      [T(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4), -0.4, 1.0, 0, 0, 0, Math.PI / 2), '#6a4428'],
    ]));
  } else if (type === 'furnace') {
    add(mergeParts([
      [T(deform(new THREE.DodecahedronGeometry(0.95, 0), 0.15, r), 0, 0.7, 0, 0, 0, 0, 1, 0.9, 1), '#8f8a86', 0.12],
      [T(new THREE.CylinderGeometry(0.2, 0.25, 0.8, 6), 0, 1.7), '#7d7672'],
    ]));
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 10), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
    glow.position.set(0, 0.45, 0.86); g.add(glow); g.userData.flame = glow;
  } else if (type === 'shelter') {
    const parts = [];
    for (let s of [-1, 1]) {
      for (let i = 0; i < 7; i++) parts.push([T(new THREE.BoxGeometry(0.22, 2.6, 0.2), s * 0.9, 1.0, -1.2 + i * 0.4, 0, 0, s * 0.62), i % 2 ? '#9a6b3e' : '#8a5c34', 0.08]);
      parts.push([T(new THREE.BoxGeometry(0.5, 2.6, 2.9), s * 0.95, 1.05, 0, 0, 0, s * 0.62, 0.3, 1, 1), '#4f8f3a', 0.15]);
    }
    parts.push([T(new THREE.CylinderGeometry(0.08, 0.08, 3, 5), 0, 2.15, 0, Math.PI / 2), '#6a4428']);
    parts.push([T(new THREE.BoxGeometry(1.2, 0.12, 2), 0, 0.06, 0), '#c9a77a']);
    add(mergeParts(parts));
  } else if (type === 'raft') {
    const parts = [];
    for (let i = 0; i < 8; i++) parts.push([T(new THREE.CylinderGeometry(0.2, 0.2, 4, 6), -1.4 + i * 0.4, 0.2, 0, Math.PI / 2), i % 2 ? '#9a6b3e' : '#a87a48', 0.08]);
    parts.push([T(new THREE.CylinderGeometry(0.08, 0.1, 3.5, 5), 0, 2, 0), '#6a4428']);
    parts.push([T(new THREE.BoxGeometry(0.04, 2.2, 1.8), 0.05, 2.3, 0.2), '#efe6d2']);
    add(mergeParts(parts));
  }
  return g;
}

// ── Svět ────────────────────────────────────────────────────────────────────
const World = {
  scene: null, seed: 1, heights: null, noise: null, ponds: [], nodes: {}, meshes: {}, structures: [], grassMesh: null,
  sun: null, hemi: null, sky: null, stars: null, waves: null, clouds: [], fires: [],

  height(x, z) {
    // bilineární vzorek mřížky výšek
    const gx = (x + HALF) / CELL, gz = (z + HALF) / CELL;
    if (gx < 0 || gz < 0 || gx >= SEG || gz >= SEG) return -20;
    const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz, W = SEG + 1, H = this.heights;
    const a = H[iz * W + ix], b = H[iz * W + ix + 1], c = H[(iz + 1) * W + ix], d = H[(iz + 1) * W + ix + 1];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
  },
  rawHeight(x, z) {
    const N = this.noise;
    const warp = N.fbm(x * 0.004 + 9, z * 0.004 - 4, 3) * 0.18;
    const d = Math.hypot(x, z) / ISLAND_R + warp;
    const mask = 1 - smoothstep(0.55, 1.02, d);
    const e = N.fbm(x * 0.009, z * 0.009, 5) * 0.5 + 0.5;
    const mtn = Math.pow(Math.max(0, N.fbm(x * 0.0042 + 31, z * 0.0042 - 17, 4) + 0.08), 1.7) * 62;
    let h = (e * 9 + mtn) * mask + 2.2 * mask - 16 * (1 - mask);
    for (const p of this.ponds) {
      const dd = Math.hypot(x - p.x, z - p.z);
      if (dd < p.r * 1.8) { const k = smoothstep(p.r * 1.8, p.r * 0.5, dd); h = lerp(h, p.level - 1.6, k); }
    }
    return h;
  },
  isFreshWater(x, z) { return this.ponds.find(p => Math.hypot(x - p.x, z - p.z) < p.r && this.height(x, z) < p.level); },
  waterLevelAt(x, z) { const p = this.isFreshWater(x, z); return p ? p.level : 0; },

  generate(seed, scene) {
    this.seed = seed; this.scene = scene;
    this.noise = makeNoise(seed);
    const rnd = mulberry32(seed + 77);
    // jezírka – vnitrozemí na mírném terénu
    this.ponds = [];
    this.heights = null;
    const tmp = { ponds: [] };
    for (let tries = 0; this.ponds.length < 3 && tries < 400; tries++) {
      const a = rnd() * Math.PI * 2, d = rnd() * 0.55 * ISLAND_R;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const saved = this.ponds; this.ponds = [];
      const h = this.rawHeight(x, z);
      this.ponds = saved;
      if (h > 3.5 && h < 9 && this.ponds.every(p => Math.hypot(p.x - x, p.z - z) > 60)) this.ponds.push({ x, z, r: 7 + rnd() * 5, level: h - 0.6 });
    }
    // výšková mřížka
    const W = SEG + 1;
    this.heights = new Float32Array(W * W);
    for (let iz = 0; iz < W; iz++) for (let ix = 0; ix < W; ix++) this.heights[iz * W + ix] = this.rawHeight(-HALF + ix * CELL, -HALF + iz * CELL);
    this.buildTerrain();
    this.buildWater();
    this.buildSky();
    this.placeNodes(rnd);
    this.buildGrass(rnd);
    this.buildClouds(rnd);
  },

  buildTerrain() {
    const W = SEG + 1, H = this.heights, N = this.noise;
    const pos = [], cols = [];
    const C = { sand: col('#e3cf98'), wetSand: col('#c9b07a'), grass: col('#6aa647'), grass2: col('#4d8a39'), forest: col('#3f7432'), rock: col('#8a8780'), rock2: col('#6f6c66'), snow: col('#eef2f6'), deep: col('#6f7d6a') };
    const tmpC = new THREE.Color();
    const v = (ix, iz) => [-HALF + ix * CELL, H[iz * W + ix], -HALF + iz * CELL];
    for (let iz = 0; iz < SEG; iz++) for (let ix = 0; ix < SEG; ix++) {
      const a = v(ix, iz), b = v(ix + 1, iz), c = v(ix, iz + 1), d = v(ix + 1, iz + 1);
      for (const tri of [[a, c, b], [b, c, d]]) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3, cz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3;
        // sklon
        const ux = tri[1][0] - tri[0][0], uy = tri[1][1] - tri[0][1], uz = tri[1][2] - tri[0][2];
        const wx = tri[2][0] - tri[0][0], wy = tri[2][1] - tri[0][1], wz = tri[2][2] - tri[0][2];
        const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        const slope = Math.abs(ny) / Math.hypot(nx, ny, nz);
        const n = N.n2(cx * 0.05, cz * 0.05);
        let c0;
        if (cy < -0.6) c0 = tmpC.copy(C.wetSand).lerp(C.deep, clamp(-cy / 10, 0, 1));
        else if (cy < 1.4 + n * 0.5) c0 = tmpC.copy(cy < 0.2 ? C.wetSand : C.sand);
        else if (cy > 38 + n * 3) c0 = tmpC.copy(C.snow);
        else if (slope < 0.78 || cy > 24 + n * 4) c0 = tmpC.copy(n > 0 ? C.rock : C.rock2);
        else { const f = N.fbm(cx * 0.012 + 50, cz * 0.012, 3); c0 = tmpC.copy(C.grass).lerp(f > 0.05 ? C.forest : C.grass2, clamp(Math.abs(f) * 2.2 + n * 0.2, 0, 1)); }
        const k = 1 + n * 0.06;
        for (const p of tri) { pos.push(p[0], p[1], p[2]); cols.push(c0.r * k, c0.g * k, c0.b * k); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true }));
    m.receiveShadow = true;
    m.name = 'terrain';
    this.scene.add(m);
    this.terrain = m;
  },

  buildWater() {
    const geo = new THREE.PlaneGeometry(320, 320, 80, 80); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: col('#1f7f96'), roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.86, flatShading: true });
    this.waves = new THREE.Mesh(geo, mat);
    this.waves.userData.base = geo.attributes.position.array.slice();
    this.scene.add(this.waves);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col('#1a6f86'), roughness: 0.2, metalness: 0.1 }));
    far.position.y = -0.25; this.scene.add(far); this.farWater = far;
    for (const p of this.ponds) {
      const pm = new THREE.Mesh(new THREE.CircleGeometry(p.r * 1.3, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col('#3aa6c4'), roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 }));
      pm.position.set(p.x, p.level, p.z); this.scene.add(pm);
    }
  },
  updateWater(t, cx, cz) {
    const w = this.waves, sx = Math.round(cx / 4) * 4, sz = Math.round(cz / 4) * 4;
    w.position.set(sx, 0, sz);
    const a = w.geometry.attributes.position, base = w.userData.base;
    for (let i = 0; i < a.count; i++) {
      const x = base[i * 3] + sx, z = base[i * 3 + 2] + sz;
      a.array[i * 3 + 1] = Math.sin(x * 0.18 + t * 1.1) * 0.12 + Math.cos(z * 0.21 + t * 0.9) * 0.1 + Math.sin((x + z) * 0.07 + t * 0.6) * 0.15;
    }
    a.needsUpdate = true;
    w.geometry.computeVertexNormals();
  },

  buildSky() {
    const geo = new THREE.SphereGeometry(1200, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, moonDir: { value: new THREE.Vector3() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 moonDir; varying vec3 vP;
        void main(){ vec3 d = normalize(vP); float h = clamp(d.y*1.6+0.15, 0.0, 1.0); vec3 c = mix(bottom, top, pow(h, 0.8));
          float s = max(dot(d, normalize(sunDir)), 0.0); c += sunCol * (pow(s, 600.0)*6.0 + pow(s, 12.0)*0.35);
          float m = max(dot(d, normalize(moonDir)), 0.0); c += vec3(0.75,0.8,0.9) * pow(m, 900.0) * 3.0;
          gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.scene.add(this.sky);
    const sp = [];
    const r = mulberry32(5);
    for (let i = 0; i < 1600; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); if (u < 0.05) continue; sp.push(Math.cos(a) * s * 1100, u * 1100, Math.sin(a) * s * 1100); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a5a3a, 0.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 260;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.moon = new THREE.DirectionalLight(0x8fa8ff, 0);
    this.scene.add(this.moon); this.scene.add(this.moon.target);
    this.scene.fog = new THREE.FogExp2(0xbfe3ff, 0.006);
  },
  // h = hodina dne 0–24
  setTime(h, px, pz) {
    const a = (h - 6) / 12 * Math.PI;
    const sy = Math.sin(a);
    const dir = new THREE.Vector3(Math.cos(a) * 0.85, sy, 0.35).normalize();
    const day = clamp(sy * 3 + 0.25, 0, 1), dusk = clamp(1 - Math.abs(sy) * 4, 0, 1) * (sy > -0.25 ? 1 : 0);
    const S = this.sky.material.uniforms;
    const dayTop = col('#3d86d6'), dayBot = col('#bfe0f5'), duskTop = col('#2c3a78'), duskBot = col('#ff9460'), nightTop = col('#03060f'), nightBot = col('#0b1630');
    const top = nightTop.clone().lerp(dayTop, day).lerp(duskTop, dusk * 0.7), bot = nightBot.clone().lerp(dayBot, day).lerp(duskBot, dusk * 0.85);
    S.top.value.copy(top); S.bottom.value.copy(bot);
    S.sunDir.value.copy(dir); S.sunCol.value.copy(col('#fff2c0').lerp(col('#ff8a40'), dusk)).multiplyScalar(sy > -0.1 ? 1 : 0);
    S.moonDir.value.set(-dir.x, -dir.y, -dir.z);
    this.stars.material.opacity = clamp(1 - day * 1.6, 0, 1) * 0.9;
    this.sun.position.set(px + dir.x * 120, Math.max(5, dir.y * 120), pz + dir.z * 120);
    this.sun.target.position.set(px, 0, pz);
    this.sun.intensity = 1.7 * clamp(sy * 2.5, 0, 1);
    this.sun.color.copy(col('#fff4dc').lerp(col('#ffb070'), dusk));
    this.moon.position.set(px - dir.x * 100, Math.max(10, -dir.y * 100), pz - dir.z * 100);
    this.moon.target.position.set(px, 0, pz);
    this.moon.intensity = 0.32 * clamp(-sy * 3, 0, 1);
    this.hemi.intensity = 0.18 + 0.55 * day;
    this.hemi.color.copy(bot);
    this.scene.fog.color.copy(bot);
    this.scene.fog.density = lerp(0.011, 0.0055, day);
    this.sky.position.set(px, 0, pz);
    this.stars.position.set(px, 0, pz);
    return { day, dusk, night: 1 - day };
  },

  buildClouds(rnd) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 26; i++) {
      const parts = [];
      const n = 3 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) parts.push([T(new THREE.IcosahedronGeometry(6 + rnd() * 6, 0), k * 7 - n * 3.5, rnd() * 3, rnd() * 6 - 3, 0, 0, 0, 1, 0.55, 1), '#ffffff', 0.04, rnd]);
      const m = new THREE.Mesh(mergeParts(parts), mat);
      m.position.set(rnd() * 700 - 350, 85 + rnd() * 30, rnd() * 700 - 350);
      m.userData.v = 1 + rnd() * 2;
      this.scene.add(m); this.clouds.push(m);
    }
  },

  // ── Suroviny ──
  placeNodes(rnd) {
    const want = { tree: 950, pine: 420, palm: 170, rock: 260, ironRock: 50, bush: 200, plant: 320, stick: 220, pebble: 220 };
    const list = {};
    for (const k in want) list[k] = [];
    const N = this.noise;
    const okFor = (k, x, z, h, f) => {
      if (this.isFreshWater(x, z)) return false;
      switch (k) {
        case 'tree': return h > 2 && h < 18 && f > -0.05;
        case 'pine': return h > 11 && h < 32 && f > -0.25;
        case 'palm': return h > 0.5 && h < 2.6;
        case 'rock': return h > 1 && (h > 10 || rnd() < 0.35);
        case 'ironRock': return h > 16 && h < 40;
        case 'bush': return h > 2 && h < 16 && f > -0.2;
        case 'plant': return h > 1.2 && h < 20;
        case 'stick': return h > 2 && h < 20 && f > 0;
        case 'pebble': return h > 0.3 && h < 14;
      }
      return false;
    };
    for (const k in want) {
      let tries = 0;
      while (list[k].length < want[k] && tries++ < want[k] * 40) {
        const x = (rnd() * 2 - 1) * ISLAND_R * 1.05, z = (rnd() * 2 - 1) * ISLAND_R * 1.05;
        const h = this.height(x, z);
        const f = N.fbm(x * 0.012 + 50, z * 0.012, 3);
        if (!okFor(k, x, z, h, f)) continue;
        // sklon – žádné stromy na útesech
        const sl = Math.abs(this.height(x + 1, z) - this.height(x - 1, z)) + Math.abs(this.height(x, z + 1) - this.height(x, z - 1));
        if (sl > (k === 'rock' || k === 'ironRock' ? 3 : 1.6)) continue;
        if (NODES[k].solid && list[k].some(o => Math.abs(o.x - x) < 1.5 && Math.abs(o.z - z) < 1.5)) continue;
        list[k].push({ type: k, i: list[k].length, x, y: h, z, rot: rnd() * Math.PI * 2, s: 0.8 + rnd() * 0.5, hp: NODES[k].hp, alive: true, respawn: 0 });
      }
    }
    // zajistit pár bobulí a větví poblíž startu
    this.nodes = list;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    const dummy = new THREE.Object3D();
    for (const k in list) {
      const geo = MODELS[k](mulberry32(this.seed + k.length * 13));
      const im = new THREE.InstancedMesh(geo, mat, list[k].length);
      im.castShadow = !['plant', 'stick', 'pebble'].includes(k);
      im.receiveShadow = true;
      im.userData.kind = k;
      list[k].forEach((o, i) => { this.setNodeMatrix(im, o, dummy); });
      im.instanceMatrix.needsUpdate = true;
      this.scene.add(im);
      this.meshes[k] = im;
    }
    this.buildNodeGrid();
  },
  setNodeMatrix(im, o, dummy = new THREE.Object3D()) {
    dummy.position.set(o.x, o.y - 0.05, o.z);
    dummy.rotation.set(0, o.rot, 0);
    const s = o.alive ? o.s * (o.grow !== undefined ? o.grow : 1) : 0.0001;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    im.setMatrixAt(o.i, dummy.matrix);
  },
  refreshNode(o) { const im = this.meshes[o.type]; this.setNodeMatrix(im, o); im.instanceMatrix.needsUpdate = true; },
  buildNodeGrid() {
    this.grid = new Map();
    for (const k in this.nodes) if (NODES[k].solid) for (const o of this.nodes[k]) {
      const key = Math.floor(o.x / 8) + ',' + Math.floor(o.z / 8);
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key).push(o);
    }
  },
  solidsNear(x, z) {
    const out = [];
    const cx = Math.floor(x / 8), cz = Math.floor(z / 8);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = this.grid.get((cx + i) + ',' + (cz + j)); if (a) for (const o of a) if (o.alive) out.push(o); }
    return out;
  },
  updateNodes(dt) {
    for (const k in this.nodes) for (const o of this.nodes[k]) {
      if (!o.alive) { o.respawn -= dt; if (o.respawn <= 0) { o.alive = true; o.hp = NODES[k].hp; o.grow = 0.2; this.refreshNode(o); } }
      else if (o.grow !== undefined) { o.grow += dt * 0.08; if (o.grow >= 1) delete o.grow; this.refreshNode(o); }
    }
  },

  buildGrass(rnd) {
    const geo = MODELS.grass(mulberry32(3));
    const count = 22000;
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), count);
    const d = new THREE.Object3D();
    let n = 0;
    for (let t = 0; t < count * 6 && n < count; t++) {
      const x = (rnd() * 2 - 1) * ISLAND_R, z = (rnd() * 2 - 1) * ISLAND_R, h = this.height(x, z);
      if (h < 1.6 || h > 22 || this.isFreshWater(x, z)) continue;
      const sl = Math.abs(this.height(x + 1, z) - h) + Math.abs(this.height(x, z + 1) - h);
      if (sl > 0.9) continue;
      d.position.set(x, h - 0.05, z); d.rotation.set(0, rnd() * 6.28, 0); const s = 0.55 + rnd() * 0.55; d.scale.set(s, s * (0.8 + rnd() * 0.5), s);
      d.updateMatrix(); im.setMatrixAt(n++, d.matrix);
    }
    im.count = n;
    im.receiveShadow = true;
    this.scene.add(im);
    this.grassMesh = im;
  },

  // ── Stavby ──
  addStructure(type, x, z, rot, silent) {
    const g = buildStructure(type);
    const y = type === 'raft' ? 0.05 : this.height(x, z);
    g.position.set(x, y, z); g.rotation.y = rot;
    const s = { type, x, y, z, rot, mesh: g };
    g.userData.structure = s;
    if (STRUCTURES[type].light) {
      const l = new THREE.PointLight(0xff8a3d, 2.2, type === 'campfire' ? 16 : 9, 2);
      l.position.set(0, type === 'campfire' ? 1 : 0.8, type === 'furnace' ? 1 : 0);
      g.add(l); s.light = l;
    }
    this.scene.add(g);
    this.structures.push(s);
    return s;
  },
  removeStructure(s) { this.scene.remove(s.mesh); this.structures = this.structures.filter(x => x !== s); },
  stationNear(type, x, z, r = 4.5) { return this.structures.find(s => s.type === type && Math.hypot(s.x - x, s.z - z) < r); },
  updateStructures(t) {
    for (const s of this.structures) {
      if (s.mesh.userData.flame) {
        const f = s.mesh.userData.flame;
        const k = 1 + Math.sin(t * 13 + s.x) * 0.08 + Math.sin(t * 23 + s.z) * 0.06;
        if (s.type === 'campfire') { f.scale.set(k, 1 + Math.sin(t * 9 + s.x) * 0.15, k); s.mesh.userData.inner.scale.setScalar(k); }
        if (s.light) s.light.intensity = (s.type === 'campfire' ? 2.4 : 1.4) * k;
      }
    }
  },
};
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
