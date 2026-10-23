# Trade economy

How buying, selling, docking, upgrades and saving work in Fair Winds Trading, and which numbers to change to tune them. Code: `src/sim/` (pure TypeScript, no three.js or DOM, tested in `tests/economy.test.ts`). Decision: [0015](decisions/0015-trade-economy.md).

## Ports and goods

Each port has one main production ([0029](decisions/0029-one-main-production-per-port.md)). The map layout itself is still being reworked; see [0018](decisions/0018-map-proposals-and-unlocks.md) and the [map proposals](maps/phase1-proposals.md).

| Port | Island | Makes | Wants |
|---|---|---|---|
| Port Calda | calda | timber | fish, stone |
| Saltmere | saltmere | fish | timber, grain |
| Westholm | westholm | grain | stone, fish |
| Stonehaven | south-cay | stone | grain, timber |

Ports live in the map data (`src/data/phase1-map.json` for trading) under `ports`; any island can host one. Every port trades every good: its role only sets where the stock settles. A port can list ship classes it `builds` and start `hidden` until discovered ([0048](decisions/0048-ship-unlocks-home-port-and-yards.md)); the map's `homePort` is where upgrades and ship changes happen.

Each port is also a settlement with a level ([0059](decisions/0059-settlement-levels.md), `src/sim/settlement.ts`): `level` (start, default 2 = village) and `levelWants` (goods it starts wanting at a level) in the map data. Selling wanted goods and delivering orders grow it; a town keeps less stock of its wants and more of its product, posts bigger orders, and at the home port unlocks level 3 upgrades. A town also opens a workshop (`levelProduces`) making a specialized good, which ports listing it in `wantsMade` start buying ([0063](decisions/0063-specialized-town-goods.md)); specialties trade only where made or wanted (`trades()` in `market.ts`). The far yards make rare goods once they are villages (honey at Abbey Head, lamp oil at Watchman Key), bought across the map through `wantsMade`; a town needs `RARE_FOR_PORT_TOWN` (20) units of its rare good before it can become a port town ([0065](decisions/0065-rare-goods-from-the-far-yards.md)).

## Cargo overboard

Being pressed too hard for 3 s under full sail (a gale or a storm; never the breeze, rain or a tack, [0074](decisions/0074-forgiving-cargo-overboard.md)), or a hard gust while already pressed, sends one unit of the good the hold carries most of over the side: ease the sails in a gale or a storm ([0067](decisions/0067-weather-states-and-storms.md)). Nothing is lost alongside. The balance simulation sails in fixed winds and ignores weather.

## Prices

`src/sim/market.ts`. Each port holds a stock of each good.

- **Mid price** = `basePrice × (referenceStock / stock) ^ elasticity`, clamped to `floor`…`ceiling` × base (`economy.json` › `market`).
- **Buy** = mid × (1 + `spread`), rounded up. **Sell** = mid × (1 − `spread`), rounded down. The spread is set by the difficulty level (6 % on Captain).
- Each unit is priced after the previous one moved the stock, so large orders slide.
- Stocks drift back to their **equilibrium** (by role) with time constant `recoverySeconds`.

Typical prices with the current numbers (gold per unit, first unit):

| Good | Base | Buy where made | Sell where wanted | Buy / sell elsewhere |
|---|---|---|---|---|
| Fish | 8 | 4 | 14 | 9 / 7 |
| Grain | 10 | 5 | 18 | 11 / 9 |
| Timber | 14 | 6 | 25 | 16 / 12 |
| Stone | 18 | 8 | 33 | 20 / 16 |

## Delivery contracts

`src/sim/contracts.ts`, decision [0028](decisions/0028-delivery-contracts.md). Each port has one order for a good it wants: 4–8 units while the hold is small, then up to 60 % of the hold of the ship sailed when the order is posted ([0046](decisions/0046-phase-1-economy-tuning.md)); reward = units × base price × (1.5 + haul / 700), rounded to 5, where haul is the distance from the nearest other port making the good. Deliver while docked (all units at once); the goods leave the hold without changing the market. The port posts its next order 90 s later. Typical first orders on the Windward Ring: 7 stone to Port Calda for 310 gold, 7 grain to Saltmere for 165.

**Help orders** ([0069](decisions/0069-help-orders.md)): one order at a time becomes a help order. It is posted by the home port while an upgrade waits on its level, otherwise by the discovered town that has stalled the longest. It pays `helpRewardFactor` (1.5) times the reward and `helpGrowthFactor` (2) times the growth. It stays a help order until delivered, and the next one waits `helpCooldown` (240 s).

## Tuning knobs

Every number lives in `src/data/tuning/` ([0094](decisions/0094-tuning-moved-to-data.md)); the sim reads it live from `TUNING`, and `src/data/tuning-meta.ts` says what each one does, its range and unit.

| Knob | File › path | Value | Raise it to… |
|---|---|---|---|
| `basePrice` per good | `goods.json` | 8 / 10 / 14 / 18 | make a good worth more everywhere |
| `referenceStock` | `economy.json` › `market` | 30 | stock at which a good trades at base price |
| `equilibrium` | `economy.json` › `market` | makes 100, wants 12, neither 30 | widen (makes ↑, wants ↓) the gap between cheap and dear ports |
| `elasticity` | `economy.json` › `market` | 0.8 | make prices react more to stock (bigger margins, faster slide) |
| `spread` | `difficulty.json` › `levels` | 2 / 6 / 11 % | make the port's cut bigger |
| `recoverySeconds` | `economy.json` › `market` | 75 s | make a hammered route stay poor for longer |
| `orderFactor`, `distanceScale` | `difficulty.json` › `levels`, `economy.json` › `orders` | 1.5 on Captain, 700 | make orders pay more (or long hauls pay more) |
| `qty`, `holdShare`, `cooldown` | `economy.json` › `orders` | 4–8, 60 % of hold, 90 s | make orders bigger, or come back sooner |
| `repairCost`, `strikeDamage` | `difficulty.json` › `levels`, `seamanship.json` › `hazards` | 2 gold/pt on Captain, 6 pts/kn | make reef strikes cost more |
| `startGold` | `difficulty.json` › `levels` | 150 on Captain | start richer |
| `dockRange`, `dockSpeedKn` | `seamanship.json` › `harbour` | 16 units, 1.5 kn | make docking easier |
| `effects` | `upgrades.json` | see below | make upgrades stronger |
| `growthToLevel`, `orderGrowthBonus` | `economy.json` › `towns` | 40 / 150 / 350 pts, +5 per order | make towns grow faster |
| `stallSeconds`, `stallDecayPerMinute` | `economy.json` › `towns` | 180 s, 2 pts/min | make neglect hurt more |
| `wantsEquilibrium`, `producesEquilibrium`, `orderScale` | `economy.json` › `towns` | 15/12/10/8, 85/100/115/130, ×0.8–1.5 | make level-ups change the market more |
| `specialtyShare` | `economy.json` › `towns` | 40 % | make workshops stock more specialty goods |
| `homePortLevel` | `upgrades.json` | level 2 upgrades: village, level 3: town | gate upgrades on the home port's size |
| `sailing.hold`, `unlock.price`, `unlock.upgradePrices` | `src/data/ships/<id>.json` | per class | change capacity and costs |

## Balance targets

`tests/economy-balance.test.ts` ([0046](decisions/0046-phase-1-economy-tuning.md)) simulates 40 minutes on the Windward Ring, with leg times from the ship polars over the shifting wind (45–100 s per sloop leg plus 20 s in port). It fails when tuning breaks these targets:

| Milestone | Sharp captain (best load every leg) | Relaxed captain (40 % slower, often 2nd/3rd best load, a crash every 5 legs) |
|---|---|---|
| First upgrade | ≤ 5 min (now 3.7) | ≤ 8 min (now 5.8) |
| Cutter (1 500) | 9–16 min (now 12.7); ≤ 25 min without orders (now 18.9) | ≤ 32 min (now 18.2) |
| Cutter fully upgraded | ≥ 25 min (now 34) | |
| Delivery orders' share of income | 30–65 % (now 55 %) | |
| Repairs | | under 10 % of income (now 5 %) |

No single route may take more than 30 % of the sharp captain's legs, so wind shifts and orders keep sending you to different ports. Run `npx vitest run tests/economy-balance.test.ts --silent=false` to see the purchase timeline.

## Ships and upgrades

Ship lines from [0035](decisions/0035-three-ship-lines.md); where they are built and what unlocks them from [0048](decisions/0048-ship-unlocks-home-port-and-yards.md). Upgrades and switching ships happen only at the home port (Saltmere).

| | Sloop | Cutter | Schooner | Clipper | Hoy | Fluyt | Indiaman |
|---|---|---|---|---|---|---|---|
| Line · tier | starter | swift 1 | swift 2 | swift 3 | hauler 1 | hauler 2 | hauler 3 |
| Built at | starter | Saltmere (home) | Watchman Key | Watchman Key | Abbey Head | Abbey Head | Abbey Head |
| Orders delivered there to unlock | – | 0 | 3 | 6 | 1 | 3 | 6 |
| Price | starter | 1 500 | 5 000 | 20 000 | 1 800 | 7 000 | 25 000 |
| Hold (stock) | 10 | 16 | 30 | 50 | 25 | 60 | 120 |
| No-go zone | 45° | 40° | 38° | 40° | 50° | 55° | 55° |
| Top speed, 14 kn breeze ([0075](decisions/0075-ship-speed-in-knots.md)) | 8.7 kn | 9.2 kn | 10.9 kn | 12.6 kn | 7.4 kn | 7.0 kn | 7.4 kn |
| Upgrade price (L2 / L3, each track) | 300 / 900 | 500 / 1 800 | 1 500 / 4 500 | 5 000 / 15 000 | 700 / 2 100 | 2 000 / 6 000 | 6 000 / 18 000 |

Hold upgrades multiply the stock hold by 1.6 and 2.2 (sloop 10 / 16 / 22, cutter 16 / 26 / 35).

| Track | Level 2 | Level 3 |
|---|---|---|
| Sails | speed ×1.08, accel ×1.15 | speed ×1.16, accel ×1.3 |
| Hold | capacity ×1.6 | capacity ×2.2 |
| Hull | speed ×1.02, durability 150 | speed ×1.04, durability 220 |

`effectiveShip(class, levels)` returns the class with upgrades applied; `world.ship` always holds it, so the sailing model ([sailing-model.md](sailing-model.md)) needs no changes.

## Using it from UI code

All functions take `world.trade` and work only while docked (`world.trade.dockedAt`):

- `buy(trade, good, qty)`, `sell(trade, good, qty)`, `sellAll(trade)`: all or nothing; return `{ ok: true, gold }` or `{ ok: false, error }`.
- `maxBuy(trade, good)`, `quoteBuy(market, good, qty)`, `quoteSell(market, good, qty)`, `unitBuyPrice` / `unitSellPrice`: for showing prices before trading.
- `buyUpgrade(trade, map, track)`, `upgradePrice(class, levels, track)`, `buyShip(trade, map, 'cutter')`, `switchShip(trade, map, id)`: upgrades and switching at the home port, ships at their yard.
- `shipOffers(trade, map)`, `shipOffer(trade, map, id)`, `homePort(map)`, `discoveredPorts(map, trade)` (`src/sim/shipyards.ts`): what each class needs, and which ports are on the chart.
- `repairHull(trade)`, `repairPrice(trade)`, `hullCondition(trade)`: hull repair after reef strikes ([0032](decisions/0032-reef-strikes-and-shallows.md)).
- `deliverContract(trade, map)`, `openContracts(trade.contracts)`: delivery orders.
- `stepWorld` returns `{ type: 'docked' | 'undocked' | 'discovered', portId }` events.

In the browser, open the game with `?debug` and use `fwt.trade.buy(fwt.world.trade, 'stone', 5)` and friends from the console; `fwt.newGame()` wipes the save.

## Saving

`src/sim/save.ts`. `saveGame(storage, world)` / `loadGame(storage, world)` with any Storage-like object. Key `fwt.save.v1`, versioned with `SAVE_VERSION`; a save from another version or map, or with impossible values, is ignored. `main.ts` saves every 15 s of play, on docking and when the page is hidden.

## Difficulty levels (decision 0083)

The numbers above are the **Captain** level. Fair winds and Old salt scale them from `src/sim/difficulty.ts`: start gold 250 / 150 / 100, the port's cut 2 / 6 / 11 %, order reward factor 2.0 / 1.5 / 1.25, repairs 1 / 2 / 3 gold per hull point, crash damage × 0.5 / 1 / 1.5, growth needed × 0.75 / 1 / 1.25, cargo lost per lurch 0 / 1 / 2. Pace per level: `tests/difficulty-balance.test.ts` and [the difficulty review](reviews/difficulty/README.md).
