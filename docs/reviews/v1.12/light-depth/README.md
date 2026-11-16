# Light with depth (#550, part 1: shadows and contact shade)

v1.12 part 3. Goal: by day, in the follow cam, things cast shadows and sit on the ground. Decision
[0319](../../../decisions/0319-shadows-you-can-see-from-the-follow-cam-and-contact-shade.md).

## Sheets (desktop; columns: top before, top after, follow before, follow after)

- [saltmere-high.jpg](saltmere-high.jpg): Saltmere on High, morning, noon, late light.
- [saltmere-ultra.jpg](saltmere-ultra.jpg): the same on Ultra.
- [sea-sunreach-high.jpg](sea-sunreach-high.jpg): open sea (noon, late) and Sunreach (morning, noon), High.

What to look for: the boat's hull and sail shade the water, quays shade the sea, trees and houses
throw longer shadows on the grass and sand, and house walls darken toward their foot.

## One atmosphere still holds (`npm run shots -- --both`, High)

Sea ΔE top vs follow, main → this branch (same poses, `graphics.json` › `sky.check`):

| Place | morning | noon | late (440) |
|---|---|---|---|
| Saltmere (243,-116, heading 120) | 12.5 → 14.3 sun | 14.9 → 12.7 | 15.6 → 17.3 sun |
| Open sea (0,-330, heading 180) | 4.8 → 3.9 ✓ | 5.3 → 4.6 ✓ | 3.1 → 2.3 ✓ |
| Sunreach (-95,-485, heading 180) | 40.9 → 40.6 | 39.8 → 40.8 | 37.3 → 38.1 |

- The **golden-hour open sea exception** from #573 (ΔE 7.2) measures 3.1 on today's main and 2.3
  with this part: it passes. The boat's shade now also hides the glint right under the follow cam.
- Saltmere and Sunreach fail on main too at these poses: from above the camera sees deep water,
  from behind the near shallows (Sunreach's follow cam looks into its lagoon). The #573 sheets used
  other poses; nothing here moved by more than 2.
- The top view itself (the reference) changes by sea ΔE ≤ 3.4 and land ≤ 7.4, the land where the
  new shadows fall.

## Cost (`npm run perf`, headless 1280×800)

| | main | this part |
|---|---|---|
| High, sailing: draw calls / triangles / graphics memory | 29 / 155k / 58 MB | 31 / 154k / 62 MB |
| High, docking | 31 / 119k / 58 MB | 32 / 119k / 62 MB |
| Ultra at 4K, sailing: graphics memory | 334 MB | 334 MB (budget 355) |

Real devices: `?bench&quality=high` against `&off=shadows` and `&off=contact` in the device round (#377).

## Re-run

`npm run shots -- --list <list> --both --quality high --sizes desktop` with the nine poses above
(times 100, 250, 440); the sheet is three PNG pairs per row, scaled to 320 px.

# Part 2: the sun on the sea, through the sails and in the haze

Decision [0321](../../../decisions/0321-the-sun-on-the-sea-through-the-sails-and-in-the-haze-the-gol.md).

[sun-high.jpg](sun-high.jpg) (High, desktop; columns: top before, top after, follow before, follow
after; before = part 1): open sea looking into the sun at morning (60), noon (250), late (370),
Saltmere late (375) and dusk (440).

What to look for: a glittering path on the sea under the sun (points close by, a smooth bright
path far off), sails lit warm at their edges when the sun is behind them, the haze warming toward
the sun so the far sea runs into the sky's glow, and at dusk the light and the disc both in the
west, then the moon's path.

| Pose (heading into the sun) | sea ΔE top vs follow, part 1 → part 2 |
|---|---|
| Open sea morning | 1.3 → 2.0 ✓ |
| Open sea noon | 4.4 → 3.9 ✓ |
| Open sea late | 2.6 → 5.0 ✓ (the glitter path is in the follow view only, as it should be) |
| Saltmere late | 16.8 → 17.7 (fails on main too: deep water from above, shallows from behind) |
| Open sea dusk (440) | 3.7 → 4.0 ✓ |

Cost (`npm run perf`, headless, against part 1): High sailing 31 draw calls, 155k triangles, 62 MB,
all unchanged; Ultra at 4K 334 MB (budget 355). The glitter is a few lines in the sea shader on
High and Ultra only; the haze and the sail light are a few lines in materials already drawn.

Switches: `?off=glitter`, `?off=sunlight` (graphics-switches.json); numbers in `graphics.json` ›
`water.glitter` and `sunlight`; the light path in `weather.json` › `daylight.moonRise`, `moonSet`.
