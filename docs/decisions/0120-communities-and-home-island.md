# 0120. Base progression: community arcs that build your home island; expedition as an extension

**Status:** Accepted direction, 2026-10-23 (Guillaume). Nothing implemented; numbers below are examples, not tuning.

## Context

[0097](0097-progression-candidates-and-later-extensions.md) kept three candidate directions open: (A) your own harbour island, (B) connecting the communities, (C) a great expedition. The [mockups](../reviews/progression/directions/README.md) gave each a concrete session, play time, effort and data files. Guillaume leaned towards the harbour island but was unsure the island builder could be used on a phone, and saw that the expedition needs a lot of level design and story.

## Decision

1. **The base game merges B and A, each shorter.** The people's arcs (B) are the spine; your home island (A) is where their rewards show. About 4 arcs of about 3 steps each, and about 6 buildings, for a first version.
2. **An arc's result grows both islands.** The port you helped changes visibly (a specific building, a new good, a step up), and you get to add a building on your island. Because deliveries already grow towns, an arc's reward is a specific change, not extra growth on top for the same cargo.
3. **Each reward is a choice between two buildings**, each with its own small modifiers (for example a workshop making repairs at home cheaper, or a rigging loft making sail upgrades cheaper). The two are sidegrades, not better and worse; modifiers stay small so seamanship matters more.
4. **For now, the building not chosen comes back later at a higher price.** Guillaume is not fully sold on this rule: it is provisional and will be reviewed with the prototype.
5. **Fixed build spots on the home island.** Tap a spot, pick one of the two buildings. No free grid placement or terrain editing in the first version; it is much simpler on touch and cheaper to build. The developer island builder (`editor.html`, [0096](0096-island-files-and-island-builder.md)) stays an authoring tool; its island file format, props, drawing per level and placement checks are reused.
6. **The expedition (C) becomes a later extension**, alongside steam/logistics and pirates in the [extensions plan](../reviews/progression/extensions.md). It fits the bigger map's new waters and can use the home island as its base and the arcs' people as allies. Extension order stays open.
7. **Born as data** ([0093](0093-data-driven-content-and-authoring-tools.md)): arcs and steps in the quest format of [0113](0113-levels-tutorial-and-music-as-data.md) (`src/data/quests/`); people in `src/data/characters.json`; buildings, their two-way choices, costs and modifiers in `src/data/buildings.json`; build spots in the home island's file; reward scales and the "comes back later" price factor in a tuning file. Text in `en.json` / `fr.json`.
8. Everything in 0097 still holds: no progress while closed or paused, old voyages and transfers keep working, steam/automation and pirates stay later.

## Consequences

- First work is the quest engine (many saved quests, start conditions, choices, rewards), since the whole direction rests on it; then the build-spot UI and the first arc as a narrow prototype behind a flag, checked against the comparison's play questions.
- Rough size, a guess: 9 to 12 PRs for engine, home island and the first arcs.
- Open: the "comes back later" rule (4), which island is home (the mockups used a bigger test Lantern Rock), the arcs' story and characters, and how the arcs fit the 5x map.
