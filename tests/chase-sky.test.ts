import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { Atmosphere, type SkyFrame } from '../src/render/atmosphere';
import type { Ocean } from '../src/render/ocean';
import { buildClouds } from '../src/render/skyClouds';
import { SkyDome } from '../src/render/skyDome';
import { SkyColors } from '../src/render/skyLight';
import { type Daylight, daylightAt } from '../src/sim/daylight';
import type { LocalWeather } from '../src/sim/wind';

const CLEAR: LocalWeather = { kind: '', rain: 0, showers: 0, gloom: 0, storm: 0, storms: [] };
const NOON: Daylight = {
  hour: 13,
  night: 0,
  warm: 0,
  lightBearing: Math.PI,
  lightHeight: 1,
  skyHeight: 1,
};
const MIDNIGHT: Daylight = { ...NOON, hour: 1, night: 1 };

/** An atmosphere over a stand-in sea that keeps what it was given. */
function setup() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0);
  const atmosphere = new Atmosphere(
    scene,
    new THREE.DirectionalLight(),
    new THREE.HemisphereLight(),
  );
  const sea = { reflected: new THREE.Color(), strength: 1 };
  const ocean = {
    setDaylight() {},
    setColors() {},
    setSun() {},
    setSkyReflection(color: THREE.Color, strength: number) {
      sea.reflected.copy(color);
      sea.strength = strength;
    },
    horizon: null,
  } as unknown as Ocean;
  const update = (day: Daylight, low: number) => {
    atmosphere.setView(low, 10);
    atmosphere.update(1, day, CLEAR, ocean, new THREE.Vector3());
  };
  return { scene, atmosphere, sea, update };
}

const hex = (c: THREE.Color) => c.getHexString();

describe('chase camera light (issue #469)', () => {
  it('leaves the sea camera as it was and turns the chase view sky blue by day', () => {
    const { scene, sea, update } = setup();
    update(NOON, 0);
    const seaFog = hex(scene.background as THREE.Color);
    expect(sea.strength).toBe(1);
    update(NOON, 1);
    const horizon = new THREE.Color(TUNING.graphics.sky.looks.day.horizon);
    expect(hex(scene.background as THREE.Color)).toBe(hex(horizon));
    expect(hex((scene.fog as THREE.Fog).color)).toBe(hex(horizon));
    expect(hex(scene.background as THREE.Color)).not.toBe(seaFog);
    expect(sea.strength).toBeCloseTo(TUNING.graphics.sky.reflection);
  });

  it('keeps the night reflection in the chase view', () => {
    const { sea, update } = setup();
    update(MIDNIGHT, 0);
    const before = hex(sea.reflected);
    update(MIDNIGHT, 1);
    expect(hex(sea.reflected)).toBe(before);
    expect(sea.strength).toBe(1);
  });

  it('blends the sky looks like the light: night colours at midnight', () => {
    const sky = new SkyColors().update(MIDNIGHT, 0);
    expect(hex(sky.zenith)).toBe(hex(new THREE.Color(TUNING.graphics.sky.looks.night.zenith)));
  });

  it('sets the sun on the horizon though the light keeps a floor', () => {
    const late = daylightAt(TUNING.weather.daylight.dayEnd - 50);
    const { atmosphere, update } = setup();
    for (let t = 0; t < 720; t += 3) {
      const day = daylightAt(t);
      update(day, 1);
      expect(atmosphere.drawnSky.disc.length()).toBeCloseTo(1);
      expect(day.skyHeight).toBeLessThanOrEqual(day.lightHeight + 1e-9);
    }
    expect(late.skyHeight).toBeGreaterThanOrEqual(0);
  });
});

describe('drawn sky (issue #470)', () => {
  const frame = (low: number): SkyFrame => ({
    horizon: new THREE.Color('#a6d6ee'),
    zenith: new THREE.Color('#4f9bd6'),
    disc: new THREE.Vector3(0, 0.05, -1).normalize(),
    discColor: new THREE.Color('#fff1d6'),
    low,
    haze: 0,
    night: 0,
    gloom: 0,
  });

  it('is hidden from the sea camera and shown in the chase view, in one draw', () => {
    const dome = new SkyDome();
    dome.update(0.016, frame(0), 10);
    expect(dome.mesh.visible).toBe(false);
    dome.update(0.016, frame(1), 10);
    expect(dome.mesh.visible).toBe(true);
    expect(Array.isArray(dome.mesh.material)).toBe(false);
    dome.dispose();
  });

  it('builds the same clouds from the same seed, round the horizon and above it', () => {
    const shape = TUNING.graphics.sky.clouds;
    const a = buildClouds(shape);
    expect(buildClouds(shape)).toEqual(a);
    const [, baseHi = 0] = shape.baseDeg;
    const [, tallest = 0] = shape.heightDeg;
    for (let i = 1; i < a.positions.length; i += 3) {
      const elevation = (Math.asin(a.positions[i]!) * 180) / Math.PI;
      expect(elevation).toBeGreaterThanOrEqual(shape.baseDeg[0]! - 1e-6);
      expect(elevation).toBeLessThanOrEqual(baseHi + tallest * 1.1);
    }
    expect(a.shades.every((s) => s >= 0 && s <= 1)).toBe(true);
    expect(Math.max(...a.indices)).toBe(a.shades.length - 1);
  });

  it('rebuilds the clouds once when their numbers change', () => {
    const dome = new SkyDome();
    const clouds = TUNING.graphics.sky.clouds;
    const before = dome.mesh.geometry;
    dome.update(0.016, frame(1), 10);
    expect(dome.mesh.geometry).toBe(before);
    const count = clouds.count;
    clouds.count = count + 2;
    try {
      dome.update(0.016, frame(1), 10);
      expect(dome.mesh.geometry).not.toBe(before);
    } finally {
      clouds.count = count;
      dome.dispose();
    }
  });
});
