# 0160. Skipping the tutorial keeps its story

**Status:** Accepted (2026-10-24).

## Context

Guillaume's playtest of a new game with the tutorial skipped ("Free sailing" on the offer): the boat
started beside Saltmere with full sails, and the first mission (the prologue rescue of
[0127](0127-prologue-rescue-tutorial.md), Rook's ride home, then Rook's thanks and the home island)
was skipped: dropping the tutorial counted it as done, so Rook's thanks started at once and paid the
island on the first call at Saltmere, without the rescue that explains it. His leaning: skip the
tutorial's cards, not the mission.

Since [0151](0151-tutorial-as-ordinary-quest-steps.md) the tutorial is an ordinary quest
(`first-voyage.json`), so the fix belongs in quest data, not in tutorial-only code (Guillaume's
"data first" rule).

## Decision

- A lesson can run **without its coach**. `QuestState.uncoached` lists such lessons (JSON save only,
  like `ignored`; a FW2 code loses it and the lesson speaks again, nothing else changes).
  `QuestBook.coachOff(id)` turns the coach off; `ask` (the menu's Tutorial) turns it back on and
  starts from the first lesson.
- A new step field, **`teach: true`**, marks a lesson's teaching-only steps. Without the coach they
  are passed by (the way a step about a missing map place is, 0151), and ways back (`unless`) to
  them are not taken. `checkQuests` allows `teach` only in lessons and wants at least one step
  without it. The quest builder shows a "Teach" box on a lesson's steps.
- `first-voyage.json` marks every step `teach` except the story: `foghorn`, `wreck` and `home`.
- **Free sailing on a fresh voyage** (and Esc on the offer) starts the prologue exactly as Start
  tutorial does, alone at sea at `prologue.start` with the sails down, then turns the coach off. The
  player follows the HUD's objective arrow ("A foghorn", "Someone on the reef", then Saltmere),
  the foghorn and the wreck's ring; docking at Saltmere ends the tutorial quietly (no "First
  delivery complete" bubble, the menu keeps "Replay tutorial") and Rook's thanks speaks on its own
  card, as after the full tutorial. On a voyage already under way, or a map without a prologue,
  Free sailing still just stops the tutorial.
- **Skip on the coach bubble** turns the coach off too, instead of dropping the quest: skipped
  during the first lessons the story goes on from the foghorn; skipped after Rook is home, the
  remaining steps are all teaching and the quest ends.
- The tools that click Free sailing to reach free play (`npm run shots`, the performance run) call
  the debug helper `fwt.freePlay()`, which drops the prologue and puts the boat back at the map's
  start, so their pictures and numbers stay as before. `npm run shots -- --prologue` shows the new
  start.

## Consequences

- Every new captain plays the rescue, so Rook's thanks and the home island always follow the story.
- Old saves load unchanged: no `uncoached` means a coached lesson, and the step ids did not change.
- Another lesson can use the same two pieces: mark its teaching steps, and the game can play it
  without the coach.
- Screenshots: [docs/reviews/skip-tutorial/](../reviews/skip-tutorial/).
