# 0018. Preview Phase 1 maps before implementation; plan selectable unlocked maps

**Status:** Accepted scope, 2026-10-19; layout selected in [0019](0019-staggered-passages-first-map.md); exact unlock requirements pending.

**Context:** Guillaume requested two to four top-down map image proposals before choosing one to implement, and multiple selectable/unlockable maps, potentially tied to experience levels. The roadmap previously covered one handmade MVP map and later seeded generation, but not a map selector or cross-map unlock progression.

**Decision:** Prepare two proposals preserving the four current main islands exactly (appearance, size and positions), adding strategic small islands, sandbanks, corridors or crescents, and retaining substantial open ocean for faster boats and later combat. Port production roles remain open. This reflects Guillaume's latest scope clarification. Do not choose or implement a replacement map until Guillaume selects a proposal. Keep Phase 1 focused on one handmade archipelago. Schedule additional handmade maps, selection and persistent captain unlocks after the initial trading loop, with XP versus milestones left open. Details are in [the proposal brief](../maps/phase1-proposals.md) and [roadmap](../roadmap.md).

**Consequences:** The current runtime map and saves stay intact during review. Other Phase 1 work can continue independently because this change only touches documentation. Implementation will need measured sailing checks and explicit map/save identity handling. A persistent captain profile must be independent from each map's voyage. Seeded generation remains a later Phase 4 feature; unlocked maps remain sandbox worlds rather than a scripted campaign.

**Clarification:** Guillaume explicitly confirmed that port roles and map layout were not decided. This record supersedes any inference of final map/port approval from the prototype or 0015. Final previews use current names to identify existing main islands, without approving production roles. The current prototype wind is shown for route discussion only. Earlier generated exploratory images are superseded by the two reproducible geometry-based proposals.
