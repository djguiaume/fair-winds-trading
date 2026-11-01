import {
  APPEARANCE_SLOTS,
  type Appearance,
  type Catalogue,
  resolveAppearance,
  stockAppearance,
} from '../../sim/cosmetics';
import type { UnlockProgress } from '../../sim/cosmeticUnlocks';
import { FLAGS, type FlagDef } from '../../sim/regatta';
import { BoatPreview, SLOT_VIEWS } from '../../render/boatPreview';
import { boatLookOf } from '../../render/models/boatLook';
import type { ShipUpgrades } from '../../render/models';
import type { QualityLevel } from '../../render/quality';
import { t } from '../../i18n';
import { guardSoftDisabled } from '../padFocus';
import { type Choice, type SlotKey, SLOT_ORDER, canUse, slotChoices } from './choices';
import {
  type Compare,
  choicePicture,
  detailHtml,
  gridHtml,
  shellHtml,
  shipLineHtml,
  shipsHtml,
  slotRowsHtml,
} from './view';
import './boatLooks.css';
import './boatLooksSmall.css';

/**
 * The Boat looks screen (issue #299, docs/v1.4/customisation.md): dress each owned ship. A tap
 * tries an item on the turntable boat (locked ones too, so the player sees what to earn); Use
 * keeps it for that slot; leaving puts back what she had. Purely cosmetic: nothing here touches
 * sailing, prices or unlocks. The game behind it is reached through `BoatLooksHost` only.
 */
export interface OwnedShip {
  id: string;
  upgrades: ShipUpgrades;
  /** The model's damage step (decision 0208): only the ship being sailed can be hurt. */
  damage: 0 | 1 | 2 | 3;
}

export interface BoatLooksHost {
  catalogue: Catalogue;
  /** The captain's ships, the one she sails first. */
  ships(): OwnedShip[];
  /** What a ship wears now. */
  look(shipId: string): Appearance;
  /** Keeps a whole look for a ship (saved, and shown at sea); false when it was refused. */
  use(shipId: string, look: Appearance): boolean;
  progress(): UnlockProgress;
  /** The flag she flies when no flag is chosen: the latest regatta pennant won, if any. */
  autoFlag(shipId: string): FlagDef | undefined;
  quality(): QualityLevel;
  /** The game's light when the screen opens: night (>0.5) starts the preview at night. */
  night(): boolean;
}

const COMPARE_LEVELS: Record<Exclude<Compare, 'yours'>, ShipUpgrades> = {
  stock: { sails: 1, hold: 1, hull: 1 },
  all: { sails: 3, hold: 3, hull: 3 },
};
const FIGUREHEAD_PX = 96;

export class BoatLooksScreen {
  readonly root: HTMLDialogElement;
  private preview: BoatPreview | null = null;
  private ship!: OwnedShip;
  private slot: SlotKey = 'sailColour';
  private applied!: Appearance;
  private tried!: Appearance;
  private compare: Compare = 'yours';
  private night = false;
  private returnFocus: HTMLElement | null = null;
  private readonly figureheads = new Map<string, string>();
  private readonly onResize = () => this.preview?.resize();

  constructor(private readonly host: BoatLooksHost) {
    // A modal dialog: the top layer, a focus trap, and the pad's focus finds it (padScreen).
    this.root = document.createElement('dialog');
    this.root.className = 'boat-looks';
    this.root.setAttribute('aria-labelledby', 'bl-title');
    document.body.append(this.root);
    this.root.addEventListener('click', (e) => this.click(e));
    this.root.addEventListener('keydown', (e) => this.key(e));
    this.root.addEventListener('close', () => this.cleanUp());
    // Esc and the pad's B: leave through `close`, which frees the preview.
    this.root.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.close();
    });
    guardSoftDisabled(this.root);
  }

  get isOpen() {
    return this.root.open;
  }

  /** Opens on a ship (default: the one she sails), its first slot, by day or night as at sea. */
  open(shipId?: string) {
    if (this.isOpen) return;
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.root.innerHTML = shellHtml();
    this.root.showModal();
    this.night = this.host.night();
    this.compare = 'yours';
    const canvas = this.root.querySelector<HTMLCanvasElement>('.bl-canvas')!;
    this.preview = new BoatPreview(canvas, this.host.quality());
    this.preview.setNight(this.night);
    this.slot = 'sailColour';
    this.selectShip(shipId ?? this.host.ships()[0]!.id);
    this.showSlot(this.slot, true);
    this.preview.resize();
    this.preview.start();
    addEventListener('resize', this.onResize);
    this.root.querySelector<HTMLElement>('.bl-slot[aria-selected="true"]')?.focus();
  }

  /** Leaves without keeping what was only tried on; frees the 3D preview. */
  close() {
    if (this.root.open) this.root.close();
    this.cleanUp();
  }

  /** Also when something else closes the dialog: the preview never outlives the screen. */
  private cleanUp() {
    if (!this.preview) return;
    removeEventListener('resize', this.onResize);
    this.preview.dispose();
    this.preview = null;
    this.figureheads.clear();
    this.root.innerHTML = '';
    this.returnFocus?.focus?.();
  }

  private selectShip(id: string) {
    this.ship = this.host.ships().find((s) => s.id === id) ?? this.host.ships()[0]!;
    this.applied = this.host.look(this.ship.id);
    this.tried = { ...this.applied };
    this.render();
  }

  private choices(slot: SlotKey): Choice[] {
    const { catalogue, progress } = this.host;
    return slotChoices(catalogue, slot, this.ship.id, progress(), this.tried, this.applied);
  }

  private render() {
    const $ = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
    const ships = this.host.ships().map((s) => s.id);
    $('.bl-ships').innerHTML = ships.length > 1 ? shipsHtml(ships, this.ship.id) : '';
    const picture = (slot: SlotKey, c: Choice) => this.picture(slot, c);
    const rows = SLOT_ORDER.map((slot) => ({
      slot,
      tried: this.choices(slot).find((c) => c.tried)!,
    }));
    $('.bl-slot-list').innerHTML = slotRowsHtml(rows, this.slot, picture);
    const choices = this.choices(this.slot);
    $('.bl-items-title').textContent = this.root.querySelector(
      `.bl-slot[data-slot="${this.slot}"] small`,
    )!.textContent;
    $('.bl-grid').innerHTML = gridHtml(this.slot, choices, picture);
    const tried = choices.find((c) => c.tried)!;
    const inUse = choices.find((c) => c.inUse) ?? tried;
    $('.bl-detail').innerHTML = detailHtml(tried, inUse, this.ship.id);
    $('.bl-ship-line').innerHTML = shipLineHtml(this.ship.id, this.levels());
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-compare]'))
      b.setAttribute('aria-pressed', String(b.dataset.compare === this.compare));
    const nightBtn = $('.bl-night');
    const nightLabel = this.night ? t('customise.day') : t('customise.night');
    nightBtn.textContent = this.night ? '☀' : '☾';
    nightBtn.title = nightLabel;
    nightBtn.setAttribute('aria-label', nightLabel);
    nightBtn.setAttribute('aria-pressed', String(this.night));
    this.root.toggleAttribute('data-night', this.night);
    const stage = $('.bl-stage');
    const backdrop = this.preview?.backdrop;
    if (backdrop) {
      stage.style.setProperty('--bl-sky', backdrop.sky);
      stage.style.setProperty('--bl-sea', backdrop.sea);
    }
    this.showBoat();
  }

  private levels(): ShipUpgrades {
    return this.compare === 'yours' ? this.ship.upgrades : COMPARE_LEVELS[this.compare];
  }

  /** The turntable boat in the tried-on look, at the compared upgrade levels. */
  private showBoat() {
    const { look } = resolveAppearance(this.host.catalogue, this.tried, this.ship.id, FLAGS);
    const flag = look.flag ?? this.host.autoFlag(this.ship.id);
    this.preview?.show({
      shipClass: this.ship.id,
      upgrades: this.levels(),
      damage: this.compare === 'yours' ? this.ship.damage : 0,
      look: boatLookOf(look),
      wake: look.wake,
      ...(flag ? { flag } : {}),
    });
  }

  private picture(slot: SlotKey, c: Choice): string {
    return choicePicture(this.host.catalogue, this.ship.id, this.tried, slot, c, (recipe) => {
      let url = this.figureheads.get(recipe);
      if (!url) {
        url = this.preview?.figureheadPicture(recipe, FIGUREHEAD_PX) ?? '';
        this.figureheads.set(recipe, url);
      }
      return url;
    });
  }

  private click(e: Event) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!el || el.getAttribute('aria-disabled') === 'true') return;
    const d = el.dataset;
    if (el.classList.contains('bl-close')) return this.close();
    if (d.ship) this.selectShip(d.ship);
    else if (d.slot) this.showSlot(d.slot as SlotKey);
    else if (d.item !== undefined) this.tried = { ...this.tried, [this.slot]: d.item || null };
    else if (d.compare) this.compare = d.compare as Compare;
    else if (d.turn) return this.preview?.turn(Number(d.turn));
    else if (el.classList.contains('bl-night')) {
      this.night = !this.night;
      this.preview?.setNight(this.night);
    } else if (el.classList.contains('bl-use')) this.useTried();
    else if (el.classList.contains('bl-stock')) this.tried = stockAppearance();
    else return;
    this.renderKeepingFocus(el);
  }

  /** A slot's items, and the turntable turned to where it shows (the bow for a figurehead). */
  private showSlot(slot: SlotKey, now?: boolean) {
    this.slot = slot;
    this.preview?.setView(SLOT_VIEWS[APPEARANCE_SLOTS[slot]] ?? 'whole', now);
  }

  /** Keeps the tried-on item of the current slot, if it may be used. */
  private useTried() {
    const tried = this.choices(this.slot).find((c) => c.tried);
    if (!tried || !canUse(tried)) return;
    const next = { ...this.applied, [this.slot]: this.tried[this.slot] };
    if (this.host.use(this.ship.id, next)) this.applied = next;
  }

  /** Redraws and puts the focus back on the same control (the pad and keyboard stay put). */
  private renderKeepingFocus(el: HTMLElement) {
    const keys = ['ship', 'slot', 'item', 'compare', 'turn'] as const;
    const key = keys.find((k) => el.dataset[k] !== undefined);
    const selector = key
      ? `[data-${key}="${el.dataset[key]}"]`
      : `.${[...el.classList].find((c) => c.startsWith('bl-'))}`;
    this.render();
    const again =
      this.root.querySelector<HTMLElement>(selector) ??
      this.root.querySelector<HTMLElement>('.bl-use, .bl-badge');
    again?.focus({ preventScroll: true });
  }

  /** Esc stays here (the port screen behind keeps its own); Q and E (or [ and ]) turn the boat. */
  private key(e: KeyboardEvent) {
    if (e.key === 'Escape') e.stopPropagation();
    else if (e.key === 'q' || e.key === '[') this.preview?.turn(-1);
    else if (e.key === 'e' || e.key === ']') this.preview?.turn(1);
  }
}
