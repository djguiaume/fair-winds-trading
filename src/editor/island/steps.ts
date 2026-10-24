import type { IslandDesign, IslandStyle, Point, PropDef } from '../../data/islands';
import { PROP_RECIPES } from '../../data/props';
import { islandLayout, layoutGround } from '../../sim/islandLayout';
import {
  type Level,
  addProp,
  addSpot,
  deleteProp,
  deleteSpot,
  homesPerLevel,
  newDesign,
  newProp,
  setLevels,
  setPropValue,
  setSpotPair,
  turnProp,
} from './doc';
import {
  type GroundShape,
  addIslet,
  addLake,
  addLane,
  addMountain,
  addPlateau,
  addRamp,
  addRiver,
  blobOutline,
  deleteShape,
  paintWoods,
} from './shapes';

/**
 * Island edits as data (decision 0153, `npm run island`): each step is one of the island
 * builder's own edits (doc.ts, shapes.ts), written as a small JSON object, so a whole island can
 * be made or changed from a list of steps instead of a one-off generator script. Coordinates are
 * island-radius units, harbour toward +z, as in the files.
 */

/** A seeded outline round a point (see `blobOutline`). */
export interface BlobSpec {
  r: number;
  seed?: number;
  points?: number;
  rough?: number;
  stretch?: number;
  turn?: number;
}

type At = [number, number];
type Shaped = { outline?: Point[]; blob?: BlobSpec; size?: [number, number]; points?: number };

export type IslandStep =
  | ({ do: 'islet'; low?: number; at?: At } & Shaped)
  | ({
      do: 'plateau' | 'mountain';
      at: At;
      level?: Level;
      height?: number;
      rise?: number;
      material?: string;
      slope?: number;
      /** A mountain's crater (decision 0171): its radius as a share of its size. */
      crater?: number;
    } & Shaped)
  | ({ do: 'lake'; at: At } & Shaped)
  | {
      do: 'ramp';
      points: number[][];
      start?: number;
      end?: number;
      width?: number;
      material?: string;
      level?: Level;
    }
  | { do: 'lane' | 'path' | 'stairs'; points: number[][] }
  | {
      do: 'river';
      points: number[][];
      kind?: 'water' | 'lava';
      width?: number;
      level?: Level;
      to?: Level;
      tags?: string[];
    }
  | {
      do: 'woods';
      at?: At;
      r?: number;
      clear?: boolean;
      tree?: string;
      tries?: number;
      size?: number;
      spacing?: number;
      margin?: number;
    }
  | { do: 'spot'; at: At; pair?: string; y?: number }
  | {
      do: 'prop';
      type: string;
      /** One place, or several: one prop each. */
      at: At | At[];
      turn?: number;
      size?: number;
      variant?: number;
      shape?: number;
      length?: number;
      y?: number;
      fit?: number;
      clear?: number;
      level?: Level;
      to?: Level;
      tags?: string[];
    }
  | { do: 'pier'; at: At; length?: number; level?: Level }
  | {
      do: 'remove';
      what: 'prop' | 'ground' | 'lane' | 'ramp' | 'river' | 'spot' | 'coast' | 'lake' | 'pier';
      index?: number;
    }
  | { do: 'set'; name?: string; style?: IslandStyle; seed?: number }
  /** Changes a raised ground (or with `ramp`, a ramp): its material or height (decision 0168). */
  | { do: 'ground'; index: number; ramp?: boolean; material?: string; height?: number };

export const STEP_KINDS = [
  'islet',
  'plateau',
  'mountain',
  'lake',
  'ramp',
  'lane',
  'path',
  'stairs',
  'river',
  'woods',
  'spot',
  'prop',
  'pier',
  'remove',
  'set',
  'ground',
] as const;

const pos = (v: number) => Number(v.toFixed(6));

/** The ground's height at a point (the beach is 0) at a level, on the design as it is now. */
export function groundHeightAt(design: IslandDesign, x: number, z: number, level = 4) {
  // The layout cache is keyed by the design object, which these steps change in place.
  return layoutGround(islandLayout(structuredClone(design), level), x, z, 0) ?? 0;
}

/** The outline a step asks for: its own points, a seeded blob round `at`, or none. */
function outlineOf(step: Shaped & { at?: At }, seed: number): Point[] | undefined {
  if (step.outline) return step.outline;
  if (!step.blob) return undefined;
  const [x, z] = step.at ?? [0, 0];
  const { r, seed: s = seed, ...rest } = step.blob;
  return blobOutline(x, z, r, s, rest);
}

/** A new island file from an outline or a seeded blob (default: a round blob of radius 1). */
export function islandFromOutline(
  id: string,
  opts: Shaped & { name?: string; style?: IslandStyle; seed?: number; low?: number } = {},
): IslandDesign {
  const seed = opts.seed ?? 1;
  const coast = outlineOf(
    { ...opts, blob: opts.blob ?? (opts.outline ? undefined : { r: 1, points: 14, rough: 0.22 }) },
    seed,
  )!;
  return newDesign(id, coast, { name: opts.name, style: opts.style, seed, low: opts.low });
}

/** Applies one step; throws an Error saying what is wrong with it. Returns what it made. */
export function applyStep(design: IslandDesign, step: IslandStep): string {
  const level = 'level' in step && step.level ? step.level : 1;
  switch (step.do) {
    case 'islet': {
      const outline = outlineOf(step, design.seed + design.coasts.length);
      if (!outline) throw new Error('islet needs an outline or a blob');
      return `coast ${addIslet(design, outline, step.low)}`;
    }
    case 'plateau':
    case 'mountain': {
      const [x, z] = step.at;
      const under = groundHeightAt(design, x, z, level);
      const shape: GroundShape = {
        outline: outlineOf(step, design.seed + design.ground.length),
        rx: step.size?.[0],
        rz: step.size?.[1],
        points: step.points,
        height: step.height,
        rise: step.rise,
        material: step.material,
        slope: step.slope,
      };
      const add = step.do === 'plateau' ? addPlateau : addMountain;
      const index = add(design, x, z, under, level, shape);
      if (step.crater && step.do === 'mountain') design.ground[index]!.crater = pos(step.crater);
      return `ground ${index}`;
    }
    case 'lake': {
      const [x, z] = step.at;
      const outline = outlineOf(step, design.seed + 7);
      if (!addLake(design, x, z, { outline, rx: step.size?.[0], rz: step.size?.[1] }))
        throw new Error('the island has a lake already (remove lake first)');
      return 'lake';
    }
    case 'ramp': {
      if (step.points.length < 2) throw new Error('a ramp needs two points or more');
      const first = step.points[0]!,
        last = step.points[step.points.length - 1]!;
      const start = step.start ?? groundHeightAt(design, first[0]!, first[1]!, level);
      const end = step.end ?? groundHeightAt(design, last[0]!, last[1]!, level);
      const index = addRamp(design, step.points, start, end, level);
      const ramp = design.ramps![index]!;
      if (step.width) ramp.width = pos(step.width);
      if (step.material) ramp.material = step.material;
      return `ramp ${index}`;
    }
    case 'lane':
    case 'path':
    case 'stairs': {
      if (step.points.length < 2) throw new Error(`a ${step.do} needs two points or more`);
      const points =
        step.do === 'stairs'
          ? step.points.map((p) => [p[0]!, p[1]!, p[2] ?? groundHeightAt(design, p[0]!, p[1]!)])
          : step.points;
      return `lane ${addLane(design, step.do, points)}`;
    }
    case 'river': {
      if (step.points.length < 2) throw new Error('a river needs two points or more');
      const index = addRiver(design, step.kind ?? 'water', step.points, level, step.width);
      const river = design.rivers![index]!;
      if (step.to !== undefined) river.to = step.to;
      if (step.tags?.length) river.tags = [...step.tags];
      return `river ${index}`;
    }
    case 'woods': {
      const w = design.woods;
      if (step.tree) w.tree = step.tree;
      for (const key of ['tries', 'size', 'spacing', 'margin'] as const)
        if (step[key] !== undefined) w[key] = step[key];
      if (step.at) {
        const [x, z] = step.at;
        paintWoods(design, x, z, step.r ?? 0.2, step.clear ? 'clear' : 'grow');
        // Painting woods on an island whose woods are off turns them on.
        if (!step.clear && !w.tries && step.tries === undefined) w.tries = 260;
      }
      return 'woods';
    }
    case 'spot': {
      const index = addSpot(design, step.at[0], step.at[1]);
      if (step.pair) setSpotPair(design, index, step.pair);
      if (step.y !== undefined) design.homeSpots![index]!.y = pos(step.y);
      return design.homeSpots![index]!.id;
    }
    case 'prop': {
      if (!PROP_RECIPES[step.type]) throw new Error(`no prop type "${step.type}"`);
      const places = (Array.isArray(step.at[0]) ? step.at : [step.at]) as At[];
      const made: number[] = [];
      for (const [x, z] of places) {
        const home = !!PROP_RECIPES[step.type]!.home;
        const i = addProp(design, newProp(design, step.type, x, z, level, home));
        if (step.turn !== undefined) turnProp(design, i, step.turn);
        for (const key of ['size', 'variant', 'shape', 'length', 'y', 'fit', 'clear'] as const)
          if (step[key] !== undefined) setPropValue(design, i, key, step[key]);
        setLevels(design, i, level, step.to);
        if (step.tags?.length) design.props[i]!.tags = [...step.tags];
        made.push(i);
      }
      return made.length > 1 ? `props ${made[0]}-${made[made.length - 1]}` : `prop ${made[0]}`;
    }
    case 'pier': {
      const [x, z] = step.at;
      design.piers.push({ x: pos(x), z: pos(z), length: pos(step.length ?? 0.26), from: level });
      return `pier ${design.piers.length - 1}`;
    }
    case 'remove': {
      const i = step.index ?? -1;
      const list: Record<string, unknown[] | undefined> = {
        prop: design.props,
        ground: design.ground,
        lane: design.lanes,
        ramp: design.ramps,
        river: design.rivers,
        spot: design.homeSpots,
        coast: design.coasts,
        pier: design.piers,
      };
      if (step.what !== 'lake' && !list[step.what]?.[i])
        throw new Error(`no ${step.what} ${step.index ?? '(give an index)'}`);
      if (step.what === 'prop') deleteProp(design, i);
      else if (step.what === 'spot') deleteSpot(design, i);
      else if (step.what === 'pier') design.piers.splice(i, 1);
      else if (step.what === 'lake') deleteShape(design, { kind: 'lake' });
      else if (!deleteShape(design, { kind: step.what, index: i }))
        throw new Error('the main coast stays');
      return `removed ${step.what}${step.what === 'lake' ? '' : ` ${i}`}`;
    }
    case 'set': {
      if (step.name) design.name = step.name;
      if (step.style) design.style = step.style;
      if (step.seed !== undefined) design.seed = step.seed;
      return 'set';
    }
    case 'ground': {
      const what = step.ramp ? 'ramp' : 'ground';
      const g = step.ramp ? design.ramps?.[step.index] : design.ground[step.index];
      if (!g) throw new Error(`no ${what} ${step.index}`);
      if (step.material) g.material = step.material;
      if (step.height !== undefined && 'height' in g) g.height = pos(step.height);
      return `${what} ${step.index}`;
    }
    default:
      throw new Error(`unknown step "${(step as { do: string }).do}" (${STEP_KINDS.join(', ')})`);
  }
}

/** Applies steps in order; an error names the step by its number (from 1) and kind. */
export function applySteps(design: IslandDesign, steps: IslandStep[]): string[] {
  return steps.map((step, n) => {
    try {
      return applyStep(design, step);
    } catch (e) {
      throw new Error(`step ${n + 1} (${step.do}): ${(e as Error).message}`, { cause: e });
    }
  });
}

/** One line on an island file: what it holds, homes per level, spots and woods. */
export function islandSummary(design: IslandDesign, isHome: (p: PropDef) => boolean) {
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const homes = homesPerLevel(design, isHome);
  const parts = [
    n(design.coasts.length, 'coast'),
    n(design.ground.length, 'ground'),
    ...(design.lake ? ['lake'] : []),
    ...(design.lanes.length ? [n(design.lanes.length, 'lane')] : []),
    ...(design.ramps?.length ? [n(design.ramps.length, 'ramp')] : []),
    ...(design.rivers?.length ? [n(design.rivers.length, 'river')] : []),
    ...(design.piers.length ? [n(design.piers.length, 'pier')] : []),
    n(design.props.length, 'prop'),
    ...(homes.some(Boolean) ? [`homes ${homes.join('·')}`] : []),
    ...(design.homeSpots?.length ? [n(design.homeSpots.length, 'spot')] : []),
    design.woods.tries ? `woods ${design.woods.tries} tries` : 'woods off',
  ];
  return `${design.id} (${design.style}): ${parts.join(', ')}`;
}
