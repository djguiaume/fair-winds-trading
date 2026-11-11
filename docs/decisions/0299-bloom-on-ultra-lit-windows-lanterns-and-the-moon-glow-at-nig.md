# 0299. Bloom on Ultra: lit windows, lanterns and the moon glow at night

**Status:** Accepted (2026-11-11). Issue #501. Follows [0297](0297-ultra-draws-the-scene-straight-to-the-screen-in-one-graded-p.md) and [0221](0221-an-ultra-quality-level-for-desktop-and-xbox.md).

## Context

The Saltline comparison (`docs/reviews/saltline-lighting/`) showed bloom as the clearest night
win: windows and lanterns glow warmly. The mockup used three's `UnrealBloomPass`, which keeps
full-size pictures and an effect composer; Ultra dropped both in 0297 to fit the Xbox's graphics
memory. The art director allows bloom as a rule 1 exception on Ultra only, at low strength and a
small radius, with nothing by day: sailcloth and foam never bloom.

## Decision

- `UltraBloom` (`ultraBloom.ts`, shaders in `bloomShader.ts`) works the glow out after the
  occlusion: what is brighter than a threshold goes into a picture at half the screen (13 taps,
  each box weighed down by its brightness so a far lantern does not flicker), is blurred down
  through three more pictures, each half the one before, and added back up with a 3x3 tent. The
  grade pass adds the result before the haze and the tone mapping. No full-size picture is made.
- The threshold is on the brightest channel of the scene's light before exposure: 1.05 by day,
  above anything lit by the sun, 0.7 at full night, which lit windows (1.3), lanterns and the
  moon pass. In between it follows the night.
- Numbers in `graphics.json › ultra.bloom` (`strength`, `radius`, `threshold`, `nightThreshold`,
  `knee`, `levels`), edited with `npm run tune -- set graphics.ultra.bloom.…` or the `?tune`
  panel. `strength` is how much of a light is added back; `radius` the share each wider blur
  keeps of the one before. These are not `UnrealBloomPass`'s units: 1 and 0.8 here are a weaker,
  tighter glow than the mockup's 0.55 and 0.5.
- Settings › Glow switches it off (the chain's pictures are freed); `?off=bloom` for device tests.
- Ultra only. High has no half-float scene picture or grade pass to add it in.
- Art bible rule 1 gets the exception line.

## Consequences

- Graphics memory on a 4K TV (`npm run perf`, 1920x1080 scale 2): 321 → 330 MB, under the
  355 MB budget, which stays. Seven more draw calls a frame, all small full-screen passes
  (the largest 1282x721).
- By day the picture is unchanged; at golden hour only the sun's path on the sea gains a little.
- The speed on a real graphics card is not measured here (the software renderer cannot):
  `?bench&quality=ultra` against `&off=bloom` on the Surface and the Xbox, with the device round
  (#377).
- Shots: `docs/reviews/v1.8/bloom/bloom-sheet.jpg`.
