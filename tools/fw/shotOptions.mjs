// Parsers of `npm run shots` options (shots.mjs): points, lists, files, key holds and `--look`.
import { readFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { ROOT } from './lib.mjs';

export const pair = (v) => {
  if (Array.isArray(v)) return v.map(Number);
  const out = String(v).split(',').map(Number);
  if (out.length !== 2 || out.some((n) => !Number.isFinite(n))) throw new Error(`not x,y: ${v}`);
  return out;
};
/** The night's middle, in game seconds, from the tuning file (decision 0068). */
export function nightTime() {
  const w = JSON.parse(readFileSync(resolve(ROOT, 'src/data/tuning/weather.json'), 'utf8'));
  const { duskEnd, nightEnd } = w.daylight;
  return Math.round((duskEnd + nightEnd) / 2);
}

/** `--tune`: a `?tune` export or a plain { "path.in.TUNING": value } object, from a JSON file. */
export function tuneChanges(file) {
  const json = JSON.parse(readFileSync(resolve(ROOT, file), 'utf8'));
  return json.changes ?? json;
}

/** `--tune`, run in the page: the game's own tuning module (Vite serves it once). */
export const applyTune = (c) => import('/src/data/tuningEdits.ts').then((m) => m.applyChanges(c));

export const list = (v) => (Array.isArray(v) ? v : String(v).split(',').filter(Boolean));
export const readAll = (v) =>
  list(v)
    .map((f) => readFileSync(resolve(ROOT, f), 'utf8'))
    .join('\n;\n');
export const keyHold = (v) => {
  const [key, n] = String(v).split(':');
  return { key, n: Number(n) || 1 };
};

/** The file name of a shot when `--name` is not given. */
export function defaultName(s) {
  if (s.editor)
    return ['editor', s.editor, s.select?.replace(/[:]/g, '-'), s.exportOpen && 'export']
      .filter(Boolean)
      .join('-');
  const sea = s.seaFile ? basename(s.seaFile, extname(s.seaFile)) : s.sea;
  const where = s.port ?? (s.at ? `${s.at[0]}_${s.at[1]}` : 'start');
  return [
    sea,
    s.boot ?? (s.menu ? 'menu' : where),
    s.chart && 'chart',
    s.night && 'night',
    s.lang !== 'en' && s.lang,
  ]
    .filter(Boolean)
    .join('-');
}
