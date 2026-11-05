import {
  COACH_TARGETS,
  type CoachTarget,
  COACH_ACTIONS,
  type StepCoach,
  type QuestDef,
  STEP_MARKER_STYLES,
  QUEST_DONE,
} from './questTypes';
import { nextOf } from './questFlow';
import { checkStepEffects } from './stepEffects';
import characterData from '../data/characters.json';
import { chartAreaIds } from './fog';
import { isGood } from './goods';
import { type IslandDesign, questTagIds, runningTag } from '../data/islands';
import { type MapDef, SEA_MARK_TYPES } from './map';
import {
  type CheckScope,
  MAP_PLACES,
  SCREENS,
  VAR_KINDS,
  type VarKind,
  checkCondition,
  isVarRef,
  resolvePort,
} from './questLibrary';
import { checkReward } from './questRewards';
import { REGATTA } from './regatta';
import { checkRace } from './raceChecks';
import { checkRepeat } from './standingChecks';

/* The checks of the quest files (decision 0125), as readable lines. */

/** The people of `characters.json`, with their named looks, for the checks. */
const PEOPLE = new Map(
  (characterData.characters as { id: string; looks?: Record<string, unknown> }[]).map((c) => [
    c.id,
    Object.keys(c.looks ?? {}),
  ]),
);

/**
 * Problems with the quest files, as readable lines (none: they are sound). `others` are the quests
 * a condition may name besides these (the tutorial), with their step ids when known.
 */
export function checkQuests(
  quests: readonly QuestDef[],
  map: MapDef,
  others: string[] | Record<string, string[]> = [],
): string[] {
  const outside: Record<string, string[] | undefined> = Array.isArray(others)
    ? Object.fromEntries(others.map((id) => [id, undefined]))
    : others;
  const steps = new Map<string, string[]>([
    ...Object.entries(outside).flatMap(([id, list]) =>
      list ? [[id, list] as [string, string[]]] : [],
    ),
    ...quests.map((q) => [q.id, (q.steps ?? []).map((s) => s.id)] as [string, string[]]),
  ]);
  const all = new Map<string, string[]>([
    ...Object.keys(outside).map((id) => [id, []] as [string, string[]]),
    ...quests.map(
      (q) =>
        [q.id, (q.steps ?? []).flatMap((s) => (s.choose ?? []).map((o) => o.id))] as [
          string,
          string[],
        ],
    ),
  ]);
  const out: string[] = [];
  const ids = new Set<string>(Object.keys(outside));
  for (const q of quests) {
    const at = `quest ${q.id}`;
    const scope: CheckScope = {
      map,
      quests: all,
      steps,
      items: Object.keys(q.items ?? {}),
      vars: q.vars ?? {},
    };
    if (ids.has(q.id)) out.push(`${at}: id used twice`);
    ids.add(q.id);
    if (typeof q.name !== 'string' || typeof q.text !== 'string')
      out.push(`${at}: needs name and text`);
    for (const [item, def] of Object.entries(q.items ?? {}))
      if (!Number.isInteger(def?.space) || def.space < 0)
        out.push(`${at} › items.${item}: space needs a whole number (0 for a passenger)`);
    if (q.port !== undefined && !resolvePort(map, q.port)) out.push(`${at}: no port "${q.port}"`);
    if (q.giver !== undefined && !PEOPLE.has(q.giver)) out.push(`${at}: no person "${q.giver}"`);
    if (q.doneSpeaker !== undefined && !PEOPLE.has(q.doneSpeaker))
      out.push(`${at}: no person "${q.doneSpeaker}"`);
    if (q.offer !== undefined && typeof q.offer !== 'boolean')
      out.push(`${at}: offer is true or false`);
    if (q.main !== undefined && typeof q.main !== 'boolean')
      out.push(`${at}: main is true or false`);
    if (q.main && q.offer) out.push(`${at}: a main quest is not offered (it cannot be ignored)`);
    if (q.repeat !== undefined && typeof q.repeat !== 'boolean')
      out.push(`${at}: repeat is true or false`);
    if (q.repeat) out.push(...checkRepeat(q, map, at));
    if (q.race !== undefined) out.push(...checkRace(q, map, PEOPLE, at));
    else if (q.steps?.some((st) => st.goal?.is === 'raced'))
      out.push(`${at}: a "raced" goal belongs to a race (a quest with "race")`);
    if (q.lesson !== undefined && typeof q.lesson !== 'boolean')
      out.push(`${at}: lesson is true or false`);
    if (q.storms !== undefined && q.storms !== false) out.push(`${at}: storms is only ever false`);
    if (q.steps?.some((s) => s.teach !== undefined) && !q.lesson)
      out.push(`${at}: only a lesson has teach steps`);
    if (q.lesson && Array.isArray(q.steps) && q.steps.length && q.steps.every((s) => s.teach))
      out.push(`${at}: a lesson needs a step that is not teach (its story without the coach)`);
    for (const [name, kind] of Object.entries(q.vars ?? {}))
      if (!/^\w+$/.test(name) || !VAR_KINDS.includes(kind))
        out.push(`${at} › vars.${name}: a word, holding one of ${VAR_KINDS.join(', ')}`);
    out.push(...checkCondition(q.start, scope, false, `${at} › start`));
    out.push(...checkReward(q.reward, scope, `${at} › reward`));
    out.push(...checkStepEffects({ wind: q.wind }, at));
    if (q.marks !== undefined && !Array.isArray(q.marks)) out.push(`${at} › marks: a list`);
    else
      (q.marks ?? []).forEach((m, i) => {
        if (!(SEA_MARK_TYPES as readonly string[]).includes(m?.type))
          out.push(`${at} › marks ${i + 1}: type is one of ${SEA_MARK_TYPES.join(', ')}`);
        if (!Number.isFinite(m?.x) || !Number.isFinite(m?.y))
          out.push(`${at} › marks ${i + 1}: x and y in map units`);
      });
    if (!Array.isArray(q.steps) || q.steps.length === 0) {
      out.push(`${at}: needs steps`);
      continue;
    }
    const stepIds = q.steps.map((s) => s.id);
    const reached = new Set([stepIds[0]]);
    q.steps.forEach((s, i) => {
      const where = `${at} › ${s.id}`;
      if (typeof s.id !== 'string' || s.id === QUEST_DONE) out.push(`${where}: bad step id`);
      if (stepIds.indexOf(s.id) !== i) out.push(`${where}: step id used twice`);
      if (s.goal === undefined && s.choose === undefined)
        out.push(`${where}: needs a goal or a choice`);
      if (s.goal !== undefined) out.push(...checkCondition(s.goal, scope, true, `${where} › goal`));
      out.push(...checkReward(s.reward, scope, `${where} › reward`));
      if (s.charts !== undefined) {
        const areas = chartAreaIds(map);
        if (!Array.isArray(s.charts)) out.push(`${where} › charts: a list of chart area ids`);
        else if (map.fog)
          for (const id of s.charts)
            if (!areas.includes(id)) out.push(`${where} › charts: no chart area "${id}"`);
      }
      for (const p of [s.port, s.chart?.port])
        if (
          p !== undefined &&
          !(isVarRef(p) ? q.vars?.[p.slice(1)] === 'port' : resolvePort(map, p))
        )
          out.push(`${where}: no port "${p}"`);
      if (s.speaker !== undefined && !PEOPLE.has(s.speaker))
        out.push(`${where}: no person "${s.speaker}"`);
      const face = s.speaker ?? q.giver;
      if (s.look !== undefined && face && PEOPLE.has(face) && !PEOPLE.get(face)!.includes(s.look))
        out.push(`${where}: ${face} has no look "${s.look}"`);
      if (
        s.compass !== undefined &&
        !(typeof s.compass === 'string'
          ? s.compass in MAP_PLACES
          : Number.isFinite(s.compass.x) && Number.isFinite(s.compass.y))
      )
        out.push(`${where} › compass: needs { "x", "y" } or a map place`);
      out.push(...checkSet(s.set, q.vars ?? {}, map, `${where} › set`));
      out.push(...checkCoach(s.coach, q.vars ?? {}, map, `${where} › coach`));
      if (s.unless !== undefined) {
        if (!Array.isArray(s.unless)) out.push(`${where} › unless: needs a list`);
        else
          s.unless.forEach((way, k) => {
            const w = `${where} › unless[${k}]`;
            out.push(...checkCondition(way?.if, scope, false, `${w} › if`));
            if (!stepIds.includes(way?.to)) out.push(`${w}: no step "${String(way?.to)}"`);
            out.push(...checkSet(way?.set, q.vars ?? {}, map, `${w} › set`));
          });
      }
      out.push(...checkStepEffects(s, where));
      if (s.marker !== undefined && !STEP_MARKER_STYLES.includes(s.marker))
        out.push(`${where}: marker is one of ${STEP_MARKER_STYLES.join(', ')}`);
      if (s.chart && !(typeof s.chart.radius === 'number' && s.chart.radius > 0))
        out.push(`${where} › chart: needs a radius`);
      if (s.teach !== undefined && s.teach !== true) out.push(`${where}: teach is only ever true`);
      const later = (next: string | undefined, from: string) => {
        if (next === undefined || next === QUEST_DONE) return;
        // Only forward, so a quest always ends and its progress is one step number.
        if (stepIds.indexOf(next) <= i) out.push(`${from}: next "${next}" is not a later step`);
      };
      later(s.next, where);
      if (s.choose !== undefined) {
        // One option is a button to go on ("Continue"); a choice proper has two or more.
        if (!Array.isArray(s.choose) || s.choose.length < 1)
          out.push(`${where}: a choice needs an option or more`);
        else {
          const opts = s.choose.map((o) => o.id);
          s.choose.forEach((o, k) => {
            if (typeof o.id !== 'string' || opts.indexOf(o.id) !== k)
              out.push(`${where}: bad or repeated option "${String(o.id)}"`);
            out.push(...checkReward(o.reward, scope, `${where} › ${o.id}`));
            if (o.if !== undefined)
              out.push(...checkCondition(o.if, scope, false, `${where} › ${o.id} › if`));
            later(o.next, `${where} › ${o.id}`);
          });
        }
      }
    });
    // Every step reached from the first, by its goal, its options or its ways back.
    for (let grew = true; grew;) {
      grew = false;
      for (const s of q.steps) {
        if (!reached.has(s.id)) continue;
        const to = [
          ...(s.goal !== undefined || !Array.isArray(s.choose) ? [nextOf(q, s)] : []),
          ...(Array.isArray(s.choose) ? s.choose.map((o) => nextOf(q, s, o)) : []),
          ...(Array.isArray(s.unless) ? s.unless.map((w) => w?.to) : []),
        ];
        for (const id of to)
          if (typeof id === 'string' && !reached.has(id)) {
            reached.add(id);
            grew = true;
          }
      }
    }
    // Each of a standing order's steps is a round of its own (decision 0214).
    if (!q.repeat)
      for (const id of stepIds) if (!reached.has(id)) out.push(`${at} › ${id}: no step leads here`);
  }
  return out;
}

/** Problems with a step's `set` (decision 0151): known vars, and values that fit them. */
function checkSet(set: unknown, vars: Record<string, VarKind>, map: MapDef, at: string): string[] {
  if (set === undefined) return [];
  if (typeof set !== 'object' || set === null || Array.isArray(set)) return [`${at}: var → value`];
  const out: string[] = [];
  for (const [name, value] of Object.entries(set)) {
    const kind = vars[name];
    if (!kind) {
      out.push(`${at}: no var "${name}" in the quest's vars`);
      continue;
    }
    if (isVarRef(value)) {
      if (vars[value.slice(1)] !== kind) out.push(`${at}.${name}: no ${kind} var "${value}"`);
    } else if (kind === 'port') {
      if (value !== 'course' && value !== 'docked' && !resolvePort(map, value))
        out.push(`${at}.${name}: course, docked, home or a port`);
    } else if (value !== 'aboard' && !isGood(value)) out.push(`${at}.${name}: aboard or a good`);
  }
  return out;
}

/** Problems with a lesson step's coach mark (decision 0151). */
function checkCoach(
  coach: StepCoach | undefined,
  vars: Record<string, VarKind>,
  map: MapDef,
  at: string,
): string[] {
  if (coach === undefined) return [];
  if (typeof coach !== 'object' || coach === null) return [`${at}: not a coach mark`];
  const out: string[] = [];
  for (const [key, value] of Object.entries(coach)) {
    if ((SCREENS as readonly string[]).includes(key)) {
      if (!COACH_TARGETS.includes(value as CoachTarget))
        out.push(`${at}.${key}: one of ${COACH_TARGETS.join(', ')}`);
    } else if (key === 'action') {
      if (!COACH_ACTIONS.includes(value as (typeof COACH_ACTIONS)[number]))
        out.push(`${at}.action: one of ${COACH_ACTIONS.join(', ')}`);
    } else if (key === 'port') {
      const v = String(value);
      const ref = v.startsWith('buyer:') ? v.slice(6) : v;
      const ok =
        v === 'nearest' ||
        (v.startsWith('buyer:') ? vars[ref.slice(1)] === 'good' && isVarRef(ref) : false) ||
        (isVarRef(v) ? vars[v.slice(1)] === 'port' : !!resolvePort(map, v));
      if (!ok) out.push(`${at}.port: a port, home, a port $var, nearest or buyer:$var`);
    } else if (key === 'good') {
      const v = String(value);
      const ok = v.startsWith('makes:')
        ? vars[v.slice(7)] === 'port' && isVarRef(v.slice(6))
        : isVarRef(v)
          ? vars[v.slice(1)] === 'good'
          : isGood(v);
      if (!ok) out.push(`${at}.good: a good, a good $var or makes:$var`);
    } else out.push(`${at}: no "${key}"`);
  }
  return out;
}

/**
 * Problems with what waits on a quest (decision 0130), as readable lines: island props, sea
 * marks, islands and shapes (0166) tagged `after:` or `before:` a quest, and ports whose trade changes after one, must name
 * a quest there is (`quests`, or `others` such as the tutorial).
 */
export function checkQuestHooks(
  map: MapDef,
  designs: readonly IslandDesign[],
  quests: readonly QuestDef[],
  others: string[] = [],
): string[] {
  // A regatta series won counts as done (decision 0217): the Cup stands on Skerry's pier.
  const known = new Set([
    ...quests.map((q) => q.id),
    ...REGATTA.series.map((s) => s.id),
    ...others,
  ]);
  const out: string[] = [];
  const named = (ids: string[], where: string) => {
    for (const id of ids) if (!known.has(id)) out.push(`${where}: no quest "${id}"`);
  };
  for (const design of designs)
    design.props.forEach((prop, i) => {
      const where = `island ${design.id} › prop ${i} (${prop.type})`;
      named(questTagIds(prop), where);
      // A moored boat is solid, and the collision does not follow quests.
      if (prop.type === 'moored-boat' && questTagIds(prop).length)
        out.push(`${where}: a moored boat cannot wait on a quest (use a sea mark)`);
      // Props follow quests done only; land can follow a running quest (decision 0166).
      if (prop.tags?.some(runningTag))
        out.push(`${where}: during:/except: is for islands and shapes`);
    });
  for (const design of designs)
    (design.rivers ?? []).forEach((river, i) =>
      named(questTagIds(river), `island ${design.id} › river ${i}`),
    );
  (map.marks ?? []).forEach((mark, i) =>
    named(questTagIds(mark), `map › mark ${i} (${mark.type})`),
  );
  // Land that rises or clears after a quest (decision 0166).
  for (const island of map.islands) named(questTagIds(island), `map › island ${island.id}`);
  for (const shape of map.terrain ?? []) named(questTagIds(shape), `map › shape ${shape.id}`);
  for (const port of map.ports)
    named(Object.keys(port.afterQuest ?? {}), `port ${port.id} › afterQuest`);
  return out;
}
