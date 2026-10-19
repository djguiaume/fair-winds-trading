# Art pipeline: swapping boat and island looks

The game logic never touches 3D models. Everything visual for boats and islands goes through one file, `src/render/models/index.ts`, which picks a **boat factory** and an **islands builder**. Phase 0 uses procedural placeholders in the style of the [3D mockup](mockups/README.md); a chosen art style replaces them by changing those two lines. The chosen style is in [0012](decisions/0012-boat-and-island-art-style.md): D storybook classic boats, B2 bright highland islands, A sea colours; [docs/art/src/lib.js](art/src/lib.js) has reference builders for them.

## Boats: `BoatModel` (`src/render/models/types.ts`)

A boat model is any object with:

- `root`: a three.js `Object3D` with the **bow toward -Z**, origin at the **waterline center**, 1 unit ≈ 1 m (the sloop is drawn ~11 m long, chunky like the reference ad).
- `update(pose)`: called every frame with the sail area (0–1), boom swing (radians, negative = to port), luff (0 = full, 1 = flapping), heel (radians) and the wind direction relative to the bow (for flags). The model decides how to show these: swing a boom, scale or swap sail meshes, rotate a pennant.
- `dispose()`.

The factory receives the ship class id (`'sloop'` today), so later classes (brig, fluyt, upgrades) can return different models. The renderer handles position, heading, bobbing on the waves, the wake and the blob shadow.

## Islands: `IslandsBuilder`

`(map, { shadows }) => Object3D`. It gets the whole map (island positions, radii, `look` hints such as houses, trees, rock, dock, and the course buoys so docks can face them) and should return as few meshes as possible: the placeholder merges every island into **one vertex-colored mesh** (one draw call). The beach line should match each island's `radius`, which is also its collision circle.

## Using glTF models (from Phase 1)

Per [0005](decisions/0005-tech-stack.md): model in Blender, low-poly with vertex colors or a small palette texture, export `.glb` with meshopt compression to `assets/`, keep the `.blend` source next to it. A glTF boat factory loads the file once, clones it per ship, finds named nodes (`Boom`, `Mainsail`, `Jib`, `Pennant`) and animates them in `update`. Keep the budget from [0006](decisions/0006-desktop-and-mobile.md) in mind: a few hundred triangles per boat, one or two materials.

## Generated models (Scenario)

A test of generating an island and a sloop with Scenario (image → low-poly GLB), with triangle counts, file sizes, cost and the step-by-step workflow, is in [art/scenario-tests](art/scenario-tests/README.md). Short version: good for islands and props after optimizing (meshopt + 512² WebP texture, under 50 KB each); boats come out as one frozen mesh, so sails and upgrades could not move. Because of the credit cost, all models stay code-built for now ([0014](decisions/0014-code-built-models-for-now.md)).
