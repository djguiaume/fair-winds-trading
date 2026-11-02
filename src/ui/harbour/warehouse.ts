import { goodName, t } from '../../i18n';
import { GOODS, type GoodId } from '../../sim/goods';
import { storageRoom, storedGoods, storedTotal } from '../../sim/storage';
import type { World } from '../../sim/world';
import { button } from '../components/button';
import { el } from '../components/dom';
import { figure, goodArt } from './parts';

/**
 * The home island's Warehouse tab (decision 0136) as a harbour ledger (issue #443): one row per
 * good aboard or kept, how many on each side, and the buttons to store and take.
 */
export type StoreMove = (dir: 'in' | 'out', good: GoodId, n: number) => void;

export function warehousePane(world: World, move: StoreMove): HTMLElement {
  const { trade } = world;
  const room = storageRoom(trade);
  const kept = storedGoods(trade);
  const goods = GOODS.filter((g) => trade.captain.cargo[g] > 0 || (kept[g] ?? 0) > 0);
  const full = storedTotal(trade) >= room;
  const list = el('div', 'hb-list hb-scroll hb-store');
  list.append(el('h3', 'hb-list-title', t('home.warehouse', { n: storedTotal(trade), max: room })));
  for (const good of goods) {
    const aboard = trade.captain.cargo[good];
    const here = kept[good] ?? 0;
    const row = el('div', 'ui-row hb-row hb-store-row');
    const name = el('span', 'ui-row-label', goodName(good));
    const step = (label: string, dir: 'in' | 'out', n: number, off: boolean) => {
      const b = button({ label, disabled: off, onPress: () => move(dir, good, n) });
      Object.assign(b.dataset, { store: dir, good, n: String(n) });
      return b;
    };
    row.append(
      goodArt(good),
      name,
      figure(String(aboard), t('trade.hold'), 'hb-c-hold'),
      figure(String(here), t('home.tabWarehouse'), 'hb-c-kept'),
      step(t('home.store'), 'in', 1, !aboard || full),
      step(t('home.storeAll'), 'in', aboard, !aboard || full),
      step(t('home.take'), 'out', 1, !here),
      step(t('home.takeAll'), 'out', here, !here),
    );
    list.append(row);
  }
  list.append(
    el(
      'p',
      'hb-muted hb-store-note',
      t(goods.length ? 'home.warehouseNote' : 'home.warehouseEmpty'),
    ),
  );
  const pane = el('div', 'hb-pane');
  pane.append(list);
  return pane;
}
