'use strict';
// ── Debug ───────────────────────────────────────────────────────────────────
// Nástroje pro vývoj a ladění v sekci Debug v Nastavení. Pro vydání nastav DEBUG_MENU na false: sekce
// zmizí a všechny nástroje se vypnou (i když zůstanou zapnuté v uložení). Ladit jde pak dál přes adresu
// ...index.html?debug=1.
const DEBUG_MENU = true;
const DEBUG = DEBUG_MENU || /[?&]debug=1\b/.test(location.search);
const Debug = {
  get god() { return DEBUG && !!SAVE.settings.dbgGod; }, // nesmrtelnost: zdraví se po smrtelném zásahu doplní
  get hit() { return DEBUG && !!SAVE.settings.dbgHit; }, // kruhy zásahů nepřátel, střel a lodi
  get speed() { return DEBUG ? SAVE.settings.dbgSpeed || 1 : 1; }, // rychlost hry (víc kroků simulace za snímek)
  get unlock() { return DEBUG && !!SAVE.settings.dbgUnlock; }, // všechny sektory, Overdrive a piloti (jen dokud je zapnuto)
};
