# 0087. Reject distant harbours before transforming the hull

**Status:** Implemented for review, 2026-10-22.

**Context:** Every sailing port-range query already rejects distant harbours with enclosing circles, but first transforms and allocates the complete hull and recomputes its radius for each port. This work is unnecessary for most ports while sailing.

**Decision:** Store the exact local enclosing radius alongside the existing cached convex hull. Both derive from every authored ring and share the existing unknown-ship fallback to the sloop. Check this radius before producing world-space hull vertices. Include a coordinate-scaled floating-point allowance so rotation and translation roundoff cannot turn a boundary approach into an early rejection. Keep exact shore and pier distance calculations unchanged. The radius shares the existing hull cache lifetime; there is no new map or moving-boat cache.

**Consequences:** Distant ports avoid hull allocations, trigonometry and per-vertex distance calculations. Nearby ports retain their original exact hull clearance, heading and level behavior. Authored hull shapes remain static, matching the existing local outline cache contract.

Validation: 164 targeted tests passed across harbour-range, harbour-hulls and harbours, including all ship classes, unknown IDs, all authored rings, and finite cutoffs immediately around exact gaps. Existing docking tests cover both maps, headings and dock levels.

Benchmark: 10,000 `portInRange` calls on PHASE1_MAP, cycling 200 sailing positions (`x = sin(i * .31) * boundsRadius * .85`, `y = cos(i * .47) * boundsRadius * .85`, heading `i * .17`) and all seven ship IDs, range 16, default settlement levels. Warmed both implementations for 10,000 calls first. The previous implementation was imported from a temporary copy of main's trade.ts, sharing the same local hull implementation. All 1,400 position/ship outcomes matched. Three sequential samples in milliseconds: before `[319.9532, 314.3360, 326.6642]`; after `[225.8877, 243.5280, 527.1847]`. Median 319.95 → 243.53 ms (24% less query CPU time); the after samples show substantial host scheduling noise. This measures harbour queries, not whole-frame FPS. The temporary baseline and timing test were removed after measurement.
