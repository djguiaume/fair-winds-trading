import { REGATTA } from './regatta';
import { SHIP_CLASSES } from './ship';
import { stockLevels } from './upgrades';
import type { TradeState } from './trade';

/**
 * A series' prize ship (decision 0227): the moment a series is won, its `prize` class is in the
 * captain's fleet at stock levels. She is not sailed until the captain switches at the home port.
 * Safe to call again: a ship already owned is left alone. Returns the classes given just now.
 */
export function grantSeriesPrizes(trade: TradeState, won: readonly string[]): string[] {
  const given: string[] = [];
  for (const series of REGATTA.series) {
    const id = series.prize;
    if (!id || !won.includes(series.id) || trade.captain.ships[id] || !SHIP_CLASSES[id]) continue;
    trade.captain.ships[id] = stockLevels();
    given.push(id);
  }
  return given;
}
