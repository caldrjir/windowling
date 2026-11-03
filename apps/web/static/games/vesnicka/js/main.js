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
  let last = performance.now(), saveT = 0, achT = 0, uiT = 0, wasCreature = null;

  function applySettings() { SCI = !!S.settings.sci; Sound.on = !!S.settings.sound; }
  function save() {
    store.set(SAVE_KEY, Econ.serialize(S));
    store.set(STATS_KEY, JSON.stringify(Econ.hubStats(S)));
    S.t = Date.now();
  }

  // ── Čas bez hráče (zavřená hra nebo skrytá karta) ──
  function catchUp(fromMs, toMs, welcome) {
    const away = (toMs - fromMs) / 1000;
    if (away < 1) return;
    const cap = Econ.offlineCap(S), before = S.earnedAll;
    Econ.advance(S, fromMs, toMs, cap);
    const got = S.earnedAll - before;
    if (away > S.stats.awayMax) S.stats.awayMax = away;
    if (away < 60 || got <= 0) return;
    if (welcome) {
      UI.modal(`<div class="welcome"><div class="wico">🏡</div><h2>${L('Vítej zpátky!', 'Welcome back!')}</h2>
        <p>${L(`Byl jsi pryč <b>${fmtDur(away)}</b>. Vesnička mezitím vydělala`, `You were away for <b>${fmtDur(away)}</b>. Meanwhile the village earned`)}</p>
        <div class="wgot">${UI.coinSvg}<b>${fmt(got)}</b></div>
        ${away > cap ? `<p class="muted">${L(`Bez tebe vesnice vydělává nejvýš ${fmtDur(cap)}. Déle umí s Ponocným a s pověstmi.`, `Without you the village earns for at most ${fmtDur(cap)}. Longer with the Night watchman and legends.`)}</p>` : ''}</div>`,
      [{ text: L('Vybrat groše', 'Collect'), cls: 'gold', fn: () => { Sound.play.claim(); burstCoins(); } }]);
    } else UI.toast(`${UI.coinSvg} ${L(`Zatímco jsi byl pryč: +${fmt(got)}`, `While you were away: +${fmt(got)}`)}`);
  }
  function burstCoins() {
    const cv = document.getElementById('cv'), r = cv.getBoundingClientRect();
    for (let i = 0; i < 18; i++) Scene.coin(r.width / 2 + (Math.random() - 0.5) * 60, r.height * 0.4);
  }

  // ── Akce hráče ──
  function onTap(sx, sy) {
    Sound.unlock();
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
    const b = BUILDINGS[i];
    if (ev.first) {
      Sound.play.first();
      Scene.panTo(Scene.SLOT[b.id][0]);
      UI.toast(`<b>${b.name}</b> · ${b.desc}`, 'big');
    } else if (!quiet) Sound.play.buy(); else Sound.play.tap();
    for (const m of ev.milestones) { Sound.play.milestone(); UI.toast(`⭐ <b>${L('Mistrovství', 'Mastery')}: ${b.name} ${m}×</b> · ${L(`výnos ×${Econ.milestoneBase(S)}`, `output ×${Econ.milestoneBase(S)}`)}`, 'gold'); }
    afterChange();
    return true;
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
    const c = C_INDEX[id];
    let msg = `${UI.C_ICON[id]} <b>${c.name}</b> ${c.text}`;
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
        const c = C_INDEX[ev.creature];
        Scene.spawnCreature(ev.creature, c.life);
        wasCreature = Scene.creature; wasCreature.expire = nowT / 1000 + c.life;
        Sound.play.appear();
        if (!S.seen.creature) { S.seen.creature = 1; UI.toast(L(`${UI.C_ICON[ev.creature]} Ve vsi se zjevil${ev.creature === 'bludicka' ? 'a' : ''} <b>${c.name}</b>! Rychle na ${ev.creature === 'bludicka' ? 'ni' : 'něj'} klepni.`, `${UI.C_ICON[ev.creature]} A <b>${c.name}</b> appeared! Quick, tap it.`), 'big'); }
      }
    }
    Scene.frame(dt, S);
    uiT += dt; achT += dt; saveT += dt;
    if (uiT > 0.2) { uiT = 0; UI.refresh(); creatureTick(); }
    if (achT > 1) { achT = 0; checkAch(); }
    if (saveT > 5) { saveT = 0; save(); }
    requestAnimationFrame(frame);
  }

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
    UI.init(S, { buy, upg, buyAll, prestige, claim, setting, reset });
    Econ.daily(S);
    if (isNew) intro();
    else catchUp(S.t, Date.now(), true);
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
  return { get S() { return S; }, save, buy, upg, onTap, onCreature, prestige, claim };
})();
