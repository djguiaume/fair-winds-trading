# Phone fluidity targets (reference: Zombie Assault: Resurgence, #405)

Guillaume (2026-10-31): Zombie Assault: Resurgence (Ninja Kiwi, native Android, about 1.9 GB) "looks better and is more fluid ... it just runs great with good visuals, textures, effects". It is a **feel reference only**: a native top-down shooter, not a browser sailing game. We do not copy its tech or style (art stays with the [art bible](../../art/art-bible.md)); we borrow measurable targets.

Status: the targets below come from our own readouts ([old-tablet-test](../old-tablet-test/README.md), [new-look-performance](../new-look-performance/README.md)) and the `?perf` / `?bench` metrics (decisions 0148, 0154). The "Play notes" table is for Guillaume's impressions from the same phone; fill it in before the #377 device runs.

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

## Play notes (Guillaume, to fill in)

Same phone, a few minutes, then one line each.

| Question | Notes |
|---|---|
| What makes it feel smooth: frame rate, input, no stalls, loading? | |
| Which effects stand out most (hits, particles, light)? | |
| Which textures look best close up? | |
| Anything that feels worse than Fair Winds on the same phone? | |

## Next

1. Fill in the play notes; the rows above get reordered by what you feel most.
2. #377 device runs: record the table above with `?bench` on the phone (Medium), then Low on a weak device.
3. Turn the first idea you pick into an issue with a budget.
