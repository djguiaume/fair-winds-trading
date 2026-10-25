# Storyteller handover to Phase 5 (2026-10-25)

From the "Head storyteller (Phase 4)" thread to "Head storyteller (Phase 5)". The earlier handover (Phase 3 to Phase 4) is in project files at `plan/story/handover.md`. This note replaces it.

## First task, from Guillaume (2026-10-25 14:26Z)

Before writing the Phase 5 story brief, review the game as a whole: play the story in order (prologue, the four ring arcs, the four seas and `four-winds`) on the live build and in the quest files. Then say whether the roadmap (`docs/roadmap.md`, Phase 5 = pirates) is still the right direction, or what should be adapted. Guillaume said the roadmap is only indicative and can change. Give him a recommendation, not a survey.

## Where everything lives

- **The brief is the source of truth:** `docs/story/storyteller-brief.md`. It holds the voice rules, each person's way of speaking, the data conventions, the Phase 4 pattern, places and people, the step tables for every sea, town levels, French map names, quest ids and the rulings for other threads. Keep it up to date in the same PR as any ruling.
- **Community arcs:** `docs/story/community-arcs.md` (decision 0122).
- **Quests:** `src/data/quests/*.json`, one file per quest, written byte for byte with `formatQuestJson` (`src/data/jsonFormat.ts`), or the builder test fails. Use `npm run quest -- check <id>`, which runs the same checks as the quest builder.
- **Text:** `src/i18n/en.json` and `fr.json`, under `quest.<id>.<step>.title|copy`. The prologue and tutorial cards use `lesson.*`. Variants for each way of playing (`@touch`, `@keys`, `@pad`) follow decision 0184.
- **People:** `src/data/characters.json` (their looks). Every one of the 14 people has a babble voice in `src/data/audio.json` under `voices`: juno, tam, rook, sigrun, nell, kit, ines, bram, oskar, maren, ada, ness, elias and pip. A new speaking person needs a look and a voice before their quest merges.
- **Seas:** `src/data/seas/{south,west,north,east}.json` hold the ports (level, maxLevel, levelProduces, wantsMade), the chart areas the letters lift and the `after:`/`before:` tags.
- **Story decisions:** 0122 arcs, 0125 quest engine, 0127 prologue rescue, 0129 brief, 0134 epilogue, 0147 Phase 4 story, 0155 south, 0158 Palm Key and `doneSpeaker`, 0139/0159 tutorial and home island, 0164 sailing lessons, 0166 appear/vanish tags, 0185 and 0190 prologue and Rook's thanks, 0193 east story and `four-winds`, 0194 seas open early, 0197 voices on the Quay tab, 0200 a load on credit.
- **Rulings written for threads** (in project files, all applied): `plan/sailing-lessons/storyteller-ruling-2.md`, `plan/west-sea/storyteller-review.md` and `plan/sea-density/storyteller-answer.md`.

## What is done (all on main)

- **Phase 3:** the prologue (`first-voyage`, the rescue of Rook), `rooks-thanks`, the four ring arcs (`saltmere-shoals`, `calda-slipway`, `westholm-mill`, `stonehaven-light`) and the epilogue `fair-winds`. Then `sailing-lessons`, which can be replayed from the menu.
- **Phase 4, the four seas:** each sea runs a letter from a ring person, then the keeper's arc, then an outpost founded with the ring person's relative.
  - South: `watchman-passage`, `sunreach-tea`, `outpost-south` (Juno, Tam, Palm Key).
  - West: `calda-letter`, `emberhold-glass`, `outpost-west` (Bram, Oskar, Cinder Isle rising after the eruption).
  - North: `saltmere-letter`, `rimewick-jam`, `outpost-north` (Sigrun, Nell, Snowberry Isle behind the pack ice).
  - East: `westholm-letter`, `fogwatch-amber`, `outpost-east` (Elias, Pip, Amber Strand).
  - The closing beat is `four-winds`: Rook at Skerry and the pier signpost, after all four outposts.
- **Sea order (0194):** `watchman-passage` starts after `stonehaven-light`. Each other letter starts after its own ring arc and `watchman-passage`. The seas run side by side, and no far port is locked before its letter. Measured by the balance bots, the last outpost is founded in about 1h15 to 2h30 (0195); real players will take about 3 to 4 hours.

## Standing rules (keep them)

- **Threads ask the storyteller before Guillaume**, economy and prices included. Ask Guillaume only when the choice is his, with one decision card and a recommendation.
- **Story PRs auto-merge** when no question is open, CI is green, and the branch is checked against the latest main.
- **New looks** (people, props, islands, signposts) wait until Guillaume has seen screenshots on desktop, landscape and portrait.
- **Everything is data**, and every quest runs on the quest engine. Every authoring feature must be editable in an editor and have an agent tool.
- **Cards:** 2 to 4 lines, about 220 characters at most. The title is the ask: an imperative of 5 words at most. Split long talk into several cards in a row. Every done card says thank you.
- **Tone:** warm and plain. No deadlines, no danger to people beyond a light word, no hunting, whaling, weapons, alcohol or furs as goods. Eruptions are a spectacle only. Wrecks are old and empty.
- **English:** "captain". Map names keep "The" in titles ("Look round The Smoulder") and are lower case mid-sentence ("the Smoulder").
- **French:** vous and « capitaine », the typographic ’, and a non-breaking space before : ? ; ! and inside « ». Map names stay in English, without "The" and with an article (« le Smoulder », « la Coral Line »). The no-go zone is « zone de vent debout ».
- **Names:** never use "Skerry" in a new name, and never reuse a leading word that is already taken (Cinder, Teeth, Gull, Lantern, Palm, Gannet, Strand).
- **Rook** stays at Saltmere. He closes each outpost with one line on the relative's done card ("Rook will want that in the book"), never with a card of his own.
- **Prices fit the story:** a market buys a crafted good only if some port already makes it, so check `wantsMade` before picking a delivery good.
- **Town levels:** the four main ports start at Town (3) and grow to Port town (4). Outposts are founded at hamlet (1) and stop at Town (3).

## Rulings Guillaume approved (do not change)

- **Rook's thanks on the quay** stays as it is (2026-10-25 13:12Z): "Saltmere, and my own quay! Another tide on that reef and I'd have been swimming for it, captain. You've my thanks, entered in the book. And a harbourmaster pays his debts, so hear me out."
- **The seas open early (0194),** as described above.
- **Running out of gold (0200):** the harbour office lends one load on credit, and a warning shows before you spend below the cheapest load. There is no person card, interest or deadline.

## Open or pending

- **No story question is open.** Every thread's question is answered and the brief matches main.
- **The Phase 5 brief** is the next job, after the review above. The roadmap's Phase 5 is pirates, switchable in Settings and scaled per difficulty (decision 0010: light hazards). If the story keeps pirates, they need a tone that fits the no-harm rule (they chase and take cargo, and nobody is hurt), a switch-off path that keeps every quest playable, and probably a ring person with a reason to care.
- **Bram's voice** was nudged away from Rook's (lower pitch, slower, vowels "aeo" against Rook's "oau"). Check it by ear in the next review.
- **The big-event panel** for eruptions (0174) is only proposed. Don't build it until Guillaume asks.

## Unwritten ideas (not promised)

- The north weather station could later give a small weather perk, like Skerry's weather glass.
- Biome fittings (ship parts) could be an arc prize.
- A later quest could use a sea fill, such as Spark Rock's light. That is the storyteller's call when the quest is written.
- Build spots and perks at the outposts were deferred.
