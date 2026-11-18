'use strict';
// ── Verze hry (SemVer) ──────────────────────────────────────────────────────
// Zobrazuje se u počítadla FPS, v nastavení a v záznamu výkonu. Zvyšuje se s každou změnou hry:
// PATCH = opravy a výkon, MINOR = nový obsah a funkce, MAJOR = změna, která rozbije uložené hry.
// 1.0.0  stav před zavedením verzí (end-game, anomálie, slévání předmětů, záznam výkonu)
// 1.1.0  výkon vykreslování (sprity místo gradientů a cest, rozlišení podle obrazovky, Auto kvalita,
//        statické obrazovky se nepřekreslují, méně smetí pro GC), volba kvality v nastavení, verze
// 1.2.0  Kovárna jako 3D loď (části lodi, otáčení, výběr klepnutím), výzbroj do běhu (závěsníky,
//        Zbrojní plán, Kalibrace), Věčný tah, truhly bez okna; Vějíř karet sloučen do Širokého výběru
//        a Věčný fénix do Fénixe (starší uložení se převedou)
const GAME_VERSION = '1.2.0';
