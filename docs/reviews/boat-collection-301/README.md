# v1.4 collection, fleet review and acceptance (#301)

Sheet: [figureheads.jpg](figureheads.jpg), bow close-ups on the sloop at max upgrades, left to right: mallet, sheaf, dolphin, beacon (ring arcs), amber, flame, snow, sun (outposts, sun at its new size), then the sun at night and on the indiaman.

## Collection

54 catalogue items pass `npm run cosmetics -- check`: 8 sail colours, 9 patterns, 12 logos, 4 hull trims, 8 flags, 4 wakes, 8 figureheads. Figureheads are one per ring arc (mallet, wheat sheaf, dolphin, beacon) and one per sea outpost (amber, flame, snow crystal, sun); the names were already in the catalogue, so no new storyteller names were needed. All are earned, the rest free; no coin prices. The mount slot is the stem only, so there is no other decorative attachment category.

## Checks added

- `shipLookProblems` now refuses a ship file whose `figureheadMount.size` is not `rules.json › figurehead.share` times its hull length (2 % rounding). It runs in `npm run check` and `tests/boat-look.test.ts`.
- `tests/boat-combos.test.ts`: every class (10 files) builds all 27 upgrade mixes dressed (colour, pattern, logo, hull trim, figurehead) at all four damage states and disposes; a figurehead or logo adds triangles within `rules.json › maxTriangles` and never a draw call; "none" draws nothing.

## Budgets (max upgrades, node count of the built model)

| Class | Bare triangles | Meshes (draw calls) | Largest figurehead adds | Fully dressed |
|---|---|---|---|---|
| sloop | 743 | 6 | 56 | 797 |
| cutter | 827 | 7 | 56 | 881 |
| schooner | 1071 | 9 | 56 | 1125 |
| clipper | 1359 | 11 | 56 | 1413 |
| hoy | 999 | 6 | 56 | 1053 |
| fluyt | 1699 | 11 | 56 | 1753 |
| indiaman | 2167 | 12 | 56 | 2221 |
| tern, pilot, yawl | 771 to 961 | 6 to 8 | 56 | +54 |

A look never adds a mesh: the figurehead, logo and pattern merge into the hull and sail meshes. Preview disposal is covered by `tests/boatLooks.test.ts`. Browser `?bench` in the software renderer says nothing about devices, so device runs stay on #377.

## Art notes

- The sun figurehead (a ring with spokes) read like a wheel hanging at the bow: item size 1 to 0.75, so it is smaller than its siblings.
- At night the carvings are dim but keep their silhouette against the water.

## Acceptance

`npm run balance` passes on all three levels (no simulation code or data changed). The Free Sailing storage-isolation check waits on #300.
