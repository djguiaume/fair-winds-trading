import type { IslandDef, TerrainDef } from './map';
import { coastDistance, insetOutline } from './coast';
import { atLevel, designOf, islandDesign, type IslandDesign } from '../data/islands';

export type IslandTheme = 'fish' | 'timber' | 'stone' | 'grain';
export type Outline = TerrainDef['outline'];
export interface LandSurface {
  outline: Outline;
  holes?: Outline[];
  height: number;
  material: 'grass' | 'rock';
  shape?: 'peak';
  base?: number;
}
export interface IslandLayout {
  coasts: Outline[];
  lake?: Outline;
  surfaces: LandSurface[];
}

/**
 * The island's ground at a level, built from its island file (decision 0101): coasts, the lake
 * and raised ground. Shared by models, collision, chart and water.
 */
function createIslandLayout(design: IslandDesign, level: number): IslandLayout {
  return {
    coasts: design.coasts,
    lake: design.lake,
    surfaces: design.ground
      .filter((g) => atLevel(g, level))
      .map((g) => ({
        // Explicit sandy shores: building height checks use the very same inset as the model.
        outline: g.coast !== undefined ? insetOutline(design.coasts[g.coast]!, BEACH) : g.outline!,
        holes: g.holes,
        height: g.height,
        material: g.material,
        shape: g.shape,
        base: g.base,
      })),
  };
}

/** Width of the sand between a coast and the ground it carries, in radius units. */
export const BEACH = 0.085;

const layouts = new WeakMap<IslandDesign, IslandLayout[]>();
/** The layout of an island file (by id, or the shipped island of a style) at a level. */
export function islandLayout(design: IslandDesign | string, level = 4): IslandLayout {
  const d = typeof design === 'string' ? islandDesign(design) : design;
  let byLevel = layouts.get(d);
  if (!byLevel) layouts.set(d, (byLevel = []));
  return (byLevel[level] ??= createIslandLayout(d, level));
}

/** An entire footprint must fit on a single surface and avoid water and cliff edges. */
export function layoutGround(
  layout: IslandLayout,
  x: number,
  z: number,
  margin = 0,
): number | null {
  if (!layout.coasts.some((c) => coastDistance(x, z, c).distance <= -margin)) return null;
  if (layout.lake && coastDistance(x, z, layout.lake).distance < margin) return null;
  let height: number | null = null;
  for (const s of layout.surfaces) {
    const d = coastDistance(x, z, s.outline).distance;
    if (Math.abs(d) < margin) return null;
    if (d < -margin && !s.holes?.some((h) => coastDistance(x, z, h).distance < margin))
      height = Math.max(height ?? 0, s.height);
  }
  return height;
}

/** Profiles use the same harbour-facing frame as pierAt. */
export function islandBearing(island: IslandDef): number {
  return island.look?.harbourBearing ?? 0;
}
export function islandPoint(island: IslandDef, x: number, z: number) {
  const a = Math.PI - islandBearing(island);
  return {
    x: island.x + island.radius * (Math.cos(a) * x + Math.sin(a) * z),
    y: island.y + island.radius * (Math.sin(a) * x - Math.cos(a) * z),
  };
}
const coastCache = new WeakMap<IslandDef, { key: string; coasts: Outline[] }>();
export function islandCoasts(island: IslandDef): Outline[] | null {
  const design = designOf(island);
  if (!design) return null;
  const key = `${island.x}/${island.y}/${island.radius}/${design.id}/${islandBearing(island)}`;
  const cached = coastCache.get(island);
  if (cached?.key === key) return cached.coasts;
  const coasts: Outline[] = design.coasts.map((c) =>
    c.map(([x, z]) => {
      const p = islandPoint(island, x, z);
      return [p.x, p.y];
    }),
  );
  coastCache.set(island, { key, coasts });
  return coasts;
}

/** Inland water shares its outline with the terrain hole and chart. */
export function islandLake(island: IslandDef): Outline | null {
  const lake = designOf(island)?.lake;
  return lake
    ? lake.map(([x, z]) => {
        const p = islandPoint(island, x, z);
        return [p.x, p.y];
      })
    : null;
}

/** The arrival pier on the simulation's line, then the side piers the island file builds. */
export function characterPiers(design: IslandDesign | string, R: number, level: number) {
  const d = typeof design === 'string' ? islandDesign(design) : design;
  const piers = [{ x: R * 0.08, z0: R * 0.63, len: Math.min(R * 0.75, 4.5) + R * 0.22 }];
  // Working docks stay shorter and well away from the central arrival lane.
  for (const p of d.piers)
    if (p.from <= level) piers.push({ x: p.x * R, z0: p.z * R, len: p.length * R });
  return piers;
}

/** Moored boats round the island at a level (radius units, yaw in radians), solid to the ship. */
export function islandMoorings(design: IslandDesign | string, level: number) {
  const d = typeof design === 'string' ? islandDesign(design) : design;
  return d.props
    .filter((p) => p.type === 'moored-boat' && atLevel(p, level))
    .map((p) => ({ x: p.x, z: p.z, yaw: ((p.turn ?? 0) * Math.PI) / 180 }));
}
