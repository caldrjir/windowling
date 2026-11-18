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
// 1.3.0  Kovárna: statistiky lodi pod modelem (základ + kolik přidává Kovárna), pevná hlavička panelu
//        s rolujícím seznamem, tažení otáčí lodí po směru prstu; Nastavení po skupinách přes celou
//        plochu s živou ukázkou zapnuto / vypnuto
// 1.3.1  Nastavení: ukázka vpravo se vždy vejde na obrazovku (posouvá se jen seznam), ukazuje se až po
//        najetí myší a jen u nastavení, která jdou ve hře vidět (ne u zvuku, jazyka, záznamu a dat)
// 1.4.0  27 nových druhů nepřátel s vlastními schopnostmi (foes.js) a bestiář v Kodexu; úspěchy odměňují
//        podle obtížnosti a dávají trvalé bonusy (Síň slávy, doplatek za splněné); otáčení lodi v Kovárně
//        obráceně, se setrvačností a bez samovolného natáčení; verze na úvodní obrazovce místo Nastavení
// 1.4.1  Priority automatického výběru přehledněji: ve sloupcích, se štítky kategorií, přetahování myší i prstem
// 1.4.2  Kovárna: otáčení zase jako předmět v ruce (bližší bok jde s prstem), správné překrývání dílů z každého
//        úhlu (BSP strom), díly lícují (gondoly pod křídly, kabina na přídi, lišty na trupu); sekce Debug v Nastavení
// 1.4.3  Úspěchy rozdělené podle vzácnosti s procentem hráčů, kteří je mají (/api/rarity); kryty děl na přídi
//        plynule přecházejí v hlavně; záznam výkonu přesunut do sekce Debug
const GAME_VERSION = '1.4.3';
