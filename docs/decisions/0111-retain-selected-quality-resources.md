# 0111. Retain selected graphics-quality resources

**Status:** Implemented for review (2026-10-23).

## Context

The transition investigation separated synchronous quality-setting work from its following draw. `GameView.setQuality` disposed the ocean, rain and wind streaks on every selection, even when returning immediately to a level already drawn. Disposing the sole water material releases its GPU program; the following draw recreates programs and uploads buffers. Shared island materials were also marked for recompilation once per mesh instead of once per material.

Exploratory Chromium measurements at 1280×800, High initially, recorded 3–8 ms synchronous selection work but 10–18 ms subsequent renderer calls on the second Medium/Low/High cycle, with three program links per switch. The first shadowless Medium selection cost about 160 ms in the renderer and eleven program links. These development-server captures diagnose the mechanism; they are not device performance guarantees or a production benchmark.

The same investigation measured the first `TradePanel.open` at 23–36 ms, subsequent opens near 2–3 ms, and market/quote generation below 1 ms. Most first-open work was in browser layout after DOM insertion, not market simulation. Alternating fresh-context tests of layout/style containment showed no improvement (23.3–26.1 ms without, 23.6–25.8 ms with). Docking report event timings additionally include pose search and automation. No docking rewrite is justified by these findings.

## Decision

- A GameView lazily retains one ocean/rain/streak bundle per selected quality level. Only the active bundle is attached to the scene. No levels are preconstructed or shaders warmed at startup; quality profiles remain the source of resolution and effect counts.
- Repeated selections reuse geometry, materials and GPU programs. High and Medium share their unchanged fancy-water shader material; Low owns its simpler shader. Three.js tracks changed shadow-light counts for lit materials itself. Remove the redundant global material invalidation, which created unused shadow variants for unlit and custom shaders.
- Every request, including a same-level request, checks the existing shoreline cache. Rebind every retained ocean to the current bake before drawing; inactive levels cannot revive a disposed texture after live map/coast edits.
- Release all retained bundles with the view. The shoreline cache owns their shared texture; oceans continue to borrow it. There is no unbounded per-map cache and no fixed island/port ids.
- Keep harbour behavior unchanged, including synchronous keyboard focus, tutorial hooks, trading and saves. Revisit its cold layout cost with target-device evidence instead of moving focus or DOM work to an unmeasured later frame.

## Consequences

Exploratory repeat captures reduced the second quality cycle's renderer calls to roughly 1.5–3.1 ms and zero program links. Returning to initial High also avoids recreating its resources. The first selection of a new shader/shadow variant can still hitch: the first Medium draw remained about 160 ms. This change does not claim to fix cold shader compilation.

Retained buffer arrays total 674,872 bytes for High, 308,752 for Medium and 117,904 for Low with current profiles. Selecting all three therefore retains about 417 KiB more buffer arrays than High alone, plus JavaScript particle state and driver/program overhead that these counts do not measure. It adds at most six geometry objects with the current three profiles; there is still one shared shoreline bake. A player who never switches incurs no extra bundle allocation.

Tests exercise real quality changes, rapid returns, shared shader ownership, shadow-state changes without forced material invalidation, same-level coastline edits, inactive shoreline rebinding and full bundle disposal. Browser checks and final production comparisons are recorded in the PR; desktop results do not establish tablet performance.
