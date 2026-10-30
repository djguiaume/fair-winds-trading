import { TUNING } from '../data/tuning';
import { WAVE_BANDS } from './seaState';

/**
 * How the coast calms the waves (issue #281, decision 0248): a share of each band's height and
 * shift, from the seabed's depth and how open the water is to the sea. Both come from one bake of
 * the land (`render/seabedDepth.ts`): the depth the new look's water is coloured by, and the
 * exposure, how far the sea runs clear of land all round. The GPU reads the same bytes from the
 * same texture with the same filtering, so a boat floats on the waves it is drawn on.
 *
 * Long waves feel the bottom first: the swell calms across the whole shelf, the chop only close
 * in. A harbour or lagoon that land closes on most sides calms whatever its depth; a straight
 * coast, open on half its sides, does not. The waves keep their length and their direction, so
 * the CPU and GPU sums stay exact.
 */

/** The bake's grid: scene x and z (z = -sim y) of the first texel's corner, cells, and bytes. */
export interface CoastGrid {
  x0: number;
  z0: number;
  cell: number;
  w: number;
  h: number;
  /** 0 (at the coast) to 255 (deep water), row by row along z. */
  depth: Uint8Array;
  /** 0 (closed in) to 255 (open sea all round). */
  exposure: Uint8Array;
}

/** A band's share of its open-sea waves, swell, chop and ripple in `WAVE_BANDS` order. */
export type BandCalm = Float64Array;

export const createBandCalm = (): BandCalm => new Float64Array(WAVE_BANDS.length).fill(1);

const sample = { depth: 1, exposure: 1 };

/**
 * The bake at scene (`x`, `z`), filtered as the GPU filters it (texel centres, clamped to the
 * edge); open, deep sea off the grid, as the shader's `coastAt`.
 */
export function coastSample(grid: CoastGrid, x: number, z: number) {
  const u = (x - grid.x0) / (grid.w * grid.cell),
    v = (z - grid.z0) / (grid.h * grid.cell);
  if (u < 0 || v < 0 || u > 1 || v > 1) {
    sample.depth = sample.exposure = 1;
    return sample;
  }
  const fx = u * grid.w - 0.5,
    fz = v * grid.h - 0.5;
  const i = Math.floor(fx),
    j = Math.floor(fz);
  const tx = fx - i,
    tz = fz - j;
  const i0 = Math.max(0, i),
    i1 = Math.min(grid.w - 1, i + 1);
  const j0 = Math.max(0, j) * grid.w,
    j1 = Math.min(grid.h - 1, j + 1) * grid.w;
  const bilinear = (bytes: Uint8Array) =>
    ((bytes[j0 + i0]! * (1 - tx) + bytes[j0 + i1]! * tx) * (1 - tz) +
      (bytes[j1 + i0]! * (1 - tx) + bytes[j1 + i1]! * tx) * tz) /
    255;
  sample.depth = bilinear(grid.depth);
  sample.exposure = bilinear(grid.exposure);
  return sample;
}

/** Each band's share of its waves at `depth` and `exposure` (both 0..1), into `out`. */
export function bandCalm(depth: number, exposure: number, out: BandCalm): BandCalm {
  const c = TUNING.waves.coast;
  const shelter = c.sheltered + (1 - c.sheltered) * smoothstep(c.shelteredAt, c.openAt, exposure);
  WAVE_BANDS.forEach((band, b) => {
    out[b] = (c.floor + (1 - c.floor) * smoothstep(0, c.reach[band], depth)) * shelter;
  });
  return out;
}

/** The bands' shares at sim (`x`, `y`); all 1 with no bake (no land, or a test). */
export function coastCalmAt(grid: CoastGrid | null, x: number, y: number, out: BandCalm) {
  if (!grid) return out.fill(1);
  const { depth, exposure } = coastSample(grid, x, -y);
  return bandCalm(depth, exposure, out);
}

/** The shader's `calmStep`: smoothstep that survives an empty edge (`b` at or below `a`). */
function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / Math.max(b - a, 1e-4)));
  return t * t * (3 - 2 * t);
}
