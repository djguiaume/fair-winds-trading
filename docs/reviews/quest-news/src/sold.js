// The timber sold on the market: the step is paid while the harbour screen is open (0213).
(async () => {
  const f = window.fwt;
  // The quest test's own card closes first: its close event comes a moment later.
  document.getElementById('quest-card').close();
  await new Promise((r) => setTimeout(r, 200));
  // Rook's thanks done, as it is by the time Maren asks (the quest test only reaches its step).
  f.world.trade.quests.byId['rooks-thanks'] = { step: 'done', counts: [], chose: {} };
  f.world.trade.captain.cargo.timber = 8;
  f.dock('westholm');
  document.querySelector('#quest-card .quest-to-market')?.click();
  await new Promise((r) => setTimeout(r, 300));
  f.trade.sell(f.world.trade, 'timber', 8, f.world.map);
  f.quests.check();
  f.tradePanel.render();
})();
