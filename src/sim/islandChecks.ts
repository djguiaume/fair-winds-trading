import { MAX_SETTLEMENT_LEVEL, SETTLEMENT_LEVELS } from './settlement';
import { coastDistance } from './coast';
import {
  cliffDistance,
  crossesCliff,
  islandLayout,
  layoutGround,
  slopeDistance,
  surfaceHeight,
  type Outline,
} from './islandLayout';
import { atLevel, type IslandDesign, type PropDef, questApart } from '../data/islands';
import { GROUNDS, STYLES, groundId } from '../data/grounds';
import { checkCoast } from './coastChecks';
import { checkSculpt } from './sculptChecks';

/**
 * Island file checks (decision 0096 §2, built in 0101), shared by the island builder and
 * tests/island-files.test.ts, as mapChecks.ts is for maps. Errors make a file unfit to ship;
 * warnings are worth a look. Everything here is in island-radius units.
 */
export interface IslandIssue {
  severity: 'error' | 'warning';
  check: string;
  message: string;
  /** Where to mark it on the island. */
  at?: [number, number];
  /** Index in `design.props`, when it is about a prop. */
  prop?: number;
  level?: number;
}

/** What the checks need to know about prop types and models, which live in the renderer. */
export interface IslandCheckKit {
  /** The island's radius in reference units (the models' unit). */
  R: number;
  types: Record<string, { home?: boolean; building?: boolean; water?: boolean; edge?: boolean }>;
  woodlandTrees: string[];
  /** A prop's footprint radius. */
  fit: (prop: PropDef) => number;
  /** A building's plan outline in radius units, for the overlap check. */
  footprint?: (prop: PropDef) => Outline;
  /** Triangles of the whole island at a level. */
  triangles?: (level: number) => number;
  /** False for an island with no harbour (decision 0110): no approach to keep clear. */
  harbour?: boolean;
}

export const TRIANGLE_BUDGET = 6000;
export const TRIANGLE_WARNING = 5000;
const LEVELS = SETTLEMENT_LEVELS;
const TOP = MAX_SETTLEMENT_LEVEL;
/** The arrival pier's lane, kept for the player's ship (the pier sits at x 0.08). */
const APPROACH = { x: 0.08, halfWidth: 0.12, z: 0.45 };
/** Overlap tolerance of the old town plan, in reference units. */
const TOUCH = 0.03;

const isLevel = (v: unknown) => typeof v === 'number' && LEVELS.includes(v);
const inside = (x: number, z: number, o: Outline) => coastDistance(x, z, o).distance < 1e-6;

export function checkIsland(design: IslandDesign, kit: IslandCheckKit): IslandIssue[] {
  const issues: IslandIssue[] = [];
  const error = (check: string, message: string, extra: Partial<IslandIssue> = {}) =>
    issues.push({ severity: 'error', check, message, ...extra });
  const warn = (check: string, message: string, extra: Partial<IslandIssue> = {}) =>
    issues.push({ severity: 'warning', check, message, ...extra });

  // Known types, kinds and levels.
  // A prop `from: 0` stands on an empty island before it is founded too (decision 0157).
  const levelsOk = (e: { from?: number; to?: number }, what: string, extra = {}, zero = false) => {
    if (e.from !== undefined && !isLevel(e.from) && !(zero && e.from === 0))
      error('levels', `${what}: "from" must be ${zero ? 0 : 1} to ${TOP}`, extra);
    else if (e.to !== undefined && !isLevel(e.to))
      error('levels', `${what}: "to" must be 1 to ${TOP}`, extra);
    else if ((e.from ?? 1) > (e.to ?? TOP)) error('levels', `${what}: "from" is after "to"`, extra);
    else return true;
    return false;
  };
  design.props.forEach((p, i) => {
    const extra = { prop: i, at: [p.x, p.z] as [number, number] };
    if (!kit.types[p.type]) error('known', `Unknown prop type "${p.type}"`, extra);
    if (p.from === undefined) error('levels', `${p.type}: no "from" level`, extra);
    levelsOk(p, p.type, extra, true);
  });
  // Styles and grounds are data (decision 0168): palette.json › styles and › grounds.
  if (!STYLES[design.style]) error('known', `Unknown style "${String(design.style)}"`);
  const knownGround = (m: string) => !!GROUNDS[m] && !!GROUNDS[groundId(m, design.style)];
  design.ground.forEach((g, i) => {
    if (!knownGround(g.material))
      error('known', `Ground ${i}: unknown material "${String(g.material)}"`);
    if (g.coast !== undefined ? !design.coasts[g.coast] : !g.outline?.length)
      error('known', `Ground ${i}: needs an outline or a coast that exists`);
    if (g.crater !== undefined && (g.shape !== 'peak' || !(g.crater >= 0.05 && g.crater <= 0.8)))
      error('known', `Ground ${i}: a crater is for a mountain, 0.05 to 0.8 of its size`);
    levelsOk(g, `Ground ${i}`);
  });
  design.lanes.forEach((l, i) => {
    if (l.kind && !['lane', 'path', 'stairs'].includes(l.kind))
      error('known', `Lane ${i}: unknown kind "${l.kind}"`);
    if (l.points.length < 2) error('known', `Lane ${i}: needs two points or more`);
    if (l.kind === 'stairs' && l.points.some((p) => p.length !== 3))
      error('known', `Stairs ${i}: every point needs x, z and a height`);
  });
  (design.ramps ?? []).forEach((r, i) => {
    if (!knownGround(r.material))
      error('known', `Ramp ${i}: unknown material "${String(r.material)}"`);
    if (r.points.length < 2) error('known', `Ramp ${i}: needs two points or more`);
    if (!(r.width > 0)) error('known', `Ramp ${i}: needs a width`);
    levelsOk(r, `Ramp ${i}`);
  });
  (design.rivers ?? []).forEach((r, i) => {
    if (r.kind && r.kind !== 'water' && r.kind !== 'lava')
      error('known', `River ${i}: unknown kind "${String(r.kind)}"`);
    if (r.points.length < 2) error('known', `River ${i}: needs two points or more`);
    if (!(r.width > 0)) error('known', `River ${i}: needs a width`);
    r.points.forEach((p, k) => {
      if (p.length > 2 && !(p[2]! > 0))
        error('known', `River ${i}: point ${k}'s width must be above 0`);
    });
    levelsOk(r, `River ${i}`);
  });
  design.piers.forEach((p, i) => {
    if (!isLevel(p.from)) error('levels', `Pier ${i}: "from" must be 1 to ${TOP}`);
  });
  if (!kit.woodlandTrees.includes(design.woods.tree))
    error('known', `Unknown woods tree "${design.woods.tree}"`);
  // Hand sculpting (decision 0230): edits that replay, buildings still level.
  issues.push(...checkSculpt(design, kit));
  if (issues.some((i) => i.severity === 'error')) return issues;

  // Raised ground and the lake inside the coast.
  const main = design.coasts[0]!;
  for (const level of LEVELS) {
    const layout = islandLayout(design, level);
    layout.surfaces.forEach((s, i) => {
      const out = s.outline.find(([x, z]) => !layout.coasts.some((c) => inside(x, z, c)));
      if (out) error('ground', `Raised ground ${i} reaches past the coast`, { at: out, level });
    });
  }
  // A river rises on land (decision 0176); only its mouth may reach past the coast.
  (design.rivers ?? []).forEach((r, i) => {
    const [x, z] = r.points[0] as [number, number];
    if (!design.coasts.some((c) => inside(x, z, c)))
      error('ground', `River ${i} rises at sea: its first point must be on the island`, {
        at: [x, z],
      });
    const layout = islandLayout(design, r.from ?? 1);
    for (let k = 1; k < r.points.length; k++) {
      const [ax, az] = r.points[k - 1] as [number, number],
        [bx, bz] = r.points[k] as [number, number];
      const ha = surfaceHeight(layout, ax, az),
        hb = surfaceHeight(layout, bx, bz);
      if (ha !== null && hb !== null && hb > ha + 0.02)
        warn('ground', `River ${i} runs uphill between points ${k} and ${k + 1}`, { at: [bx, bz] });
    }
  });
  (design.ramps ?? []).forEach((r, i) => {
    const out = r.points.find(([x, z]) => !design.coasts.some((c) => inside(x, z, c)));
    if (out) error('ground', `Ramp ${i} reaches past the coast`, { at: out });
  });
  if (design.lake) {
    const out = design.lake.find(([x, z]) => coastDistance(x, z, main).distance > -0.02);
    if (out) error('ground', 'The lake reaches the coast', { at: out });
  }

  // Props on their ground, out of the water, the approach and the piers, at every level.
  const reported = new Set<string>();
  const once = (key: string, report: () => void) => {
    if (!reported.has(key)) {
      reported.add(key);
      report();
    }
  };
  for (const level of LEVELS) {
    const layout = islandLayout(design, level);
    const piers = design.piers.filter((p) => p.from <= level);
    design.props.forEach((p, i) => {
      if (!atLevel(p, level)) return;
      const type = kit.types[p.type]!;
      const fit = p.fit ?? kit.fit(p);
      const at: [number, number] = [p.x, p.z];
      const extra = { prop: i, at, level };
      const name = `${p.type} (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`;
      if (type.water) {
        if (layout.coasts.some((c) => coastDistance(p.x, p.z, c).distance < fit))
          once(`water${i}`, () =>
            error('water', `${name} must be in the sea, clear of the shore`, extra),
          );
      } else {
        // On raised ground the whole footprint must fit one level; on the sand, its centre.
        const ground = layoutGround(layout, p.x, p.z, 0);
        const land = Math.max(...layout.coasts.map((c) => -coastDistance(p.x, p.z, c).distance));
        if (land < (ground === null || type.edge ? 0 : fit))
          once(`land${i}`, () =>
            error('land', `${name} is not on land (needs ${fit.toFixed(3)} from the shore)`, extra),
          );
        else if (layout.lake && coastDistance(p.x, p.z, layout.lake).distance < fit)
          once(`lake${i}`, () => error('land', `${name} is in the lake`, extra));
        else if (type.building && slopeDistance(layout, p.x, p.z) < fit)
          once(`slope${i}`, () =>
            error('slope', `${name} is a building on a slope: it needs flat ground`, extra),
          );
        else if (ground !== null && p.y === undefined && !type.edge) {
          const edge = cliffDistance(layout, p.x, p.z);
          if (edge < fit)
            once(`cliff${i}`, () =>
              error(
                'cliff',
                `${name} is on a cliff edge: move it ${(fit - edge).toFixed(3)}`,
                extra,
              ),
            );
        }
      }
      // The lane up from the arrival pier, as the old town plan kept it.
      if (
        kit.harbour !== false &&
        Math.abs(p.x - APPROACH.x) < APPROACH.halfWidth &&
        p.z > APPROACH.z
      )
        once(`approach${i}`, () => error('approach', `${name} is in the harbour approach`, extra));
      // Side piers, where they stand over the water.
      for (const pier of piers)
        for (let t = 0; t <= 1; t += 0.1) {
          const z = pier.z + pier.length * t;
          if (layout.coasts.some((c) => inside(pier.x, z, c))) continue;
          if (Math.hypot(p.x - pier.x, p.z - z) < fit + 0.03)
            once(`pier${i}`, () => error('pier', `${name} is on a pier`, extra));
        }
    });

    // Buildings do not overlap.
    if (kit.footprint) {
      const buildings = design.props
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => atLevel(p, level) && kit.types[p.type]!.building);
      const outlines = buildings.map(({ p }) => kit.footprint!(p));
      for (let a = 0; a < buildings.length; a++)
        for (let b = a + 1; b < buildings.length; b++)
          // A prop before a quest and its replacement after it never stand together (0130).
          if (
            !questApart(buildings[a]!.p, buildings[b]!.p) &&
            overlaps(outlines[a]!, outlines[b]!, TOUCH / kit.R)
          )
            once(`overlap${buildings[a]!.i}/${buildings[b]!.i}`, () =>
              warn('overlap', `${buildings[a]!.p.type} and ${buildings[b]!.p.type} overlap`, {
                prop: buildings[b]!.i,
                at: [buildings[b]!.p.x, buildings[b]!.p.z],
                level,
              }),
            );
    }

    // Lane pieces (and a path's along the ground) over water or a cliff are not drawn.
    design.lanes.forEach((lane, i) => {
      if (lane.kind === 'stairs' || (lane.kind === 'path' && lane.y !== undefined)) return;
      const name = lane.kind === 'path' ? 'Path' : 'Lane';
      let broken = 0,
        first: [number, number] | undefined;
      for (let k = 1; k < lane.points.length; k++) {
        const [ax, az] = lane.points[k - 1]!,
          [bx, bz] = lane.points[k]!;
        for (let t = 0; t < 10; t++) {
          const x0 = ax! + ((bx! - ax!) * t) / 10,
            z0 = az! + ((bz! - az!) * t) / 10,
            x1 = ax! + ((bx! - ax!) * (t + 1)) / 10,
            z1 = az! + ((bz! - az!) * (t + 1)) / 10;
          const h0 = layoutGround(layout, x0, z0, 0.025),
            h1 = layoutGround(layout, x1, z1, 0.025);
          // Slopes are climbed; a cliff needs stairs.
          if (h0 === null || h1 === null || (h0 !== h1 && crossesCliff(layout, x0, z0, x1, z1))) {
            broken++;
            first ??= [x0, z0];
          }
        }
      }
      if (broken && level === TOP)
        warn(
          'lanes',
          `${name} ${i}: ${broken} pieces cross water or a cliff and are not drawn (a cliff needs stairs or a slope)`,
          {
            at: first,
          },
        );
    });
  }

  // Each level only adds: homes stay; a removed prop is replaced where it stood.
  design.props.forEach((p, i) => {
    if (p.to === undefined || p.to === TOP) return;
    const extra = { prop: i, at: [p.x, p.z] as [number, number], level: p.to + 1 };
    if (kit.types[p.type]?.home && !p.tags?.includes('outbuilding'))
      error('growth', `A home (${p.type}) is removed after level ${p.to}`, extra);
    else if (
      !design.props.some(
        (q) => q !== p && atLevel(q, p.to! + 1) && Math.hypot(q.x - p.x, q.z - p.z) < 0.02,
      )
    )
      warn('growth', `${p.type} goes after level ${p.to} with nothing in its place`, extra);
  });

  // Old phones: triangles at the top level.
  if (kit.triangles) {
    const triangles = kit.triangles(TOP);
    if (triangles > TRIANGLE_BUDGET)
      error('budget', `${triangles} triangles at level ${TOP}, over the ${TRIANGLE_BUDGET} budget`);
    else if (triangles > TRIANGLE_WARNING)
      warn('budget', `${triangles} triangles at level ${TOP} (budget ${TRIANGLE_BUDGET})`);
  }

  // The drawn ground against the sailed coast and the buildings' footing (decision 0237).
  if (!issues.some((i) => i.severity === 'error')) issues.push(...checkCoast(design, kit));
  return issues;
}

/** Separating-axis test of two convex outlines, apart by less than `touch` counting as touching. */
export function overlaps(a: Outline, b: Outline, touch: number) {
  for (const p of [a, b])
    for (let i = 0; i < p.length; i++) {
      const q = p[(i + 1) % p.length]!,
        r = p[i]!,
        nx = q[1] - r[1],
        nz = r[0] - q[0];
      const aa = a.map((v) => v[0] * nx + v[1] * nz),
        bb = b.map((v) => v[0] * nx + v[1] * nz);
      if (
        Math.max(...aa) + touch * Math.hypot(nx, nz) < Math.min(...bb) ||
        Math.max(...bb) + touch * Math.hypot(nx, nz) < Math.min(...aa)
      )
        return false;
    }
  return true;
}
