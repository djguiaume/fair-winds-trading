# 0291. People on the quays and in the towns

**Status:** Proposed (2026-11-05), part of v1.7 (#477). Waits on Guillaume's `visual-ok`.

## Context

Towns grew over four levels, boats came and went, gulls circled the pier heads (decision 0285), but nobody lived there. Guillaume asked for tiny moving people (#477, 2026-11-04): walkers on the quays and in the streets, fishermen on the piers, dock workers by the cargo, cheap on a phone, data driven, switchable like the other annoyances, and kept out of the town rebuild (a visible rebuild is about 53 ms, decision 0116).

## Decision

- **Drawn only.** The people live in the view (`src/render/townFolk.ts`), never in the sim, the save or the balance. The rules shared by the view, the checks and the tests are plain TypeScript in `src/sim/townFolk.ts` (people per level, the split by kind, a walk and a place along it).
- **One person, one draw call.** Every person is the same prop recipe, `folk-person` (group `folk`, budget 160 triangles; 108 built), in one instanced mesh of at most `max` instances for every town together. Its parts are tagged `coat`, `arm`, `rod` and `load`; `folkModel.ts` writes the tags into a vertex attribute, and the material walks the figure on the graphics card: legs and arms swing with each instance's phase, steps a second and gait (`aWalk`), the rod shows only in a fisherman's hand, the load only on a worker's way out (the other vertices collapse to a point), and the coat takes the instance's colour from the `coats` palette list. No per-frame allocation; the CPU only moves each drawn person along its walk.
- **Paths come from the island file** (`folkWalks.ts`): the lane pieces the town shows at its level (the same rule as the drawn lanes, now shared in `townLanes.ts`: near a standing home, never across water or a cliff), the arrival and side piers' decks (`characterPiers`) with three fishing places at each pier's edge, and the cargo props (`crates`, `warehouse`, `drying-rack`, `net-rack`) a worker carries between and the pier root. Props stand where the town's props stand (`propStand`, shared with the landmark lamps).
- **Near the boat only, outside the rebuild.** A town's people are made when the boat comes within `range` units of its beach, fade in over `fadeSec`, fade out and are dropped when it sails off; a town that grows gets its people again the next time the boat is near. Each person is placed at random on a walk of its kind and walks it and back, resting at each end.
- **Data** (decision 0093): `src/data/town-folk.json` holds the people per level (4, 8, 14, 20), the kinds with their share, speed, steps a second and rests (`walker` in the lanes, `stroller` on the piers, `fisher` at the pier edges, `worker` by the cargo), the model, the coats, the range, the fades, the night share (30%) and the share at each quality level (High and Ultra all, Medium 75%, Low 40%, Ultra-low none). The editors' **Town folk** page and `npm run folk` share one description of the file (decision 0153); the Sea life page and `npm run life` now share the same page and command code (`fieldsDoc.ts`, `fieldsPage.ts`, `fieldsCli.ts`), so a third data file costs a description only. `npm run check` runs its checks.
- **Settings › Town folk** with the hazards and annoyances; off, nothing is drawn. `?off=folk` turns it off for a device run (`?bench` against `?bench&off=folk`).

## Consequences

One more draw call near a town, up to 20 people × 108 triangles in a port town (about 2,200), 60 people at most on screen (6,500 triangles), far under the issue's 10 to 20k estimate; the render budget (`tools/performance/budget.json`) is not raised: the headless run at High stays within it (numbers in the PR). Phone and tablet `?bench` with and without `&off=folk` are for Guillaume's device round. `npm run shots -- --query off=folk` takes a shot without them. Tests: `tests/town-folk.test.ts`.
