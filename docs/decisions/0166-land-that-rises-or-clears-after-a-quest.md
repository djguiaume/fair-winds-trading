# 0166. Land that rises or clears after a quest

**Status:** Accepted (2026-10-24). A shared engine piece for Phase 4's wave 2 ([0137](0137-phase-4-biomes-and-founded-outposts.md)), from the story brief: in the west, Cinder Isle rises after the eruption quest; in the north, the pack ice that closes Snowberry Isle's cove clears after Sigrun's quests. It extends what changes after a quest ([0130](0130-after-a-quest-and-the-saltmere-shoals.md)) from props, sea marks and trade to the land itself, and the sea files and sea editor ([0161](0161-sea-editor-every-sea-file-in-the-map-editor.md)).

## Context

Until now only decoration waited on a quest: island props, sea marks and lights, all drawn but not solid (0130 even refused quest tags on a moored boat, because the collision did not follow quests). An island that appears, or ice that goes, is land: it blocks the hull and the wind, drags at a keel near a reef, has piers, is sighted and charted, and decides whether the routes the balance and the story count on exist. Everything is data and every authoring feature must be editable in the editors and from the command line (Guillaume, 2026-10-24).

## Decision

1. **Same tags.** An island entry or a terrain entry (island, reef, sandbank, shallows, and any later kind such as ice) in a map or sea file takes `"tags": ["after:<quest>"]` (it stands once that quest is done) or `"tags": ["before:<quest>"]` (it stands until then): the rule of 0130, `questShown`. Nothing else in the data changes.
2. **What stands is game state.** `World.land` (`src/sim/questLand.ts`) holds the ids out of the sea and the standing islands and shapes. Collisions, wind shelter and funnelling, reefs and their drag, sandy passages, piers, fog-of-war sighting, the 3D view (island and shape batches, shore foam and tint, shallows tint, lighthouse beams, beacons, harbour lanterns) and the sea chart all read it. The map itself never changes, so another voyage on the page keeps its own land.
3. **Never in sight, never under the hull.** The sim looks twice a second whether the quests done call for a swap, and makes one only when the boat is farther than `changeDistance` (500 units, past what the camera shows at its widest zoom in portrait) from the feature, or docked (the port screen covers the sea) and `dockedClear` (40) from it. Both live in `seamanship.json` › `questLand`. On a load, a quest test start or a step's `moveTo` (0164) nothing near her is on screen yet: everything swaps at once, except land that would rise on top of the boat, which waits until she is clear. The swap is not saved: it follows from the quests done, so save codes keep loading as before.
4. **The checks.** One quest per feature; an island and a shape do not share an id; no port on land that clears; a port on land that rises must be a `site` (0157), founded after it rises; the home port, the captain's island and the prologue's wreck always stand (`questLandProblems`, in the quick checks). The new `quest-tags` check refuses islands, shapes and marks waiting on a quest that does not exist, in the editor, `npm run sea` and `npm run check`. The route checks (reach, pairs, the deepest ship) run twice when the map has such land: with it as it stands before its quests and after all of them (`reach-before`, `reach-after`…).
5. **Editing.** The sea editor's panel has **Stands** (always / once a quest is done / until a quest is done) and **Quest** on islands, shapes and sea marks (marks had no tag editor before), and draws such land with a dashed ring, gold if it rises, pale if it clears, and its quest underneath. `npm run sea` takes `--after <quest>`, `--before <quest>` and `--always` on `add` and `set`. The island builder needs nothing: an island's file is its look, and whether it stands is its sea entry's business.

## Land that stands only while a quest runs (added 2026-10-24)

Guillaume asked whether an island could exist only during a quest, or vanish only for one. Two more tags, for islands and shapes: `during:<quest>` stands only while that quest runs (started, not done), and `except:<quest>` stands all but then. They follow the same swap rule (out of sight or docked), so land a quest leaves behind clears once the boat has sailed away. A port may stand only on land that rises `after:` a quest. Props and sea marks keep following quests done only (a quest's own marks already show while it runs, 0164), so the checks refuse `during:`/`except:` on them. The route checks add a third state, every such quest running, when the map has one. The sea editor's **Stands** offers "only while a quest runs" and "except while a quest runs" on islands and shapes; `npm run sea` takes `--during` and `--except`.

## Consequences

- The west and north sea threads write Cinder Isle and the pack ice as data with these tags; the storyteller's quests decide when.
- Wind zones, currents and chart areas do not wait on quests yet; tags there would be the same rule if a story needs it.
- In the ring (radius 445) nothing is 500 units from everything, so land there swaps while docked or on a load; the Phase 4 seas are wide enough for both.
- Only the two extreme states are route-checked; a sea with several quests' land that only cuts a route in some in-between order would need more states.
- The chart redraws on open, so land that swaps while the chart is open shows the next time it opens.
