import { describe, expect, it } from 'vitest';
import type { Heightfield } from '../src/sim/heightfield';
import { waterlines } from '../src/sim/waterline';

/** A flat 6 x 6 field with a raised 2 x 2 block in the middle. */
function block(): Heightfield {
  const w = 6,
    h = 6;
  const heights = new Float32Array(w * h).fill(-5);
  for (const j of [2, 3]) for (const i of [2, 3]) heights[j * w + i] = 5;
  return {
    x0: 0,
    y0: 0,
    cell: 1,
    w,
    h,
    heights,
    terrace: new Uint8Array(w * h),
    ground: new Uint8Array(w * h),
    grounds: [''],
    smooth: new Float32Array(w * h),
    seabed: -5,
    seed: 0,
  };
}

describe('waterlines', () => {
  it('traces one closed coast round an island, halfway up each slope', () => {
    const lines = waterlines(block());
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    expect(line[0]).toEqual(line[line.length - 1]);
    const xs = line.map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(1.5);
    expect(Math.max(...xs)).toBeCloseTo(3.5);
  });

  it('finds no coast in open sea', () => {
    const field = block();
    field.heights.fill(-5);
    expect(waterlines(field)).toEqual([]);
  });
});
