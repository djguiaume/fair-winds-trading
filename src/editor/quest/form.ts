import { hasVolcano } from '../../data/islands';
import { isDifficulty } from '../../sim/difficulty';
import { GOODS } from '../../sim/goods';
import { BUILDINGS, homeSpots } from '../../sim/home';
import type { MapDef } from '../../sim/map';
import {
  CONDITIONS,
  CONDITION_ABOUT,
  type Condition,
  MAP_PLACES,
  type Param,
  type QuestPoint,
  type QuestReward,
  SCREENS,
  POINTS_OF_SAIL,
  isSpot,
} from '../../sim/questLibrary';
import type { QuestDef } from '../../sim/quests';
import { REGATTA } from '../../sim/regatta';
import { SHIP_CLASSES } from '../../sim/ship';
import { REWARD_FIELDS, defaultParam, newCondition, round1 } from './doc';

/*
 * The quest builder's forms (decision 0142), built from the condition library: each parameter
 * of a kind (`CONDITIONS[kind].params`) gets the field its type asks for, so a new kind needs no
 * builder code. Edits change the document in place inside `edit`, which records undo and redraws.
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
const buildableIslands = (map: MapDef) =>
  map.islands.filter((i) => homeSpots(map, i.id).length).map((i) => i.id);

function questIds(ctx: FormContext): string[] {
  return ctx.quests.map((q) => q.id);
}
/** A quest's steps and options, for the step and option lists. */
function questOf(
  ctx: FormContext,
  id: unknown,
): { steps: { id: string; choose?: { id: string }[] }[] } | undefined {
  return ctx.quests.find((q) => q.id === id);
}
/** The quest's vars of a kind, as `$name` choices (decision 0151). */
const varOptions = (ctx: FormContext, kind: 'port' | 'good'): [string, string][] =>
  Object.entries(ctx.quest.vars ?? {})
    .filter(([, k]) => k === kind)
    .map(([name]): [string, string] => [`$${name}`, `$${name} (picked in play)`]);

// --- Conditions -----------------------------------------------------------------------------

/** Kinds a condition may be: the ones with slots only in a step's goal. */
function kindsFor(inGoal: boolean): [string, string][] {
  return (
    Object.keys(CONDITIONS)
      // `asked` only starts a quest (the tutorial, decision 0151).
      .filter((k) => (inGoal ? k !== 'asked' : !CONDITIONS[k]!.slots))
      .map((k) => [k, `${k} · ${CONDITION_ABOUT[k] ?? ''}`])
  );
}

/**
 * A condition as a box: its kind, then one field per parameter. `replace` swaps the whole
 * condition (a new kind, or wrapping it in all/any/not); `remove` is for members of a list.
 */
export function conditionForm(
  c: Condition,
  ctx: FormContext,
  inGoal: boolean,
  replace: (next: Condition) => void,
  title: string,
  remove?: () => void,
): HTMLElement {
  const box = h('div', { class: 'qb-cond' });
  const head = h('div', { class: 'qb-cond-head' }, h('span', { class: 'qb-k' }, title));
  const kind = select(kindsFor(inGoal), c.is, (k) =>
    ctx.edit(() => replace(newCondition(k, ctx.map, questIds(ctx)))),
  );
  kind.className = 'qb-kind';
  head.append(kind);
  if (remove) {
    const x = h('button', { type: 'button', title: 'Remove this condition' }, '✕');
    x.addEventListener('click', () => ctx.edit(remove));
    head.append(x);
  }
  box.append(head);
  const spec = CONDITIONS[c.is];
  for (const [name, type] of Object.entries(spec?.params ?? {})) {
    const optional = type.endsWith('?');
    const t = type.replace('?', '') as Param;
    const set = (v: unknown) =>
      ctx.edit(() => {
        if (v === undefined || v === '') delete c[name];
        else c[name] = v;
      });
    if (t === 'condition') {
      box.append(
        conditionForm(
          c[name] as Condition,
          ctx,
          inGoal,
          (next) => (c[name] = next),
          name === 'of' ? 'Not' : name,
        ),
      );
      continue;
    }
    if (t === 'conditions') {
      const list = (c[name] as Condition[]) ?? [];
      list.forEach((m, i) =>
        box.append(
          conditionForm(
            m,
            ctx,
            inGoal,
            (next) => (list[i] = next),
            `${i + 1}`,
            list.length > 1 ? () => list.splice(i, 1) : undefined,
          ),
        ),
      );
      const add = h(
        'button',
        { type: 'button', class: 'qb-add' },
        `+ ${c.is === 'all' ? 'and' : 'or'}`,
      );
      add.addEventListener('click', () => ctx.edit(() => list.push({ is: 'always' })));
      box.append(add);
      continue;
    }
    box.append(paramField(t, name, c, ctx, optional, set));
  }
  const wraps = h('div', { class: 'ed-buttons' });
  for (const w of ['all', 'any', 'not'] as const) {
    const b = h('button', { type: 'button', title: `Put this condition inside "${w}"` }, `in ${w}`);
    b.addEventListener('click', () =>
      ctx.edit(() => replace({ is: w, of: w === 'not' ? c : [c] })),
    );
    wraps.append(b);
  }
  if ((c.is === 'all' || c.is === 'any' || c.is === 'not') && c.of) {
    const b = h(
      'button',
      { type: 'button', title: 'Keep only the first condition inside' },
      'unwrap',
    );
    b.addEventListener('click', () =>
      ctx.edit(() => replace(Array.isArray(c.of) ? (c.of[0] as Condition) : (c.of as Condition))),
    );
    wraps.append(b);
  }
  box.append(wraps);
  return box;
}

function paramField(
  t: Param,
  name: string,
  c: Condition,
  ctx: FormContext,
  optional: boolean,
  set: (v: unknown) => void,
): HTMLElement {
  const v = c[name];
  const blank = optional ? '—' : undefined;
  switch (t) {
    case 'port':
      return row(
        name,
        select([...portOptions(ctx.map), ...varOptions(ctx, 'port')], v as string, set, blank),
      );
    case 'good':
      return row(name, select([...GOODS, ...varOptions(ctx, 'good')], v as string, set, blank));
    case 'screen':
      return row(name, select([...SCREENS], v as string, set, blank));
    case 'sailing':
      return row(name, select([...POINTS_OF_SAIL], v as string, set, blank));
    case 'ship':
      return row(name, select(Object.keys(SHIP_CLASSES), v as string, set, blank));
    case 'series':
      return row(
        name,
        select(
          REGATTA.series.map((s) => s.id),
          v as string,
          set,
          blank,
        ),
      );
    case 'building':
      return row(
        name,
        select(
          BUILDINGS.map((b) => b.id),
          v as string,
          set,
          blank,
        ),
      );
    case 'island':
      return row(
        name,
        select(buildableIslands(ctx.map), v as string, set, optional ? 'home island' : undefined),
      );
    case 'quest':
      return row(name, select(questIds(ctx), v as string, set, blank));
    case 'step':
      return row(
        name,
        select(questOf(ctx, c.quest)?.steps.map((s) => s.id) ?? [], v as string, set, blank),
      );
    case 'option':
      return row(
        name,
        select(
          questOf(ctx, c.quest)?.steps.flatMap((s) => (s.choose ?? []).map((o) => o.id)) ?? [],
          v as string,
          set,
          blank,
        ),
      );
    case 'item':
      return row(name, select(Object.keys(ctx.quest.items ?? {}), v as string, set, blank));
    case 'count':
    case 'number':
      return row(
        name,
        numberInput(
          v as number | undefined,
          (n) => set(t === 'count' && n !== undefined ? Math.round(n) : n),
          optional ? '—' : '',
        ),
      );
    case 'flag':
      return row(
        name,
        checkbox(v === true, (on) => set(on ? true : undefined)),
      );
    case 'order':
      return row(
        name,
        segmented(
          [
            ['any', 'any'],
            ['in-order', 'in order'],
          ],
          (v as string) ?? 'any',
          (o) => set(o === 'any' && optional ? undefined : o),
        ),
      );
    case 'par':
      return parField(name, v, set);
    case 'place':
      return placeField(name, v, ctx, set);
    case 'points':
      return pointsField(name, v as (QuestPoint | string)[] | undefined, ctx, optional, set);
    case 'gate':
      return gateField(name, v as QuestPoint[] | undefined, ctx, set);
    default:
      return row(name, String(v ?? ''));
  }
}

const DIFFICULTIES = ['fair', 'captain', 'salt'];

/** Seconds, or seconds per difficulty level. */
function parField(name: string, v: unknown, set: (v: unknown) => void): HTMLElement {
  const per = typeof v === 'object' && v !== null;
  const box = h('div', { class: 'qb-par' });
  box.append(
    segmented(
      [
        ['one', 'one par'],
        ['per', 'per level'],
      ],
      per ? 'per' : 'one',
      (mode) => {
        if (mode === 'per' && !per) {
          const s = typeof v === 'number' ? v : 120;
          set({ fair: Math.round(s * 1.3), captain: s, salt: Math.round(s * 0.8) });
        } else if (mode === 'one' && per) set((v as Record<string, number>).captain ?? 120);
      },
    ),
  );
  if (per) {
    const levels = v as Record<string, number>;
    for (const level of DIFFICULTIES.filter(isDifficulty))
      box.append(
        h(
          'span',
          { class: 'qb-par-level' },
          level,
          numberInput(levels[level], (n) => set({ ...levels, [level]: n }), 's'),
        ),
      );
  } else box.append(numberInput(v as number | undefined, set, 's'));
  return row(name, box);
}

/** A port, or a spot at sea `{ x, y, within, maxKn?, holdSec? }` placed on the chart. */
function placeField(
  name: string,
  v: unknown,
  ctx: FormContext,
  set: (v: unknown) => void,
): HTMLElement {
  const spot = isSpot(v);
  const box = h('div', { class: 'qb-place' });
  box.append(
    select(
      [...portOptions(ctx.map), ...varOptions(ctx, 'port'), ['@spot', 'a spot at sea…']],
      spot ? '@spot' : (v as string),
      (p) => {
        if (p !== '@spot') set(p);
        else if (!spot) {
          const s = ctx.map.start;
          set({ x: round1(s.x), y: round1(s.y + 30), within: 10, maxKn: 2, holdSec: 3 });
        }
      },
    ),
  );
  if (spot) {
    const s = v;
    const num = (key: 'x' | 'y' | 'within' | 'maxKn' | 'holdSec', ph: string) =>
      h(
        'span',
        { class: 'qb-mini' },
        ph,
        numberInput(s[key], (n) =>
          ctx.edit(() => {
            if (n === undefined && (key === 'maxKn' || key === 'holdSec')) delete s[key];
            else if (n !== undefined) s[key] = n;
          }),
        ),
      );
    box.append(
      h(
        'div',
        { class: 'qb-spot' },
        num('x', 'x'),
        num('y', 'y'),
        num('within', 'within'),
        num('maxKn', 'max kn'),
        num('holdSec', 'hold s'),
      ),
    );
  }
  return row(name, box);
}

function pointsField(
  name: string,
  points: (QuestPoint | string)[] | undefined,
  ctx: FormContext,
  optional: boolean,
  set: (v: unknown) => void,
): HTMLElement {
  const box = h('div', { class: 'qb-points' });
  (points ?? []).forEach((p, i) => {
    const line = h('div', { class: 'qb-pt' }, h('b', {}, String(i + 1)));
    // A map place by its word (decision 0151), or a point: each map puts the place itself.
    line.append(
      select(
        Object.keys(MAP_PLACES).map((k): [string, string] => [k, `the map’s ${k}`]),
        typeof p === 'string' ? p : '',
        (v) => ctx.edit(() => (points![i] = v || { x: 0, y: 0 })),
        'a point',
      ),
    );
    if (typeof p !== 'string')
      for (const key of ['x', 'y'] as const)
        line.append(
          key,
          numberInput(p[key], (n) => n !== undefined && ctx.edit(() => (p[key] = n))),
        );
    const up = h('button', { type: 'button', title: 'Earlier' }, '↑');
    up.disabled = i === 0;
    up.addEventListener('click', () =>
      ctx.edit(() => points!.splice(i - 1, 0, ...points!.splice(i, 1))),
    );
    const x = h('button', { type: 'button', title: 'Remove this point' }, '✕');
    x.disabled = !optional && points!.length < 2;
    x.addEventListener('click', () =>
      ctx.edit(() => {
        points!.splice(i, 1);
        if (!points!.length) set(undefined);
      }),
    );
    line.append(up, x);
    box.append(line);
  });
  const add = h('button', { type: 'button', class: 'qb-add' }, '+ point (or ◎ on the chart)');
  add.addEventListener('click', () =>
    ctx.edit(() => {
      const last = [...(points ?? [])]
        .reverse()
        .find((o): o is QuestPoint => typeof o !== 'string');
      const p = last
        ? { x: round1(last.x + 15), y: round1(last.y) }
        : (defaultParam('points', ctx.map, []) as QuestPoint[])[0]!;
      if (points) points.push(p);
      else set([p]);
    }),
  );
  box.append(add);
  return row(name, box);
}

/**
 * A race's start or finish line (decision 0217): the committee boat's end, then the pin's. Both
 * ends are dragged on the chart too.
 */
function gateField(
  name: string,
  gate: QuestPoint[] | undefined,
  ctx: FormContext,
  set: (v: unknown) => void,
): HTMLElement {
  const ends = gate?.length === 2 ? gate : (defaultParam('gate', ctx.map, []) as QuestPoint[]);
  const box = h('div', { class: 'qb-points' });
  ends.forEach((p, i) => {
    const line = h('div', { class: 'qb-pt' }, h('b', {}, i ? 'pin' : 'boat'));
    for (const key of ['x', 'y'] as const)
      line.append(
        key,
        numberInput(
          p[key],
          (n) =>
            n !== undefined &&
            ctx.edit(() => {
              if (gate?.length === 2) gate[i]![key] = n;
              else set(ends.map((e, k) => (k === i ? { ...e, [key]: n } : e)));
            }),
        ),
      );
    box.append(line);
  });
  return row(name, box);
}

// --- Rewards --------------------------------------------------------------------------------

/** A reward's fields; an empty reward is removed. */
export function rewardForm(
  reward: QuestReward | undefined,
  ctx: FormContext,
  set: (r: QuestReward | undefined) => void,
): HTMLElement {
  const r: QuestReward = reward ?? {};
  const box = h('div', { class: 'qb-reward' });
  const change = (key: keyof QuestReward, v: unknown) =>
    ctx.edit(() => {
      const next = { ...r } as Record<string, unknown>;
      if (
        v === undefined ||
        (Array.isArray(v) && !v.length) ||
        (typeof v === 'object' && v !== null && !Array.isArray(v) && !Object.keys(v).length)
      )
        delete next[key];
      else next[key] = v;
      // Keep the reward's keys in the usual order.
      const ordered = Object.fromEntries(
        REWARD_FIELDS.filter((f) => f.key in next).map((f) => [f.key, next[f.key]]),
      ) as QuestReward;
      set(Object.keys(ordered).length ? ordered : undefined);
    });
  const ports = portOptions(ctx.map);
  const chips = (
    key: 'discover' | 'levelUp' | 'found' | 'homeSpot' | 'erupt',
    options: [string, string][],
  ) => {
    const list = (r[key] as string[] | undefined) ?? [];
    const wrap = h('span', { class: 'ed-chips' });
    list.forEach((p, i) => {
      const x = h('button', { type: 'button' }, '✕');
      x.addEventListener('click', () =>
        change(
          key,
          list.filter((_, k) => k !== i),
        ),
      );
      wrap.append(h('span', { class: 'ed-chip' }, p, x));
    });
    wrap.append(
      select(
        options.filter(([v]) => !list.includes(v)),
        '',
        (p) => p && change(key, [...list, p]),
        '+ add',
      ),
    );
    return wrap;
  };
  box.append(
    row(
      'Gold',
      numberInput(r.gold, (n) => change('gold', n === undefined ? undefined : Math.round(n)), '—'),
    ),
  );
  const standing = h('span', { class: 'ed-chips' });
  for (const [p, n] of Object.entries(r.standing ?? {})) {
    const input = numberInput(n, (m) => {
      const next = { ...r.standing };
      if (m === undefined) delete next[p];
      else next[p] = Math.round(m);
      change('standing', next);
    });
    input.className = 'qb-small';
    standing.append(h('span', { class: 'ed-chip' }, `${p} `, input));
  }
  standing.append(
    select(
      ports.filter(([v]) => !(v in (r.standing ?? {}))),
      '',
      (p) => p && change('standing', { ...r.standing, [p]: 1 }),
      '+ port',
    ),
  );
  box.append(row('Standing', standing));
  box.append(row('On the chart', chips('discover', ports)));
  box.append(row('Level up', chips('levelUp', ports)));
  // Only the map's empty islands can be founded (decision 0157).
  const sites = ports.filter(([v]) => ctx.map.ports.some((p) => p.id === v && p.site));
  if (sites.length || r.found) box.append(row('Found an outpost', chips('found', sites)));
  const islands: [string, string][] = buildableIslands(ctx.map).map((i) => [i, i]);
  box.append(
    row(
      'An island',
      select(
        [['@home', 'the map’s home island'], ...islands],
        r.homeIsland === true ? '@home' : (r.homeIsland as string | undefined),
        (v) => change('homeIsland', v === '' ? undefined : v === '@home' ? true : v),
        '—',
      ),
    ),
  );
  const spots: [string, string][] = buildableIslands(ctx.map).flatMap((island) =>
    homeSpots(ctx.map, island)
      .filter((s) => s.pair)
      .map((s): [string, string] => {
        const ref = island === ctx.map.homeIsland ? s.id : `${island}:${s.id}`;
        return [ref, `${island} · ${s.id}`];
      }),
  );
  box.append(row('Building spots', chips('homeSpot', spots)));
  // A standing order's ask (decision 0214): the goods it lands paid like a help order there.
  box.append(
    row(
      'Paid like an order',
      checkbox(
        r.order === true,
        (on) => change('order', on ? true : undefined),
        'a help order’s gold and growth for the goods landed',
      ),
    ),
  );
  box.append(
    row(
      'A ship',
      select(
        Object.keys(SHIP_CLASSES),
        r.ship,
        (v) => change('ship', v === '' ? undefined : v),
        '—',
      ),
    ),
  );
  // Volcanoes: islands whose file has a peak with a crater (decision 0178).
  const volcanoes: [string, string][] = ctx.map.islands
    .filter(hasVolcano)
    .map((i) => [i.id, i.name ?? i.id]);
  if (volcanoes.length || r.erupt) box.append(row('Eruption', chips('erupt', volcanoes)));
  return box;
}
