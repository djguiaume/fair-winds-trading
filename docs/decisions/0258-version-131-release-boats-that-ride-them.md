# 0258. Version 1.3.1 release, Boats that ride them

**Status:** Accepted (2026-10-31).

## Context

Every part of the [v1.3.1 brief](../v1.3.1/brief.md) is merged on `main`: boats that ride the waves
([0253](0253-ships-ride-the-waves-heave-pitch-and-roll-from-hull-samples.md), #283), surf in thin lines and a wash up
the beach ([0254](0254-surf-breaks-in-lines-and-washes-up-the-beach.md), #397), a start view while the game loads
([0252](0252-start-view-while-the-game-loads.md), #396), waves that slow the boat, bounded
([0256](0256-waves-slow-the-boat-bounded.md), #284), bake a sculpted coast into the island outline
([0255](0255-bake-a-sculpted-coast-into-the-island-outline.md), #352) and the look leftovers
([0257](0257-look-leftovers-rimewick-summit-shelf-and-amber-strand-rock-p.md), #372). Guillaume saw the visuals and
approved the 5.25 min balance target (2026-10-31). Open and never blocking: a phone `?bench` near a beach, the real
load time on the phone, the load-time follow-ups listed in 0252.

## Decision

- **This is a patch update.** `package.json` stays `1.3.0` and the menu label stays "1.3", so the menu shows
  `v1.3.<n>` ([0042](0042-light-versioning.md), [0219](0219-version-1-0-release.md)).
- **The tag** is the version the menu shows for this PR's merge, `v1.3.335` (another merge landed first), published
  with the release workflow and the notes in [docs/releases/v1.3.335.md](../releases/v1.3.335.md)
  ([0062](0062-github-releases-per-phase.md)).

## Consequences

- Head seas slow the boat by up to 10 %; Settings turns it off. Boats ride the waves when waves are on.
- Leftovers #319 and #315 move to v1.4; #377 stays open for the device runs.
