# 0190. Rook thanks the captain on the quay

**Status:** Accepted (2026-10-25).

## Context

Guillaume, playing the prologue: "as soon as we deliver Rook to Saltmere he doesn't say thank you?
No saying that it was close to dying or anything?" On the dock that brings Rook home the coached
tutorial went straight to the `island` bubble (Skerry, then "a first cargo"); without the coach
([0160](0160-skipping-the-tutorial-keeps-its-story.md)) the next words were Rook's thanks' `skerry`
card, written for a captain who had never met him ("I hear you handle a boat well…").

## Decision

- `first-voyage.json` gains the story step **`thanks`** after `home`: Rook's people card on the quay
  (look `soaked`, mood pleased, "You're welcome, Rook"), coached and uncoached, as `aboard` is
  ([0185](0185-a-new-game-always-plays-the-prologue-and-rook-speaks-at-the-.md)). `aboard` wears the
  `soaked` look too. Words by the storyteller; the danger is said with a smile (kids read it).
- `aboard`'s answer has its own id, **`welcome`**, so a quest can ask whether this voyage did the
  rescue (`chose first-voyage welcome`).
- **Rook's thanks** branches on it: `skerry` now speaks as to the captain who rescued him ("Now,
  about that debt…"); a captain who never did (a map without a prologue, an old save whose tutorial
  was dropped) is sent at once to **`skerry-stranger`**, with the old words. Both lead to `plots`.
- A card counts its steps along the quest's main line; a step off it counts as the step that leads
  there (`skerry-stranger` is 2 of 3).
- The card dialog answers before it closes, so a person's next card is due when the first closes.
  A docking that already raised a card leaves the harbour screen to that card's close. A lesson's
  people card closed unanswered (Esc, "To the market") answers its first option, and a lesson asked
  again shows its cards again.

## Consequences

- Every rescue ends with Rook's thanks on the quay, then his offer of Skerry in a voice that
  remembers the reef.
- Saves on `skerry` keep the step (now the rescue text); old saves without the rescue move to
  `skerry-stranger` on the next check.
- The tutorial's main line has 14 steps; the random-session hash was retaken.
