import { GOODS, GOOD_DEFS, type GoodId } from '../sim/goods';
import { goodRole, quoteBuy, quoteSell, type Market } from '../sim/market';
import { CUTTER, SHIP_CLASSES, SLOOP } from '../sim/ship';
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
import type { UiMode } from './settings';

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
    this.message = result.ok
      ? 'Done. Your cargo and gold are up to date.'
      : {
          'not-docked': 'Sail close to a port and slow down first.',
          'bad-quantity': 'Choose a whole number of goods.',
          'not-enough-gold': 'You need more gold.',
          'hold-full': 'Your hold is full.',
          'out-of-stock': 'The port has too little stock.',
          'not-in-hold': 'You do not have that much cargo.',
          'max-level': 'This upgrade is already at its highest level.',
          'already-owned': 'You already own this boat.',
          'not-owned': 'Buy this boat first.',
          'unknown-ship': 'This boat is unavailable.',
          'cargo-too-big': 'Sell some cargo before changing boats.',
        }[result.error];
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
    this.container.setAttribute('aria-label', 'Harbour trading and shipyard');
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
            <h2>Harbour</h2>
            <button class="close-btn" id="tp-close" aria-label="Close">✕</button>
          </div>
          <p class="muted">No port market available.</p>
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

    const makesGood = port.produces[0] ?? 'timber';
    const makesName = GOOD_DEFS[makesGood as GoodId]?.name ?? makesGood;
    const wantsNames = port.wants.map((w) => GOOD_DEFS[w as GoodId]?.name ?? w).join(', ');

    const isKid = this.uiMode === 'kids';

    const html = `
      <div class="trade-modal panel card ${isKid ? 'kids-view' : 'captain-view'}">
        <header class="trade-header">
          <div class="port-title-area">
            <div class="port-kicker">${isKid ? 'Town Harbour' : 'Port Registry & Ledger'}</div>
            <h2 class="port-name">${port.name}</h2>
            <div class="port-roles-summary">
              <span class="role-tag produces">${isKid ? 'Makes Plenty:' : 'Produces:'} <b>${makesName}</b></span>
              <span class="role-tag wants">${isKid ? 'Wants to Buy:' : 'Demands:'} <b>${wantsNames}</b></span>
            </div>
          </div>
          <div class="header-controls">
            <button id="tp-toggle-mode" class="mode-toggle-btn" title="Switch interface mode">
              ${isKid ? '🧭 Switch to Captain Mode' : '⛵ Switch to Kids Mode'}
            </button>
            <button class="close-btn" id="tp-close" aria-label="Close">✕</button>
          </div>
        </header>

        <div id="tutorial-market"></div>
        <section class="captain-bar">
          <div class="stat-pill gold-pill">
            <span class="stat-icon">🪙</span>
            <span class="stat-val">${captain.gold.toLocaleString()}</span>
            <span class="stat-label">${isKid ? 'gold coins' : 'gold'}</span>
          </div>
          <div class="stat-pill hold-pill">
            <span class="stat-icon">📦</span>
            <span class="stat-val">${holdUsed} / ${holdCap}</span>
            <span class="stat-label">${isKid ? `cargo (${freeCap} empty slots)` : `cargo (${freeCap} free)`}</span>
          </div>
          <div class="stat-pill ship-pill">
            <span class="stat-icon">⛵</span>
            <span class="stat-val">${currentShip.name}</span>
            <span class="stat-label">${isKid ? 'current boat' : `L${activeLevels.sails}·L${activeLevels.hold}·L${activeLevels.hull}`}</span>
          </div>
        </section>

        <nav class="trade-tabs">
          <button id="tp-tab-market" class="tab-btn ${this.tab === 'market' ? 'active' : ''}">
            ${isKid ? '⚖ Buy & Sell Goods' : '⚖ Market Commodities'}
          </button>
          <button id="tp-tab-shipyard" class="tab-btn ${this.tab === 'shipyard' ? 'active' : ''}">
            ${isKid ? '🛠 Ship Upgrades' : '🛠 Shipyard & Vessels'}
          </button>
        </nav>

        <main class="trade-content">
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
          <button id="tp-undock" class="primary undock-btn">${isKid ? '⛵ Back to Sailing!' : 'Return to Sea'}</button>
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
      const sellAllIncome = inHold > 0 ? quoteSell(market, good, inHold) : 0;

      let badgeText = 'Regular trade';
      let badgeClass = 'neutral';
      if (role === 'produces') {
        badgeText = '⭐ Cheap here!';
        badgeClass = 'produces';
      } else if (role === 'wants') {
        badgeText = '💰 High reward!';
        badgeClass = 'wants';
      }

      return `
        <article class="good-card kid-card ${role}">
          <div class="kid-good-head">
            <span class="kid-icon">${GOOD_ICONS[good]}</span>
            <div class="kid-title-block">
              <h4 class="kid-good-name">${def.name}</h4>
              <span class="role-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="kid-hold-count">
              <span class="count-label">In your hold:</span>
              <b class="count-val">${inHold}</b>
            </div>
          </div>

          <div class="kid-price-summary">
            <span>Buy: <b>${buyPrice} 🪙</b></span>
            <span>·</span>
            <span>Sell: <b>${sellPrice} 🪙</b></span>
          </div>

          <div class="kid-button-row">
            <button
              class="kid-act-btn buy-one"
              data-action="buy"
              data-good="${good}"
              data-qty="1"
              ${maxCanBuy < 1 ? 'disabled' : ''}
            >
              Buy 1 (${buyPrice} 🪙)
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
                Fill Hold (+${maxCanBuy} for ${fillHoldCost} 🪙)
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
              Sell 1 (+${sellPrice} 🪙)
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
                Sell All ${inHold} (+${sellAllIncome} 🪙)
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
            <span>🎁 You have cargo ready to sell!</span>
            <button id="tp-sell-all" class="sell-all-btn">
              🎉 Sell All Cargo (+${sellAllGold} 🪙)
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

      const nextBuy = quoteBuy(market, good, 1);
      const nextSell = quoteSell(market, good, 1);

      const costQuote = qty > 0 ? quoteBuy(market, good, qty) : 0;
      const sellQuote = qty > 0 ? quoteSell(market, good, qty) : 0;

      const canBuy = maxCanBuy >= qty && qty > 0;
      let buyDisabledReason = '';
      if (!canBuy) {
        if (stock === 0) buyDisabledReason = 'Out of stock';
        else if (free === 0) buyDisabledReason = 'Hold is full';
        else if (captain.gold < nextBuy) buyDisabledReason = 'Need more gold';
        else if (qty > stock) buyDisabledReason = `Only ${stock} in stock`;
        else if (qty > free) buyDisabledReason = `Only ${free} space left`;
        else buyDisabledReason = 'Cannot afford quantity';
      }

      const canSell = inHold >= qty && qty > 0;
      let sellDisabledReason = '';
      if (!canSell) {
        if (inHold === 0) sellDisabledReason = 'None in hold';
        else sellDisabledReason = `Only ${inHold} in hold`;
      }

      let roleBadge = '<span class="role-badge neutral">Standard trade</span>';
      if (role === 'produces') {
        roleBadge = '<span class="role-badge produces">Produces · Cheap</span>';
      } else if (role === 'wants') {
        roleBadge = '<span class="role-badge wants">Demanded · Dear</span>';
      }

      return `
        <article class="good-card adult-card ${role}">
          <div class="good-info">
            <div class="good-icon">${GOOD_ICONS[good]}</div>
            <div class="good-text">
              <div class="good-header">
                <h4 class="good-name">${def.name}</h4>
                ${roleBadge}
              </div>
              <div class="good-meta">
                <span>Stock: <b>${stock}</b></span>
                <span class="sep">·</span>
                <span>In Hold: <b>${inHold}</b></span>
              </div>
            </div>
          </div>

          <div class="good-prices">
            <div class="price-col">
              <span class="price-label">Buy 1st unit:</span>
              <span class="price-val">${nextBuy} 🪙</span>
            </div>
            <div class="price-col">
              <span class="price-label">Sell 1st unit:</span>
              <span class="price-val">${nextSell} 🪙</span>
            </div>
          </div>

          <div class="qty-control-area">
            <span class="qty-title">Quantity:</span>
            <div class="qty-stepper">
              <button class="qty-btn" data-good="${good}" data-delta="-1" aria-label="Decrease quantity">-</button>
              <span class="qty-display">${qty}</span>
              <button class="qty-btn" data-good="${good}" data-delta="1" aria-label="Increase quantity">+</button>
            </div>
            <div class="qty-quick-buttons">
              <button class="qty-quick" data-good="${good}" data-set="1">1</button>
              <button class="qty-quick" data-good="${good}" data-set="5">5</button>
              <button class="qty-quick" data-good="${good}" data-set="max">Max</button>
            </div>
          </div>

          <div class="quote-preview">
            <div class="quote-line">
              <span class="quote-mode">Buy ${qty}:</span>
              <span class="quote-total ${canBuy ? 'affordable' : 'unaffordable'}">${costQuote} 🪙</span>
              ${qty > 1 ? `<span class="quote-avg">(${(costQuote / qty).toFixed(1)}/ea)</span>` : ''}
            </div>
            <div class="quote-line">
              <span class="quote-mode">Sell ${qty}:</span>
              <span class="quote-total income">+${sellQuote} 🪙</span>
              ${qty > 1 ? `<span class="quote-avg">(${(sellQuote / qty).toFixed(1)}/ea)</span>` : ''}
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
              ${canBuy ? `Buy ${qty} for ${costQuote} 🪙` : buyDisabledReason}
            </button>
            <button
              class="trade-act-btn sell-btn"
              data-action="sell"
              data-good="${good}"
              data-qty="${qty}"
              ${!canSell ? 'disabled' : ''}
              title="${sellDisabledReason}"
            >
              ${canSell ? `Sell ${qty} for +${sellQuote} 🪙` : sellDisabledReason}
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
            <span>Cargo ready to sell:</span>
            <button id="tp-sell-all" class="sell-all-btn">
              Sell All Cargo for +${sellAllGold} 🪙
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
        title: '💨 Sail Faster!',
        desc: 'Makes your boat zoom through the water much quicker.',
        current: `Speed Level ${levels.sails}`,
      },
      {
        track: 'hold' as UpgradeTrack,
        title: '📦 Carry More Goods!',
        desc: 'Gives you extra room in your hold to carry more items.',
        current: `Hold Level ${levels.hold}`,
      },
      {
        track: 'hull' as UpgradeTrack,
        title: '🛡️ Tougher Boat!',
        desc: 'Adds a small speed boost. Toughness is reserved for future hazards.',
        current: `Hull Level ${levels.hull}`,
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
                ? `<button class="upgrade-btn maxed" disabled>⭐ Max Level!</button>`
                : canAfford
                  ? `<button class="upgrade-btn primary kid-btn" data-track="${track}">⭐ Upgrade (${nextPrice} Coins)</button>`
                  : `<button class="upgrade-btn" disabled>Needs ${nextPrice! - captain.gold} more coins</button>`
            }
          </div>
        </article>
      `;
      })
      .join('');

    return `
      <div class="shipyard-section kids-layout">
        <div class="section-title">
          <h3>Upgrade Your Boat!</h3>
        </div>
        <div class="upgrades-grid">
          ${upgradeCardsHtml}
        </div>

        <div class="section-title ships-title">
          <h3>Boat Fleet</h3>
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

      let name = 'Sails & Rigging';
      let icon = '⛵';
      let currentDesc = '';
      let nextDesc = '';

      if (track === 'sails') {
        name = 'Sails & Rigging';
        icon = '💨';
        if (currentLevel === 1) currentDesc = 'Standard mainsail & jib rig';
        else if (currentLevel === 2) currentDesc = '+8% speed, +15% accel, improved canvas';
        else currentDesc = '+16% speed, +30% accel, topsail & striped racing cloth';

        if (currentLevel === 1) nextDesc = 'Level 2: +8% speed, +15% acceleration, improved canvas';
        else if (currentLevel === 2)
          nextDesc = 'Level 3: +16% speed, +30% acceleration, topsail & striped cloth';
      } else if (track === 'hold') {
        name = 'Hold Capacity';
        icon = '📦';
        const c1 = holdCapacity(activeShipBase, { sails: 1, hold: 1, hull: 1 });
        const c2 = holdCapacity(activeShipBase, { sails: 1, hold: 2, hull: 1 });
        const c3 = holdCapacity(activeShipBase, { sails: 1, hold: 3, hull: 1 });

        if (currentLevel === 1) currentDesc = `Standard hold (${c1} units cargo)`;
        else if (currentLevel === 2)
          currentDesc = `Reinforced hold (${c2} units), crates & barrels on deck`;
        else currentDesc = `Expanded hold (${c3} units), full deck cargo stowage`;

        if (currentLevel === 1)
          nextDesc = `Level 2: +60% capacity (${c2} units) with deck crates and barrels`;
        else if (currentLevel === 2)
          nextDesc = `Level 3: +120% capacity (${c3} units) with heavy cargo stowage`;
      } else if (track === 'hull') {
        name = 'Hull & Framing';
        icon = '🛡';
        const d1 = hullDurability({ sails: 1, hold: 1, hull: 1 });
        const d2 = hullDurability({ sails: 1, hold: 1, hull: 2 });
        const d3 = hullDurability({ sails: 1, hold: 1, hull: 3 });

        if (currentLevel === 1) currentDesc = `Stock oak hull (${d1} durability)`;
        else if (currentLevel === 2)
          currentDesc = `+2% speed, ${d2} durability, reinforced timber strakes`;
        else currentDesc = `+4% speed, ${d3} durability, copper sheathing`;

        if (currentLevel === 1)
          nextDesc = `Level 2: +2% speed, ${d2} durability, reinforced timber`;
        else if (currentLevel === 2)
          nextDesc = `Level 3: +4% speed, ${d3} durability, copper sheathing`;
      }

      let buttonHtml: string;
      if (isMax) {
        buttonHtml = `<button class="upgrade-btn maxed" disabled>Max Level</button>`;
      } else if (canAfford) {
        buttonHtml = `<button class="upgrade-btn primary" data-track="${track}">Upgrade to L${currentLevel + 1} (${nextPrice} 🪙)</button>`;
      } else {
        const short = nextPrice! - captain.gold;
        buttonHtml = `<button class="upgrade-btn" disabled title="Need ${short} more gold">Upgrade L${currentLevel + 1} (${nextPrice} 🪙) · Need ${short}g</button>`;
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
                <span class="track-level-text">Level ${currentLevel} of ${MAX_UPGRADE_LEVEL}</span>
                <div class="track-pips">${pipsHtml}</div>
              </div>
            </div>
          </div>
          <div class="track-effects">
            <p class="current-effect">${currentDesc}</p>
            ${!isMax ? `<p class="next-effect"><b>Next:</b> ${nextDesc}</p>` : '<p class="max-note">Fully upgraded for this vessel.</p>'}
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
          <h3>Upgrades for active ${activeShipBase.name}</h3>
          <span class="muted small">Visual modifications appear on your vessel immediately</span>
        </div>
        <div class="upgrades-grid">
          ${tracksHtml}
        </div>

        <div class="section-title ships-title">
          <h3>Vessel Lineup</h3>
          <span class="muted small">Transfer your command between owned ships at any dock</span>
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

    let cutterButtonHtml: string;
    if (activeShipId === 'cutter') {
      cutterButtonHtml = `<span class="ship-badge active-badge">Currently Sailing</span>`;
    } else if (ownsCutter) {
      if (cutterFitsCargo) {
        cutterButtonHtml = `<button class="ship-btn primary" data-ship-switch="cutter">Switch to Cutter</button>`;
      } else {
        cutterButtonHtml = `<button class="ship-btn" disabled title="Cargo too large">Switch to Cutter (Cargo too large)</button>`;
      }
    } else {
      if (!cutterCanAfford) {
        cutterButtonHtml = `<button class="ship-btn" disabled title="Need ${CUTTER.price - captain.gold} more gold">Buy Cutter (${CUTTER.price.toLocaleString()} 🪙) · Need ${CUTTER.price - captain.gold}g</button>`;
      } else if (!cutterFitsCargo) {
        cutterButtonHtml = `<button class="ship-btn" disabled title="Cargo exceeds Cutter hold">Buy Cutter (${CUTTER.price.toLocaleString()} 🪙) · Cargo too big</button>`;
      } else {
        cutterButtonHtml = `<button class="ship-btn primary" data-ship-buy="cutter">Buy Cutter (${CUTTER.price.toLocaleString()} 🪙)</button>`;
      }
    }

    let sloopButtonHtml: string;
    if (activeShipId === 'sloop') {
      sloopButtonHtml = `<span class="ship-badge active-badge">Currently Sailing</span>`;
    } else {
      if (sloopFitsCargo) {
        sloopButtonHtml = `<button class="ship-btn primary" data-ship-switch="sloop">Switch to Sloop</button>`;
      } else {
        sloopButtonHtml = `<button class="ship-btn" disabled title="Cargo too large (${cargoNow}/${sloopCap})">Switch to Sloop (Cargo ${cargoNow}/${sloopCap})</button>`;
      }
    }

    return `
        <div class="ships-grid">
          <article class="ship-card adult-card ${activeShipId === 'sloop' ? 'active-ship' : ''}">
            <div class="ship-card-header">
              <h4>Sloop</h4>
              <span class="ship-role-tag">Starter Coastal Vessel</span>
            </div>
            <div class="ship-specs">
              <div>Hold: <b>${sloopCap} units</b></div>
              <div>Points: <b>45°</b> off wind</div>
              <div>Handling: <b>Agile & forgiving helm</b></div>
            </div>
            <div class="ship-action">
              ${sloopButtonHtml}
            </div>
          </article>

          <article class="ship-card adult-card ${activeShipId === 'cutter' ? 'active-ship' : ''}">
            <div class="ship-card-header">
              <h4>Cutter</h4>
              <span class="ship-role-tag">Merchant Fast Vessel</span>
            </div>
            <div class="ship-specs">
              <div>Hold: <b>${cutterCap} units</b> (base 16)</div>
              <div>Points: <b>40°</b> off wind (5° closer!)</div>
              <div>Speed: <b>+6% top speed</b>, heavier helm</div>
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
