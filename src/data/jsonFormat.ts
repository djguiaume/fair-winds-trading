/**
 * JSON written the way Prettier writes the repo's data files (2 spaces, 100 columns), so a file
 * exported from the `?tune` panel passes `npm run lint` unchanged and its pull request diff shows
 * only the changed values (decision 0114). The rules Prettier follows for JSON:
 * - objects always open one key per line (the data files never keep an object on one line);
 * - an array stays on one line when it fits, else one element per line;
 * - an array of two or more arrays (or objects) that all have two or more elements, such as a
 *   polar curve, always breaks, one element per line.
 */
const WIDTH = 100;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const isObject = (v: Json): v is { [key: string]: Json } =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * One line, or null if it cannot be: objects never sit on one line, except in files whose objects
 * were written on one line where they fit (`inline`, the quest files), as Prettier keeps them.
 */
function flat(v: Json, inline: boolean): string | null {
  if (isObject(v)) {
    const keys = Object.keys(v);
    if (keys.length === 0) return '{}';
    if (!inline) return null;
    const parts = keys.map((k) => {
      const one = flat(v[k]!, inline);
      return one === null ? null : `${JSON.stringify(k)}: ${one}`;
    });
    return parts.some((p) => p === null) ? null : `{ ${parts.join(', ')} }`;
  }
  if (Array.isArray(v)) {
    if (inline && matrix(v)) return null;
    const parts = v.map((e) => flat(e, inline));
    return parts.some((p) => p === null) ? null : `[${parts.join(', ')}]`;
  }
  return JSON.stringify(v);
}

const multi = (v: Json) =>
  (Array.isArray(v) && v.length > 1) || (isObject(v) && Object.keys(v).length > 1);

function matrix(v: Json[]): boolean {
  if (v.length < 2) return false;
  const first = v[0]!;
  return v.every((e) => multi(e) && Array.isArray(e) === Array.isArray(first));
}

/** `v` printed at `indent`, its first line starting after `lead` characters on that line. */
function print(v: Json, indent: string, lead: number, tail: number, inline = false): string {
  const inner = indent + '  ';
  if (isObject(v)) {
    const keys = Object.keys(v);
    if (keys.length === 0) return '{}';
    // The file's own object (indent '') always opens one key per line.
    const one = inline && indent ? flat(v, inline) : null;
    if (one !== null && lead + one.length + tail <= WIDTH) return one;
    const lines = keys.map((k, i) => {
      const key = `${JSON.stringify(k)}: `;
      const comma = i < keys.length - 1 ? 1 : 0;
      return inner + key + print(v[k]!, inner, inner.length + key.length, comma, inline);
    });
    return `{\n${lines.join(',\n')}\n${indent}}`;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    const one = flat(v, inline);
    if (one !== null && !matrix(v) && lead + one.length + tail <= WIDTH) return one;
    const lines = v.map(
      (e, i) => inner + print(e, inner, inner.length, i < v.length - 1 ? 1 : 0, inline),
    );
    return `[\n${lines.join(',\n')}\n${indent}]`;
  }
  return JSON.stringify(v);
}

/** The file text for a value, with the final newline. */
export function formatJson(value: unknown): string {
  return print(value as Json, '', 0, 0) + '\n';
}

/**
 * A quest file (decision 0142): as `formatJson`, but objects stay on one line where they fit, as
 * the quest files are written (`{ "x": 205, "y": 8 }`, `"reward": { "gold": 100 }`).
 */
export function formatQuestJson(value: unknown): string {
  return print(value as Json, '', 0, 0, true) + '\n';
}
