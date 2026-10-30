# 0248. Coast calms the waves by depth, shelter and berths

**Status:** Proposed (2026-10-30). Issue #281 (also fixes #378), v1.3 wave 2. Behind `?waves=v2`.

## Context

The Gerstner sea of decision 0245 is the same everywhere: storm crests of about 3.4 units ran
into harbours, over reefs and against docks, the calm, rough, current and shallows sheets still
rode the classic sines (the new sea rose through them), and the other ships' bow waves floated on
the classic waves. The art director asked for depth and shelter on both CPU and GPU, no seabed or
sheet poking through the troughs, and shore foam that answers the sea. No fluid solver.

## Decision

**One bake, two channels.** The v1.2 seabed bake (`seabedDepth.ts`, decision 0233) gains an
exposure channel when the Gerstner waves are on (`seabedExposure.ts`): per cell, the share of
`rays` lines out to `fetch` units that run clear of land, reef or sandbank, smoothed. A harbour
closed on most sides scores low however wide it is; a straight coast about half; open sea 1. Each
pier closes the water within `berth` units, so a long pier's berth is calm without a circle round
the port. The texture becomes RG8 (depth, exposure); the CPU keeps the same bytes.

**The calm.** Per band b at a rest point (`sim/coastWaves.ts`, shader `coastCalm`):
`share_b = (floor + (1 − floor) · smoothstep(0, reach_b, depth)) · shelter`,
`shelter = mix(sheltered, 1, smoothstep(shelteredAt, openAt, exposure))`. Swell feels the bottom
first (`reach` 1), chop closer in, ripple last. The share scales a band's height and shift
together; wavelengths and directions stay, so the CPU and GPU sums stay exact (contract test
within 0.001). The bake is read with GPU-style bilinear filtering on both sides; off the bake is
open sea. Numbers: `waves.json` › `coast` (tune panel Waves tab; fetch, rays, blocks, smooth and
berth rebake).

**One sea surface.** `seaSurfaceShader` (`oceanWaves.ts`) is the only wave code on the GPU: the
ocean and the four sheets (`seaSheets.ts`) call `seaOffset`, and the sheets borrow the ocean's
uniforms and defines each frame. A sheet floats only its base lift plus both grids' sag, now
measured from the live field (`SeaWaves.sag`). `maxWaveHeight()` replaces the 0.68-unit constant.
Traffic bow waves float on `SeaWaves.heightAt`.

**Foam** (`seaFoam.ts`, soft-foam looks under `?waves=v2`): the shore ring widens, breaks up under
a drifting value noise and lifts with each crest as the sea gets up (calm sea = the v1.2 ring);
surf where the seabed breaks the swell (not in sheltered water); sparse whitecaps on the highest
open-sea crests. Roughness = swell + chop height over `foam.roughAt`.

**Rivers (#378).** On the new look's ground a river samples the height field (`stand`) at its
middle and banks instead of the classic tiers, and falls only where that ground drops more than
`terrain.json` › `rivers.fallSlope` per unit; it no longer stands as a waterfall over a smoothed
slope or sinks into it.

**Tool.** `npm run sea -- calm [--at "x,y …"]` prints each berth's swell and chop share, depth and
openness from the game's own bake.

## Consequences

- Boats (v1.3.1) read the calmed sea through `waveHeightAt`/`waveNormalAt` with the view's bake.
- Exposure bake adds load time only with `?waves=v2`; no extra draw call; one more texture fetch
  per ocean vertex (same texture), 0.4 MB more texture memory for today's sea.
- Left out: shoaling wavelength change and breaking waves (would break the exact CPU/GPU phase),
  direction-aware shelter (lee vs weather shore). #282 owns per-pixel normals and the storm look.
