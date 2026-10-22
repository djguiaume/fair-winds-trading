import * as THREE from 'three';
import type { IslandDef, TerrainDef } from '../sim/map';
import { PALETTE } from './palette';

const MAX_ISLANDS = 12;
const MAX_COAST_EDGES = 64;

const shoreShader = /* glsl */ `
uniform vec3 uIslands[${MAX_ISLANDS}];
uniform int uIslandCount;
uniform vec4 uCoastEdges[${MAX_COAST_EDGES}];
uniform int uCoastEdgeCount;
float shoreDistance(vec2 p) {
  float d = 1e5;
  for (int i = 0; i < ${MAX_ISLANDS}; i++) {
    if (i >= uIslandCount) break;
    d = min(d, length(p - uIslands[i].xy) - uIslands[i].z);
  }
  for (int i = 0; i < ${MAX_COAST_EDGES}; i++) {
    if (i >= uCoastEdgeCount) break;
    vec2 a = uCoastEdges[i].xy;
    vec2 b = uCoastEdges[i].zw;
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.001), 0.0, 1.0);
    d = min(d, length(p - (a + ab * t)));
  }
  return d;
}
`;

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

  constructor(
    islands: readonly IslandDef[],
    segments: number,
    fancy: boolean,
    size = 420,
    terrain: readonly TerrainDef[] = [],
  ) {
    this.cell = size / segments;
    const islandUniform = Array.from({ length: MAX_ISLANDS }, (_, i) => {
      const isl = islands[i];
      // Sim y (north) is three.js -z.
      return isl ? new THREE.Vector3(isl.x, -isl.y, isl.radius) : new THREE.Vector3();
    });
    const edges = terrain.flatMap(({ outline }) =>
      outline.map((a, i) => {
        const b = outline[(i + 1) % outline.length]!;
        return new THREE.Vector4(a[0], -a[1], b[0], -b[1]);
      }),
    );
    if (edges.length > MAX_COAST_EDGES) throw new Error('Map exceeds ocean coastline budget');
    const edgeUniform = Array.from(
      { length: MAX_COAST_EDGES },
      (_, i) => edges[i] ?? new THREE.Vector4(),
    );
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      defines: fancy ? { FANCY: '' } : { VERTEX_SHORES: '' },
      uniforms: {
        uTime: { value: 0 },
        uCoastEdges: { value: edgeUniform },
        uCoastEdgeCount: { value: edges.length },
        uIslands: { value: islandUniform },
        uIslandCount: { value: Math.min(islands.length, MAX_ISLANDS) },
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

  setFog(near: number, far: number): void {
    this.mesh.material.uniforms.uFogNear!.value = near;
    this.mesh.material.uniforms.uFogFar!.value = far;
  }

  /** Water and fog colours, for weather and time of day (decisions 0066, 0067). */
  setColors(water: THREE.Color, waterLight: THREE.Color, fog: THREE.Color): void {
    const u = this.mesh.material.uniforms;
    (u.uWater!.value as THREE.Color).copy(water);
    (u.uWaterLight!.value as THREE.Color).copy(waterLight);
    (u.uFogColor!.value as THREE.Color).copy(fog);
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
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
