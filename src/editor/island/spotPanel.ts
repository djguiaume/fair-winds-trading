import type { IslandDesign } from '../../data/islands';
import { BUILDINGS } from '../../sim/home';
import { addSpot } from './doc';

/**
 * The island builder's panel for build spots (decisions 0126, 0128): the island's spots, each an
 * arc spot of a pair (it offers that pair's two buildings) or a spare one (a building passed over
 * comes back there), and what the island shows: every building at once, as first found, or with
 * the buildings picked here. Building and run-down props are ordinary props tagged
 * `home:<building>` and `home-empty:<spot>`.
 */

/** What the builder draws: the whole file, the island as first found, or a chosen state. */
export type SpotShow = 'all' | 'first' | 'chosen';

export interface SpotPanelHost {
  design: IslandDesign;
  selected: number | null;
  show: SpotShow;
  /** Spot id → building shown there (with `chosen`). */
  chosen: Record<string, string>;
  select(index: number | null): void;
  setShow(show: SpotShow): void;
  setChosen(spotId: string, buildingId: string | undefined): void;
  change(edit: (design: IslandDesign) => void): void;
  remove(index: number): void;
}

const PAIRS = [...new Set(BUILDINGS.map((b) => b.pair))];
const pretty = (id: string) => id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function renderSpotPanel(root: HTMLElement, host: SpotPanelHost) {
  root.replaceChildren();
  const { design } = host;
  const spots = design.homeSpots ?? [];
  const node = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Record<string, string | boolean> = {},
    parent: HTMLElement = root,
  ): HTMLElementTagNameMap[K] => {
    const el = Object.assign(document.createElement(tag), props);
    parent.append(el);
    return el;
  };
  const select = (
    parent: HTMLElement,
    options: [string, string][],
    value: string,
    set: (v: string) => void,
  ) => {
    const s = node('select', {}, parent);
    for (const [v, text] of options) node('option', { value: v, textContent: text }, s);
    s.value = value;
    s.addEventListener('change', () => set(s.value));
    return s;
  };

  const h = node('h2', { textContent: 'Build spots' });
  node(
    'small',
    {
      textContent: spots.length
        ? `${spots.filter((s) => s.pair).length} arc spots, ${spots.filter((s) => !s.pair).length} spare`
        : 'none: the island cannot be built on',
    },
    h,
  );

  const show = node('div', { className: 'ed-row' });
  node('span', { textContent: 'Show' }, show);
  const seg = node('div', { className: 'ib-seg small' }, show);
  for (const [value, text, title] of [
    ['all', 'Everything', 'Every building and run-down prop at once, as the file has them'],
    ['first', 'First look', 'As the captain first finds it: run-down props, no buildings'],
    [
      'chosen',
      'As chosen',
      'With the buildings picked below for each spot; a spot with none shows its plot staked (0210)',
    ],
  ] as const) {
    const b = node('button', { textContent: text, title }, seg);
    b.setAttribute('aria-pressed', String(host.show === value));
    b.addEventListener('click', () => host.setShow(value));
  }
  node('p', {
    className: 'ed-note',
    textContent:
      host.show === 'all'
        ? 'Every building shows at once here, so they may overlap. Pick First look or As chosen to see (and check) the island as a player will.'
        : 'The checks run on the island as shown. Props of buildings not shown are hidden; drag spots to move them.',
  });

  spots.forEach((spot, index) => {
    const card = node('div', {
      className: `ib-spot-row${host.selected === index ? ' on' : ''}`,
    });
    const title = node(
      'button',
      {
        className: 'ib-spot-name',
        textContent: `${index + 1} · ${spot.id}`,
      },
      card,
    );
    title.addEventListener('click', () => host.select(host.selected === index ? null : index));
    const pair = node('label', { className: 'ed-row' }, card);
    node('span', { textContent: 'Kind' }, pair);
    select(
      pair,
      [['', 'Spare spot'], ...PAIRS.map((p): [string, string] => [p, `Arc spot · ${p}`])],
      spot.pair ?? '',
      (v) =>
        host.change((d) => {
          const s = d.homeSpots![index]!;
          if (v) s.pair = v;
          else delete s.pair;
        }),
    );
    if (host.show === 'chosen') {
      const choose = node('label', { className: 'ed-row' }, card);
      node('span', { textContent: 'Shows' }, choose);
      const options = BUILDINGS.filter((b) => !spot.pair || b.pair === spot.pair);
      select(
        choose,
        [['', 'Nothing yet'], ...options.map((b): [string, string] => [b.id, pretty(b.id)])],
        host.chosen[spot.id] ?? '',
        (v) => host.setChosen(spot.id, v || undefined),
      );
    }
    const buttons = node('div', { className: 'ed-buttons' }, card);
    node('button', { textContent: 'Delete spot', className: 'danger' }, buttons).addEventListener(
      'click',
      () => host.remove(index),
    );
  });

  const add = node('div', { className: 'ed-buttons' });
  node('button', { textContent: '+ Add a spot' }, add).addEventListener('click', () =>
    host.change((d) => {
      host.select(addSpot(d, 0, 0));
    }),
  );
  node('p', {
    className: 'ed-note',
    textContent:
      'Tag a building’s props home:<building> (for example home:workshop) at its arc spot; on a spare spot the same props are moved there. Tag the run-down props that go when a spot is built home-empty:<spot>. Spot ids are stored in saves: rename them only before shipping.',
  });
}
