import { SAIL_STEPS, type BoatState, createBoat } from './boat';
import { type ContractState, readContracts } from './contracts';
import { resolveCollisions } from './collision';
import { seaShape } from './seaEdge';
import { type Difficulty, DEFAULT_DIFFICULTY, isDifficulty } from './difficulty';
import { GOODS, type GoodAmounts, type GoodId, emptyAmounts, isGood } from './goods';
import { type IslandHome, readHome } from './home';
import type { MapDef } from './map';
import { wrapPositive } from './math';
import { type SettlementState, readSettlements } from './settlement';
import { SHIP_CLASSES } from './ship';
import { type QuestState, readQuests } from './quests';
import { type ShipyardProgress, readProgress } from './shipyards';
import { type CreditLoan, activeShip, findPort, setDifficulty, syncMarketLevels } from './trade';
import { MAX_UPGRADE_LEVEL, UPGRADE_TRACKS, type UpgradeLevels, hullDurability } from './upgrades';
import { refreshPiers, resetLand, syncWorldLand, type World } from './world';

/**
 * Save and resume (decisions 0009, 0015): the progress that matters is written as small versioned
 * JSON. Storage is passed in (localStorage in the browser, a stub in tests) so the sim never
 * touches the DOM. Anything unreadable is ignored and the game starts fresh.
 */
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'fwt.save.v1';

export interface SaveData {
  version: number;
  /** Map name, so a save for another map is not applied. */
  map: string;
  time: number;
  /** Active simulation time not yet applied by the batched economy. */
  economyPending?: number;
  windOffsetDeg: number;
  /** `sailStep` is the sail setting (decision 0076). Optional: older saves resume with full sails
   * at sea and sails down in port. */
  boat: { x: number; y: number; heading: number; sailStep?: number };
  gold: number;
  activeShip: string;
  ships: Record<string, UpgradeLevels>;
  cargo: GoodAmounts;
  /** Hull damage per ship (decision 0032). Optional: older saves have sound hulls. */
  hullDamage?: Record<string, number>;
  /** A load on credit (decision 0200). Optional: none owed. */
  loan?: CreditLoan;
  dockedAt: string | null;
  /** Port id → current stock per good. */
  markets: Record<string, GoodAmounts>;
  /**
   * Port id → far goods its workshop has crafted and not yet sold (decision 0146). Optional:
   * older saves and ports without a far workshop have none.
   */
  workshops?: Record<string, Partial<Record<GoodId, number>>>;
  /** Delivery orders (decision 0028). Optional: older saves get fresh orders. */
  contracts?: ContractState;
  /** Discovered ports and shipwright standing (decision 0048). Optional: older saves start fresh. */
  progress?: ShipyardProgress;
  /** Settlement levels and growth (decision 0059). Optional: older saves start at the map's levels. */
  settlements?: SettlementState;
  /** Difficulty level (decision 0083). Optional: older saves play on as Captain. */
  difficulty?: Difficulty;
  /** Easiest level played on the voyage (0083). Optional: defaults to `difficulty`. */
  easiestDifficulty?: Difficulty;
  /**
   * The captain's islands (decisions 0126, 0128). Optional: older saves have none. The first
   * shape (one island, `{ owned, offered, built }`) is read as the map's home island.
   */
  home?: { islands: Record<string, IslandHome> };
  /** Quest progress (decision 0125). Optional: older saves have none. */
  quests?: QuestState;
}

/** The subset of the Web Storage API the save needs. */
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function serializeWorld(world: World): SaveData {
  const { captain, markets, dockedAt } = world.trade;
  const stocks: Record<string, GoodAmounts> = {};
  const workshops: Record<string, Partial<Record<GoodId, number>>> = {};
  for (const [id, m] of Object.entries(markets)) {
    stocks[id] = { ...m.stock };
    if (m.workshop) workshops[id] = { ...m.workshop };
  }
  const ships: Record<string, UpgradeLevels> = {};
  for (const [id, levels] of Object.entries(captain.ships)) ships[id] = { ...levels };
  return {
    version: SAVE_VERSION,
    map: world.map.name,
    time: world.time,
    economyPending: world.trade.economyPending ?? 0,
    windOffsetDeg: world.windOffsetDeg,
    boat: {
      x: world.boat.x,
      y: world.boat.y,
      heading: world.boat.heading,
      sailStep: world.boat.sailStep,
    },
    gold: captain.gold,
    activeShip: captain.activeShip,
    ships,
    cargo: { ...captain.cargo },
    hullDamage: { ...captain.hullDamage },
    ...(captain.loan ? { loan: { ...captain.loan } } : {}),
    dockedAt,
    markets: stocks,
    ...(Object.keys(workshops).length ? { workshops } : {}),
    contracts: structuredClone(world.trade.contracts),
    progress: structuredClone(world.trade.progress),
    settlements: structuredClone(world.trade.settlements),
    difficulty: world.trade.difficulty,
    easiestDifficulty: world.trade.easiestDifficulty,
    home: { islands: structuredClone(world.trade.home.islands) },
    quests: structuredClone(world.trade.quests),
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function readAmounts(v: unknown, integers: boolean): GoodAmounts | null {
  if (!isObj(v)) return null;
  const out = emptyAmounts();
  for (const g of GOODS) {
    const n = v[g] ?? 0;
    if (!isNum(n) || n < 0 || (integers && !Number.isInteger(n))) return null;
    out[g] = n;
  }
  return out;
}

/** A load on credit (decision 0200): a known port and good, whole numbers; anything else is none. */
function readLoan(v: unknown, map: MapDef): { loan?: CreditLoan } {
  if (!isObj(v) || typeof v.port !== 'string' || !findPort(map, v.port)) return {};
  if (!isGood(v.good)) return {};
  const whole = (n: unknown): n is number => isNum(n) && Number.isInteger(n) && n >= 0;
  if (!whole(v.qty) || !whole(v.owed)) return {};
  return { loan: { port: v.port, good: v.good, qty: v.qty, owed: v.owed } };
}

/** Far workshops' crafted units (decision 0146): known ports and goods, whole units ≥ 0. */
function readWorkshops(v: unknown, map: MapDef): SaveData['workshops'] {
  if (!isObj(v)) return undefined;
  const out: NonNullable<SaveData['workshops']> = {};
  for (const port of map.ports) {
    const w = v[port.id];
    if (!isObj(w)) continue;
    const goods: Partial<Record<GoodId, number>> = {};
    for (const [g, n] of Object.entries(w))
      if (isGood(g) && isNum(n) && n > 0) goods[g] = Math.floor(n);
    out[port.id] = goods;
  }
  return Object.keys(out).length ? out : undefined;
}

function readLevels(v: unknown): UpgradeLevels | null {
  if (!isObj(v)) return null;
  const out = { sails: 1, hold: 1, hull: 1 };
  for (const t of UPGRADE_TRACKS) {
    const n = v[t];
    if (!isNum(n) || !Number.isInteger(n) || n < 1 || n > MAX_UPGRADE_LEVEL) return null;
    out[t] = n;
  }
  return out;
}

/** Damage only for owned ships, within the hull's durability; anything else reads as sound. */
function readHullDamage(v: unknown, ships: Record<string, UpgradeLevels>): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const [id, levels] of Object.entries(ships)) {
    const n = v[id];
    if (isNum(n) && n > 0) out[id] = Math.min(n, hullDurability(levels));
  }
  return out;
}

/**
 * Check a parsed save against the current map and rules. Returns a clean copy, or null when it
 * is from another version or map, or damaged.
 */
export function validateSave(raw: unknown, world: World): SaveData | null {
  if (!isObj(raw) || raw.version !== SAVE_VERSION) return null;
  if (raw.map !== world.map.name && !world.map.compatibleSaveMaps?.includes(raw.map as string))
    return null;
  const { time, windOffsetDeg, boat, gold, activeShip: active, dockedAt } = raw;
  if (!isNum(time) || !isNum(windOffsetDeg) || !isNum(gold) || gold < 0) return null;
  if (!isObj(boat) || !isNum(boat.x) || !isNum(boat.y) || !isNum(boat.heading)) return null;
  if (!isObj(raw.ships) || typeof active !== 'string') return null;
  const ships: Record<string, UpgradeLevels> = {};
  for (const [id, levels] of Object.entries(raw.ships)) {
    const read = readLevels(levels);
    if (!SHIP_CLASSES[id] || !read) return null;
    ships[id] = read;
  }
  if (!ships[active]) return null;
  const cargo = readAmounts(raw.cargo, true);
  if (!cargo) return null;
  if (dockedAt !== null && (typeof dockedAt !== 'string' || !findPort(world.map, dockedAt))) {
    return null;
  }
  // Markets: keep the ones the map still has; a missing port just starts at its default.
  const markets: Record<string, GoodAmounts> = {};
  if (isObj(raw.markets)) {
    for (const port of world.map.ports) {
      const stock = readAmounts(raw.markets[port.id], false);
      if (stock) markets[port.id] = stock;
    }
  }
  const workshops = readWorkshops(raw.workshops, world.map);
  const settlements = readSettlements(raw.settlements, world.map);
  const difficulty = isDifficulty(raw.difficulty) ? raw.difficulty : DEFAULT_DIFFICULTY;
  return {
    version: SAVE_VERSION,
    // The map it was saved on, so applySave can tell a migrated save (always a known name here).
    map: raw.map as string,
    time,
    windOffsetDeg,
    economyPending:
      isNum(raw.economyPending) && raw.economyPending >= 0 && raw.economyPending <= time
        ? raw.economyPending
        : 0,
    boat: {
      x: boat.x,
      y: boat.y,
      heading: boat.heading,
      // A bad sail setting is not worth losing the voyage over: it just reads as unknown.
      ...(isNum(boat.sailStep) &&
      Number.isInteger(boat.sailStep) &&
      SAIL_STEPS[boat.sailStep] !== undefined
        ? { sailStep: boat.sailStep }
        : {}),
    },
    gold,
    activeShip: active,
    ships,
    cargo,
    hullDamage: readHullDamage(raw.hullDamage, ships),
    ...readLoan(raw.loan, world.map),
    dockedAt: dockedAt as string | null,
    markets,
    ...(workshops ? { workshops } : {}),
    contracts: readContracts(raw.contracts, world.map, settlements),
    progress: readProgress(raw.progress, world.map),
    settlements,
    difficulty,
    easiestDifficulty: isDifficulty(raw.easiestDifficulty) ? raw.easiestDifficulty : difficulty,
    home: readHome(raw.home, world.map),
    quests: readQuests(raw.quests, world.map),
  };
}

/**
 * Sails on resume (decision 0076): as the captain left them, except in port, where she stays
 * alongside with sails down rather than wake up under full canvas and drift off the pier.
 */
function resumeSails(boat: BoatState, saved: number | undefined, docked: boolean): void {
  const step = docked ? 0 : (saved ?? boat.sailStep);
  boat.sailStep = step;
  boat.sail = SAIL_STEPS[step]!;
}

/** Put saved progress into a freshly created world. The boat resumes at rest where it was. */
export function applySave(world: World, data: SaveData): void {
  world.time = data.time;
  world.windOffsetDeg = data.windOffsetDeg;
  world.boat = createBoat(data.boat.x, data.boat.y, wrapPositive(data.boat.heading));
  world.course.legStart = data.time;
  const trade = world.trade;
  trade.economyPending = data.economyPending ?? 0;
  trade.captain = {
    gold: data.gold,
    activeShip: data.activeShip,
    ships: data.ships,
    cargo: data.cargo,
    hullDamage: { ...(data.hullDamage ?? {}) },
    ...(data.loan ? { loan: { ...data.loan } } : {}),
  };
  // Levels first, so the markets that are open match the save before its stocks go in.
  trade.settlements = readSettlements(data.settlements, world.map);
  // A supplied town may have already consumed part of the pending batch before its timer reset.
  // Ignore impossible saved offsets rather than letting them suppress future simulation time.
  for (const town of Object.values(trade.settlements.byPort)) {
    if (town.advancedBeforeSupply !== undefined)
      town.advancedBeforeSupply = Math.min(town.advancedBeforeSupply, trade.economyPending);
  }
  // Quests next: a quest done can change what a port trades (decision 0130).
  trade.quests = readQuests(data.quests, world.map);
  syncMarketLevels(trade, world.map);
  for (const [id, stock] of Object.entries(data.markets)) {
    const market = trade.markets[id];
    if (market) market.stock = { ...stock };
  }
  // Only goods the workshop still crafts come back (decision 0146).
  for (const [id, crafted] of Object.entries(data.workshops ?? {})) {
    const workshop = trade.markets[id]?.workshop;
    if (workshop) for (const g of Object.keys(workshop) as GoodId[]) workshop[g] = crafted[g] ?? 0;
  }
  trade.dockedAt = data.dockedAt;
  if (data.contracts) trade.contracts = readContracts(data.contracts, world.map, trade.settlements);
  trade.progress = readProgress(data.progress, world.map);
  trade.easiestDifficulty = data.easiestDifficulty ?? data.difficulty ?? DEFAULT_DIFFICULTY;
  setDifficulty(trade, data.difficulty ?? DEFAULT_DIFFICULTY);
  trade.home = readHome(data.home, world.map);
  world.ship = activeShip(trade);
  // The land as this voyage's quests left it (decision 0166), but none rises on top of the boat.
  resetLand(world);
  refreshPiers(world);
  // Compatible older-map saves keep all trading progress. The coasts and ports have moved since
  // (decision 0031), so they resume at the known-clear spawn; so does a save whose position a
  // coastline now covers, rather than strand the boat on land.
  if (
    data.map !== world.map.name ||
    resolveCollisions(
      world.boat,
      world.ship.radius,
      world.land.islands,
      seaShape(world.map),
      world.land.terrain,
      world.piers,
      world.ship.draft,
    )
  ) {
    const start = world.map.start;
    world.boat = createBoat(start.x, start.y, (start.headingDeg * Math.PI) / 180);
    trade.dockedAt = null;
    syncWorldLand(world, true);
  }
  resumeSails(world.boat, data.boat.sailStep, trade.dockedAt !== null);
}

export function saveGame(storage: SaveStorage, world: World): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(serializeWorld(world)));
    return true;
  } catch {
    // Private mode or storage full: progress just won't persist.
    return false;
  }
}

/** Resume from storage if there is a valid save. Returns whether progress was restored. */
export function loadGame(storage: SaveStorage, world: World): boolean {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = validateSave(JSON.parse(raw), world);
    if (!data) return false;
    applySave(world, data);
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: SaveStorage): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
