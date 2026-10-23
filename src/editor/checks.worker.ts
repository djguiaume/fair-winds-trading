import { type IslandDesign, useIslandDesign } from '../data/islands';
import type { MapDef } from '../sim/map';
import { routeChecks } from '../sim/mapChecks';

// The slow route checks (a few seconds of path finding) run here so dragging stays smooth.
const scope = self as unknown as Worker;
scope.addEventListener(
  'message',
  (event: MessageEvent<{ id: number; map: MapDef; designs: IslandDesign[] }>) => {
    const { id, map, designs } = event.data;
    // The page's island files, edited or made in the editor (decision 0107): their coasts count.
    for (const design of designs) useIslandDesign(design);
    scope.postMessage({ id, checks: routeChecks(map) });
  },
);
