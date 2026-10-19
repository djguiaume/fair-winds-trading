# 0014. Code-built models for now, not Scenario-generated ones

**Status:** Accepted, 2026-10-19

**Context:** The art style is settled ([0012](0012-boat-and-island-art-style.md)): B2 islands and D boats, both drawn in code in [docs/art/src/lib.js](../art/src/lib.js). We tested generating the same island and sloop with Scenario (scenario.gg: image, then image-to-3D) in [docs/art/scenario-tests](../art/scenario-tests/README.md). After optimizing, the island looked right and fit the old-tablet budget ([0006](0006-desktop-and-mobile.md)). The sloop came out as one frozen mesh, so its sails and upgrade parts ([0011](0011-ship-lineup-and-upgrades.md)) cannot move. The test cost 412 credit units, about half of Guillaume's monthly Scenario allowance. That leaves too few credits to make every island and prop this way.

**Decision:** Build islands, props and boats in code from the `lib.js` styles (B2 islands, D boats), as the Phase 0 placeholders already do. Scenario is not used for game assets for now.

**Consequences:**
- No credit cost and no asset download for models; islands stay merged into one vertex-coloured draw call, boats keep animatable parts.
- `tools/scenario/scenario.py` and the test write-up stay in the repo for later. Any new Scenario job needs Guillaume's OK and a credit estimate first.
- If the credit budget grows, revisit Scenario for islands and props only (image → Meshy 7 with remesh → `gltf-transform optimize`), never for boats.
