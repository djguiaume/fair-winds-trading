# 0029. One main production per port

**Status:** Accepted by Guillaume, 2026-10-19.

**Context:** [0015](0015-trade-economy.md) and [0019](0019-staggered-passages-first-map.md) left the port roles provisional. Guillaume confirmed each port should have a main production.

**Decision:** Every port has exactly one main good it produces (cheap and plentiful there) and wants some others. For the current map: Port Calda timber, Saltmere fish, Westholm grain, Stonehaven stone. The island's look follows that good ([0016](0016-game-models-style-d-and-b2.md)). If the map rework moves ports, each new port still gets one main production; which good goes where is part of that layout work.

**Consequences:** Contracts ([0028](0028-delivery-contracts.md)) and haul distances build on it. Phase 2 production chains (timber → planks) add secondary goods at higher settlement levels rather than more raw goods per port.
