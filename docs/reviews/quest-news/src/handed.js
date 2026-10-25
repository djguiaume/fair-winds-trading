// Timber aboard for Maren's sails at Westholm: "Hand over" on her card pays the market price,
// and her next card says the step is done and paid (0213).
(async () => {
  const f = window.fwt;
  // The quest test's own card closes first: its close event comes a moment later.
  document.getElementById('quest-card').close();
  await new Promise((r) => setTimeout(r, 200));
  // Rook's thanks done, as it is by the time Maren asks (the quest test only reaches its step).
  f.world.trade.quests.byId['rooks-thanks'] = { step: 'done', counts: [], chose: {} };
  f.world.trade.captain.cargo.timber = 10;
  f.dock('westholm');
  await new Promise((r) => setTimeout(r, 300));
  document.querySelector('#quest-card .quest-hand')?.click();
})();
