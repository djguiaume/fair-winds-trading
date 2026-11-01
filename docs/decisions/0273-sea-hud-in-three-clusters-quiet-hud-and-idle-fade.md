# 0273. Sea HUD in three clusters, quiet HUD and idle fade

**Status:** Proposed (2026-11-01).

## Context

Wave 2 of v1.5 "A real game" (issue #441, [decision 0268](0268-a-real-game-rebuild-the-ui-as-one-system-v15.md)). The sea HUD was nine style E plates (navy, brass, condensed type), built as static markup in `index.html` with one 770-line `hud.ts` and a 1,100-line `sea-hud.css`. Guillaume picked round 3 D: minimal at sea, text on the scene, and the wind compass with its hatched no-go zone as its own dial, top right.

## Decision

- **Five places, three clusters of meaning.** Top left the status (gold, hold, hull, quest cargo on deck, the tracked quest's step on a faint ink plate). Top centre the heading strip (a compass tape round her heading with her course marked, the course's name and distance, a race's or a run's clock and the race's ×). Top right the wind compass. Bottom right the instrument. Bottom left the actions (Map, Cargo, Menu, and Trade once moored with the pier sign off screen).
- **The wind compass** is a boat-up dial: the card turns with her heading, a thick arrow comes in from where the wind blows (bolder as it rises), the no-go zone is a solid wedge at 55% ink with a crisp light edge and a hatch, never red; the point of sail and "Breeze NE, 12 kn" sit beside it, the weather, forecast, storm belt, current and waves lines under them (storms and squalls in the storm amber). Tapping the dial opens the sailing tips, as before. The chart keeps its own north-up dial (`chartDial.ts`) until the chart part (#444) redraws it.
- **Text on the scene** wears a hard 1 px ink halo; only the dial and the instrument have a backing, a faint ink plate at 40% that is always on. Speed is the biggest number (96 px desktop, 58 px phone).
- **Quiet HUD** (Settings › Display) keeps the compass and the instrument; Map and Menu stay as their icons so a touch player can still pause. It replaces the speed log switch: the sailing numbers are now always on screen unless the player asks for quiet.
- **Idle fade:** the status and the strip fade to 60% after 5 s without a change (a new number, a new course, or a turn of 20°), and come back at once.
- **Wind compass switch** (Settings › Game) shows only on the hardest level and only takes the dial away there.
- **Port signs** stand off the shoreline: their foot is pushed out from the island by `portSignSeaward`. They read as halo text with a sage Dock/Trade button. Boat labels are unchanged.
- **Data:** backings, the fade and the tape's span are in `src/data/tuning/hud.json` (the `?tune` panel's Sea HUD tab). Sizes are theme tokens (art director): text uses the type scale (`--fs-*`, 13 px the smallest on a phone), and `theme.json` › `hud` holds the safe margin (16 px desktop, 12 px phone, never under 12, checked), the compass (200 px desktop), the speed digits and the tape's width. The tape shows only the points' names at 45°. Colours are theme tokens, the storm amber and danger red come from the reserved signal colours in `rules.json`.
- **Code:** `src/ui/hud.ts` coordinates one module per cluster in `src/ui/hud/` (status, headingStrip, windCompass + windDial + windLines, instrument, actions), plus seaToasts, pressWarning and edgeArrow. The clusters are built in code; `index.html` keeps only the overlays pinned to the scene and the sailing tips dialog.

## Consequences

- No plates but the two backings; the HUD reads as one instrument on the scene by day, at night and in the Stormbreak.
- A frame at sea allocates nothing in the HUD: dials turn only when the angle changes by half a degree, text is written ~8 times a second and only when it differs, the wind gauge updates in place.
- The ids the lessons, the screenshot tool and `main.ts` use stay (`#wind-compass`, `#sail-lever`, `#chart-btn`, `#menu-btn`, `#dock-btn`, `#captain-stats`).
- The close chase camera (#432) can switch the quiet HUD through `hud.quiet`; the moments part (#442) owns the arrival banner under the strip.
- Saved settings lose `showLog` (ignored when read); `quietHud` and `windCompass` are new.
