import { TUNING } from '../../../data/tuning';
import type { SculptOp } from '../../../data/islands';
import type { SculptBrush } from '../../../sim/sculptSession';

/** The five terrain tools, in the order the panel lists them. */
export const TERRAIN_TOOLS: readonly SculptOp[] = ['raise', 'lower', 'flatten', 'smooth', 'slope'];

/**
 * The terrain brush as the panel holds it (issue #271): sizes in the file's radius units, like the
 * saved edits, so what is shown is what is stored. `lift` is what raise and lower add per dab;
 * `share` is how far the other tools pull the ground toward their target each dab.
 */
export interface BrushSettings {
  tool: SculptOp;
  radius: number;
  lift: number;
  share: number;
  falloff: number;
  /** `flatten`: the height pulled to; null until picked, then the ground where the tool was chosen. */
  height: number | null;
  override: boolean;
}

/** A slider's range from `terrain.json › sculpt.editor`: [min, max, step, start]. */
function range([min, max, step, start]: readonly number[]) {
  return { min: min!, max: max!, step: step!, start: start! };
}

/** The ranges of the brush's controls. */
export function brushRanges() {
  const e = TUNING.terrain.sculpt.editor;
  return {
    radius: range(e.radius),
    raise: range(e.raise),
    share: range(e.share),
    falloff: range(e.falloff),
    height: range(e.height),
  };
}

export function defaultBrush(): BrushSettings {
  const { radius, raise, share } = brushRanges();
  return {
    tool: 'raise',
    radius: radius.start,
    lift: raise.start,
    share: share.start,
    falloff: TUNING.terrain.sculpt.falloff,
    height: null,
    override: false,
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** The setting a tool's strength control edits. */
export const strengthKey = (tool: SculptOp): 'lift' | 'share' =>
  tool === 'raise' || tool === 'lower' ? 'lift' : 'share';

/** Keeps every setting inside the ranges of `terrain.json › sculpt.editor`. */
export function clampBrush(b: BrushSettings): BrushSettings {
  const { radius, raise, share, falloff, height } = brushRanges();
  return {
    ...b,
    radius: clamp(b.radius, radius.min, radius.max),
    lift: clamp(b.lift, raise.min, raise.max),
    share: clamp(b.share, share.min, share.max),
    falloff: clamp(b.falloff, falloff.min, falloff.max),
    height: b.height === null ? null : clamp(b.height, height.min, height.max),
  };
}

/** The brush a drag begins with: an edit before its points. */
export function sculptBrush(b: BrushSettings): SculptBrush {
  const { tool } = b;
  return {
    op: tool,
    radius: b.radius,
    strength: b[strengthKey(tool)],
    falloff: b.falloff,
    ...(tool === 'flatten' && { height: b.height ?? 0 }),
    ...(b.override && { override: true }),
  };
}

/** The brush made bigger or smaller by a factor, as the bracket keys and the wheel do. */
export function resized(b: BrushSettings, factor: number): BrushSettings {
  return clampBrush({ ...b, radius: b.radius * factor });
}
