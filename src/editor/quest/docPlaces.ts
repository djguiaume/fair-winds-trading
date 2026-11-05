import type { MapDef, SeaMarkDef, SeaMarkType } from '../../sim/map';
import type { StepWind } from '../../sim/stepEffects';
import { REGATTA } from '../../sim/regatta';
import { type Condition, type QuestPoint, isSpot } from '../../sim/questLibrary';
import { type QuestDef, type QuestStep } from '../../sim/quests';

/* A quest's places at sea as the quest builder edits them (decisions 0142, 0164, 0217). */

// --- Places at sea -------------------------------------------------------------------------

/** A path from a quest step to a value inside it (`["goal", "of", 0, "points", 2]`). */
export type Path = (string | number)[];

/** A place the chart draws for a step, with where it lives in the step to drag it. */
export interface Place {
  kind: 'point' | 'via' | 'spot' | 'compass' | 'chart';
  x: number;
  y: number;
  /** Radius drawn and dragged; 0 for a bare point (compass). */
  within: number;
  /** The `{ x, y }` object's path in the step. */
  path: Path;
  /** Path of the number the radius edits, or null when it is not editable here. */
  radiusPath: Path | null;
  /** Number shown by the ring (1-based), and whether a line joins them in order. */
  no: number;
  ordered: boolean;
  /** Its own label instead of its number ("start pin"), and the line it ends (a race's, 0217). */
  name?: string;
  line?: string;
}

export function getAt(root: unknown, path: Path): unknown {
  let at = root as Record<string | number, unknown> | undefined;
  for (const key of path) at = at?.[key] as Record<string | number, unknown> | undefined;
  return at;
}

export function setAt(root: unknown, path: Path, value: unknown) {
  const parent = getAt(root, path.slice(0, -1)) as Record<string | number, unknown>;
  const key = path[path.length - 1]!;
  if (value === undefined) {
    if (Array.isArray(parent)) parent.splice(Number(key), 1);
    else delete parent[key];
  } else parent[key] = value;
}

/** Every place at sea of a step: its goal's points and spots, its compass and its chart circle. */
export function stepPlaces(step: QuestStep, map: MapDef): Place[] {
  const out: Place[] = [];
  const walk = (c: unknown, path: Path) => {
    if (!c || typeof c !== 'object') return;
    const cond = c as Condition;
    if (cond.is === 'all' || cond.is === 'any')
      ((cond.of as Condition[]) ?? []).forEach((m, i) => walk(m, [...path, 'of', i]));
    if (cond.is === 'not') walk(cond.of, [...path, 'of']);
    if (cond.is === 'reach' && Array.isArray(cond.points)) {
      const within = typeof cond.within === 'number' ? cond.within : 0;
      (cond.points as (QuestPoint | string)[]).forEach(
        (p, i) =>
          // A map place (the prologue's wreck, decision 0151) is where the map puts it: not dragged.
          typeof p === 'object' &&
          out.push({
            kind: 'point',
            x: p.x,
            y: p.y,
            within,
            path: [...path, 'points', i],
            radiusPath: [...path, 'within'],
            no: i + 1,
            ordered: cond.order === 'in-order',
          }),
      );
    }
    if (cond.is === 'timed' && Array.isArray(cond.via)) {
      const within = typeof cond.within === 'number' ? cond.within : 15;
      (cond.via as QuestPoint[]).forEach((p, i) =>
        out.push({
          kind: 'via',
          x: p.x,
          y: p.y,
          within,
          path: [...path, 'via', i],
          radiusPath: [...path, 'within'],
          no: i + 1,
          ordered: true,
        }),
      );
    }
    // A race (decision 0217): its marks in order, and each end of its start and finish lines.
    if (cond.is === 'raced') {
      const within = typeof cond.within === 'number' ? cond.within : REGATTA.within;
      ((cond.marks as QuestPoint[]) ?? []).forEach((p, i) =>
        out.push({
          kind: 'point',
          x: p.x,
          y: p.y,
          within,
          path: [...path, 'marks', i],
          radiusPath: [...path, 'within'],
          no: i + 1,
          ordered: true,
        }),
      );
      // One line for both when the race finishes where it starts.
      const same = JSON.stringify(cond.start) === JSON.stringify(cond.finish);
      (['start', 'finish'] as const).forEach((key) =>
        ((same && key === 'finish' ? [] : (cond[key] as QuestPoint[])) ?? []).forEach((p, i) =>
          out.push({
            kind: 'via',
            x: p.x,
            y: p.y,
            within: 0,
            path: [...path, key, i],
            radiusPath: null,
            no: 0,
            ordered: false,
            name: `${same ? 'line' : key} ${i ? 'pin' : 'boat'}`,
            line: key,
          }),
        ),
      );
    }
    if (cond.is === 'carried')
      (['from', 'to'] as const).forEach((key, i) => {
        const spot = cond[key];
        if (isSpot(spot))
          out.push({
            kind: 'spot',
            x: spot.x,
            y: spot.y,
            within: spot.within,
            path: [...path, key],
            radiusPath: [...path, key, 'within'],
            no: i + 1,
            ordered: false,
          });
      });
    if (cond.is === 'landed' && isSpot(cond.place))
      out.push({
        kind: 'spot',
        x: cond.place.x,
        y: cond.place.y,
        within: cond.place.within,
        path: [...path, 'place'],
        radiusPath: [...path, 'place', 'within'],
        no: 1,
        ordered: false,
      });
  };
  walk(step.goal, ['goal']);
  if (step.compass && typeof step.compass === 'object')
    out.push({
      kind: 'compass',
      x: step.compass.x,
      y: step.compass.y,
      within: 0,
      path: ['compass'],
      radiusPath: null,
      no: 0,
      ordered: false,
    });
  const port = step.chart && map.ports.find((p) => p.id === step.chart!.port);
  const island = port && map.islands.find((i) => i.id === port.islandId);
  if (step.chart && island)
    out.push({
      kind: 'chart',
      x: island.x,
      y: island.y,
      within: step.chart.radius,
      path: ['chart'],
      radiusPath: ['chart', 'radius'],
      no: 0,
      ordered: false,
    });
  return out;
}

/** Where a click with the "add a place" tool goes: the first `reach` points or timed `via`. */
export function addPlace(step: QuestStep, x: number, y: number): Path | null {
  const find = (c: unknown, path: Path): Path | null => {
    if (!c || typeof c !== 'object') return null;
    const cond = c as Condition;
    if (cond.is === 'reach') return [...path, 'points'];
    if (cond.is === 'timed') return [...path, 'via'];
    if (cond.is === 'raced') return [...path, 'marks'];
    if (cond.is === 'all' || cond.is === 'any')
      for (const [i, m] of ((cond.of as Condition[]) ?? []).entries()) {
        const found = find(m, [...path, 'of', i]);
        if (found) return found;
      }
    return null;
  };
  const list = find(step.goal, ['goal']);
  if (!list) return null;
  const points = (getAt(step, list) as (QuestPoint | string)[] | undefined) ?? [];
  setAt(step, list, [...points, { x: round1(x), y: round1(y) }]);
  return [...list, points.length];
}

export const round1 = (v: number) => Math.round(v * 10) / 10;

// --- The quest's own sea (decision 0164): the builder's edits, and `npm run quest`'s -----------

/** Where the step takes the boat when it begins (`moveTo`); null clears it. */
export function setStepMove(
  step: QuestStep,
  at: QuestPoint | null,
  headingDeg = step.moveTo?.headingDeg,
) {
  if (!at) {
    delete step.moveTo;
    return;
  }
  step.moveTo = { x: round1(at.x), y: round1(at.y) };
  if (headingDeg !== undefined) step.moveTo.headingDeg = headingDeg;
}

/** A sea mark of the quest's own (a yellow practice buoy by default); returns its index. */
export function addQuestMark(
  quest: QuestDef,
  at: QuestPoint,
  type: SeaMarkType = 'buoy-yellow',
  name?: string,
): number {
  const mark: SeaMarkDef = { type, x: round1(at.x), y: round1(at.y) };
  if (name) mark.name = name;
  quest.marks = [...(quest.marks ?? []), mark];
  return quest.marks.length - 1;
}

/** Removes the quest's mark `i` (0-based); false when there is none. */
export function removeQuestMark(quest: QuestDef, i: number): boolean {
  if (!quest.marks?.[i]) return false;
  quest.marks.splice(i, 1);
  if (!quest.marks.length) delete quest.marks;
  return true;
}

/** A held breeze on a quest or a step; no speed clears it, no bearing keeps the sea's. */
export function setWind(target: { wind?: StepWind }, speedKn?: number, fromDeg?: number) {
  if (speedKn === undefined) {
    delete target.wind;
    return;
  }
  target.wind = fromDeg === undefined ? { speedKn } : { speedKn, fromDeg };
}

// --- Races (decision 0217) ----------------------------------------------------------------------

/** A race's `raced` goal (its one step's), or null for a quest that is no race. */
export function raceGoal(quest: QuestDef): Condition | null {
  const goal = quest.race ? quest.steps[0]?.goal : undefined;
  return goal?.is === 'raced' ? goal : null;
}

/** A race's start or finish line: the committee boat's end, then the pin's. */
export function setRaceLine(
  quest: QuestDef,
  which: 'start' | 'finish',
  a: QuestPoint,
  b: QuestPoint,
): boolean {
  const goal = raceGoal(quest);
  if (!goal) return false;
  goal[which] = [
    { x: round1(a.x), y: round1(a.y) },
    { x: round1(b.x), y: round1(b.y) },
  ];
  return true;
}

/** Adds a race mark at `at` (after mark `after`, 0-based; at the end by default); its index. */
export function addRaceMark(quest: QuestDef, at: QuestPoint, after?: number): number {
  const goal = raceGoal(quest);
  if (!goal) return -1;
  const marks = [...((goal.marks as QuestPoint[]) ?? [])];
  const i = after === undefined ? marks.length : Math.min(marks.length, after + 1);
  marks.splice(i, 0, { x: round1(at.x), y: round1(at.y) });
  goal.marks = marks;
  return i;
}

/** Moves race mark `i` (0-based); false when there is none. */
export function moveRaceMark(quest: QuestDef, i: number, at: QuestPoint): boolean {
  const marks = raceGoal(quest)?.marks as QuestPoint[] | undefined;
  if (!marks?.[i]) return false;
  marks[i] = { x: round1(at.x), y: round1(at.y) };
  return true;
}

/** Removes race mark `i` (0-based); a race keeps at least one. */
export function removeRaceMark(quest: QuestDef, i: number): boolean {
  const marks = raceGoal(quest)?.marks as QuestPoint[] | undefined;
  if (!marks?.[i] || marks.length < 2) return false;
  marks.splice(i, 1);
  return true;
}

/** A race's pars (ship class → level → seconds), from `npm run race -- pars` or the builder. */
export function setRacePars(quest: QuestDef, pars: Record<string, Record<string, number>>) {
  if (quest.race) quest.race.pars = pars;
}
