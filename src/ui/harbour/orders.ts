import { goodName, t } from '../../i18n';
import type { Contract } from '../../sim/contracts';
import { trades, quoteBuy } from '../../sim/market';
import { findPort } from '../../sim/trade';
import type { World } from '../../sim/world';
import { button } from '../components/button';
import { el } from '../components/dom';
import { listRow } from '../components/listRow';
import { liveOrder, ordersElsewhere } from './marketFacts';
import { coins, goodArt } from './parts';

/**
 * The Orders tab (decision 0028, issue #443): the Market's ledger shape. On the left this port's
 * order, then the other charted ports' open orders; on the right the picked one, with Deliver
 * when it is this port's.
 */
export function ordersLedger(
  world: World,
  selected: string | null,
  pick: (portId: string) => void,
): HTMLElement {
  const list = el('div', 'hb-list hb-orders');
  list.append(el('h3', 'hb-list-title', t('trade.orders')));
  const here = liveOrder(world);
  if (here) list.append(orderRow(world, here, here.portId === selected, pick, true));
  else list.append(el('p', 'hb-muted', t('trade.noOrder')));
  const others = ordersElsewhere(world);
  if (others.length) {
    const ul = el('ul', 'contract-list');
    for (const c of others) {
      const li = el('li', '');
      li.append(orderRow(world, c, c.portId === selected, pick, false));
      ul.append(li);
    }
    list.append(ul);
  }
  return list;
}

/** The order picked by default: this port's, else the first elsewhere. */
export function firstOrder(world: World): string | null {
  return liveOrder(world)?.portId ?? ordersElsewhere(world)[0]?.portId ?? null;
}

const portName = (world: World, id: string) => findPort(world.map, id)?.name ?? id;
const goodsWords = (c: Contract) =>
  t('trade.contractGoods', { qty: c.qty, good: goodName(c.good).toLowerCase() });

function orderRow(
  world: World,
  c: Contract,
  selected: boolean,
  pick: (portId: string) => void,
  here: boolean,
): HTMLElement {
  const aboard = world.trade.captain.cargo[c.good] >= c.qty;
  const row = listRow({
    label: here
      ? t('harbour.orderHereTitle', { port: portName(world, c.portId) })
      : portName(world, c.portId),
    detail: `${goodsWords(c)} · ${t('trade.reward')} ${c.reward}${aboard ? ` · ${t('trade.inHoldBadge')}` : ''}`,
    selected,
    onPress: () => pick(c.portId),
  });
  row.classList.add('hb-row', here ? 'contract-here' : 'contract-other');
  row.dataset.pick = `order:${c.portId}`;
  row.prepend(goodArt(c.good));
  const reward = el('span', 'hb-price hb-c-reward');
  reward.innerHTML = coins(c.reward);
  row.append(reward);
  return row;
}

/** The picked order: who wants what, the reward, what is aboard, and Deliver for this port's. */
export function orderDetail(world: World, portId: string, deliver: () => void): HTMLElement {
  const { trade } = world;
  const pane = el('aside', 'hb-detail');
  const c =
    portId === trade.dockedAt
      ? liveOrder(world)
      : ordersElsewhere(world).find((o) => o.portId === portId);
  if (!c) return pane;
  const top = el('div', 'hb-detail-top');
  const words = el('div', 'hb-detail-words');
  words.append(
    el('h2', 'hb-detail-name', portName(world, c.portId)),
    el('p', 'hb-detail-note', `${t('trade.portOrders')} ${goodsWords(c)}`),
  );
  top.append(goodArt(c.good, 'big'), words);
  pane.append(top);
  if (c.help) pane.append(el('p', 'hb-order-help', t('trade.help')));

  const facts = el('dl', 'hb-facts');
  const fact = (label: string, value: string) => {
    const dd = el('dd', '');
    dd.innerHTML = value;
    facts.append(el('dt', '', label), dd);
  };
  const market = trade.markets[trade.dockedAt!];
  fact(t('trade.reward'), coins(c.reward));
  fact(t('trade.hold'), `${trade.captain.cargo[c.good]} / ${c.qty}`);
  if (market && trades(market, c.good))
    fact(t('harbour.buyHere'), coins(quoteBuy(market, c.good, 1)));
  pane.append(facts);

  if (c.portId === trade.dockedAt) {
    const missing = c.qty - trade.captain.cargo[c.good];
    const b = button({
      label:
        missing > 0
          ? t('trade.needMore', { n: missing })
          : t('trade.deliverFor', { reward: c.reward }),
      variant: 'primary',
      disabled: missing > 0,
      onPress: deliver,
    });
    b.id = 'tp-deliver';
    b.classList.add('hb-wide');
    pane.append(b);
  } else
    pane.append(el('p', 'hb-muted', t('harbour.orderSail', { port: portName(world, c.portId) })));
  return pane;
}
