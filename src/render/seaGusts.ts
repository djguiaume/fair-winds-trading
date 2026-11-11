import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { type Wind, windTo } from '../sim/wind';

/**
 * Gusts on the sea (issue #498, decision 0295): cat's paws, soft darker ruffled patches that run
 * downwind with calmer, slightly lighter slicks between them. Colour only, inside the art
 * director's limits: a few percent off the water's own colour, never white, never under the sea's
 * night floor, and weaker at night. Drawn by the ocean's fragment shader (`oceanShader.ts`) on the
 * levels with `graphics.json › quality.*.gusts`, with the waves on; numbers in `waves.json › gusts`.
 */

/** The uniforms of a sea with gusts, before the first `SeaGusts.write`. */
export const gustUniforms = () => ({
  /** Downwind (scene x, z), and one over a patch's length and width. */
  uGustWind: { value: new THREE.Vector4(0, -1, 1, 1) },
  /** The point the patches turn about (scene x, z), and their drift in their own frame. */
  uGustAt: { value: new THREE.Vector4() },
  /** Strength now (wind, night), the patch's darkening, the slick's lightening, the ruffle. */
  uGustLook: { value: new THREE.Vector4() },
  /** The noise levels a patch fades in between, and the sky's and the mirror's share inside one. */
  uGustEdge: { value: new THREE.Vector4(0, 1, 1, 1) },
  /** The darkest a patch may make the water: the sea's night floor. */
  uGustFloor: { value: new THREE.Color(0, 0, 0) },
});

export type GustUniforms = { [K in keyof ReturnType<typeof gustUniforms>]: { value: unknown } };

/** How much of the gusts a wind of `speedKn` shows: none in a flat calm, all from `wind[1]`. */
export function gustStrength(speedKn: number, day: number): number {
  const { wind, night } = TUNING.waves.gusts;
  const [from, full] = wind as [number, number];
  const t = Math.min(1, Math.max(0, (speedKn - from) / Math.max(1e-6, full - from)));
  return t * t * (3 - 2 * t) * (night + (1 - night) * Math.min(1, Math.max(0, day)));
}

/**
 * Top level, after `foamNoise` (`seaFoam.ts`): `gustAt`, 0 on a slick to 1 inside a patch. The
 * patches live in the wind's own frame (along, across), which turns about the camera's spot, so a
 * wind shift swings them round the boat instead of sweeping them across the sea.
 */
export const gustFunctions = /* glsl */ `
uniform vec4 uGustWind;
uniform vec4 uGustAt;
uniform vec4 uGustLook;
uniform vec4 uGustEdge;
uniform vec3 uGustFloor;
float gustAt(vec2 xz, float fine) {
  vec2 r = xz - uGustAt.xy;
  vec2 q = vec2(dot(r, uGustWind.xy), dot(r, vec2(-uGustWind.y, uGustWind.x))) + uGustAt.zw;
  q *= uGustWind.zw;
  float n = 0.62 * foamNoise(q) + 0.3 * foamNoise(q * 2.3 + 7.1) + 0.08 * fine;
  return smoothstep(uGustEdge.x, uGustEdge.y, n);
}
`;

/**
 * In `main`, on the water's own colour before the foam and the light: reads `col`, `vWorld`,
 * `near` (the fine detail's fade toward the horizon) and `shelter` (0 in a closed harbour); writes
 * `col` and leaves `gust`, how much of a patch stands here, for the reflections.
 */
export const gustShader = /* glsl */ `
  float gustFine = foamNoise(vWorld.xz * 1.7 + uTime * vec2(2.1, -1.3));
  float gustOn = uGustLook.x * shelter;
  float gustPatch = gustAt(vWorld.xz, gustFine);
  float gustTone = mix(uGustLook.z, uGustLook.w * (2.0 * gustFine - 1.0) * near - uGustLook.y, gustPatch);
  // Never under the sea's night floor (moonlit blue), unless the water already is.
  col = max(col * (1.0 + gustOn * gustTone), min(col, uGustFloor));
  float gust = gustOn * gustPatch;
`;

/**
 * The gusts' place and strength for the ocean's shader, frame by frame. The drift is summed from
 * the world's clock, so a pause holds the patches still; nothing here touches the sailing.
 */
export class SeaGusts {
  private time = Number.NaN;
  private readonly pivot = new THREE.Vector2();
  private readonly drift = new THREE.Vector2();

  /**
   * `centre` is the camera's spot on the sea (scene space), `day` the light's share (1 by day, 0 at
   * night), `floor` the sea's darkest water; `on` false (a `?off=gusts` device test) draws none.
   */
  write(
    uniforms: GustUniforms,
    wind: Pick<Wind, 'from' | 'speedKn'>,
    time: number,
    centre: { x: number; z: number },
    day: number,
    floor: THREE.Color,
    on = true,
  ): void {
    const g = TUNING.waves.gusts;
    const to = windTo(wind as Wind);
    const wx = Math.sin(to);
    const wz = -Math.cos(to);
    this.advance(time, centre, wx, wz, wind.speedKn * g.speedPerKn);
    (uniforms.uGustWind.value as THREE.Vector4).set(wx, wz, 1 / g.length, 1 / g.width);
    const { pivot, drift } = this;
    (uniforms.uGustAt.value as THREE.Vector4).set(pivot.x, pivot.y, drift.x, drift.y);
    const strength = on ? gustStrength(wind.speedKn, day) : 0;
    (uniforms.uGustLook.value as THREE.Vector4).set(strength, g.darken, g.slick, g.ruffle);
    const [from, full] = g.cover as [number, number];
    (uniforms.uGustEdge.value as THREE.Vector4).set(from, full, g.reflect, g.mirror);
    (uniforms.uGustFloor.value as THREE.Color).copy(floor);
  }

  /**
   * Move the pivot to `centre` without moving the patches, then let them run downwind for the time
   * that passed. A jump in time (a load, a review's clock) only places them elsewhere.
   */
  private advance(
    time: number,
    centre: { x: number; z: number },
    wx: number,
    wz: number,
    speed: number,
  ) {
    const dx = centre.x - this.pivot.x;
    const dz = centre.z - this.pivot.y;
    this.drift.x += dx * wx + dz * wz;
    this.drift.y += dz * wx - dx * wz;
    this.pivot.set(centre.x, centre.z);
    const dt = Number.isNaN(this.time) ? 0 : Math.min(1, Math.max(0, time - this.time));
    this.time = time;
    this.drift.x -= speed * dt;
  }
}
