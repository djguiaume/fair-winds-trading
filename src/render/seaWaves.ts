import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import type { CoastGrid } from '../sim/coastWaves';
import { WAVE_BANDS, createSeaState, seaStateAt, steadySeaState } from '../sim/seaState';
import { createWaveField, setWaveField, waveCount, waveHeightAt } from '../sim/waves';
import type { LocalWeather } from '../sim/wind';
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

/** Where each band's components end in the field (swell first), for the shader's calm. */
const bandEnd = (band: number) =>
  WAVE_BANDS.slice(0, band + 1).reduce((n, b) => n + TUNING.waves.bands[b].lengths.length, 0);

const RIPPLE = WAVE_BANDS.indexOf('ripple');

/** The defines a Gerstner ocean compiles with; `coast` adds the coast's calm (issue #281). */
export const gerstnerDefines = (coast = false) => ({
  GERSTNER: '',
  WAVE_COUNT: String(waveCount()),
  SWELL_END: String(bandEnd(0)),
  CHOP_END: String(bandEnd(1)),
  ...(coast ? { COAST: '' } : {}),
});

/** Its uniforms, before the first `writeUniforms`. */
export const gerstnerUniforms = () => ({
  uWave: { value: new Float32Array(4 * waveCount()) },
  uWaveShift: { value: new Float32Array(2 * waveCount()) },
  uWaveFine: { value: new Float32Array(waveCount()) },
  uWaveLook: { value: new THREE.Vector4() },
  uWaveTone: { value: new THREE.Vector3(0, 0, 1) },
  uBandHeight: { value: new THREE.Vector3() },
  uCoast: { value: new THREE.Vector4() },
  uCoastReach: { value: new THREE.Vector3() },
  uSeaFoam: { value: new THREE.Vector4() },
  uSeaWind: { value: new THREE.Vector4(0, -1, 1, 0) },
  uFoamBreakup: { value: 1 },
  uFoamCap: { value: new THREE.Color(1, 1, 1) },
});

type WaveUniforms = { [K in keyof ReturnType<typeof gerstnerUniforms>]: { value: unknown } };

/** A wave of `length` drawn on a grid of `cell` units: 0 to 1 between `drawCells` cells a wave. */
export function drawnOn(length: number, cell: number) {
  return cellStep(length / cell, TUNING.waves.drawCells as [number, number]);
}

/**
 * A wave of `length` shaded per vertex on a grid of `cell` units: 0 to 1 between `shadeCells`
 * cells a wave. A shorter one would alias into slopes that aren't there (issue #282).
 */
function shadedOn(length: number, cell: number) {
  return cellStep(length / cell, TUNING.waves.shadeCells as [number, number]);
}

function cellStep(cells: number, [from, to]: [number, number]) {
  const t = Math.min(1, Math.max(0, (cells - from) / Math.max(1e-6, to - from)));
  return t * t * (3 - 2 * t);
}

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
  /** The land's bake the coast calms the waves by (the view's seabed); none: open sea everywhere. */
  coast: CoastGrid | null = null;
  private readonly shown = {} as LocalWeather;

  constructor(
    private readonly world: () => World,
    search = location.search,
  ) {
    this.gerstner = wavesModel(search) === 'v2';
    this.preview = previewOf(search);
  }

  /** Calm the waves by `seabed`'s bake (the view's, rebaked on a land edit); returns it. */
  calmBy<T extends { bake: CoastGrid }>(seabed: T): T {
    this.coast = this.gerstner ? seabed.bake : null;
    return seabed;
  }

  /**
   * The weather the sky and the water show: a review preview's storm (`previews.*.storm`) brings
   * its gloom too, as a real storm would, so `?waves=storm` shows the whole storm look.
   */
  shownWeather(weather: LocalWeather): LocalWeather {
    const storm = this.preview ? TUNING.waves.previews[this.preview].storm : 0;
    if (storm <= weather.storm) return weather;
    Object.assign(this.shown, weather).storm = storm;
    return this.shown;
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
    return waveHeightAt(this.field, x, -z, this.coast);
  };

  /**
   * How far a grid of `cell` units, drawing the waves the ocean's grid of `drawn` units draws,
   * parts from the true surface between its points (a cell's diagonal): each wave's chord sag, at
   * most its full height. The sheets riding the waves float clear of it.
   */
  sag(cell: number, drawn: number) {
    const f = this.field;
    const span = cell * Math.SQRT2;
    let sag = 0;
    for (let i = 0; i < f.count; i++) {
      const a = f.amp[i]! * drawnOn(f.length[i]!, drawn);
      const k = (2 * Math.PI) / f.length[i]!;
      sag += Math.min(2 * a, (a * (k * span) ** 2) / 8);
    }
    return sag;
  }

  /**
   * Fill the shader's arrays for a grid of `cell` units: a wave shorter than `drawCells` cells
   * fades out of the grid, since it can't hold it, into `uWaveFine`, which only shades (issue
   * #282): per vertex as far as the grid can sample it, and the ripples per pixel on a `perPixel`
   * ocean (Medium and up). Drawing only: the CPU field keeps every physical wave.
   */
  writeUniforms(uniforms: WaveUniforms, cell: number, perPixel = false) {
    const f = this.field;
    const wave = uniforms.uWave.value as Float32Array;
    const shift = uniforms.uWaveShift.value as Float32Array;
    const fine = uniforms.uWaveFine.value as Float32Array;
    const bands = (uniforms.uBandHeight.value as THREE.Vector3).set(0, 0, 0);
    for (let i = 0; i < f.count; i++) {
      const drawn = drawnOn(f.length[i]!, cell);
      bands.setComponent(f.band[i]!, bands.getComponent(f.band[i]!) + f.amp[i]!);
      wave[4 * i] = f.kx[i]!;
      wave[4 * i + 1] = -f.ky[i]!;
      wave[4 * i + 2] = f.phase[i]!;
      wave[4 * i + 3] = f.amp[i]! * drawn;
      const ripple = f.band[i] === RIPPLE;
      const shaded = perPixel && ripple ? 1 : shadedOn(f.length[i]!, cell);
      fine[i] = f.amp[i]! * (1 - drawn) * shaded;
      shift[2 * i] = f.shiftX[i]! * drawn;
      shift[2 * i + 1] = -f.shiftY[i]! * drawn;
    }
    const look = TUNING.waves.look;
    const highest = Math.max(look.crestFloor, bands.x + bands.y + bands.z);
    (uniforms.uWaveTone.value as THREE.Vector3).set(look.shading, look.crest, highest);
    const c = TUNING.waves.coast;
    (uniforms.uCoast.value as THREE.Vector4).set(c.floor, c.sheltered, c.shelteredAt, c.openAt);
    (uniforms.uCoastReach.value as THREE.Vector3).set(c.reach.swell, c.reach.chop, c.reach.ripple);
    const foam = TUNING.waves.foam;
    const rough = Math.min(1, (this.sea.swell.height + this.sea.chop.height) / foam.roughAt);
    // A coarse grid spreads each crest's foam over wide triangles: it keeps less (never whiter).
    const grid = Math.min(1, Math.sqrt(foam.fineCell / cell));
    (uniforms.uSeaFoam.value as THREE.Vector4).set(
      rough,
      foam.widen,
      foam.surf * grid,
      foam.whitecaps * grid,
    );
    const { toX, toY } = this.sea.swell;
    (uniforms.uSeaWind.value as THREE.Vector4).set(toX, -toY, foam.lee, foam.ahead);
    uniforms.uFoamBreakup.value = foam.breakup;
    (uniforms.uFoamCap.value as THREE.Color).set(foam.cap);
  }
}
