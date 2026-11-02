import { TUNING_META, metaPath } from '../data/tuning-meta';

/**
 * The tuning files' edits, shared by the `npm run tune` tool and anything else that changes a
 * number by its path (`hud.idleFadeSec`): find it, check it against the meta's range, set it.
 */
export interface TuningRow {
  path: string;
  value: unknown;
  label: string;
  range: string;
}

type Tree = Record<string, unknown>;

const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every leaf of a tuning file with its label and range from the meta. */
export function tuningRows(tuning: Tree, prefix: string): TuningRow[] {
  const rows: TuningRow[] = [];
  const walk = (node: unknown, path: string[]) => {
    if (isTree(node)) return Object.entries(node).forEach(([k, v]) => walk(v, [...path, k]));
    const meta = TUNING_META[metaPath(path)];
    const range =
      meta?.kind === 'number' ? `${meta.min}..${meta.max}${meta.unit ? ` ${meta.unit}` : ''}` : '';
    rows.push({ path: path.join('.'), value: node, label: meta?.label ?? '', range });
  };
  walk(tuning[prefix], [prefix]);
  return rows;
}

/** What is wrong with setting this number, or null when it is fine. */
export function valueProblem(path: string, value: number): string | null {
  const meta = TUNING_META[metaPath(path.split('.'))];
  if (!meta) return `no such tuning value: ${path}`;
  if (meta.kind !== 'number') return `${path} is not a number`;
  if (!Number.isFinite(value)) return `${path}: not a number`;
  if (value < meta.min || value > meta.max)
    return `${path}: ${value} is outside ${meta.min}..${meta.max}`;
  return null;
}

/** Sets the number at `path` (file first: `hud.idleFadeSec`) in a copy of the file's JSON. */
export function withValue(file: Tree, path: string, value: number): Tree {
  const keys = path.split('.').slice(1);
  const copy = structuredClone(file);
  let node: Tree = copy;
  for (const key of keys.slice(0, -1)) {
    const next = node[key];
    if (!isTree(next)) throw new Error(`no such tuning value: ${path}`);
    node = next;
  }
  const last = keys.at(-1)!;
  if (!(last in node)) throw new Error(`no such tuning value: ${path}`);
  node[last] = value;
  return copy;
}
