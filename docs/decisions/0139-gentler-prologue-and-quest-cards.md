# 0139. A gentler prologue, and one quest card per harbour call

**Status:** Implemented (2026-10-24). Fixes from Guillaume's first playtest of a new game on v0.4.x. Changes the prologue of [0127](0127-prologue-rescue-tutorial.md) and how the cards of [0124](0124-characters-look.md) and [0130](0130-after-a-quest-and-the-saltmere-shoals.md) follow each other. The quest card's own look (clearer, can be ignored, not on top of the harbour screen) is a separate proposal with mockups.

## Context

Guillaume started a new game and took the tutorial:

- The wind was far too strong and everything happened too fast: the boat was on the reef before he had worked out the sails. Replayed here: the prologue started at full sail in a 16 kn breeze, 95 units from East Reef and pointed straight at it, and hit the reef about ten seconds in, still on the first lesson.
- He did not hear the foghorn and saw no marker and no one to pick up. Grinding on the reef next to the wreck, the foghorn lesson was passed at once (already in range) and the boat, stopped dead on the reef, counted as "alongside", so Rook came aboard unseen. The horn itself was pitched at 98 and 147 Hz behind a 420 Hz low-pass: a phone speaker plays almost nothing down there.
- The chart showed Rook at Saltmere, but the sea showed no direction: an engine quest's target only drew on the chart.
- Docked at Saltmere, Rook's card said "come and see me next time you're in Saltmere", then at once said thanks and gave the island: a quest finished by doing nothing. Then Kit's offer opened straight after it, with no idea why. (Rook's card opening at a harbour means the tutorial was no longer running, so this is the path after Skip; it gives the island at the next Saltmere call, as 0127 planned.)

## Decision

1. **A calm breeze for the first lessons.** The map's `prologue` takes an optional `wind` (`speedKn`, `fromDeg`, default the map's prevailing direction). Lessons marked `calm: true` in `first-voyage.json` (sails, wind, foghorn, wreck and taking Rook home) sail in that steady breeze instead of the sea's wind; the trading lessons get the sea's wind back once Rook is home. The Windward Ring's is 8 kn from the prevailing NE (the sloop makes about 5 kn on a reach instead of 7 to 8). The sim holds it in `world.calmWind`, set by the tutorial like its storm hold (decision 0072); it is not saved.
2. **More sea room.** The prologue starts at (320, 40), 169 units from the wreck in open water east of East Reef, heading 300 (a beam reach that passes north of the reef), **lying still with the sails down**: the first lesson is raising them. A minute at full sail on the start heading touches nothing (a test). The sails lesson text now says raise, then steer, then lower to slow down.
3. **Coming alongside counts only afloat**: within 20 units of the wreck (was 16, the wreck sits a few units inside the reef), slower than 2 kn for 3 s, and the count starts again while the hull grinds on the reef, not only on a new hit.
4. **The foghorn can be heard and read.** Pitched at G3 and D4 (196 and 294 Hz) with a 1400 Hz low-pass and a little louder (`audio.json` volume 1.6), and each blast also shows a line, "A foghorn sounds to the west", for a muted phone.
5. **The wreck is marked at sea** with the quests' ring and beam (0130) while a lesson is about it, next to Rook waving, and the top objective panel and the screen-edge arrow show "Foghorn" and its distance.
6. **The sea points at the tracked quest.** With no course set, the objective panel and edge arrow show the tracked quest's harbour (its pier) or spot at sea, named by the port or the step's ask. A course set on the chart still wins; nothing shows while docked or while the tutorial runs its own lessons.
7. **One person speaks per harbour call.** On docking, quests are checked before any card opens, so a step the dock itself finishes (Rook's "call at Saltmere") is thanked for, not asked and then thanked. After a thanks card, a new offer in that harbour waits for the next call (Kit's offer comes the next time you dock at Saltmere).

## Consequences

- The prologue is slower and safer; a player who ignores the lessons and keeps going still reaches the wreck in under a minute.
- The random tutorial sessions of `tests/plays-the-same.test.ts` walk the lessons at slightly different moments (the alongside rule) and read the new sails text, so their hash is retaken on purpose.
- The story text is unchanged except the sails lesson's control hint, and Rook's thanks gets a translated name ("Les remerciements de Rook"; the French card showed the English "Rook's thanks"). Rook's thanks on the skip path ("You've a feel for the wind") was written for the rescue; whether it needs its own wording is a question for the storyteller.
- Screenshots: [docs/reviews/gentler-prologue](../reviews/gentler-prologue/).
