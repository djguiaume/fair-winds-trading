# 0128. Storyteller brief: one voice and shared rules for the four arcs

**Status:** Accepted (2026-10-23). Guillaume made a head storyteller thread that decides the story for the four arc threads, and answered its questions before they started.

## Context

The approved story ([0122](0122-community-arcs-story.md), [community arcs](../story/community-arcs.md)) is built by four threads at once: Saltmere fish, Port Calda slipway, Westholm mill and Stonehaven lighthouse. Without shared rules they would write four tones, pick clashing ids and build the same engine pieces four times. Guillaume's rule is that the storyteller may ask him questions only before the arc threads start, and answers them itself after that.

## Decision

1. **The brief** ([storyteller-brief.md](../story/storyteller-brief.md)) is binding for the arc threads. It sets the voice, the card rules, each person's way of speaking (accents through word choice, never through misspelled dialect), the quest ids, text keys, items, gold and home spots, and the fixed details of each arc.
2. **Guillaume's answers:** the placeholder names are final; Kit is a man; a short epilogue at Skerry, "Fair winds", comes after the four arcs. People speak in **babble** rather than recorded lines, either generated or from sound files. The written voice is approved, and Rook names the four people at the end of the prologue (done here).
3. **One owner per shared piece:** the after-a-quest hook for props, production and chart marks and the East Reef gap go to Saltmere; cargo loaded or unloaded at a spot at sea goes to Calda; a step's `speaker` and Teeth Rock go to Stonehaven; babble voices (generated or files) go to Westholm; Rook naming the four people and the epilogue go to the storyteller.
4. **Everything is data** (0093): quest files, i18n, `characters.json`, island and map files, `buildings.json`, and voices as sounds in `audio.json` › `voices` (`synth: "babble"` with pitch, speed and wobble, or `file`/`files`), named from the person's `voice` in `characters.json`. No TypeScript names a quest, person or place; new needs become generic conditions, rewards, tags or fields.
5. **Arcs ship live**, one PR each, with no flag; each plays through in its own test.

## Consequences

- Arc threads ask the storyteller, not Guillaume, about the story, and send their card text to the storyteller before merging.
- Text keys for all arcs sit in one place in `en.json` and `fr.json`; conflicts between arc PRs are kept-both merges.
- Threads that need another thread's shared piece rebase onto it once it is merged.
