# 0090. Reuse settlement levels for unchanged piers

**Status:** Implemented for review, 2026-10-22.

**Context:** The simulation checks piers before and after every step. Each check previously allocated a settlement level record and serialized it to JSON, although settlement levels rarely change.

**Decision:** Cache the last level snapshot and map identity per world. Scan own settlement entries directly and compare their levels and count; create a level record and rebuild piers only when a level, membership or map identity changes. Keep both simulation checks in place so growth during a step updates collision geometry immediately.

**Consequences:** Steady checks allocate neither a level record nor a JSON string. Direct mutation, replacement trade/settlement state and added/removed IDs remain observable. Reordered records and changes to growth alone reuse geometry. Maps retain their existing immutable-geometry assumption; replacing the map invalidates this cache.

Validation: targeted tests cover in-place levels, first refresh, removals, equal-count ID replacements, save-style state replacement, stable growth/reordered records and map replacement. Existing settlement/save tests cover persistence and growth integration.
