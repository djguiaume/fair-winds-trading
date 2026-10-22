# 0065. Rare goods: first from the far yards, then from outer islands

**Status:** Accepted, 2026-10-22; Phase 2 part implemented for review. Guillaume asked for a combination of the far yards and new outer islands, with the yards now and the outer islands in Phase 4, and chose a gate: a town needs its rare good to become a port town. Catch-up "help" orders from the [review](../reviews/town-growth/README.md) are a separate, still open question.

## Context

Phase 2 of the [roadmap](../roadmap.md) wants higher levels to unlock demand for "goods produced only on distant islands". The [town growth review](../reviews/town-growth/README.md) found that a port town (level 4, [0059](0059-settlement-levels.md)) gives nothing new, and that the two hidden shipyards, Watchman Key and Abbey Head ([0048](0048-ship-unlocks-home-port-and-yards.md)), never grow because they make nothing and only buy. Three sources were compared: the far yards (A), new outer islands past the map edge (B), and a visiting trader ship (C).

## Decision

**A combination, in two steps.**

1. **Phase 2: the far yards make the first rare goods.** Abbey Head and Watchman Key each start making one rare good once they grow to a village (placeholders: honey at Abbey Head, lamp oil at Watchman Key). You have to find a yard and feed it before it makes anything.
2. **Phase 4: outer islands make a rarer second set.** New islands past today's map edge, one upwind and one downwind (placeholders: spice, dye), come with Phase 4's bigger explorable map. Only port towns want them, so each step up asks for a longer voyage.

**Shared rules for rare goods:**
- Above the town specialties in price ([0063](0063-specialized-town-goods.md)): honey 55, lamp oil 50.
- Wanted only by the two charted ports on the far side of the map from the maker, so every delivery is one of the longest legs (590 to 680 units, about twice a normal leg). Orders already pay more by haul distance ([0028](0028-delivery-contracts.md)).

| Rare good | Made at (from village) | Bought by |
|---|---|---|
| Honey (miel) | Abbey Head | Saltmere, Stonehaven |
| Lamp oil (huile de lampe) | Watchman Key | Port Calda, Westholm |

- Buyers open as soon as the yard makes the good, whatever their size (map `wantsMade`, like specialties). The review proposed "from town level", but then a player could buy honey nobody takes yet; opening at once avoids dead cargo, and the gate below still ties rare goods to growing big.
- The yard keeps 70 % of a bulk producer's stock (`RARE_SHARE`), more than a workshop's 40 %, so honey costs about 30 at the yard and sells for about 100 across the map: the long crossing pays.

**The port town gate.** A town that buys a rare good becomes a port town only once it has received 20 units of it, sold or delivered (`RARE_FOR_PORT_TOWN`). Until then it waits at full growth. The port screen's size tag counts them ("Town · 100% · 12/20 🍯") and its tooltip names the yard once discovered ("from a far island" before). The yards themselves have no gate.

**Screens.** A yard that starts making its good gets its own toast ("Abbey Head has grown: it now makes Honey, wanted across the sea!"); the yard's header shows "Makes" next to "Shipwright"; honey and lamp oil have colour icons in the HUD sprite. Everything in English and French. Code: `RARE_GOODS`, `isRare`, `isMadeGood` in `src/sim/goods.ts`; `addRare`, `rareWants`, `portTownGate` in `src/sim/settlement.ts`. Saves stay version 1: the count is an optional field.

A visiting trader (C) was rejected: no islands, nothing to sail for.

## Consequences

- The yards get a reason to grow and to be visited after buying a ship there. Saltmere, Abbey Head's natural partner (fish out, honey back), gets a reason to be fed, which helps the home port gate of [0059](0059-settlement-levels.md).
- Level 4 is now earned with a long voyage. A captain who never finds or grows a yard keeps towns at level 3.
- The 40-minute balance targets are unchanged (the first session never reaches a yard's village). In a 3-hour simulation that includes the yards, a relaxed captain who grew Abbey Head earned about 67,000 gold against 47,000 before, mostly from the honey run; the sharp, greedy bot rarely bothers with the long legs. The honey margin may need tuning after play.
- Screenshots: [docs/screenshots/rare-goods](../screenshots/rare-goods/) (`node docs/screenshots/rare-goods/capture.cjs`).
- Phase 4 inherits the outer islands and the second set of rare goods with the same rules.
- Option map: [far-goods-options.png](../reviews/town-growth/far-goods-options.png).
