import file from './forests.json';
import { PROP_RECIPES } from './props';
import { STYLE_IDS } from './grounds';

/**
 * The new look's forests as data (issue #275, decision 0222): which trees each biome grows, how
 * thick, where, and how many each quality level draws. Read by the placement (`src/sim/forest.ts`)
 * and the instanced drawing (`src/render/models/forest.ts`). How to change: docs/content/forests.md.
 */

/** A tree model: a prop recipe built once with fixed `vars`, then drawn many times. */
export interface ForestKind {
  prop: string;
  vars?: Record<string, number>;
  /** Each tree's size, a share of its island's `woods.size`, drawn evenly in this range. */
  scale: [number, number];
  /** Colours each tree's model is multiplied by, one picked per tree (`#ffffff`: as modelled). */
  tints: string[];
}

/** One kind in a biome's mix, growing between two heights (shares of the island's top). */
export interface ForestMixEntry {
  kind: string;
  /** Its weight among the kinds that grow at a height. */
  share: number;
  from?: number;
  to?: number;
}

export interface ForestBiome {
  /** Share of the free ground the woods cover, before an island's own `woods.density`. */
  cover: number;
  /** World units above the sea: no tree lower (the beach). */
  minHeight: number;
  /** Degrees: no tree on steeper ground. */
  maxSlope: number;
  /** Share of the lane sides lined with small trees (0 or left out: no hedgerows). */
  hedgerow?: number;
  trees: ForestMixEntry[];
}

export interface ForestQuality {
  /** Share of the planted trees drawn: the same trees on every level, fewer on lower ones. */
  share: number;
  shadows: boolean;
}

export interface ForestData {
  /** Grid step between candidate trees, in tree sizes (`woods.size` world units × the scale). */
  spacing: number;
  /** How far a tree may move off its grid point, a share of the step. */
  jitter: number;
  /** How far a tree is sunk into the ground, a share of its size: its trunk meets a slope. */
  sink: number;
  /**
   * Clumps: noise per world unit and its octaves; the share of cells a clump (or painted woods)
   * fills; how wide a clump's ragged edge is, in noise values; on an island with painted woods,
   * the share of the biome's cover that still grows in clumps outside them.
   */
  clump: { scale: number; octaves: number; fill: number; ragged: number; outside: number };
  /** The share of trees that are small (two to a cell), and their size against the others. */
  small: { share: number; scale: number };
  /** Hedgerow trees: their spacing and how far off the lane's clear strip, in tree sizes. */
  hedgerow: { spacing: number; offset: number };
  /**
   * How a lower quality level picks the trees it drops: 0 = strictly from the woods' edges in,
   * 1 = at random. The same trees always.
   */
  thinning: number;
  /**
   * Clear ground, in world units unless named otherwise: round houses (house widths), each side
   * of a lane past its half width, round a pier's root and a build spot, and the harbour camera's
   * line to each house (half its width).
   */
  clear: { houseWidths: number; lane: number; pier: number; plot: number; view: number };
  quality: Record<'low' | 'medium' | 'high' | 'ultra', ForestQuality>;
  kinds: Record<string, ForestKind>;
  /** Island style → biome. */
  styles: Record<string, string>;
  biomes: Record<string, ForestBiome>;
}

export const FORESTS = file as unknown as ForestData;

/** The biome an island of this style grows; a style the file does not name grows none. */
export const forestBiome = (style: string): ForestBiome | undefined =>
  FORESTS.biomes[FORESTS.styles[style] ?? ''];

/** What is wrong with the forest file, for `npm run check` and the tests; empty when it is right. */
export function forestProblems(data: ForestData = FORESTS): string[] {
  const out: string[] = [];
  const share = (v: number, what: string) => {
    if (!(v >= 0 && v <= 1)) out.push(`${what} must be between 0 and 1`);
  };
  for (const [id, kind] of Object.entries(data.kinds)) {
    if (!PROP_RECIPES[kind.prop]) out.push(`kind ${id}: no prop "${kind.prop}"`);
    if (!(kind.scale[0] > 0 && kind.scale[0] <= kind.scale[1]))
      out.push(`kind ${id}: scale must be [min, max] above 0`);
    if (!kind.tints.length || kind.tints.some((t) => !/^#[0-9a-f]{6}$/i.test(t)))
      out.push(`kind ${id}: tints must be #rrggbb colours`);
  }
  for (const style of STYLE_IDS)
    if (!data.biomes[data.styles[style] ?? '']) out.push(`style ${style}: no biome`);
  for (const [id, biome] of Object.entries(data.biomes)) {
    share(biome.cover, `biome ${id}: cover`);
    share(biome.hedgerow ?? 0, `biome ${id}: hedgerow`);
    if (biome.cover > 0 && !biome.trees.length) out.push(`biome ${id}: cover but no trees`);
    for (const t of biome.trees) {
      if (!data.kinds[t.kind]) out.push(`biome ${id}: no kind "${t.kind}"`);
      if (!(t.share > 0)) out.push(`biome ${id}: ${t.kind}'s share must be above 0`);
      share(t.from ?? 0, `biome ${id}: ${t.kind}'s from`);
      share(t.to ?? 1, `biome ${id}: ${t.kind}'s to`);
    }
  }
  for (const [level, q] of Object.entries(data.quality)) share(q.share, `quality ${level}: share`);
  share(data.small.share, 'small: share');
  share(data.thinning, 'thinning');
  share(data.clump.outside, 'clump: outside');
  return out;
}
