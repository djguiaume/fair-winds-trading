import { DIFFICULTIES, weatherFor } from './difficulty';
import { type FreePreset, type FreeRules, presetTime } from './freeSailing';
import type { MapDef } from './map';
import { clearAt } from './mapChecks';
import { bearingVector } from './math';
import { SHIP_CLASSES } from './ship';
import { distanceToPort } from './trade';
import { MAX_UPGRADE_LEVEL, UPGRADE_TRACKS } from './upgrades';
import { WEATHER_KINDS } from './wind';
import { TUNING } from '../data/tuning';

/**
 * The Free Sailing presets' checks (decision 0266), shared by the game's tests, the editor page
 * and `npm run free` / `npm run check`. A start is safe for every ship: clear water for the
 * widest hull and the deepest keel, away from every harbour's docking reach, inside the sea.
 */
export function presetProblems(presets: FreePreset[], map: MapDef, rules: FreeRules): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const p of presets) {
    const where = `free-sailing/${p.id}`;
    if (!/^[a-z0-9-]+$/.test(p.id)) out.push(`${where}: id must be lower-case letters, digits, -`);
    if (ids.has(p.id)) out.push(`${where}: id used twice`);
    ids.add(p.id);
    for (const field of ['name', 'about'] as const)
      for (const lang of ['en', 'fr'] as const)
        if (!p[field]?.[lang]?.trim()) out.push(`${where}: ${field}.${lang} is empty`);
    out.push(...shipProblems(p).map((m) => `${where}: ${m}`));
    out.push(...placeProblems(p, map, rules).map((m) => `${where}: ${m}`));
    if (!rules.weatherIcons?.[p.weather])
      out.push(`${where}: no weatherIcons entry for "${p.weather}"`);
    out.push(...timeProblems(p, map, rules).map((m) => `${where}: ${m}`));
  }
  return out;
}

function shipProblems(p: FreePreset): string[] {
  if (!SHIP_CLASSES[p.ship?.class]) return [`ship.class "${p.ship?.class}" is not a ship`];
  return UPGRADE_TRACKS.filter((t) => {
    const n = p.ship[t];
    return !Number.isInteger(n) || n < 1 || n > MAX_UPGRADE_LEVEL;
  }).map((t) => `ship.${t} must be 1 to ${MAX_UPGRADE_LEVEL}`);
}

/** The widest hull and the deepest keel of every ship the setup offers. */
function largestHull() {
  const ships = Object.values(SHIP_CLASSES);
  return {
    radius: Math.max(...ships.map((s) => s.radius)),
    draft: Math.max(...ships.map((s) => s.draft)),
  };
}

function placeProblems(p: FreePreset, map: MapDef, rules: FreeRules): string[] {
  const { x, y, headingDeg } = p.place ?? {};
  if (![x, y, headingDeg].every(Number.isFinite)) return ['place needs x, y and headingDeg'];
  const out: string[] = [];
  const hull = largestHull();
  if (Math.hypot(x, y) > map.boundsRadius - rules.clearance - hull.radius)
    out.push('place is outside the sea');
  if (!clearAt(map, x, y, hull.radius + rules.clearance, hull.draft))
    out.push(`place is within ${rules.clearance} m of land or shallows for the largest ship`);
  const { dockRange, berthReach } = TUNING.seamanship.harbour;
  for (const port of map.ports)
    if (distanceToPort(map, { x, y }, port) <= dockRange + berthReach + rules.clearance)
      out.push(`place is inside ${port.name}'s docking reach`);
  if (!runwayClear(x, y, headingDeg, map, rules, hull))
    out.push(`less than ${rules.runway} m of open water ahead on headingDeg ${headingDeg}`);
  return out;
}

/** Open water ahead, so she can sail off the start before the player turns her. */
function runwayClear(
  x: number,
  y: number,
  headingDeg: number,
  map: MapDef,
  rules: FreeRules,
  hull: { radius: number; draft: number },
): boolean {
  const ahead = bearingVector((headingDeg * Math.PI) / 180);
  for (let d = RUNWAY_STEP; d <= rules.runway; d += RUNWAY_STEP)
    if (!clearAt(map, x + ahead.x * d, y + ahead.y * d, hull.radius + RUNWAY_STEP, hull.draft))
      return false;
  return true;
}

/** Metres between the points tested along the runway. */
const RUNWAY_STEP = 20;

function timeProblems(p: FreePreset, map: MapDef, rules: FreeRules): string[] {
  if (!Number.isFinite(p.hour) || p.hour < 0 || p.hour >= 24) return ['hour must be 0 to 24'];
  if (!WEATHER_KINDS.includes(p.weather))
    return [`weather "${p.weather}" is not one of ${WEATHER_KINDS.join(', ')}`];
  const base = map.wind.weather;
  if (!base) return [];
  // Every level shapes the weather its own way (decision 0083): the preset must come on each.
  return DIFFICULTIES.filter(
    (d) => presetTime(p, weatherFor(base, d, false), map.seed, 0, rules.searchDays) === null,
  ).map((d) => `no ${p.weather} at ${p.hour} h within ${rules.searchDays} days on ${d}`);
}
