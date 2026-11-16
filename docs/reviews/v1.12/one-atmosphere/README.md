# One atmosphere in both views (#573)

v1.12 part 2. Goal: switching view changes the camera, not the weather. Reference (Guillaume, 2026-11-15, art bible §14): the vibrant top view; the follow cam is brought to it.

## What was different

- **Fog.** The follow cam blended the fog to the drawn sky's pale horizon (`#a6d6ee` by day); the top view used the sea's own deep haze. Everything far from the follow cam turned pale.
- **Sky mirror.** At the follow cam's low angle the Fresnel mirror bleached the sea toward a pale sky (70% of the full reflection; at night 100%).
- **Ultra's screen haze** warmed the top quarter of the screen: the far sea from above, but the sky from behind.

## What changed (all options)

- One air for both views: the fog, the background and the dome's horizon are the same colour whichever camera looks (`graphics.sky.air`: 0 = the sea's haze, 1 = the sky look's horizon). The dome draws its own colours above a thin haze line (`sky.hazeLineDeg`).
- The follow cam's sky mirror is softened in every light (`sky.reflection`, 0.7 → 0.25), so its near sea keeps the top view's blue.
- The fog starts a little farther in both views (`weather.sight.near` 1.3 → 1.9 camera distances); from above it barely shows, from behind the mid-distance sea stays clear. The far end (2.4) is unchanged.
- Ultra's screen haze fades out in the follow cam.

## Options (follow cam; the top view is the reference column)

| Option | Air | Sky by day | Look |
|---|---|---|---|
| A sea air | 0, haze line 1.5° | as shipped | the top view's grey-teal haze, a grey band on the horizon |
| B sky air | 1 | as shipped (`#a6d6ee` / `#5aa0d4`) | seamless pale horizon |
| **C blue air** (picked by the art director, shipped) | 1 | `#7fc0e6` / `#3f8ed6` | seamless, bluer horizon and sky |

Sheets (3 places x 4 hours, High, desktop): [saltmere.jpg](saltmere.jpg), [sea.jpg](sea.jpg), [sunreach.jpg](sunreach.jpg).

## The numbers (`npm run shots -- --both`)

ΔE (CIE76) of the average sea colour, top vs follow, measured inside the fog's start in both views (about 2 is just visible, 10 plainly another colour). The top view itself changes by at most 2.0 (A), 2.8 (B), 2.3 (C) against before.

| Place, hour | Before | A | B | C |
|---|---|---|---|---|
| Saltmere morning / noon / golden / night | 3 / 2 / 3 / 9 | 3 / 2 / 2 / 1 | 3 / 2 / 2 / 1 | 4 / 5 / 2 / 1 |
| Open sea | 11 / 10 / 13 / 14 | 9 / 9 / 7 / 4 | 9 / 9 / 7 / 4 | 8 / 8 / 6 / 4 |
| Sunreach | 2 / 4 / 12 / 12 | 1 / 2 / 5 / 1 | 1 / 3 / 3 / 1 | 1 / 2 / 5 / 1 |

- The open sea shots look south, into the noon sun. Facing north or east the same spot measures ΔE 1.3 to 1.4: the rest is the sea lit against the sun and the patch of sea ahead, not the atmosphere.
- Land differs by ΔE 13 to 38 in every option, before too: from above the camera sees sunlit tops, from behind the shaded sides and cliffs. It is printed but not a goal.
- The fog colour is the same in both views in A, B and C (before: two colours).

## Limit (agreed with the art director, 2026-11-15)

One atmosphere = the same fog colour in both views (ΔE ≤ 2, the two shots are taken a few seconds apart) and the sea ΔE ≤ 5 across or away from the sun, ≤ 10 looking into it (the follow cam's bearing within 60° of the sun's or moon's). Land is information only. The numbers live in `graphics.json` › `sky.check`; `npm run shots -- --both` prints pass or FAIL per pair and a total.

Storms and dusk use the sky look's horizon in both views; a storm must read heavier than an overcast day, with the sea darker than the sky and no white-out (art director). The storm fog `#56666e` is the ceiling.

## Final check, option C (High, desktop)

Sheets with top view | follow cam at morning, noon, golden, dusk, night and storm: [final-saltmere.jpg](final-saltmere.jpg), [final-sea.jpg](final-sea.jpg), [final-sunreach.jpg](final-sunreach.jpg); numbers in [colors.json](colors.json). Storm rows use [src/storm.js](src/storm.js) (a storm's core held at the boat).

| Place | morning | noon | golden | dusk | night | storm |
|---|---|---|---|---|---|---|
| Saltmere | 2.0 ✓ | 2.7 ✓ | 1.7 ✓ | 1.3 ✓ | 1.0 ✓ | 2.0 ✓ |
| Open sea | 6.3 ✓ sun | 7.6 ✓ sun | **7.2 ✗** | 5.0 ✓ sun | 3.6 ✓ | 6.6 ✓ sun |
| Sunreach | 1.7 ✓ | 1.2 ✓ | 7.3 ✓ sun | 1.2 ✓ | 1.7 ✓ | 1.4 ✓ |

Sea ΔE, top vs follow; "sun" = looking into the sun or moon (≤ 10). 17 of 18 pass. The storm reads heavy in both views (sea darker than sky, no white-out).

**Known exception (art director, 2026-11-15):** the open sea at golden hour, sea ΔE 7.2. The low sun is 64° off the bow, past the 60° into-the-sun line (kept at 60° on purpose), and its wide glitter lightens the follow cam's sea. Owned by #550 (light) and #551 (water); #550 checks it again with `--both`.

Run it: `npm run shots -- --at 285,-60 --heading 180 --time 175 --both --sizes desktop` (prints the table, writes `colors.json`).

## Follow-up: Saltmere golden hour (#624)

Docked at Saltmere at golden hour (`--time 1800`, phone landscape) the sea read ΔE 5.4 against the limit of 5: the follow cam was a little darker than the top view. `sky.reflection` 0.25 → 0.45 brings the follow cam's sea up (landscape 3.7, desktop 2.6); every other hour at Saltmere still passes (largest: 7.0 looking into the sun, limit 10). Sheet: [../saltmere-golden/before-after.jpg](../saltmere-golden/before-after.jpg) (top | follow cam, before above, after below).
