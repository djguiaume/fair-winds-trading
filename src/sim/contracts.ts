import { GOOD_DEFS, type GoodId, isGood } from './goods';
import type { MapDef, PortDef } from './map';
import { distance } from './math';
import { createRng } from './rng';
import {
  ORDER_GROWTH_BONUS,
  ORDER_SCALE,
  type SettlementState,
  addGrowth,
  createSettlements,
  madeGoods,
  portProduces,
  portWants,
  settlementLevel,
  startLevel,
  wantsAt,
} from './settlement';
import { addStanding } from './shipyards';
import { type TradeState, capacity } from './trade';

/**
 * Delivery contracts (decision 0028): every port posts one order for a good it wants, paying a
 * premium over the market. Delivering it while docked there pays the reward; the port posts its
 * next order after a short pause. Plain data, saved with the voyage.
 */

/** Smallest and largest order for a stock sloop (hold 10); bigger holds get bigger orders. */
export const CONTRACT_QTY: [number, number] = [4, 8];
/** Largest order as a share of the hold of the ship sailed when the order is posted (decision 0046). */
export const CONTRACT_HOLD_SHARE = 0.6;
/** Reward per unit as a multiple of the good's base price (a sale where wanted is about ×1.5 before the price slides). */
export const CONTRACT_PRICE_FACTOR = 1.5;
/** Long hauls pay more: the price factor rises by 1 per this many units from the nearest maker. */
export const CONTRACT_DISTANCE_SCALE = 700;
/** Seconds before a port posts its next order after one is delivered. */
export const CONTRACT_COOLDOWN = 90;

export interface Contract {
  /** Port that wants the goods (deliver there). */
  portId: string;
  good: GoodId;
  qty: number;
  reward: number;
  /** Seconds until the order is posted; 0 = open now. */
  readyIn: number;
}

export interface ContractState {
  /** One order per port, keyed by port id. */
  byPort: Record<string, Contract>;
  /** Orders delivered this voyage (feeds settlement growth in Phase 2). */
  completed: number;
}

function islandOf(map: MapDef, port: PortDef) {
  return map.islands.find((i) => i.id === port.islandId);
}

/** Distance from the nearest port that makes `good` to `port` (0 if none or unknown). */
export function haulDistance(map: MapDef, port: PortDef, good: GoodId): number {
  const to = islandOf(map, port);
  if (!to) return 0;
  let best = Infinity;
  for (const p of map.ports) {
    const from = islandOf(map, p);
    // A workshop counts as a maker whatever its town's level today (decision 0063).
    if (p.id !== port.id && from && portProduces(p, 4).includes(good))
      best = Math.min(best, distance(from, to));
  }
  return Number.isFinite(best) ? best : 0;
}

export function contractReward(map: MapDef, port: PortDef, good: GoodId, qty: number): number {
  const factor = CONTRACT_PRICE_FACTOR + haulDistance(map, port, good) / CONTRACT_DISTANCE_SCALE;
  const perUnit = GOOD_DEFS[good].basePrice * factor;
  return Math.round((perUnit * qty) / 5) * 5;
}

/**
 * Order size range for a captain whose hold is `hold`: 4–8 up to a hold of about 13, then the top
 * grows with the hold (60 %) and the bottom stays half the top, so orders keep up with bigger ships.
 */
export function contractQtyRange(hold = 0, level = 2): [number, number] {
  const [lo, hi] = CONTRACT_QTY;
  // Bigger towns order more, smaller ones less (decision 0059); a village is the 0046 tuning.
  const scale = ORDER_SCALE[Math.min(Math.max(Math.round(level), 1), ORDER_SCALE.length) - 1]!;
  const top = Math.max(Math.round(hi * scale), Math.round(hold * CONTRACT_HOLD_SHARE * scale));
  return [Math.max(Math.round(lo * scale), Math.round(top / 2)), top];
}

/**
 * The `n`-th order a port posts. Deterministic from the map seed, port, count, the hold of the
 * ship sailed when it is posted and the town's level (what it wants and how much, decision 0059).
 */
export function makeContract(
  map: MapDef,
  port: PortDef,
  n: number,
  readyIn = 0,
  hold = 0,
  level: number = startLevel(port),
  made: ReadonlySet<GoodId> = new Set(),
): Contract {
  let h = map.seed ^ 0xc0de;
  for (const ch of port.id) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  const rng = createRng((h ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0);
  const wanted = portWants(port, level, made);
  const wants = wanted.length > 0 ? wanted : (['fish'] as GoodId[]);
  const good = wants[Math.floor(rng() * wants.length)]!;
  const [lo, hi] = contractQtyRange(hold, level);
  const qty = lo + Math.floor(rng() * (hi - lo + 1));
  return { portId: port.id, good, qty, reward: contractReward(map, port, good, qty), readyIn };
}

export function createContracts(map: MapDef): ContractState {
  const byPort: Record<string, Contract> = {};
  for (const port of map.ports) byPort[port.id] = makeContract(map, port, 0);
  return { byPort, completed: 0 };
}

export function stepContracts(state: ContractState, dt: number): void {
  for (const c of Object.values(state.byPort))
    if (c.readyIn > 0) c.readyIn = Math.max(0, c.readyIn - dt);
}

/** Orders open now, nearest-first is up to the caller. */
export function openContracts(state: ContractState): Contract[] {
  return Object.values(state.byPort).filter((c) => c.readyIn <= 0);
}

export type DeliverError = 'not-docked' | 'no-contract' | 'not-enough-cargo';
export type DeliverResult = { ok: true; gold: number } | { ok: false; error: DeliverError };

/** Hand over the docked port's order from the hold. All or nothing. */
export function deliverContract(trade: TradeState, map: MapDef): DeliverResult {
  const portId = trade.dockedAt;
  const port = portId ? map.ports.find((p) => p.id === portId) : undefined;
  if (!portId || !port) return { ok: false, error: 'not-docked' };
  const c = trade.contracts.byPort[portId];
  if (!c || c.readyIn > 0) return { ok: false, error: 'no-contract' };
  if (trade.captain.cargo[c.good] < c.qty) return { ok: false, error: 'not-enough-cargo' };
  trade.captain.cargo[c.good] -= c.qty;
  trade.captain.gold += c.reward;
  trade.contracts.completed += 1;
  addStanding(trade, portId);
  addGrowth(trade, portId, c.qty + ORDER_GROWTH_BONUS);
  trade.contracts.byPort[portId] = makeContract(
    map,
    port,
    trade.contracts.completed,
    CONTRACT_COOLDOWN,
    capacity(trade),
    settlementLevel(trade, portId),
    madeGoods(map, trade),
  );
  return { ok: true, gold: c.reward };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Read saved contracts against the current map. Ports without a valid saved order get a fresh
 * one, so older saves (no contracts) and changed maps both load. Pass the settlements so an
 * order for a good the town only wants at a higher level stays valid.
 */
export function readContracts(
  raw: unknown,
  map: MapDef,
  settlements?: SettlementState,
): ContractState {
  const fresh = createContracts(map);
  if (typeof raw !== 'object' || raw === null) return fresh;
  const r = raw as { byPort?: unknown; completed?: unknown };
  const completed =
    isNum(r.completed) && Number.isInteger(r.completed) && r.completed >= 0 ? r.completed : 0;
  const saved =
    typeof r.byPort === 'object' && r.byPort !== null ? (r.byPort as Record<string, unknown>) : {};
  for (const port of map.ports) {
    const c = saved[port.id] as Partial<Contract> | undefined;
    if (
      c &&
      isGood(c.good) &&
      wantsAt(map, { settlements: settlements ?? createSettlements(map) }, port.id).includes(
        c.good,
      ) &&
      isNum(c.qty) &&
      Number.isInteger(c.qty) &&
      c.qty > 0 &&
      isNum(c.reward) &&
      c.reward >= 0 &&
      isNum(c.readyIn) &&
      c.readyIn >= 0
    ) {
      fresh.byPort[port.id] = {
        portId: port.id,
        good: c.good,
        qty: c.qty,
        reward: c.reward,
        readyIn: Math.min(c.readyIn, CONTRACT_COOLDOWN),
      };
    }
  }
  return { byPort: fresh.byPort, completed };
}
