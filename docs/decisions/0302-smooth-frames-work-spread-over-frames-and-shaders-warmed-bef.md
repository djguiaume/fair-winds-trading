# 0302. Smooth frames: work spread over frames and shaders warmed before the sea shows

**Status:** Accepted (2026-11-12).

## Context

v1.9 part #516: the game must never stall once the sea is on screen (phone fluidity targets, [docs/reviews/phone-fluidity](../reviews/phone-fluidity/README.md): 0 hitches of 100 ms or more after warm-up, 2 or fewer slow frames of 50 ms per `?bench` pass, no stall on port entry, town growth or quality change).

Headless Chromium draws with a software renderer (3 fps at High), so frame intervals there say little about a device. What does carry over is the game's own work in each frame: every animation-frame callback timed (simulation, HUD, builds, shader waits, the render call). Measured that way on main (2026-11-12, `?bench&quality=high`):

- **First use of a shader:** 565 ms and 680 ms frames in the first seconds of the route; three.js links a program the first frame that draws its material.
- **The other boats' water grids:** a fleet's open-water grid (which cells her hull fits in, decision 0215) was filled in one go when she first sailed near the player: 108 to 680 ms, 2.3 s for all 21 fleets, mostly `resolveCollisions` asked of every island and pier for every cell.
- **Town growth:** a level-up rebuilt the island in one go, 580 to 660 ms (`npm run perf` townGrowth).
- **Quality change:** 105 to 910 ms, High the worst: the island ground rebuilt, the shore and seabed baked again although the land had not changed.

## Decision

- **Work cut into steps** (`src/sim/steps.ts`): a generator that yields where it may pause; `finish()` runs it to its end at once (tools, tests, the editor, loading), `FrameJobs` (`src/render/frameJobs.ts`) runs a few milliseconds of it a frame, one job at a time, a job asked again under its key replacing the one still waiting. The frame budget is data: `graphics.json › builds.msPerFrame` (3 ms).
- **Islands rebuilt over frames:** a town growing or a quest finished in play rebuilds its island in steps (height field rows, town props, ground textures, forest) and swaps it in when done, the old one shown meanwhile; a quality change redraws the ground a batch a step. Loading, the editor and the tools still build at once (`spread` off). `view.finishBuilds()` finishes them now (quest tests, the shots tool).
- **Water grids filled a share a step:** `seamanship.json › traffic.gridCellsPerStep` (200 cells a sim step, a deterministic budget, so the sim stays the same on every machine); until her grid is full a boat steers straight for her mark, as she does off it. Each grid asks only the land and piers that can touch a hull in its box (`obstaclesNear`, the same answer at every point, tested): 2.3 s became 0.5 s in all.
- **Shaders compiled before the sea shows:** `ShaderWarmUp` compiles every material of the scene, hidden ones too (night lights, other weathers), with three.js `compileAsync` (parallel compile where the browser has it), then draws one frame; the splash waits for it. The other boats are built when they first wake, so two empty instanced batches (no boat, no draw) carry their shaders into the warm-up. A quality change compiles its new shaders the same way while the last picture stays up (the view holds rendering for those frames instead of stalling one).
- **Nothing baked twice:** the shore of the rough water uses the land's bake like the rest (the map's forced a second bake on the first change), and a seabed bake with the waves' exposure serves a level without it.
- **No allocation in hot paths found on the way:** the sea's shape, the island coasts' cache and the collision test compare in place instead of building keys and closures every step; traffic reuses its arrays.
- **A hitch budget in CI:** `tools/performance/budget.json › frameWork` holds the worst frame work at High, both looks: sailing and docking under 100 ms (no hitch), every frame of a town growing under 33.3 ms (twice the 60 fps frame). `npm run perf` reports `workMs` and `worstWorkMs`; the Render budget workflow now runs town growth too.

## Consequences

- Headless after (2026-11-12): `?bench` High no frame of 100 ms and two over 50 ms in three passes, the route's first (87 ms) one of them (before: 565, 680, 239 and 108 ms); Ultra none over 50 ms after its first frames (before: 607, 427, 134 and 111 ms); town growth worst frame 18 ms (was 580 to 660 ms in one), swapped in after about 34 s at the headless 3 fps (a fraction of a second at 60 fps); quality change 30 to 130 ms (was 105 to 910). Numbers and the Ultra run in the PR and the phone-fluidity table.
- The splash stays up a little longer while the shaders compile; the first frame no longer stalls.
- A town grown in play shows its new look a few frames later; a boat whose grid is still filling steers straight for a few seconds.
- New per-frame builds go through `Steps`: a builder that may take more than a few milliseconds yields, and a view setter that rebuilds in play takes `spread`.
- The phone `?bench` (#377) confirms on a device; its results go in the phone-fluidity table.
