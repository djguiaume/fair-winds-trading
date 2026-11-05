# 0290. Version 1.6 release, The far seas' story

**Status:** Accepted (2026-11-05).

## Context

Every part of the [v1.6 brief](../v1.6/brief.md) is merged on `main`: Ness's hint and Wren's order moved to Abbey Head (#362, #363), a hazard event in each far sea with one-card outposts and the washed-up oddities ([0283](0283-each-far-seas-hazard-is-a-turn-in-its-keepers-arc.md), #359), the chapter after Four Winds ([0286](0286-the-chapter-after-four-winds-rooks-fathers-mark-and-a-flag-f.md), #361), cross-sea far-goods asks ([0288](0288-cross-sea-asks-in-standing-orders.md), #360), the drawn sky and brighter chase camera ([0284](0284-chase-camera-light-and-a-drawn-sky.md), #469, #470) and birds and sea life ([0285](0285-birds-and-sea-life.md), #476). The storyteller's [review](../story/v1.6-review.md) shaped the scope. Guillaume gave the visual OK on the sky, the sea life and the chapter.

## Decision

- **This is an update.** `package.json` goes to `1.6.0` and the menu label to "1.6" ([0042](0042-light-versioning.md), [0219](0219-version-1-0-release.md)).
- **The tag** is the version the menu shows for this PR's merge (v1.6.386 if nothing merges first), published with the release workflow and the notes in `docs/releases/` ([0062](0062-github-releases-per-phase.md)).
- **Open, not blocking:** real-device `?bench` runs for the chase sky and for sea life join #377; people on the sea is #477 (not in v1.6); the stranger playtest #364 stays before the store build.

## Consequences

- The story now has a question (the star over a wave), on-screen reunions and an ending chapter; the seas have a turn each.
- The next release is the store build prep, after the device runs.
