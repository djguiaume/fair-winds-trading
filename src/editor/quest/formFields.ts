import { homeSpots } from '../../sim/home';
import type { MapDef } from '../../sim/map';
import { type QuestPoint } from '../../sim/questLibrary';
import type { QuestDef } from '../../sim/quests';

/*
 * The quest builder's form fields (decision 0142): the small inputs every editor page uses, the
 * form's context, and the lists the game's data offers.
 */

export interface FormContext {
  map: MapDef;
  quests: readonly QuestDef[];
  /** The quest being edited (its items, its steps). */
  quest: QuestDef;
  edit(change: () => void): void;
  /** Picks a point on the chart for this `{ x, y }`. */
  pick?(point: QuestPoint): void;
}

export const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
};

export function row(label: string, ...field: (Node | string)[]): HTMLElement {
  return h('label', { class: 'ed-row' }, h('span', {}, label), ...field);
}

export function select(
  options: (string | [string, string])[],
  value: string | undefined,
  onPick: (v: string) => void,
  blank?: string,
): HTMLSelectElement {
  const el = h('select');
  const list = options.map((o) => (Array.isArray(o) ? o : [o, o]));
  if (blank !== undefined) list.unshift(['', blank]);
  // A value the list does not know (a typo in a file) stays visible, so the checks can name it.
  if (value !== undefined && value !== '' && !list.some(([v]) => v === value))
    list.push([value, `${value} (unknown)`]);
  for (const [v, text] of list) el.append(new Option(text, v, false, v === (value ?? '')));
  el.addEventListener('change', () => onPick(el.value));
  return el;
}

export function numberInput(
  value: number | undefined,
  onSet: (v: number | undefined) => void,
  placeholder = '',
): HTMLInputElement {
  const el = h('input', { type: 'number', step: 'any', placeholder });
  if (value !== undefined) el.value = String(value);
  el.addEventListener('change', () => onSet(el.value === '' ? undefined : Number(el.value)));
  return el;
}

export function textInput(value: string, onSet: (v: string) => void): HTMLInputElement {
  const el = h('input', { type: 'text' });
  el.value = value;
  el.addEventListener('change', () => onSet(el.value.trim()));
  return el;
}

export function checkbox(value: boolean, onSet: (v: boolean) => void, text = ''): HTMLElement {
  const box = h('input', { type: 'checkbox' });
  box.checked = value;
  box.addEventListener('change', () => onSet(box.checked));
  return h('span', { class: 'qb-check' }, box, text ? ` ${text}` : '');
}

/**
 * Fields the forms do not draw yet, as JSON (decision 0151: a lesson's ways back, vars and coach
 * marks): `{}` for none. A text that does not parse is marked and not applied.
 */
export function jsonField(
  label: string,
  value: Record<string, unknown>,
  apply: (v: Record<string, unknown>) => void,
  edit: (change: () => void) => void,
): HTMLElement {
  const shown = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
  const area = h('textarea', { rows: String(Math.min(14, 2 + JSON.stringify(shown).length / 50)) });
  area.className = 'qb-json';
  area.value = Object.keys(shown).length ? JSON.stringify(shown, null, 2) : '{}';
  area.addEventListener('change', () => {
    try {
      const v: unknown = JSON.parse(area.value || '{}');
      if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('an object');
      area.classList.remove('bad');
      edit(() =>
        apply({ ...Object.fromEntries(Object.keys(value).map((k) => [k, undefined])), ...v }),
      );
    } catch (e) {
      area.classList.add('bad');
      area.title = `Not applied: ${(e as Error).message}`;
    }
  });
  return row(label, area);
}

/** Buttons where one is on, like the map editor's toggles. */
export function segmented(
  options: [string, string][],
  value: string,
  onPick: (v: string) => void,
): HTMLElement {
  const box = h('span', { class: 'qb-seg' });
  for (const [v, text] of options) {
    const b = h('button', { type: 'button', 'aria-pressed': String(v === value) }, text);
    b.addEventListener('click', () => onPick(v));
    box.append(b);
  }
  return box;
}
// --- Lists from the game's data -------------------------------------------------------------

export const portOptions = (map: MapDef): [string, string][] => [
  ['home', 'home (the home port)'],
  ...map.ports.map((p): [string, string] => [p.id, p.name]),
];
export const buildableIslands = (map: MapDef) =>
  map.islands.filter((i) => homeSpots(map, i.id).length).map((i) => i.id);

export function questIds(ctx: FormContext): string[] {
  return ctx.quests.map((q) => q.id);
}
/** A quest's steps and options, for the step and option lists. */
export function questOf(
  ctx: FormContext,
  id: unknown,
): { steps: { id: string; choose?: { id: string }[] }[] } | undefined {
  return ctx.quests.find((q) => q.id === id);
}
/** The quest's vars of a kind, as `$name` choices (decision 0151). */
export const varOptions = (ctx: FormContext, kind: 'port' | 'good'): [string, string][] =>
  Object.entries(ctx.quest.vars ?? {})
    .filter(([, k]) => k === kind)
    .map(([name]): [string, string] => [`$${name}`, `$${name} (picked in play)`]);
