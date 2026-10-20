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

Each port is also a settlement with a level ([0059](decisions/0059-settlement-levels.md), `src/sim/settlement.ts`): `level` (start, default 2 = village) and `levelWants` (goods it starts wanting at a level) in the map data. Selling wanted goods and delivering orders grow it; a town keeps less stock of its wants and more of its product, posts bigger orders, and at the home port unlocks level 3 upgrades.

## Prices

`src/sim/market.ts`. Each port holds a stock of each good.

- **Mid price** = `basePrice × (REFERENCE_STOCK / stock) ^ PRICE_ELASTICITY`, clamped to `PRICE_FLOOR`…`PRICE_CEILING` × base.
- **Buy** = mid × (1 + `SPREAD`), rounded up. **Sell** = mid × (1 − `SPREAD`), rounded down.
- Each unit is priced after the previous one moved the stock, so large orders slide.
- Stocks drift back to their **equilibrium** (by role) with time constant `RECOVERY_SECONDS`.

Typical prices with the current numbers (gold per unit, first unit):

| Good | Base | Buy where made | Sell where wanted | Buy / sell elsewhere |
|---|---|---|---|---|
| Fish | 8 | 4 | 14 | 9 / 7 |
| Grain | 10 | 5 | 18 | 11 / 9 |
| Timber | 14 | 6 | 25 | 16 / 12 |
| Stone | 18 | 8 | 33 | 20 / 16 |

## Delivery contracts

`src/sim/contracts.ts`, decision [0028](decisions/0028-delivery-contracts.md). Each port has one order for a good it wants: 4–8 units while the hold is small, then up to 60 % of the hold of the ship sailed when the order is posted ([0046](decisions/0046-phase-1-economy-tuning.md)); reward = units × base price × (1.5 + haul / 700), rounded to 5, where haul is the distance from the nearest other port making the good. Deliver while docked (all units at once); the goods leave the hold without changing the market. The port posts its next order 90 s later. Typical first orders on the Windward Ring: 7 stone to Port Calda for 310 gold, 7 grain to Saltmere for 165.

## Tuning knobs

| Knob | File | Value | Raise it to… |
|---|---|---|---|
| `basePrice` per good | `goods.ts` | 8 / 10 / 14 / 18 | make a good worth more everywhere |
| `REFERENCE_STOCK` | `market.ts` | 30 | stock at which a good trades at base price |
| `EQUILIBRIUM` | `market.ts` | makes 100, wants 12, neither 30 | widen (makes ↑, wants ↓) the gap between cheap and dear ports |
| `PRICE_ELASTICITY` | `market.ts` | 0.8 | make prices react more to stock (bigger margins, faster slide) |
| `SPREAD` | `market.ts` | 6 % | make the port's cut bigger |
| `RECOVERY_SECONDS` | `market.ts` | 75 s | make a hammered route stay poor for longer |
| `CONTRACT_PRICE_FACTOR`, `CONTRACT_DISTANCE_SCALE` | `contracts.ts` | 1.5, 700 | make orders pay more (or long hauls pay more) |
| `CONTRACT_QTY`, `CONTRACT_HOLD_SHARE`, `CONTRACT_COOLDOWN` | `contracts.ts` | 4–8, 60 % of hold, 90 s | make orders bigger, or come back sooner |
| `REPAIR_COST`, `STRIKE_DAMAGE` | `hazards.ts` | 2 gold/pt, 6 pts/kn | make reef strikes cost more |
| `START_GOLD` | `trade.ts` | 150 | start richer |
| `DOCK_RANGE`, `DOCK_SPEED_KN` | `trade.ts` | 14 units, 1.5 kn | make docking easier |
| `UPGRADE_EFFECTS` | `upgrades.ts` | see below | make upgrades stronger |
| `GROWTH_TO_LEVEL`, `ORDER_GROWTH_BONUS` | `settlement.ts` | 40 / 150 / 350 pts, +5 per order | make towns grow faster |
| `STALL_SECONDS`, `STALL_DECAY_PER_MINUTE` | `settlement.ts` | 180 s, 2 pts/min | make neglect hurt more |
| `WANTS_EQUILIBRIUM`, `PRODUCES_EQUILIBRIUM`, `ORDER_SCALE` | `settlement.ts` | 15/12/10/8, 85/100/115/130, ×0.8–1.5 | make level-ups change the market more |
| `UPGRADE_NEEDS_LEVEL` | `settlement.ts` | level 2 upgrades: village, level 3: town | gate upgrades on the home port's size |
| `hold`, `price`, `upgradePrices` | `ship.ts` | per class | change capacity and costs |

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
| Top speed vs sloop | 100 % | 106 % | 125 % | 145 % | 85 % | 81 % | 85 % |
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
