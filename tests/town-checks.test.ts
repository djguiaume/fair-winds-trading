import { describe, expect, it } from 'vitest';
import { ISLAND_DESIGNS, type IslandDesign } from '../src/data/islands';
import { GROUNDS } from '../src/data/grounds';
import { PROP_TYPES } from '../src/render/models/props';
import { islandCheckKit } from '../src/render/models/islandCheckKit';
import type { IslandIssue } from '../src/sim/islandChecks';
import { checkTown } from '../src/sim/townChecks';
import { angleBetween, hullGap, lineAngle, nearestOn } from '../src/sim/townPlan';
import { TOWN_RULES, styleRules, townRulesProblems } from '../src/sim/townRules';

/** Calda as the ring places it (radius 16.4 reference units, with a harbour). */
const R = 16.4;
const calda = ISLAND_DESIGNS.calda!;
const names = { props: Object.keys(PROP_TYPES), grounds: Object.keys(GROUNDS) };

function town(change?: (d: IslandDesign) => void, rules = TOWN_RULES, from = calda) {
  const design = structuredClone(from);
  change?.(design);
  return checkTown(design, islandCheckKit(design, R, true), rules);
}
const about = (issues: IslandIssue[], prop: number) =>
  issues.filter((i) => i.prop === prop).map((i) => i.check);

/** A Calda cabin with no town finding: the one the tests move about. */
const shipped = town();
const cabin = calda.props.findIndex(
  (p, i) => p.type === 'cabin' && !p.to && !about(shipped, i).length,
);

describe('town rules data (issue #513)', () => {
  it('ships a sound rules file', () => {
    expect(townRulesProblems(TOWN_RULES, names)).toEqual([]);
    expect(styleRules(TOWN_RULES, 'tropic').setback).toBeLessThan(0);
    expect(styleRules(TOWN_RULES, 'timber')).toBe(TOWN_RULES.styles.default);
  });

  it('flags broken values', () => {
    const bad = structuredClone(TOWN_RULES);
    bad.grading.fails = 'maybe';
    bad.styles.ice!.slope = [20, 10];
    bad.styles.ice!.avoid = ['custard'];
    bad.types.fields = ['crop-circle'];
    bad.harbour.share = 2;
    expect(townRulesProblems(bad, names).map((p) => p.split(':')[0])).toEqual([
      'grading.fails',
      'styles.ice.slope',
      'styles.ice.avoid',
      'harbour.share',
      'types.fields',
    ]);
  });
});

describe('town geometry', () => {
  it('measures gaps, nearest points and angles', () => {
    const square = (x: number): [number, number][] => [
      [x, 0],
      [x + 1, 0],
      [x + 1, 1],
      [x, 1],
    ];
    expect(hullGap(square(0), square(3))).toBeCloseTo(2);
    expect(hullGap(square(0), square(0.5))).toBe(0);
    expect(
      nearestOn(
        [1, 1],
        [
          [0, 0],
          [2, 0],
        ],
      ),
    ).toEqual({ at: [1, 0], distance: 1 });
    expect(angleBetween([0, 1], [0, -1])).toBeCloseTo(180);
    // A house's front and back are alike: facing reads either way along it.
    expect(lineAngle([0, 1], [0, -1])).toBeCloseTo(0);
    expect(lineAngle([0, 1], [1, 0])).toBeCloseTo(90);
  });
});

describe('town checks (issue #513)', () => {
  it('only warns with the shipped rules, each finding graded', () => {
    expect(cabin).toBeGreaterThanOrEqual(0);
    expect(shipped.length).toBeGreaterThan(0);
    for (const i of shipped) {
      expect(i.severity).toBe('warning');
      expect(i.check).toMatch(/^town-/);
      expect(['warn', 'fail']).toContain(i.grade);
    }
  }, 20000);

  it('flags a house turned across its lane', () => {
    const turned = town((d) => (d.props[cabin]!.turn = (d.props[cabin]!.turn ?? 0) + 60));
    expect(about(turned, cabin)).toContain('town-facing');
  }, 20000);

  it('flags a house at the waterline as a fail', () => {
    const p = calda.props[cabin]!;
    // On the coast's nearest corner: half the house stands in the sea.
    const [x, z] = calda.coasts[0]!.reduce((a, b) =>
      Math.hypot(a[0]! - p.x, a[1]! - p.z) <= Math.hypot(b[0]! - p.x, b[1]! - p.z) ? a : b,
    );
    const at = town((d) => Object.assign(d.props[cabin]!, { x, z }));
    const shore = at.filter((i) => i.prop === cabin && i.check === 'town-shore');
    expect(shore[0]?.grade).toBe('fail');
  }, 20000);

  it('counts a fail as an error once the rules say so', () => {
    const strict = structuredClone(TOWN_RULES);
    strict.grading.fails = 'error';
    // Stonehaven's quarry town has houses on its tier edges.
    const issues = town(undefined, strict, ISLAND_DESIGNS['south-cay']!);
    const fails = issues.filter((i) => i.grade === 'fail');
    expect(fails.length).toBeGreaterThan(0);
    for (const i of fails) expect(i.severity).toBe('error');
  }, 20000);

  it('keeps fields off an ice island and off the lanes', () => {
    const lane = calda.lanes[0]!.points[1]!;
    const field = { type: 'field', x: lane[0]!, z: lane[1]!, from: 1 };
    const fields = (style: string) =>
      town((d) => {
        d.props.push(field);
        d.style = style as IslandDesign['style'];
      }).filter((i) => i.prop === calda.props.length && i.check === 'town-fields');
    expect(
      fields('timber')
        .map((i) => i.message)
        .join(),
    ).toMatch(/lies on a lane/);
    expect(
      fields('ice')
        .map((i) => i.message)
        .join(),
    ).toMatch(/no fields on ice islands/);
  }, 40000);
});
