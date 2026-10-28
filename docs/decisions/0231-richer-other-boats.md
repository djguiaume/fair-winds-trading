# 0231. Richer other boats

**Status:** Proposed (2026-10-28). Issue [#331](https://github.com/djguiaume/fair-winds-trading/issues/331), look rules [new-look/boats.md](../reviews/art-direction/new-look/boats.md).

## Context

The other boats of [0215](0215-other-boats-on-the-sea.md) were wedges: 76 triangles (fishing) and 252 (coaster), flat sails, no wake, the same deck on every coaster. v1.2 redraws them in the player's storybook language. Guillaume (2026-10-28): richer boats are the point, the old tablet is not a constraint for now, but the new ceilings (fishing 1,500, coaster 3,500) are ceilings, not targets: keep only what reads.

## Decision

- **Lofted hulls as data.** A prop recipe part `hull` lofts a hull from `src/data/traffic-boats.json › hulls` with the player's `hullGeometry` (curved sheer, keel, gunwale, band on the top strake); `color` paints the topsides, `band` the strake. The fishing boat and coaster have their own outlines and six sections.
- **Bellied sails.** The `sail` code part takes `cells` and `belly`: a panelled cloth filled out like the player's, its panels from the palette list `sailCloth` (rust in the east's fog and strand styles).
- **Detail that reads at game zoom:** deck planks, a stern cabin or deckhouse with lit panes, thwarts, nets and fish boxes, a helmsman, tiller or wheel box, shrouds. No cabin windows or rope detail beyond that.
- **Deck cargo by home good.** The coaster recipe's `cargo` var picks crates and a net (fish), sacks (grain), logs (timber), blocks (stone), bales in the band colour (any other good) or a tarp (none). `traffic-boats.json › cargo` maps goods to it; the home port's first good loads it. Each cargo is its own instanced batch, still one hull draw per batch.
- **Small wakes.** `TrafficWakes` draws a short V of bow waves for every moving boat (and the visitor and the regatta rival) in one draw, sharing the player's foam shader through a new `FoamStrips` base. Its size is `traffic-boats.json › wake`. Foam colours are the palette's `wakeFoam` and `wakeEdge`, so they can follow the new water.
- **Budgets.** The `boats` prop group's budget goes from 900 to 3,500 (it holds only the traffic recipes); a test keeps the fishing boat under 1,500. Today: fishing 792, coaster 1,068 to 1,128 by cargo. Caps on screen are unchanged (Low 3, Medium 6, High 10).

## Consequences

- Up to 10 boats now cost about 11k triangles more than before at High, still a handful of draws (one per kind, look and cargo, one per sail, one for the wakes). Re-measure with `?bench` before the old tablet comes back.
- Boat sizes and the sim are unchanged: no balance effect.
- The hull, wake edge and band colours were checked on today's turquoise only; `wakeEdge` is the one that depends on the water. Retune in the v1.2 colour pass (#277) after #274 and #276.
- Visitors are unchanged (the player's model in a livery, 0215); they gain the small wake.
- Prop recipes have no editor; the traffic boats are edited as JSON and checked by `npm run check` and `tests/prop-files.test.ts`, like every prop since 0135.
