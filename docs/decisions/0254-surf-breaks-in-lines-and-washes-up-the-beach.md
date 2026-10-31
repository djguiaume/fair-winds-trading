# 0254. Surf breaks in lines and washes up the beach

**Status:** Proposed (2026-10-31). Issue #397, v1.3.1 wave 1.

## Context

Guillaume, reviewing #286: "does each wave visibly make the water go up the coast?" It didn't.
The coast calm (0248) leaves the waves at about 12% of their height at the shore, and the shore
foam line moved on a fixed timer. The art director's open note (handover v1.3 to v1.3.1): #286's
stronger surf read as soft cloud puffs and the classic thin ring line was gone; wanted 1 to 2
thin breaking lines parallel to the shore, travelling in, crisp front and faded tail, the classic
ring kept underneath, fewer at 14 kn and more in a storm, half at night, never above `#f6f9fb`.
For the wash: a thin foam edge sliding up and back every 4 to 6 s, out of phase along the shore,
a wet band 15 to 20% darker and a little cooler, 0.5 to 1 m wide; rocky shores foam only.

The drawn swell can't do it: it is calmed near land, its crests are not parallel to the shore,
and the ocean is a plane that meets the land where it meets it.

## Decision

- **One surf clock for sea and sand** (`src/render/shoreWash.ts`). The phase runs at a breaker
  period of the sea now (6 s at 14 kn to 4.5 s in a storm, integrated so a building storm never
  jumps), plus the largest swell's own phase along the shore and a slow wobble, so neighbouring
  stretches land at different moments. Its uniforms are shared objects that the ocean and every
  island ground material hold, written once a frame.
- **Breaking lines in the ocean** (`seaFoam.ts`): lines of constant shore distance travelling
  in, one every `surf.spacing` units, beyond the shore ring (as wide as the ocean draws it now),
  1 line at 14 kn growing to 2 in a storm, each with its own gaps. They fade into the ring just
  as the wash starts up the sand. The ring is the classic smooth one again (`foam.breakup`
  0.75 → 0.15, `foam.widen` 1 → 0.4), its outer line no longer only on crests; #286's grain
  puffs near the shore are gone, and the reef surf further out is streaked along the crests.
- **The wash on the sand** (`fieldGroundGlsl.ts` calls `groundWash`): the ground knows how far
  up the beach a pixel lies from its height and slope, so the sheet runs further up a flat strand
  than a steep bank. It runs up fast (30% of the cycle) and slides back slower: a crisp foam edge
  with a lace behind it, wet sand under it and a wet band behind it to the highest reach,
  breathing with the wash; a 5% sky sheen at most. Rock and cliff take only the foam.
- **Only where the sea is open**: both read the coast's exposure bake (0248). A closed harbour
  gets none, a coast in the swell's lee keeps `foam.lee` of it. Calm seas get none.
- **Medium and up only, with the waves on**: Low and Ultra-low (waves off by default) compile
  and draw exactly what they did; with the waves forced on there they get the classic ring fix,
  no lines and no wash.
- **Data and tools**: `waves.json › surf` and `› wash`, in the `?tune` Waves tab and
  `npm run sea -- waves` (both through `oceanControls.ts`), meta in `tuning-meta-surf.ts`.

## Consequences

- No new draw calls, textures or meshes. Per pixel: the ocean's shore band adds two noises; the
  ground adds five reads of the exposure bake on beach pixels below `wash.top` only, behind a
  uniform early out. Headless numbers in `docs/reviews/waves-v13/README.md`; a device `?bench`
  on a beach is still owed.
- The wash follows the coast outline only through the exposure bake; its distance up the sand
  comes from the ground's own height, so a sculpted coast (#352) needs nothing more.
- `fieldGroundShader.ts` was at the 400-line limit: its shader text moved to
  `fieldGroundGlsl.ts`.
- Art director round 1 (2026-10-31): lines thinner and their tails shorter (`surf.strength` 0.75
  → 0.6, `surf.tail` 1.2 → 0.85); the wet sand a warmer, darker sand (`wash.wetTint` `#d6cbb8`)
  instead of a grey stripe, and a stronger foam edge and lace. A reach wider than 0.5 to 1 m is
  fine.
- Reef surf width varying with the swell (art handover, "later") is not part of this.
