/**
 * How much the interface moves (decision 0274, Settings › Display › Motion): `full` slides, rolls
 * and stamps; `reduced` shows everything at once, without movement; `off` also leaves the
 * decorative moments out (the arrival banner, the stamp). Until Settings applies a choice, the
 * device's "reduce motion" asks decide between full and reduced.
 */
export const MOTION_MODES = ['full', 'reduced', 'off'] as const;
export type MotionMode = (typeof MOTION_MODES)[number];

export const isMotionMode = (v: unknown): v is MotionMode =>
  (MOTION_MODES as readonly unknown[]).includes(v);

let mode: MotionMode | null = null;

/** Applies the player's choice (and tells the stylesheets, `html[data-motion]`). */
export function setMotionMode(next: MotionMode | null): void {
  mode = next;
  if (typeof document === 'undefined') return;
  if (next) document.documentElement.dataset.motion = next;
  else delete document.documentElement.dataset.motion;
}

/** The chosen mode, or null while the device decides. */
export const motionMode = (): MotionMode | null => mode;
