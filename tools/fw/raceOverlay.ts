import { writeFileSync } from 'node:fs';
import type { Condition } from '../../src/sim/questLibrary';
import type { QuestDef } from '../../src/sim/quests';
import { seriesById } from '../../src/sim/regatta';

/**
 * A race's course as a `npm run chart` overlay (decision 0217): the line from the start round
 * each mark to the finish, the marks numbered, the lines named; prints the view that frames it.
 */
export function raceOverlay(q: QuestDef, goal: Condition, file: string): number {
  type P = { x: number; y: number };
  const start = goal.start as P[];
  const finish = goal.finish as P[];
  const marks = goal.marks as P[];
  const mid = (g: P[]): [number, number] => [(g[0]!.x + g[1]!.x) / 2, (g[0]!.y + g[1]!.y) / 2];
  const same = JSON.stringify(start) === JSON.stringify(finish);
  const overlay = {
    title: `${q.name} · ${seriesById(q.race!.series)?.name ?? q.race!.series}`,
    legend: [{ style: 'route', text: 'the course, mark to mark (boats sail round land)' }],
    lines: [
      {
        points: [mid(start), ...marks.map((m) => [m.x, m.y]), mid(finish)],
        style: 'route',
        label: q.name,
        arrow: true,
      },
      {
        points: start.map((p) => [p.x, p.y]),
        style: 'short',
        label: same ? 'start and finish' : 'start',
      },
      ...(same ? [] : [{ points: finish.map((p) => [p.x, p.y]), style: 'long', label: 'finish' }]),
    ],
    labels: marks.map((m, i) => ({ at: [m.x, m.y + 14], text: `mark ${i + 1}`, style: 'note' })),
  };
  writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`);
  const all = [...start, ...finish, ...marks];
  const pad = 90;
  const view = [
    Math.min(...all.map((p) => p.x)) - pad,
    Math.min(...all.map((p) => p.y)) - pad,
    Math.max(...all.map((p) => p.x)) + pad,
    Math.max(...all.map((p) => p.y)) + pad,
  ].map(Math.round);
  console.log(
    `${file}: ${q.id}'s course · npm run chart -- --overlay ${file} --view ${view.join(',')}`,
  );
  return 0;
}
