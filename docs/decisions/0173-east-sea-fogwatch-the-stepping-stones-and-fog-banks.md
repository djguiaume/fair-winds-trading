# 0173. East sea: Fogwatch, the Stepping Stones and fog banks

**Status:** Accepted (2026-10-25): Guillaume validated the look ([review](../reviews/east-sea/README.md)).

## Context

Phase 4's east is the fog and storm coast ([0137](0137-phase-4-biomes-and-founded-outposts.md)): its main port Fogwatch (Maren's line, the amber workshop) and an outpost you found, Amber Strand ([0146](0146-far-goods-from-the-biome-outposts.md), [0147](0147-phase-4-story.md)). Guillaume asked for a foggy island in the spirit of the Faroes or Scotland, everything as data and editable in the editors. The fog itself is a wind-zone kind with haze ([0169](0169-haze-fog-banks-and-ash-clouds-as-wind-zone-kinds.md)); ground colours and island styles are data ([0168](0168-ground-materials-and-island-styles-as-data.md)); the storm belt is its own thread and keeps a band of the east for itself. The north sea keeps bearings 315° to 45°, the south starts at 100°.

## Decision

**Layout** (`src/data/seas/east.json`, laid out with `npm run sea`, steps in [sea-steps.json](../reviews/east-sea/sea-steps.json)):

- **The Stepping Stones**: seven reefs of dark basalt skerries in an arc about 520 from the centre, from 46° round to the south's Coral Line at 127°. One gateway, **Gannet Sound** (78.5° to 85.5°), with a red and a green channel buoy and a charted light.
- **Fogwatch** (730, 10), radius 58: a fell island with a sheltered voe facing the ring (`fogwatch-voe`, kind `sheltered`), a level 3 town. It wants amber and buys lamp oil, smoked fish and planks; at level 3 it makes amber beads.
- **Amber Strand** (720, 500), radius 40: the outpost site (`site`, level 1 to 3), dunes and marram, gathers amber, wants timber, bread and planks.
- Islets: **the Giant and his Wife** (two sea stacks, like Risin and Kellingin), **Lamb Holm** (sheep), **Puffin Holm** (a beacon, inside the Haar), **Broch Isle** (a broch and standing stones beyond the Race).
- **Fog banks**: the Haar south of Fogwatch and the Grey Murk on the way to Amber Strand (kind `fog-bank`).
- **The Race**: a 2 kn north-going current about 790 east.
- Four chart areas for the fog of war: the Stepping Stones, Fogwatch Waters, the Race, Amber Reach.
- The **Stormbreak** (storm belt, [0167](0167-east-storm-belt.md)) lies across the band y 230 to 340 from x 600 to the edge; x 440 to 600 stays open water so a route can skirt it.

**Look, as data:**

- Two island styles in `palette.json`: `fog` (turf for grass, basalt for rock, grey shingle beaches; tarred black, whitewashed and oxblood walls, turf roofs, red trim) and `strand` (dune sand and marram).
- New grounds: `turf`, `basalt`, `greyshingle`, `dune`, `marram`.
- Fogwatch's high ground is on its **north** side, in stepped tiers with basalt bands between them, so it never hides the town from the camera (which looks north); the south side stays low. Turf is one even green.
- New props: turf house (light olive turf roof over a dark eave, lit windows), boathouse, drying shed, dry-stone wall, driftwood, foghorn tower, broch, standing stones, sheep, amber, marram (and the cairn becomes a landmark).
- **Reef rock style**: a reef's `look.style` names a palette style whose `colors.reefRock` and `colors.coral` its rocks take (an empty coral list, none). Picked in the map editor (a reef's Rock style) or `npm run sea -- set shape <id> --style fog`; the map checks refuse an unknown style.
- **Lanes take a `width`** (radius units, default 0.04; a path 0.055): Fogwatch's lanes are narrow and wander. Set in the island builder (a lane's Width) or `npm run island -- <id> lane --points … --width 0.024`.
- **Landmarks are any prop of the `landmarks` group**: a scenery island with a cairn, broch or standing stones has its landmark without a special case.
- Scenery props on an unfounded site are `from: 0`, so Amber Strand is not bare before its port opens.

## Consequences

- Saltmere → Fogwatch is 68 s through Gannet Sound (sloop, Fair winds); Fogwatch → Amber Strand 73 s; every balance check passes on all three levels.
- The east's islands and areas are in the fog of war; a save code grows by a character or two.
- Fogwatch's waterfall (art bible) waits for the west's rivers (decision 0176) and comes as a small follow-up.
- The east's story (the Westholm letter, Maren's arc, founding Amber Strand) is not written yet; Amber Strand stays an empty site until then.
