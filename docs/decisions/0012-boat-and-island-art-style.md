# 0012. Art style for boats and islands

**Status:** Proposed, 2026-10-19 (waiting for Guillaume's pick)

**Context:** Real-time 3D low-poly is decided ([0004](0004-real-time-3d.md)); the look of the ships and islands is not. It has to stay readable at a zoomed-out top-down camera on a phone and run on an old tablet ([0006](0006-desktop-and-mobile.md)). Three boat styles and three island styles were mocked up in [docs/art](../art/):

- Boats: **A** chunky toy, **B** faceted classic, **C** toon outlined.
- Islands: **A** sunny sandbar, **B** rugged highlands, **C** toon diorama.

**Recommendation:** Boats **A** + islands **A**.
- Closest to the *Privateers* ad that set the direction.
- Exaggerated hulls and bellied sails read best at phone size and show the wind clearly, which is the core of the game.
- Cheapest to render: flat-shaded Lambert with vertex colours, no outline pass, no textures beyond a tiny palette.
- The glowing shallows double as hazard readability (reefs and shallows).
- B-style cliff islands can still be mixed in later for variety; C would rule out mixing.

**Decision:** _To be filled in when Guillaume picks._

**Consequences (if A + A):** Blender models use a short shared palette (vertex colours), exaggerated proportions, one colour band per ship class; islands are low and round with a sand ring and a shallows glow decal. If C is picked instead, budget an outline pass (inverted hull) and test it on the old tablet early.
