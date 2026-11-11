import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { oceanControls } from '../src/data/oceanControls';
import { GAME_MAP } from '../src/data/maps';
import { TUNING } from '../src/data/tuning';
import { applyChanges } from '../src/data/tuningEdits';
import { applyGraphicsOverrides } from '../src/perf/graphicsOverrides';
import { Ocean, oceanFor } from '../src/render/ocean';
import { QUALITY, QUALITY_LEVELS } from '../src/render/quality';
import { SeaGusts, gustStrength, gustUniforms } from '../src/render/seaGusts';
import { SeaWaves } from '../src/render/seaWaves';
import { shoreTexture } from '../src/render/shoreTexture';
import { allEffects } from '../src/render/ultraPipeline';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';

const FLOOR = new THREE.Color('#1d3d7a');
const NORTHERLY = { from: 0, speedKn: 12 };

/** Where a patch sits in the wind's frame for a scene point: what the shader computes. */
function patchPoint(u: ReturnType<typeof gustUniforms>, x: number, z: number) {
  const wind = u.uGustWind.value;
  const at = u.uGustAt.value;
  const rx = x - at.x;
  const rz = z - at.y;
  return [rx * wind.x + rz * wind.y + at.z, rz * wind.x - rx * wind.y + at.w] as const;
}

describe("the wind's gusts on the sea (issue #498)", () => {
  afterEach(() => applyChanges({}));

  it('run downwind at the tuned speed, and stand still while the game is paused', () => {
    const gusts = new SeaGusts();
    const u = gustUniforms();
    const centre = { x: 40, z: -70 };
    gusts.write(u, NORTHERLY, 100, centre, 1, FLOOR);
    const before = patchPoint(u, 0, 0);
    gusts.write(u, NORTHERLY, 100, centre, 1, FLOOR);
    expect(patchPoint(u, 0, 0)).toEqual(before);
    gusts.write(u, NORTHERLY, 100.5, centre, 1, FLOOR);
    const after = patchPoint(u, 0, 0);
    // A northerly blows to the south (scene +z): the patch under a fixed point came from upwind.
    expect(u.uGustWind.value.x).toBeCloseTo(0, 6);
    expect(u.uGustWind.value.y).toBeCloseTo(1, 6);
    expect(after[0] - before[0]).toBeCloseTo(-12 * TUNING.waves.gusts.speedPerKn * 0.5, 5);
    expect(after[1]).toBeCloseTo(before[1], 5);
  });

  it('stay on the sea when the camera moves: only the wind carries them', () => {
    const gusts = new SeaGusts();
    const u = gustUniforms();
    gusts.write(u, NORTHERLY, 5, { x: 0, z: 0 }, 1, FLOOR);
    const before = patchPoint(u, 12, 34);
    gusts.write(u, NORTHERLY, 5, { x: 300, z: -150 }, 1, FLOOR);
    const after = patchPoint(u, 12, 34);
    expect(after[0]).toBeCloseTo(before[0], 4);
    expect(after[1]).toBeCloseTo(before[1], 4);
  });

  it('turn about the camera when the wind shifts, so they never sweep across the screen', () => {
    const gusts = new SeaGusts();
    const u = gustUniforms();
    const centre = { x: 500, z: 800 };
    gusts.write(u, NORTHERLY, 5, centre, 1, FLOOR);
    const before = patchPoint(u, centre.x, centre.z);
    gusts.write(u, { from: 1.2, speedKn: 12 }, 5, centre, 1, FLOOR);
    expect(patchPoint(u, centre.x, centre.z)).toEqual(before);
  });

  it('show with the wind, half at night, and not at all in a calm or switched off', () => {
    const [from, full] = TUNING.waves.gusts.wind as [number, number];
    expect(gustStrength(from, 1)).toBe(0);
    expect(gustStrength(full, 1)).toBe(1);
    expect(gustStrength(40, 0)).toBeCloseTo(TUNING.waves.gusts.night, 6);
    const u = gustUniforms();
    new SeaGusts().write(u, NORTHERLY, 0, { x: 0, z: 0 }, 1, FLOOR, false);
    expect(u.uGustLook.value.x).toBe(0);
  });

  it("keep inside the art director's limits: about 8% off the water, never under the floor", () => {
    const g = TUNING.waves.gusts;
    expect(g.darken + g.ruffle).toBeLessThanOrEqual(0.08 + 1e-9);
    expect(g.night).toBeLessThanOrEqual(0.5);
    const u = gustUniforms();
    new SeaGusts().write(u, NORTHERLY, 0, { x: 0, z: 0 }, 1, FLOOR);
    expect(u.uGustFloor.value.getHexString()).toBe('1d3d7a');
  });

  it('use no memory per frame: the same uniform objects are written again', () => {
    const gusts = new SeaGusts();
    const u = gustUniforms();
    const values = Object.values(u).map((entry) => entry.value);
    for (let t = 0; t < 3; t++) gusts.write(u, NORTHERLY, t, { x: t, z: 0 }, 1, FLOOR);
    Object.values(u).forEach((entry, i) => expect(entry.value).toBe(values[i]));
  });
});

describe('where the gusts are drawn', () => {
  const world = createWorld(GAME_MAP, SLOOP);
  const land = { islands: [], terrain: [] };
  const oceanOf = (level: (typeof QUALITY_LEVELS)[number], waves: boolean) => {
    const shore = shoreTexture([], []);
    return oceanFor(QUALITY[level], [], land, shore, undefined, { gerstner: waves });
  };
  const hasGusts = (ocean: Ocean) => 'GUSTS' in ocean.mesh.material.defines;

  it('on High and Ultra only (art director, v1.8), and never without the waves', () => {
    const on = QUALITY_LEVELS.filter((level) => hasGusts(oceanOf(level, true)));
    expect(on).toEqual(['high', 'ultra']);
    for (const level of QUALITY_LEVELS) expect(hasGusts(oceanOf(level, false)), level).toBe(false);
  });

  it('the ocean writes them each frame, and ?off=gusts holds them at zero', () => {
    const ocean = oceanOf('high', true);
    const sea = new SeaWaves(() => world, '?waves=wind');
    const look = ocean.mesh.material.uniforms.uGustLook!.value as THREE.Vector4;
    ocean.update(1, new THREE.Vector3(), {}, sea);
    expect(look.x).toBeGreaterThan(0);
    const effects: Record<string, boolean> = { ...allEffects() };
    const settings = { quality: 'auto' as const, effects, seaLife: true, townFolk: true };
    expect(applyGraphicsOverrides('?off=gusts', settings)).toBe(true);
    ocean.update(2, new THREE.Vector3(), settings.effects, sea);
    expect(look.x).toBe(0);
  });

  it('are ocean controls: the look under Drawing, the levels under Levels', () => {
    const effect = (path: string) => oceanControls().find((r) => r.path === path)?.effect;
    expect(effect('waves.gusts.darken')).toBe('drawing');
    expect(effect('graphics.quality.high.gusts')).toBe('level');
  });
});
