'use strict';
// ── Ukládání ────────────────────────────────────────────────────────────────
const SAVE_KEY = 'starspire.save.v1';
const HUB_KEY = 'gamecenter.stats.starspire';
function defaultSave() {
  return {
    v: 1, achievements: {}, seen: {}, heroWins: {}, eclipse: { knight: 0, mage: 0, rogue: 0 }, run: null,
    // hvězdný prach a koupená vylepšení Hvězdného atlasu ({ id: úroveň })
    dust: 0, atlas: {},
    stats: { runs: 0, wins: 0, kills: 0, elites: 0, act1: 0, act2: 0, act3: 0, victories: 0, bestLoop: 0, dustTotal: 0, maxEclipseWin: 0, maxHit: 0, maxCardsTurn: 0, maxPoison: 0,
      maxBurn: 0, maxBlock: 0, maxStr: 0, maxGold: 0, maxRelics: 0, thinBoss: 0, maxDeck: 0, flawlessBoss: 0, time: 0, bestFloor: 0 },
    settings: { sfx: 0.7, music: 0.45, fast: false },
    lastHero: 'knight',
  };
}
function loadSave() {
  const d = defaultSave();
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s) for (const k of Object.keys(s)) d[k] = d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && s[k] ? Object.assign(d[k], s[k]) : s[k];
  } catch (e) { /* poškozený save */ }
  // Dřív byl Král souhvězdí posledním bossem: kdo vyhrál, ten ho porazil.
  if (d.stats.victories && !d.stats.act3) d.stats.act3 = 1;
  return d;
}
let SAVE = loadSave();
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE));
    localStorage.setItem(HUB_KEY, JSON.stringify({
      playTime: SAVE.stats.time, lastPlayed: Date.now(),
      progress: Object.keys(SAVE.achievements).length / ACHIEVEMENTS.length,
      stats: { victories: SAVE.stats.victories, best: SAVE.stats.bestFloor, eclipse: SAVE.stats.maxEclipseWin, loop: SAVE.stats.bestLoop, atlas: `${atlasCount(SAVE)} / ${ATLAS_MAX}`, achievements: `${Object.keys(SAVE.achievements).length} / ${ACHIEVEMENTS.length}` },
    }));
  } catch (e) { /* bez úložiště */ }
}
const heroUnlocked = id => !HEROES[id].unlock || !!SAVE.achievements[HEROES[id].unlock];
const perk = id => SAVE.atlas[id] || 0;
const omen = id => !!(R && R.omens && R.omens.includes(id));
// patro od začátku výstupu (13 na akt: 12 řad mapy + boss), přes všechny okruhy
const floorOf = r => ((r.loop || 0) * ACTS.length + r.act) * 13 + Math.max(0, Math.min(r.row + 1, 13));
// hvězdný prach za výstup
function dustFor(r, victory) {
  const base = floorOf(r) + r.stats.elites * 4 + r.stats.bosses * 12 + (victory || r.won ? 40 : 0);
  return Math.round(base * (1 + 0.1 * r.eclipse) * (1 + 0.1 * perk('dust')));
}

// ── Události pro UI a čekání ────────────────────────────────────────────────
const Bus = { fns: [], on(f) { this.fns.push(f); }, emit(t, d) { for (const f of this.fns) f(t, d || {}); } };
const TEST = typeof window === 'undefined' || !!window.__TEST;
const wait = ms => (TEST || !ms) ? Promise.resolve() : new Promise(r => setTimeout(r, SAVE.settings.fast ? ms * 0.45 : ms));
let UID = 1;

function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (SAVE.achievements[a.id]) continue;
    const [v, m] = a.prog(SAVE);
    if (v >= m) { SAVE.achievements[a.id] = Date.now(); Bus.emit('achievement', { a }); }
  }
}
const bump = (k, v) => { if (v > SAVE.stats[k]) SAVE.stats[k] = v; };

// ── Běh (výstup věží) ───────────────────────────────────────────────────────
let R = null;
const Run = {
  has: r => R && R.relics.includes(r),
  start(hero, eclipse) {
    const H = HEROES[hero];
    R = {
      hero, eclipse, maxHp: H.hp, hp: H.hp, gold: H.gold, deck: [], relics: [], counters: {}, potions: [null, null, null],
      act: 0, row: -1, col: -1, map: null, removeCost: 75, rarityOffset: -5, potionChance: 40, time: 0,
      stats: { kills: 0, floors: 0, dmg: 0, elites: 0, bosses: 0 }, node: null, over: false, loop: 0, won: false, omens: [],
    };
    // Hvězdný atlas
    R.maxHp += perk('vit') * 5; R.hp = R.maxHp;
    R.gold += perk('gold') * 20;
    R.removeCost -= perk('purge') * 25;
    if (perk('belt')) R.potions.push(null);
    if (eclipse >= 6) R.hp = Math.round(R.hp * 0.9);
    for (const id of H.deck) Run.addCard(id, false, true);
    if (eclipse >= 10) Run.addCard('wound', false, true);
    Run.addRelic(H.relic, true);
    for (let i = 0; i < perk('potion'); i++) Run.addPotion(pick(Object.keys(POTIONS)));
    Run.upgradeRandom(perk('forge'));
    if (perk('relic')) { const id = Run.rollRelic('common'); if (id) Run.addRelic(id, true); }
    R.map = Run.genMap(0);
    SAVE.lastHero = hero;
    Run.save();
  },
  save() { SAVE.run = R; persist(); },
  resume() { R = SAVE.run; if (R) { R.loop = R.loop || 0; R.omens = R.omens || []; } return R; },
  clear() { SAVE.run = null; R = null; persist(); },

  addCard(id, up = false, silent = false) {
    R.deck.push({ id, up: !!up, uid: UID++ });
    SAVE.seen[id] = true;
    bump('maxDeck', R.deck.length);
    if (!silent) Bus.emit('cardAdded', { id });
  },
  removeCard(i) { R.deck.splice(i, 1); },
  upgradeCard(c) { if (c && !c.up && CARDS[c.id].up) c.up = true; },
  upgradeRandom(n) {
    const list = shuffle(R.deck.filter(c => !c.up && CARDS[c.id].up));
    list.slice(0, n).forEach(c => { c.up = true; });
    return Math.min(n, list.length);
  },
  addRelic(id, silent) {
    if (R.relics.includes(id)) return;
    R.relics.push(id);
    const r = RELICS[id];
    if (r.onPickup === 'maxHp7') { R.maxHp += 7; R.hp += 7; }
    if (r.onPickup === 'maxHp14') { R.maxHp += 14; R.hp += 14; }
    if (r.counter) R.counters[id] = 0;
    bump('maxRelics', R.relics.length);
    if (!silent) Bus.emit('relic', { id });
  },
  relicPool(rarity) {
    return RELIC_LIST.filter(r => r.rarity !== 'starter' && r.rarity !== 'boss' && !R.relics.includes(r.id) && (!rarity || r.rarity === rarity)).map(r => r.id);
  },
  rollRelic(rarity) {
    let pool = Run.relicPool(rarity);
    if (!pool.length) pool = Run.relicPool();
    if (!pool.length) return null;
    const roll = Math.random();
    const want = rarity || (roll < 0.5 ? 'common' : roll < 0.83 ? 'uncommon' : 'rare');
    const p2 = pool.filter(id => RELICS[id].rarity === want);
    return pick(p2.length ? p2 : pool);
  },
  giveRandomRelic(rarity) {
    const id = Run.rollRelic(rarity);
    if (!id) { Run.gainGold(50); return 'lionheart'; }
    Run.addRelic(id);
    return id;
  },
  gainGold(n) {
    if (Run.has('ecto')) return;
    let g = n;
    if (Run.has('goldenIdol')) g = Math.round(g * 1.25);
    if (R.eclipse >= 9) g = Math.round(g * 0.8);
    if (omen('gold')) g = Math.round(g * 1.5);
    R.gold += g;
    bump('maxGold', R.gold);
  },
  heal(n) { R.hp = Math.min(R.maxHp, R.hp + n); Bus.emit('heal', { n }); },
  addPotion(id) {
    if (Run.has('sozu')) return false;
    const i = R.potions.indexOf(null);
    if (i < 0) return false;
    R.potions[i] = id;
    return true;
  },
  classPool(rarity) {
    return CARD_LIST.filter(c => c.cls === R.hero && c.rarity === rarity).map(c => c.id);
  },
  randomCard(rarity) { return pick(Run.classPool(rarity)); },
  rollRarity(kind) {
    if (kind === 'boss') return 'rare';
    const r = Math.random() * 100 + R.rarityOffset;
    const rare = (kind === 'elite' ? 10 : 3) + perk('rare') * 2;
    if (r > 100 - rare) { R.rarityOffset = -5; return 'rare'; }
    R.rarityOffset = Math.min(40, R.rarityOffset + 1);
    return r > 63 ? 'uncommon' : 'common';
  },
  rollCards(n, kind) {
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < 50) {
      const id = Run.randomCard(Run.rollRarity(kind));
      if (!out.includes(id)) out.push(id);
    }
    const depth = R.act + (R.loop || 0) * ACTS.length;
    return out.map(id => ({ id, up: omen('bounty') || (depth >= 1 && Math.random() < Math.min(0.6, 0.08 * depth)) }));
  },

  // ── Mapa ──
  genMap(act) {
    const ROWS = 12, rows = [];
    for (let r = 0; r < ROWS; r++) {
      const w = r === 0 ? randi(3, 4) : r === ROWS - 1 ? randi(2, 3) : randi(2, 4);
      const row = [];
      for (let c = 0; c < w; c++) row.push({ r, c, x: (c + 0.5) / w + rand(-0.06, 0.06), type: 'battle', next: [], prev: [] });
      rows.push(row);
    }
    for (let r = 0; r < ROWS - 1; r++) {
      const A = rows[r], B = rows[r + 1];
      const link = (a, b) => { if (!A[a].next.includes(b)) { A[a].next.push(b); B[b].prev.push(a); } };
      A.forEach((n, i) => link(i, A.length === 1 ? 0 : Math.round(i * (B.length - 1) / (A.length - 1))));
      B.forEach((n, j) => link(B.length === 1 ? 0 : Math.round(j * (A.length - 1) / (B.length - 1)), j));
      A.forEach((n, i) => { const j = n.next[0]; if (j + 1 < B.length && Math.random() < 0.3) { const ok = A.every((m, k) => k <= i || m.next.every(t => t >= j + 1)); if (ok) link(i, j + 1); } });
    }
    const eliteW = (R.eclipse >= 1 ? 16 : 11) + (omen('comet') ? 6 : 0);
    let battles = 0;
    for (const row of rows) for (const n of row) {
      const r = n.r;
      if (r === 0) n.type = 'battle';
      else if (r === 6) n.type = 'treasure';
      else if (r === ROWS - 1) n.type = 'rest';
      else {
        const w = { battle: 45, event: 22, elite: r >= 4 ? eliteW : 0, rest: r >= 4 && r !== ROWS - 2 ? 12 : 0, shop: r >= 2 ? 9 : 0 };
        n.type = weightedKey(w);
        if (n.type !== 'battle' && n.type !== 'event' && n.prev.some(p => rows[r - 1][p].type === n.type)) n.type = 'battle';
      }
      if (n.type === 'battle') n.enc = battles++ < 3 && r < 4 ? pick(ACTS[act].easy) : pick(ACTS[act].hard);
      if (n.type === 'elite') n.enc = pick(ACTS[act].elites);
    }
    return { rows, boss: { type: 'boss', enc: ACTS[act].boss } };
  },
  available() {
    if (R.row < 0) return R.map.rows[0].map(n => n);
    if (R.row >= R.map.rows.length - 1) return [R.map.boss];
    const cur = R.map.rows[R.row][R.col];
    return cur.next.map(j => R.map.rows[R.row + 1][j]);
  },
  enter(node) {
    if (node.type === 'boss') { R.row = R.map.rows.length; R.col = 0; }
    else { R.row = node.r; R.col = node.c; }
    node.visited = true;
    R.node = node.type;
    R.stats.floors++;
    bump('bestFloor', floorOf(R));
    Run.save();
  },
  nextAct() {
    R.act++;
    R.row = -1; R.col = -1;
    R.map = Run.genMap(R.act);
    R.hp = Math.min(R.maxHp, R.hp + Math.round((R.maxHp - R.hp) * (R.eclipse >= 5 ? 0.5 : 0.75)));
    R.node = null;
    Run.save();
  },
  isLastAct: () => R.act === ACTS.length - 1,
  // Vrchol dobyt (poprvé v tomto výstupu): vítězství se započítá hned, výstup může pokračovat.
  recordVictory() {
    if (R.won) return;
    R.won = true;
    SAVE.stats.victories++;
    SAVE.heroWins[R.hero] = (SAVE.heroWins[R.hero] || 0) + 1;
    bump('maxEclipseWin', R.eclipse);
    SAVE.eclipse[R.hero] = Math.max(SAVE.eclipse[R.hero] || 0, Math.min(MAX_ECLIPSE, R.eclipse + 1));
    checkAchievements();
    Run.save();
  },
  // Nekonečná věž: další okruh všech aktů se zvoleným znamením
  omenChoices() { return sample(OMENS.filter(o => !R.omens.includes(o.id)), 3).map(o => o.id); },
  nextLoop(omenId) {
    R.loop = (R.loop || 0) + 1;
    R.act = -1;
    if (omenId) {
      R.omens.push(omenId);
      if (omenId === 'bounty') { R.maxHp = Math.max(1, R.maxHp - 8); R.hp = Math.min(R.hp, R.maxHp); }
      if (omenId === 'phoenix') R.hp = R.maxHp;
      if (omenId === 'hoard') { R.gold = 0; Run.giveRandomRelic(); }
    }
    Run.nextAct();
  },
  // násobitele síly nepřátel v Nekonečné věži
  loopScale() {
    const l = R.loop || 0;
    if (!l) return { hp: 1, dmg: 1 };
    return { hp: LOOP_TIER.hp[R.act] * (1 + 0.4 * (l - 1)), dmg: LOOP_TIER.dmg[R.act] * (1 + 0.15 * (l - 1)) };
  },
  restAmount() {
    const pct = (R.eclipse >= 5 ? 0.25 : 0.3) + perk('rest') * 0.05 - (omen('aegis') ? 0.1 : 0);
    return Math.round(R.maxHp * pct);
  },
  endRun(victory) {
    SAVE.stats.runs++;
    SAVE.stats.time += R.time;
    if (victory) Run.recordVictory();
    R.over = true;
    const r = R;
    r.dust = dustFor(r, victory);
    SAVE.dust = (SAVE.dust || 0) + r.dust;
    SAVE.stats.dustTotal += r.dust;
    SAVE.run = null;
    checkAchievements();
    persist();
    return r;
  },
  // Hvězdný atlas: koupě další úrovně vylepšení
  buyPerk(id) {
    const p = ATLAS.find(x => x.id === id), lv = perk(id);
    if (!p || lv >= p.cost.length || SAVE.dust < p.cost[lv]) return false;
    SAVE.dust -= p.cost[lv];
    SAVE.atlas[id] = lv + 1;
    checkAchievements();
    persist();
    return true;
  },
};
function weightedKey(w) {
  let t = 0; for (const k in w) t += w[k];
  let x = Math.random() * t;
  for (const k in w) { x -= w[k]; if (x <= 0) return k; }
  return Object.keys(w)[0];
}

// ── Karty: pomocné ──────────────────────────────────────────────────────────
const cardDef = c => CARDS[c.id];
const cardFx = c => (c.up && cardDef(c).up && cardDef(c).up.fx) || cardDef(c).fx;
const cardCost = c => (c.costOverride !== undefined ? c.costOverride : (c.up && cardDef(c).up && cardDef(c).up.cost !== undefined ? cardDef(c).up.cost : cardDef(c).cost));
const cardName = c => cardDef(c).name + (c.up ? '+' : '');

// Popis karty, volitelně s živými hodnotami v boji
function cardText(c, B, target) {
  const d = cardDef(c);
  if (d.text) return d.text();
  const parts = [];
  const all = d.target === 'all', rnd = d.target === 'random';
  for (const f of cardFx(c)) {
    if (f.dmg !== undefined) {
      let v = f.dmg, base = f.dmg;
      if (B) { v = Battle.calcDmg(f, B.p, target, true); base = f.dmg; }
      const shown = v === base ? `<b>${v}</b>` : `<b class="${v > base ? 'buffed' : 'nerfed'}">${v}</b>`;
      const times = f.n > 1 ? L(` ${f.n}×`, ` ${f.n} times`) : '';
      parts.push(L(`Způsob ${shown} poškození${times}${all ? ' všem nepřátelům' : rnd ? ' náhodným nepřátelům' : ''}.`, `Deal ${shown} damage${times}${all ? ' to ALL enemies' : rnd ? ' to random enemies' : ''}.`));
      if (f.strMult) parts.push(L(`Síla působí ${f.strMult}×.`, `Strength affects this ${f.strMult} times.`));
    } else if (f.block !== undefined) {
      const v = B ? Battle.calcBlock(f.block, B.p) : f.block;
      parts.push(L(`Získej <b class="${v > f.block ? 'buffed' : v < f.block ? 'nerfed' : ''}">${v}</b> bloku.`, `Gain <b class="${v > f.block ? 'buffed' : v < f.block ? 'nerfed' : ''}">${v}</b> Block.`));
    } else if (f.draw) parts.push(L(`Lízni <b>${f.draw}</b> ${plural(f.draw, 'kartu', 'karty', 'karet')}.`, `Draw <b>${f.draw}</b> card${f.draw > 1 ? 's' : ''}.`));
    else if (f.energy) parts.push(L(`Získej <b>${f.energy}</b> energie.`, `Gain <b>${f.energy}</b> Energy.`));
    else if (f.heal) parts.push(L(`Vyléč <b>${f.heal}</b> životů.`, `Heal <b>${f.heal}</b> HP.`));
    else if (f.loseHp) parts.push(L(`Ztrať <b>${f.loseHp}</b> životů.`, `Lose <b>${f.loseHp}</b> HP.`));
    else if (f.add) parts.push(L(`Přidej do ruky <b>${f.v}</b> ${plural(f.v, 'Dýku', 'Dýky', 'Dýk')}.`, `Add <b>${f.v}</b> Shiv${f.v > 1 ? 's' : ''} to your hand.`));
    else if (f.apply) {
      const S = STATUS[f.apply], kw = `<span class="kw" data-st="${f.apply}">${S.name}</span>`;
      let v = f.v;
      if (B && f.apply === 'burn') v += B.p.s.focus || 0;
      if (B && f.apply === 'poison' && Run.has('snakeSkull')) v += 1;
      const n = f.n > 1 ? L(` ${f.n}× náhodně`, ` to random enemies ${f.n} times`) : '';
      if (f.to === 'self') {
        if (['metal', 'inferno', 'fumes', 'blades', 'accuracy', 'envenom', 'demon', 'astral', 'barricade', 'focus'].includes(f.apply)) parts.push(`${kw}: ${S.desc(v)}`);
        else if (f.apply === 'flex') parts.push(L(`Na konci kola ztrať <b>${v}</b> síly.`, `At the end of your turn, lose <b>${v}</b> Strength.`));
        else if (f.apply === 'nextEnergy') parts.push(L(`Příští kolo získej <b>${v}</b> energie.`, `Next turn, gain <b>${v}</b> Energy.`));
        else if (f.apply === 'echo') parts.push(STATUS.echo.desc(v));
        else if (f.apply === 'fthorns') parts.push(L(`Do příštího kola útočníci utrží <b>${v}</b> poškození.`, `Until your next turn, attackers take <b>${v}</b> damage.`));
        else parts.push(L(`Získej <b>${v}</b> ${kw}.`, `Gain <b>${v}</b> ${kw}.`));
      } else parts.push(L(`Uval <b>${v}</b> ${kw}${f.to === 'all' ? ' na všechny nepřátele' : ''}${n}.`, `Apply <b>${v}</b> ${kw}${f.to === 'all' ? ' to ALL enemies' : ''}${n}.`));
    } else if (f.sp) parts.push(SP_TEXT[f.sp](f.v));
  }
  if (d.ethereal) parts.push(L('Pomíjivá.', 'Ethereal.'));
  if (isExhaust(c)) parts.push(L('Spálí se.', 'Exhaust.'));
  return parts.join(' ');
}
const isExhaust = c => { const d = cardDef(c); return c.up && d.up && d.up.exhaust !== undefined ? d.up.exhaust : !!d.exhaust; };

// ── Souboj ──────────────────────────────────────────────────────────────────
let B = null;
const Battle = {
  start(enc, kind) {
    B = { kind, enemies: [], hand: [], draw: [], discard: [], exhaust: [], energy: 0, maxEnergy: 3, turn: 0, busy: true, over: false,
      p: { block: 0, s: {} }, played: { attack: 0, skill: 0, total: 0 }, hpStart: R.hp, lostHp: 0, cardsPlayed: 0 };
    for (const r of R.relics) if (RELICS[r].energy) B.maxEnergy += RELICS[r].energy;
    enc.forEach((id, i) => Battle.spawn(id, i));
    B.draw = shuffle(R.deck.map(c => ({ id: c.id, up: c.up, uid: UID++ })));
    // relikvie na začátku boje
    const p = B.p;
    if (Run.has('anchor')) p.block += 10;
    if (Run.has('vajra')) Battle.addStatus(p, 'str', 1);
    if (Run.has('smoothStone')) Battle.addStatus(p, 'dex', 1);
    if (Run.has('bloodVial')) Run.heal(2);
    if (omen('might')) Battle.addStatus(p, 'str', 2);
    if (omen('aegis')) p.block += 12;
    if (omen('thorns')) Battle.addStatus(p, 'thorns', 3);
    if (omen('thorns')) B.draw.splice((Math.random() * (B.draw.length + 1)) | 0, 0, { id: 'dazed', up: false, uid: UID++ });
    for (const e of B.enemies) {
      if (omen('fire')) Battle.addStatus(e, 'burn', 5);
      if (omen('might')) Battle.addStatus(e, 'str', 2);
      if (Run.has('marbles')) Battle.addStatus(e, 'vuln', 1);
      if (Run.has('emberCore')) Battle.addStatus(e, 'burn', 3);
      if (Run.has('philStone')) Battle.addStatus(e, 'str', 1);
    }
    for (const e of B.enemies) Battle.planMove(e);
    Bus.emit('battleStart', { kind });
    return Battle.startTurn();
  },
  spawn(id, idx) {
    const d = ENEMIES[id];
    let hp = randi(d.hp[0], d.hp[1]);
    const ecl = R.eclipse;
    if (ecl >= 7) hp = Math.round(hp * 1.08);
    if (d.elite && ecl >= 3) hp = Math.round(hp * 1.1);
    if (d.boss && ecl >= 8) hp = Math.round(hp * 1.1);
    if (omen('fire')) hp = Math.round(hp * 1.1);
    if (d.boss && omen('phoenix')) hp = Math.round(hp * 1.15);
    hp = Math.round(hp * Run.loopScale().hp);
    const e = { id, d, uid: UID++, idx, name: d.name, hp, maxHp: hp, block: 0, s: {}, turn: 0, last: null, move: null, dead: false, phase: 1 };
    if (d.init) d.init(e);
    B.enemies.push(e);
    return e;
  },
  planMove(e) {
    if (e.dead) return;
    const m = Object.assign({}, e.d.ai(e, B));
    let mult = 1;
    if (!e.d.elite && !e.d.boss && R.eclipse >= 2) mult = 1.1;
    if (e.d.boss && R.eclipse >= 4) mult = 1.12;
    mult *= Run.loopScale().dmg * (omen('tide') ? 1.1 : 1);
    if (m.dmg) m.dmg = Math.round(m.dmg * mult);
    e.move = m;
  },
  alive: () => B.enemies.filter(e => !e.dead),

  addStatus(t, s, v) {
    if (!v) return;
    const isEnemy = t !== B.p;
    if (isEnemy && STATUS[s] && STATUS[s].debuff && t.s.artifact > 0 && v > 0) { t.s.artifact--; if (!t.s.artifact) delete t.s.artifact; Bus.emit('blocked', { t }); return; }
    if (s === 'str' && v < 0 && isEnemy && t.s.artifact > 0) { t.s.artifact--; return; }
    t.s[s] = (t.s[s] || 0) + v;
    if (t.s[s] === 0 && s !== 'str' && s !== 'dex') delete t.s[s];
    if (isEnemy) { if (s === 'poison') bump('maxPoison', t.s.poison); if (s === 'burn') bump('maxBurn', t.s.burn); }
    else if (s === 'str') bump('maxStr', t.s.str);
    Bus.emit('status', { t, s, v });
  },

  calcDmg(f, src, target, preview) {
    const s = src.s;
    let base = f.dmg + (f.shiv ? (s.accuracy || 0) : 0);
    base += (s.str || 0) * (f.strMult || 1);
    let d = base;
    if (s.weak) d *= 0.75;
    if (target && target.s.vuln) d *= 1.5;
    if (src === B.p && Run.has('penNib') && R.counters.penNib === 9 && !preview) d *= 2;
    return Math.max(0, Math.floor(d));
  },
  calcBlock(v, p) { return Math.max(0, v + (p.s.dex || 0)); },

  // poškození nepřítele
  hitEnemy(e, amount, attack = true) {
    if (e.dead) return 0;
    let a = amount;
    if (e.s.curl && attack && a > 0) { e.block += e.s.curl; delete e.s.curl; Bus.emit('blockGain', { t: e }); }
    const absorbed = Math.min(e.block, a);
    e.block -= absorbed; a -= absorbed;
    e.hp -= a;
    R.stats.dmg += a;
    bump('maxHit', amount);
    if (e.s.sleep && a > 0) Battle.wake(e);
    Bus.emit('hit', { t: e, amount: a, blocked: absorbed });
    if (attack && a > 0 && B.p.s.envenom) Battle.addStatus(e, 'poison', B.p.s.envenom);
    if (attack && e.s.thorns) Battle.hurtPlayer(e.s.thorns, false, e);
    if (e.d.phase2 && e.phase === 1 && e.hp < e.maxHp / 2 && e.hp > 0) {
      e.phase = 2; e.turn = 0; e.d.phase2(e);
      Bus.emit('phase', { t: e });
      Battle.planMove(e);
    }
    if (e.hp <= 0) Battle.kill(e);
    return a;
  },
  wake(e) { delete e.s.sleep; delete e.s.metal; e.turn = 0; Battle.planMove(e); Bus.emit('wake', { t: e }); },
  kill(e) {
    e.hp = 0; e.dead = true;
    R.stats.kills++; SAVE.stats.kills++;
    Bus.emit('death', { t: e });
    if (Run.has('deadStar') && !Battle.won()) { B.energy++; Battle.drawCards(1); }
  },
  won: () => B.enemies.every(e => e.dead),

  hurtPlayer(amount, attack, src) {
    let a = amount;
    const p = B.p;
    const absorbed = Math.min(p.block, a);
    p.block -= absorbed; a -= absorbed;
    if (attack && a > 1 && a <= 5 && Run.has('torii')) a = 1;
    if (a > 0 && Run.has('tungsten')) a -= 1;
    R.hp -= a;
    if (a > 0) B.lostHp += a;
    Bus.emit('playerHit', { amount: a, blocked: absorbed });
    if (attack && src && !src.dead) {
      const th = (p.s.thorns || 0) + (p.s.fthorns || 0);
      if (th) Battle.hitEnemy(src, th, false);
    }
    if (R.hp <= 0) { R.hp = 0; B.over = true; }
  },
  gainBlock(p, v) { p.block += v; bump('maxBlock', p.block); Bus.emit('blockGain', { t: p }); },

  drawCards(n) {
    for (let i = 0; i < n; i++) {
      if (B.hand.length >= 10) break;
      if (!B.draw.length) {
        if (!B.discard.length) break;
        B.draw = shuffle(B.discard); B.discard = [];
        Bus.emit('reshuffle');
      }
      B.hand.push(B.draw.pop());
    }
    Bus.emit('hand');
  },
  addToHand(id, up, n) {
    for (let i = 0; i < n; i++) {
      const c = { id, up, uid: UID++ };
      if (B.hand.length < 10) B.hand.push(c); else B.discard.push(c);
    }
    Bus.emit('hand');
  },

  startTurn() {
    if (B.over) return;
    B.turn++;
    const p = B.p;
    if (!p.s.barricade && !(B.turn === 1)) p.block = 0;
    if (p.s.fthorns) delete p.s.fthorns;
    B.played = { attack: 0, skill: 0, total: 0 };
    let e = B.maxEnergy + (p.s.nextEnergy || 0);
    delete p.s.nextEnergy;
    if (Run.has('iceCream') && B.turn > 1) e += B.energy;
    if (B.turn === 1 && Run.has('lantern')) e += 1;
    if (B.turn === 1 && omen('comet')) e += 1;
    if (Run.has('happyFlower')) { R.counters.happyFlower = (R.counters.happyFlower || 0) + 1; if (R.counters.happyFlower % 3 === 0) e += 1; }
    if (p.s.astral) e += p.s.astral;
    B.energy = e;
    // jed na hráči
    if (p.s.poison) { const v = p.s.poison; Battle.hurtPlayer(v, false); Battle.addStatus(p, 'poison', -1); if (B.over) return Battle.finish(); }
    if (p.s.demon) Battle.addStatus(p, 'str', p.s.demon);
    if (p.s.fumes) for (const en of Battle.alive()) Battle.addStatus(en, 'poison', p.s.fumes);
    if (Run.has('hourglass')) for (const en of Battle.alive()) Battle.hitEnemy(en, 3, false);
    if (B.turn === 2 && Run.has('hornCleat')) Battle.gainBlock(p, 14);
    let n = 5 + (p.s.astral || 0);
    if (B.turn === 1 && Run.has('serpentRing')) n += 2;
    if (B.turn === 1 && Run.has('snakeSkull')) n += 1;
    if (Run.has('starChart')) n += 1;
    if (omen('tide')) n += 1;
    Battle.drawCards(n);
    if (p.s.blades) Battle.addToHand('shiv', false, p.s.blades);
    B.busy = false;
    Bus.emit('turn', { turn: B.turn });
    if (Battle.won()) return Battle.finish();
  },

  canPlay(c) {
    const cost = cardCost(c);
    return !B.busy && !B.over && cost >= 0 && cost <= B.energy;
  },
  play(handIdx, target) {
    const c = B.hand[handIdx];
    if (!c || !Battle.canPlay(c)) return false;
    const d = cardDef(c);
    if (d.target === 'enemy' && (!target || target.dead)) return false;
    B.energy -= cardCost(c);
    B.hand.splice(handIdx, 1);
    const p = B.p;
    let times = 1;
    if (p.s.echo && d.type !== 'status') { times = 2; Battle.addStatus(p, 'echo', -1); }
    Bus.emit('play', { c, target });
    for (let t = 0; t < times; t++) Battle.resolve(c, target);
    // počítadla a relikvie
    B.played.total++; B.cardsPlayed++;
    bump('maxCardsTurn', B.played.total);
    if (d.type === 'attack') {
      B.played.attack++;
      if (Run.has('penNib')) R.counters.penNib = ((R.counters.penNib || 0) + 1) % 10;
      if (B.played.attack % 3 === 0) {
        if (Run.has('shuriken')) Battle.addStatus(p, 'str', 1);
        if (Run.has('kunai')) Battle.addStatus(p, 'dex', 1);
        if (Run.has('fan')) Battle.gainBlock(p, 4);
      }
    }
    if (d.type === 'skill') {
      B.played.skill++;
      for (const e of Battle.alive()) if (e.s.enrage) Battle.addStatus(e, 'str', e.s.enrage);
      if (Run.has('letterOpener') && B.played.skill % 3 === 0) for (const e of Battle.alive()) Battle.hitEnemy(e, 5, false);
    }
    if (d.type === 'power') { if (Run.has('urn')) Run.heal(2); }
    else if (isExhaust(c) || d.type === 'status') { B.exhaust.push(c); Bus.emit('exhaust', { c }); }
    else B.discard.push(c);
    Bus.emit('hand');
    if (Battle.won() || B.over) Battle.finish();
    return true;
  },
  resolve(c, target) {
    const d = cardDef(c), p = B.p;
    const targets = () => d.target === 'all' ? Battle.alive() : d.target === 'random' ? [pick(Battle.alive())] : target && !target.dead ? [target] : [];
    for (const f of cardFx(c)) {
      if (Battle.won()) break;
      if (f.dmg !== undefined) {
        for (let h = 0; h < (f.n || 1); h++) {
          for (const e of targets()) { if (e) Battle.hitEnemy(e, Battle.calcDmg(f, p, e)); }
        }
      } else if (f.block !== undefined) Battle.gainBlock(p, Battle.calcBlock(f.block, p));
      else if (f.draw) Battle.drawCards(f.draw);
      else if (f.energy) B.energy += f.energy;
      else if (f.heal) Run.heal(f.heal);
      else if (f.loseHp) { R.hp = Math.max(1, R.hp - f.loseHp); B.lostHp += f.loseHp; Bus.emit('playerHit', { amount: f.loseHp }); }
      else if (f.add) Battle.addToHand(f.add, c.up, f.v);
      else if (f.apply) {
        let v = f.v;
        if (f.apply === 'burn') v += p.s.focus || 0;
        if (f.apply === 'poison' && Run.has('snakeSkull')) v += 1;
        if (f.to === 'self') Battle.addStatus(p, f.apply, v);
        else if (f.to === 'all') for (const e of Battle.alive()) Battle.addStatus(e, f.apply, v);
        else for (let h = 0; h < (f.n || 1); h++) for (const e of targets()) if (e) Battle.addStatus(e, f.apply, v);
      } else if (f.sp) Battle.special(f, c, target);
    }
  },
  special(f, c, target) {
    const p = B.p;
    switch (f.sp) {
      case 'bodySlam': if (target) Battle.hitEnemy(target, Battle.calcDmg({ dmg: p.block }, p, target)); break;
      case 'entrench': Battle.gainBlock(p, p.block); break;
      case 'feed': if (target && target.dead) { R.maxHp += f.v; R.hp += f.v; Bus.emit('heal', { n: f.v }); } break;
      case 'ignite': if (target && target.s.burn) Battle.addStatus(target, 'burn', target.s.burn); break;
      case 'detonate': if (target && target.s.burn) { const v = target.s.burn * f.v; delete target.s.burn; Battle.hitEnemy(target, v); } break;
      case 'catalyst': if (target && target.s.poison) Battle.addStatus(target, 'poison', target.s.poison * (f.v - 1)); break;
      case 'storm': { const n = B.hand.length; B.discard.push(...B.hand); B.hand = []; Battle.addToHand('shiv', !!f.v, n); break; }
      case 'apotheosis': for (const pile of [B.hand, B.draw, B.discard]) for (const x of pile) if (CARDS[x.id].up) x.up = true; Bus.emit('hand'); break;
      case 'greed': if (target && target.dead) Run.gainGold(f.v); break;
    }
  },

  async endTurn() {
    if (B.busy || B.over) return;
    B.busy = true;
    const p = B.p;
    // konec kola hráče
    for (const c of B.hand) if (c.id === 'scorch') Battle.hurtPlayer(2, false);
    if (p.s.inferno) for (const e of Battle.alive()) Battle.addStatus(e, 'burn', p.s.inferno + (p.s.focus || 0));
    for (const e of Battle.alive()) if (e.s.burn) { const v = e.s.burn; Battle.hitEnemy(e, v, false); if (!e.dead) { e.s.burn = Math.floor(v / 2); if (!e.s.burn) delete e.s.burn; } }
    if (p.s.metal) Battle.gainBlock(p, p.s.metal);
    if (Run.has('orichalcum') && p.block === 0) Battle.gainBlock(p, 6);
    if (p.s.flex) { Battle.addStatus(p, 'str', -p.s.flex); delete p.s.flex; }
    if (p.s.regen) { Run.heal(p.s.regen); Battle.addStatus(p, 'regen', -1); }
    for (const s of ['weak', 'vuln']) if (p.s[s]) Battle.addStatus(p, s, -1);
    const keep = [];
    for (const c of B.hand) { if (cardDef(c).ethereal) B.exhaust.push(c); else B.discard.push(c); }
    B.hand = keep;
    Bus.emit('hand');
    if (Battle.won() || B.over) return Battle.finish();
    await wait(350);
    // kolo nepřátel
    for (const e of B.enemies) {
      if (e.dead) continue;
      e.block = 0;
      if (e.s.poison) { Battle.hitEnemy(e, e.s.poison, false); if (!e.dead) Battle.addStatus(e, 'poison', -1); }
      if (e.dead) { if (Battle.won()) return Battle.finish(); continue; }
      if (e.s.ritual && e.turn > 0) Battle.addStatus(e, 'str', e.s.ritual);
      await Battle.act(e);
      if (B.over) return Battle.finish();
      if (e.s.metal && !e.dead) { e.block += e.s.metal; Bus.emit('blockGain', { t: e }); }
      for (const s of ['weak', 'vuln']) if (e.s[s]) Battle.addStatus(e, s, -1);
      e.turn++;
      await wait(260);
    }
    for (const e of B.enemies) Battle.planMove(e);
    Battle.startTurn();
  },
  async act(e) {
    const m = e.move;
    if (!m) return;
    e.last = m.id || m.k;
    Bus.emit('enemyAct', { t: e, m });
    if (m.k === 'sleep') {
      e.sleepT--;
      if (e.sleepT <= 0) Battle.wake(e);
      return;
    }
    if (m.dmg) {
      for (let i = 0; i < (m.n || 1); i++) {
        const d = Battle.calcDmg({ dmg: m.dmg }, e, B.p);
        Battle.hurtPlayer(d, true, e);
        if (B.over || e.dead) return;
        if (m.n > 1) await wait(120);
      }
    }
    if (m.block) { e.block += m.block; Bus.emit('blockGain', { t: e }); }
    if (m.allBlock) for (const o of Battle.alive()) { o.block += m.allBlock; Bus.emit('blockGain', { t: o }); }
    if (m.self) for (const [s, v] of m.self) Battle.addStatus(e, s, v);
    if (m.allStr) for (const o of Battle.alive()) Battle.addStatus(o, 'str', m.allStr);
    if (m.heal) for (const o of Battle.alive()) { o.hp = Math.min(o.maxHp, o.hp + m.heal); Bus.emit('enemyHeal', { t: o }); }
    if (m.debuff) for (const [s, v] of m.debuff) Battle.addStatus(B.p, s, v);
    if (m.cards) { for (let i = 0; i < m.cards[1]; i++) B.discard.push({ id: m.cards[0], up: false, uid: UID++ }); Bus.emit('statusCards', { id: m.cards[0], n: m.cards[1] }); }
  },

  usePotion(i, target) {
    const id = R.potions[i];
    if (!id || B.busy || B.over) return false;
    const P = POTIONS[id], p = B.p;
    if (P.target === 'enemy' && (!target || target.dead)) return false;
    R.potions[i] = null;
    switch (id) {
      case 'fire': Battle.hitEnemy(target, 20, false); break;
      case 'block': Battle.gainBlock(p, 12); break;
      case 'strength': Battle.addStatus(p, 'str', 2); break;
      case 'dex': Battle.addStatus(p, 'dex', 2); break;
      case 'energy': B.energy += 2; break;
      case 'swift': Battle.drawCards(3); break;
      case 'fear': Battle.addStatus(target, 'vuln', 3); break;
      case 'weak': Battle.addStatus(target, 'weak', 3); break;
      case 'poison': Battle.addStatus(target, 'poison', 7 + (Run.has('snakeSkull') ? 1 : 0)); break;
      case 'heal': Run.heal(Math.round(R.maxHp * 0.2)); break;
    }
    Bus.emit('potion', { id });
    if (Battle.won()) Battle.finish();
    return true;
  },

  finish() {
    if (B.finished) return;
    B.finished = true;
    B.busy = true;
    if (R.hp <= 0) { Bus.emit('defeat'); return; }
    // výhra
    SAVE.stats.wins++;
    if (B.kind === 'elite') { SAVE.stats.elites++; R.stats.elites++; }
    if (B.kind === 'boss') {
      R.stats.bosses++;
      if (R.act === 0) SAVE.stats.act1 = 1;
      if (R.act === 1) SAVE.stats.act2 = 1;
      if (R.act === 2) SAVE.stats.act3 = 1;
      if (Run.isLastAct()) bump('bestLoop', (R.loop || 0) + 1);
      if (R.deck.length <= 10) SAVE.stats.thinBoss = 1;
      if (B.lostHp === 0) SAVE.stats.flawlessBoss = 1;
    }
    if (Run.has('lionheart')) Run.heal(6);
    checkAchievements();
    Bus.emit('victory', { kind: B.kind });
  },
};

// ── Odměny ──────────────────────────────────────────────────────────────────
function makeRewards(kind) {
  const rw = { gold: 0, cards: null, potion: null, relic: null, bossRelics: null };
  const g = kind === 'boss' ? randi(95, 105) : kind === 'elite' ? randi(25, 35) : randi(10, 20);
  rw.gold = g;
  rw.cards = Run.rollCards((Run.has('questionCard') ? 4 : 3) + (perk('vision') ? 1 : 0), kind);
  if (!Run.has('sozu') && Math.random() * 100 < R.potionChance) { rw.potion = pick(Object.keys(POTIONS)); R.potionChance = Math.max(10, R.potionChance - 10); }
  else R.potionChance = Math.min(90, R.potionChance + 10);
  if (kind === 'elite') rw.relic = '?';
  if (kind === 'boss') rw.bossRelics = sample(RELIC_LIST.filter(r => r.rarity === 'boss' && !R.relics.includes(r.id)).map(r => r.id), 3);
  return rw;
}

// ── Obchod ──────────────────────────────────────────────────────────────────
function makeShop() {
  const markup = omen('gold') ? 1.25 : 1;
  const price = r => Math.round(({ common: randi(45, 55), uncommon: randi(68, 82), rare: randi(135, 160) }[r]) * markup);
  const cards = [];
  for (const r of ['common', 'common', 'uncommon', 'uncommon', 'rare']) {
    let id, guard = 0;
    do { id = Run.randomCard(r); } while (cards.some(c => c.id === id) && guard++ < 20);
    cards.push({ id, price: price(r) });
  }
  const sale = pick(cards); sale.price = Math.round(sale.price / 2); sale.sale = true;
  for (const id of sample(CARD_LIST.filter(c => c.cls === 'neutral').map(c => c.id), 2)) cards.push({ id, price: Math.round(price(CARDS[id].rarity) * 1.2), neutral: true });
  const rp = { common: 150, uncommon: 240, rare: 300 };
  const relics = sample(Run.relicPool(), 3).map(id => ({ id, price: Math.round((rp[RELICS[id].rarity] + randi(-10, 10)) * markup) }));
  const potions = sample(Object.keys(POTIONS), 3).map(id => ({ id, price: Math.round(randi(48, 75) * markup) }));
  return { cards, relics, potions, removed: false };
}
