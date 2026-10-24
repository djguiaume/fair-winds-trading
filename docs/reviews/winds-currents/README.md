# Winds and currents for Phase 4 (proposal, 2026-10-24)

**Status:** Proposal for Guillaume, revised twice after his comments (no arrows; not everything on today's ring; then his own current through the middle gap, visuals only, smooth, with crests showing the direction). Nothing is decided or built. It follows [0137](../../decisions/0137-phase-4-biomes-and-founded-outposts.md) point 6 ("wind zones and currents become authored, per biome") and the [Phase 4 map](../phase-4-map/README.md) (layout B). The code was read with graphify: `windAt` in `src/sim/wind.ts`, `stepBoat` in `src/sim/boat.ts`, `stepWorld` in `src/sim/world.ts`, and the HUD in `src/ui/hud.ts`.

The mockups are real game captures with the proposed readouts drawn on top. The yellow tag marks what is new. `src/capture.cjs` makes them.

## What today's wind already does

- On Captain and Old salt the wind wanders round the whole compass every 3 minutes, and it bends by up to ±40° from one part of the sea to another ([0064](../../decisions/0064-wind-from-every-quarter.md)). Fair winds keeps it steady by default ([0083](../../decisions/0083-difficulty-levels.md)).
- Weather spells (calm, breeze, rain, gale) and moving storms sit on top of that ([0067](../../decisions/0067-weather-states-and-storms.md)), and islands shelter or funnel it ([0027](../../decisions/0027-islands-shape-the-wind.md)).
- The wind is a pure function of seed, time and place, so the save holds no weather.
- The boat already drifts sideways with the wind (`leeway`, about 0.5 kn in a 12 kn breeze).

So Phase 4 does not need a new wind. It needs **local character** on top of the wandering wind, plus a new force, **currents**.

## 1. Wind zones

A zone is an area of the map (an outline, painted in `editor.html`) with a kind. Its numbers live in `weather.json`, and it fades in over its edge (about 40 units), so you sail into it gradually.

| Kind | Where | What it does to the wandering wind | Feels like |
|---|---|---|---|
| **Trade belt** | Tropical south | Pulls the direction towards the belt's own heading (about 70 %) and halves the gusts. It still turns a little. | A fast, reliable highway: haulers love it |
| **Doldrums** | Tropical south, near the port | Strength ×0.25 to 0.4, with light shifting puffs | Patience. Light, swift ships slip through; a loaded fluyt crawls |
| **Stormy coast** | East, fog coast | Gusts ×1.5; storms are born here about twice as often | Ease the sails (the press warning matters) |
| **Cold gale** | North, ice | Strength ×1.2, steadier but colder | Fast but tiring beats around the icebergs |
| (none) | Ring, fire biome, open sea | Today's wind unchanged | |

- Like everything wind-related it stays a pure function of seed, time and place. Nothing is added to the save, and a resumed voyage is in the same wind.
- **Fair winds:** zones still apply (they are the sea's character), but the doldrums never drop below a floor (for example ×0.6), so the easy level never stalls.
- **Cost:** one zone lookup per frame through the existing `SpatialGrid` ([0117](../../decisions/0117-nearby-wind-shelter-and-camera-far.md)), the same order as island shelter today.

![Doldrums at sea](sea-doldrums-desktop.png)

*In the doldrums, the wind readout says "light air" and a small blue DOLDRUMS tag names the zone. The water looks glassier. A first-time hint explains it once, like the press warning hint ([0078](../../decisions/0078-press-warning.md)).*

## 2. Currents

A current moves the water, and everything floating on it, over the ground.

- **Shape:** a **lane** is a polyline with a width and a speed, flowing along it (the fog coast's strong current, a channel between two islands). An **area** has a direction and a speed (the fire biome's warm current). Both are painted in `editor.html`, and they fade at their edges and near coasts so harbours stay calm.
- **Speeds:** 0.5 to 2.5 kn, against boats doing 5 to 16 kn. A 2 kn current across a 10 kn crossing sets you about 11° off your course: enough to matter, never enough to trap you.
- **Sim:** one line in `stepBoat`. The current's vector is added to the boat's movement, as leeway is today. The polar, the heel and the press stay "through the water", so the boat sails exactly the same. Only where it ends up changes. A moored boat ignores it, so docking stays reliable ([0041](../../decisions/0041-harbour-mooring-and-edge-buoys.md)).
- **Icebergs** in the north drift with the current where there is one, and with the wind otherwise.
- No save change, and it's cheap: a lookup on the same grid.

### How you read it at sea

Guillaume (2026-10-24): **no arrows**. A current is **water that looks different**.

![Current at sea](sea-current-desktop.png)

Guillaume (2026-10-24, second round): **no white dashes on its edges, only visuals.**

- **On the water:** the current is a band of darker, deeper blue water. It follows smooth, natural curves, it is wider and slacker at its ends and narrower through the gap, and it fades softly at its edges (no line, no foam, no dashes). Only the water changes colour: boats, reefs, foam and land keep theirs.
- **Direction (Guillaume's third round: "waves or something showing the direction"):** soft wave crests of lighter water lie across the band, bowed downstream like ripples pushed by the flow, and in the game they **drift slowly with the current** (at its speed, scaled down to read well). You see which way it goes without any arrow. They fade with the band, so the open sea keeps today's look.
- **Numbers, small:** under today's speed, "**SOG 6.1 kn**" (speed over ground) appears only while you are in a current, and the wind line gets "Current 1.8 kn E". In the shot the boat sails west against the current, so it logs about 7 kn through the water but makes 6.1 over the ground. This follows the sailing-first rule: numbers visible but small, and the log's eye toggle hides them with the rest.
- **First time only:** "A current runs east through the gap: quick going east, slow coming back. Around Greyback Ridge may be faster."

Phone landscape and portrait:

<img src="sea-current-landscape.png" width="420"> <img src="sea-current-portrait.png" width="200">

### On the chart

![Current on the chart](chart-ring-current-desktop.png)

The chart draws current water the same way: a darker band with soft edges, the same smooth curve and width, its speed, and the same crests bowed downstream (still on the chart, since it is a drawing). On the [Phase 4 map](../phase-4-map/README.md) the fire biome's warm current and the fog coast's strong current are drawn the same way (their dashed centre lines are gone too).

**Should currents be on the chart, and should a building or a quest reveal them?** Three ways:

| | How it works | For | Against |
|---|---|---|---|
| A. Always on the chart | Every current is drawn from the start | Simplest; nobody misses the tradeoff | Nothing to discover |
| **B. Charted once sailed (recommended)** | At sea you always see the darker water. A current goes on the chart the first time you sail in it, with its speed, like an island you discover | Discovery by sailing, which suits a sailing-first game; no new building or quest needed; fits the fog of war of 0137 | You learn the first current the slow way (the first-time hint covers that) |
| C. Revealed by a perk or a quest | Currents stay off the chart until a building upgrade (for example "current tables" in the pilot house) or a quest reward | A reason to build or play | Hides on the chart what you can already see at sea, which feels odd; one more upgrade to balance |

I recommend **B on today's ring**, plus a **quest reward for Phase 4**: an old pilot's chart that charts the far biomes' currents before you sail them. Old Ness and the planned Watchman Key arc are the natural fit, to be signed off by the head storyteller. No building perk: each building keeps its single effect.

<img src="chart-ring-current-portrait.png" width="220">

### How much goes on today's ring

Guillaume: today's ring is not big, so it gets **some, not all**. He drew the one current himself: from the north-west edge of the sea, north of Westholm, then east through the **middle gap** between Greyback Ridge and Gull Hook, and out towards the reefs north of Saltmere. About 1.8 kn, flowing east. No wind zones on the ring: the doldrums, the trade belt, the stormy coast and the cold gales stay in the biomes.

This makes the middle gap a real tradeoff:

- **Going east** (Westholm towards Saltmere or Port Calda), the gap is the short way and the current adds about 1.8 kn: clearly the fast road.
- **Coming back west**, the gap is still the shortest, but you lose about 1.8 kn, roughly a fifth of a trader's speed. Going round, north of Greyback Ridge or south past Skerry, is longer but in still water. Which wins depends on your ship and on the wind of the moment, since it wanders on Captain and Old salt.
- The balance check ([0114](../../decisions/0114-tuning-panel-and-balance-check.md)) confirms that neither way is always best, and that no ring route gets much slower than today.

A first current close to home also teaches currents before the far waters.

## 3. Settings and difficulty

Guillaume's rule is that every hazard or annoyance can be switched off. Proposal:

- **Settings › Weather** gets two new switches. **Currents** (off: no current anywhere, and the readouts disappear) and **Wind zones** (off: no doldrums, trade belt or stormy coast, so the sea has today's wind everywhere). Both are on by default.
- Every story step works with both off (head storyteller's rule in 0137).
- **Difficulty** changes only the strength of currents, like gales: Fair winds ×0.6, Captain ×1, Old salt ×1.2. The boat itself still sails the same at every level.

## 4. What it costs to build (a guess)

1. Zones and currents in the map format, checks and the editor (paint, preview): about 2 PRs.
2. Sim (`windAt` zone term, current vector in `stepBoat`, iceberg drift) with tests: 1 PR.
3. Current water look (sea shader band, chart band), SOG readout, first-time hints, Settings switches, en/fr: 1 to 2 PRs.
4. The balance check's bots learn to aim up-current, and the targets get checked: 1 PR.

Everything waits for the v0.3.x release. The data format can be drafted earlier, since nothing in the game reads it until then.

## Questions for Guillaume

1. **Current water look:** smooth darker blue water with soft edges and drifting crests showing the direction, plus small "SOG" and "Current 1.8 kn E" readouts. Is that right?
2. **On today's ring:** your current through the middle gap, flowing east at about 1.8 kn. Right direction and strength?
3. **On the chart:** A always, B charted once you've sailed in it (recommended), or C revealed by a building or a quest? And a pilot's chart quest for the far biomes later?
4. **Two switches** (Currents, Wind zones), or one switch for both?
5. **Difficulty:** should currents scale with the level (Fair winds weaker), or stay the same everywhere?
6. **Tides** (currents that turn slowly over time) left for later? I recommend later.
