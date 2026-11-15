import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TUNING, resetTuning } from '../src/data/tuning';
import { type ChaseFrame, chaseFrame } from '../src/render/chaseFrame';
import { CameraRig } from '../src/render/cameraRig';
import { dragTurn } from '../src/render/cameraOrbit';
import { ChaseView, TOP_VIEW, cameraCycle } from '../src/render/chaseView';
import { DEG } from '../src/sim/math';

const c = TUNING.camera.chase;
const SIGHT = TUNING.weather.sight.far * c.sightDistance;
const frame = (): ChaseFrame => ({ rest: 0, elevation: 0, pitch: 0, distance: 0, fov: 0 });

/** A follow cam settled behind a boat at the origin heading north at `speedKn`, as the game sees it. */
function settledCamera(speedKn: number) {
  const camera = new THREE.PerspectiveCamera(40, 1.6, 1, 600);
  const rig = new CameraRig(camera);
  rig.jump(true);
  const boat = new THREE.Vector3(0, 0, 0);
  for (let i = 0; i < 600; i++) rig.place(1 / 60, 1.6, boat, { x: 0, y: 1 }, speedKn);
  camera.updateMatrixWorld();
  return camera;
}

/** How far down the screen (0 top, 1 bottom) a scene point lands. */
function screenY(camera: THREE.PerspectiveCamera, x: number, y: number, z: number): number {
  const p = new THREE.Vector3(x, y, z).project(camera);
  return (1 - p.y) / 2;
}

describe('the follow cam framing (art bible §13, issue #537)', () => {
  afterEach(resetTuning);

  it('puts the boat in the lower third and the sea edge in its band, at rest and at speed', () => {
    for (const speed of [0, c.fullSpeedKn]) {
      const camera = settledCamera(speed);
      const boat = screenY(camera, 0, c.aimHeight, 0);
      // The sea's edge in the fog, straight ahead of the boat (north is -z).
      const edge = screenY(camera, camera.position.x, 0, camera.position.z - SIGHT);
      expect(boat).toBeGreaterThanOrEqual(0.62);
      expect(boat).toBeLessThanOrEqual(0.68);
      expect(edge).toBeGreaterThanOrEqual(speed ? 0.3 : 0.35);
      expect(edge).toBeLessThanOrEqual(0.42);
    }
  });

  it('rests 12-20° over the boat, climbs to at most 30° and pulls back at most 30%', () => {
    const rest = chaseFrame(c.framings.b, 0, 0, 1, SIGHT, frame());
    const fast = chaseFrame(c.framings.b, 1, 0, 1, SIGHT, frame());
    expect(rest.elevation / DEG).toBeGreaterThanOrEqual(12);
    expect(rest.elevation / DEG).toBeLessThanOrEqual(20);
    expect(fast.elevation).toBeGreaterThan(rest.elevation);
    expect(fast.elevation / DEG).toBeLessThanOrEqual(30);
    expect(fast.distance / rest.distance).toBeLessThanOrEqual(1.3);
    expect(fast.distance).toBeGreaterThan(rest.distance);
  });

  it('eases a change of speed over at least 1.5 s, so it never pumps', () => {
    const view = new ChaseView();
    view.toggle();
    view.update(1.5, 0, true, c.fullSpeedKn);
    expect(view.pace).toBeLessThan(0.6);
    for (let t = 0; t < 20; t += 0.05) view.update(0.05, 0, true, c.fullSpeedKn);
    expect(view.pace).toBeCloseTo(1, 2);
  });

  it('slides to her high side as she heels, never past the limit', () => {
    const view = new ChaseView();
    view.snap(0, 5, 30 * DEG);
    expect(Math.sign(view.side)).toBe(Math.sign(c.leeShiftPerDeg));
    expect(Math.abs(view.side)).toBeLessThanOrEqual(c.leeShiftMax);
    view.snap(0, 5, -30 * DEG);
    expect(Math.sign(view.side)).toBe(-Math.sign(c.leeShiftPerDeg));
  });
});

describe('looking round the boat in the follow cam (issue #536)', () => {
  afterEach(resetTuning);

  /** A follow cam switched on, its framing taken once so it knows where it rests. */
  function lookingView() {
    const view = new ChaseView();
    view.toggle();
    view.update(1, 0, true, 5);
    view.frame(SIGHT, frame());
    return view;
  }

  it('turns all the way round and tilts only between the orbit limits', () => {
    const view = lookingView();
    view.turn(200 * DEG, 90 * DEG);
    expect(view.yaw).toBeCloseTo(-160 * DEG);
    expect(view.turned).toBe(true);
    expect(view.frame(SIGHT, frame()).elevation).toBeCloseTo(c.orbitPitchMaxDeg * DEG);
    view.turn(0, -90 * DEG);
    expect(view.frame(SIGHT, frame()).elevation).toBeCloseTo(c.orbitPitchMinDeg * DEG);
  });

  it('holds the look, then eases back behind the boat after the return time', () => {
    const view = lookingView();
    view.turn(90 * DEG, 10 * DEG);
    for (let t = 0; t < c.returnAfterSeconds - 0.5; t += 0.05) view.update(0.05, 0, true, 5);
    expect(view.yaw).toBeCloseTo(90 * DEG);
    for (let t = 0; t < 5; t += 0.05) view.update(0.05, 0, true, 5);
    expect(view.turned).toBe(false);
    expect(view.yaw).toBe(0);
    expect(view.tilt).toBe(0);
  });

  it('takes the mouse and finger drags with the sea camera feel, and only while on', () => {
    const view = new ChaseView();
    dragTurn(view, 100, 0, 'mouse');
    expect(view.yaw).toBe(0);
    view.toggle();
    dragTurn(view, 100, 0, 'mouse');
    expect(view.yaw).toBeCloseTo(100 * TUNING.camera.mouseDegPerPx * DEG);
  });

  it('a reset eases back at once', () => {
    const view = lookingView();
    view.turn(1, 0);
    view.reset();
    for (let t = 0; t < 5; t += 0.05) view.update(0.05, 0, true, 5);
    expect(view.turned).toBe(false);
  });
});

describe('the camera button cycle (decision 0312)', () => {
  afterEach(resetTuning);

  it('names only framings and the top view', () => {
    for (const id of cameraCycle()) expect(id === TOP_VIEW || id in c.framings, id).toBe(true);
  });

  it('steps B, C, top, A and round again', () => {
    TUNING.camera.chase.cycle = 'b, c, top, a';
    const view = new ChaseView();
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      view.cycle();
      seen.push(view.active ? view.framing : TOP_VIEW);
    }
    expect(seen).toEqual(['a', 'b', 'c', 'top', 'a']);
  });

  it('glides from one framing to the next, landing on it', () => {
    const view = new ChaseView();
    view.cycle();
    for (let t = 0; t < 3; t += 0.05) view.update(0.05, 0, true);
    const from = view.frame(SIGHT, frame()).distance;
    view.framing = 'c';
    view.update(0.05, 0, true);
    const between = view.frame(SIGHT, frame()).distance;
    for (let t = 0; t < 5; t += 0.05) view.update(0.05, 0, true);
    const to = view.frame(SIGHT, frame()).distance;
    expect(between).toBeGreaterThan(from);
    expect(between).toBeLessThan(to);
    expect(to).toBeCloseTo(c.framings.c.distance);
  });
});
