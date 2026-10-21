# 0060. Towns grow visibly with their settlement level

**Status:** Accepted (Guillaume approved the round 2 mockups, 2026-10-20). Render code done; game wiring follows the settlement logic ([0059](0059-settlement-levels.md)).

## Context

Phase 2 ([roadmap](../roadmap.md)) makes deliveries change the world: a settlement levels up when its demand is met, which changes the goods it wants and the upgrades it offers. Guillaume asked (2026-10-20) that the level also grow the town on screen, and whether some islands need redesigning for it.

The settlement logic is built in parallel ([0059](0059-settlement-levels.md), "Settlement levels logic" thread). It exposes `SettlementLevel = 1 | 2 | 3 | 4` and `settlementLevel(world.trade, portId)` from `src/sim/settlement.ts`; levels only go up, one step at a time, and `stepWorld` emits a `level-up` world event. Map ports get an optional start `level`.

Today each port island has a fixed number of houses on its cliff top (`look.houses`). The cliff tops are small: the stone island's cap is about a third of its radius and the grain and timber caps are already full of fields and forest, so there is no room for a town to grow there. Islands stay code-built ([0014](0014-code-built-models-for-now.md), [0016](0016-game-models-style-d-and-b2.md)) in the B2 style, in one merged mesh, and must stay cheap on the old tablet ([0006](0006-desktop-and-mobile.md)).

## Decision

Round 1 (one shared town layout on every island) was rejected by Guillaume as too uniform. Round 2:

1. **Four visible levels** (hamlet, village, town, port town, as in 0059), but **each port grows its own way**, with its own island profile, buildings, layout and industry:
   - **Saltmere (fish, home port):** cliffs pushed to the back and one side, leaving a long low waterfront. A crescent of tall narrow pastel houses with steep gables faces the sea, with a second row from level 3 (3, 6, 9, 13 houses). Drying racks multiply along the beach (1, 2, 4, 6), fishing boats moor beside the pier (0 to 3), smokehouses appear at level 3 and a fish market hall at level 4.
   - **Port Calda (timber):** two low wooded tiers, no tall plateau. Log cabins under mossy roofs stand in a clearing that widens each level, leaving stumps where the forest is cut. Log piles grow (1 to 4); a sawmill with a water wheel and stacked planks comes at level 3; a ship on the stocks starts as ribs (level 3) and is planked by level 4.
   - **Westholm (grain):** a single low terrace, the whole island is farmland. Fields spread in a patchwork (3, 6, 10, 14 plots), windmills go from 1 to 3, haystacks appear, then a red barn (level 2), a granary and a bakery (level 3) and a church with a spire (level 4). Thatched farmhouses sit by the pier.
   - **Stonehaven (stone):** keeps its tall stepped cliffs. Grey stone houses under slate climb the terraces from the shore as the town grows (2, 4, 7, 10). The quarry cuts terraces into the seaward cliff side (Guillaume asked pit or cliff; a cliff cut is visible from the game camera, a pit on top would not be): one pale cut per level from the top down, with block stacks, derrick cranes from the second cut, a masons' yard at level 3 and a keep on the summit at level 4. Its pier turns to stone at level 3.
   - **Shipyard ports** (Abbey Head, Watchman Key): a few houses and a slipway whose ship grows from keel to planked hull, landmark kept on top.
2. **Workshops at level 3.** Each town's level-3 workshop (sawmill, smokehouse, bakery, masons' yard) is the building for the processed good proposed by the logic thread (planks, smoked fish, bread, cut stone), so the art is ready if that is planned.
3. **The dock grows on the simulation's pier line:** a narrow plank jetty (level 1), a proper pier with bollards (level 2), a wider deck with a T-head and harbour lamp (level 3), a second pier, quay wall and second warehouse (level 4). Warehouses at the pier root from level 2.
4. **Collision unchanged for now.** Beach and collision radius are untouched, and the main pier stays on `pierAt`'s segment. The T-head, the second pier and the moored fishing boats are scenery the ship can pass through; making them solid is a follow-up in `src/sim/collision.ts` (the logic thread's area).
5. **Growth only adds.** Every feature draws from its own seeded stream and fills candidates in a fixed order; plots for later buildings (second pier, slipway, quarry) are reserved from level 1, so a level-up never moves what already stands.
6. **Render interface.** `buildIslands(map, { shadows, levels })` takes a level per port id; a port left out keeps today's look. `View.setSettlementLevels(levels)` (in `src/render/view.ts`) is to be called at start from `settlementLevels()` and on each `level-up` event; it rebuilds the island mesh only when a level changed.

Mockups, rendered with the real game code in `models.html?view=towns`, are in [docs/art/towns](../art/towns/).

## Consequences

- Still one merged island mesh (one draw call). A port town adds about 1,000 to 3,000 triangles per island (Port Calda's forest is the heaviest), measured on the model sheet.
- Port islands change silhouette when the feature is switched on (Westholm loses its plateau, Saltmere's cliffs move aside); the coastlines and map do not move.
- Scenery piers and boats are not solid until the collision follow-up lands.
- Town buildings are code-built like everything else ([0014](0014-code-built-models-for-now.md)); more variants per port can be added without changing the interface.
