# v1.9 brief: Believable towns

Guillaume, 2026-11-11: the believable-towns pass (#503) is the headline, plus the flaky harbour test (#509), the `builder.ts` split (#492), the lean-to roof tone and the moon halo. **Goal: Saltline-level graphics, performance and smoothness, inside our art bible** (decision 0165). Best model per part: Opus high for engine, performance and refactors, Fable 5.2 for look work, Sonnet for small parts.

Every part: data driven (decision 0093), CLI plus editor for any authoring change (decision 0153), triangles and draw calls inside `budget.json`, an ADR when it decides something. Device round #377 has no results yet, so there are no device fixes to fold in; the smooth-frames part ends by asking Guillaume for one phone `?bench`.

| Order | Issue | Goal | Files | Done when | Effort | Visual | Model |
|---|---|---|---|---|---|---|---|
| 1 | #513 | **Town rules and check**: the art director's town layout rules in the art bible, a check in the island builder and `npm run island`, an audit of every town island | `islandChecks.ts`, `tools/fw/island.ts`, island builder, art bible, `docs/reviews/v1.9/towns/` | Rules with numbers in data, shared check with tests, audit table with before charts, no island changed yet, ADR | medium-high | no | Opus high |
| 2 | #514 | **Ring towns believable**: Abbey Head, Calda, Lantern Rock, Saltmere, Skerry, South Cay, Teeth Rock, Watchman Key, Westholm | `src/data/islands/*.json` through `npm run island` | No town warning, quests still pass, within budget, before/after per island | high | yes | Fable 5.2 |
| 3 | #515 | **Far-sea towns believable**: Rimewick, Snowberry Isle, Amber Strand, Fogwatch, Palm Key, Sunreach, Sunreach South, Cinder Isle, Emberhold, Organ Pipes, Spark Rock | same | same | high | yes | Fable 5.2 |
| 4 | #516 | **Smooth frames**: no hitch after warm-up (shader warm-up, island and town builds spread over frames, no stall on port entry or quality change) | render setup, build path, `benchmark.json`, `budget.json` | `?bench` 0 hitches, at most 2 slow frames per pass; townGrowth frames under 2x; hitch budget in CI; ADR | high | no | Opus high |
| 5 | #517 | **Fixes**: #509 timer, lean-to tone, chimney caps on dark roofs, tighter moon halo | `tradePanel.ts`, prop recipes or `palette.json`, `graphics.json` | All four ticked, tests reliable, before/after shots | low | yes | Sonnet |
| 6 | #492 | **Split `src/editor/quest/builder.ts`** (1,900 lines) by responsibility, no behaviour change | `src/editor/quest/` | No file over ~400 lines, saved quests unchanged, docs line | high, mechanical | no | Opus high |

**Order:** wave 1 runs #513, #516, #517 and #492 together (no shared files). #514 and #515 start when #513 merges and run side by side (different island files).

**Size:** six parts, over our five-part rule. #514 and #515 are one pass split by sea; #492 is kept because Guillaume asked for it and touches only the quest editor. Guillaume kept all six parts (2026-11-12).

**Review:** one combined visual round for #514, #515, #517: before/after JPGs up to 1280 px in `docs/reviews/v1.9/`, to the art director and Guillaume together, desktop only (no layout change).

**Roles:** art director (v1.9) asked once for the town rules and the fix tones. Storyteller (v1.9) asked once which island places quests name, so layouts don't move them.

**OK:** Guillaume OK'd this brief on 2026-11-12 ("Keep all parts. Merging like 1.8."), milestone 11 "v1.9 Believable towns".

**Merge rule (as v1.8):** every thread auto-merges its own PR (CI green, current with main, no open question), visual ones too, with no `visual-ok` wait. Guillaume validates once at the end of the release from the combined sheets, so every visual PR leaves its before/after JPGs in `docs/reviews/v1.9/`. The art director still reviews.
