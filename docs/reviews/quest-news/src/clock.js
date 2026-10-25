// The bread run under way, 1:45 of 2:20 gone (0213).
(async () => {
  const f = window.fwt;
  // The quest test's own card closes first: its close event comes a moment later.
  document.getElementById('quest-card').close();
  await new Promise((r) => setTimeout(r, 200));
  // Rook's thanks done, as it is by the time Maren asks (the quest test only reaches its step).
  f.world.trade.quests.byId['rooks-thanks'] = { step: 'done', counts: [], chose: {} };
  f.world.trade.quests.byId['westholm-mill'].counts = [4, 0, 0, 1, 10500, 0];
})();
