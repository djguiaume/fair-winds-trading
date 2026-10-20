# 0049. UI redesign: the "instrument" style and the new Sea HUD

**Status:** Sea HUD implemented for review, 2026-10-20 (Guillaume picked style D and said "Yes go"). Port screen, chart and menus follow in the same style.

**Context:** Guillaume asked for a complete UI redesign (roadmap, play-test fixes). The analysis in [ui-refactor](../ui-refactor/README.md) sorted every current UI element by the need it serves, compared similar mobile sailing and trading games and recommended three full-screen screens (Sea, Port, Chart). Four rounds of static mockups followed ([mockups](../ui-refactor/mockups/README.md)). His answers:

- The port screen is full-screen. Landscape and desktop come first, but portrait must work and look good.
- The audience is people who like sailing first, so speed and point of sail stay **visible by default**, smaller, with a toggle to hide them.
- Style C (navy and brass sailing instruments) as the base, with B's colour goods icons and chunky buttons, and B's chart.
- No bar for cargo: just the count and a crate icon that fills up with the hold.
- Speed and heading at the top right, next to the compass.

**Decision:**

- **Style D, "instruments".** Navy glass panels (`rgba(9,28,41,.85)`) with a thin brass line (`#e8c46a`), Barlow Condensed in capitals for labels and numbers, Barlow for body text. Goods use full-colour icons (fish blue, grain yellow, timber brown, stone grey; gold coin, cargo crate). Buttons are chunky with a dark outline and a pressed edge: brass for the main action (Dock, Map, Buy), green for Sell, red for Repair and close. The chart uses a teal sea with sand islands. Design tokens live as CSS variables at the top of `src/ui/sea-hud.css`.
- **Fonts are self-hosted** (`src/ui/fonts/`, SIL Open Font License, latin subset as WOFF2, about 100 KB for five weights), so the game still works offline after one visit ([0039](0039-installable-web-app.md)) and nothing is loaded from a third party.
- **Icons are one inline SVG sprite** in `index.html` (`<use href="#i-coin">`), drawn in code like the rest of the art ([0016](0016-game-models-style-d-and-b2.md)). No emoji in the Sea HUD, so it looks the same on every device.
- **Sea HUD layout** (landscape and desktop):
  - Top left, resource chips: gold, cargo as "3/10" with a crate icon that fills with the hold (tap for the hold list), hull % only when damaged.
  - Top centre, the destination chip: an arrow pointing at the destination on screen, its name and distance. Hidden without a destination.
  - Top right, one instrument cluster: the **speed log** (speed in knots, heading in degrees and compass point, point of sail in green when it is a fast one) with an eye button to fold it away, saved in settings; then the north-up **wind compass** (no-go wedge, wind arrow, boat, destination dot, and a green band on the rim for the fast angles, 70° to 160° off the wind) with the wind caption under it (strength, direction, knots, lee). Tapping the compass still opens the sailing tips.
  - Over the pier, the **port sign**: anchor and name, what the port wants with its price today, the docking cue, and a brass **Dock** button once the boat can dock.
  - A **hull bar** floats above the boat while it is damaged.
  - Bottom left, the **menu** and **map** buttons. Bottom right, under the thumb, a vertical **sail lever** with three notches (Full, Half, Down): tap a notch or drag along the lever. The keyboard keeps ↑ ↓ / W S.
- **Portrait:** resource chips stack in a column, the speed log sits left of a smaller compass, and the destination chip moves to the bottom centre so it does not crowd the top.
- **Order of work:** Sea HUD first (this ADR), then the full-screen Port screen, the chart, and the menus and tutorial coach marks, each reviewed with screenshots.

**Consequences:**

- The Sea HUD keeps every behaviour it had: tutorial hints, the into-the-wind chip and first-time hint, the lee note, the docking cues, tap to set a course, the edge arrow and toasts. Only the look and the placement change.
- The sail pips and ▲ ▼ buttons are gone; the lever shows the current sail setting itself. Help and tutorial texts now speak of the sail lever.
- The active ship name is no longer on the Sea HUD; it stays on the port screen.
- `src/ui/sea-hud.css` holds the new style and is loaded after `hud.css`. Old rules in `hud.css` for elements the Sea HUD replaced were removed; the port, chart and menu rules stay until those screens are rebuilt.
- Old tablet budget ([0006](0006-desktop-and-mobile.md)): the HUD is still plain DOM updated about eight times a second, with no blur filters on the panels (backdrop blur is costly on old GPUs).
