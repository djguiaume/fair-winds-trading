import { RING } from '../../audio/catalog';
import { SEA_SECTORS } from '../../data/grownMap';
import { formatJson } from '../../data/jsonFormat';
import { PALETTE, PROP_RECIPES } from '../../data/props';
import { QUALITY_LEVELS } from '../../render/quality';
import { SEA_LIFE, type SeaLifeData } from '../../sim/seaLife';
import { seaLifeProblems } from '../../sim/seaLifeChecks';

/**
 * `src/data/sea-life.json` as the editors' Sea life page and `npm run life` edit it (issue
 * #476, decision 0153): one module for the fields, the edits, the checks and the file text, so
 * the page and the command can never disagree.
 */
export type SeaLifeDoc = SeaLifeData;

/** Where the page keeps its working copy in this browser. */
export const EDITED_LIFE_KEY = 'fwt-editor-sea-life';
export const LIFE_FILE = 'src/data/sea-life.json';

export const shippedLifeDoc = (): SeaLifeDoc => structuredClone(SEA_LIFE);

/** The sea ids a creature may live in: the ring and each grown sea. */
export const LIFE_SEAS = [RING, ...Object.keys(SEA_SECTORS)];

export const lifeProblems = (doc: SeaLifeDoc) =>
  seaLifeProblems(doc, {
    levels: QUALITY_LEVELS,
    seas: LIFE_SEAS,
    recipes: Object.keys(PROP_RECIPES),
    colors: Object.keys(PALETTE.colors),
  });

export const lifeText = (doc: SeaLifeDoc) => formatJson(doc);

/** How a field is typed: a number, a [low, high] pair, a word, or a list of words. */
export type FieldKind = 'number' | 'span' | 'text' | 'list';

/** Every field of the file, dotted (`birds.gull.count`), with its kind, in the file's order. */
export function lifeFields(doc: SeaLifeDoc): { path: string; kind: FieldKind }[] {
  const out: { path: string; kind: FieldKind }[] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'number') out.push({ path, kind: 'number' });
    else if (typeof value === 'string') out.push({ path, kind: 'text' });
    else if (Array.isArray(value))
      out.push({ path, kind: value.every((v) => typeof v === 'number') ? 'span' : 'list' });
    else if (value && typeof value === 'object')
      for (const [key, v] of Object.entries(value)) walk(v, path ? `${path}.${key}` : key);
  };
  walk(doc, '');
  return out;
}

/** The object holding a dotted path's last key, or null. */
function holder(doc: SeaLifeDoc, path: string): [Record<string, unknown>, string] | null {
  const keys = path.split('.');
  const last = keys.pop()!;
  let at: unknown = doc;
  for (const key of keys) at = (at as Record<string, unknown> | undefined)?.[key];
  return at && typeof at === 'object' && last in at ? [at as Record<string, unknown>, last] : null;
}

/** A field's value as text: numbers as typed, pairs and lists with commas. */
export function lifeField(doc: SeaLifeDoc, path: string): string {
  const found = holder(doc, path);
  if (!found) return '';
  const value = found[0][found[1]];
  return Array.isArray(value) ? value.join(', ') : String(value);
}

/** Sets one field from text (the page's inputs, `npm run life -- set`); a problem or null. */
export function setLifeField(doc: SeaLifeDoc, path: string, text: string): string | null {
  const field = lifeFields(doc).find((f) => f.path === path);
  const found = holder(doc, path);
  if (!field || !found) return `unknown field ${path} (npm run life -- list shows them)`;
  const parts = text.split(',').map((p) => p.trim());
  let value: unknown = text.trim();
  if (field.kind === 'number') value = Number(text);
  if (field.kind === 'span') value = parts.map(Number);
  if (field.kind === 'list') value = parts.filter(Boolean);
  if (field.kind === 'number' && !Number.isFinite(value)) return `${path} needs a number`;
  if (field.kind === 'span' && (parts.length !== 2 || !(value as number[]).every(Number.isFinite)))
    return `${path} needs two numbers, "low, high"`;
  found[0][found[1]] = value;
  return null;
}

/** A new bird kind, a copy of `from` (default the first kind), or a problem. */
export function addBird(doc: SeaLifeDoc, id: string, from?: string): string | null {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) return 'an id is lower-case letters, digits and -';
  if (doc.birds[id]) return `${id} already exists`;
  const source = from ? doc.birds[from] : Object.values(doc.birds)[0];
  if (!source) return `no bird kind ${from} to copy`;
  doc.birds[id] = structuredClone(source);
  return null;
}

export function removeBird(doc: SeaLifeDoc, id: string): boolean {
  if (!doc.birds[id]) return false;
  delete doc.birds[id];
  return true;
}

/** A working copy read back from the browser: only the shape, the checks say the rest. */
export function isLifeDoc(raw: unknown): raw is SeaLifeDoc {
  const doc = raw as SeaLifeDoc | null;
  return !!doc && typeof doc.birds === 'object' && !!doc.dolphins && !!doc.whale && !!doc.shoals;
}
