'use strict';
// ── Jazyk (sdílený s Game Center přes localStorage) ─────────────────────────
const LANG_KEY = 'gamecenter.lang';
const LANG = (() => {
  try { const s = localStorage.getItem(LANG_KEY); if (s === 'cs' || s === 'en') return s; } catch (e) { /* bez úložiště */ }
  const nav = typeof navigator !== 'undefined' && navigator.language || '';
  return /^(cs|sk)/i.test(nav) ? 'cs' : 'en';
})();
const L = (cs, en) => (LANG === 'en' ? en : cs);
function setLang(l) {
  if (l === LANG) return;
  try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* bez úložiště */ }
  location.reload();
}
if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = LANG;
