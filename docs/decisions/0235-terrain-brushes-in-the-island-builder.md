# 0235. Terrain brushes in the island builder

**Status:** Accepted (2026-10-28), issue #271. Builds on [0232](0232-sculpted-terrain-saved-edits-replayed-over-the-height-field.md) (the sculpting core) and [0234](0234-terrain-command-line-tool-sculpt-commands-exportimport-and-l.md) (the command line).

## Context

The sculpting core saves hand edits in the island file and replays them over the generated ground. The island builder drew only the recipe's classic tiers, so edits could not be seen, made or undone there, and `npm run island` was the only way to make them.

## Decision

- **A Terrain tab** beside Props, Ground and Lanes ([docs/island-builder/builder/terrain.md](../island-builder/builder/terrain.md)): raise, lower, flatten, smooth and slope, with size, strength, soft edge, a target height (typed, or picked from the ground) and a view switch between the ground and sea level and depth. The brush footprint (soft edge dashed) and a slope's two ends with their heights are drawn over the island.
- **The field is drawn in both views while the tab is in use, and whenever the file has edits.** One `FieldSurface` per view (`src/render/models/fieldGround.ts`) keeps a fixed place for every cell, so a stroke rewrites and uploads only the rows of the samples it changed. The props stand on the same field (`fieldStand`), re-stood at most every `placementMs` while dragging and once at the end. The ground in the builder is the unsmoothed field of `?look=v2`; smoothing (#269) comes to it with the shared field.
- **One stroke is one undo step of the builder's own history**, saved as the file's `sculpt` when the pointer lifts, together with the rebuild and the checks (which run in the worker, as for any edit). Undo, redo and reset change the design; the tool's `SculptSession` follows to it with one session undo or redo when that is the difference, and rebuilds only when it is not (Reset, import, a change to the recipe or the level).
- **Esc, a second finger, or pointer cancel** drops the stroke and puts the samples back. Two fingers pan and zoom; the right or middle mouse button pans.
- **Town terraces are protected by default** (the checkbox is `override`, off). The footprint turns amber where it would touch protected ground. Warnings after a stroke say where the coast line ended up under water or with land beyond it, and where a pier or the harbour lane is no longer deep enough to berth in (`warnings.ts`; the island checks of #270 still say which buildings are no longer level, and #273 will extend the coast checks). Nothing moves a building or a berth.
- **Leaving with terrain edits not yet exported** asks first, and so does closing the tab. Edits are kept in the browser draft as for every builder change.
- **Controls are EN/FR** (`editor.terrain.*` in `en.json` / `fr.json`), with a switch in the panel since the rest of the builder is English. The numbers are in `terrain.json › sculpt.editor` (ranges, placement throttle, warning tolerances, height shading) and the depth colours in `depth-view.json`.
- A file holds at most `sculpt.limits` edits; a long drag is saved in pieces of `limits.points` dabs, and the next stroke is refused (with a note) once the file is full.

## Consequences

- The builder and `npm run island` make the same edits: same session, same limits, same file.
- A dab costs about 3 ms on a laptop at Port Calda (306 × 234 samples); the end of a stroke, with the rebuild, about 60 to 110 ms. No worker was needed for painting.
- Buffers: the field drawn in the builder is every cell of the field (Calda: about 143 000 triangles) in each of the two views. This is the editor only; the game's budgets are unchanged.
- Island and town sizes are not changed by this: brushes only edit ground inside an island's own file.
