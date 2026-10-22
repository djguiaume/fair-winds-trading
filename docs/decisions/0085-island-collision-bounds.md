# 0085. Skip distant island coast collision checks

**Status**: Implemented for review

**Context**: Each simulation step traversed every generated island coastline, running polygon edge distance checks even in open water. Inland lake outlines were also transformed on every step. The harbour range optimization (0084) suggested the same conservative rejection for island collisions.

**Decision**: Cache each generated coastline's world-space bounding box in a WeakMap keyed by the outline. Skip its polygon checks only when the boat centre lies outside the box expanded by the collision radius. Build the lake outline only when checking the main coastline. Keep terrain, collision order, contact response, and near-shore checks unchanged. Existing island geometry caching returns new outlines when position, radius, profile, or harbour bearing changes, so bounds follow those changes automatically.

**Consequences**: Constant-time rejection replaces distant polygon walks. A local warmed benchmark of 20,000 collision resolutions at the trading map start measured 484 ms before and 245 ms after (about 49% less collision CPU time, not an FPS claim). A temporary comparison against the pre-change resolver matched complete boat states and hit surfaces across a grid around every island at four hull radii. Retained regression tests compare the filtered island path against unfiltered terrain polygon resolution, including changed island geometry. Cached bounds apply only to generated island outlines, not mutable terrain arrays.
