import type { GoodId } from './goods';
import { applyPerks } from './perks';
import { type TradeState, freeSpace } from './trade';

/**
 * The warehouse of a home island (decisions 0126, 0136): moored at one of her islands whose
 * buildings give `homeStorage`, the captain keeps crates there between voyages, up to that many,
 * and takes them back as the hold has room. Stored goods stay as they were: no prices, no decay.
 * The room is the building's value in `src/data/buildings.json`.
 */

export type StorageError =
  'no-storage' | 'bad-quantity' | 'not-in-hold' | 'storage-full' | 'hold-full';
export type StorageResult = { ok: true; qty: number } | { ok: false; error: StorageError };

/** Crates the moored island can keep (0 away from a warehouse). */
export function storageRoom(trade: TradeState): number {
  return trade.home.docked ? applyPerks(trade.home, 'storageRoom', 0) : 0;
}

/** What is kept on an island (default: the moored one). */
export function storedGoods(
  trade: TradeState,
  islandId = trade.home.docked,
): Partial<Record<GoodId, number>> {
  return (islandId && trade.home.islands[islandId]?.stored) || {};
}

export function storedTotal(trade: TradeState, islandId = trade.home.docked): number {
  return Object.values(storedGoods(trade, islandId)).reduce((n, q) => n + (q ?? 0), 0);
}

/** Put crates from the hold into the moored island's warehouse; as many as fit, at most `qty`. */
export function storeGoods(trade: TradeState, good: GoodId, qty: number): StorageResult {
  const room = storageRoom(trade);
  const island = trade.home.docked && trade.home.islands[trade.home.docked];
  if (!island || room <= 0) return { ok: false, error: 'no-storage' };
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: 'bad-quantity' };
  if (trade.captain.cargo[good] <= 0) return { ok: false, error: 'not-in-hold' };
  const n = Math.min(qty, trade.captain.cargo[good], room - storedTotal(trade));
  if (n <= 0) return { ok: false, error: 'storage-full' };
  trade.captain.cargo[good] -= n;
  island.stored = { ...island.stored, [good]: (island.stored?.[good] ?? 0) + n };
  return { ok: true, qty: n };
}

/** Take crates back aboard from the moored island; as many as the hold has room for. */
export function takeGoods(trade: TradeState, good: GoodId, qty: number): StorageResult {
  const island = trade.home.docked && trade.home.islands[trade.home.docked];
  const have = (island && island.stored?.[good]) || 0;
  if (!island || !trade.home.docked) return { ok: false, error: 'no-storage' };
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: 'bad-quantity' };
  if (have <= 0) return { ok: false, error: 'not-in-hold' };
  const n = Math.min(qty, have, freeSpace(trade));
  if (n <= 0) return { ok: false, error: 'hold-full' };
  trade.captain.cargo[good] += n;
  const left = { ...island.stored, [good]: have - n };
  if (!left[good]) delete left[good];
  if (Object.keys(left).length) island.stored = left;
  else delete island.stored;
  return { ok: true, qty: n };
}
