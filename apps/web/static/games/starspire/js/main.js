'use strict';
// ── Start hry ───────────────────────────────────────────────────────────────
(function boot() {
  FX.init(document.getElementById('fx'));
  UI.init();
  Sound.setVolume('sfx', SAVE.settings.sfx);
  Sound.setVolume('music', SAVE.settings.music);
  UI.go('title');
  document.getElementById('s-title').addEventListener('pointerdown', () => UI.enterMenu());
  // čas strávený ve výstupu
  setInterval(() => { if (R && !R.over && ['map', 'battle', 'rest', 'shop', 'event', 'treasure'].includes(UI.screen) && !document.hidden) R.time++; }, 1000);
  window.addEventListener('beforeunload', () => { if (R && !R.over) Run.save(); else persist(); });
  // Pravé tlačítko / dlouhý stisk by otevřelo menu prohlížeče a vzalo hře fokus.
  window.addEventListener('contextmenu', e => e.preventDefault());
  // Na dotyku nápověda po klepnutí nezmizí sama (není kam „odjet“ myší) – schovej ji.
  let tipTimer = 0;
  document.addEventListener('pointerup', e => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => { document.getElementById('tip').hidden = true; }, 2500);
  });
  persist();
})();
