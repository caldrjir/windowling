'use strict';
// ── Ukládání postupu ────────────────────────────────────────────────────────
const SAVE_KEY = 'voidborn.save.v1';
const HUB_KEY = 'gamecenter.stats.voidborn';

function defaultSave() {
  return {
    v: 1, shards: 0, forge: {}, achievements: {}, evolutions: {}, seen: {}, sectors: {},
    stats: {
      kills: 0, bossKills: 0, runs: 0, time: 0, shardsTotal: 0, dashes: 0, bestTime: 0, maxLevel: 0,
      maxOdClear: 0, maxWeapons: 0, bestNoHit: 0, bestBurst: 0, cleanBoss: 0, victories: 0, maxOc: 0, hazardKills: 0,
    },
    settings: { sfx: 0.7, music: 0.45, shake: true, dmgNums: true, fps: false, autoPick: false, prio: null, perfLog: false, quality: 'auto' },
    lastPilot: 'vex', lastSector: 0, lastOd: 0,
  };
}

function loadSave() {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return d;
    const s = JSON.parse(raw);
    for (const k of Object.keys(s)) {
      if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) d[k] = Object.assign(d[k], s[k]);
      else d[k] = s[k];
    }
  } catch (e) { /* poškozený save – začneme znovu */ }
  return d;
}

let SAVE = loadSave();

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE));
    const cleared = SECTORS.filter(s => SAVE.sectors[s.id] && SAVE.sectors[s.id].cleared).length;
    localStorage.setItem(HUB_KEY, JSON.stringify({
      playTime: SAVE.stats.time,
      lastPlayed: Date.now(),
      progress: (Object.keys(SAVE.achievements).length / ACHIEVEMENTS.length),
      // hodnoty bez textu – popisky si Game Center přeloží samo
      stats: {
        best: fmtTime(SAVE.stats.bestTime),
        kills: SAVE.stats.kills,
        sectors: `${cleared} / ${SECTORS.length}`,
        achievements: `${Object.keys(SAVE.achievements).length} / ${ACHIEVEMENTS.length}`,
      },
    }));
  } catch (e) { /* úložiště nedostupné */ }
}

function resetSave() {
  const settings = SAVE.settings;
  SAVE = defaultSave();
  SAVE.settings = settings;
  persist();
}

const pilotUnlocked = p => !p.unlock || !!SAVE.achievements[p.unlock];
const sectorCleared = id => !!(SAVE.sectors[id] && SAVE.sectors[id].cleared);
// Hlavní sektory jdou po sobě, anomálie (VI–IX) otevře dobytí sektoru req.
const sectorReq = i => (SECTORS[i].req || (i > 0 ? SECTORS[i - 1].id : null));
const sectorUnlocked = i => !sectorReq(i) || sectorCleared(sectorReq(i));
/** Sektory, které dobytí sektoru sid nově zpřístupní. */
const unlockedBy = sid => SECTORS.filter((s, i) => sectorReq(i) === sid);
const sectorMaxOd = i => { const s = SAVE.sectors[SECTORS[i].id]; return s ? Math.min(MAX_OD, s.odUnlocked || 0) : 0; };
