import { TUNING } from '../data/tuning';
import { clamp } from './math';
import { type LocalWeather, type WindConfig, windAt } from './wind';

/**
 * The sea state (decision 0245, issue #280): how high and which way each band of waves runs at a
 * place and moment, from the weather that already drives the sailing. Renderer independent and a
 * pure function of the wind config, seed, time and place, so it is the same at any frame rate or
 * quality and needs nothing saved. Depth and shelter are not inputs yet: they scale the waves
 * point by point on the CPU and GPU alike (#281).
 */

/** The wave bands, longest first: their tuning lives in `waves.json` › `bands`. */
export const WAVE_BANDS = ['swell', 'chop', 'ripple'] as const;
export type WaveBandName = (typeof WAVE_BANDS)[number];

/** How one band of waves stands. */
export interface BandState {
  /** Highest crest the band can raise, in map units above rest (the components never all peak at once). */
  height: number;
  /** Unit vector (sim x east, y north) the band runs toward: downwind, averaged over its window. */
  toX: number;
  toY: number;
  /** 0..1: 1 when the wind held one way over the window, 0 when it went all round (a confused sea). */
  coherence: number;
}

export type SeaState = Record<WaveBandName, BandState>;

export function createSeaState(): SeaState {
  const band = (): BandState => ({ height: 0, toX: 0, toY: 1, coherence: 0 });
  return { swell: band(), chop: band(), ripple: band() };
}

const weather: LocalWeather = {
  kind: '',
  rain: 0,
  showers: 0,
  gloom: 0,
  storm: 0,
  storms: [],
};
const at = { x: 0, y: 0 };

/**
 * The sea state at sim point (`x`, `y`) and time `t` (seconds). Each band averages the open-sea
 * wind (storms included) over its own window of the last `windowSec`: short for chop, which
 * answers a wind shift in seconds, long for swell, which builds as a storm arrives and keeps
 * running after it has gone. The window slides with `t`, so every change is smooth. Without a
 * wind (`config` null) the sea lies in its base swell.
 */
export function seaStateAt(
  config: WindConfig | null,
  seed: number,
  t: number,
  x: number,
  y: number,
  out: SeaState,
): SeaState {
  at.x = x;
  at.y = y;
  for (const name of WAVE_BANDS) {
    const tuning = TUNING.waves.bands[name];
    const state = out[name];
    if (!config) {
      state.height = tuning.base;
      state.coherence = 0;
      continue;
    }
    const n = Math.max(1, tuning.samples);
    let vx = 0,
      vy = 0,
      speed = 0,
      speed2 = 0,
      storm = 0;
    for (let i = 0; i < n; i++) {
      const ts = Math.max(0, t - (n > 1 ? (tuning.windowSec * i) / (n - 1) : 0));
      const wind = windAt(config, ts, seed, at, weather);
      // The wind blows FROM `from`; the waves run the other way.
      vx -= Math.sin(wind.from) * wind.speedKn;
      vy -= Math.cos(wind.from) * wind.speedKn;
      speed += wind.speedKn;
      speed2 += wind.speedKn * wind.speedKn;
      storm += weather.storm;
    }
    const along = Math.hypot(vx, vy);
    state.height = bandHeight(name, speed2 / n, storm / n);
    state.coherence = speed > 0 ? along / speed : 0;
    if (along > 0) {
      state.toX = vx / along;
      state.toY = vy / along;
    }
  }
  return out;
}

/** A band's height for a mean squared wind (kn²) and a mean storm strength (0..1). */
function bandHeight(name: WaveBandName, kn2: number, storm: number) {
  const tuning = TUNING.waves.bands[name];
  return clamp(tuning.base + tuning.perKn2 * kn2 + tuning.storm * storm, 0, tuning.max);
}

/**
 * The sea a steady wind of `speedKn` from bearing `from` (radians) raises once it has blown for
 * longer than every band's window, inside a storm of strength `storm` (0..1): the `waves.json` ›
 * `previews` sea states that reviews compare (`?waves=calm|wind|storm`).
 */
export function steadySeaState(from: number, speedKn: number, storm: number, out: SeaState) {
  for (const name of WAVE_BANDS) {
    const state = out[name];
    state.height = bandHeight(name, speedKn * speedKn, storm);
    state.toX = -Math.sin(from);
    state.toY = -Math.cos(from);
    state.coherence = 1;
  }
  return out;
}
