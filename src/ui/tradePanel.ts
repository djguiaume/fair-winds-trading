import './harbour/harbour.css';
import type { GoodId } from '../sim/goods';
import { producesAt, wantsAt } from '../sim/settlement';
import { SHIP_CLASSES } from '../sim/ship';
import { homePort } from '../sim/shipyards';
import { capacity, cargoUsed, findPort } from '../sim/trade';
import type { World } from '../sim/world';
import type { PadButton } from '../input/gamepad';
import { formatNumber, t } from '../i18n';
import type { UiMode } from './settings';
import { guardSoftDisabled, softDisable } from './padFocus';
import { harbourAccent } from '../render/harbourView';
import { el } from './components/dom';
import { panel } from './components/panel';
import { button } from './components/button';
import { COIN } from './icons';
import type { QuayItem } from './questView';
import { character } from './portraits';
import { creditNote, questCargoNote } from './harbour/credit';
import { HarbourDeals } from './harbour/deals';
import { harbourFooter, type FooterFace } from './harbour/footer';
import { harbourHeader, portLine } from './harbour/header';
import { KeeperLines } from './harbour/keeper';
import { goodsLedger, tradedGoods } from './harbour/market';
import { goodDetail, type Lot } from './harbour/marketDetail';
import { openOrderCount } from './harbour/marketFacts';
import { firstOrder, orderDetail, ordersLedger } from './harbour/orders';
import { esc } from './harbour/parts';
import { quayPane } from './harbour/quay';
import { shipyardPane } from './harbour/shipyard';

export type TradePanelTab = 'market' | 'orders' | 'quay' | 'shipyard';

/**
 * The people of the harbour, on the Quay tab (decision 0141); see `quayItems` in `questView.ts`.
 * `seen` is told the fresh ones once the tab has shown them (the first of them speaks, decision
 * 0197); `act` the captain's answers.
 */
export interface PortQuay {
  items(): QuayItem[];
  seen(fresh: QuayItem[]): void;
  act(
    quest: string,
    act: 'accept' | 'later' | 'ignore' | 'choose' | 'again',
    option?: string,
  ): void;
  /** "Hand over" on a person's card (decision 0213): `n` of `good`, paid. */
  hand(quest: string, good: string, n: number): void;
}

/**
 * The harbour screen (decisions 0049, 0141, 0211; v1.5 issue #443): the port as a strip above one
 * paper ledger across about 90% of the width (Market, Orders, Quay), or the Shipyard's paper
 * beside the live boat. One header and footer on every tab; the panes live in `harbour/`.
 */
export class TradePanel {
  private tab: TradePanelTab = 'market';
  private returnFocus: HTMLElement | null = null;
  private lot: Lot = 1;
  /** What each pane shows on its right: a good, an order (by port), a person, a ship. */
  private picked: { good?: GoodId; order?: string; person?: string; ship?: string } = {};
  private readonly keeper: KeeperLines;
  private readonly deals: HarbourDeals;

  uiMode: UiMode = 'adult';
  onAction: () => void = () => {};
  onTrade: (kind: 'buy' | 'sell', good: GoodId | null) => void = () => {};
  onRender: () => void = () => {};
  onClose: () => void = () => {};
  /** The live boat beside the paper (the Shipyard) or not: the camera makes room for her. */
  onBoatSide: (beside: boolean) => void = () => {};
  /** Quest cargo aboard, a line each (decision 0213). */
  questCargo: () => string[] = () => [];
  /** The port's picture for the strip, from the game's renderer (decision 0211); null: none. */
  harbourPicture: (portId: string) => string | null = () => null;
  /** The Quay tab's people; none: no tab. */
  quay: PortQuay | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly world: World,
  ) {
    this.keeper = new KeeperLines(world);
    this.deals = new HarbourDeals(world, {
      onAction: () => this.onAction(),
      onTrade: (kind, good) => this.onTrade(kind, good),
      render: () => this.render(),
      isOpen: () => this.isOpen,
    });
    container.classList.add('hb-overlay');
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-modal', 'true');
    container.setAttribute('aria-label', t('trade.dialogLabel'));
    // The footer carries this screen's pad legend: no floating hints pill over Set sail (#433).
    container.dataset.padHints = 'off';
    container.tabIndex = -1;
    // Greyed buttons stay reachable by the pad and the keyboard, but do nothing (decision 0192).
    guardSoftDisabled(container);
    container.addEventListener('keydown', (e) => this.onKey(e));
    for (const type of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'wheel',
      'touchstart',
      'touchmove',
    ])
      container.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  }

  get isOpen(): boolean {
    return !this.container.hidden;
  }

  open(tab: TradePanelTab = 'market') {
    if (!this.isOpen) {
      this.returnFocus = document.activeElement as HTMLElement | null;
      this.picked = {};
    }
    this.deals.docked();
    this.keeper.dock();
    this.tab = tab;
    this.container.hidden = false;
    document.documentElement.dataset.screen = 'harbour';
    this.render();
    this.container.querySelector<HTMLButtonElement>('#tp-close')?.focus();
  }

  close() {
    this.container.hidden = true;
    delete document.documentElement.dataset.screen;
    this.onBoatSide(false);
    this.onClose();
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
  }

  /** Escape closes; Tab stays inside the screen. */
  private onKey(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    }
    if (e.key !== 'Tab') return;
    const buttons = [
      ...this.container.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    ];
    const first = buttons[0];
    const last = buttons.at(-1);
    const at = document.activeElement;
    if (!first) {
      e.preventDefault();
      this.container.focus();
    } else if (e.shiftKey && (at === first || at === this.container)) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  }

  render() {
    if (this.container.hidden) return;
    const focusKey = this.focusKey();
    const scroll = [...this.container.querySelectorAll('.hb-scroll')].map((s) => s.scrollTop);
    const { trade, map } = this.world;
    const port = trade.dockedAt ? findPort(map, trade.dockedAt) : null;
    const market = port ? trade.markets[port.id] : null;
    if (!port || !market) {
      const root = el('div', 'harbour hb-empty');
      root.append(el('p', 'hb-muted', t('trade.noMarket')));
      this.container.replaceChildren(root);
      return;
    }
    const people = this.quay?.items() ?? [];
    const fresh = people.filter((p) => p.fresh);
    if (!this.quay && this.tab === 'quay') this.tab = 'market';
    this.onBoatSide(this.tab === 'shipyard');

    const root = el('div', `harbour hb-tab-${this.tab}`);
    const picture = this.harbourPicture(port.id);
    if (picture) {
      const strip = el('div', 'hb-strip');
      strip.setAttribute('aria-hidden', 'true');
      strip.style.backgroundImage = `url('${picture}')`;
      root.append(strip);
    }
    const accent = harbourAccent(map, port.id);
    if (accent) root.style.setProperty('--port-accent', accent);

    const sheet = panel({ tag: 'div' });
    sheet.classList.add('hb-sheet');
    sheet.append(this.header(port.id, port.name, people), this.body(people));
    // The tutorial's coach mark lives in this host while the harbour is up.
    const coach = el('div', '');
    coach.id = 'tutorial-market';
    root.append(sheet, this.footer(fresh), coach);
    this.container.replaceChildren(root);
    softDisable(this.container);
    this.onRender();
    if (this.tab === 'quay' && fresh.length) this.quay?.seen(fresh);
    this.container.querySelectorAll('.hb-scroll').forEach((s, i) => (s.scrollTop = scroll[i] ?? 0));
    if (focusKey) {
      // A greyed button keeps the focus (decision 0192): the next A must not land on Close.
      const next = this.container.querySelector<HTMLElement>(focusKey);
      (next ?? this.container.querySelector<HTMLElement>('#tp-close'))?.focus({
        preventScroll: true,
      });
    }
  }

  /** How to find the focused control again after the redraw: its id, else its data attributes. */
  private focusKey(): string {
    const at = document.activeElement as HTMLElement | null;
    if (!at || !this.container.contains(at) || at === this.container) return '';
    if (at.id) return `#${at.id}`;
    return [...at.attributes]
      .filter((a) => a.name.startsWith('data-') && !['data-qty', 'data-pad-focus'].includes(a.name))
      .map((a) => `[${a.name}="${a.value}"]`)
      .join('');
  }

  private header(portId: string, name: string, people: readonly QuayItem[]): HTMLElement {
    const { trade, map } = this.world;
    const kids = this.uiMode === 'kids';
    const fresh = people.filter((p) => p.fresh).length;
    const onDeck = trade.quests.hold ?? 0;
    return harbourHeader({
      title: name,
      line: portLine({
        home: portId === homePort(map).id,
        makes: producesAt(map, trade, portId),
        wants: wantsAt(map, trade, portId),
        shipwright: !findPort(map, portId)!.produces.length,
      }),
      tabs: [
        { id: 'market', label: t(kids ? 'kids.tabMarket' : 'trade.tabMarket') },
        { id: 'orders', label: t('trade.tabOrders'), badge: openOrderCount(this.world) },
        ...(this.quay
          ? [
              {
                id: 'quay',
                label: t('trade.tabQuay'),
                badge: this.tab === 'quay' ? 0 : fresh,
                quay: true,
              },
            ]
          : []),
        { id: 'shipyard', label: t(kids ? 'kids.tabShipyard' : 'trade.tabShipyard') },
      ],
      selected: this.tab,
      wallet: {
        gold: trade.captain.gold,
        used: cargoUsed(trade),
        cap: capacity(trade),
        deck:
          onDeck > 0
            ? { used: onDeck, cap: SHIP_CLASSES[trade.captain.activeShip]!.deck }
            : undefined,
      },
      onSelect: (id) => this.show(id as TradePanelTab),
      onClose: () => this.close(),
    });
  }

  private show(tab: TradePanelTab) {
    this.tab = tab;
    this.render();
  }

  private pick(kind: keyof TradePanel['picked'], key: string) {
    this.picked[kind] = key as GoodId;
    this.render();
  }

  private body(people: readonly QuayItem[]): HTMLElement {
    const world = this.world;
    const market = world.trade.markets[world.trade.dockedAt!]!;
    const pane = (...parts: HTMLElement[]) => {
      const p = el('section', `hb-pane hb-${this.tab}`);
      p.append(...parts);
      return p;
    };
    let body: HTMLElement;
    if (this.tab === 'orders') {
      const at = this.picked.order ?? firstOrder(world);
      body = pane(
        ordersLedger(world, at, (id) => this.pick('order', id)),
        ...(at ? [orderDetail(world, at, () => this.deals.deliver())] : []),
      );
    } else if (this.tab === 'quay') {
      const at = this.picked.person ?? people[0]?.key ?? null;
      body = quayPane(
        world,
        people,
        at,
        (k) => this.pick('person', k),
        this.harbourPicture(world.trade.dockedAt!),
      );
      body.addEventListener('click', (e) => this.quayAnswer(e));
    } else if (this.tab === 'shipyard') {
      body = shipyardPane(world, this.picked.ship ?? null, {
        upgrade: (track) => this.deals.upgrade(track),
        ship: (kind, id) => {
          // The table shows the next ship to act on again after a purchase or a change.
          this.picked.ship = undefined;
          this.deals.ship(kind, id);
        },
        pick: (id) => this.pick('ship', id),
      });
    } else {
      const goods = tradedGoods(market);
      const good = goods.find((g) => g === this.picked.good) ?? goods[0];
      const extras = [
        creditNote(world, this.deals.creditLater, (take) => this.deals.credit(take)),
        questCargoNote(this.questCargo()),
      ].filter((n): n is HTMLElement => n !== null);
      body = pane(
        goodsLedger(world, market, good ?? null, (g) => this.pick('good', g)),
        ...(good
          ? [
              goodDetail(
                world,
                market,
                good,
                {
                  lot: this.lot,
                  setLot: (lot) => ((this.lot = lot), this.render()),
                  trade: (kind, g, qty) => this.deals.trade(kind, g, qty),
                  deliver: () => this.deals.deliver(),
                },
                extras,
              ),
            ]
          : []),
      );
    }
    for (const list of body.querySelectorAll<HTMLElement>(
      '.hb-list, .hb-detail, .hb-yard-main, .hb-fleet',
    ))
      list.classList.add('hb-scroll');
    return body;
  }

  private footer(fresh: readonly QuayItem[]): HTMLElement {
    const kids = this.uiMode === 'kids';
    const extras: HTMLElement[] = [];
    const repair = this.deals.repairButton();
    if (repair) extras.push(repair);
    const sellable = this.deals.sellAllValue();
    if (sellable > 0 && this.tab === 'market') {
      const b = button({
        label: t('trade.sellAll', { price: formatNumber(sellable) }),
        onPress: () => this.deals.sellEverything(),
      });
      b.id = 'tp-sell-all';
      b.insertAdjacentHTML('beforeend', COIN);
      extras.push(b);
    }
    return harbourFooter({
      face: this.footerFace(fresh),
      status: this.deals.message,
      legend: this.legend(),
      extras,
      sailLabel: t(kids ? 'kids.undock' : 'trade.undock'),
      onSail: () => this.close(),
    });
  }

  /** Someone new on the quay who would like a word, else the harbour keeper with this docking's line. */
  private footerFace(fresh: readonly QuayItem[]): FooterFace | undefined {
    const first = fresh[0]?.card;
    if (first && this.tab !== 'quay') {
      const name = esc(first.giver?.name ?? first.arc);
      // Dock news says itself (decision 0213): "Done! +100 gold." after the timber sold.
      const html = first.news
        ? `<b>${name}</b> · ${esc(first.news)}`
        : t('trade.quayHint', { name });
      return {
        who: first.giver,
        mood: first.mood,
        look: first.look,
        html,
        go: () => this.show('quay'),
      };
    }
    const port = findPort(this.world.map, this.world.trade.dockedAt!)!;
    const line = this.keeper.line(port.id);
    const who = port.keeper ? character(port.keeper) : undefined;
    if (!line || !who) return undefined;
    return { who, html: `<b>${esc(who.name)}</b> <i class="hb-face-line">${esc(line)}</i>` };
  }

  /** The pad's buttons on this tab, as the footer shows them. */
  private legend(): [PadButton, string][] {
    const close: [PadButton, string] = ['b', t('trade.close')];
    if (this.tab === 'market') return [['a', t('trade.buy')], ['x', t('trade.sell')], close];
    return [['a', t('pad.choose')], close];
  }

  /** A person's answer on the Quay card: the quest engine moves on, goods handed over are paid. */
  private quayAnswer(e: Event) {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    const { act, quest, good, n, option } = b.dataset;
    if (act === 'hand') this.quay?.hand(quest!, good!, Number(n));
    else this.quay?.act(quest!, act as 'accept', option);
    this.picked.person = undefined;
    this.render();
  }
}
