import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { oceanVertexShader } from '../src/render/oceanWaves';
import { gerstnerDefines, gerstnerUniforms, SeaWaves } from '../src/render/seaWaves';
import { WAVE_BANDS, createSeaState } from '../src/sim/seaState';
import { setWaveField, waveOffsetAt } from '../src/sim/waves';

const f = Math.fround;

/**
 * The shader's `waveOffset`, in single precision as a GPU runs it, from the uniforms: each band
 * (`SWELL_END`, `CHOP_END`) times its share `calm`.
 */
function gpuOffset(
  u: ReturnType<typeof gerstnerUniforms>,
  count: number,
  x: number,
  z: number,
  calm = [1, 1, 1],
) {
  const defines = gerstnerDefines(true);
  const swellEnd = Number(defines.SWELL_END),
    chopEnd = Number(defines.CHOP_END);
  const px = f(x),
    pz = f(z);
  const w = u.uWave.value,
    s = u.uWaveShift.value;
  let ox = 0,
    oy = 0,
    oz = 0;
  for (let i = 0; i < count; i++) {
    const theta = f(f(f(w[4 * i]! * px) + f(w[4 * i + 1]! * pz)) + w[4 * i + 2]!);
    const share = f(i < swellEnd ? calm[0]! : i < chopEnd ? calm[1]! : calm[2]!);
    const cos = f(f(Math.cos(theta)) * share),
      sin = f(Math.sin(theta));
    ox = f(ox + f(s[2 * i]! * cos));
    oz = f(oz + f(s[2 * i + 1]! * cos));
    oy = f(oy + f(f(w[4 * i + 3]! * share) * sin));
  }
  return { x: ox, y: oy, z: oz };
}

/** A heavy, wind-driven sea after ten hours of play, physical bands only. */
function heavySea(t = 36_000) {
  const waves = new SeaWaves(() => {
    throw new Error('no world in a contract test');
  }, '?waves=v2');
  const state = createSeaState();
  for (const b of WAVE_BANDS)
    Object.assign(state[b], {
      height: TUNING.waves.bands[b].max,
      toX: 0.6,
      toY: -0.8,
      coherence: 0.8,
    });
  setWaveField(waves.field, state, 5, t);
  return waves;
}

describe('CPU/GPU wave contract (0245)', () => {
  it('draws, within a thousandth of a unit, the waves the CPU floats boats on', () => {
    const waves = heavySea();
    const field = waves.field;
    for (let i = 0; i < field.count; i++)
      if (field.cosmetic[i]) field.amp[i] = field.shiftX[i] = field.shiftY[i] = 0;
    const u = gerstnerUniforms();
    // A grid fine enough to hold every wave.
    waves.writeUniforms(u, 0.1);
    const cpu = { x: 0, y: 0, h: 0 };
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      // Scene x, z out to the far side of the biggest sea.
      const x = ((i * 97) % 1800) - 900,
        z = ((i * 61) % 1800) - 900;
      const gpu = gpuOffset(u, field.count, x, z);
      waveOffsetAt(field, x, -z, cpu);
      worst = Math.max(
        worst,
        Math.abs(gpu.x - cpu.x),
        Math.abs(gpu.y - cpu.h),
        Math.abs(gpu.z + cpu.y),
      );
    }
    expect(worst).toBeLessThan(1e-3);
  });

  it('calms each band near the coast by the same share on both sides (issue #281)', () => {
    const waves = heavySea();
    const field = waves.field;
    for (let i = 0; i < field.count; i++)
      if (field.cosmetic[i]) field.amp[i] = field.shiftX[i] = field.shiftY[i] = 0;
    const u = gerstnerUniforms();
    waves.writeUniforms(u, 0.1);
    const calm = Float64Array.of(0.2, 0.55, 0.8);
    const cpu = { x: 0, y: 0, h: 0 };
    let worst = 0;
    for (let i = 0; i < 100; i++) {
      const x = ((i * 89) % 600) - 300,
        z = ((i * 53) % 600) - 300;
      const gpu = gpuOffset(u, field.count, x, z, [...calm]);
      waveOffsetAt(field, x, -z, cpu, calm);
      worst = Math.max(
        worst,
        Math.abs(gpu.x - cpu.x),
        Math.abs(gpu.y - cpu.h),
        Math.abs(gpu.z + cpu.y),
      );
    }
    expect(worst).toBeLessThan(1e-3);
    expect(oceanVertexShader).toContain('i < SWELL_END ? calm.x');
  });

  it('winds the phase back on the CPU, so a long voyage never loses precision', () => {
    const { field } = heavySea(1e7);
    for (const phase of field.phase) {
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(2 * Math.PI);
    }
  });

  it("fades out the waves a coarse grid can't hold, for drawing only", () => {
    const waves = heavySea();
    const u = gerstnerUniforms();
    const cell = 10;
    waves.writeUniforms(u, cell);
    const [from, to] = TUNING.waves.drawCells as [number, number];
    for (let i = 0; i < waves.field.count; i++) {
      const cells = waves.field.length[i]! / cell;
      const drawn = u.uWave.value[4 * i + 3]!;
      if (cells <= from) expect(drawn).toBe(0);
      if (cells >= to) expect(drawn).toBeCloseTo(waves.field.amp[i]!, 5);
    }
    expect(oceanVertexShader).toContain('uWave[WAVE_COUNT]');
  });
});
