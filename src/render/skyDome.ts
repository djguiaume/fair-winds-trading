import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { DEG, clamp } from '../sim/math';
import type { Storm } from '../sim/storms';
import type { SkyFrame } from './atmosphere';
import { buildClouds, emptyCloudMesh } from './skyClouds';
import { DataColor } from './skyLight';
import { SKY_FRAGMENT, SKY_VERTEX } from './skyShader';
import { buildStreaks } from './skyStreaks';
import { SQUALLS_SHOWN, blankSquall, cloudAmount, pickSqualls } from './skyWeather';

/** The dome reaches this far below the horizon, past where the sea's far edge ends in fog. */
const BELOW_HORIZON = 6 * DEG;
/** Below this `low` the dome is hidden: the sea camera never sees the sky. */
const SHOWN_FROM = 0.001;
/** The softest rim the shader takes: a rim of 0 would be an undefined smoothstep. */
const HARDEST_RIM = 0.02;

type SkyData = typeof TUNING.graphics.sky;
type Shape = Readonly<Record<string, number | readonly number[]>>;
/** The numbers each layer's geometry is built from; the rest are uniforms. */
const CLOUD_KEYS = ['count', 'seed', 'baseDeg', 'widthDeg', 'heightDeg'] as const;
const STREAK_KEYS = ['count', 'seed', 'baseDeg', 'lengthDeg', 'thickDeg'] as const;

/** The dome (`aShade` -1), then the low clouds and the high streaks, in one geometry: one draw. */
function skyGeometry(data: SkyData): THREE.BufferGeometry {
  const dome = new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2 + BELOW_HORIZON);
  const domeCount = dome.attributes.position!.count;
  const cloud = buildClouds(data.clouds, domeCount, emptyCloudMesh());
  buildStreaks(data.streaks, domeCount, cloud);
  const positions = [...(dome.attributes.position!.array as Float32Array), ...cloud.positions];
  const shades = [...new Array<number>(domeCount).fill(-1), ...cloud.shades];
  const parts = [...new Array<number>(domeCount * 3).fill(0), ...cloud.parts];
  const indices = [...Array.from(dome.index!.array), ...cloud.indices];
  dome.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aShade', new THREE.Float32BufferAttribute(shades, 1));
  geometry.setAttribute('aCloud', new THREE.Float32BufferAttribute(parts, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** A copy of a layer's geometry numbers, kept to notice a `?tune` edit without allocating each frame. */
function copyShape(source: object, keys: readonly string[]): Shape {
  const out: Record<string, number | readonly number[]> = {};
  for (const k of keys) {
    const v = (source as Shape)[k]!;
    out[k] = typeof v === 'number' ? v : [...v];
  }
  return out;
}

function sameShape(source: object, b: Shape, keys: readonly string[]) {
  for (const k of keys) {
    const x = (source as Shape)[k]!;
    const y = b[k]!;
    if (typeof x === 'number' || typeof y === 'number') {
      if (x !== y) return false;
    } else if (!sameList(x, y)) return false;
  }
  return true;
}

function sameList(a: readonly number[], b: readonly number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * The drawn sky of the low views (issues #470, #552): seen only from the chase camera, it fades in
 * with the camera's switch. Its colours come from the atmosphere each frame, so the time of day,
 * storms and fog banks change it for free; its horizon is the fog colour, so the far sea melts into
 * it. The wind and the gloom set how much of each cloud layer shows; storms off the bow stand on
 * the horizon. One mesh, one draw call, no texture; drawn after the opaque scene and only where it
 * shows; the cloud rims blend over the dome inside that one draw, so nothing needs sorting.
 */
export class SkyDome {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private clouds: Shape;
  private streaks: Shape;
  private cloudTurn = 0;
  private streakTurn = 0;
  private readonly lit = new THREE.Color();
  private readonly shade = new THREE.Color();
  private readonly squalls = Array.from({ length: SQUALLS_SHOWN }, blankSquall);
  private readonly squallScratch = blankSquall();
  private readonly squallColor = new DataColor();

  constructor() {
    const data = TUNING.graphics.sky;
    this.clouds = copyShape(data.clouds, CLOUD_KEYS);
    this.streaks = copyShape(data.streaks, STREAK_KEYS);
    const material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      uniforms: {
        uHorizon: { value: new THREE.Color() },
        uSkyline: { value: new THREE.Color() },
        uHazeLine: { value: 1 },
        uZenith: { value: new THREE.Color() },
        uGradient: { value: new THREE.Vector4() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color() },
        uSun: { value: new THREE.Vector4() },
        uSunHorizon: { value: new THREE.Vector2(0, 1) },
        uSunFlat: { value: new THREE.Vector2() },
        uStars: { value: new THREE.Vector2() },
        uCloudLit: { value: new THREE.Color() },
        uCloudShade: { value: new THREE.Color() },
        uCloud: { value: new THREE.Vector4() },
        uCloudAmount: { value: new THREE.Vector3() },
        uCloudTurn: { value: new THREE.Vector2() },
        uSquall: { value: this.squalls.map(() => new THREE.Vector4()) },
        uSquallTop: { value: new THREE.Vector2() },
        uSquallColor: { value: new THREE.Color() },
        uSquallRain: { value: new THREE.Vector2() },
      },
      side: THREE.DoubleSide,
      depthWrite: false,
      depthFunc: THREE.LessEqualDepth,
      // Kept in the opaque pass (not `transparent`), so it draws before the rain and sails; its
      // own cloud rims blend over the dome drawn just before them in the same call.
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      // The picture stays opaque: a rim's alpha must not reach the canvas or a render target.
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    this.mesh = new THREE.Mesh(skyGeometry(data), material);
    this.mesh.name = 'sky dome';
    // Behind everything, so drawn last of the solid scene: the depth test skips what is covered.
    this.mesh.renderOrder = 1000;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /**
   * Each frame: the atmosphere's sky, the wind (knots) the clouds drift and gather with, and the
   * storms on the sea seen from `at` (the boat, sim coordinates).
   */
  update(
    dt: number,
    sky: Readonly<SkyFrame>,
    windKn: number,
    storms: readonly Storm[] = [],
    at: { x: number; y: number } = { x: 0, y: 0 },
  ) {
    this.mesh.visible = sky.low > SHOWN_FROM;
    if (!this.mesh.visible) return;
    const data = TUNING.graphics.sky;
    this.rebuild(data);
    const u = this.mesh.material.uniforms;
    (u.uHorizon!.value as THREE.Color).copy(sky.horizon);
    (u.uSkyline!.value as THREE.Color).copy(sky.skyline);
    (u.uZenith!.value as THREE.Color).copy(sky.zenith);
    u.uHazeLine!.value = 1 / Math.sin(Math.max(sky.hazeDeg, 0.05) * DEG);
    const show = sky.low * (1 - sky.haze);
    (u.uGradient!.value as THREE.Vector4).set(
      1 / Math.sin(data.gradientDeg * DEG),
      data.gradientCurve,
      data.bands,
      show,
    );
    this.setSun(sky);
    const clear = (1 - sky.gloom) * sky.night;
    (u.uStars!.value as THREE.Vector2).set(data.stars.density, data.stars.brightness * clear);
    this.setClouds(dt, sky, windKn);
    this.setSqualls(sky, storms, at);
  }

  private setSun(sky: Readonly<SkyFrame>) {
    const sun = TUNING.graphics.sky.sun;
    const u = this.mesh.material.uniforms;
    (u.uSunDir!.value as THREE.Vector3).copy(sky.disc);
    (u.uSunColor!.value as THREE.Color).copy(sky.discColor);
    const toMoon = (day: number, night: number) => day + (night - day) * sky.night;
    // Low on the horizon the sun (and moon) looks larger, as a painter would draw it.
    const elevation = Math.asin(clamp(sky.disc.y, -1, 1)) / DEG;
    const lowness = 1 - clamp(elevation / sun.lowDeg, 0, 1);
    const size = toMoon(sun.sizeDeg, sun.moonSizeDeg) * (1 + sun.lowGrow * lowness);
    // A storm hides the sun; its glow goes a little slower.
    (u.uSun!.value as THREE.Vector4).set(
      size * DEG,
      toMoon(sun.glow, sun.moonGlow) * (1 - 0.8 * sky.gloom),
      toMoon(sun.glowDeg, sun.moonGlowDeg) * DEG,
      1 - sky.gloom,
    );
    const warmBand = sun.horizonGlow * lowness * (1 - sky.night) * (1 - sky.gloom);
    (u.uSunHorizon!.value as THREE.Vector2).set(warmBand, Math.max(sun.horizonGlowDeg, 1) * DEG);
    const flat = Math.hypot(sky.disc.x, sky.disc.z);
    const side = flat > 1e-4 ? (1 - clamp(sky.disc.y, 0, 1)) / flat : 0;
    (u.uSunFlat!.value as THREE.Vector2).set(sky.disc.x * side, sky.disc.z * side);
  }

  /**
   * Sunlit tops in the sun's colour, bases in the sky's shade (white, gold, moonlit, grey), warmer
   * on the sun's side; more of each layer and darker as the wind freshens and the sky greys.
   */
  private setClouds(dt: number, sky: Readonly<SkyFrame>, windKn: number) {
    const { clouds, streaks } = TUNING.graphics.sky;
    const u = this.mesh.material.uniforms;
    const dark = 1 - clouds.dark * sky.gloom;
    this.shade
      .copy(sky.skyline)
      .lerp(sky.zenith, 0.3)
      .multiplyScalar(clouds.shade * dark);
    this.lit.copy(sky.skyline).lerp(sky.discColor, clouds.light * (1 - 0.6 * sky.gloom));
    this.lit.lerp(this.shade, clouds.dark * sky.gloom);
    (u.uCloudLit!.value as THREE.Color).copy(this.lit);
    (u.uCloudShade!.value as THREE.Color).copy(this.shade);
    (u.uCloud!.value as THREE.Vector4).set(
      clouds.cover,
      clouds.haze,
      Math.max(clouds.soft, HARDEST_RIM),
      clouds.sunSide * (1 - sky.gloom),
    );
    (u.uCloudAmount!.value as THREE.Vector3).set(
      cloudAmount(clouds.amount, windKn, sky.gloom),
      cloudAmount(streaks.amount, windKn, sky.gloom),
      streaks.opacity * (1 - 0.5 * sky.gloom),
    );
    const turn = clouds.driftDegPerKn * windKn * DEG * dt;
    this.cloudTurn = (this.cloudTurn + turn) % (Math.PI * 2);
    this.streakTurn = (this.streakTurn + turn * streaks.drift) % (Math.PI * 2);
    (u.uCloudTurn!.value as THREE.Vector2).set(this.cloudTurn, this.streakTurn);
  }

  /** The strongest storms off the bow as dark bands on the horizon, darker at night. */
  private setSqualls(
    sky: Readonly<SkyFrame>,
    storms: readonly Storm[],
    at: { x: number; y: number },
  ) {
    const squall = TUNING.graphics.sky.squall;
    const u = this.mesh.material.uniforms;
    pickSqualls(this.squalls, this.squallScratch, storms, at.x, at.y, squall);
    const bands = u.uSquall!.value as THREE.Vector4[];
    const tops = u.uSquallTop!.value as THREE.Vector2;
    for (let i = 0; i < SQUALLS_SHOWN; i++) {
      const s = this.squalls[i]!;
      bands[i]!.set(s.x, s.z, Math.max(s.halfWidth, 1e-3), s.strength * squall.darkness);
      tops.setComponent(i, s.top);
    }
    const color = u.uSquallColor!.value as THREE.Color;
    color.copy(this.squallColor.read(squall.color)).lerp(sky.zenith, 0.6 * sky.night);
    (u.uSquallRain!.value as THREE.Vector2).set(squall.rain, squall.shafts);
  }

  private rebuild(data: SkyData) {
    const same =
      sameShape(data.clouds, this.clouds, CLOUD_KEYS) &&
      sameShape(data.streaks, this.streaks, STREAK_KEYS);
    if (same) return;
    this.clouds = copyShape(data.clouds, CLOUD_KEYS);
    this.streaks = copyShape(data.streaks, STREAK_KEYS);
    this.mesh.geometry.dispose();
    this.mesh.geometry = skyGeometry(data);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
