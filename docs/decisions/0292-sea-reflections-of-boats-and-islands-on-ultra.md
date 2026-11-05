# 0292. Sea reflections of boats and islands on Ultra

**Status:** Accepted (2026-11-05, v1.7; Guillaume waived the visual review for this release). Issue #285, parent #279.

## Context

Decision [0221](0221-an-ultra-quality-level-for-desktop-and-xbox.md) listed planar reflections of
islands and boats as the last Ultra step, and the v1.2 prototype warned that three's `Reflector`
together with the occlusion pass and the smooth ground turned whole islands black in some frames
([v1.2 plan](../v1.2/plan.md), "Black frames"). Issue #285 asked for a controlled prototype with a
ship-or-defer gate: one reflection plane, filtered and cullable reflected objects, a smaller
target, no reflection of a reflection, tested with occlusion from day one, data-driven, Ultra-only
and switchable, the sky reflection staying as the fallback, measured at 1080p.

Guillaume asked (2026-11-05) whether the levels under Ultra should get a degraded, cheaper
reflection too.

## Decision

**Ship it on Ultra, behind its switch; High keeps its knobs but stays off until a device run says
otherwise.**

- **One pass, our own** (`src/render/seaMirror.ts`, loaded only on a level whose
  `graphics.json › quality.*.mirror` is true): the camera's mirror image under the sea draws the
  scene into a half-float texture at a share of the screen resolution, with the sea surface as an
  oblique near plane (as three's `Reflector` does) so nothing under the water shows. Only the
  player's boat, the other boats, the islands and the drawn sky are drawn; the sea, its sheets,
  wakes, foam, rain, streaks, glows and marks are hidden for the pass, so the mirror never mirrors
  itself. The shadow map is drawn once per frame by the scene's own pass and borrowed. The pass is
  counted into the frame's draw calls (`?perf`, `?bench`).
- **The water samples it** (`oceanShader.ts`, `MIRROR`): where a boat, an island or the sky was
  mirrored, it replaces the sky's Fresnel tint at the stronger of the Fresnel share and a floor
  (`reflection.strength`), so a steep view still shows the hulls; where nothing was drawn (alpha 0)
  the sky reflection stands as before. The waves' slopes push the sample about
  (`reflection.distortion`); at night the strength follows `nightStrength`.
- **Occlusion:** the pass runs before the composer and the water was already kept out of the
  occlusion's normal pass, so the black-island frames of the v1.2 mockup (`Reflector` rendering
  inside the composer's scene pass) do not occur; the headless shots at Ultra with occlusion on show
  none in day, night and chase views.
- **Data:** `graphics.json › reflection` (`strength`, `nightStrength`, `distortion`) and per level
  `levels.<level>` (`resolution`, `everyFrames` update policy, island `range`, `islands` on or off),
  all in `?tune` and `npm run tune`. Ultra: half resolution, every frame, islands within 220 units.
  High's degraded variant (quarter resolution, every other frame, boats and sky only) is defined and
  **off** (`quality.high.mirror: false`): High is where the render budget is measured
  (`tools/performance/budget.json`, 35 draw calls sailing) and a second scene pass would double its
  draw calls on phones and tablets that are fill-rate bound ([0240](0240-lower-pixel-cap-for-low.md),
  [0247](0247-ultra-low-quality-level-for-weak-tablets.md)). Low, Medium and Ultra-low never mirror.
- **Switches:** Settings › Display › "Boat and island reflections" (shown on the levels that mirror),
  `?off=mirror` for device runs (`src/data/graphics-switches.json`).
- Art bible rule 1's Ultra exception now includes the reflections.

## Measured (headless Chromium, SwiftShader software GPU, Ultra, sailing scenario, 1920×1080)

| Run (3 repeats, median of medians) | Draw calls | Triangles | Graphics memory |
|---|---|---|---|
| Ultra, mirror off (today) | 66 | 287 k | 304 MB |
| Ultra, mirror on | 61 | 287 k | 310 MB |
| Ultra, mirror on, occlusion off | 46 | 230 k | 296 MB |
| Ultra, mirror on, 4K TV screen (1920×1080 @2) | 49 | 275 k | **443 MB** (budget 470, was 428) |

The draw-call and triangle medians move with the passing traffic more than with the pass (the
mirror draws the boats, the sky and the islands within range again: about 8 to 12 calls in a
frame that has them); the memory is exact: +6 MB at 1080p, +15 MB at 4K for the half-resolution
half-float target and its depth. Measured before [0289](0289-ultras-shadow-map-keeps-only-what-pcf-reads.md)
cut the shadow map (428 → 349 MB on main at 4K), so with both the expected total is about 364 MB.

The software GPU says nothing about frame time on a real card; it does count draw calls and
memory exactly. On a real desktop GPU the pass costs one more scene draw at a quarter of the
pixels: the Ultra mockup's shadows plus occlusion were estimated at 2 to 4 ms ([0221](0221-an-ultra-quality-level-for-desktop-and-xbox.md)),
and this pass draws fewer objects at half the resolution with no post-processing, so about 1 to
2 ms at 1080p is the expectation to check.

## Consequences

- **Open: a real-device run.** `?bench&quality=ultra` then `?bench&quality=ultra&off=mirror` on
  Guillaume's desktop (and the Xbox when it is next on), and subtract. Joins #377. If the pass costs
  more than ~2 ms there, lower `levels.ultra.resolution` to 0.35 or `everyFrames` to 2 first;
  switch `quality.ultra.mirror` off only if that is not enough.
- **High:** flip `quality.high.mirror` in `graphics.json` and run `?bench&quality=high` on a phone
  and the tablet before shipping it there; its knobs are the degraded variant Guillaume asked about.
- Graphics memory on Ultra at a 4K screen stays under the Xbox budget (`budget.json › gpuMemory`,
  470 MB): see the table. A later raise of `resolution` past 0.5 must re-check it.
- The water material of a mirroring level is its own program (`MIRROR`), so Ultra no longer shares
  High's water program; one more shader warms up when Ultra is picked.
- Shots: [docs/art/reflections](../art/reflections/README.md).
