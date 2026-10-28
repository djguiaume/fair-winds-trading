import type { GroundDef } from '../../data/islands';

/**
 * A ground's `smooth` (issue #269): how much the new look rounds it, 0 (stays faceted) to 1 (the
 * default, left out of the file). Shared by the island builder's panel and `npm run island`.
 */
export function setSmooth(g: GroundDef, value: number | undefined) {
  if (value === undefined || !(value < 1)) delete g.smooth;
  else g.smooth = Math.max(0, Number(value.toFixed(2)));
}
