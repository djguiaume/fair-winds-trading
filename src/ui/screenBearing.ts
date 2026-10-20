import type { ScreenPoint } from '../render/view';
import type { Vec2 } from '../sim/math';

/** Screen bearing at the boat, without projecting a far target behind the camera.
 * Perspective division reverses far-off bearings once they cross the camera plane.
 * A short step towards the target gives the local projected direction on the sea.
 */
export function screenBearing(
  project: (x: number, y: number) => ScreenPoint,
  boat: Vec2,
  target: Vec2,
): number {
  const dx = target.x - boat.x;
  const dy = target.y - boat.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return 0;
  const a = project(boat.x, boat.y);
  const b = project(boat.x + dx / length, boat.y + dy / length);
  const angle = Math.atan2(b.x - a.x, a.y - b.y);
  return Number.isFinite(angle) ? angle : 0;
}
