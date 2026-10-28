import { TUNING } from '../data/tuning';
import { DEG } from './math';
import type { RaceCourse } from './regatta';
import { type Storm, blowStorm } from './storms';
import type { Wind } from './wind';
import type { World } from './world';

/**
 * A race's own storms (decision 0225): listed in the race file, the same on every run, so the bots
 * set the pars round them and each level stays fair. They replace the seeded storms while the race
 * runs, and Settings › Storms still turns them off.
 */
export interface RaceStormDef {
  x: number;
  y: number;
  /** Map units; `weather.raceStorms.radius` when left out. */
  radius?: number;
  /** 0..1, 1 = a full storm core; `weather.raceStorms.strength` when left out. */
  strength?: number;
  /** Slow drift: the compass bearing it moves toward, and its speed in map units per second. */
  driftDeg?: number;
  driftSpeed?: number;
}

const tuning = () => TUNING.weather.raceStorms;

/** The live storms of a race at `sec` seconds after the horn: made once, moved in place. */
export interface RaceStorms {
  defs: readonly RaceStormDef[];
  storms: Storm[];
}

export function makeRaceStorms(defs: readonly RaceStormDef[]): RaceStorms {
  const storms = defs.map((d, i): Storm => ({
    id: -1 - i,
    x: d.x,
    y: d.y,
    radius: d.radius ?? tuning().radius,
    intensity: d.strength ?? tuning().strength,
    dx: Math.sin((d.driftDeg ?? 0) * DEG),
    dy: Math.cos((d.driftDeg ?? 0) * DEG),
  }));
  return { defs, storms };
}

/** Puts each storm where its drift has taken it `sec` seconds after the horn (0 before it). */
export function moveRaceStorms({ defs, storms }: RaceStorms, sec: number) {
  const t = Math.max(0, sec);
  defs.forEach((d, i) => {
    const s = storms[i]!;
    const run = (d.driftSpeed ?? 0) * t;
    s.x = d.x + s.dx * run;
    s.y = d.y + s.dy * run;
  });
}

/** Problems with a race's `storms`, for the quest checks (the map checks come on top). */
export function checkRaceStormDefs(storms: unknown, at: string): string[] {
  if (storms === undefined) return [];
  if (!Array.isArray(storms)) return [`${at}: storms is a list`];
  const t = tuning();
  const out: string[] = [];
  storms.forEach((d: Record<string, unknown>, i) => {
    const here = `${at}[${i + 1}]`;
    if (typeof d !== 'object' || d === null) return void out.push(`${here}: not a storm`);
    const num = (key: string) => d[key] === undefined || Number.isFinite(d[key]);
    for (const key of ['x', 'y'])
      if (!Number.isFinite(d[key])) out.push(`${here}.${key}: a number`);
    for (const key of ['radius', 'strength', 'driftDeg', 'driftSpeed'])
      if (!num(key)) out.push(`${here}.${key}: a number`);
    for (const key of Object.keys(d))
      if (!['x', 'y', 'radius', 'strength', 'driftDeg', 'driftSpeed'].includes(key))
        out.push(`${here}: a storm has no "${key}"`);
    const r = d.radius as number | undefined;
    if (r !== undefined && !(r >= t.minRadius && r <= t.maxRadius))
      out.push(`${here}.radius: ${t.minRadius} to ${t.maxRadius}`);
    const s = d.strength as number | undefined;
    if (s !== undefined && !(s > 0 && s <= 1)) out.push(`${here}.strength: above 0, at most 1`);
    const v = d.driftSpeed as number | undefined;
    if (v !== undefined && !(v >= 0 && v <= t.maxDriftSpeed))
      out.push(`${here}.driftSpeed: 0 to ${t.maxDriftSpeed}`);
    if ((v ?? 0) > 0 && d.driftDeg === undefined) out.push(`${here}: a drift needs driftDeg`);
  });
  return out;
}

/** How long a storm's drift is checked against the course when the race has no pars yet (s). */
const CHECK_SEC = 600;
/** Seconds between the drift positions the checks look at. */
const CHECK_STEP_SEC = 30;

/** Every point a storm must keep off: both ends of the two lines, and each mark. */
const courseSpots = (course: RaceCourse) => [...course.start, ...course.marks, ...course.finish];

/**
 * Problems with where a race's storms sit (decision 0225): the whole drift stays inside the sea,
 * and no storm core lies on the start line, the finish line or a mark while the race can run.
 * `horizonSec` is the longest par (the drift is followed that long). Whether the bots can still
 * get round is checked when the pars are sailed (`npm run race -- <id> --pars`).
 */
export function checkRaceStormSpots(
  defs: readonly RaceStormDef[],
  course: RaceCourse,
  seaRadius: number,
  horizonSec: number | undefined,
  at: string,
): string[] {
  const out: string[] = [];
  const spots = courseSpots(course);
  const raceStorms = makeRaceStorms(defs);
  const end = horizonSec ?? CHECK_SEC;
  const coreShare = TUNING.weather.storms.coreShare;
  for (let sec = 0; sec <= end + CHECK_STEP_SEC; sec += CHECK_STEP_SEC) {
    moveRaceStorms(raceStorms, sec);
    raceStorms.storms.forEach((s, i) => {
      const here = `${at}[${i + 1}]`;
      const when = sec ? ` ${sec} s in` : '';
      if (Math.hypot(s.x, s.y) > seaRadius) out.push(`${here}: outside the sea${when}`);
      if (spots.some((p) => Math.hypot(p.x - s.x, p.y - s.y) < s.radius * coreShare))
        out.push(`${here}: its core sits on the start, finish or a mark${when}`);
    });
    if (out.length) break;
  }
  return out;
}

/**
 * Keeps the world's race storms in step with the race running (`defs`, from the quest, or none)
 * and its clock `sec` after the horn. Cheap: the storms are made once per race and moved in place.
 */
export function syncRaceStorms(
  world: World,
  defs: readonly RaceStormDef[] | undefined,
  sec: number,
) {
  if (!defs?.length) {
    world.raceStorms = null;
    return;
  }
  if (world.raceStorms?.defs !== defs) world.raceStorms = makeRaceStorms(defs);
  moveRaceStorms(world.raceStorms, sec);
}

/** The race storms that blow now: none with Settings › Weather or Storms off (decision 0067). */
export function blowingRaceStorms(world: World): readonly Storm[] {
  return world.raceStorms && world.dynamicWeather && world.storms ? world.raceStorms.storms : [];
}

/** The sea wind at `pos` with the race's storms on it; the same wind when there are none. */
export function raceStormWind(world: World, sea: Wind, pos: { x: number; y: number }): Wind {
  const storms = blowingRaceStorms(world);
  if (!storms.length) return sea;
  const wind = { ...sea };
  for (const s of storms) blowStorm(s, pos.x, pos.y, wind);
  return wind;
}

/** Blows the race's storms on the sea wind at the boat and shows them in the weather (0225). */
export function applyRaceStorms(world: World) {
  const storms = blowingRaceStorms(world);
  if (!storms.length) return;
  const { boat, weather } = world;
  let hit = 0;
  for (const s of storms) hit = Math.max(hit, blowStorm(s, boat.x, boat.y, world.seaWind));
  weather.storms = [...weather.storms, ...storms];
  weather.storm = Math.max(weather.storm, hit);
  weather.rain = Math.max(weather.rain, hit);
}
