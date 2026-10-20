# 0042. Light versioning: v0.<phase>.<deploy> in the menu

**Status:** Implementation for review (2026-10-20). Guillaume said yes to the light version.

## Context

The title menu showed only "Phase 1 · Build" and a commit code such as `4770d5a`. Commit codes are
fine for debugging but impossible to compare by eye: on the installed app ([0039](0039-installable-web-app.md))
it is hard to tell whether the copy on the tablet is older or newer than the one on the phone.

Full semantic versioning is meant for libraries other code depends on. A web game deployed on
every merge needs something simpler that nobody has to remember to bump.

## Decision

- The menu shows a readable version **`v0.<phase>.<n>`** under the "Trading & Shipyard · Phase 1"
  line, with the commit code kept small beside it for debugging.
- `0.<phase>` comes from `package.json` (`0.1.0` for Phase 1). Starting a new phase means setting it to
  `0.2.0`, `0.3.0`, … in the PR that opens the phase. `1.0` is kept for a "finished" release, if one
  ever comes.
- `<n>` is computed at build time: the number of first-parent commits on the built branch
  (`git rev-list --count --first-parent HEAD`). On `main` every merged PR is one first-parent commit and
  one deploy, so it goes up by itself with each deploy. It keeps counting across phases (it does not
  reset to 0), which keeps it strictly increasing and simple to compute.
- `vite.config.ts` injects `__APP_VERSION__` and `__BUILD_REVISION__`; CI checks out the full
  history (`fetch-depth: 0`) so the count is right.
- The "Phase 1" label stays a translated string (`menu.version`, [0037](0037-english-and-french-translations.md));
  the version and commit code are not translated.

## Consequences

- Comparing two devices is reading two numbers: higher `n` is newer.
- The service worker is network-first, so the installed app shows the new number as soon as it is
  opened online after a deploy; an offline start shows the last cached version.
- Builds from a feature branch show the branch's own count, which can differ from `main`; only the
  deployed `main` number is meaningful to players.
- A squash or rebase merge also adds one first-parent commit, so the rule holds whatever merge style is used.
