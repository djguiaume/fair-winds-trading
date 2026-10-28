import { TUNING } from '../data/tuning';
import { atLevel, type IslandDesign, type PropDef } from '../data/islands';
import { designHeightfield, heightAt, type Heightfield } from './heightfield';
import type { IslandCheckKit, IslandIssue } from './islandChecks';
import { islandPoint } from './islandLayout';
import { ISLAND_SCALE } from './islandUnits';
import type { IslandDef } from './map';
import { editReach, sculptProblems } from './sculpt';
import { SETTLEMENT_LEVELS } from './settlement';

/** Points round a footprint where the checks read the ground: the centre and eight on its rim. */
const RIM = Array.from({ length: 8 }, (_, k) => [
  Math.cos((k * Math.PI) / 4),
  Math.sin((k * Math.PI) / 4),
]);

/**
 * The island checks of hand sculpting (decision 0230): edits that cannot replay, and buildings an
 * edit reaches that no longer stand level. The protection round buildings is checked here too, so
 * an `override` edit, or a building bigger than its protected ground, is caught.
 */
export function checkSculpt(design: IslandDesign, kit: IslandCheckKit): IslandIssue[] {
  if (!design.sculpt) return [];
  const problems = sculptProblems(design.sculpt);
  if (problems.length)
    return problems.map((message) => ({ severity: 'error', check: 'sculpt', message }));
  const edits = design.sculpt.edits;
  if (!edits.length) return [];
  // The file's own frame on a map: radius R reference units, ISLAND_SCALE bigger in the world.
  const island: IslandDef = { id: design.id, x: 0, y: 0, radius: kit.R * ISLAND_SCALE };
  const plain = { ...design, sculpt: undefined };
  const fields = new Map<number, [Heightfield, Heightfield]>();
  const fieldsAt = (level: number) => {
    let pair = fields.get(level);
    if (!pair)
      fields.set(
        level,
        (pair = [
          designHeightfield(island, plain, level),
          designHeightfield(island, design, level),
        ]),
      );
    return pair;
  };
  const tolerance = TUNING.terrain.sculpt.levelTolerance;
  const issues: IslandIssue[] = [];
  design.props.forEach((p, prop) => {
    if (!kit.types[p.type]?.building) return;
    const fit = p.fit ?? kit.fit(p);
    const edit = edits.findIndex((e) => editReach(e, p.x, p.z) < fit);
    if (edit < 0) return;
    const level = SETTLEMENT_LEVELS.find((l) => {
      if (!atLevel(p, l)) return false;
      const [before, after] = fieldsAt(l);
      return spread(after, island, p, fit) - spread(before, island, p, fit) > tolerance;
    });
    if (level === undefined) return;
    const name = `${p.type} (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`;
    issues.push({
      severity: 'error',
      check: 'sculpt',
      message: `${name} no longer stands level after sculpt edit ${edit + 1}`,
      at: [p.x, p.z],
      prop,
      level,
    });
  });
  return issues;
}

/** How far the ground under a footprint rises and falls (world units). */
function spread(field: Heightfield, island: IslandDef, p: PropDef, fit: number) {
  let low = Infinity,
    high = -Infinity;
  for (const [dx, dz] of [[0, 0], ...RIM]) {
    const at = islandPoint(island, p.x + dx! * fit, p.z + dz! * fit);
    const h = heightAt(field, at.x, at.y);
    low = Math.min(low, h);
    high = Math.max(high, h);
  }
  return high - low;
}
