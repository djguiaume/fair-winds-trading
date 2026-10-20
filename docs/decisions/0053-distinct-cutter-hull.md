# 0053. Independently shaped cutter hull

**Status:** Implementation for visual review; PR #36 remains a draft.

**Context:** The first cutter refinement preserved class dimensions and rig but reused the sloop’s normalized outline and bilge sections. Guillaume clarified that each boat must keep a distinct hull design, not become a stretched sloop. The original storybook cutter had a broad flat transom; its refinement should retain that identity.

**Decision:**

- Author the cutter’s outline and depth rings in `cutter.ts`: finer forward entry, maximum beam aft of midships, broad flat transom (76% of maximum beam), firmer lower shoulder and narrow V bottom. The sloop retains its original rounded stern, fuller bow and bilge without geometry changes.
- Share mesh construction, gunwales, palette handling and rig animation, rather than a universal hull silhouette. Future class refinements must author their own hull profile.
- Keep length, maximum beam, deck sheer/heights, mast and gooseneck positions, bowsprit and every individual jib stay unchanged. Sail attachment tests still exercise all 27 upgrade combinations through both tacks, lowering, luffing and heel.
- Preserve the exact hull-sized wake footprint, saves, all upgrades and three quality profiles. Same hull topology means no extra triangles, materials, draws or frame updates: cutter 591/703/827 triangles and 6/7/7 meshes at levels 1/2/3, plus one rope draw above Low.

**Consequences:**

- A production-geometry regression test checks normalized bow, transom and bottom-section vertices at every hull upgrade; different dimensions alone cannot satisfy it.
- All 228 tests, lint and build pass. Headless engine checks confirm all quality levels, live quality switching, upgrade rebuilds and unchanged wake sizes; physical older-tablet FPS remains unmeasured.
- Regenerated the complete [cutter capture set](../art/game-models/refined-cutter/README.md), adding a stern inspection and same-scale top-down hull comparison. Comparison hides sails/ropes explicitly to expose the real deck outlines; normal engine captures show the full rig.
