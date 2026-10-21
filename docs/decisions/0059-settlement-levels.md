# 0059. Settlement levels: towns grow from what you bring

**Status:** Implemented for review, 2026-10-20 (Phase 2 "Living settlements", first part). Guillaume asked that a settlement's level change the goods it needs and the upgrades on offer, and grow the town visually.

## Context

Phase 2 of the [roadmap](../roadmap.md) makes deliveries visibly change the world: towns have a level, meeting their demand levels them up, higher levels unlock new demands, and neglected towns stall. Upgrades are fitted only at the home port ([0030](0030-home-base-upgrades-and-earned-ships.md), [0048](0048-ship-unlocks-home-port-and-yards.md)), and the Phase 1 economy is tuned for 40-minute sessions ([0046](0046-phase-1-economy-tuning.md)). Island visuals for each level are built in parallel by the "Island growth visuals" work (renderer only, [0060] if it needs one).

## Decision

**Four levels, whole steps only.** Every port is a settlement: 1 hamlet, 2 village, 3 town, 4 port town (FR: hameau, village, bourg, ville portuaire). Each port's starting level is map data (`"level"` in the map JSON, default village). On the Windward Ring the four charted ports start as villages and the two hidden shipwright yards, Watchman Key and Abbey Head, as hamlets. Levels only rise, one step at a time, never continuously, so the renderer can rebuild one island on the rare level-up.

**Growth.** Selling a town a good it wants gives 1 growth point per unit; delivering its order gives 1 per unit plus 5. Goods it does not want give nothing. Points to the next level: 40 (to village), 150 (to town), 350 (to port town).

**Stall, not shrink.** After 3 minutes without any wanted goods a town stalls: its growth toward the next level drains at 2 points a minute, down to the start of its level. A level once reached is never lost, so no island ever shrinks.

**Needs change with level.**
- *New wants:* each port lists goods it starts wanting at a level (`"levelWants": { "3": ["grain"] }`). Windward Ring: Calda adds grain at town, Saltmere stone, Westholm timber, Stonehaven fish; the yards add a third and fourth good at village and town.
- *Deeper demand:* a bigger town keeps less stock of what it wants (dearer: 15 / 12 / 10 / 8 by level) and makes more of what it produces (85 / 100 / 115 / 130). The village values are exactly the Phase 1 numbers.
- *Bigger orders:* order sizes scale ×0.8 / ×1 / ×1.25 / ×1.5 by level.

**Upgrades follow the home port's size.** Level 2 upgrades need the home port to be a village (it starts as one, so nothing changes early); the top, level 3 upgrades need it to be a town. To max out a ship you grow your home port. Ship purchases keep the standing rule of [0048](0048-ship-unlocks-home-port-and-yards.md) unchanged.

**Interface for the renderer.** `src/sim/settlement.ts` exports `SettlementLevel` (1 to 4), `settlementLevel(trade, portId)` and `settlementLevels(trade)`; `stepWorld` emits `{ type: 'level-up', portId, level }` the frame a town grows. On load a save may already hold higher levels, so the renderer builds from `settlementLevel()` at startup.

**Minimal UI** (the UI redesign owns the screens): the port screen header shows the town's size and growth ("Village · 40%", "· stalling" when neglected), its wants include the level ones, a gated upgrade reads "Grow Saltmere to Town first", a toast announces a level-up and the harbour signs refresh. Everything in English and French.

**Saves** stay version 1: settlements are an optional field. Older saves start at the map's levels; a saved level never drops below the map's starting level.

## Consequences

- Simulated on the Windward Ring (tests/economy-balance.test.ts), all Phase 1 targets still hold. A sharp captain grows a first town at about 30 to 36 minutes, and the cutter's level 3 upgrades now wait for Saltmere to become a town (bought about a minute after it does). A relaxed captain does not reach a town in a first session.
- Port town (level 4) only deepens demand and orders for now. It is reserved for the next Phase 2 steps: new processed goods (timber to planks, grain to bread) made in towns, and goods only made on distant islands. Those add goods to every list, so they come with the UI redesign's goods layout.
- Unmet demand stalls growth; it does not yet lower prices or production. Dynamic weather is separate Phase 2 work.
- Screenshots: [docs/screenshots/settlements](../screenshots/settlements/) (`node docs/screenshots/settlements/capture.cjs`).
