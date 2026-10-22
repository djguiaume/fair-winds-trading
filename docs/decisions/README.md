# Decision log

| # | Decision | Date | Status |
|---|---|---|---|
| [0001](0001-game-name.md) | Name the game "Fair Winds Trading" | 2026-10-19 | Accepted |
| [0002](0002-trade-over-combat.md) | Focus on sailing and trade, not combat | 2026-10-19 | Accepted |
| [0003](0003-document-everything-in-repo.md) | Keep all docs, decisions, code and assets in this repo | 2026-10-19 | Accepted |
| [0004](0004-real-time-3d.md) | Render in real-time 3D low-poly (not 2.5D) | 2026-10-19 | Accepted |
| [0005](0005-tech-stack.md) | Tech stack: three.js + TypeScript + Vite, static site | 2026-10-19 | Accepted |
| [0006](0006-desktop-and-mobile.md) | Desktop and mobile from day one, optimized for low-end devices | 2026-10-19 | Accepted |
| [0007](0007-arcade-sailing-with-tacking.md) | Arcade sailing with a real no-go zone (tacking) | 2026-10-19 | Accepted |
| [0008](0008-static-map-seed-ready.md) | One static map first, code ready for seeded maps | 2026-10-19 | Accepted |
| [0009](0009-sandbox-short-sessions.md) | Sandbox for short play sessions | 2026-10-19 | Accepted |
| [0010](0010-light-hazards-pirates-later.md) | Light hazards now, pirates and factions later | 2026-10-19 | Accepted |
| [0011](0011-ship-lineup-and-upgrades.md) | Five ship classes, bought and upgraded with delivery money | 2026-10-19 | Accepted |
| [0012](0012-boat-and-island-art-style.md) | Art style: A sea, bright highland islands, storybook classic boats | 2026-10-19 | Accepted |
| [0013](0013-phase-0-prototype-choices.md) | Phase 0 prototype: sailing feel, controls and performance choices | 2026-10-19 | Accepted |
| [0014](0014-code-built-models-for-now.md) | Code-built models for now, not Scenario-generated ones | 2026-10-19 | Accepted |
| [0015](0015-trade-economy.md) | Phase 1 trade economy: stock-driven prices, docking, upgrades, save | 2026-10-19 | Accepted |
| [0016](0016-game-models-style-d-and-b2.md) | Game models: storybook boats and bright highland islands, built in code | 2026-10-19 | Accepted |
| [0017](0017-main-menu-and-fullscreen.md) | Main menu over the live scene, fullscreen with iPhone fallback | 2026-10-19 | Accepted |
| [0018](0018-map-proposals-and-unlocks.md) | Preview map choices, then implement; selectable maps and persistent unlocks | 2026-10-19 | Accepted scope; choices pending |
| [0019](0019-staggered-passages-first-map.md) | Strengthened Staggered passages, compatible saves and milestone progression | 2026-10-19 | Accepted |
| [0020](0020-quiet-upwind-compass-help.md) | Quiet compass feedback and optional upwind help | 2026-10-19 | Accepted |

| [0021](0021-larger-sea-and-coastal-landmarks.md) | Larger sea, distinct coastal landmarks and a fixed scenery budget | 2026-10-19 | Accepted |
| [0022](0022-trading-ui-integration-and-tablet-budget.md) | Integrate Google AI trading UI and bound tablet rendering cost | 2026-10-19 | Accepted |

| [0023](0023-visible-pier-markers-and-docking.md) | Pier-head harbour labels, explicit docking and visible build identity | 2026-10-19 | Accepted |

| [0024](0024-on-demand-chart-and-quiet-sandbox.md) | On-demand chart, player markers, quieter HUD and suspended practice course | 2026-10-19 | Proposed implementation |

| [0025](0025-optional-first-voyage-tutorial.md) | Optional, resumable first sailing and trading delivery tutorial | 2026-10-19 | Implementation for review |
| [0026](0026-slow-weather-shifts.md) | Slow weather shifts | 2026-10-19 | Implementation for review |
| [0027](0027-islands-shape-the-wind.md) | Islands shape the wind: calm lee, faster flanks | 2026-10-19 | Implementation for review |
| [0028](0028-delivery-contracts.md) | Delivery contracts | 2026-10-19 | Implementation for review |
| [0029](0029-one-main-production-per-port.md) | One main production per port | 2026-10-19 | Accepted |
| [0030](0030-home-base-upgrades-and-earned-ships.md) | Home-base upgrades and earned ships | 2026-10-19 | Accepted (direction) |

| [0031](0031-windward-ring-map.md) | Windward Ring replaces Staggered passages as the trading map | 2026-10-19 | Implementation for review |
| [0032](0032-reef-strikes-and-shallows.md) | Reef strikes and shallows | 2026-10-19 | Implementation for review |

| [0035](0035-three-ship-lines.md) | Three ship lines: swift, warship and hauler | 2026-10-19 | Accepted direction |
| [0036](0036-port-needs-and-market-overview.md) | Port needs on the chart and a market overview | 2026-10-19 | Implementation for review |
| [0037](0037-english-and-french-translations.md) | English and French, with a light translation layer and a menu language switcher | 2026-10-19 | Implementation for review |
| [0038](0038-hull-damage-from-any-crash.md) | Hull damage from any crash: shores and piers too, scaled by impact speed | 2026-10-19 | Implementation for review |
| [0039](0039-installable-web-app.md) | Installable web app: manifest, icons and a network-first service worker | 2026-10-19 | Implementation for review |
| [0040](0040-visible-wind-strength.md) | Visible wind strength: word, arrow colour and gust cue on the compass (bars hidden for now); streaks follow strength | 2026-10-19 | Implementation for review |
| [0041](0041-harbour-mooring-and-edge-buoys.md) | Harbour mooring (slow + sails down = stop and dock), clearer dock cues, red buoys at the sea edge | 2026-10-19 | Implementation for review |
| [0042](0042-light-versioning.md) | Light versioning: v0.<phase>.<deploy> in the menu, commit code kept small beside it | 2026-10-20 | Implementation for review |
| [0043](0043-shelve-kids-mode.md) | Shelve Kids mode: hidden from the game (code kept behind a flag), rework moved to Phase 7 | 2026-10-20 | Accepted |
| [0044](0044-visual-heeling.md) | Visual heeling: the boat leans with point of sail, wind strength, gusts and ship class; calmer on Low | 2026-10-20 | Implementation for review |
| [0045](0045-background-music.md) | Background music: "Fair Winds" sea-folk air composed live in code (flute, quiet chords, bass), new tune every ~30 s, Music volume setting | 2026-10-20 | Implementation for review |
| [0046](0046-phase-1-economy-tuning.md) | Phase 1 economy tuning: wider margins, cheaper first upgrades, leaner delivery orders that grow with the hold, dearer repairs | 2026-10-20 | Implementation for review |
| [0048](0048-ship-unlocks-home-port-and-yards.md) | Ship unlocks: Saltmere home port for upgrades and switching; hidden yards at Watchman Key (swift) and Abbey Head (hauler) open ships after 1/3/6 deliveries there | 2026-10-20 | Implementation for review |
| [0049](0049-ui-instrument-style.md) | UI redesign: "instrument" style (navy and brass, colour icons, chunky buttons) and the new Sea HUD | 2026-10-20 | Sea HUD implemented for review |

| [0050](0050-tablet-friendly-ship-wakes.md) | Hull-sized bow foam and broken stern wakes, scaled across three tablet detail budgets | 2026-10-20 | Implementation for review |
| [0051](0051-refined-upgrade-aware-sloop.md) | Refined sloop with preserved upgrades, attached mainsail and per-jib forestay pivots; Low/Medium/High retained | 2026-10-20 | Implementation for review |
| [0052](0052-refined-upgrade-aware-cutter.md) | Refined cutter with preserved proportions/upgrades, individual jib stays and hull-sized wake; three graphics profiles | 2026-10-20 | Implementation for review |

| [0053](0053-distinct-cutter-hull.md) | Independently shaped cutter hull: fine bow, broad flat transom and V bottom; sloop geometry and attached rigs retained | 2026-10-20 | Implementation for review |

| [0054](0054-refined-upgrade-aware-schooner.md) | Refined schooner: independent long hull, two attached gaff rigs and separate jib stays, all upgrades and tablet qualities | 2026-10-20 | Implementation for review |
| [0055](0055-smooth-port-labels-and-stable-bearings.md) | Per-frame composited pier markers and destination arrows that remain correct behind the camera | 2026-10-20 | Implementation for review |

| [0056](0056-refined-upgrade-aware-clipper.md) | Refined clipper: independent fine-entry hull, three attached gaff rigs and individual jib stays, all upgrades and tablet profiles | 2026-10-20 | Implementation for review |

| [0057](0057-fullscreen-readable-sea-chart.md) | Full-screen sea chart, static local-wind compass, pictographic legend and fixed-size signature boat | 2026-10-20 | Implementation for review |

| [0058](0058-chart-style-d-port-cards.md) | Clear style D chart (no boxes, prices on demand), markers moved to later, one Trade button, hull icon, wider portrait view | 2026-10-20 | Implementation for review |

| [0059](0059-settlement-levels.md) | Settlement levels: four town sizes grown by deliveries, level wants and deeper demand, top upgrades need a home town | 2026-10-20 | Implementation for review |

| [0060](0060-growing-town-visuals.md) | Towns grow visibly over four settlement levels, each port its own way (fish waterfront, timber clearing, grain patchwork, stone terraces and cliff quarry), with a growing dock | 2026-10-20 | Accepted; render code done, wiring after 0059 |

| [0061](0061-menus-and-coach-marks.md) | Menus, pause, full-screen settings and How to play in style D; tutorial coach marks replace the tutorial card | 2026-10-20 | Implementation for review |

| [0062](0062-github-releases-per-phase.md) | GitHub release at the end of each phase and for notable milestones; tag = menu version; Phase 1 released as v0.1.50 | 2026-10-21 | Accepted |

| [0063](0063-specialized-town-goods.md) | Specialized goods: each town's workshop makes smoked fish, bread, planks or cut stone; buyers open with the workshop | 2026-10-21 | Implementation for review |
| [0064](0064-wind-from-every-quarter.md) | Wind wanders round the whole compass (random walk) and bends across regions of the sea; the boat feels the wind where it is | 2026-10-22 | Implementation for review |
| [0066](0066-weather-states-and-storms.md) | Weather states (calm, breeze, rain, gale) per period and moving storms that turn and strengthen the wind, darken the sea and soak fish, grain and bread | 2026-10-22 | Implementation for review |
| [0067](0067-day-and-night.md) | 12-minute day: golden dusk, blue moonlit night, dawn; the sun moves; harbour and stern lanterns; looks only, no gameplay change | 2026-10-22 | Implementation for review |

Template for new entries: `# NNNN. Title`, then **Status**, **Context**, **Decision**, **Consequences**.
