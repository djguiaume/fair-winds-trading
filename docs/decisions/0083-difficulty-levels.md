# 0083. Difficulty levels: same sailing, different costs

**Status:** Proposed (2026-10-22), waiting for Guillaume's pick. Full proposal, numbers and mockups: [docs/reviews/difficulty/](../reviews/difficulty/README.md).

## Context

Guillaume: the game "can be difficult which is a good and a bad thing". Difficulty today comes from crashes and repairs (0032, 0038), cargo overboard (0067, 0074), weather and storms (0067), night (0068), economy pace (0046) and town growth gates (0059, 0065). Only weather, storms and night can be turned off, and only as all-or-nothing switches. The audience is sailing fans (2026-10-20), so the sailing itself must stay honest.

## Decision (proposed)

- Three presets picked on New voyage and changeable any time in Settings: **Fair winds**, **Captain** (today's game, the default) and **Old salt**.
- Sailing is identical at every level (polars, no-go zone, tacking, shallows, wind, press warning). Presets change only costs and pace: cargo overboard (off / 1 / 2 units), crash damage (× 0.5 / 1 / 1.5), repairs (1 / 2 / 3 g per point), the port's cut (3 / 6 / 9 %), order rewards (× 1.8 / 1.5 / 1.3), start gold (250 / 150 / 100), town growth needed (× 0.75 / 1 / 1.25), gale share (8 / 15 / 22 %) and storm interval (15 / 10 / 7 min).
- The Settings switches (night, weather, storms, pirates from Phase 5) stay global and independent of the preset.
- The preset is saved with the voyage as an optional `difficulty` field (older saves load as Captain), plus the easiest level used, for racing missions later.
- Kids mode, when reworked (0043), is Kids UI on top of Fair winds.

## Consequences

- Balance preview (`tests/difficulty-preview.test.ts`): a relaxed captain reaches the cutter after about 19 / 25 / 40 min on Fair winds / Captain / Old salt.
- The 0046 balance targets keep describing Captain; each other preset gets its own pace targets when built.
- Every future hazard (pirates in Phase 5) needs a Settings switch and a per-preset scale.
