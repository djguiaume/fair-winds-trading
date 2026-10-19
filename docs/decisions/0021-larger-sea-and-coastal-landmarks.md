# 0021. Larger sea and coastal landmarks

**Status:** Accepted, 2026-10-19.

## Context

The selected Staggered passages layout had useful sailing decisions but felt small and generic. The player asked for detail beyond the four trading islands, while preserving those islands and room for fast boats and later fighting.

## Decision

Increase the boundary radius from 260 to 440: 69% wider, 2.86 times the area. Keep the four main islands' appearance, positions, sizes, production scenery and dock seeds unchanged. Keep the existing strategic barriers and sandbank collision outlines. Decorate them with pine groves, sandstone outcrops, rocks, grass, driftwood, wreckage, ruins and navigation beacons. Give existing small islands distinct landmarks too.

Add four outer scenic islands: Abbey Head, Lantern Isle, Wrecker’s Rest and Watchman Key. These provide recognizable destinations around the larger sea without replacing the existing trading circuit. They introduce no ports, economy roles, unlock requirements or rewards. Open eastern water remains available for the Cutter and future combat. Trade roles remain provisional.

All props use seeded, untextured, low-poly geometry merged into the existing island mesh: 14,664 triangles total, one island draw call, no additional textures. Terrain props stay inside the exact collision outlines. The map remains within the ocean shader's twelve-island budget.

## Consequences

Existing saves retain the map identity, ports, markets and player position. Existing main-island geometry is checked byte for byte against Phase 0. Navigation checks cover all directed port pairs across five winds and an actual sloop circuit; outer landmarks are also reachable in the route graph. Geometry tests enforce interior placement and a 20,000-triangle ceiling.

The larger sea is available now; there is no artificial exploration gate. Progression still comes from trading, upgrades and the Cutter. Contracts and later map unlocks remain roadmap work. The outer islands are scenery until a future gameplay task gives them a role.

Review renders use the actual merged mesh with CPU depth buffering, not browser screenshots: [overview](../maps/expanded-overview.png), [details](../maps/coastal-details.png). Reproduce with `docs/maps/src/export-geometry.mjs` followed by `docs/maps/src/render-rich-map.py` (Python: NumPy, Matplotlib, Pillow).
