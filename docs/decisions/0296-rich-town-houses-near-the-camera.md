# 0296. Rich town houses near the camera

**Status:** Accepted (2026-11-11). Issue #500, v1.8. Guillaume picked variant A; the art director's limits are in `docs/v1.8/brief.md`.

## Context

The homes of every town were boxes with a gable or hip roof (32 to 88 triangles), so a town read flat from the chase camera. The Saltline comparison (PR #496, `docs/reviews/saltline-lighting/`) showed a richer low-poly house (variant A, 128 triangles) that stays flat-shaded and inside the art bible. It must not cost the phones and the old tablets anything.

## Decision

- Every home recipe (`fish-house`, `cabin`, `beach-house`, `farmhouse`, `nordic-house`, `stone-house`, `yard-house`, `iron-house`, `turf-house`, `turf-cottage`) names an internal `<id>-rich` recipe in its new `rich` field. The rich recipe `extends` the plain one (same `h`, same walls) and adds: a darker footing band, an overhanging roof with three pitches by variant, a ridge beam or a taller roof, a chimney with a warm charcoal cap (none on tropic), a door step, and a lean-to on every other house where the budget allows. Windows are left out of it: the plain recipe's lit panes serve both, so the night glow is unchanged.
- A town builds both sets. The plain homes and the rich homes are two meshes under one `THREE.LOD` per island (`houseDetail.ts`): the rich one within `graphics.json › houses.richWithin` (140 units, beyond which the extras are under a pixel) of the town's edge, with a `hysteresis` margin so it never flickers, the plain one beyond. `graphics.json › quality.*.richHouses` switches the rich set on: High and Ultra only; Low, Medium and Ultra-low always show today's houses.
- Homes budget (`prop-groups.json`) 120 → 130 triangles for a rich house with its windows (worst case 128). The island builder's per-island budget moves 6000/5000 → 8500/7000 because it counts the near set. `tools/performance/budget.json` sailing: +1 draw call per town in view, about +4,000 triangles; re-set 10% above the measurement (calls 38, triangles 177k new look, 76.5k classic).

## Consequences

- The plain recipes and the plain golden hashes are unchanged: Low looks as before.
- A new home style needs a rich recipe (a test fails otherwise); a style may skip details to stay within 130 triangles.
- Swapping per town, not per house, keeps one extra draw call per town. A very wide town can swap a few houses early or late; at 140 units the difference is a few pixels.
- Measured in the headless run: sailing 26 → 31 calls and 156.2k → 161.2k triangles (new look), 28 → 34 and 65.4k → 69.8k (classic). A phone `?bench` on High is the open check; the Low phone path is untouched.
- Edit a rich recipe like any prop; `npm run tune -- list graphics` lists `richHouses`, `houses.richWithin` and `houses.hysteresis`. Before/after sheets: `docs/v1.8/houses/`.
