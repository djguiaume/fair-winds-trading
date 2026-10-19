# 0016. Game models: storybook boats and bright highland islands, built in code

**Status:** Accepted, 2026-10-19

**Context:** The art style is chosen ([0012](0012-boat-and-island-art-style.md): D storybook classic boats, B2 bright highland islands, A sea) and models stay code-built ([0014](0014-code-built-models-for-now.md)). Phase 0 still drew primitive placeholders. Phase 1 needs the sloop with its three visible upgrade tracks and the cutter ([0011](0011-ship-lineup-and-upgrades.md)), and producer islands whose props show what they make, all within the old-tablet budget ([0006](0006-desktop-and-mobile.md)).

**Decision:**
- Port the reference builders of [docs/art/src/lib.js](../art/src/lib.js) into the game: `src/render/models/storybookBoat.ts` (style D) and `src/render/models/highlandIslands.ts` (B2), selected in `src/render/models/index.ts`. The placeholders are removed.
- **Boats:** sloop and cutter, same proportions and colours as the sheets, drawn 2.2× the sheet scale (sloop ≈ 11 m, as before). One merged vertex-coloured mesh for hull, deck, band, copper, cargo, mast and bowsprit; the boom and mainsail (plus topsail) swing on a pivot at the mast, the jibs turn around the forestay, the flag streams with the wind. Sail patches and the racing stripe are vertex colours, not textures. Rigging lines are hidden at the low quality setting.
- **Upgrades on the model:** the factory takes `{ sails, hold, hull }` levels 1–3. Sails: patched canvas → new canvas and an extra jib → racing sails with a class stripe and a topsail. Hold: 2 → 4 → 7 crates, barrels from level 2 (plus one per class size). Hull: bare → class-colour band → copper bottom. A purchase rebuilds the model.
- **Islands:** beach, 1–4 tapered sandstone layers and a grass cap, all islands merged into one mesh (one draw call). The island's look follows the first good its port produces ([0015](0015-trade-economy.md)); a render-only `look.kind` (`fish`, `timber`, `grain`, `stone`) can override it. It picks the props: village and fish racks; forest, log pile and hut; fields, windmill and farmhouse; boulders and a cart. The cliff layers step back from the harbour side, and the harbour (dock and town) faces the course buoy named after the island. The waterline stays on the collision radius. The shallows glow stays in the ocean shader.
- With the Phase 1 ports this gives Port Calda timber, Saltmere fish, Westholm grain and Stonehaven stone.
- `GameView` builds the boat for the captain's active ship and its upgrade levels, and rebuilds it when either changes (shipyard purchase, buying the cutter).
- A model sheet page, `models.html` (boats or islands, with draw calls and triangles), ships next to the game for reviewing models on real devices.

**Consequences:**
- Budget per boat: 5 meshes + 1 line set (6 draw calls); sloop 241 / 339 / 441 triangles at levels 1 / 2 / 3, cutter 285 / 383 / 485. All eight Phase 0 islands: 4 484 triangles in one draw call. Tests in `tests/models.test.ts` hold these limits and the orientation conventions.
- Schooner, brig and fluyt are not modelled yet; unknown class ids fall back to the sloop. The fore-and-aft code already handles several masts; square rigs need yards and a different trim.
- The boat's blob shadow in `view.ts` is sized for the sloop; scale it per class when the cutter can be sailed.
