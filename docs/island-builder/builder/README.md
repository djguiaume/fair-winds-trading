# Island builder

*Decision [0105](../../decisions/0105-island-builder-props.md), step 3 of [0096](../../decisions/0096-island-files-and-island-builder.md), part 1: props, levels, 3D preview, checks, play and export. Part 2 adds ground (with slopes), lanes and woods.*

Open the map editor (`editor.html`, or `npm run dev` then `/editor.html`) and **double-click a port island**, or select it and press **✎ Edit island**.

![The builder at level 3, a log pile just dropped](props.png)

## Props

- **Add:** drag a tile from the palette onto the island. The outline shows green where it fits and red where it does not. On a phone or tablet, tap the tile, then tap the island. A new prop belongs to the level you are looking at.
- **Select:** click it. **Move:** drag it. **Turn:** drag the round handle (Shift snaps to 15°), or R / Shift+R, or the ⟲ ⟳ buttons. **Nudge:** arrow keys (Shift for bigger steps).
- **Duplicate:** Ctrl+D or ⧉. **Delete:** Delete key or 🗑.
- The panel sets *Appears from* and *Gone after* (a sawmill replaced by a bigger one at level 3 is two props: one 1 to 2, one from 3), position, size, colours (*Variant*), *Shape* (a fish house's height, a cabin's length), a fixed height and the game *tags* (`workshop`, `windmill`, `log-yard:shore`, `outbuilding`). Homes count as residences in file order.
- The hatched lane under the main pier is the harbour approach: keep it clear.

![Dragging a prop in](drop.png)

## Levels

**1 Hamlet · 2 Village · 3 Town · 4 Port town** (or keys 1 to 4) show the island at that level. With **Show later levels**, what later levels add is dashed; click a dashed outline to select it.

## 3D preview and checks

The preview on the right is the island at the game's camera angle: drag it to turn. The checks are the same code as the test suite (`src/sim/islandChecks.ts`): props on land and out of the lake, boats in the water, nothing in the harbour approach or on a pier, nothing on a cliff edge, buildings not overlapping, each level only adding, and at most 6,000 triangles at level 4. Click a result to select the prop and go to its level; red and amber marks show where on the island.

## Play and export

- **▶ Play this island** opens the game with your edited islands (and your edited map, if any) on a separate save, as for the map editor. Your edits stay in this browser.
- **Export calda.json** downloads the file. Upload it to `src/data/islands/` on GitHub (a pull request): CI runs every test. The golden hash test in `tests/island-files.test.ts` fails on purpose because the island changed: look at it, then paste the new hashes it prints.
- **Import** loads an island file; **Reset** goes back to the shipped island; **Undo / Redo** (Ctrl+Z, Ctrl+Shift+Z).

## Phone portrait

<img src="portrait.png" width="300" alt="Portrait">

The island on top with the preview in its corner, then tabs: **Select** (the panel), **Props** (the palette, with the selected prop's quick actions on top) and **Checks**. Two fingers pan and zoom.

## Code

`src/editor/island/`: `doc.ts` (the edits, tested in `tests/island-builder.test.ts`), `scene.ts` (top view, preview, thumbnails), `overlay.ts` (SVG), `panel.ts`, `builder.ts`, `checks.worker.ts`, `island.css`. Export uses `formatIslandJson` in `src/editor/model.ts`; play-test loading is in `src/data/editedMap.ts`.
