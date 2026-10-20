# Menus and tutorial coach marks: mockups

*2026-10-20. Last step of the style D redesign ([ADR 0049](../../decisions/0049-ui-instrument-style.md)). Mockups only, waiting for Guillaume's pick; nothing is built yet.*

Review page: https://claude.ai/artifact/PvXcCAFJHtPsuY89uKFDbx

Drawn over the real game (real HUD, chart and port screen) by injecting `src/mock.css` and `src/mock.js` with Playwright (`src/capture.cjs`, run from the repo root: `node docs/ui-refactor/menus/src/capture.cjs <out-dir>`). Phone landscape 844×390 and desktop 1280×720 in English, phone portrait 390×844 in French.

- **Title menu** (`01-menu-*`): side panel on the left, sea and boat visible; bottom sheet in portrait. Big brass Set sail, rows for Learn, How to play, Settings; fullscreen, EN/FR and version in the footer.
- **Pause** (`04-pause-*`): the same menu with Resume, a Paused tag, gold and cargo, and the current tutorial step.
- **Settings** (`05-settings-*`): full screen. Graphics as tabs, speed log and FPS as switches, music slider with %, language; Back to start and New game apart under Voyage. Shift the wind only with `?debug`.
- **How to play** (`06-help-*`): three picture cards (wind, tacking, trading) and one line of controls; fits one phone screen.
- **Tutorial offer** (`02-offer-*`): short, with the five lesson themes as chips.
- **Coach marks** (`03`, `07`–`10`): a small bubble pointing at the element to tap, a brass ring around it, 9 progress dots and Skip. Replaces the big tutorial card, which today covers the chart's goods buttons (`b-chart.jpg`). Works on the sea, the chart and the port screen.
- `b-*.jpg`: the current menu, How to play and tutorial card, for comparison.
