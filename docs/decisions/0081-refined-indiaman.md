# 0081. Refined indiaman

**Status:** Implementation for review, 2026-10-22.

**Context:** The indiaman (hauler line tier 3, [0035](0035-three-ship-lines.md)) was the last hauler still on the original storybook construction. [0077](0077-one-file-per-ship-model.md) reserved this number for its redesign in its own file, and [0079](0079-refined-fluyt-and-square-rig.md) added the shared square rig and stern castle for it to reuse. As with the other redesigns, Guillaume asked that sail movement and attachment points be fixed too.

**Decision:**

- **Only `indiaman.ts` changes.** It reuses `squareMasts`, `castle`, `mainName: 'Mizzen'` and `mainTopsail: false` from `refinedBoat.ts` exactly as the fluyt does, with no change to the shared code.
- **Reference envelope kept:** 13 × 3.8 × 2, square fore (+3.8, 9.6) and main (+0.4, 10.8) with three courses each (the top course from sails 3), a gaff mizzen (−3.8, 7.6) on the castle, two jibs (three from sails 2), dark brown hull `#5c3a1c` with a red band `#8a2f2f`. Cargo stays 7 / 9 / 12 pieces between the square masts, with barrels from hold 2.
- **Its own hull, distinct from the fluyt:** a full bow, a long parallel midbody and a **broad square transom** under a longer castle (4.4, height 0.9), where the fluyt pinches in. The sections are **wall-sided** with only a slight tumblehome and a firm bilge, unlike the fluyt's pear shape.
- **A row of painted gun ports** on the upper strake, six a side, the classic Indiaman look. They are cast onto the hull's own surface at build time and merged into the hull mesh, so they add 24 triangles and no draw call. They show on the red band from hull 2.
- No save, simulation, wake, quality-profile or shader changes. The waterline origin, −Z bow, display scale and the **28.6 × 8.78 m** hull-sized wake stay the same.

**Consequences and validation:**

| Common upgrade level | New triangles | New mesh draws | Old triangles / mesh draws |
|---|---:|---:|---:|
| 1 | 1,093 | 10 | 681 / 13 |
| 2 | 1,237 | 11 | 823 / 13 |
| 3 | 1,409 | 11 | 1,021 / 17 |

Fewer draws than before at every level, and more triangles, about 10% above the fluyt because of the third jib, the bigger cargo and the ports. `indiaman-rig.test.ts` covers the factory route, the wall-sided sections and broad transom against the fluyt, the castle and the mizzen standing on it, and every port flush on its strake on both sides. Across all 27 upgrade combinations it checks course heads on their yards at every furl, course clews on their sheets, jib luffs on their stays with heads on the foremast, and the mizzen clew on its sheet. All of that runs through full, reefed and furled sail, both tacks, both heels and luffing. The tests also cover the triangle and mesh budgets and the Low/Medium/High rope toggle. [Engine captures](../art/game-models/refined-indiaman/README.md). A physical older-tablet FPS check is still needed.
