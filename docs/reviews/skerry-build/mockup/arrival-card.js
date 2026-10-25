// Mockup: docking at Skerry with Maren's plot not chosen. Maren speaks; the button opens the Island tab.
(async () => {
  const { QuestCard } = await import('/src/ui/questCard.ts');
  const { cardFor } = await import('/src/ui/questView.ts');
  const card = cardFor(fwt.quests, fwt.world.map, 'westholm-mill', 'finished');
  card.kind = 'step';
  card.arc = 'Skerry';
  card.speech = "I brought a loaf and a stake, and the stake's in! That's your plot, captain, the one with the number: a warehouse or a bakehouse?";
  card.ask = 'Choose your building';
  card.where = 'Plot 2, staked by Maren';
  card.stepNo = 0; card.steps = 0;
  const qc = new QuestCard(document.getElementById('quest-card'));
  qc.show(card, 'Skerry');
  const d = document.getElementById('quest-card');
  d.querySelector('.quest-arrival small').textContent = 'Your island · Maren is waiting by her stake';
  d.querySelector('.quest-arc').remove();
  d.querySelector('.quest-tag').textContent = 'Your plot';
  d.querySelector('.quest-actions')?.remove();
  const go = d.querySelector('.quest-to-market');
  go.textContent = 'To the island →';
  go.classList.add('d-btn', 'brass');
})();
