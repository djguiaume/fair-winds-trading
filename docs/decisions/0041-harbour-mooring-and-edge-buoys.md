# 0041. Harbour mooring and map-edge buoys

**Status:** Implementation for review, 2026-10-19. Guillaume's play-test: there was no real way to stop near a dock (the cue kept saying "Slow down to dock" to players who thought they had stopped), and the edge of the map was invisible.

**Context:** With the sails down, speed fades exponentially (`decel` ≈ 0.3/s) and never quite reaches zero, and leeway keeps pushing the hull downwind forever, so a boat never stops. Docking needs under 1.5 kn within 14 units of the port island's shore, and the pier cue said "Slow down" whenever the boat was within 26 units but not in range, even when it was the distance, not the speed, that was wrong. The sea's edge (`boundsRadius`) was an invisible wall; only the chart drew it.

**Decision:**

- **Mooring:** within docking range of a port, with the sails lowered and already slow (under 3 kn), the crew brings her alongside: 1.6/s extra braking, a dead stop under 0.2 kn, and once stopped the wind no longer drifts her. She docks on the way down (under 1.5 kn) and stays put while docked.
- **No rescue for a fast arrival:** above 3 kn the normal coast-down applies, so coming in at full speed and dropping the sails at the last moment still ends in a crash and hull damage ([0038](0038-hull-damage-from-any-crash.md)).
- **Clear cues on the pier label:** "Sail closer to dock" when out of range, "Lower sails to dock" in range with sails up, "Slow down to dock" in range with sails down but still fast, "Tap to dock & trade" when ready (EN and FR). The help and the docking lesson describe the slow approach.
- **Edge buoys:** red can buoys with a white band bob in a ring just beyond where the hull is held at the edge, every 28 units (about 100 on the Windward Ring). One instanced draw call; only their matrices change each frame. The chart keeps its boundary circle.
- Open water is unchanged: with the sails down at sea the boat still drifts with the wind.

**Consequences:** Docking is reliable for touch and keyboard players (lower sails early, glide in, stop) without making speed near ports free. Knobs in `src/sim/world.ts`: `MOOR_MAX_KN`, `HARBOUR_BRAKE`, `MOORED_KN`; `EDGE_BUOY_SPACING` in `src/render/props.ts`. No map or save changes.

**Validation:** `tests/harbours.test.ts`: at every port a 2.5 kn approach with sails down stops dead, docks and stays within half a unit for 20 s; an 8 kn arrival with sails just dropped still crashes; sails down in open water still drifts. Checked in the built game with headless Chromium ([screenshots](../screenshots/README.md)).
