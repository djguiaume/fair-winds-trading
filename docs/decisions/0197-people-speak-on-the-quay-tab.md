# 0197. People speak on the Quay tab

**Status:** Accepted (2026-10-25). Guillaume asked whether the players ever hear the people's voices.

## Context

Every person has a babble voice in `audio.json` › `voices` ([0132](0132-westholm-mill-and-babble-voices.md)), and the east sea added Elias's and Pip's ([0193](0193-the-east-seas-story-and-the-four-winds-closing-beat.md)). They only played on the pop-up card of a main quest (the prologue, Rook's thanks, Fair winds, Four winds). Every other quest's card shows on the harbour's Quay tab ([0141](0141-quay-tab-and-arrival-card.md)), which played no sound. Maren, Bram, Elias, Pip and the other arc people were never heard in the game, only in the tuning panel.

## Decision

When the Quay tab first shows a person with something new to say, the first of them speaks, with the voice, length and mood that a main quest's card would use (`music.speak` with the card's giver, word count and mood). `PortQuay.seen` now receives the fresh items, not just their keys. Each card speaks once: later visits to the tab, with nothing new, stay quiet. The Voices switch and volume in Settings still govern it.

## Consequences

- Every arc person is heard as their card shows, so the different voices finally matter.
- When several people are new at once, only the first one speaks, so the voices don't overlap.
- `tests/quest-quay.test.ts` checks that the new face speaks once.
