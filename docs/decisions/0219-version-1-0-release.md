# 0219. Version 1.0 release

**Status:** Accepted (2026-10-25). Guillaume: "we are in a hurry because we are waiting for that to
release 1.0"; Phase 5 ends at v1.0 ([0207](0207-the-roadmap-after-phase-4.md)).

## Context

Every part of the Phase 5 brief ([docs/phase-5/brief.md](../phase-5/brief.md)) is merged on `main`:
Skerry's build choice ([0210](0210-skerrys-build-choice-staked-plots-and-the-island-tab.md)), the
Windward Ring catch-up pass ([0216](0216-windward-ring-catch-up-pass.md)), the port in the harbour
screen ([0211](0211-the-port-in-the-harbour-screen.md), PR #231), other boats on the sea
([0215](0215-other-boats-on-the-sea.md)), the sounds of the sea ([0209](0209-sounds-of-the-sea.md)),
the Saltmere Regatta with Wren Tally, pennants and the Cup ([0217](0217-the-saltmere-regatta.md)),
standing orders ([0214](0214-standing-orders-people-ask-again.md)), visible hull damage
([0208](0208-visible-hull-damage.md)), course marks on the chart
([0212](0212-real-course-marks-on-the-chart-the-quests-place-and-your-own.md)) and quest news at each
stop ([0213](0213-quest-news-at-each-stop.md)) and finished quests in the Journal ([0218](0218-finished-quests-in-the-journal.md)).
Gate checked on `main` before the release: `npm run check` all ok, 1249 tests pass, `npm run balance -- --map phase4` passes every check (economy, levels, story) on all three levels, lint clean, no other pull request open; the last Phase 5 merge is PR #247 (`540d8bb`).

## Decision

- **The base game is 1.0.** This PR sets `package.json` to `1.0.0` and the menu label to "1.0", so
  the menu's version ([0042](0042-light-versioning.md)) becomes `v1.0.<n>`: from here the middle
  number counts updates (v1.1 "The Sailing Club", [plan](../v1.1/plan.md)), not phases.
- **The tag** is the version the menu shows for this PR's merge, **v1.0.253**, on that merge commit,
  published with the release workflow and the notes in [docs/releases/v1.0.253.md](../releases/v1.0.253.md)
  ([0062](0062-github-releases-per-phase.md)).
- Charlotte's old-tablet `?bench` run is still open; Guillaume ruled it never blocks a release
  (0206). Guillaume asked not to wait for another round of screenshots before releasing.

## Consequences

- The roadmap's "Now" becomes v1.1; the store plan of [0204](0204-selling-on-android-iphone-and-xbox.md)
  can come back whenever Guillaume asks.
- [docs/releases/README.md](../releases/README.md) step 3 now reads: an update bumps
  `package.json` to the next `1.<minor>.0`.
