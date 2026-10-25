import regattaData from '../data/regatta.json';
import flagData from '../data/flags.json';
import { isDifficulty, type Difficulty } from './difficulty';
import type { SeaMarkDef } from './map';
import { SHIP_CLASSES } from './ship';

/*
 * The Saltmere Regatta (decision 0217, Phase 5 parts 6 and 7). A race is a quest with a `race`
 * block (its series, the gold its medals pay the first time, its pars) and one step whose goal is
 * `raced`: a start line, numbered marks to round in order and a finish line. The horn sequence,
 * the clock and the marks are the quest engine's (`questLibrary.ts`); this file holds the numbers
 * of `regatta.json`, the medals and pars, the lines' geometry and the flags of `flags.json`.
 * Nothing fails: a slow finish still finishes, and a race done can be sailed again.
 */

export const MEDALS = ['bronze', 'silver', 'gold'] as const;
export type Medal = (typeof MEDALS)[number];
/** A medal as a number, as saved: 0 none, 1 bronze, 2 silver, 3 gold. */
export type MedalRank = 0 | 1 | 2 | 3;

/** A race's own numbers, in its quest file's `race` block. */
export interface RaceDef {
  /** The series it counts for (`regatta.json` › `series`). */
  series: string;
  /** Gold paid the first time each medal is won (a first gold pays all three). */
  gold: Record<Medal, number>;
  /**
   * Seconds the balance bots take round the course, per ship class and difficulty level
   * (`npm run race -- pars <id> --write`): the gold medal's time, the others × `medals`.
   */
  pars: Record<string, Record<string, number>>;
}

export interface SeriesDef {
  id: string;
  name: string;
  /** The masthead flag a series won flies (`flags.json`). */
  pennant: string;
}

export interface RivalDef {
  name: string;
  skipper: string;
  ship: string;
  sailNumber: string;
  hull: string;
  band: string;
  flag: string;
  /** The medal whose time she sails to, on the captain's ship and level. */
  pace: Medal;
  /** Her speed × this at most and at least, whatever the captain sails. */
  paceRange: [number, number];
  /** Clear water she keeps from the captain while they wait at the line, map units. */
  berth: number;
  /** How far she sails on past the finish line before she lies there, clear of it. */
  runOut: number;
}

export interface RegattaData {
  countdownSec: number;
  /** How close a mark is rounded, map units. */
  within: number;
  /** A start or finish line is at least this long, so two big ships fit on it side by side. */
  minLine: number;
  /** Each medal's time as a share of more than the par (gold 1). */
  medals: Record<Medal, number>;
  /** The medal every race of a series needs for the series to be won. */
  winMedal: Medal;
  rival: RivalDef;
  series: SeriesDef[];
}

export const REGATTA = regattaData as unknown as RegattaData;

export type FlagShape = 'pennant' | 'swallowtail' | 'burgee';
export const FLAG_SHAPES: readonly FlagShape[] = ['pennant', 'swallowtail', 'burgee'];

/** A flag of `flags.json`: its shape, its colours from the mast out, its size. */
export interface FlagDef {
  id: string;
  shape: FlagShape;
  bands: string[];
  length: number;
  height: number;
}

export const FLAGS = flagData.flags as FlagDef[];
export const flagById = (id: string | undefined) => FLAGS.find((f) => f.id === id);

/** A line on the water: two points, the committee boat's end first, then the pin's. */
export type Gate = [{ x: number; y: number }, { x: number; y: number }];
type Pt = { x: number; y: number };

export const medalRank = (m: Medal): MedalRank => (MEDALS.indexOf(m) + 1) as MedalRank;
export const medalOf = (rank: number): Medal | null => MEDALS[rank - 1] ?? null;
export const seriesById = (id: string) => REGATTA.series.find((s) => s.id === id);

/**
 * The par of a race for a ship class on a level, seconds: its own, or for a class the bots have
 * not sailed, the slowest par listed (a ship added later is never held to a faster one).
 */
export function parOf(race: RaceDef, ship: string, difficulty: Difficulty): number {
  const of = (levels: Record<string, number> | undefined) =>
    levels ? (levels[difficulty] ?? Math.max(...Object.values(levels))) : undefined;
  const own = of(race.pars[ship]);
  if (own !== undefined) return own;
  const all = Object.values(race.pars).map((l) => of(l)!);
  return all.length ? Math.max(...all) : Infinity;
}

/** Each medal's time for this ship and level, seconds. */
export function medalTimes(race: RaceDef, ship: string, difficulty: Difficulty) {
  const par = parOf(race, ship, difficulty);
  return Object.fromEntries(MEDALS.map((m) => [m, par * REGATTA.medals[m]])) as Record<
    Medal,
    number
  >;
}

/** The medal a finish in `sec` wins, as a number. */
export function medalFor(
  race: RaceDef,
  ship: string,
  difficulty: Difficulty,
  sec: number,
): MedalRank {
  const times = medalTimes(race, ship, difficulty);
  for (const m of [...MEDALS].reverse()) if (sec <= times[m]) return medalRank(m);
  return 0;
}

/** Gold for the medals won now and never before: every rank above `had` up to `won`. */
export function medalGold(race: RaceDef, had: number, won: number): number {
  let gold = 0;
  for (let r = had + 1; r <= won; r++) gold += race.gold[medalOf(r)!] ?? 0;
  return gold;
}

/**
 * The series won (decision 0217): every race of a series has its `winMedal` or better. `races`
 * are the race quests, `medal` a race's best medal so far.
 */
export function seriesWon(
  races: readonly { id: string; race?: RaceDef }[],
  medal: (id: string) => number,
): string[] {
  const need = medalRank(REGATTA.winMedal);
  return REGATTA.series
    .filter((s) => {
      const of = races.filter((q) => q.race?.series === s.id);
      return of.length > 0 && of.every((q) => medal(q.id) >= need);
    })
    .map((s) => s.id);
}

/** The pennant the masthead flies: the latest series in `regatta.json` won. */
export function pennantFor(won: readonly string[]): FlagDef | undefined {
  const last = [...REGATTA.series].reverse().find((s) => won.includes(s.id));
  return last && flagById(last.pennant);
}

/**
 * How fast the rival sails (decision 0217): a share of her ship's speed so she finishes about on
 * the captain's `pace` medal time, on the captain's ship and level.
 */
export function rivalPace(race: RaceDef, ship: string, difficulty: Difficulty): number {
  const { rival, medals } = REGATTA;
  const hers = parOf(race, rival.ship, difficulty);
  const want = parOf(race, ship, difficulty) * medals[rival.pace];
  const [lo, hi] = rival.paceRange;
  if (!Number.isFinite(hers) || !Number.isFinite(want) || want <= 0) return 1;
  return Math.min(hi, Math.max(lo, hers / want));
}

/** Which side of a line a point is: positive left of committee → pin, negative right. */
export function gateSide(gate: Gate, p: Pt): number {
  const [a, b] = gate;
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

/** Whether a move from `p` to `q` crosses the line between its two ends. */
export function crossesGate(gate: Gate, p: Pt, q: Pt): boolean {
  const [a, b] = gate;
  const s1 = gateSide(gate, p);
  const s2 = gateSide(gate, q);
  if ((s1 > 0 && s2 > 0) || (s1 < 0 && s2 < 0) || (s1 === 0 && s2 === 0)) return false;
  const line = [p, q] as unknown as Gate;
  const t1 = gateSide(line, a);
  const t2 = gateSide(line, b);
  return !((t1 > 0 && t2 > 0) || (t1 < 0 && t2 < 0));
}

/**
 * Whether a move crosses the start line toward the course (`toward`: a point on the course side,
 * the first mark): from the far side to the course side. A boat over the line at the horn comes
 * back and crosses again.
 */
export function crossesForward(gate: Gate, p: Pt, q: Pt, toward: Pt): boolean {
  const course = Math.sign(gateSide(gate, toward));
  return (
    course !== 0 &&
    Math.sign(gateSide(gate, p)) !== course &&
    Math.sign(gateSide(gate, q)) === course &&
    crossesGate(gate, p, q)
  );
}

export const gateMid = (g: Gate): Pt => ({ x: (g[0].x + g[1].x) / 2, y: (g[0].y + g[1].y) / 2 });

const sameGate = (a: Gate, b: Gate) =>
  a[0].x === b[0].x && a[0].y === b[0].y && a[1].x === b[1].x && a[1].y === b[1].y;

/** A race goal's parts, as the quest file has them. */
export interface RaceCourse {
  start: Gate;
  marks: Pt[];
  finish: Gate;
}

/**
 * What a race puts on the water while it runs (decision 0217): the committee boat and pin of the
 * start line, numbered yellow marks, and the finish line's boat with its chequered flag (one boat
 * when the race starts and finishes on the same line).
 */
export function raceMarks(course: RaceCourse): SeaMarkDef[] {
  const out: SeaMarkDef[] = [];
  const turn = (g: Gate) => {
    // The committee boat lies head to the line's far end.
    const dx = g[1].x - g[0].x;
    const dy = g[1].y - g[0].y;
    return Math.round((Math.atan2(dx, dy) * 180) / Math.PI);
  };
  const same = sameGate(course.start, course.finish);
  out.push({
    type: same ? 'race-finish' : 'race-committee',
    x: course.start[0].x,
    y: course.start[0].y,
    turn: turn(course.start),
    chart: true,
  });
  out.push({ type: 'race-pin', x: course.start[1].x, y: course.start[1].y, chart: true });
  course.marks.forEach((m, i) =>
    out.push({ type: 'race-mark', x: m.x, y: m.y, name: String(i + 1), chart: true }),
  );
  if (!same) {
    out.push({
      type: 'race-finish',
      x: course.finish[0].x,
      y: course.finish[0].y,
      turn: turn(course.finish),
      chart: true,
    });
    out.push({ type: 'race-pin', x: course.finish[1].x, y: course.finish[1].y, chart: true });
  }
  return out;
}

/** The course of a race step's goal, or null when it is no `raced` goal. */
export function courseOf(
  goal: { is: string; [k: string]: unknown } | undefined,
): RaceCourse | null {
  if (goal?.is !== 'raced') return null;
  return { start: goal.start as Gate, marks: goal.marks as Pt[], finish: goal.finish as Gate };
}

/** Problems with a quest's `race` block, as readable lines. */
export function checkRaceDef(race: unknown, at: string): string[] {
  if (typeof race !== 'object' || race === null || Array.isArray(race))
    return [`${at}: not a race`];
  const r = race as Record<string, unknown>;
  const out: string[] = [];
  for (const key of Object.keys(r))
    if (!['series', 'gold', 'pars'].includes(key)) out.push(`${at}: a race has no "${key}"`);
  if (!seriesById(r.series as string))
    out.push(`${at}.series: one of ${REGATTA.series.map((s) => s.id).join(', ')}`);
  const gold = r.gold as Record<string, unknown> | undefined;
  if (typeof gold !== 'object' || gold === null) out.push(`${at}.gold: bronze, silver, gold`);
  else
    for (const m of MEDALS)
      if (!(Number.isInteger(gold[m]) && (gold[m] as number) >= 0))
        out.push(`${at}.gold.${m}: a whole number`);
  const pars = r.pars as Record<string, unknown> | undefined;
  if (typeof pars !== 'object' || pars === null || Array.isArray(pars))
    out.push(`${at}.pars: ship class → level → seconds (npm run race -- pars)`);
  else
    for (const [ship, levels] of Object.entries(pars)) {
      if (!SHIP_CLASSES[ship]) out.push(`${at}.pars: no ship "${ship}"`);
      if (typeof levels !== 'object' || levels === null) {
        out.push(`${at}.pars.${ship}: level → seconds`);
        continue;
      }
      for (const [level, sec] of Object.entries(levels))
        if (!isDifficulty(level) || !(typeof sec === 'number' && sec > 0))
          out.push(`${at}.pars.${ship}.${level}: a level and seconds`);
    }
  return out;
}

/** Problems with `regatta.json` and `flags.json`. */
export function checkRegattaData(
  data: RegattaData = REGATTA,
  flags: readonly FlagDef[] = FLAGS,
): string[] {
  const out: string[] = [];
  const { medals, rival, series, winMedal, countdownSec, within, minLine } = data;
  const flag = (id: string) => flags.some((f) => f.id === id);
  const colour = (c: unknown) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  if (!(countdownSec >= 0)) out.push('regatta.json › countdownSec: seconds');
  if (!(within > 0)) out.push('regatta.json › within: map units');
  if (!(minLine > 0)) out.push('regatta.json › minLine: map units');
  let last = Infinity;
  for (const m of MEDALS) {
    if (!(medals[m] > 0 && medals[m] <= last))
      out.push(`regatta.json › medals.${m}: above 0, at most the medal below`);
    last = medals[m];
  }
  if (!MEDALS.includes(winMedal)) out.push('regatta.json › winMedal: a medal');
  if (!MEDALS.includes(rival.pace)) out.push('regatta.json › rival.pace: a medal');
  if (!SHIP_CLASSES[rival.ship]) out.push(`regatta.json › rival.ship: no ship "${rival.ship}"`);
  if (!flag(rival.flag)) out.push(`regatta.json › rival.flag: no flag "${rival.flag}"`);
  if (!rival.name?.trim()) out.push('regatta.json › rival.name: a name');
  if (!colour(rival.hull)) out.push('regatta.json › rival.hull: a colour #rrggbb');
  if (!colour(rival.band)) out.push('regatta.json › rival.band: a colour #rrggbb');
  const [lo, hi] = rival.paceRange ?? [];
  if (!(lo! > 0 && hi! >= lo!))
    out.push('regatta.json › rival.paceRange: [lowest, highest] above 0');
  if (!(rival.berth >= 0)) out.push('regatta.json › rival.berth: map units');
  if (!(rival.runOut >= 0)) out.push('regatta.json › rival.runOut: map units');
  const seen = new Set<string>();
  for (const s of series) {
    if (seen.has(s.id)) out.push(`regatta.json › ${s.id}: series id used twice`);
    seen.add(s.id);
    if (!flag(s.pennant)) out.push(`regatta.json › ${s.id}.pennant: no flag "${s.pennant}"`);
  }
  const ids = new Set<string>();
  for (const f of flags) {
    if (ids.has(f.id)) out.push(`flags.json › ${f.id}: id used twice`);
    ids.add(f.id);
    if (!FLAG_SHAPES.includes(f.shape))
      out.push(`flags.json › ${f.id}.shape: one of ${FLAG_SHAPES.join(', ')}`);
    if (!f.bands?.length || !f.bands.every(colour))
      out.push(`flags.json › ${f.id}.bands: colours #rrggbb`);
    if (!(f.length > 0 && f.height > 0)) out.push(`flags.json › ${f.id}: length and height`);
  }
  return out;
}
