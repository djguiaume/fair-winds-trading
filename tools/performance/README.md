# Repeatable browser performance reports

Use Node supported by Vite, `npm ci`, then `npx playwright install chromium` once.

1. `npm run build`
2. `npm run preview -- --host 127.0.0.1 --port 5180 --strictPort`
3. In another terminal: `npm run perf -- http://127.0.0.1:5180/ output/performance/before.json`

Repeat step 3 after rebuilding the comparison revision, with the same browser, hardware, window state, settings and scenario JSON. Use a production preview for comparisons. A dev-server run works but includes development overhead. `PERF_HEADED=1` runs with a visible browser; do not mix headless and headed measurements. Optional `PERF_BROWSER_PATH` selects an existing Chromium executable and `PLAYWRIGHT_MODULE` an installed Playwright module entry point in a managed runtime.

`scenarios.json` owns the viewport, quality, repeats, warmup, sampling durations, reporting budget and workload/search settings. Each run gets a clean browser context and fixed graphics quality (no automatic quality downgrade). No island or port id is fixed in the tool. Change data to adjust workloads; the game itself gains no instrumentation or dependencies at runtime. Outputs go to ignored `output/performance/`.

## What the scenarios measure

- **Startup:** browser navigation to the existing `?debug` interface becoming available. Includes first island construction, saved-level initialization and module startup, but is not a precise first-presented-frame measurement. The frame distribution is subsequent active play.
- **Sailing:** relocate offshore and raise sails on a beam reach. Actual simulation, HUD and renderer run normally.
- **Storm:** advance game time in configured increments until the simulator produces a mature storm, relocate into it, then sample normal simulation. Setup time includes the storm search; it is not an isolated storm rendering cost. The report records observed storm strength.
- **Docking:** discover a harbour pose with the game's own range query, lower sails, then allow the normal docking simulation. Records selected and actually docked port. Search time is included in setup, not a docking algorithm benchmark.
- **Town growth:** raise one discovered settlement one level (up to the configured target), then invoke the same view invalidation as the game's level-up event. Synchronous CPU duration and event frame spikes capture the rebuild. This is a synthetic geometry workload, not a test of trading or growth balance.
- **Quality change:** switch through configured graphics levels, reporting synchronous CPU time per call and surrounding frame spikes. This directly exercises shoreline caching.

Each report includes per-run median/p95/p99/max frame intervals, renderer-call CPU time (not GPU time), draw calls, triangles, geometry and texture **counts**, startup time, action plus first-two-frame latency, and frames above the data-defined reporting budget. Memory counts are not byte sizes. Frame intervals span consecutive renderer calls and therefore include ordinary simulation/HUD work and browser scheduling; the first partial interval is discarded. CPU render timing covers the three.js render call only. Event maxima include setup and should be interpreted alongside action metadata.

Setup frames are reported separately in `eventFrameMs`; steady distributions exclude setup and the first partial frame. Event intervals include browser automation scheduling overhead, so use the explicit synchronous change timings to interpret spikes. `npm run perf:test` checks the reporting statistics.

Timings and budgets are **reporting only**; they do not fail CI. Missing scenarios, browser errors and broken selectors do fail the command, with completed runs retained in the output. Compare repeat distributions, not one lucky maximum. GPU, browser version, drawing buffer, quality settings and revision are recorded. Headless desktop results establish a regression baseline and do not predict tablet frame rates: repeat on target hardware.

## On a real device

This tool cannot drive a tablet. Open the game with `?bench` (or `?bench&map=stress`) on the device: it sails a fixed route by itself, three passes at full, 0.7 and 0.5 resolution, then shows a table to copy (decision 0154; route and passes in `src/data/benchmark.json`). For free sailing, open the game with `?perf` (or `?map=stress&perf`) on the device instead, sail for a few minutes and press **Copy** on the readout (decision 0148). The report labels every number; thresholds are in `src/data/perf-readout.json`. Add `&scale=0.7` to draw fewer pixels, `&fps=30` to cap the frame rate, or `&tilt=50` to hold the turnable camera at a tilt (decision 0223: run `&tilt=45`, the flattest outside Ultra), or `&aa=1` to multisample on every level and see what antialiasing costs on Low and Medium (decision 0154). Results so far: [old-tablet test](../../docs/reviews/old-tablet-test/README.md).
