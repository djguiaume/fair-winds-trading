import type { BoatState } from './boat';
import type { IslandDef, MapDef, TerrainDef } from './map';
import { coastDistance } from './coast';
import { bearingTo, bearingVector } from './math';

/** What the boat ran into; hulls fare worst on reefs, then piers and rocky shores (decision 0038). */
export type Surface = 'reef' | 'pier' | 'shore' | 'sandbank' | 'edge';
const HARDNESS: Record<Surface, number> = { reef: 4, pier: 3, shore: 2, sandbank: 1, edge: 0 };

/** Island scale the pier is modelled at; the renderer draws the same pier (highlandIslands). */
const PIER_SCALE = 2.2;
/** Half the pier's width (units), posts included. */
export const PIER_HALF_WIDTH = 0.45 * PIER_SCALE;

/** A harbour pier as a solid segment from the island out to its head. */
export interface Pier {
  islandId: string;
  x0: number;
  y0: number;
  /** Pier head: where the boat docks. */
  x1: number;
  y1: number;
}

/** The pier of a docked island whose harbour faces `bearing`. */
export function pierAt(island: IslandDef, bearing: number): Pier {
  // Same frame as the rendered pier: island-local +Z points along the harbour bearing.
  const angle = Math.PI - bearing;
  const at = (x: number, z: number) => ({
    x: island.x + Math.cos(angle) * x + Math.sin(angle) * z,
    y: island.y + Math.sin(angle) * x - Math.cos(angle) * z,
  });
  const x = island.radius * 0.08;
  const z0 = island.radius * 0.85;
  const z1 = z0 + Math.min(island.radius * 0.75, 4.5 * PIER_SCALE);
  const root = at(x, z0);
  const head = at(x, z1);
  return { islandId: island.id, x0: root.x, y0: root.y, x1: head.x, y1: head.y };
}

/** Piers that face the course buoy named after their island (the harbour side). */
export function piersOf(map: Pick<MapDef, 'islands' | 'course'>): Pier[] {
  const piers: Pier[] = [];
  for (const island of map.islands) {
    const wp = map.course.find((w) => w.label === island.name);
    if (island.look?.dock && wp) piers.push(pierAt(island, bearingTo(island, wp)));
  }
  return piers;
}

/**
 * Keep the boat out of circular islands, polygon coastlines and piers, and inside the sea.
 * Returns the hardest surface the boat hit this step, or null when it hit nothing.
 */
export function resolveCollisions(
  boat: BoatState,
  radius: number,
  islands: readonly IslandDef[],
  boundsRadius: number,
  terrain: readonly TerrainDef[] = [],
  piers: readonly Pier[] = [],
): Surface | null {
  let hit: Surface | null = null;
  const touch = (surface: Surface) => {
    if (hit === null || HARDNESS[surface] > HARDNESS[hit]) hit = surface;
  };
  for (const island of islands) {
    const dx = boat.x - island.x;
    const dy = boat.y - island.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const overlap = island.radius + radius - dist;
    if (overlap > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      boat.x += nx * overlap;
      boat.y += ny * overlap;
      bump(boat, nx, ny);
      touch('shore');
    }
  }
  for (const feature of terrain) {
    // At a concave corner, clearing one edge can leave overlap with its neighbor.
    for (let pass = 0; pass < 8; pass++) {
      const coast = coastDistance(boat.x, boat.y, feature.outline);
      if (coast.distance >= radius) break;
      boat.x += coast.nx * (radius - coast.distance + 1e-6);
      boat.y += coast.ny * (radius - coast.distance + 1e-6);
      bump(boat, coast.nx, coast.ny);
      touch(feature.kind === 'island' ? 'shore' : feature.kind);
    }
  }
  for (const pier of piers) {
    const sx = pier.x1 - pier.x0;
    const sy = pier.y1 - pier.y0;
    const t = Math.max(
      0,
      Math.min(1, ((boat.x - pier.x0) * sx + (boat.y - pier.y0) * sy) / (sx * sx + sy * sy)),
    );
    const dx = boat.x - (pier.x0 + sx * t);
    const dy = boat.y - (pier.y0 + sy * t);
    const dist = Math.hypot(dx, dy) || 1e-6;
    const overlap = PIER_HALF_WIDTH + radius - dist;
    if (overlap > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      boat.x += nx * overlap;
      boat.y += ny * overlap;
      bump(boat, nx, ny);
      touch('pier');
    }
  }
  const fromCenter = Math.hypot(boat.x, boat.y);
  if (fromCenter > boundsRadius) {
    const nx = -boat.x / fromCenter;
    const ny = -boat.y / fromCenter;
    boat.x += -nx * (boundsRadius - fromCenter);
    boat.y += -ny * (boundsRadius - fromCenter);
    bump(boat, nx, ny);
    touch('edge');
  }
  return hit;
}

/** Lose speed in proportion to how head-on the hit was; a glancing touch just slides along. */
function bump(boat: BoatState, nx: number, ny: number): void {
  const dir = bearingVector(boat.heading);
  const into = -(dir.x * nx + dir.y * ny); // 1 = straight into the obstacle
  if (into > 0) {
    boat.speedKn *= 1 - 0.85 * into;
    if (into > 0.3) boat.sinceBump = 0;
  }
  // Remove the drift component pushing into the obstacle.
  const d = boat.drift.x * nx + boat.drift.y * ny;
  if (d < 0) {
    boat.drift.x -= d * nx;
    boat.drift.y -= d * ny;
  }
}
