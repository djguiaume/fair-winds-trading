import townRulesFile from '../data/town-rules.json';

/**
 * The art director's town layout rules (issue #513, art bible › Towns): the numbers the town
 * checks use, in `src/data/town-rules.json` (decision 0093). Distances are in W, the town's house
 * width (`townPlan.ts` measures it from the models), angles in degrees.
 */

/** The rules a town style may change (tropic stilts, ice huddles, fog crofts, fire ground). */
export interface StyleRules {
  /** Ground slope under a house: [warn, fail]. */
  slope: [number, number];
  /** Nearest footprint corner from the waterline; below 0 a house may stand out over the water. */
  setback: number;
  /** [closer than this warns (houses merge), neighbours this close form a row]. */
  spacing: [number, number];
  /** A house further than this from every other house and lane stands alone. */
  lonely: number;
  /** Every house within this of a lane. */
  laneReach: number;
  /** "yes" or "no": whether the style grows fields and orchards. */
  fields: string;
  /** Ground materials (island file names) a house never stands on. */
  avoid: string[];
  /** Houses keep this far from lava, ash and a volcano's cone; 0 for none. */
  hazardGap: number;
}

export interface TownRules {
  grading: {
    /** "warning" while towns 2 and 3 fix the islands, then "error": what a failed rule counts as. */
    fails: string;
  };
  /** By island style; `default` for any style not listed. */
  styles: Record<string, StyleRules>;
  houses: {
    /** A church may stand on a rise this steep. */
    civicSlope: number;
    /** A house facing a quay or pier may stand this close to the water. */
    quaySetback: number;
    /** A door faces the nearest lane or quay within this, else the nearest water. */
    facingReach: number;
    /** Facing error: [warn, fail]. */
    facing: [number, number];
    /** Houses side by side in a row turn within this of each other. */
    rowTurn: number;
  };
  harbour: {
    /** The main port's core: houses this close to the harbour. */
    core: number;
    /** Slope warning in the core. */
    coreSlope: number;
    /** The houses' centre of mass within this of the harbour. */
    centre: number;
    /** At least this share of the houses within `shareReach` of the harbour. */
    share: number;
    shareReach: number;
    /** The nearest church, market or harbour office within this of the harbour. */
    civic: number;
  };
  lanes: {
    /** A lane follows the shore or the contour within this. */
    turn: number;
    /** Ground flatter than this has no contour to follow: any way is fine. */
    flat: number;
    /** A lane warns when more than this share of it runs off the shore and contour. */
    offShare: number;
    /** The waterfront lane: [near, far] from the waterline, by the harbour. */
    shore: [number, number];
    /** Steepest a lane climbs; steeper needs stairs. */
    slope: number;
    /** A lane's end within this of a building, a pier, a lane end prop or another lane. */
    endReach: number;
  };
  piers: {
    /** A pier runs out within this of square to the shore. */
    square: number;
    /** A pier starts within this of the shore. */
    shore: number;
  };
  fields: {
    slope: number;
    /** [nearest, furthest] from the nearest house. */
    near: [number, number];
  };
  woods: {
    /** Woods on ground flatter than this stand on the town's ground. */
    slope: number;
    /** Trees keep this far from houses. */
    houseGap: number;
  };
  types: {
    civic: string[];
    churches: string[];
    /** Homes that may stand apart: farms. */
    outliers: string[];
    fields: string[];
    /** Props a door may face as it faces a quay. */
    quays: string[];
    /** Props a lane may end at, besides buildings and piers. */
    laneEnds: string[];
  };
}

export const TOWN_RULES = townRulesFile as unknown as TownRules;

/** The rules of an island style: its own entry, else `default`. */
export const styleRules = (rules: TownRules, style: string): StyleRules =>
  rules.styles[style] ?? rules.styles.default!;

/** What the data check compares names with. */
export interface TownRuleNames {
  props: readonly string[];
  grounds: readonly string[];
}

/** Every problem in a town-rules file, worded for the editors' page and `npm run towns -- check`. */
export function townRulesProblems(rules: TownRules, names: TownRuleNames): string[] {
  const problems: string[] = [];
  const fail = (where: string, what: string) => problems.push(`${where}: ${what}`);
  const between = (where: string, v: unknown, lo: number, hi: number) => {
    if (!(typeof v === 'number' && v >= lo && v <= hi)) fail(where, `a number from ${lo} to ${hi}`);
  };
  const span = (where: string, v: unknown, lo: number, hi: number) => {
    const [a, b] = Array.isArray(v) ? (v as number[]) : [NaN, NaN];
    if (!(Array.isArray(v) && v.length === 2 && a! >= lo && b! >= a! && b! <= hi))
      fail(where, `[low, high] with ${lo} ≤ low ≤ high ≤ ${hi}`);
  };
  const fails = rules.grading?.fails;
  if (fails !== 'warning' && fails !== 'error') fail('grading.fails', '"warning" or "error"');
  if (!rules.styles?.default) fail('styles', 'needs a "default" entry');
  for (const [id, s] of Object.entries(rules.styles ?? {})) {
    const at = `styles.${id}`;
    span(`${at}.slope`, s.slope, 0, 60);
    between(`${at}.setback`, s.setback, -5, 5);
    span(`${at}.spacing`, s.spacing, 0, 10);
    between(`${at}.lonely`, s.lonely, 0, 30);
    between(`${at}.laneReach`, s.laneReach, 0, 30);
    if (s.fields !== 'yes' && s.fields !== 'no') fail(`${at}.fields`, '"yes" or "no"');
    for (const g of s.avoid ?? [])
      if (!names.grounds.includes(g)) fail(`${at}.avoid`, `"${g}" is not a ground (palette.json)`);
    between(`${at}.hazardGap`, s.hazardGap, 0, 20);
  }
  const { houses, harbour, lanes, piers, fields, woods } = rules;
  between('houses.civicSlope', houses?.civicSlope, 0, 60);
  between('houses.quaySetback', houses?.quaySetback, -5, 5);
  between('houses.facingReach', houses?.facingReach, 0, 20);
  span('houses.facing', houses?.facing, 0, 180);
  between('houses.rowTurn', houses?.rowTurn, 0, 90);
  for (const key of ['core', 'centre', 'shareReach', 'civic'] as const)
    between(`harbour.${key}`, harbour?.[key], 0, 50);
  between('harbour.coreSlope', harbour?.coreSlope, 0, 60);
  between('harbour.share', harbour?.share, 0, 1);
  between('lanes.turn', lanes?.turn, 0, 90);
  between('lanes.flat', lanes?.flat, 0, 30);
  between('lanes.offShare', lanes?.offShare, 0, 1);
  span('lanes.shore', lanes?.shore, 0, 20);
  between('lanes.slope', lanes?.slope, 0, 60);
  between('lanes.endReach', lanes?.endReach, 0, 10);
  between('piers.square', piers?.square, 0, 90);
  between('piers.shore', piers?.shore, 0, 10);
  between('fields.slope', fields?.slope, 0, 60);
  span('fields.near', fields?.near, 0, 50);
  between('woods.slope', woods?.slope, 0, 60);
  between('woods.houseGap', woods?.houseGap, 0, 20);
  for (const [key, list] of Object.entries(rules.types ?? {}))
    for (const type of list)
      if (!names.props.includes(type))
        fail(`types.${key}`, `"${type}" is not a prop type (src/data/props/)`);
  return problems;
}
