# 0138. Phase 3 release: v0.3.129

**Status:** Accepted (2026-10-24). Guillaume asked to release Phase 3.

## Context

Phase 3, authoring tools and the progression review, is complete on `main` against the "done" definition
in the [roadmap](../roadmap.md) and [0120](0120-communities-and-home-island.md): the quest engine
([0125](0125-quest-engine.md)), the prologue rescue ([0127](0127-prologue-rescue-tutorial.md)), the home
island Skerry with build spots ([0126](0126-home-island-build-spots.md), [0128](0128-build-spots-on-any-island.md),
[0136](0136-warehouse-forecast-and-perks-as-data.md)) and four playable community arcs
([0130](0130-after-a-quest-and-the-saltmere-shoals.md), [0131](0131-calda-slipway-and-cargo-at-a-spot.md),
[0132](0132-westholm-mill-and-babble-voices.md), [0133](0133-stonehaven-light-arc.md)) plus the epilogue
([0134](0134-fair-winds-epilogue.md)). Around them: content and tuning as data and the authoring tools
([0093](0093-data-driven-content-and-authoring-tools.md) to [0114](0114-tuning-panel-and-balance-check.md),
[0135](0135-props-as-data.md)), the bigger-map engine rules and performance work
([0115](0115-bigger-map-engine-rules.md) to [0118](0118-compact-save-code.md)) and night lights
([0121](0121-lighthouse-and-beacon-night-lights.md)). Phase 4's scope is already decided
([0137](0137-phase-4-biomes-and-founded-outposts.md)). The last Phase 3 merge is PR #124. No pull requests
were open at release time.

## Decision

- Release Phase 3 the same way as Phases 1 and 2 ([0062](0062-github-releases-per-phase.md),
  [0092](0092-phase-2-release.md)): the tag is the version the menu shows for the last Phase 3 build,
  **v0.3.129**, on `1fee60c` (the merge of PR #124, deployed with green CI). Notes are in
  [docs/releases/v0.3.129.md](../releases/v0.3.129.md) and are published with the GitHub release workflow
  once this PR is merged.
- The old-tablet `?map=stress` check from the "done" definition ([0116](0116-performance-priorities.md))
  has not been reported yet. Guillaume chose to release without waiting; the test stays recommended
  before Phase 4's bigger map lands, and a regression found there is fixed in Phase 4.
- The same PR opens Phase 4: `package.json` goes to `0.4.0` and the menu label to "Phase 4", so the
  next deploy (the merge of this PR) shows `v0.4.130`.

## Consequences

- Phase 3 has its own save point on GitHub, alongside v0.1.50 and v0.2.73.
- Every new feature from here counts as Phase 4 (expansion and harder seas, [0137](0137-phase-4-biomes-and-founded-outposts.md)).
