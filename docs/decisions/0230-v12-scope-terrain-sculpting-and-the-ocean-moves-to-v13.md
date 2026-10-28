# 0230. v1.2 scope: terrain sculpting and the ocean moves to v1.3

**Status:** Accepted (2026-10-28, Guillaume OK on the v1.2 brief).

## Context

[0222](0222-a-new-look-smooth-terrain-blue-water-and-forests.md) set the v1.2 look. On 2026-10-28 Guillaume widened it: islands stay procedural, but the island editor gains terrain sculpting, and the advanced ocean (waves, boat response, reflections) is its own release. Issues #267 to #278 hold the scope; #331 (other boats) goes first.

## Decision

- **Sculpting:** one shared height field (`src/sim/heightfield.ts`, no three.js) is the single source of ground height for the game, the editors, the CLIs and the sim checks. Procedural islands are the base; hand edits are saved as deterministic operations (raise, lower, flatten, smooth, slope, with brush size and strength) in the island file, replayed in order on load. Undo and redo work in the editor. Every operation has a matching `npm run island` command that shares the editor's module (0153).
- **Resolution contract:** the height field grid is authored at one canonical resolution; quality levels only resample it for drawing, so Low and Ultra show the same geography and the sim coast never moves.
- **Terraces:** town terraces are protected by default; edits near houses need an explicit override.
- **Checks:** `npm run check` compares the smoothed shoreline with the sim coast and checks berths, piers and grounding.
- **Ocean:** advanced waves, boat heave and roll, and island reflections move to v1.3 (epic #279). v1.2 keeps only depth-coloured water, haze and forests.
- **Order:** other boats (#331), then foundation (#268), ground and sculpting core (#269, #270), editor, CLI and coast checks (#271 to #273), water, forests, haze (#274 to #276), acceptance and device gates (#277, #278). The old 7 to 9 week estimate predates sculpting and is re-done after #268, #270 and #271.

## Consequences

- The island file gains a list of terrain edits; old files load unchanged.
- Editor and CLI work grows; the release is longer than first planned.
- The ocean update (v1.3) can read seabed depth from the same height field.
