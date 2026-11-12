import type { TextVariant } from '../../i18n';
import type { MapDef } from '../../sim/map';
import { QUESTS, type QuestDef } from '../../sim/quests';
import type { View } from '../chart';
import { History } from '../model';
import { EDITED_QUESTS_KEY, type Lang, type QuestDoc, isQuestDoc } from './doc';
import type { FormContext } from './form';

/*
 * What the quest builder (decision 0142) has open, shared by its parts: the working copy, the
 * open quest and step, the view, and edit / undo. Each part redraws through `render`, which
 * builder.ts hands in, so no part imports the page itself.
 */

export interface QuestHost {
  /** The map being edited, and the same after prepareMap. */
  map(): MapDef;
  prepared(): MapDef;
  shipped(): MapDef;
  mapName(): string;
  close(): void;
}

export type Tab = 'goal' | 'card' | 'sea' | 'reward';
export type Centre = 'chart' | 'card' | 'story';
export type Tool = 'select' | 'add' | 'compass' | 'move' | 'buoy' | 'storm';

const SHIPPED_QUESTS: QuestDef[] = structuredClone(QUESTS) as QuestDef[];
const SHIPPED_STEPS = new Map(SHIPPED_QUESTS.map((q) => [q.id, new Set(q.steps.map((s) => s.id))]));

export const shippedDoc = (): QuestDoc => ({
  quests: structuredClone(SHIPPED_QUESTS),
  text: { en: {}, fr: {} },
});

export const shippedQuest = (id: string) => SHIPPED_STEPS.has(id);
export const shippedStep = (q: string, s: string) => SHIPPED_STEPS.get(q)?.has(s) ?? false;

export const qb = {
  host: undefined as unknown as QuestHost,
  root: undefined as unknown as HTMLElement,
  open: false,
  doc: shippedDoc(),
  questId: SHIPPED_QUESTS[0]?.id ?? '',
  stepId: null as string | null,
  tab: 'goal' as Tab,
  centre: 'chart' as Centre,
  tool: 'select' as Tool,
  lang: 'en' as Lang,
  showAll: true,
  /** Which version of the speech the text table edits and the card shows (decision 0184). */
  speechWay: null as TextVariant | null,
  view: { cx: 0, cy: 0, upp: 1 } as View,
};

export const history = new History<QuestDoc>();

export const $ = <T extends Element = HTMLElement>(sel: string) => qb.root.querySelector(sel) as T;

export const quest = () => qb.doc.quests.find((q) => q.id === qb.questId);
export const step = () => quest()?.steps.find((s) => s.id === qb.stepId);

/** Opens a quest at its own page (no step picked). */
export function pickQuest(id: string) {
  qb.questId = id;
  qb.stepId = null;
}

let redraw = () => {};
/** builder.ts hands in the page's redraw. */
export const setRender = (fn: () => void) => (redraw = fn);
export const render = () => redraw();

export const isEdited = () => JSON.stringify(qb.doc) !== JSON.stringify(shippedDoc());

export function loadDoc(): QuestDoc {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(EDITED_QUESTS_KEY) ?? 'null');
    if (isQuestDoc(raw)) return raw;
  } catch {
    /* No storage or an unreadable draft: start from the shipped quests. */
  }
  return shippedDoc();
}

/** Records undo, makes the change, saves and redraws everything. */
export function edit(change: () => void) {
  history.record(qb.doc);
  change();
  commit();
}

export function commit() {
  const edited = isEdited();
  try {
    if (edited) localStorage.setItem(EDITED_QUESTS_KEY, JSON.stringify(qb.doc));
    else localStorage.removeItem(EDITED_QUESTS_KEY);
  } catch {
    /* Private mode: the builder still works, the edits last only while the page is open. */
  }
  render();
}

export function undo() {
  const prior = history.undo(qb.doc);
  if (prior) {
    qb.doc = prior;
    commit();
  }
}

export function redo() {
  const next = history.redo(qb.doc);
  if (next) {
    qb.doc = next;
    commit();
  }
}

export function reset() {
  if (!confirm('Throw away every quest and text edit and go back to the shipped quests?')) return;
  history.record(qb.doc);
  qb.doc = shippedDoc();
  commit();
}

export function formContext(q: QuestDef): FormContext {
  return { map: qb.host.prepared(), quests: qb.doc.quests, quest: q, edit };
}
