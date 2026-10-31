# 0250. Waves on by default from Medium up, with ocean comfort controls

**Status:** Proposed (2026-10-30). Issue #286, v1.3 wave 4 (the last).

## Context

The Gerstner sea of decisions 0245, 0248 and 0249 was a prototype behind `?waves=v2`. v1.3 ships
it. Its shader costs Low about +23%, Medium +16% and High +14% in headless rendering (#282), and
Low and Ultra-low exist for weak tablets and phones. Guillaume asked (2026-10-30) for an on/off
switch in Settings, off by default on Low and Ultra-low. Moving water can also bother players
prone to motion sickness, and the issue asks for a reduced motion option and a camera bob that
starts off. The boat's response to the waves (#283, #284) is v1.3.1, so this release accepts the
sea, its controls and its budgets.

## Decision

**Settings › Waves**, under the quality buttons. Until the player flips it, it follows the level's
default, `graphics.json › quality.*.waves`: off on Ultra-low and Low, on for Medium, High and
Ultra. Once flipped, the player's choice holds on every level (`settings.waves`, null = follow
the level). Off draws the classic sea: the ocean compiles without `GERSTNER`, so it pays nothing
for the waves, and boats float on the classic sines. The view caches one ocean per level and
waves state, and levels share a material only when both draw the same waves. `?waves=v1|v2` and
the review seas (`?waves=calm|wind|storm`) still override everything for tests and reviews.

**Two comfort switches** under the camera ones, `waves.json › motion`:
- *Gentle sea motion*: the boat keeps `motion.gentle` (35%) of her rise, pitch and knocks. Until
  the player picks, it follows the device's "reduce motion" setting.
- *Camera rides the waves*: off by default; on, the camera rises and sinks by `motion.cameraBob`
  of the sea under the boat, eased by `motion.cameraEase`.
`motion.heave` and `motion.pitch` hold the boat's float, which was two constants in the view.

**What each control changes** (`src/data/oceanControls.ts`, listed by `npm run sea -- waves`):

| Kind | Controls | Changes |
| --- | --- | --- |
| sea | `waves.gravity`, `steepLimit`, `inverseSteps`, `bands.*`, `coast.*` | the wave field everything floats on; the same on every level and frame rate |
| drawing | `waves.drawCells`, `shadeCells`, `foam.*`, `look.*` | how the ocean draws and shades the field |
| comfort | `waves.motion.*`, Settings › Gentle sea motion, Camera rides the waves | how much the boat and camera move on screen |
| level | `graphics.quality.*.waves`, Settings › Waves | whether the waves are drawn |
| review | `waves.previews.*` | the fixed seas of `?waves=calm|wind|storm` |

**None of them changes a sailing rule.** The simulation never reads the waves: speed, course,
grounding, docking, currents, races and their pars are the same with the waves on or off, gentle
or not (`tests/ocean-controls.test.ts` checks that no simulation file imports them). The storm
hazard keeps its own switch (Settings › Storms). From v1.3.1, boats ride the *sea* controls
through the CPU field (`waveHeightAt`, `waveNormalAt`), which the Waves switch does not change:
the boat's response must stay the same whether the waves are drawn or not.

**One tool, one editor.** The `?tune` panel edits every number above (Waves tab, and the levels'
Waves toggle). `npm run sea -- waves [path=value …]` lists them by kind, and sets them through
the panel's own edits (`tuningEdits.ts`), writing the files the panel's Export writes.

**Surf you can see** (Guillaume, 2026-10-31: no visible effect on coasts and beaches). The foam
reaches its roughest earlier (`foam.roughAt` 2.4 → 1.6), the surf where the seabed breaks the swell
is stronger (`surf` 0.5 → 1.2) and keeps more of itself in the lee (`lee` 0.3 → 0.5), and the shore
ring grows wider in a rough sea (`widen` 0.6 → 1). A breeze now breaks the shore foam into surf
and a few whitecaps; a calm sea keeps the classic ring.

## Consequences

- A weak tablet or phone on Low keeps its v1.2 cost unless the player turns the waves on.
- `?perf` and `?bench` reports name the waves' state on the `Switches:` line, so a device readout
  says which sea it measured.
- Benchmarks: [docs/reviews/waves-v13/README.md](../reviews/waves-v13/README.md).
