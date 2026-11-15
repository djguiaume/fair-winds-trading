# 0317. Auto quality scales the resolution first, and the budgets cover every level and both cameras

**Status:** Accepted (2026-11-15).

## Context

Auto dropped a whole level on one slow average and never climbed back, so a storm cost the waves for the session. CI measured High from above only: the follow cam, Low, Medium and Ultra had no budget, and nothing held what the page fetches before the title menu (the Ultra code was in every download, a lazy import made ineffective by a static one). Issues #549, #557, #558 and #377.

## Decision

- Auto (`src/render/autoQuality.ts`, numbers in `graphics.json › auto`) judges the 95th percentile frame time. A slow window lowers the drawing resolution a step (floor 0.6), only a scale held at the floor for 8 s drops a level, a calm spell (20 s) gives resolution back, and a long calm (90 s, doubled per drop) raises the level, never above the level the session started on. `?perf` shows the scale and each move.
- `GraphicsEffects` moved to `graphicsEffects.ts`, so Ultra's code is fetched on Ultra only. The `firstLoad` scenario counts requests and bytes before the title menu; `budget.json › firstLoad` holds them.
- Scenarios `sailingChase` and `dockingChase`, and `levels` counts for Low, Medium and Ultra. The follow cam draws 9 to 10 meshes past the fog (sea, sky; about 2 % of triangles), so no culling by distance. The workflow summary prints the level by view table.

## Consequences

A budget raise at any level or view needs its reason in the PR. CI runs a few more measurements (about one minute). The device round for #377 stays with Guillaume (runbook in `docs/reviews/new-look-performance/README.md`).
