# 0032. Reef strikes and shallows

**Status:** Implementation for review, 2026-10-19. Guillaume asked for the reef and shallow hazards after the Windward Ring map merged.

**Context:** [0010](0010-light-hazards-pirates-later.md) asks for light hazards: reefs and shallows that slow the ship, with ship health designed so pirates can reuse it later. The Windward Ring map ([0031](0031-windward-ring-map.md) after renumbering; first merged as 0030) added five `reef` terrain features that were solid like any shore but harmless.

**Decision:**

- **Shallows:** a 14-unit band around every reef drags at the hull: extra braking up to 0.6/s at the reef's edge, fading to nothing at the band's edge, scaled by the ship's new `draft` (sloop 0.7, cutter 1). Deeper hulls are punished more, the start of "reefs and shallows that block bigger ships" (Phase 4). Island shores and beaches have no shallows drag.
- **Reef strikes:** hitting a reef costs hull points: 6 per knot the strike took off, so a glancing touch is cheap and a head-on hit at 8 kn takes about a third of a stock hull. Beaches stay soft (a bump, no damage). The HUD toasts "Struck a reef!" with the hull percentage.
- **Hull condition:** damage is kept per owned ship and capped at the hull's durability (100 / 150 / 220 by hull upgrade level, already in [0011](0011-ship-lineup-and-upgrades.md)). A damaged hull leaks: speed drops linearly to −25 % when wrecked. Nothing sinks and no cargo is lost. A hull pill appears in the HUD while damaged (orange under 50 %).
- **Repair:** in any harbour, 1.5 gold per point, partly if gold is short. When upgrades move to the home base ([0030](0030-home-base-upgrades-and-earned-ships.md)), repairs stay available at every port so a damaged ship can always limp home.
- Saved as an optional `hullDamage` field (save version unchanged; older saves load with sound hulls). Code: `src/sim/hazards.ts`, wired in `stepWorld`; no map data changes.

**Consequences:** The Narrows and the reef-lined shortcuts become a risk/reward choice: faster but you can lose speed and gold. Storms and cargo spoilage stay with Phase 2 weather. Pirates (Phase 5) can reuse `damageHull`, the leak and repair. Knobs: `SHALLOW_WIDTH`, `SHALLOW_DRAG`, `STRIKE_DAMAGE`, `LEAK_PENALTY`, `REPAIR_COST`, and `draft` per class.

**Validation:** `tests/hazards.test.ts`: reef distance and shallowness, deeper cutter slowed more, reef strike damages while a beach does not, leak floor, partial and full repair, save round trip and legacy saves. Checked in the built game with headless Chromium ([screenshots](../screenshots/README.md)).
