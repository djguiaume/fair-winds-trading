# 0054. Refined schooner with an independent hull and two attached gaff rigs

**Status:** Implementation for review, 2026-10-20.

**Context:** Following the refined sloop ([0051](0051-refined-upgrade-aware-sloop.md)) and cutter ([0052](0052-refined-upgrade-aware-cutter.md), [0053](0053-distinct-cutter-hull.md)), Guillaume requested the next boat at the same visual quality, retaining its own shape, proportions, rig, upgrades, hull-sized wake and older-tablet support. The next implemented swift-line boat is the schooner; the brig remains a planned warship.

**Decision:**

- Route the schooner to `RefinedSchooner`, keeping its 8.2 × 2.3 × 1.1 reference dimensions, green palette, mast stations (+1.6 / −1.4), shorter forward mast (6.4) and taller aft mainmast (7.4). Independently authored outline and depth sections provide a fine entry, forward shoulder, narrow swept counter and tapered lower hull. It is neither a stretched cutter nor a rescaled sloop.
- Extend shared refined construction to support a second gaff rig. Each sail has its own mast/gooseneck axis, boom, gaff, lift and working sheet. The forward boom clears the aft mast. Lowering slides each gaff/luff down its mast while its boom attachment stays fixed. The aft main alone gains the level-3 topsail. This is the established lightweight handling approximation, not cloth or halyard physics.
- Keep two stock jibs, three from sails level 2; every jib has its own inclined head-to-tack forestay. Heads attach to the forward mast and tacks lie on the solid bowsprit. Tacking/rolling the cloth towards its stay cannot move either endpoint; running sheets follow the actual transformed free corners through heel, luff and lowering.
- Preserve every independent hull/hold/sails combination: 4/6/9 cargo pieces, barrels from hold 2, green band from hull 2 and copper from hull 3, patched stock canvas, clean sails and extra jib at sails 2, green racing stripes and aft topsail at sails 3. Move the hatch forward and stow cargo between the masts to avoid collisions with their bases.
- Retain the waterline origin, −Z bow, display scale and **18.04 × 5.313 m** wake footprint. No save, ship stat, quality-profile, wake-buffer or shader changes. Low hides the sole rope draw and skips rope-buffer updates; correct sail axes and upgrades work at all three levels.

**Consequences and validation:**

| Common upgrade level | New triangles | New mesh draws | Former triangles / mesh draws |
|---|---:|---:|---:|
| 1 | 735 | 8 | 413 / 7 |
| 2 | 863 | 9 | 527 / 7 |
| 3 | 987 | 9 | 629 / 7 |

One optional rope draw above Low; shadow passes are additional. The extra jib pivots cost two mesh draws versus the former merged-jib mesh. Geometry stays below 1,000 triangles; no textures, PBR, new shader, per-frame geometry allocation or per-sail materials. Shared sloop/cutter geometry budgets remain 743/6 and 827/7 respectively.

- `schooner-rig.test.ts`: all 27 combinations, actual luff vertices against the static stays, mast and solid-bowsprit attachments, working sheets at actual cloth corners, both gaff rigs on their own mast axes through tacking/lowering/heeling/luffing, hull sections, forward-boom clearance, upgrade colours and cargo counts, geometry budgets and live quality toggles. Existing sloop/cutter, wake, save and tablet checks pass.
- **234 tests pass; lint and production build pass.** Chromium software WebGL renders close-ups and the real GameView at Low/Medium/High without browser errors. Maximum model cost is 987 triangles / nine mesh draws; representative complete game costs are 16/17/27 draws on Low/Medium/High, including the ocean, islands, wake and shadow passes. These are scene measurements, not an FPS promise.
- [Actual engine captures, measured results and reproduction script](../art/game-models/refined-schooner/README.md). A physical older-tablet playtest remains necessary for frame-rate validation.
- Later boats remain separate refinements and must retain independently authored hull shapes and rigs.
