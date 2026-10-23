import { type GoodId, isGood, isMadeGood, isRare } from './goods';
import type { MapDef, PortDef } from './map';
import { type Difficulty, knobs } from './difficulty';
import { TUNING } from '../data/tuning';

/**
 * Living settlements (decision 0059). Every port is a settlement with a level from 1 (hamlet) to
 * 4 (port town). Selling a town the goods it wants, and above all delivering its orders, grows it;
 * enough growth raises its level, which widens and deepens what it wants, enlarges its orders and,
 * at the home port, unlocks higher shipyard upgrades. A town nobody supplies stalls: its growth
 * drains back to the start of its level, but a level once reached is never lost.
 * Levels change only in whole steps, so the renderer can rebuild an island on the rare level-up.
 * A town that wants a rare good becomes a port town only once it has received enough of it (0065).
 */

export type SettlementLevel = 1 | 2 | 3 | 4;
export const MAX_SETTLEMENT_LEVEL: SettlementLevel = 4;

/*
 * The numbers live in `src/data/tuning/economy.json` › `towns` (decision 0094):
 * - `growthToLevel`: growth points needed to rise from level n-1 to n (key = n);
 * - `orderGrowthBonus`: points per order delivered, on top of one per unit handed over;
 * - `stallSeconds`: seconds without any wanted goods before a town starts to stall, then it loses
 *   `stallDecayPerMinute` growth per minute (never below the start of the current level);
 * - market depth per level (index = level - 1): a bigger town eats more of what it wants
 *   (`wantsEquilibrium`: smaller stock, dearer) and makes more of what it produces
 *   (`producesEquilibrium`). Level 2 matches the Phase 1 tuning (0046);
 * - a workshop makes less than the bulk trade: its stock is `specialtyShare` of the produces
 *   equilibrium (0063); a far yard's stock of its rare good is `rareShare` of it (0065), more than
 *   a workshop, so the yard sells it cheap enough to pay for the longest crossings on the map;
 * - `rareForPortTown`: units of its rare goods a town must receive before it can become a port
 *   town (decision 0065);
 * - `orderScale`: order size multiplier per level (decision 0028 sizes are level 2).
 * The home port level needed to fit each upgrade level is `upgrades.json` › `homePortLevel`
 * (decision 0030): the first upgrades need a village, the top ones a town.
 */
const towns = () => TUNING.economy.towns;

export interface Settlement {
  level: SettlementLevel;
  /** Points toward the next level (0 … `growthToLevel[level + 1]`). */
  growth: number;
  /** Seconds since the town last received goods it wants. */
  sinceSupply: number;
  /** Units of rare goods it has received, for the port town gate (decision 0065). */
  rare: number;
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

type LevelKey = '2' | '3' | '4';

/** Goods the port makes at `level`: its bulk good plus its workshop's specialty from town level (0063). */
export function portProduces(port: PortDef, level: number): GoodId[] {
  const out = [...port.produces];
  for (let l = 2; l <= level; l++)
    for (const g of port.levelProduces?.[String(l) as LevelKey] ?? [])
      if (isGood(g) && !out.includes(g)) out.push(g);
  return out;
}

/**
 * Goods the port wants at `level`: its base wants, every want unlocked up to that level, and the
 * specialized and rare goods it buys that some port already makes (`made`, decisions 0063, 0065).
 */
export function portWants(
  port: PortDef,
  level: number,
  made: ReadonlySet<GoodId> = new Set(),
): GoodId[] {
  const out = [...port.wants];
  const makes = portProduces(port, level);
  const add = (g: GoodId) => {
    if (isGood(g) && !out.includes(g) && !makes.includes(g)) out.push(g);
  };
  for (let l = 2; l <= level; l++)
    for (const g of port.levelWants?.[String(l) as LevelKey] ?? []) add(g);
  for (const g of port.wantsMade ?? []) if (made.has(g)) add(g);
  return out;
}

/** Specialized and rare goods some port makes at its current level: the ones with a market (0063). */
export function madeGoods(map: MapDef, state: HasSettlements): Set<GoodId> {
  const made = new Set<GoodId>();
  for (const port of map.ports)
    for (const g of portProduces(port, settlementLevel(state, port.id)))
      if (isMadeGood(g)) made.add(g);
  return made;
}

/** What the port makes right now (levels included). */
export function producesAt(map: MapDef, state: HasSettlements, portId: string): GoodId[] {
  const port = map.ports.find((p) => p.id === portId);
  return port ? portProduces(port, settlementLevel(state, portId)) : [];
}

/** Points still needed for the next level, or null at the top. */
export function growthNeeded(level: SettlementLevel): number | null {
  return level >= MAX_SETTLEMENT_LEVEL
    ? null
    : towns().growthToLevel[String(level + 1) as '2' | '3' | '4'];
}

export function createSettlements(map: MapDef): SettlementState {
  const byPort: Record<string, Settlement> = {};
  for (const port of map.ports)
    byPort[port.id] = { level: startLevel(port), growth: 0, sinceSupply: 0, rare: 0 };
  return { byPort };
}

/** Anything holding settlements: the trade state, or the bare settlement store. */
type HasSettlements = { settlements: SettlementState; difficulty?: Difficulty };

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

/** What the port wants right now (levels and specialties on the market included). */
export function wantsAt(map: MapDef, state: HasSettlements, portId: string): GoodId[] {
  const port = map.ports.find((p) => p.id === portId);
  return port ? portWants(port, settlementLevel(state, portId), madeGoods(map, state)) : [];
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
  // Towns need less trade to grow on Fair winds and more on Old salt (decision 0083).
  if (s.level < MAX_SETTLEMENT_LEVEL) s.growth += points / knobs(state.difficulty).growth;
}

/** A wanted rare good arrived (sold or delivered): it counts toward the port town gate (0065). */
export function addRare(state: HasSettlements, portId: string, good: GoodId, qty: number): void {
  const s = state.settlements.byPort[portId];
  if (s && isRare(good) && qty > 0) s.rare += qty;
}

/** Rare goods the port buys: what it must receive to become a port town (0065). */
export function rareWants(port: PortDef): GoodId[] {
  return (port.wantsMade ?? []).filter((g) => isGood(g) && isRare(g));
}

export interface PortTownGate {
  goods: GoodId[];
  /** Units received so far and units needed. */
  have: number;
  need: number;
}

/** What still holds a town back from port town, or null when nothing does (0065). */
export function portTownGate(
  map: MapDef,
  state: HasSettlements,
  portId: string,
): PortTownGate | null {
  const port = map.ports.find((p) => p.id === portId);
  const s = state.settlements.byPort[portId];
  if (!port || !s || s.level >= MAX_SETTLEMENT_LEVEL) return null;
  const goods = rareWants(port);
  const need = towns().rareForPortTown;
  if (!goods.length || s.rare >= need) return null;
  return { goods, have: Math.floor(s.rare), need };
}

/**
 * Advance every settlement by `dt`: stalled towns drain growth, and towns with enough growth
 * rise a level (one step per call, the rest carries over). A town still short of its rare goods
 * waits at full growth instead of becoming a port town (0065). Returns the level-ups.
 */
export function stepSettlements(state: HasSettlements, dt: number, map: MapDef): LevelUp[] {
  const ups: LevelUp[] = [];
  for (const [portId, s] of Object.entries(state.settlements.byPort)) {
    const before = s.sinceSupply;
    s.sinceSupply += dt;
    const stalled = Math.min(dt, s.sinceSupply - Math.max(before, towns().stallSeconds));
    if (stalled > 0 && s.growth > 0)
      s.growth = Math.max(0, s.growth - (towns().stallDecayPerMinute * stalled) / 60);
    const need = growthNeeded(s.level);
    if (need !== null && s.growth >= need && s.level === 3 && portTownGate(map, state, portId)) {
      s.growth = need;
    } else if (need !== null && s.growth >= need) {
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
  return (TUNING.upgrades.homePortLevel[String(to)] ?? 1) as SettlementLevel;
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
    const rare = isNum(s.rare) && s.rare > 0 ? s.rare : 0;
    fresh.byPort[port.id] = { level, growth, sinceSupply, rare };
  }
  return fresh;
}
