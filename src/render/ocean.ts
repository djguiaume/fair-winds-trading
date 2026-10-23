import * as THREE from 'three';
import type { IslandDef, TerrainDef } from '../sim/map';
import { islandPoint } from '../sim/islandLayout';
import { designOf } from '../data/islands';
import { PALETTE } from './palette';

/** Baked shoreline distance: constant shader cost as authored coast complexity grows. */
const shoreShader = /* glsl */ `
uniform sampler2D uShoreMap;
uniform vec4 uShoreBounds;
float shoreDistance(vec2 p) {
  vec2 uv = (p-uShoreBounds.xy)/uShoreBounds.zw;
  if (any(lessThan(uv,vec2(0.0))) || any(greaterThan(uv,vec2(1.0)))) return 64.0;
  return texture2D(uShoreMap,uv).r*64.0;
}
`;

/** Read current file contents: islandCoasts' simulation cache does not track live file edits. */
function currentCoasts(island: IslandDef) {
  return designOf(island)?.coasts.map((coast) =>
    coast.map(([x, z]): [number, number] => {
      const p = islandPoint(island, x, z);
      return [p.x, p.y];
    }),
  );
}

export type ShoreTexture = ReturnType<typeof shoreTexture>;

/** One map/view owns one bake; quality changes borrow it. No per-frame work or global GPU cache. */
export class ShoreTextureCache {
  private key?: string;
  private shore?: ShoreTexture;

  get(islands: readonly IslandDef[], terrain: readonly TerrainDef[] = []): ShoreTexture {
    // Compare effective shoreline contents, not array identity or fixed island ids. This is only
    // called when rebuilding water (quality change/editor refresh), never from the frame loop.
    const key = JSON.stringify([
      islands.map((i) => currentCoasts(i) ?? [i.x, i.y, i.radius]),
      terrain.map((t) => t.outline),
    ]);
    if (!this.shore || this.key !== key) {
      const next = shoreTexture(islands, terrain);
      this.shore?.texture.dispose();
      this.shore = next;
      this.key = key;
    }
    return this.shore;
  }

  dispose(): void {
    this.shore?.texture.dispose();
    this.shore = undefined;
    this.key = undefined;
  }
}

export function shoreTexture(islands: readonly IslandDef[], terrain: readonly TerrainDef[]) {
  const edges: [number, number, number, number][] = [];
  const circles: IslandDef[] = [];
  const add = (outline: [number, number][]) =>
    outline.forEach((a, i) => {
      const b = outline[(i + 1) % outline.length]!;
      edges.push([a[0], -a[1], b[0], -b[1]]);
    });
  for (const island of islands) {
    const coasts = currentCoasts(island);
    if (coasts) coasts.forEach(add);
    else circles.push(island);
  }
  terrain.forEach((t) => add(t.outline));
  const points = edges.flatMap(([x, z, u, v]) => [
    [x, z],
    [u, v],
  ]);
  circles.forEach((i) =>
    points.push([i.x - i.radius, -i.y - i.radius], [i.x + i.radius, -i.y + i.radius]),
  );
  if (!points.length) points.push([-1, -1], [1, 1]);
  const x0 = Math.min(...points.map((p) => p[0]!)) - 24;
  const z0 = Math.min(...points.map((p) => p[1]!)) - 24;
  const w = Math.max(...points.map((p) => p[0]!)) + 24 - x0;
  const h = Math.max(...points.map((p) => p[1]!)) + 24 - z0;
  const size = 512;
  const distances = new Float32Array(size * size).fill(64);
  // Rasterize only a 20-unit band around each segment/circle, not every edge per texel.
  const band = (
    xmin: number,
    zmin: number,
    xmax: number,
    zmax: number,
    distance: (x: number, z: number) => number,
  ) => {
    const xa = Math.max(0, Math.floor(((xmin - 20 - x0) / w) * size)),
      xb = Math.min(size - 1, Math.ceil(((xmax + 20 - x0) / w) * size));
    const za = Math.max(0, Math.floor(((zmin - 20 - z0) / h) * size)),
      zb = Math.min(size - 1, Math.ceil(((zmax + 20 - z0) / h) * size));
    for (let j = za; j <= zb; j++)
      for (let i = xa; i <= xb; i++) {
        const k = j * size + i;
        distances[k] = Math.min(
          distances[k]!,
          distance(x0 + ((i + 0.5) / size) * w, z0 + ((j + 0.5) / size) * h),
        );
      }
  };
  for (const [x, z, u, v] of edges)
    band(Math.min(x, u), Math.min(z, v), Math.max(x, u), Math.max(z, v), (px, pz) => {
      const dx = u - x,
        dz = v - z;
      const t = Math.max(
        0,
        Math.min(1, ((px - x) * dx + (pz - z) * dz) / (dx * dx + dz * dz || 1)),
      );
      return Math.hypot(px - x - t * dx, pz - z - t * dz);
    });
  for (const c of circles)
    band(c.x - c.radius, -c.y - c.radius, c.x + c.radius, -c.y + c.radius, (x, z) =>
      Math.abs(Math.hypot(x - c.x, z + c.y) - c.radius),
    );
  const bytes = new Uint8Array(size * size * 4);
  distances.forEach((d, i) => {
    bytes[i * 4] = Math.round((d / 64) * 255);
    bytes[i * 4 + 3] = 255;
  });
  const texture = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, bounds: new THREE.Vector4(x0, z0, w, h) };
}

const vertexShader = /* glsl */ `
uniform float uTime;
#ifdef VERTEX_SHORES
${shoreShader}
varying float vShoreDistance;
#endif
varying vec3 vWorld;
varying float vHeight;
varying float vFogDepth;

float wave(vec2 p) {
  return sin(dot(p, vec2(0.12, 0.07)) + uTime * 1.1) * 0.32
       + sin(dot(p, vec2(-0.05, 0.15)) + uTime * 0.8) * 0.24
       + sin(dot(p, vec2(0.21, -0.17)) + uTime * 1.7) * 0.12;
}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float h = wave(world.xz);
  world.y += h;
  vWorld = world.xyz;
#ifdef VERTEX_SHORES
  vShoreDistance = shoreDistance(world.xz);
#endif
  vHeight = h;
  vec4 mv = viewMatrix * world;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
#ifndef VERTEX_SHORES
${shoreShader}
#endif
#ifdef VERTEX_SHORES
varying float vShoreDistance;
#endif
uniform vec3 uSunDir;
uniform vec3 uWater;
uniform vec3 uWaterLight;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vWorld;
varying float vHeight;
varying float vFogDepth;

void main() {
  // Flat shading: one normal per triangle from screen-space derivatives.
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;
  float light = 0.62 + 0.5 * max(dot(n, uSunDir), 0.0);

  vec3 col = mix(uWater, uWaterLight, smoothstep(-0.35, 0.45, vHeight));

  // Distance to the nearest beach: shallow tint and a moving foam line.
#ifdef VERTEX_SHORES
  float d = vShoreDistance;
#else
  float d = shoreDistance(vWorld.xz);
#endif
  col = mix(col, uShallow, (1.0 - smoothstep(0.0, 14.0, d)) * 0.85);
#ifdef FANCY
  float ripple = sin(vWorld.x * 0.45 + uTime * 1.3) * sin(vWorld.z * 0.5 - uTime * 1.7);
#endif
#ifdef FANCY
  float foam = 1.0 - smoothstep(0.8, 2.6, d + 0.7 * ripple + 0.6 * sin(uTime * 1.4 + d * 0.6));
#else
  float foam = 1.0 - smoothstep(0.8, 2.6, d);
#endif
  col = mix(col, uFoam, foam * 0.8);

  col *= light;
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
 * Stylized low-poly ocean: a grid that follows the camera, vertex waves, flat shading, a shallow
 * tint and foam around islands. Cheap on purpose (no reflections) for old tablets.
 */
export class Ocean {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private cell: number;
  private readonly ownsShore: boolean;
  private readonly ownsMaterial: boolean;
  private disposed = false;

  constructor(
    islands: readonly IslandDef[],
    segments: number,
    fancy: boolean,
    size = 420,
    terrain: readonly TerrainDef[] = [],
    borrowedShore?: ShoreTexture,
    borrowedMaterial?: THREE.ShaderMaterial,
  ) {
    this.cell = size / segments;
    const shore = borrowedShore ?? shoreTexture(islands, terrain);
    this.ownsShore = !borrowedShore;
    this.ownsMaterial = !borrowedMaterial;
    const material =
      borrowedMaterial ??
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        defines: fancy ? { FANCY: '' } : { VERTEX_SHORES: '' },
        uniforms: {
          uTime: { value: 0 },
          uShoreMap: { value: shore.texture },
          uShoreBounds: { value: shore.bounds },
          uSunDir: { value: new THREE.Vector3(-0.45, 0.8, 0.35).normalize() },
          uWater: { value: new THREE.Color(PALETTE.water) },
          uWaterLight: { value: new THREE.Color(PALETTE.waterLight) },
          uShallow: { value: new THREE.Color(PALETTE.shallow) },
          uFoam: { value: new THREE.Color(PALETTE.foam) },
          uFogColor: { value: new THREE.Color(PALETTE.deepWater) },
          uFogNear: { value: 120 },
          uFogFar: { value: 210 },
        },
      });
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

  setFog(near: number, far: number): void {
    this.mesh.material.uniforms.uFogNear!.value = near;
    this.mesh.material.uniforms.uFogFar!.value = far;
  }

  /** Water and fog colours, for weather and time of day (decisions 0067, 0068). */
  setColors(
    water: THREE.Color,
    waterLight: THREE.Color,
    fog: THREE.Color,
    shallow: THREE.Color,
    foam: THREE.Color,
  ): void {
    const u = this.mesh.material.uniforms;
    (u.uShallow!.value as THREE.Color).copy(shallow);
    (u.uFoam!.value as THREE.Color).copy(foam);
    (u.uWater!.value as THREE.Color).copy(water);
    (u.uWaterLight!.value as THREE.Color).copy(waterLight);
    (u.uFogColor!.value as THREE.Color).copy(fog);
  }

  /** Direction the light comes from (scene space, normalized), for the flat shading. */
  setSunDirection(dir: THREE.Vector3): void {
    (this.mesh.material.uniforms.uSunDir!.value as THREE.Vector3).copy(dir);
  }

  /** Keep the grid centered on the camera target, snapped to whole cells so waves don't swim. */
  update(time: number, center: THREE.Vector3): void {
    this.mesh.material.uniforms.uTime!.value = time;
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
