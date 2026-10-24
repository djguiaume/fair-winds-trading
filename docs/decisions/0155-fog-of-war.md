# 0155. Fog of war: named chart areas, sighted islands, blank parchment

**Status:** Accepted (2026-10-24). Guillaume picked look A, blank parchment, from the [screenshots of three looks](../reviews/fog-of-war/README.md). Builds the fog promised by [0137](0137-phase-4-biomes-and-founded-outposts.md) ("fog per island or named area, so the save link stays under 1000 characters") on the south sea of [0152](0152-south-sea-sunreach-layout.md). Area names and wording checked by the head storyteller ([0129](0129-storyteller-brief.md), [0147](0147-phase-4-story.md)).

## Context

The Phase 4 sea is five times today's area. Its new waters should start uncharted and fill in as the captain sails, while today's Windward Ring stays charted. Currents (0140) and wind zones (0152) are already charted once sailed. The save code (FW2, [0118](0118-compact-save-code.md)) must stay short, so fog cannot be kept per pixel or per tile. The look had to run on the 2 GB tablet ([0148](0148-perf-readout-for-device-tests.md)).

## Decision

1. **Data first.** A map's `fog` is `{ chartedRadius, areas }`. `chartedRadius` (in `src/data/seas/grown.json`, 445) keeps the ring charted from the start. Each sea file lists its `chartAreas` (`id`, `name`, `outline`). Water outside the ring and every area stays fogged until its sea is laid out. Today's map has no `fog`, so nothing changes there.
2. **The south sea's four areas** (storyteller-approved names): `coral-line` "The Coral Line" (the reef band and Keeper's Passage), `sugar-bar` "Sugar Bar" (west, with Lone Palm), `sunreach-waters` "Sunreach Waters" (Sunreach and its south arm; not "Sunreach Sound", which stays the lagoon's wind zone), `palm-key-narrows` "Palm Key Narrows" (east, with The Glass and Wreck Reef). Labelled [schema](../reviews/fog-of-war/areas-schema.png).
3. **How the fog lifts.** Sailing into an area charts all of it at once, with a toast ("Charted: Palm Key Narrows"). An island in the fog is charted on its own when she passes within `economy.discoverRange` (90, the range that finds hidden ports, so the lookout perk helps) of its coast. A quest step's new `charts: [area ids]` lifts areas **as soon as the step begins** (the storyteller's need: Ness hands over her chart in `watchman-passage` before the voyage to Sunreach, lifting The Coral Line and Sunreach Waters). The quest builder shows the map's areas as checkboxes on a step's Reward tab; the quest checks refuse unknown area ids.
4. **What the fog hides.** On the chart: land, reefs, marks and names in uncharted water; ports on uncharted islands (so their prices, the trade panel and help orders skip them too). At sea nothing is hidden: what she can see, she sees.
5. **Look A, blank parchment.** Uncharted water is cream paper with a faint pencil grid, "Uncharted waters" (FR "Eaux inconnues") written in each fogged area where it fits, placed like the wind zones' names so it never covers a port, a place or the boat. One SVG layer with a mask; the edge is two grey strokes in the mask (a soft rim) instead of a blur filter, which old tablets draw slowly. Colours are in `sea-chart.css`. **On High quality** (Guillaume asked) the edge is blurred instead (`feGaussianBlur` on the mask, 8 px, `chartFogBlur` in the quality profile), and a sighted island's patch grows by the blur so small islands keep their clearing; Low and Medium keep the stepped rim.
6. **Saves.** `progress.areas` and `progress.sighted` in the JSON save; in FW2 an optional section 13 after the wind zones: a fingerprint of the map's area ids and fogged islands, then a flag each. A code with nothing charted in the fog is unchanged; a map whose areas changed forgets them (like currents and zones). Four areas and four islands cost a few bytes.

## Consequences

- Every new sea adds its `chartAreas` with its layout; its names go to the storyteller first.
- The map editor still edits only today's map, so the sea files (and their areas) are edited as data, like the rest of the south sea. Editing seas in `editor.html` is a tools follow-up.
- The other looks (B sea mist, C hatched sea) are kept in the review for history only.
- Next free FW2 section: 14.
