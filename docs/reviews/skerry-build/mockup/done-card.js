/* global fwt, window, document */
// Mockup: Maren's done card at Westholm, naming the plot and its two buildings.
(async () => {
  const { QuestCard } = await import('/src/ui/questCard.ts');
  const { cardFor } = await import('/src/ui/questView.ts');
  const card = cardFor(fwt.quests, fwt.world.map, 'westholm-mill', 'finished');
  const fr = document.documentElement.lang === 'fr';
  card.speech = fr
    ? "Le moulin a retrouvé ses ailes, et tout Westholm est à la fête des moissons ! Merci, capitaine. Et un terrain à Skerry, de ma part : l’entrepôt ou la boulangerie !"
    : "The mill has its sails again, and all of Westholm is at the harvest fair! Thank you, captain. And there's a plot on Skerry from me: a warehouse or a bakehouse!";
  card.reward = { gold: 0, more: [fr ? 'Terrain 2 à Skerry : entrepôt ou boulangerie' : 'Plot 2 on Skerry: warehouse or bakehouse'] };
  new QuestCard(document.getElementById('quest-card')).show(card, 'Westholm');
})();
