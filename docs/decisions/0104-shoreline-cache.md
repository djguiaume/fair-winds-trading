# 0104. Keep the shoreline bake across water quality changes

**Status:** Implemented for review (2026-10-23).

## Context

Water quality rebuilds the ocean grid and shader, but every rebuild also rasterized the same 512-square shoreline distance texture. Authored island files (0096/0101) and mutable map data mean an identity-only cache would retain stale water after edits.

## Decision

- Each GameView owns one ShoreTextureCache. Its ocean borrows the texture and bounds across Low, Medium and High changes. A standalone Ocean still owns its bake.
- At water rebuild time, compare effective world-space coast coordinates, generated island circles and terrain outlines by value. Equal replacement objects reuse the bake; position, radius, harbour rotation, array edits and in-place authored coast edits replace it. Read design coasts directly so the simulation's identity-based coast cache cannot hide live edits.
- The cache holds only the current bake, disposes it on replacement and releases it with the view. Borrowing oceans release only their geometry and material; disposal is idempotent.
- No frame-loop serialization, global GPU cache, fixed island identifiers or new tuning knobs. Inland props, terrain heights and town levels do not affect this distance-to-coast texture and need no invalidation. Future in-place editor preview changes must request a water rebuild; get checks the current data on every rebuild.

## Consequences

Quality switches avoid rasterization and GPU texture re-upload for unchanged shores. The existing water appearance and bake resolution stay unchanged. Content comparisons still allocate a small coordinate snapshot at rebuild time; they scale with coastline points, not texture pixels. Tests cover the real GameView quality path, ownership, standalone compatibility and mutable file/map inputs.
