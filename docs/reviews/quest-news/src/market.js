// The harbour's market after the pick-up: the side lists the quest cargo (0213).
(async () => {
  const f = window.fwt;
  // The quest test's own card closes first: its close event comes a moment later.
  document.getElementById('quest-card').close();
  await new Promise((r) => setTimeout(r, 200));
  f.world.trade.quests.byId['rooks-thanks'] = { step: 'done', counts: [], chose: {} };
  f.dock('stonehaven');
  document.querySelector('#quest-card .quest-to-market')?.click();
})();
