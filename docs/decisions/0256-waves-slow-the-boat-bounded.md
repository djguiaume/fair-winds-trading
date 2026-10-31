# 0256. Waves slow the boat, bounded

**Status:** Accepted (2026-10-31). Issue #284 (v1.3.1). Guillaume approved the tuning and the 5.25 min balance target.

## Context

v1.3 put real waves on the sea (0245-0250) and #283 made the boats ride them (0253), but sailing ignored them: a sloop beat into a storm sea as fast as on a pond. #284 asks for a modest, readable wave effect on speed that does not replace the sailing model, does not double-count storms, currents or wind, and keeps the no-go zone, tacking, sails and docking as they are. No capsize, damage, cargo loss, surfing boost or sideways push.

## Decision

- **One rule, on top of the polars** (`src/sim/seaDrag.ts`): the waves take a share off the speed she settles at, `target × (1 − drag)`, and change nothing else in `stepBoat`. The rudder, no-go zone, sails, leeway, currents and mooring are untouched; speed eases to the lower target at the ship's own `decel`, so there is no jolt.
- **The share:** `perUnit (0.05) × (swell height × 1 + chop height × 0.5) × heading share × hull share`, capped at **10 %** in any storm.
  - Heading share: 1 head on, 0.4 abeam, 0.1 dead astern, linear between; a confused sea (low coherence) counts as abeam from every side. Never negative: no surfing.
  - Hull share: 1 for a small hull (radius 4.5, sloop) down to 0.5 for a big one (radius 9.5, indiaman), by size. Upgrades do not change it.
- **The sea is the sim's sea state** (`seaStateAt` at the boat, read every 2 s; a quest's or race's held breeze raises its settled sea), not what is drawn: every quality level, frame rate, Settings › Waves (drawn) and the balance bots get the same speeds.
- **Same rule on every level.** 0083 says the boat sails the same at every level; the harder levels' rougher weather (more gales) raises rougher seas by itself. No per-level knob.
- **Every boat:** the player, traffic and race rivals. The balance model's leg times use the same function in the settled sea of each wind.
- **Readable:** a line under the HUD wind, "Waves −4%", once the share passes 2 % while she makes way under sail.
- **Switchable:** Settings › Waves slow the boat (on by default), like every hazard.
- Typical shares (`npm run sea -- drag`): 14 kn breeze, sloop close-hauled 3.6 %, beam 1.8 %, running 0.5 %; indiaman close-hauled 1.6 %. Storm: sloop 10 % (cap), indiaman 4.7 %.
- No double counting: storms already change wind, heel, cargo and gloom, never speed directly; currents act over the ground; the shallows' drag is separate and near the coast the boat is slow anyway.

## Consequences

- Balance (`npm run balance`, all three levels): sloop legs +1 to +2 s median (61/66/64 s to 62/67/66 s); cutter on Fair/Captain/Old salt 20.0/27.4/37.2 to 20.2/27.5/37.7 min. Every check passes except the sharp captain's first upgrade, 5.0 to 5.1 min against "≤ 5 min": the target moves to 5.25 min (`balance-targets.json`, `docs/economy.md`); the storyteller agreed to keep the upgrade price; pending Guillaume's OK.
- Race pars are re-sailed by the bots with the waves and written to the quest files: median +1.6 %, 9 in 10 within +4 %; a few heavy-ship pars moved more where the bot's route changed (most were already estimates).
- Tuning: `waves.json › drag` in the `?tune` Waves tab and `npm run sea -- waves waves.drag.max=0.08`; the table: `npm run sea -- drag`.
- Not done: coast calm and island shelter do not lower the drag yet (the coast bake is render side); the drawn sea in a held-breeze race still follows the map's weather.
