# 0293. Version 1.7 release, Tidy, smooth, shiny

**Status:** Accepted (2026-11-05).

## Context

Every part of the [v1.7 brief](../v1.7/brief.md) is merged on `main`: the quest code split into 26 files under 400 lines (#422, PR #489), the editor and `?tune` stylesheets split into parts with the built CSS unchanged (#392, [0287](0287-split-the-big-editor-stylesheets-into-parts.md) if present in the README), the phone fluidity targets ([docs/reviews/phone-fluidity](../reviews/phone-fluidity/README.md), #405), boat and island reflections on Ultra ([0292](0292-sea-reflections-of-boats-and-islands-on-ultra.md), #285) and people on the quays ([0291](0291-people-on-the-quays-and-in-the-towns.md), #477). Guillaume waived `visual-ok` for this release except for #477, which he approved.

## Decision

- **This is an update.** `package.json` goes to `1.7.0` and the menu label to "1.7" ([0042](0042-light-versioning.md), [0219](0219-version-1-0-release.md)).
- **The tag** is the version the menu shows for this PR's merge (v1.7.392 if nothing merges first), published with the release workflow and the notes in `docs/releases/` ([0062](0062-github-releases-per-phase.md)).
- **Open, not blocking:** real-GPU `?bench&quality=ultra` with and without `&off=mirror` on the Surface or Xbox, and a phone `?bench` against `?bench&off=folk` near a port town, both join #377. High's cheaper reflection variant stays off until a device run. `src/editor/quest/builder.ts` (1,902 lines) is #492.

## Consequences

- No quest, editor or stylesheet file the PR rules check is over 400 lines, so quest and editor PRs stop tripping the rule.
- Ultra shows mirrored boats and islands; towns have walkers and fishermen (switchable in Settings).
