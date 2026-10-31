# v1.3 "Waves you can see" — plan

Scope and parts: [brief.md](brief.md). Wave model and its contract: [ADR 0245](../decisions/0245-shared-wave-model-and-cpugpu-contract.md). Coast calm, sheets and foam: [ADR 0248](../decisions/0248-coast-calms-the-waves-by-depth-shelter-and-berths.md). Controls and defaults: [ADR 0250](../decisions/0250-waves-on-by-default-from-medium-up-with-ocean-comfort-contro.md); benchmarks [reviews/waves-v13](../reviews/waves-v13/README.md); release notes draft [release-notes.md](release-notes.md).

## Phases (the wave chain)

| Phase | Issue | Builds on the model | Estimate |
| --- | --- | --- | --- |
| 1 | #280 | Sea state, Gerstner field, CPU/GPU contract, `?waves=v2` prototype | done in the PR (prototype gate) |
| 2 | #281 | Depth and shelter multipliers on both sides, shore calm, coastal foam, #378 slopes | 2-3 sessions |
| 3 | #282 | Scalable grid (closes Low's chop gap), per-pixel normals, ripples, storm look | 3-4 sessions |
| 4 | #286 | Controls, device runs, regression; the waves become the default from Medium up, Settings › Waves ([ADR 0250](../decisions/0250-waves-on-by-default-from-medium-up-with-ocean-comfort-contro.md)) | 2 sessions |

## Acceptance budgets

- Wave CPU (sea state, field, every height lookup): ≤ 0.3 ms/frame desktop, ≤ 1.5 ms old tablet.
- No extra draw calls for the waves; Low keeps ADR 0240's pixel cap and 30 fps on the old tablet.
- Contract tolerances of ADR 0245 hold on every quality level (tests).
- Boats (v1.3.1) read only `waveHeightAt` and `waveNormalAt`.
