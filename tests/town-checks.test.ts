import { describe, expect, it } from 'vitest';
import { ISLAND_DESIGNS, type IslandDesign } from '../src/data/islands';
import { GROUNDS } from '../src/data/grounds';
import { PROP_TYPES } from '../src/render/models/props';
import { islandCheckKit } from '../src/render/models/islandCheckKit';
import type { IslandIssue } from '../src/sim/islandChecks';
import { checkTown } from '../src/sim/townChecks';
import { islandPoint } from '../src/sim/islandLayout';
import { ISLAND_SCALE } from '../src/sim/islandUnits';
import { bearingTo } from '../src/sim/math';
import {
  type House,
  angleBetween,
  hullGap,
  lineAngle,
  nearestOn,
  townPlan,
} from '../src/sim/townPlan';
import { followPose } from '../src/sim/townPose';
import { TOWN_RULES, styleRules, townRulesProblems } from '../src/sim/townRules';
import { frontSpread, longestStraight, villageCentre } from '../src/sim/townVillageChecks';

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
  it('grades each finding: a fail counts as the shipped rules say, a warn a warning', () => {
    expect(cabin).toBeGreaterThanOrEqual(0);
    // An untidy Calda, a cabin turned across its lane (and v1.9's grid, until #528 redoes it).
    const untidy = town((d) => (d.props[cabin]!.turn = (d.props[cabin]!.turn ?? 0) + 90));
    expect(untidy.length).toBeGreaterThan(0);
    for (const i of untidy) {
      const error = i.grade === 'fail' && TOWN_RULES.grading.fails === 'error';
      expect(i.severity).toBe(error ? 'error' : 'warning');
      expect(i.check).toMatch(/^town-/);
      expect(['warn', 'fail']).toContain(i.grade);
    }
  }, 20000);

  it('flags a house turned across its lane, as a warning only', () => {
    const turned = town((d) => (d.props[cabin]!.turn = (d.props[cabin]!.turn ?? 0) + 90));
    const facing = turned.filter((i) => i.prop === cabin && i.check === 'town-facing');
    expect(facing.map((i) => i.grade)).toEqual(['warn']);
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
    // A cabin with half its footprint in the sea, as in the waterline test.
    const p = calda.props[cabin]!;
    const [x, z] = calda.coasts[0]!.reduce((a, b) =>
      Math.hypot(a[0]! - p.x, a[1]! - p.z) <= Math.hypot(b[0]! - p.x, b[1]! - p.z) ? a : b,
    );
    const issues = town((d) => Object.assign(d.props[cabin]!, { x, z }), strict);
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

/** A house of the plan's kind for the geometry tests: only its place and front matter. */
const fake = (index: number, at: [number, number], deg: number): House => {
  const t = (deg * Math.PI) / 180;
  return {
    index,
    prop: calda.props[0]!,
    at,
    hull: [],
    fit: 0,
    front: [Math.sin(t), Math.cos(t)],
    width: 1,
  };
};

describe('village, not grid (issue #528)', () => {
  it('folds fronts to one square grid: a right angle is no spread', () => {
    const grid = [0, 90, 180, 270, 0, 90].map((deg, i) => fake(i, [i, 0], deg + 2));
    expect(frontSpread(grid)).toBeLessThan(1);
    const village = [-30, -12, 4, 17, 28, 40, -22, 9].map((deg, i) => fake(i, [i, 0], deg));
    expect(frontSpread(village)).toBeGreaterThan(30);
  });

  it("measures a lane's longest straight run", () => {
    const straight: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0.01],
      [3, 0],
    ];
    expect(longestStraight(straight, 0.05)).toBeCloseTo(3);
    const bent: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0.5],
      [3, 1.5],
    ];
    expect(longestStraight(bent, 0.05)).toBeLessThan(1.6);
  });

  it('fails v1.9 Calda for its grid and passes it with houses at their own angles', () => {
    const grid = (issues: IslandIssue[]) =>
      issues.filter((i) => i.check === 'town-grid' && !i.prop);
    expect(grid(shipped).map((i) => i.grade)).toEqual(['fail']);
    // Each home turned its own way (a fixed spread, not random): the town spreads.
    const turned = town((d) =>
      d.props.forEach((p, i) => {
        if (p.type === 'cabin' || p.type === 'cottage')
          p.turn = (p.turn ?? 0) + ((i * 37) % 80) - 40;
      }),
    );
    expect(grid(turned)).toEqual([]);
  }, 20000);

  it('fails a long straight row of alike houses at even gaps', () => {
    const plan = townPlan(calda, islandCheckKit(calda, R, true), TOWN_RULES, [])!;
    const cabins = plan.houses.slice(0, 6).map((h) => h.index);
    const step = plan.W * 1.8;
    const issues = town((d) =>
      cabins.forEach((k, n) =>
        Object.assign(d.props[k]!, { x: -0.3 + n * step, z: -0.1, turn: 0 }),
      ),
    );
    const row = issues.find(
      (i) => i.check === 'town-grid' && /6 houses in a straight row/.test(i.message),
    );
    expect(row?.grade).toBe('fail');
  }, 20000);

  it('warns of parallel lanes and of a centre few lanes reach', () => {
    const plan = townPlan(calda, islandCheckKit(calda, R, true), TOWN_RULES, [])!;
    const issues = town((d) => {
      d.lanes = [
        {
          points: [
            [-0.4, -0.2],
            [0.0, -0.2],
            [0.4, -0.2],
          ],
        },
        {
          points: [
            [-0.4, -0.2 + plan.W * 2],
            [0.4, -0.2 + plan.W * 2],
          ],
        },
      ];
    });
    const messages = issues.map((i) => `${i.check}: ${i.message}`).join('\n');
    expect(messages).toMatch(/town-lanes: Lanes 0 and 1 run side by side/);
    expect(messages).toMatch(/town-centre: 0 lanes reach the centre/);
  }, 20000);
});

describe('follow-cam pose (issue #544)', () => {
  it('lies out at sea, bow on to the village centre', () => {
    const kit = islandCheckKit(calda, R, true);
    const plan = townPlan(calda, kit, TOWN_RULES, [])!;
    const island = {
      id: 'calda',
      x: 100,
      y: -50,
      radius: R * ISLAND_SCALE,
      look: { harbourBearing: 1 },
    };
    const pose = followPose(plan, island);
    const [cx, cz] = villageCentre(plan);
    const centre = islandPoint(island, cx, cz);
    const boat = { x: pose.at[0], y: pose.at[1] };
    expect(Math.abs(pose.heading - (bearingTo(boat, centre) * 180) / Math.PI)).toBeLessThan(1);
    // Past the berth, which lies on the shore.
    const berth = Math.hypot(...plan.harbour!) * island.radius;
    expect(Math.hypot(boat.x - island.x, boat.y - island.y)).toBeGreaterThan(berth);
  }, 20000);
});
