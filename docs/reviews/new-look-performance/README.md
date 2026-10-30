# New look: speed and compatibility gates (#278)

Measured 2026-10-29 on main 56a9f49 (before #277), headless Chromium 153 on SwiftShader (software GPU), 1280x800, 2 repeats, production build, fixed quality, no auto quality. **Frame times here are regression evidence only** (decision 0006); counts carry over to devices. Reproduce: `PERF_QUALITY=high npm run perf -- 'http://127.0.0.1:5180/?look=v2' out.json` after `npm run build` and `npm run preview`.

Per scenario: draw calls / triangles / frame p95 ms (median of the repeats).

| Level | Scenario | Classic calls / tris / p95 ms | New look calls / tris / p95 ms |
|---|---|---|---|
| low | sailing | 19 / 30k / 46 | 20 / 36k / 48 |
| low | docking | 20 / 17k / 25 | 23 / 21k / 30 |
| low | townGrowth | 19 / 17k / 24 | 21 / 22k / 28 |
| medium | sailing | 19 / 39k / 66 | 20 / 50k / 76 |
| medium | docking | 22 / 25k / 36 | 25 / 35k / 49 |
| medium | townGrowth | 29 / 30k / 38 | 31 / 42k / 44 |
| high | sailing | 27 / 63k / 162 | 31 / 151k / 175 |
| high | docking | 31 / 47k / 86 | 38 / 151k / 147 |
| high | townGrowth | 42 / 56k / 84 | 46 / 154k / 129 |
| ultra | sailing | 53 / 107k / 574 | 57 / 282k / 561 |
| ultra | docking | 60 / 89k / 521 | 69 / 349k / 561 |
| ultra | townGrowth | 94 / 109k / 536 | 102 / 305k / 558 |

## What it says

- **Low and Medium** (the phone and tablet levels) grow about 20 to 40 % in triangles (30k to 36k, 39k to 50k when sailing) and 1 to 3 draw calls. Fine against the counts we already carry.
- **High and Ultra** grow a lot: the smooth ground is about 150k triangles on screen at High (classic 47k to 63k) and 280k to 350k at Ultra. That is the price of the new ground; the forests (#275) add about 24k at High. On the software GPU High p95 goes 86 to 147 ms docking.
- Worst frames (max) stay under 2x p95 except the first sailing frames at Medium and High (up to 2x); no repeated hitches.

## Budgets

- `tools/performance/budget.json › newLook` now holds the New look's own limits (High: 35 calls, 166k triangles sailing; 42 calls, 166k docking; 10 % over measured). The Render budget workflow measures both looks. This is a conscious raise for the new ground, not the default.
- Ultra stays the 60 FPS at 1080p target; headless cannot show it. Low and Medium acceptance budgets (proposed: Low 30 fps p95 <= 40 ms, Medium 45 fps p95 <= 25 ms on the tablet with `?bench`) need Guillaume's device numbers. **Open: real phone/tablet `?bench` and a desktop Ultra `?perf` readout on look v2.**

## Editor (sculpting)

`npm run fw -- editorperf` (shared SculptSession and FieldSurface, CPU only) on the largest island (Calda, 211x150 field, 188k vertices), 24 strokes of 40 points:

- Brush dab + redraw: median 0.19 ms, p95 0.35 ms. Stroke finish 0.5 ms. Undo / redo 0.5 ms, p95 0.7 ms.
- Strokes, undo and redo touch only their region (largest 810 of 31,650 samples); no full-map rebuild exists in the loop.
- Save (JSON) 0.2 ms. Reload with 24 edits replayed 97 ms. Heap +1 MB after 24 strokes, +6 MB after undo, redo and reload (no cache growth over repeated cycles).

## Compatibility

- Coast, grounding and berth positions do not depend on the graphics level: the sim and checks read the canonical field (`fieldLod` is draw only); `coast-checks` and the island checks pass on all levels (`npm run check`).
- Full test suite (1458 tests) passes; old save-code fixtures (FW1, FW2) still load; the classic look is the default and unchanged. Island files without `smooth`/`sculpt`/`groves` replay as before.

## Real device: Guillaume's Android 10 phone (2026-10-30)

Chrome 156, 8 cores, 8 GB, screen 412x924 @2.63, `?bench` (3 passes of 75 s, medium fixed, all hazards on), game v1.1.301 to v1.1.302. Runs 1 to 3 were on `?look=v2`; run 4 was the classic look (`?perf`, 1:09 of free sailing). The readout does not print the look yet.

| Run | Quality | Canvas | Draws / tris | avg fps | 1% low | p95 ms | Worst ms | Slow / hitches |
|---|---|---|---|---|---|---|---|---|
| New look, grown sea, full res | auto → medium | 513x1153 | 33 / 44k | 59.7 | 59.5 | 16.8 | 150 | 3 / 1 |
| New look, stress sea, full res | auto → medium | 513x1153 | 30 / 32k | 59.8 | 59.5 | 16.8 | 117 | 1 / 1 |
| New look, stress sea, 0.7 scale | ultra | 575x1292 | 115 / 462k | 53.6 | 20.0 | 33.4 | 67 | 52 / 0 |
| Classic look, grown sea (`?perf`) | auto → medium | 513x1153 | 33 / 44k | 59.8 | 59.5 | 16.8 | 100 | 2 / 1 |

- The new look at Medium is as smooth as the classic look on this phone (both 59.7 to 59.8 fps, p95 16.8 ms). Medium holds 60 fps at 16.8 ms p95 with one hitch per pass (80 to 150 ms, likely the first frames of a pass).
- Ultra on a phone is not smooth (1% low 20 fps) and draws 462k triangles on the stress sea. It is a desktop level; auto picks medium here, so this is only a ceiling.
- Still missing: an old tablet or low-end phone at Low, and a desktop Ultra readout at 1080p.

## Final re-measure after #277 (main with #369, 2026-10-30)

Headless, look v2, same method. Frame times were 2 to 4 times slower than the first run because the cloud machine was busier, so they are not comparable; the counts are.

| Level | Sailing calls / tris | Docking calls / tris |
|---|---|---|
| Low | 20 / 37.8k (was 35.7k) | 23 / 22.8k (was 20.6k) |
| Medium | 20 / 52.2k (was 50.1k) | 25 / 36.9k (was 34.6k) |
| High | 26 / 153.6k (was 150.8k) | 35 / 122k (was 151k, a different docking pose) |

The island review and the current-water grid add about 2k to 3k triangles in view, inside the `newLook` budget (166k at High). No budget change needed.

## Real device: Surface laptop, integrated GPU (2026-10-30)

Windows, Chrome 156, Core i7-1065G7, Intel Iris Plus Graphics, 32 GB, canvas 2484x1489 (3.7 MP). The setting was Ultra (the readout says "ultra → ultra", changed from High at 0:08): 17.9 fps average, 1% low 10 fps, p95 83 ms, 186 hitches over 8:36, 307k triangles, 114 draws.

- Not the Ultra target machine (a card that can do 1080p at 60 fps), and 3.7 MP is almost twice 1080p. It does show that an integrated chip cannot run Ultra.
- Found on the way: the automatic Ultra guess excluded "UHD Graphics" but not "Iris Plus", so auto would have started this chip on Ultra. Fixed here: Iris Plus, Iris and Iris Pro no longer guess Ultra (Iris Xe still can, it is much faster). `tests/ultra-quality.test.ts` covers both.
- Desktop Ultra on a discrete card at 1080p is still unmeasured.

## Real device: Xbox, Edge (2026-10-30)

`?perf&look=v2` at High (after a console restart), 3:19 of sailing, photo of the readout: 60 fps now, average 59, 1% low 30, p50 17 ms, p95 17 ms, worst 67 ms, 3 slow frames, 0 hitches, 0 quality drops, 50 draws, 179k triangles. The new look at High holds 60 fps on the Xbox.

- Before this run Ultra was tried on the same Xbox. The game then showed a blank sea, and afterwards Edge reported no WebGL2 at all until the console was restarted. Ultra on the Xbox is unmeasured and suspected of crashing the graphics process there; to be looked at in its own issue.

## Where we are (2026-10-30)

| Tier | Device | Level | Result |
|---|---|---|---|
| Phone | Android 10, 8 cores | Medium | 60 fps, p95 16.8 ms, about 41 to 44k triangles. Same as the classic look. |
| Console | Xbox, Edge | High | 60 fps, p95 17 ms, 179k triangles, 50 draws, no hitches. |
| Integrated GPU | Surface, Iris Plus | High | 60 fps (avg 59.8, p95 16.8 ms), 163k triangles, canvas 2041x1224, 2 hitches in 1:31. |
| Integrated GPU | Surface, Iris Plus | Ultra (by hand) | 18 fps at 3.7 MP, 307k triangles. Ultra is not for integrated chips; auto no longer guesses it. |
| Weak device | old tablet | Low | not measured |
| Discrete desktop | 1080p | Ultra | not measured |

- The new look fits the phone at Medium and the Xbox at High. Every readout that holds 60 fps is capped by the screen, so it says "fits", not how much room is left. To find the room, run the same three readouts again after each big rendering change and watch p95 and 1% low, or add `&scale=1.4`.
- Next phase (the waves milestone): the sea is drawn per pixel, so test it first on the phone at Medium and on the Xbox at High. Budget in `budget.json › newLook` is counts only, and waves will mostly cost fill rate, which the counts do not show. Re-read the same three devices, then update this section.
- High holds 60 fps on all three devices, so the new look fits without changing engine; Ultra is the level that does not scale down.
- Open: Ultra crashes or blanks the Xbox (#374), Low on a weak device, Ultra on a discrete card.
