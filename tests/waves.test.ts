import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { WAVE_BANDS, createSeaState, seaStateAt, steadySeaState } from '../src/sim/seaState';
import { stormsAt } from '../src/sim/storms';
import { DEFAULT_WEATHER, type WindConfig, withoutStorms } from '../src/sim/wind';
import {
  createWaveField,
  setWaveField,
  waveHeightAt,
  waveNormalAt,
  waveOffsetAt,
} from '../src/sim/waves';

const seed = 11;
const steady = (fromDeg: number, speedKn: number): WindConfig => ({
  fromDeg,
  speedKn,
  gustiness: 0,
  shiftDeg: 0,
});
const sea = (config: WindConfig | null, t: number, x = 0, y = 0) =>
  seaStateAt(config, seed, t, x, y, createSeaState());
const fieldOf = (config: WindConfig | null, t: number, x = 0, y = 0) => {
  const field = createWaveField();
  setWaveField(field, sea(config, t, x, y), seed, t);
  return field;
};
const highest = () => WAVE_BANDS.reduce((h, b) => h + TUNING.waves.bands[b].max, 0);
/** The heaviest sea the tuning allows: every band at its highest. */
const stormField = (t = 0) => {
  const state = createSeaState();
  for (const b of WAVE_BANDS)
    Object.assign(state[b], { height: TUNING.waves.bands[b].max, coherence: 0.6 });
  const field = createWaveField();
  setWaveField(field, state, seed, t);
  return field;
};

describe('sea state (0245)', () => {
  it('lies in its base swell without wind, and stays low in a calm', () => {
    const still = sea(null, 100);
    for (const b of WAVE_BANDS) expect(still[b].height).toBe(TUNING.waves.bands[b].base);
    const calm = sea(steady(0, 2), 100);
    expect(calm.chop.height).toBeLessThan(0.05);
    expect(calm.swell.height).toBeLessThan(0.2);
  });

  it('grows with the wind and runs downwind', () => {
    const light = sea(steady(90, 8), 300);
    const fresh = sea(steady(90, 20), 300);
    expect(fresh.chop.height).toBeGreaterThan(light.chop.height * 2);
    // From the east: the waves run west.
    expect(fresh.chop.toX).toBeCloseTo(-1, 6);
    expect(fresh.chop.coherence).toBeCloseTo(1, 6);
  });

  it('changes smoothly as the weather wanders: no band ever jumps', () => {
    const config: WindConfig = {
      ...steady(0, 12),
      gustiness: 0.15,
      shiftDeg: 10,
      weather: withoutStorms(DEFAULT_WEATHER),
    };
    let worst = 0;
    let previous = sea(config, 0);
    for (let t = 0.05; t < 1800; t += 0.05) {
      const now = sea(config, t);
      for (const b of WAVE_BANDS) {
        worst = Math.max(worst, Math.abs(now[b].height - previous[b].height));
        worst = Math.max(
          worst,
          Math.hypot(now[b].toX - previous[b].toX, now[b].toY - previous[b].toY) * now[b].coherence,
        );
      }
      previous = now;
    }
    // A twentieth of a second moves a band by a hair: the sea follows the wind without a jump.
    expect(worst).toBeLessThan(0.005);
  });

  it("reaches a steady wind's sea once the wind has blown longer than every window", () => {
    const windows = sea(steady(90, 14), 1000);
    const settled = steadySeaState(Math.PI / 2, 14, 0, createSeaState());
    for (const b of WAVE_BANDS) expect(settled[b].height).toBeCloseTo(windows[b].height, 9);
    const storm = steadySeaState(0, 26, 1, createSeaState());
    for (const b of ['swell', 'chop'] as const)
      expect(storm[b].height).toBeGreaterThan(settled[b].height);
  });

  it('is the same at any frame rate: a pure function of time and place', () => {
    const config: WindConfig = { ...steady(30, 14), weather: DEFAULT_WEATHER };
    const once = sea(config, 900, 50, -20);
    for (let t = 0; t < 900; t += 1 / 7) sea(config, t, 50, -20);
    expect(sea(config, 900, 50, -20)).toEqual(once);
  });

  it('builds as a storm arrives and keeps running for a while after it has gone', () => {
    const storms = DEFAULT_WEATHER.storms!;
    let t = 0;
    while (!stormsAt(storms, seed, t).some((s) => s.intensity > 0.9)) t += 10;
    const storm = stormsAt(storms, seed, t).find((s) => s.intensity > 0.9)!;
    const config: WindConfig = { ...steady(0, 12), weather: DEFAULT_WEATHER };
    const calmer: WindConfig = { ...config, weather: withoutStorms(DEFAULT_WEATHER) };
    // The storm's own share of the swell at the spot its centre crosses at `t`.
    const extra = (dt: number) =>
      sea(config, t + dt, storm.x, storm.y).swell.height -
      sea(calmer, t + dt, storm.x, storm.y).swell.height;
    const leaves = storm.radius / storms.speed;
    const window = TUNING.waves.bands.swell.windowSec;
    expect(extra(-leaves - 10)).toBe(0);
    expect(extra(0)).toBeGreaterThan(0.1);
    // Long gone from the spot, the storm's swell still runs there.
    expect(extra(leaves + window / 2)).toBeGreaterThan(extra(0));
    expect(extra(leaves + window + 10)).toBe(0);
  });
});

describe('wave field (0245)', () => {
  it('keeps every wave in place as the wind turns: only heights move', () => {
    const a = fieldOf(steady(0, 15), 500);
    const b = fieldOf(steady(120, 15), 500);
    expect(b.kx).toEqual(a.kx);
    expect(b.ky).toEqual(a.ky);
    expect(b.phase).toEqual(a.phase);
    const total = (f: typeof a) => f.amp.reduce((s, v) => s + v, 0);
    expect(total(b)).toBeCloseTo(total(a), 9);
  });

  it('stays finite and bounded, and never folds over', () => {
    const field = stormField(36_000);
    let slope = 0;
    for (let i = 0; i < field.count; i++)
      slope +=
        Math.hypot(field.shiftX[i]!, field.shiftY[i]!) * Math.hypot(field.kx[i]!, field.ky[i]!);
    expect(slope).toBeLessThanOrEqual(TUNING.waves.steepLimit + 1e-9);
    const normal = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 400; i++) {
      const x = ((i * 37) % 900) - 450,
        y = ((i * 53) % 900) - 450;
      const h = waveHeightAt(field, x, y);
      expect(Number.isFinite(h)).toBe(true);
      expect(Math.abs(h)).toBeLessThanOrEqual(highest());
      waveNormalAt(field, x, y, normal);
      expect(normal.z).toBeGreaterThan(0);
    }
  });

  it('finds the height under a spot within 0.01 units, even in the heaviest sea', () => {
    const field = stormField(1234.5);
    const offset = { x: 0, y: 0, h: 0 };
    let worst = 0;
    for (let i = 0; i < 400; i++) {
      const x = ((i * 41) % 600) - 300,
        y = ((i * 67) % 600) - 300;
      waveOffsetAt(field, x, y, offset);
      worst = Math.max(worst, Math.abs(waveHeightAt(field, x + offset.x, y + offset.y) - offset.h));
    }
    expect(worst).toBeLessThan(0.01);
  });

  it('gives the normal of the surface it samples', () => {
    const field = stormField(77);
    const n = { x: 0, y: 0, z: 0 };
    const e = 0.01;
    for (const [x, y] of [
      [3, 4],
      [-120, 60],
      [200, -310],
    ] as const) {
      waveNormalAt(field, x, y, n);
      const dx = (waveHeightAt(field, x + e, y) - waveHeightAt(field, x - e, y)) / (2 * e);
      const dy = (waveHeightAt(field, x, y + e) - waveHeightAt(field, x, y - e)) / (2 * e);
      expect(-n.x / n.z).toBeCloseTo(dx, 2);
      expect(-n.y / n.z).toBeCloseTo(dy, 2);
    }
  });

  it('floats boats on the physical waves only: ripples never move them', () => {
    const field = fieldOf(steady(45, 18), 600);
    const before = waveHeightAt(field, 10, 20);
    for (let i = 0; i < field.count; i++) if (field.cosmetic[i]) field.amp[i] = 5;
    expect(waveHeightAt(field, 10, 20)).toBe(before);
  });
});
