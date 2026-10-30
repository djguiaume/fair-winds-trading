import { coastDistance } from './coast';
import { edgeDistance, type IslandLayout, isSloped, rampAt } from './islandLayout';

/**
 * Distance to the nearest cliff: every edge of raised ground and its holes, but sloped ones, and
 * a ramp's sides. On a ramp only its sides count: it runs over the cliffs it climbs.
 */
export function cliffDistance(layout: IslandLayout, x: number, z: number) {
  let best = Infinity,
    onRamp = false;
  for (const r of layout.ramps) {
    const side = rampAt(r, x, z).distance - r.width / 2;
    if (side <= 0) onRamp = true;
    best = Math.min(best, Math.abs(side));
  }
  if (onRamp) return best;
  // Edges of lower ground buried under the ground here are no cliffs (issue #277).
  const top = Math.max(
    0,
    ...layout.surfaces
      .filter((s) => s.shape !== 'peak' && coastDistance(x, z, s.outline).distance <= 0)
      .map((s) => s.height),
  );
  for (const s of layout.surfaces) {
    if (s.height < top) continue;
    best = Math.min(
      best,
      edgeDistance(s.outline, x, z, (i) => !isSloped(s, i)),
    );
    for (const h of s.holes ?? []) best = Math.min(best, edgeDistance(h, x, z));
  }
  return best;
}
