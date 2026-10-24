# Game controller: sailing and the chart (decision 0162)

Screenshots of the real game driven by a fake standard controller (`npm run shots -- --list docs/reviews/controller/shots.json`, the `--pad` option).

| Shot | What the pad did |
| --- | --- |
| `1-sea-toast-*` | Connected (the toast), left stick held left 1.5 s (the boat turned from 200° to 130°), LB once (sails Full to Half) |
| `2-chart-*` | Y (chart opens), RT twice (zoom in), left stick left (pan); the names are placed again once the view stops |
| `3-help-*` | Menu (pause), then How to play: the Controller line shows once a pad has been seen |
| `3-help-fr-desktop` | The same in French |

Mapping (`src/data/controls.json` › `gamepad`):

- **At sea:** left stick or D-pad steer; RB/RT/D-pad up raise the sails one step, LB/LT/D-pad down lower them; B strikes all sails (stops, docks near a port); A opens the harbour when docked; Y or View the chart; Menu pauses; right stick zooms the camera.
- **Chart:** left stick or D-pad pan; RT/RB zoom in, LT/LB out; X the whole sea; B, Y or View back.
- **Menus, harbour, cards:** the "Add controller support for menus" work (presses go to `GamepadPoller.onMenuPress`).
