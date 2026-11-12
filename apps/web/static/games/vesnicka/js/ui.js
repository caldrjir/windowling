'use strict';
// ── VESNIČKA · rozhraní: horní lišta, panel se záložkami, oznámení, okna ─────────────
const UI = (() => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let S = null, H = null, tab = 'build', amount = 1, structKey = '', board = 'best:score';
  const U_ICON = { kaplicka: '⛪', skola: '🏫', posta: '📯', silnice: '🛣️', zeleznice: '🚂', elektrina: '💡', rozhlas: '📢', pohadky: '📖', bylinkarka: '🌿', lucerna: '🏮', pranostiky: '🌦️', fletna: '🎶', kalendar: '📅', ponocny: '🌙', vecernice: '⭐' };
  const C_ICON = { bludicka: '✨', vodnik: '🐸', cert: '😈', krakonos: '⛰️', hospodaricek: '🧙', nesro: '🎒' };
  const cName = id => (id === 'nesro' ? NESRO.name : (C_INDEX[id] || {}).name || '');
  const BUFF_ICON = { vodnik: '🫖', cert: '🔥', krakonos: '⛰️', blessing: '🌟', nesro: '🥧' };
  const BUFF_NAME = { vodnik: L('Vodníkův hrníček', 'Goblin’s pot'), cert: L('Čertovská síla', 'Devilish strength'), krakonos: L('Krakonošova štědrost', 'Krakonoš’s gift'), blessing: L('Požehnání', 'Blessing'), nesro: L('Nesrovy koláče', 'Nesro’s kolache') };
  const clockAt = sec => new Date(Date.now() + sec * 1000).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  const coinSvg = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#f2c14e" stroke="#a8771e" stroke-width="1.6"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#c9952e" stroke-width="1.2"/><path d="M9.5 9.5h5M12 9.5v6" stroke="#a8771e" stroke-width="1.8" stroke-linecap="round"/></svg>';

  // ── Lišta a HUD ──
  function hud() {
    $('#coins').textContent = fmt(S.coins);
    const r = Econ.rate(S);
    $('#rate').textContent = L(`+${fmt(r, 1)} za s`, `+${fmt(r, 1)} /s`);
    const sn = seasonAt(Date.now());
    $('#season').innerHTML = `<span>${SEASONS[sn].icon}</span><span class="sn">${SEASONS[sn].name}</span><b>${fmtClock(seasonLeft(Date.now()))}</b>`;
    $('#buffs').innerHTML = (S.steward && S.settings.auto ? `<span class="buff b-steward" title="${esc(L('Šafář nakupuje za tebe', 'The steward buys for you'))}"><i>🤵</i>${L('Šafář', 'Steward')}</span>` : '') + S.buffs.map(b => `<span class="buff b-${b.id}" title="${esc(BUFF_NAME[b.id] || '')}"><i>${BUFF_ICON[b.id] || '✨'}</i>${b.kind === 'cost' ? '−50 %' : '×' + b.mul}<b>${fmtClock(b.t)}</b><s style="width:${Math.max(0, Math.min(100, (b.t / b.max) * 100))}%"></s></span>`).join('');
    const side = Scene.creatureSide();
    const cr = Scene.creature;
    for (const [id, s] of [['#edgeL', -1], ['#edgeR', 1]]) {
      const el = $(id);
      el.hidden = side !== s;
      if (side === s && cr) el.innerHTML = s < 0 ? `‹ ${C_ICON[cr.id]} ${cName(cr.id)}` : `${C_ICON[cr.id]} ${cName(cr.id)} ›`;
    }
    quick();
    const nd = $('#newsBtn .dot'); if (nd) nd.hidden = (S.seen.news || 0) >= NEWS_VERSION;
    // odznáčky na záložkách
    const upgN = Econ.upgAvailable(S).filter(u => Econ.upgCost(S, u) <= S.coins).length;
    badge('upg', upgN);
    const d = Econ.daily(S), claim = d.tasks.filter(t => !t.claimed && Econ.dailyProgress(S, t) >= t.n).length;
    badge('tasks', claim);
    badge('legend', Econ.pending(S) > 0 ? '+' + fmt(Econ.pending(S)) : 0);
  }
  // Rychlý nákup: to, co se nejrychleji zaplatí (stejná volba jako u šafáře).
  let best = null;
  function quick() {
    const q = $('#quick');
    q.hidden = !S.settings.quick || !Econ.total(S) && S.coins < BUILDINGS[0].cost;
    if (q.hidden) return;
    best = Econ.bestBuy(S, H.tps());
    if (!best) { q.hidden = true; return; }
    const can = best.cost <= S.coins;
    q.disabled = !can;
    const html = `<i>⚡</i><span><small>${L('Nejlepší koupě', 'Best buy')}</small><b>${esc(best.name)}${best.sub && best.kind === 'u' ? ` · ${esc(best.sub)}` : ''}</b></span><em>${can ? coinSvg + fmt(best.cost) : '⏳ ' + fmtClock(best.wait)}</em>`;
    if (q._h !== html) { q.innerHTML = html; q._h = html; }
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
    const stew = S.steward
      ? `<div class="steward"><span class="st-n">🤵 <b>${L('Šafář', 'Steward')}</b></span><label class="sw"><input type="checkbox" id="autoBuy" ${S.settings.auto ? 'checked' : ''}><i></i>${L('Nakupuje sám', 'Buys on his own')}</label><button class="btn small" id="smartBuy">${L('Nakoupit chytře', 'Buy smart')}</button></div>`
      : Econ.legendsTotal(S) > 0 ? `<p class="hint-card">🤵 ${L(`Šafáře, který nakupuje za tebe, najmeš v Kronice za ${STEWARD_COST} pověsti.`, `Hire a steward who buys for you in the Chronicle for ${STEWARD_COST} legends.`)}</p>` : '';
    body.innerHTML = `${stew}<div class="amounts" role="group" aria-label="${L('Kolik kupovat', 'How many to buy')}">${[1, 10, 100, 'max'].map(a => `<button data-amt="${a}" aria-pressed="${amount === a}">${a === 'max' ? 'MAX' : '×' + a}</button>`).join('')}</div>
      <div class="rows">${vis.map(b => { const i = B_INDEX[b.id], locked = !S.owned[b.id];
        return `<div class="row${locked ? ' locked' : ''}" data-b="${i}">
          <canvas class="ico" data-lv="-1" aria-hidden="true"></canvas>
          <div class="info"><div class="nm"><b>${b.name}</b><span class="cnt"></span>${b.season === sn ? `<span class="tag">${SEASONS[sn].icon} ${L('sezóna', 'in season')}</span>` : ''}<span class="mx"></span></div>
          <div class="sub">${locked ? `<span class="desc">${b.desc}</span>` : `<span class="prod"></span>`}</div>
          ${locked ? '' : '<div class="ms"><i></i><span></span></div>'}</div>
          <div class="btns"><button class="buy" data-buy="${i}"><small></small><b></b></button>${locked ? '' : `<button class="to" data-to="${i}" hidden></button>`}</div></div>`; }).join('')}</div>
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
      const mx = Econ.maxAfford(S, i);
      row.querySelector('.mx').textContent = mx ? L(`max +${mx}`, `max +${mx}`) : '';
      // kolik chybí do dalšího mistrovství nebo vylepšení
      const to = row.querySelector('.to');
      if (to) {
        const tg = target(i);
        to.hidden = !tg;
        if (tg) {
          const need = tg.at - n, c = Econ.costOf(S, i, need);
          to.dataset.n = need;
          to.disabled = c > S.coins;
          to.innerHTML = `${tg.icon} +${need} → ${tg.at} · ${coinSvg}${fmt(c)}`;
          to.title = tg.title;
        }
      }
    }
  }
  /** Nejbližší cíl řemesla: další mistrovství nebo stupeň vylepšení, který ještě nemáš. */
  function target(i) {
    const b = BUILDINGS[i], n = S.owned[b.id];
    const ms = Econ.nextMilestone(n), tier = TIER_REQ.findIndex((r, t) => r > n && !S.upg[b.id + (t + 1)]);
    const tr = tier >= 0 ? TIER_REQ[tier] : null;
    if (ms == null && tr == null) return null;
    if (tr != null && (ms == null || tr < ms)) return { at: tr, icon: '🔨', title: L(`Do vylepšení ${TIER_NAMES[tier]}`, `To the upgrade ${TIER_NAMES[tier]}`) };
    return { at: ms, icon: '⭐', title: L(`Do mistrovství: výnos ×${Econ.milestoneBase(S)}`, `To mastery: output ×${Econ.milestoneBase(S)}`) };
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
    const p = Econ.pending(S), next = Econ.nextLegendAt(S), base = LEGEND_BASE * Math.pow(Math.max(Econ.legendsFor(S.earnedAll), Econ.legendsTotal(S)), 3), tot = Econ.legendsTotal(S);
    structKey = 'l';
    const pct = Math.max(0, Math.min(100, ((S.earnedAll - base) / Math.max(1, next - base)) * 100));
    body.innerHTML = `<div class="legend-card">
        <div class="big"><span>📜</span><b id="legN">${fmt(S.legends)}</b><small>${L('pověstí', 'legends')}</small></div>
        <p>${L(`Každá pověst přidá <b>+${Math.round(LEGEND_BONUS * 100)} %</b> ke všem výnosům: teď <b>+${fmt(S.legends * LEGEND_BONUS * 100)} %</b>.`, `Every legend adds <b>+${Math.round(LEGEND_BONUS * 100)}%</b> to all income: now <b>+${fmt(S.legends * LEGEND_BONUS * 100)}%</b>.`)}</p>
        <p class="muted">${L(`Pokolení: ${S.gen} · vyděláno celkem ${fmt(S.earnedAll)} grošů`, `Generation ${S.gen} · earned ${fmt(S.earnedAll)} groschen in total`)}${S.spent ? L(` · za šafáře utraceno ${S.spent} (kronika počítá všech ${tot})`, ` · ${S.spent} spent on the steward (the chronicle counts all ${tot})`) : ''}</p>
      </div>
      <div class="steward-card${S.steward ? ' on' : ''}">
        <span class="sc-i">🤵</span>
        <div><b>${L('Šafář', 'Steward')}</b><small>${S.steward ? L('Slouží ti napořád: nakupuje nejvýhodněji, i když nejsi u hry. Zapneš ho v Řemeslech.', 'At your service for good: he buys the best deals, even while you are away. Switch him on in Trades.') : L(`Nakupuje za tebe nejvýhodnější řemesla a vylepšení, i když nejsi u hry. Najmeš ho jednou provždy za ${STEWARD_COST} pověsti: ty se utratí (bonus +${Math.round(LEGEND_BONUS * 100)} % za každou zmizí), výhody kroniky zůstávají.`, `He buys the best trades and upgrades for you, even while you are away. Hire him for good for ${STEWARD_COST} legends: they are spent (their +${Math.round(LEGEND_BONUS * 100)}% each goes), chronicle perks stay.`)}</small></div>
        ${S.steward ? '<i>✔</i>' : `<button class="btn gold" id="hire" ${S.legends >= STEWARD_COST ? '' : 'disabled'}>${L(`Najmout · ${STEWARD_COST} 📜`, `Hire · ${STEWARD_COST} 📜`)}</button>`}
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
      <div class="perks">${PERKS.map(pk => `<div class="perk${tot >= pk.n ? ' on' : ''}"><span class="pn">${fmt(pk.n)}</span><div><b>${pk.name}</b><small>${pk.desc}</small></div><i>${tot >= pk.n ? '✔' : '🔒'}</i></div>`).join('')}</div>
      <h3>${L('Žebříčky', 'Leaderboards')}</h3>
      <p class="muted">${L('Klepni na hráče a porovnej se s ním.', 'Tap a player to compare yourself with them.')}</p>
      <div class="chips boards" role="tablist">${BOARDS.map(d => `<button class="chip" data-board="${d.key}" aria-selected="${d.key === board}">${d.icon} ${d.name}</button>`).join('')}</div>
      <div id="lb" class="lb"><p class="muted">${L('Načítám…', 'Loading…')}</p></div>`;
    loadLb();
  }
  /** Moje hodnota na desce (stejně zakódovaná jako v žebříčku). */
  function myBoard(key) { return key === 'total:played' ? Math.floor(S.stats.playTime) : Econ.boards(S)[key] || 0; }
  const lbCache = {};
  async function loadLb() {
    const key = board, d = BOARDS.find(x => x.key === key);
    if (!$('#lb') || !d) return;
    let data = lbCache[key];
    if (!data || Date.now() - data.at > 60000) {
      try {
        const r = await fetch(`/api/scores?game=vesnicka&board=${encodeURIComponent(key)}&limit=10`, { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        data = lbCache[key] = Object.assign(await r.json(), { at: Date.now() });
      } catch (e) { if ($('#lb') && board === key) $('#lb').innerHTML = `<p class="muted">${L('Žebříček teď není dostupný.', 'The leaderboard is not available right now.')}</p>`; return; }
    }
    const box = $('#lb'); if (!box || board !== key) return;
    const row = e => `<tr class="${e.me ? 'me' : ''}" data-nick="${esc(e.nickname)}" tabindex="0"><td>${e.rank}.</td><td>${esc(e.nickname)}</td><td>${boardValue(d, e.value)}</td></tr>`;
    const me = data.me && !data.entries.some(e => e.me) ? `<tr class="me sep"><td>${data.me.rank}.</td><td>${L('Ty', 'You')}</td><td>${boardValue(d, data.me.value)}</td></tr>` : '';
    box.innerHTML = data.entries.length ? `<table>${data.entries.map(row).join('')}${me}</table>` : `<p class="muted">${L('Zatím tu nikdo není. Buď první!', 'Nobody here yet. Be the first!')}</p>`;
    const mine = myBoard(key);
    box.innerHTML += `<p class="muted mine">${L('Tvoje hodnota', 'Yours')}: <b>${mine ? boardValue(d, mine) : '–'}</b>${data.total ? L(` · hráčů v žebříčku: ${data.total}`, ` · players on the board: ${data.total}`) : ''}</p>`;
    if (!data.signedIn) box.innerHTML += `<p class="muted">${L('Přihlas se v herním centru a nastav si přezdívku: tvoje vesnice se objeví v žebříčcích.', 'Sign in at the game center and pick a nickname: your village will appear on the boards.')}</p>`;
  }
  /** Porovnání s jiným hráčem: všechny jeho žebříčky vedle mých. */
  async function compare(nick) {
    let data = null;
    try { const r = await fetch(`/api/scores?game=vesnicka&player=${encodeURIComponent(nick)}`, { cache: 'no-store' }); if (r.ok) data = await r.json(); } catch (e) { data = null; }
    if (!data) { toast(L('Statistiky hráče teď nejdou načíst.', 'The player’s stats cannot be loaded right now.')); return; }
    const rows = BOARDS.map(d => {
      const a = myBoard(d.key), b = data.scores[d.key] || 0, win = a > b ? 'me' : b > a ? 'them' : '';
      return `<tr><td>${d.icon} ${d.name}</td><td class="${win === 'me' ? 'win' : ''}">${a ? boardValue(d, a) : '–'}</td><td class="${win === 'them' ? 'win' : ''}">${b ? boardValue(d, b) : '–'}</td></tr>`;
    }).join('');
    const wins = BOARDS.filter(d => myBoard(d.key) > (data.scores[d.key] || 0)).length, losses = BOARDS.filter(d => (data.scores[d.key] || 0) > myBoard(d.key)).length;
    modal(`<div class="compare"><div class="wico">⚖️</div><h2>${L('Ty vs.', 'You vs.')} ${esc(data.nickname)}</h2>
      <table class="stats cmp"><thead><tr><th></th><th>${L('Ty', 'You')}</th><th>${esc(data.nickname)}</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="muted">${L(`Vedeš v ${wins} z ${BOARDS.length}, ${esc(data.nickname)} v ${losses}.`, `You lead in ${wins} of ${BOARDS.length}, ${esc(data.nickname)} in ${losses}.`)}</p></div>`,
    [{ text: L('Zavřít', 'Close'), cls: 'ghost' }]);
  }

  // ── Úkoly a úspěchy ──
  function renderTasks(body) {
    const d = Econ.daily(S);
    structKey = 't' + d.day;
    body.innerHTML = `<h3>${L('Úkoly dne', 'Today’s tasks')}</h3><p class="muted">${L('Každý den nové, stejné pro všechny. Splň všechny tři a vesnici přijde požehnání: výnos ×2 na 15 minut.', 'New every day, the same for everyone. Complete all three and the village is blessed: income ×2 for 15 minutes.')}</p>
      <p class="next" id="dailyNext"></p>
      <div class="tasks">${d.tasks.map((tk, i) => `<div class="task" data-t="${i}"><div class="info"><b>${taskText(tk)}</b><div class="bar"><i></i></div><small></small></div><button class="btn" data-claim="${i}"></button></div>`).join('')}</div>
      <h3>${L(`Úspěchy · ${Econ.achCount(S)} / ${ACHIEVEMENTS.length}`, `Achievements · ${Econ.achCount(S)} / ${ACHIEVEMENTS.length}`)}</h3>
      <p class="muted">${L(`Každý úspěch přidá +${Math.round(ACH_BONUS * 100)} % ke všem výnosům.`, `Each achievement adds +${Math.round(ACH_BONUS * 100)}% to all income.`)}</p>
      <div class="achs">${ACHIEVEMENTS.map(a => { const on = !!S.ach[a.id], secret = a.hidden && !on;
        return `<div class="ach${on ? ' on' : ''}${secret ? ' secret' : ''}" title="${esc(secret ? L('Tajný úspěch', 'Secret achievement') : a.desc)}"><i>${on ? '🏅' : secret ? '❔' : '🔒'}</i><b>${secret ? '???' : a.name}</b><small>${secret ? L('Tajný úspěch', 'Secret achievement') : a.desc}</small></div>`; }).join('')}</div>`;
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
    const nx = $('#dailyNext'), left = Econ.dailyLeft();
    if (nx) {
      const all = d.tasks.every(t => t.claimed);
      nx.className = 'next' + (all ? ' done' : '');
      nx.innerHTML = all ? L(`🎉 Dnešní úkoly máš hotové. Nové přijdou za <b>${fmtDur(left)}</b> (o půlnoci).`, `🎉 Today’s tasks are done. New ones arrive in <b>${fmtDur(left)}</b> (at midnight).`)
        : L(`⏰ Nové úkoly za <b>${fmtDur(left)}</b> (o půlnoci). Nesplněné do té doby propadnou.`, `⏰ New tasks in <b>${fmtDur(left)}</b> (at midnight). Unfinished ones expire then.`);
    }
  }

  // ── Více: statistiky, nastavení, nápověda ──
  function renderMore(body) {
    structKey = 'm';
    const st = S.stats;
    const rows = [
      [L('Čas ve hře', 'Time played'), fmtDur(st.playTime)], [L('Pokolení', 'Generation'), S.gen], [L('Vyděláno celkem', 'Earned in total'), fmt(S.earnedAll)],
      [L('Vyděláno v tomto pokolení', 'Earned this generation'), fmt(S.earnedGen)], [L('Nejvyšší výnos', 'Best income'), fmt(st.bestRate, 1) + L(' za s', ' /s')],
      [L('Postaveno budov', 'Buildings built'), fmt(st.bought)], [L('Nejvíc budov naráz', 'Most buildings at once'), fmt(st.maxBuildings)], ...(S.steward ? [[L('Šafář nakoupil', 'Steward purchases'), fmt(st.stewardBuys)]] : []), [L('Koupeno vylepšení', 'Upgrades bought'), fmt(st.upgrades)], [L('Klepnutí', 'Taps'), fmt(S.taps)],
      ...CREATURES.map(c => [`${C_ICON[c.id]} ${c.name}`, fmt(S.caught[c.id] || 0)]), [L('Utekly ti', 'Got away'), fmt(st.missed)],
      [L('Bez tebe vesnice vydělává', 'Earns without you for'), fmtDur(Econ.offlineCap(S))],
    ];
    const cap = Econ.offlineCap(S);
    body.innerHTML = `<div class="away-card"><b>🌙 ${L('Odcházíš?', 'Heading off?')}</b>
      <p>${L(`Bez tebe vesnička vydělává až <b>${fmtDur(cap)}</b>. Vrať se nejpozději <b>v ${clockAt(cap)}</b>, jinak začne zahálet. Čím dřív se vrátíš a groše utratíš, tím rychleji poroste.`, `Without you the village earns for up to <b>${fmtDur(cap)}</b>. Come back by <b>${clockAt(cap)}</b> at the latest or it starts idling. The sooner you come back and spend, the faster it grows.`)}</p>
      <p class="muted">${S.steward && S.settings.auto ? L('Šafář bude mezitím nakupovat za tebe.', 'Meanwhile the steward keeps buying for you.') : L(`Za tu dobu vydělá zhruba ${fmt(Econ.rate(S, seasonAt(Date.now()), false) * cap)} grošů.`, `In that time it earns about ${fmt(Econ.rate(S, seasonAt(Date.now()), false) * cap)} groschen.`)} ${L('Delší výdělek bez tebe dává Ponocný a kronika.', 'The Night watchman and the chronicle make it last longer.')}</p></div>
      <h3>${L('Statistiky', 'Statistics')}</h3><table class="stats">${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
      <h3>${L('Nastavení', 'Settings')}</h3>
      <label class="set"><input type="checkbox" id="setMusic" ${S.settings.music ? 'checked' : ''}> ${L('Hudba', 'Music')}</label>
      ${vol('musicVol', L('Hlasitost hudby', 'Music volume'), !S.settings.music)}
      <label class="set"><input type="checkbox" id="setSound" ${S.settings.sound ? 'checked' : ''}> ${L('Zvukové efekty', 'Sound effects')}</label>
      ${vol('sfxVol', L('Hlasitost zvuků', 'Sound volume'), !S.settings.sound)}
      ${S.settings.mute ? `<p class="muted">🔇 ${L('Hudbu i zvuky teď ztlumilo tlačítko nahoře. Zapneš je stejným tlačítkem.', 'Music and sounds are muted by the button at the top. The same button turns them back on.')}</p>` : ''}
      ${window.GCMusic && !window.GCMusic.gameMusic ? `<p class="muted">🎧 ${L('V herním centru máš zvolený vlastní playlist nebo bez hudby, hudba vesnice proto mlčí.', 'The game center is set to your own playlist or no music, so the village music stays quiet.')} <button class="btn small" data-gcmusic>${L('Hudba v centru', 'Center music')}</button></p>` : ''}
      <label class="set"><input type="checkbox" id="setSci" ${S.settings.sci ? 'checked' : ''}> ${L('Vědecký zápis čísel (1,23e15)', 'Scientific notation (1.23e15)')}</label>
      <label class="set"><input type="checkbox" id="setQuick" ${S.settings.quick ? 'checked' : ''}> ${L('Tlačítko ⚡ Nejlepší koupě na návsi', 'The ⚡ Best buy button on the village green')}</label>
      <h3>${L('Jak hrát', 'How to play')}</h3>${help()}
      <h3>${L('Začít úplně znovu', 'Start over completely')}</h3>
      <p class="muted">${L('Smaže celou vesnici, pověsti i úspěchy.', 'Deletes the whole village, legends and achievements.')}</p>
      <button class="btn danger" id="reset">${L('Smazat vesnici', 'Delete the village')}</button>`;
  }
  // Posuvník hlasitosti 0–100 % (mění se hned, uloží se po puštění).
  function vol(k, label, off) {
    const v = S.settings[k] ?? (k === 'musicVol' ? 55 : 100);
    return `<label class="set vol${off ? ' off' : ''}"><span>${label}</span><input type="range" min="0" max="100" step="5" value="${v}" data-vol="${k}" style="--p:${v}%"><output>${v} %</output></label>`;
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
    else if (tab === 'legend') { const el = $('#legN'); if (el && el.textContent !== fmt(S.legends)) renderLegend($('#body')); const pb = $('#prestige'); if (pb) pb.disabled = Econ.pending(S) < 1; const hb = $('#hire'); if (hb) hb.disabled = S.legends < STEWARD_COST; }
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
      const to = t.closest('[data-to]'); if (to) { handlers.buy(+to.dataset.to, +to.dataset.n); return; }
      if (t.closest('#smartBuy')) { handlers.smart(); return; }
      if (t.closest('#hire')) { handlers.hire(); return; }
      const bd = t.closest('[data-board]'); if (bd) { board = bd.dataset.board; for (const x of body.querySelectorAll('[data-board]')) x.setAttribute('aria-selected', String(x === bd)); $('#lb').innerHTML = `<p class="muted">${L('Načítám…', 'Loading…')}</p>`; loadLb(); return; }
      const pl = t.closest('#lb tr[data-nick]'); if (pl) { compare(pl.dataset.nick); return; }
      const a = t.closest('[data-amt]'); if (a) { amount = a.dataset.amt === 'max' ? 'max' : +a.dataset.amt; for (const x of body.querySelectorAll('[data-amt]')) x.setAttribute('aria-pressed', String(x === a)); refresh(); return; }
      const u = t.closest('[data-ubuy]'); if (u) { handlers.upg(u.dataset.ubuy); return; }
      if (t.closest('#buyAll')) { handlers.buyAll(); return; }
      if (t.closest('#prestige')) { handlers.prestige(); return; }
      const c = t.closest('[data-claim]'); if (c) { handlers.claim(+c.dataset.claim); return; }
      if (t.closest('#reset')) { handlers.reset(); return; }
    });
    body.addEventListener('change', e => {
      if (e.target.id === 'setMusic') handlers.setting('music', e.target.checked);
      if (e.target.id === 'setSound') handlers.setting('sound', e.target.checked);
      if (e.target.dataset.vol) handlers.volume(e.target.dataset.vol, +e.target.value, true);
      if (e.target.id === 'setSci') handlers.setting('sci', e.target.checked);
      if (e.target.id === 'setQuick') handlers.setting('quick', e.target.checked);
      if (e.target.id === 'autoBuy') handlers.setting('auto', e.target.checked);
    });
    body.addEventListener('input', e => {
      const k = e.target.dataset && e.target.dataset.vol;
      if (!k) return;
      e.target.style.setProperty('--p', `${e.target.value}%`);
      e.target.nextElementSibling.textContent = `${e.target.value} %`;
      handlers.volume(k, +e.target.value, false);
    });
    body.addEventListener('keydown', e => { const pl = e.target.closest && e.target.closest('#lb tr[data-nick]'); if (pl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); compare(pl.dataset.nick); } });
    for (const id of ['#edgeL', '#edgeR']) $(id).addEventListener('click', () => Scene.focusCreature());
    $('#quick').addEventListener('click', () => { if (best) handlers.quick(best); });
    $('#newsBtn').addEventListener('click', () => toggleNews());
    $('#news').addEventListener('click', e => { if (e.target.closest('[data-close]')) toggleNews(false); });
    $('#soundBtn').addEventListener('click', () => handlers.setting('mute', !silent()));
  }
  // ── Novinky ──
  function toggleNews(open) {
    const el = $('#news'), show = open == null ? el.hidden : open;
    if (show) {
      el.innerHTML = `<div class="nw-h"><b>🎁 ${L('Co je nového', 'What’s new')}</b><button data-close aria-label="${L('Zavřít', 'Close')}">✕</button></div>${NEWS.map(n => `<div class="nw-v"><small>${n.date}</small><ul>${n.items.map(([i, t]) => `<li><i>${i}</i><span>${t}</span></li>`).join('')}</ul></div>`).join('')}`;
      H.newsSeen();
    }
    el.hidden = !show;
    $('#newsBtn').setAttribute('aria-expanded', String(show));
  }
  // Tlačítko nahoře ztlumí hudbu i zvuky naráz (nastavení obou zůstane).
  const silent = () => S.settings.mute || (!S.settings.sound && !S.settings.music);
  function soundIcon() { const m = silent(); $('#soundBtn').textContent = m ? '🔇' : '🔊'; $('#soundBtn').setAttribute('aria-label', m ? L('Zapnout hudbu a zvuky', 'Unmute music and sounds') : L('Ztlumit hudbu i zvuky', 'Mute music and sounds')); }

  function init(state, handlers) {
    S = state; H = handlers;
    tabs(); bind(handlers); soundIcon();
    document.documentElement.lang = LANG;
    $('.back').setAttribute('aria-label', L('Zpět do herního centra', 'Back to the game center'));
    $('#newsBtn .nl').textContent = L('Novinky', 'What’s new');
    render();
  }
  return { init, render, refresh, toast, modal, closeModal, setTab, soundIcon, coinSvg, C_ICON, cName, clockAt, help, toggleNews, compare, get tab() { return tab; }, set state(v) { S = v; } };
})();
