import * as THREE from 'three';
import type { Daylight } from '../sim/daylight';
import type { LocalWeather } from '../sim/wind';
import { approach, clamp } from '../sim/math';
import type { Ocean } from './ocean';
import { PALETTE } from './palette';

/** One look of the sea and the light: background/fog, water, sun and sky light. */
export interface Look {
  sky: THREE.Color;
  water: THREE.Color;
  waterLight: THREE.Color;
  shallow: THREE.Color;
  foam: THREE.Color;
  sun: THREE.Color;
  sunIntensity: number;
  skyLight: THREE.Color;
  skyIntensity: number;
}

const look = (
  sky: string,
  water: string,
  waterLight: string,
  shallow: string,
  foam: string,
  sun: string,
  sunIntensity: number,
  skyLight: string,
  skyIntensity: number,
): Look => ({
  sky: new THREE.Color(sky),
  water: new THREE.Color(water),
  waterLight: new THREE.Color(waterLight),
  shallow: new THREE.Color(shallow),
  foam: new THREE.Color(foam),
  sun: new THREE.Color(sun),
  sunIntensity,
  skyLight: new THREE.Color(skyLight),
  skyIntensity,
});

/** The bright day of the mockups and the Privateers ad. */
export const DAY = look(
  PALETTE.deepWater,
  PALETTE.water,
  PALETTE.waterLight,
  PALETTE.shallow,
  PALETTE.foam,
  PALETTE.sun,
  1.7,
  PALETTE.sky,
  1.5,
);
/** Low golden sun at dusk and dawn (decision 0068). */
const GOLDEN = look(
  '#5b5478',
  '#2f6a86',
  '#6f9fbf',
  '#c2b49a',
  '#ffe2c4',
  '#ff9e5e',
  1.45,
  '#ffcf9f',
  1.2,
);
/**
 * Moonlit night (decision 0068): deep blue, never black, so coasts, reefs and boats stay
 * readable on an old tablet screen.
 */
export const NIGHT = look(
  '#0f2740',
  '#1b3f63',
  '#28567f',
  '#2f6a86',
  '#9fb8d8',
  '#a9c2ff',
  0.55,
  '#7d9fdc',
  0.7,
);
/** Under the darkest storm (decision 0067). */
const STORM = look(
  '#2a3a42',
  '#1c3f47',
  '#2b5159',
  '#3b6f73',
  '#c8d6dc',
  '#c8d2d8',
  0.7,
  '#9fb2bb',
  0.9,
);

/** Window glass tint: dark panes by day, the vertex colours (warm or dark) at night. */
export const WINDOWS_BY_DAY = new THREE.Color('#5c6470');
export const WINDOWS_AT_NIGHT = new THREE.Color('#ffffff');

function mix(out: Look, a: Look, b: Look, k: number): Look {
  out.sky.copy(a.sky).lerp(b.sky, k);
  out.water.copy(a.water).lerp(b.water, k);
  out.waterLight.copy(a.waterLight).lerp(b.waterLight, k);
  out.shallow.copy(a.shallow).lerp(b.shallow, k);
  out.foam.copy(a.foam).lerp(b.foam, k);
  out.sun.copy(a.sun).lerp(b.sun, k);
  out.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * k;
  out.skyLight.copy(a.skyLight).lerp(b.skyLight, k);
  out.skyIntensity = a.skyIntensity + (b.skyIntensity - a.skyIntensity) * k;
  return out;
}

const blank = () => look('#000', '#000', '#000', '#000', '#000', '#000', 0, '#000', 0);

/**
 * Light and colour of the scene from the time of day (decision 0068) and the weather at the boat
 * (decision 0067). Only colours and intensities change: no extra lights, passes or textures.
 */
export class Atmosphere {
  /** 0 = clear … 1 = under a storm, eased so sailing into one feels like the light going. */
  gloom = 0;
  private readonly now = blank();
  private readonly storm = blank();
  private readonly lightDir = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly sun: THREE.DirectionalLight,
    private readonly sky: THREE.HemisphereLight,
  ) {}

  /** Target gloom for this weather: a gale a little (its `gloom` in weather.json), rain more, a
   * storm's core most. */
  static gloomFor(weather: LocalWeather): number {
    return clamp(Math.max(weather.rain * 0.55, weather.storm, weather.gloom), 0, 1);
  }

  update(dt: number, day: Daylight, weather: LocalWeather, ocean: Ocean, target: THREE.Vector3) {
    this.gloom = approach(this.gloom, Atmosphere.gloomFor(weather), 0.35, dt);
    // Day → golden → night, then the storm on top (a storm at night stays dark blue-grey).
    const l = mix(this.now, DAY, GOLDEN, day.warm * (1 - day.night));
    mix(l, l, NIGHT, day.night);
    mix(this.storm, STORM, NIGHT, day.night * 0.7);
    mix(l, l, this.storm, this.gloom);

    (this.scene.background as THREE.Color).copy(l.sky);
    (this.scene.fog as THREE.Fog).color.copy(l.sky);
    this.sun.color.copy(l.sun);
    this.sun.intensity = l.sunIntensity * (1 - 0.5 * this.gloom);
    this.sky.color.copy(l.skyLight);
    this.sky.intensity = l.skyIntensity;
    ocean.setColors(l.water, l.waterLight, l.sky, l.shallow, l.foam);

    // The sun (or moon) moves across the sky; shadows swing with it.
    const h = day.lightHeight;
    this.lightDir.set(Math.sin(day.lightBearing), h * 1.6, -Math.cos(day.lightBearing));
    this.lightDir.normalize();
    this.sun.position.copy(target).addScaledVector(this.lightDir, 60);
    this.sun.target.position.copy(target);
    ocean.setSunDirection(this.lightDir);
  }
}
