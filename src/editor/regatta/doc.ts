import shippedRegatta from '../../data/regatta.json';
import shippedFlags from '../../data/flags.json';
import { formatJson } from '../../data/jsonFormat';
import {
  FLAG_SHAPES,
  type FlagDef,
  type FlagShape,
  type RegattaData,
  checkRegattaData,
} from '../../sim/regatta';

/**
 * The regatta's two files as the Regatta page and `npm run race` edit them (decision 0217):
 * `regatta.json` (the rules, Kestrel, the series) and `flags.json` (pennants and burgees). Pure,
 * so the page, the command and the tests share the same edits, checks and export.
 */
export interface RegattaDoc {
  regatta: RegattaData & { about?: string };
  flags: { about?: string; flags: FlagDef[] };
}

/** Where the page keeps its working copy in this browser. */
export const EDITED_REGATTA_KEY = 'fwt-editor-regatta';

export const shippedRegattaDoc = (): RegattaDoc =>
  structuredClone({ regatta: shippedRegatta, flags: shippedFlags }) as unknown as RegattaDoc;

/** Every problem in both files: the same checks the game's tests and `npm run check` run. */
export const regattaProblems = (doc: RegattaDoc) => checkRegattaData(doc.regatta, doc.flags.flags);

/** Each file's text, byte for byte as it is written in `src/data`. */
export const regattaText = (doc: RegattaDoc) => formatJson(doc.regatta);
export const flagsText = (doc: RegattaDoc) => formatJson(doc.flags);

/** Whether something parsed from the browser looks like the page's working copy. */
export function isRegattaDoc(v: unknown): v is RegattaDoc {
  const d = v as RegattaDoc | null;
  return (
    !!d &&
    typeof d === 'object' &&
    typeof d.regatta?.medals === 'object' &&
    Array.isArray(d.flags?.flags)
  );
}

/**
 * Sets one value of `regatta.json` by its path (`medals.silver`, `rival.hull`,
 * `rival.paceRange`), read as the kind the file already holds there: a number, a list of numbers
 * ("0.45,1.4") or words. Returns a problem, or null when set.
 */
export function setRule(doc: RegattaDoc, path: string, text: string): string | null {
  const keys = path.split('.');
  let at = doc.regatta as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) {
    const next = at[k];
    if (!next || typeof next !== 'object' || Array.isArray(next)) return `no "${path}"`;
    at = next as Record<string, unknown>;
  }
  const key = keys[keys.length - 1]!;
  const was = at[key];
  if (was === undefined || key === 'series' || key === 'about') return `no "${path}" to set`;
  if (typeof was === 'number') {
    const n = Number(text);
    if (!Number.isFinite(n)) return `${path}: a number`;
    at[key] = n;
  } else if (Array.isArray(was)) {
    const ns = text.split(',').map(Number);
    if (ns.length !== was.length || ns.some((n) => !Number.isFinite(n)))
      return `${path}: ${was.length} numbers, as "${was.join(',')}"`;
    at[key] = ns;
  } else at[key] = text;
  return null;
}

/** A series' name, pennant or prize ship (empty for none), or a new series. */
export function setSeries(
  doc: RegattaDoc,
  id: string,
  change: { name?: string; pennant?: string; prize?: string },
): void {
  let s = doc.regatta.series.find((x) => x.id === id);
  if (!s) {
    s = { id, name: change.name ?? id, pennant: change.pennant ?? '' };
    doc.regatta.series.push(s);
  }
  if (change.name !== undefined) s.name = change.name;
  if (change.pennant !== undefined) s.pennant = change.pennant;
  if (change.prize === '') delete s.prize;
  else if (change.prize !== undefined) s.prize = change.prize;
}

/** A flag's shape, bands or size, or a new flag (a plain red pennant until told otherwise). */
export function setFlag(
  doc: RegattaDoc,
  id: string,
  change: Partial<Omit<FlagDef, 'id'>>,
): FlagDef {
  let f = doc.flags.flags.find((x) => x.id === id);
  if (!f) {
    f = { id, shape: 'pennant', bands: ['#d2462f'], length: 1.2, height: 0.5 };
    doc.flags.flags.push(f);
  }
  Object.assign(f, change);
  return f;
}

export function removeFlag(doc: RegattaDoc, id: string): boolean {
  const n = doc.flags.flags.length;
  doc.flags.flags = doc.flags.flags.filter((f) => f.id !== id);
  return doc.flags.flags.length < n;
}

export const isFlagShape = (v: string): v is FlagShape => FLAG_SHAPES.includes(v as FlagShape);

/**
 * A flag drawn flat as SVG, as `flagGeometry` builds it in the game: the luff on the left, the
 * bands from the mast out, a swallowtail's fork cut 70 % in. `px` pixels per flag unit.
 */
export function flagSvg(f: FlagDef, px = 80): string {
  const L = f.length * px;
  const H = f.height * px;
  const bands = f.bands.length ? f.bands : ['#d2462f'];
  const n = bands.length;
  const polys: string[] = [];
  const poly = (pts: number[][], c: string) =>
    polys.push(
      `<polygon points="${pts.map(([x, y]) => `${(x! * L).toFixed(1)},${y!.toFixed(1)}`).join(' ')}" fill="${c}"/>`,
    );
  if (f.shape === 'swallowtail') {
    const fork = 0.7;
    for (let i = 0; i < n; i++)
      poly(
        [
          [(i / n) * fork, 0],
          [((i + 1) / n) * fork, 0],
          [((i + 1) / n) * fork, H],
          [(i / n) * fork, H],
        ],
        bands[i]!,
      );
    const last = bands[n - 1]!;
    poly(
      [
        [fork, 0],
        [1, 0],
        [1, H * 0.25],
        [fork, H * 0.5],
      ],
      last,
    );
    poly(
      [
        [fork, H * 0.5],
        [1, H * 0.75],
        [1, H],
        [fork, H],
      ],
      last,
    );
  } else {
    const top = (u: number) => (H / 2) * u;
    const bottom = (u: number) => H - (H / 2) * u;
    for (let i = 0; i < n; i++) {
      const u0 = i / n;
      const u1 = (i + 1) / n;
      poly(
        [
          [u0, top(u0)],
          [u1, top(u1)],
          [u1, bottom(u1)],
          [u0, bottom(u0)],
        ],
        bands[i]!,
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(L) + 6}" height="${Math.ceil(H) + 6}" viewBox="-3 -3 ${Math.ceil(L) + 6} ${Math.ceil(H) + 6}"><line x1="0" y1="-3" x2="0" y2="${H + 3}" stroke="#22252a" stroke-width="3"/>${polys.join('')}</svg>`;
}
