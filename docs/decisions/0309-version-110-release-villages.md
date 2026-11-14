# 0309. Version 1.10 release, Villages

**Status:** Proposed (2026-11-14). Becomes Accepted when Guillaume validates the combined sheets.

## Context

Every part of the [v1.10 brief](../v1.10/brief.md) is merged on `main`: the organic village rules (#528, [0306](0306-organic-village-town-rules-replace-the-row-rule.md)), the ring towns and far-sea towns redone with the follow-cam check (#528, #544, [0308](0308-ring-towns-rebuilt-as-villages-village-rules-now-hard.md)), the night fixes (#525 lit windows, #526 Ultra moon, #543 lamp halos), the follow-cam look (#539 wake, #540 streaks, #541 beam, #542 mirror), the arrival card (#538) and the retired classic look and Kids mode (#563, [0307](0307-retire-the-classic-look-and-kids-mode.md)). Guillaume kept all seven parts and the v1.9 merge rule: every PR auto-merged, one review at the end.

## Decision

- **This is an update.** `package.json` goes to `1.10.0` and the menu label to "1.10" ([0042](0042-light-versioning.md)).
- **The tag** is the version the menu shows for this PR's merge (v1.10.74 if nothing merges first), published with the release workflow and the notes in `docs/releases/` ([0062](0062-github-releases-per-phase.md)).
- **Guillaume's review** is one pass over [docs/reviews/v1.10](../reviews/v1.10/README.md).

## Consequences

- Open for later: a phone and tablet `?bench` for the follow-cam and night changes (#377), Westholm's millpond, a light spill under lit windows seen from above, Sunreach's crescent layout.
- Next is v1.11 "Welcome aboard" (#531 to #537, #560), then v1.12 "Light and water" and v1.13 "Soft and rich" ([review order, #568](../reviews/whole-game-v1.9/README.md)).
