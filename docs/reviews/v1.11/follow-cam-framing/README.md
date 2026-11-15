# Follow-cam framing (v1.11, issue #537)

Three framings inside the art bible §13 limits, built in the game (not mockups). Sheet: [framings.jpg](framings.jpg).
Rows: desktop heading for Saltmere's pier at about 5 kn, the same on a phone in landscape (844x390),
then open sea at about 8 kn on a reach (the camera has climbed and pulled back with speed, and slid
to her high side so the sail leans away from the way ahead).

| Framing | View (vertical) | Back from the boat | Boat centre | Horizon at rest / full speed | Camera over the boat at rest / full speed |
| --- | --- | --- | --- | --- | --- |
| A Low and close | 54° | 20 units (+20% at speed) | 66% | 41% / 37% | 16° / 19° |
| B Mid | 56° | 27 units (+25%) | 65% | 40% / 36% | 17° / 20° |
| C High and wide | 58° | 36 units (+30%) | 66% | 40% / 37% | 19° / 22° |

How it works: each framing is set in screen terms in `camera.json` › `chase.framings` (`boatY`, `horizonY`,
`horizonYFast`, `fovDeg`); the camera's height over the boat and its tilt follow from those, so the
boat and the horizon land where §13 says at any distance. The horizon is the edge of the sea in
the fog, not the true horizon. Speed eases in over 2 s, so the camera never pumps; no roll.

**Why the view is wider than the sea camera's 40°.** With 40° the boat at 65% and the horizon at
40% put the camera only about 12° over the boat, under §13's 14-20°. 54-58° meets both.

**Cost.** Draw calls in the follow cam (High, headless, same scenes, A/B/C): pier 54 → 56/56/57,
open sea 39 → 42/42/40, docked 55 → 59/57/56; triangles +1% to +9% (C sees the most). The wider view shows a few
more boats and islands at the sides. CI's render budget runs the sea camera and does not change.
A 40° variant would keep the calls flat but sits flatter than §13 allows.

## Picks

| Round | Shown | Art director | Guillaume |
| --- | --- | --- | --- |
| 1 (2026-11-15) | A, B, C | B: A puts the sail over the island and harbour at the pier, C shrinks the boat too much on a phone and at 8 kn; wider view OK | |

## Before and after

[before-after.jpg](before-after.jpg): main's follow cam against framing B at Saltmere's pier, desktop and phone.

## After the review

Guillaume (2026-11-15): keep all three. The camera button (C, the pad's right-stick press, the
button under the compass) steps B, C, top view, A (`camera.json` › `chase.cycle`); each framing is
its own entry in `chase.framings`.

## Re-create

```
npm run shots -- --at 173,-70 --heading 120 --speed 5 --chase --quality high --wait 8000 --script docs/reviews/v1.11/follow-cam-framing/src/framing-b.js
npm run shots -- --at 0,-330 --heading 180 --speed 9 --chase --quality high --wait 8000 --script docs/reviews/v1.11/follow-cam-framing/src/framing-b.js
```
