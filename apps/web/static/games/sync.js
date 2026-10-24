'use strict';
// Windowling Game Center: cloud saves. Loaded first on every game page and on the hub
// (<script src="../sync.js"> in <head>). For a signed-in player it keeps the games'
// localStorage progress in the account (/api/sync), so it follows them to other devices;
// anonymous players are not affected. The games themselves are not changed: writes to
// the synced keys are only time-stamped here, the newest write of a key wins.
(function () {
  if (window.GCSync) return;
  let ls;
  try { ls = window.localStorage; ls.getItem('x'); } catch (e) { return; }
  // The same rule as SYNC_KEY_RE in apps/web/src/lib/cloud.ts.
  const RE = /^(gamecenter\.(lang|puzzles|music|favorites|stats\.[a-z0-9-]{1,32})|[a-z0-9-]{2,32}\.save\.v1|driftwood\.[A-Za-z0-9._:-]{1,64})$/;
  const META = 'gamecenter.sync';
  const S = Storage.prototype, get = S.getItem, set = S.setItem, remove = S.removeItem;
  // meta.t: when this device last wrote a key; meta.v: the account's version at the last sync;
  // meta.user: whose account this device synced with.
  let meta;
  try { meta = JSON.parse(get.call(ls, META)) || {}; } catch (e) { meta = {}; }
  meta.t = meta.t || {}; meta.v = meta.v || {};
  let saveT = 0;
  const saveMeta = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { set.call(ls, META, JSON.stringify(meta)); } catch (e) { /* full */ } }, 300); };
  // Games write their saves as soon as they start, before the account has answered. Those
  // writes only repeat what the device had, so they must not count as newer than the account:
  // they are stamped once the first sync of the page is done (unless the account's value won).
  let ready = false;
  const early = new Set();
  const touch = key => { if (!ready) { early.add(key); return; } meta.t[key] = Date.now(); saveMeta(); };
  const settle = applied => {
    ready = true;
    const now = Date.now();
    for (const k of early) if (!applied.includes(k)) meta.t[k] = now;
    early.clear(); saveMeta();
  };
  // While a game page reloads into newer progress, its old in-memory state must not be saved.
  let frozen = false;

  // Time-stamp every change of a synced key, whoever makes it.
  S.setItem = function (key, value) {
    if (this === ls && RE.test(key)) {
      if (frozen) return;
      const before = get.call(this, key);
      set.call(this, key, value);
      if (before !== String(value)) touch(key);
      return;
    }
    return set.call(this, key, value);
  };
  S.removeItem = function (key) {
    if (this === ls && RE.test(key) && frozen) return;
    if (this === ls && RE.test(key) && get.call(this, key) !== null) { remove.call(this, key); touch(key); return; }
    return remove.call(this, key);
  };

  const localKeys = () => { const out = []; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && RE.test(k)) out.push(k); } return out; };
  // First sync of this device with an account (progress made before signing in): per game,
  // keep the side with more play time (the device you played more on wins), so a game's save
  // and its stats always come from the same side.
  const gameOf = key => (key.startsWith('gamecenter.stats.') ? key.slice(17) : key.endsWith('.save.v1') ? key.slice(0, -8) : key.startsWith('driftwood.') ? 'driftwood' : key);
  const playTime = (value, key) => { try { const o = JSON.parse(value); if (key === 'gamecenter.puzzles') return o.shards || 0; return (o && (o.playTime || o.time || o.xp)) || 0; } catch (e) { return 0; } };
  function score(key, read) {
    const g = gameOf(key);
    const statsKey = `gamecenter.stats.${g}`;
    const s = read(statsKey);
    return s != null ? playTime(s, statsKey) : playTime(read(key), key);
  }

  let state = 'unknown', running = null, lastSync = 0;
  const emit = detail => { try { window.dispatchEvent(new CustomEvent('gamecenter:sync', { detail })); } catch (e) { /* old browser */ } };

  // Larger values are kept on this device only (the account refuses them).
  const fits = e => (e.data || '').length < 1000000;
  async function push(entries, keepalive) {
    for (let i = 0; i < entries.length; i += 50) {
      const batch = entries.slice(i, i + 50);
      const res = await fetch('/api/sync', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ saves: batch }), keepalive: !!keepalive });
      if (!res.ok) throw new Error(`sync ${res.status}`);
      for (const e of batch) meta.v[e.key] = e.t;
    }
  }

  /** Pulls the account's progress, merges it with this device and pushes what is newer here. */
  function sync() {
    if (running) return running;
    running = (async () => {
      try {
        const res = await fetch('/api/sync', { cache: 'no-store', credentials: 'same-origin' });
        if (res.status === 401) { state = 'anonymous'; settle([]); return { state, applied: [] }; }
        if (!res.ok) throw new Error(`sync ${res.status}`);
        const body = await res.json();
        const server = new Map(body.saves.map(s => [s.key, s]));
        const first = meta.user !== body.user;
        if (first) { meta.user = body.user; meta.v = {}; meta.sc = {}; }
        const serverRead = k => (server.has(k) ? server.get(k).data : null);
        const localRead = k => get.call(ls, k);
        const applied = [], out = [], now = Date.now();
        for (const key of new Set([...server.keys(), ...localKeys()])) {
          const local = get.call(ls, key), sv = server.get(key), lt = meta.t[key] || 0;
          if (!sv) { if (local !== null) out.push({ key, data: local, t: lt || now }); continue; }
          if (sv.data === local) { meta.v[key] = sv.t; continue; }
          // Three-way: the account's value wins when it changed since this device last synced
          // and this device did not change the key since then (or changed it earlier).
          const seen = meta.v[key] || 0, serverChanged = sv.t > seen, localChanged = lt > seen;
          let keepLocal;
          if (first) keepLocal = local !== null && score(key, localRead) > score(key, serverRead);
          else if (!serverChanged) keepLocal = true;
          else keepLocal = localChanged && lt >= sv.t;
          if (keepLocal) out.push({ key, data: local, t: Math.max(lt, sv.t + 1, first ? now : 0) });
          else {
            if (sv.data === null) remove.call(ls, key); else set.call(ls, key, sv.data);
            meta.t[key] = sv.t; meta.v[key] = sv.t; applied.push(key);
          }
        }
        for (const e of out) meta.t[e.key] = e.t;
        settle(applied);
        await push(out.filter(fits));
        await pushScores().catch(() => {});
        state = 'synced'; lastSync = Date.now(); meta.last = lastSync; saveMeta();
        const result = { state, applied, pushed: out.length, user: body.user };
        emit(result);
        return result;
      } catch (e) {
        if (!ready) settle([]);
        state = state === 'anonymous' ? state : 'error';
        return { state, applied: [] };
      } finally { running = null; }
    })();
    return running;
  }

  // ── Leaderboards: the best results this device knows, sent when they changed ──
  // The same rule as BOARD_RE in apps/web/src/lib/cloud.ts.
  const BOARD = /^(daily:\d{4}-\d{2}-\d{2}|level:\d{1,3}|free:[a-z0-9]{1,16}|best|online|total):(time|score|survive|floor|days|wins|played)$/;
  // Action games keep their records in their own saves.
  const RECORDS = {
    voidborn: s => ({ 'best:survive': Math.round((s.stats && s.stats.bestTime || 0) * 1000) }),
    starspire: s => ({ 'best:floor': s.stats && s.stats.bestFloor }),
    driftwood: s => ({ 'best:days': s.stats && s.stats.bestDays }),
  };
  function collectScores() {
    const out = [];
    const add = (game, board, value) => { value = Math.round(+value || 0); if (value > 0 && value < 1e10 && BOARD.test(board)) out.push({ game, board, value }); };
    for (const key of localKeys()) {
      let o; try { o = JSON.parse(get.call(ls, key)); } catch (e) { continue; }
      if (!o || typeof o !== 'object') continue;
      const save = /^([a-z0-9-]+)\.save\.v1$/.exec(key), stats = /^gamecenter\.stats\.([a-z0-9-]+)$/.exec(key);
      if (save) {
        const game = save[1];
        // puzzle kit: o.lb holds the best result per board
        if (o.lb) for (const [board, value] of Object.entries(o.lb)) add(game, board, value);
        if (RECORDS[game]) for (const [board, value] of Object.entries(RECORDS[game](o))) add(game, board, value);
      }
      // play time of every game (whole minutes count)
      if (stats && o.playTime >= 60) add(stats[1], 'total:played', o.playTime);
    }
    return out;
  }
  async function pushScores() {
    meta.sc = meta.sc || {};
    // Only what changed since it was last sent (the account keeps each player's best anyway).
    const out = collectScores().filter(e => meta.sc[`${e.game}/${e.board}`] !== e.value);
    for (let i = 0; i < out.length; i += 100) {
      const batch = out.slice(i, i + 100);
      const res = await fetch('/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scores: batch }) });
      if (!res.ok) return;
      for (const e of batch) meta.sc[`${e.game}/${e.board}`] = e.value;
    }
    if (out.length) saveMeta();
  }

  /** Sends what changed here since the last sync (tab hidden or closing). */
  function flush() {
    if (state !== 'synced' || frozen) return;
    const out = Object.keys(meta.t).filter(k => meta.t[k] > (meta.v[k] || 0)).map(k => ({ key: k, data: get.call(ls, k), t: meta.t[k] })).filter(fits);
    if (!out.length) return;
    const size = out.reduce((a, e) => a + (e.data || '').length, 0);
    // The page may be closing: record what is being sent now (a failed send is simply sent
    // again at the next sync: the account's copy did not change, so this device's value wins).
    for (const e of out) meta.v[e.key] = e.t;
    try { set.call(ls, META, JSON.stringify(meta)); } catch (e) { /* full */ }
    push(out, size < 60000).catch(() => {});
  }

  window.GCSync = { sync, flush, get state() { return state; }, get lastSync() { return lastSync || meta.last || 0; } };

  // A game page opened straight from a link: if the account had newer progress for it,
  // reload once so the game starts from that progress.
  const onGamePage = /\/games\/[a-z0-9-]+\//.test(location.pathname);
  sync().then(r => {
    if (!onGamePage || !r.applied || !r.applied.length) return;
    // At most one reload per page within a short time (no loops).
    let again = true;
    try {
      const [path, at] = (sessionStorage.getItem('gamecenter.sync.reload') || '|0').split('|');
      again = path === location.pathname && Date.now() - +at < 15000;
      if (!again) sessionStorage.setItem('gamecenter.sync.reload', `${location.pathname}|${Date.now()}`);
    } catch (e) { /* no session storage: do not reload */ }
    if (!again) { frozen = true; clearTimeout(saveT); try { set.call(ls, META, JSON.stringify(meta)); } catch (e) { /* full */ } location.reload(); }
  });
  setInterval(() => { if (!document.hidden && state === 'synced') sync(); }, 90000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); else if (state === 'synced' && Date.now() - lastSync > 20000) sync(); });
  addEventListener('pagehide', flush);
})();
