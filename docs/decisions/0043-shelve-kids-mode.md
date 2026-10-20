# 0043. Shelve Kids mode until a later rework

**Status:** Accepted (2026-10-20). Guillaume: "Let kid mode for way later. Just hide it for the moment and put it in the later roadmap."

## Context

Kids mode ([0022](0022-trading-ui-integration-and-tablet-budget.md)) was flagged as unplayable in the
2026-10-19 play-test, and the roadmap listed "Kids mode made playable" as a Phase 1 fix. Reworking it
properly (controls, text, pacing) is a large job, and it competes with the core trading loop and the
UI redesign, which matter more right now.

## Decision

- Kids mode is hidden from the game: the Captain/Kids switch in the harbour panel is no longer shown.
- A saved `kids` preference loads as Captain mode, so nobody gets stuck in it.
- The code stays (Kids market and shipyard views, wind words, French and English strings, tests),
  behind one flag, `KIDS_MODE_AVAILABLE` in `src/ui/settings.ts`. Setting it back to `true` restores the switch.
- "Kids mode rework" moves from the Phase 1 play-test fixes to Phase 7 (polish and optional extras).

## Consequences

- Phase 1 no longer waits on Kids mode.
- New screens don't need a Kids variant for now; the existing Kids views may drift and will need
  a pass when the rework starts, ideally after the UI redesign so it builds on the new HUD.
