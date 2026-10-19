# 0019. Use strengthened Staggered passages as the first trading map

**Status:** Accepted by Guillaume, 2026-10-19; superseded by [0031](0031-windward-ring-map.md) (Windward Ring).

**Context:** Guillaume wanted meaningful route planning rather than a four-corner layout. The latest scope keeps the four current main islands as they are, adds smaller islands, sandbanks or corridors, and retains open ocean for speedy boats and later fighting. He accepted the recommendation to use strengthened proposal B and the associated progression direction.

**Decision:**

- Load the new `PHASE1_MAP` for normal play. Preserve every original island, seed and course reference; retain Phase 0 data unchanged. Use current main-branch B2 island and D boat art.
- Add two staggered polygon barriers and two permanently exposed sandbanks. Extend the southern hook eastward enough to make the open eastern bypass useful; move the southern bank away from Saltmere's docking ring. Narrow inner choices compete with longer routes with more turning/tacking room.
- Share exact polygon outlines between collision, merged terrain models and ocean shore shading. Sandbanks have ordinary shore collisions, without inventing depth, hull damage or cargo-loss rules.
- Explicitly migrate known prototype saves. Keep trading progress; respawn safely only if new land covers the old boat position. Do not load unrelated-map saves.
- Plan progression from learning short trades, through ship handling/upgrades and settlement-driven circuits, to later fleet route decisions. Later selectable maps should unlock through delivery/settlement milestones and add navigation complexity, rather than rewarding idle sailing XP. Exact unlock requirements and production assignments remain open.

**Consequences:**

- The smallest ships can use every port without an upgrade. Future larger ships and combat have room in the eastern sea. No fleet automation, combat, map-selection UI or unlock system is implemented in this change.
- Added geometry remains merged with the islands; the shore shader has a fixed 64-edge budget, checked at construction. Local device performance remains a play-test item.
- Validation covers unchanged original island models, docking/spawn clearance, concave collision corners, map-save migration, all directed port pairs over five winds, and a conservative four-port circuit using the real sloop model. Route costs are estimates; full trading balance still needs play-testing.
- Updated art landed on main during implementation and was merged into this branch before validation. Review image and reproduction instructions are in [the map brief](../maps/phase1-proposals.md).
