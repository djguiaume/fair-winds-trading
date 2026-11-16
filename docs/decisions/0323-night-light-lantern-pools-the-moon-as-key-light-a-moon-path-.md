# 0323. Night light: lantern pools, the moon as key light, a moon path to the horizon

**Status:** Accepted (2026-11-16).

## Context

Issue #547. At night the lanterns were glowing dots with nothing lit round them, the moon lit the
scene about as flatly as the sky did, and the glitter path from decision 0321 was too faint under
the moon's weak light, and stopped where the haze began. The night must stay blue, never black:
the sea never darker than `#1d3d7a` (art bible).

## Decision

- **Lantern pools** (`lampPools.ts`): the lanterns nearest the boat (`lamps.pool.count`, 6, her
  own stern lantern included) light the land, the fields and the water round them in the lamps'
  colour, fading over `lamps.pool.radius`. These are shared uniforms written by the lanterns each
  frame, with no real lights, on every level. The water gives back a small share (`pool.sea`, 0.2)
  so the harbour does not wash out. `?off=pools` switches them off.
- **Moon as key light**: on the levels with shadows, the shade is deepened more at night
  (`shadows.nightContrast` 0.5, against 0.3 by day). The same luminance-keeping move as by day
  shifts sky light into the cool moon light: lit faces keep their brightness, shaded ones get
  deeper and bluer, and never black, since the sky keeps half its light.
- **Moon path**: the glitter is `water.glitter.moon` (6) times stronger under the moon. Its far,
  smooth part is brighter (`far` 0.5), and it is added after the haze, which hides only `haze`
  (0.2) of it, so the path runs on to the horizon. This also lengthens the sun's path by day.
- A shared `chainCompile` helper (`materialChain.ts`) patches built-in materials in turn, for the
  haze and the pools.

## Consequences

- No new pass, light or texture. The pools are 6 distance tests per pixel on land and sea.
- The night sea stays at the floor. The top-view sea averages are L 26.2 to 28.6 against
  `#1d3d7a`'s 26.7, the same as main. The pools only add light.
- Saltmere at night sits at `sky.check`'s line (sea ΔE 8.5 on High, 10.5 on Medium). It was already
  there on main (9.7 and 10.3) and moves about ±2 from run to run with the harbour traffic.
- Medium has no glitter (no `REFLECT`), so its night gains the pools only.
