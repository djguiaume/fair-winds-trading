# 0004. Render the game in real-time 3D (low-poly)

**Status:** Accepted, 2026-10-19

**Context:** Two art-direction mockups of the same scene were compared ([docs/mockups](../mockups/)): A, real-time 3D low-poly, and B, 2.5D layered sprites.

**Decision:** Guillaume chose **3D** (mockup A): low-poly flat-shaded models, real lighting and shadows, top-down tilted camera, HTML UI overlay.

**Consequences:**
- Closest to the reference style; sails can visibly trim and fill with the wind, and the camera can zoom and tilt.
- Assets need to be modelled (or generated procedurally) and the renderer must stay light enough for mid-range devices.
- The tech stack must include a WebGL/WebGPU 3D engine; that choice is the next decision.
