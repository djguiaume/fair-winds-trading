# v1.3 "Waves you can see" — brief

Milestone: [v1.3 Waves you can see](https://github.com/djguiaume/fair-winds-trading/milestone/3), tracker [#279](https://github.com/djguiaume/fair-winds-trading/issues/279). Boats that ride the waves (#283, #284) are v1.3.1 ([milestone 5](https://github.com/djguiaume/fair-winds-trading/milestone/5)), so this release is the sea itself: model, coast, look, controls, budget. Each part is one issue ("Fixes #N"). Models follow the project rule: Opus (high effort) for engine and rendering, Sonnet for tooling and data.

| # | Part | Effort | Visual | Model | Wave |
| --- | --- | --- | --- | --- | --- |
| #374 | Ultra blanks the sea on the Xbox (water shader bug) | med | yes | Opus high | 1 |
| #280 | Shared wind/storm wave model and prototype (renderer independent, CPU/GPU contract, ADR) | high | yes | Opus high | 1 |
| #377 | Per-pass GPU cost switches and `&quality=` URL parameter, to budget the waves | med | no | Sonnet | 1 |
| #380 | Low runs at 28 fps on a weak tablet: lower Low's pixel cap | low | no | Sonnet | 1 |
| #281 | Depth-aware waves, coastal foam, harbour shelter; includes #378 (water does not follow slopes, "waterfall" through the ground) | high | yes | Opus high | 2 (after #280) |
| #282 | Scalable GPU waves, normals, foam, storm visuals | high | yes | Opus high | 3 (after #280, #281, #374) |
| #286 | Ocean controls, performance, regression and release acceptance (waves only; boat items move to v1.3.1) | high | yes | Opus high | 4 (last) |
| #372 | Leftovers from the v1.2 look polish (Rimewick Low summit spot, Amber Strand rock pools) | low | yes | Sonnet | any slot |

Conditional: #285 (Ultra reflections) stays an idea after #282; it does not block the release.

**Release shape.** #280 to #282 to #286 is one dependency chain, so it cannot run in parallel. That is 4 high-effort parts, which breaks the "more than 2 high-effort = split" rule; the split already happened (boats went to v1.3.1), and the chain cannot be split further. Guillaume to confirm this exception.

**Proposed to leave out of v1.3** (in the milestone today, not about waves): #319 Style E text audit, #315 quest engine ship reward, #352 bake sculpted coast into the outline. #352 touches the coast data that #281 reads, so it should land before or after, not during. #255 is closed (no known bugs); `bug` issues open today: #374, #378 (both folded in).

**Needs Guillaume's devices:** #377 readouts (Surface, phone, Xbox), #380 round 3 on the weak tablet, #286 acceptance runs.

Role questions (one message each): art director for #280 (calm/wind/storm comparisons) then #281/#282 (water colour, foam, storm look); storyteller has none for v1.3.

Rules carried from v1.2: balance and timings on all three levels if sailing changes (none planned here); every budget raise is argued; storms stay switchable in Settings; Guillaume sees every visual before merge; at most 3 to 5 threads at once.
