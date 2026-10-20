# Port overlay and destination regressions

Actual engine captures at 1280×720, Chromium with SwiftShader, 2026-10-20.
These are screenshots of the game, not generated previews. Simulation is paused through the
real menu and the menu is then hidden for stationary captures. Debug positioning uses the
real world, pier anchors, renderer and HUD. Each quality starts in a fresh browser context.

| Quality | Pier label | Watchman Key bearing | Draw calls / triangles in bearing view |
|---|---|---|---|
| Low | [Screenshot](port-label-low.png) | [Screenshot](watchman-bearing-low.png) | 11 / 32,543 |
| Medium | [Screenshot](port-label-medium.png) | [Screenshot](watchman-bearing-medium.png) | 12 / 40,831 |
| High | [Screenshot](port-label-high.png) | [Screenshot](watchman-bearing-high.png) | 18 / 73,940 |

The boat is at (225, -60); Watchman Key's pier is at approximately (134, -332), southwest.
Its direct perspective projection is about (3167, -6002), northeast on screen: this reproduces
why the old arrows pointed backwards. The corrected arrows both point southwest on the first
HUD frame after switching from Port Calda, while the compass keeps its correct world bearing.
The bearing screenshot is 287 m from the target, comparable to the reported 297 m case.

[Browser results](browser-checks.json) record the projections, rotations, next-frame marker motion,
compositor styles and render counts for all three profiles. No uncaught browser errors occurred.
The automated DOM regression additionally verifies that a moving sign only changes its transform
between text-refresh intervals. Text/prices and docking affordances remain covered by harbour tests.

Reproduce from the repository root with a development installation of Playwright available:

```sh
CHROMIUM_PATH=/path/to/chromium node docs/screenshots/overlay-navigation/capture.cjs
```

Omit `CHROMIUM_PATH` when Playwright's own browser is installed. `NODE_PATH` may point to an
external development installation; no game dependency is added. Run `npm test`, `npm run build`
and `npm run lint` for the automated regression suite and checks.

Software-rendered browser results are not physical-tablet FPS measurements. On the reporting
tablet, compare sustained Low/Auto sailing with/without signs, approach Stonehaven while turning,
check smooth pier attachment, docking/market prices, and switch targets through the chart while
north/south of Watchman Key. Also check portrait/landscape and all marker modes. That device
validation remains pending.
