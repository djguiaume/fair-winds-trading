# v1.9 towns: the believable-town audit (before)

**After:** the ring's seven towns pass with no finding since #514: [ring.md](ring.md).

Issue #513, decision [0301](../../../decisions/0301-town-layout-rules-and-the-believable-town-check.md). The art director's town rules (art bible §12, numbers in `src/data/town-rules.json`) run over every shipped island with houses, before towns 2 (#514, the ring) and 3 (#515, the far seas) fix them. No island file changed in this part.

Made with `npm run island -- audit --md` (the table) and `npm run island -- audit --chart docs/reviews/v1.9/towns` (the plans). `npm run island -- audit <id>` lists one island's findings with their places; the island builder shows the same list in its Checks tab.

## How to read it

- **W** is the town's house width (the median house's footprint across its front), here in world units; every distance rule counts in W.
- **✗** fails (past the rule's fail number), **!** warns. Both are warnings in the game's checks until towns 2 and 3 are done; then `town-rules.json › grading.fails` becomes `"error"`.
- **Rules:** slope (house on a slope; 8° in a main port's core), ground (on lava or ash), shore (setback from the waterline), facing (front or back to the nearest lane or quay within 3W, else the water; our houses have no door yet, so either side counts), row (side-by-side houses turned alike), spacing (merged houses, a house alone), lanes (every house within reach of a lane; lanes along the shore or contour, not too steep, ending at something; a waterfront lane by the harbour), piers (start at the shore, square to it), harbour (the houses gather round the harbour; church or market by it), fields, woods, hazard (fire islands: lava, ash, the cone).

## Audit (2026-11-12): 16 towns, 57 fails, 231 warnings

| Island | Style | Houses | W | Fail | Warn | slope | ground | shore | facing | row | spacing | lanes | piers | harbour | fields | woods | hazard |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Abbey Head | timber | 7 | 3.4 | 1 | 11 | 2! | · | 1! | 1✗ 4! | 1! | 1! | 1! | 1! | · | · | · | · |
| Amber Strand | strand | 5 | 7.0 | 1 | 3 | · | · | · | 1✗ | · | 2! | 1! | · | · | · | · | · |
| Port Calda | timber | 32 | 4.2 | 0 | 28 | 1! | · | · | 3! | 11! | 2! | 5! | 2! | 2! | · | 2! | · |
| Cinder Isle | volcano | 3 | 2.9 | 6 | 5 | · | 3✗ | · | 3✗ | · | 1! | 1! | · | · | · | · | 3! |
| Emberhold | volcano | 23 | 4.3 | 8 | 14 | 1✗ 1! | · | 1! | 7✗ 2! | 1! | · | 5! | · | 1! | · | 1! | 2! |
| Fogwatch | fog | 19 | 5.4 | 2 | 8 | 1✗ 2! | · | · | 1✗ | · | 1! | 5! | · | · | · | · | · |
| Palm Key | tropic | 6 | 4.3 | 4 | 6 | 1✗ 2! | · | · | 3✗ 1! | · | · | 1! | 1! | · | · | 1! | · |
| Rimewick | ice | 15 | 3.9 | 1 | 3 | 1✗ | · | · | 1! | · | · | 2! | · | · | · | · | · |
| Saltmere | fish | 32 | 2.7 | 5 | 29 | 2✗ 4! | · | · | 3✗ 1! | 5! | · | 12! | 3! | 3! | · | 1! | · |
| Skerry | timber | 4 | 3.5 | 3 | 4 | · | · | · | 3✗ | 1! | · | 3! | · | · | · | · | · |
| Snowberry Isle | ice | 7 | 3.6 | 4 | 7 | 1! | · | 3! | 4✗ 1! | · | · | 2! | · | · | · | · | · |
| Stonehaven | stone | 29 | 3.3 | 13 | 21 | 10✗ 2! | · | · | 3✗ 1! | 6! | · | 8! | 2! | 2! | · | · | · |
| Sunreach | tropic | 21 | 5.1 | 5 | 16 | 4✗ 5! | · | · | 1✗ 3! | 2! | · | 1! | 2! | 1! | · | 2! | · |
| Sunreach South Arm | tropic | 3 | 4.8 | 1 | 19 | 1✗ 1! | · | · | · | · | 3! | 1! | 1! | · | 10! | 3! | · |
| Watchman Key | timber | 5 | 3.4 | 1 | 9 | 3! | · | · | 1✗ 1! | 1! | 3! | 1! | · | · | · | · | · |
| Westholm | grain | 32 | 4.5 | 2 | 48 | 2! | · | · | 2✗ 1! | 5! | 24! | · | 2! | 1! | 11! | 2! | · |

Totals by rule (fail / warn): slope 21 / 26, ground 3 / 0, shore 0 / 5, facing 33 / 19, row 0 / 33, spacing 0 / 37, lanes 0 / 49, piers 0 / 14, harbour 0 / 10, fields 0 / 21, woods 0 / 12, hazard 0 / 5.

**No town to check:** Lantern Rock and Teeth Rock (ring), Organ Pipes and Spark Rock (west) carry a lighthouse or beacon and no houses, so the town rules have nothing to say there; every other island without houses is a rock or holm. No shipped sea builds a town from code (every map island has an island file).

## What it says, for towns 2 and 3

- **Facing is the biggest fail (33):** whole rows turned across their lane (Emberhold's east lane, Snowberry Isle, Palm Key, Skerry). Usually a `turn` fix only.
- **Houses on slopes (21 fails):** Stonehaven's quarry tiers (10, houses on the tier edges), Sunreach (4), Saltmere's west hill (2), Fogwatch (1). A move onto the terrace or a small sculpt.
- **Cinder Isle's three houses stand on lavafield** (its whole base ground): give the town a ground of its own or move it.
- **Lanes (49 warnings):** Saltmere's outer houses far from any lane, several lanes that end in the open, no waterfront lane at Calda.
- **Westholm's farmhouses touch (24 spacing):** the tight grain town; Calda and Saltmere rows turn by more than 15°.
- **Fields (21):** Westholm's fields hard by the farmhouses, Sunreach South Arm's tea terraces between the houses and the water.
- **Piers (14):** side piers that start more than 1W inland (over the beach) or run more than 30° off square to the shore. The arrival pier's root is the sim's, so only its squareness is checked.

## Before plans

One plan per town: ground shaded by slope (green flat, tan past the warn, brown past the fail, red forbidden ground), houses white with a line along their front, other buildings grey, fields yellow, lanes brown, piers grey, trees dark green dots, the arrival pier's root in a white ring; findings ringed red (fail) or orange (warn) with the rule's name. File plan view, harbour toward the bottom.

| Ring | Far seas |
|---|---|
| [Abbey Head](abbey-head-before.jpg) | [Amber Strand](amber-strand-before.jpg) |
| [Port Calda](calda-before.jpg) | [Cinder Isle](cinder-isle-before.jpg) |
| [Saltmere](saltmere-before.jpg) | [Emberhold](emberhold-before.jpg) |
| [Skerry](skerry-before.jpg) | [Fogwatch](fogwatch-before.jpg) |
| [Stonehaven](south-cay-before.jpg) | [Palm Key](palm-key-before.jpg) |
| [Watchman Key](watchman-key-before.jpg) | [Rimewick](rimewick-before.jpg) |
| [Westholm](westholm-before.jpg) | [Snowberry Isle](snowberry-isle-before.jpg) |
| | [Sunreach](sunreach-before.jpg) |
| | [Sunreach South Arm](sunreach-south-before.jpg) |
