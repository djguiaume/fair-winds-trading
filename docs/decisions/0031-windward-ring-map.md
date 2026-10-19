# 0031. Windward Ring replaces Staggered passages as the trading map

**Status:** Implementation for review, 2026-10-19. Guillaume chose mockup A, asking for a real reason to sail between Saltmere and Westholm.

**Context:** Guillaume found the Staggered passages map ([0019](0019-staggered-passages-first-map.md), [0021](0021-larger-sea-and-coastal-landmarks.md)) still lacking. Review on main: all four ports and every barrier sat inside the old 260 radius, so two thirds of the 440 sea held only scenery; port legs were 10 to 20 s; scenery islands were two to three times bigger than the ports; barriers were flat slabs unlike the B2 islands; there were no reefs or shallows. He chose layout A of two [mockups](../maps/rework/README.md). This supersedes the 0018/0019 constraint that the four main islands keep their positions and sizes.

**Decision:**

- New `src/data/phase1-map.json`, named **Windward Ring**. Same four ports and goods ([0015](0015-trade-economy.md)), same NNE 14 kn wind, same 440 radius, same seed.
- Ports move out to the rim, one in each compass quarter (Port Calda NE, Saltmere SE, Stonehaven SW, Westholm W), and become the biggest islands (radius 23 to 26; scenery is 8 to 18).
- Two barrier islands, Greyback Ridge and Gull Hook, lie across the wind in the middle. They are drawn as B2 terraces: the beach is the exact collision outline, then two sandstone tiers and a grass cap, each inset (`insetOutline` in `src/sim/coast.ts`).
- Five reefs (new terrain kind `reef`): rocks and coral just awash, solid to the hull like any shore, with the ocean shader's shallows and foam around them. They do not block wind (decision 0027 only counts `island` terrain).
- **Saltmere ⇄ Westholm:** the trade reason already exists (Saltmere makes fish that Westholm wants, Westholm makes grain that Saltmere wants). The map makes the leg worth sailing: across the wind both ways (a beam reach), so it is the quickest round trip on the map, but the straight line is blocked by Gull Hook, so you choose the Narrows north of the hook or the southern lane past Skerry. Tests assert both.
- The old sandbanks are dropped; the wreck, ruins, beacon and lighthouse landmarks move to the new reefs, ridges and scenery islands. Abbey Head and Watchman Key stay scenery for now; they are the natural first candidates for unlockable ports ([0018](0018-map-proposals-and-unlocks.md)).
- Saves from Staggered passages and the Phase 0 map keep gold, cargo, ships and markets, and resume undocked at the spawn (the coasts all moved). Chart pins are per map name, so old pins do not carry over.
- The sea chart labels named barriers and draws reefs as dashed coral outlines.

**Consequences:** Steady-sailing estimates for all port pairs over five winds are 32 to 125 s (was about 10 to 60 s). The conservative test autopilot sails the four-port circuit in 98, 62, 257 and 206 s. The coastline uses 62 of the ocean shader's 64 edges and 9 of its 12 islands, so adding coasts needs a budget change. Real-tablet play-testing of leg lengths is still needed; if legs feel long, the ports can move in without changing the layout. Review render from the real models: [overview](../maps/rework/windward-ring-overview.png) (`docs/maps/src/overview.html` with `npm run dev`).
