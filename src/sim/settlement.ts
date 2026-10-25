import { type GoodId, isGood, isMadeGood, isRare } from './goods';
import type { MapDef, PortDef } from './map';
import { type Difficulty, knobs } from './difficulty';
import { TUNING } from '../data/tuning';
import townLevels from '../data/town-levels.json';

/**
 * Living settlements (decision 0059). Every port is a settlement with a level from 1 (hamlet) to
 * 4 (port town). Selling a town the goods it wants, and above all delivering its orders, grows it;
 * enough growth raises its level, which widens and deepens what it wants, enlarges its orders and,
 * at the home port, unlocks higher shipyard upgrades. A town nobody supplies stalls: its growth
 * drains back to the start of its level, but a level once reached is never lost.
 * Levels change only in whole steps, so the renderer can rebuild an island on the rare level-up.
 * A town that wants a rare good becomes a port town only once it has received enough of it (0065).
 */

/**
 * The town levels, from `src/data/town-levels.json` (decision 0113): their number and English
 * names, in order from the smallest. Level n is entry n - 1; the top one is the port town, the
 * level a rare-goods gate holds back (0065). Each level's numbers sit in `economy.json` › `towns`.
 */
export const TOWN_LEVELS: readonly { readonly name: string }[] = townLevels.levels;
/** A town level, 1 to `MAX_SETTLEMENT_LEVEL`. */
export type SettlementLevel = number;
export const MAX_SETTLEMENT_LEVEL: SettlementLevel = TOWN_LEVELS.length;
/** Every level, 1 to the top, for lists and editors. */
export const SETTLEMENT_LEVELS: readonly SettlementLevel[] = TOWN_LEVELS.map((_, i) => i + 1);
/** The level a port without one starts a voyage at (the village the 0046 economy was tuned for). */
export const DEFAULT_START_LEVEL: SettlementLevel = townLevels.startLevel;

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
  /** Economy time applied before supply arrived between ticks (saved with the town). */
  advancedBeforeSupply?: number;
}

export interface SettlementState {
  byPort: Record<string, Settlement>;
  /** Supplied towns and carry-over growth resolve on the next sailing step. */
  pendingSupply?: boolean;
}

// Supply changes must be reflected on the next simulation step, even between economy ticks.
export function hasPendingSupply(state: SettlementState): boolean {
  return state.pendingSupply === true;
}

export interface LevelUp {
  type: 'level-up';
  portId: string;
  level: SettlementLevel;
}

export function clampLevel(n: unknown): SettlementLevel {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 1;
  return Math.min(Math.max(v, 1), MAX_SETTLEMENT_LEVEL);
}

/**
 * The level a port starts a new voyage at. Map data; a port without one is a village, the size the
 * Phase 1 economy was tuned for (decision 0046).
 */
export function startLevel(port: PortDef): SettlementLevel {
  return clampLevel(port.level ?? DEFAULT_START_LEVEL);
}

type LevelKey = `${number}`;

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
  // The ring's port towns buy far goods (decision 0146), once some main port crafts them.
  for (let l = 2; l <= level; l++)
    for (const g of port.levelWantsMade?.[String(l) as LevelKey] ?? []) if (made.has(g)) add(g);
  return out;
}

/** The highest level the port grows to (decision 0146: outposts stop at town). */
export function topLevel(port: PortDef): SettlementLevel {
  return port.maxLevel === undefined ? MAX_SETTLEMENT_LEVEL : clampLevel(port.maxLevel);
}

/** The quests started and not done yet (decision 0166: land that stands only while one runs). */
export function questsRunning(state: HasSettlements): Set<string> {
  const running = new Set<string>();
  for (const [id, p] of Object.entries(state.quests?.byId ?? {}))
    if (p.step !== 'done') running.add(id);
  return running;
}

/** The quests a voyage has finished (decision 0130); none for a bare settlement store. */
export function questsDone(state: HasSettlements): Set<string> {
  const done = new Set<string>();
  for (const [id, p] of Object.entries(state.quests?.byId ?? {}))
    // A race finished once stays done while it is sailed again (decision 0217).
    if (p.step === 'done' || p.best !== undefined) done.add(id);
  // A regatta series won counts as done, for what waits on it: the Cup on Skerry's pier (0217).
  for (const id of state.quests?.won ?? []) done.add(id);
  return done;
}

/**
 * The port as it trades now (decision 0130): each quest done that changes its trade
 * (`afterQuest`) puts its fields in place of the port's own, in the order the map lists them.
 */
export function portNow(port: PortDef, state: HasSettlements): PortDef {
  if (!port.afterQuest) return port;
  const done = questsDone(state);
  let out = port;
  for (const [quest, change] of Object.entries(port.afterQuest))
    if (done.has(quest)) out = { ...out, ...change };
  return out;
}

/** Specialized and rare goods some port makes at its current level: the ones with a market (0063). */
export function madeGoods(map: MapDef, state: HasSettlements): Set<GoodId> {
  const made = new Set<GoodId>();
  for (const port of map.ports)
    for (const g of portProduces(portNow(port, state), settlementLevel(state, port.id)))
      if (isMadeGood(g)) made.add(g);
  return made;
}

/** What the port makes right now (levels included). */
export function producesAt(map: MapDef, state: HasSettlements, portId: string): GoodId[] {
  const port = map.ports.find((p) => p.id === portId);
  return port ? portProduces(portNow(port, state), settlementLevel(state, portId)) : [];
}

/** Points still needed for the next level, or null at the top. */
export function growthNeeded(level: SettlementLevel): number | null {
  return level >= MAX_SETTLEMENT_LEVEL
    ? null
    : (towns().growthToLevel as Record<string, number>)[String(level + 1)]!;
}

export function createSettlements(map: MapDef): SettlementState {
  const byPort: Record<string, Settlement> = {};
  for (const port of map.ports)
    byPort[port.id] = { level: startLevel(port), growth: 0, sinceSupply: 0, rare: 0 };
  return { byPort };
}

/** Anything holding settlements: the trade state, or the bare settlement store. */
export type HasSettlements = {
  settlements: SettlementState;
  /** The voyage's quests, for the trade a quest changes (decision 0130). */
  quests?: { byId: Record<string, { step: string; best?: number }>; won?: string[] };
  difficulty?: Difficulty;
  economyPending?: number;
};

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
  return port
    ? portWants(portNow(port, state), settlementLevel(state, portId), madeGoods(map, state))
    : [];
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
  // Supply can also arrive between economy ticks. Settle the time before delivery first,
  // then exclude it from the next batched tick so the new supply is not aged retroactively.
  const pending = state.economyPending ?? 0;
  const owed = pending - (s.advancedBeforeSupply ?? 0);
  const stalled = Math.max(0, s.sinceSupply + owed - Math.max(s.sinceSupply, towns().stallSeconds));
  s.growth = Math.max(0, s.growth - (towns().stallDecayPerMinute * stalled) / 60);
  s.advancedBeforeSupply = pending;
  state.settlements.pendingSupply = true;
  s.sinceSupply = 0;
  // Towns need less trade to grow on Fair winds and more on Old salt (decision 0083).
  if (s.level < MAX_SETTLEMENT_LEVEL) s.growth += points / knobs(state.difficulty).growth;
}

/** A wanted rare good arrived (sold or delivered): it counts toward the port town gate (0065). */
export function addRare(state: HasSettlements, portId: string, good: GoodId, qty: number): void {
  const s = state.settlements.byPort[portId];
  if (s && isRare(good) && qty > 0) {
    s.rare += qty;
    state.settlements.pendingSupply = true;
  }
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
 * waits at full growth instead of becoming a port town (0065), and a port at its own `maxLevel`
 * (an outpost, 0146) waits there for good. Returns the level-ups.
 */
export function stepSettlements(state: HasSettlements, dt: number, map: MapDef): LevelUp[] {
  delete state.settlements.pendingSupply;
  const ups: LevelUp[] = [];
  const topOf = (id: string) => {
    const port = map.ports.find((p) => p.id === id);
    return port ? topLevel(portNow(port, state)) : MAX_SETTLEMENT_LEVEL;
  };
  for (const [portId, s] of Object.entries(state.settlements.byPort)) {
    const elapsed = Math.max(0, dt - (s.advancedBeforeSupply ?? 0));
    delete s.advancedBeforeSupply;
    const before = s.sinceSupply;
    s.sinceSupply += elapsed;
    const stalled = Math.min(elapsed, s.sinceSupply - Math.max(before, towns().stallSeconds));
    if (stalled > 0 && s.growth > 0)
      s.growth = Math.max(0, s.growth - (towns().stallDecayPerMinute * stalled) / 60);
    const need = growthNeeded(s.level);
    if (
      need !== null &&
      s.growth >= need &&
      ((s.level === MAX_SETTLEMENT_LEVEL - 1 && portTownGate(map, state, portId)) ||
        s.level >= topOf(portId))
    ) {
      // Held back by the rare goods gate (0065) or at the port's own top level (0146).
      s.growth = need;
    } else if (need !== null && s.growth >= need) {
      s.growth -= need;
      s.level += 1;
      if (s.level >= MAX_SETTLEMENT_LEVEL) s.growth = 0;
      ups.push({ type: 'level-up', portId, level: s.level });
      // Carry-over growth still resolves one level per sailing step.
      state.settlements.pendingSupply = true;
    }
  }
  return ups;
}

/** Home port level needed before the next upgrade level `to` can be fitted (1 = always). */
export function upgradeNeedsLevel(to: number): SettlementLevel {
  return TUNING.upgrades.homePortLevel[String(to)] ?? 1;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Read saved settlements against the current map. Older saves (none saved) and new ports start at
 * the map's level; a saved level never drops below the map's starting level.
 */
export function readSettlements(raw: unknown, map: MapDef): SettlementState {
  const fresh = createSettlements(map);
  if (typeof raw !== 'object' || raw === null) return fresh;
  if ((raw as { pendingSupply?: unknown }).pendingSupply === true) fresh.pendingSupply = true;
  const saved = (raw as { byPort?: unknown }).byPort;
  if (typeof saved !== 'object' || saved === null) return fresh;
  for (const port of map.ports) {
    const s = (saved as Record<string, unknown>)[port.id] as Partial<Settlement> | undefined;
    if (!s || typeof s !== 'object') continue;
    const level = Math.max(startLevel(port), clampLevel(s.level));
    const need = growthNeeded(level);
    const growth = isNum(s.growth) && s.growth > 0 && need !== null ? Math.min(s.growth, need) : 0;
    const sinceSupply = isNum(s.sinceSupply) && s.sinceSupply > 0 ? s.sinceSupply : 0;
    const rare = isNum(s.rare) && s.rare > 0 ? s.rare : 0;
    fresh.byPort[port.id] = {
      level,
      growth,
      sinceSupply,
      rare,
      ...(isNum(s.advancedBeforeSupply) && s.advancedBeforeSupply > 0
        ? { advancedBeforeSupply: s.advancedBeforeSupply }
        : {}),
    };
  }
  return fresh;
}
