import { TUNING } from '../../data/tuning';
import { DEG } from '../../sim/math';
import type { QuestDef } from '../../sim/quests';
import { h, numberInput, row } from './form';
import { removeRaceStorm, shapeRaceStorm } from './raceStormDoc';

/**
 * A race's own storms in the quest builder (decision 0225): the chart shapes you drag (the body
 * moves a storm, the gold handle on its rim sizes it) and the rows that list them. The edits are
 * `raceStormDoc.ts`, the same ones `npm run race -- <id> --storm` makes.
 */

export interface StormShape {
  tag: string;
  attrs: Record<string, string | number>;
  label?: { text: string; x: number; y: number };
}

/** The chart's drawing of each storm: its reach, a handle, a size handle, and its drift arrow. */
export function stormShapes(q: QuestDef | undefined, px: number): StormShape[] {
  const t = TUNING.weather.raceStorms;
  return (q?.race?.storms ?? []).flatMap((s, i): StormShape[] => {
    const r = s.radius ?? t.radius;
    const out: StormShape[] = [
      { tag: 'circle', attrs: { cx: s.x, cy: -s.y, r, class: 'qb-storm', 'data-hit': `qs:${i}` } },
      {
        tag: 'circle',
        attrs: { cx: s.x, cy: -s.y, r: 5 * px, class: 'qb-handle', 'data-hit': `qs:${i}` },
      },
      {
        tag: 'circle',
        attrs: { cx: s.x + r, cy: -s.y, r: 5 * px, class: 'qb-size', 'data-hit': `qz:${i}` },
      },
    ];
    if (s.driftSpeed) {
      const a = (s.driftDeg ?? 0) * DEG;
      const len = Math.max(r, 20 * px);
      out.push({
        tag: 'line',
        attrs: {
          x1: s.x,
          y1: -s.y,
          x2: s.x + Math.sin(a) * len,
          y2: -(s.y + Math.cos(a) * len),
          class: 'qb-storm-drift',
        },
      });
    }
    out[0]!.label = { text: `storm ${i + 1}`, x: s.x, y: s.y + r + 6 * px };
    return out;
  });
}

/** The rows of a race's storms: values per storm, and the button that arms the chart's storm tool. */
export function raceStormRows(
  q: QuestDef,
  edit: (fn: () => void) => void,
  pickOnChart: () => void,
): HTMLElement[] {
  const t = TUNING.weather.raceStorms;
  const list = h('div', { class: 'ed-list' });
  (q.race?.storms ?? []).forEach((s, i) => {
    const line = h('span', { class: 'ed-pair' });
    const drop = h('button', { type: 'button', title: 'Remove this storm' }, '✕');
    drop.addEventListener('click', () => edit(() => removeRaceStorm(q, i)));
    const set =
      (key: 'radius' | 'strength' | 'driftDeg' | 'driftSpeed') => (n: number | undefined) =>
        edit(() => shapeRaceStorm(q, i, { [key]: n ?? null }));
    line.append(
      `${i + 1} `,
      numberInput(s.radius ?? t.radius, set('radius'), 'size'),
      numberInput(s.strength ?? t.strength, set('strength'), 'strength'),
      numberInput(s.driftDeg, set('driftDeg'), 'drift °'),
      numberInput(s.driftSpeed, set('driftSpeed'), 'drift /s'),
      drop,
    );
    list.append(line);
  });
  const add = h('button', { type: 'button', title: 'Click the chart to add a storm' }, '+ storm ⌖');
  add.addEventListener('click', pickOnChart);
  list.append(add);
  return [row('Storms', list)];
}
