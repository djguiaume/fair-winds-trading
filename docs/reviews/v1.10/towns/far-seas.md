# v1.10 villages: the far-sea towns (#528 far seas, #544)

The nine far-sea towns redone as villages (art bible §12, decision 0306). `npm run island -- audit` shows 0 fails and 0 warnings on each, hard rules and village rules alike. Every change is a `npm run island` step. No island, port, pier, quest place or signature building moved; no town level changed. Organ Pipes and Spark Rock have no houses (a lighthouse each), so nothing to lay out there.

Each sheet: before left, after right; top row the sailing camera, bottom row the follow cam from the pose the audit prints. Town at level 4, desktop, High.

| Town | Sheet | Feeling asked (§12 table) | What changed |
|---|---|---|---|
| Rimewick | [sheet](rimewick.jpg) | Compact, packed against the cold | Three straight rows gone. A small square at the quay head between church and jam house; a shore lane west, a lane up the stream over both footbridges and round the church, a lane east, a dead-end spur. Houses packed along them at their own angles. Hand-placed firs lowered. |
| Snowberry Isle | [sheet](snowberry-isle.jpg) | Seasonal camp round the moor | Houses turned off the two shared angles, the west pair no longer a row. Firs lowered. Station, glasshouse and moor untouched. |
| Fogwatch | [sheet](fogwatch.jpg) | Scattered crofts, a cluster at the quay | The four rows gone. Seven houses gather round the quay and Elias's workshop; a cart track winds north with two side tracks; crofts stand alone along them, two more out on the east moor behind dry-stone walls. Five rowans removed (almost no trees), three walls added. |
| Amber Strand | [sheet](amber-strand.jpg) | Outpost on pale dune | Huts turned to their own angles; the drying frames are smaller. |
| Emberhold | [sheet](emberhold.jpg) | Sparse, hunkered groups | Six small groups with black ground between: glassworks yard, quay, east strand, and three on the upper terrace. Lanes meet at the harbour office, bend round the glassworks and the rim. A fish rack by the glassworks, a steam vent on the west shelf. Houses stay 3W from lava. About 7,050 triangles (budget 8,500). |
| Cinder Isle | [sheet](cinder-isle.jpg) | Fresh settlement round a warm vent | The row of three now stands round a new small vent, with a bent shore lane, a spur to the vent, crates and a tin shed. Shown during its founding quest. |
| Sunreach | [sheet](sunreach.jpg) | Airy, round the lagoon | The two strings broken into a quay group, an east and a west beach hamlet and a terrace group round the market hall; both lanes wind; steps link the tea house to the terrace. The ledges are narrow, so it still follows the crescent. |
| Sunreach South Arm | [sheet](sunreach-south.jpg) | Three huts | One hut turned so the pair is not a row. Hidden behind the headland from the harbour pose, as before. |
| Palm Key | [sheet](palm-key.jpg) | Beach hamlet on one shore path | Layout kept (it was not a grid); two boats on the sand and a net rack added. |

## Props (#544)

- **Drying racks** read as blank boards bigger than a house front. `rack`, `drying-rack` and `net-rack` are now open frames: fish hang one by one on two rails, nets hang as separate strips with floats. Lower and thinner; Amber Strand's and Fogwatch's are also smaller. Saltmere's racks change with the recipe.
- **Tree scale.** Snow firs stood two to three houses tall: `forests.json` snow-pine scale 0.75-1.25 → 0.55-0.95, hand-placed firs at Rimewick and Snowberry 1.5/1.4 → 1.1. Birch, palm and jungle were already about one house. Pine and broadleaf are the ring's kinds and change which trees stand by the ring houses, so they go with the ring towns part (asked: pine 0.55-0.95, broadleaf 0.7-1.1).
- **Art bible rule 4** now names both cameras.

## Tools

- `npm run island -- audit <id> --chart dir --grid`: the plan ruled every 0.2 with file coordinates, prop indexes and rivers.
- `npm run island -- audit <id> --ground x0,x1,z0,z1 [--step 0.02]`: a text map of flat ground, slopes, water and lava, to place houses without a picture.

## Re-create

`npm run island -- audit <id>` prints the follow-cam line. Top shots: `npm run shots -- --look x,y --zoom 1.4 --town <id>:4 --quality high` (zoom 1 on the small islands). Cinder Isle adds `--quest outpost-west:settler`.
