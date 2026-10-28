# v1.2 — "A new look" (build guide)

Status: **planned**, after v1.1. Decision [0222](../decisions/0222-a-new-look-smooth-terrain-blue-water-and-forests.md) (direction approved by Guillaume on 2026-10-26: "Yes that's exactly the direction we want"). Art direction: [docs/reviews/art-direction/new-look](../reviews/art-direction/new-look/README.md). Study and mockups: [docs/reviews/desktop-graphics](../reviews/desktop-graphics/README.md). Prototype code: [prototype/](prototype/README.md).

This page is written so the build threads can start without redoing the analysis: what to build, in which order, where in the code, with the numbers the mockup used and the traps it hit.

> Also in v1.2: the v1.0 bug fixes, moved from v1.1 (issue #255).

## The goal in one line

The *Traffic Architect* look on every quality level: smooth rolling island ground with soft colour zones, shores that slope into the sea, water coloured by depth, dense forests, a light haze, from the same island data.

## What the code looks like today (checked 2026-10-26)

| Part | Where | Notes for v1.2 |
| --- | --- | --- |
| Island drawing switch | `src/render/models/index.ts` (`buildIslands = buildHighlandIslands`) | The one place to swap builders; keep the interface `IslandsBuilder` (`types.ts`). |
| Island builder | `src/render/models/highlandIslands.ts` (~800 lines) | `islandParts` builds stepped ground (slabs, `extrudeOutline`, `RIDGE_TIERS`), towns and props; `HighlandIslands.batch` merges into meshes named `terrain`, `town`, `windows`, `lava`, all with the flat-shaded `vertexColorMaterial()` (`geometry.ts`). |
| Island layout and heights | `src/sim/islandLayout.ts` (`islandLayout`, `islandPoint`), `src/render/models/towns.ts` (`standHeight`) | Houses stand on tier heights from the layout. |
| Sim coast | `src/sim/coast.ts`, `src/sim/collision.ts` | Grounding, piers, berths. Must not move. |
| Water | `src/render/ocean.ts` (shader, `ShoreTextureCache`) | Shore distance is an R8 texture capped at 64 units (`*64.0` in `shoreDistance`), High uses it per pixel (`FANCY`), Low and Medium per vertex (`VERTEX_SHORES`). Also read by `calmWater.ts`, `currentWater.ts`, `roughWater.ts`. |
| Light and sky | `src/render/atmosphere.ts` | Sets sun direction, background and fog colour every frame. |
| Quality levels | `src/render/quality.ts` | `QUALITY` table; Ultra (0221) is added in v1.1. |
| Editors and CLIs | `src/editor/island/*`, `tools/fw/island.ts`, `tools/fw/check.ts` | Import `ISLAND_SCALE` from the builder; the island builder draws islands with the same code. |

## Build order (one thread per step, one PR each)

### 1. Height field and builder split (3 to 5 days)

- New `src/sim/heightfield.ts`, plain TypeScript, no three.js, Vitest-tested: `islandHeightfield(island, map) → { x0, z0, cell, w, h, heights: Float32Array, terrace: Uint8Array }` and `heightAt(field, x, z)`.
- Build it from the island data the way the mockup did from the mesh (see step 2 for the numbers), but from the layout and terrain shapes directly, so the sim, editors and CLIs can use it without a renderer.
- Split `highlandIslands.ts` into `ground.ts` (height field → mesh), `townProps.ts` (houses, props, trees placed with `heightAt`), and the batching that stays in `HighlandIslands`.
- Add the new builder next to the old one, picked by a URL switch `?look=v2` (and a `--look v2` option in `npm run shots`), so old and new can be compared and the old stays as a fallback until every island passes review.
- `standHeight` reads the height field when `look=v2`.

**Built (#268, 2026-10-28).** What the next steps start from:

- `src/sim/heightfield.ts`: `islandHeightfield(island, level)` (cached per island and level), `terrainHeightfield(feature, seed)` (barrier islands, sandbanks; null for reefs and ice), `heightAt(field, x, y)` (bilinear, seabed off the grid), `sampleIndex`, `fieldLod(field, step)`. Map coordinates (x east, y north; the scene's z is -y), heights in world units above the sea at 0. A field also has `terrace` (1 on level ground buildings stand on), `ground`/`grounds` (material per sample, for biome colours and forests) and `seed`.
- Numbers in `src/data/tuning/terrain.json` (Terrain tab in `?tune`): `cell` 0.8 is the canonical grid on every quality level; `groundStep` per level only thins what is drawn (Low 3, Medium 2, High and Ultra 1). Barrier tier heights moved there too.
- Unsmoothed on purpose: the field is the classic ground sampled exactly (beach at 0.66, terraces at their heights, mountains as their cones, ramps and slopes). Step 2 adds the blur, relief and terrace protection on top of it.
- Files: `ground.ts` (classic tiers, ice, terrain shapes, and `fieldGround`, the v2 mesh), `islandParts.ts` (per-island dispatch and the generated islands), `highlandPalette.ts` (B2 colours), `terrainProps.ts`, `townProps.ts` (homes, lanes, props and woods on a `Stand` height function; `fieldStand` under v2), batching in `highlandIslands.ts`. `?look=v2` (`src/render/terrainLook.ts`) and `npm run shots -- --look v2` (or `--look v2,x,y` with a camera point).
- Costs to watch: building every field of the game's sea takes about 1.5 s on a laptop, and the v2 ground is about 620,000 triangles on High and Ultra, 160,000 on Medium and 73,000 on Low. Step 2's smoothing should keep the canonical grid and may want a worker; #278 measures on devices.

**Sculpting core (#270, 2026-10-28), decision [0232](../decisions/0232-sculpted-terrain-saved-edits-replayed-over-the-height-field.md).** For the editor (#271) and CLI (#272):

- Island files take `sculpt: { version, edits }`; `designHeightfield(island, design, level)` builds a field afresh (generated ground, then the edits), `islandHeightfield` caches it.
- `src/sim/sculpt.ts`: the five operations, `applyEdit`, `keepMask` (terrace protection), `editProblems`, `editReach`, `Region`. `src/sim/sculptSession.ts`: `SculptSession` (`begin`, `dab`, `commit`, `cancel`, `undo`, `redo`, `sculpt`), each returning the region to rebuild. `src/sim/sculptChecks.ts`: `checkSculpt`, run by `checkIsland`.
- Numbers in `terrain.json › sculpt` (Terrain tab in `?tune`); big buildings' protected footprint is the prop recipe's `protect`.
- CLI (#272, decision [0234](../decisions/0234-terrain-command-line-tool-sculpt-commands-exportimport-and-l.md)): `npm run island -- <id> sculpt …` and `--steps` run the same `SculptSession` via `src/sim/sculptScript.ts` (`applySculpt`, `parseSculpt`, `sculptFrame`); list, remove, reset, export, import; limits in `terrain.json › sculpt › limits`. Guide: [docs/tools/terrain.md](../tools/terrain.md).
- Diagnostic sheet of every operation on Port Calda: [sculpt-ops.jpg](sculpt-ops.jpg).

### 2. Smooth ground (1 to 2 weeks with the editors)

What the mockup did (`prototype/new-look.js`), to reproduce with data:

1. Rasterise the island's ground into a grid, cell **0.8 units** (High, Ultra) or **about 2 units** (Low, Medium); outside the island the seabed starts at **-3.5**.
2. Gaussian blur, **sigma 2.4 units**: rounds the tiers and makes the shore slope into the sea.
3. Add relief noise on land: fbm at **0.05 per unit**, amplitude **±0.8**, faded in over the first 3 units of height.
4. Keep the town flat: within one 2-unit cell of a house or prop, height = **85% original + 15% smoothed**, so houses sit on their terraces.
5. Second blur, **sigma 0.9**, to clean the seams.
6. Mesh: a regular grid, smooth vertex normals, `MeshLambertMaterial({ vertexColors: true })` without `flatShading`.
7. Colour by height and slope (mockup values, to be replaced by the art director's per-biome table in `palette.json` grounds): wet sand under 0.1, sand under about 0.55 to 0.95, sand blend up to 1.1, then grass mixed from three greens by two fbm noises (0.03 and 0.12 per unit), and earth or rock where `1 - normal.y > 0.18`.

Add from the art review (must): slopes take each biome's cliff colours (grey only for north slate and east basalt); colour zones blend over **1.5 to 3 units** with slight jitter (the mockup's blends are too wide); a per-shape **`smooth` amount** in the island files (0 = stays faceted) for sea stacks, skerries, banded cliffs, the crater rim, fjord walls, volcano cones, ice and reefs, editable in the island builder and `npm run island -- set … --smooth`.

Editors: the island builder and sea editor draw with the same `ground.ts`; `npm run island` and `npm run check` run the height field checks.

### 3. Coast check (about 1 week, can run with step 2)

The smoothed shoreline (height 0 contour) must stay within a tolerance of the sim coast (`coast.ts`) everywhere, and berths and piers must stay reachable. Add a check to `src/sim/islandChecks.ts` / `mapChecks.ts`, run by `npm run check`, that compares the two outlines (suggested limit: 1.5 units, to tune) and lists the worst points per island; `npm run chart -- --overlay` draws both lines for review.

### 4. Water (about 1 week)

What the mockup did:

- A **seabed depth texture** over the view: the max of every island's smoothed height on a coarse grid (**2.5 units**, 400 × 400 around the camera), default **-9**, blurred **sigma 3 cells**, stored as RGBA8 (`(h + 9) / 12`) with linear filtering. In the game, bake it once per map like `ShoreTextureCache`, from the height fields.
- In `ocean.ts`'s fragment shader: `dep = clamp(-bed / 8.5, 0, 1)`; colour = shore → mid over `dep` 0 to 0.35, mid → deep over 0.35 to 1; drop the old `uShallow` tint; foam × 0.35 and fading out with depth; lighting `mix(1.0, light, 0.35)`; Fresnel `pow(1 - dot(n, V), 4) × 0.7`, capped at 0.45, toward the sky colour, with the facet normal mixed 70% toward up; sun glint `pow(dot(reflect(-sun, n), V), 160) × 0.5`.
- Colours: use the art director's per-sea table (shallow / mid / deep): ring `#58c2c0 / #2f8fb8 / #1f5f94`, south `#7fd6cf / #39a9c4 / #2479a8`, north `#6fb9c9 / #2f7d9e / #1d5578`, west `#4fa9a8 / #2a7a8c / #1d5068`, east `#6aa3ad / #3a7489 / #284f63`, in `palette.json` per sea; the shallows ring stays turquoise.
- `calmWater.ts`, `currentWater.ts` and `roughWater.ts` read the shore texture too: check each still lines up.
- Don't use the shore-distance texture for the deep tint: it saturates at 64 units and showed hard steps in the mockup.

### 5. Forests (1 to 2 weeks)

What the mockup did: random cells on the height field, kept if height > 1.4, `normal.y` > 0.8, a clump noise (fbm at 0.035 per unit) > 0.43, not within one 2-unit cell of a house, within 480 units of the camera; `InstancedMesh` per tree kind (broadleaf: icosahedron detail 1, crown at 2.6; pine: 7-sided cone 3.2 high; trunk cylinder), scale 0.8 to 1.6, five greens per kind via `setColorAt`, shadows on.

In the game: woods come from data (the island builder's `woods` areas, plus a density per biome), trees are prop recipes (`src/data/props/`) drawn instanced, counts by quality level. Art review rules: ring pines and broadleaf (up to about 40% cover), south palms and jungle broadleaf (about 55%), north snow-pines in valleys only (about 15%), west sparse birch scrub (about 8%), east no forest (heather, bracken, walls); keep 1.5 house widths clear round houses, no trees on lanes, fields, piers, plots or the camera's line to the town (Saltmere's town was swallowed in the mockup).

**Built (#275, decision [0236](../decisions/0236-instanced-forests-from-biome-recipes.md)):** `src/data/forests.json` (how-to: [docs/content/forests.md](../content/forests.md)), placement `src/sim/forest.ts`, drawing `src/render/models/forest.ts`. Woods off stay treeless; painted woods grow thick, unpainted ones in clumps. Cost on the whole game map at level 2: High/Ultra 801 trees, 17 draws, 16k triangles, 59 KB instances; Medium 563 trees, 11k; Low 380 trees, 7.5k triangles, no tree shadows. `?bench` on the old tablet may lower Low's `share`.

### 6. Haze and sky (2 to 3 days)

Haze is a light tint of each sea's sky colour, at most about 35% at the horizon, never grey; night stays deep blue (`#1d2f4a`). Set from `atmosphere.ts`, colours per sea in data. The mockup used `#cfe1ea` and fog `near = 1.5 ×`, `far = 5 ×` the camera distance.

### 7. Biomes and review (about 2 weeks)

Per-biome ground tables from the art review (beach, wet band, lowland, slope, high, terrace mapped to `palette.json` grounds): north flat = snow, steep = slate; west moss lowland and lava cracks keep their glow; east turf with the layered dark bands. Then island by island, ring first: High and Low on the same frame plus a coast overlay, the art director, then Guillaume.

## Quality levels

| Level | Ground grid | Trees | Water | Effects |
| --- | --- | --- | --- | --- |
| Low | ~2 units | fewest | depth colour per vertex | none |
| Medium | ~2 units | fewer | depth colour per pixel | none |
| High | ~1 unit | full | per pixel, Fresnel, glint | soft shadows |
| Ultra | ~0.8 unit | most | as High | shadows, ambient occlusion, haze (0221) |

Before release, `?bench` on the old tablet decides the Low grid and tree count.

## Traps the mockups hit

- **Black frames:** ambient occlusion (`GTAOPass`) together with a three.js `Reflector` (planar reflection) and the smoothed ground turned whole islands black in some frames. Island reflections are not part of v1.2's first cut; if added later on Ultra, test them with AO from the start.
- **Ambient occlusion over water:** the water, glows and basic-material meshes must be hidden from `GTAOPass`'s normal pass, or the water gets black bands.
- **Tilt-shift** adds nothing at our camera distance: don't build it.
- **Night** gets too dark with the new lighting: retune moonlight together with the haze.
- The water tint from shore distance saturates (see Water).
- The mockup's colour blends are too wide and its trees are placeholders.

## Effort

About 7 to 9 weeks in all: height field and split 3 to 5 days, ground and editors 1 to 2 weeks, coast check about 1 week, water about 1 week, forests 1 to 2 weeks, haze 2 to 3 days, biomes and review about 2 weeks.
