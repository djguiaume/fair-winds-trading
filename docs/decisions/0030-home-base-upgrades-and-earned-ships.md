# 0030. Home-base upgrades and earned ships

**Status:** Accepted by Guillaume, 2026-10-19 (direction; implementation waits for the map rework).

**Context:** Every port currently has a full shipyard ([0015](0015-trade-economy.md)): any upgrade and any ship can be bought anywhere with gold. Guillaume wants upgrades tied to one port and new ships to feel earned through adventure and discovery, not gold alone.

**Decision:**

- **Upgrades** (sails, hold, hull) are done only at the player's **home-base port**. Other ports trade but have no shipyard.
- **New ship classes** are each built by one shipwright at a specific port. To buy a class you must (1) **discover** that port, typically a distant or locked port such as those in the map rework, and (2) **earn standing** there by completing a few delivery contracts ([0028](0028-delivery-contracts.md)). Gold still pays the price.
- Owned ships can be switched at the home base.

**Consequences:** Exploration and contracts feed progression directly; the shop no longer gives everything up front. Open details for the implementation: which port is the home base (likely the one nearest the start), whether it can be moved later, how many deliveries unlock a class, and which port builds which class (cutter close by, larger classes farther out). The cutter stays buyable in Phase 1 so the "done when" goal still holds; the shipyard UI and the save need a discovered-ports list and per-port standing.
