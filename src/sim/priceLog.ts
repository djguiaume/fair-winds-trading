import { TUNING } from '../data/tuning';
import { GOODS, type GoodId } from './goods';
import { quoteBuy, stepMarket, trades } from './market';
import type { TradeState } from './trade';

/**
 * Each port's buy prices at the end of every game day (decision 0276), the last few days only, for
 * the harbour ledger's "Last 7 days" line. Kept beside the voyage in memory, not in the save: after
 * a reload the line starts again from the day's price.
 */
interface PriceLog {
  /** Economy seconds logged so far; a day ends every `daySeconds`. */
  clock: number;
  byPort: Record<string, Partial<Record<GoodId, number[]>>>;
}

const logs = new WeakMap<TradeState, PriceLog>();

function logOf(trade: TradeState): PriceLog {
  let log = logs.get(trade);
  if (!log) logs.set(trade, (log = { clock: 0, byPort: {} }));
  return log;
}

const daySeconds = () => TUNING.weather.daylight.daySeconds;
const keptDays = () => TUNING.ui.priceLogDays;

/** Writes down today's buy price of every good each market trades. */
function closeDay(trade: TradeState, log: PriceLog) {
  for (const [portId, market] of Object.entries(trade.markets)) {
    const port = (log.byPort[portId] ??= {});
    for (const good of GOODS) {
      if (!trades(market, good)) continue;
      const days = (port[good] ??= []);
      days.push(quoteBuy(market, good, 1));
      if (days.length > keptDays()) days.shift();
    }
  }
}

/**
 * Lets `dt` economy seconds pass on every market (stocks drift back to equilibrium), closing each
 * day it crosses. Days older than the log keeps pass in one step, unrecorded.
 */
export function stepMarketsLogged(trade: TradeState, dt: number) {
  const log = logOf(trade);
  const day = daySeconds();
  let left = Math.max(0, dt);
  const unrecorded = left - keptDays() * day;
  if (unrecorded > 0) {
    for (const market of Object.values(trade.markets)) stepMarket(market, unrecorded);
    log.clock += unrecorded;
    left -= unrecorded;
  }
  while (left > 0) {
    const toDayEnd = day - (log.clock % day);
    const step = Math.min(left, toDayEnd);
    for (const market of Object.values(trade.markets)) stepMarket(market, step);
    log.clock += step;
    left -= step;
    if (step === toDayEnd) closeDay(trade, log);
  }
}

/** The good's buy price at each logged day's end, oldest first, then today's price. */
export function priceTrend(trade: TradeState, portId: string, good: GoodId): number[] {
  const market = trade.markets[portId];
  if (!market || !trades(market, good)) return [];
  const days = logOf(trade).byPort[portId]?.[good] ?? [];
  return [...days, quoteBuy(market, good, 1)];
}
