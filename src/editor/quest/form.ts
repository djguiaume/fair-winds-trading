import { GOODS } from '../../sim/goods';
import { BUILDINGS } from '../../sim/home';
import {
  CONDITIONS,
  CONDITION_ABOUT,
  type Condition,
  type Param,
  type QuestPoint,
  SCREENS,
  POINTS_OF_SAIL,
} from '../../sim/questLibrary';
import { REGATTA } from '../../sim/regatta';
import { SHIP_CLASSES } from '../../sim/ship';
import { newCondition } from './doc';
import {
  type FormContext,
  h,
  row,
  select,
  numberInput,
  checkbox,
  segmented,
  portOptions,
  buildableIslands,
  questIds,
  questOf,
  varOptions,
} from './formFields';
import { parField, placeField, pointsField, gateField } from './seaFields';

/*
 * The quest builder's forms (decision 0142), built from the condition library: each parameter
 * of a kind (`CONDITIONS[kind].params`) gets the field its type asks for, so a new kind needs no
 * builder code. Edits change the document in place inside `edit`, which records undo and redraws.
 *
 * The inputs and lists are in `formFields.ts` (passed on from here), the fields for places at sea
 * and pars in `seaFields.ts`.
 */

export * from './formFields';

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
