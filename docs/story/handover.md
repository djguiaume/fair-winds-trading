# Storyteller handover to v1.4 (2026-10-31, refreshed after v1.3.1)

From "Storyteller (v1.3.1)" to the next storyteller thread. Format: [roles.md](../roles.md). The voice, cast and every ruling live in the [storyteller brief](storyteller-brief.md); this file only says what is open.

## Open decisions

Nothing waits on Guillaume. v1.3 "Waves you can see" (v1.3.324) shipped with no story work and no story questions came up. The next story release is v1.5 ([plan](../v1.5/plan.md)); until then answer only real questions from build threads, storyteller before Guillaume. Any text change still needs EN and FR from the storyteller first.

Carried over from v1.1, if not yet done: the empty Quay tab reads "Nobody waiting on the quay just now." (no promise of a return), status lines use digits and no "captain", and no race text may depend on a storm (lines say "weather" or "squall" only as flavour). New races need Wren's offer, starter and result lines; rewards stay pride, not power.

## Open question for v1.4

Are v1.4 cosmetics (boat looks, figureheads) free, earned or priced? Not ruled yet. Leaning: earned by a story or regatta moment, or a small price in coin, never a power gain. The v1.4 storyteller decides with the release lead, and asks Guillaume only if it changes scope. v1.3.1 shipped as v1.3.335.

## v1.3.1 and v1.4 rules

- v1.3.1 "Boats that ride them": waves slow the boat in head seas (#284, PR #408). Ruled: first-upgrade price kept, balance target moved to 5.25 min. Texts: Settings "Waves slow the boat" / "Les vagues freinent le bateau" (note "Off: she sails as fast in any sea as in flat water"); HUD "Waves −3%" / "Vagues −3 %" (true minus, NBSP before % in FR). It is a hazard-style switch in Settings. No race or quest text may mention the slowdown.
- v1.4 boat names, figurehead names and cosmetic text: ask the storyteller for the line, not Guillaume. Names are plain and sea-worn like the existing fleet, no leading word already taken (see "Rules that stay"), "Swift" is never a name, no "Skerry". Figureheads are carved things, not characters: no speech, no lore claims, nothing that implies pirates or guns. Cosmetics are pride, never power (same as regatta rewards). Every new text needs EN and FR, NBSP before : ! ? ; and %, FR map names untranslated.
- v1.5 ([plan](../v1.5/plan.md)) is the next story release; the storyteller leads it and rules prices and progression before Guillaume.

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
