# 0015. Phase 1 trade economy: stock-driven prices, docking by slowing down, upgrades as multipliers

**Status:** Accepted, 2026-10-19 (numbers are starting values to tune in play)

**Context:** Phase 1 of the [roadmap](../roadmap.md) needs a trading loop: ports with goods, prices driven by supply and demand, a cargo hold, gold, docking, the sloop's three upgrade tracks and the cutter ([0011](0011-ship-lineup-and-upgrades.md)), and auto-save with instant resume ([0009](0009-sandbox-short-sessions.md)). The map must stay data with seeded randomness ([0008](0008-static-map-seed-ready.md)), and the simulation must stay free of rendering and DOM code ([0005](0005-tech-stack.md)). The trade panel and port labels are UI work for later; this decision covers the rules underneath.

**Decision:**

| Topic | Choice |
|---|---|
| Goods | Four bulk goods: fish (base 8 gold), grain (10), timber (14), stone (18). Cloth from the roadmap draft became stone, which reads better for growing towns. |
| Ports | Four ports in the map data, each producing one good and wanting two: Port Calda (makes timber; wants fish, stone), Saltmere (fish; timber, grain), Westholm (grain; stone, fish), Stonehaven on the south cay (stone; grain, timber). Every port trades all four goods; roles only move prices. |
| Prices | Each port keeps a stock per good. Mid price = base × (30 / stock)^0.8, held between 0.35× and 3× base. You buy 8 % above mid and sell 8 % below, in whole gold, and every unit moves the stock, so a big order gets dearer (or cheaper) as it goes and buying then selling back at the same port always loses. |
| Supply and demand over time | Stocks ease back toward an equilibrium set by the role (makes it: 100, wants it: 15, neither: 30) with a 75 s time constant. Dumping a full hold on one town drops its price for a while, which pushes you to vary routes. Starting stocks get a ±15 % seeded jitter. |
| Gold and hold | Start with 120 gold and an empty hold. Capacity = ship hold × hold upgrade (sloop 10, cutter 16). Trades are all or nothing; `maxBuy` tells the UI the largest order that will go through. |
| Docking | You dock when the boat is within 14 units of a port island's shore and slower than 1.5 kn (lower the sails near the town). You undock by sailing more than 20 units away. Trading, upgrades and ship purchases only work while docked. |
| Upgrades | Three tracks, levels 1 to 3, as multipliers on the ship class. Sails: speed ×1.08 / ×1.16 and acceleration ×1.15 / ×1.3. Hold: capacity ×1.6 / ×2.2. Hull: speed ×1.02 / ×1.04 and durability 100 / 150 / 220 (stored now, used once reefs, storms and pirates can hurt the hull). Prices per [0011](0011-ship-lineup-and-upgrades.md): sloop 400 then 1 200 per track, cutter 600 then 1 800. |
| Cutter | 1 500 gold. No-go zone 40° instead of 45° (points higher), 6 % more top speed, hold 16, a slightly heavier helm. Buying it makes it the active ship; you keep the sloop and can switch back at any port if the cargo fits. One active ship until the fleet arrives in Phase 3. |
| Save | Gold, owned ships and upgrades, cargo, market stocks, the dock, the boat's position and heading, and the clock are saved as versioned JSON (`fwt.save.v1` in localStorage) every 15 s of play, on docking and when the page is hidden. On load the save is validated against the current map and rules; anything damaged or from another version is ignored and a new game starts. The boat resumes at rest. |
| Code shape | Pure modules in `src/sim/` (`goods`, `market`, `upgrades`, `trade`, `save`), wired into `World` as `world.trade`; `stepWorld` steps markets and docking and reports `docked` / `undocked` events. Until the trade panel exists, the game shows a "Docked at …" toast and `?debug` exposes the trade functions in the console. |

**Consequences:**

- Balance is checked by a test: shuttling stone from Stonehaven to Port Calda and timber back, with 60 s per leg, buys the first upgrade within about 3 legs and the cutter after about 15 legs (it must stay between 8 and 18 legs). Real legs on this map are shorter, so a 15-minute session should afford both.
- Every number lives at the top of `src/sim/market.ts`, `src/sim/upgrades.ts`, `src/sim/goods.ts` and `src/sim/ship.ts`; [economy.md](../economy.md) lists them and what changing each one does.
- The trade panel, shipyard screen and port labels (UI thread) only need to call `buy`, `sell`, `maxBuy`, `quoteBuy`/`quoteSell`, `buyUpgrade`, `buyShip` and `switchShip`, and read `world.trade`.
- Upgrade levels are in the save and the trade state, so the boat models can show them (sails, hold, hull parts) without new sim work. Stonehaven now has a dock and houses in the map data; the island models may want to face that dock toward open water.
- Delivery contracts, slowly shifting wind, hull damage and reefs are still open Phase 1 items and build on this state.
