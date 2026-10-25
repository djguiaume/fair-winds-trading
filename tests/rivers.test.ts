import { describe, expect, it } from 'vitest';
import { type IslandDesign, questDesign } from '../src/data/islands';
import { isGlowing } from '../src/render/models/geometry';
import { riverParts, riverSamples } from '../src/render/models/rivers';
import { designedTownParts, islandCheckKit } from '../src/render/models/towns';
import { applySteps, islandFromOutline } from '../src/editor/island/steps';
import { tidyDesign } from '../src/editor/island/doc';
import { checkIsland } from '../src/sim/islandChecks';
import { fallsBetween, islandLayout, peakHeight, surfaceHeight } from '../src/sim/islandLayout';

/** A round island with a plateau, a mountain, a lava river off the peak and a stream off the cliff. */
function riverIsland(): IslandDesign {
  const d = islandFromOutline('river-test', { seed: 5 });
  applySteps(d, [
    { do: 'plateau', at: [0.2, -0.2], size: [0.45, 0.4], height: 0.22 },
    { do: 'mountain', at: [-0.4, -0.3], size: [0.35, 0.35], height: 0.75 },
    {
      do: 'river',
      kind: 'lava',
      points: [
        [-0.4, -0.25],
        [-0.55, 0.15],
        [-0.8, 1.1],
      ],
      width: 0.05,
    },
    {
      do: 'river',
      points: [
        [0.3, -0.4],
        [0.4, 0.05],
        [0.95, 0.6],
      ],
    },
  ]);
  return tidyDesign(d);
}
const R = 60 / 2.2;

describe('rivers (decision 0176)', () => {
  it('are made by the island steps, with the default width and kind left out for water', () => {
    const d = riverIsland();
    expect(d.rivers).toHaveLength(2);
    expect(d.rivers![0]!.kind).toBe('lava');
    expect(d.rivers![1]!.kind).toBeUndefined();
    expect(d.rivers![1]!.width).toBe(0.04);
    expect(Object.keys(d)).toEqual(expect.arrayContaining(['rivers']));
  });

  it('lie on a mountain as its faceted cone, down to its foot', () => {
    const d = riverIsland();
    const layout = islandLayout(d);
    const peak = layout.surfaces.find((s) => s.shape === 'peak')!;
    expect(peakHeight(peak, -0.4, -0.3)).toBeCloseTo(0.75, 2);
    expect(peakHeight(peak, -0.4, 0.2)).toBeNull();
    // Half way up the flank, between the foot (beach, 0) and the top.
    const half = surfaceHeight(layout, -0.4, -0.3 + 0.35 * 0.5)!;
    expect(half).toBeGreaterThan(0.3);
    expect(half).toBeLessThan(0.45);
    expect(surfaceHeight(layout, 2, 2)).toBeNull();
  });

  it('fall at a cliff of raised ground but not on a mountain flank', () => {
    const layout = islandLayout(riverIsland());
    expect(fallsBetween(layout, 0.4, -0.05, 0.75, 0.3)).toBe(true);
    expect(fallsBetween(layout, -0.4, -0.25, -0.45, -0.05)).toBe(false);
  });

  it('end where they first reach the sea', () => {
    const d = riverIsland();
    const samples = riverSamples(islandLayout(d), d.rivers![0]!);
    expect(samples[samples.length - 1]!.h).toBeNull();
    expect(samples.slice(0, -1).every((s) => s.h !== null)).toBe(true);
  });

  it('draw lava as glowing parts and water as land', () => {
    const d = riverIsland();
    const layout = islandLayout(d);
    const lava = riverParts(layout, d.rivers![0]!, R);
    const water = riverParts(layout, d.rivers![1]!, R);
    expect(lava.some(isGlowing)).toBe(true);
    expect(water.some(isGlowing)).toBe(false);
    expect(water.every((g) => g.userData.islandTerrain)).toBe(true);
    // Both stand in the island model.
    const parts = designedTownParts(d, R, 1, false);
    expect(parts.filter(isGlowing).length).toBeGreaterThan(0);
  });

  it('pass the island checks, which catch a source at sea and a missing width', () => {
    const d = riverIsland();
    const kit = islandCheckKit(d, R, false);
    expect(checkIsland(d, kit).filter((i) => i.severity === 'error')).toEqual([]);
    const bad = structuredClone(d);
    bad.rivers![1]!.points[0] = [3, 3];
    bad.rivers![0]!.width = 0;
    const errors = checkIsland(bad, kit).filter((i) => i.severity === 'error');
    expect(errors.map((e) => e.message).join(' ')).toMatch(/needs a width/);
  });

  it('widen and narrow smoothly between points that carry their own width', () => {
    const d = riverIsland();
    applySteps(d, [{ do: 'widen', river: 1, point: 2, width: 0.12 }]);
    expect(d.rivers![1]!.points[2]).toEqual([0.95, 0.6, 0.12]);
    const w = riverSamples(islandLayout(d), d.rivers![1]!).map((s) => s.w);
    expect(w[0]).toBeCloseTo(0.04, 3);
    expect(w[w.length - 1]!).toBeGreaterThan(0.06);
    for (let i = 1; i < w.length; i++) expect(w[i]!).toBeGreaterThanOrEqual(w[i - 1]! - 0.002);
    // Clearing goes back to the river's width.
    applySteps(d, [{ do: 'widen', river: 1, point: 2 }]);
    expect(d.rivers![1]!.points[2]).toEqual([0.95, 0.6]);
    const kit = islandCheckKit(d, R, false);
    d.rivers![1]!.points[1] = [0.4, 0.05, 0];
    expect(
      checkIsland(d, kit)
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/width must be above 0/);
  });

  it('follow after:/before: quest tags like props', () => {
    const d = riverIsland();
    d.rivers![0]!.tags = ['after:emberhold-glass'];
    expect(questDesign(d, new Set()).rivers).toHaveLength(1);
    expect(questDesign(d, new Set(['emberhold-glass'])).rivers).toHaveLength(2);
  });
});
