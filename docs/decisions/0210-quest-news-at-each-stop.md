# 0210. Quest news at each stop, timed run clock, deck cargo

**Status:** Accepted (2026-10-25). Guillaume's picks in the thread "Show quest progress at each dock": "for already accepted quests I agree with the pop-up style, you are actively doing it so it must show progression; to accept quests I prefer at the quay", and deck cargo (his own idea, the storyteller's recommendation; built and put to him, his pick pending when this was written). Changes [0141](0141-quay-tab-and-arrival-card.md) for quests under way; builds on the quest engine ([0125](0125-quest-engine.md)) and quest cargo ([0131](0131-calda-slipway-and-cargo-at-a-spot.md)).

## Context

Playtesters doing delivery quests (Maren's millstones from Stonehaven, Ada's stone for Teeth Rock) docked at each stop and saw nothing: quest cargo loaded or unloaded in silence, a hold too full simply loaded nothing, and the only sign of progress was the small badge on the Quay tab (0141). Timed runs (the bread to Saltmere, Kit's catch, Rook to Calda) showed no clock, no start and no result. Quest cargo filled the hold ("6/10") while the hold list said "Hold empty".

## Decision

1. **Dock news, in the engine.** A condition kind can say what happened where the boat is now (`news` beside `update` and `test` in `questLibrary.ts`): `carried` says what came aboard, what is left on the quay for want of room, nothing aboard at the drop-off, some unloaded; `delivered` says goods to hand over here, some handed over; `timed` says the clock starts on casting off here, or to try again from the start. `QuestBook.news()` reads them for every quest under way; it is state, not events, so it is the same at every look. A step finished pays a new `paid` event (gold), and a run changing state a `run` event (`started`, `late`, `made`, with its time and par).
2. **A step begun at a stop does its part at once**: the check that starts a step checks again, so Maren's bread is aboard the moment the millstones come ashore.
3. **Accepted quests pop up at each stop** (Guillaume's pick): docking where a quest under way has news, a step to show or thanks, its card greets the captain before the harbour screen, like a main quest's arrival card, with the news in a strip on top ("1 millstone aboard for Maren, 1 left on the quay…", "Done! +150 gold."). One card per quest, in turn, then the market. **Offers stay on the Quay tab** (0141). News that comes up while the harbour screen is open (timber sold for Maren) shows on the footer line, with the Quay badge.
4. **At a spot at sea** (the mast, the stone at Teeth Rock) the same news comes as the sea note (0141), once per line.
5. **Timed runs**: a clock chip in the sea HUD's stats row, "Run to Saltmere 1:45 / 2:20", amber in the last 20 s; a toast when the run starts, runs over par (free retries, no blame) and is made.
6. **Deck cargo.** Quest cargo goes on deck, apart from the hold: each ship file has `deck` (sloop 8, cutter 12, hoy 16, schooner 16, clipper 20, fluyt 24, indiaman 30), in the quest items' own `space` units; upgrades do not change it; passengers still take none. Quests never fight trade for room. A "Deck 6/8" chip shows in the sea HUD and the harbour header while there is some, the hold list and the market's side say whose it is ("Maren's millstones: 1 (6 space)").
7. **Words are data.** Lines `quest.news.<kind>`, `quest.run.*`, item names `quest.item.<id>.one|many|the|own|unloadedOne|unloadedMany` (French agreement without genders in code), a person's short name `short` in `characters.json` when not their first word ("Ness"). The quest builder lists a quest's item names with its name and thanks, and its text check (`npm run check`) wants both languages for them. Approved by the head storyteller (plan/story/phase5-words.md, sections D and D2).

## Consequences

- The sloop carries one millstone, one stone block or the mast a trip; a cutter both millstones; bread baskets and fish crates always fit. Several quests share the deck: the worst overlap costs a second trip, never a dead end. A step whose deck is full says to deliver first.
- Quest events now include `paid` and `run`; tests comparing whole event lists list them.
- `cargoUsed` counts goods only; `deckFree` is the room quest cargo loads into.
- Code: `src/sim/questLibrary.ts` (`news`, `goalNews`, `StepNews`), `src/sim/quests.ts` (`news()`, `runs()`, `cargo()`, `runEvents`), `src/ui/questView.ts` (`newsLine`, `cargoLines`, `quayItems`'s news and `paid`), `src/main.ts` (`showStopCard`, `seaNews`, `showRunClock`), `src/ui/questCard.ts`, `src/ui/hud.ts`, `src/ui/tradePanel.ts`. Tests: `tests/quest-news.test.ts`.
- Screenshots (desktop, phone portrait, TV with a controller, French): [docs/reviews/quest-news](../reviews/quest-news/README.md).
- Not done here: a player's own marker on the chart (its own thread, "Fix quest markers on the chart").
