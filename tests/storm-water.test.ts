import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { Atmosphere } from '../src/render/atmosphere';
import type { Ocean } from '../src/render/ocean';
import { SeaWaves } from '../src/render/seaWaves';
import { greyed } from '../src/render/seaWater';
import type { Daylight } from '../src/sim/daylight';
import type { LocalWeather } from '../src/sim/wind';

const sat = (c: THREE.Color) => c.getHSL({ h: 0, s: 0, l: 0 }).s;
const weather = (storm: number): LocalWeather => ({
  kind: '',
  rain: 0,
  showers: 0,
  gloom: 0,
  storm,
  storms: [],
});
const noWorld = () => {
  throw new Error('no world in a storm test');
};

describe('storm water (issue #282)', () => {
  it('greys and darkens the deep water under the gloom, and leaves a clear day alone', () => {
    const deep = new THREE.Color('#1f5f94');
    expect(greyed(deep.clone(), 0, TUNING.graphics.water.depth.storm).getHexString()).toBe(
      deep.getHexString(),
    );
    const storm = greyed(deep.clone(), 1, TUNING.graphics.water.depth.storm);
    expect(sat(storm)).toBeLessThan(sat(deep));
    expect(storm.b).toBeGreaterThan(storm.r);
  });

  it('keeps the gloom within 0..1 when the clock jumps back', () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color();
    scene.fog = new THREE.Fog(0);
    const atmosphere = new Atmosphere(
      scene,
      new THREE.DirectionalLight(),
      new THREE.HemisphereLight(),
    );
    const ocean = {
      setDaylight() {},
      setColors() {},
      setSun() {},
      horizon: null,
    } as unknown as Ocean;
    const day = { night: 0, warm: 0, lightHeight: 1, lightBearing: 0 } as Daylight;
    atmosphere.update(-30, day, weather(1), ocean, new THREE.Vector3());
    expect(atmosphere.gloom).toBeGreaterThanOrEqual(0);
    expect(atmosphere.gloom).toBeLessThanOrEqual(1);
  });

  it("shows the storm preview's gloom, and the real weather otherwise", () => {
    const real = weather(0.2);
    expect(new SeaWaves(noWorld, '?waves=v2').shownWeather(real)).toBe(real);
    const shown = new SeaWaves(noWorld, '?waves=storm').shownWeather(real);
    expect(shown.storm).toBe(TUNING.waves.previews.storm.storm);
    expect(real.storm).toBe(0.2);
  });
});
