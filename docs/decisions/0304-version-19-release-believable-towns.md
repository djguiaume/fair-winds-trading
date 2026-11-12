# 0304. Version 1.9 release, Believable towns

**Status:** Proposed (2026-11-12). Accepted when Guillaume validates the combined sheets.

## Context

Every part of the [v1.9 brief](../v1.9/brief.md) is merged on `main`: the town rules and check (#513, [0301](0301-town-layout-rules-and-the-believable-town-check.md)), smooth frames (#516, [0302](0302-smooth-frames-work-spread-over-frames-and-shaders-warmed-bef.md)), the ring towns (#514, [0303](0303-believable-ring-towns-streets-rows-round-the-harbour-lanes-o.md)), the far-sea towns (#515), the small fixes (#517, closes #509) and the quest builder split (#492). Guillaume kept all six parts and the v1.8 merge rule: every PR auto-merged, and he validates once from the combined sheets.

## Decision

- **This is an update.** `package.json` goes to `1.9.0` and the menu label to "1.9" ([0042](0042-light-versioning.md), [0219](0219-version-1-0-release.md)).
- **The tag** is the version the menu shows for this PR's merge (v1.9.411 if nothing merges first), published with the release workflow and the notes in `docs/releases/` ([0062](0062-github-releases-per-phase.md)).
- **Open, not blocking:** a phone `?bench` for smooth frames (#377); dark-window houses at Calda, Sunreach and Fogwatch (#525); the moon disc missing on Ultra, already in v1.8 (#526).

## Consequences

- All 16 towns pass the town rules, and town fails are now errors in `npm run check`, so a new layout can't put houses on slopes or in the sea.
- High and Ultra run with no frame of 100 ms or more after warm-up in the headless bench; CI keeps a hitch budget.
