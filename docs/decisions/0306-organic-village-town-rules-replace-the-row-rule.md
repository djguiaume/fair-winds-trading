# 0306. Organic village town rules replace the row rule

**Status:** Proposed (2026-11-14).

## Context

v1.9's town rules (decision 0301) turned "believable" into spacing numbers: one row within 15°, regular 0.4W to 1.5W gaps, every house within 2W of a lane, a waterfront lane 1W to 3W from the water. The builder met them exactly and every town read as a grid (Guillaume, 2026-11-12, #528). The art director rewrote art bible §12 for v1.10 (PR #586): a village has a centre, curving lanes, houses at their own angles, mixed sizes and blurred edges; a check keeps only what can break (slope, shore, merging, fire, piers, fields, woods, harbour as centre). Issue #528 also asks the check to reject grids, and #544 asks every town to be judged from the follow cam too.

## Decision

- **Dropped** from `src/data/town-rules.json` and the checks: `houses.rowTurn` (the `town-row` rule), the even-gap maximum (`styles.*.spacing` is now one number, the merge gap), `styles.*.laneReach` and the "no lanes" warning, `lanes.shore` (the waterfront lane), and facing as a pass/fail: `houses.facing` is one angle (60°) past which a house turned away from its lane, quay or water warns.
- **New `village` section, `town-grid` and `town-centre` checks** (`src/sim/townVillageChecks.ts`), for towns of `village.houses` (8) or more; hamlets are not judged:
  - *Spread:* the houses' fronts folded to 0..90° (a house turned a right angle stands on the same square grid), the range that holds the middle 80%. Under 30° warns, under 20° fails. The v1.8 ring towns measured 47° to 78°, v1.9's 5° to 15°.
  - *Rows:* a straight run of houses turned alike (10°), middles within 0.35W of the line, each next house within 2W, each step within 25% of the last: 4 warns, 6 fails. Each row is told once.
  - *Centre:* the civic building nearest the harbour (within `harbour.civic`), else the harbour. At least 3 lanes reach it (within 2W) from sides 45° apart. A warning.
- **Lanes** (`town-lanes`, warnings): no straight run over 8W (about six houses; points within 0.25W of the chord), no two lanes within 12° of each other, 5W apart, for over 4W.
- **Only rows and spread fail.** Everything else that is about the look warns: the sheets judge it (art bible §12, "Judge it as a drawing").
- **A new `grading.village`** says what a failed village rule counts as: `"warning"` while the v1.10 town parts redo the towns, then `"error"` (the last town part flips it). `grading.fails` stays `"error"`, so slopes, the sea and lava still block `npm run check`.
- **Follow-cam pose** (#544): `npm run island -- audit` prints per town the `npm run shots` options for a follow-cam shot: the boat `review.followOffshore` (30) world units past the shore, straight out from the centre through the harbour, bow on to the centre, waiting `review.followWait` (7000 ms) for the port's name card to fade. `--json` has it as `follow`. Shared code: `src/sim/townPose.ts`.
- The editors' Town rules page and `npm run towns` edit the new sections through the same `doc.ts`.

## Consequences

- Audit on 2026-11-14 (no island changed): 7 fails, 52 warnings over 8 villages. Calda, Saltmere, Westholm, Stonehaven (`south-cay`) and Fogwatch fail; Emberhold, Rimewick and Sunreach warn. Hamlets (under 8 houses) are clean. Table and per-town follow-cam shots: `docs/reviews/v1.10/rules/`.
- The town parts of v1.10 work from that audit; a town is done when it has no fail and its sheet passes. The last one sets `grading.village` to `"error"`.
- Calibrated on v1.8 against v1.9 layouts only; if a real village drawn by eye fails, tune the number on the Town rules page, not the town.
