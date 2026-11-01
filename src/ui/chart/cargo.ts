import './cargo.css';
import { goodName, t } from '../../i18n';
import { GOODS, type GoodId } from '../../sim/goods';
import { SHIP_CLASSES } from '../../sim/ship';
import { capacity, cargoUsed } from '../../sim/trade';
import type { World } from '../../sim/world';
import { el } from '../components/dom';
import { listRow } from '../components/listRow';
import { icon } from '../icons';
import { chartSize } from './svg';

/**
 * The Cargo page (decision 0213, issue #444): each room as a row of crates, full or empty, so an
 * empty hold still reads as a hold (art director). Under the hold, the goods aboard as big
 * colour-coded icons; under the deck, the quest cargo as list rows.
 */
export function drawCargo(list: HTMLElement, world: World, deck: readonly string[]) {
  const { trade } = world;
  const { cargo } = trade.captain;
  const goods = GOODS.filter((g) => cargo[g] > 0);
  const deckRoom = SHIP_CLASSES[trade.captain.activeShip]!.deck;
  const deckUsed = trade.quests.hold ?? 0;
  list.replaceChildren(
    section(
      t('chart.holdTitle'),
      `${cargoUsed(trade)}/${capacity(trade)}`,
      crates(capacity(trade), (unit) => goodAt(goods, cargo, unit)),
      goods.length ? goodsGrid(goods, cargo) : el('p', 'chart-page-muted', t('chart.holdNone')),
    ),
    section(
      t('quest.cargoTitle'),
      `${deckUsed}/${deckRoom}`,
      crates(deckRoom, (unit) => (unit < deckUsed ? 'crate' : null)),
      ...deck.map((line) => listRow({ label: line })),
    ),
  );
}

function section(title: string, room: string, ...body: HTMLElement[]): HTMLElement {
  const root = el('section', 'chart-cargo-section');
  const head = el('h4', 'chart-page-rule');
  head.append(el('span', '', title), el('b', '', room));
  root.append(head, ...body);
  return root;
}

/**
 * A room as crates: one a unit, or a share of a big hold so the row stays short (theme
 * `chartSize.crates`). `fill(unit)` names the icon in the crate that starts at that unit.
 */
function crates(room: number, fill: (unit: number) => string | null): HTMLElement {
  const per = Math.max(1, Math.ceil(room / chartSize('crates')));
  const row = el('div', 'chart-crates');
  row.setAttribute('aria-hidden', 'true');
  for (let unit = 0; unit < room; unit += per) {
    const what = fill(unit);
    const crate = el('span', `chart-crate${what ? ' is-full' : ''}`);
    crate.innerHTML = icon(what ?? 'crate', 'chart-crate-icon');
    row.append(crate);
  }
  return row;
}

/** The good stowed at a unit of the hold, goods packed in the game's order. */
function goodAt(goods: readonly GoodId[], cargo: Record<GoodId, number>, unit: number) {
  let end = 0;
  for (const g of goods) {
    end += cargo[g];
    if (unit < end) return g;
  }
  return null;
}

function goodsGrid(goods: readonly GoodId[], cargo: Record<GoodId, number>): HTMLElement {
  const grid = el('div', 'chart-goods');
  for (const g of goods) {
    const tile = el('div', 'chart-good');
    tile.insertAdjacentHTML('beforeend', icon(g, 'chart-good-icon'));
    tile.append(el('span', 'chart-good-name', goodName(g)), el('b', '', `×${cargo[g]}`));
    grid.append(tile);
  }
  return grid;
}
