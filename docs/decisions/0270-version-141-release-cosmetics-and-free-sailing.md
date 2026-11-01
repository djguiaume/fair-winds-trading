# 0270. Version 1.4.1 release, Cosmetics and free sailing

**Status:** Accepted (2026-11-01).

## Context

The three parts planned for v1.4.1 (#297 cosmetic catalogue, #300 Free Sailing, #301 acceptance) shipped inside
[v1.4](0267-version-14-release-visible-upgrades.md) when Guillaume kept it as one release. The only leftover was the
weather icon on the Free Sailing preset cards (#436, PR #437), merged 2026-11-01 with Guillaume's OK on the shots.
Open and never blocking: #422 quest file split, #377 device runs.

## Decision

- **This is a patch update.** `package.json` stays `1.4.0` and the menu label stays "1.4", so the menu shows
  `v1.4.<n>` ([0042](0042-light-versioning.md)).
- **The tag** is the version the menu shows for this PR's merge, `v1.4.360`, published with the release workflow and
  the notes in [docs/releases/v1.4.360.md](../releases/v1.4.360.md) ([0062](0062-github-releases-per-phase.md)).

## Consequences

Free Sailing is free for the UI release to rebuild ([0268](0268-a-real-game-rebuild-the-ui-as-one-system-v15.md)).
Cosmetics beyond the first set wait for new story and regatta rewards.
