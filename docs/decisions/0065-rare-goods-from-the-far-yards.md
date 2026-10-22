# 0065. Rare goods: first from the far yards, then from outer islands

**Status:** Accepted, 2026-10-22 (source and phasing). Guillaume asked for a combination of the far yards and new outer islands, with the yards now and the outer islands in Phase 4. Details still open: how rare goods tie to port town, and catch-up orders (see the [review](../reviews/town-growth/README.md)).

## Context

Phase 2 of the [roadmap](../roadmap.md) wants higher levels to unlock demand for "goods produced only on distant islands". The [town growth review](../reviews/town-growth/README.md) found that a port town (level 4, [0059](0059-settlement-levels.md)) gives nothing new, and that the two hidden shipyards, Watchman Key and Abbey Head ([0048](0048-ship-unlocks-home-port-and-yards.md)), never grow because they make nothing and only buy. Three sources were compared: the far yards (A), new outer islands past the map edge (B), and a visiting trader ship (C).

## Decision

**A combination, in two steps.**

1. **Phase 2: the far yards make the first rare goods.** Abbey Head and Watchman Key each start making one rare good once they grow to a village (placeholders: honey at Abbey Head, lamp oil at Watchman Key). You have to find a yard and feed it before it makes anything.
2. **Phase 4: outer islands make a rarer second set.** New islands past today's map edge, one upwind and one downwind (placeholders: spice, dye), come with Phase 4's bigger explorable map. Only port towns want them, so each step up asks for a longer voyage.

**Shared rules for rare goods:**
- Base price about 50 to 60 gold, above the town specialties ([0063](0063-specialized-town-goods.md)).
- Wanted only by ports on the far side of the map from the maker, so every delivery is one of the longest legs. Orders already pay more by haul distance ([0028](0028-delivery-contracts.md)).
- Small stock where made, like a workshop (40 % of a bulk producer's).
- Each charted port starts wanting one rare good from town level.

A visiting trader (C) was rejected: no islands, nothing to sail for.

## Consequences

- The yards get a reason to grow and to be visited after buying a ship there.
- Level 4 gains a purpose; whether rare goods are a gate to port town or a growth bonus is still to decide.
- Phase 4 inherits the outer islands and the second set of rare goods with the same rules.
- Option map: [far-goods-options.png](../reviews/town-growth/far-goods-options.png).
