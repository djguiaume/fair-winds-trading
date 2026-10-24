import { TUNING } from '../data/tuning';
import { questShown, questTagIds } from '../data/islands';
import type { IslandDef, MapDef, TerrainDef } from './map';

/**
 * Land that rises or clears after a quest (decision 0166): an island or a shape (reef, bank,
 * shallows, ice) tagged `after:<quest>` stands in the sea once that quest is done, one tagged
 * `before:<quest>` until then, the same rule as island props and sea marks (0130, `questShown`).
 *
 * The sea never changes under the boat or in her sight: a feature swaps only while she is
 * `changeDistance` from it, or docked and `dockedClear` from it (the port screen covers the sea).
 * So what stands is game state (`LandState`), which follows the quests done when it safely can.
 */
export interface LandState {
  /** Island and shape ids out of the sea right now. Ids are unique across both lists (map checks). */
  out: Set<string>;
  /** The islands that stand: the map's, less those out. Same array until something swaps. */
  islands: IslandDef[];
  /** The shapes that stand, likewise. */
  terrain: TerrainDef[];
  /** Counts the swaps, for the view and the chart to notice one. */
  version: number;
}

const questLand = () => TUNING.seamanship.questLand;

/** Does the map have any island or shape that comes or goes with a quest? */
export const hasQuestLand = (map: MapDef) =>
  map.islands.some((i) => questTagIds(i).length) ||
  (map.terrain ?? []).some((t) => questTagIds(t).length);

/** The ids that should be out of the sea with these quests done, ignoring where the boat is. */
export function landOut(map: MapDef, done: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  for (const f of [...map.islands, ...(map.terrain ?? [])]) if (!questShown(f, done)) out.add(f.id);
  return out;
}

/** The land as it stands with these ids out. */
export function landWith(map: MapDef, out: ReadonlySet<string>, version = 0): LandState {
  return {
    out: new Set(out),
    islands: out.size ? map.islands.filter((i) => !out.has(i.id)) : map.islands,
    terrain: out.size ? (map.terrain ?? []).filter((t) => !out.has(t.id)) : (map.terrain ?? []),
    version,
  };
}

/** The map as it stands: its islands and shapes, less those out of the sea. */
export function standingMap(map: MapDef, done: ReadonlySet<string>): MapDef {
  const land = landWith(map, landOut(map, done));
  return { ...map, islands: land.islands, terrain: land.terrain };
}

/** Distance from a point to a feature's edge: an island's beach circle, a shape's outline box. */
export function featureDistance(
  feature: IslandDef | TerrainDef,
  at: { x: number; y: number },
): number {
  if ('radius' in feature) return Math.hypot(at.x - feature.x, at.y - feature.y) - feature.radius;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of feature.outline) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const dx = Math.max(minX - at.x, 0, at.x - maxX);
  const dy = Math.max(minY - at.y, 0, at.y - maxY);
  return Math.hypot(dx, dy);
}

/**
 * Brings the land up to date with the quests done, as far as it safely can (decision 0166), and
 * returns the ids that swapped. `loading`: nothing is on screen yet (a new voyage or a loaded
 * one), so everything swaps but land that would rise on top of the boat. Otherwise a feature
 * swaps only out of her sight, or while she is docked and clear of it.
 */
export function syncLand(
  map: MapDef,
  land: LandState,
  done: ReadonlySet<string>,
  boat: { x: number; y: number },
  docked: boolean,
  loading = false,
): string[] {
  const want = landOut(map, done);
  const { changeDistance, dockedClear } = questLand();
  const swapped: string[] = [];
  for (const f of [...map.islands, ...(map.terrain ?? [])]) {
    const isOut = land.out.has(f.id);
    if (want.has(f.id) === isOut) continue;
    const away = featureDistance(f, boat);
    const rises = isOut;
    const safe = loading
      ? !rises || away > dockedClear
      : away > changeDistance || (docked && away > dockedClear);
    if (!safe) continue;
    if (rises) land.out.delete(f.id);
    else land.out.add(f.id);
    swapped.push(f.id);
  }
  if (swapped.length) Object.assign(land, landWith(map, land.out, land.version + 1));
  return swapped;
}
