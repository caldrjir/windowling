'use strict';
// ── VESNIČKA · hra: smyčka, ukládání, čas bez hráče, klepání, bytosti ──────────────
const Game = (() => {
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* plné nebo zakázané úložiště */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } },
  };
  let S = Econ.load(store.get(SAVE_KEY));
  const isNew = !store.get(SAVE_KEY);
  let last = performance.now(), saveT = 0, achT = 0, uiT = 0, stewT = 0, wasCreature = null;
  const tapTimes = [];
  /** Jak rychle hráč teď klepe (klepnutí za sekundu za posledních 10 s). */
  function tps() { const t = performance.now() - 10000; while (tapTimes.length && tapTimes[0] < t) tapTimes.shift(); return tapTimes.length / 10; }

  function applySettings() { SCI = !!S.settings.sci; Sound.on = !!S.settings.sound; }
  function save() {
    store.set(SAVE_KEY, Econ.serialize(S));
    store.set(STATS_KEY, JSON.stringify(Econ.hubStats(S)));
    S.t = Date.now();
  }

  // ── Čas bez hráče (zavřená hra nebo skrytá karta) ──
  function catchUp(fromMs, toMs, welcome) {
    if ((toMs - fromMs) / 1000 < 1) return;
    const o = Econ.offline(S, fromMs, toMs);
    if (o.away < 60 || o.got <= 0) return;
    if (welcome) welcomeBack(o);
    else UI.toast(`${UI.coinSvg} ${L(`Zatímco jsi byl pryč: +${fmt(o.got)}`, `While you were away: +${fmt(o.got)}`)}${o.buys ? ` · 🤵 ${o.buys}` : ''}`);
  }
  /** Uvítání: jak dlouho byl hráč pryč, kolik z toho vesnice vydělávala a kdy se příště vrátit. */
  function welcomeBack(o) {
    const pct = Math.round((o.earnSec / o.away) * 100), perHour = o.got / Math.max(1, o.earnSec / 3600);
    const idle = o.away - o.earnSec;
    UI.modal(`<div class="welcome"><div class="wico">🏡</div><h2>${L('Vítej zpátky!', 'Welcome back!')}</h2>
      <p>${L(`Byl jsi pryč <b>${fmtDur(o.away)}</b>. Vesnička mezitím vydělala`, `You were away for <b>${fmtDur(o.away)}</b>. Meanwhile the village earned`)}</p>
      <div class="wgot">${UI.coinSvg}<b>${fmt(o.got)}</b></div>
      <div class="eff"><div class="effbar"><i style="width:${pct}%"></i></div>
        <div class="effrow"><span>${L('Vydělávala', 'Earning')} <b>${fmtDur(o.earnSec)}</b></span><span>${o.capped ? L(`zahálela <b>${fmtDur(idle)}</b>`, `idle <b>${fmtDur(idle)}</b>`) : ''}</span></div>
        <p class="effp">${L(`Využito <b>${pct} %</b> času · zhruba ${fmt(perHour)} grošů za hodinu`, `<b>${pct}%</b> of the time used · about ${fmt(perHour)} groschen an hour`)}</p></div>
      ${o.buys ? `<p>🤵 ${L(`Šafář mezitím koupil <b>${o.buildings}</b> budov a <b>${o.upgrades}</b> vylepšení.`, `Meanwhile the steward bought <b>${o.buildings}</b> buildings and <b>${o.upgrades}</b> upgrades.`)}</p>` : ''}
      <p class="muted">${o.capped
        ? L(`Bez tebe vesnička vydělává nejvýš ${fmtDur(o.cap)}, pak zahálí. Příště se vrať do ${fmtDur(o.cap)} (když odejdeš teď, tak nejpozději v ${UI.clockAt(o.cap)}). Déle vydrží s Ponocným a s kronikou.`, `Without you the village earns for at most ${fmtDur(o.cap)}, then it idles. Next time come back within ${fmtDur(o.cap)} (if you leave now, by ${UI.clockAt(o.cap)}). The Night watchman and the chronicle make it last longer.`)
        : L(`Vesnička vydělávala celou dobu. Bez tebe vydrží ${fmtDur(o.cap)}: když odejdeš teď, vrať se nejpozději v ${UI.clockAt(o.cap)}.`, `The village earned the whole time. It lasts ${fmtDur(o.cap)} without you: if you leave now, come back by ${UI.clockAt(o.cap)}.`)}</p></div>`,
    [{ text: L('Vybrat groše', 'Collect'), cls: 'gold', fn: () => { Sound.play.claim(); burstCoins(); newsOnce(); } }]);
  }
  function burstCoins() {
    const cv = document.getElementById('cv'), r = cv.getBoundingClientRect();
    for (let i = 0; i < 18; i++) Scene.coin(r.width / 2 + (Math.random() - 0.5) * 60, r.height * 0.4);
  }

  // ── Akce hráče ──
  function onTap(sx, sy) {
    Sound.unlock();
    tapTimes.push(performance.now());
    const v = Econ.tap(S);
    Scene.floatText(sx, sy - 6, '+' + fmt(v, 1), Econ.buff(S, 'tap') > 1 ? '#ff9a7a' : '#fff3b0');
    if (Math.random() < 0.5) Scene.coin(sx, sy);
    Sound.play.tap();
    if (!S.seen.tap && S.taps >= 3) { S.seen.tap = 1; document.getElementById('hint').hidden = true; }
    if (!S.seen.firstBuy && S.coins >= BUILDINGS[0].cost) { S.seen.firstBuy = 1; UI.toast(L('Máš na první políčko! Postav ho dole v Řemeslech.', 'You can afford a field! Build it below in Trades.'), 'big'); }
    pulse();
  }
  let pulseT = 0;
  function pulse() { const el = document.querySelector('.coins'); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); clearTimeout(pulseT); pulseT = setTimeout(() => el.classList.remove('pulse'), 300); }
  function buy(i, amount, quiet) {
    const ev = Econ.buy(S, i, amount);
    if (!ev) { if (!quiet) Sound.play.no(); return false; }
    afterBuilt(i, ev, quiet);
    afterChange();
    return true;
  }
  // Rychlý nákup a šafář: koupí to, co se nejrychleji zaplatí.
  function quickBuy(b) {
    const got = Econ.buyThing(S, b);
    if (!got) { Sound.play.no(); return; }
    if (got.kind === 'b') afterBuilt(got.i, got.ev, false);
    else { Sound.play.upgrade(); UI.toast(`⚡ <b>${got.name}</b> · ${U_INDEX[got.id].effect}`); }
    afterChange();
  }
  function smart() {
    const r = Econ.stewardBuy(S, tps(), 400);
    if (!r.n) { Sound.play.no(); UI.toast(L('🤵 Teď se nic nevyplatí, počkej na groše.', '🤵 Nothing worth buying yet, wait for groschen.')); return; }
    Sound.play.upgrade();
    stewardNews(r);
    UI.toast(`🤵 ${L(`Šafář koupil ${r.buildings} budov a ${r.upgrades} vylepšení.`, `The steward bought ${r.buildings} buildings and ${r.upgrades} upgrades.`)}`);
    afterChange();
  }
  function stewardNews(r) {
    for (const i of r.firsts) { const b = BUILDINGS[i]; Sound.play.first(); UI.toast(`<b>${b.name}</b> · ${b.desc}`, 'big'); }
    for (const [i, m] of r.milestones.slice(-2)) UI.toast(`⭐ <b>${L('Mistrovství', 'Mastery')}: ${BUILDINGS[i].name} ${m}×</b>`, 'gold');
  }
  let stewAgg = 0, stewAggT = 0;
  function stewardTick(dt) {
    if (!S.steward || !S.settings.auto) return;
    stewT += dt; stewAggT += dt;
    if (stewT < 0.5) return;
    stewT = 0;
    const r = Econ.stewardBuy(S, tps(), 30);
    if (r.n) { stewAgg += r.n; stewardNews(r); Sound.play.tap(); afterChange(); }
    if (stewAgg && stewAggT > 20) { UI.toast(`🤵 ${L(`Šafář nakoupil ${stewAgg}×`, `The steward bought ${stewAgg} things`)}`); stewAgg = 0; stewAggT = 0; }
  }
  function hire() {
    UI.modal(`<div class="welcome"><div class="wico">🤵</div><h2>${L('Najmout šafáře?', 'Hire a steward?')}</h2>
      <p>${L(`Šafář bude za tebe nakupovat řemesla a vylepšení, která se nejrychleji zaplatí, i když nejsi u hry. Stojí <b>${STEWARD_COST} pověsti</b> jednou provždy: ty se utratí a s nimi jejich bonus +${Math.round(LEGEND_BONUS * 100)} % za každou. Výhody kroniky zůstávají.`, `The steward buys the trades and upgrades that pay for themselves fastest, even while you are away. He costs <b>${STEWARD_COST} legends</b> once and for good: they are spent along with their +${Math.round(LEGEND_BONUS * 100)}% each. Chronicle perks stay.`)}</p></div>`,
    [{ text: L(`Najmout · ${STEWARD_COST} 📜`, `Hire · ${STEWARD_COST} 📜`), cls: 'gold', fn: () => {
      if (!Econ.hireSteward(S)) { Sound.play.no(); return; }
      Sound.play.legend();
      UI.toast(`🤵 <b>${L('Šafář nastoupil!', 'The steward is here!')}</b> · ${L('Zapínáš ho v Řemeslech.', 'Switch him on in Trades.')}`, 'gold');
      afterChange(); UI.setTab('build'); save();
    } }, { text: L('Ještě ne', 'Not yet'), cls: 'ghost' }]);
  }
  function afterBuilt(i, ev, quiet) {
    const b = BUILDINGS[i];
    if (ev.first) {
      Sound.play.first();
      Scene.panTo(Scene.SLOT[b.id][0]);
      UI.toast(`<b>${b.name}</b> · ${b.desc}`, 'big');
    } else if (!quiet) Sound.play.buy(); else Sound.play.tap();
    for (const m of ev.milestones) { Sound.play.milestone(); UI.toast(`⭐ <b>${L('Mistrovství', 'Mastery')}: ${b.name} ${m}×</b> · ${L(`výnos ×${Econ.milestoneBase(S)}`, `output ×${Econ.milestoneBase(S)}`)}`, 'gold'); }
  }
  function upg(id) {
    if (!Econ.buyUpg(S, id)) { Sound.play.no(); return; }
    Sound.play.upgrade();
    const u = U_INDEX[id];
    UI.toast(`🔨 <b>${u.name}</b> · ${u.effect}`);
    afterChange();
  }
  function buyAll() {
    let n = 0;
    for (const u of Econ.upgAvailable(S)) if (Econ.buyUpg(S, u.id)) n++;
    if (!n) { Sound.play.no(); return; }
    Sound.play.upgrade();
    UI.toast(L(`🔨 Koupeno vylepšení: ${n}`, `🔨 Upgrades bought: ${n}`));
    afterChange();
  }
  function prestige() {
    const p = Econ.pending(S);
    if (p < 1) return;
    UI.modal(`<div class="welcome"><div class="wico">📜</div><h2>${L('Předat vesnici?', 'Pass the village on?')}</h2>
      <p>${L(`Získáš <b>+${fmt(p)}</b> pověstí. Budovy, vylepšení a groše začnou znovu od nuly, pověsti, úspěchy a kronika zůstanou.`, `You gain <b>+${fmt(p)}</b> legends. Buildings, upgrades and groschen start again from zero; legends, achievements and the chronicle stay.`)}</p></div>`,
    [{ text: L('Předat', 'Pass it on'), cls: 'gold', fn: () => {
      const before = Econ.perks(S).length, got = Econ.prestige(S);
      Scene.clearCreature(); Scene.panTo(0, false);
      Sound.play.legend();
      UI.toast(`📜 <b>${L(`Nové pokolení! +${fmt(got)} pověstí`, `A new generation! +${fmt(got)} legends`)}</b>`, 'gold');
      for (const pk of Econ.perks(S).slice(before)) UI.toast(`📖 <b>${pk.name}</b> · ${pk.desc}`, 'big');
      afterChange(); UI.setTab('build'); save();
    } }, { text: L('Ještě ne', 'Not yet'), cls: 'ghost' }]);
  }
  function claim(i) {
    const r = Econ.claimDaily(S, i);
    if (!r) return;
    Sound.play.claim(); burstCoins();
    UI.toast(`${UI.coinSvg} +${fmt(r.coins)}`);
    if (r.blessing) { Sound.play.bell(); UI.toast(`🌟 <b>${L('Požehnání! Výnos ×2 na 15 minut', 'Blessing! Income ×2 for 15 minutes')}</b>`, 'gold'); }
    afterChange();
  }
  function setting(k, v) {
    S.settings[k] = v; applySettings(); UI.soundIcon();
    if (UI.tab === 'more') UI.render(); else UI.refresh();
    save();
  }
  function reset() {
    UI.modal(`<div class="welcome"><div class="wico">⚠️</div><h2>${L('Smazat vesnici?', 'Delete the village?')}</h2><p>${L('Tohle nejde vrátit. Přijdeš o všechno včetně pověstí a úspěchů.', 'This cannot be undone. You lose everything including legends and achievements.')}</p></div>`,
      [{ text: L('Smazat', 'Delete'), cls: 'danger', fn: () => { S = Econ.fresh(); S.settings = Object.assign({}, S.settings); UI.state = S; Scene.clearCreature(); Scene.panTo(0, false); save(); UI.setTab('build'); intro(); } }, { text: L('Nechat', 'Keep it'), cls: 'ghost' }]);
  }
  function afterChange() { checkAch(); UI.refresh(); }
  function checkAch() {
    for (const a of Econ.checkAch(S)) { Sound.play.achievement(); UI.toast(`🏅 <b>${a.name}</b> · ${a.desc} · +${Math.round(ACH_BONUS * 100)}${L(' %', '%')}`, 'gold'); }
  }

  // ── Bytosti ──
  function onCreature(id, sx, sy) {
    const r = Econ.catchCreature(S, id);
    if (!r) return;
    wasCreature = null;
    if (id === 'cert') Sound.play.devil(); else Sound.play.catch();
    if (id === 'nesro') Sound.play.bell();
    let msg = `${UI.C_ICON[id]} <b>${r.name}</b> ${r.text}`;
    if (r.coins) { msg += `: +${fmt(r.coins)}`; Scene.floatText(sx, sy - 20, '+' + fmt(r.coins), '#bff4ff', true); for (let i = 0; i < 14; i++) Scene.coin(sx, sy); }
    if (r.buildings) msg += `: +${fmt(r.buildings)}`;
    UI.toast(msg, 'big');
    afterChange();
  }
  function creatureTick() {
    const cr = Scene.creature;
    if (cr && !cr.done && wasCreature === cr && performance.now() / 1000 > cr.expire) { S.stats.missed++; wasCreature = null; }
  }

  // ── Smyčka ──
  function frame(nowT) {
    let dt = (nowT - last) / 1000;
    last = nowT;
    if (dt > 2) { catchUp(Date.now() - dt * 1000, Date.now(), false); dt = 0; }
    dt = Math.max(0, Math.min(0.25, dt));
    if (dt > 0) {
      const ev = Econ.tick(S, dt);
      if (ev && ev.creature && !Scene.creature) {
        const c = ev.creature === 'nesro' ? NESRO : C_INDEX[ev.creature];
        Scene.spawnCreature(ev.creature, c.life);
        wasCreature = Scene.creature; wasCreature.expire = nowT / 1000 + c.life;
        Sound.play.appear();
        if (ev.creature === 'nesro') UI.toast(L('🎒 Po návsi se prochází někdo s velkým batohem…', '🎒 Someone with a big backpack is strolling across the green…'), 'big');
        else if (!S.seen.creature) { S.seen.creature = 1; UI.toast(L(`${UI.C_ICON[ev.creature]} Ve vsi se zjevil${ev.creature === 'bludicka' ? 'a' : ''} <b>${c.name}</b>! Rychle na ${ev.creature === 'bludicka' ? 'ni' : 'něj'} klepni.`, `${UI.C_ICON[ev.creature]} A <b>${c.name}</b> appeared! Quick, tap it.`), 'big'); }
      }
    }
    stewardTick(dt);
    Scene.frame(dt, S);
    uiT += dt; achT += dt; saveT += dt;
    if (uiT > 0.2) { uiT = 0; UI.refresh(); creatureTick(); }
    if (achT > 1) { achT = 0; checkAch(); }
    if (saveT > 5) { saveT = 0; save(); }
    requestAnimationFrame(frame);
  }

  /** Novinky se ukážou samy jednou, dokud je hráč neviděl. */
  function newsOnce() { if ((S.seen.news || 0) < NEWS_VERSION) UI.toggleNews(true); }

  function intro() {
    UI.modal(`<div class="welcome"><div class="wico">🏡</div><h2>VESNIČKA</h2>
      <p>${L('Postav vesnici, která roste, i když zrovna nehraješ. Od políčka a kurníku po pivovar, zámek a pražský orloj.', 'Build a village that keeps growing while you are away. From a field and a hen house to a brewery, a castle and an astronomical clock.')}</p>
      <p>${L('<b>Klepej do vesnice</b> a vydělej první groše. Za 12 grošů postavíš políčko.', '<b>Tap the village</b> to earn your first groschen. A field costs 12.')}</p></div>`,
    [{ text: L('Do toho!', 'Let’s go!'), cls: 'gold', fn: () => Sound.unlock() }]);
  }

  function start() {
    applySettings();
    Scene.init(document.getElementById('cv'));
    Scene.on.tap = onTap; Scene.on.creature = onCreature;
    UI.init(S, { buy, upg, buyAll, prestige, claim, setting, reset, quick: quickBuy, smart, hire, tps, newsSeen: () => { if ((S.seen.news || 0) < NEWS_VERSION) { S.seen.news = NEWS_VERSION; save(); } } });
    Econ.daily(S);
    if (isNew) { S.seen.news = NEWS_VERSION; intro(); }
    else {
      catchUp(S.t, Date.now(), true);
      if (document.getElementById('modal').hidden) newsOnce();
    }
    if (S.seen.tap) document.getElementById('hint').hidden = true;
    checkAch();
    save();
    addEventListener('resize', () => Scene.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    addEventListener('pagehide', save);
    // Jiná karta nebo synchronizace z účtu změnila uložení: převzít novější vesnici.
    addEventListener('storage', e => { if (e.key === SAVE_KEY && e.newValue && document.hidden) { S = Econ.load(e.newValue); UI.state = S; applySettings(); UI.render(); } });
    requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  return { get S() { return S; }, save, buy, upg, onTap, onCreature, prestige, claim, quickBuy, smart, hire };
})();
