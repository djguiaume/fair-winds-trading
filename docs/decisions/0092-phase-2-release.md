# 0092. Phase 2 release: v0.2.73

**Status:** Accepted (2026-10-23). Guillaume asked to start the Phase 2 release.

## Context

Phase 2, living settlements, is complete on `main`: settlement levels and growing towns
([0059](0059-settlement-levels.md), [0060](0060-growing-town-visuals.md)), workshops and rare goods
([0063](0063-specialized-town-goods.md), [0065](0065-rare-goods-from-the-far-yards.md)), help orders
([0069](0069-help-orders.md)), weather, storms and day and night ([0064](0064-wind-from-every-quarter.md),
[0067](0067-weather-states-and-storms.md), [0068](0068-day-and-night.md)), save transfer
([0066](0066-move-voyage-between-devices.md)), solid harbours and hull-aware docking, the refined hoy, fluyt and
indiaman, difficulty levels ([0083](0083-difficulty-levels.md)) and the translation pass
([0091](0091-translation-quality-pass.md)). The last Phase 2 merge is PR #67.

## Decision

- Release Phase 2 the same way as Phase 1 ([0062](0062-github-releases-per-phase.md)): the tag is the
  version the menu shows for the last Phase 2 build, **v0.2.73**, on `0963490` (the merge of PR #67).
  Notes are in [docs/releases/v0.2.73.md](../releases/v0.2.73.md) and are published with the
  GitHub release workflow once this PR is merged.
- The same PR opens Phase 3: `package.json` goes to `0.3.0` and the menu label to "Phase 3", so the
  next deploy (the merge of this PR) shows `v0.3.74`.
- The French one-picture roadmap (PR #48) is not part of the release; Guillaume is closing it.

## Consequences

- Phase 2 has its own save point on GitHub, alongside v0.1.50.
- Every new feature from here counts as Phase 3 (fleet and automated trade routes).
