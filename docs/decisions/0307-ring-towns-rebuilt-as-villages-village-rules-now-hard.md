# 0307. Ring towns rebuilt as villages; village rules now hard

**Status:** Accepted (2026-11-14).

## Context

v1.9 made the ring towns pass the hard town rules by laying them out as streets and rows, and Guillaume read them as grids (#528). Decision [0306](0306-organic-village-town-rules-replace-the-row-rule.md) replaced the row rule with village checks (front spread, rows, a centre lanes reach from three sides, bending lanes) and kept them as warnings until every town was redone. The far-sea towns went first (PR #594); this is the ring, the last part.

## Decision

- **Each ring town is rebuilt for its trade and ground** (art bible §12 table), every change a `npm run island` step; ports, piers, quest places and signature buildings stay where they were.
  - **Calda** (timber): lanes fan out from the quay head; a new low terrace east of the bay carries a second group; two woodcutters' cabins stand up in the wood; a boat shed, planks and wood sheds by the slipway. Lamps 31 to 16.
  - **Saltmere** (fish): one quay lane curves round the bay with short lanes off it to the kirk, the smokehouses and the east lobe. The houses nearest the quay are smaller than the outer ones (a fishing quarter). The racks on the net green stand loose, not in ranks.
  - **Westholm** (grain): farmhouses stand round an open green with lanes out to the mills, the granary, the cove and the east pier; the fields stay at the sides.
  - **Stonehaven** (stone): a market hall and a small square at the pier head; one winding main street under the cliff to the stairs, a wharf lane past the crane, a quay lane east; eight houses loose round the keep with field walls. No house stands on the quarry floor.
  - **Abbey Head, Watchman Key**: the cottages turn to their own angles. **Skerry** keeps its home plots (quest places). Lantern Rock and Teeth Rock have no houses.
- **Ring trees are lower** (#544): `forests.json` pine scale 0.8-1.35 to 0.55-0.95, broadleaf 0.8-1.3 to 0.7-1.1, so a fir is under two houses tall.
- **The village rules are hard**: `grading.village` is `"error"`, and `tests/island-files.test.ts` no longer lists `town-grid`, `town-centre` and `town-lanes` as known warnings. All 16 towns audit with no fail and no warning.

## Consequences

- **Ring mesh budget +200** (`tests/strategic-map.test.ts`, far level 21,500 to 21,700; it draws 21,587): Calda costs about 120 more (its terrace is new ground) and Westholm about 190; Saltmere and Stonehaven got cheaper. Per island all stay inside 8,500 (Calda 8,275, Saltmere 8,301 with the new open racks).
- **Westholm has no millpond yet.** The art bible asks for one; a pond small enough to fit between the green and the west fields draws as a patch of sand (its rim covers the water), and a larger one takes two houses' ground. It needs its own plan.
- Tests tied to the old layouts follow the villages (`tests/island-layout.test.ts`): Calda keeps 15 upland trees or more (was 20; the two cabins and their lane clear some), and bare Saltmere may keep its ten trees as it grows, since the village no longer spreads into them. Golden island hashes regenerated.
- The first three homes of each town still stand together by the harbour (level 1 is one cluster).
- Before and after sheets in both cameras: `docs/reviews/v1.10/towns/ring.md`.
