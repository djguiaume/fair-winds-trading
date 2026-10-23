import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { IslandStyle } from '../../data/islands';
import { vertexColorMaterial } from '../../render/models/geometry';
import { PROP_TYPES, type Parts } from '../../render/models/props';
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

function lights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(PALETTE.sky, '#1a4d55', 1.6));
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
  sun.position.set(-40, 100, 60);
  scene.add(sun);
}

/** A translucent sea at the waterline, so the beach below it reads as shallows. */
function sea(scene: THREE.Scene) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: SEA, transparent: true, opacity: 0.72 }),
  );
  plane.renderOrder = 1;
  scene.add(plane);
}

/** Merges an island's parts into one mesh geometry (and frees the parts). */
export function mergeParts(parts: Parts): THREE.BufferGeometry {
  for (const g of parts)
    for (const name of Object.keys(g.attributes))
      if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
  const merged = mergeGeometries(parts, false) ?? new THREE.BufferGeometry();
  for (const g of parts) g.dispose();
  merged.computeBoundingSphere();
  return merged;
}

/** The island straight from above, drawn when something changes (not every frame). */
export class TopView {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);
  private readonly island = new THREE.Mesh(new THREE.BufferGeometry(), vertexColorMaterial());
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
    this.scene.add(this.island, this.moving);
    this.camera.up.set(0, 0, -1);
  }

  setGeometry(geometry: THREE.BufferGeometry) {
    this.island.geometry = geometry;
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

/** The small 3D preview at the game camera's pitch; drag to turn round the island. */
export class Preview {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.5, 800);
  private readonly island = new THREE.Mesh(new THREE.BufferGeometry(), vertexColorMaterial());
  yaw = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setClearColor(SEA);
    lights(this.scene);
    sea(this.scene);
    this.scene.add(this.island);
    let from: number | null = null;
    canvas.addEventListener('pointerdown', (e) => {
      from = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (from === null) return;
      this.yaw -= (e.clientX - from) * 0.01;
      from = e.clientX;
      this.render();
    });
    const end = () => (from = null);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  setGeometry(geometry: THREE.BufferGeometry) {
    this.island.geometry = geometry;
    this.render();
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
    const d = (r / Math.sin(fov / 2)) * 0.9 * Math.max(1, 1.2 / this.camera.aspect);
    this.camera.position.set(
      c.x + Math.sin(this.yaw) * Math.cos(CAMERA_PITCH) * d,
      Math.sin(CAMERA_PITCH) * d,
      c.z + Math.cos(this.yaw) * Math.cos(CAMERA_PITCH) * d,
    );
    this.camera.lookAt(c.x, 0, c.z);
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
