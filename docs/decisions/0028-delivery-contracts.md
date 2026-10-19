# 0028. Delivery contracts

**Status:** Implementation for review, 2026-10-19. Guillaume asked to go ahead with the recommended Phase 1 work.

**Context:** Phase 1 lists delivery contracts as the remaining piece of the trading loop. Free trading alone gives no reason to pick one trip over another beyond margins, and Phase 2 needs a measure of "goods delivered" to grow settlements.

**Decision:**

- Every port posts **one order** at a time for a good it wants: 4–8 units (fits a stock sloop), reward = units × base price × (1.75 + haul distance / 500), rounded to 5 gold. Haul distance is from the nearest other port that makes the good, so long hauls pay more. That is roughly ×1.2–1.5 what selling the same goods there would bring.
- No accepting, deadlines or penalties: the orders board is visible in every harbour's market tab (this port's order with a **Deliver** button, the other ports' orders as a short list marked "in hold" when you carry enough). Delivering takes the goods from the hold, pays the reward and does not touch the market stock (the town consumes them).
- After a delivery the port posts its next order after 90 seconds, so one port cannot be farmed back to back. Orders are deterministic from the map seed, port and count.
- Captain mode says "Delivery orders", Kids mode "Jobs" with good icons.
- Saved with the voyage as an optional `contracts` field; the save version stays 1. Older saves, unknown ports and damaged entries get fresh orders. `completed` counts deliveries for Phase 2 settlement growth.
- Code: `src/sim/contracts.ts`; UI in `src/ui/tradePanel.ts`.

**Consequences:** Gold comes in faster than with market trading alone, so the balance targets (first upgrade, cutter) need checking in the Phase 1 tuning pass; `CONTRACT_PRICE_FACTOR`, `CONTRACT_DISTANCE_SCALE`, `CONTRACT_QTY` and `CONTRACT_COOLDOWN` are the knobs. Not yet done: showing orders on the sea chart or port labels, and orders for goods a port does not already want (Phase 2 demands).

**Validation:** `tests/contracts.test.ts`: one fitting order per port, reward above market, all-or-nothing delivery, cooldown, save round trip, legacy saves, damaged saves, and the harbour UI in both modes.
