import { createRng, range } from '../sim/rng';
import { DEG } from '../sim/math';
import { type CloudMesh, cloudRank, emptyCloudMesh, pushDirection } from './skyClouds';

/** `graphics.json` › `sky` › `streaks`: the high thin clouds (angles in degrees). */
export interface StreakShape {
  count: number;
  seed: number;
  baseDeg: readonly number[];
  lengthDeg: readonly number[];
  thickDeg: readonly number[];
}

/** Stations along a streak: enough for its taper and its slight arc to read smooth. */
const STATIONS = 7;
/** How far a streak climbs or sinks from one end to the other, at most, degrees. */
const SLOPE_DEG = 2.5;

/**
 * High thin streaks (cirrus) above the cumulus (issue #552): each a tapered strip along the
 * horizon, three corners deep, soft on every side (rim corners carry edge 0), layer 1 so the
 * shader lights them as one sheet and drifts them slower. Appended to `mesh` after its corners.
 */
export function buildStreaks(
  shape: StreakShape,
  firstIndex = 0,
  mesh: CloudMesh = emptyCloudMesh(),
): CloudMesh {
  const rng = createRng(shape.seed);
  const offset = rng();
  const [baseLo = 10, baseHi = baseLo] = shape.baseDeg;
  const [lengthLo = 20, lengthHi = lengthLo] = shape.lengthDeg;
  const [thickLo = 0.5, thickHi = thickLo] = shape.thickDeg;
  for (let i = 0; i < shape.count; i++) {
    const bearing = ((i + rng()) / shape.count) * Math.PI * 2;
    const base = range(rng, baseLo, baseHi);
    const length = range(rng, lengthLo, lengthHi);
    const thick = range(rng, thickLo, thickHi);
    const slope = (rng() - 0.5) * 2 * SLOPE_DEG;
    const rank = cloudRank(i, offset);
    const start = firstIndex + mesh.shades.length;
    for (let s = 0; s < STATIONS; s++) {
      const along = s / (STATIONS - 1);
      const taper = Math.sin(along * Math.PI);
      const at = bearing + (along - 0.5) * length * DEG;
      const mid = base + slope * (along - 0.5);
      const half = (thick / 2) * (0.3 + 0.7 * taper);
      for (const [rise, edge] of [
        [-half, 0],
        [0, taper],
        [half, 0],
      ] as const) {
        pushDirection(mesh.positions, at, (mid + rise) * DEG);
        mesh.shades.push(1);
        mesh.parts.push(edge, rank, 1);
      }
    }
    for (let s = 0; s < STATIONS - 1; s++) {
      for (let row = 0; row < 2; row++) {
        const a = start + s * 3 + row;
        const b = a + 3;
        mesh.indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  return mesh;
}
