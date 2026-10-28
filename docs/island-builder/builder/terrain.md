# Terrain tab

*Decision [0235](../../decisions/0235-terrain-brushes-in-the-island-builder.md), issue #271. The same edits as `npm run island -- <id> sculpt …` ([docs/tools/terrain.md](../../tools/terrain.md)).*

Open an island, pick **Terrain**. The island is drawn from its height field in the top view and the 3D preview, lighter the higher it stands.

| Tool | Drag to |
| --- | --- |
| Raise / Lower | build the ground up or dig it down by *Strength* per dab |
| Flatten | level the ground to the *Target height* (empty: the ground where the stroke starts) |
| Smooth | even out bumps |
| Slope | an even ramp from the ground where you press to the *Top of the slope* height (empty: the ground where you let go) |

- **Size**, **Strength**, **Soft edge**: in the tool column, so a phone has them beside the island. The brush footprint follows the pointer; its soft edge is dashed. `[` and `]` resize.
- **Target height**: type world units, or press ⌖ and tap the ground to take its height.
- **Keep town terraces level**: on, the brush leaves the ground round buildings and build spots alone (the footprint turns amber over it). Off, it may reshape them and the checks name each building that no longer stands level.
- **View**: *Ground*, or *Sea level and depth* (colours from `src/data/depth-view.json`).
- **Undo / Redo** in the top bar (Ctrl+Z, Ctrl+Shift+Z): one stroke each. **Esc** or a second finger cancels the stroke being painted. **Reset terrain** removes every stroke; the recipe (coasts, plateaus, mountains) stays and can still be edited, the strokes replay over it.
- **Touch**: one finger paints, two fingers pan and zoom (and cancel a stroke). With the mouse, the right or middle button pans.
- Warnings under the panel: coast line under water or with land beyond it, a pier or the harbour lane too shallow to berth.
- **EN / FR** switch at the bottom of the panel.

Leaving the island, or the page, with terrain edits not yet exported asks first. *Export* writes the island file with its `sculpt`; *Play this island* plays the browser draft.
