// @vitest-environment happy-dom
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import SETTINGS from '../src/data/boat-preview.json';
import { TUNING } from '../src/data/tuning';
import { PreviewSea, previewWeather } from '../src/render/previewSea';
import { QUALITY, QUALITY_LEVELS } from '../src/render/quality';
import { SeaWaves } from '../src/render/seaWaves';

/** The preview's scene as BoatPreview builds it, its camera low behind her looking at her. */
function preview(level: (typeof QUALITY_LEVELS)[number] = 'medium') {
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight();
  const hemi = new THREE.HemisphereLight();
  const sea = new PreviewSea(scene, sun, hemi, QUALITY[level]);
  const camera = new THREE.PerspectiveCamera(SETTINGS.fov, 1.6, 0.5, 600);
  camera.position.set(0, 8, 40);
  camera.lookAt(0, 3, 0);
  camera.updateMatrixWorld();
  return { scene, sun, sea, camera };
}

const ocean = (scene: THREE.Scene) =>
  scene.children.find(
    (o) =>
      o instanceof THREE.Mesh &&
      o.material instanceof THREE.ShaderMaterial &&
      'uWater' in o.material.uniforms,
  ) as THREE.Mesh;
const sky = (scene: THREE.Scene) => scene.getObjectByName('sky dome')!;

describe('the boat preview sea (issue #629)', () => {
  it('blows a weather kind as its mean strength times the preview wind', () => {
    const gale0 = TUNING.weather.default.kinds!.gale!;
    const [lo, hi] = gale0.strength;
    const gale = previewWeather('gale');
    expect(gale.windKn).toBeCloseTo((SETTINGS.sea.windKn * (lo! + hi!)) / 2);
    expect(gale.weather.gloom).toBe(gale0.gloom);
    expect(previewWeather('rain').weather.rain).toBeGreaterThan(0);
  });

  it('falls back to the default weather for a kind it does not know', () => {
    expect(previewWeather('no-such-weather')).toEqual(previewWeather(SETTINGS.sea.weather));
  });

  it('draws the game ocean and the drawn sky, on every quality level', () => {
    for (const level of QUALITY_LEVELS) {
      const { scene, sea, camera } = preview(level);
      sea.update(0.1, camera);
      expect(ocean(scene), level).toBeDefined();
      expect(sky(scene).visible, level).toBe(true);
      sea.dispose();
      expect(ocean(scene), level).toBeUndefined();
    }
  });

  it('centres the grid on the sea ahead of the camera, not under it', () => {
    const { scene, sea, camera } = preview();
    sea.update(0.1, camera);
    expect(ocean(scene).position.z).toBeLessThan(camera.position.z);
  });

  it('lights the hour: the day bright, the night moonlit, a rain grey', () => {
    const { scene, sun, sea, camera } = preview();
    sea.setConditions(SETTINGS.sea.dayHour, 'breeze');
    sea.update(0.1, camera);
    const daySun = sun.intensity;
    const dayFog = (scene.fog as THREE.Fog).color.getHSL({ h: 0, s: 0, l: 0 }).l;
    expect(sea.night).toBe(0);
    sea.setConditions(SETTINGS.sea.nightHour, 'breeze');
    sea.update(0.1, camera);
    expect(sea.night).toBeGreaterThan(0.9);
    expect(sun.intensity).toBeLessThan(daySun);
    expect((scene.fog as THREE.Fog).color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(dayFog);
    sea.setConditions(SETTINGS.sea.dayHour, 'rain');
    sea.update(0.1, camera);
    expect(sun.intensity).toBeLessThan(daySun);
  });

  it('raises waves from its steady wind, with no world behind it', () => {
    const { sea, camera } = preview();
    sea.setConditions(SETTINGS.sea.dayHour, 'gale');
    sea.update(0.5, camera);
    const heights = [0, 7, 13, 21].map((x) => sea.heightAt(x, 0));
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0);
  });
});

describe('a steady sea held on the waves', () => {
  it('replaces the world wind the gusts and the field read', () => {
    const world = {
      time: 1,
      wind: { from: 0, speedKn: 2 },
      boat: { x: 0, y: 0 },
      map: { seed: 3 },
      windConfig: null,
    };
    const calm = new SeaWaves(() => world, '');
    const held = new SeaWaves(() => world, '');
    held.holdSteady({ speedKn: 25, storm: 0 });
    calm.update();
    held.update();
    const amp = (w: SeaWaves) => w.field.amp.reduce((a, b) => a + b, 0);
    expect(amp(held)).toBeGreaterThan(amp(calm));
  });
});
