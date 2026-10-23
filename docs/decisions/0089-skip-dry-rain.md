# 0089. Skip rain particles outside wet weather

**Status:** Implemented for review

**Context:** Every render frame advanced 160–400 rain drops, sampled storms and uploaded position and colour buffers, even when no rain could appear anywhere in the particle field.

**Decision:** Before updating particles, intersect active storm circles with the complete rain spawn rectangle (240 units east/west, 170 north, 80 south of the camera target). Sea-wide showers keep updates enabled. Convert simulation north to negative scene z. The normal update always moves or respawns drops into this rectangle before sampling, so this bound covers moving drops too. A dry field hides the mesh and returns before touching drops or buffers. Keep the existing callback API and default to updating if a caller does not supply the broad-phase result.

**Consequences:** Dry frames avoid the particle loop and GPU buffer uploads, while nearby visible downpours remain active even when the boat is dry. Frozen drops retain their distributed heights; on restart the usual bounds check recentres drops after camera movement or teleports. Storms intersecting only a tiny corner still run the full update, intentionally favouring conservative visibility over extra filtering. No cumulative FPS claim is made.
