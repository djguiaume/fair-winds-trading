# 0255. Bake a sculpted coast into the island outline

**Status:** Accepted (2026-10-31). Issue #352, follows 0237.

## Context

0237 keeps the island file's coast outline as the sim's coast and makes any sculpt that moves the drawn coast away from it an error. That leaves no way to *use* sculpting to move a coast: you had to redraw the outline by hand.

## Decision

- **Bake coast** traces the height-zero line of the canonical field (`fieldContour`), turns each closed line into an outline and writes them as the file's `coasts`. The outline stays the single source of truth for sailing; the 0237 coast check stays as the safety net.
- **Shape of the outline** (`src/sim/coastBake.ts`, `polyline.ts`): Douglas-Peucker from the point farthest from the first (so the start does not matter), coordinates rounded to 0.001 radius units, wound like the file's first coast and started at its lowest point, so the same ground gives the same file on every run and device. Simplification starts at `terrain.json › coast › bake › epsilon` and loosens until it fits `maxPoints`, or halves when rings would cross; no outline is kept that crosses itself or another.
- **Left out and reported:** islets under `minArea` and ponds (a sculpted pit below sea level, which an outline cannot hold; the lake stays `design.lake`). Land that runs off the edge of the ground (`terrain.json › margin`) is refused.
- **Refused, nothing written:** edits that do not replay; a baked outline that still parts from the ground (rebuilt from the new outline with the edits replayed) by more than the 0237 tolerance; any new island-check error; a `berths` or `harbour-water` map error (`coastBakeMap.ts`). Piers whose tip stands further from or nearer to the shore (`approachShift`) are reported.
- Sculpt edits are kept. They replay over ground now generated from the new outline, so a baked raise lifts the new land a little more; the result is checked, not assumed.
- One module (`bakeIsland`) behind the island builder's Terrain tab button and `npm run island -- <id> bake-coast`. Undo is the builder's history; on disk, git.

## Consequences

- A bake needs two field builds (about a second or two for a big island).
- Baking twice is not a no-op (see the replay note) but the gap stays inside the tolerance.
- Balance changes with the coast: run `npm run balance` on all three levels for any baked island, and `npm run chart -- --coast` before and after.
