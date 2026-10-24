# Far goods for the biomes (Phase 4 economy pass)

**Status:** Proposal, 2026-10-24. Docs and data proposal only, no code. The last preparation step from [0137](../../decisions/0137-phase-4-biomes-and-founded-outposts.md). The answers to the questions at the end will become an ADR.

**Read for this pass:** [0065](../../decisions/0065-rare-goods-from-the-far-yards.md) (rare goods, port town gate), [0063](../../decisions/0063-specialized-town-goods.md) (specialties), [0059](../../decisions/0059-settlement-levels.md) (town levels), [0046](../../decisions/0046-phase-1-economy-tuning.md) (economy targets), [0137](../../decisions/0137-phase-4-biomes-and-founded-outposts.md) and its [layout review](../phase-4-map/README.md), [0140](../../decisions/0140-wind-zones-and-currents.md) (wind zones and currents), `src/data/tuning/goods.json`, `economy.json` and the ring's ports in `src/data/phase1-map.json`. The code was checked with graphify (`graphify update .`, then `graphify query` on the rare goods and market code).

![Far goods routes](far-goods-routes.png)

## What exists today

- Ten goods: four raw (fish 8, grain 10, timber 14, stone 18), four town specialties (20 to 40) and two rare goods, honey 55 and lamp oil 50 ([0065](../../decisions/0065-rare-goods-from-the-far-yards.md)).
- The far yards make the rare goods once they are villages. Each is wanted by the two charted ports on the far side of the ring. A town that buys a rare good becomes a port town (level 4) only after receiving 20 units of it.
- Level 4 is the top level. Its only effects are bigger orders (×1.5) and a bigger market. Nothing is wanted only by port towns yet.
- 0065 promised a second, rarer set, wanted only by port towns. 0137 moved it to the four biomes: each biome's founded outpost makes one.

## Proposal

### The four far goods

Names and toast lines from the head storyteller (cozy, no animal products, the weather is the only antagonist).

| Biome | Far good (EN / FR) | Base price | Made at | Bought by (port towns only) |
|---|---|---|---|---|
| South, tropical (opens first) | Spice / Épices | 90 | Tropical outpost, from village | Port Calda, Westholm |
| West, fire | Obsidian / Obsidienne | 100 | Fire outpost, from village | Port Calda, Saltmere |
| North, ice | Cloudberry jam / Confiture de mûres arctiques | 110 | Ice outpost, from village | Saltmere, Stonehaven |
| East, fog and storm | Amber / Ambre | 110 | Fog outpost, from village | Westholm, Stonehaven |

- **Far side rule, as in 0065.** Each good's two buyers sit on the side of the ring away from its biome, so every delivery crosses the ring. Each ring port town buys exactly two far goods, and each good has exactly two buyers.
- **Prices.** Spice is the gentlest, since the south opens first. The ice and fog goods pay most because their seas are the hardest (icebergs, fog, storms). All four sit well above honey (55), roughly in line with a leg that is twice as long.
- **Made like the yards' goods.** The outpost keeps 70 % of a bulk producer's stock (`rareShare`, as for honey), so the good costs about half its base price at the outpost and about 2.5 to 2.9 times its base at a port town.

### Who trades what in each biome

| Biome | Main port makes (bulk) | Main port buys | Outpost wants (founding) |
|---|---|---|---|
| Tropical | timber | honey, plus ring specialties | grain, timber; planks and stone from village |
| Fire | stone | lamp oil, plus ring specialties | fish, timber; planks and bread from village |
| Ice | fish | lamp oil, plus ring specialties | grain, timber; planks and cut stone from village |
| Fog and storm | grain | honey, plus ring specialties | fish, stone; planks and smoked fish from village |

- **The main port feeds its outpost.** Its bulk good is one the outpost needs, a short hop away, so founding does not mean hauling all the timber from the ring.
- **Honey and lamp oil get a second use.** Each main port buys the yard good from the far side of the ring (the tropics buy Abbey Head's honey, the ice port buys Watchman Key's lamp oil, and so on). The outbound voyage carries cargo too, and the far yards keep mattering.
- No new bulk goods. Only the four far goods are new.

### Rules

- **Only port towns buy far goods.** A ring port starts wanting its two far goods at level 4. This is the payoff level 4 was missing: it opens the best-paying trade in the game.
- **No level 5 and no new gate.** Far goods do not count toward the honey and lamp oil gate (20 units to become a port town).
- **Outposts stop at level 3**, like the yards in practice: an outpost is a working settlement, not a ring town.
- **Delivery orders** for far goods follow the existing formula, which already pays more by haul distance ([0028](../../decisions/0028-delivery-contracts.md), [0046](../../decisions/0046-phase-1-economy-tuning.md)).
- **Toast**: the shared `toast.rareGood` line already fits all four in English and French (the French wording avoids gender agreement), so nothing new is needed there.

## Estimate

`src/estimate.test.ts` times each leg with the balance simulation's own leg model (`legSeconds`) on the ring plus the placeholder sites of the [layout review](../phase-4-map/README.md), and prices a 30-unit load with the market formula (outpost a village, buyer a port town, Captain's cut). It ignores currents, wind zones and hazards, so it is a first check, not a balance target.

| Run | Leg (maxed schooner) | Gain, 30 units | Gold per second |
|---|---|---|---|
| Honey today, Abbey Head to Saltmere | 52 s | 811 | 15.7 |
| Lamp oil today, Watchman Key to Port Calda | 57 s | 734 | 12.9 |
| Spice, tropical outpost to Port Calda or Westholm | 85 s | 1,640 | 19.4 |
| Obsidian, fire outpost to Saltmere | 91 s | 1,825 | 20.0 |
| Obsidian, fire outpost to Port Calda | 103 s | 1,825 | 17.8 |
| Cloudberry jam, ice outpost to Saltmere | 87 s | 2,011 | 23.2 |
| Amber, fog outpost to Westholm | 89 s | 2,011 | 22.5 |
| Honey outbound, Abbey Head to tropical port | 78 s | 668 | 8.5 |

A far run pays about twice a honey run per load, and 20 to 50 % more per second of sailing, before counting the way back. The deep haulers (fluyt, indiaman) earn 9 to 21 gold per second on the same runs, and the tropical shallows will block them, which leaves the south to the small swift ships as 0137 intends.

## Data proposal

Nothing is added to the game yet: the goods would appear in markets before their islands exist. When Phase 4 is built:

- `src/data/tuning/goods.json` gets four entries of a new kind `far` (so they never count toward the 0065 gate):

  ```json
  "spice": { "id": "spice", "name": "Spice", "kind": "far", "basePrice": 90, "icon": "🌶️" },
  "obsidian": { "id": "obsidian", "name": "Obsidian", "kind": "far", "basePrice": 100, "icon": "🪨" },
  "cloudberryJam": { "id": "cloudberryJam", "name": "Cloudberry jam", "kind": "far", "basePrice": 110, "icon": "🫙" },
  "amber": { "id": "amber", "name": "Amber", "kind": "far", "basePrice": 110, "icon": "🟠" }
  ```

- Map ports: the ring's port towns get `levelWantsMade: { "4": [...] }` (a new field, the far goods wanted from level 4); each outpost gets `levelProduces: { "2": [<far good>] }`; each main port gets its bulk good in `produces` and honey or lamp oil in `wantsMade`.
- `src/i18n`: `good.spice` and friends in English and French, with the storyteller's names.
- `balance-targets.json`: Phase 4 targets once the real 5x map is authored, checked with the `?tune` panel's balance check (0114).

## Questions for Guillaume

1. **Who buys far goods:** only port towns, from level 4, as 0065 promised (recommended), or any size of town as soon as an outpost makes them, like honey today?
2. **Main ports:** each main port makes one bulk good its outpost needs and buys honey or lamp oil from the far side, so both legs carry cargo (recommended), or main ports trade only today's goods?
3. **Prices:** spice 90, obsidian 100, cloudberry jam 110, amber 110, about twice honey for a leg twice as long (recommended), or keep them closer to honey (70 to 80) so the ring stays competitive?
4. **Anything beyond money for port towns?** Recommended: money only for now. The far goods are the best trade in the game and only a port town opens them. A visible "far market" on the quay or Skerry buildings that use far goods can come later if level 4 still feels flat after play.

Image: `node docs/reviews/far-goods/src/make.cjs` (writes the SVG and, with Playwright, the PNG).
