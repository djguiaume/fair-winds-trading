# 0307. Retire the classic look and Kids mode

**Status:** Accepted (2026-11-14). Approved by Guillaume 2026-11-13 (issue #563, whole-game review v1.9 §8).

## Context

The classic extruded-tier island ground (`?look=v1`) was kept "for comparison" since v1.2
([0222](0222-a-new-look-smooth-terrain-blue-water-and-forests.md)). Seven releases later nobody plays it, yet
it was still built, measured by its own render budget and screenshotted, and every ground or town
change had to keep it working. Kids mode was shelved by [0043](0043-shelve-kids-mode.md) and
only its branches and strings remained.

## Decision

- One look: the height-field ground is the only island ground. `TerrainLook`, `?look`,
  the classic terrace pieces (`featureGround`), the `look` argument of the island, town folk,
  lamp and beam builders, and `--look v1` of `npm run shots` are gone.
- One render budget (`tools/performance/budget.json › scenarios`, the former `newLook` numbers);
  CI no longer measures a `?look=v1` run.
- Kids mode is gone: `uiMode`, its trade panel, wind compass and port label branches, and the
  `kids.*`, `kidsWind.*` and `trade.toKids` strings. "Kids mode rework" leaves the roadmap.
- Kept: Ultra-low (the old tablet needs it), `?waves=v1` (the classic sea, a separate switch of
  decision 0245), and `smooth: 0` faceted shapes inside the one look.
- The painted title picture stays until the live title ships (#531); it is removed with that part.

## Consequences

Less code and less CI to carry; ground and town work is checked on one look. A saved `uiMode`
in old settings is ignored. Anyone wanting Kids mode back starts a new decision.
