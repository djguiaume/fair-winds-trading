import { coastDistance } from './coast';
import type { MapDef, TerrainDef } from './map';
import { type Rng, createRng, range } from './rng';

/**
 * Where things stand on a reef or sandbank (decision 0127). The drawing and the sim share this, so
 * the tutorial's wreck is exactly where East Reef's wreck is drawn.
 */

export interface Spot {
  x: number;
  y: number;
  radius: number;
}

/** A free spot `radius` inside `area`, or null after 512 tries. Takes numbers from `rng`. */
export function sampleInside(
  rng: Rng,
  area: TerrainDef['outline'],
  radius: number,
  occupied: Spot[],
): { x: number; y: number } | null {
  const xs = area.map((p) => p[0]);
  const ys = area.map((p) => p[1]);
  for (let attempt = 0; attempt < 512; attempt++) {
    const x = range(rng, Math.min(...xs), Math.max(...xs));
    const y = range(rng, Math.min(...ys), Math.max(...ys));
    if (coastDistance(x, y, area).distance > -radius) continue;
    if (occupied.some((p) => Math.hypot(p.x - x, p.y - y) < p.radius + radius)) continue;
    occupied.push({ x, y, radius });
    return { x, y };
  }
  return null;
}

/** The seed a terrain feature's details are drawn with. */
export function terrainSeed(map: MapDef, feature: TerrainDef): number {
  const index = map.terrain?.indexOf(feature) ?? 0;
  return feature.seed ?? map.seed * 1709 + index * 97;
}

/** Footprint of a landmark on a reef or bank, in map units. */
export const landmarkRadius = (kind: string) =>
  kind === 'wreck' ? 4.6 : kind === 'ruins' ? 5.1 : 3.1;

/**
 * Where a reef's or sandbank's landmark stands: its `landmarkAt`, or the first spot its details
 * take.
 */
export function landmarkSpot(map: MapDef, featureId: string): { x: number; y: number } | null {
  const feature = map.terrain?.find((f) => f.id === featureId);
  const kind = feature?.look?.landmark;
  if (!feature || !kind || (feature.kind !== 'reef' && feature.kind !== 'sandbank')) return null;
  if (feature.look?.landmarkAt) return { ...feature.look.landmarkAt };
  return sampleInside(
    createRng(terrainSeed(map, feature)),
    feature.outline,
    landmarkRadius(kind),
    [],
  );
}
