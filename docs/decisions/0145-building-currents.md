# 0145. Building currents: shared base, lookup and editor tools

**Status:** In progress (2026-10-24). Builds [0140](0140-wind-zones-and-currents.md) (wind zones and currents, accepted). Part 1, the shared base for currents and wind zones, is implemented. Part 2, currents in the game, follows in its own PR. Wind zones are built by the Build wind zones thread on top of part 1 (its ADR is 0144; the lagoon proposal is 0143).

## Context

Guillaume asked how currents and wind zones are described in the map file to stay data driven, and said the map editor must support them. 0140's update answered with the format and a plan: one small shared-base PR first, then currents and wind zones in parallel threads. This ADR records what was built and the choices made while building it.

## Decision

### Part 1: shared base (format, smoothing, lookup, checks, editor)

1. **Map format** (`src/sim/map.ts`): `MapDef.currents?: CurrentDef[]` and `MapDef.windZones?: WindZoneDef[]`, exactly as in 0140's update. A lane current has `path: [x, y, width][]` in flow order and `speedKn`; an area current has `outline` and `towardDeg`. A zone has `kind`, `outline`, optional `headingDeg` (where its wind blows from) and `tune` overrides. The names were agreed with the Build wind zones thread.
2. **One smoothing function** (`src/sim/flowShapes.ts`): `smoothPath` for lanes and `smoothOutline` for closed outlines, by corner cutting (Chaikin, `weather.json` › `currents.smoothRounds`, 4). It is the same smoothing as the approved mockup: the curve never overshoots and a lane keeps its first and last point. The game, the map checks and the editor all call it, so the editor shows exactly what the game sails. The same file has the crest geometry (`laneCrests`, `areaCrests`) the editor and the chart share.
3. **Current lookup** (`src/sim/currents.ts`): `CurrentField` is built once per map. `at(x, y, scale)` gives the water's velocity in knots and the id of the strongest current. It asks a `SpatialGrid` ([0117](0117-nearby-wind-shelter-and-camera-far.md)) for the few lane segments and areas near the point (about 2 µs per lookup), so nothing is computed over the whole sea. The speed is `speedKn` at the lane's narrowest place, × (narrowest / width)^`wideSlowdown`, eased to nothing over `edgeFadeUnits` at the sides, `endFadeUnits` at the ends and `coastFadeUnits` from any shore, so harbours stay still. Overlapping currents add up.
4. **Tuning** (`weather.json`): a `currents` block (smoothing, the three fades, `wideSlowdown`, and the check limits `minWidthUnits`, `harbourTrickleKn`, `speedKn` [0.5, 2.5]) and the `zones` block from 0140 (`fadeUnits` and the kinds `trade-belt`, `doldrums`, `stormy-coast`, `cold-gale`). The Build wind zones thread asked for two more fields, `doldrums.shiftDeg` and `sheltered` (a fifth kind for the lagoon, `axis` and `acrossFloor`). Every value has a `?tune` meta line.
5. **Map checks** (`flowChecks`, run by the editor and the tests): unique ids, a known zone kind, `headingDeg` on a kind that pulls the wind, speeds in range, lanes at least 20 units wide, no self-crossing outline, every shape inside the sea, and a current of no more than a trickle (0.3 kn) at every pier head and harbour approach.
6. **Editor** (`editor.html`):
   - **Add current** 🌊: click to lay points in the direction the water flows, then double-click or press Enter to finish. Drag a dot to move a point, a square to change the width there, a small ring to add a point, or the water to move the whole current. The panel has the name, the speed, the selected point's position and width, **Reverse flow** and Delete.
   - **Add area current** 〰️: an oval you reshape, with "Flows toward (°)".
   - **Add wind zone** 🌬️: an oval with a kind picker, "Wind from (°)" and a "This zone only" override for each number of the kind.
   - **Preview:** each current is drawn as the smooth darker band with crests drifting downstream, and each zone as a soft tinted area named with its kind. The **Currents and zones** layer switch hides them. A zone or current is selected by the first press, so a big zone does not get dragged by accident when panning.
   - **Play this map** and Export carry them like the rest of the map.
7. **Today's ring** gets its one current in `phase1-map.json`: `gap-run`, "The Gap Run", 1.8 kn, along Guillaume's line (the same eight points as the approved mockup), 70 units wide at the ends and 40 in the gap. Nothing in the game reads it until part 2.

### Part 2: currents in the game (next PR)

Drift added to the boat's movement over the ground in `stepBoat` (moored boats ignore it), the darker band with drifting crests at sea, the SOG and current readouts, the chart once sailed (a small set of ids in the save), the **Currents** switch in Settings › Weather, difficulty scaling (Fair winds ×0.6, Captain ×1, Old salt ×1.2), the first-meeting hint, and the balance check. It will update this ADR.

## Consequences

- The Build wind zones thread builds its zone sim on `WindZoneDef`, `smoothOutline`, `insideOutline` and the `zones` block, and adds its own file (`windZones.ts`) without touching these.
- A new zone kind is a `weather.json` entry plus meta lines: the editor's kind picker and override fields list it with no editor change, and the checks accept it.
- `CurrentField.at` is the only way the game, the checks and the balance bots ask for current, so the speed rules live in one place.
