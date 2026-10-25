# 0206. Phase 4 release: v0.4.226

**Status:** Accepted (2026-10-25). Guillaume: "Everything works on xbox. Do the release if there is no open points."

## Context

The Phase 4 release gate ([0188](0188-phase-4-review-and-release-gate.md), [review](../reviews/phase-4-review/README.md))
is met on `main`: the grown sea is the main game's sea ([0198](0198-the-grown-sea-is-the-main-game.md)); all four
seas' stories and the `four-winds` closing beat are built ([0193](0193-the-east-seas-story-and-the-four-winds-closing-beat.md));
the seas open early and side by side ([0194](0194-open-the-edge-seas-after-each-ring-arc.md)); the balance bots play the
story in order and every check passes on all three levels ([0195](0195-balance-the-grown-sea-in-story-order.md)); the art
director's musts are done ([0191](0191-phase-4-review-polish-chart-labels-fogwatchs-south-outpost-b.md)); the zero-gold
soft lock is fixed ([0200](0200-a-load-on-credit-when-she-is-broke.md)); the Xbox controller fixes are in and Guillaume
tested them on his Xbox ([0192](0192-port-screen-with-a-game-controller.md), [0199](0199-controller-on-xbox-pointer-mode-and-pad-buttons-at-sea.md),
[0201](0201-xbox-symbols-on-sea-buttons-and-the-controller-log.md), [0203](0203-pad-focus-ring-without-the-browsers-focus.md));
and docking happens only at the harbour ([0205](0205-dock-only-at-the-harbour.md)). The last Phase 4 merge is PR #220.
No pull requests were open at release time.

## Decision

- Release Phase 4 the same way as Phases 1 to 3 ([0062](0062-github-releases-per-phase.md),
  [0138](0138-phase-3-release.md)): the tag is the version the menu shows for the last Phase 4 build,
  **v0.4.226**, on `901b25c` (the merge of PR #220). Notes are in [docs/releases/v0.4.226.md](../releases/v0.4.226.md),
  published with the GitHub release workflow once this PR is merged.
- Charlotte's old-tablet `?bench` run is still open; Guillaume ruled it never blocks a release.
- The same PR opens Phase 5 (pirates): `package.json` goes to `0.5.0` and the menu label to "Phase 5".

## Consequences

- Phase 4 has its own save point on GitHub, alongside v0.1.50, v0.2.73 and v0.3.129.
- Every new feature from here counts as Phase 5. Known follow-ups kept for later: outpost build spots,
  the couch text size and no-typing save transfer on Xbox, the big-event panel (0174), a ring retune for the
  ring bots' phantom loads (0195), a main-port triangle budget after a `?bench` check (0191).
