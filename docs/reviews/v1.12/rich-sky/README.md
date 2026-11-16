# A richer sky (#552)

v1.12 part 5, decision [0320](../../../decisions/0320-a-richer-sky-two-soft-cloud-layers-weather-driven-squalls-on.md). Goal: in the follow cam the sky carries the mood and the weather. The top view is unchanged (the dome only shows in the follow cam).

## Sheets (follow cam, High, desktop, top 62% of the frame)

- [final.jpg](final.jpg): before (main) | after, six skies: clear morning, noon, golden hour, night, fresh wind (22 kn, grey 0.3), squall coming (140 units off the bow).
- [looks.jpg](looks.jpg): round 1, before | A soft rims | B crisp | C towering. [detail-a.jpg](detail-a.jpg): A full frame.
- [squall-before-after.jpg](squall-before-after.jpg): the squall band after the art director's notes.

Remake: `npm run shots -- --list docs/reviews/v1.12/rich-sky/shots.json --chase --quality high --sizes desktop --wait 4000` (add `--tune docs/art/sky/looks/552-b-crisp.json` or `552-c-towering.json` for the rejected looks). The fresh wind and squall rows use [src/fresh.js](src/fresh.js) and [src/squall.js](src/squall.js), which hold the weather at once.

## Picks (art director, 2026-11-16)

| Question | Pick |
| --- | --- |
| Look | **A soft rims**; B too close to before; C heavy by day, blurred at night. C's stronger warm horizon band kept (`sun.horizonGlow` 0.5). |
| Squall | Band on the horizon touching the sea's edge, flat dark underside, soft top, slate (lighter than the storm fog `#56666e` at the top, darker at the base), thin rain streaks visible at 1280 px; shows only while a storm is ahead. Done in round 2. |
| Low sun | 1.8× near the horizon, capped there (`sun.lowGrow` range 0–0.8). The golden-hour disc stays where the light comes from (east after sunset); #550 owns that. |

## One atmosphere (`npm run shots -- --list … --both`)

All six pass `graphics.json` › `sky.check` ([colors.json](colors.json)): fog ΔE 0.0–0.4, sea ΔE 0.8–3.6 across the sun, 8.5–10.9 into the noon sun. The squall row looks south into the noon sun; three runs measured 9.0, 9.1 and 10.9 (main: 9.2), so it sits at the limit by the waves' phase, not by the sky.

## Cost

- One draw call as before; the sky mesh holds 1,552 triangles (was about 670). Hidden clouds fold to nothing in the vertex shader. No texture, no new pass.
- Headless (software renderer, High, noon, follow cam): frame 278 ms with the sky vs 270 ms on main, within the run-to-run noise (the same run with the sky off: 334 / 323 ms). The real-device `?bench&chase=1` joins the device round (#377).
