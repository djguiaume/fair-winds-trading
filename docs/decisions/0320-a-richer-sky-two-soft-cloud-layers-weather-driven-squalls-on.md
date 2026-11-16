# 0320. A richer sky: two soft cloud layers, weather-driven, squalls on the horizon

**Status:** Accepted (2026-11-16, art director pick A; issue #552).

## Context

In the follow cam the sky is a third of the picture (0284, 0312). It was a smooth gradient with a
few flat pale clouds: the same sky in a calm and in a fresh breeze, nothing on the horizon before a
squall, one haze line for every hour. The goal for v1.12 is a sky that carries the mood and the
weather, with the top view's vibrant atmosphere as the reference (art bible §14, 0318).

## Decision

The drawn sky (`skyDome.ts`, still one mesh, one draw, no texture) gets:

- **Two cloud layers.** Low cumulus (`skyClouds.ts`): rows of eight-sided lumps, towering lumps
  over the taller clouds, soft rims (`clouds.soft`, picked 0.25 of the radius), warmer on the
  sun's side (`clouds.sunSide`). High streaks (`skyStreaks.ts`): tapered strips 7–20° up, soft on
  every side, drifting slower.
- **The weather decides how much shows.** Each cloud has a rank; a layer shows the clouds whose
  rank is under its amount, `clear + perKn × wind + gloom × gloom` (`skyWeather.ts`). Hidden clouds
  fold to nothing in the vertex shader, so they cost no pixels. Grey skies darken them
  (`clouds.dark`).
- **A low sun.** The sun (or moon) disc grows up to 1.8× near the horizon (`sun.lowGrow`, capped
  there by the art director) with a warm band along the horizon under it (`sun.horizonGlow`).
- **Storms on the horizon.** The two strongest storms off the bow (from the boat, within
  `squall.rangeUnits` of their edge, never one over the boat) draw as a slate band: soft lumpy top,
  flat dark underside, a rain veil with thin streaks down to the sea's far edge. Their strength
  follows the storm's own intensity and distance, so it fades in as a storm forms or nears.
- **A haze line by the hour.** `looks.<light>.hazeDeg` replaces `sky.hazeLineDeg` (day 1.5°,
  golden 3.5°, night 1.2°, storm 4°), blended like the sky colours.

The cloud rims blend over the dome inside the same draw (custom blending, alpha kept at its
maximum so the picture and the Ultra sea mirror's mask stay opaque). The material stays in the
opaque pass: nothing to sort (art bible rule 8).

## Consequences

- The top view is unchanged: the dome shows only in the follow cam; fog colours and `sky.check`
  still pass (`npm run shots -- --both`).
- About +900 triangles in the follow cam (the sky mesh holds 1,552, was about 670), no new draw
  call, no texture.
  Headless frame time at High is unchanged within noise; the real-device `?bench&chase=1` joins
  the device round (#377).
- Every number is in `graphics.json` › `sky` with `?tune` ranges (`tuning-meta-sky.ts`,
  `tuning-meta-clouds.ts`). Rejected looks: B crisp (hard rims), C towering (heavy by day, blurred
  at night); files in `docs/art/sky/looks/`.
- The golden-hour disc stays where the light comes from (low in the east after sunset, an older
  daylight quirk), left to #550.
