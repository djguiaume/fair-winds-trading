import * as THREE from 'three';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { TUNING } from '../data/tuning';
import { DEG } from '../sim/math';
import { ShadowCasters } from './shadowCasters';
import type { SunShape } from './atmosphere';
import { GradeShader } from './gradeShader';
import { leanShadowMap } from './shadowTarget';
import { UltraBloom } from './ultraBloom';

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
  /** Ultra's glow round lit windows, lanterns and the moon (decision 0299). */
  bloom: boolean;
  /** The sea's sky reflection and sun glint, on High and Ultra. */
  reflection: boolean;
  /** The boats, islands and sky mirrored on the sea, on the levels with `mirror` (decision 0292). */
  mirror: boolean;
  /** The ground's cover on grass and sand, on the levels of `terrain.json › draw.cover.on` (0298). */
  groundCover: boolean;
  /** Ultra's multisampled off-screen render; on unless a `?off=msaa` device test says false. */
  msaa?: boolean;
  /** The wind's gusts on the sea; on unless a `?off=gusts` device test says false (issue #498). */
  gusts?: boolean;
}

/** Every effect on: the view's default before Settings are applied. */
export const allEffects = (): GraphicsEffects => ({
  shadows: true,
  occlusion: true,
  toneMapping: true,
  haze: true,
  bloom: true,
  reflection: true,
  mirror: true,
  groundCover: true,
});

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
 * multisampled anti-aliasing, a horizon haze and a glow round the night's lights. Every number is `TUNING.graphics.ultra`, read
 * each frame so the `?tune` page shows a change at once. Loaded only when Ultra is picked, so
 * phones never download it.
 *
 * A frame is two full-screen steps (decision 0297): the scene into one multisampled half-float
 * target, then one pass that multiplies in the occlusion, adds the bloom, grades and writes sRGB
 * to the canvas.
 * No full-resolution picture sits between them, which is what an effect composer would keep.
 */
export class UltraPipeline {
  /** The scene's multisampled colour and depth; replaced when the sample count changes. */
  private sceneTarget = sceneTarget(0);
  private readonly occlusion: GTAOPass;
  private readonly bloom = new UltraBloom();
  private readonly grade = new THREE.ShaderMaterial({
    name: 'UltraGrade',
    uniforms: THREE.UniformsUtils.clone(GradeShader.uniforms),
    vertexShader: GradeShader.vertexShader,
    fragmentShader: GradeShader.fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  private readonly screen = new FullScreenQuad(this.grade);
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
  /** How the canvas was made (it cannot change later). */
  private readonly canvas: CanvasBuffers;
  private readonly bufferSize = new THREE.Vector2();

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly light: THREE.DirectionalLight,
    /** Which effects are on: the player's Settings, shared with the view. */
    private readonly effects: Readonly<GraphicsEffects>,
  ) {
    const made = renderer.getContext().getContextAttributes();
    this.canvas = { antialias: !!made?.antialias, depth: made?.depth !== false };
    this.occlusion = new GTAOPass(scene, camera);
    // Only its occlusion picture is used: the grade multiplies it in (no copy of the scene).
    this.occlusion.output = GTAOPass.OUTPUT.Off;
    this.grade.uniforms.tOcclusion!.value = this.occlusion.pdRenderTarget.texture;
    this.hideFromOcclusion();
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
    const size = this.renderer.getDrawingBufferSize(this.bufferSize);
    this.sceneTarget.setSize(size.x, size.y);
    this.bloom.setSize(size.x, size.y);
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
    if (ultra.occlusion.resolution !== this.aoResolution)
      this.setSize(this.width, this.height, this.pixelRatio);
    this.followOcclusion();
    const ao = ultra.occlusion;
    const u = this.grade.uniforms;
    u.uOcclusion!.value = this.effects.occlusion ? lerp(ao.strength, ao.nightStrength, night) : 0;
    u.uToneMap!.value = this.effects.toneMapping ? 1 : 0;
    u.uExposure!.value = lerp(ultra.exposure, ultra.nightExposure, night);
    u.uToe!.value = lerp(ultra.toe, ultra.nightToe, night);
    const haze = ultra.haze;
    (u.uHazeColor!.value as THREE.Color)
      .set(haze.dayColor)
      .lerp(this.hazeNight.set(haze.nightColor), night);
    u.uHazeStart!.value = ultra.haze.start;
    u.uHazeStrength!.value = this.effects.haze ? ultra.haze.strength : 0;
    const samples = this.effects.msaa !== false ? ultra.antialiasSamples : 0;
    this.draw(samples, this.effects.occlusion, this.effects.bloom ? night : undefined);
  }

  /**
   * A level below Ultra after a step down, drawn plain through the scene target when the canvas
   * cannot draw it itself (`drawsBelowUltra`). False when the view should draw the frame.
   */
  renderPlain(level: { antialias: boolean }): boolean {
    if (!drawsBelowUltra(this.canvas, level)) return false;
    const u = this.grade.uniforms;
    u.uOcclusion!.value = 0;
    u.uHazeStrength!.value = 0;
    u.uToneMap!.value = 0;
    this.draw(level.antialias ? TUNING.graphics.ultra.antialiasSamples : 0, false);
    return true;
  }

  /** `bloomNight` is how far into the night the bloom's threshold is; left out, no bloom. */
  private draw(samples: number, occlusion: boolean, bloomNight?: number) {
    this.followSamples(samples);
    // One frame is many render calls here: count them all, so `?perf` and `?bench` stay honest
    // (the view counts from the sea mirror's pass when it drew one first).
    const renderer = this.renderer;
    const info = renderer.info;
    if (info.autoReset) info.reset();
    info.autoReset = false;
    renderer.setRenderTarget(this.sceneTarget);
    renderer.render(this.scene, this.camera);
    if (occlusion) this.occlusion.render(renderer, this.sceneTarget, this.sceneTarget, 0, false);
    const u = this.grade.uniforms;
    u.tDiffuse!.value = this.sceneTarget.texture;
    if (bloomNight === undefined) {
      this.bloom.release();
      u.uBloom!.value = 0;
    } else {
      const glow = this.bloom.render(renderer, this.sceneTarget, bloomNight);
      u.tBloom!.value = glow.texture;
      u.uBloom!.value = glow.weight;
    }
    renderer.setRenderTarget(null);
    this.screen.render(renderer);
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
      shadow.map = leanShadowMap(want.mapSize, this.renderer.state.buffers.depth.getReversed());
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

  /** A new sample count needs a new scene target. */
  private followSamples(samples: number) {
    if (samples === this.samples) return;
    this.samples = samples;
    this.sceneTarget.dispose();
    this.sceneTarget = sceneTarget(samples);
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
    this.bloom.dispose();
    this.grade.dispose();
    this.screen.dispose();
    this.sceneTarget.dispose();
  }
}

/** What the canvas was made with. */
export interface CanvasBuffers {
  antialias: boolean;
  depth: boolean;
}

/**
 * Whether the pipeline draws a level below Ultra. A canvas made for Ultra has no anti-aliasing
 * (decision 0246) and no depth (0297) of its own: every level goes through the scene target on
 * it. A canvas with depth draws the level itself, unless the level wants anti-aliasing it lacks.
 */
export function drawsBelowUltra(canvas: CanvasBuffers, level: { antialias: boolean }): boolean {
  return !canvas.depth || (level.antialias && !canvas.antialias);
}

/** Half-float for the tone mapping's headroom; nothing reads its depth, so it is never resolved. */
function sceneTarget(samples: number) {
  return new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples,
    resolveDepthBuffer: false,
  });
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
