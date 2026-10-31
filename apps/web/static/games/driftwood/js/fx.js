'use strict';
// ── Efekty: částicový oheň, kouř, jiskry, světlušky, déšť a blesky; počasí ──
const FX = (() => {
  // měkká záře (radiální přechod) pro sprity a částice
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  function glowSprite(color, size, opacity = 0.55) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, fog: false }));
    s.scale.set(size, size, 1);
    return s;
  }

  // Systém bodových částic: pozice, barva, průhlednost a velikost v metrech
  const VS = `attribute float alpha; attribute float size; attribute vec3 pcol; varying vec3 vC; varying float vA; uniform float uScale;
    void main(){ vC = pcol; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
  const FS = `varying vec3 vC; varying float vA; uniform float uSoft;
    void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; float a = pow(smoothstep(0.5, 0.0, r), uSoft); gl_FragColor = vec4(vC, vA * a); }`;
  class PointSys {
    constructor(max, additive, soft = 1) {
      this.max = max; this.items = [];
      const g = this.geo = new THREE.BufferGeometry();
      this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.alpha = new Float32Array(max); this.size = new Float32Array(max);
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('pcol', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
      this.mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 600 }, uSoft: { value: soft } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      this.mesh = new THREE.Points(g, this.mat); this.mesh.frustumCulled = false;
    }
    emit(p) { if (this.items.length >= this.max) this.items.shift(); p.age = 0; this.items.push(p); }
    // f(p, t) vrátí [r, g, b, alpha, size] pro stáří t 0..1
    update(dt, f, gravity = 0, drift = 0) {
      this.items = this.items.filter(p => (p.age += dt) < p.life);
      let i = 0;
      for (const p of this.items) {
        p.vy -= gravity * dt; p.x += (p.vx + drift) * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const v = f(p, p.age / p.life);
        this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
        this.col[i * 3] = v[0]; this.col[i * 3 + 1] = v[1]; this.col[i * 3 + 2] = v[2];
        this.alpha[i] = v[3]; this.size[i] = v[4];
        i++;
      }
      this.geo.setDrawRange(0, i);
      for (const k of ['position', 'pcol', 'alpha', 'size']) this.geo.attributes[k].needsUpdate = true;
    }
  }

  const F = {
    glowSprite, glowTex, fire: null, smoke: null, embers: null, flies: null, rain: null, scene: null, emitT: 0,
    init(scene) {
      this.scene = scene;
      this.fire = new PointSys(500, true, 1.4);
      this.embers = new PointSys(160, true, 2);
      this.smoke = new PointSys(260, false, 1);
      this.flies = new PointSys(60, true, 2.2);
      this.dust = new PointSys(120, false, 1);
      for (const s of [this.smoke, this.dust, this.fire, this.embers, this.flies]) scene.add(s.mesh);
      this.smoke.mesh.renderOrder = 2; this.fire.mesh.renderOrder = 3; this.embers.mesh.renderOrder = 3;
      // déšť: svislé čárky kolem kamery
      const N = this.rainN = 1400;
      const rg = new THREE.BufferGeometry();
      this.rainPos = new Float32Array(N * 6);
      rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
      this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xb8c8d8, transparent: true, opacity: 0, depthWrite: false }));
      this.rain.frustumCulled = false; this.rain.visible = false;
      this.drops = Array.from({ length: N }, () => ({ x: rand(-30, 30), y: rand(-12, 16), z: rand(-30, 30), v: rand(18, 26) }));
      scene.add(this.rain);
      this.fireflies = Array.from({ length: 50 }, () => ({ x: 1e5, y: 0, z: 0, tx: 0, tz: 0, ty: 0, ph: Math.random() * 6, sp: rand(1.5, 3.5) }));
    },
    // prach z kroků, šplouchnutí
    puff(x, y, z, color, n = 4, spread = 0.25) {
      if (!this.dust) return;
      const c = col(color);
      for (let i = 0; i < n; i++) this.dust.emit({ x: x + rand(-spread, spread), y: y + 0.05, z: z + rand(-spread, spread), vx: rand(-0.4, 0.4), vy: rand(0.3, 0.9), vz: rand(-0.4, 0.4), life: rand(0.5, 0.9), c, s: rand(0.25, 0.45) });
    },
    update(dt, t, cam, night) {
      if (!this.fire) return;
      const h = Game.renderer ? Game.renderer.domElement.height : 720;
      const scale = h / (2 * Math.tan(cam.fov * Math.PI / 360));
      for (const s of [this.fire, this.smoke, this.embers, this.flies, this.dust]) s.mat.uniforms.uScale.value = scale;
      const cx = cam.position.x, cz = cam.position.z, wind = Weather.cur.wind;
      // emise z ohňů v okolí
      this.emitT += dt;
      const steps = Math.min(4, Math.floor(this.emitT / 0.016)); this.emitT -= steps * 0.016;
      for (const s of World.structures) {
        if (s.type !== 'campfire' && s.type !== 'furnace') continue;
        if (Math.abs(s.x - cx) > 70 || Math.abs(s.z - cz) > 70) continue;
        const camp = s.type === 'campfire', y0 = s.y + (camp ? 0.2 : 1.95);
        for (let k = 0; k < steps; k++) {
          if (camp) this.fire.emit({ x: s.x + rand(-0.18, 0.18), y: y0 + rand(0, 0.1), z: s.z + rand(-0.18, 0.18), vx: rand(-0.15, 0.15), vy: rand(0.9, 1.7), vz: rand(-0.15, 0.15), life: rand(0.45, 0.8), s: rand(0.5, 0.75) });
          if (Math.random() < (camp ? 0.08 : 0.02)) this.embers.emit({ x: s.x + rand(-0.2, 0.2), y: y0 + 0.2, z: s.z + rand(-0.2, 0.2), vx: rand(-0.5, 0.5), vy: rand(1.6, 3.2), vz: rand(-0.5, 0.5), life: rand(1.2, 2.2), s: rand(0.05, 0.09), ph: Math.random() * 6 });
          if (Math.random() < (camp ? 0.07 : 0.1)) this.smoke.emit({ x: s.x + rand(-0.15, 0.15), y: y0 + (camp ? 0.9 : 0.3), z: s.z + rand(-0.15, 0.15), vx: rand(-0.1, 0.1), vy: rand(0.5, 0.9), vz: rand(-0.1, 0.1), life: rand(2.5, 4), s: rand(0.5, 0.8) });
        }
      }
      this.fire.update(dt, (p, a) => [1, lerp(0.85, 0.3, a), lerp(0.45, 0.05, Math.min(1, a * 1.6)), (a < 0.15 ? a / 0.15 : 1) * (1 - a) * 0.9, p.s * (1 - a * 0.85)], -0.6, wind * 0.3);
      this.embers.update(dt, (p, a) => [1, 0.62, 0.25, (1 - a) * (0.6 + 0.4 * Math.sin(t * 20 + p.ph)), p.s], 0.4, wind * 0.6);
      const nightDim = 1 - night * 0.6;
      this.smoke.update(dt, (p, a) => [0.42 * nightDim, 0.4 * nightDim, 0.38 * nightDim, (a < 0.1 ? a * 2 : 0.22) * (1 - a), p.s + a * 2.2], -0.05, wind * 1.2);
      this.dust.update(dt, (p, a) => [p.c.r, p.c.g, p.c.b, 0.35 * (1 - a), p.s + a * 0.5], 1.2);
      // světlušky v noci (ne v dešti)
      const on = Game.playing && night > 0.55 && Weather.cur.rain < 0.1;
      for (const f of this.fireflies) {
        if (!on) { f.x = 1e5; continue; }
        if (Math.hypot(f.x - cx, f.z - cz) > 34) {
          for (let k = 0; k < 6; k++) {
            const a = Math.random() * 6.28, d = rand(6, 30), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, gh = World.height(x, z);
            if (gh > 1.5 && gh < 20 && !World.isFreshWater(x, z)) { f.x = x; f.z = z; f.y = gh + rand(0.5, 2.2); f.tx = x; f.tz = z; f.ty = f.y; break; }
          }
        }
        if (Math.hypot(f.tx - f.x, f.tz - f.z) < 0.3) { f.tx = f.x + rand(-3, 3); f.tz = f.z + rand(-3, 3); f.ty = World.height(f.tx, f.tz) + rand(0.4, 2.4); }
        f.x += (f.tx - f.x) * dt * 0.4; f.z += (f.tz - f.z) * dt * 0.4; f.y += (f.ty - f.y) * dt * 0.5;
        if (f.x < 1e4) this.flies.emit({ x: f.x, y: f.y, z: f.z, vx: 0, vy: 0, vz: 0, life: 0.001, ph: f.ph, sp: f.sp });
      }
      this.flies.update(0, p => [0.75, 1, 0.45, Math.max(0, Math.sin(t * p.sp + p.ph)) * 0.95, 0.16]);
      this.flies.items = [];
      // déšť
      const R = Weather.cur.rain;
      this.rain.visible = R > 0.02 && !!Game.scene;
      if (this.rain.visible) {
        this.rain.material.opacity = 0.18 + 0.32 * R;
        const N = Math.floor(this.rainN * Math.min(1, R * 1.2)), P = this.rainPos, cy = cam.position.y, sx = wind * 3;
        for (let i = 0; i < this.rainN; i++) {
          const d = this.drops[i];
          if (i >= N) { P.fill(0, i * 6, i * 6 + 6); P[i * 6 + 1] = -1e4; P[i * 6 + 4] = -1e4; continue; }
          d.y -= d.v * dt;
          const wx = cx + d.x, wz = cz + d.z;
          if (d.y + cy < Math.max(World.height(wx, wz), World.waterLevelAt(wx, wz)) || d.y < -14) { d.y = rand(10, 18); d.x = rand(-30, 30); d.z = rand(-30, 30); }
          const y = cy + d.y;
          P[i * 6] = wx; P[i * 6 + 1] = y; P[i * 6 + 2] = wz;
          P[i * 6 + 3] = wx - sx * 0.06; P[i * 6 + 4] = y + 0.55; P[i * 6 + 5] = wz;
        }
        this.rain.geometry.attributes.position.needsUpdate = true;
      }
    },
    clear() { for (const s of [this.fire, this.smoke, this.embers, this.flies, this.dust]) if (s) s.items = []; },
  };
  return F;
})();

// ── Počasí: jasno, zataženo, déšť, bouřka (každých 6 herních hodin, ze semínka) ──
const Weather = {
  cur: { cloud: 0.1, rain: 0, wind: 0.2, storm: 0 }, kind: 'clear', flash: 0, nextBolt: 8,
  PARAM: { clear: { cloud: 0.1, rain: 0, wind: 0.2, storm: 0 }, cloudy: { cloud: 0.62, rain: 0, wind: 0.45, storm: 0 }, rain: { cloud: 0.88, rain: 0.7, wind: 0.55, storm: 0 }, storm: { cloud: 1, rain: 1, wind: 1, storm: 1 } },
  NAMES: { clear: L('Jasno', 'Clear'), cloudy: L('Zataženo', 'Cloudy'), rain: L('Déšť', 'Rain'), storm: L('Bouřka', 'Storm') },
  ICONS: { clear: 'sun', cloudy: 'cloud', rain: 'rain', storm: 'storm' },
  kindAt(block) {
    if (block < 6) return 'clear'; // první den a půl je vždy hezky
    const r = mulberry32(((G.seed >>> 0) ^ Math.imul(block + 1, 2654435761)) >>> 0)();
    return r < 0.5 ? 'clear' : r < 0.73 ? 'cloudy' : r < 0.91 ? 'rain' : 'storm';
  },
  update(dt, playing) {
    const tH = (G.day - 1) * 24 + G.hour, block = Math.floor(tH / 6), f = tH / 6 - block;
    const ka = playing ? this.kindAt(block) : 'clear', kb = playing ? this.kindAt(block + 1) : 'clear';
    const k = smoothstep(0.8, 1, f), A = this.PARAM[ka], B = this.PARAM[kb];
    const c = this.cur, q = Math.min(1, dt * 0.35);
    for (const n of ['cloud', 'rain', 'wind', 'storm']) c[n] += (lerp(A[n], B[n], k) - c[n]) * q;
    this.kind = k < 0.5 ? ka : kb;
    if (c.storm > 0.6 && playing) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.flash = 1; this.nextBolt = rand(7, 22); Sound.play.thunder(rand(0.4, 2.6)); }
    }
    this.flash = Math.max(0, this.flash - dt * 3.5);
  },
  // venku v dešti (ne pod přístřeškem)
  exposed(P) { return this.cur.rain > 0.15 && !World.structures.some(s => s.type === 'shelter' && Math.hypot(s.x - P.x, s.z - P.z) < 1.8); },
};
