> Historical review of the initial art pass. For the final integration with the current native ship models, current budgets, fresh captures and the passing 504-test suite, see [final integration verification](../art/game-models/merge-validation/README.md).

# Boat fleet review — 22 October 2026

**Follow-up:** The low fluyt and Indiaman sterns described in this first pass were subsequently replaced with restored raised quarterdecks and higher rear rigs. See the [current stern restoration, night-window captures and fleet recheck](../art/game-models/raised-sterns/README.md).

Five boat-specific agents refined the hoy, fluyt, Indiaman, schooner and clipper. Sloop and cutter remain the reference. Changes preserve the storybook palette, class dimensions, sail plans, three upgrade tracks and wake envelopes. Fittings merge into the existing hull mesh rather than adding materials or draw calls.

## Visual recheck

The actual model factory was captured at 1280 × 720 in stock, fully upgraded and opposite-tack stern views for every boat. The five modified boats were also captured furled on Low. Two fleet sheets complete 28 captures. No browser errors were recorded. [Captures and measured budgets](../art/game-models/fleet-review/results.json) are in `docs/art/game-models/fleet-review/`. The [capture script](../art/game-models/fleet-review/capture.cjs) expects the local development server on port 5173, Playwright, and optionally `PLAYWRIGHT_PATH` and `CHROMIUM_PATH`.

| Boat | Recheck | Fully upgraded boat triangles / meshes |
|---|---|---:|
| Sloop | Still the compact, rounded reference. Its hatch, deck edge and steering hardware establish the shared level of finish. | 743 / 6 |
| Cutter | Retains its longer, finer hull and multiple headsails. Consistent with the sloop. | 827 / 7 |
| Schooner | Low aft companionway fills the empty working deck without competing with the two-mast silhouette. | 1,071 / 9 |
| Clipper | Small stern coachhouse and paired bow rails support its charcoal/gold premium identity without crowding the three masts. | 1,359 / 11 |
| Hoy | Broad, full-bellied sections, raised gunwale, substantial hatch, bitts and tiller now match the refined construction standard. | 771 / 5 |
| Fluyt | Deep pear-shaped sections and pinched stern distinguish the working merchant hull. Low tapered cabin, hatch and windlass replace the box-like castle. | 1,175 / 17 |
| Indiaman | Fuller transom, stepped quarterdeck and five-window stern gallery distinguish it from the fluyt; foredeck hatch and windlass add purpose. | 1,431 / 17 |

All seven fit the warm wood / cream canvas / flat-shaded storybook theme. Detail now scales reasonably with ship size and tier. The haulers no longer have bare hull edges and generic unworked decks. The Indiaman's distinction is strongest from the stern; fluyt and Indiaman still share a similar three-mast sail plan, so their silhouettes remain related at long range. No rig redesign was made.

The 28 inspection captures are software-WebGL evidence of appearance and scene construction, not measurements of older-tablet frame rate. Fully upgraded mesh counts are unchanged by the fittings. Hull colour bands remain a level-2 upgrade and copper remains a level-3 upgrade.

Ketch, brig and frigate are still planned Phase-5 warships, not missing models within the currently implemented seven-boat fleet.

## Verification

Existing sloop, cutter, schooner and clipper rig tests cover sail attachment and independent upgrades. The hauler integration tests exercise all 27 hull/hold/sails combinations for each of the three haulers, finite geometry and transformed poses, cargo counts, wake dimensions and Low rigging visibility. Geometry budgets for the schooner and clipper increased only by their authored 84 and 168 detail triangles.

TypeScript compilation, ESLint, production build and formatting for all changed source/test files pass. The serial full suite passed 330 of 331 tests; the untouched strategic-map route audit exceeded its explicit 30-second limit (also 34 seconds in its isolated rerun). Earlier concurrent runs were interrupted after resource contention caused widespread timeouts. The whole-repository formatting check reports existing issues across untouched files; those were left outside this boat-art change.
