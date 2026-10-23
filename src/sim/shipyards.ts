import { TUNING } from '../data/tuning';
import type { MapDef, PortDef } from './map';
import { homeEffect } from './home';
import { distance } from './math';
import { SHIP_CLASSES, type ShipClass } from './ship';
import type { TradeState } from './trade';

/**
 * Home port, discovery and shipwrights (decisions 0030, 0035, 0048). Upgrades and changing ships
 * happen only at the home port. Each class is built at one port: the cutter at home, the rest of
 * the swift and hauler lines at distant yards that start off the chart. Sailing near a yard
 * discovers it; delivering its orders earns standing, and enough standing puts a class on sale.
 * Plain data, saved with the voyage.
 */

export interface ShipyardProgress {
  /** Port ids on the chart: the map's open ports from the start, hidden ones once found. */
  discovered: string[];
  /** Orders delivered per port id: a shipwright's trust in the captain. */
  standing: Record<string, number>;
}

/** The home port: the map's choice, else the port nearest the start. */
export function homePort(map: MapDef): PortDef {
  const named = map.ports.find((p) => p.id === map.homePort);
  if (named) return named;
  let best = map.ports[0]!;
  let bestD = Infinity;
  for (const port of map.ports) {
    const island = map.islands.find((i) => i.id === port.islandId);
    const d = island ? distance(island, map.start) : Infinity;
    if (d < bestD) {
      best = port;
      bestD = d;
    }
  }
  return best;
}

/**
 * The port whose shipwright builds `classId`: the port that lists it in `builds`. A class no
 * port lists is built at the home port if it needs no standing (so the cutter is always on
 * offer, the Phase 1 goal); otherwise this map has no yard for it. The starter is never sold.
 */
export function yardOf(map: MapDef, classId: string): PortDef | null {
  const cls = SHIP_CLASSES[classId];
  if (!cls || cls.line === 'starter') return null;
  const yard = map.ports.find((p) => p.builds?.includes(classId));
  if (yard) return yard;
  return cls.standing === 0 ? homePort(map) : null;
}

export function createProgress(map: MapDef): ShipyardProgress {
  return { discovered: map.ports.filter((p) => !p.hidden).map((p) => p.id), standing: {} };
}

export function isDiscovered(trade: TradeState, portId: string): boolean {
  return trade.progress.discovered.includes(portId);
}

/** Ports on the chart, in map order. */
export function discoveredPorts(map: MapDef, trade: TradeState): PortDef[] {
  return map.ports.filter((p) => isDiscovered(trade, p.id));
}

/** Put hidden ports near `pos` on the chart. Returns the ones found just now. */
export function discoverNear(
  trade: TradeState,
  map: MapDef,
  pos: { x: number; y: number },
): PortDef[] {
  const found: PortDef[] = [];
  for (const port of map.ports) {
    if (isDiscovered(trade, port.id)) continue;
    const island = map.islands.find((i) => i.id === port.islandId);
    // The lookout sees farther (decision 0124).
    const range = TUNING.economy.discoverRange * homeEffect(trade.home, 'discoverRange');
    if (island && distance(pos, island) - island.radius <= range) {
      trade.progress.discovered.push(port.id);
      found.push(port);
    }
  }
  return found;
}

/** One more order delivered at `portId`. */
export function addStanding(trade: TradeState, portId: string): void {
  trade.progress.standing[portId] = (trade.progress.standing[portId] ?? 0) + 1;
}

export function standingAt(trade: TradeState, portId: string): number {
  return trade.progress.standing[portId] ?? 0;
}

export type OfferStatus =
  /** In the fleet already. */
  | 'owned'
  /** The shipwright will sell it (gold and cargo still checked when buying). */
  | 'for-sale'
  /** Its yard is not on the chart yet. */
  | 'undiscovered'
  /** More deliveries needed at its yard. */
  | 'needs-standing'
  /** No yard builds it on this map. */
  | 'no-yard';

export interface ShipOffer {
  cls: ShipClass;
  status: OfferStatus;
  /** Where it is built, when that port is known to the captain. */
  yard: PortDef | null;
  /** Deliveries still needed at the yard (0 when unlocked). */
  ordersLeft: number;
}

/** What the captain knows about getting `classId`. */
export function shipOffer(trade: TradeState, map: MapDef, classId: string): ShipOffer {
  const cls = SHIP_CLASSES[classId]!;
  const yard = yardOf(map, classId);
  const known = yard && isDiscovered(trade, yard.id) ? yard : null;
  const ordersLeft = yard ? Math.max(0, cls.standing - standingAt(trade, yard.id)) : 0;
  const status: OfferStatus = trade.captain.ships[classId]
    ? 'owned'
    : !yard
      ? 'no-yard'
      : !known
        ? 'undiscovered'
        : ordersLeft > 0
          ? 'needs-standing'
          : 'for-sale';
  return { cls, status, yard: known, ordersLeft };
}

/** Every class but the starter, in shipyard order. */
export function shipOffers(trade: TradeState, map: MapDef): ShipOffer[] {
  return Object.keys(SHIP_CLASSES)
    .filter((id) => SHIP_CLASSES[id]!.line !== 'starter')
    .map((id) => shipOffer(trade, map, id));
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Read saved progress against the current map. Older saves (none saved) start with the map's
 * open ports; unknown port ids are dropped, and open ports are always on the chart.
 */
export function readProgress(raw: unknown, map: MapDef): ShipyardProgress {
  const fresh = createProgress(map);
  if (typeof raw !== 'object' || raw === null) return fresh;
  const r = raw as { discovered?: unknown; standing?: unknown };
  if (Array.isArray(r.discovered)) {
    for (const port of map.ports)
      if (r.discovered.includes(port.id) && !fresh.discovered.includes(port.id))
        fresh.discovered.push(port.id);
  }
  if (typeof r.standing === 'object' && r.standing !== null) {
    const saved = r.standing as Record<string, unknown>;
    for (const port of map.ports) {
      const n = saved[port.id];
      if (isNum(n) && Number.isInteger(n) && n > 0) fresh.standing[port.id] = n;
    }
  }
  return fresh;
}
