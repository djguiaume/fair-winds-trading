import { formatJson, formatQuestJson } from '../../data/jsonFormat';
import type { MapDef } from '../../sim/map';
import { REGATTA } from '../../sim/regatta';
import { CONDITIONS, type Condition, type Param } from '../../sim/questLibrary';
import { type QuestDef, type QuestStep, QUEST_DONE } from '../../sim/quests';
import { LANGS, type QuestDoc, mergeText } from './docText';
import { stepPlaces, round1 } from './docPlaces';

/*
 * The quest builder's document (decision 0142): every quest file and the quest text, as pure
 * edits, so the page stays a thin layer and the tests cover the rules.
 *
 * Where each part lives: the text in `docText.ts`, plain words in `docWords.ts`, places at sea
 * and races in `docPlaces.ts`, the story in `docStory.ts` and the checks in `docChecks.ts`; this
 * file has play links, new things, renames and the export, and passes the others on.
 */

export * from './docText';
export * from './docWords';
export * from './docPlaces';
export * from './docStory';
export * from './docChecks';

/** The builder's working copy in this browser; `?map=edited` plays it (decision 0142). */
export { EDITED_QUESTS_KEY, isEditedQuests as isQuestDoc } from '../../data/editedMap';
// --- Play from a step ------------------------------------------------------------------------

/**
 * Where a quest test starts at sea (decision 0142): in clear water about `back` short of the
 * step's first place (its goal's first point or spot, else its compass, else its chart circle),
 * on the side of the map's centre, heading for the place. Null for a step with no place.
 */
export function seaStart(
  step: QuestStep,
  map: MapDef,
  clear: (x: number, y: number) => boolean,
  back = 30,
): { x: number; y: number; headingDeg: number } | null {
  const places = stepPlaces(step, map);
  const place = places.find((p) => p.kind !== 'compass' && p.kind !== 'chart') ?? places[0];
  if (!place) return null;
  const out = Math.atan2(-place.x, -place.y);
  const reach = back + (place.kind === 'chart' ? place.within : 0);
  // Try further round and further off until the water is clear.
  for (let r = reach; r < reach + 60; r += 10)
    for (const turn of [0, 30, -30, 60, -60, 90, -90, 135, -135, 180]) {
      const a = out + (turn * Math.PI) / 180;
      const x = place.x + r * Math.sin(a);
      const y = place.y + r * Math.cos(a);
      if (!clear(x, y)) continue;
      const heading = (Math.atan2(place.x - x, place.y - y) * 180) / Math.PI;
      return { x: round1(x), y: round1(y), headingDeg: Math.round((heading + 360) % 360) };
    }
  return null;
}

/** The game's address that plays a quest from a step, docked at a port or at sea (0142). */
export function playUrl(
  questId: string,
  stepId: string,
  start: { port: string } | { x: number; y: number; headingDeg: number },
): string {
  // On the grown sea, the game's own (decision 0198), with the sea editor's working copy if any.
  const q = new URLSearchParams({ map: 'edited', sea: 'phase4', quest: questId, step: stepId });
  if ('port' in start) q.set('port', start.port);
  else {
    q.set('x', String(start.x));
    q.set('y', String(start.y));
    q.set('h', String(start.headingDeg));
  }
  return `./?${q.toString()}`;
}

/** The port a step happens at, for a test that starts docked: the step's, else the quest's. */
export function stepPort(quest: QuestDef, step: QuestStep | undefined, map: MapDef): string {
  const known = (id: string | undefined) => (id && map.ports.some((p) => p.id === id) ? id : '');
  return known(step?.port) || known(quest.port) || (map.ports[0]?.id ?? '');
}

// --- New things ----------------------------------------------------------------------------

/** A value for a parameter of a new condition, from what the map has. */
export function defaultParam(type: Param, map: MapDef, questIds: string[]): unknown {
  const port = map.ports[0]?.id ?? 'home';
  switch (type) {
    case 'port':
    case 'place':
      return port;
    case 'good':
      return 'fish';
    case 'ship':
      return 'sloop';
    case 'series':
      return REGATTA.series[0]?.id ?? '';
    case 'building':
      return 'workshop';
    case 'island':
      return map.homeIsland;
    case 'quest':
      return questIds[0] ?? 'first-voyage';
    case 'step':
    case 'option':
    case 'item':
      return '';
    case 'count':
      return 1;
    case 'number':
      return 10;
    case 'flag':
      return true;
    case 'points': {
      const s = map.start;
      return [{ x: round1(s.x), y: round1(s.y + 40) }];
    }
    // A race's line (decision 0217): the committee boat's end, then the pin's, across the course.
    case 'gate': {
      const s = map.start;
      return [
        { x: round1(s.x - 20), y: round1(s.y + 20) },
        { x: round1(s.x + 20), y: round1(s.y + 20) },
      ];
    }
    case 'order':
      return 'any';
    case 'par':
      return 120;
    case 'screen':
      return 'chart';
    case 'sailing':
      return 'beam-reach';
    case 'condition':
      return { is: 'always' };
    case 'conditions':
      return [{ is: 'always' }];
  }
}

/** A new condition of `kind` with its required parameters filled in. */
export function newCondition(kind: string, map: MapDef, questIds: string[]): Condition {
  const spec = CONDITIONS[kind];
  const c: Condition = { is: kind };
  for (const [name, type] of Object.entries(spec?.params ?? {}))
    if (!type.endsWith('?')) c[name] = defaultParam(type as Param, map, questIds);
  return c;
}

/** A free id from `base`: `base`, `base-2`, `base-3` … */
export function freeId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

export function newQuest(doc: QuestDoc, map: MapDef): QuestDef {
  const id = freeId(
    'new-quest',
    doc.quests.map((q) => q.id),
  );
  return {
    id,
    name: 'New quest',
    start: { is: 'quest-done', quest: 'rooks-thanks' },
    text: `quest.${id}`,
    port: map.ports[0]?.id,
    steps: [{ id: 'first', goal: newCondition('docked', map, []) }],
  };
}

export function newStep(quest: QuestDef, map: MapDef): QuestStep {
  return {
    id: freeId(
      'step',
      quest.steps.map((s) => s.id),
    ),
    goal: newCondition('docked', map, []),
  };
}

// --- Renames -------------------------------------------------------------------------------

/** Renames a quest that was never shipped, and what names it: other quests' conditions, its text. */
export function renameQuest(doc: QuestDoc, from: string, to: string) {
  const quest = doc.quests.find((q) => q.id === from);
  if (!quest || doc.quests.some((q) => q.id === to)) return;
  quest.id = to;
  const oldText = quest.text;
  quest.text = `quest.${to}`;
  for (const lang of LANGS)
    for (const [key, value] of Object.entries(doc.text[lang]))
      if (key.startsWith(`${oldText}.`)) {
        delete doc.text[lang][key];
        doc.text[lang][quest.text + key.slice(oldText.length)] = value;
      }
  const fix = (c: unknown) => {
    if (!c || typeof c !== 'object') return;
    const cond = c as Condition;
    if (cond.quest === from) cond.quest = to;
    if (Array.isArray(cond.of)) cond.of.forEach(fix);
    else fix(cond.of);
  };
  for (const q of doc.quests) {
    fix(q.start);
    for (const s of q.steps) fix(s.goal);
  }
}

/** Renames a step that was never shipped, with its text and the `next` that lead to it. */
export function renameStep(doc: QuestDoc, quest: QuestDef, from: string, to: string) {
  const step = quest.steps.find((s) => s.id === from);
  if (!step || to === QUEST_DONE || quest.steps.some((s) => s.id === to)) return;
  step.id = to;
  for (const s of quest.steps) {
    if (s.next === from) s.next = to;
    for (const o of s.choose ?? []) if (o.next === from) o.next = to;
  }
  for (const lang of LANGS)
    for (const [key, value] of Object.entries(doc.text[lang]))
      if (key.startsWith(`${quest.text}.${from}.`)) {
        delete doc.text[lang][key];
        doc.text[lang][`${quest.text}.${to}.${key.slice(quest.text.length + from.length + 2)}`] =
          value;
      }
}
// --- Export --------------------------------------------------------------------------------

/** The shipped quest files' text, by quest id, to export only what changed. */
export type ShippedFiles = Record<string, string>;

/**
 * The files to commit: each quest file that differs from its shipped text (written like it,
 * Prettier style), and `en.json` / `fr.json` with the edited keys, new keys after the quest's
 * other keys. Paths are the repo's.
 */
/** A quest file's text as the builder exports it, keeping the layout of the file it replaces. */
export function questFileText(q: QuestDef, before: string | undefined): string {
  // A file written with objects broken open stays that way; new files keep objects on one line.
  return before !== undefined && formatJson(JSON.parse(before)) === before
    ? formatJson(q)
    : formatQuestJson(q);
}

export function exportFiles(
  doc: QuestDoc,
  shipped: ShippedFiles,
): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const q of doc.quests) {
    const before = shipped[q.id];
    const text = questFileText(q, before);
    if (text !== before) out.push({ path: `src/data/quests/${q.id}.json`, text });
  }
  for (const lang of LANGS) {
    const edits = doc.text[lang];
    if (!Object.keys(edits).length) continue;
    out.push({ path: `src/i18n/${lang}.json`, text: formatJson(mergeText(lang, edits)) });
  }
  return out;
}
