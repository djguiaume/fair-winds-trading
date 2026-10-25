# 0195. Balance the grown sea in story order

**Status:** Proposed (2026-10-25). Gap 3 of the [Phase 4 review](../reviews/phase-4-review/README.md) ([0188](0188-phase-4-review-and-release-gate.md)). The head storyteller ruled on the price order and the buyers; which ring towns buy the crafted goods (point 4) is Guillaume's call. Follows [0046](0046-phase-1-economy-tuning.md), [0083](0083-difficulty-levels.md), [0146](0146-far-goods-from-the-biome-outposts.md), [0149](0149-balance-checks-in-real-wind.md), [0150](0150-building-far-goods.md) and [0194](0194-open-the-edge-seas-after-each-ring-arc.md).

## Context

`npm run balance -- --map phase4` failed 8 of 19 checks on all three levels: sloop legs 113–121 s median, the cutter never, the top route 47 %, repairs 12–33 % of income. The bots traded with every far port from the first minute, outposts included, while the game charts the seas one by one through the story ([0156](0156-fog-of-war.md)) and founds the outposts through quests ([0157](0157-founding-outposts.md)). The targets were the ring's early game, and nothing measured the late game the far goods were made for. Guillaume also asked how long the game is now.

Running the bots in story order showed what else held the far goods back:

- **No ring town became a Port town** in four hours on any level. The crafted goods' only buyers (0146 point 5) sat at full growth waiting for 20 honey or lamp oil, which only the hidden Watchman Key and Abbey Head make, and only once grown to Village. When Palm Key is founded, Port Calda and Westholm are Village or Town on every level. A smaller rare-goods gate (5 instead of 20) changed nothing, because the towns are also short of growth. So the workshops crafted for nobody, and far goods were about 1 % of late income.
- **The bots loaded goods a port does not buy** and carried them until some port did. A crafted far good has two buyers in the whole sea, so the late-game bots hauled phantom loads.
- **`saltmere-letter` charted nothing**, so Rimewick stayed in the fog (fixed in #202 with the storyteller's OK).

## Decision

1. **The bots play the story** (`src/sim/balanceStory.ts`, `sailVoyage({ story: true })`) on a sea with chart areas. They trade only with the ports on their chart. The ring's arcs are sailed alongside the ring's trade: each is timed from its steps and done when due, but never before the cutter. From the cutter on, each far quest is sailed as soon as its start holds, read from its own file (0194: the seas run side by side). Each step is timed in the level's wind: fetch the goods at the nearest port that makes them, carry them, reach the spot, a dock's time for the cards. A relaxed captain takes 1.4 times as long. Each quest pays its gold, charts its areas, founds its sites and applies its `afterQuest` trade. A sea whose quests are not written uses the chapter's `standIn` in `balance-targets.json` › `story`. Once the seas open, sailing charts what the boat passes and finds hidden ports, as in the game.
2. **The bots play the late game as a captain would.** A load of raw far goods counts the crafted run after it (outpost, workshop, buyer). When a crafted good has no buyer yet, the captain grows a town that would buy it, and fetches its rare goods if Port town is what it waits for (the town card). Story voyages only count loads the port buys. The ring's early game keeps the old reckoning for the ring's goods, so the tuned ring checks stay as they are. A follow-up should fix that too and retune the ring: with the fix, the ring's top route is 35 % (target < 30 %).
3. **The ring checks run on the grown sea without the story**, so they measure the ring's early game as before. **New late-game checks** (`story` targets, a 4-hour run, 5 seeds, every level):
   - every sea opens and its outpost is founded within the run;
   - the last hour pays 1.5–5 times the ring's gold per minute;
   - far goods are at least 25 % of the last hour's market gold;
   - at least 30 % of the last hour's legs start or end at a ring port;
   - every sea's crafted good sells;
   - legs to and from the far seas' ports take a median of 150 s or less;
   - each level earns less in the late game than the one before;
   - no route has 30 % or more of the late legs;
   - the quests' gold is at most 30 % of all gold.

   `npm run balance` prints them as a third table (`--only story`).
4. **Towns buy the crafted far goods** (`levelWantsMade` from level 3 in `phase1-map.json`). Port towns pay more, because a level 4 market holds a smaller stock. The storyteller's test was that a buyer of spiced tea is a Port town, or nearly one, by the time Palm Key is founded. That fails on every level, so the storyteller backs Towns as the fallback, and Guillaume decides (decision card in the balance thread).
5. **Far goods cost less, in the same order** (`goods.json`): raw 18 / 19 / 20 / 22 (were 20 / 22 / 25 / 28), crafted 86 / 88 / 95 / 105 (were 90 / 100 / 110 / 120). This keeps the order the seas open in (storyteller). At the old prices the last hour paid 5–6 times the ring. Spiced tea and mirrors sit close together because the south's run pays least per minute (Sunreach's buyers are far), and at a wider gap tea stopped selling.

## The numbers (grown sea, median of 5 seeds; the east from its stand-in until #207 lands)

| Level | Ring alone → last hour (relaxed) | Far goods, last hour | Seas open (relaxed, min): S / W / N / E | All four outposts: relaxed / sharp |
|---|---|---|---|---|
| Fair winds | 155 → 691 gold/min (4.5×) | 94 % | 22 / 27 / 87 / 92 | 2 h 09 / 1 h 14 |
| Captain | 133 → 372 (2.8×) | 76 % | 30 / 34 / 43 / 103 | 2 h 30 / 1 h 36 |
| Old salt | 120 → 259 (2.2×) | 65 % | 40 / 44 / 47 / 59 | 2 h 30 / 1 h 37 |

Minutes of sailing each sea's three quests take, relaxed (sharp): ring arcs 34 (23), south 36–41 (17–26), west 26–31 (20–23), north 16–21 (11–12), east 26–30 (15–20).

Every ring check still passes, on the ring and on the grown sea (19/19). The story checks pass 9/9.

## Consequences

- **How long the game is:** a captain who plays the story as soon as it opens founds the last outpost about 1 h 15 to 1 h 40 in (sharp), or 2 h 10 to 2 h 30 in (relaxed), after the tutorial. That is a floor. The bots sail each quest back to back and never explore, wait or get lost. The playtest (review gap 4) will show how far real play is above it.
- A new quest, or a changed one, moves the story run by itself. A quest's gold and its step places are balanced from its file.
- `npm run balance` takes about 2 minutes, up from 1 (the story run is 30 four-hour voyages).
- If Guillaume keeps Port towns as the only buyers, point 4 goes back to level 4 and the late-game checks fail until town growth or the gate changes, and the ring's pace changes with it.
