import * as THREE from 'three';
import { createBoatModel, type BoatModel, type ShipUpgrades } from './models';
import type { BoatLook } from './models/boatLook';
import type { FlagDef } from '../sim/regatta';
import { DAY, NIGHT, type Look } from './atmosphere';
import { QUALITY, type QualityLevel } from './quality';
import { buildProp } from './models/propRecipe';
import { mergeAll, vertexColorMaterial } from './models/geometry';
import { Wake } from './wake';
import SETTINGS from '../data/boat-preview.json';

/**
 * One boat on a slow turntable, locked to the waterline (issue #299): the Boat looks screen's
 * preview, and Free Sailing's (#300). The real game model with her class, upgrades, damage and
 * look, lit by the game's own day or night light. Its own small WebGL canvas: made when a screen
 * opens, `dispose` frees every GPU resource when it closes.
 */
export interface PreviewBoat {
  shipClass: string;
  upgrades: ShipUpgrades;
  damage: 0 | 1 | 2 | 3;
  look: Partial<BoatLook>;
  flag?: FlagDef;
  /** Her wake style (decision 0264), laid astern as if she sailed; none is the plain wake. */
  wake?: { style: string; tint: string | null };
}

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const VIEWS = SETTINGS.views as Record<
  'whole' | 'bow' | 'masthead' | 'stern' | 'side',
  { yaw: number | null; zoom: number; at: number[]; tilt: number }
>;
export type ViewName = keyof typeof VIEWS;
/** The view each Boat looks slot turns to; the others show the whole boat. */
export const SLOT_VIEWS = SETTINGS.slotViews as Record<string, ViewName | undefined>;

export class BoatPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(SETTINGS.fov, 1, 0.5, 600);
  private readonly sun = new THREE.DirectionalLight();
  private readonly sky = new THREE.HemisphereLight();
  private readonly water: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly wake = new Wake();
  private boat: BoatModel | null = null;
  private key = '';
  private radius = 10;
  /** Her size at yaw 0 and her waterline's half length, for the views' look-at points. */
  private readonly box = new THREE.Box3();
  private halfLength = 5;
  private yaw = SETTINGS.startYaw * DEG;
  private view: ViewName = 'whole';
  /** Eased toward the view's: how close, and the point looked at (in her own frame). */
  private zoom = 1;
  private tilt = VIEWS.whole.tilt;
  private readonly at = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();
  private night = 0;
  private frame = 0;
  private last = 0;
  private readonly lowDetail: boolean;
  /** Turns by itself unless the player asked for less motion. */
  private readonly spins = !matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    quality: QualityLevel,
  ) {
    const profile = QUALITY[quality];
    this.lowDetail = profile.lowDetail;
    // One small boat: crisp at the screen's own pixels (up to `maxPixelRatio`) on every level.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, SETTINGS.maxPixelRatio));
    this.water = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({ map: softDisc(), transparent: true, depthWrite: false }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.renderOrder = 1;
    this.wake.setQuality(quality);
    this.wake.mesh.renderOrder = 2;
    this.scene.add(this.sky, this.sun, this.sun.target, this.water, this.wake.mesh);
    this.at.fromArray(VIEWS.whole.at);
    this.setNight(false);
  }

  /** Shows this boat; rebuilds the model only when something on it changed. */
  show(boat: PreviewBoat) {
    const key = JSON.stringify(boat);
    if (key === this.key) return;
    this.key = key;
    this.disposeBoat();
    const model = createBoatModel(boat.shipClass, {
      upgrades: boat.upgrades,
      damage: boat.damage,
      look: boat.look,
      ...(boat.flag ? { flag: boat.flag } : {}),
    });
    model.setLowDetail?.(this.lowDetail);
    model.setNightLighting?.(this.night);
    model.update({ sail: 1, boomAngle: -0.3, luff: 0, heel: 0, windRelative: 2.4, time: 1 });
    this.scene.add(model.root);
    this.boat = model;
    this.frameBoat(model);
    this.layWake(model, boat.wake);
    this.draw();
  }

  /** The game's moonlit night or its bright day, on the boat and the water. */
  setNight(on: boolean) {
    this.night = on ? 1 : 0;
    const l: Look = on ? NIGHT : DAY;
    this.sun.color.copy(l.sun);
    this.sun.intensity = l.sunIntensity;
    this.sky.color.copy(l.skyLight);
    this.sky.groundColor.copy(l.water);
    this.sky.intensity = l.skyIntensity;
    this.water.material.color.set(this.backdrop.sea);
    this.boat?.setNightLighting?.(this.night);
    this.draw();
  }

  /** The sky and sea the screen paints behind the canvas, matching the water disc. */
  get backdrop(): { sky: string; sea: string } {
    return this.night ? SETTINGS.backdrop.night : SETTINGS.backdrop.day;
  }

  /** A step round by hand (buttons, keys, the pad's shoulder): `dir` -1 or 1. */
  turn(dir: number) {
    this.yaw += dir * SETTINGS.stepDeg * DEG;
    this.draw();
  }

  /**
   * Turns her and the camera to a view (`boat-preview.json` › `views`): the whole boat, or close
   * on the bow, the masthead, the stern or her side. `now` jumps there (a screenshot, reduced motion).
   */
  setView(view: ViewName, now = !this.spins) {
    this.view = view;
    if (now) {
      const v = VIEWS[view];
      if (v.yaw !== null) this.yaw = v.yaw * DEG;
      this.zoom = v.zoom;
      this.tilt = v.tilt;
      this.at.fromArray(v.at);
      this.place();
    }
    this.draw();
  }

  /** Starts the slow turn; the screen calls `stop` when it hides. */
  start() {
    if (this.frame) return;
    this.last = performance.now();
    const tick = (now: number) => {
      this.ease(Math.min(0.5, (now - this.last) / 1000));
      this.last = now;
      this.draw();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  /** Follows the canvas's CSS size (the layout changes between phone and desktop). */
  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.place();
    this.draw();
  }

  /**
   * A carving on its own, as an image URL for its tile: the real model seen from the side and a
   * little ahead, lit like the boat, framed to fill `px` square. Drawn off screen in this canvas's
   * context, so the tiles cost no second renderer.
   */
  figureheadPicture(recipe: string, px: number): string {
    const geometry = mergeAll(
      buildProp(recipe, { R: 1, style: 'timber', variant: 0, shape: 0, size: 1 }),
    );
    const material = vertexColorMaterial();
    const carving = new THREE.Mesh(geometry, material);
    const scene = new THREE.Scene();
    scene.add(carving, new THREE.HemisphereLight(DAY.skyLight, DAY.water, DAY.skyIntensity));
    const light = new THREE.DirectionalLight(DAY.sun, DAY.sunIntensity);
    light.position.set(1, 2, 1.5);
    scene.add(light);
    const sphere = new THREE.Box3().setFromObject(carving).getBoundingSphere(new THREE.Sphere());
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    const dist = sphere.radius / Math.sin(15 * DEG);
    camera.position.copy(sphere.center).add(new THREE.Vector3(dist * 0.85, dist * 0.2, dist * 0.5));
    camera.lookAt(sphere.center);
    const target = new THREE.WebGLRenderTarget(px, px, { samples: 4 });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    this.renderer.setRenderTarget(target);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    const pixels = new Uint8Array(px * px * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, px, px, pixels);
    this.renderer.setRenderTarget(null);
    target.dispose();
    geometry.dispose();
    material.dispose();
    return pixelsToUrl(pixels, px);
  }

  dispose() {
    this.stop();
    this.disposeBoat();
    this.water.geometry.dispose();
    this.water.material.map?.dispose();
    this.water.material.dispose();
    this.wake.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  /** One frame toward the view: her turn, the zoom and the point looked at. */
  private ease(dt: number) {
    const v = VIEWS[this.view];
    // The same glide at any frame rate: a slow phone gets there as soon as a fast desktop.
    const k = 1 - Math.exp(-dt * SETTINGS.ease);
    if (v.yaw === null) {
      if (this.spins) this.yaw += dt * SETTINGS.spinDegPerSecond * DEG;
    } else {
      const delta = Math.atan2(Math.sin(v.yaw * DEG - this.yaw), Math.cos(v.yaw * DEG - this.yaw));
      this.yaw += delta * k;
    }
    this.zoom += (v.zoom - this.zoom) * k;
    this.tilt += (v.tilt - this.tilt) * k;
    this.at.lerp(this.aim.fromArray(v.at), k);
    this.place();
  }

  private draw() {
    if (!this.boat) return;
    this.boat.root.rotation.y = this.yaw;
    this.wake.mesh.rotation.y = this.yaw;
    this.renderer.render(this.scene, this.camera);
  }

  private disposeBoat() {
    if (!this.boat) return;
    this.scene.remove(this.boat.root);
    this.boat.dispose();
    this.boat = null;
  }

  /** Her wake astern (she points to -Z), laid at once as if she sailed at `wakeKnots`. */
  private layWake(model: BoatModel, style: PreviewBoat['wake'] | null = null) {
    this.wake.setStyle(style);
    this.wake.preview(0, this.aim.set(0, 0, 0), 0, -1, SETTINGS.wakeKnots, model.wakeHull);
  }

  /** The water disc and the camera sized to the boat, whatever her class. */
  private frameBoat(model: BoatModel) {
    const sphere = new THREE.Box3().setFromObject(model.root).getBoundingSphere(new THREE.Sphere());
    this.radius = sphere.radius;
    this.box.setFromObject(model.root);
    this.halfLength = model.wakeHull.length / 2;
    this.water.scale.setScalar(sphere.radius * SETTINGS.discScale);
    this.sun.position.set(-0.5, 1, 0.6).multiplyScalar(sphere.radius * 3);
    this.place();
  }

  /**
   * The whole boat: far enough that she fits as she turns, in a tall or a wide canvas. A closer
   * view looks at its point on her (turned with her), `zoom` times nearer.
   */
  private place() {
    const vFov = (this.camera.fov * DEG) / 2;
    const hFov = Math.atan(Math.tan(vFov) * this.camera.aspect);
    const dist = ((this.radius / Math.sin(Math.min(vFov, hFov))) * SETTINGS.margin) / this.zoom;
    const { min, max } = this.box;
    const point = this.aim.set(
      this.at.x * (max.x - min.x) * 0.5,
      this.at.y * max.y,
      this.at.z * this.halfLength,
    );
    point.applyAxisAngle(UP, this.yaw);
    const tilt = this.tilt * DEG;
    this.camera.position.set(
      point.x,
      point.y + Math.sin(tilt) * dist,
      point.z + Math.cos(tilt) * dist,
    );
    this.camera.lookAt(point);
    this.camera.updateProjectionMatrix();
  }
}

/** A soft round of water under her: full in the middle, gone at the rim, no hard edge or blob. */
function softDisc(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(SETTINGS.discSolid, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Read-back pixels (bottom row first) as a PNG data URL. */
function pixelsToUrl(pixels: Uint8Array, px: number): string {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d')!;
  const image = g.createImageData(px, px);
  const row = px * 4;
  for (let y = 0; y < px; y++)
    image.data.set(pixels.subarray((px - 1 - y) * row, (px - y) * row), y * row);
  g.putImageData(image, 0, 0);
  return c.toDataURL('image/png');
}
