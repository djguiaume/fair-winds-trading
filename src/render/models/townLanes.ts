import * as THREE from 'three';
import { LANE_WIDTH, type IslandDesign, type LaneDef } from '../../data/islands';
import { type IslandLayout, crossesCliff, layoutGround } from '../../sim/islandLayout';

/** One piece of a lane the town shows: its ends and middle (radius units) and their heights. */
export interface LanePiece {
  /** The lane's index in the island file and the piece's place along it. */
  lane: number;
  i: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  x: number;
  z: number;
  h: number;
  ha: number;
  hb: number;
  /** On one level; else it climbs a slope. */
  flat: boolean;
  width: number;
}

/** How far from a standing home a lane piece shows, radius units. */
const NEAR_HOME = 0.3;
/** A lane piece's length, radius units: a smooth street sampled finely enough to bend. */
const PIECE = 0.025;
/** Pieces per lane at most, and at least: a short lane costs its length, not a long street's (#514). */
const PIECES = [8, 110] as const;

/** A lane's smooth centre line (radius units, y 0), sampled evenly. */
export function laneSamples(lane: LaneDef): THREE.Vector3[] {
  const street = new THREE.CatmullRomCurve3(
    lane.points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'centripetal',
  );
  const pieces = Math.round(street.getLength() / PIECE);
  return street.getSpacedPoints(Math.min(PIECES[1], Math.max(PIECES[0], pieces)));
}

/**
 * The lane pieces a town shows at a level: near a standing home, on one level or up a slope,
 * never across water or a cliff (decision 0101). Shared by the town's drawing (`townProps.ts`)
 * and the people who walk them (issue #477), so both agree on where a street is.
 */
export function lanePieces(
  design: IslandDesign,
  layout: IslandLayout,
  homes: readonly { x: number; z: number }[],
): LanePiece[] {
  const out: LanePiece[] = [];
  design.lanes.forEach((lane, index) => {
    if (lane.kind && lane.kind !== 'lane') return;
    const points = laneSamples(lane);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!,
        b = points[i]!;
      const x = (a.x + b.x) / 2,
        z = (a.z + b.z) / 2;
      const h = layoutGround(layout, x, z, 0.025);
      if (h === null || !homes.some((p) => Math.hypot(p.x - x, p.z - z) < NEAR_HOME)) continue;
      const ha = layoutGround(layout, a.x, a.z, 0.025),
        hb = layoutGround(layout, b.x, b.z, 0.025);
      const flat = ha === h && hb === h;
      if (!flat && (ha === null || hb === null || crossesCliff(layout, a.x, a.z, b.x, b.z)))
        continue;
      out.push({
        lane: index,
        i,
        ax: a.x,
        az: a.z,
        bx: b.x,
        bz: b.z,
        x,
        z,
        h,
        ha: ha ?? h,
        hb: hb ?? h,
        flat,
        width: lane.width ?? LANE_WIDTH,
      });
    }
  });
  return out;
}
