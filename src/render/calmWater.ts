import * as THREE from 'three';
import { insetOutline } from '../sim/coast';
import { smoothOutline } from '../sim/flowShapes';
import type { WindZoneDef } from '../sim/map';
import { zonesTuning } from '../sim/windZones';
import { type Ocean, type ShoreTexture, shoreShader } from './ocean';

/**
 * Calm water in wind zones (decision 0144): the doldrums, and a little a sheltered lagoon, look
 * glassy, a paler, smoother sheet with slow faint swells instead of the open sea's chop, fading
 * in across the zone's edge like its wind. Only visuals, like the currents' water (0140): one mesh
 * per zone whose kind has `glassy` in `weather.json`, built once at load and riding the ocean's
 * waves; three.js skips the ones out of view, so a frame costs a few copied uniforms.
 */

const vertexShader = /* glsl */ `
uniform float uTime;
attribute float aEdge;
attribute float aGlassy;
varying float vEdge;
varying float vGlassy;
varying vec3 vWorld;
varying float vFogDepth;

float wave(vec2 p) {
  return sin(dot(p, vec2(0.12, 0.07)) + uTime * 1.1) * 0.32
       + sin(dot(p, vec2(-0.05, 0.15)) + uTime * 0.8) * 0.24
       + sin(dot(p, vec2(0.21, -0.17)) + uTime * 1.7) * 0.12;
}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  // Just above the water, on the same waves as the ocean.
  world.y += wave(world.xz) + 0.12;
  vWorld = world.xyz;
  vEdge = aEdge;
  vGlassy = aGlassy;
  vec4 mv = viewMatrix * world;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
${shoreShader}
uniform float uTime;
uniform vec3 uWater;
uniform vec3 uWaterLight;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFade;
varying float vEdge;
varying float vGlassy;
varying vec3 vWorld;
varying float vFogDepth;

void main() {
  float shore = smoothstep(1.5, 6.0, shoreDistance(vWorld.xz));
  float body = smoothstep(0.0, uFade, vEdge) * shore * vGlassy;
  // A smooth, pale sheet that hides the flat-shaded chop, with long slow swells of sheen.
  float swell = 0.5 + 0.5 * sin(dot(vWorld.xz, vec2(0.031, 0.019)) + uTime * 0.25)
                    * sin(dot(vWorld.xz, vec2(-0.013, 0.027)) - uTime * 0.18);
  vec3 col = mix(uWaterLight, mix(uWater, uWaterLight, 0.7) * 1.18, swell);
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));
  float alpha = body * (0.62 + 0.12 * swell);
  alpha *= 1.0 - smoothstep(uFogNear, uFogFar, vFogDepth) * 0.6;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

/** The zone's sheet: a fade ring from the outline in to `fade`, then the inset filled. */
function zoneGeometry(zone: WindZoneDef, glassy: number, fade: number) {
  if (zone.outline.length < 3) return null;
  // The fade straddles the outline like the wind's: half outside, half inside.
  const outer = insetOutline(smoothOutline(zone.outline), -fade / 2);
  const inner = insetOutline(outer, fade);
  if (inner.length < 3) return null;
  const position: number[] = [],
    edge: number[] = [],
    glass: number[] = [];
  const add = ([x, y]: [number, number], e: number) => {
    position.push(x, 0, -y);
    edge.push(e);
    glass.push(glassy);
  };
  outer.forEach((p) => add(p, 0));
  inner.forEach((p) => add(p, fade));
  const n = outer.length;
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    index.push(i, n + i, j, j, n + i, n + j);
  }
  const vectors = inner.map(([x, y]) => new THREE.Vector2(x, y));
  for (const [p, q, r] of THREE.ShapeUtils.triangulateShape(vectors, []))
    index.push(n + p!, n + q!, n + r!);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setAttribute('aGlassy', new THREE.Float32BufferAttribute(glass, 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  g.boundingSphere!.radius += 2;
  return g;
}

export class CalmWater {
  readonly root = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;

  constructor(zones: readonly WindZoneDef[], shore: ShoreTexture) {
    const tuning = zonesTuning();
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uShoreMap: { value: shore.texture },
        uShoreBounds: { value: shore.bounds },
        uWater: { value: new THREE.Color() },
        uWaterLight: { value: new THREE.Color() },
        uFogColor: { value: new THREE.Color() },
        uFogNear: { value: 120 },
        uFogFar: { value: 210 },
        uFade: { value: tuning.fadeUnits },
      },
    });
    for (const z of zones) {
      const kind = tuning.kinds[z.kind];
      const own = z.tune?.glassy;
      const glassy = typeof own === 'number' ? own : (kind?.glassy ?? 0);
      if (glassy <= 0) continue;
      const geometry = zoneGeometry(z, glassy, tuning.fadeUnits);
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.name = `calm:${z.id}`;
      // Over the water, under currents, the wake and the wind streaks.
      mesh.renderOrder = 0.4;
      this.root.add(mesh);
    }
  }

  setShore(shore: ShoreTexture) {
    this.material.uniforms.uShoreMap!.value = shore.texture;
    this.material.uniforms.uShoreBounds!.value = shore.bounds;
  }

  /** Once a frame: the ocean's colours and fog and the clock; hidden with Wind zones off. */
  update(time: number, ocean: Ocean, visible: boolean) {
    this.root.visible = visible && this.root.children.length > 0;
    if (!this.root.visible) return;
    const from = ocean.mesh.material.uniforms;
    const u = this.material.uniforms;
    u.uTime!.value = time;
    (u.uWater!.value as THREE.Color).copy(from.uWater!.value as THREE.Color);
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
