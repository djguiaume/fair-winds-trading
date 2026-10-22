# 0074. Cargo overboard only when the wind really presses her

**Status:** Implementation for review (2026-10-22)

## Context

Cargo overboard ([0067](0067-weather-states-and-storms.md)) read the heel the boat is drawn with: past 20° for 2.5 s, or a lurch faster than 22°/s past 16°. Playtesters lost cargo in normal weather (Guillaume, 2026-10-22). A 40-minute simulation of ordinary sailing under full sail, tacking or gybing every 25–45 s, showed why:

- **The drawn heel is exaggerated** (1.3× real, so it reads from the high camera, [0044](0044-visual-heeling.md)). Slim rigs lean extra on top of that: schooner ×1.15, cutter and clipper ×1.05. In a 16–17 kn breeze a schooner passes 20° for long stretches.
- **The hull swings past its mark on every tack:** the springy "lively" feel overshoots, up to 26.5° against a 23° cap. Crossing from one side to the other counted as a lurch.
- **Measured losses** with storms off, in breeze and rain only:

  | Ship     | Units lost |
  | -------- | ---------- |
  | Schooner | about 50   |
  | Cutter   | about 30   |
  | Clipper  | about 27   |
  | Sloop    | 7          |

## Decision

The rule now reads **how hard the wind presses her**, from the same inputs as the heel but before any of the drawing:

- **Inputs:** the wind she feels (gusts, island lee, channels), the point of sail, the sail area and luffing.
- **The measure** is expressed as the wind that would press a full-sailed sloop on a beam reach as hard (wind × drive^0.8, the inverse of the heel curve). It is averaged over 4 s so a gust stands out.
- **Too heavy:** pressed past **19.5 kn** (averaged) for **3 s** throws one unit. Breeze and rain stay under it (at most about 18.5 and 19.3 kn). A gale or a storm under full sail passes it.
- **Too sudden:** a gust more than **4 kn** above the average while she is already pressed past **18 kn** throws one unit at once, at most every 3 s. Tacks and gybes no longer count, because the wind does not jump when you turn.
- **Ship classes:** slim rigs are no longer punished for leaning more on screen. Stiff hulls (haulers, warships: heel factor below 1) stand up to proportionally more.
- **Unchanged:** easing to half sail, bearing away or pointing higher keeps the cargo. Nothing is lost alongside.

The drawn heel is unchanged.

## Consequences

- Normal weather never costs cargo. Gales and storms under full sail still do, which keeps Guillaume's "lower the sails or read the wind" idea.
- Tuning knobs: `OVERPRESSED_KN`, `HEAVY_SECONDS`, `LURCH_GUST_KN` and `LURCH_PRESS_KN` in `src/sim/world.ts`.
- Visual heel tuning (camera exaggeration, per-class factors, spring feel) no longer changes gameplay.

**Validation:** `tests/weather.test.ts`:

- **New test, every ship** (sloop, cutter, schooner, clipper, hoy, fluyt): 15 minutes of breeze and rain spells with gusts, island effects, hard turns each way every 31 s. Nothing is lost. The old rule fails it.
- **New test:** a hard gust throws cargo when she is already pressed, and does not in a light breeze.
- **Existing tests:**
  - losses under full sail in a gale
  - none with eased sails
  - none alongside
