# 0012. Art style for boats and islands

**Status:** Accepted, 2026-10-19

**Context:** Real-time 3D low-poly is decided ([0004](0004-real-time-3d.md)); the look of the ships and islands was not. It has to stay readable at a zoomed-out top-down camera on a phone and run on an old tablet ([0006](0006-desktop-and-mobile.md)). Mockups are in [docs/art](../art/).

- Round 1: boats A chunky toy, B faceted classic, C toon outlined; islands A sunny sandbar, B rugged highlands, C toon diorama. Recommendation was A + A.
- Guillaume's feedback: islands with the A water but the B island shapes, less dark; use the A water colours for every style; boats A and B are both good, more options wanted.
- Round 2: islands B2 (bright highlands); boats D storybook classic, E painted merchant, F dark wood and gold, plus side-by-side sheets.

**Decision:**
- **Sea:** the A water colours (teal sea, glowing turquoise shallows around islands) for the whole game, whatever the boat style.
- **Islands:** **B2 bright highlands**: stacked rock strata and small beaches from B, in light sandstone with bright grass, light houses with red and blue roofs, and the shallows glow of A. Each island's props show what it produces.
- **Boats:** **D storybook classic** (Guillaume's pick from the A, B, D, E, F shortlist): medium proportions between A and B, softly bellied sails, a colour band per ship class, light rigging lines, warm wood and cream sails. C was dropped (outline cost, would force toon islands).

**Consequences:**
- Island models: 2–5 tapered rock layers (vertex-coloured sandstone), grass cap, beach slab, shallows glow as a single transparent decal per island (cheap, also marks the shallows hazard of [0010](0010-light-hazards-pirates-later.md)).
- Tall cliffs can hide a boat behind them at the tilted camera; keep islands' highest layers modest near ports and channels, or fade them when the boat is behind.
- Boats are flat-shaded with vertex colours and built from parts (hull, band, masts, sails, cargo, rigging) so sails can trim with the wind and upgrades ([0011](0011-ship-lineup-and-upgrades.md)) swap parts. Style D's parameters in [docs/art/src/lib.js](../art/src/lib.js) (`STYLES.D`) are the reference for the game models.
- Rigging lines are thin `LineSegments`; drop them at the low quality setting if they cost too much on the old tablet.
