import { MAX_SETTLEMENT_LEVEL, SETTLEMENT_LEVELS, TOWN_LEVELS } from '../../sim/settlement';
import { ISLAND_DESIGNS, atLevel, type IslandDesign, type PropDef } from '../../data/islands';

/**
 * The island builder's document (decision 0105): an island file exactly as it is saved in
 * `src/data/islands/<id>.json`, and the edits the builder makes to its props. Pure data, no DOM,
 * so the tests can drive it. Positions are island-radius units, kept to six decimals like the
 * shipped files; turns to a tenth of a degree.
 */

/** A town level; their number and names come from `src/data/town-levels.json` (decision 0113). */
export type Level = number;
export const LEVELS: readonly Level[] = SETTLEMENT_LEVELS;
export const LEVEL_NAMES: readonly string[] = TOWN_LEVELS.map((l) => l.name);
/** The port town, the top level: what the builder shows first and the triangle budget counts. */
export const TOP_LEVEL: Level = MAX_SETTLEMENT_LEVEL;

const round = (v: number, places: number) => Number(v.toFixed(places));
const pos = (v: number) => round(v, 6);
/** Degrees in -180 to 180, so a file never grows 900° turns. */
const angle = (deg: number) => round(((((deg + 180) % 360) + 360) % 360) - 180, 1);

/** Names in the palette and the panel; the others are made from the id. */
const NAMES: Record<string, string> = {
  'fish-house': "Fisher's house",
  'spire-church': 'Church',
  'moored-boat': 'Fishing boat',
  'slipway-hull': 'Slipway with hull',
  'windmill-bare': 'Windmill, bare sails',
  lumber: 'Planks',
  sawmill: 'Sawmill',
  masons: "Mason's yard",
  'stone-blocks': 'Stone blocks',
  rail: 'Quarry rail',
  'lamp-post': 'Lamp post',
  'drying-rack': 'Drying rack',
};
export const propName = (type: string) =>
  NAMES[type] ?? type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ');

/**
 * What a new prop of a type starts with: the size it has most often on this island, else on
 * the shipped islands, else 1. Homes take the next colour variant so neighbours differ.
 */
export function newProp(
  design: IslandDesign,
  type: string,
  x: number,
  z: number,
  level: Level,
  home = false,
): PropDef {
  const sizeOf = (props: PropDef[]) => {
    const counts = new Map<number, number>();
    for (const p of props)
      if (p.type === type) counts.set(p.size ?? 1, (counts.get(p.size ?? 1) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const size =
    sizeOf(design.props) ?? sizeOf(Object.values(ISLAND_DESIGNS).flatMap((d) => d.props)) ?? 1;
  const prop = { type, x: pos(x), z: pos(z) } as PropDef;
  if (size !== 1) prop.size = size;
  if (home) prop.variant = design.props.filter((p) => p.type === type).length;
  prop.from = level;
  return prop;
}

/** Adds a prop; homes join the end of the residence order. Returns its index. */
export function addProp(design: IslandDesign, prop: PropDef): number {
  design.props.push(prop);
  return design.props.length - 1;
}

export function moveProp(design: IslandDesign, index: number, x: number, z: number) {
  const p = design.props[index];
  if (!p) return;
  p.x = pos(x);
  p.z = pos(z);
}

export function turnProp(design: IslandDesign, index: number, deg: number) {
  const p = design.props[index];
  if (p) p.turn = angle(deg);
}

/** A copy a little to the side, from the same level, right after the original. */
export function duplicateProp(design: IslandDesign, index: number, dx = 0.06): number {
  const p = design.props[index];
  if (!p) return -1;
  const copy: PropDef = structuredClone(p);
  copy.x = pos(p.x + dx);
  // A second residence must not take an outbuilding's tag by accident: it is copied as is.
  design.props.splice(index + 1, 0, copy);
  return index + 1;
}

export function deleteProp(design: IslandDesign, index: number) {
  design.props.splice(index, 1);
}

/**
 * Sets the first and last level a prop stands at. A `from` after `to` drops `to`; `to` at the top level or
 * none removes the key, as the files leave it out.
 */
export function setLevels(design: IslandDesign, index: number, from: Level, to?: Level) {
  const p = design.props[index];
  if (!p) return;
  p.from = from;
  if (to === undefined || to === TOP_LEVEL || to < from) delete p.to;
  else p.to = to;
}

/** Sets an optional number on a prop; undefined (or the default) removes the key. */
export function setPropValue(
  design: IslandDesign,
  index: number,
  key: 'size' | 'variant' | 'shape' | 'y' | 'fit' | 'clear' | 'length',
  value: number | undefined,
) {
  const p = design.props[index];
  if (!p) return;
  if (value === undefined || Number.isNaN(value) || (key === 'size' && value === 1)) delete p[key];
  else p[key] = round(value, 6);
}

/** The props standing at a level, and (for the ghosts) those that only come later. */
export function propsAt(design: IslandDesign, level: Level) {
  const now: number[] = [],
    later: number[] = [];
  design.props.forEach((p, i) => {
    if (atLevel(p, level)) now.push(i);
    else if ((p.from ?? 1) > level) later.push(i);
  });
  return { now, later };
}

/** Homes per level, as the checks and the panel count them: 3 · 10 · 21 · 32 for Calda. */
export function homesPerLevel(design: IslandDesign, isHome: (p: PropDef) => boolean) {
  return LEVELS.map((level) => design.props.filter((p) => isHome(p) && atLevel(p, level)).length);
}

/** True when two designs are the same file. */
export const sameDesign = (a: IslandDesign, b: IslandDesign) =>
  JSON.stringify(a) === JSON.stringify(b);

/** The key order of the shipped files, so an exported file diffs only where it changed. */
const PROP_KEYS: (keyof PropDef)[] = [
  'type',
  'x',
  'z',
  'turn',
  'size',
  'variant',
  'shape',
  'length',
  'y',
  'fit',
  'clear',
  'tags',
  'from',
  'to',
];

/** Keys in a fixed order, then any others as they come; undefined values are left out. */
function ordered<T extends object>(value: T, keys: string[]): T {
  const out: Record<string, unknown> = {};
  const v = value as Record<string, unknown>;
  for (const k of keys) if (v[k] !== undefined) out[k] = v[k];
  for (const [k, x] of Object.entries(v)) if (!(k in out) && x !== undefined) out[k] = x;
  return out as T;
}

/** A copy of the design with every key in the shipped files' order. */
export function tidyDesign(design: IslandDesign): IslandDesign {
  const d = ordered(design, [
    'id',
    'name',
    'style',
    'seed',
    'coasts',
    'lake',
    'ground',
    'lanes',
    'ramps',
    'piers',
    'props',
    'homeSpots',
    'woods',
  ]);
  return {
    ...d,
    ground: d.ground.map((g) =>
      ordered(g, [
        'coast',
        'outline',
        'holes',
        'height',
        'material',
        'shape',
        'base',
        'slope',
        'slopeEdges',
        'from',
        'to',
      ]),
    ),
    lanes: d.lanes.map((l) => ordered(l, ['kind', 'points', 'y', 'base'])),
    ...(d.ramps && {
      ramps: d.ramps.map((r) =>
        ordered(r, ['points', 'width', 'start', 'end', 'material', 'from', 'to']),
      ),
    }),
    props: d.props.map((p) => ordered(p, PROP_KEYS as string[])),
    ...(d.homeSpots && {
      homeSpots: d.homeSpots.map((s) => ordered(s, ['id', 'x', 'z', 'y', 'pair'])),
    }),
    woods: ordered(d.woods, [
      'tree',
      'tries',
      'area',
      'size',
      'margin',
      'spacing',
      'spacingAt',
      'clear',
      'areas',
    ]),
  };
}

// --- Build spots (decisions 0126, 0128) ---------------------------------------------------

/** Adds a build spot (a spare one: no pair) with the next free `spot-N` id. Returns its index. */
export function addSpot(design: IslandDesign, x: number, z: number): number {
  const spots = (design.homeSpots ??= []);
  let n = spots.length + 1;
  while (spots.some((s) => s.id === `spot-${n}`)) n++;
  spots.push({ id: `spot-${n}`, x: pos(x), z: pos(z) });
  return spots.length - 1;
}

export function moveSpot(design: IslandDesign, index: number, x: number, z: number) {
  const s = design.homeSpots?.[index];
  if (!s) return;
  s.x = pos(x);
  s.z = pos(z);
}

/** An arc spot takes the two buildings of its pair; none makes it a spare spot. */
export function setSpotPair(design: IslandDesign, index: number, pair: string | undefined) {
  const s = design.homeSpots?.[index];
  if (!s) return;
  if (pair) s.pair = pair;
  else delete s.pair;
}

/** Removes a spot; the last one gone removes the key, so the island is no longer buildable. */
export function deleteSpot(design: IslandDesign, index: number) {
  design.homeSpots?.splice(index, 1);
  if (design.homeSpots && !design.homeSpots.length) delete design.homeSpots;
}
