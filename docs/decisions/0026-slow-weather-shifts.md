# 0026. Slow weather shifts

**Status:** Implementation for review, 2026-10-19. Guillaume asked to go ahead with the recommended Phase 1 work.

**Context:** The roadmap's Phase 1 asks for "wind that shifts slowly over time so the same trip changes". Until now the wind only swung a few degrees around the map's prevailing direction, so a route that was upwind stayed upwind forever.

**Decision:**

- The sea wind moves through **weather periods** of 3 minutes. Each period settles on a direction within ±50° of the map's prevailing wind and a strength between ×0.8 and ×1.15, easing over from the previous period during its first 60 seconds (smoothstep, under ~2.5°/s at worst).
- Periods are derived from the map seed and the period number with the seeded RNG ([0008](0008-static-map-seed-ready.md)), so wind is a pure function of time: a resumed voyage is back in the same weather and no wind state is saved. Period 0 is always the prevailing wind, so a fresh voyage starts in the map's designed breeze.
- The existing gusts and small swing still play on top. The "new wind" button keeps adding its 45° offset.
- Configured by an optional `weather` block on the map's wind (`WeatherConfig` in `src/sim/wind.ts`). The trading map gets `DEFAULT_WEATHER` in `src/data/maps.ts`, so map JSON stays untouched and the map rework can replace it freely. Phase 0 practice waters keep a steady wind for the course test.
- No toast announces a shift; the compass and wind readout show it, in line with the quiet HUD ([0020](0020-quiet-upwind-compass-help.md), [0024](0024-on-demand-chart-and-quiet-sandbox.md)).

**Consequences:** The same trip is a downwind run one time and a beat the next, which makes reading the wind and choosing routes matter more (pillar 1). ±50° is a tuning guess for play-testing; `rangeDeg`, `periodSec` and `blendSec` are the knobs. Regional wind patterns remain Phase 4.

**Validation:** `tests/wind.test.ts`: reproducible from the seed, starts on the prevailing wind, stays within range with real variety, never jumps between frames, Phase 0 stays steady.
