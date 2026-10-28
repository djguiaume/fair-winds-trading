import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { IslandStyle } from '../../data/islands';
import { vertexColorMaterial } from '../../render/models/geometry';
import type { NewLookGround } from './newLook';
import { PROP_TYPES, type Parts } from '../../render/models/props';
import { NIGHT, WINDOWS_AT_NIGHT, WINDOWS_BY_DAY } from '../../render/atmosphere';
import { BeaconLights } from '../../render/beaconLights';
import { LighthouseBeams } from '../../render/lighthouseBeams';
import { ISLAND_SCALE } from '../../sim/islandUnits';
import type { IslandDef } from '../../sim/map';
import { PALETTE } from '../../render/palette';

/**
 * The island builder's three.js views (decision 0105): the island seen straight down
 * (orthographic, harbour at the bottom) under the SVG overlay, the small 3D preview at the game
 * camera's angle, and the palette's thumbnails rendered from the prop catalogue. Models are in
 * reference units; the builder's view is in island-radius units, so everything is scaled by R.
 */

/** The builder's view: centre and island-radius units per pixel. */
export interface IslandView {
  cx: number;
  cz: number;
  upp: number;
}

const SEA = '#2fa3b3';
const CAMERA_PITCH = (58 * Math.PI) / 180;

function lights(scene: THREE.Scene): [THREE.HemisphereLight, THREE.DirectionalLight] {
  const sky = new THREE.HemisphereLight(PALETTE.sky, '#1a4d55', 1.6);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
  sun.position.set(-40, 100, 60);
  scene.add(sky, sun);
  return [sky, sun];
}

/** A translucent sea at the waterline, so the beach below it reads as shallows. */
function sea(scene: THREE.Scene) {
  const material = new THREE.MeshBasicMaterial({ color: SEA, transparent: true, opacity: 0.72 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), material);
  plane.renderOrder = 1;
  scene.add(plane);
  return material;
}

/** Merges an island's parts into one mesh geometry (and frees the parts). */
export function mergeParts(parts: Parts): THREE.BufferGeometry {
  for (const g of parts)
    for (const name of Object.keys(g.attributes))
      if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
  // An island with no windows (a rock with a beacon) has no glass to merge.
  const merged = (parts.length && mergeGeometries(parts, false)) || new THREE.BufferGeometry();
  for (const g of parts) g.dispose();
  merged.computeBoundingSphere();
  return merged;
}

/** The new look's rolling ground (`?look=v2`), drawn apart from the faceted island. */
const groundMesh = () =>
  new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial());

/** Shows a view's new-look ground, or none; the views share it and free the old one. */
function setGround(mesh: THREE.Mesh, ground?: NewLookGround) {
  const old = mesh.material as THREE.MeshLambertMaterial;
  if (ground?.material !== old) {
    old.map?.dispose();
    old.dispose();
  }
  if (mesh.geometry !== ground?.geometry) mesh.geometry.dispose();
  mesh.geometry = ground?.geometry ?? new THREE.BufferGeometry();
  mesh.material = ground?.material ?? new THREE.MeshLambertMaterial();
}

/** The island straight from above, drawn when something changes (not every frame). */
export class TopView {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);
  private readonly island = new THREE.Mesh(new THREE.BufferGeometry(), vertexColorMaterial());
  private readonly ground = groundMesh();
  /** The prop being dragged, drawn apart until it is dropped and the island is rebuilt. */
  private readonly moving = new THREE.Group();
  private width = 1;
  private height = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setClearColor(SEA);
    lights(this.scene);
    sea(this.scene);
    this.scene.add(this.island, this.ground, this.moving);
    this.camera.up.set(0, 0, -1);
  }

  setGeometry(geometry: THREE.BufferGeometry, ground?: NewLookGround) {
    this.island.geometry = geometry;
    setGround(this.ground, ground);
  }

  /** Shows a prop's parts at a place (reference units), or nothing. */
  setMoving(parts: Parts | null, x = 0, y = 0, z = 0, turn = 0, scale = 1) {
    for (const child of [...this.moving.children]) {
      (child as THREE.Mesh).geometry.dispose();
      this.moving.remove(child);
    }
    if (!parts) return;
    const mesh = new THREE.Mesh(mergeParts(parts), vertexColorMaterial());
    mesh.position.set(x, y, z);
    mesh.rotation.y = turn;
    mesh.scale.setScalar(scale);
    this.moving.add(mesh);
  }

  /** Moves the shown prop without rebuilding it. */
  placeMoving(x: number, y: number, z: number, turn: number) {
    const mesh = this.moving.children[0];
    if (!mesh) return;
    mesh.position.set(x, y, z);
    mesh.rotation.y = turn;
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
  }

  render(view: IslandView, R: number) {
    const w = (this.width * view.upp * R) / 2,
      h = (this.height * view.upp * R) / 2;
    Object.assign(this.camera, { left: -w, right: w, top: h, bottom: -h });
    this.camera.updateProjectionMatrix();
    this.camera.position.set(view.cx * R, 300, view.cz * R);
    this.camera.lookAt(view.cx * R, 0, view.cz * R);
    this.renderer.render(this.scene, this.camera);
  }
}

/**
 * The 3D preview at the game camera's pitch: drag across to turn round the island, up and down to
 * tilt, wheel or pinch to zoom. By night it takes the game's moonlit look and lit windows.
 */
export class Preview {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.5, 800);
  private readonly island = new THREE.Mesh(new THREE.BufferGeometry(), vertexColorMaterial());
  private readonly ground = groundMesh();
  /** Window glass and street lamps, tinted like the game's (dark by day, lit at night). */
  private readonly glass = new THREE.MeshBasicMaterial({ vertexColors: true });
  private readonly windows = new THREE.Mesh(new THREE.BufferGeometry(), this.glass);
  private readonly sky: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly water: THREE.MeshBasicMaterial;
  /** Lighthouse beams and beacon lights: the game's, in world units, so scaled to the model. */
  private readonly lamps = new THREE.Group();
  private beams: LighthouseBeams | null = null;
  private beacons: BeaconLights | null = null;
  private frame = 0;
  yaw = 0;
  pitch = CAMERA_PITCH;
  zoom = 1;
  night = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    [this.sky, this.sun] = lights(this.scene);
    this.water = sea(this.scene);
    this.scene.add(this.island, this.ground, this.windows, this.lamps);
    this.lamps.scale.setScalar(1 / ISLAND_SCALE);
    this.setNight(false);
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    canvas.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      const from = pointers.get(e.pointerId);
      if (!from) return;
      if (pointers.size === 2) {
        from.x = e.clientX;
        from.y = e.clientY;
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinch) this.setZoom(this.zoom * (pinch / d));
        pinch = d;
        return;
      }
      this.yaw -= (e.clientX - from.x) * 0.01;
      this.pitch = Math.min(1.45, Math.max(0.2, this.pitch + (e.clientY - from.y) * 0.006));
      from.x = e.clientX;
      from.y = e.clientY;
      this.render();
    });
    const end = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.setZoom(this.zoom * Math.exp(e.deltaY * 0.001));
      },
      { passive: false },
    );
  }

  /** The island without its glass, and the glass on its own (the game draws them apart). */
  setGeometry(land: THREE.BufferGeometry, windows: THREE.BufferGeometry, ground?: NewLookGround) {
    this.island.geometry = land;
    this.windows.geometry = windows;
    setGround(this.ground, ground);
    this.render();
  }

  /**
   * The island's lighthouses and beacons, as the game lights them at night (decision 0121): one
   * island at the origin whose harbour faces +z, standing at the level shown.
   */
  setLamps(island: IslandDef, level: number) {
    this.beams?.dispose();
    this.beacons?.dispose();
    this.lamps.clear();
    this.beams = new LighthouseBeams([island], { [island.id]: level });
    this.beacons = new BeaconLights([island], { [island.id]: level });
    this.lamps.add(this.beams.root, this.beacons.points);
    this.render();
  }

  /** Back to the game camera's view. */
  resetView() {
    this.yaw = 0;
    this.pitch = CAMERA_PITCH;
    this.zoom = 1;
    this.render();
  }

  setZoom(zoom: number) {
    this.zoom = Math.min(2.5, Math.max(0.25, zoom));
    this.render();
  }

  /** The game's moonlit night (decision 0068) or the bright day, with windows lit or dark. */
  setNight(night: boolean) {
    this.night = night;
    const look = night ? NIGHT : null;
    this.sky.color.set(look ? look.skyLight : PALETTE.sky);
    this.sky.intensity = look ? look.skyIntensity : 1.6;
    this.sun.color.set(look ? look.sun : PALETTE.sun);
    this.sun.intensity = look ? look.sunIntensity : 1.6;
    this.water.color.set(look ? look.water : SEA);
    this.renderer.setClearColor(look ? look.water : SEA);
    this.glass.color.copy(night ? WINDOWS_AT_NIGHT : WINDOWS_BY_DAY);
    this.render();
    // At night the beams sweep and the beacons flash: keep drawing while it is shown.
    cancelAnimationFrame(this.frame);
    const tick = () => {
      if (!this.night) return;
      this.render();
      this.frame = requestAnimationFrame(tick);
    };
    if (night) this.frame = requestAnimationFrame(tick);
  }

  render() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    const sphere = this.island.geometry.boundingSphere;
    const r = sphere?.radius ?? 20;
    const c = sphere?.center ?? new THREE.Vector3();
    const fov = (this.camera.fov * Math.PI) / 180;
    const d = (r / Math.sin(fov / 2)) * 0.9 * Math.max(1, 1.2 / this.camera.aspect) * this.zoom;
    this.camera.position.set(
      c.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d,
      c.y + Math.sin(this.pitch) * d,
      c.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d,
    );
    // Centred on the whole model, so a tall lighthouse on a small rock stays in the picture.
    this.camera.lookAt(c);
    const time = performance.now() / 1000;
    this.beams?.update(time, this.night ? 1 : 0);
    this.beacons?.update(time, this.night ? 1 : 0);
    this.renderer.render(this.scene, this.camera);
  }
}

/** Picture of each catalogue prop in an island's style, as data URLs for the palette. */
export function thumbnails(style: IslandStyle, R: number, size = 96): Record<string, string> {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  lights(scene);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
  const out: Record<string, string> = {};
  for (const [id, type] of Object.entries(PROP_TYPES)) {
    const geometry = mergeParts(
      type.build({ R, style, variant: 0, shape: 0.5, size: type.sizedInModel ? 0.8 : 1 }),
    );
    const mesh = new THREE.Mesh(geometry, vertexColorMaterial());
    scene.add(mesh);
    const box = new THREE.Box3().setFromObject(mesh);
    const centre = box.getCenter(new THREE.Vector3());
    const r = Math.max(0.3, box.getSize(new THREE.Vector3()).length() / 2);
    const d = r / Math.sin((15 * Math.PI) / 180);
    camera.position.set(centre.x + d * 0.55, centre.y + d * 0.5, centre.z + d * 0.67);
    camera.lookAt(centre);
    renderer.render(scene, camera);
    out[id] = canvas.toDataURL();
    scene.remove(mesh);
    geometry.dispose();
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}
