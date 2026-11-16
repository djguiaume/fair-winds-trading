# 0327. Soft surface patterns near the camera and smooth hulls

**Status:** Accepted (2026-11-16, art director pick on the #572 sheet).

## Context

Guillaume misses softness, details and textures most against Saltline (#572). Up close every
surface was one flat colour in hard facets. Art bible rule 1 allowed no image textures. The top
view must stay as clean as before, and the old tablet and phone must not pay for it.

## Decision

- **Patterns without images.** One shared patch of the Lambert materials (`src/render/surfaceDetail.ts`,
  GLSL in `surfaceGlsl.ts`) draws planks (boats), boards (quays, signs, timber walls), stone,
  plaster, roof tiles, slate, thatch and sail canvas from the model's own position. A pattern only
  shifts the face colour's lightness, never its hue.
- **Strength (art director, sheet `docs/reviews/v1.13/surface-detail/`):** walls, roofs and land
  wood ±6 % (`B`), hull planks, decks and sail seams ±10 % (`C`): the boat is on screen every second.
  Numbers per pattern in `graphics.json › surface.patterns`, `strength` scales them all.
- **Which pattern** comes from the palette colour's name (`palette.json › surfaces`), which an island
  style may change (`styles.<id>.surfaces`), or a recipe part's own `surface` ("none" for plain).
  Parts carry it as `userData.surface`; `mergeAll` bakes it per vertex (`surface` attribute).
- **Fade by view:** looked down on (the top view) from 40 to 70 units, seen level (the follow cam,
  where towns stand 40 to 100 away) from 50 to 130; patterns finer than a few pixels fade too.
- **Soft edges:** hulls are shaded round between their strakes (creased normals, `hullCreaseDeg`
  40; rail, keel and transom stay crisp), and High's shadow edge is softer (radius 2 → 4).
- **Levels:** nothing on Ultra-low and Low; patterns on Medium; patterns and smooth hulls on High
  and Ultra (`quality.*.surfacePatterns`, `softEdges`). `?off=surface` for the device round.
- Without tone mapping (below Ultra) the pattern works on the colour as shown, else a sunlit white
  wall, past full white, would lose it.

## Consequences

- No new draw calls, triangles or downloads; one float per vertex on patterned meshes and a few
  noise lookups per near pixel. Cost measured in `docs/reviews/v1.13/surface-detail/README.md`.
- Art bible rule 1 becomes "flat colours, with soft procedural surface patterns near the camera on
  Medium and up" (the art director writes it).
- New props get patterns from their colour names for free; a new pattern is a GLSL function, a
  name in `SURFACE_KINDS` and its numbers in `graphics.json`.
- The sea has no patch: the follow-cam sea colour (art bible §14) cannot move.
