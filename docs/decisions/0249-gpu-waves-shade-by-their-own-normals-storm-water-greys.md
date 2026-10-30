# 0249. GPU waves shade by their own normals, storm water greys

**Status:** Proposed (2026-10-30). Issue #282, v1.3 wave 3. Behind `?waves=v2`.

## Context

The Gerstner sea (decisions 0245, 0248) moved but was lit by its grid's flat facets: hard
triangles near the boat, sparkle toward the horizon. A grid only holds waves of `drawCells` cells
or more, so Low's 10-unit grid dropped most of the chop and a storm on Low read flat. Low and
Medium had no sky reflection, so their water was a brighter, more saturated blue than High's at
the same spot. Under a storm the water kept its day hue, only darker. The art director asked for
lit crests and darker troughs, softer facets, no horizon sparkle, a darker blue-grey storm sea
(never black) with lightly foamed crests, and Low's tint matched to High's. No screen-wide fluid
simulation, no new passes.

## Decision

**Every wave either stands or shades.** `SeaWaves.writeUniforms` splits each component's height
between the grid (`uWave.w`) and `uWaveFine`, the part the grid can't hold: it no longer
disappears, it shades. The vertex shader adds the undrawn swell and chop as slope and height per
vertex; on Medium and up the fragment adds the ripples per pixel from the rest point (four
waves, never the whole field). The physical field and boat sampling are unchanged.

**The waves' own normal.** The vertex shader crosses the displaced surface's two tangents, the
same normal the CPU's `waveNormalAt` tilts boats by (tested), and passes it as a slope. The
fragment mixes in a share of the grid's facets (`waves.json › look.facets`), and the sun shades
slopes `slopeGain` times steeper than they stand so a chop reads from the high camera; the sky's
Fresnel and the glint keep the true normal. Fine waves and facets fade out between `detailFrom`
and `detailTo` times the fog's near distance, so they follow the zoom and the horizon stays calm.
Crests lighten and troughs darken by `look.crest` against the sea's highest crest now.

**One sky tint on every depth-coloured sea.** The Fresnel sky reflection now runs on Low and
Medium too (per vertex there, where no glint needs a per-pixel normal); the glint stays High and
Ultra's. Low now matches High's water within about 2% and is never whiter. Ultra-low's plain
water (decision 0247) is unchanged.

**Storm water.** The ocean greys and darkens its mid and deep colours under the storm's gloom
(`graphics.json › water.depth.storm`), then the night floor still lifts them (never black).
`?waves=storm` brings the storm's gloom too, so a review shows the whole storm look. The
atmosphere's gloom no longer runs past 0..1 when the clock jumps back.

**Approximation against the boats.** `npm run sea -- drawn` lists, per quality level and review
sea, the physical crest height a grid leaves out and its sag: a boat may float up to their sum off
the drawn sea. Today: Ultra 0.18, High 0.28, Medium 0.5, Low 1.3 units in the storm preview.

## Consequences

- No extra draw call, triangle, texture or pass; Ultra's graphics memory stays under budget (434
  MB of 470 at 4K).
- More shader work. In the headless software renderer (`npm run perf`, `?waves=v2`, sailing,
  median frame): Low 98 → 121 ms, Medium 187 → 218 ms, High 250 → 285 ms. A raise, argued: the
  storm must read on every level; to confirm with `?bench` on the old tablet and a phone.
- The look is tuned in `waves.json › look` and `foam.whitecaps`, and `water.depth.storm`, all in
  the `?tune` editor.
- Not done: wind-aware shelter, shoaling wavelength, reef ring width varying with swell.
