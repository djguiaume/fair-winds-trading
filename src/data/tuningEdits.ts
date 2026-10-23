import { strFromU8, strToU8, unzlibSync, zlibSync } from 'fflate';
import type { SaveStorage } from '../sim/save';
import { fromBase64Url, toBase64Url } from '../sim/saveTransfer';
import { clearDifficultyWeatherCache } from '../sim/difficulty';
import { clearWeatherCaches } from '../sim/wind';
import { formatJson } from './jsonFormat';
import { SHIP_FILES } from './ships';
import { SHIPPED_TUNING, TUNING, resetTuning } from './tuning';
import { TUNING_GROUPS } from './tuning-meta';

/**
 * Edits made in the `?tune` panel (decision 0114), kept apart from the UI so tests and the
 * balance worker use them as they are. An edit set is a flat record of the values that differ
 * from the shipped files, keyed by their dotted path in `TUNING`:
 * `{ "ships.cutter.speedRatio": 0.69, "upgrades.effects.sailsSpeed": [1, 1.12, 1.25] }`.
 * Arrays (polars, per-level tables) are one value. The same record is stored in the browser,
 * packed into share links and sent to the balance worker. Pure: no DOM.
 */
export type TuneValue = number | boolean | string | TuneValue[];
export type TuneChanges = Record<string, TuneValue>;

/** Browser storage key of the edits; tune mode also plays its own voyage under `TUNE_PREFIX`. */
export const TUNE_KEY = 'fwt.tune.v1';
export const TUNE_PREFIX = 'fwt.tune.play.';
/** Share links: `…/?tune#tune=FT1…`, the same zlib + URL-safe base64 packing as save codes. */
export const TUNE_LINK_KEY = 'tune';
export const TUNE_CODE_PREFIX = 'FT1';

type Tree = Record<string, unknown>;
const isPlainObject = (v: unknown): v is Tree =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every editable value: anything that is not a plain object (arrays are one value). */
export function tuneLeaves(tree: unknown = TUNING, path: string[] = []) {
  const out: Array<{ path: string[]; value: unknown }> = [];
  if (isPlainObject(tree))
    for (const [k, v] of Object.entries(tree)) out.push(...tuneLeaves(v, [...path, k]));
  else out.push({ path, value: tree });
  return out;
}

export function valueAt(tree: unknown, path: readonly string[]): unknown {
  let at = tree;
  for (const key of path) {
    if (!isPlainObject(at)) return undefined;
    at = at[key];
  }
  return at;
}

export const shippedValue = (path: readonly string[]) => valueAt(SHIPPED_TUNING, path);
export const liveValue = (path: readonly string[]) => valueAt(TUNING, path);

/** Same kind of value: numbers for numbers, arrays of the same length and shape. */
function sameShape(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => sameShape(x, b[i]))
    );
  if (typeof a === 'number') return typeof b === 'number' && Number.isFinite(b);
  return typeof a === typeof b;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Change one live value in place (arrays too, so references into `TUNING` stay valid) and drop
 * the weather caches, which are keyed by config object and would keep the old numbers. Returns
 * false, changing nothing, for an unknown path or a value of another shape.
 */
export function setTuneValue(path: readonly string[], value: unknown): boolean {
  const shipped = shippedValue(path);
  if (shipped === undefined || isPlainObject(shipped) || !sameShape(shipped, value)) return false;
  const parent = valueAt(TUNING, path.slice(0, -1)) as Tree;
  const key = path[path.length - 1]!;
  const current = parent[key];
  if (Array.isArray(current)) current.splice(0, current.length, ...structuredClone(value as []));
  else parent[key] = value;
  clearWeatherCaches();
  clearDifficultyWeatherCache();
  return true;
}

/** The values that differ from the shipped files, by dotted path. */
export function currentChanges(): TuneChanges {
  const out: TuneChanges = {};
  for (const { path, value } of tuneLeaves())
    if (!same(value, shippedValue(path))) out[path.join('.')] = structuredClone(value) as TuneValue;
  return out;
}

/** Start from the shipped values and apply an edit set; unknown or misshapen entries are skipped. */
export function applyChanges(changes: TuneChanges): { applied: number; skipped: string[] } {
  resetTuning();
  clearWeatherCaches();
  clearDifficultyWeatherCache();
  const skipped: string[] = [];
  let applied = 0;
  for (const [key, value] of Object.entries(changes)) {
    if (setTuneValue(key.split('.'), value)) applied++;
    else skipped.push(key);
  }
  return { applied, skipped };
}

// --- Browser storage ------------------------------------------------------------------------

export function loadTuneChanges(storage: SaveStorage | null): TuneChanges {
  try {
    const raw = JSON.parse(storage?.getItem(TUNE_KEY) ?? '{}') as { changes?: unknown };
    return isPlainObject(raw.changes) ? (raw.changes as TuneChanges) : {};
  } catch {
    return {};
  }
}

export function saveTuneChanges(storage: SaveStorage | null, changes: TuneChanges): void {
  try {
    if (Object.keys(changes).length === 0) storage?.removeItem(TUNE_KEY);
    else storage?.setItem(TUNE_KEY, JSON.stringify({ version: 1, changes }));
  } catch {
    // Private mode or a full storage: the edits still apply until the page closes.
  }
}

// --- Share links ----------------------------------------------------------------------------

export function encodeTuneCode(changes: TuneChanges): string {
  return TUNE_CODE_PREFIX + toBase64Url(zlibSync(strToU8(JSON.stringify(changes)), { level: 9 }));
}

/** The edits in a link, a `#tune=` hash or a bare code, or null if it cannot be read. */
export function decodeTuneCode(text: string): TuneChanges | null {
  const flat = text.replace(/\s+/g, '');
  const at = flat.indexOf(`#${TUNE_LINK_KEY}=`);
  const code = at >= 0 ? flat.slice(at + TUNE_LINK_KEY.length + 2) : flat;
  if (!code.startsWith(TUNE_CODE_PREFIX) || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const raw: unknown = JSON.parse(
      strFromU8(unzlibSync(fromBase64Url(code.slice(TUNE_CODE_PREFIX.length)))),
    );
    return isPlainObject(raw) ? (raw as TuneChanges) : null;
  } catch {
    return null;
  }
}

/** The game in tune mode with the edits after `#tune=`; opening it offers to load them. */
export function tuneLink(gameUrl: string, changes: TuneChanges): string {
  const base = gameUrl.split('#')[0]!.split('?')[0]!;
  return `${base}?tune#${TUNE_LINK_KEY}=${encodeTuneCode(changes)}`;
}

// --- Export ---------------------------------------------------------------------------------

export interface TuneFile {
  /** Path in the repository, e.g. `src/data/tuning/economy.json`. */
  path: string;
  /** The whole file with the live values, formatted like the repo's own files. */
  text: string;
}

/** The repository file a value lives in. */
export function fileOf(path: readonly string[]): string {
  return path[0] === 'ships' ? `src/data/ships/${path[1]}.json` : `src/data/tuning/${path[0]}.json`;
}

/** Each file holding a changed value, rebuilt whole from the live values. */
export function changedFiles(changes: TuneChanges = currentChanges()): TuneFile[] {
  const paths = new Set(Object.keys(changes).map((k) => fileOf(k.split('.'))));
  const out: TuneFile[] = [];
  for (const group of Object.keys(TUNING_GROUPS) as Array<keyof typeof TUNING_GROUPS>) {
    if (group === 'ships') {
      for (const file of SHIP_FILES) {
        const path = fileOf(['ships', file.id]);
        if (!paths.has(path)) continue;
        const live = TUNING.ships[file.id]! as unknown as Tree;
        const copy = structuredClone(file);
        const sailing = copy.sailing as unknown as Tree;
        const unlock = copy.unlock as unknown as Tree;
        for (const k of Object.keys(sailing)) if (k in live) sailing[k] = live[k];
        for (const k of Object.keys(unlock)) unlock[k] = live[k];
        copy.tier = live.tier as number;
        out.push({ path, text: formatJson(copy) });
      }
    } else {
      const path = fileOf([group]);
      if (paths.has(path)) out.push({ path, text: formatJson(TUNING[group]) });
    }
  }
  return out;
}

/** Decimals of a step: 0.005 → 3. */
const decimals = (step: number) => (String(step).split('.')[1] ?? '').length;

/**
 * A typed or dragged number made valid for its file: inside the meta range and on its step, so
 * an exported file passes the tuning tests.
 */
export function snapToMeta(meta: { min: number; max: number; step: number }, value: number) {
  const clamped = Math.min(meta.max, Math.max(meta.min, value));
  return Number((Math.round(clamped / meta.step) * meta.step).toFixed(decimals(meta.step)));
}
