import {
  addRaceStorm,
  moveRaceStorm,
  removeRaceStorm,
  shapeRaceStorm,
} from '../../src/editor/quest/raceStormDoc';
import type { QuestDef } from '../../src/sim/quests';

export const STORM_HELP = `  race <id> --storm --at x,y [--radius n] [--strength 0..1] [--drift deg --speed n]
                                a storm the race always has (the same every run)
  race <id> --storm N [--at x,y] [--radius n] [--strength s] [--drift deg --speed n]
                                change storm N (1 = first); --drift none stops it drifting
  race <id> --storm N --remove  remove storm N`;

type Args = Record<string, string | boolean | undefined>;

const USAGE =
  'race <id> --storm [N] [--at x,y] [--radius n] [--strength s] [--drift deg --speed n] | --remove';

function parseXy(v: unknown) {
  const p = typeof v === 'string' ? v.split(',').map(Number) : [];
  return p.length === 2 && p.every(Number.isFinite) ? { x: p[0]!, y: p[1]! } : null;
}

/** A numeric option: undefined when absent, null for `none`, NaN for junk (a usage error). */
function option(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === 'none') return null;
  return typeof v === 'string' && v !== '' ? Number(v) : NaN;
}

/**
 * `race <id> --storm …` (decision 0225): adds, changes or removes one of the race's storms with the
 * builder's edits. Returns the line to print, or an error to print with the usage.
 */
export function stormEdit(q: QuestDef, args: Args): { said: string } | { error: string } {
  const at = args.at === undefined ? undefined : parseXy(args.at);
  const driftDeg = option(args.drift);
  const driftSpeed = option(args.speed);
  const shape = {
    radius: option(args.radius),
    strength: option(args.strength),
    driftDeg,
    // `--drift none` stops it; a drift needs both, and only the bearing given keeps its speed.
    driftSpeed: driftDeg === null ? null : driftSpeed,
  };
  const given = Object.values(shape).filter((v) => v !== undefined);
  if (given.some((v) => v !== null && Number.isNaN(v)) || at === null) return { error: USAGE };
  const clean = Object.fromEntries(Object.entries(shape).filter(([, v]) => v !== undefined));
  if (args.storm === true) {
    if (!at) return { error: USAGE };
    const i = addRaceStorm(q, at, clean as never);
    return { said: `${q.id}: storm ${i + 1} at ${at.x},${at.y}` };
  }
  const i = Number(args.storm) - 1;
  if (!q.race?.storms?.[i]) return { error: `no storm ${args.storm} (${USAGE})` };
  if (args.remove) {
    removeRaceStorm(q, i);
    return { said: `${q.id}: storm ${i + 1} removed` };
  }
  if (at) moveRaceStorm(q, i, at);
  if (given.length) shapeRaceStorm(q, i, clean as never);
  if (!at && !given.length) return { error: USAGE };
  return { said: `${q.id}: storm ${i + 1} changed` };
}
