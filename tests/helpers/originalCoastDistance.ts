import type { TerrainDef } from '../../src/sim/map';

export interface CoastDistance {
  /** Negative inside land, positive at sea. */
  distance: number;
  /** Normal pointing out of land at the nearest boundary. */
  nx: number;
  ny: number;
}

/** Nearest point on a simple (possibly concave) polygon. Works with either winding. */
export function originalCoastDistance(
  x: number,
  y: number,
  outline: TerrainDef['outline'],
): CoastDistance {
  let inside = false;
  let best = Infinity;
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
    const d = Math.hypot(x - px, y - py);
    if (d < best) {
      best = d;
      qx = px;
      qy = py;
      edgeX = dx;
      edgeY = dy;
    }
  }
  const sign = inside ? -1 : 1;
  if (best > 1e-8) {
    return { distance: best * sign, nx: ((x - qx) / best) * sign, ny: ((y - qy) / best) * sign };
  }
  const length = Math.hypot(edgeX, edgeY) || 1;
  const winding = area >= 0 ? 1 : -1;
  return { distance: 0, nx: (edgeY / length) * winding, ny: (-edgeX / length) * winding };
}
