# 0275. Paper sea chart: one theme, book tabs and split modules

**Status:** Proposed (2026-11-01). Issue #444, v1.5 wave 3; mockup: round 3 D (decision 0268).

## Context

The sea chart was one 1700-line `seaChart.ts` with its own colours in `sea-chart.css`, a dark
sheet with goods chips over the map, and tabs along the top. v1.5 turns it into the "chart table"
look: an engraved paper chart with book tabs, drawn from the v1.5 components and the theme file.

## Decision

- **The chart is paper, always lit.** It uses the day roles (`ui-panel--day`) even at night, like
  a chart under the cabin lamp. A seeded speck tile (`chart/grain.ts`) gives the grain without a
  filter.
- **The chart's inks live in the theme file.** A new `chart` group in `src/data/ui/theme.json`
  (`--ui-chart-*`): land washes per island style, shallows, bank, ice, lake, current, uncharted
  paper, hatch, storm slate and the zone inks. They pass the same colour checks as `colour`
  (hex, reserved signal colours). `npm run theme` and the editors' Theme page edit them. The
  reserved signal colours are read once in `src/ui/theme/signals.ts`.
- **Layout:** title cartouche top left, book tabs (Chart, Journal, Cargo, Prices, Legend) down
  the right edge, the engraved rose with the wind and no-go wedge and a short key bottom left,
  zoom and fit bottom right. Journal, Cargo and Prices are paper pages of `listRow`s; the goods
  chips on the map are gone (the Prices page picks the good; X on a pad steps through them).
- **Marks:** the boat is an ink hull with its course a dashed ink line; quest places are sage
  flags, her own mark an ink cross; reefs are ink dots; uncharted waters are lighter paper with
  a hatched edge. The storm keeps its slate band with amber chevrons.
- **Code:** `seaChart.ts` stays the coordinator (same public API) and the drawing moves to
  `src/ui/chart/` (one file per layer or page, each under 400 lines). The quest flag's name is
  placed by the chart's words like any label, and faces over piers keep words off them.
- **Input:** wheel and pinch zoom, drag to pan (`chart/view.ts`), the pad's cross pans,
  LB/RB switch tabs.

## Consequences

- A redraw draws fewer SVG nodes (333 against 376 on the start scene) and was no slower in a
  headless timing (median about 41 ms against 46 to 54 ms on main, software rendering).
- `sea-chart.css` is gone: chart styles live in `src/ui/chart/*.css`, hazard styles in
  `src/ui/hazard.css`.
- New chart colours are added in the theme file, never in CSS or TypeScript.
