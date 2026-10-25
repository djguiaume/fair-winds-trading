# Phase 5 story section (head storyteller, 2026-10-25)

For the Phase 5 brief (docs/phase-5/brief.md), after Guillaume picked option B, the living sea, with no pirates (14:50Z). Everything here is quest-engine data, editable in the quest builder and the `quest` tool. The voice rules of the storyteller brief still apply.

## 1. The regatta

**Who runs it: one new person, Wren Tally**, a visiting skipper who races her cutter *Kestrel* round the islands for the joy of it. She is a friendly rival, never a villain: she wants a good race, cheers when she's beaten, and buys the first round of tea. Rook keeps the times "in the book", which gives his ledger a new page without moving him from Saltmere.
- **Way of speaking:** quick and bright, she talks in marks, legs and seconds. "Two minutes clean round the marks, captain. Beat that and I'll owe you a pennant." / « Deux minutes nettes autour des marques, capitaine. Battez ça et je vous dois un fanion. »
- She needs a look in `characters.json` and a babble voice in `audio.json` (quick and light, distinct from Pip's) before her first quest merges. She brings the cast to 15 (8 women, 7 men).
- Her cutter sails as a living-sea boat (5a): it lies at Saltmere's quay and sails the course beside the player during a race, on the same sailing model. Its sail number and colour are data.

**Where and when:** the **Saltmere Regatta**, starting once `fair-winds` is done. The company has a name and Wren comes to challenge it, which is about one hour into the game. Saltmere has Kit's buoyed reef gap and Rook's book.

**The races (8 in all, as quests with timed steps):**
- **Ring series (3), after `fair-winds`:** (a) round Kit's buoys off Saltmere; (b) through the reef gap to Port Calda; (c) round Greyback Ridge and home. Each one teaches a point of sail the player already knows, now against the clock.
- **Sea races (4), one after each outpost is founded:** each one is about the sea's own feature, so the hard seas finally get steps of their own. South: the Coral Line shallows (a shallow keel wins). West: a lap of the Smoulder. North: up the Floe Line. East: across the Stormbreak in a lull. The giver is Wren and the starter is the sea's keeper, which gives the keepers new lines after their arc.
- **The Four Winds Cup (1), after `four-winds`:** a long race that touches every quarter and finishes at Skerry's pier.
- **Shape:** a fixed course of quest buoys (`quest buoy`), a pinned wind (`quest wind`) so every attempt is the same, and medal pars for bronze, silver and gold, with a personal best kept. Any ship may enter. The balance thread sets the pars for each ship class on all three levels. Nothing fails: a slow finish still finishes, and any race can be sailed again from the Quay tab.

**Rewards (all data):**
- Gold for the first time each medal is won, never again on a re-run.
- A **pennant** for the masthead for each series won (ring, seas, cup). This needs flags as data, which the review moves into Phase 5.
- The **Cup** on Skerry's pier (an `after:` prop) and a line in Rook's book. No perk and no stat: racing gives pride, not power, so trading balance stays put.

## 2. Standing orders

- **Who:** every person whose arc is done (14, plus Wren after the regattas).
- **Shape:** a voiced version of today's help orders. On the Quay tab, a person whose arc is done sometimes asks for a good their port wants, in their own way of speaking ("Kit wants salt for the catch"). There is one ask at a time per port, and the player can ignore it, with no deadline and no failure. Each person has a small pool of 3 to 4 lines in i18n.
- **How often:** a new ask after the last one is delivered, or after a few dockings elsewhere. The balance thread picks the numbers, which go in a data file.
- **Reward:** gold through the help orders' `helpReward` factor, and now and then a small extra given in words, such as a loaf from Maren. No new perks.

## 3. Skerry and the ring review

- **Rule 12 changes:** the done card names who gives the plot and the two buildings to choose between, with the names taken from the build-spot data through placeholders: "Ada's plot by the water is yours, captain: {spotA} or {spotB}. Choose at Skerry." On the next docking at Skerry with a plot not yet chosen, a short arrival card in the giver's voice opens the build view on that numbered spot.
- **Ring review story checks:** keep the ring arcs' text, which is more varied than the seas'. Check three things: that the story's places still read right on the grown map (the East Reef gap, Greyback Ridge, Teeth Rock, Watchman Key), that each ring port's look shows the winter's damage before its arc and the repair after, and that the ring people speak again after their arcs (standing orders and the regattas fix this).

## 4. Living-sea boats

- **Light story only:** the boats get names and home ports from a data list (e.g. Saltmere's fishing boats are "Kit's boats", and coasters carry the goods their town makes). They have no speaking skippers, so the cast stays at 15 with Wren.
- People may mention the boats in their standing-order lines ("my boats are out past the reef again"), which ties the sea to the story.
- Boat names follow the naming rules: no "Skerry", and none of the leading words already taken.
