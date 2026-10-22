# 0080. Refined hoy: a beamy flat-bottomed coaster with leeboards and a raised boom

**Status:** Implementation for review, 2026-10-22.

**Context:** Decision [0077](0077-one-file-per-ship-model.md) split the ship models into one file each and reserved a decision number for the hoy (renumbered to 0080 after 0078 went to the press warning), the first ship of the hauler line ([0035](0035-three-ship-lines.md)). It was still the original storybook model ([0016](0016-game-models-style-d-and-b2.md)): its jib floated free of the stay, the sails did not stay on the mast, boom or gaff when tacking or reefing, and its hull was the same tapered shape as every other class. The sloop, cutter, schooner and clipper fixed this in decisions [0051](0051-refined-upgrade-aware-sloop.md)–[0056](0056-refined-upgrade-aware-clipper.md); the clipper is the quality bar. The hoy is a single-mast fore-and-aft rig, so it reuses the shared refined construction in `refinedBoat.ts` and does not wait for the fluyt's square rig.

**Decision:**

- `hoy.ts` builds `RefinedHoy` on `RefinedBoat`. It keeps the hoy's 6.2 × 2.7 × 1.3 reference envelope, brown hull, mustard band and pennant, one mast with a topsail at sails 3, and one jib (two from sails 2).
- **Its own hull:** apple-cheeked bow, nearly parallel sides, a broad rounded stern and a flat bottom that keeps 60% of the deck beam at the keel (the swift line narrows to 6–7%). It reads as a slow, full coastal carrier next to the fine swift-line hulls.
- **Leeboards:** a pear-shaped board on each side abreast the mast, half hauled up so it swings aft and stays mostly out of the water, the signature of Dutch and Thames coasters. They are merged into the hull mesh (no extra draw).
- **Rig:** the mast is set forward (station +0.9), with a long boom ending inside the stern and a short gaff. The gooseneck sits 1.1 above the deck instead of 0.7, so the boom swings clear of two layers of deck cargo. Cargo is stowed aft of the mast; the small hatch sits forward of it.
- **Sail attachments and movement** come from the shared refined rig, as for the other refined boats: the mainsail's tack stays on the gooseneck and its luff on the mast; each jib has its own inclined stay from the bowsprit to the mast; gaff lift and sheets follow the real cloth corners through trimming, tacking and gybing, reefing, furling and heel.
- **Two small optional hooks in `refinedBoat.ts`**, used only by the hoy: `gooseneck` (boom height, default unchanged at 0.7) and `details` (class-specific geometry merged into the hull mesh). Other boats are unaffected. The square-rig and stern-castle work of the fluyt (0079) is not touched.
- All 27 upgrade combinations stay visible: 4/6/9 cargo pieces with barrels from hold 2, patched → clean → striped canvas with a second jib at sails 2 and the topsail at sails 3, mustard band from hull 2 and copper from hull 3.
- Same −Z bow, waterline origin and display scale; the hull-sized wake stays **13.64 × 6.24 m**. No simulation, save, heel factor (0.75, already set for the hoy), quality profile, texture or shader change.

**Consequences and validation:**

| Common upgrade level | New triangles | New mesh draws | Old triangles / mesh draws |
|---|---:|---:|---:|
| 1 | 627 | 5 | 277 / 5 |
| 2 | 755 | 6 | 391 / 5 |
| 3 | 879 | 6 | 493 / 5 |

Well under the clipper's 1,200-triangle ceiling; the extra draw at sails 2–3 is the second jib on its own stay. One rope draw above Low, hidden on Low. `tests/hoy-rig.test.ts` covers the real factory, hull sections, leeboards, boom clearance over cargo and inside the stern, all 27 upgrades, every luff vertex on its mast or stay and every sheet on its cloth corner through full/reefed/furled sails, both tacks, both heels and luffing, mesh and triangle budgets and the Low/Medium/High rope toggle. Inspector and in-game captures show no browser errors. Physical older-tablet FPS still needs a playtest. [Screenshots](../art/game-models/refined-hoy/README.md).
