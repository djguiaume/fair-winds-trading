import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { oceanFragmentShader } from '../src/render/oceanShader';
import { groundShaderSources } from '../src/render/models/fieldGroundShader';
import { SHORE_WASH_UNIFORMS, ShoreWash, shoreWashOff } from '../src/render/shoreWash';
import { createSeaState, steadySeaState } from '../src/sim/seaState';
import { createWaveField, setWaveField } from '../src/sim/waves';

const U = SHORE_WASH_UNIFORMS;
const BAKE = {
  map: { value: new THREE.Texture() },
  bounds: { value: new THREE.Vector4(-10, -20, 100, 200) },
};

/** A steady review sea (`waves.json` › previews) at world `time`. */
function seaOf(preview: keyof typeof TUNING.waves.previews, time = 100) {
  const { speedKn, storm } = TUNING.waves.previews[preview];
  const sea = createSeaState();
  steadySeaState(Math.PI / 2, speedKn, storm, sea);
  const field = createWaveField();
  setWaveField(field, sea, 7, time);
  return { sea, field };
}

function washIn(preview: keyof typeof TUNING.waves.previews, on = true) {
  const { sea, field } = seaOf(preview);
  new ShoreWash().write(sea, field, 100, on, 1, BAKE);
  return { strength: U.uWash.value.x, zone: U.uSurfLines.value.y, reach: U.uWash.value.y };
}

describe('the surf and its wash up the beach (issue #397)', () => {
  it('is off in a calm sea, where the ocean does not draw it, and with the waves off', () => {
    expect(washIn('calm').strength).toBe(0);
    expect(washIn('wind', false).strength).toBe(0);
    washIn('wind');
    shoreWashOff();
    expect(U.uWash.value.x).toBe(0);
  });

  it('is full at 14 kn; a storm brings more lines and a longer wash', () => {
    const wind = washIn('wind');
    const storm = washIn('storm');
    expect(wind.strength).toBe(1);
    expect(storm.strength).toBe(1);
    const { spacing, lines } = TUNING.waves.surf;
    // The lines start beyond the shore ring: one line's room at 14 kn, two in the storm.
    expect(storm.zone - wind.zone).toBeGreaterThan(spacing * (lines[1]! - lines[0]!) * 0.9);
    expect(wind.zone).toBeGreaterThan(spacing * lines[0]!);
    expect(storm.reach).toBeGreaterThan(wind.reach);
    expect(U.uWashBake.value).toBe(BAKE.map.value);
  });

  it('runs its clock at the period of the sea, with no jump when the sea changes', () => {
    const wash = new ShoreWash();
    const wind = seaOf('wind');
    const storm = seaOf('storm');
    wash.write(wind.sea, wind.field, 100, true, 1, BAKE);
    const start = U.uSurf.value.x;
    wash.write(wind.sea, wind.field, 100.5, true, 1, BAKE);
    const [calmPeriod, stormPeriod] = TUNING.waves.surf.period;
    const turn = (2 * Math.PI * 0.5) / calmPeriod!;
    expect(U.uSurf.value.x - start).toBeCloseTo(turn, 5);
    const before = U.uSurf.value.x;
    wash.write(storm.sea, storm.field, 101, true, 1, BAKE);
    expect(U.uSurf.value.x - before).toBeCloseTo((2 * Math.PI * 0.5) / stormPeriod!, 5);
    // A long pause (a save loaded, a menu) moves it on by at most half a second.
    const paused = U.uSurf.value.x;
    wash.write(storm.sea, storm.field, 500, true, 1, BAKE);
    expect(U.uSurf.value.x - paused).toBeLessThanOrEqual((2 * Math.PI * 0.5) / stormPeriod! + 1e-9);
  });

  it('follows the largest swell along the shore', () => {
    const { sea, field } = seaOf('wind');
    new ShoreWash().write(sea, field, 100, true, 1, BAKE);
    const k = Math.hypot(U.uSurf.value.y, U.uSurf.value.z);
    const shortest = (2 * Math.PI) / Math.max(...TUNING.waves.bands.swell.lengths);
    const longest = (2 * Math.PI) / Math.min(...TUNING.waves.bands.swell.lengths);
    expect(k).toBeGreaterThanOrEqual(shortest - 1e-9);
    expect(k).toBeLessThanOrEqual(longest + 1e-9);
  });

  it('is drawn by the ocean on Medium and up and by every island ground', () => {
    expect(oceanFragmentShader).toMatch(/#ifdef FANCY[\s\S]*surfLines/);
    const ground = groundShaderSources(
      THREE.ShaderLib.lambert.vertexShader,
      THREE.ShaderLib.lambert.fragmentShader,
    );
    expect(ground.fragmentShader).toContain('groundWash(colour, vWashAt');
    expect(ground.vertexShader).toContain('vWashAt = (modelMatrix');
  });
});
