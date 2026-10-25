// One millstone aboard, at sea: the hold list names it (0213).
(async () => {
  const f = window.fwt;
  // The quest test's own card closes first: its close event comes a moment later.
  document.getElementById('quest-card').close();
  await new Promise((r) => setTimeout(r, 200));
  f.world.trade.quests.byId['rooks-thanks'] = { step: 'done', counts: [], chose: {} };
  f.world.trade.quests.byId['westholm-mill'].counts = [1, 0, 0];
  f.world.trade.captain.cargo.fish = 2;
  f.quests.check();
  document.getElementById('hud-cargo-box').click();
})();
