import { REGATTA, MEDALS } from '../../sim/regatta';
import type { QuestDef } from '../../sim/quests';
import { clock, newCondition, round1 } from './doc';
import { type FormContext, checkbox, h, numberInput, row, select } from './form';
import { raceStormRows } from './raceStormView';

/**
 * A race of the regatta (decision 0217): its series, the gold of each medal the first time, who
 * starts it, and its pars by ship class and level. The pars come from the balance bots
 * (`npm run race -- <id> --pars --write`); the line and the marks are its one step's `raced` goal,
 * dragged on the chart like any place.
 */
export function raceRows(
  q: QuestDef,
  ctx: FormContext,
  edit: (fn: () => void) => void,
  people: [string, string][],
  pickStormOnChart: () => void,
): HTMLElement[] {
  const out: HTMLElement[] = [
    row(
      'Race',
      checkbox(
        !!q.race,
        (on) =>
          edit(() => {
            if (!on) return delete q.race;
            q.race = {
              series: REGATTA.series[0]!.id,
              gold: { bronze: 60, silver: 120, gold: 200 },
              pars: {},
            };
            q.offer = true;
            delete q.reward;
            const s = ctx.map.start;
            q.steps = [
              {
                id: 'race',
                goal: newCondition('raced', ctx.map, []),
                moveTo: { x: round1(s.x), y: round1(s.y), headingDeg: 0 },
              },
            ];
          }),
        'a race of the regatta: one raced step, medals, Race again (0217)',
      ),
    ),
  ];
  const race = q.race;
  if (!race) return out;
  out.push(
    row(
      'Series',
      select(
        REGATTA.series.map((s) => [s.id, s.name] as [string, string]),
        race.series,
        (v) => edit(() => (race.series = v)),
      ),
    ),
    row(
      'Medal gold',
      ...MEDALS.map((m) =>
        h(
          'span',
          { class: 'qb-medal' },
          `${m} `,
          numberInput(
            race.gold[m],
            (n) => n !== undefined && edit(() => (race.gold[m] = Math.max(0, Math.round(n)))),
          ),
        ),
      ),
    ),
    row(
      'Starter',
      select(people, q.starter, (v) => edit(() => (v ? (q.starter = v) : delete q.starter)), '—'),
    ),
  );
  out.push(...raceStormRows(q, edit, pickStormOnChart));
  const ships = Object.keys(race.pars);
  const pars = ships.length
    ? ships
        .map(
          (ship) =>
            `${ship} ${['fair', 'captain', 'salt'].map((l) => clock(race.pars[ship]![l] ?? 0)).join(' / ')}`,
        )
        .join(' · ')
    : 'none yet';
  out.push(row('Pars', h('small', {}, `${pars} — npm run race -- ${q.id} --pars --write`)));
  return out;
}
