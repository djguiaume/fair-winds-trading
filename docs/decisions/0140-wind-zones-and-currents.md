# 0140. Wind zones and currents

**Status:** Accepted (2026-10-24), ready to build now that Phase 4 is open (v0.3.129 shipped, [0138](0138-phase-3-release.md)). It details point 6 of [0137](0137-phase-4-biomes-and-founded-outposts.md) ("wind zones and currents become authored, per biome"). The proposal, mockups and Guillaume's four rounds of comments are in [docs/reviews/winds-currents](../reviews/winds-currents/README.md).

## Context

Today's wind already wanders round the compass on Captain and Old salt ([0064](0064-wind-from-every-quarter.md)), carries weather spells and storms ([0067](0067-weather-states-and-storms.md)) and is shaped by islands ([0027](0027-islands-shape-the-wind.md)). Phase 4 wants each biome to sail differently, and wants currents. Guillaume's comments on the proposal:

1. Not everything on today's ring: "it's not that big", so some, not all.
2. Currents are **water that looks different**, never arrows, and with no white dashes on their edges: "only visuals".
3. He drew the ring's one current himself, through the middle gap, "to make the middle gap a real tradeoff".
4. The current should show its direction ("waves or something"), and be smooth and natural, "not so angular".
5. He answered "ok" to the revised proposal and its recommendations.

## Decision

1. **Wind zones** are areas painted in `editor.html`, with a kind whose numbers live in `weather.json`. Each fades in over about 40 units. They sit on top of the wandering wind:
   - **Trade belt** (tropical south): pulls the direction about 70 % towards the belt's heading and halves the gusts.
   - **Doldrums** (tropical south): strength ×0.25 to 0.4, with light shifting puffs. On Fair winds it never drops below ×0.6.
   - **Stormy coast** (east): gusts ×1.5, and storms are born there about twice as often.
   - **Cold gale** (north): strength ×1.2, steadier.
   - Everything stays a pure function of seed, time and place, so the save does not change. Lookups go through the existing `SpatialGrid` ([0117](0117-nearby-wind-shelter-and-camera-far.md)).
2. **Currents** are lanes (a smooth polyline with a width and a speed) or areas (a direction and a speed), painted in the editor and stored in the map data.
   - Speeds run from 0.5 to 2.5 kn. A current fades at its edges and near coasts, so harbours stay calm.
   - Its vector is added to the boat's movement over the ground in `stepBoat`, the way leeway is today. The polar, heel and press stay "through the water". A moored boat ignores it ([0041](0041-harbour-mooring-and-edge-buoys.md)).
   - Icebergs drift with the current where there is one, and with the wind otherwise.
3. **Look at sea:** visuals only.
   - Current water is a band of darker, deeper blue with soft edges. It follows a smooth curve and is wider and slacker at its ends. There is no outline, foam line, dash or arrow, and only the water is tinted.
   - The direction shows as lighter wave crests across the band, bowed downstream, which drift slowly with the flow.
   - Small readouts appear only while you are in a current: "SOG" (speed over ground) under the speed, and "Current 1.8 kn E" under the wind. The log's eye toggle hides them.
   - The first time you meet a current, a one-time hint explains it.
4. **On the chart:** the same darker band with its crests and speed.
   - A current is **charted once you have sailed in it**, like a discovered island. At sea you always see it.
   - In Phase 4, a quest reward (an old pilot's chart, likely Old Ness and the Watchman Key arc, subject to the head storyteller) can chart the far biomes' currents in advance.
   - No building perk reveals currents.
5. **Today's ring** gets **one current** and no wind zones.
   - The current follows Guillaume's line: from the north-west edge, north of Westholm, east through the middle gap between Greyback Ridge and Gull Hook, out towards the reefs north of Saltmere. It runs at about 1.8 kn, flowing east.
   - Going east, the gap is the fast road. Coming back west, you choose between the short way against the current and the longer way round in still water.
   - The balance check ([0114](0114-tuning-panel-and-balance-check.md)) confirms that neither way always wins.
6. **Settings › Weather** gets two switches, both on by default: **Currents** and **Wind zones**. Every story step works with both off (0137 point 5).
7. **Difficulty** scales only current strength: Fair winds ×0.6, Captain ×1, Old salt ×1.2.
8. **Tides** (currents that turn over time) come later.

## Consequences

- The map format, map checks and editor gain zones and current lanes and areas. The sim gains a zone term in `windAt` and a current vector in `stepBoat`. The sea shader gains the band and its drifting crests, the chart gains the band, and the HUD gains SOG. All of it ships with en/fr text and the two Settings switches. Estimated at about 5 to 6 PRs.
- The chart needs a "currents sailed" set in the save. It is small (one id per current) and fits the FW2 code ([0118](0118-compact-save-code.md)).
- The balance check's bots must learn to aim up-current, and the route targets need re-checking with the ring current on.
- The [Phase 4 map](../reviews/phase-4-map/README.md) draws its fire and fog-coast currents the same way: smooth, darker water.

## Update (2026-10-24): data format, editor and where it is computed (proposal)

Guillaume asked how currents and wind zones are described in the map file to stay data driven, said the map editor must support them, and asked whether they are always computed or only near the player.

### In the map file

Two new lists sit next to `terrain` in the map JSON (for example `phase1-map.json`). The map holds only the **shapes and the authored strengths**. The numbers each kind applies live in `tuning/weather.json`, following [0093](0093-data-driven-content-and-authoring-tools.md).

```json
"currents": [
  {
    "id": "middle-gap",
    "name": "The Gap Run",
    "speedKn": 1.8,
    "path": [[-362, 248, 60], [-245, 142, 55], [-168, 52, 50], [-52, 19, 40], [103, 52, 45], [271, 65, 60]]
  },
  {
    "id": "fire-warm",
    "name": "Warm Drift",
    "speedKn": 0.8,
    "towardDeg": 200,
    "outline": [[-900, 120], [-760, 160], [-700, 20], [-820, -60]]
  }
],
"windZones": [
  {
    "id": "south-trades",
    "name": "The Trades",
    "kind": "trade-belt",
    "headingDeg": 60,
    "outline": [[-300, -700], [300, -680], [320, -820], [-280, -840]]
  },
  { "id": "glass-calm", "kind": "doldrums", "outline": [[40, -900], [140, -880], [130, -980], [30, -990]] }
]
```

- A **lane** current has a `path`: authored control points `[x, y, width]`, in flow order, so the water runs from the first point to the last. The width is per point, so it can be wide and slack at the ends and narrow in a gap. The game and the editor smooth the path with one shared function, so the editor shows exactly what the game sails. `speedKn` is the speed at the narrowest point and eases off where the lane widens (a factor in `weather.json`, `currents.wideSlowdown`). The edge fade width is also in `weather.json`.
- An **area** current has a closed `outline` and a `towardDeg` instead of a path. The outline is smoothed the same way.
- A **wind zone** has a closed `outline`, a `kind` and, for a trade belt, a `headingDeg`. A zone can override any number of its kind with an optional `"tune": { "strength": 0.3 }`.
- The kinds and their numbers go in a new `zones` block in `weather.json`:
  - `trade-belt` has `pull` 0.7 and `gusts` 0.5.
  - `doldrums` has `strength` [0.25, 0.4] and `fairFloor` 0.6.
  - `stormy-coast` has `gusts` 1.5 and `stormBirth` 2.
  - `cold-gale` has `strength` 1.2 and `gusts` 0.8.
  - All of them share one `fadeUnits` of 40.
- **Map checks** (the editor and the tests run the same ones):
  - Ids are unique, and each `kind` exists in `weather.json`.
  - Every shape sits inside `boundsRadius`.
  - No current reaches a harbour mooring at more than a trickle.
  - A lane is at least 20 units wide, and no closed outline crosses itself.
- **The save does not change**, apart from the set of current ids already charted (Decision 4).

### In the map editor

The editor already edits terrain outlines: drag the points, insert a point on an edge, Delete. Zones and currents reuse that machinery.

- **Add current** (new tool): click to lay points along the lane and double-click to finish. Drag a point to move it. Each point has a small width handle, dragged like an island's radius handle. The side panel has the name, the speed and a "Reverse flow" button. A second option, **Area current**, places an oval outline with a direction dial.
- **Add wind zone** (new tool): click the sea to place an oval outline and drag its points, as for a reef. The side panel has a kind picker, a heading dial for trade belts and optional overrides.
- **Preview:** currents are drawn as the smooth darker band with crests drifting downstream, and zones as soft tinted areas with their names. A **Currents and zones** switch in the layer list hides them while editing islands.
- **Play this map** sails the edited currents and zones straight away. Export writes them into the map file to commit.

### Computed only where needed

Nothing is computed over the whole sea.

- **Sim:** the wind and the current are asked only at the points that need them: the player's boat each frame, the boats and icebergs actually simulated near it, and the balance check's bots offline. Each lookup asks a `SpatialGrid` ([0117](0117-nearby-wind-shelter-and-camera-far.md)) for the few shapes whose bounding circle touches that point. It costs a few microseconds per frame, like island shelter today, and stays the same at 5x the sea.
- **At sea:** each lane is one ribbon mesh along its smoothed path, built once at load. Its crests scroll in the shader. three.js skips ribbons outside the camera, so only the current in view is drawn.
- **On the chart:** the charted currents are drawn once as static shapes.

### Building it in parallel

Currents and wind zones touch the same files: `map.ts`, the editor, the map checks and `weather.json`.

1. A first small PR lands the shared base: the smoothing function, the two lists in the `MapDef` type, the `zones` and `currents` blocks in `weather.json`, the map checks, and the editor's path and outline tools.
2. After that, currents (sim, ribbon look, SOG, chart, Settings switch) and wind zones (sim, doldrums look, Settings switch) can each be built in their own thread without conflicts.
3. The far goods pass is docs and data only, so it can run at the same time from the start.
