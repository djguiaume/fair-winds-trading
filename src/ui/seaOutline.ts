import { type SeaShape, edgeLine } from '../sim/seaEdge';

/**
 * The sea's water as one SVG shape (decision 0202), y flipped like the charts: the round sea's
 * circle, or the rounded rim of a sea with sections joined to it. Fill it for the water, stroke it
 * for the edge: either way one shape, so no line shows where a section joins.
 */
export function seaSvg(
  sea: SeaShape,
  step: number,
): { tag: string; attrs: Record<string, string | number> } {
  if (!sea.rim) return { tag: 'circle', attrs: { r: sea.radius } };
  const points = edgeLine(sea, step)
    .slice(0, -1)
    .map(([x, y]) => `${x},${-y}`)
    .join(' ');
  return { tag: 'polygon', attrs: { points } };
}
