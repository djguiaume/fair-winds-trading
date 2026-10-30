# 0246. Ultra keeps only the graphics memory it uses

**Status:** Accepted (2026-10-30). Issue #374.

## Context

On the Xbox (Edge), Ultra flashed a blue sea twice and then went white; afterwards Edge had no
WebGL2 until the console restarted. That is the browser's graphics process dying, being restarted
once, dying again and being switched off. High on the same Xbox holds 60 fps.

Counting every WebGL allocation of the game (headless, `?look=v2`, 1920x1080) gave the cause:

| Screen | High | Ultra before |
|---|---|---|
| 1920x1080, scale 1 | 86 MB | 458 MB |
| 1920x1080, scale 2 (a 4K TV) | 100 MB | 711 MB |

Edge on Xbox runs as an app with a small share of the console's memory; WebGL pages are reported to
crash past roughly 512 MB to 1 GB there. At 1080p Ultra held: shadow map 4096 (colour and depth)
128 MB, two 4x multisampled half-float composer targets 190 MB, the canvas's own 4x multisampled
buffers 71 MB, occlusion and the rest about 70 MB. Two of these were spent for nothing:

- The canvas was multisampled on Ultra, but Ultra draws the scene into its own multisampled target
  and only a full-screen picture reaches the canvas.
- Both composer targets were multisampled and had a depth buffer, but only the scene pass needs
  them; the occlusion, grade and output passes draw full-screen pictures.

## Decision

One Ultra for every device, made lighter without changing a pixel (Guillaume, 2026-10-30: no
Xbox-only Ultra, no cap at High):

- Ultra's canvas has no multisampling (`QUALITY.ultra.antialias: false`). After a step down to
  High on that canvas, the view draws High through Ultra's multisampled target with no effects
  (`UltraPipeline.renderHigh`), so High stays smooth.
- The composer keeps one multisampled target with depth for the scene pass and one plain target
  without depth for the passes after it; each frame starts with the scene's target as the read
  buffer.
- `npm run perf` reports each run's graphics memory (`tools/performance/gpuMemory.mjs`), and CI
  measures Ultra on a 4K TV screen against `budget.json › gpuMemory` (470 MB).

## Consequences

- Ultra: 458 → 300 MB at 1080p, 711 → 428 MB (435 in the CI run) on a 4K TV. The same frozen frame
  rendered with the old and new targets differs in 0 pixels; High after a step down from Ultra
  differs from the canvas-multisampled High only on anti-aliased edges.
- Whether 428 MB is under the Xbox's share is only known on the console: re-test Ultra there
  (`?perf`) when it is next on. If it still crashes, the next candidates are the shadow map's
  colour texture (64 MB, three.js keeps one next to the depth) and the composer's half-float
  precision, both measured with `npm run perf` before any change.
- A rendering change that adds graphics memory on Ultra now shows in CI.
