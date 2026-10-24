import type { IslandDef, MapDef } from './map';
import type { ShipyardProgress } from './shipyards';

/**
 * Fog of war (decision 0153): the new waters of the Phase 4 sea start uncharted. The chart
 * lifts its fog per named area and per island, never per pixel, so the save code stays short
 * (decisions 0118, 0137). Today's Windward Ring, inside `chartedRadius`, is charted from the start.
 */

/** A named stretch of the new waters, drawn in the map editor: all of it is charted at once. */
export interface ChartAreaDef {
  id: string;
  name: string;
  outline: [number, number][];
}

export interface FogDef {
  /** The sea within this distance of (0, 0) is charted from the start: today's Windward Ring. */
  chartedRadius: number;
  /** The new waters' areas; water in none of them stays fogged until its sea is laid out. */
  areas: ChartAreaDef[];
}

/** Point in polygon (even-odd). */
export function insideOutline(x: number, y: number, outline: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i]!;
    const [xj, yj] = outline[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The area a point lies in, if any. */
export function chartAreaAt(map: MapDef, x: number, y: number): ChartAreaDef | undefined {
  return map.fog?.areas.find((a) => insideOutline(x, y, a.outline));
}

/** Area ids, in map order: the save code's flag list. */
export const chartAreaIds = (map: MapDef) => (map.fog?.areas ?? []).map((a) => a.id);

/** Islands out in the fog, which can be sighted one by one: the save code's other flag list. */
export function fogIslandIds(map: MapDef): string[] {
  const fog = map.fog;
  if (!fog) return [];
  return map.islands
    .filter((i) => Math.hypot(i.x, i.y) - i.radius > fog.chartedRadius)
    .map((i) => i.id);
}

/** Is the water at this point on the chart? */
export function chartedAt(
  map: MapDef,
  progress: Pick<ShipyardProgress, 'areas'>,
  x: number,
  y: number,
): boolean {
  const fog = map.fog;
  if (!fog || Math.hypot(x, y) <= fog.chartedRadius) return true;
  const area = chartAreaAt(map, x, y);
  return !!area && !!progress.areas?.includes(area.id);
}

/** Is this island on the chart: in charted water, or sighted? */
export function islandCharted(
  map: MapDef,
  progress: Pick<ShipyardProgress, 'areas' | 'sighted'>,
  island: IslandDef,
): boolean {
  return (
    !map.fog ||
    Math.hypot(island.x, island.y) - island.radius <= map.fog.chartedRadius ||
    !!progress.sighted?.includes(island.id) ||
    chartedAt(map, progress, island.x, island.y)
  );
}

export type FogEvent =
  { type: 'area-charted'; id: string; name: string } | { type: 'island-sighted'; id: string };

/**
 * Charts what she sails into or sights: the area she is in, and any island within `sightRange`
 * of its coast (the same range that finds hidden ports, so the lookout helps here too).
 */
export function stepFog(
  map: MapDef,
  progress: ShipyardProgress,
  boat: { x: number; y: number },
  sightRange: number,
): FogEvent[] {
  const fog = map.fog;
  if (!fog || Math.hypot(boat.x, boat.y) <= fog.chartedRadius - sightRange) return [];
  const events: FogEvent[] = [];
  const area = chartAreaAt(map, boat.x, boat.y);
  if (area && !progress.areas?.includes(area.id)) {
    (progress.areas ??= []).push(area.id);
    events.push({ type: 'area-charted', id: area.id, name: area.name });
  }
  for (const island of map.islands) {
    if (progress.sighted?.includes(island.id)) continue;
    if (Math.hypot(boat.x - island.x, boat.y - island.y) - island.radius > sightRange) continue;
    if (islandCharted(map, progress, island)) continue;
    (progress.sighted ??= []).push(island.id);
    events.push({ type: 'island-sighted', id: island.id });
  }
  return events;
}

/** Areas a quest reward puts on the chart (an old pilot's chart). Returns the new ones. */
export function chartAreas(map: MapDef, progress: ShipyardProgress, ids: readonly string[]) {
  const added: ChartAreaDef[] = [];
  for (const area of map.fog?.areas ?? []) {
    if (!ids.includes(area.id) || progress.areas?.includes(area.id)) continue;
    (progress.areas ??= []).push(area.id);
    added.push(area);
  }
  return added;
}
