# Fair Winds Trading — Game Roadmap (draft v1)

A top-down, low-poly sailing and trading game for the browser. The visual style follows the *Privateers: Pirate Wars* ad ([screenshots](reference/), teal stylized ocean, sandy islands with soft glow, chunky wooden ships, floating UI bars), but the core loop is **sailing with the wind and delivering goods**, not combat.

## Name shortlist

| Name | Repo slug | Why |
|---|---|---|
| Tradewind Isles | `tradewind-isles` | Says both pillars at once: trade and wind. Easy to search. |
| Leeward | `leeward` | Short, nautical, elegant; less obvious about trading. |
| Saltroute | `saltroute` | Evokes trade lines and shipping routes. |
| Beam Reach | `beam-reach` | Sailing term for the fastest point of sail; nice for sailors, obscure for others. |
| **Fair Winds Trading** (chosen) | `fair-winds-trading` | Cozy, company-builder vibe; long. |

## Design pillars

1. **The wind is the terrain.** Routes are hard because of wind direction and strength, not because of enemies. Upwind needs tacking; downwind is fast.
2. **Every delivery matters.** Settlements visibly grow from the goods you bring.
3. **From captain to shipping magnate.** You start hand-sailing one sloop and end up running a network of automated routes.
4. **Readable and charming.** Low-poly, bright, top-down, playable in short sessions.

## Core loop

Pick up goods at a settlement → read the wind → sail (tacking when needed) → deliver for profit → settlement grows and asks for new goods → upgrade your ship, buy a bigger one or open a route → repeat with farther, harder destinations.

---

## Phase 0 — Sailing prototype ("does sailing feel good?")

**Status (2026-10-19):** first playable build, [play it here](https://djguiaume.github.io/fair-winds-trading/). Implementation choices in [0013](decisions/0013-phase-0-prototype-choices.md), model in [sailing-model.md](sailing-model.md). Title menu and fullscreen added in [0017](decisions/0017-main-menu-and-fullscreen.md). Next: play-test on the tablet and phone, then tune.

Goal: one boat on an empty ocean that is fun to steer.

- Top-down camera following the boat, stylized ocean, a couple of islands with collision.
- Wind: one global direction and strength, shown by a wind arrow/vane and drifting particles.
- Sailing model (arcade, [0007](decisions/0007-arcade-sailing-with-tacking.md)): speed depends on angle to the wind; heading into the no-go zone (~45° either side of the wind) stalls the boat, so upwind means tacking. Sail trim is automatic.
- Controls: steer left/right, raise/lower sails. Keyboard **and** touch from the start ([0006](decisions/0006-desktop-and-mobile.md)).
- Performance baseline: smooth on an old tablet and a phone (quality setting, capped pixel ratio).
- Wake trail and a simple speed readout. Upwind feedback stays on the compass: delayed pulse/chip and optional tap-to-open help, with a remembered first-use hint ([0020](decisions/0020-quiet-upwind-compass-help.md)).
- A looping practice course of buoys (first leg upwind) to judge whether tacking feels right.
- Title menu (play, how to play, settings) and a fullscreen option, with an Add to Home Screen hint on iPhone.

**Done when:** tacking upwind to reach an island is a small, satisfying challenge.

## Phase 1 — MVP: one-captain trading

Goal: a complete, short game loop someone else can enjoy for 15 minutes.

**Status (2026-10-19):** trade rules done in the simulation ([0015](decisions/0015-trade-economy.md), details in [economy.md](economy.md)): four prototype ports and four goods (port roles remain provisional; layout selected in [0019](decisions/0019-staggered-passages-first-map.md); map planning in [0018](decisions/0018-map-proposals-and-unlocks.md)) with supply-and-demand prices, cargo hold, gold, docking, sloop upgrades, the cutter and auto-save. Market/Shipyard UI, Captain/Kids modes, persistent gold/cargo/ship stats and nearby port labels are integrated ([0022](decisions/0022-trading-ui-integration-and-tablet-budget.md)); upgrades already appear on the boat models. The sea is larger and the coasts have distinct landmarks ([0021](decisions/0021-larger-sea-and-coastal-landmarks.md)). Next: target-tablet play-testing, delivery contracts, a minimap and broader wind/progression tuning.

- **Selected first map: strengthened B, Staggered passages** ([0019](decisions/0019-staggered-passages-first-map.md), [overview](maps/phase1-proposals.md)). Four existing main islands keep their appearance, sizes and positions. Staggered polygon barriers and exposed sandbanks add route choices; the stronger southern hook makes a broad eastern bypass useful for faster ships and later combat. Phase 0's original map remains available in data for practice/testing. The current boundary is radius 440 with four outer scenic islands; [expanded overview](maps/expanded-overview.png), [coastal details](maps/coastal-details.png). These add exploration space without changing the four main trading islands.
- Island/port production roles remain provisional. Keep the existing economy assignments playable until production chains and multi-stop circuits are designed; this layout selection does not approve those roles. Map data remains seed-ready ([0008](decisions/0008-static-map-seed-ready.md)).
- Docking: slow down near a port to open Market/Shipyard; buy, sell, upgrade and change ships. Delivery contracts remain planned.
- Cargo hold with limited capacity; prices vary by supply and demand per settlement.
- Gold as currency. Shipyard at ports: three upgrade tracks for the sloop (sails, hold, hull, levels visible on the model) and a second ship class to buy, the cutter ([0011](decisions/0011-ship-lineup-and-upgrades.md)).
- Wind that shifts slowly over time so the same trip changes.
- Minimap with port markers and current wind.
- Pier-head labels show an anchor, port name and docking cue; tapping sets a destination or docks/trades when stopped within range ([0023](decisions/0023-visible-pier-markers-and-docking.md)). Trade goods appear in the market panel. Settlement levels and level badges remain Phase 2 work.
- Sandbox play in short sessions: auto-save to the browser and instant resume ([0009](decisions/0009-sandbox-short-sessions.md)).
- Light hazards: reefs and shallows ([0010](decisions/0010-light-hazards-pirates-later.md)).

**Done when:** you can earn enough to buy upgrades and the cutter, and feel the difference.

## Phase 2 — Living settlements

Goal: deliveries visibly change the world.

- Settlements have a level and population; meeting demand levels them up (more buildings on the island, bigger dock).
- Higher levels unlock new demands, including goods produced only on distant islands.
- Demand decays if unmet, so neglected towns stall.
- Simple production chains (timber → planks, grain → bread) at higher-level towns.
- Day/night cycle and weather states (calm, breeze, gale) affecting wind strength; storms can spoil cargo.

## Phase 3 — Fleet and automated trade routes

Goal: shift from sailing every trip to designing a network. This is the main twist on the reference game.

- Buy additional ships from the full lineup ([0011](decisions/0011-ship-lineup-and-upgrades.md)): sloop and cutter (small, point high), schooner (best upwind), brig (fast downwind), fluyt (huge hold, poor upwind). Each class has its own polar curve and the same three upgrade tracks.
- Route editor: pick ports in order, what to load/unload at each, and assign ships.
- Automated ships sail with the same wind model; routes that fight the wind are slow, so route design is a puzzle.
- Route dashboard: trips, profit per route, delays.
- Player can still captain any ship by hand (e.g. to rush an urgent contract).

## Between Phases 2 and 4 — Selectable maps and persistent unlocks

- Multiple handmade sandbox maps, selectable from the main menu; the Phase 1 map is available from the start. Additional maps introduce different island layouts, distances and sailing challenges.
- Unlock later maps through persistent captain progression. **Preferred design:** delivery and settlement milestones rather than XP earned simply by sailing. Exact requirements remain open until play-testing; later maps add navigation complexity rather than size alone.
- Store map metadata (stable id, title, preview, difficulty and unlock condition) separately from world data; preserve the data-driven, seeded-map path in [0008](decisions/0008-static-map-seed-ready.md).
- Keep account-free captain unlocks separate from each map's voyage save. Switching maps must preserve existing cargo, ships, markets and settlement progress in the appropriate voyage; define migration from the current single-save format before implementing the selector.
- Offer explicit new-voyage and resume actions per map, with clear locked-map requirements. Map unlocks open new sandboxes rather than a scripted campaign.
- Scope decision: [0018](decisions/0018-map-proposals-and-unlocks.md). The selector and progression are planned work, not part of the Phase 1 map preview task.

## Phase 4 — Expansion and harder seas

Goal: growth pushes you outward into tougher navigation.

- Larger, explorable map with fog of war; discover new islands and settlements.
- Regional wind patterns: trade-wind belts, doldrums with almost no wind, variable stormy zones, seasonal shifts.
- Currents, reefs and shallows that block bigger ships.
- Big settlements demand exotic goods from far regions, forcing long routes.
- Ports you can found or upgrade (warehouses, shipyards) to act as relay hubs.
- Seeded procedural maps: new archipelago from a seed, shareable.

## Phase 5 — Pirates

- Pirate ships that hunt loaded merchants; outrun them, or arm ships with light defenses.
- Ship health and repairs at ports; escort ships for valuable routes.

## Phase 6 — Enemy factions (maybe)

- Rival trading powers competing for settlements and routes; contested waters.

## Phase 7 — Polish and optional extras

- Sound: waves, creaking hulls, sails, ambient port music.
- Ship cosmetics (sail colors, flags, figureheads).
- Achievements.
- Possible later: online leaderboards or shared world (needs a backend; decide much later).

---

## Out of scope for now

- Ship-to-ship combat as a core feature before Phase 5 (trade stays the core; see [0010](decisions/0010-light-hazards-pirates-later.md)).
- Multiplayer and monetization.

## Tech stack

Decided in [decision 0005](decisions/0005-tech-stack.md): three.js + TypeScript + Vite, static site on GitHub Pages, simulation separate from rendering, mobile performance budget from day one.

## Settled and open questions

- ~~True 3D or 2.5D?~~ Decided: real-time 3D low-poly ([decision 0004](decisions/0004-real-time-3d.md)), built with three.js ([0005](decisions/0005-tech-stack.md)).
- ~~Desktop or mobile first?~~ Both from day one, tuned for an old tablet ([0006](decisions/0006-desktop-and-mobile.md)).
- ~~Art style?~~ Decided ([0012](decisions/0012-boat-and-island-art-style.md), mockups in [docs/art](art/)): A sea colours, B2 bright highland islands, D storybook classic boats. Built in the game ([0016](decisions/0016-game-models-style-d-and-b2.md)): sloop and cutter with visible upgrades, the four producer islands.
- How much simulation runs for off-screen automated ships (needed from Phase 3)? The stack keeps the sim renderer-free so it can run off-screen or in a Web Worker; the level of detail is still open.
