# 0020. Quiet upwind feedback on the compass

**Status:** Accepted by Guillaume, 2026-10-19.

**Context:** The recurring “you can't sail upwind” toast was too prominent and obscured play. Guillaume approved a compass indicator with optional sailing help.

**Decision:**

- Remove the recurring upwind toast. The small point-of-sail readout says “Headwind” neutrally rather than issuing another warning.
- When actively trying to sail inside the no-go zone, tint the compass boat amber. Pulse only the no-go wedge after 1.2 seconds; after 3 seconds show a compact clickable “Into the wind” chip beside the compass.
- Clear all cues and restart the delay immediately after leaving the zone, lowering sails, docking or pausing. Brief tacks have no chip and no instant pulse.
- The compass and chip open a keyboard-accessible modal with one short explanation and an inline tacking illustration. It pauses play, clears held steering/sail input, supports Escape and restores focus on close.
- Show a dismissible, seven-second “Tap the compass for sailing tips” hint on the first sustained encounter only. Remember it in existing player settings, defaulting older settings to unseen. Opening help early also marks it seen. Storage failures remain harmless.
- Match the wedge to the current ship's actual no-go angle. Respect reduced-motion preferences by keeping the amber cue static.

**Consequences:** Guidance stays local to navigation and does not compete with trade, shore or waypoint notifications. No sailing physics or map changes. The native dialog provides modal focus containment; browser and phone visual checks remain a manual review item.

**Validation:** Timing and suppression tests, persisted first-use preference tests (including old settings and unavailable storage), plus the full existing test suite, lint and production build.
