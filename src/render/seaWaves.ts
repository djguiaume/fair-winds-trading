import { TUNING } from '../data/tuning';
import { createSeaState, seaStateAt, steadySeaState } from '../sim/seaState';
import { createWaveField, setWaveField, waveCount, waveHeightAt } from '../sim/waves';
import type { World } from '../sim/world';

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

/**
 * The GPU half of the wave contract: `uWave[i]` = (k.x, k.z, phase, height) and `uWaveShift[i]`
 * = Gerstner shift (x, z), in scene space (z = -sim y), filled by `SeaWaves.writeUniforms`.
 * Returns the offset (x, height, z) of the rest point `p` (scene x, z): the same sum as the CPU's
 * `waveOffsetAt`, plus the cosmetic bands.
 */
export const gerstnerShader = /* glsl */ `
uniform vec4 uWave[WAVE_COUNT];
uniform vec2 uWaveShift[WAVE_COUNT];

vec3 waveOffset(vec2 p) {
  vec3 o = vec3(0.0);
  for (int i = 0; i < WAVE_COUNT; i++) {
    float theta = dot(uWave[i].xy, p) + uWave[i].z;
    o.xz += uWaveShift[i] * cos(theta);
    o.y += uWave[i].w * sin(theta);
  }
  return o;
}
`;

/** The defines a Gerstner ocean compiles with. */
export const gerstnerDefines = () => ({ GERSTNER: '', WAVE_COUNT: String(waveCount()) });

/** Its uniforms, before the first `writeUniforms`. */
export const gerstnerUniforms = () => ({
  uWave: { value: new Float32Array(4 * waveCount()) },
  uWaveShift: { value: new Float32Array(2 * waveCount()) },
});

/**
 * The sea's waves for the view: each frame, the sea state where the ship is, frozen into one wave
 * field that both floats things (`heightAt`) and feeds the ocean shader. The field is a pure
 * function of the world's time, so a frame rate or quality level never changes it.
 */
export class SeaWaves {
  private readonly sea = createSeaState();
  readonly field = createWaveField();

  /** A review preview (`?waves=storm`) holds the sea in that state. */
  constructor(private readonly preview = previewOf(location.search)) {}

  update(world: World): void {
    const { boat, map, time, windConfig } = world;
    if (this.preview) {
      const { speedKn, storm } = TUNING.waves.previews[this.preview];
      steadySeaState(world.wind.from, speedKn, storm, this.sea);
    } else seaStateAt(windConfig, map.seed, time, boat.x, boat.y, this.sea);
    setWaveField(this.field, this.sea, map.seed, time);
  }

  /** Height of the physical sea at scene (`x`, `z`). */
  readonly heightAt = (x: number, z: number): number => waveHeightAt(this.field, x, -z);

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
