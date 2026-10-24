# 0149. Building far goods: the goods, the workshop rule and the port town buyers

**Status:** Implemented (2026-10-24). Builds [0146](0146-far-goods-from-the-biome-outposts.md) (far goods, accepted). Guillaume asked for it to be built now (item 3 of the coordinator's list, "ok for 3, 4, 5"), with balance and leg times checked on all three difficulty levels, since the wind shifts a lot on Captain and Old salt.

## Context

0146 decided the far goods and left four pieces of code for Phase 4: the `far` kind, `levelWantsMade`, a workshop that crafts only from raw goods received, and markets that show goods only port towns buy. The seas themselves are not built yet (the south sea is being laid out in its own thread, ids `sunreach` and `palm-key` from the [storyteller brief](../story/storyteller-brief.md#phase-4-the-four-seas)), so everything here is data and sim, tested on the ring plus two test ports.

## Decision

1. **Eight goods in `goods.json`, kind `far`**, priced as in 0146: spice 20 → spiced tea 90, obsidian 22 → obsidian mirrors 100, cloudberries 25 → cloudberry jam 110, amber 28 → amber beads 120. A crafted far good names its raw good in `madeFrom`. Names in `src/i18n` (EN and FR, with the `goodThe` and `goodSome` forms of [0091](0091-translation-quality-pass.md)), with the storyteller's French names. They are added at the end of the list, so the trade lists keep their order.
2. **They trade only where made or wanted**, like specialties and rare goods (`isMadeGood`). On today's ring nobody makes them, so no market shows them.
3. **The outpost gathers like bulk.** A raw far good a port makes has the full produces stock (`producesEquilibrium`), as a ring town makes fish. A crafted far good stocks like a rare good (`rareShare`).
4. **No raw goods, no crafting.** A port whose workshop crafts a far good keeps a count of crafted units (`Market.workshop`). Each raw unit sold there or handed over for an order adds one; each unit bought takes one. You can buy no more than the count, so a workshop that never got raw goods sells nothing. The stock still drifts and sets the price as for any good, so the price you pay is the same as 0146's estimate and only the quantity follows the raw goods. Raw goods sold before the workshop opens (below town level) are only sold; main ports start as towns, so this does not arise in the planned seas.
5. **Ring port towns buy crafted goods through `levelWantsMade`** (new port field, keyed by level like `levelWants`): the town buys the good from that level on, once some port makes it. `phase1-map.json` lists them at level 4 now, as 0146 point 5: Port Calda spiced tea and obsidian mirrors, Saltmere obsidian mirrors and cloudberry jam, Westholm spiced tea and amber beads, Stonehaven cloudberry jam and amber beads.
6. **Outposts stop at town:** new port field `maxLevel` (default the top level). A port at its top level keeps its growth full and never levels up.
7. **Never for the gate:** far goods are not `rare`, so they never count toward the 0065 port town gate.
8. **A quest can change both new fields** (`levelWantsMade`, `maxLevel` join `afterQuest`, [0130](0130-after-a-quest-and-the-saltmere-shoals.md)), so the founding quest (`outpost-south`) can make the outpost start gathering with `afterQuest: { "outpost-south": { "levelProduces": { "2": ["spice"] } } }`, and the keeper's arc can change the main port the same way.
9. **Editor:** a port's panel has "Top level" and "Wants made at L2…L4" next to the other trade fields. The map checks know both fields; a far good wanted but made nowhere is not an error (the ring's port towns wait for seas a map may not have), while a good made with no buyer still is.
10. **Saves:** the JSON save has an optional `workshops` (port → crafted units). The FW2 code ([0118](0118-compact-save-code.md)) has a new optional section 11 for them. Adding goods changes the code's goods list, so a code made before this change is read with the old list (no far goods in it) instead of being refused.
11. **The level-up toast** for a main port opening its workshop uses the rare-good line (`toast.rareGood`: "now makes Spiced tea, wanted across the sea!").

## Balance on the three levels

`tests/far-goods.test.ts` prices each leg with the real market and that level's cut, and times it with the balance simulation's leg model in that level's wind (steady on Fair winds, shifting on Captain and Old salt). Maxed cutter, 30 units, south sea test sites:

| Leg | Fair winds | Captain | Old salt |
|---|---|---|---|
| Honey today, Abbey Head → Saltmere (for comparison) | 786 in 57 s | 668 in 60 s | 521 in 60 s |
| Honey out, Abbey Head → Sunreach | 936 in 88 s | 811 in 90 s | 656 in 90 s |
| Spice, Palm Key → Sunreach | 453 in 46 s | 415 in 48 s | 364 in 48 s |
| Spiced tea, Sunreach → Port Calda / Westholm | 2,120 in 111 / 73 s | 1,919 in 103 / 77 s | 1,660 in 103 / 77 s |
| One round (honey out, spice, tea home) | 3,509 | 3,145 | 2,680 |

The test holds on every level: every leg pays, the crafted leg pays more than twice today's honey run and more gold per second, and no leg takes three minutes. The numbers sit inside 0146's estimate (round 2,900 to 3,700 on Captain).

## Consequences

- The south sea thread fills Sunreach and Palm Key with these fields (Sunreach: `level: 3`, `wants: ["spice"]`, `wantsMade` honey and ring specialties, `levelProduces: { "3": ["spicedTea"] }`; Palm Key: `maxLevel: 3`, the spice from its founding quest). The other seas follow the same pattern with their goods.
- The balance bots (0114) don't sail the far seas yet; Phase 4 targets go into `balance-targets.json` with the real 5x map.
- Old save codes still read. New codes carry 8 more numbers per market, mostly zeros that compress away; the 1,000-character link test still passes.
