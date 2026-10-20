# 0057. A larger, quieter sea chart with an instrument compass and signature player boat

**Status:** Implemented for review, 2026-10-20. Guillaume approved the analysis and the brown boat with cream deck, dark outline and light-blue halo.

> Markers part superseded by [0058](0058-chart-style-d-port-cards.md) (2026-10-20): personal markers are removed and moved to later.

## Context

Playtesters found the chart too small, its wind direction/strength text hard to interpret,
its permanent pause message unhelpful and its player arrow difficult to find. Instructions,
legend prose, market prices and marker controls consumed the same scrolling modal. The SVG
had a square viewBox in a wide viewport capped at 52dvh, leaving large horizontal margins.

Read [0024](0024-on-demand-chart-and-quiet-sandbox.md),
[0020](0020-quiet-upwind-compass-help.md),
[0027](0027-islands-shape-the-wind.md),
[0036](0036-port-needs-and-market-overview.md),
[0040](0040-visible-wind-strength.md) and
[0049](0049-ui-instrument-style.md). Keep on-demand navigation, local wind, market planning,
separate pin persistence and the navy/brass instrument style.

## Decision

- Full-screen chart with a compact header and an SVG that fills the remaining space. The
  world geometry and playable area are unchanged. Fit the entire sea without distortion;
  offer bounded 1–3× zoom, drag panning, arrow-key panning and a Whole map reset. The first
  zoom centres on the player's position, bounded by the sea extent. No wheel/pinch dependency.
- Put the existing north-up compass geometry at the chart's upper right, as a static snapshot:
  wind **toward** arrow, ship-specific no-go wedge, fast-angle band, boat heading and selected
  bearing dot. Use the same force thresholds/colours/arrow weight as the Sea HUD, with a short
  force/knots caption and a lee suffix. Read `world.wind`, not the unsheltered `world.seaWind`.
  No delayed help prompts, pulses or gust animations while paused.
- Remove the permanent wind/pause sentence, instructions and footer prose. Upper-left Legend,
  Prices and Markers controls open one sheet at a time. The legend pairs actual pictograms
  with short labels and keeps instructions, wind-locality and pause explanations available
  below. Action confirmations and a selected destination remain in a compact status area;
  the unselected overview has no bottom status text.
- Keep prices/top needs, discovered-port filtering, price-driven port selection and all five
  persistent markers. Use the existing goods and coin SVG sprite instead of emoji for chart
  goods and numeric price cells. Keep accessible port/marker controls in the Markers sheet,
  including Mark my position, remove and Clear bearing. Tapping a port name/price also selects
  it, rather than placing an accidental pin.
- Use one fixed-size signature player silhouette: brown hull, cream deck, dark outline,
  light-blue halo and a pointed bow. Approximately 32px long independent of zoom, shared with
  the legend. It indicates position/heading, not hull dimensions or the currently owned ship's
  class. Draw above labels; move a nearby port's name/need away from the boat and keep prices
  clear of pier icons. Port and pin targets have 44px diameter hit areas.
- Escape closes a sheet first and restores its trigger focus; another Escape closes the chart
  and restores Map focus. Hidden sheets leave keyboard navigation; SVG targets support Enter
  and Space. Dragging never creates a pin or selects a port. Short landscape screens put the
  tool buttons in a column so they do not obscure northern ports. English/French retained.
- **Do not implement particles in this change.** The current effect is camera-centred WebGL,
  whereas the chart is static SVG. A uniform overlay would also misrepresent island shelter.
  A future optional wind-field layer needs separate local-wind sampling and readability review.

## Consequences and validation

No new runtime dependencies, textures, WebGL passes, permanent minimap or animation loops.
Chart redraws are limited to opening, an edit/selection, zoom and viewport resize. Dragging
only changes the viewBox. The world remains paused and the underlying renderer remains stopped.
All three graphics levels use this same chart. Existing voyage/pin storage schemas and keys,
ship models, upgrades, map data and sailing rules remain unchanged.

246 tests pass, including sheet/Escape/focus behavior, local-wind direction and compass isolation,
zoom bounds and player scaling, explicit bearings, persistent pins and save independence.
Production build, ESLint and formatting checks pass. Actual game screenshots and repeatable
Chromium checks for Low/Medium/High, English/French and four viewport profiles are in
[chart review](../ui-refactor/chart/README.md). Idle checks observe zero chart mutations, zero
3D render calls and no world-time advance while open. Touch pin placement, drag suppression,
zoom, port selection, market selection, pin selection/removal controls, clear and focus restoration
are checked in the browser. Software Chromium is not a physical older-tablet FPS certification.
