# Waves v1.3: benchmarks and acceptance (#286)

Decision: [0250](../../decisions/0250-waves-on-by-default-from-medium-up-with-ocean-comfort-contro.md). Wave model [0245](../../decisions/0245-shared-wave-model-and-cpugpu-contract.md), coasts [0248](../../decisions/0248-coast-calms-the-waves-by-depth-shelter-and-berths.md), look [0249](../../decisions/0249-gpu-waves-shade-by-their-own-normals-storm-water-greys.md).

## Where we are

| Check | State |
| --- | --- |
| Waves the same on every level and frame rate | tested (`tests/ocean-controls.test.ts`, `tests/sea-waves-contract.test.ts`) |
| No sailing rule reads the waves or the comfort switches | tested; `src/sim` unchanged by v1.3's controls |
| Headless frame cost, waves off vs on | below (software renderer: a regression baseline, not a device forecast) |
| Phone (Android 10, 8 cores) | **done 2026-10-31**: Medium off 59.8 fps, on 59.7 (1% low 59.5 both, 42k tris on vs 33k); High with waves 59.6. Vsync-capped: fits, headroom unknown |
| Surface (Iris Plus, High) | **owed**: same pair |
| Xbox Edge (High) | **owed**: `?bench&quality=high`, and a storm look on the TV (`?waves=storm`) |
| Weak tablet (Low / Ultra-low, waves off by default) | no device at hand; the default keeps v1.2's cost |
| Storm look on a real screen | **owed** (Guillaume) |

Regression coverage the issue lists, all on the simulation, which the waves don't touch:
docking and grounding (`berths`, `harbour-*`, `collision-bounds`, `grounds`), ships and upgrades
(`ship-files`, `shipyards`), currents and wind (`currents-sailing`, `wind*`), difficulty
(`difficulty*`, `npm run balance`), races and pars (`regatta`, `race-storms`), save and reload
(`save-transfer`). They run in `npm test` unchanged.

## Headless frame cost (2026-10-30)

`npm run perf` on a production preview, headless Chromium with its software renderer, 1280×800,
2 repeats, `?waves=v1` (off) against `?waves=v2` (on). Frame median / p95 in ms; the software
renderer is fill-bound, so the shader's per-pixel cost shows much larger than on a GPU.

| Level | Scene | Off | On | Change | Draws | GPU MB off/on |
| --- | --- | --- | --- | --- | --- | --- |
| Ultra-low | sailing | 48 / 63 | 56 / 92 | +18% | 20 / 20 | 8 / 9 |
| Low | sailing | 79 / 105 | 100 / 126 | +27% | 20 / 20 | 10 / 10 |
| Low | harbour (docking) | 56 / 72 | 71 / 89 | +27% | 22 / 22 | 11 / 11 |
| Low | stress fleet sea | 18 / 25 | 35 / 67 | +94% | 10 / 10 | 7 / 7 |
| Low | storm (`?waves=storm`) | | 101 / 136 | | 23 | 10 |
| Medium | sailing | 163 / 276 | 219 / 330 | +35% | 20 / 20 | 15 / 16 |
| Medium | harbour (docking) | 119 / 201 | 187 / 245 | +57% | 24 / 24 | 17 / 17 |
| Medium | stress fleet sea | 42 / 73 | 86 / 150 | +108% | 11 / 11 | 12 / 13 |
| Medium | storm (`?waves=storm`) | | 206 / 314 | | 23 | 16 |
| High | sailing | 175 / 436 | 233 / 451 | +33% | 31 / 26 | 54 / 55 |
| High | harbour (docking) | 230 / 383 | 225 / 427 | -2% | 36 / 35 | 59 / 59 |
| High | stress fleet sea | 69 / 148 | 133 / 208 | +91% | 17 / 17 | 51 / 52 |
| High | storm (`?waves=storm`) | | 250 / 450 | | 28 | 55 |

- **No extra draw calls, no extra GPU memory** (within 1 MB): the waves are the same ocean mesh.
- **CPU stays small**: the render call's CPU time moves by 0.1 to 0.5 ms; the sea state and wave
  lookups are under the plan's 0.3 ms budget.
- **The cost is per sea pixel**: about +20 ms on Low and +45 to +65 ms on Medium and High in
  this renderer, whatever the scene, so the open stress sea (mostly water) doubles while a
  harbour full of land barely moves. Only a device says what that is on a GPU.
- **Startup**: the coast's exposure bake (0248) runs only with the waves on: about 0.6 s of CPU
  here (once per land change), +0.3 to +1.5 s on the startup scenario. Watch the phone's start.
- The storm scenario of `npm run perf` found no mature storm in its scan window (a simulation search the waves do not touch), so
  the storm rows use the review storm sea instead.

## Device asks (one round)

On each device, two `?bench` runs, copied with the Copy button (`Switches:` names the waves):
`https://djguiaume.github.io/fair-winds-trading/?bench` then `…/?bench&waves=v1`. Ship if the
phone holds 60 fps on Medium with the waves (or the gap is small enough to keep them on), and the
Xbox stays at 60 on High.
