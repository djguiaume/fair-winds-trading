import { afterEach, describe, expect, it } from 'vitest';
import { perfOptions } from '../src/perf/perfOptions';
import { QUALITY, forceAntialias } from '../src/render/quality';

describe('?perf test aids (decision 0154)', () => {
  it('reads aa=1 only in perf and bench mode', () => {
    expect(perfOptions('?perf&aa=1', false).antialias).toBe(true);
    expect(perfOptions('?bench&aa=1', true).antialias).toBe(true);
    expect(perfOptions('?perf', false).antialias).toBe(false);
    expect(perfOptions('?aa=1', false).antialias).toBe(false);
  });

  describe('antialiasing by level', () => {
    const before = Object.values(QUALITY).map((p) => p.antialias);
    afterEach(() => Object.values(QUALITY).forEach((p, i) => (p.antialias = before[i]!)));

    it('is off on Low and Medium, on from High, until forced', () => {
      expect([QUALITY.low, QUALITY.medium].map((p) => p.antialias)).toEqual([false, false]);
      expect([QUALITY.high, QUALITY.ultra].map((p) => p.antialias)).toEqual([true, true]);
      forceAntialias();
      expect(Object.values(QUALITY).every((p) => p.antialias)).toBe(true);
    });
  });
});
