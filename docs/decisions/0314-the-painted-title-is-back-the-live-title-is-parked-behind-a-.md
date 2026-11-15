# 0314. The painted title is back; the live title is parked behind a switch

**Status:** Accepted (2026-11-15). Issue #531; amends 0313.

## Context

Guillaume wants the static painted title picture on the title screen for now, before v1.11 releases.

## Decision

- `graphics.json › title.live` (default `false`; `?tune` and `npm run tune -- set graphics.title.live true`) picks the title's picture. Off: the painted `title-key.jpg` beside the paper page, as before 0313. On: the live scene of 0313 (per-level `liveTitle`, stills on Low).
- The live-scene code (`CameraStage`, stills, `liveTitle`) stays. The three-row title and one-click start are unchanged.

## Consequences

The title costs one 232 kB picture again and no extra render work. Turning the switch on restores 0313's title with no code change.
