import { goodName, t } from '../../i18n';
import type { GoodId } from '../../sim/goods';
import { type Market, available, quoteBuy, quoteSell } from '../../sim/market';
import { priceTrend } from '../../sim/priceLog';
import { freeSpace, maxBuy } from '../../sim/trade';
import type { World } from '../../sim/world';
import { button, setDisabled } from '../components/button';
import { el, onPress } from '../components/dom';
import { padGlyph } from '../padGlyphs';
import { bestSaleElsewhere, liveOrder } from './marketFacts';
import { goodNote } from './market';
import { coins, goodArt } from './parts';
import { sparkline, trendWords } from './trend';

/** Lot sizes for one press on Buy or Sell (decision 0049); clamped to what the hold, stock and gold allow. */
export const LOTS = [1, 5, 10] as const;
export type Lot = (typeof LOTS)[number];

export interface DetailActions {
  lot: Lot;
  setLot: (lot: Lot) => void;
  trade: (kind: 'buy' | 'sell', good: GoodId, qty: number) => void;
  deliver: () => void;
}

/**
 * The Market's detail pane (issue #443): the picked good's name and what it is to this port, its
 * price line in words, the lot (LT/RT), big Buy (A) and Sell (X) buttons with the price on them,
 * and this port's order when it is for this good. `extras` (the load on credit, quest cargo) go
 * under it.
 */
export function goodDetail(
  world: World,
  market: Market,
  good: GoodId,
  a: DetailActions,
  extras: readonly HTMLElement[],
): HTMLElement {
  const pane = el('aside', 'hb-detail');
  const top = el('div', 'hb-detail-top');
  const words = el('div', 'hb-detail-words');
  words.append(el('h2', 'hb-detail-name', goodName(good)));
  const note = goodNote(world, good).text;
  if (note) words.append(el('p', 'hb-detail-note', note));
  top.append(goodArt(good, 'big'), words);

  const prices = priceTrend(world.trade, market.portId, good);
  const best = bestSaleElsewhere(world, good);
  const trend = el('div', 'hb-detail-trend');
  trend.innerHTML = `${sparkline(prices, 220, 44)}<p></p>`;
  trend.querySelector('p')!.textContent = [
    trendWords(prices),
    best ? t('trade.paysAt', { name: best.name, price: best.sell }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  pane.append(top, trend, lotPicker(a), tradeButtons(world, market, good, a));
  const order = orderLine(world, good, a.deliver);
  if (order) pane.append(order);
  pane.append(...extras);
  return pane;
}

/** ×1 ×5 ×10: the pad's LT/RT step through them (`data-pad="steps"`, padFocus.ts). */
function lotPicker(a: DetailActions): HTMLElement {
  const row = el('div', 'hb-lots');
  row.dataset.pad = 'steps';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', t('trade.lot'));
  row.append(el('small', '', t('trade.lot')));
  row.insertAdjacentHTML('beforeend', padGlyph('lt', 'bumper'));
  for (const n of LOTS) {
    const b = el('button', 'hb-lot ui-pressable', `×${n}`);
    b.type = 'button';
    b.dataset.lot = String(n);
    b.setAttribute('aria-pressed', String(a.lot === n));
    onPress(b, () => a.setLot(n));
    row.append(b);
  }
  row.insertAdjacentHTML('beforeend', padGlyph('rt', 'bumper'));
  return row;
}

/** Why Buy is off: out of stock, a full hold, too little gold. */
function buyRefusal(world: World, market: Market, good: GoodId): string {
  const { trade } = world;
  if (available(market, good) === 0) return t('trade.outOfStock');
  if (freeSpace(trade) === 0) return t('trade.holdFull');
  if (trade.captain.gold < quoteBuy(market, good, 1)) return t('trade.needGold');
  return t('trade.cannotAfford');
}

function tradeButtons(world: World, market: Market, good: GoodId, a: DetailActions): HTMLElement {
  const inHold = world.trade.captain.cargo[good];
  const buyQty = Math.max(1, Math.min(a.lot, maxBuy(world.trade, good)));
  const sellQty = Math.max(1, Math.min(a.lot, inHold));
  const canBuy = maxBuy(world.trade, good) >= buyQty;
  const canSell = inHold >= sellQty;
  const cost = quoteBuy(market, good, buyQty);
  const income = quoteSell(market, good, sellQty);
  const qty = (n: number) => (n > 1 ? ` ${n}` : '');

  const buy = button({
    label: `${t('trade.buy')}${qty(buyQty)}`,
    variant: 'primary',
    onPress: () => a.trade('buy', good, buyQty),
  });
  const sell = button({
    label: `${t('trade.sell')}${qty(sellQty)}`,
    onPress: () => a.trade('sell', good, sellQty),
  });
  sell.dataset.pad = 'secondary';
  for (const [b, kind, n, gold, ok, why, glyph] of [
    [buy, 'buy', buyQty, cost, canBuy, buyRefusal(world, market, good), 'a'],
    [sell, 'sell', sellQty, income, canSell, t('trade.noneInHold'), 'x'],
  ] as const) {
    Object.assign(b.dataset, { action: kind, good, qty: String(n) });
    b.classList.add('hb-trade');
    b.insertAdjacentHTML('afterbegin', padGlyph(glyph));
    b.insertAdjacentHTML('beforeend', `<span class="hb-trade-price">${coins(gold)}</span>`);
    b.title = ok ? t(kind === 'buy' ? 'trade.buyFor' : 'trade.sellFor', { n, price: gold }) : why;
    setDisabled(b, !ok);
  }
  const row = el('div', 'hb-trades');
  row.append(buy, sell);
  return row;
}

/** "Order here: 7 grain for 165 gold. You need 7 more." with Deliver, when it is for this good. */
function orderLine(world: World, good: GoodId, deliver: () => void): HTMLElement | null {
  const order = liveOrder(world);
  if (!order || order.good !== good) return null;
  const missing = order.qty - world.trade.captain.cargo[order.good];
  const box = el('div', 'hb-order');
  const words = t('harbour.orderLine', {
    qty: order.qty,
    good: goodName(order.good).toLowerCase(),
    reward: order.reward,
  });
  box.append(
    el('p', '', missing > 0 ? `${words} ${t('harbour.orderNeed', { n: missing })}` : words),
  );
  if (order.help) box.prepend(el('p', 'hb-order-help', t('trade.help')));
  const b = button({
    label:
      missing > 0
        ? t('trade.needMore', { n: missing })
        : t('trade.deliverFor', { reward: order.reward }),
    disabled: missing > 0,
    onPress: deliver,
  });
  b.id = 'tp-deliver';
  box.append(b);
  return box;
}
