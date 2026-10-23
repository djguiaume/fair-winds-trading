import type { TerrainDef } from './map';

export interface CoastDistance {
  /** Negative inside land, positive at sea. */
  distance: number;
  /** Normal pointing out of land at the nearest boundary. */
  nx: number;
  ny: number;
}

/** Nearest point on a simple (possibly concave) polygon. Works with either winding. */
export function coastDistance(x: number, y: number, outline: TerrainDef['outline']): CoastDistance {
  let inside = false;
  let bestSq = Infinity;
  let found = false;
  let qx = 0;
  let qy = 0;
  let edgeX = 1;
  let edgeY = 0;
  let area = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    area += a[0] * b[1] - b[0] * a[1];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / dy + a[0]) {
      inside = !inside;
    }
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq
      ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / lengthSq))
      : 0;
    const px = a[0] + dx * t;
    const py = a[1] + dy * t;
    const rx = x - px;
    const ry = y - py;
    const distanceSq = rx * rx + ry * ry;
    // Squared distances avoid a hypot per edge. Resolve rounding ties and overflow
    // with the original comparison so the chosen boundary normal stays stable.
    const uncertain =
      !Number.isFinite(distanceSq) ||
      Math.abs(distanceSq - bestSq) <= Number.EPSILON * 8 * Math.max(distanceSq, bestSq);
    const nearer = uncertain
      ? Math.hypot(rx, ry) < (found ? Math.hypot(x - qx, y - qy) : Infinity)
      : distanceSq < bestSq;
    if (nearer) {
      bestSq = distanceSq;
      found = true;
      qx = px;
      qy = py;
      edgeX = dx;
      edgeY = dy;
    }
  }
  const best = found ? Math.hypot(x - qx, y - qy) : Infinity;
  const sign = inside ? -1 : 1;
  if (best > 1e-8) {
    return { distance: best * sign, nx: ((x - qx) / best) * sign, ny: ((y - qy) / best) * sign };
  }
  const length = Math.hypot(edgeX, edgeY) || 1;
  const winding = area >= 0 ? 1 : -1;
  return { distance: 0, nx: (edgeY / length) * winding, ny: (-edgeX / length) * winding };
}

/**
 * The outline moved inward by `d` (mitred corners, capped at 3d). Meant for the gently curved
 * barrier and reef outlines: their cliff and grass tiers stay inside the collision shore.
 */
export function insetOutline(outline: TerrainDef['outline'], d: number): TerrainDef['outline'] {
  let area = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  const winding = area >= 0 ? 1 : -1;
  const inward = (a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy) || 1;
    return [(-dy / length) * winding, (dx / length) * winding] as const;
  };
  return outline.map((p, i) => {
    const prev = outline[(i + outline.length - 1) % outline.length]!;
    const next = outline[(i + 1) % outline.length]!;
    const n1 = inward(prev, p);
    const n2 = inward(p, next);
    const mx = n1[0] + n2[0];
    const my = n1[1] + n2[1];
    const ml = Math.hypot(mx, my) || 1;
    const along = Math.max((mx / ml) * n1[0] + (my / ml) * n1[1], 1 / 3);
    return [p[0] + ((mx / ml) * d) / along, p[1] + ((my / ml) * d) / along];
  });
}
