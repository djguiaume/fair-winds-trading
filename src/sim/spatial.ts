/**
 * One shared "what is near here?" lookup for the sea (decision 0117). Per-step checks ask a grid
 * for the few things within reach instead of scanning the whole map, so their cost stays flat as
 * the map grows. Wind shelter uses it first; collisions, reefs, port range and deciding which
 * islands to build and draw can reuse it.
 */

/** Anything with a bounding circle in sim units (x east, y north). */
export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** Default cell size (units): about one island across, so a query touches a handful of cells. */
const CELL = 64;

/** A fixed grid of circles, built once from map data and read every step. */
export class SpatialGrid<T extends Circle> {
  private readonly cells = new Map<number, number[]>();
  /** Per-item stamp so an item spanning several cells is returned once per query. */
  private readonly seen: Uint32Array;
  private stamp = 0;

  constructor(
    readonly items: readonly T[],
    readonly cellSize = CELL,
  ) {
    this.seen = new Uint32Array(items.length);
    items.forEach((item, index) => {
      const x0 = this.cell(item.x - item.r),
        x1 = this.cell(item.x + item.r);
      const y0 = this.cell(item.y - item.r),
        y1 = this.cell(item.y + item.r);
      for (let cx = x0; cx <= x1; cx++)
        for (let cy = y0; cy <= y1; cy++) {
          const key = cellKey(cx, cy);
          const list = this.cells.get(key);
          if (list) list.push(index);
          else this.cells.set(key, [index]);
        }
    });
  }

  private cell(v: number) {
    return Math.floor(v / this.cellSize);
  }

  /**
   * Items whose circle comes within `r` of (x, y), in the order they were given, so callers get
   * exactly what a full scan with the same circle test would give. Pass `out` to reuse an array.
   */
  near(x: number, y: number, r: number, out: T[] = []): T[] {
    out.length = 0;
    if (++this.stamp === 0xffffffff) {
      this.seen.fill(0);
      this.stamp = 1;
    }
    const found: number[] = [];
    const x0 = this.cell(x - r),
      x1 = this.cell(x + r);
    const y0 = this.cell(y - r),
      y1 = this.cell(y + r);
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const list = this.cells.get(cellKey(cx, cy));
        if (!list) continue;
        for (const index of list) {
          if (this.seen[index] === this.stamp) continue;
          this.seen[index] = this.stamp;
          const item = this.items[index]!;
          const dx = item.x - x,
            dy = item.y - y,
            reach = r + item.r;
          if (dx * dx + dy * dy <= reach * reach) found.push(index);
        }
      }
    found.sort((a, b) => a - b);
    for (const index of found) out.push(this.items[index]!);
    return out;
  }
}

/** Cells as one number; maps stay within a few thousand units, far inside ±2^15 cells. */
function cellKey(cx: number, cy: number) {
  return (cx + 32768) * 65536 + (cy + 32768);
}
