# 0132. The Westholm mill arc and babble voices

**Status:** Implemented for review (2026-10-23). Story and card text approved by the head storyteller (brief [0129](0129-storyteller-brief.md)).

## Context

The storyteller brief ([0129](0129-storyteller-brief.md), [brief](../story/storyteller-brief.md)) fixes the Westholm arc, "The mill on the hill" (Maren Holt, grain), and gives this thread one shared piece: people's **babble voices**, as data, generated or from sound files, with a Settings switch. Two engine gaps showed up on the way: a timed step's par differs per difficulty level, but its title had no way to show it, and no windmill could look storm-damaged. Everything stays data (0093): no code names the quest, Maren or Westholm.

## Decision

1. **The arc** is `src/data/quests/westholm-mill.json`, offered by Maren at Westholm once `rooks-thanks` is done. Steps: `sails` (sell or deliver 8 timber at Westholm, 100 gold, Maren worried), `millstones` (item `millstone`, 2 × space 6, Stonehaven to Westholm: a sloop's hold of 10 takes one a trip, a cutter or a hauler both; 150 gold), `bread` (item `bread-batch`, 4 × space 1, carried **and** timed Westholm to Saltmere; par fair 3:00, captain 2:20, salt 1:50, about twice a sloop's estimated 71 s leg; 250 gold). The quest's reward offers `spot-2` on Skerry (Warehouse or Bakehouse) and puts Westholm up a level: the harvest fair, on the done card, never a deadline. Text in `quest.westholm-mill.*`, English and French, as approved by the storyteller.
2. **A timed run with cargo** is the goal `{ "is": "all", "of": [carried, timed] }`, the same in the Saltmere and Calda arcs. Known quirk, accepted by the three threads: a run over par still unloads the cargo at the far end, and the player sails the run again empty.
3. **`{par}` in a step's text.** `QuestBook.parSeconds(step)` finds the step's `timed` goal (also inside `all` / `any`) and gives its par for the voyage's level; the card and the journal fill `{par}` in that step's title and copy as a clock ("2:20"). Any arc's timed title uses it ("Rush bread to Saltmere in {par}").
4. **Babble voices.** `src/data/audio.json` gets a `voices` section; a person's entry in `characters.json` names theirs with `voice`. A generated voice is `synth: "babble"` with `pitch` (1 = about 180 Hz), `speed`, `wobble` (0 to 1) and `vowels` (letters from `aeiou`: the accent of a port); a recorded one is `file` or `files` (clips in `public/audio/voices/`, one picked at random and cut to length). `volume` and a `moods` block (`neutral`, `worried`, `pleased`, each changing any of those) are optional. When a card opens, its person says about one syllable per word of the ask, at most 8 syllables and 1.5 s (`src/audio/babble.ts`: one oscillator, two formant filters and one gain a syllable). The six people get generated voices first: Rook and Kit share Saltmere's round vowels (`oau`, `oaui`), Rook low and orderly, Kit quick; Ines slow and warm; Maren high, fast and sing-song; Ada flat and short (`ou`); Old Ness low and wandering.
5. **Settings › Sound** gets **Voices**: a switch (on by default) and a volume, saved with the settings. Voices play with the music muted. The `?tune` panel's **Voices** sheet plays each voice in each mood.
6. **Checks** (`audioProblems`, run by `tests/audio-data.test.ts`): a voice must be one of `synth`, `file`, `files`; numbers in range; vowels from `aeiou`; moods known; every person's `voice` in `audio.json`; and every recorded file (music, effects, voices) present in `public/`.
7. **A bare windmill** (`windmill-bare` prop, "Windmill, bare sails" in the builder): the tower with only the stocks and lattice of its sails. Any island can use it. Westholm's main mill swaps from bare (`before:westholm-mill`) to full sails (`after:westholm-mill`) with the Saltmere thread's after-a-quest tags, in a follow-up once those are merged. The sails stand still, like every windmill; the storyteller chose that over turning sails (the copy says "the mill has its sails again", never "turns").

## Consequences

- Other arcs add only a `voice` entry for a new person; replacing a generated voice with recorded clips is a data change.
- Voices cost a few nodes for under 1.5 s per card, and nothing when switched off.
- The before/after windmill waits for the after-a-quest hook; until then Westholm's mill shows its sails throughout.
- Turning sails, if ever wanted, would be an opt-in prop field on chosen landmark mills only (storyteller), not part of the arcs.
