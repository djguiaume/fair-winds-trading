# v1.11 #535: one HUD in both views

Follow cam with the full HUD (gold, hold, hull, quest line, heading strip with the port and its distance,
Map, Cargo and Menu with their words, the compass, the speed and the sail lever). Before, the follow
cam dropped all of that.

| Sheet | Shows |
|---|---|
| `top-desktop.jpg` | From above, desktop, the same elements |
| `follow-desktop.jpg` | Behind the boat, desktop |
| `follow-phone-landscape.jpg` | Behind the boat, phone landscape 844x390 |

Rules built (art bible section 13): speed, heading, point of sail, compass, sail lever and the quest line never
fade. Only the view button (under the compass, now on every input) and the Map, Cargo and Menu icons go
to 40% after 6 s without input and come back on any key, touch or stick (`hud.idleFadeSec`, `hud.idleOpacity`).
Settings › Display › Sailing view (from above / behind the boat) is remembered, and so is a switch made with
key C, the pad, a pinch or the button. `src/faded.js` forces the faded state for a still.

## Picks

| Round | Pick | Notes |
|---|---|---|
| 1 | pending | Guillaume and the art director |
