# Art pipeline: swapping boat and island looks

The game logic never touches 3D models. Everything visual for boats and islands goes through one file, `src/render/models/index.ts`, which picks a **boat factory** and an **islands builder**. Another look replaces the current one by changing those two lines. The chosen style is in [0012](decisions/0012-boat-and-island-art-style.md): D storybook classic boats, B2 bright highland islands, A sea colours. The game builds them in code ([0016](decisions/0016-game-models-style-d-and-b2.md)): `storybookBoat.ts` and `highlandIslands.ts` port the reference builders of [docs/art/src/lib.js](art/src/lib.js). The Phase 0 placeholders were removed (see git history before 0016).

**Model sheet:** `models.html` (`npm run dev`, then `/models.html?view=boats` or `?view=islands`; also published next to the game) shows the game's own models with draw-call and triangle counts, useful on the real tablet. Screenshots are in [art/game-models](art/game-models/).

## Boats: `BoatModel` (`src/render/models/types.ts`)

A boat model is any object with:

- `root`: a three.js `Object3D` with the **bow toward -Z**, origin at the **waterline center**, 1 unit ≈ 1 m (the sloop is drawn ~11 m long, chunky like the reference ad).
- `update(pose)`: called every frame with the sail area (0–1), boom swing (radians, negative = to port), luff (0 = full, 1 = flapping), heel (radians) and the wind direction relative to the bow (for flags). The model decides how to show these: swing a boom, scale or swap sail meshes, rotate a pennant.
- `dispose()`.

The factory receives the ship class id (`'sloop'`, `'cutter'`; unknown ids fall back to the sloop) and options: `upgrades` (`{ sails, hold, hull }`, each 1–3, stock by default; every level shows on the model, see [0011](decisions/0011-ship-lineup-and-upgrades.md)) and `rigging`. A model can implement `setLowDetail(low)`; the storybook boats hide their rigging lines at the low quality setting. `GameView` builds the model for the captain's active ship and upgrade levels and rebuilds it when they change. The renderer handles position, heading, bobbing on the waves, the wake and the blob shadow.

The sloop uses `sloop.ts` ([0051](decisions/0051-refined-upgrade-aware-sloop.md)) and the cutter uses `cutter.ts` ([0052](decisions/0052-refined-upgrade-aware-cutter.md)), sharing the refined construction in `refinedBoat.ts` with independently authored hull outlines and depth sections; other classes retain `storybookBoat.ts`. Its mast/gooseneck mainsail pivot and individual inclined jib axes retain real attachment points, including the extra upgraded jib. All 27 upgrade combinations remain supported. Shared storybook colours and scale live in `boatStyle.ts`. Low disables the rope draw and its buffer updates; materials and upgrade appearance remain inexpensive at all three qualities. Inspect individual upgrade levels with `/models.html?view=sloop&level=3&quality=low&still` (also `medium`/`high`, `sail=0.35`, `boom=-45`). See [actual engine screenshots](art/game-models/refined-sloop/README.md).

## Islands: `IslandsBuilder`

`(map, { shadows }) => Object3D`. It gets the whole map (island positions, radii, `look` hints such as houses, trees, rock, dock, and the course buoys so docks can face them) and should return as few meshes as possible: the highland builder merges every island into **one vertex-colored mesh** (one draw call). The good the island's port produces (or a `look.kind` override: `fish`, `timber`, `grain`, `stone`) picks the producer props: village and drying racks, forest and log pile, fields and windmill, boulders and a cart; without it the island is plain. Each island's harbour side (dock, town, lowest cliffs) faces the course buoy named after it. The beach line should match each island's `radius`, which is also its collision circle.

## Using glTF models (from Phase 1)

Per [0005](decisions/0005-tech-stack.md): model in Blender, low-poly with vertex colors or a small palette texture, export `.glb` with meshopt compression to `assets/`, keep the `.blend` source next to it. A glTF boat factory loads the file once, clones it per ship, finds named nodes (`Boom`, `Mainsail`, `Jib`, `Pennant`) and animates them in `update`. Keep the budget from [0006](decisions/0006-desktop-and-mobile.md) in mind: a few hundred triangles per boat, one or two materials.

## Generated models (Scenario)

A test of generating an island and a sloop with Scenario (image → low-poly GLB), with triangle counts, file sizes, cost and the step-by-step workflow, is in [art/scenario-tests](art/scenario-tests/README.md). Short version: good for islands and props after optimizing (meshopt + 512² WebP texture, under 50 KB each); boats come out as one frozen mesh, so sails and upgrades could not move. Because of the credit cost, all models stay code-built for now ([0014](decisions/0014-code-built-models-for-now.md)).

## Strategic coastlines

Phase 1 terrain polygons (`MapDef.terrain`) use the same world-space outline for shore collision, B2-colored extruded terrain in the merged island mesh, and ocean shallows/foam. Current sandbanks are exposed solid land, not depth zones. The ocean supports up to 64 added coastline edges and fails explicitly beyond its budget. Original circular island models remain unchanged. See [0019](decisions/0019-staggered-passages-first-map.md).

## Refined cutter review

Use `/models.html?view=cutter&level=3&quality=high&still`. Independent `hull=`, `hold=` and `sails=` parameters override the common level; `sail=0.35&boom=-45` checks lowering on the opposite tack, and `yaw=-130` changes the inspection angle. The cutter has a fine bow, aft-set maximum beam, broad flat transom and narrow V bottom, independently authored from the sloop’s rounded stern and fuller bilge ([0053](decisions/0053-distinct-cutter-hull.md)). It retains its longer/slimmer proportions, taller aft-set mast, red palette, two stock jibs / three upgraded jibs and 3/5/8 cargo pieces. Each jib has its own stay and fixed head/tack; mainsail handling matches the refined sloop. The wake footprint remains 13.64 × 4.851 m. Maximum cutter cost is 827 triangles / seven mesh draws plus one optional rope draw; Low omits ropes and their updates. See [captures and measured budgets](art/game-models/refined-cutter/README.md).
