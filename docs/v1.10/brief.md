# v1.10 brief: Villages

Guillaume, 2026-11-13: release order of the whole-game review accepted (#568). Headline is #528: the v1.9 town pass made grids, every town is redone as an organic old-European village. Beside it the camera bugs found in the review, the dark windows and the missing Ultra moon (first), and the code-health discard #563 (approved). Milestone 12 "v1.10 Villages".

Every part: data driven (0093), CLI plus editor for authoring changes (0153), inside `budget.json`, an ADR when it decides something, both cameras judged (top and follow, #544).

| Order | Issues | Goal | Files | Done when | Effort | Visual | Model |
|---|---|---|---|---|---|---|---|
| 1 | #528 (rules), part of #544 | **Organic town rules**: art director's organic-village wording in art bible §12 with 2-3 real references agreed with Guillaume; replace the row rule in `town-rules.json` and `townChecks.ts` by anti-grid rules (varied angles and spacing, curving lanes, a centre); audit prints a follow-cam pose | `town-rules.json`, `src/sim/townChecks.ts`, `tools/fw/island.ts`, art bible | Check rejects grids, still rejects slopes, sea, blocked quays; tests; ADR; no island changed yet | high | no (references only) | Opus high |
| 2 | #528 ring, #544 | **Ring towns** (Calda, Saltmere, Westholm, Stonehaven, Abbey Head, Lantern Rock, Skerry, South Cay, Teeth Rock, Watchman Key) | `src/data/islands/*.json` via `npm run island`, props, `forests.json` | Audit clean, quests pass, budget ok, before/after per town in both cameras, art director passed | high | yes | Fable 5.2 |
| 3 | #528 far seas, #544 | **Far-sea towns** (Rimewick, Snowberry, Amber Strand, Fogwatch, Palm Key, Sunreach and South, Cinder, Emberhold, Organ Pipes, Spark Rock), drying racks, tree scale | same | same | high | yes | Fable 5.2 |
| 4 | #526, #543 | **Night**: Ultra moon disc, lamp halos (#525 dark windows is fixed inside v1.9 first; part 4 starts after that merges) | `skyDome.ts`, Ultra path, `lanterns.ts`, `ultraBloom.ts` | Moon on Ultra as on High; no halo clipped to white, both views | medium | yes | Opus high |
| 5 | #539, #540, #541, #542 | **Follow-cam look**: wake chequer, wind streak bars, lighthouse beam slab, Ultra mirror | `wake.ts`, `windStreaks.ts`, `lighthouseBeams.ts`, `seaMirror.ts` | Day and night follow-cam shots clean; draw calls and Ultra memory inside budget | high | yes | Opus high |
| 6 | #538 | **Arrival card** no longer covers the port | `ui/moments/arrival.ts`, `banner.ts` | Both views, desktop and phone landscape | low | yes | Sonnet |
| 7 | #563 | **Discard** classic look `?look=v1`, Kids mode leftovers (not the title picture, #531 not shipped) | see issue | `grep` clean, tests, check, budget pass, ADR | medium | no | Sonnet |

**Order and waves:** part 1 gates parts 2 and 3 (they run side by side after it merges). Wave 1 = parts 1, 4, 5, 6 and 7 (five threads, files do not overlap; part 7 touches `beaconLights.ts` and `lighthouseBeams.ts` like parts 4 and 5, so it merges last or rebases).

**Size:** seven parts, over the five-part rule, but parts 2 and 3 are one pass split by sea and 6 and 7 are small. Needs Guillaume's say.

**Not in v1.10:** #569 (PRs leave issues open) and #548 (Low upscale) wait for v1.11 or v1.12 unless Guillaume pulls them in.

**Roles:** art director (v1.10) asked once: organic rules, references, bugs' look fixes. Storyteller (v1.10) asked once: quest places that must stay when towns are redone.

**Review:** one combined visual round for parts 2 to 6, sheets in `docs/reviews/v1.10/`, to the art director and Guillaume together.
