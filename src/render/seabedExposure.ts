import { TUNING } from '../data/tuning';

export type CoastTuning = typeof TUNING.waves.coast;

/** The depth bake's grid, as `seabedDepth.ts` lays it out. */
interface Grid {
  x0: number;
  z0: number;
  cell: number;
  w: number;
  h: number;
}

/** A pier, from its root to its head, in sim units (`sim/collision.ts` › `Pier`). */
export interface BerthLine {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * How open each cell lies to the sea (issue #281): the share of `rays` lines out to `fetch` units
 * all round that run clear of land, reef or sandbank (a seabed at or above `blocks`), smoothed
 * over `smooth` cells. 255 where every line runs clear, 0 inside land. A harbour that land closes
 * on most sides scores low however wide it is, a straight coast about half, a headland more.
 * The piers close the water in too, out to `berth` units, so a long pier's berth lies calm without
 * calming the sea round the port (no circle round a harbour).
 */
export function bakeExposure(
  beds: Float32Array,
  grid: Grid,
  tune: CoastTuning,
  smooth: (values: Float32Array, w: number, h: number, sigma: number) => void,
  piers: readonly BerthLine[] = [],
): Uint8Array {
  const { w, h } = grid;
  const rays = Math.max(1, Math.round(tune.rays));
  const steps = Math.max(1, Math.ceil(tune.fetch / grid.cell));
  const dx = new Float32Array(rays),
    dz = new Float32Array(rays);
  for (let r = 0; r < rays; r++) {
    dx[r] = Math.cos((r / rays) * Math.PI * 2);
    dz[r] = Math.sin((r / rays) * Math.PI * 2);
  }
  const open = new Float32Array(w * h).fill(1);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (beds[k]! >= tune.blocks) {
        open[k] = 0;
        continue;
      }
      let sum = 0;
      for (let r = 0; r < rays; r++) {
        let s = 1;
        for (; s <= steps; s++) {
          const ci = Math.floor(i + 0.5 + dx[r]! * s),
            cj = Math.floor(j + 0.5 + dz[r]! * s);
          // Off the grid is open sea.
          if (ci < 0 || cj < 0 || ci >= w || cj >= h) {
            s = steps + 1;
            break;
          }
          if (beds[cj * w + ci]! >= tune.blocks) break;
        }
        sum += reaches((s - 1) / steps);
      }
      open[k] = sum / rays;
    }
  for (const pier of piers) closeBerth(open, grid, pier, tune.berth);
  smooth(open, w, h, tune.smooth);
  const exposure = new Uint8Array(w * h);
  for (let k = 0; k < exposure.length; k++)
    exposure[k] = Math.round(Math.min(1, Math.max(0, open[k]!)) * 255);
  return exposure;
}

/** How much a line that runs `share` of the fetch before land counts as open: land near the end
 * of it barely shelters. */
function reaches(share: number) {
  const t = Math.min(1, Math.max(0, (share - 0.6) / 0.4));
  return t * t * (3 - 2 * t);
}

/** Each cell within `reach` units of the pier closes in, fully within half of it. */
function closeBerth(open: Float32Array, grid: Grid, pier: BerthLine, reach: number) {
  if (reach <= 0) return;
  // Scene x and z of the pier's ends (z = -sim y).
  const ax = pier.x0,
    az = -pier.y0,
    bx = pier.x1,
    bz = -pier.y1;
  const col = (x: number) => Math.floor((x - grid.x0) / grid.cell);
  const row = (z: number) => Math.floor((z - grid.z0) / grid.cell);
  const i0 = Math.max(0, col(Math.min(ax, bx) - reach)),
    i1 = Math.min(grid.w - 1, col(Math.max(ax, bx) + reach));
  const j0 = Math.max(0, row(Math.min(az, bz) - reach)),
    j1 = Math.min(grid.h - 1, row(Math.max(az, bz) + reach));
  const dx = bx - ax,
    dz = bz - az;
  const len2 = Math.max(1e-9, dx * dx + dz * dz);
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const x = grid.x0 + (i + 0.5) * grid.cell,
        z = grid.z0 + (j + 0.5) * grid.cell;
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2));
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t) / reach;
      if (d >= 1) continue;
      // Fully closed out to half the reach, then opening smoothly.
      const k = j * grid.w + i;
      const s = Math.max(0, 2 * d - 1);
      open[k] = open[k]! * s * s * (3 - 2 * s);
    }
}
