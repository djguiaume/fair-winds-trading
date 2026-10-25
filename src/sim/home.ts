import buildingsFile from '../data/buildings.json';
import { type HomeSpotDef, type IslandDesign, type PropDef, designOf } from '../data/islands';
import { TUNING } from '../data/tuning';
import { GOODS, type GoodId } from './goods';
import type { IslandDef, MapDef } from './map';

/**
 * The home islands (decisions 0120, 0126 and 0128): the captain's own islands with fixed build
 * spots, the home island of the base game and any island with spots in its file (extensions).
 * Each community arc ends by offering one arc spot, where the captain picks one building of its
 * pair for free; a building passed over can come back later on a spare spot, for gold (the
 * provisional rule of 0120). Buildings carry small perks (`perks.ts`, decision 0136). Plain
 * data, no DOM.
 *
 * Content: the buildings, their pairs, prices and perk ids in `src/data/buildings.json`, the
 * perks in `src/data/perks.json`; the
 * spots in the home island's file (`homeSpots`), and where each building stands as props tagged
 * `home:<building>`; the later price factor in `economy.json` › `home`.
 */

export interface BuildingDef {
  id: string;
  /** The arc spot pair it belongs to: an arc spot offers both buildings of its pair. */
  pair: string;
  /** Gold, before the later price factor; an arc's own building is free. */
  price: number;
  /** Perk ids from `src/data/perks.json`. */
  perks: string[];
}

export const BUILDINGS: BuildingDef[] = buildingsFile.buildings as BuildingDef[];

/**
 * How a plot with no building shows on the island (decision 0210): staked with a pennant and its
 * numbered sign when the captain can build there (`open`), short stakes for a plot still to be
 * given (`bare`), and the ring on the ground while the Island tab has it chosen (`chosen`). Prop
 * types from `buildings.json` › `plots`.
 */
export type PlotState = 'open' | 'bare' | 'chosen';
export const PLOT_PROPS: Record<PlotState, string> = buildingsFile.plots;
/**
 * The camera on a chosen plot: its zoom, and how far off centre the plot sits beside the half
 * screen (screen fractions: left of centre in landscape, above it in portrait).
 */
export const PLOT_CAMERA: { zoom: number; side: number; top: number } = buildingsFile.plotCamera;
/** A plot's state in a home look, where a built spot holds its building id. */
const PLOT = 'plot:';
const plotOf = (v: string | undefined): PlotState | null =>
  v?.startsWith(PLOT) ? (v.slice(PLOT.length) as PlotState) : null;
const isBuilding = (v: string | undefined) => !!v && !v.startsWith(PLOT);
export const BUILDING_IDS: string[] = BUILDINGS.map((b) => b.id);
export const buildingById = (id: string) => BUILDINGS.find((b) => b.id === id);

/** One island the captain can build on. */
export interface IslandHome {
  /** The island is the captain's (the prologue gives the home island, decision 0122). */
  owned: boolean;
  /** Arc spots offered by a finished arc and not built yet. */
  offered: string[];
  /** Spot id → building id. */
  built: Record<string, string>;
  /** Crates kept in its warehouse between voyages (decision 0136); none: left out. */
  stored?: Partial<Record<GoodId, number>>;
}

/**
 * Every island with build spots in its file can be the captain's (decision 0128): the home island
 * of the base game, more islands in extensions. Each keeps its own spots and buildings.
 */
export interface HomeState {
  /** Island id → its state; an island not listed is not the captain's. */
  islands: Record<string, IslandHome>;
  /** Island id of the pier she is moored at (not saved: worked out again from where she lies). */
  docked?: string;
}

export function createHomeState(): HomeState {
  return { islands: {} };
}

const emptyIsland = (): IslandHome => ({ owned: false, offered: [], built: {} });

/** The game state the home islands read and write (a slice of `TradeState`). */
export interface HasHome {
  home: HomeState;
  captain: { gold: number };
}

/** The map's home island: the one the prologue gives, and the default of quest rewards. */
export function homeIsland(map: MapDef): IslandDef | undefined {
  return map.homeIsland ? map.islands.find((i) => i.id === map.homeIsland) : undefined;
}

/** Every island whose file has build spots, in map order. */
export function buildableIslands(map: MapDef): IslandDef[] {
  return map.islands.filter((i) => !!designOf(i)?.homeSpots?.length);
}

/** An island's build spots (default: the home island's). */
export function homeSpots(map: MapDef, islandId = map.homeIsland): HomeSpotDef[] {
  const island = map.islands.find((i) => i.id === islandId);
  return (island && designOf(island)?.homeSpots) ?? [];
}

/** An island's state, or an empty one (not the captain's). */
export function islandHome(home: HomeState | undefined, islandId: string | undefined): IslandHome {
  return (islandId && home?.islands[islandId]) || emptyIsland();
}

/** The islands that are the captain's. */
export function ownedIslands(home: HomeState | undefined): string[] {
  return Object.entries(home?.islands ?? {})
    .filter(([, h]) => h.owned)
    .map(([id]) => id);
}

function writable(home: HomeState, islandId: string): IslandHome {
  return (home.islands[islandId] ??= emptyIsland());
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
 * A spot named in a quest: `spot-2` on the home island, or `<island>:spot-2` on another one.
 * Null when the island has no such arc spot.
 */
export function resolveSpot(map: MapDef, ref: unknown): { island: string; spot: string } | null {
  if (typeof ref !== 'string') return null;
  const at = ref.lastIndexOf(':');
  const island = at < 0 ? map.homeIsland : ref.slice(0, at);
  const spot = at < 0 ? ref : ref.slice(at + 1);
  return island && homeSpots(map, island).some((s) => s.id === spot && s.pair)
    ? { island, spot }
    : null;
}

/**
 * The reward hook for the quest engine: a finished arc offers its spot (a quest reward
 * `"homeSpot": ["spot-2"]`). Returns false for an unknown, spare, built or already offered spot.
 */
export function offerHomeSpot(
  state: HasHome,
  map: MapDef,
  spotId: string,
  islandId = map.homeIsland,
): boolean {
  if (!islandId) return false;
  const spot = homeSpots(map, islandId).find((s) => s.id === spotId);
  const current = islandHome(state.home, islandId);
  if (!spot?.pair || current.built[spotId] || current.offered.includes(spotId)) return false;
  writable(state.home, islandId).offered.push(spotId);
  return true;
}

/** The prologue's reward: the island (default: the home island) becomes the captain's. */
export function giveHomeIsland(state: HasHome, map: MapDef, islandId = map.homeIsland): boolean {
  if (!islandId || !homeSpots(map, islandId).length) return false;
  writable(state.home, islandId).owned = true;
  return true;
}

/** Buildings passed over on an island: the other one of every pair whose arc spot is built. */
export function passedOver(home: HomeState, map: MapDef, islandId = map.homeIsland): BuildingDef[] {
  const { built } = islandHome(home, islandId);
  const placed = new Set(Object.values(built));
  return homeSpots(map, islandId)
    .filter((s) => s.pair && built[s.id])
    .flatMap((s) => BUILDINGS.filter((b) => b.pair === s.pair && !placed.has(b.id)));
}

export interface BuildChoice {
  building: BuildingDef;
  /** Gold; 0 for an arc's reward. */
  price: number;
}

/** What can be built on a spot now: the offered pair for free, or a passed-over one for gold. */
export function buildChoices(
  state: HasHome,
  map: MapDef,
  spotId: string,
  islandId = map.homeIsland,
): BuildChoice[] {
  const current = islandHome(state.home, islandId);
  const spot = homeSpots(map, islandId).find((s) => s.id === spotId);
  if (!spot || !current.owned || current.built[spotId]) return [];
  if (spot.pair)
    return current.offered.includes(spotId)
      ? BUILDINGS.filter((b) => b.pair === spot.pair).map((building) => ({ building, price: 0 }))
      : [];
  return passedOver(state.home, map, islandId).map((building) => ({
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
  islandId = map.homeIsland,
): BuildResult {
  const choice = buildChoices(state, map, spotId, islandId).find(
    (c) => c.building.id === buildingId,
  );
  if (!choice || !islandId) return { ok: false, error: 'not-offered' };
  if (choice.price > state.captain.gold) return { ok: false, error: 'not-enough-gold' };
  state.captain.gold -= choice.price;
  const current = writable(state.home, islandId);
  current.built[spotId] = buildingId;
  current.offered = current.offered.filter((s) => s !== spotId);
  return { ok: true, gold: choice.price };
}

/** Is this building standing on one of the captain's islands (or on `islandId`)? */
export function hasBuilding(
  home: HomeState | undefined,
  buildingId: string,
  islandId?: string,
): boolean {
  const ids = islandId ? [islandId] : ownedIslands(home);
  return ids.some((id) => Object.values(islandHome(home, id).built).includes(buildingId));
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function readIsland(raw: unknown, map: MapDef, islandId: string): IslandHome | null {
  if (!isObj(raw)) return null;
  const spots = homeSpots(map, islandId);
  if (!spots.length) return null;
  const out = emptyIsland();
  out.owned = raw.owned === true;
  if (isObj(raw.built))
    for (const spot of spots) {
      const b = buildingById(raw.built[spot.id] as string);
      if (b && (!spot.pair || b.pair === spot.pair) && !Object.values(out.built).includes(b.id))
        out.built[spot.id] = b.id;
    }
  if (Array.isArray(raw.offered))
    out.offered = spots
      .filter((s) => s.pair && !out.built[s.id] && (raw.offered as unknown[]).includes(s.id))
      .map((s) => s.id);
  if (isObj(raw.stored)) {
    const stored: Partial<Record<GoodId, number>> = {};
    for (const g of GOODS) {
      const n = raw.stored[g];
      if (typeof n === 'number' && Number.isInteger(n) && n > 0) stored[g] = n;
    }
    if (Object.keys(stored).length) out.stored = stored;
  }
  return out;
}

/**
 * A saved home state, checked against the map; anything unknown is dropped. Reads the first
 * shape too (decision 0126: one island, `{ owned, offered, built }`), as the map's home island.
 */
export function readHome(raw: unknown, map: MapDef): HomeState {
  const home = createHomeState();
  if (!isObj(raw)) return home;
  const byIsland = isObj(raw.islands)
    ? raw.islands
    : map.homeIsland && 'owned' in raw
      ? { [map.homeIsland]: raw }
      : {};
  for (const [id, value] of Object.entries(byIsland)) {
    const island = readIsland(value, map, id);
    if (island) home.islands[id] = island;
  }
  return home;
}

/**
 * An island as it looks (decision 0210): spot id → building id, or a plot's state for a spot with
 * none (`plot:open` and so on, see `PlotState`). The captain's own island shows its plots staked:
 * an offered arc plot, or a spare one while a building passed over waits, is open; an arc plot
 * still to be given is bare. `chosen`: the plot the Island tab has picked.
 */
export function islandLook(
  home: HomeState,
  map: MapDef,
  islandId: string,
  chosen?: string,
): Record<string, string> {
  const h = islandHome(home, islandId);
  const out: Record<string, string> = { ...h.built };
  if (!h.owned) return out;
  const spare = passedOver(home, map, islandId).length > 0;
  for (const spot of homeSpots(map, islandId)) {
    if (h.built[spot.id]) continue;
    const open = spot.pair ? h.offered.includes(spot.id) : spare;
    if (open && spot.id === chosen) out[spot.id] = `${PLOT}chosen`;
    else if (open) out[spot.id] = `${PLOT}open`;
    else if (spot.pair) out[spot.id] = `${PLOT}bare`;
  }
  return out;
}

/** `islandLook` for every island with a home state, for drawing. */
export function homeLooks(
  home: HomeState,
  map: MapDef,
  chosen?: { island: string; spot: string } | null,
): Record<string, Record<string, string>> {
  return Object.fromEntries(
    Object.keys(home.islands).map((id) => [
      id,
      islandLook(home, map, id, chosen?.island === id ? chosen.spot : undefined),
    ]),
  );
}

/**
 * The island file as it stands for a home state: each building's props (`home:<building>`) on
 * its arc spot, or moved to the spare spot it was built on; run-down props (`home-empty:<spot>`)
 * only while their spot is empty; a plot's stakes (and ring) on a spot without a building
 * (`islandLook`, decision 0210). With no state, the island as the captain first finds it.
 */
export function homeDesign(design: IslandDesign, built: Record<string, string> = {}): IslandDesign {
  return homeView(design, built).design;
}

/**
 * `homeDesign`, with where each prop shown comes from (its index in the file) and whether it was
 * moved to a spare spot: the island builder shows a state and maps its checks back to the file.
 */
export function homeView(
  design: IslandDesign,
  built: Record<string, string> = {},
): { design: IslandDesign; from: number[]; moved: boolean[] } {
  const spots = design.homeSpots;
  const all = design.props.map((_, i) => i);
  if (!spots?.length) return { design, from: all, moved: all.map(() => false) };
  const at = new Map(Object.entries(built).map(([spot, b]) => [b, spot]));
  const props: PropDef[] = [];
  const from: number[] = [];
  const moved: boolean[] = [];
  design.props.forEach((prop, index) => {
    const tags = prop.tags ?? [];
    const empty = tags.find((t) => t.startsWith('home-empty:'));
    if (empty && isBuilding(built[empty.slice('home-empty:'.length)])) return;
    const owner = tags.find((t) => t.startsWith('home:'));
    if (!owner) {
      props.push(prop);
      from.push(index);
      moved.push(false);
      return;
    }
    const spotId = at.get(owner.slice('home:'.length));
    const spot = spots.find((s) => s.id === spotId);
    if (!spot) return;
    // Its own arc spot, or a spare: the same model, moved from its arc spot by the same offset.
    const arc = spots.find((s) => s.pair && s.pair === buildingById(built[spot.id]!)?.pair) ?? spot;
    props.push({
      ...prop,
      x: prop.x - arc.x + spot.x,
      z: prop.z - arc.z + spot.z,
      ...(spot.y !== undefined ? { y: spot.y } : {}),
    });
    from.push(index);
    moved.push(arc !== spot);
  });
  // The plots: generated, not in the file, so they map back to no prop (-1).
  spots.forEach((spot, index) => {
    const state = plotOf(built[spot.id]);
    if (!state) return;
    const types = state === 'chosen' ? [PLOT_PROPS.open, PLOT_PROPS.chosen] : [PLOT_PROPS[state]];
    for (const type of types) {
      props.push({
        type,
        x: spot.x,
        z: spot.z,
        turn: 0,
        size: 1,
        // The sign's number is the plot's.
        variant: index,
        shape: 0.5,
        from: 0,
        ...(spot.y !== undefined ? { y: spot.y } : {}),
      });
      from.push(-1);
      moved.push(false);
    }
  });
  return { design: { ...design, props }, from, moved };
}
