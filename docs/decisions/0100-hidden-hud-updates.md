# 0100. Skip covered HUD rendering

**Status:** Implemented for review (2026-10-23).

## Context

The title screen hides every HUD child in CSS, and the opaque full-screen sea chart covers them. The HUD still updated instrument DOM, projected the navigation target and hull bar, and queried and positioned port signs every frame behind both screens. Folded speed-log text also kept updating. Pause is not a visibility signal: the pause menu and translucent market, help and tutorial sheets leave parts of the sea HUD visible.

## Decision

- The app passes explicit HUD visibility separately from simulation activity. Only the title screen and open full-screen chart suppress HUD rendering. Partially covering sheets keep existing behavior; no per-frame computed-style reads or layout queries are added.
- Toast lifetime, wind-gauge smoothing/gust lifetime, wind help timing and press state continue advancing. Projection and ordinary instrument/port-sign DOM work stop while covered. Expired toasts still hide, preventing stale warnings on return.
- The first visible frame refreshes throttled instrument text and port-sign content immediately, including cargo or a course changed while the chart was open. FPS output follows the same visibility flag.
- Folding the speed log skips its hidden speed, heading and point-of-sail text; unfolding requests an immediate refresh. Other visible controls continue updating.
- Visibility is a UI rule, not balance tuning or authored content; no tuning numbers or game content are introduced in TypeScript. Existing refresh intervals remain unchanged. Island generation and ADR 0096 are unaffected.

## Consequences

Covered HUDs avoid all per-frame world-to-screen projection and port-distance queries without changing simulation timing or pausing toast expiry. Any future opaque full-screen surface must join the app visibility rule. This deliberately avoids assuming that a paused simulation means an invisible HUD. DOM regression tests cover zero covered projections/mutations, immediate refresh, toast expiry, wind-cue reset, paused visible sheets and folded-log refresh; the existing tutorial application test exercises real app wiring.
