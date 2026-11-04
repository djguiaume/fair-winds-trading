# 0282. Title key art is the original bright cover

**Status:** Accepted (2026-11-04). Amends [0271](0271-title-pause-settings-and-new-voyage-on-the-components.md).

## Context

The v1.5 title used the README cover after `docs/ui-refactor/v1.5/grade_cover.py` (duller blue sea, golden-hour tint). Guillaume found the earlier brighter, more saturated picture better.

## Decision

`src/ui/screens/art/title-key.jpg` is the ungraded `docs/images/readme/cover.png`, cut at 18% from the left as before. `grade_cover.py` stays in the kit as a record of round 4 but is no longer used.

## Consequences

The title sea is bright teal, the sky clear blue. Same crop, so the layout does not change.
