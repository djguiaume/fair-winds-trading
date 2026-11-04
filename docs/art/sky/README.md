# Chase camera sky (issues #469, #470, decision 0284)

The close chase view's light and its drawn sky. Shots: High, desktop, the chase view at
(155, 84) heading 250 unless noted, against `main` before the change.

| Sheet | What |
| --- | --- |
| [1-sky-looks-day.jpg](1-sky-looks-day.jpg) | Now, then looks A, B, C by day (top of the screen, actual size) |
| [2-conditions-1.jpg](2-conditions-1.jpg) | Now / A: golden hour (heading 100), sunrise (heading 92, sun disc), night, storm |
| [2-conditions-2.jpg](2-conditions-2.jpg) | Now / A: fog bank (The Haar), Low, Ultra |
| [3-flatter-chase.jpg](3-flatter-chase.jpg) | Option: look A with the chase tilt at 11° instead of 15° |
| [4-picked-desktop.jpg](4-picked-desktop.jpg) | Round 1 pick: A tweaked at 11°, default and closest chase zoom (stern wake) |
| [5-picked-phone.jpg](5-picked-phone.jpg) | The same on a phone in landscape (844×390) |

Looks (A is the shipped `graphics.json` › `sky`; the others are `?tune` changes on top of it):

- **A Clear blue:** smooth gradient from a pale horizon to a mid blue, 16 scattered cumulus.
- **B Painted bands:** [looks/b-bands.json](looks/b-bands.json), the gradient in 4 flat bands like
  the low-poly ground, 10 bigger clouds.
- **C Soft haze:** [looks/c-haze.json](looks/c-haze.json), paler and softer, 28 small clouds.
- **Flatter chase tilt:** [looks/flatter-chase.json](looks/flatter-chase.json), any look with more sky.

Remake: `npm run shots -- --chase --at 155,84 --heading 250 --quality high --sizes desktop`
plus `--tune docs/art/sky/looks/b-bands.json`, `--time 695 --heading 92` (sunrise), `--night`,
`--script docs/art/sky/storm.js --sail 0` (a storm's light held at the boat), or `--at 640,-70`
(fog bank).

## Rounds

| Round | Picked | Rejected | Notes |
| --- | --- | --- | --- |
| 1 (2026-11-04) | Art director: A, chase tilt 11° (Guillaume's pick pending) | B, C | Top blue less saturated (#5aa0d4), 13 clouds instead of 16; horizon clear of the status line and compass on a phone; stern wake shows at the closest zoom |
