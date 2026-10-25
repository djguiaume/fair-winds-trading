# 0202. Sea edge follows any outline

**Status:** Accepted (2026-10-25). Guillaume OK on the screenshots. Asked by Guillaume for future extensions (steam, pirates, …) that may add a sea section sticking out one way. Look approved by the art director ([0165](0165-art-bible-and-the-phase-4-biome-looks.md)). [Screenshots of a test section](../reviews/sea-edge/README.md).

## Context

The playable sea was one disc: `boundsRadius` round (0, 0) (r985 since [0198](0198-the-grown-sea-is-the-main-game.md)). The red bobbing edge buoys ([0041](0041-harbour-mooring-and-edge-buoys.md)), the wall the boat bumps into, the charts, the fog, the map checks and the route planner all used that one radius. Growing the sea as a bigger circle moved them all; a section added in one direction could not be expressed.

## Decision

1. **Edges are data.** A sea file (or the ring's map file) may list `edges`: `{ "id": "east-reach", "outline": [[x, y], …] }`, each an outline of open water joined to the round sea. `grownMap` joins every sea file's edges like its other lists. The playable sea is the disc **joined with** every edge. With no `edges` (every sea today) nothing changes: the same disc, the same wall, the same ring of buoys, byte for byte.
2. **One shape for everything**, `src/sim/seaEdge.ts`: `seaShape(map)` gives the disc, or with edges its **rim**, a closed loop traced once (kept per map) along the joined sea. `seaDistance`, `atSea`, `keepAtSea`, `seaReach`, `seaBox`, `edgeSpots` and `edgeLine` answer from it. Users: the wall (`resolveCollisions` takes the shape, a bare radius still works), the edge buoys (`EdgeBuoys`), the save's "is the boat at sea" check, the map checks (`clearAt`, `seaRoom`, the route grid, land and marks inside the edge, currents and zones inside), sea density, the storms' reach, the in-game chart (water, rim, fog mask, zoom and pan limits), the editor chart and `npm run chart` (whole-sea view).
3. **Every corner is rounded** (the art director: an extension is more ocean, not a box): a section's corners by `round` (its outline moved in by it, the water grown back out), and each seam with the round sea blended by a smooth minimum, so the rim is one continuous curve. Buoys go evenly along the rim, `spacing` apart, `offset` outside; none are left where a section joins, and there is no seam marker. Tuning: `seamanship.boundaryBuoys.round` (60) and `maxTurnDeg` (30).
4. **Checks** (`npm run check`, the editors, `npm run sea`): each edge has an id, three points or more, and joins the sea (directly or through an edge that does) — errors; the buoy line turning more than `maxTurnDeg` between three buoys — a warning ("widen the sea edge there").
5. **Editable**: the sea editor's **Add sea edge** tool (an oval to drag into shape; its points drag, insert and delete like a chart area's, the panel shows its id and file) and `npm run sea -- add edge --sea east --outline "x,y …"`, `set edge <id> --outline`, `move edge`, `remove edge`. Steps as data: `{ "do": "add", "what": "edge", … }`.

## Consequences

- Adding a section is one sea-file entry: buoys, wall, chart, fog and checks follow it. New water starts fogged like the other new waters; a chart area can cover it.
- Cost: with no edges, one tiny object per frame. With edges, the rim (about 1,700 points for the test section) is traced once in about 10 ms on a desktop; the wall checks it only beyond the disc's radius; the buoys are one instanced draw call as before (237 for the test section against 222). Old-tablet budget unchanged for today's sea.
- Not done here (for the first real extension): wind zones that hug the old rim (the Stormbreak belt) end in open water where a section opens; they should continue or fade at the seam, and a check could warn (art director's note). A section that encloses dry water (a hole) is not supported: the rim is the outer loop.
- The ring's own storms sea radius is now the sea's reach (the same number today).
