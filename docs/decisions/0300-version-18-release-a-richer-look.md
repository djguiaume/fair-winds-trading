# 0300. Version 1.8 release, A richer look

**Status:** Accepted (2026-11-11).

## Context

Every part of the [v1.8 brief](../v1.8/brief.md) is merged on `main`: Ultra graphics memory (#484, [0297](0297-ultra-draws-the-scene-straight-to-the-screen-in-one-graded-p.md)), sea gusts (#498, [0295](0295-gusts-on-the-sea.md)), richer houses (#500, [0296](0296-rich-town-houses-near-the-camera.md)), ground cover (#499, [0298](0298-ground-cover-grass-clumps-dry-patches-and-sand-ripples-drawn.md)) and bloom on Ultra (#501, [0299](0299-bloom-on-ultra-lit-windows-lanterns-and-the-moon-glow-at-nig.md)). Guillaume waived `visual-ok` for the release and validated the look from the combined sheets on 2026-11-11 ("ok").

## Decision

- **This is an update.** `package.json` goes to `1.8.0` and the menu label to "1.8" ([0042](0042-light-versioning.md), [0219](0219-version-1-0-release.md)).
- **The tag** is the version the menu shows for this PR's merge (v1.8.402 if nothing merges first), published with the release workflow and the notes in `docs/releases/` ([0062](0062-github-releases-per-phase.md)).
- **Open, not blocking:** real-GPU `?bench` for each new effect on the Surface, Xbox and a phone, joined to #377; gusts and ground detail stay off on Medium until a device run. Believable towns (#503) and the flaky harbour test (#509) go to the next release.

## Consequences

- High and Ultra look richer; Low and Medium are unchanged. Ultra fits its 355 MB budget with bloom.
