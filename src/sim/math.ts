/**
 * Small math helpers shared by the simulation.
 *
 * Conventions (used everywhere in `src/sim`):
 * - The water plane is 2D: x points east, y points north. 1 unit ≈ 1 m of game world.
 * - Angles are compass bearings in radians: 0 = north, π/2 = east (clockwise).
 */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export interface Vec2 {
  x: number;
  y: number;
}

/** Wrap an angle to (-π, π]. */
export function wrapAngle(a: number): number {
  const r = wrapPositive(a + Math.PI) - Math.PI;
  return r === -Math.PI ? Math.PI : r;
}

/** Wrap an angle to [0, 2π). */
export function wrapPositive(a: number): number {
  const r = a % TAU;
  return r < 0 ? r + TAU : r;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential approach of `current` to `target` at `rate` per second. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

/** Unit vector for a compass bearing. */
export function bearingVector(bearing: number): Vec2 {
  return { x: Math.sin(bearing), y: Math.cos(bearing) };
}

/** Compass bearing from `a` to `b`. */
export function bearingTo(a: Vec2, b: Vec2): number {
  return wrapPositive(Math.atan2(b.x - a.x, b.y - a.y));
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
