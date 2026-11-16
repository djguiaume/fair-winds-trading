# Night light (#547)

v1.12 part 3, after light with depth (#550). Decision
[0323](../../../decisions/0323-night-light-lantern-pools-the-moon-as-key-light-a-moon-path-.md).

## Sheets (desktop; columns: top before, top after, follow before, follow after)

- [night-high.jpg](night-high.jpg): High. Open sea at moonrise (time 510, into the moon), at
  midnight (555, moon high), and Saltmere harbour (510).
- [night-medium.jpg](night-medium.jpg): the same on Medium (no glitter on Medium: pools only).
- [day-path-high.jpg](day-path-high.jpg): late sun (370), part 2 against this: the sun's path now
  runs on through the haze to the horizon.

What to look for: a warm pool of light on the quay and the water under the pier lantern and in
the town, the moon's glitter running out toward the horizon, lit faces cool and shaded faces a
deeper blue, never black.

## Checks (`npm run shots -- --both`)

| Pose | High sea ΔE, before → after | Medium sea ΔE, before → after |
|---|---|---|
| Open sea, moonrise | 3.1 → 2.3 ✓ | 2.0 → 2.0 ✓ |
| Open sea, midnight | 1.5 → 0.7 ✓ | 3.5 → 3.1 ✓ |
| Saltmere harbour | 9.7 → 8.5 ✓ | 10.3 → 10.5 (fails on main too; ±2 run to run) |
| Open sea, late sun (day) | 2.6 → 2.6 ✓ | |

Night floor: the top-view sea averages L 26.2 to 28.6 against `#1d3d7a`'s 26.7, as on main; the
pools only add light.

## Switches and numbers

`?off=pools` (graphics-switches.json); `graphics.json` › `lamps.pool`, `shadows.nightContrast`,
`water.glitter.moon`, `far`, `haze`.

## Cost (`npm run perf`, headless, against #550 part 2)

High sailing 31 draw calls, 155k triangles, 62 MB; docking 32 / 120k / 62 MB; Ultra at 4K 334 MB
(budget 355). All unchanged: the pools are six distance tests per pixel in shaders already drawn.
Device round: `?off=pools`.
