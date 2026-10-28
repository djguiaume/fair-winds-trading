# 0232. Sculpted terrain: saved edits replayed over the height field

**Status:** Proposed (2026-10-28).

## Context

[0230](0230-v12-scope-terrain-sculpting-and-the-ocean-moves-to-v13.md) keeps islands procedural but lets authors sculpt them by hand, saved as operations in the island file. Issue #270 builds the core that the island editor (#271) and `npm run island` (#272) share. It needs exact replay after reload, export and import, the same ground on every quality level, small dirty regions for fast rebuilds, one undo step per drag, and town terraces that cannot be dug up by accident.

## Decision

- **File format:** an island file may have `sculpt: { version: 1, edits: [...] }` (`SculptEdit` in `src/data/islands.ts`). Each edit is `op` (`raise`, `lower`, `flatten`, `smooth`, `slope`), `points`, `radius`, `strength`, `falloff`, and `height` (flatten) and `override` when needed. A file without `sculpt` loads as before. A file with another `version` does not load: the checks and `sculptEdits` say so.
- **Coordinates:** points, radius and heights are radius units in the file's own frame, like everything else in the file, so edits follow the island when the map moves, turns or resizes it. They are continuous positions, never grid cells, so they do not depend on the grid or the quality level.
- **Order:** generated ground (#268), then smoothing and relief (#269), then the edits in file order, each one's dabs in order. Edits are the same at every settlement level.
- **Operations** (`src/sim/sculpt.ts`): each dab weighs samples by a smoothstep brush (full in the core, fading over `falloff × radius`). Raise and lower add `strength` at the centre; flatten, smooth and slope pull the ground `strength` of the way toward their target (a height; the average within `terrain.json › sculpt.smoothRadius`, read before the dab; the even ramp between a slope's two ends). Heights stay within `sculpt.minHeight` to `maxHeight`. Only +, −, ×, ÷ and square roots on stored inputs, so a replay is exact.
- **Dirty regions:** every operation returns the inclusive block of samples it may have changed (`Region`), always inside the field.
- **Transactions** (`src/sim/sculptSession.ts`, `SculptSession`): `begin(brush)`, `dab(x, z)` per pointer move, `commit()`. One drag is one edit and one undo step; undo puts back the samples of its region, redo repaints the edit. Points and numbers are rounded to 4 decimals before they are painted, so the live field equals the replay of the saved file. A dab closer than `sculpt.spacing × radius` to the last is skipped, which keeps files small.
- **Terrace protection:** on by default. Samples within a building's or home spot's footprint plus `sculpt.protect.margin` are never changed, fading back in over `protect.fade`. Footprints come from data only (`fit`, a recipe's new `protect` or `fit`, else `protect.fit`); a test keeps them at least as big as every shipped building's measured model. An edit with `override: true` may change that ground; `npm run check` and the builder's checks (`checkSculpt` in `src/sim/sculptChecks.ts`) then fail any building an edit reaches whose ground now rises or falls more than `sculpt.levelTolerance` across its footprint.

## Consequences

- The editor and CLI issues only add input: brushes, preview and commands call `SculptSession` and save `session.sculpt`.
- Sculpting can raise ground out of the sea or sink it; the sim coast does not follow. The coast checks (#273) compare the two.
- Edits only reach the field's grid (the coasts plus `terrain.margin`).
- Changing `cell`, `smoothRadius` or the protection numbers changes how saved edits replay, like any change to the generated ground; a change to what an operation does needs a new `version` and a migration.
