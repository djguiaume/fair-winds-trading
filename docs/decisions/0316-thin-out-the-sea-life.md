# 0316. Thin out the sea life

**Status:** Accepted (2026-11-15).

## Context

Guillaume's v1.12 playtest: there is always something next to the player. The wake gulls follow the boat all the time, and the harbour gulls, terns, shoals and dolphins add to it.

## Decision

Tune `sea-life.json` only (`npm run life`): wake gulls 5 to 2 and range 90 to 60, harbour gulls 12 to 10, terns 8 to 5, shoals 6 to 4 with range 40 to 140, dolphins every 60 to 150 s (was 35 to 90). The whale and the quality and Settings switches are unchanged. Sea life is drawn only, so balance is unchanged (checked on all three difficulties).

## Consequences

Sea life reads as a surprise, not constant company. Before and after: `docs/reviews/v1.12/sea-life-before-after.jpg`. If still too much, lower the wake gulls to 0 first.
