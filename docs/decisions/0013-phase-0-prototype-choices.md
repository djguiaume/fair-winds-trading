# 0013. Phase 0 prototype: sailing feel, controls and performance choices

**Status:** Accepted, 2026-10-19 (implementation choices; open to tuning after play-testing)

**Context:** Phase 0 of the [roadmap](../roadmap.md) asks for one boat on a stylized ocean that is fun to steer, with wind, a real no-go zone ([0007](0007-arcade-sailing-with-tacking.md)), keyboard and touch from day one, smooth on an old tablet and a phone ([0006](0006-desktop-and-mobile.md)), using the stack in [0005](0005-tech-stack.md). A parallel thread is choosing the art style for boats and islands, so the visuals must be easy to replace.

**Decision:**

| Topic | Choice |
|---|---|
| Sailing model | Arcade polar curve (details in [sailing-model.md](../sailing-model.md)): speed eases toward `polar(true wind angle) × wind × ship ratio × sail`. No drive within 45° of the wind, best speed on a beam reach, slower running. Hard braking in irons, slow coasting otherwise, so a quick tack keeps some speed and a slow one stalls. Rudder needs water flow but always keeps 40 % so you can't get stuck. Light leeway pushes the boat downwind. |
| Wind | One global direction and strength per map with gentle deterministic gusts (±15 %) and a ±6° swing. A settings button shifts it 45° to practise other angles. Real wind changes come in Phase 1. |
| Sails | Three steps (furled, half, full), so it is one tap per step on touch. |
| Scale | 1 unit ≈ 1 m; the sloop is drawn ~11 m long (chunky, like the ad); 1 knot = 1.6 units/s (arcade speed-up). |
| Controls | Keyboard: ←/→ or A/D steer, ↑/↓ or W/S sails, mouse wheel zoom. Touch and mouse: press anywhere on the sea and drag sideways like a tiller (the farther, the harder you turn), plus large ▲/▼ sail buttons. One input layer feeds both to the simulation. |
| Goal to test the feel | A looping practice course of three buoys by the docks of three islands; the first leg is upwind past a rock, so it must be tacked. Leg times are shown. |
| HUD | Plain DOM (Preact arrives with trade panels in Phase 1): speed, point of sail ("In irons!", "Beam reach"…), sail steps, objective and distance, wind compass with the red no-go wedge, boat heading and buoy bearing, an arrow to the buoy when it is off-screen, a one-time help card and tips when stuck in irons. |
| Performance | Quality levels low / medium / high (pixel-ratio cap 1 / 1.25 / 1.5, ocean grid, wind streak count, shadow map only on high). "Auto" starts low on touch devices with ≤ 4 cores, medium on other touch devices, high on desktop, and steps down when the average frame rate is below ~40 fps. Lambert materials, all islands merged into one mesh, a blob shadow for the boat, one custom ocean shader (flat-shaded waves, shallow tint and foam around islands, no reflections), rendering paused when the tab is hidden. Initial download is ~160 kB gzipped. |
| Browser support | three.js needs WebGL2: iPadOS/iOS 15+ and any recent Android browser. Older browsers get a clear message instead of a blank page. |
| Swappable art | Boats and islands are built only through `src/render/models/index.ts`, behind small interfaces (`BoatModel`, `IslandsBuilder`); see [art-pipeline.md](../art-pipeline.md). Phase 0 uses procedural placeholders in the mockup's style. |
| Deploy | One GitHub Actions workflow lints, tests and builds every push and PR, and publishes `main` to GitHub Pages. |

**Consequences:**

- Every number that shapes the feel lives in `src/sim/ship.ts` (the `SLOOP` entry) and is covered by tests, so tuning after play-testing is a one-file change. New ship classes (Phase 1+) are new entries with their own polar curves.
- Very old tablets without WebGL2 (iOS 14 and older) cannot run the game; if Guillaume's tablet is one of them, we revisit (three.js's last WebGL1 release or a lower-tech renderer).
- The repo's GitHub Pages source must be set once to "GitHub Actions" for the deploy job to succeed.
