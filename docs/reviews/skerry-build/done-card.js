// Maren's thanks as the game builds it (cardFor › finished, the real words with {spotA} and {spotB}).
(async () => {
  const { QuestCard } = await import('/src/ui/questCard.ts');
  const { cardFor } = await import('/src/ui/questView.ts');
  const card = cardFor(fwt.quests, fwt.world.map, 'westholm-mill', 'finished');
  new QuestCard(document.getElementById('quest-card')).show(card, 'Westholm');
})();
