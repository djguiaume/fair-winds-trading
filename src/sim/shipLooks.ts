import {
  APPEARANCE_SLOTS,
  type Appearance,
  type Catalogue,
  type Cosmetic,
  fitsClass,
  isFree,
  itemOf,
  stockAppearance,
} from './cosmetics';

/**
 * Each owned ship's own look (decision 0263): only the slots that differ from stock are kept, so a
 * ship never listed sails in the stock look and a save stays small. The ship id is the ship class
 * id, as for upgrades and damage. A catalogue item is never stored, only its stable id.
 */
export type ShipLooks = Record<string, Partial<Appearance>>;

/** Whether the captain may put this item on a ship. The default allows free items only. */
export type CanUse = (item: Cosmetic) => boolean;

const SLOT_KEYS = Object.keys(APPEARANCE_SLOTS) as (keyof Appearance)[];

/** Slots that may hold nothing; the others always wear an item. */
const CLEARABLE: ReadonlySet<keyof Appearance> = new Set(['sailLogo', 'figurehead', 'flag']);

/** The stored id of a slot is valid when it is `null` (a clearable slot) or fits the ship. */
function validId(
  cat: Catalogue,
  key: keyof Appearance,
  id: unknown,
  shipClass: string,
): id is string | null {
  if (id === null) return CLEARABLE.has(key);
  if (typeof id !== 'string') return false;
  const item = itemOf(cat, APPEARANCE_SLOTS[key], id);
  return !!item && fitsClass(item, shipClass);
}

/** One ship's stored look: unknown slots, unknown or unfit ids and stock values dropped. */
export function cleanLook(cat: Catalogue, raw: unknown, shipClass: string): Partial<Appearance> {
  const out: Record<string, string | null> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const stock = stockAppearance();
  const given = raw as Record<string, unknown>;
  for (const key of SLOT_KEYS) {
    const id = given[key];
    if (id !== undefined && id !== stock[key] && validId(cat, key, id, shipClass)) out[key] = id;
  }
  return out;
}

/**
 * The looks of a saved voyage: only owned ships keep one, and a bad entry just falls back to stock
 * so the voyage always loads (decision 0263).
 */
export function readLooks(cat: Catalogue, raw: unknown, owned: Iterable<string>): ShipLooks {
  const out: ShipLooks = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const given = raw as Record<string, unknown>;
  for (const ship of owned) {
    const look = cleanLook(cat, given[ship], ship);
    if (Object.keys(look).length) out[ship] = look;
  }
  return out;
}

/** The ship's look with every slot filled (stock where nothing is stored). */
export const lookOf = (looks: ShipLooks | undefined, ship: string): Appearance => ({
  ...stockAppearance(),
  ...(looks?.[ship] ?? {}),
});

/**
 * The "Boat looks" screen's working copy of one ship (decision 0263). Previewing changes only this
 * draft; `apply` writes it to the captain's looks in one go, `cancel` forgets it. Nothing here
 * reaches the save before `apply`, so a closed screen or a reload leaves the stored look as it was.
 */
export class LookDraft {
  private draft: Appearance;

  constructor(
    private readonly cat: Catalogue,
    private readonly looks: ShipLooks,
    readonly ship: string,
    private readonly canUse: CanUse = isFree,
  ) {
    this.draft = lookOf(looks, ship);
  }

  /** The look being tried, every slot filled. */
  get current(): Readonly<Appearance> {
    return this.draft;
  }

  /** Whether the draft differs from what the ship wears now. */
  get changed(): boolean {
    const saved = lookOf(this.looks, this.ship);
    return SLOT_KEYS.some((k) => saved[k] !== this.draft[k]);
  }

  /** Try an item (or `null` to clear a slot that can be empty). False, unchanged, when refused. */
  preview(key: keyof Appearance, id: string | null): boolean {
    if (!validId(this.cat, key, id, this.ship)) return false;
    if (id !== null && !this.canUse(itemOf(this.cat, APPEARANCE_SLOTS[key], id) as Cosmetic))
      return false;
    this.draft = { ...this.draft, [key]: id };
    return true;
  }

  /** Back to the stock look (still a draft until applied). */
  stock(): void {
    this.draft = stockAppearance();
  }

  /** Forget the draft and go back to what the ship wears now. */
  cancel(): void {
    this.draft = lookOf(this.looks, this.ship);
  }

  /** Commit the draft as the ship's look. Stock slots are not stored. */
  apply(): void {
    const look = cleanLook(this.cat, this.draft, this.ship);
    if (Object.keys(look).length) this.looks[this.ship] = look;
    else delete this.looks[this.ship];
  }
}

/** What a ship wears now, stock for a legacy save. */
export const shipLook = (captain: { looks?: ShipLooks }, ship: string): Appearance =>
  lookOf(captain.looks, ship);

/**
 * Commit a whole look for one ship, all or nothing: false, nothing written, when any slot names an
 * unknown, unfit or locked item. The screen's "Use" button calls this (or `LookDraft.apply`).
 */
export function setShipLook(
  captain: { looks?: ShipLooks },
  cat: Catalogue,
  ship: string,
  look: Appearance,
  canUse: CanUse = isFree,
): boolean {
  const looks = (captain.looks ??= {});
  const draft = new LookDraft(cat, looks, ship, canUse);
  for (const key of SLOT_KEYS) if (!draft.preview(key, look[key])) return false;
  draft.apply();
  return true;
}
