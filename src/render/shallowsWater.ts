import * as THREE from 'three';
import { coastDistance } from '../sim/coast';
import type { TerrainDef } from '../sim/map';
import type { Ocean } from './ocean';

/**
 * Sandy passages at sea (decision 0152): pale turquoise water over a sand floor with faint
 * ripples, soft at the edges, no surf and no outline. One small grid mesh per passage riding the
 * same waves as the ocean (like the currents' water), built once at load.
 */

/** Grid spacing (units): fine enough that the waves never poke through. */
const CELL = 4;
/** The tint fades in over this many units from the passage's edge. */
const EDGE_FADE = 9;

const vertexShader = /* glsl */ `
uniform float uTime;
attribute float aEdge;
varying float vEdge;
varying vec3 vWorld;
varying float vFogDepth;

float wave(vec2 p) {
  return sin(dot(p, vec2(0.12, 0.07)) + uTime * 1.1) * 0.32
       + sin(dot(p, vec2(-0.05, 0.15)) + uTime * 0.8) * 0.24
       + sin(dot(p, vec2(0.21, -0.17)) + uTime * 1.7) * 0.12;
}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  world.y += wave(world.xz) + 0.12;
  vWorld = world.xyz;
  vEdge = aEdge;
  vec4 mv = viewMatrix * world;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uWaterLight;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uEdgeFade;
varying float vEdge;
varying vec3 vWorld;
varying float vFogDepth;

void main() {
  float body = smoothstep(0.0, uEdgeFade, vEdge);
  // Sand ripples seen through the water: soft bands across the passage.
  float ripple = 0.5 + 0.5 * sin(dot(vWorld.xz, vec2(0.55, 0.32)) + sin(vWorld.x * 0.11) * 1.6);
  vec3 sand = vec3(0.86, 0.9, 0.74);
  vec3 col = mix(uWaterLight * 1.15, sand, 0.42 + 0.12 * ripple * body);
  float alpha = body * 0.72;
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));
  alpha *= 1.0 - smoothstep(uFogNear, uFogFar, vFogDepth) * 0.6;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

function passageGeometry(outline: TerrainDef['outline']): THREE.BufferGeometry | null {
  const xs = outline.map((p) => p[0]),
    ys = outline.map((p) => p[1]);
  const x0 = Math.min(...xs) - CELL,
    y0 = Math.min(...ys) - CELL;
  const cols = Math.ceil((Math.max(...xs) + CELL - x0) / CELL) + 1;
  const rows = Math.ceil((Math.max(...ys) + CELL - y0) / CELL) + 1;
  const position: number[] = [],
    edge: number[] = [],
    inside: boolean[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = x0 + i * CELL,
        y = y0 + j * CELL;
      const d = coastDistance(x, y, outline).distance;
      position.push(x, 0, -y);
      edge.push(Math.max(0, -d));
      inside.push(d < 0);
    }
  const index: number[] = [];
  for (let j = 0; j + 1 < rows; j++)
    for (let i = 0; i + 1 < cols; i++) {
      const a = j * cols + i,
        b = a + 1,
        c = a + cols,
        d = c + 1;
      if (!(inside[a] || inside[b] || inside[c] || inside[d])) continue;
      index.push(a, b, c, b, d, c);
    }
  if (!index.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  g.boundingSphere!.radius += 2;
  return g;
}

export class ShallowsWater {
  readonly root = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;

  constructor(terrain: readonly TerrainDef[] = []) {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uWaterLight: { value: new THREE.Color() },
        uFogColor: { value: new THREE.Color() },
        uFogNear: { value: 120 },
        uFogFar: { value: 210 },
        uEdgeFade: { value: EDGE_FADE },
      },
    });
    for (const t of terrain) {
      if (t.kind !== 'shallows') continue;
      const geometry = passageGeometry(t.outline);
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.name = `shallows:${t.id}`;
      mesh.renderOrder = 0.5;
      this.root.add(mesh);
    }
    this.root.visible = this.root.children.length > 0;
  }

  /** Once a frame: the ocean's light colour, fog and clock. */
  update(time: number, ocean: Ocean) {
    if (!this.root.children.length) return;
    const from = ocean.mesh.material.uniforms;
    const u = this.material.uniforms;
    u.uTime!.value = time;
    (u.uWaterLight!.value as THREE.Color).copy(from.uWaterLight!.value as THREE.Color);
    (u.uFogColor!.value as THREE.Color).copy(from.uFogColor!.value as THREE.Color);
    u.uFogNear!.value = from.uFogNear!.value;
    u.uFogFar!.value = from.uFogFar!.value;
  }

  dispose() {
    for (const child of this.root.children) (child as THREE.Mesh).geometry.dispose();
    this.material.dispose();
  }
}
