import { type Contract, openContracts } from '../../sim/contracts';
import type { GoodId } from '../../sim/goods';
import { quoteAcross } from '../../sim/market';
import { discoveredPorts } from '../../sim/shipyards';
import { findPort } from '../../sim/trade';
import type { World } from '../../sim/world';

/**
 * What the harbour panes read about the trade beyond this port: the order posted here, the other
 * ports' orders on the chart, and where a good sells best today.
 */

/** This port's delivery order while it is posted (decision 0028), else null. */
export function liveOrder(world: World): Contract | null {
  const { trade } = world;
  const order = trade.dockedAt ? trade.contracts.byPort[trade.dockedAt] : undefined;
  return order && order.readyIn <= 0 ? order : null;
}

/** Open orders at the other ports on the chart: undiscovered ones stay hidden (decision 0048). */
export function ordersElsewhere(world: World): Contract[] {
  const { trade, map } = world;
  const charted = new Set(discoveredPorts(map, trade).map((p) => p.id));
  return openContracts(trade.contracts).filter(
    (c) => c.portId !== trade.dockedAt && charted.has(c.portId),
  );
}

/** Orders the Orders tab lists, for its badge. */
export function openOrderCount(world: World): number {
  return ordersElsewhere(world).length + (liveOrder(world) ? 1 : 0);
}

/** Where this good sells best among the other charted ports today (decision 0036). */
export function bestSaleElsewhere(
  world: World,
  good: GoodId,
): { name: string; sell: number } | null {
  const { trade, map } = world;
  const others = discoveredPorts(map, trade).filter((p) => p.id !== trade.dockedAt);
  let best: { portId: string; sell: number } | null = null;
  for (const q of quoteAcross(
    trade.markets,
    good,
    others.map((p) => p.id),
  ))
    if (!best || q.sell > best.sell) best = q;
  return best ? { name: findPort(map, best.portId)?.name ?? best.portId, sell: best.sell } : null;
}
