import { type Heightfield, SEA_LEVEL } from './heightfield';

type Pt = [number, number];

/**
 * The lines where a field crosses `level` (marching squares): the drawn coast at the sea level.
 * Each line is a list of map points, closed lines repeating their first point. Lines are joined
 * through the grid edges they cross, so the same crossing is never computed twice.
 */
export function contourLines(field: Heightfield, level = SEA_LEVEL): Pt[][] {
  const { w, h, heights, cell, x0, y0 } = field;
  const up = (k: number) => heights[k]! > level;
  const crossing = (a: number, b: number, at: (t: number) => Pt) => {
    const ha = heights[a]!,
      hb = heights[b]!;
    return at((level - ha) / (hb - ha));
  };
  const points = new Map<number, Pt>();
  /** An edge's id: samples a and b (a below b) are its ends. */
  const edge = (a: number, b: number) => {
    const id = a * (w * h) + b;
    if (!points.has(id)) {
      const ai = a % w,
        aj = Math.floor(a / w),
        bi = b % w,
        bj = Math.floor(b / w);
      points.set(
        id,
        crossing(a, b, (t) => [x0 + (ai + (bi - ai) * t) * cell, y0 + (aj + (bj - aj) * t) * cell]),
      );
    }
    return id;
  };
  const links = new Map<number, number[]>();
  const link = (p: number, q: number) => {
    links.set(p, [...(links.get(p) ?? []), q]);
    links.set(q, [...(links.get(q) ?? []), p]);
  };
  for (let j = 0; j < h - 1; j++)
    for (let i = 0; i < w - 1; i++) {
      const sw = j * w + i,
        se = sw + 1,
        nw = sw + w,
        ne = nw + 1;
      const crossed: number[] = [];
      // Bottom, right, top, left.
      if (up(sw) !== up(se)) crossed.push(edge(sw, se));
      if (up(se) !== up(ne)) crossed.push(edge(se, ne));
      if (up(nw) !== up(ne)) crossed.push(edge(nw, ne));
      if (up(sw) !== up(nw)) crossed.push(edge(sw, nw));
      // Two crossings make a segment; four (a saddle) make two, cutting off the corners.
      if (crossed.length === 2) link(crossed[0]!, crossed[1]!);
      else if (crossed.length === 4) {
        link(crossed[0]!, crossed[3]!);
        link(crossed[1]!, crossed[2]!);
      }
    }
  return chain(links, points);
}

/** Walks the links into lines, starting open lines from their ends. */
function chain(links: Map<number, number[]>, points: Map<number, Pt>): Pt[][] {
  const seen = new Set<number>();
  const lines: Pt[][] = [];
  const walk = (start: number) => {
    const line: Pt[] = [];
    let at: number | undefined = start;
    while (at !== undefined && !seen.has(at)) {
      seen.add(at);
      line.push(points.get(at)!);
      at = links.get(at)!.find((n) => !seen.has(n));
    }
    // A closed line comes back to where it began.
    if (links.get(start)!.length === 2 && line.length > 2) line.push(line[0]!);
    lines.push(line);
  };
  for (const [id, next] of links) if (next.length === 1 && !seen.has(id)) walk(id);
  for (const id of links.keys()) if (!seen.has(id)) walk(id);
  return lines;
}
