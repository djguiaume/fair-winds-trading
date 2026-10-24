# Releases

GitHub releases are the "save points" of the game ([0062](../decisions/0062-github-releases-per-phase.md)):
one at the end of each phase, plus one for any notable milestone in between. Every deploy already has
its own number in the menu ([0042](../decisions/0042-light-versioning.md)); a release just marks the ones
worth remembering.

| Release | Commit | What |
|---|---|---|
| [v0.1.50](v0.1.50.md) | `5f8a574` | Phase 1 complete: one-captain trading |
| [v0.2.73](v0.2.73.md) | `0963490` | Phase 2 complete: living settlements |
| [v0.3.129](v0.3.129.md) | `1fee60c` | Phase 3 complete: people, stories and your own island |

## How to cut a release

1. Write short, player-facing notes in `docs/releases/<tag>.md`, merged to `main`. The tag is the
   version the menu shows for the build being released (`v0.<phase>.<n>`).
2. Run the **GitHub release** workflow from the Actions tab with the tag, the commit and a title
   (or push the tag). It creates and pushes the tag on that commit, then publishes the notes as the
   release. Tags are only made this way, one per release: no tags for ordinary deploys.
3. When a phase ends, the next PR sets `package.json` to the next `0.<phase>.0` and updates the
   "Phase N" menu label (`menu.version` in `src/i18n/`).
