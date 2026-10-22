# 0079. Refined fluyt with a shared square rig and stern castle

**Status:** Implementation for review, 2026-10-22.

**Context:** [0077](0077-one-file-per-ship-model.md) gave each ship its own file and named the fluyt as the reference square rigger. The fluyt and the indiaman both need square sails on yards and a raised stern deck, and `refinedBoat.ts` only built gaff sails and jibs. The old fluyt's courses hung from yards, but they furled by scaling and nothing tied their clews to anything. Its castle was a plain box that ignored the hull's shape. Guillaume asked that each redesign also fix sail movement and attachment points, as PRs #36, #37 and #39 did.

**Decision:**

- **Shared square rig in `refinedBoat.ts`** (`squareMasts`). Each square mast has courses stacked up the mast, narrowing aloft. Each course hangs from its own yard just forward of the mast and bellies toward the bow. All of a mast's yards brace round together (0.6 × the boom angle, as before), and sails 3 adds the top course. A mast's courses are **one mesh with one morph target**: furling blends each course up toward its own yard, so every head stays on its yard at any sail setting and no geometry is rebuilt per frame. Each course's two clews sheet home to the yard-arms of the course below, and the lowest course sheets to the rail aft of its mast. The sheets follow the actual cloth corners. A fighting top sits above the lowest course. Jibs set on the foremost square mast.
- **Shared stern castle** (`castle`): it is built from the hull's own stern outline, with walls flush with the topsides, a deck, a forward bulkhead, a low rail and lit stern windows. Hull 2 paints its upper strake in the class colour. Masts, sheets and the tiller standing on the castle start from its top. Cloth now takes panel counts (`nu × nv`); square courses use 5 × 4 panels, and the gaff sails and jibs keep 6 × 6, so the existing ships are unchanged.
- **Fluyt** (`fluyt.ts`) keeps its 11.5 × 3.5 × 1.8 reference envelope, its brown hull with orange band, a square fore (+3.2, 8.6) and main (0, 9.6) with three courses each, and one jib, two from sails 2. It gets its own hull: a bluff round bow and a narrow pinched stern, with pear-shaped sections whose topsides tumble home over a wide, flat floor. The aft mast is a gaff **mizzen** on the castle (−3.3, 6.8, no topsail), and its boom ends inside the stern. Cargo is 5/7/10 pieces between the square masts, with barrels from hold 2. The main hatch sits aft of the main mast.
- No save, simulation, wake, quality-profile or shader changes. The waterline origin, −Z bow, display scale and the **25.3 × 8.09 m** hull-sized wake stay the same. On Low the rope draw and its buffer updates are skipped; sails and upgrades stay.

**Consequences and validation:**

| Common upgrade level | New triangles | New mesh draws | Old triangles / mesh draws |
|---|---:|---:|---:|
| 1 | 973 | 9 | 637 / 13 |
| 2 | 1,101 | 10 | 763 / 13 |
| 3 | 1,273 | 10 | 961 / 17 |

The fluyt has fewer draws than before and more triangles, still in the clipper's range. `fluyt-rig.test.ts` covers the factory route, tumblehome and castle, the mizzen on the castle, all 27 upgrade combinations, and course heads on their yards at every furl. It also checks that course clews sit on their sheets, jib luffs on their stays with heads on the foremast, and the mizzen clew on its sheet. All of that runs through full, reefed and furled sail, both tacks, both heels and luffing. The tests also cover the triangle and mesh budgets and the Low/Medium/High rope toggle. The indiaman (decision 0081, reserved) reuses `squareMasts` and `castle` without changing them. [Engine captures](../art/game-models/refined-fluyt/README.md). A physical older-tablet FPS check is still needed.
