# 0295. Ultra draws the scene straight to the screen in one graded pass

**Status:** Accepted (2026-11-11). Issue #484. Follows [0246](0246-ultra-keeps-only-the-graphics-memory-it-uses.md) and [0289](0289-ultras-shadow-map-keeps-only-what-pcf-reads.md).

## Context

Ultra still runs Edge out of graphics memory on Guillaume's Xbox, and bloom (#501) will need some
more. `npm run perf` at 1920x1080 scale 2 (a 4K TV; Ultra draws 2564x1442, its 3.7 Mpx cap) held
363 MB on main:

| Item | MB |
|---|---|
| Scene target: 4x multisampled half-float colour 113 + 24-bit depth 56 | 169 |
| Scene target's resolved colour + an unused single-sample depth three.js adds | 42 |
| Effect composer's second full-size half-float picture (occlusion copy, grade) | 28 |
| Canvas: colour 14 + depth 14 | 28 |
| Shadow map 4096 (decision 0289) | 48 |
| Occlusion at half resolution (normals, occlusion, denoise, depth), sea mirror | 39 |
| Textures and buffers | 9 |

Two of these held pictures nobody needs:

- The composer copied the scene into its second target, multiplied the occlusion over that copy,
  graded it into the first target again, and only then wrote sRGB to the canvas. Each step only
  reads the pixel it writes, so one pass can do all of it.
- Ultra's canvas kept a depth buffer, but on Ultra only that last full-screen pass draws to it.

## Decision

- `UltraPipeline` drops the effect composer. A frame is the scene into its multisampled target,
  three's GTAO with its output off (only its half-resolution occlusion picture is used), then one
  full-screen pass (`gradeShader.ts`) that multiplies in the occlusion exactly as GTAO's blend did,
  adds the haze, tone maps and writes sRGB to the canvas.
- A canvas made for Ultra has no depth (`depth: false`). Every level below Ultra on that canvas goes
  through the pipeline's scene target without effects (`drawsBelowUltra`): High as before, and now
  Medium and Low too, without multisampling when the level has none. Until the pipeline has loaded,
  the view draws nothing on such a canvas rather than a picture without depth.
- `npm run perf` counts a canvas without depth as colour only.
- `budget.json › gpuMemory.limitsMB.ultra` goes from 385 to 355 (about 10% over the new 321 MB).

## Consequences

- Ultra on a 4K TV: 363 → 321 MB (−42 MB, −12%); at 1080p scale 1: 230 → 206 MB. Three fewer
  draw calls and two fewer full-screen half-float passes per frame.
- The same frozen frame at 1280x720 drawn by the old and new pipeline (same GTAO noise): about 2%
  of pixels differ, by 1 level of 255 at most (the half-float rounding of the dropped picture);
  0 pixels with the effects off, 0 for High after a step down.
- Bloom (#501) adds its half-resolution blur chain (about 20 MB on a 4K TV) and mixes in through the
  same grade pass, so it needs no full-size picture of its own: about 340 MB, still under the 349 MB
  Ultra held before this change.
- Next levers, if the Xbox still crashes, each measured on a 4K TV:
  - The single-sample depth three.js gives a multisampled target to resolve into (14 MB): unused
    here, but three.js has no switch for it, so removing it means reaching into its internals.
  - The scene in `R11F_G11F_B10F` instead of half-float RGBA: −71 MB. Frozen frame: 72-83% of pixels
    move by 1 to 5 levels, over 2 levels on under 1%. A small colour change, so Guillaume's call.
  - 2x instead of 4x multisampling: −85 MB, softer edges (not measurable here: the software
    renderer treats 2x as 4x).
  - Ultra's render-pixel cap on a TV (decision 0289's lever): every scene buffer shrinks with it.
