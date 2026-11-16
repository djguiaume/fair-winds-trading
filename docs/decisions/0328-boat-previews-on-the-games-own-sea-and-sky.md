# 0328. Boat previews on the game's own sea and sky

**Status:** Accepted (2026-11-16, #629; Guillaume reviews the sheets at the v1.13 release).

## Context

The turntable boat of Boat looks and the Free Sailing setup (decision 0265) stood on a soft water
disc over a CSS gradient: two flat colours, sky over sea, split at the middle. Guillaume found it
"ugly" (#629). The preview should read as the same world as the follow cam, day and night.

## Decision

- **The game's own parts.** `src/render/previewSea.ts` builds the game's ocean (same shader and
  waves, `waterLookOf` shared with `oceanFor`), the drawn sky dome and the light (`Atmosphere`)
  in the preview's own scene, seen as the follow cam sees them (`low` 1). Open sea only: an empty
  shore and seabed bake, no mirror, no shadows. The water disc and the CSS backdrop are gone.
- **Steady sea.** `SeaWaves` reads a narrow `SeaSource` (the game's `World` fits it) and
  `holdSteady` makes it raise the sea of a steady wind, as the `?waves=` review previews did.
- **Hour and weather.** Free Sailing shows the preset's hour and weather kind; Boat looks keeps
  its day/night switch (`boat-preview.json › sea`: `dayHour`, `nightHour`, `weather`). The wind is
  `windKn` times the kind's mean strength (`weather.json`). Fog distance is `camera.json › distance`,
  as in the game.
- **Full-bleed canvas.** The canvas fills the stage behind the pages; the boat is framed in the
  ship line's span (between the pages) by a view offset, like the title's shifted scene.
- **Camera.** The whole view looks lower (tilt 24° → 10°, fov 28° → 30°, margin 0.8) so the horizon
  and sky show; she rides the wave height under her.
- **Pixels.** The preview draws within the quality level's `maxRenderPixels`, never under 1x,
  up to `maxPixelRatio`.

## Consequences

- Preview canvas: +1 draw call (ocean and dome, minus the disc), +6k triangles on Low, +14k on
  Medium, +30k on High. Its own canvas: the game's budgets are untouched.
- The game scene still draws behind these opaque screens (22 to 37 draws), as before; skipping it
  would also stop the islands' progressive build, left for later.
- A new sea or sky feature in the game shows in the previews for free.
