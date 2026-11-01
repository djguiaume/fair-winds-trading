import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { ChaseView } from '../src/render/chaseView';

const c = TUNING.camera.chase;

function settle(view: ChaseView, boatHeading: number, wanted = true) {
  for (let i = 0; i < 400; i++) view.update(0.05, boatHeading, wanted);
}

describe('ChaseView', () => {
  it('eases in and out, resting on the boat heading when off', () => {
    const v = new ChaseView();
    v.update(0.05, 1.2, true);
    expect(v.blend).toBe(0);
    expect(v.heading).toBe(1.2);
    v.toggle();
    settle(v, 1.2);
    expect(v.blend).toBe(1);
    v.toggle();
    settle(v, 1.2);
    expect(v.blend).toBe(0);
  });

  it('trails the boat round the short way', () => {
    const v = new ChaseView();
    v.toggle();
    settle(v, 3);
    v.update(0.05, -3, true);
    // 3 → -3 is a short hop through π: the heading passes 3 rather than swinging back through 0.
    expect(v.heading).toBeGreaterThan(3);
  });

  it('waits while another view needs the sea camera', () => {
    const v = new ChaseView();
    v.toggle();
    settle(v, 0, false);
    expect(v.blend).toBe(0);
  });

  it('clamps its zoom', () => {
    const v = new ChaseView();
    v.zoomBy(100);
    expect(v.zoom).toBe(c.zoomMax);
    v.zoomBy(0.0001);
    expect(v.zoom).toBe(c.zoomMin);
  });

  it('switches on a pinch past the closest sea zoom and back past the chase limit', () => {
    const v = new ChaseView();
    expect(v.pinch(0.9, false)).toBe(false);
    let switched = false;
    for (let i = 0; i < 20 && !switched; i++) switched = v.pinch(0.9, true);
    expect(v.active).toBe(true);
    v.zoom = c.zoomMax;
    switched = false;
    for (let i = 0; i < 20 && !switched; i++) switched = v.pinch(1.1, true);
    expect(v.active).toBe(false);
  });

  it('forgets a half pinch when the fingers change direction', () => {
    const v = new ChaseView();
    v.pinch(1 / Math.exp(c.pinchSwitch * 0.9), true);
    v.pinch(1.05, true);
    expect(v.pinch(1 / Math.exp(c.pinchSwitch * 0.9), true)).toBe(false);
  });
});
