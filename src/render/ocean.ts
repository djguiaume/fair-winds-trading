import * as THREE from 'three';
import type { IslandDef, TerrainDef } from '../sim/map';
import { PALETTE } from './palette';
import { TUNING } from '../data/tuning';
import type { QualityProfile } from './quality';
import { DAY, NIGHT, type Look } from './atmosphere';
import { type ShoreTexture, shoreTexture } from './shoreTexture';
import type { SeabedTexture } from './seabedTexture';
import { dimShallow, liftToFloor, newRamp, seaRampAt } from './seaWater';
import { oceanVertexShader as vertexShader, waveSag } from './oceanWaves';
import { oceanFragmentShader as fragmentShader } from './oceanShader';
import { type SeaWaves, gerstnerDefines, gerstnerUniforms } from './seaWaves';
import type { TerrainLook } from './terrainLook';

/** Conservative displacement bound: the classic waves' three amplitudes, or every band's cap. */
export const maxWaveHeight = () =>
  Math.max(
    0.32 + 0.24 + 0.12,
    Object.values(TUNING.waves.bands).reduce((sum, band) => sum + band.max, 0),
  );

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
  waves?: Pick<SeaWaves, 'gerstner'>,
  /** `v2` colours the water by `seabed`; otherwise it only calms the Gerstner waves. */
  terrain: TerrainLook = 'v2',
): Ocean {
  const gerstner = !!waves?.gerstner;
  const material = others.find(
    ({ mesh }) =>
      'FANCY' in mesh.material.defines === profile.fancyWater &&
      'REFLECT' in mesh.material.defines === profile.waterReflection &&
      'PLAIN' in mesh.material.defines === profile.plain,
  )?.mesh.material;
  const look = {
    fancy: profile.fancyWater,
    reflect: profile.waterReflection,
    plain: profile.plain,
    seabed: terrain === 'v2' ? seabed : undefined,
    gerstner,
    coast: gerstner ? seabed : undefined,
  };
  return new Ocean(land.islands, profile.oceanSegments, look, 480, land.terrain, shore, material);
}

/** Which water shader a quality level draws. */
export interface WaterLook {
  /** Moving foam and per-pixel coasts (Medium and up). */
  fancy: boolean;
  /** Sky reflection, sun glint and soft foam (High and Ultra, decision 0221); needs `fancy`. */
  reflect?: boolean;
  /** Shore and depth read per vertex and no per-pixel lighting (Ultra-low, decision 0247). */
  plain?: boolean;
  /** Coloured by the seabed's depth and the sea's own colours (`?look=v2`, issue #274). */
  seabed?: SeabedTexture;
  /** The wind and storm driven Gerstner waves (`?waves=v2`, decision 0245). */
  gerstner?: boolean;
  /** The bake whose depth and exposure calm the Gerstner waves near land (issue #281). */
  coast?: SeabedTexture;
}

/** The shader's switches for a water look. */
function waterDefines(look: WaterLook): Record<string, string> {
  // Ultra-low's finer grid carries the shore per vertex (decision 0247).
  if (look.plain) return { VERTEX_SHORES: '', PLAIN: '' };
  // The new look's Low reads the shore per pixel too (issue #277): per vertex, its coarse grid
  // smeared the shallows into a wide halo and lost the foam ring.
  if (!look.fancy && !look.seabed) return { VERTEX_SHORES: '' };
  return look.reflect ? { FANCY: '', REFLECT: '' } : { FANCY: '' };
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
  /** The grid's sag under today's waves: the classic ones', or the Gerstner sea's now. */
  private sag: number;
  private waves: SeaWaves | null = null;

  /** How much the waves calm toward the shore on this grid (0 to 1, `water.shoreCalm`). */
  get shoreCalm() {
    return Math.min(1, this.sag / TUNING.graphics.water.shoreCalm.sag);
  }

  /**
   * How high a sheet riding the waves (calm, rough and current water, the shallows) on its own
   * grid of `cell` units floats: it rides the same surface (`seaSurfaceShader`), so it only has to
   * clear both grids' sag.
   */
  sheetLift(base: number, cell: number) {
    const own = this.waves?.gerstner ? this.waves.sag(cell, this.cell) : waveSag(cell);
    return base + this.sag + own;
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
          ...waterDefines(look),
          ...(look.seabed ? { DEPTH: '' } : {}),
          ...(look.gerstner ? gerstnerDefines(!!look.coast) : {}),
        },
        uniforms: {
          uTime: { value: 0 },
          uShoreMap: { value: shore.texture },
          uShoreBounds: { value: shore.bounds },
          uDepthMap: { value: (look.seabed ?? look.coast)?.texture ?? null },
          uDepthBounds: {
            value: (look.seabed ?? look.coast)?.bounds ?? new THREE.Vector4(0, 0, 1, 1),
          },
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
          uFoamNight: { value: 1 },
          ...(look.gerstner ? gerstnerUniforms() : {}),
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
  update(time: number, center: THREE.Vector3, reflect = true, waves?: SeaWaves | null): void {
    const u = this.mesh.material.uniforms;
    u.uTime!.value = time;
    if (waves && 'GERSTNER' in this.mesh.material.defines) {
      waves.update();
      waves.writeUniforms(u as Parameters<SeaWaves['writeUniforms']>[0], this.cell);
      this.waves = waves;
      this.sag = waves.sag(this.cell, this.cell);
      const day = Math.min(1, (this.waterLight.r + this.waterLight.g + this.waterLight.b) / 3);
      u.uFoamNight!.value = THREE.MathUtils.lerp(TUNING.waves.foam.night, 1, day);
    }
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
