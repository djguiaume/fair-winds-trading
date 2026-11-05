import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { QUALITY, QUALITY_LEVELS } from '../src/render/quality';
import { drawsOnFrame, mirrorLevel, withinRange } from '../src/render/seaMirror';
import { applyGraphicsOverrides } from '../src/perf/graphicsOverrides';

describe('sea mirror (decision 0291)', () => {
  it('mirrors on Ultra alone by default, and every mirrored level has its cost knobs', () => {
    expect(QUALITY.ultra.mirror).toBe(true);
    for (const level of QUALITY_LEVELS) {
      if (QUALITY[level].mirror) {
        expect(QUALITY[level].waterReflection, `${level} needs the sky reflection`).toBe(true);
        expect(mirrorLevel(level), `${level} knobs`).not.toBeNull();
      }
      if (level !== 'ultra') expect(QUALITY[level].mirror).toBe(false);
    }
    expect(mirrorLevel('low')).toBeNull();
  });

  it('keeps the degraded High variant cheaper than Ultra’s', () => {
    const { ultra, high } = TUNING.graphics.reflection.levels;
    expect(high.resolution).toBeLessThan(ultra.resolution);
    expect(high.everyFrames).toBeGreaterThanOrEqual(ultra.everyFrames);
    expect(high.range).toBeLessThanOrEqual(ultra.range);
  });

  it('redraws on the frames the update policy says', () => {
    expect([0, 1, 2, 3].map((f) => drawsOnFrame(f, 1))).toEqual([true, true, true, true]);
    expect([0, 1, 2, 3].map((f) => drawsOnFrame(f, 2))).toEqual([true, false, true, false]);
    expect(drawsOnFrame(3, 0)).toBe(true);
  });

  it('leaves out islands whose edge lies past the range', () => {
    const island = { x: 100, z: 0, radius: 20 };
    expect(withinRange(island, { x: 0, z: 0 }, 80)).toBe(true);
    expect(withinRange(island, { x: 0, z: 0 }, 79)).toBe(false);
  });

  it('is switched off by ?off=mirror', () => {
    const settings = { quality: 'auto' as const, effects: {}, seaLife: true };
    expect(applyGraphicsOverrides('?quality=ultra&off=mirror', settings)).toBe(true);
    expect(settings.effects).toEqual({ mirror: false });
  });
});
