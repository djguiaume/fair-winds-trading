// Parsers of `npm run shots` options (shots.mjs): points, lists, files, key holds and `--look`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib.mjs';

export const pair = (v) => {
  if (Array.isArray(v)) return v.map(Number);
  const out = String(v).split(',').map(Number);
  if (out.length !== 2 || out.some((n) => !Number.isFinite(n))) throw new Error(`not x,y: ${v}`);
  return out;
};
export const list = (v) => (Array.isArray(v) ? v : String(v).split(',').filter(Boolean));
export const readAll = (v) =>
  list(v)
    .map((f) => readFileSync(resolve(ROOT, f), 'utf8'))
    .join('\n;\n');
export const keyHold = (v) => {
  const [key, n] = String(v).split(':');
  return { key, n: Number(n) || 1 };
};

/** `--look`: a ground look (`v1`, `v2`), a camera point (`x,y`), or both (`v2,x,y`). */
export function lookOption(v) {
  if (v === undefined) return { look: null, ground: null };
  const [first, ...rest] = Array.isArray(v) ? v : String(v).split(',');
  if (!/^v[12]$/.test(String(first))) return { look: pair(v), ground: null };
  return { look: rest.length ? pair(rest) : null, ground: first };
}
