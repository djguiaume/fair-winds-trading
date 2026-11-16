import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { bakeContact, matchContact } from '../src/render/models/contactShade';
import {
  blobOffset,
  deepenShade,
  shadowCentre,
  shadowSettings,
  snapToTexels,
} from '../src/render/sunShadows';

const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

describe('sun shadows (issue #550)', () => {
  it('moves the box toward the sea on screen, never past its limit', () => {
    const { lead, maxLead } = TUNING.graphics.shadows;
    const target = new THREE.Vector3(10, 0, 20);
    const near = shadowCentre(new THREE.Vector3(), target, new THREE.Vector3(12, 0, 20), 80);
    expect(near.x).toBeCloseTo(10 + 2 * lead);
    const far = shadowCentre(new THREE.Vector3(), target, new THREE.Vector3(10, 0, 1020), 80);
    expect(far.distanceTo(target)).toBeCloseTo(80 * maxLead);
  });

  it('keeps sunny level ground as bright while the shade deepens', () => {
    const sun = new THREE.DirectionalLight('#fff3d6', 1.7);
    const sky = new THREE.HemisphereLight('#9fd3ff', '#1a4d55', 1.5);
    const up = 0.8;
    const lit = () => lum(sky.color) * sky.intensity + lum(sun.color) * sun.intensity * up;
    const before = lit();
    const shade = lum(sky.color) * sky.intensity;
    deepenShade(sun, sky, 0.3, up);
    expect(lit()).toBeCloseTo(before);
    expect(lum(sky.color) * sky.intensity).toBeCloseTo(shade * 0.7);
  });

  it('snaps the box to whole texels across the light', () => {
    const toLight = new THREE.Vector3(0.3, 0.8, -0.5).normalize();
    const a = snapToTexels(new THREE.Vector3(10.03, 0, 4.01), toLight, 0.1);
    const b = snapToTexels(new THREE.Vector3(10.04, 0, 4.02), toLight, 0.1);
    const right = new THREE.Vector3(0, 1, 0).cross(toLight).normalize();
    const up = toLight.clone().cross(right);
    for (const axis of [right, up]) {
      const steps = a.clone().sub(b).dot(axis) / 0.1;
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
    }
  });

  it('throws the boat’s soft shadow away from the light', () => {
    const out = blobOffset(new THREE.Vector3(1, 1, 0).normalize(), 1.2, new THREE.Vector2());
    expect(out.x).toBeCloseTo(-1.2);
    expect(out.y).toBeCloseTo(0);
  });

  it('fades the shadows under the moon to their night strength', () => {
    const data = TUNING.graphics.shadows.high;
    expect(shadowSettings(data, 0).intensity).toBe(1);
    expect(shadowSettings(data, 1).intensity).toBeCloseTo(data.nightStrength);
    expect(shadowSettings(data, 0).far).toBe(data.distance + data.box);
  });
});

describe('contact shade (issue #550)', () => {
  it('is full at the foot and gone from its height up', () => {
    const g = new THREE.BoxGeometry(1, 4, 1).translate(0, 2, 0);
    bakeContact([g]);
    const contact = g.attributes.contact!;
    const position = g.attributes.position!;
    for (let i = 0; i < position.count; i++)
      expect(contact.getX(i)).toBe(position.getY(i) === 0 ? 1 : 0);
  });

  it('lets parts with and without it merge', () => {
    const a = new THREE.BoxGeometry(1, 1, 1);
    const b = new THREE.BoxGeometry(1, 1, 1);
    bakeContact([a]);
    matchContact([a, b], true);
    expect(b.attributes.contact!.count).toBe(b.attributes.position!.count);
    matchContact([a, b], false);
    expect(a.attributes.contact).toBeUndefined();
  });
});
