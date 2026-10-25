# 0181. Fill the west sea's open water

**Status:** Proposed (2026-10-25).

## Context

Decision 0180 measured the four outer seas. The west (Emberhold) was the emptiest: 1.5 landmarks
per 100k u², 24% empty water and an empty disc of r247 at 245°, mostly the slice it gained from the
south in decision 0179 (the open gap between the Coral Line and Forge Reef). Guillaume approved the
named fills on 2026-10-25; the head storyteller named them (`plan/sea-density/storyteller-answer.md`
in the project files) and the art director set the kit and budgets (`art-director/sea-density/notes.md`).

## Decision

All pieces are data, placed with `npm run sea` and built with `npm run island`.

- **The Clinkers** (`clinkers-south`, `clinkers-north` in `src/data/seas/west.json`): a basalt
  lava reef at about r515 from 228° to 262°, where it meets Forge Reef's south end, so the old open
  gap is closed.
  - **Bellows Pass**: a buoyed passage about 40 units wide at 242–246° (red on the south side, green
    on the north side, like the Forge Gap and the Keeper's Passage).
  - **The seam at 225°**: about 43 units of open water between the Coral Line's west end and the
    Clinkers, never a mixed reef. The Coral Line's west cardinal stays true (safe water to its west),
    and a new **east cardinal** on the Clinkers' end marks the other side of the channel.
- **Volcano reef style**: `palette.json` › `styles.volcano.colors` gets `reefRock` (dark basalt) and
  an empty `coral` list. The Clinkers and Forge Reef both use it, so the two reefs that now touch
  read as one basalt barrier (Forge Reef was sandstone with coral before).
- **Steam Holm** (r24, 245°): a hot-spring islet: black-sand rim and cove, a weathered-basalt
  band under a moss top, a dark-moss pad, a basalt knoll, a hot spring, one live steam vent,
  sulphur and a cairn. 1,228 triangles. No hut or rack: the storyteller keeps the fills unpeopled.
- **Spark Rock** (r12, 236°): a cinder rock with a lighthouse. 711 triangles.
- **The Chimneys** (r12 + r9, ~291°) and **The Tongs** (r11 + r8, ~311°): basalt stack pairs in
  four tiers, weathered and black basalt bands with moss ledges and a moss cap (557, 459, 459,
  459 triangles; the bands cost more than the 300 a stack was budgeted). The Tongs sit on the west
  side of the 315° corner, about 145 units clear of Cinder Isle's site and outside the Warm Run.
  Name from the head storyteller.
- **Live steam vents**: a prop recipe may have `vent: { y }` (`src/data/props.ts`). The island's
  model lists each one standing at its level as a small plume source for the volcano smoke
  (decision 0178), at `weather.volcano.smoke.ventScale` (0.3 of a full crater's plume, in `?tune`);
  a vent never erupts. The new `vent` prop is a rock mouth with no static puffs. It is placed like
  any prop in the island builder or with `npm run island -- <id> prop vent --at x,z`, so geysers
  and other islands can use it too.
- **Palette**: a new ground `ashrock` (weathered basalt sides with a moss-ledge top) for cliff
  bands; lighthouse colours are now palette names (`lighthouse`, `lighthouseBand`,
  `lighthouseRoof`) with the old colours as defaults, and the volcano style paints them Icelandic
  orange with a white band and a red cap (art bible §9). This repaints the Organ Pipes' lighthouse too.
- **Two Palms** (south, r14, 204°): a small palm islet with two palms, driftwood and a beacon.
- **Sea stacks count as landmarks**: an island whose file has ground at least twice its radius tall
  is a landmark of its own (`isSeaStack`, `src/data/islands.ts`), like a volcano, for the
  "scenery island without a landmark" check.

## Consequences

- West after the fills (`npm run sea -- density`): 3.5 landmarks per 100k u², 3% empty water
  (was 24%), biggest empty disc r155 at 279°. That disc is the west's deliberate open reach: the
  Warm Run current runs through it. The 254° gap (r149) by Ashfall Reach stays open too.
- West quarter budget: 11 new pieces (2 reef shapes, 3 marks, 6 small islands) and about 3,900
  new island triangles, under the 15 pieces / 8,000 triangles cap. Marks stay under a third.
- Routes: Sunreach to Emberhold now passes the 225° channel and sails outside the Clinkers (169 s
  on the chart's planner); the route checks and `npm run balance -- --map phase4` give the same
  results as before on all three levels.
- Every piece sits inside an existing chart area (Forge Gap, Emberhold Waters, Cinder Reach,
  Sunreach Waters), so the fog of war lifts them as before. No quest ties.
