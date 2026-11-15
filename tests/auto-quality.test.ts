import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { AutoQuality, type AutoStep } from '../src/render/autoQuality';

const auto = TUNING.graphics.auto;

/** Feeds `seconds` of frames at `fps` and returns every step Auto asked for. */
function run(
  controller: AutoQuality,
  fps: number,
  seconds: number,
  canRaise = false,
  canLower = true,
) {
  const steps: AutoStep[] = [];
  for (let t = 0; t < seconds; t += 1 / fps) {
    const step = controller.sample(1 / fps, canLower, canRaise);
    if (step) steps.push(step);
  }
  return steps;
}

const slowFps = auto.minFps * 0.6;
const calmFps = auto.calmFps + 5;

describe('Auto quality (issue #549)', () => {
  it('waits out the first seconds while the start builds the islands', () => {
    expect(run(new AutoQuality(), slowFps, auto.firstSec * 0.9)).toEqual([]);
  });

  it('lowers the resolution first, one step per cooldown, down to the floor', () => {
    const controller = new AutoQuality();
    const steps = run(controller, slowFps, auto.firstSec + auto.cooldownSec * 3 + 1);
    expect(steps.length).toBeGreaterThanOrEqual(3);
    for (const step of steps) expect(typeof step).toBe('object');
    expect(controller.scale).toBeLessThan(1);
    run(controller, slowFps, 30, false, false);
    expect(controller.scale).toBe(auto.scaleFloor);
  });

  it('drops a level only after holding at the floor, and goes back to full resolution', () => {
    const controller = new AutoQuality();
    const steps = run(controller, slowFps, 120);
    expect(steps).toContain('lower');
    expect(steps.indexOf('lower')).toBeGreaterThan(0);
    expect(controller.scale).toBeGreaterThan(auto.scaleFloor);
  });

  it('never asks to lower the lowest level', () => {
    expect(run(new AutoQuality(), slowFps, 200, false, false)).not.toContain('lower');
  });

  it('judges by the slowest frames, not the average', () => {
    const controller = new AutoQuality();
    // 90 % smooth at 60 fps, one frame in ten stalls to 20 fps: the average is fine, the p95 is not.
    const steps: AutoStep[] = [];
    for (let i = 0; i < 60 * 12; i++) {
      const step = controller.sample(i % 10 === 0 ? 0.05 : 1 / 60, true, false);
      if (step) steps.push(step);
    }
    expect(controller.fps).toBeGreaterThan(auto.minFps);
    expect(steps.length).toBeGreaterThan(0);
  });

  it('keeps everything when frames meet the budget', () => {
    const controller = new AutoQuality();
    expect(run(controller, auto.minFps + 5, 30)).toEqual([]);
    expect(controller.fps).toBeCloseTo(auto.minFps + 5, 0);
    expect(controller.scale).toBe(1);
  });

  it('climbs back after a calm spell, step by step, without flapping', () => {
    const controller = new AutoQuality();
    run(controller, slowFps, auto.firstSec + auto.cooldownSec * 2 + 1);
    expect(controller.scale).toBeLessThan(1);
    run(controller, calmFps, auto.calmSec * 0.5);
    const lowered = controller.scale;
    const up = run(controller, calmFps, auto.calmSec * 3 + 5);
    expect(up.length).toBeGreaterThanOrEqual(2);
    expect(controller.scale).toBeGreaterThan(lowered);
    for (const step of up) expect(typeof step).toBe('object');
  });

  it('raises the level only after a long calm spell, and waits longer after each drop', () => {
    const fresh = new AutoQuality();
    expect(run(fresh, calmFps, auto.climbSec * 0.8, true)).toEqual([]);
    expect(run(fresh, calmFps, auto.climbSec * 0.4, true)).toEqual(['raise']);
    expect(fresh.scale).toBe(auto.scaleFloor);

    const burned = new AutoQuality();
    run(burned, slowFps, 120);
    run(burned, calmFps, auto.calmSec * 6);
    expect(burned.scale).toBe(1);
    expect(run(burned, calmFps, auto.climbSec * 1.2, true)).toEqual([]);
  });

  it('does not raise a level when none above is allowed', () => {
    expect(run(new AutoQuality(), calmFps, auto.climbSec * 2, false)).toEqual([]);
  });
});
