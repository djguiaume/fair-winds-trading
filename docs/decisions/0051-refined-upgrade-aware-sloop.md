# 0051. Refined sloop with upgrade-aware geometry and attached sail pivots

**Status:** Implementation for review, 2026-10-20.

**Context:** Guillaume approved an incremental improvement of the current storybook sloop: a shaped hull, gunwales, hatch, rudder/tiller and supported sails. The preview was illustrative, not an engine capture. The actual ship is upgraded, so replacing it with a stock one would lose its progression. Both sails must pivot at believable attachments. Older tablets and the existing Low/Medium/High profiles remain requirements; this is the browser game, not the separate realistic/native exploration.

**Decision:**

- Replace only the sloop factory output with `RefinedSloop`, retaining the bow-to-−Z / waterline origin, approximately 11 m display length and simulation interface. Other ship classes retain their existing models. Unknown classes still fall back to the sloop.
- Build a pointed bow, rounded stern and bilge from several hull rings. Merge hull, gunwales, forward hatch, rudder/tiller, mast, bowsprit and cargo into one vertex-coloured Lambert mesh. No downloaded models, textures, new shader or paid generation.
- Preserve all independent upgrade tracks: 2/4/7 cargo pieces (barrels from hold 2), blue upper band from hull 2, copper bottom from hull 3; patched stock canvas, extra jib and clean canvas at sails 2, blue racing stripe and topsail at sails 3. The approved preview is not a reason to add upgraded decoration to the stock model.
- The mainsail and its boom turn about the gooseneck on the mast. Both luff corners stay on the mast axis; the gaff supports the diagonal upper edge. Lowering compresses the cloth and lowers the gaff along the mast while the boom stays at its attachment. This remains a lightweight approximation, not a full cloth/halyard simulation.
- Give each jib its own inclined forestay through its actual head and tack. Turning occurs about that axis; fullness changes only off the luff, and reducing sail rolls the free edge towards the stay. Neither luff endpoint moves. The extra upgraded jib never shares the first jib's mismatched axis. Working sheets and gaff lift follow the moving endpoints.
- Keep the three graphics profiles and Auto fallback unchanged. Low hides the complete rope draw and skips rope-buffer updates. Medium/High show rigging; materials, upgrades and correct attachment axes work at every quality. `GameView` applies quality as a live toggle, including after rebuilding a boat for an upgrade, rather than permanently disabling ropes when constructed on Low.

**Consequences and validation:**

- Actual geometry: stock **507 triangles / 5 meshes**, level 2 **619 / 6**, maximum upgrades **743 / 6**. The former maximum-upgrade sloop was 441 / 5. The small increase stays below the original 1,500-triangle / six-mesh budget. One optional line draw is added above Low; shadow passes are separate.
- `sloop-rig.test.ts` checks all 27 upgrade combinations, actual luff vertices against the forestays while tacking/lowering/heeling/luffing, mainsail mast attachment, colour upgrades, budgets, and quality toggling. Existing saves, ship stats and sailing rules are unchanged.
- Actual screenshots, not generated illustrations: [refined-sloop](../art/game-models/refined-sloop/README.md). Review at `/models.html?view=sloop&level=3&quality=low&still` (also `medium`/`high`, levels `1`/`2`, `sail=0.35`, signed `boom=-45`).
- Desktop headless WebGL rendering verifies all three game profiles without browser errors. A physical older-tablet frame-rate check remains necessary; headless software rendering is not a device performance guarantee.
- Integration with merged wake decision [0050](0050-tablet-friendly-ship-wakes.md): expose the sloop's unchanged hull length/beam to the hull-attached foam, retaining the wake quality budgets and reset on ship rebuilds. Renumbered this decision to 0051 to avoid the parallel 0050 collision. Combined validation: 222 tests, build and lint pass; all three game profiles render without browser errors.
- Applying the visual rework to the cutter and later ship lines is separate work.
