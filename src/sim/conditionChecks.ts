import { isDifficulty } from './difficulty';
import { isGood } from './goods';
import { buildingById, homeSpots } from './home';
import type { MapDef } from './map';

import { seriesById } from './regatta';
import { SHIP_CLASSES, type PointOfSail } from './ship';
import {
  type Condition,
  MAP_PLACES,
  type Param,
  POINTS_OF_SAIL,
  type QuestPoint,
  SCREENS,
  type Screen,
  isSpot,
  isVarRef,
  resolvePort,
} from './conditionBasics';
import { CONDITIONS } from './questConditions';

/* The checks of the quest conditions in the files (decision 0125), as readable lines. */

/** What the checks need to know beyond the condition. */
export interface CheckScope {
  map: MapDef;
  /** Quest id → its choice options' ids. */
  quests: Map<string, string[]>;
  /** Quest id → its step ids, where known. */
  steps: Map<string, string[]>;
  /** The checked quest's items. */
  items: string[];
  /** The checked quest's vars (decision 0151): name → what it holds. */
  vars?: Record<string, VarKind>;
}

/** What a quest var holds (decision 0151). */
export const VAR_KINDS = ['port', 'good'] as const;
export type VarKind = (typeof VAR_KINDS)[number];

export const isCount = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isPoint = (p: unknown) =>
  typeof p === 'object' &&
  p !== null &&
  Number.isFinite((p as QuestPoint).x) &&
  Number.isFinite((p as QuestPoint).y);

function checkParam(
  type: Param,
  v: unknown,
  c: Condition,
  scope: CheckScope,
  inGoal: boolean,
  where: string,
): string[] {
  const out: string[] = [];
  const bad = (what: string) => out.push(`${where}: ${what}`);
  if (isVarRef(v) && (type === 'port' || type === 'place' || type === 'good')) {
    const kind = scope.vars?.[v.slice(1)];
    const want = type === 'good' ? 'good' : 'port';
    if (kind !== want) bad(`no ${want} var "${v.slice(1)}" in the quest's vars`);
    return out;
  }
  if (type === 'port' && !resolvePort(scope.map, v)) bad(`no port "${String(v)}"`);
  if (type === 'place') {
    if (!isSpot(v)) {
      if (!resolvePort(scope.map, v)) bad(`no port "${String(v)}"`);
    } else {
      const spot = v as unknown as Record<string, unknown>;
      if (!isPoint(spot) || !(isNumber(spot.within) && (spot.within as number) > 0))
        bad('a spot at sea needs "x", "y" and "within"');
      for (const key of ['maxKn', 'holdSec'])
        if (spot[key] !== undefined && !isNumber(spot[key])) bad(`${key} needs a number`);
      for (const key of Object.keys(spot))
        if (!['x', 'y', 'within', 'maxKn', 'holdSec'].includes(key)) bad(`a spot has no "${key}"`);
    }
  }
  if (type === 'good' && !isGood(v)) bad(`no good "${String(v)}"`);
  if (type === 'ship' && !(typeof v === 'string' && SHIP_CLASSES[v])) bad(`no ship "${String(v)}"`);
  if (type === 'series' && !(typeof v === 'string' && seriesById(v)))
    bad(`no series "${String(v)}"`);
  if (type === 'building' && !buildingById(v as string)) bad(`no building "${String(v)}"`);
  if (type === 'island' && !homeSpots(scope.map, v as string).length)
    bad(`no island with build spots "${String(v)}"`);
  if (type === 'quest' && !(typeof v === 'string' && scope.quests.has(v)))
    bad(`no quest "${String(v)}"`);
  if (type === 'step') {
    const steps = scope.steps.get(c.quest as string);
    if (typeof v !== 'string' || (steps && !steps.includes(v))) bad(`no step "${String(v)}"`);
  }
  if (type === 'option') {
    const options = scope.quests.get(c.quest as string);
    if (options && !options.includes(v as string)) bad(`no option "${String(v)}"`);
  }
  if (type === 'item' && !scope.items.includes(v as string))
    bad(`no item "${String(v)}" in the quest's items`);
  if (type === 'count' && !isCount(v)) bad('needs a whole number');
  if (type === 'number' && !isNumber(v)) bad('needs a number');
  if (type === 'flag' && typeof v !== 'boolean') bad('needs true or false');
  if (type === 'order' && v !== 'any' && v !== 'in-order') bad('needs "any" or "in-order"');
  if (type === 'sailing' && !POINTS_OF_SAIL.includes(v as PointOfSail))
    bad(`needs one of ${POINTS_OF_SAIL.join(', ')}`);
  if (type === 'screen' && !SCREENS.includes(v as Screen))
    bad(`needs one of ${SCREENS.join(', ')}`);
  if (type === 'points') {
    if (
      !Array.isArray(v) ||
      v.length === 0 ||
      !v.every((p) => isPoint(p) || (typeof p === 'string' && p in MAP_PLACES))
    )
      bad(`needs a list of { "x", "y" } or map places (${Object.keys(MAP_PLACES).join(', ')})`);
    else if (v.length > 30) bad('at most 30 points');
  }
  if (type === 'gate' && !(Array.isArray(v) && v.length === 2 && v.every(isPoint)))
    bad("needs two points: the committee boat's end, then the pin's");
  if (type === 'par') {
    const ok =
      (isNumber(v) && (v as number) > 0) ||
      (typeof v === 'object' &&
        v !== null &&
        Object.entries(v).length > 0 &&
        Object.entries(v).every(([k, n]) => isDifficulty(k) && isNumber(n) && (n as number) > 0));
    if (!ok) bad('needs seconds, or difficulty level → seconds');
  }
  if (type === 'condition') out.push(...checkCondition(v, scope, inGoal, where));
  if (type === 'conditions') {
    if (!Array.isArray(v) || v.length === 0) bad('needs a list of conditions');
    else v.forEach((m, i) => out.push(...checkCondition(m, scope, inGoal, `${where}[${i}]`)));
  }
  return out;
}

/** Problems with a condition, as readable lines; `inGoal` allows conditions with slots. */
export function checkCondition(
  c: unknown,
  scope: CheckScope,
  inGoal: boolean,
  at: string,
): string[] {
  if (typeof c !== 'object' || c === null || Array.isArray(c)) return [`${at}: not a condition`];
  const cond = c as Condition;
  const kind = CONDITIONS[cond.is];
  if (!kind) return [`${at}: unknown condition "${String(cond.is)}"`];
  const out: string[] = [];
  if (kind.slots && !inGoal) out.push(`${at}: "${cond.is}" only works in a step's goal`);
  if (cond.is === 'asked' && inGoal) out.push(`${at}: "asked" only works as a quest's start`);
  for (const key of Object.keys(cond))
    if (key !== 'is' && !(key in kind.params)) out.push(`${at}: "${cond.is}" has no "${key}"`);
  for (const [name, spec] of Object.entries(kind.params)) {
    const v = cond[name];
    if (spec.endsWith('?') && v === undefined) continue;
    out.push(
      ...checkParam(
        spec.replace('?', '') as Param,
        v,
        cond,
        scope,
        inGoal,
        `${at} › ${cond.is}.${name}`,
      ),
    );
  }
  if (
    cond.is === 'reach' &&
    (cond.maxKn !== undefined || cond.holdSec !== undefined) &&
    cond.holdSec === undefined
  )
    out.push(`${at} › reach: "maxKn" needs "holdSec"`);
  return out;
}
