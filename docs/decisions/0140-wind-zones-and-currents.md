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
