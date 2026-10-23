'use strict';
// ── Předměty na zemi (doplněno pro Windowling Game Center) ─────────────────
// Q vyhodí předmět z lišty (Shift+Q celý stoh), přetažením mimo inventář se vyhodí celý
// slot. Na zemi leží jako malý balík s ikonou; E ho sebere. V multiplayeru o nich rozhoduje
// server (Drops.net), aby jeden předmět nesebrali dva hráči.
const Drops = (() => {
  const MAX = 150;
  const tex = {};
  const geo = new THREE.BoxGeometry(0.32, 0.22, 0.32);
  const hitGeo = new THREE.BoxGeometry(0.7, 0.6, 0.7);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  // Ikona předmětu jako textura (SVG z ICONS v barvě předmětu).
  function iconTex(id) {
    if (tex[id]) return tex[id];
    const it = ITEMS[id], c = document.createElement('canvas');
    c.width = c.height = 128;
    const t = tex[id] = new THREE.CanvasTexture(c);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${it.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[it.icon] || ICONS.stone}</svg>`;
    const img = new Image();
    img.onload = () => {
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(18,16,12,0.62)'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
      g.drawImage(img, 16, 16, 96, 96);
      t.needsUpdate = true;
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return t;
  }

  function mesh(d) {
    const it = ITEMS[d.item.id];
    const g = new THREE.Group();
    const box = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.8, emissive: it.color, emissiveIntensity: 0.15 }));
    box.castShadow = true;
    g.add(box);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(d.item.id), depthWrite: false, transparent: true }));
    sp.scale.set(0.42, 0.42, 1); sp.position.y = 0.5;
    g.add(sp);
    g.add(new THREE.Mesh(hitGeo, hitMat));
    g.userData.drop = d;
    g.userData.box = box; g.userData.icon = sp;
    return g;
  }

  // Kam položit: kousek před hráče, na zem nebo na hladinu.
  function spot(P) {
    const x = P.x - Math.sin(P.yaw) * 1.1, z = P.z - Math.cos(P.yaw) * 1.1;
    return { x: +x.toFixed(2), z: +z.toFixed(2) };
  }
  const groundY = (x, z) => Math.max(World.height(x, z), World.waterLevelAt(x, z) - 0.05);

  const D = {
    list: [],
    net: null, // multiplayer: { drop(item, x, z), take(d) }
    seq: 0,
    item(slot, n) {
      const o = { id: slot.id, n };
      if (slot.dur !== undefined) o.dur = slot.dur;
      if (slot.ch !== undefined) o.ch = slot.ch;
      return o;
    },
    spawn(item, x, z, id) {
      if (!ITEMS[item.id] || !Game.scene) return null;
      const d = { id: id || `l${++this.seq}`, item, x, z, y: groundY(x, z), t: Math.random() * 6 };
      d.mesh = mesh(d);
      d.mesh.position.set(x, d.y + 0.2, z);
      Game.scene.add(d.mesh);
      this.list.push(d);
      while (this.list.length > MAX) this.remove(this.list[0].id);
      return d;
    },
    remove(id) {
      const d = this.list.find(o => o.id === id);
      if (!d) return;
      Game.scene.remove(d.mesh);
      d.mesh.userData.box.material.dispose(); d.mesh.userData.icon.material.dispose();
      this.list = this.list.filter(o => o !== d);
      if (Player.target && Player.target.d === d) Player.target = null;
    },
    clear() { for (const d of this.list.slice()) this.remove(d.id); this.list = []; },

    // Vyhodit n kusů ze slotu i (výchozí: vybraný slot v liště).
    dropSlot(i, n) {
      const s = Inv.slots[i], P = Player.P;
      if (!s || !P || P.dead) return false;
      n = Math.min(n || s.n, s.n);
      const item = this.item(s, n);
      s.n -= n; if (!s.n) Inv.slots[i] = null;
      const { x, z } = spot(P);
      if (this.net) this.net.drop(item, x, z);
      else this.spawn(item, x, z);
      Sound.play.pick();
      UI.renderHotbar();
      return true;
    },
    // Sebrat předmět ze země (v multiplayeru až po potvrzení serverem).
    take(d) {
      if (d.pending) return;
      if (this.net) { d.pending = true; setTimeout(() => { d.pending = false; }, 1500); this.net.take(d); return; }
      this.remove(d.id);
      this.give(d.item, d.x, d.z);
    },
    // Přidat do inventáře; co se nevejde, zůstane ležet.
    give(item, x, z) {
      const extra = {};
      if (item.dur !== undefined) extra.dur = item.dur;
      if (item.ch !== undefined) extra.ch = item.ch;
      const left = Inv.add(item.id, item.n, extra);
      if (left < item.n) UI.gain(item.id, item.n - left);
      if (left > 0) {
        UI.msg(L('Inventář je plný', 'Inventory is full'));
        const rest = Object.assign({}, item, { n: left });
        if (this.net) this.net.drop(rest, x, z); else this.spawn(rest, x, z);
      }
      Sound.play.pick();
      UI.renderHotbar();
    },
    // Nejbližší předmět u nohou (když se na žádný přímo nedívá).
    near(P, r = 1.5) {
      let best = null, bd = r;
      for (const d of this.list) { const k = Math.hypot(d.x - P.x, d.z - P.z); if (k < bd) { bd = k; best = d; } }
      return best;
    },
    update(t) {
      for (const d of this.list) {
        d.mesh.position.y = d.y + 0.2 + Math.sin(t * 2 + d.t) * 0.05;
        d.mesh.userData.box.rotation.y = t * 0.8 + d.t;
      }
    },
    // Uložení v sólo hře.
    save() { return this.list.slice(-MAX).map(d => ({ item: d.item, x: d.x, z: d.z })); },
    load(list) { for (const d of list || []) this.spawn(d.item, d.x, d.z); },
    label(d) { const it = ITEMS[d.item.id]; return `${it.name}${d.item.n > 1 ? ' ×' + d.item.n : ''}`; },
  };
  return D;
})();
