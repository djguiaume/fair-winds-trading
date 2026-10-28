import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { knotToUnits } from '../sim/boat';
import { insetOutline } from '../sim/coast';
import { laneShape } from '../sim/currents';
import { smoothOutline } from '../sim/flowShapes';
import type { CurrentDef } from '../sim/map';
import type { Ocean } from './ocean';
import { type ShoreTexture, shoreShader } from './shoreTexture';

/**
 * Currents at sea (decision 0140): only visuals. Each current is darker, bluer water with soft
 * edges (no outline, dash or arrow), fading near shores, with lighter wave crests across it,
 * bowed downstream, that drift slowly with the flow. One mesh per current, built once at load and
 * riding the same waves as the ocean; three.js skips the ones out of view, and the crests move in
 * the shader, so a frame costs only the few uniforms copied from the ocean.
 */

/** Gap between crests along the flow (units), as in the editor and on the chart. */
const CREST_GAP = 34;
/** The crests drift at this share of the water's speed: they read as moving without racing. */
const DRIFT_SHARE = 0.5;
/** Width of an area current's crest columns (units). */
const AREA_COLUMN = 48;

const vertexShader = /* glsl */ `
uniform float uTime;
attribute vec2 aFlow;
attribute float aEdge;
attribute float aEnds;
attribute float aDrift;
attribute float aHalf;
varying vec2 vFlow;
varying float vEdge;
varying float vEnds;
varying float vHalf;
varying vec3 vWorld;
varying float vFogDepth;

float wave(vec2 p) {
  return sin(dot(p, vec2(0.12, 0.07)) + uTime * 1.1) * 0.32
       + sin(dot(p, vec2(-0.05, 0.15)) + uTime * 0.8) * 0.24
       + sin(dot(p, vec2(0.21, -0.17)) + uTime * 1.7) * 0.12;
}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  // Just above the water: the same waves as the ocean, lifted past the grid's chord error.
  world.y += wave(world.xz) + 0.14;
  vWorld = world.xyz;
  vFlow = vec2(aFlow.x - uTime * aDrift, aFlow.y);
  vEdge = aEdge;
  vEnds = aEnds;
  vHalf = aHalf;
  vec4 mv = viewMatrix * world;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
${shoreShader}
uniform vec3 uWater;
uniform vec3 uWaterLight;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uEdgeFade;
uniform float uCoastFade;
uniform float uGap;
varying vec2 vFlow;
varying float vEdge;
varying float vEnds;
varying float vHalf;
varying vec3 vWorld;
varying float vFogDepth;

void main() {
  float shore = smoothstep(2.0, uCoastFade, shoreDistance(vWorld.xz));
  float body = smoothstep(0.0, uEdgeFade, vEdge) * vEnds * shore;
  // Across the crest from -1 to 1: a lane's own width, or an area's staggered columns.
  float across;
  float along = vFlow.x;
  float hw;
  if (vHalf > 0.0) {
    across = vFlow.y;
    hw = vHalf;
  } else {
    float column = floor(vFlow.y);
    across = fract(vFlow.y) * 2.0 - 1.0;
    along += mod(column, 2.0) * uGap * 0.5;
    hw = -vHalf;
  }
  // Bowed downstream: the middle of each crest runs ahead of its ends.
  float s = along - hw * 0.32 * (1.0 - across * across);
  float stripe = fract(s / uGap) * uGap;
  float crest = smoothstep(0.0, 1.2, stripe) * (1.0 - smoothstep(1.2, 3.6, stripe));
  crest *= 1.0 - smoothstep(0.45, 0.65, abs(across));
  crest *= body;

  vec3 deep = uWater * vec3(0.42, 0.6, 0.96);
  vec3 col = mix(deep, uWaterLight * 1.22, crest);
  float alpha = max(body * 0.62, crest * 0.6);
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));
  alpha *= 1.0 - smoothstep(uFogNear, uFogFar, vFogDepth) * 0.6;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

/** Points of a lane, resampled no more than `step` apart, with distance along. */
function resample(points: readonly [number, number, number][], step: number) {
  const out: { x: number; y: number; w: number; s: number; tx: number; ty: number }[] = [];
  let s = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay, aw] = points[i - 1]!,
      [bx, by, bw] = points[i]!;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-6) continue;
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = out.length ? 1 : 0; k <= n; k++) {
      const t = k / n;
      out.push({
        x: ax + (bx - ax) * t,
        y: ay + (by - ay) * t,
        w: aw + (bw - aw) * t,
        s: s + len * t,
        tx: (bx - ax) / len,
        ty: (by - ay) / len,
      });
    }
    s += len;
  }
  return out;
}

const ACROSS = [-1, -0.5, 0, 0.5, 1];

function laneGeometry(current: CurrentDef): THREE.BufferGeometry | null {
  const lane = laneShape(current);
  if (!lane) return null;
  const tune = TUNING.weather.currents;
  const samples = resample(lane.points, 3);
  const total = samples[samples.length - 1]?.s ?? 0;
  const drift = current.speedKn * knotToUnits() * DRIFT_SHARE;
  const position: number[] = [],
    flow: number[] = [],
    edge: number[] = [],
    ends: number[] = [],
    drifts: number[] = [],
    halves: number[] = [];
  for (const p of samples) {
    const half = p.w / 2;
    const slow = Math.pow(lane.narrowest / p.w, tune.wideSlowdown);
    const fade = Math.min(1, p.s / tune.endFadeUnits, (total - p.s) / tune.endFadeUnits);
    // Wider, slacker water is a little lighter too.
    const shade = Math.max(0, fade) * (0.55 + 0.45 * slow);
    for (const v of ACROSS) {
      // Left of the flow is (-ty, tx); scene z is -y.
      const x = p.x - p.ty * half * v,
        y = p.y + p.tx * half * v;
      position.push(x, 0, -y);
      flow.push(p.s, v);
      edge.push((1 - Math.abs(v)) * half);
      ends.push(shade);
      drifts.push(drift);
      halves.push(half);
    }
  }
  const index: number[] = [];
  const cols = ACROSS.length;
  for (let i = 0; i + 1 < samples.length; i++)
    for (let k = 0; k + 1 < cols; k++) {
      const a = i * cols + k,
        b = a + 1,
        c = a + cols,
        d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  return build(position, flow, edge, ends, drifts, halves, index);
}

function areaGeometry(current: CurrentDef): THREE.BufferGeometry | null {
  if (!current.outline || current.outline.length < 3) return null;
  const tune = TUNING.weather.currents;
  const outer = smoothOutline(current.outline);
  const inner = insetOutline(outer, tune.edgeFadeUnits);
  const a = ((current.towardDeg ?? 0) * Math.PI) / 180;
  const tx = Math.sin(a),
    ty = Math.cos(a);
  const drift = current.speedKn * knotToUnits() * DRIFT_SHARE;
  const position: number[] = [],
    flow: number[] = [],
    edge: number[] = [],
    ends: number[] = [],
    drifts: number[] = [],
    halves: number[] = [];
  const add = ([x, y]: [number, number], e: number) => {
    position.push(x, 0, -y);
    flow.push(x * tx + y * ty, (x * ty - y * tx) / AREA_COLUMN);
    edge.push(e);
    ends.push(1);
    drifts.push(drift);
    halves.push(-13);
  };
  outer.forEach((p) => add(p, 0));
  inner.forEach((p) => add(p, tune.edgeFadeUnits));
  const n = outer.length;
  const index: number[] = [];
  // The fade ring between the outline and its inset, then the inset filled.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    index.push(i, n + i, j, j, n + i, n + j);
  }
  const vectors = inner.map(([x, y]) => new THREE.Vector2(x, y));
  for (const [p, q, r] of THREE.ShapeUtils.triangulateShape(vectors, []))
    index.push(n + p!, n + q!, n + r!);
  return build(position, flow, edge, ends, drifts, halves, index);
}

function build(
  position: number[],
  flow: number[],
  edge: number[],
  ends: number[],
  drift: number[],
  half: number[],
  index: number[],
) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setAttribute('aEnds', new THREE.Float32BufferAttribute(ends, 1));
  g.setAttribute('aDrift', new THREE.Float32BufferAttribute(drift, 1));
  g.setAttribute('aHalf', new THREE.Float32BufferAttribute(half, 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  // The waves lift it by up to a unit: a little room so culling never clips a visible edge.
  g.boundingSphere!.radius += 2;
  return g;
}

export class CurrentWater {
  readonly root = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;

  constructor(currents: readonly CurrentDef[], shore: ShoreTexture) {
    const tune = TUNING.weather.currents;
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
        uEdgeFade: { value: tune.edgeFadeUnits },
        uCoastFade: { value: Math.max(4, tune.coastFadeUnits * 0.75) },
        uGap: { value: CREST_GAP },
      },
    });
    for (const c of currents) {
      const geometry = c.path ? laneGeometry(c) : areaGeometry(c);
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.name = `current:${c.id}`;
      // Over the water, under the wake and the wind streaks.
      mesh.renderOrder = 0.5;
      this.root.add(mesh);
    }
  }

  /** A live map edit rebakes the shore; follow it. */
  setShore(shore: ShoreTexture) {
    this.material.uniforms.uShoreMap!.value = shore.texture;
    this.material.uniforms.uShoreBounds!.value = shore.bounds;
  }

  /** Once a frame: the ocean's colours and fog (day, night, weather) and the clock. */
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
