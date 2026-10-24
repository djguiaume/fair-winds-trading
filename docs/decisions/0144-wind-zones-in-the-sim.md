# 0144. Wind zones in the sim

**Status:** Implemented (2026-10-24). Part 1 (PR #136): the sim, its tests and the Settings switch. Part 2 came once the shared base PR of [0140](0140-wind-zones-and-currents.md) (map format, map checks, editor tools, the `zones` block in `weather.json`) merged ([0145](0145-building-currents.md), PR #137).

## Context

[0140](0140-wind-zones-and-currents.md) decided wind zones painted on the map, on top of the wandering wind of [0064](0064-wind-from-every-quarter.md): trade belt, doldrums, stormy coast and cold gale, with their numbers in `weather.json` and a Settings switch. Its update fixed the map format (`windZones`: `id`, `kind`, `headingDeg`, closed `outline`, optional `tune`) and said lookups happen only where a boat asks, through a `SpatialGrid` ([0117](0117-nearby-wind-shelter-and-camera-far.md)). Guillaume asked for three parallel threads: far goods, currents, and wind zones (this one). The currents thread builds the shared base first.

Guillaume also asked, in another thread, for a ring island with a lagoon where "the wind is reduced in the whole middle" and "can only flow E->W or W->E". That needs a fifth kind.

## Decision

1. **`src/sim/windZones.ts`** holds the zone sim. `zoneField(defs, smooth)` builds a grid of the map's zones once per map (none at all for a map without zones). `zoneEffectAt` asks the grid only for the zones whose circle touches the boat, and returns a strength factor, a gust factor and a turn of the direction.
2. **Each zone fades in across its edge** over `fadeUnits` (40): half outside the outline, half inside, with a smoothstep. Overlapping zones both count, each by its weight.
3. **The kinds** (numbers in `weather.json` › `zones.kinds`; any zone can override them with `tune`):
   - `trade-belt`: `pull` 0.7 towards `headingDeg`, `gusts` 0.5.
   - `doldrums`: `strength` wanders in slow puffs between 0.25 and 0.4, and `shiftDeg` 30 swings the direction slowly. On the easiest level (the first in `difficulty.json`, Fair winds) the zones never take the wind below `fairFloor` 0.6.
   - `stormy-coast`: `gusts` 1.5 and `stormBirth` 2. Extra storms are born inside the zone (they form on the spot with the usual ramp, drift across it and die out), so it sees about twice as many as open sea of its size. They are a pure function of the seed and time like the crossing storms, so nothing is saved, and they obey the Weather and Storms switches and the tutorial's hold ([0072](0072-no-storms-in-tutorial-or-events.md)).
   - `cold-gale`: `strength` 1.2, `gusts` 0.8.
   - **`sheltered`** (new, for the lagoon): `strength` 0.55, `gusts` 0.6, `pull` 0.9 with `axis`: the wind is pulled to whichever end of the `headingDeg` axis is nearer, so a lagoon open east and west blows only E→W or W→E. Both the pull and the strength are scaled by |cos| of the angle between the sea wind and the axis, with `acrossFloor` 0.3, so when the sea wind comes round to blow straight across, the lagoon's wind goes nearly calm and the flip from one end to the other never swings suddenly (suggested by the lagoon thread, tested).
4. **`headingDeg` is the bearing the wind blows FROM**, like the map's `wind.fromDeg`.
5. **`windAt`** applies the zone effect after the weather, regions and swing, and before storms. `LocalWeather.zone` says which zone counts most at the boat, for a later HUD line or hint. The weather glass forecast ([0136](0136-warehouse-forecast-and-perks-as-data.md)) uses the same config, so it includes zones.
6. **Settings › Wind zones** (`settings.windZones`, `world.windZones`, on by default), next to Weather and Storms. Turning it on or off eases over `blendSec`, like a change of level. Every story step works with it off (0137).
7. Today's Windward Ring has **no wind zones** (Guillaume, 0140), and a test keeps it so.

## Consequences

- Nothing changes on today's ring: no zones means `zoneField` returns null and `windAt` does no extra work.
- The save does not change.
- Cost: one grid lookup and a point-in-outline test per zone near the boat, per wind sample. The forecast takes five samples, only with a weather glass.
- Until the shared base merges, `zonesTuning()` falls back to the numbers of 0140 and this decision, and `mapZones()` reads `windZones` without the `MapDef` type. Part 2 removes both stand-ins.
- Still to do in part 2 and later: smoothed outlines (`smoothOutline` from the base PR), route and balance checks that sample zone wind, a calm-water look for the doldrums, and the biome zones themselves when the Phase 4 map is authored.

## Part 2 (2026-10-24)

After the shared base (PR #137) merged:

- `WindZoneDef` and `MapDef.windZones` come from `map.ts`, and the numbers come from `weather.json` › `zones`. The stand-ins of part 1 are gone.
- The game sails the **smoothed outline** (`smoothOutline` from `flowShapes.ts`), the same one the editor draws.
- **Route checks** (`sailRoute`, used by the map checks in the editor and the tests) and the **balance check's legs** (`legSeconds`) plan with the zones' **average** wind: no puffs or shifts, and the doldrums at the middle of their range. A leg is cut into stretches of 40 units, each sailed in the wind at its middle. Legs are cached per weather list, and only maps with zones take this path, so today's ring times are unchanged. The route planner's estimate allows for the strongest zone, so it stays optimistic.
- Changing a zone number in the `?tune` panel clears the prepared zones with the other weather caches.
- The biome zones themselves come when the Phase 4 map is authored.

## Part 3 (2026-10-24): calm water

- **`src/render/calmWater.ts`** draws glassy water over zones whose kind has `glassy` (0..1) in `weather.json`: doldrums 0.7, sheltered 0.3. It is a paler, smooth sheet with slow faint swells, fading in across the zone's edge over `fadeUnits` like the wind, and fading near shores.
- It works like the currents' water ([0145](0145-building-currents.md)): one mesh per zone, built at load, riding the ocean's waves, and copying the ocean's colours and fog each frame (day, night, weather). It is hidden when Settings › Wind zones is off.
- A zone can set its own `glassy` with `tune`, including 0 to turn the look off.
- Captures are in [docs/reviews/wind-zones](../reviews/wind-zones/README.md).

