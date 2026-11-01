import { SHIPPED_CATALOGUE, cosmeticContext } from '../../data/cosmetics';
import { formatJson } from '../../data/jsonFormat';
import { cosmeticProblems } from '../../sim/cosmeticChecks';
import { type Catalogue, type Item, RULES, SLOTS, type Slot } from '../../sim/cosmetics';

/**
 * The cosmetic catalogue as the Cosmetics page and `npm run cosmetics` edit it (decision 0261).
 * Pure, so the page, the command and the tests share the same templates, edits, checks and
 * files. An item is a JSON file in `src/data/cosmetics/<slot>/`; a logo's SVG sits beside it.
 */
export type CosmeticsDoc = Catalogue;

/** Where the page keeps its working copy in this browser. */
export const EDITED_COSMETICS_KEY = 'fwt-editor-cosmetics';

export const shippedCosmeticsDoc = (): CosmeticsDoc => structuredClone(SHIPPED_CATALOGUE);

/** Every problem: the same checks as the game's tests and `npm run check`. */
export const cosmeticsProblems = (doc: CosmeticsDoc) => cosmeticProblems(doc, cosmeticContext());

export const SLOT_FOLDERS: readonly (Slot | 'set')[] = [...SLOTS, 'set'];

/** The file an item is written to, relative to `src/data/cosmetics`. */
export const itemPath = (item: Pick<Item, 'slot' | 'id'>) => `${item.slot}/${item.id}.json`;
export const itemText = (item: Item) => formatJson(item);

/** Every file of the catalogue as (path, text), the way it is committed. */
export function catalogueFiles(doc: CosmeticsDoc): { path: string; text: string }[] {
  return [
    ...doc.items.map((i) => ({ path: itemPath(i), text: itemText(i) })),
    ...Object.entries(doc.logos).map(([id, svg]) => ({ path: `sail-logo/${id}.svg`, text: svg })),
  ];
}

const SVG_TEMPLATE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#000000"><circle cx="16" cy="16" r="9"/></svg>\n`;

/** A new item of a slot that passes every check until it is edited (a free, plain starting point). */
export function newItem(slot: Slot | 'set', id: string): Item {
  const base = { id, name: { en: id, fr: id }, unlock: { kind: 'free' as const } };
  switch (slot) {
    case 'sail-colour':
      return { ...base, slot, cloth: '#fbf6e8' };
    case 'sail-pattern':
      return { ...base, slot, pattern: 'bands', colours: ['#2f6f9f', '#f4f1e8'] };
    case 'sail-logo':
      return { ...base, slot, colour: '#1f4e79' };
    case 'hull-colour':
      return { ...base, slot, band: '#2f6f9f', strake: '#b9a58a' };
    case 'figurehead':
      return { ...base, slot, mount: RULES.mounts[0]!, recipe: '', tris: 40, size: 1 };
    case 'flag':
      return {
        ...base,
        slot,
        own: { shape: 'pennant', bands: ['#2f6f9f'], length: 1.2, height: 0.5 },
      };
    case 'wake':
      return { ...base, slot, style: 'foam', tint: null };
    default:
      return { ...base, slot: 'set', items: {} };
  }
}

export const find = (doc: CosmeticsDoc, slot: string, id: string) =>
  doc.items.find((i) => i.slot === slot && i.id === id);

/** Adds an item (and a starter emblem for a logo); returns it, or a problem when the id is taken. */
export function addItem(doc: CosmeticsDoc, slot: Slot | 'set', id: string): Item | string {
  if (find(doc, slot, id)) return `${slot}/${id} already exists`;
  const item = newItem(slot, id);
  doc.items.push(item);
  if (slot === 'sail-logo') doc.logos[id] = SVG_TEMPLATE;
  return item;
}

export function removeItem(doc: CosmeticsDoc, slot: string, id: string): boolean {
  const n = doc.items.length;
  doc.items = doc.items.filter((i) => !(i.slot === slot && i.id === id));
  if (slot === 'sail-logo') delete doc.logos[id];
  return doc.items.length < n;
}

/**
 * Sets one field of an item by its path (`cloth`, `name.fr`, `own.bands`, `unlock.quest`), read
 * as the kind the field already holds: a number, a list ("#aaa,#bbb"), `null`/`-` or words. A
 * field the item does not hold yet is set from the text as it is (`unlock.quest`). Returns a
 * problem, or null when set.
 */
export function setField(item: Item, path: string, text: string): string | null {
  const keys = path.split('.');
  let at = item as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) {
    if (at[k] === undefined) at[k] = {};
    const next = at[k];
    if (!next || typeof next !== 'object' || Array.isArray(next)) return `no "${path}"`;
    at = next as Record<string, unknown>;
  }
  const key = keys[keys.length - 1]!;
  if (['id', 'slot'].includes(path)) return `${path} cannot change; add a new item`;
  const was = at[key];
  if (text === '-') {
    if (['unlock', 'name'].includes(path)) return `${path} cannot be removed`;
    if (was === undefined) return `no "${path}" to clear`;
    if (path.startsWith('unlock.') || path === 'classes') delete at[key];
    else at[key] = null;
  } else if (typeof was === 'number') {
    const n = Number(text);
    if (!Number.isFinite(n)) return `${path}: a number`;
    at[key] = n;
  } else if (Array.isArray(was) || key === 'classes' || key === 'bands' || key === 'colours')
    at[key] = text.split(',').filter(Boolean);
  else if (key === 'kind') {
    at[key] = text;
    if (text === 'free') for (const k of Object.keys(at)) if (k !== 'kind') delete at[k];
  } else at[key] = text;
  return null;
}

/** The catalogue as one file for the page's Export and `cosmetics export`/`import`. */
export const bundleText = (doc: CosmeticsDoc) => formatJson({ items: doc.items, logos: doc.logos });

export function isBundle(v: unknown): v is CosmeticsDoc {
  const d = v as CosmeticsDoc | null;
  return (
    !!d &&
    typeof d === 'object' &&
    Array.isArray(d.items) &&
    d.items.every((i) => typeof i?.id === 'string' && typeof i?.slot === 'string') &&
    typeof d.logos === 'object' &&
    d.logos !== null &&
    Object.values(d.logos).every((s) => typeof s === 'string')
  );
}

/** Puts a bundle's items into the catalogue, replacing items with the same slot and id. */
export function importBundle(doc: CosmeticsDoc, text: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return `not JSON: ${(e as Error).message}`;
  }
  if (!isBundle(parsed)) return 'not a cosmetics bundle: { "items": [...], "logos": { id: svg } }';
  for (const item of parsed.items) {
    if (!SLOT_FOLDERS.includes(item.slot)) return `unknown slot "${item.slot}" in ${item.id}`;
    doc.items = doc.items.filter((i) => !(i.slot === item.slot && i.id === item.id));
    doc.items.push(item);
  }
  Object.assign(doc.logos, parsed.logos);
  return null;
}
