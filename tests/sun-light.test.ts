import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import type { SkyFrame } from '../src/render/atmosphere';
import { glitterUniforms, writeGlitter } from '../src/render/seaGlitter';
import { sunGlow, sunLowness } from '../src/render/sunHaze';

const sky = (y: number, night = 0, gloom = 0) =>
  ({ disc: new THREE.Vector3(0, y, -1).normalize(), night, gloom }) as unknown as SkyFrame;
const blank = () => ({ strength: 0, width: 0, band: 0, bandWidth: 0 });

describe('sunlight on the sea and in the air (issue #550)', () => {
  it('gives the haze the drawn sky’s own glow, the warm band only for a low sun', () => {
    const sun = TUNING.graphics.sky.sun;
    const low = sunGlow(sky(0.01), blank());
    expect(low.strength).toBeCloseTo(sun.glow);
    expect(low.band).toBeGreaterThan(0);
    expect(sunGlow(sky(1), blank()).band).toBe(0);
    expect(sunLowness(sky(1))).toBe(0);
    // A storm hides most of it; at night the moon's glow.
    expect(sunGlow(sky(0.5, 0, 1), blank()).strength).toBeCloseTo(sun.glow * 0.2);
    expect(sunGlow(sky(0.5, 1), blank()).strength).toBeCloseTo(sun.moonGlow);
  });

  it('draws the glitter path only with the reflections on and the sun up', () => {
    const u = glitterUniforms();
    const strength = TUNING.graphics.water.glitter.strength;
    writeGlitter(u, true, 1, 0);
    expect(u.uGlitter.value.x).toBeCloseTo(strength);
    writeGlitter(u, true, 0, 0);
    expect(u.uGlitter.value.x).toBe(0);
    writeGlitter(u, false, 1, 0);
    expect(u.uGlitter.value.x).toBe(0);
  });

  it('brightens the path under the moon', () => {
    const u = glitterUniforms();
    const g = TUNING.graphics.water.glitter;
    writeGlitter(u, true, 1, 1);
    expect(u.uGlitter.value.x).toBeCloseTo(g.strength * g.moon);
  });
});
