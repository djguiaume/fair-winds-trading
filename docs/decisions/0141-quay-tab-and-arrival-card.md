# 0141. People speak on the Quay tab; main quests greet you on arrival

**Status:** Implemented (2026-10-24). Guillaume's pick from the [quest card proposal](../reviews/quest-ui/README.md): "B unless it's a main quest like the tutorial, which could be like C", and "everything is data driven: it belongs in the quest engine". Follows [0139](0139-gentler-prologue-and-quest-cards.md); changes how the cards of [0124](0124-characters-look.md) and [0130](0130-after-a-quest-and-the-saltmere-shoals.md) show.

## Context

In his playtest the person's card opened **on top of the harbour screen**, a second one popped up straight after, and players did not understand why either was there. Quest cards should be clearer, and possible to ignore. The proposal showed three options at three screen sizes: A (a word at the quay inside the harbour screen), B (a Quay tab, nothing pops up) and C (an arrival card before the harbour screen).

## Decision

1. **Data: a quest's `main` flag** (quest file, `QuestDef.main`, checked with the quests: true or false, and never on an `offer` quest since a main quest cannot be ignored). `rooks-thanks` and `fair-winds` (the epilogue) are main. The tutorial keeps its own lesson cards.
2. **Main quests: the arrival card (C).** Docking where a main quest has a card opens it **before** the harbour screen, under the harbour's name ("Saltmere · moored · someone is waiting for you"), with "To the market →" below. Closing it opens the harbour screen. A main quest's card never covers the harbour screen: one that comes due while it is open waits (portless ones show once you sail out, harbour ones at the next arrival). At sea a portless main card (the epilogue) still shows as before.
3. **Every other quest: the Quay tab (B).** The harbour screen gets a `Quay` tab between Orders and Shipyard listing everyone in this harbour with something to say: the thanks for a finished quest, the steps under way here, then the offers. News counts on the tab's badge and shows a footer line, "Kit Marlow would like a word → Quay", until the tab has shown it. Offers answer `I'll bring it`, `Not now` (the badge goes, the offer stays listed and comes back fresh next call) and `Don't offer again`; a choice step shows its options there. Nothing pops up for these quests.
4. **Don't offer again** is quest state: `QuestState.ignored` (saved with the voyage, read back only for offer quests with no progress). An ignored offer has no card, no badge, no `offered` event; the chart's journal lists it as "Not offered again · tap to take it up", and a tap offers it again.
5. **At sea: a small note instead of a card.** When a non-main quest moves on or finishes away from its person, a note slides in under the captain's gold: their face, "Kit · step 2 of 3", the new ask, "Tap for the journal". It fades after 6 s, waits while a screen covers the sea, and is skipped if the Quay tab already showed it.
6. **Every card says what it is**: a tag `New job` / `Next` / `Done`, the ask boxed with where it happens ("3 places, marked on the chart", from the step's `reach` points, `chart` circle or `compass`), and the reward ("Reward: 100 gold · then 2 more steps", plus "an island of your own", "a building for your island", "Westholm grows", "… on the chart" from the reward data).

## Consequences

- 0139's "after a thanks card, a new offer waits for the next call" only matters for main quests now: after Rook's thanks Kit's offer is on the Quay tab at once, with a badge, and never pops up.
- The arrival card is skipped while the tutorial runs (its lessons speak), as before; the Quay tab is empty then too.
- The compact share code (FW2, 0118) does not carry the ignored offers: a transferred voyage simply offers them again. The JSON save keeps them.
- Code: `src/ui/questView.ts` (`quayItems`, `cardTag`, `rewardWords`, `stepWhere`, `dueCard`'s `only`), `src/ui/questCard.ts` (`questCardBody`, shared by the arrival card and the Quay tab), `src/ui/questNote.ts`, the `quay` hook of `src/ui/tradePanel.ts`, `QuestBook.ignore` / `unignore` / `ignoredOffers`. Tests: `tests/quest-quay.test.ts`.
- Screenshots of the build (French, desktop 1280x720, phone landscape 915x412, phone portrait 412x915): [docs/reviews/quest-ui/built](../reviews/quest-ui/README.md#as-built-decision-0141).
