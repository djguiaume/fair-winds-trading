import { TUNING } from '../data/tuning';
import { DEG, TAU, bearingVector } from './math';
import { hash01 } from './noise';
import { WAVE_BANDS, type SeaState } from './seaState';
import { type BandCalm, type CoastGrid, coastCalmAt, createBandCalm } from './coastWaves';

/**
 * The waves (decision 0245, issue #280): a small set of Gerstner waves, frozen at one moment,
 * that the CPU samples for anything floating and the GPU draws (`render/seaWaves.ts`). Every band
 * is a fixed fan of components, one per compass direction, each with its own wavelength and
 * phase. A wind shift only moves height from one component to its neighbours, never turns a
 * component, so a crest never jumps. Sim coordinates: x east, y north, h up, all in map units.
 */
export interface WaveField {
  count: number;
  /** Wavenumber vector (radians per unit) toward where the component runs. */
  kx: Float64Array;
  ky: Float64Array;
  /** Phase at the field's time, in [0, 2π): the wave is `amp × sin(k·p + phase)`. */
  phase: Float64Array;
  /** Crest height (units). */
  amp: Float64Array;
  /** Horizontal Gerstner shift (units), along k: it gathers points under the crests. */
  shiftX: Float64Array;
  shiftY: Float64Array;
  /** Wavelength (units), for the renderer's grid limit. */
  length: Float64Array;
  /** 1 for a cosmetic band (ripples): drawn only, never felt by a boat. */
  cosmetic: Uint8Array;
  /** The component's band, its index in `WAVE_BANDS`: the coast calms each band its own way. */
  band: Uint8Array;
}

/** Components across every band, in `WAVE_BANDS` order. */
export function waveCount(): number {
  return WAVE_BANDS.reduce((n, band) => n + TUNING.waves.bands[band].lengths.length, 0);
}

export function createWaveField(): WaveField {
  const n = waveCount();
  const f64 = () => new Float64Array(n);
  return {
    count: n,
    kx: f64(),
    ky: f64(),
    phase: f64(),
    amp: f64(),
    shiftX: f64(),
    shiftY: f64(),
    length: f64(),
    cosmetic: new Uint8Array(n),
    band: new Uint8Array(n),
  };
}

/**
 * Freeze the waves of `sea` at time `t` into `field`. The phase is wound back in double precision
 * here, so the GPU never multiplies a large time in single precision. Height spreads over a band's
 * fan as `max(0, cos)^spread` of each component's angle from downwind, blended toward an even
 * spread as the band's coherence drops; the shares sum to 1, so a wind shift keeps the height.
 * The shifts are scaled down together when their slopes add past `steepLimit` (below 1), so the
 * surface never folds over and `waveHeightAt` can always find the point under a spot.
 */
export function setWaveField(field: WaveField, sea: SeaState, seed: number, t: number): void {
  const { gravity, steepLimit } = TUNING.waves;
  let c = 0;
  let slope = 0;
  WAVE_BANDS.forEach((name, b) => {
    const band = TUNING.waves.bands[name];
    const state = sea[name];
    const n = band.lengths.length;
    let total = 0;
    for (let i = 0; i < n; i++)
      total += lean(band.offsetDeg, i, n, state.toX, state.toY, band.spread);
    for (let i = 0; i < n; i++, c++) {
      const bearing = (band.offsetDeg + (i * 360) / n) * DEG;
      const dir = bearingVector(bearing);
      const k = TAU / band.lengths[i]!;
      const omega = Math.sqrt(gravity * k);
      const along =
        total > 0 ? lean(band.offsetDeg, i, n, state.toX, state.toY, band.spread) / total : 1 / n;
      const share = (1 - state.coherence) / n + state.coherence * along;
      const amp = state.height * share;
      field.kx[c] = dir.x * k;
      field.ky[c] = dir.y * k;
      field.phase[c] = wrapPhase(TAU * hash01(seed, b, i) - omega * t);
      field.amp[c] = amp;
      field.shiftX[c] = dir.x * band.steepness * amp;
      field.shiftY[c] = dir.y * band.steepness * amp;
      field.length[c] = band.lengths[i]!;
      field.cosmetic[c] = band.cosmetic ? 1 : 0;
      field.band[c] = b;
      slope += band.steepness * amp * k;
    }
  });
  if (slope > steepLimit) {
    const scale = steepLimit / slope;
    for (let i = 0; i < c; i++) {
      field.shiftX[i] = field.shiftX[i]! * scale;
      field.shiftY[i] = field.shiftY[i]! * scale;
    }
  }
}

/** How much component `i` of an `n` fan lines up with the way the band runs, to the `spread` power. */
function lean(offsetDeg: number, i: number, n: number, toX: number, toY: number, spread: number) {
  const dir = bearingVector((offsetDeg + (i * 360) / n) * DEG);
  return Math.max(0, dir.x * toX + dir.y * toY) ** spread;
}

function wrapPhase(a: number) {
  return a - TAU * Math.floor(a / TAU);
}

/** Where a point of the flat sea moves to: horizontal shift and height. */
export interface WaveOffset {
  x: number;
  y: number;
  h: number;
}

const open = createBandCalm();

/**
 * The physical waves' offset of the rest point (`x`, `y`), cosmetic bands left out, each band
 * calmed by its share `calm` there (`coastWaves.ts`; open sea when left out).
 */
export function waveOffsetAt(
  field: WaveField,
  x: number,
  y: number,
  out: WaveOffset,
  calm: BandCalm = open,
): WaveOffset {
  out.x = out.y = out.h = 0;
  for (let i = 0; i < field.count; i++) {
    if (field.cosmetic[i]) continue;
    const theta = field.kx[i]! * x + field.ky[i]! * y + field.phase[i]!;
    const share = calm[field.band[i]!]!;
    const cos = Math.cos(theta) * share;
    out.x += field.shiftX[i]! * cos;
    out.y += field.shiftY[i]! * cos;
    out.h += field.amp[i]! * share * Math.sin(theta);
  }
  return out;
}

const scratch: WaveOffset = { x: 0, y: 0, h: 0 };
const calmHere = createBandCalm();

/**
 * The rest point that the waves carry over the spot (`x`, `y`), found by fixed-point steps
 * (`inverseSteps`): the shifts' slopes stay under `steepLimit`, and the coast's calm changes over
 * tens of units, so each step shrinks the error. Written to `out` with that point's offset; the
 * calm there is left in `calmHere`.
 */
function restUnder(
  field: WaveField,
  coast: CoastGrid | null,
  x: number,
  y: number,
  out: WaveOffset,
): WaveOffset {
  let px = x,
    py = y;
  for (let s = 0; s < TUNING.waves.inverseSteps; s++) {
    waveOffsetAt(field, px, py, out, coastCalmAt(coast, px, py, calmHere));
    px = x - out.x;
    py = y - out.y;
  }
  waveOffsetAt(field, px, py, out, coastCalmAt(coast, px, py, calmHere));
  out.x = px;
  out.y = py;
  return out;
}

/**
 * Height of the physical sea surface over the sim spot (`x`, `y`): what a boat there floats on,
 * calmed by the coast's bake when there is one.
 */
export function waveHeightAt(
  field: WaveField,
  x: number,
  y: number,
  coast: CoastGrid | null = null,
): number {
  return restUnder(field, coast, x, y, scratch).h;
}

/**
 * Unit normal of the physical surface over the sim spot (`x`, `y`): x east, y north, z up. The
 * cross product of the displaced surface's two tangents at the rest point under the spot: exact
 * on the open sea; near the coast the calm's own slope, a share over tens of units, is left out.
 */
export function waveNormalAt(
  field: WaveField,
  x: number,
  y: number,
  out: { x: number; y: number; z: number },
  coast: CoastGrid | null = null,
) {
  restUnder(field, coast, x, y, scratch);
  // Tangents along rest x (ax, ay, ah) and rest y (bx, by, bh).
  let ax = 1,
    ay = 0,
    ah = 0,
    bx = 0,
    by = 1,
    bh = 0;
  for (let i = 0; i < field.count; i++) {
    if (field.cosmetic[i]) continue;
    const kx = field.kx[i]!,
      ky = field.ky[i]!;
    const theta = kx * scratch.x + ky * scratch.y + field.phase[i]!;
    const share = calmHere[field.band[i]!]!;
    const sin = Math.sin(theta) * share,
      cos = Math.cos(theta) * share;
    ax -= field.shiftX[i]! * kx * sin;
    ay -= field.shiftY[i]! * kx * sin;
    ah += field.amp[i]! * kx * cos;
    bx -= field.shiftX[i]! * ky * sin;
    by -= field.shiftY[i]! * ky * sin;
    bh += field.amp[i]! * ky * cos;
  }
  const nx = ay * bh - ah * by,
    ny = ah * bx - ax * bh,
    nz = ax * by - ay * bx;
  const len = Math.hypot(nx, ny, nz);
  out.x = nx / len;
  out.y = ny / len;
  out.z = nz / len;
  return out;
}
