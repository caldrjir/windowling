'use strict';
// ── VESNIČKA · rozhraní: horní lišta, panel se záložkami, oznámení, okna ─────────────
const UI = (() => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let S = null, tab = 'build', amount = 1, structKey = '';
  const U_ICON = { kaplicka: '⛪', skola: '🏫', posta: '📯', silnice: '🛣️', zeleznice: '🚂', elektrina: '💡', rozhlas: '📢', pohadky: '📖', bylinkarka: '🌿', lucerna: '🏮', pranostiky: '🌦️', fletna: '🎶', kalendar: '📅', ponocny: '🌙', vecernice: '⭐' };
  const C_ICON = { bludicka: '✨', vodnik: '🐸', cert: '😈', krakonos: '⛰️', hospodaricek: '🧙' };
  const BUFF_ICON = { vodnik: '🫖', cert: '🔥', krakonos: '⛰️', blessing: '🌟' };
  const BUFF_NAME = { vodnik: L('Vodníkův hrníček', 'Goblin’s pot'), cert: L('Čertovská síla', 'Devilish strength'), krakonos: L('Krakonošova štědrost', 'Krakonoš’s gift'), blessing: L('Požehnání', 'Blessing') };
  const coinSvg = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#f2c14e" stroke="#a8771e" stroke-width="1.6"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#c9952e" stroke-width="1.2"/><path d="M9.5 9.5h5M12 9.5v6" stroke="#a8771e" stroke-width="1.8" stroke-linecap="round"/></svg>';

  // ── Lišta a HUD ──
  function hud() {
    $('#coins').textContent = fmt(S.coins);
    const r = Econ.rate(S);
    $('#rate').textContent = L(`+${fmt(r, 1)} za s`, `+${fmt(r, 1)} /s`);
    const sn = seasonAt(Date.now());
    $('#season').innerHTML = `<span>${SEASONS[sn].icon}</span><span class="sn">${SEASONS[sn].name}</span><b>${fmtClock(seasonLeft(Date.now()))}</b>`;
    $('#buffs').innerHTML = S.buffs.map(b => `<span class="buff b-${b.id}" title="${esc(BUFF_NAME[b.id] || '')}"><i>${BUFF_ICON[b.id] || '✨'}</i>${b.kind === 'cost' ? '−50 %' : '×' + b.mul}<b>${fmtClock(b.t)}</b><s style="width:${Math.max(0, Math.min(100, (b.t / b.max) * 100))}%"></s></span>`).join('');
    const side = Scene.creatureSide();
    const cr = Scene.creature;
    for (const [id, s] of [['#edgeL', -1], ['#edgeR', 1]]) {
      const el = $(id);
      el.hidden = side !== s;
      if (side === s && cr) el.innerHTML = s < 0 ? `‹ ${C_ICON[cr.id]} ${C_INDEX[cr.id].name}` : `${C_ICON[cr.id]} ${C_INDEX[cr.id].name} ›`;
    }
    // odznáčky na záložkách
    const upgN = Econ.upgAvailable(S).filter(u => Econ.upgCost(S, u) <= S.coins).length;
    badge('upg', upgN);
    const d = Econ.daily(S), claim = d.tasks.filter(t => !t.claimed && Econ.dailyProgress(S, t) >= t.n).length;
    badge('tasks', claim);
    badge('legend', Econ.pending(S) > 0 ? '+' + fmt(Econ.pending(S)) : 0);
  }
  function badge(id, v) { const el = $(`.tabs [data-tab="${id}"] .bd`); if (el) { el.textContent = v || ''; el.hidden = !v; } }

  // ── Záložky ──
  const TABS = [
    ['build', '🏡', L('Řemesla', 'Trades')], ['upg', '🔨', L('Vylepšení', 'Upgrades')], ['legend', '📜', L('Kronika', 'Chronicle')],
    ['tasks', '✅', L('Úkoly', 'Tasks')], ['more', '☰', L('Více', 'More')],
  ];
  function tabs() {
    $('#tabs').innerHTML = TABS.map(([id, ic, name]) => `<button role="tab" data-tab="${id}" aria-selected="${tab === id}"><i>${ic}</i><span>${name}</span><b class="bd" hidden></b></button>`).join('');
  }
  function setTab(id) {
    tab = id;
    for (const b of document.querySelectorAll('#tabs [data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === id));
    structKey = '';
    render();
    $('#body').scrollTop = 0;
  }
  function render() {
    const body = $('#body');
    if (tab === 'build') renderBuild(body);
    else if (tab === 'upg') renderUpg(body);
    else if (tab === 'legend') renderLegend(body);
    else if (tab === 'tasks') renderTasks(body);
    else renderMore(body);
    refresh();
  }

  // ── Řemesla ──
  function visibleBuildings() {
    const last = BUILDINGS.reduce((a, b, i) => (S.owned[b.id] ? i : a), -1);
    return BUILDINGS.slice(0, Math.min(BUILDINGS.length, last + 2));
  }
  const buildKey = () => `b${visibleBuildings().length}:${seasonAt(Date.now())}`;
  function renderBuild(body) {
    const vis = visibleBuildings(), sn = seasonAt(Date.now());
    structKey = buildKey();
    body.innerHTML = `<div class="amounts" role="group" aria-label="${L('Kolik kupovat', 'How many to buy')}">${[1, 10, 100, 'max'].map(a => `<button data-amt="${a}" aria-pressed="${amount === a}">${a === 'max' ? 'MAX' : '×' + a}</button>`).join('')}</div>
      <div class="rows">${vis.map(b => { const i = B_INDEX[b.id], locked = !S.owned[b.id];
        return `<div class="row${locked ? ' locked' : ''}" data-b="${i}">
          <canvas class="ico" data-lv="-1" aria-hidden="true"></canvas>
          <div class="info"><div class="nm"><b>${b.name}</b><span class="cnt"></span>${b.season === sn ? `<span class="tag">${SEASONS[sn].icon} ${L('sezóna', 'in season')}</span>` : ''}</div>
          <div class="sub">${locked ? `<span class="desc">${b.desc}</span>` : `<span class="prod"></span>`}</div>
          ${locked ? '' : '<div class="ms"><i></i><span></span></div>'}</div>
          <button class="buy" data-buy="${i}"><small></small><b></b></button></div>`; }).join('')}</div>
      ${vis.length < BUILDINGS.length ? `<p class="more-hint">${L(`Další řemesla: ${BUILDINGS.length - vis.length}`, `More trades to discover: ${BUILDINGS.length - vis.length}`)}</p>` : ''}`;
  }
  function refreshBuild() {
    const sn = seasonAt(Date.now()), r = Econ.rate(S) || 1;
    for (const row of document.querySelectorAll('#body .row[data-b]')) {
      const i = +row.dataset.b, b = BUILDINGS[i], n = S.owned[b.id];
      const cv = row.querySelector('canvas.ico'), lv = Scene.LV(n);
      if (+cv.dataset.lv !== lv) { cv.dataset.lv = lv; Scene.icon(cv, b.id, lv, 52); }
      row.querySelector('.cnt').textContent = n ? n : '';
      const pr = row.querySelector('.prod');
      if (pr) { const br = Econ.bRate(S, i, sn), sh = (br / r) * 100, pc = sh > 0 && sh < 1 ? '<1' : Math.round(sh); pr.textContent = L(`+${fmt(br, 1)} za s · ${pc} %`, `+${fmt(br, 1)} /s · ${pc}%`); }
      const ms = row.querySelector('.ms');
      if (ms) { const nx = Econ.nextMilestone(n), prev = [0, ...MILESTONES].filter(m => m <= n).pop(); ms.querySelector('i').style.width = nx ? `${((n - prev) / (nx - prev)) * 100}%` : '100%'; ms.querySelector('span').textContent = nx ? L(`${n}/${nx} → výnos ×${Econ.milestoneBase(S)}`, `${n}/${nx} → output ×${Econ.milestoneBase(S)}`) : L('Mistr všech mistrů', 'Master of masters'); }
      const btn = row.querySelector('.buy');
      let k = amount === 'max' ? Math.max(1, Econ.maxAfford(S, i)) : amount;
      const cost = Econ.costOf(S, i, k), can = cost <= S.coins;
      btn.disabled = !can;
      btn.querySelector('small').textContent = L(`Postavit ×${k}`, `Build ×${k}`);
      btn.querySelector('b').innerHTML = coinSvg + fmt(cost);
      btn.classList.toggle('sale', Econ.buff(S, 'cost') < 1);
    }
  }

  // ── Vylepšení ──
  function uIcon(u) { return u.kind === 'b' ? `<canvas class="uico" data-ub="${BUILDINGS[u.b].id}"></canvas>` : `<span class="uemo">${u.kind === 'tap' ? '✋' : U_ICON[u.id] || '✨'}</span>`; }
  function reqText(u) {
    const r = u.req || {};
    if (r.b != null) return L(`Potřebuješ ${r.n}× ${BUILDINGS[r.b].name}`, `Needs ${r.n}× ${BUILDINGS[r.b].name}`);
    if (r.taps != null) return L(`Klepni do vesnice ${r.taps}×`, `Tap the village ${r.taps} times`);
    if (r.total != null) return L(`Měj ${r.total} budov`, `Own ${r.total} buildings`);
    if (r.caught != null) return L(`Chyť ${r.caught} ${r.caught < 5 ? 'bytosti' : 'bytostí'}`, `Catch ${r.caught} creatures`);
    return '';
  }
  function renderUpg(body) {
    const av = Econ.upgAvailable(S), owned = UPGRADES.filter(u => S.upg[u.id]);
    const soon = UPGRADES.filter(u => !S.upg[u.id] && !Econ.reqMet(S, u)).sort((a, b) => a.cost - b.cost).slice(0, 3);
    structKey = 'u' + av.map(u => u.id).join(',');
    body.innerHTML = `${av.length ? `<button class="btn wide" id="buyAll"></button>` : ''}
      <div class="cards">${av.map(u => `<div class="card" data-u="${u.id}">${uIcon(u)}<div class="info"><b>${u.name}</b><small>${u.sub}</small><span class="eff">${u.effect}</span></div><button class="buy" data-ubuy="${u.id}"><b></b></button></div>`).join('') || `<p class="empty">${L('Teď tu nic není. Stav dál a vylepšení přibudou.', 'Nothing here right now. Keep building and upgrades will appear.')}</p>`}</div>
      ${soon.length ? `<h3>${L('Brzy', 'Coming up')}</h3><div class="cards soon">${soon.map(u => `<div class="card dim">${uIcon(u)}<div class="info"><b>${u.name}</b><small>${u.sub}</small><span class="eff">${reqText(u)}</span></div></div>`).join('')}</div>` : ''}
      ${owned.length ? `<details class="owned"><summary>${L(`Koupená vylepšení (${owned.length})`, `Bought upgrades (${owned.length})`)}</summary><div class="chips">${owned.map(u => `<span class="chip" title="${esc(u.effect)}">${u.kind === 'b' ? '' : (u.kind === 'tap' ? '✋' : U_ICON[u.id] || '✨') + ' '}${u.name}${u.kind === 'b' ? ` · ${u.sub}` : ''}</span>`).join('')}</div></details>` : ''}`;
    for (const cv of body.querySelectorAll('canvas.uico')) Scene.icon(cv, cv.dataset.ub, Math.max(1, Scene.LV(S.owned[cv.dataset.ub])), 40);
  }
  function refreshUpg() {
    const av = Econ.upgAvailable(S);
    if ('u' + av.map(u => u.id).join(',') !== structKey) { renderUpg($('#body')); }
    let n = 0, sum = 0;
    for (const card of document.querySelectorAll('#body .card[data-u]')) {
      const u = U_INDEX[card.dataset.u], c = Econ.upgCost(S, u), can = c <= S.coins;
      const btn = card.querySelector('.buy'); btn.disabled = !can; btn.querySelector('b').innerHTML = coinSvg + fmt(c);
      card.classList.toggle('can', can);
    }
    for (const u of av) { const c = Econ.upgCost(S, u); if (sum + c <= S.coins) { sum += c; n++; } }
    const all = $('#buyAll');
    if (all) { all.disabled = !n; all.innerHTML = n ? L(`Koupit vše, co se dá (${n}) · ${coinSvg}${fmt(sum)}`, `Buy all I can (${n}) · ${coinSvg}${fmt(sum)}`) : L('Na další vylepšení zatím nemáš', 'You can’t afford the next upgrade yet'); }
  }

  // ── Kronika (pověsti) ──
  let lb = null, lbAt = 0;
  function renderLegend(body) {
    const p = Econ.pending(S), next = Econ.nextLegendAt(S), base = LEGEND_BASE * Math.pow(Math.max(Econ.legendsFor(S.earnedAll), S.legends), 3);
    structKey = 'l';
    const pct = Math.max(0, Math.min(100, ((S.earnedAll - base) / Math.max(1, next - base)) * 100));
    body.innerHTML = `<div class="legend-card">
        <div class="big"><span>📜</span><b id="legN">${fmt(S.legends)}</b><small>${L('pověstí', 'legends')}</small></div>
        <p>${L(`Každá pověst přidá <b>+${Math.round(LEGEND_BONUS * 100)} %</b> ke všem výnosům: teď <b>+${fmt(S.legends * LEGEND_BONUS * 100)} %</b>.`, `Every legend adds <b>+${Math.round(LEGEND_BONUS * 100)}%</b> to all income: now <b>+${fmt(S.legends * LEGEND_BONUS * 100)}%</b>.`)}</p>
        <p class="muted">${L(`Pokolení: ${S.gen} · vyděláno celkem ${fmt(S.earnedAll)} grošů`, `Generation ${S.gen} · earned ${fmt(S.earnedAll)} groschen in total`)}</p>
      </div>
      <div class="prestige">
        <h3>${L('Předat vesnici dalšímu pokolení', 'Pass the village to the next generation')}</h3>
        <p>${L('O vsi se budou vyprávět pověsti. Začneš znovu od políčka, ale s pověstmi poroste všechno rychleji. Úspěchy a statistiky zůstávají.', 'Legends will be told of your village. You start again from a single field, but with legends everything grows faster. Achievements and stats stay.')}</p>
        <div class="gain">${p > 0 ? L(`Získáš <b>+${fmt(p)}</b> ${p === 1 ? 'pověst' : p < 5 ? 'pověsti' : 'pověstí'} (výnos ×${trunc(((1 + (S.legends + p) * LEGEND_BONUS) / (1 + S.legends * LEGEND_BONUS)), 2)})`, `You gain <b>+${fmt(p)}</b> legend${p === 1 ? '' : 's'} (income ×${trunc(((1 + (S.legends + p) * LEGEND_BONUS) / (1 + S.legends * LEGEND_BONUS)), 2)})`) : L('Zatím by ses pověsti nedočkal.', 'Not enough for a legend yet.')}</div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <small class="muted">${L(`Další pověst při ${fmt(next)} grošů vydělaných celkem`, `Next legend at ${fmt(next)} groschen earned in total`)}</small>
        <button class="btn gold wide" id="prestige" ${p > 0 ? '' : 'disabled'}>${L('Předat vesnici', 'Pass it on')}</button>
      </div>
      <h3>${L('Kronika rodu', 'Family chronicle')}</h3>
      <div class="perks">${PERKS.map(pk => `<div class="perk${S.legends >= pk.n ? ' on' : ''}"><span class="pn">${fmt(pk.n)}</span><div><b>${pk.name}</b><small>${pk.desc}</small></div><i>${S.legends >= pk.n ? '✔' : '🔒'}</i></div>`).join('')}</div>
      <h3>${L('Nejslavnější vesnice', 'Most famous villages')}</h3>
      <div id="lb" class="lb"><p class="muted">${L('Načítám…', 'Loading…')}</p></div>`;
    loadLb();
  }
  async function loadLb() {
    const el = $('#lb');
    if (!el) return;
    if (!lb || Date.now() - lbAt > 60000) {
      try { const r = await fetch('/api/scores?game=vesnicka&board=best%3Ascore&limit=10', { cache: 'no-store' }); if (!r.ok) throw new Error(String(r.status)); lb = await r.json(); lbAt = Date.now(); }
      catch (e) { if ($('#lb')) $('#lb').innerHTML = `<p class="muted">${L('Žebříček teď není dostupný.', 'The leaderboard is not available right now.')}</p>`; return; }
    }
    const box = $('#lb'); if (!box) return;
    const rows = (lb.entries || []).map(e => `<tr class="${e.me ? 'me' : ''}"><td>${e.rank}.</td><td>${esc(e.nickname)}</td><td>${fmt(e.value)} 📜</td></tr>`).join('');
    box.innerHTML = rows ? `<table>${rows}</table>` : `<p class="muted">${L('Zatím tu nikdo není. Buď první!', 'Nobody here yet. Be the first!')}</p>`;
    if (!lb.signedIn) box.innerHTML += `<p class="muted">${L('Přihlas se v herním centru a tvoje vesnice se objeví v žebříčku.', 'Sign in at the game center and your village will appear here.')}</p>`;
  }

  // ── Úkoly a úspěchy ──
  function renderTasks(body) {
    const d = Econ.daily(S);
    structKey = 't' + d.day;
    body.innerHTML = `<h3>${L('Úkoly dne', 'Today’s tasks')}</h3><p class="muted">${L('Každý den nové, stejné pro všechny. Splň všechny tři a vesnici přijde požehnání: výnos ×2 na 15 minut.', 'New every day, the same for everyone. Complete all three and the village is blessed: income ×2 for 15 minutes.')}</p>
      <div class="tasks">${d.tasks.map((tk, i) => `<div class="task" data-t="${i}"><div class="info"><b>${taskText(tk)}</b><div class="bar"><i></i></div><small></small></div><button class="btn" data-claim="${i}"></button></div>`).join('')}</div>
      <h3>${L(`Úspěchy · ${Econ.achCount(S)} / ${ACHIEVEMENTS.length}`, `Achievements · ${Econ.achCount(S)} / ${ACHIEVEMENTS.length}`)}</h3>
      <p class="muted">${L(`Každý úspěch přidá +${Math.round(ACH_BONUS * 100)} % ke všem výnosům.`, `Each achievement adds +${Math.round(ACH_BONUS * 100)}% to all income.`)}</p>
      <div class="achs">${ACHIEVEMENTS.map(a => `<div class="ach${S.ach[a.id] ? ' on' : ''}" title="${esc(a.desc)}"><i>${S.ach[a.id] ? '🏅' : '🔒'}</i><b>${a.name}</b><small>${a.desc}</small></div>`).join('')}</div>`;
  }
  function taskText(tk) { const q = DAILY.find(x => x.kind === tk.kind); return q.text(tk.kind === 'earn' ? fmt(tk.n) + L(' grošů', ' groschen') : tk.n); }
  function refreshTasks() {
    const d = Econ.daily(S);
    if ('t' + d.day !== structKey) return renderTasks($('#body'));
    for (const el of document.querySelectorAll('#body .task')) {
      const tk = d.tasks[+el.dataset.t], p = Econ.dailyProgress(S, tk);
      el.querySelector('.bar i').style.width = `${(p / tk.n) * 100}%`;
      el.querySelector('small').textContent = tk.kind === 'earn' ? `${fmt(p)} / ${fmt(tk.n)}` : `${p} / ${tk.n}`;
      const b = el.querySelector('button');
      b.disabled = tk.claimed || p < tk.n;
      b.innerHTML = tk.claimed ? L('Hotovo ✔', 'Done ✔') : L(`Vyzvednout ${coinSvg}${fmt(Econ.dailyReward(S))}`, `Claim ${coinSvg}${fmt(Econ.dailyReward(S))}`);
      el.classList.toggle('ready', !tk.claimed && p >= tk.n);
    }
  }

  // ── Více: statistiky, nastavení, nápověda ──
  function renderMore(body) {
    structKey = 'm';
    const st = S.stats;
    const rows = [
      [L('Čas ve hře', 'Time played'), fmtDur(st.playTime)], [L('Pokolení', 'Generation'), S.gen], [L('Vyděláno celkem', 'Earned in total'), fmt(S.earnedAll)],
      [L('Vyděláno v tomto pokolení', 'Earned this generation'), fmt(S.earnedGen)], [L('Nejvyšší výnos', 'Best income'), fmt(st.bestRate, 1) + L(' za s', ' /s')],
      [L('Postaveno budov', 'Buildings built'), fmt(st.bought)], [L('Koupeno vylepšení', 'Upgrades bought'), fmt(st.upgrades)], [L('Klepnutí', 'Taps'), fmt(S.taps)],
      ...CREATURES.map(c => [`${C_ICON[c.id]} ${c.name}`, fmt(S.caught[c.id] || 0)]), [L('Utekly ti', 'Got away'), fmt(st.missed)],
      [L('Bez tebe vesnice vydělává', 'Earns without you for'), fmtDur(Econ.offlineCap(S))],
    ];
    body.innerHTML = `<h3>${L('Statistiky', 'Statistics')}</h3><table class="stats">${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
      <h3>${L('Nastavení', 'Settings')}</h3>
      <label class="set"><input type="checkbox" id="setSound" ${S.settings.sound ? 'checked' : ''}> ${L('Zvukové efekty', 'Sound effects')}</label>
      <label class="set"><input type="checkbox" id="setSci" ${S.settings.sci ? 'checked' : ''}> ${L('Vědecký zápis čísel (1,23e15)', 'Scientific notation (1.23e15)')}</label>
      <h3>${L('Jak hrát', 'How to play')}</h3>${help()}
      <h3>${L('Začít úplně znovu', 'Start over completely')}</h3>
      <p class="muted">${L('Smaže celou vesnici, pověsti i úspěchy.', 'Deletes the whole village, legends and achievements.')}</p>
      <button class="btn danger" id="reset">${L('Smazat vesnici', 'Delete the village')}</button>`;
  }
  function help() {
    return `<ul class="help">${[
      L('<b>Klepej do vesnice</b> a vydělávej groše. Za groše stav <b>řemesla</b>: každé vydělává samo, i když hru zavřeš (až 8 hodin, víc přidá Ponocný a pověsti).', '<b>Tap the village</b> to earn groschen. Spend them on <b>trades</b>: each one earns on its own, even while the game is closed (up to 8 hours, more with the Night watchman and legends).'),
      L('Při <b>25, 50, 100…</b> kusech jednoho řemesla získáš <b>mistrovství</b>: výnos řemesla se zdvojnásobí.', 'At <b>25, 50, 100…</b> of one trade you reach a <b>mastery</b>: that trade’s output doubles.'),
      L('<b>Roční období</b> se střídají každých 5 minut a jsou stejná pro všechny. Řemesla v sezóně vydělávají dvojnásob.', '<b>Seasons</b> change every 5 minutes and are the same for everyone. Trades in season earn double.'),
      L('Občas se ve vsi zjeví <b>pohádková bytost</b>. Klepni na ni, než zmizí: bludička najde poklad, vodník půjčí hrníček štěstí, čert dá sílu do klepání, Krakonoš zlevní stavby a hospodáříček postaví budovy zdarma.', 'Now and then a <b>fairy-tale creature</b> appears. Tap it before it vanishes: the will-o’-wisp finds treasure, the water goblin lends his lucky pot, the devil powers your taps, Krakonoš cuts prices and the house sprite builds for free.'),
      L('Až vyděláš hodně, <b>předej vesnici dalšímu pokolení</b> v Kronice. Začneš znovu, ale každá pověst zrychlí všechno o 5 % a odemyká trvalé výhody.', 'Once you have earned a lot, <b>pass the village on</b> in the Chronicle. You start over, but every legend speeds everything up by 5% and unlocks lasting perks.'),
      L('Po přihlášení v herním centru se vesnice ukládá do účtu a pokračuje na jiném zařízení.', 'Sign in at the game center and the village is saved to your account and continues on other devices.'),
    ].map(x => `<li>${x}</li>`).join('')}</ul>`;
  }

  function refresh() {
    hud();
    if (tab === 'build') { if (buildKey() !== structKey) renderBuild($('#body')); refreshBuild(); }
    else if (tab === 'upg') refreshUpg();
    else if (tab === 'tasks') refreshTasks();
    else if (tab === 'legend') { const el = $('#legN'); if (el && el.textContent !== fmt(S.legends)) renderLegend($('#body')); const pb = $('#prestige'); if (pb) pb.disabled = Econ.pending(S) < 1; }
  }

  // ── Oznámení ──
  function toast(html, kind = '') {
    const box = $('#toasts'), el = document.createElement('div');
    el.className = 'toast ' + kind; el.innerHTML = html; box.appendChild(el);
    while (box.children.length > (innerWidth < 700 ? 2 : 3)) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, kind === 'big' ? 4200 : 3000);
  }
  // ── Okna ──
  function modal(html, buttons) {
    const m = $('#modal');
    m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}<div class="acts">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${b.text}</button>`).join('')}</div></div>`;
    m.hidden = false;
    m.onclick = e => { const b = e.target.closest('[data-i]'); if (b) { const f = buttons[+b.dataset.i].fn; m.hidden = true; m.innerHTML = ''; if (f) f(); } };
    const first = m.querySelector('.btn'); if (first) first.focus();
  }
  const closeModal = () => { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; };

  function bind(handlers) {
    $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { setTab(b.dataset.tab); Sound.play.tap(); } });
    const body = $('#body');
    let hold = null;
    const stopHold = () => { clearTimeout(hold); clearInterval(hold); hold = null; };
    body.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-buy]');
      if (!b || b.disabled) return;
      stopHold();
      hold = setTimeout(() => { hold = setInterval(() => { if (!handlers.buy(+b.dataset.buy, amount, true)) stopHold(); }, 110); }, 450);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) body.addEventListener(ev, stopHold);
    body.addEventListener('click', e => {
      const t = e.target;
      const b = t.closest('[data-buy]'); if (b) { handlers.buy(+b.dataset.buy, amount); return; }
      const a = t.closest('[data-amt]'); if (a) { amount = a.dataset.amt === 'max' ? 'max' : +a.dataset.amt; for (const x of body.querySelectorAll('[data-amt]')) x.setAttribute('aria-pressed', String(x === a)); refresh(); return; }
      const u = t.closest('[data-ubuy]'); if (u) { handlers.upg(u.dataset.ubuy); return; }
      if (t.closest('#buyAll')) { handlers.buyAll(); return; }
      if (t.closest('#prestige')) { handlers.prestige(); return; }
      const c = t.closest('[data-claim]'); if (c) { handlers.claim(+c.dataset.claim); return; }
      if (t.closest('#reset')) { handlers.reset(); return; }
    });
    body.addEventListener('change', e => {
      if (e.target.id === 'setSound') handlers.setting('sound', e.target.checked);
      if (e.target.id === 'setSci') handlers.setting('sci', e.target.checked);
    });
    for (const id of ['#edgeL', '#edgeR']) $(id).addEventListener('click', () => Scene.focusCreature());
    $('#soundBtn').addEventListener('click', () => handlers.setting('sound', !S.settings.sound));
  }
  function soundIcon() { $('#soundBtn').textContent = S.settings.sound ? '🔊' : '🔇'; $('#soundBtn').setAttribute('aria-label', S.settings.sound ? L('Vypnout zvuky', 'Mute sounds') : L('Zapnout zvuky', 'Unmute sounds')); }

  function init(state, handlers) {
    S = state;
    tabs(); bind(handlers); soundIcon();
    document.documentElement.lang = LANG;
    $('.back').setAttribute('aria-label', L('Zpět do herního centra', 'Back to the game center'));
    render();
  }
  return { init, render, refresh, toast, modal, closeModal, setTab, soundIcon, coinSvg, C_ICON, help, get tab() { return tab; }, set state(v) { S = v; } };
})();
