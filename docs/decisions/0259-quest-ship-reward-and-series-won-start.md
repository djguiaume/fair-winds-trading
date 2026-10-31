# 0259. Quest ship reward and series-won start

**Status:** Accepted (2026-10-31).

## Context

The club's Tern prize (0227, 0228) is a fixed `series.prize`. A quest could not give a ship, nor start when a regatta series is won, so the club could not offer a pick-one prize (issue #315).

## Decision

- Reward `ship`: a ship class id, given at stock levels (`giveShip`, shared with `series.prize`). A ship already owned is left alone. The sea is not switched to her.
- Start/goal condition `series-won` (`series`): holds once every race of the series has the winning medal (0217). The book passes the series won to the conditions as `won`.
- A new `series` parameter type, checked against `regatta.json`; both show in the quest builder (reward form, condition picker) and in `npm run quest -- check`, which share the engine's checks.
- The choice card lists the ship in its reward words.

## Consequences

- A club prize can be a `choose` step started by `series-won`, each option giving a different `ship`. Making the Tern prize that way is a content change for the storyteller (and its balance check), not part of this decision.
- Existing quests and saves are unchanged.
