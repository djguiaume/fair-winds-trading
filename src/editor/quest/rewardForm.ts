import { hasVolcano } from '../../data/islands';
import { homeSpots } from '../../sim/home';
import type { QuestReward } from '../../sim/questRewards';
import { SHIP_CLASSES } from '../../sim/ship';
import {
  type FormContext,
  buildableIslands,
  checkbox,
  h,
  numberInput,
  portOptions,
  row,
  select,
} from './form';

/* The quest builder's reward form (decision 0142): one row per reward kind. */

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
  { key: 'order', label: 'Paid like a help order' },
  { key: 'ship', label: 'A ship' },
];

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
