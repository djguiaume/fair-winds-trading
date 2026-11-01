import rulesFile from '../data/cosmetics/rules.json';
import type { FlagDef } from './regatta';

/**
 * Boat cosmetics as data (decision 0261): one JSON file per item in `src/data/cosmetics/<slot>/`,
 * the slot rules in `rules.json`. Cosmetics are pride, never power: nothing here touches sailing.
 * This module is pure (no three.js): the types, the rules and the resolver the game, the editor
 * and `npm run cosmetics` share. The checks are in `cosmeticChecks.ts`.
 */

export const SLOTS = [
  'sail-colour',
  'sail-pattern',
  'sail-logo',
  'hull-colour',
  'figurehead',
  'flag',
  'wake',
] as const;
export type Slot = (typeof SLOTS)[number];

/** Free from the first day, or earned by a quest, a regatta series or a named milestone. */
export type Unlock =
  { kind: 'free' } | { kind: 'earned'; quest?: string; regatta?: string; milestone?: string };

/** What every item file holds; `classes` limits it to some ship classes (default: all). */
export interface ItemBase {
  /** Stable, stored in saves: never rename a shipped item. Matches the file name. */
  id: string;
  slot: Slot;
  name: { en: string; fr: string };
  unlock: Unlock;
  classes?: string[];
}

export interface SailColour extends ItemBase {
  slot: 'sail-colour';
  cloth: string;
}
export interface SailPattern extends ItemBase {
  slot: 'sail-pattern';
  pattern: string;
  /** The pattern colour, then the trim colour: as many as `rules.patterns` says. */
  colours: string[];
}
/** The emblem is the SVG file `<id>.svg` next to the JSON: flat filled shapes only. */
export interface SailLogo extends ItemBase {
  slot: 'sail-logo';
  colour: string;
}
/** `stock` carries neither colour: the class keeps its own hull and band. */
export interface HullColour extends ItemBase {
  slot: 'hull-colour';
  band?: string;
  strake?: string;
}
export interface Figurehead extends ItemBase {
  slot: 'figurehead';
  mount: string;
  /** The prop recipe in `src/data/props` that draws it. */
  recipe: string;
  /** Declared triangle count, at most `rules.maxTriangles.figurehead`. */
  tris: number;
  /** 1 = as the recipe is drawn, on a ship of the reference length. */
  size: number;
}
/** A personal flag draws itself (`own`); a regatta pennant points at `flags.json` (`ref`). */
export interface FlagItem extends ItemBase {
  slot: 'flag';
  own?: Omit<FlagDef, 'id'>;
  ref?: string;
}
export interface Wake extends ItemBase {
  slot: 'wake';
  style: string;
  tint: string | null;
}
export interface CosmeticSet extends Omit<ItemBase, 'slot' | 'classes'> {
  slot: 'set';
  items: Partial<Record<Slot, string>>;
}

export type Cosmetic =
  SailColour | SailPattern | SailLogo | HullColour | Figurehead | FlagItem | Wake;
export type Item = Cosmetic | CosmeticSet;

/** Every item and every emblem's SVG text, by logo id: what the data folder holds. */
export interface Catalogue {
  items: Item[];
  logos: Record<string, string>;
}

export interface Rules {
  stock: Record<Slot, string | null>;
  sail: {
    minLightness: number;
    reservedHues: { from: number; to: number; minSaturation: number }[];
  };
  patterns: Record<string, number>;
  wakeStyles: string[];
  flagBands: { min: number; max: number };
  maxTriangles: { 'sail-logo': number; figurehead: number };
  reservedColours: { name: string; hex: string; within: number }[];
  /** Colours at least this white on every channel are refused. */
  tooBright: string;
  /**
   * An emblem's width as a share of the sail's, its centre down the sail (0 head, 1 foot), and the
   * lightest colour it may take: a pale logo vanishes on the canvas, worst of all at night.
   */
  emblem: { width: number; centreV: number; maxLightness: number };
  /** A figurehead's longest reach as a share of the hull's length (times the item's `size`). */
  figurehead: { share: number };
  mounts: string[];
}
export const RULES = rulesFile as unknown as Rules;

/** One id per slot; a missing slot is the stock look. */
export type Appearance = {
  sailColour: string;
  sailPattern: string;
  sailLogo: string | null;
  hullColour: string;
  figurehead: string | null;
  flag: string | null;
  wake: string;
};

export const APPEARANCE_SLOTS: Record<keyof Appearance, Slot> = {
  sailColour: 'sail-colour',
  sailPattern: 'sail-pattern',
  sailLogo: 'sail-logo',
  hullColour: 'hull-colour',
  figurehead: 'figurehead',
  flag: 'flag',
  wake: 'wake',
};

/** The look with concrete values, ready to draw. `null` means the game's own default. */
export interface ResolvedLook {
  sail: {
    cloth: string;
    /** The stock canvas: the 3D sails keep each upgrade level's own canvas (decision 0259). */
    stockCloth: boolean;
    pattern: { kind: string; colours: string[] };
    logo: { id: string; svg: string; colour: string } | null;
  };
  /** `band: null` and `strake: null` keep the class's own band and the upgrade strakes. */
  hull: { band: string | null; strake: string | null };
  figurehead: { id: string; mount: string; recipe: string; size: number } | null;
  flag: FlagDef | null;
  wake: { style: string; tint: string | null };
}

export const stockAppearance = (): Appearance => ({
  sailColour: RULES.stock['sail-colour']!,
  sailPattern: RULES.stock['sail-pattern']!,
  sailLogo: RULES.stock['sail-logo'],
  hullColour: RULES.stock['hull-colour']!,
  figurehead: RULES.stock.figurehead,
  flag: RULES.stock.flag,
  wake: RULES.stock.wake!,
});

export const itemOf = (cat: Catalogue, slot: Slot | 'set', id: string): Item | undefined =>
  cat.items.find((i) => i.slot === slot && i.id === id);

/** An item fits a class when it names no classes or names this one. */
export const fitsClass = (item: Item, shipClass: string) =>
  item.slot === 'set' || !item.classes || item.classes.includes(shipClass);

export const isFree = (item: Item) => item.unlock.kind === 'free';

/** The item for an id in a slot, or why not: unknown or not for this class. */
function pick<S extends Slot>(
  cat: Catalogue,
  slot: S,
  id: string | null,
  shipClass: string,
  problems: string[],
): Extract<Cosmetic, { slot: S }> | undefined {
  if (id === null) return undefined;
  const item = itemOf(cat, slot, id);
  if (!item) problems.push(`${slot}: no item "${id}"`);
  else if (!fitsClass(item, shipClass)) problems.push(`${slot}: "${id}" does not fit ${shipClass}`);
  else return item as Extract<Cosmetic, { slot: S }>;
  return undefined;
}

/**
 * What a look means for a ship class: every slot read as its item, the stock item for a missing,
 * unknown or unfit one (with a problem listed, never a throw). Upgrade bands and strakes stay the
 * ship models' own: a pattern only replaces their colours, never their places.
 */
export function resolveAppearance(
  cat: Catalogue,
  want: Partial<Appearance>,
  shipClass: string,
  flags: readonly FlagDef[],
): { look: ResolvedLook; problems: string[] } {
  const problems: string[] = [];
  const a = { ...stockAppearance(), ...want };
  const stock = stockAppearance();
  const get = <S extends Slot>(slot: S, id: string | null, fallback: string | null) =>
    pick(cat, slot, id, shipClass, problems) ??
    (fallback === null
      ? undefined
      : (itemOf(cat, slot, fallback) as Extract<Cosmetic, { slot: S }>));
  const colour = get('sail-colour', a.sailColour, stock.sailColour);
  const pattern = get('sail-pattern', a.sailPattern, stock.sailPattern);
  const logoId = pick(cat, 'sail-logo', a.sailLogo, shipClass, problems);
  const hull = get('hull-colour', a.hullColour, stock.hullColour);
  const head = pick(cat, 'figurehead', a.figurehead, shipClass, problems);
  const flagItem = pick(cat, 'flag', a.flag, shipClass, problems);
  const wake = get('wake', a.wake, stock.wake);
  return {
    problems,
    look: {
      sail: {
        cloth: colour?.cloth ?? '#fbf6e8',
        stockCloth: !colour || colour.id === stock.sailColour,
        pattern: { kind: pattern?.pattern ?? 'plain', colours: pattern?.colours ?? [] },
        logo: logoId
          ? { id: logoId.id, svg: cat.logos[logoId.id] ?? '', colour: logoId.colour }
          : null,
      },
      hull: { band: hull?.band ?? null, strake: hull?.strake ?? null },
      figurehead: head
        ? { id: head.id, mount: head.mount, recipe: head.recipe, size: head.size }
        : null,
      flag: flagItem ? flagOf(flagItem, flags) : null,
      wake: { style: wake?.style ?? 'plain', tint: wake?.tint ?? null },
    },
  };
}

/** The flag an item flies: its own design, or the regatta pennant it points to. */
export function flagOf(item: FlagItem, flags: readonly FlagDef[]): FlagDef | null {
  if (item.own) return { id: item.id, ...item.own };
  return flags.find((f) => f.id === item.ref) ?? null;
}
