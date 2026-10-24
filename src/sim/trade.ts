import { TUNING } from '../data/tuning';
import type { QuestState } from './quests';
import { islandCoasts } from './islandLayout';
import { piersOf, PIER_HALF_WIDTH } from './collision';
import { hullFootprint, hullRadius, hullSegmentGap, hullCoastGap } from './harbourDistance';
import { coastDistance } from './coast';
import { type ContractState, createContracts, stepContracts, syncHelpOrder } from './contracts';
import { type Difficulty, DEFAULT_DIFFICULTY, easier, knobs } from './difficulty';
import { leakFactor } from './hazards';
import { type HomeState, createHomeState, ownedIslands } from './home';
import { applyPerks } from './perks';
import { GOODS, type GoodAmounts, type GoodId, emptyAmounts, totalAmount } from './goods';
import type { MapDef, PortDef } from './map';
import {
  type Market,
  available,
  createMarket,
  quoteBuy,
  quoteSell,
  setMarketLevel,
  stepMarket,
  takeStock,
  trades,
  workshopReceives,
} from './market';
import { createRng } from './rng';
import {
  type LevelUp,
  type SettlementState,
  addGrowth,
  addRare,
  createSettlements,
  madeGoods,
  hasPendingSupply,
  DEFAULT_START_LEVEL,
  portNow,
  settlementLevel,
  stepSettlements,
  upgradeNeedsLevel,
  wantsAt,
} from './settlement';
import { SHIP_CLASSES, type ShipClass } from './ship';
import {
  type ShipyardProgress,
  createProgress,
  discoverNear,
  homePort,
  isFounded,
  shipOffer,
} from './shipyards';
import { townLevels } from './founding';
import {
  type UpgradeLevels,
  type UpgradeTrack,
  effectiveShip,
  holdCapacity,
  hullDurability,
  stockLevels,
  upgradePrice,
} from './upgrades';

/**
 * Phase 1 trading (decision 0015): the captain's gold, ships and cargo, every port's market, and
 * which port the boat is docked at. Plain data so it saves as JSON; no rendering, no DOM.
 */

/*
 * `src/data/tuning/seamanship.json` › `harbour` (decision 0094): `dockRange`, the maximum
 * hull-to-shore/pier gap, with two extra units for forgiving approaches; dock below `dockSpeedKn`
 * (lower the sails near a port to dock); leave the port once `undockMargin` farther than the dock
 * range (avoids flicker at the edge). Gold at the start is the difficulty level's `startGold`.
 */
const harbour = () => TUNING.seamanship.harbour;

export interface Captain {
  gold: number;
  /** Class id of the ship being sailed. */
  activeShip: string;
  /** Owned ship classes and their upgrade levels (one active ship in Phase 1). */
  ships: Record<string, UpgradeLevels>;
  cargo: GoodAmounts;
  /** Hull points lost to reef strikes, per owned ship class (decision 0032). */
  hullDamage: Record<string, number>;
}

export interface TradeState {
  /** Simulated seconds awaiting the next economy tick. Undefined forces an initial tick. */
  economyPending?: number;
  captain: Captain;
  markets: Record<string, Market>;
  /** Port id the boat is docked at, or null at sea. */
  dockedAt: string | null;
  /** Delivery orders posted by the ports (decision 0028). */
  contracts: ContractState;
  /** Ports on the chart and standing with each shipwright (decision 0048). */
  progress: ShipyardProgress;
  /** Each port's settlement level and growth (decision 0059). */
  settlements: SettlementState;
  /** Difficulty level of the voyage (decision 0083): costs and pace, never the sailing. */
  difficulty: Difficulty;
  /** Easiest level played on this voyage, for racing missions and best times later. */
  easiestDifficulty: Difficulty;
  /** The captain's own island and what stands on it (decision 0126). */
  home: HomeState;
  /** Progress of the quests (decision 0125). */
  quests: QuestState;
}

export type TradeError =
  | 'not-docked'
  | 'bad-quantity'
  | 'not-enough-gold'
  | 'hold-full'
  | 'out-of-stock'
  | 'not-in-hold'
  | 'max-level'
  | 'already-owned'
  | 'not-owned'
  | 'unknown-ship'
  | 'cargo-too-big'
  | 'not-home-port'
  | 'not-at-yard'
  | 'ship-locked'
  | 'port-too-small'
  | 'not-traded';

export type TradeResult = { ok: true; gold: number } | { ok: false; error: TradeError };

const fail = (error: TradeError): TradeResult => ({ ok: false, error });

export function createTradeState(map: MapDef, startShip: ShipClass): TradeState {
  const rng = createRng(map.seed ^ 0x7ade);
  const settlements = createSettlements(map);
  const markets: Record<string, Market> = {};
  for (const port of map.ports)
    markets[port.id] = createMarket(
      port,
      rng,
      settlements.byPort[port.id]!.level,
      madeGoods(map, { settlements }),
    );
  return {
    captain: {
      gold: knobs(undefined).startGold,
      activeShip: startShip.id,
      ships: { [startShip.id]: stockLevels() },
      cargo: emptyAmounts(),
      hullDamage: {},
    },
    markets,
    dockedAt: null,
    contracts: createContracts(map),
    progress: createProgress(map),
    settlements,
    difficulty: DEFAULT_DIFFICULTY,
    easiestDifficulty: DEFAULT_DIFFICULTY,
    home: createHomeState(),
    quests: { byId: {} },
  };
}

/**
 * Change the voyage's difficulty (decision 0083). Takes effect at once: prices, damage, repairs
 * and growth use the new level; orders already posted keep their reward; nothing is refunded.
 */
export function setDifficulty(trade: TradeState, difficulty: Difficulty): void {
  trade.difficulty = difficulty;
  trade.easiestDifficulty = easier(trade.easiestDifficulty, difficulty);
  const { spread } = knobs(difficulty);
  for (const m of Object.values(trade.markets)) m.spread = spread;
}

/**
 * Start a fresh voyage on `difficulty`: the level's start gold, and it counts as the easiest
 * level played so far.
 */
export function startVoyage(trade: TradeState, difficulty: Difficulty): void {
  trade.easiestDifficulty = difficulty;
  setDifficulty(trade, difficulty);
  trade.captain.gold = knobs(difficulty).startGold;
}

/** Bring every market's demand in line with its settlement level (after a level-up or a load). */
export function syncMarketLevels(trade: TradeState, map: MapDef): void {
  const made = madeGoods(map, trade);
  for (const port of map.ports) {
    const market = trade.markets[port.id];
    if (market) setMarketLevel(market, portNow(port, trade), settlementLevel(trade, port.id), made);
  }
}

/** What the boat simulation should sail: the active class with its upgrades. */
export function activeShip(trade: TradeState): ShipClass {
  const { captain } = trade;
  const base = SHIP_CLASSES[captain.activeShip]!;
  const ship = effectiveShip(base, captain.ships[captain.activeShip] ?? stockLevels());
  // A damaged hull leaks and sails slower until repaired (decision 0032).
  const damage = captain.hullDamage[captain.activeShip] ?? 0;
  if (damage <= 0) return ship;
  const durability = hullDurability(captain.ships[captain.activeShip] ?? stockLevels());
  return {
    ...ship,
    speedRatio: ship.speedRatio * leakFactor(Math.max(0, 1 - damage / durability)),
  };
}

export function capacity(trade: TradeState): number {
  const { captain } = trade;
  return holdCapacity(SHIP_CLASSES[captain.activeShip]!, captain.ships[captain.activeShip]!);
}

/** Goods aboard, plus the quest cargo (decision 0125), which takes room but cannot be sold. */
export function cargoUsed(trade: TradeState): number {
  return totalAmount(trade.captain.cargo) + (trade.quests.hold ?? 0);
}

export function freeSpace(trade: TradeState): number {
  return capacity(trade) - cargoUsed(trade);
}

export function findPort(map: MapDef, portId: string): PortDef | undefined {
  return map.ports.find((p) => p.id === portId);
}

// Map geometry is static; only a settlement's level changes its piers.
const harbours = new WeakMap<
  MapDef,
  Map<
    string,
    {
      coasts: ReturnType<typeof islandCoasts>;
      piers: ReturnType<typeof piersOf>;
      reach: number;
    }
  >
>();

/** Gap from the oriented, rendered hull to this port's shore or any solid pier. */
export function distanceToPort(
  map: MapDef,
  pos: { x: number; y: number; heading?: number },
  port: PortDef,
  level = port.level ?? DEFAULT_START_LEVEL,
  shipId = 'sloop',
  maxGap = Infinity,
) {
  const island = map.islands.find((i) => i.id === port.islandId);
  if (!island) return Infinity;
  let cache = harbours.get(map);
  if (!cache) harbours.set(map, (cache = new Map()));
  const key = `${port.id}/${level}`;
  let geometry = cache.get(key);
  if (!geometry) {
    const coasts = islandCoasts(island);
    const piers = piersOf(map, { [port.id]: level }).filter(
      (p) => p.islandId === island.id && !p.boat,
    );
    const reach = Math.max(
      coasts ? 0 : island.radius,
      ...(coasts ?? []).flatMap((coast) =>
        coast.map(([x, y]) => Math.hypot(x - island.x, y - island.y)),
      ),
      ...piers.flatMap((p) => [
        Math.hypot(p.x0 - island.x, p.y0 - island.y) + (p.halfWidth ?? PIER_HALF_WIDTH),
        Math.hypot(p.x1 - island.x, p.y1 - island.y) + (p.halfWidth ?? PIER_HALF_WIDTH),
      ]),
    );
    geometry = { coasts, piers, reach };
    cache.set(key, geometry);
  }
  const hullReach = hullRadius(shipId);
  // Allow for roundoff when rotating and translating the hull into world coordinates.
  const roundoff = 16 * Number.EPSILON * Math.max(1, Math.abs(pos.x), Math.abs(pos.y), hullReach);
  // A conservative enclosing circle can only reject a harbour that is certainly too far.
  if (
    Math.hypot(pos.x - island.x, pos.y - island.y) - geometry.reach - hullReach >
    maxGap + roundoff
  )
    return Infinity;
  const hull = hullFootprint(pos, shipId);
  const { coasts, piers } = geometry;
  const shore = coasts
    ? Math.min(...coasts.map((coast) => hullCoastGap(hull, coast)))
    : Math.max(0, coastDistance(island.x, island.y, hull).distance - island.radius);
  return Math.min(
    shore,
    ...piers.map((p) =>
      Math.max(
        0,
        hullSegmentGap(hull, [p.x0, p.y0], [p.x1, p.y1]) - (p.halfWidth ?? PIER_HALF_WIDTH),
      ),
    ),
  );
}

/** The nearest port within docking range of `pos`, if any. */
export function portInRange(
  map: MapDef,
  pos: { x: number; y: number; heading?: number },
  range = harbour().dockRange,
  levels: Record<string, number> = {},
  shipId = 'sloop',
) {
  let best: PortDef | null = null;
  let bestD = range;
  for (const port of map.ports) {
    const level = levels[port.id] ?? (port.site ? 0 : (port.level ?? DEFAULT_START_LEVEL));
    // Level 0: an empty island not founded yet, with no harbour (decision 0157).
    if (level === 0) continue;
    const d = distanceToPort(map, pos, port, level, shipId, bestD);
    if (d <= bestD) {
      best = port;
      bestD = d;
    }
  }
  return best;
}

/** Explicit and automatic docking share the same range/speed validation. */
export function tryDock(
  trade: TradeState,
  map: MapDef,
  boat: { x: number; y: number; speedKn: number; heading?: number },
  portId: string,
): boolean {
  const port = findPort(map, portId);
  if (
    !port ||
    !isFounded(trade, port) ||
    boat.speedKn >= harbour().dockSpeedKn ||
    distanceToPort(
      map,
      boat,
      port,
      settlementLevel(trade, port.id),
      activeShip(trade).id,
      harbour().dockRange,
    ) > harbour().dockRange
  )
    return false;
  if (trade.dockedAt && trade.dockedAt !== portId) return false;
  trade.dockedAt = portId;
  return true;
}

export type DockEvent =
  | { type: 'docked'; portId: string }
  | { type: 'undocked'; portId: string }
  | { type: 'discovered'; portId: string }
  | { type: 'help-order'; portId: string }
  | { type: 'home-docked'; islandId: string }
  | { type: 'home-undocked'; islandId: string }
  | LevelUp;

/**
 * Advance markets and docking by `dt`. Docking happens when the boat is close to a port and
 * slow; it ends when the boat sails away.
 */
export function stepTrade(
  trade: TradeState,
  map: MapDef,
  boat: { x: number; y: number; speedKn: number; heading?: number },
  dt: number,
): DockEvent[] {
  const events: DockEvent[] = [];
  const initial = trade.economyPending === undefined;
  trade.economyPending = (trade.economyPending ?? 0) + dt;
  for (const port of discoverNear(trade, map, boat))
    events.push({ type: 'discovered', portId: port.id });
  if (trade.dockedAt) {
    const port = findPort(map, trade.dockedAt);
    if (
      !port ||
      distanceToPort(
        map,
        boat,
        port,
        settlementLevel(trade, port.id),
        activeShip(trade).id,
        harbour().dockRange + harbour().undockMargin,
      ) >
        harbour().dockRange + harbour().undockMargin
    ) {
      events.push({ type: 'undocked', portId: trade.dockedAt });
      trade.dockedAt = null;
    }
  }
  events.push(...stepHomeDock(trade, map, boat));
  if (!trade.dockedAt && !trade.home.docked && boat.speedKn < harbour().dockSpeedKn) {
    const port = portInRange(
      map,
      boat,
      harbour().dockRange,
      townLevels(map, trade),
      activeShip(trade).id,
    );
    if (port && tryDock(trade, map, boat, port.id)) {
      events.push({ type: 'docked', portId: port.id });
    }
  }
  // Docking and discovery remain at sailing cadence. Flush before a newly docked player can
  // inspect prices or trade; elapsed simulation time is never discarded or wall-clock driven.
  if (
    initial ||
    trade.dockedAt !== null ||
    hasPendingSupply(trade.settlements) ||
    trade.economyPending + Number.EPSILON >= TUNING.economy.updateSeconds
  ) {
    events.unshift(...flushEconomy(trade, map));
  }
  return events;
}

/**
 * The pier of one of the captain's islands (decisions 0126, 0128), its distance worked out like
 * a port's. A stand-in port record: a home island has no market, orders or town.
 */
function homeHarbour(map: MapDef, islandId: string): PortDef | null {
  const island = map.islands.find((i) => i.id === islandId);
  return island
    ? {
        id: `home:${island.id}`,
        name: island.name ?? island.id,
        islandId: island.id,
        produces: [],
        wants: [],
      }
    : null;
}

/** The island of hers whose pier she is within docking range of, if any. */
export function homeInRange(
  trade: TradeState,
  map: MapDef,
  pos: { x: number; y: number; heading?: number },
  range = harbour().dockRange,
): string | null {
  for (const id of ownedIslands(trade.home)) {
    const pier = homeHarbour(map, id);
    if (pier && distanceToPort(map, pos, pier, 1, activeShip(trade).id, range) <= range) return id;
  }
  return null;
}

/** Moor at a home pier when slow alongside, cast off when she sails away. */
function stepHomeDock(
  trade: TradeState,
  map: MapDef,
  boat: { x: number; y: number; speedKn: number; heading?: number },
): DockEvent[] {
  const { home } = trade;
  if (home.docked) {
    const islandId = home.docked;
    const near = homeInRange(trade, map, boat, harbour().dockRange + harbour().undockMargin);
    if (near === islandId) return [];
    delete home.docked;
    return [{ type: 'home-undocked', islandId }];
  }
  const islandId =
    trade.dockedAt || boat.speedKn >= harbour().dockSpeedKn ? null : homeInRange(trade, map, boat);
  if (!islandId) return [];
  home.docked = islandId;
  return [{ type: 'home-docked', islandId }];
}

/** A sail upgrade's price, less the rigging loft's share (decision 0126). */
export function upgradeCost(trade: TradeState, price: number, track: UpgradeTrack): number {
  return track === 'sails' ? Math.round(applyPerks(trade.home, 'sailUpgradePrice', price)) : price;
}

/** A new ship's price, less the boathouse's share (decision 0126). */
export function shipCost(trade: TradeState, cls: ShipClass): number {
  return Math.round(applyPerks(trade.home, 'shipPrice', cls.price));
}

/** Apply all elapsed economy time before a paused dock panel opens, returning its events. */
export function flushEconomy(trade: TradeState, map: MapDef): DockEvent[] {
  const dt = trade.economyPending ?? 0;
  trade.economyPending = 0;
  const events: DockEvent[] = [];
  for (const market of Object.values(trade.markets)) stepMarket(market, dt);
  stepContracts(trade.contracts, dt);
  // Towns that got enough goods grow a level: deeper demand from now on (decision 0059), and a
  // new town's specialty opens a market at the ports that buy it (0063).
  const ups = stepSettlements(trade, dt, map);
  if (ups.length) syncMarketLevels(trade, map);
  events.push(...ups);
  // A neglected town (or the home port holding back an upgrade) asks for help (decision 0069).
  const help = syncHelpOrder(map, trade);
  if (help) events.push({ type: 'help-order', portId: help });
  return events;
}

function dockedMarket(trade: TradeState): Market | null {
  return trade.dockedAt ? (trade.markets[trade.dockedAt] ?? null) : null;
}

/** Most units of `good` the captain can buy here now (stock, hold space and gold). */
export function maxBuy(trade: TradeState, good: GoodId): number {
  const market = dockedMarket(trade);
  if (!market) return 0;
  let n = Math.min(available(market, good), freeSpace(trade));
  while (n > 0 && quoteBuy(market, good, n) > trade.captain.gold) n--;
  return n;
}

/** Buy `qty` units at the docked port. All or nothing; `gold` is the amount paid. */
export function buy(trade: TradeState, good: GoodId, qty: number): TradeResult {
  const market = dockedMarket(trade);
  if (!market) return fail('not-docked');
  if (!Number.isInteger(qty) || qty <= 0) return fail('bad-quantity');
  if (qty > available(market, good)) return fail('out-of-stock');
  if (qty > freeSpace(trade)) return fail('hold-full');
  const cost = quoteBuy(market, good, qty);
  if (cost > trade.captain.gold) return fail('not-enough-gold');
  trade.captain.gold -= cost;
  trade.captain.cargo[good] += qty;
  takeStock(market, good, qty);
  return { ok: true, gold: cost };
}

/**
 * Sell `qty` units from the hold at the docked port; `gold` is the amount received. Goods the town
 * wants also help it grow (decision 0059); pass the map so it knows what the town wants.
 */
export function sell(trade: TradeState, good: GoodId, qty: number, map?: MapDef): TradeResult {
  const market = dockedMarket(trade);
  if (!market) return fail('not-docked');
  if (!Number.isInteger(qty) || qty <= 0) return fail('bad-quantity');
  if (qty > trade.captain.cargo[good]) return fail('not-in-hold');
  if (!trades(market, good)) return fail('not-traded');
  const income = quoteSell(market, good, qty);
  trade.captain.gold += income;
  trade.captain.cargo[good] -= qty;
  market.stock[good] += qty;
  workshopReceives(market, good, qty);
  if (map && wantsAt(map, trade, market.portId).includes(good)) {
    addGrowth(trade, market.portId, qty);
    addRare(trade, market.portId, good, qty);
  }
  return { ok: true, gold: income };
}

/** Sell everything in the hold at the docked port. */
export function sellAll(trade: TradeState, map?: MapDef): TradeResult {
  if (!dockedMarket(trade)) return fail('not-docked');
  let gold = 0;
  for (const g of GOODS) {
    const qty = trade.captain.cargo[g];
    if (qty > 0) {
      const r = sell(trade, g, qty, map);
      if (r.ok) gold += r.gold;
    }
  }
  return { ok: true, gold };
}

/** Whether the home port is big enough to fit upgrade level `to` (decision 0059). */
export function upgradeAllowed(trade: TradeState, map: MapDef, to: number): boolean {
  return settlementLevel(trade, homePort(map).id) >= upgradeNeedsLevel(to);
}

/** Raise one upgrade track of the active ship by a level (home port only, decision 0048). */
export function buyUpgrade(trade: TradeState, map: MapDef, track: UpgradeTrack): TradeResult {
  if (!trade.dockedAt) return fail('not-docked');
  if (trade.dockedAt !== homePort(map).id) return fail('not-home-port');
  const { captain } = trade;
  const base = SHIP_CLASSES[captain.activeShip]!;
  const levels = captain.ships[captain.activeShip]!;
  const listed = upgradePrice(base, levels, track);
  if (listed === null) return fail('max-level');
  const price = upgradeCost(trade, listed, track);
  if (!upgradeAllowed(trade, map, levels[track] + 1)) return fail('port-too-small');
  if (price > captain.gold) return fail('not-enough-gold');
  captain.gold -= price;
  levels[track] += 1;
  return { ok: true, gold: price };
}

/**
 * Buy a new ship class from the shipwright that builds it and sail it from now on (cargo moves
 * across if it fits; the old ship waits at the home port). Needs enough standing there
 * (decision 0048).
 */
export function buyShip(trade: TradeState, map: MapDef, classId: string): TradeResult {
  if (!trade.dockedAt) return fail('not-docked');
  const cls = SHIP_CLASSES[classId];
  if (!cls) return fail('unknown-ship');
  const { captain } = trade;
  if (captain.ships[classId]) return fail('already-owned');
  const offer = shipOffer(trade, map, classId);
  if (offer.status === 'no-yard') return fail('unknown-ship');
  if (offer.yard?.id !== trade.dockedAt) return fail('not-at-yard');
  if (offer.status !== 'for-sale') return fail('ship-locked');
  const price = shipCost(trade, cls);
  if (price > captain.gold) return fail('not-enough-gold');
  if (cargoUsed(trade) > holdCapacity(cls, stockLevels())) return fail('cargo-too-big');
  captain.gold -= price;
  captain.ships[classId] = stockLevels();
  captain.activeShip = classId;
  return { ok: true, gold: price };
}

/** Switch to another owned ship at the home port (the cargo moves across, so it must fit). */
export function switchShip(trade: TradeState, map: MapDef, classId: string): TradeResult {
  if (!trade.dockedAt) return fail('not-docked');
  if (trade.dockedAt !== homePort(map).id) return fail('not-home-port');
  const cls = SHIP_CLASSES[classId];
  const levels = trade.captain.ships[classId];
  if (!cls || !levels) return fail('not-owned');
  if (cargoUsed(trade) > holdCapacity(cls, levels)) return fail('cargo-too-big');
  trade.captain.activeShip = classId;
  return { ok: true, gold: 0 };
}
