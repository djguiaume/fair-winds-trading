# 0289. Ultra's shadow map keeps only what PCF reads

**Status:** Accepted (2026-11-05). Follows [0246](0246-ultra-keeps-only-the-graphics-memory-it-uses.md).

## Context

Ultra still crashes Edge's graphics on Guillaume's Xbox (out of graphics memory). After 0246 it
held 433 MB on a 4K TV screen (`npm run perf`, 1920x1080 at scale 2). Counting each allocation:

| Item | MB |
|---|---|
| Shadow map 4096 px: RGBA8 colour 64 + 24-bit depth 64 | 128 |
| Scene target, 4x multisampled half-float colour + depth | 169 |
| Scene target's resolved colour + its depth | 42 |
| Plain half-float target for the passes after the scene | 28 |
| Canvas (colour + depth) | 28 |
| Occlusion at half resolution, textures, buffers | 38 |

three.js gives every shadow map a full RGBA colour texture, but PCF shadows only sample the depth
texture, so that colour is never read.

## Decision

Ultra puts its own shadow map in place (`src/render/shadowTarget.ts`, set in
`UltraPipeline.applyShadow`): a one-byte colour channel nothing reads and a 16-bit depth, set up as
three.js's own PCF map. A 16-bit step is 1/65536 of the shadow range, far finer than the shadow
bias, so the shadows stay the same. The scene target also stops copying its depth when it is
resolved (`resolveDepthBuffer: false`): no pass reads it, so that saves bandwidth, not memory.

## Consequences

- Ultra on a 4K TV: 433 → 349 MB; at 1080p scale 1: 300 → 220 MB.
- Same frozen frame at 1280x720 rendered with three.js's map and the lean one: 2 pixels of 921,600
  differ, by 1 level of 255.
- `budget.json › gpuMemory.limitsMB.ultra` goes from 470 to 385, so the saving cannot quietly be
  spent again.
- Still to learn on the Xbox: whether 349 MB fits. If not, the next lever is the resolution Ultra
  draws at on a TV (the scene's buffers grow with it), which changes the picture and is Guillaume's call.
- If a three.js upgrade changes how it sets up PCF shadow maps, `leanShadowMap` must follow
  (a test pins the formats).
