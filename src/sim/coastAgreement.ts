import { TUNING } from '../data/tuning';
import { coastDistance } from './coast';
import { type Heightfield, SEA_LEVEL } from './heightfield';

type Pt = [number, number];
type Outline = [number, number][];

/**
 * Where the drawn coast and the sailed coast part (decision 0237, issue #273). The island file's
 * coast outline is the authority for the sim (collision, berths, routes); the height field is the
 * authority for what is drawn. Both must say the same thing about land and sea, so a sample the
 * field calls land (height above the sea) but the outline calls sea, or the other way round, is a
 * mismatch, and its distance to the outline is how far apart the two coasts are there.
 */
export interface CoastMismatch {
  /** Map point of the sample. */
  at: Pt;
  /** Distance from the outline in map units. */
  distance: number;
  /** `drawn`: the field has land the outline does not; `sailed`: the outline has land the field lacks. */
  side: 'drawn' | 'sailed';
}

export interface CoastAgreement {
  /** The worst mismatch, or null when the two coasts agree everywhere. */
  worst: CoastMismatch | null;
  /** Mismatches beyond the tolerance, the worst of each cluster (to mark on a chart). */
  beyond: CoastMismatch[];
}

/**
 * Signed distance to the sailed coast (negative on land): the nearest of the coast outlines, and
 * an inland lake's shore too, whose water is not land.
 */
function signedDistance(x: number, y: number, coasts: Outline[], lake: Outline | null): number {
  let d = Infinity;
  for (const c of coasts) d = Math.min(d, coastDistance(x, y, c).distance);
  if (!lake || d >= 0) return d;
  const l = coastDistance(x, y, lake).distance;
  return l < 0 ? Math.min(-d, -l) : d;
}

/**
 * Compares a field with the coast outlines it was built from: every `stride`-th sample of the
 * field is land or sea on each side, and where they disagree, the distance to the outline is the
 * discrepancy. Samples within a quarter of a cell of the outline are left out, as the grid cannot
 * say which side they are on; a lake's water is sea on both sides.
 */
export function coastAgreement(
  field: Heightfield,
  coasts: Outline[],
  lake: Outline | null = null,
  tolerance = TUNING.terrain.coast.tolerance,
): CoastAgreement {
  const { stride } = TUNING.terrain.coast;
  const blind = field.cell / 4;
  let worst: CoastMismatch | null = null;
  const beyond: CoastMismatch[] = [];
  for (let j = 0; j < field.h; j += stride)
    for (let i = 0; i < field.w; i += stride) {
      const x = field.x0 + i * field.cell,
        y = field.y0 + j * field.cell;
      const d = signedDistance(x, y, coasts, lake);
      if (Math.abs(d) < blind) continue;
      // A lake's water stands above the sea: it is land to the field and sea to the sim.
      const drawnLand =
        field.heights[j * field.w + i]! > SEA_LEVEL && !(lake && inside(x, y, lake));
      if (drawnLand === d < 0) continue;
      const mismatch: CoastMismatch = {
        at: [x, y],
        distance: Math.abs(d),
        side: drawnLand ? 'drawn' : 'sailed',
      };
      if (!worst || mismatch.distance > worst.distance) worst = mismatch;
      if (mismatch.distance > tolerance) beyond.push(mismatch);
    }
  return { worst, beyond: clusterWorst(beyond, TUNING.terrain.coast.markSpacing) };
}

/** The worst mismatch of each group of nearby ones, so a long bad stretch marks a few points. */
function clusterWorst(list: CoastMismatch[], reach: number): CoastMismatch[] {
  const kept: CoastMismatch[] = [];
  for (const m of [...list].sort((a, b) => b.distance - a.distance))
    if (!kept.some((k) => Math.hypot(k.at[0] - m.at[0], k.at[1] - m.at[1]) < reach)) kept.push(m);
  return kept;
}

const inside = (x: number, y: number, outline: Outline) =>
  coastDistance(x, y, outline).distance < 0;
