import { afterEach, describe, expect, it } from 'vitest';
import { TUNING, resetTuning } from '../src/data/tuning';
import { PHASE1_MAP } from '../src/data/maps';
import type { CameraRig } from '../src/render/cameraRig';
import { ChaseView } from '../src/render/chaseView';
import { openingProblems } from '../src/sim/openingCheck';
import { SLOOP } from '../src/sim/ship';
import { startAtPrologue } from '../src/sim/prologue';
import { createWorld } from '../src/sim/world';
import { daylightAt } from '../src/sim/daylight';
import { CameraStage } from '../src/ui/cameraStage';

// Issues #531 and #533: the live title's pose and the first voyage's opening.

function stage(own = 'top', still = false) {
  const rig = { chase: new ChaseView(), stageShift: 0 };
  return {
    rig,
    stage: new CameraStage(
      rig as unknown as CameraRig,
      () => own,
      () => still,
    ),
  };
}

describe('the live title (#531)', () => {
  afterEach(resetTuning);

  it('stages the title framing and slides the scene clear of the menu column', () => {
    const { rig, stage: s } = stage();
    s.title(true, 0.36);
    expect(rig.chase.view).toBe('title');
    expect(rig.stageShift).toBeCloseTo(0.18);
    expect(s.view).toBe('title');
  });

  it('swings slowly round its pose, and holds still on Gentle motion', () => {
    const { rig, stage: s } = stage();
    s.title(true, 0.3);
    s.update(TUNING.camera.title.driftPeriodSec / 4, false);
    const top = (TUNING.camera.title.yawDeg + TUNING.camera.title.driftDeg) * (Math.PI / 180);
    expect(rig.chase.drift).toBeCloseTo(top);
    const calm = stage('top', true);
    calm.stage.title(true, 0.3);
    calm.stage.update(10, false);
    expect(calm.rig.chase.drift).toBeCloseTo(TUNING.camera.title.yawDeg * (Math.PI / 180));
  });

  it("gives the player's own view back and eases the swing out", () => {
    const { rig, stage: s } = stage('c');
    s.title(true, 0.3);
    s.update(1, false);
    s.title(false);
    expect(s.view).toBeNull();
    expect(rig.chase.view).toBe('c');
    expect(rig.stageShift).toBe(0);
    for (let i = 0; i < 200; i++) s.update(0.05, false);
    expect(rig.chase.drift).toBeCloseTo(0);
  });
});

describe("the first voyage's opening (#533)", () => {
  it('holds the follow cam until the sails are up, then the saved view returns', () => {
    const { rig, stage: s } = stage('top');
    s.open('b');
    s.update(0.1, false);
    expect(rig.chase.view).toBe('b');
    s.update(0.1, true);
    expect(rig.chase.view).toBe('top');
    expect(s.view).toBeNull();
  });

  it('ends when the hints are skipped', () => {
    const { rig, stage: s } = stage('top');
    s.open('b');
    s.closeOpening();
    expect(rig.chase.view).toBe('top');
    expect(s.view).toBeNull();
  });

  it('leaves the camera to the player who takes it first', () => {
    const { rig, stage: s } = stage('top');
    s.open('b');
    rig.chase.view = 'c';
    s.update(0.1, true);
    expect(rig.chase.view).toBe('c');
    expect(s.view).toBeNull();
  });

  it('begins in the morning, the sun about 30° up', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    expect(startAtPrologue(world)).toBe(true);
    const sun = daylightAt(world.time);
    expect(sun.night).toBe(0);
    expect(Math.asin(sun.skyHeight) / (Math.PI / 180)).toBeGreaterThan(20);
    expect(Math.asin(sun.skyHeight) / (Math.PI / 180)).toBeLessThan(40);
    expect(world.time).toBeLessThan(60);
  });

  it('has land ahead, the sun behind and Skerry out of sight', () => {
    expect(openingProblems(PHASE1_MAP)).toEqual([]);
    const map = structuredClone(PHASE1_MAP);
    map.islands = [];
    map.terrain = [];
    expect(openingProblems(map)).toContain('no land within 600 units ahead');
    map.prologue!.opening = { hour: 12, view: 'nope' };
    expect(openingProblems(map).length).toBeGreaterThanOrEqual(3);
  });
});
