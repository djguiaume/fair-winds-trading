# Fair Winds Trading — Game Roadmap (draft v1)

One-picture summary for phones: [roadmap-image/roadmap.png](roadmap-image/roadmap.png) (source `roadmap-image/roadmap.html`, render with `node docs/roadmap-image/shot.cjs`).

Versions follow the phases: the menu shows `v0.<phase>.<deploy>` (Phase 1 is `v0.1.x`, Phase 2 is `v0.2.x`, Phase 3 is `v0.3.x`), see [0042](decisions/0042-light-versioning.md). Each finished phase gets a GitHub release ([0062](decisions/0062-github-releases-per-phase.md), [notes](releases/README.md)).

A top-down, low-poly sailing and trading game for the browser. The visual style follows the _Privateers: Pirate Wars_ ad ([screenshots](reference/), teal stylized ocean, sandy islands with soft glow, chunky wooden ships, floating UI bars), but the core loop is **sailing with the wind and delivering goods**, not combat.

## Progression direction under review (2026-10-23)

[Decision 0097](decisions/0097-progression-candidates-and-later-extensions.md) records three competing directions: **a player-built harbour island**, **connecting existing communities**, and **preparing for a great expedition**. None is selected. See the [full comparison, market references and playtest plan](reviews/progression/README.md).

**Steam/automation are deferred**, and pirates remain a separate later extension; both are described in the [extension plan](reviews/progression/extensions.md). They must not be prerequisites for a satisfying base game. Expansion/DLC packaging and timing remain undecided.

**Active play only:** no progress, income, production, deliveries, construction or decay while closed; no wall-clock catch-up. Future systems also stop on pause/suspension. This is a planning requirement, not a runtime change in this documentation PR.

The summary image above predates this review and still shows the former automation-led sequence; this text and ADR 0097 take precedence. Phase numbers remain for continuity while the next gameplay milestone is chosen.

## Name shortlist

| Name                            | Repo slug            | Why                                                                               |
| ------------------------------- | -------------------- | --------------------------------------------------------------------------------- |
| Tradewind Isles                 | `tradewind-isles`    | Says both pillars at once: trade and wind. Easy to search.                        |
| Leeward                         | `leeward`            | Short, nautical, elegant; less obvious about trading.                             |
| Saltroute                       | `saltroute`          | Evokes trade lines and shipping routes.                                           |
| Beam Reach                      | `beam-reach`         | Sailing term for the fastest point of sail; nice for sailors, obscure for others. |
| **Fair Winds Trading** (chosen) | `fair-winds-trading` | Cozy, company-builder vibe; long.                                                 |

## Design pillars

1. **The wind is the terrain.** Routes are hard because of wind direction and strength, not because of enemies. Upwind needs tacking; downwind is fast.
2. **Every delivery matters.** Settlements visibly grow from the goods you bring.
3. **Earn a reason for the next voyage.** Start with one sloop and progress through useful ship choices, discoveries and persistent consequences. The main motivation (personal island, communities or expedition) is under comparison; automation is a later option, not the base-game endpoint ([0097](decisions/0097-progression-candidates-and-later-extensions.md)).
4. **Readable and charming.** Low-poly, bright, top-down, playable in short sessions.

## Core loop

Pick up goods at a settlement → read the wind → sail (tacking when needed) → deliver for profit → settlement grows and asks for new goods → upgrade your ship, choose another class or pursue a new objective → repeat with farther, harder destinations.

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

**Done (2026-10-21):** released as [v0.1.50](releases/v0.1.50.md) ([0062](decisions/0062-github-releases-per-phase.md)). Physical old-tablet validation stays open as a follow-up.

**Status (2026-10-19):** trade rules done in the simulation ([0015](decisions/0015-trade-economy.md), details in [economy.md](economy.md)): four prototype ports and four goods (one main production each; layout reworked in [0031](decisions/0031-windward-ring-map.md); map planning in [0018](decisions/0018-map-proposals-and-unlocks.md)) with supply-and-demand prices, cargo hold, gold, docking, sloop upgrades, the cutter and auto-save. Market/Shipyard UI, Captain/Kids modes (Kids mode hidden for now, [0043](decisions/0043-shelve-kids-mode.md)), persistent gold/cargo/ship stats and nearby port labels are integrated ([0022](decisions/0022-trading-ui-integration-and-tablet-budget.md)); upgrades already appear on the boat models. The sea is larger and the coasts have distinct landmarks ([0021](decisions/0021-larger-sea-and-coastal-landmarks.md)). On-demand chart and player markers are merged ([0024](decisions/0024-on-demand-chart-and-quiet-sandbox.md)); the automatic port-to-port practice guidance is disabled in trading play. The optional first-voyage tutorial is implemented for review ([0025](decisions/0025-optional-first-voyage-tutorial.md)). Each port has one main production ([0029](decisions/0029-one-main-production-per-port.md)). Delivery contracts ([0028](decisions/0028-delivery-contracts.md)), slow weather shifts ([0026](decisions/0026-slow-weather-shifts.md)) and island wind effects, a calm lee and faster flanks and channels ([0027](decisions/0027-islands-shape-the-wind.md)), are implemented for review, and so are reef strikes and shallows ([0032](decisions/0032-reef-strikes-and-shallows.md)). Economy tuning is implemented for review ([0046](decisions/0046-phase-1-economy-tuning.md)).

- **Trading map: Windward Ring** ([0031](decisions/0031-windward-ring-map.md), [mockups and overview](maps/rework/README.md)), replacing Staggered passages ([0019](decisions/0019-staggered-passages-first-map.md)). Ports sit around the rim, one on each side of the wind, and are the main landmarks. Two B2 barrier islands lie across the wind in the middle with five reefs, so routes choose between threading the Narrows and sailing round in open water; Saltmere ⇄ Westholm is a beam reach both ways around Gull Hook. Open water stays on the east rim for faster ships and later combat. Phase 0's original map remains available in data for practice/testing.
- Each port has one main production ([0029](decisions/0029-one-main-production-per-port.md)): Port Calda timber, Saltmere fish, Westholm grain, Stonehaven stone. Map data remains seed-ready ([0008](decisions/0008-static-map-seed-ready.md)).
- **Playtest HUD fixes (implemented for review, [0055](decisions/0055-smooth-port-labels-and-stable-bearings.md)):** pier labels follow each rendered frame with throttled content; selected destination arrows stay correct behind the camera and switch immediately. Physical old-tablet performance verification remains pending.
- Docking: slow down near a port to open Market/Shipyard; buy, sell, upgrade and change ships.
- **Delivery contracts (implemented for review, [0028](decisions/0028-delivery-contracts.md)):** each port posts one order for a good it wants, paying more than the market and more for long hauls; deliver while docked, next order after a short pause.
- Cargo hold with limited capacity; prices vary by supply and demand per settlement.
- Gold as currency. Shipyard at ports: three upgrade tracks for the sloop (sails, hold, hull, levels visible on the model) and a second ship class to buy, the cutter ([0011](decisions/0011-ship-lineup-and-upgrades.md)).
- **Ship unlocks (implemented for review, [0048](decisions/0048-ship-unlocks-home-port-and-yards.md), from [0030](decisions/0030-home-base-upgrades-and-earned-ships.md)):** upgrades and switching ships only at the home port, Saltmere, where the cutter is built. Abbey Head and Watchman Key become small hidden shipwright ports, charted once you sail near them; delivering their orders earns standing that opens the swift line (schooner, clipper) at Watchman Key and the hauler line (hoy, fluyt, indiaman) at Abbey Head, bought with gold. All six classes sail and have models.
- Wind that shifts slowly over time so the same trip changes: a new direction (±50°) and strength every 3 minutes, deterministic from the seed ([0026](decisions/0026-slow-weather-shifts.md)).
- Islands shape the wind: calm in their lee, up to 20 % stronger along their flanks and in channels ([0027](decisions/0027-islands-shape-the-wind.md)).
- On-demand north-up chart (Map / M), current position/heading and wind, port names with prices on demand for a picked good ([0058](decisions/0058-chart-style-d-port-cards.md)). Personal markers were removed for now and moved to later. Only one player-selected bearing appears while sailing; keep the chart closed by default. Evaluate an opt-in minimap only if play-tests still show navigation problems ([0024](decisions/0024-on-demand-chart-and-quiet-sandbox.md)).
- **Port needs and market overview (implemented for review, [0036](decisions/0036-port-needs-and-market-overview.md)):** the chart shows each port's live top need and price under its name, plus a price board for one chosen good across all ports; the harbour shows where each good sells best elsewhere. Filter to discovered ports once discovery exists.
- **Optional first-voyage tutorial (implemented for review, [0025](decisions/0025-optional-first-voyage-tutorial.md)):** fresh voyages offer tutorial or free sailing; existing voyages opt in from Menu. Nine compact, collapsible lessons cover chart → port selection → sail/steering exercise → optional tacking illustration → docking → buying one good (or using existing cargo) → choosing a buyer → delivery → selling. Skip, resume and replay are supported; completion/skip clears the tutorial bearing while preserving later personal destinations and chart pins. Learning progress uses separate map-specific storage; existing voyage saves keep their schema and progress. No looping port circuit or automatic trading. Next: physical tablet validation of the complete flow, portrait/landscape layout and Low/Auto performance.
- Pier-head labels show an anchor, port name and docking cue; tapping sets a destination or docks/trades when stopped within range ([0023](decisions/0023-visible-pier-markers-and-docking.md)). Trade goods appear in the market panel. Settlement levels and level badges remain Phase 2 work.
- **English and French (implemented for review, [0037](decisions/0037-english-and-french-translations.md)):** every screen, Kids mode and the tutorial are translated; the language follows the browser and can be changed from the main menu (English / Français, no flags). New languages are one dictionary file each. A translation quality pass ([0091](decisions/0091-translation-quality-pass.md)) fixed French grammar around goods and ships, sailing vocabulary and typography.
- Sandbox play in short sessions: auto-save to the browser and instant resume ([0009](decisions/0009-sandbox-short-sessions.md)).
- **Move a voyage between devices** (implemented for review, [0066](decisions/0066-move-voyage-between-devices.md)): Menu → Move your voyage shows the save as a QR code to scan on the other device (in game or with the camera app), with copy/paste and a `.json` file as fallbacks. No server; a copy, not a sync. The code is compact since [0118](decisions/0118-compact-save-code.md) (`FW2`, whole numbers, about 250 characters today and under 1,000 on the 5x map; old `FW1` codes still read).
- Light hazards ([0010](decisions/0010-light-hazards-pirates-later.md)), implemented for review in [0032](decisions/0032-reef-strikes-and-shallows.md): shallows around reefs slow the boat (deeper hulls more); striking a reef damages the hull, which leaks speed until repaired in port. Nothing sinks.

**Play-test fixes (requested by Guillaume, 2026-10-19):**

- **Refined sloop (implemented for review, [0051](decisions/0051-refined-upgrade-aware-sloop.md)):** shaped hull and raised gunwales, hatch and rudder/tiller; all hull/hold/sail upgrades preserved. Mainsail pivots on the mast and each jib on its own forestay; sail endpoints and moving rigging remain attached. Low/Medium/High retained, maximum upgrades 743 triangles / six meshes, ropes omitted on Low. Actual engine [screenshots](art/game-models/refined-sloop/README.md); physical older-tablet validation remains. The cutter now follows in [0052](decisions/0052-refined-upgrade-aware-cutter.md): class-specific proportions, red palette, two/three independently attached jibs and all 27 upgrades, maximum 827 triangles / seven meshes. [Actual cutter captures](art/game-models/refined-cutter/README.md); other ship models and physical older-tablet FPS validation remain future work.

- **Complete UI redesign.** The current HUD and panels are not good enough; redesign them as a whole (mockups first, then build), keeping touch and the old-tablet budget ([0006](decisions/0006-desktop-and-mobile.md)). Analysis of the current UI, comparable mobile games and a recommendation: [ui-refactor](ui-refactor/README.md). Style picked: navy and brass "instruments" with colour goods icons and chunky buttons ([0049](decisions/0049-ui-instrument-style.md)). **Sea HUD done; full-screen Port screen implemented for review** ([screenshots](ui-refactor/port/README.md)); **Full-screen Chart implemented for review** ([0057](decisions/0057-fullscreen-readable-sea-chart.md), [screenshots](ui-refactor/chart/README.md)): larger SVG, zoom/pan, static local-wind compass, optional legend/prices sheets and a screen-sized brown/cream player boat with a blue halo. **Clear style D chart** ([0058](decisions/0058-chart-style-d-port-cards.md), [study and screenshots](ui-refactor/chart/clarity/README.md)): map fills the screen, ports as anchor badges and bold names without boxes, green islands, prices on demand per good, dashed course line, new boat icon; one Trade button when docked, new hull icon, wider portrait sailing view; markers moved to later. **Menus, settings, How to play and tutorial coach marks implemented for review** ([0061](decisions/0061-menus-and-coach-marks.md), [screenshots](ui-refactor/menus/README.md)): side-panel title menu (bottom sheet in portrait), pause with Resume, full-screen settings, three picture cards for How to play, and coach-mark bubbles with a brass ring on the element to tap instead of the big tutorial card. This completes the redesign; next: physical tablet validation.
- **Kids mode shelved** ([0043](decisions/0043-shelve-kids-mode.md)): hidden from the game for now, saves fall back to Captain mode; the rework moved to Phase 7.
- **Wind strength you can see** (implemented for review, [0040](decisions/0040-visible-wind-strength.md)): a strength word (Calm to Strong; plain words in Kids mode), a coloured arrow and a short gust cue on the compass (five-bar gauge built but hidden for now), and the sea streaks thin out in a calm and brighten in strong wind.
- **Hull damage from any crash** (implemented for review, [0038](decisions/0038-hull-damage-from-any-crash.md)): ramming an island, coast or pier damages the hull in proportion to the impact speed, docking bumps and sandbanks are free, piers are now solid. Repair in any harbour as in [0032](decisions/0032-reef-strikes-and-shallows.md). Ship-to-ship collisions come with pirates (Phase 5).
  - _Later (Guillaume, 2026-10-20):_ chart personal markers, removed in [0058](decisions/0058-chart-style-d-port-cards.md); bring back only if play-tests show a need, with a simpler design than the old five numbered pins.
  - _Later (Guillaume, 2026-10-19):_ make damage visible and audible: crash sounds, floating debris and splash effects on impact, and the boat model changing at each 20–25 % of hull lost (scuffed paint, patched or torn sails, missing rails, a list), cleared by repair.
- **Docking you can rely on and a visible sea edge** (implemented for review, [0041](decisions/0041-harbour-mooring-and-edge-buoys.md)): lowering sails near a port while already slow (under 3 kn) brings the boat to a dead stop and docks it; fast arrivals still crash. Clearer pier cues. Red bobbing buoys mark the edge of the map.
- **Visual heeling** (implemented for review, [0044](decisions/0044-visual-heeling.md)): the boat leans away from the wind, most on a reach, little running, more in strong wind and with a lurch in gusts, easing off in an island's lee; wide, heavy ships lean less than tall, slim ones. Purely visual, calmer on Low.
- **Background music** (requested by Guillaume, 2026-10-20; implemented for review, [0045](decisions/0045-background-music.md)): the "Fair Winds" theme, a light sea-folk air on a flute over quiet chords, composed live in code so it never repeats exactly; Music volume slider in Settings. Picked from six samples over two listening rounds.
- **Economy tuning** (requested by Guillaume, 2026-10-20; implemented for review, [0046](decisions/0046-phase-1-economy-tuning.md)): measured on the Windward Ring with a simulated 40-minute voyage. Wider margins where goods are wanted, first upgrades at 300 gold, delivery orders a little leaner but growing with your hold, repairs 2 gold per hull point. A sharp trader gets the first upgrade in about 4 minutes and the cutter in about 13, a relaxed one in about 6 and 18.

**Done when:** you can earn enough to buy upgrades and the cutter, and feel the difference.

## Phase 2 — Living settlements

Goal: deliveries visibly change the world.

**Done (2026-10-23):** released as [v0.2.73](releases/v0.2.73.md) ([0092](decisions/0092-phase-2-release.md)): settlement levels, workshops, rare goods, help orders, weather, storms, day and night, difficulty levels, save transfer, solid harbours, the refined hauler models and the translation pass.

- Settlements have a level and population; meeting demand levels them up (more buildings on the island, bigger dock). **Levels implemented for review ([0059](decisions/0059-settlement-levels.md)):** hamlet, village, town, port town; selling wanted goods and delivering orders grow a town; the home port must be a town before the top upgrades. Town visuals accepted in [0060](decisions/0060-growing-town-visuals.md): each port with its own island profile, buildings, industry and growing dock; a level-3 workshop per town (sawmill, smokehouse, bakery, masons). The four producers now have distinct polygon coasts, a lake/islets/cliff/inlets, visible beaches and organic hamlet-to-town layouts ([0071](decisions/0071-distinct-producer-islands.md), implemented for review). The visual revision adds wooded village nuclei, progressive clearing, readable working waterfronts and a mountain-cut quarry ([0072](decisions/0072-wooded-villages-and-working-landscapes.md)). Calda retains a forested mountain plateau even at level 4 ([0073](decisions/0073-calda-forested-mountain-plateau.md)). Their growing T-heads, secondary piers and quays are solid; hidden yards retain the legacy models. Moored fishing boats and the yards' grown docks are solid too, ramming a moored boat dents the hull ([0082](decisions/0082-solid-moored-boats-and-yard-docks.md), implemented for review).
- Higher levels unlock new demands, including goods produced only on distant islands. _Done: level wants, deeper demand, bigger orders, and town specialties ([0063](decisions/0063-specialized-town-goods.md)); and rare goods from the far yards ([0065](decisions/0065-rare-goods-from-the-far-yards.md), implemented for review): Abbey Head makes honey and Watchman Key lamp oil once they grow to villages, bought only across the map; a town needs 20 of its rare good to become a port town._
- Demand decays if unmet, so neglected towns stall. _Done: growth drains back after 3 minutes without supply; levels never drop. The most neglected town, or the home port while an upgrade waits on it, posts a help order with a better reward and double growth ([0069](decisions/0069-help-orders.md))._
- Simple production chains (timber → planks, grain → bread) at higher-level towns. **Implemented for review ([0063](decisions/0063-specialized-town-goods.md)):** a town's workshop makes smoked fish, bread, planks or cut stone, and other ports start buying it.
- **Dynamic weather:** day/night cycle and weather states (calm, breeze, gale, rain, storms) that move across the map and change wind strength; storms can spoil cargo. Builds on Phase 1's slow wind shifts ([0026](decisions/0026-slow-weather-shifts.md)). _Step 1 implemented for review ([0064](decisions/0064-wind-from-every-quarter.md)): the wind now wanders round the whole compass instead of always blowing from the top, and differs from one part of the sea to another at the same moment. Weather states and moving storms implemented for review ([0067](decisions/0067-weather-states-and-storms.md)): calm, breeze, rain and gale periods, storms that cross the sea, turn and strengthen the wind; heeling too hard or too suddenly throws cargo overboard, so you ease the sails in a blow, and the sails control and the lee edge of the screen turn amber, then red, before it happens ([0078](decisions/0078-press-warning.md)); weather and storms can each be turned off in Settings, and storms never come during the tutorial ([0072](decisions/0072-no-storms-in-tutorial-or-events.md)). Day and night implemented for review ([0068](decisions/0068-day-and-night.md)): a 12-minute day with a golden dusk, a blue moonlit night, lanterns on harbours and the masthead, and lit windows in the towns; it can be turned off in Settings._

## Phase 3 — Authoring tools and progression review

**Status (2026-10-23):** the menu/version has entered Phase 3 (`v0.3.x`), but the former automated-fleet goal is now deferred by [0097](decisions/0097-progression-candidates-and-later-extensions.md). Keep the accepted authoring work below; choose the next core gameplay milestone after comparing the [three progression directions](reviews/progression/README.md).

Manual ship purchasing, switching and the distinct swift/hauler lineup remain. Owning ships does not require autonomous transport. The earlier route editor, wind-aware automated sailing, route dashboard and simultaneous fleet-operation plan are deferred historical scope, not the next implementation task.

**Data-driven content and authoring tools** ([0093](decisions/0093-data-driven-content-and-authoring-tools.md), [review](reviews/data-driven/README.md)), so Guillaume can tune and add content without code:

1. Tuning to data: `src/data/tuning/*.json` and a live `TUNING` object, no gameplay change (implemented for review, [0094](decisions/0094-tuning-moved-to-data.md)).
2. Map editor page `editor.html` (in parallel with 1): built, [0095](decisions/0095-map-editor.md), [how to use](map-editor/README.md).
3. Content as data: goods, town levels, weather kinds; one file per ship (`model`, `sailing`, `unlock`). **Text done** ([0107](decisions/0107-text-in-json-files.md), [how to edit](i18n/README.md)): all player text is in `src/i18n/en.json` and `fr.json`. **Goods and weather kinds done** ([0108](decisions/0108-goods-and-weather-kinds-as-data.md), [how to add content](content/README.md)): a new good or weather kind is one entry in its file. Town levels: what each port wants and makes per level is in the map editor; the levels themselves are data since [0113](decisions/0113-levels-tutorial-and-music-as-data.md). **Ship files done** ([0109](decisions/0109-one-file-per-ship.md)): one JSON per ship (unlock, sailing, hull, model with named parts); a new ship is a copied file.
4. **Tuning panel built** ([0114](decisions/0114-tuning-panel-and-balance-check.md), [how to use](tuning-panel/README.md)): `?tune` opens a touch-first panel over the game, on a separate test voyage. Every number of `src/data/tuning/*.json` and of the `sailing`/`unlock` parts of the ship files has a slider, built from `tuning-meta.ts`, applied live; changed values outlined, reset per value and all, a changes counter; ships tab with a draggable polar, top speed in knots and "sail this ship". Edits stay in the browser; Share gives a link and QR; Export gives the changed files whole, formatted like the repo, ready to upload as a pull request. The "moved values equal the old constants" block in `tests/tuning.test.ts` goes with the first deliberate tuning change.
5. **Balance check built** (same decision): the simulation of the balance tests now lives in `src/sim/balance.ts` with its targets in `src/data/balance-targets.json`; the panel runs it in a Web Worker on the edited values (Captain 40 minutes, then each difficulty level) and shows which targets hold.

**Before the tuning panel (Guillaume, 2026-10-23): town levels, difficulty, tutorial and music as data.** **Done** ([0113](decisions/0113-levels-tutorial-and-music-as-data.md), [how to add content](content/README.md)), proven unchanged by hashes taken before the move:

- **Town levels:** their number and names in `src/data/town-levels.json`; the per-level numbers stay in `economy.json`; editors and checks follow the file. A fifth level is one entry plus one number per table.
- **Difficulty levels:** the entries of `difficulty.json` (easiest first, with name, pitch and card look); the New voyage cards and Settings buttons are built from them. A fourth level is one entry.
- **Tutorial:** the first quest, `src/data/quests/first-voyage.json` (when it starts, its reward, its steps: harbour, chart pick, coach targets, which event leads where); the events (docked, bought, sails practised…) are a small code library. The format is meant for later quests (Guillaume, 2026-10-23).
- **Music and sounds:** every sound is a line in `src/data/audio.json`: music as a recorded file or a theme the composer plays live (`src/data/music/fair-winds.json`: tempo, keys, rhythms, chords, rests, loudness, echo), effects as a recorded file or a synthesised one. Synthesis stays code.

Still in code after that, by choice ([0108](decisions/0108-goods-and-weather-kinds-as-data.md), [0109](decisions/0109-one-file-per-ship.md), [0113](decisions/0113-levels-tutorial-and-music-as-data.md)): a new kind of ship part (written once in `shipParts.ts`), a weather kind with a new look (fog, snow), a new kind of tutorial event, the hand-built town looks past level 4, a new musical form or instrument, and the game rules themselves.

6. Island builder ([0096](decisions/0096-island-files-and-island-builder.md), [mockup and plan](island-builder/README.md)), mockup approved: one file per port island (coasts, raised ground, lanes, props per level), then a builder in `editor.html` to place houses, lighthouses or woodpiles, shape the ground (cliffs or slopes) and draw lanes for each level. **Island files done** ([0101](decisions/0101-island-files-built.md), [format](island-builder/files/README.md)): the four port islands come from `src/data/islands/*.json`, identical to before. **Builder part 1 built** ([0105](decisions/0105-island-builder-props.md), [how to use](island-builder/builder/README.md)): props, levels, 3D preview, checks, play and export. **Part 2 built** ([0106](decisions/0106-island-builder-ground-lanes-woods.md)): ground with cliff or slope edges, mountains, the lake, lanes, paths and stairs that climb slopes, painted woods. **Every island has a file** ([0110](decisions/0110-every-island-has-a-file.md)): scenery islands and ridges rebuilt in the port format, any island (also new ones) opens in the builder; reefs and sandbanks stay in the map file. Next for the 5x map: draw only the islands near the ship.

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
- Big settlements demand exotic goods from far regions, forcing long routes. Planned: outer islands past the Windward Ring's edge, one upwind and one downwind, make a rarer second set of goods that only port towns want ([0065](decisions/0065-rare-goods-from-the-far-yards.md)).
- Ports you can found or upgrade (warehouses, shipyards) to act as relay hubs.
- Seeded procedural maps: new archipelago from a seed, shareable.

## Phase 5 — Pirates (planned later extension)

**Scope (2026-10-23):** compatible with all three progression candidates; not required for the base story. See [extension fit, risks and validation](reviews/progression/extensions.md). Retain this phase number for continuity; no release date, paid-DLC decision or ordering against steam is committed. Island raids and armies require a separate scope decision.

- Pirate ships that hunt loaded merchants; outrun them, or arm ships with light defenses.
- Pirate sightings use the hazard marker on the chart and in warnings ([0070](decisions/0070-hazard-markers.md)), with a red badge.
- Pirates can be switched off in Settings, like storms ([0067](decisions/0067-weather-states-and-storms.md)): every hazard gets an on/off switch. Each difficulty level ([0083](decisions/0083-difficulty-levels.md)) also scales how often pirates show up and what a boarding costs.
- Ship health and repairs at ports; escort ships for valuable routes.
- **Warship line** (ketch → brig → frigate: lots of firepower and hull, low cargo, slow upwind) from a naval yard, and a fourth upgrade track, **guns**, so any ship can arm a little ([0035](decisions/0035-three-ship-lines.md)). Swift ships escape pirates, warships fight them, haulers need escorts.

## Later extension — Steam and harbour logistics (deferred)

- Small, relatively slow steam launches, potentially acquired and captained by the player.
- Balance against swift and large sailing ships through usable hold, fuel/range and operating cost; steam must not make sail obsolete.
- Validate one manually controlled vessel before deciding whether simple local supply automation improves the game.
- Automation may follow safe sea lanes with bounded offscreen simulation; wind independence simplifies steering but does not remove obstacle/path/docking requirements. No measured performance claim yet.
- Storage limits, spending reserves, refuelling and recovery need explicit rules.
- No progress while closed, paused or suspended, and no catch-up.
- Compatible with all three base candidates; a player island is not a prerequisite.
- Details: [Steam and harbour logistics](reviews/progression/extensions.md). Late-stage/expansion scope only; packaging, pricing, timing and order against pirates are undecided.

## Racing missions (requested by Guillaume, 2026-10-19)

Timed delivery races between ports, alongside the sandbox rather than replacing it.

- Each mission is a fixed route (port A to port B, optionally via checkpoints) with a cargo to deliver against the clock, and medal times (bronze, silver, gold) plus a personal best.
- **Fixed difficulty parameters** so every attempt is the same challenge: a predefined wind (direction, strength, gusts, shifts), weather (calm, squalls; random storms are held back during events, [0072](decisions/0072-no-storms-in-tutorial-or-events.md), so a race with a storm pins its own) and, once Phase 5 lands, pirates on set patrols. Damage and repairs ([0038](decisions/0038-hull-damage-from-any-crash.md)) count against the time.
- Missions are data-driven like maps (id, route, ship, cargo, wind/weather/pirate settings, medal times), so new ones are a JSON entry; seeded so wind gusts replay identically.
- A first set can ship as soon as the wind and weather settings can be pinned (after Phase 2); pirate missions follow Phase 5. Medals could unlock cosmetics or maps (see Selectable maps); online leaderboards stay a Phase 7 maybe.

## Phase 6 — Enemy factions (maybe)

- **Concurrent trading companies:** rival companies with their own ships and routes compete for settlements, contracts and prices; contested waters.

## Phase 7 — Polish and optional extras

- Sound: waves, creaking hulls, sails, crashes, port music (the round-1 jig from [0045](decisions/0045-background-music.md) is a candidate). Background music is already in ([0045](decisions/0045-background-music.md)).
- Ship cosmetics (sail colors, flags, figureheads).
- Cutter visual refinement review ([0052](decisions/0052-refined-upgrade-aware-cutter.md), [0053](decisions/0053-distinct-cutter-hull.md)): independent fine-entry/transom/V-bottom hull, preserved upgrades and attached rigs; [actual engine captures](art/game-models/refined-cutter/README.md). Schooner refinement is implemented for review ([0054](decisions/0054-refined-upgrade-aware-schooner.md)): independent long hull, two attached gaff rigs, all upgrades and hull-sized wake; maximum 987 triangles / nine mesh draws, ropes omitted on Low. [Actual schooner captures](art/game-models/refined-schooner/README.md). Later boat refinements must retain independently authored hull silhouettes and sections; physical older-tablet FPS validation remains.
- Clipper refinement is implemented for review ([0056](decisions/0056-refined-upgrade-aware-clipper.md)): independent fine-entry hull, three attached fore-and-aft rigs and individual jib stays, all 27 upgrades, unchanged hull-sized wake and three graphics levels; maximum 1,191 triangles / 11 mesh draws. [Engine captures and budgets](art/game-models/refined-clipper/README.md). Physical older-tablet FPS validation remains.
- **Remaining ship models (in progress, [0077](decisions/0077-one-file-per-ship-model.md)), before Phase 3:** the hoy, fluyt and indiaman still use the original storybook model ([comparison sheet](art/game-models/ship-compare.png)). Each is redesigned in its own file and thread to the same bar as the clipper. **Fluyt done for review ([0079](decisions/0079-refined-fluyt-and-square-rig.md))**: it adds the shared square rig and stern castle, which the indiaman reuses; **Hoy done for review ([0080](decisions/0080-refined-upgrade-aware-hoy.md), [screenshots](art/game-models/refined-hoy/README.md))**; **Indiaman done for review ([0081](decisions/0081-refined-indiaman.md), [screenshots](art/game-models/refined-indiaman/README.md))**: own wall-sided hull, broad transom and gun ports on the shared square rig. Warship models come with Phase 5.
- Achievements.
- **Kids mode rework** (shelved in [0043](decisions/0043-shelve-kids-mode.md), code kept behind `KIDS_MODE_AVAILABLE`): rework controls, text and pacing so a child can actually sail and trade, on top of the redesigned UI and the Fair winds level ([0083](decisions/0083-difficulty-levels.md)), then show the switch again.
- Possible later: online leaderboards or shared world (needs a backend; decide much later).

---

## Out of scope for now

- Ship-to-ship combat as a core feature before Phase 5 (trade stays the core; see [0010](decisions/0010-light-hazards-pirates-later.md)).
- Steam propulsion and automated transport as immediate base-game progression (deferred to later work, [0097](decisions/0097-progression-candidates-and-later-extensions.md)).
- Multiplayer and monetization; expansion planning is not approval for paid DLC.

## Rendering performance

- Local island camera/shadow culling and incremental settlement rebuilds ([0103](decisions/0103-local-island-rendering.md)): preserve authored geometry and stable harbour anchors.

## Tech stack

Decided in [decision 0005](decisions/0005-tech-stack.md): three.js + TypeScript + Vite, static site on GitHub Pages, simulation separate from rendering, mobile performance budget from day one.

Repeatable production-browser performance scenarios now cover startup, sailing, storms, docking, town growth and graphics-quality changes ([0102](decisions/0102-repeatable-performance-baseline.md)). Workload settings and reporting budgets are JSON data; timing reports guide optimization without flaky CI thresholds. Repeat on target tablets before drawing device-performance conclusions.

## Settled and open questions

- ~~True 3D or 2.5D?~~ Decided: real-time 3D low-poly ([decision 0004](decisions/0004-real-time-3d.md)), built with three.js ([0005](decisions/0005-tech-stack.md)).
- ~~Desktop or mobile first?~~ Both from day one, tuned for an old tablet ([0006](decisions/0006-desktop-and-mobile.md)).
- ~~Art style?~~ Decided ([0012](decisions/0012-boat-and-island-art-style.md), mockups in [docs/art](art/)): A sea colours, B2 bright highland islands, D storybook classic boats. Built in the game ([0016](decisions/0016-game-models-style-d-and-b2.md)): sloop and cutter with visible upgrades, the four producer islands.
- What is the base progression motivation? Compare [personal island, connected communities and great expedition](reviews/progression/README.md); no selection yet.
- How much simulation runs for offscreen automated ships (deferred to the steam/logistics evaluation)? The sim remains renderer-free; safe lanes, update frequency and vessel caps need profiling. Offscreen active-play simulation does not imply offline progress.
- ~~Where ships are upgraded and bought?~~ Decided ([0030](decisions/0030-home-base-upgrades-and-earned-ships.md)): upgrades only at the home-base port; each new ship class is built at one port you must discover and earn standing with through delivery contracts, then bought with gold. Implementation follows the map rework.
- ~~Difficulty levels?~~ Decided and built ([0083](decisions/0083-difficulty-levels.md), [proposal](reviews/difficulty/README.md)): Fair winds / Captain / Old salt change costs, pace, weather and the default wind (steady trade wind on Fair winds) but never how the boat sails; Settings › Wind and the hazard switches stay independent. Pirates (Phase 5) need a switch and a per-level scale.
