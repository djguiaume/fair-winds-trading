import { describe, expect, it } from 'vitest';
import { QUALITY, QUALITY_LEVELS, lowerQuality, raiseQuality } from '../src/render/quality';
import { applyGraphicsOverrides } from '../src/perf/graphicsOverrides';

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
    const settings = { quality: 'auto' as const, effects: {}, seaLife: true, townFolk: true };
    expect(applyGraphicsOverrides('?quality=ultralow', settings)).toBe(true);
    expect(settings.quality).toBe('ultralow');
  });
});

describe('Auto level steps (decision 0247)', () => {
  it('goes one level at a time, from Low to Ultra-low and from Ultra-low back up', () => {
    expect(lowerQuality('ultra')).toBe('high');
    expect(lowerQuality('low')).toBe('ultralow');
    expect(lowerQuality('ultralow')).toBe('ultralow');
    expect(raiseQuality('low')).toBe('medium');
    expect(raiseQuality('ultra')).toBe('ultra');
  });
});
