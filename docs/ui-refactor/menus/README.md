# Menus and tutorial coach marks

## Built

Captured from the game with `node docs/ui-refactor/menus/capture.cjs` (phone landscape and desktop in English, phone portrait in French), files in `built/`.

| | Phone landscape | Desktop | Phone portrait (FR) |
|---|---|---|---|
| Title menu | ![](built/01-menu-landscape.jpg) | ![](built/01-menu-desktop.jpg) | ![](built/01-menu-portrait.jpg) |
| Tutorial offer | ![](built/02-offer-landscape.jpg) | ![](built/02-offer-desktop.jpg) | ![](built/02-offer-portrait.jpg) |
| Coach mark: map | ![](built/03-coach-map-landscape.jpg) | ![](built/03-coach-map-desktop.jpg) | ![](built/03-coach-map-portrait.jpg) |
| Pause | ![](built/04-pause-landscape.jpg) | ![](built/04-pause-desktop.jpg) | ![](built/04-pause-portrait.jpg) |
| Settings | ![](built/05-settings-landscape.jpg) | ![](built/05-settings-desktop.jpg) | ![](built/05-settings-portrait.jpg) |
| How to play | ![](built/06-help-landscape.jpg) | ![](built/06-help-desktop.jpg) | ![](built/06-help-portrait.jpg) |
| Coach mark: chart | ![](built/07-coach-port-landscape.jpg) | ![](built/07-coach-port-desktop.jpg) | ![](built/07-coach-port-portrait.jpg) |
| Coach mark: sails | ![](built/08-coach-sails-landscape.jpg) | ![](built/08-coach-sails-desktop.jpg) | ![](built/08-coach-sails-portrait.jpg) |
| Coach mark: wind | ![](built/09-coach-wind-landscape.jpg) | ![](built/09-coach-wind-desktop.jpg) | ![](built/09-coach-wind-portrait.jpg) |
| Coach mark: buy | ![](built/10-coach-buy-landscape.jpg) | ![](built/10-coach-buy-desktop.jpg) | ![](built/10-coach-buy-portrait.jpg) |
| Sailing upwind tips | ![](built/11-wind-help-landscape.jpg) | ![](built/11-wind-help-desktop.jpg) | ![](built/11-wind-help-portrait.jpg) |

## Mockups

*2026-10-20. Last step of the style D redesign ([ADR 0049](../../decisions/0049-ui-instrument-style.md)). Guillaume approved the mockups ("Yes, build it"); built in [decision 0061](../../decisions/0061-menus-and-coach-marks.md).*

Review page: https://claude.ai/artifact/PvXcCAFJHtPsuY89uKFDbx

Drawn over the real game (real HUD, chart and port screen) by injecting `src/mock.css` and `src/mock.js` with Playwright (`src/capture.cjs`, run from the repo root: `node docs/ui-refactor/menus/src/capture.cjs <out-dir>`). Phone landscape 844×390 and desktop 1280×720 in English, phone portrait 390×844 in French.

- **Title menu** (`01-menu-*`): side panel on the left, sea and boat visible; bottom sheet in portrait. Big brass Set sail, rows for Learn, How to play, Settings; fullscreen, EN/FR and version in the footer.
- **Pause** (`04-pause-*`): the same menu with Resume, a Paused tag, gold and cargo, and the current tutorial step.
- **Settings** (`05-settings-*`): full screen. Graphics as tabs, speed log and FPS as switches, music slider with %, language; Back to start and New game apart under Voyage. Shift the wind only with `?debug`.
- **How to play** (`06-help-*`): three picture cards (wind, tacking, trading) and one line of controls; fits one phone screen.
- **Tutorial offer** (`02-offer-*`): short, with the five lesson themes as chips.
- **Coach marks** (`03`, `07`–`10`): a small bubble pointing at the element to tap, a brass ring around it, 9 progress dots and Skip. Replaces the big tutorial card, which today covers the chart's goods buttons (`b-chart.jpg`). Works on the sea, the chart and the port screen.
- `b-*.jpg`: the current menu, How to play and tutorial card, for comparison.
