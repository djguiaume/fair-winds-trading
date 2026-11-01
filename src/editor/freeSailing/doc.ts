import { FREE_PRESETS, FREE_RULES, sortPresets } from '../../data/freeSailing';
import { formatJson } from '../../data/jsonFormat';
import { GAME_MAP } from '../../data/maps';
import type { FreePreset } from '../../sim/freeSailing';
import { presetProblems } from '../../sim/freeSailingChecks';

/**
 * The Free Sailing presets as the editors' page and `npm run free` edit them (decision 0266).
 * Pure, so the page, the command and the tests share the same template, edits, checks and
 * files: one `src/data/free-sailing/<id>.json` per preset.
 */
export interface FreeSailingDoc {
  presets: FreePreset[];
}

/** Where the page keeps its working copy in this browser. */
export const EDITED_FREE_KEY = 'fwt-editor-free-sailing';

export const shippedFreeDoc = (): FreeSailingDoc => ({ presets: structuredClone(FREE_PRESETS) });

export const freeProblems = (doc: FreeSailingDoc) =>
  presetProblems(doc.presets, GAME_MAP, FREE_RULES);

export const presetText = (p: FreePreset) => formatJson(p);

/** Every preset file as (path, text), relative to `src/data/free-sailing`. */
export const presetFiles = (doc: FreeSailingDoc) =>
  sortPresets(doc.presets).map((p) => ({ path: `${p.id}.json`, text: presetText(p) }));

export const findPreset = (doc: FreeSailingDoc, id: string) => doc.presets.find((p) => p.id === id);

/** A new preset copied from `from` (default the first), or a problem when the id is taken. */
export function addPreset(doc: FreeSailingDoc, id: string, from?: string): FreePreset | string {
  if (findPreset(doc, id)) return `${id} already exists`;
  if (from && !findPreset(doc, from)) return `no preset ${from} to copy`;
  const source = (from ? findPreset(doc, from) : doc.presets[0]) ?? FREE_PRESETS[0]!;
  const preset = { ...structuredClone(source), id };
  doc.presets.push(preset);
  return preset;
}

export function removePreset(doc: FreeSailingDoc, id: string): boolean {
  const n = doc.presets.length;
  doc.presets = doc.presets.filter((p) => p.id !== id);
  return doc.presets.length < n;
}

/** The fields a preset has, dotted, and whether each holds a number. */
export const PRESET_FIELDS: Record<string, 'text' | 'number'> = {
  'name.en': 'text',
  'name.fr': 'text',
  'about.en': 'text',
  'about.fr': 'text',
  'place.x': 'number',
  'place.y': 'number',
  'place.headingDeg': 'number',
  hour: 'number',
  weather: 'text',
  'ship.class': 'text',
  'ship.sails': 'number',
  'ship.hold': 'number',
  'ship.hull': 'number',
};

/** Sets one field from text (`npm run free -- set` and the page's inputs); a problem or null. */
export function setPresetField(
  doc: FreeSailingDoc,
  id: string,
  path: string,
  value: string,
): string | null {
  const preset = findPreset(doc, id);
  if (!preset) return `no preset ${id}`;
  const kind = PRESET_FIELDS[path];
  if (!kind) return `unknown field ${path}; fields: ${Object.keys(PRESET_FIELDS).join(', ')}`;
  const v = kind === 'number' ? Number(value) : value;
  if (kind === 'number' && !Number.isFinite(v)) return `${path} needs a number`;
  const [head, tail] = path.split('.') as [keyof FreePreset, string | undefined];
  if (tail) (preset[head] as unknown as Record<string, unknown>)[tail] = v;
  else (preset as unknown as Record<string, unknown>)[head] = v;
  return null;
}

/** A field's value as text, for the page's inputs and `list`. */
export function presetField(preset: FreePreset, path: string): string {
  const [head, tail] = path.split('.') as [keyof FreePreset, string | undefined];
  const v = tail ? (preset[head] as unknown as Record<string, unknown>)[tail] : preset[head];
  return String(v ?? '');
}

/** A working copy read back from the browser: only the shape, the checks say the rest. */
export function isFreeDoc(raw: unknown): raw is FreeSailingDoc {
  const doc = raw as FreeSailingDoc | null;
  return !!doc && Array.isArray(doc.presets) && doc.presets.every((p) => typeof p?.id === 'string');
}
