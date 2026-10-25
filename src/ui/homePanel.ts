import { repairPrice, repairHull, hullDamage, repairsAtHome } from '../sim/hazards';
import {
  type BuildingDef,
  BUILDINGS,
  buildChoices,
  buildOnSpot,
  homeSpots,
  islandHome,
} from '../sim/home';
import type { World } from '../sim/world';
import { type MessageKey, formatNumber, goodName, t } from '../i18n';
import { GOODS, type GoodId } from '../sim/goods';
import { storageRoom, storeGoods, storedGoods, storedTotal, takeGoods } from '../sim/storage';
import { buildingPerks } from '../sim/perks';
import { COIN, icon } from './icons';

/** A building's perks in the player's words, one sentence each (decisions 0126, 0136). */
export function effectLine(b: BuildingDef): string {
  return buildingPerks(b.id)
    .map((p) =>
      t(`perk.${p.id}` as MessageKey, {
        pct: Math.round(Math.abs(1 - (p.multiply ?? 1)) * 100),
        n: p.add ?? 0,
      }),
    )
    .join(' ');
}

export const buildingName = (b: BuildingDef) => t(`building.${b.id}` as MessageKey);
const buildingA = (b: BuildingDef) => t(`building.${b.id}.a` as MessageKey);
const kindOf = (b: BuildingDef) =>
  t(`hook.${buildingPerks(b.id)[0]?.hook ?? 'repairPrice'}` as MessageKey);

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Who gives a plot (the arc's giver and port), for its name and its line. */
export interface PlotGiver {
  name: string;
  port: string;
}

type Tab = 'island' | 'warehouse';

/** One plot as the Island tab lists it. */
interface PlotRow {
  spot: string;
  n: number;
  /** Something to build now: free (an arc's plot) or for gold (a spare). */
  open: boolean;
  built?: BuildingDef;
  giver?: PlotGiver;
  pair: BuildingDef[];
}

/**
 * One of the captain's islands at its pier (decisions 0126, 0128, 0210): a harbour screen like a
 * port's, with an Island tab (every plot: the ones to build first, then who will give the others)
 * and a Warehouse tab (0136). Choosing a plot halves the screen and turns the camera to it, where
 * its stakes stand (`onChosen`), with its two buildings beside. Set sail closes the screen; the
 * button at the top of the sea HUD opens it again while she is moored.
 */
export class HomePanel {
  private readonly screen: HTMLElement;
  private readonly bar: HTMLButtonElement;
  private tab: Tab = 'island';
  private chosenSpot: string | null = null;
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
    this.screen = document.createElement('div');
    this.screen.className = 'trade-panel-overlay home-screen';
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
    this.tab = 'island';
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
    this.screen.innerHTML = '';
    document.body.classList.remove('home-half');
    if (had && this.islandId) this.onChosen(this.islandId, null);
    this.onChange();
  }

  /** Back from a chosen plot to every plot (B on a controller, Esc). */
  back() {
    if (this.chosenSpot) this.choose(null);
    else this.close();
  }

  private choose(spot: string | null) {
    this.chosenSpot = spot;
    document.body.classList.toggle('home-half', !!spot);
    this.render();
    if (this.islandId) this.onChosen(this.islandId, spot);
  }

  /** The plots: the ones to build first, then in number order. */
  private rows(): PlotRow[] {
    const { trade, map } = this.world;
    const island = this.islandId!;
    const home = islandHome(trade.home, island);
    const rows = homeSpots(map, island).map((spot, i): PlotRow => {
      const built = home.built[spot.id];
      return {
        spot: spot.id,
        n: i + 1,
        open: buildChoices(trade, map, spot.id, island).length > 0,
        built: built ? BUILDINGS.find((b) => b.id === built) : undefined,
        giver: spot.pair ? this.giverOf(island, spot.id) : undefined,
        pair: spot.pair ? BUILDINGS.filter((b) => b.pair === spot.pair) : [],
      };
    });
    // A spare plot shows only while it has something to offer or stands built.
    const shown = rows.filter((r) => r.pair.length || r.open || r.built);
    return [...shown.filter((r) => r.open), ...shown.filter((r) => !r.open)];
  }

  private title(r: PlotRow) {
    // A plot still to be given has no name yet (the storyteller's rule, 0210).
    if (!r.giver || !r.pair.length || !(r.open || r.built)) return t('home.plotN', { n: r.n });
    return t(/^[aeiouyàâéèêëîïôûüœæ]/i.test(r.giver.name) ? 'home.plotOfVowel' : 'home.plotOf', {
      name: r.giver.name,
    });
  }

  private rowHtml(r: PlotRow, chosen: boolean) {
    const [a, b] = r.pair;
    const free = r.open && r.pair.length > 0;
    const tag = r.built
      ? `${t('home.builtTag')} · ${buildingName(r.built)}`
      : r.open
        ? t(free ? 'home.stakedFree' : 'home.stakedGold')
        : '';
    const line = r.built
      ? effectLine(r.built)
      : !r.pair.length
        ? t('home.spare')
        : r.open && r.giver
          ? t('home.fromGiver', { ...r.giver })
          : r.giver
            ? t('home.willStake', { ...r.giver, a: buildingA(a!), b: buildingA(b!) })
            : t('home.someone', { a: buildingA(a!), b: buildingA(b!) });
    const state = r.built ? 'is-built' : r.open ? 'is-open' : 'is-locked';
    const choices = chosen
      ? `<div class="home-choices">${buildChoices(
          this.world.trade,
          this.world.map,
          r.spot,
          this.islandId!,
        )
          .map(({ building, price }) => {
            const short = price > this.world.trade.captain.gold;
            const label = short
              ? t('home.notEnoughGold')
              : price
                ? `${t('home.build')} · ${formatNumber(price)}${COIN}`
                : t('home.buildFree');
            return `<div class="home-choice"><span class="home-kind">${esc(kindOf(building))}</span><b>${esc(buildingName(building))}</b><p>${esc(effectLine(building))}</p><button class="port-btn brass" data-build="${building.id}" ${short ? 'disabled' : ''}>${icon('anchor')}${label}</button></div>`;
          })
          .join('')}</div>`
      : r.open
        ? `<button class="port-btn brass home-see" data-choose="${r.spot}">${esc(t('home.choosePlot'))}</button>`
        : '';
    return `<article class="home-plot ${state}${chosen ? ' is-chosen' : ''}"><span class="home-num">${r.n}</span>
      <h3>${esc(this.title(r))}${tag ? ` <small>${esc(tag)}</small>` : ''}</h3><p class="home-line">${esc(line)}</p>${choices}</article>`;
  }

  /** Redraw the screen. */
  render() {
    const { trade } = this.world;
    const island = this.island;
    if (!this.shown || !island) return;
    const rows = this.rows();
    const toBuild = rows.filter((r) => r.open).length;
    const room = storageRoom(trade);
    const warehouse = room > 0 || storedTotal(trade) > 0;
    if (this.tab === 'warehouse' && !warehouse) this.tab = 'island';
    const chosen = this.tab === 'island' && this.chosenSpot;
    this.screen.classList.toggle('is-half', !!chosen);
    const tabBtn = (tab: Tab, label: string, badge = '') =>
      `<button class="tab-btn ${this.tab === tab ? 'active' : ''}" data-tab="${tab}" aria-pressed="${this.tab === tab}">${esc(label)}${badge}</button>`;
    let body: string;
    if (this.tab === 'warehouse') body = this.warehouseHtml();
    else if (chosen)
      body = rows
        .filter((r) => r.spot === chosen)
        .map((r) => this.rowHtml(r, true))
        .join('');
    else if (!rows.some((r) => r.open || r.built) && !rows.some((r) => r.giver))
      body = `<p class="muted home-empty">${esc(t('home.empty'))}</p>`;
    else body = rows.map((r) => this.rowHtml(r, false)).join('');
    const repair =
      repairsAtHome(trade) && hullDamage(trade) > 0
        ? `<button class="port-btn red" data-repair ${trade.captain.gold < 1 ? 'disabled' : ''}>${icon('hull')}${esc(t('home.repair'))} · ${formatNumber(repairPrice(trade))}${COIN}</button>`
        : '';
    this.screen.innerHTML = `<div class="trade-modal port-screen captain-view" role="dialog" aria-modal="true">
      <header class="trade-header"><div class="port-title-area"><h2 class="port-name">${esc(island.name ?? island.id)}</h2>
        <div class="port-roles-summary"><span class="role-tag home">${icon('anchor')}${esc(t('home.yourIsland'))}</span>${
          toBuild
            ? `<span class="role-tag">${esc(toBuild === 1 ? t('home.toBuildOne') : t('home.toBuildMany', { n: toBuild }))}</span>`
            : ''
        }</div></div>
        <div class="header-controls"><span class="port-chip" title="${esc(t('hud.gold'))}">${COIN}<b>${formatNumber(trade.captain.gold)}</b></span>
        <button class="close-btn home-close" aria-label="${esc(t('home.close'))}">✕</button></div></header>
      <nav class="trade-tabs">${tabBtn('island', t('home.tabIsland'), toBuild ? ` <span class="tab-badge is-quay">${toBuild}</span>` : '')}${
        warehouse ? tabBtn('warehouse', t('home.tabWarehouse')) : ''
      }</nav>
      <main class="trade-content home-content"><div class="home-plots">${body}</div></main>
      <footer class="trade-footer">${chosen ? `<button class="port-btn home-all">${esc(t('home.allPlots'))}</button>` : ''}${repair}<span class="footer-gap"></span>
        <button class="port-btn brass undock-btn" data-pad-start="never">${icon('anchor')}${esc(t('trade.undock'))}</button></footer></div>`;
    this.listen();
  }

  private listen() {
    const s = this.screen;
    s.querySelector('.home-close')?.addEventListener('click', () => this.close());
    s.querySelector('.undock-btn')?.addEventListener('click', () => this.close());
    s.querySelector('.home-all')?.addEventListener('click', () => this.choose(null));
    for (const b of s.querySelectorAll<HTMLButtonElement>('[data-tab]'))
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab as Tab;
        if (this.chosenSpot) this.choose(null);
        else this.render();
      });
    for (const b of s.querySelectorAll<HTMLButtonElement>('[data-choose]'))
      b.addEventListener('click', () => this.choose(b.dataset.choose!));
    for (const b of s.querySelectorAll<HTMLButtonElement>('[data-build]'))
      b.addEventListener('click', () => this.build(b.dataset.build!));
    s.querySelector('[data-repair]')?.addEventListener('click', () => {
      const r = repairHull(this.world.trade);
      if (r.ok) this.onRepaired(r.gold);
      this.render();
    });
    for (const b of s.querySelectorAll<HTMLButtonElement>('[data-store]'))
      b.addEventListener('click', () => {
        const { trade } = this.world;
        const good = b.dataset.good as GoodId;
        const n = Number(b.dataset.n);
        if (b.dataset.store === 'in') storeGoods(trade, good, n);
        else takeGoods(trade, good, n);
        this.render();
        this.onStored();
      });
    // Choosing, the first Build button takes the focus (the controller's ring too).
    (s.querySelector('[data-build]:not(:disabled), [data-choose]') as HTMLElement | null)?.focus({
      preventScroll: true,
    });
  }

  /** The warehouse tab (decision 0136): each good aboard or kept, with buttons to store and take. */
  private warehouseHtml() {
    const { trade } = this.world;
    const room = storageRoom(trade);
    const kept = storedGoods(trade);
    const goods = GOODS.filter((g) => trade.captain.cargo[g] > 0 || (kept[g] ?? 0) > 0);
    const full = storedTotal(trade) >= room;
    const button = (label: string, good: GoodId, dir: 'in' | 'out', n: number, off: boolean) =>
      `<button class="port-btn small" data-store="${dir}" data-good="${good}" data-n="${n}" ${off ? 'disabled' : ''}>${esc(label)}</button>`;
    const rows = goods
      .map((good) => {
        const aboard = trade.captain.cargo[good];
        const here = kept[good] ?? 0;
        return `<div class="home-store-row"><div class="home-store-name">${esc(goodName(good))}</div>
          <div class="home-store-counts">${esc(`${t('home.aboard', { n: aboard })} · ${t('home.kept', { n: here })}`)}</div>
          ${button(t('home.store'), good, 'in', 1, !aboard || full)}${button(t('home.storeAll'), good, 'in', aboard, !aboard || full)}
          ${button(t('home.take'), good, 'out', 1, !here)}${button(t('home.takeAll'), good, 'out', here, !here)}</div>`;
      })
      .join('');
    return `<h3 class="home-store-title">${esc(t('home.warehouse', { n: storedTotal(trade), max: room }))}</h3>
      <div class="home-store">${rows}</div><p class="home-note">${esc(t(goods.length ? 'home.warehouseNote' : 'home.warehouseEmpty'))}</p>`;
  }

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
