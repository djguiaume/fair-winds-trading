import { type Heightfield, SEA_LEVEL } from './heightfield';

type Pt = [number, number];

/**
 * The coast of a height field: the lines where the ground crosses the sea level, in map units
 * (marching squares). Used by the chart's `--coast` overlay to compare the smoothed coast with
 * the island file's drawn outline.
 */
export function waterlines(field: Heightfield, level = SEA_LEVEL): Pt[][] {
  const { w, h, cell, x0, y0, heights } = field;
  const at = (i: number, j: number) => heights[j * w + i]! - level;
  const point = (i: number, j: number, di: number, dj: number): Pt => {
    const a = at(i, j),
      b = at(i + di, j + dj);
    const t = a / (a - b);
    return [x0 + (i + di * t) * cell, y0 + (j + dj * t) * cell];
  };
  const segments: [Pt, Pt][] = [];
  for (let j = 0; j < h - 1; j++)
    for (let i = 0; i < w - 1; i++) {
      // Corners 0..3 go round the cell; an edge is crossed where its ends differ in sign.
      const c = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      const edges: Pt[] = [];
      if (c[0]! > 0 !== c[1]! > 0) edges.push(point(i, j, 1, 0));
      if (c[1]! > 0 !== c[2]! > 0) edges.push(point(i + 1, j, 0, 1));
      if (c[2]! > 0 !== c[3]! > 0) edges.push(point(i, j + 1, 1, 0));
      if (c[3]! > 0 !== c[0]! > 0) edges.push(point(i, j, 0, 1));
      for (let k = 0; k + 1 < edges.length; k += 2) segments.push([edges[k]!, edges[k + 1]!]);
    }
  return chain(segments);
}

const key = (p: Pt) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;

/** Joins segments that share an end into lines (a closed coast comes back as one line). */
function chain(segments: [Pt, Pt][]): Pt[][] {
  const ends = new Map<string, number[]>();
  segments.forEach(([a, b], s) => {
    for (const p of [a, b]) ends.set(key(p), [...(ends.get(key(p)) ?? []), s]);
  });
  const used = new Set<number>();
  const lines: Pt[][] = [];
  for (let s = 0; s < segments.length; s++) {
    if (used.has(s)) continue;
    used.add(s);
    const line: Pt[] = [...segments[s]!];
    for (let grown = true; grown;) {
      grown = false;
      const tail = line[line.length - 1]!;
      const next = ends.get(key(tail))?.find((n) => !used.has(n));
      if (next === undefined) break;
      used.add(next);
      const [a, b] = segments[next]!;
      line.push(key(a) === key(tail) ? b : a);
    }
    lines.push(line);
  }
  return lines;
}
