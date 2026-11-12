import { clearAt } from '../../sim/mapChecks';
import { playUrl, seaStart, stepPort } from './doc';
import { h, row, segmented, select } from './form';
import { $, qb, quest } from './state';

/**
 * The Play dialog: pick the open quest's step and where the boat starts (docked at a port, or at
 * sea short of the step's first place), then the game opens in a new tab on the edited map with
 * these quests, on a fresh voyage that keeps nothing (decision 0142).
 */
export function openPlay() {
  const q = quest();
  const dialog = $<HTMLDialogElement>('.qb-play');
  if (!q) return;
  const map = qb.host.prepared();
  let at = qb.stepId ?? q.steps[0]?.id ?? '';
  let where: 'port' | 'sea' = 'port';
  let port = stepPort(
    q,
    q.steps.find((s) => s.id === at),
    map,
  );
  const draw = () => {
    const s = q.steps.find((x) => x.id === at);
    const sea = s ? seaStart(s, map, (x, y) => clearAt(map, x, y, 4)) : null;
    if (!sea && where === 'sea') where = 'port';
    const go = h('button', { type: 'button', class: 'primary' }, '▶ Play in a new tab');
    go.addEventListener('click', () => {
      const start = where === 'sea' && sea ? sea : { port };
      window.open(playUrl(q.id, at, start), '_blank');
      dialog.close();
    });
    const cancel = h('button', { type: 'button' }, 'Cancel');
    cancel.addEventListener('click', () => dialog.close());
    const starts: [string, string][] = [['port', 'Docked at a port']];
    if (sea) starts.push(['sea', 'At sea, near the place']);
    dialog.replaceChildren(
      h('h2', {}, `Play “${q.name}”`),
      row(
        'From step',
        select(
          q.steps.map((x, i): [string, string] => [x.id, `${i + 1}. ${x.id}`]),
          at,
          (v) => {
            at = v;
            port = stepPort(
              q,
              q.steps.find((x) => x.id === v),
              map,
            );
            draw();
          },
        ),
      ),
      row(
        'Start',
        segmented(starts, where, (v) => {
          where = v as 'port' | 'sea';
          draw();
        }),
      ),
      where === 'port'
        ? row(
            'Port',
            select(
              map.ports.map((x): [string, string] => [x.id, x.name]),
              port,
              (v) => (port = v),
            ),
          )
        : h(
            'p',
            { class: 'qb-note' },
            `At ${sea!.x}, ${sea!.y}, about 30 short of the step's first place, heading for it (or off the wind if it blows from there).`,
          ),
      h(
        'p',
        { class: 'qb-note' },
        'A fresh Captain voyage with the tutorial skipped: the quests this one waits on count as done, and the earlier steps pay their rewards. Nothing is saved. The test bar at the bottom restarts or skips the step.',
      ),
      h('div', { class: 'qb-play-actions' }, cancel, go),
    );
  };
  draw();
  dialog.showModal();
}
