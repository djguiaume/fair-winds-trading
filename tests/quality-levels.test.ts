import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { FrameMonitor, QUALITY, QUALITY_LEVELS, lowerQuality } from '../src/render/quality';
import { applyGraphicsOverrides } from '../src/perf/graphicsOverrides';

/** Feeds `seconds` of frames at `fps`; true if the monitor asked for a step down at any point. */
function run(monitor: FrameMonitor, fps: number, seconds: number) {
  let asked = 0;
  for (let t = 0; t < seconds; t += 1 / fps) if (monitor.sample(1 / fps)) asked++;
  return asked;
}

describe('quality levels (decision 0247)', () => {
  it('has a level for every name, each drawing at most as many pixels as the next', () => {
    expect(Object.keys(QUALITY).sort()).toEqual([...QUALITY_LEVELS].sort());
    for (let i = 1; i < QUALITY_LEVELS.length; i++)
      expect(QUALITY[QUALITY_LEVELS[i - 1]!].maxRenderPixels).toBeLessThan(
        QUALITY[QUALITY_LEVELS[i]!].maxRenderPixels,
      );
  });

  it('draws Ultra-low plain, at half of Low’s pixels or fewer, and only Ultra-low', () => {
    expect(QUALITY.ultralow.plain).toBe(true);
    expect(QUALITY.ultralow.maxRenderPixels).toBeLessThanOrEqual(QUALITY.low.maxRenderPixels / 2);
    for (const level of QUALITY_LEVELS.filter((l) => l !== 'ultralow'))
      expect(QUALITY[level].plain).toBe(false);
  });

  it('is picked by ?quality=ultralow', () => {
    const settings = { quality: 'auto' as const, effects: {} };
    expect(applyGraphicsOverrides('?quality=ultralow', settings)).toBe(true);
    expect(settings.quality).toBe('ultralow');
  });
});

describe('Auto step down (decision 0247)', () => {
  const { minFps, firstSec, cooldownSec } = TUNING.graphics.auto;

  it('goes one level down at a time, from Low to Ultra-low, and no further', () => {
    expect(lowerQuality('ultra')).toBe('high');
    expect(lowerQuality('low')).toBe('ultralow');
    expect(lowerQuality('ultralow')).toBe('ultralow');
  });

  it('asks for a drop when frames run below the budget, once per cooldown', () => {
    const monitor = new FrameMonitor();
    const slow = minFps * 0.6;
    // Nothing in the first seconds while the start builds the islands.
    expect(run(monitor, slow, firstSec * 0.9)).toBe(0);
    expect(run(monitor, slow, firstSec + 1)).toBe(1);
    expect(run(monitor, slow, cooldownSec * 0.5)).toBe(0);
    expect(run(monitor, slow, cooldownSec * 2)).toBeGreaterThanOrEqual(1);
  });

  it('keeps the level when frames meet the budget', () => {
    const monitor = new FrameMonitor();
    expect(run(monitor, minFps + 5, 30)).toBe(0);
    expect(monitor.fps).toBeCloseTo(minFps + 5, 0);
  });
});
