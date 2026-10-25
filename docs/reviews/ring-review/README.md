# The Windward Ring: review against the outer seas

Phase 5 part 2 ([brief](../../phase-5/brief.md)), asked by Guillaume on 2026-10-25: the central sea gets the
same review the four outer seas got, then a catch-up pass. Checklist from the art director
([phase 5 art section §3](../art-direction/phase5/README.md#3-ring-catch-up-pass)); Sunreach is the bar.

Screenshots: `npm run shots -- --list docs/reviews/ring-review/shots.json --sizes desktop --out shots/ring-before` (not kept in git; the sheets are)
(main at d0ad8fd, the game's grown sea, day and night, town level 1 and 4; Sunreach at the same cameras).
Contact sheets per island in [sheets/](sheets/), the chart in [chart-ring-before.jpg](chart-ring-before.jpg).

## The numbers

| Island | Radius | Grounds | Woods | Props | Triangles at level 4 |
|---|---|---|---|---|---|
| Sunreach (the bar) | 60 | 9 | 4,000 tries | 54 (16 lamp posts) | 5,607 |
| Port Calda | 26 | 4 + lake | 2,600 | 48 | 5,210 |
| Saltmere | 24 | 4 | 1,100 | 60 | 4,975 |
| Westholm | 24 | **1** | 1,100 (sparse) | 51 | 2,997 |
| Stonehaven | 23 | 10 | 1,100 | 46 | 2,688 |
| Abbey Head | 18 | 4 | off | 15 | 1,319 |
| Watchman Key | 17 | 4 | off | 9 | 1,177 |
| Skerry | 18 | 2 | 260 | 24 | 1,689 |
| Greyback Ridge | 20 | 7 | off | 38 | 1,614 |
| Gull Hook | 20 | 7 | off | 38 | 1,578 |
| Teeth Rock | 9 | 2 | off | 8 | 558 |
| Lantern Rock | 10 | 3 | off | 3 | 363 |
| Bell Rock | 8 | 3 | off | 2 | 236 |

No ring island has a lamp post. Every one is far under the 6,000-triangle budget, so the pass has room.

**The ring's ports are a third of the size of the outer seas' main ports** (radius 18–26 against
Sunreach 60, Fogwatch 58, Emberhold 55, Rimewick 48). At the same camera they show a handful of houses
where Sunreach shows a town. Island files are in island-radius units, so growing a port later scales
everything drawn on it; it moves coasts, piers and leg times, so it is Guillaume's call (asked separately).

## Island by island

- **Westholm** (first port for most players): one flat grass plane at height 0.065, no cliff, no tiers,
  one-tone beach; lone round trees; fields and small farmhouses; the mill is the only landmark. At night
  only the pier lamp: dark. *Worst of the ring.*
- **Saltmere**: decent outline with two islets and a lighthouse rock; flat green cap with lone trees;
  houses packed but no lanes with lamps; boats on the water help. Needs a nameable signature (open
  question to the storyteller and art director).
- **Port Calda**: closest to the bar (lake, conifer woods, stepped mountain, sawmill). Mountain is two
  plain triangles of rock; at night a few lit windows only.
- **Stonehaven**: an octagon in outline and in its tiers; quarry and derrick read well; flat green
  plateau with three trees; dark at night.
- **Abbey Head**: a stacked-octagon cone, the abbey on top; the shipyard huts crowd one beach. Small.
- **Watchman Key**: stacked octagons with a lighthouse; nothing else at level 1.
- **Skerry** (home): plain round cap, a few trees and stones; build spots aside (part 1 of the brief).
- **Greyback Ridge, Gull Hook**: straight extrusions with parallel tiers (the "straight extruded ridge"
  flaw), scattered ball trees and boulders, no cliff colour bands.
- **Teeth Rock, Lantern Rock, Bell Rock**: small stacked octagons; Bell Rock has no name on the chart.

## Open water and story places

- Reefs (`narrows-reef`, `east-reef`, `sw-reef`, `south-reef`, `abbey-reef`, `east-reef-spit`) draw as
  scattered pebbles in a surf ring; none has a name on the chart. The outer seas name theirs.
- Empty water: south and south-east of the ring (between Stonehaven, Watchman Key and Saltmere) and the
  north-west quarter round Abbey Head. `npm run sea -- density` measures only the four outer seas today.
- Story places to check with the storyteller: East Reef gap, Greyback Ridge, Teeth Rock, Watchman Key;
  each port's winter damage before its arc and repair after (Westholm and Port Calda have `before:`/`after:`
  props; Saltmere, Abbey Head and Watchman Key none).

## Pass, in order

1. Westholm and Saltmere: tiers and cliff bands, real woods, lanes with lamp posts, gardens, boats at the
   shore, lit windows, a signature each.
2. Stonehaven, Abbey Head, Port Calda: ragged outlines instead of octagons, cliff bands, lamps.
3. Skerry's surroundings and the small islands: ragged shapes, Greyback Ridge and Gull Hook broken into
   offset tiers with bays.
4. Open water: named reefs, reef rock clusters, fill the empty south-east and north-west.

Each step: `npm run island` / `npm run sea`, `npm run check`, before/after at the same cameras, the art
director's sign-off, Guillaume sees every image before merge.

## The pass (decision 0215)

Sheets in [after/](after/): before, after on a new voyage, after the ring arcs are done (town zoom 1 and 1.4, night,
level 4, level 4 at night) for Westholm, Saltmere, Stonehaven and Port Calda; before and after for the small islands;
the Teeth's wreck before and after `stonehaven-light`. The chart after: [chart-ring-after.jpg](chart-ring-after.jpg).
How each island was changed is in [steps/](steps/) (island builder steps and the scripts that ran once on the files).
The art director's round on Westholm and Saltmere asked for: no rowan orchard, bigger lit windows on every ring house,
higher coasts so the sandstone bands show, Saltmere's trees in clumps, a zoom-1 town camera; all done.

## The ports grown (Guillaume's choice)

Saltmere, Stonehaven and Port Calda at radius 36, Westholm at 34. Sheets in [grown/](grown/): the chart before and after,
a sailing approach to each port, the towns as a new voyage finds them, and at level 4 with the arcs done, by day and night.
Checks, route checks and balance on all three levels pass (ring alone and the game's sea).
