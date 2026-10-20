import { type Contract, deliverContract, openContracts } from '../sim/contracts';
import { GOODS, GOOD_DEFS, type GoodId } from '../sim/goods';
import { hullCondition, repairHull, repairPrice } from '../sim/hazards';
import { goodRole, quoteAcross, quoteBuy, quoteSell, type Market } from '../sim/market';
import { DEG } from '../sim/math';
import { SHIP_CLASSES, SLOOP } from '../sim/ship';
import { type ShipOffer, discoveredPorts, homePort, shipOffers } from '../sim/shipyards';
import {
  activeShip,
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

export type TradePanelTab = 'market' | 'shipyard';

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
  private selectedQuantities: Record<GoodId, number> = {
    fish: 1,
    grain: 1,
    timber: 1,
    stone: 1,
  };

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
    const currentShip = activeShip(trade);
    const holdCap = capacity(trade);
    const holdUsed = cargoUsed(trade);
    const freeCap = freeSpace(trade);
    const activeLevels = captain.ships[captain.activeShip] ?? { sails: 1, hold: 1, hull: 1 };

    let totalSellableValue = 0;
    for (const g of GOODS) {
      const q = captain.cargo[g];
      if (q > 0) totalSellableValue += quoteSell(market, g, q);
    }

    const wantsNames = port.wants.map((w) => goodName(w)).join(', ');

    const isKid = this.uiMode === 'kids';
    const makesGood = port.produces[0];
    const makesHtml = makesGood
      ? `${isKid ? t('kids.produces') : t('trade.produces')} <b>${goodName(makesGood)}</b>`
      : t('trade.shipwright');

    const html = `
      <div class="trade-modal panel card ${isKid ? 'kids-view' : 'captain-view'}">
        <header class="trade-header">
          <div class="port-title-area">
            <div class="port-kicker">${isKid ? t('kids.kicker') : t('trade.kicker')}</div>
            <h2 class="port-name">${port.name}</h2>
            <div class="port-roles-summary">
              ${port.id === homePort(map).id ? `<span class="role-tag home">${t('trade.homePort')}</span>` : ''}
              <span class="role-tag produces">${makesHtml}</span>
              <span class="role-tag wants">${isKid ? t('kids.wants') : t('trade.demands')} <b>${wantsNames}</b></span>
            </div>
          </div>
          <div class="header-controls">
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

        <div id="tutorial-market"></div>
        <section class="captain-bar">
          <div class="stat-pill gold-pill">
            <span class="stat-icon">🪙</span>
            <span class="stat-val">${formatNumber(captain.gold)}</span>
            <span class="stat-label">${isKid ? t('kids.gold') : t('trade.gold')}</span>
          </div>
          <div class="stat-pill hold-pill">
            <span class="stat-icon">📦</span>
            <span class="stat-val">${holdUsed} / ${holdCap}</span>
            <span class="stat-label">${isKid ? t('kids.cargoFree', { n: freeCap }) : t('trade.cargoFree', { n: freeCap })}</span>
          </div>
          <div class="stat-pill ship-pill">
            <span class="stat-icon">⛵</span>
            <span class="stat-val">${shipName(currentShip)}</span>
            <span class="stat-label">${isKid ? t('kids.currentBoat') : `L${activeLevels.sails}·L${activeLevels.hold}·L${activeLevels.hull}`}</span>
          </div>
        </section>

        ${this.renderRepair(isKid)}
        <nav class="trade-tabs">
          <button id="tp-tab-market" class="tab-btn ${this.tab === 'market' ? 'active' : ''}">
            ${isKid ? t('kids.tabMarket') : t('trade.tabMarket')}
          </button>
          <button id="tp-tab-shipyard" class="tab-btn ${this.tab === 'shipyard' ? 'active' : ''}">
            ${isKid ? t('kids.tabShipyard') : t('trade.tabShipyard')}
          </button>
        </nav>

        <main class="trade-content">
          ${this.tab === 'market' ? this.renderContracts(isKid) : ''}
          ${
            this.tab === 'market'
              ? isKid
                ? this.renderKidsMarket(market, totalSellableValue)
                : this.renderAdultMarket(market, totalSellableValue)
              : isKid
                ? this.renderKidsShipyard()
                : this.renderAdultShipyard()
          }
        </main>

        <p class="trade-status" role="status">${this.message}</p>
        <footer class="trade-footer">
          <button id="tp-undock" class="primary undock-btn">${isKid ? t('kids.undock') : t('trade.undock')}</button>
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
        ? t(isKid ? 'kids.fix' : 'trade.repair', { price })
        : canPay
          ? t(isKid ? 'kids.fixSome' : 'trade.repairSome')
          : t('trade.needGold');
    return `
      <section class="repair-bar">
        <span>🛠 ${isKid ? t('kids.leaking') : t('trade.hull')} <b>${t('unit.percent', { n: pct })}</b>${isKid ? '' : t('trade.leaking')}</span>
        <button id="tp-repair" class="sell-all-btn" ${canPay ? '' : 'disabled'}>${label}</button>
      </section>`;
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
          <span>${isKid ? t('kids.townNeeds') : t('trade.portOrders')} <b>${goods(here)}</b> · ${isKid ? t('kids.pays') : t('trade.reward')} <b>${here.reward} 🪙</b></span>
          <button id="tp-deliver" class="sell-all-btn deliver-btn" ${missing > 0 ? 'disabled' : ''}>
            ${missing > 0 ? t('trade.needMore', { n: missing }) : isKid ? t('kids.deliver') : t('trade.deliverFor', { reward: here.reward })}
          </button>
        </div>`;
    }
    const charted = discoveredPorts(map, trade).map((p) => p.id);
    const others = openContracts(trade.contracts).filter(
      (c) => c.portId !== trade.dockedAt && charted.includes(c.portId),
    );
    const othersHtml = others
      .map(
        (c) =>
          `<li><b>${portName(c.portId)}</b>: ${goods(c)} · ${c.reward} 🪙${
            trade.captain.cargo[c.good] >= c.qty
              ? ` <span class="role-badge produces">${t('trade.inHoldBadge')}</span>`
              : ''
          }</li>`,
      )
      .join('');
    return `
      <section class="contracts" aria-label="${isKid ? t('kids.jobs') : t('trade.orders')}">
        <h3 class="contracts-title">📜 ${isKid ? t('kids.jobs') : t('trade.orders')}</h3>
        ${hereHtml}
        ${others.length ? `<ul class="contract-list">${othersHtml}</ul>` : ''}
      </section>`;
  }

  /** Where this good sells best among the other ports today (decision 0036). */
  private bestSaleElsewhere(good: GoodId): { name: string; sell: number } | null {
    const { trade, map } = this.world;
    const others = discoveredPorts(map, trade).filter((p) => p.id !== trade.dockedAt);
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
  private renderAdultMarket(market: Market, sellAllGold: number): string {
    const { trade, map } = this.world;
    const port = findPort(map, trade.dockedAt!)!;
    const { captain } = trade;

    const cardsHtml = GOODS.map((good) => {
      const def = GOOD_DEFS[good];
      const role = goodRole(port, good);
      const stock = Math.max(0, Math.floor(market.stock[good]));
      const inHold = captain.cargo[good];
      const free = freeSpace(trade);
      const maxCanBuy = maxBuy(trade, good);

      let qty = this.selectedQuantities[good] ?? 1;
      const upperLimit = Math.max(1, Math.max(maxCanBuy, inHold, 1));
      qty = Math.min(Math.max(1, qty), upperLimit);
      this.selectedQuantities[good] = qty;

      const bestElsewhere = this.bestSaleElsewhere(good);
      const nextBuy = quoteBuy(market, good, 1);
      const nextSell = quoteSell(market, good, 1);

      const costQuote = qty > 0 ? quoteBuy(market, good, qty) : 0;
      const sellQuote = qty > 0 ? quoteSell(market, good, qty) : 0;

      const canBuy = maxCanBuy >= qty && qty > 0;
      let buyDisabledReason = '';
      if (!canBuy) {
        if (stock === 0) buyDisabledReason = t('trade.outOfStock');
        else if (free === 0) buyDisabledReason = t('trade.holdFull');
        else if (captain.gold < nextBuy) buyDisabledReason = t('trade.needGold');
        else if (qty > stock) buyDisabledReason = t('trade.onlyStock', { n: stock });
        else if (qty > free) buyDisabledReason = t('trade.onlySpace', { n: free });
        else buyDisabledReason = t('trade.cannotAfford');
      }

      const canSell = inHold >= qty && qty > 0;
      let sellDisabledReason = '';
      if (!canSell) {
        if (inHold === 0) sellDisabledReason = t('trade.noneInHold');
        else sellDisabledReason = t('trade.onlyInHold', { n: inHold });
      }

      let roleBadge = `<span class="role-badge neutral">${t('trade.standard')}</span>`;
      if (role === 'produces') {
        roleBadge = `<span class="role-badge produces">${t('trade.producesCheap')}</span>`;
      } else if (role === 'wants') {
        roleBadge = `<span class="role-badge wants">${t('trade.demandedDear')}</span>`;
      }

      return `
        <article class="good-card adult-card ${role}">
          <div class="good-info">
            <div class="good-icon">${GOOD_ICONS[good]}</div>
            <div class="good-text">
              <div class="good-header">
                <h4 class="good-name">${goodName(def.id)}</h4>
                ${roleBadge}
              </div>
              <div class="good-meta">
                <span>${t('trade.stock')} <b>${stock}</b></span>
                <span class="sep">·</span>
                <span>${t('trade.inHold')} <b>${inHold}</b></span>
              </div>
              ${bestElsewhere ? `<div class="best-elsewhere">${t('trade.bestElsewhere', { name: bestElsewhere.name, price: bestElsewhere.sell })}</div>` : ''}
            </div>
          </div>

          <div class="good-prices">
            <div class="price-col">
              <span class="price-label">${t('trade.buyFirst')}</span>
              <span class="price-val">${nextBuy} 🪙</span>
            </div>
            <div class="price-col">
              <span class="price-label">${t('trade.sellFirst')}</span>
              <span class="price-val">${nextSell} 🪙</span>
            </div>
          </div>

          <div class="qty-control-area">
            <span class="qty-title">${t('trade.quantity')}</span>
            <div class="qty-stepper">
              <button class="qty-btn" data-good="${good}" data-delta="-1" aria-label="${t('trade.decrease')}">-</button>
              <span class="qty-display">${qty}</span>
              <button class="qty-btn" data-good="${good}" data-delta="1" aria-label="${t('trade.increase')}">+</button>
            </div>
            <div class="qty-quick-buttons">
              <button class="qty-quick" data-good="${good}" data-set="1">1</button>
              <button class="qty-quick" data-good="${good}" data-set="5">5</button>
              <button class="qty-quick" data-good="${good}" data-set="max">${t('trade.max')}</button>
            </div>
          </div>

          <div class="quote-preview">
            <div class="quote-line">
              <span class="quote-mode">${t('trade.buyN', { n: qty })}</span>
              <span class="quote-total ${canBuy ? 'affordable' : 'unaffordable'}">${costQuote} 🪙</span>
              ${qty > 1 ? `<span class="quote-avg">${t('trade.each', { price: formatNumber(costQuote / qty, 1) })}</span>` : ''}
            </div>
            <div class="quote-line">
              <span class="quote-mode">${t('trade.sellN', { n: qty })}</span>
              <span class="quote-total income">+${sellQuote} 🪙</span>
              ${qty > 1 ? `<span class="quote-avg">${t('trade.each', { price: formatNumber(sellQuote / qty, 1) })}</span>` : ''}
            </div>
          </div>

          <div class="good-actions">
            <button
              class="trade-act-btn buy-btn"
              data-action="buy"
              data-good="${good}"
              data-qty="${qty}"
              ${!canBuy ? 'disabled' : ''}
              title="${buyDisabledReason}"
            >
              ${canBuy ? t('trade.buyFor', { n: qty, price: costQuote }) : buyDisabledReason}
            </button>
            <button
              class="trade-act-btn sell-btn"
              data-action="sell"
              data-good="${good}"
              data-qty="${qty}"
              ${!canSell ? 'disabled' : ''}
              title="${sellDisabledReason}"
            >
              ${canSell ? t('trade.sellFor', { n: qty, price: sellQuote }) : sellDisabledReason}
            </button>
          </div>
        </article>
      `;
    }).join('');

    return `
      <div class="market-section adult-layout">
        ${
          sellAllGold > 0
            ? `
          <div class="sell-all-bar">
            <span>${t('trade.cargoReady')}</span>
            <button id="tp-sell-all" class="sell-all-btn">
              ${t('trade.sellAll', { price: sellAllGold })}
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

    const home = homePort(this.world.map);
    return `
      <div class="shipyard-section kids-layout">
        <div class="section-title">
          <h3>${t('kids.upgradeTitle')}</h3>
        </div>
        ${
          trade.dockedAt === home.id
            ? `<div class="upgrades-grid">
          ${upgradeCardsHtml}
        </div>`
            : `<p class="muted home-note">${t('upg.homeOnly', { port: home.name })}</p>`
        }

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

    const home = homePort(this.world.map);
    const upgradesHtml =
      trade.dockedAt === home.id
        ? `<div class="upgrades-grid">
          ${tracksHtml}
        </div>`
        : `<p class="muted home-note">${t('upg.homeOnly', { port: home.name })}</p>`;
    return `
      <div class="shipyard-section adult-layout">
        <div class="section-title">
          <h3>${t('upg.forActive', { ship: shipName(activeShipBase) })}</h3>
          <span class="muted small">${t('upg.visualNote')}</span>
        </div>
        ${upgradesHtml}

        <div class="section-title ships-title">
          <h3>${t('fleet.title')}</h3>
          <span class="muted small">${t('fleet.note', { port: home.name })}</span>
        </div>

        ${this.renderFleet()}
      </div>
    `;
  }

  /**
   * Every ship class (decision 0048): the starter, then each line's ships with where they are
   * built and what it takes to buy them. Switching and upgrades happen at the home port only.
   */
  private renderFleet(): string {
    const { trade, map } = this.world;
    const { captain } = trade;
    const here = trade.dockedAt;
    const home = homePort(map);
    const atHome = here === home.id;
    const cargoNow = cargoUsed(trade);
    const stock = { sails: 1, hold: 1, hull: 1 };
    const sailing = `<span class="ship-badge active-badge">${t('fleet.sailing')}</span>`;
    const note = (text: string) => `<span class="ship-note muted small">${text}</span>`;

    const action = (offer: ShipOffer): string => {
      const { cls } = offer;
      const ship = shipName(cls);
      if (captain.activeShip === cls.id) return sailing;
      if (offer.status === 'owned') {
        if (!atHome) return note(t('fleet.waitingAt', { port: home.name }));
        const cap = holdCapacity(cls, captain.ships[cls.id]!);
        if (cargoNow <= cap)
          return `<button class="ship-btn primary" data-ship-switch="${cls.id}">${t('fleet.switchTo', { ship })}</button>`;
        const load = { used: cargoNow, cap };
        return `<button class="ship-btn" disabled title="${t('fleet.cargoTooLargeCount', load)}">${t('fleet.switchCargo', { ship, ...load })}</button>`;
      }
      if (offer.status === 'undiscovered') return note(t('fleet.undiscovered'));
      const yard = offer.yard!.name;
      if (offer.status === 'needs-standing')
        return note(t('fleet.needsOrders', { n: offer.ordersLeft, port: yard }));
      const price = formatNumber(cls.price);
      if (here !== offer.yard!.id) return note(t('fleet.builtAt', { port: yard, price }));
      if (captain.gold < cls.price) {
        const short = cls.price - captain.gold;
        return `<button class="ship-btn" disabled title="${t('upg.needGoldTitle', { n: short })}">${t('fleet.buyNeed', { ship, price, n: short })}</button>`;
      }
      if (cargoNow > holdCapacity(cls, stock))
        return `<button class="ship-btn" disabled title="${t('fleet.cargoExceeds', { ship })}">${t('fleet.buyCargoBig', { ship, price })}</button>`;
      return `<button class="ship-btn primary" data-ship-buy="${cls.id}">${t('fleet.buy', { ship, price })}</button>`;
    };

    const card = (offer: ShipOffer): string => {
      const { cls } = offer;
      const levels = captain.ships[cls.id] ?? stock;
      const speed = Math.round((cls.speedRatio / SLOOP.speedRatio) * 100);
      const role =
        cls.line === 'starter'
          ? t('fleet.line.starter')
          : t('fleet.lineTier', { line: t(`fleet.line.${cls.line}`), tier: cls.tier });
      return `
          <article class="ship-card adult-card ${captain.activeShip === cls.id ? 'active-ship' : ''}" data-ship="${cls.id}">
            <div class="ship-card-header">
              <h4>${shipName(cls)}</h4>
              <span class="ship-role-tag">${role}</span>
            </div>
            <div class="ship-specs">
              <div>${t('fleet.hold', { n: holdCapacity(cls, levels) })}</div>
              <div>${t('fleet.points', { deg: Math.round(cls.noGoAngle / DEG) })}</div>
              <div>${t('fleet.speed', { pct: speed })}</div>
            </div>
            <div class="ship-action">
              ${action(offer)}
            </div>
          </article>`;
    };

    const sloop: ShipOffer = { cls: SLOOP, status: 'owned', yard: home, ordersLeft: 0 };
    const offers = [sloop, ...shipOffers(trade, map).filter((o) => o.status !== 'no-yard')];
    return `
        <div class="ships-grid">
          ${offers.map(card).join('')}
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

    // Stepper buttons
    this.container.querySelectorAll<HTMLButtonElement>('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const good = btn.dataset.good as GoodId;
        const delta = parseInt(btn.dataset.delta || '0', 10);
        if (!good) return;
        const cur = this.selectedQuantities[good] ?? 1;
        this.selectedQuantities[good] = Math.max(1, cur + delta);
        this.render();
      });
    });

    // Quick quantity buttons
    this.container.querySelectorAll<HTMLButtonElement>('.qty-quick').forEach((btn) => {
      btn.addEventListener('click', () => {
        const good = btn.dataset.good as GoodId;
        const setVal = btn.dataset.set;
        if (!good) return;
        if (setVal === 'max') {
          const m = maxBuy(this.world.trade, good);
          const hold = this.world.trade.captain.cargo[good];
          this.selectedQuantities[good] = Math.max(1, Math.max(m, hold));
        } else {
          this.selectedQuantities[good] = parseInt(setVal || '1', 10);
        }
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
          const res = buyUpgrade(this.world.trade, this.world.map, track);
          this.finish(res);
        });
      });

    // Ship purchase & switch
    this.container.querySelectorAll<HTMLButtonElement>('[data-ship-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const shipId = btn.dataset.shipBuy;
        if (!shipId) return;
        const res = buyShip(this.world.trade, this.world.map, shipId);
        this.finish(res);
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>('[data-ship-switch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const shipId = btn.dataset.shipSwitch;
        if (!shipId) return;
        const res = switchShip(this.world.trade, this.world.map, shipId);
        this.finish(res);
      });
    });
  }
}
