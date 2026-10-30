import { TUNING } from '../data/tuning';
import { createSeaState, seaStateAt, steadySeaState } from '../sim/seaState';
import { createWaveField, setWaveField, waveCount, waveHeightAt } from '../sim/waves';
import type { World } from '../sim/world';
import { waveHeight } from './oceanWaves';

/**
 * Which waves the sea draws (decision 0245, issue #280): `v1`, the classic three sines, or `v2`,
 * the wind and storm driven Gerstner waves (`?waves=v2`, a prototype until v1.3 ships them).
 */
export type WavesModel = 'v1' | 'v2';

export const wavesModel = (search: string): WavesModel => {
  const waves = new URLSearchParams(search).get('waves');
  return waves === 'v2' || (waves ?? '') in TUNING.waves.previews ? 'v2' : 'v1';
};

/** A review's fixed sea state (`?waves=calm|wind|storm`, `waves.json` › `previews`), or null. */
const previewOf = (search: string) => {
  const name = new URLSearchParams(search).get('waves') ?? '';
  return name in TUNING.waves.previews ? (name as keyof typeof TUNING.waves.previews) : null;
};

/** The defines a Gerstner ocean compiles with. */
export const gerstnerDefines = () => ({ GERSTNER: '', WAVE_COUNT: String(waveCount()) });

/** Its uniforms, before the first `writeUniforms`. */
export const gerstnerUniforms = () => ({
  uWave: { value: new Float32Array(4 * waveCount()) },
  uWaveShift: { value: new Float32Array(2 * waveCount()) },
});

/**
 * The sea's waves for the view: what the ocean draws and everything floats on. Under `?waves=v2`,
 * the sea state where the ship is, frozen each moment into one wave field that both floats things
 * and feeds the ocean shader; otherwise the classic waves. The field is a pure function of the
 * world's time, so it is rebuilt once per new time, never per frame rate or quality level.
 */
export class SeaWaves {
  /** `?waves=v2` (or a review preview): the ocean compiles the Gerstner shader. */
  readonly gerstner: boolean;
  private readonly preview: ReturnType<typeof previewOf>;
  private readonly sea = createSeaState();
  readonly field = createWaveField();
  private time = Number.NaN;

  constructor(
    private readonly world: () => World,
    search = location.search,
  ) {
    this.gerstner = wavesModel(search) === 'v2';
    this.preview = previewOf(search);
  }

  /** Bring the field to the world's time (once per time). */
  update(): void {
    const world = this.world();
    if (!this.gerstner || world.time === this.time) return;
    this.time = world.time;
    const { boat, map, time, windConfig } = world;
    if (this.preview) {
      const { speedKn, storm } = TUNING.waves.previews[this.preview];
      steadySeaState(world.wind.from, speedKn, storm, this.sea);
    } else seaStateAt(windConfig, map.seed, time, boat.x, boat.y, this.sea);
    setWaveField(this.field, this.sea, map.seed, time);
  }

  /** Height of the sea at scene (`x`, `z`) now: what boats, buoys, marks and wakes float on. */
  readonly heightAt = (x: number, z: number): number => {
    if (!this.gerstner) return waveHeight(x, z, this.world().time);
    this.update();
    return waveHeightAt(this.field, x, -z);
  };

  /**
   * Fill the shader's arrays for a grid of `cell` units: a wave shorter than `drawCells` cells
   * fades out, since the grid can't hold it. Drawing only: the CPU field keeps every physical wave.
   */
  writeUniforms(
    uniforms: { uWave: { value: Float32Array }; uWaveShift: { value: Float32Array } },
    cell: number,
  ) {
    const f = this.field;
    const [from, to] = TUNING.waves.drawCells as [number, number];
    const wave = uniforms.uWave.value;
    const shift = uniforms.uWaveShift.value;
    for (let i = 0; i < f.count; i++) {
      const t = Math.min(1, Math.max(0, (f.length[i]! / cell - from) / Math.max(1e-6, to - from)));
      const drawn = t * t * (3 - 2 * t);
      wave[4 * i] = f.kx[i]!;
      wave[4 * i + 1] = -f.ky[i]!;
      wave[4 * i + 2] = f.phase[i]!;
      wave[4 * i + 3] = f.amp[i]! * drawn;
      shift[2 * i] = f.shiftX[i]! * drawn;
      shift[2 * i + 1] = -f.shiftY[i]! * drawn;
    }
  }
}
