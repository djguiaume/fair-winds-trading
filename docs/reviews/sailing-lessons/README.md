# Sailing lessons: screenshots

Decision [0164](../../decisions/0164-sailing-lessons-quest.md). Taken with `npm run shots` (the list is below) and the quest builder.

| | |
|---|---|
| ![Pause menu](1b-pause-menu-desktop.png) The menu line, once the tutorial is seen | ![Start](1-start-from-menu-desktop.png) Started from the far west: the boat is taken to Rook's course off Saltmere, sails down |
| ![Buoy A](3b-buoy-a-close-desktop.png) Tacking up to buoy A, the yellow practice buoy | ![Reach](4-reach-desktop.png) Beam reach to buoy B |
| ![Chart](6-chart-desktop.png) Both buoys on the chart while the lessons run | ![Builder step](8-builder-step.png) Quest builder: the boat start (⛵) and the buoys (◍) |
| ![Builder quest](7-builder-quest.png) Quest builder: the quest's wind and sea marks | |

Shots list (`npm run shots -- --list list.json`): `{ "at": [-250, 120], "click": "#menu-btn;#menu-tutorial", "storage": { "fwt.tutorial.v1.Windward Ring": "{\"status\":\"completed\"}" } }`, then `"quest": "sailing-lessons:<step>"` with `at` near each buoy.
