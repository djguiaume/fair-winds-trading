# 0245. Shared wave model and CPU/GPU contract

**Status:** Proposed (2026-10-30). Issue #280, v1.3 wave 1. Prototype behind `?waves=v2`.

## Context

v1.3 makes the waves follow the wind and storms (#279), and v1.3.1 floats the boats on them
(#283, #284). The drawn sea and anything the CPU floats must agree, at any quality or frame rate,
before the coast (#281), the GPU look (#282) or the boats build on it. Today's sea is three fixed
sines in the vertex shader, copied by hand in `waveHeight`.

## Decision

**Inputs and units.** The sea state (`src/sim/seaState.ts`) reads only the existing weather:
`windAt` (open-sea wind, from bearing in radians, speed in knots, storms included, with the 0..1
storm strength), the map seed, the world time (seconds) and the sim point (map units, x east,
y north). Each band averages that wind over its own window (`windowSec`, `samples`): a pure
function of time and place, smooth because the window slides, nothing saved. Height = `base` +
`perKn2` × mean kn² + `storm` × mean storm, capped at `max`. The window is the storm history: chop
(20 s) answers a shift in seconds, swell (120 s) builds as a storm arrives and keeps running after
it leaves. Depth and shelter are per-point multipliers owned by #281: both sides will compute them
the same way (CPU from the height field and `shelterAt`, GPU from the seabed texture).

**Waves.** Three bands (`src/data/tuning/waves.json`): swell (6 waves, 92-150 u), chop (8 waves,
22-42 u), ripple (4 waves, 11-16 u, `cosmetic`). Each band is a fixed fan, one wave per compass
direction with its own length and seeded phase, speed from deep-water dispersion (`gravity`). A
wind shift only moves height between neighbours (`max(0, cos)^spread`, blended to an even spread as
the wind's coherence over the window drops), so a crest never jumps and the total height holds.

**CPU contract** (`src/sim/waves.ts`). `setWaveField` freezes the sea at time t: per wave the
wavenumber vector, the phase wound back to [0, 2π) in double precision, the height and the
Gerstner shift (`steepness` × height). The summed slopes of the shifts are held under `steepLimit`
(0.8) so the surface never folds. `waveHeightAt` finds the rest point under a spot by fixed-point
steps (`inverseSteps` 4; each step shrinks the error by at least 0.8) and `waveNormalAt` gives the
exact normal there. Cosmetic bands are left out: physics never sees them.

**GPU contract** (`src/render/seaWaves.ts`). `uWave[i]` = (k.x, k.z, phase, height) and
`uWaveShift[i]` = shift (x, z), in scene space (z = −sim y), written each frame from the same field.
The shader adds `shift × cos θ` and `height × sin θ` at the rest vertex, θ = k·p + phase, so it
never multiplies a large time in single precision. A wave shorter than `drawCells` (2 to 4) grid
cells fades out of the drawing only.

**Tolerances** (tests `waves.test.ts`, `sea-waves-contract.test.ts`): GPU sum vs CPU within 0.001
units out to 900 units after 10 h of play; height lookup within 0.01 units in the heaviest sea;
normal matches the sampled slope; no band moves more than 0.005 units in 0.05 s. Drawn vs physical
on a coarse grid: up to the faded waves' height plus the grid's sag (Low's 10-unit cell fades chop
of 22-30 u); #282 closes that gap with its scalable grid.

**Baseline cost** (headless Chromium/Node, desktop CPU): sea state 17 µs, field 7 µs, one height
lookup 2.5 µs, so about 0.1 ms per frame with ~30 floating things. GPU: 18 waves per vertex instead
of 3 sines, on 2.4k (Low) to 26k (Ultra) vertices; same draw calls and triangles. Device numbers
come with #377 and #286.

**Acceptance budgets for the chain:** wave CPU ≤ 0.3 ms/frame desktop and ≤ 1.5 ms on the old tablet;
+0 draw calls for the waves themselves; Low stays within its ADR 0240 pixel cap and 30 fps floor on
the old tablet; boats (v1.3.1) read only `waveHeightAt`/`waveNormalAt`. No Rust or WebGPU.

`?waves=v2` draws the model; `?waves=calm|wind|storm` holds a review sea state (`previews`).

## Consequences

- One field feeds the ocean shader and everything that floats (`View.seaHeight`), so they agree.
- Waves are a pure function of seed, time and place: same at any frame rate or quality, nothing to save.
- All numbers are in `waves.json` and the `?tune` panel's Waves tab.
- Open for #281: depth/shelter multipliers, shore calm and the floating sheets (`MAX_WAVE_HEIGHT`)
  still assume today's 0.68-unit waves. Open for #282: normals per pixel, ripples, Low's chop gap.
- The look of each state is the art director's call (calm/wind/storm sheet on the PR).
