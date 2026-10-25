import { describe, expect, it } from 'vitest';
import { ISLAND_DESIGNS } from '../src/data/islands';
import { tidyDesign } from '../src/editor/island/doc';
import { blobOutline } from '../src/editor/island/shapes';
import {
  type IslandStep,
  applySteps,
  groundHeightAt,
  islandFromOutline,
  islandSummary,
} from '../src/editor/island/steps';
import { formatIslandJson } from '../src/editor/model';
import { isResidence } from '../src/render/models/towns';
import { islandProblems } from '../tools/fw/check';
import { stepFromArgs } from '../tools/fw/island';
// @ts-expect-error plain JavaScript module without types
import { parseArgs } from '../tools/fw/lib.mjs';

/** A small tropical island like Palm Key, made only from steps. */
const STEPS: IslandStep[] = [
  { do: 'mountain', at: [-0.15, -0.2], blob: { r: 0.42, points: 8, rough: 0.1 }, height: 0.9 },
  { do: 'plateau', at: [0.4, 0.05], size: [0.18, 0.13], slope: 0.1 },
  { do: 'prop', type: 'beacon', at: [-0.45, 0.35], size: 0.5, variant: 0 },
  {
    do: 'prop',
    type: 'palm',
    at: [
      [0.55, 0.45],
      [-0.6, 0.15],
    ],
    level: 2,
    turn: 400,
  },
  { do: 'woods', at: [0.2, -0.55], r: 0.3 },
  { do: 'spot', at: [0.1, 0.55], y: 0 },
];

describe('npm run island: island files from steps (decision 0153)', () => {
  it('draws the same seeded blob every time', () => {
    expect(blobOutline(0, 0, 1, 7, { points: 9 })).toEqual(blobOutline(0, 0, 1, 7, { points: 9 }));
    expect(blobOutline(0, 0, 1, 7)).not.toEqual(blobOutline(0, 0, 1, 8));
  });

  it('makes an island that passes the builder’s checks', () => {
    const design = islandFromOutline('test-key', {
      style: 'tropic',
      seed: 7103,
      blob: { r: 1, points: 14, rough: 0.22, stretch: 1.25 },
      low: 0.07,
    });
    expect(design.woods.tree).toBe('woodland-jungle');
    const made = applySteps(design, STEPS);
    expect(made).toEqual(['ground 1', 'ground 2', 'prop 0', 'props 1-2', 'woods', 'spot-1']);
    // The mountain stands on the low ground; the plateau rises 0.2 above it.
    expect(design.ground[1]).toMatchObject({ shape: 'peak', base: 0.07, height: 0.9 });
    expect(design.ground[2]).toMatchObject({ height: 0.27, slope: 0.1 });
    expect(groundHeightAt(design, 0.4, 0.05)).toBeCloseTo(0.27);
    expect(design.props[1]).toMatchObject({ type: 'palm', turn: 40, from: 2 });
    expect(design.woods.tries).toBe(260);
    expect(islandSummary(design, isResidence)).toBe(
      'test-key (tropic): 1 coast, 3 grounds, 3 props, 1 spot, woods 260 tries',
    );
    const problems = islandProblems(design, { R: 10, harbour: false });
    expect(problems.filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('names the step that is wrong and leaves the rest to the caller', () => {
    const design = islandFromOutline('bad');
    expect(() => applySteps(design, [{ do: 'prop', type: 'palmz', at: [0, 0] }])).toThrow(
      'step 1 (prop): no prop type "palmz"',
    );
    expect(() => applySteps(design, [{ do: 'remove', what: 'coast', index: 0 }])).toThrow(
      'the main coast stays',
    );
  });

  it('turns a command line into a step', () => {
    const args = parseArgs(['--at', '0.1,0.2 0.3,0.4', '--level', '2', '--tags', 'a,b']);
    expect(stepFromArgs('prop', args, ['palm'])).toEqual({
      do: 'prop',
      type: 'palm',
      at: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
      level: 2,
      tags: ['a', 'b'],
    });
    expect(stepFromArgs('plateau', parseArgs(['--at=0,0', '--size', '0.3', '--rock']), [])).toEqual(
      { do: 'plateau', at: [0, 0], size: [0.3, 0.3], material: 'rock' },
    );
    expect(stepFromArgs('remove', parseArgs([]), ['prop', '3'])).toEqual({
      do: 'remove',
      what: 'prop',
      index: 3,
    });
  });

  it('writes every shipped island file back with the same data', () => {
    for (const design of Object.values(ISLAND_DESIGNS)) {
      const text = formatIslandJson(tidyDesign(structuredClone(design)));
      // JSON writes -0 as 0, as the files do once saved.
      expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(design)));
    }
  });
});
