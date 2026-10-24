import { TUNING } from '../data/tuning';
import { topSpeedKn } from '../sim/boat';
import { type Contract, deliverContract, openContracts } from '../sim/contracts';
import { GOODS, GOOD_DEFS, GOOD_ICONS, type GoodId } from '../sim/goods';
import { hullCondition, repairHull, repairPrice } from '../sim/hazards';
import {
  available,
  goodRole,
  quoteAcross,
  quoteBuy,
  quoteSell,
  trades,
  type Market,
} from '../sim/market';
import {
  growthProgress,
  MAX_SETTLEMENT_LEVEL,
  portTownGate,
  madeGoods,
  portNow,
  producesAt,
  settlementLevel,
  upgradeNeedsLevel,
  wantsAt,
} from '../sim/settlement';
import { SHIP_CLASSES, SLOOP } from '../sim/ship';
import {
  type ShipOffer,
  discoveredPorts,
  homePort,
  isDiscovered,
  shipOffers,
} from '../sim/shipyards';
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
  upgradeAllowed,
} from '../sim/trade';
import {
  MAX_UPGRADE_LEVEL,
  UPGRADE_TRACKS,
  holdCapacity,
  effectiveShip,
  hullDurability,
  upgradePrice,
  type UpgradeTrack,
} from '../sim/upgrades';
import type { World } from '../sim/world';
import { KIDS_MODE_AVAILABLE, type UiMode } from './settings';
import { formatNumber, goodName, shipName, shipThe, t, townLevelName } from '../i18n';
import { COIN, crateIcon, icon } from './icons';
import { portraitSvg } from './portraits';
import { questCardBody } from './questCard';
import type { QuayItem } from './questView';

/** A game controller's button glyphs, shown only while the pad is in use (decision 0163). */
const PAD_LB = '<i class="pad-key bumper pad-only" aria-hidden="true">LB</i>';
const PAD_RB = '<i class="pad-key bumper pad-only" aria-hidden="true">RB</i>';
const PAD_X = '<i class="pad-key x pad-only" aria-hidden="true">X</i>';

export type TradePanelTab = 'market' | 'orders' | 'quay' | 'shipyard';

/**
 * The people of the harbour, on the Quay tab (decision 0141); see `quayItems` in `questView.ts`.
 * `seen` is told the fresh ones once the tab has shown them; `act` the captain's answers.
 */
export interface PortQuay {
  items(): QuayItem[];
  seen(keys: string[]): void;
  act(quest: string, act: 'accept' | 'later' | 'ignore' | 'choose', option?: string): void;
}

/** Lot sizes for one tap on Buy or Sell (decision 0049); clamped to what the hold, stock and gold allow. */
const LOTS = [1, 5, 10] as const;
type Lot = (typeof LOTS)[number];

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
  /** The Quay tab's people; none: no tab. */
  quay: PortQuay | null = null;
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
      if (q > 0 && trades(market, g)) totalSellableValue += quoteSell(market, g, q);
    }

    const isKid = this.uiMode === 'kids';
    if (isKid && this.tab === 'orders') this.tab = 'market';
    const goodIcons = (goods: readonly string[]) =>
      goods.map((g) => `<span title="${goodName(g)}">${icon(g)}</span>`).join('');
    const makes = producesAt(map, trade, port.id);
    const orders = this.openOrderCount();
    const people = this.quay?.items() ?? [];
    const fresh = people.filter((p) => p.fresh);
    if (!this.quay && this.tab === 'quay') this.tab = 'market';
    const tabBtn = (tab: TradePanelTab, label: string, extra = '') =>
      `<button id="tp-tab-${tab}" class="tab-btn ${this.tab === tab ? 'active' : ''}" aria-pressed="${this.tab === tab}">${label}${extra}</button>`;

    // Full-screen port (decision 0049): header, tabs, one screen of content, actions along the bottom.
    const html = `
      <div class="trade-modal port-screen ${isKid ? 'kids-view' : 'captain-view'}">
        <header class="trade-header">
          <div class="port-title-area">
            <h2 class="port-name">${port.name}</h2>
            <div class="port-roles-summary">
              ${port.id === homePort(map).id ? `<span class="role-tag home">${icon('anchor')}${t('trade.homePort')}</span>` : ''}
              ${makes.length ? `<span class="role-tag produces"><small>${isKid ? t('kids.produces') : t('trade.makes')}</small>${goodIcons(makes)}</span>` : ''}
              ${!port.produces.length ? `<span class="role-tag produces">${t('trade.shipwright')}</span>` : ''}
              <span class="role-tag wants"><small>${isKid ? t('kids.wants') : t('trade.wants')}</small>${goodIcons(wantsAt(map, trade, port.id))}</span>
              ${this.settlementTag(port.id, port.name)}
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
          ${PAD_LB}
          ${tabBtn('market', isKid ? t('kids.tabMarket') : t('trade.tabMarket'))}
          ${isKid ? '' : tabBtn('orders', t('trade.tabOrders'), orders ? ` <span class="tab-badge">${orders}</span>` : '')}
          ${this.quay ? tabBtn('quay', t('trade.tabQuay'), fresh.length && this.tab !== 'quay' ? ` <span class="tab-badge is-quay">${fresh.length}</span>` : '') : ''}
          ${tabBtn('shipyard', isKid ? t('kids.tabShipyard') : t('trade.tabShipyard'))}
          ${PAD_RB}
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
                : this.tab === 'quay'
                  ? this.renderQuay(people)
                  : isKid
                    ? this.renderKidsShipyard()
                    : this.renderAdultShipyard()
          }
        </main>

        <p class="trade-status" role="status">${this.message}</p>
        <footer class="trade-footer">
          ${this.tab !== 'quay' && fresh.length ? this.renderQuayHint(fresh) : ''}
          ${this.renderRepair(isKid)}
          <span class="footer-gap"></span>
          ${
            totalSellableValue > 0 && !isKid
              ? `<button id="tp-sell-all" class="port-btn green" data-pad="secondary">${PAD_X}${t('trade.sellAll', { price: totalSellableValue })}${COIN}</button>`
              : ''
          }
          <button id="tp-undock" class="port-btn brass undock-btn">${icon('anchor')}${isKid ? t('kids.undock') : t('trade.undock')}</button>
        </footer>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachListeners();
    this.onRender();
    if (this.tab === 'quay' && fresh.length) this.quay?.seen(fresh.map((p) => p.key));
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

  /** The Quay tab (decision 0141): everyone in this harbour with something to say. */
  private renderQuay(people: QuayItem[]): string {
    if (!people.length) return `<p class="muted quay-empty">${t('trade.quayEmpty')}</p>`;
    return `<div class="quay-people">${people
      .map(
        ({ card, fresh }) =>
          `<article class="quay-person${fresh ? ' is-new' : ''}">${
            card.giver
              ? `<span class="quay-face">${portraitSvg(card.giver, { size: 96, mood: card.mood, variant: card.look })}</span>`
              : ''
          }<div class="quay-body">${questCardBody(card, true)}</div></article>`,
      )
      .join('')}</div>`;
  }

  /** "Kit Marlow would like a word → Quay", in the footer of the other tabs. */
  private renderQuayHint(fresh: QuayItem[]): string {
    const first = fresh[0]!.card;
    const name = (first.giver?.name ?? first.arc).replace(/[&<>"]/g, '');
    return `<button id="tp-quay-hint" class="quay-hint">${
      first.giver ? portraitSvg(first.giver, { size: 40, mood: first.mood }) : ''
    }<span>${t('trade.quayHint', { name })} <em>${t('trade.quayGo')}</em></span></button>`;
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
    const { trade, map } = this.world;
    const here = trade.contracts.byPort[trade.dockedAt!];
    // Same list as the Orders tab: ports not yet discovered stay hidden (decision 0048).
    const charted = discoveredPorts(map, trade).map((p) => p.id);
    const others = openContracts(trade.contracts).filter(
      (c) => c.portId !== trade.dockedAt && charted.includes(c.portId),
    );
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
          ${here.help ? `<span class="role-badge help">🆘 ${t('trade.help')}</span>` : ''}
          <span>${isKid ? t('kids.townNeeds') : t('trade.portOrders')} <b>${goods(here)}</b> · ${isKid ? t('kids.pays') : t('trade.reward')} <b>${here.reward}${COIN}</b></span>
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
          `<li>${c.help ? '🆘 ' : ''}<b>${portName(c.portId)}</b>: ${goods(c)} · ${c.reward}${COIN}${
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

  /** The town's size and growth toward the next level (decision 0059). */
  private settlementTag(portId: string, name: string): string {
    const s = this.world.trade.settlements.byPort[portId];
    if (!s) return '';
    const level = townLevelName(s.level);
    const pct = Math.round(growthProgress(this.world.trade, portId) * 100);
    // A town short of its rare goods shows how many it has had (decision 0065).
    const gate =
      s.level === MAX_SETTLEMENT_LEVEL - 1
        ? portTownGate(this.world.map, this.world.trade, portId)
        : null;
    if (gate) {
      const goods = gate.goods.map((g) => icon(g)).join('');
      const text = t('settlement.rare', { level, pct, have: gate.have, need: gate.need, goods });
      const sources = this.world.map.ports
        .filter(
          (p) =>
            portNow(p, this.world.trade).levelProduces &&
            Object.values(portNow(p, this.world.trade).levelProduces!)
              .flat()
              .some((g) => g && gate.goods.includes(g)),
        )
        .map((p) => (isDiscovered(this.world.trade, p.id) ? p.name : t('settlement.farIsland')));
      const hint = t('settlement.rareHint', {
        name,
        need: gate.need,
        goods: gate.goods.map(goodName).join(', '),
        source: sources[0] ?? t('settlement.farIsland'),
      });
      return `<span class="role-tag level rare" title="${hint}">${text}</span>`;
    }
    const text =
      s.level >= MAX_SETTLEMENT_LEVEL
        ? level
        : t(
            s.sinceSupply > TUNING.economy.towns.stallSeconds && s.growth > 0
              ? 'settlement.stalling'
              : 'settlement.growing',
            {
              level,
              pct,
            },
          );
    return `<span class="role-tag level" title="${t('settlement.hint', { name })}">${text}</span>`;
  }

  /** Why an upgrade waits: the home port has to grow first (decision 0059). */
  private needsLevelText(to: number): string {
    const home = homePort(this.world.map);
    return t('upg.needsLevel', {
      port: home.name,
      level: townLevelName(upgradeNeedsLevel(to)),
    });
  }

  // --- KIDS MARKET RENDERER ---
  private renderKidsMarket(market: Market, sellAllGold: number): string {
    const { trade, map } = this.world;
    const port = findPort(map, trade.dockedAt!)!;
    const { captain } = trade;

    const made = madeGoods(map, trade);
    // Specialized goods appear only where they are made or wanted (decision 0063).
    const cardsHtml = GOODS.filter((g) => trades(market, g))
      .map((good) => {
        const def = GOOD_DEFS[good];
        const role = goodRole(port, good, settlementLevel(trade, port.id), made);
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
      })
      .join('');

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

    const made = madeGoods(map, trade);
    // Specialized goods appear only where they are made or wanted (decision 0063).
    const rowsHtml = GOODS.filter((g) => trades(market, g))
      .map((good) => {
        const def = GOOD_DEFS[good];
        const role = goodRole(port, good, settlementLevel(trade, port.id), made);
        // A far workshop sells only what it crafted from raw goods received (decision 0146).
        const stock = available(market, good);
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
      })
      .join('');

    // Side panel: this port's order, then where the cargo (or what this port makes) sells best.
    const hereGoods = GOODS.filter((g) => captain.cargo[g] > 0);
    const tips = (hereGoods.length ? hereGoods : producesAt(map, trade, port.id))
      .map((g) => {
        const best = this.bestSaleElsewhere(g as GoodId);
        return best
          ? `<li>${icon(g)} ${t('trade.paysAt', { name: best.name, price: best.sell })}</li>`
          : '';
      })
      .join('');
    const missing = liveOrder ? liveOrder.qty - captain.cargo[liveOrder.good] : 0;
    const orderHtml = liveOrder
      ? `${liveOrder.help ? `<p class="order-help">🆘 ${t('trade.help')}</p>` : ''}<p class="order-line">${icon(liveOrder.good)} <b>${t('trade.contractGoods', { qty: liveOrder.qty, good: goodName(liveOrder.good).toLowerCase() })}</b> → <b>${liveOrder.reward}</b>${COIN}</p>
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
                : !upgradeAllowed(trade, this.world.map, cur + 1)
                  ? `<button class="upgrade-btn" disabled>${this.needsLevelText(cur + 1)}</button>`
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
      // Top speed in knots with this track at `level` and the other tracks as they are (decision 0075).
      const kn = (level: 1 | 2 | 3) =>
        formatNumber(topSpeedKn(effectiveShip(activeShipBase, { ...levels, [track]: level })), 1);
      const params = (level: 1 | 2 | 3) => ({ n: amount(level), kn: kn(level) });
      const currentDesc = t(`upg.${track}.${level}`, params(level));
      const nextDesc =
        level === 1
          ? t(`upg.${track}.next2`, params(2))
          : level === 2
            ? t(`upg.${track}.next3`, params(3))
            : '';

      let buttonHtml: string;
      if (isMax) {
        buttonHtml = `<button class="upgrade-btn maxed" disabled>${t('upg.maxLevel')}</button>`;
      } else if (!upgradeAllowed(trade, this.world.map, currentLevel + 1)) {
        buttonHtml = `<button class="upgrade-btn" disabled>${this.needsLevelText(currentLevel + 1)}</button>`;
      } else if (canAfford) {
        buttonHtml = `<button class="upgrade-btn primary" data-track="${track}">${t('upg.upgradeTo', { price: nextPrice! })}</button>`;
      } else {
        const short = nextPrice! - captain.gold;
        buttonHtml = `<button class="upgrade-btn" disabled title="${t('upg.needGoldTitle', { n: short })}">${t('upg.upgradeShort', { price: nextPrice!, n: short })}</button>`;
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
      const ship = shipThe(cls);
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
      const speed = formatNumber(topSpeedKn(effectiveShip(cls, levels)), 1);
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
              <div>${t('fleet.points', { deg: cls.noGoDeg })}</div>
              <div>${t('fleet.speed', { kn: speed })}</div>
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
        <p class="muted small speed-note">${t('upg.speedNote', { wind: TUNING.seamanship.boat.referenceBreezeKn })}</p>
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
      const res = sellAll(this.world.trade, this.world.map);
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

    for (const id of ['#tp-tab-quay', '#tp-quay-hint'])
      this.container.querySelector(id)?.addEventListener('click', () => {
        this.tab = 'quay';
        this.render();
      });
    this.container
      .querySelectorAll<HTMLButtonElement>('.quay-people button[data-act]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const act = btn.dataset.act as 'accept' | 'later' | 'ignore' | 'choose';
          this.quay?.act(btn.dataset.quest!, act, btn.dataset.option);
          this.render();
        });
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
            const res = sell(this.world.trade, good, qty, this.world.map);
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
