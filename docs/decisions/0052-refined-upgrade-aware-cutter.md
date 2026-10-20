# 0052. Refined cutter with independent stays and preserved upgrades

**Status:** Implementation for review, 2026-10-20.

**Context:** The refined sloop is merged in main at `48121c4` ([0051](0051-refined-upgrade-aware-sloop.md)). Bring the cutter to the same storybook quality without losing its swift-line proportions, rig, upgrade progression or older-tablet support. Hull-sized wakes ([0050](0050-tablet-friendly-ship-wakes.md)) must survive the model change.

**Decision:**

- Extract the sloop's construction into `RefinedBoat`; retain `RefinedSloop` and introduce `RefinedCutter` as dimension/palette definitions (subsequently corrected to independent hull profiles in [0053](0053-distinct-cutter-hull.md)). The sloop's geometry and animation remain unchanged. Other ship classes retain the previous builder.
- Preserve the cutter's 6.2 × 2.1 × 1 reference hull (13.64 × 4.851 m displayed length/beam), 6.4 reference mast height and aft-set mast at z=0.2. Use its brown timber, red class band/pennant/racing stripe, and its own 3.1 m boom and 2.4 m gaff. The rounded bilge, raised gunwales, hatch, rudder and tiller share the refined art language.
- All 27 independent upgrades remain: hold 1/2/3 shows 3/5/8 cargo pieces, with barrels from hold 2; hull 2 adds red paint and hull 3 retains paint plus copper; sails 1 has patched canvas and two jibs, sails 2 has clean canvas and a third jib, sails 3 adds stripes and a topsail. No save, stats or sailing-rule changes.
- Mainsail/boom turn at the mast gooseneck; lowering slides the gaff/throat down the mast without moving the tack. Each headsail rotates around its own head-to-tack inclined stay. Its luff stays fixed while lowering rolls the free edge inward. Cutter tacks lie on the solid bowsprit; a low inner staysail and narrower outer jibs give a distinct rig. Running sheet endpoints follow their moving clews. This is the sloop's inexpensive sail-handling approximation, not cloth physics.
- Preserve Low/Medium/High and Auto fallback. Low hides the rope draw and skips its buffer updates; every upgrade remains visible. No new textures, shaders, per-frame mesh generation or animation allocations. Share materials within each boat.
- Boat-only budgets: levels 1/2/3 measure **591/703/827 triangles**, **6/7/7 mesh draws**, plus one optional rigging draw. Allow seven cutter mesh draws rather than the previous six-mesh test ceiling: the third individually pivoted jib needs its own transform/draw. Maximum geometry remains well below 1,500 triangles; the sloop stays at six meshes / 743 triangles. Shadow passes, ocean and wake are separate costs.
- Export the exact pre-existing cutter wake footprint at every upgrade level. Keep the existing one-draw wake, its quality budgets and `GameView` reset on rebuild unchanged.

**Consequences and validation:**

- `cutter-rig.test.ts` exercises actual cloth vertices for every upgrade combination through both tacks, lowered/full sails, luff and heel; checks mast attachments, distinct stay axes, cargo, colours, wake footprint, geometry and quality toggles. Sloop, save and wake regression suites remain applicable.
- `models.html?view=cutter&level=3&quality=low&still` uses the game's quality profiles. Independent `hull=`, `hold=`, `sails=` (1–3), `sail=` (0–1), signed `boom=` and `yaw=` degrees support inspection. Existing sloop URLs still work.
- [Actual engine captures](../art/game-models/refined-cutter/README.md) include stock, levels 2/3, Low, opposite-tack lowered sails, mixed upgrades, and the real `GameView` at all three qualities. Headless WebGL checks cover live quality changes and upgrade rebuilds without browser errors. Device FPS on a physical older tablet remains a playtest requirement; software rendering cannot establish that result.
