# 0225. Fixed storms in races

**Status:** Accepted (2026-10-28).

## Context

Every race says `storms: false`, so the seeded, drifting storms never blow in a race and the pars
stay fair. v1.1 wants a storm to dodge to give a course its character (`docs/v1.1/plan.md`), which
needs storms that are the same on every run, so the bots can set pars round them.

## Decision

- A race lists its own storms in `race.storms`: `x`, `y`, and optionally `radius`, `strength`
  (0..1) and a slow drift (`driftDeg` bearing, `driftSpeed` units per second). Defaults and limits
  are data: `weather.json` › `raceStorms` (also in the `?tune` panel).
- They are the same on every run: a storm sits at its start until the horn, then drifts from the
  race clock (`src/sim/raceStorms.ts`). They blow on the race's pinned wind with the storm
  physics of decision 0067 (`blowStorm`, shared with the seeded storms), and show in
  `world.weather.storms`, so clouds, rain, the chart and the boats' wind read them. The seeded
  storms stay held (`storms: false`).
- Settings › Storms (and Weather) still turn them off.
- **Pars:** a race with storms keeps one set of pars that holds either way. The bots sail every
  ship class and level with the storms and without, and the par is the slower of the two, so
  no captain is held to a time the other setting made out of reach (`npm run race -- <id> --pars`).
  The balance bots sail in the storm's wind like any boat; they do not route round it.
- **Checks** (`npm run check`): values in range, the whole drift inside the sea, and no storm core
  on the start line, the finish line or a mark while the race can run (followed for the longest
  bronze time). That the course is still sailable is proven when the pars are sailed: the
  command fails if the sloop or cutter cannot get round.
- **Authoring** (decision 0153): drag in the quest builder (storm tool, body moves, gold handle
  sizes, rows for strength and drift) and `npm run race -- <id> --storm …` (add, change, remove),
  one module: `src/editor/quest/raceStormDoc.ts`.
- **Story rule:** no race text may depend on a storm (it may be off); "weather" or "squall" only
  as flavour.

## Consequences

- No shipped race has storms yet; the new v1.1 races add theirs and re-sail their pars.
- Pars of a stormy race cost twice the bot time to write.
- A storm drifting only follows the race clock, so a captain who retires and re-enters meets it
  at its start again.
