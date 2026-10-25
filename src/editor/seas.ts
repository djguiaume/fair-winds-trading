import type { SeaDef } from '../data/grownMap';
import { grownMap } from '../data/grownMap';
import type { MapDef } from '../sim/map';
import {
  type Selection,
  findArea,
  findCurrent,
  findEdge,
  findFleet,
  findIsland,
  findShape,
  findZone,
  portOn,
  waypointOf,
} from './model';
import { formatMapJson } from './model';

/**
 * The sea editor (decision 0161): the map editor on the whole Phase 4 sea, today's Windward Ring
 * with every sea file round it, as one map. Every island, reef, port, waypoint, mark, current and
 * zone carries the file it belongs to (`IN_SEA`), new ones go into the sea picked as the active
 * one, and the export splits the map back into `phase1-map.json`, `seas/grown.json` and one file
 * per sea, written like the repository's files. Pure data, so the tests drive it.
 */

/** The owner of the ring's own things: `src/data/phase1-map.json`. */
export const RING = 'ring';

/** The tag every listed thing carries in the editor: the sea file it belongs to. */
export const IN_SEA = 'inSea';

/**
 * The lists a sea file and the ring share, in the order a new sea file writes them. A sea file's
 * `chartAreas` (fog of war, decision 0156) are the merged map's `fog.areas`; the ring has none.
 */
export const SEA_LISTS = [
  'islands',
  'terrain',
  'ports',
  'course',
  'marks',
  'currents',
  'windZones',
  'chartAreas',
  'edges',
  'traffic',
] as const;
type ListKey = (typeof SEA_LISTS)[number];
const LIST_KEYS = new Set<string>(SEA_LISTS);

/** `seas/grown.json`: the sea's radius and the sea files in the order they open. */
export interface GrownDef {
  boundsRadius: number;
  seas: string[];
  [key: string]: unknown;
}

/** A file's own fields (everything but its lists) and the order its keys are written in. */
export interface FileHead {
  keys: string[];
  values: Record<string, unknown>;
}

/** What the sea editor keeps besides the merged map, so the files come back as they were. */
export interface SeaEditorState {
  ring: FileHead;
  /** One per sea file, in `grown.json` order; `values.id` is the file name. */
  seas: FileHead[];
  grown: GrownDef;
  /** The sea new things go into. */
  active: string;
}

/** The merged map the sea editor edits: a map the game can sail, plus `seaEditor`. */
export type SeaDoc = MapDef & { seaEditor: SeaEditorState };

type Tagged = { [IN_SEA]?: string };

/** The ring's own fields the grown sea replaces; the ring file keeps its own. */
const RING_OWN = new Set(['name', 'boundsRadius', 'compatibleSaveMaps', 'fog']);

/** One of the lists, in the merged map. */
function listOf(doc: MapDef, key: ListKey): Tagged[] | undefined {
  return (key === 'chartAreas' ? doc.fog?.areas : doc[key]) as Tagged[] | undefined;
}
function setList(doc: MapDef, key: ListKey, items: Tagged[]) {
  if (key === 'chartAreas') (doc.fog ??= { chartedRadius: 0, areas: [] }).areas = items as never;
  else (doc as unknown as Record<string, unknown>)[key] = items;
}

function head(file: object): FileHead {
  const values = Object.fromEntries(Object.entries(file).filter(([k]) => !LIST_KEYS.has(k)));
  return { keys: Object.keys(file), values: structuredClone(values) };
}

function tagged<T extends object>(file: T, owner: string): T {
  const copy = structuredClone(file) as Record<string, unknown>;
  for (const key of SEA_LISTS)
    for (const item of (copy[key] as Tagged[] | undefined) ?? []) item[IN_SEA] = owner;
  return copy as T;
}

/** Whether a stored draft is a sea editor document. */
export function isSeaDoc(raw: unknown): raw is SeaDoc {
  const doc = raw as SeaDoc | null;
  return (
    !!doc &&
    typeof doc === 'object' &&
    Array.isArray(doc.islands) &&
    Array.isArray(doc.seaEditor?.seas) &&
    typeof doc.seaEditor?.grown?.boundsRadius === 'number' &&
    Array.isArray(doc.seaEditor?.ring?.keys)
  );
}

/** The ring and its seas as one map to edit, every thing tagged with its file. */
export function mergeSeas(ring: MapDef, seas: readonly SeaDef[], grown: GrownDef): SeaDoc {
  const map = grownMap(
    tagged(ring, RING),
    seas.map((sea) => tagged(sea, sea.id)),
  );
  map.boundsRadius = grown.boundsRadius;
  if (map.fog && typeof grown.chartedRadius === 'number')
    map.fog.chartedRadius = grown.chartedRadius;
  return {
    ...map,
    seaEditor: {
      ring: head(ring),
      seas: seas.map(head),
      grown: structuredClone(grown),
      active: seas[seas.length - 1]?.id ?? RING,
    },
  };
}

/** The ids of the sea files, in the order they open. */
export function seaIds(doc: SeaDoc): string[] {
  return doc.seaEditor.seas.map((s) => s.values.id as string);
}

/** The sea's display name: the ring's or a sea file's `name`. */
export function seaName(doc: SeaDoc, owner: string): string {
  if (owner === RING) return 'Windward Ring';
  const sea = doc.seaEditor.seas.find((s) => s.values.id === owner);
  return (sea?.values.name as string | undefined) ?? owner;
}

/** The file a sea's things are written to, from the repository root. */
export function seaPath(owner: string): string {
  return owner === RING ? 'src/data/phase1-map.json' : `src/data/seas/${owner}.json`;
}

export const GROWN_PATH = 'src/data/seas/grown.json';

/** Tags everything new (added since the last edit) with the active sea. */
export function claimNew(doc: SeaDoc) {
  const { active } = doc.seaEditor;
  for (const key of SEA_LISTS) {
    // The ring is charted from the start: a chart area made there goes to the first sea.
    const owner = key === 'chartAreas' && active === RING ? seaIds(doc)[0] : active;
    for (const item of listOf(doc, key) ?? []) if (owner) item[IN_SEA] ??= owner;
  }
}

/** The sea a thing belongs to. */
export function ownerOf(item: object | undefined): string | undefined {
  return (item as Tagged | undefined)?.[IN_SEA];
}

/** The thing a selection points at, if it is one of the listed things. */
export function selected(doc: MapDef, sel: Selection): object | undefined {
  if (!sel) return;
  if (sel.kind === 'island') return findIsland(doc, sel.id);
  if (sel.kind === 'shape') return findShape(doc, sel.id);
  if (sel.kind === 'current') return findCurrent(doc, sel.id);
  if (sel.kind === 'zone') return findZone(doc, sel.id);
  if (sel.kind === 'waypoint') return doc.course[sel.index];
  if (sel.kind === 'mark') return doc.marks?.[sel.index];
  if (sel.kind === 'area') return findArea(doc, sel.id);
  if (sel.kind === 'edge') return findEdge(doc, sel.id);
  if (sel.kind === 'fleet') return findFleet(doc, sel.id);
}

/** Moves the selection into another sea file; an island takes its port and waypoint along. */
export function moveToSea(doc: SeaDoc, sel: Selection, owner: string) {
  const item = selected(doc, sel) as Tagged | undefined;
  if (!item || (sel?.kind === 'area' && owner === RING)) return;
  item[IN_SEA] = owner;
  if (sel?.kind === 'island') {
    const island = findIsland(doc, sel.id)!;
    const port = portOn(doc, island.id) as Tagged | undefined;
    const wp = waypointOf(doc, island) as Tagged | undefined;
    if (port) port[IN_SEA] = owner;
    if (wp) wp[IN_SEA] = owner;
  }
}

/**
 * Starts a new sea file: an id that becomes its file name (lower case, dashes), a name, and an
 * empty sea that opens after the others. Returns the id, or null when it is taken or unusable.
 */
export function addSea(doc: SeaDoc, id: string, name: string): string | null {
  const clean = id.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(clean) || clean === 'grown' || clean === RING) return null;
  if (seaIds(doc).includes(clean)) return null;
  doc.seaEditor.seas.push({
    keys: ['id', 'name', ...SEA_LISTS.slice(0, 4)],
    values: { id: clean, name: name.trim() || clean },
  });
  doc.seaEditor.active = clean;
  return clean;
}

const strip = <T>(item: T): T => {
  const copy = structuredClone(item) as Tagged;
  delete copy[IN_SEA];
  return copy as T;
};

/** The listed things one file owns, untagged, in the merged map's order. */
function owned(doc: SeaDoc, key: ListKey, owner: string, fallback: string): unknown[] {
  if (key === 'chartAreas' && owner === RING) return [];
  return (listOf(doc, key) ?? []).filter((item) => (item[IN_SEA] ?? fallback) === owner).map(strip);
}

/**
 * Writes one file's keys in its own order: its lists from the merged map, its fields from `field`;
 * a list it did not have yet is added (in `SEA_LISTS` order) once it has something in it.
 */
function build(
  doc: SeaDoc,
  file: FileHead,
  owner: string,
  field: (key: string) => unknown,
): Record<string, unknown> {
  const fallback = doc.seaEditor.active;
  // A list the file did not have yet goes in after the lists before it in SEA_LISTS order.
  const keys = [...file.keys];
  for (const [n, key] of SEA_LISTS.entries()) {
    if (keys.includes(key) || !owned(doc, key, owner, fallback).length) continue;
    const before = SEA_LISTS.slice(0, n).filter((k) => keys.includes(k));
    const at = before.length ? keys.indexOf(before[before.length - 1]!) + 1 : keys.length;
    keys.splice(at, 0, key);
  }
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (LIST_KEYS.has(key)) out[key] = owned(doc, key as ListKey, owner, fallback);
    else {
      const value = field(key);
      if (value !== undefined) out[key] = value;
    }
  }
  return out;
}

/** The files the sea editor writes: the ring, `grown.json` and every sea, as data. */
export function splitSeas(doc: SeaDoc): { ring: MapDef; grown: GrownDef; seas: SeaDef[] } {
  const { seaEditor } = doc;
  const top = doc as unknown as Record<string, unknown>;
  const ring = build(doc, seaEditor.ring, RING, (key) =>
    RING_OWN.has(key) ? seaEditor.ring.values[key] : structuredClone(top[key]),
  );
  // A map field set in the editor that the ring file did not have yet (a home port, say).
  for (const [key, value] of Object.entries(doc))
    if (
      !(key in ring) &&
      value !== undefined &&
      !LIST_KEYS.has(key) &&
      !RING_OWN.has(key) &&
      key !== 'seaEditor'
    )
      ring[key] = structuredClone(value);
  const seas = seaEditor.seas.map(
    (file) =>
      build(doc, file, file.values.id as string, (key) =>
        structuredClone(file.values[key]),
      ) as unknown as SeaDef,
  );
  const grown: GrownDef = { ...structuredClone(seaEditor.grown) };
  grown.boundsRadius = doc.boundsRadius;
  if (doc.fog && 'chartedRadius' in grown) grown.chartedRadius = doc.fog.chartedRadius;
  grown.seas = seaIds(doc);
  return { ring: ring as unknown as MapDef, grown, seas };
}

/** One file of an export: where it goes, its text and whether it differs from the shipped one. */
export interface SeaExport {
  path: string;
  text: string;
  changed: boolean;
}

/**
 * Every file of the sea, formatted like the repository's own (Prettier, keeping the objects the
 * shipped file writes open), with whether each changed. `shipped` maps paths to their text.
 */
export function seaExports(doc: SeaDoc, shipped: Record<string, string>): SeaExport[] {
  const { ring, grown, seas } = splitSeas(doc);
  const files: [string, unknown][] = [
    [seaPath(RING), ring],
    [GROWN_PATH, grown],
    ...seas.map((sea): [string, unknown] => [seaPath(sea.id), sea]),
  ];
  return files.map(([path, data]) => {
    const text = formatMapJson(data, shipped[path]);
    return { path, text, changed: text !== shipped[path] };
  });
}

/**
 * Loads a sea file (or the ring's map file) into the sea: its things replace the ones that file
 * had, a sea not listed yet is added after the others. False when it is neither.
 */
export function importSeaFile(doc: SeaDoc, raw: unknown): boolean {
  const file = raw as Record<string, unknown> | null;
  if (!file || typeof file !== 'object' || !Array.isArray(file.islands)) return false;
  const isRing = typeof file.boundsRadius === 'number' && typeof file.start === 'object';
  const id = isRing ? RING : file.id;
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id) || id === 'grown') return false;
  const items = tagged(file, id) as Record<string, unknown>;
  const top = doc as unknown as Record<string, unknown>;
  for (const key of SEA_LISTS) {
    const kept = (listOf(doc, key) ?? []).filter((x) => x[IN_SEA] !== id);
    const added = (items[key] as Tagged[] | undefined) ?? [];
    // The ring's things come first, as in the game's merged map.
    setList(doc, key, id === RING ? [...added, ...kept] : [...kept, ...added]);
  }
  if (isRing) {
    doc.seaEditor.ring = head(file);
    for (const key of doc.seaEditor.ring.keys)
      if (!LIST_KEYS.has(key) && !RING_OWN.has(key)) top[key] = structuredClone(file[key]);
  } else {
    const at = doc.seaEditor.seas.findIndex((s) => s.values.id === id);
    if (at >= 0) doc.seaEditor.seas[at] = head(file);
    else doc.seaEditor.seas.push(head(file));
  }
  return true;
}
