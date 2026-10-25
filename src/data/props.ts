import paletteFile from './palette.json';
import groupsFile from './prop-groups.json';

/**
 * Buildings and props as data (decision 0135): one recipe file per prop type in
 * `src/data/props/<id>.json`, colours in `src/data/palette.json`. A recipe is a list of
 * primitive parts; `src/render/models/propRecipe.ts` builds it. How to add one:
 * docs/content/README.md.
 */

/** A number, or a small expression over the recipe's names (`"h / 2"`, `"k * pi / 2 + 0.4"`). */
export type Num = number | string;

/** One part of a recipe: a shape, a group of parts, another prop, or a named code part. */
export interface RecipePart {
  box?: [Num, Num, Num];
  /** Top radius, bottom radius, height, sides (6), open ends, start angle, arc. */
  cyl?: Num[];
  /** Radius, height, sides; open ended. */
  cone?: [Num, Num, Num];
  /** A triangular prism with its ridge along X: width, depth, height; eaves at `y`. */
  gable?: [Num, Num, Num];
  /** A four-sided pyramid roof: width, depth, height; eaves at `y`. */
  hip?: [Num, Num, Num];
  /** Radius, width segments, height segments, then the phi and theta start and length. */
  sphere?: Num[];
  ico?: [Num, Num?];
  dodeca?: [Num, Num?];
  /** Ring radius, tube radius, radial and tubular segments. */
  torus?: [Num, Num, Num, Num];
  /** Width and height, standing up; turn it flat with `ops`. */
  plane?: [Num, Num];
  /** Window panes on a w × d house: width, depth, height, front, side panes, centre x, z. */
  windows?: Num[];
  /** Size of each window pane, 1 = the usual (decision 0208: small ring houses need bigger panes to read at night). */
  pane?: Num;
  /** Which windows stay dark at night. */
  seed?: Num;
  /** Another prop type's parts, with `vars` set for it. */
  use?: string;
  /** A shape written in code (`src/render/models/propRecipe.ts` › CODE_PARTS). */
  part?: string;
  /** Eaves height of a gable or hip roof. */
  y?: Num;
  /** Transform steps in order: ["move", x, y, z], ["turnX" | "turnY" | "turnZ", radians],
   * ["scale", s] or ["scale", x, y, z]. Applied before `at`. */
  ops?: [string, ...Num[]][];
  /** A final move. */
  at?: [Num, Num, Num];
  /** A palette name, a style list with an index (`walls[variant]`), or `#rrggbb`. */
  color?: string | { pick: Num; of: string[] };
  /** Lit glass: drawn by the window mesh that lights up at night. */
  glow?: boolean;
  /**
   * Each face takes a colour from the whole list `color` names (a style's list, decision 0182):
   * a moss fleck on a boulder. A single colour paints as without it.
   */
  faces?: boolean;
  /** Game hooks set on the part (`{ "solid": "boat" }`). */
  tag?: Record<string, unknown>;
  /** Only when this is not 0. */
  if?: string;
  /** Repeats the part for each value of a name: a list, or `{ "count": n }` for 0 to n − 1. */
  repeat?: Record<string, Num[] | { count: Num }>;
  parts?: RecipePart[];
  vars?: Record<string, Num>;
}

/** How a var is set: a number, an expression, or a seeded draw between two numbers. */
export type RecipeVar = Num | { range: [number, number] };

export interface PropRecipe {
  id: string;
  /** The name in the island builder; else made from the id. */
  name?: string;
  group: PropGroup;
  /** Not offered in the island builder: a piece other props or the old town code use. */
  internal?: boolean;
  /** Copies another recipe and changes some of its `vars` (`windmill-bare`). */
  extends?: string;
  home?: boolean;
  building?: boolean;
  water?: boolean;
  /**
   * A night lamp (decision 0170): it flashes with the beacons (0121), `y` above the prop's foot at
   * size 1, in `color` (default the beacons' warm white). The Lead Rock cairn has one.
   */
  lamp?: { y: number; color?: string };
  /**
   * A steam vent (decision 0181): a small live plume rises `y` above the prop's foot at size 1,
   * with the volcano smoke (0178) at `weather.volcano.smoke.ventScale`. It never erupts.
   */
  vent?: { y: number };
  sizedInModel?: boolean;
  fit?: number;
  fitRadius?: number;
  edge?: boolean;
  /** Walls and roofs from this style, whatever the island's. */
  style?: string;
  /** Values of the island file's fields when the prop leaves them out (`length`). */
  defaults?: Record<string, number>;
  /** Set in order. A `range` draws a number: from the island file's `shape`, or the old town
   * code's seeded stream. */
  vars?: Record<string, RecipeVar>;
  parts?: RecipePart[];
  /** Scales the whole model at the end (the landmarks take `size` this way). */
  scale?: Num;
}

export interface Palette {
  /** Named colours, and lists of them. */
  colors: Record<string, string | string[]>;
  /** Walls and roofs per island style. */
  styles: Record<string, { walls: string[]; roofs: string[] }>;
}

export const PALETTE: Palette = paletteFile;

export type PropGroup =
  'homes' | 'town' | 'timber' | 'fish' | 'farm' | 'stone' | 'nature' | 'rocks' | 'landmarks';

/** The prop groups in the builder's order, each with its triangle budget per prop. */
export const PROP_GROUPS = groupsFile.groups as Record<PropGroup, { budget: number }>;
const GROUP_ORDER = Object.keys(PROP_GROUPS);

const files = Object.values(
  import.meta.glob<PropRecipe>('./props/*.json', { eager: true, import: 'default' }),
);

/** A recipe with its `extends` filled in. */
function resolved(
  file: PropRecipe,
  byId: Map<string, PropRecipe>,
  seen: string[] = [],
): PropRecipe {
  if (!file.extends) return file;
  if (seen.includes(file.id))
    throw new Error(`Prop recipes extend in a circle: ${seen.join(' → ')}`);
  const base = byId.get(file.extends);
  if (!base) throw new Error(`Prop "${file.id}" extends unknown "${file.extends}"`);
  const from = resolved(base, byId, [...seen, file.id]);
  return {
    ...from,
    ...file,
    internal: file.internal,
    // A lamp is the base's own: the tumbled cairn is dark (decision 0170).
    lamp: file.lamp,
    vent: file.vent,
    vars: { ...from.vars, ...file.vars },
    parts: file.parts ?? from.parts,
  };
}

const byId = new Map(files.map((f) => [f.id, f]));

/** Every prop recipe by id, in the builder's order: by group, then by id. */
export const PROP_RECIPES: Record<string, PropRecipe> = Object.fromEntries(
  files
    .map((f) => resolved(f, byId))
    .sort(
      (a, b) =>
        GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || (a.id < b.id ? -1 : 1),
    )
    .map((r) => [r.id, r]),
);
