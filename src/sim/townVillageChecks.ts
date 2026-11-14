import { lanePieces } from './townGroundChecks';
import {
  type House,
  type Point,
  type TownPlan,
  angleBetween,
  hullGap,
  inW,
  lasting,
  lineAngle,
  named,
  nearestOn,
} from './townPlan';

/**
 * What tells a village from a grid (issue #528, art bible §12): the houses' fronts spread over
 * many angles, no long straight row of alike houses at even gaps, no long straight or parallel
 * lanes, and a centre that lanes reach from several sides. Rows and a town turned all one way
 * can fail; the rest warns, since a check is the wrong judge of a look (the sheets are).
 */
export function checkVillage(plan: TownPlan) {
  const village = plan.houses.length >= plan.rules.village.houses;
  if (village) {
    turnSpread(plan);
    rows(plan, houseGaps());
    centre(plan);
  }
  plan.lanes.forEach((line, i) => {
    if (line.length > 1 && plan.design.lanes[i]!.kind !== 'stairs') straightRun(plan, i);
  });
  parallelLanes(plan);
}

/** Gaps between houses' footprints, each pair measured once. */
type Gaps = (a: House, b: House) => number;
function houseGaps(): Gaps {
  const known = new Map<string, number>();
  return (a, b) => {
    const key = a.index < b.index ? `${a.index}:${b.index}` : `${b.index}:${a.index}`;
    let gap = known.get(key);
    if (gap === undefined) known.set(key, (gap = hullGap(a.hull, b.hull)));
    return gap;
  };
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
/** A front's way folded to 0..90°: a house turned a right angle stands on the same grid. */
const gridAngle = (front: Point) => {
  const deg = (Math.atan2(front[0], front[1]) * 180) / Math.PI;
  return ((deg % 90) + 90) % 90;
};

/** The houses' fronts over the town, folded to one grid: the spread that holds 80% of them. */
export function frontSpread(houses: readonly House[]): number {
  if (houses.length < 2) return 90;
  // The grid's main way: the mean of the folded angles taken round a circle (×4 unfolds them).
  const quarter = houses.map((h) => (gridAngle(h.front) * 4 * Math.PI) / 180);
  const main =
    (Math.atan2(
      quarter.reduce((s, a) => s + Math.sin(a), 0),
      quarter.reduce((s, a) => s + Math.cos(a), 0),
    ) *
      180) /
    Math.PI /
    4;
  const offs = houses
    .map((h) => ((((gridAngle(h.front) - main + 45) % 90) + 90) % 90) - 45)
    .sort((a, b) => a - b);
  const at = (q: number) => offs[Math.min(offs.length - 1, Math.round(q * (offs.length - 1)))]!;
  return at(0.9) - at(0.1);
}

/** A town turned all one way (or on one square grid) is no village. */
function turnSpread(plan: TownPlan) {
  const spread = frontSpread(plan.houses);
  const [warn, fail] = plan.rules.village.spread;
  const grade = spread < fail ? 'fail' : spread < warn ? 'warn' : null;
  if (grade)
    plan.report(
      'grid',
      grade,
      `The houses turn within ${spread.toFixed(0)}° of one square grid (a village spreads ${warn}° or more; fail under ${fail}°)`,
      { at: plan.harbour ?? plan.houses[0]!.at },
    );
}

/**
 * The longest straight, evenly spaced run of alike-turned houses starting with `a` then `b`:
 * each next house the nearest ahead within the row's gap, turned like `a`, on the line a→b.
 */
function rowFrom(plan: TownPlan, gap: Gaps, a: House, b: House): House[] {
  const { rowTurn, rowLine, rowGap, evenGap } = plan.rules.village;
  const W = plan.W;
  const way = sub(b.at, a.at);
  const len = Math.hypot(...way);
  const unit: Point = [way[0] / len, way[1] / len];
  const row = [a, b];
  const along = (h: House) => (h.at[0] - a.at[0]) * unit[0] + (h.at[1] - a.at[1]) * unit[1];
  const off = (h: House) => Math.abs((h.at[0] - a.at[0]) * unit[1] - (h.at[1] - a.at[1]) * unit[0]);
  let step = len;
  for (;;) {
    const last = row.at(-1)!;
    let next: House | null = null;
    for (const h of plan.houses) {
      if (row.includes(h) || along(h) <= along(last)) continue;
      if (lineAngle(h.front, a.front) > rowTurn || off(h) > rowLine * W) continue;
      if (gap(h, last) > rowGap * W) continue;
      if (!next || dist(h.at, last.at) < dist(next.at, last.at)) next = h;
    }
    if (!next) return row;
    const d = dist(next.at, last.at);
    if (Math.abs(d - step) > evenGap * step) return row;
    row.push(next);
    step = d;
  }
}

/** Straight rows of alike houses at even gaps: the mark of a grid. Each row is told once. */
function rows(plan: TownPlan, gap: Gaps) {
  const { houses, W } = plan;
  const {
    row: [warn, fail],
    rowTurn,
    rowGap,
  } = plan.rules.village;
  const found: House[][] = [];
  for (const a of houses)
    for (const b of houses) {
      if (a === b || lineAngle(a.front, b.front) > rowTurn || gap(a, b) > rowGap * W) continue;
      const row = rowFrom(plan, gap, a, b);
      if (row.length < warn) continue;
      // A row seen again from a later pair: keep the longer one.
      const same = found.findIndex((r) => r.filter((h) => row.includes(h)).length >= 2);
      if (same < 0) found.push(row);
      else if (row.length > found[same]!.length) found[same] = row;
    }
  for (const row of found)
    plan.report(
      'grid',
      row.length >= fail ? 'fail' : 'warn',
      `${row.length} houses in a straight row at even gaps, turned alike, from ${named(row[0]!.prop)} to ${named(row.at(-1)!.prop)} (a row of ${warn} warns, ${fail} fails)`,
      { prop: row[0]!.index, at: row[0]!.at },
    );
}

/** The village's centre: the civic building nearest the harbour, else the harbour, else the middle. */
export function villageCentre(plan: TownPlan): Point {
  const { design, rules, harbour, houses, W } = plan;
  const middle: Point = [
    houses.reduce((s, h) => s + h.at[0], 0) / houses.length,
    houses.reduce((s, h) => s + h.at[1], 0) / houses.length,
  ];
  const from = harbour ?? middle;
  const civic = design.props
    .filter((p) => lasting(p) && rules.types.civic.includes(p.type))
    .map((p): Point => [p.x, p.z])
    .sort((a, b) => dist(a, from) - dist(b, from))[0];
  return civic && dist(civic, from) <= rules.harbour.civic * W ? civic : from;
}

/** The ways lanes leave the centre: one per end of each lane that passes close by. */
function centreArms(plan: TownPlan, at: Point): Point[] {
  const reach = plan.rules.village.centreReach * plan.W;
  const arms: Point[] = [];
  for (const line of plan.lanes) {
    if (line.length < 2 || nearestOn(at, line).distance > reach) continue;
    // Walk both ways from the point nearest the centre; an arm is where the lane leaves the reach.
    const near = line.reduce((k, p, i) => (dist(p, at) < dist(line[k]!, at) ? i : k), 0);
    for (const dir of [-1, 1]) {
      for (let i = near; i >= 0 && i < line.length; i += dir)
        if (dist(line[i]!, at) > reach) {
          arms.push(sub(line[i]!, at));
          break;
        }
    }
  }
  return arms;
}

/** Lanes reach the centre from several sides, as the streets of a village meet at its square. */
function centre(plan: TownPlan) {
  const { centreLanes, centreApart } = plan.rules.village;
  const at = villageCentre(plan);
  const sides: Point[] = [];
  for (const arm of centreArms(plan, at))
    if (sides.every((s) => angleBetween(s, arm) >= centreApart)) sides.push(arm);
  if (sides.length < centreLanes)
    plan.report(
      'centre',
      'warn',
      `${sides.length} lane${sides.length === 1 ? '' : 's'} reach the centre (${at[0].toFixed(2)}, ${at[1].toFixed(2)}) from different sides (at least ${centreLanes}, ${centreApart}° apart)`,
      { at },
    );
}

/** The longest straight run of a lane: points that all stay within `bow` of its chord. */
export function longestStraight(line: readonly Point[], bow: number): number {
  let best = 0;
  for (let s = 0; s < line.length - 1; s++)
    for (let e = s + 1; e < line.length; e++) {
      const chord = [line[s]!, line[e]!];
      if (line.slice(s + 1, e).some((p) => nearestOn(p, chord).distance > bow)) break;
      best = Math.max(best, dist(line[s]!, line[e]!));
    }
  return best;
}

/** A village lane bends: no straight run longer than about six houses. */
function straightRun(plan: TownPlan, i: number) {
  const { straight, bow } = plan.rules.lanes;
  const line = plan.lanes[i]!;
  const run = longestStraight(line, bow * plan.W);
  if (run > straight * plan.W)
    plan.report(
      'lanes',
      'warn',
      `${plan.design.lanes[i]!.kind === 'path' ? 'Path' : 'Lane'} ${i} runs straight for ${inW(plan, run)} (a village lane bends within ${straight}W)`,
      { at: line[0] },
    );
}

/** No two lanes side by side going the same way: parallel streets make a grid. */
function parallelLanes(plan: TownPlan) {
  const { parallel, parallelGap, parallelRun } = plan.rules.lanes;
  const { W } = plan;
  const lanes = plan.lanes.map((line, i) =>
    line.length > 1 && plan.design.lanes[i]!.kind !== 'stairs' ? line : null,
  );
  lanes.forEach((a, i) => {
    if (!a) return;
    lanes.forEach((b, j) => {
      if (!b || j <= i) return;
      let run = 0;
      for (const piece of lanePieces(plan, a)) {
        const near = nearestOn(piece.mid, b);
        if (near.distance > parallelGap * W || near.distance < 1e-6) continue;
        // Ends do not count: a lane that stops beside another meets it, it does not run along it.
        if (dist(near.at, b[0]!) < 1e-6 || dist(near.at, b.at(-1)!) < 1e-6) continue;
        const k = segmentAt(b, near.at);
        if (lineAngle(piece.way, sub(b[k + 1]!, b[k]!)) <= parallel) run += dist(piece.a, piece.b);
      }
      if (run >= parallelRun * W)
        plan.report(
          'lanes',
          'warn',
          `Lanes ${i} and ${j} run side by side for ${inW(plan, run)} (parallel within ${parallel}°, ${parallelGap}W apart; at most ${parallelRun}W)`,
          { at: a[0] },
        );
    });
  });
}

/** Index of the segment of a polyline a point on it lies on. */
function segmentAt(line: readonly Point[], p: Point): number {
  let best = 0;
  let gap = Infinity;
  for (let k = 0; k < line.length - 1; k++) {
    const d = nearestOn(p, [line[k]!, line[k + 1]!]).distance;
    if (d < gap) [best, gap] = [k, d];
  }
  return best;
}
