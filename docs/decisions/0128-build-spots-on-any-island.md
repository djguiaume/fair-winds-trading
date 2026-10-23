# 0128. Build spots on any island, edited in the island builder

**Status:** Implemented for review (2026-10-23). Guillaume asked whether the home island is all data, "other island in extensions will reuse that island building with predefined plot and building choices system", and whether it belongs in the island editor. Follows [0126](0126-home-island-build-spots.md).

## Context

0126 put the spots, pairs, buildings, prices and modifiers in data, but two things were code: the map named one home island and the save held one island's state, and the workshop's Repair button looked for the building id `workshop`. The island builder kept the spots on export but could not place them, and drew every building of every spot at once.

## Decision

1. **Any island whose file has `homeSpots` is buildable.** The map's `homeIsland` stays as the island the prologue gives and the default of quest rewards. Each island the captain owns keeps its own state (`home.islands[<island>]`: owned, offered, built); docking works at the pier of any island she owns; every buildable island has a solid pier.
2. **Quest hooks name the island** when it is not the home island: `"homeIsland": true` or `"<island>"`; `"homeSpot": ["spot-2", "<island>:spot-2"]`; `{ "is": "built", "building": "lookout", "island": "<island>" }` (no `island`: on any of hers). The checks refuse an island without spots and an unknown spot.
3. **Effects:** a modifier applies when its building stands on any of her islands; the same kind on two islands does not add up. Effects that work at the pier (home repairs) read the moored island's buildings by **effect kind**, not by building id.
4. **Saves:** the JSON save stores `home.islands`; the first shape of 0126 is read as the home island. FW2's home section becomes layout 2 (flags for which buildable islands are hers, then each one's spots); layout 1 codes still read. On the 30-port sea with quests and the home island the link is 694 characters (693 before).
5. **Island builder, Spots mode:** drag, add and delete spots, set each one's kind (arc spot of a pair, or spare), and **Show** the island as everything (to edit), first look, or with chosen buildings; the checks run on the island as shown and their marks point back at the file's props. See [the builder's README](../island-builder/builder/README.md#build-spots).

## Consequences

- A new buildable island in an extension is data only: an island file with `homeSpots` and tagged props, buildings in `buildings.json`, and quests that give it and offer its spots.
- A new *kind* of modifier is still code once (where its number is used), like a quest condition kind.
- `tests/home.test.ts` builds on a second island drawn from Skerry's file (separate state, effects, docking, save code); `tests/island-builder.test.ts` covers the spot edits and the file's key order.
