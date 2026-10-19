# 0024. On-demand chart and quiet sandbox navigation

**Status:** Proposed implementation for review, 2026-10-19. Disabling the automatic practice course was explicitly requested by Guillaume.

## Context

After PRs #10 and #11, the larger sea is harder to navigate and the sailing HUD is crowded. Guillaume requested map/marker ideas, comparison with similar games, and temporary removal of the port-to-port guidance, with its return planned alongside a tutorial. Read decisions 0019–0023 before this change: keep the detailed map, explicit pier docking, quiet wind help, saves and tablet budgets.

## Genre references

- **Sea of Thieves** uses a separate map table and player-drawn circles. Its [map table reference](https://seaofthieves.wiki.gg/wiki/Map_Table) documents marking and unmarking locations. Useful pattern: consult a chart rather than filling the sailing view with map details.
- **Sailwind**, the closest sailing/delivery reference here, explicitly asks players to use navigation instruments and chart their position. [Developer's Steam description](https://store.steampowered.com/app/1764530/Sailwind/). Useful pattern: reading the sea and planning a course are part of sailing. Its realistic navigation difficulty is inappropriate as this cozy game's baseline.
- **Skull and Bones** added a permanent minimap to improve navigation in its [Year 2 Season 1 notes](https://www.ubisoft.com/en-gb/game/skull-and-bones/news-updates/19T7NArKvzO1MofftUXPDi). Its [official beta guide](https://news.ubisoft.com/en-gb/article/VvCL7pvDMGkN9YVKKNiuk/skull-and-bones-closed-beta) describes pinning activities through the map/journal. Useful pattern: consciously select what to track. A permanent minimap would use more of our already crowded tablet viewport.

These are reference patterns, not proof that one layout suits every game. Recommendation for this project: on-demand overview plus one optional bearing, then validate on the target tablet before considering an opt-in minimap.

## Decision

- Add **Map**, also opened/closed with **M**, as a native modal chart. Pause simulation, release held input, restore focus on close, and support Escape. Stop rendering the underlying 3D scene while the chart is open.
- Build a static north-up SVG only when opened or edited: full playable boundary, collision-radius islands, exact terrain polygon outlines, distinct sandbanks, named islands/ports, exported pier anchors, boat position/heading and current wind. Island circles are schematic rather than decorative coast geometry. No second WebGL view, per-frame chart updates, textures or runtime dependency.
- Tap to place up to five numbered markers; select/remove markers and ports with touch or the accompanying keyboard-accessible buttons. A keyboard-accessible button also marks the boat's current position. Store pins separately under a map-specific `fwt.chart.v1.*` key. Invalid/unavailable storage is harmless. Markers are notes, including on land, not claims of safe water.
- Only an explicitly selected port or marker has a compass bearing, edge arrow and compact bottom destination readout. No automatic route, straight-line route preview or autopilot: the player still avoids land and tacks. Port bearings point at the actual rendered pier. Clear bearing from the chart. The selected bearing stays session-only, as in 0022; pins survive reloads independently of voyage saves.
- Remove the persistent Help/Settings/Fullscreen button row; those actions remain in the main menu, and the compass retains sailing help. Keep Map and Menu, sailing speed, gold/cargo, wind and sail controls. Remove the redundant ship-name tag while sailing; the shipyard still identifies the vessel. Nearby actionable pier labels and explicit docking remain.
- **Disable the legacy looping practice course in normal trading:** no assigned “Sail to” objective, practice buoy, waypoint completion toast or automatic next port. Keep the underlying course data for testing and the opt-in Phase 0 practice map. Returning guidance must be an optional tutorial, not restored as a sandbox loop.

## Consequences and validation

No changes to the voyage-save key, version, serializer, cargo, gold, markets, ship upgrades, geometry or sailing physics. Pins use a separate bounded storage key; they can be individually removed and do not reset voyage progress. Existing tablet rendering budgets remain unchanged. No permanent map DOM updates while sailing.

Automated checks cover no automatic sandbox waypoint progression, retained Phase 0 practice, explicit port selection/clearing, bounded persistent markers, invalid storage and unchanged voyage save round trips. Browser checks and physical target-tablet checks must be reported separately; browser emulation cannot certify old-tablet FPS.

Validation for this PR: 102 tests pass (11 files), production build and lint/format checks pass. Browser visual QA could not run: the local Chromium download returned an invalid archive, and the remote browser could not reach the local preview. Review portrait/landscape layout, touch placement, native modal Escape/focus behavior and sustained Low/Auto play on the physical tablet before calling the device baseline verified.
