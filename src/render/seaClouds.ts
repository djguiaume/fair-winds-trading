import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { type Wind, windTo } from '../sim/wind';

/**
 * Cloud shadows on the sea (issue #546): soft darker patches, a few hundred units across, that
 * drift downwind so the open sea seen from above has sun, scale and movement. Colour only, in the
 * ocean's fragment shader (`oceanShader.ts`) on the levels that draw the moving foam (Medium and
 * up) with the waves on; none at night or under a full overcast, where no sun casts them. Numbers
 * in `waves.json › clouds`.
 */

/** The uniforms of a sea with cloud shadows, before the first `SeaClouds.write`. */
export const cloudUniforms = () => ({
  /** Where the field has drifted to (scene x, z), and one over a cloud's size. */
  uCloudAt: { value: new THREE.Vector3(0, 0, 1) },
  /** The noise levels a shadow fades in between, and how dark it is now (0 = none). */
  uCloudLook: { value: new THREE.Vector3(0, 1, 0) },
});

export type CloudUniforms = { [K in keyof ReturnType<typeof cloudUniforms>]: { value: unknown } };

/**
 * How dark the shadows are now: `day` is the light's share (1 by day, 0 at night), `gloom` the
 * sky's overcast (0 clear … 1 the darkest storm), which takes the sun and so the shadows away.
 */
export function cloudShade(day: number, gloom: number): number {
  const { shade, gloomGone } = TUNING.waves.clouds;
  const sun = Math.min(1, Math.max(0, day)) * Math.max(0, 1 - gloom / Math.max(1e-6, gloomGone));
  return shade * sun;
}

/** Top level, after `foamNoise` (`seaFoam.ts`): `cloudAt`, 0 in the sun to 1 under a cloud. */
export const cloudFunctions = /* glsl */ `
uniform vec3 uCloudAt;
uniform vec3 uCloudLook;
float cloudAt(vec2 xz) {
  vec2 q = (xz - uCloudAt.xy) * uCloudAt.z;
  float n = 0.67 * foamNoise(q) + 0.33 * foamNoise(q * 2.3 + 5.1);
  return smoothstep(uCloudLook.x, uCloudLook.y, n);
}
`;

/** In `main`, on the lit colour before the fog: reads and writes `col`. */
export const cloudShader = /* glsl */ `
  col *= 1.0 - uCloudLook.z * cloudAt(vWorld.xz);
`;

/**
 * The shadows' drift for the ocean's shader, frame by frame: summed from the world's clock, so a
 * pause holds them still and a jump in time (a load, a review's clock) only places them elsewhere.
 */
export class SeaClouds {
  private time = Number.NaN;
  private readonly drift = new THREE.Vector2();

  /** `on` false (a `?off=clouds` device test) draws none. */
  write(
    uniforms: CloudUniforms,
    wind: Pick<Wind, 'from' | 'speedKn'>,
    time: number,
    day: number,
    gloom: number,
    on = true,
  ): void {
    const c = TUNING.waves.clouds;
    const dt = Number.isNaN(this.time) ? 0 : Math.min(1, Math.max(0, time - this.time));
    this.time = time;
    const to = windTo(wind as Wind);
    const speed = (c.speed + wind.speedKn * c.speedPerKn) * dt;
    this.drift.x += Math.sin(to) * speed;
    this.drift.y -= Math.cos(to) * speed;
    (uniforms.uCloudAt.value as THREE.Vector3).set(this.drift.x, this.drift.y, 1 / c.size);
    const [from, full] = c.cover as [number, number];
    const shade = on ? cloudShade(day, gloom) : 0;
    (uniforms.uCloudLook.value as THREE.Vector3).set(from, full, shade);
  }
}
