# 0171. The west fire sea, Emberhold

**Status:** Proposed (2026-10-25). Waits on Guillaume's OK of the screenshots, the cards and the chart.

## Context

Phase 4 opens the seas in the order south, west, north, east (0147). The west is the fire biome (0137): a volcano, ash, black ground. Guillaume's brief (2026-10-24): "be creative with the islands, they represent their biome. Do the volcano, I'd love lava rivers and some ground black with red fractures glowing a bit red at night like the lava. And black rocks and some black beaches if it looks good. Iceland is the main inspiration. Everything is data. Editors must be able to do everything. Lava river can be a variation of normal river." The art bible (0165) sets the shared mechanisms, the rivers are 0176, the grounds 0168, the ash haze 0169, and the storyteller's brief names the people: Ines's brother Oskar Calder, and Bram Kettle the glassworker.

## Decision

1. **The sea** (`src/data/seas/west.json`, added to `grown.json`):
   - **Emberhold** is the main port, level 3, with no maxLevel like the other main ports. It wants obsidian and timber, buys bread, planks and cut stone, and crafts obsidian mirrors from level 3.
   - **The Smoulder** is the volcano, a scenery landmark. It has a crater, lava rivers, lava fields and dark moss.
   - **The Organ Pipes** is a basalt-column islet with a lighthouse.
   - **Cinder Isle** is the outpost site. It rises after `emberhold-glass` (`after:` tags, 0166), starts at level 1 and has maxLevel 3.
   - **Hazards:** the black Forge Reef has one gateway, the Forge Gap. The Pumice Bank is a sandbank in pale grey.
   - **Winds and currents:** an `ash` wind zone (Ashfall Reach) and a warm current (Warm Run).
   - **Charts:** three chart areas.
2. **The story** is three quests, each approved by the storyteller:
   - `calda-letter`: Ines gives Oskar's chart, after `outpost-south`.
   - `emberhold-glass`: Bram's kiln wants cut stone. Then sail round the Smoulder, then timber for the furnace.
   - `outpost-west`: land supplies on Cinder Isle, then carry Oskar there. This founds Cinder Isle.

   Bram and Oskar are new people in `characters.json`, with babble voices in `audio.json`. Every card is in English and French.
3. **The look** follows Iceland, all as data:
   - Two styles, `fire` and `volcano` (the volcano style has a black-sand beach).
   - New grounds: `basalt`, `lavafield` (glowing cracks), `volcanic` (a cone with a pumice cap), `blacksand`, `moss` and `moss-dark`.
   - A peak may have a **`crater`**: an open top with a glowing pool. `hasVolcano` counts such an island as a landmark in the map checks.
   - A ground may have **`specks`**: a colour for a few flat dark lava-rock stones on its tops, at most 36 per surface.
   - New props: glassworks, iron house, turf house, tin shed, turf wall, greenhouse, basalt columns, sea stack, steam vent, sulphur patch, hot spring, birch woodland.
4. **Lava has its own material.** It is marked `molten()` in the model and drawn with one extra material per island that has lava. This covers lava rivers, crater pools and lava cracks. By day it is tinted orange (`LAVA_BY_DAY`), and at night it glows at full strength. On the art director's notes this replaces 0176's "lit-window material" (dull red by day looked like rust). It costs one draw call on islands with lava, and nothing on the others.
5. **Rivers have a width per point.** A river point can be `[x, z, width]`, and the river's own `width` fills in the points that don't have one. You can set it in the builder (the river's point panel, *Point N width*), with `npm run island -- <id> widen <river> --point n --width w|none`, or as the `widen` step. The checks want a width above 0.
6. **Sandbanks take a `look.color`.** You can set it with the sea editor's *Colour* field or `npm run sea -- set sandbank <id> --color #rrggbb`. `npm run sea` also gains `--produces`, `--wants` and `--wants-made` for port goods.
7. **Tools:**
   - `npm run island` prints the island's triangles at level 4.
   - `npm run shots` has `--builder id[:tab[:shape[:point]]]`, which opens the island builder on a shape. `--look` now jumps the camera instead of easing.
   - The slope ramp's foot ignores mountains (`flatLayout`). This fixes a spike beside peaks.
8. **Eruptions** (a smoke plume, eruptions with a Settings switch, a story eruption as a quest reward) are built in their own thread, "Build volcano smoke and eruptions". Here the volcano is still.

## Consequences

- The west sea is playable on `?map=phase4` after the south. Everything in it is data in sea, island, prop, quest and palette files, and you can edit all of it in the map editor, the island builder, the quest builder and the CLI tools.
- **Balance:** the balance bots still sail the ring only (0152), and they pass on all three levels. The planner gives a leg from Calda to Emberhold of about 50 s and from Emberhold to Cinder Isle of about 43 s. The quest rewards (300 to 600 gold a step) are placeholders for the Phase 4 balance pass, as in the south.
- **Tablet:** Emberhold has 5853 triangles at level 4, under the 6000 prop budget and like Sunreach. Lava adds one material on the two lava islands, and the specks are merged into the terrain mesh. The ash zone uses the existing haze. A `?bench` run on the old tablet is still recommended with the grown sea.
- If the north's `saltmere-letter` merges first, it has to start after `outpost-west`.
