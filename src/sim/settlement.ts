import { type GoodId, isGood } from './goods';
import type { MapDef, PortDef } from './map';

/**
 * Living settlements (decision 0059). Every port is a settlement with a level from 1 (hamlet) to
 * 4 (port town). Selling a town the goods it wants, and above all delivering its orders, grows it;
 * enough growth raises its level, which widens and deepens what it wants, enlarges its orders and,
 * at the home port, unlocks higher shipyard upgrades. A town nobody supplies stalls: its growth
 * drains back to the start of its level, but a level once reached is never lost.
 * Levels change only in whole steps, so the renderer can rebuild an island on the rare level-up.
 */

export type SettlementLevel = 1 | 2 | 3 | 4;
export const MAX_SETTLEMENT_LEVEL: SettlementLevel = 4;

/** Growth points needed to rise from level n-1 to n (index = n). */
export const GROWTH_TO_LEVEL: Record<2 | 3 | 4, number> = { 2: 40, 3: 150, 4: 350 };
/** Points per order delivered, on top of one per unit handed over. */
export const ORDER_GROWTH_BONUS = 5;
/** Seconds without any wanted goods before a town starts to stall. */
export const STALL_SECONDS = 180;
/** Growth lost per minute while stalled (never below the start of the current level). */
export const STALL_DECAY_PER_MINUTE = 2;

/**
 * Market depth per level (index = level - 1): a bigger town eats more of what it wants (smaller
 * stock, dearer) and makes more of what it produces. Level 2 matches the Phase 1 tuning (0046).
 */
export const WANTS_EQUILIBRIUM = [15, 12, 10, 8] as const;
export const PRODUCES_EQUILIBRIUM = [85, 100, 115, 130] as const;
/** Order size multiplier per level (decision 0028 sizes are level 2). */
export const ORDER_SCALE = [0.8, 1, 1.25, 1.5] as const;

/**
 * Home port level needed to fit each upgrade level (index = upgrade level, decision 0030): the
 * first upgrades need a village, the top ones a town. The home port starts as a village.
 */
export const UPGRADE_NEEDS_LEVEL: Record<number, SettlementLevel> = { 2: 2, 3: 3 };

export interface Settlement {
  level: SettlementLevel;
  /** Points toward the next level (0 … GROWTH_TO_LEVEL[level + 1]). */
  growth: number;
  /** Seconds since the town last received goods it wants. */
  sinceSupply: number;
}

export interface SettlementState {
  byPort: Record<string, Settlement>;
}

export interface LevelUp {
  type: 'level-up';
  portId: string;
  level: SettlementLevel;
}

export function clampLevel(n: unknown): SettlementLevel {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 1;
  return Math.min(Math.max(v, 1), MAX_SETTLEMENT_LEVEL) as SettlementLevel;
}

/**
 * The level a port starts a new voyage at. Map data; a port without one is a village, the size the
 * Phase 1 economy was tuned for (decision 0046).
 */
export function startLevel(port: PortDef): SettlementLevel {
  return clampLevel(port.level ?? 2);
}

/** Goods the port wants at `level`: its base wants plus every want unlocked up to that level. */
export function portWants(port: PortDef, level: number): GoodId[] {
  const out = [...port.wants];
  for (let l = 2; l <= level; l++)
    for (const g of port.levelWants?.[String(l) as '2' | '3' | '4'] ?? [])
      if (isGood(g) && !out.includes(g) && !port.produces.includes(g)) out.push(g);
  return out;
}

/** Points still needed for the next level, or null at the top. */
export function growthNeeded(level: SettlementLevel): number | null {
  return level >= MAX_SETTLEMENT_LEVEL ? null : GROWTH_TO_LEVEL[(level + 1) as 2 | 3 | 4];
}

export function createSettlements(map: MapDef): SettlementState {
  const byPort: Record<string, Settlement> = {};
  for (const port of map.ports)
    byPort[port.id] = { level: startLevel(port), growth: 0, sinceSupply: 0 };
  return { byPort };
}

/** Anything holding settlements: the trade state, or the bare settlement store. */
type HasSettlements = { settlements: SettlementState };

/** The port's current level (the renderer reads this; 1 for an unknown port). */
export function settlementLevel(state: HasSettlements, portId: string): SettlementLevel {
  return state.settlements.byPort[portId]?.level ?? 1;
}

/** Every port's level, for the renderer. */
export function settlementLevels(state: HasSettlements): Record<string, SettlementLevel> {
  const out: Record<string, SettlementLevel> = {};
  for (const [id, s] of Object.entries(state.settlements.byPort)) out[id] = s.level;
  return out;
}

/** What the docked port wants right now (levels included). */
export function wantsAt(map: MapDef, state: HasSettlements, portId: string): GoodId[] {
  const port = map.ports.find((p) => p.id === portId);
  return port ? portWants(port, settlementLevel(state, portId)) : [];
}

/** Growth toward the next level, for a progress bar: 0 … 1 (1 at the top level). */
export function growthProgress(state: HasSettlements, portId: string): number {
  const s = state.settlements.byPort[portId];
  if (!s) return 0;
  const need = growthNeeded(s.level);
  return need === null ? 1 : Math.min(1, s.growth / need);
}

/** Supply arrived: `points` of growth and the stall timer resets. */
export function addGrowth(state: HasSettlements, portId: string, points: number): void {
  const s = state.settlements.byPort[portId];
  if (!s || points <= 0) return;
  s.sinceSupply = 0;
  if (s.level < MAX_SETTLEMENT_LEVEL) s.growth += points;
}

/**
 * Advance every settlement by `dt`: stalled towns drain growth, and towns with enough growth
 * rise a level (one step per call, the rest carries over). Returns the level-ups.
 */
export function stepSettlements(state: HasSettlements, dt: number): LevelUp[] {
  const ups: LevelUp[] = [];
  for (const [portId, s] of Object.entries(state.settlements.byPort)) {
    const before = s.sinceSupply;
    s.sinceSupply += dt;
    const stalled = Math.min(dt, s.sinceSupply - Math.max(before, STALL_SECONDS));
    if (stalled > 0 && s.growth > 0)
      s.growth = Math.max(0, s.growth - (STALL_DECAY_PER_MINUTE * stalled) / 60);
    const need = growthNeeded(s.level);
    if (need !== null && s.growth >= need) {
      s.growth -= need;
      s.level = (s.level + 1) as SettlementLevel;
      if (s.level >= MAX_SETTLEMENT_LEVEL) s.growth = 0;
      ups.push({ type: 'level-up', portId, level: s.level });
    }
  }
  return ups;
}

/** Home port level needed before the next upgrade level `to` can be fitted (1 = always). */
export function upgradeNeedsLevel(to: number): SettlementLevel {
  return UPGRADE_NEEDS_LEVEL[to] ?? 1;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Read saved settlements against the current map. Older saves (none saved) and new ports start at
 * the map's level; a saved level never drops below the map's starting level.
 */
export function readSettlements(raw: unknown, map: MapDef): SettlementState {
  const fresh = createSettlements(map);
  if (typeof raw !== 'object' || raw === null) return fresh;
  const saved = (raw as { byPort?: unknown }).byPort;
  if (typeof saved !== 'object' || saved === null) return fresh;
  for (const port of map.ports) {
    const s = (saved as Record<string, unknown>)[port.id] as Partial<Settlement> | undefined;
    if (!s || typeof s !== 'object') continue;
    const level = Math.max(startLevel(port), clampLevel(s.level)) as SettlementLevel;
    const need = growthNeeded(level);
    const growth = isNum(s.growth) && s.growth > 0 && need !== null ? Math.min(s.growth, need) : 0;
    const sinceSupply = isNum(s.sinceSupply) && s.sinceSupply > 0 ? s.sinceSupply : 0;
    fresh.byPort[port.id] = { level, growth, sinceSupply };
  }
  return fresh;
}
