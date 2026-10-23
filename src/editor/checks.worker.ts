import type { MapDef } from '../sim/map';
import { routeChecks } from '../sim/mapChecks';

// The slow route checks (a few seconds of path finding) run here so dragging stays smooth.
const scope = self as unknown as Worker;
scope.addEventListener('message', (event: MessageEvent<{ id: number; map: MapDef }>) => {
  const { id, map } = event.data;
  scope.postMessage({ id, checks: routeChecks(map) });
});
