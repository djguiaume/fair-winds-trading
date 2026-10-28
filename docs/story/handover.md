# Storyteller handover to v1.1 (2026-10-28)

From "Head storyteller (Phase 5)" to the next storyteller thread. Format: [roles.md](../roles.md). The voice, cast and every ruling live in the [storyteller brief](storyteller-brief.md); this file only says what is open.

## Open decisions

Nothing waits on Guillaume. Questions will come from the v1.1 build threads, and each is answered by the storyteller before Guillaume:

- **#260 New races + club board** (wave 3, last): how many races, where they run, and what the club board says. Not decided. Wren opens "The Sailing Club" (« Le Club de voile ») at Saltmere. Pitch: "Wren opens a sailing club at Saltmere: new courses round the islands, a few with a squall to sail around, and a club board for your best times." The new races need Wren's offer cards, starter lines, result lines and a pennant rule for any new series. Rewards stay pride, not power (no perk, no stat).
- **#259 Fixed storms in races** (wave 2): the story rule is that no race text may depend on a storm. With Storms off the course still runs, and lines say "weather" or "squall" only as flavour, as Elias does with the Stormbreak.
- **#261 UI reskin style E** (wave 3, last): every text change needs EN and FR from the storyteller first. Two earlier rulings to keep: the empty Quay tab reads "Nobody waiting on the quay just now." (no promise of a return), and status lines use digits and no "captain".

## Pointers

- **Brief:** [storyteller-brief.md](storyteller-brief.md). Rule 12 (voiced Skerry choice, [0210](../decisions/0210-skerrys-build-choice-staked-plots-and-the-island-tab.md)) and the ring's names and before/after rules ([0216](../decisions/0216-windward-ring-catch-up-pass.md)) are in it. Its "Status" line at the end is stale; bring it up to date in the same PR as your first ruling.
- **Phase 5 story rulings:** [docs/phase-5/story.md](../phase-5/story.md): the regatta, standing orders, keepers on the harbour screen, boat names, the Skerry choice.
- **Regatta:** [0217](../decisions/0217-the-saltmere-regatta.md). Wren Tally (look and voice in `characters.json` and `audio.json`), her cutter *Kestrel* (K 7), eight races as quests (`src/data/quests/race-*.json`), words under `regatta.*` and `quest.race-*` in `src/i18n`. The start is a horn, never a gun. Series: ring (3), seas (4), Four Winds Cup (1). Series won needs silver or better in each race. Pennants: Saltmere, Far Seas, Four Winds.
- **Standing orders:** [0214](../decisions/0214-standing-orders-people-ask-again.md). One `standing-<person>` quest per person whose arc is done, 3 or 4 asks each; the full pools in EN and FR are in project files `plan/story/standing-orders.md` and `.json`. Settlers ask at their own outpost (timber). Rook and Kit take turns at Saltmere.
- **Deck cargo** (quest cargo on deck, not in the hold), quest news lines at each stop ([0213](../decisions/0213-quest-news-at-each-stop.md)) and the harbour screen's keeper lines are all in `src/i18n`. The keepers: Saltmere is Rook, the outposts the settler, none at Abbey Head and Skerry.
- **Project files (not in git):** `plan/story/phase5-words.md` and `plan/story/regatta-words.md` hold the original EN and FR drafts. The built text in `src/i18n` is the truth.

## Rules that stay (do not reopen)

- Pirates are out of the base game. If they return, only as a later extension in their own new sea, with the "rovers" shape: no guns, you outsail them, nobody is hurt, a crew is brought home. Idea on file in [the review](../reviews/whole-game/README.md).
- The seas open early (0194). Rook's thanks on the quay stays as Guillaume approved it. The credit load (0200) has no person card, interest or deadline.
- "Swift" is a ship line id, so it is never a name. Never use "Skerry" in a new name, or a leading word already taken (Cinder, Teeth, Gull, Lantern, Palm, Gannet, Strand).

## Follow-ups

- Add a short Wren, regatta and standing-orders section to the brief itself (today the rulings sit in `docs/phase-5/story.md` and the decisions). Not yet an issue; do it with the first v1.1 story ruling.
- Check Bram's voice by ear against Rook's (pitch 0.74, vowels "aeo" against "oau").
- The big-event panel (0174) stays unbuilt until Guillaume asks.
