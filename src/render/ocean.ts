import * as THREE from 'three';
import type { IslandDef, TerrainDef } from '../sim/map';
import { PALETTE } from './palette';
import { TUNING } from '../data/tuning';
import type { QualityProfile } from './quality';
import { DAY, NIGHT, type Look } from './atmosphere';
import { type ShoreTexture, shoreShader, shoreTexture } from './shoreTexture';
import { type SeabedTexture, seabedShader } from './seabedTexture';
import { dimShallow, liftToFloor, newRamp, seaRampAt } from './seaWater';
import { oceanVertexShader as vertexShader, waveSag } from './oceanWaves';

const fragmentShader = /* glsl */ `
uniform float uTime;
#ifndef VERTEX_SHORES
${shoreShader}
#ifdef DEPTH
${seabedShader}
#endif
#endif
#ifdef VERTEX_SHORES
varying float vShoreDistance;
#ifdef DEPTH
varying float vDepth;
#endif
#endif
#ifdef DEPTH
// The mid colour's place on the depth (0..1), the crest lightening and the facet shading.
uniform vec3 uDepthLook;
#endif
uniform vec3 uSunDir;
uniform vec3 uWater;
uniform vec3 uWaterLight;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
#ifdef REFLECT
uniform vec3 uSkyLight;
uniform vec3 uSunColor;
uniform float uReflect;
uniform float uFresnelPower;
uniform float uGlint;
uniform float uGlintSharpness;
// Glint fades out between these view heights (sines of the angle above the sea), and peaks at w.
uniform vec3 uGlintFade;
#endif
#if defined(REFLECT) || defined(DEPTH)
// Soft shore foam: full strength out to x, fading over y, opacity z, outer line w.
uniform vec4 uFoamLook;
#endif
varying vec3 vWorld;
varying float vHeight;
varying float vFogDepth;

void main() {
  // Flat shading: one normal per triangle from screen-space derivatives.
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;
  float light = 0.62 + 0.5 * max(dot(n, uSunDir), 0.0);

  // Distance to the nearest beach, for the foam line.
#ifdef VERTEX_SHORES
  float d = vShoreDistance;
#else
  float d = shoreDistance(vWorld.xz);
#endif
#ifdef DEPTH
  // Coloured by the seabed's depth (issue #274): shallow → mid → deep (uWaterLight, uWater).
#ifdef VERTEX_SHORES
  float dep = vDepth;
#else
  float dep = seabedDepth(vWorld.xz);
#endif
  vec3 col = mix(uShallow, uWaterLight, clamp(dep / uDepthLook.x, 0.0, 1.0));
  col = mix(col, uWater, clamp((dep - uDepthLook.x) / (1.0 - uDepthLook.x), 0.0, 1.0));
  col *= 1.0 + uDepthLook.y * (smoothstep(-0.35, 0.45, vHeight) - 0.5);
  light = mix(1.0, light, uDepthLook.z);
#else
  vec3 col = mix(uWater, uWaterLight, smoothstep(-0.35, 0.45, vHeight));
  col = mix(col, uShallow, (1.0 - smoothstep(0.0, 14.0, d)) * 0.85);
#endif
#ifdef FANCY
  float ripple = sin(vWorld.x * 0.45 + uTime * 1.3) * sin(vWorld.z * 0.5 - uTime * 1.7);
#else
  float ripple = 0.0;
#endif
#if defined(REFLECT) || defined(DEPTH)
  // A wide band that fades softly into the sea, and a faint line further out that comes and goes.
  float soft = 1.0 - smoothstep(uFoamLook.x, uFoamLook.x + uFoamLook.y, d + 0.5 * ripple);
  float beyond = d - uFoamLook.x - uFoamLook.y - 1.0 - 0.8 * sin(uTime * 0.9 + d * 0.4);
  float line = (1.0 - smoothstep(0.0, 1.2, abs(beyond))) * uFoamLook.w;
  col = mix(col, uFoam, clamp(soft * soft * uFoamLook.z + line, 0.0, 1.0));
#elif defined(FANCY)
  float foam = 1.0 - smoothstep(0.8, 2.6, d + 0.7 * ripple + 0.6 * sin(uTime * 1.4 + d * 0.6));
  col = mix(col, uFoam, foam * 0.8);
#else
  float foam = 1.0 - smoothstep(0.8, 2.6, d);
  col = mix(col, uFoam, foam * 0.8);
#endif

  col *= light;
#ifdef REFLECT
  // The sky mirrored at low angles (Fresnel), and the sun or moon sparkling on the facets.
  vec3 toEye = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - max(dot(n, toEye), 0.0), uFresnelPower);
  col = mix(col, uSkyLight, fresnel * uReflect);
  // A glint belongs to a low view: looking down at a high sun it would blow out half the screen.
  float glint = pow(max(dot(n, normalize(uSunDir + toEye)), 0.0), uGlintSharpness);
  glint *= 1.0 - smoothstep(uGlintFade.x, uGlintFade.y, toEye.y);
  col += uSunColor * min(glint * uGlint, uGlintFade.z);
#endif
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

/** Conservative displacement bound: sum of the three wave amplitudes below and in the shader. */
export const MAX_WAVE_HEIGHT = 0.32 + 0.24 + 0.12;

/** CPU copy of the vertex shader's wave height, so boats and wakes ride the same waves. */
export function waveHeight(x: number, z: number, t: number): number {
  return (
    Math.sin(x * 0.12 + z * 0.07 + t * 1.1) * 0.32 +
    Math.sin(x * -0.05 + z * 0.15 + t * 0.8) * 0.24 +
    Math.sin(x * 0.21 + z * -0.17 + t * 1.7) * 0.12
  );
}

/**
 * The ocean of a quality level. The shader depends on the water look, not the grid resolution:
 * it shares the material of another level's ocean that draws the same water, so switching
 * between High and Medium never releases or relinks the same program.
 */
export function oceanFor(
  profile: QualityProfile,
  others: readonly Ocean[],
  land: { islands: readonly IslandDef[]; terrain: readonly TerrainDef[] },
  shore: ShoreTexture,
  seabed?: SeabedTexture,
): Ocean {
  const material = others.find(
    ({ mesh }) =>
      'FANCY' in mesh.material.defines === profile.fancyWater &&
      'REFLECT' in mesh.material.defines === profile.waterReflection,
  )?.mesh.material;
  const look = { fancy: profile.fancyWater, reflect: profile.waterReflection, seabed };
  return new Ocean(land.islands, profile.oceanSegments, look, 480, land.terrain, shore, material);
}

/** Which water shader a quality level draws. */
export interface WaterLook {
  /** Moving foam and per-pixel coasts (Medium and up). */
  fancy: boolean;
  /** Sky reflection, sun glint and soft foam (High and Ultra, decision 0221); needs `fancy`. */
  reflect?: boolean;
  /** Coloured by the seabed's depth and the sea's own colours (`?look=v2`, issue #274). */
  seabed?: SeabedTexture;
}

/**
 * Stylized low-poly ocean: a grid that follows the camera, vertex waves, flat shading, a shallow
 * tint and foam around islands. Cheap on purpose for old tablets; High and Ultra add a Fresnel
 * sky reflection and sun glint, still no reflection pass.
 */
export class Ocean {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  /** The grid's cell size (units), and how far its flat triangles part from the true waves. */
  readonly cell: number;
  private readonly sag: number;

  /** How much the waves calm toward the shore on this grid (0 to 1, `water.shoreCalm`). */
  get shoreCalm() {
    return Math.min(1, this.sag / TUNING.graphics.water.shoreCalm.sag);
  }
  private readonly ownsShore: boolean;
  private readonly ownsMaterial: boolean;
  private disposed = false;
  /** The sea's day colours at the camera, and the light's share of them now (time, weather). */
  private readonly ramp = newRamp();
  private readonly waterLight = new THREE.Color(1, 1, 1);
  private readonly shallowLight = new THREE.Color(1, 1, 1);

  constructor(
    islands: readonly IslandDef[],
    segments: number,
    look: WaterLook,
    size = 420,
    terrain: readonly TerrainDef[] = [],
    borrowedShore?: ShoreTexture,
    borrowedMaterial?: THREE.ShaderMaterial,
  ) {
    this.cell = size / segments;
    this.sag = waveSag(this.cell);
    const shore = borrowedShore ?? shoreTexture(islands, terrain);
    this.ownsShore = !borrowedShore;
    this.ownsMaterial = !borrowedMaterial;
    const material =
      borrowedMaterial ??
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        defines: {
          // The new look's Low reads the shore per pixel too (issue #277): per vertex, its coarse
          // grid smeared the shallows into a wide halo and lost the foam ring.
          ...(!look.fancy && !look.seabed
            ? { VERTEX_SHORES: '' }
            : look.reflect
              ? { FANCY: '', REFLECT: '' }
              : { FANCY: '' }),
          ...(look.seabed ? { DEPTH: '' } : {}),
        },
        uniforms: {
          uTime: { value: 0 },
          uShoreMap: { value: shore.texture },
          uShoreBounds: { value: shore.bounds },
          uDepthMap: { value: look.seabed?.texture ?? null },
          uDepthBounds: { value: look.seabed?.bounds ?? new THREE.Vector4(0, 0, 1, 1) },
          uDepthLook: { value: new THREE.Vector3() },
          uDayWater: { value: new THREE.Color(PALETTE.water) },
          uSunDir: { value: new THREE.Vector3(-0.45, 0.8, 0.35).normalize() },
          uWater: { value: new THREE.Color(PALETTE.water) },
          uWaterLight: { value: new THREE.Color(PALETTE.waterLight) },
          uShallow: { value: new THREE.Color(PALETTE.shallow) },
          uFoam: { value: new THREE.Color(PALETTE.foam) },
          uFogColor: { value: new THREE.Color(PALETTE.deepWater) },
          uFogNear: { value: 120 },
          uFogFar: { value: 210 },
          uSkyLight: { value: new THREE.Color(PALETTE.sky) },
          uSunColor: { value: new THREE.Color(PALETTE.sun) },
          uReflect: { value: 0 },
          uFresnelPower: { value: 4 },
          uGlint: { value: 0 },
          uGlintSharpness: { value: 90 },
          uGlintFade: { value: new THREE.Vector3(0.6, 0.85, 0.5) },
          uFoamLook: { value: new THREE.Vector4() },
          uShoreCalm: { value: new THREE.Vector2() },
        },
      });
    // The ring's colours until the first update places the camera.
    if (look.seabed) seaRampAt(0, 0, this.ramp);
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
  }

  /** A view-owned shore may change while this quality level is inactive. */
  setShore(shore: ShoreTexture): void {
    if (this.ownsShore) throw new Error('Only borrowed ocean shores may be replaced');
    this.mesh.material.uniforms.uShoreMap!.value = shore.texture;
    this.mesh.material.uniforms.uShoreBounds!.value = shore.bounds;
  }

  /** The view's seabed bake may change (a map edit) while this quality level is inactive. */
  setSeabed(seabed: SeabedTexture): void {
    this.mesh.material.uniforms.uDepthMap!.value = seabed.texture;
    this.mesh.material.uniforms.uDepthBounds!.value = seabed.bounds;
  }

  /** The sky's horizon tint of the sea at the camera (issue #276); null away from the new look. */
  get horizon(): THREE.Color | null {
    return this.depth ? this.ramp.horizon : null;
  }

  private get depth(): boolean {
    return 'DEPTH' in this.mesh.material.defines;
  }

  setFog(near: number, far: number): void {
    this.mesh.material.uniforms.uFogNear!.value = near;
    this.mesh.material.uniforms.uFogFar!.value = far;
  }

  /** Water, fog and reflected sky colours, for weather and time of day (decisions 0067, 0068). */
  setColors(look: Look): void {
    const u = this.mesh.material.uniforms;
    (u.uShallow!.value as THREE.Color).copy(look.shallow);
    (u.uFoam!.value as THREE.Color).copy(look.foam);
    (u.uWater!.value as THREE.Color).copy(look.water);
    (u.uWaterLight!.value as THREE.Color).copy(look.waterLight);
    (u.uFogColor!.value as THREE.Color).copy(look.sky);
    (u.uSkyLight!.value as THREE.Color).copy(look.skyLight);
    if (this.depth) this.applyRamp();
  }

  /**
   * The time of day and the weather, before any zone tints (atmosphere.ts): the depth colours are
   * the sea's day colours times this light's water against the day's, so dusk, night and storms
   * shade every sea alike, and a sea's own colours replace the old zone tint of its water.
   */
  setDaylight(look: Look): void {
    lightOf(look.water, DAY.water, this.waterLight);
    lightOf(look.shallow, DAY.shallow, this.shallowLight);
  }

  /** The depth colours: the sea's at the camera in the light of now. The rough and calm layers copy them. */
  private applyRamp() {
    const u = this.mesh.material.uniforms;
    const { shallow, mid, deep, night } = this.ramp;
    const lit = (u.uShallow!.value as THREE.Color).copy(shallow).multiply(this.shallowLight);
    dimShallow(
      lit,
      this.shallowLight,
      NIGHT_SHALLOW_LIGHT,
      TUNING.graphics.water.depth.nightShallow,
    );
    liftToFloor(lit, night);
    liftToFloor((u.uWaterLight!.value as THREE.Color).copy(mid).multiply(this.waterLight), night);
    liftToFloor((u.uWater!.value as THREE.Color).copy(deep).multiply(this.waterLight), night);
    (u.uDayWater!.value as THREE.Color).copy(deep);
  }

  /** The light (scene space, normalized direction), for the flat shading and the glint. */
  setSun(dir: THREE.Vector3, color: THREE.Color, intensity: number): void {
    const u = this.mesh.material.uniforms;
    (u.uSunDir!.value as THREE.Vector3).copy(dir);
    (u.uSunColor!.value as THREE.Color).copy(color).multiplyScalar(intensity);
  }

  /**
   * Keep the grid centered on the camera target, snapped to whole cells so waves don't swim.
   * `reflect` is the Settings switch for the sky reflection and glint (where the shader has them).
   */
  update(time: number, center: THREE.Vector3, reflect = true): void {
    const u = this.mesh.material.uniforms;
    u.uTime!.value = time;
    const w = TUNING.graphics.water;
    u.uReflect!.value = reflect ? w.reflection : 0;
    u.uGlint!.value = reflect ? w.glint : 0;
    u.uFresnelPower!.value = w.fresnelPower;
    u.uGlintSharpness!.value = w.glintSharpness;
    (u.uGlintFade!.value as THREE.Vector3).set(w.glintFadeFrom, w.glintFadeTo, w.glintMax);
    (u.uFoamLook!.value as THREE.Vector4).set(w.foamInner, w.foamWidth, w.foamStrength, w.foamLine);
    (u.uShoreCalm!.value as THREE.Vector2).set(this.shoreCalm, w.shoreCalm.units);
    if (this.depth) {
      (u.uDepthLook!.value as THREE.Vector3).set(w.depth.midAt, w.depth.crest, w.depth.shading);
      seaRampAt(center.x, -center.z, this.ramp);
      this.applyRamp();
    }
    this.mesh.position.set(
      Math.round(center.x / this.cell) * this.cell,
      0,
      Math.round(center.z / this.cell) * this.cell,
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.ownsShore) (this.mesh.material.uniforms.uShoreMap!.value as THREE.Texture).dispose();
    this.mesh.geometry.dispose();
    if (this.ownsMaterial) this.mesh.material.dispose();
  }
}

/** A light's colour against the day's, channel by channel, kept within reason. */
function lightOf(now: THREE.Color, day: THREE.Color, out: THREE.Color) {
  const ratio = (a: number, b: number) => Math.min(2, a / Math.max(b, 1e-4));
  return out.setRGB(ratio(now.r, day.r), ratio(now.g, day.g), ratio(now.b, day.b));
}

/** The shallows' light at full night against the day's: where `dimShallow` reaches full strength. */
const NIGHT_SHALLOW_LIGHT = lightOf(NIGHT.shallow, DAY.shallow, new THREE.Color());
