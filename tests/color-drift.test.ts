import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import {
  averageColors,
  deltaE,
  driftProblems,
  hexOf,
  rgbOf,
  toLab,
  viewDrift,
} from '../src/render/colorDrift';

describe('colour check of the two views (issue #573)', () => {
  it('averages each surface and skips the others', () => {
    // Four pixels: two sea, one land, one boat (class 0).
    const rgba = [0, 0, 200, 255, 0, 0, 100, 255, 0, 120, 0, 255, 255, 255, 255, 255];
    const colors = averageColors(rgba, [1, 1, 2, 0]);
    expect(colors.sea).toEqual({ rgb: [0, 0, 150], share: 0.5 });
    expect(colors.land?.rgb).toEqual([0, 120, 0]);
    expect(colors.sky).toBeUndefined();
  });

  it('leaves out a surface too small to compare', () => {
    const ids = new Uint8Array(200).fill(1);
    ids[0] = 3;
    const rgba = new Uint8Array(200 * 4).fill(90);
    expect(averageColors(rgba, ids).sky).toBeUndefined();
  });

  it('measures colour distance in Lab', () => {
    expect(toLab([255, 255, 255])[0]).toBeCloseTo(100, 1);
    expect(deltaE([40, 100, 150], [40, 100, 150])).toBe(0);
    expect(deltaE([0, 0, 0], [255, 255, 255])).toBeCloseTo(100, 0);
    expect(deltaE([50, 100, 150], [52, 101, 150])).toBeLessThan(2);
  });

  it('compares only the surfaces both views show', () => {
    const top = { sea: { rgb: [50, 100, 150] as [number, number, number], share: 0.6 } };
    const follow = {
      sea: { rgb: [70, 130, 170] as [number, number, number], share: 0.4 },
      sky: { rgb: [130, 180, 210] as [number, number, number], share: 0.3 },
    };
    const drift = viewDrift(top, follow);
    expect(Object.keys(drift)).toEqual(['sea']);
    expect(drift.sea).toBeGreaterThan(5);
    expect(hexOf([18, 52, 86])).toBe('#123456');
  });

  it('passes one atmosphere within the agreed limits, looser into the sun', () => {
    const limits = TUNING.graphics.sky.check;
    expect(driftProblems({ sea: 4, land: 30 }, 0, false, limits)).toEqual([]);
    expect(driftProblems({ sea: 8 }, 0, false, limits)).toHaveLength(1);
    expect(driftProblems({ sea: 8 }, 0, true, limits)).toEqual([]);
    expect(driftProblems({ sea: 1 }, 5, false, limits)[0]).toMatch(/fog/);
    expect(rgbOf('#7fc0e6')).toEqual([127, 192, 230]);
  });
});
