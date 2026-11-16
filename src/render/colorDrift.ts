/**
 * The colour check of the two views (issue #573): the average colour of the sea, the land and the
 * sky in a screenshot, and how far apart two views are, as CIE76 colour distances (ΔE in Lab,
 * where about 2 is just visible and 10 is plainly another colour). Pure maths, no three.js.
 */

export const SURFACES = ['sea', 'land', 'sky'] as const;
export type Surface = (typeof SURFACES)[number];

/** One surface's average colour (sRGB 0..255) and its share of the screen (0..1). */
export interface SurfaceColor {
  rgb: [number, number, number];
  share: number;
}

export type ViewColors = Partial<Record<Surface, SurfaceColor>>;

/** Under this share of the screen a surface is too small to compare. */
export const MIN_SHARE = 0.01;

/**
 * Average colours per surface: `rgba` is the screenshot (4 bytes a pixel), `ids` the mask (one
 * class id a pixel: 1 sea, 2 land, 3 sky, anything else skipped).
 */
export function averageColors(rgba: ArrayLike<number>, ids: ArrayLike<number>): ViewColors {
  const sums = SURFACES.map(() => [0, 0, 0, 0]);
  for (let i = 0; i < ids.length; i++) {
    const sum = sums[ids[i]! - 1];
    if (!sum) continue;
    sum[0]! += rgba[i * 4]!;
    sum[1]! += rgba[i * 4 + 1]!;
    sum[2]! += rgba[i * 4 + 2]!;
    sum[3]!++;
  }
  const out: ViewColors = {};
  SURFACES.forEach((surface, i) => {
    const [r, g, b, n] = sums[i]!;
    if (!n || n / ids.length < MIN_SHARE) return;
    out[surface] = {
      rgb: [Math.round(r! / n!), Math.round(g! / n!), Math.round(b! / n!)],
      share: n! / ids.length,
    };
  });
  return out;
}

const linear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const labF = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);

/** sRGB (0..255) to CIE Lab, D65 white. */
export function toLab([r, g, b]: readonly [number, number, number]): [number, number, number] {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const x = (0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047;
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  const z = (0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883;
  const [fx, fy, fz] = [labF(x), labF(y), labF(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 distance between two sRGB colours. */
export function deltaE(a: readonly [number, number, number], b: readonly [number, number, number]) {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** The distance of each surface both views show enough of; the others are left out. */
export function viewDrift(top: ViewColors, follow: ViewColors): Partial<Record<Surface, number>> {
  const out: Partial<Record<Surface, number>> = {};
  for (const surface of SURFACES) {
    const a = top[surface];
    const b = follow[surface];
    if (a && b) out[surface] = deltaE(a.rgb, b.rgb);
  }
  return out;
}

export const hexOf = ([r, g, b]: readonly [number, number, number]) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

/** The limits of one atmosphere (`graphics.json` › `sky.check`, agreed with the art director). */
export interface DriftLimits {
  sea: number;
  seaIntoSun: number;
  fog: number;
}

/**
 * Whether two views share one atmosphere: the same fog, and the sea within its limit (a looser one
 * when the follow cam looks into the sun). Land is left out: the views see other faces of it.
 */
export function driftProblems(
  drift: Partial<Record<Surface, number>>,
  fogDrift: number,
  intoSun: boolean,
  limits: DriftLimits,
): string[] {
  const problems: string[] = [];
  const sea = intoSun ? limits.seaIntoSun : limits.sea;
  if (drift.sea !== undefined && drift.sea > sea)
    problems.push(`sea ΔE ${drift.sea.toFixed(1)} > ${sea}`);
  if (fogDrift > limits.fog) problems.push(`fog ΔE ${fogDrift.toFixed(1)} > ${limits.fog}`);
  return problems;
}

export const rgbOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
