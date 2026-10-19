# 0027. Islands shape the wind: calm lee, faster flanks

**Status:** Implementation for review, 2026-10-19. Guillaume asked whether high islands should calm the wind behind them and speed it up along their sides; both are implemented.

**Context:** With one wind for the whole sea, islands were only obstacles. Real high islands cast a wind shadow downwind and squeeze the flow around their ends and through gaps between them. This makes "the wind is the terrain" literal and gives route choices near land.

**Decision:**

- **Lee shadow.** From the boat, three short rays look upwind (straight and ±10°) for up to 70 units. Land hit close behind takes up to 55 % of the wind away; the effect fades to nothing at 70 units. Small rocks shelter less than full islands (height from radius, a little more for scenic cliff tiers); flat sandbanks do not block wind.
- **Flank funnel.** Rays at 60° and 90° each side detect land within 28 units. Land on one side speeds the wind up by up to 10 %, land on both sides (a channel) by up to 20 %. The boost fades inside the lee, so it acts along the edges of the shadow.
- Applied in `stepWorld`: `world.seaWind` is the open-sea wind, `world.wind` the local wind the boat sails in, plus `world.shelter` and `world.funnel` (0..1). The renderer, compass, HUD and tutorial read `world.wind` unchanged, so the readout drops in the lee; the wind text adds "· lee" when sheltered so a sudden slowdown reads as the island and not a bug.
- Derived from existing island circles and `terrain` outlines, with no new map data, so it follows whatever layout the map rework lands. Direction is not bent; only strength changes.
- Cost: a few hundred point-in-shape checks per frame at most, with a bounding-circle early-out; no rendering changes.

**Consequences:** Hugging the downwind side of an island is slow; rounding its tip or threading a channel is quick. Sailing into a lee to dock stays possible (wind never drops below 45 %). Later ideas, not done: bending the wind around headlands, showing calm water or thinner wind streaks in the lee, and per-island heights once islands have real elevation data.

**Validation:** `tests/wind.test.ts`: shelter right behind, fading with distance, none upwind or in open sea, sandbanks ignored, flank boost beside an island, stronger in a channel and capped at +20 %, and an in-world check behind Port Calda.
