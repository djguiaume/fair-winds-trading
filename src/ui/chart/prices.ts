import { goodName, t } from '../../i18n';
import { GOODS, type GoodId, isFar, isMadeGood } from '../../sim/goods';
import { type PortQuote, quoteAcross } from '../../sim/market';
import { madeGoods } from '../../sim/settlement';
import { discoveredPorts, farGoodsOnChart } from '../../sim/shipyards';
import type { World } from '../../sim/world';
import { el } from '../components/dom';
import { listRow } from '../components/listRow';
import { COIN } from '../icons';

/** One good's prices at every charted port (decisions 0036, 0048), and which are best. */
export interface Market {
  good: GoodId;
  quotes: PortQuote[];
  cheapest: number | null;
  dearest: number;
}

/**
 * The good whose prices the chart shows (decision 0196): on the Prices page always one, on the
 * map under the port names or none. Until she picks one, it follows what she carries most of.
 */
export class PriceKey {
  /** The good priced on the map; null: names only. */
  good: GoodId | null = null;
  private picked = false;

  constructor(private readonly world: World) {}

  /** On opening the chart: the cargo's good, unless she chose one. */
  open() {
    if (this.picked) return;
    const { cargo } = this.world.trade.captain;
    const most = GOODS.reduce((best, g) => (cargo[g] > cargo[best] ? g : best), GOODS[0]);
    this.good = cargo[most] > 0 ? most : null;
  }

  pick(good: GoodId | null) {
    this.good = good;
    this.picked = true;
  }

  /** A controller's X on the map: the next good's prices, then names only. */
  next() {
    const order: (GoodId | null)[] = [...this.inPlay(), null];
    this.pick(order[(order.indexOf(this.good) + 1) % order.length]!);
  }

  /** Goods on show: the staples, and made goods once a town makes them or one is aboard. */
  inPlay(): GoodId[] {
    const { map, trade } = this.world;
    // Specialized goods join once a town makes them, or while one is in the hold (decision 0063);
    // far goods once a port on the chart sells or makes them (decision 0198).
    const made = madeGoods(map, trade);
    const far = farGoodsOnChart(map, trade);
    return GOODS.filter(
      (g) => trade.captain.cargo[g] > 0 || (isFar(g) ? far.has(g) : !isMadeGood(g) || made.has(g)),
    );
  }

  market(): Market {
    const good = this.good ?? GOODS[0];
    const { map, trade } = this.world;
    const ports = discoveredPorts(map, trade).map((p) => p.id);
    const quotes = quoteAcross(trade.markets, good, ports);
    const stocked = quotes.filter((q) => q.available > 0).map((q) => q.buy);
    return {
      good,
      quotes,
      cheapest: stocked.length ? Math.min(...stocked) : null,
      dearest: Math.max(...quotes.map((q) => q.sell)),
    };
  }
}

/** The price under a port's name: buy where it is cheapest and stocked, else sell. */
export function priceLine(q: PortQuote | undefined, market: Market) {
  if (!q) return { text: '', best: false };
  if (q.available > 0 && q.buy === market.cheapest)
    return { text: t('chart.cardBuy', { price: q.buy }), best: true };
  return { text: t('chart.cardSell', { price: q.sell }), best: q.sell === market.dearest };
}

/**
 * The Prices page (issue #444): the goods down the left as list rows, the picked good's buy and
 * sell at every charted port on the right; a port's row sets a course there.
 */
export function drawPrices(
  page: { goods: HTMLElement; title: HTMLElement; table: HTMLElement },
  world: World,
  key: PriceKey,
  hooks: { pick: (good: GoodId) => void; selectPort: (port: string) => void },
) {
  const market = key.market();
  page.goods.replaceChildren(
    ...key.inPlay().map((g) => {
      const row = listRow({
        label: goodName(g),
        icon: g,
        selected: g === market.good,
        onPress: () => hooks.pick(g),
      });
      row.dataset.good = g;
      return row;
    }),
  );
  page.title.textContent = t('chart.pricesFor', { good: goodName(market.good) });
  const head = el('div', 'chart-price-head');
  for (const label of [t('chart.colPort'), t('chart.colBuy'), t('chart.colSell')])
    head.append(el('span', '', label));
  page.table.replaceChildren(head, ...market.quotes.map((q) => portRow(q, market, world, hooks)));
}

function portRow(
  q: PortQuote,
  market: Market,
  world: World,
  hooks: { selectPort: (port: string) => void },
) {
  const { map, trade } = world;
  const port = map.ports.find((p) => p.id === q.portId)!;
  const notes: string[] = [];
  const cheapest = q.available > 0 && q.buy === market.cheapest;
  const dearest = q.sell === market.dearest;
  if (cheapest) notes.push(t('chart.cheapest'));
  if (dearest) notes.push(t('chart.paysMost'));
  const order = trade.contracts.byPort[port.id];
  if (order && order.readyIn <= 0 && order.good === market.good)
    notes.push(
      t(order.help ? 'chart.help' : 'chart.order', { qty: order.qty, reward: order.reward }),
    );
  if (trade.dockedAt === port.id) notes.push(t('chart.youAreHere'));
  const row = listRow({
    label: port.name,
    detail: notes.join(' · ') || undefined,
    onPress: () => hooks.selectPort(port.id),
  });
  row.dataset.compare = port.id;
  const cell = (text: string, best: boolean, coin: boolean) => {
    const c = el('span', `chart-price${best ? ' best' : ''}`, text);
    if (coin) c.insertAdjacentHTML('beforeend', COIN);
    return c;
  };
  row.append(
    cell(q.available > 0 ? `${q.buy} ` : t('chart.none'), cheapest, q.available > 0),
    cell(`${q.sell} `, dearest, true),
  );
  return row;
}
