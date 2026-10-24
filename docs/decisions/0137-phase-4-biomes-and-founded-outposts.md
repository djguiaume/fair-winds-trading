# 0137. Phase 4: biomes around the ring and outposts you found

**Status:** Accepted scope, 2026-10-24 (Guillaume). Nothing implemented; names, goods and numbers are placeholders. Review: [Phase 4 scope](../reviews/phase-4-scope/README.md).

## Context

Phase 4, "Expansion and harder seas", was written when the base game was meant to end in automated fleets. Since then automated transport and steam were deferred ([0097](0097-progression-candidates-and-later-extensions.md)), the base game became community arcs that build your home island ([0120](0120-communities-and-home-island.md)), and the engine became ready for a sea 5 times the area ([0115](0115-bigger-map-engine-rules.md)). The [scope review](../reviews/phase-4-scope/README.md) checked the phase's six items against that. Guillaume answered its questions and proposed growing the map as biomes.

## Decision

1. **One big sea; the ring stays the centre.** Today's Windward Ring stays as it is, so the four arcs and the epilogue keep working. The 5x sea grows outward from it, and the new waters start uncharted (fog of war). Fog lifts per island or named sea area, not per pixel, so the save link stays under 1000 characters ([0118](0118-compact-save-code.md)).
2. **Four biomes, one per side:**

   | Side | Biome | Sailing challenge |
   |---|---|---|
   | North | Ice | Ice island, drifting icebergs (moving hazards), cold gales |
   | South | Tropical | Sand reefs, shallows, palms, a steady trade-wind belt with doldrums |
   | West | Fire | Volcano island, ash clouds that cut visibility, warm currents |
   | East | Fog and storm coast | Fog banks, cliffs, strong currents, frequent storms; the expedition's storm belt can start here later |

3. **Each biome has an inhabited main port and a site to found an outpost.** The main port is a settlement like today's ports, with its own people, trade and levels. The outpost is a **settlement you found**: you bring settlers and building goods (timber, planks, stone, food), and it grows with the existing town levels and wants ([0059](0059-settlement-levels.md)). Its build spots ([0128](0128-build-spots-on-any-island.md)) give repairs, storage and a sheltered harbour, so long voyages happen in stages. This replaces "ports you found as relay hubs". Voyages stay manual, with no automation ([0097](0097-progression-candidates-and-later-extensions.md)).
4. **The second set of rare goods comes from the biomes.** It replaces the "one upwind, one downwind" outer islands of [0065](0065-rare-goods-from-the-far-yards.md), with the same rule that only port towns want them. Placeholders: furs or whale oil (ice), spice (tropical), sulphur or obsidian (fire), east open.
5. **Story in the new waters: probably yes.** Founding an outpost and meeting each biome's main port are good arc material. The storyteller brief ([0129](0129-storyteller-brief.md)) decides their size later.
6. **Winds and currents become authored, per biome.** Wind zones (trade belt, doldrums, stormy coast) and currents are map data, edited in `editor.html`, with their numbers in tuning ([0093](0093-data-driven-content-and-authoring-tools.md)). The wind stays a pure function of seed, time and place, so nothing is added to the save.
7. **Shallows hard-block deep ships.** A shallow passage refuses a ship above its draft, and the chart marks the drafts that fit. Plain shallows elsewhere keep today's slow-down by draft ([0032](0032-reef-strikes-and-shallows.md)).
8. **Later, not in Phase 4:** seeded procedural maps (a possible sandbox "free sea" under Selectable maps) and seasonal winds.

## Consequences

- New code is needed once each for drifting icebergs, ash and fog visibility, currents, hard-blocking shallows, the biome looks (ice, palms, lava, cliffs) and founding a settlement. Everything else is data: map, island files, goods, buildings, quests and tuning.
- The pirates (Phase 5), steam and the expedition extensions get natural places: coves and passages, outposts as bases, and the east storm coast. Phase 4 does not build any of them.
- The old-tablet test is repeated on the real 5x map once it is authored (0115 measured only the stress sea).
- Next preparations, as docs and static mockups only until v0.3.x is released: the 5x layout with the four biomes, a winds and currents design, fog of war chart mockups, and a far goods economy pass.
