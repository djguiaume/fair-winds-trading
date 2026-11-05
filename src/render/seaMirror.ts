import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import type { QualityLevel } from './quality';

/** The scene seen from under the sea: boats, islands and the sky to mirror, nothing else. */
export interface MirrorRoots {
  /** The player's boat, read each frame: her root changes on a refit. */
  boat: () => THREE.Object3D;
  traffic: THREE.Object3D;
  islands: THREE.Object3D;
  sky: THREE.Object3D;
}

/** What the view tells the mirror each frame. */
export interface MirrorFrame {
  level: QualityLevel;
  /** Where the camera looks (scene units): islands farther than the level's range are left out. */
  target: THREE.Vector3;
  /** 0 by day .. 1 at full night: the reflection's strength follows `nightStrength`. */
  night: number;
  /** The Settings switch. */
  on: boolean;
}

/** One level's cost knobs (`graphics.json › reflection.levels`). */
export interface MirrorLevel {
  resolution: number;
  everyFrames: number;
  range: number;
  islands: boolean;
}

/** Islands are rebuilt as towns grow and shown as the seas open: measure their footprints this often. */
const REBOUND_SEC = 3;
const UP = new THREE.Vector3(0, 1, 0);
const SEA = new THREE.Vector3(0, 0, 0);
/** Clip space (-1..1) to texture space (0..1). */
const TO_TEXTURE = new THREE.Matrix4().set(
  0.5,
  0,
  0,
  0.5,
  0,
  0.5,
  0,
  0.5,
  0,
  0,
  0.5,
  0.5,
  0,
  0,
  0,
  1,
);

/** The level's knobs, or null when the level draws no mirror. */
export function mirrorLevel(level: QualityLevel): MirrorLevel | null {
  const levels = TUNING.graphics.reflection.levels as Partial<Record<QualityLevel, MirrorLevel>>;
  return levels[level] ?? null;
}

/** Whether frame `frame` (0, 1, 2…) redraws the mirror under the level's update policy. */
export const drawsOnFrame = (frame: number, everyFrames: number) =>
  frame % Math.max(1, Math.round(everyFrames)) === 0;

/** An island group's footprint on the sea, measured once per rebuild. */
interface Footprint {
  x: number;
  z: number;
  radius: number;
}

/** Is a footprint within `range` of the camera's target (edge to point)? */
export function withinRange(f: Footprint, target: { x: number; z: number }, range: number) {
  return Math.hypot(f.x - target.x, f.z - target.z) - f.radius <= range;
}

/**
 * Planar reflections on the sea (issue #285, decision 0289): the boats, the islands and the drawn
 * sky, drawn again from the camera's mirror image under the water into a texture at a share of the
 * screen resolution, which the water shader samples (`oceanShader.ts`, `MIRROR`). The sea itself,
 * its sheets, wakes, rain and every glow stay out, so there is no reflection of a reflection.
 * Every number is `graphics.json › reflection`; the level's `mirror` flag turns it on.
 */
export class SeaMirror {
  readonly target: THREE.WebGLRenderTarget;
  /** World to the mirror texture's (u, v, depth, w), for the water shader. */
  readonly textureMatrix = new THREE.Matrix4();
  private readonly mirrorCamera = new THREE.PerspectiveCamera();
  private readonly hidden: THREE.Object3D[] = [];
  private readonly footprints = new Map<THREE.Object3D, Footprint>();
  private readonly box = new THREE.Box3();
  private readonly plane = new THREE.Plane();
  private readonly clip = new THREE.Vector4();
  private readonly q = new THREE.Vector4();
  private readonly view = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private readonly rotation = new THREE.Matrix4();
  private readonly clearColor = new THREE.Color();
  private frame = 0;
  private sinceBounds = REBOUND_SEC;
  private readonly size = new THREE.Vector2();
  private resolution = 0;
  /** True while the shadow map update is ours to trigger (`shadowMap.autoUpdate` off). */
  private drivingShadows = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly roots: MirrorRoots,
  ) {
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.target.texture.name = 'sea mirror';
  }

  /** The strength the water shader mixes the mirror in with now; 0 when nothing was drawn. */
  strength(frame: MirrorFrame): number {
    if (!frame.on || !mirrorLevel(frame.level)) return 0;
    const r = TUNING.graphics.reflection;
    return r.strength * THREE.MathUtils.lerp(1, r.nightStrength, frame.night);
  }

  /**
   * Draw the mirror texture for this frame, before the scene itself. Returns false when nothing
   * was drawn (off, under the water, or a frame the level's policy skips), in which case the
   * last texture stands. Its draws count with the frame's (`?perf`, `?bench`): the count starts
   * here and the scene's pass adds to it (`UltraPipeline.compose` sees `autoReset` off).
   */
  render(dt: number, frame: MirrorFrame): boolean {
    const level = frame.on ? mirrorLevel(frame.level) : null;
    if (!level) return this.stop();
    this.driveShadows(true);
    const info = this.renderer.info;
    info.reset();
    info.autoReset = false;
    const draw = drawsOnFrame(this.frame++, level.everyFrames);
    if (!draw || !this.placeCamera()) return false;
    this.followResolution(level.resolution);
    this.sinceBounds += dt;
    if (this.sinceBounds >= REBOUND_SEC) this.measureIslands();
    this.hideOthers(level, frame.target);
    this.draw();
    this.restore();
    return true;
  }

  /** Nothing to mirror: the renderer updates its shadows and resets its counts by itself again. */
  private stop() {
    this.driveShadows(false);
    this.renderer.info.autoReset = true;
    return false;
  }

  /**
   * The shadow map is drawn once per frame, by the scene's own pass: the mirror pass borrows it.
   * Three draws the map when `autoUpdate` or `needsUpdate` says so, and clears `needsUpdate`.
   */
  private driveShadows(on: boolean) {
    const shadows = this.renderer.shadowMap;
    if (on === this.drivingShadows) {
      if (on) shadows.needsUpdate = true;
      return;
    }
    this.drivingShadows = on;
    shadows.autoUpdate = !on;
    shadows.needsUpdate = on;
  }

  /** The target follows the drawing buffer (a resize, a quality change) at the level's share. */
  private followResolution(resolution: number) {
    const size = this.renderer.getDrawingBufferSize(this.size);
    const width = Math.max(1, Math.round(size.x * resolution));
    const height = Math.max(1, Math.round(size.y * resolution));
    if (resolution === this.resolution && width === this.target.width) return;
    this.resolution = resolution;
    this.target.setSize(width, height);
  }

  /** The camera's mirror image under the sea, looking up; false when the camera is under it. */
  private placeCamera(): boolean {
    const camera = this.camera;
    const mirror = this.mirrorCamera;
    // As three's Reflector: the sea to the camera, mirrored, is the sea to its image.
    const view = this.view.copy(SEA).sub(camera.position);
    if (view.dot(UP) >= 0) return false;
    view.reflect(UP).negate().add(SEA);
    camera.updateMatrixWorld();
    this.rotation.extractRotation(camera.matrixWorld);
    const lookAt = this.lookAt.set(0, 0, -1).applyMatrix4(this.rotation).add(camera.position);
    lookAt.subVectors(SEA, lookAt).reflect(UP).negate().add(SEA);
    mirror.position.copy(view);
    mirror.up.set(0, 1, 0).applyMatrix4(this.rotation).reflect(UP);
    mirror.lookAt(lookAt);
    mirror.near = camera.near;
    mirror.far = camera.far;
    mirror.updateMatrixWorld();
    mirror.projectionMatrix.copy(camera.projectionMatrix);
    this.textureMatrix
      .copy(TO_TEXTURE)
      .multiply(mirror.projectionMatrix)
      .multiply(mirror.matrixWorldInverse);
    this.clipBelowSea();
    return true;
  }

  /**
   * The near plane becomes the sea's surface (an oblique projection, as three's `Reflector`), so
   * what lies under the water never shows in its mirror.
   */
  private clipBelowSea() {
    const mirror = this.mirrorCamera;
    const plane = this.plane
      .setFromNormalAndCoplanarPoint(UP, SEA)
      .applyMatrix4(mirror.matrixWorldInverse);
    const clip = this.clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const p = mirror.projectionMatrix.elements;
    const q = this.q;
    q.x = (Math.sign(clip.x) + p[8]!) / p[0]!;
    q.y = (Math.sign(clip.y) + p[9]!) / p[5]!;
    q.z = -1;
    q.w = (1 + p[10]!) / p[14]!;
    clip.multiplyScalar(2 / clip.dot(q));
    p[2] = clip.x;
    p[6] = clip.y;
    p[10] = clip.z + 1;
    p[14] = clip.w;
  }

  private measureIslands() {
    this.sinceBounds = 0;
    this.footprints.clear();
    for (const group of this.roots.islands.children) {
      if (!group.visible) continue;
      const box = this.box.setFromObject(group);
      if (box.isEmpty()) continue;
      const x = (box.min.x + box.max.x) / 2;
      const z = (box.min.z + box.max.z) / 2;
      this.footprints.set(group, { x, z, radius: Math.hypot(box.max.x - x, box.max.z - z) });
    }
  }

  /** Hide what the mirror leaves out: everything but the lights and the mirrored roots. */
  private hideOthers(level: MirrorLevel, target: THREE.Vector3) {
    const { traffic, islands, sky } = this.roots;
    const boat = this.roots.boat();
    for (const child of this.scene.children) {
      if (!child.visible || (child as THREE.Light).isLight) continue;
      if (child === boat || child === traffic || child === sky) continue;
      if (child === islands && level.islands) continue;
      this.hide(child);
    }
    if (!level.islands) return;
    for (const group of islands.children) {
      const footprint = this.footprints.get(group);
      if (group.visible && footprint && !withinRange(footprint, target, level.range))
        this.hide(group);
    }
  }

  private hide(object: THREE.Object3D) {
    object.visible = false;
    this.hidden.push(object);
  }

  private restore() {
    for (const object of this.hidden) object.visible = true;
    this.hidden.length = 0;
  }

  /** Into the texture, clear where nothing is mirrored: the water shows its own sky there. */
  private draw() {
    const renderer = this.renderer;
    const { scene } = this;
    const background = scene.background;
    renderer.getClearColor(this.clearColor);
    const clearAlpha = renderer.getClearAlpha();
    const shadows = renderer.shadowMap;
    const needsUpdate = shadows.needsUpdate;
    scene.background = null;
    shadows.needsUpdate = false;
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, this.mirrorCamera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(this.clearColor, clearAlpha);
    scene.background = background;
    shadows.needsUpdate = needsUpdate;
  }

  dispose() {
    this.stop();
    this.target.dispose();
  }
}
