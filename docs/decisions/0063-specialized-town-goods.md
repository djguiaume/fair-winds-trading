# 0063. Specialized goods: a town's workshop makes a better-paid good

**Status:** Implemented for review, 2026-10-21. Guillaume chose a specialized good over a second bulk good ("a specialized good is better").

## Context

Phase 2 asks for simple production chains in bigger towns (timber to planks, grain to bread) and for higher levels to unlock new demands ([roadmap](../roadmap.md)). Every port has one main production so its role is easy to read ([0029](0029-one-main-production-per-port.md)). Settlement levels ([0059](0059-settlement-levels.md)) are in, and the town art ([0060](0060-growing-town-visuals.md)) already draws a workshop for each town: sawmill, smokehouse, bakery and masons.

## Decision

**One specialty per town.** When a charted port grows into a town (level 3), its workshop starts making a specialized good from its own bulk good. The port keeps its bulk good, so its main role does not change:

| Port | Bulk good | Workshop | Specialty | Base price |
|---|---|---|---|---|
| Saltmere | fish (8) | smokehouse | smoked fish | 20 |
| Westholm | grain (10) | bakery | bread | 24 |
| Port Calda | timber (14) | sawmill | planks | 32 |
| Stonehaven | stone (18) | masons' yard | cut stone | 40 |

FR: poisson fumé, pain, planches, pierre de taille (fumerie, boulangerie, scierie, taillerie de pierre).

**Buyers open with the workshop.** A specialty trades only where it is made or wanted. Each port lists the specialties it buys (`wantsMade` in the map), and it starts buying one as soon as some town makes it. Planks go to Saltmere, Westholm and both shipyards; bread to Calda, Stonehaven and Watchman Key; smoked fish to Calda and Stonehaven; cut stone to Saltmere, Westholm and Abbey Head. Before any town has a workshop, no specialty appears anywhere. A newly opened market starts at its usual stock, so the first prices are fair, not at the ceiling.

**Same market rules.** A workshop's stock settles at 40 % of a bulk producer's (46 at town, 52 at port town). Buyers keep a scarce stock like any want. Selling a specialty a town wants grows it like any wanted good, and orders can ask for one once it is made. Long-haul order bonuses count the workshop as the maker.

**Screens.** The market lists only the goods the port trades, so the four specialties stay out of sight until they matter. The chart's goods bar adds a specialty once it is made, or while one is in the hold. The town's "Makes" tag shows both goods. A level-up that opens a workshop gets its own toast ("Port Calda has grown: its new sawmill makes Planks!"). Each specialty has a colour icon in the HUD sprite.

**Data.** `levelProduces` (keyed by level, like `levelWants`) and `wantsMade` in the map; `SPECIALTY_GOODS`, `MADE_FROM` and `isSpecialty` in `src/sim/goods.ts`. Saves stay version 1: older saves simply hold none of the new goods.

## Consequences

- Growing a town now opens a new, better-paid trade for the other ports, not just a bigger market at one port. In the 40-minute balance simulation a sharp captain makes Port Calda a town at about 27 minutes and then trades planks. All Phase 1 targets still hold.
- The chain is inside the town: its workshop runs on its own bulk good. A chain that needs the player to deliver the input (for example stone to a masons' yard on another island) is possible later with the same data.
- Goods only made on distant islands are still to come. The hidden shipyards have no workshop and only buy specialties.
- Port town (level 4) still only deepens demand and orders.
- Screenshots: [docs/screenshots/settlements](../screenshots/settlements/) (`node docs/screenshots/settlements/capture.cjs`).
