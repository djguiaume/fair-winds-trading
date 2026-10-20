# 0060. Towns grow visibly with their settlement level

**Status:** Proposed (mockups for review, 2026-10-20)

## Context

Phase 2 ([roadmap](../roadmap.md)) makes deliveries change the world: a settlement levels up when its demand is met, which changes the goods it wants and the upgrades it offers. Guillaume asked (2026-10-20) that the level also grow the town on screen, and whether some islands need redesigning for it.

The settlement logic is built in parallel ([0059](0059-settlement-levels.md), "Settlement levels logic" thread). It exposes `SettlementLevel = 1 | 2 | 3 | 4` and `settlementLevel(world.trade, portId)` from `src/sim/settlement.ts`; levels only go up, one step at a time, and `stepWorld` emits a `level-up` world event. Map ports get an optional start `level`.

Today each port island has a fixed number of houses on its cliff top (`look.houses`). The cliff tops are small: the stone island's cap is about a third of its radius and the grain and timber caps are already full of fields and forest, so there is no room for a town to grow there. Islands stay code-built ([0014](0014-code-built-models-for-now.md), [0016](0016-game-models-style-d-and-b2.md)) in the B2 style, in one merged mesh, and must stay cheap on the old tablet ([0006](0006-desktop-and-mobile.md)).

## Decision (proposed)

1. **Four visible levels**, named as in 0059:
   - **1 Hamlet:** two cottages by the pier.
   - **2 Village:** four houses, a sandy street up from the pier, a warehouse with crates, a rowing boat on the beach.
   - **3 Town:** seven houses (some two-storey), a cross street, a stone quay either side of the pier, market stalls, a chapel on the cliff top, a second rowing boat.
   - **4 Port town:** ten houses, a town hall with clock tower and flag, a dockside crane, a second warehouse and stacked cargo on the quay.
2. **Reshape every port island with a waterfront shelf.** A low grass terrace fills the harbour side between the beach and the cliffs; the sandstone layers shrink to about three quarters and step back from the harbour. The town is built on the shelf. The beach, the collision radius and the pier are unchanged, so the map ([0031](0031-windward-ring-map.md)), sailing, docking and pier collision ([0038](0038-hull-damage-from-any-crash.md)) are not affected. The producer props (racks, forest, fields and windmill, boulders and cart) stay on the cliff top.
3. **Growth only adds.** House plots are seeded once per island and filled nearest the pier first; landmark plots (town hall, warehouse, stalls) are reserved from level 1. A level-up never moves a building that already stands.
4. **Render interface.** `buildIslands(map, { shadows, levels })` takes a level per port id; a port left out keeps today's look. The view will expose `setSettlementLevels(levels)`, called once at start from `settlementLevel()` and again on each `level-up` event; it rebuilds the island mesh only when a level changed (a rare event).
5. **Hidden shipyard ports** (Watchman Key, Abbey Head) use the same levels. They are smaller (radius 17 to 18), so their shelf holds fewer houses; a slipway for their yard is a follow-up.

Mockups, rendered with the real game code in `models.html?view=towns`, are in [docs/art/towns](../art/towns/).

## Consequences

- A port town of ten houses is the most today's island sizes allow on the shelf (Port Calda, the biggest, has room for about fourteen). Fitting a bigger town would need larger port islands, which moves coastlines and collision and so needs a map change; not proposed now.
- One merged island mesh is kept (one draw call); a full port town adds about 1,300 triangles per island (measured on the model sheet). A level-up rebuilds the island mesh once, a few milliseconds.
- Shelf islands look a little lower and wider than the current B2 peaks; the stone island loses part of its tall stepped profile. The previous look stays available (no levels passed) until the game is wired.
- Producer props do not yet grow with the level (for example a second windmill or a sawmill); possible follow-up.
- Every port uses the same building set, so towns differ by layout and colours only; per-port landmarks could follow.
