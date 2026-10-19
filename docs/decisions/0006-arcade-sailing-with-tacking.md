# 0006. Arcade sailing, but the wind's no-go zone is real

**Status:** Accepted, 2026-10-19

**Context:** Choice between arcade sailing (only steer) and sim-lite (also trim sails).

**Decision:** Arcade: the player steers and raises/lowers sails; sail trim is automatic. Wind angle still matters: pointing straight into the wind (inside the no-go zone) stalls the boat, so reaching an upwind port requires tacking.

**Consequences:** Simple controls that work on touch. Speed is a function of the angle to the wind (polar curve), tuned per ship class.
