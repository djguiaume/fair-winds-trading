# 0303. Believable ring towns: streets, rows round the harbour, lanes on the ground

**Status:** Accepted (2026-11-12).

## Context

The town rules of decision [0301](0301-town-layout-rules-and-the-believable-town-check.md) found 25 fails and 150 warnings on the seven ring towns (issue #514): houses on quarry edges and slopes, rows turned across their lanes, farmhouses touching, fields in front of the houses, lanes that end in the open, side piers that start inland. Fixing them asked for more than nudges, and showed three gaps: the island tool could not move what stands, two rules were stricter than the art bible means, and the new look's ground buried the lanes.

## Decision

- **Every ring town passes the rules with no finding.** The recipe: streets on flat ground along the shore, houses in rows at a lane, fronts to it, the lowest town levels nearest the harbour.
  - Calda: three streets along the bay and one up from the pier. Saltmere: two streets and a waterfront lane, the harbour office and warehouse on the west quay. Westholm: three streets, the church and bakery by the harbour, the north fields moved to the east and west blocks (a field never lies between a house and its water).
  - Stonehaven: the plateau's cliff is pulled back about 0.2 radius for a harbour quarter of three rows under it; seven houses stay by the keep; new stairs climb the face. The crane, the blocks and the quarry keep their places.
  - Abbey Head, Skerry and Watchman Key get a shore lane or paths and rows.
- **`move` step** (`src/editor/island/moveStep.ts`, `npm run island -- <id> move prop|pier|lane|spot <index>`): moves or turns what is there, in place, so a town is rearranged without changing the order of its homes. The audit prints `[prop n]`, and `--chart dir --as after` names the plans.
- **Rules refined** (`town-rules.json`, art bible §12): `harbour.mainPort` 12, the 8° harbour core counts only for towns of 12 houses or more (a hamlet keeps its style's 12°); a row is two houses side by side for both of them, so a corner is no row.
- **Lanes lie on the ground of the new look** (`townProps.ts`): each piece takes the ground's height at its ends, 0.05 above it.
- **Lane pieces go by length** (`townLanes.ts`): one piece per 0.025 radius, 8 to 110 a lane, where every lane had 110. A short lane costs its length.

## Consequences

- The ring draws about 300 more triangles at the phones' levels (lanes for the two hamlets that had none, trees that grow back round tighter towns): the ring mesh test's limit goes from 21,000 to 21,500. Per island all stay inside 8,500.
- Lanes show on every town in the new look, the far seas too. The golden island hashes changed for every island with a lane.
- Tests that leaned on Calda's or Stonehaven's old faults now make their own (a turned cabin, a cabin in the sea).
- `grading.fails` stays `"warning"` until the far-sea towns (#515) pass too.
- Before and after plans and shots: `docs/reviews/v1.9/towns/`.
