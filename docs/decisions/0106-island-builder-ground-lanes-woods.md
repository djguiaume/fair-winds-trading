# 0106. Island builder, part 2: ground with slopes, lanes and woods

**Status:** Implemented for review (2026-10-23). Part 2 of step 3 of [0096](0096-island-files-and-island-builder.md), after [0105](0105-island-builder-props.md) (props, levels, preview, checks, export). Builds the sloped terrain of 0096 §4. How to use it: [docs/island-builder/builder](../island-builder/builder/README.md).

## Context

0096 planned the builder's second pull request: shape the ground (coast, raised ground with cliff or slope edges, mountain, lake), draw lanes, paths and stairs, and paint the woods. Guillaume asked for sloped terrain and sloped paths in the builder (0096 §4) and said the mockup need not be redrawn for it as long as the editor has it. The island files of 0101 had no slopes, so the game first had to learn them without changing the four shipped islands.

## Decision

- **Sloped ground in the game (0096 §4).** A `ground` entry may have `slope` (the ramp's width in island-radius units, outward from the outline) and `slopeEdges` (runs `[first, last]` of edge indices; left out, every edge slopes). Edge *i* runs from point *i* to point *i + 1*.
  - `layoutGround` returns the height on a ramp, interpolated from the outline's height down to the ground below. With no slope anywhere it is the old code path, so the golden hashes of the shipped islands do not change.
  - The renderer draws a ramp for each sloped edge, in the ground's material, with a fan at a bend between two sloped edges. The cliff band is still drawn under it.
  - Lane pieces climb slopes (tilted along the ground) and are still dropped over water or across a cliff (`crossesCliff`). A path with no `y` now follows the ground the same way; a path with a `y` stays flat, as South Cay's.
  - Checks: the cliff-edge check ignores sloped edges (`cliffDistance`); a new ✗ **"building on a slope"** (any prop type with `building`) wants flat ground, while trees, lamp posts, crates and other small props may stand on a slope; the lane warning accepts slopes and now also covers paths that follow the ground.
- **Painted woods.** `woods.areas`, optional circles `[x, z, r]`: when present, trees grow only inside them (and still never in a `clear` circle). Left out, trees grow anywhere in `woods.area`, as before.
- **Builder modes.** The palette gets three modes: **Props** (part 1), **Ground** and **Lanes**; on a phone they are tabs (Select, Props, Ground, Lanes, Checks).
  - **Ground:** outlines of the coasts, raised ground, mountains and the lake are drawn over the island; click one to select it. Drag a square to move a point, the small ring in an edge to add one, Delete removes the point (outlines keep three). Tools add **raised ground** (a hexagon 0.2 above the ground under it), a **mountain** (a rock peak 0.6 above it) and the **lake** (one per island), each appearing from the level on show. The panel sets height, grass or rock, **Cliff / Slope** for every edge, the slope's width, the base of a peak and *Appears from* / *Gone after*. With raised ground selected, clicking an edge switches it between cliff and slope (green on the island). Adding or removing points keeps each edge's cliff or slope.
  - **Woods:** with nothing selected the panel edits the tree, tries, spacing and size. **Grow woods** paints `areas` and **Clear trees** paints `clear` circles with a brush (each rubs out the other); **Remove painted woods** goes back to trees anywhere.
  - **Lanes:** **Lane**, **Path** or **Stairs**, then click bends and click the last point again (or Enter) to finish. Stairs take the ground's height at each point and stand on the lowest. The panel switches a lane between the three kinds.
- Export keeps the files' key order for ground, lanes and woods as well as props (`tidyDesign`), so a changed island still exports as Prettier writes it.
- Code: `src/editor/island/shapes.ts` (pure edits, tested in `tests/island-builder.test.ts`), `shapePanel.ts`; the overlay and `builder.ts` gained the shape modes. Game side: `src/sim/islandLayout.ts` (`isSloped`, `cliffDistance`, `slopeDistance`, `crossesCliff`), `src/sim/islandChecks.ts`, `src/render/models/towns.ts`; tests in `tests/island-slopes.test.ts`.

## Consequences

- Guillaume can reshape an island's ground and lanes and paint its woods, with slopes a lane can climb, and try and export it like the props.
- None of the four shipped islands uses slopes yet: they stay byte for byte and hash for hash identical. A file with slopes needs this version of the game.
- A slope drawn over existing homes flags them in red until they move or the edge goes back to a cliff.
- The top view is drawn from straight above, so a ramp shows there as a green line on the outline; the 3D preview shows its shape.
- The first stroke of **Grow woods** limits trees to what is painted, so painting a small patch first removes the woods elsewhere (the tool's description says so).
