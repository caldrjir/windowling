'use strict';
// ── Rozhraní ────────────────────────────────────────────────────────────────
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const TYPE_NAME = { attack: L('Útok', 'Attack'), skill: L('Dovednost', 'Skill'), power: L('Síla', 'Power'), status: L('Stav', 'Status') };
const RARITY_NAME = { common: L('Běžná', 'Common'), uncommon: L('Neobvyklá', 'Uncommon'), rare: L('Vzácná', 'Rare'), starter: L('Základní', 'Starter'), special: L('Zvláštní', 'Special'), boss: 'Boss' };
const NODE = {
  battle: { icon: 'battle', name: L('Souboj', 'Battle'), col: '#cfc8ff' },
  elite: { icon: 'elite', name: L('Elita', 'Elite'), col: '#ff6b6b' },
  rest: { icon: 'rest', name: L('Odpočívadlo', 'Campfire'), col: '#ffb547' },
  shop: { icon: 'shop', name: L('Obchod', 'Merchant'), col: '#ffd166' },
  event: { icon: 'question', name: L('Neznámo', 'Unknown'), col: '#7fd8ff' },
  treasure: { icon: 'chest', name: L('Poklad', 'Treasure'), col: '#ffe08a' },
  boss: { icon: 'boss', name: 'Boss', col: '#ff4d6d' },
};
const intentInfo = m => {
  if (!m) return { ico: 'question', txt: '', tip: '' };
  const map = {
    atk: ['sword', L('Útočí', 'Attacks')], atkDef: ['sword', L('Útočí a brání se', 'Attacks and defends')], atkDebuff: ['sword', L('Útočí a oslabuje', 'Attacks and debuffs')],
    def: ['shield', L('Brání se', 'Defends')], buff: ['star', L('Posiluje se', 'Buffs itself')], debuff: ['eye', L('Chystá kletbu', 'Casts a debuff')], sleep: ['zz', L('Spí', 'Sleeping')],
  };
  const [ico, name] = map[m.k] || ['question', '?'];
  return { ico, name };
};

const UI = (() => {
  let screen = null;
  let sel = null; // vybraná karta v ruce { i }
  let drag = null;
  let targetIdx = 0;
  let shop = null, rewards = null, eventState = null;
  const toastQ = [];

  // ── Obecné prvky ──────────────────────────────────────────────────────────
  function cardHTML(c, opts = {}) {
    const d = CARDS[c.id];
    const cost = B && opts.live ? cardCost(c) : (c.up && d.up && d.up.cost !== undefined ? d.up.cost : d.cost);
    const base = d.cost;
    const costCls = cost < base ? 'buffed' : '';
    const playable = opts.live ? Battle.canPlay(c) : true;
    const col = d.cls === 'knight' ? HEROES.knight.color : d.cls === 'mage' ? HEROES.mage.color : d.cls === 'rogue' ? HEROES.rogue.color : d.cls === 'status' ? '#8a8aa8' : '#d8d2ff';
    return `<div class="card t-${d.type} r-${d.rarity} ${c.up ? 'up' : ''} ${opts.live && !playable ? 'dim' : ''} ${opts.cls || ''}" style="--cc:${col};${opts.style || ''}" ${opts.attrs || ''}>
      <div class="c-frame"></div>
      ${cost >= 0 ? `<div class="c-cost ${costCls}">${cost}</div>` : ''}
      <div class="c-name">${d.name}${c.up ? '+' : ''}</div>
      <div class="c-art">${icon(d.icon)}</div>
      <div class="c-type">${TYPE_NAME[d.type]}</div>
      <div class="c-text"><span>${cardText(c, opts.live ? B : null, opts.target)}</span></div>
    </div>`;
  }
  function relicHTML(id, extra = '') {
    const r = RELICS[id];
    const cnt = R && R.counters && R.counters[id] !== undefined && r.counter ? `<b>${R.counters[id]}</b>` : '';
    return `<div class="relic" style="--rc:${r.color}" data-tip-title="${r.name}" data-tip="${r.desc}" ${extra}>${icon(r.icon)}${cnt}</div>`;
  }
  function potionHTML(id, i) {
    if (!id) return `<div class="potion empty" data-tip="${L('Prázdný slot na lektvar', 'Empty potion slot')}">${icon('potion')}</div>`;
    const p = POTIONS[id];
    return `<button class="potion" style="--pc:${p.color}" data-potion="${i}" data-tip-title="${p.name}" data-tip="${p.desc}<br><i>${L('Klikni pro použití', 'Click to use')}</i>">${icon('potion')}</button>`;
  }
  function statusHTML(s) {
    return Object.entries(s).filter(([k, v]) => STATUS[k] && v).map(([k, v]) => {
      const S = STATUS[k];
      return `<span class="st ${S.debuff || v < 0 ? 'neg' : ''}" style="--sc:${S.color}" data-tip-title="${S.name}" data-tip="${S.desc(v)}">${icon(S.icon)}${['barricade', 'sleep'].includes(k) ? '' : `<b>${v}</b>`}</span>`;
    }).join('');
  }
  function show(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 's-' + id));
    screen = id;
    $('#topbar').hidden = !['map', 'battle', 'rest', 'shop', 'event', 'treasure'].includes(id);
    FX.setArrow(null);
    if (id !== 'battle') FX.clearActors();
  }
  function modal(html, cls = '') {
    const m = $('#modal');
    m.className = cls; m.innerHTML = html; m.hidden = false;
    return m;
  }
  function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
  function toast(title, sub, ic = 'trophy') {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `${icon(ic)}<div><small>${L('ÚSPĚCH', 'ACHIEVEMENT')}</small><b>${title}</b><span>${sub}</span></div>`;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 4600);
  }
  function banner(text, sub = '', cls = '') {
    const b = $('#banner');
    b.innerHTML = `<div class="bn ${cls}"><h3>${text}</h3>${sub ? `<p>${sub}</p>` : ''}</div>`;
  }
  function floatText(x, y, txt, cls) {
    const f = document.createElement('div');
    f.className = 'float ' + cls; f.textContent = txt;
    f.style.left = x + 'px'; f.style.top = y + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1100);
  }

  // ── Horní lišta běhu ──────────────────────────────────────────────────────
  function renderTop() {
    if (!R) return;
    const H = HEROES[R.hero];
    $('#topbar').innerHTML = `
      <div class="tb-hero" style="--hc:${H.color}"><b>${H.name}</b><span class="hp">${icon('heart')} ${R.hp} / ${R.maxHp}</span><span class="gold">${icon('coin')} ${R.gold}</span></div>
      <div class="tb-potions">${R.potions.map((p, i) => potionHTML(p, i)).join('')}</div>
      <div class="tb-relics">${R.relics.map(r => relicHTML(r)).join('')}</div>
      <div class="spacer"></div>
      <div class="tb-floor">${Run.isSaga() ? `<span class="loop">${icon('book')} ${L('Úroveň', 'Level')} ${R.level + 1}</span> · ` : ''}${R.loop ? `<span class="loop" data-tip-title="${L('Nekonečná věž', 'Endless Spire')}" data-tip="${omenTip()}">${icon('spiral')} ${R.loop}</span> · ` : ''}${L('Akt', 'Act')} ${R.act + 1} · ${L('Patro', 'Floor')} ${floorOf(R)}${R.eclipse ? ` · ${icon('moon')} ${R.eclipse}` : ''}</div>
      <button class="tb-btn" data-act="deck" data-tip="${L('Balíček', 'Deck')}">${icon('cards')}<b>${R.deck.length}</b></button>
      <button class="tb-btn" data-act="map" data-tip="${L('Mapa', 'Map')}">${icon('map')}</button>
      <button class="tb-btn" data-act="pause" data-tip="${L('Menu (Esc)', 'Menu (Esc)')}">${icon('gear')}</button>`;
  }

  const omenTip = () => (R.omens || []).map(id => { const o = OMENS.find(x => x.id === id); return `${o.name}: ${o.good} ${o.bad}`; }).join('<br>') || L('Okruh za vrcholem věže.', 'A loop beyond the top of the spire.');
  const actLabel = () => (Run.isSaga() ? `${L('Sága', 'Saga')} · ${L('Úroveň', 'Level')} ${R.level + 1} · ` : '') + (R.loop ? `${L('Nekonečná věž', 'Endless Spire')} ${R.loop} · ` : '') + `${L('Akt', 'Act')} ${R.act + 1} / ${ACTS.length}`;

  // ── Mapa ──────────────────────────────────────────────────────────────────
  function renderMap(peek = false) {
    const A = ACTS[R.act];
    FX.setTheme(A.bg, A.color);
    show('map');
    renderTop();
    Sound.music('map');
    const rows = R.map.rows, ROW_H = 92, Hh = (rows.length + 1) * ROW_H + 140;
    const avail = peek ? [] : Run.available();
    const isAvail = n => avail.includes(n);
    const X = n => 8 + n.x * 84; // %
    const Y = r => Hh - 80 - r * ROW_H;
    let lines = '', nodes = '';
    rows.forEach((row, r) => row.forEach(n => {
      for (const j of n.next) {
        const m = rows[r + 1][j];
        const done = n.visited && m.visited;
        lines += `<line x1="${X(n)}%" y1="${Y(r)}" x2="${X(m)}%" y2="${Y(r + 1)}" class="${done ? 'done' : ''}"/>`;
      }
      if (r === rows.length - 1) lines += `<line x1="${X(n)}%" y1="${Y(r)}" x2="50%" y2="${Y(rows.length) - 20}" class="${n.visited && R.map.boss.visited ? 'done' : ''}"/>`;
      const info = NODE[n.type];
      const cur = R.row === r && R.col === n.c;
      nodes += `<button class="node ${n.visited ? 'visited' : ''} ${isAvail(n) ? 'avail' : ''} ${cur ? 'cur' : ''}" style="left:${X(n)}%;top:${Y(r)}px;--nc:${info.col}" data-node="${r},${n.c}" data-tip-title="${info.name}" ${isAvail(n) ? '' : 'tabindex="-1"'}>${icon(info.icon)}</button>`;
    }));
    const bossAvail = isAvail(R.map.boss);
    const bossDef = ENEMIES[R.map.boss.enc[0]];
    nodes += `<button class="node boss ${bossAvail ? 'avail' : ''}" style="left:50%;top:${Y(rows.length) - 20}px;--nc:#ff4d6d" data-node="boss" data-tip-title="${bossDef.name}" data-tip="Boss">${icon('boss')}</button>`;
    $('#s-map').innerHTML = `
      <div class="map-head"><h2>${A.name}</h2><p>${actLabel()} · ${peek ? L('Prohlížíš mapu', 'Viewing the map') : L('Vyber další hvězdu', 'Choose your next star')}</p>${peek ? `<button class="btn" data-act="closeMap">${L('Zpět', 'Back')}</button>` : ''}</div>
      <div class="map-scroll"><div class="map" style="height:${Hh}px"><svg class="map-lines" width="100%" height="${Hh}">${lines}</svg>${nodes}</div></div>
      <div class="map-legend">${['battle', 'elite', 'event', 'rest', 'shop', 'treasure'].map(k => `<span style="--nc:${NODE[k].col}">${icon(NODE[k].icon)} ${NODE[k].name}</span>`).join('')}</div>`;
    const sc = $('.map-scroll');
    const target = R.row < 0 ? Hh : Y(Math.min(R.row + 1, rows.length)) + 200;
    sc.scrollTop = target - sc.clientHeight;
  }
  function chooseNode(key) {
    let node;
    if (key === 'boss') node = R.map.boss;
    else { const [r, c] = key.split(',').map(Number); node = R.map.rows[r][c]; }
    if (!Run.available().includes(node)) return;
    Sound.play.step();
    Run.enter(node);
    enterNode(node);
  }
  function enterNode(node) {
    switch (node.type) {
      case 'battle': case 'elite': case 'boss': startBattle(node.enc, node.type === 'battle' ? 'normal' : node.type); break;
      case 'rest': renderRest(); break;
      case 'shop': if (!R.shopState) R.shopState = makeShop(); if (Run.has('mealTicket') && !R.shopState.fed) { R.shopState.fed = true; Run.heal(15); } renderShop(); break;
      case 'event': renderEvent(); break;
      case 'treasure': renderTreasure(); break;
    }
  }
  function leaveNode() {
    R.node = null; R.shopState = null; R.eventId = null;
    Run.save();
    renderMap();
  }

  // ── Souboj ────────────────────────────────────────────────────────────────
  function startBattle(enc, kind) {
    show('battle');
    const A = ACTS[R.act];
    FX.setTheme(kind === 'boss' ? ['#2a0a1a', '#07020a'] : A.bg, kind === 'boss' ? '#ff4d6d' : A.color);
    Sound.music(kind === 'boss' ? 'boss' : 'battle');
    sel = null; targetIdx = 0;
    $('#s-battle').innerHTML = `
      <div class="stage" id="stage">
        <div class="hero-slot"><div class="actor-box hero-box" id="heroBox"></div><div class="bar-wrap" id="heroBar"></div><div class="statuses" id="heroSt"></div></div>
        <div class="enemies" id="enemies"></div>
      </div>
      <div class="hud">
        <div class="energy" id="energy"></div>
        <button class="pile" data-act="pile-draw" id="pileDraw"></button>
        <div class="hand" id="hand"></div>
        <button class="pile" data-act="pile-discard" id="pileDiscard"></button>
        <button class="end-turn" id="endTurn" data-act="endTurn">${L('Ukončit kolo', 'End Turn')}<small>E</small></button>
      </div>`;
    renderTop();
    if (kind === 'boss') { Sound.play.boss(); banner(ENEMIES[enc[0]].name, L('Strážce tohoto aktu', 'Guardian of this act'), 'boss'); }
    else if (kind === 'elite') banner(L('Elitní nepřítel', 'Elite Enemy'), '', 'elite');
    Battle.start(enc, kind);
    FX.setActor('hero', { el: $('#heroBox'), tpl: HERO_ART[R.hero][0], opts: HERO_ART[R.hero][1], color: HEROES[R.hero].color, seed: 1, dir: 1, dead: false, alpha: 0 });
    renderEnemies();
    renderBattle();
  }
  function renderEnemies() {
    $('#enemies').innerHTML = B.enemies.map((e, i) => {
      const sz = Math.round(130 * e.d.art[2] + 40);
      return `<div class="enemy ${e.dead ? 'dead' : ''}" data-enemy="${i}" style="--sz:${sz}px">
        <div class="intent" id="int${i}"></div>
        <div class="actor-box" id="eb${i}"></div>
        <div class="e-name">${e.name}</div>
        <div class="bar-wrap" id="ebar${i}"></div>
        <div class="statuses" id="est${i}"></div>
      </div>`;
    }).join('');
    B.enemies.forEach((e, i) => { const a = e.d.art; FX.setActor('e' + e.uid, { el: $('#eb' + i), tpl: a[0], opts: a[3], color: a[1], seed: i * 3 + 2, dir: -1, dead: e.dead, alpha: 0 }); });
  }
  const bar = (hp, max, block, poison) => `<div class="bar ${block ? 'has-block' : ''}"><i style="width:${Math.max(0, hp / max * 100)}%"></i>${poison ? `<u style="width:${Math.min(hp, poison) / max * 100}%;left:${Math.max(0, (hp - poison) / max * 100)}%"></u>` : ''}<span>${hp} / ${max}</span>${block ? `<b class="blk">${icon('shield')}${block}</b>` : ''}</div>`;
  function renderBattle() {
    if (screen !== 'battle' || !B) return;
    $('#heroBar').innerHTML = bar(R.hp, R.maxHp, B.p.block);
    $('#heroSt').innerHTML = statusHTML(B.p.s);
    B.enemies.forEach((e, i) => {
      const el = document.querySelector(`[data-enemy="${i}"]`);
      if (!el) return;
      el.classList.toggle('dead', e.dead);
      el.classList.toggle('targetable', !!(sel && CARDS[B.hand[sel.i] && B.hand[sel.i].id] && CARDS[B.hand[sel.i].id].target === 'enemy') && !e.dead);
      el.classList.toggle('kbd-target', !!sel && targetIdx === i);
      $('#ebar' + i).innerHTML = e.dead ? '' : bar(e.hp, e.maxHp, e.block, e.s.poison);
      $('#est' + i).innerHTML = e.dead ? '' : statusHTML(e.s);
      const m = e.move, ii = intentInfo(m);
      let txt = '';
      if (m && m.dmg) { const d = Battle.calcDmg({ dmg: m.dmg }, e, B.p); txt = `${d}${m.n > 1 ? '×' + m.n : ''}`; }
      const tip = m ? `${ii.name}${m.dmg ? `: ${txt}` : ''}${m.block ? ` · ${L('blok', 'block')} ${m.block}` : ''}${m.cards ? ` · ${L('přidá', 'adds')} ${m.cards[1]}× ${CARDS[m.cards[0]].name}` : ''}` : '';
      $('#int' + i).innerHTML = e.dead || !m ? '' : `<span class="it it-${m.k}" data-tip="${tip}">${icon(ii.ico)}${txt ? `<b>${txt}</b>` : ''}</span>`;
    });
    $('#energy').innerHTML = `<b>${B.energy}</b><span>/${B.maxEnergy}</span>`;
    $('#energy').classList.toggle('empty', B.energy === 0);
    $('#pileDraw').innerHTML = `${icon('cards')}<b>${B.draw.length}</b><small>${L('Dobírací', 'Draw')}</small>`;
    $('#pileDiscard').innerHTML = `${icon('cards')}<b>${B.discard.length}</b><small>${L('Odhoz', 'Discard')}</small>`;
    $('#endTurn').disabled = B.busy;
    $('#endTurn').classList.toggle('pulse', !B.busy && !B.hand.some(c => Battle.canPlay(c)));
  }
  function renderHand() {
    if (screen !== 'battle' || !B) return;
    const n = B.hand.length;
    const tgt = B.enemies[targetIdx] && !B.enemies[targetIdx].dead ? B.enemies[targetIdx] : null;
    $('#hand').innerHTML = B.hand.map((c, i) => {
      const off = i - (n - 1) / 2;
      const rot = off * Math.min(5, 30 / n), y = Math.abs(off) ** 1.6 * 3;
      return cardHTML(c, { live: true, target: tgt, cls: sel && sel.i === i ? 'selected' : '', attrs: `data-hand="${i}"`, style: `--rot:${rot}deg;--y:${y}px;--z:${i}` });
    }).join('');
    renderBattle();
  }

  function selectCard(i) {
    const c = B.hand[i];
    if (!c) return;
    if (!Battle.canPlay(c)) { Sound.play.error(); const el = document.querySelector(`[data-hand="${i}"]`); if (el) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); } return; }
    if (sel && sel.i === i) {
      if (CARDS[c.id].target !== 'enemy') { playSel(); return; }
      const t = B.enemies[targetIdx];
      if (t && !t.dead) { playSel(t); return; }
    }
    sel = { i };
    const alive = B.enemies.findIndex(e => !e.dead);
    if (!B.enemies[targetIdx] || B.enemies[targetIdx].dead) targetIdx = alive;
    Sound.play.card();
    renderHand();
  }
  function playSel(target) {
    if (!sel) return;
    const i = sel.i;
    sel = null;
    const c = B.hand[i];
    const el = document.querySelector(`[data-hand="${i}"]`);
    if (el && c) flyCard(el, target);
    if (!Battle.play(i, target)) { Sound.play.error(); renderHand(); }
    FX.setArrow(null);
  }
  function flyCard(el, target) {
    const r = el.getBoundingClientRect();
    const g = el.cloneNode(true);
    g.classList.add('ghost'); g.classList.remove('selected');
    g.style.left = r.left + 'px'; g.style.top = r.top + 'px';
    document.body.appendChild(g);
    let tx = innerWidth / 2, ty = innerHeight * 0.4;
    if (target) { const p = FX.pos('e' + target.uid); if (p) { tx = p.x; ty = p.y; } }
    requestAnimationFrame(() => { g.style.transform = `translate(${tx - r.left - r.width / 2}px, ${ty - r.top - r.height / 2}px) scale(0.5) rotate(8deg)`; g.style.opacity = '0'; });
    setTimeout(() => g.remove(), 450);
  }
  function enemyAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const en = el && el.closest('.enemy');
    if (!en) return null;
    const e = B.enemies[+en.dataset.enemy];
    return e && !e.dead ? e : null;
  }

  // tažení karet
  function onPointerDown(ev) {
    const cardEl = ev.target.closest('#hand .card');
    if (!cardEl || screen !== 'battle' || ev.button > 0) return;
    const i = +cardEl.dataset.hand, c = B.hand[i];
    if (!c) return;
    if (!Battle.canPlay(c)) { selectCard(i); return; }
    drag = { i, x0: ev.clientX, y0: ev.clientY, el: cardEl, moved: false, targeted: CARDS[c.id].target === 'enemy' };
    ev.preventDefault();
  }
  function onPointerMove(ev) {
    if (!drag) {
      if (sel && screen === 'battle' && B.hand[sel.i] && CARDS[B.hand[sel.i].id].target === 'enemy') {
        const el = document.querySelector(`[data-hand="${sel.i}"]`);
        if (el) { const r = el.getBoundingClientRect(); const e = enemyAt(ev.clientX, ev.clientY); FX.setArrow({ x1: r.left + r.width / 2, y1: r.top + 20, x2: ev.clientX, y2: ev.clientY, ok: !!e }); }
      }
      return;
    }
    const dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 8) {
      drag.moved = true;
      sel = { i: drag.i }; Sound.play.card();
      renderHand();
      drag.el = document.querySelector(`[data-hand="${drag.i}"]`);
      drag.el.classList.add('dragging');
    }
    if (!drag.moved) return;
    const hy = $('#hand').getBoundingClientRect().top;
    if (drag.targeted) {
      const r = drag.el.getBoundingClientRect();
      const e = enemyAt(ev.clientX, ev.clientY);
      FX.setArrow({ x1: r.left + r.width / 2, y1: r.top + 20, x2: ev.clientX, y2: ev.clientY, ok: !!e });
      $$('.enemy').forEach(el => el.classList.toggle('hovered', !!e && B.enemies[+el.dataset.enemy] === e));
    } else {
      drag.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
      drag.el.classList.toggle('release', ev.clientY < hy - 60);
    }
  }
  function onPointerUp(ev) {
    if (!drag) return;
    const d = drag; drag = null;
    FX.setArrow(null);
    $$('.enemy.hovered').forEach(el => el.classList.remove('hovered'));
    if (!d.moved) { selectCard(d.i); return; }
    const hy = $('#hand').getBoundingClientRect().top;
    if (d.targeted) {
      const e = enemyAt(ev.clientX, ev.clientY);
      if (e) { sel = { i: d.i }; playSel(e); return; }
    } else if (ev.clientY < hy - 60) { sel = { i: d.i }; playSel(); return; }
    sel = null; renderHand();
  }

  function onBus(type, d) {
    if (type === 'achievement') { Sound.play.relic(); toast(d.a.name, d.a.desc, d.a.icon); return; }
    if (screen !== 'battle' || !B) { if (type === 'heal' && R) renderTop(); return; }
    const actorKey = t => t === B.p ? 'hero' : 'e' + t.uid;
    switch (type) {
      case 'hit': {
        const p = FX.pos(actorKey(d.t));
        const a = p && p.a;
        if (a) { a.flash = 1; a.shake = Math.min(1, 0.3 + d.amount / 25); }
        if (p) {
          if (d.amount > 0) { floatText(p.x + rand(-30, 30), p.y - 30, d.amount, d.amount >= 25 ? 'dmg big' : 'dmg'); FX.slash(p.x, p.y, '#ffffff'); Sound.play.hit(d.amount >= 20); }
          else if (d.blocked) { floatText(p.x, p.y - 30, L('Blok', 'Blocked'), 'blk'); Sound.play.blocked(); }
        }
        renderBattle(); break;
      }
      case 'playerHit': {
        const p = FX.pos('hero');
        if (p) {
          p.a.flash = 1; p.a.shake = 0.6;
          if (d.amount > 0) { floatText(p.x, p.y - 40, '-' + d.amount, 'dmg hurt'); Sound.play.hurt(); $('#stage').classList.remove('quake'); void $('#stage').offsetWidth; $('#stage').classList.add('quake'); $('#vignette').classList.remove('on'); void $('#vignette').offsetWidth; $('#vignette').classList.add('on'); }
          else if (d.blocked) { floatText(p.x, p.y - 40, L('Blok', 'Blocked'), 'blk'); Sound.play.blocked(); }
        }
        renderTop(); renderBattle(); break;
      }
      case 'blockGain': { const p = FX.pos(actorKey(d.t)); if (p) FX.burst(p.x, p.y, '#9fb4ff', 12, 160, 3, 0.6); Sound.play.block(); renderBattle(); break; }
      case 'status': {
        const p = FX.pos(actorKey(d.t)), S = STATUS[d.s];
        if (p && S && d.v > 0 && !['flex', 'echo'].includes(d.s)) {
          floatText(p.x, p.y - 70, `${d.v > 0 ? '+' : ''}${d.v} ${S.name}`, S.debuff ? 'stx neg' : 'stx');
          if (d.s === 'poison') { FX.rise(p.x, p.y, '#8dff5a'); Sound.play.poison(); }
          else if (d.s === 'burn') { FX.rise(p.x, p.y, '#ffb03b', 16); Sound.play.burn(); }
          else (S.debuff ? Sound.play.debuff() : Sound.play.buff());
        }
        renderBattle(); break;
      }
      case 'blocked': { const p = FX.pos(actorKey(d.t)); if (p) floatText(p.x, p.y - 70, L('Artefakt', 'Artifact'), 'stx'); break; }
      case 'death': { FX.dissolve('e' + d.t.uid); Sound.play.death(); renderBattle(); break; }
      case 'wake': { const p = FX.pos(actorKey(d.t)); if (p) floatText(p.x, p.y - 70, L('Probudil se!', 'Awakened!'), 'stx neg'); renderBattle(); break; }
      case 'phase': banner(L('Druhá fáze', 'Phase Two'), d.t.name, 'boss'); renderBattle(); break;
      case 'enemyAct': { const p = FX.pos(actorKey(d.t)); if (p && d.m.dmg) p.a.lunge = 1; break; }
      case 'enemyHeal': { const p = FX.pos(actorKey(d.t)); if (p) FX.rise(p.x, p.y, '#7cf0b6'); renderBattle(); break; }
      case 'heal': { const p = FX.pos('hero'); if (p) { floatText(p.x, p.y - 40, '+' + d.n, 'heal'); FX.rise(p.x, p.y, '#7cf0b6'); } Sound.play.heal(); renderTop(); renderBattle(); break; }
      case 'hand': renderHand(); break;
      case 'play': Sound.play.card(); break;
      case 'turn': banner(L('Tvoje kolo', 'Your Turn'), '', 'turn'); Sound.play.turn(); sel = null; renderHand(); break;
      case 'statusCards': { const p = FX.pos('hero'); if (p) floatText(p.x, p.y - 70, `+${d.n} ${CARDS[d.id].name}`, 'stx neg'); renderBattle(); break; }
      case 'potion': renderTop(); renderBattle(); break;
      case 'victory': setTimeout(() => afterVictory(d.kind), 900); break;
      case 'defeat': setTimeout(() => gameOver(false), 1300); Sound.play.defeat(); { const p = FX.pos('hero'); if (p) FX.dissolve('hero'); } break;
    }
  }

  // ── Odměny ────────────────────────────────────────────────────────────────
  function afterVictory(kind) {
    Sound.play.victory();
    rewards = makeRewards(kind);
    if (rewards.relic === '?') rewards.relic = Run.rollRelic();
    rewards.kind = kind;
    renderRewards();
  }
  function renderRewards() {
    const rw = rewards;
    const items = [];
    if (rw.gold && !Run.has('ecto')) items.push(`<button class="rw" data-rw="gold">${icon('coin')}<span>${rw.gold} ${L('zlata', 'Gold')}</span></button>`);
    if (rw.potion) items.push(`<button class="rw" data-rw="potion" style="--pc:${POTIONS[rw.potion].color}">${icon('potion')}<span>${POTIONS[rw.potion].name}</span></button>`);
    if (rw.relic) items.push(`<button class="rw" data-rw="relic" style="--pc:${RELICS[rw.relic].color}">${icon(RELICS[rw.relic].icon)}<span>${RELICS[rw.relic].name}<small>${RELICS[rw.relic].desc}</small></span></button>`);
    if (rw.cards) items.push(`<button class="rw" data-rw="cards">${icon('cards')}<span>${L('Přidat kartu do balíčku', 'Add a card to your deck')}</span></button>`);
    modal(`<div class="panel rewards">
      <h2>${rw.kind === 'boss' ? L('Strážce padl', 'The Guardian Falls') : L('Vítězství', 'Victory')}</h2>
      <div class="rw-list">${items.join('') || `<p class="muted">${L('Vše posbíráno.', 'All collected.')}</p>`}</div>
      <button class="btn primary" data-act="rwDone">${rw.bossRelics ? L('Dál', 'Next') : L('Pokračovat', 'Continue')}</button></div>`, 'm-rewards');
  }
  function takeReward(k) {
    const rw = rewards;
    if (k === 'gold') { Run.gainGold(rw.gold); rw.gold = 0; Sound.play.gold(); }
    if (k === 'potion') { if (Run.addPotion(rw.potion)) { rw.potion = null; Sound.play.click(); } else { Sound.play.error(); return; } }
    if (k === 'relic') { Run.addRelic(rw.relic); rw.relic = null; Sound.play.relic(); }
    if (k === 'cards') { cardReward(rw.cards.map(c => c), L('Vyber kartu', 'Choose a card'), () => { rw.cards = null; renderTop(); renderRewards(); }, () => renderRewards()); return; }
    renderTop(); renderRewards();
  }
  function cardReward(list, title, onTake, onSkip) {
    list = list.map(c => (c.id ? c : { id: c, up: false }));
    modal(`<div class="panel pick"><h2>${title}</h2><div class="card-row">${list.map((c, i) => cardHTML(c, { attrs: `data-pickreward="${i}"`, cls: 'big' })).join('')}</div>
      <button class="btn ghost" data-act="skipCard">${L('Přeskočit', 'Skip')}</button></div>`, 'm-pick');
    const m = $('#modal');
    m._pick = i => { Run.addCard(list[i].id, list[i].up); Sound.play.upgrade(); closeModal(); renderTop(); if (onTake) onTake(); };
    m._skip = () => { closeModal(); if (onSkip) onSkip(); };
  }
  function rewardsDone() {
    const rw = rewards;
    closeModal();
    if (rw.bossRelics && rw.bossRelics.length) { bossRelicChoice(rw.bossRelics); return; }
    rewards = null;
    if (rw.kind === 'boss') { advance(); return; }
    leaveNode();
  }
  // Po bossovi: další akt, nebo vrchol věže a Nekonečná věž
  function advance() {
    if (Run.isLastAct() && Run.isSaga()) { sagaLevelDone(); return; }
    if (!Run.isLastAct()) {
      Run.nextAct();
      banner(ACTS[R.act].name, L(`Akt ${R.act + 1}`, `Act ${R.act + 1}`), 'turn');
      leaveNode();
      return;
    }
    R.node = 'summit';
    if (!R.won) Run.recordVictory(); else Run.save();
    summit();
  }
  function summit() {
    renderMap(true);
    $('.map-head button') && $('.map-head button').remove();
    if (!R.loop && !R.summitSeen) {
      modal(`<div class="panel summit"><div class="summit-ico">${icon('crown')}</div>
        <h2>${L('Vrchol věže je tvůj', 'The Top of the Spire Is Yours')}</h2>
        <p class="muted">${L('Prázdnota padla a výstup se počítá jako vítězství. Nad vrcholem se ale věž točí dál: <b>Nekonečná věž</b> opakuje všechny akty, nepřátelé sílí s každým okruhem a každý okruh přinese hvězdné znamení. Čím výš vystoupáš, tím víc hvězdného prachu získáš.', 'The Void has fallen and this climb counts as a victory. Above the top, though, the spire keeps turning: the <b>Endless Spire</b> repeats every act, enemies grow stronger with each loop and each loop brings a star omen. The higher you climb, the more Stardust you earn.')}</p>
        <div class="row-btns"><button class="btn primary" data-act="summitGo">${icon('spiral')} ${L('Stoupat dál', 'Climb On')}</button><button class="btn" data-act="summitEnd">${icon('trophy')} ${L('Ukončit vítězně', 'End in Victory')}</button></div></div>`, 'm-summit');
      return;
    }
    omenChoice();
  }
  // ── Sága ──
  const eclText = e => (e > 0 && e <= MAX_ECLIPSE ? ECLIPSE[e - 1] : L('Nepřátelé jsou silnější.', 'Enemies are stronger.'));
  function sagaLevelDone() {
    const done = R.level + 1, dust = Run.nextLevel();
    Sound.play.victory();
    renderMap(true);
    $('.map-head button') && $('.map-head button').remove();
    modal(`<div class="panel summit"><div class="summit-ico">${icon('book')}</div>
      <h2>${L(`Úroveň ${done} dokončena`, `Level ${done} complete`)}</h2>
      <p class="muted">${L('Tvůj balíček, relikvie i lektvary jdou s tebou dál. Věž se staví znovu, tentokrát těžší.', 'Your deck, relics and potions come with you. The spire rebuilds itself, harder this time.')}</p>
      <p class="dust-gain">${icon('sparkle')} ${L(`+${dust} hvězdného prachu`, `+${dust} Stardust`)}</p>
      <div class="saga-next"><b>${L(`Úroveň ${R.level + 1}`, `Level ${R.level + 1}`)} · ${icon('moon')} ${L('Zatmění', 'Eclipse')} ${R.eclipse}</b><span>${L('Nově', 'New')}: ${eclText(R.level)}</span></div>
      <div class="row-btns"><button class="btn primary" data-act="sagaGo">${icon('play')} ${L('Pokračovat', 'Continue')}</button></div></div>`, 'm-summit');
  }
  function sagaFall() {
    R.node = 'fallen'; Run.save();
    show('over');
    FX.setTheme(['#1a0510', '#050105'], '#ff4d6d');
    Sound.music('menu');
    const H = HEROES[R.hero];
    $('#s-over').innerHTML = `<div class="over">
      <h1 class="lose">${L('Tvá hvězda pohasla', 'Your Star Flickers')}</h1>
      <p class="muted">${H.name} · ${L('Sága', 'Saga')} · ${L('Úroveň', 'Level')} ${R.level + 1} · ${ACTS[R.act].name}</p>
      <p class="saga-info">${L(`Sága ale nekončí: úroveň ${R.level + 1} můžeš zkusit znovu s balíčkem, se kterým jsi do ní vstoupil.`, `The saga isn't over: you can retry level ${R.level + 1} with the deck you entered it with.`)}</p>
      <div class="row-btns"><button class="btn primary" data-act="sagaRetry">${icon('play')} ${L(`Zkusit úroveň ${R.level + 1} znovu`, `Retry level ${R.level + 1}`)}</button><button class="btn" data-act="sagaEnd">${L('Ukončit ságu', 'End the Saga')}</button></div>
    </div>`;
  }
  function omenChoice() {
    const list = R.omenOffer || (R.omenOffer = Run.omenChoices());
    Run.save();
    if (!list.length) { takeOmen(null); return; }
    modal(`<div class="panel omens"><h2>${L('Hvězdné znamení', 'Star Omen')}</h2>
      <p class="muted">${L(`Okruh ${(R.loop || 0) + 1} Nekonečné věže. Vyber znamení: platí do konce výstupu, i se svou kletbou.`, `Loop ${(R.loop || 0) + 1} of the Endless Spire. Choose an omen: it lasts for the rest of the climb, curse included.`)}</p>
      <div class="br-row">${list.map(id => { const o = OMENS.find(x => x.id === id); return `<button class="br omen" data-omen="${id}" style="--rc:${o.color}">${icon(o.icon)}<b>${o.name}</b><span class="good">${o.good}</span><span class="bad">${o.bad}</span></button>`; }).join('')}</div>
      <button class="btn ghost" data-act="summitEnd">${L('Raději skončit (vítězně)', 'End the climb (victory)')}</button></div>`, 'm-pick');
  }
  function takeOmen(id) {
    closeModal();
    R.omenOffer = null; R.summitSeen = true;
    Run.nextLoop(id);
    Sound.play.relic();
    banner(L(`Nekonečná věž ${R.loop}`, `Endless Spire ${R.loop}`), ACTS[0].name, 'boss');
    leaveNode();
  }
  function bossRelicChoice(list) {
    modal(`<div class="panel boss-relics"><h2>${L('Vyber relikvii bosse', 'Choose a Boss Relic')}</h2><div class="br-row">${list.map(id => `<button class="br" data-bossrelic="${id}" style="--rc:${RELICS[id].color}">${icon(RELICS[id].icon)}<b>${RELICS[id].name}</b><span>${RELICS[id].desc}</span></button>`).join('')}</div>
      <button class="btn ghost" data-act="skipBossRelic">${L('Přeskočit', 'Skip')}</button></div>`);
  }
  function takeBossRelic(id) {
    if (id) { Run.addRelic(id); Sound.play.relic(); }
    closeModal();
    rewards = null;
    advance();
  }

  // ── Výběr karty z balíčku ─────────────────────────────────────────────────
  function pickCard(list, title, cb, upgradePreview) {
    if (!list.length) { toastInfo(L('Žádná vhodná karta.', 'No eligible card.')); return; }
    modal(`<div class="panel deck"><h2>${title}</h2><div class="card-grid">${list.map((c, i) => cardHTML(upgradePreview ? { id: c.id, up: true } : c, { attrs: `data-pickdeck="${i}"` })).join('')}</div>
      <button class="btn ghost" data-act="closeModal">${L('Zrušit', 'Cancel')}</button></div>`, 'm-deck');
    $('#modal')._pickDeck = i => { closeModal(); cb(i, list); renderTop(); };
  }
  function toastInfo(txt) { banner(txt, '', 'turn'); }
  function showDeck(cards, title) {
    modal(`<div class="panel deck"><h2>${title} <small>${cards.length}</small></h2><div class="card-grid">${cards.map(c => cardHTML(c)).join('') || `<p class="muted">${L('Prázdné', 'Empty')}</p>`}</div>
      <button class="btn" data-act="closeModal">${L('Zavřít', 'Close')}</button></div>`, 'm-deck');
  }

  // ── Odpočívadlo ───────────────────────────────────────────────────────────
  function renderRest(done) {
    show('rest'); renderTop(); Sound.music('map');
    const heal = Run.restAmount();
    const canRest = !Run.has('coffee');
    $('#s-rest').innerHTML = `<div class="place">
      <div class="campfire">${icon('rest')}</div>
      <h2>${L('Odpočívadlo', 'Campfire')}</h2><p class="muted">${L('Hvězdy tu hoří tišeji. Můžeš si odpočinout, nebo kout.', 'The stars burn quieter here. You may rest, or forge.')}</p>
      ${done ? `<p class="result">${done}</p><button class="btn primary" data-act="leave">${L('Pokračovat', 'Continue')}</button>` : `
      <div class="choices">
        <button class="choice" data-act="restHeal" ${canRest ? '' : 'disabled'}>${icon('heart')}<b>${L('Odpočinout', 'Rest')}</b><span>${canRest ? L(`Vyléčí ${heal} životů`, `Heal ${heal} HP`) : L('Kávovar ti nedá spát', 'The Coffee Dripper keeps you awake')}</span></button>
        <button class="choice" data-act="restSmith">${icon('anvil')}<b>${L('Kovat', 'Smith')}</b><span>${L('Vylepši jednu kartu', 'Upgrade a card')}</span></button>
      </div>`}
    </div>`;
  }

  // ── Obchod ────────────────────────────────────────────────────────────────
  function renderShop() {
    show('shop'); renderTop(); Sound.music('map');
    shop = R.shopState;
    const can = p => R.gold >= p;
    $('#s-shop').innerHTML = `<div class="place shop">
      <h2>${icon('shop')} ${L('Hvězdný obchodník', 'The Star Merchant')}</h2>
      <p class="muted">${L('„Všechno má svou cenu. I hvězdy.“', '"Everything has a price. Even the stars."')}</p>
      <div class="shop-cards">${shop.cards.map((it, i) => it.sold ? '<div class="sold"></div>' : `<div class="shop-item">${cardHTML({ id: it.id, up: false }, { attrs: `data-buy="card:${i}"` })}<span class="price ${can(it.price) ? '' : 'no'}">${icon('coin')} ${it.price}${it.sale ? ` <i>${L('SLEVA', 'SALE')}</i>` : ''}</span></div>`).join('')}</div>
      <div class="shop-row">
        ${shop.relics.map((it, i) => it.sold ? '' : `<div class="shop-item small">${relicHTML(it.id, `data-buy="relic:${i}"`)}<span class="price ${can(it.price) ? '' : 'no'}">${icon('coin')} ${it.price}</span></div>`).join('')}
        ${shop.potions.map((it, i) => it.sold ? '' : `<div class="shop-item small"><button class="potion big" style="--pc:${POTIONS[it.id].color}" data-buy="potion:${i}" data-tip-title="${POTIONS[it.id].name}" data-tip="${POTIONS[it.id].desc}">${icon('potion')}</button><span class="price ${can(it.price) ? '' : 'no'}">${icon('coin')} ${it.price}</span></div>`).join('')}
        <div class="shop-item small">${shop.removed ? '<div class="sold"></div>' : `<button class="service" data-buy="remove">${icon('x')}<small>${L('Odstranit kartu', 'Remove a card')}</small></button><span class="price ${can(R.removeCost) ? '' : 'no'}">${icon('coin')} ${R.removeCost}</span>`}</div>
      </div>
      <button class="btn primary" data-act="leave">${L('Odejít', 'Leave')}</button>
    </div>`;
  }
  function buy(key) {
    const [k, i] = key.split(':');
    const pay = p => { if (R.gold < p) { Sound.play.error(); return false; } R.gold -= p; Sound.play.gold(); return true; };
    if (k === 'card') { const it = shop.cards[i]; if (pay(it.price)) { Run.addCard(it.id); it.sold = true; } }
    if (k === 'relic') { const it = shop.relics[i]; if (pay(it.price)) { Run.addRelic(it.id); it.sold = true; Sound.play.relic(); } }
    if (k === 'potion') { const it = shop.potions[i]; if (!R.potions.includes(null) || Run.has('sozu')) { Sound.play.error(); return; } if (pay(it.price)) { Run.addPotion(it.id); it.sold = true; } }
    if (k === 'remove') {
      if (R.gold < R.removeCost) { Sound.play.error(); return; }
      pickCard(R.deck, L('Odstranit kartu', 'Remove a card'), idx => { R.gold -= R.removeCost; R.removeCost += 25; Run.removeCard(idx); shop.removed = true; Sound.play.gold(); renderShop(); });
      return;
    }
    Run.save();
    renderShop();
  }

  // ── Událost ───────────────────────────────────────────────────────────────
  function renderEvent(resultText) {
    show('event'); renderTop(); Sound.music('map');
    if (!R.eventId) { const pool = EVENTS.filter(e => !(R.seenEvents || []).includes(e.id)); const ev = pick(pool.length ? pool : EVENTS); R.eventId = ev.id; R.seenEvents = (R.seenEvents || []).concat(ev.id); Run.save(); }
    const ev = EVENTS.find(e => e.id === R.eventId);
    $('#s-event').innerHTML = `<div class="place event">
      <div class="ev-art">${icon(ev.icon)}</div>
      <h2>${ev.title}</h2>
      <p class="ev-text">${ev.text}</p>
      ${resultText ? `<p class="result">${resultText}</p><button class="btn primary" data-act="leave">${L('Pokračovat', 'Continue')}</button>` :
        `<div class="ev-opts">${ev.opts.map((o, i) => `<button class="ev-opt" data-evopt="${i}" ${o.ok && !o.ok(R) ? 'disabled' : ''}>${o.t}</button>`).join('')}</div>`}
    </div>`;
  }
  function eventChoice(i) {
    const ev = EVENTS.find(e => e.id === R.eventId), o = ev.opts[i];
    if (o.ok && !o.ok(R)) return;
    Sound.play.click();
    const txt = o.do(R, UI);
    renderTop();
    if (R.hp <= 0) { gameOver(false); return; }
    renderEvent(txt);
  }

  // ── Poklad ────────────────────────────────────────────────────────────────
  function renderTreasure(opened) {
    show('treasure'); renderTop(); Sound.music('map');
    $('#s-treasure').innerHTML = `<div class="place">
      <button class="chest ${opened ? 'open' : ''}" data-act="${opened ? '' : 'openChest'}">${icon('chest')}</button>
      <h2>${L('Hvězdná truhla', 'Star Chest')}</h2>
      ${opened ? `<p class="result">${opened}</p><button class="btn primary" data-act="leave">${L('Pokračovat', 'Continue')}</button>` : `<p class="muted">${L('Klikni pro otevření', 'Click to open')}</p>`}
    </div>`;
  }
  function openChest() {
    const r = Run.giveRandomRelic();
    const g = randi(25, 50); Run.gainGold(g);
    Sound.play.relic();
    renderTreasure(L(`Získal jsi ${RELICS[r].name} a ${g} zlata.`, `You found ${RELICS[r].name} and ${g} Gold.`));
    const p = $('.chest').getBoundingClientRect();
    FX.burst(p.left + p.width / 2, p.top + p.height / 2, '#ffe08a', 50, 400, 4, 1.2);
  }

  // ── Konec běhu ────────────────────────────────────────────────────────────
  function gameOver(victory, end) {
    if (!victory && !end && Run.isSaga()) { sagaFall(); return; }
    const run = R;
    const before = new Set(Object.keys(SAVE.achievements));
    Run.endRun(victory);
    const newAch = Object.keys(SAVE.achievements).filter(a => !before.has(a)).map(id => ACHIEVEMENTS.find(a => a.id === id));
    show('over');
    FX.setTheme(victory ? ['#2a2008', '#060402'] : ['#1a0510', '#050105'], victory ? '#ffe08a' : '#ff4d6d');
    Sound.music('menu');
    if (victory) Sound.play.victory();
    const H = HEROES[run.hero];
    $('#s-over').innerHTML = `<div class="over">
      <h1 class="${victory || run.won || run.level ? 'win' : 'lose'}">${run.mode === 'saga' ? L(`Sága končí v úrovni ${run.level + 1}`, `The Saga Ends at Level ${run.level + 1}`) : victory ? L('Vystoupal jsi na vrchol', 'You Reached the Summit') : run.won ? L('Nekonečná věž tě pohltila', 'The Endless Spire Claims You') : L('Tvá hvězda zhasla', 'Your Star Has Faded')}</h1>
      <p class="muted">${H.name} · ${run.mode === 'saga' ? `${L('Sága', 'Saga')} · ` : ''}${run.loop ? `${L('Nekonečná věž', 'Endless Spire')} ${run.loop} · ` : ''}${ACTS[Math.max(0, run.act)].name} · ${L('Zatmění', 'Eclipse')} ${run.eclipse}</p>
      <div class="over-stats">
        <div><small>${L('Patro', 'Floor')}</small><b>${floorOf(run)}</b></div>
        <div><small>${L('Poraženo', 'Defeated')}</small><b>${run.stats.kills}</b></div>
        <div><small>${L('Elity', 'Elites')}</small><b>${run.stats.elites}</b></div>
        <div><small>${L('Poškození', 'Damage')}</small><b>${fmtNum(run.stats.dmg)}</b></div>
        <div><small>${L('Balíček', 'Deck')}</small><b>${run.deck.length}</b></div>
        <div><small>${L('Čas', 'Time')}</small><b>${fmtTime(run.time)}</b></div>
      </div>
      <div class="over-relics">${run.relics.map(r => relicHTML(r)).join('')}</div>
      <p class="dust-gain">${icon('sparkle')} ${L(`+${run.dust} hvězdného prachu`, `+${run.dust} Stardust`)} <small>${L('utrať ho v Hvězdném atlasu', 'spend it in the Star Atlas')}</small></p>
      ${(victory || run.won) && run.eclipse < MAX_ECLIPSE ? `<p class="unlock">${icon('moon')} ${L(`Odemčeno Zatmění ${run.eclipse + 1} pro hrdinu ${H.name}`, `Unlocked Eclipse ${run.eclipse + 1} for ${H.name}`)}</p>` : ''}
      ${newAch.length ? `<div class="over-ach">${newAch.map(a => `<span>${icon(a.icon)} ${a.name}</span>`).join('')}</div>` : ''}
      <div class="row-btns"><button class="btn primary" data-go="heroes">${L('Nový výstup', 'New Climb')}</button><button class="btn" data-go="atlas">${icon('sparkle')} ${L('Hvězdný atlas', 'Star Atlas')}</button><button class="btn" data-go="menu">Menu</button></div>
    </div>`;
  }

  // ── Menu a meta obrazovky ─────────────────────────────────────────────────
  const screens = {
    title() {
      $('#s-title').innerHTML = `<div class="title-wrap"><div class="logo">STARSPIRE</div><div class="sub">${L('Věž souhvězdí', 'The Constellation Tower')}</div><div class="press">${L('Klikni nebo stiskni klávesu', 'Click or press any key')}</div></div>`;
    },
    menu() {
      FX.setTheme(['#140c2a', '#05030c'], '#b99bff');
      Sound.music('menu');
      const S = SAVE.stats, hasRun = !!SAVE.run, G = SAVE.saga;
      $('#s-menu').innerHTML = `<div class="menu-art" id="menuArt"></div><div class="menu">
        <div class="menu-left">
          <div class="logo">STARSPIRE</div><div class="sub">${L('Věž souhvězdí', 'The Constellation Tower')}</div>
          <nav>
            ${hasRun ? `<button class="mi primary" data-act="continue">${icon('play')} ${L('Pokračovat ve výstupu', 'Continue Climb')}<small>${HEROES[SAVE.run.hero].name} · ${SAVE.run.loop ? `${icon('spiral')} ${SAVE.run.loop} · ` : ''}${L('Akt', 'Act')} ${Math.max(0, SAVE.run.act) + 1}</small></button>` : ''}
            ${G ? `<button class="mi ${hasRun ? '' : 'primary'}" data-act="continueSaga">${icon('book')} ${L('Pokračovat v sáze', 'Continue Saga')}<small>${HEROES[G.hero].name} · ${L('Úroveň', 'Level')} ${(G.level || 0) + 1} · ${L('Akt', 'Act')} ${Math.max(0, G.act) + 1}</small></button>` : ''}
            <button class="mi ${hasRun || G ? '' : 'primary'}" data-go="heroes">${icon('star')} ${L('Nový výstup', 'New Climb')}</button>
            <button class="mi" data-go="atlas">${icon('sparkle')} ${L('Hvězdný atlas', 'Star Atlas')}<small>${icon('sparkle')} ${fmtNum(SAVE.dust || 0)}${ATLAS.some(p => perk(p.id) < p.cost.length && SAVE.dust >= p.cost[perk(p.id)]) ? ` · ${L('můžeš vylepšit', 'upgrade ready')}` : ''}</small></button>
            <button class="mi" data-go="codex">${icon('book')} ${L('Kodex', 'Codex')}</button>
            <button class="mi" data-go="ach">${icon('trophy')} ${L('Úspěchy', 'Achievements')}<small>${Object.keys(SAVE.achievements).length} / ${ACHIEVEMENTS.length}</small></button>
            <button class="mi" data-go="settings">${icon('gear')} ${L('Nastavení', 'Settings')}</button>
            <button class="mi" data-act="hub">${icon('home')} Game Center</button>
          </nav>
        </div>
        <aside class="profile">
          <h4>${L('HVĚZDNÝ DENÍK', 'STAR JOURNAL')}</h4>
          <div class="kv">
            <span>${L('Vítězství', 'Victories')}</span><b>${S.victories}</b>
            <span>${L('Výstupy', 'Climbs')}</span><b>${S.runs}</b>
            <span>${L('Nejvyšší patro', 'Highest floor')}</span><b>${S.bestFloor}</b>
            <span>${L('Nejvyšší zatmění', 'Highest Eclipse')}</span><b>${S.maxEclipseWin}</b>
            ${S.sagaBest ? `<span>${L('Úrovně Ságy', 'Saga levels')}</span><b>${S.sagaBest}</b>` : ''}
            ${S.bestLoop > 1 ? `<span>${L('Okruhy Nekonečné věže', 'Endless Spire loops')}</span><b>${S.bestLoop - 1}</b>` : ''}
            <span>${L('Poražení nepřátelé', 'Enemies defeated')}</span><b>${fmtNum(S.kills)}</b>
            <span>${L('Objevené karty', 'Cards discovered')}</span><b>${Object.keys(SAVE.seen).length} / ${CARD_LIST.filter(c => c.cls !== 'status' && c.cls !== 'token').length}</b>
          </div>
        </aside>
      </div>`;
      FX.setActor('menu', { el: $('#menuArt'), tpl: 'humanoid', opts: { crown: 1, wings: 1, staff: 1 }, color: '#ffd98a', seed: 5, dir: 1, alpha: 0, max: 0.4, dead: false });
    },
    heroes() {
      FX.setTheme(['#140c2a', '#05030c'], '#b99bff');
      const hero = heroUnlocked(SAVE.lastHero) ? SAVE.lastHero : 'knight';
      UI.heroSel = UI.heroSel && heroUnlocked(UI.heroSel) ? UI.heroSel : hero;
      const h = UI.heroSel, H = HEROES[h];
      const maxE = SAVE.eclipse[h] || 0;
      UI.ecl = clamp(UI.ecl === undefined ? maxE : UI.ecl, 0, maxE);
      $('#s-heroes').innerHTML = `<div class="heroes">
        <div class="top-row"><button class="back" data-go="menu">←</button><h2>${L('Vyber hrdinu', 'Choose Your Hero')}</h2></div>
        <div class="hero-cards">${Object.keys(HEROES).map(k => {
          const X = HEROES[k], un = heroUnlocked(k), ach = X.unlock && ACHIEVEMENTS.find(a => a.id === X.unlock);
          return `<button class="hero-card ${k === h ? 'sel' : ''} ${un ? '' : 'locked'}" data-hero="${k}" style="--hc:${X.color}">
            <canvas width="320" height="320" data-heroart="${k}"></canvas>
            <b>${un ? X.name : '???'}</b><small>${un ? X.title : `${icon('lock')} ${ach.desc}`}</small>
            ${SAVE.heroWins[k] ? `<i class="wins">${icon('trophy')} ${SAVE.heroWins[k]}</i>` : ''}
          </button>`;
        }).join('')}</div>
        <div class="hero-info" style="--hc:${H.color}">
          <p>${H.desc}</p>
          <div class="hi-row"><span>${icon('heart')} ${H.hp} ${L('životů', 'HP')}</span><span>${icon('coin')} ${H.gold} ${L('zlata', 'Gold')}</span><span>${relicHTML(H.relic)} ${RELICS[H.relic].name}</span></div>
          <div class="modes"><button class="${UI.mode !== 'saga' ? 'on' : ''}" data-mode="climb">${icon('star')} ${L('Výstup', 'Climb')}</button><button class="${UI.mode === 'saga' ? 'on' : ''}" data-mode="saga">${icon('book')} ${L('Sága', 'Saga')}</button></div>
          ${UI.mode === 'saga' ? `<div class="saga-info">${L('Projdi úrovně Zatmění 0 až 10 (a dál) <b>jedním balíčkem</b>. Po každé úrovni si necháš karty, relikvie, lektvary i zlato a věž se postaví znovu, těžší. Když padneš, můžeš úroveň zkusit znovu.', 'Climb Eclipse levels 0 to 10 (and beyond) with <b>one deck</b>. After each level you keep your cards, relics, potions and gold, and the spire rebuilds itself, harder. If you fall, you can retry the level.')}${SAVE.stats.sagaBest ? `<small>${L('Nejvíc dokončených úrovní', 'Most levels completed')}: ${SAVE.stats.sagaBest}</small>` : ''}</div>` : `
          <div class="eclipse">
            <button data-ecl="-1" ${UI.ecl <= 0 ? 'disabled' : ''}>−</button>
            <div><b>${icon('moon')} ${L('Zatmění', 'Eclipse')} ${UI.ecl}</b><small>${UI.ecl ? ECLIPSE.slice(0, UI.ecl).map((t, i) => `${i + 1}. ${t}`).join('<br>') : maxE ? L('Bez modifikátorů', 'No modifiers') : L('Vyhraj s tímto hrdinou k odemčení', 'Win with this hero to unlock')}</small></div>
            <button data-ecl="1" ${UI.ecl >= maxE ? 'disabled' : ''}>+</button>
          </div>`}
          ${(UI.mode === 'saga' ? SAVE.saga : SAVE.run) ? `<p class="warn">${UI.mode === 'saga' ? L('Rozehraná sága bude přepsána.', 'Your current saga will be abandoned.') : L('Rozehraný výstup bude přepsán.', 'Your current climb will be abandoned.')}</p>` : ''}
          <button class="btn primary big" data-act="startRun">${icon(UI.mode === 'saga' ? 'book' : 'star')} ${UI.mode === 'saga' ? L('Začít ságu', 'Begin the Saga') : L('Začít výstup', 'Begin the Climb')}</button>
        </div>
      </div>`;
      $$('[data-heroart]').forEach(c => { const k = c.dataset.heroart; FX.miniArt(c, HERO_ART[k][0], HERO_ART[k][1], heroUnlocked(k) ? HEROES[k].color : '#3a3550'); });
    },
    atlas() {
      FX.setTheme(['#140c2a', '#05030c'], '#b99bff');
      const n = atlasCount(SAVE);
      $('#s-atlas').innerHTML = `<div class="meta"><div class="top-row"><button class="back" data-go="menu">←</button><h2>${L('Hvězdný atlas', 'Star Atlas')} <small>${n} / ${ATLAS_MAX}</small></h2></div>
        <p class="atlas-intro">${L('Každý výstup ti vynese <b>hvězdný prach</b>: za patra, elity, bosse a vítězství, víc na vyšším Zatmění. Vylepšení platí pro všechny hrdiny a všechny další výstupy.', 'Every climb earns you <b>Stardust</b>: for floors, elites, bosses and victory, more on higher Eclipse. Upgrades apply to every hero and every future climb.')}</p>
        <div class="dust-bank">${icon('sparkle')} <b>${fmtNum(SAVE.dust || 0)}</b> <span>${L('hvězdného prachu', 'Stardust')}</span></div>
        <div class="atlas-grid">${ATLAS.map(p => {
          const lv = perk(p.id), max = p.cost.length, next = lv < max ? p.cost[lv] : 0, can = lv < max && SAVE.dust >= next;
          return `<div class="perk ${lv ? 'has' : ''} ${lv >= max ? 'max' : ''}" style="--pc:${p.color}">
            <div class="perk-ico">${icon(p.icon)}</div>
            <div class="perk-body"><b>${p.name}</b><span>${p.desc(Math.max(1, lv))}</span>
              <i class="pips">${p.cost.map((_, i) => `<u class="${i < lv ? 'on' : ''}"></u>`).join('')}</i></div>
            ${lv >= max ? `<em class="perk-max">${L('Hotovo', 'Done')}</em>` : `<button class="btn ${can ? 'primary' : ''}" data-perk="${p.id}" ${can ? '' : 'disabled'}>${icon('sparkle')} ${next}</button>`}
          </div>`;
        }).join('')}</div></div>`;
    },
    codex() {
      UI.cxTab = UI.cxTab || 'knight';
      const tabs = [['knight', HEROES.knight.name], ['mage', HEROES.mage.name], ['rogue', HEROES.rogue.name], ['neutral', L('Bezbarvé', 'Colorless')], ['relics', L('Relikvie', 'Relics')], ['enemies', L('Bestiář', 'Bestiary')]];
      let body;
      if (UI.cxTab === 'relics') body = `<div class="relic-grid">${RELIC_LIST.map(r => `<div class="relic-card">${relicHTML(r.id)}<div><b>${r.name}</b><span>${r.desc}</span></div></div>`).join('')}</div>`;
      else if (UI.cxTab === 'enemies') body = `<div class="relic-grid">${Object.entries(ENEMIES).map(([k, e]) => `<div class="relic-card"><canvas width="120" height="120" data-enart="${k}"></canvas><div><b>${e.name}</b><span>${e.boss ? 'Boss' : e.elite ? L('Elita', 'Elite') : L('Běžný', 'Normal')} · ${e.hp[0]}${e.hp[1] !== e.hp[0] ? '–' + e.hp[1] : ''} ${L('životů', 'HP')}</span></div></div>`).join('')}</div>`;
      else body = `<div class="card-grid">${CARD_LIST.filter(c => c.cls === UI.cxTab).map(c => SAVE.seen[c.id] ? cardHTML({ id: c.id, up: false }) : `<div class="card unknown">${icon('question')}</div>`).join('')}</div>`;
      $('#s-codex').innerHTML = `<div class="meta"><div class="top-row"><button class="back" data-go="menu">←</button><h2>${L('Kodex', 'Codex')}</h2></div>
        <div class="tabs">${tabs.map(([k, n]) => `<button class="${k === UI.cxTab ? 'on' : ''}" data-cx="${k}">${n}</button>`).join('')}</div>${body}</div>`;
      $$('[data-enart]').forEach(c => { const a = ENEMIES[c.dataset.enart].art; FX.miniArt(c, a[0], a[3], a[1]); });
    },
    ach() {
      $('#s-ach').innerHTML = `<div class="meta"><div class="top-row"><button class="back" data-go="menu">←</button><h2>${L('Úspěchy', 'Achievements')} <small>${Object.keys(SAVE.achievements).length} / ${ACHIEVEMENTS.length}</small></h2></div>
        <div class="ach-grid">${ACHIEVEMENTS.map(a => { const got = SAVE.achievements[a.id], [v, m] = a.prog(SAVE); return `<div class="ach ${got ? 'got' : ''}">${icon(a.icon)}<div><b>${a.name}</b><span>${a.desc}</span><i><u style="width:${Math.min(100, v / m * 100)}%"></u></i></div></div>`; }).join('')}</div></div>`;
    },
    settings() {
      const s = SAVE.settings;
      $('#s-settings').innerHTML = `<div class="meta narrow"><div class="top-row"><button class="back" data-go="menu">←</button><h2>${L('Nastavení', 'Settings')}</h2></div>
        <div class="set-row"><label>${L('Jazyk', 'Language')}</label><div class="lang">${['cs', 'en'].map(l => `<button class="${l === LANG ? 'on' : ''}" data-lang="${l}">${l.toUpperCase()}</button>`).join('')}</div></div>
        <div class="set-row"><label>${L('Efekty', 'Effects')}</label><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-vol="sfx"></div>
        <div class="set-row"><label>${L('Hudba', 'Music')}</label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-vol="music"></div>
        ${window.GCMusic ? `<div class="set-row"><label>${L('Vlastní playlist', 'Your playlist')}</label><button class="btn" data-act="musicSettings">${L('Nastavit hudbu', 'Music settings')}</button></div>` : ''}
        <div class="set-row"><label>${L('Rychlé animace', 'Fast animations')}</label><button class="toggle ${s.fast ? 'on' : ''}" data-act="toggleFast"></button></div>
        <div class="keys"><span><kbd>1</kbd>–<kbd>0</kbd></span><span>${L('Vybrat kartu (podruhé zahrát)', 'Select a card (again to play)')}</span><span><kbd>←</kbd><kbd>→</kbd></span><span>${L('Změnit cíl', 'Change target')}</span><span><kbd>E</kbd></span><span>${L('Ukončit kolo', 'End turn')}</span><span><kbd>Esc</kbd></span><span>${L('Zrušit / menu', 'Cancel / menu')}</span><span>${L('Myš', 'Mouse')}</span><span>${L('Přetáhni kartu na nepřítele, nebo nahoru pro zahrání', 'Drag a card onto an enemy, or upward to play it')}</span></div>
        <div class="set-row"><label>${L('Smazat veškerý postup', 'Erase all progress')}</label><button class="btn danger" data-act="wipe">${L('Smazat', 'Erase')}</button></div></div>`;
    },
  };
  function go(id) { show(id); if (screens[id]) screens[id](); }

  function pauseMenu() {
    modal(`<div class="panel pause"><h2>${L('Pauza', 'Paused')}</h2>
      <div class="set-row"><label>${L('Efekty', 'Effects')}</label><input type="range" min="0" max="1" step="0.05" value="${SAVE.settings.sfx}" data-vol="sfx"></div>
      <div class="set-row"><label>${L('Hudba', 'Music')}</label><input type="range" min="0" max="1" step="0.05" value="${SAVE.settings.music}" data-vol="music"></div>
      <p class="muted">${screen === 'battle' ? L('Výstup se uloží. Rozehraný souboj začne po návratu znovu.', 'Your climb is saved. The current fight will restart when you return.') : L('Výstup se uloží.', 'Your climb is saved.')}</p>
      <div class="row-btns"><button class="btn primary" data-act="closeModal">${L('Pokračovat', 'Resume')}</button><button class="btn" data-act="saveQuit">${L('Uložit a odejít', 'Save & Quit')}</button><button class="btn danger" data-act="abandon">${Run.isSaga() ? L('Ukončit ságu', 'End the Saga') : L('Vzdát výstup', 'Abandon Climb')}</button></div></div>`);
  }

  // ── Události myši/kláves ──────────────────────────────────────────────────
  const acts = {
    deck: () => showDeck(R.deck, L('Balíček', 'Deck')),
    map: () => { if (screen === 'map') return; closeModal(); UI._back = screen; renderMap(true); },
    closeMap: () => { const s = UI._back; UI._back = null; show(s); renderTop(); if (s === 'battle') startBattleView(); },
    pause: () => pauseMenu(),
    closeModal: () => closeModal(),
    'pile-draw': () => showDeck(shuffle(B.draw.slice()), L('Dobírací balíček', 'Draw Pile')),
    'pile-discard': () => showDeck(B.discard, L('Odhazovací balíček', 'Discard Pile')),
    endTurn: () => { if (B && !B.busy) { sel = null; FX.setArrow(null); Battle.endTurn(); renderBattle(); } },
    rwDone: () => rewardsDone(),
    skipCard: () => { const m = $('#modal'); if (m._skip) m._skip(); },
    skipBossRelic: () => takeBossRelic(null),
    summitGo: () => { closeModal(); R.summitSeen = true; Run.save(); omenChoice(); },
    summitEnd: () => { closeModal(); gameOver(true); },
    restHeal: () => { const heal = Run.restAmount(); Run.heal(heal); renderRest(L(`Odpočinul sis a vyléčil ${heal} životů.`, `You rest and heal ${heal} HP.`)); },
    restSmith: () => pickCard(R.deck.filter(c => !c.up && CARDS[c.id].up), L('Vylepšit kartu', 'Upgrade a card'), (i, list) => { Run.upgradeCard(list[i]); Sound.play.upgrade(); renderRest(L(`Vykoval jsi ${CARDS[list[i].id].name}+.`, `You forged ${CARDS[list[i].id].name}+.`)); }, true),
    leave: () => leaveNode(),
    openChest: () => openChest(),
    continue: () => { Run.resume('climb'); resumeRun(); },
    continueSaga: () => { Run.resume('saga'); resumeRun(); },
    startRun: () => { Sound.init(); Run.start(UI.heroSel, UI.ecl, UI.mode); Sound.play.start(); renderMap(); banner(ACTS[0].name, Run.isSaga() ? L('Sága · Úroveň 1', 'Saga · Level 1') : L('Akt 1', 'Act 1'), 'turn'); },
    sagaGo: () => { closeModal(); banner(L(`Úroveň ${R.level + 1}`, `Level ${R.level + 1}`), `${L('Zatmění', 'Eclipse')} ${R.eclipse}`, 'boss'); renderMap(); },
    sagaRetry: () => { Run.retryLevel(); Sound.play.start(); renderMap(); banner(L(`Úroveň ${R.level + 1}`, `Level ${R.level + 1}`), L('Nový pokus', 'Another try'), 'turn'); },
    sagaEnd: () => gameOver(false, true),
    hub: () => { persist(); location.href = '../../index.html'; },
    musicSettings: () => window.GCMusic.open(),
    toggleFast: () => { SAVE.settings.fast = !SAVE.settings.fast; persist(); go('settings'); },
    wipe: () => modal(`<div class="panel"><h2>${L('Smazat veškerý postup?', 'Erase all progress?')}</h2><p class="muted">${L('Tohle nejde vrátit.', 'This cannot be undone.')}</p><div class="row-btns"><button class="btn danger" data-act="wipeYes">${L('Smazat', 'Erase')}</button><button class="btn" data-act="closeModal">${L('Zrušit', 'Cancel')}</button></div></div>`),
    wipeYes: () => { const st = SAVE.settings; SAVE = defaultSave(); SAVE.settings = st; persist(); closeModal(); go('menu'); },
    saveQuit: () => { closeModal(); Run.save(); R = null; B = null; go('menu'); },
    abandon: () => { closeModal(); if (B) B.over = true; gameOver(false, true); },
  };
  function startBattleView() {
    renderEnemies(); renderHand();
    FX.setActor('hero', { el: $('#heroBox'), tpl: HERO_ART[R.hero][0], opts: HERO_ART[R.hero][1], color: HEROES[R.hero].color, seed: 1, dir: 1 });
  }
  function resumeRun() {
    Sound.init();
    if (R.node === 'fallen') sagaFall();
    else if (R.node === 'summit') summit();
    else if (R.node && R.node !== 'treasure') {
      const node = R.row >= R.map.rows.length ? R.map.boss : R.map.rows[R.row][R.col];
      enterNode(node);
    } else if (R.node === 'treasure') renderTreasure();
    else renderMap();
  }

  function init() {
    Bus.on(onBus);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-go],[data-act],[data-node],[data-hero],[data-mode],[data-ecl],[data-cx],[data-lang],[data-rw],[data-pickreward],[data-pickdeck],[data-bossrelic],[data-omen],[data-perk],[data-buy],[data-evopt],[data-potion],.enemy');
      if (!t) {
        if (screen === 'battle' && sel && !e.target.closest('#hand') && B.hand[sel.i] && CARDS[B.hand[sel.i].id].target !== 'enemy' && e.target.closest('#stage')) playSel();
        return;
      }
      const ds = t.dataset;
      if (ds.go) { Sound.play.click(); go(ds.go); }
      else if (ds.act) { if (acts[ds.act]) { Sound.play.click(); acts[ds.act](); } }
      else if (ds.node) chooseNode(ds.node);
      else if (ds.hero) { if (!heroUnlocked(ds.hero)) { Sound.play.error(); return; } UI.heroSel = ds.hero; UI.ecl = undefined; Sound.play.click(); go('heroes'); }
      else if (ds.mode) { UI.mode = ds.mode; Sound.play.click(); go('heroes'); }
      else if (ds.ecl) { UI.ecl += +ds.ecl; Sound.play.click(); go('heroes'); }
      else if (ds.cx) { UI.cxTab = ds.cx; Sound.play.click(); go('codex'); }
      else if (ds.lang) { persist(); setLang(ds.lang); }
      else if (ds.rw) takeReward(ds.rw);
      else if (ds.pickreward !== undefined) $('#modal')._pick(+ds.pickreward);
      else if (ds.pickdeck !== undefined) $('#modal')._pickDeck(+ds.pickdeck);
      else if (ds.bossrelic) takeBossRelic(ds.bossrelic);
      else if (ds.omen) takeOmen(ds.omen);
      else if (ds.perk) { if (Run.buyPerk(ds.perk)) { Sound.play.relic(); go('atlas'); } else Sound.play.error(); }
      else if (ds.buy) buy(ds.buy);
      else if (ds.evopt !== undefined) eventChoice(+ds.evopt);
      else if (ds.potion !== undefined) usePotionUI(+ds.potion);
      else if (t.classList.contains('enemy') && screen === 'battle') {
        const e = B.enemies[+ds.enemy];
        if (UI.potionTarget !== undefined) { const pi = UI.potionTarget; UI.potionTarget = undefined; $('#stage').classList.remove('aiming'); if (Battle.usePotion(pi, e)) Sound.play.buff(); return; }
        if (sel && B.hand[sel.i] && CARDS[B.hand[sel.i].id].target === 'enemy' && e && !e.dead) playSel(e);
        else if (sel && B.hand[sel.i] && CARDS[B.hand[sel.i].id].target !== 'enemy') playSel();
      }
    });
    document.addEventListener('input', e => {
      const v = e.target.dataset && e.target.dataset.vol;
      if (v) { SAVE.settings[v] = +e.target.value; Sound.setVolume(v, +e.target.value); persist(); }
    });
    document.addEventListener('keydown', onKey);
    // nápovědy
    const tip = $('#tip');
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('[data-tip],[data-tip-title],.kw');
      if (e.target.closest('button') && !e.target.closest('#hand')) Sound.play.hover();
      if (!t) { tip.hidden = true; return; }
      let title = t.dataset.tipTitle || '', body = t.dataset.tip || '';
      if (t.classList.contains('kw') && t.dataset.st) { title = STATUS[t.dataset.st].name; body = STATUS[t.dataset.st].desc('X'); }
      tip.innerHTML = `${title ? `<b>${title}</b>` : ''}${body ? `<span>${body}</span>` : ''}`;
      tip.hidden = false;
    });
    document.addEventListener('pointermove', e => {
      const tip = $('#tip');
      if (tip.hidden) return;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.min(innerWidth - w - 10, e.clientX + 16) + 'px';
      tip.style.top = (e.clientY + h + 24 > innerHeight ? e.clientY - h - 12 : e.clientY + 18) + 'px';
    });
  }
  function usePotionUI(i) {
    if (screen !== 'battle' || !B || B.busy) { Sound.play.error(); return; }
    const id = R.potions[i];
    if (!id) return;
    if (POTIONS[id].target === 'enemy') {
      const alive = Battle.alive();
      if (alive.length === 1) { Battle.usePotion(i, alive[0]); Sound.play.buff(); return; }
      UI.potionTarget = i; $('#stage').classList.add('aiming'); banner(L('Vyber cíl lektvaru', 'Choose a target'), '', 'turn'); return;
    }
    Battle.usePotion(i); Sound.play.buff();
  }
  function onKey(e) {
    if (screen === 'title') { enterMenu(); return; }
    if (e.key === 'Escape') {
      if (!$('#modal').hidden) { const m = $('#modal'); if (m.classList.contains('m-pick') || m.classList.contains('m-rewards') || m.classList.contains('m-summit')) return; closeModal(); return; }
      if (sel) { sel = null; FX.setArrow(null); renderHand(); return; }
      if (['map', 'battle', 'rest', 'shop', 'event', 'treasure'].includes(screen)) { pauseMenu(); return; }
      if (screen !== 'menu') go('menu');
      return;
    }
    if (screen !== 'battle' || !B || !$('#modal').hidden) return;
    if (e.key === 'e' || e.key === 'E') { acts.endTurn(); return; }
    const n = '1234567890'.indexOf(e.key);
    if (n >= 0 && n < B.hand.length) { selectCard(n); return; }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && sel) {
      const alive = B.enemies.map((x, i) => x.dead ? -1 : i).filter(i => i >= 0);
      const k = alive.indexOf(targetIdx);
      targetIdx = alive[(k + (e.key === 'ArrowRight' ? 1 : -1) + alive.length) % alive.length];
      renderHand();
    }
    if (e.key === 'Enter' && sel) { const c = B.hand[sel.i]; if (CARDS[c.id].target === 'enemy') playSel(B.enemies[targetIdx]); else playSel(); }
  }
  function enterMenu() { Sound.init(); Sound.setVolume('sfx', SAVE.settings.sfx); Sound.setVolume('music', SAVE.settings.music); Sound.play.start(); go('menu'); }

  return { init, go, enterMenu, pickCard, cardReward, renderTop, get screen() { return screen; }, heroSel: null, ecl: undefined, mode: 'climb', cxTab: null };
})();
