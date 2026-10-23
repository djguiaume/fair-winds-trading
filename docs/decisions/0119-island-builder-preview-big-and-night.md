# 0119. Island builder: bigger 3D preview and night view

**Status:** Implemented for review (2026-10-23). Adds to the island builder of [0105](0105-island-builder-props.md). How to use it: [island builder](../island-builder/builder/README.md#3d-preview-and-checks).

## Context

Guillaume (2026-10-23): the builder's 3D view should be expandable to see the island better, and there should be a way to see it at night. The preview was a small fixed box at the game camera's angle that could only turn.

## Decision

- **⤢ Bigger view:** the preview fills the builder under its top bar (the whole screen on a phone). There you drag across to turn, up and down to tilt, and use the wheel or a pinch to zoom; **⟲** goes back to the game camera's view. **✕** or Esc closes it, and the small view goes back to the game's angle.
- **☾ Night / ☀ Day:** the preview uses the game's moonlit night look (`NIGHT` in `src/render/atmosphere.ts`: sky light, moonlight, water colour). Window glass and street lamps are drawn apart, tinted like in the game (`WINDOWS_BY_DAY` → `WINDOWS_AT_NIGHT`, now exported from `atmosphere.ts` and used by `view.ts` too), so lit windows show at night and dark panes by day.
- Lighthouse beams and beacon lights are separate scene objects in the game. They will be added to the night preview once the night lights work ("Beacon and lighthouse night lights") is on main.

## Consequences

- An island can be checked at night without playing it.
- The preview builds the island's glass as its own mesh: a little more work on each rebuild, unnoticeable at 6,000 triangles.
- The night preview is the game's night without fog, rain or the ocean shader; the colours are the same.
