import { describe, expect, it } from 'vitest';
import { SEAS, SEA_SECTORS } from '../src/data/grownMap';
import { bearingOf, inSector, outOfSector, sectorChecks } from '../src/sim/seaSectors';

describe('sea sectors (0178)', () => {
  it('measures compass bearings from the middle, y north', () => {
    expect(bearingOf(0, 100)).toBeCloseTo(0);
    expect(bearingOf(100, 0)).toBeCloseTo(90);
    expect(bearingOf(0, -100)).toBeCloseTo(180);
    expect(bearingOf(-100, 0)).toBeCloseTo(270);
  });

  it('takes sectors that wrap past north', () => {
    expect(inSector(350, [315, 45])).toBe(true);
    expect(inSector(10, [315, 45])).toBe(true);
    expect(inSector(90, [315, 45])).toBe(false);
    expect(inSector(45.3, [315, 45])).toBe(true);
    expect(inSector(46, [315, 45])).toBe(false);
  });

  it('gives the four biomes equal quarters', () => {
    expect(SEA_SECTORS).toEqual({
      north: [315, 45],
      east: [45, 135],
      south: [135, 225],
      west: [225, 315],
    });
  });

  it('keeps every shipped sea inside its own quarter', () => {
    const checks = sectorChecks(SEAS, SEA_SECTORS);
    expect(checks.filter((c) => !c.ok && c.severity === 'error')).toEqual([]);
  });

  it('names what leaves a sector, an island by its whole beach', () => {
    const sea = {
      id: 'test',
      islands: [{ id: 'edge', name: 'Edge', x: 600, y: 600, radius: 40 }],
      terrain: [
        {
          id: 'reef',
          kind: 'reef' as const,
          outline: [
            [500, 0],
            [520, 10],
            [510, -10],
          ] as [number, number][],
        },
      ],
    };
    expect(outOfSector(sea as never, [0, 45])).toEqual(['Edge (3° out)', 'reef (46° out)']);
    const [placed, layout] = sectorChecks([sea as never], { test: [0, 45], other: [40, 90] });
    expect(placed!.ok).toBe(false);
    expect(layout!.message).toContain('overlap');
  });
});
