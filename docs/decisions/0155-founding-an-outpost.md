# 0155. Founding an outpost: empty islands, landed goods and the `found` reward

**Status:** Accepted (2026-10-24). Guillaume saw the [screenshots](../reviews/founding/README.md) and said "Ok". Builds [0137](0137-phase-4-biomes-and-founded-outposts.md) point 3 (outposts you found), [0146](0146-far-goods-from-the-biome-outposts.md)/[0150](0150-building-far-goods.md) (the outpost gathers a raw far good, stops at town) and [0152](0152-south-sea-sunreach-layout.md) point 7 (Palm Key has no port until it is founded). The field names were agreed with the head storyteller, who writes `outpost-south` ([0147](0147-phase-4-story.md), [brief](../story/storyteller-brief.md#phase-4-the-four-seas)).

## Context

0137 says the player founds each sea's outpost: bring settlers and building goods, then it grows with the town levels. The storyteller brief makes founding the third arc of every sea (`outpost-<biome>`): founding goods from the ring, then the relative carried from their ring port to the empty island, ending with the flagpole and name board. The south sea left Palm Key without a port because a `hidden` port is a hidden shipyard that trades before anyone founds it. Nothing in the game could make a port appear, unload goods without a market, or keep an island empty until then. Guillaume asked for everything to be data first, with the storyteller owning the story.

## Decision

1. **A site is a port entry with `"site": true`.** Until it is founded it is not a port at all: no pier (solid or drawn), no market, no orders, nothing on the chart, she cannot dock, sailing near does not chart it, and it is never the home port. Its island stands as it is at level 0: props with `from: 0` (Palm Key's daymark and boulder) and its palms; everything from level 1 waits.
2. **The reward `found: ["<port>"]` founds a site.** The port goes on the chart and opens at its own `level`, fresh, with no growth yet. From then on it is an ordinary town: wants, orders, growth, `maxLevel`, `afterQuest`. The island is rebuilt at once with its pier, buildings and harbour light, and a toast says so ("Palm Key is founded! A new port on the chart"). Founding is how a site opens: `discover` and `levelUp` refuse a site, and `found` refuses anything else (`checkQuests` says so in plain words). The quest builder has a "Found an outpost" row listing the map's sites.
3. **A founded site is a charted site.** The chart's list (`progress.discovered`) already goes into the save and FW2, so founding needs no new save field or FW2 section. A code made before a sea had its site (same map, ports list without it) still reads.
4. **Founding goods are a new goal, `landed`** (`place`, `good`, `qty`): alongside a port, or held slowly at a spot at sea like `carried` ([0131](0131-calda-slipway-and-cargo-at-a-spot.md)), the goods the step still needs come out of the hold by themselves, as many as she has aboard, with a toast ("Landed: 4 timber"). A short load lands what it can and the rest comes later, so the step cannot fail. Nothing is paid. Several goods are `all` of several `landed`; the card counts them as one load ("10 / 16"), the sea and chart show the landing spot, and the quest compass points to it.
5. **The settler is the quest's own item** (`carried`, space 0), named by each quest (Tam Ness for the south), never by the code.
6. **Palm Key** (south sea, data only): `site: true`, founded as a hamlet (level 1) that gathers spice from the day it is founded, at the economy's hamlet stock (`producesEquilibrium`, 85 % of a village's), so the relative's done card ("bring what we gather to Juno") is true at once. It wants timber, then bread and planks, and grows to town (`maxLevel` 3). This replaces 0146's "gathers from village level"; the storyteller agreed. Its island file shows the outpost by level: level 1 has the epilogue's flagpole and name board ([0134](0134-fair-winds-epilogue.md)), two beach homes, crates, a spice drying rack and a lamp; level 2 two more homes and a rack; level 3 two more homes, a warehouse and a side pier. They use `from: 1` rather than `after:outpost-south` tags, since level 1 is the day of founding. Landing spot for the quest: `{ "x": 487, "y": -738, "within": 10, "maxKn": 2, "holdSec": 3 }`, off the beach where the pier will stand.

## Balance (all three difficulty levels)

A maxed cutter's 30 units of spice from Palm Key to Sunreach, leg timed in each level's real wind (0149), stock settled at Palm Key's level (`tests/founding.test.ts`):

| Level | Leg | Hamlet (founded) | Village | Town |
|---|---|---|---|---|
| Fair winds | 48 s | 403 | 450 | 483 |
| Captain | 50 s | 364 | 413 | 448 |
| Old salt | 50 s | 310 | 361 | 398 |

0150 measured 453 / 415 / 364 for a village on its test sea; the founded hamlet starts a little lower and passes it as it grows, which gives a reason to keep supplying it.

## Consequences

- Each new sea's outpost is a port entry with `site: true` plus the storyteller's quest file; no code per outpost. The storyteller puts `outpost-south` in once this lands.
- Renderer, piers and docking read "town levels" with 0 for an unfounded site (`townLevels`); the settlement itself keeps its start level for the day it opens.
- Island files may give a prop `from: 0` (stands before founding too); the island checks allow it on props only.
- Not built yet, left for later: the outpost's build spots (repairs, storage, shelter, 0137) and anything the outpost does beyond trading.
