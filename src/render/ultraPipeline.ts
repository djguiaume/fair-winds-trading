import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { TUNING } from '../data/tuning';
import { DEG } from '../sim/math';
import { ShadowCasters } from './shadowCasters';
import type { SunShape } from './atmosphere';
import { GradeShader } from './gradeShader';

/** The effects the player can switch off one by one (Settings, decision 0221). */
export interface GraphicsEffects {
  /** Ultra's soft shadows on everything. */
  shadows: boolean;
  /** Ultra's ambient occlusion. */
  occlusion: boolean;
  /** Ultra's tone mapping (Neutral, decision 0221). */
  toneMapping: boolean;
  /** Ultra's horizon haze. */
  haze: boolean;
  /** The sea's sky reflection and sun glint, on High and Ultra. */
  reflection: boolean;
  /** Ultra's multisampled off-screen render; on unless a `?off=msaa` device test says false. */
  msaa?: boolean;
}

/** GTAOPass's hooks for what its normal pass leaves out; not in the published types. */
interface OcclusionInternals {
  _overrideVisibility(): void;
  _visibilityCache: THREE.Object3D[];
}

/** The shadow settings the other levels use, put back when Ultra is left. */
interface ShadowSnapshot {
  mapSize: number;
  radius: number;
  bias: number;
  normalBias: number;
  box: number;
  far: number;
  intensity: number;
}

/**
 * The Ultra render pipeline (decision 0221), for desktop GPUs and the Xbox: neutral tone mapping,
 * soft shadows on every lit mesh round the camera, ambient occlusion at a share of the resolution,
 * multisampled anti-aliasing and a horizon haze. Every number is `TUNING.graphics.ultra`, read
 * each frame so the `?tune` page shows a change at once. Loaded only when Ultra is picked, so
 * phones never download it.
 */
export class UltraPipeline {
  private readonly composer: EffectComposer;
  private readonly occlusion: GTAOPass;
  private readonly grade = new ShaderPass(GradeShader);
  private readonly casters = new ShadowCasters();
  private readonly highShadow: ShadowSnapshot;
  private readonly sun: SunShape = { height: 1, turn: 0, distance: 60 };
  private active = false;
  private samples = -1;
  /** The occlusion numbers last given to the pass, so its material is only rebuilt on a change. */
  private readonly aoKey = { radius: 0, distanceExponent: 0, thickness: 0, scale: 0, samples: 0 };
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private aoResolution = 0;
  private readonly hazeNight = new THREE.Color();

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    private readonly light: THREE.DirectionalLight,
    /** Which effects are on: the player's Settings, shared with the view. */
    private readonly effects: Readonly<GraphicsEffects>,
  ) {
    this.composer = new EffectComposer(renderer, this.target(0));
    this.composer.addPass(new RenderPass(scene, camera));
    this.occlusion = new GTAOPass(scene, camera);
    this.hideFromOcclusion();
    this.composer.addPass(this.occlusion);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    const s = light.shadow;
    this.highShadow = {
      mapSize: s.mapSize.x,
      radius: s.radius,
      bias: s.bias,
      normalBias: s.normalBias,
      box: s.camera.right,
      far: s.camera.far,
      intensity: s.intensity,
    };
  }

  /**
   * The water, see-through and unlit meshes stay out of the occlusion's normal pass: the sea
   * would show black bands and glows would darken what is behind them.
   */
  private hideFromOcclusion() {
    const pass = this.occlusion as unknown as OcclusionInternals;
    const base = pass._overrideVisibility.bind(pass);
    pass._overrideVisibility = () => {
      base();
      for (const o of this.casters.unlit) {
        if (!o.visible) continue;
        o.visible = false;
        pass._visibilityCache.push(o);
      }
    };
  }

  private target(samples: number) {
    return new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
  }

  /** Lantern glow size and lit-window brightness at night on Ultra (from the tuning). */
  get night() {
    return TUNING.graphics.ultra.night;
  }

  /** Where the sun stands on Ultra: lower, and turned so noon shadows fall to the side. */
  get sunShape(): SunShape {
    const s = TUNING.graphics.ultra.shadows;
    this.sun.height = s.sunHeight;
    this.sun.turn = s.sunTurnDeg * DEG;
    this.sun.distance = s.distance;
    return this.sun;
  }

  /** Turn the pipeline on (Ultra picked) or off (another level), and the soft shadows with it. */
  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    if (!on) {
      this.casters.restore(this.scene);
      this.applyShadow(this.highShadow);
    } else this.casters.markDirty();
  }

  /** Something was added to or rebuilt in the scene: cast its shadows at the next frame. */
  sceneChanged() {
    this.casters.markDirty();
  }

  setSize(width: number, height: number, pixelRatio: number) {
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    const res = (this.aoResolution = TUNING.graphics.ultra.occlusion.resolution);
    this.occlusion.setSize(
      Math.max(1, Math.round(width * pixelRatio * res)),
      Math.max(1, Math.round(height * pixelRatio * res)),
    );
  }

  /** Draw a frame through the pipeline; `night` 0..1 eases the effects off in the dark. */
  render(dt: number, night: number) {
    const ultra = TUNING.graphics.ultra;
    this.casters.update(dt, this.scene, this.effects.shadows);
    this.followShadows(night);
    this.followSamples(this.effects.msaa !== false ? ultra.antialiasSamples : 0);
    if (ultra.occlusion.resolution !== this.aoResolution)
      this.setSize(this.width, this.height, this.pixelRatio);
    this.followOcclusion();
    const ao = ultra.occlusion;
    this.occlusion.enabled = this.effects.occlusion;
    this.occlusion.blendIntensity = lerp(ao.strength, ao.nightStrength, night);
    const u = this.grade.uniforms;
    u.uToneMap!.value = this.effects.toneMapping ? 1 : 0;
    u.uExposure!.value = lerp(ultra.exposure, ultra.nightExposure, night);
    u.uToe!.value = lerp(ultra.toe, ultra.nightToe, night);
    const haze = ultra.haze;
    (u.uHazeColor!.value as THREE.Color)
      .set(haze.dayColor)
      .lerp(this.hazeNight.set(haze.nightColor), night);
    u.uHazeStart!.value = ultra.haze.start;
    u.uHazeStrength!.value = this.effects.haze ? ultra.haze.strength : 0;
    // One frame is many render calls here: count them all, so `?perf` and `?bench` stay honest.
    const info = this.renderer.info;
    info.reset();
    info.autoReset = false;
    this.composer.render(dt);
    info.autoReset = true;
  }

  /** Soft shadows sized from the tuning; dimmer under the moon so the night is never black. */
  private followShadows(night: number) {
    const s = TUNING.graphics.ultra.shadows;
    this.renderer.shadowMap.enabled = this.effects.shadows;
    this.light.castShadow = this.effects.shadows;
    this.applyShadow({
      mapSize: s.mapSize,
      radius: s.radius,
      bias: s.bias,
      normalBias: s.normalBias,
      box: s.box,
      far: s.distance + s.box,
      intensity: lerp(1, s.nightStrength, night),
    });
  }

  private applyShadow(want: ShadowSnapshot) {
    const shadow = this.light.shadow;
    if (shadow.mapSize.x !== want.mapSize) {
      shadow.mapSize.set(want.mapSize, want.mapSize);
      shadow.map?.dispose();
      shadow.map = null;
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

  /** A new sample count needs new render targets. */
  private followSamples(samples: number) {
    if (samples === this.samples) return;
    this.samples = samples;
    this.composer.reset(this.target(samples));
    this.setSize(this.width, this.height, this.pixelRatio);
  }

  private followOcclusion() {
    const ao = TUNING.graphics.ultra.occlusion;
    const key = this.aoKey;
    if (
      key.radius === ao.radius &&
      key.distanceExponent === ao.distanceExponent &&
      key.thickness === ao.thickness &&
      key.scale === ao.scale &&
      key.samples === ao.samples
    )
      return;
    Object.assign(key, {
      radius: ao.radius,
      distanceExponent: ao.distanceExponent,
      thickness: ao.thickness,
      scale: ao.scale,
      samples: ao.samples,
    });
    this.occlusion.updateGtaoMaterial({ ...key });
  }

  dispose() {
    this.setActive(false);
    this.occlusion.dispose();
    this.grade.dispose();
    this.composer.dispose();
  }
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
