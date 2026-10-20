# 0046. Phase 1 economy tuning: wider margins, cheaper first upgrades, leaner orders that grow with the hold

**Status:** Implementation for review, 2026-10-20. Guillaume asked to start the Phase 1 economy tuning (prices, delivery orders, repair and upgrade costs).

**Context:** The trade numbers from [0015](0015-trade-economy.md) were set on the Phase 0 map with a guessed 60 s leg. Since then the Windward Ring map ([0031](0031-windward-ring-map.md)), delivery orders ([0028](0028-delivery-contracts.md)), shifting wind ([0026](0026-slow-weather-shifts.md)) and crash damage ([0032](0032-reef-strikes-and-shallows.md), [0038](0038-hull-damage-from-any-crash.md)) landed, and the old balance test no longer described the real game. Phase 1 is done when "you can earn enough to buy upgrades and the cutter, and feel the difference", inside short sandbox sessions ([0009](0009-sandbox-short-sessions.md)).

A new balance test simulates 40 minutes of play on the Windward Ring with leg times taken from the ship polars over the shifting wind's range (legs are 45–100 s for the sloop). Two captains: a **sharp** one who always takes the best paying load, and a **relaxed** one who sails 40 % slower, often settles for the second or third best load and hits something on one leg in five. With the old numbers:

- the sharp captain got the cutter at 18 min, the relaxed one at 36 min, and without orders the relaxed one never got there in 40 min;
- delivery orders were half of all income and grew richer than everything else on long hauls (7 stone to Port Calda paid 385 gold, 2.4× the market);
- orders stayed at 4–8 units, so they became a footnote once the hold grew;
- repairs were about 1 % of income: crashes cost almost nothing.

**Decision:**

- **Margins:** a port that wants a good keeps less of it (equilibrium stock 15 → 12) and the port's cut drops from 8 % to 6 %. First-unit sale prices where wanted: fish 14, grain 18, timber 25, stone 33 (were 12 / 15 / 21 / 27); prices where made are unchanged.
- **Start gold** 120 → 150, enough for a full sloop hold of any produced good.
- **Upgrades:** sloop 300 / 900 per track (was 400 / 1 200), cutter 500 / 1 800 (was 600 / 1 800). The first upgrade comes after 3–4 legs and is felt early; the cutter's top level stays a long-run goal. The cutter's own price (1 500) is unchanged and belongs to the ship unlock work ([0030](0030-home-base-upgrades-and-earned-ships.md)).
- **Delivery orders:** reward = units × base price × (1.5 + haul / 700), was (1.75 + haul / 500): still well above the market (1.3–1.6× a sale of the same goods) but long hauls no longer dwarf trading. Order size now follows the hold of the ship sailed when the order is posted: 4–8 units up to a hold of about 13, then up to 60 % of the hold (cutter with a level 3 hold: 11–21 units). Orders already posted keep their size.
- **Repairs** 1.5 → 2 gold per hull point: a 6 kn reef strike costs 72 gold, about a third of an early leg's profit.

**Consequences:** With the new numbers the sharp captain buys the first upgrade at 3.7 min, the cutter at 12.7 min and finishes the cutter's upgrades at 34 min; trading without orders gets the cutter at 19 min; the relaxed captain gets the cutter at about 18 min and pays about 5 % of income in repairs. Orders are 30–65 % of income. `tests/economy-balance.test.ts` checks these targets (first upgrade ≤ 5 min, cutter 9–16 min sharp and ≤ 32 min relaxed, maxed cutter ≥ 25 min, no route above 30 % of legs, repairs under 10 % of income) and replaces the Phase 0 shuttle test in `tests/economy.test.ts`. Ship classes added by the unlock work should extend the simulated shopping list. Saves are unaffected (no schema change). Numbers and the tuning table are in [economy.md](../economy.md).

**Validation:** `npm test` (balance simulation, contract sizing, repair price), `npm run lint`, `tsc --noEmit`.
