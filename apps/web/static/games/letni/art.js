'use strict';
// ── LETNÍ HRY · kresba ──────────────────────────────────────────────────────
// Atlet z obrysovaných tvarů (dres s číslem, trenky, tretry, čelenka s vlajícími cípy), letní
// stadion (slunce, střecha s praporky, stožáry světel, fandící tribuna s vlajkami, světelná
// tabule, reklamní mantinel, posekaný trávník) a tartanová dráha. Sdílí je hra i úvodní obrázek.
const LhArt = (() => {
  const TAU = Math.PI * 2, OL = '#2b1712';
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const mix = (c, to, k) => { const a = hex(c), b = hex(to); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`; };

  // ── Atlet ──
  // Úhly končetin: 0 = svisle dolů, kladné dopředu (doprava). Dvojice [stehno/paže, bérec/předloktí].
  function poseOf(pose, ph, speed) {
    switch (pose) {
      case 'run': {
        const t1 = Math.sin(ph) * 0.95, k1 = Math.max(0, -Math.cos(ph)) * 1.7 + 0.15, k2 = Math.max(0, Math.cos(ph)) * 1.7 + 0.15;
        return { lean: 0.1 + Math.min(0.2, speed * 0.016), legs: [[t1, t1 - k1], [-t1, -t1 - k2]], arms: [[-t1 * 0.95, -t1 * 0.95 + 1.7], [t1 * 0.95, t1 * 0.95 + 1.7]], snap: true };
      }
      case 'set': return { lean: 1.25, legs: [[1.75, 0.15], [0.85, -1.2]], arms: [[0.05, 0.05], [-0.05, -0.05]], snap: true, hands: true };
      case 'takeoff': return { lean: -0.08, legs: [[1.5, -0.05], [-0.35, -0.45]], arms: [[2.7, 2.9], [-0.9, -0.3]], snap: true };
      case 'jump': return { lean: 0.1, legs: [[1.5, 0.2], [1.2, -0.3]], arms: [[2.7, 2.5], [2.3, 2.2]] };
      case 'hurdle': return { lean: 0.55, legs: [[1.55, 1.55], [-1.3, -2.7]], arms: [[1.7, 1.9], [-0.9, 0.3]] };
      case 'land': return { lean: 0.55, legs: [[1.45, 1.55], [1.35, 1.5]], arms: [[1.5, 1.4], [1.25, 1.2]], snap: true, hip: true };
      case 'throw': return { lean: -0.28, legs: [[0.55, 0.4], [-0.55, -0.35]], arms: [[-2.1, -2.5], [1.1, 1.4]], snap: true };
      case 'release': return { lean: 0.22, legs: [[0.65, 0.5], [-0.65, -0.25]], arms: [[2.5, 2.9], [-0.7, -0.4]], snap: true };
      case 'fall': return { lean: 1.0, legs: [[1.6, 1.6], [1.3, 1.1]], arms: [[2.8, 2.8], [2.5, 2.4]] };
      case 'cheer': return { lean: 0, legs: [[0.15, 0.15], [-0.15, -0.15]], arms: [[2.6, 2.9 + Math.sin(ph) * 0.2], [-2.6, -2.9 - Math.sin(ph) * 0.2]], snap: true };
      default: return { lean: 0.02, legs: [[0.12, 0.12], [-0.12, -0.12]], arms: [[0.22, 0.1], [-0.22, -0.1]], snap: true };
    }
  }
  const TH = 0.46, SH = 0.48, UA = 0.3, FA = 0.28;
  // (x, y) jsou chodidla na zemi, s = pixely na metr. o: { pose, phase, speed, shirt, shorts, skin, hair, shoe, num, alpha, t }
  function athlete(g, x, y, s, o) {
    const P = poseOf(o.pose || 'run', o.phase || 0, o.speed || 0), lean = P.lean;
    const shirt = o.shirt || '#ff5a7a', shorts = o.shorts || '#1b2a6b', skin = o.skin || '#ffcf9e', hair = o.hair || '#3a2414', shoe = o.shoe || '#ffd34d';
    const skinB = mix(skin, '#6b3a22', 0.28);
    const at = (p, a, l) => [p[0] + Math.sin(a) * l, p[1] + Math.cos(a) * l];
    const hip = [0, -0.95], up = [Math.sin(lean), -Math.cos(lean)], neck = [hip[0] + up[0] * 0.56, hip[1] + up[1] * 0.56], sh = [neck[0] - up[0] * 0.06, neck[1] - up[1] * 0.06];
    const legPts = P.legs.map(([a1, a2]) => { const k = at(hip, a1, TH); return [k, at(k, a2, SH)]; });
    const armPts = P.arms.map(([a1, a2]) => { const k = at(sh, a1, UA); return [k, at(k, a2, FA)]; });
    // přichycení k zemi: nejnižší bod (chodidla, u startu ruce, při dopadu zadek) leží na nule
    let oy = 0;
    if (P.snap) { let m = Math.max(legPts[0][1][1] + 0.03, legPts[1][1][1] + 0.03); if (P.hands) m = Math.max(m, armPts[0][1][1] + 0.04, armPts[1][1][1] + 0.04); if (P.hip) m = Math.max(m, hip[1] + 0.13); oy = -m; }
    g.save(); g.translate(x, y + oy * s); g.scale(s, s); g.globalAlpha = o.alpha ?? 1;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const seg2 = (a, b, c, w1, w2, col) => {
      for (const [lw, cc] of [[0.045, OL], [0, col]]) {
        g.strokeStyle = cc; g.lineWidth = w1 + lw; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        g.lineWidth = w2 + lw; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();
      }
    };
    const shoeAt = (k, f, col, a2) => {
      g.save(); g.translate(f[0], f[1]); g.rotate(-Math.max(-1.2, Math.min(1.2, a2 * 0.55)));
      g.fillStyle = col; g.strokeStyle = OL; g.lineWidth = 0.035;
      g.beginPath(); g.moveTo(-0.07, 0.03); g.quadraticCurveTo(-0.08, -0.07, 0.0, -0.06); g.quadraticCurveTo(0.12, -0.04, 0.17, 0.02); g.lineTo(0.17, 0.04); g.lineTo(-0.07, 0.04); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.fillRect(-0.07, 0.025, 0.24, 0.02);
      g.restore();
    };
    const shortsOn = (k, col) => { const d = [(k[0] - hip[0]) * 0.42, (k[1] - hip[1]) * 0.42]; for (const [lw, cc] of [[0.045, OL], [0, col]]) { g.strokeStyle = cc; g.lineWidth = 0.21 + lw; g.beginPath(); g.moveTo(hip[0], hip[1]); g.lineTo(hip[0] + d[0], hip[1] + d[1]); g.stroke(); } };
    // zadní noha a ruka (stín)
    seg2(hip, legPts[1][0], legPts[1][1], 0.15, 0.12, skinB); shoeAt(legPts[1][0], legPts[1][1], mix(shoe, '#000000', 0.25), P.legs[1][1]);
    shortsOn(legPts[1][0], mix(shorts, '#000000', 0.25));
    seg2(sh, armPts[1][0], armPts[1][1], 0.1, 0.085, skinB);
    // přední noha
    seg2(hip, legPts[0][0], legPts[0][1], 0.16, 0.125, skin); shoeAt(legPts[0][0], legPts[0][1], shoe, P.legs[0][1]);
    shortsOn(legPts[0][0], shorts);
    // trup: tílko se širší hrudí, pruh a startovní číslo
    const pp = [Math.cos(lean), Math.sin(lean)], pt = (k, w) => [hip[0] + up[0] * k + pp[0] * w, hip[1] + up[1] * k + pp[1] * w];
    g.fillStyle = shirt; g.strokeStyle = OL; g.lineWidth = 0.045;
    g.beginPath();
    const tp = [pt(0.02, -0.12), pt(0.02, 0.12), pt(0.36, 0.16), pt(0.54, 0.11), pt(0.56, -0.08), pt(0.36, -0.13)];
    g.moveTo(tp[0][0], tp[0][1]); g.lineTo(tp[1][0], tp[1][1]); g.quadraticCurveTo(tp[2][0], tp[2][1], tp[3][0], tp[3][1]); g.lineTo(tp[4][0], tp[4][1]); g.quadraticCurveTo(tp[5][0], tp[5][1], tp[0][0], tp[0][1]);
    g.fill(); g.stroke();
    g.save(); g.clip(); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 0.05; g.beginPath(); const s1 = pt(0, -0.06), s2 = pt(0.6, -0.02); g.moveTo(s1[0], s1[1]); g.lineTo(s2[0], s2[1]); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.14)'; g.beginPath(); const b1 = pt(0, -0.14), b2 = pt(0.6, -0.14), b3 = pt(0.6, -0.04), b4 = pt(0, -0.07); g.moveTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]); g.lineTo(b3[0], b3[1]); g.lineTo(b4[0], b4[1]); g.fill(); g.restore();
    if (o.num) {
      const c = pt(0.3, 0.06); g.save(); g.translate(c[0], c[1]); g.rotate(lean);
      g.fillStyle = '#fff'; g.strokeStyle = OL; g.lineWidth = 0.02; g.beginPath(); g.roundRect(-0.075, -0.08, 0.15, 0.13, 0.02); g.fill(); g.stroke();
      g.fillStyle = '#16123a'; g.scale(0.01, 0.01); g.font = '800 9px Unbounded, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(o.num), 0, -1.2);
      g.restore();
    }
    // krk a hlava
    const hc = [neck[0] + up[0] * 0.17 + 0.02, neck[1] + up[1] * 0.17];
    for (const [lw, cc] of [[0.045, OL], [0, skin]]) { g.strokeStyle = cc; g.lineWidth = 0.1 + lw; g.beginPath(); g.moveTo(neck[0], neck[1]); g.lineTo(hc[0], hc[1]); g.stroke(); }
    g.save(); g.translate(hc[0], hc[1]); g.rotate(lean * 0.4);
    // cípy čelenky vlají dozadu
    const fl = Math.sin((o.t || 0) * 18 + (o.phase || 0)) * 0.03, wv = Math.min(1, 0.3 + (o.speed || 0) / 10);
    g.fillStyle = shirt; g.strokeStyle = OL; g.lineWidth = 0.025;
    for (const k of [0, 1]) { g.beginPath(); g.moveTo(-0.13, -0.05); g.quadraticCurveTo(-0.25 * wv - 0.05, -0.08 + fl + k * 0.06, -0.33 * wv - 0.06, -0.02 + fl * 2 + k * 0.07); g.lineTo(-0.3 * wv - 0.06, 0.02 + fl * 2 + k * 0.07); g.quadraticCurveTo(-0.2 * wv - 0.05, -0.02 + fl, -0.13, -0.01); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = skin; g.strokeStyle = OL; g.lineWidth = 0.045; g.beginPath(); g.ellipse(0, 0, 0.15, 0.165, 0, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0.13, -0.02); g.quadraticCurveTo(0.2, 0.02, 0.14, 0.05); g.fill(); g.lineWidth = 0.02; g.stroke(); // nos
    g.fillStyle = hair; g.beginPath(); g.moveTo(-0.16, 0.04); g.quadraticCurveTo(-0.19, -0.18, 0.02, -0.18); g.quadraticCurveTo(0.15, -0.17, 0.16, -0.06); g.lineTo(0.05, -0.08); g.quadraticCurveTo(-0.04, -0.02, -0.08, 0.06); g.closePath(); g.fill();
    g.fillStyle = shirt; g.strokeStyle = OL; g.lineWidth = 0.02; g.beginPath(); g.moveTo(-0.155, -0.07); g.quadraticCurveTo(0, -0.12, 0.155, -0.08); g.lineTo(0.15, -0.03); g.quadraticCurveTo(0, -0.07, -0.155, -0.015); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = skinB; g.beginPath(); g.arc(-0.03, 0.02, 0.035, 0, TAU); g.fill(); // ucho
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0.075, 0.0, 0.035, 0.03, 0, 0, TAU); g.fill();
    g.fillStyle = '#1a1020'; g.beginPath(); g.arc(0.088, 0.003, 0.018, 0, TAU); g.fill();
    g.strokeStyle = OL; g.lineWidth = 0.018; g.beginPath(); g.arc(0.08, 0.07, 0.04, 0.2, 1.4); g.stroke(); // úsměv
    g.restore();
    // přední paže
    seg2(sh, armPts[0][0], armPts[0][1], 0.105, 0.09, skin);
    g.restore();
    const hd = armPts[0][1];
    return { hand: [x + hd[0] * s, y + (hd[1] + oy) * s] };
  }

  // ── Stadion ──
  function makeCrowd(seed) {
    const r = rngOf(seed), out = [];
    const shirts = ['#ff5a7a', '#55f6ff', '#ffd34d', '#6dff9e', '#c77dff', '#ffffff', '#ff9a3d', '#3d7bff', '#ff4d4d'];
    const skins = ['#ffd9b3', '#f1c08e', '#d79a6a', '#a8694a', '#6e4330'], hairs = ['#3a2414', '#1a1210', '#d8a24a', '#8a4a20', '#e8e0d0'];
    for (let row = 0; row < 6; row++) for (let i = 0; i < 64; i++) {
      out.push({ x: i * 22 + r() * 14 + (row % 2) * 11, row, col: shirts[Math.floor(r() * shirts.length)], skin: skins[Math.floor(r() * skins.length)], hair: hairs[Math.floor(r() * hairs.length)], ph: r() * TAU, flag: r() < 0.06 ? shirts[Math.floor(r() * shirts.length)] : null, arms: r() < 0.5, empty: r() < 0.06 });
    }
    return out;
  }
  const W_CROWD = 1408;
  let trackPat = null;
  function trackPattern(g) {
    if (trackPat) return trackPat;
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const q = c.getContext('2d'), r = rngOf(99);
    q.fillStyle = '#c9512f'; q.fillRect(0, 0, 128, 64);
    for (let i = 0; i < 900; i++) { q.fillStyle = r() < 0.5 ? 'rgba(255,190,150,.14)' : 'rgba(80,20,10,.16)'; q.fillRect(r() * 128, r() * 64, 1 + r() * 1.5, 1); }
    trackPat = g.createPattern(c, 'repeat');
    return trackPat;
  }
  // ikonka disciplíny ve stylu olympijských piktogramů (bílá silueta)
  function pictogram(g, ev, x, y, s, col = '#fff') {
    g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 2.6;
    const line = (...p) => { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); };
    if (ev === 'sprint') { g.beginPath(); g.arc(3, -9, 2.6, 0, TAU); g.fill(); line(0, -5, -3, 2); line(-3, 2, 3, 5, 2, 10); line(-3, 2, -8, 6, -10, 4); line(0, -4, 5, -1, 8, -4); line(0, -4, -5, -3, -7, 0); }
    else if (ev === 'longjump') { g.beginPath(); g.arc(1, -9, 2.6, 0, TAU); g.fill(); line(-1, -5, -3, 1); line(-3, 1, 4, 2, 9, 0); line(-3, 1, 3, 5, 8, 4); line(-1, -4, 5, -8, 8, -11); line(-1, -4, -6, -7, -8, -10); line(-10, 10, 10, 10); }
    else if (ev === 'hurdles') { g.beginPath(); g.arc(2, -10, 2.6, 0, TAU); g.fill(); line(0, -6, -3, 0); line(-3, 0, 9, -1); line(-3, 0, -8, -3, -11, 1); line(0, -5, 6, -3, 9, -6); line(0, -5, -6, -5); g.lineWidth = 2; line(1, 4, 1, 10); line(-1, 4, 5, 4); }
    else { g.beginPath(); g.arc(-1, -9, 2.6, 0, TAU); g.fill(); line(-2, -5, -1, 2); line(-1, 2, 4, 10); line(-1, 2, -6, 9); line(-2, -4, -8, -6, -10, -10); line(-2, -4, 4, -3); g.lineWidth = 1.6; line(-13, -11, 11, -15); }
    g.restore();
  }
  // tabule: světelný panel s textem
  function scoreboard(g, x, y, w, h, top, big, t) {
    g.fillStyle = '#5d6478'; g.fillRect(x + w * 0.2, y + h, 5, 30); g.fillRect(x + w * 0.8 - 5, y + h, 5, 30);
    g.fillStyle = '#141826'; g.strokeStyle = '#7c86a0'; g.lineWidth = 2; g.beginPath(); g.roundRect(x, y, w, h, 4); g.fill(); g.stroke();
    const sg = g.createLinearGradient(0, y, 0, y + h); sg.addColorStop(0, '#0b1c3a'); sg.addColorStop(1, '#061024');
    g.fillStyle = sg; g.fillRect(x + 4, y + 4, w - 8, h - 8);
    g.fillStyle = '#ffb547'; g.font = '700 8px Unbounded, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(top, x + w / 2, y + 12);
    g.fillStyle = '#ffe066'; g.font = '900 15px Unbounded, sans-serif'; g.fillText(big, x + w / 2, y + h / 2 + 6);
    g.fillStyle = 'rgba(255,255,255,.05)'; for (let yy = y + 5; yy < y + h - 4; yy += 2) g.fillRect(x + 4, yy, w - 8, 1);
    g.fillStyle = `rgba(255,255,255,${0.05 + 0.04 * Math.sin(t * 3)})`; g.fillRect(x + 4, y + 4, w - 8, (h - 8) / 2);
  }

  // Pozadí od oblohy po dráhu. o: { VW, VH, camX, t, ex (nadšení 0–1), crowd, board: [top, big], flashes }
  function stadium(g, o) {
    const { VW, camX, t } = o, ex = o.ex || 0;
    // obloha a slunce
    const sky = g.createLinearGradient(0, 0, 0, 120); sky.addColorStop(0, '#2b7fe0'); sky.addColorStop(1, '#a8dcff');
    g.fillStyle = sky; g.fillRect(0, 0, VW, 130);
    const sx = VW - 90 - camX * 0.02, sy = 26;
    const glow = g.createRadialGradient(sx, sy, 6, sx, sy, 70); glow.addColorStop(0, 'rgba(255,240,170,.9)'); glow.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = glow; g.fillRect(sx - 70, sy - 70, 140, 140);
    g.save(); g.translate(sx, sy); g.rotate(t * 0.15); g.fillStyle = 'rgba(255,236,150,.35)';
    for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.beginPath(); g.moveTo(-4, 24); g.lineTo(0, 46); g.lineTo(4, 24); g.fill(); }
    g.restore();
    g.fillStyle = '#ffe680'; g.beginPath(); g.arc(sx, sy, 20, 0, TAU); g.fill();
    g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(sx - 5, sy - 5, 9, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 4; i++) { const cx = ((i * 330 - camX * 0.05 + t * 5) % 1320 + 1320) % 1320 - 100, cy = 18 + (i % 3) * 12; g.beginPath(); for (const [dx, dy, rr] of [[0, 0, 13], [15, -5, 11], [29, 2, 10], [-13, 4, 9]]) { g.moveTo(cx + dx + rr, cy + dy); g.arc(cx + dx, cy + dy, rr, 0, TAU); } g.fill(); }
    // stožáry osvětlení (vzdálenější vrstva)
    const off2 = -camX * 0.22;
    for (let i = -1; i < 4; i++) {
      const px = ((i * 300 + off2) % 1200 + 1200) % 1200 - 150;
      if (px < -40 || px > VW + 40) continue;
      g.fillStyle = '#8a93a8'; g.fillRect(px - 2, 14, 4, 60);
      g.fillStyle = '#4a5068'; g.beginPath(); g.roundRect(px - 18, 2, 36, 16, 2); g.fill();
      g.fillStyle = '#fff8d0'; for (let a = 0; a < 4; a++) for (let b = 0; b < 2; b++) { g.beginPath(); g.arc(px - 12 + a * 8, 6 + b * 7, 2.5, 0, TAU); g.fill(); }
    }
    // tribuna
    const off = -camX * 0.35;
    const st = g.createLinearGradient(0, 56, 0, 190); st.addColorStop(0, '#2a2f4a'); st.addColorStop(1, '#3f4668');
    g.fillStyle = st; g.fillRect(0, 56, VW, 134);
    for (let row = 0; row < 6; row++) { g.fillStyle = row % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; g.fillRect(0, 76 + row * 19, VW, 17); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 93 + row * 19, VW, 2); }
    // diváci
    for (const p of o.crowd) {
      if (p.empty) continue;
      const px = ((p.x + off) % W_CROWD + W_CROWD) % W_CROWD - 40;
      if (px < -12 || px > VW + 12) continue;
      const jump = ex > 0 ? Math.max(0, Math.sin(t * 9 + p.ph)) * 3 * ex : Math.sin(t * 2 + p.ph) * 0.4, py = 92 + p.row * 19 - jump;
      if (p.arms && ex > 0.2) { g.strokeStyle = p.skin; g.lineWidth = 1.6; g.beginPath(); g.moveTo(px - 3, py - 3); g.lineTo(px - 5, py - 11 + Math.sin(t * 12 + p.ph) * 1.5); g.moveTo(px + 3, py - 3); g.lineTo(px + 5, py - 11 - Math.sin(t * 12 + p.ph) * 1.5); g.stroke(); }
      g.fillStyle = p.col; g.beginPath(); g.roundRect(px - 4, py - 4, 8, 9, 3); g.fill();
      g.fillStyle = p.skin; g.beginPath(); g.arc(px, py - 7, 3, 0, TAU); g.fill();
      g.fillStyle = p.hair; g.beginPath(); g.arc(px, py - 8, 3, Math.PI, TAU); g.fill();
      if (p.flag) {
        g.strokeStyle = '#ddd'; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 4, py + 2); g.lineTo(px + 6, py - 18); g.stroke();
        const wv = Math.sin(t * 6 + p.ph) * 2; g.fillStyle = p.flag; g.beginPath(); g.moveTo(px + 6, py - 18); g.quadraticCurveTo(px + 11, py - 20 + wv, px + 17, py - 17); g.lineTo(px + 17, py - 11); g.quadraticCurveTo(px + 11, py - 14 + wv, px + 6, py - 12); g.fill();
      }
    }
    // blesky fotoaparátů
    if (o.flashes) for (const f of o.flashes) { const px = ((f.x + off) % W_CROWD + W_CROWD) % W_CROWD - 40; g.fillStyle = `rgba(255,255,255,${f.a})`; g.beginPath(); g.arc(px, f.y, 4 * f.a + 1, 0, TAU); g.fill(); }
    // světelná tabule mezi diváky
    if (o.board) for (let i = -1; i < 3; i++) {
      const bx = ((i * 700 + 260 + off) % 2100 + 2100) % 2100 - 300;
      if (bx < -170 || bx > VW + 10) continue;
      g.fillStyle = '#2a2f4a'; g.fillRect(bx - 6, 66, 172, 66);
      scoreboard(g, bx, 70, 160, 46, o.board[0], o.board[1], t);
    }
    // střecha s praporky
    g.fillStyle = '#d8dde8'; g.fillRect(0, 44, VW, 6);
    g.fillStyle = '#9aa3b8'; g.fillRect(0, 50, VW, 8);
    g.strokeStyle = 'rgba(60,66,90,.6)'; g.lineWidth = 1.2; g.beginPath();
    for (let i = -1; i < VW / 24 + 2; i++) { const px = ((off % 24) + 24) % 24 + i * 24 - 24; g.moveTo(px, 50); g.lineTo(px + 12, 58); g.lineTo(px + 24, 50); }
    g.stroke();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 58, VW, 8);
    const flagCols = ['#ff5a7a', '#ffd34d', '#55f6ff', '#6dff9e', '#c77dff', '#ff9a3d'];
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath();
    for (let i = -1; i < VW / 18 + 2; i++) { const px = ((off * 1.0) % 18 + 18) % 18 + i * 18 - 18; g.moveTo(px, 58); g.quadraticCurveTo(px + 9, 62, px + 18, 58); }
    g.stroke();
    for (let i = -1; i < VW / 18 + 2; i++) {
      const k = i - Math.floor(off / 18), px = ((off) % 18 + 18) % 18 + i * 18 - 18, sw = Math.sin(t * 4 + i) * 1.2;
      g.fillStyle = flagCols[((k % 6) + 6) % 6]; g.beginPath(); g.moveTo(px + 3, 59.5); g.lineTo(px + 15, 59.5); g.lineTo(px + 9 + sw, 70); g.fill();
    }
    // zábradlí a reklamní mantinel
    g.fillStyle = '#1c2034'; g.fillRect(0, 188, VW, 14);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 188, VW, 2);
    const ads = [['#1b6bd6', '#fff', 'WINDOWLING'], ['#ffd34d', '#16123a', 'LETNÍ HRY'], ['#ff5a7a', '#fff', 'WINDOWLING'], ['#13a37a', '#fff', 'LETNÍ HRY']];
    g.font = '900 10px Unbounded, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const aw = 150, a0 = Math.floor(camX * 0.95 / aw) - 1;
    for (let i = a0; i < a0 + VW / aw + 3; i++) {
      const px = i * aw - camX * 0.95, [bg, fg, txt] = ads[((i % 4) + 4) % 4];
      g.fillStyle = bg; g.fillRect(px, 202, aw - 2, 16);
      g.fillStyle = fg; g.fillText(txt, px + aw / 2 + 6, 210.5);
      g.fillStyle = fg; g.beginPath(); g.arc(px + 14, 210, 4, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 216, VW, 2);
    // trávník s posekanými pruhy
    g.fillStyle = '#4caf48'; g.fillRect(0, 218, VW, 18);
    g.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = -1; i < VW / 60 + 2; i++) { const px = ((-camX) % 60 + 60) % 60 + i * 60 - 60; g.fillRect(px, 218, 30, 18); }
  }

  // Tartanová dráha s čarami drah (y 236–360); X převádí metry na pixely.
  function track(g, o) {
    const { VW, VH, camX } = o;
    g.save(); g.translate(-(((camX % 128) + 128) % 128), 0); g.fillStyle = trackPattern(g); g.fillRect(0, 236, VW + 256, VH - 236); g.restore();
    const sh = g.createLinearGradient(0, 236, 0, VH); sh.addColorStop(0, 'rgba(0,0,0,.18)'); sh.addColorStop(0.2, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(60,0,0,.2)');
    g.fillStyle = sh; g.fillRect(0, 236, VW, VH - 236);
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 234, VW, 3);
    g.fillStyle = 'rgba(255,255,255,.9)'; for (const ly of [256, 276, 296, 324]) g.fillRect(0, ly - 1, VW, 2);
  }

  // Konfety: částice v souřadnicích obrazovky
  function confetti(list, x, y, n, r) {
    const cols = ['#ff5a7a', '#ffd34d', '#55f6ff', '#6dff9e', '#c77dff', '#ffffff'];
    for (let i = 0; i < n; i++) list.push({ x, y, vx: (r() - 0.5) * 260, vy: -80 - r() * 220, a: r() * TAU, va: (r() - 0.5) * 14, c: cols[Math.floor(r() * cols.length)], life: 1.6 + r() * 1.2 });
  }
  function drawConfetti(g, list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]; p.life -= dt; if (p.life <= 0) { list.splice(i, 1); continue; }
      p.vy += 260 * dt; p.vx *= 1 - 1.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
      g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = Math.min(1, p.life); g.fillStyle = p.c; g.fillRect(-3, -1.5 * Math.abs(Math.cos(p.a * 1.7)) - 0.5, 6, 3 * Math.abs(Math.cos(p.a * 1.7)) + 1); g.restore();
    }
  }

  return { athlete, makeCrowd, stadium, track, pictogram, scoreboard, confetti, drawConfetti, mix, rngOf };
})();
