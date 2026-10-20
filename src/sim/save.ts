import { createBoat } from './boat';
import { type ContractState, readContracts } from './contracts';
import { resolveCollisions } from './collision';
import { GOODS, type GoodAmounts, emptyAmounts } from './goods';
import { wrapPositive } from './math';
import { SHIP_CLASSES } from './ship';
import { type ShipyardProgress, readProgress } from './shipyards';
import { activeShip, findPort } from './trade';
import { MAX_UPGRADE_LEVEL, UPGRADE_TRACKS, type UpgradeLevels, hullDurability } from './upgrades';
import type { World } from './world';

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
  windOffsetDeg: number;
  boat: { x: number; y: number; heading: number };
  gold: number;
  activeShip: string;
  ships: Record<string, UpgradeLevels>;
  cargo: GoodAmounts;
  /** Hull damage per ship (decision 0032). Optional: older saves have sound hulls. */
  hullDamage?: Record<string, number>;
  dockedAt: string | null;
  /** Port id → current stock per good. */
  markets: Record<string, GoodAmounts>;
  /** Delivery orders (decision 0028). Optional: older saves get fresh orders. */
  contracts?: ContractState;
  /** Discovered ports and shipwright standing (decision 0048). Optional: older saves start fresh. */
  progress?: ShipyardProgress;
}

/** The subset of the Web Storage API the save needs. */
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function serializeWorld(world: World): SaveData {
  const { captain, markets, dockedAt } = world.trade;
  const stocks: Record<string, GoodAmounts> = {};
  for (const [id, m] of Object.entries(markets)) stocks[id] = { ...m.stock };
  const ships: Record<string, UpgradeLevels> = {};
  for (const [id, levels] of Object.entries(captain.ships)) ships[id] = { ...levels };
  return {
    version: SAVE_VERSION,
    map: world.map.name,
    time: world.time,
    windOffsetDeg: world.windOffsetDeg,
    boat: { x: world.boat.x, y: world.boat.y, heading: world.boat.heading },
    gold: captain.gold,
    activeShip: captain.activeShip,
    ships,
    cargo: { ...captain.cargo },
    hullDamage: { ...captain.hullDamage },
    dockedAt,
    markets: stocks,
    contracts: structuredClone(world.trade.contracts),
    progress: structuredClone(world.trade.progress),
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
  return {
    version: SAVE_VERSION,
    // The map it was saved on, so applySave can tell a migrated save (always a known name here).
    map: raw.map as string,
    time,
    windOffsetDeg,
    boat: { x: boat.x, y: boat.y, heading: boat.heading },
    gold,
    activeShip: active,
    ships,
    cargo,
    hullDamage: readHullDamage(raw.hullDamage, ships),
    dockedAt: dockedAt as string | null,
    markets,
    contracts: readContracts(raw.contracts, world.map),
    progress: readProgress(raw.progress, world.map),
  };
}

/** Put saved progress into a freshly created world. The boat resumes at rest where it was. */
export function applySave(world: World, data: SaveData): void {
  world.time = data.time;
  world.windOffsetDeg = data.windOffsetDeg;
  world.boat = createBoat(data.boat.x, data.boat.y, wrapPositive(data.boat.heading));
  world.course.legStart = data.time;
  const trade = world.trade;
  trade.captain = {
    gold: data.gold,
    activeShip: data.activeShip,
    ships: data.ships,
    cargo: data.cargo,
    hullDamage: { ...(data.hullDamage ?? {}) },
  };
  for (const [id, stock] of Object.entries(data.markets)) {
    const market = trade.markets[id];
    if (market) market.stock = { ...stock };
  }
  trade.dockedAt = data.dockedAt;
  if (data.contracts) trade.contracts = readContracts(data.contracts, world.map);
  trade.progress = readProgress(data.progress, world.map);
  world.ship = activeShip(trade);
  // Compatible older-map saves keep all trading progress. The coasts and ports have moved since
  // (decision 0031), so they resume at the known-clear spawn; so does a save whose position a
  // coastline now covers, rather than strand the boat on land.
  if (
    data.map !== world.map.name ||
    resolveCollisions(
      world.boat,
      world.ship.radius,
      world.map.islands,
      world.map.boundsRadius,
      world.map.terrain,
      world.piers,
    )
  ) {
    const start = world.map.start;
    world.boat = createBoat(start.x, start.y, (start.headingDeg * Math.PI) / 180);
    trade.dockedAt = null;
  }
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
