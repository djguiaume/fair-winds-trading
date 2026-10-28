import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TUNING, resetTuning } from '../src/data/tuning';
import { CameraOrbit, type ViewAxes, viewAxes } from '../src/render/cameraOrbit';
import { rainMayReachArea } from '../src/render/rain';
import { DEG } from '../src/sim/math';
import type { Storm } from '../src/sim/storms';

const c = TUNING.camera;
/** Run the camera for this many seconds. */
const run = (orbit: CameraOrbit, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) orbit.update(1 / 60);
};

describe('a camera the player can turn (decision 0223)', () => {
  afterEach(resetTuning);

  it('turns round the boat and tilts only between the limits', () => {
    const orbit = new CameraOrbit();
    expect(orbit.turned).toBe(false);
    expect(orbit.pitch).toBeCloseTo(c.pitchDeg * DEG);
    orbit.turn(200 * DEG, -40 * DEG);
    // The heading wraps to (-180°, 180°], the tilt stops at the flattest.
    expect(orbit.heading).toBeCloseTo(-160 * DEG);
    expect(orbit.pitch).toBeCloseTo(c.pitchMinDeg * DEG);
    orbit.turn(0, 90 * DEG);
    expect(orbit.pitch).toBeCloseTo(c.pitchMaxDeg * DEG);
    expect(orbit.turned).toBe(true);
  });

  it('eases back north-up the short way on a reset, and stays there', () => {
    const orbit = new CameraOrbit();
    orbit.turn(-170 * DEG, 5 * DEG);
    orbit.reset();
    orbit.update(0.05);
    // From -170° the short way home is back through -169°, not round by 0° the long way.
    expect(orbit.heading).toBeGreaterThan(-170 * DEG);
    expect(orbit.heading).toBeLessThan(0);
    run(orbit, 5);
    expect(orbit.heading).toBe(0);
    expect(orbit.pitch).toBeCloseTo(c.pitchDeg * DEG);
    expect(orbit.turned).toBe(false);
  });

  it('a mouse looks the way it drags; on touch the sea follows the fingers', () => {
    const mouse = new CameraOrbit();
    mouse.drag(100, -20, 'mouse');
    expect(mouse.heading).toBeCloseTo(100 * c.mouseDegPerPx * DEG);
    // Dragging up flattens the camera.
    expect(mouse.pitch).toBeLessThan(c.pitchDeg * DEG);
    const touch = new CameraOrbit();
    touch.drag(100, 0, 'touch');
    expect(Math.sign(touch.heading)).toBe(-1);
  });

  it('switched off or under a focus view, it ignores turns and comes home', () => {
    const orbit = new CameraOrbit();
    orbit.turn(60 * DEG);
    orbit.held = true;
    orbit.turn(30 * DEG);
    expect(orbit.heading).toBeCloseTo(60 * DEG);
    run(orbit, 5);
    expect(orbit.heading).toBe(0);
    orbit.held = false;
    orbit.enabled = false;
    orbit.turn(30 * DEG);
    expect(orbit.turned).toBe(false);
  });

  it('comes back by itself only when asked, after the quiet seconds', () => {
    const orbit = new CameraOrbit();
    orbit.turn(45 * DEG);
    run(orbit, c.returnAfterSeconds + 3);
    expect(orbit.heading).toBeCloseTo(45 * DEG);
    orbit.autoReturn = true;
    orbit.turn(1 * DEG);
    run(orbit, c.returnAfterSeconds - 1);
    expect(orbit.heading).toBeCloseTo(46 * DEG);
    run(orbit, 4);
    expect(orbit.heading).toBe(0);
  });

  it('follows a tuned default tilt at once', () => {
    const orbit = new CameraOrbit();
    c.pitchDeg = 64;
    expect(orbit.pitch).toBeCloseTo(64 * DEG);
    expect(orbit.turned).toBe(false);
  });

  it('the screen axes turn with the heading', () => {
    const axes = viewAxes(0, {} as ViewAxes);
    // North-up: right is east (+x), up the screen is north (-z).
    expect(axes).toMatchObject({ rightX: 1, rightZ: 0, forwardX: 0, forwardZ: -1 });
    viewAxes(90 * DEG, axes);
    // Looking east: right is south (+z), up the screen is east.
    expect(axes.rightX).toBeCloseTo(0);
    expect(axes.rightZ).toBeCloseTo(1);
    expect(axes.forwardX).toBeCloseTo(1);
    expect(axes.forwardZ).toBeCloseTo(0);
  });

  it('the rain field turns with the camera', () => {
    const centre = new THREE.Vector3(0, 0, 0);
    // A storm far up the screen of a north-up camera, east of a camera looking east.
    const storm = { x: 0, y: 200, radius: 40, intensity: 1 } as Storm;
    expect(rainMayReachArea(centre, 0, [storm])).toBe(true);
    expect(rainMayReachArea(centre, 0, [storm], viewAxes(90 * DEG, {} as ViewAxes))).toBe(false);
    expect(rainMayReachArea(centre, 0, [storm], viewAxes(-90 * DEG, {} as ViewAxes))).toBe(false);
  });
});
