import { TUNING } from '../data/tuning';
import { atLevel, type IslandDesign } from '../data/islands';
import { coastAgreement } from './coastAgreement';
import { designHeightfield, heightAt, sampleIndex, type Heightfield } from './heightfield';
import type { IslandCheckKit, IslandIssue } from './islandChecks';
import { islandOutline, islandPoint } from './islandLayout';
import { sculptProblems } from './sculpt';
import { sculptFrame } from './sculptScript';
import { MAX_SETTLEMENT_LEVEL } from './settlement';

/**
 * The island checks of the drawn coast (decision 0237, issue #273): the ground the models draw
 * must agree with the coast the sim sails by, whatever the quality level and whatever the hand
 * sculpting did, and every building must still stand on level ground above the sea. The coast
 * outline in the island file is the authority; an edit that moves the drawn coast away from it
 * is an error, so the two never part silently.
 */
export function checkCoast(design: IslandDesign, kit: IslandCheckKit): IslandIssue[] {
  // Edits that cannot replay are the sculpt check's to report.
  if (design.sculpt && sculptProblems(design.sculpt).length) return [];
  const island = sculptFrame(design.id, kit.R);
  const coasts = design.coasts.map((c) => islandOutline(island, c));
  const lake = design.lake ? islandOutline(island, design.lake) : null;
  const fields = new Map<number, Heightfield>();
  const fieldAt = (level: number) => {
    let field = fields.get(level);
    if (!field) fields.set(level, (field = designHeightfield(island, design, level)));
    return field;
  };
  const issues: IslandIssue[] = [];
  const { tolerance } = TUNING.terrain.coast;
  // The sampler draws the same coast at every level, so the top level, the fullest, speaks for all.
  const level = MAX_SETTLEMENT_LEVEL;
  const { worst, beyond } = coastAgreement(fieldAt(level), coasts, lake);
  if (worst && worst.distance > tolerance)
    issues.push({
      severity: 'error',
      check: 'coast',
      message: `${worst.side === 'drawn' ? 'drawn land beyond' : 'drawn sea inside'} the sailed coast by ${worst.distance.toFixed(1)} units (limit ${tolerance}), ${beyond.length} place(s)`,
      at: mapToIsland(island, worst.at),
      level,
    });
  design.props.forEach((p, prop) => {
    if (!kit.types[p.type]?.building) return;
    const at = islandPoint(island, p.x, p.z);
    for (let l = 1; l <= MAX_SETTLEMENT_LEVEL; l++) {
      if (!atLevel(p, l)) continue;
      const problem = supportProblem(fieldAt(l), at.x, at.y);
      if (!problem) continue;
      issues.push({
        severity: 'error',
        check: 'support',
        message: `${p.type} (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) ${problem}`,
        at: [p.x, p.z],
        prop,
        level: l,
      });
      break;
    }
  });
  return issues;
}

/** Why a building at a map point has no ground to stand on, if it has not. */
function supportProblem(field: Heightfield, x: number, y: number): string | null {
  const k = sampleIndex(field, x, y);
  if (k < 0 || !field.terrace[k]) return 'is off the level ground (terrace)';
  if (heightAt(field, x, y) < TUNING.terrain.coast.buildingMinHeight)
    return 'stands at the waterline or under water';
  return null;
}

/** A map point of the frame island (bearing 0, at the origin) in island-radius units. */
function mapToIsland(island: { radius: number }, at: [number, number]): [number, number] {
  return [-at[0] / island.radius, at[1] / island.radius];
}
