# v1.3.1 "Boats that ride them" — brief

Milestone: [v1.3.1 Boats that ride them](https://github.com/djguiaume/fair-winds-trading/milestone/5), tracker [#356](https://github.com/djguiaume/fair-winds-trading/issues/356). The v1.3 waves are on from Medium up; this release makes the boats and the coast answer them, and clears the leftovers. Each part is one issue ("Fixes #N"). Models: Opus (high) for engine and rendering, Sonnet otherwise. Wave model and tuning: [boatgame-wave-model notes in ADRs 0245-0250](../decisions/); boats read only `waveHeightAt` and `waveNormalAt`.

| # | Part | Effort | Visual | Model | Wave |
| --- | --- | --- | --- | --- | --- |
| #283 | Boat heave, pitch and roll from shared wave samples | high | yes | Opus high | 1 |
| #397 | Waves wash up the beach; includes the art director's surf fix (thin breaking lines parallel to shore, not puffs) | med-high | yes | Opus high | 1 |
| #396 | Faster start: menu or loading view within about 1 s on the phone, start time measured before and after | med | yes | Sonnet | 1 |
| #284 | Bounded wave effects on sailing and difficulty (needs #283; balance on all three levels, any rebalance needs Guillaume's OK) | med-high | yes | Opus high | 2 |
| #352 | Bake a sculpted coast back into the island outline | med-high | yes | Sonnet (Opus if the tracer fights back) | 2 |
| #372 | Leftovers from the v1.2 polish (Rimewick Low summit spot, Amber Strand rock pools) | low | yes | Sonnet | 2, any slot |

**Release shape.** That is 3 high-effort parts, one over the "more than 2 = split" rule. The waves are chosen so they can be kept apart: #283 and #397 touch different files (boats vs shore shader), #284 must follow #283. Guillaume to confirm this exception, or move #352 / #372 to v1.4.

**Pause rule (as in v1.3).** Wave 1 first. Guillaume checks token usage before wave 2 starts; wave 2 only on his OK.

**Carried in, not separate issues.** Art handover: reef foam width should vary with the swell (take with #397 if cheap); Ultra/Xbox re-test and #377 device runs are Guillaume's, not blocking. No bugs are open besides these (`bug` label: none).

**Role questions (one message each, after the fresh threads exist).** Art director: look of the boat motion (how much roll is cozy, not seasick) for #283, surf lines for #397, loading view style for #396. Storyteller: none; any loading-screen text needs EN and FR from them only if it is more than the game title.
