# 0146. Far goods: the outpost gathers, the main port crafts, the ring buys

**Status:** Accepted, 2026-10-24 (Guillaume: "yes better"). Worked out with the head storyteller (names, order, openers, keepers) over four rounds of Guillaume's feedback. Docs and data proposal only; nothing is built until Phase 4. Review: [far goods](../reviews/far-goods/README.md).

## Context

[0065](0065-rare-goods-from-the-far-yards.md) promised a second, rarer set of goods that only port towns want. [0137](0137-phase-4-biomes-and-founded-outposts.md) moved it to the four Phase 4 biomes, each with an inhabited main port and an outpost the player founds. Guillaume asked that far islands not make the ring's goods, that no two islands make the same good, that prices follow progression, and that the main ports be worth visiting again and again, as the visual and story anchors of their biomes.

## Decision

1. **Three stops per far voyage, the ring's own pattern stretched across a sea.** The outpost you found gathers a raw far good. The biome's main port buys it and its workshop crafts it. The ring's port towns buy the crafted good. No island makes the ring's goods, and no two islands make the same good.
2. **Goods and prices, in the order the seas open.** All four seas open after the ring arcs, each through someone from the ring:

   | Opens | Biome | Raw at the outpost (EN / FR) | Crafted at the main port (EN / FR) | Opened by |
   |---|---|---|---|---|
   | 1st | South, tropical | Spice / Épices, 20 | Spiced tea / Thé épicé, 90 | Old Ness's chart (Watchman Key) |
   | 2nd | West, fire | Obsidian / Obsidienne, 22 | Obsidian mirrors / Miroirs d'obsidienne, 100 | Ines's contact (Port Calda) |
   | 3rd | North, ice | Cloudberries / Mûres arctiques, 25 | Cloudberry jam / Confiture de mûres arctiques, 110 | Kit's contact (Saltmere) |
   | 4th | East, fog and storm | Amber / Ambre, 28 | Amber beads / Perles d'ambre, 120 | Maren's contact (Westholm) |

3. **The outpost** gathers its raw good from village level, as a ring town makes fish. Only its biome's main port buys it.
4. **The main port** buys its raw good, honey or lamp oil from the far side of the ring, the ring's specialties and founding goods. Its workshop crafts the finished good from town level, **only from raw goods it has received**: each raw unit delivered becomes one crafted unit in its stock, so without supplies from the outpost the main port makes nothing better. It grows with levels and wants and posts delivery orders like a ring town. The story explains this through quests. It has **one keeper of its craft**, named in the storyteller brief: the port's voice, with a 3-step arc that changes how the port looks, who also gives the quest to found the outpost.
5. **Only ring port towns (level 4) buy crafted far goods**, two buyers each on the far side: spiced tea to Port Calda and Westholm, obsidian mirrors to Port Calda and Saltmere, cloudberry jam to Saltmere and Stonehaven, amber beads to Westholm and Stonehaven. This is what a town gets for reaching level 4.
6. **No level 5, no new port town gate.** Far goods are a new kind `far` and never count toward the 0065 gate. Outposts stop at level 3.
7. **Data, not code** ([0093](0093-data-driven-content-and-authoring-tools.md)): goods in `goods.json`, names in `src/i18n`, per-port `wants`, `wantsMade`, `levelProduces` and a new `levelWantsMade` in the map file, keepers in `characters.json`. Full proposal in the review.

## Consequences

- Estimate with the balance leg model (maxed cutter, 30 units, no currents or hazards): honey or lamp oil out to a main port earns 600 to 670, raw goods from outpost to main port 350 to 500, crafted goods home 1,885 (spiced tea) to 2,525 (amber beads). A full round earns about 2,900 to 3,700. Each stage of the ladder roughly doubles a load's value, in step with ship prices up to the clipper (20,000) and indiaman (25,000).
- The 40-minute targets of [0046](0046-phase-1-economy-tuning.md) are unchanged. Phase 4 balance targets come with the real 5x map.
- Code needed once, in Phase 4: the `far` kind, `levelWantsMade`, a workshop that crafts only from raw goods received, and the market and chart showing goods only port towns buy.
- **Each biome gets its arc**: the opener's quest from the ring, the keeper's 3-step arc at the main port, and founding the outpost (0137). The storyteller writes the openers' "letter from a relative" quests and the four keepers into the brief's Phase 4 section. A biome ship fitting as the prize of a keeper's arc is left for later.
- Replaces 0065's "outer islands upwind and downwind, spice and dye".
