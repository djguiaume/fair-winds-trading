import type { BoatState } from './boat';
import type { IslandDef, TerrainDef } from './map';
import { coastDistance } from './coast';
import { bearingVector } from './math';

/**
 * Keep the boat out of circular islands and polygon coastlines, and inside the sea.
 * Returns true when the boat hit something this step.
 */
export function resolveCollisions(
  boat: BoatState,
  radius: number,
  islands: readonly IslandDef[],
  boundsRadius: number,
  terrain: readonly TerrainDef[] = [],
): boolean {
  let hit = false;
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
      hit = true;
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
      hit = true;
    }
  }
  const fromCenter = Math.hypot(boat.x, boat.y);
  if (fromCenter > boundsRadius) {
    const nx = -boat.x / fromCenter;
    const ny = -boat.y / fromCenter;
    boat.x += -nx * (boundsRadius - fromCenter);
    boat.y += -ny * (boundsRadius - fromCenter);
    bump(boat, nx, ny);
    hit = true;
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
