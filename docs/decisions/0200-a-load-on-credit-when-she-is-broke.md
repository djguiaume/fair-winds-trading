# 0200. A load on credit when she is broke

**Status:** Accepted (2026-10-25). Guillaume picked "credit load + warning" on the head storyteller's advice. Follows [0028](0028-delivery-contracts.md) (orders), [0032](0032-reef-strikes-and-shallows.md) (repairs) and [0048](0048-ship-unlocks-home-port-and-yards.md) (upgrades and ships).

## Context

A player got stuck. He upgraded his boat, repaired the hull, and was left with 0 gold and an empty hold. Every sale in the game starts with a purchase, so nothing could earn him money again, and the voyage was over. Guillaume asked what would prevent that: a free resource to sell somewhere else, free money, or something else.

The head storyteller weighed four options:

- **(A)** A load on credit.
- **(B)** Free salvage at Skerry. This was rejected: it means a long sail when she is broke, and it invites farming. It stays a possible flavour idea for later.
- **(C)** A one-off purse from a character. This was rejected: it is a hand-out, and it only helps once.
- **(D)** A warning before she spends her last gold.

The storyteller picked A plus D.

## Decision

1. **A load on credit (`src/sim/credit.ts`).**
   - **When it's offered:** the harbour office of the port she is docked in offers her a load when her hold is empty, she owes nothing, and she has less gold than the cheapest load there. The cheapest load is `economy.credit.loadUnits` units of the port's cheapest good in stock (4).
   - **What the load is for:** an open order at a charted port, for a good this port sells, that pays more than the load costs here. Where there are several, it is the one with the best gain per (distance + `economy.credit.sailBias`). Its size is the order's, or whatever the hold and the stock allow.
   - **The card:** it sits on the Market tab's side, above the port's order. It is a plain port card with no person on it (Rook's lines stay his own). The two buttons are "Take the load" and "Not now". "Not now" hides the card until she docks again.
   - **Paying it back:** there is no interest and no deadline, and she can only have one loan at a time. The loan is settled when she sells the lent good at the order's port, delivers there, or docks there with none of the good left. The harbour office then takes what she owes, or whatever she has if that is less, and the loan is cleared, so nothing can fail.
   - **Saving:** the loan is kept in the save (`loan`) and in the FW2 save code (section 14).
2. **A warning before she spends herself short.** The port screen asks "This leaves you N gold, less than the cheapest load here. Go ahead?" before a repair, an upgrade or a ship purchase that would leave her with an empty hold and less than the cheapest load. It uses the in-game yes/no dialog (0183), which the game controller can reach. There is no warning when moored at home, because there is no market there, and the credit offer at the next port covers that case.
3. **The text** is the storyteller's, in English and French, in `src/i18n/*.json` (`trade.credit*`, `trade.short*`). The numbers are data (`economy.json` › `credit`), editable in `?tune`.

## Consequences

- No voyage can end at 0 gold any more. Every ring port that sells goods can lend on every level (test `tests/credit.test.ts`), because each port posts an order for a good that some nearby port makes.
- She cannot borrow her way to profit faster than trading. The load only covers the order, it costs the market price, and it is only offered while she is broke with an empty hold.
- The balance bots never go broke, so `npm run balance` is unchanged.
- Screenshots: [docs/reviews/credit-load](../reviews/credit-load/README.md).
