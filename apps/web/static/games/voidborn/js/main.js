'use strict';
// ── Vstup ───────────────────────────────────────────────────────────────────
const Input = (() => {
  const keys = new Set(), pressed = new Set();
  let padPrev = [];
  const DASH = ['Space', 'ShiftLeft', 'ShiftRight'];
  window.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && (e.target === document.body || G.state !== 'menu')) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code); pressed.add(e.code);
    onKey(e);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); stickEnd(); });

  // Dotyk: plovoucí joystick kdekoli na ploše + tlačítko úskoku.
  const STICK_R = 56;
  let stick = null;
  const stickEl = document.getElementById('stick'), knobEl = stickEl.firstElementChild;
  function stickEnd(e) {
    if (!stick || (e && e.pointerId !== stick.id)) return;
    stick = null;
    stickEl.classList.remove('on');
  }
  window.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    document.body.classList.add('touch');
    if (G.state !== 'play' || stick || e.target.closest('button, #overlay')) return;
    stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
    stickEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    knobEl.style.transform = '';
    stickEl.classList.add('on');
  });
  window.addEventListener('pointermove', e => {
    if (!stick || e.pointerId !== stick.id) return;
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const l = Math.hypot(dx, dy);
    if (l > STICK_R) { dx *= STICK_R / l; dy *= STICK_R / l; }
    stick.x = dx / STICK_R; stick.y = dy / STICK_R;
    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  window.addEventListener('pointerup', stickEnd);
  window.addEventListener('pointercancel', stickEnd);
  document.getElementById('dashBtn').addEventListener('pointerdown', e => { e.preventDefault(); pressed.add('Space'); });

  function pad() {
    const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find(g => g) : null;
    if (!gp) return null;
    const btn = gp.buttons.map(b => b.pressed);
    const edge = i => btn[i] && !padPrev[i];
    if (edge(0) || edge(5) || edge(7)) pressed.add('Space');
    if (edge(9)) onKey({ code: 'Escape' });
    padPrev = btn;
    return gp;
  }
  function move() {
    let x = 0, y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    const gp = pad();
    if (gp) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.2) { x += ax; y += ay; }
      if (gp.buttons[14] && gp.buttons[14].pressed) x -= 1;
      if (gp.buttons[15] && gp.buttons[15].pressed) x += 1;
      if (gp.buttons[12] && gp.buttons[12].pressed) y -= 1;
      if (gp.buttons[13] && gp.buttons[13].pressed) y += 1;
    }
    if (stick && G.state !== 'play') stickEnd();
    if (stick && Math.hypot(stick.x, stick.y) > 0.15) { x += stick.x; y += stick.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  function consume(action) {
    if (action === 'dash') for (const k of DASH) if (pressed.has(k)) { pressed.delete(k); return true; }
    return false;
  }
  return { move, consume, endFrame: () => pressed.clear(), clear: () => { pressed.clear(); } };
})();

// ── Ovládání hry ────────────────────────────────────────────────────────────
const Game = {
  start(pilotId, si, od) {
    Sound.init();
    UI.hideOverlay();
    UI.show(null);
    newRun(pilotId, si, od);
    persist();
    UI.hudShow(true);
    UI.refreshLoadout();
    UI.bossBar(null);
    Input.clear();
    Sound.muffle(false);
    Sound.music('game');
    Sound.setLevel(0);
    Sound.play.start();
    UI.banner(`${L('SEKTOR', 'SECTOR')} ${G.sector.roman}`, G.sector.name + (od ? ` · Overdrive ${od}` : ''), 'gold');
  },
  togglePause() {
    if (G.state === 'play') {
      G.state = 'paused'; Sound.muffle(true); UI.showPause();
    } else if (G.state === 'paused') {
      G.state = 'play'; Sound.muffle(false); UI.hideOverlay(); Input.clear();
    }
  },
  toMenu(screen) {
    G.state = 'menu';
    UI.hideOverlay();
    UI.hudShow(false);
    UI.bossBar(null);
    Sound.muffle(false);
    Sound.music('menu');
    Render.setAttractSector(G.sector || SECTORS[0]);
    UI.show(screen || 'menu');
  },
};

function onKey(e) {
  const code = e.code;
  if (UI.current === 'title') { enterMenu(); return; }
  const st = G.state;
  if (st === 'play') {
    if (code === 'Escape' || code === 'KeyP') Game.togglePause();
    return;
  }
  if (st === 'paused') {
    if ((code === 'Escape' || code === 'KeyP') && !document.querySelector('#overlay .confirm')) Game.togglePause();
    return;
  }
  if (st === 'levelup') {
    if (performance.now() - UI.openedAt < 300) return;
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[code];
    if (n !== undefined) pickChoice(n);
    else if (code === 'ArrowLeft' || code === 'KeyA') UI.moveFocus(-1);
    else if (code === 'ArrowRight' || code === 'KeyD') UI.moveFocus(1);
    else if (code === 'Enter' || code === 'Space') pickChoice(UI.focusIdx);
    else if (code === 'KeyR') rerollChoices();
    else if (code === 'KeyX') skipChoice();
    return;
  }
  if (st === 'chest') {
    if ((code === 'Enter' || code === 'Space' || code === 'KeyE') && performance.now() - UI.openedAt > 500) closeChest();
    return;
  }
  if (st === 'over') {
    if (code === 'Enter' && performance.now() - UI.openedAt > 800) UI.act('again');
    return;
  }
  if (st === 'menu' && code === 'Escape') {
    if (UI.overlayOpen()) { UI.hideOverlay(); return; }
    if (UI.current && UI.current !== 'menu') { Sound.play.back(); UI.show('menu'); }
  }
}

function enterMenu() {
  Sound.init();
  Sound.setVolume('sfx', SAVE.settings.sfx);
  Sound.setVolume('music', SAVE.settings.music);
  Sound.music('menu');
  Sound.play.start();
  UI.show('menu');
}

// ── Smyčka ──────────────────────────────────────────────────────────────────
let lastT = performance.now(), fpsAcc = 0, fpsN = 0, fps = 60, saveAcc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  if (G.state === 'menu') {
    Render.drawAttract(dt);
  } else {
    updateGame(dt);
    Render.drawGame();
    if (G.state !== 'over') UI.hudUpdate(fps);
    if (G.state === 'play') {
      saveAcc += dt;
      if (saveAcc > 20) { saveAcc = 0; persist(); }
    }
  }
  Input.endFrame();
}

function boot() {
  Render.init(document.getElementById('cv'));
  window.addEventListener('resize', () => Render.resize());
  UI.init();
  Sound.setVolume('sfx', SAVE.settings.sfx);
  Sound.setVolume('music', SAVE.settings.music);
  Render.setAttractSector(SECTORS[clamp(SAVE.lastSector || 0, 0, SECTORS.length - 1)]);
  UI.show('title');
  document.getElementById('s-title').addEventListener('pointerdown', enterMenu);
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') Game.togglePause(); });
  window.addEventListener('blur', () => { if (G.state === 'play') Game.togglePause(); });
  window.addEventListener('beforeunload', () => {
    if (['play', 'paused', 'levelup', 'chest', 'victory'].includes(G.state)) endRun('quit');
    persist();
  });
  persist();
  requestAnimationFrame(loop);
}
boot();
