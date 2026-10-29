// The chart's --coast overlay: for every island in view, the coast its file draws (dashed) and the
// coast the new look's smoothed height field really has (solid), so a smoothing that moves a
// harbour mouth or shaves a point shows up on the map.
import { designOf } from '../../src/data/islands';
import { islandHeightfield } from '../../src/sim/heightfield';
import { islandOutline } from '../../src/sim/islandLayout';
import type { MapDef } from '../../src/sim/map';
import { waterlines } from '../../src/sim/waterline';
import type { Overlay } from './chart';

type View = [number, number, number, number];

const inView = (view: View | undefined, x: number, y: number, r: number) =>
  !view || (x + r > view[0] && x - r < view[2] && y + r > view[1] && y - r < view[3]);

/** `map` is the prepared map: the islands as the game plays them (harbour bearing set). */
export function coastOverlay(map: MapDef, view?: View): Overlay {
  const lines: NonNullable<Overlay['lines']> = [];
  for (const island of map.islands) {
    const design = designOf(island);
    if (!design || !inView(view, island.x, island.y, island.radius * 2)) continue;
    for (const coast of design.coasts) {
      const outline = islandOutline(island, coast);
      lines.push({ points: [...outline, outline[0]!], style: 'coast-drawn' });
    }
    for (const points of waterlines(islandHeightfield(island)))
      lines.push({ points, style: 'coast-v2' });
  }
  return { lines };
}
