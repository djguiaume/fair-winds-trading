# 0239. Per-pixel ground shader for the new look

**Status:** Proposed (2026-10-30, issue #373; waits for Guillaume's look).

## Context

The new look's cliffs showed sawtooth teeth and its grass looked flat (Saltmere and Fogwatch, 2026-10-30; analysis in project files `smooth-terrain/analysis.md`). [0235](0235-smooth-island-ground-shore-on-the-coast-faceted-landmarks.md) coloured the ground in a texture, one texel per 0.8-unit field sample: each texel decided "slope or flat" with a narrow threshold and picked its cliff band from its height, so on a steep cliff the band flipped every texel and the slope edge followed the grid. A finer texture only makes smaller teeth; finer geometry (×4 triangles) doesn't touch the colour.

## Decision

- **Colour decided per pixel** in the ground's fragment shader (`src/render/models/fieldGroundShader.ts`, a Lambert material with its colour chunk replaced): the slope from the texture's interpolated levelness (blend widened to 0.10–0.30), cliff bands from a height smoothed over 1.2 units (the field's own height has small grid ripples that made band edges zigzag), the wet band from the pixel's height.
- **Textures, not colours, from the CPU** (`fieldGround.ts › fieldGroundTextures`): the flat colour (mottled, no longer blurred) with levelness in alpha; a shape texture with each texel's ground index and its smoothed height (16 bits); a small table of each ground's band colours, repeated to a common width. Built once, whatever the quality; one more RGBA texture per island than before (no mipmaps).
- **Zone edges:** each texel's ground is the one with the largest share, shares blurred over 0.6 units and read a jittered step aside (no longer rounded to whole samples, which made teeth); the shape texture keeps that share. Close up the shader takes the two leading grounds of the four texels round the pixel, interpolates how far one's share leads the other's, and draws the edge where they cross, measured in pixels from that lead's slope: a smooth line between texels, 0.5 units wide (never under about a pixel). Far off, where a texel is smaller than a pixel, it takes the mipmapped texture: cheaper, and no shimmer.
- **No fine wobble on edges** (Guillaume, 2026-10-30): a fine noise moving zone or band edges, however faint, reads as sawtooth; band edges keep one broad wobble (0.1 / unit), zone edges none in the shader. Levelness is blurred over 0.6 units before its threshold so slope edges run smooth too.
- **Rock stays sharp** (art director, 2026-10-30): grounds marked `sharp` in `palette.json` (rock, basalt, lava, ash, slate, moss and turf over rock cliffs) use a narrow slope range (`draw.sharpSlope` 0.13–0.18) and narrower zone edges (`edge.sharpWidth` 0.3); the flag rides in the shape texture's alpha. Grass sliding into earth bands keeps the wide blend.
- **Low stays cheap:** `draw.edge.crisp.low` is off, so Low draws flat ground from one filtered read (zone edges soft, as before) and reads the four texels' bands only on slopes. Low also draws two of the three detail octaves (`draw.detail.octaves`).
- **Detail:** three faint value-noise octaves on flat ground and faint strata on cliffs, each faded out where it would be finer than two pixels.
- **One material for game and builder:** the island builder passes its scale so bands and noises match the game. Every number is in `terrain.json › draw` with its tuning meta.

## Consequences

- No extra triangles or draw calls. Per pixel close up on Medium and up: 9 texture reads (1 filtered, 4 colour, 4 shape; plus 4 band reads on slopes); far off and on Low: 1 read on flat ground, 5 more on slopes; about a dozen hash-noise lookups.
- Headless `?bench` (software GPU, `?look=v2`, fps at full / 0.7 / 0.5 resolution): Low 15/17/19 and 15/19/21 before, 14/19/22 after; High 7/9/11 before, 7/8/10 twice after. With crisp edges on Low it was 13 and 12 fps at full resolution, hence the switch. A real phone and tablet `?bench` should confirm.
- Mottling stays on the CPU (seeded `valueNoise`); detail, wobble and strata use the shader's own hash, so they are not the same pattern as the sim's noise (nothing reads them).
- Option B (tiling detail textures, baked shade in folds) stays a later idea; it would plug into the same shader.
