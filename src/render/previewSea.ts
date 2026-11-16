import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { type Daylight, daylightAt, secondsAtHour } from '../sim/daylight';
import type { LocalWeather } from '../sim/wind';
import { CLEAR } from '../sim/windZones';
import { DEG } from '../sim/math';
import { Atmosphere } from './atmosphere';
import { seaAhead } from './cameraOrbit';
import { OCEAN_SIZE, Ocean } from './ocean';
import { waterLookOf } from './oceanFor';
import { PALETTE } from './palette';
import type { QualityProfile } from './quality';
import { seabedTexture } from './seabedTexture';
import { type SeaSource, SeaWaves } from './seaWaves';
import { shoreTexture } from './shoreTexture';
import SETTINGS from '../data/boat-preview.json';

type WeatherKindTuning = { strength: readonly number[]; rain: number; gloom: number };
const KINDS = TUNING.weather.default.kinds as Record<string, WeatherKindTuning>;

/** The open sea's wind, and the weather the light and sky read, for a weather kind. */
export function previewWeather(kind: string): { windKn: number; weather: LocalWeather } {
  const known = KINDS[kind] ? kind : SETTINGS.sea.weather;
  const k = KINDS[known]!;
  const strength = k.strength.reduce((a, b) => a + b, 0) / k.strength.length;
  return {
    windKn: SETTINGS.sea.windKn * strength,
    weather: { kind: known, rain: k.rain, showers: 0, gloom: k.gloom, storm: 0, storms: [] },
  };
}

/**
 * The game's own open sea and sky round the turntable boat (issue #629): its ocean shader and
 * waves, its drawn sky and its light at an hour and in a weather, as the follow cam sees them. No
 * land, so no shore or seabed bake to speak of; no mirror or shadow pass. It lives in the
 * preview's own scene and canvas, so the game's draw-call budgets never see it.
 */
export class PreviewSea {
  private readonly atmosphere: Atmosphere;
  private readonly ocean: Ocean;
  private readonly waves: SeaWaves;
  private readonly source: SeaSource & { time: number; wind: { from: number; speedKn: number } };
  private readonly seabed = seabedTexture({ fields: [] });
  private readonly shore = shoreTexture([], []);
  private day: Daylight = daylightAt(secondsAtHour(SETTINGS.sea.dayHour));
  private weather: LocalWeather = previewWeather(SETTINGS.sea.weather).weather;
  private readonly centre = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private static readonly ORIGIN = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    sun: THREE.DirectionalLight,
    hemi: THREE.HemisphereLight,
    profile: QualityProfile,
  ) {
    scene.background = new THREE.Color(PALETTE.deepWater);
    scene.fog = new THREE.Fog(PALETTE.deepWater, 120, 220);
    this.atmosphere = new Atmosphere(scene, sun, hemi);
    this.source = {
      time: 0,
      wind: { from: SETTINGS.sea.windFromDeg * DEG, speedKn: 0 },
      boat: { x: 0, y: 0 },
      map: { seed: 1 },
      windConfig: null,
    };
    this.waves = new SeaWaves(() => this.source);
    this.waves.setOn(profile.waves);
    // The mirror needs the game's reflection pass, and open sea has no coast to calm the waves.
    const look = {
      ...waterLookOf(profile, this.seabed, this.waves),
      mirror: false,
      coast: undefined,
    };
    this.ocean = new Ocean([], profile.oceanSegments, look, OCEAN_SIZE, [], this.shore);
    scene.add(this.ocean.mesh);
    this.setConditions(SETTINGS.sea.dayHour, SETTINGS.sea.weather);
  }

  /** 0 = full day … 1 = full night, for the boat's own lanterns. */
  get night(): number {
    return this.day.night;
  }

  /** The light of a clock hour (0..24) and a weather kind (`weather.json` › `kinds`). */
  setConditions(hour: number, weatherKind: string) {
    this.day = daylightAt(secondsAtHour(hour));
    const { windKn, weather } = previewWeather(weatherKind);
    this.weather = weather;
    this.source.wind.speedKn = windKn;
    this.waves.holdSteady({ speedKn: windKn, storm: 0 });
    // The screen opens in this weather: no gloom gathering as it would sailing into it.
    this.atmosphere.gloom = Atmosphere.gloomFor(weather);
  }

  /** The sea's height under her at scene (`x`, `z`) now. */
  heightAt(x: number, z: number): number {
    return this.waves.heightAt(x, z);
  }

  /** One frame `dt` seconds on (0 holds the sea still), seen from `camera`, the boat at the origin. */
  update(dt: number, camera: THREE.PerspectiveCamera) {
    this.source.time += dt;
    this.atmosphere.setView(1, this.source.wind.speedKn);
    this.atmosphere.update(dt, this.day, this.weather, this.ocean, PreviewSea.ORIGIN, CLEAR);
    this.atmosphere.closeFog(TUNING.camera.distance, this.day, CLEAR);
    const fog = this.scene.fog as THREE.Fog;
    this.ocean.setFog(fog.near, fog.far);
    this.ocean.update(this.source.time, this.seaCentre(camera, fog.far), undefined, this.waves);
  }

  dispose() {
    this.scene.remove(this.ocean.mesh);
    this.ocean.dispose();
    this.atmosphere.dispose();
    this.seabed.texture.dispose();
    this.shore.texture.dispose();
  }

  /** The grid centres on the middle of the sea on screen, as the game's does (decision 0223). */
  private seaCentre(camera: THREE.PerspectiveCamera, sight: number) {
    const f = camera.getWorldDirection(this.forward);
    const flat = Math.hypot(f.x, f.z);
    const pitch = Math.atan2(-f.y, flat);
    const middle = seaAhead(camera.position.y, pitch, camera.fov * DEG, sight);
    const k = flat > 1e-6 ? middle / flat : 0;
    return this.centre.set(camera.position.x + f.x * k, 0, camera.position.z + f.z * k);
  }
}
