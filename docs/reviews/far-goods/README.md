# Far goods for the biomes (Phase 4 economy pass)

**Status:** Proposal, round 2, 2026-10-24 (main ports and prices reworked with the head storyteller after Guillaume's feedback). Docs and data proposal only, no code. The last preparation step from [0137](../../decisions/0137-phase-4-biomes-and-founded-outposts.md). The answers to the questions at the end will become an ADR.

**Read for this pass:** [0065](../../decisions/0065-rare-goods-from-the-far-yards.md) (rare goods, port town gate), [0063](../../decisions/0063-specialized-town-goods.md) (specialties), [0059](../../decisions/0059-settlement-levels.md) (town levels), [0046](../../decisions/0046-phase-1-economy-tuning.md) (economy targets), [0137](../../decisions/0137-phase-4-biomes-and-founded-outposts.md) and its [layout review](../phase-4-map/README.md), [0140](../../decisions/0140-wind-zones-and-currents.md) (wind zones and currents), `src/data/tuning/goods.json`, `economy.json` and the ring's ports in `src/data/phase1-map.json`. The code was checked with graphify (`graphify update .`, then `graphify query` on the rare goods and market code).

![Far goods routes](far-goods-routes.png)

## What exists today

- Ten goods: four raw (fish 8, grain 10, timber 14, stone 18), four town specialties (20 to 40) and two rare goods, honey 55 and lamp oil 50 ([0065](../../decisions/0065-rare-goods-from-the-far-yards.md)).
- The far yards make the rare goods once they are villages. Each is wanted by the two charted ports on the far side of the ring. A town that buys a rare good becomes a port town (level 4) only after receiving 20 units of it.
- Level 4 is the top level. Its only effects are bigger orders (×1.5) and a bigger market. Nothing is wanted only by port towns yet.
- 0065 promised a second, rarer set, wanted only by port towns. 0137 moved it to the four biomes: each biome's founded outpost makes one.


## Proposal

The loop in one line: **carry home goods out, carry the far good back.** No new everyday goods; only the four far goods are new.

### The four far goods, in the order the seas open

Names, order and openers from the head storyteller. All four open after the ring arcs, each through someone the player already knows, so every ring arc leads outward. The price climbs with the order, so each new sea pays more than the last.

| Opens | Biome | Far good (EN / FR) | Base price | Opened by | Ships that suit it |
|---|---|---|---|---|---|
| 1st | South, tropical | Spice / Épices | 90 | Old Ness's chart (Watchman Key) | Schooner, hoy, fluyt (the shallows block deep ships) |
| 2nd | West, fire | Obsidian / Obsidienne | 100 | Ines's contact (Port Calda) | Clipper, fluyt |
| 3rd | North, ice | Cloudberry jam / Confiture de mûres arctiques | 110 | Kit's contact (Saltmere) | Clipper, indiaman |
| 4th | East, fog and storm | Amber / Ambre | 120 | Maren's contact (Westholm) | Indiaman |

The three later seas each open with a small "letter from a relative" quest, which the storyteller writes into the brief's Phase 4 section.

### Where each far good comes from

- **The biome's main port gathers a little of it.** Its islanders already collect their biome's good, so the very first visit shows what the place is about and pays. It keeps a small stock, like a town workshop's specialty (40 % share), so it costs about its base price there and the price climbs fast if you buy a lot.
- **The outpost you found makes much more of it, cheaper.** Once the outpost is a village it makes the good like the far yards make honey (70 % share), at about half its base price. That is the story of founding it: your own island makes the good in quantity.
- **Main ports make no ring goods.** They buy them: honey or lamp oil from the far side of the ring, the ring's specialties, and what their outpost needs to grow (timber, planks, stone, food). Founding goods come from the ring.

| Biome | Main port buys (rare) | Outpost needs to grow |
|---|---|---|
| Tropical | Honey (Abbey Head) | Grain, timber; then planks and stone |
| Fire | Lamp oil (Watchman Key) | Fish, timber; then planks and bread |
| Ice | Lamp oil (Watchman Key) | Grain, timber; then planks and cut stone |
| Fog and storm | Honey (Abbey Head) | Fish, stone; then planks and smoked fish |

### Who buys far goods

- **Only port towns (level 4) on the ring.** Each far good has two buyers on the far side of the ring, and each ring town buys two far goods once it is a port town:

  | Far good | Bought by |
  |---|---|
  | Spice | Port Calda, Westholm |
  | Obsidian | Port Calda, Saltmere |
  | Cloudberry jam | Saltmere, Stonehaven |
  | Amber | Westholm, Stonehaven |

- What the player gets for growing a town to level 4: it starts buying two far goods, the best-paying trade in the game. Today level 4 brings only bigger orders.
- Far goods add no level 5 and do not count toward the honey and lamp oil gate (20 units to become a port town, 0065).
- Outposts stop at level 3. Delivery orders use today's formula, which already pays more for long hauls.
- The shared toast line (`toast.rareGood`) already fits all four goods in English and French.

## What the player earns

`src/estimate.test.ts` times each leg with the balance simulation's own leg model (`legSeconds`) on the ring plus the placeholder sites of the [layout review](../phase-4-map/README.md), and prices the load with the market formula (seller a village, buyer a port town, Captain's cut). It ignores currents, wind zones and hazards, so it is a first check, not a balance target. Maxed cutter, gold earned on one leg:

| Run | Load | Leg | Earned |
|---|---|---|---|
| Honey today, Abbey Head to Saltmere | 30 | 60 s | 811 |
| Honey out, Abbey Head to the tropical main port | 30 | 90 s | 668 |
| **First trip:** spice from the tropical main port to Port Calda | 20 | 103 s | 690 |
| First trip: obsidian, main port to Saltmere | 20 | 83 s | 770 |
| First trip: cloudberry jam, main port to Saltmere | 20 | 77 s | 845 |
| First trip: amber, main port to Westholm | 20 | 86 s | 923 |
| **Own outpost:** spice to Port Calda | 30 | 100 s | 1,640 |
| Own outpost: obsidian to Saltmere | 30 | 108 s | 1,825 |
| Own outpost: cloudberry jam to Saltmere | 30 | 98 s | 2,011 |
| Own outpost: amber to Westholm | 30 | 103 s | 2,191 |

So the first trip to a new sea earns about what a honey run does, plus the honey or lamp oil you carried out. Founding the outpost roughly doubles it. Buying more than about 20 at a main port loses money, because its small stock gets dear; nothing else limits it.

### The whole price ladder

| Stage (0046, 0048, 0065) | Goods and prices | One good load earns | Ships bought at this stage |
|---|---|---|---|
| First hour, the ring | Raw 8 to 18, specialties 20 to 40 | about 100 to 400 | Sloop upgrades 300 / 900, cutter 1,500, hoy 1,800 |
| Far yards found | Honey 55, lamp oil 50 | about 800 | Schooner 5,000, fluyt 7,000 |
| After the ring arcs, first sea (south) | Spice 90 | 700 first trip, 1,640 own outpost | Upgrades 1,500 to 6,000 |
| Later seas (west, north, east) | Obsidian 100, cloudberry jam 110, amber 120 | 770 to 920, then 1,800 to 2,200 | Clipper 20,000, indiaman 25,000, upgrades up to 18,000 |

Each step roughly doubles a load's value, the same jump that honey made over the ring goods. The 40-minute targets of 0046 are untouched: far goods only exist after the ring arcs. Phase 4 balance targets go into `balance-targets.json` once the real 5x map is authored, checked with the `?tune` panel's balance check (0114).

## Data proposal

Nothing is added to the game yet: the goods would appear in markets before their islands exist. When Phase 4 is built:

- `src/data/tuning/goods.json` gets four entries of a new kind `far` (so they never count toward the 0065 gate):

  ```json
  "spice": { "id": "spice", "name": "Spice", "kind": "far", "basePrice": 90, "icon": "🌶️" },
  "obsidian": { "id": "obsidian", "name": "Obsidian", "kind": "far", "basePrice": 100, "icon": "🪨" },
  "cloudberryJam": { "id": "cloudberryJam", "name": "Cloudberry jam", "kind": "far", "basePrice": 110, "icon": "🫙" },
  "amber": { "id": "amber", "name": "Amber", "kind": "far", "basePrice": 120, "icon": "🟠" }
  ```

- `economy.json` › `towns`: `farMainShare: 0.4` (main port stock) and `farOutpostShare: 0.7` (outpost stock), next to `specialtyShare` and `rareShare`.
- Map ports: each main port gets its far good in `produces` and honey or lamp oil plus the ring specialties in `wantsMade`; each outpost gets `levelProduces: { "2": [<far good>] }`; each ring port gets a new `levelWantsMade: { "4": [...] }` for its two far goods.
- `src/i18n`: `good.spice`, `good.obsidian`, `good.cloudberryJam`, `good.amber` in English and French, with the storyteller's names.

## Question for Guillaume

Is this shape OK? Far goods are gathered a little at each biome's main port and made in quantity at the outpost you found. Only the ring's port towns buy them, and the prices climb with the order the seas open: spice 90, obsidian 100, cloudberry jam 110, amber 120. The head storyteller agrees with the order and the openers.

Image: `node docs/reviews/far-goods/src/make.cjs` (writes the SVG and, with Playwright, the PNG).
