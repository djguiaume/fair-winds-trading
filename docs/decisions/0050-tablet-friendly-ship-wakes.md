# 0050. Hull-sized, tablet-friendly ship wakes

**Status:** Implementation for review, 2026-10-20.

**Context:** Playtesters find the water and boat trail too simple. The old wake is a plain widening ribbon, identical at all detail levels, attached five scene units behind every ship. Older tablets remain a target. This PR improves the wake; ocean shading improvements are separate work.

**Decision:** Render two spreading, softly edged foam trails, a quieter centre turbulence strip on Medium/High, and tapered bow foam along the hull shoulders. A small procedural shader breaks up the foam without downloaded textures, particles, extra render targets or reflection passes. The model exports its scaled hull length and beam; the renderer attaches the effects to those dimensions for every ship and upgrade level. Wake points remain in world space during turns, ride the existing ocean waves, and fade with age. Foam strength follows speed, disappearing at rest. Ship changes and teleports clear history.

All strips share one mesh/material and one draw call. Fixed typed arrays and recycled history points bound memory. Low retains bow foam and two stern edges with up to 24 points / 1.8 seconds; Medium adds centre turbulence with 40 points / 2.6 seconds; High uses 64 points / 3.4 seconds. Quality changes apply immediately, including automatic step-downs. Existing resolution caps remain unchanged. No simulation or save format changes.

**Consequences:** Boats should feel more connected to the sea and different ship sizes no longer share the same incorrect stern offset. More vertices and transparent coverage than the previous single ribbon require real-device checks; Low limits both history and bow subdivisions. Tests cover finite/bounded geometry, fixed buffer reuse, distinct detail budgets, stopping, teleport resets and all seven model footprints. Check appearance during tight turns, acceleration, stopping, docking and ship changes, particularly on an older tablet. These checks do not establish a device FPS guarantee. Further ocean work remains outside this decision.
