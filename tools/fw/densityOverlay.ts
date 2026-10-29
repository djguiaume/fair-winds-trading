import type { SectorDensity } from '../../src/sim/seaDensity';
import type { Overlay } from './chart';

/** Empty water as shaded runs of grid cells, the biggest empty discs, stats in the legend. */
export function densityOverlay(rows: SectorDensity[], cell: number): Overlay {
  const areas: NonNullable<Overlay['areas']> = [];
  for (const r of rows) {
    // Join cells side by side on one row of the grid into one strip.
    const byY = new Map<number, number[]>();
    for (const [x, y] of r.emptyCells ?? []) byY.set(y, [...(byY.get(y) ?? []), x]);
    for (const [y, xs] of byY) {
      xs.sort((a, b) => a - b);
      let start = xs[0]!;
      for (let k = 1; k <= xs.length; k++)
        if (k === xs.length || xs[k]! - xs[k - 1]! > cell + 0.01) {
          const end = xs[k - 1]!;
          const h = cell / 2;
          areas.push({
            outline: [
              [start - h, y - h],
              [end + h, y - h],
              [end + h, y + h],
              [start - h, y + h],
            ],
            style: 'empty',
          });
          if (k < xs.length) start = xs[k]!;
        }
    }
  }
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return {
    areas,
    islands: biggestSpots(rows).map((s) => ({
      x: s.x,
      y: s.y,
      radius: s.radius,
      style: 'gap',
      name: `r${s.radius}`,
    })),
    legend: rows.map((r) => ({
      style: 'tint',
      text: `${r.id}: ${r.islands} islands, ${r.shapes} shapes, ${r.marks} marks, ${r.zones} zones; ${r.perArea} per 100k; ${pct(r.empty)} empty`,
    })),
  };
}

/** Two biggest empty discs per sea; a disc mostly inside a bigger one (on a border) is left out. */
function biggestSpots(rows: SectorDensity[]) {
  const all = rows.flatMap((r) => r.spots.slice(0, 2)).sort((a, b) => b.radius - a.radius);
  const out: typeof all = [];
  for (const s of all)
    if (!out.some((o) => Math.hypot(o.x - s.x, o.y - s.y) < o.radius)) out.push(s);
  return out;
}
