# 0126. The home island: Skerry, six build spots, eight buildings

**Status:** Implemented for review (2026-10-23). Guillaume picked **Skerry** from the [home island mockups](../reviews/home-island/README.md) (decision card, 2026-10-23). Builds the home island of [0120](0120-communities-and-home-island.md) for the arcs of [0122](0122-community-arcs-story.md), on the quest engine of [0125](0125-quest-engine.md).

## Context

0120 makes the community arcs build up the captain's own island: each arc offers a fixed build spot and a choice of two buildings with small modifiers; the building not chosen can come back later at a higher price (provisional). The arcs doc ([community arcs](../story/community-arcs.md)) has 6 spots and 8 buildings in 4 pairs. The mockups asked which island, where the spots go, and how choosing works on a phone ("tap a spot"). Guillaume chose Skerry, the scenery island between the four ports.

## Decision

1. **Skerry is the home island.** The map file names it (`"homeIsland": "skerry"`), and its island file (`src/data/islands/skerry.json`) grows to radius 18 with a pier facing south (`harbourBearing` π, as drawn). It has no port, no market and no town levels: docking there reuses the port distance with a stand-in harbour, and the pier is solid like any other.
2. **Spots are data in the island file** (`homeSpots`: id, x, z, optional y, and `pair` for an arc spot). Four arc spots (pairs `crafts`, `stores`, `watch`, `waterside`) and two spare spots. Each building is drawn by props tagged `home:<building>` at its arc spot; on a spare spot the same props move by the offset between the two spots. Run-down props (an old cabin, ruins, a lumber pile) are tagged `home-empty:<spot>` and go when that spot is built. The island builder edits them as plain props.
3. **Buildings are data** (`src/data/buildings.json`): id, pair, price (1,500 gold) and one effect. The later price factor is tuning (`economy.json` › `home.laterPriceFactor`, 1.5, in the `?tune` panel). The eight, with placeholder names:

   | Pair | Building | Effect |
   |---|---|---|
   | crafts | Workshop | hull repairs at home cost 25 % less than in port |
   | crafts | Rigging loft | sail upgrades cost 10 % less |
   | stores | Warehouse | keep 10 crates at home between voyages (**coming soon**) |
   | stores | Bakehouse | help orders pay 10 % more |
   | watch | Lookout | hidden islands are found 30 % farther off |
   | watch | Pilot house | 20 % less damage from reefs and shores |
   | waterside | Weather glass | wind forecast 60 s ahead (**coming soon**) |
   | waterside | Boathouse | new ships cost 10 % less |

4. **Rules** (`src/sim/home.ts`): an arc spot is built only after an arc offers it, and its pair is **free** (the arc's reward). A building passed over can be built on a spare spot for its price × the later factor. One of each building. The modifiers are read where the numbers are used (repairs, upgrade and ship prices, help orders, discovery range, hull damage), so nothing else changes until something is built.
5. **Tap a spot** (`src/ui/homePanel.ts`): moored at home, the camera centres the island and each spot shows as a round marker over it: a glowing **+** for an offered spot (with "Tap to build" on the first), a dashed **+** for a spare with something to build, a number for a locked one. Tapping opens a card with the two buildings side by side (landscape) or as a bottom sheet (portrait); Build puts it up at once, with a toast and an autosave. With a workshop, a Repair button sits beside the island's name. The sea HUD stays: raising the sails leaves, as in any harbour.
6. **Quest hooks** (in the 0125 library): rewards `"homeIsland": true` (the prologue gives the island) and `"homeSpot": ["spot-2"]` (an arc offers its spot); condition `{ "is": "built", "building": "bakehouse" }`, so a port or a later step can follow the choice. The choice of two is made **on the island**, not in a quest `choose` step; the check refuses unknown spots and buildings and a home reward on a map without a home island.
7. **Saves.** The JSON save gains `home` (owned, offered, built), checked against the map on load; older saves have none. FW2 gains a trailing home section, written only once the island is the captain's: a section number, a fingerprint of the spots and buildings, the offered flags and one number per spot. Codes without it read as before; a code whose spots or buildings differ is refused ("made by a different version"). Measured on the 30-port sea with quests under way: **693 characters**, 7 more than without the island.
8. **`?home`** gives the island to the voyage being played and offers every arc spot, for testing, until the prologue quest exists.

## Consequences

- With no `?home` and no quest giving it, nothing changes in play: Skerry is a bigger scenery island with a pier.
- `tests/home.test.ts` covers the build rules, free and later prices, the modifiers, the JSON save, the save code (old codes still read) and how props show per state; `tests/save-transfer.test.ts` keeps the link budget with quests and home together.
- Screenshots of the built flow on a phone (landscape and portrait) and on a desktop: [reviews/home-island/README.md](../reviews/home-island/README.md#built-2026-10-23).
- Follow-ups: the warehouse's storage and the weather glass's forecast (both marked "coming soon"); a picture of each building on the card; the prologue and arc quests that pay these rewards once their stories are written as quest files.
- The island builder shows every building of every spot at once (all tagged props); a preview per state can come with the builder's tag filter.
- Renaming a spot or building id resets it in old saves and changes the FW2 fingerprint.
