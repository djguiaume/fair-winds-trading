import type { ScreenPoint } from '../render/view';
import { repairPrice, repairHull, hullDamage, repairsAtHome } from '../sim/hazards';
import {
  type BuildingDef,
  buildChoices,
  buildOnSpot,
  homeSpots,
  islandHome,
  passedOver,
  spotPosition,
} from '../sim/home';
import type { World } from '../sim/world';
import { type MessageKey, goodName, t } from '../i18n';
import { GOODS, type GoodId } from '../sim/goods';
import { storageRoom, storeGoods, storedGoods, storedTotal, takeGoods } from '../sim/storage';
import { buildingPerks } from '../sim/perks';

/** `openSpot` while the warehouse card is open. */
const STORAGE = '#warehouse';

const COIN = '<svg class="icon coin" aria-hidden="true"><use href="#i-coin" /></svg>';

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

/**
 * One of the captain's islands at its pier (decisions 0120, 0126, 0128): its build spots as tap
 * targets over the 3D island, and a card with the choice of two buildings (side by side in landscape, a bottom
 * sheet in portrait). The sea HUD stays: raising the sails leaves, as in any harbour.
 */
export class HomePanel {
  private readonly layer: HTMLElement;
  private readonly card: HTMLElement;
  private readonly markers = new Map<string, HTMLButtonElement>();
  private readonly bar: HTMLElement;
  private openSpot: string | null = null;
  /** The island moored at, whose spots show. */
  private islandId: string | null = null;

  /** After a building goes up or the hull is repaired: redraw and save. */
  onBuilt: (building: BuildingDef) => void = () => {};
  onRepaired: (gold: number) => void = () => {};
  onChange: () => void = () => {};
  /** After crates moved between the hold and the warehouse: save. */
  onStored: () => void = () => {};

  constructor(
    root: HTMLElement,
    private readonly world: World,
  ) {
    this.layer = document.createElement('div');
    this.layer.className = 'home-layer';
    this.layer.hidden = true;
    this.bar = document.createElement('div');
    this.bar.className = 'home-bar';
    this.card = document.createElement('div');
    this.card.className = 'home-card';
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-modal', 'true');
    this.card.hidden = true;
    root.append(this.layer, this.bar, this.card);
    this.bar.hidden = true;
  }

  get isOpen() {
    return this.openSpot !== null;
  }

  private get island() {
    return this.world.map.islands.find((i) => i.id === this.islandId);
  }

  /** Every frame: show the spots while moored at one of her islands, over where they stand. */
  update(project: (x: number, y: number) => ScreenPoint) {
    const docked = this.world.trade.home.docked ?? null;
    if (docked !== this.islandId) {
      this.close();
      this.islandId = docked;
      this.layer.hidden = !docked;
      this.bar.hidden = !docked;
      if (docked) this.render();
    }
    const island = this.island;
    if (!island) return;
    for (const spot of homeSpots(this.world.map, island.id)) {
      const el = this.markers.get(spot.id);
      if (!el) continue;
      const at = spotPosition(island, spot);
      const p = project(at.x, at.y);
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      el.hidden = el.dataset.state === 'hidden' || !p.onScreen;
    }
  }

  /** Rebuild the markers and the bar from the home state. */
  render() {
    const { trade, map } = this.world;
    const island = this.island;
    if (!island) return;
    const home = islandHome(trade.home, island.id);
    this.layer.innerHTML = '';
    this.markers.clear();
    const spare = passedOver(trade.home, map, island.id).length > 0;
    homeSpots(map, island.id).forEach((spot, i) => {
      const b = document.createElement('button');
      b.className = 'home-spot';
      const offered = buildChoices(trade, map, spot.id, island.id).length > 0;
      const state = home.built[spot.id]
        ? 'hidden'
        : offered
          ? spot.pair
            ? 'offer'
            : 'spare'
          : spot.pair
            ? 'locked'
            : spare
              ? 'locked'
              : 'hidden';
      b.dataset.state = state;
      b.textContent = state === 'offer' || state === 'spare' ? '+' : String(i + 1);
      b.setAttribute('aria-label', t('home.spot', { n: i + 1 }));
      b.disabled = state === 'locked';
      // One "tap to build" is enough, on the first new spot.
      if (state === 'offer' && !this.layer.querySelector('.home-spot-tip')) {
        const tip = document.createElement('span');
        tip.className = 'home-spot-tip';
        tip.textContent = t('home.tapToBuild');
        b.append(tip);
      }
      b.addEventListener('click', () => this.open(spot.id));
      this.markers.set(spot.id, b);
      this.layer.append(b);
    });
    // The bar: whose island this is, and the workshop's repairs.
    this.bar.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'home-title';
    title.textContent = `⌂ ${t('home.title', { name: island.name ?? island.id })}`;
    this.bar.append(title);
    if (repairsAtHome(trade) && hullDamage(trade) > 0) {
      const repair = document.createElement('button');
      repair.className = 'port-btn';
      repair.innerHTML = `${t('home.repair')} · ${COIN} ${repairPrice(trade)}`;
      repair.disabled = trade.captain.gold < 1;
      repair.addEventListener('click', () => {
        const r = repairHull(trade);
        if (r.ok) this.onRepaired(r.gold);
        this.render();
      });
      this.bar.append(repair);
    }
    // The warehouse (decision 0136): crates kept here between voyages.
    const room = storageRoom(trade);
    if (room > 0 || storedTotal(trade) > 0) {
      const store = document.createElement('button');
      store.className = 'port-btn';
      store.textContent = t('home.warehouse', { n: storedTotal(trade), max: room });
      store.addEventListener('click', () => this.openStorage());
      this.bar.append(store);
    }
  }

  /** The warehouse card: each good aboard or kept, with buttons to store and take. */
  openStorage() {
    const { trade } = this.world;
    if (!this.islandId) return;
    this.openSpot = STORAGE;
    for (const el of this.markers.values()) el.classList.remove('selected');
    this.card.innerHTML = '';
    const room = storageRoom(trade);
    const head = this.head(t('home.warehouse', { n: storedTotal(trade), max: room }));
    const list = document.createElement('div');
    list.className = 'home-store';
    const kept = storedGoods(trade);
    const goods = GOODS.filter((g) => trade.captain.cargo[g] > 0 || (kept[g] ?? 0) > 0);
    const button = (text: string, disabled: boolean, run: () => void) => {
      const b = document.createElement('button');
      b.className = 'port-btn small';
      b.textContent = text;
      b.disabled = disabled;
      b.addEventListener('click', () => {
        run();
        this.render();
        this.openStorage();
        this.onStored();
      });
      return b;
    };
    const full = storedTotal(trade) >= room;
    for (const good of goods) {
      const row = document.createElement('div');
      row.className = 'home-store-row';
      const name = document.createElement('div');
      name.className = 'home-store-name';
      name.textContent = goodName(good as GoodId);
      const counts = document.createElement('div');
      counts.className = 'home-store-counts';
      counts.textContent = `${t('home.aboard', { n: trade.captain.cargo[good] })} · ${t('home.kept', { n: kept[good] ?? 0 })}`;
      const aboard = trade.captain.cargo[good];
      const here = kept[good] ?? 0;
      row.append(
        name,
        counts,
        button(t('home.store'), !aboard || full, () => storeGoods(trade, good, 1)),
        button(t('home.storeAll'), !aboard || full, () => storeGoods(trade, good, aboard)),
        button(t('home.take'), !here, () => takeGoods(trade, good, 1)),
        button(t('home.takeAll'), !here, () => takeGoods(trade, good, here)),
      );
      list.append(row);
    }
    const note = document.createElement('p');
    note.className = 'home-note';
    note.textContent = t(goods.length ? 'home.warehouseNote' : 'home.warehouseEmpty');
    this.card.append(head, list, note);
    this.card.hidden = false;
    this.onChange();
  }

  private head(text: string) {
    const head = document.createElement('div');
    head.className = 'home-card-head';
    const h = document.createElement('h2');
    h.textContent = text;
    const close = document.createElement('button');
    close.className = 'home-close';
    close.textContent = '✕';
    close.setAttribute('aria-label', t('home.close'));
    close.addEventListener('click', () => this.close());
    head.append(h, close);
    return head;
  }

  open(spotId: string) {
    const { trade, map } = this.world;
    if (!this.islandId) return;
    const choices = buildChoices(trade, map, spotId, this.islandId);
    if (!choices.length) return;
    const spots = homeSpots(map, this.islandId);
    const index = spots.findIndex((s) => s.id === spotId);
    const spare = !spots[index]!.pair;
    this.openSpot = spotId;
    for (const [id, el] of this.markers) el.classList.toggle('selected', id === spotId);
    this.card.innerHTML = '';
    const head = this.head(
      `${t('home.spot', { n: index + 1 })} · ${t(spare ? 'home.chooseSpare' : 'home.choose')}`,
    );
    const list = document.createElement('div');
    list.className = 'home-options';
    for (const { building, price } of choices) {
      const opt = document.createElement('div');
      opt.className = 'home-option';
      const kind = document.createElement('div');
      kind.className = 'home-kind';
      kind.textContent = t(
        `hook.${buildingPerks(building.id)[0]?.hook ?? 'repairPrice'}` as MessageKey,
      );
      const name = document.createElement('div');
      name.className = 'home-name';
      name.textContent = buildingName(building);
      const effect = document.createElement('p');
      effect.className = 'home-effect';
      effect.textContent = effectLine(building);
      const build = document.createElement('button');
      build.className = 'port-btn';
      const short = price > trade.captain.gold;
      build.disabled = short;
      build.innerHTML = short
        ? t('home.notEnoughGold')
        : price
          ? `${t('home.build')} · ${COIN} ${price}`
          : t('home.build');
      build.addEventListener('click', () => this.build(spotId, building));
      opt.append(kind, name, effect, build);
      list.append(opt);
    }
    const note = document.createElement('p');
    note.className = 'home-note';
    note.textContent = t(spare ? 'home.spareNote' : 'home.note');
    this.card.append(head, list, note);
    this.card.hidden = false;
    this.onChange();
    (list.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  close() {
    if (this.openSpot === null) return;
    this.openSpot = null;
    this.card.hidden = true;
    for (const el of this.markers.values()) el.classList.remove('selected');
    this.onChange();
  }

  private build(spotId: string, building: BuildingDef) {
    if (!this.islandId) return;
    const r = buildOnSpot(this.world.trade, this.world.map, spotId, building.id, this.islandId);
    if (!r.ok) return;
    this.close();
    this.render();
    this.onBuilt(building);
  }
}
