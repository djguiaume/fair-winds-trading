# 0329. Version 1.13 release, Soft and rich

**Status:** Accepted (2026-11-16). Guillaume validated the review sheets ("ok") after one review at the end.

## Context

Every part of the [v1.13 brief](../v1.13/brief.md) is merged on `main`: soft surface patterns near the camera ([0327](0327-soft-surface-patterns-near-the-camera-and-smooth-hulls.md), #572), the boat up close with helmsman and spray ([0326](0326-the-boat-up-close-and-spray.md), #553, #554), follow cam sound ([0325](0325-follow-cam-sound.md), #555), boat previews on the game's own sea and sky ([0328](0328-boat-previews-on-the-games-own-sea-and-sky.md), #629), the Free Sailing setup layout (#630) and the phone wind icon (#631). Merge rule: every PR auto-merged, one review at the end.

## Decision

- **This is an update.** `package.json` goes to `1.13.0` and the menu label to "1.13" ([0042](0042-light-versioning.md)).
- **The tag** is the version the menu shows for this PR's merge, published with the release workflow and the notes in `docs/releases/` ([0062](0062-github-releases-per-phase.md)).
- **Guillaume's review** is one pass over [docs/reviews/v1.13](../reviews/v1.13/README.md).

## Consequences

- Budget: High docking follow-cam draw calls 58 to 61; Medium and High sailing follow cam are at their limits, so the next follow-cam draw needs an argued raise.
- Open for later: device `?bench` (#377, add `&quality=high` against `&off=surface`), live title (#531), #545, #492.
