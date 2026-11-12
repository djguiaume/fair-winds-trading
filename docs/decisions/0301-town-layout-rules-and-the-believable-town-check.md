# 0301. Town layout rules and the believable-town check

**Status:** Accepted (2026-11-12).

## Context

v1.9 "Believable towns" (#503, brief `docs/v1.9/brief.md`) fixes the towns of about twenty islands. Done by eye, two threads would judge "believable" differently and nothing would stop a town drifting back. The art director (v1.9) wrote the town rules with first numbers (issue #513, project file `art-director/v1.9/answers.md`): flat ground, houses facing the water, a lane or the quay, lanes along the shore, fields and woods in their place, the harbour as the centre, with style exceptions. Part 1 turns them into a check; parts 2 and 3 (#514, #515) fix the islands against it.

## Decision

- **The rules are data** (decision 0093): `src/data/town-rules.json`, every number the check uses, by section (`houses`, `harbour`, `lanes`, `piers`, `fields`, `woods`, `types`) plus `styles`: the rules an island style changes (`default`, `tropic`, `ice`, `fog`, `volcano`). The art bible's §12 holds the art director's wording with each number's key.
- **W is measured, not typed:** the median house's footprint width across its front, from the models (`townPlan.ts`). Fish houses and beach houses differ by two to one, so a fixed world width would be wrong somewhere; the audit prints each town's W in world units.
- **One shared check** (decision 0153): `src/sim/townChecks.ts` (houses, harbour) and `townGroundChecks.ts` (lanes, piers, civic ground, fields, woods, fire hazards) over a `townPlan.ts` that reads the town at the top level with every quest done, the ground's slope from the new look's height field (a plane fitted inside the footprint) and the waterline from the island file's coast. `checkIsland` runs it, so the island builder's Checks tab, `npm run island` and `npm run check` all show the same `town-*` findings. The woods rule reads the forest the game plants, through a new `trees` on the check kit; the kit moved out of `towns.ts` into `islandCheckKit.ts`.
- **Graded warn and fail, both warnings for now:** `grading.fails` is `"warning"` until towns 2 and 3 are done, then `"error"`. No island file changes in this part.
- **Editable in both places** (decision 0153): the editors' Town rules page and `npm run towns` share `src/editor/townRules/doc.ts` (the generic fields page and CLI). `npm run island -- audit` lists every town (`--md` table, `--json`, `--chart dir` plans with the findings marked).
- **Judgement calls,** kept simple and said in the bible: houses have no door yet, so front and back face alike; the berth is the arrival pier's root on the shore; the arrival pier's root is the sim's, so only its squareness is checked; "main port core" is within 8W of the harbour on an island with one; "sheltered side" and "never hiding the town from the camera" stay by eye.

## Consequences

- The audit (`docs/reviews/v1.9/towns/README.md`, plans beside it): 16 towns, 57 fails and 231 warnings on 2026-11-12; facing (33 fails) and slopes (21) lead. Towns 2 and 3 work from it; a town is done when `npm run island -- audit <id>` is clean.
- `npm run check` lists the town warnings (about 290 more); its islands area takes about 4 s longer. The island builder's checks take a little longer too (they plant the forest once more), off the page thread.
- When the rules move from warnings to errors, every new or edited town must keep them; tuning a number is a data change on the Town rules page.
