import { repairPrice, repairHull, hullDamage, repairsAtHome } from '../sim/hazards';
import { type BuildingDef, BUILDINGS, buildOnSpot } from '../sim/home';
import type { World } from '../sim/world';
import { t } from '../i18n';
import { storageRoom, storeGoods, storedTotal, takeGoods } from '../sim/storage';
import { capacity, cargoUsed } from '../sim/trade';
import { button } from './components/button';
import { el } from './components/dom';
import { panel } from './components/panel';
import { harbourFooter } from './harbour/footer';
import { harbourHeader } from './harbour/header';
import { coins } from './harbour/parts';
import {
  type PlotGiver,
  type PlotRow,
  islandLine,
  plotDetail,
  plotRows,
  plotsLedger,
} from './harbour/plots';
import { type StoreMove, warehousePane } from './harbour/warehouse';
import { softDisable } from './padFocus';

export { buildingName, effectLine, type PlotGiver } from './harbour/plots';

type Tab = 'island' | 'warehouse';

/**
 * One of the captain's islands at its pier (decisions 0126, 0128, 0210), on the harbour's paper
 * since v1.5 (issue #443): the same header, ledger and footer as a port. The Island tab lists
 * every plot (the ones to build first, then who will give the others) with the picked one beside;
 * the Warehouse tab (0136) keeps crates. Choosing a plot moves the paper aside and turns the
 * camera to it, where its stakes stand (`onChosen`), with its two buildings to build. Set sail
 * closes the screen; the button at the top of the sea HUD opens it again while she is moored.
 */
export class HomePanel {
  private readonly screen: HTMLElement;
  private readonly bar: HTMLButtonElement;
  private tab: Tab = 'island';
  private chosenSpot: string | null = null;
  /** The plot shown beside the list (not chosen yet). */
  private pickedSpot: string | undefined;
  private shown = false;
  /** The island moored at. */
  private islandId: string | null = null;

  /** After a building goes up or the hull is repaired: redraw and save. */
  onBuilt: (building: BuildingDef) => void = () => {};
  onRepaired: (gold: number) => void = () => {};
  /** Opened or closed: pause or not. */
  onChange: () => void = () => {};
  /** After crates moved between the hold and the warehouse: save. */
  onStored: () => void = () => {};
  /** A plot chosen (the camera turns to it and its ring shows) or let go (null). */
  onChosen: (island: string, spot: string | null) => void = () => {};
  /** Who gives a plot, from the quests. */
  giverOf: (island: string, spot: string) => PlotGiver | undefined = () => undefined;

  constructor(
    root: HTMLElement,
    private readonly world: World,
  ) {
    this.bar = document.createElement('button');
    this.bar.className = 'home-bar';
    this.bar.hidden = true;
    this.bar.addEventListener('click', () => this.open());
    this.screen = el('div', 'trade-panel-overlay hb-overlay home-screen');
    this.screen.setAttribute('role', 'dialog');
    this.screen.setAttribute('aria-modal', 'true');
    this.screen.dataset.padHints = 'off';
    this.screen.hidden = true;
    root.append(this.bar, this.screen);
  }

  get isOpen() {
    return this.shown;
  }

  /** The plot chosen on the Island tab, for the island's look (its ring). */
  get chosen(): { island: string; spot: string } | null {
    return this.shown && this.islandId && this.chosenSpot
      ? { island: this.islandId, spot: this.chosenSpot }
      : null;
  }

  private get island() {
    return this.world.map.islands.find((i) => i.id === this.islandId);
  }

  /** Every frame: follow where she is moored. Leaving closes the screen. */
  update() {
    const docked = this.world.trade.home.docked ?? null;
    if (docked !== this.islandId) {
      this.close();
      this.islandId = docked;
    }
    const name = this.island?.name ?? this.islandId ?? '';
    this.bar.hidden = !docked || this.shown;
    if (docked && this.bar.dataset.name !== name) {
      this.bar.dataset.name = name;
      this.bar.textContent = t('home.open', { name });
    }
  }

  /** The harbour screen, on the Island tab; with a plot, that plot chosen. */
  open(spot?: string) {
    if (!this.islandId) this.islandId = this.world.trade.home.docked ?? null;
    if (!this.islandId) return;
    this.shown = true;
    this.screen.hidden = false;
    document.documentElement.dataset.screen = 'home';
    this.tab = 'island';
    this.pickedSpot = undefined;
    if (spot && this.rows().some((r) => r.spot === spot && r.open)) this.choose(spot);
    else if (this.chosenSpot) this.choose(null);
    else this.render();
    this.onChange();
  }

  close() {
    if (!this.shown) return;
    const had = this.chosenSpot;
    this.shown = false;
    this.chosenSpot = null;
    this.screen.hidden = true;
    this.screen.replaceChildren();
    delete document.documentElement.dataset.screen;
    if (had && this.islandId) this.onChosen(this.islandId, null);
    this.onChange();
  }

  /** Back from a chosen plot to every plot (B on a controller, Esc). */
  back() {
    if (this.chosenSpot) this.choose(null);
    else this.close();
  }

  private choose(spot: string | null) {
    if (spot) this.pickedSpot = spot;
    this.chosenSpot = spot;
    this.render();
    if (this.islandId) this.onChosen(this.islandId, spot);
  }

  private rows(): PlotRow[] {
    return plotRows(this.world, this.islandId!, this.giverOf);
  }

  /** Redraw the screen. */
  render() {
    const island = this.island;
    if (!this.shown || !island) return;
    const { trade } = this.world;
    const again = this.focusKey();
    const rows = this.rows();
    const toBuild = rows.filter((r) => r.open).length;
    const warehouse = storageRoom(trade) > 0 || storedTotal(trade) > 0;
    if (this.tab === 'warehouse' && !warehouse) this.tab = 'island';
    const chosen = this.tab === 'island' ? this.chosenSpot : null;

    const head = harbourHeader({
      title: island.name ?? island.id,
      line: islandLine(toBuild),
      tabs: [
        { id: 'island', label: t('home.tabIsland'), badge: toBuild, quay: true },
        ...(warehouse ? [{ id: 'warehouse', label: t('home.tabWarehouse') }] : []),
      ],
      selected: this.tab,
      wallet: { gold: trade.captain.gold, used: cargoUsed(trade), cap: capacity(trade) },
      onSelect: (id) => this.show(id as Tab),
      onClose: () => this.close(),
      ids: 'home',
    });
    head.querySelector('#home-close')!.classList.add('home-close');
    const body =
      this.tab === 'warehouse' ? warehousePane(this.world, this.store) : this.plots(rows, chosen);
    const sheet = panel({ tag: 'div' });
    sheet.classList.add('hb-sheet');
    sheet.append(head, body);
    const root = el('div', `harbour hb-home${chosen ? ' is-half' : ''}`);
    root.append(sheet, this.footer(!!chosen));
    this.screen.classList.toggle('is-half', !!chosen);
    this.screen.replaceChildren(root);
    softDisable(this.screen);
    this.refocus(again);
  }

  /**
   * The focus after a redraw: the same plot row or tab when it is still there (the pad stays put),
   * else the first Build button when choosing, else the way to see the plot, else Close.
   */
  private refocus(again: string | undefined) {
    const order = [again, '[data-build]:not([aria-disabled])', '[data-choose]', '#home-close'];
    for (const selector of order) {
      const target = selector && this.screen.querySelector<HTMLElement>(selector);
      if (target) return target.focus({ preventScroll: true });
    }
  }

  /** How to find the focused control again: its id, else its plot row. */
  private focusKey(): string | undefined {
    const now = document.activeElement as HTMLElement | null;
    if (!now || !this.screen.contains(now)) return undefined;
    if (now.id) return `#${now.id}`;
    return now.dataset.pick ? `[data-pick="${now.dataset.pick}"]` : undefined;
  }

  private show(tab: Tab) {
    this.tab = tab;
    if (this.chosenSpot) this.choose(null);
    else this.render();
  }

  /** The Island tab: every plot and the picked one beside it; chosen, that plot alone. */
  private plots(rows: readonly PlotRow[], chosen: string | null): HTMLElement {
    const pane = el('div', 'hb-pane hb-island');
    if (!rows.some((r) => r.open || r.built) && !rows.some((r) => r.giver)) {
      pane.append(el('p', 'hb-muted home-empty', t('home.empty')));
      return pane;
    }
    const picked = rows.find((r) => r.spot === (chosen ?? this.pickedSpot)) ?? rows[0]!;
    const act = {
      choose: (spot: string) => this.choose(spot),
      build: (id: string) => this.build(id),
    };
    if (!chosen) {
      const pick = (spot: string) => {
        this.pickedSpot = spot;
        this.render();
      };
      pane.append(plotsLedger(rows, picked.spot, pick));
    }
    pane.append(plotDetail(this.world, this.islandId!, picked, !!chosen, act));
    return pane;
  }

  private footer(chosen: boolean): HTMLElement {
    const extras: HTMLElement[] = [];
    if (chosen)
      extras.push(button({ label: t('home.allPlots'), onPress: () => this.choose(null) }));
    const { trade } = this.world;
    if (repairsAtHome(trade) && hullDamage(trade) > 0) {
      const repair = button({
        label: t('home.repair'),
        icon: 'hull',
        disabled: trade.captain.gold < 1,
        onPress: () => this.repair(),
      });
      repair.dataset.repair = '';
      repair.insertAdjacentHTML(
        'beforeend',
        `<span class="hb-price">${coins(repairPrice(trade))}</span>`,
      );
      extras.push(repair);
    }
    return harbourFooter({
      status: '',
      legend: [
        ['a', t('pad.choose')],
        ['b', t(chosen ? 'ui.back' : 'home.close')],
      ],
      extras,
      sailLabel: t('trade.undock'),
      onSail: () => this.close(),
      ids: 'home',
    });
  }

  private repair() {
    const r = repairHull(this.world.trade);
    if (r.ok) this.onRepaired(r.gold);
    this.render();
  }

  private readonly store: StoreMove = (dir, good, n) => {
    const { trade } = this.world;
    if (dir === 'in') storeGoods(trade, good, n);
    else takeGoods(trade, good, n);
    this.render();
    this.onStored();
  };

  private build(buildingId: string) {
    const building = BUILDINGS.find((b) => b.id === buildingId);
    if (!this.islandId || !this.chosenSpot || !building) return;
    const r = buildOnSpot(
      this.world.trade,
      this.world.map,
      this.chosenSpot,
      buildingId,
      this.islandId,
    );
    if (!r.ok) return;
    this.choose(null);
    this.onBuilt(building);
  }
}
