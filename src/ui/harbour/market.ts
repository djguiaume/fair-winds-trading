import { goodName, t } from '../../i18n';
import { GOODS, type GoodId } from '../../sim/goods';
import {
  type GoodRole,
  type Market,
  goodRole,
  quoteBuy,
  quoteSell,
  trades,
} from '../../sim/market';
import { priceTrend } from '../../sim/priceLog';
import { madeGoods, settlementLevel } from '../../sim/settlement';
import { findPort } from '../../sim/trade';
import type { World } from '../../sim/world';
import { el } from '../components/dom';
import { listRow } from '../components/listRow';
import { bestSaleElsewhere, liveOrder } from './marketFacts';
import { coins, figure, goodArt } from './parts';
import { sparkline } from './trend';
import './ledger.css';

/**
 * The Market's ledger (issue #443, round 3 D): one row per good this port trades, about 64 px
 * tall, with its icon, name and note, what is in the hold, the buy and sell prices, the last
 * days' price line and where it sells best elsewhere. A row picks its good for the detail pane.
 */
export function goodsLedger(
  world: World,
  market: Market,
  selected: GoodId | null,
  pick: (good: GoodId) => void,
): HTMLElement {
  const list = el('div', 'hb-list');
  list.append(columns());
  for (const good of tradedGoods(market))
    list.append(goodRow(world, market, good, good === selected, () => pick(good)));
  return list;
}

/** The goods the port trades, in the goods file's order (specialized ones only where made or wanted). */
export function tradedGoods(market: Market): GoodId[] {
  return GOODS.filter((g) => trades(market, g));
}

function columns(): HTMLElement {
  const head = el('div', 'hb-cols');
  head.setAttribute('aria-hidden', 'true');
  for (const [cls, key] of [
    ['hb-c-name', 'harbour.colGoods'],
    ['hb-c-hold', 'trade.hold'],
    ['hb-c-buy', 'trade.buy'],
    ['hb-c-sell', 'trade.sell'],
    ['hb-c-trend', 'harbour.colTrend'],
    ['hb-c-best', 'trade.bestElsewhereTitle'],
  ] as const)
    head.append(el('span', cls, t(key)));
  return head;
}

/** What the good is to this port, and its note: "made here", "wanted", "wanted · order 7". */
export function goodNote(world: World, good: GoodId): { role: GoodRole; text: string } {
  const { trade, map } = world;
  const port = findPort(map, trade.dockedAt!)!;
  const role = goodRole(port, good, settlementLevel(trade, port.id), madeGoods(map, trade));
  if (role === 'produces') return { role, text: t('trade.madeHere') };
  if (role !== 'wants') return { role, text: '' };
  const order = liveOrder(world);
  const text = order?.good === good ? t('trade.wantedOrder', { n: order.qty }) : t('trade.wanted');
  return { role, text };
}

function goodRow(
  world: World,
  market: Market,
  good: GoodId,
  selected: boolean,
  pick: () => void,
): HTMLElement {
  const note = goodNote(world, good);
  const row = listRow({
    label: goodName(good),
    detail: note.text || undefined,
    selected,
    onPress: pick,
  });
  row.classList.add('hb-row', 'hb-good', `is-${note.role}`);
  row.dataset.pick = `good:${good}`;
  row.prepend(goodArt(good));
  const best = bestSaleElsewhere(world, good);
  const trend = el('span', 'hb-c-trend');
  trend.innerHTML = sparkline(priceTrend(world.trade, market.portId, good), 96, 28);
  row.append(
    figure(String(world.trade.captain.cargo[good]), t('trade.hold'), 'hb-c-hold'),
    price(quoteBuy(market, good, 1), 'hb-c-buy'),
    price(quoteSell(market, good, 1), 'hb-c-sell'),
    trend,
    el('span', 'hb-c-best', best ? t('trade.paysAt', { name: best.name, price: best.sell }) : ''),
  );
  return row;
}

function price(n: number, cls: string): HTMLElement {
  const cell = el('span', `hb-price ${cls}`);
  cell.innerHTML = coins(n);
  return cell;
}
