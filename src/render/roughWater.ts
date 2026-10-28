import * as THREE from 'three';
import type { WindZoneDef } from '../sim/map';
import { DEG } from '../sim/math';
import { zonesTuning } from '../sim/windZones';
import { zoneGeometry } from './calmWater';
import type { Ocean } from './ocean';
import { type ShoreTexture, shoreShader } from './shoreTexture';

/**
 * Rough water over a storm belt (decision 0167): darker slate-blue, choppy, with whitecap streaks
 * blown downwind and a sharp edge of broken foam you can steer along, so the belt reads from afar
 * like the doldrums' glass does (0144). Its colours are data, the zone kind's `water`, `waterLight`
 * and `foam` in `weather.json`, scaled by how bright the ocean is now so it still reads, darker,
 * at night. One mesh per zone whose kind has `rough`, built once at load and riding the waves,
 * like the calm water; hidden with Settings › Wind zones off. With Storms or Storm belt off it
 * keeps its look (the water is the belt's, the squalls are the weather's).
 */

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
  // A little higher than the calm water: the chop under it must never poke through, even on the
  // coarse ocean grid of Low quality.
  world.y += wave(world.xz) + 0.55;
  vWorld = world.xyz;
  vEdge = aEdge;
  vec4 mv = viewMatrix * world;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
${shoreShader}
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uLight;
uniform vec3 uFoam;
uniform vec3 uWater;
uniform vec3 uDayWater;
uniform vec2 uFlow;
uniform float uRough;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFade;
uniform float uEdge;
varying float vEdge;
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
  // Sim north is -z in the scene.
  vec2 p = vec2(vWorld.x, -vWorld.z);
  // Along the wind and across it: whitecaps are long streaks that run downwind.
  float along = dot(p, uFlow);
  float across = dot(p, vec2(uFlow.y, -uFlow.x));
  float inside = smoothstep(uFade * 0.5, uFade * 0.5 + uEdge, vEdge);
  // The ocean's brightness now against the day's, so night darkens the belt with the sea.
  float lum = dot(uWater, vec3(0.299, 0.587, 0.114)) / max(0.05, dot(uDayWater, vec3(0.299, 0.587, 0.114)));
  float light = clamp(lum, 0.25, 1.1);
  // Slow dark and light patches of chop, then the streaks.
  float chop = noise(vec2(along * 0.035 - uTime * 0.25, across * 0.05));
  vec3 col = mix(uDeep, uLight, smoothstep(0.2, 0.8, chop) * 0.7);
  float caps = noise(vec2(along * 0.12 - uTime * 1.4, across * 1.3));
  caps *= noise(vec2(along * 0.03 - uTime * 0.35, across * 0.14) + 4.0);
  float whitecap = smoothstep(0.56, 0.68, caps) * uRough;
  // A thin line of broken foam just inside the outline: the edge to steer by.
  float rim = vEdge - uFade * 0.5;
  // Pieces of varied length and width, like the surf on a reef: two scales of noise.
  float n = noise(p * 0.21 + vec2(uTime * 0.25, 0.0)) * 0.6 + noise(p * 0.9 - vec2(0.0, uTime * 0.5)) * 0.4;
  float width = uEdge * (0.2 + 0.6 * noise(p * 0.07 + 9.0));
  float line = smoothstep(0.0, 1.0, rim) * (1.0 - smoothstep(width * 0.5, width, rim));
  float broken = smoothstep(0.42, 0.62, n);
  float foam = max(whitecap * inside, line * broken);
  col = mix(col, uFoam, foam * 0.9);
  // The foam keeps more of its brightness at night, so the edge still reads under the blue night.
  col *= mix(light, max(light, 0.6), foam);
  col = mix(col, uWater * 0.7, 0.18 * (1.0 - foam));
  float alpha = max(inside * 0.82, line * broken * 0.95) * shore;
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));
  alpha *= 1.0 - smoothstep(uFogNear, uFogFar, vFogDepth) * 0.6;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.95));
  #include <colorspace_fragment>
}
`;

/** The foam edge's own width (units). */
const EDGE = 6;

/** A zone kind's colour, or the default when it has none. */
const colour = (v: unknown, fallback: string) =>
  new THREE.Color(typeof v === 'string' ? v : fallback);

export class RoughWater {
  readonly root = new THREE.Group();
  private readonly materials: THREE.ShaderMaterial[] = [];

  constructor(zones: readonly WindZoneDef[], shore: ShoreTexture) {
    const tuning = zonesTuning();
    for (const z of zones) {
      const kind = tuning.kinds[z.kind] as Record<string, unknown> | undefined;
      const own = z.tune?.rough;
      const rough = typeof own === 'number' ? own : Number(kind?.rough ?? 0);
      if (!(rough > 0)) continue;
      const geometry = zoneGeometry(z, rough, tuning.fadeUnits);
      if (!geometry) continue;
      // Whitecaps run where the zone's wind blows to.
      const to = ((z.headingDeg ?? 90) + 180) * DEG;
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uShoreMap: { value: shore.texture },
          uShoreBounds: { value: shore.bounds },
          uDeep: { value: colour(kind?.water, '#2b5266') },
          uLight: { value: colour(kind?.waterLight, '#3e6a7c') },
          uFoam: { value: colour(kind?.foam, '#e6eef2') },
          uWater: { value: new THREE.Color() },
          uDayWater: { value: new THREE.Color() },
          uFlow: { value: new THREE.Vector2(Math.sin(to), Math.cos(to)) },
          uRough: { value: Math.min(1, rough) },
          uFogColor: { value: new THREE.Color() },
          uFogNear: { value: 120 },
          uFogFar: { value: 210 },
          uFade: { value: tuning.fadeUnits },
          uEdge: { value: EDGE },
        },
      });
      this.materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `rough:${z.id}`;
      // Over the water like the calm water, under currents, the wake and the wind streaks.
      mesh.renderOrder = 0.4;
      this.root.add(mesh);
    }
  }

  setShore(shore: ShoreTexture) {
    for (const m of this.materials) {
      m.uniforms.uShoreMap!.value = shore.texture;
      m.uniforms.uShoreBounds!.value = shore.bounds;
    }
  }

  /** Once a frame: the ocean's colour and fog and the clock; hidden with Wind zones off. */
  update(time: number, ocean: Ocean, visible: boolean) {
    this.root.visible = visible && this.root.children.length > 0;
    if (!this.root.visible) return;
    const from = ocean.mesh.material.uniforms;
    for (const m of this.materials) {
      const u = m.uniforms;
      u.uTime!.value = time;
      (u.uWater!.value as THREE.Color).copy(from.uWater!.value as THREE.Color);
      (u.uDayWater!.value as THREE.Color).copy(from.uDayWater!.value as THREE.Color);
      (u.uFogColor!.value as THREE.Color).copy(from.uFogColor!.value as THREE.Color);
      u.uFogNear!.value = from.uFogNear!.value;
      u.uFogFar!.value = from.uFogFar!.value;
    }
  }

  dispose() {
    for (const child of this.root.children) (child as THREE.Mesh).geometry.dispose();
    for (const m of this.materials) m.dispose();
  }
}
