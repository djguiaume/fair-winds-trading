# 0176. Rivers of water and lava

**Status:** Proposed (2026-10-24).

## Context

Island files had no rivers. Guillaume wants lava rivers on the west sea's volcano ("lava river can be a variation of normal river", 2026-10-24) and the east fog sea wants a waterfall off a cliff, Faroe style. The art bible (0165) asks for one river feature with two kinds, drawn without textures or new passes so the 2 GB tablet stays smooth.

## Decision

1. **Data.** An island file may list `rivers: [{ kind?, points, width, from?, to?, tags? }]`: `kind` is `water` (default, left out) or `lava`; `points` are `[x, z]` in island-radius units, source first, mouth last; `width` in radius units (0.04 by default in the tools); levels and `after:`/`before:` quest tags as on props (0130).
2. **Shape.** The river is a ribbon that lies on the land, sampled along a centripetal curve through its points. It follows raised ground, ramps and slopes as `layoutGround` has them, and a mountain as its exact faceted cone (`peakHeight`, the model's `PEAK_SEGMENTS` sides), so it never floats over a flank. Where it crosses a cliff edge of raised ground (`fallsBetween`) it runs level to the edge and falls as a sheet; it ends where it first reaches the sea or the lake. A mouth high above the water falls into the sea.
3. **Look.** Water uses the lake colour with white falls and a ring of foam where it lands. Lava is a bright core (#ff6a2a) over a dark crust (#4a1c14) and is drawn as *glowing* parts, i.e. with the lit-window material: dull red by day, full glow at night, no extra material or draw call (0165 rule). A few low-poly steam puffs mark where lava meets the sea.
4. **Tools.** The island builder's Lanes tab has **River** and **Lava river** (draw source to mouth; panel: kind, width, levels, tags); `npm run island -- <id> river --points … --kind lava --width …` and `remove river n`; the steps-as-data list has `river`. The island checks need two points, a width, a source on the island, and warn when a river runs uphill; the quest checks know river tags.
5. `npm run shots -- --sea phase4 --island file.json` now plays the island files on the Phase 4 sea (it opened the ring before).

## Consequences

- The west sea's lava rivers and the east sea's waterfall are data in island files, editable in the builder and the CLI.
- Rivers are not water for the boat: they are on land. Collision, the chart and the ocean are unchanged.
- The glow follows the windows' day/night tint; a slow pulse would need its own material and is left out for now.

## Amended (2026-10-25, [0171](0171-the-west-fire-sea-emberhold.md))

- A point may carry its own width, `[x, z, width]`; the river's `width` fills the rest. Builder: the selected river point's *Point N width*; CLI: `npm run island -- <id> widen <river> --point n --width w|none`; step `widen`.
- Lava is drawn with its own material (orange by day, full glow at night), one draw call on islands that have lava, instead of the lit-window material, which looked like rust by day.
