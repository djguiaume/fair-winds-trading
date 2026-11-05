# Phone fluidity targets (reference: Zombie Assault: Resurgence, #405)

Guillaume (2026-10-31): Zombie Assault: Resurgence (Ninja Kiwi, native Android, about 1.9 GB) "looks better and is more fluid ... it just runs great with good visuals, textures, effects". It is a **feel reference only**: a native top-down shooter, not a browser sailing game. We do not copy its tech or style (art stays with the [art bible](../../art/art-bible.md)); we borrow measurable targets.

Status: the targets below come from our own readouts ([old-tablet-test](../old-tablet-test/README.md), [new-look-performance](../new-look-performance/README.md)) and the `?perf` / `?bench` metrics (decisions 0148, 0154). Guillaume's Zombie Assault feel notes can be added later; the criteria below do not wait for them.

## Targets (phone, Android 10, Medium unless noted)

Fluid is the p95 and the hitches, not the average: a steady 60 fps with one 150 ms stall feels worse than a flat 45.

| Target | Today (2026-10-30) | Goal | Where checked |
|---|---|---|---|
| Frame pacing: p95 frame time | 16.8 ms at Medium | stay at 16.8 ms (60 fps) at Medium | `?bench` |
| 1 % low | 59.5 fps | 55 fps or more | `?bench` |
| Hitches (>= 100 ms) per 75 s pass | 1 (first frames of a pass) | 0 after warm-up; first-visit island and town builds spread over frames | `?bench`, `?perf` |
| Slow frames (>= 50 ms) per pass | 1 to 3 | 2 or fewer | `?bench` |
| Weak phone at Low | not measured | p95 <= 40 ms (30 fps), no hitches | `?bench&quality=low` |
| Input response (steer, sail trim) | not measured | boat reacts on the next frame; no input queued behind a stall | feel test |
| Draw calls / triangles at Medium | 30 to 33 / 32k to 44k | no growth without a reason in the PR | `budget.json`, CI render budget |

## What to borrow (effect types, texture detail)

Budgeted ideas, cheapest first. None is started; each needs its own issue and ADR, and its cost measured on all quality levels (decision 0006, 0116).

| Idea | Why it reads as "rich" | Budget rule |
|---|---|---|
| Hit and impact feedback: short spray burst when the hull bumps a rock or a quay, a brief camera shake | Contact feels solid | One pooled particle system, at most 64 live particles, no allocation per frame, off at Ultra-low |
| Bow spray and wake particles tied to speed | Speed feels fast even at a low frame rate | Reuse the wake mesh (boat-looks) before adding particles |
| Texture sharpness on the boat and the quay (the things on screen longest) | Close objects carry the impression of quality | Detail where the camera looks (hull, sails, figurehead), not on distant ground; keep the Low and Ultra-low plain-material fallbacks |
| Colour coding and large tap targets | Instant read on a small screen | Already taken in the v1.5 UI ([ui-refactor](../../ui-refactor/v1.5/README.md)) |
| Light touches: gentle sun glints, lantern glow at night | Looks "lit" without real lights | Baked or additive sprites, no extra shadow map; check GPU memory (decision 0246) |

Dropped on purpose: heavy post effects (bloom stacks, full-screen blur) and a 1.9 GB texture budget. They cost fill rate, which is what limits the weakest device (decision 0240, 0247).

## Smoothness criteria (industry standard, as Fair Winds targets)

Seven things players feel as "smooth", each with a number we can read. Guillaume can add Zombie Assault feel notes later; these do not wait for them.

| # | Criterion | Target | How we measure |
|---|---|---|---|
| 1 | Steady frame rate: locked 30 or 60 fps, judged by consistency, not the average | Medium 60 fps (p95 <= 16.8 ms), Low 30 fps (p95 <= 40 ms); 1 % low >= 55 / 27 fps | `?bench`, `?perf` |
| 2 | Frame pacing: no spike over about 2x the target frame time, no GC hitch, no shader compile stall | Worst frame <= 2x target after warm-up; 0 hitches (>= 100 ms); no per-frame allocation; materials and shaders warmed before the sea shows | `?bench` hitches column; allocation review in code |
| 3 | Input latency: tap or touch to visible response | Under 100 ms; instant feedback on press (button state, tiller or sail response next frame) | Frame time plus a press-to-change check on the phone |
| 4 | No stalls when entering a town or changing quality | 0 hitches on port entry, town growth and quality change; island and town builds spread over frames | `?bench` route through a port, `npm run perf` townGrowth |
| 5 | Thermal: sustained fps after 10 minutes, not only the first minute | Last-minute average within 10 % of the first minute; no extra Auto quality drops | A 10-minute `?perf` run on the phone |
| 6 | Effects feel: short, cheap particles and impact feedback with sound | Pooled, instanced, at most 64 live particles, no allocation per frame; every impact has a sound | Draw calls and triangles in `budget.json`; code review |
| 7 | Texture clarity: sharp at the shown size | Mipmapped, compressed where the format allows, resolution matched to screen size, inside the GPU memory budget | `gpuMemory` in `npm run perf`; screenshot on the phone |

## Next

1. Optional: Guillaume adds Zombie Assault feel notes here later; they reorder the ideas above.
2. #377 device runs: record the table above with `?bench` on the phone (Medium), then Low on a weak device.
3. Turn the first idea you pick into an issue with a budget.
