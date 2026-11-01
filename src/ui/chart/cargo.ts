import { goodName, t } from '../../i18n';
import { GOODS } from '../../sim/goods';
import { SHIP_CLASSES } from '../../sim/ship';
import { capacity, cargoUsed } from '../../sim/trade';
import type { World } from '../../sim/world';
import { el } from '../components/dom';
import { listRow } from '../components/listRow';

/**
 * The Cargo page (decision 0213, issue #444): goods in the hold and quest cargo on deck as list
 * rows, each section headed by its room, for a controller or a phone with no tooltip to hover.
 */
export function drawCargo(list: HTMLElement, world: World, deck: readonly string[]) {
  const { trade } = world;
  const { cargo } = trade.captain;
  const goods = GOODS.filter((g) => cargo[g] > 0);
  list.replaceChildren(
    section(
      t('chart.holdTitle'),
      `${cargoUsed(trade)}/${capacity(trade)}`,
      goods.map((g) => listRow({ label: goodName(g), value: `×${cargo[g]}`, icon: g })),
    ),
    section(
      t('quest.cargoTitle'),
      `${trade.quests.hold ?? 0}/${SHIP_CLASSES[trade.captain.activeShip]!.deck}`,
      deck.map((line) => listRow({ label: line })),
    ),
  );
}

function section(title: string, room: string, rows: HTMLElement[]): HTMLElement {
  const root = el('section', 'chart-cargo-section');
  const head = el('h4', 'chart-page-rule');
  head.append(el('span', '', title), el('b', '', room));
  root.append(head, ...(rows.length ? rows : [el('p', 'chart-page-muted', t('chart.holdNone'))]));
  return root;
}
