# 0072. No storms during the tutorial or special events

**Status:** Implementation for review (2026-10-22)

## Context

Storms ([0067](0067-weather-states-and-storms.md)) cross the sea every 10 minutes, so the first one can arrive 5 to 9 minutes into a new voyage, while the tutorial is still running. Guillaume: storms should never come during the tutorial, or during special events such as the planned delivery races with fixed wind and weather (roadmap, "Fixed difficulty parameters").

## Decision

- **A general hold:** `holdStorms(world, reason, held)` in `src/sim/world.ts` adds or removes a reason in `world.stormHolds`. While any reason is listed, no storm blows, whatever the Settings say. The rest of the weather (calm, rain, gale spells) and the turning wind carry on.
- **The tutorial holds storms** while it is active (reason `'tutorial'`, synced every step in `Tutorial.observe`). Skipping or finishing the lesson lets them go.
- **Special events** (delivery races and similar, later phases) hold them the same way with their own reason, e.g. `'event'`. A race with a deliberate storm will pin its own weather rather than rely on the random tracks.
- **No storm pops up when storms come back.** Whenever storms return (end of a hold, or the Settings switches turned back on), only storms that form after that moment count (`world.stormsFrom`, passed to `stormsAt` as `from`). A storm already under way stays away until it has crossed the sea, and the next one forms at the edge as usual, with its warning.
- Nothing new is saved. A resumed voyage simply starts the hold again if its tutorial is still running.

## Consequences

- New players learn to sail and trade before meeting their first storm.
- Holds are reasons, not a single flag, so the tutorial and an event can overlap without one releasing the other's hold.
- Turning storms back on in Settings no longer drops you into the middle of one.

**Validation:** `tests/weather.test.ts`, "storms held back (0072)". It checks:

- no storm while held, and none popping up when let go
- the next storm forms as usual
- the tutorial holds storms and skipping it releases them
