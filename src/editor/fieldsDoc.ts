/*
 * Dotted fields of a small JSON data file (`birds.gull.count`), as the editors' data pages and
 * their `npm run` tools read and set them (decision 0153): the sea life and the town folk share
 * this, so a page and its command can never disagree on what a field is.
 */

/** How a field is typed: a number, a [low, high] pair, more numbers, a word, or a list of words. */
export type FieldKind = 'number' | 'span' | 'numbers' | 'text' | 'list';

/** Every field of a document, dotted, with its kind, in the file's order. */
export function docFields(doc: object): { path: string; kind: FieldKind }[] {
  const out: { path: string; kind: FieldKind }[] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'number') out.push({ path, kind: 'number' });
    else if (typeof value === 'string') out.push({ path, kind: 'text' });
    else if (Array.isArray(value)) {
      const numbers = value.every((v) => typeof v === 'number');
      out.push({ path, kind: numbers ? (value.length === 2 ? 'span' : 'numbers') : 'list' });
    } else if (value && typeof value === 'object')
      for (const [key, v] of Object.entries(value)) walk(v, path ? `${path}.${key}` : key);
  };
  walk(doc, '');
  return out;
}

/** The object holding a dotted path's last key, or null. */
function holder(doc: object, path: string): [Record<string, unknown>, string] | null {
  const keys = path.split('.');
  const last = keys.pop()!;
  let at: unknown = doc;
  for (const key of keys) at = (at as Record<string, unknown> | undefined)?.[key];
  return at && typeof at === 'object' && last in at ? [at as Record<string, unknown>, last] : null;
}

/** A field's value as text: numbers as typed, pairs and lists with commas. */
export function docField(doc: object, path: string): string {
  const found = holder(doc, path);
  if (!found) return '';
  const value = found[0][found[1]];
  return Array.isArray(value) ? value.join(', ') : String(value);
}

/** Sets one field from text (a page's inputs, a tool's `set`); a problem or null. */
export function setDocField(doc: object, path: string, text: string, tool: string): string | null {
  const field = docFields(doc).find((f) => f.path === path);
  const found = holder(doc, path);
  if (!field || !found) return `unknown field ${path} (npm run ${tool} -- list shows them)`;
  const parts = text.split(',').map((p) => p.trim());
  let value: unknown = text.trim();
  if (field.kind === 'number') value = Number(text);
  if (field.kind === 'span' || field.kind === 'numbers') value = parts.map(Number);
  if (field.kind === 'list') value = parts.filter(Boolean);
  if (field.kind === 'number' && !Number.isFinite(value)) return `${path} needs a number`;
  if (field.kind === 'numbers' && !(value as number[]).every(Number.isFinite))
    return `${path} needs numbers, "a, b, c"`;
  if (field.kind === 'span' && (parts.length !== 2 || !(value as number[]).every(Number.isFinite)))
    return `${path} needs two numbers, "low, high"`;
  found[0][found[1]] = value;
  return null;
}

/** A new entry of a record (`birds`, `kinds`), a copy of `from` (default the first), or a problem. */
export function addEntry<T>(record: Record<string, T>, what: string, id: string, from?: string) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) return 'an id is lower-case letters, digits and -';
  if (record[id]) return `${id} already exists`;
  const source = from ? record[from] : Object.values(record)[0];
  if (!source) return `no ${what} ${from} to copy`;
  record[id] = structuredClone(source);
  return null;
}

export function removeEntry(record: Record<string, unknown>, id: string): boolean {
  if (!record[id]) return false;
  delete record[id];
  return true;
}

/**
 * What a data page and its tool share about one file: where it is, the shipped document, its
 * text, its checks, and the record of kinds the + and Remove buttons (`add-kind`) work on.
 */
export interface FieldsDoc<Doc extends object> {
  /** `npm run <tool>`. */
  tool: string;
  file: string;
  /** The page's working copy in this browser. */
  storageKey: string;
  /** What the file is about, one line. */
  about: string;
  shipped(): Doc;
  isDoc(raw: unknown): raw is Doc;
  text(doc: Doc): string;
  problems(doc: Doc): string[];
  /** The record of kinds that can be added and removed (`birds`), and what one is called. */
  kinds: { key: string; name: string };
  /** The page's sections, in order: the kinds, then the other top-level fields. */
  sections(doc: Doc): string[];
  /** What each section is about, by its first key. */
  sectionAbout: Record<string, string>;
  /** A line under every section: what the names in it may be. */
  names: string;
}

export const kindsOf = <Doc extends object>(spec: FieldsDoc<Doc>, doc: Doc) =>
  (doc as unknown as Record<string, Record<string, unknown>>)[spec.kinds.key] ?? {};

export function addKind<Doc extends object>(
  spec: FieldsDoc<Doc>,
  doc: Doc,
  id: string,
  from?: string,
) {
  return addEntry(kindsOf(spec, doc), spec.kinds.name, id, from);
}

export function removeKind<Doc extends object>(spec: FieldsDoc<Doc>, doc: Doc, id: string) {
  return removeEntry(kindsOf(spec, doc), id);
}
