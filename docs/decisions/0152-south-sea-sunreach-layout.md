# 0152. The south sea: Sunreach, the Coral Line and shallows that refuse deep ships

**Status:** Proposed (2026-10-24), awaiting Guillaume's review of the [screenshots and the labelled map](../reviews/south-sea/README.md). Lays out the first Phase 4 sea from [0137](0137-phase-4-biomes-and-founded-outposts.md) (layout B, one reef gateway, "don't make it too empty"), with the wind zones of [0140](0140-wind-zones-and-currents.md)/[0144](0144-wind-zones-in-the-sim.md), the ring-lagoon main port of [0143](0143-lagoon-wind-axis.md), the far goods of [0146](0146-far-goods-from-the-biome-outposts.md)/[0150](0150-building-far-goods.md) and the names of the [storyteller brief](../story/storyteller-brief.md#phase-4-the-four-seas) ([0147](0147-phase-4-story.md)).

## Context

Phase 4 grows the sea about 5x round today's Windward Ring. The south (tropical) sea opens first. It needs its main port Sunreach, an outpost site for spice (Palm Key), a gateway from the ring, and enough to look at on the way. 0137 promised "reefs and shallows that block bigger ships", which the game could not do: reefs and sandbanks block every ship alike.

## Decision

1. **A dev sea, not the shipped map yet.** The sea is one data file, `src/data/seas/south.json`, merged onto the ring by `src/data/grownMap.ts` (sea radius 985). Play it with `?map=phase4` (own save slot `fwt.phase4.`). The ring is untouched (tested). The shipped map switches when the other seas and founding exist.
2. **Layout** (bearings from the ring's centre, map north up):
   - **The Coral Line**, a broken reef barrier at r ≈ 500 from 126° to 236°, closes the south. **The Keeper's Passage** (158° to 168°, south of Watchman Key) is the one gateway, with a red and a green buoy and a light, all on the chart.
   - **Sunreach** is the 0143 ring island with a lagoon (centre (−60, −735), outer radius 112), entrances staggered, harbour facing in on the north arm's inner shore, slots ≥ 50 units. Its look ([design review](../reviews/south-sea/design-review.md), chosen by Guillaume): the rim of an old drowned crater. The rim stands high on the open-sea side with cliffs and a rocky summit on each arm; the lagoon side steps down in terraces. The town sits on two terraces of `beach-house` homes in the new `tropic` palette, with Juno's green-roofed `tea-house` at the harbour head as the port's signature. The south arm holds the `tea-garden` terraces facing the town, pickers' cottages and a drying house above a wide white lagoon beach. The lagoon is paler (zone `tune.glassy` 0.35), each entrance has a red and a green buoy, and each arm tip has a lighthouse.
   - **Palm Key** (520, −730) is the outpost site: a small hill island with a stone daymark beside the **Palm Key Narrows**.
   - Around them: **Wreck Reef** (an old empty hulk), the **Sugar Bar** sandbanks, palm islets, **Lone Palm** (one palm and a beacon), the glass shoal.
   - Wind zones: **Sunreach Sound** (`sheltered`, the lagoon, wind along east–west), **The Glass** (doldrums, in the open water south of Wreck Reef, between the ring's east side and Palm Key: not on the way in, so the first sight of the sea after the gateway is not a dead calm), **The Trades** (trade-wind belt from ENE along the south edge).
3. **Shallows, a new terrain kind** (`kind: "shallows"`, `maxDraft`): ships whose draft is at most `maxDraft` sail through with some drag (`seamanship.hazards.passageShallow`, 0.5, in `?tune`); deeper ships are pushed out softly, like a sandbank, with a toast ("Too shallow for her keel …"). The Palm Key Narrows have `maxDraft` 1.2: sloop (0.7), cutter (1), schooner (1.1), hoy and clipper (1.2) cross, fluyt (1.5) and indiaman (1.8) go round. The Narrows reef stops short of the sea's edge, leaving a marked **deep channel** inside The Trades, so the long way for deep ships rides the trade wind. Drawn as a sand-and-turquoise tint on the waves with a soft edge, labelled on the chart ("shallow keels only"), editable in the map editor (kind and "Max draft").
4. **Cardinal danger marks** (Guillaume asked for all four at once): new sea mark types `cardinal-north`, `cardinal-east`, `cardinal-south`, `cardinal-west` after IALA (north black over yellow with both cones up, south yellow over black with both down, east black-yellow-black with cones base to base, west yellow-black-yellow point to point). Each model is a recipe in `src/data/props/mark-cardinal-*.json` (internal, not placeable on islands), drawn 1.6 times buoy size so the bands read from the game camera, and a yellow and black diamond on the chart. A north cardinal marks the north end of the Narrows reef (pass north of it, the long way) and a south cardinal its south end (pass south of it, the deep channel).
5. **Wind zones go on the chart once sailed** (Guillaume chose "Yes, once sailed"), like currents (0140). When she is well inside a **named** zone (weight 0.9 past its soft edge), it is charted once, with a toast ("Charted: The Glass, doldrums"). The chart then draws its edge as a faint dashed line in its kind's colour (doldrums amber, trade winds green, sheltered water blue, stormy coasts violet) and its name with its kind ("The Glass · doldrums") at the spot deepest inside it. The name shows only where the zone is about as wide as the name and nothing else is written there, so small zones (Sunreach Sound) show their names when zoomed in. Unnamed zones are tuning, not places, and never go on the chart. With Settings › Wind zones off, nothing is charted or drawn. Kept in the save as `progress.zones` and in FW2 as optional section 12 (a fingerprint of the map's named zone ids, their count and a flag each, after the workshops; a code without charted zones is unchanged, and a map whose zones changed just forgets them). The south sea has no current yet.
6. **The long way always exists.** A new map check (`deep`) plans a route to every port for the deepest ship; it fails if shallows cut one off. No story step or trade needs a shallow keel.
7. **Ports:** Sunreach only, with 0150's fields (level 3, wants spice, wantsMade honey, planks, bread, crafts spiced tea from level 3). **Palm Key has no port yet:** a `hidden` port means a hidden shipyard (0048), so it would show as a shipyard and trade before it is founded. The far goods thread agreed: the port comes with founding (0137, the `outpost-south` arc), with `maxLevel` 3 and spice from `afterQuest`. Until then Sunreach's workshop sells nothing, the "idle workshop" of the story.
8. **New content as data:** the `tropic` island style and palette, props `woodland-palm`, `palm`, `beach-house` (and every `woodland-*` recipe now counts as a tree for woods). The island files are written once by `docs/reviews/south-sea/src/make-south.cjs`; after that they are ordinary island files for the island builder, with golden hashes.

## Distances (five wind directions; route times by the map checks' planner)

| Leg (out / home) | Time | Average |
|---|---|---|
| Ring (Watchman Key) ↔ Sunreach through the Keeper's Passage, sloop | 59–155 s / 57–140 s | 98 / 96 s |
| Sunreach ↔ Palm Key through the Narrows, sloop | 67–132 s / 67–106 s | 104 / 82 s |
| Sunreach ↔ Palm Key the long way through the deep channel, deepest ship's draft | 74–138 s / 73–127 s | 115 / 90 s (+11 % / +10 %) |

The test (`tests/south-sea.test.ts`) holds the long way longer than the Narrows (> 1.1x the distance) but never punishing (< 1.6x the time).

## Consequences

- Phase 4 seas are files under `src/data/seas/`; west, north and east follow the same pattern.
- Founding (flagpole, name board, Palm Key's port) is still to build, with the `outpost-south` arc.
- Balance bots don't sail the far seas yet (0150); the real targets come with the shipped 5x map.
- Old tablets: the shallows tint is one small grid mesh per patch; the new props are low-poly.
