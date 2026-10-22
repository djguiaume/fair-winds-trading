# 0071. Distinct producer landscapes and growing port towns

**Status:** Implemented for review, 2026-10-22.

## Context

The four producers were recognizable mainly through props. Their roughly circular terraced
landforms were too similar, and level 4 still read as a village. Concept studies explored larger
buildable areas, satellite islands, a lake, cliffs and tidal inlets. Review of the first actual
renders rejected rectangular housing grids and the loss of visible beaches.

## Decision

Keep code-built, flat-shaded primitive buildings and the existing four settlement levels. Give
each producer an authored, level-independent landscape in `sim/islandLayout.ts`:

- Saltmere: a broad fishing waterfront, offset headland, lighthouse islet and fishing outpost.
- Port Calda: a large wooded island, enclosed freshwater lake with sandy banks, wooded upland
  and a timber town in the low clearing.
- Stonehaven: a high stone-town plateau, sheer cliff, stepped pale quarry, stairs to the lower
  harbour and a pointed offshore sea stack.
- Westholm: a low, connected agricultural island with two tidal inlets, fields and windmills.
  No bridges.

The coastline is shared by rendering, collision, the chart, shoreline effects and wind shelter.
Legacy round islands and polygon barriers remain supported. A landlocked lake has a real
terrain hole, still-water surface and bank collision; it is not connected to the sailing sea.

House sites follow curved lanes with irregular setbacks and seeded back courts, not a grid.
Reserve the maximum town plan from the start, avoid water/cliff edges and industry, and reveal
3 / 10 / 21 / up to 32 residences through levels 1–4, plus civic and working buildings. The plan,
existing houses and landform do not move on level-up. The four main ports retain their existing
starting village level and all existing trade/economy progression.

Maintain the primary pier head to preserve harbour cues and saved approaches. Grow the docks
with solid T-heads and additional piers/quays; refresh their collision on growth and save load.
New producer piers participate in docking range at the actual settlement level. Existing hidden
yard islands retain their older models.

Replace the ocean shader's fixed island/edge arrays with a baked 512×512 shoreline-distance
texture, including every producer coastline and satellite. Rasterize a narrow shore band once
per ocean construction; shader sampling cost is independent of coastline complexity. Dispose
the texture with the ocean. Keep the existing Low/High shading paths and tablet geometry checks.
Lane fragments use two-triangle planes rather than hidden-sided boxes.

## Consequences and verification

- Saves keep port identities, cargo, gold and settlement levels. The existing collision-based
  load recovery moves a ship to the clear spawn if new land or an expanded pier covers its save.
- Broad beaches are explicit sand surfaces around inset grass platforms. Surface height and
  placement checks use those same inset outlines; buildings cannot hover over a hidden shelf.
- More detailed silhouettes require authored layouts, but no imported art pipeline or engine
  replacement. This is an implementation in the game's existing primitive style, not a pixel
  reproduction of the illustrative concepts.
- Automated checks cover safe town capacity, fixed houses during growth, lake/islet collision,
  harbour approaches, growing piers, sampled shore texture coverage, geometry budgets and the
  physical four-port sloop circuit. The circuit audit follows polygon shores and allows a wider
  turning margin offshore rather than treating the islands as circles.
- [Actual level-1 / level-4 renders](../screenshots/island-identities/README.md) accompany the PR.
  Physical tablet/phone performance still needs device validation.
