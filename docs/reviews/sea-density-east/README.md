# East sea fills (decision 0180)

The east build thread's pieces for [0180](../../decisions/0180-even-density-across-the-four-seas.md), placed with `npm run sea` and `npm run island` only.

| Piece | Where | What |
|---|---|---|
| **The Kittiwakes** | (700, -300), 113° | `islands/the-kittiwakes.json`: a two-tier turf holm with a bird cliff facing south (the camera side) and two basalt stacks; new prop `bird-cliff` (white flecks of nesting birds and three gliding birds, landmarks group, about 190 triangles). 1,022 triangles. |
| **Grey Lady Shoal** | (545, -455), 130° | A basalt (fog style) reef with the old empty wreck as its landmark, and a south cardinal named after it. The only new wreck in the four seas. Neutral, near the 135° seam. |
| **The Smirr** | (820, -205), 103° | A small fog bank over The Race. Felt, not counted as a landmark. |
| **Sandwick Holm** | (545, 455), 50° | `islands/sandwick-holm.json`: a small strand islet (sand, marram top, a cairn, two sheep, driftwood), inside The Grey Murk. 177 units from the north's Old Blue as proposed. 314 triangles. |
| unnamed rocks | (690, 372), 66° | A small basalt rock patch on the Stormbreak's south edge, so the belt's gap stays under r150. |

All pieces sit inside a chart area (Fogwatch Waters, Amber Reach, The Race). Measure after (`density.txt`): east 7% empty, biggest disc r137 at 122°, the deliberate open reach along The Race south of The Kittiwakes. Before: 20% empty, r232 at 119°.

`npm run check` ok; `npm run sea -- check --routes` ok; `npm run balance` 9/9 on all three levels.
