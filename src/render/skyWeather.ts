import type { Storm } from '../sim/storms';
import { DEG, clamp } from '../sim/math';

/** `graphics.json` › `sky` › `clouds`/`streaks` › `amount`: the share of a layer the weather shows. */
export interface CloudAmount {
  /** Share shown on a calm, clear day. */
  clear: number;
  /** More for each knot of wind. */
  perKn: number;
  /** More under a grey sky, rain or a storm (gloom 1). */
  gloom: number;
}

/** 0..1: how much of a cloud layer shows in this wind (knots) and gloom (0..1). */
export const cloudAmount = (amount: Readonly<CloudAmount>, windKn: number, gloom: number) =>
  clamp(amount.clear + amount.perKn * windKn + amount.gloom * gloom, 0, 1);

/** `graphics.json` › `sky` › `squall`: how a storm off the bow shows on the horizon. */
export interface SquallShape {
  /** How far past its edge a storm still shows, map units. */
  rangeUnits: number;
  /** How high its cloud stands, map units: the nearer, the taller it looks. */
  heightUnits: number;
  /** The narrowest it looks round the horizon, half width, degrees. */
  minWidthDeg: number;
  /** The tallest it looks, degrees. */
  maxTopDeg: number;
}

/** A storm as the drawn sky shows it: a dark band round the horizon with rain under it. */
export interface SquallView {
  /** Toward it, flat, scene space (x east, z south). */
  x: number;
  z: number;
  /** Half its width round the horizon and its cloud's top, radians. */
  halfWidth: number;
  top: number;
  /** 0..1: none … full. */
  strength: number;
}

export const SQUALLS_SHOWN = 2;

export const blankSquall = (): SquallView => ({ x: 0, z: -1, halfWidth: 0, top: 0, strength: 0 });

/** Inside its edge the storm is the whole sky (the gloom), so the band fades in over this, units. */
const EDGE_FADE = 25;

/**
 * Writes the storm `s` as seen from the sim point (`x`, `y`) into `out`; its strength is 0 when it
 * is out of sight or over the boat. Distances from its edge: a storm belt's train of squalls
 * (decision 0167) shows as several bands marching in.
 */
export function squallView(
  out: SquallView,
  s: Readonly<Storm>,
  x: number,
  y: number,
  shape: Readonly<SquallShape>,
): SquallView {
  const dx = s.x - x;
  const dy = s.y - y;
  const dist = Math.max(Math.hypot(dx, dy), 1e-3);
  const gap = dist - s.radius;
  const near = clamp(gap / EDGE_FADE, 0, 1);
  const far = 1 - clamp((gap - shape.rangeUnits * 0.5) / (shape.rangeUnits * 0.5), 0, 1);
  out.x = dx / dist;
  out.z = -dy / dist;
  out.halfWidth = Math.max(shape.minWidthDeg * DEG, Math.atan(s.radius / dist));
  out.top = Math.min(shape.maxTopDeg * DEG, Math.atan(shape.heightUnits / Math.max(gap, 1)));
  out.strength = clamp(s.intensity, 0, 1) * near * far;
  return out;
}

/**
 * The strongest `out.length` squalls seen from (`x`, `y`) into `out` (the rest at strength 0),
 * without allocating: each storm is measured into `scratch` and kept if it beats the weakest.
 */
export function pickSqualls(
  out: SquallView[],
  scratch: SquallView,
  storms: readonly Storm[],
  x: number,
  y: number,
  shape: Readonly<SquallShape>,
): void {
  for (const v of out) v.strength = 0;
  for (const s of storms) {
    squallView(scratch, s, x, y, shape);
    if (scratch.strength <= 0) continue;
    let weakest = out[0]!;
    for (const v of out) if (v.strength < weakest.strength) weakest = v;
    if (scratch.strength > weakest.strength) Object.assign(weakest, scratch);
  }
}
