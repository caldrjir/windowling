'use strict';
// ── Windowling · Hlavolamy: společný základ ─────────────────────────────────
// Každý hlavolam (static/games/<id>/) dodá jen generátor a hrací plochu. Tady je vše,
// co hráče drží týdny: denní výzva (stejná pro všechny, série dní, kalendář a archiv),
// Cesta hvězd (120 úrovní se hvězdičkami), hodnosti, achievementy, statistiky, týdenní
// úkoly společné pro všechny hlavolamy a hvězdný prach na vzhledy.
//
// Úložiště: <id>.save.v1 (hra), gamecenter.puzzles (společné), gamecenter.stats.<id> (hub).
const Kit = (() => {
  // ── Jazyk, náhoda, datum ──
  const LANG = (() => {
    try { const s = localStorage.getItem('gamecenter.lang'); if (s === 'cs' || s === 'en') return s; } catch (e) { /* */ }
    return /^(cs|sk)/i.test(navigator.language || '') ? 'cs' : 'en';
  })();
  const L = (cs, en) => (LANG === 'en' ? en : cs);
  document.documentElement.lang = LANG;

  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pad = n => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dayKey(d); };
  function weekKey(d = new Date()) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd);
    const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
    return `${y}-W${pad(w)}`;
  }
  const fmtTime = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`; };
  const fmtNum = n => Math.round(n).toLocaleString(LANG === 'en' ? 'en-US' : 'cs-CZ');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const $ = (s, el = document) => el.querySelector(s);

  // ── Ikony ──
  const ICON = {
    back: '<path d="M15 5l-7 7 7 7"/>', star: '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/>',
    flame: '<path d="M12 21c4 0 7-2.7 7-6.6 0-4-3.3-5.6-3.3-10-2.7 1.6-3.4 4.4-3.4 6-1.1-1.1-1.6-2.2-1.6-3.8C8 8.4 5 11 5 14.4 5 18.3 8 21 12 21z"/>',
    gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21L8 9l4-6 4 6z"/>', play: '<path d="M7 4.5l13 7.5-13 7.5z"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/><path d="M17 5h3v2a4 4 0 01-4 4M7 5H4v2a4 4 0 004 4"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    brush: '<path d="M14 4l6 6-8 8H6v-6z"/><path d="M4 20c0-2 1-3 2-3"/>', help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.5a2.5 2.5 0 015 .5c0 1.7-2.5 2.2-2.5 4M12 17.5v.5"/>',
    pause: '<path d="M8 5v14M16 5v14"/>', check: '<path d="M4 12.5l5 5L20 6.5"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', quest: '<path d="M5 4h14v16l-7-4-7 4z"/>', sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 8a5 5 0 010 8"/>', mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>', bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>',
    erase: '<path d="M20 20H9L4 15l10-10 7 7-6 6"/>', pencil: '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', home: '<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.3c2.2.7 3.5 2.8 3.5 5.7"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    dot: '<circle cx="12" cy="12" r="5" fill="currentColor"/>', link: '<path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>',
    crown: '<path d="M3 18h18M4 15L3 6l5 4 4-6 4 6 5-4-1 9z"/>', podium: '<path d="M3 20h18M9 20V9h6v11M3 20v-6h6M15 20v-4h6v4"/><path d="M12 3.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/>', send: '<path d="M4 12l16-8-6 16-2-7z"/>',
  };
  const icon = (n, cls = '') => `<svg class="ki ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n] || ''}</svg>`;

  // ── Společný stav všech hlavolamů ──
  const META_KEY = 'gamecenter.puzzles';
  const THEMES = [
    { id: 'aurora', name: L('Polární záře', 'Aurora'), cost: 0, a: '#55f6ff', b: '#ff4fd8', c: '#7a2cff', bg: '#07051a' },
    { id: 'nebula', name: L('Mlhovina', 'Nebula'), cost: 120, a: '#ff8ae0', b: '#ffb86b', c: '#b14cff', bg: '#12051a' },
    { id: 'abyss', name: L('Hlubina', 'Abyss'), cost: 160, a: '#4fd1ff', b: '#2f7bff', c: '#00e0b0', bg: '#020a1a' },
    { id: 'solstice', name: L('Slunovrat', 'Solstice'), cost: 220, a: '#ffcf5a', b: '#ff7a3d', c: '#ff4f6d', bg: '#140807' },
    { id: 'verdant', name: L('Zelený paprsek', 'Green Ray'), cost: 280, a: '#7dff9b', b: '#3dd6ff', c: '#2affd0', bg: '#021410' },
    { id: 'eclipse', name: L('Zatmění', 'Eclipse'), cost: 400, a: '#f2f1ff', b: '#ff4f6d', c: '#9c9ab8', bg: '#050508' },
    { id: 'supernova', name: L('Supernova', 'Supernova'), cost: 600, a: '#fff27a', b: '#ff4fd8', c: '#55f6ff', bg: '#0a0414' },
  ];
  const RANKS = [
    [0, L('Pozorovatel', 'Stargazer')], [120, L('Hvězdář', 'Skywatcher')], [350, L('Navigátor', 'Navigator')], [800, L('Kartograf', 'Cartographer')],
    [1600, L('Astronom', 'Astronomer')], [3200, L('Mistr souhvězdí', 'Constellation Master')], [6400, L('Strážce galaxie', 'Galaxy Warden')], [12000, L('Legenda Windowlingu', 'Windowling Legend')],
  ];
  const CHAPTERS = [
    L('Mlhovina', 'The Nebula'), L('Pás asteroidů', 'Asteroid Belt'), L('Prstence', 'The Rings'),
    L('Rudý obr', 'Red Giant'), L('Horizont událostí', 'Event Horizon'), L('Srdce galaxie', 'Galactic Core'),
  ];
  const LEVELS = 120, PER_CHAPTER = 20;

  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez úložiště */ } };

  function loadMeta() {
    const m = Object.assign({ v: 1, shards: 0, theme: 'aurora', owned: ['aurora'], quests: null, sound: true }, read(META_KEY, {}));
    if (!Array.isArray(m.owned)) m.owned = ['aurora'];
    return m;
  }
  let META = loadMeta();
  const saveMeta = () => write(META_KEY, META);

  // Týdenní úkoly: stejné pro všechny hlavolamy, nové každé pondělí.
  const QUEST_TYPES = [
    { kind: 'solve', n: 8, reward: 40, text: n => L(`Vyřeš ${n} hlavolamů`, `Solve ${n} puzzles`) },
    { kind: 'daily', n: 4, reward: 50, text: n => L(`Splň ${n} denní výzvy`, `Complete ${n} daily puzzles`) },
    { kind: 'variety', n: 3, reward: 40, text: n => L(`Zahraj si ${n} různé hlavolamy`, `Solve ${n} different puzzle games`) },
    { kind: 'hard', n: 2, reward: 60, text: n => L(`Vyřeš ${n}× na Těžké nebo víc`, `Solve ${n} on Hard or above`) },
    { kind: 'perfect', n: 5, reward: 50, text: n => L(`${n}× bez chyby a nápovědy`, `${n} perfect solves (no mistakes, no hints)`) },
    { kind: 'stars', n: 6, reward: 40, text: n => L(`Získej ${n} hvězd na Cestě`, `Earn ${n} stars on the Path`) },
    { kind: 'time', n: 45, reward: 45, text: n => L(`Hraj ${n} minut`, `Play for ${n} minutes`) },
  ];
  function quests() {
    const wk = weekKey();
    if (!META.quests || META.quests.week !== wk) {
      const r = rng(hash('quests:' + wk));
      const pick = shuffle(QUEST_TYPES.slice(), r).slice(0, 3);
      META.quests = { week: wk, list: pick.map(q => ({ kind: q.kind, n: q.n, reward: q.reward, p: 0, done: false, games: [] })) };
      saveMeta();
    }
    return META.quests;
  }
  function questProgress(ev) {
    const q = quests();
    const gained = [];
    for (const it of q.list) {
      if (it.done) continue;
      if (it.kind === 'solve' && ev.solved) it.p++;
      if (it.kind === 'daily' && ev.daily) it.p++;
      if (it.kind === 'hard' && ev.solved && ev.diffRank >= 2) it.p++;
      if (it.kind === 'perfect' && ev.perfect) it.p++;
      if (it.kind === 'stars' && ev.stars) it.p += ev.stars;
      if (it.kind === 'time' && ev.minutes) it.p += ev.minutes;
      if (it.kind === 'variety' && ev.solved && !it.games.includes(ev.game)) { it.games.push(ev.game); it.p = it.games.length; }
      if (it.p >= it.n) { it.p = it.n; it.done = true; META.shards += it.reward; gained.push(it); }
    }
    saveMeta();
    return gained;
  }
  const questText = it => (QUEST_TYPES.find(q => q.kind === it.kind) || QUEST_TYPES[0]).text(it.n);

  function applyTheme() {
    const t = THEMES.find(x => x.id === META.theme) || THEMES[0];
    const r = document.documentElement.style;
    r.setProperty('--a', t.a); r.setProperty('--b', t.b); r.setProperty('--c', t.c); r.setProperty('--bg', t.bg);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t.bg;
  }

  // ── Zvuk ──
  let ac = null;
  function tone(f, d = 0.08, v = 0.05, type = 'sine', when = 0) {
    if (!META.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + when;
      o.type = type; o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + d + 0.02);
    } catch (e) { /* bez zvuku */ }
  }
  const SOUND = {
    tap: () => tone(880, 0.05, 0.03, 'triangle'), place: () => tone(660, 0.07, 0.04, 'triangle'), soft: () => tone(520, 0.05, 0.025, 'sine'),
    erase: () => tone(300, 0.06, 0.03, 'sine'), error: () => { tone(180, 0.18, 0.05, 'sawtooth'); tone(140, 0.2, 0.04, 'square', 0.05); },
    line: () => { tone(784, 0.1, 0.035, 'triangle'); tone(1046, 0.14, 0.03, 'triangle', 0.06); },
    win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, 0.045, 'triangle', i * 0.09)),
    star: () => tone(1568, 0.25, 0.04, 'sine'), ui: () => tone(1200, 0.04, 0.02, 'triangle'),
  };

  // ── Hra ──
  let DEF = null, SAVE = null, inst = null, view = 'home', timerOn = false, lastTick = 0, playAcc = 0, sessionMin = 0;
  const SAVE_KEY = () => `${DEF.id}.save.v1`;
  function loadSave() {
    const s = Object.assign({ v: 1, stats: {}, daily: {}, streak: { cur: 0, best: 0, last: null }, levels: {}, cur: null, ach: {}, time: 0, xp: 0, settings: {}, data: {} }, read(SAVE_KEY(), {}));
    s.stats = Object.assign({ solved: 0, perfect: 0, hints: 0, mistakes: 0, by: {} }, s.stats);
    // Žebříčky: nejlepší výsledek na každé desce (static/games/sync.js ho pošle do účtu).
    // Porovnávají se jen stejná zadání: denní výzva, úroveň Cesty, volná hra se stejnými pravidly.
    if (!s.lb) {
      s.lb = {};
      for (const [k, d] of Object.entries(s.daily)) if (d && d.time) s.lb[`daily:${k}:time`] = Math.round(d.time * 1000);
      for (const d of DEF.diffs) {
        const by = s.stats.by[d.id]; if (!by) continue;
        if (d.metric === 'score' && by.bestScore) s.lb[`free:${d.id}:score`] = by.bestScore;
        else if (d.ranked && by.best) s.lb[`free:${d.id}:time`] = Math.round(by.best * 1000);
      }
    }
    return s;
  }
  // Uloží výsledek, když je lepší (čas nižší, ostatní vyšší).
  function lbSet(board, value) {
    value = Math.round(value); if (!(value > 0)) return;
    const old = SAVE.lb[board], lower = board.endsWith(':time');
    if (old == null || (lower ? value < old : value > old)) SAVE.lb[board] = value;
  }
  // Desky, na kterých se dá soutěžit ve volné hře: skóre, nebo stejná pravidla (ranked).
  const rankedFree = d => d.metric === 'score' || d.ranked;
  function persist() {
    write(SAVE_KEY(), SAVE);
    const levelsDone = Object.keys(SAVE.levels).length;
    const achN = Object.keys(SAVE.ach).length, achT = allAchievements().length;
    write(`gamecenter.stats.${DEF.id}`, {
      playTime: Math.round(SAVE.time), lastPlayed: Date.now(), progress: Math.min(1, (levelsDone / LEVELS) * 0.7 + (achN / achT) * 0.3),
      stats: { solved: SAVE.stats.solved, streak: streakNow(), level: `${levelsDone} / ${LEVELS}`, rank: rankOf(SAVE.xp).name, achievements: `${achN} / ${achT}` },
    });
  }
  function streakNow() {
    const s = SAVE.streak, t = dayKey();
    return s.last === t || s.last === addDays(t, -1) ? s.cur : 0;
  }
  function rankOf(xp) {
    let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++;
    const lo = RANKS[i][0], hi = RANKS[i + 1] ? RANKS[i + 1][0] : lo;
    return { i, name: RANKS[i][1], next: RANKS[i + 1] ? RANKS[i + 1][1] : null, pct: hi > lo ? (xp - lo) / (hi - lo) : 1, toNext: hi - xp };
  }
  const diffIndex = id => Math.max(0, DEF.diffs.findIndex(d => d.id === id));
  const diffName = id => (DEF.diffs.find(d => d.id === id) || DEF.diffs[0]).name;
  // Denní obtížnost: pondělí nejlehčí, víkend nejtěžší.
  function dailyDiff(key) {
    if (DEF.dailyDiff) return DEF.dailyDiff(key);
    const wd = (fromKey(key).getDay() + 6) % 7; // 0 = pondělí
    const map = [0, 1, 1, 2, 2, 3, 3];
    return DEF.diffs[Math.min(DEF.diffs.length - 1, map[wd])].id;
  }
  function levelDiff(n) {
    if (DEF.levelDiff) return DEF.levelDiff(n);
    const ch = Math.floor((n - 1) / PER_CHAPTER), k = (n - 1) % PER_CHAPTER, D = DEF.diffs.length;
    const base = [0, 0, 1, 1, 2, 3][ch], step = [0, 1, 0, 1, 0, 0][ch];
    return DEF.diffs[Math.min(D - 1, base + (step && k >= 10 ? 1 : 0))].id;
  }

  // ── Achievementy: společné + vlastní každé hry ──
  function allAchievements() {
    const own = DEF.achievements || [];
    const S = s => s.stats;
    const base = [
      { id: 'first', name: L('První světlo', 'First Light'), desc: L('Vyřeš první hlavolam', 'Solve your first puzzle'), prog: s => [S(s).solved, 1] },
      { id: 's10', name: L('Rozehřátí', 'Warming Up'), desc: L('Vyřeš 10 hlavolamů', 'Solve 10 puzzles'), prog: s => [S(s).solved, 10] },
      { id: 's50', name: L('Vytrvalec', 'Persistent'), desc: L('Vyřeš 50 hlavolamů', 'Solve 50 puzzles'), prog: s => [S(s).solved, 50] },
      { id: 's200', name: L('Posedlost', 'Obsessed'), desc: L('Vyřeš 200 hlavolamů', 'Solve 200 puzzles'), prog: s => [S(s).solved, 200] },
      { id: 's500', name: L('Nekonečno', 'Infinity'), desc: L('Vyřeš 500 hlavolamů', 'Solve 500 puzzles'), prog: s => [S(s).solved, 500] },
      { id: 'st3', name: L('Zvyk', 'Habit'), desc: L('Série 3 denních výzev', '3-day daily streak'), prog: s => [s.streak.best, 3] },
      { id: 'st7', name: L('Týden pod hvězdami', 'A Week of Stars'), desc: L('Série 7 denních výzev', '7-day daily streak'), prog: s => [s.streak.best, 7] },
      { id: 'st30', name: L('Měsíční cyklus', 'Lunar Cycle'), desc: L('Série 30 denních výzev', '30-day daily streak'), prog: s => [s.streak.best, 30] },
      { id: 'st100', name: L('Stálice', 'Fixed Star'), desc: L('Série 100 denních výzev', '100-day daily streak'), prog: s => [s.streak.best, 100] },
      { id: 'p10', name: L('Čistá práce', 'Clean Work'), desc: L('10× bez chyby a nápovědy', '10 perfect solves'), prog: s => [S(s).perfect, 10] },
      { id: 'p50', name: L('Bezchybný', 'Flawless'), desc: L('50× bez chyby a nápovědy', '50 perfect solves'), prog: s => [S(s).perfect, 50] },
      ...DEF.diffs.slice(1).map(d => ({ id: 'd_' + d.id, name: L(`Zdolat: ${d.name}`, `Conquer: ${d.name}`), desc: L(`Vyřeš hlavolam na obtížnost ${d.name}`, `Solve a ${d.name} puzzle`), prog: s => [(S(s).by[d.id] || {}).n || 0, 1] })),
      ...CHAPTERS.map((c, i) => ({ id: 'ch' + i, name: c, desc: L(`Dokonči kapitolu ${i + 1} Cesty hvězd`, `Finish chapter ${i + 1} of the Star Path`), prog: s => [chapterDone(s, i), PER_CHAPTER] })),
      { id: 'allstars', name: L('Všechny hvězdy', 'Every Star'), desc: L(`Získej všech ${LEVELS * 3} hvězd na Cestě`, `Earn all ${LEVELS * 3} Path stars`), prog: s => [Object.values(s.levels).reduce((a, b) => a + b, 0), LEVELS * 3] },
      { id: 'rank5', name: L('Astronom', 'Astronomer'), desc: L('Dosáhni hodnosti Astronom', 'Reach the Astronomer rank'), prog: s => [s.xp, RANKS[4][0]] },
    ];
    return base.concat(own);
  }
  function chapterDone(s, i) { let n = 0; for (let k = i * PER_CHAPTER + 1; k <= (i + 1) * PER_CHAPTER; k++) if (s.levels[k]) n++; return n; }
  function checkAch() {
    const got = [];
    for (const a of allAchievements()) {
      if (SAVE.ach[a.id]) continue;
      const [v, m] = a.prog(SAVE);
      if (v >= m) { SAVE.ach[a.id] = Date.now(); got.push(a); }
    }
    return got;
  }

  // ── Kostra stránky ──
  function shell() {
    document.body.classList.add('kit');
    document.body.innerHTML = `
      <canvas id="kbg"></canvas>
      <header class="k-top">
        <a class="k-icon" href="../../index.html" id="kHub" title="Game Center" aria-label="Game Center">${icon('home')}</a>
        <button class="k-icon" id="kBack" hidden aria-label="${L('Zpět', 'Back')}">${icon('back')}</button>
        <div class="k-title"><b>${esc(DEF.title)}</b><small id="kSub">${L('Hlavolamy', 'Puzzles')} · Windowling</small></div>
        <div class="k-sp"></div>
        <div class="k-pill" id="kTimer" hidden></div>
        <div class="k-pill k-shards" title="${L('Hvězdný prach', 'Stardust')}">${icon('gem')}<b id="kShards">0</b></div>
        <button class="k-icon" id="kSound" aria-label="${L('Zvuk', 'Sound')}"></button>
      </header>
      <main id="kView"></main>
      <div id="kModal" hidden></div>
      <div id="kToasts"></div>
      <canvas id="kFx"></canvas>`;
    $('#kBack').onclick = () => { SOUND.ui(); back(); };
    $('#kSound').onclick = () => { META.sound = !META.sound; saveMeta(); soundBtn(); SOUND.ui(); };
    soundBtn();
    $('#kHub').addEventListener('click', () => { leavePlay(); persist(); });
    bgLoop();
  }
  const soundBtn = () => { $('#kSound').innerHTML = icon(META.sound ? 'sound' : 'mute'); };
  const shardsUi = () => { $('#kShards').textContent = META.shards.toLocaleString(LANG === 'en' ? 'en-US' : 'cs-CZ'); };

  // Pozadí: pomalá polární záře v barvách motivu (nízká snímková frekvence šetří baterii).
  function bgLoop() {
    const cv = $('#kbg'), ctx = cv.getContext('2d');
    let last = 0;
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const frame = ms => {
      requestAnimationFrame(frame);
      if (ms - last < 66 || document.hidden) return; last = ms;
      const w = cv.width = Math.ceil(innerWidth / 3), h = cv.height = Math.ceil(innerHeight / 3), t = ms / 1000;
      const st = getComputedStyle(document.documentElement);
      const cols = ['--a', '--b', '--c'].map(v => hex((st.getPropertyValue(v).trim() || '#55f6ff')));
      ctx.fillStyle = st.getPropertyValue('--bg').trim() || '#07051a'; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x = w * (0.5 + 0.45 * Math.sin(t * 0.05 * (i + 1) + i * 2)), y = h * (0.45 + 0.4 * Math.cos(t * 0.04 * (i + 2) + i));
        const r = Math.max(w, h) * 0.55, g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${cols[i].join(',')},0.13)`); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    requestAnimationFrame(frame);
  }

  // ── Navigace ──
  function setView(v, sub) {
    view = v;
    $('#kBack').hidden = v === 'home';
    $('#kHub').hidden = v !== 'home';
    $('#kTimer').hidden = v !== 'play';
    $('#kSub').textContent = sub || `${L('Hlavolamy', 'Puzzles')} · Windowling`;
    document.body.dataset.view = v;
    window.scrollTo(0, 0);
  }
  function back() {
    if (view === 'play' && isOnline()) { leavePlay(); roomView(); }
    else if (view === 'room') leaveRoom();
    else if (view === 'play') { leavePlay(); home(); } else { clearTimeout(lobbyT); home(); }
  }

  function card(cls, inner, attrs = '') { return `<section class="k-card ${cls}" ${attrs}>${inner}</section>`; }

  function home() {
    setView('home');
    shardsUi();
    const t = dayKey(), daily = SAVE.daily[t], st = streakNow(), r = rankOf(SAVE.xp), q = quests();
    const lv = nextLevel(), cur = SAVE.cur;
    const curLabel = cur ? (cur.kind === 'daily' ? L('Denní výzva', 'Daily puzzle') : cur.kind === 'level' ? L(`Úroveň ${cur.key}`, `Level ${cur.key}`) : diffName(cur.diff)) : '';
    $('#kView').innerHTML = `
      <div class="k-home">
        <div class="k-hero">
          <div class="k-hero-art" id="kArt"></div>
          <div class="k-hero-txt">
            <span class="k-eyebrow">${L('Hlavolamy', 'Puzzles')} · Windowling</span>
            <h1>${esc(DEF.title)}</h1>
            <p>${DEF.tagline}</p>
            <div class="k-rank"><b>${r.name}</b><span>${SAVE.xp} XP${r.next ? ` · ${L('další', 'next')}: ${r.next}` : ''}</span><i><u style="width:${Math.round(r.pct * 100)}%"></u></i></div>
          </div>
        </div>
        <div class="k-grid">
          ${card('k-daily' + (daily ? ' done' : ''), `
            <div class="k-card-h">${icon('cal')}<span>${L('Denní výzva', 'Daily puzzle')}</span><em class="k-streak ${st ? 'on' : ''}">${icon('flame')}${st}</em></div>
            <b class="k-big">${fromKey(t).toLocaleDateString(LANG === 'en' ? 'en-US' : 'cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}</b>
            <span class="k-muted">${diffName(dailyDiff(t))} · ${L('stejná pro všechny hráče', 'the same for everyone')}</span>
            ${daily ? `<span class="k-ok">${icon('check')} ${L('Vyřešeno za', 'Solved in')} ${fmtTime(daily.time)}</span>` : ''}
            <div class="k-row"><button class="k-btn ${daily ? '' : 'primary'}" data-k="daily">${daily ? L('Zahrát znovu', 'Play again') : L('Hrát denní', 'Play daily')}</button><button class="k-btn ghost" data-k="calendar">${L('Kalendář', 'Calendar')}</button></div>`)}
          ${cur ? card('k-cont', `
            <div class="k-card-h">${icon('play')}<span>${L('Rozehraná hra', 'In progress')}</span></div>
            <b class="k-big">${curLabel}</b><span class="k-muted">${diffName(cur.diff)} · ${fmtTime(cur.time || 0)}</span>
            <div class="k-row"><button class="k-btn primary" data-k="resume">${L('Pokračovat', 'Continue')}</button></div>`) : ''}
          ${card('k-path', `
            <div class="k-card-h">${icon('map')}<span>${L('Cesta hvězd', 'Star Path')}</span></div>
            <b class="k-big">${lv > LEVELS ? L('Dokončeno', 'Complete') : L(`Úroveň ${lv}`, `Level ${lv}`)}</b>
            <span class="k-muted">${CHAPTERS[Math.min(CHAPTERS.length - 1, Math.floor((Math.min(lv, LEVELS) - 1) / PER_CHAPTER))]} · ${Object.keys(SAVE.levels).length} / ${LEVELS} · ${Object.values(SAVE.levels).reduce((a, b) => a + b, 0)} ${icon('star', 'tiny')}</span>
            <div class="k-row"><button class="k-btn primary" data-k="level" ${lv > LEVELS ? 'disabled' : ''}>${L('Další úroveň', 'Next level')}</button><button class="k-btn ghost" data-k="path">${L('Mapa', 'Map')}</button></div>`)}
          ${card('k-free', `
            <div class="k-card-h">${icon('plus')}<span>${L('Volná hra', 'Free play')}</span></div>
            <span class="k-muted">${L('Nekonečně nových hlavolamů. Vyber obtížnost:', 'Endless new puzzles. Pick a difficulty:')}</span>
            <div class="k-diffs">${DEF.diffs.map(d => `<button class="k-btn" data-k="free" data-diff="${d.id}"><b>${d.name}</b>${d.note ? `<small>${d.note}</small>` : ''}<small>${d.metric === 'score' ? `${L('rekord', 'best')} ${fmtNum((SAVE.stats.by[d.id] || {}).bestScore || 0)}` : `${(SAVE.stats.by[d.id] || {}).n || 0}×${(SAVE.stats.by[d.id] || {}).best ? ' · ' + fmtTime(SAVE.stats.by[d.id].best) : ''}`}</small></button>`).join('')}</div>`)}
          ${onlineCard()}
          ${card('k-quests', `
            <div class="k-card-h">${icon('quest')}<span>${L('Týdenní úkoly', 'Weekly quests')}</span><em class="k-muted">${L('všechny hlavolamy', 'all puzzles')}</em></div>
            <ul>${q.list.map(it => `<li class="${it.done ? 'done' : ''}"><span>${questText(it)}</span><i><u style="width:${Math.round(it.p / it.n * 100)}%"></u></i><small>${it.done ? icon('check') : `${it.p}/${it.n}`} · +${it.reward} ${icon('gem', 'tiny')}</small></li>`).join('')}</ul>`)}
        </div>
        <nav class="k-links">
          <button data-k="ach">${icon('trophy')}<span>${L('Úspěchy', 'Achievements')}</span><small>${Object.keys(SAVE.ach).length}/${allAchievements().length}</small></button>
          <button data-k="lb">${icon('podium')}<span>${L('Žebříčky', 'Leaderboards')}</span></button>
          <button data-k="stats">${icon('chart')}<span>${L('Statistiky', 'Statistics')}</span></button>
          <button data-k="themes">${icon('brush')}<span>${L('Vzhled', 'Themes')}</span><small>${META.owned.length}/${THEMES.length}</small></button>
          <button data-k="help">${icon('help')}<span>${L('Jak hrát', 'How to play')}</span></button>
          ${(DEF.views || []).map((v, i) => `<button data-k="view" data-v="${i}">${icon(v.icon || 'star')}<span>${v.name}</span>${v.badge ? `<small>${v.badge(SAVE)}</small>` : ''}</button>`).join('')}
        </nav>
      </div>`;
    if (DEF.art) DEF.art($('#kArt'));
    bind();
  }
  function nextLevel() { let n = 1; while (n <= LEVELS && SAVE.levels[n]) n++; return n; }
  function bind() {
    for (const b of document.querySelectorAll('#kView [data-k]')) b.onclick = () => {
      SOUND.ui();
      const k = b.dataset.k;
      if (k === 'daily') start('daily', dayKey());
      else if (k === 'resume') resume();
      else if (k === 'level') start('level', +(b.dataset.n || nextLevel()));
      else if (k === 'free') start('free', null, b.dataset.diff);
      else if (k === 'path') pathView();
      else if (k === 'calendar') calendar();
      else if (k === 'ach') achView();
      else if (k === 'stats') statsView();
      else if (k === 'lb') lbView();
      else if (k === 'themes') themesView();
      else if (k === 'help') helpView();
      else if (k === 'archive') start('daily', b.dataset.day);
      else if (k === 'online') onlineView();
      else if (k === 'view') { const v = DEF.views[+b.dataset.v]; setView('custom', v.name); $('#kView').innerHTML = '<div class="k-page"></div>'; v.render($('#kView .k-page'), SAVE, api); }
    };
  }

  // ── Mapa Cesty ──
  function pathView() {
    setView('path', L('Cesta hvězd', 'Star Path'));
    const nx = nextLevel();
    let html = '<div class="k-page"><h2>' + L('Cesta hvězd', 'Star Path') + '</h2><p class="k-muted">' + L('120 úrovní v šesti kapitolách. Tři hvězdy za čisté řešení v limitu.', '120 levels in six chapters. Three stars for a clean solve within par time.') + '</p>';
    for (let c = 0; c < CHAPTERS.length; c++) {
      const done = chapterDone(SAVE, c);
      html += `<section class="k-chapter"><div class="k-ch-h"><b>${c + 1}. ${CHAPTERS[c]}</b><span>${done}/${PER_CHAPTER}</span></div><div class="k-levels">`;
      for (let n = c * PER_CHAPTER + 1; n <= (c + 1) * PER_CHAPTER; n++) {
        const s = SAVE.levels[n] || 0, open = n <= nx;
        html += `<button class="k-lv ${s ? 'done' : ''} ${n === nx ? 'next' : ''}" ${open ? `data-k="level" data-n="${n}"` : 'disabled'} title="${diffName(levelDiff(n))}"><b>${open ? n : icon('lock')}</b><span>${[1, 2, 3].map(i => icon('star', i <= s ? 'on' : '')).join('')}</span></button>`;
      }
      html += '</div></section>';
    }
    $('#kView').innerHTML = html + '</div>';
    bind();
    const nb = $('.k-lv.next'); if (nb) nb.scrollIntoView({ block: 'center' });
  }

  // ── Kalendář a archiv denních výzev ──
  function calendar(month) {
    setView('calendar', L('Denní výzvy', 'Daily puzzles'));
    const now = new Date(), m = month || new Date(now.getFullYear(), now.getMonth(), 1);
    const first = new Date(m.getFullYear(), m.getMonth(), 1), days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7, t = dayKey(), oldest = addDays(t, -60);
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const k = dayKey(new Date(m.getFullYear(), m.getMonth(), d)), r = SAVE.daily[k];
      const can = k <= t && k >= oldest;
      cells += `<button class="k-day ${r ? 'done' : ''} ${k === t ? 'today' : ''}" ${can ? `data-k="archive" data-day="${k}"` : 'disabled'}><b>${d}</b>${r ? `<small>${fmtTime(r.time)}</small>` : ''}</button>`;
    }
    const solvedMonth = Object.keys(SAVE.daily).filter(k => k.startsWith(`${m.getFullYear()}-${pad(m.getMonth() + 1)}`)).length;
    $('#kView').innerHTML = `<div class="k-page">
      <h2>${L('Denní výzvy', 'Daily puzzles')}</h2>
      <div class="k-statrow"><div><b>${streakNow()}</b><span>${L('aktuální série', 'current streak')}</span></div><div><b>${SAVE.streak.best}</b><span>${L('nejdelší série', 'best streak')}</span></div><div><b>${Object.keys(SAVE.daily).length}</b><span>${L('splněno celkem', 'solved in total')}</span></div></div>
      <div class="k-cal-h"><button class="k-icon" id="kPrev">${icon('back')}</button><b>${m.toLocaleDateString(LANG === 'en' ? 'en-US' : 'cs-CZ', { month: 'long', year: 'numeric' })}</b><span class="k-muted">${solvedMonth}/${days}</span><button class="k-icon flip" id="kNext">${icon('back')}</button></div>
      <div class="k-cal">${(LANG === 'en' ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']).map(d => `<i>${d}</i>`).join('')}${cells}</div>
      <p class="k-muted">${L('Zmeškané dny z posledních 60 dnů si můžeš zahrát z archivu. Do série se počítá jen výzva v daný den.', 'Missed days from the last 60 days can be played from the archive. Only solving on the day counts for the streak.')}</p></div>`;
    $('#kPrev').onclick = () => calendar(new Date(m.getFullYear(), m.getMonth() - 1, 1));
    $('#kNext').onclick = () => { if (m < new Date(now.getFullYear(), now.getMonth(), 1)) calendar(new Date(m.getFullYear(), m.getMonth() + 1, 1)); };
    bind();
  }

  function achView() {
    setView('ach', L('Úspěchy', 'Achievements'));
    const list = allAchievements();
    $('#kView').innerHTML = `<div class="k-page"><h2>${L('Úspěchy', 'Achievements')}</h2><p class="k-muted">${Object.keys(SAVE.ach).length} / ${list.length}</p><div class="k-ach">${list.map(a => {
      const [v, m] = a.prog(SAVE), got = SAVE.ach[a.id];
      return `<div class="${got ? 'got' : ''}">${icon(got ? 'trophy' : 'lock')}<div><b>${a.name}</b><span>${a.desc}</span><i><u style="width:${Math.min(100, (v / m) * 100)}%"></u></i></div></div>`;
    }).join('')}</div></div>`;
  }
  // ── Žebříčky: jen stejná zadání (denní výzva, úroveň Cesty, volná hra se stejnými pravidly) ──
  const fmtMs = ms => { const s = ms / 1000; return s < 600 ? `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}.${Math.floor((s * 10) % 10)}` : fmtTime(s); };
  function fmtBoard(board, v) {
    const unit = board.split(':').pop();
    if (unit === 'time') return fmtMs(v);
    if (unit === 'played') { const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60); return h ? `${h} h ${m} min` : `${m} min`; }
    if (unit === 'wins') return `${fmtNum(v)} ${L('výher', 'wins')}`;
    return fmtNum(v);
  }
  let lbSel = null;
  function lbView(sel) {
    const free = DEF.diffs.filter(rankedFree);
    const lastLevel = Math.max(1, ...Object.keys(SAVE.levels).map(Number));
    lbSel = sel || lbSel || { kind: 'daily', key: dayKey() };
    setView('lb', L('Žebříčky', 'Leaderboards'));
    const tabs = [['daily', L('Denní výzva', 'Daily')], ['level', L('Cesta hvězd', 'Star Path')]];
    if (free.length) tabs.push(['free', L('Volná hra', 'Free play')]);
    if (DEF.online) tabs.push(['online', 'Online']);
    tabs.push(['played', L('Nejvíc nahráno', 'Most played')]);
    const t = lbSel;
    if (t.kind === 'level' && !t.key) t.key = lastLevel;
    if (t.kind === 'free' && !free.some(d => d.id === t.key)) t.key = free[0] && free[0].id;
    const board = t.kind === 'daily' ? `daily:${t.key}:time` : t.kind === 'level' ? `level:${t.key}:time` : t.kind === 'free' ? `free:${t.key}:${(free.find(d => d.id === t.key) || {}).metric === 'score' ? 'score' : 'time'}` : t.kind === 'online' ? 'online:wins' : 'total:played';
    const stepper = t.kind === 'daily'
      ? `<div class="k-cal-h"><button class="k-icon" data-lb="prev">${icon('back')}</button><b>${fromKey(t.key).toLocaleDateString(LANG === 'en' ? 'en-US' : 'cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}</b><button class="k-icon flip" data-lb="next" ${t.key >= dayKey() ? 'disabled' : ''}>${icon('back')}</button></div>`
      : t.kind === 'level' ? `<div class="k-cal-h"><button class="k-icon" data-lb="prev" ${t.key <= 1 ? 'disabled' : ''}>${icon('back')}</button><b>${L(`Úroveň ${t.key}`, `Level ${t.key}`)} · ${diffName(levelDiff(t.key))}</b><button class="k-icon flip" data-lb="next" ${t.key >= LEVELS ? 'disabled' : ''}>${icon('back')}</button></div>`
      : t.kind === 'free' ? `<div class="k-chips">${free.map(d => `<button class="k-chip ${d.id === t.key ? 'on' : ''}" data-lb-diff="${d.id}">${d.name}</button>`).join('')}</div>` : '';
    $('#kView').innerHTML = `<div class="k-page k-lb">
      <h2>${L('Žebříčky', 'Leaderboards')}</h2>
      <p class="k-muted">${L('Soutěží se jen na stejném zadání: denní výzva a úrovně Cesty jsou pro všechny stejné, ve volné hře se počítají jen režimy se stejnými pravidly.', 'Only identical challenges compete: the daily puzzle and Path levels are the same for everyone; in free play only modes with fixed rules count.')}</p>
      <div class="k-chips k-tabs">${tabs.map(([k, n]) => `<button class="k-chip ${k === t.kind ? 'on' : ''}" data-lb-tab="${k}">${n}</button>`).join('')}</div>
      ${stepper}
      <div class="k-table" id="kLbTable"><div class="k-gen" style="min-height:120px"><i></i></div></div>
      <p class="k-muted" id="kLbNote"></p></div>`;
    for (const b of document.querySelectorAll('[data-lb-tab]')) b.onclick = () => { SOUND.ui(); const k = b.dataset.lbTab; lbView({ kind: k, key: k === 'daily' ? dayKey() : k === 'level' ? lastLevel : k === 'free' ? free[0] && free[0].id : null }); };
    for (const b of document.querySelectorAll('[data-lb-diff]')) b.onclick = () => { SOUND.ui(); lbView({ kind: 'free', key: b.dataset.lbDiff }); };
    for (const b of document.querySelectorAll('[data-lb]')) b.onclick = () => {
      SOUND.ui(); const dir = b.dataset.lb === 'next' ? 1 : -1;
      lbView(t.kind === 'daily' ? { kind: 'daily', key: addDays(t.key, dir) } : { kind: 'level', key: Math.min(LEVELS, Math.max(1, t.key + dir)) });
    };
    loadBoard(board);
  }
  async function loadBoard(board) {
    // nejdřív pošli vlastní výsledky, ať je hráč vidět hned
    try { if (window.GCSync && window.GCSync.state === 'synced') await window.GCSync.sync(); } catch (e) { /* offline */ }
    let lb;
    try { const res = await fetch(`/api/scores?game=${DEF.id}&board=${encodeURIComponent(board)}&limit=25`, { cache: 'no-store' }); if (!res.ok) throw new Error(res.status); lb = await res.json(); }
    catch (e) { if ($('#kLbTable')) $('#kLbTable').innerHTML = `<p class="k-muted" style="padding:14px">${L('Žebříček teď není dostupný.', 'The leaderboard is not available right now.')}</p>`; return; }
    if (view !== 'lb' || !$('#kLbTable')) return;
    const row = e => `<tr class="${e.me ? 'me' : ''}"><td>${e.rank}.</td><td>${esc(e.nickname)}</td><td>${fmtBoard(board, e.value)}</td></tr>`;
    const meRow = lb.me && !lb.entries.some(e => e.me) ? `<tr class="gap"><td colspan="3">…</td></tr>${row({ rank: lb.me.rank, nickname: L('ty', 'you'), value: lb.me.value, me: true })}` : '';
    $('#kLbTable').innerHTML = lb.entries.length
      ? `<table><thead><tr><th>#</th><th>${L('Hráč', 'Player')}</th><th>${board.endsWith(':time') ? L('čas', 'time') : board.endsWith(':played') ? L('nahráno', 'played') : L('výsledek', 'result')}</th></tr></thead><tbody>${lb.entries.map(row).join('')}${meRow}</tbody></table>`
      : `<p class="k-muted" style="padding:14px">${L('Zatím tu nikdo není. Buď první!', 'Nobody here yet. Be the first!')}</p>`;
    const local = SAVE.lb[board];
    $('#kLbNote').innerHTML = !lb.signedIn
      ? L('Přihlas se v herním centru (Google) a tvoje výsledky se tu objeví.', 'Sign in on the game center (Google) and your results show up here.')
      : `${lb.total} ${L('hráčů', 'players')}${lb.me ? ` · ${L('tvé místo', 'your place')}: ${lb.me.rank}.` : local ? '' : ` · ${L('tady zatím nemáš výsledek', 'no result of yours here yet')}`}`;
  }

  function statsView() {
    setView('stats', L('Statistiky', 'Statistics'));
    const S = SAVE.stats, r = rankOf(SAVE.xp);
    const rows = DEF.diffs.map(d => { const b = S.by[d.id] || {}; return `<tr><td>${d.name}</td><td>${b.n || 0}${b.games ? ` / ${b.n + b.games}` : ''}</td><td>${d.metric === 'score' ? (b.bestScore ? fmtNum(b.bestScore) : '–') : b.best ? fmtTime(b.best) : '–'}</td><td>${b.n ? fmtTime(b.sum / b.n) : '–'}</td><td>${b.perfect || 0}</td></tr>`; }).join('');
    const extra = DEF.statsExtra ? DEF.statsExtra(SAVE) : [];
    $('#kView').innerHTML = `<div class="k-page"><h2>${L('Statistiky', 'Statistics')}</h2>
      <div class="k-statrow"><div><b>${S.solved}</b><span>${L('vyřešeno', 'solved')}</span></div><div><b>${fmtTime(SAVE.time)}</b><span>${L('odehráno', 'played')}</span></div><div><b>${S.perfect}</b><span>${L('bez chyby', 'perfect')}</span></div><div><b>${SAVE.streak.best}</b><span>${L('nejdelší série', 'best streak')}</span></div>${extra.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>
      <div class="k-rank wide"><b>${r.name}</b><span>${SAVE.xp} XP${r.next ? ` · ${L('do hodnosti', 'to')} ${r.next}: ${r.toNext} XP` : ''}</span><i><u style="width:${Math.round(r.pct * 100)}%"></u></i></div>
      <div class="k-table"><table><thead><tr><th>${L('Obtížnost', 'Difficulty')}</th><th>${L('Vyřešeno', 'Solved')}</th><th>${L('Nejlepší', 'Best')}</th><th>${L('Průměr', 'Average')}</th><th>${L('Bez chyby', 'Perfect')}</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h3>${L('Hodnosti', 'Ranks')}</h3><ol class="k-ranks">${RANKS.map(([x, n], i) => `<li class="${i <= r.i ? 'on' : ''}"><b>${n}</b><span>${x} XP</span></li>`).join('')}</ol></div>`;
  }
  function themesView() {
    setView('themes', L('Vzhled', 'Themes'));
    $('#kView').innerHTML = `<div class="k-page"><h2>${L('Vzhled', 'Themes')}</h2><p class="k-muted">${L('Hvězdný prach získáš za řešení, denní výzvy, hvězdy na Cestě a týdenní úkoly. Vzhled platí pro všechny hlavolamy.', 'Earn stardust from solves, daily puzzles, Path stars and weekly quests. A theme applies to every puzzle game.')}</p>
      <div class="k-themes">${THEMES.map(t => { const own = META.owned.includes(t.id), on = META.theme === t.id;
        return `<button class="k-theme ${on ? 'on' : ''}" data-theme="${t.id}" style="--ta:${t.a};--tb:${t.b};--tc:${t.c};--tbg:${t.bg}"><i></i><b>${t.name}</b><span>${on ? L('Používáš', 'In use') : own ? L('Použít', 'Use') : `${icon('gem', 'tiny')} ${t.cost}`}</span></button>`; }).join('')}</div></div>`;
    for (const b of document.querySelectorAll('[data-theme]')) b.onclick = () => {
      const t = THEMES.find(x => x.id === b.dataset.theme);
      if (!META.owned.includes(t.id)) {
        if (META.shards < t.cost) { SOUND.error(); toast(L(`Chybí ${t.cost - META.shards} hvězdného prachu`, `You need ${t.cost - META.shards} more stardust`)); return; }
        META.shards -= t.cost; META.owned.push(t.id); SOUND.win();
      } else SOUND.ui();
      META.theme = t.id; saveMeta(); applyTheme(); shardsUi(); themesView();
    };
  }
  function helpView() {
    setView('help', L('Jak hrát', 'How to play'));
    $('#kView').innerHTML = `<div class="k-page k-help"><h2>${L('Jak hrát', 'How to play')}</h2>${DEF.rules}
      <h3>${L('Postup a odměny', 'Progress and rewards')}</h3><ul>
      <li>${L('<b>Denní výzva</b> je každý den nová a pro všechny stejná. Splň ji několik dní po sobě a roste ti série.', '<b>The daily puzzle</b> is new every day and the same for everyone. Solve it on consecutive days to build a streak.')}</li>
      <li>${L('<b>Cesta hvězd</b> má 120 úrovní. Tři hvězdy dostaneš za řešení bez chyby a nápovědy v časovém limitu.', '<b>The Star Path</b> has 120 levels. Three stars for a solve with no mistakes or hints within par time.')}</li>
      <li>${L('<b>Týdenní úkoly</b> jsou společné pro všechny hlavolamy a každé pondělí se obnoví.', '<b>Weekly quests</b> are shared by all puzzle games and reset every Monday.')}</li>
      <li>${L('Za všechno dostáváš <b>XP</b> (hodnosti) a <b>hvězdný prach</b> na nové vzhledy.', 'Everything earns <b>XP</b> (ranks) and <b>stardust</b> for new themes.')}</li></ul></div>`;
  }

  // ── Hraní ──
  let cur = null;
  function seedFor(kind, key, diff) {
    if (kind === 'daily') return hash(`${DEF.id}:daily:${key}`);
    if (kind === 'level') return hash(`${DEF.id}:level:${key}`);
    return (Math.random() * 4294967296) >>> 0;
  }
  function start(kind, key, diff) {
    if (kind === 'daily') diff = dailyDiff(key);
    if (kind === 'level') diff = levelDiff(key);
    const seed = seedFor(kind, key, diff);
    cur = { kind, key, diff, seed, state: null, time: 0, mistakes: 0, hints: 0 };
    SAVE.cur = cur; persist();
    open();
  }
  function resume() { cur = SAVE.cur; if (cur) open(); }
  function open() {
    const label = cur.kind === 'daily' ? (cur.key === dayKey() ? L('Denní výzva', 'Daily puzzle') : L(`Archiv ${fromKey(cur.key).toLocaleDateString(LANG === 'en' ? 'en-US' : 'cs-CZ')}`, `Archive ${cur.key}`)) : cur.kind === 'level' ? L(`Úroveň ${cur.key}`, `Level ${cur.key}`) : L('Volná hra', 'Free play');
    setView('play', `${label} · ${diffName(cur.diff)}`);
    $('#kView').innerHTML = `<div class="k-play"><div class="k-board" id="kBoard"><div class="k-gen"><i></i>${L('Připravuji hlavolam…', 'Preparing your puzzle…')}</div></div></div>`;
    timerOn = false; updTimer();
    setTimeout(() => {
      let puzzle;
      try { puzzle = DEF.generate(cur.seed, cur.diff, { kind: cur.kind, key: cur.key }); } catch (e) { console.error(e); toast(L('Hlavolam se nepodařilo vytvořit', 'Could not create the puzzle')); home(); return; }
      if (view !== 'play') return;
      $('#kBoard').innerHTML = '';
      inst = DEF.create($('#kBoard'), puzzle, cur.state, api, { diff: cur.diff, kind: cur.kind, key: cur.key, settings: SAVE.settings });
      timerOn = true; lastTick = performance.now();
    }, 30);
  }
  function leavePlay() {
    if (view === 'play' && inst && cur && SAVE.cur === cur) { cur.state = inst.getState(); persist(); }
    if (inst && inst.destroy) inst.destroy();
    inst = null; timerOn = false;
  }
  function updTimer() { const el = $('#kTimer'); if (el && cur) el.innerHTML = `${fmtTime(cur.time)}${cur.mistakes ? ` <em>${icon('x', 'tiny')}${cur.mistakes}</em>` : ''}`; }
  setInterval(() => {
    const now = performance.now(), dt = (now - lastTick) / 1000; lastTick = now;
    if (!DEF || document.hidden) return;
    if (dt > 0 && dt < 5) {
      SAVE.time += dt; playAcc += dt;
      if (timerOn && cur && $('#kModal').hidden) { cur.time += dt; updTimer(); }
      if (playAcc >= 60) { playAcc -= 60; sessionMin++; questProgress({ minutes: 1 }); }
    }
    raceTick();
  }, 500);
  let saveT = 0;
  const api = {
    lang: LANG, L, rng, hash, shuffle, icon, sound: n => (SOUND[n] || SOUND.tap)(),
    changed() { clearTimeout(saveT); saveT = setTimeout(() => { if (inst && cur && SAVE.cur === cur) { cur.state = inst.getState(); persist(); } }, 400); },
    mistake() { if (!cur) return; cur.mistakes++; SAVE.stats.mistakes++; SOUND.error(); updTimer(); api.changed(); },
    hint() { if (!cur) return; cur.hints++; SAVE.stats.hints++; api.changed(); },
    toast: t => toast(t),
    get settings() { return SAVE.settings; },
    get data() { return SAVE.data; },
    persist: () => persist(),
    setSetting(k, v) { SAVE.settings[k] = v; persist(); },
    solved(extra = {}) { if (isOnline()) onlineSolved(extra); else if (cur) finish(extra); },
    failed(extra = {}) { if (isOnline()) onlineFailed(extra); else if (cur) fail(extra); },
    get kind() { return cur && cur.kind; }, get key() { return cur && cur.key; },
    paused: () => !$('#kModal').hidden || document.hidden,
    setTimer(on) { timerOn = !!on; lastTick = performance.now(); },
    get time() { return cur ? cur.time : 0; },
    burst: (x, y, n) => burst(x, y, n),
  };

  function finish(extra) {
    timerOn = false;
    const c = cur, d = DEF.diffs.find(x => x.id === c.diff) || DEF.diffs[0], dr = diffIndex(c.diff);
    const perfect = c.mistakes === 0 && c.hints === 0;
    const par = d.par || 600;
    const stars = extra.stars != null ? extra.stars : perfect && c.time <= par ? 3 : c.mistakes + c.hints <= 2 ? 2 : 1;
    const S = SAVE.stats, by = S.by[c.diff] = S.by[c.diff] || { n: 0, sum: 0, best: 0, perfect: 0 };
    const oldScore = by.bestScore || 0;
    S.solved++; by.n++; by.sum += c.time; if (!by.best || c.time < by.best) by.best = c.time; if (perfect) { S.perfect++; by.perfect++; }
    if (extra.score != null) by.bestScore = Math.max(by.bestScore || 0, extra.score);
    let xp = [12, 22, 36, 56, 80][dr] || 20; if (perfect) xp = Math.round(xp * 1.5);
    let shards = 2 + dr * 2, starGain = 0, streakUp = false, newBest = false;
    if (c.kind === 'daily') {
      const first = !SAVE.daily[c.key];
      if (first) { SAVE.daily[c.key] = { time: Math.round(c.time), mistakes: c.mistakes, hints: c.hints }; lbSet(`daily:${c.key}:time`, c.time * 1000); }
      if (c.key === dayKey() && first) {
        const s = SAVE.streak; s.cur = s.last === addDays(c.key, -1) ? s.cur + 1 : 1; s.last = c.key; s.best = Math.max(s.best, s.cur); streakUp = true;
        shards += 10 + Math.min(10, s.cur); xp += 20;
      } else if (first) shards += 4;
    }
    if (c.kind === 'level') {
      const before = SAVE.levels[c.key] || 0;
      if (stars > before) { starGain = stars - before; SAVE.levels[c.key] = stars; shards += starGain * 3; }
      lbSet(`level:${c.key}:time`, c.time * 1000);
    }
    if (c.kind === 'free' && rankedFree(d)) lbSet(d.metric === 'score' ? `free:${d.id}:score` : `free:${d.id}:time`, d.metric === 'score' ? extra.score || 0 : c.time * 1000);
    newBest = extra.score != null ? extra.score > oldScore && by.n > 1 : by.best === c.time && by.n > 1;
    SAVE.xp += xp; META.shards += shards;
    const quest = questProgress({ solved: true, game: DEF.id, daily: c.kind === 'daily', diffRank: dr, perfect, stars: starGain });
    SAVE.cur = null;
    const ach = checkAch();
    persist(); saveMeta(); shardsUi();
    if (inst && inst.destroy) { /* plocha zůstává vidět pod výsledkem */ }
    SOUND.win();
    burst(innerWidth / 2, innerHeight / 2, 80);
    const next = c.kind === 'level' && c.key < LEVELS ? `<button class="k-btn primary" id="kNextLv">${L(`Úroveň ${c.key + 1}`, `Level ${c.key + 1}`)}</button>` : c.kind === 'free' ? `<button class="k-btn primary" id="kAgain">${L('Další', 'Another')} · ${d.name}</button>` : '';
    modal(`<div class="k-result">
      <span class="k-eyebrow">${c.kind === 'daily' ? L('Denní výzva', 'Daily puzzle') : c.kind === 'level' ? L(`Úroveň ${c.key}`, `Level ${c.key}`) : d.name}</span>
      <h2>${extra.title || L('Vyřešeno!', 'Solved!')}</h2>
      ${c.kind === 'level' ? `<div class="k-stars">${[1, 2, 3].map(i => icon('star', i <= stars ? 'on' : '')).join('')}</div>` : ''}
      ${extra.score != null
        ? `<div class="k-statrow"><div><b>${fmtNum(extra.score)}</b><span>${newBest ? L('nový rekord!', 'new best!') : extra.scoreLabel || L('skóre', 'score')}</span></div><div><b>${fmtTime(c.time)}</b><span>${L('čas', 'time')}</span></div><div><b>${fmtNum(Math.max(oldScore, extra.score))}</b><span>${L('rekord', 'best')}</span></div></div>`
        : `<div class="k-statrow"><div><b>${fmtTime(c.time)}</b><span>${newBest ? L('nový rekord!', 'new best!') : L('čas', 'time')}</span></div><div><b>${c.mistakes}</b><span>${L('chyby', 'mistakes')}</span></div><div><b>${c.hints}</b><span>${L('nápovědy', 'hints')}</span></div></div>`}
      <div class="k-gains"><span>+${xp} XP</span><span>+${shards} ${icon('gem', 'tiny')}</span>${streakUp ? `<span class="hot">${icon('flame', 'tiny')} ${L('série', 'streak')} ${SAVE.streak.cur}</span>` : ''}</div>
      ${extra.html || ''}
      ${quest.map(q => `<p class="k-q">${icon('quest', 'tiny')} ${L('Úkol splněn', 'Quest complete')}: ${questText(q)} (+${q.reward})</p>`).join('')}
      ${ach.map(a => `<p class="k-q">${icon('trophy', 'tiny')} ${a.name}</p>`).join('')}
      <div class="k-row">${next}${c.kind !== 'free' || rankedFree(d) ? `<button class="k-btn" id="kLb">${icon('podium')} ${L('Žebříček', 'Leaderboard')}</button>` : ''}<button class="k-btn ghost" id="kHome">${L('Hotovo', 'Done')}</button></div></div>`);
    if (ach.length) setTimeout(() => SOUND.star(), 600);
    const close = () => { closeModal(); leavePlay(); };
    $('#kHome').onclick = () => { SOUND.ui(); close(); home(); };
    if ($('#kNextLv')) $('#kNextLv').onclick = () => { SOUND.ui(); close(); start('level', c.key + 1); };
    if ($('#kLb')) $('#kLb').onclick = () => { SOUND.ui(); close(); lbView(c.kind === 'daily' ? { kind: 'daily', key: c.key } : c.kind === 'level' ? { kind: 'level', key: c.key } : { kind: 'free', key: c.diff }); };
    if ($('#kAgain')) $('#kAgain').onclick = () => { SOUND.ui(); close(); start('free', null, c.diff); };
  }

  // Konec hry bez splnění cíle (arkádové hlavolamy): skóre, rekord, zkusit znovu.
  function fail(extra = {}) {
    timerOn = false;
    const c = cur, d = DEF.diffs.find(x => x.id === c.diff) || DEF.diffs[0];
    const S = SAVE.stats, by = S.by[c.diff] = S.by[c.diff] || { n: 0, sum: 0, best: 0, perfect: 0 };
    S.games = (S.games || 0) + 1; by.games = (by.games || 0) + 1;
    const old = by.bestScore || 0, sc = extra.score || 0;
    if (extra.score != null && c.kind === 'free') by.bestScore = Math.max(old, sc);
    if (extra.score != null && c.kind === 'free' && d.metric === 'score') lbSet(`free:${d.id}:score`, sc);
    const xp = Math.min(40, extra.xp != null ? extra.xp : 4); SAVE.xp += xp;
    SAVE.cur = null;
    const ach = checkAch();
    persist(); shardsUi();
    SOUND.error();
    modal(`<div class="k-result">
      <span class="k-eyebrow">${c.kind === 'daily' ? L('Denní výzva', 'Daily puzzle') : c.kind === 'level' ? L(`Úroveň ${c.key}`, `Level ${c.key}`) : d.name}</span>
      <h2 class="lose">${extra.title || L('Konec hry', 'Game over')}</h2>
      ${extra.score != null ? `<div class="k-statrow"><div><b>${fmtNum(sc)}</b><span>${sc > old && c.kind === 'free' ? L('nový rekord!', 'new best!') : extra.scoreLabel || L('skóre', 'score')}</span></div><div><b>${fmtTime(c.time)}</b><span>${L('čas', 'time')}</span></div><div><b>${fmtNum(Math.max(old, c.kind === 'free' ? sc : 0))}</b><span>${L('rekord', 'best')}</span></div></div>` : ''}
      ${extra.html || ''}
      <div class="k-gains"><span>+${xp} XP</span></div>
      ${ach.map(a => `<p class="k-q">${icon('trophy', 'tiny')} ${a.name}</p>`).join('')}
      <div class="k-row"><button class="k-btn primary" id="kRetry">${L('Zkusit znovu', 'Try again')}</button><button class="k-btn ghost" id="kHome">${L('Hotovo', 'Done')}</button></div></div>`);
    const close = () => { closeModal(); leavePlay(); };
    $('#kHome').onclick = () => { SOUND.ui(); close(); home(); };
    $('#kRetry').onclick = () => { SOUND.ui(); close(); start(c.kind, c.key, c.diff); };
  }

  // ── Online: tahové partie (šachy, piškvorky) a závody na stejném zadání ──
  // Server: /api/duel/rooms (Durable Object na místnost). Hra dostane v opts.net spojení
  // pro tahy; závodní hlavolam nabídne inst.progress() 0..1. Kód místnosti je v adrese (?duel=).
  const API = '/api/duel/rooms';
  const ON = { ws: null, code: null, meta: null, me: null, seat: null, players: [], round: null, chat: [], offset: 0, retry: 0, applied: 0, prog: -1, progAt: 0, counted: -1, unread: 0, chatOpen: false, offline: {}, drawFrom: null, rematch: [], countT: 0 };
  const isOnline = () => !!(cur && cur.kind === 'online');
  const pid = () => { let p = ''; try { p = localStorage.getItem('gamecenter.pid') || ''; } catch (e) { /* bez úložiště */ } if (!/^[a-zA-Z0-9]{12,40}$/.test(p)) { p = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 56]).join(''); try { localStorage.setItem('gamecenter.pid', p); } catch (e) { /* bez úložiště */ } } return p; };
  const nick = () => { if (!META.nick) { META.nick = `${L('Hvězdář', 'Stargazer')} ${100 + Math.floor(Math.random() * 900)}`; saveMeta(); } return META.nick; };
  const onDiffs = () => DEF.diffs.filter(d => !DEF.online.diffs || DEF.online.diffs.includes(d.id));
  const serverNow = () => Date.now() + ON.offset;
  const firstSeat = () => (ON.round ? ON.round.n % 2 : 0);
  const mySide = () => (ON.seat === firstSeat() ? 1 : -1);
  const opp = () => ON.players.find(p => p.id !== ON.me && p.seat != null);
  const WHY = {
    mate: L('Mat', 'Checkmate'), five: L('Pět v řadě', 'Five in a row'), resign: L('Vzdání', 'Resignation'), agreed: L('Remíza dohodou', 'Draw agreed'),
    left: L('Soupeř odešel', 'The opponent left'), stalemate: L('Pat', 'Stalemate'), draw50: L('Pravidlo 50 tahů', '50-move rule'), rep: L('Trojí opakování', 'Threefold repetition'),
    material: L('Nedostatek materiálu', 'Insufficient material'), full: L('Plná plocha', 'Board full'),
  };
  const onStats = () => (SAVE.stats.online = Object.assign({ w: 0, l: 0, d: 0, races: 0, raceWins: 0 }, SAVE.stats.online));

  function onlineCard() {
    if (!DEF.online) return '';
    const o = onStats(), turn = DEF.online.kind === 'turn';
    return card('k-online', `
      <div class="k-card-h">${icon('users')}<span>Online</span><em class="k-live">${icon('dot', 'tiny')}${L('živě', 'live')}</em></div>
      <b class="k-big">${turn ? L('Partie s živým soupeřem', 'Play a live opponent') : L('Závod na stejném zadání', 'Race on the same puzzle')}</b>
      <span class="k-muted">${turn ? L('Pošli kód kamarádovi, nebo se přidej k otevřené hře.', 'Send a code to a friend or join an open game.') : L('Až 8 hráčů, stejné zadání, kdo dřív vyřeší, vyhrává.', 'Up to 8 players on the same puzzle; first to solve wins.')}</span>
      ${turn ? (o.w + o.l + o.d ? `<span class="k-muted">${L('Výhry', 'Wins')} ${o.w} · ${L('prohry', 'losses')} ${o.l} · ${L('remízy', 'draws')} ${o.d}</span>` : '') : o.races ? `<span class="k-muted">${L('Závody', 'Races')} ${o.races} · ${L('vítězství', 'wins')} ${o.raceWins}</span>` : ''}
      <div class="k-row"><button class="k-btn primary" data-k="online">${L('Hrát online', 'Play online')}</button></div>`);
  }

  // Seznam otevřených her, založení a připojení kódem.
  let lobbyT = 0;
  function onlineView(code = '') {
    setView('online', 'Online');
    const turn = DEF.online.kind === 'turn', diffs = onDiffs();
    const sel = diffs.some(d => d.id === META.onDiff) ? META.onDiff : diffs[0].id;
    $('#kView').innerHTML = `<div class="k-page k-on">
      <h2>Online</h2>
      <div class="k-grid">
        ${card('', `<div class="k-card-h">${icon('user')}<span>${L('Tvoje přezdívka', 'Your nickname')}</span></div>
          <input class="k-in" id="kNick" maxlength="20" value="${esc(nick())}" autocomplete="nickname">`)}
        ${card('', `<div class="k-card-h">${icon('plus')}<span>${L('Nová hra', 'New game')}</span></div>
          ${turn ? `<span class="k-muted">${L('Barvy se po každé partii střídají.', 'Colours swap after every game.')}</span>` : `<div class="k-chips">${diffs.map(d => `<button class="k-chip ${d.id === sel ? 'on' : ''}" data-diff="${d.id}">${d.name}</button>`).join('')}</div>`}
          <label class="k-check"><input type="checkbox" id="kOpen" checked> ${L('Ukázat v seznamu otevřených her', 'List it among open games')}</label>
          <div class="k-row"><button class="k-btn primary" id="kCreate">${L('Založit hru', 'Create game')}</button></div>`)}
        ${card('', `<div class="k-card-h">${icon('link')}<span>${L('Připojit kódem', 'Join with a code')}</span></div>
          <div class="k-row"><input class="k-in k-codein" id="kCode" maxlength="5" placeholder="ABCDE" value="${esc(code)}" autocomplete="off" autocapitalize="characters"><button class="k-btn" id="kJoin">${L('Připojit', 'Join')}</button></div>`)}
      </div>
      <h3>${L('Otevřené hry', 'Open games')}</h3>
      <div class="k-rooms" id="kRooms"><span class="k-muted">${L('Načítám…', 'Loading…')}</span></div>
    </div>`;
    const saveNick = () => { const v = $('#kNick').value.replace(/\s+/g, ' ').trim().slice(0, 20); if (v) { META.nick = v; saveMeta(); } };
    $('#kNick').onchange = saveNick;
    for (const c of document.querySelectorAll('.k-chip')) c.onclick = () => { SOUND.ui(); META.onDiff = c.dataset.diff; saveMeta(); for (const x of document.querySelectorAll('.k-chip')) x.classList.toggle('on', x === c); };
    $('#kCreate').onclick = async () => {
      SOUND.ui(); saveNick(); $('#kCreate').disabled = true;
      const diff = turn ? 'online' : (document.querySelector('.k-chip.on') || {}).dataset?.diff || diffs[0].id;
      try {
        const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game: DEF.id, kind: DEF.online.kind, diff, nick: nick(), open: $('#kOpen').checked }) });
        const body = await res.json(); if (!res.ok || !body.code) throw new Error(body.error || res.status);
        connect(body.code);
      } catch (e) { toast(L('Hru se nepodařilo založit', 'Could not create the game')); if ($('#kCreate')) $('#kCreate').disabled = false; }
    };
    const join = () => { const c = $('#kCode').value.trim().toUpperCase(); if (!/^[A-Z2-9]{5}$/.test(c)) { $('#kCode').classList.add('bad'); return; } SOUND.ui(); saveNick(); connect(c); };
    $('#kJoin').onclick = join;
    $('#kCode').onkeydown = e => { if (e.key === 'Enter') join(); };
    const load = async () => {
      if (view !== 'online') return;
      try {
        const { rooms } = await (await fetch(`${API}?game=${DEF.id}`)).json();
        if (view !== 'online') return;
        $('#kRooms').innerHTML = rooms.length ? rooms.map(r => `<button class="k-room" data-code="${r.code}"><b>${esc(r.host)}</b><span>${r.kind === 'race' ? diffName(r.diff) : L('čeká na soupeře', 'waiting for an opponent')}</span><em>${icon('users', 'tiny')} ${r.players}/${r.max}</em></button>`).join('')
          : `<span class="k-muted">${L('Teď nikdo nečeká. Založ hru a pošli kód.', 'Nobody is waiting right now. Create a game and share the code.')}</span>`;
        for (const b of document.querySelectorAll('.k-room')) b.onclick = () => { SOUND.ui(); saveNick(); connect(b.dataset.code); };
      } catch (e) { if ($('#kRooms')) $('#kRooms').innerHTML = `<span class="k-muted">${L('Seznam teď není dostupný.', 'The list is not available right now.')}</span>`; }
      clearTimeout(lobbyT); lobbyT = setTimeout(load, 5000);
    };
    load();
  }

  // ── Spojení ──
  function connect(code) {
    if (ON.ws && ON.code === code) return roomView();
    disconnect();
    Object.assign(ON, { code, meta: null, me: null, seat: null, players: [], round: null, chat: [], retry: 0, applied: 0, counted: -1, unread: 0, rematch: [], drawFrom: null });
    try { history.replaceState(null, '', `?duel=${code}`); } catch (e) { /* bez historie */ }
    roomView();
    open_();
  }
  function open_() {
    const ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}${API}/${ON.code}/ws`);
    ON.ws = ws;
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', pid: pid(), nick: nick() })); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } if (ws === ON.ws) onMessage(m); };
    ws.onclose = ev => {
      if (ws !== ON.ws) return;
      ON.ws = null;
      if (ev.code === 4000 || !ON.code) return;
      if (!ON.meta && ON.retry >= 2) { toast(L('Hra s tímto kódem neexistuje', 'No game with this code')); leaveRoom(); return; }
      ON.retry++; bar();
      setTimeout(() => { if (ON.code && !ON.ws) open_(); }, Math.min(8000, 400 * 2 ** ON.retry));
    };
  }
  function send(m) { if (ON.ws && ON.ws.readyState === 1) { ON.ws.send(JSON.stringify(m)); return true; } return false; }
  function disconnect() { const ws = ON.ws; ON.ws = null; if (ws) try { ws.close(1000); } catch (e) { /* zavřeno */ } }
  function leaveRoom() {
    ON.code = null; disconnect(); clearTimeout(lobbyT);
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* bez historie */ }
    if (view === 'play') leavePlay();
    closeModal(); onlineView();
  }

  function onMessage(m) {
    switch (m.t) {
      case 'welcome': {
        const fresh = !ON.meta || ON.round?.n !== m.round.n;
        Object.assign(ON, { me: m.you, seat: m.seat, meta: m.meta, round: m.round, players: m.players, chat: m.chat, offset: m.now - Date.now(), retry: 0, rematch: m.round.rematch || [], drawFrom: m.round.drawOffer });
        if (isOnline() && !fresh && ON.applied !== m.round.moves.length && ON.meta.kind === 'turn') { openOnline(); return; }
        route(fresh);
        break;
      }
      case 'full': toast(L('Hra je plná', 'The game is full')); leaveRoom(); break;
      case 'players': {
        const before = Object.fromEntries(ON.players.map(p => [p.id, p.online]));
        ON.players = m.players;
        for (const p of m.players) if (before[p.id] && !p.online) ON.offline[p.id] = Date.now(); else if (p.online) delete ON.offline[p.id];
        route(false);
        break;
      }
      case 'chat': ON.chat.push(m); ON.chat = ON.chat.slice(-40); if (!m.sys && view === 'play' && !ON.chatOpen) ON.unread++; if (!m.sys) SOUND.soft(); chatUi(); bar(); break;
      case 'move': {
        if (!ON.round) return;
        ON.round.moves[m.n] = m.m;
        if (m.seat === ON.seat) return;
        ON.drawFrom = null;
        if (isOnline() && inst && inst.net && m.n === ON.applied) { ON.applied++; inst.net.onMove && inst.net.onMove(m.m); }
        else if (isOnline() && m.n > ON.applied) openOnline();
        bar();
        break;
      }
      case 'draw': ON.drawFrom = m.seat; if (m.seat !== ON.seat) toast(L('Soupeř nabízí remízu', 'Your opponent offers a draw')); bar(); break;
      case 'rematch': ON.rematch = m.seats; if (!m.seats.includes(ON.seat)) toast(L('Soupeř chce odvetu', 'Your opponent wants a rematch')); resultButtons(); break;
      case 'over':
        if (ON.round) ON.round.over = { winner: m.winner, why: m.why };
        if (ON.meta.kind === 'race') raceOver(); else if (isOnline() && view === 'play') turnOver(); else if (view === 'room') roomView();
        break;
      case 'round': {
        ON.offset = m.now - Date.now(); ON.round = m.round; ON.rematch = []; ON.drawFrom = null;
        closeModal(); route(true);
        break;
      }
      case 'prog': if (ON.round && ON.round.results[m.id]) { ON.round.results[m.id].p = m.p; raceBar(); if ($('#kStand')) $('#kStand').innerHTML = standingsHtml(); } break;
      case 'done': if (ON.round) { ON.round.results[m.id] = m.r; raceBar(); standingsUi(); } break;
    }
  }

  // Kam patří obrazovka podle stavu místnosti.
  function route(fresh) {
    const r = ON.round; if (!r || !ON.meta) return;
    if (ON.meta.kind === 'turn') {
      const seated = ON.players.filter(p => p.seat != null).length === 2;
      if (seated && ON.seat != null && !r.over && (fresh || !isOnline())) openOnline();
      else if (r.over && fresh && view !== 'play') roomView();
      else if (view === 'room') roomView(); else bar();
    } else {
      const inRace = r.startAt && !r.over && r.results[ON.me] && r.results[ON.me].time == null;
      if (inRace && (fresh || !isOnline())) openOnline();
      else if (view === 'room') roomView(); else { raceBar(); standingsUi(); }
    }
  }

  // ── Místnost (čekárna) ──
  function roomView() {
    if (view === 'play') leavePlay();
    setView('room', `Online · ${ON.code}`);
    const m = ON.meta, r = ON.round, turn = DEF.online.kind === 'turn';
    const host = ON.players.find(p => p.host), iHost = host && host.id === ON.me;
    const running = r && r.startAt && !r.over;
    let status = L('Připojuji…', 'Connecting…');
    if (m && turn) status = ON.seat == null ? L('Hra je obsazená.', 'This game is taken.') : ON.players.filter(p => p.seat != null).length < 2 ? L('Čeká se na soupeře. Pošli mu kód nebo odkaz.', 'Waiting for an opponent. Send them the code or the link.') : r.over ? L('Partie skončila.', 'The game is over.') : '';
    if (m && !turn) status = running ? L('Probíhá kolo, přidáš se do dalšího.', 'A round is on; you join the next one.') : iHost ? L('Vyber obtížnost a odstartuj, až budou všichni.', 'Pick a difficulty and start when everyone is here.') : L('Čeká se na start od hostitele.', 'Waiting for the host to start.');
    $('#kView').innerHTML = `<div class="k-page k-on">
      <div class="k-codebox"><span class="k-eyebrow">${L('Kód hry', 'Game code')}</span><b id="kRoomCode">${ON.code}</b><button class="k-btn" id="kShare">${icon('link')} ${L('Kopírovat odkaz', 'Copy link')}</button></div>
      <p class="k-muted k-status">${status}</p>
      <div class="k-grid">
        ${card('', `<div class="k-card-h">${icon('users')}<span>${L('Hráči', 'Players')}</span><em>${ON.players.filter(p => p.online).length}${turn ? '/2' : '/8'}</em></div>
          <ul class="k-plist">${ON.players.map(p => `<li class="${p.online ? '' : 'off'}">${turn && p.seat != null && r ? `<i class="k-side ${(p.seat === firstSeat()) ? 'w' : 'b'}"></i>` : icon(p.host ? 'crown' : 'user', 'tiny')}<b>${esc(p.nick)}</b>${p.id === ON.me ? `<small>${L('ty', 'you')}</small>` : ''}${p.online ? '' : `<small>${L('offline', 'offline')}</small>`}</li>`).join('')}</ul>
          ${!turn && iHost && !running ? `<div class="k-chips">${onDiffs().map(d => `<button class="k-chip ${r && d.id === r.diff ? 'on' : ''}" data-diff="${d.id}">${d.name}</button>`).join('')}</div>
            <div class="k-row"><button class="k-btn primary" id="kStart">${icon('play')} ${L('Odstartovat', 'Start')}</button></div>` : ''}
          ${turn && r && r.over && ON.seat != null ? `<div class="k-row"><button class="k-btn primary" id="kRematch" ${ON.rematch.includes(ON.seat) ? 'disabled' : ''}>${ON.rematch.includes(ON.seat) ? L('Čeká se na soupeře…', 'Waiting for the opponent…') : L('Odveta', 'Rematch')}</button></div>` : ''}
          ${!turn && r && r.startAt ? standingsHtml() : ''}`)}
        ${card('k-chatcard', chatHtml())}
      </div>
      <div class="k-row"><button class="k-btn ghost" id="kLeave">${icon('back')} ${L('Opustit hru', 'Leave the game')}</button></div>
    </div>`;
    $('#kShare').onclick = async () => {
      const url = `${location.origin}${location.pathname}?duel=${ON.code}`;
      try { if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: DEF.title, url }); else { await navigator.clipboard.writeText(url); toast(L('Odkaz zkopírován', 'Link copied')); } } catch (e) { toast(url); }
    };
    $('#kLeave').onclick = () => { SOUND.ui(); leaveRoom(); };
    for (const c of document.querySelectorAll('.k-on .k-chip')) c.onclick = () => { SOUND.ui(); for (const x of document.querySelectorAll('.k-on .k-chip')) x.classList.toggle('on', x === c); };
    if ($('#kStart')) $('#kStart').onclick = () => { SOUND.ui(); const c = document.querySelector('.k-on .k-chip.on'); send({ t: 'start', diff: c ? c.dataset.diff : null }); };
    if ($('#kRematch')) $('#kRematch').onclick = () => { SOUND.ui(); send({ t: 'rematch' }); };
    bindChat();
  }

  // ── Chat ──
  function chatHtml() {
    const line = c => c.sys ? `<li class="sys">${esc(c.nick)} ${c.text === 'join' ? L('přišel(a)', 'joined') : L('odešel(a)', 'left')}</li>` : `<li><b>${esc(c.nick)}</b> ${esc(c.text)}</li>`;
    return `<div class="k-card-h">${icon('chat')}<span>Chat</span></div><ul class="k-chat" id="kChatLog">${ON.chat.map(line).join('')}</ul>
      <form class="k-chatform" id="kChatForm"><input class="k-in" id="kChatIn" maxlength="200" placeholder="${L('Napiš zprávu…', 'Say something…')}" autocomplete="off"><button class="k-btn" aria-label="${L('Odeslat', 'Send')}">${icon('send')}</button></form>`;
  }
  function bindChat() {
    const f = $('#kChatForm'); if (!f) return;
    f.onsubmit = e => { e.preventDefault(); const i = $('#kChatIn'), t = i.value.trim(); if (t && send({ t: 'chat', text: t })) i.value = ''; };
    const log = $('#kChatLog'); if (log) log.scrollTop = log.scrollHeight;
  }
  function chatUi() {
    const box = document.querySelector('.k-chatcard, #kChatDrawer'); if (!box) return;
    const keep = $('#kChatIn') ? $('#kChatIn').value : '', focus = document.activeElement === $('#kChatIn');
    box.innerHTML = chatHtml(); bindChat();
    if ($('#kChatIn')) { $('#kChatIn').value = keep; if (focus) $('#kChatIn').focus(); }
  }

  // ── Hraní online ──
  function openOnline() {
    const r = ON.round, turn = ON.meta.kind === 'turn';
    if (inst && inst.destroy) inst.destroy(); inst = null;
    cur = { kind: 'online', key: ON.code, diff: r.diff, seed: r.seed, state: null, time: 0, mistakes: 0, hints: 0 };
    ON.applied = turn ? r.moves.length : 0; ON.prog = -1; ON.unread = 0; ON.chatOpen = false;
    closeModal();
    setView('play', `Online · ${ON.code}${turn ? '' : ' · ' + diffName(r.diff)}`);
    $('#kView').innerHTML = `<div class="k-play"><div class="k-onbar" id="kOnBar"></div><div id="kChatDrawer" class="k-card" hidden></div><div class="k-board" id="kBoard"><div class="k-gen"><i></i>${L('Připravuji hru…', 'Preparing the game…')}</div></div></div>`;
    timerOn = false; updTimer(); bar();
    setTimeout(() => {
      let puzzle;
      try { puzzle = DEF.generate(cur.seed, cur.diff, { kind: 'online', key: ON.code }); } catch (e) { console.error(e); toast(L('Hru se nepodařilo připravit', 'Could not prepare the game')); roomView(); return; }
      if (view !== 'play' || !isOnline()) return;
      $('#kBoard').innerHTML = '';
      if (!turn) { countdown(puzzle); return; }
      const net = {
        side: mySide(), moves: r.moves.slice(0, ON.applied), me: nick(), opp: (opp() || {}).nick || '?', onMove: null,
        send(m) { send({ t: 'move', n: ON.applied, m }); ON.applied++; ON.drawFrom = null; bar(); },
        end(winSide, why) { send({ t: 'end', winner: winSide === 0 ? -1 : winSide === 1 ? firstSeat() : 1 - firstSeat(), why }); },
        resign() { send({ t: 'resign' }); },
      };
      inst = DEF.create($('#kBoard'), puzzle, null, api, { diff: cur.diff, kind: 'online', key: ON.code, settings: SAVE.settings, net });
      if (inst) inst.net = net;
      timerOn = true; lastTick = performance.now(); if (r.over) turnOver();
    }, 30);
  }

  // Závod: odpočet do společného startu; hlavolam vznikne až po něm, čas běží od startu serveru.
  function countdown(puzzle) {
    const r = ON.round, board = $('#kBoard'); if (!board) return;
    const cover = document.createElement('div'); cover.id = 'kCount'; cover.className = 'k-count'; board.appendChild(cover);
    clearInterval(ON.countT);
    const tick = () => {
      if (!isOnline() || ON.round !== r || !board.isConnected) { clearInterval(ON.countT); return; }
      const left = (r.startAt - serverNow()) / 1000;
      if (left <= 0) {
        clearInterval(ON.countT); board.innerHTML = '';
        inst = DEF.create(board, puzzle, null, api, { diff: cur.diff, kind: 'online', key: ON.code, settings: SAVE.settings });
        cur.time = Math.max(0, -left); timerOn = true; lastTick = performance.now(); SOUND.star(); raceBar(); return;
      }
      cover.innerHTML = `<b>${Math.ceil(left)}</b><span>${L('Všichni mají stejné zadání', 'Everyone has the same puzzle')}</span>`;
    };
    tick(); ON.countT = setInterval(tick, 100);
  }

  // Lišta nad plochou: hráči, spojení, remíza, chat.
  function bar() {
    const el = $('#kOnBar'); if (!el || !ON.meta) return;
    if (ON.meta.kind === 'race') { raceBar(); return; }
    const o = opp(), side = mySide(), gone = o && !o.online && ON.offline[o.id];
    const r = ON.round, toMove = r && !r.over ? (((r.n + ON.applied) % 2) === ON.seat) : false;
    el.innerHTML = `<div class="k-vs"><span class="${toMove ? 'turn' : ''}"><i class="k-side ${side > 0 ? 'w' : 'b'}"></i><b>${esc(nick())}</b></span><em>vs</em><span class="${!toMove && r && !r.over ? 'turn' : ''} ${o && !o.online ? 'off' : ''}"><i class="k-side ${side > 0 ? 'b' : 'w'}"></i><b>${esc(o ? o.nick : '?')}</b>${o && !o.online ? `<small>${L('offline', 'offline')}</small>` : ''}</span></div>
      <div class="k-onacts">${ON.ws ? '' : `<span class="k-muted">${L('Připojuji…', 'Reconnecting…')}</span>`}
        ${r && !r.over ? `<button class="k-btn ${ON.drawFrom != null && ON.drawFrom !== ON.seat ? 'primary' : ''}" id="kDraw" ${ON.drawFrom === ON.seat ? 'disabled' : ''}>${ON.drawFrom != null && ON.drawFrom !== ON.seat ? L('Přijmout remízu', 'Accept draw') : ON.drawFrom === ON.seat ? L('Remíza nabídnuta', 'Draw offered') : L('Remíza?', 'Draw?')}</button>` : ''}
        ${gone && Date.now() - gone > 60000 && r && !r.over ? `<button class="k-btn primary" id="kClaim">${L('Ukončit · výhra', 'Claim the win')}</button>` : ''}
        <button class="k-btn" id="kChatBtn">${icon('chat')}${ON.unread ? `<sup>${ON.unread}</sup>` : ''}</button></div>`;
    if ($('#kDraw')) $('#kDraw').onclick = () => { SOUND.ui(); send({ t: 'draw' }); };
    if ($('#kClaim')) $('#kClaim').onclick = () => { SOUND.ui(); send({ t: 'claim' }); };
    $('#kChatBtn').onclick = toggleChat;
    if (gone && r && !r.over && Date.now() - gone <= 60000) { clearTimeout(ON.claimT); ON.claimT = setTimeout(bar, 60500 - (Date.now() - gone)); }
  }
  function toggleChat() {
    SOUND.ui(); ON.chatOpen = !ON.chatOpen; ON.unread = 0;
    const d = $('#kChatDrawer'); if (d) { d.hidden = !ON.chatOpen; if (ON.chatOpen) { d.innerHTML = chatHtml(); bindChat(); $('#kChatIn').focus(); } }
    bar();
  }
  function raceBar() {
    const el = $('#kOnBar'); if (!el || !ON.round || ON.meta.kind !== 'race') return;
    const res = ON.round.results, names = Object.fromEntries(ON.players.map(p => [p.id, p]));
    el.innerHTML = `<div class="k-race">${Object.entries(res).map(([id, x]) => `<div class="${id === ON.me ? 'me' : ''} ${x.time != null ? (x.ok ? 'ok' : 'out') : ''}"><b>${esc((names[id] || {}).nick || '?')}</b><i><u style="width:${Math.round(x.p * 100)}%"></u></i><small>${x.time != null ? (x.ok ? fmtTime(x.time / 1000) : L('mimo', 'out')) : Math.round(x.p * 100) + ' %'}</small></div>`).join('')}</div>
      <div class="k-onacts">${ON.ws ? '' : `<span class="k-muted">${L('Připojuji…', 'Reconnecting…')}</span>`}<button class="k-btn" id="kChatBtn">${icon('chat')}${ON.unread ? `<sup>${ON.unread}</sup>` : ''}</button></div>`;
    $('#kChatBtn').onclick = toggleChat;
  }
  // Průběh závodu posílá kit sám (nejvýš jednou za sekundu, jen při změně).
  function raceTick() {
    if (!isOnline() || ON.meta?.kind !== 'race' || !inst || !inst.progress || !timerOn) return;
    let p = 0; try { p = Math.max(0, Math.min(0.99, +inst.progress() || 0)); } catch (e) { return; }
    if (Math.abs(p - ON.prog) >= 0.01 && Date.now() - ON.progAt > 900) { ON.prog = p; ON.progAt = Date.now(); send({ t: 'prog', p }); }
  }

  function onlineSolved(extra) {
    timerOn = false;
    if (ON.meta.kind !== 'race') return;
    const c = cur, dr = diffIndex(c.diff);
    SAVE.stats.solved++; const xp = [12, 22, 36, 56, 80][dr] || 20; SAVE.xp += xp;
    questProgress({ solved: true, game: DEF.id, daily: false, diffRank: dr, perfect: !c.mistakes && !c.hints, stars: 0 });
    checkAch(); persist(); shardsUi();
    send({ t: 'done', ok: true, mistakes: c.mistakes, score: extra && extra.score != null ? Math.round(extra.score) : undefined });
    SOUND.win(); burst(innerWidth / 2, innerHeight / 2, 60);
    standingsModal(extra && extra.title || L('Vyřešeno!', 'Solved!'), `+${xp} XP`);
  }
  function onlineFailed(extra) {
    timerOn = false;
    if (ON.meta.kind !== 'race') return;
    send({ t: 'done', ok: false, mistakes: cur.mistakes, score: extra && extra.score != null ? Math.round(extra.score) : undefined });
    SOUND.error();
    standingsModal(extra && extra.title || L('Konec', 'Out'), '');
  }
  function standingsHtml() {
    const r = ON.round, names = Object.fromEntries(ON.players.map(p => [p.id, p.nick]));
    const rank = x => (x.ok ? 0 : x.time != null ? 2 : 1);
    const order = Object.entries(r.results).sort(([, a], [, b]) => rank(a) - rank(b) || (a.ok && b.ok ? a.time - b.time : b.p - a.p));
    return `<ol class="k-stand">${order.map(([id, x]) => `<li class="${id === ON.me ? 'me' : ''}"><b>${esc(names[id] || '?')}</b><span>${x.time != null ? (x.ok ? fmtTime(x.time / 1000) : L('mimo', 'out')) : `${Math.round(x.p * 100)} %`}</span></li>`).join('')}</ol>`;
  }
  function standingsModal(title, gains) {
    const r = ON.round, host = ON.players.find(p => p.host), iHost = host && host.id === ON.me;
    modal(`<div class="k-result"><span class="k-eyebrow">${L('Závod', 'Race')} · ${diffName(r.diff)}</span><h2 class="${r.results[ON.me] && r.results[ON.me].ok === false ? 'lose' : ''}">${title}</h2>
      ${gains ? `<div class="k-gains"><span>${gains}</span></div>` : ''}
      <div id="kStand">${standingsHtml()}</div><p class="k-muted" id="kStandNote">${r.over ? '' : L('Čeká se na ostatní…', 'Waiting for the others…')}</p>
      <div class="k-row">${r.over && iHost ? `<button class="k-btn primary" id="kNextRound">${L('Další kolo', 'Next round')}</button>` : ''}<button class="k-btn ghost" id="kHome">${L('Do místnosti', 'Back to the room')}</button></div></div>`);
    $('#kHome').onclick = () => { SOUND.ui(); closeModal(); roomView(); };
    if ($('#kNextRound')) $('#kNextRound').onclick = () => { SOUND.ui(); send({ t: 'start', diff: r.diff }); };
  }
  function standingsUi() {
    if ($('#kStand')) $('#kStand').innerHTML = standingsHtml();
    if (view === 'room') roomView();
  }
  function raceOver() {
    const r = ON.round, res = r.results, mine = res[ON.me];
    if (!mine || ON.counted === r.n) { if (view === 'room') roomView(); return; }
    ON.counted = r.n;
    const o = onStats(); o.races++;
    const first = Object.entries(res).filter(([, x]) => x.ok).sort(([, a], [, b]) => a.time - b.time)[0];
    const won = first && first[0] === ON.me && Object.keys(res).length > 1;
    if (won) { o.raceWins++; lbSet('online:wins', o.raceWins); SAVE.xp += 25; META.shards += 10; saveMeta(); }
    persist(); shardsUi();
    if (mine.time == null) { timerOn = false; }
    standingsModal(won ? L('Vítězství!', 'You won!') : mine.ok ? L('Závod skončil', 'Race over') : L('Konec závodu', 'Race over'), won ? `+25 XP · +10 ${icon('gem', 'tiny')}` : '');
    if (won) { SOUND.win(); burst(innerWidth / 2, innerHeight / 3, 90); }
  }

  // Konec partie: výsledek z pohledu hráče, odveta.
  function turnOver() {
    const r = ON.round; if (!r || !r.over) return;
    timerOn = false;
    const res = r.over.winner === -1 ? 'd' : r.over.winner === ON.seat ? 'w' : 'l';
    if (ON.counted !== r.n && ON.seat != null) {
      ON.counted = r.n; const o = onStats(); o[res]++; if (res === 'w') lbSet('online:wins', o.w);
      SAVE.xp += { w: 30, d: 15, l: 8 }[res];
      if (res === 'w') { META.shards += 8; saveMeta(); questProgress({ solved: true, game: DEF.id, daily: false, diffRank: 2, perfect: false, stars: 0 }); }
      checkAch(); persist(); shardsUi();
      res === 'w' ? (SOUND.win(), burst(innerWidth / 2, innerHeight / 2, 80)) : res === 'l' ? SOUND.error() : SOUND.star();
    }
    const why = r.over.why === 'resign' ? (res === 'w' ? L('Soupeř se vzdal', 'Your opponent resigned') : L('Vzdal(a) ses', 'You resigned')) : WHY[r.over.why] || '';
    setTimeout(() => {
      if (!isOnline() || ON.round !== r) return;
      modal(`<div class="k-result"><span class="k-eyebrow">Online · ${esc(nick())} vs ${esc((opp() || {}).nick || '?')}</span>
        <h2 class="${res === 'l' ? 'lose' : ''}">${{ w: L('Výhra!', 'You win!'), l: L('Prohra', 'You lost'), d: L('Remíza', 'Draw') }[res]}</h2>
        <p class="k-muted">${why}</p>
        <div class="k-gains"><span>+${{ w: 30, d: 15, l: 8 }[res]} XP</span>${res === 'w' ? `<span>+8 ${icon('gem', 'tiny')}</span>` : ''}</div>
        <div class="k-row" id="kResBtns"></div></div>`);
      resultButtons();
    }, 600);
  }
  function resultButtons() {
    const el = $('#kResBtns'); if (!el) { if (view === 'room') roomView(); return; }
    const mine = ON.rematch.includes(ON.seat), theirs = ON.rematch.length && !mine;
    el.innerHTML = `<button class="k-btn primary" id="kRematch" ${mine ? 'disabled' : ''}>${mine ? L('Čeká se na soupeře…', 'Waiting for the opponent…') : theirs ? L('Přijmout odvetu', 'Accept the rematch') : L('Odveta', 'Rematch')}</button><button class="k-btn ghost" id="kHome">${L('Do místnosti', 'Back to the room')}</button>`;
    $('#kRematch').onclick = () => { SOUND.ui(); send({ t: 'rematch' }); };
    $('#kHome').onclick = () => { SOUND.ui(); closeModal(); roomView(); };
  }

  // ── Modální okno, oznámení, efekty ──
  function modal(html) { const m = $('#kModal'); m.innerHTML = `<div class="k-modal-in">${html}</div>`; m.hidden = false; }
  function closeModal() { $('#kModal').hidden = true; }
  function toast(t) {
    const el = document.createElement('div'); el.className = 'k-toast'; el.innerHTML = t;
    $('#kToasts').appendChild(el); setTimeout(() => el.remove(), 3200);
  }
  let parts = [], fxOn = false;
  function burst(x, y, n = 40) {
    const st = getComputedStyle(document.documentElement), cols = ['--a', '--b', '--c'].map(v => st.getPropertyValue(v).trim());
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 7; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, c: cols[i % 3], s: 2 + Math.random() * 3 }); }
    if (!fxOn) { fxOn = true; requestAnimationFrame(fx); }
  }
  function fx() {
    const cv = $('#kFx'); if (!cv) { fxOn = false; return; }
    const ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.vx *= 0.98; p.life -= 0.014; ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill(); }
    if (parts.length) requestAnimationFrame(fx); else { fxOn = false; ctx.clearRect(0, 0, cv.width, cv.height); }
  }

  // ── Klávesnice ──
  document.addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (!$('#kModal').hidden) { if (e.key === 'Escape' || e.key === 'Enter') { const b = $('#kModal .k-btn.primary') || $('#kModal #kHome'); if (e.key === 'Enter' && b) b.click(); else if (e.key === 'Escape' && $('#kHome')) $('#kHome').click(); } return; }
    if (e.key === 'Escape' && view !== 'home') { back(); return; }
    if (view === 'play' && inst && inst.onKey) inst.onKey(e);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (inst && inst.pause) inst.pause(); if (view === 'play' && inst && cur && SAVE.cur === cur) { cur.state = inst.getState(); } persist(); } });
  addEventListener('pagehide', () => { if (view === 'play' && inst && cur && SAVE.cur === cur) cur.state = inst.getState(); if (DEF) persist(); });
  document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('.k-board')) e.preventDefault(); });

  // ── Start ──
  function game(def) {
    DEF = def;
    SAVE = loadSave();
    applyTheme();
    shell();
    quests();
    persist();
    home();
    const code = new URLSearchParams(location.search).get('duel');
    if (DEF.online && code && /^[A-Z2-9]{5}$/.test(code)) connect(code);
  }

  return { game, L, LANG, rng, hash, shuffle, icon, dayKey, fmtTime, fmtNum, esc, api, _test: { dailyDiff: k => dailyDiff(k), levelDiff: n => levelDiff(n), start, get save() { return SAVE; }, get meta() { return META; }, get inst() { return inst; }, get cur() { return cur; }, online: ON } };
})();
