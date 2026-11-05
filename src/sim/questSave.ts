import { type QuestDef, QUEST_DONE, type QuestProgress, type QuestState } from './questTypes';
import { QUESTS, findStep, questsFor, questHold } from './questFlow';
import { isGood } from './goods';
import { type MapDef } from './map';
import { slotLayout } from './questLibrary';
import { seriesWon } from './regatta';
import { cleanRaceRecord } from './raceRecords';
import { TUNING } from '../data/tuning';

/* Quest progress in the saves (decision 0125): read back, checked against the quest files. */

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/**
 * Saved quest progress checked against the quest files: a quest or step no longer there, or bad
 * numbers, drop that quest's progress (it starts again when its condition holds).
 */
export function readQuests(
  raw: unknown,
  map: MapDef,
  quests: readonly QuestDef[] = QUESTS,
): QuestState {
  const out: QuestState = { byId: {} };
  if (typeof raw !== 'object' || raw === null) return out;
  const { byId, tracked, ignored, uncoached } = raw as {
    byId?: unknown;
    tracked?: unknown;
    ignored?: unknown;
    uncoached?: unknown;
  };
  if (typeof byId !== 'object' || byId === null) return out;
  const fitting = questsFor(map, quests);
  for (const quest of fitting) {
    const p = (byId as Record<string, unknown>)[quest.id] as Partial<QuestProgress> | undefined;
    if (!p || typeof p !== 'object') continue;
    const step = findStep(quest, p.step);
    if (!step && p.step !== QUEST_DONE) continue;
    const counts = Array.isArray(p.counts) ? p.counts : [];
    if (counts.length !== slotLayout(step?.goal).size || !counts.every(isCount)) continue;
    const chose: Record<string, string> = {};
    let ok = typeof p.chose === 'object' && p.chose !== null;
    for (const [s, o] of Object.entries(p.chose ?? {})) {
      if (findStep(quest, s)?.choose?.some((x) => x.id === o)) chose[s] = o;
      else ok = false;
    }
    if (!ok) continue;
    out.byId[quest.id] = { step: p.step as string, counts: [...counts], chose };
    // A standing order's rounds and wait (decision 0214).
    if (quest.repeat && isCount(p.rounds) && p.rounds > 0) out.byId[quest.id]!.rounds = p.rounds;
    if (quest.repeat && p.step === QUEST_DONE && isCount(p.wait) && p.wait > 0)
      out.byId[quest.id]!.wait = Math.min(p.wait, TUNING.economy.orders.standingDockings);
    // A race's record (decision 0217).
    if (quest.race) Object.assign(out.byId[quest.id]!, cleanRaceRecord(p));
    // Vars that no longer fit (a port gone from the map) are dropped: the steps find them again.
    const vars = readVars(quest, map, p.vars);
    if (vars) out.byId[quest.id]!.vars = vars;
  }
  if (typeof tracked === 'string' && out.byId[tracked] && out.byId[tracked].step !== QUEST_DONE)
    out.tracked = tracked;
  if (Array.isArray(ignored)) {
    const offers = ignored.filter(
      (id, i) =>
        ignored.indexOf(id) === i && fitting.some((q) => q.id === id && q.offer && !out.byId[id]),
    ) as string[];
    if (offers.length) out.ignored = offers;
  }
  if (Array.isArray(uncoached)) {
    const lessons = uncoached.filter(
      (id, i) => uncoached.indexOf(id) === i && fitting.some((q) => q.id === id && q.lesson),
    ) as string[];
    if (lessons.length) out.uncoached = lessons;
  }
  const hold = questHold(out, fitting);
  if (hold) out.hold = hold;
  const won = seriesWon(fitting, (id) => out.byId[id]?.medal ?? 0);
  if (won.length) out.won = won;
  return out;
}

/** A quest's saved vars that still fit it (decision 0151), or undefined for none. */
export function readVars(
  quest: QuestDef,
  map: MapDef,
  raw: unknown,
): Record<string, string> | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const out: Record<string, string> = {};
  for (const [name, kind] of Object.entries(quest.vars ?? {})) {
    const v = (raw as Record<string, unknown>)[name];
    if (kind === 'port' ? typeof v === 'string' && map.ports.some((p) => p.id === v) : isGood(v))
      out[name] = v as string;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Whether any quest has progress (the save code writes its quest section only then). */
export const hasQuestProgress = (state: QuestState | undefined) =>
  Object.keys(state?.byId ?? {}).length > 0;

/**
 * 16-bit FNV-1a of the quest, step and option ids and how many numbers each step keeps (never 0):
 * the save code's quest layout.
 */
export function questFingerprint(quests: readonly QuestDef[]): number {
  const ids = quests.flatMap((q) => [
    q.id,
    ...q.steps.flatMap((s) => [
      s.id,
      String(slotLayout(s.goal).size),
      ...(s.choose ?? []).map((o) => o.id),
    ]),
    ...Object.keys(q.vars ?? {}).map((name) => `$${name}`),
    ...(q.repeat ? ['~repeat'] : []),
    ...(q.race ? ['~race'] : []),
  ]);
  let h = 0x811c9dc5;
  for (const ch of ids.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h ^ (h >>> 16)) & 0xffff || 1;
}
