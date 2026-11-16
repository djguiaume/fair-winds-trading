import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { DEG, clamp } from '../sim/math';
import type { SunShape } from './atmosphere';
import { leanShadowMap } from './shadowTarget';
import type { Ocean } from './ocean';
import type { GraphicsEffects } from './ultraPipeline';
import { setContactShade } from './models/contactShade';
import { writeSeaShadow } from './seaShadow';
import { writeGlitter } from './seaGlitter';
import { setSunThrough } from './sunThrough';
import { setSunHaze } from './sunHaze';
import type { SkyFrame } from './atmosphere';

/** The sun's height (sine) over which its glitter path is whole; under the horizon, none. */
const GLITTER_RISE = 0.05;

/** One level's shadow numbers (`graphics.json` › `shadows.high`, `ultra.shadows`). */
export type ShadowData = typeof TUNING.graphics.shadows.high;

/** What a shadow light is set to this frame. */
export interface ShadowSettings {
  mapSize: number;
  radius: number;
  bias: number;
  normalBias: number;
  box: number;
  far: number;
  intensity: number;
}

/** A level's shadows at a moment of the night (0 day … 1 night): fainter under the moon. */
export function shadowSettings(data: ShadowData, night: number, out = {} as ShadowSettings) {
  out.mapSize = data.mapSize;
  out.radius = data.radius;
  out.bias = data.bias;
  out.normalBias = data.normalBias;
  out.box = data.box;
  out.far = data.distance + data.box;
  out.intensity = 1 + (data.nightStrength - 1) * night;
  return out;
}

/**
 * Sets a shadow light's map, softness and box. The map is the lean one (decision 0246), made
 * again only when its size changes; the box's projection only when it changes.
 */
export function applyShadow(
  light: THREE.DirectionalLight,
  renderer: THREE.WebGLRenderer,
  want: Readonly<ShadowSettings>,
) {
  const shadow = light.shadow;
  if (shadow.mapSize.x !== want.mapSize || !shadow.map) {
    shadow.mapSize.set(want.mapSize, want.mapSize);
    shadow.map?.dispose();
    shadow.map = leanShadowMap(want.mapSize, renderer.state.buffers.depth.getReversed());
  }
  shadow.radius = want.radius;
  shadow.bias = want.bias;
  shadow.normalBias = want.normalBias;
  shadow.intensity = want.intensity;
  const cam = shadow.camera;
  if (cam.right !== want.box || cam.far !== want.far) {
    Object.assign(cam, { left: -want.box, right: want.box, top: want.box, bottom: -want.box });
    cam.far = want.far;
    cam.updateProjectionMatrix();
  }
}

/** The light lowered and turned for a level's shadows (`sunHeight`, `sunTurnDeg`). */
export function shapeSun(
  data: Pick<ShadowData, 'sunHeight' | 'sunTurnDeg' | 'distance'>,
  out: SunShape,
) {
  out.height = data.sunHeight;
  out.turn = data.sunTurnDeg * DEG;
  out.distance = data.distance;
  return out;
}

/**
 * Where the shadow box centres (issue #550): from the camera's target toward the middle of the sea
 * on screen by `lead`, never more than `maxLead` boxes from the target. From above the two are
 * close; from the follow cam the box moves ahead, onto what the camera sees, not behind the boat.
 */
export function shadowCentre(
  out: THREE.Vector3,
  target: Readonly<THREE.Vector3>,
  seaCentre: Readonly<THREE.Vector3>,
  box: number,
) {
  const { lead, maxLead } = TUNING.graphics.shadows;
  const dx = (seaCentre.x - target.x) * lead;
  const dz = (seaCentre.z - target.z) * lead;
  const k = Math.min(1, (box * maxLead) / Math.max(1e-6, Math.hypot(dx, dz)));
  return out.set(target.x + dx * k, 0, target.z + dz * k);
}

/**
 * Moves the box by whole shadow texels across the light (`texel` units), so its edges do not
 * crawl as the camera moves. `toLight` is the unit direction toward the light.
 */
export function snapToTexels(
  centre: THREE.Vector3,
  toLight: Readonly<THREE.Vector3>,
  texel: number,
  right = new THREE.Vector3(),
  up = new THREE.Vector3(),
) {
  // The shadow camera's own axes: it looks down -toLight with the world's up (Object3D.lookAt).
  right.set(0, 1, 0).cross(toLight);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  up.copy(toLight).cross(right);
  const u = centre.dot(right);
  const v = centre.dot(up);
  centre.addScaledVector(right, Math.round(u / texel) * texel - u);
  return centre.addScaledVector(up, Math.round(v / texel) * texel - v);
}

/** Relative luminance (linear), to trade the sky light for sunlight at the same brightness. */
const luminance = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/**
 * Deeper, bluer shade (issue #550, art bible rule 3): a share (`contrast`) of the sky light is
 * given to the sun, so level ground in the sun stays as bright as before and only what the sun
 * does not reach gets darker, lit by the blue sky alone. `up` is the sun's height as the sine of its
 * angle over the horizon (level ground's share of it); it has a floor (`minUp`) so a low sun is
 * not made glaring.
 */
export function deepenShade(
  sun: THREE.DirectionalLight,
  sky: THREE.HemisphereLight,
  contrast: number,
  up: number,
) {
  if (contrast <= 0) return;
  const given = sky.intensity * contrast;
  sky.intensity -= given;
  const sunLum = luminance(sun.color);
  if (sunLum <= 0) return;
  const lift = clamp(up, TUNING.graphics.shadows.minUp, 1);
  sun.intensity += (given * luminance(sky.color)) / (sunLum * lift);
}

/**
 * Where the boat's soft shadow on the sea lies (the sea takes no shadow map): away from the light,
 * as far as a shape `lift` units above the water would throw it, written to `out` (x, z).
 */
export function blobOffset(toLight: Readonly<THREE.Vector3>, lift: number, out: THREE.Vector2) {
  const h = Math.max(toLight.y, 0.25);
  return out.set((-toLight.x / h) * lift, (-toLight.z / h) * lift);
}

/**
 * The sun's shadows on High and Ultra (issue #550): the box over what the camera sees, the light
 * lowered and turned for longer shadows, deeper blue shade, the boat's soft shadow cast away from
 * the light. High's map and box are set here from `graphics.json` › `shadows.high`; Ultra's
 * pipeline sets its own each frame (`ultra.shadows`).
 */
export class SunShadows {
  /** Where the box centres this frame, for the atmosphere to place the light round. */
  readonly centre = new THREE.Vector3();
  /** Where the boat's soft shadow lies from her, scene x and z. */
  readonly blob = new THREE.Vector2();
  private readonly shape: SunShape = { height: 1, turn: 0, distance: 60 };
  private readonly plain: SunShape = { height: 1, turn: 0, distance: 60 };
  private readonly settings = {} as ShadowSettings;
  private readonly toLight = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private drawn = false;
  private ultra = false;
  private contact = false;
  /** The level draws the sunlight's extras (High and Ultra): glitter, sails, haze. */
  private rich = false;
  private reflect = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly light: THREE.DirectionalLight,
    private readonly sky: THREE.HemisphereLight,
  ) {}

  /** This level's numbers, or none when it draws no shadows. */
  private get data(): ShadowData | null {
    if (!this.drawn) return null;
    return this.ultra ? TUNING.graphics.ultra.shadows : TUNING.graphics.shadows.high;
  }

  /**
   * Before the atmosphere: whether shadows and contact shade are drawn (the level and Settings),
   * where the box centres and how the light stands. Returns the light's shape for the atmosphere.
   */
  frame(
    level: { shadows: boolean; ultra: boolean },
    effects: Readonly<GraphicsEffects>,
    target: Readonly<THREE.Vector3>,
    seaCentre: Readonly<THREE.Vector3>,
  ): Readonly<SunShape> {
    this.drawn = level.shadows && effects.shadows;
    this.contact = level.shadows && effects.contact;
    this.rich = level.shadows && effects.sunlight !== false;
    this.reflect = effects.reflection && effects.glitter !== false;
    this.ultra = level.ultra;
    const data = this.data;
    if (!data) {
      this.centre.copy(target);
      return this.plain;
    }
    shadowCentre(this.centre, target, seaCentre, data.box);
    return shapeSun(data, this.shape);
  }

  /**
   * After the atmosphere has placed the light: the box snapped to whole texels, the shade
   * deepened, High's map set, the sea's shade and glitter, the contact shade, the sun through the
   * sails and the haze toward it, and the boat's shadow laid away from the light.
   */
  settle(night: number, ocean: Ocean, sky: Readonly<SkyFrame>) {
    const light = this.light;
    const look = TUNING.graphics.shadows;
    this.toLight.subVectors(light.position, light.target.position).normalize();
    blobOffset(this.toLight, look.blobLift, this.blob);
    setContactShade(this.contact);
    setSunThrough(this.rich);
    setSunHaze(sky, this.rich);
    const shown = Math.min(1, Math.max(0, sky.disc.y / GLITTER_RISE));
    writeGlitter(ocean.mesh.material.uniforms, this.reflect, shown, night);
    if (!this.ultra) this.cast(this.drawn);
    const data = this.data;
    const seaShade = data ? look.sea * (1 + (data.nightStrength - 1) * night) : 0;
    writeSeaShadow(ocean.mesh.material.uniforms, light.shadow, seaShade, look.seaSpread);
    if (!data) return;
    const back = light.position.distanceTo(light.target.position);
    snapToTexels(this.centre, this.toLight, (2 * data.box) / data.mapSize, this.right, this.up);
    light.target.position.copy(this.centre);
    light.position.copy(this.centre).addScaledVector(this.toLight, back);
    const contrast = look.contrast + (look.nightContrast - look.contrast) * night;
    deepenShade(light, this.sky, contrast, this.toLight.y);
    if (!this.ultra) applyShadow(light, this.renderer, shadowSettings(data, night, this.settings));
  }

  /** High's shadows on or off; three.js rebuilds the lit materials only when this changes. */
  private cast(on: boolean) {
    if (this.renderer.shadowMap.enabled === on && this.light.castShadow === on) return;
    this.renderer.shadowMap.enabled = on;
    this.light.castShadow = on;
  }
}
