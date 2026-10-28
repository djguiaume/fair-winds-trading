# The Sailing Club (v1.1): rulings and words

Story rulings for issue #260 and the club board. Voice rules: [storyteller brief](storyteller-brief.md); Wren and the regatta: [phase-5 story](../phase-5/story.md), [0217](../decisions/0217-the-saltmere-regatta.md). Wren keeps the horn, never a gun. Rewards stay pride: no perk, no stat.

## Rulings

1. **Six new races, one new series** `regatta-club` ("The Sailing Club"), pennant `pennant-club`. Won with silver or better in all six. Wren opens the club the day the Saltmere pennant (ring series) is won; the club races appear on the Quay tab from then on.
2. **Three home-water races** (no squall), unlocked by `race-greyback` done. Each starts at its own port, with that port's person as starter:
   - `race-mill`, The Mill Run: Westholm, out round the mill point and back. Starter Maren.
   - `race-light`, The Stonehaven Light Race: Stonehaven, round Teeth Rock and the light. Starter Ness.
   - `race-abbey`, The Abbey Bell: Saltmere out to Abbey Head, round Bell Rock, home. Starter Rook.
3. **Three squall races**, each unlocked by `race-greyback` done plus that sea's `outpost-*` done. One fixed squall crosses one leg at a set time after the horn, the same every attempt:
   - `race-coral-squall`, The Coral Squall: Sunreach, round Lone Palm and back. Starter Juno.
   - `race-snowberry-squall`, The Snowberry Squall: Rimewick, round Snowberry Isle and back. Starter Nell.
   - `race-sandwick-squall`, The Sandwick Scramble: Fogwatch, round Sandwick Holm and back. Starter Pip.
   The Stormbreak race stays the east sea's storm race; Sandwick is the sheltered side.
4. **Squall rule.** The squall is part of the course, so no text depends on it. With Storms off the course runs the same, the squall is plain rain and a wind shift with no damage, and the pars are set that way on all three levels. Race words say "squall", "weather" or "shower" only as flavour, never as a condition.
5. **Pars and gold.** Home waters gold 80 / 160 / 260 (bronze / silver / gold, first win only); squall races 140 / 280 / 450. The balance bots set the times. Exact buoys: the build thread picks them on the chart; where a place name above does not fit the map, use the nearest named rock and keep the title.
6. **Club board** lives at Saltmere, on the Quay tab, as a notice board beside Rook's book (he keeps the times; Wren pins them up). It opens once any race has been entered.
   - Shows every race entered, grouped by series (ring, seas, cup, club): name, your best time, medal, and the par for your ship. Races not yet unlocked are left out; unlocked but unsailed read "Not sailed yet".
   - A header line counts medals ("7 of 14"). One "Race again" button per row goes to that race's offer card.
   - It shows only your own times. No other players, no ranking, no timer pressure. Best times are kept per ship class, like the pars.

## Words

Digits, no "captain" in status lines. Wren calls the player "captain" in speech. FR: vous, « capitaine », NBSP before `: ! ? ;`.

### Club level

| Key | EN | FR |
| --- | --- | --- |
| `regatta.series.regatta-club` | The Sailing Club | Le Club de voile |
| `regatta.pennant.regatta-club` | the Sailing Club pennant | le fanion du Club de voile |
| `regatta.won.regatta-club` | Six races, six wins. The club pennant is yours, captain. You're a member for life, and I'll thank you not to wear it at Rook's table. | Six courses, six victoires. Le fanion du club est à vous, capitaine. Vous êtes membre à vie, et évitez de le porter à la table de Rook. |
| `club.open` (Wren, once, on the first club race offer) | Rook found me a shed on the quay, captain, and now it's a club. New courses round the islands, and a board for your times. A few have a squall. I put those in on purpose. | Rook m'a trouvé un hangar sur le quai, capitaine, et voilà un club. De nouveaux parcours autour des îles, et un tableau pour vos temps. Quelques-uns ont un grain. C'est voulu, de ma part. |
| `club.board.title` | Club board | Tableau du club |
| `club.board.intro` | Your times, pinned up by Wren and kept in Rook's book. | Vos temps, affichés par Wren et notés dans le livre de Rook. |
| `club.board.count` | {won} of {all} medals | {won} médailles sur {all} |
| `club.board.empty` | Nothing pinned yet. Enter a race and your first time goes up here. | Rien d'affiché pour l'instant. Courez une régate et votre premier temps s'affichera ici. |
| `club.board.unsailed` | Not sailed yet | Pas encore courue |
| `club.board.best` | Best {time} | Meilleur temps {time} |
| `club.board.par` | Par {time} | Temps de référence {time} |
| `club.board.again` | Race again | Courir à nouveau |

### Races

Each race has `name`, `race.title`, `race.copy` (Wren's offer), `race.start` (line at the line) and `race.done` (short finish line, said after the result card). Wren's `regatta.result.*` lines stay as they are.

**race-mill**
- name: The Mill Run / La course du moulin
- title: Race round the mill point / Course autour de la pointe du moulin
- copy: Maren says the flour's no use to anyone until it's across the water. So we race it. Out round the mill point and home, captain. Mind the lee under the hill. / Maren dit que la farine ne sert à rien tant qu'elle n'a pas traversé l'eau. Alors on fait la course. Autour de la pointe du moulin et retour, capitaine. Méfiez-vous de l'abri sous la colline.
- start: Sails full of flour dust, I'm told. On the horn. / Les voiles pleines de poussière de farine, paraît-il. Au coup de corne.
- done: Maren's baking you a loaf, win or not. Don't tell her I said so. / Maren vous fait un pain, gagné ou pas. Ne lui dites pas que je l'ai dit.

**race-light**
- name: The Stonehaven Light Race / La course du phare de Stonehaven
- title: Race round the Stonehaven light / Course autour du phare de Stonehaven
- copy: Ness will watch from the tower and call it. Round Teeth Rock, keep the light to port, and home to the quay. He's been timing me for years, captain. Time someone else. / Ness suivra de la tour et donnera le résultat. Autour du rocher des Dents, le phare à bâbord, et retour au quai. Il me chronomètre depuis des années, capitaine. Qu'il chronomètre quelqu'un d'autre.
- start: The light's lit, the water's clear. No excuses. On the horn. / Le phare est allumé, l'eau est dégagée. Aucune excuse. Au coup de corne.
- done: Ness wrote it down twice, to be sure. He's like that. / Ness l'a noté deux fois, pour être sûr. Il est comme ça.

**race-abbey**
- name: The Abbey Bell / La cloche de l'abbaye
- title: Race to Abbey Head and back / Course jusqu'à Abbey Head et retour
- copy: Out to Abbey Head, round Bell Rock and back to Saltmere. A long reach, a long reach home, and not a tack to hide behind, captain. Rook says the bell rings for a clean run. I've never heard it. / Jusqu'à Abbey Head, autour de Bell Rock et retour à Saltmere. Un long reaching à l'aller, un long reaching au retour, et pas un virement derrière lequel se cacher, capitaine. Rook dit que la cloche sonne pour une course nette. Je ne l'ai jamais entendue.
- start: Straight lines are the hardest to sail. On the horn. / Les lignes droites sont les plus dures à tenir. Au coup de corne.
- done: Rook says he heard something. Rook says a lot of things. / Rook dit qu'il a entendu quelque chose. Rook dit beaucoup de choses.

**race-coral-squall**
- name: The Coral Squall / Le grain des coraux
- title: Race round Lone Palm / Course autour de Lone Palm
- copy: Juno swears there's a shower that crosses the Coral Line about now. Round Lone Palm and back to Sunreach, captain. Go round the rain or through it. I'll be taking the dry way. / Juno jure qu'une averse traverse la ligne des Coraux à peu près à cette heure. Autour de Lone Palm et retour à Sunreach, capitaine. Contournez la pluie ou traversez-la. Moi, je prendrai le chemin sec.
- start: A warm squall and a warm welcome, captain. On the horn. / Un grain tiède et un accueil chaleureux, capitaine. Au coup de corne.
- done: Juno has the kettle on. Rain makes everyone thirsty. / Juno a mis la bouilloire sur le feu. La pluie donne soif à tout le monde.

**race-snowberry-squall**
- name: The Snowberry Squall / Le grain de Snowberry
- title: Race round Snowberry Isle / Course autour de l'île Snowberry
- copy: Nell says a flurry comes down off the pack ice and sweeps the cove at the turn. Round Snowberry Isle and home to Rimewick, captain. Sail round it, or sail fast through it. / Nell dit qu'une rafale de neige descend de la banquise et balaie la crique au virage. Autour de l'île Snowberry et retour à Rimewick, capitaine. Contournez-la, ou traversez-la à toute vitesse.
- start: Cold hands, warm hearts, quick boats. On the horn. / Mains froides, cœurs chauds, bateaux vifs. Au coup de corne.
- done: Nell has hot jam on bread for the winner. And for you. / Nell a du pain à la confiture chaude pour le vainqueur. Et pour vous.

**race-sandwick-squall**
- name: The Sandwick Scramble / La cavalcade de Sandwick
- title: Race round Sandwick Holm / Course autour de Sandwick Holm
- copy: Pip says there's a squall that comes over Sandwick like it has an appointment. Round the holm and back to Fogwatch, captain. Pip's bet on you. I've bet on me. / Pip dit qu'un grain arrive sur Sandwick comme s'il avait rendez-vous. Autour du holm et retour à Fogwatch, capitaine. Pip a parié sur vous. J'ai parié sur moi.
- start: Hold your hat, Pip's holding the stakes. On the horn. / Tenez votre chapeau, c'est Pip qui garde les mises. Au coup de corne.
- done: Pip says whoever lost owes amber. Nobody has amber. Good race. / Pip dit que le perdant doit de l'ambre. Personne n'en a. Belle course.

## Update 2026-10-28: the club house, early opening and the prize (Guillaume)

These replace rulings 1, 2 and 6 where they differ. Guillaume's calls are marked (G); the rest is the storyteller's pick, open to his change.

1. **The club house is a pier at Abbey Head**, not the Saltmere quay (pick, G to confirm; fallback a holm near Saltmere, then the Saltmere quay). Wren's shed, a café and the *Kestrel* lie there. The club board and all races live on that pier's Quay tab. Rook keeps the book at Saltmere; Wren pins the times up at the club.
2. **Opens right after the prologue**: the three ring races and the three home-water club races. The sea races, squall races and the Four Winds Cup keep their gates (their people, the outposts, `four-winds`). The ring races' words change from "challenge the company" to a visiting skipper's welcome.
3. **Who introduces it.** Rook gives one line after the prologue and a chart flag appears on Abbey Head; Wren speaks the arrival card on the first docking. No quest step.
4. **Prize (G): new art and a new model, for Guillaume's OK on screenshots.** A fast racing boat with almost no hold, Wren's gift when the club pennant is won (silver or better in all six club races). A sister to the *Kestrel*, called *Tern* (never "Swift", a ship line id). It can trade, with a tiny hold. Needs bot-run pars on all 3 levels and the art director's look.

### Words

| Key | EN | FR |
| --- | --- | --- |
| `club.hint` (Rook, once, after the prologue) | Wren Tally's put up a shed on Abbey Head, captain. She'll race anyone. Mind the tea. | Wren Tally a monté un hangar à Abbey Head, capitaine. Elle fait la course avec tout le monde. Méfiez-vous du thé. |
| `club.arrive` (Wren, first docking, replaces `club.open`) | Abbey Head, captain, and the best wind on the chart. Rook lent me the shed, and the kettle's mine. Every course I know is on the board. Sail one, drink tea, sail another. | Abbey Head, capitaine, et le meilleur vent de la carte. Rook m'a prêté le hangar, et la bouilloire est à moi. Toutes les courses que je connais sont sur le tableau. Faites-en une, buvez un thé, faites-en une autre. |
| `club.gift` (Wren, when the club pennant is won) | Six races, six wins, and I've nothing left to give but this. She's *Tern*, my own design, built light and built to fly. There's room for a loaf and a letter, and not much more. Look after her, captain. | Six courses, six victoires, et il ne me reste que ça à vous donner. Elle s'appelle *Tern*, ma propre conception, légère et faite pour voler. Il y a de la place pour un pain et une lettre, pas beaucoup plus. Prenez-en soin, capitaine. |
| `club.gift.toast` | *Tern* is yours | *Tern* est à vous |
