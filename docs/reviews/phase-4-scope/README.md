# Phase 4 scope review (2026-10-24)

**Status:** Answered; decided in [0137](../../decisions/0137-phase-4-biomes-and-founded-outposts.md). Guillaume asked what in Phase 4 can be analysed, brainstormed or reviewed while Phase 3 finishes. He then picked this scope review as the first step. The answers to the questions at the end will become an ADR and a roadmap update.

**Read for this review:** the Phase 4 section of the [roadmap](../../roadmap.md) on main, plus [0097](../../decisions/0097-progression-candidates-and-later-extensions.md) (automation deferred), [0120](../../decisions/0120-communities-and-home-island.md) (community arcs and the home island), [0065](../../decisions/0065-rare-goods-from-the-far-yards.md) (outer islands), [0018](../../decisions/0018-map-proposals-and-unlocks.md) (selectable maps, seeded maps), [0064](../../decisions/0064-wind-from-every-quarter.md) (regional wind), [0115](../../decisions/0115-bigger-map-engine-rules.md) (5x map engine rules), [0128](../../decisions/0128-build-spots-on-any-island.md) (build spots on any island) and the [extensions plan](../progression/extensions.md). The code was checked with graphify (`graphify update .`, then `graphify explain`).

## Why the phase needs a review

Phase 4 was written when the base game was meant to end in automated fleets. Since then:

- Automated transport and steam are deferred to a later extension ([0097](../../decisions/0097-progression-candidates-and-later-extensions.md)).
- The base game is now community arcs that build your home island ([0120](../../decisions/0120-communities-and-home-island.md)). Four arcs are live, set in today's Windward Ring.
- The great expedition is an extension that "fits the bigger map's new waters" ([0120](../../decisions/0120-communities-and-home-island.md) §6).
- The engine is ready for a map 5 times the area (sea radius about 985 instead of 440, legs about 2.2 times longer, [0115](../../decisions/0115-bigger-map-engine-rules.md)). The real map is not authored yet. The old-tablet test on `?map=stress` is part of finishing Phase 3.

Phase 4's goal still holds: "growth pushes you outward into tougher navigation." Two of its six items no longer fit as written.

## The six items, one by one

| # | Roadmap item | What exists today | Fit after 0097 / 0120 | Proposal |
|---|---|---|---|---|
| 1 | Larger explorable map with fog of war; discover new islands and settlements | Engine ready for 5x (0115). Ports are "discovered" by sailing near them, and the lookout building extends that range (`discoverNear`, `discoverRange`). Every island is drawn on the chart from the start; there is no fog. | Fits. It is the phase's backbone. | **Keep.** Today's Windward Ring stays the known centre, and the new waters around it start fogged. |
| 2 | Regional winds: trade-wind belts, doldrums, stormy zones, seasonal shifts | The wind already differs across the sea through two random seeded waves (0064). Storms cross the sea in lanes (0115). | Fits, and it suits the sailing-first audience. | **Keep zones and drop seasons for now.** Authored wind zones go in the map data, editable in `editor.html`. Seasons can come later. |
| 3 | Currents, reefs and shallows that block bigger ships | Reefs strike the hull and shallows slow a ship by its draft (`shallowDrag × draft`, 0032). There are no currents. | Fits, and it gives the small swift ships a reason to exist. | **Keep.** Currents are new. "Block" means a shallow passage that only small-draft ships can take. |
| 4 | Far exotic goods; outer islands upwind and downwind make a second rare set wanted only by port towns | The first rare set is built: honey and lamp oil from the far yards, plus the port-town gate (0065). | Fits. | **Keep as 0065 planned.** It becomes the economic reason to cross the new waters. |
| 5 | Ports you can found or upgrade (warehouses, shipyards) as relay hubs | Any island with `homeSpots` can be built on (0128). The warehouse is a home-island building (`homeStorage`), and the weather glass and the warehouse are being finished now. | **Does not fit as written.** A "relay hub" assumes automated ships moving goods between hubs, and that is deferred. | **Rework into outposts:** buildable islands in the new waters (0128) with a pier, storage, repairs and a lookout. They serve as resupply stops on long manual voyages. Later, steam launches and the expedition can use them as bases. |
| 6 | Seeded procedural maps, shareable | `MapDef` has a `seed`, and the format was kept "seed-ready" (0008). There is no generator. | **Poor fit.** The arcs are tied to handmade places (Teeth Rock, the East Reef gap, Skerry). A generated sea has no story. | **Move out of Phase 4.** Later it can become a sandbox "free sea" with no story, in the Selectable maps track, or be dropped. |

## Notes per item

### 1. Bigger map and fog of war

- **One big sea, or several maps?** The roadmap also has "Selectable maps and persistent unlocks" between Phases 2 and 4. With a 5x map and a story, one big sea with fogged outer waters does the job of "unlockable maps" inside one voyage. Recommendation: one sea for the story, and selectable maps only for later sandbox seas (including seeded ones, item 6).
- **Fog by area, not by pixel.** The save transfer link must stay under 1000 characters (0118; it is 694 today on the 30-port sea). A 32 × 32 fog grid alone adds about 170 characters. Fog that lifts per island or per named sea area (about 50 to 80 flags) costs about 15 characters and reads better on the chart ("the Outer Banks: uncharted").
- **What the fog hides:** islands, reefs and shallows of an uncharted area, with only the coastline guessed at its edge. Ports are already discovered by sailing near them, and the lookout keeps its role. Danger: a reef you cannot see on the chart must still be readable at sea (water colour, breakers).
- **Arcs on the bigger sea.** 0120 left "how the arcs fit the 5x map" open. If today's ring stays the centre unchanged, the four arcs keep working. That is a strong reason not to rearrange today's islands.
- **Performance:** the real map needs the old-tablet test again once authored. The stress sea already measured draw calls, collisions and storms at 5x (0115).

### 2. Regional winds

- Today's wind regions are random waves. Phase 4 would add **authored zones** on the map: a steady trade-wind belt (fast and reliable, good for haulers), doldrums (almost no wind, where the light swift ships do best), and a stormy zone (storms born there more often, which also suits the expedition's storm belt).
- Zones are data in the map file, painted in `editor.html`, with their numbers in tuning (0093). Each zone is one more local term in `windAt`. It stays a pure function of seed, time and place, so nothing is added to the save.
- **Seasons** change every route over a long voyage, and testing them takes long play. I suggest leaving them out of Phase 4 and revisiting after play-testing.
- **Readability:** the chart shows wind only through its compass today (0064). Zones probably need a chart layer, with a toggle like the storm legend (0070).

### 3. Currents and shallows

- **Currents** move the boat over the ground, so speed through the water differs from speed over the ground. For a sailing audience that is a real seamanship lesson: cross a strong current at an angle, or sail with it. Display options: a current arrow on the sea and the chart, plus "SOG / STW" knots in the HUD next to today's readouts (small, with a toggle, as Guillaume asked for sailing numbers).
- Currents could flow steadily or with a tide (a slow cycle). A tide adds timing choices but also complexity. I suggest steady currents first.
- **Shallows that block:** today they only slow you by your draft. A hard block (a deep-draft ship cannot enter) is clear, but it can trap a player. A strong slow-down plus hull damage keeps the passage possible but painful. Either way, the chart should mark the passage with the drafts that fit.
- Data: currents as lanes or areas in the map file, edited in the editor, with numbers in tuning.

### 4. Far goods

- 0065 placed two outer islands past today's map edge, one upwind and one downwind, making placeholder spice and dye that only port towns want. On a 5x sea those legs are about 2.2 times longer than today's longest.
- Questions: the goods themselves (placeholders), whether each outer island has its own small arc (a story reason to find it), and new balance targets for long voyages in `balance-targets.json`, checked with the panel's balance check (0114).

### 5. Outposts instead of relay hubs

- 0128 already makes any island with spots buildable, and docking works at any island you own. An outpost is an island file with `homeSpots` and a few buildings from `buildings.json`: storage, repairs, a lookout, and maybe a small chandlery that sells supplies.
- It turns long voyages into stages: claim a cove in the new waters, build a store, and use it to hold cargo for the next run. No ship moves cargo for you, in line with 0097. "No progress while closed" (0097 §5) holds.
- Later the steam extension can run its first launch from an outpost, and the expedition can use one as a forward base. That gives both extensions a home without doing their work now.
- **Wait for the warehouse** being built now, since it sets how storage works.

### 6. Seeded procedural maps

- A generator is a large piece of work: coasts, ports, goods and balance that hold for any seed. The arcs and the outer islands need handmade places.
- Recommendation: take it out of Phase 4. Keep the seed-ready format, and if it still appeals, list it as a later sandbox mode ("free sea from a seed") under Selectable maps.

## Fit with the planned extensions

| Extension | What Phase 4 should leave ready | What Phase 4 should not do |
|---|---|---|
| Great expedition | A stormy zone and an uncharted far region at the map's edge; outposts as forward bases | Build the destination or its story |
| Steam and harbour logistics | Outposts with storage; currents and doldrums, where steam would shine | Add fuel, launches or automation |
| Pirates (Phase 5) | Named passages and coves where sightings could happen; the hazard marker and Settings switch already exist | Add pirate ships or combat |

## What can start now without touching running work

The epilogue and the warehouse/weather-glass work touch quests, `buildings.json`, the home island and the text files. These preparations are docs and static mockups only:

1. This scope review and its ADR, once Guillaume answers.
2. Static chart mockups of the 5x layout: the ring in the centre, outer waters, outer islands, wind zones, currents, shallow passages and fog. They are drawn as images, without touching `phase1-map.json`.
3. A winds and currents design doc with HUD and chart mockups.
4. Fog of war chart mockups, landscape and portrait.
5. A far goods economy pass (doc and balance-check runs on a copy).

Outposts wait for the warehouse to land. Authoring the real map waits for v0.3.x.

## Answers so far (Guillaume, 2026-10-24)

1. **One big sea:** yes. Today's Windward Ring stays unchanged as the centre.
2. **Outposts:** OK, but he asked what they are for. Proposal below (founded settlements).
3. **Seeded maps:** later.
4. **Seasons:** later.
5. **Shallows:** hard block. A deep-draft ship cannot enter a shallow passage.
6. **Story in the new waters:** "maybe yes". The bigger map grows as **biomes** around the ring (below).

## Biomes around the ring (Guillaume's idea, 2026-10-24)

The 5x sea grows outward from the ring in four directions, each a biome with its own island, hazards and wind. Names and goods are placeholders.

| Side | Biome | Sailing challenge | Outpost island | Rare good (second set, 0065) |
|---|---|---|---|---|
| North | Ice | Drifting icebergs (moving hazards), cold gales | Ice island | Furs or whale oil |
| South | Tropical | Sand reefs, shallows that hard-block deep ships, steady trade-wind belt with doldrums | Palm island | Spice |
| West | Fire | Volcano island, ash clouds that cut visibility, warm currents | Volcano island | Sulphur or obsidian |
| East | Proposed: fog and storm coast (alternative: kelp and whale grounds) | Fog banks, cliffs, strong currents, frequent storms; where the expedition's storm belt could later start | Cliff island | Open |

This replaces 0065's "one upwind, one downwind" outer islands with one per biome. The wind zones (item 2) and currents (item 3) become per-biome data. New code is needed once each for drifting icebergs, ash or fog visibility, and the biome looks (ice, palms, lava), as for any new weather look (0108).

## Outposts as founded settlements (proposal)

Repairs and shelter alone are thin. Proposal: an outpost is a **new small settlement the player founds** on the biome's island.

- Bring settlers and building goods (timber, planks, stone, food). It grows with the existing town levels and wants (0059).
- Once big enough it makes the biome's rare good, which only the ring's port towns want.
- Its buildings (build spots, 0128) give repairs, storage and a sheltered harbour to wait out bad weather, so far voyages happen in stages.
- Founding it is a small arc of its own, which answers question 6.
- Manual voyages only, no automation (0097). Later the steam extension and the expedition can use it as a base.

## Questions for Guillaume

1. **One big sea:** keep today's Windward Ring unchanged as the centre and add fogged outer waters around it (recommended), or rearrange the whole map?
2. **Relay hubs → outposts:** replace "ports you found as relay hubs" with buildable outpost islands in the new waters, used on manual voyages (recommended)?
3. **Seeded maps:** move them out of Phase 4 into a later sandbox mode (recommended), keep them in Phase 4, or drop them?
4. **Seasons:** leave seasonal winds for later and do authored wind zones first (recommended)?
5. **Shallows:** should a passage hard-block deep ships, or slow and damage them so it stays possible?
6. **Story in the new waters:** should the outer islands get small arcs of their own (a story reason to explore), or stay trade-only until the expedition?

Final answers (2026-10-24 06:31Z): an outpost as a settlement you found, yes; the east is the fog and storm coast; and each biome also has an inhabited main island, besides the outpost site.
