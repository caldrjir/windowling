'use strict';
// ── ZLATOKOP · Windowling Hlavolamy ─────────────────────────────────────────
// Na motivy klasického Gold Mineru: drapák na laně se kývá sem a tam, klepnutím ho spustíš
// a navijákem vytáhneš, co chytí. Těžké hroudy se táhnou pomalu, kameny skoro nic nevynesou,
// diamanty jsou malé a drahé, pytle jsou překvapení a TNT vybuchne. Každý důl má minutu a cíl
// peněz; mezi doly se nakupuje v obchodě. Rozložení dolu se bere ze semínka, takže denní výzva
// je pro všechny stejná.
const Zlatokop = (() => {
  const L = Kit.L, rngOf = ZkArt.rngOf, SURF = ZkArt.SURF;
  const VW = 640, VH = 420, PX = 320, PY = 82, L0 = 22, LEVEL_TIME = 60;
  const DIFFS = [
    { id: 'klasik', name: L('Klasika', 'Classic'), note: L('důl za dolem s obchodem', 'mine after mine, with a shop'), metric: 'score' },
    { id: 'spech', name: L('Zlatá horečka', 'Gold rush'), note: L('jeden bohatý důl, minuta', 'one rich mine, one minute'), metric: 'score' },
  ];
  // druhy předmětů: velikost, cena, váha (čím těžší, tím pomaleji se táhne)
  const KIND = {
    g1: { type: 'gold', r: 11, val: 50, w: 1.3 }, g2: { type: 'gold', r: 18, val: 100, w: 2.1 }, g3: { type: 'gold', r: 27, val: 250, w: 3.4 }, g4: { type: 'gold', r: 38, val: 500, w: 5.5 },
    s1: { type: 'stone', r: 14, val: 11, w: 2.6 }, s2: { type: 'stone', r: 24, val: 20, w: 5.2 },
    dia: { type: 'diamond', r: 9, val: 600, w: 1 }, bag: { type: 'bag', r: 15, val: 0, w: 1.6 },
    mole: { type: 'mole', r: 13, val: 2, w: 1 }, moleD: { type: 'mole', r: 13, val: 2, w: 1.1, diamond: true },
    tnt: { type: 'tnt', r: 14, val: 0, w: 1 }, skull: { type: 'skull', r: 12, val: 20, w: 1.5 }, bone: { type: 'bone', r: 12, val: 7, w: 1.3 },
  };
  const SHOP = {
    dyn: { icon: '🧨', name: L('Dynamit', 'Dynamite'), desc: L('↑ odpálí, co táhneš', '↑ blows up what you pull') },
    str: { icon: '🥤', name: L('Silový nápoj', 'Strength drink'), desc: L('rychlejší navíjení v dalším dole', 'faster winding next mine') },
    clover: { icon: '🍀', name: L('Čtyřlístek', 'Lucky clover'), desc: L('bohatší pytle', 'richer bags') },
    book: { icon: '📖', name: L('Kniha kamenů', 'Rock book'), desc: L('kameny mají trojnásobnou cenu', 'rocks are worth triple') },
    polish: { icon: '💎', name: L('Leštidlo', 'Diamond polish'), desc: L('diamanty o 300 dražší', 'diamonds +300') },
  };
  // cíl klasiky: 650, 1195, 2010, 3095, … (jako v originálu, peníze se sčítají)
  function targetOf(lv) { let t = 650; for (let k = 2; k <= lv; k++) t += 545 + 270 * (k - 2); return t; }
  function levelSpec(n) { return { tier: Math.min(10, 1 + Math.floor((n - 1) / 3)), target: Math.min(1600, 450 + (n - 1) * 25), text: L(`Důl ${n}`, `Mine ${n}`) }; }
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') { const s = levelSpec(ctx.key); return { seed, mode: 'level', tier: s.tier, target: s.target, text: s.text }; }
    if (ctx.kind === 'daily') return { seed, mode: 'klasik', text: L('Denní důl', 'Daily mine') };
    return { seed, mode: diffId === 'spech' ? 'spech' : 'klasik' };
  }

  // rozložení dolu: deterministické ze semínka a pořadí dolu
  function layout(seed, tier, need) {
    const r = rngOf(seed), ri = n => Math.floor(r() * n), out = [];
    const counts = {
      g1: 3 + ri(3), g2: 2 + ri(3), g3: 1 + ri(2) + (tier >= 3 ? 1 : 0), g4: (tier >= 2 ? 1 : r() < 0.4 ? 1 : 0) + (tier >= 5 && r() < 0.6 ? 1 : 0),
      s1: 2 + ri(2) + Math.min(3, tier >> 1), s2: 1 + ri(2) + Math.min(3, tier >> 1), dia: tier >= 3 ? ri(2) + (tier >= 6 ? 1 : 0) : 0,
      bag: 1 + ri(2), mole: tier >= 2 ? ri(3) : 0, moleD: tier >= 4 ? ri(2) : 0, tnt: tier >= 3 ? ri(2) + (tier >= 6 ? 1 : 0) : 0, skull: r() < 0.5 ? 1 : 0, bone: ri(2),
    };
    const place = k => {
      const K = KIND[k], deep = k === 'g4' || k === 'dia' || k === 'moleD', shallow = k === 'g1' || k === 'bone';
      const y0 = deep ? 250 : SURF + 46, y1 = shallow ? 300 : VH - K.r - 10;
      for (let a = 0; a < 90; a++) {
        const x = K.r + 18 + r() * (VW - 2 * K.r - 36), y = y0 + r() * (y1 - y0);
        if (Math.abs(x - PX) < 40 && y < 150) continue;
        if (K.type !== 'mole' && out.some(o => o.type !== 'mole' && Math.hypot(o.x - x, o.y - y) < o.r + K.r + 8)) continue;
        if (K.type === 'mole' && out.some(o => o.type === 'mole' && Math.abs(o.y - y) < 30)) continue;
        const it = { k, type: K.type, x, y, r: K.r, val: K.val, w: K.w, diamond: !!K.diamond, shape: ZkArt.blob(r), ph: r() * 6, roll: r(), roll2: r() };
        if (K.type === 'mole') { it.dir = r() < 0.5 ? -1 : 1; it.sp = 38 + r() * 34; it.x0 = Math.max(30, x - 120 - r() * 80); it.x1 = Math.min(VW - 30, x + 120 + r() * 80); it.rest = 0; }
        out.push(it); return true;
      }
      return false;
    };
    for (const k of ['g4', 'dia', 'moleD', 'g3', 's2', 'tnt', 'g2', 'bag', 's1', 'g1', 'mole', 'skull', 'bone']) for (let i = 0; i < counts[k]; i++) place(k);
    // pojistka: v dole musí být dost peněz na cíl
    const worth = () => out.reduce((a, o) => a + (o.type === 'gold' ? o.val : o.type === 'diamond' || o.diamond ? 600 : 0), 0);
    for (let i = 0; i < 12 && worth() < need * 1.5; i++) place(i % 3 ? 'g2' : 'g3');
    return out;
  }

  function create(el, P, saved, api) {
    const classic = P.mode === 'klasik';
    el.innerHTML = `<div class="zk-wrap">
      <div class="zk-stage"><canvas class="zk-cv"></canvas><div class="zk-msg" hidden></div><div class="zk-shop" hidden></div></div>
      <div class="zk-pad">
        <button class="zk-btn dyn" data-b="dyn">🧨<small>${L('dynamit', 'dynamite')} <b class="zk-dn">0</b></small></button>
        <button class="zk-btn go" data-b="go">${L('SPUSTIT', 'DROP')}<small>${L('drapák', 'the claw')}</small></button>
      </div>
      <p class="zk-keys">${L('Klávesy: mezerník nebo ↓ spustí drapák, ↑ odpálí dynamit, P pauza', 'Keys: Space or ↓ drops the claw, ↑ throws dynamite, P pauses')}</p></div>`;
    const cv = el.querySelector('.zk-cv'), ctx = cv.getContext('2d'), msgEl = el.querySelector('.zk-msg'), shopEl = el.querySelector('.zk-shop');
    let cssW = 640, cssH = 420, dpr = 1;
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      cssW = Math.floor(Math.min(box - 2, 900)); cssH = Math.round(cssW * VH / VW);
      const maxH = innerHeight - (innerWidth < 760 ? 250 : 200);
      if (cssH > maxH) { cssH = Math.max(220, maxH); cssW = Math.round(cssH * VW / VH); }
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = cssW * dpr; cv.height = cssH * dpr; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    }

    // ── Stav ──
    let lv = saved && saved.lv ? saved.lv : 1, money = saved ? saved.money || 0 : 0, levelMoney = 0;
    const inv = Object.assign({ dyn: 0, str: 0, clover: 0, book: 0, polish: 0 }, saved && saved.inv);
    let items = [], bg = null, target = 0, time = LEVEL_TIME, phase = 'play', over = false, paused = false, clock = 0, speed = 1, done = 0;
    const hook = { ang: 0, len: L0, st: 'swing', item: null, sw: 0, crank: 0, coil: 0 };
    const fx = [], texts = [], fxr = rngOf(P.seed ^ 0x77);
    let shake = 0, banner = null;
    function startLevel() {
      const tier = P.mode === 'level' ? P.tier : P.mode === 'spech' ? 6 : Math.min(12, lv);
      target = P.mode === 'level' ? P.target : classic ? targetOf(lv) : 0;
      const need = classic ? target - money : P.mode === 'level' ? target : 2600;
      items = layout((P.seed + lv * 7919) >>> 0, tier, Math.max(400, need));
      bg = ZkArt.background(VW, VH, (P.seed + lv) >>> 0, tier);
      time = LEVEL_TIME; levelMoney = 0; phase = 'play'; Object.assign(hook, { ang: 0, len: L0, st: 'swing', item: null, sw: 0 });
      shopEl.hidden = true; api.setTimer(true);
      say(classic ? `${L('Důl', 'Mine')} ${lv} · ${L('cíl', 'target')} $${Kit.fmtNum(target)}` : P.mode === 'level' ? `${L('Cíl', 'Target')} $${Kit.fmtNum(target)}` : L('Zlatá horečka! Minuta na všechno.', 'Gold rush! One minute for it all.'), 2.2);
      syncPad(); api.changed();
    }
    function say(t, d = 1.6) { msgEl.textContent = t; msgEl.hidden = false; msgEl.dataset.t = d; }
    function syncPad() {
      el.querySelector('.zk-dn').textContent = inv.dyn; el.querySelector('[data-b="dyn"]').disabled = !inv.dyn || phase === 'shop';
      const go = el.querySelector('[data-b="go"]'); go.firstChild.textContent = phase === 'shop' ? L('DO DOLU ▶', 'NEXT ▶') : L('SPUSTIT', 'DROP'); go.lastChild.textContent = phase === 'shop' ? L('další důl', 'next mine') : L('drapák', 'the claw');
    }

    // ── Ovládání ──
    function drop() {
      if (over || paused || phase !== 'play' || hook.st !== 'swing') return;
      hook.st = 'out'; api.sound('tap');
    }
    function dynamite() {
      if (over || paused || phase !== 'play' || hook.st !== 'back' || !hook.item || !inv.dyn) return;
      inv.dyn--; syncPad();
      const tip = tipPos(); boom(tip[0], tip[1], 26); hook.item = null; api.sound('error'); api.changed();
    }
    function tipPos() { return [PX + Math.sin(hook.ang) * hook.len, PY + Math.cos(hook.ang) * hook.len]; }
    function boom(x, y, n) {
      shake = 0.35;
      for (let i = 0; i < n; i++) { const a = fxr() * Math.PI * 2, v = 60 + fxr() * 220; fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5 + fxr() * 0.6, c: ['#ffd23f', '#ff8a3d', '#ff4d2e', '#fff3c0', '#6b4a30'][Math.floor(fxr() * 5)], s: 2 + fxr() * 4 }); }
    }
    function float(text, col, x = PX - 120, y = PY - 34) { texts.push({ text, col, x, y, life: 1.4 }); }

    // ── Hodnota úlovku ──
    function cash(it) {
      let v = 0, note = '';
      if (it.type === 'gold') v = it.val;
      else if (it.type === 'stone') v = it.val * (inv.book ? 3 : 1);
      else if (it.type === 'diamond') v = 600 + (inv.polish ? 300 : 0);
      else if (it.type === 'mole') v = it.val + (it.diamond ? 600 + (inv.polish ? 300 : 0) : 0);
      else if (it.type === 'skull' || it.type === 'bone') v = it.val;
      else if (it.type === 'bag') {
        const luck = inv.clover ? 1.6 : 1;
        if (it.roll2 < 0.12) { inv.dyn++; syncPad(); note = L('+1 dynamit!', '+1 dynamite!'); }
        else if (it.roll2 < 0.2 && classic) { inv.str = 1; note = L('Síla! Rychlejší navíjení.', 'Strength! Faster winding.'); }
        else v = Math.round((40 + it.roll * it.roll * 560) * luck / 5) * 5;
      }
      if (v) { money += v; levelMoney += v; float(`+$${v}`, v >= 250 ? '#ffd23f' : v >= 50 ? '#fff3c0' : '#c9c4bd'); api.sound(v >= 500 ? 'win' : v >= 100 ? 'line' : 'place'); }
      if (note) { float(note, '#6dff9e'); api.sound('star'); }
      if (!v && !note) api.sound('soft');
      api.changed();
    }

    // ── Simulace ──
    function tick(dt) {
      clock += dt;
      if (+msgEl.dataset.t > 0) { msgEl.dataset.t = +msgEl.dataset.t - dt; if (+msgEl.dataset.t <= 0) msgEl.hidden = true; }
      for (const it of items) if (it.type === 'mole') {
        if (it.rest > 0) { it.rest -= dt; continue; }
        it.x += it.dir * it.sp * dt;
        if (it.x < it.x0 || it.x > it.x1) { it.dir *= -1; it.x = Math.max(it.x0, Math.min(it.x1, it.x)); if (fxr() < 0.4) it.rest = 0.6 + fxr(); }
      }
      if (phase !== 'play') return;
      time -= dt;
      if (hook.st === 'swing') { hook.sw += dt; hook.ang = Math.sin(hook.sw * 1.9) * 1.25; }
      else if (hook.st === 'out') {
        hook.len += 270 * dt;
        const [tx, ty] = tipPos();
        if (tx < 4 || tx > VW - 4 || ty > VH - 4) { hook.st = 'back'; api.sound('soft'); }
        else for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (Math.hypot(it.x - tx, it.y - ty) > it.r + 7) continue;
          items.splice(i, 1);
          if (it.type === 'tnt') {
            boom(it.x, it.y, 60); api.sound('error');
            for (let j = items.length - 1; j >= 0; j--) if (Math.hypot(items[j].x - it.x, items[j].y - it.y) < 95 + items[j].r) { boom(items[j].x, items[j].y, 10); items.splice(j, 1); }
            float(L('BUM!', 'BOOM!'), '#ff8a3d', it.x, it.y - 20);
          } else { hook.item = it; api.sound('place'); }
          hook.st = 'back'; break;
        }
      } else if (hook.st === 'back') {
        const it = hook.item, sp = it ? (40 + 210 / it.w) * (inv.str ? 1.6 : 1) : 430;
        hook.len -= sp * dt; hook.crank += sp * dt * 0.06; hook.coil += sp * dt * 0.05;
        if (it) { const [tx, ty] = tipPos(); it.x = tx + Math.sin(hook.ang) * it.r * 0.7; it.y = ty + Math.cos(hook.ang) * it.r * 0.7; }
        if (hook.len <= L0) { hook.len = L0; if (it) cash(it); hook.item = null; hook.st = 'swing'; }
      }
      const empty = !items.some(o => o.type !== 'tnt' && o.type !== 'stone') && hook.st === 'swing';
      if (time <= 0 || empty) endLevel();
    }
    function endLevel() {
      time = Math.max(0, time); api.setTimer(false);
      if (classic) {
        if (money >= target) {
          done = lv; phase = 'between'; banner = { text: L('Cíl splněn!', 'Target reached!'), sub: `$${Kit.fmtNum(money)}`, t: 1.8, next: openShop };
          api.sound('win'); api.burst && api.burst(innerWidth / 2, innerHeight / 3, 30);
        } else { phase = 'between'; banner = { text: L('Málo zlata…', 'Not enough gold…'), sub: `$${Kit.fmtNum(money)} / $${Kit.fmtNum(target)}`, t: 1.8, next: endGame }; api.sound('error'); }
      } else { phase = 'between'; banner = { text: L('Konec času!', 'Time is up!'), sub: `$${Kit.fmtNum(money)}`, t: 1.4, next: endGame }; }
    }
    // obchod mezi doly
    let offer = [];
    function openShop() {
      phase = 'shop';
      const r = rngOf((P.seed + lv * 31 + 7) >>> 0), ri = n => Math.floor(r() * n);
      const price = { dyn: 30 + ri(150) + lv * 12, str: 90 + ri(260), clover: 50 + ri(160) + lv * 10, book: 20 + ri(140), polish: 180 + ri(320) + lv * 20 };
      offer = Object.keys(SHOP).filter(() => r() < 0.65).map(k => ({ k, price: Math.round(price[k] / 5) * 5, sold: false }));
      if (!offer.length) offer.push({ k: 'dyn', price: 60, sold: false });
      inv.str = 0; inv.clover = 0; inv.book = 0; inv.polish = 0;
      renderShop(); syncPad();
    }
    function renderShop() {
      shopEl.hidden = false;
      shopEl.innerHTML = `<div class="zk-card"><h3>${L('Obchod u Starého Joea', "Old Joe's shop")}</h3><p class="zk-money">$${Kit.fmtNum(money)} · ${L('další cíl', 'next target')} $${Kit.fmtNum(targetOf(lv + 1))}</p>
        <div class="zk-offers">${offer.map((o, i) => `<button class="zk-offer${o.sold ? ' sold' : ''}" data-i="${i}" ${o.sold || money < o.price ? 'disabled' : ''}><span class="ic">${SHOP[o.k].icon}</span><b>${SHOP[o.k].name}</b><small>${SHOP[o.k].desc}</small><em>${o.sold ? L('koupeno', 'bought') : '$' + o.price}</em></button>`).join('')}</div>
        <button class="k-btn primary zk-next">${L('Do dalšího dolu', 'Next mine')} ▶</button></div>`;
    }
    shopEl.addEventListener('click', e => {
      const b = e.target.closest('.zk-offer');
      if (b && !b.disabled) { const o = offer[+b.dataset.i]; if (money < o.price || o.sold) return; money -= o.price; o.sold = true; if (o.k === 'dyn') inv.dyn++; else inv[o.k] = 1; api.sound('line'); syncPad(); renderShop(); return; }
      if (e.target.closest('.zk-next')) nextLevel();
    });
    function nextLevel() { if (phase !== 'shop') return; lv++; phase = 'play'; api.sound('ui'); startLevel(); }
    function endGame() {
      over = true; phase = 'over'; api.setTimer(false);
      if (P.mode === 'level') {
        if (money < target) { api.failed({ score: money, html: `<p class="k-muted">${L(`Cíl $${Kit.fmtNum(target)}`, `Target $${Kit.fmtNum(target)}`)}</p>` }); return; }
        const stars = money >= target * 1.7 ? 3 : money >= target * 1.35 ? 2 : 1;
        api.solved({ title: `$${Kit.fmtNum(money)}`, stars, score: money }); return;
      }
      if (classic) api.data.best = Math.max(api.data.best || 0, money), api.data.mines = Math.max(api.data.mines || 0, done);
      const stars = classic ? (done >= 6 ? 3 : done >= 3 ? 2 : 1) : money >= 2800 ? 3 : money >= 2000 ? 2 : 1;
      const html = classic ? `<p class="k-muted">${L(`Vytěžené doly: ${done}`, `Mines cleared: ${done}`)}</p>` : '';
      api.solved({ title: `$${Kit.fmtNum(money)}`, stars, score: money, html });
    }

    // ── Kresba ──
    function draw(dt) {
      const g = ctx, k = cssW / VW;
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      if (shake > 0) { shake -= dt; g.translate((fxr() - 0.5) * 8 * shake / 0.35, (fxr() - 0.5) * 8 * shake / 0.35); }
      g.drawImage(bg, 0, 0, VW, VH);
      for (const it of items) ZkArt.item(g, it, clock);
      // lano a drapák
      const [tx, ty] = tipPos();
      g.strokeStyle = '#2a160c'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(PX, PY - 8); g.lineTo(tx, ty); g.stroke();
      g.strokeStyle = '#d8c8a0'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(PX, PY - 8); g.lineTo(tx, ty); g.stroke();
      if (hook.item) ZkArt.item(g, hook.item, clock);
      ZkArt.claw(g, tx, ty, hook.ang, hook.item ? 0 : hook.st === 'out' ? 1 : 0.6);
      // povrch: naviják a zlatokop
      ZkArt.winch(g, PX, PY - 18, hook.crank, hook.coil);
      ZkArt.miner(g, PX + 50, SURF - 2, { crank: hook.crank, strain: hook.st === 'back' && hook.item ? Math.min(1, hook.item.w / 4) : 0, t: clock });
      // dynamity vedle zlatokopa
      for (let i = 0; i < Math.min(inv.dyn, 6); i++) { const x = PX + 82 + i * 9; g.fillStyle = '#d8342a'; g.strokeStyle = '#2a160c'; g.lineWidth = 1.4; g.beginPath(); g.roundRect(x, SURF - 22, 7, 18, 2); g.fill(); g.stroke(); g.strokeStyle = '#d8c8a0'; g.beginPath(); g.moveTo(x + 3.5, SURF - 22); g.lineTo(x + 5, SURF - 27); g.stroke(); }
      // částice výbuchů
      for (let i = fx.length - 1; i >= 0; i--) { const p = fx[i]; p.life -= dt; if (p.life <= 0) { fx.splice(i, 1); continue; } p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 7); g.fill(); g.globalAlpha = 1; }
      // HUD: peníze s cílem vlevo, čas a důl vpravo
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      g.fillStyle = 'rgba(42,22,12,.82)'; g.beginPath(); g.roundRect(10, 10, 196, target ? 58 : 40, 12); g.fill();
      g.fillStyle = '#ffd23f'; g.font = '900 22px Unbounded, sans-serif'; g.fillText(`$${Kit.fmtNum(money)}`, 22, 38);
      if (target) {
        g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '700 11px Space Grotesk, sans-serif'; g.fillText(`${L('cíl', 'target')} $${Kit.fmtNum(target)}`, 22, 56);
        g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(110, 49, 84, 8);
        g.fillStyle = money >= target ? '#6dff9e' : '#ffd23f'; g.fillRect(110, 49, 84 * Math.min(1, money / Math.max(1, target)), 8);
      }
      g.fillStyle = 'rgba(42,22,12,.82)'; g.beginPath(); g.roundRect(VW - 136, 10, 126, 58, 12); g.fill();
      const tl = Math.max(0, Math.ceil(time)), low = tl <= 10 && phase === 'play';
      g.fillStyle = low && Math.sin(clock * 10) > 0 ? '#ff5a5a' : '#fff'; g.font = '900 22px Unbounded, sans-serif'; g.textAlign = 'right'; g.fillText(`0:${String(tl).padStart(2, '0')}`, VW - 22, 38);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '700 11px Space Grotesk, sans-serif';
      const boosts = ['str', 'clover', 'book', 'polish'].filter(b => inv[b]).map(b => SHOP[b].icon).join(' ');
      g.fillText(`${classic ? `${L('důl', 'mine')} ${lv}` : P.mode === 'level' ? P.text || '' : L('horečka', 'rush')}${boosts ? ' · ' + boosts : ''}`, VW - 22, 56);
      // stopky
      g.save(); g.translate(VW - 120, 32); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, 0); const ta = -Math.PI / 2 + (1 - time / LEVEL_TIME) * Math.PI * 2; g.lineTo(Math.cos(ta) * 6, Math.sin(ta) * 6); g.stroke(); g.restore();
      // plovoucí částky
      g.textAlign = 'center';
      for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.life -= dt; if (t.life <= 0) { texts.splice(i, 1); continue; } t.y -= 28 * dt; g.globalAlpha = Math.min(1, t.life * 1.5); g.font = '900 18px Unbounded, sans-serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(42,22,12,.85)'; g.strokeText(t.text, t.x, t.y); g.fillStyle = t.col; g.fillText(t.text, t.x, t.y); g.globalAlpha = 1; }
      // tabule po dole
      if (banner) {
        g.fillStyle = 'rgba(20,10,4,.55)'; g.fillRect(0, 0, VW, VH);
        g.fillStyle = '#ffd23f'; g.font = '900 32px Unbounded, sans-serif'; g.fillText(banner.text, VW / 2, VH / 2 - 6);
        g.fillStyle = '#fff'; g.font = '700 18px Space Grotesk, sans-serif'; g.fillText(banner.sub, VW / 2, VH / 2 + 26);
        banner.t -= dt; if (banner.t <= 0) { const n = banner.next; banner = null; n(); }
      }
    }

    // ── Smyčka ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (api.paused && api.paused() && !paused && !over && phase === 'play') setPause(true);
      if (paused) dt = 0;
      for (let s = 0; s < speed; s++) { if (!over) tick(dt); if (auto) autoplay(); }
      draw(dt * speed);
    }
    function setPause(on) { if (over || phase !== 'play') return; paused = on; api.setTimer(!on); if (on) say(L('Pauza · stiskni P', 'Paused · press P'), 9999); else msgEl.hidden = true; }
    cv.addEventListener('pointerdown', e => { e.preventDefault(); drop(); });
    el.querySelector('.zk-pad').addEventListener('pointerdown', e => { const b = e.target.closest('[data-b]'); if (!b || b.disabled) return; e.preventDefault(); if (b.dataset.b === 'go') { if (phase === 'shop') nextLevel(); else drop(); } else dynamite(); });
    // automat pro testy: míří na nejvýhodnější úlovek, kameny odpálí, v obchodě koupí dynamit
    let auto = false;
    function autoplay() {
      if (phase === 'shop') { const o = offer.find(q => q.k === 'dyn' && !q.sold && money >= q.price); if (o) { money -= o.price; o.sold = true; inv.dyn++; } nextLevel(); return; }
      if (phase !== 'play') return;
      if (hook.st === 'back' && hook.item && hook.item.type === 'stone' && hook.item.w > 4 && inv.dyn) { dynamite(); return; }
      if (hook.st !== 'swing') return;
      let best = null, bv = 0;
      for (const it of items) {
        if (it.type === 'tnt' || it.type === 'mole' && !it.diamond) continue;
        const v = (it.type === 'gold' ? it.val : it.type === 'diamond' || it.diamond ? 600 : it.type === 'bag' ? 150 : it.val) / (it.w * (1 + Math.hypot(it.x - PX, it.y - PY) / 300));
        const a = Math.atan2(it.x - PX, it.y - PY);
        if (Math.abs(a) > 1.2) continue;
        const blocked = items.some(o => o !== it && o.type !== 'mole' && Math.abs(Math.atan2(o.x - PX, o.y - PY) - a) * Math.hypot(o.x - PX, o.y - PY) < o.r + 4 && Math.hypot(o.x - PX, o.y - PY) < Math.hypot(it.x - PX, it.y - PY));
        if (!blocked && v > bv) { bv = v; best = a; }
      }
      if (best != null && Math.abs(hook.ang - best) < 0.035) drop();
    }

    fit(); addEventListener('resize', fit);
    startLevel();
    raf = requestAnimationFrame(frame);
    return {
      getState: () => (over || !classic ? null : { lv, money: money - levelMoney, inv: { dyn: inv.dyn } }),
      progress: () => (target ? Math.min(1, money / target) : 0),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); },
      pause() { setPause(true); },
      onKey(e) {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); setPause(!paused); return; }
        if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); if (!e.repeat) drop(); return; }
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); dynamite(); return; }
        if (e.key === 'Enter' && phase === 'shop') { e.preventDefault(); nextLevel(); }
      },
      _state: () => ({ lv, money, target, time: +time.toFixed(2), phase, hook: hook.st, ang: +hook.ang.toFixed(3), items: items.length, dyn: inv.dyn, over }),
      _auto(on) { auto = on !== false; },
      _speed(n) { speed = Math.max(1, n | 0); },
      _solve() { money = Math.max(money, (target || 1000) * 2); done = Math.max(done, 3); phase = 'over'; endGame(); },
    };
  }

  // úvodní obrázek: zlatokop u navijáku, drapák táhne velkou hroudu, v hlíně diamant a pytel
  function art(el) {
    el.innerHTML = '<canvas width="520" height="360" style="object-fit:contain"></canvas>';
    const g = el.querySelector('canvas').getContext('2d');
    g.beginPath(); g.roundRect(0, 0, 520, 360, 28); g.clip();
    g.fillStyle = '#ffb35c'; g.fillRect(0, 0, 520, 360);
    g.save(); g.scale(520 / 560, 520 / 560); g.translate(-40, 24);
    g.drawImage(ZkArt.background(640, 420, 3, 2), 0, 0);
    const r = rngOf(9), it = (type, x, y, rr, extra = {}) => ZkArt.item(g, { type, x, y, r: rr, shape: ZkArt.blob(r), ph: r() * 6, ...extra }, 0.9);
    it('stone', 130, 270, 22); it('gold', 480, 290, 30); it('diamond', 540, 230, 11); it('bag', 190, 180, 16); it('gold', 570, 160, 14); it('stone', 420, 200, 14); it('tnt', 90, 320, 14); it('gold', 250, 300, 18);
    it('mole', 400, 330, 14, { dir: -1, diamond: true });
    const ang = 0.3, len = 128, tx = PX + Math.sin(ang) * len, ty = PY + Math.cos(ang) * len;
    g.strokeStyle = '#2a160c'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(PX, PY - 8); g.lineTo(tx, ty); g.stroke();
    g.strokeStyle = '#d8c8a0'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(PX, PY - 8); g.lineTo(tx, ty); g.stroke();
    it('gold', tx + Math.sin(ang) * 30, ty + Math.cos(ang) * 30, 36);
    ZkArt.claw(g, tx, ty, ang, 0);
    ZkArt.winch(g, PX, PY - 18, 1.2, 2);
    ZkArt.miner(g, PX + 50, SURF - 2, { crank: 1.2, strain: 1, t: 1 });
    g.font = '900 20px Unbounded, sans-serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(42,22,12,.85)'; g.strokeText('+$500', PX + 110, 140); g.fillStyle = '#ffd23f'; g.fillText('+$500', PX + 110, 140);
    g.restore();
  }
  return { DIFFS, KIND, generate, create, art, layout, levelSpec, targetOf };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'zlatokop', title: 'ZLATOKOP',
  tagline: Kit.L('Na motivy klasického Gold Mineru: kývající se drapák, minuta času a hlína plná zlata, kamenů, diamantů a překvapení. Splň cíl a nakup v obchodě na další důl.', 'In the spirit of the classic Gold Miner: a swinging claw, one minute and dirt full of gold, rocks, diamonds and surprises. Reach the target and shop for the next mine.'),
  diffs: Zlatokop.DIFFS, generate: Zlatokop.generate, create: Zlatokop.create, art: Zlatokop.art,
  dailyDiff: () => 'klasik',
  levelDiff: () => 'klasik',
  rules: Kit.L(`<p>Drapák na laně se kývá sem a tam. Ve správnou chvíli ho spusť (klepnutí, mezerník nebo ↓) a naviják vytáhne, co chytí.</p>
    <ul><li><b>Zlato</b> vynese 50–500 podle velikosti. Velké hroudy se ale táhnou pomalu.</li>
    <li><b>Kameny</b> skoro nic nevynesou a zdržují. Táhnoucí se úlovek můžeš odpálit <b>dynamitem</b> (↑ nebo tlačítko 🧨).</li>
    <li><b>Diamanty</b> jsou malé a drahé (600). <b>Krtek</b> s diamantem pobíhá sem a tam.</li>
    <li><b>Pytel</b> skrývá peníze, dynamit nebo sílu. <b>TNT</b> vybuchne a zničí všechno kolem.</li>
    <li>Každý důl má <b>minutu</b>. V <b>Klasice</b> musíš do konce minuty mít cílovou částku, pak nakupuješ v obchodě a jdeš do dalšího dolu. <b>Zlatá horečka</b> je jeden bohatý důl na nejvyšší částku.</li>
    <li>P pozastaví hru.</li></ul>`,
    `<p>The claw on the rope swings to and fro. Drop it at the right moment (tap, Space or ↓) and the winch pulls up whatever it catches.</p>
    <ul><li><b>Gold</b> is worth 50–500 by size, but big nuggets come up slowly.</li>
    <li><b>Rocks</b> are worth next to nothing and waste time. Blow up what you pull with <b>dynamite</b> (↑ or the 🧨 button).</li>
    <li><b>Diamonds</b> are small and pricey (600). A <b>mole</b> with a diamond runs to and fro.</li>
    <li>A <b>bag</b> hides money, dynamite or strength. <b>TNT</b> explodes and destroys everything around it.</li>
    <li>Every mine has <b>one minute</b>. In <b>Classic</b> you need the target by the end of the minute, then you shop and go to the next mine. <b>Gold rush</b> is one rich mine for the highest amount.</li>
    <li>P pauses the game.</li></ul>`),
  achievements: [
    { id: 'm5', name: Kit.L('Starý mazák', 'Old hand'), desc: Kit.L('5 dolů v Klasice', '5 mines in Classic'), prog: s => [Math.min(5, (s.data && s.data.mines) || 0), 5] },
    { id: 'm10k', name: Kit.L('Zlatá horečka', 'Gold fever'), desc: Kit.L('$10 000 v Klasice', '$10,000 in Classic'), prog: s => [Math.min(10000, (s.data && s.data.best) || 0), 10000] },
  ],
});
