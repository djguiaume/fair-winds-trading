import type { IslandDesign } from '../../data/islands';
import { islandCheckKit } from '../../render/models/towns';
import { type IslandIssue, checkIsland } from '../../sim/islandChecks';

// Island checks off the page thread (decision 0105): building every level to count its
// triangles takes a second or two on a laptop, longer on a tablet.
const scope = self as unknown as Worker;
scope.addEventListener(
  'message',
  (event: MessageEvent<{ id: number; design: IslandDesign; R: number }>) => {
    const { id, design, R } = event.data;
    try {
      const kit = islandCheckKit(design, R);
      const triangles = [1, 2, 3, 4].map((level) => kit.triangles!(level));
      kit.triangles = () => triangles[3]!;
      scope.postMessage({ id, issues: checkIsland(design, kit), triangles });
    } catch (error) {
      const issue: IslandIssue = {
        severity: 'error',
        check: 'known',
        message: `The island does not build: ${String(error)}`,
      };
      scope.postMessage({ id, issues: [issue], triangles: [] });
    }
  },
);
