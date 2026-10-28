# 0229. Version 1.1 release, The Sailing Club

**Status:** Accepted (2026-10-28).

## Context

Every part of the [v1.1 brief](../v1.1/brief.md) is merged on `main`: the turnable camera, the Ultra
quality level ([0221](0221-an-ultra-quality-level-for-desktop-and-xbox.md)) with the water step, fixed
storms in races ([0225](0225-fixed-storms-in-races.md)), the Sailing Club races and club board
([0226](0226-the-sailing-club-races-and-club-board.md)), the racer café at Abbey Head
([0227](0227-the-racer-cafe-at-abbey-head.md)), the Tern ([0228](0228-the-tern-a-prize-racing-boat.md))
and the style E reskin ([0220](0220-a-game-like-ui-skin-style-e.md)). Bug fixes moved to v1.2 (Guillaume,
2026-10-28). Open by Guillaume's rulings and never blocking: `?bench` on a real device, night dimming
of the paper screens (#326), the type audit (#319).

## Decision

- **The update is 1.1.** This PR sets `package.json` to `1.1.0` and the menu label to "1.1", so the menu
  shows `v1.1.<n>` ([0042](0042-light-versioning.md), [0219](0219-version-1-0-release.md)).
- **The tag** is the version the menu shows for this PR's merge, published with the release workflow and
  the notes in [docs/releases/v1.1.282.md](../releases/v1.1.282.md) ([0062](0062-github-releases-per-phase.md)).
  If another merge lands first, the tag and notes file take the next number.

## Consequences

- The roadmap's "Now" becomes v1.2, "a new look" ([0222](0222-a-new-look-smooth-terrain-blue-water-and-forests.md)),
  which also takes the v1.0 bug fixes (#255).
