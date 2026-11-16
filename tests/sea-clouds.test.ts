import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { oceanControls } from '../src/data/oceanControls';
import { GAME_MAP } from '../src/data/maps';
import { TUNING } from '../src/data/tuning';
import { applyChanges } from '../src/data/tuningEdits';
import { applyGraphicsOverrides } from '../src/perf/graphicsOverrides';
import { type Ocean, oceanFor } from '../src/render/ocean';
import { QUALITY, QUALITY_LEVELS } from '../src/render/quality';
import { SeaClouds, cloudShade, cloudUniforms } from '../src/render/seaClouds';
import { SeaWaves } from '../src/render/seaWaves';
import { shoreTexture } from '../src/render/shoreTexture';
import { allEffects } from '../src/render/graphicsEffects';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';

const NORTHERLY = { from: 0, speedKn: 12 };

describe('cloud shadows on the sea (issue #546)', () => {
  afterEach(() => applyChanges({}));

  it('drift downwind at the tuned speed, and stand still while the game is paused', () => {
    const u = cloudUniforms();
    const clouds = new SeaClouds();
    clouds.write(u, NORTHERLY, 100, 1, 0);
    const before = u.uCloudAt.value.clone();
    clouds.write(u, NORTHERLY, 100, 1, 0);
    expect(u.uCloudAt.value.equals(before)).toBe(true);
    clouds.write(u, NORTHERLY, 101, 1, 0);
    const { speed, speedPerKn } = TUNING.waves.clouds;
    // A northerly blows them south: scene +z.
    expect(u.uCloudAt.value.y - before.y).toBeCloseTo(speed + 12 * speedPerKn, 5);
    expect(u.uCloudAt.value.x - before.x).toBeCloseTo(0, 5);
  });

  it('show in the sun only: none at night, fading out under an overcast', () => {
    const { shade } = TUNING.waves.clouds;
    const clear = TUNING.graphics.sky.clouds.amount.clear;
    expect(cloudShade(1, 0, 0)).toBeCloseTo(shade * clear, 6);
    expect(cloudShade(0, 0, 0)).toBe(0);
    expect(cloudShade(1, 1, 0)).toBe(0);
  });

  it('follow the sky: more wind, more clouds overhead, more shade on the sea', () => {
    expect(cloudShade(1, 0, 14)).toBeGreaterThan(cloudShade(1, 0, 3));
    expect(cloudShade(1, 0, 40)).toBeLessThanOrEqual(TUNING.waves.clouds.shade);
  });
});

describe('where the cloud shadows are drawn', () => {
  const world = createWorld(GAME_MAP, SLOOP);
  const land = { islands: [], terrain: [] };
  const oceanOf = (level: (typeof QUALITY_LEVELS)[number], waves: boolean) =>
    oceanFor(QUALITY[level], [], land, shoreTexture([], []), undefined, { gerstner: waves });
  const hasClouds = (ocean: Ocean) => 'CLOUDS' in ocean.mesh.material.defines;

  it('on Medium and up, and never without the waves', () => {
    const on = QUALITY_LEVELS.filter((level) => hasClouds(oceanOf(level, true)));
    expect(on).toEqual(['medium', 'high', 'ultra']);
    for (const level of QUALITY_LEVELS) expect(hasClouds(oceanOf(level, false)), level).toBe(false);
  });

  it('the ocean writes them each frame, and ?off=clouds holds them at zero', () => {
    const ocean = oceanOf('medium', true);
    const sea = new SeaWaves(() => world, '?waves=wind');
    const look = ocean.mesh.material.uniforms.uCloudLook!.value as THREE.Vector3;
    ocean.update(1, new THREE.Vector3(), {}, sea);
    expect(look.z).toBeGreaterThan(0);
    const effects: Record<string, boolean> = { ...allEffects() };
    const settings = { quality: 'auto' as const, effects, seaLife: true, townFolk: true };
    expect(applyGraphicsOverrides('?off=clouds', settings)).toBe(true);
    ocean.update(2, new THREE.Vector3(), settings.effects, sea);
    expect(look.z).toBe(0);
  });

  it('are ocean controls under Drawing', () => {
    const effect = (path: string) => oceanControls().find((r) => r.path === path)?.effect;
    expect(effect('waves.clouds.shade')).toBe('drawing');
    expect(effect('waves.bands.chop.scale')).toBe('sea');
  });
});
