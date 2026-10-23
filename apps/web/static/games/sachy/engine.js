'use strict';
// ── Šachový engine (Windowling) ─────────────────────────────────────────────
// Deska 10×12 (mailbox), úplná pravidla (rošáda, braní mimochodem, proměna, pat,
// 50 tahů, opakování), Zobrist hash, alfa-beta s iterativním prohlubováním,
// klidové prohledávání, transpoziční tabulka, killer tahy, PST hodnocení.
const Chess = (() => {
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, OFF = 7;
  const VAL = [0, 100, 320, 330, 500, 900, 20000];
  const sq = (f, r) => 21 + f + (7 - r) * 10; // f 0..7 (a..h), r 0..7 (1..8)
  const fileOf = s => (s % 10) - 1, rankOf = s => 7 - (Math.floor(s / 10) - 2);
  const name = s => 'abcdefgh'[fileOf(s)] + (rankOf(s) + 1);
  const DIRS = { [N]: [-21, -19, -12, -8, 8, 12, 19, 21], [B]: [-11, -9, 9, 11], [R]: [-10, -1, 1, 10], [Q]: [-11, -10, -9, -1, 1, 9, 10, 11], [K]: [-11, -10, -9, -1, 1, 9, 10, 11] };
  // PST (z pohledu bílého, a8..h1 po řádcích), zjednodušené PeSTO
  const PST = {
    [P]: [0, 0, 0, 0, 0, 0, 0, 0, 60, 60, 60, 60, 60, 60, 60, 60, 12, 14, 22, 30, 30, 22, 14, 12, 6, 8, 12, 24, 24, 12, 8, 6, 0, 0, 6, 20, 20, 6, 0, 0, 4, -4, -8, 2, 2, -8, -4, 4, 4, 8, 8, -18, -18, 8, 8, 4, 0, 0, 0, 0, 0, 0, 0, 0],
    [N]: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    [B]: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    [R]: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    [Q]: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    [K]: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    KE: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
  };
  const pstIdx = (s, white) => { const f = fileOf(s), r = rankOf(s); return white ? (7 - r) * 8 + f : r * 8 + f; };
  // Zobrist
  let seed = 0x9e3779b1; const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296 * 2 ** 31 | 0; };
  const ZP = [...Array(13)].map(() => [...Array(120)].map(() => [rnd(), rnd()])), ZS = [rnd(), rnd()], ZC = [...Array(16)].map(() => [rnd(), rnd()]), ZE = [...Array(120)].map(() => [rnd(), rnd()]);
  const zx = (h, z) => [h[0] ^ z[0], h[1] ^ z[1]];

  function Pos(fen) {
    const b = new Int8Array(120).fill(OFF);
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) b[sq(f, r)] = 0;
    const [place, side, cast, ep, half, full] = (fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1').split(' ');
    let r = 7, f = 0;
    for (const ch of place) { if (ch === '/') { r--; f = 0; continue; } if (/\d/.test(ch)) { f += +ch; continue; } const t = 'pnbrqk'.indexOf(ch.toLowerCase()) + 1; b[sq(f, r)] = ch === ch.toUpperCase() ? t : -t; f++; }
    this.b = b; this.side = side === 'b' ? -1 : 1;
    this.castle = (cast.includes('K') ? 1 : 0) | (cast.includes('Q') ? 2 : 0) | (cast.includes('k') ? 4 : 0) | (cast.includes('q') ? 8 : 0);
    this.ep = ep && ep !== '-' ? sq('abcdefgh'.indexOf(ep[0]), +ep[1] - 1) : 0;
    this.half = +(half || 0); this.full = +(full || 1); this.hist = []; this.keys = [];
    this.kings = [0, 0]; for (let s = 21; s < 99; s++) { if (b[s] === K) this.kings[0] = s; if (b[s] === -K) this.kings[1] = s; }
    this.key = this.hash();
  }
  Pos.prototype.hash = function () {
    let h = [0, 0]; for (let s = 21; s < 99; s++) { const p = this.b[s]; if (p && p !== OFF) h = zx(h, ZP[p + 6][s]); }
    if (this.side < 0) h = zx(h, ZS); h = zx(h, ZC[this.castle]); if (this.ep) h = zx(h, ZE[this.ep]); return h;
  };
  Pos.prototype.attacked = function (s, by) { // je pole s napadeno stranou by (1/-1)?
    const b = this.b;
    const pd = by > 0 ? [9, 11] : [-9, -11];
    for (const d of pd) if (b[s + d] === P * by) return true;
    for (const d of DIRS[N]) if (b[s + d] === N * by) return true;
    for (const d of DIRS[K]) if (b[s + d] === K * by) return true;
    for (const d of DIRS[B]) { let t = s + d; while (b[t] === 0) t += d; if (b[t] === B * by || b[t] === Q * by) return true; }
    for (const d of DIRS[R]) { let t = s + d; while (b[t] === 0) t += d; if (b[t] === R * by || b[t] === Q * by) return true; }
    return false;
  };
  Pos.prototype.inCheck = function (side = this.side) { return this.attacked(this.kings[side > 0 ? 0 : 1], -side); };
  // tah: { f, t, p (figura), c (braní), pr (proměna), fl: 0 / 'ep' / 'k' / 'q' / 'dbl' }
  Pos.prototype.gen = function (capsOnly) {
    const b = this.b, us = this.side, out = [];
    const add = (f, t, fl) => { const c = fl === 'ep' ? -us * P : b[t]; const p = b[f]; if (Math.abs(p) === P && (rankOf(t) === 7 || rankOf(t) === 0)) { for (const pr of [Q, N, R, B]) out.push({ f, t, p, c, pr: pr * us, fl: 0 }); } else out.push({ f, t, p, c, pr: 0, fl: fl || 0 }); };
    for (let s = 21; s < 99; s++) {
      const p = b[s]; if (!p || p === OFF || Math.sign(p) !== us) continue;
      const a = Math.abs(p);
      if (a === P) {
        const fw = us > 0 ? -10 : 10, start = us > 0 ? 1 : 6;
        if (!capsOnly && b[s + fw] === 0) { add(s, s + fw); if (rankOf(s) === start && b[s + 2 * fw] === 0) add(s, s + 2 * fw, 'dbl'); }
        else if (capsOnly && b[s + fw] === 0 && (rankOf(s + fw) === 7 || rankOf(s + fw) === 0)) add(s, s + fw);
        for (const d of [fw - 1, fw + 1]) { const t = s + d; if (b[t] !== OFF && b[t] && Math.sign(b[t]) === -us) add(s, t); else if (t === this.ep && this.ep) add(s, t, 'ep'); }
        continue;
      }
      const slide = a === B || a === R || a === Q;
      for (const d of DIRS[a]) {
        let t = s + d;
        while (b[t] !== OFF) {
          if (b[t] === 0) { if (!capsOnly) add(s, t); } else { if (Math.sign(b[t]) === -us) add(s, t); break; }
          if (!slide) break; t += d;
        }
      }
      if (a === K && !capsOnly) {
        const home = us > 0 ? sq(4, 0) : sq(4, 7);
        if (s === home && !this.attacked(s, -us)) {
          const kr = us > 0 ? 1 : 4, qr = us > 0 ? 2 : 8;
          if (this.castle & kr && b[s + 1] === 0 && b[s + 2] === 0 && b[s + 3] === R * us && !this.attacked(s + 1, -us) && !this.attacked(s + 2, -us)) out.push({ f: s, t: s + 2, p, c: 0, pr: 0, fl: 'k' });
          if (this.castle & qr && b[s - 1] === 0 && b[s - 2] === 0 && b[s - 3] === 0 && b[s - 4] === R * us && !this.attacked(s - 1, -us) && !this.attacked(s - 2, -us)) out.push({ f: s, t: s - 2, p, c: 0, pr: 0, fl: 'q' });
        }
      }
    }
    return out;
  };
  const CASTLE_MASK = new Int8Array(120).fill(15);
  CASTLE_MASK[sq(4, 0)] = 15 & ~3; CASTLE_MASK[sq(7, 0)] = 15 & ~1; CASTLE_MASK[sq(0, 0)] = 15 & ~2;
  CASTLE_MASK[sq(4, 7)] = 15 & ~12; CASTLE_MASK[sq(7, 7)] = 15 & ~4; CASTLE_MASK[sq(0, 7)] = 15 & ~8;
  Pos.prototype.make = function (m) {
    const b = this.b, us = this.side;
    this.hist.push({ m, castle: this.castle, ep: this.ep, half: this.half, key: this.key, kings: this.kings.slice() });
    this.keys.push(this.key[0]);
    b[m.t] = m.pr || m.p; b[m.f] = 0;
    if (m.fl === 'ep') b[m.t + (us > 0 ? 10 : -10)] = 0;
    if (m.fl === 'k') { b[m.t - 1] = b[m.t + 1]; b[m.t + 1] = 0; }
    if (m.fl === 'q') { b[m.t + 1] = b[m.t - 2]; b[m.t - 2] = 0; }
    if (Math.abs(m.p) === K) this.kings[us > 0 ? 0 : 1] = m.t;
    this.castle &= CASTLE_MASK[m.f] & CASTLE_MASK[m.t];
    this.ep = m.fl === 'dbl' ? (m.f + m.t) / 2 : 0;
    this.half = Math.abs(m.p) === P || m.c ? 0 : this.half + 1;
    if (us < 0) this.full++;
    this.side = -us; this.key = this.hash();
    if (this.inCheck(us)) { this.unmake(); return false; }
    return true;
  };
  Pos.prototype.unmake = function () {
    const h = this.hist.pop(); this.keys.pop(); const m = h.m, b = this.b; this.side = -this.side; const us = this.side;
    b[m.f] = m.p; b[m.t] = m.fl === 'ep' ? 0 : m.c;
    if (m.fl === 'ep') b[m.t + (us > 0 ? 10 : -10)] = -us * P;
    if (m.fl === 'k') { b[m.t + 1] = b[m.t - 1]; b[m.t - 1] = 0; }
    if (m.fl === 'q') { b[m.t - 2] = b[m.t + 1]; b[m.t + 1] = 0; }
    this.castle = h.castle; this.ep = h.ep; this.half = h.half; this.key = h.key; this.kings = h.kings; if (us < 0) this.full--;
  };
  Pos.prototype.legal = function () { const out = []; for (const m of this.gen()) if (this.make(m)) { this.unmake(); out.push(m); } return out; };
  Pos.prototype.repeated = function () { let n = 0; for (let i = this.keys.length - 2; i >= Math.max(0, this.keys.length - this.half - 1); i -= 2) if (this.keys[i] === this.key[0]) n++; return n; };
  Pos.prototype.status = function () { // 'mate' | 'stalemate' | 'draw50' | 'rep' | 'material' | null
    const l = this.legal();
    if (!l.length) return this.inCheck() ? 'mate' : 'stalemate';
    if (this.half >= 100) return 'draw50';
    if (this.repeated() >= 2) return 'rep';
    const pcs = []; for (let s = 21; s < 99; s++) { const p = this.b[s]; if (p && p !== OFF && Math.abs(p) !== K) pcs.push(Math.abs(p)); }
    if (!pcs.length || (pcs.length === 1 && (pcs[0] === N || pcs[0] === B))) return 'material';
    return null;
  };
  Pos.prototype.san = function (m) {
    const legal = this.legal(), a = Math.abs(m.p);
    let s;
    if (m.fl === 'k') s = 'O-O'; else if (m.fl === 'q') s = 'O-O-O';
    else {
      const pc = ' NBRQK'[a - 1] === ' ' ? '' : 'NBRQK'[a - 2] || '';
      let dis = '';
      if (a !== P) { const others = legal.filter(o => o.t === m.t && o.p === m.p && o.f !== m.f); if (others.length) dis = others.some(o => fileOf(o.f) === fileOf(m.f)) ? (others.some(o => rankOf(o.f) === rankOf(m.f)) ? name(m.f) : name(m.f)[1]) : name(m.f)[0]; }
      s = (a === P ? (m.c || m.fl === 'ep' ? name(m.f)[0] : '') : pc + dis) + (m.c || m.fl === 'ep' ? 'x' : '') + name(m.t) + (m.pr ? '=' + 'NBRQ'[Math.abs(m.pr) - 2] : '');
    }
    if (this.make(m)) { const st = this.inCheck() ? (this.legal().length ? '+' : '#') : ''; this.unmake(); s += st; }
    return s;
  };
  Pos.prototype.fen = function () {
    let out = '';
    for (let r = 7; r >= 0; r--) { let e = 0; for (let f = 0; f < 8; f++) { const p = this.b[sq(f, r)]; if (!p) { e++; continue; } if (e) { out += e; e = 0; } const c = 'pnbrqk'[Math.abs(p) - 1]; out += p > 0 ? c.toUpperCase() : c; } if (e) out += e; if (r) out += '/'; }
    const c = (this.castle & 1 ? 'K' : '') + (this.castle & 2 ? 'Q' : '') + (this.castle & 4 ? 'k' : '') + (this.castle & 8 ? 'q' : '') || '-';
    return `${out} ${this.side > 0 ? 'w' : 'b'} ${c} ${this.ep ? name(this.ep) : '-'} ${this.half} ${this.full}`;
  };

  // ── Hodnocení ──
  function evaluate(pos) {
    let mg = 0, eg = 0, phase = 0;
    const b = pos.b;
    for (let s = 21; s < 99; s++) {
      const p = b[s]; if (!p || p === OFF) continue;
      const a = Math.abs(p), w = p > 0, sign = w ? 1 : -1, i = pstIdx(s, w);
      mg += sign * (VAL[a] + (a === K ? PST[K][i] : PST[a][i]));
      eg += sign * (VAL[a] + (a === K ? PST.KE[i] : PST[a][i]));
      if (a === N || a === B) phase += 1; if (a === R) phase += 2; if (a === Q) phase += 4;
    }
    const ph = Math.min(24, phase);
    const score = (mg * ph + eg * (24 - ph)) / 24;
    return Math.round(score) * pos.side;
  }

  // ── Hledání ──
  const MATE = 30000;
  function search(pos, opt = {}) {
    const deadline = performance.now() + (opt.time || 800), maxDepth = opt.depth || 64;
    const TT = new Map(), killers = [];
    let nodes = 0, stop = false, best = null;
    const order = (ms, ttm, ply) => {
      for (const m of ms) {
        m.s = 0;
        if (ttm && m.f === ttm.f && m.t === ttm.t && m.pr === ttm.pr) m.s = 1e6;
        else if (m.c) m.s = 1e5 + VAL[Math.abs(m.c)] * 10 - VAL[Math.abs(m.p)];
        else if (m.pr) m.s = 9e4;
        else if (killers[ply] && killers[ply].some(k => k.f === m.f && k.t === m.t)) m.s = 8e4;
      }
      return ms.sort((a, b) => b.s - a.s);
    };
    function qs(alpha, beta, ply) {
      if ((++nodes & 2047) === 0 && performance.now() > deadline) stop = true;
      const stand = evaluate(pos);
      if (stand >= beta) return beta; if (stand > alpha) alpha = stand;
      for (const m of order(pos.gen(true), null, ply)) {
        if (!pos.make(m)) continue;
        const sc = -qs(-beta, -alpha, ply + 1); pos.unmake();
        if (stop) return 0;
        if (sc >= beta) return beta; if (sc > alpha) alpha = sc;
      }
      return alpha;
    }
    function ab(depth, alpha, beta, ply) {
      if ((++nodes & 2047) === 0 && performance.now() > deadline) stop = true;
      if (stop) return 0;
      if (ply && (pos.half >= 100 || pos.repeated() >= 1)) return 0;
      const check = pos.inCheck(); if (check) depth++;
      if (depth <= 0) return qs(alpha, beta, ply);
      const k = pos.key[0] + ':' + pos.key[1], te = TT.get(k);
      if (te && te.d >= depth && ply) { if (te.f === 0) return te.v; if (te.f === 1 && te.v >= beta) return te.v; if (te.f === -1 && te.v <= alpha) return te.v; }
      let bestM = null, legal = 0, a0 = alpha;
      for (const m of order(pos.gen(), te && te.m, ply)) {
        if (!pos.make(m)) continue; legal++;
        const sc = -ab(depth - 1, -beta, -alpha, ply + 1); pos.unmake();
        if (stop) return 0;
        if (sc > alpha) { alpha = sc; bestM = m; if (!ply) best = { m, sc }; }
        if (alpha >= beta) { if (!m.c) { killers[ply] = [m, ...(killers[ply] || [])].slice(0, 2); } break; }
      }
      if (!legal) return check ? -MATE + ply : 0;
      if (TT.size > 300000) TT.clear();
      TT.set(k, { d: depth, v: alpha, f: alpha <= a0 ? -1 : alpha >= beta ? 1 : 0, m: bestM });
      return alpha;
    }
    let result = null;
    for (let d = 1; d <= maxDepth; d++) {
      best = null; const v = ab(d, -MATE - 1, MATE + 1, 0);
      if (stop) break;
      if (best) result = { move: best.m, score: v, depth: d };
      if (Math.abs(v) > MATE - 100) break;
      if (performance.now() > deadline - (opt.time || 800) * 0.4 && d >= (opt.minDepth || 1)) break;
    }
    return result || (() => { const l = pos.legal(); return l.length ? { move: l[0], score: 0, depth: 0 } : null; })();
  }
  // Mat v N (pro úlohy): vrátí první matující tah nebo null
  // checksOnly: útočník zkouší jen šachy (rychlé hledání vynucených matů pro úlohy)
  function mateIn(pos, n, checksOnly) {
    const rec = (k, ply) => {
      const ms = pos.legal();
      if (ply % 2 === 0) { // útočník
        for (const m of ms) {
          pos.make(m);
          if (!pos.inCheck()) { if (checksOnly || k === 1) { pos.unmake(); continue; } }
          const st = pos.inCheck() && pos.legal().length === 0; let ok = st; if (!ok && k > 1) ok = rec(k, ply + 1);
          pos.unmake(); if (ok) return ply === 0 ? m : true;
        }
        return ply === 0 ? null : false;
      }
      if (!ms.length) return false;
      for (const m of ms) { pos.make(m); const ok = rec(k - 1, ply + 1); pos.unmake(); if (!ok) return false; }
      return true;
    };
    return rec(n, 0);
  }
  return { Pos, search, evaluate, mateIn, sq, fileOf, rankOf, name, P, N, B, R, Q, K, OFF, VAL, MATE };
})();
