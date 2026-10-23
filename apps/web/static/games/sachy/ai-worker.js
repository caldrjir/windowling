'use strict';
// Výpočet tahu mimo hlavní vlákno: { fen, keys, opt } → { f, t, pr }
importScripts('engine.js');
onmessage = (e) => {
  const { fen, keys, opt, id } = e.data;
  const pos = new Chess.Pos(fen);
  if (keys) pos.keys = keys.slice();
  const res = Chess.search(pos, opt);
  postMessage({ id, move: res && res.move ? { f: res.move.f, t: res.move.t, pr: res.move.pr } : null, score: res ? res.score : 0 });
};
