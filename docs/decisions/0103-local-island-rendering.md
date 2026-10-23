# 0103. Local island rendering and settlement rebuilds

**Status:** Implemented for review (2026-10-23). Extends [0060](0060-growing-town-visuals.md), [0096](0096-island-files-and-island-builder.md) and [0101](0101-island-files-built.md).

## Context

The renderer merged all island and collision-terrain geometry into one world-sized mesh. A camera looking at one port still submitted every island. One town growing regenerated the entire world, disposed its materials and recreated harbour lanterns. Startup first built map defaults, then immediately rebuilt with restored settlement levels.

## Decision

- Batch land separately per island and per collision-terrain feature. Designed islands have separate terrain, town and glowing-window batches. Every mesh has bounds computed from its actual transformed vertices, including all authored coastlines, mountains, piers and outlying props. Three.js camera and shadow frustum culling stays enabled.
- Return an `IslandModel` root with `setSettlementLevels` and `dispose`. Rebuild only islands whose associated port level changes. IDs, placement, design, radius and levels come from map/island data; there is no fixed list of ports or rendering radius.
- Mark authored terrain before batching. If its complete merged attributes are unchanged after a level update, retain the existing terrain mesh and uploaded geometry; a changed authored quarry bench replaces it. Terrain generation for the affected island still runs to detect changed geometry, but unrelated islands and collision terrain never regenerate.
- Share one Lambert land material and one basic window material across the batches. Root `userData.windows` remains the single night-lighting tint used by the game and model sheet. Replacing a batch disposes its geometry only; the root owns shared material disposal.
- Keep the harbour record and each point stable across updates. Harbour geometry anchors are independent of settlement level, so growth does not recreate the lantern system. Initialize the view from restored settlement levels on the first build.

## Consequences

- More potential draw calls than one world mesh, but off-screen island triangles and shadow work can be excluded. The full-view geometry budget is unchanged. Profile representative devices before adding further subdivisions or distance detail.
- No new tuning or content constants: boundaries derive from authored geometry, with the existing island-file and map-editor data remaining authoritative. An edited map creates a new view/model as before.
- Tests compare every vertex, normal and colour with the existing parts builder at all four levels, verify unchanged object identity, quarry replacement, stable anchors, complete culling bounds, arbitrary edited IDs/placement, immediate restored-level output and shared-material lifetime.
