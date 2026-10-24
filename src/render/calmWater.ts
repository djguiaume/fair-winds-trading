import * as THREE from 'three';
import { coastDistance } from '../sim/coast';
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
uniform float uStyle;
varying float vEdge;
varying float vGlassy;
varying vec3 vWorld;
varying float vFogDepth;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  float shore = smoothstep(1.5, 6.0, shoreDistance(vWorld.xz));
  float body = smoothstep(0.0, uFade, vEdge) * shore * vGlassy;
  vec2 p = vWorld.xz;
  vec3 col;
  float alpha;
  if (uStyle < 0.5) {
    // A: mirror. A bright, sky-pale sheet with long soft bands of reflected light.
    float band = 0.5 + 0.5 * sin(dot(p, vec2(0.022, 0.009)) + uTime * 0.12);
    vec3 sky = mix(uWaterLight, vec3(0.80, 0.93, 0.95), 0.3);
    col = mix(uWaterLight * 1.08, sky, band);
    alpha = body;
  } else if (uStyle < 1.5) {
    // B: cat's paws. Smooth still water, with darker ruffled patches where a puff touches it,
    // drifting slowly with the light air.
    vec3 still = mix(uWater, uWaterLight, 0.75) * 1.12;
    float n = noise(p * 0.045 + vec2(uTime * 0.05, uTime * 0.03));
    n += 0.5 * noise(p * 0.11 - vec2(uTime * 0.04, 0.0));
    float paw = smoothstep(0.9, 1.15, n);
    float ripple = smoothstep(0.6, 0.95, sin(p.x * 0.9 + p.y * 0.5 + uTime * 1.6 + n * 6.0));
    col = mix(still, mix(uWater * 0.95, uWaterLight * 1.1, ripple * 0.6), paw * 0.9);
    alpha = body;
  } else {
    // C: slick swell. Deep, still, darker water with long pale swell lines rolling through.
    vec3 deep = uWater * vec3(0.78, 0.9, 0.95);
    float s = sin(dot(p, vec2(0.06, 0.035)) - uTime * 0.35);
    float line = smoothstep(0.55, 0.95, s) * (1.0 - smoothstep(0.95, 1.0, s) * 0.5);
    col = mix(deep, uWaterLight * 1.2, line * 0.75);
    alpha = body;
  }
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));
  alpha = clamp(alpha * 1.25, 0.0, 0.9);
  alpha *= 1.0 - smoothstep(uFogNear, uFogFar, vFogDepth) * 0.6;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

/** Grid spacing of a zone's sheet (units): fine enough to ride the waves, as the currents do. */
const STEP = 3;

/**
 * The zone's sheet: a grid over the zone, each point knowing how far inside the fade it is. The
 * fade straddles the outline like the wind's: half outside, half inside. Squares wholly outside
 * are left out.
 */
function zoneGeometry(zone: WindZoneDef, glassy: number, fade: number) {
  if (zone.outline.length < 3) return null;
  const outline = smoothOutline(zone.outline);
  const xs = outline.map((p) => p[0]),
    ys = outline.map((p) => p[1]);
  const x0 = Math.min(...xs) - fade / 2,
    y0 = Math.min(...ys) - fade / 2;
  const nx = Math.ceil((Math.max(...xs) + fade / 2 - x0) / STEP) + 1,
    ny = Math.ceil((Math.max(...ys) + fade / 2 - y0) / STEP) + 1;
  const position: number[] = [],
    edge: number[] = [],
    glass: number[] = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * STEP,
        y = y0 + j * STEP;
      const d = coastDistance(x, y, outline).distance;
      position.push(x, 0, -y);
      edge.push(Math.min(fade, Math.max(0, fade / 2 - d)));
      glass.push(glassy);
    }
  const index: number[] = [];
  for (let j = 0; j + 1 < ny; j++)
    for (let i = 0; i + 1 < nx; i++) {
      const a = j * nx + i,
        b = a + 1,
        c = a + nx,
        d = c + 1;
      if (!edge[a] && !edge[b] && !edge[c] && !edge[d]) continue;
      index.push(a, b, c, b, d, c);
    }
  if (!index.length) return null;
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
        uStyle: { value: 0 },
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
