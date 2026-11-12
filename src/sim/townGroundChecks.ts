import type { PropDef } from '../data/islands';
import { coastDistance } from './coast';
import {
  type House,
  type Point,
  type TownPlan,
  angleBetween,
  groundAt,
  lasting,
  lineAngle,
  named,
  nearestOn,
  slopeAt,
  waterAt,
} from './townPlan';

/**
 * The town checks of what lies round the houses (issue #513): lanes, piers, fields, woods, the
 * civic buildings' ground and a fire island's hazards. `townChecks.ts` runs them after the houses.
 */
export function checkTownGround(plan: TownPlan) {
  plan.design.lanes.forEach((lane, i) => {
    if (lane.kind !== 'stairs' && lane.y === undefined) laneShape(plan, i);
  });
  waterfront(plan);
  piers(plan);
  civicGround(plan);
  fields(plan);
  woods(plan);
  hazards(plan);
}

const inW = (plan: TownPlan, d: number) => `${(d / plan.W).toFixed(Math.abs(d) < plan.W ? 2 : 1)}W`;
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const at = (p: PropDef): Point => [p.x, p.z];

/** Pieces of a lane about half a house long: their middles and their way. */
function lanePieces(plan: TownPlan, line: Point[]) {
  const pieces: { mid: Point; way: Point; a: Point; b: Point }[] = [];
  for (let k = 1; k < line.length; k++) {
    const a = line[k - 1]!,
      b = line[k]!;
    const n = Math.max(1, Math.ceil(dist(a, b) / (plan.W / 2)));
    for (let t = 0; t < n; t++) {
      const p: Point = [a[0] + ((b[0] - a[0]) * t) / n, a[1] + ((b[1] - a[1]) * t) / n];
      const q: Point = [a[0] + ((b[0] - a[0]) * (t + 1)) / n, a[1] + ((b[1] - a[1]) * (t + 1)) / n];
      pieces.push({
        mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2],
        way: [b[0] - a[0], b[1] - a[1]],
        a: p,
        b: q,
      });
    }
  }
  return pieces;
}

/** A lane follows the shore or the contour, climbs gently and ends somewhere. */
function laneShape(plan: TownPlan, i: number) {
  const { rules, W } = plan;
  const line = plan.lanes[i]!;
  if (line.length < 2) return;
  const name = plan.design.lanes[i]!.kind === 'path' ? 'Path' : 'Lane';
  let off = 0,
    steepest = 0,
    steepAt = line[0]!;
  const pieces = lanePieces(plan, line);
  for (const piece of pieces) {
    const ground = slopeAt(plan, piece.mid[0], piece.mid[1], W / 2);
    // Along a piece the climb is the slope's share in its way.
    const along = Math.abs(Math.cos((angleBetween(piece.way, ground.down) * Math.PI) / 180));
    const climb = (Math.atan(Math.tan((ground.deg * Math.PI) / 180) * along) * 180) / Math.PI;
    if (climb > steepest) [steepest, steepAt] = [climb, piece.mid];
    if (ground.deg < rules.lanes.flat) continue;
    const contour: Point = [-ground.down[1], ground.down[0]];
    const shore = waterAt(plan, piece.mid[0], piece.mid[1]).way;
    const follows =
      lineAngle(piece.way, contour) <= rules.lanes.turn ||
      lineAngle(piece.way, [-shore[1], shore[0]]) <= rules.lanes.turn;
    if (!follows) off++;
  }
  const extra = { at: line[0] };
  if (off / pieces.length > rules.lanes.offShare)
    plan.report(
      'lanes',
      'warn',
      `${name} ${i}: ${Math.round((off / pieces.length) * 100)}% runs across the slope, not along the shore or the contour (within ${rules.lanes.turn}°)`,
      extra,
    );
  if (steepest > rules.lanes.slope)
    plan.report(
      'lanes',
      'warn',
      `${name} ${i} climbs ${steepest.toFixed(0)}° (over ${rules.lanes.slope}°: stairs)`,
      { at: steepAt },
    );
  for (const end of [line[0]!, line.at(-1)!])
    if (!laneEndOk(plan, i, end))
      plan.report(
        'lanes',
        'warn',
        `${name} ${i} ends at nothing (${end[0].toFixed(2)}, ${end[1].toFixed(2)}): a house, pier, lane or well within ${rules.lanes.endReach}W`,
        { at: end },
      );
}

function laneEndOk(plan: TownPlan, i: number, end: Point) {
  const { kit, rules, W, design } = plan;
  const reach = rules.lanes.endReach * W;
  const prop = design.props.some(
    (p) =>
      lasting(p) &&
      (kit.types[p.type]?.building || rules.types.laneEnds.includes(p.type)) &&
      dist(at(p), end) - (p.fit ?? kit.fit(p)) <= reach,
  );
  return (
    prop ||
    plan.piers.some((pier) => nearestOn(end, pier).distance <= reach) ||
    plan.lanes.some((l, k) => k !== i && l.length > 1 && nearestOn(end, l).distance <= reach) ||
    waterAt(plan, end[0], end[1]).depth <= reach
  );
}

/** A port has a lane along its waterfront, by the harbour. */
function waterfront(plan: TownPlan) {
  const { harbour, rules, W } = plan;
  const lanes = plan.lanes.filter(
    (l, i) => l.length > 1 && plan.design.lanes[i]!.kind !== 'stairs',
  );
  if (!harbour || !lanes.length) return;
  const [near, far] = rules.lanes.shore;
  const found = lanes.some((l) =>
    lanePieces(plan, l).some(({ mid }) => {
      const depth = waterAt(plan, mid[0], mid[1]).depth;
      return dist(mid, harbour) <= rules.harbour.core * W && depth >= near * W && depth <= far * W;
    }),
  );
  if (!found)
    plan.report(
      'lanes',
      'warn',
      `No lane along the waterfront: one ${near}W to ${far}W from the water by the harbour`,
      { at: harbour },
    );
}

/** Piers start at the shore and run out square to it. */
function piers(plan: TownPlan) {
  const { rules, W } = plan;
  plan.piers.forEach(([root, tip], i) => {
    const water = waterAt(plan, root[0], root[1]);
    const arrival = !!plan.harbour && i === 0;
    const what = arrival ? 'The arrival pier' : `Pier ${plan.harbour ? i - 1 : i}`;
    // The arrival pier's root is the sim's (decision 0110): only its squareness is the file's.
    if (!arrival && Math.abs(water.depth) > rules.piers.shore * W)
      plan.report(
        'piers',
        'warn',
        `${what} starts ${inW(plan, Math.abs(water.depth))} ${water.depth > 0 ? 'inland' : 'out at sea'} (within ${rules.piers.shore}W of the shore)`,
        { at: root },
      );
    const off = angleBetween([tip[0] - root[0], tip[1] - root[1]], water.way);
    if (off > rules.piers.square)
      plan.report(
        'piers',
        'warn',
        `${what} runs ${off.toFixed(0)}° off square to the shore (within ${rules.piers.square}°)`,
        { at: root },
      );
  });
}

/** Churches may stand on a rise; the other civic buildings keep the houses' flat ground. */
function civicGround(plan: TownPlan) {
  const { rules, style, kit, design } = plan;
  design.props.forEach((p, i) => {
    if (!lasting(p) || !rules.types.civic.includes(p.type)) return;
    const limit = rules.types.churches.includes(p.type) ? rules.houses.civicSlope : style.slope[0];
    const { deg } = slopeAt(plan, p.x, p.z, p.fit ?? kit.fit(p));
    if (deg > limit)
      plan.report(
        'slope',
        'warn',
        `${named(p)} stands on ${deg.toFixed(0)}° ground (warn ${limit}°)`,
        { prop: i, at: at(p) },
      );
  });
}

/** The nearest house to a point and its gap. */
function nearestHouse(plan: TownPlan, p: Point, fit = 0) {
  let best: { house: House; gap: number } | null = null;
  for (const house of plan.houses) {
    const gap = dist(p, house.at) - house.fit - fit;
    if (!best || gap < best.gap) best = { house, gap };
  }
  return best!;
}

/** Whether a point lies in front of a house, on its way to the water. */
function seaward(plan: TownPlan, house: House, p: Point) {
  const water = waterAt(plan, house.at[0], house.at[1]);
  return (
    angleBetween([p[0] - house.at[0], p[1] - house.at[1]], water.way) < 45 &&
    waterAt(plan, p[0], p[1]).depth < water.depth
  );
}

/** Fields and orchards on gentle ground near the houses, never in front of them or on a lane. */
function fields(plan: TownPlan) {
  const { rules, style, kit, design, W } = plan;
  design.props.forEach((p, i) => {
    if (!lasting(p) || !rules.types.fields.includes(p.type)) return;
    const extra = { prop: i, at: at(p) };
    const fit = p.fit ?? kit.fit(p);
    if (style.fields === 'no') {
      plan.report('fields', 'warn', `${named(p)}: no fields on ${design.style} islands`, extra);
      return;
    }
    const { deg } = slopeAt(plan, p.x, p.z, fit);
    if (deg > rules.fields.slope)
      plan.report(
        'fields',
        'warn',
        `${named(p)} lies on ${deg.toFixed(0)}° ground (under ${rules.fields.slope}°)`,
        extra,
      );
    const { house, gap } = nearestHouse(plan, at(p), fit);
    const [near, far] = rules.fields.near;
    if (gap < near * W || gap > far * W)
      plan.report(
        'fields',
        'warn',
        `${named(p)} is ${inW(plan, Math.max(0, gap))} from a house (${near}W to ${far}W)`,
        extra,
      );
    if (seaward(plan, house, at(p)))
      plan.report(
        'fields',
        'warn',
        `${named(p)} lies between ${named(house.prop)} and the water`,
        extra,
      );
    if (plan.lanes.some((l) => l.length > 1 && nearestOn(at(p), l).distance < fit))
      plan.report('fields', 'warn', `${named(p)} lies on a lane`, extra);
  });
}

/** Woods on slopes or the back of the island, clear of the houses and their water side. */
function woods(plan: TownPlan) {
  const { rules, style, W, harbour, houses } = plan;
  const trees = plan.kit.trees?.() ?? [];
  if (!trees.length) return;
  const centre: Point = harbour ?? [
    houses.reduce((s, h) => s + h.at[0], 0) / houses.length,
    houses.reduce((s, h) => s + h.at[1], 0) / houses.length,
  ];
  const found = { close: [] as Point[], flat: [] as Point[], front: [] as Point[] };
  for (const tree of trees) {
    const { house, gap } = nearestHouse(plan, tree);
    if (gap < rules.woods.houseGap * W) found.close.push(tree);
    else if (gap < style.lonely * W && seaward(plan, house, tree)) found.front.push(tree);
    else if (
      dist(tree, centre) <= rules.harbour.shareReach * W &&
      slopeAt(plan, tree[0], tree[1], W / 2).deg < rules.woods.slope
    )
      found.flat.push(tree);
  }
  const say = (list: Point[], what: string) => {
    if (list.length) plan.report('woods', 'warn', `${list.length} trees ${what}`, { at: list[0] });
  };
  say(found.close, `within ${rules.woods.houseGap}W of a house`);
  say(found.front, 'between the houses and the water');
  say(
    found.flat,
    `on the town's flat ground (woods want slopes over ${rules.woods.slope}° or the back)`,
  );
}

/** On a fire island, houses keep clear of lava, ash and the volcano's cone. */
function hazards(plan: TownPlan) {
  const { style, design, W } = plan;
  if (!style.hazardGap) return;
  const keep = style.hazardGap * W;
  const cones = design.ground.filter((g) => g.shape === 'peak' && g.crater && g.outline?.length);
  const lava = (design.rivers ?? [])
    .filter((r) => r.kind === 'lava')
    .map((r) => r.points.map(([x, z]): Point => [x!, z!]));
  for (const h of plan.houses) {
    let near = Infinity;
    let what = '';
    const closer = (d: number, name: string) => {
      if (d < near) [near, what] = [d, name];
    };
    for (const cone of cones)
      closer(coastDistance(h.at[0], h.at[1], cone.outline!).distance, 'the cone');
    for (const river of lava) closer(nearestOn(h.at, river).distance, 'a lava river');
    const step = W / 4;
    for (let dx = -keep; dx <= keep; dx += step)
      for (let dz = -keep; dz <= keep; dz += step) {
        const d = Math.hypot(dx, dz);
        if (d >= near || d > keep) continue;
        const ground = groundAt(plan, h.at[0] + dx, h.at[1] + dz);
        if (style.avoid.includes(ground)) closer(d, ground);
      }
    near -= h.fit;
    if (near < keep)
      plan.report(
        'hazard',
        'warn',
        `${named(h.prop)} is ${inW(plan, Math.max(0, near))} from ${what} (keep ${style.hazardGap}W)`,
        { prop: h.index, at: h.at },
      );
  }
}
