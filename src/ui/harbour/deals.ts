import { formatNumber, goodName, t } from '../../i18n';
import { deliverContract } from '../../sim/contracts';
import { leavesShort, takeCredit } from '../../sim/credit';
import { GOODS, type GoodId } from '../../sim/goods';
import { hullCondition, repairHull, repairPrice } from '../../sim/hazards';
import { quoteSell, trades } from '../../sim/market';
import { SHIP_CLASSES } from '../../sim/ship';
import {
  type TradeResult,
  buy,
  buyShip,
  buyUpgrade,
  findPort,
  sell,
  sellAll,
  shipCost,
  switchShip,
  upgradeCost,
} from '../../sim/trade';
import { type UpgradeTrack, upgradePrice } from '../../sim/upgrades';
import type { World } from '../../sim/world';
import { button } from '../components/button';
import { askConfirm } from '../confirmDialog';
import { COIN } from '../icons';

/** What the harbour screen hears after a deal. */
export interface DealHooks {
  /** Anything changed the voyage (save, quests). */
  onAction(): void;
  /** Gold changed hands at the market: the trade ticks roll (decision 0274). */
  onTrade(kind: 'buy' | 'sell', good: GoodId | null): void;
  /** Draw the screen again. */
  render(): void;
  isOpen(): boolean;
}

/**
 * Everything the captain does in the harbour (decisions 0028, 0032, 0049, 0200): buy and sell,
 * deliver, the load on credit, repairs, upgrades and ships. Each deal sets the status line and
 * redraws; spending that would leave her stranded asks first.
 */
export class HarbourDeals {
  /** The status line: what the last deal did, or why it did not. */
  message = '';
  /** "Not now" on the load on credit: hidden until she docks again. */
  creditLater = false;

  constructor(
    private readonly world: World,
    private readonly hooks: DealHooks,
  ) {}

  /** A new docking: a clean status line, the credit offer back. */
  docked() {
    this.message = '';
    this.creditLater = false;
  }

  private finish(result: TradeResult, deal?: { kind: 'buy' | 'sell'; good: GoodId | null }) {
    this.message = result.ok ? t('trade.done') : t(`trade.err.${result.error}`);
    if (result.ok) {
      this.hooks.onAction();
      if (deal && result.gold > 0) this.hooks.onTrade(deal.kind, deal.good);
    }
    this.hooks.render();
  }

  trade(kind: 'buy' | 'sell', good: GoodId, qty: number) {
    if (kind === 'buy') return this.finish(buy(this.world.trade, good, qty), { kind, good });
    this.paidBack(() => sell(this.world.trade, good, qty, this.world.map), { kind, good });
  }

  /** What all the cargo this port trades fetches here. */
  sellAllValue(): number {
    const { trade } = this.world;
    const market = trade.markets[trade.dockedAt!]!;
    let total = 0;
    for (const g of GOODS) {
      const n = trade.captain.cargo[g];
      if (n > 0 && trades(market, g)) total += quoteSell(market, g, n);
    }
    return total;
  }

  sellEverything() {
    this.paidBack(() => sellAll(this.world.trade, this.world.map), { kind: 'sell', good: null });
  }

  /** A sale, with "paid the harbour office back" added when it cleared her loan (decision 0200). */
  private paidBack(deal: () => TradeResult, what: { kind: 'sell'; good: GoodId | null }) {
    const before = this.loan();
    const res = deal();
    this.finish(res, what);
    const repaid = res.ok ? this.repaid(before, res.gold) : '';
    if (!repaid) return;
    this.message += repaid;
    this.hooks.render();
  }

  private loan() {
    const { captain } = this.world.trade;
    return { gold: captain.gold, owed: !!captain.loan };
  }

  /** " Paid the harbour office back 120 gold." when the deal just cleared her loan, else "". */
  private repaid(before: { gold: number; owed: boolean }, earned: number): string {
    if (!before.owed || this.world.trade.captain.loan) return '';
    const paid = before.gold + earned - this.world.trade.captain.gold;
    return paid > 0 ? ` ${t('trade.creditRepaid', { gold: paid })}` : '';
  }

  deliver() {
    const before = this.loan();
    const res = deliverContract(this.world.trade, this.world.map);
    if (res.ok) {
      this.message = t('trade.delivered', { gold: res.gold }) + this.repaid(before, res.gold);
      this.hooks.onAction();
    } else this.message = t('trade.needFullOrder');
    this.hooks.render();
  }

  credit(take: boolean) {
    if (!take) this.creditLater = true;
    else {
      const offer = takeCredit(this.world.map, this.world.trade);
      if (offer) {
        this.message = t('trade.creditTaken', {
          goods: t('trade.contractGoods', {
            qty: offer.qty,
            good: goodName(offer.good).toLowerCase(),
          }),
          port: findPort(this.world.map, offer.port)?.name ?? offer.port,
        });
        this.hooks.onAction();
      }
    }
    this.hooks.render();
  }

  /**
   * Spend `gold` here, asking first if it would leave her with an empty hold and less than the
   * cheapest load (decision 0200).
   */
  private async spend(gold: number, act: () => void) {
    const trade = this.world.trade;
    if (leavesShort(trade, gold)) {
      const yes = await askConfirm({
        title: t('trade.shortTitle'),
        text: t('trade.shortText', { gold: formatNumber(Math.max(0, trade.captain.gold - gold)) }),
        ok: t('trade.shortOk'),
      });
      if (!yes || !this.hooks.isOpen()) return;
    }
    act();
  }

  upgrade(track: UpgradeTrack) {
    const { trade, map } = this.world;
    const ship = SHIP_CLASSES[trade.captain.activeShip]!;
    const listed = upgradePrice(ship, trade.captain.ships[ship.id]!, track);
    const cost = listed === null ? 0 : upgradeCost(trade, listed, track);
    void this.spend(cost <= trade.captain.gold ? cost : 0, () =>
      this.finish(buyUpgrade(trade, map, track)),
    );
  }

  ship(kind: 'buy' | 'switch', id: string) {
    const { trade, map } = this.world;
    if (kind === 'switch') return this.finish(switchShip(trade, map, id));
    const cost = shipCost(trade, SHIP_CLASSES[id]!);
    void this.spend(cost <= trade.captain.gold ? cost : 0, () =>
      this.finish(buyShip(trade, map, id)),
    );
  }

  /** Hull repair after reef strikes (decision 0032): a button only while the hull is damaged. */
  repairButton(): HTMLElement | null {
    const { trade } = this.world;
    const pct = Math.round(hullCondition(trade) * 100);
    const price = repairPrice(trade);
    if (pct >= 100 && price === 0) return null;
    const { gold } = trade.captain;
    const label =
      gold >= price
        ? t('trade.repair', { pct, price })
        : gold >= 2
          ? t('trade.repairSome', { pct })
          : t('trade.needGold');
    const b = button({ label, icon: 'hull', disabled: gold < 2, onPress: () => this.repair() });
    b.id = 'tp-repair';
    b.title = `${t('trade.hull')} ${t('unit.percent', { n: pct })}${t('trade.leaking')}`;
    if (gold >= price) b.insertAdjacentHTML('beforeend', COIN);
    return b;
  }

  /** Repairs take what she can pay for (decision 0032). */
  private repair() {
    const trade = this.world.trade;
    void this.spend(Math.min(repairPrice(trade), trade.captain.gold), () => {
      const res = repairHull(trade);
      if (res.ok) {
        this.message = t('trade.repaired', { gold: res.gold });
        this.hooks.onAction();
      } else this.message = res.error === 'not-enough-gold' ? t('trade.err.not-enough-gold') : '';
      this.hooks.render();
    });
  }
}
