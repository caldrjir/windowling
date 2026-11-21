'use strict';
// ── Telefon a aplikace z obchodu ────────────────────────────────────────────
// Co se na telefonu chová jinak než v prohlížeči na počítači:
//  - dotyk (třída body.touch: plovoucí joystick, tlačítko úskoku, texty „klepni“ místo kláves),
//  - aplikace bez lišty prohlížeče (body.app: spuštěná z plochy, z obchodu nebo s ?app=1; nemá
//    odkaz zpět do Game Center),
//  - výřezy displeje (notch, Dynamic Island, kulaté rohy, indikátor domů): CSS proměnné
//    --sat/--sar/--sab/--sal z env(safe-area-inset-*), v Debugu jdou nasimulovat,
//  - vibrace při zásazích a událostech (jen kde je prohlížeč umí, nastavení Vibrace),
//  - obrazovka během běhu nezhasne (Screen Wake Lock),
//  - tlačítko a gesto Zpět (Android) i šipka zpět v prohlížeči: krok zpět ve hře, ne odchod.
const Platform = (() => {
  const touch = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);
  const app = !!window.Capacitor || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true || /[?&]app=1\b/.test(location.search);
  const canVibrate = typeof navigator.vibrate === 'function';

  // Výřezy displeje v CSS pixelech (pro kreslení do canvasu: ukazatele mimo obrazovku).
  // Čte je skrytý prvek s padding: var(--sat) … (vlastnost s env() se jinak nemusí převést na px).
  const insets = { t: 0, r: 0, b: 0, l: 0 };
  let probe = null;
  function readInsets() {
    if (!probe) {
      probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:var(--sat) var(--sar) var(--sab) var(--sal)';
      document.body.appendChild(probe);
    }
    const cs = getComputedStyle(probe), px = v => parseFloat(v) || 0;
    insets.t = px(cs.paddingTop); insets.r = px(cs.paddingRight); insets.b = px(cs.paddingBottom); insets.l = px(cs.paddingLeft);
  }
  function apply() {
    const b = document.body.classList;
    if (touch) b.add('touch');
    b.toggle('app', app);
    b.toggle('dash-left', !!SAVE.settings.dashLeft);
    b.toggle('sim-notch', Debug.notch);
    readInsets();
  }

  // Vibrace: krátké pulzy v ms (nebo vzor). Ne častěji než po 70 ms, ať telefon nebzučí pořád.
  let lastVib = 0;
  function vibrate(p) {
    if (!canVibrate || !SAVE.settings.haptics) return;
    const now = performance.now();
    if (now - lastVib < 70) return;
    lastVib = now;
    try { navigator.vibrate(p); } catch (e) { /* prohlížeč vibrace zakázal */ }
  }

  // Nezhasínat obrazovku, dokud běží mise (po návratu do aplikace se zámek obnoví).
  let lock = null, wantLock = false;
  async function keepAwake(on) {
    wantLock = on;
    if (!('wakeLock' in navigator)) return;
    try {
      if (on && !lock && document.visibilityState === 'visible') {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } else if (!on && lock) {
        const l = lock; lock = null; await l.release();
      }
    } catch (e) { lock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (wantLock && document.visibilityState === 'visible') keepAwake(true); });

  // Zpět: dokud hra není v hlavním menu, drží v historii jeden záznam navíc. Zpět ho spotřebuje a
  // hra místo odchodu udělá krok zpět (zavře okno, vrátí se do menu, pozastaví běh). Když se hráč
  // vrátí do menu jinak, záznam se tiše odebere, takže Zpět v menu odejde hned napoprvé.
  let armed = false, skip = 0, onBack = null;
  function arm() {
    if (armed) return;
    history.pushState({ voidborn: 1 }, '');
    armed = true;
  }
  function disarm() {
    if (!armed) return;
    armed = false; skip++;
    history.back();
  }
  window.addEventListener('popstate', () => {
    if (skip) { skip--; return; }
    if (!armed) return;
    armed = false;
    if (onBack) onBack();
  });

  return { touch, app, canVibrate, insets, apply, readInsets, vibrate, keepAwake, arm, disarm, setBack(fn) { onBack = fn; } };
})();
