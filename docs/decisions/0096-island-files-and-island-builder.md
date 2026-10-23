# 0096. Island files and the island builder

**Status:** Accepted (2026-10-23): Guillaume approved the mockup (PR #72) and asked for sloped terrain and sloped paths in the builder (§4). Extends [0093](0093-data-driven-content-and-authoring-tools.md) and the map editor ([0095](0095-map-editor.md)). Mockup and plan: [docs/island-builder](../island-builder/README.md).

## Context

Guillaume asked whether the map editor can build an island: pick houses, a lighthouse or a woodpile from a menu and drag them where he wants, edit the terrain, draw roads, and do it for each settlement level. It cannot. The map editor moves and resizes whole islands; what is *on* a port island is TypeScript:

- `src/sim/islandLayout.ts` holds the four port silhouettes (coasts, islets, the Calda lake, raised ground and its heights, Stonehaven's quarry bench that changes per level), the side piers per level and the fishing moorings.
- `src/render/models/towns.ts` (1,650 lines) builds each port: about 34 building and prop models, then per-kind `if` branches that place the warehouse, workshops, log piles, mills, derricks, lamp posts, the slipway and the landmark, each with its own level rule (`level >= 3`, scale 1.45 then 2.1, `blocks(3 + level)`…). Homes come from a seeded plan along authored lanes (`characterTownPlan`), revealed 3 · 10 · 21 · 32 by level; lane pieces appear near occupied homes; Westholm's fields are picked from a grid; trees are a seeded scatter that homes, lanes and fields clear.
- A new port island today means 300 to 400 new lines of code across both files.

The tests already pin much of this down (`tests/island-layout.test.ts`, `towns.test.ts`, `settlements.test.ts`, `harbours.test.ts`, `models.test.ts`): coasts used for collision, pier heads where the simulation docks, houses never moving between levels, the workshop appearing when production unlocks, the clear harbour approach, triangle budgets.

## Decision

### 1. One file per island

Each designed island is a JSON file, `src/data/islands/<id>.json`, named after the island id in the map (`calda.json`, `saltmere.json`, `westholm.json`, `south-cay.json` for Stonehaven). The map's island entry points to it (`"look": { "design": "calda" }`); its position, radius and harbour bearing stay in the map file, so moving or turning an island in the map editor never touches the island file.

Coordinates are the frame `islandLayout.ts` uses today: **island-radius units, harbour toward +z, x to the right seen from the sea**. An island file scales with the radius set in the map.

```jsonc
{
  "id": "calda",
  "name": "Port Calda",
  "style": "timber",            // colours, default house and tree kind: fish | timber | grain | stone
  "seed": 7,                    // only for what stays generated (woods, house colours)
  "coasts": [[[-1.8, 0.25], [-1.7, -0.65], "…"]],    // first = the main island; more = islets
  "lake": [[-0.28, -0.45], "…"],                      // optional inland water
  "ground": [                                         // raised ground, lowest first
    { "outline": [["…"]], "height": 0.11, "material": "grass", "holes": [["…"]] },
    { "outline": [["…"]], "height": 0.32, "material": "grass" },
    { "outline": [["…"]], "height": 0.98, "material": "rock", "shape": "peak" },
    { "outline": [["…"]], "height": 0.68, "material": "grass", "from": 2 }   // a level-dependent bench
  ],
  "lanes": [
    { "points": [[-1.3, 0.38], [-0.95, 0.16], "…"] },               // revealed near homes, as today
    { "kind": "path", "points": [["…"]] },                           // always shown
    { "kind": "stairs", "points": [[-1.1, 0.18, 0.68], [-0.4, 0.34, 0.38]] }  // x, z, height
  ],
  "piers": [{ "x": -1.05, "z": 0.8, "length": 0.25, "from": 3 }],   // side piers; the arrival pier stays the simulation's
  "props": [
    { "type": "cabin", "x": -0.5, "z": 0.367, "turn": 155.6, "from": 1, "variant": 0 },
    { "type": "sawmill", "x": -0.05, "z": -0.2, "size": 1.7, "from": 1, "to": 2, "tags": ["workshop"] },
    { "type": "big-sawmill", "x": -0.05, "z": -0.2, "size": 2, "from": 3, "tags": ["workshop"] },
    { "type": "log-pile", "x": 0.35, "z": 0.82, "size": 1.1, "from": 1, "y": 0.025, "tags": ["log-yard:shore"] },
    { "type": "fishing-boat", "x": -1.75, "z": 0.1, "turn": 40, "from": 1 }      // a water prop
  ],
  "woods": { "kind": "pine", "tries": 2600, "spacing": [0.11, 0.185], "size": 1.8, "areas": [] }
}
```

- **Props** have a `type` from one catalogue (the ~34 models in `towns.ts` plus the four landmarks: homes, town buildings, timber, fish, farm and stone works, trees, landmarks), a position, a `turn` in degrees, an optional `size` and `variant`, and the level they **first appear** (`from`, 1 to 4) and optionally the last level they stand (`to`). A prop that changes at a level (the barn growing, the sawmill becoming the big sawmill, the keep at level 4) is two entries. Height is automatic (the ground under it) unless `y` is given. `tags` keep the game hooks the code sets today (workshop, log yard, windmill, residence order, field, solid boat).
- **Homes are ordinary props** (`cabin`, `fisher-house`, `farmhouse`, `stone-house`, `yard-house`) with their `from` level, so the seeded house plan becomes a fixed list Guillaume can edit; their order in the file is the residence order.
- **Fields** become `field` props with a `variant` (crop colour).
- **Ground** is a list of raised outlines with a height and a material (`grass` or `rock`), optional holes and level range. Every edge is a cliff, as today, unless the outline has a `slope` (see §4). `"shape": "peak"` is the rock cone of Calda's mountain. The sandy beach inset stays a rule of the game (`0.085` inside the coast), not data.
- **Lanes** are polylines (smoothed as today). A plain lane shows its pieces near homes that exist at the current level, so lanes still grow with the town; `path` is always shown; `stairs` carry a height per point.
- **Woods stay generated**, not hundreds of tree entries: a seeded scatter with spacing and size, limited to painted `areas` (empty = the whole island), and cleared by homes, lanes, props and fields at each level, exactly as now. Single trees can still be placed as `pine` or `broadleaf` props.
- Islands without a design file (the two hidden yards and the scenery islands) keep today's generated look. A **Convert to editable island** action can bake one into a file later.

### 2. Checks shared by the builder and the tests

A new `src/sim/islandChecks.ts`, like `mapChecks.ts`, used by the builder page and by `tests/island-files.test.ts` on every shipped island file:

| Check | Level |
|---|---|
| Every prop type, ground material and lane kind is known; levels are 1 to 4 and `from ≤ to` | ✗ error |
| Every land prop's footprint is on land, on one ground level, out of the lake (`layoutGround` with the prop's footprint, as `placeAt` does today, where a misplaced prop silently disappears) | ✗ error |
| Water props (fishing boats) are in water, outside every coast | ✗ error |
| Nothing in the harbour approach or on a pier (the corridor and pier lines of `characterPiers`; the sea approach test of `island-layout.test.ts`) | ✗ error |
| Not on a cliff edge: a prop closer than its footprint to a ground edge | ✗ error, the builder shows the distance to move |
| Buildings do not overlap (the footprint test `towns.ts` already uses) | ⚠ warning |
| Raised ground inside the coast; the lake inside the coast and clear of it | ✗ error |
| A lane piece never crosses water or a cliff; crossing a cliff needs `stairs` (a slope needs nothing) | ⚠ warning (the piece is not drawn) |
| Each level only adds: homes are never removed, and a prop with `to` is replaced at the next level or flagged | ⚠ warning (homes: ✗) |
| Mobile budget: an island at level 4 stays at or under **6,000 triangles** (today Calda 5,018, Saltmere 4,923, Westholm 2,769, Stonehaven 2,609), and the whole map stays inside the existing `models.test.ts` and `towns.test.ts` budgets | ✗ error over, ⚠ above 5,000 |
| Coasts changed: the map checks of 0095 run again, since coasts are collision, chart and water | as in 0095 |

### 3. The builder in `editor.html`

The mockup ([overview](../island-builder/overview.png)) is approved before anything is built:

- Double-click a port island on the map (or **✎ Edit island** in its panel) to open its builder; **← Back to the map** returns.
- The island is a live top-down render with outlines on top; a **level 1 to 4** switch shows the island at that level and, ghosted, what later levels add.
- **Props**: a palette of real model thumbnails by group, drag onto the island, select, drag, turn (handle, R / Shift+R, 15° buttons), size, duplicate, delete; *Appears from* and *Gone after* levels. A prop dropped on the current level gets that level.
- **Ground**: coast points, raised ground (draw, reshape, height, grass or rock, cliff or slope edges), mountain, lake. **Lanes**: lane, path and stairs. **Woods**: brush areas.
- A small **3D preview** at the game camera's angle, turnable; the checks of §2 live, with amber and red marks on the island.
- **▶ Play this island** uses the edited-map save of 0095; **Export <id>.json** writes the Prettier-formatted file to upload to `src/data/islands/` like the map file.
- Landscape and desktop first, and portrait works (island on top, tabs and palette below, preview in a corner), in English like the map editor.

### 4. Sloped terrain and sloped paths

Asked for by Guillaume after the mockup (not drawn in it; it comes with the builder, step 3):

- A raised outline can have a sloped edge instead of a cliff: `"slope": 0.15` (the ramp's width in island-radius units, outward from the outline), either for the whole outline or for a run of its edges (`"slopeEdges": [[2, 5]]`, edge indices). The ramp is a low-poly band from the outline's height down to the ground below, in the outline's material.
- Ground height becomes a function: `layoutGround` returns the interpolated height on a ramp instead of `null`. Trees, lamp posts, crates, log piles and other small props may stand on a slope; homes and larger buildings still need flat ground (a check: ✗ "building on a slope").
- Lanes and paths follow the ground height, so a lane crossing a slope climbs it as a ramp; `stairs` are only needed at cliffs. The lane check of §2 accepts slopes.
- Coasts, collision and the sea are not affected (slopes are inland). A slope adds a few dozen triangles per outline, counted in the budget.
- Step 2 (island files) has no slopes, so the islands stay identical; slopes arrive with step 3.

## Consequences

- A new port island becomes a file drawn in the builder, plus a line in the map, instead of 300 to 400 lines of code; Guillaume can move a house or a woodpile himself.
- Two steps follow, in sequence, after approval (plan in [docs/island-builder](../island-builder/README.md)): **Island files** (data out of the code, the four ports look *identical*, proven by geometry tests) and **Island builder UI**.
- `towns.ts` keeps the models (the prop catalogue) and one generic builder; the four per-kind branches and `characterTownPlan` go. `islandLayout.ts` reads coasts and ground from the files.
- Homes become fixed: a change to the old seeded plan no longer reshuffles them. Woods stay seeded, so editing near a wood can move which trees show; that is accepted, and the woods areas give control.
- The yard ports and scenery islands are unchanged until converted.
- Island files and tuning ([0094](0094-tuning-moved-to-data.md)) stay separate: numbers in tuning, places in island files.
