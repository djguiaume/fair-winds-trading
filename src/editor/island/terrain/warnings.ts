import { TUNING } from '../../../data/tuning';
import type { IslandDesign, SculptEdit } from '../../../data/islands';
import { coastDistance } from '../../../sim/coast';
import { SEA_LEVEL, heightAt, type Heightfield } from '../../../sim/heightfield';
import { islandPoint } from '../../../sim/islandLayout';
import type { IslandDef } from '../../../sim/map';
import { editReach } from '../../../sim/sculpt';

/**
 * What a stroke may have spoiled that the island checks do not say yet (issue #271): the coast the
 * island file draws now ending up under water or land beyond its tolerance, and the harbour's
 * water (the arrival pier's lane, the side piers) rising out of the sea. Only places an edit
 * reaches are looked at, so ground the generator itself leaves rough is never blamed on a brush.
 * Nothing here moves a building or a berth: it only says where.
 */
export interface TerrainWarning {
  kind: 'coast-raised' | 'coast-sunk' | 'berth';
  /** The place, in the file's frame. */
  at: [number, number];
}

/** The arrival pier's lane, as the island checks keep it (islandChecks APPROACH). */
const LANE = { x: 0.08, from: 0.45, to: 1.4 };
/** Distance between the places looked at along a coast or a pier, in world units. */
const STEP = 2;

export function terrainWarnings(
  field: Heightfield,
  island: IslandDef,
  design: IslandDesign,
  harbour: boolean,
): TerrainWarning[] {
  const edits = design.sculpt?.edits ?? [];
  if (!edits.length) return [];
  const { coastTolerance, shoreHeight, berthClearance } = TUNING.terrain.sculpt.editor;
  const tol = coastTolerance / island.radius;
  const touched = (x: number, z: number) => edits.some((e: SculptEdit) => editReach(e, x, z) < tol);
  const at = (x: number, z: number) => {
    const p = islandPoint(island, x, z);
    return heightAt(field, p.x, p.y);
  };
  const out: TerrainWarning[] = [];

  for (const coast of design.coasts)
    for (let i = 0; i < coast.length; i++) {
      const a = coast[i]!,
        b = coast[(i + 1) % coast.length]!;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.ceil((length * island.radius) / STEP));
      // The edge's normal, turned to point out of the island.
      let nx = (a[1] - b[1]) / length,
        nz = (b[0] - a[0]) / length;
      for (let s = 0; s < steps; s++) {
        const x = a[0] + ((b[0] - a[0]) * s) / steps,
          z = a[1] + ((b[1] - a[1]) * s) / steps;
        if (!touched(x, z)) continue;
        if (coastDistance(x + nx * tol, z + nz * tol, coast).distance < 0) {
          nx = -nx;
          nz = -nz;
        }
        if (at(x + nx * tol, z + nz * tol) > SEA_LEVEL + shoreHeight)
          out.push({ kind: 'coast-raised', at: [x, z] });
        else if (at(x - nx * tol, z - nz * tol) < SEA_LEVEL - shoreHeight)
          out.push({ kind: 'coast-sunk', at: [x, z] });
      }
    }

  // Harbour water: where a lane or pier is over the sea, the sea stays deep enough to berth in.
  const lanes: [number, number, number, number][] = harbour
    ? [[LANE.x, LANE.from, LANE.x, LANE.to]]
    : [];
  for (const pier of design.piers) lanes.push([pier.x, pier.z, pier.x, pier.z + pier.length]);
  for (const [x0, z0, x1, z1] of lanes) {
    const steps = Math.max(1, Math.ceil((Math.hypot(x1 - x0, z1 - z0) * island.radius) / STEP));
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps,
        z = z0 + ((z1 - z0) * s) / steps;
      if (design.coasts.some((c) => coastDistance(x, z, c).distance < 0) || !touched(x, z))
        continue;
      if (at(x, z) > SEA_LEVEL - berthClearance) {
        out.push({ kind: 'berth', at: [x, z] });
        break;
      }
    }
  }
  return out;
}
