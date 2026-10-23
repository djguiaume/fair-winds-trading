# 0083. Difficulty levels: same sailing, different costs

**Status:** Accepted and implemented for review (2026-10-22). Guillaume: "i agree that there should be multiple levels", asked for the wind to be part of it, then "start working on it". Proposal, numbers and mockups: [docs/reviews/difficulty/](../reviews/difficulty/README.md).

## Context

Guillaume: the game "can be difficult which is a good and a bad thing". Difficulty today comes from crashes and repairs (0032, 0038), cargo overboard (0067, 0074), weather and storms (0067), night (0068), economy pace (0046) and town growth gates (0059, 0065). Only weather, storms and night can be turned off, and only as all-or-nothing switches. The audience is sailing fans (2026-10-20), so the sailing itself must stay honest.

## Decision

- Three presets picked on New voyage and changeable any time in Settings: **Fair winds**, **Captain** (today's game, the default) and **Old salt**.
- Sailing is identical at every level (polars, no-go zone, tacking, shallows, wind, press warning). Presets change only costs and pace: cargo overboard (off / 1 / 2 units), crash damage (× 0.5 / 1 / 1.5), repairs (1 / 2 / 3 g per point), the port's cut (2 / 6 / 11 %), order rewards (× 2.0 / 1.5 / 1.25), start gold (250 / 150 / 100), town growth needed (× 0.75 / 1 / 1.25), wind direction (a steady trade wind within ± 20°, usually ± 10°, on Fair winds, today's dynamic wind on Captain and Old salt), gale share (8 / 15 / 22 %) and storm interval (15 / 10 / 7 min).
- The Settings switches (night, weather, storms, pirates from Phase 5) stay global and independent of the preset. A new **Wind: Steady / Shifting** choice joins them; the preset only sets its default (Steady on Fair winds).
- The preset is saved with the voyage as an optional `difficulty` field (older saves load as Captain), plus the easiest level used, for racing missions later.
- Kids mode, when reworked (0043), is Kids UI on top of Fair winds.

## Consequences

- Knobs live in `src/sim/difficulty.ts`; `setDifficulty` applies a level at once (orders already posted keep their reward), `startVoyage` also sets the start gold. The wind eases over 60 s when the level or the Wind setting changes.
- `tests/difficulty-balance.test.ts`: a relaxed captain reaches the cutter after about 21 / 25 / 31 min and the first town after 31 / 60 / 63 min on Fair winds / Captain / Old salt; a careless captain pays 1 / 3 / 10 % of income in repairs. `tests/difficulty.test.ts` covers each knob, saves and the steady wind.
- The 0046 balance targets keep describing Captain, which is unchanged.
- Every future hazard (pirates in Phase 5) needs a Settings switch and a per-preset scale.
