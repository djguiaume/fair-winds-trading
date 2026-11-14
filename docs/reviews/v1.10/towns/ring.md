# v1.10 villages: the ring towns (#528 ring, #544)

The ring towns redone as villages (art bible §12, decisions 0306 and 0307). `npm run island -- audit` shows 0 fails and 0 warnings on all 16 towns, and the village rules now fail as errors (`grading.village`). Every change is a `npm run island` step. No island, port, pier, quest place or signature building moved; no town level changed.

Each sheet: before left, after right; top row the sailing camera, bottom row the follow cam from the pose the audit prints. Town at level 4, desktop, High.

| Town | Sheet | Feeling asked (§12 table) | What changed |
|---|---|---|---|
| Calda | [sheet](calda.jpg) | Working harbour on a slope, tight core round the slipway | The three-street grid is gone. Lanes fan out from the quay head; a new low terrace east of the bay carries a second group of cabins; two woodcutters' cabins stand up in the wood. A boat shed and planks by the slipway, wood sheds and fences where the village thins. Lamps 31 to 16. |
| Saltmere | [sheet](saltmere.jpg) | Fishing village along a bay: a curved quay lane, clusters behind it | One quay lane curves round the bay, with short lanes to the kirk, the smokehouses and the east lobe. Houses nearest the quay are smaller than the outer ones. The racks and crates of the net green stand loose, not in ranks. |
| Westholm | [sheet](westholm.jpg) | Farming-and-mill village: a green, lanes fanning out | Farmhouses round an open green; lanes leave it for the mills, the granary, the cove and the east pier. One field moved so no field lies between a house and its water. |
| Stonehaven | [sheet](stonehaven.jpg) | Stone town, the densest, round a market square | A market hall and a small square at the pier head; one winding main street under the cliff to the stairs, a wharf lane past the crane, a quay lane east. Eight houses stand loose round the keep, with field walls. Crane, quarry and stone stacks untouched. |
| Abbey Head | [sheet](abbey-head.jpg) | Cottages tucked below the abbey at odd angles | The cottages turn to their own angles and no longer stand in two straight files. |
| Watchman Key | [sheet](watchman-key.jpg) | Hamlet under the light (not in the table) | Same: each cottage has its own angle. |

Skerry keeps its home plots (they are quest places, and it was no grid). Lantern Rock and Teeth Rock have no houses.

## Not done

- **Westholm's millpond** (asked in the §12 table): a pond small enough to fit by the green draws as a patch of sand, a larger one takes two houses' ground. It needs its own plan.

## Trees (#544)

Ring firs stood about three houses tall. `forests.json`: pine scale 0.8-1.35 → 0.55-0.95, broadleaf 0.8-1.3 → 0.7-1.1 (the far-sea part did the snow firs and the racks).

## Budget and tests

- Ring mesh at the phones' far level: 21,587 triangles, limit raised 21,500 → 21,700 (decision 0307: Calda's terrace is new ground, Westholm's lanes are longer). Per island all inside 8,500: Calda 8,275, Saltmere 8,301, Westholm 6,051, Stonehaven 5,161.
- `tests/island-layout.test.ts`: Calda keeps 15 upland trees or more (was 20); Saltmere may keep its ten trees as it grows. Level 1 of each town is still one cluster by the harbour.

## Re-create

`npm run island -- audit <id>` prints the follow-cam line. Top shots: `npm run shots -- --look x,y --zoom 1.4 --town <port>:4 --quality high`.
