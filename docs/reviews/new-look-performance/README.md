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
