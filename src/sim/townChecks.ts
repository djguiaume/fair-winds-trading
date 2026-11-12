import type { IslandDesign } from '../data/islands';
import type { IslandCheckKit, IslandIssue } from './islandChecks';
import {
  type House,
  type Point,
  type TownPlan,
  angleBetween,
  groundAt,
  hullGap,
  lasting,
  lineAngle,
  named,
  nearestOn,
  slopeAt,
  townPlan,
  waterAt,
} from './townPlan';
import { checkTownGround } from './townGroundChecks';
import { TOWN_RULES, type TownRules } from './townRules';

/**
 * The believable-town checks (issue #513): the art director's town layout rules (art bible ›
 * Towns, numbers in `src/data/town-rules.json`) on a designed island's houses. Shared by the
 * island builder, `npm run island` and the audit (`npm run island -- audit`). Each finding is
 * graded warn or fail; a fail counts as `grading.fails` says (warnings while towns 2 and 3 fix the islands).
 */
export function checkTown(
  design: IslandDesign,
  kit: IslandCheckKit,
  rules: TownRules = TOWN_RULES,
): IslandIssue[] {
  const issues: IslandIssue[] = [];
  const plan = townPlan(design, kit, rules, issues);
  if (!plan) return issues;
  const quayHouses = new Set<House>();
  for (const h of plan.houses) {
    houseGround(plan, h);
    if (houseFacing(plan, h)) quayHouses.add(h);
    houseShore(plan, h, quayHouses.has(h));
  }
  houseSpacing(plan);
  harbourCentre(plan);
  checkTownGround(plan);
  return issues;
}

/** Share of a house's footprint radius its slope is read over. */
const FOOTING = 0.7;
const inW = (plan: TownPlan, d: number) => `${(d / plan.W).toFixed(Math.abs(d) < plan.W ? 2 : 1)}W`;

/** Flat ground, never on the style's forbidden ground; churches may stand on a rise. */
function houseGround(plan: TownPlan, h: House) {
  const { style, rules, harbour, W } = plan;
  const extra = { prop: h.index, at: h.at };
  // The ring inside the footprint's corners: the ground the walls stand on, not the bank past them.
  const { deg } = slopeAt(plan, h.at[0], h.at[1], h.fit * FOOTING);
  const core =
    harbour &&
    plan.houses.length >= rules.harbour.mainPort &&
    Math.hypot(h.at[0] - harbour[0], h.at[1] - harbour[1]) <= rules.harbour.core * W;
  const warn = core ? Math.min(style.slope[0], rules.harbour.coreSlope) : style.slope[0];
  const grade = deg > style.slope[1] ? 'fail' : deg > warn ? 'warn' : null;
  if (grade)
    plan.report(
      'slope',
      grade,
      `${named(h.prop)} stands on ${deg.toFixed(0)}° ground (${core ? 'harbour core, ' : ''}warn ${warn}°, fail ${style.slope[1]}°)`,
      extra,
    );
  const bad = [h.at, ...h.hull]
    .map(([x, z]) => groundAt(plan, x, z))
    .find((g) => style.avoid.includes(g));
  if (bad) plan.report('ground', 'fail', `${named(h.prop)} stands on ${bad}`, extra);
}

/** The door faces the nearest lane or quay close by, else the water. True if it faces a quay. */
function houseFacing(plan: TownPlan, h: House): boolean {
  const { rules, W } = plan;
  const reach = rules.houses.facingReach * W + h.fit;
  const lane = nearest(
    h.at,
    plan.lanes.filter((l) => l.length > 1),
  );
  const quay = nearest(h.at, [...plan.piers, ...plan.quays.map((q) => [q])]);
  const target =
    quay.distance <= reach && quay.distance <= lane.distance
      ? { what: 'quay', ...quay }
      : lane.distance <= reach
        ? { what: 'lane', ...lane }
        : null;
  if (target && target.distance < 1e-4) return target.what === 'quay';
  const way: Point = target
    ? [target.at[0] - h.at[0], target.at[1] - h.at[1]]
    : waterAt(plan, h.at[0], h.at[1]).way;
  // The house models have no door: their front and back walls are alike, so either may face it.
  const off = lineAngle(h.front, way);
  const [warn, fail] = rules.houses.facing;
  const grade = off > fail ? 'fail' : off > warn ? 'warn' : null;
  if (grade)
    plan.report(
      'facing',
      grade,
      `${named(h.prop)} faces ${off.toFixed(0)}° away from the ${target?.what ?? 'water'} (warn ${warn}°, fail ${fail}°)`,
      { prop: h.index, at: h.at },
    );
  return target?.what === 'quay';
}

/** Nearest point of any of the lines (a one-point line is a point). */
function nearest(p: Point, lines: readonly (readonly Point[])[]) {
  let best = { at: p, distance: Infinity };
  for (const line of lines) {
    const n = nearestOn(p, line);
    if (n.distance < best.distance) best = n;
  }
  return best;
}

/** Set back from the waterline: quay houses may come closer, tropic stilts stand out over it. */
function houseShore(plan: TownPlan, h: House, quay: boolean) {
  const { rules, style, W } = plan;
  const depth = Math.min(...h.hull.map(([x, z]) => waterAt(plan, x, z).depth));
  const need = (quay ? rules.houses.quaySetback : style.setback) * W;
  if (depth >= need) return;
  const grade = depth < Math.min(0, need) ? 'fail' : 'warn';
  plan.report(
    'shore',
    grade,
    `${named(h.prop)} is ${inW(plan, depth)} from the waterline (needs ${inW(plan, need)}${quay ? ', quay house' : ''})`,
    { prop: h.index, at: h.at },
  );
}

/** Neighbours apart but not merged, rows turned alike, no house alone, every house near a lane. */
function houseSpacing(plan: TownPlan) {
  const { houses, rules, style, W } = plan;
  const outlier = (h: House) => rules.types.outliers.includes(h.prop.type);
  const lanes = plan.lanes.filter((l) => l.length > 1);
  for (let i = 0; i < houses.length; i++) {
    const h = houses[i]!;
    const extra = { prop: h.index, at: h.at };
    let closest = Infinity;
    let rowOff = 0;
    for (let j = 0; j < houses.length; j++) {
      if (j === i) continue;
      const o = houses[j]!;
      const gap = hullGap(h.hull, o.hull);
      closest = Math.min(closest, gap);
      // Side by side: the line between them runs across both fronts, not along either (where
      // two rows meet at a corner, one house stands before the other, and they are no row).
      const between: Point = [o.at[0] - h.at[0], o.at[1] - h.at[1]];
      const across = [h, o].every((a) => Math.abs(90 - angleBetween(a.front, between)) < 45);
      if (j < i && gap <= style.spacing[1] * W && across)
        rowOff = Math.max(rowOff, lineAngle(h.front, o.front));
    }
    if (closest > 0 && closest < style.spacing[0] * W)
      plan.report(
        'spacing',
        'warn',
        `${named(h.prop)} is ${inW(plan, closest)} from its neighbour: the two merge (under ${style.spacing[0]}W)`,
        extra,
      );
    if (rowOff > rules.houses.rowTurn)
      plan.report(
        'row',
        'warn',
        `${named(h.prop)} turns ${rowOff.toFixed(0)}° from the house beside it (row within ${rules.houses.rowTurn}°)`,
        extra,
      );
    const lane = nearest(h.at, lanes).distance - h.fit;
    if (!outlier(h) && closest > style.lonely * W && lane > style.lonely * W)
      plan.report(
        'spacing',
        'warn',
        `${named(h.prop)} stands alone: ${inW(plan, closest)} from a house (over ${style.lonely}W)`,
        extra,
      );
    if (lanes.length && !outlier(h) && lane > style.laneReach * W)
      plan.report(
        'lanes',
        'warn',
        `${named(h.prop)} is ${inW(plan, lane)} from a lane (within ${style.laneReach}W)`,
        extra,
      );
  }
  if (!lanes.length && houses.length >= 3)
    plan.report(
      'lanes',
      'warn',
      `No lanes: ${houses.length} houses, each wants a lane within ${style.laneReach}W`,
      {
        at: plan.harbour ?? houses[0]!.at,
      },
    );
}

/** The harbour is the town's centre: its houses, most of them, and its church or market. */
function harbourCentre(plan: TownPlan) {
  const { harbour, houses, rules, W, design } = plan;
  if (!harbour || houses.length < 3) return;
  const away = (p: Point) => Math.hypot(p[0] - harbour[0], p[1] - harbour[1]);
  const town = houses.filter((h) => !rules.types.outliers.includes(h.prop.type));
  const mass: Point = [
    town.reduce((s, h) => s + h.at[0], 0) / town.length,
    town.reduce((s, h) => s + h.at[1], 0) / town.length,
  ];
  const { centre, share, shareReach, civic } = rules.harbour;
  if (away(mass) > centre * W)
    plan.report(
      'harbour',
      'warn',
      `The houses' centre is ${inW(plan, away(mass))} from the harbour (within ${centre}W)`,
      { at: mass },
    );
  const near = town.filter((h) => away(h.at) <= shareReach * W).length / town.length;
  if (near < share)
    plan.report(
      'harbour',
      'warn',
      `${Math.round(near * 100)}% of the houses within ${shareReach}W of the harbour (at least ${Math.round(share * 100)}%)`,
      { at: harbour },
    );
  const civics = design.props.filter((p) => lasting(p) && rules.types.civic.includes(p.type));
  if (!civics.length) return;
  const first = civics.reduce((a, b) => (away([a.x, a.z]) <= away([b.x, b.z]) ? a : b));
  if (away([first.x, first.z]) > civic * W)
    plan.report(
      'harbour',
      'warn',
      `${named(first)} is ${inW(plan, away([first.x, first.z]))} from the harbour (a church or market within ${civic}W)`,
      {
        prop: design.props.indexOf(first),
        at: [first.x, first.z],
      },
    );
}
