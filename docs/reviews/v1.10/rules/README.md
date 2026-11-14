# v1.10 town rules: villages, not grids (#528 rules part, decision 0306)

The rules part of [#528](https://github.com/djguiaume/fair-winds-trading/issues/528). No island changed: these are the towns as v1.9 left them, judged by the new rules. The town parts start from here.

## What changed

- **Out:** the row rule (`houses.rowTurn`), the even-gap maximum, "every house within 2W of a lane", the waterfront lane at 1W to 3W, facing as a fail. Facing now warns only past 60°.
- **In** (`village` section of `src/data/town-rules.json`, towns of 8 houses or more): the fronts' spread folded to one square grid (under 30° warns, under 20° fails); straight rows of alike houses at even gaps (4 warn, 6 fail); 3 lanes reaching the centre from different sides; no lane straight for over 8W; no two lanes side by side. Only spread and rows fail.
- **Grid fails count as warnings** (`grading.village`) until the last town part sets it to `"error"`; the hard rules (`grading.fails`) stay errors.
- **Follow-cam pose:** `npm run island -- audit [id]` prints each town's `npm run shots` options (`follow` in `--json`), the boat out past the shore, bow on to the centre.

Calibration: v1.8's ring towns spread 47° to 78°; v1.9's 5° to 15°.

## Audit, 2026-11-14 (v1.9 rules: 0 fail, 0 warn everywhere)

| Island | Style | Houses | W | Fail | Warn | slope | ground | shore | facing | spacing | grid | centre | lanes | piers | harbour | fields | woods | hazard |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Abbey Head | timber | 7 | 3.0 | 0 | 0 | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Amber Strand | strand | 5 | 7.0 | 0 | 0 | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Port Calda | timber | 32 | 4.3 | 1 | 8 | · | · | · | · | · | 1✗ 3! | · | 5! | · | · | · | · | · |
| Cinder Isle | volcano | 3 | 2.9 | 0 | 0 | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Emberhold | volcano | 23 | 4.3 | 0 | 4 | · | · | · | · | · | 2! | 1! | 1! | · | · | · | · | · |
| Fogwatch | fog | 19 | 5.4 | 1 | 2 | · | · | · | · | · | 1✗ | 1! | 1! | · | · | · | · | · |
| Palm Key | tropic | 6 | 4.3 | 0 | 0 | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Rimewick | ice | 15 | 3.9 | 0 | 3 | · | · | · | · | · | 1! | · | 2! | · | · | · | · | · |
| Saltmere | fish | 32 | 2.7 | 1 | 13 | · | · | · | · | · | 1✗ 5! | 1! | 7! | · | · | · | · | · |
| Skerry | timber | 4 | 3.5 | 0 | 0 | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Snowberry Isle | ice | 7 | 3.6 | 0 | 0 | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Stonehaven | stone | 29 | 3.3 | 3 | 4 | · | · | · | · | · | 3✗ 1! | · | 3! | · | · | · | · | · |
| Sunreach | tropic | 21 | 5.1 | 0 | 2 | · | · | · | · | · | · | 1! | 1! | · | · | · | · | · |
| Sunreach South Arm | tropic | 3 | 4.8 | 0 | 0 | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Watchman Key | timber | 5 | 3.4 | 0 | 0 | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Westholm | grain | 32 | 4.5 | 1 | 16 | · | · | · | · | · | 1✗ 11! | 1! | 4! | · | · | · | · | · |

## Pictures

- [village-check-plans.jpg](village-check-plans.jpg): the eight villages' plans (`audit --chart`), every finding marked.
- [follow-cam-before.jpg](follow-cam-before.jpg): every town from its audit follow-cam pose, before the town parts. Cinder Isle stands only after its quest (`--quest outpost-west:settler`); Sunreach South Arm's three houses hide behind the headland from the harbour side.
