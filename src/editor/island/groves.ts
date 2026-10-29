import type { IslandDesign } from '../../data/islands';
import { circle, paintWoods } from './shapes';

/**
 * The woods brushes (part 2 of decision 0105, groves from decision 0236): `grow` and `clear` paint
 * both looks' woods, `grove` paints woods only the new look's forest grows, so a forest can be
 * thickened without moving a single classic tree.
 */
export type WoodsBrush = 'grow' | 'clear' | 'grove';

export const WOODS_TOOLS: [string, WoodsBrush, string, string][] = [
  ['Woods', 'grow', '🌲', 'Grow woods: Paint the woods; once painted, trees grow only there'],
  ['Woods', 'grove', '🌳', 'Grow forest: Paint woods only the new look grows (classic unchanged)'],
  ['Woods', 'clear', '🪓', 'Clear trees: Paint where none grow'],
];

export const WOODS_HINTS: Record<WoodsBrush, string> = {
  grow: 'Paint where trees may grow · Esc stops',
  grove: 'Paint where only the new look grows forest · Esc stops',
  clear: 'Paint where trees are cleared · Esc stops',
};

export const isWoodsBrush = (tool: string | null): tool is WoodsBrush =>
  tool === 'grow' || tool === 'clear' || tool === 'grove';

/** Paints with a woods brush; clearing also lifts the groves under it. */
export function paintForest(
  design: IslandDesign,
  x: number,
  z: number,
  r: number,
  mode: WoodsBrush,
) {
  const w = design.woods;
  if (mode !== 'grove') {
    if (mode === 'clear' && w.groves) {
      w.groves = w.groves.filter((c) => Math.hypot(c[0] - x, c[1] - z) > r);
      if (!w.groves.length) delete w.groves;
    }
    paintWoods(design, x, z, r, mode);
    return;
  }
  w.groves ??= [];
  if (!w.groves.some((c) => Math.hypot(c[0] - x, c[1] - z) < r * 0.5))
    w.groves.push(circle(x, z, r));
}

/** Removes the painted woods and groves (back to trees anywhere in the woods' area). */
export function clearWoodsPainting(design: IslandDesign) {
  delete design.woods.areas;
  delete design.woods.groves;
}

/** The woods edit of `npm run island` (steps.ts): settings, and a brush stroke at `at`. */
export interface WoodsStep {
  at?: [number, number];
  r?: number;
  clear?: boolean;
  /** Paint woods only the new look's forest grows. */
  grove?: boolean;
  tree?: string;
  tries?: number;
  size?: number;
  spacing?: number;
  margin?: number;
  /** The new look's forest: a multiplier on the biome's cover (issue #275). */
  density?: number;
}

export function applyWoodsStep(design: IslandDesign, step: WoodsStep) {
  const w = design.woods;
  if (step.tree) w.tree = step.tree;
  for (const key of ['tries', 'size', 'spacing', 'margin', 'density'] as const)
    if (step[key] !== undefined) w[key] = step[key];
  if (step.at) {
    const [x, z] = step.at;
    const mode = step.clear ? 'clear' : step.grove ? 'grove' : 'grow';
    paintForest(design, x, z, step.r ?? 0.2, mode);
    // Painting woods on an island whose woods are off turns them on.
    if (!step.clear && !w.tries && step.tries === undefined) w.tries = 260;
  }
  return 'woods';
}
