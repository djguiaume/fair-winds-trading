# 0056. Refined clipper with its own hull and three attached fore-and-aft rigs

**Status:** Implementation for review, 2026-10-20.

**Context:** Following the refined sloop, cutter and schooner ([0051](0051-refined-upgrade-aware-sloop.md)–[0054](0054-refined-upgrade-aware-schooner.md)), Guillaume requested the next boat at the same quality, retaining its own proportions, hull, rig, upgrades and hull-sized wake. The next implemented swift-line ship is the clipper. Decision [0035](0035-three-ship-lines.md) and the existing model give it three fore-and-aft masts; a historical square-rig conversion would change that game identity. Latest main, including #38's navigation fix, was integrated before final validation.

**Decision:**

- Route only the clipper to `RefinedClipper`. Keep its 9.8 × 2.4 × 1.15 reference dimensions, charcoal hull, gold band/pennant, three mast stations (+2.8 / +0.2 / −2.6) and heights (7.6 / 8.8 / 7.8). Author its own knife entry, aft-set maximum beam, long run, small raked transom and narrow V sections. It does not reuse the schooner's forward shoulder and swept counter or stretch the sloop/cutter hull.
- Extend shared refined construction with an optional mizzen and class-specific hatch/cargo placement. Each gaff rig has its own fixed mast/gooseneck, boom, gaff lift and working sheet. Size the fore and main booms to clear the next mast even on the centreline; the mizzen boom finishes within the stern. All three lower along their own mast axes, retaining the established cheap reefing approximation rather than cloth physics. Both main and mizzen keep their sails-3 topsails.
- Keep all three existing jibs at every upgrade level. The former clipper already capped headsails at three, so sails 2 changes canvas without adding a fourth jib. Every jib now has its own inclined stay, head attached to the foremast and tack on the solid bowsprit. Fixed luff endpoints survive tacking, rolling/lowering and heel; sheets follow actual cloth corners. The extra independent pivots account for two mesh draws versus the old merged jib mesh.
- Preserve all 27 independent combinations: 4/6/9 cargo pieces, barrels from hold 2, gold hull band from hull 2 and copper from hull 3, patched stock canvas, clean level-2 canvas, gold racing stripes plus two topsails at sails 3. Stow cargo between fore and main, clear of mast bases; put the hatch forward of the foremast.
- Preserve −Z bow, waterline origin, display scale and **21.56 × 5.544 m** hull-sized wake envelope. No save, simulation, quality profile, wake-buffer, texture or shader changes. Low hides the one rope draw and skips buffer updates; sail attachments and upgrade appearance remain at all three graphics levels.

**Consequences and validation:**

| Common upgrade level | New triangles | New mesh draws | Previous triangles / mesh draws |
|---|---:|---:|---:|
| 1 | 939 | 11 | 561 / 9 |
| 2 | 995 | 11 | 643 / 9 |
| 3 | 1,191 | 11 | 769 / 9 |

One additional rope draw above Low; shadow passes are separate. Maximum geometry stays below 1,200 triangles. The model uses merged vertex colours, shared Lambert materials, one small dynamic rope buffer and no per-frame geometry construction. Existing sloop/cutter/schooner budgets remain unchanged. The increased sail complexity needs actual tablet playtesting; software WebGL costs do not establish hardware FPS.

`clipper-rig.test.ts` covers the real factory, independent hull sections, mast stations, actual boom bounds, all 27 upgrades, cargo and hull colours, actual luff vertices and free corners versus their stays/sheets through full/lowered/furled sail, both tacks, both heels and luff states; measured mesh/triangle budgets, and live Low/Medium/High rope toggles. **242 tests pass; lint and production build pass.** Representative full-scene draws are 18/19/31 on Low/Medium/High, including the ocean, islands, wake and shadow passes. Engine captures exercise each quality in the inspector and real GameView, mixed upgrades, opposite tack, lowered/furled sails and a second angle, without browser errors. Full scene draw counts and wake vertices are retained in [measured results](../art/game-models/refined-clipper/render-results.json).

[Actual screenshots and reproduction instructions](../art/game-models/refined-clipper/README.md). Other boats remain separate refinements. Physical older-tablet FPS validation remains outstanding.
