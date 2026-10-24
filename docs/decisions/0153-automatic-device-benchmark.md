# 0153. Automatic device benchmark (`?bench`)

**Status:** Implemented (2026-10-24).

## Context

The first old-tablet round ([results](../reviews/old-tablet-test/README.md), with the `?perf` readout of [0148](0148-perf-readout-for-device-tests.md)) depended on how the tester sailed: one run counted 2 seconds because a card was open, the other 2 min 24 s along a different course. Guillaume asked for the test to play a predefined scenario by itself, so every run measures the same thing and the tester only opens a link and copies the report.

## Decision

`?bench` (and `?bench&map=stress`) runs an automatic benchmark:

- A fresh captain's voyage kept in memory (the player's save and settings are never touched), no tutorial, and quest cards held back while it runs.
- Every hazard on (weather, storms, day and night, wind zones, currents) and the shifting wind, whatever the player's settings.
- The boat follows a fixed route at a fixed speed: the game moves it along the route every frame while the simulation runs wind, weather, towns, currents and the wake around it, so the sailing is identical on every device whatever its frame rate. The bow looks a little ahead along the route to round the corners.
- The route is sailed once per **pass**, each pass from the same game time (same wind, weather and daylight) at its own drawing resolution. The shipped passes are full, 0.7 and 0.5 resolution, which answers "is the tablet limited by pixels?" in the same run.
- The graphics level stays where it starts (Auto's first guess or the player's choice): no automatic drops during or after the run, so passes compare.
- The `?perf` readout shows the pass and the seconds left, then a results table; **Copy** gives one labelled line per pass (average, 1 % low, p50, p95, worst, slow frames, hitches, canvas size and level).

Route, speed, look-ahead, start time and passes live in `src/data/benchmark.json` (0093). The route is a 1 200-unit loop of today's sea past Saltmere, through the Gap Run current, along the middle passage near Gull Hook and Greyback, and back past Skerry: about 75 s per pass at 10 kn, under 4 minutes in all. The stress sea keeps today's ring at its centre, so the same route runs there and the two compare directly. A test checks the route stays in open water on both seas. The route walker is `src/perf/bench.ts` and loads only with `?bench`.

## Consequences

A device test is now one link and one paste, about 4 minutes per sea, and results from different devices and builds compare. The boat does not really sail during the benchmark (sail trim, tacking and collisions are skipped), which is right for measuring drawing and simulation cost but says nothing about handling. Docking, trading and town growth are not part of the route; the desktop Playwright tool (0102) still covers those. `?perf` with `scale` and `fps` stays for free sailing.
