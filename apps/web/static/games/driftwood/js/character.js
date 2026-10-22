'use strict';
// ── Nástroje: sdílená geometrie pro pohled z očí i pro postavu ──────────────
// Násada míří po +y z počátku (místo úchopu). Hlavice sekery/krumpáče leží v ose x.
function buildToolGeo(id) {
  const it = id && ITEMS[id];
  if (!it) return null;
  const type = it.tool ? it.tool.type : null;
  const iron = /^iron/.test(id);
  const metal = iron ? '#dfe6ee' : '#9aa0a6';
  const parts = [];
  if (type === 'axe') {
    // ostří na -x
    parts.push([T(new THREE.CylinderGeometry(0.03, 0.036, 0.84, 6), 0, 0.3, 0), '#7a5232']);
    parts.push([T(new THREE.BoxGeometry(0.08, 0.1, 0.07), 0, 0.64, 0), iron ? '#8a939c' : '#6a4428']);
    parts.push([T(new THREE.BoxGeometry(0.16, 0.13, 0.045), -0.1, 0.63, 0), metal]);
    parts.push([T(new THREE.BoxGeometry(0.035, 0.2, 0.025), -0.19, 0.63, 0), iron ? '#f2f6fa' : '#b3aea8']);
    if (!iron) parts.push([T(new THREE.CylinderGeometry(0.042, 0.042, 0.08, 6), 0, 0.56, 0), '#c9a77a']);
  } else if (type === 'pick') {
    // zahnutá hlavice: objímka, dvě zužující se ramena a hroty svěšené dolů
    const head = iron ? '#d6dde5' : '#9a9590', edge = iron ? '#f2f6fa' : '#b3aea8';
    parts.push([T(new THREE.CylinderGeometry(0.028, 0.036, 0.86, 6), 0, 0.3, 0), '#7a5232']);
    parts.push([T(new THREE.BoxGeometry(0.085, 0.13, 0.085), 0, 0.68, 0), iron ? '#8a939c' : '#6a4428']);
    for (const sd of [-1, 1]) {
      parts.push([T(new THREE.BoxGeometry(0.16, 0.075, 0.068), sd * 0.11, 0.685, 0, 0, 0, -sd * 0.1), head]);
      parts.push([T(new THREE.BoxGeometry(0.14, 0.058, 0.054), sd * 0.24, 0.66, 0, 0, 0, -sd * 0.32), head]);
      parts.push([T(new THREE.ConeGeometry(0.032, 0.14, 4), sd * 0.34, 0.615, 0, 0, Math.PI / 4, -sd * (Math.PI / 2 + 0.6)), edge]);
    }
    if (!iron) parts.push([T(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 6), 0, 0.6, 0), '#c9a77a']);
  } else if (type === 'weapon') {
    parts.push([T(new THREE.CylinderGeometry(0.025, 0.03, 1.5, 5), 0, 0.2, 0), '#8a5c34'], [T(new THREE.ConeGeometry(0.05, 0.26, 4), 0, 1.07, 0), metal]);
  } else if (id === 'torch') {
    parts.push([T(new THREE.CylinderGeometry(0.03, 0.04, 0.6, 5), 0, 0.22, 0), '#6a4428'], [T(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 6), 0, 0.55, 0), '#3a2a1a']);
  } else parts.push([T(new THREE.IcosahedronGeometry(0.09, 0), 0, 0.1, -0.02), it.color]);
  return { geo: mergeParts(parts), type, torch: id === 'torch' };
}
const torchFlame = () => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), new THREE.MeshBasicMaterial({ color: 0xffb040 })); f.position.set(0, 0.72, 0); return f; };

// ── Vzhled postavy ──────────────────────────────────────────────────────────
const LOOKS = {
  skin: ['#f1c9a5', '#e0b48c', '#c68e63', '#9a6a45', '#6e4a30'],
  hair: ['#2a1d15', '#5a3a22', '#a8743f', '#e0c080', '#c4452c', '#d8d8d8'],
  shirt: ['#3f7fb5', '#c9503c', '#4f8f3a', '#d8a93a', '#7a5ab0', '#e8e2d4'],
  pants: ['#4a4038', '#2f3a52', '#6b5a3e', '#3e5a3a', '#1f1f24'],
};
const defaultLook = () => ({ skin: 1, hair: 1, shirt: 0, pants: 0 });

// ── Postava (hráč i budoucí spoluhráči) ─────────────────────────────────────
// Ovládá se přes setState(); pozici a natočení nastavuje volající.
class Character {
  constructor(look = defaultLook()) {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    this.state = { moving: false, speed: 0, onGround: true, swim: false, swing: 0, item: null, sprint: false };
    this.phase = 0; this.yaw = 0; this.heldId = undefined;
    this.build(look);
  }
  build(look) {
    while (this.body.children.length) this.body.remove(this.body.children[0]);
    this.look = Object.assign(defaultLook(), look);
    const c = k => LOOKS[k][this.look[k] % LOOKS[k].length];
    const skin = c('skin'), hair = c('hair'), shirt = c('shirt'), pants = c('pants'), boots = '#3a2a1e';
    const mesh = parts => { const m = new THREE.Mesh(mergeParts(parts), this.mat); m.castShadow = true; return m; };
    // trup a hlava
    this.torso = new THREE.Group(); this.torso.position.y = 0.92; this.body.add(this.torso);
    this.torso.add(mesh([
      [T(new THREE.BoxGeometry(0.46, 0.6, 0.26), 0, 0.3, 0), shirt, 0.05],
      [T(new THREE.BoxGeometry(0.48, 0.07, 0.28), 0, 0.02, 0), '#5a3a22'],
      [T(new THREE.BoxGeometry(0.34, 0.42, 0.16), 0, 0.32, 0.2), '#8a6a42', 0.06],
      [T(new THREE.BoxGeometry(0.36, 0.1, 0.18), 0, 0.55, 0.2), '#6a4a2a'],
      [T(new THREE.BoxGeometry(0.12, 0.08, 0.12), 0, 0.64, 0), skin],
    ]));
    this.head = new THREE.Group(); this.head.position.y = 0.68; this.torso.add(this.head);
    this.head.add(mesh([
      [T(new THREE.BoxGeometry(0.28, 0.3, 0.28), 0, 0.15, 0), skin, 0.04],
      [T(new THREE.BoxGeometry(0.3, 0.1, 0.3), 0, 0.31, 0.01), hair],
      [T(new THREE.BoxGeometry(0.3, 0.2, 0.08), 0, 0.2, 0.12), hair],
      [T(new THREE.BoxGeometry(0.05, 0.04, 0.02), -0.07, 0.17, -0.145), '#1a1410'],
      [T(new THREE.BoxGeometry(0.05, 0.04, 0.02), 0.07, 0.17, -0.145), '#1a1410'],
      [T(new THREE.BoxGeometry(0.06, 0.07, 0.05), 0, 0.11, -0.16), skin],
    ]));
    // ruce: kloub v rameni, dlaň dole (-y)
    const arm = side => {
      const g = new THREE.Group(); g.position.set(side * 0.31, 0.56, 0); this.torso.add(g);
      g.add(mesh([[T(new THREE.BoxGeometry(0.14, 0.32, 0.15), 0, -0.14, 0), shirt, 0.05], [T(new THREE.BoxGeometry(0.12, 0.28, 0.13), 0, -0.42, 0), skin], [T(new THREE.BoxGeometry(0.13, 0.1, 0.14), 0, -0.6, 0), skin]]));
      const hand = new THREE.Group(); hand.position.set(0, -0.6, 0); g.add(hand);
      return { g, hand };
    };
    const L = arm(-1), R = arm(1);
    this.armL = L.g; this.armR = R.g; this.handR = R.hand;
    // nohy: kloub v kyčli
    const leg = side => {
      const g = new THREE.Group(); g.position.set(side * 0.12, 0.92, 0); this.body.add(g);
      g.add(mesh([[T(new THREE.BoxGeometry(0.19, 0.48, 0.21), 0, -0.24, 0), pants, 0.05], [T(new THREE.BoxGeometry(0.17, 0.36, 0.19), 0, -0.64, 0), pants, 0.05], [T(new THREE.BoxGeometry(0.19, 0.12, 0.28), 0, -0.86, -0.04), boots]]));
      return g;
    };
    this.legL = leg(-1); this.legR = leg(1);
    this.heldId = undefined;
  }
  setLook(look) { const id = this.state.item; this.build(look); this.state.item = id; }
  setState(s) { Object.assign(this.state, s); }
  hold(id) {
    if (this.heldId === id) return;
    this.heldId = id;
    while (this.handR.children.length) this.handR.remove(this.handR.children[0]);
    const t = buildToolGeo(id);
    if (!t) return;
    const m = new THREE.Mesh(t.geo, this.mat); m.castShadow = true;
    // v soustavě paže: násada míří dopředu (-z), ostří/hrot ve směru paže (-y),
    // takže při úderu shora vede ostří; oštěp je při držení vodorovně, pochodeň svisle
    if (t.type === 'axe' || t.type === 'pick') {
      // násada je v dlani skloněná o a rad k ose paže (jako při skutečném seknutí)
      const a = 0.9;
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, Math.cos(a), -Math.sin(a)), new THREE.Vector3(0, -Math.sin(a), -Math.cos(a)), new THREE.Vector3(-1, 0, 0)));
    } else if (t.type === 'weapon') m.rotation.x = -Math.PI / 2 - 0.6;
    else if (t.torch) m.rotation.x = -0.6;
    m.position.set(0, -0.02, -0.02);
    if (t.torch) m.add(torchFlame());
    this.handR.add(m);
  }
  update(dt) {
    const s = this.state;
    this.hold(s.item);
    this.root.rotation.y = this.yaw;
    const sp = s.moving ? (s.sprint ? 1 : 0.65) : 0;
    this.phase += dt * (s.swim ? 3 : s.sprint ? 11 : 8) * (s.moving ? 1 : 0);
    const w = Math.sin(this.phase);
    // plavání: tělo vodorovně
    const swimTilt = s.swim ? (s.moving ? 1.25 : 0.35) : 0;
    this.body.rotation.x = lerp(this.body.rotation.x, -swimTilt, Math.min(1, dt * 6));
    this.body.position.y = s.swim ? 0.85 : (s.moving && s.onGround ? Math.abs(Math.cos(this.phase)) * 0.06 * sp : Math.sin(performance.now() / 600) * 0.008);
    let legA = w * 0.75 * sp, armA = -w * 0.6 * sp;
    if (s.swim) { legA = Math.sin(this.phase * 2) * 0.35; armA = Math.sin(this.phase) * 1.4; }
    if (!s.onGround && !s.swim) { legA = 0.5; armA = -0.4; }
    this.legL.rotation.x = legA; this.legR.rotation.x = s.onGround || s.swim ? -legA : -0.3;
    this.armL.rotation.x = armA; this.armL.rotation.z = -0.08;
    // pravá ruka: držení nástroje a úder (nápřah nad hlavu, úder dolů)
    const it = s.item && ITEMS[s.item];
    const holding = !!it;
    const u = s.swing > 0 ? 1 - s.swing : 1;
    let armR;
    if (s.swim) armR = -armA;
    else if (s.swing > 0 && it && it.tool && it.tool.type === 'weapon') armR = u < 0.2 ? lerp(0.6, 0.3, u / 0.2) : u < 0.42 ? lerp(0.3, 1.05, (u - 0.2) / 0.22) : lerp(1.05, 0.6, ease((u - 0.42) / 0.58));
    else if (s.swing > 0) armR = u < 0.2 ? lerp(holding ? 0.6 : 0.2, 2.8, u / 0.2) : u < 0.42 ? lerp(2.8, 0.3, (u - 0.2) / 0.22) : lerp(0.3, holding ? 0.6 : 0.2, ease((u - 0.42) / 0.58));
    else armR = holding ? 0.6 + (s.moving ? -armA * 0.3 : 0) : -armA;
    this.armR.rotation.x = armR; this.armR.rotation.z = 0.08;
    this.torso.rotation.y = s.swing > 0 ? Math.sin((1 - s.swing) * Math.PI) * -0.25 : 0;
  }
}

// ── Kamera: první a třetí osoba ─────────────────────────────────────────────
const CameraRig = {
  dist: 0, pos: new THREE.Vector3(),
  // umístí kameru; vrací vzdálenost kamery od očí (pro dosah interakce)
  place(cam, P, third, dt, bobY) {
    const eyeY = P.y + (P.swim ? 1.65 : EYE);
    cam.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    if (!third) { cam.position.set(P.x, eyeY + bobY, P.z); this.dist = 0; this.pos.copy(cam.position); return 0; }
    const fx = -Math.sin(P.yaw) * Math.cos(P.pitch), fy = Math.sin(P.pitch), fz = -Math.cos(P.yaw) * Math.cos(P.pitch);
    const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const tx = P.x + rx * 0.45, ty = eyeY + 0.05, tz = P.z + rz * 0.45;
    // zkrátit, pokud by kamera zajela pod terén
    let d = 3.6;
    for (let k = 1; k <= 12; k++) {
      const t = d * k / 12, x = tx - fx * t, y = ty - fy * t, z = tz - fz * t;
      if (y < World.height(x, z) + 0.35) { d = Math.max(0.6, t - 0.3); break; }
    }
    this.dist += (d - this.dist) * Math.min(1, dt * (d < this.dist ? 20 : 4));
    cam.position.set(tx - fx * this.dist, ty - fy * this.dist, tz - fz * this.dist);
    const g = World.height(cam.position.x, cam.position.z) + 0.3;
    if (cam.position.y < g) cam.position.y = g;
    this.pos.copy(cam.position);
    return this.dist + 0.45;
  },
};
