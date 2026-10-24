# 0148. Balance checks sail each level's real wind, wind zones and currents

**Status:** Implemented (2026-10-24). Follows [0046](0046-phase-1-economy-tuning.md), [0083](0083-difficulty-levels.md), [0114](0114-tuning-panel-and-balance-check.md), [0144](0144-wind-zones-in-the-sim.md) and [0145](0145-building-currents.md).

## Context

The balance simulation (`src/sim/balance.ts`, run by `tests/economy-balance.test.ts`, `tests/difficulty-balance.test.ts` and the `?tune` balance check) timed every leg with one made-up wind range: the map's prevailing wind ±50° (±10° on Fair winds) at 0.8–1.1 × its strength, averaged. The real game is rougher. On Captain and Old salt the wind takes a new direction every 3 minutes, up to 75° from the last one, so over a voyage it comes from any quarter ([0026](0026-slow-weather-shifts.md), [0064](0064-wind-from-every-quarter.md)); one spell in six is a calm at 35–55 % strength and gales come 8 / 15 / 22 % of the time. Since 0145 the water moves too (the Gap Run, 1.8 kn × 0.6 / 1 / 1.2), and the bots ignored it.

Guillaume (2026-10-24): balance and timings must be measured on **all three levels**, because on Captain and Old salt the wind moves a lot.

## Decision

1. **Each leg is sailed in the game's own wind at that moment.** A voyage has a weather seed. Every leg is cut into stretches of at most 40 units. Each stretch is timed in `windAt` at the stretch's middle when the boat gets there. That is the level's weather walk from `weatherFor`: steady on Fair winds, wandering on Captain and Old salt, with calms, rain and gales, the wind regions, and the live wind zones. The boat's speed uses `drivingWind` like the game. Storms are left out, because they are moving cells that a captain sails round.
2. **Currents count.** Each stretch adds the current along the course (`CurrentField.at` at the level's `currents` strength). The speed over the ground never goes below 0.5 kn, so a calm against a current still ends. The bots pick their next load from these times, so like a player they see the wind and the water before they leave.
3. **The median of five seeds.** One voyage's weather can be lucky or unlucky. The sharp captain went from 13 to 18 minutes to the cutter across seeds. So every captain is now sailed on seeds 1–5 (`balance-targets.json` › `economy.seeds` and `difficulty.seeds`), and each milestone is the median. The 40-minute checks use the median voyage, and the "no single route" check takes the median route share.
4. **New checks on every level** (`difficulty` targets):
   - *Sloop legs take about a minute on every level:* every pair of charted ports, leaving every 5 minutes of each seed's two hours, in that level's wind and currents. The median must be 40–90 s and 9 legs in 10 must take under 150 s.
   - *Currents change the pace a little, not the balance:* the relaxed captain also sails with Settings › Currents off. With currents on, his cutter must come within 15 % of that time.
5. **Route checks with currents.** `routeChecks` (editor and tests) now plans with the currents at the strongest level's speed (Old salt, 1.2). An opposing current can only make a route harder to find, so a port reachable there is reachable on every level and with currents off.
6. The averaged `legSeconds` (the "about a minute" check of the 40-minute game, and the wind-zones test) keeps its wind range and adds the currents at Captain's strength.

## The numbers (Windward Ring, median of 5 seeds)

| Level | Captain | 1st upgrade | Cutter | Cutter maxed | 1st town | Repairs |
|---|---|---|---|---|---|---|
| Fair winds | sharp | 2.3 min (was 2.4) | 9.4 (9.0) | 40.2 (38.2) | 12.7 (12.4) | 0 % |
| Fair winds | relaxed | 5.3 (5.4) | 20.6 (20.8) | 65.6 (66.5) | 35.2 (30.6) | 1 % |
| Captain | sharp | 4.7 (4.9) | 14.1 (14.5) | 43.1 (46.1) | 23.4 (24.1) | 0 % |
| Captain | relaxed | 7.3 (7.3) | 28.0 (24.8) | 81.1 (80.2) | 57.5 (59.9) | 3 % |
| Old salt | sharp | 4.7 (4.9) | 14.1 (14.5) | 60.4 (never) | 31.4 (31.6) | 0 % |
| Old salt | relaxed | 7.6 (7.5) | 38.4 (30.8) | 110.9 (101.7) | 78.2 (63.2) | 10 % |

"Was" is the old averaged wind on main before this change.

| Level | Sloop leg, median | 9 in 10 under | Relaxed cutter, currents off → on |
|---|---|---|---|
| Fair winds | 64 s | 136 s | 20.6 → 20.6 min |
| Captain | 69 s | 132 s | 28.0 → 28.0 min |
| Old salt | 67 s | 132 s | 35.3 → 38.4 min |

In plain words:

- **Every target still holds on every level.** No price or tuning number had to change.
- **Fair winds hardly moves.** Its steady wind was already close to the old model.
- **Captain is about 3 minutes slower** for a relaxed player to reach the cutter (28 min, limit 32). The sharp player is unchanged (14 min, target 9–16).
- **Old salt is the one the old model flattered.** The relaxed cutter comes about 8 minutes later (38 min, target 28–55), and the first town about 15 minutes later (78 min). The levels now spread out the way they feel to play.
- **Legs take about a minute on every level.** The median is 64–69 s, and 9 in 10 take under about 2¼ minutes. The slowest ones are a calm with the wind dead ahead, up to about 5 minutes.
- **The Gap Run barely changes the economy on Captain and Fair winds.** On Old salt, at 1.2 × strength, it costs the relaxed captain about 3 minutes (9 %). Bots that take the cargo they like best do not always avoid sailing against it.
- **Watch: Saltmere ↔ Calda.** With orders, the sharp captain sails it for 29 % of the legs (median of the seeds), just under the 30 % limit. In the old model it was 25–30 %. It is the shortest route, so it suffers least when the wind is bad. If a later change pushes it over the limit, look at the economy (with the storyteller) rather than relaxing the target.

## Consequences

- Changing the weather (`weather.json`), a level's weather knobs, the wind zones or the currents now moves the balance checks, as it moves the game.
- The `?tune` balance check takes about twice as long (the median of 5 seeds, and the currents-off run). It still runs in its worker.
- The Phase 4 seas, with their trade belts, doldrums and stronger currents, will be measured the same way once their maps exist. The targets are still set on the Windward Ring.
- Storms are still outside the simulation; their cost is the cargo and the hull, which the relaxed captain's random damage stands in for.
