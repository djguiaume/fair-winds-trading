# 0284. Chase camera light and a drawn sky

**Status:** Proposed (2026-11-04). Accepted once Guillaume picks a sky look (issues #469, #470).

## Context

The close chase camera (decision 0272) looked grey: the background and fog are the day look's
`sky`, a dark teal made to melt into deep water from the sea camera's 58° tilt, and at 15° the top
of the screen is that flat wall. The sea's Fresnel sky reflection also turns milky at a low angle.
Guillaume asked for a real sky. An image skybox can't follow the day, weather and fog banks, clashes
with the low-poly look and costs texture memory on phones.

## Decision

- **Light (#469):** while chasing (`chase.eased`, called `low`), the fog and background blend to the
  drawn sky's horizon colour, and the sea mirrors a bluer sky (horizon toward zenith by
  `reflectZenith`) at `reflection` × its strength. The reflection change is scaled by
  `(1 - night)(1 - gloom)`, so night and storms keep their sea. The sea camera is unchanged.
- **Sky (#470):** a procedural dome (`src/render/skyDome.ts`), one mesh and one draw call, no
  texture: a gradient from the fog colour to a zenith colour, the sun or moon disc at its true
  height (`Daylight.skyHeight`, which sets on the horizon while the light keeps its floor) with a
  glow, stars at night, and 16 flat low-poly clouds round the horizon drifting with the wind. It is
  drawn at the far plane after the solid scene with a depth test, so only uncovered pixels shade.
  Its horizon is the fog colour, so the far sea melts into it; fog banks fade it to their haze.
- Four sky looks (day, golden, night, storm) blend through the same weights as the atmosphere's
  looks (`lookBlend.ts`). Every colour and number is `graphics.json` › `sky`, in `?tune` and
  `npm run tune`. Hidden (no cost) whenever the sea camera is in use.
- Tools: `npm run shots -- --chase` (the chase view at once) and `--tune file.json`; `?bench&chase=1`
  measures the chase view.

## Consequences

- One extra draw call and about 750 triangles while chasing. SwiftShader (software) frame time at
  Low rose about 10 % in the chase view; real GPUs reject the covered pixels early. Phone `?bench`
  with `chase=1` joins the device runs (#377).
- The chase tilt shows only about 5° of sky; a flatter chase tilt (11°) shows more and is offered
  to the art director as an option.
