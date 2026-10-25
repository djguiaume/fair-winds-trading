import { grownMap } from '../../data/grownMap';
import { ISLAND_DESIGNS } from '../../data/islands';
import { PHASE1_SOURCE, prepareMap } from '../../data/maps';
import { formatJson, formatQuestJson } from '../../data/jsonFormat';
import en from '../../i18n/en.json';
import fr from '../../i18n/fr.json';
import type { MapDef, SeaMarkDef, SeaMarkType } from '../../sim/map';
import type { StepWind } from '../../sim/stepEffects';
import { clearAt } from '../../sim/mapChecks';
import { hasQuestLand, standingMap } from '../../sim/questLand';
import {
  CONDITIONS,
  type Condition,
  type Param,
  type QuestPoint,
  type QuestReward,
  isSpot,
} from '../../sim/questLibrary';
import {
  type QuestDef,
  type QuestStep,
  QUEST_DONE,
  checkQuestHooks,
  checkQuests,
  questsFor,
} from '../../sim/quests';

/*
 * The quest builder's document (decision 0142): every quest file and the quest text, as pure
 * edits, so the page stays a thin layer and the tests cover the rules.
 */

export type Lang = 'en' | 'fr';
export const LANGS: readonly Lang[] = ['en', 'fr'];
const SHIPPED_TEXT: Record<Lang, Record<string, string>> = { en, fr };

/** What the builder edits: the quests, and the text keys changed from `en.json` and `fr.json`. */
export interface QuestDoc {
  quests: QuestDef[];
  text: Record<Lang, Record<string, string>>;
}

/** The builder's working copy in this browser; `?map=edited` plays it (decision 0142). */
export { EDITED_QUESTS_KEY, isEditedQuests as isQuestDoc } from '../../data/editedMap';

/** A text in a language: the edited one, else the shipped one. */
export function textOf(doc: QuestDoc, lang: Lang, key: string): string | undefined {
  return doc.text[lang][key] ?? SHIPPED_TEXT[lang][key];
}

/** Sets a text; back to the shipped text drops the edit. */
export function setText(doc: QuestDoc, lang: Lang, key: string, value: string) {
  if (SHIPPED_TEXT[lang][key] === value) delete doc.text[lang][key];
  else doc.text[lang][key] = value;
}

// --- Words ---------------------------------------------------------------------------------

const PLACES = (n: number, what = 'place') => `${n} ${what}${n === 1 ? '' : 's'}`;
const placeWords = (p: unknown) =>
  isSpot(p) ? `a spot at sea (${Math.round(p.x)}, ${Math.round(p.y)})` : String(p);
const parWords = (par: unknown) =>
  typeof par === 'number'
    ? clock(par)
    : par && typeof par === 'object'
      ? Object.values(par as Record<string, number>)
          .map(clock)
          .join(' / ')
      : '?';

/** Seconds as m:ss. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A condition in plain words, for the step cards and the story view. */
export function conditionWords(c: Condition | undefined): string {
  if (!c) return '—';
  const v = c as Record<string, unknown>;
  switch (c.is) {
    case 'always':
      return 'at once';
    case 'all':
    case 'any':
      return `${c.is} of: ${((v.of as Condition[]) ?? []).map(conditionWords).join(' · ')}`;
    case 'not':
      return `not ${conditionWords(v.of as Condition)}`;
    case 'quest-done':
      return `${String(v.quest)} done`;
    case 'quest-at':
      return `${String(v.quest)} at ${String(v.step)}`;
    case 'chose':
      return `chose ${String(v.option)} in ${String(v.quest)}`;
    case 'docked':
      return v.port === undefined ? 'docked anywhere' : `docked at ${String(v.port)}`;
    case 'course':
      return v.port === undefined ? 'a course set' : `a course to ${String(v.port)}`;
    case 'screen':
      return `the ${String(v.screen)} open`;
    case 'point-of-sail':
      return `${String(v.point)} for ${String(v.holdSec)} s`;
    case 'tacked':
      return `${String(v.count)} tacks`;
    case 'asked':
      return 'when the game asks (tutorial)';
    case 'bought':
      return `buy ${String(v.qty)} ${v.good === undefined ? 'goods' : String(v.good)} at ${String(v.port)}`;
    case 'sails-practised':
      return 'sails lowered and raised, steered, under way';
    case 'discovered':
      return `${String(v.port)} on the chart`;
    case 'town-level':
      return `${String(v.port)} at level ${String(v.atLeast)}`;
    case 'standing':
      return `standing ${String(v.atLeast)} at ${String(v.port)}`;
    case 'orders-done':
      return `${String(v.atLeast)} orders done`;
    case 'gold':
      return `${String(v.atLeast)} gold`;
    case 'has-cargo':
      return `${String(v.qty ?? 1)} ${v.good === undefined ? 'goods' : String(v.good)} aboard`;
    case 'built':
      return `${String(v.building)} built${v.island ? ` on ${String(v.island)}` : ''}`;
    case 'moored':
      return `moored at ${v.island ? String(v.island) : 'home'}`;
    case 'owns-ship':
      return `owns a ${String(v.ship)}`;
    case 'delivered':
      return `deliver ${String(v.qty)} ${String(v.good)} at ${String(v.port)}`;
    case 'landed':
      return `land ${String(v.qty)} ${String(v.good)} ${placeWords(v.place)}`;
    case 'carried':
      return `carry ${String(v.qty)} ${String(v.item)} ${placeWords(v.from)} → ${placeWords(v.to)}`;
    case 'reach': {
      const n = Array.isArray(v.points) ? v.points.length : 0;
      const extra = [
        v.order === 'in-order' ? 'in order' : 'any order',
        `within ${String(v.within)}`,
        v.holdSec !== undefined ? `held ${String(v.holdSec)} s` : '',
        v.atNight ? 'at night' : '',
      ].filter(Boolean);
      return `reach ${PLACES(n)} · ${extra.join(' · ')}`;
    }
    case 'timed':
      return `timed ${String(v.from)} → ${String(v.to ?? v.from)}${
        Array.isArray(v.via) ? ` via ${PLACES(v.via.length, 'point')}` : ''
      }, par ${parWords(v.par)}`;
    default:
      return c.is;
  }
}

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
  const q = new URLSearchParams({ map: 'edited', quest: questId, step: stepId });
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

// --- Story ---------------------------------------------------------------------------------

/** The quests a condition waits on (`quest-done`, `quest-at`, `chose`), outside a `not`. */
export function questsNamed(c: Condition | undefined): string[] {
  if (!c) return [];
  if (c.is === 'not') return [];
  if (c.is === 'all' || c.is === 'any')
    return [...new Set(((c.of as Condition[]) ?? []).flatMap(questsNamed))];
  return typeof c.quest === 'string' ? [c.quest] : [];
}

/** Columns for the story view: a quest sits one column right of the last quest it waits on. */
export function storyColumns(quests: readonly { id: string; start: Condition }[]): string[][] {
  const byId = new Map(quests.map((q) => [q.id, q]));
  const depth = new Map<string, number>();
  const visit = (id: string, trail: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!;
    const q = byId.get(id);
    if (!q || trail.has(id)) return 0;
    trail.add(id);
    const before = questsNamed(q.start).filter((p) => byId.has(p));
    const d = before.length ? Math.max(...before.map((p) => visit(p, trail) + 1)) : 0;
    trail.delete(id);
    depth.set(id, d);
    return d;
  };
  const columns: string[][] = [];
  for (const q of quests) {
    const d = visit(q.id, new Set());
    (columns[d] ??= []).push(q.id);
  }
  return columns.map((c) => c ?? []);
}

// --- Text ----------------------------------------------------------------------------------

/** The text keys a quest's card and journal read (decision 0124), with what each one is. */
export function textKeys(quest: QuestDef): { key: string; label: string; long: boolean }[] {
  const t = quest.text;
  const out = [{ key: `${t}.name`, label: 'Quest name', long: false }];
  for (const s of quest.steps) {
    out.push({ key: `${t}.${s.id}.title`, label: `${s.id} · ask`, long: false });
    out.push({ key: `${t}.${s.id}.copy`, label: `${s.id} · speech`, long: true });
    // Optional: the speech while playing with a game controller (decision 0183).
    out.push({ key: `${t}.${s.id}.copy@pad`, label: `${s.id} · speech · controller`, long: true });
    for (const o of s.choose ?? []) {
      out.push({ key: `${t}.${s.id}.${o.id}.title`, label: `${s.id} › ${o.id}`, long: false });
      out.push({
        key: `${t}.${s.id}.${o.id}.copy`,
        label: `${s.id} › ${o.id} · words`,
        long: true,
      });
    }
  }
  out.push({ key: `${t}.done.title`, label: 'Thanks · title', long: false });
  out.push({ key: `${t}.done.copy`, label: 'Thanks · speech', long: true });
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** Problems with the quests' text: a step ask missing, a language missing, `{par}` not in both. */
export function checkText(doc: QuestDoc): string[] {
  const out: string[] = [];
  for (const q of doc.quests)
    for (const { key, label } of textKeys(q)) {
      const [a, b] = LANGS.map((l) => textOf(doc, l, key));
      const isAsk =
        /\.title$/.test(key) && !key.endsWith('.done.title') && key.split('.').length === 4;
      if (isAsk && a === undefined && b === undefined)
        out.push(`quest ${q.id} › ${label}: no text`);
      else if ((a === undefined) !== (b === undefined))
        out.push(`quest ${q.id} › ${label}: no ${a === undefined ? 'English' : 'French'}`);
      else if (a !== undefined && placeholders(a).join() !== placeholders(b!).join())
        out.push(`quest ${q.id} › ${label}: the {…} differ between English and French`);
    }
  return out;
}

/** Points at sea that `clear` says are on land or reefs. */
export function checkPlaces(
  doc: QuestDoc,
  map: MapDef,
  clear: (x: number, y: number, sea: MapDef) => boolean,
): string[] {
  const out: string[] = [];
  for (const q of doc.quests) {
    // Land that rises or clears after a quest (decision 0166): a quest's places are looked at
    // with the quests it waits on done (0170: Snowberry's landing lies where the pack was).
    const before = questsBefore(q, doc.quests);
    const sea = before.size && hasQuestLand(map) ? standingMap(map, before) : map;
    for (const s of q.steps)
      for (const p of stepPlaces(s, map))
        if (p.kind !== 'chart' && !clear(p.x, p.y, sea))
          out.push(
            `quest ${q.id} › ${s.id}: ${p.kind} at (${Math.round(p.x)}, ${Math.round(p.y)}) is not in clear water`,
          );
  }
  return out;
}

/** Every quest a quest waits on to start, through its start condition, and theirs in turn. */
export function questsBefore(quest: QuestDef, quests: readonly QuestDef[]): Set<string> {
  const out = new Set<string>();
  const named = (v: unknown): string[] =>
    !v || typeof v !== 'object'
      ? []
      : Array.isArray(v)
        ? v.flatMap(named)
        : [
            ...(typeof (v as { quest?: unknown }).quest === 'string'
              ? [(v as { quest: string }).quest]
              : []),
            ...Object.values(v).flatMap(named),
          ];
  const todo = named(quest.start);
  while (todo.length) {
    const id = todo.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    todo.push(...named(quests.find((q) => q.id === id)?.start));
  }
  return out;
}

/**
 * Every problem the quest builder lists (its Checks panel), also run by `npm run check`
 * (decision 0153): quest files, hooks on island files, text and places.
 */
/** The grown Phase 4 sea, built once when the checks first need it. */
let GROWN: MapDef | undefined;

export function questProblems(doc: QuestDoc, map: MapDef): string[] {
  try {
    // Quests for a Phase 4 sea this map lacks are left to the grown sea's checks (decision 0155);
    // a quest naming a port no sea has is still checked here, so a misspelt port shows.
    const grown = (GROWN ??= prepareMap(grownMap(PHASE1_SOURCE)));
    const here = doc.quests.filter(
      (q) => questsFor(map, [q]).length > 0 || questsFor(grown, [q]).length === 0,
    );
    return [
      ...checkQuests(here, map),
      ...checkQuestHooks(map, Object.values(ISLAND_DESIGNS), doc.quests),
      ...checkText(doc),
      ...checkPlaces({ ...doc, quests: here }, map, (x, y, sea) => clearAt(sea, x, y, 0)),
    ];
  } catch (e) {
    return [`the checks stopped: ${String(e)}`];
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

/** The shipped text with edits: changed keys in place, new keys after their quest's last key. */
export function mergeText(lang: Lang, edits: Record<string, string>): Record<string, string> {
  const merged: [string, string][] = Object.entries(SHIPPED_TEXT[lang]).map(([k, v]) => [
    k,
    edits[k] ?? v,
  ]);
  for (const [key, value] of Object.entries(edits)) {
    if (key in SHIPPED_TEXT[lang]) continue;
    const prefix = key.split('.').slice(0, 2).join('.') + '.';
    let at = -1;
    merged.forEach(([k], i) => {
      if (k.startsWith(prefix)) at = i;
    });
    if (at < 0)
      merged.forEach(([k], i) => {
        if (k.startsWith('quest.')) at = i;
      });
    merged.splice(at < 0 ? merged.length : at + 1, 0, [key, value]);
  }
  return Object.fromEntries(merged);
}

/** Every reward kind with what it holds, for the reward form. */
export const REWARD_FIELDS: { key: keyof QuestReward; label: string }[] = [
  { key: 'gold', label: 'Gold' },
  { key: 'standing', label: 'Standing' },
  { key: 'discover', label: 'On the chart' },
  { key: 'levelUp', label: 'Level up' },
  { key: 'found', label: 'Found an outpost' },
  { key: 'homeIsland', label: 'An island' },
  { key: 'homeSpot', label: 'Building spots' },
  { key: 'erupt', label: 'Eruption' },
];
