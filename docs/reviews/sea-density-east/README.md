# East sea fills (decision 0180)

The east build thread's pieces for [0180](../../decisions/0180-even-density-across-the-four-seas.md), placed with `npm run sea` and `npm run island` only.

| Piece | Where | What |
|---|---|---|
| **The Kittiwakes** | (700, -300), 113° | `islands/the-kittiwakes.json`: a two-tier turf holm with a bird cliff facing south (the camera side) and two basalt stacks; new prop `bird-cliff` (four nesting birds and two gliding birds, landmarks group); boulders, a cairn and two sheep on the top tier. 884 triangles. |
| **Grey Lady Shoal** | (545, -455), 130° | A basalt (fog style) reef with the old empty wreck as its landmark, and a south cardinal named after it. The only new wreck in the four seas. Neutral, near the 135° seam. |
| **The Smirr** | (820, -205), 103° | A small fog bank over The Race. Felt, not counted as a landmark. |
| **Sandwick Holm** | (545, 455), 50° | `islands/sandwick-holm.json`: a small strand islet (sand, marram top, a cairn, two sheep, driftwood) with a ragged marram top, inside The Grey Murk. 350 triangles. |
| unnamed rocks | (690, 372), 66° | A small basalt rock patch on the Stormbreak's south edge, so the belt's gap stays under r150. |

All pieces sit inside a chart area (Fogwatch Waters, Amber Reach, The Race). Measure after (`density.txt`): east 7% empty, biggest disc r137 at 122°, the deliberate open reach along The Race south of The Kittiwakes. Before: 20% empty, r232 at 119°.

`npm run check` ok; `npm run sea -- check --routes` ok; `npm run balance` 9/9 on all three levels.

Art director (2026-10-25): approved with three fixes, all done: fewer, bigger birds; detail on the Kittiwakes' top tier; a ragged marram outline on Sandwick Holm. The suggested guano streaks as vertex colour down the cliff face need builder support (a ground side colour band) and are left for later. Storyteller: the rock patch stays unnamed; sheep are fine.
