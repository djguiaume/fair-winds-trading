# Fair Winds Trading — Game Roadmap (draft v1)

One-picture summary for phones: [roadmap-image/roadmap.png](roadmap-image/roadmap.png) (source `roadmap-image/roadmap.html`, render with `node docs/roadmap-image/shot.cjs`).

Versions follow the phases: the menu shows `v0.<phase>.<deploy>` (Phase 1 is `v0.1.x`), see [0042](decisions/0042-light-versioning.md).

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
- Wake trail and a simple speed readout. Hull-sized bow foam and broken stern trails with distinct Low/Medium/High budgets are implemented for review ([0050](decisions/0050-tablet-friendly-ship-wakes.md)); ocean shading improvements remain separate. Upwind feedback stays on the compass: delayed pulse/chip and optional tap-to-open help, with a remembered first-use hint ([0020](decisions/0020-quiet-upwind-compass-help.md)).
- A looping practice course of buoys (first leg upwind) remains in Phase 0 data/tests to judge whether tacking feels right. It is disabled in normal trading play as requested; player-facing guidance returns with the optional Phase 1 tutorial ([0024](decisions/0024-on-demand-chart-and-quiet-sandbox.md)).
- Title menu (play, how to play, settings) and a fullscreen option, with an Add to Home Screen hint on iPhone.

**Done when:** tacking upwind to reach an island is a small, satisfying challenge.

## Phase 1 — MVP: one-captain trading

Goal: a complete, short game loop someone else can enjoy for 15 minutes.

**Status (2026-10-19):** trade rules done in the simulation ([0015](decisions/0015-trade-economy.md), details in [economy.md](economy.md)): four prototype ports and four goods (one main production each; layout reworked in [0031](decisions/0031-windward-ring-map.md); map planning in [0018](decisions/0018-map-proposals-and-unlocks.md)) with supply-and-demand prices, cargo hold, gold, docking, sloop upgrades, the cutter and auto-save. Market/Shipyard UI, Captain/Kids modes (Kids mode hidden for now, [0043](decisions/0043-shelve-kids-mode.md)), persistent gold/cargo/ship stats and nearby port labels are integrated ([0022](decisions/0022-trading-ui-integration-and-tablet-budget.md)); upgrades already appear on the boat models. The sea is larger and the coasts have distinct landmarks ([0021](decisions/0021-larger-sea-and-coastal-landmarks.md)). On-demand chart and player markers are merged ([0024](decisions/0024-on-demand-chart-and-quiet-sandbox.md)); the automatic port-to-port practice guidance is disabled in trading play. The optional first-voyage tutorial is implemented for review ([0025](decisions/0025-optional-first-voyage-tutorial.md)). Each port has one main production ([0029](decisions/0029-one-main-production-per-port.md)). Delivery contracts ([0028](decisions/0028-delivery-contracts.md)), slow weather shifts ([0026](decisions/0026-slow-weather-shifts.md)) and island wind effects, a calm lee and faster flanks and channels ([0027](decisions/0027-islands-shape-the-wind.md)), are implemented for review, and so are reef strikes and shallows ([0032](decisions/0032-reef-strikes-and-shallows.md)). Economy tuning is implemented for review ([0046](decisions/0046-phase-1-economy-tuning.md)).

- **Trading map: Windward Ring** ([0031](decisions/0031-windward-ring-map.md), [mockups and overview](maps/rework/README.md)), replacing Staggered passages ([0019](decisions/0019-staggered-passages-first-map.md)). Ports sit around the rim, one on each side of the wind, and are the main landmarks. Two B2 barrier islands lie across the wind in the middle with five reefs, so routes choose between threading the Narrows and sailing round in open water; Saltmere ⇄ Westholm is a beam reach both ways around Gull Hook. Open water stays on the east rim for faster ships and later combat. Phase 0's original map remains available in data for practice/testing.
- Each port has one main production ([0029](decisions/0029-one-main-production-per-port.md)): Port Calda timber, Saltmere fish, Westholm grain, Stonehaven stone. Map data remains seed-ready ([0008](decisions/0008-static-map-seed-ready.md)).
- Docking: slow down near a port to open Market/Shipyard; buy, sell, upgrade and change ships.
- **Delivery contracts (implemented for review, [0028](decisions/0028-delivery-contracts.md)):** each port posts one order for a good it wants, paying more than the market and more for long hauls; deliver while docked, next order after a short pause.
- Cargo hold with limited capacity; prices vary by supply and demand per settlement.
- Gold as currency. Shipyard at ports: three upgrade tracks for the sloop (sails, hold, hull, levels visible on the model) and a second ship class to buy, the cutter ([0011](decisions/0011-ship-lineup-and-upgrades.md)).
- **Ship unlocks (implemented for review, [0048](decisions/0048-ship-unlocks-home-port-and-yards.md), from [0030](decisions/0030-home-base-upgrades-and-earned-ships.md)):** upgrades and switching ships only at the home port, Saltmere, where the cutter is built. Abbey Head and Watchman Key become small hidden shipwright ports, charted once you sail near them; delivering their orders earns standing that opens the swift line (schooner, clipper) at Watchman Key and the hauler line (hoy, fluyt, indiaman) at Abbey Head, bought with gold. All six classes sail and have models.
- Wind that shifts slowly over time so the same trip changes: a new direction (±50°) and strength every 3 minutes, deterministic from the seed ([0026](decisions/0026-slow-weather-shifts.md)).
- Islands shape the wind: calm in their lee, up to 20 % stronger along their flanks and in channels ([0027](decisions/0027-islands-shape-the-wind.md)).
- On-demand north-up chart (Map / M), current position/heading and wind, port destinations and up to five removable personal markers. Only one player-selected bearing appears while sailing; keep the chart closed by default. Evaluate an opt-in minimap only if play-tests still show navigation problems ([0024](decisions/0024-on-demand-chart-and-quiet-sandbox.md)).
- **Port needs and market overview (implemented for review, [0036](decisions/0036-port-needs-and-market-overview.md)):** the chart shows each port's live top need and price under its name, plus a price board for one chosen good across all ports; the harbour shows where each good sells best elsewhere. Filter to discovered ports once discovery exists.
- **Optional first-voyage tutorial (implemented for review, [0025](decisions/0025-optional-first-voyage-tutorial.md)):** fresh voyages offer tutorial or free sailing; existing voyages opt in from Menu. Nine compact, collapsible lessons cover chart → port selection → sail/steering exercise → optional tacking illustration → docking → buying one good (or using existing cargo) → choosing a buyer → delivery → selling. Skip, resume and replay are supported; completion/skip clears the tutorial bearing while preserving later personal destinations and chart pins. Learning progress uses separate map-specific storage; existing voyage saves keep their schema and progress. No looping port circuit or automatic trading. Next: physical tablet validation of the complete flow, portrait/landscape layout and Low/Auto performance.
- Pier-head labels show an anchor, port name and docking cue; tapping sets a destination or docks/trades when stopped within range ([0023](decisions/0023-visible-pier-markers-and-docking.md)). Trade goods appear in the market panel. Settlement levels and level badges remain Phase 2 work.
- **English and French (implemented for review, [0037](decisions/0037-english-and-french-translations.md)):** every screen, Kids mode and the tutorial are translated; the language follows the browser and can be changed from the main menu (English / Français, no flags). New languages are one dictionary file each.
- Sandbox play in short sessions: auto-save to the browser and instant resume ([0009](decisions/0009-sandbox-short-sessions.md)).
- Light hazards ([0010](decisions/0010-light-hazards-pirates-later.md)), implemented for review in [0032](decisions/0032-reef-strikes-and-shallows.md): shallows around reefs slow the boat (deeper hulls more); striking a reef damages the hull, which leaks speed until repaired in port. Nothing sinks.

**Play-test fixes (requested by Guillaume, 2026-10-19):**

- **Refined sloop (implemented for review, [0051](decisions/0051-refined-upgrade-aware-sloop.md)):** shaped hull and raised gunwales, hatch and rudder/tiller; all hull/hold/sail upgrades preserved. Mainsail pivots on the mast and each jib on its own forestay; sail endpoints and moving rigging remain attached. Low/Medium/High retained, maximum upgrades 743 triangles / six meshes, ropes omitted on Low. Actual engine [screenshots](art/game-models/refined-sloop/README.md); physical older-tablet validation remains. Other ship models can follow separately.

- **Complete UI redesign.** The current HUD and panels are not good enough; redesign them as a whole (mockups first, then build), keeping touch and the old-tablet budget ([0006](decisions/0006-desktop-and-mobile.md)). Analysis of the current UI, comparable mobile games and a recommendation: [ui-refactor](ui-refactor/README.md). Style picked: navy and brass "instruments" with colour goods icons and chunky buttons ([0049](decisions/0049-ui-instrument-style.md)). **Sea HUD done; full-screen Port screen implemented for review** ([screenshots](ui-refactor/port/README.md)); next the chart, then menus and tutorial coach marks.
- **Kids mode shelved** ([0043](decisions/0043-shelve-kids-mode.md)): hidden from the game for now, saves fall back to Captain mode; the rework moved to Phase 7.
- **Wind strength you can see** (implemented for review, [0040](decisions/0040-visible-wind-strength.md)): a strength word (Calm to Strong; plain words in Kids mode), a coloured arrow and a short gust cue on the compass (five-bar gauge built but hidden for now), and the sea streaks thin out in a calm and brighten in strong wind.
- **Hull damage from any crash** (implemented for review, [0038](decisions/0038-hull-damage-from-any-crash.md)): ramming an island, coast or pier damages the hull in proportion to the impact speed, docking bumps and sandbanks are free, piers are now solid. Repair in any harbour as in [0032](decisions/0032-reef-strikes-and-shallows.md). Ship-to-ship collisions come with pirates (Phase 5).
  - *Later (Guillaume, 2026-10-19):* make damage visible and audible: crash sounds, floating debris and splash effects on impact, and the boat model changing at each 20–25 % of hull lost (scuffed paint, patched or torn sails, missing rails, a list), cleared by repair.
- **Docking you can rely on and a visible sea edge** (implemented for review, [0041](decisions/0041-harbour-mooring-and-edge-buoys.md)): lowering sails near a port while already slow (under 3 kn) brings the boat to a dead stop and docks it; fast arrivals still crash. Clearer pier cues. Red bobbing buoys mark the edge of the map.
- **Visual heeling** (implemented for review, [0044](decisions/0044-visual-heeling.md)): the boat leans away from the wind, most on a reach, little running, more in strong wind and with a lurch in gusts, easing off in an island's lee; wide, heavy ships lean less than tall, slim ones. Purely visual, calmer on Low.
- **Background music** (requested by Guillaume, 2026-10-20; implemented for review, [0045](decisions/0045-background-music.md)): the "Fair Winds" theme, a light sea-folk air on a flute over quiet chords, composed live in code so it never repeats exactly; Music volume slider in Settings. Picked from six samples over two listening rounds.
- **Economy tuning** (requested by Guillaume, 2026-10-20; implemented for review, [0046](decisions/0046-phase-1-economy-tuning.md)): measured on the Windward Ring with a simulated 40-minute voyage. Wider margins where goods are wanted, first upgrades at 300 gold, delivery orders a little leaner but growing with your hold, repairs 2 gold per hull point. A sharp trader gets the first upgrade in about 4 minutes and the cutter in about 13, a relaxed one in about 6 and 18.

**Done when:** you can earn enough to buy upgrades and the cutter, and feel the difference.

## Phase 2 — Living settlements

Goal: deliveries visibly change the world.

- Settlements have a level and population; meeting demand levels them up (more buildings on the island, bigger dock).
- Higher levels unlock new demands, including goods produced only on distant islands.
- Demand decays if unmet, so neglected towns stall.
- Simple production chains (timber → planks, grain → bread) at higher-level towns.
- **Dynamic weather:** day/night cycle and weather states (calm, breeze, gale, rain, storms) that move across the map and change wind strength; storms can spoil cargo. Builds on Phase 1's slow wind shifts ([0026](decisions/0026-slow-weather-shifts.md)).

## Phase 3 — Fleet and automated trade routes

Goal: shift from sailing every trip to designing a network. This is the main twist on the reference game.

- Buy additional ships from three lines after the starter sloop ([0035](decisions/0035-three-ship-lines.md), refining [0011](decisions/0011-ship-lineup-and-upgrades.md)): **swift** (cutter → schooner → clipper: fast, agile, average hold) and **hauler** (hoy → fluyt → indiaman: huge hold, slow, poor upwind). Each line is built at its own discoverable port and unlocked by deliveries there ([0030](decisions/0030-home-base-upgrades-and-earned-ships.md)); buying and sailing them already works ([0048](decisions/0048-ship-unlocks-home-port-and-yards.md)), Phase 3 adds owning and running several at once. Each class has its own polar curve and the same three upgrade tracks; the player can mix lines in the fleet.
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
- **Warship line** (ketch → brig → frigate: lots of firepower and hull, low cargo, slow upwind) from a naval yard, and a fourth upgrade track, **guns**, so any ship can arm a little ([0035](decisions/0035-three-ship-lines.md)). Swift ships escape pirates, warships fight them, haulers need escorts.

## Racing missions (requested by Guillaume, 2026-10-19)

Timed delivery races between ports, alongside the sandbox rather than replacing it.

- Each mission is a fixed route (port A to port B, optionally via checkpoints) with a cargo to deliver against the clock, and medal times (bronze, silver, gold) plus a personal best.
- **Fixed difficulty parameters** so every attempt is the same challenge: a predefined wind (direction, strength, gusts, shifts), weather (calm, squalls, storms once Phase 2 weather exists) and, once Phase 5 lands, pirates on set patrols. Damage and repairs ([0038](decisions/0038-hull-damage-from-any-crash.md)) count against the time.
- Missions are data-driven like maps (id, route, ship, cargo, wind/weather/pirate settings, medal times), so new ones are a JSON entry; seeded so wind gusts replay identically.
- A first set can ship as soon as the wind and weather settings can be pinned (after Phase 2); pirate missions follow Phase 5. Medals could unlock cosmetics or maps (see Selectable maps); online leaderboards stay a Phase 7 maybe.

## Phase 6 — Enemy factions (maybe)

- **Concurrent trading companies:** rival companies with their own ships and routes compete for settlements, contracts and prices; contested waters.

## Phase 7 — Polish and optional extras

- Sound: waves, creaking hulls, sails, crashes, port music (the round-1 jig from [0045](decisions/0045-background-music.md) is a candidate). Background music is already in ([0045](decisions/0045-background-music.md)).
- Ship cosmetics (sail colors, flags, figureheads).
- Achievements.
- **Kids mode rework** (shelved in [0043](decisions/0043-shelve-kids-mode.md), code kept behind `KIDS_MODE_AVAILABLE`): rework controls, text and pacing so a child can actually sail and trade, on top of the redesigned UI, then show the switch again.
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
- ~~Where ships are upgraded and bought?~~ Decided ([0030](decisions/0030-home-base-upgrades-and-earned-ships.md)): upgrades only at the home-base port; each new ship class is built at one port you must discover and earn standing with through delivery contracts, then bought with gold. Implementation follows the map rework.
