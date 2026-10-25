# 0184. A new game always plays the prologue, and Rook speaks at the rescue

**Status:** Accepted (2026-10-25).

## Context

Two reports from Guillaume's playtests of the prologue ([0127](0127-prologue-rescue-tutorial.md),
[0160](0160-skipping-the-tutorial-keeps-its-story.md)):

1. **New game in Settings, then "Set sail"**: the voyage started beside Saltmere in free play and
   the prologue was gone. The browser remembers that the tutorial was seen (`TutorialChoice`,
   `skipped` or `completed`, kept across voyages so it is not offered twice). A fresh voyage then
   got no offer, and nothing else started the prologue; with `first-voyage` never started, Rook's
   thanks started at once and paid the island on the first call at Saltmere, the bug 0160 fixed
   for the offer's button.
2. **A playtester dismissed the tutorial card** (the coach turned off, 0160), heard the foghorn,
   reached the wreck, and Rook never spoke: the HUD arrow went straight to Saltmere. Rook's only
   words at the rescue were in the `chart` lesson's bubble, a `teach` step that a lesson without
   its coach passes by. The story had no beat of its own there.

## Decision

- **Set sail on a new voyage** starts the prologue without the coach when the tutorial was seen
  on an earlier voyage, exactly as "Skip the lessons" does (alone at sea at `prologue.start`, sails
  down). The offer still shows only while the tutorial is unseen. `?bench` and quest tests, which
  do not go through Set sail, are unchanged; the tools still drop the prologue with `fwt.freePlay()`.
- **A lesson step with a `speaker`** is that person's people card (portrait, voice, mood) instead
  of a coach bubble, with the coach or without it. The quest engine already had `speaker` on
  steps; the game now shows a lesson's speaking step as a main card, at sea, as soon as the step
  starts. Closed with Esc, the card counts as its first answer, so the lesson cannot stall.
- `first-voyage.json` gains the story step **`aboard`** after `wreck`: Rook's card, mood pleased,
  one answer "Welcome aboard". Words by the storyteller (2026-10-25). The coached `chart` bubble no
  longer repeats his line ("Rook wants to go home to {origin}. Open the map…").
- A lesson's people card numbers its step along the lesson's main line, as its bubble does.

## Consequences

- Every new voyage plays the rescue, whatever was chosen on an earlier one, and Rook always
  speaks when he comes aboard, coached or not.
- Old saves load unchanged: a lesson past `wreck` never meets `aboard`; one saved on `wreck` meets
  it next.
- The tutorial's main line has 13 steps instead of 12, and the random-session hash in
  `plays-the-same.test.ts` was retaken.
- Any other lesson can give a person a card the same way: a step with `speaker` and `choose`.
- Tests: `tests/new-game-prologue-app.test.ts` (all three levels), `tutorial-skipped-app` and
  `tutorial-app` (the card, then the next step). Screenshots:
  [docs/reviews/prologue-fixes/](../reviews/prologue-fixes/).
