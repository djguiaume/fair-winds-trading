import buildingsFile from '../data/buildings.json';
import { type HomeSpotDef, type IslandDesign, type PropDef, designOf } from '../data/islands';
import { TUNING } from '../data/tuning';
import type { IslandDef, MapDef } from './map';

/**
 * The home island (decisions 0120 and 0124): the captain's own island with fixed build spots.
 * Each community arc ends by offering one arc spot, where the captain picks one building of its
 * pair for free; a building passed over can come back later on a spare spot, for gold (the
 * provisional rule of 0120). Buildings carry one small modifier each. Plain data, no DOM.
 *
 * Content: the buildings, their pairs, prices and modifiers in `src/data/buildings.json`; the
 * spots in the home island's file (`homeSpots`), and where each building stands as props tagged
 * `home:<building>`; the later price factor in `economy.json` › `home`.
 */

/** What a building changes. Factors multiply; `homeStorage` and `windForecast` are amounts. */
export type EffectKind =
  | 'homeRepair'
  | 'sailUpgradePrice'
  | 'homeStorage'
  | 'helpReward'
  | 'discoverRange'
  | 'hullDamage'
  | 'windForecast'
  | 'shipPrice';

export interface BuildingDef {
  id: string;
  /** The arc spot pair it belongs to: an arc spot offers both buildings of its pair. */
  pair: string;
  /** Gold, before the later price factor; an arc's own building is free. */
  price: number;
  effect: { kind: EffectKind; value: number };
}

export const BUILDINGS: BuildingDef[] = buildingsFile.buildings as BuildingDef[];
export const BUILDING_IDS: string[] = BUILDINGS.map((b) => b.id);
export const buildingById = (id: string) => BUILDINGS.find((b) => b.id === id);

export interface HomeState {
  /** The island is the captain's (given by the prologue, decision 0122; `?home` for testing). */
  owned: boolean;
  /** Arc spots offered by a finished arc and not built yet. */
  offered: string[];
  /** Spot id → building id. */
  built: Record<string, string>;
  /** Moored at the home pier (not saved: worked out again from where she lies). */
  docked?: boolean;
}

export function createHomeState(): HomeState {
  return { owned: false, offered: [], built: {} };
}

/** The game state the home island reads and writes (a slice of `TradeState`). */
export interface HasHome {
  home: HomeState;
  captain: { gold: number };
}

export function homeIsland(map: MapDef): IslandDef | undefined {
  return map.homeIsland ? map.islands.find((i) => i.id === map.homeIsland) : undefined;
}

export function homeSpots(map: MapDef): HomeSpotDef[] {
  const island = homeIsland(map);
  return (island && designOf(island)?.homeSpots) ?? [];
}

/** A spot's position on the map. The island file's +z is the harbour side (decision 0101). */
export function spotPosition(island: IslandDef, spot: { x: number; z: number }) {
  const angle = Math.PI - (island.look?.harbourBearing ?? 0);
  const x = spot.x * island.radius,
    z = spot.z * island.radius;
  return {
    x: island.x + Math.cos(angle) * x + Math.sin(angle) * z,
    y: island.y + Math.sin(angle) * x - Math.cos(angle) * z,
  };
}

/**
 * The reward hook for the quest engine: a finished arc offers its spot (a quest reward
 * `"homeSpot": "spot-2"`). Returns false for an unknown, spare, built or already offered spot.
 */
export function offerHomeSpot(state: HasHome, map: MapDef, spotId: string): boolean {
  const spot = homeSpots(map).find((s) => s.id === spotId);
  const { home } = state;
  if (!spot?.pair || home.built[spotId] || home.offered.includes(spotId)) return false;
  home.offered.push(spotId);
  return true;
}

/** The prologue's reward: the island becomes the captain's. */
export function giveHomeIsland(state: HasHome): void {
  state.home.owned = true;
}

/** Buildings passed over: the other one of every pair whose arc spot is built. */
export function passedOver(home: HomeState, map: MapDef): BuildingDef[] {
  const placed = new Set(Object.values(home.built));
  return homeSpots(map)
    .filter((s) => s.pair && home.built[s.id])
    .flatMap((s) => BUILDINGS.filter((b) => b.pair === s.pair && !placed.has(b.id)));
}

export interface BuildChoice {
  building: BuildingDef;
  /** Gold; 0 for an arc's reward. */
  price: number;
}

/** What can be built on a spot now: the offered pair for free, or a passed-over one for gold. */
export function buildChoices(state: HasHome, map: MapDef, spotId: string): BuildChoice[] {
  const { home } = state;
  const spot = homeSpots(map).find((s) => s.id === spotId);
  if (!spot || !home.owned || home.built[spotId]) return [];
  if (spot.pair)
    return home.offered.includes(spotId)
      ? BUILDINGS.filter((b) => b.pair === spot.pair).map((building) => ({ building, price: 0 }))
      : [];
  return passedOver(home, map).map((building) => ({
    building,
    price: Math.round(building.price * TUNING.economy.home.laterPriceFactor),
  }));
}

export type BuildResult =
  { ok: true; gold: number } | { ok: false; error: 'not-offered' | 'not-enough-gold' };

export function buildOnSpot(
  state: HasHome,
  map: MapDef,
  spotId: string,
  buildingId: string,
): BuildResult {
  const choice = buildChoices(state, map, spotId).find((c) => c.building.id === buildingId);
  if (!choice) return { ok: false, error: 'not-offered' };
  if (choice.price > state.captain.gold) return { ok: false, error: 'not-enough-gold' };
  state.captain.gold -= choice.price;
  state.home.built[spotId] = buildingId;
  state.home.offered = state.home.offered.filter((s) => s !== spotId);
  return { ok: true, gold: choice.price };
}

/** Is this building standing anywhere on the island? */
export function hasBuilding(home: HomeState | undefined, buildingId: string): boolean {
  return !!home && Object.values(home.built).includes(buildingId);
}

/**
 * The value of an effect: the built building's, else `fallback` (1 for a factor, 0 for an
 * amount). Each kind belongs to one building.
 */
export function homeEffect(home: HomeState | undefined, kind: EffectKind, fallback = 1): number {
  if (!home) return fallback;
  for (const id of Object.values(home.built)) {
    const b = buildingById(id);
    if (b?.effect.kind === kind) return b.effect.value;
  }
  return fallback;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A saved home state, checked against the map; anything unknown is dropped. */
export function readHome(raw: unknown, map: MapDef): HomeState {
  const home = createHomeState();
  if (!isObj(raw)) return home;
  const spots = homeSpots(map);
  home.owned = raw.owned === true;
  if (isObj(raw.built))
    for (const spot of spots) {
      const b = buildingById(raw.built[spot.id] as string);
      if (b && (!spot.pair || b.pair === spot.pair) && !hasBuilding(home, b.id))
        home.built[spot.id] = b.id;
    }
  if (Array.isArray(raw.offered))
    home.offered = spots
      .filter((s) => s.pair && !home.built[s.id] && (raw.offered as unknown[]).includes(s.id))
      .map((s) => s.id);
  return home;
}

/**
 * The island file as it stands for a home state: each building's props (`home:<building>`) on
 * its arc spot, or moved to the spare spot it was built on; run-down props (`home-empty:<spot>`)
 * only while their spot is empty. With no state, the island as the captain first finds it.
 */
export function homeDesign(design: IslandDesign, built: Record<string, string> = {}): IslandDesign {
  const spots = design.homeSpots;
  if (!spots?.length) return design;
  const at = new Map(Object.entries(built).map(([spot, b]) => [b, spot]));
  const props: PropDef[] = [];
  for (const prop of design.props) {
    const tags = prop.tags ?? [];
    const empty = tags.find((t) => t.startsWith('home-empty:'));
    if (empty && built[empty.slice('home-empty:'.length)]) continue;
    const owner = tags.find((t) => t.startsWith('home:'));
    if (!owner) {
      props.push(prop);
      continue;
    }
    const spotId = at.get(owner.slice('home:'.length));
    const spot = spots.find((s) => s.id === spotId);
    if (!spot) continue;
    // Its own arc spot, or a spare: the same model, moved from its arc spot by the same offset.
    const arc = spots.find((s) => s.pair && s.pair === buildingById(built[spot.id]!)?.pair) ?? spot;
    props.push({
      ...prop,
      x: prop.x - arc.x + spot.x,
      z: prop.z - arc.z + spot.z,
      ...(spot.y !== undefined ? { y: spot.y } : {}),
    });
  }
  return { ...design, props };
}
