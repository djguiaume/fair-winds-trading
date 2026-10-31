# 0251. Version 1.3 release, Waves you can see

**Status:** Accepted (2026-10-31).

## Context

Every part of the [v1.3 brief](../v1.3/brief.md) is merged on `main`: the Xbox Ultra memory fix
([0246](0246-ultra-keeps-only-the-graphics-memory-it-uses.md)), the shared wave model
([0245](0245-shared-wave-model-and-cpugpu-contract.md)), coasts that calm the waves
([0248](0248-coast-calms-the-waves-by-depth-shelter-and-berths.md)), GPU waves and the storm look
([0249](0249-gpu-waves-shade-by-their-own-normals-storm-water-greys.md)), the waves switch and comfort
controls ([0250](0250-waves-on-by-default-from-medium-up-with-ocean-comfort-contro.md)), the Ultra-low level
([0247](0247-ultra-low-quality-level-for-weak-tablets.md)), the per-pass cost switches and the lower Low
pixel cap ([0240](0240-lower-pixel-cap-for-low.md)). Boats that ride the waves are v1.3.1. Open by Guillaume's
rulings and never blocking: the Xbox `?bench` re-read (not today), #377 device runs, tablet round 4 on Ultra-low.

## Decision

- **The update is 1.3.** This PR sets `package.json` to `1.3.0` and the menu label to "1.3", so the menu shows
  `v1.3.<n>` ([0042](0042-light-versioning.md), [0219](0219-version-1-0-release.md)).
- **The tag** is the version the menu shows for this PR's merge, `v1.3.324` if no other merge lands first,
  published with the release workflow and the notes in [docs/releases/v1.3.324.md](../releases/v1.3.324.md)
  ([0062](0062-github-releases-per-phase.md)).

## Consequences

- Waves are on from Medium up and off on Low and Ultra-low; sailing is identical either way.
- Leftovers #372, #319, #315, #352 move to the next milestone; #377 stays open for the device runs.
