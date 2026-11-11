# 0295. Gusts on the sea

**Status:** Accepted (2026-11-11).

## Context

v1.8 "A richer look" (brief `docs/v1.8/brief.md`, issue #498) takes the picks of the Saltline
comparison (`docs/reviews/saltline-lighting/`) into the game. One of them: cat's paws, the darker
ruffled patches a gust leaves on the water, with calm slicks between. A sailing game should show
the wind on the sea, and the open water is the emptiest part of the picture.

The art director's limits for v1.8: a soft patch, at most about 8% lightness off the water's own
colour, never white or foam, half strength at night, never under the sea's night floor (`#1d3d7a`),
off on Low and Medium. The issue's first wording asked for every level with waves; the art
director's rule came later and wins, and the level switch is data.

## Decision

- **Look.** The ocean's fragment shader (`oceanShader.ts`, code in `seaGusts.ts`) shades the
  water's own colour before the foam and the light: inside a patch darker by `darken` with fine
  flecks of `ruffle` (light and dark, never white), between patches lighter by `slick`. A patch
  keeps only `reflect` of the sky's reflection and `mirror` of the mirrored boats and islands, so
  it reads as ruffled water from the low chase camera too. The result never goes under the sea's
  night floor.
- **Shape.** Two octaves of the foam's value noise, stretched along the wind (`length`, `width`),
  cut between the two `cover` levels. No new texture, no new draw call.
- **Motion.** The patches run downwind at `speedPerKn` per knot. They live in the wind's own
  frame, which turns about the camera's spot: a wind shift swings them round the boat instead of
  sweeping them across the sea. The drift is summed from the world's clock (a pause holds them).
- **When.** With the wind: none under `wind[0]` knots, full from `wind[1]`. `night` of the
  strength at night. None in a closed harbour (the swell's share of the coast's calm).
- **Where.** On the levels with `graphics.json › quality.*.gusts` (High and Ultra), only with the
  waves on, so Settings › Waves is the comfort switch. `?off=gusts` is the device test's switch.
- **Data and tools (decision 0153).** Numbers in `waves.json › gusts`; the `?tune` Waves tab and
  `npm run sea -- waves` list and set them (Drawing), and the levels' switch (Levels).
- **No sailing change.** Colour only: the sim never reads it. The patches do not show the sim's
  own gusts (one number at the boat); tying the two is a later idea.

## Consequences

- Cost: three noise lookups per sea pixel on High and Ultra, nothing on Ultra-low, Low and Medium
  (the levels a phone picks), no per-frame allocation. The software renderer here shows no
  difference (High, sailing, 3 runs: 387 to 423 ms on, 397 to 410 ms off); a device reads it with
  `?bench&quality=high` against `&off=gusts` (device round, issue #377).
- Turning them on for Medium is one data flip (`npm run sea -- waves
  graphics.quality.medium.gusts=true`) once the art director agrees and a phone `?bench` stays
  under 0.3 ms.
- The patches are not the same from one session to the next (the drift starts where the camera
  is); screenshots at the same clock still match.
- Review shots: `docs/reviews/sea-gusts/`.
