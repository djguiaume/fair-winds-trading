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
