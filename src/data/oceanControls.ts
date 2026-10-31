import { TUNING_META, metaPath } from './tuning-meta';
import {
  type TuneFile,
  changedFiles,
  liveValue,
  setTuneValue,
  snapToMeta,
  tuneLeaves,
} from './tuningEdits';

/**
 * What an ocean control changes (decision 0250). Only `sailing` changes a sailing rule: how much
 * the waves slow the boat (decision 0256); course, grounding and docking never read the waves.
 * - `sailing`: the waves' drag on her speed, the same on every level.
 * - `sea`: the wave field everything floats on, the same on every quality level and frame rate
 *   (what boats will ride from v1.3.1).
 * - `drawing`: how the ocean draws and shades that field.
 * - `comfort`: how much the sea moves the boat and the camera on screen.
 * - `level`: whether a quality level draws the waves by default (Settings › Waves overrides it).
 * - `review`: the fixed sea states of `?waves=calm|wind|storm`.
 */
export type OceanEffect = 'sailing' | 'sea' | 'drawing' | 'comfort' | 'level' | 'review';

export interface OceanControl {
  /** Dotted tuning path, e.g. `waves.motion.gentle`. */
  path: string;
  label: string;
  value: unknown;
  effect: OceanEffect;
}

const DRAWING = ['drawCells', 'shadeCells', 'foam', 'surf', 'wash', 'look'];

function effectOf(path: readonly string[]): OceanEffect | null {
  if (path[0] === 'graphics') return path[1] === 'quality' && path[3] === 'waves' ? 'level' : null;
  if (path[0] !== 'waves') return null;
  if (path[1] === 'drag') return 'sailing';
  if (path[1] === 'motion') return 'comfort';
  if (path[1] === 'previews') return 'review';
  return DRAWING.includes(path[1]!) ? 'drawing' : 'sea';
}

/** Every ocean control with its live value: the `?tune` Waves tab's numbers and the switches. */
export function oceanControls(): OceanControl[] {
  const out: OceanControl[] = [];
  for (const { path, value } of tuneLeaves()) {
    const effect = effectOf(path);
    if (!effect) continue;
    const meta = TUNING_META[metaPath(path)];
    out.push({ path: path.join('.'), label: meta?.label ?? path.join('.'), value, effect });
  }
  return out;
}

/**
 * Set ocean controls from `path=value` pairs as the `?tune` panel would (numbers kept inside their
 * slider's range and step); returns the files to write. Throws on a path that is not an ocean
 * control or a value of the wrong kind, changing nothing.
 */
export function setOceanControls(pairs: readonly string[]): TuneFile[] {
  const edits = pairs.map((pair) => {
    const [key = '', text = ''] = pair.split('=');
    const path = key.split('.');
    if (!effectOf(path) || liveValue(path) === undefined)
      throw new Error(`${key}: not an ocean control`);
    return { key, path, value: parseValue(key, text) };
  });
  for (const { key, path, value } of edits)
    if (!setTuneValue(path, value))
      throw new Error(`${key}: ${JSON.stringify(value)} does not fit`);
  return changedFiles(Object.fromEntries(edits.map((e) => [e.key, e.value as never])));
}

function parseValue(key: string, text: string): unknown {
  const meta = TUNING_META[metaPath(key.split('.'))];
  if (text === 'true' || text === 'false') return text === 'true';
  if (text.includes(',')) return text.split(',').map(Number);
  const n = Number(text);
  if (!Number.isFinite(n)) return text;
  return meta?.kind === 'number' ? snapToMeta(meta, n) : n;
}
