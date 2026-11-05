# 0288. Cross-sea asks in standing orders

**Status:** Accepted (2026-11-05). Issue #360, v1.6. Rulings and lines by the v1.6 storyteller.

## Context

The far goods (0146) are made and sold, but no person ever asks for one from another sea, and the
four settlers asked for timber three times. Standing orders (0214) only allowed a good the port
buys, so "Sigrun wants Juno's tea" could not be written.

## Decision

- Each far keeper's standing order gets a 4th ask for a far good from the next sea, closing a loop
  south > north > east > west > south: Sigrun spiced tea x2 at Rimewick, Elias cloudberries x5 at
  Fogwatch, Bram amber beads x2 at Emberhold, Juno obsidian mirrors x2 at Sunreach. As a step of
  the same order, the keeper's own raw asks keep cycling.
- The standing-order check allows a good the port buys at some level once a port makes it, or a
  far good made at another port. A ring good the port never buys is still refused.
- Settlers keep ask-1 timber; ask-2 is planks x5 and ask-3 bread x5, tied to what the place is for.
- Pay stays the help-order rule (haul distance), so a crafted ask pays about 750-1050 g (raw asks pay 270-360 g). No trade
  automation (0120): the captain buys and carries the goods.

## Consequences

- Balance bots never buy for an ask, so they stall on the 4th ask; balance on all three levels is
  unchanged (story run 9/9, standing share 5 %). Lower the qty if playtests find it too rich.
- All words are data (`quest.standing-<person>.ask-N.*`, EN + FR).
