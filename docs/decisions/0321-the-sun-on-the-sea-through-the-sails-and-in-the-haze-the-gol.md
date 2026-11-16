# 0321. The sun on the sea, through the sails and in the haze; the golden light stays in the west

**Status:** Accepted (2026-11-16).

## Context

Issue #550, part 2 (part 1 is decision 0319). Looking into the sun from the follow cam, the sea
was one flat colour with a single glint, sails stayed dull with the sun behind them, and the fog
was the same blue all round, so the far sea met the sky's warm glow round the sun with a seam. The
sky part (#620, decision 0320) also found the sun disc in the east at golden hour: the light held
its warm sunset colour after sunset, but its direction had already swung east toward the moon.

## Decision

- **Glitter path** (`seaGlitter.ts`): on the levels with `REFLECT` (High, Ultra) the sea shader adds
  a broad reflection lobe toward the sun (the moon at night) made of hashed twinkling points;
  where a point would be under about two pixels it blends to the path's mean light, so the far
  path is smooth instead of shimmering. A boat's shade breaks it. It fades in as the disc rises
  over the horizon, so twilight has no pink path without a sun.
- **Sun through the sails** (`sunThrough.ts`): the player's, storybook and traffic sails add the
  sun's colour times their own when the eye looks toward the sun through them, sharper toward the
  sun (`sunlight.sailThrough`, `sailFocus`).
- **Haze toward the sun** (`sunHaze.ts`): the sea, land and field fog take the sky dome's own sun
  glow and low-sun horizon band, measured at the horizon under the look, from one shared set of
  uniforms. The dome reads the same `sunGlow()`, so sea and sky meet in one colour.
- **The light path** (`daylight.ts › lightPath`): the sun's arc runs until sunset, the light holds
  low in the west through golden hour and dusk (to 19:00), turns round the north to the east by
  `daylight.moonRise`, follows the moon to `moonSet`, then turns back to sunrise. Each step is
  smooth (tested), and the disc stays in the west while the light is golden.
- Switches `?off=glitter`, `?off=sunlight` (and `?off=contact`, missing from part 1) for the
  device round; no new Settings rows, since none of these is a hazard and each is a few shader
  lines in passes already drawn.

## Consequences

- No new pass, texture or draw call: High stays at 31 draws, 62 MB; Ultra at 4K at 334 MB.
- The follow view into the sun is brighter on the sea than the top view (open sea late ΔE 2.6 → 5.0,
  still under `sky.check`'s 10); the top view, the reference, is unchanged.
- The moon's path at night already comes from the glitter (#547 builds on it).
- Moonrise is now a data number; moving it later than 23 or moonset past 5.75 would make the turns
  too quick, and the meta ranges stop that.
