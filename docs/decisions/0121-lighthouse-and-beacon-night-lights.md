# 0121. Every lighthouse sweeps; beacons flash, white, red or green

**Status:** Implemented for review (2026-10-23). Guillaume: "lighthouses should always have the classic light. like the one in saltmere", asked for a variation on lighthouses and beacons, picked **B. White flash** for beacons on the [mockup](../mockups/night-lights/night-lights-options.png), and suggested a green beacon to pair with the red one at canal entrances. Extends day and night ([0068](0068-day-and-night.md)) and props in island files ([0105](0105-island-builder-props.md), [0110](0110-every-island-has-a-file.md)).

## Context

The sweeping lighthouse beams were tied to Saltmere: `LighthouseBeams` looked for the `fish` profile and put the lamp at a hard-coded point. Lantern Rock and Watchman Key, which also have a `lighthouse` prop in their island files, only had a lit lamp room, and a lighthouse placed in the island builder got nothing. Beacons (Skerry, Bell Rock, Gull Hook) had no light at all.

At sea, a lighthouse is told apart by its rhythm (how many beams, how often), and a lit beacon by its flash characteristic: one, two or three short flashes per period (Fl, Fl(2), Fl(3)). A steady light would blend in with the warm town windows and harbour lanterns. Channels are marked with pairs of lateral marks, red on one side with a can top and green on the other with a cone top (IALA region A: red to port coming in from sea).

## Decision

1. **Lamps come from the island files.** `landmarkLamps(islands, 'lighthouse' | 'beacon')` (`src/render/landmarkLamps.ts`) returns the lamp position of every such prop: the prop's place on the island, its height (`y`, else the ground under it, slopes included), and the lamp height of the model times its `size`. Saltmere's beams land exactly where they were.
2. **Every lighthouse gets the classic sweep, always.** The prop's `variant` picks the pattern: `0` two opposing beams (Saltmere, the default), `1` one beam, `2` three beams. All beams share one material and turn at the same speed, so only the flash interval differs.
3. **Beacons flash.** `BeaconLights` (`src/render/beaconLights.ts`) is one additive point cloud (one draw call for all beacons, like the harbour lanterns). Beacon *n* on the map flashes (n mod 3) + 1 times every 4, 6 or 8 seconds, offset in time, so neighbouring beacons differ. The `variant` picks the mark: `0` white flash (default), `1` unlit day mark, `2` red mark (red can top, red flash), `3` green mark (green cone top, green flash). Put a 2 and a 3 on either side of a channel or canal mouth.
4. **Lights follow the town level.** A lighthouse or beacon with `from`/`to` is dark while its island's town level does not show it; `GameView.setSettlementLevels` updates both.
5. The island builder's Variant field says what the number does for lighthouses and beacons.

## Consequences

- No change for players at Saltmere; Lantern Rock and Watchman Key now sweep, and the three beacons flash white at night.
- Cost: one point cloud with three points, one colour upload per frame at night, one beam group per lighthouse (two beams each today). No real lights.
- The island builder's night preview (thread "Island builder UI", 0119 on its branch, not yet on main) can show these lights by passing a one-island list to `LighthouseBeams` and `BeaconLights`.
- Screenshots: [options](../mockups/night-lights/night-lights-options.png), [beacon variants](../mockups/night-lights/beacon-variants.png).
