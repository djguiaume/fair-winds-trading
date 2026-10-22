# 0069. Help orders: a neglected town asks for help

**Status:** Implemented for review, 2026-10-22. Guillaume said yes to the "help requests" proposed in the [town growth review](../reviews/town-growth/README.md).

## Context

The [review](../reviews/town-growth/README.md) of settlement growth ([0059](0059-settlement-levels.md)) found three weak spots in a 3-hour simulation:

- The home port can be left behind. The sharp bot never grew Saltmere, so the cutter's level 3 upgrades never unlocked.
- Rich towns get richer. A bigger town pays more for what it wants, so trade flows to it and the others stay at zero growth.
- Orders fade late. They were 36 % of income at 40 minutes but 6 % at 3 hours.

## Decision

**One help order at a time.** The order of the town that most needs help becomes a *help order*:

- **Who asks.** The home port asks while one of the active ship's next upgrades waits for it to grow (a level 3 upgrade needs a town). Otherwise, the discovered port left longest without the goods it wants asks, once it has stalled (3 minutes). Port towns never ask, and the hidden yards ask only once found.
- **What it pays.** 1.5 times the order's reward (rounded to 5) and **double growth**: (units + 5) × 2 points.
- **Stays put.** It remains a help order until it is delivered, so cargo bought for it keeps its premium, even if another town falls further behind.
- **Pause.** After a help order is delivered, the next one waits at least 4 minutes. Until then no other order becomes a help order.

The first draft had double reward and no pause. In the simulation, the home port then asked again every 90 seconds and a sharp captain's income rose by half, so the reward and pause were tuned down.

**Screens.** A toast announces it ("Westholm needs help: 6 stone pays extra and grows it twice as fast"). The port screen marks the order "🆘 Help wanted · extra pay, double growth". The Orders tab and the chart's price notes mark it too. Everything is in English and French.

**Data.** `Contract.help` and `ContractState.helpIn` (the pause), both optional, so saves stay version 1. The code is `helpPortId`, `syncHelpOrder` and `HELP_*` in `src/sim/contracts.ts`. `stepTrade` emits `{ type: 'help-order', portId }`.

## Consequences

Measured with the balance simulation (`tests/economy-balance.test.ts`, which now posts help orders too):

| | Before | With help orders |
|---|---|---|
| Sharp captain, 40 min income | 13,200 | 12,500 |
| Sharp: Saltmere (home) becomes a town | never in 3 h | 24 min |
| Sharp: cutter fully upgraded | never in 3 h | 46 min |
| Sharp: orders' share of income at 3 h | 6 % | 27 % |
| Relaxed: Saltmere becomes a town | never in 3 h | 46 min |
| Relaxed: towns after 3 h | 3 (one port town) | all 4 charted ports |

- All Phase 1 targets (0046) still hold.
- Towns grow more evenly. A sharp captain still leaves one town at village level after 3 hours, so this is a nudge, not a rule.
- With the home port waiting, a help order sits at home for much of an early session. That is intended: it points the way to the top upgrades.
- Screenshot: [docs/screenshots/help-orders](../screenshots/help-orders/) (`node docs/screenshots/help-orders/capture.cjs`).
