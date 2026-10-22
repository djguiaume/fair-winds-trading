# 0086. Compare squared coastline distances

**Status:** Implemented for review, 2026-10-22.

**Context:** `coastDistance` evaluates every polygon edge during collision and other shore queries. Each edge previously called `Math.hypot`, although only the nearest distance and normal are returned.

**Decision:** Compare squared point-to-edge distances and compute the winning distance with the original `Math.hypot`. For nearly tied squared distances (within eight machine epsilons), underflow ties, and overflow, fall back to the original hypot comparison. This preserves first-edge tie selection, tiny-distance normals, winding, degenerate outlines, and numerical range without caching mutable outline data.

**Consequences:** The projection and inside-land logic remain unchanged. Exact equivalence tests cover authored phase-one terrain, near/far samples, reversed winding, boundary points, tiny and huge coordinates, and empty/degenerate outlines. A one-off targeted benchmark uses three positions per authored terrain vertex (near the coast, moderately offset, and far offshore), 18,600 calls per sample, warmup, and five samples. On the development machine, median CPU time fell from 19.85 ms to 13.79 ms (30.5%). This measures this function, not frame rate; gains depend on polygon size and how frequently coast distance is queried.

Run the regression oracle with `node node_modules/vitest/vitest.mjs run tests/coast-distance.test.ts`.

