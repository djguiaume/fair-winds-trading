# Trade economy

How buying, selling, docking, upgrades and saving work in Fair Winds Trading, and which numbers to change to tune them. Code: `src/sim/` (pure TypeScript, no three.js or DOM, tested in `tests/economy.test.ts`). Decision: [0015](decisions/0015-trade-economy.md).

## Ports and goods

**Design status:** These are the current prototype assignments, not approved final port roles or map layout. Guillaume confirmed both remain open; see [0018](decisions/0018-map-proposals-and-unlocks.md) and the [map proposals](maps/phase1-proposals.md).

| Port | Island | Makes | Wants |
|---|---|---|---|
| Port Calda | calda | timber | fish, stone |
| Saltmere | saltmere | fish | timber, grain |
| Westholm | westholm | grain | stone, fish |
| Stonehaven | south-cay | stone | grain, timber |

Ports live in the map data (`src/data/phase1-map.json` for trading) under `ports`; any island can host one. Every port trades every good: its role only sets where the stock settles.

## Prices

`src/sim/market.ts`. Each port holds a stock of each good.

- **Mid price** = `basePrice × (REFERENCE_STOCK / stock) ^ PRICE_ELASTICITY`, clamped to `PRICE_FLOOR`…`PRICE_CEILING` × base.
- **Buy** = mid × (1 + `SPREAD`), rounded up. **Sell** = mid × (1 − `SPREAD`), rounded down.
- Each unit is priced after the previous one moved the stock, so large orders slide.
- Stocks drift back to their **equilibrium** (by role) with time constant `RECOVERY_SECONDS`.

Typical prices with the current numbers (gold per unit, first unit):

| Good | Base | Buy where made | Sell where wanted | Buy / sell elsewhere |
|---|---|---|---|---|
| Fish | 8 | 4 | 12 | 9 / 7 |
| Grain | 10 | 5 | 15 | 12 / 8 |
| Timber | 14 | 6 | 21 | 16 / 12 |
| Stone | 18 | 8 | 27 | 20 / 16 |

## Tuning knobs

| Knob | File | Value | Raise it to… |
|---|---|---|---|
| `basePrice` per good | `goods.ts` | 8 / 10 / 14 / 18 | make a good worth more everywhere |
| `REFERENCE_STOCK` | `market.ts` | 30 | stock at which a good trades at base price |
| `EQUILIBRIUM` | `market.ts` | makes 100, wants 15, neither 30 | widen (makes ↑, wants ↓) the gap between cheap and dear ports |
| `PRICE_ELASTICITY` | `market.ts` | 0.8 | make prices react more to stock (bigger margins, faster slide) |
| `SPREAD` | `market.ts` | 8 % | make the port's cut bigger |
| `RECOVERY_SECONDS` | `market.ts` | 75 s | make a hammered route stay poor for longer |
| `START_GOLD` | `trade.ts` | 120 | start richer |
| `DOCK_RANGE`, `DOCK_SPEED_KN` | `trade.ts` | 14 units, 1.5 kn | make docking easier |
| `UPGRADE_EFFECTS` | `upgrades.ts` | see below | make upgrades stronger |
| `hold`, `price`, `upgradePrices` | `ship.ts` | per class | change capacity and costs |

The balance test in `tests/economy.test.ts` (stone one way, timber back, 60 s per leg) fails if the first upgrade takes more than 6 legs or the cutter takes fewer than 8 or more than 18, which catches tuning that makes the game too slow or too easy.

## Ships and upgrades

| | Sloop | Cutter |
|---|---|---|
| Price | starter | 1 500 |
| Hold (stock / L2 / L3) | 10 / 16 / 22 | 16 / 26 / 35 |
| No-go zone | 45° | 40° |
| Upgrade price (L2 / L3, each track) | 400 / 1 200 | 600 / 1 800 |

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
- `buyUpgrade(trade, track)`, `upgradePrice(class, levels, track)`, `buyShip(trade, 'cutter')`, `switchShip(trade, id)`.
- `stepWorld` returns `{ type: 'docked' | 'undocked', portId }` events.

In the browser, open the game with `?debug` and use `fwt.trade.buy(fwt.world.trade, 'stone', 5)` and friends from the console; `fwt.newGame()` wipes the save.

## Saving

`src/sim/save.ts`. `saveGame(storage, world)` / `loadGame(storage, world)` with any Storage-like object. Key `fwt.save.v1`, versioned with `SAVE_VERSION`; a save from another version or map, or with impossible values, is ignored. `main.ts` saves every 15 s of play, on docking and when the page is hidden.
