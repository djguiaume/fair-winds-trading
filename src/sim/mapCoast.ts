import { TUNING } from '../data/tuning';
import { type CoastAgreement, coastAgreement } from './coastAgreement';
import { piersOf } from './collision';
import { contourLines } from './fieldContour';
import {
  fieldLod,
  heightAt,
  islandHeightfield,
  terrainHeightfield,
  type Heightfield,
} from './heightfield';
import { islandCoasts, islandLake } from './islandLayout';
import { terrainSeed } from './landmarks';
import { clearAt, type MapCheck, questTagsCheck, quickChecks } from './mapChecks';
import type { MapDef, PortDef } from './map';
import { DEFAULT_START_LEVEL, MAX_SETTLEMENT_LEVEL } from './settlement';

type Pt = [number, number];

/** One shape of a map with ground: its name, the sailed coast, the field drawn and how they agree. */
export interface CoastRow extends CoastAgreement {
  id: string;
  /** The coast outlines the sim sails by. */
  sailed: Pt[][];
  /** The drawn coast: the field's height-zero lines. */
  drawn: Pt[][];
}

/**
 * Every island with a file and every barrier island or sandbank of a map, the sailed coast beside
 * the drawn one at a quality level (decision 0237). The chart's `--coast` overlay and the checks below read it.
 */
export function coastReport(
  map: MapDef,
  quality: keyof typeof TUNING.terrain.groundStep = 'high',
  level = MAX_SETTLEMENT_LEVEL,
): CoastRow[] {
  const rows: CoastRow[] = [];
  // The models draw a coarser copy on the lower qualities: it must keep the same coast.
  const row = (id: string, sailed: Pt[][], field: Heightfield, lake: Pt[] | null = null) => {
    const drawn = fieldLod(field, TUNING.terrain.groundStep[quality]);
    rows.push({ id, sailed, drawn: contourLines(drawn), ...coastAgreement(drawn, sailed, lake) });
  };
  for (const island of map.islands) {
    const coasts = islandCoasts(island);
    if (coasts) row(island.id, coasts, islandHeightfield(island, level), islandLake(island));
  }
  for (const t of map.terrain ?? []) {
    const field = terrainHeightfield(t, terrainSeed(map, t));
    if (field) row(t.id, [t.outline], field);
  }
  return rows;
}

/**
 * Coast checks of a map (decision 0237): barrier islands and sandbanks are drawn where they are
 * sailed, and no ground is drawn in the water a ship docks in at any port.
 */
export function coastMapChecks(map: MapDef): MapCheck[] {
  const { tolerance } = TUNING.terrain.coast;
  const apart = (map.terrain ?? [])
    .map((t) => ({ t, field: terrainHeightfield(t, terrainSeed(map, t)) }))
    .flatMap(({ t, field }) => {
      const worst = field && coastAgreement(field, [t.outline]).worst;
      return worst && worst.distance > tolerance
        ? [`${t.name ?? t.id}: ${worst.distance.toFixed(1)} units`]
        : [];
    });
  const buried = map.ports.flatMap((port) => harbourGround(map, port));
  return [
    check(
      'coast-terrain',
      apart,
      `barrier islands and sandbanks are drawn within ${tolerance} units of their coast`,
      'drawn coast apart from the sailed one',
    ),
    check(
      'harbour-water',
      buried,
      'no ground is drawn in the water ships dock in',
      'ground drawn in dock water',
    ),
  ];
}

const check = (id: string, problems: string[], pass: string, fail: string): MapCheck => ({
  id,
  ok: !problems.length,
  severity: 'error',
  message: problems.length ? `${fail}: ${problems.join('; ')}` : pass,
});

/**
 * Where the ground is drawn above the sea in water the sim lets a sloop dock in: round each of
 * the port's piers, at its first and its top level, every point with clear water and a drawn
 * height above the sea. One line per port and level.
 */
function harbourGround(map: MapDef, port: PortDef): string[] {
  const island = map.islands.find((i) => i.id === port.islandId);
  if (!island) return [];
  const { dockRange } = TUNING.seamanship.harbour;
  const start = port.site ? 1 : (port.level ?? DEFAULT_START_LEVEL);
  const out: string[] = [];
  for (const level of new Set([start, port.maxLevel ?? MAX_SETTLEMENT_LEVEL])) {
    const field = islandHeightfield(island, level);
    const step = field.cell * 2;
    const piers = piersOf(map, { [port.id]: level }).filter(
      (p) => p.islandId === island.id && !p.boat,
    );
    let spot: Pt | null = null;
    let count = 0;
    for (const p of piers)
      for (
        let x = Math.min(p.x0, p.x1) - dockRange;
        x <= Math.max(p.x0, p.x1) + dockRange;
        x += step
      )
        for (
          let y = Math.min(p.y0, p.y1) - dockRange;
          y <= Math.max(p.y0, p.y1) + dockRange;
          y += step
        )
          if (clearAt(map, x, y, 2) && heightAt(field, x, y) > 0) {
            spot ??= [x, y];
            count++;
          }
    if (spot)
      out.push(
        `${port.name} (level ${level}): ${count} points, first at ${spot.map((v) => v.toFixed(0)).join(',')}`,
      );
  }
  return out;
}

/** The map editor's checks: the quick checks, the coast checks and the quest tags. */
export const editorChecks = (map: MapDef, quests: readonly string[]): MapCheck[] => [
  ...quickChecks(map),
  ...coastMapChecks(map),
  questTagsCheck(map, quests),
];
