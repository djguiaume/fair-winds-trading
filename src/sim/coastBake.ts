import { TUNING } from '../data/tuning';
import type { IslandDesign } from '../data/islands';
import { coastAgreement } from './coastAgreement';
import { coastDistance } from './coast';
import { contourLines } from './fieldContour';
import { designHeightfield } from './heightfield';
import { characterPiers, islandOutline } from './islandLayout';
import { type IslandCheckKit, type IslandIssue, checkIsland } from './islandChecks';
import { ISLAND_SCALE } from './islandUnits';
import { MAX_SETTLEMENT_LEVEL } from './settlement';
import { ringArea, ringContains, ringsCross, simplifyRing } from './polyline';
import { sculptProblems } from './sculpt';
import { sculptFrame } from './sculptScript';

type Pt = [number, number];

/**
 * Baking a sculpted coast into the island file (decision 0255, issue #352). The coast outline is
 * the sim's coast (decision 0237); sculpting moves the drawn one. Baking traces the sculpted
 * ground's height-zero line, simplifies it and writes it as the outline, so boats, berths and the
 * chart follow what was sculpted. Everything here is in island-radius units unless it says world.
 */

/** A line of the ground that did not become part of the outline, and why. */
export interface BakeDrop {
  kind: 'pond' | 'islet' | 'open';
  /** World units squared. */
  area: number;
  at: Pt;
}

/** A pier whose tip stands further from or nearer to the shore than before (radius units). */
export interface ApproachShift {
  pier: number;
  from: number;
  to: number;
}

export interface BakeResult {
  coasts: Pt[][];
  dropped: BakeDrop[];
  /** The simplification tolerance that fitted the point budget, world units. */
  epsilon: number;
  /** The worst gap between the baked outline and the ground, world units. */
  gap: number;
  approach: ApproachShift[];
}

/** A bake that cannot be done, with the reason; the file is left as it was. */
export class BakeError extends Error {}

const ROUND = 1000;
const round = (v: number) => Math.round(v * ROUND) / ROUND;

/** The closed lines of the ground, as rings in radius units without a repeated end point. */
function groundRings(design: IslandDesign, R: number) {
  const island = sculptFrame(design.id, R);
  const field = designHeightfield(island, design, MAX_SETTLEMENT_LEVEL);
  const toRadius = ([x, y]: Pt): Pt => [-x / island.radius, y / island.radius];
  const rings: Pt[][] = [];
  const dropped: BakeDrop[] = [];
  for (const line of contourLines(field)) {
    const ring = line.map(toRadius);
    if (line.length < 4 || line[0]![0] !== line.at(-1)![0] || line[0]![1] !== line.at(-1)![1]) {
      // A line that leaves the field ran off its edge: land the field cannot hold.
      dropped.push({ kind: 'open', area: 0, at: ring[0]! });
    } else rings.push(ring.slice(0, -1));
  }
  return { island, rings, dropped };
}

/** Land rings (not inside another land ring's water) largest first; ponds and tiny islets dropped. */
function landRings(rings: Pt[][], R: number, dropped: BakeDrop[]): Pt[][] {
  const world = (ring: Pt[]) => Math.abs(ringArea(ring)) * (R * ISLAND_SCALE) ** 2;
  const { minArea } = TUNING.terrain.coast.bake;
  const kept: Pt[][] = [];
  const bySize = [...rings].sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)));
  bySize.forEach((ring, i) => {
    const depth = bySize.slice(0, i).filter((outer) => ringContains(outer, ring[0]!)).length;
    const area = world(ring);
    if (depth % 2 === 1) dropped.push({ kind: 'pond', area, at: ring[0]! });
    else if (area < minArea) dropped.push({ kind: 'islet', area, at: ring[0]! });
    else kept.push(ring);
  });
  return kept;
}

/** The ring with the winding of `like`, starting at its lowest point, so equal ground gives an equal file. */
function settle(ring: Pt[], like: number): Pt[] {
  const rounded = ring.map(([x, z]): Pt => [round(x), round(z)]);
  const ordered = Math.sign(ringArea(rounded)) === Math.sign(like) ? rounded : rounded.reverse();
  let first = 0;
  ordered.forEach(([x, z], i) => {
    const [fx, fz] = ordered[first]!;
    if (z < fz || (z === fz && x < fx)) first = i;
  });
  return [...ordered.slice(first), ...ordered.slice(0, first)];
}

/** Simplified so no ring crosses another or itself and the point budget holds: looser until it fits, finer if it crosses. */
function outlines(rings: Pt[][], R: number, like: number): { coasts: Pt[][]; epsilon: number } {
  const { epsilon: start, maxPoints, tries } = TUNING.terrain.coast.bake;
  const radius = R * ISLAND_SCALE;
  let epsilon = start;
  for (let attempt = 0; attempt < tries; attempt++) {
    const coasts = rings.map((r) => settle(simplifyRing(r, epsilon / radius), like));
    const count = coasts.reduce((n, c) => n + c.length, 0);
    if (ringsCross(coasts)) epsilon /= 2;
    else if (count > maxPoints) epsilon *= 1.5;
    else return { coasts, epsilon };
  }
  throw new BakeError(
    `no outline of at most ${TUNING.terrain.coast.bake.maxPoints} points without crossings (the ground is too ragged: smooth the coast)`,
  );
}

/** How far a pier's tip stands from the shore in an outline set (negative on land). */
const tipDistance = (coasts: Pt[][], tip: Pt) =>
  Math.min(...coasts.map((c) => coastDistance(tip[0], tip[1], c).distance));

function approachShifts(design: IslandDesign, coasts: Pt[][], R: number): ApproachShift[] {
  const shifts: ApproachShift[] = [];
  characterPiers(design, R, MAX_SETTLEMENT_LEVEL).forEach((p, pier) => {
    const tip: Pt = [p.x / R, (p.z0 + p.len) / R];
    const from = tipDistance(design.coasts, tip);
    const to = tipDistance(coasts, tip);
    if (Math.abs(to - from) > TUNING.terrain.coast.bake.approachShift)
      shifts.push({ pier, from, to });
  });
  return shifts;
}

const known = (issues: IslandIssue[]) => new Set(issues.map((i) => `${i.check}|${i.message}`));

/**
 * The island with the coast of its sculpted ground. Refuses, naming the reason, when the edits
 * cannot replay, no outline fits, the baked outline still parts from the ground by more than
 * `terrain.json › coast › tolerance`, or the island checks find a new error.
 */
export function bakeCoast(
  design: IslandDesign,
  kit: IslandCheckKit,
): BakeResult & { design: IslandDesign } {
  if (design.sculpt && sculptProblems(design.sculpt).length)
    throw new BakeError('the sculpt edits do not replay (run the island checks)');
  const { rings, dropped } = groundRings(design, kit.R);
  const open = dropped.find((d) => d.kind === 'open');
  if (open)
    throw new BakeError(
      `sculpted land runs off the edge of the ground near ${open.at.map((v) => v.toFixed(2)).join(', ')} (the ground reaches ${TUNING.terrain.margin} units past the coast): pull the edit back`,
    );
  const land = landRings(rings, kit.R, dropped);
  if (!land.length) throw new BakeError('the ground has no land above the sea');
  const like = design.coasts[0] ? ringArea(design.coasts[0]) : 1;
  const { coasts, epsilon } = outlines(land, kit.R, like);
  const baked: IslandDesign = { ...structuredClone(design), coasts };

  // The ground built from the new outline (the edits replay on it) must sit on the outline.
  const island = sculptFrame(design.id, kit.R);
  const field = designHeightfield(island, baked, MAX_SETTLEMENT_LEVEL);
  const lake = baked.lake ? islandOutline(island, baked.lake) : null;
  const { worst } = coastAgreement(
    field,
    coasts.map((c) => islandOutline(island, c)),
    lake,
  );
  const gap = worst?.distance ?? 0;
  if (gap > TUNING.terrain.coast.tolerance) {
    const why = dropped.some((d) => d.kind !== 'open')
      ? ` (${dropped.length} line(s) left out: ponds and tiny islets cannot be in an outline)`
      : '';
    throw new BakeError(`the baked coast parts from the ground by ${gap.toFixed(1)} units${why}`);
  }
  const before = known(checkIsland(design, kit));
  const fresh = checkIsland(baked, kit).filter(
    (i) => i.severity === 'error' && !before.has(`${i.check}|${i.message}`),
  );
  if (fresh.length)
    throw new BakeError(`the island checks fail: ${fresh.map((i) => i.message).join('; ')}`);
  return {
    design: baked,
    coasts,
    dropped,
    epsilon,
    gap,
    approach: approachShifts(design, coasts, kit.R),
  };
}

/** The bake as lines to print or show. */
export function bakeSummary(result: BakeResult): string[] {
  const points = result.coasts.map((c) => c.length).join('+');
  const lines = [
    `${result.coasts.length} outline(s), ${points} points, within ${result.gap.toFixed(2)} units of the ground (simplified at ${result.epsilon.toFixed(2)})`,
  ];
  for (const d of result.dropped)
    lines.push(
      `left out: ${d.kind === 'open' ? 'a line that runs off the edge of the ground' : `${d.kind} of ${d.area.toFixed(1)} units²`} near ${d.at.map((v) => v.toFixed(2)).join(', ')}`,
    );
  for (const a of result.approach)
    lines.push(
      `pier ${a.pier}: its tip is now ${a.to.toFixed(2)} from the shore (was ${a.from.toFixed(2)})`,
    );
  return lines;
}
