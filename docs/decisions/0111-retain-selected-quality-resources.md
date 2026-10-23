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

The final matched production comparison used main `080ef06` and this change with the same browser, settings and 1280x800 viewport. In an isolated capture, first Medium renderer CPU fell from 225.7 ms / eleven program links to 115.5 ms / five links; first Low from 39.1 ms / three links to 29.5 ms / one link; returning to initial High from 16.9 ms / three links to 1.1 ms / zero links. Repeated Medium/Low/High calls fell from 14.1/17.1/16.9 ms to 1.2/2.3/0.9 ms, with three links per switch becoming zero. These are renderer-call CPU timings, not complete frame or GPU timings. Cold shadow/shader variants can still visibly hitch; this reduces their cost without claiming to eliminate compilation.

Across three quality-cycle scenario runs, median setup including frame waits fell from 145.1 ms to 95.5 ms. One cold cycle fell from 658.7 ms to 195.2 ms, but cold startup/driver scheduling is variable; do not generalize that single result. Isolated first harbour open measured 23.1 ms before and 20.4 ms after, with no docking implementation change or claimed docking improvement.

A High / Medium / High browser check confirmed shadows disable and restore in screenshots and renderer state. The original lit program was selected again on High, with a distinct shadowless program on Medium and unchanged material versions. No startup prewarming moved this work elsewhere.

Retained buffer arrays total 674,872 bytes for High, 308,752 for Medium and 117,904 for Low with current profiles. Selecting all three therefore retains about 417 KiB more buffer arrays than High alone, plus JavaScript particle state and driver/program overhead that these counts do not measure. It adds at most six geometry objects with the current three profiles; there is still one shared shoreline bake. A player who never switches incurs no extra bundle allocation.

Tests exercise real quality changes, rapid returns, shared shader ownership, shadow-state changes without forced material invalidation, same-level coastline edits, inactive shoreline rebinding and full bundle disposal. Final combined validation passed 704 tests, typecheck, lint, formatting and the production build. Desktop results do not establish tablet performance.
