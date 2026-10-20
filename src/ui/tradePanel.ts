import { type Contract, deliverContract, openContracts } from '../sim/contracts';
import { GOODS, GOOD_DEFS, type GoodId } from '../sim/goods';
import { hullCondition, repairHull, repairPrice } from '../sim/hazards';
import { goodRole, quoteAcross, quoteBuy, quoteSell, type Market } from '../sim/market';
import { CUTTER, SHIP_CLASSES, SLOOP } from '../sim/ship';
import {
  buy,
  buyShip,
  buyUpgrade,
  capacity,
  cargoUsed,
  findPort,
  freeSpace,
  maxBuy,
  sell,
  sellAll,
  switchShip,
  type TradeResult,
} from '../sim/trade';
import {
  MAX_UPGRADE_LEVEL,
  UPGRADE_TRACKS,
  holdCapacity,
  hullDurability,
  upgradePrice,
  type UpgradeTrack,
} from '../sim/upgrades';
import type { World } from '../sim/world';
import { KIDS_MODE_AVAILABLE, type UiMode } from './settings';
import { formatNumber, goodName, shipName, t } from '../i18n';
import { COIN, crateIcon, icon } from './icons';

export type TradePanelTab = 'market' | 'orders' | 'shipyard';

/** Lot sizes for one tap on Buy or Sell (decision 0049); clamped to what the hold, stock and gold allow. */
const LOTS = [1, 5, 10] as const;
type Lot = (typeof LOTS)[number];

const GOOD_ICONS: Record<GoodId, string> = {
  fish: '🐟',
  grain: '🌾',
  timber: '🪵',
  stone: '🪨',
};

export class TradePanel {
  private tab: TradePanelTab = 'market';
  private returnFocus: HTMLElement | null = null;
  private message = '';

  private finish(result: TradeResult, transaction?: { kind: 'buy' | 'sell'; good: GoodId | null }) {
    this.message = result.ok ? t('trade.done') : t(`trade.err.${result.error}`);
    if (result.ok) {
      this.onAction();
      if (transaction && result.gold > 0) this.onTrade(transaction.kind, transaction.good);
    }
    this.render();
  }
  uiMode: UiMode = 'adult';
  private lot: Lot = 1;

  onAction: () => void = () => {};
  onTrade: (kind: 'buy' | 'sell', good: GoodId | null) => void = () => {};
  onRender: () => void = () => {};
  onClose: () => void = () => {};
  onUiModeChange: (mode: UiMode) => void = () => {};

  constructor(
    private readonly container: HTMLElement,
    private readonly world: World,
  ) {
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-label', t('trade.dialogLabel'));
    this.container.tabIndex = -1;
    this.container.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
      if (e.key !== 'Tab') return;
      const buttons = [
        ...this.container.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
      ].filter((button) => !button.closest('[hidden]'));
      const first = buttons[0],
        last = buttons.at(-1);
      if (!first) {
        e.preventDefault();
        this.container.focus();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === this.container)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
    this.container.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.container.addEventListener('pointermove', (e) => e.stopPropagation());
    this.container.addEventListener('pointerup', (e) => e.stopPropagation());
    this.container.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    this.container.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    this.container.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
  }

  get isOpen(): boolean {
    return !this.container.hidden;
  }

  open(tab: TradePanelTab = 'market') {
    if (!this.isOpen) this.returnFocus = document.activeElement as HTMLElement | null;
    this.message = '';
    this.tab = tab;
    this.container.hidden = false;
    this.render();
    this.container.querySelector<HTMLButtonElement>('#tp-close')?.focus();
  }

  close() {
    this.container.hidden = true;
    this.onClose();
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
  }

  render() {
    if (this.container.hidden) return;

    const previous = document.activeElement as HTMLElement | null;
    const focusKey =
      previous && this.container.contains(previous)
        ? previous.id
          ? `#${previous.id}`
          : [...previous.attributes]
              .filter((a) => a.name.startsWith('data-') && a.name !== 'data-qty')
              .map((a) => `[${a.name}="${a.value}"]`)
              .join('')
        : '';
    const scrollTop = this.container.querySelector('.trade-modal')?.scrollTop ?? 0;
    const { trade, map } = this.world;
    const portId = trade.dockedAt;
    const port = portId ? findPort(map, portId) : null;
    const market = portId ? trade.markets[portId] : null;

    if (!port || !market) {
      this.container.innerHTML = `
        <div class="trade-modal panel card">
          <div class="trade-header">
            <h2>${t('trade.harbour')}</h2>
            <button class="close-btn" id="tp-close" aria-label="${t('trade.close')}">✕</button>
          </div>
          <p class="muted">${t('trade.noMarket')}</p>
        </div>
      `;
      this.attachListeners();
      return;
    }

    const { captain } = trade;
    const holdCap = capacity(trade);
    const holdUsed = cargoUsed(trade);

    let totalSellableValue = 0;
    for (const g of GOODS) {
      const q = captain.cargo[g];
      if (q > 0) totalSellableValue += quoteSell(market, g, q);
    }

    const isKid = this.uiMode === 'kids';
    if (isKid && this.tab === 'orders') this.tab = 'market';
    const goodIcons = (goods: readonly string[]) =>
      goods.map((g) => `<span title="${goodName(g)}">${icon(g)}</span>`).join('');
    const orders = this.openOrderCount();
    const tabBtn = (tab: TradePanelTab, label: string, extra = '') =>
      `<button id="tp-tab-${tab}" class="tab-btn ${this.tab === tab ? 'active' : ''}" aria-pressed="${this.tab === tab}">${label}${extra}</button>`;

    // Full-screen port (decision 0049): header, tabs, one screen of content, actions along the bottom.
    const html = `
      <div class="trade-modal port-screen ${isKid ? 'kids-view' : 'captain-view'}">
        <header class="trade-header">
          <div class="port-title-area">
            <h2 class="port-name">${port.name}</h2>
            <div class="port-roles-summary">
              <span class="role-tag produces"><small>${isKid ? t('kids.produces') : t('trade.makes')}</small>${goodIcons(port.produces)}</span>
              <span class="role-tag wants"><small>${isKid ? t('kids.wants') : t('trade.wants')}</small>${goodIcons(port.wants)}</span>
            </div>
          </div>
          <div class="header-controls">
            <span class="port-chip" title="${t('hud.gold')}">${COIN}<b>${formatNumber(captain.gold)}</b></span>
            <span class="port-chip" title="${t('hud.cargo')}">${crateIcon(holdCap > 0 ? holdUsed / holdCap : 0)}<b>${holdUsed}/${holdCap}</b></span>
            ${
              KIDS_MODE_AVAILABLE
                ? `<button id="tp-toggle-mode" class="mode-toggle-btn" title="${t('trade.switchMode')}">
              ${isKid ? t('kids.toCaptain') : t('trade.toKids')}
            </button>`
                : ''
            }
            <button class="close-btn" id="tp-close" aria-label="${t('trade.close')}">✕</button>
          </div>
        </header>

        <nav class="trade-tabs">
          ${tabBtn('market', isKid ? t('kids.tabMarket') : t('trade.tabMarket'))}
          ${isKid ? '' : tabBtn('orders', t('trade.tabOrders'), orders ? ` <span class="tab-badge">${orders}</span>` : '')}
          ${tabBtn('shipyard', isKid ? t('kids.tabShipyard') : t('trade.tabShipyard'))}
          ${
            this.tab === 'market' && !isKid
              ? `<span class="lot-picker" role="group" aria-label="${t('trade.lot')}"><small>${t('trade.lot')}</small>${LOTS.map(
                  (n) =>
                    `<button class="lot-btn" data-lot="${n}" aria-pressed="${this.lot === n}">×${n}</button>`,
                ).join('')}</span>`
              : ''
          }
        </nav>

        <div id="tutorial-market"></div>
        <main class="trade-content tab-${this.tab}">
          ${
            this.tab === 'market'
              ? isKid
                ? this.renderContracts(isKid) + this.renderKidsMarket(market, totalSellableValue)
                : this.renderAdultMarket(market)
              : this.tab === 'orders'
                ? this.renderContracts(isKid)
                : isKid
                  ? this.renderKidsShipyard()
                  : this.renderAdultShipyard()
          }
        </main>

        <p class="trade-status" role="status">${this.message}</p>
        <footer class="trade-footer">
          ${this.renderRepair(isKid)}
          <span class="footer-gap"></span>
          ${
            totalSellableValue > 0 && !isKid
              ? `<button id="tp-sell-all" class="port-btn green">${t('trade.sellAll', { price: totalSellableValue })}${COIN}</button>`
              : ''
          }
          <button id="tp-undock" class="port-btn brass undock-btn">${icon('anchor')}${isKid ? t('kids.undock') : t('trade.undock')}</button>
        </footer>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachListeners();
    this.onRender();
    const modal = this.container.querySelector('.trade-modal');
    if (modal) modal.scrollTop = scrollTop;
    if (focusKey) {
      const next = this.container.querySelector<HTMLButtonElement>(focusKey);
      (next && !next.disabled
        ? next
        : this.container.querySelector<HTMLButtonElement>('#tp-close')
      )?.focus({ preventScroll: true });
    }
  }

  /** Hull repair after reef strikes (decision 0032); shown only when the hull is damaged. */
  private renderRepair(isKid: boolean): string {
    const { trade } = this.world;
    const pct = Math.round(hullCondition(trade) * 100);
    if (pct >= 100 && repairPrice(trade) === 0) return '';
    const price = repairPrice(trade);
    const canPay = trade.captain.gold >= 2;
    const label =
      trade.captain.gold >= price
        ? t(isKid ? 'kids.fix' : 'trade.repair', { pct, price })
        : canPay
          ? t(isKid ? 'kids.fixSome' : 'trade.repairSome', { pct })
          : t('trade.needGold');
    return `<button id="tp-repair" class="port-btn red" title="${t('trade.hull')} ${t('unit.percent', { n: pct })}${t('trade.leaking')}" ${canPay ? '' : 'disabled'}>${icon('hull')}${label}${trade.captain.gold >= price ? COIN : ''}</button>`;
  }

  /** Open delivery orders across the map, counted on the Orders tab. */
  private openOrderCount(): number {
    const { trade } = this.world;
    const here = trade.contracts.byPort[trade.dockedAt!];
    const others = openContracts(trade.contracts).filter((c) => c.portId !== trade.dockedAt);
    return others.length + (here && here.readyIn <= 0 ? 1 : 0);
  }

  /** Delivery orders (decision 0028): this port's, with a Deliver button, then the others'. */
  private renderContracts(isKid: boolean): string {
    const { trade, map } = this.world;
    const here = trade.contracts.byPort[trade.dockedAt!];
    const portName = (id: string) => findPort(map, id)?.name ?? id;
    const goods = (c: Contract) =>
      isKid
        ? `${GOOD_ICONS[c.good]} ×${c.qty}`
        : t('trade.contractGoods', { qty: c.qty, good: goodName(c.good).toLowerCase() });

    let hereHtml: string;
    if (!here || here.readyIn > 0) {
      hereHtml = `<p class="contract-line muted">${isKid ? t('kids.noJob') : t('trade.noOrder')}</p>`;
    } else {
      const missing = here.qty - trade.captain.cargo[here.good];
      hereHtml = `
        <div class="contract-line contract-here">
          <span>${isKid ? t('kids.townNeeds') : t('trade.portOrders')} <b>${goods(here)}</b> · ${isKid ? t('kids.pays') : t('trade.reward')} <b>${here.reward}${COIN}</b></span>
          <button id="tp-deliver" class="sell-all-btn deliver-btn" ${missing > 0 ? 'disabled' : ''}>
            ${missing > 0 ? t('trade.needMore', { n: missing }) : isKid ? t('kids.deliver') : t('trade.deliverFor', { reward: here.reward })}
          </button>
        </div>`;
    }
    const others = openContracts(trade.contracts).filter((c) => c.portId !== trade.dockedAt);
    const othersHtml = others
      .map(
        (c) =>
          `<li><b>${portName(c.portId)}</b>: ${goods(c)} · ${c.reward}${COIN}${
            trade.captain.cargo[c.good] >= c.qty
              ? ` <span class="role-badge produces">${t('trade.inHoldBadge')}</span>`
              : ''
          }</li>`,
      )
      .join('');
    return `
      <section class="contracts" aria-label="${isKid ? t('kids.jobs') : t('trade.orders')}">
        <h3 class="contracts-title">${isKid ? t('kids.jobs') : t('trade.orders')}</h3>
        ${hereHtml}
        ${others.length ? `<ul class="contract-list">${othersHtml}</ul>` : ''}
      </section>`;
  }

  /** Where this good sells best among the other ports today (decision 0036). */
  private bestSaleElsewhere(good: GoodId): { name: string; sell: number } | null {
    const { trade, map } = this.world;
    const others = map.ports.filter((p) => p.id !== trade.dockedAt);
    const best = quoteAcross(
      trade.markets,
      good,
      others.map((p) => p.id),
    ).reduce<{ portId: string; sell: number } | null>(
      (top, q) => (!top || q.sell > top.sell ? q : top),
      null,
    );
    return best ? { name: findPort(map, best.portId)?.name ?? best.portId, sell: best.sell } : null;
  }

  // --- KIDS MARKET RENDERER ---
  private renderKidsMarket(market: Market, sellAllGold: number): string {
    const { trade, map } = this.world;
    const port = findPort(map, trade.dockedAt!)!;
    const { captain } = trade;

    const cardsHtml = GOODS.map((good) => {
      const def = GOOD_DEFS[good];
      const role = goodRole(port, good);
      const inHold = captain.cargo[good];
      const maxCanBuy = maxBuy(trade, good);

      const buyPrice = quoteBuy(market, good, 1);
      const sellPrice = quoteSell(market, good, 1);

      const fillHoldCost = maxCanBuy > 0 ? quoteBuy(market, good, maxCanBuy) : 0;
      const bestElsewhere = this.bestSaleElsewhere(good);
      const sellAllIncome = inHold > 0 ? quoteSell(market, good, inHold) : 0;

      let badgeText = t('kids.regular');
      let badgeClass = 'neutral';
      if (role === 'produces') {
        badgeText = t('kids.cheap');
        badgeClass = 'produces';
      } else if (role === 'wants') {
        badgeText = t('kids.highReward');
        badgeClass = 'wants';
      }

      return `
        <article class="good-card kid-card ${role}">
          <div class="kid-good-head">
            <span class="kid-icon">${GOOD_ICONS[good]}</span>
            <div class="kid-title-block">
              <h4 class="kid-good-name">${goodName(def.id)}</h4>
              <span class="role-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="kid-hold-count">
              <span class="count-label">${t('kids.inYourHold')}</span>
              <b class="count-val">${inHold}</b>
            </div>
          </div>

          <div class="kid-price-summary">
            <span>${t('kids.buy')} <b>${buyPrice} 🪙</b></span>
            <span>·</span>
            <span>${t('kids.sell')} <b>${sellPrice} 🪙</b></span>
          </div>
          ${bestElsewhere ? `<p class="best-elsewhere">${t('kids.sellsBestAt', { name: bestElsewhere.name, price: bestElsewhere.sell })}</p>` : ''}

          <div class="kid-button-row">
            <button
              class="kid-act-btn buy-one"
              data-action="buy"
              data-good="${good}"
              data-qty="1"
              ${maxCanBuy < 1 ? 'disabled' : ''}
            >
              ${t('kids.buyOne', { price: buyPrice })}
            </button>

            ${
              maxCanBuy > 1
                ? `
              <button
                class="kid-act-btn buy-max"
                data-action="buy"
                data-good="${good}"
                data-qty="${maxCanBuy}"
              >
                ${t('kids.fillHold', { n: maxCanBuy, price: fillHoldCost })}
              </button>
            `
                : ''
            }

            <button
              class="kid-act-btn sell-one"
              data-action="sell"
              data-good="${good}"
              data-qty="1"
              ${inHold < 1 ? 'disabled' : ''}
            >
              ${t('kids.sellOne', { price: sellPrice })}
            </button>

            ${
              inHold > 1
                ? `
              <button
                class="kid-act-btn sell-all-one"
                data-action="sell"
                data-good="${good}"
                data-qty="${inHold}"
              >
                ${t('kids.sellAllOf', { n: inHold, price: sellAllIncome })}
              </button>
            `
                : ''
            }
          </div>
        </article>
      `;
    }).join('');

    return `
      <div class="market-section kids-layout">
        ${
          sellAllGold > 0
            ? `
          <div class="sell-all-bar kid-banner">
            <span>${t('kids.cargoReady')}</span>
            <button id="tp-sell-all" class="sell-all-btn">
              ${t('kids.sellAll', { price: sellAllGold })}
            </button>
          </div>
        `
            : ''
        }
        <div class="goods-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  // --- ADULT / CAPTAIN MARKET RENDERER ---
  /** One row per good: price on the button, one tap per lot (decision 0049). */
  private renderAdultMarket(market: Market): string {
    const { trade, map } = this.world;
    const port = findPort(map, trade.dockedAt!)!;
    const { captain } = trade;
    const order = trade.contracts.byPort[trade.dockedAt!];
    const liveOrder = order && order.readyIn <= 0 ? order : null;

    const rowsHtml = GOODS.map((good) => {
      const def = GOOD_DEFS[good];
      const role = goodRole(port, good);
      const stock = Math.max(0, Math.floor(market.stock[good]));
      const inHold = captain.cargo[good];
      const free = freeSpace(trade);
      const buyQty = Math.max(1, Math.min(this.lot, maxBuy(trade, good)));
      const sellQty = Math.max(1, Math.min(this.lot, inHold));
      const costQuote = quoteBuy(market, good, buyQty);
      const sellQuote = quoteSell(market, good, sellQty);
      const nextBuy = quoteBuy(market, good, 1);

      const canBuy = maxBuy(trade, good) >= buyQty;
      let buyDisabledReason = '';
      if (!canBuy) {
        if (stock === 0) buyDisabledReason = t('trade.outOfStock');
        else if (free === 0) buyDisabledReason = t('trade.holdFull');
        else if (captain.gold < nextBuy) buyDisabledReason = t('trade.needGold');
        else buyDisabledReason = t('trade.cannotAfford');
      }
      const canSell = inHold >= sellQty;
      const sellDisabledReason = canSell ? '' : t('trade.noneInHold');

      const note =
        role === 'produces'
          ? t('trade.madeHere')
          : role === 'wants'
            ? liveOrder?.good === good
              ? t('trade.wantedOrder', { n: liveOrder.qty })
              : t('trade.wanted')
            : '';
      const best = this.bestSaleElsewhere(good);
      const qtyLabel = (n: number) => (n > 1 ? ` ${n}` : '');

      return `
        <article class="good-row ${role}">
          <span class="good-icon">${icon(good)}</span>
          <span class="good-text">
            <b class="good-name">${goodName(def.id)}</b>
            ${note ? `<small class="good-note">${note}</small>` : ''}
          </span>
          <span class="good-best">${best ? `<small>${t('trade.bestElsewhereTitle')}</small>${t('trade.paysAt', { name: best.name, price: best.sell })}` : ''}</span>
          <span class="good-hold"><b>${inHold}</b><small>${t('trade.hold')}</small></span>
          <button
            class="trade-act-btn buy-btn port-btn brass"
            data-action="buy"
            data-good="${good}"
            data-qty="${buyQty}"
            ${!canBuy ? 'disabled' : ''}
            title="${canBuy ? t('trade.buyFor', { n: buyQty, price: costQuote }) : buyDisabledReason}"
          ><small>${t('trade.buy')}${qtyLabel(buyQty)}</small><b>${costQuote}</b></button>
          <button
            class="trade-act-btn sell-btn port-btn green ${role === 'wants' ? 'pays-well' : ''}"
            data-action="sell"
            data-good="${good}"
            data-qty="${sellQty}"
            ${!canSell ? 'disabled' : ''}
            title="${canSell ? t('trade.sellFor', { n: sellQty, price: sellQuote }) : sellDisabledReason}"
          ><small>${t('trade.sell')}${qtyLabel(sellQty)}</small><b>${sellQuote}</b></button>
        </article>
      `;
    }).join('');

    // Side panel: this port's order, then where the cargo (or what this port makes) sells best.
    const hereGoods = GOODS.filter((g) => captain.cargo[g] > 0);
    const tips = (hereGoods.length ? hereGoods : port.produces)
      .map((g) => {
        const best = this.bestSaleElsewhere(g as GoodId);
        return best
          ? `<li>${icon(g)} ${t('trade.paysAt', { name: best.name, price: best.sell })}</li>`
          : '';
      })
      .join('');
    const missing = liveOrder ? liveOrder.qty - captain.cargo[liveOrder.good] : 0;
    const orderHtml = liveOrder
      ? `<p class="order-line">${icon(liveOrder.good)} <b>${t('trade.contractGoods', { qty: liveOrder.qty, good: goodName(liveOrder.good).toLowerCase() })}</b> → <b>${liveOrder.reward}</b>${COIN}</p>
         <button id="tp-deliver" class="port-btn green deliver-btn" ${missing > 0 ? 'disabled' : ''}>
           ${missing > 0 ? t('trade.needMore', { n: missing }) : t('trade.deliverFor', { reward: liveOrder.reward })}
         </button>`
      : `<p class="muted">${t('trade.noOrder')}</p>`;

    return `
      <div class="market-section adult-layout">
        <div class="goods-list">${rowsHtml}</div>
        <aside class="port-side">
          <section class="side-card">
            <h3>${t('trade.orderHere')}</h3>
            ${orderHtml}
          </section>
          ${tips ? `<section class="side-card"><h3>${t('trade.bestElsewhereTitle')}</h3><ul>${tips}</ul></section>` : ''}
        </aside>
      </div>
    `;
  }

  // --- KIDS SHIPYARD RENDERER ---
  private renderKidsShipyard(): string {
    const { trade } = this.world;
    const { captain } = trade;
    const activeShipId = captain.activeShip;
    const activeShipBase = SHIP_CLASSES[activeShipId]!;
    const levels = captain.ships[activeShipId] ?? { sails: 1, hold: 1, hull: 1 };

    const tracks = [
      {
        track: 'sails' as UpgradeTrack,
        title: t('kids.upg.sails'),
        desc: t('kids.upg.sailsDesc'),
        current: t('kids.upg.sailsLevel', { level: levels.sails }),
      },
      {
        track: 'hold' as UpgradeTrack,
        title: t('kids.upg.hold'),
        desc: t('kids.upg.holdDesc'),
        current: t('kids.upg.holdLevel', { level: levels.hold }),
      },
      {
        track: 'hull' as UpgradeTrack,
        title: t('kids.upg.hull'),
        desc: t('kids.upg.hullDesc'),
        current: t('kids.upg.hullLevel', { level: levels.hull }),
      },
    ];

    const upgradeCardsHtml = tracks
      .map(({ track, title, desc, current }) => {
        const cur = levels[track];
        const isMax = cur >= MAX_UPGRADE_LEVEL;
        const nextPrice = upgradePrice(activeShipBase, levels, track);
        const canAfford = nextPrice !== null && captain.gold >= nextPrice;

        return `
        <article class="upgrade-card kid-card">
          <div class="kid-upg-header">
            <h4>${title}</h4>
            <span class="kid-level-badge">${current}</span>
          </div>
          <p class="kid-upg-desc">${desc}</p>
          <div class="upgrade-action">
            ${
              isMax
                ? `<button class="upgrade-btn maxed" disabled>${t('kids.maxLevel')}</button>`
                : canAfford
                  ? `<button class="upgrade-btn primary kid-btn" data-track="${track}">${t('kids.upgrade', { price: nextPrice! })}</button>`
                  : `<button class="upgrade-btn" disabled>${t('kids.needCoins', { n: nextPrice! - captain.gold })}</button>`
            }
          </div>
        </article>
      `;
      })
      .join('');

    return `
      <div class="shipyard-section kids-layout">
        <div class="section-title">
          <h3>${t('kids.upgradeTitle')}</h3>
        </div>
        <div class="upgrades-grid">
          ${upgradeCardsHtml}
        </div>

        <div class="section-title ships-title">
          <h3>${t('kids.fleet')}</h3>
        </div>
        ${this.renderFleet()}
      </div>
    `;
  }

  // --- ADULT / CAPTAIN SHIPYARD RENDERER ---
  private renderAdultShipyard(): string {
    const { trade } = this.world;
    const { captain } = trade;
    const activeShipId = captain.activeShip;
    const activeShipBase = SHIP_CLASSES[activeShipId]!;
    const levels = captain.ships[activeShipId] ?? { sails: 1, hold: 1, hull: 1 };

    const tracksHtml = UPGRADE_TRACKS.map((track) => {
      const currentLevel = levels[track];
      const isMax = currentLevel >= MAX_UPGRADE_LEVEL;
      const nextPrice = upgradePrice(activeShipBase, levels, track);
      const canAfford = nextPrice !== null && captain.gold >= nextPrice;

      const icon = { sails: '💨', hold: '📦', hull: '🛡' }[track];
      const name = t(`upg.${track}`);
      // Each level's number: hold capacity for the hold, durability for the hull (decision 0011).
      const amount = (level: 1 | 2 | 3) => {
        const levels = { sails: 1, hold: 1, hull: 1, [track]: level };
        return track === 'hold'
          ? holdCapacity(activeShipBase, levels)
          : track === 'hull'
            ? hullDurability(levels)
            : 0;
      };
      const level = Math.min(Math.max(currentLevel, 1), 3) as 1 | 2 | 3;
      const currentDesc = t(`upg.${track}.${level}`, { n: amount(level) });
      const nextDesc =
        level === 1
          ? t(`upg.${track}.next2`, { n: amount(2) })
          : level === 2
            ? t(`upg.${track}.next3`, { n: amount(3) })
            : '';

      let buttonHtml: string;
      if (isMax) {
        buttonHtml = `<button class="upgrade-btn maxed" disabled>${t('upg.maxLevel')}</button>`;
      } else if (canAfford) {
        buttonHtml = `<button class="upgrade-btn primary" data-track="${track}">${t('upg.upgradeTo', { level: currentLevel + 1, price: nextPrice! })}</button>`;
      } else {
        const short = nextPrice! - captain.gold;
        buttonHtml = `<button class="upgrade-btn" disabled title="${t('upg.needGoldTitle', { n: short })}">${t('upg.upgradeShort', { level: currentLevel + 1, price: nextPrice!, n: short })}</button>`;
      }

      const pipsHtml = [1, 2, 3]
        .map((lv) => `<span class="track-pip ${lv <= currentLevel ? 'filled' : ''}"></span>`)
        .join('');

      return `
        <article class="upgrade-card adult-card">
          <div class="upgrade-card-header">
            <span class="track-icon">${icon}</span>
            <div class="track-titles">
              <h4 class="track-name">${name}</h4>
              <div class="track-pips-container">
                <span class="track-level-text">${t('upg.levelOf', { level: currentLevel, max: MAX_UPGRADE_LEVEL })}</span>
                <div class="track-pips">${pipsHtml}</div>
              </div>
            </div>
          </div>
          <div class="track-effects">
            <p class="current-effect">${currentDesc}</p>
            ${!isMax ? `<p class="next-effect"><b>${t('upg.next')}</b> ${nextDesc}</p>` : `<p class="max-note">${t('upg.fullyUpgraded')}</p>`}
          </div>
          <div class="upgrade-action">
            ${buttonHtml}
          </div>
        </article>
      `;
    }).join('');

    return `
      <div class="shipyard-section adult-layout">
        <div class="section-title">
          <h3>${t('upg.forActive', { ship: shipName(activeShipBase) })}</h3>
          <span class="muted small">${t('upg.visualNote')}</span>
        </div>
        <div class="upgrades-grid">
          ${tracksHtml}
        </div>

        <div class="section-title ships-title">
          <h3>${t('fleet.title')}</h3>
          <span class="muted small">${t('fleet.note')}</span>
        </div>

        ${this.renderFleet()}
      </div>
    `;
  }

  private renderFleet(): string {
    const { trade } = this.world;
    const { captain } = trade;
    const activeShipId = captain.activeShip;
    const ownsCutter = Boolean(captain.ships.cutter);
    const cargoNow = cargoUsed(trade);
    const sloopCap = holdCapacity(SLOOP, captain.ships.sloop ?? { sails: 1, hold: 1, hull: 1 });
    const cutterCap = ownsCutter
      ? holdCapacity(CUTTER, captain.ships.cutter!)
      : holdCapacity(CUTTER, { sails: 1, hold: 1, hull: 1 });

    const cutterCanAfford = captain.gold >= CUTTER.price;
    const cutterFitsCargo = cargoNow <= cutterCap;
    const sloopFitsCargo = cargoNow <= sloopCap;

    const sloop = shipName(SLOOP);
    const cutter = shipName(CUTTER);
    const cutterPrice = formatNumber(CUTTER.price);
    const sailing = `<span class="ship-badge active-badge">${t('fleet.sailing')}</span>`;

    let cutterButtonHtml: string;
    if (activeShipId === 'cutter') {
      cutterButtonHtml = sailing;
    } else if (ownsCutter) {
      if (cutterFitsCargo) {
        cutterButtonHtml = `<button class="ship-btn primary" data-ship-switch="cutter">${t('fleet.switchTo', { ship: cutter })}</button>`;
      } else {
        cutterButtonHtml = `<button class="ship-btn" disabled title="${t('fleet.cargoTooLarge')}">${t('fleet.switchTooLarge', { ship: cutter })}</button>`;
      }
    } else {
      if (!cutterCanAfford) {
        const short = CUTTER.price - captain.gold;
        cutterButtonHtml = `<button class="ship-btn" disabled title="${t('upg.needGoldTitle', { n: short })}">${t('fleet.buyNeed', { ship: cutter, price: cutterPrice, n: short })}</button>`;
      } else if (!cutterFitsCargo) {
        cutterButtonHtml = `<button class="ship-btn" disabled title="${t('fleet.cargoExceeds', { ship: cutter })}">${t('fleet.buyCargoBig', { ship: cutter, price: cutterPrice })}</button>`;
      } else {
        cutterButtonHtml = `<button class="ship-btn primary" data-ship-buy="cutter">${t('fleet.buy', { ship: cutter, price: cutterPrice })}</button>`;
      }
    }

    let sloopButtonHtml: string;
    if (activeShipId === 'sloop') {
      sloopButtonHtml = sailing;
    } else {
      if (sloopFitsCargo) {
        sloopButtonHtml = `<button class="ship-btn primary" data-ship-switch="sloop">${t('fleet.switchTo', { ship: sloop })}</button>`;
      } else {
        const load = { used: cargoNow, cap: sloopCap };
        sloopButtonHtml = `<button class="ship-btn" disabled title="${t('fleet.cargoTooLargeCount', load)}">${t('fleet.switchCargo', { ship: sloop, ...load })}</button>`;
      }
    }

    return `
        <div class="ships-grid">
          <article class="ship-card adult-card ${activeShipId === 'sloop' ? 'active-ship' : ''}">
            <div class="ship-card-header">
              <h4>${sloop}</h4>
              <span class="ship-role-tag">${t('fleet.sloopRole')}</span>
            </div>
            <div class="ship-specs">
              <div>${t('fleet.hold', { n: sloopCap })}</div>
              <div>${t('fleet.sloopPoints')}</div>
              <div>${t('fleet.sloopHandling')}</div>
            </div>
            <div class="ship-action">
              ${sloopButtonHtml}
            </div>
          </article>

          <article class="ship-card adult-card ${activeShipId === 'cutter' ? 'active-ship' : ''}">
            <div class="ship-card-header">
              <h4>${cutter}</h4>
              <span class="ship-role-tag">${t('fleet.cutterRole')}</span>
            </div>
            <div class="ship-specs">
              <div>${t('fleet.hold', { n: cutterCap })}${t('fleet.cutterBase')}</div>
              <div>${t('fleet.cutterPoints')}</div>
              <div>${t('fleet.cutterSpeed')}</div>
            </div>
            <div class="ship-action">
              ${cutterButtonHtml}
            </div>
          </article>
        </div>
    `;
  }

  private attachListeners() {
    const closeBtn = this.container.querySelector('#tp-close');
    closeBtn?.addEventListener('click', () => this.close());

    const undockBtn = this.container.querySelector('#tp-undock');
    undockBtn?.addEventListener('click', () => this.close());

    const modeBtn = this.container.querySelector('#tp-toggle-mode');
    modeBtn?.addEventListener('click', () => {
      this.uiMode = this.uiMode === 'kids' ? 'adult' : 'kids';
      this.onUiModeChange(this.uiMode);
      this.render();
    });

    const tabMarket = this.container.querySelector('#tp-tab-market');
    tabMarket?.addEventListener('click', () => {
      this.tab = 'market';
      this.render();
    });

    const tabShipyard = this.container.querySelector('#tp-tab-shipyard');
    tabShipyard?.addEventListener('click', () => {
      this.tab = 'shipyard';
      this.render();
    });

    // Sell all
    const sellAllBtn = this.container.querySelector('#tp-sell-all');
    sellAllBtn?.addEventListener('click', () => {
      const res = sellAll(this.world.trade);
      this.finish(res, { kind: 'sell', good: null });
    });

    this.container.querySelector('#tp-repair')?.addEventListener('click', () => {
      const res = repairHull(this.world.trade);
      if (res.ok) {
        this.message = t('trade.repaired', { gold: res.gold });
        this.onAction();
      } else {
        this.message = res.error === 'not-enough-gold' ? t('trade.err.not-enough-gold') : '';
      }
      this.render();
    });

    this.container.querySelector('#tp-deliver')?.addEventListener('click', () => {
      const res = deliverContract(this.world.trade, this.world.map);
      if (res.ok) {
        this.message = t('trade.delivered', { gold: res.gold });
        this.onAction();
      } else {
        this.message = t('trade.needFullOrder');
      }
      this.render();
    });

    this.container.querySelector('#tp-tab-orders')?.addEventListener('click', () => {
      this.tab = 'orders';
      this.render();
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-lot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.lot = Number(btn.dataset.lot) as Lot;
        this.render();
      });
    });

    // Buy/Sell buttons (both adult and kids)
    this.container
      .querySelectorAll<HTMLButtonElement>('.trade-act-btn, .kid-act-btn')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          const good = btn.dataset.good as GoodId;
          const qty = parseInt(btn.dataset.qty || '1', 10);
          if (!good || qty <= 0) return;

          if (action === 'buy') {
            const res = buy(this.world.trade, good, qty);
            this.finish(res, { kind: 'buy', good });
          } else if (action === 'sell') {
            const res = sell(this.world.trade, good, qty);
            this.finish(res, { kind: 'sell', good });
          }
        });
      });

    // Upgrades
    this.container
      .querySelectorAll<HTMLButtonElement>('.upgrade-btn[data-track]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const track = btn.dataset.track as UpgradeTrack;
          if (!track) return;
          const res = buyUpgrade(this.world.trade, track);
          this.finish(res);
        });
      });

    // Ship purchase & switch
    this.container.querySelectorAll<HTMLButtonElement>('[data-ship-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const shipId = btn.dataset.shipBuy;
        if (!shipId) return;
        const res = buyShip(this.world.trade, shipId);
        this.finish(res);
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ship-switch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const shipId = btn.dataset.shipSwitch;
        if (!shipId) return;
        const res = switchShip(this.world.trade, shipId);
        this.finish(res);
      });
    });
  }
}
