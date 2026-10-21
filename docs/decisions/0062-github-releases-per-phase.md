# 0062. GitHub releases at the end of each phase

**Status:** Accepted (2026-10-21). Guillaume said yes to a Phase 1 release and to releasing at the end of each phase plus notable milestones.

## Context

Phase 1 (one-captain trading) is complete with the menus redesign (PR #44). Every merge to `main`
already deploys and gets its own number, `v0.<phase>.<n>` ([0042](0042-light-versioning.md)), so the
deploys themselves need no extra ceremony. What was missing is a durable, easy to find marker for the
builds worth remembering, with notes on what they contain.

## Decision

- Cut a GitHub release at the **end of each phase**, plus one for a **notable milestone** in between
  (for example a big feature a play-tester should try). Not on every deploy.
- A release's tag is the **version the menu shows** for that build, so players and the repo use the
  same number. Phase 1's release is **v0.1.50**, tagged on `5f8a574` (the merge of PR #44), the last
  Phase 1 build.
- Notes are short and player-facing, kept in the repo as `docs/releases/<tag>.md` and listed in
  [docs/releases](../releases/README.md). The `GitHub release` workflow (`.github/workflows/release.yml`)
  publishes them: run it from the Actions tab, or push a `v*` tag.
- Closing a phase opens the next one in the same PR: `package.json` goes to `0.<phase+1>.0` and the
  menu label (`menu.version`) to the new phase. This PR sets `0.2.0` and "Phase 2", so the next deploy
  shows `v0.2.51`.

## Consequences

- Each phase has a clear save point on GitHub with a link to play and a summary of what changed.
- The deploy counter keeps running across phases (0042), so the first Phase 2 build is `v0.2.51`, not
  `v0.2.0`; that is expected.
- Work still open when a phase is released (here settlement levels, PRs #42 and #43) lands in the
  next phase and is named in the notes as not included.
