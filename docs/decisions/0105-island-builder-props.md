# 0105. Island builder, part 1: props, levels, preview, checks and export

**Status:** Implemented for review (2026-10-23). Step 3 of [0096](0096-island-files-and-island-builder.md) (accepted, mockup approved), on the island files of [0101](0101-island-files-built.md). Part 2 (ground, slopes, lanes, woods) follows in its own pull request. How to use it: [docs/island-builder/builder](../island-builder/builder/README.md).

## Context

0096 planned the island builder in `editor.html` in two pull requests: props, levels, preview, checks and export first; ground, lanes and woods second. 0101 moved the four port islands into `src/data/islands/*.json` with a prop catalogue and shared checks, so the builder has files to edit. 0102 to 0104 were taken by other threads the same day.

## Decision

- **Opening.** In the map editor, double-click a port island that has an island file, or press **✎ Edit island** in its panel. The builder replaces the map editor on the same page; **← Back to the map** (or Esc with nothing selected) returns. The island's radius on the map sets the scale (`radius / 2.2`, as the game builds it).
- **The island** is the game's own model (`designedTownParts`) drawn straight down by an orthographic three.js camera, harbour at the bottom, under a translucent sea so the beach reads as shallows. It is rebuilt when something changes, not every frame. An SVG overlay in island-radius units carries what is pickable: each prop's plan outline (its model's convex hull, cached by type, turn, size and variant), the hatched harbour approach, the selection with its turn handle, check marks and the outline of a prop being dropped (green where it fits, red where it does not). Wheel or pinch zooms, dragging the sea pans, ⤢ fits.
- **Levels.** A 1 to 4 switch (keys 1 to 4) builds the island at that level. With **Show later levels**, props that only come later are dashed outlines, and can be selected.
- **Palette.** The 41 catalogue types by group, with search, each with a thumbnail rendered from its model in the island's style when the builder opens. With a mouse, drag a tile onto the island; on touch, tap a tile, then tap the island (the palette keeps scrolling). A new prop gets the current level as `from`, the size that type has most often on this island (else on the shipped islands, else 1), and for homes the next colour variant; homes join the end of the residence order.
- **Selection.** Click a prop to select it, drag it to move it (it is drawn on its own while it moves, then the island is rebuilt so lanes and woods follow), turn it with the handle (Shift snaps to 15°), R / Shift+R, or the ±15° buttons, arrows nudge. The panel edits *Appears from*, *Gone after*, position, turn, size, variant, shape, length (paving, rails), a fixed height, tags; **Duplicate** (Ctrl+D) and **Delete**. It says what the prop stands on and lists its own check results. Undo and redo keep up to 200 snapshots of the file.
- **3D preview** at the game camera's 58° pitch, drag to turn round the island; it shares the island's geometry.
- **Checks.** `checkIsland` and `islandCheckKit` (the same code as `tests/island-files.test.ts`) run in a Web Worker 0.4 s after the last edit, and count triangles at the four levels; results show with ✓ lines, links that select the prop and jump to its level, and marks on the island.
- **Play this island.** Edited islands are kept in this browser under `fwt.editor.islands.v1` (only those that differ from the shipped files). `?map=edited` now loads them before the map (`useIslandDesign` replaces the shipped design by id) and, when only islands are edited, sails the shipped map, still on the separate play-test save of 0095. The editor's own page uses the edited islands too.
- **Export `<id>.json`** writes the file with props' keys in the shipped files' order (`tidyDesign`) and Prettier's layout (`formatIslandJson`, sharing the printer of `formatMapJson`): the four shipped files come out byte for byte, so an export uploads to `src/data/islands/` with a clean diff. **Import** reads an island file into the open island.
- **Layout.** Desktop and landscape: palette left, island centre, selection, preview and checks right. Portrait: the island on top with the preview in its corner, tabs *Select*, *Props* and *Checks* below, a card with the selected prop's quick actions above the palette.
- Code in `src/editor/island/`: `doc.ts` (pure edits, tested), `scene.ts` (three.js views and thumbnails), `overlay.ts`, `panel.ts`, `builder.ts`, `checks.worker.ts`, `island.css`.

## Consequences

- Guillaume can move, add, remove and turn houses, workshops, woodpiles and landmarks per level, see the checks and the triangle budget live, try the island in the game and export the file to upload. CI then runs every test on it; the golden hashes in `tests/island-files.test.ts` change with any deliberate island change, as 0101 says.
- The ground, lanes and woods of an island, and sloped terrain (0096 §4), are not editable yet: part 2.
- A prop dropped where it does not fit is still placed (it may then hide under a cliff, as in the game); the checks flag it in red.
- `?map=edited` with no edited map now plays the shipped map on the play-test save instead of nothing (the player's real voyage was never at risk: without a readable map it used to fall back to the normal game).
