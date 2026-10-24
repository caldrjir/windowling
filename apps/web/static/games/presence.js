'use strict';
// Windowling Game Center: tells the center that this game is being played, so the
// library can show how many people are playing each game right now. Shared by all
// games (<script src="../presence.js">) and the center page (game 'hub'); it does not
// touch the game itself.
(function () {
  // A game page, or the center itself ('hub').
  const game = (location.pathname.match(/\/games\/([a-z0-9-]+)\//) || [])[1] || (location.pathname === '/' ? 'hub' : null);
  if (!game || !window.fetch) return;
  // A random id this browser keeps, so the center counts people, not tabs (no other data).
  let visitor;
  try {
    visitor = localStorage.getItem('gamecenter.visitor');
    if (!visitor) localStorage.setItem('gamecenter.visitor', (visitor = crypto.randomUUID()));
  } catch (e) {
    visitor = undefined;
  }
  let client;
  try {
    client = sessionStorage.getItem('gamecenter.presence');
    if (!client) sessionStorage.setItem('gamecenter.presence', (client = crypto.randomUUID()));
  } catch (e) {
    client = crypto.randomUUID();
  }
  const send = (leave) => {
    const body = JSON.stringify({ client, game, visitor, leave });
    if (leave && navigator.sendBeacon) {
      navigator.sendBeacon('/api/presence', new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch('/api/presence', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  };
  let timer = 0;
  const start = () => { if (timer) return; send(false); timer = setInterval(() => send(false), 25000); };
  const stop = (leave) => { clearInterval(timer); timer = 0; if (leave) send(true); };
  // Only a visible tab counts as playing.
  document.addEventListener('visibilitychange', () => (document.hidden ? stop(true) : start()));
  addEventListener('pagehide', () => stop(true));
  addEventListener('pageshow', () => { if (!document.hidden) start(); });
  if (!document.hidden) start();
})();
