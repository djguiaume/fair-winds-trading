import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { DEG } from '../sim/math';
import type { SkyFrame } from './atmosphere';
import { buildClouds, type CloudShape } from './skyClouds';
import { SKY_FRAGMENT, SKY_VERTEX } from './skyShader';

/** The dome reaches this far below the horizon, past where the sea's far edge ends in fog. */
const BELOW_HORIZON = 6 * DEG;
/** Below this `low` the dome is hidden: the sea camera never sees the sky. */
const SHOWN_FROM = 0.001;

/** The dome (`aShade` -1) and the clouds after it, in one geometry so they cost one draw. */
function skyGeometry(clouds: CloudShape): THREE.BufferGeometry {
  const dome = new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2 + BELOW_HORIZON);
  const domeCount = dome.attributes.position!.count;
  const cloud = buildClouds(clouds, domeCount);
  const positions = [...(dome.attributes.position!.array as Float32Array), ...cloud.positions];
  const shades = [...new Array<number>(domeCount).fill(-1), ...cloud.shades];
  const indices = [...Array.from(dome.index!.array), ...cloud.indices];
  dome.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aShade', new THREE.Float32BufferAttribute(shades, 1));
  geometry.setIndex(indices);
  return geometry;
}

/** A copy of the cloud numbers, kept to notice a `?tune` edit without allocating each frame. */
const copyShape = (c: CloudShape): CloudShape => ({
  count: c.count,
  seed: c.seed,
  baseDeg: [...c.baseDeg],
  widthDeg: [...c.widthDeg],
  heightDeg: [...c.heightDeg],
});

function sameList(a: readonly number[], b: readonly number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const sameShape = (a: CloudShape, b: CloudShape) =>
  a.count === b.count &&
  a.seed === b.seed &&
  sameList(a.baseDeg, b.baseDeg) &&
  sameList(a.widthDeg, b.widthDeg) &&
  sameList(a.heightDeg, b.heightDeg);

/**
 * The drawn sky of the low views (issue #470): seen only from the chase camera, it fades in with
 * the camera's switch. Its colours come from the atmosphere each frame, so the time of day, storms
 * and fog banks change it for free; its horizon is the fog colour, so the far sea melts into it.
 * One mesh, one draw call, no texture; drawn after the opaque scene and only where it shows.
 */
export class SkyDome {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  /** The cloud numbers the geometry was built from. */
  private shape: CloudShape;
  private cloudTurn = 0;
  private readonly lit = new THREE.Color();
  private readonly shade = new THREE.Color();

  constructor() {
    const clouds = TUNING.graphics.sky.clouds;
    this.shape = copyShape(clouds);
    const material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      uniforms: {
        uHorizon: { value: new THREE.Color() },
        uZenith: { value: new THREE.Color() },
        uGradient: { value: new THREE.Vector4() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color() },
        uSun: { value: new THREE.Vector4() },
        uStars: { value: new THREE.Vector2() },
        uCloudLit: { value: new THREE.Color() },
        uCloudShade: { value: new THREE.Color() },
        uCloud: { value: new THREE.Vector2() },
        uCloudTurn: { value: 0 },
      },
      side: THREE.DoubleSide,
      depthWrite: false,
      depthFunc: THREE.LessEqualDepth,
    });
    this.mesh = new THREE.Mesh(skyGeometry(clouds), material);
    this.mesh.name = 'sky dome';
    // Behind everything, so drawn last of the solid scene: the depth test skips what is covered.
    this.mesh.renderOrder = 1000;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Each frame: the atmosphere's sky, and the wind (knots) the clouds drift with. */
  update(dt: number, sky: Readonly<SkyFrame>, windKn: number) {
    this.mesh.visible = sky.low > SHOWN_FROM;
    if (!this.mesh.visible) return;
    const data = TUNING.graphics.sky;
    this.rebuildClouds(data.clouds);
    this.cloudTurn =
      (this.cloudTurn + data.clouds.driftDegPerKn * windKn * DEG * dt) % (Math.PI * 2);
    const u = this.mesh.material.uniforms;
    (u.uHorizon!.value as THREE.Color).copy(sky.horizon);
    (u.uZenith!.value as THREE.Color).copy(sky.zenith);
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
    this.setClouds(sky);
    u.uCloudTurn!.value = this.cloudTurn;
  }

  private setSun(sky: Readonly<SkyFrame>) {
    const sun = TUNING.graphics.sky.sun;
    const u = this.mesh.material.uniforms;
    (u.uSunDir!.value as THREE.Vector3).copy(sky.disc);
    (u.uSunColor!.value as THREE.Color).copy(sky.discColor);
    const size = sun.sizeDeg + (sun.moonSizeDeg - sun.sizeDeg) * sky.night;
    // A storm hides the sun; its glow goes a little slower.
    (u.uSun!.value as THREE.Vector4).set(
      size * DEG,
      sun.glow * (1 - 0.8 * sky.gloom),
      sun.glowDeg * DEG,
      1 - sky.gloom,
    );
  }

  /** Sunlit tops in the sun's colour, bases in the sky's shade (white, gold, moonlit, grey). */
  private setClouds(sky: Readonly<SkyFrame>) {
    const clouds = TUNING.graphics.sky.clouds;
    const u = this.mesh.material.uniforms;
    this.lit.copy(sky.horizon).lerp(sky.discColor, clouds.light * (1 - 0.6 * sky.gloom));
    this.shade.copy(sky.horizon).lerp(sky.zenith, 0.3).multiplyScalar(clouds.shade);
    (u.uCloudLit!.value as THREE.Color).copy(this.lit);
    (u.uCloudShade!.value as THREE.Color).copy(this.shade);
    (u.uCloud!.value as THREE.Vector2).set(clouds.cover, clouds.haze);
  }

  private rebuildClouds(clouds: CloudShape) {
    if (sameShape(clouds, this.shape)) return;
    this.shape = copyShape(clouds);
    this.mesh.geometry.dispose();
    this.mesh.geometry = skyGeometry(clouds);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
