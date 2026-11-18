'use strict';
// ── Ukázka nastavení ─────────────────────────────────────────────────────────
// V Nastavení vpravo: malá scéna ze hry (loď, nepřátelé, střely) dvakrát pod sebou, jednou se
// zapnutým a jednou s vypnutým nastavením, na kterém je zrovna myš. Jen u nastavení, která jdou
// ve hře vidět (zvuk, jazyk nebo data ukázku nemají). Kreslí se ze smyčky main.js, jen když je
// Nastavení otevřené.
const SetPreview = (() => {
  let t = 0;
  const info = () => ({
    autoPick: { name: L('Automatický výběr karet', 'Auto-pick cards'), pair: true, desc: L('Zapnuto: hra se při postupu nezastaví, karta nejvýš v pořadí priorit se vybere sama a krátce se ukáže nad lodí. Vypnuto: hra se zastaví a kartu vybíráš ty.', 'On: level-ups do not pause the game; the card highest in your priorities is picked and briefly shown above your ship. Off: the game pauses and you pick the card.') },
    autoChest: { name: L('Truhly bez okna', 'Chests without a window'), pair: true, desc: L('Zapnuto: truhla se otevře sama, hra běží dál a obsah se jen mihne nad lodí. Vypnuto: otevře se okno s obsahem a pokračuješ tlačítkem.', 'On: a chest opens by itself, the game goes on and its contents flash above your ship. Off: a window shows the contents and you continue with a button.') },
    shake: { name: L('Otřesy obrazovky', 'Screen shake'), pair: true, desc: L('Výbuchy a zásahy krátce rozkmitají obraz. Vypnuté otřesy pomohou, když ti z pohybu bývá špatně.', 'Explosions and hits briefly shake the picture. Turn it off if motion makes you queasy.') },
    dmgNums: { name: L('Čísla poškození', 'Damage numbers'), pair: true, desc: L('Nad zasaženými nepřáteli vyletí, kolik ubrali. Bez nich je obraz klidnější a vykreslování o kousek rychlejší.', 'Floating numbers show how much each hit dealt. Without them the picture is calmer and rendering a bit faster.') },
    fps: { name: L('Počítadlo FPS', 'FPS counter'), pair: true, desc: L('V rohu snímky za sekundu, počet objektů a verze hry.', 'Frames per second, the number of objects and the game version in the corner.') },
    quality: { name: L('Kvalita vykreslování', 'Rendering quality'), modes: true, desc: L('Plná kreslí v rozlišení obrazovky, Úsporná v 70 %. Auto začne v plné a při sekání rozlišení sníží.', 'Full draws at your screen resolution, Saver at 70%. Auto starts at full and lowers the resolution when the game stutters.') },
  });
  // Bez klíče (nic pod myší, nebo nastavení bez viditelného efektu, třeba zvuk) jen tichá nápověda.
  function html(k) {
    const d = info()[k], S = SAVE.settings;
    if (!d) return `<div class="pv-empty"><p>${L('Najeď myší na nastavení, které jde ve hře vidět, a tady se ukáže, jak vypadá zapnuté a vypnuté.', 'Hover a setting you can see in the game to compare it on and off here.')}</p></div>`;
    const head = `<div class="pv-h"><small>${L('UKÁZKA', 'PREVIEW')}</small><h3>${d.name}</h3><p>${d.desc}</p></div>`;
    const fig = (on, label, cur) => `<figure class="${cur ? 'cur' : ''}"><canvas data-pvc="${k}" data-on="${on ? 1 : 0}"></canvas><figcaption>${label}${cur ? ` <b>${L('· teď', '· now')}</b>` : ''}</figcaption></figure>`;
    if (d.modes) { const q = S.quality || 'auto'; return head + `<div class="pv-pair">${fig(true, L('Plná', 'Full'), q === 'high' || q === 'auto')}${fig(false, L('Úsporná (70 %)', 'Saver (70%)'), q === 'low')}</div>${q === 'auto' ? `<p class="pv-note">${L('Teď Auto: začíná v plné kvalitě.', 'Now Auto: it starts at full quality.')}</p>` : ''}`; }
    return head + `<div class="pv-pair">${fig(true, L('Zapnuto', 'On'), !!S[k])}${fig(false, L('Vypnuto', 'Off'), !S[k])}</div>`;
  }

  // ── Malá scéna ──
  const ENEMY_SET = [['tri', 13, '#ff4fd8'], ['dart', 9, '#ff9a3c'], ['square', 16, '#9b6bff'], ['diamond', 13, '#ffe14d'], ['hex', 14, '#4dff9a'], ['tri', 13, '#ff4fd8']];
  function draw(cv, k, on) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const x = cv.getContext('2d');
    // Úsporná kvalita: scéna v menším rozlišení, pak roztažená
    const lowQ = k === 'quality' && !on;
    let tx = x, off = null;
    if (lowQ) { off = draw.off || (draw.off = document.createElement('canvas')); off.width = Math.max(1, Math.round(w * 0.45)); off.height = Math.max(1, Math.round(h * 0.45)); tx = off.getContext('2d'); }
    const W = lowQ ? off.width : w, H = lowQ ? off.height : h, s = Math.min(W / 320, H / 180), hw = W / 2 / s, hh = H / 2 / s;
    // pauza: výběr karty nebo truhla s oknem
    const paused = (k === 'autoPick' || k === 'autoChest') && !on;
    const tt = paused ? 1.15 : t;
    tx.setTransform(1, 0, 0, 1, 0, 0);
    tx.fillStyle = '#0b0420'; tx.fillRect(0, 0, W, H);
    // otřes po výbuchu
    const bt = tt % 2.4, shake = k === 'shake' && on && bt < 0.35 ? (1 - bt / 0.35) * 6 * s : 0;
    tx.setTransform(s, 0, 0, s, W / 2 + (Math.random() - 0.5) * shake * 2, H / 2 + (Math.random() - 0.5) * shake * 2);
    tx.strokeStyle = 'rgba(139,92,255,0.14)'; tx.lineWidth = 1;
    const go = (tt * 24) % 32;
    tx.beginPath();
    for (let gx = -Math.ceil(hw / 32 + 1) * 32 - go; gx < hw; gx += 32) { tx.moveTo(gx, -hh); tx.lineTo(gx, hh); }
    for (let gy = -Math.floor(hh / 32) * 32; gy < hh; gy += 32) { tx.moveTo(-hw, gy); tx.lineTo(hw, gy); }
    tx.stroke();
    const en = ENEMY_SET.map(([shape, rr, col], i) => { const a = tt * 0.45 + (i / ENEMY_SET.length) * TAU, R = 70 + 12 * Math.sin(tt * 1.3 + i); return { x: Math.cos(a) * R * 1.45, y: Math.sin(a) * R * 0.78, img: Sprites.enemy(shape, rr, col, false, false), col }; });
    // střely a zásahy
    for (let i = 0; i < en.length; i++) {
      const e = en[i], f = (tt * 1.6 + i * 0.37) % 1;
      tx.fillStyle = '#9ff8ff'; tx.beginPath(); tx.arc(e.x * f, e.y * f, 2.6, 0, TAU); tx.fill();
    }
    for (let i = 0; i < en.length; i++) {
      const e = en[i], f = (tt * 1.6 + i * 0.37) % 1, img = e.img;
      tx.drawImage(img, e.x - img.hw, e.y - img.hw, img.hw * 2, img.hw * 2);
      if (k === 'dmgNums' && on) {
        tx.globalAlpha = 1 - f; tx.fillStyle = f < 0.15 ? '#ffffff' : '#ffd166'; tx.font = `700 ${11 + (i % 2) * 3}px "Chakra Petch", sans-serif`; tx.textAlign = 'center';
        tx.fillText(String(12 + ((i * 7 + Math.floor(tt * 1.6)) % 19) * (i % 3 === 0 ? 3 : 1)), e.x, e.y - 18 - f * 16);
        tx.globalAlpha = 1;
      }
    }
    // výbuch u prvního nepřítele
    if (bt < 0.5) { const img = Sprites.boom('#ff4fd8'), R = (12 + bt * 70) * (1 - bt), e = en[0]; tx.globalAlpha = 1 - bt * 2; tx.drawImage(img, e.x - R, e.y - R, R * 2, R * 2); tx.globalAlpha = 1; }
    // loď uprostřed
    const ship = Sprites.ship('#55f6ff');
    tx.save(); tx.rotate(-Math.PI / 2 + Math.sin(tt * 0.9) * 0.25); tx.drawImage(ship, -ship.hw * 0.8, -ship.hw * 0.8, ship.hw * 1.6, ship.hw * 1.6); tx.restore();
    // nápisy nad lodí (automatický výběr / truhla bez okna)
    const blink = tt % 3;
    if (on && (k === 'autoPick' || k === 'autoChest') && blink < 1.6) {
      tx.globalAlpha = Math.min(1, (1.6 - blink) * 2); tx.textAlign = 'center'; tx.font = '700 12px "Chakra Petch", sans-serif';
      if (k === 'autoPick') { tx.fillStyle = '#55f6ff'; tx.fillText(L('▲ Pulzní kanón · Úroveň 3', '▲ Pulse Cannon · Level 3'), 0, -30 - blink * 8); }
      else { tx.fillStyle = '#e08bff'; tx.fillText(L('Zásobník +45 ◆', 'Cache +45 ◆'), 0, -26 - blink * 8); tx.fillStyle = '#ffd166'; tx.fillText(L('▲ Jádro síly · Nové', '▲ Power Core · New'), 0, -42 - blink * 8); }
      tx.globalAlpha = 1;
    }
    tx.setTransform(1, 0, 0, 1, 0, 0);
    if (paused) {
      tx.fillStyle = 'rgba(5,1,15,0.62)'; tx.fillRect(0, 0, W, H);
      tx.setTransform(s, 0, 0, s, W / 2, H / 2); tx.textAlign = 'center';
      if (k === 'autoPick') {
        tx.font = '800 13px Unbounded, sans-serif'; tx.fillStyle = '#ffffff'; tx.fillText(L('ÚROVEŇ 4', 'LEVEL 4'), 0, -56);
        [['#55f6ff', L('Pulzní kanón', 'Pulse Cannon')], ['#ff6b6b', L('Jádro síly', 'Power Core')], ['#06d6a0', L('Gyroskop', 'Gyroscope')]].forEach(([c, n], i) => {
          const cx = (i - 1) * 92;
          tx.fillStyle = 'rgba(20,12,48,0.95)'; tx.fillRect(cx - 40, -42, 80, 92); tx.strokeStyle = c; tx.lineWidth = 1.5; tx.strokeRect(cx - 40, -42, 80, 92);
          tx.fillStyle = c; tx.beginPath(); tx.arc(cx, -14, 12, 0, TAU); tx.fill();
          tx.fillStyle = '#ffffff'; tx.font = '700 10px "Chakra Petch", sans-serif'; tx.fillText(n, cx, 16);
          tx.fillStyle = '#9a95c4'; tx.font = '400 9px "Chakra Petch", sans-serif'; tx.fillText(i ? L('Nové', 'New') : L('Úroveň 3', 'Level 3'), cx, 32);
        });
      } else {
        tx.fillStyle = 'rgba(20,12,48,0.95)'; tx.fillRect(-110, -64, 220, 128); tx.strokeStyle = '#e08bff'; tx.lineWidth = 1.5; tx.strokeRect(-110, -64, 220, 128);
        tx.font = '800 13px Unbounded, sans-serif'; tx.fillStyle = '#ffd166'; tx.fillText(L('ZÁSOBNÍK', 'SUPPLY CACHE'), 0, -40);
        [['#ffd166', L('Jádro síly', 'Power Core')], ['#55f6ff', L('Pulzní kanón', 'Pulse Cannon')], ['#e08bff', '+45 ◆']].forEach(([c, n], i) => {
          const cx = (i - 1) * 66; tx.fillStyle = c; tx.beginPath(); tx.arc(cx, -12, 10, 0, TAU); tx.fill();
          tx.fillStyle = '#ffffff'; tx.font = '600 9px "Chakra Petch", sans-serif'; tx.fillText(n, cx, 12);
        });
        tx.fillStyle = '#55f6ff'; tx.fillRect(-46, 28, 92, 22); tx.fillStyle = '#08021a'; tx.font = '700 10px "Chakra Petch", sans-serif'; tx.fillText(L('POKRAČOVAT', 'CONTINUE'), 0, 43);
      }
      tx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // rohové údaje
    const fz = Math.max(9, 10 * s);
    if (k === 'fps' && on) { tx.font = `600 ${fz}px "Chakra Petch", monospace`; tx.textAlign = 'left'; tx.fillStyle = '#5dffa8'; tx.fillText(`60 FPS · 137 · v${GAME_VERSION}`, 8 * s, 14 * s); }
    if (lowQ) { x.setTransform(1, 0, 0, 1, 0, 0); x.imageSmoothingEnabled = true; x.drawImage(off, 0, 0, w, h); }
  }
  function frame(dt) {
    t += dt;
    const list = document.querySelectorAll('#setPv canvas[data-pvc]');
    for (const c of list) draw(c, c.dataset.pvc, c.dataset.on === '1');
  }
  return { html, frame };
})();
