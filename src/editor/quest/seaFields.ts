import { isDifficulty } from '../../sim/difficulty';
import { MAP_PLACES, type QuestPoint, isSpot } from '../../sim/questLibrary';
import { defaultParam, round1 } from './doc';
import {
  type FormContext,
  h,
  row,
  select,
  numberInput,
  segmented,
  portOptions,
  varOptions,
} from './formFields';

/* The quest builder's fields for places at sea and pars (decisions 0131, 0213, 0217). */

const DIFFICULTIES = ['fair', 'captain', 'salt'];

/** Seconds, or seconds per difficulty level. */
export function parField(name: string, v: unknown, set: (v: unknown) => void): HTMLElement {
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
export function placeField(
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

export function pointsField(
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
export function gateField(
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
