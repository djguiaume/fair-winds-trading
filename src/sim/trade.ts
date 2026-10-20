import { type ContractState, createContracts, stepContracts } from './contracts';
import { leakFactor } from './hazards';
import { GOODS, type GoodAmounts, type GoodId, emptyAmounts, totalAmount } from './goods';
import type { MapDef, PortDef } from './map';
import { type Market, available, createMarket, quoteBuy, quoteSell, stepMarket } from './market';
import { distance } from './math';
import { createRng } from './rng';
import { SHIP_CLASSES, type ShipClass } from './ship';
import {
  type UpgradeLevels,
  type UpgradeTrack,
  effectiveShip,
  holdCapacity,
  hullDurability,
  stockLevels,
  upgradePrice,
} from './upgrades';

/**
 * Phase 1 trading (decision 0015): the captain's gold, ships and cargo, every port's market, and
 * which port the boat is docked at. Plain data so it saves as JSON; no rendering, no DOM.
 */

/** Gold at the start of a new game: enough for a first hold of cheap goods. */
export const START_GOLD = 150;
/** Dock when within this distance of a port island's shore… */
export const DOCK_RANGE = 14;
/** …and slower than this (knots). Lower the sails near a port to dock. */
export const DOCK_SPEED_KN = 1.5;
/** Leave the port once this much farther than DOCK_RANGE (avoids flicker at the edge). */
export const UNDOCK_MARGIN = 6;

export interface Captain {
  gold: number;
  /** Class id of the ship being sailed. */
  activeShip: string;
  /** Owned ship classes and their upgrade levels (one active ship in Phase 1). */
  ships: Record<string, UpgradeLevels>;
  cargo: GoodAmounts;
  /** Hull points lost to reef strikes, per owned ship class (decision 0032). */
  hullDamage: Record<string, number>;
}

export interface TradeState {
  captain: Captain;
  markets: Record<string, Market>;
  /** Port id the boat is docked at, or null at sea. */
  dockedAt: string | null;
  /** Delivery orders posted by the ports (decision 0028). */
  contracts: ContractState;
}

export type TradeError =
  | 'not-docked'
  | 'bad-quantity'
  | 'not-enough-gold'
  | 'hold-full'
  | 'out-of-stock'
  | 'not-in-hold'
  | 'max-level'
  | 'already-owned'
  | 'not-owned'
  | 'unknown-ship'
  | 'cargo-too-big';

export type TradeResult = { ok: true; gold: number } | { ok: false; error: TradeError };

const fail = (error: TradeError): TradeResult => ({ ok: false, error });

export function createTradeState(map: MapDef, startShip: ShipClass): TradeState {
  const rng = createRng(map.seed ^ 0x7ade);
  const markets: Record<string, Market> = {};
  for (const port of map.ports) markets[port.id] = createMarket(port, rng);
  return {
    captain: {
      gold: START_GOLD,
      activeShip: startShip.id,
      ships: { [startShip.id]: stockLevels() },
      cargo: emptyAmounts(),
      hullDamage: {},
    },
    markets,
    dockedAt: null,
    contracts: createContracts(map),
  };
}

/** What the boat simulation should sail: the active class with its upgrades. */
export function activeShip(trade: TradeState): ShipClass {
  const { captain } = trade;
  const base = SHIP_CLASSES[captain.activeShip]!;
  const ship = effectiveShip(base, captain.ships[captain.activeShip] ?? stockLevels());
  // A damaged hull leaks and sails slower until repaired (decision 0032).
  const damage = captain.hullDamage[captain.activeShip] ?? 0;
  if (damage <= 0) return ship;
  const durability = hullDurability(captain.ships[captain.activeShip] ?? stockLevels());
  return {
    ...ship,
    speedRatio: ship.speedRatio * leakFactor(Math.max(0, 1 - damage / durability)),
  };
}

export function capacity(trade: TradeState): number {
  const { captain } = trade;
  return holdCapacity(SHIP_CLASSES[captain.activeShip]!, captain.ships[captain.activeShip]!);
}

export function cargoUsed(trade: TradeState): number {
  return totalAmount(trade.captain.cargo);
}

export function freeSpace(trade: TradeState): number {
  return capacity(trade) - cargoUsed(trade);
}

export function findPort(map: MapDef, portId: string): PortDef | undefined {
  return map.ports.find((p) => p.id === portId);
}

/** Distance from the boat to the shore of the port's island (negative = overlapping). */
export function distanceToPort(map: MapDef, pos: { x: number; y: number }, port: PortDef) {
  const island = map.islands.find((i) => i.id === port.islandId);
  if (!island) return Infinity;
  return distance(pos, island) - island.radius;
}

/** The nearest port within docking range of `pos`, if any. */
export function portInRange(map: MapDef, pos: { x: number; y: number }, range = DOCK_RANGE) {
  let best: PortDef | null = null;
  let bestD = range;
  for (const port of map.ports) {
    const d = distanceToPort(map, pos, port);
    if (d <= bestD) {
      best = port;
      bestD = d;
    }
  }
  return best;
}

/** Explicit and automatic docking share the same range/speed validation. */
export function tryDock(
  trade: TradeState,
  map: MapDef,
  boat: { x: number; y: number; speedKn: number },
  portId: string,
): boolean {
  const port = findPort(map, portId);
  if (!port || boat.speedKn >= DOCK_SPEED_KN || distanceToPort(map, boat, port) > DOCK_RANGE)
    return false;
  if (trade.dockedAt && trade.dockedAt !== portId) return false;
  trade.dockedAt = portId;
  return true;
}

export type DockEvent = { type: 'docked'; portId: string } | { type: 'undocked'; portId: string };

/**
 * Advance markets and docking by `dt`. Docking happens when the boat is close to a port and
 * slow; it ends when the boat sails away.
 */
export function stepTrade(
  trade: TradeState,
  map: MapDef,
  boat: { x: number; y: number; speedKn: number },
  dt: number,
): DockEvent[] {
  for (const market of Object.values(trade.markets)) stepMarket(market, dt);
  stepContracts(trade.contracts, dt);
  const events: DockEvent[] = [];
  if (trade.dockedAt) {
    const port = findPort(map, trade.dockedAt);
    if (!port || distanceToPort(map, boat, port) > DOCK_RANGE + UNDOCK_MARGIN) {
      events.push({ type: 'undocked', portId: trade.dockedAt });
      trade.dockedAt = null;
    }
  }
  if (!trade.dockedAt && boat.speedKn < DOCK_SPEED_KN) {
    const port = portInRange(map, boat);
    if (port && tryDock(trade, map, boat, port.id)) {
      events.push({ type: 'docked', portId: port.id });
    }
  }
  return events;
}

function dockedMarket(trade: TradeState): Market | null {
  return trade.dockedAt ? (trade.markets[trade.dockedAt] ?? null) : null;
}

/** Most units of `good` the captain can buy here now (stock, hold space and gold). */
export function maxBuy(trade: TradeState, good: GoodId): number {
  const market = dockedMarket(trade);
  if (!market) return 0;
  let n = Math.min(available(market, good), freeSpace(trade));
  while (n > 0 && quoteBuy(market, good, n) > trade.captain.gold) n--;
  return n;
}

/** Buy `qty` units at the docked port. All or nothing; `gold` is the amount paid. */
export function buy(trade: TradeState, good: GoodId, qty: number): TradeResult {
  const market = dockedMarket(trade);
  if (!market) return fail('not-docked');
  if (!Number.isInteger(qty) || qty <= 0) return fail('bad-quantity');
  if (qty > available(market, good)) return fail('out-of-stock');
  if (qty > freeSpace(trade)) return fail('hold-full');
  const cost = quoteBuy(market, good, qty);
  if (cost > trade.captain.gold) return fail('not-enough-gold');
  trade.captain.gold -= cost;
  trade.captain.cargo[good] += qty;
  market.stock[good] -= qty;
  return { ok: true, gold: cost };
}

/** Sell `qty` units from the hold at the docked port; `gold` is the amount received. */
export function sell(trade: TradeState, good: GoodId, qty: number): TradeResult {
  const market = dockedMarket(trade);
  if (!market) return fail('not-docked');
  if (!Number.isInteger(qty) || qty <= 0) return fail('bad-quantity');
  if (qty > trade.captain.cargo[good]) return fail('not-in-hold');
  const income = quoteSell(market, good, qty);
  trade.captain.gold += income;
  trade.captain.cargo[good] -= qty;
  market.stock[good] += qty;
  return { ok: true, gold: income };
}

/** Sell everything in the hold at the docked port. */
export function sellAll(trade: TradeState): TradeResult {
  if (!dockedMarket(trade)) return fail('not-docked');
  let gold = 0;
  for (const g of GOODS) {
    const qty = trade.captain.cargo[g];
    if (qty > 0) {
      const r = sell(trade, g, qty);
      if (r.ok) gold += r.gold;
    }
  }
  return { ok: true, gold };
}

/** Raise one upgrade track of the active ship by a level (shipyard, docked only). */
export function buyUpgrade(trade: TradeState, track: UpgradeTrack): TradeResult {
  if (!trade.dockedAt) return fail('not-docked');
  const { captain } = trade;
  const base = SHIP_CLASSES[captain.activeShip]!;
  const levels = captain.ships[captain.activeShip]!;
  const price = upgradePrice(base, levels, track);
  if (price === null) return fail('max-level');
  if (price > captain.gold) return fail('not-enough-gold');
  captain.gold -= price;
  levels[track] += 1;
  return { ok: true, gold: price };
}

/** Buy a new ship class and sail it from now on (cargo moves across if it fits). */
export function buyShip(trade: TradeState, classId: string): TradeResult {
  if (!trade.dockedAt) return fail('not-docked');
  const cls = SHIP_CLASSES[classId];
  if (!cls) return fail('unknown-ship');
  const { captain } = trade;
  if (captain.ships[classId]) return fail('already-owned');
  if (cls.price > captain.gold) return fail('not-enough-gold');
  if (cargoUsed(trade) > holdCapacity(cls, stockLevels())) return fail('cargo-too-big');
  captain.gold -= cls.price;
  captain.ships[classId] = stockLevels();
  captain.activeShip = classId;
  return { ok: true, gold: cls.price };
}

/** Switch to another owned ship at a port (the cargo moves across, so it must fit). */
export function switchShip(trade: TradeState, classId: string): TradeResult {
  if (!trade.dockedAt) return fail('not-docked');
  const cls = SHIP_CLASSES[classId];
  const levels = trade.captain.ships[classId];
  if (!cls || !levels) return fail('not-owned');
  if (cargoUsed(trade) > holdCapacity(cls, levels)) return fail('cargo-too-big');
  trade.captain.activeShip = classId;
  return { ok: true, gold: 0 };
}
