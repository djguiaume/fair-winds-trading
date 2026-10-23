import type { BoatState } from './boat';
import type { IslandDef, MapDef, TerrainDef } from './map';
import { coastDistance } from './coast';
import { bearingTo, bearingVector } from './math';
import {
  islandCoasts,
  islandPoint,
  islandLake,
  characterPiers,
  islandMoorings,
} from './islandLayout';
import { designOf } from '../data/islands';
import { DEFAULT_START_LEVEL } from './settlement';

/**
 * What the boat ran into; hulls fare worst on reefs, then piers, moored boats and rocky shores
 * (decisions 0038 and 0082).
 */
export type Surface = 'reef' | 'pier' | 'boat' | 'shore' | 'sandbank' | 'edge';
const HARDNESS: Record<Surface, number> = {
  reef: 4,
  pier: 3,
  boat: 3,
  shore: 2,
  sandbank: 1,
  edge: 0,
};

const coastBounds = new WeakMap<
  TerrainDef['outline'],
  { minX: number; minY: number; maxX: number; maxY: number }
>();

/** Generated island outlines retain their identity until the island's geometry changes. */
function outsideCoast(boat: BoatState, radius: number, outline: TerrainDef['outline']): boolean {
  let bounds = coastBounds.get(outline);
  if (!bounds) {
    bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const [x, y] of outline) {
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    }
    coastBounds.set(outline, bounds);
  }
  return (
    boat.x < bounds.minX - radius ||
    boat.x > bounds.maxX + radius ||
    boat.y < bounds.minY - radius ||
    boat.y > bounds.maxY + radius
  );
}

/** Island scale the pier is modelled at; the renderer draws the same pier (highlandIslands). */
const PIER_SCALE = 2.2;
/** Half the pier's width (units), posts included. */
export const PIER_HALF_WIDTH = 0.45 * PIER_SCALE;
/** A moored fishing boat's hull: half its length and beam, in map units (towns.ts fishingBoat). */
export const MOORED_BOAT_HALF_LENGTH = 1.0 * 1.55 * PIER_SCALE;
export const MOORED_BOAT_HALF_WIDTH = 0.45 * 1.55 * PIER_SCALE;

/**
 * A harbour pier as a solid segment from the island out to its head. A boat moored in the harbour
 * is the same kind of capsule along its keel, flagged so a ram reports the boat (decision 0082).
 */
export interface Pier {
  islandId: string;
  halfWidth?: number;
  boat?: boolean;
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
  const root = at(x, island.look?.profile ? island.radius * 0.63 : z0);
  const head = at(x, z1);
  return { islandId: island.id, x0: root.x, y0: root.y, x1: head.x, y1: head.y };
}

/** Piers that face the course buoy named after their island (the harbour side). */
export function piersOf(
  map: Pick<MapDef, 'islands' | 'course'> & Partial<Pick<MapDef, 'ports'>>,
  levels: Record<string, number> = {},
): Pier[] {
  const piers: Pier[] = [];
  for (const island of map.islands) {
    const wp = map.course.find((w) => w.label === island.name);
    if (island.look?.dock && wp)
      piers.push(
        pierAt(
          island,
          island.look?.profile ? (island.look.harbourBearing ?? 0) : bearingTo(island, wp),
        ),
      );
    const port = map.ports?.find((p) => p.islandId === island.id);
    if (island.look?.dock && wp && !island.look.profile && port) {
      // A hidden yard grows the plain town dock (townIslandParts): a T-head from level 3 and a
      // second pier with its quay at level 4, in the same harbour frame as its main pier (0082).
      const level = levels[port.id] ?? port.level ?? 1;
      const main = piers[piers.length - 1]!;
      main.halfWidth = ([0.3, 0.45, 0.55, 0.55][level - 1] ?? 0.55) * PIER_SCALE;
      const angle = Math.PI - bearingTo(island, wp);
      const at = (x: number, z: number) => ({
        x: island.x + island.radius * (Math.cos(angle) * x + Math.sin(angle) * z),
        y: island.y + island.radius * (Math.sin(angle) * x - Math.cos(angle) * z),
      });
      const span = (x0: number, z0: number, x1: number, z1: number, halfWidth?: number) => {
        const a = at(x0, z0),
          b = at(x1, z1);
        piers.push({ islandId: island.id, x0: a.x, y0: a.y, x1: b.x, y1: b.y, halfWidth });
      };
      const len = Math.min(0.75, (4.5 * PIER_SCALE) / island.radius);
      const unit = PIER_SCALE / island.radius;
      if (level >= 3) {
        const z = 0.85 + len - 0.4 * unit;
        span(0.08 - 1.4 * unit, z, 0.08 + 1.4 * unit, z, 0.5 * PIER_SCALE);
      }
      if (level >= 4) {
        const x = 0.08 - 0.42,
          z0 = 0.85 - 0.2 * unit;
        span(x, z0, x, z0 + len * 0.6);
        span(x - 1.3 * unit, z0 - 0.1 * unit, x + 1.3 * unit, z0 - 0.1 * unit, 0.35 * PIER_SCALE);
      }
    }
    if (island.look?.profile) {
      const level = port ? (levels[port.id] ?? port.level ?? DEFAULT_START_LEVEL) : 1;
      const main = piers[piers.length - 1];
      if (main?.islandId === island.id)
        main.halfWidth = ([0.3, 0.45, 0.55, 0.55][level - 1] ?? 0.55) * PIER_SCALE;
      const crossbar = (x: number, z: number, halfLength: number, halfWidth: number) => {
        const a = islandPoint(island, x - halfLength, z),
          b = islandPoint(island, x + halfLength, z);
        piers.push({ islandId: island.id, x0: a.x, y0: a.y, x1: b.x, y1: b.y, halfWidth });
      };
      if (level >= 3)
        crossbar(
          0.08,
          0.85 + Math.min(0.75, 9.9 / island.radius) - (0.4 * 2.2) / island.radius,
          (1.4 * 2.2) / island.radius,
          0.5 * 2.2,
        );
      const design = designOf(island)!;
      for (const p of characterPiers(design, island.radius / 2.2, level).slice(1)) {
        const root = islandPoint(island, (p.x * 2.2) / island.radius, (p.z0 * 2.2) / island.radius);
        const head = islandPoint(
          island,
          (p.x * 2.2) / island.radius,
          ((p.z0 + p.len) * 2.2) / island.radius,
        );
        piers.push({ islandId: island.id, x0: root.x, y0: root.y, x1: head.x, y1: head.y });
        crossbar(
          (p.x * 2.2) / island.radius,
          ((p.z0 - 0.1) * 2.2) / island.radius,
          (1.3 * 2.2) / island.radius,
          0.35 * 2.2,
        );
      }
      // The moored boats an island file places, Saltmere's fishing fleet (towns.ts draws them at
      // 1.55 times a 2-unit hull): a keel-long capsule each, so the ship bumps them (0082).
      for (const m of islandMoorings(design, level)) {
        const half = (MOORED_BOAT_HALF_LENGTH - MOORED_BOAT_HALF_WIDTH) / island.radius;
        const a = islandPoint(island, m.x - Math.sin(m.yaw) * half, m.z - Math.cos(m.yaw) * half);
        const b = islandPoint(island, m.x + Math.sin(m.yaw) * half, m.z + Math.cos(m.yaw) * half);
        piers.push({
          islandId: island.id,
          x0: a.x,
          y0: a.y,
          x1: b.x,
          y1: b.y,
          halfWidth: MOORED_BOAT_HALF_WIDTH,
          boat: true,
        });
      }
    }
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
    const coasts = islandCoasts(island);
    if (coasts) {
      let lake: ReturnType<typeof islandLake> | undefined;
      for (const [index, outline] of coasts.entries()) {
        if (outsideCoast(boat, radius, outline)) continue;
        if (index === 0) lake = islandLake(island);
        for (let pass = 0; pass < 8; pass++) {
          let coast = coastDistance(boat.x, boat.y, outline);
          if (index === 0 && lake) {
            const hole = coastDistance(boat.x, boat.y, lake);
            if (-hole.distance > coast.distance)
              coast = { distance: -hole.distance, nx: -hole.nx, ny: -hole.ny };
          }
          if (coast.distance >= radius) break;
          boat.x += coast.nx * (radius - coast.distance + 1e-6);
          boat.y += coast.ny * (radius - coast.distance + 1e-6);
          bump(boat, coast.nx, coast.ny);
          touch('shore');
        }
      }
      continue;
    }
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
    // Same box early-out as island coasts: per-step work stays flat as the map grows (0115).
    if (outsideCoast(boat, radius, feature.outline)) continue;
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
    const overlap = (pier.halfWidth ?? PIER_HALF_WIDTH) + radius - dist;
    if (overlap > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      boat.x += nx * overlap;
      boat.y += ny * overlap;
      bump(boat, nx, ny);
      touch(pier.boat ? 'boat' : 'pier');
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
