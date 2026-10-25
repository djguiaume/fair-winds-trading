import { TUNING } from '../data/tuning';
import { openContracts } from './contracts';
import { GOODS, type GoodId } from './goods';
import type { MapDef } from './map';
import { available, quoteBuy, quoteSell, takeStock, trades } from './market';
import { discoveredPorts } from './shipyards';
import { type TradeState, cargoUsed, findPort, freeSpace } from './trade';
import { distance } from './math';

/*
 * A load on credit (decision 0200). Every sale starts with a purchase, so a captain with no gold
 * and an empty hold could earn nothing: she was stuck. Then the harbour office of the port she is
 * in lends her a load for another port's order, and she pays back what it cost when she sells it
 * there. No interest and no deadline, one loan at a time. And before an upgrade, a ship or a
 * repair leaves her short of the cheapest load, the game asks first.
 */

/** Units in "a load": the smallest a captain buys to start trading again. */
const loadUnits = () => TUNING.economy.credit.loadUnits;

/**
 * Gold for the cheapest load in the docked port: `loadUnits` of its cheapest good in stock (as
 * many as are left, if fewer). 0 when the port sells nothing, so nothing there needs warning.
 */
export function cheapestLoad(trade: TradeState): number {
  const market = trade.dockedAt ? trade.markets[trade.dockedAt] : undefined;
  if (!market) return 0;
  let best = Infinity;
  for (const g of GOODS) {
    const n = Math.min(loadUnits(), available(market, g));
    if (n > 0 && trades(market, g)) best = Math.min(best, quoteBuy(market, g, n));
  }
  return Number.isFinite(best) ? best : 0;
}

/**
 * Would spending `gold` here leave her stuck: an empty hold, and less than the cheapest load
 * left? Then the port screen asks before it spends (decision 0200).
 */
export function leavesShort(trade: TradeState, gold: number): boolean {
  if (!(gold > 0) || cargoUsed(trade) > 0) return false;
  const left = trade.captain.gold - gold;
  return left < cheapestLoad(trade);
}

export interface CreditOffer {
  /** The port whose order the load is for, where she pays back. */
  port: string;
  good: GoodId;
  qty: number;
  /** What the load costs here, paid back there. */
  price: number;
}

/**
 * The load the docked port's harbour office would lend her now, or null: only while she cannot
 * buy the cheapest load, her hold is empty and she owes nothing. The load is for an open order at a
 * charted port, for a good this port sells, that pays more than the load costs here: the order
 * that gains most for the distance. Its size is the order's, or what the hold and stock allow.
 */
export function creditOffer(map: MapDef, trade: TradeState): CreditOffer | null {
  const here = trade.dockedAt ? findPort(map, trade.dockedAt) : undefined;
  const market = here ? trade.markets[here.id] : undefined;
  if (!here || !market || trade.captain.loan || cargoUsed(trade) > 0) return null;
  const load = cheapestLoad(trade);
  if (!load || trade.captain.gold >= load) return null;
  const from = map.islands.find((i) => i.id === here.islandId);
  const charted = new Set(discoveredPorts(map, trade).map((p) => p.id));
  let best: (CreditOffer & { score: number }) | null = null;
  for (const c of openContracts(trade.contracts)) {
    const there = trade.markets[c.portId];
    if (c.portId === here.id || !there || !charted.has(c.portId) || !trades(market, c.good))
      continue;
    const qty = Math.min(c.qty, freeSpace(trade), available(market, c.good));
    if (qty <= 0) continue;
    const price = quoteBuy(market, c.good, qty);
    // What the load earns there: the order's reward, or the market's price for a smaller load.
    const earns =
      qty === c.qty ? c.reward : trades(there, c.good) ? quoteSell(there, c.good, qty) : 0;
    if (earns <= price) continue;
    const to = map.islands.find((i) => i.id === findPort(map, c.portId)?.islandId);
    const far = from && to ? distance(from, to) : Infinity;
    // The best gain for the sail, so a short hop beats a long haul that pays a little more.
    const score = (earns - price) / (far + TUNING.economy.credit.sailBias);
    if (!best || score > best.score) best = { port: c.portId, good: c.good, qty, price, score };
  }
  if (!best) return null;
  return { port: best.port, good: best.good, qty: best.qty, price: best.price };
}

/** She takes the load: it goes in her hold, and she owes its price at the order's port. */
export function takeCredit(map: MapDef, trade: TradeState): CreditOffer | null {
  const offer = creditOffer(map, trade);
  const market = offer && trade.markets[trade.dockedAt!];
  if (!offer || !market) return null;
  takeStock(market, offer.good, offer.qty);
  trade.captain.cargo[offer.good] += offer.qty;
  trade.captain.loan = {
    port: offer.port,
    good: offer.good,
    qty: offer.qty,
    owed: offer.price,
  };
  return offer;
}
